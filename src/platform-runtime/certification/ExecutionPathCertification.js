'use strict';
/**
 * ExecutionPathCertification
 *
 * EPC-01: execution-router.js exists
 * EPC-02: ExecutionRouter has route()
 * EPC-03: execution-router.js has no direct kernel imports
 * EPC-04: functional — route() calls sdkClient.execute()
 * EPC-05: functional — blocked router returns blocked:true
 * EPC-06: functional — unblock() re-enables routing
 * EPC-07: functional — unknown source throws
 * EPC-08: functional — emits platform.execution.routed event
 * EPC-09: functional — correlation_id propagated to sdkClient
 * EPC-10: functional — snapshot() has blocked field
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class ExecutionPathCertification {
  async run() {
    const checks = [
      this._exists ('EPC-01', 'execution-router.js', 'ExecutionRouter',               'execution-router.js exists'),
      this._exists ('EPC-02', 'execution-router.js', 'route',                         'has route()'),
      this._no_str ('EPC-03', 'execution-router.js', 'governance-kernel/core',        'no direct kernel/core import'),
      await this._route_calls_sdk(),
      await this._blocked_returns_blocked(),
      await this._unblock_reenables(),
      await this._unknown_source_throws(),
      await this._emits_event(),
      await this._correlation_id_propagated(),
      this._snapshot_has_blocked(),
    ];
    return this._result('ExecutionPathCertification', checks);
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

  _er(extra = {}) {
    const { ExecutionRouter } = require('../execution-router');
    return new ExecutionRouter(extra);
  }

  async _route_calls_sdk() {
    const id = 'EPC-04'; const desc = 'route() calls sdkClient.execute()';
    try {
      let called = false;
      const sdk = { execute: async (at, args) => { called = true; return {}; } };
      const er  = this._er({ sdkClient: sdk });
      await er.route('WORKFLOW', 'APPEND_AUDIT', {});
      if (!called) return { id, description: desc, status: 'FAIL', detail: 'sdkClient.execute not called' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _blocked_returns_blocked() {
    const id = 'EPC-05'; const desc = 'blocked router returns blocked:true';
    try {
      const er = this._er({ sdkClient: { execute: async () => ({}) } });
      er.block();
      const r = await er.route('WORKFLOW', 'APPEND_AUDIT', {});
      if (!r.blocked) return { id, description: desc, status: 'FAIL', detail: `got ${JSON.stringify(r)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _unblock_reenables() {
    const id = 'EPC-06'; const desc = 'unblock() re-enables routing';
    try {
      let called = false;
      const sdk = { execute: async () => { called = true; return {}; } };
      const er  = this._er({ sdkClient: sdk });
      er.block();
      er.unblock();
      await er.route('WORKFLOW', 'APPEND_AUDIT', {});
      if (!called) return { id, description: desc, status: 'FAIL', detail: 'sdkClient not called after unblock' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _unknown_source_throws() {
    const id = 'EPC-07'; const desc = 'unknown source throws';
    try {
      const er = this._er({ sdkClient: { execute: async () => ({}) } });
      let threw = false;
      try { await er.route('UNKNOWN_SOURCE', 'APPEND_AUDIT', {}); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw on unknown source' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _emits_event() {
    const id = 'EPC-08'; const desc = 'emits platform.execution.routed event';
    try {
      const events = [];
      const bus = { emit: (t, f) => events.push(t) };
      const er  = this._er({ sdkClient: { execute: async () => ({}) }, eventBus: bus });
      await er.route('WORKFLOW', 'APPEND_AUDIT', {});
      if (!events.includes('platform.execution.routed'))
        return { id, description: desc, status: 'FAIL', detail: 'event not emitted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _correlation_id_propagated() {
    const id = 'EPC-09'; const desc = 'correlation_id propagated to sdkClient';
    try {
      let received_opts = null;
      const sdk = { execute: async (at, args, opts) => { received_opts = opts; return {}; } };
      const er  = this._er({ sdkClient: sdk });
      await er.route('WORKFLOW', 'APPEND_AUDIT', {}, { correlation_id: 'cid_test' });
      if (!received_opts || received_opts.correlation_id !== 'cid_test')
        return { id, description: desc, status: 'FAIL', detail: `opts: ${JSON.stringify(received_opts)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _snapshot_has_blocked() {
    const id = 'EPC-10'; const desc = 'snapshot() has blocked field';
    try {
      const er   = this._er({ sdkClient: { execute: async () => ({}) } });
      const snap = er.snapshot();
      if (typeof snap.blocked !== 'boolean')
        return { id, description: desc, status: 'FAIL', detail: 'missing blocked field' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ExecutionPathCertification };
