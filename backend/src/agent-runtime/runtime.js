'use strict';
/**
 * agent-runtime/runtime.js
 *
 * AgentRuntime — orchestrates state machine, workflow executor, scheduler, and context.
 *
 * State transitions:
 *   - Transitions to 'RUNNING' on start()/run()
 *   - Transitions to 'BLOCKED' when kernel is FROZEN or in REPLAY mode
 *   - Transitions to 'IDLE' after workflow completes
 *   - Transitions to 'TERMINATED' on shutdown()
 *
 * Emits agent.lifecycle.changed on all state transitions.
 * Uses DeterministicContext for all time/random — no wall-clock dependence.
 */

const { AgentStateMachine, AGENT_STATES } = require('./state-machine');
const { WorkflowExecutor }                = require('./executor');
const { DeterministicScheduler }          = require('./scheduler');
const { DeterministicContext }            = require('./deterministic-context');

class AgentRuntime {
  constructor({ sdkClient, kernelClock, eventBus, replayHooks, seed }) {
    this._sdkClient = sdkClient;
    this._eventBus  = eventBus;

    this._stateMachine = new AgentStateMachine();
    this._context      = new DeterministicContext({ kernelClock, seed, eventBus, replayHooks });
    this._executor     = new WorkflowExecutor({ sdkClient, eventBus });
    this._scheduler    = new DeterministicScheduler({ eventBus, replayHooks });
    this._replayHooks  = replayHooks ?? null;
    this._workflows    = new Map();
  }

  registerWorkflow(workflow) {
    this._workflows.set(workflow.id, workflow);
    return this;
  }

  scheduleWorkflow(workflowId, triggerEventPattern) {
    this._scheduler.schedule(workflowId, triggerEventPattern);
    return this;
  }

  start() {
    this._transition('RUNNING', 'runtime started');
    this._scheduler.start((workflowId, triggerEvent) => {
      this._runWorkflow(workflowId, { triggerEvent }).catch(err => {
        this._emitEvent('agent.runtime.error', { error: err.message });
      });
    });
  }

  /**
   * run(workflowId, args)
   *
   * Execute a workflow immediately.
   * Checks kernel FROZEN and REPLAY states before proceeding.
   */
  async run(workflowId, args = {}) {
    if (this._stateMachine.isTerminated()) {
      return { status: 'TERMINATED', workflow_id: workflowId };
    }

    // Check kernel freeze → transition to BLOCKED
    const frozen = await this._sdkClient.isFrozen();
    if (frozen) {
      this._transition('BLOCKED', 'kernel frozen');
      return { status: 'BLOCKED', reason: 'kernel frozen', workflow_id: workflowId };
    }

    // Check replay mode → transition to BLOCKED (mutations disallowed)
    if (this._replayHooks && this._replayHooks.isReplayMode()) {
      this._transition('BLOCKED', 'replay mode active');
      return { status: 'BLOCKED', reason: 'replay mode active', workflow_id: workflowId };
    }

    return this._runWorkflow(workflowId, args);
  }

  unblock(reason) {
    if (this._stateMachine.isBlocked()) {
      this._transition('RUNNING', reason ?? 'unblocked');
    }
  }

  shutdown() {
    this._scheduler.stop();
    this._context.dispose();
    this._transition('TERMINATED', 'runtime shutdown');
  }

  async _runWorkflow(workflowId, args) {
    const workflow = this._workflows.get(workflowId);
    if (!workflow) throw new Error(`AgentRuntime: unknown workflow '${workflowId}'`);

    if (!this._stateMachine.isRunning()) {
      this._transition('RUNNING', `starting workflow ${workflowId}`);
    }

    this._emitEvent('agent.workflow.started', { workflow_id: workflowId });

    const results = await this._executor.execute(workflow, this._context, this._stateMachine);

    const allComplete = results.every(r => r.status === 'COMPLETED' || r.status === 'SKIPPED');
    const status = allComplete ? 'COMPLETED' : 'FAILED';

    this._emitEvent('agent.workflow.completed', { workflow_id: workflowId, status });

    if (!this._stateMachine.isTerminated() && !this._stateMachine.isBlocked()) {
      this._transition('IDLE', `workflow ${workflowId} completed`);
    }

    return { workflow_id: workflowId, status, results };
  }

  _transition(toState, reason) {
    try {
      const { from, to } = this._stateMachine.transition(toState, reason);
      // Emit agent.lifecycle.changed on every state transition
      this._emitEvent('agent.lifecycle.changed', { from, to, reason });
    } catch (err) {
      this._emitEvent('agent.lifecycle.error', { error: err.message, reason });
    }
  }

  _emitEvent(eventType, payload) {
    if (this._eventBus) this._eventBus.emit({ event_type: eventType, payload });
  }

  snapshot() {
    return {
      stateMachine: this._stateMachine.snapshot(),
      context:      this._context.snapshot(),
      scheduler:    this._scheduler.snapshot(),
    };
  }
}

module.exports = { AgentRuntime };
