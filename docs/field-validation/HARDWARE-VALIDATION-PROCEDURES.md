# ClubHub TV — Physical Hardware Validation Procedures

**Document:** HARDWARE-VALIDATION-PROCEDURES.md
**Version:** Wave 1
**Date:** 2026-05-28
**Status:** EXECUTABLE — requires real Pi hardware

---

## Purpose

These procedures validate operational behaviors that **cannot be simulated**:
- Power loss at specific moments
- Physical network disruption
- SD card corruption
- Thermal behavior under ambient load
- Physical display connection changes
- Hardware watchdog activation

Each scenario requires a physical Raspberry Pi 4 (or 5) with production SD card image installed.

---

## Prerequisites

- Pi 4 or Pi 5 running ClubHub golden image (PROD or STAGING)
- Pi enrolled with test venue in CMS (use staging environment)
- Operator laptop with SSH access to Pi
- Smart PDU or switchable power strip for power control
- USB storage (≥8GB) with recovery image
- Network switch with VLAN isolation capability
- HDMI display connected to Pi
- CMS operator account (SUPERVISOR or higher)
- Fleet health dashboard open in browser

### Acceptance environment

| Item | Specification |
|------|---------------|
| Pi model | Raspberry Pi 4 Model B, 4GB RAM |
| SD card | Samsung Pro Endurance 32GB |
| Network | 100Mbps, switchable |
| Ambient temperature | 20–28°C |
| Display | 1080p HDMI |
| Image version | As per release manifest |

### Before starting

```bash
# 1. Confirm enrollment
ssh pi@<pi-ip> 'cat /etc/clubhub/player.env | grep SCREEN_ID'

# 2. Confirm player is running
ssh pi@<pi-ip> 'systemctl status clubhub-player'

# 3. Note corpus version at start
ssh pi@<pi-ip> 'cat /var/lib/clubhub/corpus/corpus.current.json | jq .corpus_version_id'

# 4. Confirm fleet health dashboard shows this screen as HEALTHY
```

---

## Scenario 1 — Abrupt Power Loss During Corpus Sync

### Purpose
Verify that corpus rotation (current → previous → factory) is atomic and that power loss during the staging→current rename does not corrupt the corpus.

### Setup
- Pi running with valid current corpus
- Monitor `/var/lib/clubhub/corpus/` before and after
- Stage a corpus update on CMS that Pi will pick up

### Execution

1. **Deploy a new corpus version** via CMS operator UI that differs from current Pi corpus
2. **Wait for Pi to detect the new version** (watch logs: `tail -f /var/log/syslog | grep corpus`)
3. **At the moment the "Applying corpus" log line appears**, cut power via PDU
4. **Restore power after 10 seconds**
5. **SSH into Pi after boot** and inspect corpus state

```bash
# Post-power-restore inspection
ssh pi@<pi-ip> 'ls -la /var/lib/clubhub/corpus/'
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.current.json 2>/dev/null || echo "CURRENT_MISSING"'
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.previous.json 2>/dev/null || echo "PREVIOUS_MISSING"'
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.factory.json 2>/dev/null || echo "FACTORY_MISSING"'
ssh pi@<pi-ip> 'systemctl status clubhub-player --no-pager'
```

### Expected behavior
- **One of three outcomes** is acceptable:
  - **A (best):** current = new corpus, previous = old corpus — apply completed before power loss
  - **B (acceptable):** current = old corpus, previous = old corpus — rotate not yet committed
  - **C (acceptable):** current.json missing, previous = old corpus — Pi loads from `previous` on boot
- **Unacceptable:** current corpus checksum does not match corpus JSON (corrupt partial write)
- **Unacceptable:** Factory corpus overwritten
- After boot, `systemctl status clubhub-player` shows `active (running)` within 60s

### Failure classification
- **CRITICAL (P1):** Corpus checksum mismatch after power restore — data corruption
- **MAJOR (P2):** Player does not restart within 60s after power restore
- **MINOR (P3):** Player loads from `previous` or `factory` instead of `current` — acceptable degraded behavior

### Recovery procedure
```bash
# If corpus is corrupt:
ssh pi@<pi-ip> 'sudo rm /var/lib/clubhub/corpus/corpus.current.json'
ssh pi@<pi-ip> 'sudo systemctl restart clubhub-player'
# Player will load from previous/factory, sync from CMS on next poll
```

### Audit expectations
- Corpus load source (`previous` or `factory`) reported in next heartbeat
- Fleet dashboard shows screen in DEGRADED state if on factory corpus
- Corpus sync restores HEALTHY state within 5 minutes

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Corpus checksum valid on surviving snapshots | Required | P1 |
| Factory corpus untouched | Required | P1 |
| Player restarts within 60s | Required | P2 |
| Player serves content (any level) within 5min | Required | P2 |
| Previous/factory load reported in heartbeat | Expected | P3 |

**Sign-off required from:** Lead Engineer

---

## Scenario 2 — ISP Outage + Reconnect Storm

### Purpose
Verify reconnect backoff prevents server overload when Pi comes back online after extended outage. Verify 72h autonomy: player continues serving content during outage.

### Setup
- Pi running with valid corpus and playlist cached
- CMS API accessible
- Network switch configured for VLAN isolation

### Execution

1. **Verify initial state**: playlist polling active, corpus up to date
2. **Cut network** at switch (isolate Pi VLAN)
3. **Wait 4 hours** (or simulate with clock advancement if doing a quick test)
4. **Restore network**
5. **Observe reconnect behavior** for 10 minutes

```bash
# During outage — run on Pi every 5min to confirm autonomous operation
ssh pi@<pi-ip> 'journalctl -u clubhub-player --since "1 min ago" | grep -E "playlist|corpus|fallback"'

# After reconnect — watch backoff behavior
ssh pi@<pi-ip> 'journalctl -u clubhub-player -f | grep -E "backoff|reconnect|sync|failures"'

# Check backoff counter progression
ssh pi@<pi-ip> 'journalctl -u clubhub-player --since "30 min ago" | grep "consecutive_sync_failures"'
```

### Expected behavior
- **During outage:**
  - Player continues serving last-known-good playlist (DEGRADED state acceptable)
  - Heartbeats fail silently, player does not crash
  - `consecutive_sync_failures` increments per poll cycle
  - No restart loop — player stays running
- **On reconnect:**
  - First sync attempt may fail (CMS not yet aware of connection)
  - Backoff: intervals increase (base → 2x → 4x ... 15min ceiling)
  - Jitter: reconnect attempts staggered (no thundering herd with fleet)
  - Within 2–3 poll cycles: successful corpus sync
  - State transitions: DEGRADED → HEALTHY in fleet dashboard
  - Backoff counter resets to 0

### Failure classification
- **CRITICAL (P1):** Player crashes during outage — restarts in a loop
- **CRITICAL (P1):** Player serves wrong content after reconnect (corpus mismatch)
- **MAJOR (P2):** Player does not reconnect within 10min of network restoration
- **MINOR (P3):** Reconnect takes >3 poll cycles — backoff may be too aggressive

### Reconnect storm simulation (fleet test)
When testing multiple Pis simultaneously, verify backoff jitter separates reconnect attempts:
```bash
# On each Pi at moment of network restore:
# Observe that reconnect times differ by at least 10s per device
# (±30s jitter window in reconnect-backoff.ts should achieve this)
```

### Audit expectations
- Audit records resume with new correlation_id after reconnect
- No audit gap reported as error — gap is expected during outage
- Fleet dashboard shows outage duration in screen timeline

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Player serves content throughout 4h outage | Required | P1 |
| Player restarts 0 times during outage | Required | P1 |
| Reconnect within 10min of network restore | Required | P2 |
| Backoff counter resets after reconnect | Expected | P3 |

**Sign-off required from:** Operations Lead

---

## Scenario 3 — SD Card Corruption Recovery

### Purpose
Verify USB recovery drive successfully restores Pi to known-good state when SD card is corrupt.

### Setup
- Pi with golden image installed
- USB recovery drive prepared with `usb-recovery-image.sh`
- Decision: `--preserve-identity` or `--reset-enrollment`

### Execution

**To simulate SD corruption:**
```bash
# Method A: corrupt filesystem (safest simulation)
ssh pi@<pi-ip> 'sudo dd if=/dev/urandom of=/dev/mmcblk0p2 bs=1M count=5 skip=10'
sudo reboot  # Pi will fail to boot into main OS

# Method B: for a more realistic test, use a known-bad SD card
```

**Recovery procedure:**
1. Power off Pi
2. Insert USB recovery drive
3. Power on Pi — recovery boots automatically
4. Wait for recovery to complete (5–10 minutes)
5. Recovery script reboots Pi when done
6. Remove USB when Pi reboots

**Post-recovery validation:**
```bash
ssh pi@<pi-ip> 'cat /var/log/last-recovery.log'
ssh pi@<pi-ip> 'systemctl status clubhub-player'
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.current.json'
```

### Expected behavior
- Recovery boots within 30s of power-on
- Image checksum verified before write (if checksum fails, recovery aborts with log)
- Write completes in 5–10 minutes (SD card speed dependent)
- Post-write checksum validation passes
- Pi reboots automatically into restored image
- `last-recovery.log` shows `=== Recovery Complete ===`
- If `--preserve-identity`: SCREEN_ID, VENUE_ID unchanged; player re-enrolls not needed
- If `--reset-enrollment`: player starts first-boot enrollment sequence

### Failure classification
- **CRITICAL (P1):** Recovery aborts due to checksum mismatch on USB image
- **CRITICAL (P1):** Restored Pi has wrong SCREEN_ID (identity not preserved correctly)
- **MAJOR (P2):** Recovery takes >20 minutes
- **MAJOR (P2):** Player does not start after recovery

### Recovery audit trail
- Recovery log written to `/var/log/last-recovery.log` on restored SD
- USB also retains recovery log (`/var/log/clubhub-recovery.log` on USB data partition)
- USB log survives Pi replacement and can be retrieved for post-mortem

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Image checksum verified before write | Required | P1 |
| Recovery completes without errors | Required | P1 |
| Player starts after recovery | Required | P2 |
| Identity preserved (if --preserve-identity) | Required | P1 |
| Recovery log available on USB | Expected | P3 |

**Sign-off required from:** Field Engineer

---

## Scenario 4 — Thermal Throttling

### Purpose
Verify player continues operating correctly when Pi CPU throttles due to heat. Player should degrade gracefully, not crash.

### Setup
- Pi 4 (more thermal-sensitive than Pi 5)
- Heatsink removed (or covered) to simulate inadequate cooling
- Venue ambient temperature: simulate with space heater if needed

### Execution

1. **Baseline temperature:**
```bash
ssh pi@<pi-ip> 'vcgencmd measure_temp'
# Record baseline (should be <50°C with heatsink in normal operation)
```

2. **Run sustained CPU load:**
```bash
ssh pi@<pi-ip> 'stress-ng --cpu 4 --timeout 300s &'
```

3. **Monitor throttling status:**
```bash
# Watch every 30s for 5 minutes
ssh pi@<pi-ip> 'while true; do
  echo "$(date -u) temp=$(vcgencmd measure_temp) throttled=$(vcgencmd get_throttled)"
  sleep 30
done'
```

4. **Observe player behavior** while throttled:
```bash
ssh pi@<pi-ip> 'journalctl -u clubhub-player -f'
```

### Expected behavior
- Throttling begins at ~80°C (Pi firmware-controlled)
- Player continues running — lower CPU speed but no crash
- Playlist polling may be delayed (watchdog may log warnings)
- Watchdog reports `temperature_celsius` in heartbeat
- Fleet dashboard shows elevated temperature indicator
- No `OOMKilled` or `segfault` in system logs
- Player recovers full performance when temperature drops

### Throttling indicators
```bash
# vcgencmd get_throttled returns hex flags
# 0x80008 = currently throttled
# 0x40000 = soft temp limit reached
ssh pi@<pi-ip> 'vcgencmd get_throttled'
```

### Operator-visible symptoms
- Fleet dashboard: temperature_celsius > 75°C (warning threshold)
- Playlist refresh delay > 2x normal interval
- Screen may show stuttering playback (frame drops)

### Failure classification
- **CRITICAL (P1):** Player process crashes during throttling
- **MAJOR (P2):** Player does not resume normal polling when temperature drops
- **MINOR (P3):** Fleet dashboard does not show elevated temperature

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Player stays running during throttling | Required | P1 |
| Temperature reported in heartbeat | Required | P2 |
| Player recovers when temperature normalizes | Required | P2 |

**Sign-off required from:** Lead Engineer

---

## Scenario 5 — HDMI Disconnect / Reconnect

### Purpose
Verify player handles HDMI hot-unplug/replug without crashing Chromium or corrupting display output.

### Setup
- Pi with display connected
- `hdmi_force_hotplug=1` confirmed in `/boot/config.txt`
- Chromium running with player-ui loaded

### Execution

1. **Unplug HDMI** while Pi is actively playing content
2. **Wait 60 seconds** with HDMI disconnected
3. **Replug HDMI**
4. **Observe display output recovery**

```bash
# During and after test
ssh pi@<pi-ip> 'journalctl -u clubhub-player --since "2 min ago"'
ssh pi@<pi-ip> 'ps aux | grep chromium'
```

### Expected behavior
- **On HDMI unplug:** Chromium continues running (no signal = no render, but process alive)
- **During disconnect:** Player continues corpus/playlist polling normally
- **On HDMI replug:** Display shows content within 30s (HDMI force-hotplug enables auto-detect)
- No player restart required
- No Chromium crash

### Known edge case
Pi 4 with HDMI 0 disconnected will drop to 1280x720 on reconnect if only HDMI 1 was used. This is a hardware behavior, not a player bug. Configure `hdmi_mode=16` (1080p) in config.txt to prevent resolution drop.

### Failure classification
- **CRITICAL (P1):** Chromium crashes on HDMI unplug — requires manual restart
- **MAJOR (P2):** Display does not show content within 60s of HDMI reconnect
- **MINOR (P3):** Resolution changes on reconnect (cosmetic, fix with config.txt)

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Chromium stays running during HDMI disconnect | Required | P1 |
| Content displays within 60s of HDMI reconnect | Required | P2 |
| No player restart required | Required | P2 |

**Sign-off required from:** Field Engineer

---

## Scenario 6 — Watchdog Forced Restart

### Purpose
Verify hardware watchdog correctly restarts a frozen Pi and that player resumes correctly after watchdog-triggered reboot.

### Setup
- Pi with watchdog enabled (`dtparam=watchdog=on` in config.txt)
- `watchdog.service` running and configured
- SSH access during test

### Execution

**Verify watchdog is active:**
```bash
ssh pi@<pi-ip> 'systemctl status watchdog'
ssh pi@<pi-ip> 'ls /dev/watchdog'
ssh pi@<pi-ip> 'cat /proc/sys/kernel/watchdog_thresh'
```

**Simulate a frozen system (kernel panic + reboot):**
```bash
# CAUTION: This triggers an actual reboot. Pi will be unreachable for ~60s
ssh pi@<pi-ip> 'echo 1 | sudo tee /proc/sys/kernel/sysrq && echo b | sudo tee /proc/sysrq-trigger'
```

**Alternatively, stall the watchdog daemon:**
```bash
ssh pi@<pi-ip> 'sudo systemctl stop watchdog'
# Watchdog hardware will reset the Pi within watchdog-timeout (15s in config)
```

**Post-restart validation:**
```bash
# Wait for Pi to come back (60-90s)
ssh pi@<pi-ip> 'systemctl status clubhub-player'
ssh pi@<pi-ip> 'last -n 5 | grep -E "reboot|system"'
ssh pi@<pi-ip> 'journalctl -u clubhub-player --since "2 min ago"'
```

### Expected behavior
- Watchdog timeout: 15s after daemon stops (configured in watchdog.conf)
- Pi reboots automatically (hardware-triggered)
- Player starts via systemd within 60s of boot
- Corpus loads from cache (offline boot works)
- Corpus sync resumes within 2 poll intervals
- Fleet dashboard shows brief OFFLINE then HEALTHY

### Failure classification
- **CRITICAL (P1):** Pi does not reboot after watchdog trigger (watchdog not functional)
- **CRITICAL (P1):** Player does not start after watchdog reboot
- **MAJOR (P2):** Player takes >3 minutes to reach HEALTHY state

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Pi reboots within 30s of watchdog trigger | Required | P1 |
| Player starts within 60s of boot | Required | P1 |
| Player reaches HEALTHY state | Required | P2 |

**Sign-off required from:** Lead Engineer

---

## Scenario 7 — Expired URL Recovery

### Purpose
Verify player detects asset URL expiry and triggers corpus resync to obtain fresh URLs, without operator intervention.

### Setup
- Pi running with corpus that has asset_urls with short TTL (configure test corpus with 5-minute TTL)
- Asset URL expiry tracking confirmed: `asset_url_expires_in_min` in heartbeat

### Execution

1. **Deploy a test corpus** with asset URLs set to expire in 10 minutes
2. **Verify player reports** `asset_url_expires_in_min` in heartbeat (check fleet dashboard)
3. **Wait for URLs to approach expiry** (within 5 minutes of expiry)
4. **Watch for urgent sync trigger:**

```bash
ssh pi@<pi-ip> 'journalctl -u clubhub-player -f | grep -E "expir|urgent|sync|asset"'
```

### Expected behavior
- When asset URLs expire in <15min: player logs "Asset URLs near expiry — prioritizing corpus sync"
- Player triggers off-schedule corpus sync
- New corpus obtained with fresh URLs
- `asset_url_expires_in_min` resets to new TTL value
- No content interruption during URL refresh

### Failure classification
- **MAJOR (P2):** Player does not trigger resync when URLs approaching expiry
- **MAJOR (P2):** Player continues serving content with expired URLs (CDN returns 403)
- **MINOR (P3):** Brief content interruption during URL refresh (<5s)

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Urgent sync triggered before URL expiry | Required | P2 |
| New corpus applied with fresh URLs | Required | P2 |
| No extended content outage from expired URLs | Required | P2 |

**Sign-off required from:** Operations Lead

---

## Scenario 8 — Rollback During Active Playback

### Purpose
Verify operator can rollback corpus while Pi is actively serving content, and Pi applies rollback gracefully.

### Setup
- Pi serving corpus version V2
- Previous corpus version V1 still available (within 7-day window)
- Operator ready to issue rollback via CMS

### Execution

1. **Verify current corpus version on Pi:**
```bash
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.current.json'
```

2. **Issue corpus rollback via CMS:**
```bash
# Via preflight check → rollback-impact → rollback
curl -X POST https://api.clubhub.tv/api/v2/corpus/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_group_id": "YOUR_GROUP_ID",
    "target_corpus_version_id": "PREVIOUS_VERSION_ID",
    "operator_id": "operator@venue.com",
    "human_approval_token": "APPROVAL_TOKEN",
    "reason": "Rollback test - Scenario 8"
  }'
```

3. **Watch Pi apply rollback** (within 60s of next poll):
```bash
ssh pi@<pi-ip> 'journalctl -u clubhub-player -f | grep -E "corpus|version|rollback"'
```

4. **Verify rollback applied:**
```bash
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.current.json'
# Should match PREVIOUS_VERSION_ID
```

### Expected behavior
- Rollback deployment created immediately (CMS records it)
- Pi detects version change on next corpus poll (≤60s)
- Checksum verified on new (rolled-back) corpus before apply
- Snapshot rotation: current (V2) → previous, rolled-back (V1) → current
- Content transitions to rolled-back content within 2 playlist refresh cycles
- No crash, no restart required

### Operator-visible symptoms
- Fleet dashboard: corpus version changes on affected screens
- Timeline event: `ROLLBACK` recorded with operator identity and reason
- Screen may show brief (1-2s) content interruption during playlist switch

### Failure classification
- **CRITICAL (P1):** Rollback to corrupt corpus version succeeds (checksum not verified)
- **MAJOR (P2):** Pi does not apply rollback within 3 poll intervals
- **MINOR (P3):** Brief visible content interruption during rollback

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Rollback checksum verified before apply | Required | P1 |
| Rollback applied within 3 poll intervals (≤3min) | Required | P2 |
| Player does not crash during rollback | Required | P1 |
| Fleet dashboard shows new corpus version | Required | P2 |

**Sign-off required from:** Operations Lead + Lead Engineer

---

## Scenario 9 — Offline Autonomy >72 Hours

### Purpose
Verify player continues serving content for more than 72 hours without CMS connectivity, then recovers when connectivity restores.

### Setup
- Pi with valid corpus and playlist cached locally
- Network isolation available
- Monitoring via serial console or OOB management (SSH will be unavailable)

### Execution

1. **Record baseline state:**
```bash
ssh pi@<pi-ip> 'jq . /var/lib/clubhub/corpus/corpus.current.json | head -5'
ssh pi@<pi-ip> 'date -u'
```

2. **Isolate network** (cut at switch)

3. **Every 12 hours** (via serial console if available, or accept gap):
```bash
# Check player still running
systemctl status clubhub-player
journalctl -u clubhub-player --since "12 hours ago" | tail -20
```

4. **At 72h mark, restore network:**
```bash
# Restore VLAN at switch
```

5. **Observe recovery:**
```bash
ssh pi@<pi-ip> 'journalctl -u clubhub-player -f'
```

### Expected behavior
- **Throughout 72h:**
  - Player stays running (no crash, no restart loop)
  - Content continues serving from cached playlist
  - `consecutive_sync_failures` increments but player does not stop
  - Backoff hits 15-minute ceiling and stays there (stops spamming connection attempts)
- **On reconnect:**
  - Backoff resets on first successful sync
  - Corpus sync completes within 2 poll intervals
  - Audit records for the outage period written on reconnect
  - Fleet dashboard shows OFFLINE→HEALTHY transition

### Autonomous window calculation
The 72h requirement is a constitutional minimum. Validate:
```bash
ssh pi@<pi-ip> 'jq .fetched_at /var/lib/clubhub/corpus/corpus.current.json'
# fetched_at + 72h = autonomous window expiry
```

### Failure classification
- **CRITICAL (P1):** Player crashes before 72h mark — constitutional violation
- **CRITICAL (P1):** Player serves wrong content after extended offline period
- **MAJOR (P2):** Player does not sync within 10min of network restore

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Player running at 24h mark | Required | P1 |
| Player running at 48h mark | Required | P1 |
| Player running at 72h mark | Required | P1 (constitutional) |
| Content serving throughout | Required | P1 |
| Sync resumes within 10min of reconnect | Required | P2 |

**Sign-off required from:** Lead Engineer + CTO

---

## Scenario 10 — Full USB Device Recovery

### Purpose
End-to-end test of the complete USB recovery workflow. Validates the entire recovery path from "corrupted Pi" to "operational Pi" using production-built recovery media.

### Setup
- Pi with intentionally corrupted SD card (from Scenario 3)
- USB recovery drive prepared with current golden image
- No prior enrollment data (fresh recovery test)

### Execution

Complete Scenario 3 execution steps, then add:

1. **Post-recovery verification:**
```bash
ssh pi@<pi-ip> 'cat /var/log/last-recovery.log'
ssh pi@<pi-ip> 'jq .corpus_version_id /var/lib/clubhub/corpus/corpus.factory.json'
ssh pi@<pi-ip> 'systemctl status clubhub-firstboot'
```

2. **If reset-enrollment**: verify first-boot enrollment runs:
```bash
ssh pi@<pi-ip> 'journalctl -u clubhub-firstboot --since "5 min ago"'
```

3. **Enroll via CMS** using the enrollment token shown in firstboot logs

4. **Verify full operational recovery:**
```bash
ssh pi@<pi-ip> 'systemctl status clubhub-player'
ssh pi@<pi-ip> 'journalctl -u clubhub-player --since "10 min ago" | grep -E "HEALTHY|corpus|playlist"'
```

5. **Check fleet dashboard** shows screen as HEALTHY with correct venue association

### Expected behavior
- Recovery completes within 15 minutes (SD write + reboot)
- Recovery log preserved on USB for retrieval
- First-boot enrollment runs automatically (if enrollment reset)
- Player reaches HEALTHY state within 5 minutes of enrollment completing
- Content serving (at minimum factory corpus) throughout recovery

### Time-to-recovery benchmarks
| Phase | Expected duration |
|-------|------------------|
| Boot into recovery | <60s |
| Image checksum verification | 30–90s |
| Image write to SD | 5–10min |
| Post-write validation | 1–2min |
| Reboot into restored image | 30–60s |
| Player startup | 30–60s |
| First-boot enrollment | 1–3min |
| Corpus sync + HEALTHY | 2–5min |
| **Total** | **~15–25 minutes** |

### Failure classification
- **CRITICAL (P1):** Recovery image checksum fails — cannot recover
- **CRITICAL (P1):** Pi does not reboot after recovery
- **MAJOR (P2):** Recovery takes >30 minutes
- **MAJOR (P2):** Player does not start after recovery + enrollment

### Pass/Fail criteria
| Criterion | Pass | Fail |
|-----------|------|------|
| Recovery image checksum verified | Required | P1 |
| Pi reboots automatically after recovery | Required | P1 |
| Player starts and reaches HEALTHY state | Required | P1 |
| Total recovery time ≤30 minutes | Required | P2 |
| Recovery log retrievable from USB | Expected | P3 |

**Sign-off required from:** Field Engineer + Operations Lead

---

## Sign-Off Matrix

| Scenario | Description | Engineer | Operations | Date | Pass/Fail |
|----------|-------------|----------|------------|------|-----------|
| 1 | Power loss during corpus sync | | | | |
| 2 | ISP outage + reconnect storm | | | | |
| 3 | SD card corruption recovery | | | | |
| 4 | Thermal throttling | | | | |
| 5 | HDMI disconnect/reconnect | | | | |
| 6 | Watchdog forced restart | | | | |
| 7 | Expired URL recovery | | | | |
| 8 | Rollback during active playback | | | | |
| 9 | Offline autonomy >72h | | | | |
| 10 | Full USB device recovery | | | | |

**All 10 scenarios must PASS before Wave 1 venue go-live is permitted.**

---

## Post-Validation Deliverables

After all 10 scenarios pass:

1. **Completed sign-off matrix** (this document, filled in)
2. **Recovery log archive** — all `last-recovery.log` and serial console captures
3. **Fleet health dashboard screenshot** at time of each scenario completion
4. **Audit trail** — CMS timeline events for all rollback/maintenance operations during validation
5. **Issue log** — any P2/P3 findings with resolution status

Submit completed validation package to engineering lead before venue go-live authorization.
