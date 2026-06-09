'use strict';
/**
 * governance-sdk/actions.js
 *
 * ACTIONS map: SDK action type → kernel API + consistency level + replay rules.
 * This is the canonical surface definition for all SDK-callable operations.
 */

const { CONSISTENCY_LEVELS, ACTION_TYPES } = require('./types');

// ACTIONS: maps each SDK action type to the kernel API it delegates to
const ACTIONS = Object.freeze({
  [ACTION_TYPES.FREEZE]: {
    api:           'freezeController',
    method:        'freeze',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
  [ACTION_TYPES.UNFREEZE]: {
    api:           'freezeController',
    method:        'unfreeze',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
  [ACTION_TYPES.PROMOTE_WAVE]: {
    api:           'authorityCoordinator',
    method:        'incrementEpoch',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
  [ACTION_TYPES.COMPLETE_DEPLOYMENT]: {
    api:           'deploymentRuntime',
    method:        'markComplete',
    consistency:   CONSISTENCY_LEVELS.DB_AUTHORITATIVE,
    requiresPool:  false,
    replayBlocked: true,
  },
  [ACTION_TYPES.ROLLBACK_DEPLOYMENT]: {
    api:           'deploymentRuntime',
    method:        'markRolledBack',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
  [ACTION_TYPES.CREATE_INCIDENT]: {
    api:           'incidentManager',
    method:        'create',
    consistency:   CONSISTENCY_LEVELS.DB_AUTHORITATIVE,
    requiresPool:  false,
    replayBlocked: true,
  },
  [ACTION_TYPES.TRANSITION_INCIDENT]: {
    api:           'incidentManager',
    method:        'transition',
    consistency:   CONSISTENCY_LEVELS.DB_AUTHORITATIVE,
    requiresPool:  false,
    replayBlocked: true,
  },
  [ACTION_TYPES.ARCHIVE_INCIDENT]: {
    api:           'incidentManager',
    method:        'archive',
    consistency:   CONSISTENCY_LEVELS.DB_AUTHORITATIVE,
    requiresPool:  false,
    replayBlocked: true,
  },
  [ACTION_TYPES.UPDATE_CONFIG]: {
    api:           'configAuthority',
    method:        'update',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
  [ACTION_TYPES.APPEND_AUDIT]: {
    api:           'auditLedger',
    method:        'appendEntry',
    consistency:   CONSISTENCY_LEVELS.DB_AUTHORITATIVE,
    requiresPool:  false,
    replayBlocked: false,  // audit reads allowed in replay
  },
  [ACTION_TYPES.INCREMENT_EPOCH]: {
    api:           'authorityCoordinator',
    method:        'incrementEpoch',
    consistency:   CONSISTENCY_LEVELS.LINEARIZED,
    requiresPool:  true,
    replayBlocked: true,
  },
});

module.exports = { ACTIONS };
