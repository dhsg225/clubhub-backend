/**
 * venue-disconnect-replay-test.ts
 *
 * Replay and determinism test suite for Venue Disconnect workflow.
 *
 * Key property: OFFLINE-mode corpus entries replay identically to ONLINE entries,
 * proving offline execution has the same audit properties as online execution.
 *
 * T-01  T0 (online) replay hash match
 * T-02  T1 (degraded) replay hash match
 * T-03  T2 (offline) replay hash match — key: offline = online for audit purposes
 * T-04  T4 (reconciled) replay hash match
 * T-05  All 4 entries verify MATCH
 * T-06  Offline entry (T2) replays identically to online entry (T0) given same non-device inputs
 * T-07  3-run determinism on T2 (offline) entry
 * T-08  device_state is stored in corpus but has no effect on resolution output
 * T-09  Corpus chain valid across 4 entries
 * T-10  System integrity check
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
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
} from '../src/index';

import { _resetRegistry } from '../src/integration-guard-layer';
import { checkSystemIntegrity, type RegisteredMachineEntry } from '../src/system-integrity-checker';
import { runVenueDisconnectScenario } from './venue-disconnect-scenario';
import { T0, T1, T2, T4 } from './venue-disconnect-fixture';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

function test(id: string, name: string, condition: boolean, detail: string): TestResult {
  return { id, name, passed: condition, detail };
}

export function runVenueDisconnectTests(): TestResult[] {
  const results: TestResult[] = [];
  const timestamps = [T0, T1, T2, T4];

  const scenario = runVenueDisconnectScenario();
  const { entries } = scenario;

  // T-01 to T-04: Replay hash match for each entry
  const hashLabels = [
    'T0 (online) replay hash match',
    'T1 (degraded) replay hash match',
    'T2 (offline) replay hash match — offline has same audit properties as online',
    'T4 (reconciled) replay hash match',
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
      `device_state=${entry.input.device_state} hash_match=${replay.replayed_output?.output_hash === entry.output.output_hash}`
    ));
  }

  // T-05: All 4 entries verify MATCH
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
  results.push(test('T-05', 'All 4 entries verify MATCH', allMatch, verifyDetails.join(' | ')));

  // T-06: Offline entry resolves to same content as online entry (same override_stack + schedule)
  // The effective_content and resolution_level must be identical across all device states
  const allSameContent = entries.every(
    (e) => e.output.effective_content === entries[0].output.effective_content &&
           e.output.resolution_level === entries[0].output.resolution_level
  );
  results.push(test(
    'T-06', 'Offline entry resolves identically to online (device_state transparent to PRE)',
    allSameContent,
    `all_content=${entries[0].output.effective_content} device_states=[${entries.map((e) => e.input.device_state).join(',')}]`
  ));

  // T-07: 3-run determinism on T2 (offline) entry
  const offlineEntry = entries[2]; // T2
  GovernedClock.set(T2);
  const r07a = replayEntry(offlineEntry);
  GovernedClock.set(T2);
  const r07b = replayEntry(offlineEntry);
  GovernedClock.set(T2);
  const r07c = replayEntry(offlineEntry);
  GovernedClock.set(T4);
  const det07 = verifyDeterminism(offlineEntry, [r07a, r07b, r07c]);
  results.push(test('T-07', '3-run determinism on T2 (offline) entry', det07.result === 'MATCH', `result=${det07.result}`));

  // T-08: device_state is stored in corpus input but has no effect on resolution output
  // Verify: T0 (ONLINE) and T2 (OFFLINE) produce same effective_content and resolution_level
  const onlineEntry  = entries[0]; // T0 ONLINE
  const offlineEntry2 = entries[2]; // T2 OFFLINE
  results.push(test(
    'T-08', 'device_state stored in corpus but has no effect on resolution output',
    onlineEntry.output.effective_content === offlineEntry2.output.effective_content &&
    onlineEntry.output.resolution_level === offlineEntry2.output.resolution_level &&
    onlineEntry.input.device_state !== offlineEntry2.input.device_state,
    `online_device=${onlineEntry.input.device_state} offline_device=${offlineEntry2.input.device_state} ` +
    `same_content=${onlineEntry.output.effective_content === offlineEntry2.output.effective_content}`
  ));

  // T-09: Corpus chain valid across 4 entries
  results.push(test('T-09', 'Corpus chain valid across 4 entries', Corpus.verifyChain(), `entries=${Corpus.getAll().length} chainValid=${Corpus.verifyChain()}`));

  // T-10: System integrity check
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();
  runVenueDisconnectScenario();
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: createPlayerMachine(),        config: PLAYER_CONFIG },
    { machine: createPREResolutionMachine(), config: PRE_RESOLUTION_CONFIG },
  ];
  const report = checkSystemIntegrity(machineEntries, 3, 5);
  results.push(test('T-10', 'System integrity check', report.status !== 'INTEGRITY_FAIL', `status=${report.status} corpus=${report.corpusEntryCount}`));

  return results;
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  VENUE DISCONNECT — REPLAY TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════\n');
  const results = runVenueDisconnectTests();
  let passed = 0; let failed = 0;
  for (const r of results) {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.passed) passed++; else failed++;
  }
  console.log(`\nResults: ${passed} passed, ${failed} failed (${results.length} total)`);
  process.exit(failed === 0 ? 0 : 1);
}
