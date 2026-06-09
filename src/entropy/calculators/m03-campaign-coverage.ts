/**
 * M-03: Campaign Coverage Rate
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-03
 *
 * Measures: Fraction of active schedule rows that have a non-null campaign_id.
 * Low coverage = schedules are being created directly rather than through campaigns,
 * indicating the campaign governance model is being bypassed.
 *
 * Formula:
 *   total_active    = COUNT(active schedules that are not fallback)
 *   campaign_managed = COUNT(active schedules WHERE campaign_id IS NOT NULL)
 *   coverage_pct    = campaign_managed / total_active × 100
 *   INVERTED for entropy: low coverage = high entropy
 *   inverted_pct    = 100 - coverage_pct
 *   normalized      = normalize(inverted_pct, ADVISORY=40, REVIEW=70)
 *     (advisory=40 corresponds to coverage < 60%, review=70 to coverage < 30%)
 *
 * Source: schedules array on SystemStateSnapshot
 *
 * Thresholds (per spec §5.1 M-03):
 *   ADVISORY coverage < 60%  (inverted > 40)
 *   REVIEW   coverage < 30%  (inverted > 70)
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M03_ADVISORY_THRESHOLD,
  M03_REVIEW_THRESHOLD,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-03';

export function computeM03CampaignCoverage(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    // Active, non-fallback schedules only
    const activeSchedules = state.schedules.filter(s => {
      const notExpired = s.expires_at === null || s.expires_at > at;
      return notExpired && s.is_active && !s.is_fallback;
    });

    const total           = activeSchedules.length;
    const campaignManaged = activeSchedules.filter(s => s.campaign_id !== null).length;

    // Avoid division by zero: no schedules = 100% coverage (nothing to fragment)
    const coverage_pct    = total === 0 ? 100 : (campaignManaged / total) * 100;
    // Invert: low coverage = high entropy
    const inverted_pct    = 100 - coverage_pct;
    const raw_value       = inverted_pct;

    const normalized      = normalizeToUnit(raw_value, M03_ADVISORY_THRESHOLD, M03_REVIEW_THRESHOLD);

    const directCount     = total - campaignManaged;
    const contributing_factors: string[] = [];
    if (directCount > 0) {
      contributing_factors.push(`${directCount} of ${total} schedule(s) created directly (no campaign parent)`);
    }
    if (total > 0 && coverage_pct < 60) {
      contributing_factors.push(`campaign coverage ${coverage_pct.toFixed(1)}% — below 60% advisory threshold`);
    }
    if (total === 0) {
      contributing_factors.push('no active schedules found — coverage defaults to 100%');
    }

    const explanation = total === 0
      ? `No active schedules found. Campaign coverage defaults to 100% (no entropy from this metric).`
      : `Campaign coverage is ${coverage_pct.toFixed(1)}% (${campaignManaged} of ${total} active schedule(s) ` +
        `have a campaign parent). Low coverage indicates operators are bypassing the campaign governance ` +
        `model — knowledge transfer decay and fragmented ownership risk.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_uncampaigned',
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
      unit:                 'percent_uncampaigned',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-03 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
