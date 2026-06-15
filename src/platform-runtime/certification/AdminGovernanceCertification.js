'use strict';
/**
 * AdminGovernanceCertification
 *
 * AGC-01: platform-admin/admin-runtime.js exists
 * AGC-02: platform-admin/admin-audit.js exports AdminAudit
 * AGC-03: platform-admin/admin-actions.js exports ADMIN_ACTIONS
 * AGC-04: admin-actions.js has no direct kernel import
 * AGC-05: functional — AdminAudit records are frozen (immutable)
 * AGC-06: functional — AdminAudit getByAction filters correctly
 * AGC-07: functional — AdminAudit getByOperator filters correctly
 * AGC-08: functional — AdminActions.runConvergenceScan returns ok:false without engine
 * AGC-09: functional — AdminDiagnostics.runDiagnostics returns generated_at
 * AGC-10: functional — AdminRecovery.verifyTraceChain returns ok:false without dt
 * AGC-11: functional — AdminCertification.runPhase returns ok:false for unknown phase
 * AGC-12: functional — AdminRuntime snapshot has audit_entries count
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../platform-admin');

class AdminGovernanceCertification {
  async run() {
    const checks = [
      this._exists('AGC-01', 'admin-runtime.js',  'AdminRuntime',   'admin-runtime.js exists'),
      this._exists('AGC-02', 'admin-audit.js',    'AdminAudit',     'admin-audit.js exports AdminAudit'),
      this._exists('AGC-03', 'admin-actions.js',  'ADMIN_ACTIONS',  'admin-actions.js exports ADMIN_ACTIONS'),
      this._no_str('AGC-04', 'admin-actions.js',  'governance-kernel/core', 'no direct kernel/core import'),
      this._audit_frozen(),
      this._audit_by_action(),
      this._audit_by_operator(),
      this._convergence_no_engine(),
      this._diagnostics_has_ts(),
      this._recovery_no_dt(),
      await this._cert_unknown_phase(),
      this._runtime_snapshot(),
    ];
    return this._result('AdminGovernanceCertification', checks);
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
    if (fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `found forbidden '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _audit_frozen() {
    const id = 'AGC-05'; const desc = 'AdminAudit entries are frozen (immutable)';
    try {
      const { AdminAudit } = require('../../platform-admin/admin-audit');
      const audit = new AdminAudit();
      const entry = audit.record('TEST_ACTION', 'op1', { foo: 'bar' });
      let threw = false;
      try { entry.action = 'MUTATED'; } catch (_) { threw = true; }
      // In strict mode, assigning to frozen object throws. Check the stored entry.
      const stored = audit.getEntries()[0];
      if (stored.action === 'MUTATED') return { id, description: desc, status: 'FAIL', detail: 'entry was mutated' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _audit_by_action() {
    const id = 'AGC-06'; const desc = 'AdminAudit.getByAction filters correctly';
    try {
      const { AdminAudit } = require('../../platform-admin/admin-audit');
      const audit = new AdminAudit();
      audit.record('FREEZE', 'op1', {});
      audit.record('UNFREEZE', 'op2', {});
      const freezes = audit.getByAction('FREEZE');
      if (freezes.length !== 1) return { id, description: desc, status: 'FAIL', detail: `got ${freezes.length}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _audit_by_operator() {
    const id = 'AGC-07'; const desc = 'AdminAudit.getByOperator filters correctly';
    try {
      const { AdminAudit } = require('../../platform-admin/admin-audit');
      const audit = new AdminAudit();
      audit.record('FREEZE', 'op1', {});
      audit.record('FREEZE', 'op2', {});
      const op1 = audit.getByOperator('op1');
      if (op1.length !== 1) return { id, description: desc, status: 'FAIL', detail: `got ${op1.length}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _convergence_no_engine() {
    const id = 'AGC-08'; const desc = 'AdminActions.runConvergenceScan returns ok:false without engine';
    try {
      const { AdminAudit }   = require('../../platform-admin/admin-audit');
      const { AdminActions } = require('../../platform-admin/admin-actions');
      const { ExecutionRouter } = require('../../platform-runtime/execution-router');
      const er     = new ExecutionRouter({ sdkClient: { execute: async () => ({}) } });
      const actions = new AdminActions({ executionRouter: er, adminAudit: new AdminAudit() });
      const r = actions.runConvergenceScan('op1');
      if (r.ok !== false) return { id, description: desc, status: 'FAIL', detail: 'should be ok:false' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _diagnostics_has_ts() {
    const id = 'AGC-09'; const desc = 'AdminDiagnostics.runDiagnostics returns generated_at';
    try {
      const { AdminDiagnostics } = require('../../platform-admin/admin-diagnostics');
      const diag = new AdminDiagnostics({});
      const r    = diag.runDiagnostics();
      if (!r.generated_at) return { id, description: desc, status: 'FAIL', detail: 'missing generated_at' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _recovery_no_dt() {
    const id = 'AGC-10'; const desc = 'AdminRecovery.verifyTraceChain returns ok:false without dt';
    try {
      const { AdminAudit }    = require('../../platform-admin/admin-audit');
      const { AdminRecovery } = require('../../platform-admin/admin-recovery');
      const rec = new AdminRecovery({ adminAudit: new AdminAudit() });
      const r   = rec.verifyTraceChain('op1');
      if (r.ok !== false) return { id, description: desc, status: 'FAIL', detail: 'should be ok:false' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _cert_unknown_phase() {
    const id = 'AGC-11'; const desc = 'AdminCertification.runPhase ok:false for unknown phase';
    try {
      const { AdminAudit }         = require('../../platform-admin/admin-audit');
      const { AdminCertification } = require('../../platform-admin/admin-certification');
      const cert = new AdminCertification({ adminAudit: new AdminAudit() });
      const r    = await cert.runPhase('op1', 'zz_unknown');
      if (r.ok !== false) return { id, description: desc, status: 'FAIL', detail: 'should be ok:false' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _runtime_snapshot() {
    const id = 'AGC-12'; const desc = 'AdminRuntime snapshot has audit_entries count';
    try {
      const { AdminRuntime } = require('../../platform-admin/admin-runtime');
      const rt   = new AdminRuntime({ executionRouter: { route: async () => ({}) } });
      const snap = rt.snapshot();
      if (typeof snap.audit_entries !== 'number')
        return { id, description: desc, status: 'FAIL', detail: 'missing audit_entries' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { AdminGovernanceCertification };
