import crypto from 'crypto';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export interface TargetEntity {
  id: string;
  projectId: string;
  organizationId: string;
  targetUrl: string;
  hostname: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REVOKED';
  verificationToken: string;
  verificationMethod: 'DNS_TXT' | 'HTML_META' | 'HTTP_HEADER';
  verificationScope: 'EXACT_HOST' | 'DOMAIN' | 'SUBDOMAIN_WILDCARD' | 'URL_PATH';
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScanJobEntity {
  id: string;
  organizationId: string;
  targetId: string;
  requesterUserId: string;
  scanMode: 'PUBLIC_PASSIVE' | 'VERIFIED_ACTIVE';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  score: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  workerId: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface FindingEntity {
  id: string;
  scanId: string;
  targetId: string;
  organizationId: string;
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  confidence: 'CONFIRMED' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  resourceEndpoint: string;
  evidenceJson: Record<string, unknown>;
  status: 'OPEN' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'FIXED' | 'REOPENED';
  acceptedRiskReason: string | null;
  cweId: string | null;
  owaspCategory: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant-scoped Target Management.
 * Guarantees Organization A cannot read or modify Organization B targets.
 */
export async function createTenantTarget(params: {
  organizationId: string;
  projectId: string;
  targetUrl: string;
  verificationScope?: 'EXACT_HOST' | 'DOMAIN' | 'SUBDOMAIN_WILDCARD' | 'URL_PATH';
  actorUserId: string;
}): Promise<TargetEntity> {
  const urlObj = new URL(params.targetUrl);
  const hostname = urlObj.hostname;
  const verificationToken = `zerivex-verify-${crypto.randomBytes(16).toString('hex')}`;
  const scope = params.verificationScope ?? 'EXACT_HOST';

  const res = await query<TargetEntity>(
    `
    INSERT INTO targets (
      organization_id,
      project_id,
      target_url,
      hostname,
      verification_status,
      verification_token,
      verification_scope
    )
    VALUES ($1, $2, $3, $4, 'UNVERIFIED', $5, $6)
    RETURNING
      id,
      project_id as "projectId",
      organization_id as "organizationId",
      target_url as "targetUrl",
      hostname,
      verification_status as "verificationStatus",
      verification_token as "verificationToken",
      verification_method as "verificationMethod",
      verification_scope as "verificationScope",
      verified_at as "verifiedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    [params.organizationId, params.projectId, params.targetUrl, hostname, verificationToken, scope]
  );

  const target = res.rows[0]!;

  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: 'TARGET_CREATED',
    resourceType: 'target',
    resourceId: target.id,
    metadata: { targetUrl: target.targetUrl, hostname: target.hostname, scope: target.verificationScope },
  });

  return target;
}

/**
 * Retrieve target strictly within tenant boundary.
 * Returns null if target does not belong to the authenticated organization.
 */
export async function getTenantTargetById(
  targetId: string,
  organizationId: string
): Promise<TargetEntity | null> {
  const res = await query<TargetEntity>(
    `
    SELECT
      id,
      project_id as "projectId",
      organization_id as "organizationId",
      target_url as "targetUrl",
      hostname,
      verification_status as "verificationStatus",
      verification_token as "verificationToken",
      verification_method as "verificationMethod",
      verification_scope as "verificationScope",
      verified_at as "verifiedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM targets
    WHERE id = $1 AND organization_id = $2
    `,
    [targetId, organizationId]
  );

  return res.rows[0] ?? null;
}

/**
 * List targets strictly within organization.
 */
export async function listTenantTargets(
  organizationId: string,
  limit = 50,
  offset = 0
): Promise<TargetEntity[]> {
  const res = await query<TargetEntity>(
    `
    SELECT
      id,
      project_id as "projectId",
      organization_id as "organizationId",
      target_url as "targetUrl",
      hostname,
      verification_status as "verificationStatus",
      verification_token as "verificationToken",
      verification_method as "verificationMethod",
      verification_scope as "verificationScope",
      verified_at as "verifiedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM targets
    WHERE organization_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [organizationId, Math.min(limit, 100), offset]
  );

  return res.rows;
}

/**
 * Create a scan job strictly within tenant boundary.
 */
export async function createTenantScanJob(params: {
  organizationId: string;
  targetId: string;
  requesterUserId: string;
  scanMode: 'PUBLIC_PASSIVE' | 'VERIFIED_ACTIVE';
}): Promise<ScanJobEntity> {
  // First verify target belongs to organization
  const target = await getTenantTargetById(params.targetId, params.organizationId);
  if (!target) {
    throw new Error('[ZERIVEX AUTH ERROR] Target not found in organization');
  }

  // Active scan requires verified target ownership
  if (params.scanMode === 'VERIFIED_ACTIVE' && target.verificationStatus !== 'VERIFIED') {
    throw new Error('[ZERIVEX SECURITY ERROR] Active scanning requires verified target ownership');
  }

  const res = await query<ScanJobEntity>(
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
    [params.organizationId, params.targetId, params.requesterUserId, params.scanMode]
  );

  const job = res.rows[0]!;

  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.requesterUserId,
    action: 'SCAN_CREATED',
    resourceType: 'scan_job',
    resourceId: job.id,
    metadata: { targetId: params.targetId, scanMode: params.scanMode },
  });

  return job;
}

/**
 * Retrieve scan job strictly scoped by organization ID.
 */
export async function getTenantScanJobById(
  scanId: string,
  organizationId: string
): Promise<ScanJobEntity | null> {
  const res = await query<ScanJobEntity>(
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
    WHERE id = $1 AND organization_id = $2
    `,
    [scanId, organizationId]
  );

  return res.rows[0] ?? null;
}

/**
 * Update finding status (e.g. mark as Accepted Risk) with tenant check & mandatory reason auditing.
 */
export async function updateTenantFindingStatus(params: {
  findingId: string;
  organizationId: string;
  status: 'OPEN' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'FIXED' | 'REOPENED';
  reason?: string;
  actorUserId: string;
}): Promise<FindingEntity> {
  if (params.status === 'ACCEPTED_RISK' && (!params.reason || params.reason.trim().length < 5)) {
    throw new Error('[ZERIVEX AUDIT ERROR] Accepted Risk status requires an explicit, audited reason');
  }

  return withTransaction(async (client) => {
    const res = await client.query<FindingEntity>(
      `
      UPDATE findings
      SET
        status = $1,
        accepted_risk_reason = $2,
        updated_at = NOW()
      WHERE id = $3 AND organization_id = $4
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
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [params.status, params.reason ?? null, params.findingId, params.organizationId]
    );

    const finding = res.rows[0];
    if (!finding) {
      throw new Error('[ZERIVEX AUTH ERROR] Finding not found in organization');
    }

    await recordAuditEvent({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: params.status === 'ACCEPTED_RISK' ? 'FINDING_ACCEPTED_RISK' : 'FINDING_STATUS_CHANGED',
      resourceType: 'finding',
      resourceId: finding.id,
      reason: params.reason,
      metadata: { newStatus: params.status, ruleId: finding.ruleId },
    });

    return finding;
  });
}
