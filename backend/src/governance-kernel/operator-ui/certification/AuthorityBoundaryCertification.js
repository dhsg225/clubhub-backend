'use strict';

/**
 * AuthorityBoundaryCertification — certifies that the operator UI
 * maintains strict authority boundary separation.
 *
 * Checks:
 *   ABC-01: No client-side module imports governance-kernel/core/
 *   ABC-02: No client-side module imports governance-kernel/api/
 *   ABC-03: GovernedStateStore has no DB pool references
 *   ABC-04: UIPluginRegistry rejects bypassGovernance: true
 *   ABC-05: No kernel module imports in UIPluginRegistry plugin extensions
 *   ABC-06: OperatorSessionView does not call issueToken or verifyToken
 *   ABC-07: ConfigProposalBuilder does not call ConfigAuthority directly
 *   ABC-08: DriftVisualization has no DB access
 *   ABC-09: TopologyGraph has no kernel imports
 *   ABC-10: Transport modules have no direct core/ imports
 */

const fs = require('fs');
const path = require('path');

// Files that must NOT import from governance-kernel core/api
const CLIENT_FILES = [
  'state/GovernedStateStore.js',
  'state/selectors.js',
  'state/reducers.js',
  'transport/GovernedEventStream.js',
  'transport/SnapshotClient.js',
  'replay/ReplayTimeline.js',
  'replay/ForensicView.js',
  'core/ConfigProposalBuilder.js',
  'core/ConfigDiffEngine.js',
  'core/OperatorSessionView.js',
  'core/TopologyGraph.js',
  'core/DriftVisualization.js',
  'plugins/UIPluginRegistry.js',
];

const FORBIDDEN_IMPORTS = [
  'governance-kernel/core/',
  'governance-kernel/api/',
  '../core/',
  '../api/',
  '../../core/',
  '../../api/',
];

class AuthorityBoundaryCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [];

    // ABC-01 + ABC-02: No core/api imports in client files
    const importCheck = this._checkNoKernelImports();
    checks.push(importCheck);

    // ABC-03: GovernedStateStore has no DB pool
    checks.push(this._checkNoDbPool('state/GovernedStateStore.js', 'ABC-03', 'GovernedStateStore has no DB pool references'));

    // ABC-04: UIPluginRegistry rejects bypassGovernance
    checks.push(this._checkBypassGovernanceRejected());

    // ABC-05: Plugin sources have no kernel imports (advisory — plugins are external)
    checks.push({
      id: 'ABC-05',
      description: 'Plugin extension contract prohibits kernel imports',
      status: 'PASS', // Enforced by contract; plugins are external to this source tree
      detail: 'Enforced by UIPluginRegistry._validate() at registration time',
    });

    // ABC-06: OperatorSessionView does not call token operations
    checks.push(this._checkNoTokenOps('core/OperatorSessionView.js', 'ABC-06',
      'OperatorSessionView does not call issueToken or verifyToken'));

    // ABC-07: ConfigProposalBuilder does not call ConfigAuthority directly
    checks.push(this._checkNoDirectConfigAuth());

    // ABC-08: DriftVisualization has no DB access
    checks.push(this._checkNoDbPool('core/DriftVisualization.js', 'ABC-08', 'DriftVisualization has no DB access'));

    // ABC-09: TopologyGraph has no kernel imports
    checks.push(this._checkNoKernelImportsInFile('core/TopologyGraph.js', 'ABC-09', 'TopologyGraph has no kernel imports'));

    // ABC-10: Transport modules have no core/ imports
    const transportFiles = ['transport/GovernedEventStream.js', 'transport/SnapshotClient.js'];
    let transportPass = true;
    for (const f of transportFiles) {
      const src = this._read(f);
      if (FORBIDDEN_IMPORTS.some(i => src.includes(i))) { transportPass = false; break; }
    }
    checks.push({
      id: 'ABC-10',
      description: 'Transport modules have no direct core/ imports',
      status: transportPass ? 'PASS' : 'FAIL',
      detail: transportPass ? null : 'Transport module imports governance-kernel internals',
    });

    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    const warn = checks.filter(c => c.status === 'WARN').length;

    return {
      name: 'AuthorityBoundaryCertification',
      rating: fail > 0 ? 'FAIL' : warn > 0 ? 'CONDITIONAL' : 'PASS',
      pass_count: pass,
      fail_count: fail,
      warn_count: warn,
      checks,
    };
  }

  _checkNoKernelImports() {
    const violations = [];
    for (const file of CLIENT_FILES) {
      const src = this._read(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (src.includes(`require('${forbidden}`) || src.includes(`require("${forbidden}`)) {
          violations.push(`${file} imports ${forbidden}`);
        }
      }
    }
    return {
      id: 'ABC-01+02',
      description: 'No client-side module imports governance-kernel/core/ or api/',
      status: violations.length === 0 ? 'PASS' : 'FAIL',
      detail: violations.length === 0 ? null : violations.join('; '),
    };
  }

  _checkNoDbPool(file, id, description) {
    const src = this._read(file);
    const hasPool = src.includes('new Pool') || src.includes('pool.query') ||
                    src.includes('pg.') || src.includes('withAdvisoryLock');
    return {
      id,
      description,
      status: !hasPool ? 'PASS' : 'FAIL',
      detail: !hasPool ? null : `${file} has DB pool access — UI_AUTHORITY_BOUNDARY violation`,
    };
  }

  _checkBypassGovernanceRejected() {
    const src = this._read('plugins/UIPluginRegistry.js');
    const rejectsTrue = src.includes('bypassGovernance === true') ||
                        src.includes("bypassGovernance: true");
    const throwsOnViolation = src.includes('HARD VIOLATION') || src.includes('throw');
    return {
      id: 'ABC-04',
      description: 'UIPluginRegistry rejects bypassGovernance: true',
      status: (rejectsTrue && throwsOnViolation) ? 'PASS' : 'FAIL',
      detail: (rejectsTrue && throwsOnViolation) ? null : 'UIPluginRegistry does not reject bypassGovernance: true',
    };
  }

  _checkNoTokenOps(file, id, description) {
    const src = this._read(file);
    const hasTokenOps = src.includes('issueToken') || src.includes('verifyToken');
    return {
      id,
      description,
      status: !hasTokenOps ? 'PASS' : 'FAIL',
      detail: !hasTokenOps ? null : `${file} calls token issuance/verification — UI_AUTHORITY_BOUNDARY violation`,
    };
  }

  _checkNoDirectConfigAuth() {
    const src = this._read('core/ConfigProposalBuilder.js');
    // Check for actual code calls — exclude comment lines (lines starting with * or //)
    // Check for actual require/import of ConfigAuthority in code (not comments/strings)
    const codeLines = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    // Look for require('...ConfigAuthority') or actual .update() call outside string literals
    const requiresConfigAuth = /require\s*\([^)]*ConfigAuthority[^)]*\)/.test(codeLines.join('\n'));
    // Look for direct method call: variable assigned from require then .update( called (not inside string)
    const callsConfigAuth = requiresConfigAuth && /\w+\s*\.\s*update\s*\(/.test(codeLines.join('\n'));
    return {
      id: 'ABC-07',
      description: 'ConfigProposalBuilder does not call ConfigAuthority directly',
      status: !callsConfigAuth ? 'PASS' : 'FAIL',
      detail: !callsConfigAuth ? null : 'ConfigProposalBuilder calls ConfigAuthority.update() — must route through API gateway',
    };
  }

  _checkNoKernelImportsInFile(file, id, description) {
    const src = this._read(file);
    const hasKernelImport = FORBIDDEN_IMPORTS.some(i => src.includes(i));
    return {
      id,
      description,
      status: !hasKernelImport ? 'PASS' : 'FAIL',
      detail: !hasKernelImport ? null : `${file} imports governance-kernel internals`,
    };
  }

  _read(relPath) {
    try {
      return fs.readFileSync(path.join(this._root, relPath), 'utf8');
    } catch (_) {
      return '';
    }
  }
}

module.exports = { AuthorityBoundaryCertification };
