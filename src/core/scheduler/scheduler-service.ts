import { getTargetById } from '@/core/targets/target-service';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { createScanJob, executeScanJob, ScanJobRecord } from '@/core/scanner/scan-runner';
import { ScanMode } from '@/core/scanner/checks/types';
import {
  createScanSchedule,
  getScanScheduleById,
  updateScanSchedule,
  deleteScanSchedule,
  pollDueSchedules,
  recordScheduleExecution,
  ScanScheduleRecord,
} from './schedule-repository';
import {
  getNextRunDate,
  normalizeFrequencyToCron,
  isValidCron,
  ScheduleFrequency,
} from './cron-evaluator';
import { evaluateScanRegression } from '@/core/monitoring/regression-detector';
import { createMonitoringAlert } from '@/core/monitoring/monitoring-repository';

export interface CreateScheduleInput {
  organizationId: string;
  projectId: string;
  targetId: string;
  name: string;
  frequency: ScheduleFrequency;
  customCron?: string;
  scanMode?: ScanMode;
  actorUserId: string;
}

/**
 * Validates target ownership, active verification gate, and cron format before creating schedule.
 */
export async function createScanScheduleWithValidation(
  input: CreateScheduleInput
): Promise<ScanScheduleRecord> {
  // 1. Verify target exists and belongs to organization
  const target = await getTargetById(input.targetId, input.organizationId);

  const scanMode = input.scanMode ?? 'PUBLIC_PASSIVE';

  // 2. Enforce active scanning authorization lock (ADR-0008)
  if (scanMode === 'VERIFIED_ACTIVE' && target.verificationStatus !== 'VERIFIED') {
    throw new Error(
      `Target "${target.hostname}" must be in VERIFIED state before scheduling active intrusive scans (ADR-0008)`
    );
  }

  // 3. Resolve and validate cron expression
  const cronExpr = normalizeFrequencyToCron(input.frequency, input.customCron);
  if (!isValidCron(cronExpr)) {
    throw new Error(`Invalid cron expression for schedule: "${cronExpr}"`);
  }

  // 4. Calculate initial next_run_at
  const nextRunAt = getNextRunDate(cronExpr);

  // 5. Persist to DB
  const schedule = await createScanSchedule({
    organizationId: input.organizationId,
    projectId: input.projectId,
    targetId: input.targetId,
    name: input.name,
    frequency: input.frequency,
    cronExpression: cronExpr,
    scanMode,
    nextRunAt,
    createdByUserId: input.actorUserId,
  });

  // 6. Record audit event
  await recordAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: 'SCHEDULE_CREATED',
    resourceType: 'scan_schedule',
    resourceId: schedule.id,
    metadata: {
      targetId: input.targetId,
      frequency: input.frequency,
      cronExpression: cronExpr,
      scanMode,
      nextRunAt: nextRunAt.toISOString(),
    },
  });

  return schedule;
}

/**
 * Update an existing scan schedule with validation and audit logging.
 */
export async function updateScanScheduleWithValidation(
  scheduleId: string,
  organizationId: string,
  actorUserId: string,
  updates: {
    name?: string;
    frequency?: ScheduleFrequency;
    customCron?: string;
    scanMode?: ScanMode;
    isActive?: boolean;
  }
): Promise<ScanScheduleRecord> {
  const existing = await getScanScheduleById(scheduleId, organizationId);
  if (!existing) {
    throw new Error(`Scan schedule "${scheduleId}" not found or unauthorized`);
  }

  let newCron = existing.cronExpression;
  let newNextRun: Date | undefined;

  // If frequency or custom cron changed, re-calculate next_run_at
  if (updates.frequency || updates.customCron) {
    const freq = updates.frequency ?? existing.frequency;
    newCron = normalizeFrequencyToCron(freq, updates.customCron);
    newNextRun = getNextRunDate(newCron);
  }

  // If scanMode changed to VERIFIED_ACTIVE, check target verification
  if (updates.scanMode === 'VERIFIED_ACTIVE') {
    const target = await getTargetById(existing.targetId, organizationId);
    if (target.verificationStatus !== 'VERIFIED') {
      throw new Error(
        `Target "${target.hostname}" must be VERIFIED before enabling active intrusive scans (ADR-0008)`
      );
    }
  }

  const updated = await updateScanSchedule(scheduleId, organizationId, {
    name: updates.name,
    frequency: updates.frequency,
    cronExpression: newCron !== existing.cronExpression ? newCron : undefined,
    scanMode: updates.scanMode,
    isActive: updates.isActive,
    nextRunAt: newNextRun,
  });

  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'SCHEDULE_UPDATED',
    resourceType: 'scan_schedule',
    resourceId: scheduleId,
    metadata: {
      ...updates,
      cronExpression: newCron,
    },
  });

  return updated;
}

/**
 * Delete a scan schedule with audit logging.
 */
export async function deleteScanScheduleWithValidation(
  scheduleId: string,
  organizationId: string,
  actorUserId: string
): Promise<boolean> {
  const deleted = await deleteScanSchedule(scheduleId, organizationId);
  if (deleted) {
    await recordAuditEvent({
      organizationId,
      actorUserId,
      action: 'SCHEDULE_DELETED',
      resourceType: 'scan_schedule',
      resourceId: scheduleId,
    });
  }
  return deleted;
}

/**
 * Trigger an immediate on-demand run of a schedule.
 */
export async function triggerScheduleNow(
  scheduleId: string,
  organizationId: string,
  actorUserId: string
): Promise<{ schedule: ScanScheduleRecord; scanJob: ScanJobRecord }> {
  const schedule = await getScanScheduleById(scheduleId, organizationId);
  if (!schedule) {
    throw new Error(`Scan schedule "${scheduleId}" not found or unauthorized`);
  }

  const target = await getTargetById(schedule.targetId, organizationId);
  let effectiveScanMode: ScanMode = schedule.scanMode;

  // Fail-safe verification check: if target was revoked or unverified, downgrade
  if (schedule.scanMode === 'VERIFIED_ACTIVE' && target.verificationStatus !== 'VERIFIED') {
    effectiveScanMode = 'PUBLIC_PASSIVE';
    await createMonitoringAlert({
      organizationId,
      targetId: schedule.targetId,
      alertType: 'TARGET_UNVERIFIED_DOWNGRADE',
      severity: 'HIGH',
      title: `Scheduled Scan Downgraded to Passive: ${target.hostname}`,
      message: `Scheduled active scan for "${target.hostname}" was downgraded to passive scan because target verification status is "${target.verificationStatus}".`,
      metadata: {
        scheduleId,
        configuredMode: schedule.scanMode,
        effectiveMode: effectiveScanMode,
      },
    });
  }

  // 1. Create scan job
  const scanJob = await createScanJob({
    organizationId,
    targetId: schedule.targetId,
    requesterUserId: actorUserId,
    scanMode: effectiveScanMode,
  });

  // 2. Calculate next recurring run date
  const nextRunAt = getNextRunDate(schedule.cronExpression);
  await recordScheduleExecution(schedule.id, scanJob.id, nextRunAt);

  // 3. Record audit event
  await recordAuditEvent({
    organizationId,
    actorUserId,
    action: 'SCHEDULE_TRIGGERED',
    resourceType: 'scan_schedule',
    resourceId: schedule.id,
    metadata: {
      scanJobId: scanJob.id,
      scanMode: effectiveScanMode,
      nextRunAt: nextRunAt.toISOString(),
    },
  });

  // 4. Execute scan job
  await executeScanJob(scanJob.id);

  // 5. Evaluate security regressions
  await evaluateScanRegression(scanJob.id);

  const updatedSchedule = (await getScanScheduleById(scheduleId, organizationId))!;
  return { schedule: updatedSchedule, scanJob };
}

/**
 * Worker dispatcher: Polls due schedules with atomic row locking and executes them.
 */
export async function dispatchDueSchedules(batchSize = 5): Promise<number> {
  const dueSchedules = await pollDueSchedules(batchSize);
  let executedCount = 0;

  for (const schedule of dueSchedules) {
    try {
      const target = await getTargetById(schedule.targetId, schedule.organizationId);
      let effectiveScanMode: ScanMode = schedule.scanMode;

      if (schedule.scanMode === 'VERIFIED_ACTIVE' && target.verificationStatus !== 'VERIFIED') {
        effectiveScanMode = 'PUBLIC_PASSIVE';
        await createMonitoringAlert({
          organizationId: schedule.organizationId,
          targetId: schedule.targetId,
          alertType: 'TARGET_UNVERIFIED_DOWNGRADE',
          severity: 'HIGH',
          title: `Scheduled Scan Downgraded to Passive: ${target.hostname}`,
          message: `Scheduled active scan was downgraded to passive scan because target verification is "${target.verificationStatus}".`,
          metadata: {
            scheduleId: schedule.id,
            configuredMode: schedule.scanMode,
            effectiveMode: effectiveScanMode,
          },
        });
      }

      // Create scan job
      const scanJob = await createScanJob({
        organizationId: schedule.organizationId,
        targetId: schedule.targetId,
        requesterUserId: schedule.createdByUserId,
        scanMode: effectiveScanMode,
      });

      // Calculate next run date strictly from now
      const nextRunAt = getNextRunDate(schedule.cronExpression);
      await recordScheduleExecution(schedule.id, scanJob.id, nextRunAt);

      // Execute scan job
      await executeScanJob(scanJob.id);

      // Evaluate regressions
      await evaluateScanRegression(scanJob.id);

      executedCount++;
    } catch (err) {
      console.error(`[ZERIVEX SCHEDULER] Failed to execute schedule ${schedule.id}:`, (err as Error).message);
      // Advance next_run_at by 1 hour to prevent infinite failure spin
      const retryDate = new Date(Date.now() + 60 * 60 * 1000);
      await updateScanSchedule(schedule.id, schedule.organizationId, { nextRunAt: retryDate });
    }
  }

  return executedCount;
}
