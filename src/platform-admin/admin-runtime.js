'use strict';
/**
 * AdminRuntime — central admin coordinator.
 * Owns all admin subsystems.
 */

const { AdminAudit }         = require('./admin-audit');
const { AdminActions }       = require('./admin-actions');
const { AdminDiagnostics }   = require('./admin-diagnostics');
const { AdminRecovery }      = require('./admin-recovery');
const { AdminCertification } = require('./admin-certification');
const { AdminTopology }      = require('./admin-topology');

class AdminRuntime {
  constructor(deps = {}) {
    this._audit       = new AdminAudit();
    this.actions      = new AdminActions({ ...deps, adminAudit: this._audit });
    this.diagnostics  = new AdminDiagnostics(deps);
    this.recovery     = new AdminRecovery({ ...deps, adminAudit: this._audit });
    this.certification= new AdminCertification({ ...deps, adminAudit: this._audit });
    this.topology     = new AdminTopology({ ...deps, adminAudit: this._audit });
    this.audit        = this._audit;
  }

  snapshot() {
    return {
      audit_entries: this._audit.getEntries().length,
      diagnostics:   this.diagnostics.runDiagnostics(),
    };
  }
}

module.exports = { AdminRuntime };
