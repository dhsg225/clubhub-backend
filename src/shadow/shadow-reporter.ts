/**
 * Shadow execution reporter.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Generates a ShadowReport from parity records over a time window.
 * report_checksum is computed deterministically over all fields except itself.
 */

import { fnv1a32 } from '../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';
import { ParityRecorder } from './storage/parity-recorder';
import { assessPromotionReadiness } from './canary/promotion-readiness';
import type { CanaryStage, ShadowReport } from './types';

// ─── Reporter ─────────────────────────────────────────────────────────────────

/**
 * Generate a shadow report from parity records over a time window.
 *
 * @param recorder - The parity record store
 * @param currentStage - The current canary stage
 * @param windowStartMs - Start of the reporting window (UTC ms, inclusive)
 * @param windowEndMs - End of the reporting window (UTC ms, inclusive)
 */
export function generateShadowReport(
  recorder: ParityRecorder,
  currentStage: CanaryStage,
  windowStartMs: number,
  windowEndMs: number,
): ShadowReport {
  const generatedAt = Date.now();
  const reportId = `shadow-report-${generatedAt}-${currentStage}`;

  const records = recorder.getWindow(windowStartMs, windowEndMs);

  const total_invocations = records.length;

  // Classification buckets
  // agreements: class 0, 1, or null (identical)
  const agreements = records.filter(
    r => r.divergence_class === null || r.divergence_class <= 1,
  ).length;

  // warnings: class 2
  const warnings = records.filter(r => r.divergence_class === 2).length;

  // disagreements: class 3 or 4
  const disagreements = records.filter(
    r => r.divergence_class !== null && r.divergence_class >= 3,
  ).length;

  // parity_score = agreements / total (1.0 if empty)
  const parity_score = total_invocations > 0 ? agreements / total_invocations : 1.0;

  // rollback_triggers: records with class 3 or 4
  const rollback_triggers = disagreements;

  // Promotion readiness
  const promotion_readiness = assessPromotionReadiness(recorder, currentStage);

  // Build report without checksum
  const reportWithoutChecksum = {
    report_id: reportId,
    generated_at: generatedAt,
    canary_stage: currentStage,
    window_start_ms: windowStartMs,
    window_end_ms: windowEndMs,
    total_invocations,
    agreements,
    warnings,
    disagreements,
    parity_score,
    rollback_triggers,
    promotion_readiness,
  };

  // Compute deterministic checksum
  const report_checksum = fnv1a32(canonicalizeJson(reportWithoutChecksum));

  return {
    ...reportWithoutChecksum,
    report_checksum,
  };
}
