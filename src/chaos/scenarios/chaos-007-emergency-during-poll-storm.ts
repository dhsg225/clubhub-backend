/**
 * CHAOS-007 — Emergency During Poll Storm
 *
 * Condition: Emergency is active. PRE called 10 times with at, at+1ms, ..., at+9ms.
 * Emergency precedence is absolute — LEVEL_0 must be the only resolution.
 *
 * Expected:
 *   - All 10 outputs: resolution_level === 0
 *   - All 10 outputs: identical output_hash (absolute determinism)
 *   - reason_trace.level_1_operational === null (skipped at LEVEL_0)
 *   - reason_trace.level_5_structural === null (skipped at LEVEL_0)
 *   - INV-7 (emergency_absolute) passes on all 10 outputs
 *   - All invariants pass
 *
 * Key assertions:
 *   - resolution_level === 0 for all 10 calls
 *   - all 10 output_hashes identical
 *   - emergency levels skipped (null traces for L1, L5)
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import { injectActiveEmergency } from '../fixtures/deterministic-fault-injector';
import { CHAOS_POLL_STORM_COUNT } from '../constants';

export const chaos007EmergencyDuringPollStorm: ChaosScenario = {
  id:                 'CHAOS-007',
  name:               'Emergency During Poll Storm — Absolute Precedence Verification',
  description:        `Emergency active. PRE called ${CHAOS_POLL_STORM_COUNT} times in rapid ` +
                      'succession. All outputs must resolve at LEVEL_0 with identical hash. ' +
                      'Emergency precedence is absolute — no other level may interfere.',
  degradation_class:  'EMERGENCY_DURING_POLL_STORM',

  buildDegradedState(baseState, at) {
    // Inject active emergency — this is the key fault
    const state = injectActiveEmergency(baseState, at);

    return {
      state,
      conditions: {
        class:            'EMERGENCY_DURING_POLL_STORM',
        description:      `Emergency injected at at - 5min. PRE called ${CHAOS_POLL_STORM_COUNT} ` +
                          'times in rapid succession. All outputs must be LEVEL_0 with identical hash.',
        injected_faults:  [
          'emergency.is_active: true',
          `emergency.activated_at: at - 300000ms (5 minutes before)`,
          `evaluation_count: ${CHAOS_POLL_STORM_COUNT}`,
          `at_offsets: 0ms through ${CHAOS_POLL_STORM_COUNT - 1}ms`,
        ],
        fault_at:         at,
      },
    };
  },

  expectedBehavior: {
    resolution_level:         0,
    is_fallback:              false,
    invariants_pass:          true,
    reason_trace_explainable: true,
    assertions: [
      'assertNeverThrows',
      'assertSystemFallbackAlwaysResolves',
      'assertReplayHashStable',
      'assertReasonTraceExplainable',
      'assertEmergencyPrecedenceAbsolute',
      'assertNoInvariantSuppression',
      'assertNoReplayWrites',
      'resolution_level === 0',
      'all_poll_storm_outputs_hash_identical',
      'level_1_operational_trace === null',
      'level_5_structural_trace === null',
    ],
  },
};
