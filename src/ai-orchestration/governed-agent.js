'use strict';
/**
 * GovernedAgent — policy-bounded AI agent wrapper.
 *
 * H7: AI cannot mutate state outside SDK — all mutations go through sdkClient.execute().
 * H5: AI freeze awareness — freeze check happens before every proposal.
 * H8: DENIED result stops execution immediately.
 *
 * GovernedAgent wraps AgentRuntime and provides:
 *   - propose(action_type, args, opts) → policy evaluation + conditional execution
 *   - replayProposal(decisionEntry)    → deterministic replay of a prior decision
 *   - snapshot()                       → current agent state
 *
 * AI agents:
 *   NEVER call sdkClient.execute() directly
 *   NEVER call kernel APIs directly
 *   ALWAYS go through GovernedAgent.propose()
 *
 * All proposals are traced before execution (H2).
 */
const { POLICY_RESULTS } = require('./policy-engine');
const { CHECK_RESULTS }  = require('./bounded-executor');

class GovernedAgent {
  constructor(deps = {}) {
    if (!deps.agentId)         throw new TypeError('GovernedAgent requires agentId');
    if (!deps.policyEngine)    throw new TypeError('GovernedAgent requires policyEngine');
    if (!deps.decisionTrace)   throw new TypeError('GovernedAgent requires decisionTrace');
    if (!deps.boundedExecutor) throw new TypeError('GovernedAgent requires boundedExecutor');
    if (!deps.sdkClient)       throw new TypeError('GovernedAgent requires sdkClient');
    if (!deps.clock)           throw new TypeError('GovernedAgent requires clock');

    this._agentId         = deps.agentId;
    this._policyEngine    = deps.policyEngine;
    this._decisionTrace   = deps.decisionTrace;
    this._boundedExecutor = deps.boundedExecutor;
    this._sdkClient       = deps.sdkClient;
    this._clock           = deps.clock;
    this._eventBus        = deps.eventBus ?? null;
    this._explainer       = deps.explainability ?? null;

    this._proposal_count  = 0;
    this._denied_count    = 0;
    this._approved_count  = 0;
    this._paused_count    = 0;
    this._frozen_count    = 0;
    this._active          = true;
  }

  get agentId() { return this._agentId; }

  /**
   * Propose an action for policy evaluation and conditional execution.
   *
   * Lifecycle:
   *   1. BoundedExecutor quota check
   *   2. DecisionTrace.create() — trace before evaluation (H2)
   *   3. PolicyEngine.evaluate() — deterministic (H1)
   *   4. FROZEN / DENIED → stop immediately (H8)
   *   5. REQUIRES_OPERATOR → pause, return pending
   *   6. APPROVED → sdkClient.execute() (H7)
   *   7. DecisionTrace.finalize()
   *
   * @param {string} action_type
   * @param {object} args
   * @param {object} opts — { workflow_id, depth, context_overrides }
   * @returns {object} { decision_id, policy_result, execution_result, explanation }
   */
  async propose(action_type, args = {}, opts = {}) {
    if (!this._active) {
      return { decision_id: null, policy_result: 'AGENT_INACTIVE', execution_result: null };
    }

    const lineage_ts  = this._clock.now();
    const workflow_id = opts.workflow_id ?? `wf_${this._agentId}_auto`;
    const depth       = opts.depth ?? this._boundedExecutor.getDepth(this._agentId);

    // 1. Boundary check (H4, H6)
    const boundaryCheck = this._boundedExecutor.check(
      this._agentId, action_type, lineage_ts, depth
    );

    if (boundaryCheck.result !== CHECK_RESULTS.OK) {
      this._denied_count++;
      this._emit('ai.boundary.exceeded', {
        agent_id: this._agentId, action_type, check_result: boundaryCheck.result,
        detail: boundaryCheck.detail, lineage_ts,
      });
      return {
        decision_id:      null,
        policy_result:    'BOUNDARY_EXCEEDED',
        boundary_result:  boundaryCheck.result,
        execution_result: null,
        explanation:      this._explainer?.explainBoundaryCheck(boundaryCheck, this._agentId, action_type) ?? null,
      };
    }

    const proposed_action = Object.freeze({ action_type, args: { ...args } });

    // Build evaluation context
    const rate_state = this._boundedExecutor.getRateState(this._agentId, lineage_ts);
    const context    = Object.freeze({
      ...( opts.context_overrides ?? {} ),
      agent_id:       this._agentId,
      workflow_id,
      action_type,
      depth,
      lineage_ts,
      rate_state,
    });

    // 2. Trace the proposal BEFORE evaluation (H2)
    const decision_id = this._decisionTrace.create({
      agent_id:       this._agentId,
      workflow_id,
      proposed_action,
      context,
      lineage_ts,
    });

    this._proposal_count++;

    // 3. Policy evaluation (H1)
    const policyEval = this._policyEngine.evaluate(context, proposed_action);
    this._decisionTrace.recordPolicy(decision_id, policyEval);

    // 4. Handle denial/freeze immediately (H8, H5)
    if (policyEval.result === POLICY_RESULTS.DENIED ||
        policyEval.result === POLICY_RESULTS.FROZEN) {
      this._denied_count++;
      if (policyEval.result === POLICY_RESULTS.FROZEN) this._frozen_count++;

      const finalized = this._decisionTrace.finalize(decision_id, null);
      this._emit('ai.proposal.blocked', {
        agent_id: this._agentId, action_type, decision_id,
        policy_result: policyEval.result, reason: policyEval.reason, lineage_ts,
      });

      return {
        decision_id,
        policy_result:    policyEval.result,
        reason:           policyEval.reason,
        execution_result: null,
        explanation:      this._explainer?.explainDecision(finalized) ?? null,
      };
    }

    // 5. REQUIRES_OPERATOR — pause
    if (policyEval.result === POLICY_RESULTS.REQUIRES_OPERATOR) {
      this._paused_count++;
      const finalized = this._decisionTrace.finalize(decision_id, { status: 'PENDING_OPERATOR' });
      this._emit('ai.operator.required', {
        agent_id: this._agentId, action_type, decision_id,
        policy_id: policyEval.policy_id, reason: policyEval.reason, lineage_ts,
      });

      return {
        decision_id,
        policy_result:    policyEval.result,
        reason:           policyEval.reason,
        execution_result: { status: 'PENDING_OPERATOR' },
        explanation:      this._explainer?.explainDecision(finalized) ?? null,
      };
    }

    // 6. APPROVED — execute via SDK only (H7)
    this._approved_count++;
    this._boundedExecutor.pushDepth(this._agentId);

    let execution_result;
    try {
      // All mutations route through sdkClient.execute() — never directly to kernel (H7)
      const sdkResult = await this._sdkClient.execute(action_type, args, {
        workflow_id,
        step_index:  this._proposal_count,
        logical_ts:  lineage_ts,
      });
      execution_result = { status: 'COMPLETED', outcome: sdkResult };
      this._boundedExecutor.record(this._agentId, lineage_ts);
    } catch (err) {
      execution_result = { status: 'FAILED', error: err.message };
    } finally {
      this._boundedExecutor.popDepth(this._agentId);
    }

    // 7. Finalize trace
    const finalized = this._decisionTrace.finalize(decision_id, execution_result);
    this._emit('ai.proposal.executed', {
      agent_id: this._agentId, action_type, decision_id,
      status: execution_result.status, lineage_ts,
    });

    return {
      decision_id,
      policy_result:    POLICY_RESULTS.APPROVED,
      execution_result,
      explanation:      this._explainer?.explainExecution(finalized, execution_result) ?? null,
    };
  }

  /**
   * Replay a prior decision without re-executing.
   * Verifies that the same context produces the same policy result.
   * Does NOT execute — deterministic replay only.
   *
   * @param {object} decisionEntry — persisted finalized DecisionTrace entry
   * @param {object} currentContext — context to evaluate against (must match)
   * @returns {{ equivalence, replayed_result, original_result, explanation }}
   */
  replayProposal(decisionEntry, currentContext) {
    const policyEval = this._policyEngine.evaluate(
      { ...currentContext, ...decisionEntry.context },
      decisionEntry.proposed_action
    );

    const equivalence = policyEval.result === decisionEntry.policy_result;

    const explanation = this._explainer?.explainReplay(
      decisionEntry,
      { replay_hash: null, policy_result: policyEval.result }  // no new hash — replay only
    ) ?? null;

    this._emit('ai.replay.verified', {
      agent_id:     this._agentId,
      decision_id:  decisionEntry.decision_id,
      equivalence,
      original:     decisionEntry.policy_result,
      replayed:     policyEval.result,
    });

    return {
      equivalence,
      replayed_result:  policyEval.result,
      original_result:  decisionEntry.policy_result,
      explanation,
    };
  }

  /** Deactivate agent — all further proposals return AGENT_INACTIVE. */
  deactivate() { this._active = false; }

  snapshot() {
    return Object.freeze({
      agent_id:        this._agentId,
      active:          this._active,
      proposal_count:  this._proposal_count,
      approved_count:  this._approved_count,
      denied_count:    this._denied_count,
      paused_count:    this._paused_count,
      frozen_count:    this._frozen_count,
      current_depth:   this._boundedExecutor.getDepth(this._agentId),
      session_total:   this._boundedExecutor.getSessionCount(this._agentId),
    });
  }

  _emit(eventType, fields = {}) {
    if (this._eventBus) {
      try {
        this._eventBus.emit(eventType, fields);
      } catch { /* safe — never disrupt AI execution on bus failure */ }
    }
  }
}

module.exports = { GovernedAgent };
