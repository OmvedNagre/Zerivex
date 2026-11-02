CREATE TABLE rate_limit_windows (
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  requests INTEGER NOT NULL CHECK (requests > 0),
  PRIMARY KEY (key_hash, window_start)
);
CREATE INDEX rate_limit_windows_expiry ON rate_limit_windows(expires_at);
