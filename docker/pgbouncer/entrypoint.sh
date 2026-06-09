#!/bin/sh
# PgBouncer entrypoint — generates config from environment variables
# Required env vars:
#   DB_HOST          — postgres hostname (default: postgres)
#   DB_PORT          — postgres port (default: 5432)
#   DB_PASSWORD      — postgres user password
#   PGBOUNCER_ADMIN_PASSWORD — admin console password
#
# Failure model: if any required variable is missing, exits non-zero.
# Docker restart policy handles recovery.

set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

if [ -z "$DB_PASSWORD" ]; then
  echo "[pgbouncer-entrypoint] FATAL: DB_PASSWORD is required" >&2
  exit 1
fi

if [ -z "$PGBOUNCER_ADMIN_PASSWORD" ]; then
  echo "[pgbouncer-entrypoint] FATAL: PGBOUNCER_ADMIN_PASSWORD is required" >&2
  exit 1
fi

mkdir -p /var/run/pgbouncer /var/log/pgbouncer /etc/pgbouncer

# Generate userlist.txt — md5 format: "username" "md5<md5(password+username)>"
# pg password: md5 of (password + username)
APP_MD5="md5$(printf '%s' "${DB_PASSWORD}clubhub" | md5sum | awk '{print $1}')"
ADMIN_MD5="md5$(printf '%s' "${PGBOUNCER_ADMIN_PASSWORD}pgbouncer_admin" | md5sum | awk '{print $1}')"
STATS_MD5="md5$(printf '%s' "${PGBOUNCER_ADMIN_PASSWORD}pgbouncer_stats" | md5sum | awk '{print $1}')"

cat > /etc/pgbouncer/userlist.txt <<EOF
"clubhub" "${APP_MD5}"
"pgbouncer_admin" "${ADMIN_MD5}"
"pgbouncer_stats" "${STATS_MD5}"
EOF

# Substitute DB_HOST and DB_PORT into config template
sed "s/%DB_HOST%/${DB_HOST}/g; s/%DB_PORT%/${DB_PORT}/g" \
  /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini

echo "[pgbouncer-entrypoint] Config generated — connecting to ${DB_HOST}:${DB_PORT}"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
