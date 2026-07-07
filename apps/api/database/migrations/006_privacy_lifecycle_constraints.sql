BEGIN;

ALTER TABLE shared_files
  DROP CONSTRAINT IF EXISTS shared_files_expiry_after_creation,
  DROP CONSTRAINT IF EXISTS shared_files_expected_size_positive,
  DROP CONSTRAINT IF EXISTS shared_files_deletion_attempts_nonnegative;

ALTER TABLE shared_files
  ADD CONSTRAINT shared_files_expiry_after_creation
    CHECK (expires_at IS NULL OR expires_at > created_at) NOT VALID,
  ADD CONSTRAINT shared_files_expected_size_positive
    CHECK (expected_encrypted_size IS NULL OR expected_encrypted_size > 0)
    NOT VALID,
  ADD CONSTRAINT shared_files_deletion_attempts_nonnegative
    CHECK (deletion_attempts >= 0) NOT VALID;

COMMIT;
