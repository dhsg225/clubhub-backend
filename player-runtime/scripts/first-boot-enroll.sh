#!/bin/bash
# ClubHub TV — First-boot enrollment script
#
# Run ONCE on first boot after flashing the golden image.
# Reads ENROLLMENT_TOKEN from /etc/clubhub/screen.env.bootstrap
# Calls CMS API to register this device, writes final screen.env
# Then starts the player-runtime via PM2.
#
# If enrollment fails: retries every 30s indefinitely (API may be temporarily unreachable).
# If token is invalid/expired: logs error, waits for manual intervention.
#
# IDEMPOTENCY: if /etc/clubhub/screen.env already exists with SCREEN_ID set,
# enrollment is considered complete — script exits without re-enrolling.
#
# What technicians will do wrong:
#   - Flash same image to two devices without updating ENROLLMENT_TOKEN
#     → second enrollment attempt fails with 401 (token already claimed)
#   - Power-cycle during enrollment leaving partial screen.env
#     → detected by missing SCREEN_ID; re-enrollment retried

set -euo pipefail

BOOTSTRAP_ENV="/etc/clubhub/screen.env.bootstrap"
FINAL_ENV="/etc/clubhub/screen.env"
LOG_FILE="/var/log/clubhub/enrollment.log"
PLAYER_DIR="/opt/clubhub/player"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

# ── Guard: already enrolled ───────────────────────────────────────────────────
if [ -f "$FINAL_ENV" ] && grep -q "^SCREEN_ID=.\+" "$FINAL_ENV" 2>/dev/null; then
  log "Already enrolled. SCREEN_ID present in $FINAL_ENV. Skipping enrollment."
  exec pm2 start "$PLAYER_DIR/ecosystem.config.js" --env production
fi

# ── Read bootstrap config ─────────────────────────────────────────────────────
if [ ! -f "$BOOTSTRAP_ENV" ]; then
  log "FATAL: $BOOTSTRAP_ENV not found. Cannot enroll without token."
  log "       Re-flash device with correct bootstrap configuration."
  exit 1
fi

source "$BOOTSTRAP_ENV"

if [ -z "${ENROLLMENT_TOKEN:-}" ]; then
  log "FATAL: ENROLLMENT_TOKEN not set in $BOOTSTRAP_ENV"
  exit 1
fi

if [ -z "${CMS_API_URL:-}" ]; then
  log "FATAL: CMS_API_URL not set in $BOOTSTRAP_ENV"
  exit 1
fi

# ── Collect hardware fingerprint ──────────────────────────────────────────────
# Combines MAC address + CPU serial for a stable, unique identifier
get_hardware_id() {
  local mac serial combined
  mac=$(cat /sys/class/net/eth0/address 2>/dev/null \
        || cat /sys/class/net/wlan0/address 2>/dev/null \
        || echo "00:00:00:00:00:00")
  serial=$(cat /proc/cpuinfo 2>/dev/null | grep Serial | awk '{print $3}' || echo "unknown")
  combined="${mac}::${serial}"
  echo "$combined" | sha256sum | awk '{print $1}'
}

HARDWARE_ID=$(get_hardware_id)
FIRMWARE_VERSION=$(cat "$PLAYER_DIR/VERSION" 2>/dev/null || echo "unknown")
OS_VERSION=$(uname -r)
IP_ADDRESS=$(hostname -I | awk '{print $1}')

log "Starting enrollment: hardware_id=${HARDWARE_ID:0:16}... firmware=$FIRMWARE_VERSION"

# ── Enrollment loop ───────────────────────────────────────────────────────────
RETRY_INTERVAL=30
MAX_RETRIES=288  # 288 × 30s = 2.4h max wait

for attempt in $(seq 1 $MAX_RETRIES); do
  log "Enrollment attempt $attempt/$MAX_RETRIES..."

  RESPONSE=$(curl -sf \
    --max-time 15 \
    --retry 0 \
    -X POST "$CMS_API_URL/api/v2/enroll" \
    -H "Content-Type: application/json" \
    -d "{
      \"enrollment_token\": \"$ENROLLMENT_TOKEN\",
      \"hardware_id\": \"$HARDWARE_ID\",
      \"firmware_version\": \"$FIRMWARE_VERSION\",
      \"os_version\": \"$OS_VERSION\",
      \"ip_address\": \"$IP_ADDRESS\"
    }" 2>/dev/null) || true

  if [ -z "$RESPONSE" ]; then
    log "No response from API (network issue?). Retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
    continue
  fi

  HTTP_STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('screen_id',''))" 2>/dev/null || echo "")

  # Check for fatal errors (token invalid/expired/claimed by other device)
  if echo "$RESPONSE" | grep -q '"Invalid enrollment token"'; then
    log "FATAL: Token is invalid. Contact support to generate a new enrollment token."
    log "       This device cannot self-recover. Manual intervention required."
    exit 1
  fi
  if echo "$RESPONSE" | grep -q '"already claimed by a different device"'; then
    log "FATAL: Token was claimed by a different device. Contact support."
    exit 1
  fi
  if echo "$RESPONSE" | grep -q '"expired"'; then
    log "FATAL: Enrollment token has expired. Contact support to generate a new token."
    exit 1
  fi

  # Extract screen_id from response
  SCREEN_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('screen_id') or d.get('config', {}).get('SCREEN_ID', ''))
" 2>/dev/null || echo "")

  VENUE_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('venue_id') or d.get('config', {}).get('VENUE_ID', ''))
" 2>/dev/null || echo "")

  if [ -n "$SCREEN_ID" ] && [ -n "$VENUE_ID" ]; then
    log "Enrollment successful! screen_id=$SCREEN_ID venue_id=$VENUE_ID"
    break
  fi

  log "Unexpected response. Retrying in ${RETRY_INTERVAL}s... Response: ${RESPONSE:0:200}"
  sleep "$RETRY_INTERVAL"
done

if [ -z "${SCREEN_ID:-}" ]; then
  log "FATAL: Enrollment failed after $MAX_RETRIES attempts."
  exit 1
fi

# ── Write final screen.env ────────────────────────────────────────────────────
cat > "$FINAL_ENV" <<EOF
# Generated by first-boot-enroll.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# DO NOT EDIT MANUALLY — managed by OTA update system
SCREEN_ID=$SCREEN_ID
VENUE_ID=$VENUE_ID
CMS_API_URL=$CMS_API_URL
CORPUS_CACHE_DIR=/var/clubhub/corpus
REPLAY_CACHE_DIR=/var/clubhub/replay
ASSET_DIR=/var/clubhub/assets
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
WEBSOCKET_PORT=7777
LOG_LEVEL=INFO
EOF
chmod 640 "$FINAL_ENV"
chown clubhub:clubhub "$FINAL_ENV"

log "screen.env written. Starting player-runtime..."

# ── Write factory corpus placeholder ─────────────────────────────────────────
# Factory corpus will be downloaded on first sync. Placeholder signals "no corpus yet".
mkdir -p /var/clubhub/corpus

# ── Start player-runtime ──────────────────────────────────────────────────────
su -s /bin/bash clubhub -c "pm2 start $PLAYER_DIR/ecosystem.config.js --env production"
pm2 save
log "Enrollment and startup complete."
