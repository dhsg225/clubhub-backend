# ClubHub TV — System Vision

**Last updated**: 2026-06-08 | **Authority**: Human-defined system topology
**Status**: Baseline — locked for Agent-OS harness alignment

---

## Core Thesis

ClubHub TV is a **governed edge-cloud platform** for hospitality digital signage. Reliability at the venue is the primary constitutional commitment. The system is designed so that a cloud failure is a degraded state, not an outage. A player that cannot reach the cloud must continue operating correctly for at least 72 hours.

---

## Component A — Edge Player Runtime

**Deployment target**: Linux-based hardware endpoint (Raspberry Pi or equivalent x86 fanless PC)

**Primary responsibility**: Render the correct scheduled content on screen at all times, with or without cloud connectivity.

**Key behaviours**:
- Polls the CMS API for a signed corpus at a configurable interval (default: 60s)
- Caches the corpus locally (`/var/clubhub/corpus`) — survives indefinite power cycles
- Resolves what to play using `PRE.resolve()` — a **pure function** that requires no network call
- Sends heartbeats to the CMS API to report health (distinct from corpus polling)
- Accepts remote commands (restart, force-sync, rollback) via polling — not push
- Launches and supervises a Chromium instance rendering the player UI over a local WebSocket
- Operates autonomously for **72 hours minimum** if the cloud becomes unreachable

**Bounded scope — the edge runtime must never**:
- Initiate governance decisions (promotion, freeze, incident creation)
- Write to the operator audit ledger directly
- Hold authority over which content is "approved" — it executes corpus decisions, it does not make them
- Depend on a real-time cloud connection for content playback

**Primary source**: `player-runtime/`, `pre-runtime/`
**Entry point**: `player-runtime/src/index.ts`
**Constitutional floor**: `autonomous_window_ms = 72 * 60 * 60 * 1000` — this value is frozen

---

## Component B — Cloud Studio CMS

**Deployment target**: Centralised cloud or on-premises server (Docker / Kubernetes)

**Primary responsibility**: Operator authority. The single source of truth for what content exists, what is scheduled, which venues and screens are enrolled, and what the current governance state is.

**Key behaviours**:
- Serves the signed corpus to all enrolled players on demand (`/manifest`, `/playlist`)
- Manages content, schedules, venues, and screen enrollment via REST API
- Runs the governance kernel: operator ledger, fleet consensus, incident orchestrator, governed config
- Manages OTA update rollouts: staging → canary → ring promotion → general availability
- Enforces the 62-check constitutional contract gate on every governed change
- Provides a minimal operator studio (React SPA) for content creation and playlist management
- Records all operator actions in the append-only hash-chained audit ledger

**Bounded scope — the CMS must never**:
- Deliver content that bypasses the corpus signing and integrity check
- Allow an OTA promotion without freeze enforcement and ledger recording
- Expose governance mutations without operator authentication
- Allow direct writes to `thresholds.json` at runtime — all config changes go through `governed-config.js`

**Primary source**: `backend/`, `studio/`
**Entry point**: `backend/src/index.js`
**Contract authority**: `test-runner/contracts/validate-contracts.js` (62 checks)

---

## Separation of Concerns — Hard Boundaries

| Concern | Edge (Player Runtime) | Cloud (Studio CMS) |
|---|---|---|
| Content scheduling decision | Executes (PRE.resolve) | Defines (corpus, schedules) |
| Governance authority | None | Full |
| Operator audit trail | None | Owns (ledger) |
| OTA promotion | Receives and applies | Initiates and governs |
| Incident declaration | Reports via heartbeat | Creates and manages |
| Offline operation | Required (72h) | N/A |
| DB access | None | Direct (pg Pool) |
| State mutation authority | None | Full |

**The Edge never writes governance state. The Cloud never renders content.**

---

## Interaction Model

```
[Operator / Browser]
        │
   Studio SPA (React/Vite)
        │  REST (content authoring, schedule management)
        ▼
CMS API (Express :4000)  ←───────────────────────────────────────────┐
        │                                                              │
        │  Signed corpus (HTTP poll)   Heartbeat (HTTP POST)          │
        │◄──────────────────────────── ──────────────────────►        │
        │                                                              │
[Raspberry Pi / Edge Device]                                          │
   player-runtime                                                      │
        │  PRE.resolve() [local, pure]                                 │
        │  72h corpus cache [local]                                    │
        │  WebSocket (localhost)                                       │
        ▼                                                              │
   Chromium → player-ui                                               │
        │                                                              │
        │  Remote commands (HTTP poll, no push)                        │
        └──────────────────────────────────────────────────────────────┘

[PostgreSQL]
        ▲
        │  All governance state (DB-authoritative)
        └─ fleet-consensus · operator-ledger · incident-orchestrator
           governed-config · distributed-authority · workflow-traces
```

---

## Agent Alignment Rules

All agents working in this repository must treat this topology as a hard constraint:

1. **Do not add cloud dependencies to the edge runtime.** `player-runtime/` and `pre-runtime/` must be operable without any network call after corpus delivery.

2. **Do not add governance mutation paths to the edge.** The edge reports state; the cloud decides.

3. **Do not add direct DB access to the player.** The player communicates only via the CMS API's public REST/WebSocket surface.

4. **Do not weaken the 72-hour autonomy floor.** Any change to corpus caching, expiry, or the `autonomous_window_ms` constant requires human authority.

5. **Do not bypass the contract gate.** All 62 checks must pass before any governed change is merged. A failing check is a hard blocker, not a warning.

6. **Governance state is DB-authoritative.** In-memory state is a cache. Never treat it as the source of truth for a governance decision.

---

## Evolutionary Intent

The current implementation is the reference substrate. Future milestones will layer:
- A full-featured `apps/cms-web` replacing the minimal `studio/` SPA
- A `apps/sponsor-portal` for venue-level content sponsorship workflows
- A `apps/player-ui` replacing the minimal Chromium-rendered display
- Expanded `agent-runtime/` and `ai-orchestration/` governed AI delegation paths

None of these change the Edge/Cloud separation. All future development must be classifiable as "Edge" or "Cloud" at design time. Work that spans both requires explicit architectural review before implementation.
