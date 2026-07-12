BEGIN;

-- Older installations received this table from init.sql before the migration
-- runner existed. Fresh installations must be able to build it from the
-- migration set alone.
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  date DATE PRIMARY KEY,
  total_logins INTEGER NOT NULL DEFAULT 0,
  total_new_users INTEGER NOT NULL DEFAULT 0,
  total_limited_scope_logins INTEGER NOT NULL DEFAULT 0,
  total_downloads INTEGER NOT NULL DEFAULT 0,
  total_files_added_to_drive INTEGER NOT NULL DEFAULT 0,
  total_shares INTEGER NOT NULL DEFAULT 0,
  total_invitations INTEGER NOT NULL DEFAULT 0,
  total_key_setups INTEGER NOT NULL DEFAULT 0,
  total_key_rotations INTEGER NOT NULL DEFAULT 0,
  total_shares_finalized INTEGER NOT NULL DEFAULT 0,
  total_shares_revoked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE analytics_daily_summary
  ADD COLUMN IF NOT EXISTS total_key_setups INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_key_rotations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_shares_finalized INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_shares_revoked INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date
  ON analytics_daily_summary(date DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_analytics_daily_summary_updated_at
  ON analytics_daily_summary;
CREATE TRIGGER update_analytics_daily_summary_updated_at
  BEFORE UPDATE ON analytics_daily_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Only aggregate bucket counts are stored. This table intentionally contains
-- no user, session, request, file, share, IP, or device identifiers.
CREATE TABLE IF NOT EXISTS analytics_daily_dimensions (
  date DATE NOT NULL,
  metric VARCHAR(64) NOT NULL CHECK (metric IN (
    'file_added_to_drive',
    'file_shared',
    'invitation_sent'
  )),
  dimension VARCHAR(32) NOT NULL CHECK (dimension IN (
    'source',
    'size_bucket',
    'file_category',
    'has_expiration',
    'has_custom_message'
  )),
  bucket VARCHAR(32) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (date, metric, dimension, bucket)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_date
  ON analytics_daily_dimensions(date DESC);

COMMIT;
