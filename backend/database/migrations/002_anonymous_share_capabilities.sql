BEGIN;

ALTER TABLE shared_files
  ADD COLUMN IF NOT EXISTS management_capability_hash CHAR(64);

ALTER TABLE shared_files
  DROP CONSTRAINT IF EXISTS shared_files_management_capability_hash_format;

ALTER TABLE shared_files
  ADD CONSTRAINT shared_files_management_capability_hash_format
  CHECK (
    management_capability_hash IS NULL
    OR management_capability_hash ~ '^[0-9a-f]{64}$'
  );

COMMIT;
