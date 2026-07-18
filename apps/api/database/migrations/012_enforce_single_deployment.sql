BEGIN;

-- ZeroDrive currently supports one application installation per database.
-- Keep deployment_id as explicit instance scope while preventing ambiguous
-- "oldest deployment wins" behavior if an accidental second row is inserted.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_singleton
  ON deployments ((true));

COMMIT;
