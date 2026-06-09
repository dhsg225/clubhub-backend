'use strict';
/**
 * PolicyConflictCertification
 *
 * PCC-01: policy-engine.js has priority sort (higher priority wins)
 * PCC-02: functional — higher priority DENY overrides lower priority ALLOW
 * PCC-03: functional — higher priority ALLOW overrides lower priority DENY
 * PCC-04: functional — condition matching is exclusive (non-matching policy skipped)
 * PCC-05: functional — two policies with same priority resolve by insertion order
 * PCC-06: functional — permitted_actions + forbidden_actions are orthogonal checks
 * PCC-07: functional — require_quorum treated as REQUIRES_OPERATOR
 * PCC-08: functional — addPolicy() maintains sort order
 * PCC-09: functional — removePolicy() removes by id
 * PCC-10: functional — empty policy set defaults to APPROVED
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class PolicyConflictCertification {
  async run() {
    const static_checks = [
      this._file_has('PCC-01', 'policy-engine.js', 'priority', 'policy-engine.js has priority sorting'),
    ];

    const functional_checks = [
      this._deny_overrides_allow(),
      this._allow_overrides_deny(),
      this._condition_skip(),
      this._same_priority_order(),
      this._permitted_forbidden_orthogonal(),
      this._require_quorum_operator(),
      this._add_policy_sorted(),
      this._remove_policy(),
      this._empty_policy_approved(),
    ];

    return this._result('PolicyConflictCertification', [...static_checks, ...functional_checks]);
  }

  _file_has(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _pe(policies) {
    const { PolicyEngine } = require('../policy-engine');
    const pe = new PolicyEngine();
    pe.loadPolicies(policies);
    return pe;
  }

  _ctx() {
    return {
      frozen: false, epoch: 1, incident_count: 0, agent_id: 'a', workflow_id: 'w',
      action_type: 'APPEND_AUDIT', depth: 0, lineage_ts: 1_700_000_000_000,
      rate_state: { calls_last_minute: 0, calls_last_hour: 0 },
    };
  }

  _deny_overrides_allow() {
    const id = 'PCC-02'; const desc = 'higher priority DENY overrides lower priority ALLOW';
    try {
      const pe = this._pe([
        { id: 'low_allow',  name: 'low_allow',  priority: 10,  action: 'allow', conditions: [] },
        { id: 'high_deny',  name: 'high_deny',  priority: 100, action: 'deny',  conditions: [] },
      ]);
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      if (r.result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _allow_overrides_deny() {
    const id = 'PCC-03'; const desc = 'higher priority ALLOW overrides lower priority DENY';
    try {
      const pe = this._pe([
        { id: 'low_deny',  name: 'low_deny',  priority: 10,  action: 'deny',  conditions: [] },
        { id: 'high_allow', name: 'high_allow', priority: 100, action: 'allow', conditions: [] },
      ]);
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      if (r.result !== 'APPROVED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _condition_skip() {
    const id = 'PCC-04'; const desc = 'non-matching condition causes policy to be skipped';
    try {
      const pe = this._pe([
        {
          id: 'deny_if_frozen', name: 'deny_if_frozen', priority: 100, action: 'deny',
          conditions: [{ field: 'frozen', op: 'truthy' }],
        },
        { id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [] },
      ]);
      // Context not frozen — deny_if_frozen should be skipped
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      if (r.result !== 'APPROVED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _same_priority_order() {
    const id = 'PCC-05'; const desc = 'same priority resolves by insertion order';
    try {
      const pe = this._pe([
        { id: 'first_deny',  name: 'first_deny',  priority: 50, action: 'deny',  conditions: [] },
        { id: 'second_allow', name: 'second_allow', priority: 50, action: 'allow', conditions: [] },
      ]);
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      // First loaded with same priority wins — depends on stable sort; first should win
      if (r.result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _permitted_forbidden_orthogonal() {
    const id = 'PCC-06'; const desc = 'permitted_actions and forbidden_actions are orthogonal checks';
    try {
      const pe = this._pe([{
        id: 'p1', name: 'p1', priority: 100, action: 'allow', conditions: [],
        permitted_actions: ['APPEND_AUDIT', 'READ_CONFIG'],
        forbidden_actions: ['FREEZE'],
      }]);
      // Permitted action → APPROVED
      const r1 = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      // Forbidden action → DENIED
      const r2 = pe.evaluate(this._ctx(), { action_type: 'FREEZE', args: {} });
      // Action not in permitted → DENIED
      const r3 = pe.evaluate(this._ctx(), { action_type: 'PROMOTE_WAVE', args: {} });
      if (r1.result !== 'APPROVED') return { id, description: desc, status: 'FAIL', detail: `permitted: ${r1.result}` };
      if (r2.result !== 'DENIED')   return { id, description: desc, status: 'FAIL', detail: `forbidden: ${r2.result}` };
      if (r3.result !== 'DENIED')   return { id, description: desc, status: 'FAIL', detail: `not_permitted: ${r3.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _require_quorum_operator() {
    const id = 'PCC-07'; const desc = 'require_quorum yields REQUIRES_OPERATOR';
    try {
      const pe = this._pe([{
        id: 'quorum', name: 'quorum', priority: 100, action: 'require_quorum', conditions: [],
      }]);
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      if (r.result !== 'REQUIRES_OPERATOR')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _add_policy_sorted() {
    const id = 'PCC-08'; const desc = 'addPolicy() maintains priority sort order';
    try {
      const { PolicyEngine } = require('../policy-engine');
      const pe = new PolicyEngine();
      pe.addPolicy({ id: 'p10',  name: 'p10',  priority: 10,  action: 'deny',  conditions: [] });
      pe.addPolicy({ id: 'p100', name: 'p100', priority: 100, action: 'allow', conditions: [] });
      pe.addPolicy({ id: 'p50',  name: 'p50',  priority: 50,  action: 'deny',  conditions: [] });
      const policies = pe.getPolicies();
      if (policies[0].priority < policies[1].priority || policies[1].priority < policies[2].priority)
        return { id, description: desc, status: 'FAIL', detail: `not sorted: ${policies.map(p => p.priority).join(',')}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _remove_policy() {
    const id = 'PCC-09'; const desc = 'removePolicy() removes by id';
    try {
      const { PolicyEngine } = require('../policy-engine');
      const pe = new PolicyEngine();
      pe.loadPolicies([
        { id: 'A', name: 'A', priority: 1, action: 'allow', conditions: [] },
        { id: 'B', name: 'B', priority: 2, action: 'deny',  conditions: [] },
      ]);
      const removed = pe.removePolicy('B');
      if (!removed || pe.getPolicies().length !== 1)
        return { id, description: desc, status: 'FAIL', detail: 'removePolicy failed' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _empty_policy_approved() {
    const id = 'PCC-10'; const desc = 'empty policy set defaults to APPROVED';
    try {
      const { PolicyEngine } = require('../policy-engine');
      const pe = new PolicyEngine();
      const r = pe.evaluate(this._ctx(), { action_type: 'APPEND_AUDIT', args: {} });
      if (r.result !== 'APPROVED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { PolicyConflictCertification };
