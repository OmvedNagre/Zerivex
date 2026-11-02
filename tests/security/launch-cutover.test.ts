import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/core/db/database', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
import { query } from '@/core/db/database';
import { verifyTarget } from '@/core/targets/verification-service';
import { handleOwnerBootstrap } from '@/core/auth/bootstrap-service';
import { resolveEntitlements } from '@/core/billing/entitlement-service';
import { getClientIp } from '@/core/security/rate-limiter';
import { GET as mockConsent } from '@/app/api/auth/mock-consent/route';
import { POST as previewPlan } from '@/app/api/staff/portal/preview-plan/route';
const originalVercel = process.env.VERCEL;
afterEach(() => { vi.clearAllMocks(); if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel; });
describe('Launch cutover restrictions', () => {
  it('rejects manual proof before reading or updating a target', async () => {
    await expect(verifyTarget({ targetId: 'arbitrary', organizationId: 'arbitrary', actorUserId: 'owner', bypass: true })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('never promotes an OAuth account from configured email', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ role: 'USER' }] } as never);
    expect(await handleOwnerBootstrap({ userId: 'user', email: process.env.INITIAL_OWNER_EMAIL || 'owner@example.test', isVerified: true })).toBe('USER');
    expect(query).toHaveBeenCalledTimes(1);
    expect(vi.mocked(query).mock.calls[0]?.[0]).toMatch(/^SELECT/);
  });
  it('ignores owner and staff preview privileges for customer plans', async () => {
    const entitlements = await resolveEntitlements({ planId: 'STARTER' }, { user: { role: 'OWNER' }, viaStaffPortal: true, staffRole: 'STAFF_OWNER', previewPlanId: 'ENTERPRISE' } as never);
    expect(entitlements.planId).toBe('STARTER');
    expect(entitlements.isStaffOverride).toBe(false);
    expect(entitlements.features.ciGates).toBe(false);
  });
  it('retires developer consent and plan preview routes', async () => {
    expect((await mockConsent()).status).toBe(404);
    expect((await previewPlan()).status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });
  it('uses only Vercel-controlled client IP on Vercel', () => {
    process.env.VERCEL = '1';
    expect(getClientIp(new Headers({ 'x-vercel-forwarded-for': '203.0.113.8', 'cf-connecting-ip': '198.51.100.2' }), false)).toBe('203.0.113.8');
    expect(getClientIp(new Headers({ 'x-forwarded-for': '198.51.100.2' }), true)).toBe('127.0.0.1');
  });
});
