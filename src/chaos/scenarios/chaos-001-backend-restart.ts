/**
 * CHAOS-001 — Backend Restart
 *
 * Condition: Backend just restarted. Delivery log cleared (last_delivery = null).
 * Screen is active but has no delivery history.
 *
 * Expected:
 *   - PRE resolves normally — campaigns/schedules still in state
 *   - LEVEL_6 annotates confidence_score = CONFIDENCE_NO_DELIVERY_LOG (0.5000)
 *   - Fallback depends on whether schedules are active
 *   - All invariants pass
 *
 * Key assertion: confidence_score === 0.5000 (CONFIDENCE_NO_DELIVERY_LOG)
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import { injectNullDeliveryLog } from '../fixtures/deterministic-fault-injector';
import { CONFIDENCE_NO_DELIVERY_LOG } from '../../pre/constants';

export const chaos001BackendRestart: ChaosScenario = {
  id:                 'CHAOS-001',
  name:               'Backend Restart — Delivery Log Cleared',
  description:        'Backend restarted. last_delivery is null (delivery log cleared). ' +
                      'Screen is active but has no delivery history. ' +
                      'PRE must still resolve content normally, with reduced confidence.',
  degradation_class:  'BACKEND_RESTART',

  buildDegradedState(baseState, at) {
    const state = injectNullDeliveryLog(baseState);

    return {
      state,
      conditions: {
        class:            'BACKEND_RESTART',
        description:      'Backend restarted — delivery log cleared. last_delivery set to null.',
        injected_faults:  ['last_delivery: null'],
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
      // CHAOS-001 specific: confidence_score must be CONFIDENCE_NO_DELIVERY_LOG
      `confidence_score === ${CONFIDENCE_NO_DELIVERY_LOG}`,
    ],
  },
};
