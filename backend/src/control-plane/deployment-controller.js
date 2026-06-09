'use strict';
const { CONTROL_PLANE_ACTIONS, buildResponse } = require('./api-contracts');

class DeploymentController {
  constructor({ executionRouter, traceStore }) {
    this._router     = executionRouter;
    this._traceStore = traceStore ?? null;
  }

  async promoteWave(tenantId, waveId, operatorId, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.PROMOTE_WAVE,
      { wave_id: waveId, tenant_id: tenantId },
      { correlation_id: `promote_${waveId}_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }

  async rollback(tenantId, deploymentId, operatorId, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.ROLLBACK_DEPLOYMENT,
      { deployment_id: deploymentId, tenant_id: tenantId },
      { correlation_id: `rollback_${deploymentId}_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }

  async complete(tenantId, deploymentId, operatorId, lineage_ts) {
    const result = await this._router.route('OPERATOR', CONTROL_PLANE_ACTIONS.COMPLETE_DEPLOYMENT,
      { deployment_id: deploymentId, tenant_id: tenantId },
      { correlation_id: `complete_${deploymentId}_${lineage_ts}`, lineage_ts });
    return buildResponse(result.ok, result);
  }
}

module.exports = { DeploymentController };
