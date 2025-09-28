-- ZeroDrive PostgreSQL Database Schema
-- This script initializes the database with the required tables for the backend

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
    owner_user_id VARCHAR(255) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_shared_files_owner ON shared_files(owner_user_id);
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