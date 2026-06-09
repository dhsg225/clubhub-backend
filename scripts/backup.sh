#!/usr/bin/env bash
# ClubHub TV — Database backup script
#
# Usage:
#   ./scripts/backup.sh                         # Backs up using defaults
#   COMPOSE_FILE=docker-compose.production.yml ./scripts/backup.sh
#
# Or via Makefile:
#   make backup                                 # Backs up sim DB
#   make backup-prod                            # Backs up production DB
#
# Output:
#   backups/clubhub_YYYY-MM-DD_HHMMSS.sql.gz
#
# Environment variables (all optional — defaults match dev-sim stack):
#   DB_HOST         postgres host       (default: localhost)
#   DB_PORT         postgres port       (default: 5433 for dev-sim, 5432 for prod)
#   DB_USER         postgres user       (default: clubhub)
#   DB_PASSWORD     postgres password   (default: clubhub)
#   DB_NAME         database name       (default: clubhub)
#   BACKUP_DIR      output directory    (default: ./backups)
#   USE_DOCKER      use docker exec     (default: false)
#   CONTAINER_NAME  postgres container  (default: clubhub_player-postgres-1)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-clubhub}"
DB_NAME="${DB_NAME:-clubhub}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
USE_DOCKER="${USE_DOCKER:-false}"
CONTAINER_NAME="${CONTAINER_NAME:-clubhub_player-postgres-1}"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
FILENAME="clubhub_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "ClubHub TV — Backup"
echo "==================="
echo "  Database:  ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
echo "  Output:    ${FILEPATH}"
echo ""

# ── Dump ─────────────────────────────────────────────────────────────────────
if [ "$USE_DOCKER" = "true" ]; then
  echo "→ Using docker exec to dump..."
  docker exec -e PGPASSWORD="${DB_PASSWORD:-clubhub}" \
    "$CONTAINER_NAME" \
    pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$FILEPATH"
else
  echo "→ Dumping via pg_dump..."
  PGPASSWORD="${DB_PASSWORD:-clubhub}" \
    pg_dump \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      "$DB_NAME" \
  | gzip > "$FILEPATH"
fi

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "✓ Backup complete: ${FILEPATH} (${SIZE})"
echo ""

# ── Retention: keep last 30 backups ──────────────────────────────────────────
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/clubhub_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 30 ]; then
  EXCESS=$((BACKUP_COUNT - 30))
  echo "→ Pruning ${EXCESS} old backup(s) (keeping last 30)..."
  ls -1t "${BACKUP_DIR}"/clubhub_*.sql.gz | tail -n "$EXCESS" | xargs rm -f
  echo "✓ Pruned."
fi

# ── Verify (basic) ────────────────────────────────────────────────────────────
if gzip -t "$FILEPATH" 2>/dev/null; then
  echo "✓ Backup file integrity OK"
else
  echo "✗ Backup file appears corrupt — check disk space and pg_dump output"
  exit 1
fi

echo ""
echo "To restore: make restore BACKUP=${FILENAME}"
echo "         or: ./scripts/restore.sh ${FILEPATH}"
