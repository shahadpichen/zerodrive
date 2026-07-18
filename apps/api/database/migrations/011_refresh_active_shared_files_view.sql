BEGIN;

DROP VIEW IF EXISTS active_shared_files;

CREATE VIEW active_shared_files AS
SELECT
    sf.*,
    true AS is_active
FROM shared_files sf
WHERE sf.status = 'active'
  AND (sf.expires_at IS NULL OR sf.expires_at > CURRENT_TIMESTAMP);

COMMIT;
