-- Normalize persisted subscriptions before enabling the canonical plan constraint.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_id_check;
UPDATE subscriptions SET plan_id = CASE plan_id
  WHEN 'FREE_DEVELOPER' THEN 'STARTER' WHEN 'TEAM_PRO' THEN 'TEAM' ELSE plan_id END;
ALTER TABLE subscriptions ALTER COLUMN plan_id SET DEFAULT 'STARTER';
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_id_check
  CHECK (plan_id IN ('STARTER', 'PRO', 'TEAM', 'ENTERPRISE'));

ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS check_results JSONB NOT NULL DEFAULT '[]';
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS execution_plan_id TEXT NOT NULL DEFAULT 'STARTER';
ALTER TABLE scan_schedules ADD COLUMN IF NOT EXISTS dispatch_claimed_until TIMESTAMPTZ;

-- Historical cookie findings remain readable and retestable after rule normalization.
UPDATE findings SET rule_id = replace(rule_id, 'ZX-CK-', 'ZX-CKI-') WHERE rule_id LIKE 'ZX-CK-%';

ALTER TABLE launch_readiness_scans ADD COLUMN IF NOT EXISTS check_results_json JSONB NOT NULL DEFAULT '[]';
ALTER TABLE launch_readiness_scans ADD COLUMN IF NOT EXISTS target_url TEXT;
