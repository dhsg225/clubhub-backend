'use strict';
/**
 * GovernedAgentCertification
 *
 * GAC-01: governed-agent.js exists and exports GovernedAgent
 * GAC-02: GovernedAgent constructor requires sdkClient
 * GAC-03: GovernedAgent has propose() method
 * GAC-04: GovernedAgent has replayProposal() method
 * GAC-05: governed-agent.js has no direct kernel imports (only SDK)
 * GAC-06: governed-agent.js references sdkClient.execute (H7)
 * GAC-07: functional — DENIED action never calls sdkClient.execute
 * GAC-08: functional — FROZEN context stops proposal immediately
 * GAC-09: functional — approved action calls sdkClient.execute
 * GAC-10: functional — proposal is traced before execution (H2)
 * GAC-11: functional — snapshot() reflects correct counters
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class GovernedAgentCertification {
  async run() {
    const static_checks = [
      this._file_has('GAC-01', 'governed-agent.js', 'GovernedAgent',         'governed-agent.js exports GovernedAgent'),
      this._file_has('GAC-02', 'governed-agent.js', 'requires sdkClient',    'GovernedAgent validates sdkClient'),
      this._file_has('GAC-03', 'governed-agent.js', 'propose',               'GovernedAgent has propose()'),
      this._file_has('GAC-04', 'governed-agent.js', 'replayProposal',        'GovernedAgent has replayProposal()'),
      this._file_no ('GAC-05', 'governed-agent.js', 'governance-kernel/core','no direct kernel/core imports (H7)'),
      this._file_has('GAC-06', 'governed-agent.js', 'sdkClient.execute',     'mutations route through sdkClient.execute (H7)'),
    ];

    const functional_checks = [
      await this._denied_never_executes(),
      await this._frozen_stops_proposal(),
      await this._approved_calls_sdk(),
      await this._traced_before_execution(),
      await this._snapshot_counters(),
    ];

    return this._result('GovernedAgentCertification', [...static_checks, ...functional_checks]);
  }

  // ——— Static ———————————————————————————————————————————————————

  _file_has(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _file_no(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    const src = fs.readFileSync(fp, 'utf8').split('\n')
      .filter(l => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*'); })
      .join('\n');
    if (src.includes(marker)) return { id, description, status: 'FAIL', detail: `found forbidden '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  // ——— Helpers ——————————————————————————————————————————————————

  _makeAgent(sdkExecuteFn, policyOverride = null) {
    const { GovernedAgent }   = require('../governed-agent');
    const { PolicyEngine }    = require('../policy-engine');
    const { DecisionTrace }   = require('../decision-trace');
    const { BoundedExecutor } = require('../bounded-executor');

    const pe = new PolicyEngine();
    pe.loadPolicies(policyOverride ?? [{
      id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [],
    }]);

    const sdkClient = { execute: sdkExecuteFn ?? (async () => ({ result: 'ok' })) };
    const clock     = { now: () => 1_700_000_000_000 };

    return new GovernedAgent({
      agentId:         'cert_agent',
      policyEngine:    pe,
      decisionTrace:   new DecisionTrace(),
      boundedExecutor: new BoundedExecutor(),
      sdkClient,
      clock,
    });
  }

  _makeContext() {
    return { frozen: false, epoch: 1, incident_count: 0, rate_state: { calls_last_minute: 0, calls_last_hour: 0 } };
  }

  // ——— Functional ———————————————————————————————————————————————

  async _denied_never_executes() {
    const id = 'GAC-07'; const desc = 'DENIED action never calls sdkClient.execute (H8)';
    try {
      let executed = false;
      const agent = this._makeAgent(async () => { executed = true; return {}; }, [{
        id: 'deny_all', name: 'deny_all', priority: 100, action: 'deny',
        conditions: [], forbidden_actions: null, permitted_actions: null,
      }]);
      const result = await agent.propose('APPEND_AUDIT', {}, { context_overrides: this._makeContext() });
      if (executed)         return { id, description: desc, status: 'FAIL', detail: 'sdkClient was called after DENIED' };
      if (result.policy_result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `result was ${result.policy_result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _frozen_stops_proposal() {
    const id = 'GAC-08'; const desc = 'frozen context stops proposal immediately (H5)';
    try {
      let executed = false;
      const agent = this._makeAgent(async () => { executed = true; return {}; });
      const result = await agent.propose('APPEND_AUDIT', {}, {
        context_overrides: { ...this._makeContext(), frozen: true },
      });
      if (executed) return { id, description: desc, status: 'FAIL', detail: 'sdkClient called while frozen' };
      if (result.policy_result !== 'FROZEN')
        return { id, description: desc, status: 'FAIL', detail: `result was ${result.policy_result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _approved_calls_sdk() {
    const id = 'GAC-09'; const desc = 'APPROVED action calls sdkClient.execute';
    try {
      let executed = false;
      const agent  = this._makeAgent(async () => { executed = true; return { result: 'ok' }; });
      const result = await agent.propose('APPEND_AUDIT', {}, { context_overrides: this._makeContext() });
      if (!executed)        return { id, description: desc, status: 'FAIL', detail: 'sdkClient not called after APPROVED' };
      if (result.policy_result !== 'APPROVED')
        return { id, description: desc, status: 'FAIL', detail: `result was ${result.policy_result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _traced_before_execution() {
    const id = 'GAC-10'; const desc = 'proposal traced before sdkClient.execute (H2)';
    try {
      const { DecisionTrace }   = require('../decision-trace');
      const { GovernedAgent }   = require('../governed-agent');
      const { PolicyEngine }    = require('../policy-engine');
      const { BoundedExecutor } = require('../bounded-executor');

      const dt = new DecisionTrace();
      let trace_count_at_execution = 0;

      const pe = new PolicyEngine();
      pe.loadPolicies([{ id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [] }]);

      const agent = new GovernedAgent({
        agentId: 'trace_cert',
        policyEngine:    pe,
        decisionTrace:   dt,
        boundedExecutor: new BoundedExecutor(),
        sdkClient:       { execute: async () => { trace_count_at_execution = dt.getCount(); return {}; } },
        clock:           { now: () => 1_700_000_000_000 },
      });

      await agent.propose('APPEND_AUDIT', {}, { context_overrides: { frozen: false, rate_state: { calls_last_minute: 0, calls_last_hour: 0 } } });

      if (trace_count_at_execution < 1)
        return { id, description: desc, status: 'FAIL', detail: 'trace not created before execution' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _snapshot_counters() {
    const id = 'GAC-11'; const desc = 'snapshot() reflects correct counters';
    try {
      const agent = this._makeAgent(async () => ({ result: 'ok' }));
      // 1 approve, 1 deny
      await agent.propose('APPEND_AUDIT', {}, { context_overrides: this._makeContext() });
      await agent.propose('APPEND_AUDIT', {}, { context_overrides: { ...this._makeContext(), frozen: true } });
      const snap = agent.snapshot();
      if (snap.proposal_count !== 2) return { id, description: desc, status: 'FAIL', detail: `proposals: ${snap.proposal_count}` };
      if (snap.approved_count !== 1) return { id, description: desc, status: 'FAIL', detail: `approved: ${snap.approved_count}` };
      if (snap.frozen_count   !== 1) return { id, description: desc, status: 'FAIL', detail: `frozen: ${snap.frozen_count}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { GovernedAgentCertification };
