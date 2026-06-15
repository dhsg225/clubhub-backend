'use strict';
/**
 * ExportAuthPolicy — authorization policies for observability exports.
 */

const EXPORT_POLICIES = Object.freeze([
  {
    id:         'export_requires_viewer',
    name:       'export_requires_at_least_viewer',
    priority:   100,
    action:     'deny',
    reason:     'unauthenticated_export_denied',
    conditions: [{ field: 'authenticated', op: 'falsy' }],
  },
  {
    id:         'export_allow_authenticated',
    name:       'allow_authenticated_export',
    priority:   1,
    action:     'allow',
    reason:     'authenticated_export',
    conditions: [],
  },
]);

module.exports = { EXPORT_POLICIES };
