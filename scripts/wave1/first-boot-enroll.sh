#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClubHub TV — First-Boot Enrollment
#
# Runs once at first boot via clubhub-firstboot.service.
# Enrolls this Pi against the CMS API, writes SCREEN_ID/VENUE_ID into
# /etc/clubhub/player.env, and creates /var/lib/clubhub/.enrolled sentinel.
#
# Safe to re-run: if .enrolled sentinel exists, exits immediately (success).
#
# Failure modes handled:
#   - Captive portal (HTTP 302/200 non-JSON response)
#   - DNS failure (curl: could not resolve)
#   - Expired/invalid token (CMS returns 401/422)
#   - API temporarily unavailable (5xx, connection refused)
#   - Missing ENROLLMENT_TOKEN env var
#
# On permanent failure: exits non-zero. clubhub-firstboot.service enters
# "failed" state. clubhub-player.service starts anyway with factory corpus.
# Fleet dashboard shows corpus_load_source=factory — operator is alerted.
#
# Configuration (from /etc/clubhub/enrollment.env):
#   ENROLLMENT_TOKEN   — single-use token issued by CMS operator
#   CMS_API_URL        — e.g. https://api.clubhub.tv
#   VENUE_HINT         — optional venue_id hint for CMS validation
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────
SENTINEL="/var/lib/clubhub/.enrolled"
PLAYER_ENV="/etc/clubhub/player.env"
ENROLLMENT_ENV="/etc/clubhub/enrollment.env"
LOG_TAG="clubhub-firstboot"

MAX_ATTEMPTS=12          # ~1 hour at max backoff
BASE_DELAY_S=10
MAX_DELAY_S=300          # 5 minute ceiling
ENROLL_TIMEOUT_S=15

# ── Logging (goes to journald via systemd) ─────────────────────────────────
log()  { echo "[$LOG_TAG] $*"; }
warn() { echo "[$LOG_TAG] WARN: $*" >&2; }
err()  { echo "[$LOG_TAG] ERROR: $*" >&2; }

# ── Idempotency guard ─────────────────────────────────────────────────────────
if [[ -f "$SENTINEL" ]]; then
  log "Already enrolled (sentinel found). Exiting."
  exit 0
fi

log "=== ClubHub First-Boot Enrollment ==="
log "Hostname: $(hostname)"
log "Date: $(date -u)"

# ── Load enrollment config ────────────────────────────────────────────────────
if [[ ! -f "$ENROLLMENT_ENV" ]]; then
  err "Enrollment config not found: $ENROLLMENT_ENV"
  err "Cannot enroll without ENROLLMENT_TOKEN and CMS_API_URL."
  err "Write /etc/clubhub/enrollment.env before first boot."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENROLLMENT_ENV"

ENROLLMENT_TOKEN="${ENROLLMENT_TOKEN:-}"
CMS_API_URL="${CMS_API_URL:-}"
VENUE_HINT="${VENUE_HINT:-}"

if [[ -z "$ENROLLMENT_TOKEN" ]]; then
  err "ENROLLMENT_TOKEN is empty in $ENROLLMENT_ENV"
  exit 1
fi
if [[ -z "$CMS_API_URL" ]]; then
  err "CMS_API_URL is empty in $ENROLLMENT_ENV"
  exit 1
fi

# ── Hardware identity ─────────────────────────────────────────────────────────
# Use CPU serial as stable hardware ID (survives OS re-image, unique per Pi)
HARDWARE_ID=""
if [[ -f /proc/cpuinfo ]]; then
  HARDWARE_ID="$(grep -m1 'Serial' /proc/cpuinfo | awk '{print $3}' | tr -d '[:space:]')"
fi
if [[ -z "$HARDWARE_ID" ]]; then
  # Fallback: MAC address of first ethernet interface
  HARDWARE_ID="$(cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' || echo "unknown")"
fi

FIRMWARE_VERSION="$(cat /proc/device-tree/model 2>/dev/null | tr -d '\0' || echo "unknown")"
log "Hardware ID: $HARDWARE_ID"
log "Firmware: $FIRMWARE_VERSION"
log "CMS API: $CMS_API_URL"

# ── Network readiness ─────────────────────────────────────────────────────────
# Wait for DNS resolution before attempting enrollment
wait_for_network() {
  local attempt=0
  local max=30
  log "Waiting for network/DNS..."
  while [[ $attempt -lt $max ]]; do
    if curl -sf --max-time 5 --head "$CMS_API_URL/health/live" \
         -o /dev/null 2>/dev/null; then
      log "CMS API reachable."
      return 0
    fi
    attempt=$((attempt + 1))
    log "Network not ready (attempt $attempt/$max) — waiting 10s..."
    sleep 10
  done
  warn "CMS API not reachable after ${max} attempts — will retry enrollment anyway"
  return 0  # Non-fatal: enrollment retry loop will handle it
}

wait_for_network

# ── Re-enrollment support ─────────────────────────────────────────────────────
# If /etc/clubhub/reenroll.token exists, attempt re-enrollment first.
# This is used during hardware replacement to reclaim the same screen_id.
REENROLL_TOKEN_FILE="/etc/clubhub/reenroll.token"
REENROLLED=false

try_reenrollment() {
  if [[ ! -f "$REENROLL_TOKEN_FILE" ]]; then
    return 0  # No re-enrollment token — proceed with normal enrollment
  fi

  REENROLL_TOKEN="$(cat "$REENROLL_TOKEN_FILE" | tr -d '[:space:]')"
  if [[ -z "$REENROLL_TOKEN" ]]; then
    warn "Re-enrollment token file exists but is empty — skipping re-enrollment"
    return 0
  fi

  log "Re-enrollment token found at $REENROLL_TOKEN_FILE — attempting re-enrollment"

  BODY="$(printf '{"token":"%s","hardware_id":"%s","firmware_version":"%s"}' \
    "$REENROLL_TOKEN" "$HARDWARE_ID" "$FIRMWARE_VERSION")"

  HTTP_STATUS=""
  RESPONSE="$(curl -sf \
    --max-time "$ENROLL_TIMEOUT_S" \
    --connect-timeout 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    -w "\n__HTTP_STATUS__%{http_code}" \
    "$CMS_API_URL/api/v2/enrollment/re-enroll" 2>/dev/null)" || true

  if [[ -n "$RESPONSE" ]]; then
    HTTP_STATUS="$(echo "$RESPONSE" | grep '__HTTP_STATUS__' | sed 's/__HTTP_STATUS__//')"
    RESPONSE_BODY="$(echo "$RESPONSE" | grep -v '__HTTP_STATUS__')"
  else
    HTTP_STATUS="000"
    RESPONSE_BODY=""
  fi

  log "Re-enrollment HTTP status: $HTTP_STATUS"

  if [[ "$HTTP_STATUS" == "200" ]]; then
    log "Re-enrollment successful!"

    SCREEN_ID="$(echo "$RESPONSE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('screen_id',''))" 2>/dev/null || echo "")"
    VENUE_ID="$(echo "$RESPONSE_BODY"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('venue_id',''))" 2>/dev/null || echo "")"

    if [[ -z "$SCREEN_ID" || -z "$VENUE_ID" ]]; then
      err "Re-enrollment response missing screen_id or venue_id: $RESPONSE_BODY"
      return 1
    fi

    log "Re-enrolled Screen ID: $SCREEN_ID"
    log "Re-enrolled Venue ID:  $VENUE_ID"

    # Write player environment
    mkdir -p "$(dirname "$PLAYER_ENV")"
    cat > "$PLAYER_ENV" << ENV
# ClubHub player runtime environment
# Written by first-boot-enroll.sh on $(date -u) (re-enrollment)
# DO NOT EDIT — re-run enrollment to update

SCREEN_ID=$SCREEN_ID
VENUE_ID=$VENUE_ID
CMS_API_URL=$CMS_API_URL
CORPUS_CACHE_DIR=/var/lib/clubhub/corpus
REPLAY_CACHE_DIR=/var/lib/clubhub/replay
ASSET_DIR=/var/lib/clubhub/assets
COMMAND_HISTORY_PATH=/var/lib/clubhub/command-history/history.jsonl
WEBSOCKET_PORT=7777
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
ENV

    # Create runtime dirs
    mkdir -p /var/lib/clubhub/corpus \
             /var/lib/clubhub/replay \
             /var/lib/clubhub/assets \
             /var/lib/clubhub/command-history

    # Remove token file — single-use, must not be replayed
    rm -f "$REENROLL_TOKEN_FILE"
    log "Re-enrollment token file removed (single-use consumed)"

    # Write enrollment sentinel
    echo "enrolled_at=$(date -u +%Y-%m-%dT%H:%M:%SZ) screen_id=$SCREEN_ID re_enrolled=true" > "$SENTINEL"

    log "Player env written to $PLAYER_ENV"
    log "Sentinel written to $SENTINEL"
    log "=== Re-enrollment complete. Player will start. ==="
    REENROLLED=true
    return 0

  elif [[ "$HTTP_STATUS" == "409" ]]; then
    warn "Re-enrollment token already used (HTTP 409) — token was consumed by a previous attempt"
    warn "Issue a new re-enrollment token from the CMS operator panel"
    warn "Falling back to normal enrollment"
    rm -f "$REENROLL_TOKEN_FILE"
    return 0

  elif [[ "$HTTP_STATUS" == "410" ]]; then
    warn "Re-enrollment token expired (HTTP 410)"
    warn "Issue a new re-enrollment token from the CMS operator panel (valid 48h)"
    warn "Falling back to normal enrollment"
    rm -f "$REENROLL_TOKEN_FILE"
    return 0

  else
    warn "Re-enrollment attempt failed (HTTP $HTTP_STATUS) — falling back to normal enrollment"
    warn "Response: $RESPONSE_BODY"
    return 0  # Non-fatal — fall back to normal enrollment
  fi
}

try_reenrollment

# Skip normal enrollment if re-enrollment succeeded
if [[ "$REENROLLED" == "true" ]]; then
  exit 0
fi

# ── Enrollment retry loop ─────────────────────────────────────────────────────
attempt=0
delay=$BASE_DELAY_S

while [[ $attempt -lt $MAX_ATTEMPTS ]]; do
  attempt=$((attempt + 1))
  log "Enrollment attempt $attempt/$MAX_ATTEMPTS..."

  # Build request body
  BODY="$(printf '{"enrollment_token":"%s","hardware_id":"%s","firmware_version":"%s","venue_hint":"%s"}' \
    "$ENROLLMENT_TOKEN" "$HARDWARE_ID" "$FIRMWARE_VERSION" "$VENUE_HINT")"

  # Call CMS enrollment endpoint
  HTTP_STATUS=""
  RESPONSE=""

  RESPONSE="$(curl -sf \
    --max-time "$ENROLL_TIMEOUT_S" \
    --connect-timeout 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    -w "\n__HTTP_STATUS__%{http_code}" \
    "$CMS_API_URL/api/v2/enroll" 2>/dev/null)" || true

  if [[ -n "$RESPONSE" ]]; then
    HTTP_STATUS="$(echo "$RESPONSE" | grep '__HTTP_STATUS__' | sed 's/__HTTP_STATUS__//')"
    RESPONSE_BODY="$(echo "$RESPONSE" | grep -v '__HTTP_STATUS__')"
  else
    HTTP_STATUS="000"
    RESPONSE_BODY=""
  fi

  log "HTTP status: $HTTP_STATUS"

  # ── Captive portal detection ────────────────────────────────────────────────
  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "302" ]]; then
    if ! echo "$RESPONSE_BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
      warn "Response is not JSON — likely captive portal redirect"
      warn "Connect this Pi to a network without a captive portal"
      sleep "$delay"
      delay=$(( delay * 2 < MAX_DELAY_S ? delay * 2 : MAX_DELAY_S ))
      continue
    fi
  fi

  # ── Permanent failures — do not retry ──────────────────────────────────────
  if [[ "$HTTP_STATUS" == "401" || "$HTTP_STATUS" == "422" ]]; then
    err "Enrollment token rejected (HTTP $HTTP_STATUS)"
    err "Response: $RESPONSE_BODY"
    err "PERMANENT FAILURE: token is invalid or expired."
    err "Issue a new enrollment token from the CMS operator panel and"
    err "write it to $ENROLLMENT_ENV, then: systemctl restart clubhub-firstboot"
    exit 1
  fi

  if [[ "$HTTP_STATUS" == "409" ]]; then
    # 409 = screen already enrolled with different hardware — re-enrollment path
    warn "Screen already enrolled with different hardware (HTTP 409)"
    warn "If replacing hardware, use: POST /api/v2/screens/:screen_id/re-enroll"
    warn "Response: $RESPONSE_BODY"
    exit 1
  fi

  # ── Success ────────────────────────────────────────────────────────────────
  if [[ "$HTTP_STATUS" == "201" ]]; then
    log "Enrollment successful!"

    # Parse response fields
    SCREEN_ID="$(echo "$RESPONSE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('screen_id',''))" 2>/dev/null || echo "")"
    VENUE_ID="$(echo "$RESPONSE_BODY"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('venue_id',''))" 2>/dev/null || echo "")"
    SCREEN_NAME="$(echo "$RESPONSE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('screen_name',''))" 2>/dev/null || echo "")"

    if [[ -z "$SCREEN_ID" || -z "$VENUE_ID" ]]; then
      err "Enrollment response missing screen_id or venue_id: $RESPONSE_BODY"
      exit 1
    fi

    log "Screen ID: $SCREEN_ID"
    log "Venue ID:  $VENUE_ID"
    log "Name:      $SCREEN_NAME"

    # Write player environment
    mkdir -p "$(dirname "$PLAYER_ENV")"
    cat > "$PLAYER_ENV" << ENV
# ClubHub player runtime environment
# Written by first-boot-enroll.sh on $(date -u)
# DO NOT EDIT — re-run enrollment to update

SCREEN_ID=$SCREEN_ID
VENUE_ID=$VENUE_ID
CMS_API_URL=$CMS_API_URL
CORPUS_CACHE_DIR=/var/lib/clubhub/corpus
REPLAY_CACHE_DIR=/var/lib/clubhub/replay
ASSET_DIR=/var/lib/clubhub/assets
COMMAND_HISTORY_PATH=/var/lib/clubhub/command-history/history.jsonl
WEBSOCKET_PORT=7777
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
ENV

    # Create runtime dirs
    mkdir -p /var/lib/clubhub/corpus \
             /var/lib/clubhub/replay \
             /var/lib/clubhub/assets \
             /var/lib/clubhub/command-history

    # Write enrollment sentinel — prevents re-run
    echo "enrolled_at=$(date -u +%Y-%m-%dT%H:%M:%SZ) screen_id=$SCREEN_ID" > "$SENTINEL"

    log "Player env written to $PLAYER_ENV"
    log "Sentinel written to $SENTINEL"
    log "=== Enrollment complete. Player will start. ==="
    exit 0
  fi

  # ── Transient failure — retry with backoff ─────────────────────────────────
  warn "Enrollment failed (HTTP $HTTP_STATUS) — retrying in ${delay}s (attempt $attempt/$MAX_ATTEMPTS)"
  sleep "$delay"
  # Exponential backoff with jitter (±20%)
  jitter=$(( (RANDOM % (delay / 5 + 1)) - (delay / 10) ))
  delay=$(( (delay * 2 + jitter) < MAX_DELAY_S ? (delay * 2 + jitter) : MAX_DELAY_S ))
done

err "=== ENROLLMENT FAILED after $MAX_ATTEMPTS attempts ==="
err "Player will start with factory corpus."
err "Screens in factory-corpus state are visible in the fleet dashboard."
err "Resolve the enrollment issue and run: systemctl restart clubhub-firstboot"
exit 1
