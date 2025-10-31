# Database Improvements

## Current Issues

- No comprehensive indexing strategy
- Missing soft deletes
- No cascading delete rules
- No backup verification
- Missing full-text search

---

## Improvements

### **P1: Add database indexes**
```sql
-- Speed up file share queries
CREATE INDEX idx_shared_files_recipient_date
ON shared_files(recipient_user_id, created_at DESC);

CREATE INDEX idx_shared_files_owner_date
ON shared_files(owner_user_id, created_at DESC);

-- Speed up expired file queries
CREATE INDEX idx_shared_files_expires
ON shared_files(expires_at)
WHERE expires_at IS NOT NULL;

-- Speed up audit log queries
CREATE INDEX idx_audit_logs_user_time
ON audit_logs(user_id, created_at DESC);

-- Speed up public key lookups
CREATE INDEX idx_public_keys_user
ON public_keys(user_id);
```

---

### **P1: Implement soft deletes**
```sql
-- Add deleted_at column to tables
ALTER TABLE shared_files ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE public_keys ADD COLUMN deleted_at TIMESTAMP NULL;

-- Create index for filtering deleted records
CREATE INDEX idx_shared_files_not_deleted
ON shared_files(id)
WHERE deleted_at IS NULL;

-- Update queries to exclude deleted
-- BEFORE:
SELECT * FROM shared_files WHERE recipient_user_id = $1;

-- AFTER:
SELECT * FROM shared_files
WHERE recipient_user_id = $1 AND deleted_at IS NULL;
```

**Why:** Allows recovery of accidentally deleted data

---

### **P2: Add foreign key constraints**
```sql
-- Ensure recipient exists in public_keys
ALTER TABLE shared_files
ADD CONSTRAINT fk_shared_files_recipient
FOREIGN KEY (recipient_user_id)
REFERENCES public_keys(user_id)
ON DELETE CASCADE;

-- Ensure owner exists
ALTER TABLE shared_files
ADD CONSTRAINT fk_shared_files_owner
FOREIGN KEY (owner_user_id)
REFERENCES public_keys(user_id)
ON DELETE CASCADE;

-- Clean up shares when public key deleted
-- Automatically handled by ON DELETE CASCADE
```

---

### **P2: Add full-text search**
```sql
-- Add search vector column
ALTER TABLE shared_files
ADD COLUMN search_vector tsvector;

-- Create trigger to auto-update search vector
CREATE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', COALESCE(NEW.file_name, '')) ||
    to_tsvector('english', COALESCE(NEW.mime_type, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER shared_files_search_update
BEFORE INSERT OR UPDATE ON shared_files
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

-- Create GIN index for fast searching
CREATE INDEX idx_shared_files_search
ON shared_files USING gin(search_vector);

-- Query usage:
SELECT * FROM shared_files
WHERE search_vector @@ to_tsquery('english', 'report & pdf')
AND deleted_at IS NULL;
```

---

### **P2: Add database backup verification**
```bash
#!/bin/bash
# scripts/verify-backup.sh

# Run daily via cron: 0 2 * * * /path/to/verify-backup.sh

BACKUP_DIR="/backups/postgresql"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.dump | head -1)

# Restore to test database
pg_restore -d zerodrive_test $LATEST_BACKUP

if [ $? -eq 0 ]; then
  echo "✓ Backup verified successfully"
  # Send success notification
else
  echo "✗ Backup verification failed"
  # Send alert email
  mail -s "Backup Verification Failed" admin@zerodrive.com <<< "Latest backup is corrupted!"
fi

# Cleanup test database
dropdb zerodrive_test
```

---

### **P3: Add database migrations system**
```typescript
// Use a migration tool like node-pg-migrate

// migrations/1234567890123_add_soft_deletes.js
exports.up = (pgm) => {
  pgm.addColumn('shared_files', {
    deleted_at: {
      type: 'timestamp',
      notNull: false,
    },
  });

  pgm.createIndex('shared_files', 'id', {
    where: 'deleted_at IS NULL',
    name: 'idx_shared_files_not_deleted',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('shared_files', 'id', {
    name: 'idx_shared_files_not_deleted',
  });

  pgm.dropColumn('shared_files', 'deleted_at');
};
```

---

### **P3: Add database query monitoring**
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

---

### **P3: Add connection pooling**
```typescript
// config/database.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Monitor pool
pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

pool.on('connect', () => {
  logger.info('New database connection established');
});
```

---

## New Tables

### Audit Logs (if not exists)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

### Email Preferences
```sql
CREATE TABLE email_preferences (
  user_id TEXT PRIMARY KEY,
  file_shares BOOLEAN DEFAULT TRUE,
  security_alerts BOOLEAN DEFAULT TRUE,
  frequency TEXT DEFAULT 'instant',
  unsubscribed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Backup Strategy

### Daily Automated Backups
```bash
# /etc/cron.daily/backup-postgresql.sh

#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/backups/postgresql"
DB_NAME="zerodrive"

# Create backup
pg_dump -Fc $DB_NAME > $BACKUP_DIR/zerodrive_$DATE.dump

# Compress old backups (older than 7 days)
find $BACKUP_DIR -name "*.dump" -mtime +7 -exec gzip {} \;

# Delete very old backups (older than 30 days)
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete

# Upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
aws s3 cp $BACKUP_DIR/zerodrive_$DATE.dump s3://zerodrive-backups/
```

---

## Files to Modify

- `backend/src/config/database.ts` - Connection pooling
- `backend/scripts/migrations/` - Migration files
- `backend/scripts/verify-backup.sh` - Backup verification
- `backend/scripts/backup-postgresql.sh` - Backup script

---

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zerodrive
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MAX=20

# Backups
BACKUP_DIR=/backups/postgresql
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=zerodrive-backups
```

---

## Testing Checklist

- [ ] Indexes improve query performance (use EXPLAIN ANALYZE)
- [ ] Soft deletes hide records correctly
- [ ] Foreign keys prevent orphaned records
- [ ] Cascading deletes work as expected
- [ ] Full-text search finds relevant files
- [ ] Backup script runs successfully
- [ ] Backup restoration works
- [ ] Connection pool handles concurrent requests
- [ ] Query monitoring identifies slow queries
- [ ] Migrations run forward and backward
