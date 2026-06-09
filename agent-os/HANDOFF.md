# Handoff — Current State Snapshot

Last updated: 2026-06-09 — Governance session 4

> **Rule**: Before treating any item here as "broken," read the actual source file. This document is a snapshot; code changes underneath it.

---

## What Is Working (assumed from code — not run-verified)

- **CMS API** (`backend/src/index.js`): Express on port 4000. Nine routes registered with rate limiting and request ID middleware. DB connection with retry-on-startup. Governance modules (fleet-consensus, operator-ledger, incident-orchestrator, governed-config) all initialised in order at startup. Loki sink wired if `LOKI_URL` set.

- **PRE.resolve() engine** (`pre-runtime/src/pre-engine.ts`): Pure `_resolve()` function with no side effects. Calls `GovernedClock.now()` for governed time. Emits trace event post-resolution. 99/99 corpus replay vectors pass as of last run.

- **Player runtime** (`player-runtime/src/index.ts`): Reads `SCREEN_ID`, `VENUE_ID`, and 8 optional env vars. Starts `UiServer` (static file server on 3001), `ChromiumLauncher`, and `PlayerOrchestrator`. Handles SIGTERM/SIGINT cleanly. 72h autonomous window hard-coded.

- **Corpus cache** (`player-runtime/src/corpus-cache.ts`): Atomic apply with staging + integrity check. Factory snapshot support. Aborts apply on checksum mismatch — old corpus remains intact. Cap: 50MB (throws at limit — see BL-006).

- **Replay cache** (`player-runtime/src/replay-cache.ts`): Packet-level checksum validation. 50MB cap enforced at write time.

- **Governance kernel — operator ledger** (`backend/src/lib/operator-ledger.js`): SHA-256 hash chain. DB-backed via `appendEntryLinearized()` (pg advisory lock). Append-only. Rehydrates from DB on startup via `initFromDb()`.

- **Governance kernel — fleet consensus** (`backend/src/lib/fleet-consensus.js`): DB-backed epoch and generation counters. `getFreezeStateStrong()` reads from DB (not memory). Epoch incremented once at startup.

- **Governance kernel — incident orchestrator** (`backend/src/lib/incident-orchestrator.js`): Full state machine. `transitionStrong()` uses advisory lock + version optimistic lock. DB-persisted via `initFromDb()`.

- **Governance kernel — governed config** (`backend/src/lib/governed-config.js`): Singleton. Versioned config with content-addressable hash. DB-persisted. Bootstrap reads from `thresholds.json` once in `index.js`.

- **OTA pipeline** (`backend/src/lib/rollout-store.js`, `backend/src/routes/ota.js`): Durable rollout state. Freeze enforcement before ring promotion. Rollout state restored on restart.

- **Contract gate** (`test-runner/contracts/validate-contracts.js`): 62 checks across all governance invariants. CI merge-blocking.

- **Integration test harness** (`docker-compose.integration.yml`): Docker Compose; postgres + cms-api + player-runtime + test runner. No separate screen-init container — enrollment is step [3] inside `integration-test.mjs`. player-runtime polls `/shared/screen_id` for up to 60s. Run: `docker compose -f docker-compose.integration.yml up --build --abort-on-container-exit`

- **Studio SPA** (`studio/src/App.tsx`): 3 tabs (create/content/playlist). Plain React + CSS. No router. `CreateTab` posts to `/content`; `ContentTab` lists items; `PlaylistTab` manages playlists.

- **cms-web** (`apps/cms-web/`): React 18 + Vite + React Router. AppLayout + RequireAuth wired. FleetDashboard (root `/`) fetches real venues from backend. VenueDashboard (`/venues/:id`) is Phase 1 stub — BL-012 is next. LoginPage mock auth. Vite proxy: `/api/v1/*` → `http://localhost:4000/*` (strips prefix). Dev server: `pnpm --filter @clubhub/cms-web dev` (port 5173). `/preview` route loads `__mockups__/FleetDashboard.mockup.tsx` (Live Ops Surface design artifact — do not delete).

- **Screen auth enforced** (`backend/src/middleware/screenAuth.js`): `SCREEN_AUTH_ENFORCE=true` in `backend/.env`. `requireScreenToken` wired to `/manifest`. 401 on missing token. Migrations 003–005 applied.

---

## Known Gaps (current as of 2026-06-08)

### 5 Frozen Map files with uncommitted changes — BL-001 [BLOCKED: human decision]

`distributed-authority.js`, `governed-config.js`, `incident-orchestrator.js`, `operator-ledger.js`, and `validate-contracts.js` all have local modifications that have not been committed. These are governance primitives. The nature of the changes is unknown without a human `git diff` review. No agent should commit these files.

### Screen auth not enforced — BL-002 [DONE 2026-06-09]

`SCREEN_AUTH_ENFORCE=true` set in `backend/.env`. `requireScreenToken` wired. 401 verified on missing token. 79/79 contract gate PASS.

### Studio has no visible auth gate — BL-003 [AUDITED — dev-only tool, no production exposure]

**Finding (DOCS-1, 2026-06-08):** Studio is not deployed in production. The Caddyfile (`docker/Caddyfile`) has no `/studio` route and no Studio service is defined in `docker-compose.production.yml`. `studio/src/api.ts` calls `http://localhost:4000` directly — a hardcoded localhost URL that only works when Studio is run locally with `pnpm dev`. This is a development-only tool, not a production surface.

**Conclusion:** No auth gap in production because Studio is not served in production. No action required. Create BL-F01 if Studio is ever promoted to a production operator surface.

### apps/ shells — BL-004 [SCOPED]

`apps/cms-web` is active (Phase 1 done, BL-012 next). `apps/player-ui` and `apps/sponsor-portal` remain unscoped — do not build without explicit human instruction.

### Replay cache 50MB ceiling — BL-006 [DOCUMENTED — see below]

**Finding (DOCS-1, 2026-06-08):** `player-runtime/src/replay-cache.ts` enforces a hard 50MB cap on `replay-packets.ndjson`. When `append()` would cause the file to exceed this limit it throws: `[replay-cache] Cache at 50MB cap — upload required before continuing`. This exception propagates to the orchestrator and will halt replay packet recording for that session.

**What triggers it:** High event rate venues accumulate replay packets faster than they can be cleared. At ~100 bytes/packet average, 50MB ≈ 500,000 packets. A busy venue generating 5 events/second hits the cap in ~28 hours offline. The 72h autonomous window means this can occur before connectivity is restored.

**How to clear it (manual — no auto-clear exists):**
1. SSH into the Pi: `ssh pi@<device-ip>`
2. Check current size: `ls -lh /var/clubhub/replay/replay-packets.ndjson`
3. If the backend is reachable, trigger a manual sync first (no automated upload endpoint exists yet — this is a known gap). Read packets via `ReplayCacheWriter.readUnsynced()` and POST to `/replay/batch` if that route exists in your services layer, or accept packet loss.
4. After confirming sync (or accepting loss): `truncate -s 0 /var/clubhub/replay/replay-packets.ndjson` — **do not delete the file, truncate it** so the path remains valid for the next `appendFileSync` call.
5. Restart player-runtime: `sudo systemctl restart clubhub-player`

**Does it auto-clear?** No. `ReplayCacheWriter` has `readUnsynced()` but no `markSynced()` and no upload trigger. The heartbeat reports `replay_cache_size_bytes` to the CMS so operators can monitor approaching the cap, but clearing requires manual intervention until an automated upload path is implemented.

**Monitoring:** Each heartbeat includes `replay_cache_size_bytes`. Alert threshold recommendation: warn at 40MB (80% of cap), page at 48MB.

### OTA canary-to-general promotion — BL-007 [DOCUMENTED — manual procedure below]

**Manual verification procedure (DOCS-1, 2026-06-08):**

The OTA state machine is: `PENDING → STAGING → RING_0 (1%) → RING_1 (30%) → RING_2 (70%) → RING_3 (100%) → COMPLETE`. Any ring can transition to `FROZEN` (via freeze API or auto-freeze on health failure) or `ROLLED_BACK`.

**Promotion gates (all must pass per ring):**
- `ringHealthScore ≥ 0.85` (from `thresholds.json ota.ring_health_pass_score` — hardcoded 0.85 per OTA_GOVERNANCE.md §7)
- Observation window elapsed: 300,000ms (5 min) per ring, except RING_0→RING_1 which uses `ring3_observation_window_ms` (default same)
- No SEVERE drift blocks without a valid waiver in `soak-reports/gap-waivers.json`
- Fleet freeze state readable from DB (unknown freeze state = block promotion)
- Auto-rollback if `ringHealthScore < 0.70`

**Step-by-step manual verification (requires running backend + operator auth token):**

```bash
export TOKEN="Bearer <operator-token>"
export BASE="http://localhost:4000"

# 1. Upload an OTA package (creates rollout in PENDING state)
curl -s -X POST $BASE/ota/upload \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"update_id":"test-v1.2.0","target_version":"1.2.0","sha256":"<64-char-hex>","uploaded_by":"ops"}'
# Expected: 201 {"ok":true,"message":"...Rollout in PENDING state..."}

# 2. Check status
curl -s $BASE/ota/status -H "Authorization: $TOKEN"
# Expected: {"rollout":{"state":"PENDING",...}}

# 3. Promote to STAGING then RING_0 (two calls; first call transitions PENDING→STAGING→RING_0)
curl -s -X POST $BASE/ota/promote \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ring_health_score":0.95,"fleet_success_rate":1.0,"desync_count":0,"unhealthy_screens":0}'
# Expected: {"ok":true,"result":{"promoted":true},"snapshot":{"state":"RING_0",...}}

# 4. Wait for observation window (300s / 5 min in real use; use a test threshold override if testing)

# 5. Promote RING_0 → RING_1 (same payload)
curl -s -X POST $BASE/ota/promote \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ring_health_score":0.95,"fleet_success_rate":1.0,"desync_count":0,"unhealthy_screens":0}'
# Expected: state → RING_1

# 6. Repeat promote for RING_2, RING_3, COMPLETE (same payload each time, wait observation window)

# 7. Verify COMPLETE
curl -s $BASE/ota/status -H "Authorization: $TOKEN"
# Expected: {"rollout":{"state":"COMPLETE",...}}
```

**Freeze enforcement check:**
```bash
# Freeze during RING_1
curl -s -X POST $BASE/ota/freeze -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" -d '{"reason":"manual test freeze"}'
# Expected: 200 {"ok":true}

# Attempt promotion — must be blocked
curl -s -X POST $BASE/ota/promote -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" -d '{"ring_health_score":0.95}'
# Expected: {"ok":false,...} or 403

# Unfreeze and resume
curl -s -X POST $BASE/ota/unfreeze -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# Expected: 200, state returns to RING_1
```

**Integration test coverage gap:** The integration harness (`docker-compose.integration.yml`) does not automate these calls. Until a test is added, run this procedure manually before any OTA production promotion. No automated test exists for `CANARY → COMPLETE` path.

---

## Schema / Data Reference

### pg Pool (source: `backend/src/db.js`)
```
connectionString: DATABASE_URL
max: 10 (scale at ~150 screens)
idleTimeoutMillis: 30,000
connectionTimeoutMillis: 8,000
```
**BL-005 check (DOCS-1, 2026-06-08):** Backend not running at audit time. Seed data (`migrate_001.sql`) inserts 1 screen (`screen-1`). Repository is pre-first-commit / pre-production. Pool size of 10 is adequate (designed for 5–20 screens). **Verify screen count again at first real venue deployment** — if ≥ 100 screens enrolled, create BL-F04 as immediate action item.

### Player config (source: `player-runtime/src/index.ts`)
```
screen_id, venue_id, poll_interval_ms (60000),
heartbeat_interval_ms (30000), corpus_cache_dir (/var/clubhub/corpus),
replay_cache_dir (/var/clubhub/replay), asset_dir (/var/clubhub/assets),
chromium_url (http://localhost:3001), websocket_port (7777), cms_api_url,
autonomous_window_ms (259200000 — 72h, non-configurable)
```

### Backend routes (source: `backend/src/index.js`)
```
GET  /health           → health.js (no rate limit)
*    /manifest         → manifest.js (120 req/60s)
*    /content          → content.js (write rate limit)
*    /schedules        → schedules.js (write rate limit)
*    /venues           → venues.js (write rate limit)
*    /screens          → screens.js (write rate limit)
*    /ota              → ota.js (heavy rate limit)
*    /playlist         → playlist.js (write rate limit)
*    /asset            → assets.js (write rate limit)
GET  /uploads/:file    → static (UPLOAD_DIR)
```

---

## Environment Checklist (fresh start)

- [ ] Copy `.env.production.example` to `backend/.env` and fill in `DATABASE_URL`, `SECRET_KEY`, `DB_PASSWORD`
- [ ] Run `docker compose up` to start PostgreSQL
- [ ] Verify migrations: `docker compose exec backend node -e "require('./src/db').waitForDb()"`
- [ ] Run contract gate: `node test-runner/contracts/validate-contracts.js`
- [ ] Optionally: `docker compose -f docker-compose.integration.yml up --build --abort-on-container-exit`

---

## Read Order for New Agents

1. `PROJECT_STATE.md` — current status and blockers
2. `DECISIONS.md` — what's settled (search by keyword or D-NNN)
3. `BACKLOG.md` — what to work on (top TODO item)
4. Relevant type/schema files before implementing data-dependent features
