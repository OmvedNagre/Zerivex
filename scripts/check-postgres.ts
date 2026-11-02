import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

try { process.loadEnvFile('.env.local'); } catch { /* environment may supply credentials */ }

async function main() {
  const connectionString = process.env.TEST_DATABASE_URL ||
    ((process.env.ZERIVEX_ALLOW_SCHEMA_TESTS === 'true' || process.argv.includes('--temporary-schema')) ? (process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL) : undefined);
  if (!connectionString) throw new Error('Set TEST_DATABASE_URL, or explicitly authorize a temporary schema with ZERIVEX_ALLOW_SCHEMA_TESTS=true');
  const schema = `zerivex_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(connectionString);
  // Neon transaction pooling rejects startup search_path; use the same database's direct endpoint.
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  const tls = !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  url.searchParams.delete('sslmode');
  const admin = new Pool({ connectionString: url.toString(), ssl: tls ? { rejectUnauthorized: true } : undefined });
  let created = false;
  let close: (() => Promise<void>) | undefined;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    url.searchParams.set('options', `-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
    if (tls) process.env.DATABASE_URL += '&sslmode=verify-full';
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.SESSION_SECRET ||= randomUUID().repeat(2);
    process.env.INITIAL_OWNER_EMAIL ||= 'owner@example.test';
    const { query, closeDbPool } = await import('../src/core/db/database');
    close = closeDbPool;
    const { runMigrations } = await import('../src/core/db/migrate');
    await runMigrations();
    assert.equal((await runMigrations()).length, 0, 'migrations must be tracked and repeatable');
    assert.equal((await query<{ schema: string }>('SELECT current_schema() as schema')).rows[0]?.schema, schema);
    const { upsertSubscription, getSubscriptionByOrgId } = await import('../src/core/billing/subscription-repository');
    const { createScanJob, executeScanJob, getScanJobById, ALL_SCAN_CHECKS } = await import('../src/core/scanner/scan-runner');
    const { recordAuditEvent } = await import('../src/core/audit/audit-service');
    const { verifyAuditVaultIntegrity } = await import('../src/core/audit/audit-vault');
    const { pollDueSchedules } = await import('../src/core/scheduler/schedule-repository');
    const user = (await query<{ id: string }>("INSERT INTO users (email, role) VALUES ('regression@example.test', 'USER') RETURNING id")).rows[0]!.id;
    const org = (await query<{ id: string }>("INSERT INTO organizations (name, slug, created_by_user_id) VALUES ('Regression', 'regression', $1) RETURNING id", [user])).rows[0]!.id;
    await query("INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')", [org, user]);
    const project = (await query<{ id: string }>("INSERT INTO projects (organization_id, name) VALUES ($1, 'Regression') RETURNING id", [org])).rows[0]!.id;
    const target = (await query<{ id: string }>(`INSERT INTO targets
      (organization_id, project_id, target_url, hostname, verification_token)
      VALUES ($1, $2, 'https://example.com', 'example.com', 'regression-token') RETURNING id`, [org, project])).rows[0]!.id;
    await upsertSubscription({ organizationId: org, planId: 'TEAM', billingCycle: 'YEARLY', stripeSubscriptionId: 'sub_test' });
    await upsertSubscription({ organizationId: org, status: 'PAST_DUE' });
    let subscription = await getSubscriptionByOrgId(org);
    assert.equal(subscription.planId, 'TEAM');
    assert.equal(subscription.billingCycle, 'YEARLY');
    assert.equal(subscription.stripeSubscriptionId, 'sub_test');
    await upsertSubscription({ organizationId: org, stripeSubscriptionId: null });
    subscription = await getSubscriptionByOrgId(org);
    assert.equal(subscription.stripeSubscriptionId, null);
    await upsertSubscription({ organizationId: org, planId: 'STARTER', status: 'ACTIVE' });
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => createScanJob({
      organizationId: org, targetId: target, requesterUserId: user, scanMode: 'PUBLIC_PASSIVE' })));
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 8, 'quota must hold under concurrency');
    const queuedJobs = await query<{ id: string }>("SELECT id FROM scan_jobs WHERE organization_id = $1 ORDER BY created_at", [org]);
    const { recordAssessmentRequest } = await import('../src/core/security/assessment-context');
    const originalChecks = ALL_SCAN_CHECKS.map((check) => check.run);
    try {
      for (const check of ALL_SCAN_CHECKS) check.run = async () => { recordAssessmentRequest(true); return []; };
      ALL_SCAN_CHECKS[0]!.run = async () => { recordAssessmentRequest(false); return []; };
      await assert.rejects(executeScanJob(queuedJobs.rows[0]!.id), /incomplete/);
      const incomplete = await getScanJobById(queuedJobs.rows[0]!.id, org);
      assert.equal(incomplete.scanJob.status, 'FAILED');
      assert.equal(incomplete.scanJob.score, null);
      assert(incomplete.scanJob.checkResults?.some((check) => check.status === 'FAILED'));
      ALL_SCAN_CHECKS[0]!.run = async () => { recordAssessmentRequest(true); return []; };
      const completed = await executeScanJob(queuedJobs.rows[1]!.id);
      assert.equal(completed.scanJob.status, 'COMPLETED');
      assert.equal(completed.scanJob.score, 100);
      await assert.rejects(executeScanJob(queuedJobs.rows[1]!.id), /claimed|completed/);
    } finally { ALL_SCAN_CHECKS.forEach((check, index) => { check.run = originalChecks[index]!; }); }
    const { checkDistributedRateLimit } = await import('../src/core/security/distributed-rate-limiter');
    const originalNow = Date.now;
    const fixedNow = Date.now();
    try {
      Date.now = () => fixedNow;
      const limits = await Promise.all(Array.from({ length: 15 }, () => checkDistributedRateLimit('regression', 'AUTH')));
      assert.equal(limits.filter((result) => result.allowed).length, 10, 'rate limits must hold across concurrent replicas');
    } finally { Date.now = originalNow; }
    await Promise.all(Array.from({ length: 12 }, () => recordAuditEvent({ organizationId: org,
      actorUserId: user, action: 'ADMIN_ACCESS', resourceType: 'regression' })));
    assert.equal((await verifyAuditVaultIntegrity(org)).verified, true, 'concurrent appends must retain a valid chain');
    await assert.rejects(query('UPDATE audit_logs SET reason = $1 WHERE organization_id = $2', ['tampered', org]), /append-only/);
    await assert.rejects(query('DELETE FROM audit_logs WHERE organization_id = $1', [org]), /append-only/);
    await assert.rejects(query('TRUNCATE audit_logs'), /append-only/);
    await query(`INSERT INTO scan_schedules (organization_id, project_id, target_id, name, frequency,
      cron_expression, next_run_at, created_by_user_id) VALUES ($1, $2, $3, 'Lease test', 'DAILY',
      '0 0 * * *', NOW() - INTERVAL '1 minute', $4)`, [org, project, target, user]);
    const claims = await Promise.all([pollDueSchedules(1), pollDueSchedules(1)]);
    assert.equal(claims.flat().length, 1, 'one schedule may be claimed only once');
    await query('UPDATE organizations SET suspended_at = NOW() WHERE id = $1', [org]);
    await assert.rejects(createScanJob({ organizationId: org, targetId: target, requesterUserId: user }), /unavailable|revoked/);
    console.log('[POSTGRES CHECK] Passed: migrations, canonical plans, partial updates, concurrent quotas, audit integrity, append-only controls, schedule leases, suspension.');
  } finally {
    await close?.();
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
}

main().catch((error: unknown) => {
  // Never print connection strings or raw driver errors.
  console.error('[POSTGRES CHECK] Failed:', error instanceof assert.AssertionError ? error.message : 'Database connection or regression check failed');
  process.exitCode = 1;
});
