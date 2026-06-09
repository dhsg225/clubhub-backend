# Repository Structure Plan

**Document type:** Engineering implementation planning
**Status:** Actionable — ready for repository bootstrap
**Authority:** Derived from ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md

---

## Monorepo vs Polyrepo Decision

**Decision: Monorepo with Turborepo.**

**Rationale:**

The constitutional constraint that makes this decision straightforward is FP-21: `telemetry-sdk` must never be imported inside `pre-engine`, yet both are developed together. A polyrepo makes this enforcement invisible — a developer adding a telemetry call to `pre-engine` would not get a CI error until the packages were integrated. In a monorepo with a single `validate-contracts.ts` pass, the violation is caught in the same pipeline that builds the engine.

More broadly, the existing codebase has 25 forbidden patterns (FP-01 through FP-25) enforced via `scripts/validate-contracts.ts`. These patterns define inter-module boundaries that must be checked as a unit. A polyrepo would require each service to vendor this script independently, creating drift risk. The monorepo keeps one canonical copy of the contract scanner and runs it across all packages simultaneously.

The `pre-engine` is also the most change-controlled component in the platform. Constitutional changes to PRE require corpus migrations, vector suite updates, and CI stage coordination. All of these happen atomically in a monorepo. In a polyrepo they require coordinated multi-repo PRs that are difficult to gate.

**Polyrepo exceptions:** The `player-runtime` service is deployed to Raspberry Pi hardware on a separate OTA cadence. It is developed inside the monorepo but its deployment artifact is produced by a dedicated release pipeline. This is not a polyrepo split — the code lives here; the deployment path diverges at artifact publication.

---

## Target Structure

```
clubhub-platform/
├── packages/
│   ├── pre-engine/
│   ├── pre-types/
│   ├── constitutional-types/
│   ├── corpus-schema/
│   ├── telemetry-sdk/
│   └── fnv-checksum/
├── services/
│   ├── player-runtime/
│   ├── cms-api/
│   ├── replay-audit-api/
│   ├── entropy-service/
│   ├── shadow-service/
│   ├── canary-service/
│   └── corpus-publisher/
├── apps/
│   ├── cms-web/
│   ├── player-ui/
│   └── sponsor-portal/
├── infra/
│   ├── terraform/
│   ├── docker/
│   └── ci/
├── scripts/
│   └── validate-contracts.ts   (single canonical copy — runs across entire monorepo)
└── docs/
```

---

## Package Specifications

### `packages/pre-engine`

**Ownership:** Core Platform team
**Primary language:** TypeScript (Node.js — compile-time only; ships as CommonJS for Pi compat)
**What it contains:** Everything currently in `src/pre/` — `PRE.resolve()`, all level resolvers (level0 through level6), corpus query layer, constants, internal types
**Deploy target:** Compiled into `player-runtime` artifact — never deployed standalone
**Release cadence:** Constitutional change-gated. Any modification to PRE logic requires a corpus version bump, vector suite re-run (9/9 replay), and CI stages 04 + 07 passing

**Allowed imports:**
- `packages/pre-types` — input/output contracts
- `packages/corpus-schema` — corpus structure validators (type-level only)
- `packages/fnv-checksum` — fnv1a32, canonicalizeJson

**Forbidden imports — explicit and non-negotiable:**
- `packages/telemetry-sdk` — FP-21: no emit()/increment() inside PRE
- `packages/constitutional-types` — PRE must not import runtime concern types
- Any `services/*` — PRE is a pure function; zero service dependencies
- Any `apps/*`
- `fs`, `http`, `https`, `axios`, `node-fetch`, `undici` — FP-05, FP-06
- `process.env` — FP-11

**Enforcement:** `validate-contracts.ts --path packages/pre-engine` runs as a blocking CI step before any other build task.

---

### `packages/pre-types`

**Ownership:** Core Platform team
**Primary language:** TypeScript (type definitions only — no runtime code)
**What it contains:** `PRE_Input`, `PRE_Output`, `SystemStateSnapshot`, `PlaylistItem`, `ContentMix`, `ReasonTrace`, `ScreenRecord`, `VenueRecord`, `ScheduleRecord`, `CampaignRecord`, `SponsorshipContractRecord`, `OverrideRecord`, `EmergencyStateRecord`, `ScreenDeliveryLogRecord`, `ResolutionLevel` enum, `RESOLUTION_LEVELS` const
**Deploy target:** Compile-time only; no runtime artifact
**Release cadence:** Semantic version. Any field rename or type change is a BREAKING change requiring a corpus schema version bump and cross-platform migration plan.

**Allowed imports:** Zero. This package has no runtime dependencies.

**Forbidden imports:** Everything.

---

### `packages/constitutional-types`

**Ownership:** Core Platform team
**Primary language:** TypeScript (type definitions only)
**What it contains:** `FailureClass` type, `ConstitutionalMode` type (`NORMAL | READ_ONLY | EMERGENCY_FREEZE`), `CanaryStage` type and `CANARY_STAGE_ORDER`, `RollbackReason`, `AnyLogLine` union and all log line interfaces (`PREInvocationLog`, `InvariantViolationLog`, `ConstitutionalFreezeLog`, etc.), `LogSeverity`, `AdvisoryTier`, `EntropyLabel`
**Deploy target:** Compile-time only
**Release cadence:** Coupled to `pre-engine` releases for failure class definitions; `telemetry-sdk` for log line additions

**Allowed imports:** `packages/pre-types` (for `ResolutionLevel` references in log schemas). Zero others.

---

### `packages/corpus-schema`

**Ownership:** Core Platform team (Data contracts squad)
**Primary language:** TypeScript + JSON Schema
**What it contains:** TypeScript types for corpus structure AND JSON Schema validators that can run at runtime. Corpus version schema, campaign slot schema, schedule rule schema, sponsorship contract schema
**Deploy target:** Compile-time for most consumers; also ships as a runtime JSON Schema bundle used by `corpus-publisher` for pre-signing validation and `player-runtime` for ingestion validation
**Release cadence:** Corpus version-gated. Any schema change requires a new corpus version identifier.

**Allowed imports:** Zero runtime dependencies. JSON Schema draft-07 validation may use `ajv` as a peer dependency declared explicitly.

**Why separate from pre-types:** `pre-types` defines the PRE computation contract; `corpus-schema` defines the data distribution format. These evolve on different cadences. A campaign slot in the corpus may be denormalized differently from its representation in the PRE input.

---

### `packages/telemetry-sdk`

**Ownership:** Platform Engineering / SRE team
**Primary language:** TypeScript
**What it contains:** `emit()`, `increment()`, `setGauge()`, `base()`, `setRequestId()` — wraps `src/observability/logger.ts` and `src/observability/metrics.ts`. Adapts to stdout JSON in dev and OpenTelemetry in production.
**Deploy target:** Runtime; included in all services except pre-engine
**Release cadence:** Independent. May update telemetry backends without requiring constitutional changes.

**Allowed imports:** `packages/constitutional-types` (for `AnyLogLine` schema validation), `packages/pre-types` (for typed event payloads). No service imports.

**Forbidden imports:**
- `packages/pre-engine` — SDK must not import the engine it observes
- Any `services/*`

**Constitutional constraint enforced internally:** `telemetry-sdk` must validate that any log line it emits conforms to one of the `AnyLogLine` schemas before writing. Ad-hoc `log.info('string')` calls must be rejected at the SDK boundary.

---

### `packages/fnv-checksum`

**Ownership:** Core Platform team
**Primary language:** TypeScript (pure function — no class, no state)
**What it contains:** `fnv1a32(input: string): number`, `canonicalizeJson(obj: unknown): string`. These are the cryptographic primitives for all checksums in the platform.
**Deploy target:** Runtime; included in all packages and services that compute checksums
**Release cadence:** Extremely stable. Changes here require re-verification of all audit record checksums. Treat as frozen unless a verified bug is found.

**Allowed imports:** Zero. No dependencies.

**Critical note:** The FNV-1a 32-bit implementation must produce bit-identical output across all deployment targets (Pi ARM, x86 cloud, test environments). Any platform-specific numeric behavior would corrupt audit chain integrity. This package must have a cross-platform determinism test that runs on both ARM and x86 in CI.

---

## Service Specifications (dependency view)

Full specifications in SERVICE-DECOMPOSITION.md. Dependency rules here:

### `services/player-runtime`

**Allowed imports:**
- `packages/pre-engine`
- `packages/pre-types`
- `packages/constitutional-types`
- `packages/telemetry-sdk`
- `packages/fnv-checksum`
- `packages/corpus-schema` (for ingestion validation)

**Forbidden imports:**
- `services/cms-api` — player NEVER calls CMS directly; uses corpus sync endpoint
- `services/replay-audit-api` — player batches records locally, pushes via HTTP POST; no direct DB access
- `services/shadow-service` — shadow runs on player side during canary; comparison results are pushed out
- `services/canary-service` — player receives canary stage via corpus; never polls canary service directly

### `services/cms-api`

**Forbidden imports:**
- `packages/pre-engine` — corpus is data to CMS, not code to execute
- `packages/pre-types` — CMS has its own domain types for campaigns/schedules; it does not construct PRE_Input objects

### `services/shadow-service`

**Forbidden imports:**
- `packages/pre-engine` — shadow receives pre-computed outputs from player-runtime; it never re-runs PRE

---

## Monorepo Tooling: Turborepo

**Decision:** Turborepo over Nx.

**Rationale:** Turborepo's mental model maps directly to the dependency graph here. Its `dependsOn` configuration expresses the constitutional build order without requiring a separate graph configuration language. Nx has stronger code generation features, but the monorepo here is not scaffold-heavy — it is constraint-heavy. Turborepo's cache invalidation is simpler to reason about for a team that needs to trust that CI exactly reproduces local builds (required for determinism verification).

### Build Order (Turborepo `pipeline`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "validate-contracts": {
      "dependsOn": [],
      "cache": false
    },
    "test": {
      "dependsOn": ["build", "validate-contracts"]
    },
    "deploy": {
      "dependsOn": ["test"],
      "cache": false
    }
  }
}
```

**Explicit package build order** (derived from dependency graph):

1. `packages/fnv-checksum` — no deps
2. `packages/pre-types` — no deps
3. `packages/constitutional-types` — depends on pre-types
4. `packages/corpus-schema` — no deps
5. `packages/telemetry-sdk` — depends on constitutional-types, pre-types
6. `packages/pre-engine` — depends on pre-types, corpus-schema, fnv-checksum
7. `services/player-runtime` — depends on pre-engine, pre-types, constitutional-types, telemetry-sdk, fnv-checksum, corpus-schema
8. `services/cms-api` — depends on constitutional-types, corpus-schema, telemetry-sdk
9. `services/replay-audit-api` — depends on pre-types, constitutional-types, fnv-checksum, telemetry-sdk
10. `services/entropy-service` — depends on pre-types, constitutional-types, telemetry-sdk
11. `services/shadow-service` — depends on pre-types, constitutional-types, fnv-checksum, telemetry-sdk
12. `services/canary-service` — depends on pre-types, constitutional-types, telemetry-sdk
13. `services/corpus-publisher` — depends on corpus-schema, fnv-checksum, constitutional-types
14. `apps/cms-web` — depends on constitutional-types, pre-types (for display of resolution levels)
15. `apps/player-ui` — depends on pre-types (for playlist rendering contract)
16. `apps/sponsor-portal` — depends on pre-types (for proof-of-play display)

---

## Constitutional Isolation Enforcement in Monorepo CI

`validate-contracts.ts` integrates at three levels:

**Level 1 — Pre-build gate (fastest, blocks everything):**
Run `validate-contracts.ts --path packages/pre-engine` before any package builds. If PRE has a constitutional breach, no build proceeds. This catches FP-01 through FP-21 violations in under 2 seconds.

**Level 2 — Full-scan gate (runs in parallel with builds):**
Run `validate-contracts.ts --all` to scan all source directories. This catches cross-package violations (e.g., entropy writing to state, telemetry in wrong locations). Runs concurrently with non-pre-engine builds.

**Level 3 — Merge-blocking CI stages:**
Existing stages 04 (replay harness), 07 (corpus verify), 08 (chaos smoke), 09 (preview verification), 10 (shadow parity), 11 (runtime constitution), 12 (production hardening) all remain merge-blocking and run against the integrated monorepo build. No stage may be skipped for any service deployment.

**Turborepo integration:** `validate-contracts` is a pipeline task with `cache: false` (never cache — always re-scan) and `dependsOn: []` (runs before builds, not after).

---

## Release Cadence Summary

| Component | Cadence | Trigger | Gate |
|---|---|---|---|
| `pre-engine` + `pre-types` | Constitutional | Corpus version bump | Stages 04, 07, 08, 09, 10, 11, 12 + human review |
| `fnv-checksum` | Rare/frozen | Verified bug only | Full audit chain re-verification |
| `constitutional-types` | Coupled to pre-engine | Schema additions | Stage 11 |
| `corpus-schema` | Corpus version-gated | Schema changes | Stage 07 |
| `telemetry-sdk` | Independent | Observability changes | Stage 11 |
| `player-runtime` | OTA cadence | Bug fixes, feature flags | All stages + OTA signing |
| `cms-api` | Standard CI/CD | Feature work | Stages 11, 12 |
| `replay-audit-api` | Standard CI/CD | Append-only schema additions | Stage 04 |
| `entropy-service` | Standard CI/CD | Metric changes | Stage 09 |
| `shadow-service` | Canary-gated | Parity logic changes | Stage 10 |
| `canary-service` | Standard CI/CD | Stage governance changes | Stage 10 |
| `corpus-publisher` | Corpus version-gated | Schema/signing changes | Stage 07 |
| `cms-web` | Continuous | UI feature work | Stage 11 (API contract check) |
| `player-ui` | OTA cadence | Renderer changes | OTA + E2E render test |
| `sponsor-portal` | Continuous | UI feature work | Read-only API test |
