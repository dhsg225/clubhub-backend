'use strict';
/**
 * governance-sdk/agent.js
 *
 * GovernanceAgent: high-level agent interface over WorkflowEngine + SDKClient.
 *
 * Halts workflow execution when kernel is:
 *   - FROZEN (no mutations allowed)
 *   - REPLAY (mutation isolation enforced)
 *
 * Emits agent.* events for all lifecycle state changes.
 */

class GovernanceAgent {
  constructor({ workflowEngine, sdkClient, replayHooks, eventBus }) {
    this._workflowEngine = workflowEngine;
    this._sdkClient      = sdkClient;
    this._replayHooks    = replayHooks ?? null;
    this._eventBus       = eventBus   ?? null;
  }

  async run(workflowId, args = {}) {
    // Guard: halt if kernel is frozen (no mutations)
    const frozen = await this._sdkClient.isFrozen();
    if (frozen) {
      return { status: 'BLOCKED', reason: 'kernel frozen', workflow_id: workflowId };
    }

    // Guard: halt if replay mode is active
    if (this._replayHooks && this._replayHooks.isReplayMode()) {
      return { status: 'BLOCKED', reason: 'replay mode active', workflow_id: workflowId };
    }

    this._emit('agent.workflow.started', { workflow_id: workflowId });

    try {
      const trace = await this._workflowEngine.execute(workflowId, args);
      this._emit('agent.workflow.completed', { workflow_id: workflowId, status: trace.status });
      return trace;
    } catch (err) {
      this._emit('agent.workflow.failed', { workflow_id: workflowId, error: err.message });
      throw err;
    }
  }

  _emit(eventType, payload) {
    if (this._eventBus) this._eventBus.emit({ event_type: eventType, payload });
  }
}

module.exports = { GovernanceAgent };
