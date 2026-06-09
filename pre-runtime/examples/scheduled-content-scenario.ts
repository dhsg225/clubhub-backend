/**
 * scheduled-content-scenario.ts
 *
 * Constitutional workflow: Scheduled Content Change
 *
 * Demonstrates the full lifecycle of a scheduled content transition:
 *   1. Player startup (INITIALIZING → SYNCING → LIVE)
 *   2. Afternoon sports schedule resolves at T0
 *   3. Operator logs in and elevates session (approval authority)
 *   4. Evening music schedule resolves at T2 (old window expired)
 *   5. Both corpus entries replay and verify MATCH
 *   6. System integrity validated
 */

import {
  GovernedClock,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  createPlayerMachine,
  createPREResolutionMachine,
  createOperatorSessionMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
  OPERATOR_SESSION_CONFIG,
} from '../src/index';

import {
  registerMachine,
  guardedResolve,
  guardedTransition,
  guardedCorpusAdd,
  _resetRegistry,
} from '../src/integration-guard-layer';

import { evaluateExecutionPermission } from '../src/execution-policy-orchestrator';
import { checkSystemIntegrity, type RegisteredMachineEntry } from '../src/system-integrity-checker';

import {
  T0, T1, T2,
  INPUT_T0_OLD_SCHEDULE,
  INPUT_T2_NEW_SCHEDULE,
  EXPECTED_OLD,
  EXPECTED_NEW,
} from './scheduled-content-fixture';

import type { CorpusEntry } from '../src/types';

export interface StepResult {
  readonly step: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ScenarioResult {
  readonly passed: boolean;
  readonly steps: readonly StepResult[];
  readonly corpusEntryCount: number;
  readonly traceEventCount: number;
  readonly oldEntry: CorpusEntry;
  readonly newEntry: CorpusEntry;
}

function assert(condition: boolean, stepName: string, detail: string): StepResult {
  if (!condition) throw new Error(`[ABORT] ${stepName}: ${detail}`);
  return { step: stepName, passed: true, detail };
}

export function runScheduledContentScenario(): ScenarioResult {
  const steps: StepResult[] = [];

  // ── PHASE 0: RESET ────────────────────────────────────────────────────────
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  // ── PHASE 1: MACHINE CREATION ─────────────────────────────────────────────
  const playerMachine    = createPlayerMachine();
  const preMachine       = createPREResolutionMachine();
  const sessionMachine   = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(sessionMachine);

  steps.push(assert(
    playerMachine.state === 'INITIALIZING' &&
    preMachine.state === 'UNRESOLVED' &&
    sessionMachine.state === 'UNAUTHENTICATED',
    'P1 — Machines created in correct initial states',
    `player=${playerMachine.state} pre=${preMachine.state} session=${sessionMachine.state}`
  ));

  // ── PHASE 2: PLAYER STARTUP AT T0 ────────────────────────────────────────
  GovernedClock.set(T0);

  let r = guardedTransition(playerMachine, {
    toState: 'SYNCING', authority: 'BACKEND', sourceId: 'boot-sequence',
    reason: 'Player startup', governedTimestamp: T0,
  });
  assert(r.ok, 'P2 — player INITIALIZING → SYNCING', r.ok ? 'OK' : r.failure.message);

  r = guardedTransition(playerMachine, {
    toState: 'LIVE', authority: 'BACKEND', sourceId: 'boot-sequence',
    reason: 'Sync complete, going LIVE', governedTimestamp: T0,
  });
  assert(r.ok, 'P2 — player SYNCING → LIVE', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    playerMachine.state === 'LIVE',
    'P2 — Player reached LIVE',
    `player.state = ${playerMachine.state}`
  ));

  // ── PHASE 3: OLD SCHEDULE RESOLUTION AT T0 ────────────────────────────────

  // pre-resolution: UNRESOLVED → RESOLVING
  let pr = guardedTransition(preMachine, {
    toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-scheduler',
    reason: 'Initiating PRE resolution', governedTimestamp: T0,
  });
  assert(pr.ok, 'P3 — pre-resolution → RESOLVING', pr.ok ? 'OK' : pr.failure.message);

  const permOld = evaluateExecutionPermission({
    resolutionId: INPUT_T0_OLD_SCHEDULE.resolution_id,
    scopeId:      INPUT_T0_OLD_SCHEDULE.scope_id,
    machineId:    'pre-resolution',
    input:        INPUT_T0_OLD_SCHEDULE,
    machine:      preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash:  null,
    knownPriorOutputHash: null,
  });

  steps.push(assert(
    permOld.granted,
    'P3 — Execution permission GRANTED for old schedule',
    permOld.granted ? 'GRANTED' : `Denied: ${permOld.denialCode} — ${permOld.denialReason}`
  ));

  const grOld = guardedResolve(INPUT_T0_OLD_SCHEDULE, 'pre-resolution');
  if (!grOld.ok) throw new Error(`[ABORT] P3 guard: ${grOld.failure.code}: ${grOld.failure.message}`);
  const preOld = grOld.value;
  if (!preOld.ok) throw new Error(`[ABORT] P3 PRE: ${preOld.failure.failure_code}: ${preOld.failure.message}`);
  const outputOld = preOld.output;

  steps.push(assert(
    outputOld.effective_content === EXPECTED_OLD.effective_content &&
    outputOld.resolution_level === EXPECTED_OLD.resolution_level &&
    outputOld.resolution_winner_id === EXPECTED_OLD.resolution_winner_id,
    'P3 — Old schedule resolution matches expectations',
    `content=${outputOld.effective_content} level=${outputOld.resolution_level}`
  ));

  const traceOld = TraceStore.findPREByTraceId(outputOld.trace_id);
  if (!traceOld) throw new Error('[ABORT] P3: trace event missing');

  const crOld = guardedCorpusAdd(INPUT_T0_OLD_SCHEDULE, outputOld, traceOld);
  if (!crOld.ok) throw new Error(`[ABORT] P3 corpus: ${crOld.failure.code}: ${crOld.failure.message}`);
  const oldEntry = crOld.value;

  steps.push(assert(
    oldEntry.corpus_entry_id === 'res-sched-001',
    'P3 — Old schedule corpus entry created',
    `corpus_entry_id=${oldEntry.corpus_entry_id}`
  ));

  // pre-resolution → RESOLVED
  pr = guardedTransition(preMachine, {
    toState: 'RESOLVED', authority: 'BACKEND', sourceId: 'pre-scheduler',
    reason: 'Resolution complete', governedTimestamp: T0,
  });
  assert(pr.ok, 'P3 — pre-resolution → RESOLVED', pr.ok ? 'OK' : pr.failure.message);

  // ── PHASE 4: OPERATOR SESSION (schedule approval authority) ───────────────
  GovernedClock.set(T1);

  let sr = guardedTransition(sessionMachine, {
    toState: 'AUTHENTICATING', authority: 'OPERATOR', sourceId: 'op-002-scheduler',
    reason: 'Operator login for schedule approval', governedTimestamp: T1,
  });
  assert(sr.ok, 'P4 — session UNAUTHENTICATED → AUTHENTICATING', sr.ok ? 'OK' : sr.failure.message);

  sr = guardedTransition(sessionMachine, {
    toState: 'AUTHENTICATED', authority: 'OPERATOR', sourceId: 'op-002-scheduler',
    reason: 'Credentials verified', governedTimestamp: T1,
  });
  assert(sr.ok, 'P4 — session AUTHENTICATING → AUTHENTICATED', sr.ok ? 'OK' : sr.failure.message);

  sr = guardedTransition(sessionMachine, {
    toState: 'ELEVATED', authority: 'OPERATOR', sourceId: 'op-002-scheduler',
    reason: 'Elevated for schedule change approval', governedTimestamp: T1,
  });
  assert(sr.ok, 'P4 — session AUTHENTICATED → ELEVATED', sr.ok ? 'OK' : sr.failure.message);

  steps.push(assert(
    sessionMachine.state === 'ELEVATED',
    'P4 — Operator session ELEVATED (schedule approval authority granted)',
    `session.state = ${sessionMachine.state}`
  ));

  // ── PHASE 5: NEW SCHEDULE RESOLUTION AT T2 ────────────────────────────────
  GovernedClock.set(T2);

  // pre-resolution: RESOLVED → RESOLVING (re-resolution for schedule change)
  pr = guardedTransition(preMachine, {
    toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-scheduler',
    reason: 'Schedule change — re-resolving at T2', governedTimestamp: T2,
  });
  assert(pr.ok, 'P5 — pre-resolution → RESOLVING (schedule change)', pr.ok ? 'OK' : pr.failure.message);

  const permNew = evaluateExecutionPermission({
    resolutionId: INPUT_T2_NEW_SCHEDULE.resolution_id,
    scopeId:      INPUT_T2_NEW_SCHEDULE.scope_id,
    machineId:    'pre-resolution',
    input:        INPUT_T2_NEW_SCHEDULE,
    machine:      preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash:  null,
    knownPriorOutputHash: null,
  });

  steps.push(assert(
    permNew.granted,
    'P5 — Execution permission GRANTED for new schedule',
    permNew.granted ? 'GRANTED' : `Denied: ${permNew.denialCode} — ${permNew.denialReason}`
  ));

  const grNew = guardedResolve(INPUT_T2_NEW_SCHEDULE, 'pre-resolution');
  if (!grNew.ok) throw new Error(`[ABORT] P5 guard: ${grNew.failure.code}: ${grNew.failure.message}`);
  const preNew = grNew.value;
  if (!preNew.ok) throw new Error(`[ABORT] P5 PRE: ${preNew.failure.failure_code}: ${preNew.failure.message}`);
  const outputNew = preNew.output;

  steps.push(assert(
    outputNew.effective_content === EXPECTED_NEW.effective_content &&
    outputNew.resolution_level === EXPECTED_NEW.resolution_level &&
    outputNew.resolution_winner_id === EXPECTED_NEW.resolution_winner_id,
    'P5 — New schedule resolution matches expectations',
    `content=${outputNew.effective_content} level=${outputNew.resolution_level}`
  ));

  const traceNew = TraceStore.findPREByTraceId(outputNew.trace_id);
  if (!traceNew) throw new Error('[ABORT] P5: trace event missing');

  const crNew = guardedCorpusAdd(INPUT_T2_NEW_SCHEDULE, outputNew, traceNew);
  if (!crNew.ok) throw new Error(`[ABORT] P5 corpus: ${crNew.failure.code}: ${crNew.failure.message}`);
  const newEntry = crNew.value;

  steps.push(assert(
    newEntry.corpus_entry_id === 'res-sched-002' &&
    newEntry.prior_entry_hash === oldEntry.entry_hash,
    'P5 — New schedule corpus entry linked to old in chain',
    `corpus_entry_id=${newEntry.corpus_entry_id}`
  ));

  pr = guardedTransition(preMachine, {
    toState: 'RESOLVED', authority: 'BACKEND', sourceId: 'pre-scheduler',
    reason: 'New schedule resolution complete', governedTimestamp: T2,
  });
  assert(pr.ok, 'P5 — pre-resolution → RESOLVED', pr.ok ? 'OK' : pr.failure.message);

  // ── PHASE 6: REPLAY BOTH ENTRIES ─────────────────────────────────────────
  GovernedClock.set(T0);
  const replayOld = replayEntry(oldEntry);
  GovernedClock.set(T2);

  steps.push(assert(
    replayOld.replayed_output?.output_hash === oldEntry.output.output_hash,
    'P6 — Old schedule replay output_hash matches',
    `hash match: ${replayOld.replayed_output?.output_hash === oldEntry.output.output_hash}`
  ));

  GovernedClock.set(T2);
  const replayNew = replayEntry(newEntry);
  GovernedClock.set(T2);

  steps.push(assert(
    replayNew.replayed_output?.output_hash === newEntry.output.output_hash,
    'P6 — New schedule replay output_hash matches',
    `hash match: ${replayNew.replayed_output?.output_hash === newEntry.output.output_hash}`
  ));

  const verifyOld = verify(oldEntry, replayOld);
  const verifyNew = verify(newEntry, replayNew);

  steps.push(assert(verifyOld.result === 'MATCH', 'P6 — Old schedule verification MATCH', verifyOld.result));
  steps.push(assert(verifyNew.result === 'MATCH', 'P6 — New schedule verification MATCH', verifyNew.result));

  // ── PHASE 7: SYSTEM INTEGRITY ─────────────────────────────────────────────
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine,  config: PLAYER_CONFIG          },
    { machine: preMachine,     config: PRE_RESOLUTION_CONFIG  },
    { machine: sessionMachine, config: OPERATOR_SESSION_CONFIG },
  ];

  const report = checkSystemIntegrity(machineEntries, 3, 5);

  steps.push(assert(
    report.status !== 'INTEGRITY_FAIL',
    'P7 — System integrity check',
    `status=${report.status} corpus=${report.corpusEntryCount} machines=${report.registeredMachineCount}`
  ));

  return { passed: true, steps, corpusEntryCount: Corpus.getAll().length, traceEventCount: TraceStore.size(), oldEntry, newEntry };
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  SCHEDULED CONTENT CHANGE — CONSTITUTIONAL WORKFLOW');
  console.log('══════════════════════════════════════════════════════════════\n');
  try {
    const result = runScheduledContentScenario();
    for (const step of result.steps) {
      console.log(`  ${step.passed ? 'PASS' : 'FAIL'}  ${step.step}`);
      console.log(`         ${step.detail}`);
    }
    const failed = result.steps.filter((s) => !s.passed);
    console.log(`\n${failed.length === 0 ? 'ALL STEPS PASSED' : `${failed.length} STEPS FAILED`}`);
    process.exit(failed.length === 0 ? 0 : 1);
  } catch (err: unknown) {
    console.error(`\nSCENARIO ABORTED\n  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
