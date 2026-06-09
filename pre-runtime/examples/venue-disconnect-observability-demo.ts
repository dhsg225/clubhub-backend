/**
 * venue-disconnect-observability-demo.ts
 *
 * Connectivity timeline and audit trail for the Venue Disconnect workflow.
 * Shows how offline operation is covered by the same audit record as online.
 */

import { GovernedClock, Corpus, TraceStore, replayEntry, verify } from '../src/index';
import { _resetRegistry } from '../src/integration-guard-layer';
import { runVenueDisconnectScenario } from './venue-disconnect-scenario';
import { T0, T1, T2, T3, T4, VENUE_SCOPE } from './venue-disconnect-fixture';

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

  header('VENUE DISCONNECT — CONNECTIVITY AUDIT TRAIL');
  console.log(`  Venue: ${VENUE_SCOPE}`);

  const scenario = runVenueDisconnectScenario();
  const { entries } = scenario;

  section('CONNECTIVITY TIMELINE');

  const phases = [
    { ts: T0, label: 'T0 — ONLINE',   playerState: 'LIVE',     deviceState: 'ONLINE',   idx: 0 },
    { ts: T1, label: 'T1 — DEGRADED', playerState: 'DEGRADED', deviceState: 'DEGRADED', idx: 1 },
    { ts: T2, label: 'T2 — OFFLINE',  playerState: 'DEGRADED', deviceState: 'OFFLINE',  idx: 2 },
    { ts: T3, label: 'T3 — SYNCING',  playerState: 'SYNCING',  deviceState: 'ONLINE',   idx: -1 },
    { ts: T4, label: 'T4 — ONLINE',   playerState: 'LIVE',     deviceState: 'ONLINE',   idx: 3 },
  ];

  for (const phase of phases) {
    console.log(`\n  [${phase.ts}]`);
    console.log(`    Phase:        ${phase.label}`);
    console.log(`    Player state: ${phase.playerState}`);
    console.log(`    Network:      ${phase.deviceState}`);
    if (phase.idx >= 0) {
      const entry = entries[phase.idx];
      console.log(`    PRE content:  ${entry.output.effective_content}`);
      console.log(`    Resolution:   level ${entry.output.resolution_level} — winner=${entry.output.resolution_winner_id ?? 'schedule'}`);
      console.log(`    Corpus ID:    ${entry.corpus_entry_id}`);
    } else {
      console.log(`    PRE content:  (no resolution — reconnection / sync phase)`);
    }
  }

  section('WEAKNESS 1: PRE ENGINE IS BLIND TO device_state');
  console.log(`\n  All 4 corpus entries resolve to the SAME content regardless of`);
  console.log(`  whether device_state is ONLINE, DEGRADED, or OFFLINE:`);
  for (const entry of entries) {
    console.log(`    ${entry.corpus_entry_id} [${entry.input.device_state.padEnd(8)}] → ${entry.output.effective_content} (level ${entry.output.resolution_level})`);
  }
  console.log(`\n  Consequence: An auditor inspecting only corpus entries cannot`);
  console.log(`  determine whether an entry was produced during offline operation`);
  console.log(`  without reading the input.device_state field explicitly.`);
  console.log(`\n  Mitigation: Observability layer must tag corpus entries with`);
  console.log(`  connectivity status at write time. The PRE engine intentionally`);
  console.log(`  does not do this — it is a pure resolution engine.`);

  section('WEAKNESS 2: PLAYER MACHINE HAS NO OFFLINE STATE');
  console.log(`\n  When the venue is physically offline, the player machine`);
  console.log(`  remains in DEGRADED. There is no 'OFFLINE' state.`);
  console.log(`\n  Player state vs. device_state during disconnect:`);
  console.log(`    T1: player=DEGRADED  device=DEGRADED  (connectivity dropping)`);
  console.log(`    T2: player=DEGRADED  device=OFFLINE   (fully offline — player unchanged)`);
  console.log(`    T3: player=SYNCING   device=ONLINE    (reconnection)`);
  console.log(`\n  These are distinct concepts:`);
  console.log(`    - player state = operational state of the player runtime`);
  console.log(`    - device_state = network/hardware connectivity status`);
  console.log(`  They are not automatically synchronised. Operators must understand`);
  console.log(`  that player=DEGRADED does not imply device=OFFLINE.`);

  section('OFFLINE AUDIT COVERAGE');
  console.log(`\n  Offline operation IS covered by the audit trail:`);
  console.log(`  The corpus entry for T2 (OFFLINE) was produced from the same`);
  console.log(`  governed_timestamp + override_stack as an online resolution.`);
  console.log(`  It can be replayed and verified identically.`);
  console.log(`\n  Replay verification:`);

  const timestamps = [T0, T1, T2, T4];
  let allMatch = true;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T4);
    const vr = verify(entry, replay);
    if (vr.result !== 'MATCH') allMatch = false;
    console.log(`    ${entry.corpus_entry_id} [${entry.input.device_state.padEnd(8)}] replay=${vr.result} hash_match=${replay.replayed_output?.output_hash === entry.output.output_hash}`);
  }

  section('CORPUS AUDIT');
  console.log(`\n  Total entries:  ${Corpus.getAll().length}`);
  console.log(`  Chain valid:    ${Corpus.verifyChain()}`);
  console.log(`  Trace events:   ${TraceStore.size()}`);

  console.log('\n' + line('═'));
  console.log(`  DEMO COMPLETE — ${allMatch ? 'ALL VERIFICATIONS PASS' : 'VERIFICATION ISSUES DETECTED'}`);
  console.log(line('═') + '\n');
}

if (require.main === module) {
  runDemo();
  process.exit(0);
}
