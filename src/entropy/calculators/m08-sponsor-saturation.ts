/**
 * M-08: Sponsor Saturation
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-06
 * (SOV Warning Duration), §4.5 Sponsor Saturation Drift
 *
 * Measures: How close total active sponsored SOV is to the warning threshold.
 * High saturation = risk of editorial content minority on this screen.
 *
 * Formula:
 *   active_sponsorships = sponsorships WHERE is_active AND not expired
 *   total_sov = SUM(sov_pct) for active_sponsorships in this screen's area
 *   saturation_ratio = total_sov / SOV_WARNING_THRESHOLD
 *     (1.0 = exactly at warning threshold, >1.0 = above warning threshold)
 *   raw_value = saturation_ratio × 100 (percent of warning threshold consumed)
 *   ADVISORY at 50% of warning threshold consumed (raw_value = 50)
 *   REVIEW   at 80% of warning threshold consumed (raw_value = 80)
 *   normalized = normalize(raw_value, ADVISORY=50, REVIEW=80)
 *
 * Source: sponsorships array on SystemStateSnapshot (filtered to area_id match)
 *
 * Thresholds:
 *   ADVISORY total SOV > 50% of warning threshold (> 0.15 if threshold is 0.30)
 *   REVIEW   total SOV > 80% of warning threshold (> 0.24 if threshold is 0.30)
 *
 * Note: SOV_WARNING_THRESHOLD mirrors src/pre/constants.ts value (0.30 = 30%).
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M08_SOV_WARNING_THRESHOLD,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-08';

// Advisory: at 50% of the SOV warning threshold (threshold_warn maps to normalized 0.5)
// Review: at 80% of the SOV warning threshold
const SATURATION_ADVISORY_PCT = 50;  // percent of warning threshold consumed
const SATURATION_REVIEW_PCT   = 80;  // percent of warning threshold consumed

export function computeM08SponsorSaturation(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const areaId = state.area?.id ?? null;

    // Active sponsorships applicable to this screen's area
    const activeSponsorships = state.sponsorships.filter(s => {
      const notExpired = s.expires_at === null || s.expires_at > at;
      const isActive   = s.is_active;
      // Match this screen's area
      const inArea     = areaId !== null ? s.area_id === areaId : true;
      return notExpired && isActive && inArea;
    });

    const totalSov = activeSponsorships.reduce((sum, s) => sum + s.sov_pct, 0);

    // Saturation as percentage of warning threshold consumed
    const saturationRatio = M08_SOV_WARNING_THRESHOLD > 0
      ? totalSov / M08_SOV_WARNING_THRESHOLD
      : 0;
    const raw_value = saturationRatio * 100; // e.g., 0.24 SOV → 80% of 0.30 threshold

    const normalized = normalizeToUnit(raw_value, SATURATION_ADVISORY_PCT, SATURATION_REVIEW_PCT);

    const contributing_factors: string[] = [];
    if (activeSponsorships.length > 0) {
      contributing_factors.push(
        `${activeSponsorships.length} active sponsorship(s) in this area`
      );
      contributing_factors.push(
        `total SOV: ${(totalSov * 100).toFixed(1)}% of ${(M08_SOV_WARNING_THRESHOLD * 100).toFixed(0)}% warning threshold`
      );
      if (totalSov >= M08_SOV_WARNING_THRESHOLD) {
        contributing_factors.push('SOV warning threshold exceeded — editorial content at risk of minority');
      }
    }

    const sovPct      = (totalSov * 100).toFixed(1);
    const thresholdPct = (M08_SOV_WARNING_THRESHOLD * 100).toFixed(0);

    const explanation = totalSov === 0
      ? `No active sponsorships for this screen's area. Sponsor saturation is 0.`
      : `Total sponsored SOV is ${sovPct}% against a ${thresholdPct}% warning threshold ` +
        `(${raw_value.toFixed(1)}% of threshold consumed). ` +
        `Approaching saturation creates editorial content minority risk — ` +
        `individually small contract additions accumulate across the venue.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_of_sov_threshold_consumed',
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
      unit:                 'percent_of_sov_threshold_consumed',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-08 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
