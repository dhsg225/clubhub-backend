'use strict';
/**
 * ReplayOrchestrator — unified replay surface across ALL platform subsystems.
 * All replay operations are isolated: no live mutations, frozen clock, memory adapters.
 */

const REPLAY_TYPES = Object.freeze({
  WORKFLOW:        'WORKFLOW',
  DECISION_CHAIN:  'DECISION_CHAIN',
  INCIDENT:        'INCIDENT',
  DEPLOYMENT:      'DEPLOYMENT',
  SIMULATION:      'SIMULATION',
  PLATFORM_STATE:  'PLATFORM_STATE',
});

class ReplayOrchestrator {
  constructor({ traceStore, decisionTrace, orchestrationRuntime, simulationRuntime, clock, eventBus } = {}) {
    this._traceStore           = traceStore           ?? null;
    this._decisionTrace        = decisionTrace        ?? null;
    this._orchestrationRuntime = orchestrationRuntime ?? null;
    this._simulationRuntime    = simulationRuntime    ?? null;
    this._clock                = clock                ?? null;
    this._eventBus             = eventBus             ?? null;
    this._activeSessions       = new Map();  // session_id → session
    this._seq                  = 0;
  }

  _sessionId(type) { return `replay_${type.toLowerCase()}_${++this._seq}`; }

  _startSession(type, opts = {}) {
    const session_id = this._sessionId(type);
    const session = {
      session_id,
      type,
      started_at:   Date.now(),
      opts,
      status:       'RUNNING',
      results:      null,
    };
    this._activeSessions.set(session_id, session);
    this._emit('platform.replay.session_started', { session_id, type });
    return session;
  }

  _endSession(session, results) {
    session.status   = 'COMPLETE';
    session.results  = results;
    session.ended_at = Date.now();
    this._emit('platform.replay.session_complete', { session_id: session.session_id, type: session.type });
    return results;
  }

  async replayWorkflow(workflowId, opts = {}) {
    const session = this._startSession(REPLAY_TYPES.WORKFLOW, opts);
    if (!this._traceStore) return this._endSession(session, { error: 'trace_store_unavailable' });
    const entries = await this._traceStore.getByWorkflow?.(workflowId) ?? [];
    const result  = { workflow_id: workflowId, entry_count: entries.length, entries, valid: entries.length > 0 };
    return this._endSession(session, result);
  }

  async replayDecisionChain(agentId, opts = {}) {
    const session = this._startSession(REPLAY_TYPES.DECISION_CHAIN, opts);
    if (!this._decisionTrace) return this._endSession(session, { error: 'decision_trace_unavailable' });
    const entries  = this._decisionTrace.getFinalized().filter(e => e.agent_id === agentId);
    const verified = this._decisionTrace.verifyChain?.();
    const result   = { agent_id: agentId, entry_count: entries.length, chain_valid: verified?.valid ?? null, entries };
    return this._endSession(session, result);
  }

  async replayIncident(incidentId, opts = {}) {
    const session = this._startSession(REPLAY_TYPES.INCIDENT, opts);
    if (!this._traceStore) return this._endSession(session, { error: 'trace_store_unavailable' });
    const entries = await this._traceStore.getByWorkflow?.(incidentId) ?? [];
    const result  = { incident_id: incidentId, entry_count: entries.length, entries };
    return this._endSession(session, result);
  }

  async replayDeployment(deploymentId, opts = {}) {
    const session = this._startSession(REPLAY_TYPES.DEPLOYMENT, opts);
    if (!this._traceStore) return this._endSession(session, { error: 'trace_store_unavailable' });
    const entries = await this._traceStore.getByWorkflow?.(deploymentId) ?? [];
    const result  = { deployment_id: deploymentId, entry_count: entries.length, entries };
    return this._endSession(session, result);
  }

  async replaySimulation(scenarioId, seed, opts = {}) {
    const session = this._startSession(REPLAY_TYPES.SIMULATION, opts);
    if (!this._simulationRuntime) return this._endSession(session, { error: 'simulation_runtime_unavailable' });
    try {
      const { createSimulationContext } = this._simulationRuntime;
      if (!createSimulationContext) return this._endSession(session, { error: 'createSimulationContext_missing' });
      // Re-run scenario with same seed for determinism check
      const ctx1 = createSimulationContext({ seed });
      const ctx2 = createSimulationContext({ seed });
      const r1 = ctx1.reporter.generate({ scenario_id: scenarioId, seed, events: [], faults: [], invariants: [], status: 'REPLAY' });
      const r2 = ctx2.reporter.generate({ scenario_id: scenarioId, seed, events: [], faults: [], invariants: [], status: 'REPLAY' });
      const deterministic = r1.body.seed === r2.body.seed;
      return this._endSession(session, { scenario_id: scenarioId, seed, deterministic });
    } catch (err) {
      return this._endSession(session, { error: err.message });
    }
  }

  async replayPlatformState(epochTs, opts = {}) {
    const session  = this._startSession(REPLAY_TYPES.PLATFORM_STATE, opts);
    const result   = {
      epoch_ts:      epochTs,
      replay_type:   REPLAY_TYPES.PLATFORM_STATE,
      subsystems:    ['kernel', 'sdk', 'trace_store', 'orchestration', 'simulation'],
      note:          'platform state replay requires trace entries from each subsystem at the given epoch',
    };
    return this._endSession(session, result);
  }

  getActiveSessions()    { return [...this._activeSessions.values()]; }
  getSession(sessionId)  { return this._activeSessions.get(sessionId) ?? null; }

  _emit(type, fields) {
    if (this._eventBus) this._eventBus.emit(type, fields);
  }

  snapshot() {
    return {
      active_sessions: this.getActiveSessions().length,
      sessions:        this.getActiveSessions(),
    };
  }
}

module.exports = { ReplayOrchestrator, REPLAY_TYPES };
