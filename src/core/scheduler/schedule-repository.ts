import { query } from '@/core/db/database';
import { ScanMode } from '@/core/scanner/checks/types';
import { ScheduleFrequency } from './cron-evaluator';

export interface ScanScheduleRecord {
  id: string;
  organizationId: string;
  projectId: string;
  targetId: string;
  name: string;
  frequency: ScheduleFrequency;
  cronExpression: string;
  scanMode: ScanMode;
  isActive: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastScanJobId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  targetUrl?: string;
  targetHostname?: string;
  verificationStatus?: string;
}

export interface CreateScheduleParams {
  organizationId: string;
  projectId: string;
  targetId: string;
  name: string;
  frequency: ScheduleFrequency;
  cronExpression: string;
  scanMode?: ScanMode;
  nextRunAt: Date;
  createdByUserId: string;
}

export interface UpdateScheduleParams {
  name?: string;
  frequency?: ScheduleFrequency;
  cronExpression?: string;
  scanMode?: ScanMode;
  isActive?: boolean;
  nextRunAt?: Date;
}

/**
 * Persist a new recurring scan schedule.
 */
export async function createScanSchedule(params: CreateScheduleParams): Promise<ScanScheduleRecord> {
  const scanMode = params.scanMode ?? 'PUBLIC_PASSIVE';

  const res = await query<ScanScheduleRecord>(
    `
    INSERT INTO scan_schedules (
      organization_id,
      project_id,
      target_id,
      name,
      frequency,
      cron_expression,
      scan_mode,
      next_run_at,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      organization_id as "organizationId",
      project_id as "projectId",
      target_id as "targetId",
      name,
      frequency,
      cron_expression as "cronExpression",
      scan_mode as "scanMode",
      is_active as "isActive",
      next_run_at as "nextRunAt",
      last_run_at as "lastRunAt",
      last_scan_job_id as "lastScanJobId",
      created_by_user_id as "createdByUserId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    [
      params.organizationId,
      params.projectId,
      params.targetId,
      params.name.trim(),
      params.frequency,
      params.cronExpression,
      scanMode,
      params.nextRunAt,
      params.createdByUserId,
    ]
  );

  return res.rows[0]!;
}

/**
 * Retrieve a specific schedule by ID under tenant organization.
 */
export async function getScanScheduleById(
  id: string,
  organizationId: string
): Promise<ScanScheduleRecord | null> {
  const res = await query<ScanScheduleRecord>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.project_id as "projectId",
      s.target_id as "targetId",
      s.name,
      s.frequency,
      s.cron_expression as "cronExpression",
      s.scan_mode as "scanMode",
      s.is_active as "isActive",
      s.next_run_at as "nextRunAt",
      s.last_run_at as "lastRunAt",
      s.last_scan_job_id as "lastScanJobId",
      s.created_by_user_id as "createdByUserId",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname",
      t.verification_status as "verificationStatus"
    FROM scan_schedules s
    JOIN targets t ON t.id = s.target_id
    WHERE s.id = $1 AND s.organization_id = $2
    `,
    [id, organizationId]
  );

  return res.rows[0] || null;
}

/**
 * List all schedules for a target under an organization.
 */
export async function getScanSchedulesByTarget(
  targetId: string,
  organizationId: string
): Promise<ScanScheduleRecord[]> {
  const res = await query<ScanScheduleRecord>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.project_id as "projectId",
      s.target_id as "targetId",
      s.name,
      s.frequency,
      s.cron_expression as "cronExpression",
      s.scan_mode as "scanMode",
      s.is_active as "isActive",
      s.next_run_at as "nextRunAt",
      s.last_run_at as "lastRunAt",
      s.last_scan_job_id as "lastScanJobId",
      s.created_by_user_id as "createdByUserId",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname",
      t.verification_status as "verificationStatus"
    FROM scan_schedules s
    JOIN targets t ON t.id = s.target_id
    WHERE s.target_id = $1 AND s.organization_id = $2
    ORDER BY s.created_at DESC
    `,
    [targetId, organizationId]
  );

  return res.rows;
}

/**
 * List all schedules for an organization.
 */
export async function getScanSchedulesByOrg(
  organizationId: string
): Promise<ScanScheduleRecord[]> {
  const res = await query<ScanScheduleRecord>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.project_id as "projectId",
      s.target_id as "targetId",
      s.name,
      s.frequency,
      s.cron_expression as "cronExpression",
      s.scan_mode as "scanMode",
      s.is_active as "isActive",
      s.next_run_at as "nextRunAt",
      s.last_run_at as "lastRunAt",
      s.last_scan_job_id as "lastScanJobId",
      s.created_by_user_id as "createdByUserId",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname",
      t.verification_status as "verificationStatus"
    FROM scan_schedules s
    JOIN targets t ON t.id = s.target_id
    WHERE s.organization_id = $1
    ORDER BY s.created_at DESC
    `,
    [organizationId]
  );

  return res.rows;
}

/**
 * Update an existing scan schedule with tenant verification.
 */
export async function updateScanSchedule(
  id: string,
  organizationId: string,
  updates: UpdateScheduleParams
): Promise<ScanScheduleRecord> {
  const fields: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [id, organizationId];
  let idx = 3;

  if (updates.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updates.name.trim());
  }
  if (updates.frequency !== undefined) {
    fields.push(`frequency = $${idx++}`);
    values.push(updates.frequency);
  }
  if (updates.cronExpression !== undefined) {
    fields.push(`cron_expression = $${idx++}`);
    values.push(updates.cronExpression);
  }
  if (updates.scanMode !== undefined) {
    fields.push(`scan_mode = $${idx++}`);
    values.push(updates.scanMode);
  }
  if (updates.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(updates.isActive);
  }
  if (updates.nextRunAt !== undefined) {
    fields.push(`next_run_at = $${idx++}`);
    values.push(updates.nextRunAt);
  }

  const res = await query<ScanScheduleRecord>(
    `
    UPDATE scan_schedules
    SET ${fields.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING
      id,
      organization_id as "organizationId",
      project_id as "projectId",
      target_id as "targetId",
      name,
      frequency,
      cron_expression as "cronExpression",
      scan_mode as "scanMode",
      is_active as "isActive",
      next_run_at as "nextRunAt",
      last_run_at as "lastRunAt",
      last_scan_job_id as "lastScanJobId",
      created_by_user_id as "createdByUserId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    values
  );

  const updated = res.rows[0];
  if (!updated) {
    throw new Error(`Schedule "${id}" not found or unauthorized`);
  }

  return updated;
}

/**
 * Delete a schedule under tenant organization.
 */
export async function deleteScanSchedule(
  id: string,
  organizationId: string
): Promise<boolean> {
  const res = await query(
    `
    DELETE FROM scan_schedules
    WHERE id = $1 AND organization_id = $2
    `,
    [id, organizationId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Atomic polling of due schedules ready for execution.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent race conditions across parallel workers.
 */
export async function pollDueSchedules(limit = 10): Promise<ScanScheduleRecord[]> {
  const res = await query<ScanScheduleRecord>(
    `
    SELECT
      s.id,
      s.organization_id as "organizationId",
      s.project_id as "projectId",
      s.target_id as "targetId",
      s.name,
      s.frequency,
      s.cron_expression as "cronExpression",
      s.scan_mode as "scanMode",
      s.is_active as "isActive",
      s.next_run_at as "nextRunAt",
      s.last_run_at as "lastRunAt",
      s.last_scan_job_id as "lastScanJobId",
      s.created_by_user_id as "createdByUserId",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt",
      t.target_url as "targetUrl",
      t.hostname as "targetHostname",
      t.verification_status as "verificationStatus"
    FROM scan_schedules s
    JOIN targets t ON t.id = s.target_id
    WHERE s.is_active = true AND s.next_run_at <= NOW()
    ORDER BY s.next_run_at ASC
    LIMIT $1
    FOR UPDATE OF s SKIP LOCKED
    `,
    [limit]
  );

  return res.rows;
}

/**
 * Update schedule execution tracking state.
 */
export async function recordScheduleExecution(
  scheduleId: string,
  scanJobId: string,
  nextRunAt: Date
): Promise<void> {
  await query(
    `
    UPDATE scan_schedules
    SET
      last_run_at = NOW(),
      last_scan_job_id = $2,
      next_run_at = $3,
      updated_at = NOW()
    WHERE id = $1
    `,
    [scheduleId, scanJobId, nextRunAt]
  );
}
