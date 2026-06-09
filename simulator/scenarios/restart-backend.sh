#!/usr/bin/env bash
##############################################################################
# Scenario: Graceful backend restart
#
# Tests:
#   - Pi screens detect backend absence (poll.failure) during restart
#   - Screens fall back to in-memory cache during downtime
#   - All screens recover automatically within one poll cycle (15s)
#   - No manual intervention required
#
# Expected behaviour:
#   1. In-flight polls get an ECONNREFUSED/timeout → poll.failure logged
#   2. Screens play from cache (offline banner in real player)
#   3. Backend comes back up, next poll succeeds
#   4. offline_streak resets to 0 within 15–30s
#
# Recovery SLA: all screens reporting live within 30s of backend restart
##############################################################################
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev-sim.yml}"
BACKEND="${BACKEND_URL:-http://localhost:4000}"

echo "=== Scenario: Backend Restart ==="
echo "Compose file: $COMPOSE_FILE"
echo ""

# Show current fleet state
echo "-- Fleet status before restart --"
curl -sf http://localhost:3100/status | python3 -m json.tool 2>/dev/null | grep -E '"(screen_id|status|offline_streak|last_version)"' || true
echo ""

# Restart backend container
echo "Restarting backend container..."
docker compose -f "$COMPOSE_FILE" restart backend

echo ""
echo "Backend restarting. Watching for recovery..."
echo "Run in another terminal: make sim-logs"
echo ""

# Poll until backend is healthy again
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  sleep 2
  WAITED=$((WAITED + 2))
  STATUS=$(curl -sf "${BACKEND}/health" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")
  if [ "$STATUS" = "ok" ]; then
    echo "Backend healthy after ${WAITED}s"
    break
  fi
  printf "  Waiting for backend... ${WAITED}s\r"
done

echo ""
echo "-- Fleet status after recovery --"
sleep 5  # Give one poll cycle to complete
curl -sf http://localhost:3100/status | python3 -m json.tool 2>/dev/null | grep -E '"(screen_id|status|offline_streak|poll_count)"' || true

echo ""
echo "Scenario complete. Check logs for poll.failure → poll.success transitions."
