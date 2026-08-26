-- Migration: Expand the privacy-safe analytics page-bucket allowlist
-- Date: 2026-08-26
-- Reason: Add reviewed, static buckets for the new documentation pages without
-- storing raw paths, query strings, referrers, or visitor identifiers.

BEGIN;

-- Keep page analytics fail-closed: only deliberately reviewed product-page
-- buckets can be stored, and page_view remains bound to the page dimension by
-- the existing page-contract constraint.
ALTER TABLE analytics_daily_dimensions
    DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_bucket_check;
ALTER TABLE analytics_daily_dimensions
    ADD CONSTRAINT analytics_daily_dimensions_page_bucket_check CHECK (
        dimension <> 'page'
        OR (
            metric = 'page_view'
            AND bucket IN (
                'landing', 'home', 'storage', 'share', 'shared_with_me',
                'recovery_access', 'docs', 'docs_how_it_works',
                'docs_how_to_use', 'docs_keys_and_recovery',
                'docs_secure_sharing', 'docs_privacy_model',
                'docs_security_model', 'docs_if_zerodrive_disappears',
                'docs_self_hosting', 'docs_google_permissions',
                'docs_recovery_access_setup', 'docs_first_upload',
                'docs_using_storage', 'docs_upload_queue',
                'docs_previews_downloads', 'docs_files_folders_delete',
                'docs_create_sharing_identity', 'docs_share_file',
                'docs_shared_with_me', 'docs_another_device',
                'docs_analytics_privacy', 'docs_common_problems',
                'docs_drive_permission_problems',
                'docs_production_deployment', 'privacy', 'terms'
            )
        )
    );

ALTER TABLE analytics_monthly_dimensions
    DROP CONSTRAINT IF EXISTS analytics_monthly_dimensions_page_bucket_check;
ALTER TABLE analytics_monthly_dimensions
    ADD CONSTRAINT analytics_monthly_dimensions_page_bucket_check CHECK (
        dimension <> 'page'
        OR (
            metric = 'page_view'
            AND bucket IN (
                'landing', 'home', 'storage', 'share', 'shared_with_me',
                'recovery_access', 'docs', 'docs_how_it_works',
                'docs_how_to_use', 'docs_keys_and_recovery',
                'docs_secure_sharing', 'docs_privacy_model',
                'docs_security_model', 'docs_if_zerodrive_disappears',
                'docs_self_hosting', 'docs_google_permissions',
                'docs_recovery_access_setup', 'docs_first_upload',
                'docs_using_storage', 'docs_upload_queue',
                'docs_previews_downloads', 'docs_files_folders_delete',
                'docs_create_sharing_identity', 'docs_share_file',
                'docs_shared_with_me', 'docs_another_device',
                'docs_analytics_privacy', 'docs_common_problems',
                'docs_drive_permission_problems',
                'docs_production_deployment', 'privacy', 'terms'
            )
        )
    );

COMMIT;

-- Rollback (non-destructive; requires explicit operator approval):
-- The guard aborts rollback if daily or monthly aggregates already use a new
-- bucket. Export, retain, or deliberately remap those aggregates before retrying;
-- this rollback never deletes analytics data automatically.
-- BEGIN;
-- DO $$
-- BEGIN
--     IF EXISTS (
--         SELECT 1
--         FROM analytics_daily_dimensions
--         WHERE metric = 'page_view'
--           AND dimension = 'page'
--           AND bucket IN (
--               'docs_google_permissions', 'docs_recovery_access_setup',
--               'docs_first_upload', 'docs_using_storage', 'docs_upload_queue',
--               'docs_previews_downloads', 'docs_files_folders_delete',
--               'docs_create_sharing_identity', 'docs_share_file',
--               'docs_shared_with_me', 'docs_another_device',
--               'docs_analytics_privacy', 'docs_common_problems',
--               'docs_drive_permission_problems', 'docs_production_deployment'
--           )
--     ) OR EXISTS (
--         SELECT 1
--         FROM analytics_monthly_dimensions
--         WHERE metric = 'page_view'
--           AND dimension = 'page'
--           AND bucket IN (
--               'docs_google_permissions', 'docs_recovery_access_setup',
--               'docs_first_upload', 'docs_using_storage', 'docs_upload_queue',
--               'docs_previews_downloads', 'docs_files_folders_delete',
--               'docs_create_sharing_identity', 'docs_share_file',
--               'docs_shared_with_me', 'docs_another_device',
--               'docs_analytics_privacy', 'docs_common_problems',
--               'docs_drive_permission_problems', 'docs_production_deployment'
--           )
--     ) THEN
--         RAISE EXCEPTION
--             'Rollback blocked: analytics rows use documentation buckets added by migration 016';
--     END IF;
-- END
-- $$;
-- ALTER TABLE analytics_daily_dimensions
--     DROP CONSTRAINT IF EXISTS analytics_daily_dimensions_page_bucket_check;
-- ALTER TABLE analytics_daily_dimensions
--     ADD CONSTRAINT analytics_daily_dimensions_page_bucket_check CHECK (
--         dimension <> 'page'
--         OR (
--             metric = 'page_view'
--             AND bucket IN (
--                 'landing', 'home', 'storage', 'share', 'shared_with_me',
--                 'recovery_access', 'docs', 'docs_how_it_works',
--                 'docs_how_to_use', 'docs_keys_and_recovery',
--                 'docs_secure_sharing', 'docs_privacy_model',
--                 'docs_security_model', 'docs_if_zerodrive_disappears',
--                 'docs_self_hosting', 'privacy', 'terms'
--             )
--         )
--     );
-- ALTER TABLE analytics_monthly_dimensions
--     DROP CONSTRAINT IF EXISTS analytics_monthly_dimensions_page_bucket_check;
-- ALTER TABLE analytics_monthly_dimensions
--     ADD CONSTRAINT analytics_monthly_dimensions_page_bucket_check CHECK (
--         dimension <> 'page'
--         OR (
--             metric = 'page_view'
--             AND bucket IN (
--                 'landing', 'home', 'storage', 'share', 'shared_with_me',
--                 'recovery_access', 'docs', 'docs_how_it_works',
--                 'docs_how_to_use', 'docs_keys_and_recovery',
--                 'docs_secure_sharing', 'docs_privacy_model',
--                 'docs_security_model', 'docs_if_zerodrive_disappears',
--                 'docs_self_hosting', 'privacy', 'terms'
--             )
--         )
--     );
-- COMMIT;
