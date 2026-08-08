BEGIN;

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
    REFERENCES deployments(id),
  account_lookup_id CHAR(64) NOT NULL CHECK (account_lookup_id ~ '^[0-9a-f]{64}$'),
  terms_version VARCHAR(32) NOT NULL,
  privacy_version VARCHAR(32) NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptances_current_unique
  ON legal_acceptances(
    deployment_id,
    account_lookup_id,
    terms_version,
    privacy_version
  );

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_account_lookup
  ON legal_acceptances(deployment_id, account_lookup_id, accepted_at DESC);

DROP TRIGGER IF EXISTS update_legal_acceptances_updated_at ON legal_acceptances;
CREATE TRIGGER update_legal_acceptances_updated_at
  BEFORE UPDATE ON legal_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE legal_acceptances IS
  'Privacy-safe Terms and Privacy Policy acceptance records. Stores account lookup IDs, not plaintext emails.';

COMMIT;
