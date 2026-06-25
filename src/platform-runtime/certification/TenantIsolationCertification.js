'use strict';
/**
 * TenantIsolationCertification
 *
 * TIC-01: tenant-registry.js exists and exports TenantRegistry
 * TIC-02: tenant-context.js exists and exports TenantContext
 * TIC-03: tenant-health.js exists and exports TenantHealth
 * TIC-04: tenant-policy-scope.js exists and exports TenantPolicyScope
 * TIC-05: functional — TenantRegistry throws on duplicate registration
 * TIC-06: functional — TenantContext freeze does not affect other tenants
 * TIC-07: functional — TenantHealth overallStatus returns UNKNOWN when no checks
 * TIC-08: functional — TenantPolicyScope filters by tenant_id
 * TIC-09: functional — TenantQuotaPolicy enforces per-tenant quotas
 * TIC-10: functional — replay sessions are tenant-scoped in TenantContext
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../control-plane');

class TenantIsolationCertification {
  async run() {
    const checks = [
      this._exists('TIC-01', 'tenant-registry.js',     'TenantRegistry',    'tenant-registry.js exists'),
      this._exists('TIC-02', 'tenant-context.js',      'TenantContext',      'tenant-context.js exists'),
      this._exists('TIC-03', 'tenant-health.js',       'TenantHealth',       'tenant-health.js exists'),
      this._exists('TIC-04', 'tenant-policy-scope.js', 'TenantPolicyScope',  'tenant-policy-scope.js exists'),
      this._registry_duplicate(),
      this._context_freeze_isolated(),
      this._health_unknown_initially(),
      this._policy_scope_filters(),
      this._quota_enforcement(),
      this._replay_tenant_scope(),
    ];
    return this._result('TenantIsolationCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _registry_duplicate() {
    const id = 'TIC-05'; const desc = 'TenantRegistry throws on duplicate';
    try {
      const { TenantRegistry } = require('../../control-plane/tenant-registry');
      const reg = new TenantRegistry();
      reg.register('t1', {});
      let threw = false;
      try { reg.register('t1', {}); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _context_freeze_isolated() {
    const id = 'TIC-06'; const desc = 'freeze on TenantContext A does not affect B';
    try {
      const { TenantContext } = require('../../control-plane/tenant-context');
      const ctxA = new TenantContext('tenantA');
      const ctxB = new TenantContext('tenantB');
      ctxA.freeze();
      if (!ctxA.isFrozen() || ctxB.isFrozen())
        return { id, description: desc, status: 'FAIL', detail: `A=${ctxA.isFrozen()} B=${ctxB.isFrozen()}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _health_unknown_initially() {
    const id = 'TIC-07'; const desc = 'TenantHealth overallStatus UNKNOWN when no checks';
    try {
      const { TenantHealth } = require('../../control-plane/tenant-health');
      const h = new TenantHealth('t1');
      if (h.overallStatus() !== 'UNKNOWN')
        return { id, description: desc, status: 'FAIL', detail: `got ${h.overallStatus()}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _policy_scope_filters() {
    const id = 'TIC-08'; const desc = 'TenantPolicyScope filters to tenant policies';
    try {
      const { TenantPolicyScope } = require('../../control-plane/tenant-policy-scope');
      // Mock policy engine with mixed-tenant policies
      const mockEngine = {
        getPolicies: () => [
          { id: 'p1', tenant_id: 'tA', action: 'allow', conditions: [] },
          { id: 'p2', tenant_id: 'tB', action: 'deny',  conditions: [] },
          { id: 'p3',                  action: 'allow', conditions: [] },  // global
        ],
        addPolicy: () => {},
        evaluate:  () => ({ result: 'APPROVED' }),
      };
      const scope = new TenantPolicyScope('tA', mockEngine);
      const policies = scope.getPolicies();
      // Should include p1 (tA) and p3 (global), not p2 (tB)
      if (policies.some(p => p.id === 'p2'))
        return { id, description: desc, status: 'FAIL', detail: 'cross-tenant policy leaked' };
      if (!policies.some(p => p.id === 'p1'))
        return { id, description: desc, status: 'FAIL', detail: 'tenant policy missing' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _quota_enforcement() {
    const id = 'TIC-09'; const desc = 'TenantQuotaPolicy enforces per-tenant quotas';
    try {
      const { TenantQuotaPolicy } = require('../../operational-policy/tenant-quota-policy');
      const qp = new TenantQuotaPolicy('tA', { max_workflows_per_hour: 2 });
      qp.recordWorkflow();
      qp.recordWorkflow();
      const r = qp.checkWorkflow();
      if (r.ok) return { id, description: desc, status: 'FAIL', detail: 'quota should be exceeded' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _replay_tenant_scope() {
    const id = 'TIC-10'; const desc = 'TenantContext replay sessions are tenant-scoped';
    try {
      const { TenantContext } = require('../../control-plane/tenant-context');
      const ctxA = new TenantContext('tA');
      const ctxB = new TenantContext('tB');
      ctxA.startReplay('WORKFLOW', { workflow_id: 'wf1' });
      const snapA = ctxA.snapshot();
      const snapB = ctxB.snapshot();
      if (snapA.active_replays !== 1 || snapB.active_replays !== 0)
        return { id, description: desc, status: 'FAIL', detail: `A=${snapA.active_replays} B=${snapB.active_replays}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { TenantIsolationCertification };
