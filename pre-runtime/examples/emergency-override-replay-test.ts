/**
 * emergency-override-replay-test.ts
 *
 * Deployment-blocking test suite for the Emergency Content Override scenario.
 *
 * Every failure maps to an existing CLASS_1–CLASS_5 failure taxonomy:
 *   CLASS_1  DETERMINISM_FAILURE      — same input produces different output on re-run
 *   CLASS_2  CORPUS_DIVERGENCE        — replay output_hash differs from stored corpus record
 *   CLASS_3  RECONSTRUCTION_FAILURE   — replay fails to produce any output at all
 *   CLASS_4  PARITY_VIOLATION         — output hashes match but resolution paths differ
 *   CLASS_5  APPROXIMATION_UNDISCLOSED — n/a (frontend concern; included for completeness)
 *
 * Exit codes:
 *   0 — all tests passed (safe to deploy)
 *   1 — one or more tests failed (DEPLOYMENT BLOCKED)
 *
 * This test file has no external dependencies and no test framework.
 * It is self-contained and executable with: ts-node emergency-override-replay-test.ts
 */

import {
  GovernedClock,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  verifyDeterminism,
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
} from './emergency-override-fixture';

import type { CorpusEntry, VerificationResult, FailureClass } from '../src/index';
import type { ReplayResult } from '../src/index';

// ─── TEST INFRASTRUCTURE ─────────────────────────────────────────────────────

interface TestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly failureClass: FailureClass | null;
  readonly detail: string;
}

const _results: TestResult[] = [];

function test(
  name: string,
  fn: () => { passed: boolean; failureClass: FailureClass | null; detail: string }
): void {
  try {
    const r = fn();
    _results.push({ name, ...r });
  } catch (err: unknown) {
    _results.push({
      name,
      passed: false,
      failureClass: 'CLASS_3_RECONSTRUCTION_FAILURE',
      detail: `Test threw: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

function pass(detail: string): { passed: true; failureClass: null; detail: string } {
  return { passed: true, failureClass: null, detail };
}

function fail(
  failureClass: FailureClass,
  detail: string
): { passed: false; failureClass: FailureClass; detail: string } {
  return { passed: false, failureClass, detail };
}

// ─── SCENARIO SETUP ──────────────────────────────────────────────────────────
//
// Bootstraps the complete scenario state so the tests have real corpus entries.
// This is NOT the scenario test — it is prerequisite setup.

function bootstrapScenario(): { normalEntry: CorpusEntry; emergencyEntry: CorpusEntry } {
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  const playerMachine = createPlayerMachine();
  const preMachine = createPREResolutionMachine();
  const incidentMachine = createIncidentMachine();
  const operatorSessionMachine = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(incidentMachine);
  registerMachine(operatorSessionMachine);

  // T0: Player startup
  GovernedClock.set(T0_NORMAL);
  guardedTransition(playerMachine, { toState: 'SYNCING',  authority: 'BACKEND', sourceId: 'system', reason: 'Startup',       governedTimestamp: T0_NORMAL });
  guardedTransition(playerMachine, { toState: 'LIVE',     authority: 'BACKEND', sourceId: 'system', reason: 'Sync complete', governedTimestamp: T0_NORMAL });

  // T0: Normal PRE resolution
  guardedTransition(preMachine, { toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-resolver', reason: 'Normal resolution', governedTimestamp: T0_NORMAL });
  const normalR = guardedResolve(NORMAL_INPUT, 'pre-resolution');
  if (!normalR.ok) throw new Error(`Setup failed: normal resolve guard: ${normalR.failure.code}`);
  const _normalPRE = normalR.value;
  if (!_normalPRE.ok) throw new Error(`Setup failed: normal PRE engine: ${_normalPRE.failure.failure_code}`);
  const normalTrace = TraceStore.findPREByTraceId(_normalPRE.output.trace_id)!;
  const normalCorpus = guardedCorpusAdd(NORMAL_INPUT, _normalPRE.output, normalTrace);
  if (!normalCorpus.ok) throw new Error(`Setup failed: normal corpus add: ${normalCorpus.failure.code}`);
  guardedTransition(preMachine, { toState: 'RESOLVED', authority: 'BACKEND', sourceId: 'pre-resolver', reason: 'Normal complete', governedTimestamp: T0_NORMAL });

  // T1: Emergency
  GovernedClock.set(T1_EMERGENCY);
  guardedTransition(incidentMachine,        { toState: 'WATCHING',       authority: 'BACKEND',  sourceId: 'monitor',     reason: 'Anomaly',          governedTimestamp: T1_EMERGENCY });
  guardedTransition(incidentMachine,        { toState: 'DECLARED',       authority: 'OPERATOR', sourceId: 'op-001',      reason: 'Declared',         governedTimestamp: T1_EMERGENCY });
  guardedTransition(playerMachine,          { toState: 'INCIDENT',       authority: 'BACKEND',  sourceId: 'system',      reason: 'Incident',         governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'AUTHENTICATING', authority: 'OPERATOR', sourceId: 'op-001',      reason: 'Login',            governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'AUTHENTICATED',  authority: 'OPERATOR', sourceId: 'op-001',      reason: 'Auth OK',          governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'ELEVATED',       authority: 'OPERATOR', sourceId: 'op-001',      reason: 'Elevated',         governedTimestamp: T1_EMERGENCY });
  guardedTransition(preMachine,             { toState: 'RESOLVING',      authority: 'OPERATOR', sourceId: 'op-001',      reason: 'Emergency resolve',governedTimestamp: T1_EMERGENCY });

  const emergencyR = guardedResolve(EMERGENCY_INPUT, 'pre-resolution');
  if (!emergencyR.ok) throw new Error(`Setup failed: emergency resolve guard: ${emergencyR.failure.code}`);
  const _emergencyPRE = emergencyR.value;
  if (!_emergencyPRE.ok) throw new Error(`Setup failed: emergency PRE engine: ${_emergencyPRE.failure.failure_code}`);
  const emergencyTrace = TraceStore.findPREByTraceId(_emergencyPRE.output.trace_id)!;
  const emergencyCorpus = guardedCorpusAdd(EMERGENCY_INPUT, _emergencyPRE.output, emergencyTrace);
  if (!emergencyCorpus.ok) throw new Error(`Setup failed: emergency corpus add: ${emergencyCorpus.failure.code}`);
  guardedTransition(preMachine, { toState: 'RESOLVED', authority: 'OPERATOR', sourceId: 'op-001', reason: 'Emergency complete', governedTimestamp: T1_EMERGENCY });

  return {
    normalEntry: normalCorpus.value,
    emergencyEntry: emergencyCorpus.value,
  };
}

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

function runTests(): void {
  const { normalEntry, emergencyEntry } = bootstrapScenario();

  // ── T-01: Normal entry replay — output_hash match (CLASS_2 guard) ─────────
  test('T-01 Normal entry replay hash match', () => {
    GovernedClock.set(T0_NORMAL);
    const replayResult: ReplayResult = replayEntry(normalEntry);
    GovernedClock.set(T1_EMERGENCY);

    if (replayResult.replayed_output === null) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `replayEntry returned null output. Error: ${replayResult.error ?? 'unknown'}`);
    }

    if (replayResult.replayed_output.output_hash !== normalEntry.output.output_hash) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `output_hash mismatch. ` +
        `expected=${normalEntry.output.output_hash.slice(0,16)}... ` +
        `actual=${replayResult.replayed_output.output_hash.slice(0,16)}...`);
    }

    return pass(`output_hash=${normalEntry.output.output_hash.slice(0,16)}... MATCH`);
  });

  // ── T-02: Emergency entry replay — output_hash match (CLASS_2 guard) ──────
  test('T-02 Emergency entry replay hash match', () => {
    GovernedClock.set(T1_EMERGENCY);
    const replayResult: ReplayResult = replayEntry(emergencyEntry);
    GovernedClock.set(T1_EMERGENCY);

    if (replayResult.replayed_output === null) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `replayEntry returned null output. Error: ${replayResult.error ?? 'unknown'}`);
    }

    if (replayResult.replayed_output.output_hash !== emergencyEntry.output.output_hash) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `output_hash mismatch. ` +
        `expected=${emergencyEntry.output.output_hash.slice(0,16)}... ` +
        `actual=${replayResult.replayed_output.output_hash.slice(0,16)}...`);
    }

    return pass(`output_hash=${emergencyEntry.output.output_hash.slice(0,16)}... MATCH`);
  });

  // ── T-03: Normal entry replay — full output field match (CLASS_4 guard) ───
  test('T-03 Normal replay output field match (parity)', () => {
    GovernedClock.set(T0_NORMAL);
    const replayResult: ReplayResult = replayEntry(normalEntry);
    GovernedClock.set(T1_EMERGENCY);

    const v: VerificationResult = verify(normalEntry, replayResult);

    if (v.result !== 'MATCH') {
      const fc = v.failure_class ?? 'UNKNOWN';
      const diff = v.diff?.map(d => `${d.field}: ${String(d.original)} → ${String(d.replayed)}`).join(', ');
      return fail(v.failure_class ?? 'CLASS_4_PARITY_VIOLATION',
        `verify() returned ${v.result}. class=${fc}. diff=[${diff ?? 'none'}]. reason=${v.reason ?? 'none'}`);
    }

    return pass(`verify()=MATCH effective_content=${normalEntry.output.effective_content}`);
  });

  // ── T-04: Emergency replay — full output field match (CLASS_4 guard) ──────
  test('T-04 Emergency replay output field match (parity)', () => {
    GovernedClock.set(T1_EMERGENCY);
    const replayResult: ReplayResult = replayEntry(emergencyEntry);
    GovernedClock.set(T1_EMERGENCY);

    const v: VerificationResult = verify(emergencyEntry, replayResult);

    if (v.result !== 'MATCH') {
      const fc = v.failure_class ?? 'UNKNOWN';
      return fail(v.failure_class ?? 'CLASS_4_PARITY_VIOLATION',
        `verify() returned ${v.result}. class=${fc}. reason=${v.reason ?? 'none'}`);
    }

    return pass(`verify()=MATCH effective_content=${emergencyEntry.output.effective_content}`);
  });

  // ── T-05: Normal entry — determinism (3 independent runs, CLASS_1 guard) ──
  test('T-05 Normal entry 3-run determinism', () => {
    const runs: ReplayResult[] = [];
    for (let i = 0; i < 3; i++) {
      GovernedClock.set(T0_NORMAL);
      runs.push(replayEntry(normalEntry));
    }
    GovernedClock.set(T1_EMERGENCY);

    const v = verifyDeterminism(normalEntry, runs);

    if (v.result !== 'MATCH') {
      return fail('CLASS_1_DETERMINISM_FAILURE',
        `verifyDeterminism() returned ${v.result} after 3 runs. reason=${v.reason ?? 'none'}`);
    }

    const hashes = runs.map(r => r.replayed_output?.output_hash?.slice(0,8) ?? 'null');
    return pass(`3/3 runs identical. hashes=[${hashes.join(', ')}...]`);
  });

  // ── T-06: Emergency entry — determinism (3 independent runs, CLASS_1 guard)
  test('T-06 Emergency entry 3-run determinism', () => {
    const runs: ReplayResult[] = [];
    for (let i = 0; i < 3; i++) {
      GovernedClock.set(T1_EMERGENCY);
      runs.push(replayEntry(emergencyEntry));
    }
    GovernedClock.set(T1_EMERGENCY);

    const v = verifyDeterminism(emergencyEntry, runs);

    if (v.result !== 'MATCH') {
      return fail('CLASS_1_DETERMINISM_FAILURE',
        `verifyDeterminism() returned ${v.result} after 3 runs. reason=${v.reason ?? 'none'}`);
    }

    const hashes = runs.map(r => r.replayed_output?.output_hash?.slice(0,8) ?? 'null');
    return pass(`3/3 runs identical. hashes=[${hashes.join(', ')}...]`);
  });

  // ── T-07: Trace parity — trace events exist for both corpus entries ────────
  test('T-07 Trace store parity', () => {
    const preEvents = TraceStore.getPREEvents();
    const resolvedEvents = preEvents.filter(e => e.event_type === 'PRE_RESOLVED');

    // During replay, replayEntry() internally calls resolve() which emits more
    // trace events. Minimum: 2 live + however many replay runs.
    if (resolvedEvents.length < 2) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `TraceStore contains only ${resolvedEvents.length} PRE_RESOLVED events. Expected >= 2.`);
    }

    // Verify the two live corpus entries have trace events that match corpus
    const normalTraceInStore = TraceStore.findPREByTraceId(normalEntry.output.trace_id);
    const emergencyTraceInStore = TraceStore.findPREByTraceId(emergencyEntry.output.trace_id);

    if (!normalTraceInStore) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `No trace event found for normal entry trace_id=${normalEntry.output.trace_id.slice(0,16)}...`);
    }

    if (!emergencyTraceInStore) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `No trace event found for emergency entry trace_id=${emergencyEntry.output.trace_id.slice(0,16)}...`);
    }

    if (normalTraceInStore.output_hash !== normalEntry.output.output_hash) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `Normal trace output_hash differs from corpus entry output_hash`);
    }

    if (emergencyTraceInStore.output_hash !== emergencyEntry.output.output_hash) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `Emergency trace output_hash differs from corpus entry output_hash`);
    }

    return pass(
      `${resolvedEvents.length} PRE_RESOLVED events total. ` +
      `Normal trace_id=${normalEntry.output.trace_id.slice(0,16)}... MATCH. ` +
      `Emergency trace_id=${emergencyEntry.output.trace_id.slice(0,16)}... MATCH.`
    );
  });

  // ── T-08: Corpus chain validity ────────────────────────────────────────────
  test('T-08 Corpus hash chain validity', () => {
    const valid = Corpus.verifyChain();
    const entries = Corpus.getAll();

    if (!valid) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `Corpus.verifyChain() returned false. ` +
        `Chain is broken at some point in ${entries.length} entries.`);
    }

    if (entries.length !== 2) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `Expected 2 corpus entries, found ${entries.length}.`);
    }

    // Verify chain link is correct
    if (entries[1].prior_entry_hash !== entries[0].entry_hash) {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `Entry[1].prior_entry_hash does not match Entry[0].entry_hash. Chain link broken.`);
    }

    return pass(
      `2-entry chain intact. ` +
      `entry[0].hash=${entries[0].entry_hash.slice(0,16)}... ` +
      `entry[1].prior=${entries[1].prior_entry_hash?.slice(0,16)}... MATCH`
    );
  });

  // ── T-09: State machine parity — final states correct ──────────────────────
  test('T-09 State machine parity', () => {
    // After the scenario, machines should be in their expected terminal states.
    // We verify by checking the last mutation event in TraceStore for each machine.
    const stateEvents = TraceStore.getStateEvents();

    const lastFor = (id: string) =>
      [...stateEvents].reverse().find(e => e.machineId === id);

    const lastPlayer = lastFor('player');
    const lastPre = lastFor('pre-resolution');
    const lastIncident = lastFor('incident');
    const lastSession = lastFor('operator-session');

    const failures: string[] = [];

    if (!lastPlayer || lastPlayer.toState !== 'INCIDENT') {
      failures.push(`player: expected INCIDENT, got ${lastPlayer?.toState ?? 'NO_EVENTS'}`);
    }
    if (!lastPre || lastPre.toState !== 'RESOLVED') {
      failures.push(`pre-resolution: expected RESOLVED, got ${lastPre?.toState ?? 'NO_EVENTS'}`);
    }
    if (!lastIncident || lastIncident.toState !== 'DECLARED') {
      failures.push(`incident: expected DECLARED, got ${lastIncident?.toState ?? 'NO_EVENTS'}`);
    }
    if (!lastSession || lastSession.toState !== 'ELEVATED') {
      failures.push(`operator-session: expected ELEVATED, got ${lastSession?.toState ?? 'NO_EVENTS'}`);
    }

    if (failures.length > 0) {
      return fail('CLASS_3_RECONSTRUCTION_FAILURE',
        `State machine final states incorrect: ${failures.join('; ')}`);
    }

    return pass(
      `player=INCIDENT pre-resolution=RESOLVED incident=DECLARED operator-session=ELEVATED`
    );
  });

  // ── T-10: System integrity check (deployment gate) ─────────────────────────
  test('T-10 System integrity check — INTEGRITY_PASS or INTEGRITY_DEGRADED only', () => {
    const playerMachine     = createPlayerMachine();
    const preMachine2       = createPREResolutionMachine();
    const incidentMachine   = createIncidentMachine();
    const opSessionMachine  = createOperatorSessionMachine();

    // The integrity checker audits corpus + trace independently of machine instances.
    // Machine instances are provided for static config analysis only.
    const machineEntries: RegisteredMachineEntry[] = [
      { machine: playerMachine,    config: PLAYER_CONFIG           },
      { machine: preMachine2,      config: PRE_RESOLUTION_CONFIG   },
      { machine: incidentMachine,  config: INCIDENT_CONFIG         },
      { machine: opSessionMachine, config: OPERATOR_SESSION_CONFIG },
    ];

    const report = checkSystemIntegrity(machineEntries, 3, 2);

    if (report.status === 'INTEGRITY_FAIL') {
      return fail('CLASS_2_CORPUS_DIVERGENCE',
        `INTEGRITY_FAIL. Blocking failures: [${report.blockingFailures.join(', ')}]. ` +
        `Failed checks: ${report.checks.filter(c => !c.passed).map(c => `${c.id}(${c.severity})`).join(', ')}`);
    }

    const failedChecks = report.checks.filter(c => !c.passed);
    return pass(
      `status=${report.status} ` +
      `checks=${report.checks.length}/passed=${report.checks.filter(c => c.passed).length} ` +
      `failed_checks=${failedChecks.map(c => c.id).join(', ') || 'none'}`
    );
  });
}

// ─── REPORTER ────────────────────────────────────────────────────────────────

function report(): void {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  EMERGENCY OVERRIDE — REPLAY TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════\n');

  const passed = _results.filter(r => r.passed);
  const failed = _results.filter(r => !r.passed);

  for (const r of _results) {
    const icon = r.passed ? '✓' : '✗';
    const fc = r.failureClass ? ` [${r.failureClass}]` : '';
    console.log(`  ${icon}  ${r.name}${fc}`);
    console.log(`       ${r.detail}`);
  }

  console.log(`\n  Results: ${passed.length}/${_results.length} passed`);

  if (failed.length > 0) {
    console.log('\n  FAILED TESTS:');
    for (const r of failed) {
      console.log(`    ✗  ${r.name}`);
      console.log(`       Failure class: ${r.failureClass ?? 'UNCLASSIFIED'}`);
      console.log(`       ${r.detail}`);
    }
    console.log('\n  ✗ DEPLOYMENT BLOCKED');
  } else {
    console.log('\n  ✓ ALL TESTS PASSED — DEPLOYMENT UNBLOCKED');
  }

  console.log('══════════════════════════════════════════════════════════════');
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if (require.main === module) {
  runTests();
  report();
  process.exit(_results.every(r => r.passed) ? 0 : 1);
}

export { runTests, _results };
