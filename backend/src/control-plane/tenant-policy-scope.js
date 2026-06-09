'use strict';
/**
 * TenantPolicyScope — tenant-scoped policy filtering and enforcement.
 */

class TenantPolicyScope {
  constructor(tenantId, policyEngine) {
    this.tenantId = tenantId;
    this._engine  = policyEngine;
    this._overrides = [];
  }

  getPolicies() {
    if (!this._engine) return [];
    return this._engine.getPolicies().filter(p =>
      !p.tenant_id || p.tenant_id === this.tenantId
    );
  }

  addOverride(policy) {
    this._overrides.push({ ...policy, tenant_id: this.tenantId });
    if (this._engine) this._engine.addPolicy({ ...policy, tenant_id: this.tenantId });
  }

  evaluate(context, proposedAction) {
    if (!this._engine) return { result: 'APPROVED', reason: 'no_engine', policy_id: null };
    const tenantContext = { ...context, tenant_id: this.tenantId };
    return this._engine.evaluate(tenantContext, proposedAction);
  }

  snapshot() {
    return {
      tenant_id: this.tenantId,
      policy_count:   this.getPolicies().length,
      override_count: this._overrides.length,
    };
  }
}

module.exports = { TenantPolicyScope };
