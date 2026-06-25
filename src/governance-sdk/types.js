'use strict';
/**
 * governance-sdk/types.js
 *
 * Shared constants for the Governance SDK.
 * Mirrors kernel consistency levels — no new semantics introduced.
 */

const CONSISTENCY_LEVELS = Object.freeze({
  MEMORY_ONLY:      'MEMORY_ONLY',
  CACHE_COHERENT:   'CACHE_COHERENT',
  DB_AUTHORITATIVE: 'DB_AUTHORITATIVE',
  LINEARIZED:       'LINEARIZED',
});

const ACTION_TYPES = Object.freeze({
  FREEZE:               'deployment.freeze',
  UNFREEZE:             'deployment.unfreeze',
  PROMOTE_WAVE:         'deployment.promoteWave',
  COMPLETE_DEPLOYMENT:  'deployment.complete',
  ROLLBACK_DEPLOYMENT:  'deployment.rollback',
  CREATE_INCIDENT:      'incident.create',
  TRANSITION_INCIDENT:  'incident.transition',
  ARCHIVE_INCIDENT:     'incident.archive',
  UPDATE_CONFIG:        'config.update',
  APPEND_AUDIT:         'audit.append',
  INCREMENT_EPOCH:      'authority.incrementEpoch',
});

const WORKFLOW_STATUS = Object.freeze({
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  REPLAYING: 'REPLAYING',
  CANCELLED: 'CANCELLED',
});

module.exports = { CONSISTENCY_LEVELS, ACTION_TYPES, WORKFLOW_STATUS };
