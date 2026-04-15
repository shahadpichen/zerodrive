# ZeroDrive Backend API

A TypeScript-based backend for ZeroDrive, replacing Supabase with a self-hosted solution using PostgreSQL and Express.js.

## Features

- **End-to-end encrypted file sharing**: Store RSA public keys and encrypted file keys
- **PostgreSQL database**: Self-hosted replacement for Supabase
- **TypeScript**: Full type safety with strict compilation
- **Docker support**: Easy local development with PostgreSQL container
- **RESTful API**: Clean HTTP endpoints for frontend integration
- **Request logging**: Comprehensive logging for debugging
- **Error handling**: Centralized error handling with proper HTTP status codes
- **CORS support**: Configurable CORS for frontend integration

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- Git

### Installation

1. **Clone and navigate to backend:**
   ```bash
   cd /Users/shahad/Projects/zerodrive/backend
   npm install
   ```

2. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env if needed (default values work for local development)
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

### Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server (requires build first)
- `npm run typecheck` - Check TypeScript compilation without emitting files
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run docker:up` - Start all Docker services
- `npm run docker:down` - Stop all Docker services
- `npm run docker:logs` - View Docker container logs

## API Endpoints

### Health Check
- `GET /` - API information and status
- `GET /api/health` - Health check endpoint

### Public Keys
- `POST /api/public-keys` - Store or update user's public key
- `GET /api/public-keys/:user_id` - Get user's public key
- `GET /api/public-keys` - List all public keys (debugging)
- `DELETE /api/public-keys/:user_id` - Delete user's public key

### Shared Files
- `POST /api/shared-files` - Share a file with another user
- `GET /api/shared-files` - Get shared files (with query filters)
- `GET /api/shared-files/:id` - Get specific shared file
- `PUT /api/shared-files/:id` - Update shared file permissions
- `DELETE /api/shared-files/:id` - Revoke file sharing
- `POST /api/shared-files/:id/access` - Record file access

## API Usage Examples

### Store a Public Key
```bash
curl -X POST http://localhost:3001/api/public-keys \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user@example.com",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0..."
  }'
```

### Get a Public Key
```bash
curl http://localhost:3001/api/public-keys/user@example.com
```

### Share a File
```bash
curl -X POST http://localhost:3001/api/shared-files \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "google-drive-file-id",
    "owner_user_id": "owner@example.com",
    "recipient_user_id": "recipient@example.com",
    "encrypted_file_key": "base64-encrypted-key",
    "file_name": "document.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "access_type": "view"
  }'
```

## Database Schema

The database uses PostgreSQL with the following tables:

### `public_keys`
- `id` (UUID, Primary Key)
- `user_id` (VARCHAR, Unique) - User identifier (email)
- `public_key` (TEXT) - RSA public key in PEM format
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `shared_files`
- `id` (UUID, Primary Key)
- `file_id` (VARCHAR) - Google Drive file ID
- `owner_user_id` (VARCHAR) - File owner's user ID
- `recipient_user_id` (VARCHAR) - Recipient's user ID
- `encrypted_file_key` (TEXT) - AES key encrypted with recipient's public key
- `file_name` (VARCHAR) - Original file name
- `file_size` (BIGINT) - File size in bytes
- `mime_type` (VARCHAR) - File MIME type
- `access_type` (VARCHAR) - 'view' or 'download'
- `expires_at` (TIMESTAMP, Optional) - Expiration date
- `last_accessed_at` (TIMESTAMP, Optional) - Last access time
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | Server port |
| `HOST` | `localhost` | Server host |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5433` | PostgreSQL port |
| `DB_NAME` | `zerodrive` | Database name |
| `DB_USER` | `zerodrive_app` | Database user |
| `DB_PASSWORD` | `localdev123` | Database password |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | CORS allowed origins |
| `LOG_LEVEL` | `debug` | Logging level |

## Docker Configuration

The `docker-compose.yml` includes:

- **PostgreSQL 15**: Main database with persistent volume
- **MinIO**: S3-compatible object storage (optional)
- **pgAdmin**: Database administration UI (optional)

Services are accessible at:
- PostgreSQL: `localhost:5433`
- MinIO: `localhost:9000` (API), `localhost:9001` (UI)
- pgAdmin: `localhost:5050`

## Frontend Integration

The backend works with the updated `app/src/utils/apiClient.ts` which provides:

```typescript
import apiClient from './utils/apiClient';

// Store public key
await apiClient.publicKeys.upsert('user@example.com', publicKeyPem);

// Get public key
const result = await apiClient.publicKeys.get('user@example.com');

// Share file
await apiClient.sharedFiles.create({
  file_id: 'google-drive-id',
  owner_user_id: 'owner@example.com',
  recipient_user_id: 'recipient@example.com',
  encrypted_file_key: 'encrypted-key',
  file_name: 'document.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf'
});
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  Express API    │    │  PostgreSQL     │
│   (Frontend)    │◄──►│  (Backend)      │◄──►│  (Database)     │
│                 │    │                 │    │                 │
│ - File upload   │    │ - Public keys   │    │ - public_keys   │
│ - Encryption    │    │ - Shared files  │    │ - shared_files  │
│ - Key exchange  │    │ - CORS handling │    │ - Triggers      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────►│  Google Drive   │
                         │  (File Storage) │
                         └─────────────────┘
```

## Security Features

- **Input validation**: Joi validation for all endpoints
- **Error handling**: Sanitized error responses
- **CORS protection**: Configurable allowed origins
- **Rate limiting**: Request rate limiting per IP
- **SQL injection protection**: Parameterized queries only
- **Type safety**: Full TypeScript coverage

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# View container logs
docker logs zerodrive-postgres

# Reset database (deletes all data)
docker-compose down
docker volume rm zerodrive_postgres_data
docker-compose up -d postgres
```

### Port Conflicts
```bash
# Kill processes using port 3001
lsof -ti:3001 | xargs kill -9

# Kill processes using port 5433
lsof -ti:5433 | xargs kill -9
```

### TypeScript Errors
```bash
# Check compilation
npm run typecheck

# Clean build
npm run clean && npm run build
```

## Migration from Supabase

This backend replaces the following Supabase features:

| Supabase Feature | Backend Equivalent |
|------------------|-------------------|
| `supabase.from('public_keys')` | `POST/GET /api/public-keys` |
| `supabase.from('shared_files')` | `POST/GET /api/shared-files` |
| Real-time subscriptions | Not implemented (can add WebSocket support) |
| Authentication | Handled by frontend (BIP39 mnemonics) |
| Storage | Google Drive API (existing) |

## Next Steps

- [ ] Add WebSocket support for real-time updates
- [ ] Implement file cleanup for expired shares
- [ ] Add comprehensive test suite
- [ ] Set up production deployment scripts
- [ ] Add monitoring and metrics
- [ ] Implement backup strategies