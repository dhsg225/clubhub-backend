'use strict';
/**
 * api-contracts.js — request/response contracts for the external control plane.
 * All external inputs validated here before entering the system.
 */

const CONTROL_PLANE_ACTIONS = Object.freeze({
  FREEZE:               'FREEZE',
  UNFREEZE:             'UNFREEZE',
  PROMOTE_WAVE:         'PROMOTE_WAVE',
  ROLLBACK_DEPLOYMENT:  'ROLLBACK_DEPLOYMENT',
  COMPLETE_DEPLOYMENT:  'COMPLETE_DEPLOYMENT',
  CREATE_INCIDENT:      'CREATE_INCIDENT',
  TRANSITION_INCIDENT:  'TRANSITION_INCIDENT',
  ARCHIVE_INCIDENT:     'ARCHIVE_INCIDENT',
  UPDATE_CONFIG:        'UPDATE_CONFIG',
  APPEND_AUDIT:         'APPEND_AUDIT',
  INCREMENT_EPOCH:      'INCREMENT_EPOCH',
  APPROVE_AI_OPERATOR:  'APPROVE_AI_OPERATOR',
});

const REQUEST_FIELDS = Object.freeze({
  required: ['action_type', 'args'],
  optional: ['correlation_id', 'tenant_id', 'operator_id', 'lineage_ts', 'policy_overrides'],
});

class APIContractError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'APIContractError';
    this.field = field;
  }
}

function validateRequest(req) {
  if (!req || typeof req !== 'object') throw new APIContractError('request must be object', 'request');
  for (const f of REQUEST_FIELDS.required) {
    if (req[f] === undefined || req[f] === null) throw new APIContractError(`missing required field: ${f}`, f);
  }
  if (!Object.values(CONTROL_PLANE_ACTIONS).includes(req.action_type)) {
    throw new APIContractError(`unknown action_type: ${req.action_type}`, 'action_type');
  }
  if (typeof req.args !== 'object') throw new APIContractError('args must be object', 'args');
  return true;
}

function buildResponse(ok, data, meta = {}) {
  return { ok, data: ok ? data : null, error: ok ? null : data, meta };
}

module.exports = { CONTROL_PLANE_ACTIONS, validateRequest, buildResponse, APIContractError, REQUEST_FIELDS };
