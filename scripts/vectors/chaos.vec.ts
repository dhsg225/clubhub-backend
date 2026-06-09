/**
 * Contract vectors: Chaos execution and degraded-state constitutional verification.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * Tests:
 *   - CHAOS-001 through CHAOS-007: each scenario runs without throwing
 *   - Each scenario produces valid PRE_Output (not null, not undefined)
 *   - All 10 invariants pass for each scenario (70 invariant assertions)
 *   - Replay hash stability for each scenario (7 assertions)
 *   - Scenario-specific assertions (CHAOS-001 confidence, CHAOS-002 level, etc.)
 *   - Poll storm hash identity (CHAOS-006, CHAOS-007)
 *   - Entropy advisory-only (chaos does not mutate resolution)
 *   - Telemetry events present per scenario
 *
 * Total: 100+ assertions
 */

import {
  runChaosScenario,
  runAllChaosScenarios,
  ALL_CHAOS_SCENARIOS,
} from '../../src/chaos/runtime/chaos-runner';
import {
  buildMinimalState,
  buildCampaignState,
  buildEmergencyState,
  buildOverrideState,
} from '../../src/chaos/fixtures/degraded-state-factory';
import {
  CONFIDENCE_NO_DELIVERY_LOG,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_EMERGENCY_FALLBACK_ID,
} from '../../src/pre/constants';
import {
  CHAOS_POLL_STORM_COUNT,
} from '../../src/chaos/constants';
import type { ChaosExecutionResult } from '../../src/chaos/types';
import { assert, assertEqual, summary } from './_fixture';

// ─── Fixed evaluation timestamp ───────────────────────────────────────────────
// Use corpus timestamp matching the existing CHAOS-001.json fixture
const AT = 1_748_390_400_000;

console.log('=== Chaos Execution — Constitutional Verification Vectors ===\n');

// ─── Build base states for each scenario ─────────────────────────────────────

const minimalState    = buildMinimalState();
const campaignState   = buildCampaignState(AT);
const emergencyState  = buildEmergencyState(AT);
const overrideState   = buildOverrideState(AT);

// ─── CHAOS-001: Backend Restart ───────────────────────────────────────────────

console.log('=== CHAOS-001: Backend Restart ===\n');
const c001 = runChaosScenario(ALL_CHAOS_SCENARIOS[0]!, minimalState, AT);

assert(c001.status !== 'EXECUTION_ERROR',           'C001-1: CHAOS-001 does not throw EXECUTION_ERROR');
assert(c001.pre_output !== null,                    'C001-2: CHAOS-001 produces non-null PRE_Output');
assert(c001.pre_output !== undefined,               'C001-3: CHAOS-001 output is not undefined');
assert(c001.replay_artifact.hashes_stable,          'C001-4: CHAOS-001 replay hashes are stable');
assert(c001.telemetry.events.length > 0,            'C001-5: CHAOS-001 telemetry has events');

// Confidence score must be CONFIDENCE_NO_DELIVERY_LOG (0.5000)
// when last_delivery is null
if (c001.pre_output !== null) {
  assertEqual(
    c001.pre_output.confidence_score,
    CONFIDENCE_NO_DELIVERY_LOG,
    'C001-6: CHAOS-001 confidence_score === CONFIDENCE_NO_DELIVERY_LOG (0.5000)'
  );
  assert(
    c001.pre_output.reason_trace.level_6_device_truth !== null,
    'C001-7: CHAOS-001 level_6 trace is present'
  );
  assert(
    c001.pre_output.output_schema_version === '1.0.0',
    'C001-8: CHAOS-001 output schema version is 1.0.0'
  );
}

// Invariants — check that invariant_results are populated
assert(c001.invariant_results.length > 0,           'C001-9: CHAOS-001 invariant_results populated');
assert(c001.all_invariants_pass,                    'C001-10: CHAOS-001 all invariants pass');

// All assertions pass
assert(c001.all_assertions_pass,                    'C001-11: CHAOS-001 all scenario assertions pass');

// ─── CHAOS-002: DB Restart Stale Read ─────────────────────────────────────────

console.log('\n=== CHAOS-002: DB Restart Stale Read ===\n');
// Use campaign state as base (has schedules that will be made stale)
const c002 = runChaosScenario(ALL_CHAOS_SCENARIOS[1]!, campaignState, AT);

assert(c002.status !== 'EXECUTION_ERROR',           'C002-1: CHAOS-002 does not throw EXECUTION_ERROR');
assert(c002.pre_output !== null,                    'C002-2: CHAOS-002 produces non-null PRE_Output');
assert(c002.replay_artifact.hashes_stable,          'C002-3: CHAOS-002 replay hashes are stable');
assert(c002.telemetry.events.length > 0,            'C002-4: CHAOS-002 telemetry has events');

// Must resolve at LEVEL_5 with is_fallback: true
if (c002.pre_output !== null) {
  assertEqual(
    c002.pre_output.resolution_level,
    5,
    'C002-5: CHAOS-002 resolution_level === 5 (LEVEL_5 fallback)'
  );
  assertEqual(
    c002.pre_output.is_fallback,
    true,
    'C002-6: CHAOS-002 is_fallback === true'
  );
  assert(
    c002.pre_output.playlist.length > 0,
    'C002-7: CHAOS-002 playlist is not empty (system fallback present)'
  );
  assertEqual(
    c002.pre_output.playlist[0]!.content_id,
    SYSTEM_FALLBACK_CONTENT_ID,
    'C002-8: CHAOS-002 uses system fallback content_id'
  );
}

// Invariants
assert(c002.invariant_results.length > 0,           'C002-9: CHAOS-002 invariant_results populated');
assert(c002.all_invariants_pass,                    'C002-10: CHAOS-002 all invariants pass');
assert(c002.all_assertions_pass,                    'C002-11: CHAOS-002 all scenario assertions pass');

// ─── CHAOS-003: Cache Loss ────────────────────────────────────────────────────

console.log('\n=== CHAOS-003: Cache Loss ===\n');
// Use campaign state as base (has content that will be cleared)
const c003 = runChaosScenario(ALL_CHAOS_SCENARIOS[2]!, campaignState, AT);

assert(c003.status !== 'EXECUTION_ERROR',           'C003-1: CHAOS-003 does not throw EXECUTION_ERROR');
assert(c003.pre_output !== null,                    'C003-2: CHAOS-003 produces non-null PRE_Output');
assert(c003.replay_artifact.hashes_stable,          'C003-3: CHAOS-003 replay hashes are stable');
assert(c003.telemetry.events.length > 0,            'C003-4: CHAOS-003 telemetry has events');

// With empty content_items, all playlist IDs must be system fallback IDs
if (c003.pre_output !== null) {
  const validIds = new Set([SYSTEM_FALLBACK_CONTENT_ID, SYSTEM_EMERGENCY_FALLBACK_ID]);
  const allValid = c003.pre_output.playlist.every(p => validIds.has(p.content_id));
  assert(
    allValid,
    'C003-5: CHAOS-003 all playlist content_ids are valid system fallback IDs'
  );
  assert(
    c003.pre_output.playlist.length > 0,
    'C003-6: CHAOS-003 playlist is not empty (some fallback content present)'
  );
  assert(
    c003.pre_output.is_fallback === true || c003.pre_output.resolution_level >= 3,
    'C003-7: CHAOS-003 resolves via fallback or campaign path with empty cache'
  );
}

// Invariants
assert(c003.invariant_results.length > 0,           'C003-8: CHAOS-003 invariant_results populated');
assert(c003.all_invariants_pass,                    'C003-9: CHAOS-003 all invariants pass');
assert(c003.all_assertions_pass,                    'C003-10: CHAOS-003 all scenario assertions pass');

// ─── CHAOS-004: Event Bus Lag ─────────────────────────────────────────────────

console.log('\n=== CHAOS-004: Event Bus Lag ===\n');
// Use override state (has operational override) as base
const c004 = runChaosScenario(ALL_CHAOS_SCENARIOS[3]!, overrideState, AT);

assert(c004.status !== 'EXECUTION_ERROR',           'C004-1: CHAOS-004 does not throw EXECUTION_ERROR');
assert(c004.pre_output !== null,                    'C004-2: CHAOS-004 produces non-null PRE_Output');
assert(c004.replay_artifact.hashes_stable,          'C004-3: CHAOS-004 replay hashes are stable');
assert(c004.telemetry.events.length > 0,            'C004-4: CHAOS-004 telemetry has events');

// Lagged override must still be recognized as active → LEVEL_1
if (c004.pre_output !== null) {
  assertEqual(
    c004.pre_output.resolution_level,
    1,
    'C004-5: CHAOS-004 resolution_level === 1 (lagged override picked up)'
  );
  assertEqual(
    c004.pre_output.is_fallback,
    false,
    'C004-6: CHAOS-004 is_fallback === false (override is authoritative)'
  );
  assert(
    c004.pre_output.reason_trace.level_1_operational !== null,
    'C004-7: CHAOS-004 level_1 trace is present (override resolved)'
  );
}

// Invariants
assert(c004.invariant_results.length > 0,           'C004-8: CHAOS-004 invariant_results populated');
assert(c004.all_invariants_pass,                    'C004-9: CHAOS-004 all invariants pass');
assert(c004.all_assertions_pass,                    'C004-10: CHAOS-004 all scenario assertions pass');

// ─── CHAOS-005: Clock Skew ────────────────────────────────────────────────────

console.log('\n=== CHAOS-005: Clock Skew ===\n');
// Use campaign state as base (has schedules that will be expired by skew)
const c005 = runChaosScenario(ALL_CHAOS_SCENARIOS[4]!, campaignState, AT);

assert(c005.status !== 'EXECUTION_ERROR',           'C005-1: CHAOS-005 does not throw EXECUTION_ERROR');
assert(c005.pre_output !== null,                    'C005-2: CHAOS-005 produces non-null PRE_Output');
assert(c005.replay_artifact.hashes_stable,          'C005-3: CHAOS-005 replay hashes are stable');
assert(c005.telemetry.events.length > 0,            'C005-4: CHAOS-005 telemetry has events');

// Far-future `at` with all schedules expired → LEVEL_5 fallback
if (c005.pre_output !== null) {
  assertEqual(
    c005.pre_output.is_fallback,
    true,
    'C005-5: CHAOS-005 is_fallback === true (all schedules expired by clock skew)'
  );
  assertEqual(
    c005.pre_output.resolution_level,
    5,
    'C005-6: CHAOS-005 resolution_level === 5 (LEVEL_5 structural fallback)'
  );
  assert(
    c005.pre_output.playlist.length > 0,
    'C005-7: CHAOS-005 playlist is not empty (system fallback present)'
  );
}

// Invariants
assert(c005.invariant_results.length > 0,           'C005-8: CHAOS-005 invariant_results populated');
assert(c005.all_invariants_pass,                    'C005-9: CHAOS-005 all invariants pass');
assert(c005.all_assertions_pass,                    'C005-10: CHAOS-005 all scenario assertions pass');

// ─── CHAOS-006: Poll Storm ────────────────────────────────────────────────────

console.log('\n=== CHAOS-006: Poll Storm ===\n');
// Use campaign state as base (realistic state with content)
const c006 = runChaosScenario(ALL_CHAOS_SCENARIOS[5]!, campaignState, AT);

assert(c006.status !== 'EXECUTION_ERROR',           'C006-1: CHAOS-006 does not throw EXECUTION_ERROR');
assert(c006.pre_output !== null,                    'C006-2: CHAOS-006 produces non-null PRE_Output');
assert(c006.replay_artifact.hashes_stable,          'C006-3: CHAOS-006 replay hashes are stable');
assert(c006.telemetry.events.length > 0,            'C006-4: CHAOS-006 telemetry has events');

// Poll storm — verify hash stability assertion passes
const c006PollHashAssertion = c006.assertion_results.find(
  a => a.assertion === 'all_poll_storm_outputs_hash_identical'
);
assert(
  c006PollHashAssertion !== undefined,
  `C006-5: CHAOS-006 poll storm hash assertion present`
);
assert(
  c006PollHashAssertion?.passed === true,
  `C006-6: CHAOS-006 all ${CHAOS_POLL_STORM_COUNT} poll storm outputs have identical hash`
);

// Invariants
assert(c006.invariant_results.length > 0,           'C006-7: CHAOS-006 invariant_results populated');
assert(c006.all_invariants_pass,                    'C006-8: CHAOS-006 all invariants pass');

// Verify output ordering is maintained under poll storm
if (c006.pre_output !== null) {
  const playlist = c006.pre_output.playlist;
  let orderingValid = true;
  for (let i = 1; i < playlist.length; i++) {
    if ((playlist[i]?.source ?? 0) < (playlist[i-1]?.source ?? 0)) {
      orderingValid = false;
      break;
    }
  }
  assert(orderingValid,                             'C006-9: CHAOS-006 playlist ordering maintained under poll storm');
}

assert(c006.all_assertions_pass,                    'C006-10: CHAOS-006 all scenario assertions pass');

// ─── CHAOS-007: Emergency During Poll Storm ───────────────────────────────────

console.log('\n=== CHAOS-007: Emergency During Poll Storm ===\n');
// Use emergency state as base (has active emergency)
const c007 = runChaosScenario(ALL_CHAOS_SCENARIOS[6]!, emergencyState, AT);

assert(c007.status !== 'EXECUTION_ERROR',           'C007-1: CHAOS-007 does not throw EXECUTION_ERROR');
assert(c007.pre_output !== null,                    'C007-2: CHAOS-007 produces non-null PRE_Output');
assert(c007.replay_artifact.hashes_stable,          'C007-3: CHAOS-007 replay hashes are stable');
assert(c007.telemetry.events.length > 0,            'C007-4: CHAOS-007 telemetry has events');

// Emergency must be absolute — all 10 outputs at LEVEL_0
if (c007.pre_output !== null) {
  assertEqual(
    c007.pre_output.resolution_level,
    0,
    'C007-5: CHAOS-007 resolution_level === 0 (LEVEL_0 emergency absolute)'
  );
  assertEqual(
    c007.pre_output.is_fallback,
    false,
    'C007-6: CHAOS-007 is_fallback === false (emergency is authoritative)'
  );
  // L1 and L5 traces must be null (skipped at LEVEL_0)
  assertEqual(
    c007.pre_output.reason_trace.level_1_operational,
    null,
    'C007-7: CHAOS-007 level_1_operational trace === null (skipped at LEVEL_0)'
  );
  assertEqual(
    c007.pre_output.reason_trace.level_5_structural,
    null,
    'C007-8: CHAOS-007 level_5_structural trace === null (skipped at LEVEL_0)'
  );
  assert(
    c007.pre_output.reason_trace.level_0_emergency !== null,
    'C007-9: CHAOS-007 level_0_emergency trace is present'
  );
}

// Poll storm — all hashes identical
const c007PollHashAssertion = c007.assertion_results.find(
  a => a.assertion === 'all_poll_storm_outputs_hash_identical'
);
assert(
  c007PollHashAssertion !== undefined,
  'C007-10: CHAOS-007 poll storm hash assertion present'
);
assert(
  c007PollHashAssertion?.passed === true,
  `C007-11: CHAOS-007 all ${CHAOS_POLL_STORM_COUNT} emergency outputs have identical hash`
);

// INV-7 (emergency_absolute) must pass
const inv7Result = c007.invariant_results.find(r => r.invariantId === 'INV-7');
assert(
  inv7Result !== undefined,
  'C007-12: CHAOS-007 INV-7 (emergency_absolute) was evaluated'
);
assert(
  inv7Result?.passed === true,
  'C007-13: CHAOS-007 INV-7 (emergency_absolute) passes'
);

// Invariants
assert(c007.invariant_results.length > 0,           'C007-14: CHAOS-007 invariant_results populated');
assert(c007.all_invariants_pass,                    'C007-15: CHAOS-007 all invariants pass');
assert(c007.all_assertions_pass,                    'C007-16: CHAOS-007 all scenario assertions pass');

// ─── Cross-scenario invariant verification (70 assertions: 7 scenarios × 10 invariants) ───

console.log('\n=== Cross-Scenario Invariant Verification ===\n');

const allResults: ChaosExecutionResult[] = [c001, c002, c003, c004, c005, c006, c007];
const allScenarioIds = ['CHAOS-001', 'CHAOS-002', 'CHAOS-003', 'CHAOS-004', 'CHAOS-005', 'CHAOS-006', 'CHAOS-007'];
const requiredInvariantIds = ['INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5', 'INV-6', 'INV-7', 'INV-8', 'INV-9', 'INV-10'];

for (let si = 0; si < allResults.length; si++) {
  const result = allResults[si]!;
  const scenarioId = allScenarioIds[si]!;

  for (const invId of requiredInvariantIds) {
    const invResult = result.invariant_results.find(r => r.invariantId === invId);
    assert(
      invResult !== undefined,
      `INV-CHECK: ${scenarioId} — ${invId} was evaluated`
    );
    assert(
      invResult?.passed === true,
      `INV-CHECK: ${scenarioId} — ${invId} passes`
    );
  }
}

// ─── Replay hash stability (7 scenario assertions) ────────────────────────────

console.log('\n=== Replay Hash Stability ===\n');

for (let si = 0; si < allResults.length; si++) {
  const result = allResults[si]!;
  const scenarioId = allScenarioIds[si]!;

  assert(
    result.replay_artifact.hashes_stable,
    `HASH-STABLE: ${scenarioId} — run_1 === run_2 output hash`
  );
  assert(
    result.replay_artifact.conditions_hash.length > 0,
    `HASH-STABLE: ${scenarioId} — conditions_hash is non-empty`
  );
  assert(
    result.replay_artifact.input_hash.length > 0,
    `HASH-STABLE: ${scenarioId} — input_hash is non-empty`
  );
}

// ─── runAllChaosScenarios integration test ────────────────────────────────────

console.log('\n=== runAllChaosScenarios Integration ===\n');

// Run all 7 scenarios using the minimal state as base
// (individual scenarios will degrade appropriately)
const allRun = runAllChaosScenarios(minimalState, AT);

assertEqual(allRun.length, 7,                       'ALL-1: runAllChaosScenarios returns 7 results');
assert(
  allRun.every(r => r.scenario_id !== undefined),
  'ALL-2: all results have scenario_id'
);
assert(
  allRun.every(r => r.telemetry.events.length > 0),
  'ALL-3: all results have telemetry events'
);
assert(
  allRun.every(r => r.replay_artifact.conditions_hash.length > 0),
  'ALL-4: all results have conditions_hash'
);

// ─── Entropy advisory-only — chaos does not mutate state ─────────────────────

console.log('\n=== Entropy Advisory-Only Verification ===\n');

// Verify that chaos scenarios do not modify the base states
const minimalStateAfter = buildMinimalState();
assertEqual(
  JSON.stringify(minimalState),
  JSON.stringify(minimalStateAfter),
  'ENTROPY-1: minimalState not mutated by chaos runs'
);

const campaignStateAfter = buildCampaignState(AT);
assertEqual(
  JSON.stringify(campaignState),
  JSON.stringify(campaignStateAfter),
  'ENTROPY-2: campaignState not mutated by chaos runs'
);

const emergencyStateAfter = buildEmergencyState(AT);
assertEqual(
  JSON.stringify(emergencyState),
  JSON.stringify(emergencyStateAfter),
  'ENTROPY-3: emergencyState not mutated by chaos runs'
);

// ─── Telemetry event count verification ───────────────────────────────────────

console.log('\n=== Telemetry Event Verification ===\n');

for (let si = 0; si < allResults.length; si++) {
  const result = allResults[si]!;
  const scenarioId = allScenarioIds[si]!;

  assert(
    result.telemetry.events.length > 0,
    `TELEMETRY: ${scenarioId} has at least 1 telemetry event`
  );

  // Scenario started event must be present
  const startedEvent = result.telemetry.events.find(e => e.type === 'chaos_scenario_started');
  assert(
    startedEvent !== undefined,
    `TELEMETRY: ${scenarioId} has chaos_scenario_started event`
  );

  // Scenario completed event must be present
  const completedEvent = result.telemetry.events.find(e => e.type === 'chaos_scenario_completed');
  assert(
    completedEvent !== undefined,
    `TELEMETRY: ${scenarioId} has chaos_scenario_completed event`
  );
}

// ─── CHAOS-001 vs corpus CHAOS-001.json fixture ───────────────────────────────

console.log('\n=== CHAOS-001 Corpus Fixture Alignment ===\n');

// CHAOS-001.json fixture uses: minimalState (no schedules, overrides, content),
// screen-c01, venue-001, at=1748390400000
// Expected: resolution_level=5, is_fallback=true, confidence_score=0.5000

// Our CHAOS-001 scenario does the same: injects null delivery log on minimal state
// But uses chaos-screen-001 (different from corpus screen-c01). We verify behavior.
assert(
  c001.pre_output?.is_fallback === true,
  'CORPUS-1: CHAOS-001 is_fallback matches corpus expectation (true)'
);
assert(
  c001.pre_output?.confidence_score === CONFIDENCE_NO_DELIVERY_LOG,
  'CORPUS-2: CHAOS-001 confidence_score matches corpus (0.5000)'
);
assert(
  c001.pre_output?.resolution_level === 5,
  'CORPUS-3: CHAOS-001 resolution_level matches corpus (5)'
);

// ─── Summary ─────────────────────────────────────────────────────────────────

summary('chaos.vec.ts');
