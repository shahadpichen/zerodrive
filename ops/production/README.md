# ZeroDrive production deployment

This runbook deploys ZeroDrive on one Ubuntu 24.04 VPS. Docker runs the
frontend, API, PostgreSQL, and MinIO. Host Nginx owns public ports 80/443 and
TLS. PostgreSQL and the MinIO console are never exposed publicly.

Personal Storage files are not on this VPS. They remain encrypted in each
user's Google Drive. PostgreSQL and MinIO contain application coordination
records and temporary encrypted shared-file objects, so both still require
backups.

## 1. DNS

Create `A` records pointing at the VPS IPv4 address:

| Host                  | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `zerodrive.xyz`       | Public web application                       |
| `www.zerodrive.xyz`   | Redirect to the canonical web origin         |
| `api.zerodrive.xyz`   | Operational API access and health checks     |
| `files.zerodrive.xyz` | Encrypted shared-file transfer through MinIO |

Remove stale `AAAA` records unless IPv6 has been configured and tested on the
VPS. Confirm every hostname before requesting TLS:

```bash
dig +short zerodrive.xyz
dig +short api.zerodrive.xyz
dig +short files.zerodrive.xyz
```

## 2. Host packages

The server should already have a sudo-enabled `deploy` user, public-key-only
SSH, UFW allowing only 22/80/443, automatic security updates, and Docker Engine
with the Compose plugin.

Install the host reverse proxy and certificate client:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Do not add `deploy` to the Docker group. Membership is effectively unrestricted
root access; use `sudo docker ...` instead.

## 3. Repository and environment

Keep the checkout at a stable path:

```bash
sudo mkdir -p /opt/zerodrive
sudo chown deploy:deploy /opt/zerodrive
git clone https://github.com/zerodrivehq/zerodrive.git /opt/zerodrive/app
cd /opt/zerodrive/app
git switch develop
```

For a later production release, deploy a reviewed tag or exact commit instead
of following a moving branch.

Create the production environment file:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Keep master copies of secret values in 1Password. Generate independent random
values; never reuse one secret for another purpose:

```bash
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # DIRECTORY_HMAC_SECRET
openssl rand -hex 32  # EMAIL_HASH_SALT for a fresh deployment
openssl rand -hex 24  # DB_PASSWORD
openssl rand -hex 24  # DB_ADMIN_PASSWORD (different from DB_PASSWORD)
openssl rand -hex 16  # MINIO_ACCESS_KEY
openssl rand -hex 32  # MINIO_SECRET_KEY
```

`REACT_APP_*` values are public build settings embedded in JavaScript. Never
place a true secret in a `REACT_APP_*` variable.

Google Cloud must authorize this exact callback:

```text
https://zerodrive.xyz/api/auth/callback/google
```

The allowed JavaScript origin is `https://zerodrive.xyz`. Browser API requests
also use `https://zerodrive.xyz/api`; host Nginx proxies that path to the API.
This same-origin arrangement lets ZeroDrive keep authentication and CSRF
cookies host-only instead of exposing them to every `*.zerodrive.xyz`
subdomain. `api.zerodrive.xyz` remains available for operational health checks,
but it is not the browser OAuth callback origin. Mailgun should use the verified
`zerodrive.xyz` domain and `notifications@zerodrive.xyz` sender.

## 4. Obtain the first TLS certificate

Install the temporary HTTP-only site:

```bash
sudo mkdir -p /var/www/certbot
sudo cp ops/production/nginx/zerodrive-bootstrap.conf /etc/nginx/sites-available/zerodrive-bootstrap.conf
sudo ln -s /etc/nginx/sites-available/zerodrive-bootstrap.conf /etc/nginx/sites-enabled/zerodrive-bootstrap.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Request one certificate covering every public hostname:

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d zerodrive.xyz \
  -d www.zerodrive.xyz \
  -d api.zerodrive.xyz \
  -d files.zerodrive.xyz
```

Then replace the bootstrap site with the full reverse proxy:

```bash
sudo cp ops/production/nginx/zerodrive.conf /etc/nginx/sites-available/zerodrive.conf
sudo rm /etc/nginx/sites-enabled/zerodrive-bootstrap.conf
sudo ln -s /etc/nginx/sites-available/zerodrive.conf /etc/nginx/sites-enabled/zerodrive.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Install a deploy hook so Nginx begins using renewed certificates without a
server reboot:

```bash
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' | \
  sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo certbot renew --dry-run
```

## 5. Build and start ZeroDrive

First render the final Compose model. This catches missing variables without
starting anything:

```bash
sudo docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

Build and start:

```bash
sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Only loopback ports should be published by Docker:

```bash
sudo ss -lntp | grep -E ':3000|:3001|:9000|:5432|:9001'
```

Expected: frontend `127.0.0.1:3000`, API `127.0.0.1:3001`, and MinIO
`127.0.0.1:9000`. PostgreSQL and the MinIO console should not appear on public
host ports.

## 6. Verify the deployment

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -I https://zerodrive.xyz
curl -I https://zerodrive.xyz/api/health
curl -I https://api.zerodrive.xyz/api/health
curl -I https://files.zerodrive.xyz/minio/health/live
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

Complete a browser walkthrough: Google sign-in and refresh, legal acceptance,
Recovery & Access, personal upload/download/preview, sharing identity, send a
share, receive it, download it, and Save to Storage. Verify the invitation
email without logging its recipient address.

## 7. Backups

Run the versioned backup script from the repository:

```bash
chmod +x ops/production/backup.sh
ops/production/backup.sh
```

It briefly enters maintenance mode to prevent API and presigned-upload writes,
then creates a PostgreSQL custom-format dump plus a MinIO mirror under
`~/zerodrive-backups/<UTC timestamp>`. A backup on the same VPS is not a real
disaster-recovery copy. Transfer it to encrypted off-server storage, apply a
retention policy, and test restoration.

Before restoring, take a new backup and stop the backend so no writes occur.
Restore PostgreSQL into a clean database with `pg_restore`, restore the MinIO
mirror with `mc mirror`, then restart and run the full verification checklist.
Restoration is intentionally a supervised operation rather than an automatic
script because it replaces production state.

## 8. Updating and rollback

Before every update:

1. Read the release diff and migration notes.
2. Create and move an off-server backup.
3. Record the currently deployed commit with `git rev-parse HEAD`.
4. Build the candidate and run its checks in CI.

Deploy with:

```bash
git fetch --prune
git checkout <reviewed-tag-or-commit>
sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Database migrations are forward-only. Rolling application containers back
does not reverse a migration. Follow `apps/api/database/ROLLBACK.md` whenever a
release changes the schema.

## 9. Routine operations

```bash
# Status
sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Recent logs (never paste secrets into support channels)
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200

# Resource usage
sudo docker stats --no-stream

# Host security updates
sudo apt update && sudo apt upgrade
```

Docker's `local` logging driver and per-service limits prevent unbounded log
growth. Continue monitoring disk usage, memory, certificate renewal, backup
age, API health, and aggregate error counts.
