BEGIN;

ALTER TABLE shared_files
  ADD COLUMN IF NOT EXISTS content_format VARCHAR(32),
  ADD COLUMN IF NOT EXISTS recipient_key_version INTEGER,
  ADD COLUMN IF NOT EXISTS recipient_key_fingerprint CHAR(64);

UPDATE shared_files
SET content_format = 'legacy_zdse'
WHERE content_format IS NULL;

CREATE OR REPLACE FUNCTION zerodrive_try_jsonb(value TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

UPDATE shared_files
SET
  recipient_key_version = COALESCE(
    recipient_key_version,
    (zerodrive_try_jsonb(encrypted_file_key)->>'recipientKeyVersion')::INTEGER
  ),
  recipient_key_fingerprint = COALESCE(
    recipient_key_fingerprint,
    zerodrive_try_jsonb(encrypted_file_key)->>'recipientKeyFingerprint'
  )
WHERE content_format = 'legacy_zdse'
  AND zerodrive_try_jsonb(encrypted_file_key) IS NOT NULL
  AND jsonb_typeof(zerodrive_try_jsonb(encrypted_file_key)) = 'object'
  AND (zerodrive_try_jsonb(encrypted_file_key)->>'recipientKeyVersion')
        ~ '^[1-9][0-9]*$'
  AND (zerodrive_try_jsonb(encrypted_file_key)->>'recipientKeyFingerprint')
        ~ '^[0-9a-f]{64}$';

DROP FUNCTION zerodrive_try_jsonb(TEXT);

ALTER TABLE shared_files
  ALTER COLUMN content_format SET DEFAULT 'legacy_zdse',
  ALTER COLUMN content_format SET NOT NULL,
  ALTER COLUMN encrypted_file_key DROP NOT NULL;

ALTER TABLE shared_files
  DROP CONSTRAINT IF EXISTS shared_files_content_format_check,
  DROP CONSTRAINT IF EXISTS shared_files_recipient_key_version_check,
  DROP CONSTRAINT IF EXISTS shared_files_recipient_key_fingerprint_check,
  DROP CONSTRAINT IF EXISTS shared_files_encryption_representation_check;

ALTER TABLE shared_files
  ADD CONSTRAINT shared_files_content_format_check
    CHECK (content_format IN ('legacy_zdse', 'capsule_v1')),
  ADD CONSTRAINT shared_files_recipient_key_version_check
    CHECK (
      recipient_key_version IS NULL
      OR recipient_key_version > 0
    ),
  ADD CONSTRAINT shared_files_recipient_key_fingerprint_check
    CHECK (
      recipient_key_fingerprint IS NULL
      OR recipient_key_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT shared_files_encryption_representation_check
    CHECK (
      (
        content_format = 'legacy_zdse'
        AND encrypted_file_key IS NOT NULL
      )
      OR
      (
        content_format = 'capsule_v1'
        AND encrypted_file_key IS NULL
        AND encrypted_metadata IS NOT NULL
        AND recipient_key_version IS NOT NULL
        AND recipient_key_fingerprint IS NOT NULL
      )
    ) NOT VALID;

-- PostgreSQL freezes the column list of SELECT * views at creation time.
-- Recreate the view so Studio and read-only consumers can see the new format
-- and recipient-key fields without changing inbox semantics.
DROP VIEW IF EXISTS active_shared_files;

CREATE VIEW active_shared_files AS
SELECT
  sf.*,
  true AS is_active
FROM shared_files sf
WHERE sf.status = 'active'
  AND (sf.expires_at IS NULL OR sf.expires_at > CURRENT_TIMESTAMP);

COMMENT ON COLUMN shared_files.content_format IS
  'Opaque encrypted-object format. New writes use capsule_v1; historical rows use legacy_zdse.';
COMMENT ON COLUMN shared_files.recipient_key_version IS
  'Privacy-safe recipient sharing-key version used to encrypt this object.';
COMMENT ON COLUMN shared_files.recipient_key_fingerprint IS
  'Fingerprint of the recipient public key used to encrypt this object.';

COMMIT;
