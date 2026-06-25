'use strict';
/**
 * OrchestrationRuntime — coordinates policy evaluation, workflow execution,
 * replay integration, and trace emission for the AI orchestration layer.
 *
 * H1: Same seed → identical orchestration output.
 * H3: All AI actions replayable — decision traces persisted.
 * H7: AI cannot mutate state outside SDK — enforced via GovernedAgent.
 * H8: DENIED result stops execution immediately.
 *
 * Workflow:
 *   1. registerAgent(config) — create a GovernedAgent instance
 *   2. submitWorkflow(agentId, steps) — sequence of proposed actions
 *   3. Each step: BoundedExecutor → DecisionTrace → PolicyEngine → SDK (if approved)
 *   4. runReplay(entries) — replay a prior decision sequence (no execution)
 *   5. snapshot() — full orchestration state
 *
 * Operator approval:
 *   Paused workflows (REQUIRES_OPERATOR) can be approved via approveOperator(workflowId).
 *   Approved paused steps execute on next resume() call.
 */
const { GovernedAgent }    = require('./governed-agent');
const { PolicyEngine, POLICY_RESULTS } = require('./policy-engine');
const { DecisionTrace }    = require('./decision-trace');
const { BoundedExecutor }  = require('./bounded-executor');
const { Explainability }   = require('./explainability');

class OrchestrationRuntime {
  constructor(deps = {}) {
    if (!deps.sdkClient) throw new TypeError('OrchestrationRuntime requires sdkClient');
    if (!deps.clock)     throw new TypeError('OrchestrationRuntime requires clock');

    this._sdkClient         = deps.sdkClient;
    this._clock             = deps.clock;
    this._eventBus          = deps.eventBus ?? null;
    this._traceStore        = deps.traceStore ?? null;

    // Shared infrastructure (may be shared across agents or per-agent)
    this._policyEngine      = deps.policyEngine   ?? new PolicyEngine();
    this._decisionTrace     = deps.decisionTrace  ?? new DecisionTrace();
    this._boundedExecutor   = deps.boundedExecutor ?? new BoundedExecutor(deps.limits ?? {});
    this._explainer         = new Explainability();

    this._agents            = new Map();  // agentId → GovernedAgent
    this._workflows         = new Map();  // workflowId → { steps, results, status }
    this._pending_operator  = new Map();  // workflowId → { step, decision_id }
    this._seq               = 0;
  }

  // ——— Policy Management ——————————————————————————————————————————

  loadPolicies(policies) { return this._policyEngine.loadPolicies(policies); }
  addPolicy(policy)      { return this._policyEngine.addPolicy(policy); }
  removePolicy(id)       { return this._policyEngine.removePolicy(id); }

  // ——— Agent Registration ——————————————————————————————————————————

  /**
   * Register a new governed agent.
   * Each agent has its own identity and traces — shared policy engine and executor.
   *
   * @param {string} agentId
   * @param {object} opts — optional per-agent clock, eventBus overrides
   */
  registerAgent(agentId, opts = {}) {
    if (this._agents.has(agentId)) {
      throw new Error(`Agent '${agentId}' already registered`);
    }
    const agent = new GovernedAgent({
      agentId,
      policyEngine:    this._policyEngine,
      decisionTrace:   this._decisionTrace,
      boundedExecutor: this._boundedExecutor,
      sdkClient:       this._sdkClient,
      clock:           opts.clock ?? this._clock,
      eventBus:        opts.eventBus ?? this._eventBus,
      explainability:  this._explainer,
    });
    this._agents.set(agentId, agent);
    return agent;
  }

  getAgent(agentId) { return this._agents.get(agentId) ?? null; }

  // ——— Workflow Execution ——————————————————————————————————————————

  /**
   * Submit a sequence of AI-proposed actions as a workflow.
   * Each step is independently policy-evaluated.
   *
   * H8: Any DENIED or FROZEN result halts the workflow at that step.
   *
   * @param {string}  agentId
   * @param {Array}   steps — [{ action_type, args, required? }]
   * @param {object}  opts  — { workflow_id, context_overrides }
   * @returns {{ workflowId, results, status, summary }}
   */
  async submitWorkflow(agentId, steps, opts = {}) {
    const agent = this._agents.get(agentId);
    if (!agent) throw new Error(`Agent '${agentId}' not registered`);

    const workflowId = opts.workflow_id ?? `wf_${agentId}_${++this._seq}`;
    const results    = [];
    let   status     = 'RUNNING';

    this._workflows.set(workflowId, { steps, results, status, agentId });

    this._emit('ai.workflow.started', { agentId, workflowId, step_count: steps.length });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      const result = await agent.propose(
        step.action_type,
        step.args ?? {},
        {
          workflow_id:       workflowId,
          depth:             opts.depth ?? 0,
          context_overrides: opts.context_overrides ?? {},
        }
      );

      results.push({ step_index: i, ...result });

      // Persist to trace store if available (H3)
      await this._persistDecisionTrace(result, workflowId, i);

      // H8: Stop on any blocking result
      if (result.policy_result === POLICY_RESULTS.DENIED ||
          result.policy_result === POLICY_RESULTS.FROZEN ||
          result.policy_result === 'BOUNDARY_EXCEEDED') {
        status = 'HALTED';
        this._emit('ai.workflow.halted', {
          agentId, workflowId, step_index: i,
          reason: result.policy_result, decision_id: result.decision_id,
        });
        break;
      }

      // Pause on operator required
      if (result.policy_result === POLICY_RESULTS.REQUIRES_OPERATOR) {
        status = 'PENDING_OPERATOR';
        this._pending_operator.set(workflowId, { step_index: i, decision_id: result.decision_id });
        this._emit('ai.workflow.paused', { agentId, workflowId, step_index: i });
        break;
      }
    }

    if (status === 'RUNNING') {
      status = 'COMPLETE';
      this._emit('ai.workflow.completed', { agentId, workflowId, step_count: results.length });
    }

    this._workflows.get(workflowId).status = status;

    const summary = this._explainer.summarizeTrace(
      this._decisionTrace.getFinalized().filter(e => e.workflow_id === workflowId)
    );

    return { workflowId, results, status, summary };
  }

  /**
   * Approve a paused workflow and resume execution from the paused step.
   * Sets context_override to reflect operator approval.
   */
  async approveOperator(workflowId, operatorContext = {}) {
    const pending = this._pending_operator.get(workflowId);
    if (!pending) throw new Error(`No pending operator approval for workflow '${workflowId}'`);

    const wf = this._workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow '${workflowId}' not found`);

    this._pending_operator.delete(workflowId);
    this._emit('ai.operator.approved', { workflowId, decision_id: pending.decision_id });

    // Resume from the step after the paused one
    const remainingSteps = wf.steps.slice(pending.step_index + 1);
    return this.submitWorkflow(wf.agentId, remainingSteps, {
      workflow_id:       workflowId,
      context_overrides: { ...operatorContext, operator_approved: true },
    });
  }

  // ——— Replay ——————————————————————————————————————————————————————

  /**
   * Replay a prior decision sequence without executing.
   * Verifies that the same policy evaluation results are produced.
   * H3 compliance check.
   *
   * @param {Array}  entries — persisted finalized DecisionTrace entries
   * @param {object} context — evaluation context (must match original)
   * @returns {{ valid, results, mismatches }}
   */
  async runReplay(entries, context = {}) {
    const results    = [];
    const mismatches = [];

    for (const entry of entries) {
      const policyEval = this._policyEngine.evaluate(
        { ...context, ...entry.context_overrides },
        entry.proposed_action
      );

      const equivalence = policyEval.result === entry.policy_result;
      if (!equivalence) mismatches.push({
        decision_id:      entry.decision_id,
        original_result:  entry.policy_result,
        replayed_result:  policyEval.result,
      });

      results.push({
        decision_id:     entry.decision_id,
        equivalence,
        original_result: entry.policy_result,
        replayed_result: policyEval.result,
      });
    }

    const valid = mismatches.length === 0;
    this._emit('ai.replay.complete', { entry_count: entries.length, valid, mismatch_count: mismatches.length });

    return { valid, results, mismatches };
  }

  /**
   * Verify decision trace chain integrity.
   */
  verifyTraceChain() {
    return this._decisionTrace.verifyChain();
  }

  // ——— Snapshot ————————————————————————————————————————————————————

  snapshot() {
    return Object.freeze({
      agent_count:             this._agents.size,
      workflow_count:          this._workflows.size,
      pending_operator_count:  this._pending_operator.size,
      decision_count:          this._decisionTrace.getCount(),
      finalized_count:         this._decisionTrace.getFinalized().length,
      agents:                  Object.fromEntries([...this._agents.entries()].map(([id, a]) => [id, a.snapshot()])),
    });
  }

  // ——— Private ——————————————————————————————————————————————————————

  async _persistDecisionTrace(result, workflowId, stepIndex) {
    if (!this._traceStore || !result.decision_id) return;
    const finalized = this._decisionTrace.getFinalized().find(e => e.decision_id === result.decision_id);
    if (!finalized) return;
    try {
      await this._traceStore.appendTraceSafe?.({
        workflow_id:       workflowId,
        step_index:        stepIndex,
        event_type:        'ai.decision',
        payload:           {
          decision_id:    finalized.decision_id,
          policy_result:  finalized.policy_result,
          action_type:    finalized.proposed_action?.action_type,
          replay_hash:    finalized.replay_hash,
        },
        lineage_ts:        finalized.lineage_ts ?? 0,
        consistency_level: 'MEMORY_ONLY',
      });
    } catch { /* non-fatal — trace persistence is additive */ }
  }

  _emit(eventType, fields = {}) {
    if (this._eventBus) {
      try { this._eventBus.emit(eventType, fields); } catch { /* safe */ }
    }
  }
}

module.exports = { OrchestrationRuntime };
