/**
 * Canary stage transition validation.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * A transition is only allowed if:
 * 1. It is to the next stage in CANARY_STAGE_ORDER (no skipping)
 * 2. All gate checks pass
 * 3. requires_human_approval === true (must be documented in calling code)
 *
 * NEVER auto-advances. Always returns requires_human_approval: true.
 */

import { CANARY_STAGE_ORDER } from '../types';
import type { CanaryStage, StageTransitionResult } from '../types';
import type { CanaryGateEvaluation } from './canary-gate';

// ─── Transition Validator ─────────────────────────────────────────────────────

/**
 * Validate whether a stage transition is constitutionally permissible.
 *
 * @param from - Current stage
 * @param to - Requested next stage
 * @param gateEval - Gate evaluation result
 */
export function validateStageTransition(
  from: CanaryStage,
  to: CanaryStage,
  gateEval: CanaryGateEvaluation,
): StageTransitionResult {
  const base: Omit<StageTransitionResult, 'allowed' | 'blocking_reason'> = {
    from_stage: from,
    to_stage: to,
    parity_score_24h: gateEval.parity_score_24h,
    parity_score_7d: gateEval.parity_score_7d,
    total_invocations: gateEval.total_24h,
    requires_human_approval: true, // ALWAYS true — never automatic
  };

  // Cannot transition FROM AUTHORITATIVE (already at max stage)
  if (from === 'AUTHORITATIVE') {
    return {
      ...base,
      allowed: false,
      blocking_reason: 'Already at AUTHORITATIVE stage — no further transitions possible',
    };
  }

  // Validate sequential progression (no skipping)
  const fromIndex = CANARY_STAGE_ORDER.indexOf(from);
  const toIndex   = CANARY_STAGE_ORDER.indexOf(to);

  if (fromIndex === -1) {
    return {
      ...base,
      allowed: false,
      blocking_reason: `Unknown from_stage: "${from}"`,
    };
  }

  if (toIndex === -1) {
    return {
      ...base,
      allowed: false,
      blocking_reason: `Unknown to_stage: "${to}"`,
    };
  }

  if (toIndex !== fromIndex + 1) {
    const expected = CANARY_STAGE_ORDER[fromIndex + 1];
    return {
      ...base,
      allowed: false,
      blocking_reason: `Stage skipping not permitted. Expected next stage: "${expected ?? 'none'}", got: "${to}"`,
    };
  }

  // Gate must pass
  if (!gateEval.passes) {
    return {
      ...base,
      allowed: false,
      blocking_reason: `Canary gate failed: ${gateEval.reason}`,
    };
  }

  // All checks pass — transition is permissible (still requires human approval)
  return {
    ...base,
    allowed: true,
    blocking_reason: null,
  };
}
