/**
 * Entropy score normalization formula.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.3
 *
 * Formula:
 *   if value <= 0:                       return 0
 *   if value <= advisory_threshold:      return (value / advisory_threshold) × NORM_ADVISORY_SCORE
 *   if value <= review_threshold:        return NORM_ADVISORY_SCORE + ((value - advisory) / (review - advisory)) × 30
 *   else (above review):                 return min(100, 80 + 20 × (1 - e^(-excess / review_threshold)))
 *
 * Output is normalized to [0, 100] (integer scale per spec), then divided by 100
 * to produce a [0.0, 1.0] value for composite scoring.
 *
 * Pure function — no side effects, no mutation.
 */

import {
  NORM_ADVISORY_SCORE,
  NORM_REVIEW_SCORE,
  NORM_MAX_SCORE,
} from './constants';

/**
 * Normalize a raw metric value to [0, 100] using the spec §13.3 formula.
 *
 * @param value            Raw measurement (e.g., 22% override divergence)
 * @param advisoryThreshold The value that maps to NORM_ADVISORY_SCORE (50)
 * @param reviewThreshold   The value that maps to NORM_REVIEW_SCORE (80)
 * @returns Normalized score in [0, 100]
 */
export function normalizeScore(
  value:             number,
  advisoryThreshold: number,
  reviewThreshold:   number
): number {
  if (value <= 0) {
    return 0;
  }

  if (value <= advisoryThreshold) {
    // Linear interpolation: 0 → 0, advisory → 50
    return (value / advisoryThreshold) * NORM_ADVISORY_SCORE;
  }

  if (value <= reviewThreshold) {
    // Linear interpolation: advisory → 50, review → 80
    const range = reviewThreshold - advisoryThreshold;
    const excess = value - advisoryThreshold;
    return NORM_ADVISORY_SCORE + (excess / range) * (NORM_REVIEW_SCORE - NORM_ADVISORY_SCORE);
  }

  // Asymptotic approach to 100 above review threshold
  // score = min(100, 80 + 20 × (1 - e^(-excess / review_threshold)))
  const excess = value - reviewThreshold;
  const asymptotic = NORM_REVIEW_SCORE + 20 * (1 - Math.exp(-excess / reviewThreshold));
  return Math.min(NORM_MAX_SCORE, asymptotic);
}

/**
 * Normalize and scale to [0.0, 1.0].
 *
 * @returns Value in [0.0, 1.0]
 */
export function normalizeToUnit(
  value:             number,
  advisoryThreshold: number,
  reviewThreshold:   number
): number {
  return normalizeScore(value, advisoryThreshold, reviewThreshold) / NORM_MAX_SCORE;
}

/**
 * Compute the normalized warn threshold (the unit value at the advisory boundary).
 * This is always NORM_ADVISORY_SCORE / NORM_MAX_SCORE = 0.50.
 */
export const NORMALIZED_WARN_THRESHOLD     = NORM_ADVISORY_SCORE / NORM_MAX_SCORE; // 0.50

/**
 * Compute the normalized critical threshold (the unit value at the review boundary).
 * This is always NORM_REVIEW_SCORE / NORM_MAX_SCORE = 0.80.
 */
export const NORMALIZED_CRITICAL_THRESHOLD = NORM_REVIEW_SCORE / NORM_MAX_SCORE;   // 0.80
