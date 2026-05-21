#!/bin/sh
set -e

# Initialize PostgreSQL data directory on first run
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  su-exec postgres initdb -D "$PGDATA" --auth-host=trust --auth-local=trust -E UTF8
fi

# Start PostgreSQL (localhost only)
su-exec postgres pg_ctl start -D "$PGDATA" -o "-h 127.0.0.1 -k /run/postgresql" -w -t 30

# Create app database and install PostGIS on first run
if ! su-exec postgres psql -h 127.0.0.1 -U postgres -lqt | cut -d'|' -f1 | grep -qw postgis_frontend; then
  su-exec postgres psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE postgis_frontend"
  su-exec postgres psql -h 127.0.0.1 -U postgres -d postgis_frontend -f /docker-init.sql
fi

# Auto-generate or load DSN encryption key
KEY_FILE=/data/dsn-key
if [ -f "$KEY_FILE" ]; then
  export DSN_ENCRYPTION_KEY=$(cat "$KEY_FILE")
elif [ -z "$DSN_ENCRYPTION_KEY" ]; then
  export DSN_ENCRYPTION_KEY=$(openssl rand -hex 32)
  mkdir -p /data
  echo "$DSN_ENCRYPTION_KEY" > "$KEY_FILE"
fi

exec "$@"
