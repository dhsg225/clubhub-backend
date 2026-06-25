'use strict';
/**
 * PolicyDeterminismCertification
 *
 * PDC-01: policy-engine.js exists and exports PolicyEngine
 * PDC-02: PolicyEngine has evaluate()
 * PDC-03: PolicyEngine has loadPolicies()
 * PDC-04: POLICY_RESULTS constants defined
 * PDC-05: policy-engine.js has no Date.now() (determinism)
 * PDC-06: policy-engine.js has no Math.random() (determinism)
 * PDC-07: functional — same context + policy → same result (H1)
 * PDC-08: functional — DENIED result on forbidden_actions
 * PDC-09: functional — FROZEN result when context.frozen = true
 * PDC-10: functional — REQUIRES_OPERATOR result for require_operator policy
 * PDC-11: functional — depth ceiling produces DENIED
 * PDC-12: functional — rate_limit breach produces DENIED
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class PolicyDeterminismCertification {
  async run() {
    const static_checks = [
      this._file_has('PDC-01', 'policy-engine.js', 'PolicyEngine',  'policy-engine.js exports PolicyEngine'),
      this._file_has('PDC-02', 'policy-engine.js', 'evaluate',      'PolicyEngine has evaluate()'),
      this._file_has('PDC-03', 'policy-engine.js', 'loadPolicies',  'PolicyEngine has loadPolicies()'),
      this._file_has('PDC-04', 'policy-engine.js', 'POLICY_RESULTS','POLICY_RESULTS constants defined'),
      this._file_no('PDC-05',  'policy-engine.js', 'Date.now()',    'policy-engine.js has no Date.now()'),
      this._file_no('PDC-06',  'policy-engine.js', 'Math.random()', 'policy-engine.js has no Math.random()'),
    ];

    const functional_checks = [
      this._determinism_check(),
      this._forbidden_action_denied(),
      this._frozen_blocks(),
      this._require_operator(),
      this._depth_ceiling_denied(),
      this._rate_limit_denied(),
    ];

    return this._result('PolicyDeterminismCertification', [...static_checks, ...functional_checks]);
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

  // ——— Functional ———————————————————————————————————————————————

  _makeEngine() {
    const { PolicyEngine } = require('../policy-engine');
    return new PolicyEngine();
  }

  _baseContext(overrides = {}) {
    return {
      frozen:         false,
      epoch:          1,
      incident_count: 0,
      agent_id:       'test_agent',
      workflow_id:    'wf_cert',
      action_type:    'APPEND_AUDIT',
      depth:          0,
      lineage_ts:     1_700_000_000_000,
      rate_state:     { calls_last_minute: 0, calls_last_hour: 0 },
      ...overrides,
    };
  }

  _baseAction(overrides = {}) {
    return { action_type: 'APPEND_AUDIT', args: {}, ...overrides };
  }

  _determinism_check() {
    const id = 'PDC-07'; const desc = 'same context + policy → same result (H1)';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{
        id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [],
      }]);
      const ctx    = this._baseContext();
      const action = this._baseAction();
      const r1 = pe.evaluate(ctx, action);
      const r2 = pe.evaluate(ctx, action);
      const r3 = pe.evaluate(ctx, action);
      if (r1.result !== r2.result || r2.result !== r3.result)
        return { id, description: desc, status: 'FAIL', detail: 'non-deterministic results' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _forbidden_action_denied() {
    const id = 'PDC-08'; const desc = 'forbidden_action yields DENIED';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{
        id: 'forbid_freeze', name: 'forbid_freeze', priority: 100, action: 'deny',
        conditions: [], forbidden_actions: ['FREEZE'],
      }]);
      const result = pe.evaluate(this._baseContext(), this._baseAction({ action_type: 'FREEZE' }));
      if (result.result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `got ${result.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _frozen_blocks() {
    const id = 'PDC-09'; const desc = 'frozen context yields FROZEN (H5)';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{ id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [] }]);
      const result = pe.evaluate(this._baseContext({ frozen: true }), this._baseAction());
      if (result.result !== 'FROZEN')
        return { id, description: desc, status: 'FAIL', detail: `got ${result.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _require_operator() {
    const id = 'PDC-10'; const desc = 'require_operator policy yields REQUIRES_OPERATOR';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{
        id: 'op_required', name: 'op_required', priority: 100, action: 'require_operator',
        conditions: [], permitted_actions: null, forbidden_actions: null,
      }]);
      const result = pe.evaluate(this._baseContext(), this._baseAction());
      if (result.result !== 'REQUIRES_OPERATOR')
        return { id, description: desc, status: 'FAIL', detail: `got ${result.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _depth_ceiling_denied() {
    const id = 'PDC-11'; const desc = 'depth > max_depth yields DENIED (H4)';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{ id: 'depth_ceil', name: 'depth_ceil', priority: 100, action: 'deny',
        conditions: [], max_depth: 3 }]);
      const result = pe.evaluate(this._baseContext(), this._baseAction({ action_type: 'APPEND_AUDIT', depth: 5 }));
      // Depth check happens in PolicyEngine.evaluate via proposedAction.depth
      // The policy engine checks proposedAction.depth OR context.depth
      const ctx_result = pe.evaluate(this._baseContext({ depth: 5 }), this._baseAction());
      if (ctx_result.result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `depth in context not caught: got ${ctx_result.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _rate_limit_denied() {
    const id = 'PDC-12'; const desc = 'rate_limit breach yields DENIED (H6)';
    try {
      const pe = this._makeEngine();
      pe.loadPolicies([{
        id: 'rate_ceil', name: 'rate_ceil', priority: 100, action: 'rate_limit',
        conditions: [], rate_limit: { max_per_minute: 5, max_per_hour: 100 },
      }]);
      const ctx = this._baseContext({ rate_state: { calls_last_minute: 6, calls_last_hour: 10 } });
      const result = pe.evaluate(ctx, this._baseAction());
      if (result.result !== 'DENIED')
        return { id, description: desc, status: 'FAIL', detail: `got ${result.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { PolicyDeterminismCertification };
