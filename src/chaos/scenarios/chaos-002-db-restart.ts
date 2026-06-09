/**
 * CHAOS-002 — DB Restart with Stale-Read Window
 *
 * Condition: DB restarted. Schedules present but all is_active: false (stale read).
 * Overrides list empty. Delivery log cleared.
 *
 * Expected:
 *   - PRE falls through to LEVEL_5 system fallback
 *   - is_fallback: true
 *   - resolution_level: 5
 *   - All invariants pass
 *
 * Key assertion: resolution_level === 5, is_fallback === true
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import {
  injectStaleSchedules,
  injectNullDeliveryLog,
} from '../fixtures/deterministic-fault-injector';

export const chaos002DbRestart: ChaosScenario = {
  id:                 'CHAOS-002',
  name:               'DB Restart — Stale Read Window',
  description:        'DB restarted. Stale read returned inactive schedule records. ' +
                      'Overrides cleared. last_delivery null. PRE must fall through to ' +
                      'LEVEL_5 system fallback without throwing.',
  degradation_class:  'DB_RESTART_STALE_READ',

  buildDegradedState(baseState, at) {
    // Apply stale schedules (all is_active: false, overrides cleared)
    let state = injectStaleSchedules(baseState);
    // Also clear delivery log (DB restart clears this too)
    state = injectNullDeliveryLog(state);

    return {
      state,
      conditions: {
        class:            'DB_RESTART_STALE_READ',
        description:      'DB restarted — stale read returned inactive schedules. ' +
                          'All schedules set is_active: false. Overrides cleared. last_delivery null.',
        injected_faults:  [
          'schedules[*].is_active: false',
          'overrides: []',
          'last_delivery: null',
        ],
        fault_at:         at,
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
      'resolution_level === 5',
      'is_fallback === true',
    ],
  },
};
