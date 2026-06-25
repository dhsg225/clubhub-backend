'use strict';
/**
 * governance-sdk/index.js
 *
 * Factory + exports for the Governance SDK.
 *
 * All modules receive kernel deps via dependency injection.
 * No module imports governance-kernel/core/ directly.
 * No module constructs new Pool() — pool is always injected.
 */

const { GovernanceSDKClient }                              = require('./client');
const { WorkflowEngine }                                   = require('./workflows');
const { GovernanceAgent }                                  = require('./agent');
const { ReplayClient }                                     = require('./replay-client');
const { validateAction, validateWorkflow, SDKValidationError } = require('./validation');
const { CONSISTENCY_LEVELS, ACTION_TYPES, WORKFLOW_STATUS }  = require('./types');
const { ACTIONS }                                          = require('./actions');

/**
 * createGovernanceSDK(kernelDeps)
 *
 * Wire all SDK modules from injected governance kernel dependencies.
 *
 * kernelDeps shape:
 *   { authorityCoordinator, freezeController, incidentManager,
 *     configAuthority, operatorAuthority, auditLedger, eventBus,
 *     pool, replayHooks? }
 */
function createGovernanceSDK(kernelDeps) {
  const sdkClient      = new GovernanceSDKClient(kernelDeps);
  const workflowEngine = new WorkflowEngine({ sdkClient, eventBus: kernelDeps.eventBus });
  const agent          = new GovernanceAgent({
    workflowEngine,
    sdkClient,
    replayHooks: kernelDeps.replayHooks ?? null,
    eventBus:    kernelDeps.eventBus,
  });
  const replayClient   = new ReplayClient({
    sdkClient,
    replayHooks: kernelDeps.replayHooks,
    eventBus:    kernelDeps.eventBus,
  });

  return {
    client:         sdkClient,
    workflowEngine,
    agent,
    replayClient,
    // Validation utilities exposed for caller use
    validateAction,
    validateWorkflow,
  };
}

module.exports = {
  createGovernanceSDK,
  GovernanceSDKClient,
  WorkflowEngine,
  GovernanceAgent,
  ReplayClient,
  SDKValidationError,
  CONSISTENCY_LEVELS,
  ACTION_TYPES,
  WORKFLOW_STATUS,
  ACTIONS,
};
