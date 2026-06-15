'use strict';
/**
 * AuthorityBypassCertification — verifies no authority boundary violations.
 *
 * Checks:
 *   ABC-01: No ota-runtime module imports lib/governed-config directly
 *   ABC-02: No ota-runtime module imports lib/governed-clock directly
 *   ABC-03: No ota-runtime module creates pg.Pool (DB pool creation is kernel's domain)
 *   ABC-04: governed-deployment uses FreezeController, not clusterConsensus directly
 *   ABC-05: governed-deployment uses AuthorityCoordinator, not cluster-consensus directly
 *   ABC-06: No ota-runtime module imports governance-kernel/core/ directly
 *   ABC-07: deployment-runtime.js has no DB pool access
 *   ABC-08: replay-hooks.js has no kernel imports
 */

const fs   = require('fs');
const path = require('path');

const ALL_RUNTIME_FILES = [
  'index.js',
  'lifecycle.js',
  'routes.js',
  'deployment-runtime.js',
  'governed-deployment.js',
  'governed-incidents.js',
  'governed-config.js',
  'governed-operators.js',
  'replay-hooks.js',
];

class AuthorityBypassCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [
      this._checkNoDirectGovernedConfigLib(),
      this._checkNoDirectGovernedClockLib(),
      this._checkNoDbPoolCreation(),
      this._checkDeploymentUsesFreezeController(),
      this._checkDeploymentUsesAuthorityCoordinator(),
      this._checkNoKernelCoreImports(),
      this._checkDeploymentRuntimeHasNoDbPool(),
      this._checkReplayHooksHasNoKernelImports(),
    ];

    return this._buildResult('AuthorityBypassCertification', checks);
  }

  _checkNoDirectGovernedConfigLib() {
    for (const file of ALL_RUNTIME_FILES) {
      const src = this._read(file);
      if (src.includes("require('../../lib/governed-config") ||
          src.includes('require("../../lib/governed-config')) {
        return {
          id: 'ABC-01',
          description: 'OTA runtime does not import lib/governed-config directly',
          status: 'FAIL',
          detail: `${file} imports lib/governed-config — must use ConfigAuthority API`,
        };
      }
    }
    return {
      id: 'ABC-01',
      description: 'OTA runtime does not import lib/governed-config directly',
      status: 'PASS',
      detail: null,
    };
  }

  _checkNoDirectGovernedClockLib() {
    for (const file of ALL_RUNTIME_FILES) {
      const src = this._read(file);
      if (src.includes("require('../../lib/governed-clock") ||
          src.includes('require("../../lib/governed-clock')) {
        return {
          id: 'ABC-02',
          description: 'OTA runtime does not import lib/governed-clock directly',
          status: 'FAIL',
          detail: `${file} imports lib/governed-clock — must use kernel DeterministicClock or injected clock`,
        };
      }
    }
    return {
      id: 'ABC-02',
      description: 'OTA runtime does not import lib/governed-clock directly',
      status: 'PASS',
      detail: null,
    };
  }

  _checkNoDbPoolCreation() {
    for (const file of ALL_RUNTIME_FILES) {
      const src = this._read(file);
      if (src.includes('new Pool(') || src.includes('new pg.Pool(')) {
        return {
          id: 'ABC-03',
          description: 'OTA runtime does not create pg.Pool (pool is kernel domain)',
          status: 'FAIL',
          detail: `${file} creates a pg.Pool — pool must be injected by application, not owned by runtime`,
        };
      }
    }
    return {
      id: 'ABC-03',
      description: 'OTA runtime does not create pg.Pool',
      status: 'PASS',
      detail: null,
    };
  }

  _checkDeploymentUsesFreezeController() {
    const src = this._read('governed-deployment.js');
    // Must use _freezeController, not import cluster-consensus directly
    const usesFreezeCtrl = src.includes('_freezeController.freeze') ||
                           src.includes('_freezeController.isFrozen');
    const noDirectConsensus = !src.includes("require('../../../governance-kernel/core/cluster-consensus") &&
                              !src.includes("require('../../governance-kernel/core/cluster-consensus");
    return {
      id: 'ABC-04',
      description: 'governed-deployment uses FreezeController, not cluster-consensus directly',
      status: (usesFreezeCtrl && noDirectConsensus) ? 'PASS' : 'FAIL',
      detail: (usesFreezeCtrl && noDirectConsensus) ? null :
        !usesFreezeCtrl ? 'governed-deployment.js does not use _freezeController' :
        'governed-deployment.js imports cluster-consensus directly — authority bypass',
    };
  }

  _checkDeploymentUsesAuthorityCoordinator() {
    const src = this._read('governed-deployment.js');
    const usesCoord = src.includes('_authorityCoordinator.incrementEpoch') ||
                      src.includes('_authorityCoordinator.getEpoch');
    const noDirectConsensus = !src.includes("require('../../../governance-kernel/core/cluster-consensus") &&
                              !src.includes("require('../../governance-kernel/core/cluster-consensus");
    return {
      id: 'ABC-05',
      description: 'governed-deployment uses AuthorityCoordinator, not cluster-consensus directly',
      status: (usesCoord && noDirectConsensus) ? 'PASS' : 'FAIL',
      detail: (usesCoord && noDirectConsensus) ? null :
        'governed-deployment.js bypasses AuthorityCoordinator',
    };
  }

  _checkNoKernelCoreImports() {
    const violations = [];
    for (const file of ALL_RUNTIME_FILES) {
      const src = this._read(file);
      // Filter out comment lines before checking for imports
      const codeLines = src.split('\n').filter(l => {
        const t = l.trim();
        return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
      }).join('\n');
      if (codeLines.includes('governance-kernel/core/') ||
          codeLines.includes("require('../core/") ||
          codeLines.includes("require('../../core/")) {
        violations.push(file);
      }
    }
    return {
      id: 'ABC-06',
      description: 'OTA runtime modules do not import governance-kernel/core/ directly',
      status: violations.length === 0 ? 'PASS' : 'FAIL',
      detail: violations.length === 0 ? null :
        `${violations.join(', ')} import governance-kernel/core/ — must use kernel API classes`,
    };
  }

  _checkDeploymentRuntimeHasNoDbPool() {
    const src = this._read('deployment-runtime.js');
    const hasPool = src.includes('pool.query') || src.includes('pg.') ||
                    src.includes('withAdvisoryLock') || src.includes('new Pool');
    return {
      id: 'ABC-07',
      description: 'deployment-runtime.js has no DB pool access (read model only)',
      status: !hasPool ? 'PASS' : 'FAIL',
      detail: !hasPool ? null : 'deployment-runtime.js has DB pool access — must remain a pure read model',
    };
  }

  _checkReplayHooksHasNoKernelImports() {
    const src = this._read('replay-hooks.js');
    const hasKernelImport = src.includes('governance-kernel') ||
                            src.includes("require('../../../governance");
    return {
      id: 'ABC-08',
      description: 'replay-hooks.js has no kernel imports (pure isolation module)',
      status: !hasKernelImport ? 'PASS' : 'FAIL',
      detail: !hasKernelImport ? null : 'replay-hooks.js imports kernel modules — must be standalone',
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

module.exports = { AuthorityBypassCertification };
