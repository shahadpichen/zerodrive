BEGIN;

-- Legacy rows stored filenames and MIME types in plaintext. They cannot be
-- encrypted server-side because the backend never possesses the file key.
-- Purging them prioritizes the documented database-dump privacy guarantee;
-- legacy downloads remain available with a generic filename/type.
UPDATE shared_files
SET file_name = NULL,
    mime_type = NULL
WHERE file_name IS NOT NULL
   OR mime_type IS NOT NULL;

COMMIT;
