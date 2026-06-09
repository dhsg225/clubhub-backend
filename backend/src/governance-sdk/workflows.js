'use strict';
/**
 * governance-sdk/workflows.js
 *
 * WorkflowEngine: DAG-based deterministic workflow execution over GovernanceSDKClient.
 *
 * Rules:
 *   - Steps are executed in step_index order (deterministic)
 *   - All steps must map to SDK action types
 *   - All workflows carry replayable: true by default
 *   - Emits workflow.* events for full observability
 */

const { validateWorkflow } = require('./validation');
const { WORKFLOW_STATUS }  = require('./types');

class WorkflowEngine {
  constructor({ sdkClient, eventBus }) {
    this._sdkClient = sdkClient;
    this._eventBus  = eventBus;
    this._workflows = new Map();  // id → workflow definition
  }

  /**
   * define(workflow)
   *
   * Register a workflow definition. Validates structure.
   * Assigns step_index and consistencyLevel defaults.
   * Sets replayable: true if not explicitly set.
   */
  define(workflow) {
    validateWorkflow(workflow);

    const steps = workflow.steps.map((step, i) => ({
      ...step,
      step_index:       i,
      consistencyLevel: step.consistencyLevel ?? 'DB_AUTHORITATIVE',
    }));

    const normalized = {
      ...workflow,
      steps,
      replayable: workflow.replayable !== false,  // default true
    };

    this._workflows.set(workflow.id, normalized);
    return this;
  }

  /**
   * execute(workflowId, context)
   *
   * Execute a registered workflow. Returns execution trace.
   */
  async execute(workflowId, context = {}) {
    const workflow = this._workflows.get(workflowId);
    if (!workflow) throw new Error(`WorkflowEngine: unknown workflow '${workflowId}'`);

    const trace = {
      workflow_id: workflowId,
      steps:       [],
      status:      WORKFLOW_STATUS.RUNNING,
      replayable:  workflow.replayable,
    };

    this._emit('workflow.started', { workflow_id: workflowId, step_count: workflow.steps.length });

    for (const step of workflow.steps) {
      const stepResult = await this._executeStep(workflow, step, context);
      trace.steps.push(stepResult);

      if (stepResult.status === 'FAILED') {
        trace.status = WORKFLOW_STATUS.FAILED;
        this._emit('workflow.failed', {
          workflow_id: workflowId,
          step_index:  step.step_index,
          error:       stepResult.error,
        });
        return trace;
      }
    }

    trace.status = WORKFLOW_STATUS.COMPLETED;
    this._emit('workflow.completed', { workflow_id: workflowId, step_count: workflow.steps.length });
    return trace;
  }

  async _executeStep(workflow, step, context) {
    const args = typeof step.args === 'function' ? step.args(context) : (step.args ?? {});

    try {
      const result = await this._sdkClient.execute(step.action, args, {
        workflow_id: workflow.id,
        step_index:  step.step_index,
      });

      this._emit('workflow.step.completed', {
        workflow_id:      workflow.id,
        step_index:       step.step_index,
        action:           step.action,
        consistencyLevel: step.consistencyLevel,
      });

      return { step_index: step.step_index, action: step.action, status: 'COMPLETED', result };
    } catch (err) {
      return { step_index: step.step_index, action: step.action, status: 'FAILED', error: err.message };
    }
  }

  _emit(eventType, payload) {
    if (this._eventBus) this._eventBus.emit({ event_type: eventType, payload });
  }

  getWorkflow(id) { return this._workflows.get(id); }
}

module.exports = { WorkflowEngine };
