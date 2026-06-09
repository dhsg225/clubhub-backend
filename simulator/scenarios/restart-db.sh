#!/usr/bin/env bash
##############################################################################
# Scenario: PostgreSQL restart during active polling
#
# Tests:
#   - Backend handles DB connection loss gracefully (pool recovery)
#   - Backend's pg pool reconnects automatically after DB restart
#   - Pi screens experience brief poll failures during backend→DB recovery
#   - All screens recover without manual intervention
#
# Expected behaviour:
#   1. DB goes down → backend pool throws "ECONNREFUSED" or "Connection terminated"
#   2. Backend returns 500 to Pi polls → poll.failure logged on simulator
#   3. Pi screens fall back to in-memory cache
#   4. DB comes back up → backend pool reconnects (up to 10 retries × 2s)
#   5. Manifest queries succeed → polls recover
#
# Recovery SLA:
#   - DB restart takes ~5–10s
#   - Backend pool recovery: up to 20s (10 × 2s retries)
#   - Pi screen recovery: next poll cycle (within 15s of backend recovery)
#   - Total expected downtime from Pi perspective: 30–60s
##############################################################################
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev-sim.yml}"
BACKEND="${BACKEND_URL:-http://localhost:4000}"

echo "=== Scenario: PostgreSQL Restart ==="
echo ""

# Before state
echo "-- Fleet status before DB restart --"
curl -sf http://localhost:3100/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Total: {d[\"fleet_size\"]}  by_status: {d[\"by_status\"]}')
for s in d['screens'][:5]:
    print(f'  {s[\"screen_id\"]}: {s[\"status\"]} v{s[\"last_version\"]} streak={s[\"offline_streak\"]}')
" 2>/dev/null || echo "  (management API not available)"

echo ""
echo "Restarting postgres container..."
docker compose -f "$COMPOSE_FILE" restart postgres

echo "PostgreSQL restarting. This will cause transient backend errors."
echo ""

# Wait for postgres healthy
echo "Waiting for postgres healthcheck..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  sleep 3
  WAITED=$((WAITED + 3))
  HEALTHY=$(docker compose -f "$COMPOSE_FILE" ps --format json postgres 2>/dev/null | python3 -c "import sys,json; rows=list(map(json.loads,sys.stdin)); print(rows[0].get('Health','') if rows else '')" 2>/dev/null || echo "")
  if [ "$HEALTHY" = "healthy" ]; then
    echo "Postgres healthy after ${WAITED}s"
    break
  fi
  printf "  Waiting for postgres... ${WAITED}s\r"
done

echo ""
echo "Waiting for backend pool to reconnect and screens to recover..."
sleep 25

echo "-- Fleet status after recovery --"
curl -sf http://localhost:3100/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Total: {d[\"fleet_size\"]}  by_status: {d[\"by_status\"]}')
for s in d['screens']:
    status_icon = '✓' if s['status'] == 'live' else '✗'
    print(f'  {status_icon} {s[\"screen_id\"]}: {s[\"status\"]} v{s[\"last_version\"]} streak={s[\"offline_streak\"]} ok={s[\"success_count\"]} fail={s[\"failure_count\"]}')
" 2>/dev/null || true

echo ""
echo "Scenario complete. Look for:"
echo "  poll.failure with 'connection terminated' errors"
echo "  Followed by poll.success once pool reconnects"
