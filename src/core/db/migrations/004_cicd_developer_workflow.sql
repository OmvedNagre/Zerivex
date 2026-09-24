-- ============================================================
-- ZERIVEX MIGRATION: 004_cicd_developer_workflow.sql
-- CI/CD Security Integration, API Keys, Quality Gates & Webhooks
-- ============================================================

-- 1. API KEYS (Machine-to-machine authentication for CI/CD pipelines)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['scans:create', 'scans:read']::TEXT[],
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_used_ip VARCHAR(45),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- 2. WEBHOOKS (Event-driven notifications for external systems)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(128) NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['scan.completed', 'scan.failed', 'gate.failed', 'finding.critical']::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_delivery_at TIMESTAMPTZ,
    last_status_code INTEGER,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

-- 3. WEBHOOK DELIVERIES (Audit log and delivery health tracking)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status_code INTEGER,
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_id ON webhook_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- 4. QUALITY GATE POLICIES (Pipeline build-breaker rules)
CREATE TABLE IF NOT EXISTS quality_gate_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL DEFAULT 'Default Security Gate',
    min_security_score INTEGER NOT NULL DEFAULT 80 CHECK (min_security_score >= 0 AND min_security_score <= 100),
    fail_on_critical BOOLEAN NOT NULL DEFAULT true,
    max_high_findings INTEGER NOT NULL DEFAULT 0 CHECK (max_high_findings >= 0),
    max_medium_findings INTEGER NOT NULL DEFAULT 5 CHECK (max_medium_findings >= 0),
    fail_on_new_findings BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quality_gate_target UNIQUE (organization_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_quality_gates_org_id ON quality_gate_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_gates_target_id ON quality_gate_policies(target_id);
