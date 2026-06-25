'use strict';
/**
 * TenantHealth — per-tenant health tracking.
 */

const TENANT_HEALTH_STATUS = Object.freeze({
  HEALTHY:  'HEALTHY',
  DEGRADED: 'DEGRADED',
  FROZEN:   'FROZEN',
  UNKNOWN:  'UNKNOWN',
});

class TenantHealth {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this._checks  = new Map();
  }

  recordCheck(dimension, status, detail = null) {
    this._checks.set(dimension, { dimension, status, detail, ts: Date.now() });
  }

  overallStatus() {
    if (this._checks.size === 0) return TENANT_HEALTH_STATUS.UNKNOWN;
    const statuses = [...this._checks.values()].map(c => c.status);
    if (statuses.some(s => s === TENANT_HEALTH_STATUS.FROZEN))   return TENANT_HEALTH_STATUS.FROZEN;
    if (statuses.some(s => s === TENANT_HEALTH_STATUS.DEGRADED)) return TENANT_HEALTH_STATUS.DEGRADED;
    if (statuses.every(s => s === TENANT_HEALTH_STATUS.HEALTHY)) return TENANT_HEALTH_STATUS.HEALTHY;
    return TENANT_HEALTH_STATUS.UNKNOWN;
  }

  snapshot() {
    const checks = {};
    for (const [d, c] of this._checks) checks[d] = c;
    return { tenant_id: this.tenantId, overall: this.overallStatus(), checks };
  }
}

module.exports = { TenantHealth, TENANT_HEALTH_STATUS };
