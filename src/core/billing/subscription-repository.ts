import { query } from '@/core/db/database';
import {
  SubscriptionRecord,
  PlanId,
  SubscriptionStatus,
  BillingCycle,
} from './types';

/**
 * Calculate the deterministic start and end of the current UTC month.
 */
export function getCurrentMonthWindow(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/**
 * Fetch or automatically provision a default subscription for an organization.
 */
export async function getSubscriptionByOrgId(organizationId: string): Promise<SubscriptionRecord> {
  const res = await query<{
    id: string;
    organization_id: string;
    plan_id: string;
    status: string;
    billing_cycle: string;
    currency: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT * FROM subscriptions
    WHERE organization_id = $1
    LIMIT 1
    `,
    [organizationId]
  );

  const row = res.rows[0];
  if (row) {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id as PlanId,
      status: row.status as SubscriptionStatus,
      billingCycle: row.billing_cycle as BillingCycle,
      currency: row.currency,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Provision default FREE_DEVELOPER tier lazily
  const defaultSub = await upsertSubscription({
    organizationId,
    planId: 'FREE_DEVELOPER',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    currency: 'INR',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year rolling default
    cancelAtPeriodEnd: false,
  });

  return defaultSub;
}

/**
 * Upsert subscription details when modified or synced with Stripe.
 */
export async function upsertSubscription(params: {
  organizationId: string;
  planId?: PlanId;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  currency?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<SubscriptionRecord> {
  const planId = params.planId || 'FREE_DEVELOPER';
  const status = params.status || 'ACTIVE';
  const billingCycle = params.billingCycle || 'MONTHLY';
  const currency = params.currency || 'INR';
  const periodStart = params.currentPeriodStart || new Date();
  const periodEnd = params.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const cancelAtPeriodEnd = params.cancelAtPeriodEnd ?? false;
  const stripeCustId = params.stripeCustomerId ?? null;
  const stripeSubId = params.stripeSubscriptionId ?? null;

  const res = await query<{
    id: string;
    organization_id: string;
    plan_id: string;
    status: string;
    billing_cycle: string;
    currency: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    INSERT INTO subscriptions (
      organization_id, plan_id, status, billing_cycle, currency,
      current_period_start, current_period_end, cancel_at_period_end,
      stripe_customer_id, stripe_subscription_id, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (organization_id)
    DO UPDATE SET
      plan_id = COALESCE(EXCLUDED.plan_id, subscriptions.plan_id),
      status = COALESCE(EXCLUDED.status, subscriptions.status),
      billing_cycle = COALESCE(EXCLUDED.billing_cycle, subscriptions.billing_cycle),
      currency = COALESCE(EXCLUDED.currency, subscriptions.currency),
      current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
      current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, subscriptions.cancel_at_period_end),
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      updated_at = NOW()
    RETURNING *
    `,
    [
      params.organizationId,
      planId,
      status,
      billingCycle,
      currency,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd,
      stripeCustId,
      stripeSubId,
    ]
  );

  const row = res.rows[0]!;
  return {
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id as PlanId,
    status: row.status as SubscriptionStatus,
    billingCycle: row.billing_cycle as BillingCycle,
    currency: row.currency,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Find subscription by Stripe Customer ID or Subscription ID.
 */
export async function getSubscriptionByStripeId(
  stripeSubId: string
): Promise<SubscriptionRecord | null> {
  const res = await query<{
    id: string;
    organization_id: string;
    plan_id: string;
    status: string;
    billing_cycle: string;
    currency: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT * FROM subscriptions
    WHERE stripe_subscription_id = $1
    LIMIT 1
    `,
    [stripeSubId]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id as PlanId,
    status: row.status as SubscriptionStatus,
    billingCycle: row.billing_cycle as BillingCycle,
    currency: row.currency,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get current monthly scan usage count for the given organization.
 */
export async function getMonthlyScanUsage(organizationId: string): Promise<number> {
  const { start } = getCurrentMonthWindow();
  const res = await query<{ value: number }>(
    `
    SELECT value FROM usage_ledgers
    WHERE organization_id = $1
      AND metric = 'MONTHLY_SCANS'
      AND period_start = $2
    LIMIT 1
    `,
    [organizationId, start]
  );

  return res.rows[0]?.value ?? 0;
}

/**
 * Increment monthly scan usage for the given organization.
 */
export async function incrementMonthlyScans(
  organizationId: string,
  amount = 1
): Promise<number> {
  const { start, end } = getCurrentMonthWindow();

  const res = await query<{ value: number }>(
    `
    INSERT INTO usage_ledgers (
      organization_id, metric, period_start, period_end, value, updated_at
    )
    VALUES ($1, 'MONTHLY_SCANS', $2, $3, $4, NOW())
    ON CONFLICT (organization_id, metric, period_start)
    DO UPDATE SET
      value = usage_ledgers.value + EXCLUDED.value,
      updated_at = NOW()
    RETURNING value
    `,
    [organizationId, start, end, amount]
  );

  return res.rows[0]?.value ?? amount;
}

/**
 * Get active targets count for the organization.
 */
export async function getActiveTargetCount(organizationId: string): Promise<number> {
  const res = await query<{ count: string }>(
    `
    SELECT COUNT(*)::text as count
    FROM targets
    WHERE organization_id = $1
    `,
    [organizationId]
  );

  const rawCount = res.rows[0]?.count ?? '0';
  return parseInt(rawCount, 10);
}

/**
 * Get active team member count for the organization.
 */
export async function getTeamMemberCount(organizationId: string): Promise<number> {
  const res = await query<{ count: string }>(
    `
    SELECT COUNT(*)::text as count
    FROM memberships
    WHERE organization_id = $1
    `,
    [organizationId]
  );

  const rawCount = res.rows[0]?.count ?? '0';
  return parseInt(rawCount, 10);
}
