/**
 * emergency-override-scenario.ts
 *
 * First constitutional proof-of-operation.
 *
 * Executes the complete Emergency Content Override path end-to-end:
 *
 *   Operator Action
 *   → State Machine Transition
 *   → PRE Resolution
 *   → Trace Generation
 *   → Corpus Write
 *   → Replay Reconstruction
 *   → Determinism Verification
 *   → Integrity Validation
 *
 * Uses the integration guard layer, execution policy orchestrator, and
 * system integrity checker throughout. No direct engine calls.
 *
 * Every step either succeeds or throws — no partial success.
 */

import {
  GovernedClock,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  createPlayerMachine,
  createPREResolutionMachine,
  createIncidentMachine,
  createOperatorSessionMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
  INCIDENT_CONFIG,
  OPERATOR_SESSION_CONFIG,
} from '../src/index';

import {
  registerMachine,
  deregisterMachine,
  guardedResolve,
  guardedTransition,
  guardedCorpusAdd,
  _resetRegistry,
} from '../src/integration-guard-layer';

import { evaluateExecutionPermission } from '../src/execution-policy-orchestrator';

import {
  checkSystemIntegrity,
  type RegisteredMachineEntry,
} from '../src/system-integrity-checker';

import {
  NORMAL_INPUT,
  EMERGENCY_INPUT,
  T0_NORMAL,
  T1_EMERGENCY,
  EXPECTED_NORMAL,
  EXPECTED_EMERGENCY,
  TRANSITION_SCRIPT,
  type MachineKey,
} from './emergency-override-fixture';

import type { StateMachine } from '../src/index';

// ─── SCENARIO RESULT TYPES ───────────────────────────────────────────────────

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
}

// ─── ASSERTION HELPER ────────────────────────────────────────────────────────

function assert(condition: boolean, stepName: string, detail: string): StepResult {
  if (!condition) {
    throw new Error(`[SCENARIO ABORT] ${stepName}: ${detail}`);
  }
  return { step: stepName, passed: true, detail };
}

// ─── SCENARIO ────────────────────────────────────────────────────────────────

export function runEmergencyOverrideScenario(): ScenarioResult {
  const steps: StepResult[] = [];

  // ── PHASE 0: CLEAN STATE ──────────────────────────────────────────────────
  //
  // All stores are module-level singletons. Reset between runs to ensure
  // this scenario is isolated and reproducible.
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  // ── PHASE 1: CLOCK INITIALISATION ────────────────────────────────────────

  GovernedClock.set(T0_NORMAL);

  steps.push(assert(
    GovernedClock.now() === T0_NORMAL,
    'P1 — Clock initialised to T0',
    `Governed clock set to ${T0_NORMAL}`
  ));

  // ── PHASE 2: MACHINE CREATION AND REGISTRATION ───────────────────────────

  const playerMachine = createPlayerMachine();
  const preMachine = createPREResolutionMachine();
  const incidentMachine = createIncidentMachine();
  const operatorSessionMachine = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(incidentMachine);
  registerMachine(operatorSessionMachine);

  steps.push(assert(
    playerMachine.state === 'INITIALIZING' &&
    preMachine.state === 'UNRESOLVED' &&
    incidentMachine.state === 'NOMINAL' &&
    operatorSessionMachine.state === 'UNAUTHENTICATED',
    'P2 — All machines created in correct initial states',
    `player=${playerMachine.state} pre=${preMachine.state} incident=${incidentMachine.state} session=${operatorSessionMachine.state}`
  ));

  // Build machine lookup for transition script execution
  const machineMap = new Map<MachineKey, StateMachine>([
    ['player', playerMachine],
    ['pre-resolution', preMachine],
    ['incident', incidentMachine],
    ['operator-session', operatorSessionMachine],
  ]);

  // ── PHASE 3: PLAYER STARTUP (T0 transitions) ──────────────────────────────

  // Execute the first two transitions from the script: player INITIALIZING → SYNCING → LIVE
  const startupTransitions = TRANSITION_SCRIPT.slice(0, 2);
  for (const tx of startupTransitions) {
    const machine = machineMap.get(tx.machineKey)!;
    GovernedClock.set(tx.governedTimestamp);
    const result = guardedTransition(machine, {
      toState: tx.toState,
      authority: tx.authority,
      sourceId: tx.sourceId,
      reason: tx.reason,
      governedTimestamp: tx.governedTimestamp,
    });
    assert(result.ok, `P3 — ${tx.machineKey} → ${tx.toState}`,
      result.ok ? `OK` : `FAILED: ${result.failure.code} ${result.failure.message}`);
  }

  steps.push(assert(
    playerMachine.state === 'LIVE',
    'P3 — Player reached LIVE state',
    `player.state = ${playerMachine.state}`
  ));

  // ── PHASE 4: NORMAL PRE RESOLUTION AT T0 ─────────────────────────────────

  GovernedClock.set(T0_NORMAL);

  // Transition pre-resolution machine to RESOLVING (required by state eligibility gate)
  const preToResolving = TRANSITION_SCRIPT[2]; // pre-resolution → RESOLVING
  {
    const r = guardedTransition(preMachine, {
      toState: preToResolving.toState,
      authority: preToResolving.authority,
      sourceId: preToResolving.sourceId,
      reason: preToResolving.reason,
      governedTimestamp: T0_NORMAL,
    });
    assert(r.ok, 'P4 — pre-resolution machine → RESOLVING', r.ok ? 'OK' : r.failure.message);
  }

  // Evaluate execution permission through orchestrator
  const normalPermission = evaluateExecutionPermission({
    resolutionId: NORMAL_INPUT.resolution_id,
    scopeId: NORMAL_INPUT.scope_id,
    machineId: 'pre-resolution',
    input: NORMAL_INPUT,
    machine: preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash: null,
    knownPriorOutputHash: null,
  });

  steps.push(assert(
    normalPermission.granted,
    'P4 — Execution permission GRANTED for normal resolution',
    normalPermission.granted
      ? `All ${normalPermission.stageResults.length} preflight stages passed`
      : `Denied: ${normalPermission.denialCode} — ${normalPermission.denialReason}`
  ));

  // Execute through guard layer — inline narrowing required for type safety
  const normalGuardResult = guardedResolve(NORMAL_INPUT, 'pre-resolution');
  if (!normalGuardResult.ok) throw new Error(`[ABORT] P4 guard: ${normalGuardResult.failure.code}: ${normalGuardResult.failure.message}`);
  const _normalPRE = normalGuardResult.value;
  if (!_normalPRE.ok) throw new Error(`[ABORT] P4 PRE engine: ${_normalPRE.failure.failure_code}: ${_normalPRE.failure.message}`);
  steps.push({ step: 'P4 — guardedResolve normal content', passed: true, detail: 'OK' });
  const normalOutput = _normalPRE.output;

  // Semantic verification
  steps.push(assert(
    normalOutput.effective_content === EXPECTED_NORMAL.effective_content &&
    normalOutput.resolution_level === EXPECTED_NORMAL.resolution_level &&
    normalOutput.resolution_winner_id === EXPECTED_NORMAL.resolution_winner_id &&
    normalOutput.resolution_path.length === EXPECTED_NORMAL.resolution_path_length,
    'P4 — Normal resolution output matches canonical expectations',
    `content=${normalOutput.effective_content} level=${normalOutput.resolution_level} path_steps=${normalOutput.resolution_path.length}`
  ));

  // Retrieve trace event that was auto-emitted by resolve()
  const normalTraceEvent = TraceStore.findPREByTraceId(normalOutput.trace_id);
  assert(normalTraceEvent !== undefined, 'P4 — Trace event emitted', 'trace_id found in TraceStore');

  steps.push(assert(
    normalTraceEvent!.event_type === 'PRE_RESOLVED' &&
    normalTraceEvent!.corpus_entry_id === NORMAL_INPUT.corpus_entry_id,
    'P4 — Trace event has correct type and corpus_entry_id',
    `event_type=${normalTraceEvent!.event_type} corpus_entry_id=${normalTraceEvent!.corpus_entry_id}`
  ));

  // Write corpus entry through guard layer
  const normalCorpusResult = guardedCorpusAdd(NORMAL_INPUT, normalOutput, normalTraceEvent!);
  if (!normalCorpusResult.ok) throw new Error(`[ABORT] P4 corpus: ${normalCorpusResult.failure.code}: ${normalCorpusResult.failure.message}`);
  steps.push({ step: 'P4 — guardedCorpusAdd normal entry', passed: true, detail: 'OK' });
  const normalEntry = normalCorpusResult.value;

  steps.push(assert(
    normalEntry.corpus_entry_id === NORMAL_INPUT.corpus_entry_id &&
    normalEntry.entry_hash.length === 64, // SHA-256 hex = 64 chars
    'P4 — Corpus entry created with hash chain',
    `corpus_entry_id=${normalEntry.corpus_entry_id} entry_hash=${normalEntry.entry_hash.slice(0, 16)}...`
  ));

  // Advance pre-resolution machine to RESOLVED
  {
    const preToResolved = TRANSITION_SCRIPT[3]; // pre-resolution → RESOLVED
    const r = guardedTransition(preMachine, {
      toState: 'RESOLVED',
      authority: preToResolved.authority,
      sourceId: preToResolved.sourceId,
      reason: preToResolved.reason,
      governedTimestamp: T0_NORMAL,
    });
    assert(r.ok, 'P4 — pre-resolution machine → RESOLVED', r.ok ? 'OK' : r.failure.message);
  }

  // ── PHASE 5: EMERGENCY DECLARED (T1 transitions) ──────────────────────────

  GovernedClock.set(T1_EMERGENCY);

  // Execute incident and player transitions from script
  const emergencyTransitions = TRANSITION_SCRIPT.slice(4, 8); // incident WATCHING, DECLARED; player INCIDENT; session AUTHENTICATING
  for (const tx of emergencyTransitions) {
    const machine = machineMap.get(tx.machineKey)!;
    const result = guardedTransition(machine, {
      toState: tx.toState,
      authority: tx.authority,
      sourceId: tx.sourceId,
      reason: tx.reason,
      governedTimestamp: T1_EMERGENCY,
    });
    assert(result.ok, `P5 — ${tx.machineKey} → ${tx.toState}`,
      result.ok ? 'OK' : `${result.failure.code}: ${result.failure.message}`);
  }

  steps.push(assert(
    incidentMachine.state === 'DECLARED' &&
    playerMachine.state === 'INCIDENT' &&
    operatorSessionMachine.state === 'AUTHENTICATING',
    'P5 — Emergency declared: incident=DECLARED, player=INCIDENT, session=AUTHENTICATING',
    `incident=${incidentMachine.state} player=${playerMachine.state} session=${operatorSessionMachine.state}`
  ));

  // ── PHASE 6: OPERATOR SESSION ELEVATED ────────────────────────────────────

  // Execute session AUTHENTICATED → ELEVATED
  const sessionTransitions = TRANSITION_SCRIPT.slice(8, 10); // AUTHENTICATED, ELEVATED
  for (const tx of sessionTransitions) {
    const r = guardedTransition(operatorSessionMachine, {
      toState: tx.toState,
      authority: tx.authority,
      sourceId: tx.sourceId,
      reason: tx.reason,
      governedTimestamp: T1_EMERGENCY,
    });
    assert(r.ok, `P6 — operator-session → ${tx.toState}`, r.ok ? 'OK' : r.failure.message);
  }

  steps.push(assert(
    operatorSessionMachine.state === 'ELEVATED',
    'P6 — Operator session ELEVATED',
    `session.state = ${operatorSessionMachine.state}`
  ));

  // ── PHASE 7: EMERGENCY PRE RESOLUTION ─────────────────────────────────────

  // Transition pre-resolution machine: RESOLVED → RESOLVING for emergency resolution
  {
    const tx = TRANSITION_SCRIPT[10]; // pre-resolution → RESOLVING
    const r = guardedTransition(preMachine, {
      toState: 'RESOLVING',
      authority: tx.authority,
      sourceId: tx.sourceId,
      reason: tx.reason,
      governedTimestamp: T1_EMERGENCY,
    });
    assert(r.ok, 'P7 — pre-resolution machine → RESOLVING (emergency)', r.ok ? 'OK' : r.failure.message);
  }

  // Evaluate execution permission for emergency resolution
  const emergencyPermission = evaluateExecutionPermission({
    resolutionId: EMERGENCY_INPUT.resolution_id,
    scopeId: EMERGENCY_INPUT.scope_id,
    machineId: 'pre-resolution',
    input: EMERGENCY_INPUT,
    machine: preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash: null,
    knownPriorOutputHash: null,
  });

  steps.push(assert(
    emergencyPermission.granted,
    'P7 — Execution permission GRANTED for emergency resolution',
    emergencyPermission.granted
      ? `All ${emergencyPermission.stageResults.length} preflight stages passed`
      : `Denied: ${emergencyPermission.denialCode} — ${emergencyPermission.denialReason}`
  ));

  // Execute emergency resolution through guard layer
  const emergencyGuardResult = guardedResolve(EMERGENCY_INPUT, 'pre-resolution');
  if (!emergencyGuardResult.ok) throw new Error(`[ABORT] P7 guard: ${emergencyGuardResult.failure.code}: ${emergencyGuardResult.failure.message}`);
  const _emergencyPRE = emergencyGuardResult.value;
  if (!_emergencyPRE.ok) throw new Error(`[ABORT] P7 PRE engine: ${_emergencyPRE.failure.failure_code}: ${_emergencyPRE.failure.message}`);
  steps.push({ step: 'P7 — guardedResolve emergency content', passed: true, detail: 'OK' });
  const emergencyOutput = _emergencyPRE.output;

  // Semantic verification
  steps.push(assert(
    emergencyOutput.effective_content === EXPECTED_EMERGENCY.effective_content &&
    emergencyOutput.resolution_level === EXPECTED_EMERGENCY.resolution_level &&
    emergencyOutput.resolution_winner_id === EXPECTED_EMERGENCY.resolution_winner_id,
    'P7 — Emergency resolution output matches canonical expectations',
    `content=${emergencyOutput.effective_content} level=${emergencyOutput.resolution_level} winner=${emergencyOutput.resolution_winner_id}`
  ));

  // Retrieve trace and write to corpus
  const emergencyTraceEvent = TraceStore.findPREByTraceId(emergencyOutput.trace_id);
  assert(emergencyTraceEvent !== undefined, 'P7 — Emergency trace event emitted', 'trace_id found in TraceStore');

  const emergencyCorpusResult = guardedCorpusAdd(EMERGENCY_INPUT, emergencyOutput, emergencyTraceEvent!);
  if (!emergencyCorpusResult.ok) throw new Error(`[ABORT] P7 corpus: ${emergencyCorpusResult.failure.code}: ${emergencyCorpusResult.failure.message}`);
  steps.push({ step: 'P7 — guardedCorpusAdd emergency entry', passed: true, detail: 'OK' });
  const emergencyEntry = emergencyCorpusResult.value;

  steps.push(assert(
    emergencyEntry.corpus_entry_id === EMERGENCY_INPUT.corpus_entry_id &&
    emergencyEntry.prior_entry_hash === normalEntry.entry_hash, // chain link verified
    'P7 — Emergency corpus entry linked to normal entry in chain',
    `corpus_entry_id=${emergencyEntry.corpus_entry_id} chain_link=${emergencyEntry.prior_entry_hash?.slice(0, 16)}...`
  ));

  // Advance pre-resolution machine to RESOLVED
  {
    const tx = TRANSITION_SCRIPT[11]; // pre-resolution → RESOLVED
    const r = guardedTransition(preMachine, {
      toState: 'RESOLVED',
      authority: tx.authority,
      sourceId: tx.sourceId,
      reason: tx.reason,
      governedTimestamp: T1_EMERGENCY,
    });
    assert(r.ok, 'P7 — pre-resolution machine → RESOLVED (emergency)', r.ok ? 'OK' : r.failure.message);
  }

  // ── PHASE 8: REPLAY RECONSTRUCTION ────────────────────────────────────────
  //
  // Replay both corpus entries. The replay engine freezes GovernedClock to
  // each entry's governed_timestamp. We restore the clock after each replay.

  // Replay normal entry
  GovernedClock.set(T0_NORMAL);
  const normalReplayResult = replayEntry(normalEntry);
  GovernedClock.set(T1_EMERGENCY); // restore after replay

  assert(normalReplayResult.replayed_output !== null, 'P8 — Normal entry replays without error',
    normalReplayResult.error ?? 'OK');

  steps.push(assert(
    normalReplayResult.replayed_output!.output_hash === normalEntry.output.output_hash,
    'P8 — Normal replay output_hash matches corpus record',
    `expected=${normalEntry.output.output_hash.slice(0, 16)}... actual=${normalReplayResult.replayed_output!.output_hash.slice(0, 16)}...`
  ));

  // Replay emergency entry
  GovernedClock.set(T1_EMERGENCY);
  const emergencyReplayResult = replayEntry(emergencyEntry);
  GovernedClock.set(T1_EMERGENCY); // restore after replay

  assert(emergencyReplayResult.replayed_output !== null, 'P8 — Emergency entry replays without error',
    emergencyReplayResult.error ?? 'OK');

  steps.push(assert(
    emergencyReplayResult.replayed_output!.output_hash === emergencyEntry.output.output_hash,
    'P8 — Emergency replay output_hash matches corpus record',
    `expected=${emergencyEntry.output.output_hash.slice(0, 16)}... actual=${emergencyReplayResult.replayed_output!.output_hash.slice(0, 16)}...`
  ));

  // ── PHASE 9: DETERMINISM VERIFICATION ────────────────────────────────────

  const normalVerification = verify(normalEntry, normalReplayResult);
  const emergencyVerification = verify(emergencyEntry, emergencyReplayResult);

  steps.push(assert(
    normalVerification.result === 'MATCH',
    'P9 — Normal entry verification: MATCH',
    normalVerification.result === 'MATCH'
      ? `MATCH — no divergence detected`
      : `DIVERGENCE: ${normalVerification.failure_class} — ${normalVerification.reason}`
  ));

  steps.push(assert(
    emergencyVerification.result === 'MATCH',
    'P9 — Emergency entry verification: MATCH',
    emergencyVerification.result === 'MATCH'
      ? `MATCH — no divergence detected`
      : `DIVERGENCE: ${emergencyVerification.failure_class} — ${emergencyVerification.reason}`
  ));

  // ── PHASE 10: INTEGRITY VALIDATION ────────────────────────────────────────

  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine,          config: PLAYER_CONFIG          },
    { machine: preMachine,             config: PRE_RESOLUTION_CONFIG  },
    { machine: incidentMachine,        config: INCIDENT_CONFIG        },
    { machine: operatorSessionMachine, config: OPERATOR_SESSION_CONFIG },
  ];

  const integrityReport = checkSystemIntegrity(machineEntries, 3, 5);

  steps.push(assert(
    integrityReport.status !== 'INTEGRITY_FAIL',
    'P10 — System integrity check',
    `status=${integrityReport.status} checks=${integrityReport.checks.length} ` +
    `blocking_failures=${integrityReport.blockingFailures.length} ` +
    `corpus=${integrityReport.corpusEntryCount} machines=${integrityReport.registeredMachineCount}`
  ));

  // ── FINAL STATE ASSERTIONS ────────────────────────────────────────────────

  steps.push(assert(
    Corpus.getAll().length === 2,
    'FINAL — Corpus contains exactly 2 entries (normal + emergency)',
    `corpus.length = ${Corpus.getAll().length}`
  ));

  steps.push(assert(
    Corpus.verifyChain(),
    'FINAL — Corpus hash chain is intact',
    'verifyChain() = true'
  ));

  steps.push(assert(
    TraceStore.getPREEvents().length >= 2,
    'FINAL — TraceStore contains at least 2 PRE events (live + replay)',
    `PRE events = ${TraceStore.getPREEvents().length}`
  ));

  return {
    passed: true,
    steps,
    corpusEntryCount: Corpus.getAll().length,
    traceEventCount: TraceStore.size(),
  };
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  EMERGENCY CONTENT OVERRIDE — CONSTITUTIONAL PROOF-OF-OPERATION');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    const result = runEmergencyOverrideScenario();

    console.log(`Steps executed: ${result.steps.length}`);
    console.log(`Corpus entries: ${result.corpusEntryCount}`);
    console.log(`Trace events:   ${result.traceEventCount}\n`);

    for (const step of result.steps) {
      const icon = step.passed ? '✓' : '✗';
      console.log(`  ${icon}  ${step.step}`);
      console.log(`       ${step.detail}`);
    }

    const failed = result.steps.filter((s) => !s.passed);
    console.log(`\n${failed.length === 0 ? '✓ ALL STEPS PASSED' : `✗ ${failed.length} STEPS FAILED`}`);
    console.log('══════════════════════════════════════════════════════════════');

    process.exit(failed.length === 0 ? 0 : 1);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ SCENARIO ABORTED\n  ${message}`);
    process.exit(1);
  }
}
