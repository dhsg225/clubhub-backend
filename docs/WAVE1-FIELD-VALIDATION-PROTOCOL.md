# Wave 1 Field Validation Protocol
## Physical failure scenario validation — must pass before first venue go-live

Each scenario must be executed on real Pi hardware, not simulation.
Record: pass/fail, actual recovery time, observations.

---

## Scenario 1: Abrupt power loss during corpus sync

**Setup**: Player in active corpus poll cycle (visible in logs).
**Action**: Pull power during the sync (between fetch and apply).
**Expected**:
- Player boots to `corpus.current.json` (write was incomplete, staging cleaned)
- OR falls back to `corpus.previous.json` if current was mid-rename
- Watchdog starts cleanly, heartbeat resumes within 60s
- `corpus.next.json` (staging) NOT present after reboot

**Pass criteria**: Content serving within 90s of power restore. No corrupt corpus loaded.
**Measurement**: `cat /var/clubhub/corpus/corpus.current.json | python3 -m json.tool`

---

## Scenario 2: ISP outage + reconnection storm simulation

**Setup**: 5 player VMs (or real Pi fleet if available), all connected.
**Action**: Block outbound network for 30 minutes, then restore simultaneously.
**Expected**:
- Players continue serving from cached corpus during outage
- On reconnect, no two players have identical reconnect intervals (jitter working)
- All 5 players sync successfully within 3 minutes of connectivity restore
- DB connection pool not exhausted (check PgBouncer `SHOW POOLS` after)

**Pass criteria**: All players show `HEALTHY` in fleet dashboard within 5 minutes.
**Measurement**: `GET /api/v2/fleet/health` — watch `OFFLINE → HEALTHY` transitions.

---

## Scenario 3: SD card corpus corruption

**Setup**: Player running normally with `corpus.current.json` present.
**Action**: `echo 'corrupt' > /var/clubhub/corpus/corpus.current.json` then restart player.
**Expected**:
- Player loads `corpus.previous.json` (fallback chain)
- Log shows: `[corpus-cache] DEGRADED LOAD: serving from previous snapshot`
- Heartbeat `corpus_load_source = 'previous'`
- Fleet dashboard shows `CORPUS_DEGRADED` warning

**Pass criteria**: Player serves content within 30s. `CORPUS_DEGRADED` appears in dashboard.

---

## Scenario 4: HDMI disconnect/reconnect

**Setup**: Player running, screen displaying content.
**Action**: Unplug HDMI cable, wait 60s, replug.
**Expected**:
- Display output restores without player restart
- `hdmi_force_hotplug=1` in `/boot/config.txt` (set by setup-player.sh)
- No watchdog kill triggered
- Heartbeat continues uninterrupted during cable disconnection

**Pass criteria**: Display restores within 30s of replug, no manual intervention.
**If fail**: Check `/boot/config.txt` has `hdmi_force_hotplug=1`, reboot Pi.

---

## Scenario 5: Thermal throttling

**Setup**: Pi in enclosed space (simulate cabinet), monitor temp.
**Action**: Run CPU stress: `stress --cpu 4 --timeout 300` alongside player.
**Expected**:
- Watchdog logs `TEMP WARN` at 75°C
- Player continues functioning (throttling = slower, not broken)
- Heartbeat `temperature_celsius` field increases and is visible in fleet dashboard
- No watchdog kill (temperature alone doesn't trigger exit)

**Pass criteria**: Player serves content through throttle. Temp visible in dashboard.

---

## Scenario 6: Expired asset URLs during offline window

**Setup**: Set test corpus with URLs expiring in 2 minutes, disconnect network.
**Action**: Wait for URLs to expire (2+ minutes), observe.
**Expected**:
- `urgentSyncRequired()` fires before expiry (4h threshold — adjust test threshold to 1min)
- Player logs `Asset URLs near expiry — prioritizing corpus sync`
- While offline: player continues serving from local disk cache
- `URL_EXPIRING` warning in fleet dashboard
- After reconnect: new URLs fetched, warning clears

**Pass criteria**: Content uninterrupted during URL expiry. Warning visible in dashboard.

---

## Scenario 7: Rollback during active playback

**Setup**: Content playing on screen. Note current corpus version.
**Action**: Execute rollback via API to previous version.
**Expected**:
- Rollback API returns 201 within 2s
- Player picks up new corpus on next poll (≤60s)
- Content transitions at segment boundary (not mid-segment)
- No black screen during transition
- Fleet dashboard shows new corpus version within 90s

**Pass criteria**: Rollback applied within 90s. No screen blackout during transition.
**Measurement**: Time from `POST /api/v2/corpus/rollback` to fleet dashboard showing new version.

---

## Scenario 8: Watchdog forced restart

**Setup**: Player running normally.
**Action**: Kill the main Node process: `kill $(pm2 pid clubhub-player)`.
**Expected**:
- PM2 detects exit, restarts within 5s
- Player boots with cached corpus, resumes serving within 30s
- Heartbeat gap visible in fleet dashboard (offline for ~30s)
- `PLAYER_ONLINE` timeline event fires after restart

**Pass criteria**: Content restored within 45s of kill. PM2 restart counted in `pm2 describe`.

---

## Scenario 9: Offline autonomy > 72 hours

**Setup**: Fully synced player. Disconnect network.
**Action**: Leave offline for 73 hours (or set `autonomous_window_ms` to 60s for rapid test).
**Expected**:
- Player continues serving for full autonomy window
- At autonomy window expiry: player transitions to `DEGRADED` state
- Emergency content / fallback displayed (not black screen)
- On reconnect: player syncs, resumes `HEALTHY`

**Pass criteria**: No blackout during autonomy window. Graceful degradation at expiry.

---

## Scenario 10: Remote command execution

**Setup**: Player online. Support staff has API access.
**Action**: Issue `COLLECT_DIAGNOSTICS` command via `POST /api/v2/screens/:id/commands`.
**Expected**:
- Command appears as `PENDING` immediately
- Player acknowledges within 60s (next poll cycle)
- Diagnostics bundle generated and uploaded (or available via SSH)
- Command transitions: `PENDING → ACKNOWLEDGED → EXECUTING → COMPLETED`
- Timeline event `REMOTE_COMMAND_COMPLETED` visible in venue timeline

**Pass criteria**: Full lifecycle completes within 3 minutes.

---

## Sign-off matrix

| Scenario | Executed by | Date | Pass/Fail | Recovery time | Notes |
|----------|-------------|------|-----------|---------------|-------|
| 1. Power loss | | | | | |
| 2. ISP outage | | | | | |
| 3. SD corruption | | | | | |
| 4. HDMI reconnect | | | | | |
| 5. Thermal throttle | | | | | |
| 6. URL expiry | | | | | |
| 7. Rollback | | | | | |
| 8. Watchdog restart | | | | | |
| 9. 72h autonomy | | | | | |
| 10. Remote command | | | | | |

**All 10 scenarios must PASS before first venue go-live.**
