/**
 * CHAOS-004 — Event Bus Lag
 *
 * Condition: Event bus lagged 30 minutes. Override starts_at is 30 minutes ago
 * but was just received. Override should still be active (starts_at <= at).
 * Also: last_delivery is cleared (30 min stale).
 *
 * Expected:
 *   - Override IS recognized as active (half-open interval: starts_at <= at)
 *   - LEVEL_1 operational override resolves
 *   - resolution_level: 1
 *   - All invariants pass
 *
 * Key assertion: resolution_level === 1 (override correctly picked up despite lag)
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import {
  injectLaggedOverride,
  injectNullDeliveryLog,
} from '../fixtures/deterministic-fault-injector';
import { CHAOS_EVENT_BUS_LAG_MS } from '../constants';
import { CHAOS_CONTENT_B_ID } from '../fixtures/degraded-state-factory';

export const chaos004EventBusLag: ChaosScenario = {
  id:                 'CHAOS-004',
  name:               'Event Bus Lag — Delayed Override Delivery',
  description:        'Event bus lagged 30 minutes. Override starts_at is 30 minutes ago ' +
                      'but was just received. Per half-open interval rule (starts_at <= at), ' +
                      'override must still be recognized as active. PRE must resolve at LEVEL_1.',
  degradation_class:  'EVENT_BUS_LAG',

  buildDegradedState(baseState, at) {
    // Inject lagged override: started 30 min ago, still within expires_at window
    let state = injectLaggedOverride(baseState, at, CHAOS_EVENT_BUS_LAG_MS, CHAOS_CONTENT_B_ID);
    // Clear delivery log (simulate restart during lag window)
    state = injectNullDeliveryLog(state);

    return {
      state,
      conditions: {
        class:            'EVENT_BUS_LAG',
        description:      `Event bus lagged ${CHAOS_EVENT_BUS_LAG_MS}ms. Override starts_at = at - lag, ` +
                          'expires_at = at + lag. Override still valid per half-open interval. ' +
                          'last_delivery cleared.',
        injected_faults:  [
          `overrides[0].starts_at: at - ${CHAOS_EVENT_BUS_LAG_MS}ms (lagged delivery)`,
          `overrides[0].expires_at: at + ${CHAOS_EVENT_BUS_LAG_MS}ms`,
          'overrides[0].is_operational: true',
          'last_delivery: null',
        ],
        fault_at:         at,
      },
    };
  },

  expectedBehavior: {
    resolution_level:         1,
    is_fallback:              false,
    invariants_pass:          true,
    reason_trace_explainable: true,
    assertions: [
      'assertNeverThrows',
      'assertSystemFallbackAlwaysResolves',
      'assertReplayHashStable',
      'assertReasonTraceExplainable',
      'assertNoInvariantSuppression',
      'resolution_level === 1',
      'is_fallback === false',
    ],
  },
};
