# ZeroDrive Development Setup

Complete setup guide for running ZeroDrive locally with the new self-hosted backend.

## Quick Setup (5 minutes)

### 1. Start the Backend
```bash
cd backend

# Install dependencies
npm install

# Start PostgreSQL database
docker-compose up -d postgres

# Start the backend server
npm run dev
```

The backend API will be running at `http://localhost:3001`

### 2. Start the Frontend
```bash
cd app

# Install dependencies (if not already done)
npm install

# Start the frontend development server
npm start
```

The frontend will be running at `http://localhost:3000`

### 3. Verify Setup

Test the backend API:
```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
# {"success":true,"data":{"status":"healthy","timestamp":"...","version":"1.0.0"},"message":"API is healthy"}
```

Test the complete flow:
1. Open `http://localhost:3000` in your browser
2. Create or restore a wallet using BIP39 mnemonic
3. Try uploading and sharing a file

## Project Structure

```
zerodrive/
├── app/                          # React frontend
│   ├── src/
│   │   ├── utils/apiClient.ts   # Updated to use local backend
│   │   └── pages/share-files.tsx # File sharing UI
│   └── package.json
├── backend/                      # TypeScript backend
│   ├── src/
│   │   ├── routes/              # API endpoints
│   │   ├── config/database.ts   # PostgreSQL configuration
│   │   ├── middleware/          # Express middleware
│   │   ├── types/               # TypeScript types
│   │   └── server.ts            # Main server file
│   ├── database/init.sql        # Database schema
│   ├── .env                     # Environment variables
│   └── README.md                # Backend documentation
├── docker-compose.yml           # PostgreSQL + MinIO setup
└── DEVELOPMENT.md               # This file
```

## What Changed from Supabase

### Before (Supabase)
- Remote hosted PostgreSQL database
- Supabase client library for API calls
- Built-in authentication and real-time features
- Managed infrastructure

### After (Self-hosted)
- Local PostgreSQL in Docker container
- Custom Express.js API with TypeScript
- Simplified authentication (BIP39 only)
- Self-managed infrastructure

### Migration Summary
- ✅ **Database**: PostgreSQL schema recreated locally
- ✅ **API Client**: Updated to use local backend endpoints
- ✅ **Public Keys**: Store/retrieve RSA public keys for encryption
- ✅ **File Sharing**: Create and manage encrypted file shares
- ✅ **Type Safety**: Full TypeScript coverage
- ✅ **Development**: Docker-based local setup

## Testing the Setup

### 1. Test Public Key Storage
```bash
# Store a public key
curl -X POST http://localhost:3001/api/public-keys \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test@example.com","public_key":"test-key"}'

# Retrieve the public key
curl http://localhost:3001/api/public-keys/test@example.com
```

### 2. Test File Sharing
```bash
# Share a file
curl -X POST http://localhost:3001/api/shared-files \
  -H "Content-Type: application/json" \
  -d '{
    "file_id":"test-file-123",
    "owner_user_id":"owner@example.com",
    "recipient_user_id":"recipient@example.com",
    "encrypted_file_key":"encrypted-key-data",
    "file_name":"test-document.pdf",
    "file_size":1024,
    "mime_type":"application/pdf"
  }'

# Get shared files for a user
curl "http://localhost:3001/api/shared-files?recipient_user_id=recipient@example.com"
```

## Troubleshooting

### Common Issues

**1. Port 3001 already in use**
```bash
# Kill the process using the port
lsof -ti:3001 | xargs kill -9
npm run dev
```

**2. Database connection failed**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose down
docker-compose up -d postgres
```

**3. Frontend can't connect to backend**
- Make sure backend is running on port 3001
- Check CORS settings in backend/.env
- Verify API_BASE_URL in frontend

### Reset Everything
```bash
# Stop all services
docker-compose down
pkill -f "ts-node-dev"

# Remove database data
docker volume rm zerodrive_postgres_data

# Restart fresh
docker-compose up -d postgres
cd backend && npm run dev
```

## Next Steps

Now that you have a working local setup:

1. **Test the file sharing flow** in the frontend
2. **Deploy to your RackNerd VPS** when ready
3. **Configure production environment variables**
4. **Set up SSL certificates** for production
5. **Implement backup strategies** for the database

## Production Deployment

When you're ready to deploy to your RackNerd VPS:

1. **Install Docker** on the VPS
2. **Clone the repository** to the VPS
3. **Update environment variables** for production
4. **Use production PostgreSQL** (not Docker for production)
5. **Set up reverse proxy** (nginx) with SSL
6. **Configure backups** and monitoring

The local setup you have now is identical to what will run in production, just with different environment variables and infrastructure.