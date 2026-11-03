ALTER TABLE oauth_login_attempts ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'customer' CHECK (purpose IN ('customer','staff'));
