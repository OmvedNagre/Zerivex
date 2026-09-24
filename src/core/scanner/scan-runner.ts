import { query } from '@/core/db/database';
import { assertTargetScanAuthorization } from '@/core/targets/verification-service';
import { getTargetById } from '@/core/targets/target-service';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { redactEvidence } from './evidence-redactor';
import { ScanCheck, ScanContext, RawFinding, ScanMode, Severity } from './checks/types';

// Check Modules
import { tlsCheck } from './checks/tls-check';
import { headersCheck } from './checks/headers-check';
import { corsCheck } from './checks/cors-check';
import { exposedSecretsCheck } from './checks/exposed-secrets-check';
import { cookiesCheck } from './checks/cookies-check';
import { aiCodeSmellsCheck } from './checks/ai-code-smells-check';
import { sqliCheck } from './checks/sqli-check';
import { xssCheck } from './checks/xss-check';
import { openRedirectCheck } from './checks/open-redirect-check';
import { pathTraversalCheck } from './checks/path-traversal-check';
import { apiSecurityCheck } from './checks/api-security-check';
import { securityTxtCheck } from './checks/security-txt-check';
import { httpMethodsCheck } from './checks/http-methods-check';
import { stackTraceCheck } from './checks/stack-trace-check';
import { crawlAttackSurface } from '@/core/surface/crawler';
import { upsertDiscoveredEndpoints, upsertTechnologyFingerprints } from '@/core/surface/surface-repository';
import { evaluateScanRegression } from '@/core/monitoring/regression-detector';
import { createMonitoringAlert } from '@/core/monitoring/monitoring-repository';
import { dispatchWebhookEvent } from '@/core/webhooks/webhook-dispatcher';

export const ALL_SCAN_CHECKS: ScanCheck[] = [
  tlsCheck,
  headersCheck,
  corsCheck,
  exposedSecretsCheck,
  cookiesCheck,
  aiCodeSmellsCheck,
  sqliCheck,
  xssCheck,
  openRedirectCheck,
  pathTraversalCheck,
  apiSecurityCheck,
  securityTxtCheck,
  httpMethodsCheck,
  stackTraceCheck,
];

export interface ScanJobRecord {
  id: string;
  organizationId: string;
  targetId: string;
  requesterUserId: string;
  scanMode: ScanMode;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  score: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  workerId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  targetUrl?: string;
  targetHostname?: string;
}

export interface FindingRecord {
  id: string;
  scanId: string;
  targetId: string;
  organizationId: string;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: string;
  category: string;
  resourceEndpoint: string;
  evidenceJson: Record<string, unknown>;
  status: string;
  acceptedRiskReason?: string | null;
  cweId?: string | null;
  owaspCategory?: string | null;
  createdAt: Date;
}

/**
 * Deterministic Security Scoring Formula:
 * Starts at 100.
 * Deducts points strictly by verified finding severity:
 * - CRITICAL: -25 points
 * - HIGH:     -15 points
 * - MEDIUM:   -5 points
 * - LOW:      -2 points
 * - INFORMATIONAL: -0 points
 * Clamped between [0, 100].
 */
export function calculateSecurityScore(findings: Array<{ severity: Severity }>): number {
  let score = 100;

  for (const f of findings) {
    switch (f.severity) {
      case 'CRITICAL':
        score -= 25;
        break;
      case 'HIGH':
        score -= 15;
        break;
      case 'MEDIUM':
        score -= 5;
        break;
      case 'LOW':
        score -= 2;
        break;
      case 'INFORMATIONAL':
        break;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Create a new scan job entry.
 * Fails closed if scanMode is VERIFIED_ACTIVE and target is unverified.
 */
export async function createScanJob(params: {
  organizationId: string;
  targetId: string;
  requesterUserId: string;
  scanMode?: ScanMode;
}): Promise<ScanJobRecord> {
  const scanMode = params.scanMode ?? 'PUBLIC_PASSIVE';

  // 1. Enforce authorization gate: unverified targets CANNOT undergo active scans
  await assertTargetScanAuthorization(params.targetId, params.organizationId, scanMode);

  // 2. Insert into scan_jobs
  const res = await query<ScanJobRecord>(
    `
    INSERT INTO scan_jobs (
      organization_id,
      target_id,
      requester_user_id,
      scan_mode,
      status
    )
    VALUES ($1, $2, $3, $4, 'QUEUED')
    RETURNING
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      requester_user_id as "requesterUserId",
      scan_mode as "scanMode",
      status,
      score,
      started_at as "startedAt",
      completed_at as "completedAt",
      worker_id as "workerId",
      error_message as "errorMessage",
      created_at as "createdAt"
    `,
    [params.organizationId, params.targetId, params.requesterUserId, scanMode]
  );

  const scanJob = res.rows[0]!;

  // 3. Record audit event
  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.requesterUserId,
    action: 'SCAN_CREATED',
    resourceType: 'scan_job',
    resourceId: scanJob.id,
    metadata: {
      targetId: params.targetId,
      scanMode,
    },
  });

  return scanJob;
}

/**
 * Execute a scan job deterministically.
 * Runs check modules, redacts evidence synchronously, calculates score, and updates DB.
 */
export async function executeScanJob(scanJobId: string): Promise<{
  scanJob: ScanJobRecord;
  findings: FindingRecord[];
}> {
  // 1. Fetch scan job details
  const jobRes = await query<ScanJobRecord>(
    `
    SELECT
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      requester_user_id as "requesterUserId",
      scan_mode as "scanMode",
      status,
      score,
      started_at as "startedAt",
      completed_at as "completedAt",
      worker_id as "workerId",
      error_message as "errorMessage",
      created_at as "createdAt"
    FROM scan_jobs
    WHERE id = $1
    `,
    [scanJobId]
  );

  const job = jobRes.rows[0];
  if (!job) {
    throw new Error(`Scan job "${scanJobId}" not found`);
  }

  // 2. Fetch target
  const target = await getTargetById(job.targetId, job.organizationId);

  // Re-verify authorization gate
  await assertTargetScanAuthorization(target.id, job.organizationId, job.scanMode);

  // 3. Transition status to RUNNING
  await query("UPDATE scan_jobs SET status = 'RUNNING', started_at = NOW() WHERE id = $1", [job.id]);

  const rawFindings: RawFinding[] = [];

  try {
    // 4. Map Attack Surface & Detect Technologies
    let discoveredEndpoints: any[] = [];
    try {
      const surfaceResult = await crawlAttackSurface(target.targetUrl, {
        maxDepth: 2,
        maxPages: 15,
        scanId: job.id,
      });

      if (surfaceResult.endpoints.length > 0) {
        discoveredEndpoints = surfaceResult.endpoints;
        await upsertDiscoveredEndpoints(
          job.organizationId,
          target.id,
          job.id,
          surfaceResult.endpoints
        );
      }

      if (surfaceResult.technologies.length > 0) {
        await upsertTechnologyFingerprints(
          job.organizationId,
          target.id,
          job.id,
          surfaceResult.technologies
        );
      }
    } catch (crawlErr) {
      console.warn('[ZERIVEX SCANNER] Attack surface crawl encountered a non-fatal error:', crawlErr);
    }

    const scanContext: ScanContext = {
      targetUrl: target.targetUrl,
      hostname: target.hostname,
      scanMode: job.scanMode,
      organizationId: job.organizationId,
      targetId: target.id,
      discoveredEndpoints,
    };

    // 5. Run all registered check modules with fault tolerance
    const results = await Promise.allSettled(
      ALL_SCAN_CHECKS.map(async (check) => {
        if (check.requiresActiveScan && job.scanMode !== 'VERIFIED_ACTIVE') {
          return [];
        }
        return check.run(scanContext);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        rawFindings.push(...result.value);
      } else {
        console.error(`[ZERIVEX SCANNER ERROR] Module execution failed:`, result.reason);
      }
    }

    // 5. Calculate deterministic security score
    const score = calculateSecurityScore(rawFindings);

    // 6. Persist findings with synchronous evidence redaction
    const savedFindings: FindingRecord[] = [];

    for (const rf of rawFindings) {
      const redactedEvidence = redactEvidence(rf.evidence);

      const fRes = await query<FindingRecord>(
        `
        INSERT INTO findings (
          scan_id,
          target_id,
          organization_id,
          rule_id,
          title,
          severity,
          confidence,
          category,
          resource_endpoint,
          evidence_json,
          status,
          cwe_id,
          owasp_category
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN', $11, $12)
        RETURNING
          id,
          scan_id as "scanId",
          target_id as "targetId",
          organization_id as "organizationId",
          rule_id as "ruleId",
          title,
          severity,
          confidence,
          category,
          resource_endpoint as "resourceEndpoint",
          evidence_json as "evidenceJson",
          status,
          accepted_risk_reason as "acceptedRiskReason",
          cwe_id as "cweId",
          owasp_category as "owaspCategory",
          created_at as "createdAt"
        `,
        [
          job.id,
          target.id,
          job.organizationId,
          rf.ruleId,
          rf.title,
          rf.severity,
          rf.confidence,
          rf.category,
          rf.resourceEndpoint,
          JSON.stringify(redactedEvidence),
          rf.cweId ?? null,
          rf.owaspCategory ?? null,
        ]
      );

      savedFindings.push(fRes.rows[0]!);
    }

    // 7. Update scan job status to COMPLETED
    const updatedJobRes = await query<ScanJobRecord>(
      `
      UPDATE scan_jobs
      SET
        status = 'COMPLETED',
        score = $1,
        completed_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        organization_id as "organizationId",
        target_id as "targetId",
        requester_user_id as "requesterUserId",
        scan_mode as "scanMode",
        status,
        score,
        started_at as "startedAt",
        completed_at as "completedAt",
        worker_id as "workerId",
        error_message as "errorMessage",
        created_at as "createdAt"
      `,
      [score, job.id]
    );

    const completedJob = updatedJobRes.rows[0]!;

    // 8. Trigger security regression evaluation
    try {
      await evaluateScanRegression(completedJob.id);
    } catch (regErr) {
      console.warn(`[ZERIVEX MONITORING] Regression evaluation failed for scan ${completedJob.id}:`, (regErr as Error).message);
    }

    // 9. Dispatch outbound webhooks
    try {
      await dispatchWebhookEvent({
        organizationId: completedJob.organizationId,
        eventType: 'scan.completed',
        data: {
          scanId: completedJob.id,
          targetId: completedJob.targetId,
          hostname: target.hostname,
          score: completedJob.score,
          findingsCount: savedFindings.length,
          criticalCount: savedFindings.filter((f) => f.severity === 'CRITICAL').length,
          highCount: savedFindings.filter((f) => f.severity === 'HIGH').length,
          status: 'COMPLETED',
        },
      });

      const criticalFindings = savedFindings.filter((f) => f.severity === 'CRITICAL');
      if (criticalFindings.length > 0) {
        await dispatchWebhookEvent({
          organizationId: completedJob.organizationId,
          eventType: 'finding.critical',
          data: {
            scanId: completedJob.id,
            targetId: completedJob.targetId,
            hostname: target.hostname,
            criticalCount: criticalFindings.length,
            findings: criticalFindings.map((f) => ({
              ruleId: f.ruleId,
              title: f.title,
              endpoint: f.resourceEndpoint,
            })),
          },
        });
      }
    } catch (whErr) {
      console.warn(`[ZERIVEX WEBHOOKS] Failed to dispatch webhooks for scan ${completedJob.id}:`, (whErr as Error).message);
    }

    return { scanJob: completedJob, findings: savedFindings };
  } catch (err) {
    const errorMsg = (err as Error).message || 'Unknown scanner execution failure';
    await query("UPDATE scan_jobs SET status = 'FAILED', error_message = $1, completed_at = NOW() WHERE id = $2", [
      errorMsg,
      job.id,
    ]);

    try {
      await createMonitoringAlert({
        organizationId: job.organizationId,
        targetId: job.targetId,
        scanId: job.id,
        alertType: 'SCAN_FAILED',
        severity: 'HIGH',
        title: `Scan Execution Failed: ${target.hostname}`,
        message: `Security scan job ${job.id} failed: ${errorMsg}`,
      });
    } catch {
      // Ignore secondary alert logging error
    }

    try {
      await dispatchWebhookEvent({
        organizationId: job.organizationId,
        eventType: 'scan.failed',
        data: {
          scanId: job.id,
          targetId: job.targetId,
          hostname: target.hostname,
          errorMessage: errorMsg,
        },
      });
    } catch {
      // Ignore secondary webhook error
    }

    throw err;
  }
}

export const runScanJob = executeScanJob;

/**
 * Get scan job details and all associated findings with strict tenant isolation.
 */
export async function getScanJobById(
  scanJobId: string,
  organizationId: string
): Promise<{ scanJob: ScanJobRecord; findings: FindingRecord[] }> {
  const jobRes = await query<ScanJobRecord>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.target_id as "targetId",
      s.requester_user_id as "requesterUserId",
      s.scan_mode as "scanMode",
      s.status,
      s.score,
      s.started_at as "startedAt",
      s.completed_at as "completedAt",
      s.worker_id as "workerId",
      s.error_message as "errorMessage",
      s.created_at as "createdAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname"
    FROM scan_jobs s
    JOIN targets t ON t.id = s.target_id
    WHERE s.id = $1 AND s.organization_id = $2
    `,
    [scanJobId, organizationId]
  );

  const scanJob = jobRes.rows[0];
  if (!scanJob) {
    throw new Error('Scan job not found or access denied');
  }

  const findingsRes = await query<FindingRecord>(
    `
    SELECT
      id,
      scan_id as "scanId",
      target_id as "targetId",
      organization_id as "organizationId",
      rule_id as "ruleId",
      title,
      severity,
      confidence,
      category,
      resource_endpoint as "resourceEndpoint",
      evidence_json as "evidenceJson",
      status,
      accepted_risk_reason as "acceptedRiskReason",
      cwe_id as "cweId",
      owasp_category as "owaspCategory",
      created_at as "createdAt"
    FROM findings
    WHERE scan_id = $1 AND organization_id = $2
    ORDER BY 
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END ASC,
      created_at DESC
    `,
    [scanJobId, organizationId]
  );

  return { scanJob, findings: findingsRes.rows };
}

/**
 * List scan jobs for an organization.
 */
export async function listScanJobsForOrg(
  organizationId: string,
  targetId?: string
): Promise<ScanJobRecord[]> {
  const sql = targetId
    ? `
      SELECT
        s.id,
        s.organization_id as "organizationId",
        s.target_id as "targetId",
        s.requester_user_id as "requesterUserId",
        s.scan_mode as "scanMode",
        s.status,
        s.score,
        s.started_at as "startedAt",
        s.completed_at as "completedAt",
        s.worker_id as "workerId",
        s.error_message as "errorMessage",
        s.created_at as "createdAt",
        t.target_url as "targetUrl",
        t.hostname as "targetHostname"
      FROM scan_jobs s
      JOIN targets t ON t.id = s.target_id
      WHERE s.organization_id = $1 AND s.target_id = $2
      ORDER BY s.created_at DESC
    `
    : `
      SELECT
        s.id,
        s.organization_id as "organizationId",
        s.target_id as "targetId",
        s.requester_user_id as "requesterUserId",
        s.scan_mode as "scanMode",
        s.status,
        s.score,
        s.started_at as "startedAt",
        s.completed_at as "completedAt",
        s.worker_id as "workerId",
        s.error_message as "errorMessage",
        s.created_at as "createdAt",
        t.target_url as "targetUrl",
        t.hostname as "targetHostname"
      FROM scan_jobs s
      JOIN targets t ON t.id = s.target_id
      WHERE s.organization_id = $1
      ORDER BY s.created_at DESC
    `;

  const params = targetId ? [organizationId, targetId] : [organizationId];
  const res = await query<ScanJobRecord>(sql, params);
  return res.rows;
}
