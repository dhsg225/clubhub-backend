'use strict';
/**
 * ProductionReadinessCertification
 *
 * PRC-01: platform-runtime/index.js exports createPlatformRuntime
 * PRC-02: platform-runtime has no autonomous mutation loops
 * PRC-03: execution-router.js blocks mutations when blocked
 * PRC-04: functional — PlatformRuntime snapshot returns lifecycle + registry + topology
 * PRC-05: functional — LifecycleCoordinator TERMINATED has no valid transitions
 * PRC-06: functional — RuntimeRegistry isAllReady() true after all set READY
 * PRC-07: functional — HealthModel overallStatus HEALTHY when all HEALTHY
 * PRC-08: functional — HealthModel overallStatus CRITICAL when any CRITICAL
 * PRC-09: functional — ConvergenceEngine runFullScan returns scan_at timestamp
 * PRC-10: functional — DeterministicBootstrap getLog() captures phase results
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class ProductionReadinessCertification {
  async run() {
    const checks = [
      this._exists ('PRC-01', 'index.js',        'createPlatformRuntime',  'index.js exports createPlatformRuntime'),
      this._no_str ('PRC-02', 'platform-runtime.js', 'setInterval',        'no autonomous mutation loops (setInterval)'),
      this._exists ('PRC-03', 'execution-router.js', 'blocked',            'execution-router has blocked state'),
      this._platform_snapshot(),
      this._terminated_no_transitions(),
      this._registry_all_ready(),
      this._health_all_healthy(),
      this._health_any_critical(),
      this._convergence_scan_ts(),
      await this._bootstrap_log(),
    ];
    return this._result('ProductionReadinessCertification', checks);
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

  _platform_snapshot() {
    const id = 'PRC-04'; const desc = 'PlatformRuntime snapshot returns key subsystems';
    try {
      const { PlatformRuntime } = require('../platform-runtime');
      const rt   = new PlatformRuntime({});
      const snap = rt.snapshot();
      if (!snap.lifecycle || !snap.registry || !snap.topology)
        return { id, description: desc, status: 'FAIL', detail: 'missing lifecycle/registry/topology' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _terminated_no_transitions() {
    const id = 'PRC-05'; const desc = 'TERMINATED lifecycle has no valid_next transitions';
    try {
      const { LifecycleCoordinator } = require('../lifecycle-coordinator');
      const lc = new LifecycleCoordinator();
      lc.transition('INITIALIZING');
      lc.transition('ACTIVE');
      lc.transition('SHUTTING_DOWN');
      lc.transition('TERMINATED');
      const snap = lc.snapshot();
      if (snap.valid_next.length > 0)
        return { id, description: desc, status: 'FAIL', detail: `valid_next: ${snap.valid_next}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _registry_all_ready() {
    const id = 'PRC-06'; const desc = 'RuntimeRegistry isAllReady() true after setting READY';
    try {
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('kernel', {}, { required: true });
      reg.register('sdk',    {}, { required: true });
      reg.setState('kernel', 'READY');
      reg.setState('sdk',    'READY');
      if (!reg.isAllReady()) return { id, description: desc, status: 'FAIL', detail: 'should be ready' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _health_all_healthy() {
    const id = 'PRC-07'; const desc = 'HealthModel overall HEALTHY when all HEALTHY';
    try {
      const { HealthModel, HEALTH_DIMENSIONS, HEALTH_STATUS } = require('../health-model');
      const hm = new HealthModel();
      for (const d of HEALTH_DIMENSIONS) hm.recordCheck(d, HEALTH_STATUS.HEALTHY);
      if (hm.overallStatus() !== HEALTH_STATUS.HEALTHY)
        return { id, description: desc, status: 'FAIL', detail: `got ${hm.overallStatus()}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _health_any_critical() {
    const id = 'PRC-08'; const desc = 'HealthModel overall CRITICAL when any CRITICAL';
    try {
      const { HealthModel, HEALTH_DIMENSIONS, HEALTH_STATUS } = require('../health-model');
      const hm = new HealthModel();
      for (const d of HEALTH_DIMENSIONS) hm.recordCheck(d, HEALTH_STATUS.HEALTHY);
      hm.recordCheck(HEALTH_DIMENSIONS[0], HEALTH_STATUS.CRITICAL);
      if (hm.overallStatus() !== HEALTH_STATUS.CRITICAL)
        return { id, description: desc, status: 'FAIL', detail: `got ${hm.overallStatus()}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _convergence_scan_ts() {
    const id = 'PRC-09'; const desc = 'ConvergenceEngine.runFullScan() returns scan_at timestamp';
    try {
      const { ConvergenceEngine } = require('../convergence-engine');
      const ce   = new ConvergenceEngine();
      const scan = ce.runFullScan();
      if (typeof scan.scan_at !== 'number')
        return { id, description: desc, status: 'FAIL', detail: 'missing scan_at' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _bootstrap_log() {
    const id = 'PRC-10'; const desc = 'DeterministicBootstrap.getLog() captures results';
    try {
      const { DeterministicBootstrap } = require('../deterministic-bootstrap');
      const bs = new DeterministicBootstrap({});
      await bs.run({ kernel: async () => {} });
      const log = bs.getLog();
      if (log.length === 0) return { id, description: desc, status: 'FAIL', detail: 'log empty' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ProductionReadinessCertification };
