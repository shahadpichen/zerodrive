BEGIN;

ALTER TABLE analytics_daily_summary
  ADD COLUMN IF NOT EXISTS total_key_setups INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_key_rotations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_shares_finalized INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_shares_revoked INTEGER NOT NULL DEFAULT 0;

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
