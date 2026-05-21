#!/bin/sh
set -e

# Only start bundled PostgreSQL when POSTGRES_URL points to localhost.
# When deploying to Cloud Run / Kubernetes / etc, set POSTGRES_URL to an
# external database (e.g. Cloud SQL) and this block is skipped entirely.
if echo "${POSTGRES_URL:-}" | grep -qE '(127\.0\.0\.1|localhost)'; then
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    su-exec postgres initdb -D "$PGDATA" --auth-host=trust --auth-local=trust -E UTF8
  fi

  su-exec postgres pg_ctl start -D "$PGDATA" -o "-h 127.0.0.1 -k /run/postgresql" -w -t 30

  if ! su-exec postgres psql -h 127.0.0.1 -U postgres -lqt | cut -d'|' -f1 | grep -qw postgis_frontend; then
    su-exec postgres psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE postgis_frontend"
    su-exec postgres psql -h 127.0.0.1 -U postgres -d postgis_frontend -f /docker-init.sql
  fi
fi

# Auto-generate or load DSN encryption key.
# On Cloud Run: set DSN_ENCRYPTION_KEY as an env var — the file path is ephemeral.
KEY_FILE=/data/dsn-key
if [ -f "$KEY_FILE" ]; then
  export DSN_ENCRYPTION_KEY=$(cat "$KEY_FILE")
elif [ -z "$DSN_ENCRYPTION_KEY" ]; then
  export DSN_ENCRYPTION_KEY=$(openssl rand -hex 32)
  mkdir -p /data
  echo "$DSN_ENCRYPTION_KEY" > "$KEY_FILE"
fi

exec "$@"
