# ZeroDrive

ZeroDrive is a zero-knowledge encrypted cloud storage and private file sharing app.

Files are encrypted in the browser before upload. The backend coordinates authentication, storage, sharing metadata, and lifecycle state, but it should never receive plaintext file content or encryption keys.

## Repository layout

```txt
apps/web       React frontend
apps/api       Express API
apps/studio    Local-only PostgreSQL operations studio
packages       Shared TypeScript packages
```

## Quick start

Prerequisites:

- Node.js 24+
- pnpm 11.7+ via Corepack
- Docker and Docker Compose

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

```bash
pnpm install
pnpm infra:up
```

Run the backend:

```bash
pnpm dev:api
```

Run the frontend:

```bash
pnpm dev:web
```

Frontend: http://localhost:3000

Backend: http://localhost:3001

Inspect the local PostgreSQL database in ZeroDrive Studio:

```bash
pnpm db:studio
```

Studio binds only to `127.0.0.1` and opens a short-lived, one-time launch URL.
See `apps/studio/README.md` for the read-only production workflow.

## Useful commands

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:studio
pnpm format:check
pnpm infra:down
```

## Environment files

Use the examples in each app:

```txt
apps/web/.env.example
apps/api/.env.example
```

## Infrastructure

The root `docker-compose.yml` starts:

- PostgreSQL on `localhost:5433`
- MinIO on `localhost:9000`
- MinIO console on `localhost:9001`
- pgAdmin on `localhost:5050`

The database schema source of truth is:

```txt
apps/api/database/init.sql
```
