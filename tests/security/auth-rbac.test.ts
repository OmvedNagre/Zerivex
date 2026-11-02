import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '@/core/db/database';
import {
  isBootstrapCompleted,
  verifySoleOwnerProtection,
  BOOTSTRAP_KEY,
} from '@/core/auth/bootstrap-service';
import { roleHasPermission } from '@/core/rbac/permissions';
import { authenticateWithOAuthProfile } from '@/core/auth/oauth-service';

import { _resetConfigForTesting } from '@/core/config/env-validator';

describe('Authentication & RBAC Security Controls', () => {
  const testOwnerEmail = 'owner@zerivex-test.local';
  const testUserEmail = 'regular-user@zerivex-test.local';
  const attackerEmail = 'attacker@zerivex-test.local';

  async function cleanupTestData() {
    await query('DELETE FROM platform_bootstraps WHERE bootstrap_key = $1', [BOOTSTRAP_KEY]);
    await query(`
      DELETE FROM audit_logs 
      WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE '%@zerivex-test.local')
         OR organization_id IN (SELECT id FROM organizations WHERE created_by_user_id IN (SELECT id FROM users WHERE email LIKE '%@zerivex-test.local'))
    `);
    await query(`
      DELETE FROM organizations 
      WHERE created_by_user_id IN (SELECT id FROM users WHERE email LIKE '%@zerivex-test.local')
    `);
    await query("DELETE FROM users WHERE email LIKE '%@zerivex-test.local'");
  }

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    // Isolated schema fixture owns cleanup, including append-only records.
  });
  it('verifies that initial bootstrap is not yet completed', async () => {
    const completed = await isBootstrapCompleted();
    expect(completed).toBe(false);
  });

  it('assigns role USER to regular non-owner signups', async () => {
    const { userId, role } = await authenticateWithOAuthProfile({
      provider: 'google',
      providerAccountId: 'regular-user-sub-1',
      email: testUserEmail,
      isEmailVerified: true,
      displayName: 'Regular User',
    });

    expect(role).toBe('USER');

    const userRes = await query<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId]);
    expect(userRes.rows[0]?.role).toBe('USER');
  });

  it('does not promote OAuth users even when email matches INITIAL_OWNER_EMAIL', async () => {
    // Temporarily set INITIAL_OWNER_EMAIL to match testOwnerEmail
    process.env.INITIAL_OWNER_EMAIL = testOwnerEmail;
    _resetConfigForTesting();

    const { userId, role } = await authenticateWithOAuthProfile({
      provider: 'google',
      providerAccountId: 'owner-sub-1',
      email: testOwnerEmail,
      isEmailVerified: true,
      displayName: 'True Platform Owner',
    });

    expect(role).toBe('USER');
    expect((await query<{ role: string }>('SELECT role FROM users WHERE id = $1', [userId])).rows[0]?.role).toBe('USER');
    expect(await isBootstrapCompleted()).toBe(false);
  });

  it('PREVENTS repeated bootstrap: second user with same email or new user CANNOT become owner', async () => {
    // Attacker attempts to trigger bootstrap
    process.env.INITIAL_OWNER_EMAIL = attackerEmail;
    _resetConfigForTesting();

    const { role } = await authenticateWithOAuthProfile({
      provider: 'google',
      providerAccountId: 'attacker-sub-1',
      email: attackerEmail,
      isEmailVerified: true,
      displayName: 'Malicious Attacker',
    });

    // Must be rejected and remain standard USER
    expect(role).toBe('USER');
  });

  it('rejects unverified emails from authenticating', async () => {
    await expect(
      authenticateWithOAuthProfile({
        provider: 'google',
        providerAccountId: 'unverified-sub',
        email: 'unverified@zerivex-test.local',
        isEmailVerified: false,
      })
    ).rejects.toThrow(/Cannot authenticate with an unverified email address/);
  });

  it('enforces Sole Owner Protection: prevents demoting the last remaining OWNER', async () => {
    const ownerRes = await query<{ id: string }>(
      "UPDATE users SET role = 'OWNER' WHERE email = $1 RETURNING id",
      [testOwnerEmail]
    );
    const ownerId = ownerRes.rows[0]!.id;

    // Temporarily suspend any other existing owners so ownerId is guaranteed to be the sole active owner
    await query("UPDATE users SET status = 'SUSPENDED' WHERE role = 'OWNER' AND id != $1", [ownerId]);

    try {
      // Attempting to demote the sole owner MUST throw an error
      await expect(verifySoleOwnerProtection(ownerId)).rejects.toThrow(
        /Cannot demote or delete the sole Platform Owner/
      );
    } finally {
      // Restore other owners back to ACTIVE
      await query("UPDATE users SET status = 'ACTIVE' WHERE role = 'OWNER' AND id != $1", [ownerId]);
    }
  });

  it('evaluates RBAC permissions strictly per role', () => {
    // Normal USER permissions
    expect(roleHasPermission('USER', 'scans:create')).toBe(true);
    expect(roleHasPermission('USER', 'findings:read')).toBe(true);
    expect(roleHasPermission('USER', 'platform:admin')).toBe(false);
    expect(roleHasPermission('USER', 'users:manage')).toBe(false);

    // ADMIN permissions
    expect(roleHasPermission('ADMIN', 'users:read')).toBe(true);
    expect(roleHasPermission('ADMIN', 'platform:admin')).toBe(false);

    // SUPER_ADMIN permissions
    expect(roleHasPermission('SUPER_ADMIN', 'platform:admin')).toBe(true);

    // OWNER has unrestricted permissions across all platform capabilities
    expect(roleHasPermission('OWNER', 'scans:create')).toBe(true);
    expect(roleHasPermission('OWNER', 'platform:admin')).toBe(true);
    expect(roleHasPermission('OWNER', 'users:manage')).toBe(true);
    expect(roleHasPermission('OWNER', 'platform:rules_manage')).toBe(true);
  });
});
