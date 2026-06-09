# ClubHub TV — First Venue Acceptance Checklist

**Version:** 1.0
**Audience:** Field technicians, venue deployment engineers
**Purpose:** Step-by-step validation of a Raspberry Pi player from first boot to production-ready status

---

## Prerequisites

Before starting, confirm you have:

| Item | Required |
|------|----------|
| Raspberry Pi (4 or 5) with SD card flashed from golden image | ✓ |
| Screen / TV with HDMI cable | ✓ |
| Ethernet cable OR known WiFi credentials | ✓ |
| Laptop with SSH access (same network) | ✓ |
| CMS access (operator account with venue admin rights) | ✓ |
| Enrollment token generated in CMS for this venue | ✓ |
| CMS API URL | ✓ |

---

## Phase 1 — Boot Validation

> Goal: Pi boots cleanly, all services start automatically, no manual intervention required.

### Steps

**1.1** Connect HDMI to screen. Connect ethernet or ensure WiFi is pre-configured in image. Power on.

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Pi powers on | Green activity LED flashes | No LED activity | Hardware fault — check power supply (Pi 4 needs 3A) |
| OS boots | Screen shows Raspberry Pi boot text, then blank or kiosk surface | Boot loop or kernel panic visible | Connect keyboard; check `/var/log/syslog` |
| Network connectivity | DHCP lease obtained | No network activity | Run `ip addr` — check eth0 or wlan0 for inet address |
| Time synchronisation | `timedatectl` shows `NTP service: active` and `System clock synchronized: yes` | `synchronized: no` | `journalctl -u systemd-timesyncd` |
| Clubhub user exists | `id clubhub` returns uid | Command fails | Setup script did not run — re-flash image |
| PM2 systemd service | `systemctl is-active pm2-clubhub` returns `active` | `inactive` or `failed` | `journalctl -u pm2-clubhub -n 50` |

**SSH in to verify:**
```bash
ssh admin@<pi-ip>
timedatectl status
systemctl status pm2-clubhub
pm2 status
ip addr
```

**Pass criteria:** All 6 checks green. NTP synchronized. PM2 service active.

---

### Phase 1 Notes

- Hardware watchdog is enabled by setup script (`/boot/config.txt` → `dtparam=watchdog=on`). If kernel hangs, Pi reboots automatically within 15s.
- If WiFi was not pre-configured, connect ethernet and proceed. WiFi can be added later.
- `/var/log/clubhub/` directory must exist and be owned by `clubhub:clubhub`. If missing, setup script did not complete — re-flash.

---

## Phase 2 — Enrollment Validation

> Goal: Pi calls `/api/v2/enroll`, receives SCREEN_ID + VENUE_ID, writes `/etc/clubhub/screen.env`, survives reboot.

### Pre-step: Write bootstrap config

On the Pi (as root):
```bash
cat /etc/clubhub/screen.env.bootstrap
```
Confirm:
- `ENROLLMENT_TOKEN=<your-token>` is present
- `CMS_API_URL=https://api.clubhub.tv` (or your deployment URL) is present

If missing, write it:
```bash
cat > /etc/clubhub/screen.env.bootstrap << 'EOF'
ENROLLMENT_TOKEN=<token-from-cms>
CMS_API_URL=https://api.clubhub.tv
EOF
chmod 640 /etc/clubhub/screen.env.bootstrap
```

Then trigger enrollment:
```bash
bash /opt/clubhub/player/scripts/first-boot-enroll.sh
```

### Steps

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Enrollment API reachable | No `FATAL: No response` in log | `No response from API` retrying | `curl -sf https://api.clubhub.tv/health/live` — must return `{"status":"ok"}` |
| Token accepted | `Enrollment successful!` in log | `FATAL: Token is invalid` or `already claimed` | `/var/log/clubhub/enrollment.log` |
| SCREEN_ID written | `grep SCREEN_ID /etc/clubhub/screen.env` returns value | Missing or empty | Check API response logged in enrollment.log |
| VENUE_ID written | `grep VENUE_ID /etc/clubhub/screen.env` returns value | Missing or empty | Check API response logged in enrollment.log |
| Player starts after enrollment | `pm2 status` shows `clubhub-player` online | Process shows `errored` | `tail -100 /var/log/clubhub/player.log` |
| Reboot preserves identity | After `sudo reboot`, SCREEN_ID still in screen.env, PM2 restarts player automatically | Re-enrollment attempt in log | `/var/log/clubhub/enrollment.log` — must show `Already enrolled. Skipping.` |

**Verify:**
```bash
cat /etc/clubhub/screen.env
# Expect: SCREEN_ID=<uuid>, VENUE_ID=<uuid>

pm2 status
# Expect: clubhub-player | online | uptime >30s

sudo reboot
# Wait 90s, SSH back in
grep SCREEN_ID /etc/clubhub/screen.env
# Must be same value as before reboot
```

**Pass criteria:** SCREEN_ID and VENUE_ID present. Player running. Identity survives reboot.

---

### Enrollment Failure Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `FATAL: Token is invalid` | Token typed incorrectly or deleted | Generate new token in CMS |
| `already claimed by a different device` | Same token used on two Pis | Generate new token for this device |
| `expired` | Token older than 48h | Generate new token in CMS |
| `FATAL: /etc/clubhub/screen.env.bootstrap not found` | Bootstrap file not written | Write it as shown in pre-step above |
| Player starts but immediately errors | `SCREEN_ID` env var missing | Check `/etc/clubhub/screen.env` is readable by `clubhub` user (`chmod 640`, `chown clubhub:clubhub`) |

---

## Phase 3 — CMS Visibility

> Goal: Screen appears in CMS fleet view. Heartbeats arriving. Health indicators updating.

### Steps

Log in to CMS. Navigate to **Fleet → Screens** (or **Venue → Screens** for the specific venue).

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Screen appears in list | Screen visible with assigned name | Screen not listed | CMS → Venues → enrollment tokens — confirm token was claimed |
| Screen status | `HEALTHY` or `DEGRADED` (not `UNKNOWN`) | `UNKNOWN` | Player not sending heartbeats — `tail -f /var/log/clubhub/player.log` |
| Last seen timestamp | Updates every 30–90s | Frozen / stale | Heartbeat endpoint: `POST /api/v2/screens/:screen_id/heartbeat` — check player logs for POST errors |
| Corpus version | Shows `null` or a version ID | Error string | Normal on fresh enrollment — corpus version populates after first sync |
| Constitutional state | `HEALTHY` or `CORPUS_DEGRADED` (not `CORPUS_CRITICAL`) | `CORPUS_CRITICAL` | Factory content showing — corpus sync not yet complete (normal for first 60s) |

**API verification (optional):**
```bash
curl -s https://api.clubhub.tv/api/v2/fleet/health/screens/<screen_id> \
  -H "Authorization: Bearer <token>"
```
Expect: `status: HEALTHY` or `DEGRADED`. `chromium_alive: true` once Chromium starts.

**Pass criteria:** Screen visible in CMS. Heartbeats updating within 90s. No UNKNOWN status after 2 minutes.

---

## Phase 4 — Content Delivery

> Goal: Campaign created → approved → corpus delivered to player → playlist generated → renderer receives playlist.

### Steps

In CMS:

**4.1 Create a test campaign**
- Navigate to **Campaigns → New Campaign**
- Select this venue
- Add at least 2 media assets (video or image)
- Set schedule: starts now, ends +24h

**4.2 Approve the campaign**
- Move campaign status to `APPROVED` or `ACTIVE`
- Confirm status shows in campaign list

**4.3 Wait for corpus sync (up to 60s)**

The player polls `GET /api/v2/screens/:screen_id/corpus` every 60 seconds.

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Campaign approved | CMS shows campaign as `APPROVED` or `ACTIVE` | Stuck at `PENDING` | Campaign approval workflow in CMS |
| PRE resolves campaign | `/resolve/:screen_id` returns playlist with items | `playlist: []` | `GET /api/v2/resolve/<screen_id>` — check `reason_trace` field |
| Corpus delivered | Player log shows `[corpus-cache] Corpus updated` | No update after 2 minutes | `tail -f /var/log/clubhub/player.log` — look for corpus fetch errors |
| Asset URLs delivered | Corpus contains `asset_urls` with CDN URLs | Missing or empty | `GET /api/v2/screens/<screen_id>/corpus` — check `asset_urls` field |
| Assets downloadable | Player log shows `[asset-verifier] verified` or asset cached | 403 / 404 errors in log | CDN URL accessible from Pi: `curl -I <cdn_url>` |
| Playlist pushed to renderer | Player log shows `[emergency-renderer] PLAYLIST_UPDATE` sent | No PLAYLIST_UPDATE | WebSocket connection on port 7777 — check `chromium_alive` in heartbeat |

**Verify from Pi:**
```bash
tail -f /var/log/clubhub/player.log | grep -E "corpus|playlist|asset|resolve"
```

**Verify via API:**
```bash
curl -s https://api.clubhub.tv/api/v2/resolve/<screen_id>
# Expect: resolution_level 1-7, playlist with items, is_fallback: false
```

**Pass criteria:** Corpus synced. Assets cached. Playlist delivered to renderer with campaign content.

---

## Phase 5 — Playback Validation

> Goal: Video appears on screen. Loops correctly. Multiple assets rotate. Schedule changes apply. Emergency override functions.

### Steps

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Video visible on screen | Campaign content playing | Black screen or Chromium error page | See below |
| Audio behaviour | Audio plays if expected; no audio on display-only content | Unexpected audio / silence | Check campaign asset audio settings |
| Looping | Single asset plays, completes, restarts | Freezes on last frame | `pm2 logs clubhub-player --lines 50` — look for Chromium errors |
| Asset rotation | Multiple assets rotate in sequence | Same asset loops | Check playlist in player log — multiple items should be present |
| Schedule change | After updating campaign start/end in CMS, change appears on screen within 60s | Old content persists | Corpus poll interval is 60s — wait 90s, then check player log for corpus update |
| Emergency override | Sending `EMERGENCY_FREEZE` command via CMS → screen shows freeze overlay within 10s | No overlay / normal content continues | `POST /api/v2/screens/:screen_id/commands` with `command_type: EMERGENCY_FREEZE` |
| Emergency clear | Sending `EMERGENCY_CLEAR` → normal content resumes | Stays frozen | Requires operator auth — check remote-commands endpoint |

**Black screen diagnostic checklist:**
```
1. pm2 status — is clubhub-player online?
2. tail -50 /var/log/clubhub/player.log — any errors?
3. ps aux | grep chromium — is Chromium running?
4. CMS fleet health — is chromium_alive: true?
5. curl http://localhost:3001 — does player-ui respond? (port 3001)
6. ss -tlnp | grep 7777 — is WebSocket server listening?
```

**Pass criteria:** Video visible. Rotation working. Schedule changes apply within 90s. Emergency override activates and clears correctly.

---

## Phase 6 — Failure Tests

> Goal: Player survives common failure scenarios without manual intervention.

Run each test, record results in the table below.

### 6.1 CMS Restart

```bash
# On CMS server
docker compose restart cms-api
```

| Observation | Expected | Recorded Result |
|-------------|----------|-----------------|
| Player behaviour during restart | Continues playing from replay cache | |
| Recovery after CMS back online | Heartbeats resume within 90s | |
| Manual intervention required | No | |

---

### 6.2 Pi Reboot

```bash
sudo reboot
```

| Observation | Expected | Recorded Result |
|-------------|----------|-----------------|
| Boot time to content visible | < 90s | |
| Re-enrollment triggered | No — `enrollment.log` shows "Already enrolled" | |
| Previous content resumes | Yes — corpus loaded from cache | |
| PM2 auto-started | Yes — `pm2 status` shows online | |

---

### 6.3 Network Disconnect (5 minutes)

```bash
# Unplug ethernet or disable WiFi
sudo ip link set eth0 down
sleep 300
sudo ip link set eth0 up
```

| Observation | Expected | Recorded Result |
|-------------|----------|-----------------|
| Content during outage | Continues playing (72h autonomous window) | |
| Player log during outage | Corpus sync failure logged — `consecutive_sync_failures` incrementing | |
| Recovery after reconnect | Corpus sync resumes within 60s | |
| Heartbeats resume | Within 90s of reconnection | |
| Manual intervention required | No | |

**Warning thresholds to watch:** `consecutive_sync_failures >= 3` triggers `SYNC_DEGRADED` in CMS.

---

### 6.4 Network Reconnect Verification

After reconnect:
```bash
tail -f /var/log/clubhub/player.log | grep -E "sync|heartbeat|corpus"
```
Expect: `[corpus-cache] Corpus synced` and `[heartbeat] sent` within 90s.

---

### 6.5 Temporary CDN Outage

Simulate by blocking CDN host:
```bash
sudo iptables -A OUTPUT -d <cdn-domain-ip> -j DROP
sleep 300
sudo iptables -D OUTPUT -d <cdn-domain-ip> -j DROP
```

| Observation | Expected | Recorded Result |
|-------------|----------|-----------------|
| Content during outage | Continues playing from local asset cache | |
| Player log | Asset verification warnings — not fatal | |
| Recovery | Assets re-verified after iptables rule removed | |

---

### 6.6 Temporary API Outage (full)

```bash
# Block CMS API
sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP
sleep 300
sudo iptables -D OUTPUT -p tcp --dport 443 -j DROP
```

| Observation | Expected | Recorded Result |
|-------------|----------|-----------------|
| Content during outage | Continues from replay/corpus cache | |
| Constitutional state | `CORPUS_DEGRADED` if >4h stale, `CORPUS_CRITICAL` only if using factory content | |
| Recovery | Sync resumes within 60s of API returning | |
| Manual intervention required | No | |

---

## Phase 7 — Overnight Test

> Goal: System stable after 8+ hours unattended. No human intervention.

**Start:** Confirm content playing at end of Phase 6. Note time.

**Return next morning (8+ hours later).**

| Check | Expected Result | Failure Symptom | Diagnosis Location |
|-------|----------------|-----------------|-------------------|
| Content playing | Campaign content visible | Black screen | `pm2 status` — check if player was restarted |
| No frozen Chromium | `ps aux | grep chromium` returns running process | No Chromium process | PM2 restart log: `pm2 logs --lines 200 | grep restart` |
| Heartbeats current | CMS shows last-seen < 90s ago | Stale timestamp | `tail -100 /var/log/clubhub/player.log` |
| Memory within bounds | RSS < 400MB (warning) / < 512MB (watchdog exits) | Watchdog triggered memory exit in log | `pm2 describe clubhub-player | grep memory` |
| CPU within bounds | < 30% average | Sustained 100% | `top -b -n 3` |
| No asset corruption | Player log clean — no checksum errors | Repeated `[asset-verifier] FAILED` | `/var/log/clubhub/player.log` |
| Disk space adequate | > 500MB free on `/var/clubhub` | DISK_LOW warning in CMS | `df -h /var/clubhub` |
| Temperature safe | < 75°C (warn) / < 82°C (critical) | TEMP_HIGH warning in CMS | `cat /sys/class/thermal/thermal_zone0/temp` (divide by 1000 for °C) |
| Log rotation functioning | Log file < 10MB (if logrotate ran) | Single log file > 100MB | `ls -lh /var/log/clubhub/player.log` |

**Quick morning check commands:**
```bash
pm2 status
df -h /var/clubhub
cat /sys/class/thermal/thermal_zone0/temp
tail -20 /var/log/clubhub/player.log
```

**Pass criteria:** All 9 checks green. No manual intervention occurred overnight.

---

## Phase 8 — Acceptance Decision

### 8.1 Venue Ready

Minimum criteria to leave a venue operational:

| Criterion | Required State |
|-----------|---------------|
| Phase 1: Boot | PASS — all 6 checks |
| Phase 2: Enrollment | PASS — SCREEN_ID + VENUE_ID persistent |
| Phase 3: CMS Visibility | PASS — heartbeats updating |
| Phase 4: Content Delivery | PASS — corpus synced, playlist delivered |
| Phase 5: Playback | PASS — video visible, rotation working |
| Phase 6: Network disconnect | PASS — recovers without intervention |
| No CORPUS_CRITICAL state | PASS — not loading factory content |
| Emergency override | PASS — activates and clears |

**Verdict: VENUE READY** — system can be left with venue staff.

---

### 8.2 Pilot Ready

Additional criteria before running a commercial pilot:

| Criterion | Required State |
|-----------|---------------|
| All Venue Ready criteria | PASS |
| Phase 7: Overnight test | PASS — all 9 checks |
| Phase 6: All failure scenarios | PASS — all 6 scenarios |
| Memory stable over 8h | RSS growth < 50MB over 8h |
| Temperature safe in installed location | < 75°C in final mounting position |
| Schedule changes apply correctly | Verified in Phase 5 |
| Corpus version tracked in CMS | Visible in fleet health |

**Verdict: PILOT READY** — safe to run with paying customers present.

---

### 8.3 Production Ready

Full production sign-off:

| Criterion | Required State |
|-----------|---------------|
| All Pilot Ready criteria | PASS |
| Overnight test repeated across 3 nights | All PASS |
| Venue preflight gate | `make venue-preflight` returns 11/11 PASS |
| No `DEGRADED` warnings in CMS after 24h | All warnings resolved |
| OTA update received and applied | At least one OTA cycle completed |
| Remote reboot via CMS | REBOOT_DEVICE command confirmed working |
| Diagnostics bundle uploads successfully | `./diagnostics-bundle.sh --upload` succeeds |

**Verdict: PRODUCTION READY** — venue can be handed to operations team.

---

## Diagnostics Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `/etc/clubhub/screen.env` | Live device identity (SCREEN_ID, VENUE_ID) |
| `/etc/clubhub/screen.env.bootstrap` | Pre-enrollment bootstrap (ENROLLMENT_TOKEN) |
| `/var/log/clubhub/player.log` | Primary player runtime log |
| `/var/log/clubhub/enrollment.log` | Enrollment-specific log |
| `/var/clubhub/corpus/` | Corpus cache directory |
| `/var/clubhub/replay/` | Replay cache directory |
| `/var/clubhub/assets/` | Downloaded media asset cache |
| `/opt/clubhub/player/` | Player runtime installation |
| `/opt/clubhub/player/ecosystem.config.js` | PM2 config |

### Key Commands

```bash
# Process status
pm2 status
pm2 logs clubhub-player --lines 100

# Identity
cat /etc/clubhub/screen.env

# Live log
tail -f /var/log/clubhub/player.log

# Restart player (without reboot)
pm2 restart clubhub-player

# Full diagnostics bundle
bash /opt/clubhub/player/scripts/diagnostics-bundle.sh --upload

# Disk
df -h /var/clubhub

# Temperature
cat /sys/class/thermal/thermal_zone0/temp

# Network
ip addr
curl -sf https://api.clubhub.tv/health/live
```

### Key CMS API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health/live` | CMS liveness check |
| `GET /health/ready` | CMS readiness check |
| `POST /api/v2/enroll` | Player enrollment |
| `GET /api/v2/resolve/:screen_id` | PRE resolution |
| `GET /api/v2/screens/:screen_id/corpus` | Corpus delivery |
| `POST /api/v2/screens/:screen_id/heartbeat` | Heartbeat ingestion |
| `GET /api/v2/fleet/health` | Fleet health summary |
| `GET /api/v2/fleet/health/screens/:screen_id` | Per-screen health detail |
| `POST /api/v2/screens/:screen_id/commands` | Issue remote command |
| `POST /api/v2/venues/:venue_id/enrollment-tokens` | Create enrollment token |

### Health Warning Reference

| CMS Warning | Threshold | Field Action |
|-------------|-----------|--------------|
| `SYNC_DEGRADED` | 3+ consecutive sync failures | Check venue internet. Check CMS API status. |
| `DISK_LOW` | < 200MB free | `du -sh /var/clubhub/*` — rotate replay cache |
| `MEMORY_HIGH` | RSS > 400MB | `pm2 restart clubhub-player` |
| `TEMP_HIGH` | > 75°C | Improve AV cabinet ventilation. Check heatsink. |
| `CORPUS_DEGRADED` | Loading previous corpus | SD card read issues likely. Replace within 72h. |
| `CORPUS_CRITICAL` | Loading factory content | Re-image SD card. |
| `URL_EXPIRING` | CDN URLs expire < 4h | Player offline — check connectivity |
| `CORPUS_STALE` | Corpus > 4h old | Connectivity or CMS issue — check heartbeat |
| `CHROMIUM_DEAD` | Chromium process not running | Issue `RESTART_RUNTIME` command from CMS |
| `NTP_DESYNC` | Clock drift > 60s | Check NTP. PRE scheduling may be incorrect. |

---

## Acceptance Sign-Off

| Phase | Result | Technician | Date |
|-------|--------|------------|------|
| Phase 1: Boot Validation | PASS / FAIL | | |
| Phase 2: Enrollment Validation | PASS / FAIL | | |
| Phase 3: CMS Visibility | PASS / FAIL | | |
| Phase 4: Content Delivery | PASS / FAIL | | |
| Phase 5: Playback Validation | PASS / FAIL | | |
| Phase 6: Failure Tests | PASS / FAIL | | |
| Phase 7: Overnight Test | PASS / FAIL | | |
| **Final Verdict** | VENUE READY / PILOT READY / PRODUCTION READY / FAIL | | |

**Notes:**

_________________________________
_________________________________
_________________________________

---

*ClubHub TV — Deployment Checklist v1.0*
