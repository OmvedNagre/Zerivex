import { query } from '@/core/db/database';
import { Severity } from '@/core/scanner/checks/types';

export type AlertType =
  | 'NEW_CRITICAL_FINDING'
  | 'SECURITY_SCORE_DROP'
  | 'TARGET_UNVERIFIED_DOWNGRADE'
  | 'SCAN_FAILED'
  | 'CIRCUIT_BREAKER_TRIPPED'
  | 'HIGH_RISK_REGRESSION';

export interface MonitoringAlertRecord {
  id: string;
  organizationId: string;
  targetId: string;
  scanId: string | null;
  alertType: AlertType;
  severity: Severity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  targetUrl?: string;
  targetHostname?: string;
}

export interface TargetSecurityTrend {
  scanId: string;
  createdAt: Date;
  score: number;
  scanMode: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Insert a new security monitoring alert.
 */
export async function createMonitoringAlert(params: {
  organizationId: string;
  targetId: string;
  scanId?: string | null;
  alertType: AlertType;
  severity: Severity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<MonitoringAlertRecord> {
  const res = await query<MonitoringAlertRecord>(
    `
    INSERT INTO monitoring_alerts (
      organization_id,
      target_id,
      scan_id,
      alert_type,
      severity,
      title,
      message,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      organization_id as "organizationId",
      target_id as "targetId",
      scan_id as "scanId",
      alert_type as "alertType",
      severity,
      title,
      message,
      metadata,
      is_read as "isRead",
      created_at as "createdAt"
    `,
    [
      params.organizationId,
      params.targetId,
      params.scanId ?? null,
      params.alertType,
      params.severity,
      params.title,
      params.message,
      JSON.stringify(params.metadata ?? {}),
    ]
  );

  return res.rows[0]!;
}

/**
 * Fetch alerts for an organization with pagination and unread counts.
 */
export async function getOrganizationAlerts(
  organizationId: string,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number }
): Promise<{ alerts: MonitoringAlertRecord[]; total: number; unreadCount: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const unreadOnly = options?.unreadOnly ?? false;

  const countRes = await query<{ total: string; unread: string }>(
    `
    SELECT
      COUNT(*)::text as total,
      COUNT(*) FILTER (WHERE is_read = false)::text as unread
    FROM monitoring_alerts
    WHERE organization_id = $1
    `,
    [organizationId]
  );

  const total = parseInt(countRes.rows[0]?.total ?? '0', 10);
  const unreadCount = parseInt(countRes.rows[0]?.unread ?? '0', 10);

  let whereClause = 'WHERE a.organization_id = $1';
  if (unreadOnly) {
    whereClause += ' AND a.is_read = false';
  }

  const alertsRes = await query<MonitoringAlertRecord>(
    `
    SELECT
      a.id,
      a.organization_id as "organizationId",
      a.target_id as "targetId",
      a.scan_id as "scanId",
      a.alert_type as "alertType",
      a.severity,
      a.title,
      a.message,
      a.metadata,
      a.is_read as "isRead",
      a.created_at as "createdAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname"
    FROM monitoring_alerts a
    JOIN targets t ON t.id = a.target_id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [organizationId, limit, offset]
  );

  return {
    alerts: alertsRes.rows,
    total,
    unreadCount,
  };
}

/**
 * Fetch alerts for a specific target.
 */
export async function getTargetAlerts(
  targetId: string,
  organizationId: string,
  limit = 20
): Promise<MonitoringAlertRecord[]> {
  const res = await query<MonitoringAlertRecord>(
    `
    SELECT
      a.id,
      a.organization_id as "organizationId",
      a.target_id as "targetId",
      a.scan_id as "scanId",
      a.alert_type as "alertType",
      a.severity,
      a.title,
      a.message,
      a.metadata,
      a.is_read as "isRead",
      a.created_at as "createdAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname"
    FROM monitoring_alerts a
    JOIN targets t ON t.id = a.target_id
    WHERE a.target_id = $1 AND a.organization_id = $2
    ORDER BY a.created_at DESC
    LIMIT $3
    `,
    [targetId, organizationId, limit]
  );

  return res.rows;
}

/**
 * Mark a single alert as read under tenant organization.
 */
export async function markAlertAsRead(
  alertId: string,
  organizationId: string
): Promise<boolean> {
  const res = await query(
    `
    UPDATE monitoring_alerts
    SET is_read = true
    WHERE id = $1 AND organization_id = $2
    `,
    [alertId, organizationId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Mark all alerts as read for an organization.
 */
export async function markAllAlertsAsRead(organizationId: string): Promise<number> {
  const res = await query(
    `
    UPDATE monitoring_alerts
    SET is_read = true
    WHERE organization_id = $1 AND is_read = false
    `,
    [organizationId]
  );

  return res.rowCount ?? 0;
}

/**
 * Retrieve security score trends and scan findings timeline for a target.
 */
export async function getTargetSecurityTrends(
  targetId: string,
  organizationId: string
): Promise<TargetSecurityTrend[]> {
  const res = await query<{
    scanId: string;
    createdAt: Date;
    score: number;
    scanMode: string;
    totalFindings: string;
    criticalCount: string;
    highCount: string;
    mediumCount: string;
    lowCount: string;
  }>(
    `
    SELECT
      sj.id as "scanId",
      sj.created_at as "createdAt",
      COALESCE(sj.score, 100) as score,
      sj.scan_mode as "scanMode",
      COUNT(f.id)::text as "totalFindings",
      COUNT(f.id) FILTER (WHERE f.severity = 'CRITICAL')::text as "criticalCount",
      COUNT(f.id) FILTER (WHERE f.severity = 'HIGH')::text as "highCount",
      COUNT(f.id) FILTER (WHERE f.severity = 'MEDIUM')::text as "mediumCount",
      COUNT(f.id) FILTER (WHERE f.severity = 'LOW')::text as "lowCount"
    FROM scan_jobs sj
    LEFT JOIN findings f ON f.scan_id = sj.id
    WHERE sj.target_id = $1
      AND sj.organization_id = $2
      AND sj.status = 'COMPLETED'
    GROUP BY sj.id, sj.created_at, sj.score, sj.scan_mode
    ORDER BY sj.created_at ASC
    LIMIT 50
    `,
    [targetId, organizationId]
  );

  return res.rows.map((r) => ({
    scanId: r.scanId,
    createdAt: r.createdAt,
    score: Number(r.score),
    scanMode: r.scanMode,
    totalFindings: parseInt(r.totalFindings, 10),
    criticalCount: parseInt(r.criticalCount, 10),
    highCount: parseInt(r.highCount, 10),
    mediumCount: parseInt(r.mediumCount, 10),
    lowCount: parseInt(r.lowCount, 10),
  }));
}
