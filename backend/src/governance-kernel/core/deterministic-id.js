'use strict';
/**
 * deterministic-id.js
 *
 * Content-addressed deterministic ID derivation for governed entities.
 * IDs must be deterministic across cluster nodes and replay sessions.
 * NEVER include wall-clock timestamps in ID hash inputs.
 *
 * Usage:
 *   const { deriveDeterministicId } = require('./deterministic-id');
 *   const id = deriveDeterministicId('incident', { type, severity, causal_chain });
 */

const crypto = require('node:crypto');

// ── Stable serialisation ──────────────────────────────────────────────────────

function _stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(_stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
}

// ── Core derivation ───────────────────────────────────────────────────────────

/**
 * Derive a deterministic, content-addressed ID.
 *
 * @param {string} namespace  — domain prefix (e.g. 'incident', 'override')
 * @param {object} payload    — content to hash; must NOT include wall-clock timestamps
 * @param {number} [length=12] — number of hex chars to use from digest (default 12)
 * @returns {string}  `${namespace}-${hexDigest.slice(0, length)}`
 */
function deriveDeterministicId(namespace, payload, length = 12) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('deriveDeterministicId: namespace must be a non-empty string');
  }
  const canonical = namespace + ':' + _stableStringify(payload ?? {});
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  return `${namespace}-${digest.slice(0, length)}`;
}

module.exports = {
  deriveDeterministicId,
};
