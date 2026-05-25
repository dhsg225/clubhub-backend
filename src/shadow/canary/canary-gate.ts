/**
 * Canary gate evaluation for shadow promotion readiness.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Gate passes only when ALL of:
 * - parity_score_24h >= 0.999
 * - parity_score_7d >= 0.9999
 * - total_invocations_24h >= 1000
 * - zero CLASS_3 divergences in last 24h
 * - zero CLASS_4 divergences ever
 *
 * NOTE: Gate passing does NOT promote. Human approval is ALWAYS required.
 */

import { ParityRecorder } from '../storage/parity-recorder';
import { SHADOW_GATE } from '../constants';
import type { CanaryStage } from '../types';

// ─── Gate Evaluation Result ───────────────────────────────────────────────────

export interface CanaryGateEvaluation {
  passes: boolean;
  reason: string;
  parity_score_24h: number;
  parity_score_7d: number;
  total_24h: number;
  total_7d: number;
  class3_count_24h: number;
  class4_count_ever: number;
  requires_human_approval: boolean; // always true
}

// ─── Gate Evaluator ───────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D  = 7 * 24 * 60 * 60 * 1000;

/**
 * Evaluate canary gate eligibility for promotion.
 *
 * @param recorder - The parity record store
 * @param currentStage - The current canary stage (for context)
 */
export function evaluateCanaryGateForShadow(
  recorder: ParityRecorder,
  currentStage: CanaryStage,
): CanaryGateEvaluation {
  void currentStage; // context only — gate rules are stage-independent

  const now = Date.now();
  const cutoff24h = now - MS_24H;
  const cutoff7d  = now - MS_7D;

  const records24h = recorder.getWindow(cutoff24h, now);
  const records7d  = recorder.getWindow(cutoff7d, now);
  const allRecords = recorder.getAll();

  const total_24h = records24h.length;
  const total_7d  = records7d.length;

  // Agreements = class 0, 1, or null (identical)
  const agreements_24h = records24h.filter(
    r => r.divergence_class === null || r.divergence_class <= 1,
  ).length;
  const agreements_7d = records7d.filter(
    r => r.divergence_class === null || r.divergence_class <= 1,
  ).length;

  const parity_score_24h = total_24h > 0 ? agreements_24h / total_24h : 1.0;
  const parity_score_7d  = total_7d  > 0 ? agreements_7d  / total_7d  : 1.0;

  // CLASS_3 in last 24h
  const class3_count_24h = records24h.filter(r => r.divergence_class === 3).length;

  // CLASS_4 ever (in all stored records, not just window)
  const class4_count_ever = allRecords.filter(r => r.divergence_class === 4).length;

  // Evaluate gate (checked in priority order)
  if (total_24h < SHADOW_GATE.MIN_INVOCATIONS_24H) {
    return {
      passes: false,
      reason: `Insufficient data: ${total_24h} invocations in 24h, need ${SHADOW_GATE.MIN_INVOCATIONS_24H}`,
      parity_score_24h,
      parity_score_7d,
      total_24h,
      total_7d,
      class3_count_24h,
      class4_count_ever,
      requires_human_approval: true,
    };
  }

  if (class4_count_ever > SHADOW_GATE.CLASS_4_HARD_LIMIT) {
    return {
      passes: false,
      reason: `CLASS_4 divergence ever: ${class4_count_ever} (limit: 0)`,
      parity_score_24h,
      parity_score_7d,
      total_24h,
      total_7d,
      class3_count_24h,
      class4_count_ever,
      requires_human_approval: true,
    };
  }

  if (class3_count_24h > SHADOW_GATE.CLASS_3_HARD_LIMIT) {
    return {
      passes: false,
      reason: `CLASS_3 divergences in last 24h: ${class3_count_24h} (limit: 0)`,
      parity_score_24h,
      parity_score_7d,
      total_24h,
      total_7d,
      class3_count_24h,
      class4_count_ever,
      requires_human_approval: true,
    };
  }

  if (parity_score_24h < SHADOW_GATE.MIN_PARITY_24H) {
    return {
      passes: false,
      reason: `24h parity ${parity_score_24h.toFixed(5)} < required ${SHADOW_GATE.MIN_PARITY_24H}`,
      parity_score_24h,
      parity_score_7d,
      total_24h,
      total_7d,
      class3_count_24h,
      class4_count_ever,
      requires_human_approval: true,
    };
  }

  if (total_7d >= SHADOW_GATE.MIN_INVOCATIONS_24H && parity_score_7d < SHADOW_GATE.MIN_PARITY_7D) {
    return {
      passes: false,
      reason: `7d parity ${parity_score_7d.toFixed(5)} < required ${SHADOW_GATE.MIN_PARITY_7D}`,
      parity_score_24h,
      parity_score_7d,
      total_24h,
      total_7d,
      class3_count_24h,
      class4_count_ever,
      requires_human_approval: true,
    };
  }

  return {
    passes: true,
    reason: `All gate checks pass: 24h parity=${parity_score_24h.toFixed(5)} (${total_24h} samples), 7d parity=${parity_score_7d.toFixed(5)}, no class3/4 violations`,
    parity_score_24h,
    parity_score_7d,
    total_24h,
    total_7d,
    class3_count_24h,
    class4_count_ever,
    requires_human_approval: true,
  };
}
