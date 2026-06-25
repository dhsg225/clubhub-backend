'use strict';
// A9 runners
const { PlatformLifecycleCertification }    = require('./PlatformLifecycleCertification');
const { ReplayConvergenceCertification }    = require('./ReplayConvergenceCertification');
const { ExecutionPathCertification }        = require('./ExecutionPathCertification');
const { TracePropagationCertification }     = require('./TracePropagationCertification');
const { TopologyConsistencyCertification }  = require('./TopologyConsistencyCertification');
const { DeterministicBootstrapCertification } = require('./DeterministicBootstrapCertification');
const { ConvergenceIntegrityCertification } = require('./ConvergenceIntegrityCertification');
// A10 runners
const { ControlPlaneCertification }         = require('./ControlPlaneCertification');
const { TenantIsolationCertification }      = require('./TenantIsolationCertification');
const { DeploymentPackagingCertification }  = require('./DeploymentPackagingCertification');
const { AdminGovernanceCertification }      = require('./AdminGovernanceCertification');
const { ObservabilityExportCertification }  = require('./ObservabilityExportCertification');
const { ReplayPackageCertification }        = require('./ReplayPackageCertification');
const { OperationalPolicyCertification }    = require('./OperationalPolicyCertification');
const { ProductionReadinessCertification }  = require('./ProductionReadinessCertification');

module.exports = {
  // A9
  PlatformLifecycleCertification,
  ReplayConvergenceCertification,
  ExecutionPathCertification,
  TracePropagationCertification,
  TopologyConsistencyCertification,
  DeterministicBootstrapCertification,
  ConvergenceIntegrityCertification,
  // A10
  ControlPlaneCertification,
  TenantIsolationCertification,
  DeploymentPackagingCertification,
  AdminGovernanceCertification,
  ObservabilityExportCertification,
  ReplayPackageCertification,
  OperationalPolicyCertification,
  ProductionReadinessCertification,
};
