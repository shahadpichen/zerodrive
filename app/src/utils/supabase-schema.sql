-- Create table for storing user public keys with hashed email identifiers
CREATE TABLE user_public_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hashed_email_identifier TEXT UNIQUE NOT NULL,
    public_key_jwk JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the updated_at trigger to the table
CREATE TRIGGER update_user_public_keys_updated_at
BEFORE UPDATE ON user_public_keys
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create index for faster lookups by hashed email
CREATE INDEX idx_hashed_email_identifier ON user_public_keys(hashed_email_identifier);

-- Create table for storing shared file metadata
CREATE TABLE shared_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id TEXT UNIQUE NOT NULL,
    encrypted_file_blob_id TEXT NOT NULL, -- Reference to the actual encrypted file blob
    recipient_email_hash TEXT NOT NULL,
    encrypted_file_key BYTEA NOT NULL, -- The file key encrypted for the recipient
    sender_proof TEXT NOT NULL, -- Cryptographic proof of sender's identity
    file_name TEXT NOT NULL,
    file_mime_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration time
    is_claimed BOOLEAN DEFAULT false NOT NULL, -- Flag to indicate if recipient has claimed the file
    file_content TEXT,
    file_size INTEGER
);

-- Apply the updated_at trigger to the shared_files table
CREATE TRIGGER update_shared_files_updated_at
BEFORE UPDATE ON shared_files
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create index for faster lookups by recipient
CREATE INDEX idx_recipient_email_hash ON shared_files(recipient_email_hash);

-- Enable Row Level Security
ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;

-- Create policies for user_public_keys table
-- Allow reading any public key (public keys are meant to be public)
CREATE POLICY "Anyone can read public keys" ON user_public_keys 
    FOR SELECT USING (true);

-- Drop the existing insert policy for user_public_keys
DROP POLICY IF EXISTS "Users can insert their own public keys" ON user_public_keys;

-- Create a temporarily permissive insert policy (FOR DEBUGGING ONLY)
CREATE POLICY "Allow all inserts to user_public_keys for debugging"
ON user_public_keys
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own public keys" ON user_public_keys
    FOR UPDATE USING (true) -- Modify with your auth check
    WITH CHECK (true);      -- Modify with your auth check

-- Create policies for shared_files table
-- Allow users to see files shared with them (based on email hash)
CREATE POLICY "Users can see files shared with them" ON shared_files
    FOR SELECT USING (true); -- Modify with your auth check

-- Allow users to create file shares
-- DROP POLICY IF EXISTS "Users can create file shares" ON shared_files;
DROP POLICY IF EXISTS "Users can create file shares" ON shared_files;

-- Create a permissive policy (for testing only)
CREATE POLICY "Allow all inserts to shared_files" ON shared_files
  FOR INSERT WITH CHECK (true);

-- Allow users to update file shares they created
CREATE POLICY "Users can update their shares" ON shared_files
    FOR UPDATE USING (true) -- Modify with your auth check
    WITH CHECK (true);      -- Modify with your auth check

-- Allow users to delete their shares
CREATE POLICY "Users can delete their shares" ON shared_files
    FOR DELETE USING (true); -- Modify with your auth check

-- Note: For a proper production system, you should fine-tune the RLS policies
-- based on your specific application needs and authentication system.

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;

CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT WITH CHECK (true);

-- Drop the existing restrictive download policy
DROP POLICY IF EXISTS "Allow downloads" ON storage.objects;

-- Create a permissive download policy for testing
CREATE POLICY "Allow downloads" ON storage.objects
  FOR SELECT USING (true);