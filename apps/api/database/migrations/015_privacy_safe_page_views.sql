-- Migration: Add privacy-safe page-view counters and long-term monthly rollups
-- Date: 2026-08-26
-- Reason: Measure aggregate page attention without retaining visitors, sessions,
-- request metadata, paths, query strings, or referrers. Daily aggregates are
-- retained for exactly 400 days; older rows are rolled up by the API before
-- deletion. Monthly aggregates have no automatic expiry.

BEGIN;

-- Page views are aggregate events. The route is represented only by an
-- allowlisted product-page bucket in analytics_daily_dimensions.
ALTER TABLE analytics_daily_summary
  ADD COLUMN IF NOT EXISTS total_page_views BIGINT NOT NULL DEFAULT 0;

ALTER TABLE analytics_daily_summary
  DROP CONSTRAINT IF EXISTS analytics_daily_summary_total_page_views_nonnegative;
ALTER TABLE analytics_daily_summary
  ADD CONSTRAINT analytics_daily_summary_total_page_views_nonnegative
  CHECK (total_page_views >= 0);

-- Replace the original analytics contract checks with the expanded contract.
-- Existing rows remain valid because the original values are a subset.
ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_metric_check;
ALTER TABLE analytics_daily_dimensions
  ADD CONSTRAINT analytics_daily_dimensions_metric_check
  CHECK (metric IN (
    'file_added_to_drive',
    'file_shared',
    'invitation_sent',
    'page_view'
  ));

ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_dimension_check;
ALTER TABLE analytics_daily_dimensions
  ADD CONSTRAINT analytics_daily_dimensions_dimension_check
  CHECK (dimension IN (
    'source',
    'size_bucket',
    'file_category',
    'has_expiration',
    'has_custom_message',
    'page'
  ));

-- Fail closed if a page-view producer attempts to persist a raw path or a new
-- page that has not been deliberately reviewed. No dynamic URL is accepted.
ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_bucket_check;
ALTER TABLE analytics_daily_dimensions
  ADD CONSTRAINT analytics_daily_dimensions_page_bucket_check
  CHECK (
    dimension <> 'page'
    OR (
      metric = 'page_view'
      AND bucket IN (
        'landing',
        'home',
        'storage',
        'share',
        'shared_with_me',
        'recovery_access',
        'docs',
        'docs_how_it_works',
        'docs_how_to_use',
        'docs_keys_and_recovery',
        'docs_secure_sharing',
        'docs_privacy_model',
        'docs_security_model',
        'docs_if_zerodrive_disappears',
        'docs_self_hosting',
        'privacy',
        'terms'
      )
    )
  );

-- Prevent other metrics from using the page dimension and keep page_view from
-- carrying any dimension other than the reviewed page bucket.
ALTER TABLE analytics_daily_dimensions
  DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_contract_check;
ALTER TABLE analytics_daily_dimensions
  ADD CONSTRAINT analytics_daily_dimensions_page_contract_check
  CHECK (
    (metric = 'page_view' AND dimension = 'page')
    OR (metric <> 'page_view' AND dimension <> 'page')
  );

-- Long-term totals. A month is represented by its first calendar day. These
-- tables contain counts only and intentionally have no user, request, session,
-- file, share, IP, device, URL, query, or referrer identifiers.
CREATE TABLE IF NOT EXISTS analytics_monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
    REFERENCES deployments(id),
  month DATE NOT NULL,
  total_logins BIGINT NOT NULL DEFAULT 0,
  total_new_users BIGINT NOT NULL DEFAULT 0,
  total_limited_scope_logins BIGINT NOT NULL DEFAULT 0,
  total_downloads BIGINT NOT NULL DEFAULT 0,
  total_files_added_to_drive BIGINT NOT NULL DEFAULT 0,
  total_shares BIGINT NOT NULL DEFAULT 0,
  total_invitations BIGINT NOT NULL DEFAULT 0,
  total_key_setups BIGINT NOT NULL DEFAULT 0,
  total_key_rotations BIGINT NOT NULL DEFAULT 0,
  total_shares_finalized BIGINT NOT NULL DEFAULT 0,
  total_shares_revoked BIGINT NOT NULL DEFAULT 0,
  total_page_views BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT analytics_monthly_summary_month_start_check
    CHECK (EXTRACT(DAY FROM month) = 1),
  CONSTRAINT analytics_monthly_summary_counts_nonnegative CHECK (
    total_logins >= 0
    AND total_new_users >= 0
    AND total_limited_scope_logins >= 0
    AND total_downloads >= 0
    AND total_files_added_to_drive >= 0
    AND total_shares >= 0
    AND total_invitations >= 0
    AND total_key_setups >= 0
    AND total_key_rotations >= 0
    AND total_shares_finalized >= 0
    AND total_shares_revoked >= 0
    AND total_page_views >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_monthly_summary_deployment_month_unique
  ON analytics_monthly_summary(deployment_id, month);
CREATE INDEX IF NOT EXISTS idx_analytics_monthly_summary_deployment_month
  ON analytics_monthly_summary(deployment_id, month DESC);

DROP TRIGGER IF EXISTS update_analytics_monthly_summary_updated_at
  ON analytics_monthly_summary;
CREATE TRIGGER update_analytics_monthly_summary_updated_at
  BEFORE UPDATE ON analytics_monthly_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS analytics_monthly_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
    REFERENCES deployments(id),
  month DATE NOT NULL,
  metric VARCHAR(64) NOT NULL,
  dimension VARCHAR(32) NOT NULL,
  bucket VARCHAR(32) NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT analytics_monthly_dimensions_month_start_check
    CHECK (EXTRACT(DAY FROM month) = 1),
  CONSTRAINT analytics_monthly_dimensions_metric_check CHECK (metric IN (
    'file_added_to_drive',
    'file_shared',
    'invitation_sent',
    'page_view'
  )),
  CONSTRAINT analytics_monthly_dimensions_dimension_check CHECK (dimension IN (
    'source',
    'size_bucket',
    'file_category',
    'has_expiration',
    'has_custom_message',
    'page'
  )),
  CONSTRAINT analytics_monthly_dimensions_page_bucket_check CHECK (
    dimension <> 'page'
    OR (
      metric = 'page_view'
      AND bucket IN (
        'landing',
        'home',
        'storage',
        'share',
        'shared_with_me',
        'recovery_access',
        'docs',
        'docs_how_it_works',
        'docs_how_to_use',
        'docs_keys_and_recovery',
        'docs_secure_sharing',
        'docs_privacy_model',
        'docs_security_model',
        'docs_if_zerodrive_disappears',
        'docs_self_hosting',
        'privacy',
        'terms'
      )
    )
  ),
  CONSTRAINT analytics_monthly_dimensions_page_contract_check CHECK (
    (metric = 'page_view' AND dimension = 'page')
    OR (metric <> 'page_view' AND dimension <> 'page')
  ),
  CONSTRAINT analytics_monthly_dimensions_count_nonnegative CHECK (count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_monthly_dimensions_deployment_key_unique
  ON analytics_monthly_dimensions(
    deployment_id,
    month,
    metric,
    dimension,
    bucket
  );
CREATE INDEX IF NOT EXISTS idx_analytics_monthly_dimensions_deployment_month
  ON analytics_monthly_dimensions(deployment_id, month DESC);

DROP TRIGGER IF EXISTS update_analytics_monthly_dimensions_updated_at
  ON analytics_monthly_dimensions;
CREATE TRIGGER update_analytics_monthly_dimensions_updated_at
  BEFORE UPDATE ON analytics_monthly_dimensions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Rollback (destructive; requires explicit operator approval):
-- WARNING: This deletes all long-term monthly analytics and removes page-view
-- counters. Do not run after page analytics has entered production unless that
-- history is intentionally being discarded.
-- BEGIN;
-- DROP TABLE IF EXISTS analytics_monthly_dimensions;
-- DROP TABLE IF EXISTS analytics_monthly_summary;
-- ALTER TABLE analytics_daily_dimensions
--   DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_contract_check,
--   DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_bucket_check,
--   DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_metric_check,
--   DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_dimension_check;
-- ALTER TABLE analytics_daily_dimensions
--   ADD CONSTRAINT analytics_daily_dimensions_metric_check CHECK (metric IN (
--     'file_added_to_drive', 'file_shared', 'invitation_sent'
--   )),
--   ADD CONSTRAINT analytics_daily_dimensions_dimension_check CHECK (dimension IN (
--     'source', 'size_bucket', 'file_category', 'has_expiration', 'has_custom_message'
--   ));
-- ALTER TABLE analytics_daily_summary
--   DROP CONSTRAINT IF EXISTS analytics_daily_summary_total_page_views_nonnegative,
--   DROP COLUMN IF EXISTS total_page_views;
-- COMMIT;
