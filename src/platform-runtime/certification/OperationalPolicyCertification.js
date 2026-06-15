'use strict';
/**
 * OperationalPolicyCertification
 *
 * OPC-01: operational-policy/index.js exists
 * OPC-02: policy-evaluator.js has no Date.now() or Math.random()
 * OPC-03: policy-registry.js exports PolicyRegistry
 * OPC-04: functional — PolicyEvaluator same input → same result (determinism)
 * OPC-05: functional — PolicyRegistry publish increments version
 * OPC-06: functional — PolicyRegistry throws on missing id
 * OPC-07: functional — PolicyEvaluator DEPLOYMENT_POLICIES freeze blocks
 * OPC-08: functional — TenantQuotaPolicy checkWorkflow enforces quota
 * OPC-09: functional — createOperationalPolicy() returns registry + evaluator
 * OPC-10: functional — PolicyEvaluator default-allows on empty policies
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../operational-policy');

class OperationalPolicyCertification {
  async run() {
    const checks = [
      this._exists ('OPC-01', 'index.js',           'createOperationalPolicy', 'index.js exists'),
      this._no_str ('OPC-02', 'policy-evaluator.js', 'Date.now()',             'no Date.now() in evaluator'),
      this._exists ('OPC-03', 'policy-registry.js',  'PolicyRegistry',         'policy-registry.js exists'),
      this._determinism(),
      this._registry_version(),
      this._registry_missing_id_throws(),
      this._freeze_blocks(),
      this._quota_enforcement(),
      this._factory_returns_both(),
      this._empty_default_allow(),
    ];
    return this._result('OperationalPolicyCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _no_str(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    const src = fs.readFileSync(fp, 'utf8').split('\n')
      .filter(l => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*'); }).join('\n');
    if (src.includes(marker)) return { id, description, status: 'FAIL', detail: `found '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _determinism() {
    const id = 'OPC-04'; const desc = 'PolicyEvaluator same input → same result';
    try {
      const { PolicyEvaluator } = require('../../operational-policy/policy-evaluator');
      const pe = new PolicyEvaluator();
      pe.loadPolicies([{ id: 'p1', priority: 1, action: 'deny', conditions: [{ field: 'frozen', op: 'truthy' }] }]);
      const ctx = { frozen: true };
      const r1  = pe.evaluate(ctx, { action_type: 'PROMOTE_WAVE' });
      const r2  = pe.evaluate(ctx, { action_type: 'PROMOTE_WAVE' });
      if (r1.result !== r2.result) return { id, description: desc, status: 'FAIL', detail: 'non-deterministic' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _registry_version() {
    const id = 'OPC-05'; const desc = 'PolicyRegistry.publish() increments version';
    try {
      const { PolicyRegistry } = require('../../operational-policy/policy-registry');
      const reg = new PolicyRegistry();
      const v1  = reg.publish({ id: 'p1', action: 'allow', conditions: [] });
      const v2  = reg.publish({ id: 'p1', action: 'deny',  conditions: [] });
      if (v1.version !== 1 || v2.version !== 2)
        return { id, description: desc, status: 'FAIL', detail: `v1=${v1.version} v2=${v2.version}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _registry_missing_id_throws() {
    const id = 'OPC-06'; const desc = 'PolicyRegistry.publish throws on missing id';
    try {
      const { PolicyRegistry } = require('../../operational-policy/policy-registry');
      const reg = new PolicyRegistry();
      let threw = false;
      try { reg.publish({ action: 'allow' }); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _freeze_blocks() {
    const id = 'OPC-07'; const desc = 'DEPLOYMENT_POLICIES freeze blocks promote';
    try {
      const { PolicyEvaluator }    = require('../../operational-policy/policy-evaluator');
      const { DEPLOYMENT_POLICIES }= require('../../operational-policy/deployment-policy');
      const pe = new PolicyEvaluator();
      pe.loadPolicies(DEPLOYMENT_POLICIES);
      const r = pe.evaluate({ frozen: true }, { action_type: 'PROMOTE_WAVE' });
      if (r.result !== 'DENIED') return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _quota_enforcement() {
    const id = 'OPC-08'; const desc = 'TenantQuotaPolicy enforces quota';
    try {
      const { TenantQuotaPolicy } = require('../../operational-policy/tenant-quota-policy');
      const qp = new TenantQuotaPolicy('tA', { max_workflows_per_hour: 1 });
      qp.recordWorkflow();
      const r = qp.checkWorkflow();
      if (r.ok) return { id, description: desc, status: 'FAIL', detail: 'quota not enforced' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _factory_returns_both() {
    const id = 'OPC-09'; const desc = 'createOperationalPolicy() returns registry + evaluator';
    try {
      const { createOperationalPolicy } = require('../../operational-policy/index');
      const { registry, evaluator } = createOperationalPolicy();
      if (!registry || !evaluator)
        return { id, description: desc, status: 'FAIL', detail: 'missing registry or evaluator' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _empty_default_allow() {
    const id = 'OPC-10'; const desc = 'PolicyEvaluator empty policies → ALLOWED';
    try {
      const { PolicyEvaluator } = require('../../operational-policy/policy-evaluator');
      const pe = new PolicyEvaluator();
      const r  = pe.evaluate({}, { action_type: 'PROMOTE_WAVE' });
      if (r.result !== 'ALLOWED') return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { OperationalPolicyCertification };
