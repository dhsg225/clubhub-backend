/**
 * M-05: Manual Intervention Frequency
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-11
 * (Override-as-Schedule Count), §4.1 Override Divergence
 *
 * Measures: Count of overrides with expires_at IS NULL whose age exceeds
 * M05_PERMANENT_OVERRIDE_AGE_MS (30 days). These have the operational profile
 * of permanent schedules — they were created as interventions but have
 * calcified into persistent configuration.
 *
 * High count = operators compensating for systematic scheduling failures
 * through permanent override accumulation.
 *
 * Formula:
 *   permanent_old_overrides = overrides WHERE expires_at IS NULL
 *                             AND (at - starts_at) > 30 days
 *   raw_value = COUNT(permanent_old_overrides)
 *   normalized = normalize(raw_value, ADVISORY=3, REVIEW=8)
 *
 * Source: overrides array on SystemStateSnapshot
 *
 * Thresholds (per spec §5.1 M-11):
 *   ADVISORY > 3 permanent overrides older than 30 days
 *   REVIEW   > 8 permanent overrides older than 30 days
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M05_ADVISORY_THRESHOLD,
  M05_REVIEW_THRESHOLD,
  M05_PERMANENT_OVERRIDE_AGE_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-05';

export function computeM05ManualInterventionFrequency(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const permanentOldOverrides = state.overrides.filter(o => {
      const isPermanent  = o.expires_at === null;
      const age          = at - o.starts_at;
      const isOld        = age > M05_PERMANENT_OVERRIDE_AGE_MS;
      return isPermanent && isOld;
    });

    const raw_value  = permanentOldOverrides.length;
    const normalized = normalizeToUnit(raw_value, M05_ADVISORY_THRESHOLD, M05_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (permanentOldOverrides.length > 0) {
      const ageDays = permanentOldOverrides.map(o => {
        const ageMs = at - o.starts_at;
        return Math.floor(ageMs / (24 * 60 * 60 * 1000));
      });
      const maxAgeDays = Math.max(...ageDays);
      const minAgeDays = Math.min(...ageDays);
      contributing_factors.push(
        `${permanentOldOverrides.length} permanent override(s) older than 30 days`
      );
      contributing_factors.push(
        `age range: ${minAgeDays}–${maxAgeDays} days`
      );
      const withNoReason = permanentOldOverrides.filter(o => !o.reason).length;
      if (withNoReason > 0) {
        contributing_factors.push(`${withNoReason} override(s) have no stated reason`);
      }
    }

    const explanation = raw_value === 0
      ? `No permanent overrides older than 30 days. Manual intervention frequency is within norms.`
      : `${raw_value} permanent override(s) have been active for more than 30 days with no expiry. ` +
        `These interventions have calcified into de-facto permanent schedules. ` +
        `Their original rationale may no longer be known, making cleanup feel risky.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'permanent_old_overrides',
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
      unit:                 'permanent_old_overrides',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-05 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
