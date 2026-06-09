/**
 * Nominal Run Example
 *
 * Demonstrates end-to-end execution:
 *   1. Set GovernedClock
 *   2. Run PRE resolution
 *   3. Store in corpus
 *   4. Drive state machines through legal transitions
 *   5. Replay corpus entry
 *   6. Verify: MATCH expected
 *   7. Run 5x determinism check
 *   8. Print trace store
 */

import {
  GovernedClock,
  resolve,
  Corpus,
  TraceStore,
  replayEntry,
  replayAll,
  verify,
  verifyDeterminism,
  createPlayerMachine,
  createPREResolutionMachine,
  createIncidentMachine,
} from '../src/index';
import type { PREInput } from '../src/index';

// ─── RESET STATE FOR ISOLATED RUN ────────────────────────────────────────────

TraceStore._reset();
Corpus._reset();

// ─── STEP 1: SET GOVERNED CLOCK ──────────────────────────────────────────────

const GOVERNED_TIME = '2026-06-01T14:00:00.000Z';
GovernedClock.set(GOVERNED_TIME);

console.log('═══════════════════════════════════════════════════════════');
console.log('  ClubHub TV PRE Runtime — Nominal Execution');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`[1] GovernedClock set to ${GOVERNED_TIME}\n`);

// ─── STEP 2: BUILD INPUT ─────────────────────────────────────────────────────

const input: PREInput = {
  resolution_id: 'screen-001-20260601-1400',
  scope_id: 'screen-001',
  governed_timestamp: GOVERNED_TIME,
  rule_version: '1.0.0',
  override_stack: [
    {
      id: 'override-expired-level4',
      level: 4,
      content_ref: 'CONTENT_EXPIRED',
      expires_at: '2026-06-01T13:00:00.000Z', // expired before governed_timestamp
      operator_id: 'op-alice',
    },
    {
      id: 'override-active-level3',
      level: 3,
      content_ref: 'SPONSOR_CONTENT_TIER3',
      expires_at: '2026-06-01T15:00:00.000Z', // active
      operator_id: 'op-bob',
    },
    {
      id: 'override-lower-level2',
      level: 2,
      content_ref: 'LOCAL_PROMO',
      expires_at: null,
      operator_id: 'op-alice',
    },
  ],
  schedule_block: {
    content_ref: 'SCHEDULE_DEFAULT',
    starts_at: '2026-06-01T12:00:00.000Z',
    ends_at: '2026-06-01T18:00:00.000Z',
  },
  emergency_active: false,
  emergency_scope: null,
  device_state: 'ONLINE',
};

// ─── STEP 3: RESOLVE ─────────────────────────────────────────────────────────

console.log('[2] Running PRE resolution...');
const result = resolve(input);

if (!result.ok) {
  console.error('  FAILED:', result.failure);
  process.exit(1);
}

const output = result.output;
console.log(`  scope_id:           ${output.scope_id}`);
console.log(`  governed_timestamp: ${output.governed_timestamp}`);
console.log(`  effective_content:  ${output.effective_content}`);
console.log(`  resolution_level:   ${output.resolution_level}`);
console.log(`  resolution_winner:  ${output.resolution_winner_id}`);
console.log(`  input_hash:         ${output.input_hash.slice(0, 16)}...`);
console.log(`  output_hash:        ${output.output_hash.slice(0, 16)}...`);
console.log(`  trace_id:           ${output.trace_id.slice(0, 16)}...`);
console.log(`\n  Resolution path (${output.resolution_path.length} steps):`);
for (const step of output.resolution_path) {
  const icon = step.result === 'WIN' ? '✓' : step.result === 'EXPIRED' ? '✗' : '↓';
  console.log(`    Step ${step.step}: [${icon} ${step.result}] ${step.evaluated} — ${step.reason}`);
}

// ─── STEP 4: STORE IN CORPUS ─────────────────────────────────────────────────

const traceEvent = TraceStore.getPREEvents()[0];
const corpusEntry = Corpus.add(input, output, traceEvent);

console.log(`\n[3] Corpus entry stored`);
console.log(`  corpus_entry_id:    ${corpusEntry.corpus_entry_id}`);
console.log(`  prior_entry_hash:   ${corpusEntry.prior_entry_hash ?? 'null (first entry)'}`);
console.log(`  entry_hash:         ${corpusEntry.entry_hash.slice(0, 16)}...`);
console.log(`  Chain integrity:    ${Corpus.verifyChain() ? 'VERIFIED' : 'BROKEN'}`);

// ─── STEP 5: STATE MACHINE TRANSITIONS ───────────────────────────────────────

console.log('\n[4] Running state machine transitions...');

const player = createPlayerMachine();
const preRes = createPREResolutionMachine();
const incident = createIncidentMachine();

const req = (toState: string, reason: string) => ({
  toState,
  authority: 'BACKEND' as const,
  sourceId: 'nominal-run-example',
  reason,
  governedTimestamp: GOVERNED_TIME,
});

// Player boot sequence
player.transition(req('SYNCING', 'runtime-startup'));
player.transition(req('LIVE', 'pre-auth-confirmed'));

// PRE Resolution sequence
preRes.transition(req('RESOLVING', 'resolution-requested'));
preRes.transition(req('RESOLVED', 'resolution-confirmed'));

// Demonstrate operator override
const opReq = (toState: string, reason: string) => ({
  toState,
  authority: 'OPERATOR' as const,
  sourceId: 'op-alice',
  reason,
  governedTimestamp: GOVERNED_TIME,
});
player.transition(opReq('SUSPENDED', 'operator-halted-playback'));
player.transition(req('SYNCING', 'operator-resumed'));
player.transition(req('LIVE', 'pre-auth-confirmed'));

// Incident lifecycle
incident.transition(req('WATCHING', 'entropy-threshold-breach'));
incident.transition(opReq('DECLARED', 'operator-confirmed-incident'));
incident.transition(req('CONTAINED', 'blast-radius-bounded'));
incident.transition(req('RESOLVING', 'resolution-started'));
incident.transition(opReq('RESOLVED', 'operator-declared-resolved'));
incident.transition(req('POST_INCIDENT', 'auto-review-window'));
incident.transition(req('NOMINAL', 'review-window-closed'));

console.log(`  player state:       ${player.state} (${player.getMutations().length} transitions)`);
console.log(`  pre-resolution:     ${preRes.state} (${preRes.getMutations().length} transitions)`);
console.log(`  incident:           ${incident.state} (${incident.getMutations().length} transitions)`);

// Test rollback
console.log('\n  Testing rollback:');
const beforeRollback = player.state;
player.transition(req('REPLAY', 'operator-entered-replay'));
console.log(`    After transition: ${player.state}`);
player.rollback();
console.log(`    After rollback:   ${player.state} (restored to ${beforeRollback})`);

// Test illegal transition detection
console.log('\n  Testing illegal transition detection:');
let caught = '';
try {
  player.transition({ toState: 'REPLAY', authority: 'AI', sourceId: 'ai-agent', reason: 'ai-initiated', governedTimestamp: GOVERNED_TIME });
} catch (e: unknown) {
  caught = (e as Error).message.split('\n')[0];
  console.log(`    AI authority blocked: ${caught.slice(0, 70)}...`);
}

let caughtForbidden = '';
try {
  // Manually force state to REPLAY, then try illegal REPLAY → LIVE
  player.transition(opReq('REPLAY', 'entered-replay'));
  player.transition(req('LIVE', 'tried-direct-live')); // FORBIDDEN
} catch (e: unknown) {
  caughtForbidden = (e as Error).message;
  console.log(`    Forbidden transition blocked: ${caughtForbidden.slice(0, 70)}...`);
}

// ─── STEP 6: REPLAY ──────────────────────────────────────────────────────────

console.log('\n[5] Replaying corpus entry...');
GovernedClock.freeze(input.governed_timestamp);
const replayResult = replayEntry(corpusEntry);

if (replayResult.replayed_output) {
  console.log(`  replayed output_hash: ${replayResult.replayed_output.output_hash.slice(0, 16)}...`);
  console.log(`  original output_hash: ${corpusEntry.output.output_hash.slice(0, 16)}...`);
  console.log(`  Hashes match:         ${replayResult.replayed_output.output_hash === corpusEntry.output.output_hash}`);
} else {
  console.error('  Replay failed:', replayResult.error);
  process.exit(1);
}

// ─── STEP 7: VERIFY ──────────────────────────────────────────────────────────

console.log('\n[6] Verifying replay against corpus...');
const verificationResult = verify(corpusEntry, replayResult);
console.log(`  Result:     ${verificationResult.result}`);
if (verificationResult.result === 'MATCH') {
  console.log(`  All hashes identical. Replay is cryptographically valid.`);
}

// ─── STEP 8: DETERMINISM CHECK (5 RUNS) ──────────────────────────────────────

console.log('\n[7] Determinism check — 5 independent replays...');
GovernedClock.freeze(input.governed_timestamp);
const deterministicReplays = Array.from({ length: 5 }, () => replayEntry(corpusEntry));
const deterministicResult = verifyDeterminism(corpusEntry, deterministicReplays);
const hashes = deterministicReplays.map((r) => r.replayed_output?.output_hash?.slice(0, 16) ?? 'null');
console.log(`  Run hashes: ${hashes.join(' | ')}`);
console.log(`  Result:     ${deterministicResult.result}`);
if (deterministicResult.result === 'MATCH') {
  console.log(`  All 5 runs produced identical output. PRE is deterministic.`);
}

// ─── STEP 9: REPLAY FROM STATE MACHINE HISTORY ───────────────────────────────

console.log('\n[8] Reconstructing state machine from event history...');
const allMutations = [
  ...player.getMutations(),
  ...preRes.getMutations(),
  ...incident.getMutations(),
];
const reconstructedPlayerState = player.replayFromHistory(allMutations);
console.log(`  Reconstructed player state: ${reconstructedPlayerState}`);
console.log(`  Actual player state:        ${player.state}`);
console.log(`  Match: ${reconstructedPlayerState === player.state}`);

// ─── STEP 10: TRACE STORE SUMMARY ────────────────────────────────────────────

console.log('\n[9] Trace store summary:');
console.log(`  Total events: ${TraceStore.size()}`);
console.log(`  PRE events:   ${TraceStore.getPREEvents().length}`);
console.log(`  State events: ${TraceStore.getStateEvents().length}`);

console.log('\n  PRE events:');
for (const e of TraceStore.getPREEvents()) {
  console.log(
    `    [${e.event_type}] scope=${e.scope_id} level=${e.resolution_level ?? 'N/A'} ` +
      `content=${e.effective_content ?? 'N/A'} trace=${e.trace_id.slice(0, 12)}...`
  );
}

console.log('\n  State mutation events (first 6):');
const stateEvents = TraceStore.getStateEvents().slice(0, 6);
for (const e of stateEvents) {
  console.log(`    [${e.machineId}] ${e.fromState} → ${e.toState} (${e.authority})`);
}

// ─── DONE ─────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
const passed =
  result.ok &&
  verificationResult.result === 'MATCH' &&
  deterministicResult.result === 'MATCH' &&
  reconstructedPlayerState === player.state &&
  Corpus.verifyChain();
console.log(`  All checks: ${passed ? 'PASSED' : 'FAILED'}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (!passed) process.exit(1);
