-- ============================================================
-- ZERIVEX MIGRATION: 007_agency_workflows_multi_client.sql
-- Phase 12: Teams & Agencies (Agency Workflows, Multi-Client Architecture & White-Label Reporting)
-- ============================================================

-- 1. EXTEND ORGANIZATIONS FOR AGENCY DESIGNATION
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_agency BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_organizations_is_agency ON organizations(is_agency);

-- 2. AGENCY WHITE-LABEL BRANDING
CREATE TABLE IF NOT EXISTS agency_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(1024),
    primary_color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
    report_footer_text TEXT,
    support_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_branding_org_id ON agency_branding(organization_id);

-- 3. AGENCY-CLIENT RELATIONSHIPS (Managed client organizations)
CREATE TABLE IF NOT EXISTS agency_client_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    account_manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_agency_client UNIQUE (agency_organization_id, client_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_clients_agency_org ON agency_client_relationships(agency_organization_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_client_org ON agency_client_relationships(client_organization_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_account_mgr ON agency_client_relationships(account_manager_user_id);

-- 4. AGENCY CLIENT GRANTS (External client stakeholder access)
CREATE TABLE IF NOT EXISTS agency_client_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID NOT NULL REFERENCES agency_client_relationships(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_VIEWER' CHECK (role IN ('CLIENT_VIEWER', 'CLIENT_MANAGER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_agency_client_grant UNIQUE (relationship_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_grants_rel_id ON agency_client_grants(relationship_id);
CREATE INDEX IF NOT EXISTS idx_agency_grants_user_id ON agency_client_grants(user_id);
