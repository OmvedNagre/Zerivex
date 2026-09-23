import { query } from '@/core/db/database';

export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGOUT_ALL'
  | 'AUTH_FAILED_LOGIN'
  | 'OWNER_BOOTSTRAP'
  | 'USER_ROLE_CHANGED'
  | 'USER_SUSPENDED'
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_MEMBER_ADDED'
  | 'TARGET_CREATED'
  | 'TARGET_VERIFIED'
  | 'TARGET_DELETED'
  | 'SCAN_CREATED'
  | 'SCAN_CANCELLED'
  | 'FINDING_STATUS_CHANGED'
  | 'FINDING_ACCEPTED_RISK'
  | 'FINDING_VERIFIED_FIXED'
  | 'FINDING_FIX_FAILED'
  | 'ADMIN_ACCESS'
  | 'SECURITY_POLICY_CHANGED'
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_UPDATED'
  | 'SCHEDULE_DELETED'
  | 'SCHEDULE_TRIGGERED'
  | 'REGRESSION_EVALUATED';

export interface AuditLogEntry {
  id: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Sensitive keys that must be redacted from audit metadata.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'session',
  'key',
  'authorization',
  'cookie',
  'client_secret',
]);

/**
 * Sanitize metadata to prevent secret leakage in audit logs.
 */
function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED_BY_AUDIT_LOG]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Append an immutable audit record to the database.
 * Strictly append-only: this service never modifies or deletes audit logs.
 */
export async function recordAuditEvent(
  params: {
    organizationId?: string | null;
    actorUserId?: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId?: string | null;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
  client?: { query: <R extends import('pg').QueryResultRow = import('pg').QueryResultRow>(text: string, params?: unknown[]) => Promise<import('pg').QueryResult<R>> }
): Promise<AuditLogEntry> {
  const sanitizedMeta = sanitizeMetadata(params.metadata);
  const dbExecutor = client || { query };

  const res = await dbExecutor.query<AuditLogEntry>(
    `
    INSERT INTO audit_logs (
      organization_id,
      actor_user_id,
      action,
      resource_type,
      resource_id,
      reason,
      ip_address,
      user_agent,
      metadata_json
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING 
      id,
      organization_id as "organizationId",
      actor_user_id as "actorUserId",
      action,
      resource_type as "resourceType",
      resource_id as "resourceId",
      reason,
      ip_address as "ipAddress",
      user_agent as "userAgent",
      metadata_json as "metadata",
      created_at as "createdAt"
    `,
    [
      params.organizationId ?? null,
      params.actorUserId ?? null,
      params.action,
      params.resourceType,
      params.resourceId ?? null,
      params.reason ?? null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      JSON.stringify(sanitizedMeta),
    ]
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error('[ZERIVEX AUDIT ERROR] Failed to record audit log entry');
  }

  return row;
}

/**
 * Query audit logs with pagination and mandatory organization isolation.
 */
export async function queryAuditLogs(params: {
  organizationId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = params.offset ?? 0;

  if (params.organizationId) {
    const res = await query<AuditLogEntry>(
      `
      SELECT 
        id,
        organization_id as "organizationId",
        actor_user_id as "actorUserId",
        action,
        resource_type as "resourceType",
        resource_id as "resourceId",
        reason,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        metadata_json as "metadata",
        created_at as "createdAt"
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [params.organizationId, limit, offset]
    );
    return res.rows;
  }

  // System-level query (e.g. for Owner Control Center)
  const res = await query<AuditLogEntry>(
    `
    SELECT 
      id,
      organization_id as "organizationId",
      actor_user_id as "actorUserId",
      action,
      resource_type as "resourceType",
      resource_id as "resourceId",
      reason,
      ip_address as "ipAddress",
      user_agent as "userAgent",
      metadata_json as "metadata",
      created_at as "createdAt"
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
  return res.rows;
}
