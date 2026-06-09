# Shared Libraries

**Document type:** Engineering implementation planning
**Status:** Actionable — implementation-ready package specifications
**Authority:** ENGINEERING-CONSTITUTION-v1.md §15 (Forbidden Patterns), PRE-REFERENCE-IMPLEMENTATION-v1.md §3

---

## Overview

Six shared packages. These are the foundation layer that all services and applications depend on. They are developed and versioned inside the monorepo but published to an internal npm registry for cross-team reference and for deployment artifact isolation.

The dependency direction is one-way: packages may only import from packages lower in the stack. Services import from packages. Apps import from packages and may import from services' type definitions but not their implementations.

**Dependency stack (bottom to top):**
1. `fnv-checksum` (no deps)
2. `pre-types` (no deps)
3. `corpus-schema` (no deps; ajv as peer dep)
4. `constitutional-types` (depends on: pre-types)
5. `telemetry-sdk` (depends on: constitutional-types, pre-types)
6. `pre-engine` (depends on: pre-types, corpus-schema, fnv-checksum — explicitly NOT telemetry-sdk)

---

## Package 1: `@clubhub/fnv-checksum`

### Purpose

FNV-1a 32-bit hash and JSON canonicalization. These are the cryptographic primitives for all checksums in the platform: audit record integrity, corpus package integrity, parity record determinism, replay hash verification.

### Exports

```typescript
/**
 * FNV-1a 32-bit hash.
 * Returns a 32-bit unsigned integer.
 * Deterministic across all platforms — verified by cross-platform CI test.
 */
export function fnv1a32(input: string): number;

/**
 * Canonical JSON serialization.
 * - Keys sorted alphabetically (recursive)
 * - No trailing whitespace
 * - Arrays: elements in original order (not sorted)
 * - undefined values: omitted
 * - null values: included as null
 * Returns a string suitable as input to fnv1a32.
 */
export function canonicalizeJson(obj: unknown): string;
```

### Version strategy

Frozen. Treat as `1.0.0` indefinitely unless a verified correctness bug is found.

**Breaking change policy:** Any change to the hash algorithm or canonicalization rules is a BREAKING change that corrupts all existing checksums across the entire platform. A breaking change here requires:
1. A new corpus version (all audit records would need re-verification)
2. A migration plan for existing replay-audit-api records
3. PLATFORM_ADMIN sign-off
4. Coordinated deployment across all services simultaneously

This package must never receive casual updates. It is the most stable package in the monorepo.

### Constitutional constraint

This package is a pure function. It must never import anything. It must never use `Date`, `Math.random()`, or any non-deterministic primitive. CI must verify that the same input produces the same output on ARM (Pi) and x86 (cloud). The cross-platform test runs both architectures in CI and compares outputs.

### Ownership

Core Platform team. Changes require two senior engineer reviews and PLATFORM_ADMIN awareness.

---

## Package 2: `@clubhub/pre-types`

### Purpose

The complete TypeScript type contract for PRE.resolve() — inputs, outputs, and the system state it reads. Every service that needs to understand what PRE produces or consumes imports from this package.

### Exports

All types are re-exported from a single `index.ts`:

```typescript
// Resolution levels
export { RESOLUTION_LEVELS, type ResolutionLevel } from './resolution-levels';

// PRE input contract
export type {
  PRE_Input,
  SystemStateSnapshot,
  ScreenRecord,
  TvGroupRecord,
  AreaRecord,
  VenueRecord,
  OrganizationRecord,
  EmergencyStateRecord,
  OverrideRecord,
  ScheduleRecord,
  CampaignRecord,
  ContentItemRecord,
  SponsorshipContractRecord,
  ScreenDeliveryLogRecord,
} from './input-types';

// PRE output contract
export type {
  PRE_Output,
  PlaylistItem,
  ContentMix,
  ReasonTrace,
  ReasonTraceLevel,
  ReasonTraceSponsorshipLevel,
  ReasonTraceDeviceTruthLevel,
} from './output-types';
```

### Version strategy

Semantic versioning with a strict breaking-change definition:

- **PATCH:** No changes to exported types. Documentation only.
- **MINOR:** New optional fields added to existing types. New types added. Existing types that grow new optional fields are backwards-compatible because TypeScript structural typing allows objects with additional fields.
- **MAJOR:** Any field renamed or removed, any required field added to an existing type, any change to field type. A major version bump requires a corpus schema version bump and a migration across all consuming services.

**Breaking change policy:**
1. Deprecate old field with `@deprecated` JSDoc comment — maintain for one minor version
2. Add new field as optional in the same minor version
3. In the next major version, remove the deprecated field and make the new field required
4. Issue a migration guide with git history of the change

### Ownership

Core Platform team. Any change proposal must include a corpus migration assessment.

### Constitutional constraint

Zero runtime dependencies. The package is types-only — no runtime JavaScript output is needed. TypeScript `declaration: true`, `emitDeclarationOnly: true` in tsconfig. This ensures the package can never accidentally introduce runtime behavior.

---

## Package 3: `@clubhub/constitutional-types`

### Purpose

Types for the constitutional layer: failure classifications, constitutional state machine states, canary governance, and the complete union type of all structured log lines. These types are what every service uses to communicate about system health.

### Exports

```typescript
// Failure classification
export type { FailureClass } from './failure-class';  // 0 | 1 | 2 | 3 | 4 | 5

// Constitutional state machine
export type { ConstitutionalMode } from './constitutional-mode'; // 'NORMAL' | 'READ_ONLY' | 'EMERGENCY_FREEZE'

// Canary governance
export type {
  CanaryStage,
  RollbackReason,
  LegacyOutput,
  ShadowInvocation,
  ShadowComparisonResult,
  ParityRecord,
  RollbackTriggerOutput,
  StageTransitionResult,
  PromotionReadinessReport,
  ShadowReport,
} from './canary-types';
export { CANARY_STAGE_ORDER } from './canary-types';

// Telemetry schemas
export type { LogSeverity, BaseLogLine, AnyLogLine } from './telemetry-schemas';
export type {
  InvariantViolationLog, InvariantPassLog,
  ReplayPassLog, ReplayFailLog, ReplayRunCompleteLog,
  EntropyBatchLog, EntropyMetricLog, EntropyMetricDetailLog,
  EntropyScoreDetailLog, AdvisoryEscalationLog,
  ForbiddenStateLog, ParityDivergenceLog, CanaryGateLog,
  EmergencyActivationLog, ConstitutionalBreachLog,
  PREInvocationLog, PREResolutionLog, ShadowComparisonLog,
  RollbackTriggerLog, PreviewRequestLog, ReplayAuditWriteLog,
  EntropyJobLog, FailureEventLog, CircuitBreakerLog,
  StateTransitionLog, DegradationEventLog, ConstitutionalFreezeLog,
} from './telemetry-schemas';

// Entropy types
export type {
  EntropyLabel, AdvisoryTier, MetricResult, EntropyScore,
  VenueEntropyReport, FleetEntropyReport, StalenessClass,
  StalenessClassification, MetricCalculator,
} from './entropy-types';
```

### Version strategy

Coupled to `pre-engine` releases for failure class additions. Log line additions (new `AnyLogLine` union members) are MINOR changes — they are backwards-compatible because union types only become less precise when members are added, and existing consumers that exhaustively switch on `event_type` will get a TypeScript compile error alerting them to handle the new type.

**Breaking change policy:** Any removal from `AnyLogLine` union is a MAJOR change requiring all log consumers to be updated before the package is released.

### Ownership

Core Platform team. Telemetry schema additions may be proposed by any team but must be reviewed by the SRE team to ensure observability consistency.

### Constitutional constraint

This package depends only on `@clubhub/pre-types` (for `ResolutionLevel` used in some log schemas). Zero other dependencies.

---

## Package 4: `@clubhub/corpus-schema`

### Purpose

The corpus data format — the shape of the signed package that corpus-publisher distributes and player-runtime consumes. Provides both TypeScript types and JSON Schema validators (AJV-based) that can run at runtime.

### Exports

```typescript
// TypeScript types for corpus data structures
export type {
  CorpusPackage,
  CorpusVersion,
  CorpusVenueSlice,
  CorpusScreenSlice,
  CorpusCampaignRecord,
  CorpusScheduleRule,
  CorpusSponsorshipRecord,
  CorpusOverrideRecord,
  CorpusSignatureBlock,
} from './corpus-types';

// JSON Schema validators (AJV-compiled, run at runtime)
export {
  validateCorpusPackage,   // (data: unknown) => ValidationResult
  validateCorpusVersion,   // (data: unknown) => ValidationResult
  validateSignatureBlock,  // (data: unknown) => ValidationResult
} from './validators';

export type { ValidationResult } from './validators';
```

### Relationship to pre-types

`corpus-schema` defines the distribution format; `pre-types` defines the computation format. They are distinct:

- A `CorpusScheduleRule` may be more compact than a `ScheduleRecord` (corpus is denormalized for distribution efficiency)
- `corpus-publisher` assembles `CorpusPackage` from CMS data using CMS's own models
- `player-runtime` deserializes `CorpusPackage` and constructs a `SystemStateSnapshot` (pre-types) from it before calling PRE.resolve()

This means player-runtime is the translation layer between corpus-schema and pre-types. This translation step is where schema validation happens — player-runtime validates the corpus package against corpus-schema validators before constructing the PRE input.

### Version strategy

Corpus-version-gated. Every change to corpus-schema must produce a new corpus `version_id` prefix (e.g., `corpus-v2-*`). The old corpus format must remain parseable by player-runtime for one corpus version cycle (to handle rollback scenarios where a player has a v2 corpus but needs to fall back to v1 format).

**Breaking change policy:** Two major forms:
- **Format breaking** (field removed or type changed): requires parallel corpus format support in player-runtime during transition
- **Semantic breaking** (a field changes meaning): treated as format breaking even if the type is unchanged

### Ownership

Core Platform team (Data contracts squad). Changes must be coordinated with corpus-publisher and player-runtime teams simultaneously.

### Constitutional constraint

The `validateCorpusPackage` validator must be called in player-runtime before any corpus is applied. Validation failures must be logged as `CONSTITUTIONAL_BREACH` events and the new corpus must be rejected.

---

## Package 5: `@clubhub/telemetry-sdk`

### Purpose

Structured observability for all services. Provides typed emit functions that validate log line shapes before writing. Adapts to different backends without requiring services to know which backend is active.

### Exports

```typescript
// Emit a structured log line (validated against AnyLogLine before writing)
export function emit(line: AnyLogLine): void;

// Increment a named counter metric
export function increment(metric: string, tags?: Record<string, string>): void;

// Set a gauge metric (current value)
export function setGauge(metric: string, value: number, tags?: Record<string, string>): void;

// Get the base logger instance for configuration
export function base(): TelemetryAdapter;

// Set the correlation/request ID for the current async context
export function setRequestId(requestId: string): void;

// Get the current request ID
export function getRequestId(): string | null;
```

### Backend adaptation

The SDK resolves the backend at startup via environment variable `TELEMETRY_BACKEND`:

- `stdout_json` (default, development): writes JSON-serialized `AnyLogLine` to stdout. One line per event. Parseable by log aggregators.
- `opentelemetry` (production): exports via OTLP to the configured OpenTelemetry collector. Log lines become OTLP log records; metrics become OTLP metrics.
- `noop` (test): does nothing. Prevents test output pollution.

Services select their backend by setting `TELEMETRY_BACKEND` in environment. The SDK never reads this variable inside `pre-engine` scope because `pre-engine` cannot import this package at all.

### Validation behavior

`emit(line)` validates the line against the `AnyLogLine` union type using a runtime check (discriminating on `event_type`). If an unknown `event_type` is passed:
- In development: throws immediately (fast feedback)
- In production: logs a WARNING-severity event with `event_type: 'telemetry.unknown_schema'` and continues

This prevents unstructured log lines from entering the observability pipeline without silently dropping them.

### Version strategy

Independent of pre-engine. Backend changes (e.g., switching OpenTelemetry exporter libraries) are PATCH versions. New metric helper functions are MINOR. Changes to the `emit()` signature or validation behavior are MAJOR.

### Ownership

Platform Engineering / SRE team. Services may request new metric helpers but cannot modify the schema validation logic.

### Constitutional constraint: FP-21 enforcement

**This package must NEVER be imported by `packages/pre-engine`.**

This is the central constitutional constraint that the FP-21 forbidden pattern enforces. `validate-contracts.ts` scans `packages/pre-engine/` for any import of `telemetry-sdk` and fails CI if found.

Implementation note: the SDK uses Node.js `AsyncLocalStorage` for request-scoped context (to associate `request_id` with all log lines during a request). This is a runtime concern — exactly why it cannot be inside PRE, which is a pure function.

---

## Package 6: `@clubhub/pre-engine`

### Purpose

The PRE.resolve() pure deterministic function and its internal implementation: level resolvers (L0–L6), corpus query layer, constants, internal algorithms.

This is the most constitutionally constrained component in the platform. Its constraints are architectural facts, not preferences.

### Exports

```typescript
/**
 * Playlist Resolution Engine.
 * Pure function: same (input, corpus) always produces same output.
 * No side effects. No network. No filesystem. No time calls.
 *
 * @param input - Screen ID, evaluation timestamp, and complete system state
 * @returns Resolved playlist with reason trace and confidence score
 */
export function resolve(input: PRE_Input): PRE_Output;

// Corpus query layer (for use by player-runtime when constructing PRE_Input)
export { queryCorpus } from './corpus/query';

// Internal constants (exported for test verification only)
export { CONFIDENCE_THRESHOLD, SOV_WARNING_THRESHOLD } from './constants';
```

### What the package does NOT export

- Level resolvers (L0–L6) — internal implementation detail
- Any function that calls `Date.now()`, `Math.random()`, network, or filesystem
- Any mutable binding (`export let` or `export var`) — FP-15 forbids this

### Version strategy

Constitutional-change-gated. The version number is tied to the corpus schema version. A PRE version bump requires:

1. All 9 corpus replay packets re-run and passing
2. All CI stages 04 + 07 + 08 + 09 passing
3. Corpus version identifier updated
4. Migration plan if SystemStateSnapshot shape changed (pre-types version bump)

**Breaking change policy:** Any change to `resolve()`'s output shape for a given input is a MAJOR version — this corrupts existing replay audit baselines and requires all replay audit records from that point to be re-verified. This should be extremely rare post-launch.

### Ownership

Core Platform team. All PRE changes require constitutional review (two senior engineer sign-off plus a replay verification run on a full production corpus snapshot).

### Constitutional constraints enforced by the package itself

The package's `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strict": true
  }
}
```

`validate-contracts.ts` scans the package directory for all FP-01 through FP-21 patterns. Any violation fails CI before the build runs.

The package has a `prepublishOnly` script that runs the contract scanner — preventing publication if violations exist even if CI was somehow bypassed.

---

## Cross-Package Dependency Matrix

| Package | fnv-checksum | pre-types | corpus-schema | constitutional-types | telemetry-sdk | pre-engine |
|---|---|---|---|---|---|---|
| `fnv-checksum` | — | NO | NO | NO | NO | NO |
| `pre-types` | NO | — | NO | NO | NO | NO |
| `corpus-schema` | NO | NO | — | NO | NO | NO |
| `constitutional-types` | NO | YES | NO | — | NO | NO |
| `telemetry-sdk` | NO | YES | NO | YES | — | NO |
| `pre-engine` | YES | YES | YES | **FORBIDDEN** | **FORBIDDEN** | — |

**FORBIDDEN** in this matrix means: an import from pre-engine to that package would violate FP-21 (telemetry) or would introduce a circular constitutional concern (constitutional-types contains runtime state concepts that PRE must not know about). These are enforced by validate-contracts.ts, not just convention.

---

## Publishing Protocol

All packages publish to the internal npm registry (`registry.clubhub-internal.dev`).

**Publication checklist for any package:**
1. `validate-contracts.ts --path packages/{name}` passes
2. Full test suite passes (including cross-platform determinism test for fnv-checksum)
3. `CHANGELOG.md` updated with breaking change summary if MAJOR version
4. Version bumped in `package.json`
5. Git tag created: `{package-name}@{version}`
6. `npm publish --registry registry.clubhub-internal.dev` from the package directory via CI only (not from developer machines)

No package may be published from a developer's local machine. CI is the only publication path.
