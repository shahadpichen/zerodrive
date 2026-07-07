CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Frozen schema from develop before the secure-sharing migrations. Do not
-- update this fixture when the current init.sql changes.
CREATE TABLE public_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shared_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id VARCHAR(255) NOT NULL,
  recipient_user_id VARCHAR(255) NOT NULL,
  encrypted_file_key TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  access_type VARCHAR(20) NOT NULL DEFAULT 'view'
    CHECK (access_type IN ('view', 'download')),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_public_keys_user_id ON public_keys(user_id);
CREATE INDEX idx_shared_files_recipient ON shared_files(recipient_user_id);
CREATE INDEX idx_shared_files_file_id ON shared_files(file_id);
CREATE INDEX idx_shared_files_expires_at ON shared_files(expires_at);
