/**
 * Advisory tier computation from entropy score and metrics.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §10.2
 *
 * Advisory tiers govern UX surface escalation:
 *   Tier 0: No advisory (HEALTHY, no critical metrics)
 *   Tier 1: Passive/informational (NOMINAL, no critical metrics)
 *   Tier 2: Noticed — soft warning (DRIFTING, or NOMINAL/HEALTHY with critical metrics)
 *   Tier 3: Confirmed — friction gate (DEGRADED, or DRIFTING with multiple critical metrics)
 *   Tier 4: Critical (CRITICAL label, or M-06 emergency drift above review threshold)
 *
 * Tier 4 (not Tier 3) is the maximum — per spec §10.2, Tier 3 is the maximum
 * friction level, but Tier 4 represents the "same-day review" escalation state.
 *
 * Pure function — no side effects, no mutation, deterministic.
 */

import type { EntropyLabel, AdvisoryTier, MetricResult } from './types';
import { NORMALIZED_CRITICAL_THRESHOLD } from './normalize';

/**
 * Compute the advisory tier from label and metric results.
 *
 * @param label         EntropyLabel from composite score
 * @param metrics       All 12 MetricResult objects
 * @returns AdvisoryTier (0–4)
 */
export function computeAdvisoryTier(
  label:   EntropyLabel,
  metrics: readonly MetricResult[]
): AdvisoryTier {
  // Count metrics at or above critical threshold
  const criticalMetrics = metrics.filter(m => m.value >= NORMALIZED_CRITICAL_THRESHOLD);
  const criticalCount   = criticalMetrics.length;

  // Check for M-06 emergency semantic drift above critical threshold
  const m06 = metrics.find(m => m.metric_id === 'M-06');
  const m06Emergency = m06 !== undefined && m06.value >= NORMALIZED_CRITICAL_THRESHOLD;

  // Tier 4: CRITICAL label OR M-06 emergency drift above critical threshold
  if (label === 'CRITICAL' || m06Emergency) {
    return 4;
  }

  // Tier 3: DEGRADED label, OR DRIFTING with >= 2 critical metrics
  if (label === 'DEGRADED') {
    return 3;
  }
  if (label === 'DRIFTING' && criticalCount >= 2) {
    return 3;
  }

  // Tier 2: DRIFTING (no multiple critical), OR any label with critical metrics present
  if (label === 'DRIFTING') {
    return 2;
  }
  if (criticalCount >= 1) {
    return 2;
  }

  // Tier 1: NOMINAL with some elevated metrics (any metric above warn threshold)
  if (label === 'NOMINAL') {
    const warnMetrics = metrics.filter(m => m.value >= m.threshold_warn);
    if (warnMetrics.length > 0) {
      return 1;
    }
  }

  // Tier 0: HEALTHY with no critical metrics, or NOMINAL with no elevated metrics
  return 0;
}
