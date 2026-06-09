#!/usr/bin/env bash
##############################################################################
# Scenario: Thundering herd (flood test)
#
# Reboots all simulated Pi screens simultaneously to simulate a power outage
# followed by mass simultaneous restart. This tests the poll jitter mechanism:
# screens should spread their first poll across the 15s window rather than
# all hitting the backend at exactly the same moment.
#
# Tests:
#   - Poll jitter effectiveness (0–15s spread)
#   - Backend pool behaviour under concurrent cold-start load
#   - Cache hit rate during initial wave
#   - Manifest compute time under concurrent requests
#
# What to watch for:
#   - manifest.computed logs in backend: compute_ms should stay < 200ms
#   - No 500 errors during the burst
#   - Pi fleet poll spread: fleet.stats should show staggered recovery
#
# Expected behaviour:
#   - All screens emit reboot.start simultaneously
#   - First polls spread over 0–15s window (jitter working)
#   - Backend handles concurrent computes without timeouts
#   - All screens live within 30s
##############################################################################
set -euo pipefail

BACKEND="${BACKEND_URL:-http://localhost:4000}"
MGMT_API="${MGMT_URL:-http://localhost:3100}"

echo "=== Scenario: Thundering Herd / Flood Test ==="
echo ""

# Show current fleet state
echo "-- Fleet before flood --"
curl -sf "${MGMT_API}/status" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Fleet size: {d[\"fleet_size\"]}  status: {d[\"by_status\"]}')
" 2>/dev/null || echo "  (management API unavailable)"

echo ""
echo "Triggering simultaneous reboot on all screens..."
RESULT=$(curl -sf -X POST "${MGMT_API}/reboot-all" 2>/dev/null)
COUNT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count','?'))" 2>/dev/null || echo "?")
echo "Rebooted ${COUNT} screens simultaneously."
echo ""
echo "Jitter is active — first polls will spread over 0–15s."
echo "Backend compute load should peak within the first 15s."
echo ""
echo "Monitoring recovery (watching for 30s)..."

START=$(date +%s)
for CHECK in 5 10 15 20 25 30; do
  sleep 5
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  STATUS=$(curl -sf "${MGMT_API}/status" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
bs = d.get('by_status', {})
live = bs.get('live', 0)
total = d['fleet_size']
booting = bs.get('booting', 0) + bs.get('rebooting', 0)
recovering = bs.get('recovering', 0)
print(f'live={live}/{total} booting={booting} recovering={recovering}')
" 2>/dev/null || echo "unavailable")
  printf "  ${ELAPSED}s: ${STATUS}\n"
done

echo ""
echo "Final fleet status:"
curl -sf "${MGMT_API}/status" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  by_status: {d[\"by_status\"]}')
for s in d['screens']:
    icon = '✓' if s['status'] == 'live' else '✗'
    print(f'  {icon} {s[\"screen_id\"]}: {s[\"status\"]} v{s[\"last_version\"]} polls={s[\"poll_count\"]}')
" 2>/dev/null || true

echo ""
echo "Scenario complete."
echo ""
echo "Check backend logs for manifest.computed timing:"
echo "  docker compose -f docker-compose.dev-sim.yml logs backend | grep manifest.computed | python3 -c \\"
echo "  \"import sys,json; [print(json.loads(l).get('duration_ms','')) for l in sys.stdin if 'manifest.computed' in l]\""
