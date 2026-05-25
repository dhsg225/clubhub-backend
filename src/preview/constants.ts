/**
 * Preview subsystem constants.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md
 * Forbidden Pattern: FP-07 — no hardcoded threshold values outside this file.
 */

export const PREVIEW_VERSION = '1.0.0' as const;

/** Level name map — constitutionally fixed */
export const LEVEL_NAMES: Record<number, string> = {
  0: 'Emergency Override',
  1: 'Operational Override',
  2: 'Scheduled Override',
  3: 'Campaign Schedule',
  4: 'Sponsorship Injection',
  5: 'Structural / System Fallback',
  6: 'Device Truth Annotation',
};

/** Confidence label thresholds */
export const CONFIDENCE_LABEL_HIGH   = 0.90;
export const CONFIDENCE_LABEL_MEDIUM = 0.60;
export const CONFIDENCE_LABEL_LOW    = 0.30;

export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= CONFIDENCE_LABEL_HIGH)   return 'HIGH';
  if (score >= CONFIDENCE_LABEL_MEDIUM) return 'MEDIUM';
  if (score >= CONFIDENCE_LABEL_LOW)    return 'LOW';
  return 'VERY_LOW';
}

/** Total number of PRE resolution levels (0–6) */
export const PRE_LEVEL_COUNT = 7;
