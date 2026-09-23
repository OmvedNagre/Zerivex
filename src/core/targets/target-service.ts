import crypto from 'crypto';
import { query } from '@/core/db/database';
import { validateTargetUrl } from '@/core/security/safe-http-client';
import { recordAuditEvent } from '@/core/audit/audit-service';

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REVOKED';
export type VerificationMethod = 'DNS_TXT' | 'HTML_META' | 'HTTP_HEADER';
export type VerificationScope = 'EXACT_HOST' | 'DOMAIN' | 'SUBDOMAIN_WILDCARD' | 'URL_PATH';

export interface Target {
  id: string;
  projectId: string;
  organizationId: string;
  targetUrl: string;
  hostname: string;
  verificationStatus: VerificationStatus;
  verificationToken: string;
  verificationMethod: VerificationMethod;
  verificationScope: VerificationScope;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterTargetParams {
  organizationId: string;
  projectId: string;
  targetUrl: string;
  verificationMethod?: VerificationMethod;
  verificationScope?: VerificationScope;
  actorUserId?: string;
}

/**
 * Register a new web target for security assessment.
 * Performs URL validation, extracts hostname, assigns a 256-bit cryptographically secure token,
 * and initializes in UNVERIFIED state.
 */
export async function registerTarget(params: RegisterTargetParams): Promise<Target> {
  const method = params.verificationMethod ?? 'DNS_TXT';
  const scope = params.verificationScope ?? 'EXACT_HOST';

  // 1. Validate URL & extract hostname (rejects invalid protocols, private hostnames, etc.)
  const parsedUrl = validateTargetUrl(params.targetUrl);
  const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  const hostname = parsedUrl.hostname.toLowerCase();

  // 2. Prevent duplicate target registration within same organization
  const existingRes = await query<{ id: string }>(
    'SELECT id FROM targets WHERE organization_id = $1 AND target_url = $2',
    [params.organizationId, normalizedUrl]
  );

  if (existingRes.rows.length > 0) {
    throw new Error(`Target "${normalizedUrl}" is already registered for this organization`);
  }

  // 3. Generate high-entropy verification token (64 hex characters / 256 bits)
  const token = crypto.randomBytes(32).toString('hex');

  // 4. Insert into database
  const insertRes = await query<Target>(
    `
    INSERT INTO targets (
      organization_id,
      project_id,
      target_url,
      hostname,
      verification_status,
      verification_token,
      verification_method,
      verification_scope
    )
    VALUES ($1, $2, $3, $4, 'UNVERIFIED', $5, $6, $7)
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
    [params.organizationId, params.projectId, normalizedUrl, hostname, token, method, scope]
  );

  const target = insertRes.rows[0];
  if (!target) {
    throw new Error('Failed to create target record');
  }

  // 5. Append audit log
  await recordAuditEvent({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId ?? null,
    action: 'TARGET_CREATED',
    resourceType: 'target',
    resourceId: target.id,
    metadata: {
      targetUrl: normalizedUrl,
      hostname,
      verificationMethod: method,
      verificationScope: scope,
    },
  });

  return target;
}

/**
 * Get target by ID with strict tenant isolation.
 */
export async function getTargetById(targetId: string, organizationId: string): Promise<Target> {
  const res = await query<Target>(
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

  const target = res.rows[0];
  if (!target) {
    throw new Error(`Target not found or access denied for organization`);
  }

  return target;
}

/**
 * List all targets belonging to an organization.
 */
export async function listTargetsForOrg(organizationId: string, projectId?: string): Promise<Target[]> {
  const sql = projectId
    ? `
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
      WHERE organization_id = $1 AND project_id = $2
      ORDER BY created_at DESC
    `
    : `
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
    `;

  const params = projectId ? [organizationId, projectId] : [organizationId];
  const res = await query<Target>(sql, params);
  return res.rows;
}

/**
 * Delete a target within an organization.
 */
export async function deleteTarget(
  targetId: string,
  organizationId: string,
  actorUserId?: string
): Promise<void> {
  const res = await query<{ id: string; target_url: string }>(
    'DELETE FROM targets WHERE id = $1 AND organization_id = $2 RETURNING id, target_url',
    [targetId, organizationId]
  );

  if (res.rows.length === 0) {
    throw new Error('Target not found or access denied');
  }

  await recordAuditEvent({
    organizationId,
    actorUserId: actorUserId ?? null,
    action: 'TARGET_DELETED',
    resourceType: 'target',
    resourceId: targetId,
    metadata: { targetUrl: res.rows[0]?.target_url },
  });
}
