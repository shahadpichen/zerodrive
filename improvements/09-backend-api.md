# Backend API Improvements

## Current Issues

- No rate limiting on uploads
- No virus scanning
- No audit logging
- Missing API versioning
- Error messages expose internals
- No bulk operations
- No health monitoring

---

## Improvements

### **P1: Add rate limiting**
```typescript
// Rate limits per user per hour:
- File uploads: 50 files
- API requests: 1000 requests
- Invitations: 5 emails (already done ✓)
- Share operations: 100 shares
```

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'Too many uploads. Please try again later.'
});

router.post('/presigned-url/upload', uploadLimiter, uploadHandler);
```

---

### **P1: Add audit logging**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id TEXT,
  action TEXT, -- 'file.upload', 'file.share', 'key.generate'
  resource_type TEXT, -- 'file', 'share', 'key'
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  status TEXT, -- 'success', 'failure'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Log every action:**
- File uploads/downloads/deletes
- Share creation/revocation
- Key generation/access
- Login attempts
- API errors

---

### **P2: Add API versioning**
```typescript
// Current: /api/shared-files
// New:     /api/v1/shared-files

app.use('/api/v1', routerV1);
// Future: app.use('/api/v2', routerV2);
```

**Why:** Allows breaking changes without disrupting existing clients

---

### **P2: Sanitize error responses**
```typescript
// BEFORE (bad):
res.status(500).json({
  error: err.stack, // Exposes code!
  query: dbQuery    // Exposes database!
});

// AFTER (good):
if (NODE_ENV === 'production') {
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred. Please try again.'
    }
  });
} else {
  // Show details only in development
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
      stack: err.stack
    }
  });
}
```

---

### **P2: Add bulk operations**
```typescript
// POST /api/v1/shared-files/bulk
// Share multiple files with one API call

router.post('/bulk', asyncHandler(async (req, res) => {
  const { files, recipient_user_id } = req.body;

  const results = await Promise.all(
    files.map(file => shareFile(file, recipient_user_id))
  );

  res.apiSuccess(results, 'Files shared successfully');
}));

// DELETE /api/v1/shared-files/bulk
// Revoke multiple shares at once

router.delete('/bulk', asyncHandler(async (req, res) => {
  const { share_ids } = req.body;

  await Promise.all(
    share_ids.map(id => revokeShare(id))
  );

  res.apiSuccess({ deleted: share_ids.length }, 'Shares revoked');
}));
```

---

### **P2: Add health check monitoring**
```typescript
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: await checkDatabase(),
      minio: await checkMinIO(),
      mailgun: await checkMailgun(),
      redis: await checkRedis() // if using Redis
    },
    version: process.env.npm_package_version,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  const allHealthy = Object.values(health.services).every(s => s === 'healthy');

  res.status(allHealthy ? 200 : 503).json(health);
});

async function checkDatabase() {
  try {
    await query('SELECT 1');
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}
```

---

### **P3: Add virus scanning**
```typescript
import { ClamScan } from 'clamscan';

const clamscan = new ClamScan({
  clamdscan: {
    host: 'localhost',
    port: 3310
  }
});

async function scanFile(filePath: string): Promise<boolean> {
  const { isInfected } = await clamscan.isInfected(filePath);
  return !isInfected;
}

// Use before accepting upload
router.post('/upload', async (req, res) => {
  const file = req.file;
  const isSafe = await scanFile(file.path);

  if (!isSafe) {
    fs.unlinkSync(file.path); // Delete infected file
    throw ApiErrors.BadRequest('File contains malware');
  }

  // Continue with upload...
});
```

**Note:** ClamAV can scan encrypted files for patterns

---

### **P3: Add request logging**
```typescript
import morgan from 'morgan';

// Development: Detailed logs
app.use(morgan('dev'));

// Production: JSON logs
app.use(morgan(JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  timestamp: new Date().toISOString()
})));
```

---

## Files to Modify

- `backend/src/middleware/rateLimiter.ts` - Rate limiting
- `backend/src/middleware/auditLogger.ts` - Audit logging
- `backend/src/middleware/errorHandler.ts` - Sanitize errors
- `backend/src/routes/index.ts` - Add v1 prefix
- `backend/src/routes/health.ts` - Health checks
- `backend/src/services/virusScanner.ts` - Virus scanning

---

## Environment Variables

```env
# Rate limiting
RATE_LIMIT_UPLOADS=50
RATE_LIMIT_API_REQUESTS=1000

# Virus scanning
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Monitoring
HEALTH_CHECK_ENABLED=true
```

---

## Testing Checklist

- [ ] Rate limiting blocks after limit reached
- [ ] Audit logs record all actions
- [ ] API v1 endpoints work
- [ ] Error responses don't expose internals
- [ ] Bulk operations work correctly
- [ ] Health check shows accurate status
- [ ] Virus scanning detects test malware
- [ ] Request logging writes to files
