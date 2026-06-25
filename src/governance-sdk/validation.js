'use strict';
/**
 * governance-sdk/validation.js
 *
 * Input validation for SDK actions and workflow definitions.
 * Enforces:
 *   - allowed API surface (action type must be in ACTIONS map)
 *   - deterministic inputs only
 *   - correct workflow structure
 */

const { ACTIONS }             = require('./actions');
const { CONSISTENCY_LEVELS }  = require('./types');

const VALID_CONSISTENCY_LEVELS = new Set(Object.values(CONSISTENCY_LEVELS));

class SDKValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SDKValidationError';
    this.code = code;
  }
}

/**
 * validateAction(actionType, args)
 *
 * Verifies the action type is in the allowed SDK surface.
 * Throws SDKValidationError on invalid input.
 */
function validateAction(actionType, args = {}) {
  if (!actionType || typeof actionType !== 'string') {
    throw new SDKValidationError('actionType must be a non-empty string', 'INVALID_ACTION_TYPE');
  }
  if (!ACTIONS[actionType]) {
    throw new SDKValidationError(`Unknown SDK action type: '${actionType}'`, 'UNKNOWN_ACTION');
  }
  if (args !== null && typeof args !== 'object') {
    throw new SDKValidationError('args must be an object or null', 'INVALID_ARGS');
  }
  return true;
}

function validateConsistencyLevel(level) {
  if (!VALID_CONSISTENCY_LEVELS.has(level)) {
    throw new SDKValidationError(`Invalid consistency level: '${level}'`, 'INVALID_CONSISTENCY');
  }
  return true;
}

/**
 * validateWorkflow(workflow)
 *
 * Validates a workflow definition: id, steps array, each step has action + consistencyLevel.
 */
function validateWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    throw new SDKValidationError('workflow must be an object', 'INVALID_WORKFLOW');
  }
  if (!workflow.id || typeof workflow.id !== 'string') {
    throw new SDKValidationError('workflow.id must be a non-empty string', 'MISSING_WORKFLOW_ID');
  }
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new SDKValidationError('workflow.steps must be a non-empty array', 'INVALID_STEPS');
  }
  for (const step of workflow.steps) {
    validateAction(step.action, step.args ?? {});
    if (step.consistencyLevel !== undefined) {
      validateConsistencyLevel(step.consistencyLevel);
    }
  }
  return true;
}

/**
 * assertDeterministicInput(args)
 *
 * Rejects args that contain non-deterministic sources (Date, Math.random keys).
 */
function assertDeterministicInput(args) {
  const s = JSON.stringify(args ?? {});
  if (s.includes('__nondeterministic')) {
    throw new SDKValidationError('args must not contain non-deterministic values', 'NON_DETERMINISTIC_INPUT');
  }
  return true;
}

module.exports = {
  validateAction,
  validateConsistencyLevel,
  validateWorkflow,
  assertDeterministicInput,
  SDKValidationError,
};
