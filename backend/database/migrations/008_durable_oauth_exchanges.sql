BEGIN;

-- Stores only a hash of the one-time exchange capability. Google tokens and
-- account identifiers remain inside the authenticated encrypted capability.
CREATE TABLE IF NOT EXISTS oauth_exchanges (
  code_hash CHAR(64) PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_exchanges_expiry
  ON oauth_exchanges(expires_at);

COMMIT;
