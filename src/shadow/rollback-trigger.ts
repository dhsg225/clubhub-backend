/**
 * Rollback trigger evaluation.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Rules (evaluated in precedence order):
 * - CLASS_4 → RollbackReason.CLASS_4_DIVERGENCE (CRITICAL)
 * - CLASS_3 → RollbackReason.CLASS_3_DIVERGENCE (CONSTITUTIONAL)
 * - divergence_class === null && hashes differ → UNSTABLE_CHECKSUM
 * - PRE resolution_level === 0 but is_fallback differs → EMERGENCY_PRECEDENCE_FAILURE
 *
 * Rollback triggers are pure functions — no side effects, fully deterministic.
 */

import type { PRE_Output } from '../pre/types';
import type { RollbackTriggerOutput } from './types';
import type { ManifestComparisonResult } from './comparison/manifest-comparator';
import { ROLLBACK_CLASSES } from './constants';

// ─── Rollback Evaluator ───────────────────────────────────────────────────────

/**
 * Evaluate whether a comparison result requires rollback.
 *
 * @param comparison - The manifest comparison result
 * @param invocationId - The invocation ID for attribution
 * @param screenId - The screen ID affected
 * @param pre - The PRE output (used for emergency detection)
 */
export function evaluateRollbackTrigger(
  comparison: ManifestComparisonResult,
  invocationId: string,
  screenId: string,
  pre: PRE_Output,
): RollbackTriggerOutput {
  const { divergence_class, legacy_hash, pre_hash } = comparison;

  // Check emergency precedence failure first (regardless of class)
  // This happens when PRE resolved at level 0 (emergency) but is_fallback differs
  const emergencyActive = pre.resolution_level === 0;
  if (emergencyActive) {
    const isFallbackDiff = comparison.field_diffs.some(d => d.path === 'is_fallback');
    if (isFallbackDiff) {
      return {
        triggered: true,
        reason: 'EMERGENCY_PRECEDENCE_FAILURE',
        triggering_invocation_id: invocationId,
        triggering_divergence_class: divergence_class,
        affected_screen_id: screenId,
        severity: 'CRITICAL',
        constitutional_reference: 'EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7 — Emergency invariant',
        replay_artifact_id: invocationId,
      };
    }
  }

  // CLASS_4: catastrophic
  if (divergence_class === 4) {
    return {
      triggered: true,
      reason: 'CLASS_4_DIVERGENCE',
      triggering_invocation_id: invocationId,
      triggering_divergence_class: 4,
      affected_screen_id: screenId,
      severity: 'CRITICAL',
      constitutional_reference: 'EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6 — Class 4 CATASTROPHIC divergence',
      replay_artifact_id: invocationId,
    };
  }

  // CLASS_3: constitutional
  if (divergence_class === 3) {
    return {
      triggered: true,
      reason: 'CLASS_3_DIVERGENCE',
      triggering_invocation_id: invocationId,
      triggering_divergence_class: 3,
      affected_screen_id: screenId,
      severity: 'CONSTITUTIONAL',
      constitutional_reference: 'EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6 — Class 3 CONSTITUTIONAL divergence',
      replay_artifact_id: invocationId,
    };
  }

  // Hashes differ but divergence_class is null — unstable checksum
  if (divergence_class === null && legacy_hash !== pre_hash) {
    return {
      triggered: true,
      reason: 'UNSTABLE_CHECKSUM',
      triggering_invocation_id: invocationId,
      triggering_divergence_class: null,
      affected_screen_id: screenId,
      severity: 'CONSTITUTIONAL',
      constitutional_reference: 'EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6 — Hash mismatch with no field diffs',
      replay_artifact_id: invocationId,
    };
  }

  // No rollback required
  return {
    triggered: false,
    reason: null,
    triggering_invocation_id: null,
    triggering_divergence_class: null,
    affected_screen_id: null,
    severity: null,
    constitutional_reference: null,
    replay_artifact_id: null,
  };
}

// Ensure ROLLBACK_CLASSES is used (satisfies strict compiler)
void ROLLBACK_CLASSES;
