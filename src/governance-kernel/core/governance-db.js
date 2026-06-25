'use strict';
/**
 * governance-db.js — Cluster-authoritative governance state via PostgreSQL.
 *
 * Provides a shared key-value store for governance state that survives
 * restart and is visible to all backend instances.
 *
 * Table: governance_state
 *   key        VARCHAR(64) PRIMARY KEY
 *   int_value  BIGINT DEFAULT 0
 *   text_value TEXT
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 *   updated_by VARCHAR(255)
 *
 * Keys used:
 *   'authority_epoch'       — fleet authority epoch counter
 *   'manifest_generation'   — manifest content change counter
 *   'rollout_frozen'        — '1' or '0'
 *   'freeze_reason'         — freeze explanation text
 */

async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS governance_state (
      key        VARCHAR(64) PRIMARY KEY,
      int_value  BIGINT DEFAULT 0,
      text_value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by VARCHAR(255)
    )
  `);
}

async function getIntValue(pool, key, defaultVal = 0) {
  try {
    const r = await pool.query(
      'SELECT int_value FROM governance_state WHERE key = $1',
      [key]
    );
    if (!r.rows.length) return defaultVal;
    return Number(r.rows[0].int_value);
  } catch {
    return defaultVal;
  }
}

async function setIntValue(pool, key, value, updatedBy) {
  await pool.query(
    `INSERT INTO governance_state (key, int_value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET int_value = $2, updated_at = NOW(), updated_by = $3`,
    [key, value, updatedBy ?? null]
  );
}

async function incrementInt(pool, key, updatedBy) {
  const r = await pool.query(
    `UPDATE governance_state SET int_value = int_value + 1, updated_at = NOW(), updated_by = $2
     WHERE key = $1 RETURNING int_value`,
    [key, updatedBy ?? null]
  );
  if (r.rows.length) return Number(r.rows[0].int_value);
  // Row absent — insert with value 1
  const ins = await pool.query(
    `INSERT INTO governance_state (key, int_value, updated_at, updated_by)
     VALUES ($1, 1, NOW(), $2)
     ON CONFLICT (key) DO UPDATE SET int_value = governance_state.int_value + 1, updated_at = NOW(), updated_by = $2
     RETURNING int_value`,
    [key, updatedBy ?? null]
  );
  return Number(ins.rows[0].int_value);
}

async function getTextValue(pool, key, defaultVal = null) {
  try {
    const r = await pool.query(
      'SELECT text_value FROM governance_state WHERE key = $1',
      [key]
    );
    if (!r.rows.length) return defaultVal;
    return r.rows[0].text_value;
  } catch {
    return defaultVal;
  }
}

async function setTextValue(pool, key, value, updatedBy) {
  await pool.query(
    `INSERT INTO governance_state (key, text_value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET text_value = $2, updated_at = NOW(), updated_by = $3`,
    [key, value, updatedBy ?? null]
  );
}

async function getAll(pool) {
  const r = await pool.query('SELECT key, int_value, text_value, updated_at, updated_by FROM governance_state');
  const result = {};
  for (const row of r.rows) {
    result[row.key] = {
      int_value:  row.int_value  != null ? Number(row.int_value) : null,
      text_value: row.text_value,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    };
  }
  return result;
}

/**
 * Execute fn(client) inside a transaction that holds a pg_advisory_xact_lock on key.
 * The lock is automatically released when the transaction ends (commit or rollback).
 * Used to serialize cross-instance writes that need total ordering (ledger append,
 * incident transitions). The pg advisory lock ensures only one instance can be inside
 * the critical section at a time — regardless of how many backend instances are running.
 *
 * @param {object}   pool — pg Pool
 * @param {string}   key  — unique string lock key (hashed via hashtext)
 * @param {function} fn   — async(client) → result; runs inside the locked transaction
 * @returns {*} result of fn(client)
 */
async function withAdvisoryLock(pool, key, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    const result = await fn(client);
    await client.query('COMMIT');
    client.release();
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow — original error is what matters */ }
    client.release(err);
    throw err;
  }
}

module.exports = {
  initSchema,
  getIntValue, setIntValue, incrementInt,
  getTextValue, setTextValue,
  getAll,
  withAdvisoryLock,
};
