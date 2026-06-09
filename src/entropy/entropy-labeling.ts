/**
 * Entropy label assignment from composite score.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.4
 *
 * Maps normalized composite score [0.0, 1.0] to EntropyLabel.
 * The label determines recommended review cadence.
 *
 * Score → Label → Cadence:
 *   0.00–0.20  HEALTHY   Monthly review
 *   0.20–0.40  NOMINAL   Bi-weekly review
 *   0.40–0.60  DRIFTING  Weekly review
 *   0.60–0.80  DEGRADED  Immediate review recommended
 *   0.80–1.00  CRITICAL  Same-day review
 *
 * Pure function — no side effects, no mutation, deterministic.
 */

import type { EntropyLabel } from './types';
import {
  LABEL_HEALTHY_MAX,
  LABEL_NOMINAL_MAX,
  LABEL_DRIFTING_MAX,
  LABEL_DEGRADED_MAX,
} from './constants';

/**
 * Assign an entropy label from a normalized composite score.
 *
 * @param composite Normalized score in [0.0, 1.0]
 * @returns EntropyLabel
 */
export function assignEntropyLabel(composite: number): EntropyLabel {
  if (composite <= LABEL_HEALTHY_MAX)  return 'HEALTHY';
  if (composite <= LABEL_NOMINAL_MAX)  return 'NOMINAL';
  if (composite <= LABEL_DRIFTING_MAX) return 'DRIFTING';
  if (composite <= LABEL_DEGRADED_MAX) return 'DEGRADED';
  return 'CRITICAL';
}
