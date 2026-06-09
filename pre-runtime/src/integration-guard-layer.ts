/**
 * INTEGRATION-GUARD-LAYER-v1.ts
 *
 * The mandatory gate that wraps ALL PRE execution entry points.
 * Nothing executes unless it passes every guard in sequence.
 *
 * Failure codes (returned, never thrown — callers must inspect):
 *   IG-01  Governed clock is not active (not set before execution call)
 *   IG-02  State machine is not registered with the guard layer
 *   IG-03  Corpus hash chain is broken — write integrity cannot be guaranteed
 *   IG-04  Replay pre-check detected divergence before execution begins
 *
 * Design constraints:
 *   - Every gate function is PURE (no side effects, no I/O)
 *   - Only the guarded executor functions mutate system state
 *   - No fallback execution on any gate failure
 *   - No "log and continue" — failure means full stop
 *   - All rejection codes are explicit and classified
 *
 * Architectural guarantee:
 *   "If execution happened, it was valid under PRE — or it did not happen at all."
 */

import { GovernedClock } from './governed-clock';
import { Corpus } from './corpus';
import { resolve as engineResolve, _resolve } from './pre-engine';
import { StateMachine } from './state-machine';
import {
  PREInput,
  PREOutput,
  PREResult,
  PRETraceEvent,
  CorpusEntry,
  TransitionRequest,
  StateMutationEvent,
} from './types';

// ─── FAILURE CODE TYPES ───────────────────────────────────────────────────────

export type IGFailureCode = 'IG-01' | 'IG-02' | 'IG-03' | 'IG-04';

export interface IGFailure {
  /** Structured failure code — always present, always classified. */
  readonly code: IGFailureCode;
  readonly message: string;
  /**
   * Wall-clock ISO8601 at the moment of rejection.
   * Intentionally not governed-clock — clock may not be active (IG-01).
   */
  readonly rejectedAt: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export type GuardResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: IGFailure };

// ─── MACHINE REGISTRY (module-level singleton) ───────────────────────────────

/**
 * The guard layer's canonical registry of known state machines.
 * A machine MUST be registered here before any guarded operation references it.
 * Deregistration is explicit — no GC-based removal.
 */
const _machineRegistry = new Map<string, StateMachine>();

export function registerMachine(machine: StateMachine): void {
  _machineRegistry.set(machine.id, machine);
}

export function deregisterMachine(machineId: string): void {
  _machineRegistry.delete(machineId);
}

export function getRegisteredIds(): readonly string[] {
  return Array.from(_machineRegistry.keys());
}

export function getRegisteredMachine(machineId: string): StateMachine | undefined {
  return _machineRegistry.get(machineId);
}

/** Reset registry — only for isolated test runs. */
export function _resetRegistry(): void {
  _machineRegistry.clear();
}

// ─── GATE FUNCTIONS (PURE) ───────────────────────────────────────────────────

/**
 * IG-01 Gate: Verify the governed clock is active.
 *
 * "Active" means GovernedClock.set() or GovernedClock.freeze() was called
 * before this execution attempt. GovernedClock.now() throws if unset.
 */
function gateClockActive(): IGFailure | null {
  try {
    const ts = GovernedClock.now();
    // Validate it is actually a parseable ISO timestamp (not empty/corrupt)
    if (Number.isNaN(Date.parse(ts))) {
      return makeFailure('IG-01', 'Governed clock returned an unparseable timestamp', {
        returnedValue: ts,
      });
    }
    return null;
  } catch {
    return makeFailure(
      'IG-01',
      'Governed clock is not active. Call GovernedClock.set(iso) before executing.',
      {}
    );
  }
}

/**
 * IG-02 Gate: Verify the target state machine is registered with the guard layer.
 *
 * An unregistered machine has not been submitted to governance.
 * Allowing execution against it would bypass all downstream integrity checks.
 */
function gateMachineRegistered(machineId: string): IGFailure | null {
  if (!_machineRegistry.has(machineId)) {
    return makeFailure(
      'IG-02',
      `State machine '${machineId}' is not registered with the integration guard layer.`,
      {
        machineId,
        registeredIds: Array.from(_machineRegistry.keys()),
      }
    );
  }
  return null;
}

/**
 * IG-03 Gate: Verify corpus hash chain integrity before any write operation.
 *
 * A broken chain means a prior write bypassed the guard or was externally mutated.
 * No new entry may be added to a compromised chain — that would permanently
 * corrupt the audit record.
 */
function gateCorpusChainIntact(): IGFailure | null {
  const valid = Corpus.verifyChain();
  if (!valid) {
    return makeFailure(
      'IG-03',
      'Corpus hash chain integrity check failed. Prior entry hash mismatch detected.',
      {
        corpusLength: Corpus.getAll().length,
      }
    );
  }
  return null;
}

/**
 * IG-04 Gate: Verify the most recent corpus entry is still deterministically
 * reproducible by the current PRE engine.
 *
 * Uses _resolve() (the pure function) directly rather than replayEntry().
 * replayEntry() calls GovernedClock.freeze() as a side effect, which would
 * corrupt the governed timestamp for the execution that follows this gate.
 * _resolve() is pure: same input → same output, no clock mutation.
 *
 * This check is skipped when the corpus is empty (no prior entry to verify).
 */
function gateReplayPreCheck(): IGFailure | null {
  const entries = Corpus.getAll();
  if (entries.length === 0) {
    return null;
  }

  const lastEntry = entries[entries.length - 1];

  // Pure re-execution: freeze clock would mutate state outside this gate,
  // so we call _resolve() directly with the stored governed_timestamp.
  const reResult = _resolve(lastEntry.input, lastEntry.input.governed_timestamp);

  if (!reResult.ok) {
    return makeFailure(
      'IG-04',
      `Replay pre-check: pure re-execution of corpus entry '${lastEntry.corpus_entry_id}' returned failure (${reResult.failure.failure_code}). ` +
        `PRE engine cannot reconstruct this entry — execution blocked.`,
      {
        corpus_entry_id: lastEntry.corpus_entry_id,
        failure_code: reResult.failure.failure_code,
        failure_message: reResult.failure.message,
      }
    );
  }

  if (reResult.output.output_hash !== lastEntry.output.output_hash) {
    return makeFailure(
      'IG-04',
      `Replay pre-check: output_hash divergence on corpus entry '${lastEntry.corpus_entry_id}'. ` +
        `The PRE engine no longer produces the same output for this recorded input. ` +
        `This is a CLASS_1 or CLASS_2 failure — execution blocked until corpus is audited.`,
      {
        corpus_entry_id: lastEntry.corpus_entry_id,
        expected_output_hash: lastEntry.output.output_hash,
        actual_output_hash: reResult.output.output_hash,
      }
    );
  }

  return null;
}

// ─── GUARDED EXECUTORS ───────────────────────────────────────────────────────

/**
 * guardedResolve — the ONLY permitted path to calling the PRE engine.
 *
 * Pipeline (all gates must pass, in order):
 *   1. IG-01: governed clock active
 *   2. IG-02: state machine registered
 *   3. IG-04: replay pre-check on last corpus entry
 *
 * Corpus chain check (IG-03) is NOT run here — resolution itself does not
 * write to the corpus. Use guardedCorpusAdd() for that write path.
 *
 * @param input      The PRE resolution input
 * @param machineId  The ID of the state machine that initiated this resolution
 */
export function guardedResolve(
  input: PREInput,
  machineId: string
): GuardResult<PREResult> {
  // Gate 1: Clock must be active before we touch the PRE engine
  const clockFailure = gateClockActive();
  if (clockFailure !== null) return { ok: false, failure: clockFailure };

  // Gate 2: Machine must be known to the guard layer
  const machineFailure = gateMachineRegistered(machineId);
  if (machineFailure !== null) return { ok: false, failure: machineFailure };

  // Gate 3: Existing corpus must still replay cleanly before we add to it
  const replayFailure = gateReplayPreCheck();
  if (replayFailure !== null) return { ok: false, failure: replayFailure };

  // All gates passed — execute
  const result = engineResolve(input);
  return { ok: true, value: result };
}

/**
 * guardedTransition — the ONLY permitted path to mutating a state machine.
 *
 * Pipeline (all gates must pass, in order):
 *   1. IG-01: governed clock active
 *   2. IG-02: machine registered in guard layer
 *
 * The machine itself enforces legal/forbidden/AI-authority rules internally.
 * This layer enforces the prerequisite governance context.
 *
 * @param machine   The StateMachine instance to transition
 * @param request   The transition request
 */
export function guardedTransition(
  machine: StateMachine,
  request: TransitionRequest
): GuardResult<StateMutationEvent> {
  // Gate 1: Clock active
  const clockFailure = gateClockActive();
  if (clockFailure !== null) return { ok: false, failure: clockFailure };

  // Gate 2: Machine must be registered
  const machineFailure = gateMachineRegistered(machine.id);
  if (machineFailure !== null) return { ok: false, failure: machineFailure };

  // Execute — machine.transition() throws on illegal/forbidden/AI-authority
  // We do NOT catch those throws: they represent logic errors that must surface
  const event = machine.transition(request);
  return { ok: true, value: event };
}

/**
 * guardedCorpusAdd — the ONLY permitted path to writing a new corpus entry.
 *
 * Pipeline (all gates must pass, in order):
 *   1. IG-01: governed clock active
 *   2. IG-03: corpus hash chain intact
 *   3. IG-04: replay pre-check on last corpus entry
 *
 * IG-02 is NOT checked here — corpus writes are not machine-specific.
 *
 * @param input       The PREInput that produced the output
 * @param output      The PREOutput to record
 * @param traceEvent  The trace event for this resolution
 */
export function guardedCorpusAdd(
  input: PREInput,
  output: PREOutput,
  traceEvent: PRETraceEvent
): GuardResult<CorpusEntry> {
  // Gate 1: Clock active
  const clockFailure = gateClockActive();
  if (clockFailure !== null) return { ok: false, failure: clockFailure };

  // Gate 2: Chain must be intact before we append
  const chainFailure = gateCorpusChainIntact();
  if (chainFailure !== null) return { ok: false, failure: chainFailure };

  // Gate 3: Existing entries must still replay correctly
  const replayFailure = gateReplayPreCheck();
  if (replayFailure !== null) return { ok: false, failure: replayFailure };

  // All gates passed — write
  const entry = Corpus.add(input, output, traceEvent);
  return { ok: true, value: entry };
}

// ─── INTERNAL UTILITIES ───────────────────────────────────────────────────────

function makeFailure(
  code: IGFailureCode,
  message: string,
  context: Record<string, unknown>
): IGFailure {
  return Object.freeze({
    code,
    message,
    rejectedAt: new Date().toISOString(), // wall clock — clock may not be governed
    context: Object.freeze(context),
  });
}
