'use strict';
/**
 * PolicyRegistry — versioned policy storage.
 * Policies are immutable once published. New versions replace old.
 */

class PolicyRegistry {
  constructor() {
    this._policies  = new Map();   // id → latest entry
    this._history   = [];          // all versions
    this._seq       = 0;
  }

  publish(policy) {
    if (!policy.id || !policy.action) throw new Error('PolicyRegistry: policy requires id and action');
    const version = (this._policies.get(policy.id)?.version ?? 0) + 1;
    const entry   = { ...policy, version, published_at: Date.now() };
    this._policies.set(policy.id, entry);
    this._history.push(entry);
    return entry;
  }

  get(id)      { return this._policies.get(id) ?? null; }
  list()       { return [...this._policies.values()]; }
  getHistory() { return [...this._history]; }

  snapshot() {
    return { policy_count: this._policies.size, policies: this.list() };
  }
}

module.exports = { PolicyRegistry };
