'use strict';
const { AdminRuntime }       = require('./admin-runtime');
const { AdminAudit }         = require('./admin-audit');
const { AdminActions, ADMIN_ACTIONS } = require('./admin-actions');
const { AdminDiagnostics }   = require('./admin-diagnostics');
const { AdminRecovery, RECOVERY_TYPES } = require('./admin-recovery');
const { AdminCertification } = require('./admin-certification');
const { AdminTopology }      = require('./admin-topology');

function createAdminRuntime(deps = {}) { return new AdminRuntime(deps); }

module.exports = {
  createAdminRuntime,
  AdminRuntime,
  AdminAudit,
  AdminActions,
  AdminDiagnostics,
  AdminRecovery,
  AdminCertification,
  AdminTopology,
  ADMIN_ACTIONS,
  RECOVERY_TYPES,
};
