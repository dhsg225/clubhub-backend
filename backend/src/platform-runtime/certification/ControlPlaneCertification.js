'use strict';
/**
 * ControlPlaneCertification
 *
 * CPC-01: control-plane/api-contracts.js exists and exports validateRequest
 * CPC-02: CONTROL_PLANE_ACTIONS has at least 8 actions
 * CPC-03: auth-gateway.js exports AuthGateway
 * CPC-04: rate-limiter.js exports RateLimiter
 * CPC-05: control-plane-server.js has no direct kernel import
 * CPC-06: functional — validateRequest rejects missing action_type
 * CPC-07: functional — validateRequest rejects unknown action_type
 * CPC-08: functional — AuthGateway authenticate returns null for unknown token
 * CPC-09: functional — AuthGateway VIEWER cannot FREEZE
 * CPC-10: functional — AuthGateway ADMIN can FREEZE
 * CPC-11: functional — RateLimiter check returns ok:false when limit hit
 * CPC-12: functional — ControlPlaneServer rejects unauthenticated request
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../control-plane');

class ControlPlaneCertification {
  async run() {
    const checks = [
      this._exists('CPC-01', 'api-contracts.js',       'validateRequest',   'api-contracts.js exports validateRequest'),
      this._exists('CPC-02', 'api-contracts.js',       'APPROVE_AI_OPERATOR','CONTROL_PLANE_ACTIONS has required actions'),
      this._exists('CPC-03', 'auth-gateway.js',        'AuthGateway',       'auth-gateway.js exports AuthGateway'),
      this._exists('CPC-04', 'rate-limiter.js',        'RateLimiter',       'rate-limiter.js exports RateLimiter'),
      this._no_str('CPC-05', 'control-plane-server.js','governance-kernel/core','no direct kernel/core import'),
      this._validate_missing_action(),
      this._validate_unknown_action(),
      this._auth_unknown_token(),
      this._viewer_cannot_freeze(),
      this._admin_can_freeze(),
      this._rate_limit_exceeded(),
      await this._server_rejects_unauthenticated(),
    ];
    return this._result('ControlPlaneCertification', checks);
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

  _validate_missing_action() {
    const id = 'CPC-06'; const desc = 'validateRequest rejects missing action_type';
    try {
      const { validateRequest } = require('../../control-plane/api-contracts');
      let threw = false;
      try { validateRequest({ args: {} }); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _validate_unknown_action() {
    const id = 'CPC-07'; const desc = 'validateRequest rejects unknown action_type';
    try {
      const { validateRequest } = require('../../control-plane/api-contracts');
      let threw = false;
      try { validateRequest({ action_type: 'HACK_KERNEL', args: {} }); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw on unknown action' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _auth_unknown_token() {
    const id = 'CPC-08'; const desc = 'AuthGateway authenticate returns null for unknown token';
    try {
      const { AuthGateway } = require('../../control-plane/auth-gateway');
      const ag = new AuthGateway();
      if (ag.authenticate('bad_token') !== null)
        return { id, description: desc, status: 'FAIL', detail: 'should be null' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _viewer_cannot_freeze() {
    const id = 'CPC-09'; const desc = 'VIEWER role cannot FREEZE';
    try {
      const { AuthGateway } = require('../../control-plane/auth-gateway');
      const ag = new AuthGateway();
      ag.registerOperator('tok_v', 'viewer1', 'VIEWER', 'tenant1');
      const id2 = ag.authenticate('tok_v');
      if (ag.authorize(id2, 'FREEZE'))
        return { id, description: desc, status: 'FAIL', detail: 'VIEWER should not FREEZE' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _admin_can_freeze() {
    const id = 'CPC-10'; const desc = 'ADMIN role can FREEZE';
    try {
      const { AuthGateway } = require('../../control-plane/auth-gateway');
      const ag = new AuthGateway();
      ag.registerOperator('tok_a', 'admin1', 'ADMIN', 'tenant1');
      const id2 = ag.authenticate('tok_a');
      if (!ag.authorize(id2, 'FREEZE'))
        return { id, description: desc, status: 'FAIL', detail: 'ADMIN should FREEZE' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _rate_limit_exceeded() {
    const id = 'CPC-11'; const desc = 'RateLimiter returns ok:false when limit hit';
    try {
      const { RateLimiter } = require('../../control-plane/rate-limiter');
      const rl  = new RateLimiter({ per_minute: 2 });
      const now = 1_700_000_000_000;
      rl.record('t1', 'op1', now - 1000);
      rl.record('t1', 'op1', now - 2000);
      const r = rl.check('t1', 'op1', now);
      if (r.ok) return { id, description: desc, status: 'FAIL', detail: 'should be rate-limited' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _server_rejects_unauthenticated() {
    const id = 'CPC-12'; const desc = 'ControlPlaneServer rejects unauthenticated request';
    try {
      const { ControlPlaneServer } = require('../../control-plane/control-plane-server');
      const { ExecutionRouter }    = require('../../platform-runtime/execution-router');
      const er  = new ExecutionRouter({ sdkClient: { execute: async () => ({}) } });
      const srv = new ControlPlaneServer({ executionRouter: er });
      const r   = await srv.handle({ action_type: 'APPEND_AUDIT', args: {}, token: 'bad_token', tenant_id: 't1' });
      if (r.ok !== false) return { id, description: desc, status: 'FAIL', detail: 'should reject' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ControlPlaneCertification };
