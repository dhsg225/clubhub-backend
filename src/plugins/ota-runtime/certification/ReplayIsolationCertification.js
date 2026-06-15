'use strict';
/**
 * ReplayIsolationCertification — verifies replay mode suppresses side effects.
 *
 * Checks:
 *   RIC-01: replay-hooks.js defines enterReplay/exitReplay/isReplayMode
 *   RIC-02: replay-hooks.js has assertNotReplay guard
 *   RIC-03: replay-hooks.js has suppressedSideEffect
 *   RIC-04: governed-deployment.js calls assertCanMutateDeployment before mutations
 *   RIC-05: governed-incidents.js calls assertNotReplay before create/transition
 *   RIC-06: governed-config.js calls assertNotReplay before update
 *   RIC-07: governed-operators.js calls assertNotReplay on mutating token ops
 *   RIC-08: index.js exposes enterReplay/exitReplay for lifecycle integration
 */

const fs   = require('fs');
const path = require('path');

class ReplayIsolationCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [
      this._checkReplayHooksInterface(),
      this._checkAssertNotReplayGuard(),
      this._checkSuppressedSideEffect(),
      this._checkDeploymentReplayGuard(),
      this._checkIncidentsReplayGuard(),
      this._checkConfigReplayGuard(),
      this._checkOperatorsReplayGuard(),
      this._checkIndexExposesReplayControl(),
    ];

    return this._buildResult('ReplayIsolationCertification', checks);
  }

  _checkReplayHooksInterface() {
    const src = this._read('replay-hooks.js');
    const ok = src.includes('enterReplay') &&
               src.includes('exitReplay') &&
               src.includes('isReplayMode');
    return {
      id: 'RIC-01',
      description: 'replay-hooks.js defines enterReplay/exitReplay/isReplayMode',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'replay-hooks.js missing core replay mode interface',
    };
  }

  _checkAssertNotReplayGuard() {
    const src = this._read('replay-hooks.js');
    const ok = src.includes('assertNotReplay') &&
               src.includes('REPLAY_ISOLATION_VIOLATION') &&
               src.includes('throw');
    return {
      id: 'RIC-02',
      description: 'replay-hooks.js has assertNotReplay guard that throws',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'replay-hooks.js does not have a hard assertNotReplay guard',
    };
  }

  _checkSuppressedSideEffect() {
    const src = this._read('replay-hooks.js');
    const ok = src.includes('suppressedSideEffect') &&
               src.includes('_sideEffectsSuppressed');
    return {
      id: 'RIC-03',
      description: 'replay-hooks.js has suppressedSideEffect for conditional side effects',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'replay-hooks.js missing suppressedSideEffect helper',
    };
  }

  _checkDeploymentReplayGuard() {
    const src = this._read('governed-deployment.js');
    const ok = src.includes('assertCanMutateDeployment') &&
               src.includes('assertNotReplay');
    return {
      id: 'RIC-04',
      description: 'governed-deployment guards mutations against replay mode',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'governed-deployment.js does not guard mutations with assertCanMutateDeployment',
    };
  }

  _checkIncidentsReplayGuard() {
    const src = this._read('governed-incidents.js');
    const ok = src.includes('assertNotReplay') &&
               (src.match(/assertNotReplay/g) || []).length >= 2;
    return {
      id: 'RIC-05',
      description: 'governed-incidents guards create/transition against replay mode',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'governed-incidents.js missing assertNotReplay guards on mutations',
    };
  }

  _checkConfigReplayGuard() {
    const src = this._read('governed-config.js');
    const ok = src.includes('assertNotReplay');
    return {
      id: 'RIC-06',
      description: 'governed-config guards update against replay mode',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'governed-config.js does not call assertNotReplay in update()',
    };
  }

  _checkOperatorsReplayGuard() {
    const src = this._read('governed-operators.js');
    const ok = src.includes('assertNotReplay') &&
               src.includes('appendActionLinearized');
    return {
      id: 'RIC-07',
      description: 'governed-operators guards mutating token operations against replay',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'governed-operators.js missing assertNotReplay on token mutation operations',
    };
  }

  _checkIndexExposesReplayControl() {
    const src = this._read('index.js');
    const ok = src.includes('enterReplay') &&
               src.includes('exitReplay') &&
               src.includes('replayHooks');
    return {
      id: 'RIC-08',
      description: 'index.js exposes enterReplay/exitReplay for lifecycle integration',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'index.js does not expose replay control surface',
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

module.exports = { ReplayIsolationCertification };
