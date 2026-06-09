#!/usr/bin/env bash
##############################################################################
# Scenario: Clear manifest cache
#
# Deletes all rows from manifest_cache, forcing the next manifest request
# from each Pi to recompute from scratch.
#
# Tests:
#   - Cold-compute performance (no cache hit path)
#   - Version reset behaviour (version resets to 1 after cache delete)
#   - Version/checksum-based change detection in Pi simulator
#
# Expected behaviour:
#   - Each screen's next poll triggers a fresh computeManifest() call
#   - manifest.computed log shows cache_hit: false
#   - Pi sees version=1 with new checksum → manifest_changed: true
#     IF it previously had a different checksum cached
##############################################################################
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev-sim.yml}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"  # 5433 = sim compose; 5432 = local direct

echo "=== Scenario: Clear Manifest Cache ==="
echo ""

# Show cache state before
echo "-- Cache rows before clear --"
PGPASSWORD=clubhub psql -h "$DB_HOST" -p "$DB_PORT" -U clubhub -d clubhub -c \
  "SELECT screen_id, version, checksum, computed_at FROM manifest_cache ORDER BY computed_at DESC;" \
  2>/dev/null || echo "  (could not connect to DB on ${DB_HOST}:${DB_PORT})"

echo ""
echo "Clearing manifest_cache table..."
PGPASSWORD=clubhub psql -h "$DB_HOST" -p "$DB_PORT" -U clubhub -d clubhub -c \
  "DELETE FROM manifest_cache; SELECT 'cleared: ' || COUNT(*) || ' remaining rows' FROM manifest_cache;" \
  2>/dev/null || {
    echo "ERROR: Could not connect. Try:"
    echo "  DB_PORT=5432 ./clear-caches.sh   (if using local postgres)"
    echo "  DB_PORT=5433 ./clear-caches.sh   (if using sim docker-compose)"
    exit 1
  }

echo ""
echo "Cache cleared. Next manifest poll per screen will be a cold compute."
echo ""
echo "Watch logs: make sim-logs"
echo ""
echo "Expected in backend logs:"
echo "  manifest.computed events with cache_hit: false"
echo "Expected in simulator logs:"
echo "  poll.success events with manifest_changed: true (new checksum)"
