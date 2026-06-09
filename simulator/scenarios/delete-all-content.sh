#!/usr/bin/env bash
##############################################################################
# Scenario: Delete all content mid-polling
#
# Deletes every content item via the API while screens are actively polling.
# Because DELETE /content/:id cascades (removes schedules, busts cache),
# each Pi's next manifest will contain only the system fallback slide.
#
# Tests:
#   - Cache bust logic on content delete
#   - System fallback slide (screen is never blank)
#   - Pi simulator detects manifest_changed after fallback promotion
#   - Graceful transition from real content to fallback
#
# Expected behaviour:
#   1. DELETE requests cascade: content → schedules → manifest_cache bust
#   2. Pi next poll: manifest items=[system-fallback slide]
#   3. Pi logs: manifest_changed: true, sources: ["system"]
#   4. After seed --reset + re-seed: content returns, another version bump
#
# Recovery:
#   Run 'make seed' or 'make seed-reset' to restore content
##############################################################################
set -euo pipefail

BACKEND="${BACKEND_URL:-http://localhost:4000}"

echo "=== Scenario: Delete All Content ==="
echo ""

# List what we're about to delete
echo "-- Content before deletion --"
curl -sf "${BACKEND}/content" | python3 -c "
import sys, json
items = json.load(sys.stdin)
print(f'  {len(items)} content items:')
for i in items:
    print(f'  {i[\"id\"][:8]}... [{i[\"status\"]}] \"{i[\"data\"].get(\"headline\",\"?\")[:40]}\"')
" 2>/dev/null || echo "  (could not list content)"

echo ""
echo "Deleting all content..."

curl -sf "${BACKEND}/content" | python3 -c "
import sys, json, subprocess, os
items = json.load(sys.stdin)
backend = os.environ.get('BACKEND_URL', 'http://localhost:4000')
for i in items:
    result = subprocess.run(
        ['curl', '-sf', '-X', 'DELETE', f'{backend}/content/{i[\"id\"]}'],
        capture_output=True, text=True
    )
    status = json.loads(result.stdout).get('deleted', False) if result.stdout else False
    print(f'  DELETE {i[\"id\"][:8]}... → {\"ok\" if status else \"FAILED\"}')
" BACKEND_URL="${BACKEND}" 2>/dev/null

echo ""
echo "All content deleted."
echo ""
echo "Pi screens will transition to system fallback slide on next poll."
echo ""
echo "To restore content: make seed"
echo "To watch the transition: make sim-logs"
