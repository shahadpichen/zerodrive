-- ZeroDrive PostgreSQL Database Schema
-- This script initializes the database with the required tables for the backend
-- docker exec -i zerodrive-postgres psql -U zerodrive_app -d zerodrive < /Users/shahad/Projects/zerodrive/apps/api/database/init.sql
-- docker exec zerodrive-postgres psql -U zerodrive_app -d zerodrive -c "SELECT * FROM <tablename>;"

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create deployments table
-- Represents this ZeroDrive installation, not a user or tenant identity.
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION zerodrive_default_deployment_id()
RETURNS UUID AS $$
DECLARE
    deployment UUID;
BEGIN
    SELECT id
      INTO deployment
      FROM deployments
     ORDER BY created_at ASC, id ASC
     LIMIT 1;

    IF deployment IS NULL THEN
        INSERT INTO deployments DEFAULT VALUES
        RETURNING id INTO deployment;
    END IF;

    RETURN deployment;
END;
$$ language 'plpgsql';

INSERT INTO deployments (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM deployments);

-- ZeroDrive currently supports one application installation per database.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_singleton
    ON deployments ((true));

-- Create public_keys table
-- Stores RSA public keys for users to enable encrypted file sharing
CREATE TABLE IF NOT EXISTS public_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    user_id VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1 CHECK (key_version > 0),
    fingerprint CHAR(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_files table  
-- Stores metadata about files shared between users
CREATE TABLE IF NOT EXISTS shared_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    file_id VARCHAR(255) NOT NULL,
    recipient_user_id VARCHAR(255) NOT NULL,
    management_capability_hash CHAR(64) CHECK (
        management_capability_hash IS NULL
        OR management_capability_hash ~ '^[0-9a-f]{64}$'
    ),
    encrypted_metadata TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'deleting')),
    expected_encrypted_size BIGINT,
    pending_expires_at TIMESTAMP WITH TIME ZONE,
    deletion_attempts INTEGER NOT NULL DEFAULT 0,
    deletion_last_error TEXT,
    content_format VARCHAR(32) NOT NULL DEFAULT 'legacy_zdse'
        CHECK (content_format IN ('legacy_zdse', 'capsule_v1')),
    recipient_key_version INTEGER CHECK (
        recipient_key_version IS NULL OR recipient_key_version > 0
    ),
    recipient_key_fingerprint CHAR(64) CHECK (
        recipient_key_fingerprint IS NULL
        OR recipient_key_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    encrypted_file_key TEXT,
    file_name VARCHAR(500),
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(200),
    access_type VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (access_type IN ('view', 'download')),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shared_files_expiry_after_creation
        CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT shared_files_expected_size_positive
        CHECK (expected_encrypted_size IS NULL OR expected_encrypted_size > 0),
    CONSTRAINT shared_files_deletion_attempts_nonnegative
        CHECK (deletion_attempts >= 0),
    CONSTRAINT shared_files_encryption_representation_check
        CHECK (
            (
                content_format = 'legacy_zdse'
                AND encrypted_file_key IS NOT NULL
            )
            OR
            (
                content_format = 'capsule_v1'
                AND encrypted_file_key IS NULL
                AND encrypted_metadata IS NOT NULL
                AND recipient_key_version IS NOT NULL
                AND recipient_key_fingerprint IS NOT NULL
            )
        )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_public_keys_user_id ON public_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_public_keys_deployment_user_id
    ON public_keys(deployment_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_keys_owner_version
    ON public_keys(user_id, key_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_keys_one_active
    ON public_keys(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_shared_files_recipient ON shared_files(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_deployment_recipient
    ON shared_files(deployment_id, recipient_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_files_file_id_unique ON shared_files(file_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_expires_at ON shared_files(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_files_management_capability_hash_unique
    ON shared_files(management_capability_hash)
    WHERE management_capability_hash IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at timestamps
DROP TRIGGER IF EXISTS update_public_keys_updated_at ON public_keys;
CREATE TRIGGER update_public_keys_updated_at
    BEFORE UPDATE ON public_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shared_files_updated_at ON shared_files;
CREATE TRIGGER update_shared_files_updated_at
    BEFORE UPDATE ON shared_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional - remove in production)
-- INSERT INTO public_keys (user_id, public_key) VALUES 
-- ('user1@example.com', 'sample-rsa-public-key-1'),
-- ('user2@example.com', 'sample-rsa-public-key-2');

-- Create analytics_daily_summary table
-- Stores anonymous daily analytics (privacy-first: no user tracking)
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    date DATE NOT NULL,
    total_logins INTEGER DEFAULT 0,
    total_new_users INTEGER DEFAULT 0,
    total_limited_scope_logins INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    total_files_added_to_drive INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_invitations INTEGER DEFAULT 0,
    total_key_setups INTEGER DEFAULT 0,
    total_key_rotations INTEGER DEFAULT 0,
    total_shares_finalized INTEGER DEFAULT 0,
    total_shares_revoked INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for date-based queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_summary_deployment_date_unique
    ON analytics_daily_summary(deployment_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_deployment_date
    ON analytics_daily_summary(deployment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(date DESC);

-- Create trigger for analytics_daily_summary
DROP TRIGGER IF EXISTS update_analytics_daily_summary_updated_at ON analytics_daily_summary;
CREATE TRIGGER update_analytics_daily_summary_updated_at
    BEFORE UPDATE ON analytics_daily_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Aggregate-only analytics dimensions. No identity, request, session, file,
-- share, IP, or device identifiers are stored.
CREATE TABLE IF NOT EXISTS analytics_daily_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    date DATE NOT NULL,
    metric VARCHAR(64) NOT NULL CHECK (metric IN ('file_added_to_drive', 'file_shared', 'invitation_sent')),
    dimension VARCHAR(32) NOT NULL CHECK (dimension IN ('source', 'size_bucket', 'file_category', 'has_expiration', 'has_custom_message')),
    bucket VARCHAR(32) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_deployment_key_unique
    ON analytics_daily_dimensions(deployment_id, date, metric, dimension, bucket);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_deployment_date
    ON analytics_daily_dimensions(deployment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_dimensions_date
    ON analytics_daily_dimensions(date DESC);

-- One-time OAuth capabilities. Only non-reversible capability hashes are
-- persisted; the encrypted capability carries its short-lived payload.
CREATE TABLE IF NOT EXISTS oauth_exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_exchanges_code_hash_unique
    ON oauth_exchanges(code_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_exchanges_deployment_code_hash_unique
    ON oauth_exchanges(deployment_id, code_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_exchanges_expiry
    ON oauth_exchanges(expires_at);

-- Privacy-safe legal acceptance records.
-- Stores only the authenticated account lookup ID and accepted document
-- versions. It is intentionally separate from file, share, and analytics data.
CREATE TABLE IF NOT EXISTS legal_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL DEFAULT zerodrive_default_deployment_id()
        REFERENCES deployments(id),
    account_lookup_id CHAR(64) NOT NULL CHECK (account_lookup_id ~ '^[0-9a-f]{64}$'),
    terms_version VARCHAR(32) NOT NULL,
    privacy_version VARCHAR(32) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptances_current_unique
    ON legal_acceptances(
        deployment_id,
        account_lookup_id,
        terms_version,
        privacy_version
    );
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_account_lookup
    ON legal_acceptances(deployment_id, account_lookup_id, accepted_at DESC);

DROP TRIGGER IF EXISTS update_legal_acceptances_updated_at ON legal_acceptances;
CREATE TRIGGER update_legal_acceptances_updated_at
    BEFORE UPDATE ON legal_acceptances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- TABLE REMOVED: user_google_tokens (Risk #35 - Zero-knowledge architecture)
-- Google OAuth tokens are kept client-side in sessionStorage
-- Backend never stores or has access to Google Drive tokens
-- This preserves the storage boundary where:
-- - Backend only handles OAuth flow and returns tokens once
-- - User's Google Drive access is never compromised even if backend is breached
--
-- See: apps/web/src/utils/authService.ts for browser token lifecycle

-- Create a view for finalized active shared files (not expired)
CREATE OR REPLACE VIEW active_shared_files AS
SELECT
    sf.*,
    true AS is_active
FROM shared_files sf
WHERE sf.status = 'active'
  AND (sf.expires_at IS NULL OR sf.expires_at > CURRENT_TIMESTAMP);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zerodrive_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zerodrive_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO zerodrive_app;
