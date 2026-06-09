/**
 * M-09: Device Staleness
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §7.2,
 * LEVEL_6 device truth confidence model (PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6)
 *
 * Measures: Whether this screen has been seen recently. A stale device =
 * unknown delivery state — the system cannot confirm content is actually
 * playing. This is distinct from M-12 (delivery log staleness) which
 * measures delivery confirmation specifically.
 *
 * Formula:
 *   last_seen = state.screen.last_seen_at
 *   if last_seen is null: stale = true (never seen)
 *   else: stale = (at - last_seen) > M09_STALE_AGE_MS (1 hour)
 *   raw_value = stale ? 100 : 0  (binary per-screen)
 *   normalized = normalize(raw_value, ADVISORY=15, REVIEW=35)
 *     (these thresholds are applied at venue level where raw_value = percent of stale screens)
 *
 * Source: screen.last_seen_at on SystemStateSnapshot
 *
 * Thresholds:
 *   ADVISORY > 15% of screens stale (per-screen: binary 0 or 100)
 *   REVIEW   > 35% of screens stale
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M09_ADVISORY_THRESHOLD,
  M09_REVIEW_THRESHOLD,
  M09_STALE_AGE_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-09';

export function computeM09DeviceStaleness(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const lastSeenAt = state.screen.last_seen_at;

    const isNeverSeen = lastSeenAt === null;
    const isStale     = isNeverSeen || (at - lastSeenAt) > M09_STALE_AGE_MS;

    // Per-screen binary: 0 (fresh) or 100 (stale)
    const raw_value  = isStale ? 100 : 0;
    const normalized = normalizeToUnit(raw_value, M09_ADVISORY_THRESHOLD, M09_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (isNeverSeen) {
      contributing_factors.push('screen has never reported a heartbeat (last_seen_at is null)');
    } else if (isStale) {
      const staleMinutes = Math.floor((at - (lastSeenAt as number)) / 60000);
      contributing_factors.push(
        `screen last seen ${staleMinutes} minutes ago (threshold: ${M09_STALE_AGE_MS / 60000} minutes)`
      );
    } else {
      const freshMinutes = Math.floor((at - (lastSeenAt as number)) / 60000);
      contributing_factors.push(`screen last seen ${freshMinutes} minutes ago — within freshness window`);
    }

    const explanation = isNeverSeen
      ? `Screen ${state.screen.id} has never reported a heartbeat. ` +
        `Delivery state is completely unknown.`
      : isStale
      ? `Screen ${state.screen.id} last seen more than ${M09_STALE_AGE_MS / (60 * 60 * 1000)} hour(s) ago. ` +
        `Device may be offline, rebooting, or network-isolated. ` +
        `Content delivery cannot be confirmed.`
      : `Screen ${state.screen.id} is active — last seen within the freshness window. ` +
        `Device staleness is 0.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_stale',
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
      unit:                 'percent_stale',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-09 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
