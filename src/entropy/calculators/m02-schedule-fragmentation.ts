/**
 * M-02: Schedule Fragmentation
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-05
 * (Duplicate Content Pairs), §4.3 Shadow Scheduling
 *
 * Measures: How fractured the schedule hierarchy is — counts schedule pairs
 * where the same (content_id, target_type, target_id) appears in more than
 * one active schedule row. High fragmentation = shadow scheduling risk.
 *
 * Formula:
 *   For each (content_id, target_type, target_id) group:
 *     if group has > 1 active schedule: count as 1 duplicate pair
 *   raw_value = total duplicate pairs
 *   normalized = normalize(raw_value, ADVISORY=3, REVIEW=8)
 *
 * Source: schedules array on SystemStateSnapshot
 *
 * Thresholds (per spec §5.1 M-05):
 *   ADVISORY > 3 duplicate content pairs
 *   REVIEW   > 8 duplicate content pairs
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M02_ADVISORY_THRESHOLD,
  M02_REVIEW_THRESHOLD,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-02';

export function computeM02ScheduleFragmentation(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    // Active schedules: not expired
    const activeSchedules = state.schedules.filter(s => {
      const notExpired = s.expires_at === null || s.expires_at > at;
      const isActive   = s.is_active;
      return notExpired && isActive;
    });

    // Group by (content_id, target_type, target_id)
    // A pair = same content_id appearing multiple times for the same target
    const groupKey = (content_id: string | null, target_type: string, target_id: string): string =>
      `${content_id ?? '__null__'}::${target_type}::${target_id}`;

    const groups = new Map<string, number>();
    for (const sched of activeSchedules) {
      const key = groupKey(sched.content_id, sched.target_type, sched.target_id);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    // Count groups with cardinality > 1
    let duplicatePairs = 0;
    const duplicateDetails: string[] = [];
    for (const [key, count] of groups) {
      if (count > 1) {
        duplicatePairs++;
        const [contentId, targetType, targetId] = key.split('::');
        duplicateDetails.push(
          `content:${contentId ?? 'null'} × ${String(targetType)}:${String(targetId)} (${count} rows)`
        );
      }
    }

    const raw_value  = duplicatePairs;
    const normalized = normalizeToUnit(raw_value, M02_ADVISORY_THRESHOLD, M02_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (duplicatePairs > 0) {
      contributing_factors.push(`${duplicatePairs} duplicate (content_id, target) pair(s)`);
      contributing_factors.push(...duplicateDetails.slice(0, 5)); // top 5
    }

    const explanation = duplicatePairs === 0
      ? `No duplicate content pairs found across ${activeSchedules.length} active schedule(s). ` +
        `Schedule hierarchy is not fragmented.`
      : `Found ${duplicatePairs} duplicate content pair(s) across ${activeSchedules.length} active schedule(s). ` +
        `Shadow scheduling creates frequency amplification beyond operator intent and ` +
        `makes configuration cleanup feel risky.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'duplicate_pairs',
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
      unit:                 'duplicate_pairs',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-02 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
