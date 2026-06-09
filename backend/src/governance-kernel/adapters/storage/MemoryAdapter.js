'use strict';
class MemoryAdapter {
  constructor() { this._ints = new Map(); this._texts = new Map(); }
  async init()                  { /* no-op */ }
  async getInt(key, def = 0)    { return this._ints.get(key) ?? def; }
  async setInt(key, val)        { this._ints.set(key, val); return val; }
  async incrementInt(key)       { const v = (this._ints.get(key) ?? 0) + 1; this._ints.set(key, v); return v; }
  async getText(key, def = null){ return this._texts.get(key) ?? def; }
  async setText(key, val)       { this._texts.set(key, val); return val; }
  async getAll()                { return {}; }
  async withLock(key, fn)       { return fn(); }
  _reset()                      { this._ints.clear(); this._texts.clear(); }
  get CAPABILITIES() {
    return Object.freeze({
      advisory_locks:    false,
      atomic_increments: true,
      optimistic_lock:   false,
      multi_region:      false,
      determinism:       'CONTENT_ADDRESSED',
      replay_mode:       true,
    });
  }
}
module.exports = MemoryAdapter;
