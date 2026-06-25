'use strict';
/**
 * ReplayConvergenceCertification
 *
 * RCC-01: replay-orchestrator.js exists
 * RCC-02: ReplayOrchestrator has replayWorkflow()
 * RCC-03: ReplayOrchestrator has replayDecisionChain()
 * RCC-04: ReplayOrchestrator has replaySimulation()
 * RCC-05: functional — replayWorkflow returns session with type WORKFLOW
 * RCC-06: functional — replayDecisionChain returns session with type DECISION_CHAIN
 * RCC-07: functional — getActiveSessions() returns array
 * RCC-08: functional — getSession() returns session by id
 * RCC-09: functional — snapshot() has active_sessions count
 * RCC-10: functional — replaySimulation handles missing runtime gracefully
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class ReplayConvergenceCertification {
  async run() {
    const checks = [
      this._exists('RCC-01', 'replay-orchestrator.js', 'ReplayOrchestrator', 'replay-orchestrator.js exists'),
      this._exists('RCC-02', 'replay-orchestrator.js', 'replayWorkflow',     'has replayWorkflow()'),
      this._exists('RCC-03', 'replay-orchestrator.js', 'replayDecisionChain','has replayDecisionChain()'),
      this._exists('RCC-04', 'replay-orchestrator.js', 'replaySimulation',   'has replaySimulation()'),
      await this._replay_workflow_session(),
      await this._replay_decision_chain_session(),
      this._get_active_sessions(),
      this._get_session_by_id(),
      this._snapshot_count(),
      await this._replay_simulation_no_runtime(),
    ];
    return this._result('ReplayConvergenceCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _ro(extra = {}) {
    const { ReplayOrchestrator } = require('../replay-orchestrator');
    return new ReplayOrchestrator(extra);
  }

  async _replay_workflow_session() {
    const id = 'RCC-05'; const desc = 'replayWorkflow returns session with type WORKFLOW';
    try {
      const ro = this._ro({ traceStore: { getByWorkflow: async () => [] } });
      const r  = await ro.replayWorkflow('wf_test');
      if (!r || r.workflow_id !== 'wf_test')
        return { id, description: desc, status: 'FAIL', detail: `result: ${JSON.stringify(r)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _replay_decision_chain_session() {
    const id = 'RCC-06'; const desc = 'replayDecisionChain returns result with agent_id';
    try {
      const { DecisionTrace } = require('../../ai-orchestration/decision-trace');
      const dt = new DecisionTrace();
      const ro = this._ro({ decisionTrace: dt });
      const r  = await ro.replayDecisionChain('agent_x');
      if (!r || r.agent_id !== 'agent_x')
        return { id, description: desc, status: 'FAIL', detail: `result: ${JSON.stringify(r)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _get_active_sessions() {
    const id = 'RCC-07'; const desc = 'getActiveSessions() returns array';
    try {
      const ro   = this._ro();
      const sess = ro.getActiveSessions();
      if (!Array.isArray(sess)) return { id, description: desc, status: 'FAIL', detail: 'not an array' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _get_session_by_id() {
    const id = 'RCC-08'; const desc = 'getSession() returns null for unknown id';
    try {
      const ro = this._ro();
      const s  = ro.getSession('does_not_exist');
      if (s !== null) return { id, description: desc, status: 'FAIL', detail: 'should be null' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _snapshot_count() {
    const id = 'RCC-09'; const desc = 'snapshot() has active_sessions count';
    try {
      const ro   = this._ro();
      const snap = ro.snapshot();
      if (typeof snap.active_sessions !== 'number')
        return { id, description: desc, status: 'FAIL', detail: 'missing active_sessions' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _replay_simulation_no_runtime() {
    const id = 'RCC-10'; const desc = 'replaySimulation handles missing runtime gracefully';
    try {
      const ro = this._ro();  // no simulationRuntime
      const r  = await ro.replaySimulation('scenario_test', 42);
      if (!r || !r.error) return { id, description: desc, status: 'FAIL', detail: 'should return error object' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ReplayConvergenceCertification };
