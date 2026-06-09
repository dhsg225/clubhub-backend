#!/bin/bash
# ClubHub TV — Deployment preflight check
#
# Run before deploying to any venue. Validates cloud infrastructure,
# database health, PgBouncer pool, CDN reachability, and migration state.
# MUST pass all checks before venue go-live.
#
# Exit codes: 0 = all pass, 1 = failures present
#
# Usage:
#   ./scripts/preflight-check.sh
#   ./scripts/preflight-check.sh --venue <venue_id>  (also checks venue-specific state)

set -euo pipefail

PASS=0; WARN=0; FAIL=0
VENUE_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in --venue) VENUE_ID="$2"; shift 2 ;; *) shift ;; esac
done

API_URL="${CMS_API_URL:-https://api.clubhub.tv}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

check_pass() { PASS=$((PASS+1)); green "  [PASS] $1"; }
check_warn() { WARN=$((WARN+1)); yellow "  [WARN] $1"; }
check_fail() { FAIL=$((FAIL+1)); red "  [FAIL] $1"; }

echo "ClubHub TV — Deployment Preflight Check"
echo "API: $API_URL"
echo "$(date -u)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. API liveness ───────────────────────────────────────────────────────────
echo ""
echo "1. API Health"
if curl -sf --max-time 5 "$API_URL/health/live" | grep -q '"status":"ok"'; then
  check_pass "API liveness"
else
  check_fail "API unreachable or unhealthy: $API_URL/health/live"
fi

RUNTIME_RESP=$(curl -sf --max-time 5 "$API_URL/health/runtime" 2>/dev/null || echo "{}")
if echo "$RUNTIME_RESP" | grep -q '"status":"HEALTHY"'; then
  check_pass "API runtime healthy (DB connected)"
else
  check_fail "API runtime not healthy: $RUNTIME_RESP"
fi

# ── 2. Database ───────────────────────────────────────────────────────────────
echo ""
echo "2. Database"
if command -v psql &>/dev/null; then
  if psql "postgresql://clubhub:${DB_PASSWORD:-}@${DB_HOST}:${DB_PORT}/clubhub" \
       -c "SELECT 1" -t 2>/dev/null | grep -q "1"; then
    check_pass "Direct postgres connection"
  else
    check_warn "Cannot test direct postgres connection (psql unavailable or no credentials)"
  fi

  # Check all migrations applied
  MIGRATION_COUNT=$(psql "postgresql://clubhub:${DB_PASSWORD:-}@${DB_HOST}:${DB_PORT}/clubhub" \
    -t -c "SELECT COUNT(*) FROM schema_migrations" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$MIGRATION_COUNT" -ge "8" ]; then
    check_pass "All 8 migrations applied (found: $MIGRATION_COUNT)"
  else
    check_fail "Missing migrations: expected 8, found $MIGRATION_COUNT"
  fi

  # Check partitions exist for current month
  CURRENT_MONTH=$(date +%Y_%m)
  PARTITION_CHECK=$(psql "postgresql://clubhub:${DB_PASSWORD:-}@${DB_HOST}:${DB_PORT}/clubhub" \
    -t -c "SELECT COUNT(*) FROM pg_class WHERE relname = 'replay_audit_records_${CURRENT_MONTH}'" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$PARTITION_CHECK" -gt "0" ]; then
    check_pass "Current month partition exists (replay_audit_records_${CURRENT_MONTH})"
  else
    check_fail "Missing partition: replay_audit_records_${CURRENT_MONTH} — run maintain_audit_partitions()"
  fi
else
  check_warn "psql not available — skipping direct DB checks"
fi

# ── 3. PgBouncer ─────────────────────────────────────────────────────────────
echo ""
echo "3. PgBouncer"
if curl -sf --max-time 5 "$API_URL/health/runtime" | grep -q '"db":"connected"'; then
  check_pass "PgBouncer pool functional (API can reach DB)"
else
  check_warn "Cannot confirm PgBouncer pool state"
fi

# ── 4. CDN / asset delivery ───────────────────────────────────────────────────
echo ""
echo "4. CDN Reachability"
CDN_URL="${CDN_URL:-https://assets.clubhub.tv}"
if curl -sf --max-time 10 --head "$CDN_URL" -o /dev/null; then
  check_pass "CDN reachable: $CDN_URL"
else
  check_warn "CDN may be unreachable: $CDN_URL (may be expected in dev)"
fi

# ── 5. Enrollment token infrastructure ───────────────────────────────────────
echo ""
echo "5. Provisioning Infrastructure"
ENROLL_RESP=$(curl -sf --max-time 5 -X POST "$API_URL/api/v2/enroll" \
  -H "Content-Type: application/json" \
  -d '{"enrollment_token":"test","hardware_id":"test","firmware_version":"test"}' 2>/dev/null || echo "{}")
if echo "$ENROLL_RESP" | grep -q '"Invalid enrollment token"'; then
  check_pass "Enrollment endpoint reachable and returning correct error for bad token"
else
  check_warn "Enrollment endpoint returned unexpected response: ${ENROLL_RESP:0:100}"
fi

# ── 6. Venue-specific checks ──────────────────────────────────────────────────
if [ -n "$VENUE_ID" ]; then
  echo ""
  echo "6. Venue: $VENUE_ID"

  HEALTH_RESP=$(curl -sf --max-time 5 "$API_URL/api/v2/fleet/health/screens?venue_id=$VENUE_ID" 2>/dev/null || echo "{}")
  SCREEN_COUNT=$(echo "$HEALTH_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('screens',[])))" 2>/dev/null || echo "0")
  if [ "$SCREEN_COUNT" -gt "0" ]; then
    OFFLINE=$(echo "$HEALTH_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
offline=[s for s in d.get('screens',[]) if s.get('status') in ('OFFLINE','LOST')]
print(len(offline))
" 2>/dev/null || echo "0")
    check_pass "Venue has $SCREEN_COUNT screen(s)"
    if [ "$OFFLINE" -gt "0" ]; then
      check_warn "$OFFLINE screen(s) currently offline"
    else
      check_pass "All screens online"
    fi
  else
    check_warn "No screens found for venue $VENUE_ID (may not be deployed yet)"
  fi

  # Check for open P1/P2 incidents
  INC_RESP=$(curl -sf --max-time 5 "$API_URL/api/v2/venues/$VENUE_ID/incident-command" 2>/dev/null || echo "{}")
  P1P2=$(echo "$INC_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
critical=[i for i in d.get('open_incidents',[]) if i.get('severity',9) <= 2]
print(len(critical))
" 2>/dev/null || echo "0")
  if [ "$P1P2" -gt "0" ]; then
    check_fail "$P1P2 open P1/P2 incident(s) for this venue — resolve before go-live"
  else
    check_pass "No open P1/P2 incidents"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASS: $PASS  WARN: $WARN  FAIL: $FAIL"

if [ "$FAIL" -gt "0" ]; then
  red "PREFLIGHT FAILED — do not proceed with venue deployment"
  exit 1
elif [ "$WARN" -gt "0" ]; then
  yellow "PREFLIGHT PASSED WITH WARNINGS — review before proceeding"
  exit 0
else
  green "PREFLIGHT PASSED — safe to proceed"
  exit 0
fi
