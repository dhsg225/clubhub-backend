# Agent Registry

**Purpose**: One agent per terminal. One terminal per workstream. Agents are persistent — they pick the next item from their workstream backlog rather than retiring between tasks.

---

## Active Agent Roster

| Terminal | Agent | Workstream | Status |
|---|---|---|---|
| 1 | **CH1** | Player Appliance Risk Review | Active |
| 2 | **CH2** | Player Architecture Activation Plan | Active |
| 3 | **CH3** | CMS / HCI Architecture & Frontend | Active |
| 4 | **Governance** | Coordination | This session |

---

## Registered Agents

---

## Agent — CH1

**Operational Identity**: Claude session — Terminal 1
**Workstream**: Player Appliance Risk Review
**Role**: QA, deployment validation, integration testing
**Last Active**: 2026-06-09
**Status**: Active — BL-002 complete, awaiting next task

### Next action
`SCREEN_AUTH_ENFORCE=true` was enabled (BL-002). The integration harness was last validated before auth was turned on. Risk: player-runtime in Docker may now fail `/manifest` with 401.

1. Re-run the integration harness: `docker compose -f docker-compose.integration.yml up --build --abort-on-container-exit`
2. If any step fails due to 401, diagnose whether `integration-test.mjs` step [3] (enrollment) produces a token and whether player-runtime uses it for manifest calls.
3. Fix what breaks. Do not disable auth to pass — fix the auth flow.
4. Confirm 34/34 assertions pass.
5. Update `agent-os/BACKLOG.md` with findings.
6. Update `agent-os/PROJECT_STATE.md`.

**Do not modify any Frozen Map file.**

### Contract Gate Status
**Last run**: 79/79 PASS (2026-06-09, QA-2)

---

## Agent — CH2

**Operational Identity**: Claude session — Terminal 2
**Workstream**: Player Architecture Activation Plan
**Role**: Feature Development — player-runtime, pre-runtime, services layer
**Last Active**: 2026-06-09
**Status**: Active — BL-008 Wave 3 complete, BL-011 next

### Next action
BL-011 — pre-runtime Wave 4: WebSocket server + PRE.resolve() loop.

`services/pre-runtime/src/runtime.ts` has `CorpusStore`, `HeartbeatEmitter`, `AuditBuffer` implemented but the WebSocket server and PRE.resolve() loop are never started.

1. Read `services/pre-runtime/src/runtime.ts` — locate the three Wave 4 TODOs.
2. Read `services/pre-runtime/src/config.ts` — confirm `WS_PORT`, `CORPUS_SYNC_INTERVAL_MS`, `AUDIT_BATCH_INTERVAL_MS`.
3. Read `services/pre-runtime/src/corpus-store.ts` and `src/heartbeat.ts`.
4. Implement in `runtime.ts`:
   - WebSocket server on `config.WS_PORT` using the `ws` package.
   - PRE.resolve() loop at `config.CORPUS_SYNC_INTERVAL_MS`.
   - Audit batch flush at `config.AUDIT_BATCH_INTERVAL_MS`.
5. Wire `startRuntime()` from `index.ts` on boot.
6. Write at least one integration test verifying a resolve cycle completes.
7. `pnpm --filter @clubhub/pre-runtime typecheck` → clean.
8. `pnpm --filter @clubhub/pre-runtime test` → passes.
9. Update `agent-os/BACKLOG.md`: mark BL-011 DONE.
10. Update `agent-os/PROJECT_STATE.md`.

**Do not modify any Frozen Map file.**

### Contract Gate Status
**Last run**: 79/79 PASS (2026-06-09, FD-1)

---

## Agent — CH3

**Operational Identity**: Claude session — Terminal 3
**Workstream**: CMS / HCI Architecture & Frontend
**Role**: Feature Development (Frontend), documentation
**Last Active**: 2026-06-09
**Status**: Active — BL-010 complete, BL-012 next

### Next action
BL-012 — cms-web Phase 2: VenueDashboard with real screens + health data.

BL-010 delivered FleetDashboard and AppLayout. Phase 2 delivers the venue detail view per MVP cutline §2.2.

1. Read `apps/cms-web/src/routes/VenueDashboard.tsx` — currently shows venue name + placeholder.
2. Implement full VenueDashboard:
   - Fetch screens: `GET /screens?venue_id=:venueId`.
   - Render each screen: name, last_seen_at, `content_readiness_state`, `assets_required_count` / `assets_verified_count`.
   - 72h autonomy clock: time since `last_corpus_sync_at`, countdown to 72h limit.
   - RECOVERED_BUT_UNTRUSTED badge if applicable.
   - Loading + error states. No fake data.
3. BL-012 is already in `agent-os/BACKLOG.md` — mark DONE on completion.
4. `pnpm --filter @clubhub/cms-web typecheck` → 0 errors.
5. Update `agent-os/PROJECT_STATE.md`.

**Spec doc pre-reads (CMS-MVP-CUTLINE, CANONICAL-VENUE-OPERATIONS-SURFACE) are NOT required** — this task description is self-contained per AUTONOMY.md Spec Doc Pre-Read Exemption.

**Do not modify any Frozen Map file. Plain CSS only — no Tailwind or component libraries.**

### Contract Gate Status
**Last run**: 79/79 PASS (2026-06-09)

---

## Frozen Map Change Ledger

Consolidated view of which agents are touching which governed files.

| File | Last Modified By | Date | Status | Contract Gate Verified |
|---|---|---|---|---|
| `backend/src/lib/distributed-authority.js` | Pre-session (no active agent) | 2026-06-08 | Uncommitted — **ready to commit** | ✅ 79/79 PASS |
| `backend/src/lib/governed-config.js` | Pre-session (no active agent) | 2026-06-08 | Uncommitted — **ready to commit** | ✅ 79/79 PASS |
| `backend/src/lib/incident-orchestrator.js` | Pre-session (no active agent) | 2026-06-08 | Uncommitted — **ready to commit** | ✅ 79/79 PASS |
| `backend/src/lib/operator-ledger.js` | Pre-session (no active agent) | 2026-06-08 | Uncommitted — **ready to commit** | ✅ 79/79 PASS |
| `test-runner/contracts/validate-contracts.js` | Pre-session (no active agent) | 2026-06-08 | Uncommitted — **ready to commit** | ✅ 79/79 PASS |

**Resolution**: Contract gate ran 79/79 PASS. Safe to commit as a single unit.

---

## Retired / Inactive Agents

Previous role-based agents (QA-1, ARCH-1, DOCS-1, GPT-ADV-1, GPT-ADV-2, QA-2, FD-1, FD-2, FE-1) are retired as of 2026-06-09. Registry restructured to persistent workstream agents CH1/CH2/CH3. All their completed work is recorded in BACKLOG.md.

---

## Registry Change Log

| Date | Action | Detail |
|---|---|---|
| 2026-06-08 | Scaffold created | Agent-OS bootstrap |
| 2026-06-09 | Restructured | Replaced role-based agents with persistent workstream agents CH1/CH2/CH3 |
