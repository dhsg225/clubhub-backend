/**
 * incident-escalation-replay-test.ts
 *
 * Replay and determinism test suite for Incident Escalation workflow.
 * Covers all 5 corpus entries across the incident lifecycle.
 *
 * T-01  T0 (normal) replay hash match
 * T-02  T2 (emergency) replay hash match
 * T-03  T3 (contained) replay hash match
 * T-04  T4 (resolving) replay hash match
 * T-05  T5 (post-incident) replay hash match
 * T-06  All 5 entries verify MATCH
 * T-07  Emergency entry: content is EMERGENCY_CONTENT at level 6
 * T-08  Normal entries (T0, T4, T5): content is schedule at level 0
 * T-09  3-run determinism on T2 emergency entry
 * T-10  Corpus chain valid across all 5 entries
 * T-11  System integrity check
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

import { _resetRegistry } from '../src/integration-guard-layer';
import { checkSystemIntegrity, type RegisteredMachineEntry } from '../src/system-integrity-checker';
import { runIncidentEscalationScenario } from './incident-escalation-scenario';
import { T0, T2, T3, T4, T5 } from './incident-escalation-fixture';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

function test(id: string, name: string, condition: boolean, detail: string): TestResult {
  return { id, name, passed: condition, detail };
}

export function runIncidentEscalationTests(): TestResult[] {
  const results: TestResult[] = [];
  const timestamps = [T0, T2, T3, T4, T5];

  const scenario = runIncidentEscalationScenario();
  const { entries } = scenario;

  // T-01 through T-05: Replay hash match for each entry
  const hashMatchLabels = [
    'T0 (normal) replay hash match',
    'T2 (emergency) replay hash match',
    'T3 (contained) replay hash match',
    'T4 (resolving) replay hash match',
    'T5 (post-incident) replay hash match',
  ];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ts = timestamps[i];
    GovernedClock.set(ts);
    const replay = replayEntry(entry);
    GovernedClock.set(T5);
    results.push(test(
      `T-0${i + 1}`, hashMatchLabels[i],
      replay.replayed_output?.output_hash === entry.output.output_hash,
      `expected=${entry.output.output_hash.slice(0, 16)}... got=${replay.replayed_output?.output_hash?.slice(0, 16)}...`
    ));
  }

  // T-06: All 5 entries verify MATCH
  let allMatch = true;
  const verifyDetails: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ts = timestamps[i];
    GovernedClock.set(ts);
    const replay = replayEntry(entry);
    GovernedClock.set(T5);
    const vr = verify(entry, replay);
    if (vr.result !== 'MATCH') { allMatch = false; }
    verifyDetails.push(`${entry.corpus_entry_id}=${vr.result}`);
  }
  results.push(test('T-06', 'All 5 entries verify MATCH', allMatch, verifyDetails.join(' | ')));

  // T-07: Emergency entries (T2, T3) have EMERGENCY_CONTENT at level 6
  const emergencyEntries = [entries[1], entries[2]]; // T2, T3
  results.push(test(
    'T-07', 'Emergency entries: EMERGENCY_CONTENT at level 6',
    emergencyEntries.every((e) => e.output.effective_content === 'EMERGENCY_CONTENT' && e.output.resolution_level === 6),
    emergencyEntries.map((e) => `${e.corpus_entry_id}: content=${e.output.effective_content} level=${e.output.resolution_level}`).join(' | ')
  ));

  // T-08: Normal entries (T0, T4, T5) have schedule content at level 0
  const normalEntries = [entries[0], entries[3], entries[4]]; // T0, T4, T5
  results.push(test(
    'T-08', 'Normal entries: schedule content at level 0',
    normalEntries.every((e) => e.output.effective_content === 'content://schedule/evening-music-night' && e.output.resolution_level === 0),
    normalEntries.map((e) => `${e.corpus_entry_id}: level=${e.output.resolution_level}`).join(' | ')
  ));

  // T-09: 3-run determinism on T2 emergency entry
  const emergencyEntry = entries[1]; // T2
  GovernedClock.set(T2);
  const r09a = replayEntry(emergencyEntry);
  GovernedClock.set(T2);
  const r09b = replayEntry(emergencyEntry);
  GovernedClock.set(T2);
  const r09c = replayEntry(emergencyEntry);
  GovernedClock.set(T5);
  const det09 = verifyDeterminism(emergencyEntry, [r09a, r09b, r09c]);
  results.push(test('T-09', '3-run determinism on T2 emergency entry', det09.result === 'MATCH', `result=${det09.result}`));

  // T-10: Corpus chain valid across all 5 entries
  results.push(test('T-10', 'Corpus chain valid across 5 entries', Corpus.verifyChain(), `entries=${Corpus.getAll().length} chainValid=${Corpus.verifyChain()}`));

  // T-11: System integrity check
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();
  runIncidentEscalationScenario();
  const machineEntries: RegisteredMachineEntry[] = [
    { machine: createPlayerMachine(),            config: PLAYER_CONFIG },
    { machine: createPREResolutionMachine(),     config: PRE_RESOLUTION_CONFIG },
    { machine: createIncidentMachine(),          config: INCIDENT_CONFIG },
    { machine: createOperatorSessionMachine(),   config: OPERATOR_SESSION_CONFIG },
  ];
  const report = checkSystemIntegrity(machineEntries, 3, 5);
  results.push(test('T-11', 'System integrity check', report.status !== 'INTEGRITY_FAIL', `status=${report.status} corpus=${report.corpusEntryCount}`));

  return results;
}

if (require.main === module) {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  INCIDENT ESCALATION — REPLAY TEST SUITE');
  console.log('══════════════════════════════════════════════════════════════\n');
  const results = runIncidentEscalationTests();
  let passed = 0; let failed = 0;
  for (const r of results) {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.passed) passed++; else failed++;
  }
  console.log(`\nResults: ${passed} passed, ${failed} failed (${results.length} total)`);
  process.exit(failed === 0 ? 0 : 1);
}
