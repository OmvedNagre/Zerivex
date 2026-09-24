import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { query } from '@/core/db/database';
import { PLANS } from '@/core/billing/types';
import {
  getSubscriptionByOrgId,
  upsertSubscription,
  incrementMonthlyScans,
  getMonthlyScanUsage,
  getActiveTargetCount,
  getTeamMemberCount,
  getCurrentMonthWindow,
} from '@/core/billing/subscription-repository';
import {
  checkTargetQuota,
  checkScanQuota,
  checkFeatureAccess,
  getOrganizationEntitlementSummary,
} from '@/core/billing/entitlement-service';
import {
  verifyStripeWebhookSignature,
  handleStripeWebhookEvent,
  createStripeCheckoutSession,
} from '@/core/billing/stripe-service';

describe('Phase 11: Production Polish, Billing & Enterprise Readiness', () => {
  let testOrgId: string;
  let testUserId: string;
  let testOwnerUserId: string;
  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create a standard test user
    const u1 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Standard User', 'USER') RETURNING id`,
      [`user-${testSuffix}@zerivex.local`]
    );
    testUserId = u1.rows[0]!.id;

    // 2. Create a platform owner user
    const u2 = await query<{ id: string }>(
      `INSERT INTO users (email, display_name, role) VALUES ($1, 'Platform Owner', 'OWNER') RETURNING id`,
      [`owner-${testSuffix}@zerivex.local`]
    );
    testOwnerUserId = u2.rows[0]!.id;

    // 3. Create a test organization
    const org = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
      [`Billing Org ${testSuffix}`, `billing-org-${testSuffix}`, testUserId]
    );
    testOrgId = org.rows[0]!.id;

    // 4. Create membership
    await query(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ORG_OWNER')`,
      [testOrgId, testUserId]
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testOrgId) {
      await query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]);
    }
    if (testUserId) {
      await query(`DELETE FROM users WHERE id IN ($1, $2)`, [testUserId, testOwnerUserId]);
    }
  });

  describe('1. Canonical INR Pricing & Currency Structure', () => {
    it('enforces currency as strictly INR (₹) across all plan tiers', () => {
      expect(PLANS.FREE_DEVELOPER.pricing.currency).toBe('INR');
      expect(PLANS.TEAM_PRO.pricing.currency).toBe('INR');
      expect(PLANS.ENTERPRISE.pricing.currency).toBe('INR');
    });

    it('defines exact INR pricing for Free Developer (₹0)', () => {
      expect(PLANS.FREE_DEVELOPER.pricing.monthlyInr).toBe(0);
      expect(PLANS.FREE_DEVELOPER.pricing.yearlyInr).toBe(0);
    });

    it('defines exact INR pricing for Team Pro (₹3,999/mo, ₹39,990/yr)', () => {
      expect(PLANS.TEAM_PRO.pricing.monthlyInr).toBe(3999);
      expect(PLANS.TEAM_PRO.pricing.yearlyInr).toBe(39990);
    });

    it('defines exact INR pricing for Enterprise (₹19,999/mo, ₹199,990/yr)', () => {
      expect(PLANS.ENTERPRISE.pricing.monthlyInr).toBe(19999);
      expect(PLANS.ENTERPRISE.pricing.yearlyInr).toBe(199990);
    });

    it('enforces tier limits matrix', () => {
      expect(PLANS.FREE_DEVELOPER.limits.maxVerifiedTargets).toBe(1);
      expect(PLANS.FREE_DEVELOPER.limits.maxMonthlyScans).toBe(10);
      expect(PLANS.FREE_DEVELOPER.limits.maxTeamMembers).toBe(1);

      expect(PLANS.TEAM_PRO.limits.maxVerifiedTargets).toBe(5);
      expect(PLANS.TEAM_PRO.limits.maxMonthlyScans).toBe(250);
      expect(PLANS.TEAM_PRO.limits.maxTeamMembers).toBe(5);

      expect(PLANS.ENTERPRISE.limits.maxVerifiedTargets).toBe(999999);
      expect(PLANS.ENTERPRISE.limits.maxMonthlyScans).toBe(999999);
      expect(PLANS.ENTERPRISE.limits.maxTeamMembers).toBe(999999);
    });
  });

  describe('2. Subscription Repository & Persistence', () => {
    it('provisions default FREE_DEVELOPER tier in INR on first access', async () => {
      const sub = await getSubscriptionByOrgId(testOrgId);
      expect(sub).toBeDefined();
      expect(sub.planId).toBe('FREE_DEVELOPER');
      expect(sub.status).toBe('ACTIVE');
      expect(sub.currency).toBe('INR');
      expect(sub.organizationId).toBe(testOrgId);
    });

    it('upserts subscription on plan upgrade', async () => {
      const upgraded = await upsertSubscription({
        organizationId: testOrgId,
        planId: 'TEAM_PRO',
        billingCycle: 'YEARLY',
        currency: 'INR',
      });

      expect(upgraded.planId).toBe('TEAM_PRO');
      expect(upgraded.billingCycle).toBe('YEARLY');
      expect(upgraded.currency).toBe('INR');

      const fetched = await getSubscriptionByOrgId(testOrgId);
      expect(fetched.planId).toBe('TEAM_PRO');
    });

    it('resets subscription back to FREE_DEVELOPER cleanly', async () => {
      await upsertSubscription({
        organizationId: testOrgId,
        planId: 'FREE_DEVELOPER',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      });

      const fetched = await getSubscriptionByOrgId(testOrgId);
      expect(fetched.planId).toBe('FREE_DEVELOPER');
    });
  });

  describe('3. Usage Ledgers & Deterministic Monthly Windows', () => {
    it('computes correct deterministic UTC monthly window', () => {
      const { start, end } = getCurrentMonthWindow();
      expect(start.getUTCDate()).toBe(1);
      expect(start.getUTCHours()).toBe(0);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it('atomically increments and retrieves monthly scan usage in ledger', async () => {
      const initial = await getMonthlyScanUsage(testOrgId);
      const updated = await incrementMonthlyScans(testOrgId, 3);
      expect(updated).toBe(initial + 3);

      const fetched = await getMonthlyScanUsage(testOrgId);
      expect(fetched).toBe(initial + 3);
    });

    it('counts active targets and team members accurately', async () => {
      const targetCount = await getActiveTargetCount(testOrgId);
      expect(targetCount).toBeGreaterThanOrEqual(0);

      const memberCount = await getTeamMemberCount(testOrgId);
      expect(memberCount).toBe(1); // 1 ORG_OWNER created in beforeAll
    });
  });

  describe('4. Entitlement & Quota Enforcement', () => {
    beforeAll(async () => {
      // Ensure testOrgId is on FREE_DEVELOPER
      await upsertSubscription({
        organizationId: testOrgId,
        planId: 'FREE_DEVELOPER',
      });
    });

    it('blocks feature access not included in Free Developer (Compliance Vault, Deep Scans)', async () => {
      const vaultCheck = await checkFeatureAccess(testOrgId, 'complianceAuditVault', 'USER');
      expect(vaultCheck.allowed).toBe(false);
      expect(vaultCheck.planId).toBe('FREE_DEVELOPER');
      expect(vaultCheck.isOwnerBypass).toBe(false);

      const deepScanCheck = await checkFeatureAccess(testOrgId, 'deepActiveScans', 'USER');
      expect(deepScanCheck.allowed).toBe(false);
    });

    it('permits feature access when upgraded to Team Pro or Enterprise', async () => {
      await upsertSubscription({
        organizationId: testOrgId,
        planId: 'TEAM_PRO',
      });

      const deepScanCheck = await checkFeatureAccess(testOrgId, 'deepActiveScans', 'USER');
      expect(deepScanCheck.allowed).toBe(true);

      const crawlerCheck = await checkFeatureAccess(testOrgId, 'attackSurfaceCrawler', 'USER');
      expect(crawlerCheck.allowed).toBe(true);

      // But compliance vault is still Enterprise only
      const vaultCheck = await checkFeatureAccess(testOrgId, 'complianceAuditVault', 'USER');
      expect(vaultCheck.allowed).toBe(false);

      // Now upgrade to Enterprise
      await upsertSubscription({
        organizationId: testOrgId,
        planId: 'ENTERPRISE',
      });

      const enterpriseVaultCheck = await checkFeatureAccess(testOrgId, 'complianceAuditVault', 'USER');
      expect(enterpriseVaultCheck.allowed).toBe(true);

      // Reset back to FREE_DEVELOPER
      await upsertSubscription({
        organizationId: testOrgId,
        planId: 'FREE_DEVELOPER',
      });
    });

    it('enforces monthly scan quota limits on standard users', async () => {
      // Set usage to 10 (which is the Free limit)
      const { start, end } = getCurrentMonthWindow();
      await query(
        `
        INSERT INTO usage_ledgers (organization_id, metric, period_start, period_end, value, updated_at)
        VALUES ($1, 'MONTHLY_SCANS', $2, $3, 10, NOW())
        ON CONFLICT (organization_id, metric, period_start)
        DO UPDATE SET value = 10
        `,
        [testOrgId, start, end]
      );

      const quota = await checkScanQuota(testOrgId, 'USER');
      expect(quota.allowed).toBe(false);
      expect(quota.current).toBe(10);
      expect(quota.max).toBe(10);
      expect(quota.isOwnerBypass).toBe(false);
      expect(quota.reason).toContain('reached the monthly scan allocation');
    });
  });

  describe('5. Platform Owner Entitlement Override', () => {
    it('bypasses scan quota limits server-side when user role is OWNER', async () => {
      // Free org is at 10/10 limit, but OWNER executes check
      const quota = await checkScanQuota(testOrgId, 'OWNER');
      expect(quota.allowed).toBe(true);
      expect(quota.isOwnerBypass).toBe(true);
      expect(quota.max).toBe(999999);
    });

    it('bypasses target quota limits server-side when user role is OWNER', async () => {
      const quota = await checkTargetQuota(testOrgId, 'OWNER');
      expect(quota.allowed).toBe(true);
      expect(quota.isOwnerBypass).toBe(true);
      expect(quota.max).toBe(999999);
    });

    it('unlocks Compliance Audit Vault export for Platform Owner regardless of org plan', async () => {
      const vaultCheck = await checkFeatureAccess(testOrgId, 'complianceAuditVault', 'OWNER');
      expect(vaultCheck.allowed).toBe(true);
      expect(vaultCheck.isOwnerBypass).toBe(true);
    });

    it('summary reflects owner bypass while preserving tenant subscription record', async () => {
      const summary = await getOrganizationEntitlementSummary(testOrgId, 'OWNER');
      expect(summary.isOwnerBypass).toBe(true);
      expect(summary.subscription.planId).toBe('FREE_DEVELOPER'); // Tenant DB unmutated
      expect(summary.usage.monthlyScans.max).toBe(999999);
      expect(summary.features.complianceAuditVault).toBe(true);
    });
  });

  describe('6. Stripe Webhook Native Signature Verification', () => {
    const testSecret = 'whsec_test_secret_1234567890abcdef';
    const payload = JSON.stringify({ id: 'evt_test_123', type: 'invoice.payment_succeeded' });

    it('verifies valid HMAC-SHA256 signature within tolerance window', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
      const header = `t=${timestamp},v1=${hmac}`;

      const res = verifyStripeWebhookSignature(payload, header, testSecret);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects tampered or modified payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
      const header = `t=${timestamp},v1=${hmac}`;

      const tamperedPayload = payload + ' ';
      const res = verifyStripeWebhookSignature(tamperedPayload, header, testSecret);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('signature match failure');
    });

    it('rejects forged signature signed with wrong secret', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', 'wrong_secret').update(signedPayload).digest('hex');
      const header = `t=${timestamp},v1=${hmac}`;

      const res = verifyStripeWebhookSignature(payload, header, testSecret);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('signature match failure');
    });

    it('rejects replay attacks outside the 300-second tolerance window', () => {
      const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 mins ago
      const signedPayload = `${expiredTimestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
      const header = `t=${expiredTimestamp},v1=${hmac}`;

      const res = verifyStripeWebhookSignature(payload, header, testSecret);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('tolerance window');
    });

    it('rejects missing or malformed header', () => {
      const res1 = verifyStripeWebhookSignature(payload, null, testSecret);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Missing');

      const res2 = verifyStripeWebhookSignature(payload, 'invalid_header', testSecret);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Malformed');
    });
  });

  describe('7. Stripe Webhook Lifecycle Event Handling', () => {
    it('processes checkout.session.completed and upgrades org in INR', async () => {
      const subId = `sub_test_${Math.random().toString(36).substring(2, 8)}`;
      const event = {
        id: `evt_${Math.random().toString(36).substring(2, 8)}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: `cus_${Math.random().toString(36).substring(2, 8)}`,
            subscription: subId,
            metadata: {
              organizationId: testOrgId,
              planId: 'TEAM_PRO',
              billingCycle: 'YEARLY',
            },
          },
        },
      };

      const result = await handleStripeWebhookEvent(event);
      expect(result.handled).toBe(true);
      expect(result.action).toBe('checkout.session.completed');

      const updatedSub = await getSubscriptionByOrgId(testOrgId);
      expect(updatedSub.planId).toBe('TEAM_PRO');
      expect(updatedSub.billingCycle).toBe('YEARLY');
      expect(updatedSub.currency).toBe('INR');
      expect(updatedSub.stripeSubscriptionId).toBe(subId);
    });

    it('processes customer.subscription.deleted and downgrades to FREE_DEVELOPER', async () => {
      const currentSub = await getSubscriptionByOrgId(testOrgId);
      const subId = currentSub.stripeSubscriptionId!;

      const event = {
        id: `evt_${Math.random().toString(36).substring(2, 8)}`,
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: subId,
          },
        },
      };

      const result = await handleStripeWebhookEvent(event);
      expect(result.handled).toBe(true);

      const downgradedSub = await getSubscriptionByOrgId(testOrgId);
      expect(downgradedSub.planId).toBe('FREE_DEVELOPER');
      expect(downgradedSub.status).toBe('CANCELED');
    });
  });

  describe('8. Simulated Stripe Checkout Initiation', () => {
    it('generates simulated checkout URL when no live Stripe keys are provided', async () => {
      const session = await createStripeCheckoutSession({
        organizationId: testOrgId,
        planId: 'ENTERPRISE',
        billingCycle: 'YEARLY',
        successUrl: 'http://localhost:3000/dashboard/billing?success=true',
        cancelUrl: 'http://localhost:3000/dashboard/billing?canceled=true',
      });

      expect(session.isSimulated).toBe(true);
      expect(session.sessionId).toContain('cs_sim_');
      expect(session.url).toContain('ENTERPRISE');
      expect(session.url).toContain('YEARLY');
    });
  });
});
