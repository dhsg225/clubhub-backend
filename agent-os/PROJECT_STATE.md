# Project State
**Last updated**: 2026-06-09 | **Updated by**: Governance (session 4 — BL-012 complete, all active items DONE)
**Read time**: ~4 minutes

---

## What This Project Is

ClubHub TV is a governed digital signage platform for hospitality venues. A Node.js/Express CMS API (PostgreSQL, port 4000) serves content schedules and OTA updates to Raspberry Pi players running a TypeScript daemon (`player-runtime`) with 72-hour offline autonomy. A minimal React/Vite operator studio provides content creation and playlist management. The entire system is governed by a constitutional kernel: a 62-check CI contract gate, an append-only operator audit ledger, deterministic corpus replay, and a PRE (Policy Resolution Engine) that makes all scheduling decisions as a pure function.

---

## Active Agents

| Agent | Role(s) | Current Focus |
|---|---|---|
| Governance (this session) | Governance | Coordination, backlog management, human Q&A |

---

## Current Status — What's Working

| Feature | Status | Notes |
|---|---|---|
| CMS API (9 routes) | ✅ Assumed Working | All routes + middleware present; V1–V4 DB migrations |
| PRE.resolve() engine | ✅ Assumed Working | Pure function; 99/99 corpus vectors; 9/9 replay PASS |
| Player runtime daemon | ✅ Assumed Working | Orchestrator, corpus cache, heartbeat, watchdog present |
| Governance kernel (62 checks) | ✅ Assumed Working | Contract gate wired; all 62 checks enforced |
| OTA delivery pipeline | ✅ Assumed Working | plugins/ota-runtime + routes/ota.js + rollout-store |
| Operator audit ledger | ✅ Assumed Working | Append-only SHA-256 hash chain, DB-backed |
| Incident orchestrator | ✅ Assumed Working | Advisory-locked state machine, durable DB persistence |
| Fleet consensus (epochs) | ✅ Assumed Working | DB-authoritative epoch increment on startup |
| Integration test harness | ✅ Verified 2026-06-09 | 34/34 GREEN after BL-002 auth enforcement — harness uses cms-api:3001, unaffected by backend SCREEN_AUTH_ENFORCE |
| CI gates (stages 04–15) | ✅ Assumed Working | 8 merge-blocking stages configured |
| Studio SPA (3 tabs) | ✅ Assumed Working | create/content/playlist — minimal, no router |
| Screen auth enforcement | ✅ Done 2026-06-09 | BL-002: `requireScreenToken` wired to `/manifest`; `SCREEN_AUTH_ENFORCE=true`; migrations 003–005 applied; 401 verified, 79/79 contract gate PASS |
| Heartbeat asset readiness fields | ✅ Done 2026-06-09 | BL-009: HeartbeatPayload + DB migration (migrate_005.sql) + backend route updated; URL/method mismatch fixed |
| services/ microservices (Wave 3) | ✅ Done 2026-06-09 | All 5 stub services have functional routes + tests. 5+3+10+6+12=36 tests passing. |
| pre-runtime Wave 4 (WS + resolve loop) | ✅ Done 2026-06-09 | BL-011: WS server, PRE.resolve() loop, audit flush, corpus-mapper.ts. 6/6 tests, typecheck PASS. |
| cms-web Phase 1 | ✅ Done 2026-06-09 | BL-010: 0 typecheck errors, AppLayout+RequireAuth wired, FleetDashboard fetches real venues, LoginPage mock auth, dev server 200 |
| cms-web Live Ops mockup | ✅ Done 2026-06-09 | Claude Design pilot: FleetDashboard.mockup.tsx at __mockups__/, /preview route, Vite proxy to :4000, rendering with real venue data |
| cms-web VenueDashboard Phase 2 | ✅ Done 2026-06-09 | BL-012: screens table, readiness badge, asset ratio bar, 72h autonomy alarm, 0 typecheck errors |
| 5 modified governance files | ⚠️ Uncommitted | See Active Human Actions |

---

## ⚠️ Active Human Actions Required

1. **Review and commit (or reset) 5 uncommitted Frozen Map files**:
   - `backend/src/lib/distributed-authority.js`
   - `backend/src/lib/governed-config.js`
   - `backend/src/lib/incident-orchestrator.js`
   - `backend/src/lib/operator-ledger.js`
   - `test-runner/contracts/validate-contracts.js`

   Run `git diff backend/src/lib/` to inspect. These are governance primitives — commit only when the changes are understood and the contract gate passes.

2. **Review `DECISIONS.md`** — all entries are inferred from code. Correct any misidentified decisions and add rationale before the first Feature Development session.

3. **Review `AUTONOMY.md` Red Zone** — confirm whether a live production venue exists and add any deployment-specific rules.

---

## Active Workstreams

- **Harness stabilisation** — COMPLETE (2026-06-08)
- **Services audit** — COMPLETE (2026-06-08)
- **BL-009 heartbeat fields** — COMPLETE (2026-06-09): Governance session
- **BL-002 screen auth** — COMPLETE (2026-06-09): QA-2
- **BL-009 heartbeat fields** — COMPLETE (2026-06-09): Governance
- **BL-002 screen auth** — COMPLETE (2026-06-09): QA-2
- **BL-009 heartbeat fields** — COMPLETE (2026-06-09): Governance
- **BL-008 Wave 3 services** — COMPLETE (2026-06-09): FD-1 + FD-2 — 36 tests passing across 5 services
- **BL-010 cms-web Phase 1** — COMPLETE (2026-06-09): FE-1
- **Claude Design pilot** — COMPLETE (2026-06-09): Governance — Live Ops Surface mockup rendered, /preview route live at :5173
- **BL-012 VenueDashboard** — COMPLETE (2026-06-09): CH3/Governance

---

## Current Blockers

| Item | Blocker | Action |
|---|---|---|
| BL-001 | 5 uncommitted Frozen Map files | Human must review git diff and commit or reset |

---

## Next Recommended Actions (ranked)

1. **Human** — `git diff` the 5 modified files, then commit or reset. Run contract gate after. (Blocks BL-001)
2. **Human or Governance** — All active backlog items are DONE. Define next scope: next cms-web surface (CampaignList, ConstitutionalConsole), or promote a Future item.

---

## Architecture Snapshot

```
[Browser / Operator]
        │
   studio (React/Vite :3000)
        │  REST
        ▼
[CMS API] backend (Express :4000)
   └─ routes: manifest, content, schedules, venues, screens, ota, assets
        │  pg Pool (max 10)
        ▼
   PostgreSQL
        │
   Governance Kernel
   operator-ledger · fleet-consensus
   incident-orchestrator · governed-config
   distributed-authority · event-lineage

[Raspberry Pi Player]
   player-runtime (Node ESM)
        │  HTTP poll + WebSocket
        ▼
   CMS API :4000
   pre-runtime (PRE.resolve())
   └─ pure function · governed clock · corpus replay
```

**Backend**: PostgreSQL raw pg, Express 4, Node ≥ 20, port 4000
**Run**: `docker compose up` (full stack) or `cd backend && npm start`

---

## Governance Health

| Metric | Value |
|---|---|
| Sessions run | 0 |
| Total stops | 0 |
| Total time lost | 0 min |
| Active governance gaps | 1 (5 uncommitted Frozen Map files) |
| Escalation threshold hit | No |

---

## Agent Resume Protocol

**Read this file + `BACKLOG.md`. That is enough to start working.**

Pull other files on-demand only:
- Specific decision → `DECISIONS.md`
- Feature detail → `HANDOFF.md`
- Convention question → `CLAUDE.md`
- Zone/stop question → `AUTONOMY.md`

Do NOT pre-load all files. Context used reading = context not available for work.
