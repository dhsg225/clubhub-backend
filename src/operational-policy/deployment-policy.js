'use strict';
/**
 * DeploymentPolicy — policies governing deployment operations.
 */

const DEPLOYMENT_POLICIES = Object.freeze([
  {
    id:         'dep_freeze_blocks_promote',
    name:       'freeze_blocks_promote',
    priority:   100,
    action:     'deny',
    reason:     'platform_frozen',
    conditions: [{ field: 'frozen', op: 'truthy' }],
  },
  {
    id:         'dep_require_epoch_increment',
    name:       'require_epoch_for_major',
    priority:   90,
    action:     'require_approval',
    reason:     'major_deployment_requires_epoch',
    conditions: [{ field: 'deployment_type', op: 'eq', value: 'MAJOR' }],
  },
  {
    id:         'dep_allow_standard',
    name:       'allow_standard_deployment',
    priority:   1,
    action:     'allow',
    reason:     'standard_deployment',
    conditions: [],
  },
]);

module.exports = { DEPLOYMENT_POLICIES };
