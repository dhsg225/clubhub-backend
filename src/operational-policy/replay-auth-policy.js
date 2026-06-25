'use strict';
/**
 * ReplayAuthPolicy — authorization policies for replay operations.
 */

const REPLAY_POLICIES = Object.freeze([
  {
    id:         'replay_requires_operator',
    name:       'replay_requires_operator_role',
    priority:   100,
    action:     'deny',
    reason:     'replay_requires_operator_or_admin',
    conditions: [{ field: 'role', op: 'eq', value: 'VIEWER' }],
  },
  {
    id:         'replay_allow_operator',
    name:       'allow_operator_replay',
    priority:   1,
    action:     'allow',
    reason:     'authorized_replay',
    conditions: [],
  },
]);

module.exports = { REPLAY_POLICIES };
