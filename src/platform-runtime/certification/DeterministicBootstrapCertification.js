'use strict';
/**
 * DeterministicBootstrapCertification
 *
 * DBC-01: deterministic-bootstrap.js exists
 * DBC-02: BOOTSTRAP_PHASES has all 10 required phases
 * DBC-03: deterministic-shutdown.js exists
 * DBC-04: functional — bootstrap runs phases in order
 * DBC-05: functional — failed phase throws and halts
 * DBC-06: functional — emits bootstrap events
 * DBC-07: functional — getLog() captures all phase results
 * DBC-08: functional — shutdown runs in reverse-friendly order
 * DBC-09: functional — shutdown continues past errors
 * DBC-10: functional — runtime-registry.js isAllReady() returns false before init
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const REQUIRED_PHASES = ['kernel','trace_store','sdk','ota_runtime','agent_runtime','orchestration','simulation','operator_ui','topology','convergence'];

class DeterministicBootstrapCertification {
  async run() {
    const checks = [
      this._exists('DBC-01', 'deterministic-bootstrap.js', 'DeterministicBootstrap', 'deterministic-bootstrap.js exists'),
      this._has_phases('DBC-02'),
      this._exists('DBC-03', 'deterministic-shutdown.js',  'DeterministicShutdown',  'deterministic-shutdown.js exists'),
      await this._runs_in_order(),
      await this._failed_phase_throws(),
      await this._emits_events(),
      await this._getlog_captures(),
      await this._shutdown_runs(),
      await this._shutdown_continues_past_error(),
      this._registry_not_ready_initially(),
    ];
    return this._result('DeterministicBootstrapCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _has_phases(id) {
    const desc = 'BOOTSTRAP_PHASES has all 10 required phases';
    try {
      const { BOOTSTRAP_PHASES } = require('../deterministic-bootstrap');
      const ids = BOOTSTRAP_PHASES.map(p => p.id);
      for (const p of REQUIRED_PHASES) {
        if (!ids.includes(p)) return { id, description: desc, status: 'FAIL', detail: `missing phase: ${p}` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _runs_in_order() {
    const id = 'DBC-04'; const desc = 'bootstrap runs phases in declared order';
    try {
      const order = [];
      const { DeterministicBootstrap } = require('../deterministic-bootstrap');
      const bs = new DeterministicBootstrap({});
      await bs.run({
        kernel:      async () => order.push('kernel'),
        sdk:         async () => order.push('sdk'),
        trace_store: async () => order.push('trace_store'),
      });
      // kernel(1) < trace_store(2) < sdk(3)
      if (order.indexOf('kernel') >= order.indexOf('trace_store') ||
          order.indexOf('trace_store') >= order.indexOf('sdk'))
        return { id, description: desc, status: 'FAIL', detail: `order: ${order.join(',')}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _failed_phase_throws() {
    const id = 'DBC-05'; const desc = 'failed phase throws and halts';
    try {
      const { DeterministicBootstrap } = require('../deterministic-bootstrap');
      const bs = new DeterministicBootstrap({});
      let threw = false;
      try {
        await bs.run({ kernel: async () => { throw new Error('kernel_fail'); } });
      } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw on phase fail' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _emits_events() {
    const id = 'DBC-06'; const desc = 'emits bootstrap phase events';
    try {
      const events = [];
      const bus = { emit: (t) => events.push(t) };
      const { DeterministicBootstrap } = require('../deterministic-bootstrap');
      const bs = new DeterministicBootstrap({ eventBus: bus });
      await bs.run({ kernel: async () => {} });
      if (!events.includes('platform.bootstrap.phase_start'))
        return { id, description: desc, status: 'FAIL', detail: 'phase_start not emitted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _getlog_captures() {
    const id = 'DBC-07'; const desc = 'getLog() captures all phase results';
    try {
      const { DeterministicBootstrap } = require('../deterministic-bootstrap');
      const bs = new DeterministicBootstrap({});
      await bs.run({ kernel: async () => {}, sdk: async () => {} });
      const log = bs.getLog();
      if (log.length < 2) return { id, description: desc, status: 'FAIL', detail: `log: ${log.length}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _shutdown_runs() {
    const id = 'DBC-08'; const desc = 'shutdown runs registered phases';
    try {
      const ran = [];
      const { DeterministicShutdown } = require('../deterministic-shutdown');
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('kernel', {}, { shutdownOrder: 1 });
      const sd = new DeterministicShutdown({ registry: reg });
      await sd.run({ kernel: async () => ran.push('kernel') });
      if (!ran.includes('kernel')) return { id, description: desc, status: 'FAIL', detail: 'kernel not shut down' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _shutdown_continues_past_error() {
    const id = 'DBC-09'; const desc = 'shutdown continues past errors';
    try {
      const ran = [];
      const { DeterministicShutdown } = require('../deterministic-shutdown');
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('a', {}, { shutdownOrder: 10 });
      reg.register('b', {}, { shutdownOrder: 5  });
      const sd = new DeterministicShutdown({ registry: reg });
      await sd.run({
        a: async () => { throw new Error('a_fail'); },
        b: async () => ran.push('b'),
      });
      if (!ran.includes('b')) return { id, description: desc, status: 'FAIL', detail: 'b did not run after a error' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _registry_not_ready_initially() {
    const id = 'DBC-10'; const desc = 'RuntimeRegistry isAllReady() false before init';
    try {
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('kernel', {}, { required: true });
      // State is REGISTERED, not READY
      if (reg.isAllReady()) return { id, description: desc, status: 'FAIL', detail: 'should not be ready' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { DeterministicBootstrapCertification };
