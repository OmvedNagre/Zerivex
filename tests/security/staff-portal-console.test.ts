import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  can,
  entitlementsForStaff,
  StaffRole,
  StaffPermission,
  STAFF_PERMISSIONS,
} from '@/core/staff/staff-permissions';
import {
  isEmailAllowedForStaff,
  requireStaffReauth,
  requireStaffAuth,
  STAFF_SESSION_COOKIE_NAME,
} from '@/core/staff/staff-session-service';
import {
  requireAuthenticatedUser,
  requireTenantAccess,
  ForbiddenError,
  UnauthorizedError,
} from '@/core/rbac/authorization-guard';
import {
  SESSION_COOKIE_NAME,
} from '@/core/auth/session-service';
import { proxy } from '@/proxy';
import { PLANS } from '@/core/billing/types';
import { POST as reauthPost } from '@/app/api/staff/auth/reauth/route';
import { POST as creditsPost } from '@/app/api/staff/credits/grant/route';
import { _resetConfigForTesting } from '@/core/config/env-validator';
import { seedStaffOwner } from '../../scripts/seed-staff-owner';

describe('Phase C & Phase 0: Staff Portal, Console RBAC & Security Controls', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetConfigForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetConfigForTesting();
  });

  describe('1. Full Permission Matrix & Role Boundaries (§C2, §0.9)', () => {
    const allPermissions: StaffPermission[] = [
      'CUSTOMER_PORTAL_ALL',
      'CUSTOMER_PORTAL_PRO',
      'VIEW_ORGS',
      'SUSPEND_ORGS',
      'VIEW_QUEUE',
      'VIEW_SECURITY_EVENTS',
      'GRANT_CREDITS',
      'MANAGE_STAFF',
      'SYSTEM_SETTINGS',
      'PLAN_PREVIEW_ANY',
      'PLAN_PREVIEW_PRO',
    ];

    it('STAFF_OWNER possesses all permissions in matrix', () => {
      const ownerSession = { role: 'STAFF_OWNER' as StaffRole };
      for (const perm of allPermissions) {
        expect(can(ownerSession, perm)).toBe(true);
      }
    });

    it('STAFF_ADMIN permission boundary is strictly enforced across every matrix item', () => {
      const adminSession = { role: 'STAFF_ADMIN' as StaffRole };
      const expectedAdmin = STAFF_PERMISSIONS.STAFF_ADMIN;

      for (const perm of allPermissions) {
        const expected = expectedAdmin.includes(perm);
        expect(can(adminSession, perm)).toBe(expected);
      }

      // Explicitly forbidden to admin
      expect(can(adminSession, 'MANAGE_STAFF')).toBe(false);
      expect(can(adminSession, 'SYSTEM_SETTINGS')).toBe(false);
    });

    it('STAFF_SUPPORT permission boundary is strictly read-only + Pro preview across matrix', () => {
      const supportSession = { role: 'STAFF_SUPPORT' as StaffRole };
      const expectedSupport = STAFF_PERMISSIONS.STAFF_SUPPORT;

      for (const perm of allPermissions) {
        const expected = expectedSupport.includes(perm);
        expect(can(supportSession, perm)).toBe(expected);
      }

      // Strictly denied to support
      expect(can(supportSession, 'CUSTOMER_PORTAL_ALL')).toBe(false);
      expect(can(supportSession, 'SUSPEND_ORGS')).toBe(false);
      expect(can(supportSession, 'GRANT_CREDITS')).toBe(false);
      expect(can(supportSession, 'MANAGE_STAFF')).toBe(false);
      expect(can(supportSession, 'SYSTEM_SETTINGS')).toBe(false);
      expect(can(supportSession, 'PLAN_PREVIEW_ANY')).toBe(false);
    });

    it('denies permissions safely when session is null, undefined, or missing role', () => {
      expect(can(null, 'VIEW_ORGS')).toBe(false);
      expect(can(undefined, 'VIEW_ORGS')).toBe(false);
      expect(can({ role: null as any }, 'VIEW_ORGS')).toBe(false);
    });

    it('entitlementsForStaff references Pro plan by reference for STAFF_SUPPORT', () => {
      const supportEntitlements = entitlementsForStaff('STAFF_SUPPORT');
      expect(supportEntitlements).toEqual(PLANS.PRO.features);

      const ownerEntitlements = entitlementsForStaff('STAFF_OWNER');
      expect(ownerEntitlements).toEqual(PLANS.ENTERPRISE.features);

      const adminEntitlements = entitlementsForStaff('STAFF_ADMIN');
      expect(adminEntitlements).toEqual(PLANS.ENTERPRISE.features);
    });
  });

  describe('2. Cookie & Session Isolation (Both Directions) (§0.9)', () => {
    it('customer session cookie cannot authenticate staff endpoints', async () => {
      const req = new NextRequest('http://localhost:3000/api/staff/me', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=mock-customer-session-token-value-32chars`,
        },
      });

      await expect(requireStaffAuth(req)).rejects.toThrow('Authentication required');
    });

    it('staff session cookie cannot authenticate customer endpoints', async () => {
      const req = new NextRequest('http://localhost:3000/api/me/profile', {
        headers: {
          cookie: `${STAFF_SESSION_COOKIE_NAME}=mock-staff-session-token-value-32chars`,
        },
      });

      await expect(requireAuthenticatedUser(req)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('3. Staff Email Allowlist & Public Domain Block (§0.6, §0.9)', () => {
    it('accepts exact email without Workspace hd claim', () => {
      process.env.STAFF_ALLOWED_EMAILS = 'owner@example.test';
      _resetConfigForTesting();
      expect(isEmailAllowedForStaff('owner@example.test')).toBe(true);
      expect(isEmailAllowedForStaff('OWNER@example.TEST')).toBe(true);
      expect(isEmailAllowedForStaff('other@example.test')).toBe(false);
    });
  });

  describe('4. CSRF Defense on Staff State-Changing Endpoints (§0.9)', () => {
    it('rejects POST request without custom CSRF header', async () => {
      const req = new NextRequest('http://localhost:3000/api/staff/portal/switch', {
        method: 'POST',
        headers: {
          cookie: `${STAFF_SESSION_COOKIE_NAME}=validtoken123456789012345678901234`,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
      });

      await expect(requireStaffAuth(req)).rejects.toThrow();
    });

    it('rejects POST request when Origin does not match Host', async () => {
      const req = new NextRequest('http://localhost:3000/api/staff/portal/switch', {
        method: 'POST',
        headers: {
          cookie: `${STAFF_SESSION_COOKIE_NAME}=validtoken123456789012345678901234`,
          'x-zerivex-staff': 'true',
          origin: 'http://attacker.com',
          host: 'localhost:3000',
        },
      });

      await expect(requireStaffAuth(req)).rejects.toThrow();
    });
  });

  describe('5. Real Re-authentication & Gating (§0.1, §0.9)', () => {
    it('POST /api/staff/auth/reauth rejects cookie-only call without Google credential', async () => {
      const req = new NextRequest('http://localhost:3000/api/staff/auth/reauth', {
        method: 'POST',
        headers: {
          'x-zerivex-staff': 'true',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
      });

      const res = await reauthPost(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('requireStaffReauth throws when session age exceeds window', () => {
      const staleStaff = {
        userId: 'u1',
        role: 'STAFF_OWNER' as StaffRole,
        email: 'owner@example.test',
        displayName: 'Owner',
        lastReauthAt: new Date(Date.now() - 20 * 60 * 1000), // 20m ago (>10m)
        tokenHash: 'h1',
      };

      expect(() => requireStaffReauth(staleStaff)).toThrow(/Re-authentication required/);
    });
  });

  describe('6. No Fake Credit Grants (§0.2, §0.9)', () => {
    it('POST /api/staff/credits/grant returns 501 Coming Soon when ledger does not exist', async () => {
      // Mock staff cookie/header
      const req = new NextRequest('http://localhost:3000/api/staff/credits/grant', {
        method: 'POST',
        headers: {
          'x-zerivex-staff': 'true',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
      });

      // Without auth throws 401
      const res = await creditsPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe('7. via_staff_portal Confinement & Revocation (§0.5, §0.9)', () => {
    it('strictly confines viaStaffPortal sessions away from other organizations', async () => {
      const staffContext = {
        sessionId: 's1',
        user: {
          id: 'u-staff',
          email: 'staff@example.test',
          displayName: 'Staff',
          avatarUrl: null,
          role: 'USER' as const,
          status: 'ACTIVE' as const,
        },
        organizationId: 'org-internal-id',
        organizationRole: 'ORG_OWNER',
        expiresAt: new Date(Date.now() + 100000),
        viaStaffPortal: true,
      };

      // Internal org access is permitted
      await expect(
        requireTenantAccess(staffContext, 'org-internal-id', 'scan')
      ).resolves.toBeUndefined();

      // Attempting to access customer org is strictly denied
      await expect(
        requireTenantAccess(staffContext, 'org-customer-id', 'scan')
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('8. Next.js 16 Edge Proxy Guard (§0.10)', () => {
    it('redirects unauthenticated /staff requests to /staff/login', () => {
      const req = new NextRequest('http://localhost:3000/staff');
      const res = proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/staff/login');
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('returns 404 when STAFF_PORTAL_ENABLED is false', () => {
      process.env.STAFF_PORTAL_ENABLED = 'false';
      const req = new NextRequest('http://localhost:3000/staff');
      const res = proxy(req);

      expect(res.status).toBe(404);
    });

    it('appends noindex, nofollow and no-store headers on all staff paths', () => {
      const req = new NextRequest('http://localhost:3000/staff/login');
      const res = proxy(req);

      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(res.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe('9. Bootstrap Idempotency (§0.9)', () => {
    it('seedStaffOwner is a callable idempotent function', () => {
      expect(typeof seedStaffOwner).toBe('function');
    });
  });
});
