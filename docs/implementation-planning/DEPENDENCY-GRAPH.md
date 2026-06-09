# DEPENDENCY-GRAPH.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready
**Authority:** SERVICE-DECOMPOSITION.md, DATABASE-ROLLOUT-PLAN.md, IMPLEMENTATION-WAVES.md
**Last updated:** 2026-05-26

---

## Overview

This document defines the full dependency graph for all major implementation deliverables across all 7 waves. A deliverable at Level N depends on all deliverables at Level N-1 that it references. Nothing at Level N can be started until its Level N-1 dependencies are complete.

The graph is organized in levels (0 = no dependencies, ascending). Within a level, items can be built in parallel. Across levels, items must be built sequentially.

---

## ASCII Dependency Graph

```
LEVEL 0 — Foundation (no external dependencies)
├── pre-types package
├── constitutional-types package
├── fnv-checksum package
├── corpus-schema package
└── PostgreSQL schema Wave 1 (identity + tenancy)

LEVEL 1 — Depends on Level 0
├── pre-engine package ──────────────────── depends: pre-types, corpus-schema, fnv-checksum
├── telemetry-sdk package ───────────────── depends: constitutional-types
├── PostgreSQL schema Wave 2 (identity + access) ── depends: schema Wave 1
└── auth service ────────────────────────── depends: schema Wave 2

LEVEL 2 — Depends on Level 1
├── player-runtime (core loop) ──────────── depends: pre-engine, telemetry-sdk, pre-types
├── PostgreSQL schema Wave 3 (content model) ── depends: schema Wave 2
├── CMS API core ────────────────────────── depends: schema Wave 3, auth service
└── corpus-publisher (basic) ────────────── depends: pre-types, corpus-schema, fnv-checksum

LEVEL 3 — Depends on Level 2
├── player-ui ───────────────────────────── depends: player-runtime IPC
├── CMS web shell ───────────────────────── depends: CMS API, auth service
├── corpus sync (unsigned) ──────────────── depends: player-runtime, corpus-publisher, CDN
└── PostgreSQL schema Wave 4 (corpus tables) ── depends: schema Wave 3

LEVEL 4 — Depends on Level 3
├── PostgreSQL schema Wave 5 (append-only records) ── depends: schema Wave 4
├── corpus signing ──────────────────────── depends: corpus-publisher, AWS KMS
├── PostgreSQL RLS policies ─────────────── depends: schema Wave 5, auth service
├── replay-audit-api ────────────────────── depends: schema Wave 5, player audit buffer
├── CMS Campaign API ────────────────────── depends: CMS API core, schema Wave 3
├── CMS web v2 (campaign UI) ────────────── depends: Campaign API, CMS web shell
└── emergency system cloud ──────────────── depends: CMS API, Redis pub/sub

LEVEL 5 — Depends on Level 4
├── preview-api ─────────────────────────── depends: pre-engine, corpus-publisher, Campaign API
├── preview UX ──────────────────────────── depends: preview-api, CMS web v2
├── approval gate enforcement ───────────── depends: preview-api, Campaign API
├── entropy-service (cloud) ─────────────── depends: schema Wave 5, player-runtime metrics
├── WebSocket emergency push ────────────── depends: emergency system cloud, Redis pub/sub
├── mobile PWA v1 ───────────────────────── depends: emergency system cloud, entropy-service
└── player circuit breakers ─────────────── depends: player-runtime, src/runtime/circuit-breakers/

LEVEL 6 — Depends on Level 5
├── OTel integration ────────────────────── depends: all cloud services
├── entropy scheduler (cloud) ───────────── depends: entropy-service, player-runtime metrics
├── Grafana dashboards ──────────────────── depends: OTel integration, Prometheus
├── entropy review UX ───────────────────── depends: entropy-service, CMS web v2
├── alert routing ───────────────────────── depends: entropy-service, mobile PWA v1
├── shadow-service ──────────────────────── depends: parity schema (Wave 5), CMS API, replay-audit-api
└── canary-service ──────────────────────── depends: shadow-service, CMS API

LEVEL 7 — Depends on Level 6
├── shadow/canary UX ────────────────────── depends: shadow-service, canary-service, CMS web v2
├── sponsorship proof-of-play ───────────── depends: replay-audit-api, Campaign API
├── sponsor-portal ──────────────────────── depends: proof-of-play, preview-api, sponsor auth
└── GlobalConstitutionalBreaker prod ────── depends: all circuit breakers, constitutional console

LEVEL 8 — Depends on Level 7
├── EMERGENCY_FREEZE exit wizard ────────── depends: GlobalConstitutionalBreaker, constitutional console
├── post-incident review workflow ───────── depends: constitutional_freeze_log, CMS web
├── training certification system ───────── depends: auth service, role_assignments, CMS web
├── shift handover report ───────────────── depends: audit records, entropy-service, CMS web
├── golf marshal PWA ────────────────────── depends: emergency system, mobile PWA v1
└── disaster recovery drill ─────────────── depends: all Level 7 services, DR runbooks
```

---

## Dependency Table

Full dependency table with wave assignments and blocking relationships.

| Deliverable | Level | Wave | Depends on | Blocks |
|---|---|---|---|---|
| `pre-types` package | 0 | Pre-exists | None | pre-engine, player-runtime, corpus-publisher |
| `constitutional-types` package | 0 | Pre-exists | None | telemetry-sdk, all audit logging |
| `fnv-checksum` package | 0 | Pre-exists | None | pre-engine, corpus-publisher, replay-audit-api |
| `corpus-schema` package | 0 | Pre-exists | None | pre-engine, corpus-publisher |
| PostgreSQL schema Wave 1 (identity + tenancy) | 0 | Wave 1 | PostgreSQL 15+ | All other schemas; auth service; CMS API |
| `pre-engine` package | 1 | Pre-exists | pre-types, corpus-schema, fnv-checksum | player-runtime, preview-api |
| `telemetry-sdk` package | 1 | Pre-exists | constitutional-types | All services emitting telemetry |
| PostgreSQL schema Wave 2 (identity + access) | 1 | Wave 1 | schema Wave 1 | auth service, principals, role_assignments |
| auth service | 1 | Wave 1 | schema Wave 2 | CMS API, replay-audit-api, all protected endpoints |
| `player-runtime` (core loop) | 2 | Wave 1 | pre-engine, telemetry-sdk | player-ui, corpus sync, audit buffer delivery |
| PostgreSQL schema Wave 3 (content model) | 2 | Wave 1 | schema Wave 2 | CMS API core, Campaign API |
| CMS API core | 2 | Wave 1 | schema Wave 3, auth | Campaign API, emergency system, corpus-publisher trigger |
| `corpus-publisher` (basic, unsigned) | 2 | Wave 1 | pre-types, corpus-schema, fnv-checksum | corpus sync, Campaign API corpus build |
| `player-ui` | 3 | Wave 1 | player-runtime IPC | End-to-end playlist display |
| CMS web shell | 3 | Wave 1 | CMS API, auth | CMS web v2, all operator-facing UX |
| Corpus sync (unsigned) | 3 | Wave 1 | player-runtime, corpus-publisher, CDN | Wave 1 operational readiness gate |
| PostgreSQL schema Wave 4 (corpus tables) | 3 | Wave 2 | schema Wave 3 | corpus_versions, deployment_groups, corpus_deployments |
| PostgreSQL schema Wave 5 (append-only records) | 4 | Wave 2 | schema Wave 4 | replay_audit_records, parity_records, entropy_reports, canary_stage_history, constitutional_freeze_log |
| Corpus signing (Ed25519 + KMS) | 4 | Wave 2 | corpus-publisher, AWS KMS | Player corpus signature verification |
| PostgreSQL RLS policies | 4 | Wave 2 | schema Wave 5, auth | Wave 2 operational readiness gate |
| `replay-audit-api` | 4 | Wave 2 | schema Wave 5, player audit buffer | Audit chain integrity, proof-of-play, canary rollback routing |
| CMS Campaign API | 4 | Wave 3 | CMS API core, schema Wave 3 | Campaign lifecycle, corpus publication pipeline, preview-api |
| CMS web v2 (campaign UI) | 4 | Wave 3 | Campaign API, CMS web shell | All operator workflows |
| Emergency system cloud | 4 | Wave 3 | CMS API, Redis pub/sub | Emergency trigger, WebSocket push, mobile PWA |
| `preview-api` | 5 | Wave 4 | pre-engine, corpus-publisher, Campaign API | Preview UX, approval gate enforcement |
| Preview UX | 5 | Wave 4 | preview-api, CMS web v2 | Approval gate UX |
| Approval gate enforcement | 5 | Wave 4 | preview-api, Campaign API | Wave 4 constitutional requirement |
| `entropy-service` (cloud, basic) | 5 | Wave 3/5 | schema Wave 5, player metrics | Entropy scheduler, alert routing, entropy review UX |
| WebSocket emergency push | 5 | Wave 4 | emergency system cloud, Redis pub/sub | Sub-30s emergency delivery guarantee |
| Mobile PWA v1 | 5 | Wave 4 | emergency system cloud, entropy-service | Entropy CRITICAL push notifications, mobile emergency trigger |
| Player circuit breakers | 5 | Wave 4 | player-runtime, src/runtime/circuit-breakers/ | Player hardening, Wave 4 gate |
| OTel integration | 6 | Wave 5 | All cloud services | Grafana dashboards, alert routing |
| Entropy scheduler (cloud, full) | 6 | Wave 5 | entropy-service, player metrics | Entropy CRITICAL alerts within 5min |
| Grafana dashboards | 6 | Wave 5 | OTel, Prometheus | PLATFORM_ADMIN observability |
| Entropy review UX | 6 | Wave 5 | entropy-service, CMS web v2 | VENUE_OPERATOR entropy acknowledgment |
| Alert routing | 6 | Wave 5 | entropy-service, mobile PWA v1 | CRITICAL entropy within 5min SLA |
| `shadow-service` | 6 | Wave 6 | parity schema (Wave 5), CMS API, replay-audit-api | canary-service, parity dashboard |
| `canary-service` | 6 | Wave 6 | shadow-service, CMS API | Canary advancement, constitutional completeness |
| Shadow/canary UX | 7 | Wave 6 | shadow-service, canary-service, CMS web v2 | Wave 6 operator workflows |
| Sponsorship proof-of-play | 7 | Wave 6 | replay-audit-api, Campaign API | Sponsor portal, sponsor reporting |
| Sponsor portal | 7 | Wave 6 | proof-of-play, preview-api, sponsor auth | SPONSOR_STAKEHOLDER access |
| GlobalConstitutionalBreaker (production) | 7 | Wave 7 | All circuit breakers, constitutional console | EMERGENCY_FREEZE exit wizard |
| EMERGENCY_FREEZE exit wizard | 8 | Wave 7 | GlobalConstitutionalBreaker, CMS web | Wave 7 constitutional completeness |
| Post-incident review workflow | 8 | Wave 7 | constitutional_freeze_log, CMS web | Incident closure gate |
| Training certification system | 8 | Wave 7 | auth service, role_assignments, CMS web | Role grant gate |
| Shift handover report | 8 | Wave 7 | audit records, entropy-service, CMS web | Operator shift transition |
| Golf marshal PWA | 8 | Wave 7 | emergency system, mobile PWA v1 | Golf vertical specialization |
| Disaster recovery drill | 8 | Wave 7 | All Level 7 services, DR runbooks | Wave 7 operational readiness gate |

---

## Pre-Existing Items (Level 0)

These items exist in `src/` and are treated as stable infrastructure. They are NOT modified during Waves 1–7.

| Item | Location | What it provides |
|---|---|---|
| `pre-types` | `src/pre/types/` | TypeScript types for PRE input (SystemStateSnapshot, ScreenRecord, etc.) and output (PREResult, PlaylistItem, etc.) |
| `constitutional-types` | `src/shared/types/` | AnyLogLine union, all telemetry schema types (FailureEventLog, CircuitBreakerLog, etc.) |
| `fnv-checksum` | `src/shared/checksum/` | fnv1a32 implementation used by pre-engine and replay-audit-api |
| `corpus-schema` | `src/pre/schema/` | Zod schema for SystemStateSnapshot validation |
| `pre-engine` | `src/pre/` | PRE.resolve() orchestrator, 7 level resolvers, query layer |
| `telemetry-sdk` | `src/observability/` | Structured log emitters (emit, increment) |
| `src/runtime/` | `src/runtime/` | Runtime wrapper, GlobalConstitutionalBreaker, circuit breakers, state machine |
| `src/shadow/` | `src/shadow/` | ShadowRunner, parity comparison, canary stage types |
| `src/audit/` | `src/audit/` | ReplayAuditWriter, ReplayAuditReader |
| `src/entropy/` | `src/entropy/` | EntropyScheduler, metric calculators M-01–M-12 |

---

## Circular Dependency Rules

The following dependency directions are constitutionally forbidden. If any of these are discovered in the implementation, they must be removed immediately — they are not subject to debate or technical debt deferral.

### Forbidden: CMS API → pre-engine

**Why:** The CMS API is a data management service. If it imports pre-engine, it becomes possible for CMS API logic to depend on PRE resolution behavior, which could cause PRE behavior to be influenced by CMS implementation decisions. Corpus is data — it flows from CMS to player-runtime via corpus-publisher. Code does not flow back.

**How it manifests:** A backend engineer imports `PRE_OUTPUT_SCHEMA` from pre-engine to validate the corpus shape in CMS API. Instead: define the corpus shape in `corpus-schema` (a shared, neutral package) and import from there.

**Detection:** `constitutional-boundary-check.ts` catches all imports from `src/pre/` in CMS API code.

---

### Forbidden: pre-engine → telemetry-sdk

**Why:** FP-21 (from `validate-contracts.ts`). PRE is a pure function — it does not emit telemetry. Telemetry calls happen in the runtime wrapper (`src/runtime/`) which wraps PRE. If pre-engine imports telemetry-sdk, PRE.resolve() gains side effects, which breaks the determinism guarantee.

**How it manifests:** A developer adds a debug log inside `level3-campaign.ts` to help diagnose an issue. The log call imports from telemetry-sdk. `validate-contracts.ts` catches this as an FP-21 violation.

**Detection:** `validate-contracts.ts --all` checks FP-21 on every PR. This check is already wired in ci/stages/04.

---

### Forbidden: shadow-service → canary-service (circular)

**Why:** shadow-service sends events to canary-service (parity divergence events). canary-service reads parity summaries from shadow-service. This is a valid unidirectional dependency in both directions — but the two services must not call each other in a loop.

**Safe:** shadow-service emits `parity.divergence.class3` event → canary-service consumes. canary-service calls `GET /parity/report/:enterprise_id` on shadow-service → shadow-service responds. These are two separate unidirectional communications, not a circular dependency.

**Forbidden:** shadow-service calls canary-service to get the current canary stage before deciding whether to record a parity result. This creates a circular dependency where shadow-service behavior depends on canary-service state, which depends on shadow-service data.

**Mitigation:** shadow-service never reads canary stage. It records all parity results regardless of canary stage. The canary stage filtering (which records count toward promotion readiness) is done in canary-service's parity report aggregation.

---

### Forbidden: corpus-publisher → CMS API

**Why:** corpus-publisher is triggered by CMS API (via the `corpus.publish.requested` event). corpus-publisher reads the data it needs to assemble the corpus by calling CMS API at the time of the triggered build. But corpus-publisher must not call CMS API for any purpose other than this triggered build process. If corpus-publisher calls CMS API on its own schedule (e.g., polling for changes), it creates a hidden dependency that makes corpus-publisher's behavior dependent on CMS API availability.

**Safe:** `corpus.publish.requested` event arrives from CMS API → corpus-publisher calls CMS API once to fetch the current data for the specified enterprise → assembles corpus → publishes.

**Forbidden:** corpus-publisher polls CMS API every 5 minutes to check for new data. This makes corpus publication asynchronous and decoupled from the operator's intent, which weakens the 72h lead time guarantee (corpus could be rebuilt at any time without an operator-initiated trigger).

---

## Dependency Risk: Pre-engine Package Version Pinning

Because `pre-engine` is a Level 1 package that never changes, all downstream packages (player-runtime, preview-api) must pin to a specific version of pre-engine. If multiple packages depend on different versions of pre-engine, there may be type incompatibilities between them.

**Policy:** All packages in the monorepo must use the same version of `pre-engine`. The version is pinned in the root `package.json` using workspace dependencies. Any proposed update to `pre-engine` (which should be rare to non-existent) requires Technical Lead review and a full regression run of all vector suites.

---

## Parallelization Opportunities Within Waves

Not all items at the same level need to be started at the same time. The following items can be developed in parallel within their respective waves:

**Wave 1 (Weeks 1–6), parallel tracks:**
- Track A (Backend): PostgreSQL schema Wave 1 → PostgreSQL schema Wave 2 → auth service → CMS API core
- Track B (Edge): player-runtime core loop → player-ui → corpus sync integration
- Track C (Frontend): CMS web shell (starts in Week 2, after auth service has a basic implementation to test against)
- Track D (DevOps): PostgreSQL setup → Redis setup → CDN setup → CI pipeline

**Wave 3 (Weeks 13–20), parallel tracks:**
- Track A (Backend BE-1): Campaign lifecycle API + emergency system
- Track B (Backend BE-2): Corpus publication pipeline (corpus assembly + CDN delivery)
- Track C (Backend BE-3): Entropy service basic (report receiver)
- Track D (Frontend FE-1): CMS web v2 (campaign manager, emergency console)
- Track E (Frontend FE-2): Schedule editor, sponsorship management UI

**Wave 6 (Weeks 33–40), parallel tracks:**
- Track A (Backend BE-3): Shadow service
- Track B (Backend BE-temp): Canary service (starts after shadow service parity API is available)
- Track C (Backend BE-2): Sponsorship proof-of-play reports
- Track D (Frontend FE-1): Parity dashboard, canary wizard
- Track E (Frontend FE-2): Sponsor portal
