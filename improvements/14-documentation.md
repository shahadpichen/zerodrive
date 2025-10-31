# Documentation Improvements

## Current Issues

- README outdated
- No API documentation
- No architecture diagrams
- No contribution guidelines
- No security disclosure policy

---

## Improvements

### **P1: Update README**
```markdown
# ZeroDrive

End-to-end encrypted file storage using Google Drive as backend.

## Features

- 🔒 Zero-knowledge encryption
- 📁 Uses your Google Drive storage
- 🔄 Secure file sharing
- 🌐 Open source
- 💰 Free forever

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- MinIO (or S3-compatible storage)
- Mailgun account (for emails)

### Backend Setup

1. Clone repository:
   ```bash
   git clone https://github.com/shahadpichen/zerodrive.git
   cd zerodrive/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. Setup database:
   ```bash
   createdb zerodrive
   npm run migrate
   ```

5. Start server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to frontend:
   ```bash
   cd ../app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment:
   ```bash
   cp .env.example .env.local
   # Add your Google OAuth credentials
   ```

4. Start development server:
   ```bash
   npm start
   ```

5. Open http://localhost:3000

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/zerodrive

# MinIO/S3
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Mailgun
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
MAILGUN_FROM_EMAIL=notifications@your_domain

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env.local)
```env
REACT_APP_PUBLIC_CLIENT_ID=your_google_oauth_client_id
REACT_APP_PUBLIC_SCOPE=https://www.googleapis.com/auth/drive.appdata email profile
REACT_APP_API_URL=http://localhost:3001/api
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for security policy.

## License

MIT License - see [LICENSE](./LICENSE)

## Support

- Documentation: https://docs.zerodrive.com
- Issues: https://github.com/shahadpichen/zerodrive/issues
- Discord: https://discord.gg/zerodrive
```

---

### **P1: Create API documentation**

Use Swagger/OpenAPI:

```typescript
// backend/src/swagger.ts
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ZeroDrive API',
      version: '1.0.0',
      description: 'End-to-end encrypted file storage API',
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
```

**Document each endpoint:**

```typescript
/**
 * @swagger
 * /shared-files:
 *   post:
 *     summary: Share a file with another user
 *     tags: [Shares]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_id:
 *                 type: string
 *               recipient_user_id:
 *                 type: string
 *               encrypted_file_key:
 *                 type: string
 *     responses:
 *       201:
 *         description: File shared successfully
 *       400:
 *         description: Invalid request
 */
router.post('/', asyncHandler(createShare));
```

---

### **P2: Create architecture diagrams**

**ARCHITECTURE.md:**

```markdown
# ZeroDrive Architecture

## System Overview

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐       ┌──────────────┐
│   Backend   │──────▶│  PostgreSQL  │
│  (Node.js)  │       │  (Metadata)  │
└──────┬──────┘       └──────────────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────────┐
│   MinIO     │  │   Mailgun    │
│  (Storage)  │  │   (Email)    │
└─────────────┘  └──────────────┘
```

## Data Flow

### File Upload
1. User selects file in browser
2. File encrypted locally with AES-256
3. Encrypted file uploaded to MinIO via pre-signed URL
4. Metadata stored in PostgreSQL
5. IndexedDB updated locally

### File Sharing
1. Sender encrypts file key with recipient's RSA public key
2. Share record created in PostgreSQL
3. Email notification sent via Mailgun
4. Recipient downloads encrypted file from MinIO
5. Recipient decrypts file key with their RSA private key
6. Recipient decrypts file with decrypted file key

## Security Architecture

### Encryption Layers

1. **File Encryption (AES-256-GCM)**
   - Files encrypted in browser
   - Unique key per file
   - Key derived from user's mnemonic

2. **Key Encryption (RSA-OAEP-256)**
   - File keys encrypted for sharing
   - Each user has RSA keypair
   - Private key encrypted with user's master key

3. **Master Key (PBKDF2)**
   - Derived from mnemonic phrase
   - Never leaves browser
   - Used to encrypt/decrypt file keys

### Zero-Knowledge Design

- Server never sees:
  - File contents (encrypted before upload)
  - Encryption keys (encrypted at rest)
  - Mnemonic phrases (never transmitted)

- Server only stores:
  - Encrypted files (in MinIO)
  - Encrypted file keys (in PostgreSQL)
  - Public keys (for sharing)
```

---

### **P2: Create CONTRIBUTING.md**

```markdown
# Contributing to ZeroDrive

## Code of Conduct

Be respectful, inclusive, and professional.

## How to Contribute

1. **Fork the repository**
2. **Create a branch**: `git checkout -b feature/your-feature`
3. **Make changes**
4. **Write tests**
5. **Run tests**: `npm test`
6. **Commit**: `git commit -m "Add feature"`
7. **Push**: `git push origin feature/your-feature`
8. **Create Pull Request**

## Development Setup

See [README.md](./README.md#quick-start)

## Code Style

- TypeScript for all new code
- ESLint rules enforced
- Prettier for formatting
- Run `npm run lint` before committing

## Commit Messages

Format: `type: description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
- `feat: add file preview modal`
- `fix: resolve memory leak in encryption worker`
- `docs: update API documentation`

## Pull Request Process

1. Update README if adding features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Testing

- Unit tests: `npm test`
- E2E tests: `npm run test:e2e`
- Coverage: `npm run test:coverage`

## Questions?

Open an issue or ask in Discord.
```

---

### **P2: Create SECURITY.md**

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue.

Instead:

1. Email: security@zerodrive.com
2. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Time

- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix timeline: Depends on severity

## Disclosure Policy

- We follow coordinated disclosure
- Public disclosure after fix is released
- Credit given to reporter (if desired)

## Security Features

- End-to-end encryption (AES-256-GCM)
- Zero-knowledge architecture
- RSA-OAEP-256 for key exchange
- Server-side email hashing
- CSP headers enabled
- Rate limiting on API endpoints

## Bug Bounty

We currently do not have a bug bounty program.

## Security Best Practices for Users

1. **Backup your mnemonic phrase**
2. **Use strong unique password for Google account**
3. **Enable 2FA on Google account**
4. **Don't share your mnemonic with anyone**
5. **Use latest browser version**
```

---

## Files to Create

- `README.md` - Updated main readme
- `ARCHITECTURE.md` - System design docs
- `CONTRIBUTING.md` - Contribution guidelines
- `SECURITY.md` - Security policy
- `CHANGELOG.md` - Version history
- `docs/` - Detailed documentation folder
  - `docs/api.md` - API reference
  - `docs/encryption.md` - Encryption details
  - `docs/deployment.md` - Deployment guide
  - `docs/troubleshooting.md` - Common issues

---

## Testing Checklist

- [ ] README has correct setup steps
- [ ] API docs accessible at /api-docs
- [ ] Architecture diagrams accurate
- [ ] CONTRIBUTING guidelines clear
- [ ] SECURITY policy complete
- [ ] All links work
- [ ] Code examples tested
