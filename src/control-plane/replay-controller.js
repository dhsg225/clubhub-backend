'use strict';
const { buildResponse } = require('./api-contracts');

class ReplayController {
  constructor({ replayOrchestrator, tenantRegistry }) {
    this._replay   = replayOrchestrator;
    this._registry = tenantRegistry;
  }

  async replayWorkflow(tenantId, workflowId) {
    this._assertTenant(tenantId);
    const result = await this._replay.replayWorkflow(workflowId, { tenant_id: tenantId });
    return buildResponse(true, result);
  }

  async replayDecision(tenantId, agentId) {
    this._assertTenant(tenantId);
    const result = await this._replay.replayDecisionChain(agentId, { tenant_id: tenantId });
    return buildResponse(true, result);
  }

  listSessions(tenantId) {
    const sessions = this._replay.getActiveSessions().filter(s =>
      !s.opts?.tenant_id || s.opts.tenant_id === tenantId
    );
    return buildResponse(true, sessions);
  }

  _assertTenant(tenantId) {
    if (!this._registry.get(tenantId)) throw new Error(`unknown tenant: ${tenantId}`);
  }
}

module.exports = { ReplayController };
