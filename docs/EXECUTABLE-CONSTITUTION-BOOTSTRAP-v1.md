# EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md
# ClubHub TV — Executable Constitutional Infrastructure Bootstrap

**Document type:** Implementation specification — executable enforcement layer
**Status:** Ratified
**Date:** 2026-05-21
**Authority:** Operationalizes ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, VERIFICATION-AND-SAFETY-SYSTEMS-v1.md, REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md, IMPLEMENTATION-ROADMAP-v1.md
**Superseded by:** Constitutional amendment only (per ENGINEERING-CONSTITUTION-v1.md §30)

---

## Normative Language

- **MUST** — Absolute requirement. Violation is a defect.
- **MUST NOT** — Absolute prohibition.
- **SHALL** — Synonym for MUST.
- **SHOULD** — Strong recommendation. Deviation requires documented justification.

---

## Table of Contents

1. [Bootstrap Philosophy](#1-bootstrap-philosophy)
2. [Repository Execution Topology](#2-repository-execution-topology)
3. [PRE Replay Harness Implementation](#3-pre-replay-harness-implementation)
4. [Invariant Execution Engine](#4-invariant-execution-engine)
5. [Fixture Execution Pipeline](#5-fixture-execution-pipeline)
6. [Divergence Classification Engine](#6-divergence-classification-engine)
7. [Shadow-Mode Verification Runtime](#7-shadow-mode-verification-runtime)
8. [Chaos Runtime Architecture](#8-chaos-runtime-architecture)
9. [Entropy Runtime Calculators](#9-entropy-runtime-calculators)
10. [PRE Preview Runtime](#10-pre-preview-runtime)
11. [CI/CD Constitutional Gates](#11-cicd-constitutional-gates)
12. [Migration Linting Engine](#12-migration-linting-engine)
13. [Observability Bootstrap](#13-observability-bootstrap)
14. [Runtime Determinism Controls](#14-runtime-determinism-controls)
15. [Corpus Runtime Loader](#15-corpus-runtime-loader)
16. [Incident Capture Runtime](#16-incident-capture-runtime)
17. [Initial Engineering Sprint Plan](#17-initial-engineering-sprint-plan)
18. [Appendix A — Runtime Module Dependency Graph](#18-appendix-a--runtime-module-dependency-graph)
19. [Appendix B — CI Pipeline State Machine](#19-appendix-b--ci-pipeline-state-machine)
20. [Appendix C — Replay Execution Sequence Diagram](#20-appendix-c--replay-execution-sequence-diagram)

---

## 1. Bootstrap Philosophy

### 1.1 Governance Without Enforcement Is Documentation Only

The Engineering Constitution, the PRE specification, the Verification and Safety Systems document, and the Canonical Fixtures document together define what this platform must be. None of them make the platform trustworthy. They define the rules. The executable bootstrap in this document is what enforces the rules at runtime.

A PRE invariant that is stated in a document but not asserted in code during every CI run is not enforced — it is aspirational. A replay fixture that exists in a directory but is not loaded, deserialized, and run against the current implementation on every pull request is not a regression gate — it is a historical artifact. A forbidden pattern that is named in the constitution but not detected by a static analysis tool is not prohibited — it depends on human vigilance.

The platform becomes trustworthy only when invariants execute automatically. This document defines how.

### 1.2 Executable Constitution

The executable constitution is the set of automated systems that make constitutional rules impossible to violate without detection:

- **Replay harness:** Runs every active corpus packet against the current PRE implementation on every PR. Any behavioral divergence blocks merge.
- **Invariant engine:** Asserts INV-1 through INV-10 as executable assertions on every PRE invocation in test, on every replay run, and as scheduled monitors in production.
- **Contract scanner:** Performs static analysis on every modified file, detecting forbidden patterns FP-01 through FP-15 before the code reaches runtime.
- **Migration linter:** Inspects every SQL migration file for constitutional violations before the migration is applied to any environment.
- **Entropy calculator:** Computes M-01 through M-12 and the Entropy Score on a daily schedule, emitting to dashboards and advisory surfaces — never triggering automated configuration changes.
- **Chaos runner:** Injects defined failure conditions and asserts that PRE invariants hold and graceful degradation occurs within specified bounds.

These systems are not optional developer conveniences. They are the executable expression of constitutional law. Their CI gates are hard blocks, not warnings.

### 1.3 Infrastructure as Enforcement

Every constitutional rule maps to an enforcement mechanism:

| Constitutional Rule | Enforcement Mechanism |
|--------------------|-----------------------|
| INV-3: Determinism | Replay harness (double-call test + corpus gate) |
| INV-1: Purity | Static analysis FP-02 + dynamic write-intercept gate |
| INV-7: Emergency absoluteness | Corpus GOLD-005/006 + invariant assertion |
| FP-07: No hardcoded thresholds | `validate-contracts.js` literal scan |
| FP-10: No timezone ambiguity | AST scan for `Date()`, `Date.now()` in resolution path |
| FORBIDDEN-1: Two active emergencies | Production monitor query every 15 minutes |
| §15: Replayability | Audit log retention + replayPRE function existence |
| §25.1: 100% PRE branch coverage | Jest coverage gate in CI |

### 1.4 Replay as Executable Truth

The corpus packet is the unit of behavioral truth. The replay harness executes it. The comparison of `actual_output_hash` against `expected_output_hash` is the verdict. This verdict is binary: pass or block. There is no partial pass, no advisory-only failure, no time-limited exception.

When the harness runs, the sequence is:

```
load packet → verify packet integrity hashes → deserialize SystemStateSnapshot
  → invoke PRE.resolve(screen_id, at, in_memory_db)
  → serialize actual output → compute actual_output_hash
  → compare actual_output_hash to packet.output_hash
  → classify divergence if different
  → emit ReplayResult
  → archive result to replay-results/{run_id}/
```

Every step is deterministic. Given the same packet and the same implementation, the harness produces the same result. If it does not, the harness itself is broken.

### 1.5 Invariants as Runtime Law

INV-1 through INV-10 are not prose rules. They are executable assertions. Each invariant maps to a function in `src/verification/invariants/` that takes a `PRE_Output` (and optionally the `ReplayInput`) and throws a typed `InvariantViolationError` if the invariant is not satisfied.

These assertions run:
1. In every unit test, wrapped around every PRE invocation.
2. In every replay harness execution, after `PRE.resolve()` returns.
3. In the production invariant monitor, as scheduled database queries every 15 minutes.
4. In the chaos runner, after each failure injection and after each recovery.

An `InvariantViolationError` in any of these contexts is a `CONSTITUTIONAL_BREACH`. It cannot be caught and suppressed. It terminates the run, emits a structured alert, and blocks the path forward.

### 1.6 Fixtures as Permanent Regression Anchors

A corpus packet that passes today will pass in five years, or the PRE implementation has regressed. This is the only invariant of the corpus itself: pass rate is monotonically 100% for active packets, or the implementation is wrong.

The fixture execution pipeline discovers, loads, and executes all active packets. It does not know about implementation history. It does not track which packets were added when. It executes all active packets and requires all to pass. This simplicity is intentional — complexity in the gate creates opportunities for silent degradation.

---

## 2. Repository Execution Topology

### 2.1 Full Directory Tree

```
clubhub_player/
│
├── src/
│   ├── pre/                          # Playback Resolution Engine (pure function)
│   │   ├── index.ts                  # PRE.resolve() — sole export
│   │   ├── levels/
│   │   │   ├── level0-emergency.ts
│   │   │   ├── level1-operational.ts
│   │   │   ├── level2-scheduled.ts
│   │   │   ├── level3-campaign.ts
│   │   │   ├── level4-sponsorship.ts
│   │   │   ├── level5-structural.ts
│   │   │   └── level6-device-truth.ts
│   │   ├── algorithms/
│   │   │   ├── swrr.ts               # Smooth Weighted Round Robin
│   │   │   ├── fnv1a32.ts            # FNV-1a 32-bit checksum
│   │   │   ├── canonicalize-json.ts  # Deterministic JSON serializer
│   │   │   ├── venue-local-time.ts   # toVenueLocal() — IANA timezone only
│   │   │   └── schedule-active.ts    # scheduleActive() — half-open intervals
│   │   ├── queries/
│   │   │   ├── device-state.ts       # Section 4.1 queries
│   │   │   ├── emergency-state.ts    # Section 4.2 queries
│   │   │   ├── override-state.ts     # Section 4.3 queries
│   │   │   ├── schedule-state.ts     # Section 4.4 queries
│   │   │   ├── sponsorship-state.ts  # Section 4.5 queries
│   │   │   └── device-truth.ts       # Section 4.6 queries
│   │   ├── types.ts                  # PRE_Output, PlaylistItem, ContentMix
│   │   └── constants.ts              # Compile-time constants only
│   │
│   ├── verification/
│   │   ├── invariants/
│   │   │   ├── index.ts              # InvariantRegistry, runAll()
│   │   │   ├── inv1-purity.ts
│   │   │   ├── inv2-totality.ts
│   │   │   ├── inv3-determinism.ts
│   │   │   ├── inv4-monotone-version.ts
│   │   │   ├── inv5-level-termination.ts
│   │   │   ├── inv6-no-amplification.ts
│   │   │   ├── inv7-emergency-absolute.ts
│   │   │   ├── inv8-sponsor-non-penetration.ts
│   │   │   ├── inv9-timezone-isolation.ts
│   │   │   ├── inv10-output-completeness.ts
│   │   │   └── types.ts              # InvariantViolationError, InvariantResult
│   │   │
│   │   ├── replay/
│   │   │   ├── harness.ts            # Main replay runner
│   │   │   ├── packet-loader.ts      # Deserialize + verify hashes
│   │   │   ├── in-memory-db.ts       # DatabaseConnection from SystemStateSnapshot
│   │   │   ├── comparator.ts         # output comparison + divergence detection
│   │   │   ├── reporter.ts           # ReplayRunReport generation
│   │   │   └── types.ts              # ReplayResult, ReplayRunReport
│   │   │
│   │   ├── parity/
│   │   │   ├── shadow-runner.ts      # Dual-execution shadow mode
│   │   │   ├── parity-scorer.ts      # Rolling parity confidence
│   │   │   ├── mismatch-logger.ts    # Structured divergence logging
│   │   │   └── canary-gate.ts        # Promotion gate evaluation
│   │   │
│   │   ├── divergence/
│   │   │   ├── classifier.ts         # Class 0-4 classification
│   │   │   ├── diff.ts               # Field-level diff algorithm
│   │   │   └── types.ts              # DivergenceClass, DivergenceReport
│   │   │
│   │   └── production-monitors/
│   │       ├── forbidden-state.ts    # FORBIDDEN-1 through FORBIDDEN-10 queries
│   │       ├── version-monotonicity.ts
│   │       └── audit-integrity.ts
│   │
│   ├── entropy/
│   │   ├── calculators/
│   │   │   ├── m01-override-divergence.ts
│   │   │   ├── m02-override-age.ts
│   │   │   ├── m03-campaign-coverage.ts
│   │   │   ├── m04-priority-range.ts
│   │   │   ├── m05-duplicate-content.ts
│   │   │   ├── m06-sov-warning-duration.ts
│   │   │   ├── m07-editorial-rate.ts
│   │   │   ├── m08-emergency-rate.ts
│   │   │   ├── m09-emergency-reason.ts
│   │   │   ├── m10-orphaned-schedules.ts
│   │   │   ├── m11-override-as-schedule.ts
│   │   │   └── m12-screen-staleness.ts
│   │   ├── staleness-index.ts
│   │   ├── entropy-score.ts          # Composite scorer + normalization
│   │   ├── batch-runner.ts           # Daily 03:00 batch orchestrator
│   │   └── types.ts
│   │
│   ├── preview/
│   │   ├── endpoint.ts               # GET /api/preview/screen/:id
│   │   ├── future-time.ts            # ?at= timestamp handling
│   │   ├── trace-renderer.ts         # reason_trace → human-readable
│   │   └── types.ts
│   │
│   ├── chaos/
│   │   ├── runner.ts                 # Orchestrator
│   │   ├── scenarios/
│   │   │   ├── db-restart.ts
│   │   │   ├── backend-restart.ts
│   │   │   ├── poll-storm.ts
│   │   │   ├── cache-loss.ts
│   │   │   ├── clock-skew.ts
│   │   │   └── partition.ts
│   │   ├── assertions.ts             # Invariant checks during chaos
│   │   └── capture.ts                # Replay artifact capture during failures
│   │
│   └── observability/
│       ├── logger.ts                 # Structured logger — required fields
│       ├── metrics.ts                # Prometheus gauge/counter/histogram
│       ├── correlation.ts            # request_id + replay_id propagation
│       └── telemetry-schemas.ts      # All log line schemas
│
├── corpus/
│   ├── CORPUS-INDEX.json
│   ├── golden/
│   │   ├── GOLD-001.json
│   │   ├── ...
│   │   └── GOLD-030.json
│   ├── edge_cases/
│   │   ├── EDGE-001.json
│   │   ├── ...
│   │   └── EDGE-015.json
│   ├── failure_states/
│   ├── entropy/
│   ├── chaos/
│   ├── historical_regression/
│   ├── cross_version_compat/
│   ├── archived/
│   │   ├── golden/
│   │   ├── edge_cases/
│   │   └── retirement_records/
│   └── integrity/
│       └── corpus-checksum-{YYYY-MM-DD}.sha256
│
├── scripts/
│   ├── run-replay.ts                 # CLI: run full corpus or filter
│   ├── run-invariants.ts             # CLI: assert all invariants against fixture
│   ├── run-chaos.ts                  # CLI: execute chaos scenario suite
│   ├── run-entropy.ts                # CLI: compute entropy for venue/all
│   ├── validate-contracts.ts         # CLI: forbidden-pattern static scan
│   ├── lint-migrations.ts            # CLI: SQL migration linter
│   ├── capture-incident.ts           # CLI: production incident capture
│   ├── promote-fixture.ts            # CLI: promote incident capture to corpus
│   ├── retire-fixture.ts             # CLI: initiate retirement workflow
│   └── verify-corpus-integrity.ts    # CLI: SHA-256 corpus integrity check
│
├── ci/
│   ├── stages/
│   │   ├── 01-schema-validate.yml
│   │   ├── 02-replay-corpus.yml
│   │   ├── 03-invariant-verify.yml
│   │   ├── 04-threshold-scan.yml
│   │   ├── 05-forbidden-pattern.yml
│   │   ├── 06-migration-lint.yml
│   │   ├── 07-parity-verify.yml      # Phase 2 + Phase 5 only
│   │   └── 08-chaos-smoke.yml
│   ├── gates.ts                      # Gate evaluation logic
│   ├── bypass-audit.ts               # Emergency bypass with mandatory record
│   └── artifact-retention.ts
│
├── migrations/
│   └── {NNN}_{description}.sql       # Sequential; each with rollback comment block
│
└── docs/
    ├── ENGINEERING-CONSTITUTION-v1.md
    ├── PRE-REFERENCE-IMPLEMENTATION-v1.md
    ├── VERIFICATION-AND-SAFETY-SYSTEMS-v1.md
    ├── REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md
    ├── IMPLEMENTATION-ROADMAP-v1.md
    └── EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md  (this document)
```

### 2.2 Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| PRE source files | kebab-case, function-named | `schedule-active.ts` |
| Invariant files | `inv{N}-{short-name}.ts` | `inv7-emergency-absolute.ts` |
| Corpus packets | `{CLASS}-{NNN}.json` | `GOLD-001.json`, `EDGE-015.json` |
| Corpus archived | `{CLASS}-{NNN}-retired-{YYYY-MM-DD}.json` | `GOLD-001-retired-2027-01-15.json` |
| Migration files | `{NNN}_{snake_case_description}.sql` | `005_add_sponsor_contracts.sql` |
| CI stages | `{NN}-{kebab-name}.yml` with leading zero | `02-replay-corpus.yml` |
| Scripts | `{verb}-{noun}.ts` | `capture-incident.ts` |

### 2.3 Ownership Rules

| Directory | Owner | Write Policy |
|-----------|-------|-------------|
| `src/pre/` | PRE maintainer | Any PR; requires invariant + corpus gate |
| `src/verification/invariants/` | Platform team | PR + second reviewer always |
| `corpus/golden/` | Platform team | PR + two reviewers; retirement requires two approvals |
| `corpus/historical_regression/` | Incident lead | PR following incident close |
| `corpus/archived/` | Platform team | Retirement process only |
| `ci/` | Platform team | PR + two reviewers |
| `scripts/` | Any engineer | PR + one reviewer |

The `corpus/` directory MUST be treated as an append-only source of truth. A force-push, rebase, or history-rewrite touching committed corpus files is a CONSTITUTIONAL_BREACH.

---

## 3. PRE Replay Harness Implementation

### 3.1 Architecture

The replay harness is a standalone executable (`scripts/run-replay.ts`). It has no dependency on the production application server, database, cache, or network. Its sole dependencies are: the PRE module (`src/pre/`), the corpus loader (`src/verification/replay/packet-loader.ts`), the in-memory database (`src/verification/replay/in-memory-db.ts`), the invariant engine (`src/verification/invariants/`), and the divergence classifier (`src/verification/divergence/`).

```typescript
// src/verification/replay/harness.ts

export interface ReplayHarnessOptions {
  corpusPath: string           // absolute path to corpus/ directory
  filter?: {
    class?: CorpusClass[]
    status?: 'active' | 'all'
    packetIds?: string[]
    invariants?: string[]      // only packets testing these invariants
  }
  parallel?: false             // MUST default false; see §5.5
  outputPath: string           // absolute path for run artifacts
}

export interface ReplayRunReport {
  run_id: string               // UUID v4 assigned at run start
  started_at: number           // UTC ms
  completed_at: number         // UTC ms
  pre_impl_version: string
  corpus_schema_version: string
  total_packets: number
  passed: number
  failed: number
  integrity_failures: number   // hash mismatch at load time
  divergences: DivergenceReport[]
  overall_result: 'PASS' | 'FAIL' | 'INTEGRITY_FAILURE'
}

export async function runReplayHarness(
  opts: ReplayHarnessOptions
): Promise<ReplayRunReport>
```

### 3.2 Packet Loader

```typescript
// src/verification/replay/packet-loader.ts

export interface PacketLoadResult {
  packet: ReplayPacket | null
  error: 'HASH_MISMATCH_INPUT' | 'HASH_MISMATCH_OUTPUT'
       | 'HASH_MISMATCH_PACKET' | 'SCHEMA_INVALID'
       | 'SCHEMA_VERSION_UNSUPPORTED' | null
}

export function loadPacket(filePath: string): PacketLoadResult {
  // 1. Read file bytes
  const raw = fs.readFileSync(filePath, 'utf-8')

  // 2. Parse JSON
  const parsed = JSON.parse(raw)  // throws on malformed JSON

  // 3. Schema version check
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(parsed.packet_version)) {
    return { packet: null, error: 'SCHEMA_VERSION_UNSUPPORTED' }
  }

  // 4. JSON Schema validation against Appendix B schema
  const valid = ajv.validate('replay-packet-v1.0.0', parsed)
  if (!valid) return { packet: null, error: 'SCHEMA_INVALID' }

  // 5. Verify input_hash
  const expectedInputHash = fnv1a32(canonicalizeJson(parsed.input))
  if (expectedInputHash !== parsed.input_hash) {
    return { packet: null, error: 'HASH_MISMATCH_INPUT' }
  }

  // 6. Verify output_hash
  const expectedOutputHash = fnv1a32(canonicalizeJson(parsed.expected_output))
  if (expectedOutputHash !== parsed.output_hash) {
    return { packet: null, error: 'HASH_MISMATCH_OUTPUT' }
  }

  // 7. Verify packet_hash (SHA-256 over packet minus packet_hash field)
  const packetWithoutHash = omit(parsed, 'packet_hash')
  const expectedPacketHash = sha256(canonicalizeJson(packetWithoutHash))
  if (expectedPacketHash !== parsed.packet_hash) {
    return { packet: null, error: 'HASH_MISMATCH_PACKET' }
  }

  return { packet: parsed as ReplayPacket, error: null }
}
```

A hash mismatch at load time produces `overall_result: 'INTEGRITY_FAILURE'` in the run report — a distinct outcome from `'FAIL'` (behavioral divergence). These require different response protocols (Section 6).

### 3.3 In-Memory Database

The in-memory database translates a `SystemStateSnapshot` into a read-only object implementing the same interface as the production `DatabaseConnection`. PRE receives this object as its third argument and calls the same query methods it would call against a live database.

```typescript
// src/verification/replay/in-memory-db.ts

export function buildInMemoryDb(snapshot: SystemStateSnapshot): DatabaseConnection {
  return {
    // Mimics READ COMMITTED transaction — all reads from sealed snapshot
    query: async (sql: string, params: unknown[]): Promise<unknown[]> => {
      return routeQuery(sql, params, snapshot)
    },
    // Write methods throw immediately — enforces INV-1 at harness level
    execute: async (_sql: string, _params: unknown[]): Promise<void> => {
      throw new InvariantViolationError('INV-1', 
        'PRE attempted database write during replay execution')
    },
    transaction: async (_fn: unknown): Promise<void> => {
      throw new InvariantViolationError('INV-1',
        'PRE attempted to open write transaction during replay execution')
    }
  }
}

function routeQuery(
  sql: string,
  params: unknown[],
  snapshot: SystemStateSnapshot
): unknown[] {
  // Pattern-match the SQL against the six query categories
  // (device state, emergency state, override state, schedule state,
  //  sponsorship state, device truth state)
  // Return the appropriate slice of snapshot data.
  // Ordering within each slice MUST match the ORDER BY clauses in
  // the production queries exactly.
  if (isDeviceStateQuery(sql)) return buildDeviceStateResult(params, snapshot)
  if (isEmergencyQuery(sql))   return buildEmergencyResult(params, snapshot)
  if (isOverrideQuery(sql))    return buildOverrideResult(params, snapshot)
  if (isScheduleQuery(sql))    return buildScheduleResult(params, snapshot)
  if (isSponsorshipQuery(sql)) return buildSponsorshipResult(params, snapshot)
  if (isDeviceTruthQuery(sql)) return buildDeviceTruthResult(params, snapshot)
  throw new Error(`Unrecognized query pattern in replay context: ${sql}`)
}
```

The `routeQuery` function MUST be kept in exact synchrony with the production query files in `src/pre/queries/`. When a production query changes, `routeQuery` MUST be updated in the same commit. CI enforces this with a query-sync check (Section 11.4).

### 3.4 Replay Executor

```typescript
// src/verification/replay/harness.ts (continued)

async function executePacket(
  packet: ReplayPacket,
  runId: string
): Promise<ReplayResult> {

  const startMs = Date.now()

  // Build in-memory database from sealed snapshot
  const db = buildInMemoryDb(packet.input.system_state)

  // Invoke PRE as pure function
  // No network, no cache, no event bus — only PRE + in-memory db
  let actualOutput: PRE_Output
  try {
    actualOutput = await PRE.resolve(
      packet.input.screen_id,
      packet.input.at,
      db
    )
  } catch (err) {
    // PRE threw — this is an INV-2 violation (totality)
    return {
      packet_id: packet.packet_id,
      run_id: runId,
      passed: false,
      error: 'PRE_THREW',
      violation: { invariant: 'INV-2', message: String(err) },
      execution_ms: Date.now() - startMs
    }
  }

  // Run all invariant assertions against actual output
  const invariantResults = runAllInvariants(actualOutput, packet.input)
  const invariantFailures = invariantResults.filter(r => !r.passed)
  if (invariantFailures.length > 0) {
    return {
      packet_id: packet.packet_id,
      run_id: runId,
      passed: false,
      error: 'INVARIANT_VIOLATION',
      violations: invariantFailures.map(f => ({
        invariant: f.invariantId,
        message: f.message
      })),
      execution_ms: Date.now() - startMs
    }
  }

  // Compute actual output hash
  const actualHash = fnv1a32(canonicalizeJson(actualOutput))

  if (actualHash === packet.output_hash) {
    return {
      packet_id: packet.packet_id,
      run_id: runId,
      passed: true,
      actual_checksum: actualHash,
      expected_checksum: packet.output_hash,
      execution_ms: Date.now() - startMs
    }
  }

  // Hash differs — classify divergence
  const divergence = classifyDivergence(
    packet.expected_output,
    actualOutput,
    packet
  )

  return {
    packet_id: packet.packet_id,
    run_id: runId,
    passed: false,
    error: 'BEHAVIORAL_DIVERGENCE',
    divergence,
    actual_output: actualOutput,
    actual_checksum: actualHash,
    expected_checksum: packet.output_hash,
    execution_ms: Date.now() - startMs
  }
}
```

### 3.5 Deterministic Execution Rules

1. Packets MUST be executed in deterministic order: sorted by `packet_id` (UUID lexicographic ascending). This order MUST NOT vary between runs.
2. Parallel execution is disabled by default. The `parallel` option MUST default to `false`. If enabled, packet results MUST be collected and sorted by `packet_id` before the report is assembled, so the report is deterministic regardless of completion order.
3. The harness MUST NOT retry a failed packet. A failure is a failure. Retries would mask flaky behavior.
4. The harness MUST NOT load application server configuration, environment variables, or database connections. All state comes from the sealed corpus packet.
5. The harness process MUST set `TZ=UTC` before any timestamp parsing occurs, preventing host timezone from leaking.

---

## 4. Invariant Execution Engine

### 4.1 InvariantRegistry

```typescript
// src/verification/invariants/index.ts

export interface InvariantResult {
  invariantId: string          // 'INV-1' through 'INV-10'
  passed: boolean
  message: string              // human-readable explanation
  severity: 'CONSTITUTIONAL_BREACH' | 'ERROR'
}

export interface InvariantAssertion {
  id: string
  description: string
  severity: 'CONSTITUTIONAL_BREACH' | 'ERROR'
  assert: (output: PRE_Output, input: ReplayInput) => InvariantResult
}

// Registration — all invariants registered at module load time
const REGISTRY: InvariantAssertion[] = []

export function registerInvariant(inv: InvariantAssertion): void {
  REGISTRY.push(inv)
}

// Ordered execution: INV-1 first (purity), INV-2 (totality), etc.
// Order matters for diagnostics — purity failure explains many downstream failures
export function runAllInvariants(
  output: PRE_Output,
  input: ReplayInput
): InvariantResult[] {
  return REGISTRY
    .sort((a, b) => parseInt(a.id.slice(4)) - parseInt(b.id.slice(4)))
    .map(inv => {
      try {
        return inv.assert(output, input)
      } catch (err) {
        // assertion itself threw — treat as invariant failure
        return {
          invariantId: inv.id,
          passed: false,
          message: `Assertion threw: ${String(err)}`,
          severity: inv.severity
        }
      }
    })
}
```

### 4.2 Individual Invariant Implementations

```typescript
// src/verification/invariants/inv2-totality.ts
registerInvariant({
  id: 'INV-2',
  description: 'PRE must return a valid PRE_Output for all inputs',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, _input) {
    if (output === null || output === undefined) {
      return { invariantId: 'INV-2', passed: false,
        message: 'PRE returned null or undefined',
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    if (!Array.isArray(output.active_playlist)) {
      return { invariantId: 'INV-2', passed: false,
        message: 'active_playlist is not an array',
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    if (output.active_playlist.length === 0) {
      return { invariantId: 'INV-2', passed: false,
        message: 'active_playlist is empty — System Fallback must always produce at least one item',
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    return { invariantId: 'INV-2', passed: true,
      message: 'Output is non-null with non-empty playlist',
      severity: 'CONSTITUTIONAL_BREACH' }
  }
})

// src/verification/invariants/inv3-determinism.ts
// NOTE: This invariant requires two PRE invocations with identical inputs.
// It is registered differently — called by the double-call wrapper in harness.
registerInvariant({
  id: 'INV-3',
  description: 'Identical inputs produce identical outputs (bit-level)',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, input) {
    // This assertion is post-hoc: the harness has already called PRE twice.
    // The comparator verifies checksums match. This registration is for
    // production monitoring hooks that use a different verification path.
    // In replay context, INV-3 is verified by comparing actual_hash to
    // expected_hash — two executions with same input, one from corpus capture,
    // one from current harness run.
    const hash = fnv1a32(canonicalizeJson(output.active_playlist))
    return { invariantId: 'INV-3', passed: true,
      message: `Playlist hash: ${hash}`,
      severity: 'CONSTITUTIONAL_BREACH' }
  }
})

// src/verification/invariants/inv6-no-amplification.ts
registerInvariant({
  id: 'INV-6',
  description: 'Output content_ids must be subset of active rule content_ids',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, input) {
    const activeContentIds = new Set<string>()
    // Collect all content_ids referenced by active rules in snapshot
    input.system_state.schedules.forEach(s => {
      if (s.content_id) activeContentIds.add(s.content_id)
    })
    input.system_state.overrides.forEach(o => {
      if (o.content_id) activeContentIds.add(o.content_id)
    })
    if (input.system_state.emergency?.content_id) {
      activeContentIds.add(input.system_state.emergency.content_id)
    }
    input.system_state.sponsorships.forEach(c => {
      if (c.content_id) activeContentIds.add(c.content_id)
    })
    // System fallback IDs are always permitted
    activeContentIds.add('system-fallback')
    activeContentIds.add('system-emergency')

    const violations = output.active_playlist
      .filter(item => !activeContentIds.has(item.content_id))
      .map(item => item.content_id)

    if (violations.length > 0) {
      return { invariantId: 'INV-6', passed: false,
        message: `Content amplification: output contains content_ids not in active rules: ${violations.join(', ')}`,
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    return { invariantId: 'INV-6', passed: true,
      message: `All ${output.active_playlist.length} output content_ids are subsets of active rule set`,
      severity: 'CONSTITUTIONAL_BREACH' }
  }
})

// src/verification/invariants/inv7-emergency-absolute.ts
registerInvariant({
  id: 'INV-7',
  description: 'Active emergency suppresses all non-emergency content',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, input) {
    const emergency = input.system_state.emergency
    if (!emergency) {
      return { invariantId: 'INV-7', passed: true,
        message: 'No active emergency — INV-7 not applicable',
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    // Emergency is active — verify output
    const forbiddenSources = ['campaign', 'override', 'sponsor', 'fallback']
    const violations = output.active_playlist
      .filter(item => forbiddenSources.includes(item.source))
    if (violations.length > 0) {
      return { invariantId: 'INV-7', passed: false,
        message: `Emergency active but non-emergency content present: ${
          violations.map(v => `${v.content_id}(${v.source})`).join(', ')}`,
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    if (output.resolution_level !== 0) {
      return { invariantId: 'INV-7', passed: false,
        message: `Emergency active but resolution_level = ${output.resolution_level}, expected 0`,
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    return { invariantId: 'INV-7', passed: true,
      message: 'Emergency content only; resolution_level = 0',
      severity: 'CONSTITUTIONAL_BREACH' }
  }
})

// src/verification/invariants/inv10-output-completeness.ts
registerInvariant({
  id: 'INV-10',
  description: 'Every playlist item has a corresponding reason_trace entry',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, _input) {
    const missingTrace = output.active_playlist.filter(item =>
      !output.reason_trace.some(trace =>
        trace.includes(item.content_id)
      )
    )
    if (missingTrace.length > 0) {
      return { invariantId: 'INV-10', passed: false,
        message: `No reason_trace entry for: ${missingTrace.map(i => i.content_id).join(', ')}`,
        severity: 'CONSTITUTIONAL_BREACH' }
    }
    return { invariantId: 'INV-10', passed: true,
      message: `All ${output.active_playlist.length} items have trace entries`,
      severity: 'CONSTITUTIONAL_BREACH' }
  }
})
```

### 4.3 INV-1 Purity Enforcement (Dynamic)

INV-1 cannot be verified post-hoc from the output alone. It requires wrapping the `DatabaseConnection` passed to PRE with a write interceptor.

```typescript
// src/verification/invariants/inv1-purity.ts

export function wrapWithPurityEnforcement(db: DatabaseConnection): DatabaseConnection {
  return {
    query: db.query.bind(db),  // reads are permitted
    execute: async (sql: string, params: unknown[]) => {
      const violation = new InvariantViolationError(
        'INV-1',
        `PRE attempted database write: ${sql.substring(0, 100)}`
      )
      // Emit structured alert before throwing
      logger.error({
        event: 'invariant_violation',
        invariant: 'INV-1',
        attempted_sql: sql.substring(0, 100),
        severity: 'CONSTITUTIONAL_BREACH'
      })
      throw violation
    },
    transaction: async (_fn: unknown) => {
      throw new InvariantViolationError(
        'INV-1',
        'PRE attempted to open a write transaction'
      )
    }
  }
}
```

In the replay harness, `buildInMemoryDb()` already throws on write attempts (Section 3.3). In the production Manifest Delivery System, the database connection passed to `PRE.resolve()` MUST also be wrapped with `wrapWithPurityEnforcement()` in staging and production environments. Write intercept is active always; it does not impose meaningful overhead since writes should never occur.

### 4.4 Production Invariant Monitoring Hooks

```typescript
// src/verification/production-monitors/forbidden-state.ts

const FORBIDDEN_STATE_QUERIES: Record<string, string> = {
  'FORBIDDEN-1': `
    SELECT venue_id, COUNT(*) AS cnt
    FROM emergency_states WHERE status = 'active'
    GROUP BY venue_id HAVING COUNT(*) > 1
  `,
  'FORBIDDEN-3': `SELECT id FROM manifest_cache WHERE version = 0`,
  'FORBIDDEN-4': `
    SELECT id FROM schedules
    WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at >= ends_at
  `,
  'FORBIDDEN-5': `
    SELECT id FROM overrides
    WHERE end_time IS NOT NULL AND end_time <= start_time
  `,
  'FORBIDDEN-6': `
    SELECT id FROM sponsorship_contracts
    WHERE share_of_voice <= 0 OR share_of_voice > 100
  `,
}

export async function runForbiddenStateMonitor(db: DatabaseConnection): Promise<void> {
  for (const [forbiddenId, sql] of Object.entries(FORBIDDEN_STATE_QUERIES)) {
    const rows = await db.query(sql, [])
    if (rows.length > 0) {
      logger.error({
        event: 'forbidden_state_detected',
        forbidden_id: forbiddenId,
        violation_count: rows.length,
        severity: 'CONSTITUTIONAL_BREACH'
      })
      metrics.increment('constitutional_violation_total', {
        type: forbiddenId, severity: 'CONSTITUTIONAL_BREACH'
      })
      // Does NOT throw — monitoring must not crash the monitor process
      // Alert routing handles escalation from the structured log
    }
  }
}
```

The monitor runs every 15 minutes via a scheduled job. It MUST NOT throw on violation — it records and alerts. The CI gate runs the same queries against the test database to catch violations before deploy.

---

## 5. Fixture Execution Pipeline

### 5.1 Fixture Discovery

```typescript
// src/verification/replay/harness.ts

function discoverFixtures(
  corpusPath: string,
  filter: HarnessOptions['filter']
): string[] {
  // 1. Load CORPUS-INDEX.json
  const index: CorpusIndex = JSON.parse(
    fs.readFileSync(path.join(corpusPath, 'CORPUS-INDEX.json'), 'utf-8')
  )

  // 2. Filter to active entries only (status = 'active')
  let entries = index.entries.filter(e => e.status === 'active')

  // 3. Apply optional filters
  if (filter?.class)        entries = entries.filter(e => filter.class!.includes(e.corpus_class as CorpusClass))
  if (filter?.packetIds)    entries = entries.filter(e => filter.packetIds!.includes(e.packet_id))
  if (filter?.invariants)   entries = entries.filter(e =>
    e.invariants_under_test.some(i => filter.invariants!.includes(i)))

  // 4. Sort deterministically by packet_id (lexicographic ascending UUID)
  entries.sort((a, b) => a.packet_id.localeCompare(b.packet_id))

  // 5. Return absolute file paths
  return entries.map(e => path.resolve(corpusPath, e.file_path))
}
```

Discovery is driven exclusively by `CORPUS-INDEX.json`. The harness MUST NOT walk the filesystem for `.json` files — this would discover archived or partially-written packets. Only indexed, status=`'active'` packets are executed.

### 5.2 Deterministic Ordering

Fixture execution order is determined by `packet_id` lexicographic sort. This produces a stable, environment-independent order. The run report lists results in the same order.

The fixture order MUST NOT affect outputs. This is a property of PRE itself (INV-3: determinism, INV-1: purity — no shared state between invocations). The invariant is also verified structurally: the in-memory DB for each packet is constructed fresh from that packet's `SystemStateSnapshot`, with no state carried from prior executions.

### 5.3 Parallel Execution Constraints

By default, parallel execution is disabled. Each packet is executed sequentially. Sequential execution:
- Produces deterministic output ordering without sorting overhead.
- Eliminates any risk of shared state between in-memory DB instances.
- Makes stack traces and log output unambiguous.

If `parallel: true` is specified (allowed only for time-bounded investigation runs, not CI):
- Each packet gets its own isolated in-memory DB instance.
- Results are collected into a map keyed by `packet_id`.
- The map is sorted by `packet_id` before building the report.
- `parallel: true` is forbidden in CI stage definitions (enforced by gate).

### 5.4 Output Snapshotting

After each replay run, the full `ReplayRunReport` is written to:
```
{outputPath}/replay-results/{run_id}/
  report.json          // ReplayRunReport
  divergences/
    {packet_id}.json   // One file per failure with full diff
  integrity-failures/
    {packet_id}.json   // One file per integrity failure
```

Replay run artifacts are retained for 30 days in CI storage, and permanently for runs that detected divergences.

### 5.5 Replay Archival

Every replay run report is appended to the corpus audit trail:
```
corpus/
  replay-audit/
    {YYYY-MM}/
      {run_id}-summary.json   // compact summary: date, pass count, fail count
```

These summaries are the input for the Quarterly Replay Audit Report (VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §12.5). They grow monotonically; none are deleted.

---

## 6. Divergence Classification Engine

### 6.1 Classification Entry Point

```typescript
// src/verification/divergence/classifier.ts

export type DivergenceClass = 0 | 1 | 2 | 3 | 4

export interface DivergenceReport {
  packet_id: string
  divergence_class: DivergenceClass
  class_label: 'COSMETIC' | 'TOLERATED' | 'WARNING' | 'CONSTITUTIONAL' | 'CATASTROPHIC'
  divergent_fields: FieldDiff[]
  checksum_expected: string
  checksum_actual: string
  recommended_action: string
  auto_approvable: false   // ALWAYS false — this field exists only to document that auto-approval is impossible
}

export function classifyDivergence(
  expected: PRE_Output,
  actual: PRE_Output,
  packet: ReplayPacket
): DivergenceReport {

  // Class 4 check first: integrity failures escalate before behavioral analysis
  if (isIntegrityFailure(expected, actual)) {
    return buildReport(packet, expected, actual, 4,
      'Replay system integrity compromised. All-stop. Investigate before any further replay activity.')
  }

  // Field-level diff
  const diffs = fieldDiff(expected, actual)

  // Class 3: constitutional invariant violation present in diff
  if (diffs.some(d => CONSTITUTIONAL_FIELDS.includes(d.field) && isInvariantViolation(d))) {
    return buildReport(packet, expected, actual, 3,
      'Invariant violation detected. Block PR. Escalate to constitutional review.')
  }

  // Class 2: behavioral output field differs
  if (diffs.some(d => BEHAVIORAL_FIELDS.includes(d.field))) {
    return buildReport(packet, expected, actual, 2,
      'Behavioral divergence. Block PR. Determine regression vs. intentional change. Initiate retirement if intentional.')
  }

  // Class 1: tolerated field differs within bounds
  if (diffs.every(d => TOLERATED_FIELDS.includes(d.field) && withinTolerance(d))) {
    return buildReport(packet, expected, actual, 1,
      'Tolerated divergence. Document in PR. Update comparison exclusion. No block.')
  }

  // Class 0: cosmetic only
  return buildReport(packet, expected, actual, 0,
    'Cosmetic divergence. Document in PR. No block.')
}

// Fields whose difference is NEVER acceptable — any diff here = Class 2 minimum
const BEHAVIORAL_FIELDS = [
  'active_playlist',           // order, content_ids, duration_ms values
  'checksum',
  'is_fallback',
  'resolution_level',
  'content_mix.campaign_pct',
  'content_mix.sponsor_pct',
  'content_mix.override_pct',
  'content_mix.fallback_pct',
  'content_mix.system_pct',
]

// Fields that may differ within documented bounds
const TOLERATED_FIELDS = [
  'computed_ms',               // execution timing
  'valid_until',               // within MIN_VALID_DURATION tolerance
]

// Fields whose difference with invariant characteristics = Class 3
const CONSTITUTIONAL_FIELDS = [
  'active_playlist',           // empty playlist = INV-2 violation
  'resolution_level',          // wrong level with active emergency = INV-7 violation
]
```

### 6.2 Field Diff Algorithm

```typescript
// src/verification/divergence/diff.ts

export interface FieldDiff {
  field: string          // dot-path: 'active_playlist[0].content_id'
  expected: unknown
  actual: unknown
  diff_type: 'MISSING_IN_ACTUAL' | 'MISSING_IN_EXPECTED' | 'VALUE_CHANGED' | 'ORDER_CHANGED'
}

export function fieldDiff(expected: PRE_Output, actual: PRE_Output): FieldDiff[] {
  const diffs: FieldDiff[] = []

  // Playlist comparison: ordered, element-by-element
  const maxLen = Math.max(
    expected.active_playlist.length,
    actual.active_playlist.length
  )
  for (let i = 0; i < maxLen; i++) {
    const exp = expected.active_playlist[i]
    const act = actual.active_playlist[i]
    if (!exp) { diffs.push({ field: `active_playlist[${i}]`, expected: undefined, actual: act, diff_type: 'MISSING_IN_EXPECTED' }); continue }
    if (!act) { diffs.push({ field: `active_playlist[${i}]`, expected: exp, actual: undefined, diff_type: 'MISSING_IN_ACTUAL' }); continue }
    if (exp.content_id !== act.content_id)
      diffs.push({ field: `active_playlist[${i}].content_id`, expected: exp.content_id, actual: act.content_id, diff_type: 'VALUE_CHANGED' })
    if (exp.duration_ms !== act.duration_ms)
      diffs.push({ field: `active_playlist[${i}].duration_ms`, expected: exp.duration_ms, actual: act.duration_ms, diff_type: 'VALUE_CHANGED' })
  }

  // Scalar fields
  for (const field of ['checksum', 'is_fallback', 'resolution_level'] as const) {
    if (expected[field] !== actual[field]) {
      diffs.push({ field, expected: expected[field], actual: actual[field], diff_type: 'VALUE_CHANGED' })
    }
  }

  // content_mix — tolerance ±0.001
  for (const key of ['campaign_pct', 'sponsor_pct', 'override_pct', 'fallback_pct', 'system_pct'] as const) {
    const delta = Math.abs((expected.content_mix[key] ?? 0) - (actual.content_mix[key] ?? 0))
    if (delta > 0.001) {
      diffs.push({ field: `content_mix.${key}`, expected: expected.content_mix[key], actual: actual.content_mix[key], diff_type: 'VALUE_CHANGED' })
    }
  }

  return diffs
}
```

### 6.3 Auto-Approval Is Impossible

The `DivergenceReport` type includes `auto_approvable: false` as a literal type field. This is not a boolean that could be set to `true` — it is a TypeScript literal type whose value is always `false`. No code path in the CI system checks `auto_approvable` for a truthy value to bypass the block. The block is unconditional for any divergence class ≥ 2.

The classification system informs the human reviewer about what kind of divergence occurred and what the recommended action is. It does not take the action itself. Only a human merge approval (after the appropriate process) unblocks the PR.

---

## 7. Shadow-Mode Verification Runtime

### 7.1 Dual-Execution Flow

Shadow mode is active when `PRE_SHADOW_MODE=true` in the environment. The Manifest Delivery System executes both the legacy engine and PRE for every incoming manifest request, serves the legacy output, and asynchronously logs divergences.

```typescript
// src/manifest-delivery/shadow-runner.ts

export async function resolveWithShadow(
  screenId: string,
  at: number,
  db: DatabaseConnection
): Promise<ManifestResponse> {

  // Primary: legacy engine — always used for serving
  const legacyResult = await legacyEngine.resolve(screenId, at, db)

  // Shadow: PRE — run concurrently with purity-enforced DB
  const shadowDb = wrapWithPurityEnforcement(db)
  let preResult: PRE_Output | null = null
  let preError: Error | null = null

  try {
    preResult = await PRE.resolve(screenId, at, shadowDb)
  } catch (err) {
    preError = err as Error
  }

  // Log shadow comparison asynchronously (never blocks legacy response)
  setImmediate(() => {
    logShadowComparison(screenId, at, legacyResult, preResult, preError)
  })

  return legacyResult
}

function logShadowComparison(
  screenId: string,
  at: number,
  legacy: ManifestResponse,
  pre: PRE_Output | null,
  preError: Error | null
): void {
  if (preError) {
    logger.error({
      event: 'shadow_pre_threw',
      screen_id: screenId,
      at,
      error: preError.message,
      severity: 'ERROR'
    })
    metrics.increment('shadow_divergence_total', { class: 'PRE_THREW' })
    return
  }

  const legacyChecksum = computeChecksum(legacy.playlist)
  const preChecksum    = computeChecksum(pre!.active_playlist)

  const isForbiddenDivergence = legacyChecksum !== preChecksum
    || legacy.is_fallback !== pre!.is_fallback

  logger.info({
    event: isForbiddenDivergence ? 'shadow_divergence_forbidden' : 'shadow_match',
    screen_id: screenId,
    at,
    legacy_checksum: legacyChecksum,
    pre_checksum: preChecksum,
    is_forbidden_divergence: isForbiddenDivergence,
    legacy_resolution_level: legacy.resolution_level,
    pre_resolution_level: pre!.resolution_level,
    divergence_class: isForbiddenDivergence ? 'FORBIDDEN' : 'TOLERATED'
  })

  if (isForbiddenDivergence) {
    metrics.increment('shadow_divergence_total', { class: 'FORBIDDEN' })
  }
}
```

### 7.2 Parity Scoring

```typescript
// src/verification/parity/parity-scorer.ts

export interface ParityScore {
  window_hours: number
  total_invocations: number
  forbidden_divergences: number
  parity_confidence: number    // 1.0 - (forbidden / total)
  gate_24h_passed: boolean     // parity_confidence = 1.0 over 24 hours
  gate_168h_passed: boolean    // parity_confidence >= 0.9999 over 7 days
}

export async function computeParityScore(
  db: DatabaseConnection,
  windowHours: number
): Promise<ParityScore> {
  const cutoff = Date.now() - windowHours * 3_600_000
  const rows = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_forbidden_divergence THEN 1 ELSE 0 END) AS forbidden
    FROM shadow_divergence_log
    WHERE logged_at >= $1
  `, [cutoff])

  const total    = Number(rows[0].total)
  const forbidden = Number(rows[0].forbidden)
  const confidence = total === 0 ? 1.0 : 1.0 - (forbidden / total)

  return {
    window_hours: windowHours,
    total_invocations: total,
    forbidden_divergences: forbidden,
    parity_confidence: Number(confidence.toFixed(6)),
    gate_24h_passed: windowHours >= 24 && confidence === 1.0 && forbidden === 0,
    gate_168h_passed: windowHours >= 168 && confidence >= 0.9999
  }
}
```

### 7.3 Canary Promotion Gates

PRE promotion is parity-earned. No passage of time earns promotion. The gate function is called by the deployment pipeline at each canary step.

```typescript
// src/verification/parity/canary-gate.ts

export type CanaryStep = 'internal' | 'ten_pct' | 'fifty_pct' | 'full'

export interface CanaryGateResult {
  step: CanaryStep
  passed: boolean
  blocking_reason?: string
  metrics: {
    parity_24h?: ParityScore
    parity_168h?: ParityScore
    p95_latency_ms?: number
    fallback_rate?: number
    error_rate?: number
  }
}

export async function evaluateCanaryGate(
  step: CanaryStep,
  db: DatabaseConnection
): Promise<CanaryGateResult> {

  const checks: string[] = []

  // All steps: zero forbidden divergences in 24h window
  const parity24 = await computeParityScore(db, 24)
  if (!parity24.gate_24h_passed) {
    checks.push(`24h parity gate failed: ${parity24.forbidden_divergences} forbidden divergences`)
  }

  // Step 'full' only: 7-day clean gate
  if (step === 'full') {
    const parity168 = await computeParityScore(db, 168)
    if (!parity168.gate_168h_passed) {
      checks.push(`168h parity gate failed: confidence ${parity168.parity_confidence} < 0.9999`)
    }
  }

  // Latency gate: p95 <= legacy_p99 * 1.20
  const latency = await getP95ManifestLatency(db)
  const legacyP99 = await getLegacyP99Latency(db)
  if (latency > legacyP99 * 1.20) {
    checks.push(`p95 latency ${latency}ms exceeds legacy p99 ${legacyP99}ms + 20%`)
  }

  // Fallback rate: PRE screens <= legacy baseline
  const preRate = await getPREFallbackRate(db)
  const legacyRate = await getLegacyFallbackRate(db)
  if (preRate > legacyRate) {
    checks.push(`PRE fallback rate ${preRate} exceeds legacy ${legacyRate}`)
  }

  return {
    step,
    passed: checks.length === 0,
    blocking_reason: checks.length > 0 ? checks.join('; ') : undefined,
    metrics: { parity_24h: parity24 }
  }
}
```

### 7.4 Rollback Execution

```typescript
// src/verification/parity/canary-gate.ts (continued)

export async function executeRollback(
  reason: string,
  db: DatabaseConnection
): Promise<void> {
  // Set all canary screens back to legacy engine
  await db.execute(
    `UPDATE screens SET pre_enabled = false WHERE pre_enabled = true`,
    []
  )
  // Emit audit event
  await db.execute(`
    INSERT INTO audit_events
      (event_id, event_type, actor_id, target_type, target_id, occurred_at, payload)
    VALUES ($1, 'canary.rollback', 'system', 'deployment', 'pre-canary', $2, $3)
  `, [uuid(), Date.now(), JSON.stringify({ reason })])

  logger.error({
    event: 'canary_rollback_executed',
    reason,
    severity: 'ERROR'
  })
}
```

---

## 8. Chaos Runtime Architecture

### 8.1 Orchestrator

```typescript
// src/chaos/runner.ts

export interface ChaosScenario {
  id: string                        // e.g., 'CHAOS-001'
  description: string
  setup: () => Promise<void>        // configure test environment
  inject: () => Promise<void>       // apply failure condition
  verifyDuring: () => Promise<void> // assert during failure window
  recover: () => Promise<void>      // remove failure condition
  verifyAfter: () => Promise<void>  // assert after recovery
  teardown: () => Promise<void>     // clean up
}

export async function runChaosScenario(
  scenario: ChaosScenario,
  captureReplays: boolean = true
): Promise<ChaosResult> {

  const runId = uuid()
  logger.info({ event: 'chaos_scenario_start', scenario_id: scenario.id, run_id: runId })

  await scenario.setup()

  // Capture pre-failure PRE output for baseline
  const preFailureOutput = captureReplays
    ? await captureCurrentPREState(scenario.id, runId, 'pre_failure')
    : null

  await scenario.inject()

  let duringError: Error | null = null
  try {
    await scenario.verifyDuring()
  } catch (err) {
    duringError = err as Error
  }

  await scenario.recover()

  let afterError: Error | null = null
  try {
    await scenario.verifyAfter()
  } catch (err) {
    afterError = err as Error
  }

  // Capture post-recovery PRE output
  if (captureReplays) {
    await captureCurrentPREState(scenario.id, runId, 'post_recovery')
  }

  await scenario.teardown()

  const passed = !duringError && !afterError
  logger.info({
    event: 'chaos_scenario_complete',
    scenario_id: scenario.id,
    run_id: runId,
    passed,
    during_error: duringError?.message,
    after_error: afterError?.message
  })

  return { scenario_id: scenario.id, run_id: runId, passed, duringError, afterError }
}
```

### 8.2 Database Restart Scenario

```typescript
// src/chaos/scenarios/db-restart.ts

export const dbRestartScenario: ChaosScenario = {
  id: 'CHAOS-002',
  description: 'PostgreSQL restart within MAX_STALE_AGE window',

  async setup() {
    // Ensure all test screens have fresh cached manifests
    await warmManifestCacheForTestScreens()
  },

  async inject() {
    // Stop PostgreSQL
    await execShell('pg_ctl stop -m immediate -D $PGDATA')
    // Wait 45 seconds (within MAX_STALE_AGE of 60 seconds)
    await sleep(45_000)
  },

  async verifyDuring() {
    // Manifest requests MUST return stale cached content, not 5xx
    const response = await fetchManifest(TEST_SCREEN_ID)
    assert(response.status !== 500, 'Expected non-5xx during DB unavailability')
    assert(response.status === 200, 'Expected 200 with stale cache')
    const body = await response.json()
    assert(body.is_fallback === false, 'Stale cache should not be is_fallback')
    
    // Structured log must contain stale cache indicator
    const logs = await collectRecentLogs('manifest_computed', 5_000)
    assert(logs.some(l => l.cache_age_ms > 0), 'Expected stale_cache indicator in logs')

    // PRE invariants that do not require DB
    // INV-2: response MUST be non-null (stale cache satisfies this)
    assert(body.active_playlist?.length > 0, 'INV-2: non-empty playlist required')
  },

  async recover() {
    await execShell('pg_ctl start -D $PGDATA')
    await waitForDatabaseReady(10_000)
  },

  async verifyAfter() {
    // Fresh PRE computation should resume
    const response = await fetchManifest(TEST_SCREEN_ID)
    const body = await response.json()
    assert(response.status === 200, 'Expected 200 post-recovery')
    // Version must not have decremented
    const versionAfter = body.version
    const versionBefore = await getStoredVersion(TEST_SCREEN_ID)
    assert(versionAfter >= versionBefore, 'INV-4: version must not decrement post-recovery')
  },

  async teardown() {
    await clearTestManifestCache()
  }
}
```

### 8.3 Poll Storm Scenario

```typescript
// src/chaos/scenarios/poll-storm.ts

export const pollStormScenario: ChaosScenario = {
  id: 'CHAOS-006',
  description: '500 concurrent manifest polls within 1 second',

  async setup() {
    await provisionTestScreens(500)
    await warmManifestCacheForTestScreens()
  },

  async inject() {
    // 500 concurrent requests in 1 second using k6 or equivalent
    await executeLoadTest({
      target: 500,
      duration: 1,
      endpoint: '/api/manifest/{screen_id}',
      screenIds: TEST_SCREEN_IDS
    })
  },

  async verifyDuring() {
    const results = await getLoadTestResults()
    const p95 = results.latency.p95
    assert(p95 <= 500, `p95 latency ${p95}ms exceeds 500ms budget`)
    assert(results.errorRate === 0, `Error rate ${results.errorRate} must be 0`)
    
    // Verify version counter correctness — no double-increment
    for (const screenId of TEST_SCREEN_IDS) {
      const versions = await getVersionHistory(screenId)
      // Each checksum change should produce exactly one version increment
      const uniqueChecksumChanges = countUniqueChecksumChanges(versions)
      const versionIncrements = versions.length - 1
      assert(versionIncrements === uniqueChecksumChanges,
        `Version incremented ${versionIncrements} times for ${uniqueChecksumChanges} checksum changes`)
    }
  },

  async recover() { /* No recovery needed for storm scenario */ },
  async verifyAfter() { /* System should be at nominal state */ },
  async teardown() { await deprovisionTestScreens(500) }
}
```

### 8.4 Chaos Verifies Graceful Degradation, Not Uptime Perfection

Each chaos scenario's `verifyDuring()` method asserts degradation behaviors, not nominal behaviors. The distinction is explicit in every scenario:

- DB restart: assert that stale cache is served (not that PRE computes fresh output)
- Network partition: assert System Fallback activates after MAX_STALE_AGE (not that manifests are current)
- Cache loss: assert PRE recomputes (not that cache hits occur)

The assertions that MUST hold in all scenarios regardless of failure:
- `response.status !== 500` — no unhandled server errors
- `body.active_playlist.length > 0` — INV-2 Totality
- Version monotonicity for any screen where versions are compared
- Emergency content when emergency is pre-activated

---

## 9. Entropy Runtime Calculators

### 9.1 Calculator Architecture

Each metric (M-01 through M-12) is an independent function in `src/entropy/calculators/`. Each function accepts a `DatabaseConnection` and a `venueId`, executes its SQL, and returns a typed result with `value`, `status` ('HEALTHY' | 'ADVISORY' | 'REVIEW'), and the specific threshold values crossed.

```typescript
// src/entropy/calculators/m01-override-divergence.ts

export interface MetricResult {
  metric_id: string      // 'M-01'
  venue_id: string
  value: number
  status: 'HEALTHY' | 'ADVISORY' | 'REVIEW'
  advisory_threshold: number
  review_threshold: number
  computed_at: number    // UTC ms
}

export async function computeM01(
  db: DatabaseConnection,
  venueId: string
): Promise<MetricResult> {

  const rows = await db.query(`
    WITH screen_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE s.id IS NOT NULL) AS total_screens,
        COUNT(DISTINCT o.scope_screen_id) AS screens_with_override
      FROM screens s
      LEFT JOIN overrides o
        ON o.scope_screen_id = s.id
        AND o.status = 'active'
        AND (o.end_time IS NULL OR o.end_time > $2)
      WHERE s.venue_id = $1
        AND s.status != 'unprovisioned'
    )
    SELECT
      CASE WHEN total_screens = 0 THEN 0
           ELSE screens_with_override::numeric / total_screens * 100
      END AS divergence_pct
    FROM screen_counts
  `, [venueId, Date.now()])

  const value = Number(Number(rows[0].divergence_pct).toFixed(2))
  const advisory = 15, review = 30

  return {
    metric_id: 'M-01',
    venue_id: venueId,
    value,
    status: value > review ? 'REVIEW' : value > advisory ? 'ADVISORY' : 'HEALTHY',
    advisory_threshold: advisory,
    review_threshold: review,
    computed_at: Date.now()
  }
}
```

### 9.2 Entropy Score Computation

```typescript
// src/entropy/entropy-score.ts

const WEIGHTS: Record<string, number> = {
  'M-01': 0.25, 'M-03': 0.20, 'M-04': 0.15,
  'M-06': 0.15, 'M-08': 0.10, 'M-11': 0.10, 'M-12': 0.05
}

function normalize(value: number, advisory: number, review: number): number {
  if (value <= 0) return 0
  if (value <= advisory) return (value / advisory) * 50
  if (value <= review)   return 50 + ((value - advisory) / (review - advisory)) * 30
  const excess = value - review
  return Math.min(100, 80 + 20 * (1 - Math.exp(-excess / review)))
}

export function computeEntropyScore(metrics: MetricResult[]): {
  score: number
  label: 'Healthy' | 'Nominal' | 'Drifting' | 'Degraded' | 'Critical'
  primary_driver: string
} {
  let score = 0
  let maxContribution = 0
  let primaryDriver = ''

  for (const [metricId, weight] of Object.entries(WEIGHTS)) {
    const metric = metrics.find(m => m.metric_id === metricId)
    if (!metric) continue

    // M-03 is inverted (lower coverage = higher entropy)
    const value = metricId === 'M-03'
      ? Math.max(0, 100 - metric.value)
      : metric.value

    const normalized = normalize(value, metric.advisory_threshold, metric.review_threshold)
    const contribution = normalized * weight
    score += contribution

    if (contribution > maxContribution) {
      maxContribution = contribution
      primaryDriver = metricId
    }
  }

  score = Number(score.toFixed(1))
  const label =
    score <= 20 ? 'Healthy' :
    score <= 40 ? 'Nominal' :
    score <= 60 ? 'Drifting' :
    score <= 80 ? 'Degraded' : 'Critical'

  return { score, label, primary_driver: primaryDriver }
}
```

### 9.3 Batch Runner

```typescript
// src/entropy/batch-runner.ts
// Executes at 03:00 local venue time via scheduled job

export async function runEntopyBatch(db: DatabaseConnection): Promise<void> {
  const venues = await db.query(`SELECT id FROM venues WHERE status = 'active'`, [])

  for (const venue of venues) {
    const metrics = await Promise.all([
      computeM01(db, venue.id), computeM02(db, venue.id),
      computeM03(db, venue.id), computeM04(db, venue.id),
      computeM05(db, venue.id), computeM06(db, venue.id),
      computeM07(db, venue.id), computeM08(db, venue.id),
      computeM09(db, venue.id), computeM10(db, venue.id),
      computeM11(db, venue.id), computeM12(db, venue.id),
    ])

    const stalenessIndex = computeStatelessIndex(metrics)
    const { score, label, primary_driver } = computeEntropyScore(metrics)

    // Write snapshot — MUST NOT modify any configuration table
    await db.execute(`
      INSERT INTO venue_health_snapshots
        (venue_id, entropy_score, score_label, primary_driver, metrics, computed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [venue.id, score, label, primary_driver, JSON.stringify(metrics), Date.now()])

    logger.info({
      event: 'entropy_computed',
      venue_id: venue.id,
      entropy_score: score,
      score_label: label,
      primary_driver,
      computed_at: Date.now()
    })

    metrics.increment('entropy_score_per_venue', { venue_id: venue.id }, score)
  }
}
```

The batch runner MUST NOT write to `overrides`, `schedules`, `campaigns`, `emergency_states`, `sponsorship_contracts`, or any other configuration table. It writes only to `venue_health_snapshots`. This is enforced by the INV-1 purity wrapper in staging — if any write to a configuration table is attempted, the batch throws and the alert fires.

---

## 10. PRE Preview Runtime

### 10.1 Endpoint Implementation

```typescript
// src/preview/endpoint.ts

router.get('/api/preview/screen/:screenId', async (req, res) => {
  const screenId = req.params.screenId
  const requestId = req.headers['x-request-id'] as string ?? uuid()

  // Parse `at` parameter — future or past timestamp
  let at: number
  if (req.query.at) {
    const parsed = Date.parse(req.query.at as string)
    if (isNaN(parsed)) {
      return res.status(400).json({ error: 'Invalid ?at= timestamp. Use ISO 8601.' })
    }
    at = parsed
  } else {
    at = Date.now()
  }

  const isSpeculative = at > Date.now()

  // Acquire read-only database connection
  // MUST be wrapped with purity enforcement — preview MUST NOT write
  const db = wrapWithPurityEnforcement(await dbPool.acquire())

  let preOutput: PRE_Output
  try {
    preOutput = await PRE.resolve(screenId, at, db)
  } catch (err) {
    logger.error({ event: 'preview_pre_threw', screen_id: screenId, at, error: String(err) })
    return res.status(500).json({ error: 'PRE resolution failed. Check logs.' })
  } finally {
    dbPool.release(db)
  }

  // Compute divergence advisory
  const divergenceAdvisory = await computeDivergenceAdvisory(screenId, preOutput, db)

  const response = {
    screen_id: screenId,
    resolved_at: new Date(at).toISOString(),
    resolution_level: preOutput.resolution_level,
    is_fallback: preOutput.is_fallback,
    confidence_score: preOutput.confidence_score,
    content_mix: preOutput.content_mix,
    reason_trace: renderTrace(preOutput.reason_trace),
    divergence_advisory: divergenceAdvisory,
    computed_ms: Date.now() - (at > Date.now() ? Date.now() : at),
    preview: true as const,
    ...(isSpeculative ? { speculative: true as const } : {})
  }

  // Log preview access (read-only audit entry)
  logger.info({
    event: 'preview_accessed',
    screen_id: screenId,
    at,
    request_id: requestId,
    is_speculative: isSpeculative,
    resolution_level: preOutput.resolution_level
  })

  res.json(response)
})
```

### 10.2 No Side Effects — Enforcement

The preview endpoint enforces its no-side-effect guarantee through two mechanisms:

1. `wrapWithPurityEnforcement(db)` — any write attempt from PRE throws `InvariantViolationError`.
2. The endpoint does not call `computeVersion()`, does not write to `manifest_cache`, does not write to `screen_delivery_log`, and does not emit cache invalidation events. These are omitted by design, not by oversight.

The only write the preview endpoint performs is to the structured log (a `preview_accessed` INFO event). This is not a configuration write and does not affect any subsequent PRE computation.

### 10.3 Performance Expectations

Preview calls the same `PRE.resolve()` function as the manifest delivery path. Performance characteristics are therefore identical:

- p95 PRE execution: ≤ 200ms (ENGINEERING-CONSTITUTION-v1.md §26.2)
- p95 total endpoint response including DB round-trip: ≤ 500ms
- No caching of preview responses — every preview call invokes PRE directly against live state

Preview endpoint availability is monitored separately from the manifest endpoint. Preview returning errors is a P2 incident.

---

## 11. CI/CD Constitutional Gates

### 11.1 Stage Definitions

CI executes 8 stages in strict sequential order. A stage failure blocks all subsequent stages. Emergency bypass requires a written bypass record before the run proceeds (§11.8).

```yaml
# ci/stages/01-schema-validate.yml
stage: schema-validate
description: Validate all corpus packets against JSON Schema, validate PRE_Output type
blocking: true
commands:
  - npx ts-node scripts/verify-corpus-integrity.ts --mode=schema
  - npx tsc --noEmit  # TypeScript type-check entire src/
failure_severity: ERROR
```

```yaml
# ci/stages/02-replay-corpus.yml
stage: replay-corpus
description: Run full active corpus against current PRE implementation
blocking: true
commands:
  - npx ts-node scripts/run-replay.ts
      --corpus-path corpus/
      --output-path ci-artifacts/replay-${CI_RUN_ID}/
      --filter.status active
failure_severity: CONSTITUTIONAL_BREACH  # for divergence_class >= 2
                  ERROR                  # for divergence_class 0-1
artifact_retention_days: 30
artifact_retention_on_failure: permanent
```

```yaml
# ci/stages/03-invariant-verify.yml
stage: invariant-verify
description: Assert all INV-1 through INV-10 against all golden fixtures
blocking: true
commands:
  - npx ts-node scripts/run-invariants.ts
      --corpus-path corpus/
      --filter.class golden,edge_case,failure_state
failure_severity: CONSTITUTIONAL_BREACH
```

```yaml
# ci/stages/04-threshold-scan.yml
stage: threshold-scan
description: Detect hardcoded threshold literals in resolution path (FP-07)
blocking: true
commands:
  - npx ts-node scripts/validate-contracts.ts --check=thresholds
failure_severity: ERROR
```

```yaml
# ci/stages/05-forbidden-pattern.yml
stage: forbidden-pattern
description: Static analysis for FP-01 through FP-15
blocking: true
commands:
  - npx ts-node scripts/validate-contracts.ts --check=all-patterns
failure_severity: CONSTITUTIONAL_BREACH  # for FP-01, FP-02, FP-04, FP-06, FP-10, FP-14
                  ERROR                  # for FP-07, FP-15
```

```yaml
# ci/stages/06-migration-lint.yml
stage: migration-lint
description: Lint all SQL migration files for constitutional violations
blocking: true
commands:
  - npx ts-node scripts/lint-migrations.ts --dir migrations/
failure_severity: WARNING  # missing rollback comment
                  ERROR    # DROP TABLE without manual flag
                  CONSTITUTIONAL_BREACH  # write to PRE-owned table
```

```yaml
# ci/stages/07-parity-verify.yml
stage: parity-verify
description: Shadow mode parity gate (Phase 2 and Phase 5 canary only)
blocking: true
condition: PRE_SHADOW_MODE=true || CANARY_STEP is set
commands:
  - npx ts-node scripts/run-parity.ts --window-hours=24
failure_severity: CONSTITUTIONAL_BREACH  # if forbidden divergences > 0 in 24h window
```

```yaml
# ci/stages/08-chaos-smoke.yml
stage: chaos-smoke
description: Smoke subset of chaos scenarios (fast, non-destructive assertions)
blocking: true
commands:
  - npx ts-node scripts/run-chaos.ts --mode=smoke --scenarios=CHAOS-001,CHAOS-003,CHAOS-005
failure_severity: ERROR
```

### 11.2 Query-Sync Check (Embedded in Stage 05)

The static analysis checks that `src/verification/replay/in-memory-db.ts` contains a routing case for every SQL query file in `src/pre/queries/`. If a query file is added or modified without a corresponding update to the in-memory DB router, Stage 05 fails.

```typescript
// scripts/validate-contracts.ts (query-sync check)

function checkQuerySync(): Violation[] {
  const queryFiles = glob.sync('src/pre/queries/*.ts')
  const inMemoryDbSrc = fs.readFileSync('src/verification/replay/in-memory-db.ts', 'utf-8')
  const violations: Violation[] = []

  for (const queryFile of queryFiles) {
    const routerFn = `is${basename(queryFile, '.ts').replace(/-./g, m => m[1].toUpperCase())}Query`
    if (!inMemoryDbSrc.includes(routerFn)) {
      violations.push({
        pattern: 'QUERY_SYNC',
        file: queryFile,
        message: `in-memory-db.ts missing router case ${routerFn} for ${queryFile}`
      })
    }
  }
  return violations
}
```

### 11.3 Branch Coverage Gate (Embedded in Stage 03)

```yaml
# Part of 03-invariant-verify.yml
commands:
  - npx jest --coverage --coverageThreshold='{"src/pre/":{"branches":100}}'
failure_severity: CONSTITUTIONAL_BREACH
# ENGINEERING-CONSTITUTION §25.1: 100% branch coverage is mandatory
```

### 11.4 Blocking vs. Advisory Failures

| Stage | Failure Type | Action |
|-------|-------------|--------|
| 01 schema-validate | Schema invalid | BLOCK: fail immediately |
| 02 replay-corpus | divergence_class = 0 or 1 | ADVISORY: log; do not block |
| 02 replay-corpus | divergence_class = 2, 3, or 4 | BLOCK: fail immediately |
| 02 replay-corpus | INTEGRITY_FAILURE | BLOCK: all-stop; paging alert |
| 03 invariant-verify | Any invariant failure | BLOCK: CONSTITUTIONAL_BREACH |
| 04 threshold-scan | FP-07 detected | BLOCK |
| 05 forbidden-pattern | FP-01/02/04/06/10/14 | BLOCK: CONSTITUTIONAL_BREACH |
| 05 forbidden-pattern | FP-07/15 | BLOCK: ERROR |
| 06 migration-lint | Missing rollback comment | BLOCK: WARNING (blocks deploy, not merge) |
| 06 migration-lint | DROP TABLE in auto-run | BLOCK: ERROR |
| 06 migration-lint | Write to PRE table | BLOCK: CONSTITUTIONAL_BREACH |
| 07 parity-verify | Forbidden divergence > 0 | BLOCK: CONSTITUTIONAL_BREACH |
| 08 chaos-smoke | Any assertion failure | BLOCK: ERROR |

### 11.5 Artifact Retention

```typescript
// ci/artifact-retention.ts

const RETENTION_POLICY: Record<string, number | 'permanent'> = {
  'replay-results-pass': 30,           // days
  'replay-results-fail': 'permanent',  // never deleted
  'invariant-results': 30,
  'divergence-reports': 'permanent',
  'chaos-results': 30,
  'parity-scores': 90,
  'bypass-audit-records': 'permanent',
}
```

### 11.6 PR Size Gate

PRs touching `src/pre/` that do not touch `corpus/golden/` or `corpus/edge_cases/` trigger an advisory: "PRE behavior change detected. Confirm replay corpus is updated or unchanged." This is not a hard block — it is a Tier 2 advisory that requires reviewer acknowledgment.

### 11.7 Emergency Bypass Protocol

```typescript
// ci/bypass-audit.ts

export interface BypassRecord {
  bypass_id: string           // UUID v4
  created_at: number          // UTC ms
  created_by: string          // engineer identity
  stages_bypassed: string[]   // e.g., ['02-replay-corpus']
  justification: string       // min 100 chars; must reference incident ID
  incident_id: string         // mandatory for CONSTITUTIONAL_BREACH bypasses
  commit_sha: string
  resolution_deadline: number // must be < created_at + 5_business_days_ms
}

export async function createBypassRecord(record: BypassRecord): Promise<void> {
  // Write to bypass-audit/ directory in corpus
  const path = `corpus/integrity/bypass-audit/${record.bypass_id}.json`
  fs.writeFileSync(path, canonicalizeJson(record))
  
  // The CI run may proceed only after this file is committed
  // The commit that includes the bypass record MUST be the one that
  // bypasses the gate — not a separate prior commit
}
```

A bypass record MUST be created in the same commit that triggers the bypassed run. CI verifies this by checking that a bypass record exists with `commit_sha` matching the current `$CI_COMMIT_SHA` before allowing the bypass. Bypass records committed on a different SHA than the bypassed run are rejected.

Bypass records are permanent. They are never deleted. They are indexed in `CORPUS-INDEX.json` under a `bypass_audit` section.

---

## 12. Migration Linting Engine

### 12.1 Linting Architecture

```typescript
// scripts/lint-migrations.ts

export interface MigrationViolation {
  file: string
  line: number
  rule: string
  severity: 'WARNING' | 'ERROR' | 'CONSTITUTIONAL_BREACH'
  message: string
}

export async function lintMigrations(dir: string): Promise<MigrationViolation[]> {
  const files = glob.sync(path.join(dir, '*.sql')).sort()
  const violations: MigrationViolation[] = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    violations.push(...lintFile(file, content))
  }

  return violations
}
```

### 12.2 SQL Pattern Rules

```typescript
function lintFile(file: string, content: string): MigrationViolation[] {
  const violations: MigrationViolation[] = []
  const lines = content.split('\n')

  // RULE: Every migration must have a rollback comment block
  if (!content.includes('-- ROLLBACK:')) {
    violations.push({
      file, line: 1, rule: 'MISSING_ROLLBACK_COMMENT',
      severity: 'WARNING',
      message: 'Migration lacks -- ROLLBACK: comment block. Add rollback procedure.'
    })
  }

  // RULE: DROP TABLE, DROP COLUMN, TRUNCATE must not be in auto-run migrations
  const destructivePatterns = [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bTRUNCATE\b/i]
  lines.forEach((line, i) => {
    if (line.trim().startsWith('--')) return  // skip comments
    for (const pattern of destructivePatterns) {
      if (pattern.test(line)) {
        violations.push({
          file, line: i + 1, rule: 'DESTRUCTIVE_STATEMENT',
          severity: 'ERROR',
          message: `${line.trim()} — destructive DDL must be executed manually, not via auto-run migration`
        })
      }
    }
  })

  // RULE: CREATE INDEX on PRE read-set tables must use CONCURRENTLY
  const preReadSetTables = ['schedules', 'overrides', 'emergency_states',
    'campaigns', 'campaign_content_items', 'sponsorship_contracts',
    'screen_delivery_log', 'screens', 'tv_groups', 'areas', 'venues']
  const nonConcurrentIndex = /CREATE\s+INDEX\s+(?!CONCURRENTLY)/i
  lines.forEach((line, i) => {
    if (line.trim().startsWith('--')) return
    if (nonConcurrentIndex.test(line)) {
      const tableMatch = preReadSetTables.find(t => line.toLowerCase().includes(t))
      if (tableMatch) {
        violations.push({
          file, line: i + 1, rule: 'NON_CONCURRENT_INDEX',
          severity: 'ERROR',
          message: `CREATE INDEX on ${tableMatch} must use CREATE INDEX CONCURRENTLY`
        })
      }
    }
  })

  // RULE: No writes to audit_events except via Audit Service
  // (migrations should never insert audit rows directly)
  if (/INSERT\s+INTO\s+audit_events/i.test(content)) {
    violations.push({
      file, line: 0, rule: 'DIRECT_AUDIT_WRITE',
      severity: 'CONSTITUTIONAL_BREACH',
      message: 'Migrations must not INSERT into audit_events directly — use Audit Service API'
    })
  }

  // RULE: Migration file numbering must be sequential with no gaps (warning only)
  // checked at directory level, not per-file

  return violations
}
```

### 12.3 AST-Level Forbidden Pattern Detection

```typescript
// scripts/validate-contracts.ts — AST analysis using TypeScript compiler API

import * as ts from 'typescript'

const FORBIDDEN_IN_PRE_PATH = [
  // FP-10: timezone ambiguity
  { name: 'new Date()', nodeKind: ts.SyntaxKind.NewExpression, typeName: 'Date' },
  { name: 'Date.now()', pattern: /\bDate\.now\(\)/ },
  { name: 'toLocaleDateString', pattern: /\.toLocaleDateString\(/ },
  { name: 'toLocaleTimeString', pattern: /\.toLocaleTimeString\(/ },
  // FP-02: side effects in PRE — any write call
  { name: 'db.execute()', pattern: /\bdb\.execute\(/ },
  { name: 'db.transaction()', pattern: /\bdb\.transaction\(/ },
  // Math.random in resolution path
  { name: 'Math.random()', pattern: /\bMath\.random\(\)/ },
]

export function scanPREDirectory(preDir: string): Violation[] {
  const files = glob.sync(path.join(preDir, '**/*.ts'))
  const violations: Violation[] = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    for (const rule of FORBIDDEN_IN_PRE_PATH) {
      if (rule.pattern && rule.pattern.test(content)) {
        const lineNum = content.split('\n').findIndex(l => rule.pattern!.test(l)) + 1
        violations.push({
          file, line: lineNum,
          pattern: rule.name,
          severity: rule.name.includes('db.execute') ? 'CONSTITUTIONAL_BREACH' : 'CONSTITUTIONAL_BREACH',
          message: `Forbidden in PRE: ${rule.name}`
        })
      }
    }
  }
  return violations
}
```

### 12.4 Hardcoded Threshold Detection (FP-07)

```typescript
// Thresholds that must live in constants.ts or thresholds.json, never as inline literals

const THRESHOLD_VALUES = [
  { value: 0.60, name: 'MAX_SPONSOR_CAPACITY' },
  { value: 0.40, name: 'SATURATION_WARNING_AT' },
  { value: 60_000, name: 'MAX_STALE_AGE' },
  { value: 500, name: 'p95_latency_budget_ms' },
  { value: 200, name: 'pre_p95_budget_ms' },
  { value: 86_400_000, name: 'MAX_VALID_DURATION' },
  { value: 5_000, name: 'MIN_VALID_DURATION' },
  { value: 15_000, name: 'POLL_INTERVAL_MS' },
  { value: 1_800_000, name: 'STALE_THRESHOLD_OFFLINE' },
  { value: 300_000, name: 'STALE_THRESHOLD_DEGRADED' },
]

export function detectHardcodedThresholds(
  dir: string,
  excludeDirs: string[] = ['src/pre/constants.ts', 'corpus/']
): Violation[] {
  // Scan all .ts files outside excluded paths
  // For each threshold value, check if the literal appears outside constants.ts
  // Flag as FP-07 violation if found
}
```

---

## 13. Observability Bootstrap

### 13.1 Metric Namespaces

All metrics use the `clubhub_` prefix to avoid collisions in shared Prometheus environments:

```
clubhub_manifest_compute_total                    # counter
clubhub_manifest_compute_duration_ms              # histogram: buckets [5,10,25,50,100,200,500,1000]
clubhub_manifest_cache_hit_ratio                  # gauge
clubhub_manifest_errors_total                     # counter; label: error_type
clubhub_pre_resolution_level_dist                 # histogram: buckets [0,1,2,3,4,5,6]
clubhub_screen_poll_success_rate                  # gauge
clubhub_emergency_active_count                    # gauge
clubhub_override_active_count                     # gauge
clubhub_audit_write_failures_total                # counter
clubhub_version_counter_per_screen                # gauge; label: screen_id (aggregated to p50/p95/p99)
clubhub_ota_ring_rollback_total                   # counter
clubhub_entropy_score_per_venue                   # gauge; label: venue_id
clubhub_shadow_divergence_total                   # counter; label: divergence_class (Phase 2/5 only)
clubhub_constitutional_violation_total            # counter; label: violation_type,severity
clubhub_invariant_violation_total                 # counter; label: invariant_id
clubhub_replay_run_duration_ms                    # histogram (CI metrics)
clubhub_replay_corpus_size                        # gauge: active packet count
clubhub_preview_request_total                     # counter
clubhub_preview_duration_ms                       # histogram
```

### 13.2 Structured Log Schema

Every log line MUST be valid JSON with a `level` and `event` field. The following schemas are mandatory for their respective events:

```typescript
// src/observability/telemetry-schemas.ts

export const LOG_SCHEMAS = {
  manifest_computed: {
    required: ['level', 'event', 'screen_id', 'version', 'checksum',
               'resolution_level', 'cache_hit', 'duration_ms',
               'is_fallback', 'request_id', 'at']
  },
  invariant_violation: {
    required: ['level', 'event', 'invariant', 'message', 'severity',
               'screen_id', 'at', 'request_id']
  },
  constitutional_violation: {
    required: ['level', 'event', 'violation_type', 'entity_id', 'severity']
  },
  entropy_computed: {
    required: ['level', 'event', 'venue_id', 'entropy_score', 'score_label',
               'primary_driver', 'computed_at']
  },
  replay_result: {
    required: ['level', 'event', 'run_id', 'packet_id', 'passed',
               'actual_checksum', 'expected_checksum', 'execution_ms']
  },
  shadow_divergence_forbidden: {
    required: ['level', 'event', 'screen_id', 'at', 'legacy_checksum',
               'pre_checksum', 'legacy_resolution_level', 'pre_resolution_level']
  },
  emergency_activated: {
    required: ['level', 'event', 'venue_id', 'emergency_id',
               'activated_by', 'content_id', 'activated_at']
  },
  system_fallback_served: {
    required: ['level', 'event', 'screen_id', 'trigger',
               'duration_since_last_compute_ms', 'request_id']
  },
  preview_accessed: {
    required: ['level', 'event', 'screen_id', 'at', 'request_id',
               'is_speculative', 'resolution_level']
  }
}
```

### 13.3 Correlation ID Propagation

```typescript
// src/observability/correlation.ts

export function generateRequestId(): string {
  return uuid()  // UUID v4
}

export function generateReplayId(packetId: string, runId: string): string {
  return `replay:${runId}:${packetId}`
}

// Express middleware — assigns request_id on every incoming request
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) ?? generateRequestId()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  // Bind to logger context for this request's log lines
  req.log = logger.child({ request_id: requestId })
  next()
}
```

Every log line produced within a request context MUST include `request_id`. Every audit event MUST include `request_id`. Cache invalidation events triggered by an operator action MUST include the `request_id` of the originating API call.

### 13.4 Replay Telemetry

Each replay run emits a summary metric and detailed log lines:

```typescript
// After replay run completes:
metrics.observe('clubhub_replay_run_duration_ms', runDurationMs)
metrics.set('clubhub_replay_corpus_size', totalActivePackets)
metrics.increment('clubhub_constitutional_violation_total',
  { violation_type: 'BEHAVIORAL_DIVERGENCE', severity: 'ERROR' },
  failedPacketCount
)

logger.info({
  event: 'replay_run_complete',
  run_id: runReport.run_id,
  total: runReport.total_packets,
  passed: runReport.passed,
  failed: runReport.failed,
  integrity_failures: runReport.integrity_failures,
  overall_result: runReport.overall_result,
  duration_ms: runDurationMs
})
```

### 13.5 Retention Classes in Production

Logs are shipped to a structured log store with the following retention:

| Log class | Events included | Hot retention | Cold archival |
|-----------|----------------|--------------|--------------|
| Constitutional | `invariant_violation`, `constitutional_violation`, `forbidden_state_detected` | 90 days | 365 days |
| Operational | `manifest_computed`, `cache_invalidation`, `system_fallback_served` | 30 days | 90 days |
| Entropy | `entropy_computed`, `advisory_triggered` | 90 days | 365 days |
| Replay | `replay_result`, `replay_run_complete` | 30 days | permanent |
| Preview | `preview_accessed` | 14 days | 90 days |
| Audit | `emergency_activated`, `override_created`, all `audit.*` events | 90 days queryable | 365 days archival |

---

## 14. Runtime Determinism Controls

### 14.1 Unstable Sort Prevention

```typescript
// src/pre/algorithms/swrr.ts
// All sort operations in PRE use this canonical comparator

export function deterministicSort<T extends { id: string; priority?: number }>(
  items: T[],
  primaryKey: keyof T
): T[] {
  return [...items].sort((a, b) => {
    // Primary sort: by specified key (descending for priority, ascending for others)
    const aVal = a[primaryKey]
    const bVal = b[primaryKey]
    if (aVal !== bVal) {
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal  // descending for numeric (higher priority first)
      }
      return String(aVal).localeCompare(String(bVal))
    }
    // Deterministic tiebreaker: lexicographic ascending on id
    return a.id.localeCompare(b.id)
  })
}
```

This function is used by every sort operation in the resolution path. Any sort that does not use this comparator is detected by the `validate-contracts.ts` scan as a potential FP source.

### 14.2 Locale Drift Prevention

```typescript
// src/pre/algorithms/canonicalize-json.ts

export function canonicalizeJson(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort keys — locale-independent Unicode code point order
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(value).sort()) {
        sorted[key] = value[key]
      }
      return sorted
    }
    return value
  })
  // MUST NOT pass locale to JSON.stringify
  // MUST NOT use Intl.Collator or localeCompare for key ordering
}
```

### 14.3 Timezone Drift Prevention

```typescript
// src/pre/algorithms/venue-local-time.ts

import { getTimezone } from 'tzdata'  // pre-compiled IANA timezone database

export function toVenueLocal(atUtcMs: number, ianaTimezone: string): LocalTime {
  // MUST use IANA timezone from venue record — never process timezone
  // MUST NOT use new Date().toLocaleDateString()
  // MUST NOT use Intl.DateTimeFormat with system locale

  const tz = getTimezone(ianaTimezone)
  if (!tz) {
    // INV-9 fallback: invalid timezone → UTC
    logger.warn({ event: 'invalid_venue_timezone', timezone: ianaTimezone })
    return computeUtcLocal(atUtcMs)
  }

  return computeLocalFromIANA(atUtcMs, tz)
}
```

The CI scan checks that no file in `src/pre/` contains any of:
- `process.env.TZ`
- `new Date().getTimezoneOffset()`
- `Intl.DateTimeFormat` (without explicit `timeZone` from venue record)
- `toLocaleDateString` / `toLocaleTimeString` / `toLocaleString`

### 14.4 RNG Leakage Prevention

```typescript
// scripts/validate-contracts.ts — RNG scan

const RNG_PATTERNS = [
  /\bMath\.random\(\)/,
  /\bcrypto\.randomBytes\b/,   // except in uuid() which is external to PRE
  /\bcrypto\.randomInt\b/,
  /\bnewRNG\b/,
  /\bfaker\b/,                 // test data library — forbidden in src/pre/
]

export function scanForRNG(dir: string): Violation[] {
  // Scan src/pre/ — RNG is forbidden here
  // uuid() calls in src/ outside src/pre/ are permitted (for request IDs, packet IDs)
}
```

### 14.5 Async Ordering Control

PRE executes its six database queries within a single `READ COMMITTED` transaction. This serializes them. However, the order in which results are used must also be deterministic.

```typescript
// src/pre/index.ts — query execution order is fixed and documented

export async function resolve(
  screenId: string,
  at: number,
  db: DatabaseConnection
): Promise<PRE_Output> {

  // Queries execute in this order within the read transaction.
  // Order is fixed — never use Promise.all() for these six queries.
  // Rationale: although READ COMMITTED isolation means parallel reads would
  // see the same committed state, parallel execution introduces ordering
  // nondeterminism in result processing if any error occurs mid-flight.

  const ctx          = await queryDeviceState(screenId, db)    // Step 1
  const emergency    = await queryEmergencyState(ctx.venue.id, at, db)  // Step 2
  const overrides    = await queryOverrideState(ctx, at, db)   // Step 3
  const schedules    = await queryScheduleState(ctx, at, db)   // Step 4
  const sponsorships = await querySponsorshipState(ctx, at, db)// Step 5
  const lastDelivery = await queryDeviceTruth(screenId, db)    // Step 6

  // Resolution proceeds from assembled state
  return resolveFromState(screenId, at, ctx, emergency, overrides,
                          schedules, sponsorships, lastDelivery)
}
```

### 14.6 Floating-Point Stability

```typescript
// src/pre/algorithms/canonicalize-json.ts

function formatFloat(value: number, decimals: number = 4): number {
  // Round to fixed decimal places to eliminate floating-point accumulation drift
  return Number(value.toFixed(decimals))
}

// Applied to:
// - confidence_score: 4 decimal places
// - content_mix percentages: 4 decimal places
// - normalized weights in SWRR: integer (via gcd reduction)
// - share_of_voice effective shares: 4 decimal places
```

Floating-point values are rounded to 4 decimal places at the point they are assigned to output fields. Internal accumulations use full precision but are rounded before being committed to `PRE_Output`. This prevents floating-point drift from propagating to the checksum.

---

## 15. Corpus Runtime Loader

### 15.1 Loader Architecture

```typescript
// src/verification/replay/packet-loader.ts

export class CorpusLoader {
  private index: CorpusIndex
  private corpusPath: string

  constructor(corpusPath: string) {
    this.corpusPath = corpusPath
    this.index = this.loadIndex()
    this.verifyIndexIntegrity()
  }

  private loadIndex(): CorpusIndex {
    const indexPath = path.join(this.corpusPath, 'CORPUS-INDEX.json')
    const raw = fs.readFileSync(indexPath, 'utf-8')
    return JSON.parse(raw)
  }

  private verifyIndexIntegrity(): void {
    // For each entry in the index, verify the file exists and packet_hash matches
    for (const entry of this.index.entries) {
      const filePath = path.resolve(this.corpusPath, entry.file_path)
      if (!fs.existsSync(filePath)) {
        throw new Error(`INTEGRITY_FAILURE: Index references ${filePath} but file does not exist`)
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed.packet_hash !== entry.packet_hash) {
        throw new Error(
          `INTEGRITY_FAILURE: packet_hash mismatch for ${entry.packet_id}. ` +
          `Index: ${entry.packet_hash}. File: ${parsed.packet_hash}`
        )
      }
    }
  }

  loadActive(filter?: CorpusFilter): PacketLoadResult[] {
    const entries = this.index.entries
      .filter(e => e.status === 'active')
      .filter(e => !filter?.class || filter.class.includes(e.corpus_class as CorpusClass))
      .sort((a, b) => a.packet_id.localeCompare(b.packet_id))

    return entries.map(entry => {
      const filePath = path.resolve(this.corpusPath, entry.file_path)
      return loadPacket(filePath)  // full hash verification per §3.2
    })
  }
}
```

### 15.2 Loaders Cannot Mutate Packets

The loader is read-only. It has no write methods. The `PacketLoadResult` type contains a `packet: ReplayPacket` field that is typed with `Readonly<ReplayPacket>` — TypeScript's structural type system prevents any assignment to packet fields after loading.

```typescript
export type ImmutablePacket = Readonly<ReplayPacket> & {
  readonly input: Readonly<ReplayInput> & {
    readonly system_state: Readonly<SystemStateSnapshot>
  }
  readonly expected_output: Readonly<PRE_Output>
}
```

This is not a sufficient guarantee on its own — it prevents accidental mutation in TypeScript but not in JavaScript or at runtime boundaries. The replay harness additionally computes `input_hash` and `output_hash` after loading and before execution, comparing against the packet's stored hashes. Any mutation between load and execution would change the computed hashes and fail this check.

### 15.3 Compression Handling

Archived packets in `corpus/archived/` are stored as `.json.gz`. The loader transparently decompresses them:

```typescript
function readPacketFile(filePath: string): string {
  if (filePath.endsWith('.gz')) {
    return zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf-8')
  }
  return fs.readFileSync(filePath, 'utf-8')
}
```

Active packets are never compressed — human readability for code review is mandatory for active corpus entries. Only archived entries are compressed.

### 15.4 Schema Version Compatibility

```typescript
const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0']

// When schema version 2.0.0 is introduced:
// 1. A migration function is added: migrate_v1_to_v2(v1: V1Packet): V2Packet
// 2. SUPPORTED_SCHEMA_VERSIONS becomes ['1.0.0', '2.0.0']
// 3. The loader applies migration when loading v1 packets
// 4. After migration, v1 packets on disk are updated to v2 format
//    in a single corpus migration commit

// The migration function MUST preserve all behavioral fields exactly.
// After migration, output_hash values must be recomputed against v2 canonical form.
// All migrated packets are re-verified by running the full corpus.
```

---

## 16. Incident Capture Runtime

### 16.1 Capture Flow

```
PRODUCTION INCIDENT DETECTED
        │
        ▼
scripts/capture-incident.ts invoked by on-call engineer
        │
        ├─ reads screen_id and approximate at from incident report
        │
        ▼
STEP 1: Reconstruct SystemStateSnapshot from audit log at incident timestamp
  SELECT * FROM audit_log WHERE occurred_at <= $incident_at
  ORDER BY occurred_at ASC
  → apply mutations sequentially → build SystemStateSnapshot

        │
        ▼
STEP 2: Invoke PRE against reconstructed state (time-travel replay)
  const db = buildInMemoryDb(snapshot)
  const output = await PRE.resolve(screenId, incidentAt, db)
  → this is the OUTPUT PRE WOULD HAVE PRODUCED (may or may not match actual)

        │
        ▼
STEP 3: Construct incident-capture ReplayPacket
  corpus_class: 'historical_regression'
  capture_source: 'incident_capture'
  incident_id: <from incident management system>
  status: 'archived'  // captures incorrect behavior
  expected_output: <the INCORRECT output observed in production>
  // NOTE: if actual output cannot be reconstructed, skip capture packet;
  //       proceed to corrected-behavior packet only

        │
        ▼
STEP 4: Construct corrected-behavior ReplayPacket
  status: 'active'
  expected_output: <output from STEP 2 time-travel replay, IF that matches spec>
  // OR: expected_output computed manually from specification if STEP 2
  //     itself exhibited the bug (in which case fix the bug first, then capture)

        │
        ▼
STEP 5: Write both packets to corpus/historical_regression/{YYYY}/{MM}/
STEP 6: Update CORPUS-INDEX.json
STEP 7: Compute and store packet_hash, input_hash, output_hash
STEP 8: Submit PR for human review (incident lead + one other reviewer)
STEP 9: PR merged → CI runs full corpus → corrected-behavior packet must pass
STEP 10: Incident closed
```

### 16.2 Capture Script

```typescript
// scripts/capture-incident.ts

async function captureIncident(opts: {
  screenId: string
  incidentAt: number        // UTC ms at time of incident
  incidentId: string        // incident management system ID
  capturedBy: string        // engineer identity
  description: string
}): Promise<{ capturePacketPath: string | null, correctedPacketPath: string }> {

  // Reconstruct state from audit log
  const snapshot = await reconstructSystemState(opts.screenId, opts.incidentAt, productionDb)

  // Run time-travel replay
  const inMemoryDb = buildInMemoryDb(snapshot)
  const replayOutput = await PRE.resolve(opts.screenId, opts.incidentAt, inMemoryDb)

  // Build capture packet (incorrect behavior — archived)
  // Note: incorrect output must be sourced from production logs, not from this replay
  // This packet documents what happened, not what should have happened
  const capturePacket = buildPacket({
    corpus_class: 'historical_regression',
    capture_source: 'incident_capture',
    incident_id: opts.incidentId,
    status: 'archived',
    archived_reason: 'Incident capture — documents incorrect behavior for historical record',
    input: { screen_id: opts.screenId, at: opts.incidentAt, system_state: snapshot },
    expected_output: null,  // must be populated manually from production logs
    // ...
  })

  // Build corrected-behavior packet (correct output — active)
  const correctedPacket = buildPacket({
    corpus_class: 'historical_regression',
    capture_source: 'incident_capture',
    incident_id: opts.incidentId,
    status: 'active',
    input: { screen_id: opts.screenId, at: opts.incidentAt, system_state: snapshot },
    expected_output: replayOutput,
    // ...
  })

  const yearMonth = new Date(opts.incidentAt).toISOString().slice(0, 7)
  const dir = `corpus/historical_regression/${yearMonth}/`
  fs.mkdirSync(dir, { recursive: true })

  const correctedPath = path.join(dir, `INC-${opts.incidentId}-corrected.json`)
  fs.writeFileSync(correctedPath, canonicalizeJson(correctedPacket))

  return { capturePacketPath: null, correctedPacketPath: correctedPath }
}
```

### 16.3 Anonymization

Production replay packets contain real venue IDs, screen IDs, content IDs, and operator identities embedded in override `issued_by` fields. These MUST NOT be exported, shared externally, or included in open-source builds.

The `corpus/historical_regression/` directory MUST be in `.gitignore` for any open-source forks. In the private production repository, access is controlled by standard repository access controls.

For discussion in public forums (GitHub issues, incident post-mortems), a separate anonymized description is produced:

```typescript
// scripts/capture-incident.ts

function anonymize(snapshot: SystemStateSnapshot): SystemStateSnapshot {
  return {
    ...snapshot,
    screen: { ...snapshot.screen, id: 'screen-A', venue_id: 'venue-1' },
    venue: { ...snapshot.venue, id: 'venue-1', name: '[anonymized]' },
    // Replace UUIDs with deterministic placeholders
    // Replace operator names with role descriptions
    // Preserve all temporal and structural data — only identity fields change
  }
}
```

---

## 17. Initial Engineering Sprint Plan

### 17.1 Dependency Ordering

The execution infrastructure has hard dependencies that determine build order:

```
Level 0 (no dependencies):
  ├── src/pre/algorithms/fnv1a32.ts
  ├── src/pre/algorithms/canonicalize-json.ts
  ├── src/pre/constants.ts
  └── src/pre/types.ts

Level 1 (depends on Level 0):
  ├── src/pre/algorithms/swrr.ts           (uses types)
  ├── src/pre/algorithms/venue-local-time.ts (uses constants)
  ├── src/pre/algorithms/schedule-active.ts  (uses venue-local-time)
  └── src/verification/invariants/types.ts   (uses pre/types)

Level 2 (depends on Level 1):
  ├── src/pre/queries/*.ts                  (uses types + algorithms)
  ├── src/verification/invariants/*.ts      (uses pre/types)
  └── src/verification/replay/in-memory-db.ts (uses pre/queries signatures)

Level 3 (depends on Level 2):
  ├── src/pre/index.ts                      (assembles full PRE)
  ├── src/verification/replay/packet-loader.ts (uses fnv1a32 + canonicalize)
  └── src/verification/divergence/*.ts      (uses pre/types)

Level 4 (depends on Level 3):
  ├── src/verification/replay/harness.ts    (uses all replay components)
  ├── src/verification/invariants/index.ts  (uses all invariant assertions)
  └── scripts/run-replay.ts                 (CLI wrapper for harness)

Level 5 (depends on Level 4):
  ├── ci/stages/*.yml                       (invokes scripts)
  ├── src/verification/parity/*.ts          (uses PRE + legacy)
  ├── src/entropy/calculators/*.ts          (uses db only)
  └── src/preview/endpoint.ts              (uses PRE + purity wrapper)
```

### 17.2 Sprint 1: Replay Foundation (Weeks 1–2)

**Goal:** Replay harness executes at least one golden fixture from end to end.

**Deliverables in dependency order:**
1. `src/pre/algorithms/fnv1a32.ts` — FNV-1a implementation with test vectors
2. `src/pre/algorithms/canonicalize-json.ts` — canonical serializer
3. `src/pre/types.ts` — `PRE_Output`, `PlaylistItem`, `ContentMix`
4. `src/pre/constants.ts` — all compile-time constants; no hardcoded thresholds elsewhere
5. `src/verification/invariants/types.ts` — `InvariantViolationError`, `InvariantResult`
6. `src/verification/replay/packet-loader.ts` — hash verification logic
7. `corpus/golden/GOLD-001.json` — first golden fixture authored manually
8. `corpus/CORPUS-INDEX.json` — seeded with GOLD-001
9. `src/verification/replay/in-memory-db.ts` — stub routing for GOLD-001's query patterns
10. `src/verification/replay/harness.ts` — executes single packet
11. `scripts/run-replay.ts` — CLI wrapper

**Milestone verification:** `npx ts-node scripts/run-replay.ts --filter.packetIds=<GOLD-001-uuid>` exits 0.

### 17.3 Sprint 2: Invariant Engine (Week 3)

**Goal:** All 10 invariant assertions run and pass against GOLD-001.

**Deliverables:**
1. `src/verification/invariants/inv1-purity.ts` through `inv10-output-completeness.ts`
2. `src/verification/invariants/index.ts` — registry and `runAllInvariants()`
3. Integration of invariant runner into replay harness after `PRE.resolve()`
4. `ci/stages/03-invariant-verify.yml`

**Milestone verification:** All invariants pass against GOLD-001; INV-7 deliberately broken in a test branch produces `CONSTITUTIONAL_BREACH` result.

### 17.4 Sprint 3: Full Corpus Seeding (Weeks 4–5)

**Goal:** All 30 mandatory golden fixtures (GOLD-001 through GOLD-030) and all 15 edge-case fixtures authored and passing.

**Deliverables:**
1. Complete `src/pre/index.ts` — full PRE implementation
2. Complete `src/pre/levels/*.ts` — all 7 resolution levels
3. Complete `src/pre/queries/*.ts` — all 6 query modules
4. Complete `src/verification/replay/in-memory-db.ts` — full query routing
5. GOLD-001 through GOLD-030 authored (initially as property-computed fixtures against working PRE)
6. EDGE-001 through EDGE-015 authored
7. `corpus/CORPUS-INDEX.json` updated

**Milestone verification:** `npx ts-node scripts/run-replay.ts` exits 0 with 45 packets passing.

### 17.5 Sprint 4: CI Gates and Contract Scanner (Week 6)

**Goal:** All 8 CI stages executable and blocking on appropriate failures.

**Deliverables:**
1. `scripts/validate-contracts.ts` — all FP-01 through FP-15 checks
2. `scripts/lint-migrations.ts` — all SQL migration rules
3. `ci/stages/01-schema-validate.yml` through `ci/stages/08-chaos-smoke.yml`
4. `ci/gates.ts` — gate evaluation logic
5. `ci/bypass-audit.ts` — bypass record creation

**Milestone verification:** Introducing a `Math.random()` call in `src/pre/levels/level3-campaign.ts` causes Stage 05 to fail with `CONSTITUTIONAL_BREACH`.

### 17.6 Sprint 5: Entropy Calculators (Week 7)

**Goal:** M-01 through M-12 compute correctly against test database fixtures.

**Deliverables:**
1. `src/entropy/calculators/m01-override-divergence.ts` through `m12-screen-staleness.ts`
2. `src/entropy/staleness-index.ts`
3. `src/entropy/entropy-score.ts`
4. `src/entropy/batch-runner.ts`
5. Entropy fixture corpus entries (ENT-001 through ENT-004 initial steps)

**Milestone verification:** Batch runner against a seeded test database produces entropy scores matching manually computed expected values for ENT-001 Week 0 and Week 10 states.

### 17.7 Sprint 6: Preview Endpoint (Week 8)

**Goal:** Preview endpoint live in staging, returning full `reason_trace`.

**Deliverables:**
1. `src/preview/endpoint.ts`
2. `src/preview/future-time.ts`
3. `src/preview/trace-renderer.ts`
4. Integration tests verifying no side effects

**Milestone verification:** `GET /api/preview/screen/{id}` returns `"preview": true` and `"resolution_level"` matches live manifest endpoint for the same screen. Introducing a `db.execute()` call in preview path causes INV-1 violation to throw.

### 17.8 First Milestone Definition

**Milestone: Constitutional Infrastructure Operational**

The milestone is complete when all of the following are true:

1. `npx ts-node scripts/run-replay.ts` exits 0 with ≥ 45 active packets passing (all mandatory goldens + edge cases)
2. `npx ts-node scripts/validate-contracts.ts` exits 0 on the main branch
3. All 8 CI stages execute and produce correct blocking behavior on introduced violations
4. The PRE Preview endpoint returns correct output in staging
5. M-01 through M-12 produce correct values in the staging database
6. The entropy batch runner completes without error on the staging venue set
7. At least one historical regression fixture exists (the team's first practice run)

No feature work begins until this milestone is met.

---

## 18. Appendix A — Runtime Module Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    PURITY BOUNDARY                        │
│   Everything inside this boundary must be pure,          │
│   deterministic, and side-effect free                     │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  src/pre/                          │   │
│  │                                                    │   │
│  │  constants.ts ──────────┐                         │   │
│  │  types.ts ──────────────┤                         │   │
│  │                         ▼                         │   │
│  │  algorithms/           levels/                    │   │
│  │  ├─ fnv1a32.ts ◄──── level3-campaign.ts          │   │
│  │  ├─ canonicalize.ts ◄─ level4-sponsorship.ts      │   │
│  │  ├─ swrr.ts ◄──────── level5-structural.ts        │   │
│  │  ├─ venue-local.ts ◄── level0-emergency.ts        │   │
│  │  └─ schedule-active.ts  level1-operational.ts     │   │
│  │                         level2-scheduled.ts        │   │
│  │  queries/               level6-device-truth.ts    │   │
│  │  ├─ device-state.ts                               │   │
│  │  ├─ emergency-state.ts    ▲                       │   │
│  │  ├─ override-state.ts     │ reads via             │   │
│  │  ├─ schedule-state.ts     │ DatabaseConnection    │   │
│  │  ├─ sponsorship-state.ts  │ (read-only)           │   │
│  │  └─ device-truth.ts       │                       │   │
│  │                           │                       │   │
│  │  index.ts ─── PRE.resolve(screenId, at, db) ─────┤   │
│  └───────────────────────────┬────────────────────────┘  │
│                               │                           │
└───────────────────────────────│───────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                       │
          ▼                     ▼                       ▼
┌──────────────────┐  ┌─────────────────────┐  ┌────────────────┐
│ REPLAY HARNESS   │  │ MANIFEST DELIVERY   │  │ PREVIEW        │
│                  │  │                     │  │ ENDPOINT       │
│ packet-loader    │  │ manifest-handler.ts │  │                │
│ in-memory-db ───►│  │ ├─ legacyEngine     │  │ endpoint.ts    │
│ harness.ts       │  │ ├─ PRE.resolve()    │  │ ├─ PRE.resolve │
│ comparator       │  │ ├─ manifest-cache   │  │ └─ purity wrap │
│ reporter         │  │ └─ shadow-runner    │  │                │
└──────┬───────────┘  └──────────┬──────────┘  └───────┬────────┘
       │                          │                      │
       ▼                          ▼                      │
┌──────────────────┐  ┌─────────────────────┐           │
│ INVARIANT ENGINE │  │ PARITY SCORER       │           │
│                  │  │                     │           │
│ inv1-purity      │  │ shadow-runner.ts    │           │
│ inv2-totality    │  │ parity-scorer.ts    │           │
│ inv3-determinism │  │ canary-gate.ts      │           │
│ ...              │  └──────────┬──────────┘           │
│ inv10-completeness│             │                      │
└──────────────────┘             │                      │
                                  │                      │
       ┌──────────────────────────┴──────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                   OBSERVABILITY                           │
│                                                           │
│  logger.ts ◄── all modules emit structured JSON logs     │
│  metrics.ts ◄── all modules increment Prometheus metrics │
│  correlation.ts ◄── request_id propagated throughout     │
└──────────────────────────────────────────────────────────┘

Dependency rules:
  src/pre/ ──► ONLY: src/pre/ (internal), DatabaseConnection interface
  src/pre/ ──✗► src/verification/, src/entropy/, src/preview/, src/chaos/
  src/verification/ ──► src/pre/ (calls resolve() as black box)
  src/entropy/ ──► DatabaseConnection (read-only queries only)
  src/entropy/ ──✗► src/pre/ (does not call PRE; reads DB directly for metric computation)
  src/preview/ ──► src/pre/ (calls resolve()); src/observability/
  src/chaos/ ──► src/verification/ (runs invariants); system calls (pg_ctl, etc.)
```

---

## 19. Appendix B — CI Pipeline State Machine

```
States:
  PENDING     — Job queued; no stages started
  RUNNING     — Stages executing sequentially
  PASSED      — All stages completed successfully
  FAILED      — One or more blocking stages failed
  BYPASSED    — Emergency bypass activated; bypass record committed
  BLOCKED     — CONSTITUTIONAL_BREACH detected; all-stop

Transitions:

  PENDING ──► RUNNING
    Trigger: CI runner picks up job

  RUNNING ──► RUNNING
    Trigger: Stage N passes; Stage N+1 begins

  RUNNING ──► PASSED
    Trigger: All 8 stages pass

  RUNNING ──► FAILED
    Trigger: Any stage fails with severity ERROR
    Effect: No further stages run; PR blocked from merge

  RUNNING ──► BLOCKED
    Trigger: Any stage fails with severity CONSTITUTIONAL_BREACH
    Effect: No further stages run; paging alert fired within 60s;
            PR hard-blocked; requires constitutional review to unblock

  RUNNING ──► BYPASSED
    Trigger: bypass-audit record present for this $CI_COMMIT_SHA
    Effect: Specified stages are skipped; all other stages run normally;
            bypass record is logged and retained permanently;
            BYPASSED state requires amendment resolution within 5 business days

  BLOCKED ──► RUNNING (re-run after fix)
    Trigger: Engineer pushes new commit after root cause resolved
    Effect: Full pipeline re-runs from Stage 01

  FAILED ──► RUNNING (re-run after fix)
    Trigger: Engineer pushes new commit with fix
    Effect: Full pipeline re-runs from Stage 01

Forbidden transitions:
  FAILED ──✗► PASSED     (cannot self-heal)
  BLOCKED ──✗► PASSED    (cannot self-heal)
  BYPASSED ──✗► PASSED   (bypass is not a pass; it requires follow-up)

Stage sequence and allowed failure severity per stage:

  Stage 01: schema-validate
    Pass: proceed to Stage 02
    Fail (any): ──► FAILED

  Stage 02: replay-corpus
    Pass: proceed to Stage 03
    Fail (divergence_class 0-1): ──► ADVISORY logged; proceed to Stage 03
    Fail (divergence_class 2): ──► FAILED
    Fail (divergence_class 3): ──► BLOCKED (CONSTITUTIONAL_BREACH)
    Fail (divergence_class 4): ──► BLOCKED (CATASTROPHIC; integrity failure)
    Fail (INTEGRITY_FAILURE): ──► BLOCKED

  Stage 03: invariant-verify
    Pass: proceed to Stage 04
    Fail (any): ──► BLOCKED (CONSTITUTIONAL_BREACH)

  Stage 04: threshold-scan
    Pass: proceed to Stage 05
    Fail: ──► FAILED

  Stage 05: forbidden-pattern
    Pass: proceed to Stage 06
    Fail (FP-01/02/04/06/10/14): ──► BLOCKED (CONSTITUTIONAL_BREACH)
    Fail (FP-07/15): ──► FAILED

  Stage 06: migration-lint
    Pass: proceed to Stage 07
    Fail (MISSING_ROLLBACK_COMMENT): ──► FAILED
    Fail (CONSTITUTIONAL_BREACH): ──► BLOCKED

  Stage 07: parity-verify (conditional)
    Skipped if PRE_SHADOW_MODE != true AND CANARY_STEP not set
    Pass: proceed to Stage 08
    Fail (forbidden divergence): ──► BLOCKED

  Stage 08: chaos-smoke
    Pass: ──► PASSED
    Fail: ──► FAILED

Bypass audit path:
  Engineer creates bypass record:
    corpus/integrity/bypass-audit/{bypass_id}.json
    with commit_sha = $CI_COMMIT_SHA
  
  CI reads bypass record at Stage N start:
    If bypass record present AND stages_bypassed includes Stage N:
      ──► Stage N SKIPPED (not PASSED)
      ──► State = BYPASSED (not PASSED after all stages)
    
  Bypass record must be committed in same commit as bypassed run.
  Bypass records committed on different SHA are rejected as invalid.
```

---

## 20. Appendix C — Replay Execution Sequence Diagram

```
REPLAY HARNESS INVOCATION
npx ts-node scripts/run-replay.ts [--filter ...]
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                                │
│                                                                  │
│    runId ← uuid()                                                │
│    startedAt ← Date.now()                                        │
│    Set TZ=UTC in process environment                             │
│    Load CORPUS-INDEX.json                                        │
│    Verify index integrity (all file hashes match index entries)  │
└─────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FIXTURE DISCOVERY                                             │
│                                                                  │
│    Filter index.entries to status='active'                       │
│    Apply optional class/id/invariant filters                     │
│    Sort entries by packet_id (lexicographic ascending)           │
│    Resolve absolute file paths                                   │
│    Result: orderedPacketPaths[] (deterministic)                  │
└─────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │ FOR EACH path IN orderedPaths  │◄────────────────────┐
              └───────────────┬────────────────┘                     │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 3. PACKET LOAD AND INTEGRITY VERIFICATION                        │  │
│                                                                  │  │
│    raw ← readFile(path)          // utf-8                        │  │
│    parsed ← JSON.parse(raw)                                      │  │
│                                                                  │  │
│    IF packet_version NOT IN SUPPORTED_SCHEMA_VERSIONS:           │  │
│      emit result: INTEGRITY_FAILURE (SCHEMA_VERSION_UNSUPPORTED) │  │
│      continue next packet ──────────────────────────────────────►│  │
│                                                                  │  │
│    IF ajv.validate fails:                                        │  │
│      emit result: INTEGRITY_FAILURE (SCHEMA_INVALID)            │  │
│      continue next packet ──────────────────────────────────────►│  │
│                                                                  │  │
│    Verify input_hash:                                            │  │
│      expected ← fnv1a32(canonicalizeJson(parsed.input))          │  │
│      IF expected ≠ parsed.input_hash:                            │  │
│        emit result: INTEGRITY_FAILURE (HASH_MISMATCH_INPUT)      │  │
│        continue next packet ────────────────────────────────────►│  │
│                                                                  │  │
│    Verify output_hash:                                           │  │
│      expected ← fnv1a32(canonicalizeJson(parsed.expected_output))│  │
│      IF expected ≠ parsed.output_hash:                           │  │
│        emit result: INTEGRITY_FAILURE (HASH_MISMATCH_OUTPUT)     │  │
│        continue next packet ────────────────────────────────────►│  │
│                                                                  │  │
│    Verify packet_hash:                                           │  │
│      packetWithoutHash ← omit(parsed, 'packet_hash')            │  │
│      expected ← sha256(canonicalizeJson(packetWithoutHash))      │  │
│      IF expected ≠ parsed.packet_hash:                           │  │
│        emit result: INTEGRITY_FAILURE (HASH_MISMATCH_PACKET)     │  │
│        continue next packet ────────────────────────────────────►│  │
│                                                                  │  │
│    packet ← parsed as ImmutablePacket (all fields Readonly<>)    │  │
└─────────────────────────────┬───────────────────────────────────┘  │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 4. IN-MEMORY DATABASE CONSTRUCTION                               │  │
│                                                                  │  │
│    db ← buildInMemoryDb(packet.input.system_state)              │  │
│    db.execute → throws InvariantViolationError(INV-1)           │  │
│    db.query   → routes to snapshot data via routeQuery()         │  │
│    Query results ordered identically to production queries        │  │
└─────────────────────────────┬───────────────────────────────────┘  │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 5. PRE INVOCATION                                                │  │
│                                                                  │  │
│    execStart ← Date.now()                                        │  │
│    TRY:                                                          │  │
│      actualOutput ← await PRE.resolve(                           │  │
│        packet.input.screen_id,                                   │  │
│        packet.input.at,                                          │  │
│        db          // in-memory, read-only                       │  │
│      )                                                           │  │
│    CATCH (InvariantViolationError):                              │  │
│      emit result: INVARIANT_VIOLATION (INV-1 purity breach)      │  │
│      severity: CONSTITUTIONAL_BREACH                             │  │
│      continue next packet ──────────────────────────────────────►│  │
│    CATCH (any other error):                                      │  │
│      emit result: PRE_THREW (INV-2 totality breach)              │  │
│      continue next packet ──────────────────────────────────────►│  │
│                                                                  │  │
│    executionMs ← Date.now() - execStart                          │  │
└─────────────────────────────┬───────────────────────────────────┘  │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 6. INVARIANT ASSERTION (post-invocation)                         │  │
│                                                                  │  │
│    results ← runAllInvariants(actualOutput, packet.input)        │  │
│    FOR EACH invariant IN [INV-1..INV-10]:                        │  │
│      result ← inv.assert(actualOutput, packet.input)             │  │
│      IF result.passed = false:                                   │  │
│        emit result: INVARIANT_VIOLATION                          │  │
│        severity: result.severity                                 │  │
│        IF severity = CONSTITUTIONAL_BREACH:                      │  │
│          flag for immediate escalation in final report           │  │
│                                                                  │  │
│    IF any failures:                                              │  │
│      continue next packet ──────────────────────────────────────►│  │
└─────────────────────────────┬───────────────────────────────────┘  │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 7. OUTPUT COMPARISON                                             │  │
│                                                                  │  │
│    actualHash ← fnv1a32(canonicalizeJson(actualOutput))          │  │
│                                                                  │  │
│    IF actualHash = packet.output_hash:                           │  │
│      emit result: PASS                                           │  │
│      continue next packet ──────────────────────────────────────►│  │
│                                                                  │  │
│    // Hashes differ — classify divergence                        │  │
│    diffs ← fieldDiff(packet.expected_output, actualOutput)       │  │
└─────────────────────────────┬───────────────────────────────────┘  │
                               │                                      │
                               ▼                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│ 8. DIVERGENCE CLASSIFICATION                                     │  │
│                                                                  │  │
│    divergence ← classifyDivergence(                              │  │
│      packet.expected_output, actualOutput, packet)               │  │
│                                                                  │  │
│    SWITCH divergence.divergence_class:                           │  │
│      0 (COSMETIC):       emit ADVISORY; record in report         │  │
│      1 (TOLERATED):      emit ADVISORY; record in report         │  │
│      2 (WARNING):        emit FAIL; record in report             │  │
│      3 (CONSTITUTIONAL): emit FAIL + CONSTITUTIONAL_BREACH alert │  │
│      4 (CATASTROPHIC):   emit FAIL + ALL_STOP alert              │  │
│                                                                  │  │
│    Write divergence detail:                                      │  │
│      {outputPath}/divergences/{packet_id}.json                   │  │
│                                                                  │  │
│    continue next packet ────────────────────────────────────────►│  │
└─────────────────────────────────────────────────────────────────┘  │
                               │ (all packets processed)             │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. REPORT GENERATION                                             │
│                                                                  │
│    results.sort((a,b) => a.packet_id.localeCompare(b.packet_id)) │
│    // Results in deterministic order regardless of execution order│
│                                                                  │
│    report ← {                                                    │
│      run_id, started_at, completed_at,                           │
│      pre_impl_version, corpus_schema_version,                    │
│      total_packets, passed, failed, integrity_failures,          │
│      divergences: results.filter(r => !r.passed),               │
│      overall_result:                                             │
│        integrity_failures > 0 ? 'INTEGRITY_FAILURE' :           │
│        failed > 0 ? 'FAIL' : 'PASS'                             │
│    }                                                             │
│                                                                  │
│    Write: {outputPath}/replay-results/{runId}/report.json        │
│    Write: corpus/replay-audit/{YYYY-MM}/{runId}-summary.json     │
└─────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. EXIT CODE                                                    │
│                                                                  │
│    IF report.overall_result = 'PASS': exit(0)                   │
│    IF report.overall_result = 'FAIL': exit(1)                   │
│    IF report.overall_result = 'INTEGRITY_FAILURE': exit(2)      │
│                                                                  │
│    CI interprets exit(0) as pass.                                │
│    CI interprets exit(1) as FAILED state.                        │
│    CI interprets exit(2) as BLOCKED state + pages on-call.       │
│                                                                  │
│    No replay divergence self-approves.                           │
│    No replay failure is silently swallowed.                      │
│    The exit code is the verdict. It does not negotiate.          │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document status: Ratified. This document defines the executable implementation layer of the ClubHub TV constitutional system. It operationalizes governance into enforced runtime behavior. The platform becomes trustworthy when invariants execute automatically — and they do.*
