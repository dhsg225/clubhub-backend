/**
 * CHAOS-005 — Clock Skew
 *
 * Condition: `at` is set to a timestamp 2 hours in the future relative to schedule
 * windows. All schedules have expires_at in the "past" (relative to skewed at).
 * No overrides.
 *
 * Expected:
 *   - All schedules expired → LEVEL_5 system fallback
 *   - is_fallback: true
 *   - PRE handles far-future `at` gracefully — no exception
 *   - All invariants pass
 *
 * Key assertion: is_fallback === true, no exception thrown
 *
 * Note: The skewed `at` is used when calling PRE.resolve(). The buildDegradedState
 * returns the skewed `at` via fault_at so the runner knows to use it.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import { injectExpiredSchedules } from '../fixtures/deterministic-fault-injector';
import { CHAOS_CLOCK_SKEW_MS } from '../constants';

export const chaos005ClockSkew: ChaosScenario = {
  id:                 'CHAOS-005',
  name:               'Clock Skew — Far-Future Evaluation Timestamp',
  description:        `System clock skewed ${CHAOS_CLOCK_SKEW_MS}ms into the future. ` +
                      'All schedules expired (expires_at < skewed_at). No overrides. ' +
                      'PRE must handle far-future `at` gracefully and fall back to LEVEL_5.',
  degradation_class:  'CLOCK_SKEW',

  buildDegradedState(baseState, at) {
    const skewedAt = at + CHAOS_CLOCK_SKEW_MS;

    // Expire all schedules relative to skewedAt (already done by injector using `at`)
    // The injector sets expires_at = at - 1000, so with skewedAt they're all expired
    const state = injectExpiredSchedules(baseState, skewedAt);

    return {
      state,
      conditions: {
        class:            'CLOCK_SKEW',
        description:      `Clock skewed ${CHAOS_CLOCK_SKEW_MS}ms forward. ` +
                          'schedules[*].expires_at = skewedAt - 1000 (all expired). ' +
                          'overrides: [] (cleared). Evaluation uses skewedAt.',
        injected_faults:  [
          `at: at + ${CHAOS_CLOCK_SKEW_MS} (clock skew applied to evaluation timestamp)`,
          `schedules[*].expires_at: skewedAt - 1000 (expired before skewed evaluation time)`,
          'overrides: [] (cleared)',
        ],
        fault_at:         skewedAt,  // runner will use this as the `at` for PRE.resolve()
      },
    };
  },

  expectedBehavior: {
    resolution_level:         5,
    is_fallback:              true,
    invariants_pass:          true,
    reason_trace_explainable: true,
    assertions: [
      'assertNeverThrows',
      'assertSystemFallbackAlwaysResolves',
      'assertReplayHashStable',
      'assertReasonTraceExplainable',
      'assertNoInvariantSuppression',
      'is_fallback === true',
    ],
  },
};
