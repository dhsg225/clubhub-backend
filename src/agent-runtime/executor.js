'use strict';
/**
 * agent-runtime/executor.js
 *
 * WorkflowExecutor — executes SDK workflows step by step.
 *
 * All kernel mutations route through sdkClient — no direct kernel API calls.
 * Emits workflow.step.completed per step for full observability + replay reconstruction.
 *
 * Guards checked before EVERY step:
 *   - TERMINATED: abort immediately, no further steps
 *   - BLOCKED:    skip step, continue (unblocked later by state machine)
 */

class WorkflowExecutor {
  constructor({ sdkClient, eventBus, traceStore }) {
    this._sdkClient  = sdkClient;
    this._eventBus   = eventBus   ?? null;
    this._traceStore = traceStore ?? null;  // optional — additive trace hook
  }

  /**
   * execute(workflow, context, stateMachine)
   *
   * @param {object} workflow       - { id, steps: [{ action, args, step_index, consistencyLevel }] }
   * @param {object} context        - DeterministicContext (clock, random, replay check)
   * @param {object} stateMachine   - AgentStateMachine (checked before each step)
   * @returns {Array} step results
   */
  async execute(workflow, context, stateMachine) {
    const results = [];

    for (const step of workflow.steps) {
      // Guard: TERMINATED — stop immediately
      if (stateMachine.isTerminated()) {
        break;
      }

      // Guard: BLOCKED — skip this step
      if (stateMachine.isBlocked()) {
        results.push({ step_index: step.step_index, status: 'SKIPPED', reason: 'BLOCKED' });
        continue;
      }

      const args = typeof step.args === 'function'
        ? step.args(context)
        : (step.args ?? {});

      try {
        // All mutations route through sdkClient — never directly to kernel
        const result = await this._sdkClient.execute(step.action, args, {
          workflow_id: workflow.id,
          step_index:  step.step_index,
          logical_ts:  context.now(),
        });

        this._emit('workflow.step.completed', {
          workflow_id:      workflow.id,
          step_index:       step.step_index,
          action:           step.action,
          consistencyLevel: step.consistencyLevel,
          logical_ts:       context.now(),
        });

        // Non-invasive traceStore hook — additive only, never disrupts execution
        if (this._traceStore) {
          await this._traceStore.appendTraceSafe({
            workflow_id:       workflow.id,
            step_index:        step.step_index,
            event_type:        'workflow.step.completed',
            payload:           { action: step.action, consistencyLevel: step.consistencyLevel },
            lineage_ts:        context.now() ?? 0,
            consistency_level: step.consistencyLevel ?? null,
          });
        }

        results.push({ step_index: step.step_index, status: 'COMPLETED', result });
      } catch (err) {
        this._emit('workflow.step.failed', {
          workflow_id: workflow.id,
          step_index:  step.step_index,
          error:       err.message,
        });
        results.push({ step_index: step.step_index, status: 'FAILED', error: err.message });
        break;  // halt workflow on first step failure
      }
    }

    return results;
  }

  _emit(eventType, payload) {
    if (this._eventBus) this._eventBus.emit({ event_type: eventType, payload });
  }
}

module.exports = { WorkflowExecutor };
