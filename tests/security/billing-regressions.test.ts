import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/core/db/database', () => db);
import { upsertSubscription } from '@/core/billing/subscription-repository';
import { resolveEntitlements } from '@/core/billing/entitlement-service';
import { createStripeCheckoutSession, createStripePortalSession } from '@/core/billing/stripe-service';
import { resolvePlanId } from '@/core/billing/types';

const record = {
  id: 'sub', organization_id: 'org', plan_id: 'TEAM', status: 'ACTIVE', billing_cycle: 'YEARLY',
  currency: 'INR', current_period_start: new Date(), current_period_end: new Date(Date.now() + 86400000),
  cancel_at_period_end: true, stripe_customer_id: 'cus', stripe_subscription_id: 'stripe-sub',
  created_at: new Date(), updated_at: new Date(),
};

describe('Billing lifecycle regressions', () => {
  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue({ rows: [record] }); });
  afterEach(() => vi.unstubAllEnvs());

  it('preserves omitted subscription fields on a status-only update', async () => {
    await upsertSubscription({ organizationId: 'org', status: 'PAST_DUE' });
    const [sql, values] = db.query.mock.calls[0]!;
    expect(sql).toContain('CASE WHEN $11::boolean');
    expect(values.slice(10)).toEqual([false, true, false, false, false, false, false, false, false]);
  });

  it('distinguishes clearing Stripe linkage from omitting it', async () => {
    await upsertSubscription({ organizationId: 'org', stripeSubscriptionId: null });
    const values = db.query.mock.calls[0]![1];
    expect(values[9]).toBeNull();
    expect(values[18]).toBe(true);
  });

  it.each(['PAST_DUE', 'CANCELED', 'INCOMPLETE'])('does not grant paid features to %s subscriptions', async (status) => {
    db.query.mockResolvedValue({ rows: [{ ...record, status }] });
    expect((await resolveEntitlements('org')).planId).toBe('STARTER');
  });

  it('does not grant expired paid subscriptions features', async () => {
    db.query.mockResolvedValue({ rows: [{ ...record, current_period_end: new Date(0) }] });
    expect((await resolveEntitlements('org')).planId).toBe('STARTER');
  });

  it('rejects production payment simulation', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    await expect(createStripeCheckoutSession({ organizationId: 'org', planId: 'PRO', billingCycle: 'MONTHLY',
      successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' })).rejects.toThrow('production');
    await expect(createStripePortalSession({ organizationId: 'org', stripeCustomerId: 'cus',
      returnUrl: 'https://example.com/' })).rejects.toThrow('production');
  });

  it('maps legacy plans and fails closed for unknown identifiers', () => {
    expect(resolvePlanId('TEAM_PRO')).toBe('TEAM');
    expect(resolvePlanId('made-up-plan')).toBe('STARTER');
  });
});
