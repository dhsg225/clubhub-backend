# Enrollment Troubleshooting Runbook

**Symptom:** Pi boots but stays on factory corpus. Fleet dashboard shows `corpus_load_source=factory` and `CORPUS_CRITICAL` warning.

---

## Step 1: Check enrollment status on the Pi

SSH into the Pi (or connect a keyboard/monitor) and confirm enrollment state:

```bash
# Check if enrollment sentinel exists
ls -la /var/lib/clubhub/.enrolled

# Check if player env has SCREEN_ID
cat /etc/clubhub/player.env
```

If `.enrolled` exists and `player.env` has a valid `SCREEN_ID`, the Pi is enrolled but not syncing corpus. Proceed to [03-player-recovery runbook](./03-player-recovery.md).

If `.enrolled` does not exist, the Pi failed enrollment. Continue below.

---

## Step 2: Check enrollment service logs

```bash
journalctl -u clubhub-firstboot --no-pager -n 50
```

Look for the specific error at the bottom of the log output. The log tag is `[clubhub-firstboot]`.

---

## Common failure modes

### Network not available at boot

**Log shows:**
```
[clubhub-firstboot] Network not ready (attempt N/30) — waiting 10s...
[clubhub-firstboot] CMS API not reachable after 30 attempts
```

**Cause:** Pi attempted enrollment before network was ready. This is normal on first boot with a slow DHCP server or when the network switch port takes time to come up.

**Fix:**
```bash
# Confirm ethernet is connected and has an IP
ip addr show eth0

# Check networking service status
systemctl status networking
# or on Raspberry Pi OS:
systemctl status dhcpcd
```

If network is up but CMS API is unreachable, check firewall rules and DNS resolution:
```bash
nslookup cms.yourvenue.clubhub.tv
curl -v https://cms.yourvenue.clubhub.tv/health/live
```

**Re-run enrollment:**
```bash
systemctl restart clubhub-firstboot
```

---

### Captive portal

**Log shows:**
```
[clubhub-firstboot] WARN: Response is not JSON — likely captive portal redirect
```

**Cause:** The venue network has a captive portal (hotel/café-style login page) that intercepts the enrollment HTTP request.

**Fix:** Pre-configure the network to bypass the captive portal, or enroll via a USB hotspot / tethered mobile connection. The Pi's MAC address may need to be whitelisted in the network's captive portal settings.

---

### Invalid or expired enrollment token

**Log shows:**
```
[clubhub-firstboot] ERROR: Enrollment token rejected (HTTP 401)
[clubhub-firstboot] ERROR: PERMANENT FAILURE: token is invalid or expired.
```

or for re-enrollment:
```
[clubhub-firstboot] WARN: Re-enrollment token expired (HTTP 410)
```

**Cause:** The token in `/etc/clubhub/enrollment.env` (or `/etc/clubhub/reenroll.token`) has expired or was already used.

**Fix:**
1. Issue a new token from the CMS operator panel
2. For initial enrollment: update `/etc/clubhub/enrollment.env` with the new `ENROLLMENT_TOKEN`
3. For re-enrollment: write the new token to `/etc/clubhub/reenroll.token`
4. Re-run:
   ```bash
   systemctl restart clubhub-firstboot
   ```

---

### CMS API unreachable

**Log shows:**
```
[clubhub-firstboot] WARN: Enrollment failed (HTTP 000) — retrying in Ns
```

HTTP status `000` means curl could not connect at all (DNS failure, connection refused, timeout).

**Fix:**
```bash
# Verify CMS_API_URL in enrollment config
cat /etc/clubhub/enrollment.env

# Test connectivity manually
curl -v "$CMS_API_URL/health/live"
```

Check:
- Firewall rules on the venue network (port 443 must be open)
- VPN or proxy requirements
- Whether the CMS API URL is correct (typo, staging vs production)

---

### Token already used

**Log shows:**
```
[clubhub-firstboot] WARN: Re-enrollment token already used (HTTP 409)
```

**Cause:** The re-enrollment token was already consumed by a previous successful (or failed-after-consume) enrollment attempt.

**Fix:** Issue a new token — each token is single-use by design. The consumed token cannot be reused. If the previous enrollment succeeded but the sentinel was not written (rare edge case), check if `SCREEN_ID` is present in `/etc/clubhub/player.env` and manually write the sentinel:

```bash
# Only do this if you confirmed enrollment succeeded in CMS
touch /var/lib/clubhub/.enrolled
```

---

## Manual enrollment (emergency)

If automated enrollment is not working and the Pi needs to go live immediately:

```bash
# Get SCREEN_ID and VENUE_ID from CMS (operator console or API)
# Then set them manually:

cat > /etc/clubhub/player.env << EOF
# ClubHub player runtime environment
# Manually provisioned on $(date -u)
CMS_API_URL=https://cms.yourvenue.clubhub.tv
SCREEN_ID=<uuid from CMS>
VENUE_ID=<venue_uuid>
CORPUS_CACHE_DIR=/var/lib/clubhub/corpus
REPLAY_CACHE_DIR=/var/lib/clubhub/replay
ASSET_DIR=/var/lib/clubhub/assets
COMMAND_HISTORY_PATH=/var/lib/clubhub/command-history/history.jsonl
WEBSOCKET_PORT=7777
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
EOF

# Create runtime directories
mkdir -p /var/lib/clubhub/corpus \
         /var/lib/clubhub/replay \
         /var/lib/clubhub/assets \
         /var/lib/clubhub/command-history

# Write sentinel to prevent re-enrollment attempts
echo "enrolled_at=$(date -u +%Y-%m-%dT%H:%M:%SZ) screen_id=<screen_id> manually_enrolled=true" \
  > /var/lib/clubhub/.enrolled

# Start the player
systemctl start clubhub-player
```

This bypasses the enrollment API entirely. The screen will appear in the fleet dashboard and receive corpus on its next poll.

---

## Escalation

If the enrollment token cannot be found in the CMS database (API returns 404 for the token), the operator may have provisioned the wrong `screen_id` or the token was never created. Contact the CMS administrator to verify which `screen_id` should be assigned to this physical location.
