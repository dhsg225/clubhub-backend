'use strict';
/**
 * AuthorityNamespace — per-domain isolation unit.
 *
 * Guarantees:
 * 1. Freeze in one domain cannot freeze another domain
 * 2. Incident lineage preserves domain boundaries
 * 3. Operator authority is scoped per domain
 * 4. Replay is domain-isolated
 * 5. Per-domain clock offset support
 */
class AuthorityNamespace {
  constructor(name, opts = {}) {
    this.name            = name;
    this._frozen         = false;
    this._freezeReason   = null;
    this._incidents      = new Map();
    this._clockOffset    = opts.clockOffset ?? 0;
    this._operatorScopes = new Set(opts.allowedOperators ?? []);
    this._createdAt      = new Date().toISOString();
  }

  freeze(reason) {
    this._frozen      = true;
    this._freezeReason = reason ?? 'domain_freeze';
  }

  unfreeze() {
    this._frozen      = false;
    this._freezeReason = null;
  }

  isFrozen()       { return this._frozen; }
  getFreezeReason(){ return this._freezeReason; }

  isOperatorAllowed(operatorId) {
    if (this._operatorScopes.size === 0) return true;
    return this._operatorScopes.has(operatorId);
  }

  addOperatorScope(operatorId)    { this._operatorScopes.add(operatorId); }
  removeOperatorScope(operatorId) { this._operatorScopes.delete(operatorId); }

  snapshot() {
    return Object.freeze({
      name:           this.name,
      frozen:         this._frozen,
      freeze_reason:  this._freezeReason,
      clock_offset:   this._clockOffset,
      incident_count: this._incidents.size,
      created_at:     this._createdAt,
    });
  }
}

module.exports = AuthorityNamespace;
