BEGIN;

ALTER TABLE shared_files
  ADD COLUMN IF NOT EXISTS encrypted_metadata TEXT;

ALTER TABLE shared_files
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL;

COMMIT;
