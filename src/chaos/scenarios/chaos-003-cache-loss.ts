/**
 * CHAOS-003 — Cache Loss Mid-Resolution
 *
 * Condition: Cache evicted. content_items is empty (cache miss with no fallback).
 * Schedules reference content that isn't in state.
 *
 * Expected:
 *   - PRE uses SYSTEM_FALLBACK_CONTENT_ID for missing content, or falls to LEVEL_5
 *   - All invariants pass
 *   - Output contains only valid content_ids (system fallback or SYSTEM_EMERGENCY_FALLBACK_ID)
 *
 * Key assertion: all playlist content_ids are valid system fallback IDs or pre-known IDs
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 */

import type { ChaosScenario } from '../types';
import { injectEmptyContentItems } from '../fixtures/deterministic-fault-injector';

export const chaos003CacheLoss: ChaosScenario = {
  id:                 'CHAOS-003',
  name:               'Cache Loss — Empty Content Items',
  description:        'Cache evicted. content_items array is empty. Schedules reference ' +
                      'content that no longer exists in state. PRE must use system fallback ' +
                      'or gracefully resolve to LEVEL_5 without throwing.',
  degradation_class:  'CACHE_LOSS',

  buildDegradedState(baseState, at) {
    // Clear content items — simulates cache miss
    const state = injectEmptyContentItems(baseState);

    return {
      state,
      conditions: {
        class:            'CACHE_LOSS',
        description:      'Cache evicted — content_items cleared to empty array. ' +
                          'Schedules still reference content_ids that no longer exist in state.',
        injected_faults:  ['content_items: []'],
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
      'assertCacheAbsenceNoAuthorityChange',
      // Output must only contain valid content_ids
      'all_playlist_content_ids_valid',
    ],
  },
};
