-- 002_attack_surface.sql
-- Attack surface mapping and technology fingerprinting tables for Zerivex

-- 1. DISCOVERED ENDPOINTS (Mapped application routes, parameters, and APIs)
CREATE TABLE IF NOT EXISTS discovered_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    status_code INTEGER,
    content_type VARCHAR(100),
    discovery_source VARCHAR(50) NOT NULL CHECK (discovery_source IN ('CRAWLER', 'ROBOTS_TXT', 'SITEMAP', 'API_DISCOVERY', 'SPEC_OPENAPI', 'MANUAL')),
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_target_path_method UNIQUE (target_id, path, http_method)
);

CREATE INDEX IF NOT EXISTS idx_discovered_endpoints_target ON discovered_endpoints(target_id);
CREATE INDEX IF NOT EXISTS idx_discovered_endpoints_org ON discovered_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_discovered_endpoints_scan ON discovered_endpoints(scan_id);

-- 2. TECHNOLOGY FINGERPRINTS (Detected server, framework, CDN, and AI stack signatures)
CREATE TABLE IF NOT EXISTS technology_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('FRAMEWORK', 'SERVER', 'CDN_WAF', 'LANGUAGE', 'SECURITY_HEADER', 'AI_TOOLING', 'DATABASE')),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    confidence VARCHAR(20) NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
    matched_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_target_tech_name UNIQUE (target_id, name)
);

CREATE INDEX IF NOT EXISTS idx_technology_fingerprints_target ON technology_fingerprints(target_id);
CREATE INDEX IF NOT EXISTS idx_technology_fingerprints_org ON technology_fingerprints(organization_id);
