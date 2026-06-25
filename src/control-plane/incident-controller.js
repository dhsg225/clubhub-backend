'use strict';
const { CONTROL_PLANE_ACTIONS, buildResponse } = require('./api-contracts');

class IncidentController {
  constructor({ executionRouter }) {
    this._router = executionRouter;
  }

  async create(tenantId, incidentData, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.CREATE_INCIDENT,
      { ...incidentData, tenant_id: tenantId },
      { correlation_id: `inc_create_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }

  async transition(tenantId, incidentId, toState, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.TRANSITION_INCIDENT,
      { incident_id: incidentId, to_state: toState, tenant_id: tenantId },
      { correlation_id: `inc_transition_${incidentId}_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }

  async archive(tenantId, incidentId, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.ARCHIVE_INCIDENT,
      { incident_id: incidentId, tenant_id: tenantId },
      { correlation_id: `inc_archive_${incidentId}_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }
}

module.exports = { IncidentController };
