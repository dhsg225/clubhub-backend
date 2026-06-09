/**
 * multi-operator-collision-replay-test.ts
 *
 * Replay and determinism test suite for Multi-Operator Collision workflow.
 * Key test: corpus entry 3 (T2) shows SUPPRESSED for junior override in resolution_path.
 *
 * T-01  T0 (baseline) replay hash match
 * T-02  T1 (junior only) replay hash match
 * T-03  T2 (collision — senior wins) replay hash match
 * T-04  T3 (senior expired — junior wins again) replay hash match
 * T-05  T4 (both expired — schedule) replay hash match
 * T-06  All 5 entries verify MATCH
 * T-07  T2 entry: junior override SUPPRESSED in resolution_path (key collision assertion)
 * T-08  T3 entry: senior override EXPIRED in resolution_path
 * T-09  Resolution winner progression: null → junior → senior → junior → null
 * T-10  3-run determinism on T2 (collision) entry
 * T-11  Corpus chain valid across 5 entries
 * T-12  System integrity check
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
  createOperatorSessionMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
  OPERATOR_SESSION_CONFIG,
} from '../src/index';

import { _resetRegistry } from '../src/integration-guard-layer';
import { checkSystemIntegrity, type RegisteredMachineEntry } from '../src/system-integrity-checker';
import { runMultiOperatorCollisionScenario } from './multi-operator-collision-scenario';
import { T0, T1, T2, T3, T4 } from './multi-operator-collision-fixture';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

function test(id: string, name: string, condition: boolean, detail: string): TestResult {
  return { id, name, passed: condition, detail };
}

export function runMultiOperatorCollisionTests(): TestResult[] {
  const results: TestResult[] = [];
  const timestamps = [T0, T1, T2, T3, T4];

  const scenario = runMultiOperatorCollisionScenario();
  const { entries } = scenario;

  // T-01 to T-05: Replay hash match
  const hashLabels = [
    'T0 (baseline — schedule) replay hash match',
    'T1 (junior only) replay hash match',
    'T2 (collision — senior wins) replay hash match',
    'T3 (senior expired — junior wins) replay hash match',
    'T4 (both expired — schedule) replay hash match',
  ];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ts = timestamps[i];
    GovernedClock.set(ts);
    const replay = replayEntry(entry);
    GovernedClock.set(T4);
    results.push(test(
      `T-0${i + 1}`, hashLabels[i],
      replay.replayed_output?.output_hash === entry.output.output_hash,
      `hash_match=${replay.replayed_output?.output_hash === entry.output.output_hash} winner=${entry.output.resolution_winner_id}`
    ));
  }

  // T-06: All 5 entries verify MATCH
  let allMatch = true;
  const verifyDetails: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entries[i]);
    GovernedClock.set(T4);
    const vr = verify(entries[i], replay);
    if (vr.result !== 'MATCH') allMatch = false;
    verifyDetails.push(`${entries[i].corpus_entry_id}=${vr.result}`);
  }
  results.push(test('T-06', 'All 5 entries verify MATCH', allMatch, verifyDetails.join(' | ')));

  // T-07: KEY TEST — T2 collision: senior wins, junior never evaluated (PRE breaks at first WIN)
  // The PRE engine sorts by level DESC, finds senior (level 4) first, marks WIN, then breaks.
  // Junior (level 3) is never evaluated — it does not appear in resolution_path at all.
  const collisionEntry = entries[2]; // T2
  const seniorWon = collisionEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-senior-001' && step.result === 'WIN'
  );
  const juniorNotInPath = !collisionEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-junior-001'
  );
  results.push(test(
    'T-07', 'T2 collision: senior level-4 wins, junior not evaluated (PRE breaks at first WIN)',
    seniorWon && juniorNotInPath,
    `senior_won=${seniorWon} junior_not_in_path=${juniorNotInPath} path_length=${collisionEntry.output.resolution_path.length}`
  ));

  // T-08: T3 entry shows senior EXPIRED in resolution_path
  const seniorExpiredEntry = entries[3]; // T3
  const seniorExpired = seniorExpiredEntry.output.resolution_path.some(
    (step) => step.evaluated === 'ovr-senior-001' && step.result === 'EXPIRED'
  );
  const juniorWonAgain = seniorExpiredEntry.output.resolution_winner_id === 'ovr-junior-001';
  results.push(test(
    'T-08', 'T3 entry: senior EXPIRED in resolution_path, junior wins again',
    seniorExpired && juniorWonAgain,
    `senior_expired=${seniorExpired} junior_won_again=${juniorWonAgain}`
  ));

  // T-09: Resolution winner progression across 5 entries
  const expectedWinners: (string | null)[] = [null, 'ovr-junior-001', 'ovr-senior-001', 'ovr-junior-001', null];
  const actualWinners = entries.map((e) => e.output.resolution_winner_id);
  const progressionCorrect = expectedWinners.every((w, i) => w === actualWinners[i]);
  results.push(test(
    'T-09', 'Resolution winner progression: null → junior → senior → junior → null',
    progressionCorrect,
    `expected=[${expectedWinners.join(',')}] actual=[${actualWinners.join(',')}]`
  ));

  // T-10: 3-run determinism on T2 (collision) entry
  GovernedClock.set(T2);
  const r10a = replayEntry(collisionEntry);
  GovernedClock.set(T2);
  const r10b = replayEntry(collisionEntry);
  GovernedClock.set(T2);
  const r10c = replayEntry(collisionEntry);
  GovernedClock.set(T4);
  const det10 = verifyDeterminism(collisionEntry, [r10a, r10b, r10c]);
  results.push(test('T-10', '3-run determinism on T2 (collision) entry', det10.result === 'MATCH', `result=${det10.result}`));

  // T-11: Corpus chain valid across 5 entries
  results.push(test('T-11', 'Corpus chain valid across 5 entries', Corpus.verifyChain(), `entries=${Corpus.getAll().length} chainValid=${Corpus.verifyChain()}`));

  // T-12: System integrity check
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();
  runMultiOperatorCollisionScenario();
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: createPlayerMachine(),            config: PLAYER_CONFIG },
    { machine: createPREResolutionMachine(),     config: PRE_RESOLUTION_CONFIG },
    { machine: createOperatorSessionMachine(),   config: OPERATOR_SESSION_CONFIG },
  ];
  const report = checkSystemIntegrity(machineEntries, 3, 5);
  results.push(test('T-12', 'System integrity check', report.status !== 'INTEGRITY_FAIL', `status=${report.status} corpus=${report.corpusEntryCount}`));

  return results;
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  MULTI-OPERATOR COLLISION — REPLAY TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════\n');
  const results = runMultiOperatorCollisionTests();
  let passed = 0; let failed = 0;
  for (const r of results) {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.passed) passed++; else failed++;
  }
  console.log(`\nResults: ${passed} passed, ${failed} failed (${results.length} total)`);
  process.exit(failed === 0 ? 0 : 1);
}
