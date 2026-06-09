#!/usr/bin/env bash
# ClubHub TV — Database restore script
#
# Usage:
#   ./scripts/restore.sh backups/clubhub_2026-05-15_120000.sql.gz
#
# Or via Makefile:
#   make restore BACKUP=clubhub_2026-05-15_120000.sql.gz
#
# WARNING: This will DROP and recreate the target database.
#          Always test restores on a non-production system first.
#          Ensure the backend is stopped before restoring to avoid partial reads.
#
# Environment variables:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  (same as backup.sh)
#   USE_DOCKER, CONTAINER_NAME                       (same as backup.sh)

set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file>"
  echo ""
  echo "Available backups:"
  ls -lt backups/clubhub_*.sql.gz 2>/dev/null | head -10 | awk '{print "  " $NF}'
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "✗ Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# ── Config ────────────────────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-clubhub}"
DB_NAME="${DB_NAME:-clubhub}"
USE_DOCKER="${USE_DOCKER:-false}"
CONTAINER_NAME="${CONTAINER_NAME:-clubhub_player-postgres-1}"

echo "ClubHub TV — Restore"
echo "===================="
echo "  Backup:   ${BACKUP_FILE}"
echo "  Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
echo ""
echo "  ⚠️  This will DROP and recreate the '${DB_NAME}' database."
read -p "  Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# ── Verify backup integrity ───────────────────────────────────────────────────
echo ""
echo "→ Verifying backup file..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "✗ Backup file appears corrupt. Aborting."
  exit 1
fi
echo "✓ File OK"

# ── Stop backend (warning only — we can't know if it's running) ───────────────
echo ""
echo "→ Reminder: stop the backend before restoring to prevent partial reads."
echo "  Production:  docker compose -f docker-compose.production.yml stop backend"
echo "  Dev-sim:     docker compose -f docker-compose.dev-sim.yml stop backend"
echo ""
read -p "  Backend is stopped. Continue? [y/N] " GO
if [ "$GO" != "y" ] && [ "$GO" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# ── Drop and recreate DB ──────────────────────────────────────────────────────
PGPASS="PGPASSWORD=${DB_PASSWORD:-clubhub}"

run_psql() {
  if [ "$USE_DOCKER" = "true" ]; then
    docker exec -e "$PGPASS" "$CONTAINER_NAME" psql -U "$DB_USER" "$@"
  else
    eval "$PGPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
  fi
}

echo "→ Dropping existing database..."
run_psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
echo "→ Creating fresh database..."
run_psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# ── Restore ───────────────────────────────────────────────────────────────────
echo "→ Restoring backup..."
if [ "$USE_DOCKER" = "true" ]; then
  gunzip -c "$BACKUP_FILE" | \
    docker exec -i -e "$PGPASS" "$CONTAINER_NAME" \
      psql -U "$DB_USER" "$DB_NAME"
else
  gunzip -c "$BACKUP_FILE" | \
    eval "$PGPASS" psql \
      -h "$DB_HOST" -p "$DB_PORT" \
      -U "$DB_USER" "$DB_NAME"
fi

echo ""
echo "✓ Restore complete."
echo ""
echo "Next steps:"
echo "  1. Start the backend:   docker compose -f docker-compose.production.yml start backend"
echo "  2. Verify health:       curl http://localhost:4000/health/ready"
echo "  3. Check manifest:      curl 'http://localhost:4000/manifest?screen_id=<id>'"
