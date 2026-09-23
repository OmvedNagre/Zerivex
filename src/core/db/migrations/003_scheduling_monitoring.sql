-- ============================================================
-- ZERIVEX MIGRATION: 003_scheduling_monitoring.sql
-- Scheduling, Continuous Monitoring & Security Regression Alerts
-- ============================================================

-- 1. SCAN SCHEDULES (Automated recurring scan configurations)
CREATE TABLE IF NOT EXISTS scan_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    frequency VARCHAR(32) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM')),
    cron_expression VARCHAR(64) NOT NULL,
    scan_mode VARCHAR(50) NOT NULL DEFAULT 'PUBLIC_PASSIVE' CHECK (scan_mode IN ('PUBLIC_PASSIVE', 'VERIFIED_ACTIVE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_scan_job_id UUID REFERENCES scan_jobs(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_schedules_org_id ON scan_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_target_id ON scan_schedules(target_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_next_run ON scan_schedules(is_active, next_run_at);

-- 2. MONITORING ALERTS (Automated alerts for regressions and security events)
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_jobs(id) ON DELETE CASCADE,
    alert_type VARCHAR(64) NOT NULL CHECK (alert_type IN (
        'NEW_CRITICAL_FINDING',
        'SECURITY_SCORE_DROP',
        'TARGET_UNVERIFIED_DOWNGRADE',
        'SCAN_FAILED',
        'CIRCUIT_BREAKER_TRIPPED',
        'HIGH_RISK_REGRESSION'
    )),
    severity VARCHAR(32) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_org_id ON monitoring_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_target_id ON monitoring_alerts(target_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_is_read ON monitoring_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at ON monitoring_alerts(created_at DESC);
