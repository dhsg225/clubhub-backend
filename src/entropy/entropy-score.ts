/**
 * Composite entropy score computation.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13
 *
 * Computes the weighted composite entropy score from 12 metric results.
 * The composite is a number in [0.0, 1.0] where 0 = clean and 1 = maximum degradation.
 *
 * Canonical formula (§13.2, §13.3):
 *   entropy_score = round(
 *     0.25 × normalize(M-01, 15, 30)    +
 *     0.20 × normalize(100-M-03, 40, 70) +
 *     0.15 × normalize(M-04, 100, 200)  +
 *     0.10 × normalize(M-06, 3, 6)      +
 *     0.10 × normalize(M-08, 50, 80)    +
 *     0.10 × normalize(M-09, 15, 35)    +
 *     0.10 × normalize(M-05, 3, 8)
 *   )
 *
 * M-02, M-07, M-10, M-11, M-12 have weight 0.00 in the canonical score
 * (informational only — their signals are surfaced individually).
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws.
 */

import type { MetricResult, EntropyScore } from './types';
import { assignEntropyLabel } from './entropy-labeling';
import { computeAdvisoryTier } from './advisory-tier';
import {
  ENTROPY_WEIGHT_M01,
  ENTROPY_WEIGHT_M03,
  ENTROPY_WEIGHT_M04,
  ENTROPY_WEIGHT_M05,
  ENTROPY_WEIGHT_M06,
  ENTROPY_WEIGHT_M08,
  ENTROPY_WEIGHT_M09,
} from './constants';

/**
 * Compute the weighted composite entropy score from all 12 metric results.
 *
 * @param metrics     Array of MetricResult (all 12 expected, indexed by metric_id)
 * @param at          UTC ms evaluation timestamp
 * @param screen_id   Optional screen ID for attribution
 * @param venue_id    Optional venue ID for attribution
 * @returns EntropyScore
 */
export function computeEntropyScore(
  metrics:    MetricResult[],
  at:         number,
  screen_id?: string,
  venue_id?:  string
): EntropyScore {
  // Index metrics by id for safe lookup
  const byId = new Map<string, MetricResult>();
  for (const m of metrics) {
    byId.set(m.metric_id, m);
  }

  const get = (id: string): number => byId.get(id)?.value ?? 0;

  // Canonical weighted composite — weights per spec §13.2
  const composite = (
    ENTROPY_WEIGHT_M01 * get('M-01') +
    ENTROPY_WEIGHT_M03 * get('M-03') +
    ENTROPY_WEIGHT_M04 * get('M-04') +
    ENTROPY_WEIGHT_M05 * get('M-05') +
    ENTROPY_WEIGHT_M06 * get('M-06') +
    ENTROPY_WEIGHT_M08 * get('M-08') +
    ENTROPY_WEIGHT_M09 * get('M-09')
    // M-02, M-07, M-10, M-11, M-12: weight = 0.00 (informational)
  );

  // Clamp to [0, 1] in case of floating-point precision edge cases
  const clampedComposite = Math.max(0, Math.min(1, composite));

  const label        = assignEntropyLabel(clampedComposite);
  const advisoryTier = computeAdvisoryTier(label, metrics);

  const score: EntropyScore = {
    composite:     clampedComposite,
    metrics,
    label,
    advisory_tier: advisoryTier,
    computed_at:   at,
    ...(screen_id !== undefined ? { screen_id } : {}),
    ...(venue_id  !== undefined ? { venue_id }  : {}),
  };

  return score;
}
