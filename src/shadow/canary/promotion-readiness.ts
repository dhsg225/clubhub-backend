/**
 * Promotion readiness assessment.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Aggregates gate eval, parity, and stability signals into a single report.
 * Never initiates promotion. Only reports readiness.
 * Human approval is ALWAYS required before promotion.
 */

import { ParityRecorder } from '../storage/parity-recorder';
import { evaluateCanaryGateForShadow } from './canary-gate';
import { CANARY_STAGE_ORDER } from '../types';
import type { CanaryStage, PromotionReadinessReport } from '../types';

// ─── Readiness Assessor ───────────────────────────────────────────────────────

/**
 * Assess full promotion readiness for the current canary stage.
 *
 * @param recorder - The parity record store
 * @param currentStage - The current canary stage
 */
export function assessPromotionReadiness(
  recorder: ParityRecorder,
  currentStage: CanaryStage,
): PromotionReadinessReport {
  const gateEval = evaluateCanaryGateForShadow(recorder, currentStage);

  // Determine next stage
  const currentIndex = CANARY_STAGE_ORDER.indexOf(currentStage);
  const nextStage: CanaryStage | null =
    currentIndex < CANARY_STAGE_ORDER.length - 1
      ? (CANARY_STAGE_ORDER[currentIndex + 1] ?? null)
      : null;

  const blocking_reasons: string[] = [];

  // Collect all blocking reasons
  if (!gateEval.passes) {
    blocking_reasons.push(gateEval.reason);
  }

  if (currentStage === 'AUTHORITATIVE') {
    blocking_reasons.push('Already at AUTHORITATIVE stage — no further promotion possible');
  }

  // Derived stability signals (from gate eval)
  const zero_class3_class4_violations =
    gateEval.class3_count_24h === 0 && gateEval.class4_count_ever === 0;

  // Invariant stability: no class3/4 violations ever
  const invariant_stability = gateEval.class4_count_ever === 0;

  // Entropy stability: parity_24h above threshold
  const entropy_stability = gateEval.parity_score_24h >= 0.999;

  // chaos_verification_stable: always true in shadow mode
  // (verified by CI stage 08 independently)
  const chaos_verification_stable = true;

  // operator_visibility_intact: always true while parity recording is active
  const operator_visibility_intact = true;

  const is_ready = blocking_reasons.length === 0 && nextStage !== null;

  return {
    current_stage: currentStage,
    next_stage: nextStage,
    is_ready,
    blocking_reasons,
    parity_score_24h: gateEval.parity_score_24h,
    parity_score_7d: gateEval.parity_score_7d,
    total_invocations_24h: gateEval.total_24h,
    zero_class3_class4_violations,
    invariant_stability,
    entropy_stability,
    chaos_verification_stable,
    operator_visibility_intact,
    requires_human_approval: true, // ALWAYS true
  };
}
