/**
 * M-11: Preview Resolution Divergence
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §8.3
 * Preview Surface Data Freshness, §6.2
 *
 * Measures: Whether the screen's last delivery log shows a resolution level
 * that conflicts with the currently expected resolution pattern. This is a
 * proxy for schedule state instability — if previous deliveries consistently
 * resolved at Level 5 (structural) but the current state has active overrides,
 * there's a divergence between historical delivery and current configuration.
 *
 * Formula:
 *   last_delivery = state.last_delivery
 *   has_active_overrides = state.overrides.some(not expired)
 *   delivery_was_structural = last_delivery.resolution_level >= 3 (campaign or above)
 *   delivery_was_override = last_delivery.resolution_level <= 2 (override levels)
 *
 *   divergence = (has_active_overrides && delivery_was_structural) ||
 *                (!has_active_overrides && delivery_was_override)
 *
 *   if no recent delivery (null or age > M11_DELIVERY_RECENCY_MS): raw_value = 50 (uncertain)
 *   if divergence: raw_value = 100
 *   else: raw_value = 0
 *   normalized = normalize(raw_value, ADVISORY=15, REVIEW=30)
 *
 * Source: last_delivery, overrides on SystemStateSnapshot
 *
 * Thresholds:
 *   ADVISORY > 15% of screens show divergence (per-screen: binary)
 *   REVIEW   > 30% of screens show divergence
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M11_ADVISORY_THRESHOLD,
  M11_REVIEW_THRESHOLD,
  M11_DELIVERY_RECENCY_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-11';

// Override resolution levels (0, 1, 2) — delivery at these levels = override-driven
const OVERRIDE_RESOLUTION_LEVELS = new Set([0, 1, 2]);

export function computeM11PreviewResolutionDivergence(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const lastDelivery = state.last_delivery;

    // Active overrides for this screen
    const hasActiveOverrides = state.overrides.some(o => {
      return o.expires_at === null || o.expires_at > at;
    });

    // No delivery record at all
    if (lastDelivery === null) {
      const raw_value  = 50; // uncertain — no delivery history to compare
      const normalized = normalizeToUnit(raw_value, M11_ADVISORY_THRESHOLD, M11_REVIEW_THRESHOLD);
      return {
        metric_id:            METRIC_ID,
        value:                normalized,
        raw_value,
        unit:                 'percent_diverged',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          `No delivery log found for screen ${state.screen.id}. ` +
                              `Cannot compare preview vs. delivery resolution. Score is uncertain (50).`,
        contributing_factors: ['no delivery log exists for this screen'],
        computed_at:          at,
      };
    }

    // Delivery is too old to be meaningful
    const deliveryAge = at - lastDelivery.delivered_at;
    if (deliveryAge > M11_DELIVERY_RECENCY_MS) {
      const raw_value  = 50; // uncertain — stale delivery
      const normalized = normalizeToUnit(raw_value, M11_ADVISORY_THRESHOLD, M11_REVIEW_THRESHOLD);
      const ageMins    = Math.floor(deliveryAge / 60000);
      return {
        metric_id:            METRIC_ID,
        value:                normalized,
        raw_value,
        unit:                 'percent_diverged',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          `Last delivery for screen ${state.screen.id} was ${ageMins} minutes ago ` +
                              `(threshold: ${M11_DELIVERY_RECENCY_MS / 60000} minutes). ` +
                              `Too stale to compare with current configuration state.`,
        contributing_factors: [`delivery log is ${ageMins} minutes old — exceeds recency threshold`],
        computed_at:          at,
      };
    }

    const deliveryWasOverride   = OVERRIDE_RESOLUTION_LEVELS.has(lastDelivery.resolution_level);
    const deliveryWasStructural = !deliveryWasOverride;

    // Divergence: current overrides contradict last delivery pattern
    const isDiverged = (hasActiveOverrides && deliveryWasStructural) ||
                       (!hasActiveOverrides && deliveryWasOverride);

    const raw_value  = isDiverged ? 100 : 0;
    const normalized = normalizeToUnit(raw_value, M11_ADVISORY_THRESHOLD, M11_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (isDiverged) {
      if (hasActiveOverrides && deliveryWasStructural) {
        contributing_factors.push(
          `current state has active overrides, but last delivery resolved at Level ${lastDelivery.resolution_level} (structural)`
        );
        contributing_factors.push('new overrides may not yet be reflected in delivery — or override was just added');
      } else {
        contributing_factors.push(
          `no active overrides, but last delivery resolved at Level ${lastDelivery.resolution_level} (override level)`
        );
        contributing_factors.push('override may have been removed since last delivery');
      }
    } else {
      contributing_factors.push(
        `delivery level ${lastDelivery.resolution_level} is consistent with current override state`
      );
    }

    const explanation = isDiverged
      ? `Resolution divergence detected for screen ${state.screen.id}: ` +
        `current configuration implies ${hasActiveOverrides ? 'override-driven' : 'structural'} resolution, ` +
        `but last delivery was at Level ${lastDelivery.resolution_level}. ` +
        `This indicates the schedule state has changed since the last delivery cycle.`
      : `No resolution divergence — last delivery level ${lastDelivery.resolution_level} ` +
        `is consistent with current configuration state.`;

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
      explanation:          `M-11 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
