#!/bin/sh
KEY_FILE=/data/dsn-key

if [ -f "$KEY_FILE" ]; then
  export DSN_ENCRYPTION_KEY=$(cat "$KEY_FILE")
elif [ -z "$DSN_ENCRYPTION_KEY" ]; then
  export DSN_ENCRYPTION_KEY=$(openssl rand -hex 32)
  mkdir -p /data
  echo "$DSN_ENCRYPTION_KEY" > "$KEY_FILE"
fi

exec "$@"
