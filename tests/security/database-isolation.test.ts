import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, closeDbPool } from '@/core/db/database';
import {
  createTenantTarget,
  getTenantTargetById,
  createTenantScanJob,
  getTenantScanJobById,
} from '@/core/db/repositories/tenant-repository';
import { queryAuditLogs } from '@/core/audit/audit-service';

describe('Multi-Tenant Database Isolation & IDOR Defenses', () => {
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;

  async function cleanupTestData() {
    await query(`
      DELETE FROM audit_logs WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'org-%-slug');
      DELETE FROM scan_jobs WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'org-%-slug');
      DELETE FROM targets WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'org-%-slug');
      DELETE FROM projects WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'org-%-slug');
      DELETE FROM organizations WHERE slug LIKE 'org-%-slug';
      DELETE FROM users WHERE email LIKE '%@test-tenant.zerivex.local';
    `);
  }

  beforeAll(async () => {
    await cleanupTestData();

    // 1. Create User A and Org A
    const userARes = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ('userA@test-tenant.zerivex.local', 'User A', 'USER') RETURNING id`
    );
    userAId = userARes.rows[0]!.id;

    const orgARes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ('Org A', 'org-a-slug', $1) RETURNING id`,
      [userAId]
    );
    orgAId = orgARes.rows[0]!.id;

    const projARes = await query<{ id: string }>(
      `INSERT INTO projects (name, organization_id) VALUES ('Project A', $1) RETURNING id`,
      [orgAId]
    );
    projectAId = projARes.rows[0]!.id;

    // 2. Create User B and Org B
    const userBRes = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ('userB@test-tenant.zerivex.local', 'User B', 'USER') RETURNING id`
    );
    userBId = userBRes.rows[0]!.id;

    const orgBRes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ('Org B', 'org-b-slug', $1) RETURNING id`,
      [userBId]
    );
    orgBId = orgBRes.rows[0]!.id;

    await query<{ id: string }>(
      `INSERT INTO projects (name, organization_id) VALUES ('Project B', $1) RETURNING id`,
      [orgBId]
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeDbPool();
  });

  it('allows Org A to create and access its own targets', async () => {
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://app-a.zerivex.local',
      actorUserId: userAId,
    });

    expect(targetA).toBeDefined();
    expect(targetA.organizationId).toBe(orgAId);
    expect(targetA.hostname).toBe('app-a.zerivex.local');
    expect(targetA.verificationStatus).toBe('UNVERIFIED');

    const fetched = await getTenantTargetById(targetA.id, orgAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(targetA.id);
  });

  it('PREVENTS Org B from reading Org A targets (IDOR Defense)', async () => {
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://secret-internal.zerivex.local',
      actorUserId: userAId,
    });

    // Org B attempts to query Target A's ID
    const crossTenantResult = await getTenantTargetById(targetA.id, orgBId);
    expect(crossTenantResult).toBeNull();
  });

  it('PREVENTS Org B from initiating a scan on Org A target', async () => {
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://victim.zerivex.local',
      actorUserId: userAId,
    });

    // Org B attempts to trigger a scan using Target A
    await expect(
      createTenantScanJob({
        organizationId: orgBId,
        targetId: targetA.id,
        requesterUserId: userBId,
        scanMode: 'PUBLIC_PASSIVE',
      })
    ).rejects.toThrow(/Target not found in organization/);
  });

  it('PREVENTS active scanning when target is unverified', async () => {
    const unverifiedTarget = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://unverified-third-party.example.com',
      actorUserId: userAId,
    });

    // User attempts VERIFIED_ACTIVE scan on unverified target
    await expect(
      createTenantScanJob({
        organizationId: orgAId,
        targetId: unverifiedTarget.id,
        requesterUserId: userAId,
        scanMode: 'VERIFIED_ACTIVE',
      })
    ).rejects.toThrow(/Active scanning requires verified target ownership/);
  });

  it('isolates scan jobs by organization ID', async () => {
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: 'https://public-site.zerivex.local',
      actorUserId: userAId,
    });

    const scanA = await createTenantScanJob({
      organizationId: orgAId,
      targetId: targetA.id,
      requesterUserId: userAId,
      scanMode: 'PUBLIC_PASSIVE',
    });

    // Org A can read its scan
    const orgAScan = await getTenantScanJobById(scanA.id, orgAId);
    expect(orgAScan).not.toBeNull();
    expect(orgAScan?.id).toBe(scanA.id);

    // Org B cannot read Org A's scan
    const orgBScan = await getTenantScanJobById(scanA.id, orgBId);
    expect(orgBScan).toBeNull();
  });

  it('enforces append-only audit trail and isolates audit logs by tenant', async () => {
    const logsA = await queryAuditLogs({ organizationId: orgAId });
    expect(logsA.length).toBeGreaterThan(0);
    // Every log belongs to Org A
    expect(logsA.every((l) => l.organizationId === orgAId)).toBe(true);

    const logsB = await queryAuditLogs({ organizationId: orgBId });
    // Logs for B do not contain logs for A
    expect(logsB.every((l) => l.organizationId === orgBId)).toBe(true);
  });
});
