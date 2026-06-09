/**
 * M-10: Content Mix Instability
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §4.3
 * Shadow Scheduling, §4.4 Priority Escalation
 *
 * Measures: Whether the schedule structure for this screen would produce a
 * content mix that deviates significantly from a clean structural baseline.
 * Specifically: variance in the effective priority distribution of schedules,
 * which indicates shadow scheduling or priority escalation has distorted the
 * intended content weighting.
 *
 * Since SystemStateSnapshot is per-screen (not multi-screen), this metric
 * measures the within-screen instability of the schedule structure:
 *
 * Formula:
 *   active_schedules = non-expired active schedules
 *   if < 2 schedules: raw_value = 0 (no instability possible)
 *   priorities = [s.priority for s in active_schedules]
 *   mean = MEAN(priorities)
 *   variance = SUM((p - mean)^2) / N
 *   stddev = SQRT(variance)
 *   cv = stddev / (mean + 1)  -- coefficient of variation, +1 to avoid div/0
 *   raw_value = cv
 *   normalized = normalize(raw_value, ADVISORY=M10_ADVISORY_THRESHOLD, REVIEW=M10_REVIEW_THRESHOLD)
 *
 * Thresholds:
 *   ADVISORY coefficient of variation > 0.20
 *   REVIEW   coefficient of variation > 0.40
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M10_ADVISORY_THRESHOLD,
  M10_REVIEW_THRESHOLD,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-10';

export function computeM10ContentMixInstability(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const activeSchedules = state.schedules.filter(s => {
      const notExpired = s.expires_at === null || s.expires_at > at;
      return notExpired && s.is_active;
    });

    if (activeSchedules.length < 2) {
      return {
        metric_id:            METRIC_ID,
        value:                0,
        raw_value:            0,
        unit:                 'priority_coefficient_of_variation',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          `Fewer than 2 active schedules — no instability measurable.`,
        contributing_factors: [],
        computed_at:          at,
      };
    }

    const priorities = activeSchedules.map(s => s.priority);
    const n          = priorities.length;
    const mean       = priorities.reduce((a, b) => a + b, 0) / n;
    const variance   = priorities.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
    const stddev     = Math.sqrt(variance);
    // Coefficient of variation: stddev / (mean + 1) to avoid division by zero at mean=0
    const cv         = stddev / (mean + 1);
    const raw_value  = cv;

    const normalized = normalizeToUnit(raw_value, M10_ADVISORY_THRESHOLD, M10_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (cv > M10_ADVISORY_THRESHOLD) {
      contributing_factors.push(`priority coefficient of variation: ${cv.toFixed(3)}`);
      contributing_factors.push(`priority distribution: mean=${mean.toFixed(1)}, stddev=${stddev.toFixed(1)}`);
      const minP = Math.min(...priorities);
      const maxP = Math.max(...priorities);
      contributing_factors.push(`priority range: ${minP}–${maxP} across ${n} schedule(s)`);
    }

    const explanation = cv <= M10_ADVISORY_THRESHOLD
      ? `Priority distribution is stable (CV=${cv.toFixed(3)}) across ${n} active schedule(s). ` +
        `Content mix is likely consistent with operator intent.`
      : `Priority coefficient of variation is ${cv.toFixed(3)} (threshold: ${M10_ADVISORY_THRESHOLD}). ` +
        `High priority variance across ${n} schedule(s) indicates priority escalation or ` +
        `shadow scheduling has distorted the intended content weighting.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'priority_coefficient_of_variation',
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
      unit:                 'priority_coefficient_of_variation',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-10 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
