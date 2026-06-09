/**
 * incident-escalation-scenario.ts
 *
 * Constitutional workflow: Incident Escalation
 *
 * Full lifecycle from normal operation through emergency declaration and back:
 *   T0: Normal — schedule plays
 *   T1: WATCHING — anomaly detected, no content change
 *   T2: DECLARED — emergency content activates
 *   T3: CONTAINED — emergency content still active
 *   T4: RESOLVING — operator clears emergency flag, schedule resumes
 *   T5: RESOLVED → POST_INCIDENT → NOMINAL — fully back to normal
 *
 * Documents the weakness: PRE emergency_active is NOT coupled to incident machine state.
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
  guardedResolve,
  guardedTransition,
  guardedCorpusAdd,
  _resetRegistry,
} from '../src/integration-guard-layer';

import { evaluateExecutionPermission } from '../src/execution-policy-orchestrator';
import { checkSystemIntegrity, type RegisteredMachineEntry } from '../src/system-integrity-checker';

import {
  T0, T1, T2, T3, T4, T5,
  INPUT_T0_NORMAL,
  INPUT_T2_EMERGENCY,
  INPUT_T3_CONTAINED,
  INPUT_T4_RESOLVING,
  INPUT_T5_NORMAL,
  EXPECTED_T0,
  EXPECTED_T2,
  EXPECTED_T3,
  EXPECTED_T4,
  EXPECTED_T5,
  OP_MANAGER,
} from './incident-escalation-fixture';

import type { CorpusEntry } from '../src/types';

export interface StepResult {
  readonly step: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface IncidentScenarioResult {
  readonly passed: boolean;
  readonly steps: readonly StepResult[];
  readonly corpusEntryCount: number;
  readonly traceEventCount: number;
  readonly entries: CorpusEntry[];
}

function assert(condition: boolean, stepName: string, detail: string): StepResult {
  if (!condition) throw new Error(`[ABORT] ${stepName}: ${detail}`);
  return { step: stepName, passed: true, detail };
}

function doResolution(
  preMachine: ReturnType<typeof createPREResolutionMachine>,
  input: Parameters<typeof guardedResolve>[0],
  expectedContent: string,
  expectedLevel: number,
  label: string,
  timestamp: string,
  steps: StepResult[]
): CorpusEntry {
  // pre-resolution must be in RESOLVING or RESOLVED/STALE/FAILED → RESOLVING
  const currentState = preMachine.state;
  const needsResolving = currentState !== 'RESOLVING';
  if (needsResolving) {
    const fromResolved = currentState === 'RESOLVED';
    const pr = guardedTransition(preMachine, {
      toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-engine',
      reason: `Re-resolving at ${label}`, governedTimestamp: timestamp,
    });
    assert(pr.ok, `${label} — pre-resolution → RESOLVING`, pr.ok ? 'OK' : pr.failure.message);
  }

  const perm = evaluateExecutionPermission({
    resolutionId: input.resolution_id,
    scopeId:      input.scope_id,
    machineId:    'pre-resolution',
    input,
    machine:      preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash:  null,
    knownPriorOutputHash: null,
  });
  steps.push(assert(perm.granted, `${label} — execution permission GRANTED`, perm.granted ? 'GRANTED' : `${perm.denialCode}: ${perm.denialReason}`));

  const gr = guardedResolve(input, 'pre-resolution');
  if (!gr.ok) throw new Error(`[ABORT] ${label} guard: ${gr.failure.code}: ${gr.failure.message}`);
  const pre = gr.value;
  if (!pre.ok) throw new Error(`[ABORT] ${label} PRE: ${pre.failure.failure_code}: ${pre.failure.message}`);
  const output = pre.output;

  steps.push(assert(
    output.effective_content === expectedContent && output.resolution_level === expectedLevel,
    `${label} — resolution matches expected`,
    `content=${output.effective_content} level=${output.resolution_level}`
  ));

  const trace = TraceStore.findPREByTraceId(output.trace_id);
  if (!trace) throw new Error(`[ABORT] ${label}: trace event missing`);

  const cr = guardedCorpusAdd(input, output, trace);
  if (!cr.ok) throw new Error(`[ABORT] ${label} corpus: ${cr.failure.code}: ${cr.failure.message}`);
  const entry = cr.value;

  const pr2 = guardedTransition(preMachine, {
    toState: 'RESOLVED', authority: 'BACKEND', sourceId: 'pre-engine',
    reason: `${label} resolution complete`, governedTimestamp: timestamp,
  });
  assert(pr2.ok, `${label} — pre-resolution → RESOLVED`, pr2.ok ? 'OK' : pr2.failure.message);

  return entry;
}

export function runIncidentEscalationScenario(): IncidentScenarioResult {
  const steps: StepResult[] = [];
  const entries: CorpusEntry[] = [];

  // ── PHASE 0: RESET ────────────────────────────────────────────────────────
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  // ── PHASE 1: MACHINE CREATION ─────────────────────────────────────────────
  const playerMachine   = createPlayerMachine();
  const preMachine      = createPREResolutionMachine();
  const incidentMachine = createIncidentMachine();
  const sessionMachine  = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(incidentMachine);
  registerMachine(sessionMachine);

  steps.push(assert(
    playerMachine.state === 'INITIALIZING' && incidentMachine.state === 'NOMINAL',
    'P1 — Machines initialised',
    `player=${playerMachine.state} incident=${incidentMachine.state}`
  ));

  // ── PHASE 2: PLAYER STARTUP AT T0 ────────────────────────────────────────
  GovernedClock.set(T0);

  let r = guardedTransition(playerMachine, {
    toState: 'SYNCING', authority: 'BACKEND', sourceId: 'boot',
    reason: 'Player startup', governedTimestamp: T0,
  });
  assert(r.ok, 'P2 — player → SYNCING', r.ok ? 'OK' : r.failure.message);

  r = guardedTransition(playerMachine, {
    toState: 'LIVE', authority: 'BACKEND', sourceId: 'boot',
    reason: 'Sync complete', governedTimestamp: T0,
  });
  assert(r.ok, 'P2 — player → LIVE', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(playerMachine.state === 'LIVE', 'P2 — Player LIVE', `player.state=${playerMachine.state}`));

  // T0: Normal PRE resolution
  GovernedClock.set(T0);
  entries.push(doResolution(preMachine, INPUT_T0_NORMAL, EXPECTED_T0.effective_content, EXPECTED_T0.resolution_level, 'T0-NORMAL', T0, steps));

  // ── PHASE 3: T1 — WATCHING (no content change) ────────────────────────────
  GovernedClock.set(T1);

  r = guardedTransition(incidentMachine, {
    toState: 'WATCHING', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Anomaly detected — entering WATCHING state', governedTimestamp: T1,
  });
  assert(r.ok, 'P3 — incident → WATCHING', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    incidentMachine.state === 'WATCHING',
    'P3 — Incident WATCHING (no PRE resolution — content unchanged)',
    `incident.state=${incidentMachine.state} player.state=${playerMachine.state}`
  ));

  // ── PHASE 4: T2 — DECLARED, Emergency content ────────────────────────────
  GovernedClock.set(T2);

  r = guardedTransition(incidentMachine, {
    toState: 'DECLARED', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident confirmed — declaring emergency', governedTimestamp: T2,
  });
  assert(r.ok, 'P4 — incident → DECLARED', r.ok ? 'OK' : r.failure.message);

  r = guardedTransition(playerMachine, {
    toState: 'INCIDENT', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident declared — player entering INCIDENT state', governedTimestamp: T2,
  });
  assert(r.ok, 'P4 — player → INCIDENT', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    incidentMachine.state === 'DECLARED' && playerMachine.state === 'INCIDENT',
    'P4 — Incident DECLARED, Player INCIDENT',
    `incident=${incidentMachine.state} player=${playerMachine.state}`
  ));

  GovernedClock.set(T2);
  entries.push(doResolution(preMachine, INPUT_T2_EMERGENCY, EXPECTED_T2.effective_content, EXPECTED_T2.resolution_level, 'T2-EMERGENCY', T2, steps));

  // ── PHASE 5: T3 — CONTAINED, emergency still active ──────────────────────
  GovernedClock.set(T3);

  r = guardedTransition(incidentMachine, {
    toState: 'CONTAINED', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident contained — situation stabilised', governedTimestamp: T3,
  });
  assert(r.ok, 'P5 — incident → CONTAINED', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    incidentMachine.state === 'CONTAINED',
    'P5 — Incident CONTAINED (emergency content still active — operator has not cleared flag)',
    `incident=${incidentMachine.state}`
  ));

  GovernedClock.set(T3);
  entries.push(doResolution(preMachine, INPUT_T3_CONTAINED, EXPECTED_T3.effective_content, EXPECTED_T3.resolution_level, 'T3-CONTAINED', T3, steps));

  // ── PHASE 6: T4 — RESOLVING, operator clears emergency ───────────────────
  GovernedClock.set(T4);

  r = guardedTransition(incidentMachine, {
    toState: 'RESOLVING', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident resolving — clearing emergency content', governedTimestamp: T4,
  });
  assert(r.ok, 'P6 — incident → RESOLVING', r.ok ? 'OK' : r.failure.message);

  // Player: INCIDENT → LIVE (legal transition per state machine)
  r = guardedTransition(playerMachine, {
    toState: 'LIVE', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident resolving — player returning to LIVE', governedTimestamp: T4,
  });
  assert(r.ok, 'P6 — player INCIDENT → LIVE', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    incidentMachine.state === 'RESOLVING' && playerMachine.state === 'LIVE',
    'P6 — Incident RESOLVING, Player back to LIVE',
    `incident=${incidentMachine.state} player=${playerMachine.state}`
  ));

  // WEAKNESS NOTE: emergency_active=false is set manually in INPUT_T4_RESOLVING.
  // The incident machine state reaching RESOLVING does NOT automatically clear
  // emergency_active in the PRE engine. This is an architectural gap.
  GovernedClock.set(T4);
  entries.push(doResolution(preMachine, INPUT_T4_RESOLVING, EXPECTED_T4.effective_content, EXPECTED_T4.resolution_level, 'T4-RESOLVING', T4, steps));

  // ── PHASE 7: T5 — RESOLVED → POST_INCIDENT → NOMINAL ────────────────────
  GovernedClock.set(T5);

  r = guardedTransition(incidentMachine, {
    toState: 'RESOLVED', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Incident fully resolved', governedTimestamp: T5,
  });
  assert(r.ok, 'P7 — incident → RESOLVED', r.ok ? 'OK' : r.failure.message);

  r = guardedTransition(incidentMachine, {
    toState: 'POST_INCIDENT', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Entering post-incident review', governedTimestamp: T5,
  });
  assert(r.ok, 'P7 — incident → POST_INCIDENT', r.ok ? 'OK' : r.failure.message);

  r = guardedTransition(incidentMachine, {
    toState: 'NOMINAL', authority: 'OPERATOR', sourceId: OP_MANAGER,
    reason: 'Post-incident review complete — returning to NOMINAL', governedTimestamp: T5,
  });
  assert(r.ok, 'P7 — incident → NOMINAL', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    incidentMachine.state === 'NOMINAL',
    'P7 — Incident machine returned to NOMINAL',
    `incident.state=${incidentMachine.state}`
  ));

  GovernedClock.set(T5);
  entries.push(doResolution(preMachine, INPUT_T5_NORMAL, EXPECTED_T5.effective_content, EXPECTED_T5.resolution_level, 'T5-NORMAL', T5, steps));

  // ── PHASE 8: REPLAY ALL ENTRIES ───────────────────────────────────────────
  const timestamps = [T0, T2, T3, T4, T5];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T5);
    const vr = verify(entry, replay);
    steps.push(assert(
      vr.result === 'MATCH',
      `P8 — Entry ${entry.corpus_entry_id} replay MATCH`,
      `result=${vr.result}`
    ));
  }

  // ── PHASE 9: SYSTEM INTEGRITY ─────────────────────────────────────────────
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine,   config: PLAYER_CONFIG },
    { machine: preMachine,      config: PRE_RESOLUTION_CONFIG },
    { machine: incidentMachine, config: INCIDENT_CONFIG },
    { machine: sessionMachine,  config: OPERATOR_SESSION_CONFIG },
  ];
  const report = checkSystemIntegrity(machineEntries, 3, 5);
  steps.push(assert(
    report.status !== 'INTEGRITY_FAIL',
    'P9 — System integrity check',
    `status=${report.status} corpus=${report.corpusEntryCount}`
  ));

  return { passed: true, steps, corpusEntryCount: Corpus.getAll().length, traceEventCount: TraceStore.size(), entries };
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  INCIDENT ESCALATION — CONSTITUTIONAL WORKFLOW');
  console.log('══════════════════════════════════════════════════════════════\n');
  try {
    const result = runIncidentEscalationScenario();
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
