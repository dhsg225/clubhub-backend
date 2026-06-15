'use strict';
const { buildResponse } = require('./api-contracts');

class PolicyController {
  constructor({ policyEngine, operationalPolicy }) {
    this._engine   = policyEngine       ?? null;
    this._opPolicy = operationalPolicy  ?? null;
  }

  listPolicies(tenantId) {
    if (!this._engine) return buildResponse(false, 'policy engine not configured');
    const policies = this._engine.getPolicies().filter(p =>
      !p.tenant_id || p.tenant_id === tenantId
    );
    return buildResponse(true, { policies, count: policies.length });
  }

  getPolicy(policyId) {
    if (!this._engine) return buildResponse(false, 'policy engine not configured');
    const p = this._engine.getPolicies().find(p => p.id === policyId);
    if (!p) return buildResponse(false, `policy '${policyId}' not found`);
    return buildResponse(true, p);
  }

  evaluateDryRun(context, proposedAction) {
    if (!this._engine) return buildResponse(false, 'policy engine not configured');
    const result = this._engine.evaluate(context, proposedAction);
    return buildResponse(true, result);
  }
}

module.exports = { PolicyController };
