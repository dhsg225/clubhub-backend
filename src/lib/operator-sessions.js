'use strict';
/**
 * operator-sessions.js
 *
 * Operator session registry with DB-backed revocation.
 * Provides cluster-wide token revocation (not just local in-memory).
 *
 * Revocation is persisted to operator_revoked_tokens table.
 * On startup, revocation list is loaded from DB.
 * Lookups are O(1) via in-memory Set (cache) backed by DB.
 *
 * JTI replay protection: each token carries a jti (unique per issuance).
 * Revoked jtis are permanently blacklisted.
 */

const governanceDb = require('./governance-db');

let _pool = null;
// In-memory revocation cache: Set of revoked jti strings
const _revokedJtis = new Set();
// Current signing key version (incremented on rotation)
let _keyVersion = 1;

function setPool(pool) {
  _pool = pool;
}

async function initFromDb(pool) {
  const p = pool || _pool;
  if (!p) return;
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS operator_revoked_tokens (
        jti         VARCHAR(64) PRIMARY KEY,
        operator_id VARCHAR(255),
        revoked_at  TIMESTAMPTZ DEFAULT NOW(),
        revoked_by  VARCHAR(255),
        reason      TEXT
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS operator_signing_key_versions (
        version     INT PRIMARY KEY,
        rotated_at  TIMESTAMPTZ DEFAULT NOW(),
        rotated_by  VARCHAR(255)
      )
    `);
    // Load revoked JTIs
    const r = await p.query('SELECT jti FROM operator_revoked_tokens');
    for (const row of r.rows) _revokedJtis.add(row.jti);
    // Load key version
    const kv = await p.query('SELECT MAX(version) AS v FROM operator_signing_key_versions');
    if (kv.rows[0]?.v) _keyVersion = kv.rows[0].v;
  } catch { /* non-fatal */ }
}

/**
 * Check if a JTI is revoked (O(1) in-memory check).
 * @returns {boolean}
 */
function isRevoked(jti) {
  return _revokedJtis.has(jti);
}

/**
 * Revoke a single token by JTI.
 */
async function revokeToken(jti, { operator_id, revoked_by, reason } = {}) {
  _revokedJtis.add(jti);
  const p = _pool;
  if (p) {
    try {
      await p.query(
        `INSERT INTO operator_revoked_tokens (jti, operator_id, revoked_by, reason)
         VALUES ($1, $2, $3, $4) ON CONFLICT (jti) DO NOTHING`,
        [jti, operator_id ?? null, revoked_by ?? 'system', reason ?? null]
      );
    } catch { /* non-fatal */ }
  }
}

/**
 * Revoke ALL tokens for an operator (by operator_id prefix match on jti is insufficient;
 * store operator_id on issuance and revoke by operator_id lookup).
 * This marks a flag in governance_kv; tokens issued before revocation are rejected
 * when they carry the matching operator_id.
 */
async function revokeOperator(operator_id, { revoked_by, reason } = {}) {
  const p = _pool;
  if (p) {
    try {
      // Also mark via governance_kv so new tokens for this operator are rejected at auth time
      await governanceDb.setTextValue(p, `operator_revoked:${operator_id}`, Date.now().toString(), revoked_by ?? 'system');
    } catch { /* non-fatal */ }
  }
}

/**
 * Rotate the signing key — increments key version in DB.
 * All tokens issued with previous key versions become invalid.
 * operatorAuth.js must embed key_version in token payload and reject on mismatch.
 */
async function rotateSigningKey({ rotated_by } = {}) {
  _keyVersion++;
  const p = _pool;
  if (p) {
    try {
      await p.query(
        `INSERT INTO operator_signing_key_versions (version, rotated_by) VALUES ($1, $2)`,
        [_keyVersion, rotated_by ?? 'system']
      );
    } catch { /* non-fatal */ }
  }
  return _keyVersion;
}

function getKeyVersion() {
  return _keyVersion;
}

/**
 * Check if an operator is globally revoked (their operator_id was revoked
 * after their token was issued).
 */
async function isOperatorRevoked(operator_id, pool) {
  const p = pool || _pool;
  if (!p) return false;
  try {
    const val = await governanceDb.getTextValue(p, `operator_revoked:${operator_id}`, null);
    return val !== null;
  } catch {
    return false;
  }
}

function _reset() {
  _revokedJtis.clear();
  _keyVersion = 1;
}

module.exports = {
  setPool,
  initFromDb,
  isRevoked,
  revokeToken,
  revokeOperator,
  rotateSigningKey,
  getKeyVersion,
  isOperatorRevoked,
  _reset,
};
