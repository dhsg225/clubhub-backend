/**
 * M-04: Priority Spread
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-04,
 * §4.4 Priority Escalation
 *
 * Measures: Difference between the maximum and minimum priority values among
 * active schedule rows. Very high spread indicates ad-hoc priority escalation
 * rather than systematic schedule design — the original priority semantics
 * have been destroyed.
 *
 * Formula:
 *   active_priorities = priorities of non-expired, active schedules
 *   raw_value = MAX(priority) - MIN(priority)  [0 if no schedules]
 *   normalized = normalize(raw_value, ADVISORY=100, REVIEW=200)
 *
 * Source: schedules array on SystemStateSnapshot
 *
 * Thresholds (per spec §5.1 M-04):
 *   ADVISORY range > 100 priority units
 *   REVIEW   range > 200 priority units
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M04_ADVISORY_THRESHOLD,
  M04_REVIEW_THRESHOLD,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-04';

export function computeM04PrioritySpread(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const activeSchedules = state.schedules.filter(s => {
      const notExpired = s.expires_at === null || s.expires_at > at;
      return notExpired && s.is_active;
    });

    if (activeSchedules.length === 0) {
      return {
        metric_id:            METRIC_ID,
        value:                0,
        raw_value:            0,
        unit:                 'priority_range_width',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          'No active schedules found. Priority spread is 0.',
        contributing_factors: [],
        computed_at:          at,
      };
    }

    const priorities = activeSchedules.map(s => s.priority);
    const maxPriority = Math.max(...priorities);
    const minPriority = Math.min(...priorities);
    const raw_value   = maxPriority - minPriority;

    const normalized  = normalizeToUnit(raw_value, M04_ADVISORY_THRESHOLD, M04_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (raw_value > M04_ADVISORY_THRESHOLD) {
      contributing_factors.push(`priority range: ${minPriority} – ${maxPriority} (width: ${raw_value})`);
      // Identify schedules at the extremes
      const highPrioritySchedules = activeSchedules.filter(s => s.priority === maxPriority);
      const lowPrioritySchedules  = activeSchedules.filter(s => s.priority === minPriority);
      contributing_factors.push(`${highPrioritySchedules.length} schedule(s) at max priority ${maxPriority}`);
      contributing_factors.push(`${lowPrioritySchedules.length} schedule(s) at min priority ${minPriority}`);
    }

    // Identify if the top 10% of priorities contain a disproportionate share
    const p90threshold = minPriority + raw_value * 0.9;
    const topDecileCount = activeSchedules.filter(s => s.priority >= p90threshold).length;
    if (raw_value > 0 && topDecileCount < activeSchedules.length * 0.2) {
      contributing_factors.push(
        `${topDecileCount} schedule(s) in top 10% of priority range ` +
        `(escalation concentration pattern)`
      );
    }

    const explanation = raw_value === 0
      ? `All active schedules share the same priority (${minPriority}). No escalation debt detected.`
      : `Priority range spans ${raw_value} units (${minPriority}–${maxPriority}) across ` +
        `${activeSchedules.length} active schedule(s). Wide spread indicates operators ` +
        `have been escalating priorities as a workaround rather than reviewing conflicts.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'priority_range_width',
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
      unit:                 'priority_range_width',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-04 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
