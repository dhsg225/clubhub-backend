/**
 * Divergence Detection Example
 *
 * Demonstrates that the verification engine correctly classifies
 * three distinct divergence scenarios:
 *
 *   Scenario A — CLASS_2_CORPUS_DIVERGENCE
 *     A corpus entry is tampered with (effective_content changed).
 *     Replay produces the correct output; verification compares against
 *     the tampered stored entry and detects the difference.
 *
 *   Scenario B — CLASS_1_DETERMINISM_FAILURE
 *     A replay result is artificially constructed where the input_hash
 *     matches the original but the output_hash differs — simulating a
 *     non-deterministic PRE (same input → different output).
 *
 *   Scenario C — CLASS_3_RECONSTRUCTION_FAILURE
 *     A corpus entry whose stored rule_version is not supported by the
 *     current engine, causing replay to fail entirely.
 */

import {
  GovernedClock,
  resolve,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  verifyDeterminism,
} from '../src/index';
import type { PREInput, CorpusEntry, PREOutput, ReplayResult } from '../src/index';

// ─── RESET STATE ─────────────────────────────────────────────────────────────

TraceStore._reset();
Corpus._reset();

const GOVERNED_TIME = '2026-06-01T15:00:00.000Z';
GovernedClock.set(GOVERNED_TIME);

console.log('═══════════════════════════════════════════════════════════');
console.log('  ClubHub TV PRE Runtime — Divergence Detection');
console.log('═══════════════════════════════════════════════════════════\n');

// ─── BASE INPUT ───────────────────────────────────────────────────────────────

const baseInput: PREInput = {
  resolution_id: 'screen-002-20260601-1500',
  scope_id: 'screen-002',
  governed_timestamp: GOVERNED_TIME,
  rule_version: '1.0.0',
  override_stack: [
    {
      id: 'override-sponsorship',
      level: 5,
      content_ref: 'SPONSOR_GOLD_PARTNER',
      expires_at: '2026-06-01T20:00:00.000Z',
      operator_id: 'op-carol',
    },
  ],
  schedule_block: {
    content_ref: 'DEFAULT_SCHEDULE',
    starts_at: '2026-06-01T09:00:00.000Z',
    ends_at: '2026-06-01T23:00:00.000Z',
  },
  emergency_active: false,
  emergency_scope: null,
  device_state: 'ONLINE',
};

// ─── ORIGINAL EXECUTION ──────────────────────────────────────────────────────

console.log('[1] Running original PRE execution...');
GovernedClock.set(GOVERNED_TIME);
const originalResult = resolve(baseInput);

if (!originalResult.ok) {
  console.error('Original resolution failed:', originalResult.failure);
  process.exit(1);
}

const originalOutput = originalResult.output;
const traceEvent = TraceStore.getPREEvents().find(
  (e) => e.trace_id === originalOutput.trace_id
)!;

const corpusEntry = Corpus.add(baseInput, originalOutput, traceEvent);

console.log(`  effective_content:  ${originalOutput.effective_content}`);
console.log(`  resolution_level:   ${originalOutput.resolution_level}`);
console.log(`  output_hash:        ${originalOutput.output_hash.slice(0, 16)}...`);
console.log(`  corpus entry stored: ${corpusEntry.corpus_entry_id}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — CLASS_2_CORPUS_DIVERGENCE
// ═══════════════════════════════════════════════════════════════════════════

console.log('─────────────────────────────────────────────────────────');
console.log('SCENARIO A — CLASS_2_CORPUS_DIVERGENCE');
console.log('  Simulate a corpus entry whose stored output was tampered');
console.log('  (e.g., a deploy that changed PRE behavior but not corpus)');
console.log('─────────────────────────────────────────────────────────\n');

// Build a "tampered" corpus entry: identical to the real one except
// effective_content and output_hash have been altered.
const tamperedOutput: PREOutput = {
  ...originalOutput,
  effective_content: 'INJECTED_CONTENT',     // tampered
  output_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // fabricated
};

const tamperedEntry: CorpusEntry = {
  ...corpusEntry,
  output: tamperedOutput,
};

// Replay uses the stored INPUT (unmodified). The PRE resolves correctly.
GovernedClock.freeze(GOVERNED_TIME);
const replayResultA = replayEntry(tamperedEntry);

// Verify: replayed output will not match tampered stored output.
const verResultA = verify(tamperedEntry, replayResultA);

console.log(`  Replayed effective_content:   ${replayResultA.replayed_output?.effective_content}`);
console.log(`  Tampered effective_content:   ${tamperedOutput.effective_content}`);
console.log(`  Replayed output_hash:         ${replayResultA.replayed_output?.output_hash.slice(0, 16)}...`);
console.log(`  Tampered output_hash:         ${tamperedOutput.output_hash.slice(0, 16)}...`);
console.log();
console.log(`  Verification result:  ${verResultA.result}`);
console.log(`  Failure class:        ${verResultA.failure_class}`);
console.log(`  Reason:               ${verResultA.reason}`);
if (verResultA.diff?.length) {
  console.log(`  Diffs detected:`);
  for (const d of verResultA.diff) {
    console.log(`    ${d.field}: ${JSON.stringify(d.original)} → ${JSON.stringify(d.replayed)}`);
  }
}

const scenarioAPass =
  verResultA.result === 'DIVERGENCE_DETECTED' &&
  verResultA.failure_class === 'CLASS_2_CORPUS_DIVERGENCE';
console.log(`\n  Scenario A: ${scenarioAPass ? 'PASS — divergence correctly detected' : 'FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — CLASS_1_DETERMINISM_FAILURE
// ═══════════════════════════════════════════════════════════════════════════

console.log('─────────────────────────────────────────────────────────');
console.log('SCENARIO B — CLASS_1_DETERMINISM_FAILURE');
console.log('  5-run determinism check where run 3 produces a different');
console.log('  output_hash — simulating a non-deterministic PRE engine');
console.log('─────────────────────────────────────────────────────────\n');

// Run the PRE 5 times. Runs 1,2,4,5 are genuine replays (all match).
// Run 3 is fabricated with a different output_hash — simulating what
// verifyDeterminism() would catch if the PRE were non-deterministic.
GovernedClock.freeze(GOVERNED_TIME);
const deterministicReplays = Array.from({ length: 5 }, (_, i) => replayEntry(corpusEntry));

const fakeNonDeterministicRun: ReplayResult = {
  ...deterministicReplays[2],
  replayed_output: deterministicReplays[2].replayed_output
    ? {
        ...deterministicReplays[2].replayed_output,
        effective_content: 'NONDETERMINISTIC_CONTENT',
        output_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }
    : null,
};

const noisyReplays: ReplayResult[] = [
  deterministicReplays[0],
  deterministicReplays[1],
  fakeNonDeterministicRun, // ← the noisy/altered run
  deterministicReplays[3],
  deterministicReplays[4],
];

const verResultB = verifyDeterminism(corpusEntry, noisyReplays);

console.log(`  Run 1 output_hash: ${noisyReplays[0].replayed_output?.output_hash.slice(0, 16)}...`);
console.log(`  Run 2 output_hash: ${noisyReplays[1].replayed_output?.output_hash.slice(0, 16)}...`);
console.log(`  Run 3 output_hash: ${noisyReplays[2].replayed_output?.output_hash.slice(0, 16)}... ← ALTERED`);
console.log(`  Run 4 output_hash: ${noisyReplays[3].replayed_output?.output_hash.slice(0, 16)}...`);
console.log(`  Run 5 output_hash: ${noisyReplays[4].replayed_output?.output_hash.slice(0, 16)}...`);
console.log();
console.log(`  Verification result:  ${verResultB.result}`);
console.log(`  Failure class:        ${verResultB.failure_class}`);
console.log(`  Reason:               ${verResultB.reason}`);

const scenarioBPass =
  verResultB.result === 'DIVERGENCE_DETECTED' &&
  verResultB.failure_class === 'CLASS_1_DETERMINISM_FAILURE';
console.log(`\n  Scenario B: ${scenarioBPass ? 'PASS — determinism failure correctly detected' : 'FAIL'}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO C — CLASS_3_RECONSTRUCTION_FAILURE
// ═══════════════════════════════════════════════════════════════════════════

console.log('─────────────────────────────────────────────────────────');
console.log('SCENARIO C — CLASS_3_RECONSTRUCTION_FAILURE');
console.log('  Corpus entry has an unsupported rule_version.');
console.log('  The replay engine fails to reconstruct output.');
console.log('─────────────────────────────────────────────────────────\n');

const unsupportedRuleInput: PREInput = {
  ...baseInput,
  resolution_id: 'screen-002-old-version',
  rule_version: '0.0.1', // not in SUPPORTED_RULE_VERSIONS
};

// Build a fake corpus entry with the unsupported rule version
const fakeOldOutput: PREOutput = {
  ...originalOutput,
  resolution_id: unsupportedRuleInput.resolution_id,
  rule_version: unsupportedRuleInput.rule_version,
};
const fakeOldEntry: CorpusEntry = {
  corpus_entry_id: unsupportedRuleInput.resolution_id,
  input: unsupportedRuleInput,
  output: fakeOldOutput,
  trace_event: traceEvent,
  prior_entry_hash: null,
  entry_hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
};

GovernedClock.freeze(GOVERNED_TIME);
const replayResultC = replayEntry(fakeOldEntry);

const verResultC = verify(fakeOldEntry, replayResultC);

console.log(`  rule_version in corpus:  ${fakeOldEntry.input.rule_version}`);
console.log(`  Replay succeeded:        ${replayResultC.replayed_output !== null}`);
console.log(`  Replay error:            ${replayResultC.error ?? 'none'}`);
console.log();
console.log(`  Verification result:  ${verResultC.result}`);
console.log(`  Failure class:        ${verResultC.failure_class}`);
console.log(`  Reason:               ${verResultC.reason}`);

const scenarioCPass =
  verResultC.result === 'DIVERGENCE_DETECTED' &&
  verResultC.failure_class === 'CLASS_3_RECONSTRUCTION_FAILURE';
console.log(`\n  Scenario C: ${scenarioCPass ? 'PASS — reconstruction failure correctly detected' : 'FAIL'}\n`);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
const allPass = scenarioAPass && scenarioBPass && scenarioCPass;
console.log(`  Divergence detection:  ${allPass ? 'ALL SCENARIOS PASS' : 'SOME SCENARIOS FAILED'}`);
console.log(`    A (CORPUS_DIVERGENCE):     ${scenarioAPass ? 'PASS' : 'FAIL'}`);
console.log(`    B (DETERMINISM_FAILURE):   ${scenarioBPass ? 'PASS' : 'FAIL'}`);
console.log(`    C (RECONSTRUCTION_FAILURE):${scenarioCPass ? 'PASS' : 'FAIL'}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (!allPass) process.exit(1);
