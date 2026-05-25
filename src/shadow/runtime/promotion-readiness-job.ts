/**
 * Promotion readiness job.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Generates periodic promotion readiness reports.
 * Never initiates promotion. Reports readiness only.
 * Human approval required for ALL canary stage changes.
 */

import type { CanaryStage, PromotionReadinessReport } from '../types';
import { CANARY_STAGE_ORDER } from '../types';
import { ParityRecorder } from '../storage/parity-recorder';
import { assessPromotionReadiness } from '../canary/promotion-readiness';
import { emit as logEmit, base } from '../../observability/logger';
import { setGauge, METRICS } from '../../observability/metrics';
import type { CanaryGateLog } from '../../observability/telemetry-schemas';

// ─── Promotion Readiness Job ──────────────────────────────────────────────────

export class PromotionReadinessJob {
  /**
   * Generate a promotion readiness report.
   * Emits CanaryGateLog via logger.
   * Increments CANARY_STAGE metric.
   * Never auto-promotes.
   */
  run(recorder: ParityRecorder, currentStage: CanaryStage): PromotionReadinessReport {
    return generatePromotionReadinessReport(recorder, currentStage);
  }
}

/**
 * Generate a promotion readiness report for the given canary stage.
 *
 * Delegates to assessPromotionReadiness().
 * Emits telemetry.
 * Never auto-promotes.
 */
export function generatePromotionReadinessReport(
  recorder: ParityRecorder,
  currentStage: CanaryStage,
): PromotionReadinessReport {
  const report = assessPromotionReadiness(recorder, currentStage);

  // Update CANARY_STAGE gauge
  const stageIndex = CANARY_STAGE_ORDER.indexOf(currentStage);
  setGauge(METRICS.CANARY_STAGE, stageIndex);

  // Emit CanaryGateLog
  const baseLog = base('INFO', 'canary.gate.evaluated');
  const gateLog: CanaryGateLog = {
    ts: baseLog.ts,
    severity: baseLog.severity,
    event_type: 'canary.gate.evaluated',
    request_id: baseLog.request_id,
    replay_id: baseLog.replay_id,
    passes: report.is_ready,
    reason: report.blocking_reasons.join('; ') || 'All gates passed',
    score_24h: report.parity_score_24h,
    score_7d: report.parity_score_7d,
    total_24h: report.total_invocations_24h,
  };
  logEmit(gateLog);

  return report;
}
