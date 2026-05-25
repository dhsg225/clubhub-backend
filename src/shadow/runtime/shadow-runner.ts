/**
 * Shadow comparison runner.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Executes a shadow comparison:
 * 1. Accepts legacy output + PRE output (pre-computed by caller)
 * 2. Compares outputs using manifest-comparator
 * 3. Persists parity record
 * 4. Emits telemetry events
 * 5. Evaluates rollback trigger
 * 6. Returns ShadowComparisonResult
 *
 * Shadow execution is SIDE-EFFECT FREE within the PRE domain.
 * It does NOT call PRE.resolve() itself — that happens in the Manifest Delivery System.
 * The runner receives pre-computed outputs and compares them.
 */

import { compareLegacyVsPRE } from '../comparison/manifest-comparator';
import { buildParityRecord, ParityRecorder } from '../storage/parity-recorder';
import { evaluateRollbackTrigger } from '../rollback-trigger';
import { assertShadowSideEffectFree, assertNoSilentDivergenceSuppression } from '../contracts/shadow-contracts';
import type { PRE_Output } from '../../pre/types';
import type {
  CanaryStage,
  LegacyOutput,
  ShadowComparisonResult,
  ShadowTelemetryEvent,
} from '../types';

// ─── Shadow Runner ────────────────────────────────────────────────────────────

/**
 * Run a shadow comparison between legacy and PRE outputs.
 *
 * @param invocationId - UUID v4 for this invocation
 * @param canaryStage - Current canary deployment stage
 * @param legacy - Legacy resolver output
 * @param pre - PRE output (pre-computed by caller)
 * @param recorder - Append-only parity record store
 * @param telemetryTarget - Caller-managed telemetry event array (append-only)
 */
export function runShadowComparison(
  invocationId: string,
  canaryStage: CanaryStage,
  legacy: LegacyOutput,
  pre: PRE_Output,
  recorder: ParityRecorder,
  telemetryTarget: ShadowTelemetryEvent[],
): ShadowComparisonResult {
  const executedAt = Date.now();

  // Contract: verify PRE output is side-effect free
  assertShadowSideEffectFree(pre);

  // Emit: shadow_execution_started
  emit(telemetryTarget, {
    event_type: 'shadow_execution_started',
    invocation_id: invocationId,
    screen_id: legacy.screen_id,
    at: executedAt,
    canary_stage: canaryStage,
    payload: { canary_stage: canaryStage },
  });

  // Compare legacy vs PRE
  const comparison = compareLegacyVsPRE(invocationId, legacy, pre);

  // Evaluate rollback trigger
  const rollback = evaluateRollbackTrigger(comparison, invocationId, legacy.screen_id, pre);

  // Contract: no silent divergence suppression
  assertNoSilentDivergenceSuppression(comparison, rollback);

  // Build parity record
  const record = buildParityRecord(
    invocationId,
    executedAt,
    comparison.legacy_hash,
    comparison.pre_hash,
    comparison.divergence_class,
    comparison.divergence_report?.classification_reason ?? null,
    canaryStage,
  );

  // Persist parity record
  recorder.append(record);

  // Emit: parity_record_written
  emit(telemetryTarget, {
    event_type: 'parity_record_written',
    invocation_id: invocationId,
    screen_id: legacy.screen_id,
    at: executedAt,
    canary_stage: canaryStage,
    payload: {
      replay_artifact_id: invocationId,
      divergence_class: comparison.divergence_class,
      deterministic_checksum: record.deterministic_checksum,
    },
  });

  // Emit: divergence_detected (if any divergence)
  if (comparison.divergence_class !== null) {
    emit(telemetryTarget, {
      event_type: 'divergence_detected',
      invocation_id: invocationId,
      screen_id: legacy.screen_id,
      at: executedAt,
      canary_stage: canaryStage,
      payload: {
        divergence_class: comparison.divergence_class,
        divergence_summary: comparison.divergence_report?.classification_reason ?? null,
        affected_fields: comparison.field_diffs.map(d => d.path),
        blocks_deploy: comparison.divergence_report?.blocks_deploy ?? false,
      },
    });
  }

  // Emit: rollback_triggered (if triggered)
  if (rollback.triggered) {
    emit(telemetryTarget, {
      event_type: 'rollback_triggered',
      invocation_id: invocationId,
      screen_id: legacy.screen_id,
      at: executedAt,
      canary_stage: canaryStage,
      payload: {
        reason: rollback.reason,
        severity: rollback.severity,
        constitutional_reference: rollback.constitutional_reference,
        replay_artifact_id: rollback.replay_artifact_id,
      },
    });
  }

  // Build and return result
  const result: ShadowComparisonResult = {
    invocation_id: invocationId,
    screen_id: legacy.screen_id,
    at: executedAt,
    canary_stage: canaryStage,
    legacy_hash: comparison.legacy_hash,
    pre_hash: comparison.pre_hash,
    divergence_class: comparison.divergence_class,
    divergence_summary: comparison.divergence_report?.classification_reason ?? null,
    affected_fields: comparison.field_diffs.map(d => d.path),
    rollback_required: rollback.triggered,
    replay_artifact_id: invocationId,
    executed_at: executedAt,
  };

  // Emit: shadow_execution_completed (always — even on rollback)
  emit(telemetryTarget, {
    event_type: 'shadow_execution_completed',
    invocation_id: invocationId,
    screen_id: legacy.screen_id,
    at: executedAt,
    canary_stage: canaryStage,
    payload: {
      divergence_class: result.divergence_class,
      rollback_required: result.rollback_required,
      replay_artifact_id: result.replay_artifact_id,
    },
  });

  return result;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function emit(
  target: ShadowTelemetryEvent[],
  event: Omit<ShadowTelemetryEvent, 'emitted_at'>,
): void {
  target.push({
    ...event,
    emitted_at: Date.now(),
  });
}
