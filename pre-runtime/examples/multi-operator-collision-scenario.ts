/**
 * multi-operator-collision-scenario.ts
 *
 * Constitutional workflow: Multi-Operator Override Collision
 *
 * Two operators submit competing overrides. PRE engine resolves by level (higher wins),
 * with alphabetical ID tiebreak at same level.
 *
 * DEFECT DOCUMENTED: createOperatorSessionMachine() always returns machines with
 * id='operator-session'. Two machines cannot be registered simultaneously.
 * Fix: single operator-session machine models the "active" (senior) session.
 * Junior operator action exists only in override_stack of PREInput.
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
  T0, T1, T2, T3, T4,
  INPUT_T0_BASELINE,
  INPUT_T1_JUNIOR_ONLY,
  INPUT_T2_COLLISION,
  INPUT_T3_SENIOR_EXPIRED,
  INPUT_T4_BOTH_EXPIRED,
  EXPECTED_T0,
  EXPECTED_T1,
  EXPECTED_T2,
  EXPECTED_T3,
  EXPECTED_T4,
  OP_SENIOR,
  OP_JUNIOR,
} from './multi-operator-collision-fixture';

import type { CorpusEntry } from '../src/types';

export interface StepResult {
  readonly step: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface CollisionScenarioResult {
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
  expectedWinnerId: string | null,
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
    output.effective_content === expectedContent &&
    output.resolution_level === expectedLevel &&
    output.resolution_winner_id === expectedWinnerId,
    `${label} — resolution matches expected`,
    `content=${output.effective_content} level=${output.resolution_level} winner=${output.resolution_winner_id}`
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

export function runMultiOperatorCollisionScenario(): CollisionScenarioResult {
  const steps: StepResult[] = [];
  const entries: CorpusEntry[] = [];

  // ── PHASE 0: RESET ────────────────────────────────────────────────────────
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  // ── PHASE 1: MACHINE CREATION ─────────────────────────────────────────────
  const playerMachine  = createPlayerMachine();
  const preMachine     = createPREResolutionMachine();
  // Single session machine — models senior (winning) operator session.
  // DEFECT: createOperatorSessionMachine() id is hardcoded to 'operator-session'.
  // Two machines cannot both be registered. Junior operator action lives in override_stack only.
  const sessionMachine = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(sessionMachine);

  steps.push(assert(
    playerMachine.state === 'INITIALIZING',
    'P1 — Machines initialised (single operator-session machine — see DEFECT note)',
    `player=${playerMachine.state} pre=${preMachine.state} session=${sessionMachine.state}`
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

  // ── PHASE 3: T0 — BASELINE (no overrides) ────────────────────────────────
  GovernedClock.set(T0);
  entries.push(doResolution(preMachine, INPUT_T0_BASELINE, EXPECTED_T0.effective_content, EXPECTED_T0.resolution_level, EXPECTED_T0.resolution_winner_id, 'T0-BASELINE', T0, steps));

  // ── PHASE 4: T1 — JUNIOR OVERRIDE SUBMITTED ──────────────────────────────
  GovernedClock.set(T1);

  // Junior operator action: represented in override_stack of INPUT_T1_JUNIOR_ONLY
  steps.push({
    step: 'P4 — Junior operator submits level-3 override',
    passed: true,
    detail: `${OP_JUNIOR} submits ovr-junior-001 (level 3, content://promo/friday-drinks, expires 21:45)`
  });

  GovernedClock.set(T1);
  entries.push(doResolution(preMachine, INPUT_T1_JUNIOR_ONLY, EXPECTED_T1.effective_content, EXPECTED_T1.resolution_level, EXPECTED_T1.resolution_winner_id, 'T1-JUNIOR-ONLY', T1, steps));

  // ── PHASE 5: T2 — SENIOR OVERRIDE SUBMITTED (COLLISION) ──────────────────
  GovernedClock.set(T2);

  // Senior operator authenticates and elevates session
  let sr = guardedTransition(sessionMachine, {
    toState: 'AUTHENTICATING', authority: 'OPERATOR', sourceId: OP_SENIOR,
    reason: 'Senior manager login — submitting priority override', governedTimestamp: T2,
  });
  assert(sr.ok, 'P5 — session UNAUTHENTICATED → AUTHENTICATING', sr.ok ? 'OK' : sr.failure.message);

  sr = guardedTransition(sessionMachine, {
    toState: 'AUTHENTICATED', authority: 'OPERATOR', sourceId: OP_SENIOR,
    reason: 'Credentials verified', governedTimestamp: T2,
  });
  assert(sr.ok, 'P5 — session AUTHENTICATING → AUTHENTICATED', sr.ok ? 'OK' : sr.failure.message);

  sr = guardedTransition(sessionMachine, {
    toState: 'ELEVATED', authority: 'OPERATOR', sourceId: OP_SENIOR,
    reason: 'Elevated for level-4 override submission', governedTimestamp: T2,
  });
  assert(sr.ok, 'P5 — session AUTHENTICATED → ELEVATED', sr.ok ? 'OK' : sr.failure.message);

  steps.push(assert(
    sessionMachine.state === 'ELEVATED',
    'P5 — Senior operator session ELEVATED (collision authority)',
    `session.state=${sessionMachine.state} — junior session modelled in override_stack only`
  ));

  // Both overrides in stack — senior level 4 wins, junior level 3 SUPPRESSED
  GovernedClock.set(T2);
  entries.push(doResolution(preMachine, INPUT_T2_COLLISION, EXPECTED_T2.effective_content, EXPECTED_T2.resolution_level, EXPECTED_T2.resolution_winner_id, 'T2-COLLISION', T2, steps));

  // Verify collision outcome: senior wins, junior never evaluated (PRE engine breaks at first WIN)
  // The PRE engine sorts by level DESC, finds senior first, adds WIN, then breaks.
  // Junior is never added to resolution_path — it is implicitly suppressed by the early exit.
  const collisionEntry = entries[2];
  const seniorWonInPath = collisionEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-senior-001' && step.result === 'WIN'
  );
  const juniorNotInPath = !collisionEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-junior-001'
  );
  steps.push(assert(
    seniorWonInPath && juniorNotInPath,
    'P5 — Senior wins collision (level 4 > level 3). Junior not in path (PRE breaks at first WIN).',
    `senior_won=${seniorWonInPath} junior_not_in_path=${juniorNotInPath} path=${JSON.stringify(collisionEntry.output.resolution_path.map((s) => ({ id: s.evaluated, result: s.result })))}`
  ));

  // ── PHASE 6: T3 — SENIOR EXPIRED, JUNIOR WINS AGAIN ─────────────────────
  GovernedClock.set(T3);

  // Senior drops back to AUTHENTICATED (elevation not needed — senior is just tracking session)
  sr = guardedTransition(sessionMachine, {
    toState: 'AUTHENTICATED', authority: 'OPERATOR', sourceId: OP_SENIOR,
    reason: 'Senior override expired — dropping elevation', governedTimestamp: T3,
  });
  assert(sr.ok, 'P6 — session ELEVATED → AUTHENTICATED (senior override expired)', sr.ok ? 'OK' : sr.failure.message);

  steps.push({
    step: 'P6 — Senior override expired at 21:34 (between T2=21:32 and T3=21:35)',
    passed: true,
    detail: `ovr-senior-001 expires_at=2026-05-30T21:34:00.000Z — junior override still valid`
  });

  GovernedClock.set(T3);
  entries.push(doResolution(preMachine, INPUT_T3_SENIOR_EXPIRED, EXPECTED_T3.effective_content, EXPECTED_T3.resolution_level, EXPECTED_T3.resolution_winner_id, 'T3-SENIOR-EXPIRED', T3, steps));

  // Verify senior was EXPIRED in resolution_path
  const seniorExpiredEntry = entries[3];
  const seniorExpired = seniorExpiredEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-senior-001' && step.result === 'EXPIRED'
  );
  steps.push(assert(
    seniorExpired,
    'P6 — Senior override EXPIRED in resolution_path, junior now wins',
    `senior_expired=${seniorExpired}`
  ));

  // ── PHASE 7: T4 — BOTH EXPIRED, SCHEDULE RESUMES ─────────────────────────
  GovernedClock.set(T4);

  steps.push({
    step: 'P7 — Both overrides removed from stack at T4',
    passed: true,
    detail: `Operator cleaned up expired overrides. INPUT_T4_BOTH_EXPIRED has empty override_stack.`
  });

  GovernedClock.set(T4);
  entries.push(doResolution(preMachine, INPUT_T4_BOTH_EXPIRED, EXPECTED_T4.effective_content, EXPECTED_T4.resolution_level, EXPECTED_T4.resolution_winner_id, 'T4-SCHEDULE-RESUME', T4, steps));

  // ── PHASE 8: REPLAY ALL 5 ENTRIES ─────────────────────────────────────────
  const timestamps = [T0, T1, T2, T3, T4];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T4);
    const vr = verify(entry, replay);
    steps.push(assert(
      vr.result === 'MATCH',
      `P8 — Entry ${entry.corpus_entry_id} replay MATCH`,
      `result=${vr.result}`
    ));
  }

  // ── PHASE 9: SYSTEM INTEGRITY ─────────────────────────────────────────────
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine,  config: PLAYER_CONFIG },
    { machine: preMachine,     config: PRE_RESOLUTION_CONFIG },
    { machine: sessionMachine, config: OPERATOR_SESSION_CONFIG },
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
  console.log('  MULTI-OPERATOR COLLISION — CONSTITUTIONAL WORKFLOW');
  console.log('══════════════════════════════════════════════════════════════\n');
  try {
    const result = runMultiOperatorCollisionScenario();
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
