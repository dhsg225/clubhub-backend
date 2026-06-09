/**
 * incident-escalation-observability-demo.ts
 *
 * Timeline view of content changes through each incident phase.
 * Shows the emergency content lifecycle and the manual emergency flag weakness.
 */

import { GovernedClock, Corpus, TraceStore, replayEntry, verify } from '../src/index';
import { _resetRegistry } from '../src/integration-guard-layer';
import { runIncidentEscalationScenario } from './incident-escalation-scenario';
import { T0, T2, T3, T4, T5, VENUE_SCOPE, OP_MANAGER } from './incident-escalation-fixture';

function line(char = '─', width = 62) { return char.repeat(width); }
function header(title: string) {
  console.log('\n' + line('═'));
  console.log(`  ${title}`);
  console.log(line('═'));
}
function section(title: string) {
  console.log('\n' + line());
  console.log(`  ${title}`);
  console.log(line());
}

export function runDemo(): void {
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  header('INCIDENT ESCALATION — AUDIT TRAIL');
  console.log(`  Venue:    ${VENUE_SCOPE}`);
  console.log(`  Operator: ${OP_MANAGER}`);

  const scenario = runIncidentEscalationScenario();
  const { entries } = scenario;

  section('INCIDENT TIMELINE');

  const phases = [
    { ts: T0, label: 'T0 — Normal operation',         incident: 'NOMINAL',       player: 'LIVE',     idx: 0 },
    { ts: T2, label: 'T2 — Incident DECLARED',        incident: 'DECLARED',      player: 'INCIDENT', idx: 1 },
    { ts: T3, label: 'T3 — Incident CONTAINED',       incident: 'CONTAINED',     player: 'INCIDENT', idx: 2 },
    { ts: T4, label: 'T4 — Incident RESOLVING',       incident: 'RESOLVING',     player: 'LIVE',     idx: 3 },
    { ts: T5, label: 'T5 — Post-incident / NOMINAL',  incident: 'NOMINAL',       player: 'LIVE',     idx: 4 },
  ];

  for (const phase of phases) {
    const entry = entries[phase.idx];
    const isEmergency = entry.output.resolution_level === 6;
    console.log(`\n  [${phase.ts}]`);
    console.log(`    Phase:    ${phase.label}`);
    console.log(`    Incident: ${phase.incident}   Player: ${phase.player}`);
    console.log(`    Content:  ${entry.output.effective_content}`);
    console.log(`    Level:    ${entry.output.resolution_level}${isEmergency ? ' (EMERGENCY — level 6 highest priority)' : ' (schedule — no override)'}`);
    if (isEmergency) {
      console.log(`    Winner:   ${entry.output.resolution_winner_id}`);
    }
  }

  console.log(`\n  [${T1 ?? '2026-05-30T20:05:00.000Z'}]`);
  console.log(`    Phase:    T1 — WATCHING`);
  console.log(`    Incident: WATCHING   Player: LIVE`);
  console.log(`    Content:  (no PRE resolution — anomaly monitoring only, content unchanged)`);

  section('EMERGENCY CONTENT TRANSITIONS');
  console.log(`\n  Normal → Emergency:`);
  console.log(`    T0 content: ${entries[0].output.effective_content} (level 0)`);
  console.log(`    T2 content: ${entries[1].output.effective_content} (level 6)`);
  console.log(`    Transition: incident WATCHING → DECLARED + operator sets emergency_active=true`);
  console.log(`\n  Emergency → Normal (operator manual clearance):`);
  console.log(`    T3 content: ${entries[2].output.effective_content} (level 6, still emergency)`);
  console.log(`    T4 content: ${entries[3].output.effective_content} (level 0, schedule resumed)`);
  console.log(`    Transition: incident CONTAINED → RESOLVING + operator sets emergency_active=false`);

  section('RUNTIME WEAKNESS: MANUAL EMERGENCY CLEARANCE');
  console.log(`\n  WEAKNESS: The PRE engine does NOT automatically detect that the`);
  console.log(`  incident machine has transitioned out of DECLARED/CONTAINED.`);
  console.log(`\n  If an operator forgets to set emergency_active=false when moving`);
  console.log(`  the incident to RESOLVING, EMERGENCY_CONTENT will continue to`);
  console.log(`  display even though the incident machine state says RESOLVING.`);
  console.log(`\n  This gap must be closed at the API layer:`);
  console.log(`    - When incident machine transitions DECLARED → RESOLVING,`);
  console.log(`      the API must set emergency_active=false in the next PREInput.`);
  console.log(`    - This enforcement cannot live in the PRE engine itself because`);
  console.log(`      the PRE engine is pure and has no knowledge of machine state.`);

  section('REPLAY VERIFICATION');

  const timestamps = [T0, T2, T3, T4, T5];
  let allMatch = true;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T5);
    const vr = verify(entry, replay);
    if (vr.result !== 'MATCH') allMatch = false;
    console.log(`\n  [${entry.corpus_entry_id}]`);
    console.log(`    Replay:        ${replay.replayed_output ? 'SUCCESS' : 'FAILED'}`);
    console.log(`    Verification:  ${vr.result}`);
    console.log(`    Hash match:    ${replay.replayed_output?.output_hash === entry.output.output_hash}`);
  }

  section('CORPUS AUDIT');
  console.log(`\n  Total entries:  ${Corpus.getAll().length}`);
  console.log(`  Chain valid:    ${Corpus.verifyChain()}`);
  console.log(`  Trace events:   ${TraceStore.size()}`);

  console.log('\n' + line('═'));
  console.log(`  DEMO COMPLETE — ${allMatch ? 'ALL VERIFICATIONS PASS' : 'VERIFICATION ISSUES DETECTED'}`);
  console.log(line('═') + '\n');
}

const T1 = '2026-05-30T20:05:00.000Z';

if (require.main === module) {
  runDemo();
  process.exit(0);
}
