import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { query } from '@/core/db/database';
import { createTenantTarget } from '@/core/db/repositories/tenant-repository';
import {
  getNextRunDate,
  isValidCron,
  normalizeFrequencyToCron,
} from '@/core/scheduler/cron-evaluator';
import {
  createScanSchedule,
  getScanScheduleById,
  getScanSchedulesByTarget,
  getScanSchedulesByOrg,
  updateScanSchedule,
  deleteScanSchedule,
  pollDueSchedules,
  recordScheduleExecution,
} from '@/core/scheduler/schedule-repository';
import {
  createScanScheduleWithValidation,
  updateScanScheduleWithValidation,
  deleteScanScheduleWithValidation,
  triggerScheduleNow,
  dispatchDueSchedules,
} from '@/core/scheduler/scheduler-service';
import {
  createMonitoringAlert,
  getOrganizationAlerts,
  getTargetAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  getTargetSecurityTrends,
} from '@/core/monitoring/monitoring-repository';
import { evaluateScanRegression } from '@/core/monitoring/regression-detector';
import { defaultCircuitBreaker } from '@/core/scanner/active-rate-limiter';
import * as safeHttp from '@/core/security/safe-http-client';

describe('Phase 8: Scheduling, Monitoring & Automation Engine', () => {
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let projectBId: string;
  let targetAId: string;
  let targetBId: string;

  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create test user A
    const userARes = await query<{ id: string }>(`
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'Schedule Tester A', 'USER')
      RETURNING id
    `, [`schedule-tester-a-${testSuffix}@zerivex.local`]);
    userAId = userARes.rows[0]!.id;

    // 2. Create test user B
    const userBRes = await query<{ id: string }>(`
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'Schedule Tester B', 'USER')
      RETURNING id
    `, [`schedule-tester-b-${testSuffix}@zerivex.local`]);
    userBId = userBRes.rows[0]!.id;

    // 3. Create Org A
    const orgARes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org Schedule A', `org-schedule-a-${testSuffix}`, userAId]);
    orgAId = orgARes.rows[0]!.id;

    // 4. Create Org B
    const orgBRes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org Schedule B', `org-schedule-b-${testSuffix}`, userBId]);
    orgBId = orgBRes.rows[0]!.id;

    // 5. Create Projects
    const projARes = await query<{ id: string }>(`
      INSERT INTO projects (organization_id, name, description)
      VALUES ($1, 'Project Schedule A', 'Test Description')
      RETURNING id
    `, [orgAId]);
    projectAId = projARes.rows[0]!.id;

    const projBRes = await query<{ id: string }>(`
      INSERT INTO projects (organization_id, name, description)
      VALUES ($1, 'Project Schedule B', 'Test Description')
      RETURNING id
    `, [orgBId]);
    projectBId = projBRes.rows[0]!.id;

    // 6. Create Targets
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://schedule-target-a.local',
      verificationScope: 'EXACT_HOST',
      actorUserId: userAId,
    });
    targetAId = targetA.id;

    const targetB = await createTenantTarget({
      organizationId: orgBId,
      projectId: projectBId,
      targetUrl: 'https://schedule-target-b.local',
      verificationScope: 'EXACT_HOST',
      actorUserId: userBId,
    });
    targetBId = targetB.id;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    defaultCircuitBreaker.reset('schedule-target-a.local');
  });

  afterAll(async () => {
    if (orgAId) {
      await query('DELETE FROM monitoring_alerts WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM scan_schedules WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM findings WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM scan_jobs WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM targets WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM projects WHERE organization_id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
      await query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
    }
  });

  describe('1. Deterministic Cron Evaluator & Presets', () => {
    it('normalizes standard frequency presets to valid cron expressions', () => {
      expect(normalizeFrequencyToCron('DAILY')).toBe('0 2 * * *');
      expect(normalizeFrequencyToCron('WEEKLY')).toBe('0 3 * * 1');
      expect(normalizeFrequencyToCron('BIWEEKLY')).toBe('0 3 1,15 * *');
      expect(normalizeFrequencyToCron('MONTHLY')).toBe('0 4 1 * *');
      expect(normalizeFrequencyToCron('CUSTOM', '*/15 * * * *')).toBe('*/15 * * * *');
    });

    it('rejects invalid custom cron expressions', () => {
      expect(() => normalizeFrequencyToCron('CUSTOM', 'invalid-cron')).toThrow();
      expect(() => normalizeFrequencyToCron('CUSTOM', '65 * * * *')).toThrow();
      expect(isValidCron('*/5 * *')).toBe(false);
      expect(isValidCron('0 0 32 1 *')).toBe(false);
      expect(isValidCron('0 0 1 13 *')).toBe(false);
    });

    it('computes accurate next run timestamps deterministically in UTC', () => {
      const fixedBase = new Date('2026-09-23T12:00:00.000Z');

      // Daily at 02:00 UTC -> next is 2026-09-24 02:00:00
      const nextDaily = getNextRunDate('0 2 * * *', fixedBase);
      expect(nextDaily.toISOString()).toBe('2026-09-24T02:00:00.000Z');

      // Weekly on Monday at 03:00 UTC (2026-09-23 is Wednesday -> next Monday is 2026-09-28)
      const nextWeekly = getNextRunDate('0 3 * * 1', fixedBase);
      expect(nextWeekly.toISOString()).toBe('2026-09-28T03:00:00.000Z');

      // Step cron: every 30 minutes
      const nextStep = getNextRunDate('*/30 * * * *', fixedBase);
      expect(nextStep.toISOString()).toBe('2026-09-23T12:30:00.000Z');
    });
  });

  describe('2. Scan Schedule Repository & Multi-Tenant IDOR Defenses', () => {
    let createdScheduleId: string;

    it('allows Org A to create a recurring scan schedule', async () => {
      const nextRunAt = getNextRunDate('0 2 * * *');
      const schedule = await createScanSchedule({
        organizationId: orgAId,
        projectId: projectAId,
        targetId: targetAId,
        name: 'Nightly Audit',
        frequency: 'DAILY',
        cronExpression: '0 2 * * *',
        scanMode: 'PUBLIC_PASSIVE',
        nextRunAt,
        createdByUserId: userAId,
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Nightly Audit');
      expect(schedule.scanMode).toBe('PUBLIC_PASSIVE');
      expect(schedule.isActive).toBe(true);
      createdScheduleId = schedule.id;
    });

    it('PREVENTS Org B from reading Org A scan schedule (IDOR Defense)', async () => {
      const scheduleForB = await getScanScheduleById(createdScheduleId, orgBId);
      expect(scheduleForB).toBeNull();
    });

    it('PREVENTS Org B from updating Org A scan schedule (IDOR Defense)', async () => {
      await expect(
        updateScanSchedule(createdScheduleId, orgBId, { name: 'Malicious Hijack' })
      ).rejects.toThrow(/not found or unauthorized/i);
    });

    it('PREVENTS Org B from deleting Org A scan schedule (IDOR Defense)', async () => {
      const deleted = await deleteScanSchedule(createdScheduleId, orgBId);
      expect(deleted).toBe(false);

      // Verify schedule still exists for Org A
      const stillExists = await getScanScheduleById(createdScheduleId, orgAId);
      expect(stillExists).not.toBeNull();
    });

    it('allows Org A to update and pause its own schedule', async () => {
      const updated = await updateScanSchedule(createdScheduleId, orgAId, {
        name: 'Paused Nightly Audit',
        isActive: false,
      });
      expect(updated.name).toBe('Paused Nightly Audit');
      expect(updated.isActive).toBe(false);

      // Resume schedule
      const resumed = await updateScanSchedule(createdScheduleId, orgAId, {
        isActive: true,
      });
      expect(resumed.isActive).toBe(true);
    });

    it('lists scan schedules filtered by target and organization', async () => {
      const targetSchedules = await getScanSchedulesByTarget(targetAId, orgAId);
      expect(targetSchedules.length).toBeGreaterThanOrEqual(1);

      const orgSchedules = await getScanSchedulesByOrg(orgAId);
      expect(orgSchedules.length).toBeGreaterThanOrEqual(1);

      // Org B cannot view Org A target schedules
      const orgBSchedules = await getScanSchedulesByTarget(targetAId, orgBId);
      expect(orgBSchedules.length).toBe(0);
    });

    it('updates, records execution, and deletes scan schedule via validated service functions', async () => {
      const updated = await updateScanScheduleWithValidation(createdScheduleId, orgAId, userAId, {
        name: 'Service Validated Update',
      });
      expect(updated.name).toBe('Service Validated Update');

      const scanRes = await query<{ id: string }>(`
        INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status)
        VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED')
        RETURNING id
      `, [orgAId, targetAId, userAId]);
      const validJobId = scanRes.rows[0]!.id;

      const futureDate = new Date(Date.now() + 3600000);
      await recordScheduleExecution(createdScheduleId, validJobId, futureDate);
      const afterRecord = (await getScanScheduleById(createdScheduleId, orgAId))!;
      expect(afterRecord.lastScanJobId).toBe(validJobId);

      const deleted = await deleteScanScheduleWithValidation(createdScheduleId, orgAId, userAId);
      expect(deleted).toBe(true);
    });
  });

  describe('3. Target Verification Gate on Scheduled Scans (ADR-0008)', () => {
    it('BLOCKS creating a VERIFIED_ACTIVE schedule on UNVERIFIED target', async () => {
      await expect(
        createScanScheduleWithValidation({
          organizationId: orgAId,
          projectId: projectAId,
          targetId: targetAId,
          name: 'Active Intrusive Schedule',
          frequency: 'WEEKLY',
          scanMode: 'VERIFIED_ACTIVE',
          actorUserId: userAId,
        })
      ).rejects.toThrow(/must be in VERIFIED state before scheduling active intrusive scans/i);
    });

    it('PERMITS creating a PUBLIC_PASSIVE schedule on UNVERIFIED target', async () => {
      const schedule = await createScanScheduleWithValidation({
        organizationId: orgAId,
        projectId: projectAId,
        targetId: targetAId,
        name: 'Permitted Passive Schedule',
        frequency: 'DAILY',
        scanMode: 'PUBLIC_PASSIVE',
        actorUserId: userAId,
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.scanMode).toBe('PUBLIC_PASSIVE');
    });

    it('DOWNGRADES active scheduled scan to passive if target verification is revoked at runtime', async () => {
      // 1. Temporarily mark target as VERIFIED
      await query("UPDATE targets SET verification_status = 'VERIFIED' WHERE id = $1", [targetAId]);

      // 2. Create VERIFIED_ACTIVE schedule
      const activeSchedule = await createScanScheduleWithValidation({
        organizationId: orgAId,
        projectId: projectAId,
        targetId: targetAId,
        name: 'Active Schedule To Test Downgrade',
        frequency: 'WEEKLY',
        scanMode: 'VERIFIED_ACTIVE',
        actorUserId: userAId,
      });

      // 3. Revoke target verification
      await query("UPDATE targets SET verification_status = 'REVOKED' WHERE id = $1", [targetAId]);

      // Mock HTTP requests so scan completes without external network calls
      vi.spyOn(safeHttp, 'safeFetch').mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: '<!DOCTYPE html><html><body>Secure App</body></html>',
        finalUrl: 'https://schedule-target-a.local',
        pinnedIp: '93.184.216.34',
      });

      // 4. Trigger schedule run - must detect REVOKED and downgrade
      const { scanJob } = await triggerScheduleNow(activeSchedule.id, orgAId, userAId);
      expect(scanJob.scanMode).toBe('PUBLIC_PASSIVE');

      // 5. Verify downgrade alert was generated
      const alerts = await getTargetAlerts(targetAId, orgAId);
      const downgradeAlert = alerts.find((a) => a.alertType === 'TARGET_UNVERIFIED_DOWNGRADE');
      expect(downgradeAlert).toBeDefined();
      expect(downgradeAlert?.severity).toBe('HIGH');
    });
  });

  describe('4. Security Regression & Continuous Posture Monitoring Engine', () => {
    let baselineScanId: string;
    let regressionScanId: string;
    let targetRegId: string;

    beforeAll(async () => {
      const targetReg = await createTenantTarget({
        organizationId: orgAId,
        projectId: projectAId,
        targetUrl: 'https://regression-target.local',
        verificationScope: 'EXACT_HOST',
        actorUserId: userAId,
      });
      targetRegId = targetReg.id;
    });

    it('records baseline scan and flags initial critical finding alert if present', async () => {
      // 1. Insert a baseline completed scan
      const scanRes = await query<{ id: string }>(`
        INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status, score)
        VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED', 100)
        RETURNING id
      `, [orgAId, targetRegId, userAId]);
      baselineScanId = scanRes.rows[0]!.id;

      // 2. Evaluate regression on baseline
      const result = await evaluateScanRegression(baselineScanId);
      expect(result.isBaseline).toBe(true);
      expect(result.scoreDelta).toBe(0);
      expect(result.currentScore).toBe(100);
      expect(result.previousScore).toBeNull();
    });

    it('detects score drop regression (delta >= 10 points) and triggers SECURITY_SCORE_DROP alert', async () => {
      // 1. Insert a second scan with score 70 (drop of 30 points)
      const scanRes = await query<{ id: string }>(`
        INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status, score)
        VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED', 70)
        RETURNING id
      `, [orgAId, targetRegId, userAId]);
      regressionScanId = scanRes.rows[0]!.id;

      // 2. Insert a new high severity finding in regression scan
      await query(`
        INSERT INTO findings (
          scan_id, target_id, organization_id, rule_id, title,
          severity, confidence, category, resource_endpoint
        )
        VALUES (
          $1, $2, $3, 'ZX-ACT-SQLI-001', 'SQL Injection in User Search',
          'CRITICAL', 'CONFIRMED', 'INJECTION', 'https://regression-target.local/api/search'
        )
      `, [regressionScanId, targetRegId, orgAId]);

      // 3. Evaluate regression
      const result = await evaluateScanRegression(regressionScanId);
      expect(result.isBaseline).toBe(false);
      expect(result.scoreDelta).toBe(-30);
      expect(result.previousScore).toBe(100);
      expect(result.currentScore).toBe(70);

      // Verify generated alerts
      expect(result.generatedAlerts.length).toBeGreaterThanOrEqual(2);
      const scoreDropAlert = result.generatedAlerts.find((a) => a.alertType === 'SECURITY_SCORE_DROP');
      expect(scoreDropAlert).toBeDefined();
      expect(scoreDropAlert?.severity).toBe('CRITICAL');

      const newFindingAlert = result.generatedAlerts.find((a) => a.alertType === 'NEW_CRITICAL_FINDING');
      expect(newFindingAlert).toBeDefined();
      expect(newFindingAlert?.title).toContain('SQL Injection');
    });

    it('tracks historical security posture trends for dashboard charting', async () => {
      const trends = await getTargetSecurityTrends(targetRegId, orgAId);
      expect(trends.length).toBe(2);
      expect(trends[0]?.score).toBe(100);
      const lastTrend = trends[trends.length - 1]!;
      expect(lastTrend.score).toBe(70);
      expect(lastTrend.criticalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Monitoring Alerts Management & Tenant Isolation', () => {
    it('isolates monitoring alerts strictly by organization ID', async () => {
      // Create alert for Org B
      await createMonitoringAlert({
        organizationId: orgBId,
        targetId: targetBId,
        alertType: 'NEW_CRITICAL_FINDING',
        severity: 'CRITICAL',
        title: 'Org B Secret Leak',
        message: 'Exposed secret detected in Org B',
      });

      const alertsA = await getOrganizationAlerts(orgAId);
      const alertsB = await getOrganizationAlerts(orgBId);

      // Org A cannot see Org B's alert
      expect(alertsA.alerts.some((a) => a.title === 'Org B Secret Leak')).toBe(false);
      expect(alertsB.alerts.some((a) => a.title === 'Org B Secret Leak')).toBe(true);
    });

    it('marks individual alerts and all tenant alerts as read', async () => {
      const alertsB = await getOrganizationAlerts(orgBId);
      const targetAlert = alertsB.alerts[0]!;

      // Mark single read
      const updated = await markAlertAsRead(targetAlert.id, orgBId);
      expect(updated).toBe(true);

      // Mark all read
      const readCount = await markAllAlertsAsRead(orgAId);
      expect(readCount).toBeGreaterThanOrEqual(0);

      const unreadA = await getOrganizationAlerts(orgAId, { unreadOnly: true });
      expect(unreadA.unreadCount).toBe(0);
    });
  });

  describe('6. Concurrency Safety & Atomic Worker Dispatching', () => {
    it('polls due schedules and records execution timestamp advancement', async () => {
      // 1. Create a schedule whose next_run_at is in the past
      const pastDate = new Date(Date.now() - 60000);
      const schedule = await createScanSchedule({
        organizationId: orgAId,
        projectId: projectAId,
        targetId: targetAId,
        name: 'Due Schedule for Worker',
        frequency: 'DAILY',
        cronExpression: '0 2 * * *',
        scanMode: 'PUBLIC_PASSIVE',
        nextRunAt: pastDate,
        createdByUserId: userAId,
      });

      // 2. Poll due schedules
      const due = await pollDueSchedules(5);
      const matched = due.find((s) => s.id === schedule.id);
      expect(matched).toBeDefined();

      // 3. Mock HTTP for worker dispatch
      vi.spyOn(safeHttp, 'safeFetch').mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: '<!DOCTYPE html><html><body>Worker Safe</body></html>',
        finalUrl: 'https://schedule-target-a.local',
        pinnedIp: '93.184.216.34',
      });

      // 4. Dispatch worker
      const executed = await dispatchDueSchedules(5);
      expect(executed).toBeGreaterThanOrEqual(1);

      // 5. Verify next_run_at was advanced into the future
      const updated = (await getScanScheduleById(schedule.id, orgAId))!;
      expect(new Date(updated.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(updated.lastRunAt).not.toBeNull();
    });
  });

  describe('7. Append-Only Audit Trail Compliance', () => {
    it('records immutable audit events for schedule lifecycle and regression actions', async () => {
      const auditRes = await query<{ action: string }>(`
        SELECT action
        FROM audit_logs
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [orgAId]);

      const actions = auditRes.rows.map((r) => r.action);
      expect(actions).toContain('SCHEDULE_CREATED');
      expect(actions).toContain('SCHEDULE_TRIGGERED');
      expect(actions).toContain('REGRESSION_EVALUATED');
    });
  });
});
