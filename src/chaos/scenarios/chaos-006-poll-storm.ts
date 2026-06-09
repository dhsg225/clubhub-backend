/**
 * CHAOS-006 — Poll Storm
 *
 * Condition: Same state called N times rapidly (N = CHAOS_POLL_STORM_COUNT = 10).
 * Each call uses a slightly different `at` (at, at+1ms, at+2ms, ..., at+9ms).
 * All schedule windows don't change within 1 second, so all outputs must be identical.
 *
 * Expected:
 *   - All 10 outputs have identical output_hash (PRE is pure)
 *   - All invariants pass on every output
 *   - No divergence between runs
 *
 * Key assertion: all 10 output_hashes are identical (poll storm doesn't break determinism)
 *
 * Note: This scenario is handled specially by the runner — it calls PRE N times
 * and verifies hash identity across all runs, not just 2.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import { CHAOS_POLL_STORM_COUNT } from '../constants';

export const chaos006PollStorm: ChaosScenario = {
  id:                 'CHAOS-006',
  name:               'Poll Storm — Rapid Sequential Evaluation',
  description:        `PRE called ${CHAOS_POLL_STORM_COUNT} times rapidly with at, at+1ms, ..., ` +
                      `at+${CHAOS_POLL_STORM_COUNT - 1}ms. All outputs must hash-stable ` +
                      '(schedule windows do not change within 1 second). PRE must be pure.',
  degradation_class:  'POLL_STORM',

  buildDegradedState(baseState, at) {
    // No fault injection needed for CHAOS-006.
    // The poll storm effect is produced by the runner calling PRE N times.
    // State is returned unmodified; runner is responsible for the multiple calls.
    return {
      state: { ...baseState },
      conditions: {
        class:            'POLL_STORM',
        description:      `Poll storm: PRE called ${CHAOS_POLL_STORM_COUNT} times in rapid succession. ` +
                          `Timestamps: at+0ms through at+${CHAOS_POLL_STORM_COUNT - 1}ms. ` +
                          'All outputs must have identical output_hash.',
        injected_faults:  [
          `evaluation_count: ${CHAOS_POLL_STORM_COUNT}`,
          `at_offsets: 0ms through ${CHAOS_POLL_STORM_COUNT - 1}ms`,
        ],
        fault_at:         at,
      },
    };
  },

  expectedBehavior: {
    resolution_level:         'any',
    is_fallback:              'any',
    invariants_pass:          true,
    reason_trace_explainable: true,
    assertions: [
      'assertNeverThrows',
      'assertSystemFallbackAlwaysResolves',
      'assertReplayHashStable',
      'assertReasonTraceExplainable',
      'assertNoInvariantSuppression',
      'assertOutputOrdering',
      'all_poll_storm_outputs_hash_identical',
    ],
  },
};
