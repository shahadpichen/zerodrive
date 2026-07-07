BEGIN;

ALTER TABLE public_keys
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fingerprint CHAR(64),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public_keys
  DROP CONSTRAINT IF EXISTS public_keys_user_id_key;

ALTER TABLE public_keys
  DROP CONSTRAINT IF EXISTS public_keys_key_version_positive;

ALTER TABLE public_keys
  ADD CONSTRAINT public_keys_key_version_positive CHECK (key_version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_keys_owner_version
  ON public_keys(user_id, key_version);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_keys_one_active
  ON public_keys(user_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_public_keys_active_lookup
  ON public_keys(user_id, is_active);

COMMIT;
