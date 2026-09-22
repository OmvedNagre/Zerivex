-- ============================================================
-- ZERIVEX CANONICAL DATABASE SCHEMA (POSTGRESQL 16+)
-- MIGRATION: 001_initial_schema.sql
-- ============================================================

-- Ensure pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMPTZ,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'USER' CHECK (role IN ('OWNER', 'SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. IDENTITIES (OAuth Providers)
CREATE TABLE IF NOT EXISTS identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github', 'mock')),
    provider_account_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_identities_provider_account UNIQUE (provider, provider_account_id)
);

-- 3. SESSIONS (Hashed tokens, persistent server sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_name VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORGANIZATIONS (Multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MEMBERSHIPS (Organization membership & org roles)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'ORG_MEMBER' CHECK (role IN ('ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_memberships_org_user UNIQUE (organization_id, user_id)
);

-- 6. PROJECTS (Grouping of targets within an organization)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TARGETS (Attack surface web targets)
CREATE TABLE IF NOT EXISTS targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REVOKED')),
    verification_token VARCHAR(64) NOT NULL,
    verification_method VARCHAR(50) NOT NULL DEFAULT 'DNS_TXT' CHECK (verification_method IN ('DNS_TXT', 'HTML_META', 'HTTP_HEADER')),
    verification_scope VARCHAR(50) NOT NULL DEFAULT 'EXACT_HOST' CHECK (verification_scope IN ('EXACT_HOST', 'DOMAIN', 'SUBDOMAIN_WILDCARD', 'URL_PATH')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DOMAIN VERIFICATIONS (Verification audit tracking)
CREATE TABLE IF NOT EXISTS domain_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL,
    method VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. SCAN JOBS (Scan execution state)
CREATE TABLE IF NOT EXISTS scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    requester_user_id UUID NOT NULL REFERENCES users(id),
    scan_mode VARCHAR(50) NOT NULL DEFAULT 'PUBLIC_PASSIVE' CHECK (scan_mode IN ('PUBLIC_PASSIVE', 'VERIFIED_ACTIVE')),
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    score INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    worker_id VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. FINDINGS (Deterministic security findings with redacted evidence)
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
    confidence VARCHAR(50) NOT NULL CHECK (confidence IN ('CONFIRMED', 'HIGH', 'MEDIUM', 'LOW')),
    category VARCHAR(100) NOT NULL,
    resource_endpoint TEXT NOT NULL,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONFIRMED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'FIXED', 'REOPENED')),
    accepted_risk_reason TEXT,
    cwe_id VARCHAR(50),
    owasp_category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AUDIT LOGS (Strictly append-only security log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PLATFORM BOOTSTRAPS (One-time transactional owner bootstrap tracking)
CREATE TABLE IF NOT EXISTS platform_bootstraps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bootstrap_key VARCHAR(100) NOT NULL UNIQUE,
    owner_user_id UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE & ISOLATION INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_targets_org_id ON targets(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_org_id ON scan_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_org_id ON findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
