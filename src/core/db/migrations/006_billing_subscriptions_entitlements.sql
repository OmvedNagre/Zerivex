-- ============================================================
-- ZERIVEX MIGRATION: 006_billing_subscriptions_entitlements.sql
-- Enterprise Subscriptions, Quota Ledgers & Billing Entitlements
-- ============================================================

-- 1. SUBSCRIPTIONS (Tenant plan tiers and billing lifecycle)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    plan_id VARCHAR(50) NOT NULL DEFAULT 'FREE_DEVELOPER' CHECK (plan_id IN ('FREE_DEVELOPER', 'TEAM_PRO', 'ENTERPRISE')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE')),
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- 2. USAGE LEDGERS (Deterministic metric counters and periodic rollover tracking)
CREATE TABLE IF NOT EXISTS usage_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL CHECK (metric IN ('MONTHLY_SCANS', 'ACTIVE_TARGETS', 'TEAM_MEMBERS')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usage_org_metric_period UNIQUE (organization_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_ledgers_org_metric ON usage_ledgers(organization_id, metric);
