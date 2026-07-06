BEGIN;

ALTER TABLE shared_files
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expected_encrypted_size BIGINT,
  ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deletion_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deletion_last_error TEXT;

ALTER TABLE shared_files
  DROP CONSTRAINT IF EXISTS shared_files_status_check;

ALTER TABLE shared_files
  ADD CONSTRAINT shared_files_status_check
  CHECK (status IN ('pending', 'active', 'deleting'));

CREATE INDEX IF NOT EXISTS idx_shared_files_status
  ON shared_files(status);

CREATE INDEX IF NOT EXISTS idx_shared_files_pending_expiry
  ON shared_files(pending_expires_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_files_file_id_unique
  ON shared_files(file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_files_management_capability_hash_unique
  ON shared_files(management_capability_hash)
  WHERE management_capability_hash IS NOT NULL;

COMMIT;
