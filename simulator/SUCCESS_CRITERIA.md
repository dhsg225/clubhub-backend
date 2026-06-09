# ClubHub TV — Local Simulation Success Criteria

This document defines what "working correctly" means for each testable behaviour
in the local simulation environment. Use these as pass/fail gates before
deploying to real Raspberry Pis.

---

## 1. Normal Operation

### 1.1 Cold start

**Test:** `make sim-start SCREENS=5` followed by `make seed` then `make fleet-status`

| Criterion | Target | How to verify |
|---|---|---|
| All screens polling | 100% live within 60s | `make fleet-status` shows all `live` |
| Startup spread | Polls spread over 15s window | `make sim-logs` shows first polls staggered |
| Manifest received | Each screen has `last_version` set | `make fleet-status` no `null` versions |
| Content displayed | `sources` includes `scheduled` or `fallback` | `make sim-logs` shows source != `system` after seed |

**Pass:** All screens `live`, content sources not `system`, polls staggered.

### 1.2 Steady-state polling

**Test:** Let simulation run for 5 minutes, then check stats.

| Criterion | Target | How to verify |
|---|---|---|
| Poll interval | ~15s ± 1s | `last_poll_ago_s` ≤ 17 in fleet-status |
| Zero failures | 0 `offline_streak` | `make fleet-status` all streaks = 0 |
| Cache hit rate | ~80% (5s TTL, 15s poll) | Backend logs: ratio of `cache_hit:true` to `cache_hit:false` |
| Heartbeat updates | `last_seen_at` current | `make db-screens` shows recent timestamps |

**Pass:** No offline streaks, heartbeats current, cache hit rate reasonable.

### 1.3 Version detection on content change

**Test:** `make churn` (create content → schedule → delete cycle)

| Criterion | Target | How to verify |
|---|---|---|
| Change detected on create | `manifest_changed: true` within 15s | `make sim-logs` |
| Change detected on delete | `manifest_changed: true` within 15s | `make sim-logs` |
| Version increments | Version monotonically increases per compute | `make manifest` shows incrementing version |
| No stale manifests | Screens show new content within one poll | fleet-status last_version current |

**Pass:** Each create/delete cycle produces exactly one `manifest_changed` event per screen.

**Note on known bug:** The player (`useManifest.ts`) compares `version` not `checksum` for updates.
After a cache bust, `version` resets to 1. Simulator uses checksum comparison (correct behaviour).
The Pi simulator will detect changes correctly; the React player app has a known gap here.

---

## 2. Backend Failure Recovery

### 2.1 Graceful backend restart

**Test:** `make fail-backend`

| Criterion | Target | How to verify |
|---|---|---|
| Failure detected | `poll.failure` within 15s of restart | `make watch-failures` |
| Cache fallback active | `playing_from_cache: true` during downtime | `make watch-failures` |
| Recovery time | All screens `live` within 30s | `make fleet-status` after scenario |
| No manual intervention | Automatic recovery | No manual steps needed |
| Data integrity | Version and checksum correct post-recovery | `make manifest` |

**Pass:** All screens recover within 30s, no manual steps, data intact.

### 2.2 PostgreSQL restart

**Test:** `make fail-db`

| Criterion | Target | How to verify |
|---|---|---|
| Backend survives DB down | Returns 500 to Pi (not crash) | Backend logs: errors, not exit |
| Pool reconnects | Connections restored without restart | Backend logs: no "pool closed" fatal |
| Pi screens use cache | `playing_from_cache: true` | `make watch-failures` |
| Full recovery | All screens `live` within 60s | `make fleet-status` |
| Version bump after recovery | Manifest computed fresh | `manifest_changed` events post-recovery |

**Pass:** Backend never crashes; all screens recover within 60s; pool reconnects automatically.

---

## 3. Network Outage Simulation

### 3.1 Short outage (30s)

**Test:** `make outage-30`

| Criterion | Target | How to verify |
|---|---|---|
| Polls timeout correctly | ~5s per failing poll | `duration_ms` in failure logs |
| Cache plays throughout | `cache_items` > 0 during outage | `make watch-failures` |
| Offline streak counts | Increments each poll | `offline_streak` in fleet-status |
| Recovery within 30s | All screens live after backend resume | `make fleet-status` |

**Pass:** Cache sustains screens throughout; full recovery within one poll cycle.

### 3.2 Extended outage (cache resilience)

**Test:** `make outage-start`, wait 5 minutes, `make outage-end`

| Criterion | Target | How to verify |
|---|---|---|
| Screens play from cache indefinitely | No blank/crash | Cache `has_cache: true` throughout |
| Offline streak grows linearly | +1 per poll (every 15s) | streak ≈ elapsed_minutes × 4 |
| Zero data corruption | Manifest unchanged after recovery | checksum same as before outage |
| Recovery immediate | Live within one poll after resume | `make fleet-status` |

**Pass:** Screens survive indefinitely on cache; clean recovery.

---

## 4. Thundering Herd / Flood Test

**Test:** `make flood` (simultaneous reboot of all screens)

| Criterion | Target | How to verify |
|---|---|---|
| Polls spread over 15s | No single-second spike | Log timestamps show spread |
| No backend timeouts | All polls succeed | Zero 500 errors in backend logs |
| Manifest compute time | p95 < 200ms | Backend `manifest.computed` `duration_ms` |
| All screens live | Within 30s | `make fleet-status` |

**Pass:** No 500 errors during burst; compute latency stable; all screens recover within 30s.

---

## 5. Content Fallback Chain

**Test:** `make delete-content`, observe manifests, then `make seed`

| Criterion | Target | How to verify |
|---|---|---|
| Cache bust on delete | Manifest changes within next poll | `manifest_changed: true` |
| Fallback promotion | `source: fallback` in items | `make manifest` |
| System fallback as last resort | `source: system` if no fallbacks | `make manifest` after deleting all content + schedules |
| Screen never blank | `items.length` always > 0 | Verify manifest.items is never [] |
| Re-seed restores content | `source: scheduled` returns | `make manifest` after `make seed` |

**Pass:** Screen is never blank at any point; fallback chain works correctly.

---

## 6. Scale Test (20 screens)

**Test:** `make sim-start SCREENS=20`, `make seed SCREENS=20`, run for 10 minutes.

| Criterion | Target | How to verify |
|---|---|---|
| All 20 screens poll | 100% `live` | `make fleet-status` |
| DB pool not exhausted | No `connection timeout` errors | Backend logs |
| Manifest compute time stable | p95 < 500ms | `manifest.computed` events |
| Cache hit rate | > 70% | Backend logs ratio |
| No pool poisoning | Zero `aborted transaction` errors | Backend logs |

**Pass:** All 20 screens stable for 10 minutes with no errors.

---

## Recovery Time Summary

| Failure | Expected recovery | Max acceptable |
|---|---|---|
| Backend restart (graceful) | 15–30s | 45s |
| Backend restart (kill -9) | 20–35s | 60s |
| PostgreSQL restart | 30–60s | 90s |
| Network outage (Pi POV) | Next poll after restore | 30s |
| Content delete + re-seed | 15s (one poll cycle) | 30s |
| Thundering herd (20 screens) | 15–30s (jitter spread) | 45s |

---

## Acceptable Error Rates

| Metric | Acceptable | Investigate if |
|---|---|---|
| Poll failure rate (steady state) | 0% | > 0.1% |
| Manifest compute p95 | < 200ms | > 500ms |
| Version change misses | 0 | > 0 |
| Pool connection timeouts | 0 | > 0 |
| Screens stuck offline (> 2 poll cycles) | 0 | > 0 |

---

## What These Tests Do NOT Cover

- Real network latency between Pi and backend (LAN vs WiFi vs internet)
- Chromium memory pressure on actual Raspberry Pi hardware
- HDMI power management / display sleep on Pi
- Concurrent Studio operator edits during simulation
- Multi-venue timezone correctness (manual test needed with clock manipulation)
- Player React app version detection bug (known: compares version not checksum)

---

*Document owned by simulator/SUCCESS_CRITERIA.md. Update after each new failure scenario is discovered.*
