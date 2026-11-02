import { consumeScanCredit } from '@/core/credits/credit-service';
import { randomUUID } from 'node:crypto';
import { resolveEntitlements, resolveEntitlementsFromPlan } from '@/core/billing/entitlement-service';
import { getCurrentMonthWindow } from '@/core/billing/subscription-repository';
import { SessionContext } from '@/core/auth/session-service';
import { AssessmentIncompleteError, runAssessment, withinAssessmentScope } from '@/core/security/assessment-context';
import { defaultWorkerPool } from './worker-pool';
import { query, withTransaction } from '@/core/db/database';
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

export const SCAN_WORKER_ID = randomUUID();

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
  executionPlanId?: string;
  checkResults?: CheckResult[];
  targetUrl?: string;
  targetHostname?: string;
}

export interface CheckResult {
  checkId: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  reason?: string;
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
  session?: SessionContext;
}): Promise<ScanJobRecord> {
  const scanMode = params.scanMode ?? 'PUBLIC_PASSIVE';
  if (!['PUBLIC_PASSIVE', 'VERIFIED_ACTIVE'].includes(scanMode)) throw new Error('Invalid scan mode');
  const entitlements = await resolveEntitlements(params.organizationId, params.session);
  if (scanMode === 'VERIFIED_ACTIVE' && !entitlements.features.activeVerifiedTests) {
    throw Object.assign(new Error('Active scanning requires an upgraded plan'), { statusCode: 403 });
  }


  // 1. Enforce authorization gate: unverified targets CANNOT undergo active scans
  await assertTargetScanAuthorization(params.targetId, params.organizationId, scanMode);

  // 2. Insert into scan_jobs
  const res = await withTransaction(async (client) => {
    const access = await client.query(`SELECT 1 FROM organizations o
      JOIN memberships m ON m.organization_id = o.id
      JOIN users u ON u.id = m.user_id AND u.status = 'ACTIVE'
      WHERE o.id = $1 AND m.user_id = $2 AND (u.role = 'OWNER' OR m.role IN ('ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER')) AND o.suspended_at IS NULL FOR SHARE OF o, m, u`,
      [params.organizationId, params.requesterUserId]);
    if (!access.rows.length) throw Object.assign(new Error('Organization unavailable or membership revoked'), { statusCode: 403 });
    const { start, end } = getCurrentMonthWindow();
    const usage = await client.query(`INSERT INTO usage_ledgers
      (organization_id, metric, period_start, period_end, value)
      VALUES ($1, 'MONTHLY_SCANS', $2, $3, 1)
      ON CONFLICT (organization_id, metric, period_start) DO UPDATE
      SET value = usage_ledgers.value + 1, updated_at = NOW()
      WHERE usage_ledgers.value < $4 RETURNING value`,
      [params.organizationId, start, end, entitlements.limits.maxMonthlyScans]);
    const needsCredit = usage.rows.length === 0;
    const created = await client.query<ScanJobRecord>(
    `
    INSERT INTO scan_jobs (
      organization_id,
      target_id,
      requester_user_id,
      scan_mode,
      execution_plan_id,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'QUEUED')
    RETURNING
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      requester_user_id as "requesterUserId",
      execution_plan_id as "executionPlanId",
      check_results as "checkResults",
      scan_mode as "scanMode",
      status,
      score,
      started_at as "startedAt",
      completed_at as "completedAt",
      worker_id as "workerId",
      error_message as "errorMessage",
      created_at as "createdAt"
    `,
    [params.organizationId, params.targetId, params.requesterUserId, scanMode, entitlements.planId]
    );
    if (needsCredit) await consumeScanCredit(client, params.organizationId, params.requesterUserId, created.rows[0]!.id);
    return created;
  });

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
async function performScanJob(scanJobId: string, signal?: AbortSignal): Promise<{
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
      execution_plan_id as "executionPlanId",
      check_results as "checkResults",
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

  // A compare-and-set claim prevents both HTTP and background workers executing a job twice.
  const claim = await query(`UPDATE scan_jobs SET status = 'RUNNING', started_at = NOW(), heartbeat_at = NOW(), worker_id = $2
    WHERE id = $1 AND status = 'QUEUED' RETURNING id`, [job.id, SCAN_WORKER_ID]);
  if (!claim.rows.length) throw new Error('Scan job has already been claimed or completed');
  const rawFindings: RawFinding[] = [];
  let target: Awaited<ReturnType<typeof getTargetById>> | undefined;
  try {
    target = await assertTargetScanAuthorization(job.targetId, job.organizationId, job.scanMode);
    const access = await query(`SELECT 1 FROM organizations o JOIN memberships m ON m.organization_id = o.id
      JOIN users u ON u.id = m.user_id AND u.status = 'ACTIVE'
      WHERE o.id = $1 AND m.user_id = $2 AND (u.role = 'OWNER' OR m.role IN ('ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER')) AND o.suspended_at IS NULL`, [job.organizationId, job.requesterUserId]);
    if (!access.rows.length) throw new Error('Scan authorization revoked');
    const entitlements = resolveEntitlementsFromPlan(job.executionPlanId || 'STARTER');
    const scope = { targetUrl: target.targetUrl, pathOnly: target.verificationScope === 'URL_PATH', signal };
    // 4. Map Attack Surface & Detect Technologies
    let discoveredEndpoints: any[] = [];
    try {
      if (entitlements.limits.crawl.enabled) {
      const surfaceResult = await withinAssessmentScope(scope, () => crawlAttackSurface(scope.targetUrl, {
        maxDepth: entitlements.limits.crawl.maxDepth,
        maxPages: entitlements.limits.crawl.maxPages,
        scanId: job.id,
      }));

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

    const checkResults: CheckResult[] = [];
    const results = await Promise.all(ALL_SCAN_CHECKS.map(async (check) => {
      if (!entitlements.engineIds.includes(check.id) || (check.requiresActiveScan && job.scanMode !== 'VERIFIED_ACTIVE')) {
        return { checkId: check.id, status: 'SKIPPED' as const, findings: [] as RawFinding[] };
      }
      try {
        const findings = await runAssessment(scope, async () => {
          const urls = check.requiresActiveScan ? Array.from(new Set([scanContext.targetUrl,
            ...discoveredEndpoints.filter((endpoint) => endpoint.httpMethod === 'GET' && endpoint.parameters?.length)
              .slice(0, 9).map((endpoint) => endpoint.url as string)])) : [scanContext.targetUrl];
          const observations: RawFinding[] = [];
          for (const targetUrl of urls) {
            signal?.throwIfAborted();
            observations.push(...await check.run({ ...scanContext, targetUrl }));
          }
          return observations;
        });
        return { checkId: check.id, status: 'PASSED' as const, findings };
      } catch (error) {
        return { checkId: check.id, status: 'FAILED' as const, findings: error instanceof AssessmentIncompleteError ? error.partialFindings as RawFinding[] : [], reason: 'Check could not be completed' };
      }
    }));
    for (const { findings, ...result } of results) {
      rawFindings.push(...findings);
      checkResults.push(result);
    }
    await query('UPDATE scan_jobs SET check_results = $2::jsonb WHERE id = $1', [job.id, JSON.stringify(checkResults)]);
    signal?.throwIfAborted();
    const failed = checkResults.filter((r) => r.status === 'FAILED');
    const score = calculateSecurityScore(rawFindings);

    // 6. Persist findings with synchronous evidence redaction
    const savedFindings: FindingRecord[] = [];

    for (const rf of rawFindings) {
      signal?.throwIfAborted();
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

    if (failed.length) throw new Error(`Scan incomplete: ${failed.map((r) => r.checkId).join(', ')}`);
    signal?.throwIfAborted();
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
        execution_plan_id as "executionPlanId",
      check_results as "checkResults",
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
    await query("UPDATE scan_jobs SET status = 'FAILED', score = NULL, error_message = $1, completed_at = NOW() WHERE id = $2", [
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
        title: `Scan Execution Failed: ${target?.hostname || 'unknown'}`,
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
          hostname: target?.hostname || 'unknown',
          errorMessage: errorMsg,
        },
      });
    } catch {
      // Ignore secondary webhook error
    }

    throw err;
  }
}

export async function executeScanJob(scanJobId: string) {
  const record = await query<{ targetId: string; organizationId: string; hostname: string }>(
    `SELECT s.target_id as "targetId", s.organization_id as "organizationId", t.hostname
     FROM scan_jobs s JOIN targets t ON t.id = s.target_id WHERE s.id = $1`, [scanJobId]);
  const job = record.rows[0];
  if (!job) throw new Error('Scan job not found');
  return defaultWorkerPool.submitJob({ id: scanJobId, targetId: job.targetId,
    organizationId: job.organizationId, domain: job.hostname,
    execute: (signal) => performScanJob(scanJobId, signal) });
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
      s.execution_plan_id as "executionPlanId",
      s.check_results as "checkResults",
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
        s.execution_plan_id as "executionPlanId",
        s.check_results as "checkResults",
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
        s.execution_plan_id as "executionPlanId",
        s.check_results as "checkResults",
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
