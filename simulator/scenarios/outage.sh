#!/usr/bin/env bash
##############################################################################
# Scenario: Network outage simulation
#
# Pauses the backend container (SIGSTOP — process frozen, port unreachable)
# rather than killing it. This simulates a network cut from the Pi's perspective:
# connections hang and timeout rather than getting immediate ECONNREFUSED.
#
# This specifically tests:
#   - Fetch timeout behaviour (5s AbortSignal.timeout on each Pi poll)
#   - Offline streak accumulation across multiple poll cycles
#   - Cache fallback resilience during extended outage
#   - Recovery when network is restored
#
# Usage:
#   ./outage.sh             — pause 30s (default)
#   ./outage.sh 60          — pause 60s
#   ./outage.sh start       — pause indefinitely (manual ./outage.sh end)
#   ./outage.sh end         — resume (if started with 'start')
#
# Expected behaviour during outage:
#   - Each poll attempt takes ~5s (full fetch timeout)
#   - poll.failure logged with "This operation was aborted"
#   - playing_from_cache: true (cache survives)
#   - offline_streak increments each poll cycle
#
# Expected behaviour after recovery:
#   - Next poll succeeds, offline_streak resets to 0
#   - manifest_changed: true if content changed during outage
##############################################################################
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev-sim.yml}"
ACTION="${1:-30}"

function backend_pause() {
  echo "Pausing backend container (SIGSTOP)..."
  docker compose -f "$COMPOSE_FILE" pause backend
  echo "Backend paused. Pi polls will now timeout."
  echo ""
  echo "Watch logs: make sim-logs"
}

function backend_resume() {
  echo "Resuming backend container (SIGCONT)..."
  docker compose -f "$COMPOSE_FILE" unpause backend
  echo "Backend resumed. Pi screens should recover within 15–30s."
}

case "$ACTION" in
  start)
    backend_pause
    echo ""
    echo "Outage started. Run './outage.sh end' to restore."
    ;;

  end)
    backend_resume
    sleep 5
    echo ""
    echo "-- Fleet status after recovery --"
    curl -sf http://localhost:3100/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  by_status: {d[\"by_status\"]}')
for s in d['screens'][:5]:
    print(f'  {s[\"screen_id\"]}: {s[\"status\"]} streak={s[\"offline_streak\"]} cache={s[\"has_cache\"]}')
" 2>/dev/null || true
    ;;

  *)
    DURATION="$ACTION"
    echo "=== Scenario: Network Outage (${DURATION}s) ==="
    echo ""

    echo "-- Fleet before outage --"
    curl -sf http://localhost:3100/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  by_status: {d[\"by_status\"]}')
" 2>/dev/null || echo "  (management API unavailable)"

    echo ""
    backend_pause

    echo "Outage active for ${DURATION}s..."
    sleep "$DURATION"

    echo ""
    backend_resume

    echo "Waiting for recovery..."
    sleep 20

    echo ""
    echo "-- Fleet after recovery --"
    curl -sf http://localhost:3100/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  by_status: {d[\"by_status\"]}')
for s in d['screens']:
    icon = '✓' if s['status'] == 'live' else '✗'
    print(f'  {icon} {s[\"screen_id\"]}: {s[\"status\"]}  streak={s[\"offline_streak\"]}  ok={s[\"success_count\"]}  fail={s[\"failure_count\"]}')
" 2>/dev/null || true
    ;;
esac
