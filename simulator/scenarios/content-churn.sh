#!/usr/bin/env bash
##############################################################################
# Scenario: Content churn (rapid create/delete)
#
# Rapidly creates and deletes content items while screens are polling.
# Each create + schedule + delete cycle should produce two manifest version bumps:
#   1. When the new schedule is created (cache bust → new content appears)
#   2. When the content is deleted (cache bust → content disappears)
#
# Tests:
#   - Version increment correctness under rapid changes
#   - Cache bust reliability
#   - Pi simulator detects all version changes
#   - No manifest inconsistency (items referencing deleted content)
#
# Usage:
#   ./content-churn.sh          — 5 cycles
#   ./content-churn.sh 10       — 10 cycles
#   ./content-churn.sh 20 2     — 20 cycles, 2s between each
##############################################################################
set -euo pipefail

BACKEND="${BACKEND_URL:-http://localhost:4000}"
CYCLES="${1:-5}"
DELAY="${2:-3}"

echo "=== Scenario: Content Churn (${CYCLES} cycles, ${DELAY}s between) ==="
echo ""
echo "Each cycle: create content + schedule → wait → delete content"
echo ""

SCREEN="${SCREEN_ID:-sim-screen-01}"
VERSION_CHANGES=0
ERRORS=0

for i in $(seq 1 "$CYCLES"); do
  HEADLINE="Churn Test ${i} — $(date +%H:%M:%S)"
  echo "Cycle ${i}/${CYCLES}: Creating '${HEADLINE}'..."

  # Create content
  CONTENT=$(curl -sf -X POST "${BACKEND}/content" \
    -H "Content-Type: application/json" \
    -d "{\"template_type\":\"promo_slide\",\"data\":{\"headline\":\"${HEADLINE}\",\"subheadline\":\"Content churn scenario\"}}" \
    2>/dev/null)
  CONTENT_ID=$(echo "$CONTENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

  if [ -z "$CONTENT_ID" ]; then
    echo "  ERROR: Failed to create content. Backend running?"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Create a schedule for it
  SCHED=$(curl -sf -X POST "${BACKEND}/schedules" \
    -H "Content-Type: application/json" \
    -d "{\"content_id\":\"${CONTENT_ID}\",\"screen_id\":\"${SCREEN}\",\"priority\":30,\"duration\":10}" \
    2>/dev/null)
  SCHED_ID=$(echo "$SCHED" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

  echo "  content=${CONTENT_ID:0:8}  schedule=${SCHED_ID:0:8}"

  # Get current manifest version
  V_BEFORE=$(curl -sf "${BACKEND}/manifest?screen_id=${SCREEN}" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'), d.get('checksum','?'))" 2>/dev/null || echo "? ?")
  echo "  manifest before: v${V_BEFORE}"

  sleep "$DELAY"

  # Check manifest after schedule create
  V_AFTER=$(curl -sf "${BACKEND}/manifest?screen_id=${SCREEN}" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'), d.get('checksum','?'))" 2>/dev/null || echo "? ?")
  echo "  manifest after:  v${V_AFTER}"

  # Delete content (cascades to schedule, busts cache)
  DEL=$(curl -sf -X DELETE "${BACKEND}/content/${CONTENT_ID}" 2>/dev/null)
  echo "  delete: $(echo "$DEL" | python3 -c "import sys,json; print(json.load(sys.stdin))" 2>/dev/null)"

  VERSION_CHANGES=$((VERSION_CHANGES + 1))
  sleep 1
done

echo ""
echo "=== Churn complete ==="
echo "  Cycles:  ${CYCLES}"
echo "  Errors:  ${ERRORS}"
echo ""
echo "Expected: Pi simulator logs show ~${VERSION_CHANGES} manifest_changed events"
echo "Check:    make fleet-status"
