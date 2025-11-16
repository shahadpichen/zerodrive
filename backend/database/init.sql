-- ZeroDrive PostgreSQL Database Schema
-- This script initializes the database with the required tables for the backend
-- docker exec -i zerodrive-postgres psql -U zerodrive_app -d zerodrive < /Users/shahad/Projects/zerodrive/backend/database/init.sql
-- docker exec zerodrive-postgres psql -U zerodrive_app -d zerodrive -c "SELECT * FROM <tablename>;"

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create public_keys table
-- Stores RSA public keys for users to enable encrypted file sharing
CREATE TABLE IF NOT EXISTS public_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_files table  
-- Stores metadata about files shared between users
CREATE TABLE IF NOT EXISTS shared_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id VARCHAR(255) NOT NULL,
    recipient_user_id VARCHAR(255) NOT NULL,
    encrypted_file_key TEXT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    access_type VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (access_type IN ('view', 'download')),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_public_keys_user_id ON public_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_recipient ON shared_files(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_file_id ON shared_files(file_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_expires_at ON shared_files(expires_at);

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
    date DATE PRIMARY KEY,
    total_logins INTEGER DEFAULT 0,
    total_new_users INTEGER DEFAULT 0,
    total_limited_scope_logins INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    total_files_added_to_drive INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_invitations INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(date DESC);

-- Create trigger for analytics_daily_summary
DROP TRIGGER IF EXISTS update_analytics_daily_summary_updated_at ON analytics_daily_summary;
CREATE TRIGGER update_analytics_daily_summary_updated_at
    BEFORE UPDATE ON analytics_daily_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- TABLE REMOVED: user_google_tokens (Risk #35 - Zero-knowledge architecture)
-- Google OAuth tokens are now encrypted client-side with PBKDF2 and stored in sessionStorage
-- Backend never stores or has access to Google Drive tokens
-- This implements true zero-knowledge encryption where:
-- - Frontend encrypts tokens with mnemonic-derived key
-- - Backend only handles OAuth flow and returns tokens once
-- - User's Google Drive access is never compromised even if backend is breached
--
-- See: app/src/utils/authService.ts for encrypted storage implementation
-- See: app/src/utils/cryptoUtils.ts for PBKDF2 encryption functions

-- Create a view for active shared files (not expired)
CREATE OR REPLACE VIEW active_shared_files AS
SELECT
    sf.*,
    CASE
        WHEN sf.expires_at IS NULL THEN true
        WHEN sf.expires_at > CURRENT_TIMESTAMP THEN true
        ELSE false
    END as is_active
FROM shared_files sf
WHERE (sf.expires_at IS NULL OR sf.expires_at > CURRENT_TIMESTAMP);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zerodrive_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zerodrive_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO zerodrive_app;