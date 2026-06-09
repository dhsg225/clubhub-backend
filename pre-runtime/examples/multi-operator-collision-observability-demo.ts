/**
 * multi-operator-collision-observability-demo.ts
 *
 * Collision event display — "who wanted what" and "who won and why".
 * Shows the full override lifecycle from submission through expiry.
 */

import { GovernedClock, Corpus, TraceStore, replayEntry, verify } from '../src/index';
import { _resetRegistry } from '../src/integration-guard-layer';
import { runMultiOperatorCollisionScenario } from './multi-operator-collision-scenario';
import {
  T0, T1, T2, T3, T4,
  VENUE_SCOPE, OP_SENIOR, OP_JUNIOR,
  JUNIOR_OVERRIDE, SENIOR_OVERRIDE,
} from './multi-operator-collision-fixture';

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

  header('MULTI-OPERATOR COLLISION — OVERRIDE AUDIT TRAIL');
  console.log(`  Venue:        ${VENUE_SCOPE}`);
  console.log(`  Senior (L4):  ${OP_SENIOR}`);
  console.log(`  Junior (L3):  ${OP_JUNIOR}`);

  const scenario = runMultiOperatorCollisionScenario();
  const { entries } = scenario;

  section('OVERRIDE SUBMISSIONS');
  console.log(`\n  ${OP_JUNIOR} (level 3):`);
  console.log(`    Override ID:  ${JUNIOR_OVERRIDE.id}`);
  console.log(`    Content:      ${JUNIOR_OVERRIDE.content_ref}`);
  console.log(`    Submitted at: T1=${T1}`);
  console.log(`    Expires at:   ${JUNIOR_OVERRIDE.expires_at}`);

  console.log(`\n  ${OP_SENIOR} (level 4):`);
  console.log(`    Override ID:  ${SENIOR_OVERRIDE.id}`);
  console.log(`    Content:      ${SENIOR_OVERRIDE.content_ref}`);
  console.log(`    Submitted at: T2=${T2}  (COLLISION POINT)`);
  console.log(`    Expires at:   ${SENIOR_OVERRIDE.expires_at}`);

  section('RESOLUTION TIMELINE');

  const phases = [
    { ts: T0, label: 'T0 — Baseline',           idx: 0, note: 'No overrides — schedule wins'               },
    { ts: T1, label: 'T1 — Junior override',     idx: 1, note: 'Junior submits level-3 promo'               },
    { ts: T2, label: 'T2 — COLLISION',           idx: 2, note: 'Senior submits level-4 — COLLISION OCCURS'  },
    { ts: T3, label: 'T3 — Senior expired',      idx: 3, note: 'Senior expires at 21:34 — junior resumes'   },
    { ts: T4, label: 'T4 — Both expired',        idx: 4, note: 'Operator clears stack — schedule resumes'   },
  ];

  for (const phase of phases) {
    const entry = entries[phase.idx];
    console.log(`\n  [${phase.ts}]  ${phase.label}`);
    console.log(`    Note:     ${phase.note}`);
    console.log(`    Content:  ${entry.output.effective_content}`);
    console.log(`    Level:    ${entry.output.resolution_level}`);
    console.log(`    Winner:   ${entry.output.resolution_winner_id ?? '(none — schedule)'}`);

    // Show resolution path for collision entry
    if (phase.idx === 2) {
      console.log(`    Resolution path (PRE breaks at first WIN — junior never evaluated):`);
      for (const step of entry.output.resolution_path) {
        const marker = step.result === 'WIN' ? '[WIN ]' : step.result === 'EXPIRED' ? '[EXP ]' : `[${step.result.slice(0, 4).padEnd(4)}]`;
        console.log(`      ${marker} ${step.evaluated.padEnd(20)} — ${step.reason}`);
      }
      console.log(`      [----] ovr-junior-001          — (not evaluated: PRE exits at first WIN)`);
    }
    if (phase.idx === 3) {
      console.log(`    Resolution path (senior expired):`);
      for (const step of entry.output.resolution_path) {
        const marker = step.result === 'WIN' ? '[WIN ]' : step.result === 'EXPIRED' ? '[EXP ]' : `[${step.result.slice(0, 4).padEnd(4)}]`;
        console.log(`      ${marker} ${step.evaluated.padEnd(20)} — ${step.reason}`);
      }
    }
  }

  section('COLLISION RESOLUTION RULES');
  console.log(`\n  Rule 1: Higher level always wins`);
  console.log(`    Senior (level 4) beats Junior (level 3) at T2.`);
  console.log(`\n  Rule 2: Alphabetical ID tiebreak at same level`);
  console.log(`    If two operators both had level-4 authority, 'ovr-junior-001'`);
  console.log(`    would beat 'ovr-senior-001' because 'j' < 's' alphabetically.`);
  console.log(`    This is DETERMINISTIC but ARBITRARY — last-submitted does NOT win.`);
  console.log(`\n  WEAKNESS: The ID-based tiebreak may surprise operators who assume`);
  console.log(`    temporal precedence ("last submitted wins"). Documentation and`);
  console.log(`    operator training must cover this explicitly.`);

  section('OPERATOR SESSION DEFECT');
  console.log(`\n  DEFECT: createOperatorSessionMachine() always produces machines`);
  console.log(`  with id='operator-session'. Two sessions cannot be registered`);
  console.log(`  simultaneously in the guard layer registry.`);
  console.log(`\n  This workflow models the collision correctly at the OVERRIDE STACK`);
  console.log(`  level. The single session machine represents the senior (winning)`);
  console.log(`  operator. The junior operator's action exists only in PREInput.override_stack.`);
  console.log(`\n  Constitutional impact: operator session governance cannot track two`);
  console.log(`  concurrent sessions. Multi-operator scenarios must be modelled as`);
  console.log(`  separate override submissions, not separate governed sessions.`);

  section('REPLAY VERIFICATION');

  const timestamps = [T0, T1, T2, T3, T4];
  let allMatch = true;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    GovernedClock.set(timestamps[i]);
    const replay = replayEntry(entry);
    GovernedClock.set(T4);
    const vr = verify(entry, replay);
    if (vr.result !== 'MATCH') allMatch = false;
    console.log(`\n  [${entry.corpus_entry_id}]  winner=${entry.output.resolution_winner_id ?? 'schedule'}`);
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

if (require.main === module) {
  runDemo();
  process.exit(0);
}
