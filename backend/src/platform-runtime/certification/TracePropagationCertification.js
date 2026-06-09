'use strict';
/**
 * TracePropagationCertification
 *
 * TPC-01: execution-router.js propagates correlation_id
 * TPC-02: execution-router.js propagates lineage_ts
 * TPC-03: lifecycle-coordinator.js traces transitions
 * TPC-04: decision-trace.js has correlation context fields
 * TPC-05: functional — route() with no correlation_id generates one
 * TPC-06: functional — route() with provided correlation_id uses it
 * TPC-07: functional — lifecycle transition recorded in history
 * TPC-08: functional — decision trace entry has agent_id field
 * TPC-09: functional — decision trace entry has workflow_id field
 * TPC-10: functional — decision trace verifyChain() on empty is valid
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class TracePropagationCertification {
  async run() {
    const checks = [
      this._exists('TPC-01', 'execution-router.js', 'correlation_id',  'execution-router propagates correlation_id'),
      this._exists('TPC-02', 'execution-router.js', 'lineage_ts',      'execution-router propagates lineage_ts'),
      this._exists('TPC-03', 'lifecycle-coordinator.js', 'traceStore', 'lifecycle-coordinator traces transitions'),
      this._exists('TPC-04', '../ai-orchestration/decision-trace.js', 'agent_id', 'decision-trace has agent_id'),
      await this._auto_correlation_id(),
      await this._provided_correlation_id(),
      this._lifecycle_history(),
      this._decision_agent_id(),
      this._decision_workflow_id(),
      this._decision_verify_empty(),
    ];
    return this._result('TracePropagationCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  async _auto_correlation_id() {
    const id = 'TPC-05'; const desc = 'route() with no correlation_id generates one';
    try {
      let received = null;
      const sdk = { execute: async (at, args, opts) => { received = opts; return {}; } };
      const { ExecutionRouter } = require('../execution-router');
      const er = new ExecutionRouter({ sdkClient: sdk });
      await er.route('WORKFLOW', 'APPEND_AUDIT', {});
      if (!received || !received.correlation_id)
        return { id, description: desc, status: 'FAIL', detail: 'no auto-generated correlation_id' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _provided_correlation_id() {
    const id = 'TPC-06'; const desc = 'route() with provided correlation_id preserves it';
    try {
      let received = null;
      const sdk = { execute: async (at, args, opts) => { received = opts; return {}; } };
      const { ExecutionRouter } = require('../execution-router');
      const er = new ExecutionRouter({ sdkClient: sdk });
      await er.route('WORKFLOW', 'APPEND_AUDIT', {}, { correlation_id: 'explicit_cid' });
      if (!received || received.correlation_id !== 'explicit_cid')
        return { id, description: desc, status: 'FAIL', detail: `got: ${received?.correlation_id}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _lifecycle_history() {
    const id = 'TPC-07'; const desc = 'lifecycle transition recorded in history';
    try {
      const { LifecycleCoordinator } = require('../lifecycle-coordinator');
      const lc = new LifecycleCoordinator();
      lc.transition('INITIALIZING', 'test_reason');
      const h = lc.getHistory();
      if (!h.some(e => e.state === 'INITIALIZING'))
        return { id, description: desc, status: 'FAIL', detail: 'INITIALIZING not in history' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _decision_agent_id() {
    const id = 'TPC-08'; const desc = 'decision trace entry has agent_id';
    try {
      const { DecisionTrace } = require('../../ai-orchestration/decision-trace');
      const dt = new DecisionTrace();
      const did = dt.create({ agent_id: 'ag1', workflow_id: 'wf1', proposed_action: { action_type: 'APPEND_AUDIT', args: {} }, context: {}, lineage_ts: 1_700_000_000_000 });
      const entry = dt._entries?.find(e => e.decision_id === did);
      if (!entry || entry.agent_id !== 'ag1')
        return { id, description: desc, status: 'FAIL', detail: 'agent_id not in entry' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _decision_workflow_id() {
    const id = 'TPC-09'; const desc = 'decision trace entry has workflow_id';
    try {
      const { DecisionTrace } = require('../../ai-orchestration/decision-trace');
      const dt = new DecisionTrace();
      const did = dt.create({ agent_id: 'ag1', workflow_id: 'wf1', proposed_action: { action_type: 'APPEND_AUDIT', args: {} }, context: {}, lineage_ts: 1_700_000_000_000 });
      const entry = dt._entries?.find(e => e.decision_id === did);
      if (!entry || entry.workflow_id !== 'wf1')
        return { id, description: desc, status: 'FAIL', detail: 'workflow_id not in entry' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _decision_verify_empty() {
    const id = 'TPC-10'; const desc = 'verifyChain() on empty trace is valid';
    try {
      const { DecisionTrace } = require('../../ai-orchestration/decision-trace');
      const dt = new DecisionTrace();
      const v  = dt.verifyChain?.();
      if (!v || !v.valid) return { id, description: desc, status: 'FAIL', detail: `valid=${v?.valid}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { TracePropagationCertification };
