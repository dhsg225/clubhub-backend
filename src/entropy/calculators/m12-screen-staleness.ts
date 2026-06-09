/**
 * M-12: Screen Staleness (Delivery Confirmation)
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-12,
 * §7.2 Staleness Classification
 *
 * Measures: Whether this screen has a recent delivery log confirmation.
 * Distinct from M-09 (device staleness via heartbeat) — this metric is
 * specifically about delivery confirmation: has the screen confirmed receipt
 * of a resolved playlist within the freshness window?
 *
 * A missing or stale delivery log means the system cannot verify content
 * is actually playing as resolved. The delivery log is the ground-truth
 * proof-of-play signal.
 *
 * Formula:
 *   last_delivery = state.last_delivery
 *   if null: stale = true (never delivered)
 *   else: stale = (at - last_delivery.delivered_at) > M12_DELIVERY_FRESH_MS
 *   raw_value = stale ? 100 : 0  (binary per-screen)
 *   normalized = normalize(raw_value, ADVISORY=20, REVIEW=40)
 *
 * Source: last_delivery on SystemStateSnapshot
 *
 * Thresholds:
 *   ADVISORY > 20% of screens have stale/missing delivery log
 *   REVIEW   > 40% of screens have stale/missing delivery log
 *
 * Note: Weight in canonical entropy score is 0.00 (informational only) per
 * the canonical spec §13.2 which uses M-12 as a staleness index, not delivery
 * confirmation. Kept as an independent observable metric.
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M12_ADVISORY_THRESHOLD,
  M12_REVIEW_THRESHOLD,
  M12_DELIVERY_FRESH_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-12';

export function computeM12ScreenStaleness(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const lastDelivery = state.last_delivery;

    const neverDelivered = lastDelivery === null;
    const isStale = neverDelivered ||
      ((at - lastDelivery.delivered_at) > M12_DELIVERY_FRESH_MS);

    const raw_value  = isStale ? 100 : 0;
    const normalized = normalizeToUnit(raw_value, M12_ADVISORY_THRESHOLD, M12_REVIEW_THRESHOLD);

    const contributing_factors: string[] = [];
    if (neverDelivered) {
      contributing_factors.push('no delivery log exists — screen has never confirmed playlist receipt');
    } else if (isStale) {
      const ageMinutes = Math.floor((at - lastDelivery.delivered_at) / 60000);
      contributing_factors.push(
        `last delivery confirmed ${ageMinutes} minutes ago (threshold: ${M12_DELIVERY_FRESH_MS / 60000} minutes)`
      );
      contributing_factors.push(`last delivery checksum: ${lastDelivery.checksum}`);
    } else {
      const ageMinutes = Math.floor((at - lastDelivery.delivered_at) / 60000);
      contributing_factors.push(`delivery confirmed ${ageMinutes} minutes ago — within freshness window`);
    }

    const freshMinutes = M12_DELIVERY_FRESH_MS / 60000;
    const explanation  = neverDelivered
      ? `Screen ${state.screen.id} has no delivery confirmation log. ` +
        `Cannot verify content has ever been delivered or is currently playing.`
      : isStale
      ? `Screen ${state.screen.id} last confirmed delivery more than ${freshMinutes} minutes ago. ` +
        `Delivery state is uncertain — the screen may have stopped confirming receipts.`
      : `Screen ${state.screen.id} has a recent delivery confirmation (within ${freshMinutes} minutes). ` +
        `Delivery staleness is 0.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'percent_stale_delivery',
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
      unit:                 'percent_stale_delivery',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-12 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
