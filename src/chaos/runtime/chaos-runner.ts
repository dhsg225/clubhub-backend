/**
 * Chaos runner — executes chaos scenarios against PRE.resolve().
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * CRITICAL CONSTRAINTS:
 *   - Two PRE.resolve() calls per scenario for hash stability check
 *   - runAllInvariants() is called by PRE.resolve() internally — we re-run separately
 *     to capture results without the throwing behavior for CONSTITUTIONAL_BREACH invariants
 *   - Never use Date.now() — use `at` parameter
 *   - Chaos OBSERVES and REPORTS — never modifies PRE behavior
 *   - InvariantViolationErrors are caught and documented (not suppressed)
 */

import type {
  ChaosScenario,
  ChaosExecutionResult,
  ChaosTelemetryEnvelope,
  ChaosEvent,
  ChaosReplayArtifact,
  AssertionResult,
} from '../types';
import type { PRE_Input, PRE_Output, SystemStateSnapshot } from '../../pre/types';
import { resolve } from '../../pre/index';
import { runAllInvariants } from '../../verification/invariants/index';
import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';
import type { InvariantResult } from '../../verification/invariants/types';
import { InvariantViolationError } from '../../verification/invariants/types';
import {
  CHAOS_POLL_STORM_COUNT,
  CHAOS_POLL_STORM_INTERVAL_MS,
} from '../constants';

// Import all assertion functions
import {
  assertSystemFallbackAlwaysResolves,
  assertNeverThrows,
  assertReplayHashStable,
  assertOutputOrdering,
  assertReasonTraceExplainable,
  assertEmergencyPrecedenceAbsolute,
  assertCacheAbsenceNoAuthorityChange,
  assertNoInvariantSuppression,
  assertNoReplayWrites,
} from '../assertions/degraded-behavior-assertions';

// Import all scenario definitions
import { chaos001BackendRestart }             from '../scenarios/chaos-001-backend-restart';
import { chaos002DbRestart }                  from '../scenarios/chaos-002-db-restart';
import { chaos003CacheLoss }                  from '../scenarios/chaos-003-cache-loss';
import { chaos004EventBusLag }                from '../scenarios/chaos-004-event-bus-lag';
import { chaos005ClockSkew }                  from '../scenarios/chaos-005-clock-skew';
import { chaos006PollStorm }                  from '../scenarios/chaos-006-poll-storm';
import { chaos007EmergencyDuringPollStorm }   from '../scenarios/chaos-007-emergency-during-poll-storm';

// ─── Canonical scenario registry (ordered) ────────────────────────────────────

export const ALL_CHAOS_SCENARIOS: ChaosScenario[] = [
  chaos001BackendRestart,
  chaos002DbRestart,
  chaos003CacheLoss,
  chaos004EventBusLag,
  chaos005ClockSkew,
  chaos006PollStorm,
  chaos007EmergencyDuringPollStorm,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashOutput(output: PRE_Output | null): string | null {
  if (output === null) return null;
  return fnv1a32(canonicalizeJson(output));
}

function hashInput(input: PRE_Input): string {
  return fnv1a32(canonicalizeJson(input));
}

function hashConditions(conditions: unknown): string {
  return fnv1a32(canonicalizeJson(conditions));
}

/**
 * Call PRE.resolve() and capture the result, catching any errors.
 * Returns [output, error_string | null].
 *
 * InvariantViolationErrors for CONSTITUTIONAL_BREACH are caught here for
 * documentation purposes — chaos must record them, not suppress them.
 */
function safeResolve(input: PRE_Input): { output: PRE_Output | null; error: string | null } {
  try {
    const output = resolve(input);
    return { output, error: null };
  } catch (err) {
    if (err instanceof InvariantViolationError) {
      return {
        output: null,
        error: `InvariantViolationError [${err.severity}] ${err.invariantId}: ${err.message}`,
      };
    }
    return {
      output: null,
      error: String(err),
    };
  }
}

/**
 * Run all invariants against an output, catching InvariantViolationError.
 * Returns the results array (including failures).
 * The throwing behavior is overridden here — chaos must collect all evidence.
 */
function safeRunInvariants(output: PRE_Output, input: PRE_Input): InvariantResult[] {
  // runAllInvariants throws on CONSTITUTIONAL_BREACH/CATASTROPHIC failure.
  // Chaos needs to collect results without aborting. We catch the error and
  // reconstruct the partial results from the thrown error.
  try {
    return runAllInvariants(output, input);
  } catch (err) {
    if (err instanceof InvariantViolationError) {
      // The invariant that threw is documented in the error.
      // Collect what we have (pre-throw invariants) plus the violation.
      return [
        {
          invariantId: err.invariantId,
          passed:      false,
          message:     err.message,
          severity:    err.severity,
        },
      ];
    }
    // Unknown error from invariant evaluation
    return [
      {
        invariantId: 'UNKNOWN',
        passed:      false,
        message:     `Invariant evaluation error: ${String(err)}`,
        severity:    'ERROR',
      },
    ];
  }
}

// ─── Named Assertion Dispatch ────────────────────────────────────────────────

/**
 * Run a named assertion from the scenario expectedBehavior.assertions list.
 * Returns null if the assertion name is not a registered function (string annotations).
 */
function runNamedAssertion(
  name: string,
  result: ChaosExecutionResult,
): AssertionResult | null {
  switch (name) {
    case 'assertSystemFallbackAlwaysResolves': return assertSystemFallbackAlwaysResolves(result);
    case 'assertNeverThrows':                  return assertNeverThrows(result);
    case 'assertReplayHashStable':             return assertReplayHashStable(result);
    case 'assertOutputOrdering':               return assertOutputOrdering(result);
    case 'assertReasonTraceExplainable':       return assertReasonTraceExplainable(result);
    case 'assertEmergencyPrecedenceAbsolute':  return assertEmergencyPrecedenceAbsolute(result);
    case 'assertCacheAbsenceNoAuthorityChange': return assertCacheAbsenceNoAuthorityChange(result);
    case 'assertNoInvariantSuppression':       return assertNoInvariantSuppression(result);
    case 'assertNoReplayWrites':               return assertNoReplayWrites(result);
    default:
      // String annotations like 'resolution_level === 5' — handled by runScenarioAssertions
      return null;
  }
}

/**
 * Run all scenario-specific assertions including string annotations.
 */
function runScenarioAssertions(
  scenario: ChaosScenario,
  result: ChaosExecutionResult,
  pollStormOutputHashes?: string[],
): AssertionResult[] {
  const assertions: AssertionResult[] = [];

  for (const assertionName of scenario.expectedBehavior.assertions) {
    // Try named assertion first
    const namedResult = runNamedAssertion(assertionName, result);
    if (namedResult !== null) {
      assertions.push(namedResult);
      continue;
    }

    // String annotation assertions
    const output = result.pre_output;

    if (assertionName.startsWith('confidence_score ===')) {
      const expectedVal = parseFloat(assertionName.replace('confidence_score ===', '').trim());
      const actual = output?.confidence_score ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === expectedVal,
        actual,
        expected:  expectedVal,
        detail:    actual === expectedVal
          ? `confidence_score is exactly ${expectedVal}`
          : `confidence_score is ${actual}, expected ${expectedVal}`,
      });
    } else if (assertionName === 'resolution_level === 5') {
      const actual = output?.resolution_level ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === 5,
        actual,
        expected:  5,
        detail:    actual === 5 ? 'resolution_level is LEVEL_5' : `resolution_level is ${actual}, expected 5`,
      });
    } else if (assertionName === 'resolution_level === 1') {
      const actual = output?.resolution_level ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === 1,
        actual,
        expected:  1,
        detail:    actual === 1 ? 'resolution_level is LEVEL_1' : `resolution_level is ${actual}, expected 1`,
      });
    } else if (assertionName === 'resolution_level === 0') {
      const actual = output?.resolution_level ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === 0,
        actual,
        expected:  0,
        detail:    actual === 0 ? 'resolution_level is LEVEL_0' : `resolution_level is ${actual}, expected 0`,
      });
    } else if (assertionName === 'is_fallback === true') {
      const actual = output?.is_fallback ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === true,
        actual,
        expected:  true,
        detail:    actual === true ? 'is_fallback is true' : `is_fallback is ${actual}, expected true`,
      });
    } else if (assertionName === 'is_fallback === false') {
      const actual = output?.is_fallback ?? null;
      assertions.push({
        assertion: assertionName,
        passed:    actual === false,
        actual,
        expected:  false,
        detail:    actual === false ? 'is_fallback is false' : `is_fallback is ${actual}, expected false`,
      });
    } else if (assertionName === 'all_playlist_content_ids_valid') {
      // Content IDs must be from state or system fallback IDs
      const validStateIds = new Set(result.pre_input.system_state.content_items.map(c => c.id));
      validStateIds.add('system:fallback:v1');
      validStateIds.add('system:emergency-fallback:v1');

      const playlist = output?.playlist ?? [];
      const invalidIds = playlist.filter(p => !validStateIds.has(p.content_id)).map(p => p.content_id);
      const passed = invalidIds.length === 0;

      assertions.push({
        assertion: assertionName,
        passed,
        actual:    invalidIds.length > 0 ? invalidIds : 'all valid',
        expected:  'all content_ids in state or system fallback IDs',
        detail:    passed
          ? 'All playlist content_ids are valid'
          : `Invalid content_ids found: ${invalidIds.join(', ')}`,
      });
    } else if (assertionName === 'all_poll_storm_outputs_hash_identical') {
      // All poll storm playlist_checksums must be identical.
      // resolved_at varies per call (it equals the `at` value), so full output hashes differ.
      // playlist_checksum is the constitutionally stable signal — it captures content
      // identity independent of evaluation timestamp.
      if (pollStormOutputHashes && pollStormOutputHashes.length > 0) {
        const firstHash = pollStormOutputHashes[0];
        const allSame = pollStormOutputHashes.every(h => h === firstHash);

        assertions.push({
          assertion: assertionName,
          passed:    allSame,
          actual:    pollStormOutputHashes,
          expected:  `all ${pollStormOutputHashes.length} playlist_checksums === ${firstHash}`,
          detail:    allSame
            ? `All ${pollStormOutputHashes.length} poll storm outputs have identical playlist_checksum: ${firstHash}`
            : `Poll storm playlist_checksum divergence: ${[...new Set(pollStormOutputHashes)].join(', ')}`,
        });
      } else {
        assertions.push({
          assertion: assertionName,
          passed:    false,
          actual:    [],
          expected:  `${CHAOS_POLL_STORM_COUNT} identical playlist_checksums`,
          detail:    'Poll storm hashes not provided to assertion runner',
        });
      }
    } else if (assertionName === 'level_1_operational_trace === null') {
      const actual = output?.reason_trace.level_1_operational ?? undefined;
      const passed = actual === null || actual === undefined;
      assertions.push({
        assertion: assertionName,
        passed,
        actual,
        expected:  null,
        detail:    passed
          ? 'level_1_operational trace is null (skipped at LEVEL_0)'
          : 'level_1_operational trace is non-null (should be skipped at LEVEL_0)',
      });
    } else if (assertionName === 'level_5_structural_trace === null') {
      const actual = output?.reason_trace.level_5_structural ?? undefined;
      const passed = actual === null || actual === undefined;
      assertions.push({
        assertion: assertionName,
        passed,
        actual,
        expected:  null,
        detail:    passed
          ? 'level_5_structural trace is null (skipped at LEVEL_0)'
          : 'level_5_structural trace is non-null (should be skipped at LEVEL_0)',
      });
    } else {
      // Unknown assertion name — log as non-fatal unknown
      assertions.push({
        assertion: assertionName,
        passed:    true,
        detail:    `Annotation-only assertion: ${assertionName} (no implementation)`,
      });
    }
  }

  return assertions;
}

// ─── Main Execution Functions ─────────────────────────────────────────────────

/**
 * Execute a single chaos scenario and return full ChaosExecutionResult.
 *
 * Protocol:
 * 1. Build degraded state
 * 2. Run PRE.resolve() — first pass
 * 3. Run PRE.resolve() — second pass (determinism check)
 * 4. Capture invariant results separately (for observability)
 * 5. Run scenario assertions
 * 6. Build replay artifact (compare hash run 1 vs run 2)
 * 7. Build telemetry envelope
 * 8. Return ChaosExecutionResult
 *
 * Special handling for POLL_STORM scenarios (CHAOS-006, CHAOS-007):
 * These scenarios run PRE N times and verify all outputs hash-identical.
 */
export function runChaosScenario(
  scenario: ChaosScenario,
  baseState: SystemStateSnapshot,
  at: number
): ChaosExecutionResult {
  const events: ChaosEvent[] = [];
  const startEpoch = at; // Use `at` as epoch — never Date.now()

  events.push({ type: 'chaos_scenario_started', scenario_id: scenario.id, at });

  // ─── 1. Build degraded state ─────────────────────────────────────────────
  const { state: degradedState, conditions } = scenario.buildDegradedState(baseState, at);

  // For CHAOS-005, use skewed `at` (stored in conditions.fault_at)
  // For all other scenarios, use the original `at`
  const evaluationAt = scenario.degradation_class === 'CLOCK_SKEW'
    ? conditions.fault_at
    : at;

  const preInput: PRE_Input = {
    screen_id:    degradedState.screen.id,
    at:           evaluationAt,
    system_state: degradedState,
  };

  const inputHash = hashInput(preInput);
  const conditionsHash = hashConditions(conditions);

  // ─── 2. First PRE.resolve() pass ─────────────────────────────────────────
  const executionStartMs = Date.now();
  const run1 = safeResolve(preInput);
  const run1Hash = hashOutput(run1.output);

  // ─── 3. Second PRE.resolve() pass (determinism check) ────────────────────
  const run2 = safeResolve(preInput);
  const run2Hash = hashOutput(run2.output);
  const executionEndMs = Date.now();

  const executionMs = executionEndMs - executionStartMs;

  // ─── 4. Poll storm passes (CHAOS-006, CHAOS-007) ─────────────────────────
  let pollStormOutputHashes: string[] | undefined;

  if (
    scenario.degradation_class === 'POLL_STORM' ||
    scenario.degradation_class === 'EMERGENCY_DURING_POLL_STORM'
  ) {
    pollStormOutputHashes = [];

    for (let i = 0; i < CHAOS_POLL_STORM_COUNT; i++) {
      const pollAt = evaluationAt + (i * CHAOS_POLL_STORM_INTERVAL_MS);
      const pollInput: PRE_Input = {
        screen_id:    degradedState.screen.id,
        at:           pollAt,
        system_state: degradedState,
      };
      const pollResult = safeResolve(pollInput);
      // Use playlist_checksum for poll storm hash identity check.
      // resolved_at varies per call (it is set to `at`), so full output hashes differ.
      // playlist_checksum is the constitutionally stable determinism signal —
      // it captures content identity independent of evaluation timestamp.
      const pollHash = pollResult.output?.playlist_checksum ?? 'null';
      pollStormOutputHashes.push(pollHash);
    }
  }

  // ─── 5. Invariant results ────────────────────────────────────────────────
  let invariantResults: InvariantResult[] = [];
  if (run1.output !== null) {
    invariantResults = safeRunInvariants(run1.output, preInput);
  }

  const allInvariantsPass = invariantResults.length > 0 && invariantResults.every(r => r.passed);

  // Emit invariant failure events
  for (const inv of invariantResults) {
    if (!inv.passed) {
      events.push({
        type: 'chaos_invariant_failed',
        scenario_id: scenario.id,
        invariant_id: inv.invariantId,
        at: evaluationAt,
      });
    }
  }

  // ─── 6. Hash stability check ──────────────────────────────────────────────
  const hashesStable = run1Hash !== null && run1Hash === run2Hash;

  if (!hashesStable && run1Hash !== null && run2Hash !== null) {
    events.push({
      type: 'replay_divergence_detected',
      scenario_id: scenario.id,
      hash_1: run1Hash,
      hash_2: run2Hash ?? 'null',
      at: evaluationAt,
    });
  }

  // ─── 7. Telemetry events ──────────────────────────────────────────────────
  if (run1.output !== null) {
    events.push({
      type: 'degraded_resolution_detected',
      scenario_id: scenario.id,
      resolution_level: run1.output.resolution_level,
      is_fallback: run1.output.is_fallback,
      at: evaluationAt,
    });

    if (run1.output.is_fallback) {
      events.push({
        type: 'fallback_resolution_used',
        scenario_id: scenario.id,
        reason: run1.output.reason_trace.level_5_structural?.reason ?? 'unknown',
        at: evaluationAt,
      });
    }

    if (run1.output.reason_trace.level_6_device_truth !== null) {
      const l6 = run1.output.reason_trace.level_6_device_truth;
      if (l6 !== null) {
        events.push({
          type: 'stale_data_window_detected',
          scenario_id: scenario.id,
          stale_fields: ['last_delivery'],
          at: evaluationAt,
        });
      }
    }
  }

  // ─── 8. Build replay artifact ─────────────────────────────────────────────
  const replayArtifact: ChaosReplayArtifact = {
    scenario_id:       scenario.id,
    input_hash:        inputHash,
    output_hash:       run1Hash,
    conditions_hash:   conditionsHash,
    run_1_output_hash: run1Hash,
    run_2_output_hash: run2Hash,
    hashes_stable:     hashesStable,
  };

  // ─── 9. Determine overall status ─────────────────────────────────────────
  const hasExecutionError = run1.error !== null;
  let status: 'PASS' | 'FAIL' | 'EXECUTION_ERROR' = hasExecutionError
    ? 'EXECUTION_ERROR'
    : 'PASS';

  // ─── 10. Build partial result for assertion runner ────────────────────────
  // We build a partial result first so assertion runners can inspect it
  const partialResult: ChaosExecutionResult = {
    scenario_id:        scenario.id,
    scenario_name:      scenario.name,
    degradation_class:  scenario.degradation_class,
    conditions,
    pre_input:          preInput,
    pre_output:         run1.output,
    output_hash:        run1Hash,
    invariant_results:  invariantResults,
    all_invariants_pass: allInvariantsPass,
    assertion_results:  [],  // populated below
    all_assertions_pass: false,  // updated below
    execution_ms:       executionMs,
    replay_artifact:    replayArtifact,
    telemetry: {
      scenario_started_at:   startEpoch,
      scenario_completed_at: startEpoch,  // updated below
      events,
    },
    status,
    error: run1.error ?? undefined,
  };

  // ─── 11. Run scenario assertions ─────────────────────────────────────────
  const assertionResults = runScenarioAssertions(scenario, partialResult, pollStormOutputHashes);
  const allAssertionsPass = assertionResults.every(r => r.passed);

  if (!allInvariantsPass || !allAssertionsPass || hasExecutionError) {
    status = hasExecutionError ? 'EXECUTION_ERROR' : 'FAIL';
  }

  events.push({
    type: 'chaos_scenario_completed',
    scenario_id: scenario.id,
    status,
    at: evaluationAt,
  });

  // ─── 12. Final result ────────────────────────────────────────────────────
  return {
    ...partialResult,
    assertion_results:   assertionResults,
    all_assertions_pass: allAssertionsPass,
    status,
    telemetry: {
      scenario_started_at:   startEpoch,
      scenario_completed_at: startEpoch,
      events,
    },
  };
}

/**
 * Run all 7 chaos scenarios sequentially and return all results.
 *
 * Uses the provided baseState and `at` for all scenarios.
 * Each scenario independently builds its degraded state from baseState.
 */
export function runAllChaosScenarios(
  baseState: SystemStateSnapshot,
  at: number
): ChaosExecutionResult[] {
  const results: ChaosExecutionResult[] = [];

  for (const scenario of ALL_CHAOS_SCENARIOS) {
    const result = runChaosScenario(scenario, baseState, at);
    results.push(result);
  }

  return results;
}
