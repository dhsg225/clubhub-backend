/**
 * M-01: Override Divergence Rate
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-01
 *
 * Measures: Fraction of screens in the venue/area whose last resolution used
 * an override (Level 0 emergency, Level 1 operational, or Level 2 scheduled override)
 * rather than structural scheduling (Level 3 campaign or Level 5 structural).
 *
 * Formula:
 *   screens_with_overrides = screens WHERE active_overrides.length > 0
 *   divergence_pct = screens_with_overrides / total_screens × 100
 *   normalized = normalize(divergence_pct, ADVISORY=15, REVIEW=30)
 *
 * Source: overrides array on SystemStateSnapshot (active overrides for this screen)
 *
 * Thresholds (per spec §5.1):
 *   ADVISORY > 15% of screens have active overrides
 *   REVIEW   > 30% of screens have active overrides
 *
 * IMPORTANT: This calculator receives a single-screen SystemStateSnapshot.
 * When called from the venue runner, the divergence_pct is computed per-screen
 * (0% or 100% per screen), then aggregated at the venue level.
 * For per-screen scoring: 1 screen with overrides = 100% divergent.
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M01_ADVISORY_THRESHOLD,
  M01_REVIEW_THRESHOLD,
  M01_OVERRIDE_LEVELS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-01';

/**
 * Compute override divergence for a single screen state.
 *
 * A screen is "diverged" if it has any active override (unexpired, active).
 * Raw value is 0 (no overrides) or 100 (has overrides) for single-screen evaluation.
 */
export function computeM01OverrideDivergence(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const activeOverrides = state.overrides.filter(o => {
      const notExpired = o.expires_at === null || o.expires_at > at;
      return notExpired;
    });

    const hasOverride    = activeOverrides.length > 0;
    // Per-screen: binary (0% or 100% diverged)
    // The venue runner aggregates these into a venue-level percentage
    const raw_value      = hasOverride ? 100 : 0;

    const normalized     = normalizeToUnit(raw_value, M01_ADVISORY_THRESHOLD, M01_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (activeOverrides.length > 0) {
      const permanent = activeOverrides.filter(o => o.expires_at === null);
      const expiring  = activeOverrides.filter(o => o.expires_at !== null);
      if (permanent.length > 0) {
        contributing_factors.push(`${permanent.length} permanent override(s) with no expiry`);
      }
      if (expiring.length > 0) {
        contributing_factors.push(`${expiring.length} time-limited override(s) currently active`);
      }
      const overrideTypes = [...new Set(activeOverrides.map(o => o.target_type))];
      contributing_factors.push(`override target scope(s): ${overrideTypes.join(', ')}`);
    }

    const explanation = hasOverride
      ? `Screen ${state.screen.id} has ${activeOverrides.length} active override(s) — ` +
        `resolution is driven by override (Level 0/1/2) rather than structural scheduling. ` +
        `Override divergence erodes the signal value of area schedules and campaigns.`
      : `Screen ${state.screen.id} has no active overrides — ` +
        `resolution is driven by structural scheduling (campaign or structural level).`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_diverged',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation,
      contributing_factors,
      computed_at:          at,
    };
  } catch {
    return {
      metric_id:            METRIC_ID,
      value:                0,
      raw_value:            0,
      unit:                 'percent_diverged',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-01 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}

// Re-export override levels for downstream use
export { M01_OVERRIDE_LEVELS };
