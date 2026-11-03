-- Single-use browser-bound OAuth handshakes, independent of the application's account/session tables.
CREATE TABLE IF NOT EXISTS oauth_login_attempts (
 state_hash TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK (provider IN ('google','github')),
 browser_token_hash TEXT NOT NULL,
 encrypted_verifier TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 return_to TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS oauth_login_attempts_expiry ON oauth_login_attempts(expires_at);
