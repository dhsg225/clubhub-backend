# HARDENING-FAILURE-MODE-REGISTER.md
## System Integration Hardening Layer — Failure Mode Register

**Version:** v1
**Layer:** Integration Guard Layer + Execution Policy Orchestrator + System Integrity Checker
**Scope:** Failure modes INTRODUCED by the hardening layer itself
**Status:** Constitutional Document — changes require formal review

---

## Purpose

This register catalogues failure modes that arise specifically from the presence of the
integration hardening layer — not failures in the underlying PRE engine, corpus, or state
machines. The layer is designed to make impossible execution paths unrepresentable. But the
layer itself can fail in ways that either over-restrict valid execution (false gating) or
under-restrict invalid execution (permissive bypass). Both classes are documented here.

---

## Taxonomy

| Class | Name | Effect |
|-------|------|--------|
| A | Over-restriction | Valid execution blocked incorrectly |
| B | Under-restriction | Invalid execution permitted incorrectly |
| C | Hash boundary | Integrity checks produce wrong boundaries |
| D | Layer-induced divergence | The wrapper itself introduces non-determinism |

---

## Failure Modes

---

### HFM-001 — False Gating: Clock Active Check Triggers on Valid Clock

**Class:** A (Over-restriction)
**Failure Description:**
`gateClockActive()` (IG-01) rejects a valid, set clock because `GovernedClock.now()` returns
a timestamp that `Date.parse()` fails to parse due to a non-standard but technically valid ISO 8601
variant (e.g., with sub-millisecond precision or a non-UTC timezone offset).

**Detection Method:**
Unit test: call `GovernedClock.set()` with a range of valid ISO 8601 variants and assert that
`guardedResolve()` returns `ok: true`. If IG-01 triggers, the clock validation is too strict.

**Severity Class:** CLASS_2 (Operational — blocks valid execution, causing service disruption)

**Prevention Rule:**
Use `Number.isNaN(Date.parse(ts))` as the validation predicate — this is the same predicate
used by `GovernedClock.set()` internally. The guard must use an identical validation function,
not a stricter regex, so the two layers cannot disagree.

**Recovery Action:**
If triggered: call `GovernedClock.set()` with a normalised UTC ISO 8601 string
(e.g., `new Date().toISOString()`). If the guard still rejects, the guard's validation function
has drifted from the clock's validation function — realign both to the same predicate.

---

### HFM-002 — False Gating: Machine Registry Miss After Hot Reload

**Class:** A (Over-restriction)
**Failure Description:**
The `_machineRegistry` is a module-level `Map`. In environments that support hot module
reloading (e.g., development servers, test harnesses with module isolation), the module may
be re-evaluated, resetting `_machineRegistry` to an empty state. All subsequent
`guardedResolve()` or `guardedTransition()` calls fail with IG-02 despite the machines
being valid and operational.

**Detection Method:**
In test environments: assert `getRegisteredIds().length > 0` after module reload events.
In production: the IG-02 failure code in the structured log is the primary signal.

**Severity Class:** CLASS_2 (Operational — all governed execution halts until re-registration)

**Prevention Rule:**
Application bootstrap must call `registerMachine()` for all 6 state machines as part of the
startup sequence, BEFORE any PRE resolution is attempted. This registration must be idempotent
(calling `registerMachine` twice with the same ID is safe — it overwrites). The startup sequence
is documented in RUNTIME-CONSTITUTION-CORE-v1.md.

**Recovery Action:**
Call `registerMachine()` for all required machines. No execution state is lost — the machines
themselves are unchanged; only the guard's registry needs repopulation.

---

### HFM-003 — False Gating: IG-04 Replay Pre-Check Fails Due to Clock State Leak

**Class:** A (Over-restriction)
**Failure Description:**
`gateReplayPreCheck()` calls `replayEntry()`, which calls `GovernedClock.freeze()` with the
corpus entry's `governed_timestamp`. If the replay completes but the clock is not restored to
its pre-replay state (e.g., due to an exception inside the replay engine), subsequent execution
attempts see a frozen clock at the wrong timestamp. The next `guardedResolve()` call then
produces an output with a stale timestamp, causing a false IC-02 determinism failure.

**Detection Method:**
After each `guardedResolve()` call, assert `GovernedClock.now()` matches the governed
timestamp that was set before the call. A discrepancy indicates clock state was mutated
by the replay pre-check path.

**Severity Class:** CLASS_1 (Constitutional — introduces non-determinism in the engine layer)

**Prevention Rule:**
The replay engine (`replayEntry`) is responsible for saving and restoring the clock state
around any freeze operation. The integration guard must NOT call `GovernedClock.freeze()`
directly. All clock manipulation during replay must go through the replay engine's own
clock save/restore protocol.

**Recovery Action:**
Call `GovernedClock.set(correctIso)` to restore the governed time to the pre-replay value.
Identify the corpus entry whose replay leaked the clock state (the one whose
`governed_timestamp` matches the leaked value). Audit the replay engine for missing
clock restore paths.

---

### HFM-004 — Permissive Bypass: Edge Entrypoint Circumvents Guard

**Class:** B (Under-restriction)
**Failure Description:**
A caller imports `resolve` directly from `pre-engine.ts` and bypasses `guardedResolve()`
entirely. The guard layer is optional at the import level — TypeScript module resolution
does not enforce that the guard is the only path to the engine.

**Detection Method:**
Static analysis: grep the entire codebase for direct imports of `resolve` or `_resolve`
from `pre-engine.ts`. Any import site that is NOT inside `integration-guard-layer.ts`
is a bypass path. This check must run in CI.

CI gate command pattern:
```
grep -r "from.*pre-engine" --include="*.ts" | grep -v integration-guard-layer.ts
```
Any output from this command is a BUILD BLOCKER.

**Severity Class:** CLASS_5 (Constitutional — makes the governance guarantee unenforceable)

**Prevention Rule:**
`pre-engine.ts` must not be re-exported from `pre-runtime/src/index.ts`. The public API
of the pre-runtime package must export ONLY the guarded versions. All direct engine
access must be limited to `integration-guard-layer.ts` via import.

**Recovery Action:**
Identify all bypass import sites. Replace with `guardedResolve()` calls. Re-run the
CI static analysis gate to confirm elimination. If the bypass was used in tests, those
tests must be rewritten to use the guard layer or to test the engine in isolation via
the dedicated pure `_resolve()` test path (which does not write to corpus).

---

### HFM-005 — Inconsistent Hash Boundary: Input Hashed Before vs After Normalisation

**Class:** C (Hash boundary)
**Failure Description:**
The `stageDeterminismPreHash()` stage hashes `ctx.input` using `canonicalJSON()`.
If the caller modifies the input object between constructing `ExecutionContext` and
calling `evaluateExecutionPermission()`, the hash produced by the orchestrator will
not match the hash the engine will compute internally, because the engine hashes
a potentially different object.

This creates a phantom "hash mismatch" that blocks execution (EPO-04), or worse:
a hash match is asserted but the engine computes from a slightly different object,
silently invalidating the determinism check.

**Detection Method:**
Freeze all `PREInput` objects at the point of construction before passing to
`ExecutionContext`. Verify via test: mutating `input` after `evaluateExecutionPermission`
returns `granted: true` should cause the engine's `output.input_hash` to differ from
the orchestrator's computed hash.

**Severity Class:** CLASS_1 (Constitutional — renders the determinism pre-check meaningless)

**Prevention Rule:**
`PREInput` objects must be frozen with `Object.freeze()` before being placed in an
`ExecutionContext`. The `stageDeterminismPreHash` function must document this precondition.
Input construction is the caller's responsibility; the orchestrator does not freeze inputs
because doing so would be a side effect inside a pure function.

**Recovery Action:**
If a phantom EPO-04 occurs: compare the input hash computed by the orchestrator to
the `input_hash` field in the PREOutput. If they differ, locate where the input was
mutated between context construction and engine execution. Freeze all inputs at source.

---

### HFM-006 — Replay/Live Divergence Introduced by Wrapper Timing

**Class:** D (Layer-induced divergence)
**Failure Description:**
The `guardedResolve()` wrapper performs multiple operations between the guard checks and
the actual `engineResolve()` call: clock validation, machine registry lookup, and the
replay pre-check. Each of these operations takes non-zero wall-clock time. If the
governed clock is advancing (not frozen) and uses wall time, the `governed_timestamp`
in the PREInput may no longer match `GovernedClock.now()` by the time the engine runs.

This means the engine computes with a clock value that differs from the input's
`governed_timestamp`, causing the output's `input_hash` to be computed from a timestamp
that differs from the timestamp the engine actually used.

**Detection Method:**
In live mode: compare `input.governed_timestamp` to `GovernedClock.now()` immediately
before calling `engineResolve()`. If they differ by more than 1ms, the wrapper has
introduced clock drift. This check should be an assertion in the guarded executor.

**Severity Class:** CLASS_4 (Parity violation — live and replay produce different hashes
for what should be the same execution)

**Prevention Rule:**
The caller must freeze the governed clock at the `governed_timestamp` from the PREInput
BEFORE constructing the `ExecutionContext`. The guard layer is not responsible for
clock management — that is the caller's responsibility per the GovernedClock contract.
The guard only validates that a clock value has been set, not that it matches the input.

**Recovery Action:**
If divergence is detected post-execution: the corpus entry carries the evidence
(input hash computed from input.governed_timestamp vs output computed_at timestamp).
Replay the entry to confirm divergence. If confirmed, retire the entry using the
EDGE-001 retirement protocol (see corpus/EDGE-001-retired.json for the pattern).

---

### HFM-007 — IC-03 Replay Audit Mutates Clock for Live Execution Context

**Class:** D (Layer-induced divergence)
**Failure Description:**
`auditReplayEquivalence()` inside `checkSystemIntegrity()` calls `replayEntry()` for
each sampled corpus entry. `replayEntry()` calls `GovernedClock.freeze()`. If
`checkSystemIntegrity()` is called concurrently with a live execution (not possible in
single-threaded Node.js, but possible if Worker threads are introduced), the freeze
inside the integrity check will corrupt the clock state for the live execution path.

**Detection Method:**
Enforce that `checkSystemIntegrity()` is never called concurrently with any governed
execution. In single-threaded environments, document this constraint. If Worker threads
are added, the governed clock must become thread-local or integrity checks must acquire
a global mutex before running.

**Severity Class:** CLASS_1 (Constitutional — non-deterministic clock state)

**Prevention Rule:**
`checkSystemIntegrity()` must only be called:
1. Before the system enters production execution mode (startup audit)
2. After all in-flight resolutions have completed (maintenance window audit)
3. Never concurrently with `guardedResolve()` or `guardedTransition()`

Document this as a constitutional constraint in RUNTIME-CONSTITUTION-CORE-v1.md.

**Recovery Action:**
If concurrent corruption occurs: call `GovernedClock.reset()` and then
`GovernedClock.set(correctIso)` to restore governed time. Investigate whether any
in-flight resolutions completed during the corrupted clock state — they must be
retired from corpus and replayed from the correct timestamp.

---

### HFM-008 — IC-04 History Audit Misses REJECTED Events as True Forbidden Violations

**Class:** A (Over-restriction / detection gap)
**Failure Description:**
`auditStateMachineHistories()` skips events where `toState.startsWith('REJECTED(')`.
This is correct for events that were legitimately blocked by the machine's own enforcement.
However, if a malicious or buggy caller constructs a fake StateMutationEvent with
`toState = "REJECTED(LIVE)"` and injects it into the mutation log via external means,
this event would be silently ignored by IC-04, masking the actual forbidden transition.

**Detection Method:**
The StateMachine's `getMutations()` method returns its internal `_mutations` array.
If the array can be mutated externally (it is exposed as `readonly` but the underlying
array reference may be accessible), events can be injected. Audit IC-04 to also
verify that REJECTED events follow the expected naming convention and that no REJECTED
event records a transition that should have been to a non-REJECTED state.

**Severity Class:** CLASS_3 (Reconstruction failure — audit trail is incomplete)

**Prevention Rule:**
`getMutations()` must return a frozen copy of the array, not the array reference.
Alternatively, `auditStateMachineHistories()` must validate REJECTED event structure:
`toState` must match the pattern `REJECTED(<legal_target_state>)` where `legal_target_state`
is a known state name — not an arbitrary string.

**Recovery Action:**
If injected events are detected: the machine's entire mutation history is untrusted.
Freeze the machine (prevent further transitions), capture current state as a checkpoint,
and reinitialise the machine from the last known-good TraceStore entry.

---

### HFM-009 — IC-05 Reachability Audit Falsely Flags Valid Sink States

**Class:** A (Over-restriction)
**Failure Description:**
`findUnreachableStates()` performs BFS from `config.initial`. Terminal (sink) states
are states with no outgoing transitions — they are by design not listed as keys in the
`transitions` map, only as targets. The BFS correctly identifies them as reachable
(they appear as values in the transitions table). However, if a terminal state is also
listed as a key in `transitions` with an empty array (to make it explicit), and BFS
visits it and finds zero outgoing edges, the state is still reachable.

The failure mode is the inverse: a state that IS listed as a key with valid outgoing
edges but is NOT reachable from initial because no other state transitions to it.
IC-05 correctly flags this as unreachable — but callers may interpret this as
a false positive if they believe the state is reachable via a path not represented
in the static config (e.g., via `transition('ANY', ...)`).

**Detection Method:**
Test: for each machine config, enumerate all states manually and confirm they are either
reachable from initial or correctly absent from the config.

**Severity Class:** CLASS_2 (Operational — spurious INTEGRITY_DEGRADED reports)

**Prevention Rule:**
IC-05 produces WARN severity (not BLOCKING). An INTEGRITY_DEGRADED result from IC-05
alone must not halt execution. Treat it as a configuration review signal, not a hard gate.

**Recovery Action:**
Review the machine config for the flagged state. Either:
(a) Add a transition from a reachable state to the unreachable state, making it reachable.
(b) Remove the unreachable state from the config entirely.
Never add a bypass transition just to silence the audit — fix the actual config.

---

### HFM-010 — EPO Stage Pipeline Short-Circuits Too Early on Hash Conflict

**Class:** A (Over-restriction)
**Failure Description:**
Stage 4 (`stageDeterminismPreHash`) returns `passed: true` even when the input hash
matches a prior input but no output conflict can be verified pre-execution (because
the engine hasn't run yet). A caller who misreads the stage result evidence
(`outcome: 'input_hash_matches_prior'`) as a confirmation that the output is correct
may skip post-execution output hash verification. The stage passes, but the verification
it represents is deferred — the caller must still check after execution.

**Detection Method:**
Assert that any caller of `evaluateExecutionPermission()` that receives `granted: true`
AND observes `outcome: 'input_hash_matches_prior'` in Stage 4 evidence ALWAYS performs
post-execution output hash comparison: `actual_output_hash === knownPriorOutputHash`.

**Severity Class:** CLASS_1 (Constitutional — deferred verification may never execute)

**Prevention Rule:**
Stage 4 must emit a `verificationRequired: true` flag in its evidence when
`outcome === 'input_hash_matches_prior'`. Callers must treat this flag as a contract:
post-execution output hash comparison is MANDATORY, not optional.

**Recovery Action:**
If deferred verification was skipped: replay the corpus entry that was written without
post-execution verification. If output hash matches prior, no harm done. If it differs,
that entry is a CLASS_1 determinism failure and must be retired.

---

### HFM-011 — IC-06 Trace-Corpus Alignment Misses Entries Without corpus_entry_id

**Class:** A (Detection gap)
**Failure Description:**
`auditTraceCorpusAlignment()` skips trace events where `corpus_entry_id` is null or
undefined (`if (!event.corpus_entry_id) { continue; }`). This is correct when
corpus_entry_id is intentionally absent (e.g., failed resolutions). However, if
a successful resolution's trace event is missing `corpus_entry_id` due to a bug in
the trace emission path, IC-06 silently ignores it instead of flagging a potential
unrecorded execution.

**Detection Method:**
Assert: every `PRE_RESOLVED` event in the TraceStore MUST have a non-null
`corpus_entry_id`. `PRE_FAILED` events may have null. Add this assertion to IC-06.

**Severity Class:** CLASS_3 (Reconstruction — unverifiable audit trail entries)

**Prevention Rule:**
The PRE engine's `resolve()` function must always emit `corpus_entry_id` in the
`PRE_RESOLVED` trace event. This field must be populated before the trace event is
emitted, not after. IC-06 must be updated to flag `PRE_RESOLVED` events with null
`corpus_entry_id` as BLOCKING violations.

**Recovery Action:**
For each `PRE_RESOLVED` event with null `corpus_entry_id`: attempt to find the
corresponding corpus entry by matching `resolution_id` and `governed_timestamp`.
If found, the trace event is retrospectively linkable. If not found, the execution
is unrecorded — treat as a corpus gap requiring investigation before the next
production deployment.

---

### HFM-012 — Double-Guard: Integrity Checker Triggers Inside Guarded Executor Path

**Class:** D (Layer-induced divergence)
**Failure Description:**
If `checkSystemIntegrity()` is called from within the pre-flight chain of
`evaluateExecutionPermission()` or `guardedResolve()` (e.g., added by a future
contributor as a "belt and suspenders" check), it creates a re-entrant path:
`checkSystemIntegrity()` calls `replayEntry()`, which calls the engine, which
calls `guardedResolve()`, which calls `checkSystemIntegrity()` — infinite recursion.

**Detection Method:**
Static analysis: `checkSystemIntegrity()` must never appear in the call graph of
`guardedResolve()`, `guardedTransition()`, `guardedCorpusAdd()`, or
`evaluateExecutionPermission()`. This is enforced by a CI import graph check.

**Severity Class:** CLASS_5 (Constitutional — stack overflow halts the entire process)

**Prevention Rule:**
`checkSystemIntegrity()` is a maintenance-window function, not an execution-time function.
It must only be called:
1. During application startup (before any execution begins)
2. In CI pipelines as a pre-deploy gate
3. By the operator-facing health endpoint (out-of-band from the execution path)

Document in the function's JSDoc that it MUST NOT be called from within any execution pipeline.

**Recovery Action:**
If the recursion occurs, the process must be restarted. After restart, remove the
incorrect `checkSystemIntegrity()` call from the execution path. Re-run all 79 contract
checks to verify no other integrity check paths were introduced during the faulty refactor.

---

## Cross-Reference: Failure Modes by Severity Class

| Severity | Failure Modes |
|----------|--------------|
| CLASS_1 (Constitutional / Determinism) | HFM-003, HFM-005, HFM-006, HFM-007, HFM-010 |
| CLASS_2 (Operational / Service Impact) | HFM-001, HFM-002, HFM-009 |
| CLASS_3 (Reconstruction / Audit Gap) | HFM-008, HFM-011 |
| CLASS_4 (Parity Violation) | HFM-006 (dual class) |
| CLASS_5 (Constitutional / Unrecoverable) | HFM-004, HFM-012 |

---

## Failure Mode Maintenance Protocol

1. Each new failure mode discovered in production or testing must be added here before a fix is shipped.
2. Prevention rules must be machine-checkable (CI gate, static analysis, or test assertion) wherever possible.
3. Recovery actions must be executable without access to the production environment's live state.
4. Severity classes must use the `CLASS_1–CLASS_5` taxonomy from the verification layer.
5. This register is a constitutional document — changes require the same review process as
   changes to `RUNTIME-CONSTITUTION-CORE-v1.md`.

---

*Generated: 2026-05-29 | Layer: Integration Hardening v1 | Constitutional RC*
