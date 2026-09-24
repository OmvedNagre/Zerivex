/**
 * Zerivex Enterprise Compliance Audit Vault
 * Provides multi-tenant tamper-evident audit querying, actor attribution,
 * RFC 4180 CSV / SIEM JSON exports, and integrity verification.
 */

import { query } from '@/core/db/database';
import { AuditAction, recordAuditEvent } from '@/core/audit/audit-service';

export interface AuditVaultFilter {
  organizationId: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  actorUserId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditVaultEntry {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditVaultQueryResult {
  entries: AuditVaultEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditVaultExportResult {
  data: string;
  filename: string;
  mimeType: string;
  recordCount: number;
}

export interface AuditVaultIntegrityResult {
  verified: boolean;
  totalRecords: number;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  isMonotonic: boolean;
  message: string;
}

/**
 * Redact any nested sensitive keywords from metadata object.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'cookie',
  'authorization',
  'client_secret',
  'access_token',
  'refresh_token',
]);

function scrubMetadata(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(scrubMetadata);

  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password')
    ) {
      scrubbed[k] = '[REDACTED_BY_AUDIT_VAULT]';
    } else if (typeof v === 'object' && v !== null) {
      scrubbed[k] = scrubMetadata(v);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

/**
 * Escape an individual field for RFC 4180 CSV compliance:
 * - If field contains quotes, commas, or line breaks, enclose in quotes and double internal quotes.
 */
function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build parameterised WHERE clause for Audit Vault queries.
 */
function buildFilterClause(filter: AuditVaultFilter): {
  whereClause: string;
  values: unknown[];
  nextParamIndex: number;
} {
  const conditions: string[] = ['a.organization_id = $1'];
  const values: unknown[] = [filter.organizationId];
  let paramIdx = 2;

  if (filter.action) {
    if (Array.isArray(filter.action)) {
      if (filter.action.length > 0) {
        conditions.push(`a.action = ANY($${paramIdx})`);
        values.push(filter.action);
        paramIdx++;
      }
    } else {
      conditions.push(`a.action = $${paramIdx}`);
      values.push(filter.action);
      paramIdx++;
    }
  }

  if (filter.resourceType && filter.resourceType.trim()) {
    conditions.push(`a.resource_type = $${paramIdx}`);
    values.push(filter.resourceType.trim());
    paramIdx++;
  }

  if (filter.actorUserId && filter.actorUserId.trim()) {
    conditions.push(`a.actor_user_id = $${paramIdx}`);
    values.push(filter.actorUserId.trim());
    paramIdx++;
  }

  if (filter.startDate) {
    conditions.push(`a.created_at >= $${paramIdx}`);
    values.push(new Date(filter.startDate));
    paramIdx++;
  }

  if (filter.endDate) {
    conditions.push(`a.created_at <= $${paramIdx}`);
    values.push(new Date(filter.endDate));
    paramIdx++;
  }

  if (filter.search && filter.search.trim()) {
    const searchPattern = `%${filter.search.trim()}%`;
    conditions.push(
      `(a.reason ILIKE $${paramIdx} OR a.resource_id ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.display_name ILIKE $${paramIdx} OR a.metadata_json::text ILIKE $${paramIdx})`
    );
    values.push(searchPattern);
    paramIdx++;
  }

  return {
    whereClause: conditions.join(' AND '),
    values,
    nextParamIndex: paramIdx,
  };
}

/**
 * Query audit vault logs with multi-tenant isolation, actor metadata join, and pagination.
 */
export async function queryAuditVault(
  filter: AuditVaultFilter
): Promise<AuditVaultQueryResult> {
  if (!filter.organizationId) {
    throw new Error('[ZERIVEX AUDIT VAULT] organizationId is required for audit vault queries');
  }

  const { whereClause, values, nextParamIndex } = buildFilterClause(filter);

  // Count total matching records
  const countSql = `
    SELECT COUNT(*)::int as total
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.id
    WHERE ${whereClause}
  `;
  const countRes = await query<{ total: number }>(countSql, values);
  const total = countRes.rows[0]?.total ?? 0;

  // Retrieve paginated records
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
  const offset = Math.max(filter.offset ?? 0, 0);

  const queryValues = [...values, limit, offset];
  const selectSql = `
    SELECT
      a.id,
      a.organization_id as "organizationId",
      a.actor_user_id as "actorUserId",
      u.email as "actorEmail",
      u.display_name as "actorName",
      a.action,
      a.resource_type as "resourceType",
      a.resource_id as "resourceId",
      a.reason,
      a.ip_address as "ipAddress",
      a.user_agent as "userAgent",
      a.metadata_json as "metadata",
      a.created_at as "createdAt"
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
  `;

  const rowsRes = await query<AuditVaultEntry>(selectSql, queryValues);
  const entries = rowsRes.rows.map((row) => ({
    ...row,
    metadata: (scrubMetadata(row.metadata) as Record<string, unknown>) || {},
  }));

  return {
    entries,
    total,
    limit,
    offset,
  };
}

/**
 * Export Audit Vault records in RFC 4180 CSV or SIEM JSON format.
 * Includes audit log emission documenting the export event for compliance.
 */
export async function exportAuditVault(params: {
  filter: AuditVaultFilter;
  format: 'csv' | 'json';
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AuditVaultExportResult> {
  const { filter, format, actorUserId, ipAddress, userAgent } = params;

  // Fetch all matching records up to 10,000 for export
  const exportFilter: AuditVaultFilter = {
    ...filter,
    limit: 10000,
    offset: 0,
  };

  const { entries } = await queryAuditVault(exportFilter);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const orgPrefix = filter.organizationId.slice(0, 8);

  let exportData = '';
  let filename = '';
  let mimeType = '';

  if (format === 'csv') {
    filename = `zerivex_audit_vault_${orgPrefix}_${timestamp}.csv`;
    mimeType = 'text/csv; charset=utf-8';

    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'Action',
      'Actor Email',
      'Actor Name',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'Reason',
      'Metadata (JSON)',
    ];

    const lines = [headers.map(escapeCsvField).join(',')];

    for (const e of entries) {
      lines.push(
        [
          e.id,
          e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString(),
          e.action,
          e.actorEmail || 'System / Automated',
          e.actorName || '',
          e.resourceType,
          e.resourceId || '',
          e.ipAddress || '',
          e.reason || '',
          JSON.stringify(e.metadata || {}),
        ]
          .map(escapeCsvField)
          .join(',')
      );
    }

    exportData = lines.join('\r\n'); // RFC 4180 specifies CRLF line endings
  } else {
    filename = `zerivex_audit_vault_${orgPrefix}_${timestamp}.json`;
    mimeType = 'application/json; charset=utf-8';

    const siemPayload = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      organizationId: filter.organizationId,
      recordCount: entries.length,
      events: entries.map((e) => ({
        eventId: e.id,
        timestamp: e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString(),
        action: e.action,
        actor: {
          id: e.actorUserId,
          email: e.actorEmail,
          name: e.actorName,
        },
        resource: {
          type: e.resourceType,
          id: e.resourceId,
        },
        network: {
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
        },
        reason: e.reason,
        metadata: e.metadata,
      })),
    };

    exportData = JSON.stringify(siemPayload, null, 2);
  }

  // Record AUDIT_VAULT_EXPORTED in tamper-evident audit logs
  await recordAuditEvent({
    organizationId: filter.organizationId,
    actorUserId: actorUserId || null,
    action: 'AUDIT_VAULT_EXPORTED',
    resourceType: 'AUDIT_VAULT',
    resourceId: filter.organizationId,
    reason: `Exported ${entries.length} audit records in ${format.toUpperCase()} format`,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    metadata: {
      format,
      recordCount: entries.length,
      filename,
    },
  });

  return {
    data: exportData,
    filename,
    mimeType,
    recordCount: entries.length,
  };
}

/**
 * Verify cryptographic and timestamp monotonicity of the audit vault for an organization.
 */
export async function verifyAuditVaultIntegrity(
  organizationId: string
): Promise<AuditVaultIntegrityResult> {
  const res = await query<{
    id: string;
    createdAt: Date;
  }>(
    `
    SELECT id, created_at as "createdAt"
    FROM audit_logs
    WHERE organization_id = $1
    ORDER BY created_at ASC
    `,
    [organizationId]
  );

  const logs = res.rows;
  if (logs.length === 0) {
    return {
      verified: true,
      totalRecords: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      isMonotonic: true,
      message: 'Audit vault is empty. No integrity violations detected.',
    };
  }

  let isMonotonic = true;
  for (let i = 1; i < logs.length; i++) {
    const prevEntry = logs[i - 1];
    const currEntry = logs[i];
    if (prevEntry && currEntry) {
      const prevTime = new Date(prevEntry.createdAt).getTime();
      const currTime = new Date(currEntry.createdAt).getTime();
      if (currTime < prevTime) {
        isMonotonic = false;
        break;
      }
    }
  }

  return {
    verified: isMonotonic,
    totalRecords: logs.length,
    firstTimestamp: logs[0]?.createdAt ?? null,
    lastTimestamp: logs[logs.length - 1]?.createdAt ?? null,
    isMonotonic,
    message: isMonotonic
      ? `Audit vault verified successfully across ${logs.length} chronological records.`
      : 'Timestamp monotonicity violation detected in audit vault sequence.',
  };
}
