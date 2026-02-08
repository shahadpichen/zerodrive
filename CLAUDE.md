# ZeroDrive

Zero-knowledge encrypted cloud storage. Monorepo with `app/` (React frontend) and `backend/` (Express API).

## Quick Start

```bash
# Start infrastructure (PostgreSQL on :5433, MinIO on :9000/:9001, pgAdmin on :5050)
docker-compose up -d

# Backend (http://localhost:3001)
cd backend && npm install && npm run dev

# Frontend (http://localhost:3000)
cd app && npm install && npm start
```

## Commit Conventions

Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`

## Custom Agents

Custom agents in `.claude/agents/` — use via the Task tool with matching `subagent_type`:

- **lint-typecheck-fixer** — run after any code changes to catch lint/type errors
- **e2e-test-architect** — create tests for new or existing endpoints/components
- **security-auditor** — review auth, encryption, API endpoints, file sharing changes
- **db-migration-writer** — write PostgreSQL migration SQL for schema changes
- **pr-reviewer** — review branch diffs before merging
- **api-doc-generator** — generate/update API documentation
- **docker-debugger** — debug Docker/docker-compose issues
- **dependency-checker** — audit npm dependencies for vulnerabilities
- **commit-message-drafter** — generate Conventional Commits messages from staged changes

## Key Documentation

- `DEVELOPMENT.md` — full setup guide, project structure, troubleshooting
- `SECURITY-RISKS.md` — security risk assessment and known issues
- `backend/database/init.sql` — database schema (source of truth)

## Architecture

- **Zero-knowledge encryption**: files encrypted client-side before upload; server never sees plaintext
- **Storage**: MinIO (S3-compatible) for encrypted file blobs
- **Database**: PostgreSQL for metadata, sharing records, auth
- **Auth**: Google OAuth + JWT tokens in httpOnly cookies
