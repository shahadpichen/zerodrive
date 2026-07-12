# ZeroDrive Studio

ZeroDrive Studio is a fully open-source, local-only PostgreSQL explorer for
ZeroDrive operators and contributors. It is separate from the public API and
web application. It does not use Drizzle, change application queries, or manage
database migrations.

## Local development

Start PostgreSQL, then Studio:

```bash
pnpm infra:up
pnpm db:studio
```

The local profile defaults to the Docker PostgreSQL instance on
`127.0.0.1:5433`. Studio listens only on `127.0.0.1`, prints a one-time launch
URL, and attempts to open it in your browser. The URL expires after 60 seconds
and is exchanged for an HTTP-only session cookie.

Local mode supports table browsing, structured row changes, and full SQL.
Potentially destructive SQL requires a separate confirmation.

## Production through SSH

Studio must remain on the operator's computer. Do not deploy it as a public web
application and do not expose PostgreSQL to the internet.

Provision a dedicated read-only role as a PostgreSQL administrator:

```bash
psql "$ADMIN_DATABASE_URL" \
  -v studio_database=zerodrive \
  -v app_owner=zerodrive_app \
  -f apps/studio/sql/provision-readonly-role.sql
```

Then use `\password zerodrive_studio_ro` from an interactive `psql` session.
Do not place that password in this repository.

Open the SSH tunnel in one terminal. Replace the internal database host with
the hostname visible from the production SSH server:

```bash
ssh -N \
  -L 55432:production-postgres:5432 \
  deploy@production-server
```

Start Studio in another terminal:

```bash
STUDIO_DATABASE_URL="postgresql://zerodrive_studio_ro:YOUR_PASSWORD@127.0.0.1:55432/zerodrive" \
pnpm db:studio:prod
```

Production startup fails unless:

- the URL connects through a loopback host;
- PostgreSQL reports read-only transactions;
- the role is neither superuser nor `BYPASSRLS`;
- the role has no `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` privilege on
  application tables.

The production SQL workspace accepts one `SELECT` or `EXPLAIN SELECT`, runs it
inside `BEGIN READ ONLY`, and limits time and returned rows. Read-only access
still allows an operator to view data, so sensitive fields are masked in the
table grid by default and raw SQL results carry an explicit warning.

## Configuration

| Variable               | Local default                          | Production                              |
| ---------------------- | -------------------------------------- | --------------------------------------- |
| `STUDIO_DATABASE_URL`  | Local Docker PostgreSQL                | Required; loopback tunnel only          |
| `STUDIO_PORT`          | `4984`                                 | Optional local server port              |
| `STUDIO_CLIENT_ORIGIN` | `http://127.0.0.1:4985` in development | Must be loopback                        |
| `STUDIO_NO_OPEN`       | `false`                                | Set `true` to prevent opening a browser |

Production connection strings belong in a password manager or ephemeral shell
environment. Files matching `.env.studio.*` are ignored, but environment
variables or a secret manager are preferred.

## Security boundaries

- Database credentials exist only in the Studio server process.
- Studio APIs require the launch session, exact origin, and CSRF token.
- Responses are private and non-cacheable; errors do not include SQL or values.
- Query history is React state and disappears when the page or process closes.
- Field masking prevents accidental display; it is not an authorization system.
- Studio has no MinIO/S3 access and no production repair actions in v1.
