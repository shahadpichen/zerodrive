BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION zerodrive_default_deployment_id()
RETURNS UUID AS $$
DECLARE
  deployment UUID;
BEGIN
  SELECT id
    INTO deployment
    FROM deployments
   ORDER BY created_at ASC, id ASC
   LIMIT 1;

  IF deployment IS NULL THEN
    INSERT INTO deployments DEFAULT VALUES
    RETURNING id INTO deployment;
  END IF;

  RETURN deployment;
END;
$$ LANGUAGE plpgsql;

INSERT INTO deployments (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM deployments);

ALTER TABLE public_keys
  ADD COLUMN IF NOT EXISTS deployment_id UUID;

UPDATE public_keys
   SET deployment_id = zerodrive_default_deployment_id()
 WHERE deployment_id IS NULL;

ALTER TABLE public_keys
  ALTER COLUMN deployment_id SET DEFAULT zerodrive_default_deployment_id(),
  ALTER COLUMN deployment_id SET NOT NULL;

ALTER TABLE public_keys
  DROP CONSTRAINT IF EXISTS public_keys_deployment_id_fkey,
  ADD CONSTRAINT public_keys_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) NOT VALID;

ALTER TABLE public_keys
  VALIDATE CONSTRAINT public_keys_deployment_id_fkey;

CREATE INDEX IF NOT EXISTS idx_public_keys_deployment_user_id
  ON public_keys(deployment_id, user_id);

ALTER TABLE shared_files
  ADD COLUMN IF NOT EXISTS deployment_id UUID;

UPDATE shared_files
   SET deployment_id = zerodrive_default_deployment_id()
 WHERE deployment_id IS NULL;

ALTER TABLE shared_files
  ALTER COLUMN deployment_id SET DEFAULT zerodrive_default_deployment_id(),
  ALTER COLUMN deployment_id SET NOT NULL;

ALTER TABLE shared_files
  DROP CONSTRAINT IF EXISTS shared_files_deployment_id_fkey,
  ADD CONSTRAINT shared_files_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) NOT VALID;

ALTER TABLE shared_files
  VALIDATE CONSTRAINT shared_files_deployment_id_fkey;

CREATE INDEX IF NOT EXISTS idx_shared_files_deployment_recipient
  ON shared_files(deployment_id, recipient_user_id, created_at DESC);

ALTER TABLE oauth_exchanges
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS deployment_id UUID;

UPDATE oauth_exchanges
   SET id = gen_random_uuid()
 WHERE id IS NULL;

UPDATE oauth_exchanges
   SET deployment_id = zerodrive_default_deployment_id()
 WHERE deployment_id IS NULL;

ALTER TABLE oauth_exchanges
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN deployment_id SET DEFAULT zerodrive_default_deployment_id(),
  ALTER COLUMN deployment_id SET NOT NULL;

ALTER TABLE oauth_exchanges
  DROP CONSTRAINT IF EXISTS oauth_exchanges_pkey,
  ADD CONSTRAINT oauth_exchanges_pkey PRIMARY KEY (id);

ALTER TABLE oauth_exchanges
  DROP CONSTRAINT IF EXISTS oauth_exchanges_deployment_id_fkey,
  ADD CONSTRAINT oauth_exchanges_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) NOT VALID;

ALTER TABLE oauth_exchanges
  VALIDATE CONSTRAINT oauth_exchanges_deployment_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_exchanges_code_hash_unique
  ON oauth_exchanges(code_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_exchanges_deployment_code_hash_unique
  ON oauth_exchanges(deployment_id, code_hash);

ALTER TABLE analytics_daily_summary
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS deployment_id UUID;

UPDATE analytics_daily_summary
   SET id = gen_random_uuid()
 WHERE id IS NULL;

UPDATE analytics_daily_summary
   SET deployment_id = zerodrive_default_deployment_id()
 WHERE deployment_id IS NULL;

ALTER TABLE analytics_daily_summary
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN deployment_id SET DEFAULT zerodrive_default_deployment_id(),
  ALTER COLUMN deployment_id SET NOT NULL;

ALTER TABLE analytics_daily_summary
  DROP CONSTRAINT IF EXISTS analytics_daily_summary_pkey,
  ADD CONSTRAINT analytics_daily_summary_pkey PRIMARY KEY (id);

ALTER TABLE analytics_daily_summary
  DROP CONSTRAINT IF EXISTS analytics_daily_summary_deployment_id_fkey,
  ADD CONSTRAINT analytics_daily_summary_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) NOT VALID;

ALTER TABLE analytics_daily_summary
  VALIDATE CONSTRAINT analytics_daily_summary_deployment_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_summary_deployment_date_unique
  ON analytics_daily_summary(deployment_id, date);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_deployment_date
  ON analytics_daily_summary(deployment_id, date DESC);

ALTER TABLE analytics_daily_dimensions
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS deployment_id UUID;

UPDATE analytics_daily_dimensions
   SET id = gen_random_uuid()
 WHERE id IS NULL;

UPDATE analytics_daily_dimensions
   SET deployment_id = zerodrive_default_deployment_id()
 WHERE deployment_id IS NULL;

ALTER TABLE analytics_daily_dimensions
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN deployment_id SET DEFAULT zerodrive_default_deployment_id(),
  ALTER COLUMN deployment_id SET NOT NULL;

ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_pkey,
  ADD CONSTRAINT analytics_daily_dimensions_pkey PRIMARY KEY (id);

ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_deployment_id_fkey,
  ADD CONSTRAINT analytics_daily_dimensions_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES deployments(id) NOT VALID;

ALTER TABLE analytics_daily_dimensions
  VALIDATE CONSTRAINT analytics_daily_dimensions_deployment_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_deployment_key_unique
  ON analytics_daily_dimensions(deployment_id, date, metric, dimension, bucket);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_deployment_date
  ON analytics_daily_dimensions(deployment_id, date DESC);

COMMIT;
