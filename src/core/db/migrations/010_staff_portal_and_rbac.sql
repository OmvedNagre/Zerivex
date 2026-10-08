-- ============================================================================
-- Migration 010: Staff Portal, Console RBAC & Internal Workspace
-- Schema definitions for staff platform roles, independent staff sessions,
-- organization suspension, audit actor types, and portal preview state
-- ============================================================================

-- 1. PLATFORM ROLES (Staff Identity & Privilege Tiering)
CREATE TABLE IF NOT EXISTS platform_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF_OWNER', 'STAFF_ADMIN', 'STAFF_SUPPORT')),
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_roles_user ON platform_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_roles_active ON platform_roles(role) WHERE revoked_at IS NULL;

-- 2. STAFF SESSIONS (Isolated from customer sessions)
CREATE TABLE IF NOT EXISTS staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reauth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_expiry ON staff_sessions(expires_at);

-- 3. ORGANIZATIONS (Internal workspace & Suspension fields)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE organizations ALTER COLUMN created_by_user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_internal ON organizations(is_internal);

-- 4. AUDIT LOGS (Actor Type: USER | STAFF | SYSTEM)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) NOT NULL DEFAULT 'USER';

-- 5. SESSIONS (Staff portal navigation flags & plan preview)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS via_staff_portal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS preview_plan_id TEXT;

-- 6. SEED: Zerivex Internal Workspace
INSERT INTO organizations (name, slug, is_internal)
VALUES ('Zerivex Internal', 'zerivex-internal', true)
ON CONFLICT (slug) DO UPDATE SET is_internal = true;
