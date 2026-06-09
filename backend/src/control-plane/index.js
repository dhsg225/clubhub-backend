'use strict';
const { ControlPlaneServer }        = require('./control-plane-server');
const { AuthGateway, OPERATOR_ROLES, ROLE_PERMISSIONS } = require('./auth-gateway');
const { RateLimiter, DEFAULT_LIMITS } = require('./rate-limiter');
const { RequestLineage }             = require('./request-lineage');
const { TenantController }           = require('./tenant-controller');
const { DeploymentController }       = require('./deployment-controller');
const { ReplayController }           = require('./replay-controller');
const { TopologyController }         = require('./topology-controller');
const { IncidentController }         = require('./incident-controller');
const { PolicyController }           = require('./policy-controller');
const { CertificationController }    = require('./certification-controller');
const { validateRequest, buildResponse, CONTROL_PLANE_ACTIONS, APIContractError } = require('./api-contracts');

function createControlPlane(deps = {}) {
  return new ControlPlaneServer(deps);
}

module.exports = {
  createControlPlane,
  ControlPlaneServer,
  AuthGateway,
  RateLimiter,
  RequestLineage,
  TenantController,
  DeploymentController,
  ReplayController,
  TopologyController,
  IncidentController,
  PolicyController,
  CertificationController,
  OPERATOR_ROLES,
  ROLE_PERMISSIONS,
  DEFAULT_LIMITS,
  CONTROL_PLANE_ACTIONS,
  validateRequest,
  buildResponse,
  APIContractError,
};
