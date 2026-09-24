-- ============================================================
-- ZERIVEX MIGRATION: 005_enterprise_teams_audit_vault.sql
-- Enterprise Teams, Invitations, Audit Vault & Collaboration
-- ============================================================

-- 1. EXTEND MEMBERSHIPS ROLE CONSTRAINT
-- Update role check constraint to include ORG_VIEWER and ORG_AUDITOR
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
    CHECK (role IN ('ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER', 'ORG_AUDITOR'));

-- 2. ORGANIZATION INVITATIONS (Secure token-hashed team invitations)
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ORG_MEMBER' CHECK (role IN ('ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER', 'ORG_AUDITOR')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token_hash ON organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);

-- 3. FINDING COMMENTS (Multi-engineer collaboration threads)
CREATE TABLE IF NOT EXISTS finding_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_type VARCHAR(32) NOT NULL DEFAULT 'USER_COMMENT' CHECK (comment_type IN ('USER_COMMENT', 'SYSTEM_NOTE', 'STATUS_CHANGE_NOTE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finding_comments_finding_id ON finding_comments(finding_id);
CREATE INDEX IF NOT EXISTS idx_finding_comments_org_id ON finding_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_finding_comments_created_at ON finding_comments(created_at DESC);

-- 4. EXTEND FINDINGS TABLE (Assignee tracking)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_findings_assigned_user ON findings(assigned_user_id);
