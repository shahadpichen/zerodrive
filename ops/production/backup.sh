#!/bin/sh
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ENV_FILE=${ZERODRIVE_ENV_FILE:-"$REPOSITORY_ROOT/.env.production"}
COMPOSE_FILE="$REPOSITORY_ROOT/docker-compose.prod.yml"
BACKUP_ROOT=${ZERODRIVE_BACKUP_ROOT:-"$HOME/zerodrive-backups"}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_ROOT/$STAMP"
WORKING_TARGET="$BACKUP_ROOT/.incomplete-$STAMP"
BACKEND_WAS_RUNNING=0
NGINX_WAS_RUNNING=0

if [ ! -f "$ENV_FILE" ]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

export ZERODRIVE_ENV_FILE="$ENV_FILE"

umask 077
mkdir -p "$WORKING_TARGET/minio"

restore_services() {
  if [ "$BACKEND_WAS_RUNNING" -eq 1 ]; then
    sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start backend >/dev/null
  fi
  if [ "$NGINX_WAS_RUNNING" -eq 1 ]; then
    sudo systemctl start nginx
  fi
}

trap restore_services EXIT
trap 'exit 130' INT TERM

# A consistent backup must block both API writes and already-issued presigned
# object-storage requests. Stopping only the API leaves those URLs usable.
if sudo systemctl is-active --quiet nginx; then
  NGINX_WAS_RUNNING=1
  echo "Entering maintenance mode (stopping Nginx)..."
  sudo systemctl stop nginx
fi

if sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  ps --status running --services | grep -qx backend; then
  BACKEND_WAS_RUNNING=1
  echo "Stopping the API after in-flight requests finish..."
  sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop -t 30 backend
fi

echo "Creating PostgreSQL backup..."
sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$WORKING_TARGET/postgres.dump"

echo "Mirroring encrypted shared-file objects..."
sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm --no-deps \
  -v "$WORKING_TARGET/minio:/backup" \
  --entrypoint /bin/sh \
  minio-backup-client \
  -c 'mc alias set source http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null && mc mirror "source/${MINIO_BUCKET:-zerodrive-files}" /backup'

sudo chown -R "$(id -u):$(id -g)" "$WORKING_TARGET/minio"

if [ ! -s "$WORKING_TARGET/postgres.dump" ]; then
  echo "PostgreSQL backup is empty" >&2
  exit 1
fi

sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  exec -T postgres pg_restore --list \
  < "$WORKING_TARGET/postgres.dump" >/dev/null

(cd "$WORKING_TARGET" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
mv "$WORKING_TARGET" "$TARGET"

echo "Backup created at $TARGET"
echo "Copy it to encrypted off-server storage and test restoration regularly."
