-- Migration 008: Launch Readiness & Self-Scan Audit Records

CREATE TABLE IF NOT EXISTS launch_readiness_scans (
  id VARCHAR(64) PRIMARY KEY,
  score INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  grade VARCHAR(8) NOT NULL,
  critical_findings INTEGER NOT NULL DEFAULT 0,
  high_findings INTEGER NOT NULL DEFAULT 0,
  medium_findings INTEGER NOT NULL DEFAULT 0,
  low_findings INTEGER NOT NULL DEFAULT 0,
  findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  checks_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  certification_hash VARCHAR(128) NOT NULL,
  triggered_by_user_id VARCHAR(64),
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launch_scans_created_at ON launch_readiness_scans(created_at DESC);
