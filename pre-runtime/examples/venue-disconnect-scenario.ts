/**
 * venue-disconnect-scenario.ts
 *
 * Constitutional workflow: Venue Disconnect
 *
 * Demonstrates offline operation, reconnection, and reconciliation.
 * Documents two architectural weaknesses:
 *   1. PRE engine is blind to device_state — offline resolution = online resolution
 *   2. Player machine has no OFFLINE state — player stays in DEGRADED when physically offline
 */

import {
  GovernedClock,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  createPlayerMachine,
  createPREResolutionMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
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
  T0, T1, T2, T3, T4,
  INPUT_T0_ONLINE,
  INPUT_T1_DEGRADED,
  INPUT_T2_OFFLINE,
  INPUT_T4_RECONCILED,
  EXPECTED_ALL,
} from './venue-disconnect-fixture';

import type { CorpusEntry } from '../src/types';

export interface StepResult {
  readonly step: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface DisconnectScenarioResult {
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
  label: string,
  timestamp: string,
  steps: StepResult[]
): CorpusEntry {
  const currentState = preMachine.state;
  if (currentState !== 'RESOLVING') {
    const pr = guardedTransition(preMachine, {
      toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-engine',
      reason: `Resolving at ${label}`, governedTimestamp: timestamp,
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
  steps.push(assert(perm.granted, `${label} — execution permission GRANTED`, perm.granted ? 'GRANTED' : `${perm.denialCode}`));

  const gr = guardedResolve(input, 'pre-resolution');
  if (!gr.ok) throw new Error(`[ABORT] ${label} guard: ${gr.failure.code}: ${gr.failure.message}`);
  const pre = gr.value;
  if (!pre.ok) throw new Error(`[ABORT] ${label} PRE: ${pre.failure.failure_code}: ${pre.failure.message}`);
  const output = pre.output;

  steps.push(assert(
    output.effective_content === EXPECTED_ALL.effective_content &&
    output.resolution_level === EXPECTED_ALL.resolution_level,
    `${label} — resolution output correct (device_state has no PRE effect)`,
    `content=${output.effective_content} level=${output.resolution_level} device_state=${input.device_state}`
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

export function runVenueDisconnectScenario(): DisconnectScenarioResult {
  const steps: StepResult[] = [];
  const entries: CorpusEntry[] = [];

  // ── PHASE 0: RESET ────────────────────────────────────────────────────────
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  // ── PHASE 1: MACHINE CREATION ─────────────────────────────────────────────
  const playerMachine = createPlayerMachine();
  const preMachine    = createPREResolutionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);

  steps.push(assert(
    playerMachine.state === 'INITIALIZING',
    'P1 — Machines initialised',
    `player=${playerMachine.state} pre=${preMachine.state}`
  ));

  // ── PHASE 2: T0 — ONLINE, NORMAL ─────────────────────────────────────────
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

  GovernedClock.set(T0);
  entries.push(doResolution(preMachine, INPUT_T0_ONLINE, 'T0-ONLINE', T0, steps));

  // ── PHASE 3: T1 — DEGRADED ───────────────────────────────────────────────
  GovernedClock.set(T1);

  r = guardedTransition(playerMachine, {
    toState: 'DEGRADED', authority: 'BACKEND', sourceId: 'connectivity-monitor',
    reason: 'Connectivity dropping — entering DEGRADED', governedTimestamp: T1,
  });
  assert(r.ok, 'P3 — player LIVE → DEGRADED', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    playerMachine.state === 'DEGRADED',
    'P3 — Player DEGRADED (connectivity dropping)',
    `player.state=${playerMachine.state}`
  ));

  GovernedClock.set(T1);
  entries.push(doResolution(preMachine, INPUT_T1_DEGRADED, 'T1-DEGRADED', T1, steps));

  // ── PHASE 4: T2 — OFFLINE ────────────────────────────────────────────────
  // Player machine has no OFFLINE state — player remains DEGRADED.
  // device_state=OFFLINE is recorded in PREInput only.
  GovernedClock.set(T2);

  steps.push(assert(
    playerMachine.state === 'DEGRADED',
    'P4 — Player remains DEGRADED when offline (no OFFLINE state in machine)',
    `player.state=${playerMachine.state} — device_state=OFFLINE recorded in PREInput only`
  ));

  GovernedClock.set(T2);
  entries.push(doResolution(preMachine, INPUT_T2_OFFLINE, 'T2-OFFLINE', T2, steps));

  // ── PHASE 5: T3 — RECONNECTION ────────────────────────────────────────────
  GovernedClock.set(T3);

  r = guardedTransition(playerMachine, {
    toState: 'SYNCING', authority: 'BACKEND', sourceId: 'connectivity-monitor',
    reason: 'Network reconnected — entering SYNCING for reconciliation', governedTimestamp: T3,
  });
  assert(r.ok, 'P5 — player DEGRADED → SYNCING (reconnection)', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    playerMachine.state === 'SYNCING',
    'P5 — Player SYNCING after reconnection',
    `player.state=${playerMachine.state}`
  ));

  // ── PHASE 6: T4 — RECONCILIATION, BACK ONLINE ────────────────────────────
  GovernedClock.set(T4);

  r = guardedTransition(playerMachine, {
    toState: 'LIVE', authority: 'BACKEND', sourceId: 'connectivity-monitor',
    reason: 'Sync complete after reconnection — back LIVE', governedTimestamp: T4,
  });
  assert(r.ok, 'P6 — player SYNCING → LIVE (reconciliation complete)', r.ok ? 'OK' : r.failure.message);

  steps.push(assert(
    playerMachine.state === 'LIVE',
    'P6 — Player back to LIVE after reconciliation',
    `player.state=${playerMachine.state}`
  ));

  GovernedClock.set(T4);
  entries.push(doResolution(preMachine, INPUT_T4_RECONCILED, 'T4-RECONCILED', T4, steps));

  // ── PHASE 7: REPLAY ALL 4 ENTRIES ─────────────────────────────────────────
  const timestamps = [T0, T1, T2, T4];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T4);
    const vr = verify(entry, replay);
    steps.push(assert(
      vr.result === 'MATCH',
      `P7 — Entry ${entry.corpus_entry_id} replay MATCH (device_state=${entry.input.device_state})`,
      `result=${vr.result}`
    ));
  }

  // ── PHASE 8: SYSTEM INTEGRITY ─────────────────────────────────────────────
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine, config: PLAYER_CONFIG },
    { machine: preMachine,    config: PRE_RESOLUTION_CONFIG },
  ];
  const report = checkSystemIntegrity(machineEntries, 3, 5);
  steps.push(assert(
    report.status !== 'INTEGRITY_FAIL',
    'P8 — System integrity check',
    `status=${report.status} corpus=${report.corpusEntryCount}`
  ));

  return { passed: true, steps, corpusEntryCount: Corpus.getAll().length, traceEventCount: TraceStore.size(), entries };
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  VENUE DISCONNECT — CONSTITUTIONAL WORKFLOW');
  console.log('══════════════════════════════════════════════════════════════\n');
  try {
    const result = runVenueDisconnectScenario();
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
