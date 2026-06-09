# ClubHub TV — Current State & Future Direction
**Document:** 002
**Date:** 2026-05-14
**Status:** Simulation environment built and smoke-tested. Chaos test harness designed but not yet implemented. Handover in progress.

---

## What Changed Since Doc 001

Doc 001 covered the core platform. This document covers everything built in the **2026-05-14 session**:

1. Local simulation environment (fully built, smoke-tested, working)
2. Chaos test harness (designed, file structure agreed, implementation paused pending rate limit reset)
3. One confirmed bug in the React player (`useManifest.ts`)

---

## What Is Now Built

### Local Simulation Environment

A complete local Pi fleet simulator that runs N fake Raspberry Pi screens against the real backend.

#### New Files

```
simulator/
├── fake-pi.js           Node.js Pi fleet simulator — each screen is an independent
│                        state machine: polls every 15s with jitter, in-memory cache,
│                        heartbeat, checksum-based change detection, forced offline,
│                        simulated reboot. HTTP management API on :3100.
├── seed.js              Seeds DB: 2 venues, up to 20 screens, 7 content items,
│                        7 schedule types (always-on, happy hour, fallback, future-dated, etc.)
├── watch.js             Colorized JSON log formatter — pipe docker logs through this.
│                        Shows: LIVE/OFFLINE/REBOOT badges, version, checksum, sources,
│                        ⚡CHANGED on manifest version bumps.
├── package.json         Zero external deps. Node 20 built-ins only.
├── Dockerfile           For running in docker-compose.dev-sim.yml
├── SUCCESS_CRITERIA.md  Pass/fail gates for every testable behaviour before Pi deploy.
├── scenarios/
│   ├── restart-backend.sh    Restart backend, watch recovery
│   ├── restart-db.sh         Restart postgres, watch pool recovery
│   ├── outage.sh             SIGSTOP/SIGCONT on backend container (start/end/30/60)
│   ├── clear-caches.sh       DELETE from manifest_cache (forces cold recompute)
│   ├── delete-all-content.sh Delete all content via API (system fallback test)
│   ├── content-churn.sh      Rapid create/delete cycles (N cycles, Ns between)
│   └── flood-test.sh         Simultaneous reboot all screens via management API
└── scripts/
    ├── fleet-status.py       Pretty fleet status table (used by Makefile)
    ├── content-list.py       List content with lifecycle status
    ├── schedules-list.py     List all schedules with targets/windows
    ├── screens-list.py       List screens with last_seen_at
    └── manifest-check.py     Fetch and pretty-print a single manifest

docker-compose.dev-sim.yml   Full simulation stack:
                              postgres on 5433 (avoids conflict with local postgres on 5432)
                              backend on 4000
                              fake-pi-fleet on 3100 (management API)
                              migrate service (runs once, applies all migrations)

Makefile                     30+ developer commands. Run 'make help'.
```

#### Management API (fake-pi.js)

The fleet simulator exposes an HTTP API on port 3100 (or STATUS_PORT env):

| Endpoint | Purpose |
|---|---|
| `GET /status` | Full fleet state snapshot |
| `GET /health` | Liveness probe |
| `POST /offline/:screenId` | Force one screen offline (body: `{"durationMs":N}`) |
| `POST /reboot/:screenId` | Simulate one screen reboot |
| `POST /offline-all` | Force all screens offline |
| `POST /reboot-all` | Reboot all screens simultaneously |

#### Key Makefile Commands

```bash
# Lifecycle
make sim-start [SCREENS=N]   # Start full stack (postgres + backend + Pi fleet)
make sim-stop                # Stop all containers
make sim-rebuild             # Rebuild images and restart

# Observation
make sim-logs                # Stream logs through pretty formatter
make watch                   # Only show manifest changes (⚡CHANGED events)
make watch-failures          # Only show failures + fleet stats
make fleet-status            # Per-screen status table (via management API)
make manifest [SCREEN=id]    # Fetch and pretty-print a manifest
make health                  # Backend health check

# Content
make seed [SCREENS=N]        # Seed DB with test data
make seed-reset              # Delete all sim data then re-seed
make content-list            # List content with lifecycle status
make schedules-list          # List all schedules

# Failure scenarios
make fail-backend            # Restart backend — 30s recovery expected
make fail-db                 # Restart postgres — 60s recovery expected
make outage-start            # Pause backend (polls timeout, screens use cache)
make outage-end              # Resume backend
make outage-30               # 30s outage then auto-recover
make clear-caches            # Delete manifest_cache rows
make delete-content          # Delete all content → system fallback
make churn                   # 5-cycle create/delete (version tracking)
make flood                   # Simultaneous reboot all screens (jitter test)
make offline-screen [SCREEN=id]  # Force one screen offline 30s
make reboot-screen [SCREEN=id]   # Simulate one screen reboot

# Database (targets local postgres via DB_PORT=5433 for Docker, 5432 for local)
make db-shell                # psql into simulation postgres
make db-cache                # Show manifest_cache table
make db-screens              # Show screens table with last_seen_at
make db-reset                # Drop and recreate all tables (destructive)
```

#### Smoke Test Results (2026-05-14)

All of the following were verified working:

| Test | Result |
|---|---|
| seed.js against running backend | ✅ All venues/screens/content/schedules created |
| fake-pi.js 3 screens, REBOOT_PROB=0 | ✅ All polled within 15s jitter window |
| Management API `/status` | ✅ Returns live fleet state |
| Management API `POST /offline/:id` | ✅ Screen goes offline, recovers after duration |
| watch.js formatting | ✅ Colorized output, LIVE/OFFLINE/CHANGED badges |
| Makefile `make help` | ✅ All targets listed |
| `make health`, `make content-list`, `make manifest` | ✅ All working |
| Manifest for sim-screen-01 | ✅ 3 items: Happy Hour p20, Bar Floor p15, Welcome p5 |
| Fallback items | ✅ ClubHub TV fallback in fallback_items |

---

## Confirmed Bug: Player Version Detection

**File:** `player/src/useManifest.ts` line 47

**Bug:**
```typescript
// CURRENT (WRONG):
if (!prev || prev.version !== data.version) {

// CORRECT FIX:
if (!prev || prev.checksum !== data.checksum) {
```

**Why it matters:** After a cache bust (`manifest_cache` row deleted), the manifest version resets to 1 on the next fresh compute. If the player previously cached a manifest at version 1, the comparison `1 !== 1` is false — the player never updates even though content changed.

**Reproduction:** Delete scheduled content → manifest cache busted → version resets to 1 → player stuck on deleted content.

**Also fix in `App.tsx`** line 36: the reset-to-slide-0 logic watches `manifest?.version`. Change to watch `manifest?.checksum` for the same reason:
```typescript
// In the useEffect that resets index:
}, [manifest?.checksum]);  // was manifest?.version
// And:
if (prevChecksum.current !== null && prevChecksum.current !== manifest.checksum) {
```

**Note:** The fake-pi.js simulator already uses checksum comparison (correct behaviour). Only the React player app has this bug.

---

## Other Issues Found During Testing

| Issue | Severity | Location |
|---|---|---|
| Global schedules blocked by API | Medium | `schedules.js:28` — `venue_id or screen_id required` validation prevents creating any schedule with both NULL. Manifest engine handles global schedules but they can never be created. |
| `days_of_week` requires time window | Low | `schedules.js:37` — overly strict. Day-of-week filter works independently in engine, but API rejects it without `time_of_day_start`/`end`. |
| Fallback duplicated in manifest response | Cosmetic | When fallback promoted to `items`, same content also appears in `fallback_items`. Player only uses `items` so no functional impact. |

These were found during API-level simulation testing (before fake-pi was built).

---

## What Was NOT Built (Next Task — Chaos Test Harness)

The next task was scoped and designed but NOT implemented due to rate limit pause:

### Goal
Transform the simulator from a **log-based observation tool** into a **deterministic CI-style test harness** with assertions and pass/fail outputs.

### Planned Output Format (mandatory)
```
TEST SUITE: ClubHub Chaos Simulation
RUN ID: <timestamp>

RESULT SUMMARY:
- TOTAL TESTS: X
- PASSED: X
- FAILED: X
- SKIPPED: X

FAILURES:
- test_name: reason + metrics

OVERALL STATUS: PASS | FAIL
```

### Planned File Structure

```
test-runner/
├── runner.js               Main entry point
│                           CLI: node runner.js --suite=basic|chaos|stress|all [--ci] [--no-docker]
│                           Starts Docker Compose stack if needed, spawns fleet subprocess,
│                           runs suites, outputs CI-style results, exits 0=pass 1=fail.
├── package.json            Zero external deps. Node 20 built-ins only.
└── lib/
    ├── assert.js           Assertion library
    │                         assert.that(condition, label, metrics)
    │                         await assert.eventually(fn, {timeout, interval, label})
    │                         assert.metric(name, value).toBeLessThan(threshold, label)
    │                         Throws AssertionError with context on failure.
    ├── metrics.js          MetricsCollector — fed by fleet subprocess stdout (JSON events)
    │                         Tracks per-screen: latency, success/failure rate, offline streak,
    │                         version changes, last checksum, last success timestamp.
    │                         Derived: allLive(), allRecoveredAfterMark(name), pollSuccessRate(),
    │                         maxOfflineStreak(), recoveryTimeAfterMark(name), p95PollLatency()
    │                         markers: metrics.mark('chaos.restart') → marks a timestamp for
    │                         measuring recovery time from that point.
    ├── chaos.js            Chaos control plane (Docker-based + HTTP content manipulation)
    │                         chaos.restartBackend()  → docker compose restart backend
    │                         chaos.restartDb()       → docker compose restart postgres
    │                         chaos.outage(ms)        → pause/sleep/unpause backend container
    │                         chaos.contentChurn(n, screenId) → N create+schedule+delete cycles
    │                         chaos.clearAllContent() → delete all content via API
    │                         chaos.waitForHealth()   → polls /health until ok
    │                         Requires Docker Compose stack; chaos tests auto-skip if unavailable.
    ├── fleet.js            FleetController — spawns fake-pi.js as subprocess
    │                         Uses SCREEN_PREFIX=test-screen, STATUS_PORT=3101 (avoid conflicts)
    │                         Feeds stdout JSON events into MetricsCollector.
    │                         fleet.waitForAllPolled(timeout) — wait for all N screens seen in metrics
    │                         fleet.allLive() — all screens reporting live status
    │                         fleet.rebootAll() — via management API
    │                         fleet.offlineScreen(id, ms) — via management API
    └── reporter.js         CI output formatter
                              reporter.begin(suiteName)
                              reporter.test(name) → { pass(metrics), fail(err), skip(reason) }
                              reporter.finish() → prints summary in required format
                              CI mode (--ci): suppresses progress, only prints summary
```

### Planned Test Suites

#### `--suite=basic` (no Docker required, works with any running backend)

| Test | Action | Key Assertions |
|---|---|---|
| `health_check` | GET /health | status=ok, db=connected |
| `cold_start` | Start 5 screens | All live within 60s, polls staggered over >3s window |
| `manifest_delivery` | Create content + schedule | Target screen detects change within 30s |
| `fallback_promotion` | Delete all content | All screens show fallback/system within 15s |
| `cache_persistence` | Reboot fleet (not backend) | Screens reload cache and recover within 30s |

#### `--suite=chaos` (Docker Compose required)

| Test | Action | Key Assertions |
|---|---|---|
| `backend_restart_recovery` | Restart backend | All screens recover < 30s, max offline streak ≤ 3 cycles |
| `db_restart_recovery` | Restart postgres | All screens recover < 60s, no backend crash |
| `network_outage_30s` | Pause backend 30s | Screens use cache throughout, recover < 15s after resume |
| `content_churn_version_tracking` | 10 create/delete cycles | All version changes detected, no missed updates |
| `flood_recovery` | Reboot all screens simultaneously | Poll spread > 3s variance, all live within 30s |

#### `--suite=stress` (Docker preferred, some work locally)

| Test | Action | Key Assertions |
|---|---|---|
| `sustained_load_120s` | 10 screens, 120s | Poll success rate > 99%, p95 latency < 500ms |
| `poll_drift` | Measure actual poll intervals | Within 20% of 15s target |
| `cache_coherence` | Change content, wait | All screens converge to same checksum within 3 cycles (45s) |
| `pool_safe_at_20_screens` | 20 concurrent screens | Zero pool timeout errors, all screens live |

### Key Design Decisions for Implementor

1. **Fleet subprocess**: runner spawns `simulator/fake-pi.js` with `SCREEN_PREFIX=test-screen SCREEN_COUNT=10 STATUS_PORT=3101`. Reads JSON events from stdout into MetricsCollector.

2. **Change detection**: both fleet simulator AND test runner use **checksum** (not version) for change detection. This is correct. The player bug doesn't affect the test harness.

3. **Recovery time measurement**: use `metrics.mark('chaos.name')` immediately before issuing chaos, then `metrics.allRecoveredAfterMark('chaos.name')` tracks when all screens had a `poll.success` after that mark. Recovery time = last recovery timestamp - mark timestamp.

4. **Docker detection**: if Docker Compose stack unavailable, chaos tests SKIP (not FAIL) with clear reason. Basic/stress tests continue.

5. **Test isolation**: each test creates its own screen-specific schedules (not venue-wide) to avoid interference between tests. Cleanup (delete content) at end of each test.

6. **Metrics reset**: call `metrics.reset()` between tests to clear per-screen counters and event log. Screen state (IDs, last known status) is preserved.

7. **No external deps**: Node 20 built-ins only — `fetch`, `child_process`, `readline`, `http`, `path`. Same constraint as rest of project.

8. **CI mode**: `--ci` flag suppresses all progress output. Only prints final summary block. Exit 0 = all pass/skip, exit 1 = any failure.

### Makefile Targets to Add

```makefile
test-basic:
    node test-runner/runner.js --suite=basic

test-chaos:
    node test-runner/runner.js --suite=chaos

test-stress:
    node test-runner/runner.js --suite=stress

test-all:
    node test-runner/runner.js --suite=all

test-ci:
    node test-runner/runner.js --suite=all --ci
```

---

## Current Running State (end of session)

| Service | Status | Notes |
|---|---|---|
| Backend (Node.js) | Running locally on :4000 | `node src/index.js` in background (PID recorded in session) |
| PostgreSQL | Running locally on :5432 | Local postgres, `clubhub` DB with all migrations applied |
| Studio | NOT running | Start with `npm run dev:studio` |
| Player | NOT running | Start with `npm run dev --workspace=player` |
| Docker stack | NOT running | `docker-compose.dev-sim.yml` not started this session |

### DB State (end of session)

From smoke testing, the `clubhub` database contains:
- 9 screens (screen-1, screen-2 from earlier tests + sim-screen-01..07 from seed + sim-screen-11)
- 12 content items (mix of test content from manual testing + seed content)
- 9 schedules (mix of manual test schedules + seed schedules)
- Manifest cache entries for recently polled screens

For a clean test run, run `make seed-reset` (or `node simulator/seed.js --reset`) to clear and re-seed.

---

## Local Dev Quick Start (Updated)

```bash
# Option A: Full Docker simulation stack
make sim-start SCREENS=5     # starts postgres(5433) + backend(4000) + fleet(3100)
make seed                    # populate test data
make sim-logs                # pretty live logs
make fleet-status            # per-screen status table

# Option B: Manual local stack (postgres + backend already running)
# backend running on :4000, postgres on :5432
node simulator/fake-pi.js    # start 5 fake screens (SCREEN_COUNT=5)
node simulator/seed.js       # seed test data
# Then use make manifest, make content-list, etc. against localhost:4000
```

---

## File Tree (complete, as of end of session)

```
clubhub_player/
├── package.json              npm workspaces root
├── docker-compose.yml        original postgres + backend (port 5432)
├── docker-compose.dev-sim.yml  NEW: simulation stack (postgres 5433, backend 4000, fleet 3100)
├── Makefile                  NEW: 30+ developer commands
├── RUN.md                    original quick-start guide
├── docs/
│   ├── 001-current-state-2026-05-14.md   original state doc
│   └── 002-current-state-2026-05-14.md   THIS DOCUMENT
│
├── backend/                  (unchanged from doc 001)
├── player/                   (unchanged — bug in useManifest.ts documented above)
├── studio/                   (unchanged)
├── shared/                   (unchanged)
│
└── simulator/                NEW
    ├── fake-pi.js
    ├── seed.js
    ├── watch.js
    ├── package.json
    ├── Dockerfile
    ├── SUCCESS_CRITERIA.md
    ├── scenarios/
    │   ├── restart-backend.sh
    │   ├── restart-db.sh
    │   ├── outage.sh
    │   ├── clear-caches.sh
    │   ├── delete-all-content.sh
    │   ├── content-churn.sh
    │   └── flood-test.sh
    └── scripts/
        ├── fleet-status.py
        ├── content-list.py
        ├── schedules-list.py
        ├── screens-list.py
        └── manifest-check.py

# NOT YET CREATED (next task):
# test-runner/
#   runner.js
#   package.json
#   lib/assert.js
#   lib/metrics.js
#   lib/chaos.js
#   lib/fleet.js
#   lib/reporter.js
#   suites/basic.js
#   suites/chaos.js
#   suites/stress.js
```

---

## Handover Notes for Next Session

**Priority 1 — Fix the player bug first (5 min fix):**
Edit `player/src/useManifest.ts` line 47: `prev.version` → `prev.checksum`.
Edit `player/src/App.tsx` line 36: watch `manifest?.checksum`, compare `prevChecksum.current`.

**Priority 2 — Build the chaos test harness:**
Implement `test-runner/` as designed in this document. All architectural decisions are made. Start with `lib/assert.js`, `lib/metrics.js`, then `lib/fleet.js`, `lib/chaos.js`, `lib/reporter.js`, then `runner.js`, then suites in order: basic, chaos, stress.

**Priority 3 — Validation:**
Run `make test-ci` and verify output matches the required format exactly. Run all three suites. Confirm exit code 0 on pass, 1 on fail.

**What to NOT change:**
- `simulator/fake-pi.js` — works correctly, leave alone
- `backend/` — no changes needed for testing
- `docker-compose.dev-sim.yml` — correct as-is
- Test harness must have zero external npm dependencies

---

*End of document 002.*
