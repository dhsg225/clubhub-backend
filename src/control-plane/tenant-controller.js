'use strict';
const { buildResponse } = require('./api-contracts');

class TenantController {
  constructor({ tenantRegistry, topology }) {
    this._registry = tenantRegistry;
    this._topology = topology ?? null;
  }

  createTenant(tenantId, attrs = {}) {
    const tenant = this._registry.register(tenantId, attrs);
    if (this._topology) this._topology.register(tenantId, 'NODE', { tenant: true, ...attrs });
    return buildResponse(true, tenant);
  }

  getTenant(tenantId) {
    const tenant = this._registry.get(tenantId);
    if (!tenant) return buildResponse(false, `tenant '${tenantId}' not found`);
    return buildResponse(true, tenant.snapshot());
  }

  listTenants() {
    return buildResponse(true, this._registry.snapshot());
  }

  getHealth(tenantId) {
    const tenant = this._registry.get(tenantId);
    if (!tenant) return buildResponse(false, `tenant '${tenantId}' not found`);
    return buildResponse(true, tenant.health?.snapshot() ?? { overall: 'UNKNOWN' });
  }
}

module.exports = { TenantController };
