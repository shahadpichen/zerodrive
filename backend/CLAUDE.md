# ZeroDrive Backend

Express + TypeScript + PostgreSQL (raw SQL via `pg`, no ORM).

## Commands

```bash
npm run dev          # Dev server on :3001 (ts-node-dev with auto-restart)
npm run build        # Compile to dist/
npm test             # Jest (all tests)
npm run test:watch   # Jest in watch mode
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run typecheck    # tsc --noEmit
npm run db:reset     # Reset database via src/utils/resetDb.ts
```

## Database

PostgreSQL 15 via Docker on port **5433** (not default 5432). Schema defined in `database/init.sql`.
Raw SQL queries via `pg` Pool — no ORM. See `config/database.ts` for connection setup.

## Auth

- Google OAuth flow via `services/googleOAuthService.ts`
- JWT tokens issued by `services/jwtService.ts`, stored in httpOnly cookies
- CSRF validation in `middleware/auth.ts`
- Auth middleware extracts user from JWT cookie and attaches to `req`

## API Patterns

- Routes under `/api/` — RESTful (see `routes/index.ts` for mount points)
- Request validation with **Joi** schemas
- Centralized error handling via `middleware/errorHandler.ts` (`ApiError` class)
- Standard response format: `{ success, data, error, message, pagination }`

## Routes

`auth`, `publicKeys`, `sharedFiles`, `presignedUrls`, `crypto`, `invitations`, `credits`, `analytics`, `webhooks`

## Testing

Jest + ts-jest + supertest. Tests in `src/__tests__/`:
- `__tests__/unit/` — services, middleware, routes
- `__tests__/integration/` — full request/response tests with supertest
- Path alias: `@/` maps to `src/` (configured in `jest.config.js` via `moduleNameMapper`)
- Test setup: `src/__tests__/setup.ts`

## Key Directories

```
src/
├── routes/          # Express route handlers
├── services/        # Business logic (JWT, email, Google OAuth, analytics)
├── middleware/      # auth, CORS, error handler
├── config/          # database.ts, s3.ts
├── types/           # Shared TypeScript types
├── utils/           # Logger, resetDb
└── __tests__/       # unit/ and integration/ test directories
```

## Environment

Backend requires `.env` with: DB connection, JWT secret, Google OAuth credentials, MinIO/S3 config, Mailgun API key, CORS origins. See `backend/.env` for all variables.

## Gotchas

- Port 5433 for PostgreSQL (Docker maps 5433->5432), not the default 5432
- `@/` path alias works in tests (jest moduleNameMapper) but NOT in application code — use relative imports in src/
- `tsconfig.json` excludes `**/*.test.ts` from compilation; tests use ts-jest separately
- `exactOptionalPropertyTypes: true` is enabled — use `undefined` explicitly, not just `?`
