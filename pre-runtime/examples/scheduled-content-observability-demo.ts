/**
 * scheduled-content-observability-demo.ts
 *
 * Human-readable audit trail for the Scheduled Content Change workflow.
 * Shows what was playing, who approved the change, what is playing now,
 * and replay verification status.
 */

import { GovernedClock, Corpus, TraceStore, replayEntry, verify } from '../src/index';
import { _resetRegistry } from '../src/integration-guard-layer';
import { runScheduledContentScenario } from './scheduled-content-scenario';
import { T0, T1, T2, VENUE_SCOPE, OP_SCHEDULER } from './scheduled-content-fixture';

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

  header('SCHEDULED CONTENT CHANGE — AUDIT TRAIL');
  console.log(`  Venue:    ${VENUE_SCOPE}`);
  console.log(`  Operator: ${OP_SCHEDULER}`);

  const scenario = runScheduledContentScenario();
  const { oldEntry, newEntry } = scenario;

  section('CONTENT TIMELINE');

  console.log(`\n  [${T0}]  T0 — Afternoon programme active`);
  console.log(`    Content:  ${oldEntry.output.effective_content}`);
  console.log(`    Level:    ${oldEntry.output.resolution_level} (schedule — no override active)`);
  console.log(`    Winner:   ${oldEntry.output.resolution_winner_id ?? '(none — schedule wins)'}`);
  console.log(`    Corpus:   ${oldEntry.corpus_entry_id}`);

  console.log(`\n  [${T1}]  T1 — Operator logs in, session elevated`);
  console.log(`    Authority: ELEVATED session granted to ${OP_SCHEDULER}`);
  console.log(`    Purpose:   Schedule change approval for 18:00 music night`);
  console.log(`    Note:      PRE engine does not require ELEVATED state to resolve schedules.`);
  console.log(`               ELEVATED session is governance convention — approval is audited`);
  console.log(`               via operator session mutation history, not PRE enforcement.`);

  console.log(`\n  [${T2}]  T2 — Evening music schedule active`);
  console.log(`    Content:  ${newEntry.output.effective_content}`);
  console.log(`    Level:    ${newEntry.output.resolution_level} (schedule — no override active)`);
  console.log(`    Winner:   ${newEntry.output.resolution_winner_id ?? '(none — schedule wins)'}`);
  console.log(`    Corpus:   ${newEntry.corpus_entry_id}`);

  section('OPERATOR APPROVAL CHAIN');
  console.log(`\n  The operator approval is modelled as a state machine transition sequence:`);
  console.log(`    UNAUTHENTICATED → AUTHENTICATING → AUTHENTICATED → ELEVATED`);
  console.log(`  Each transition is a StateMutationEvent in the trace, giving a full`);
  console.log(`  audit record of when the operator assumed schedule-change authority.`);
  console.log(`\n  Schedule change timing (schedule_block timestamps):`);
  console.log(`    Old schedule ends_at:   2026-05-30T18:00:00.000Z  (exclusive)`);
  console.log(`    New schedule starts_at: 2026-05-30T18:00:00.000Z  (inclusive)`);
  console.log(`  At T2=18:00, old window is closed, new window is open — no gap.`);

  section('REPLAY VERIFICATION');

  GovernedClock.set(T0);
  const replayOld = replayEntry(oldEntry);
  GovernedClock.set(T2);
  const verifyOld = verify(oldEntry, replayOld);

  GovernedClock.set(T2);
  const replayNew = replayEntry(newEntry);
  GovernedClock.set(T2);
  const verifyNew = verify(newEntry, replayNew);

  console.log(`\n  Old schedule (res-sched-001):`);
  console.log(`    Replay status:    ${replayOld.replayed_output ? 'SUCCESS' : 'FAILED'}`);
  console.log(`    Verification:     ${verifyOld.result}`);
  console.log(`    Hash match:       ${replayOld.replayed_output?.output_hash === oldEntry.output.output_hash}`);

  console.log(`\n  New schedule (res-sched-002):`);
  console.log(`    Replay status:    ${replayNew.replayed_output ? 'SUCCESS' : 'FAILED'}`);
  console.log(`    Verification:     ${verifyNew.result}`);
  console.log(`    Hash match:       ${replayNew.replayed_output?.output_hash === newEntry.output.output_hash}`);

  section('FULL AUDIT TRAIL');

  const allEntries = Corpus.getAll();
  console.log(`\n  Corpus entries: ${allEntries.length}`);
  console.log(`  Chain valid:    ${Corpus.verifyChain()}`);
  console.log(`  Trace events:   ${TraceStore.size()}`);
  console.log(`\n  Entry chain:`);
  for (const entry of allEntries) {
    console.log(`    [${entry.corpus_entry_id}]`);
    console.log(`      content:    ${entry.output.effective_content}`);
    console.log(`      timestamp:  ${entry.input.governed_timestamp}`);
    console.log(`      prior_hash: ${entry.prior_entry_hash ? entry.prior_entry_hash.slice(0, 20) + '...' : '(genesis)'}`);
    console.log(`      entry_hash: ${entry.entry_hash.slice(0, 20)}...`);
  }

  section('RUNTIME WEAKNESS DOCUMENTED');
  console.log(`\n  WEAKNESS: Schedule approval has no PRE-level enforcement.`);
  console.log(`    The ELEVATED operator session is recorded in mutation history`);
  console.log(`    but the PRE engine will resolve a NEW_SCHEDULE block regardless`);
  console.log(`    of whether any operator session was ELEVATED at the time.`);
  console.log(`    Mitigation: schedule changes must be gated at the API layer`);
  console.log(`    before the schedule_block is written to the PREInput.`);

  console.log('\n' + line('═'));
  console.log(`  DEMO COMPLETE — ${verifyOld.result === 'MATCH' && verifyNew.result === 'MATCH' ? 'ALL VERIFICATIONS PASS' : 'VERIFICATION ISSUES DETECTED'}`);
  console.log(line('═') + '\n');
}

if (require.main === module) {
  runDemo();
  process.exit(0);
}
