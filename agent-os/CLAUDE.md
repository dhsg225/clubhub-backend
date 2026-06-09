# ClubHub TV — Agent Reference

## What This Is

ClubHub TV is a governed digital signage platform for hospitality venues: a Node.js/Express CMS API, a Raspberry Pi player runtime with 72-hour offline autonomy, and a minimal operator studio, all held together by a constitutional governance kernel enforcing deterministic, replay-safe execution.

## Runtime & Build

- **Framework**: Express 4 (backend) · React 18 + Vite (studio/player-ui) · Node ESM (player-runtime)
- **Language**: JavaScript/CommonJS (backend) · TypeScript/ESM (player-runtime, pre-runtime, packages)
- **Monorepo**: pnpm 9 + Turborepo 2 — `pnpm-workspace.yaml` at root
- **Run backend**: `cd backend && npm start` (port 4000)
- **Run studio**: `cd studio && pnpm dev` (port 3000)
- **Run player-runtime**: `cd player-runtime && pnpm dev`
- **Contract gate**: `node test-runner/contracts/validate-contracts.js`
- **Test**: `pnpm test` or `node test-runner/runner.js`
- **Build**: `pnpm build`
- **Full stack**: `docker compose up`

## Key Dependencies

| Package | Version | Role |
|---|---|---|
| express | ^4.18.2 | Backend HTTP server |
| pg | ^8.11.3 | PostgreSQL client (raw SQL — no ORM) |
| ws | ^8.17.0 | WebSocket client in player-runtime |
| react | ^18.2.0 | Studio + player-ui frontend |
| vite | ^5.1.0 | Frontend bundler |
| tsx | ^4.7.0 | TypeScript runner for scripts |
| turbo | ^2.0.0 | Monorepo task orchestrator |
| multer | ^1.4.5-lts.1 | File upload middleware |
| dotenv | ^16.3.1 | Env var loading |

## Path Aliases / Import Conventions

```
@clubhub/pre-types            → packages/pre-types/
@clubhub/constitutional-types → packages/constitutional-types/
@clubhub/fnv-checksum         → packages/fnv-checksum/
@clubhub/telemetry-sdk        → packages/telemetry-sdk/
@clubhub/shared               → shared/
```

Backend uses CommonJS `require()`. player-runtime and pre-runtime use ESM `import`.

## Project Structure

```
clubhub_player/
├── backend/src/
│   ├── index.js              ← Express entry (port 4000)
│   ├── db.js                 ← pg Pool singleton (max=10)
│   ├── routes/               ← health, content, manifest, playlist, venues, screens, schedules, ota, assets
│   ├── middleware/           ← requestId, rateLimiter, timeout, screenAuth, operatorAuth
│   ├── lib/                  ← governance core (see Frozen Map below)
│   ├── governance-kernel/    ← extracted governance kernel + cert runners
│   ├── plugins/ota-runtime/  ← OTA delivery lifecycle state machine
│   ├── platform-runtime/     ← lifecycle coordinator, execution router, topology manager
│   └── trace-store/          ← append-only hash-chained workflow trace log
├── player-runtime/src/       ← Pi player daemon (TypeScript ESM)
│   ├── index.ts              ← entry; reads SCREEN_ID, VENUE_ID env vars
│   └── orchestrator.ts       ← top-level coordinator
├── pre-runtime/src/          ← PRE.resolve() pure function + state machine
├── studio/src/               ← Operator React SPA (3 tabs: create/content/playlist)
├── services/                 ← TypeScript microservices layer (newer, separate from backend/)
│   ├── cms-api/              ← FULLY IMPLEMENTED: Fastify, 11 migrations, 18 routes, vitest, port 3001
│   ├── api-gateway/          ← STUB: app.ts has Wave 3 TODOs; BUILD FAILS (missing @clubhub/auth-types, @types/express)
│   ├── audit-service/        ← STUB: config/health defined, no Fastify init, no routes, no DB
│   ├── entropy-service/      ← PARTIAL: EntropyScheduler implemented; app.ts stub (Wave 3 TODOs)
│   ├── pre-runtime/          ← PARTIAL: CorpusStore/HeartbeatEmitter/AuditBuffer implemented; runtime.ts stub (Wave 4 TODOs); BUILD FAILS (missing @clubhub/corpus-schema)
│   ├── replay-service/       ← PARTIAL: append-only guard + hash-chain validator ready; app.ts stub (Wave 3 TODOs)
│   └── shadow-service/       ← PARTIAL: parity/divergence guard ready; app.ts stub (Wave 3 TODOs)
├── apps/                     ← cms-web, player-ui, sponsor-portal (shells only)
├── test-runner/              ← validate-contracts.js (79 checks), chaos suites
├── integration-harness/      ← Docker Compose e2e test harness (enrollment folded into integration-test.mjs step [3]; no separate screen-init container)
├── corpus/                   ← signed replay corpus vectors (99/99 pass)
├── backend/db/               ← init.sql + migrate_001–004.sql
└── agent-os/                 ← this directory
```

## Backend / Data Sources

### CMS API
- **URL**: `http://localhost:4000`
- **Auth**: `screenAuth` (HMAC token; enforcement optional via `SCREEN_AUTH_ENFORCE`); operator routes use `operatorAuth` (role-based)
- **Database**: PostgreSQL, raw `pg` Pool. No ORM. Pool max=10 (scale at ~150 screens).
- **Routes**: `/health` (no rate limit) · `/manifest` (120 req/60s) · `/content`, `/schedules`, `/venues`, `/screens`, `/ota`, `/playlist`, `/asset` (write rate limit)
- **CRITICAL**: All threshold reads must go through `governed-config.js` (`getThreshold()`). Direct `thresholds.json` reads are a contract violation (check #35).

## Styling Conventions

Studio is a minimal operational tool. Plain CSS in `studio/src/styles.css`. No Tailwind, no component library. Do not introduce a UI framework without explicit human approval.

## Navigation Patterns

**Studio**: `useState<Tab>` — tab-based, no router. Tabs: `create | content | playlist`. Do not add React Router (see D-006).

**Player UI**: Full-screen Chromium display driven by WebSocket messages from player-runtime. Not interactive.

## State Management

Studio: `useState`/`useEffect` per component. No global state library — do not introduce one without approval.

Backend: All governance state is database-authoritative. In-memory state rehydrates from DB on startup. Never treat in-memory state as the source of truth for governance decisions.

## Environment Variables

```
# Backend (required)
DATABASE_URL=postgres://clubhub:clubhub@localhost:5432/clubhub
PORT=4000                              # default 4000
SECRET_KEY=<32-byte hex>               # required when SCREEN_AUTH_ENFORCE=true

# Backend (optional)
SCREEN_AUTH_ENFORCE=true               # default: off
LOG_LEVEL=INFO                         # DEBUG|INFO|WARN|ERROR
LOKI_URL=http://loki:3100              # Loki log sink
UPLOAD_DIR=/path/to/uploads

# Player runtime (required)
SCREEN_ID=<screen identifier>
VENUE_ID=<venue identifier>
CMS_API_URL=http://backend:4000

# Player runtime (optional — all have defaults)
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
CORPUS_CACHE_DIR=/var/clubhub/corpus
REPLAY_CACHE_DIR=/var/clubhub/replay
ASSET_DIR=/var/clubhub/assets
CHROMIUM_URL=http://localhost:3001
WEBSOCKET_PORT=7777
PLAYER_UI_DIR=/opt/clubhub/player-ui

# Production deployment
DOMAIN=clubhub.example.com
DB_PASSWORD=<strong password>
CADDY_ACME_EMAIL=ops@example.com
```

## ⚠️ FROZEN MAP — Do Not Touch Without Logged Human Approval

These modules are governance primitives. Autonomous agents **must not modify** them:

| Module | Risk | Reason |
|---|---|---|
| `backend/src/lib/operator-ledger.js` | CRITICAL | Append-only SHA-256 hash chain — modification breaks audit integrity |
| `backend/src/lib/distributed-authority.js` | CRITICAL | DB-backed lease authority; HA safety model |
| `backend/src/lib/fleet-consensus.js` | CRITICAL | Epoch/generation authority for all manifests |
| `backend/src/lib/incident-orchestrator.js` | HIGH | Advisory-locked state machine; version-lock protocol |
| `backend/src/lib/governed-config.js` | HIGH | Central config singleton; must not be bypassed |
| `backend/src/lib/event-lineage.js` | HIGH | Causality chain; STRICT mode throws on anomaly |
| `pre-runtime/src/state-machine.ts` | HIGH | Core execution state machine; illegal transitions throw |
| `pre-runtime/src/pre-engine.ts` | HIGH | `_resolve()` must stay pure — no I/O or wall-clock |
| `pre-runtime/src/corpus.ts` | HIGH | Corpus integrity and hash verification |
| `test-runner/contracts/validate-contracts.js` | HIGH | 62-check CI gate; changes require human review |
| `backend/src/governance-kernel/` | HIGH | Kernel; changes must not break the 62-check gate |
| `backend/db/*.sql` | HIGH | Migration files are append-only; never alter existing ones |

## Known Lint / Type Issues

- Backend is CommonJS — do not convert to ESM (breaks all `require()` chains). See D-002.
- `eslint-disable no-unused-vars` on the Express error handler `_next` is intentional (4-arg signature required by Express).
- `HACK_KERNEL` string in `ControlPlaneCertification.js` is an intentional invalid value in a guard test — do not remove.
- `replay-cache.ts:36` throws at 50MB corpus cap — this is an operational constraint, not a bug. See BL-007.

## Port Allocation

See `PORT_ALLOCATION_STANDARD.md` at project root. Port 3000 is **reserved/forbidden** — too many tools default there. api-gateway is on 3001. Check before starting any local process.

## Running the App

```bash
# Full stack via Docker
docker compose up

# Backend only (development)
cd backend && npm start

# Integration test suite
docker compose -f docker-compose.integration.yml up --build --abort-on-container-exit

# Contract gate (must pass before every commit to governance files)
node test-runner/contracts/validate-contracts.js
```

---

## Horizon Role — Freeflow Mode

To run a freeflow Horizon session (think out loud about architecture, product direction, or future plans):

1. Agent reads `PROJECT_STATE.md`, `BACKLOG.md`, `DECISIONS.md`, `HORIZON.md`, and key arch files before engaging
2. Agent stress-tests ideas against the actual code — honesty over agreement
3. Before ending: any crystallised thought goes to `HORIZON.md` or `DECISIONS.md`
4. File a Stop Report

Full protocol: `agent-os/workflows/horizon-review.md`
Open questions and ideas in flight: `agent-os/HORIZON.md`

---

## MANDATORY STOP PROCEDURE

**Every session end — no exceptions — must produce a Stop Report.** This applies to clean completions too.

```
STOP REPORT

Stopped by: [role — e.g. Feature Development, QA, Governance]

Reason For Stopping:
[ ] Batch Objective Completed
[ ] Missing Project Information
[ ] Missing Authority
[ ] Architectural Ambiguity
[ ] Technical Blocker
[ ] External Dependency
[ ] Human Decision Required
[ ] Safety Concern
[ ] Context Window Pressure
[ ] Other: _______________

Description:
What specifically caused the stop?

Could this have been avoided? YES / NO
If YES — Recommended Governance Improvement:
  [ ] DECISIONS.md  — decision that should have been pre-made
  [ ] AUTONOMY.md   — rule or pattern that should have existed
  [ ] CLAUDE.md     — context or convention that was missing
  [ ] BACKLOG.md    — task spec that was too vague
  [ ] HANDOFF.md    — state that was stale or missing
  [ ] evolution/PROPOSALS.md — Agent OS gap, not a project gap

INTERRUPTION COST
Estimated Time Lost: ___ minutes
Affected Backlog Items: [IDs]
Workstream Impact: [ ] Current task only / feature area / multiple items / entire workstream
Severity: [ ] Low (≤15 min) / Medium (≤45 min) / High (>45 min) / Critical (>90 min)
Reasoning: <one sentence>

Current State:
What was completed this session?
What remains incomplete?

Recommended Next Action:
[specific — name the file, task ID, or decision needed]
```

**After filing the Stop Report**, the Governance role must:
1. Add a row to the Interruption Log in `AUTONOMY.md`
2. Update `PROJECT_STATE.md` to reflect completed/pending work
3. Update `BACKLOG.md` — mark completed items DONE
4. Apply any governance fix immediately (do not queue for later)

Full severity guide and workflow details: `agent-os/workflows/stop-report.md`
