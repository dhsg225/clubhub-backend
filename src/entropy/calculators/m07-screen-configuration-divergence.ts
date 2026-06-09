/**
 * M-07: Screen Configuration Divergence
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-12
 * (Screen Configuration Staleness Index), §7.2 Staleness Classification
 *
 * Measures: Whether the screen's configuration (overrides) has had no operator
 * attention in more than M07_STALENESS_AGE_MS (90 days). Configuration that
 * has not been touched in 90 days either:
 *   - Is working as intended and doesn't need attention (low risk)
 *   - Has been forgotten and may no longer reflect current intent (medium risk)
 *   - Was created by staff who have since left (Class D staleness, higher risk)
 *
 * Formula:
 *   stale_overrides = overrides WHERE (at - starts_at) > 90 days
 *   total_overrides = overrides.length
 *   if total_overrides == 0: raw_value = 0 (no overrides = no staleness)
 *   else: raw_value = stale_overrides / total_overrides × 100
 *   normalized = normalize(raw_value, ADVISORY=20, REVIEW=40)
 *
 * Source: overrides array on SystemStateSnapshot
 *
 * Thresholds (per spec §5.1 M-12):
 *   ADVISORY > 20% of overrides are stale (> 90 days)
 *   REVIEW   > 40% of overrides are stale (> 90 days)
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M07_ADVISORY_THRESHOLD,
  M07_REVIEW_THRESHOLD,
  M07_STALENESS_AGE_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-07';

export function computeM07ScreenConfigurationDivergence(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const allOverrides = state.overrides;

    if (allOverrides.length === 0) {
      return {
        metric_id:            METRIC_ID,
        value:                0,
        raw_value:            0,
        unit:                 'percent_stale_overrides',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          'No overrides exist. Configuration divergence is 0.',
        contributing_factors: [],
        computed_at:          at,
      };
    }

    const staleOverrides = allOverrides.filter(o => {
      const age = at - o.starts_at;
      return age > M07_STALENESS_AGE_MS;
    });

    const raw_value  = (staleOverrides.length / allOverrides.length) * 100;
    const normalized = normalizeToUnit(raw_value, M07_ADVISORY_THRESHOLD, M07_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (staleOverrides.length > 0) {
      contributing_factors.push(
        `${staleOverrides.length} of ${allOverrides.length} override(s) older than 90 days`
      );
      const permanentStale = staleOverrides.filter(o => o.expires_at === null);
      if (permanentStale.length > 0) {
        contributing_factors.push(`${permanentStale.length} permanent stale override(s) (no expiry)`);
      }
      const withNoReason = staleOverrides.filter(o => !o.reason).length;
      if (withNoReason > 0) {
        contributing_factors.push(`${withNoReason} stale override(s) lack a stated reason`);
      }
    }

    const explanation = staleOverrides.length === 0
      ? `All ${allOverrides.length} override(s) are within the 90-day review window. ` +
        `Configuration is actively maintained.`
      : `${staleOverrides.length} of ${allOverrides.length} override(s) (${raw_value.toFixed(1)}%) ` +
        `have not been reviewed in over 90 days. Stale configuration may no longer reflect ` +
        `operator intent — the original rationale may have been lost through staff turnover.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_stale_overrides',
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
      unit:                 'percent_stale_overrides',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-07 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
