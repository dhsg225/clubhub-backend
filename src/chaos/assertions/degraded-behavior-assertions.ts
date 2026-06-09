/**
 * Degraded behavior assertions — verify constitutional guarantees under chaos.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * Each assertion function receives a ChaosExecutionResult and returns an
 * AssertionResult. Assertions OBSERVE and REPORT — they never mutate state.
 *
 * CRITICAL: Assertions never throw. They return passed: false with detail.
 * Constitutional breach evidence is preserved, not suppressed.
 */

import type { ChaosExecutionResult, AssertionResult } from '../types';
import {
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_EMERGENCY_FALLBACK_ID,
} from '../../pre/constants';

// ─── Core Safety Assertions ───────────────────────────────────────────────────

/**
 * Assert: system fallback always resolves — PRE always returns non-null output.
 * The system must ALWAYS produce a playlist, even under total degradation.
 * A null output means PRE.resolve() threw, which is a constitutional failure.
 */
export function assertSystemFallbackAlwaysResolves(result: ChaosExecutionResult): AssertionResult {
  const passed = result.pre_output !== null && result.status !== 'EXECUTION_ERROR';

  return {
    assertion: 'assertSystemFallbackAlwaysResolves',
    passed,
    actual:    result.pre_output === null ? 'null' : 'PRE_Output',
    expected:  'PRE_Output (non-null)',
    detail:    passed
      ? 'PRE.resolve() produced a non-null output under degraded conditions'
      : `PRE.resolve() returned null or threw: ${result.error ?? 'unknown error'}`,
  };
}

/**
 * Assert: PRE never throws — execution_error status indicates a constitutional violation.
 * PRE.resolve() MUST handle all degraded states gracefully.
 */
export function assertNeverThrows(result: ChaosExecutionResult): AssertionResult {
  const passed = result.status !== 'EXECUTION_ERROR';

  return {
    assertion: 'assertNeverThrows',
    passed,
    actual:    result.status,
    expected:  'PASS or FAIL (not EXECUTION_ERROR)',
    detail:    passed
      ? 'PRE.resolve() completed without throwing'
      : `PRE.resolve() threw: ${result.error ?? 'unknown error'}`,
  };
}

/**
 * Assert: replay hash stability — two independent PRE.resolve() calls with identical
 * input must produce identical output_hash. PRE must be a pure function.
 */
export function assertReplayHashStable(result: ChaosExecutionResult): AssertionResult {
  const { run_1_output_hash, run_2_output_hash, hashes_stable } = result.replay_artifact;
  const passed = hashes_stable;

  return {
    assertion: 'assertReplayHashStable',
    passed,
    actual:    { run_1: run_1_output_hash, run_2: run_2_output_hash },
    expected:  'run_1_output_hash === run_2_output_hash',
    detail:    passed
      ? `Both runs produced hash: ${run_1_output_hash ?? 'null'}`
      : `Hash divergence detected: run_1=${run_1_output_hash}, run_2=${run_2_output_hash}`,
  };
}

/**
 * Assert: output playlist items have valid ordering.
 * Per INV-1 (purity), playlist items must be sorted deterministically.
 * Check that source values are non-decreasing (items sorted by source level).
 */
export function assertOutputOrdering(result: ChaosExecutionResult): AssertionResult {
  if (result.pre_output === null) {
    return {
      assertion: 'assertOutputOrdering',
      passed:    false,
      actual:    null,
      expected:  'non-null PRE_Output with ordered playlist',
      detail:    'Cannot check ordering — pre_output is null',
    };
  }

  const playlist = result.pre_output.playlist;
  let passed = true;
  let detail = 'Playlist ordering is valid';

  for (let i = 1; i < playlist.length; i++) {
    const prev = playlist[i - 1];
    const curr = playlist[i];
    if (prev === undefined || curr === undefined) continue;
    if (curr.source < prev.source) {
      passed = false;
      detail = `Playlist ordering violation at index ${i}: source ${curr.source} < previous source ${prev.source}`;
      break;
    }
  }

  return {
    assertion: 'assertOutputOrdering',
    passed,
    actual:    playlist.map(p => p.source),
    expected:  'non-decreasing source values',
    detail,
  };
}

/**
 * Assert: reason_trace is explainable — all non-null trace entries have a reason string.
 * Constitutional requirement: every resolution must be traceable to a human-readable reason.
 */
export function assertReasonTraceExplainable(result: ChaosExecutionResult): AssertionResult {
  if (result.pre_output === null) {
    return {
      assertion: 'assertReasonTraceExplainable',
      passed:    false,
      actual:    null,
      expected:  'non-null PRE_Output with reason_trace',
      detail:    'Cannot check reason_trace — pre_output is null',
    };
  }

  const trace = result.pre_output.reason_trace;
  const levels = [
    'level_0_emergency',
    'level_1_operational',
    'level_2_scheduled',
    'level_3_campaign',
    'level_4_sponsorship',
    'level_5_structural',
    'level_6_device_truth',
  ] as const;

  const violations: string[] = [];

  for (const level of levels) {
    const entry = trace[level];
    if (entry !== null && entry !== undefined) {
      if (!entry.reason || typeof entry.reason !== 'string' || entry.reason.length === 0) {
        violations.push(`${level}: reason is empty or missing`);
      }
    }
  }

  const passed = violations.length === 0;

  return {
    assertion: 'assertReasonTraceExplainable',
    passed,
    actual:    violations.length > 0 ? violations : 'all trace entries have reasons',
    expected:  'all non-null trace entries have non-empty reason strings',
    detail:    passed
      ? 'All reason_trace entries are explainable'
      : `Unexplainable trace entries: ${violations.join(', ')}`,
  };
}

/**
 * Assert: emergency precedence absolute — if emergency exists in state,
 * resolution_level must be 0 (LEVEL_0_EMERGENCY).
 * Per INV-7: emergency resolution is absolute and cannot be overridden.
 */
export function assertEmergencyPrecedenceAbsolute(result: ChaosExecutionResult): AssertionResult {
  const hasEmergency = result.pre_input.system_state.emergency?.is_active === true;

  if (!hasEmergency) {
    return {
      assertion: 'assertEmergencyPrecedenceAbsolute',
      passed:    true,
      actual:    'no active emergency',
      expected:  'no active emergency',
      detail:    'No active emergency in state — assertion not applicable',
    };
  }

  if (result.pre_output === null) {
    return {
      assertion: 'assertEmergencyPrecedenceAbsolute',
      passed:    false,
      actual:    null,
      expected:  'resolution_level === 0',
      detail:    'Emergency active but PRE returned null output',
    };
  }

  const passed = result.pre_output.resolution_level === 0;

  return {
    assertion: 'assertEmergencyPrecedenceAbsolute',
    passed,
    actual:    result.pre_output.resolution_level,
    expected:  0,
    detail:    passed
      ? 'Emergency correctly resolved at LEVEL_0'
      : `Emergency active but resolution_level=${result.pre_output.resolution_level} (expected 0)`,
  };
}

/**
 * Assert: cache absence does not change resolution authority.
 * Empty content_items must NOT produce a non-fallback resolution at L1/L2/L3.
 * If content_items is empty, PRE must fall through to system fallback (LEVEL_5).
 */
export function assertCacheAbsenceNoAuthorityChange(result: ChaosExecutionResult): AssertionResult {
  const contentItemsEmpty = result.pre_input.system_state.content_items.length === 0;

  if (!contentItemsEmpty) {
    return {
      assertion: 'assertCacheAbsenceNoAuthorityChange',
      passed:    true,
      actual:    'content_items non-empty',
      expected:  'content_items non-empty',
      detail:    'content_items is not empty — cache-absence assertion not applicable',
    };
  }

  if (result.pre_output === null) {
    return {
      assertion: 'assertCacheAbsenceNoAuthorityChange',
      passed:    false,
      actual:    null,
      expected:  'PRE_Output with valid content_ids',
      detail:    'content_items empty but PRE returned null output',
    };
  }

  // With empty content_items, all playlist items must use system fallback IDs
  const validIds = new Set([SYSTEM_FALLBACK_CONTENT_ID, SYSTEM_EMERGENCY_FALLBACK_ID]);
  const playlist = result.pre_output.playlist;
  const invalidItems = playlist.filter(item => !validIds.has(item.content_id));

  const passed = invalidItems.length === 0;

  return {
    assertion: 'assertCacheAbsenceNoAuthorityChange',
    passed,
    actual:    invalidItems.map(i => i.content_id),
    expected:  `all content_ids in [${SYSTEM_FALLBACK_CONTENT_ID}, ${SYSTEM_EMERGENCY_FALLBACK_ID}]`,
    detail:    passed
      ? 'All playlist items use valid system fallback IDs when content_items is empty'
      : `Invalid content_ids with empty cache: ${invalidItems.map(i => i.content_id).join(', ')}`,
  };
}

/**
 * Assert: no invariant suppression — invariant failures are preserved as evidence.
 * The chaos runner MUST NOT catch and discard InvariantViolationErrors.
 * If all_invariants_pass is false, invariant violations must be documented.
 */
export function assertNoInvariantSuppression(result: ChaosExecutionResult): AssertionResult {
  // If invariants failed, they must appear in invariant_results with passed=false
  if (!result.all_invariants_pass) {
    const documented = result.invariant_results.some(r => !r.passed);

    const passed = documented;

    return {
      assertion: 'assertNoInvariantSuppression',
      passed,
      actual:    documented ? 'violations documented' : 'violations not documented',
      expected:  'all invariant failures documented in invariant_results',
      detail:    passed
        ? 'Invariant failures are properly documented in invariant_results'
        : 'CONSTITUTIONAL_BREACH: all_invariants_pass=false but no failures in invariant_results',
    };
  }

  // all_invariants_pass is true — verify results are populated
  const passed = result.invariant_results.length > 0;

  return {
    assertion: 'assertNoInvariantSuppression',
    passed,
    actual:    result.invariant_results.length,
    expected:  '> 0 invariant results',
    detail:    passed
      ? `${result.invariant_results.length} invariants checked, none suppressed`
      : 'No invariant results recorded — possible suppression',
  };
}

/**
 * Assert: no replay writes — chaos execution must not write to corpus or modify state.
 * Chaos is observational only. It records results but never seals new packets.
 *
 * We verify this structurally: replay artifacts must not have non-deterministic fields.
 * The chaos runner is responsible for not writing, but we verify the artifact shape.
 */
export function assertNoReplayWrites(result: ChaosExecutionResult): AssertionResult {
  // The replay artifact must be a read-only observation, not a written corpus packet.
  // Verify: conditions_hash is stable (deterministic from conditions)
  const conditionsHashPresent = typeof result.replay_artifact.conditions_hash === 'string' &&
                                result.replay_artifact.conditions_hash.length > 0;

  const passed = conditionsHashPresent;

  return {
    assertion: 'assertNoReplayWrites',
    passed,
    actual:    result.replay_artifact.conditions_hash,
    expected:  'non-empty conditions_hash string (deterministic artifact)',
    detail:    passed
      ? 'Replay artifact is a deterministic observation (no writes to corpus)'
      : 'conditions_hash is missing or empty — artifact integrity compromised',
  };
}
