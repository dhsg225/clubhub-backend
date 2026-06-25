'use strict';
/**
 * GovernedRoutingCertification — verifies routes use governed modules, not bypasses.
 *
 * Checks:
 *   GRC-01: routes.js uses requireAuth middleware on all mutating routes
 *   GRC-02: routes.js does not import lib/ directly
 *   GRC-03: routes.js does not import governance-kernel/core/ directly
 *   GRC-04: routes.js uses governed-deployment for deployment operations
 *   GRC-05: routes.js uses governed-incidents for incident operations
 *   GRC-06: routes.js uses governed-config for config operations
 *   GRC-07: routes.js uses governed-operators.appendAction for operator attribution
 */

const fs   = require('fs');
const path = require('path');

class GovernedRoutingCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [
      this._checkRoutesUseRequireAuth(),
      this._checkNoDirectLibImports(),
      this._checkNoKernelCoreImports(),
      this._checkRoutesUseGovernedDeployment(),
      this._checkRoutesUseGovernedIncidents(),
      this._checkRoutesUseGovernedConfig(),
      this._checkRoutesAppendAuditLedger(),
    ];

    return this._buildResult('GovernedRoutingCertification', checks);
  }

  _checkRoutesUseRequireAuth() {
    const src = this._read('routes.js');
    // All mutating routes (POST) must use requireAuth middleware
    const mutatingRoutes = (src.match(/router\.post\s*\(/g) || []).length;
    const requireAuthUses = (src.match(/requireAuth/g) || []).length;
    // Each POST route should reference requireAuth + at least once per route
    const ok = mutatingRoutes > 0 && requireAuthUses >= mutatingRoutes;
    return {
      id: 'GRC-01',
      description: 'routes.js applies requireAuth middleware on all mutating routes',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null :
        `Found ${mutatingRoutes} POST routes but only ${requireAuthUses} requireAuth uses`,
    };
  }

  _checkNoDirectLibImports() {
    const src = this._read('routes.js');
    const noLib = !src.includes("require('../../lib/") &&
                  !src.includes('require("../../lib/');
    return {
      id: 'GRC-02',
      description: 'routes.js does not import lib/ directly',
      status: noLib ? 'PASS' : 'FAIL',
      detail: noLib ? null : 'routes.js imports lib/ directly — must route through governed-* modules',
    };
  }

  _checkNoKernelCoreImports() {
    const files = ['routes.js', 'governed-deployment.js', 'governed-incidents.js',
                   'governed-config.js', 'governed-operators.js'];
    for (const file of files) {
      const src = this._read(file);
      if (src.includes('governance-kernel/core/') || src.includes("require('../../../governance-kernel/core")) {
        return {
          id: 'GRC-03',
          description: 'OTA runtime modules do not import governance-kernel/core/ directly',
          status: 'FAIL',
          detail: `${file} imports governance-kernel/core/ — must use kernel API classes`,
        };
      }
    }
    return {
      id: 'GRC-03',
      description: 'OTA runtime modules do not import governance-kernel/core/ directly',
      status: 'PASS',
      detail: null,
    };
  }

  _checkRoutesUseGovernedDeployment() {
    const src = this._read('routes.js');
    const ok = src.includes('governedDeployment') &&
               src.includes('promoteWave') &&
               src.includes('freezeDeployment');
    return {
      id: 'GRC-04',
      description: 'routes.js uses governed-deployment for deployment operations',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'routes.js does not use governedDeployment module',
    };
  }

  _checkRoutesUseGovernedIncidents() {
    const src = this._read('routes.js');
    const ok = src.includes('governedIncidents') &&
               src.includes('governedIncidents.create') &&
               src.includes('governedIncidents.transition');
    return {
      id: 'GRC-05',
      description: 'routes.js uses governed-incidents for incident operations',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'routes.js does not use governedIncidents module',
    };
  }

  _checkRoutesUseGovernedConfig() {
    const src = this._read('routes.js');
    const ok = src.includes('governedConfig') &&
               src.includes('governedConfig.snapshot') &&
               src.includes('governedConfig.update');
    return {
      id: 'GRC-06',
      description: 'routes.js uses governed-config for config operations',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'routes.js does not use governedConfig module',
    };
  }

  _checkRoutesAppendAuditLedger() {
    const src = this._read('routes.js');
    // Routes call governedOperators.appendAction after mutations
    const appendCount = (src.match(/appendAction/g) || []).length;
    const postCount   = (src.match(/router\.post/g) || []).length;
    const ok = postCount > 0 && appendCount >= postCount;
    return {
      id: 'GRC-07',
      description: 'routes.js calls governedOperators.appendAction for operator attribution',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null :
        `${postCount} POST routes but only ${appendCount} appendAction calls — operator attribution gap`,
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

module.exports = { GovernedRoutingCertification };
