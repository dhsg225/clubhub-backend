/**
 * Deterministic fault injectors — all fault injection is explicit and reproducible.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * CRITICAL CONSTRAINTS:
 *   - Each injector returns a NEW state object (no mutation of original)
 *   - No Math.random() — all fault injection deterministic
 *   - No Date.now() — use `at` parameter only
 *   - All faults are explicitly documented in the returned conditions
 */

import type {
  SystemStateSnapshot,
  OverrideRecord,
  EmergencyStateRecord,
} from '../../pre/types';
import {
  CHAOS_VENUE_ID,
  CHAOS_CONTENT_A_ID,
  CHAOS_EMERGENCY_ID,
} from './degraded-state-factory';

// ─── Fault Injectors ──────────────────────────────────────────────────────────

/**
 * Inject null delivery log — simulates backend restart where delivery log was cleared.
 * PRE will annotate LEVEL_6 with CONFIDENCE_NO_DELIVERY_LOG (0.5000).
 */
export function injectNullDeliveryLog(state: SystemStateSnapshot): SystemStateSnapshot {
  return {
    ...state,
    last_delivery: null,
  };
}

/**
 * Inject stale schedules — simulates DB restart where stale read returned inactive records.
 * All schedules get is_active: false. PRE cannot use them for resolution.
 */
export function injectStaleSchedules(state: SystemStateSnapshot): SystemStateSnapshot {
  return {
    ...state,
    schedules: state.schedules.map(s => ({ ...s, is_active: false })),
    overrides: [],
  };
}

/**
 * Inject empty content items — simulates cache eviction with no fallback data.
 * Schedules may reference content_ids that no longer exist in state.
 */
export function injectEmptyContentItems(state: SystemStateSnapshot): SystemStateSnapshot {
  return {
    ...state,
    content_items: [],
  };
}

/**
 * Inject expired schedules — simulates clock skew where all schedules are in the past.
 * Every schedule gets expires_at = at - 1000 (1 second before evaluation time).
 * Also clears overrides to force fallback path.
 */
export function injectExpiredSchedules(state: SystemStateSnapshot, at: number): SystemStateSnapshot {
  return {
    ...state,
    schedules: state.schedules.map(s => ({
      ...s,
      expires_at: at - 1_000,  // expired 1 second before evaluation time
    })),
    overrides: [],
  };
}

/**
 * Inject lagged override — simulates event bus delay.
 * The override started `lagMs` ago (relative to `at`) but was "just received".
 * Because starts_at <= at, it is still valid per the half-open interval rule.
 *
 * The override replaces all existing overrides to ensure clean resolution path.
 */
export function injectLaggedOverride(
  state: SystemStateSnapshot,
  at: number,
  lagMs: number,
  contentId: string
): SystemStateSnapshot {
  const laggedOverride: OverrideRecord = {
    id:             'lag-override-001',
    content_id:     contentId,
    is_operational: true,
    target_type:    'venue',
    target_id:      CHAOS_VENUE_ID,
    starts_at:      at - lagMs,    // started `lagMs` ago — still active
    expires_at:     at + lagMs,    // expires `lagMs` from now
    priority:       100,
    reason:         'event-bus-lag-test',
    issued_by:      'chaos-004',
  };

  return {
    ...state,
    overrides: [laggedOverride],
  };
}

/**
 * Inject active emergency — creates an active emergency for the venue.
 * Emergency activated 5 minutes before `at`.
 *
 * Replaces any existing emergency with a known active one.
 */
export function injectActiveEmergency(state: SystemStateSnapshot, at: number): SystemStateSnapshot {
  const emergency: EmergencyStateRecord = {
    id:           CHAOS_EMERGENCY_ID,
    venue_id:     CHAOS_VENUE_ID,
    content_id:   CHAOS_CONTENT_A_ID,
    is_global:    false,
    is_active:    true,
    activated_at: at - 5 * 60 * 1000,  // activated 5 minutes ago
    reason:       'chaos-fault-injected-emergency',
  };

  return {
    ...state,
    emergency,
  };
}
