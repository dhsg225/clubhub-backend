'use strict';
/**
 * OTARuntimeCertification — verifies governed-* modules route through kernel APIs.
 *
 * Checks:
 *   ORC-01: governed-deployment.js uses AuthorityCoordinator for epoch operations
 *   ORC-02: governed-deployment.js uses FreezeController for freeze/unfreeze
 *   ORC-03: governed-incidents.js uses IncidentManager
 *   ORC-04: governed-config.js uses ConfigAuthority, not lib/governed-config directly
 *   ORC-05: governed-operators.js uses OperatorAuthority.requireAuth
 *   ORC-06: governed-deployment.js appends to AuditLedger on transitions
 *   ORC-07: governed-incidents.js appends to AuditLedger on create/transition
 *   ORC-08: governed-config.js appends to AuditLedger on update
 */

const fs   = require('fs');
const path = require('path');

class OTARuntimeCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [
      this._checkDeploymentUsesAuthorityCoordinator(),
      this._checkDeploymentUsesFreezeController(),
      this._checkIncidentsUsesIncidentManager(),
      this._checkConfigUsesConfigAuthority(),
      this._checkOperatorsUsesOperatorAuthority(),
      this._checkDeploymentAppendsLedger(),
      this._checkIncidentsAppendsLedger(),
      this._checkConfigAppendsLedger(),
    ];

    return this._buildResult('OTARuntimeCertification', checks);
  }

  _checkDeploymentUsesAuthorityCoordinator() {
    const src = this._read('governed-deployment.js');
    const usesCoordinator =
      src.includes('authorityCoordinator') &&
      src.includes('incrementEpoch') &&
      src.includes('getEpoch');
    return {
      id: 'ORC-01',
      description: 'governed-deployment uses AuthorityCoordinator for epoch operations',
      status: usesCoordinator ? 'PASS' : 'FAIL',
      detail: usesCoordinator ? null : 'governed-deployment.js does not use AuthorityCoordinator for epoch management',
    };
  }

  _checkDeploymentUsesFreezeController() {
    const src = this._read('governed-deployment.js');
    const usesFreezeCtrl =
      src.includes('freezeController') &&
      src.includes('freeze') &&
      src.includes('unfreeze') &&
      src.includes('isFrozen');
    return {
      id: 'ORC-02',
      description: 'governed-deployment uses FreezeController for freeze/unfreeze',
      status: usesFreezeCtrl ? 'PASS' : 'FAIL',
      detail: usesFreezeCtrl ? null : 'governed-deployment.js does not use FreezeController',
    };
  }

  _checkIncidentsUsesIncidentManager() {
    const src = this._read('governed-incidents.js');
    const usesIM =
      src.includes('incidentManager') &&
      src.includes('create') &&
      src.includes('transition') &&
      src.includes('archive');
    return {
      id: 'ORC-03',
      description: 'governed-incidents uses kernel IncidentManager',
      status: usesIM ? 'PASS' : 'FAIL',
      detail: usesIM ? null : 'governed-incidents.js does not delegate to IncidentManager',
    };
  }

  _checkConfigUsesConfigAuthority() {
    const src = this._read('governed-config.js');
    const usesCA = src.includes('configAuthority');
    // Must NOT bypass to lib/governed-config directly
    const noDirectLib = !src.includes("require('../../lib/governed-config'") &&
                        !src.includes('require("../../lib/governed-config"');
    return {
      id: 'ORC-04',
      description: 'governed-config uses ConfigAuthority, not lib/governed-config directly',
      status: (usesCA && noDirectLib) ? 'PASS' : 'FAIL',
      detail: (usesCA && noDirectLib) ? null :
        !usesCA ? 'governed-config.js does not use configAuthority' :
        'governed-config.js imports lib/governed-config directly — authority bypass',
    };
  }

  _checkOperatorsUsesOperatorAuthority() {
    const src = this._read('governed-operators.js');
    const usesOA =
      src.includes('operatorAuthority') &&
      src.includes('requireAuth') &&
      src.includes('issueToken') &&
      src.includes('verifyToken');
    return {
      id: 'ORC-05',
      description: 'governed-operators uses OperatorAuthority.requireAuth',
      status: usesOA ? 'PASS' : 'FAIL',
      detail: usesOA ? null : 'governed-operators.js does not delegate to OperatorAuthority',
    };
  }

  _checkDeploymentAppendsLedger() {
    const src = this._read('governed-deployment.js');
    const appendsLedger =
      src.includes('auditLedger') &&
      src.includes('appendEntry') &&
      src.includes('deployment_wave_promoted') &&
      src.includes('deployment_frozen');
    return {
      id: 'ORC-06',
      description: 'governed-deployment appends AuditLedger on transitions',
      status: appendsLedger ? 'PASS' : 'FAIL',
      detail: appendsLedger ? null : 'governed-deployment.js missing AuditLedger entries on transitions',
    };
  }

  _checkIncidentsAppendsLedger() {
    const src = this._read('governed-incidents.js');
    const appendsLedger =
      src.includes('auditLedger') &&
      src.includes('incident_created') &&
      src.includes('incident_transitioned');
    return {
      id: 'ORC-07',
      description: 'governed-incidents appends AuditLedger on create/transition',
      status: appendsLedger ? 'PASS' : 'FAIL',
      detail: appendsLedger ? null : 'governed-incidents.js missing AuditLedger entries',
    };
  }

  _checkConfigAppendsLedger() {
    const src = this._read('governed-config.js');
    const appendsLedger =
      src.includes('auditLedger') &&
      src.includes('config_changed');
    return {
      id: 'ORC-08',
      description: 'governed-config appends AuditLedger on update',
      status: appendsLedger ? 'PASS' : 'FAIL',
      detail: appendsLedger ? null : 'governed-config.js does not append AuditLedger on config.update()',
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

module.exports = { OTARuntimeCertification };
