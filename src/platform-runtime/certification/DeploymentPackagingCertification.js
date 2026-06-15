'use strict';
/**
 * DeploymentPackagingCertification
 *
 * DPC-01: deployment/bootstrap-manifest.json exists and has startup_order
 * DPC-02: deployment/runtime-capabilities.json exists and has capabilities
 * DPC-03: deployment/certification-profile.json exists and has required_certifications
 * DPC-04: deployment/config/platform-config-schema.json exists
 * DPC-05: deployment/healthchecks/platform-health.js exists and exports PlatformHealthCheck
 * DPC-06: functional — bootstrap-manifest.json startup_order has kernel first
 * DPC-07: functional — certification-profile.json has a9 as required
 * DPC-08: functional — PlatformHealthCheck.isReady() returns false with no runtime
 * DPC-09: functional — PlatformHealthCheck.isAlive() returns false with TERMINATED lifecycle
 * DPC-10: functional — runtime-capabilities.json certifications block has a9
 */
const fs   = require('fs');
const path = require('path');
const DEPLOY_ROOT = path.resolve(__dirname, '../../../../deployment');

class DeploymentPackagingCertification {
  async run() {
    const checks = [
      this._json_has('DPC-01', 'bootstrap-manifest.json',       'startup_order',          'bootstrap-manifest.json has startup_order'),
      this._json_has('DPC-02', 'runtime-capabilities.json',     'capabilities',           'runtime-capabilities.json has capabilities'),
      this._json_has('DPC-03', 'certification-profile.json',    'required_certifications','certification-profile.json has required_certifications'),
      this._json_has('DPC-04', 'config/platform-config-schema.json', 'properties',        'config-schema.json has properties definition'),
      this._file_has('DPC-05', 'healthchecks/platform-health.js', 'PlatformHealthCheck',  'platform-health.js exports PlatformHealthCheck'),
      this._kernel_first(),
      this._a9_required(),
      this._healthcheck_not_ready_no_runtime(),
      this._healthcheck_not_alive_terminated(),
      this._capabilities_has_a9(),
    ];
    return this._result('DeploymentPackagingCertification', checks);
  }

  _json_has(id, file, key, description) {
    const fp = path.join(DEPLOY_ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    try {
      const obj = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!obj[key]) return { id, description, status: 'FAIL', detail: `missing key '${key}'` };
      return { id, description, status: 'PASS', detail: null };
    } catch (err) { return { id, description, status: 'FAIL', detail: err.message }; }
  }

  _file_has(id, file, marker, description) {
    const fp = path.join(DEPLOY_ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _kernel_first() {
    const id = 'DPC-06'; const desc = 'bootstrap-manifest.json startup_order has kernel first';
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(DEPLOY_ROOT, 'bootstrap-manifest.json'), 'utf8'));
      if (manifest.startup_order[0].id !== 'kernel')
        return { id, description: desc, status: 'FAIL', detail: `first: ${manifest.startup_order[0].id}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _a9_required() {
    const id = 'DPC-07'; const desc = 'certification-profile.json requires a9';
    try {
      const profile = JSON.parse(fs.readFileSync(path.join(DEPLOY_ROOT, 'certification-profile.json'), 'utf8'));
      const phases  = profile.required_certifications.map(c => c.phase);
      if (!phases.includes('a9'))
        return { id, description: desc, status: 'FAIL', detail: 'a9 not in required_certifications' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _healthcheck_not_ready_no_runtime() {
    const id = 'DPC-08'; const desc = 'PlatformHealthCheck.isReady() false with no runtime';
    try {
      const { PlatformHealthCheck } = require('../../../../deployment/healthchecks/platform-health');
      const hc = new PlatformHealthCheck();
      if (hc.isReady()) return { id, description: desc, status: 'FAIL', detail: 'should not be ready' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _healthcheck_not_alive_terminated() {
    const id = 'DPC-09'; const desc = 'PlatformHealthCheck.isAlive() false for TERMINATED';
    try {
      const { PlatformHealthCheck } = require('../../../../deployment/healthchecks/platform-health');
      const mockRuntime = {
        health:    { snapshot: () => ({ overall: 'HEALTHY' }) },
        lifecycle: { getState: () => 'TERMINATED' },
      };
      const hc = new PlatformHealthCheck({ platformRuntime: mockRuntime });
      if (hc.isAlive()) return { id, description: desc, status: 'FAIL', detail: 'TERMINATED should not be alive' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _capabilities_has_a9() {
    const id = 'DPC-10'; const desc = 'runtime-capabilities.json certifications has a9';
    try {
      const caps = JSON.parse(fs.readFileSync(path.join(DEPLOY_ROOT, 'runtime-capabilities.json'), 'utf8'));
      if (!caps.certifications || !caps.certifications.a9)
        return { id, description: desc, status: 'FAIL', detail: 'a9 certification missing' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { DeploymentPackagingCertification };
