'use strict';
/**
 * TenantRegistry — canonical registration of all tenants.
 * Each tenant has isolated context: replay sessions, traces, topology views, policies.
 */

class TenantEntry {
  constructor(id, attrs = {}) {
    this.id          = id;
    this.attrs       = attrs;
    this.created_at  = Date.now();
    this.state       = 'ACTIVE';
    this._replays    = [];
    this._traces     = [];
    this._policies   = [];
  }

  snapshot() {
    return {
      id:         this.id,
      attrs:      this.attrs,
      state:      this.state,
      created_at: this.created_at,
      replay_count: this._replays.length,
      trace_count:  this._traces.length,
      policy_count: this._policies.length,
    };
  }

  addReplay(sessionId) { this._replays.push(sessionId); }
  addTrace(traceId)    { this._traces.push(traceId); }
  addPolicy(policyId)  { this._policies.push(policyId); }

  getReplays()  { return [...this._replays]; }
  getTraces()   { return [...this._traces]; }
  getPolicies() { return [...this._policies]; }
}

class TenantRegistry {
  constructor() {
    this._tenants = new Map();
  }

  register(id, attrs = {}) {
    if (this._tenants.has(id)) throw new Error(`TenantRegistry: '${id}' already registered`);
    const entry = new TenantEntry(id, attrs);
    this._tenants.set(id, entry);
    return entry;
  }

  get(id) { return this._tenants.get(id) ?? null; }

  deregister(id) {
    if (!this._tenants.has(id)) return false;
    this._tenants.delete(id);
    return true;
  }

  snapshot() {
    const tenants = {};
    for (const [id, entry] of this._tenants) tenants[id] = entry.snapshot();
    return { tenant_count: this._tenants.size, tenants };
  }

  list() { return [...this._tenants.values()].map(e => e.snapshot()); }
}

module.exports = { TenantRegistry, TenantEntry };
