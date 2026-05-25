/**
 * Rollback orchestrator.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Orchestrates rollback sequence when a trigger fires.
 * Rollback may auto-execute ONLY for CLASS_4 (catastrophic) failures.
 * For CLASS_3: signals required, does not auto-execute.
 * Human approval required for ALL canary stage changes.
 */

import type { RollbackTriggerOutput, ShadowTelemetryEvent } from '../types';
import type { ParityRecorder } from '../storage/parity-recorder';
import { emit as logEmit, base } from '../../observability/logger';
import { increment, METRICS } from '../../observability/metrics';
import type { RollbackTriggerLog } from '../../observability/telemetry-schemas';

// ─── Rollback Action ──────────────────────────────────────────────────────────

export interface RollbackAction {
  action_type: 'HALT_CANARY' | 'ALERT_OPERATOR' | 'LOG_INCIDENT';
  reason: string;
  severity: string;
  /** true only for CLASS_4 */
  auto_executed: boolean;
  /** always true */
  requires_human_followup: boolean;
}

// ─── Rollback Orchestration ───────────────────────────────────────────────────

/**
 * Orchestrate rollback actions for a rollback trigger.
 *
 * CLASS_4 → HALT_CANARY (auto_executed: true)
 * CLASS_3 → ALERT_OPERATOR (auto_executed: false)
 * Other   → LOG_INCIDENT (auto_executed: false)
 *
 * requires_human_followup is ALWAYS true.
 */
export function orchestrateRollback(
  trigger: RollbackTriggerOutput,
  recorder: ParityRecorder,
  telemetryTarget: ShadowTelemetryEvent[],
): RollbackAction {
  if (!trigger.triggered) {
    return {
      action_type: 'LOG_INCIDENT',
      reason: 'No trigger fired',
      severity: 'INFO',
      auto_executed: false,
      requires_human_followup: true,
    };
  }

  const reason  = trigger.reason ?? 'UNKNOWN';
  const severity = trigger.severity ?? 'CONSTITUTIONAL';

  // Determine action type
  let action_type: RollbackAction['action_type'];
  let auto_executed: boolean;

  if (trigger.triggering_divergence_class === 4) {
    // CLASS_4 catastrophic: auto-halt canary
    action_type = 'HALT_CANARY';
    auto_executed = true;
  } else if (trigger.triggering_divergence_class === 3) {
    // CLASS_3 constitutional: alert operator, no auto-action
    action_type = 'ALERT_OPERATOR';
    auto_executed = false;
  } else {
    // All other triggers: log incident
    action_type = 'LOG_INCIDENT';
    auto_executed = false;
  }

  // Emit RollbackTriggerLog
  const baseLog = base('ERROR', 'rollback.trigger');
  const rollbackLog: RollbackTriggerLog = {
    ts: baseLog.ts,
    severity: baseLog.severity,
    event_type: 'rollback.trigger',
    request_id: baseLog.request_id,
    replay_id: baseLog.replay_id,
    invocation_id: trigger.triggering_invocation_id ?? 'unknown',
    screen_id: trigger.affected_screen_id ?? 'unknown',
    rollback_reason: reason,
    rollback_severity: severity,
    constitutional_reference: trigger.constitutional_reference,
  };
  logEmit(rollbackLog);

  // Increment rollback metric
  increment(METRICS.ROLLBACK_TRIGGER_TOTAL, {
    reason,
    severity,
  });

  // Emit shadow telemetry
  telemetryTarget.push({
    event_type: 'rollback_triggered',
    invocation_id: trigger.triggering_invocation_id ?? 'unknown',
    screen_id: trigger.affected_screen_id ?? 'unknown',
    at: Date.now(),
    canary_stage: 'SHADOW_ONLY', // caller should update this
    payload: {
      action_type,
      auto_executed,
      reason,
      severity,
    },
    emitted_at: Date.now(),
  });

  // Ensure recorder is referenced (satisfies compiler — recorder may be used in production)
  void recorder;

  return {
    action_type,
    reason,
    severity,
    auto_executed,
    requires_human_followup: true, // ALWAYS true
  };
}
