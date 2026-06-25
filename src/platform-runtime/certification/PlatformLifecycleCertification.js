'use strict';
/**
 * PlatformLifecycleCertification
 *
 * PLC-01: lifecycle-coordinator.js exists
 * PLC-02: LIFECYCLE_STATES has all 9 required states
 * PLC-03: VALID_TRANSITIONS is defined
 * PLC-04: functional — BOOTSTRAP → INITIALIZING allowed
 * PLC-05: functional — BOOTSTRAP → ACTIVE rejected
 * PLC-06: functional — TERMINATED → anything rejected
 * PLC-07: functional — transition emits event
 * PLC-08: functional — invalid transition throws
 * PLC-09: functional — getHistory() grows with transitions
 * PLC-10: functional — canTransition() returns boolean
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const REQUIRED_STATES = ['BOOTSTRAP','INITIALIZING','RECOVERING','ACTIVE','DEGRADED','REPLAY','FROZEN','SHUTTING_DOWN','TERMINATED'];

class PlatformLifecycleCertification {
  async run() {
    const checks = [
      this._exists('PLC-01', 'lifecycle-coordinator.js', 'LifecycleCoordinator', 'lifecycle-coordinator.js exports LifecycleCoordinator'),
      this._exists('PLC-02', 'lifecycle-coordinator.js', 'SHUTTING_DOWN',        'LIFECYCLE_STATES has all 9 states'),
      this._exists('PLC-03', 'lifecycle-coordinator.js', 'VALID_TRANSITIONS',    'VALID_TRANSITIONS defined'),
      this._bootstrap_to_initializing(),
      this._bootstrap_to_active_rejected(),
      this._terminated_rejected(),
      this._transition_emits_event(),
      this._invalid_throws(),
      this._history_grows(),
      this._can_transition_boolean(),
    ];
    return this._result('PlatformLifecycleCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _lc() {
    const { LifecycleCoordinator } = require('../lifecycle-coordinator');
    return new LifecycleCoordinator();
  }

  _bootstrap_to_initializing() {
    const id = 'PLC-04'; const desc = 'BOOTSTRAP → INITIALIZING allowed';
    try {
      const lc = this._lc();
      lc.transition('INITIALIZING', 'test');
      if (lc.getState() !== 'INITIALIZING') return { id, description: desc, status: 'FAIL', detail: `state: ${lc.getState()}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _bootstrap_to_active_rejected() {
    const id = 'PLC-05'; const desc = 'BOOTSTRAP → ACTIVE rejected';
    try {
      const lc = this._lc();
      let threw = false;
      try { lc.transition('ACTIVE', 'test'); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should have thrown' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _terminated_rejected() {
    const id = 'PLC-06'; const desc = 'TERMINATED → anything rejected';
    try {
      const lc = this._lc();
      lc.transition('INITIALIZING', 'test');
      lc.transition('ACTIVE', 'test');
      lc.transition('SHUTTING_DOWN', 'test');
      lc.transition('TERMINATED', 'test');
      let threw = false;
      try { lc.transition('ACTIVE', 'test'); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'TERMINATED should reject all' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _transition_emits_event() {
    const id = 'PLC-07'; const desc = 'transition emits event';
    try {
      const events = [];
      const { LifecycleCoordinator } = require('../lifecycle-coordinator');
      const lc = new LifecycleCoordinator({ eventBus: { emit: (t, f) => events.push({ t, f }) } });
      lc.transition('INITIALIZING', 'test');
      if (!events.some(e => e.t === 'platform.lifecycle.transition'))
        return { id, description: desc, status: 'FAIL', detail: 'no lifecycle event emitted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _invalid_throws() {
    const id = 'PLC-08'; const desc = 'invalid transition throws';
    try {
      const lc = this._lc();
      let threw = false;
      try { lc.transition('REPLAY', 'test'); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw on invalid' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _history_grows() {
    const id = 'PLC-09'; const desc = 'getHistory() grows with transitions';
    try {
      const lc = this._lc();
      const h0 = lc.getHistory().length;
      lc.transition('INITIALIZING', 'test');
      const h1 = lc.getHistory().length;
      if (h1 <= h0) return { id, description: desc, status: 'FAIL', detail: 'history did not grow' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _can_transition_boolean() {
    const id = 'PLC-10'; const desc = 'canTransition() returns boolean';
    try {
      const lc = this._lc();
      const yes = lc.canTransition('INITIALIZING');
      const no  = lc.canTransition('ACTIVE');
      if (yes !== true || no !== false)
        return { id, description: desc, status: 'FAIL', detail: `yes=${yes} no=${no}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { PlatformLifecycleCertification };
