# PRE Runtime

Minimal working implementation of the ClubHub TV PRE execution, replay, and verification system.

Implements the four specification documents:
- `RUNTIME-CONSTITUTION-CORE-v1.md` (25 rules)
- `EXECUTION-STATE-MODEL-v1.md` (state machines)
- `MINIMAL-PRE-RUNNER-SPEC-v1.md` (PRE engine)
- `REPLAY-AND-VERIFICATION-CONTRACT-v1.md` (divergence detection)

---

## Install

```sh
npm install
```

---

## Run Examples

```sh
# Nominal execution: PRE run → corpus → replay → MATCH
npm run example:nominal

# Divergence detection: CLASS_1 + CLASS_2 + CLASS_3
npm run example:divergence
```

---

## Source Layout

```
src/
  types.ts            — all TypeScript types (PREInput, PREOutput, StateMutationEvent, …)
  governed-clock.ts   — controlled time source; wall clock is forbidden in governed modules
  canonical-json.ts   — deterministic serialization (sorted keys, no whitespace)
  hash.ts             — SHA-256 helpers
  trace-store.ts      — append-only immutable trace (PRE events + state mutations)
  corpus.ts           — hash-chained corpus store
  pre-engine.ts       — PRE resolution engine (pure _resolve() + side-effect emitting resolve())
  state-machine.ts    — generic deterministic state machine with transition guards + rollback
  machines.ts         — 6 machine configs: Player, PREResolution, OperatorSession,
                        Incident, ReplaySession, UISurface
  replay-engine.ts    — corpus entry replay (clock frozen to governed_timestamp)
  verification.ts     — divergence detection: verify() and verifyDeterminism()
  index.ts            — public API exports
```

---

## Core Guarantees

### PRE Engine
- `_resolve()` is a pure function: no I/O, no side effects, no wall-clock access
- Same `PREInput` + same `rule_version` + same `GovernedClock` = identical `output_hash`, always
- `corpus_entry_id` is excluded from `input_hash` (replay metadata, not operational state)
- Every execution emits a `PRETraceEvent` to `TraceStore` as a post-call side effect

### State Machines
- Illegal transitions throw — never silently mutate state
- AI authority is blocked unconditionally at the boundary
- Every transition emits a `StateMutationEvent` to `TraceStore`
- Last 10 state snapshots enable rollback
- `replayFromHistory(events)` reconstructs final state deterministically from emitted events

### Corpus
- Hash-chained: each entry stores `prior_entry_hash` + `entry_hash`
- Entries are frozen (immutable) after insertion
- `Corpus.verifyChain()` validates the full chain at any time

### Replay
- `replayEntry()` freezes `GovernedClock` to the corpus entry's `governed_timestamp`
- Uses the stored `PREInput` unmodified — no inference or reconstruction
- Returns the replayed `PREOutput` for hash comparison

### Verification
- `verify(entry, replayResult)` → `MATCH` or `DIVERGENCE_DETECTED`
- `verifyDeterminism(entry, runs[])` → detects non-determinism across N runs

**Failure classes:**

| Class | Detected by | Condition |
|-------|-------------|-----------|
| CLASS_1_DETERMINISM_FAILURE | `verifyDeterminism()` | N runs produce differing `output_hash` |
| CLASS_2_CORPUS_DIVERGENCE | `verify()` | Replay `output_hash` ≠ corpus record |
| CLASS_3_RECONSTRUCTION_FAILURE | `verify()` | Replay fails to produce any output |
| CLASS_4_PARITY_VIOLATION | `verify()` | Hashes match but `resolution_path` differs |
| CLASS_5_APPROXIMATION_UNDISCLOSED | (frontend layer) | Approximate replay shown without label |

---

## Invariants (from RUNTIME-CONSTITUTION-CORE-v1.md)

- **R-02** PRE output is deterministic — same inputs → same `output_hash`, always
- **R-03** All timestamps use `GovernedClock` — wall clock forbidden
- **R-07** REPLAY → LIVE requires SYNCING (enforced by state machine forbidden rule)
- **R-08** Illegal transitions throw; all attempts are logged to TraceStore
- **R-09** AI authority is blocked unconditionally
- **R-10** Every state transition emits a `StateMutationEvent`
- **R-11** `replayFromHistory(events)` reproduces final state from emitted events
- **R-21** Corpus divergence is detected by hash comparison, not content inspection
