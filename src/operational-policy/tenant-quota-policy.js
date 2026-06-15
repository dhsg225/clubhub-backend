'use strict';
/**
 * TenantQuotaPolicy — per-tenant quota enforcement policies.
 */

const DEFAULT_QUOTAS = Object.freeze({
  max_workflows_per_hour: 100,
  max_replays_per_day:    50,
  max_incidents_open:     20,
});

class TenantQuotaPolicy {
  constructor(tenantId, quotas = {}) {
    this.tenantId = tenantId;
    this._quotas  = { ...DEFAULT_QUOTAS, ...quotas };
    this._counters= { workflows: 0, replays: 0, incidents: 0 };
  }

  checkWorkflow() {
    if (this._counters.workflows >= this._quotas.max_workflows_per_hour)
      return { ok: false, reason: 'WORKFLOW_QUOTA_EXCEEDED', tenant_id: this.tenantId };
    return { ok: true };
  }

  checkReplay() {
    if (this._counters.replays >= this._quotas.max_replays_per_day)
      return { ok: false, reason: 'REPLAY_QUOTA_EXCEEDED', tenant_id: this.tenantId };
    return { ok: true };
  }

  recordWorkflow() { this._counters.workflows++; }
  recordReplay()   { this._counters.replays++; }
  recordIncident() { this._counters.incidents++; }

  snapshot() {
    return { tenant_id: this.tenantId, quotas: this._quotas, counters: { ...this._counters } };
  }
}

module.exports = { TenantQuotaPolicy, DEFAULT_QUOTAS };
