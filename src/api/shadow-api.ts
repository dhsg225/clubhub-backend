/**
 * Shadow API — read-only access to parity state.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Routes:
 *   GET /shadow/parity
 *   GET /shadow/readiness
 */

import type { CanaryStage, PromotionReadinessReport } from '../shadow/types';
import { ParityRecorder } from '../shadow/storage/parity-recorder';
import { assessPromotionReadiness } from '../shadow/canary/promotion-readiness';
import { evaluateCanaryGateForShadow } from '../shadow/canary/canary-gate';
import { assertDeterministicResponse, assertReadOnlyRoute } from './api-contracts';

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ShadowParityApiResponse {
  correlation_id: string;
  canary_stage: CanaryStage;
  parity_score: number;
  total_invocations: number;
  agreements: number;
  class3_count: number;
  class4_count: number;
  gate_passes: boolean;
  computed_at: number;
}

export interface ShadowReadinessApiResponse {
  correlation_id: string;
  readiness: PromotionReadinessReport;
  requires_human_approval: true;
  computed_at: number;
}

// ─── Parity Handler ───────────────────────────────────────────────────────────

/**
 * Handle a shadow parity status request.
 */
export function handleShadowParityRequest(
  correlationId: string,
  recorder: ParityRecorder,
  currentStage: CanaryStage,
): ShadowParityApiResponse {
  assertReadOnlyRoute('handleShadowParityRequest');

  const gateEval = evaluateCanaryGateForShadow(recorder, currentStage);
  const allRecords = recorder.getAll();
  const total = allRecords.length;
  const agreements = allRecords.filter(r => r.divergence_class === null).length;
  const parity_score = total > 0 ? agreements / total : 1.0;
  const class3_count = allRecords.filter(r => r.divergence_class === 3).length;
  const class4_count = allRecords.filter(r => r.divergence_class === 4).length;

  const response: ShadowParityApiResponse = {
    correlation_id: correlationId,
    canary_stage: currentStage,
    parity_score,
    total_invocations: total,
    agreements,
    class3_count,
    class4_count,
    gate_passes: gateEval.passes,
    computed_at: Date.now(),
  };

  assertDeterministicResponse(response);

  return response;
}

// ─── Readiness Handler ────────────────────────────────────────────────────────

/**
 * Handle a shadow promotion readiness request.
 * Never initiates promotion. Reports readiness only.
 */
export function handleShadowReadinessRequest(
  correlationId: string,
  recorder: ParityRecorder,
  currentStage: CanaryStage,
): ShadowReadinessApiResponse {
  assertReadOnlyRoute('handleShadowReadinessRequest');

  const readiness = assessPromotionReadiness(recorder, currentStage);

  const response: ShadowReadinessApiResponse = {
    correlation_id: correlationId,
    readiness,
    requires_human_approval: true, // ALWAYS true
    computed_at: Date.now(),
  };

  assertDeterministicResponse(response);

  return response;
}
