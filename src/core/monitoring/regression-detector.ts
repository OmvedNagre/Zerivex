import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { createMonitoringAlert, MonitoringAlertRecord } from './monitoring-repository';
import { FindingRecord, ScanJobRecord } from '@/core/scanner/scan-runner';
import { Severity } from '@/core/scanner/checks/types';

export interface FindingSummary {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  resourceEndpoint: string;
}

export interface RegressionEvaluationResult {
  isBaseline: boolean;
  scanJobId: string;
  targetId: string;
  organizationId: string;
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number;
  newFindings: FindingSummary[];
  resolvedFindings: FindingSummary[];
  generatedAlerts: MonitoringAlertRecord[];
}

/**
 * Evaluate security regressions between current completed scan and immediate previous scan.
 */
export async function evaluateScanRegression(scanJobId: string): Promise<RegressionEvaluationResult> {
  // 1. Fetch current scan job
  const currJobRes = await query<ScanJobRecord>(
    `
    SELECT
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      requester_user_id as "requesterUserId",
      scan_mode as "scanMode",
      status,
      COALESCE(score, 100) as score,
      created_at as "createdAt"
    FROM scan_jobs
    WHERE id = $1
    `,
    [scanJobId]
  );

  const currentJob = currJobRes.rows[0];
  if (!currentJob) {
    throw new Error(`Scan job "${scanJobId}" not found for regression evaluation`);
  }

  const currentScore = Number(currentJob.score ?? 100);

  // 2. Fetch current findings
  const currFindingsRes = await query<FindingRecord>(
    `
    SELECT
      id,
      rule_id as "ruleId",
      title,
      severity,
      resource_endpoint as "resourceEndpoint"
    FROM findings
    WHERE scan_id = $1
    `,
    [scanJobId]
  );
  const currentFindings = currFindingsRes.rows;

  // 3. Find immediate previous COMPLETED scan for this target
  const prevJobRes = await query<ScanJobRecord>(
    `
    SELECT
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      status,
      COALESCE(score, 100) as score,
      created_at as "createdAt"
    FROM scan_jobs
    WHERE target_id = $1
      AND organization_id = $2
      AND status = 'COMPLETED'
      AND id != $3
      AND created_at < $4
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [currentJob.targetId, currentJob.organizationId, currentJob.id, currentJob.createdAt]
  );

  const previousJob = prevJobRes.rows[0];
  const generatedAlerts: MonitoringAlertRecord[] = [];

  // Helper fingerprint: ruleId + resourceEndpoint
  const makeKey = (ruleId: string, endpoint: string) => `${ruleId}::${endpoint}`;

  if (!previousJob) {
    // Initial baseline scan for this target
    // If critical findings exist on initial scan, create an alert
    const criticals = currentFindings.filter((f) => f.severity === 'CRITICAL');
    for (const crit of criticals) {
      const alert = await createMonitoringAlert({
        organizationId: currentJob.organizationId,
        targetId: currentJob.targetId,
        scanId: currentJob.id,
        alertType: 'NEW_CRITICAL_FINDING',
        severity: 'CRITICAL',
        title: `Baseline Critical Security Finding: ${crit.title}`,
        message: `Initial baseline scan detected a critical vulnerability at ${crit.resourceEndpoint} (${crit.ruleId}). Immediate remediation required.`,
        metadata: {
          ruleId: crit.ruleId,
          resourceEndpoint: crit.resourceEndpoint,
          findingId: crit.id,
        },
      });
      generatedAlerts.push(alert);
    }

    return {
      isBaseline: true,
      scanJobId: currentJob.id,
      targetId: currentJob.targetId,
      organizationId: currentJob.organizationId,
      currentScore,
      previousScore: null,
      scoreDelta: 0,
      newFindings: [],
      resolvedFindings: [],
      generatedAlerts,
    };
  }

  // 4. Fetch previous scan findings
  const prevFindingsRes = await query<FindingRecord>(
    `
    SELECT
      id,
      rule_id as "ruleId",
      title,
      severity,
      resource_endpoint as "resourceEndpoint"
    FROM findings
    WHERE scan_id = $1
    `,
    [previousJob.id]
  );
  const previousFindings = prevFindingsRes.rows;

  const previousScore = Number(previousJob.score ?? 100);
  const scoreDelta = currentScore - previousScore;

  // Set of previous finding keys
  const prevKeys = new Set(previousFindings.map((f) => makeKey(f.ruleId, f.resourceEndpoint)));
  const currKeys = new Set(currentFindings.map((f) => makeKey(f.ruleId, f.resourceEndpoint)));

  // Identify new findings
  const newFindings = currentFindings.filter((f) => !prevKeys.has(makeKey(f.ruleId, f.resourceEndpoint)));

  // Identify resolved findings
  const resolvedFindings = previousFindings.filter((f) => !currKeys.has(makeKey(f.ruleId, f.resourceEndpoint)));

  // 5. Evaluate regression criteria & trigger alerts

  // A. Score Drop Alert (degradation of >= 10 points)
  if (scoreDelta <= -10) {
    const alert = await createMonitoringAlert({
      organizationId: currentJob.organizationId,
      targetId: currentJob.targetId,
      scanId: currentJob.id,
      alertType: 'SECURITY_SCORE_DROP',
      severity: scoreDelta <= -25 ? 'CRITICAL' : 'HIGH',
      title: `Security Score Regression: Drop of ${Math.abs(scoreDelta)} Points`,
      message: `Target security posture degraded from score ${previousScore} to ${currentScore} (Δ ${scoreDelta}). ${newFindings.length} new finding(s) introduced.`,
      metadata: {
        previousScore,
        currentScore,
        scoreDelta,
        previousScanId: previousJob.id,
        currentScanId: currentJob.id,
      },
    });
    generatedAlerts.push(alert);
  }

  // B. New Critical / High Vulnerability Alerts
  for (const nf of newFindings) {
    if (nf.severity === 'CRITICAL' || nf.severity === 'HIGH') {
      const alert = await createMonitoringAlert({
        organizationId: currentJob.organizationId,
        targetId: currentJob.targetId,
        scanId: currentJob.id,
        alertType: 'NEW_CRITICAL_FINDING',
        severity: nf.severity,
        title: `New ${nf.severity} Vulnerability Introduced: ${nf.title}`,
        message: `A new ${nf.severity} security vulnerability was discovered at ${nf.resourceEndpoint} (${nf.ruleId}) which was not present in the previous scan.`,
        metadata: {
          ruleId: nf.ruleId,
          resourceEndpoint: nf.resourceEndpoint,
          findingId: nf.id,
          previousScanId: previousJob.id,
          currentScanId: currentJob.id,
        },
      });
      generatedAlerts.push(alert);
    }
  }

  // 6. Record audit event for regression evaluation
  await recordAuditEvent({
    organizationId: currentJob.organizationId,
    actorUserId: currentJob.requesterUserId,
    action: 'REGRESSION_EVALUATED',
    resourceType: 'target',
    resourceId: currentJob.targetId,
    metadata: {
      scanJobId: currentJob.id,
      scoreDelta,
      newFindingsCount: newFindings.length,
      resolvedFindingsCount: resolvedFindings.length,
      alertsCount: generatedAlerts.length,
    },
  });

  return {
    isBaseline: false,
    scanJobId: currentJob.id,
    targetId: currentJob.targetId,
    organizationId: currentJob.organizationId,
    currentScore,
    previousScore,
    scoreDelta,
    newFindings,
    resolvedFindings,
    generatedAlerts,
  };
}
