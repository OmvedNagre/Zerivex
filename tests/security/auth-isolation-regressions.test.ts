import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const db = vi.hoisted(() => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/core/db/database', () => db);
vi.mock('@/core/billing/entitlement-service', () => ({ checkFeatureAccess: vi.fn(async () => ({ allowed: true })) }));
import { SessionContext, validateSessionToken } from '@/core/auth/session-service';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { requireAuthenticatedUser, requirePermission } from '@/core/rbac/authorization-guard';

const row = { sessionId: 'session', expiresAt: new Date(Date.now() + 60000), userId: 'user',
  email: 'user@example.test', displayName: 'User', avatarUrl: null, role: 'USER', status: 'ACTIVE',
  organizationId: 'older-customer-org', organizationRole: 'ORG_OWNER', viaStaffPortal: true, previewPlanId: null };

describe('Session and tenant enforcement regressions', () => {
  beforeEach(() => { db.query.mockReset(); db.withTransaction.mockReset(); });

  it('confines a staff customer session to its internal membership', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions s')) return { rows: [row] };
      if (sql.includes('FROM platform_roles')) return { rows: [{ role: 'STAFF_ADMIN' }] };
      if (sql.includes('is_internal = true')) return { rows: [{ id: 'internal-org' }] };
      return { rows: [{ valid: true }] };
    });
    expect((await validateSessionToken('a'.repeat(64)))?.organizationId).toBe('internal-org');
    expect(db.query.mock.calls.find(([sql]) => sql.includes('o.suspended_at IS NULL'))?.[1]).toEqual(['internal-org', 'user']);
  });

  it('rejects a suspended organization or removed membership', async () => {
    db.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM sessions s') ? [{ ...row, viaStaffPortal: false }] : [] }));
    expect(await validateSessionToken('a'.repeat(64))).toBeNull();
  });

  it('fails closed when an internal workspace is missing', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions s')) return { rows: [row] };
      if (sql.includes('FROM platform_roles')) return { rows: [{ role: 'STAFF_ADMIN' }] };
      return { rows: [] };
    });
    expect(await validateSessionToken('a'.repeat(64))).toBeNull();
  });

  it('does not provision a replacement organization when explicit membership is unavailable', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await expect(getUserActiveOrganization('user', 'internal-org')).rejects.toThrow('unavailable');
    expect(db.query.mock.calls[0]?.[1]).toEqual(['user', 'internal-org']);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('does not let a viewer inherit global customer mutation permissions', () => {
    const viewer = { user: { role: 'USER' }, organizationId: 'org', organizationRole: 'ORG_VIEWER' } as SessionContext;
    expect(() => requirePermission(viewer, 'targets:create')).toThrow('Organization role');
    expect(() => requirePermission(viewer, 'targets:read')).not.toThrow();
  });

  it('enforces CSRF in the commonly used session guard', async () => {
    const req = new NextRequest('https://example.com/api/targets', { method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', 'x-requested-with': 'XMLHttpRequest' } });
    await expect(requireAuthenticatedUser(req)).rejects.toThrow('Cross-origin');
    expect(db.query).not.toHaveBeenCalled();
  });
});
