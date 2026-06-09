/**
 * SYSTEM-INTEGRITY-CHECKER-v1.ts
 *
 * Full system self-audit that validates all governed subsystems are internally
 * consistent and externally verifiable before execution is permitted.
 *
 * checkSystemIntegrity() is the canonical entry point.
 *
 * Output statuses:
 *   INTEGRITY_PASS      All checks passed. System is safe to execute.
 *   INTEGRITY_DEGRADED  Non-blocking checks failed. Execution proceeds with warnings.
 *   INTEGRITY_FAIL      At least one BLOCKING check failed. Execution MUST be halted.
 *
 * Audit domains:
 *   IC-01  Corpus hash chain continuity
 *   IC-02  PRE engine deterministic consistency (multi-run hash stability)
 *   IC-03  Replay engine equivalence (existing corpus entries still replay correctly)
 *   IC-04  State machine history — no forbidden transitions appear in mutation log
 *   IC-05  State machine reachability — every reachable state is legal from initial
 *   IC-06  Trace store / corpus alignment — every PRETraceEvent has a corpus entry
 *
 * Design constraints:
 *   - No probabilistic checks — all results are deterministic
 *   - No execution side effects — checker is read-only (except GovernedClock during replay)
 *   - INTEGRITY_FAIL always blocks execution — callers must honour this
 *   - BLOCKING severity checks failing → INTEGRITY_FAIL
 *   - WARN severity checks failing → INTEGRITY_DEGRADED (if no BLOCKING failures)
 *   - INFO severity failures are advisory only, do not change status
 */

import { Corpus } from './corpus';
import { TraceStore } from './trace-store';
import { replayEntry, ReplayResult } from './replay-engine';
import { verify, verifyDeterminism } from './verification';
import { StateMachine, StateMachineConfig, ForbiddenRule } from './state-machine';
import { StateMutationEvent } from './types';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type IntegrityStatus =
  | 'INTEGRITY_PASS'
  | 'INTEGRITY_DEGRADED'
  | 'INTEGRITY_FAIL';

export type IntegrityCheckId =
  | 'IC-01'
  | 'IC-02'
  | 'IC-03'
  | 'IC-04'
  | 'IC-05'
  | 'IC-06';

export type IntegrityCheckSeverity = 'INFO' | 'WARN' | 'BLOCKING';

export interface IntegrityCheck {
  readonly id: IntegrityCheckId;
  readonly description: string;
  readonly passed: boolean;
  readonly severity: IntegrityCheckSeverity;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface IntegrityReport {
  readonly status: IntegrityStatus;
  readonly checks: readonly IntegrityCheck[];
  /**
   * IDs of all BLOCKING checks that failed.
   * Non-empty iff status === 'INTEGRITY_FAIL'.
   */
  readonly blockingFailures: readonly IntegrityCheckId[];
  /**
   * Wall-clock ISO8601. System self-audit runs outside governed clock context.
   */
  readonly auditedAt: string;
  readonly corpusEntryCount: number;
  readonly registeredMachineCount: number;
}

/**
 * A machine entry pairing the live StateMachine instance with its config
 * for static transition analysis. Callers supply this — the checker does not
 * look up configs from a registry.
 */
export interface RegisteredMachineEntry {
  readonly machine: StateMachine;
  readonly config: StateMachineConfig;
}

// ─── INDIVIDUAL AUDIT FUNCTIONS ───────────────────────────────────────────────

/**
 * IC-01: Corpus hash chain continuity.
 *
 * Every entry's prior_entry_hash must equal the preceding entry's entry_hash.
 * A broken chain means an entry was injected, mutated, or deleted outside
 * the governed write path.
 *
 * Severity: BLOCKING — a broken chain means audit trail is untrustworthy.
 */
function auditCorpusHashChain(): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-01';
  const entries = Corpus.getAll();

  if (entries.length === 0) {
    return check(id, 'Corpus hash chain continuity', true, 'BLOCKING', {
      corpusLength: 0,
      note: 'Empty corpus — chain trivially intact.',
    });
  }

  const valid = Corpus.verifyChain();

  if (!valid) {
    // Find the exact break point for diagnostics
    let breakIndex = -1;
    const all = [...entries];
    for (let i = 1; i < all.length; i++) {
      if (all[i].prior_entry_hash !== all[i - 1].entry_hash) {
        breakIndex = i;
        break;
      }
    }

    return check(id, 'Corpus hash chain continuity', false, 'BLOCKING', {
      corpusLength: entries.length,
      breakAtIndex: breakIndex,
      expected: breakIndex > 0 ? entries[breakIndex - 1].entry_hash : null,
      actual: breakIndex >= 0 ? entries[breakIndex].prior_entry_hash : null,
    });
  }

  return check(id, 'Corpus hash chain continuity', true, 'BLOCKING', {
    corpusLength: entries.length,
  });
}

/**
 * IC-02: PRE engine deterministic consistency.
 *
 * Takes up to `sampleSize` corpus entries and runs verifyDeterminism() on each
 * with `deterministicRuns` re-executions. All runs must produce identical hashes.
 *
 * If corpus is empty, this check is advisory (no entries to test against).
 *
 * Severity: BLOCKING — non-determinism is a CLASS_1 failure.
 */
function auditPREDeterminism(
  deterministicRuns: number,
  sampleSize: number
): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-02';
  const entries = Corpus.getAll();

  if (entries.length === 0) {
    return check(
      id,
      'PRE engine deterministic consistency',
      true,
      'INFO',
      { note: 'No corpus entries to verify determinism against.', deterministicRuns }
    );
  }

  const sample = entries.slice(0, Math.min(sampleSize, entries.length));
  const failures: Array<{ corpus_entry_id: string; failure_class: string; reason: string }> = [];

  for (const entry of sample) {
    // Run replay deterministicRuns times and collect results for comparison
    const replayResults: ReplayResult[] = [];
    for (let i = 0; i < deterministicRuns; i++) {
      replayResults.push(replayEntry(entry));
    }
    const result = verifyDeterminism(entry, replayResults);
    if (result.result !== 'MATCH') {
      failures.push({
        corpus_entry_id: entry.corpus_entry_id,
        failure_class: result.failure_class ?? 'UNKNOWN',
        reason: result.reason ?? 'no reason provided',
      });
    }
  }

  if (failures.length > 0) {
    return check(id, 'PRE engine deterministic consistency', false, 'BLOCKING', {
      testedEntries: sample.length,
      deterministicRuns,
      failureCount: failures.length,
      failures,
    });
  }

  return check(id, 'PRE engine deterministic consistency', true, 'BLOCKING', {
    testedEntries: sample.length,
    deterministicRuns,
  });
}

/**
 * IC-03: Replay engine equivalence guarantee.
 *
 * Every corpus entry must replay to produce the same output that was recorded.
 * Takes up to `sampleSize` entries (most recent) and replays each.
 *
 * Severity: BLOCKING — a corpus that cannot replay is an unverifiable audit trail.
 */
function auditReplayEquivalence(sampleSize: number): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-03';
  const entries = Corpus.getAll();

  if (entries.length === 0) {
    return check(
      id,
      'Replay engine equivalence guarantee',
      true,
      'INFO',
      { note: 'No corpus entries to replay.' }
    );
  }

  // Sample from the END of the corpus — most recent entries are highest risk
  const sample = entries.slice(-Math.min(sampleSize, entries.length));
  const divergences: Array<{
    corpus_entry_id: string;
    failure_class: string;
    reason: string;
    diff: unknown[];
  }> = [];

  for (const entry of sample) {
    const replayResult = replayEntry(entry);

    if (replayResult.error) {
      divergences.push({
        corpus_entry_id: entry.corpus_entry_id,
        failure_class: 'CLASS_3_RECONSTRUCTION_FAILURE',
        reason: replayResult.error,
        diff: [],
      });
      continue;
    }

    const verification = verify(entry, replayResult);

    if (verification.result !== 'MATCH') {
      divergences.push({
        corpus_entry_id: entry.corpus_entry_id,
        failure_class: verification.failure_class ?? 'UNKNOWN',
        reason: verification.reason ?? 'unknown',
        diff: verification.diff ?? [],
      });
    }
  }

  if (divergences.length > 0) {
    return check(id, 'Replay engine equivalence guarantee', false, 'BLOCKING', {
      sampledEntries: sample.length,
      divergenceCount: divergences.length,
      divergences,
    });
  }

  return check(id, 'Replay engine equivalence guarantee', true, 'BLOCKING', {
    sampledEntries: sample.length,
  });
}

/**
 * IC-04: State machine mutation history — no forbidden transitions.
 *
 * Walks the getMutations() history of every registered machine and verifies
 * that no StateMutationEvent records a fromState → toState pair that appears
 * in the machine's forbidden rules.
 *
 * Note: The StateMachine itself throws on forbidden transitions, so finding one
 * in the history would mean the history was externally tampered with.
 *
 * Severity: BLOCKING — a forbidden transition in history means the audit log
 * was mutated, or the machine's internal enforcement was bypassed.
 */
function auditStateMachineHistories(
  machines: readonly RegisteredMachineEntry[]
): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-04';

  if (machines.length === 0) {
    return check(
      id,
      'State machine mutation history — no forbidden transitions',
      true,
      'INFO',
      { note: 'No machines registered for audit.' }
    );
  }

  const violations: Array<{
    machineId: string;
    fromState: string;
    toState: string;
    forbiddenReason: string;
    timestamp: string;
  }> = [];

  for (const { machine, config } of machines) {
    const mutations = machine.getMutations();
    for (const event of mutations) {
      // Exclude REJECTED events (they're safe — they document blocked attempts)
      if (event.toState.startsWith('REJECTED(')) continue;

      const violation = findForbiddenViolation(
        event.fromState,
        event.toState,
        config.forbidden
      );

      if (violation !== null) {
        violations.push({
          machineId: machine.id,
          fromState: event.fromState,
          toState: event.toState,
          forbiddenReason: violation.reason,
          timestamp: event.timestamp,
        });
      }
    }
  }

  if (violations.length > 0) {
    return check(
      id,
      'State machine mutation history — no forbidden transitions',
      false,
      'BLOCKING',
      {
        machineCount: machines.length,
        violationCount: violations.length,
        violations,
      }
    );
  }

  return check(
    id,
    'State machine mutation history — no forbidden transitions',
    true,
    'BLOCKING',
    {
      machineCount: machines.length,
      totalMutationsAudited: machines.reduce(
        (sum, m) => sum + m.machine.getMutations().length,
        0
      ),
    }
  );
}

/**
 * IC-05: State machine reachability — every state in the config is reachable
 * from the initial state via legal transitions.
 *
 * Unreachable states in the config may indicate a configuration defect:
 * either a dead state that can never be reached (logic error) or a state
 * that was removed from the graph but not from the forbidden rules.
 *
 * Severity: WARN — not immediately blocking, but indicates a configuration
 * that should be reviewed before production use.
 */
function auditStateMachineReachability(
  machines: readonly RegisteredMachineEntry[]
): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-05';

  if (machines.length === 0) {
    return check(
      id,
      'State machine reachability from initial state',
      true,
      'INFO',
      { note: 'No machines registered for audit.' }
    );
  }

  const unreachable: Array<{ machineId: string; unreachableStates: string[] }> = [];

  for (const { machine, config } of machines) {
    const unreachableStates = findUnreachableStates(config);
    if (unreachableStates.length > 0) {
      unreachable.push({ machineId: machine.id, unreachableStates });
    }
  }

  if (unreachable.length > 0) {
    return check(
      id,
      'State machine reachability from initial state',
      false,
      'WARN',
      {
        machineCount: machines.length,
        machinesWithUnreachableStates: unreachable.length,
        unreachable,
      }
    );
  }

  return check(
    id,
    'State machine reachability from initial state',
    true,
    'WARN',
    { machineCount: machines.length }
  );
}

/**
 * IC-06: Trace store / corpus alignment.
 *
 * Every PRE_RESOLVED trace event in the TraceStore must correspond to an
 * entry in the corpus. An orphaned trace (trace with no corpus entry) means
 * either: the corpus write was skipped (bypassing guardedCorpusAdd), or
 * the trace was injected externally.
 *
 * PRE_FAILED traces are excluded — failures are not required to have corpus entries.
 *
 * Severity: BLOCKING — orphaned traces indicate unrecorded executions.
 */
function auditTraceCorpusAlignment(): IntegrityCheck {
  const id: IntegrityCheckId = 'IC-06';

  const preEvents = TraceStore.getPREEvents();
  const resolvedEvents = preEvents.filter((e) => e.event_type === 'PRE_RESOLVED');

  if (resolvedEvents.length === 0) {
    return check(
      id,
      'Trace store / corpus alignment',
      true,
      'INFO',
      { note: 'No PRE_RESOLVED trace events to cross-reference.' }
    );
  }

  const orphaned: Array<{ trace_id: string; resolution_id: string }> = [];

  for (const event of resolvedEvents) {
    if (!event.corpus_entry_id) {
      // Trace event has no corpus_entry_id — cannot verify alignment
      // This is a configuration omission, not necessarily a bypass
      continue;
    }

    const entry = Corpus.get(event.corpus_entry_id);
    if (!entry) {
      orphaned.push({
        trace_id: event.trace_id,
        resolution_id: event.resolution_id,
      });
    }
  }

  if (orphaned.length > 0) {
    return check(id, 'Trace store / corpus alignment', false, 'BLOCKING', {
      resolvedEventCount: resolvedEvents.length,
      orphanedCount: orphaned.length,
      orphaned,
    });
  }

  return check(id, 'Trace store / corpus alignment', true, 'BLOCKING', {
    resolvedEventCount: resolvedEvents.length,
    corpusLength: Corpus.getAll().length,
  });
}

// ─── ORCHESTRATOR ─────────────────────────────────────────────────────────────

/**
 * checkSystemIntegrity — full system self-audit.
 *
 * Runs all 6 integrity checks and produces a consolidated IntegrityReport.
 * The report status is determined by the worst outcome across all checks:
 *
 *   Any BLOCKING check fails  → INTEGRITY_FAIL
 *   Any WARN check fails      → INTEGRITY_DEGRADED  (only if no BLOCKING failures)
 *   All checks pass           → INTEGRITY_PASS
 *
 * @param machines         Registered machine entries for machine-level audits.
 * @param deterministicRuns Number of re-runs for PRE determinism check (default 5).
 * @param replaySampleSize  Max corpus entries to replay for IC-02 and IC-03 (default 10).
 */
export function checkSystemIntegrity(
  machines: readonly RegisteredMachineEntry[] = [],
  deterministicRuns = 5,
  replaySampleSize = 10
): IntegrityReport {
  const auditedAt = new Date().toISOString();

  const checks: IntegrityCheck[] = [
    auditCorpusHashChain(),                              // IC-01
    auditPREDeterminism(deterministicRuns, replaySampleSize), // IC-02
    auditReplayEquivalence(replaySampleSize),            // IC-03
    auditStateMachineHistories(machines),                // IC-04
    auditStateMachineReachability(machines),             // IC-05
    auditTraceCorpusAlignment(),                         // IC-06
  ];

  const blockingFailures = checks
    .filter((c) => !c.passed && c.severity === 'BLOCKING')
    .map((c) => c.id);

  const warnFailures = checks.filter((c) => !c.passed && c.severity === 'WARN');

  let status: IntegrityStatus;
  if (blockingFailures.length > 0) {
    status = 'INTEGRITY_FAIL';
  } else if (warnFailures.length > 0) {
    status = 'INTEGRITY_DEGRADED';
  } else {
    status = 'INTEGRITY_PASS';
  }

  return Object.freeze({
    status,
    checks: Object.freeze(checks),
    blockingFailures: Object.freeze(blockingFailures),
    auditedAt,
    corpusEntryCount: Corpus.getAll().length,
    registeredMachineCount: machines.length,
  });
}

// ─── INTERNAL UTILITIES ───────────────────────────────────────────────────────

function check(
  id: IntegrityCheckId,
  description: string,
  passed: boolean,
  severity: IntegrityCheckSeverity,
  detail: Record<string, unknown>
): IntegrityCheck {
  return Object.freeze({
    id,
    description,
    passed,
    severity,
    detail: Object.freeze(detail),
  });
}

function findForbiddenViolation(
  fromState: string,
  toState: string,
  forbidden: readonly ForbiddenRule[]
): ForbiddenRule | null {
  return (
    forbidden.find(
      (f) => (f.from === fromState || f.from === 'ANY') && f.to === toState
    ) ?? null
  );
}

/**
 * Compute all states reachable from `config.initial` via BFS through
 * the legal `transitions` table, then return any declared states that
 * are not in that reachable set.
 *
 * "Declared states" = all keys and values that appear in the transitions table.
 */
function findUnreachableStates(config: StateMachineConfig): string[] {
  // Collect all state names that appear anywhere in the transitions table
  const allStates = new Set<string>();
  allStates.add(config.initial);

  for (const [from, tos] of Object.entries(config.transitions)) {
    if (from !== 'ANY') allStates.add(from);
    for (const t of tos) allStates.add(t);
  }

  // BFS from initial state
  const reachable = new Set<string>();
  const queue = [config.initial];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const targets = [
      ...(config.transitions[current] ?? []),
      ...(config.transitions['ANY'] ?? []),
    ];

    for (const t of targets) {
      if (!reachable.has(t)) queue.push(t);
    }
  }

  return Array.from(allStates).filter((s) => !reachable.has(s));
}
