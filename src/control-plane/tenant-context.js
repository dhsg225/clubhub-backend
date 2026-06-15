'use strict';
/**
 * TenantContext — scoped operational context for a single tenant.
 * Replay sessions, topology views, and event streams are tenant-isolated.
 */

class TenantContext {
  constructor(tenantId, opts = {}) {
    this.tenantId         = tenantId;
    this._eventNamespace  = `tenant.${tenantId}`;
    this._replaySessions  = new Map();
    this._policyOverrides = new Map();
    this._frozen          = false;
    this._seq             = 0;
  }

  namespace(eventType) { return `${this._eventNamespace}.${eventType}`; }

  startReplay(type, opts = {}) {
    const session_id = `${this.tenantId}_replay_${++this._seq}`;
    const session    = { session_id, type, tenant_id: this.tenantId, started_at: Date.now(), opts, status: 'RUNNING' };
    this._replaySessions.set(session_id, session);
    return session;
  }

  completeReplay(session_id, results) {
    const s = this._replaySessions.get(session_id);
    if (!s) return null;
    s.status   = 'COMPLETE';
    s.results  = results;
    s.ended_at = Date.now();
    return s;
  }

  freeze()   { this._frozen = true; }
  unfreeze() { this._frozen = false; }
  isFrozen() { return this._frozen; }

  setPolicyOverride(key, value) { this._policyOverrides.set(key, value); }
  getPolicyOverride(key)        { return this._policyOverrides.get(key); }

  snapshot() {
    return {
      tenant_id:       this.tenantId,
      frozen:          this._frozen,
      active_replays:  [...this._replaySessions.values()].filter(s => s.status === 'RUNNING').length,
      total_replays:   this._replaySessions.size,
      policy_overrides: this._policyOverrides.size,
    };
  }
}

module.exports = { TenantContext };
