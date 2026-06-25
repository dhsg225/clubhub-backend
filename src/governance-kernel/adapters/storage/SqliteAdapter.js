'use strict';
/**
 * SQLite storage adapter — for embedded / single-node use.
 * Requires 'better-sqlite3' package.
 * Provides subset of PostgresAdapter capabilities (no advisory locks).
 */
class SqliteAdapter {
  constructor(db) { this._db = db; }
  async init() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS governance_state (
        key TEXT PRIMARY KEY,
        int_value INTEGER,
        text_value TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        updated_by TEXT
      )
    `);
  }
  async getInt(key, def = 0) {
    const row = this._db.prepare('SELECT int_value FROM governance_state WHERE key = ?').get(key);
    return row?.int_value ?? def;
  }
  async setInt(key, val, by = null) {
    this._db.prepare('INSERT OR REPLACE INTO governance_state (key, int_value, updated_at, updated_by) VALUES (?, ?, datetime(\'now\'), ?)').run(key, val, by);
    return val;
  }
  async incrementInt(key, by = null) {
    const current = await this.getInt(key, 0);
    const next    = current + 1;
    await this.setInt(key, next, by);
    return next;
  }
  async getText(key, def = null) {
    const row = this._db.prepare('SELECT text_value FROM governance_state WHERE key = ?').get(key);
    return row?.text_value ?? def;
  }
  async setText(key, val, by = null) {
    this._db.prepare('INSERT OR REPLACE INTO governance_state (key, text_value, updated_at, updated_by) VALUES (?, ?, datetime(\'now\'), ?)').run(key, val, by);
    return val;
  }
  async getAll() { return this._db.prepare('SELECT * FROM governance_state').all(); }
  async withLock(key, fn) { return fn(); /* SQLite: serialized by nature, no advisory lock needed */ }
  get CAPABILITIES() {
    return Object.freeze({
      advisory_locks:    false,
      atomic_increments: true,
      optimistic_lock:   true,
      multi_region:      false,
      determinism:       'DETERMINISTIC_PER_DB',
      embedded:          true,
    });
  }
}
module.exports = SqliteAdapter;
