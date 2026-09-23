/**
 * Zerivex Fix Verification Protocol
 * Executes targeted, single-rule security verification re-tests to mathematically
 * confirm whether a reported vulnerability has been remediated by developers.
 */

import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { ALL_SCAN_CHECKS } from '@/core/scanner/scan-runner';
import { ScanCheck, ScanContext, RawFinding } from '@/core/scanner/checks/types';

export interface FixVerificationResult {
  success: boolean;
  fixed: boolean;
  ruleId: string;
  previousStatus: string;
  newStatus: string;
  diagnostic: string;
  remainingEvidence?: Record<string, unknown> | null;
  verifiedAt: string;
}

/**
 * Map rule ID prefix to corresponding check module.
 */
function findCheckModuleForRule(ruleId: string): ScanCheck | null {
  if (ruleId.startsWith('ZX-TLS')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-tls') || null;
  }
  if (ruleId.startsWith('ZX-HDR')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-headers') || null;
  }
  if (ruleId.startsWith('ZX-CORS')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-cors') || null;
  }
  if (ruleId.startsWith('ZX-SEC')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-exposed-secrets') || null;
  }
  if (ruleId.startsWith('ZX-CKI')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-cookies') || null;
  }
  if (ruleId.startsWith('ZX-AI')) {
    return ALL_SCAN_CHECKS.find((c) => c.id === 'check-ai-code-smells') || null;
  }
  return null;
}

/**
 * Execute a targeted re-test for a specific finding.
 * Transitions finding status to FIXED or REOPENED and logs an immutable audit event.
 */
export async function verifyFindingFix(params: {
  findingId: string;
  organizationId: string;
  userId: string;
}): Promise<FixVerificationResult> {
  const { findingId, organizationId, userId } = params;

  // 1. Fetch finding and target
  const findingRes = await query<{
    id: string;
    ruleId: string;
    title: string;
    status: string;
    resourceEndpoint: string;
    targetId: string;
    targetUrl: string;
    hostname: string;
  }>(
    `
    SELECT
      f.id,
      f.rule_id as "ruleId",
      f.title,
      f.status,
      f.resource_endpoint as "resourceEndpoint",
      f.target_id as "targetId",
      t.target_url as "targetUrl",
      t.hostname
    FROM findings f
    JOIN targets t ON t.id = f.target_id
    WHERE f.id = $1 AND f.organization_id = $2
    `,
    [findingId, organizationId]
  );

  const finding = findingRes.rows[0];
  if (!finding) {
    throw new Error(`Finding "${findingId}" not found or unauthorized`);
  }

  // 2. Identify check module
  const check = findCheckModuleForRule(finding.ruleId);
  if (!check) {
    throw new Error(`No verification module available for rule "${finding.ruleId}"`);
  }

  // 3. Execute targeted re-test
  const scanContext: ScanContext = {
    targetUrl: finding.targetUrl,
    hostname: finding.hostname,
    scanMode: 'PUBLIC_PASSIVE',
    organizationId,
    targetId: finding.targetId,
  };

  let checkFindings: RawFinding[] = [];
  try {
    checkFindings = await check.run(scanContext);
  } catch (err) {
    throw new Error(`Fix verification re-test failed to execute: ${(err as Error).message}`);
  }

  // 4. Evaluate whether the exact rule still triggered
  const stillActive = checkFindings.find((rf) => rf.ruleId === finding.ruleId);
  const now = new Date().toISOString();

  if (!stillActive) {
    // RESOLVED: Finding is no longer present
    await query(
      `
      UPDATE findings
      SET status = 'FIXED', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      `,
      [findingId, organizationId]
    );

    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: 'FINDING_VERIFIED_FIXED',
      resourceType: 'finding',
      resourceId: findingId,
      metadata: {
        ruleId: finding.ruleId,
        previousStatus: finding.status,
        newStatus: 'FIXED',
        verifiedAt: now,
      },
    });

    return {
      success: true,
      fixed: true,
      ruleId: finding.ruleId,
      previousStatus: finding.status,
      newStatus: 'FIXED',
      diagnostic: `Verification succeeded: "${finding.title}" (${finding.ruleId}) is no longer detectable on target.`,
      remainingEvidence: null,
      verifiedAt: now,
    };
  } else {
    // STILL ACTIVE: Vulnerability persists
    const newStatus = finding.status === 'FIXED' ? 'REOPENED' : finding.status;
    await query(
      `
      UPDATE findings
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      `,
      [newStatus, findingId, organizationId]
    );

    await recordAuditEvent({
      organizationId,
      actorUserId: userId,
      action: 'FINDING_FIX_FAILED',
      resourceType: 'finding',
      resourceId: findingId,
      metadata: {
        ruleId: finding.ruleId,
        previousStatus: finding.status,
        newStatus,
        activeEvidence: stillActive.evidence,
        retestedAt: now,
      },
    });

    return {
      success: true,
      fixed: false,
      ruleId: finding.ruleId,
      previousStatus: finding.status,
      newStatus,
      diagnostic: `Verification failed: "${finding.title}" (${finding.ruleId}) is still active on the endpoint. Review remediation instructions and try again.`,
      remainingEvidence: stillActive.evidence,
      verifiedAt: now,
    };
  }
}
