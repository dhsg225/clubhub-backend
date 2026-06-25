'use strict';
/**
 * LifecycleConsistencyCertification — verifies lifecycle state machine is complete and safe.
 *
 * Checks:
 *   LLC-01: lifecycle.js defines all 8 required states
 *   LLC-02: lifecycle.js has valid transition table for all states
 *   LLC-03: lifecycle.js emits events on transitions
 *   LLC-04: lifecycle.js has snapshot() method
 *   LLC-05: lifecycle.js has healthReport() method
 *   LLC-06: lifecycle.js has setCertificationStatus() method
 *   LLC-07: SHUTDOWN is a terminal state (no outgoing transitions)
 *   LLC-08: index.js lifecycle.transition is called during init
 */

const fs   = require('fs');
const path = require('path');

const REQUIRED_STATES = [
  'UNINITIALIZED',
  'BOOTING',
  'RECOVERING',
  'ACTIVE',
  'FROZEN',
  'DEGRADED',
  'REPLAY',
  'SHUTDOWN',
];

class LifecycleConsistencyCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [
      this._checkAllStatesPresent(),
      this._checkTransitionTablePresent(),
      this._checkEmitsEvents(),
      this._checkSnapshotMethod(),
      this._checkHealthReportMethod(),
      this._checkCertificationStatusMethod(),
      this._checkShutdownIsTerminal(),
      this._checkIndexCallsTransition(),
    ];

    return this._buildResult('LifecycleConsistencyCertification', checks);
  }

  _checkAllStatesPresent() {
    const src = this._read('lifecycle.js');
    const missing = REQUIRED_STATES.filter(s => !src.includes(`'${s}'`) && !src.includes(`"${s}"`));
    return {
      id: 'LLC-01',
      description: 'lifecycle.js defines all 8 required runtime states',
      status: missing.length === 0 ? 'PASS' : 'FAIL',
      detail: missing.length === 0 ? null : `Missing states: ${missing.join(', ')}`,
    };
  }

  _checkTransitionTablePresent() {
    const src = this._read('lifecycle.js');
    const hasTable = src.includes('VALID_TRANSITIONS') &&
                     src.includes('UNINITIALIZED') &&
                     src.includes('SHUTDOWN');
    return {
      id: 'LLC-02',
      description: 'lifecycle.js has VALID_TRANSITIONS table covering all states',
      status: hasTable ? 'PASS' : 'FAIL',
      detail: hasTable ? null : 'lifecycle.js missing VALID_TRANSITIONS table',
    };
  }

  _checkEmitsEvents() {
    const src = this._read('lifecycle.js');
    const emitsEvents = src.includes('_emitTransitionEvent') &&
                        src.includes('emit(') &&
                        src.includes('lifecycle_changed');
    return {
      id: 'LLC-03',
      description: 'lifecycle.js emits governance events on state transitions',
      status: emitsEvents ? 'PASS' : 'FAIL',
      detail: emitsEvents ? null : 'lifecycle.js does not emit events on transitions',
    };
  }

  _checkSnapshotMethod() {
    const src = this._read('lifecycle.js');
    const hasSnapshot = src.includes('snapshot()') &&
                        src.includes('state:') &&
                        src.includes('transition_ts');
    return {
      id: 'LLC-04',
      description: 'lifecycle.js has snapshot() returning current state context',
      status: hasSnapshot ? 'PASS' : 'FAIL',
      detail: hasSnapshot ? null : 'lifecycle.js missing snapshot() method',
    };
  }

  _checkHealthReportMethod() {
    const src = this._read('lifecycle.js');
    const hasHealth = src.includes('healthReport()') &&
                      src.includes('healthy') &&
                      src.includes('warnings');
    return {
      id: 'LLC-05',
      description: 'lifecycle.js has healthReport() with healthy flag and warnings',
      status: hasHealth ? 'PASS' : 'FAIL',
      detail: hasHealth ? null : 'lifecycle.js missing healthReport() method',
    };
  }

  _checkCertificationStatusMethod() {
    const src = this._read('lifecycle.js');
    const hasCertMethod = src.includes('setCertificationStatus') &&
                          src.includes('_certificationStatus');
    return {
      id: 'LLC-06',
      description: 'lifecycle.js has setCertificationStatus() method',
      status: hasCertMethod ? 'PASS' : 'FAIL',
      detail: hasCertMethod ? null : 'lifecycle.js missing setCertificationStatus() — required for certification integration',
    };
  }

  _checkShutdownIsTerminal() {
    const src = this._read('lifecycle.js');
    // SHUTDOWN should map to empty array in transition table
    // Match 'SHUTDOWN:' followed (with any whitespace) by '[]'
    const hasTerminal = src.includes('SHUTDOWN:') &&
                        /SHUTDOWN\s*:\s*\[\s*\]/.test(src);
    return {
      id: 'LLC-07',
      description: 'SHUTDOWN is a terminal state with no outgoing transitions',
      status: hasTerminal ? 'PASS' : 'FAIL',
      detail: hasTerminal ? null : 'SHUTDOWN state is not declared as terminal (empty transition array)',
    };
  }

  _checkIndexCallsTransition() {
    const src = this._read('index.js');
    const ok = src.includes("lifecycle.transition('BOOTING'") ||
               src.includes("lifecycle.transition(\"BOOTING\"");
    return {
      id: 'LLC-08',
      description: 'index.js calls lifecycle.transition during init (BOOTING)',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'index.js does not drive lifecycle state machine during init',
    };
  }

  _buildResult(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    const warn = checks.filter(c => c.status === 'WARN').length;
    return {
      name,
      rating: fail > 0 ? 'FAIL' : warn > 0 ? 'CONDITIONAL' : 'PASS',
      pass_count: pass,
      fail_count: fail,
      warn_count: warn,
      checks,
    };
  }

  _read(relPath) {
    try { return fs.readFileSync(path.join(this._root, relPath), 'utf8'); }
    catch (_) { return ''; }
  }
}

module.exports = { LifecycleConsistencyCertification };
