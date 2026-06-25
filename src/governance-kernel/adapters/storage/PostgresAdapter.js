'use strict';
const governanceDb = require('../../core/governance-db');

class PostgresAdapter {
  constructor(pool) { this._pool = pool; }
  async init()               { return governanceDb.initSchema(this._pool); }
  async getInt(key, def)     { return governanceDb.getIntValue(this._pool, key, def); }
  async setInt(key, val, by) { return governanceDb.setIntValue(this._pool, key, val, by); }
  async incrementInt(key, by){ return governanceDb.incrementInt(this._pool, key, by); }
  async getText(key, def)    { return governanceDb.getTextValue(this._pool, key, def); }
  async setText(key, val, by){ return governanceDb.setTextValue(this._pool, key, val, by); }
  async getAll()             { return governanceDb.getAll(this._pool); }
  async withLock(key, fn)    { return governanceDb.withAdvisoryLock(this._pool, key, fn); }
  get CAPABILITIES() {
    return Object.freeze({
      advisory_locks:    true,
      atomic_increments: true,
      optimistic_lock:   true,
      multi_region:      false,
      determinism:       'DETERMINISTIC_PER_DB',
    });
  }
}
module.exports = PostgresAdapter;
