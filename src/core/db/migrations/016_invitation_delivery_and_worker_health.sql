ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS invitation_mail (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invitation_id UUID NOT NULL UNIQUE REFERENCES organization_invitations(id) ON DELETE CASCADE,
 encrypted_token TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENDING','SENT','FAILED','CANCELED')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 sent_at TIMESTAMPTZ, last_error TEXT, provider_message_id TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS worker_instances (
 id TEXT PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), stopping BOOLEAN NOT NULL DEFAULT FALSE,
 last_dispatch_at TIMESTAMPTZ, last_error_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS invitation_mail_dispatch ON invitation_mail (next_attempt_at) WHERE status IN ('QUEUED','SENDING');
