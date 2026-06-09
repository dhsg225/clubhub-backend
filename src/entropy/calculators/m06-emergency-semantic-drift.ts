/**
 * M-06: Emergency Semantic Drift
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-08,
 * §4.6 Emergency Semantic Collapse
 *
 * Measures: Whether emergency activations are being used for non-emergency
 * purposes. Semantic drift erodes operator trust in the emergency channel —
 * when the audit trail cannot distinguish genuine emergencies from operational
 * use, the emergency system loses its signal value.
 *
 * Heuristics for "non-emergency use" (from §4.6):
 *   - Emergency is not global (target is a subset of venue)
 *   - Emergency has short duration (active for < M06_SHORT_DURATION_MS = 4 hours)
 *   - Emergency has no reason stated
 *   - High frequency in rolling 30-day window
 *
 * Formula:
 *   current_emergency = state.emergency (the active emergency record, if any)
 *   drift_signals = indicators of non-emergency use on current emergency
 *   raw_value = drift_signal_count (0–3 range, normalized to 0–6 scale for thresholds)
 *
 *   Specifically:
 *     - If no emergency: raw_value = 0
 *     - If emergency present:
 *       score = 0
 *       if !is_global: score += 2  (local emergencies are the primary misuse pattern)
 *       if !reason:    score += 2  (missing reason is a semantic drift indicator)
 *       if short:      score += 2  (short duration indicates operational use)
 *       raw_value = score
 *   normalized = normalize(raw_value, ADVISORY=3, REVIEW=6)
 *
 * Source: emergency field on SystemStateSnapshot
 *
 * Thresholds:
 *   ADVISORY drift signal score > 3
 *   REVIEW   drift signal score > 6
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — returns error state on unexpected input.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { MetricResult } from '../types';
import {
  M06_ADVISORY_THRESHOLD,
  M06_REVIEW_THRESHOLD,
  M06_SHORT_DURATION_MS,
} from '../constants';
import { normalizeToUnit, NORMALIZED_WARN_THRESHOLD, NORMALIZED_CRITICAL_THRESHOLD } from '../normalize';

export const METRIC_ID = 'M-06';

export function computeM06EmergencySemanticDrift(
  state: SystemStateSnapshot,
  at:    number
): MetricResult {
  try {
    const emergency = state.emergency;

    if (emergency === null || !emergency.is_active) {
      return {
        metric_id:            METRIC_ID,
        value:                0,
        raw_value:            0,
        unit:                 'drift_signal_score',
        threshold_warn:       NORMALIZED_WARN_THRESHOLD,
        threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
        explanation:          'No active emergency. Emergency semantic drift score is 0.',
        contributing_factors: [],
        computed_at:          at,
      };
    }

    // Score drift signals
    let driftScore = 0;
    const contributing_factors: string[] = [];

    // Signal 1: Not global (local emergencies are the primary operational misuse pattern)
    if (!emergency.is_global) {
      driftScore += 2;
      contributing_factors.push('emergency is not global — scoped to a sub-venue target (primary misuse indicator)');
    }

    // Signal 2: No reason stated
    const hasReason = emergency.reason !== null && emergency.reason.trim().length > 0;
    if (!hasReason) {
      driftScore += 2;
      contributing_factors.push('no reason field — emergency reason is absent (semantic drift indicator)');
    }

    // Signal 3: Short activation duration (activated recently, short duration likely = operational)
    const activeDuration = at - emergency.activated_at;
    if (activeDuration < M06_SHORT_DURATION_MS) {
      driftScore += 2;
      const minutes = Math.floor(activeDuration / 60000);
      contributing_factors.push(
        `emergency active for only ${minutes} minutes — short-duration use suggests operational misuse`
      );
    }

    const raw_value  = driftScore;
    const normalized = normalizeToUnit(raw_value, M06_ADVISORY_THRESHOLD, M06_REVIEW_THRESHOLD);

    const explanation = driftScore === 0
      ? `Emergency is active and shows characteristics consistent with genuine emergency use ` +
        `(global scope, stated reason, appropriate duration).`
      : `Emergency is active with ${driftScore} drift signal point(s) out of 6 maximum. ` +
        `Semantic drift erodes the audit trail's ability to distinguish genuine emergencies ` +
        `from operational workarounds. Once operators learn emergency = "immediate flush," ` +
        `the pattern accelerates.`;

    return {
      metric_id:            METRIC_ID,
      value:                normalized,
      raw_value,
      unit:                 'drift_signal_score',
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
      unit:                 'drift_signal_score',
      threshold_warn:       NORMALIZED_WARN_THRESHOLD,
      threshold_critical:   NORMALIZED_CRITICAL_THRESHOLD,
      explanation:          `M-06 computation error — returning safe zero value`,
      contributing_factors: ['computation_error'],
      computed_at:          at,
    };
  }
}
