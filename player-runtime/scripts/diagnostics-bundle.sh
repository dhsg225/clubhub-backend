#!/bin/bash
# ClubHub TV — Diagnostics bundle generator
#
# Creates a tarball of everything needed to diagnose a player issue remotely.
# Safe to run on a live player — read-only operations only.
# No credentials, no private keys, no content assets included.
#
# Output: /tmp/clubhub-diagnostics-<screen_id>-<timestamp>.tar.gz
# Upload: if CMS_API_URL is set, attempts upload to support endpoint.
#
# Usage:
#   ./diagnostics-bundle.sh              # auto-detect screen_id from env
#   ./diagnostics-bundle.sh --upload     # generate and upload to API
#   ./diagnostics-bundle.sh --stdout     # write to stdout (for pipe to scp)
#
# Triggered by:
#   - Operator via remote command COLLECT_DIAGNOSTICS
#   - Support staff via SSH
#   - Automated on watchdog CORPUS_CRITICAL event

set -euo pipefail

SCREEN_ENV="/etc/clubhub/screen.env"
UPLOAD=false
STDOUT_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload)  UPLOAD=true; shift ;;
    --stdout)  STDOUT_MODE=true; shift ;;
    *)         shift ;;
  esac
done

# Load config
[ -f "$SCREEN_ENV" ] && source "$SCREEN_ENV"
SCREEN_ID="${SCREEN_ID:-unknown}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BUNDLE_DIR=$(mktemp -d "/tmp/diag-${SCREEN_ID:0:8}-XXXXXX")
BUNDLE_FILE="/tmp/clubhub-diagnostics-${SCREEN_ID:0:8}-${TIMESTAMP}.tar.gz"

cleanup() { rm -rf "$BUNDLE_DIR"; }
trap cleanup EXIT

echo "[diagnostics] Collecting diagnostics for screen_id=${SCREEN_ID}..."

# ── System info ───────────────────────────────────────────────────────────────
{
  echo "=== SYSTEM INFO ==="
  echo "screen_id: $SCREEN_ID"
  echo "venue_id: ${VENUE_ID:-unknown}"
  echo "timestamp: $TIMESTAMP"
  echo "hostname: $(hostname)"
  echo "uptime: $(uptime)"
  echo "kernel: $(uname -r)"
  echo "node: $(node --version 2>/dev/null || echo 'not found')"
  echo ""
  echo "=== DISK USAGE ==="
  df -h /var/clubhub /var/log/clubhub 2>/dev/null || df -h /
  echo ""
  echo "=== MEMORY ==="
  free -h
  echo ""
  echo "=== TEMPERATURE ==="
  cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf "%.1f°C\n", $1/1000}' || echo "not available"
  echo ""
  echo "=== NETWORK ==="
  ip addr show 2>/dev/null | grep -E "inet |state UP" || hostname -I
  echo "DNS test (api.clubhub.tv):"
  nslookup api.clubhub.tv 2>/dev/null | tail -3 || echo "nslookup not available"
  echo "API ping:"
  curl -sf --max-time 5 "${CMS_API_URL:-https://api.clubhub.tv}/health/live" 2>/dev/null || echo "UNREACHABLE"
} > "$BUNDLE_DIR/system-info.txt"

# ── PM2 status ────────────────────────────────────────────────────────────────
pm2 status 2>/dev/null > "$BUNDLE_DIR/pm2-status.txt" || echo "PM2 not available" > "$BUNDLE_DIR/pm2-status.txt"
pm2 describe clubhub-player 2>/dev/null >> "$BUNDLE_DIR/pm2-status.txt" || true

# ── Last 500 log lines ────────────────────────────────────────────────────────
tail -500 /var/log/clubhub/player.log 2>/dev/null > "$BUNDLE_DIR/player-log-tail.txt" \
  || pm2 logs clubhub-player --nostream --lines 500 2>/dev/null > "$BUNDLE_DIR/player-log-tail.txt" \
  || echo "No logs available" > "$BUNDLE_DIR/player-log-tail.txt"

# ── Corpus snapshot status ────────────────────────────────────────────────────
{
  echo "=== CORPUS SNAPSHOTS ==="
  for f in current previous factory; do
    path="/var/clubhub/corpus/corpus.${f}.json"
    if [ -f "$path" ]; then
      size=$(wc -c < "$path")
      mtime=$(stat -c %y "$path" 2>/dev/null || stat -f %Sm "$path" 2>/dev/null)
      version=$(python3 -c "import json,sys; d=json.load(open('$path')); print(d.get('corpus_version_id','?'))" 2>/dev/null || echo "unreadable")
      checksum=$(python3 -c "import json,sys; d=json.load(open('$path')); print(d.get('checksum','?'))" 2>/dev/null || echo "unreadable")
      echo "$f: version=$version checksum=$checksum size=${size}B mtime=$mtime"
    else
      echo "$f: ABSENT"
    fi
  done
  echo ""
  echo "=== REPLAY CACHE ==="
  replay_file="/var/clubhub/replay/replay-packets.ndjson"
  if [ -f "$replay_file" ]; then
    size=$(wc -c < "$replay_file")
    lines=$(wc -l < "$replay_file")
    unsynced=$(grep -c '"synced":false' "$replay_file" 2>/dev/null || echo "0")
    echo "size=${size}B lines=$lines unsynced=$unsynced"
  else
    echo "ABSENT"
  fi
} > "$BUNDLE_DIR/corpus-status.txt"

# ── Watchdog / health ─────────────────────────────────────────────────────────
{
  echo "=== WATCHDOG EVENTS (last 100 lines) ==="
  grep -i "watchdog\|TEMP\|DISK\|MEMORY\|CORPUS INTEGRITY" /var/log/clubhub/player.log 2>/dev/null | tail -100 \
    || echo "No watchdog events found"
} > "$BUNDLE_DIR/watchdog-events.txt"

# ── Config (sanitized — no secrets) ──────────────────────────────────────────
{
  echo "=== SCREEN CONFIG (sanitized) ==="
  # Show config but mask any passwords/tokens
  grep -v -E "PASSWORD|TOKEN|SECRET|KEY" "$SCREEN_ENV" 2>/dev/null || echo "screen.env not found"
} > "$BUNDLE_DIR/config-sanitized.txt"

# ── SD card health (if smartmontools available) ───────────────────────────────
smartctl -a /dev/mmcblk0 2>/dev/null > "$BUNDLE_DIR/sdcard-health.txt" \
  || echo "smartctl not available (install: apt-get install smartmontools)" > "$BUNDLE_DIR/sdcard-health.txt"

# ── Pack ──────────────────────────────────────────────────────────────────────
tar -czf "$BUNDLE_FILE" -C "$BUNDLE_DIR" .
echo "[diagnostics] Bundle: $BUNDLE_FILE ($(du -h "$BUNDLE_FILE" | awk '{print $1}'))"

# ── Upload ────────────────────────────────────────────────────────────────────
if [ "$UPLOAD" = true ] && [ -n "${CMS_API_URL:-}" ] && [ -n "${SCREEN_ID:-}" ]; then
  echo "[diagnostics] Uploading to $CMS_API_URL..."
  HTTP_CODE=$(curl -sf --max-time 30 \
    -X POST "$CMS_API_URL/api/v2/screens/$SCREEN_ID/diagnostics" \
    -F "bundle=@$BUNDLE_FILE" \
    -F "screen_id=$SCREEN_ID" \
    -F "collected_at=$TIMESTAMP" \
    -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "[diagnostics] Upload successful."
  else
    echo "[diagnostics] Upload failed (HTTP $HTTP_CODE). Bundle saved locally: $BUNDLE_FILE"
  fi
fi

if [ "$STDOUT_MODE" = true ]; then
  cat "$BUNDLE_FILE"
else
  echo "[diagnostics] Done. Retrieve with: scp clubhub@<ip>:$BUNDLE_FILE ."
fi
