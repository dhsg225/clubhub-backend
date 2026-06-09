'use strict';
/**
 * trace-store/trace-schema.js
 *
 * Deterministic schema definition + canonical serialization for workflow traces.
 *
 * Rules:
 *   - stableStringify: lexicographic key sort for identical serialization across runs
 *   - computeTraceId: deterministic from event content (no UUIDs, no timestamps)
 *   - computeTraceHash: SHA-256 over canonical entry including prev_trace_hash
 *   - prev_trace_hash: forms continuous chain per workflow_id (GENESIS for first entry)
 *
 * HARD invariants:
 *   - Same entry always produces same trace_id and trace_hash
 *   - prev_trace_hash links entries in insertion order per workflow_id
 */

const crypto = require('crypto');

const TRACE_FIELDS_ORDERED = [
  'trace_id',
  'workflow_id',
  'agent_id',
  'correlation_id',
  'step_index',
  'event_type',
  'payload',
  'lineage_ts',
  'consistency_level',
  'prev_trace_hash',
];

const GENESIS_HASH = 'GENESIS';

/**
 * stableStringify(obj)
 *
 * Deterministic JSON with lexicographic key ordering.
 * Same object always serializes to identical string.
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined) return JSON.stringify(null);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/**
 * canonicalize(raw)
 *
 * Normalize a raw trace event into the canonical schema.
 * Ensures all fields are present with correct types and ordering.
 */
function canonicalize(raw) {
  return {
    trace_id:         raw.trace_id         ?? null,
    workflow_id:      raw.workflow_id       ?? 'unknown',
    agent_id:         raw.agent_id          ?? null,
    correlation_id:   raw.correlation_id    ?? null,
    step_index:       raw.step_index        ?? 0,
    event_type:       raw.event_type        ?? 'unknown',
    payload:          raw.payload           ?? {},
    lineage_ts:       raw.lineage_ts        ?? 0,
    consistency_level: raw.consistency_level ?? null,
    prev_trace_hash:  raw.prev_trace_hash   ?? GENESIS_HASH,
  };
}

/**
 * computeTraceId(entry)
 *
 * Deterministic trace identity: SHA-256 of canonical content fields.
 * Does NOT include trace_id or prev_trace_hash (those are set during insertion).
 */
function computeTraceId(raw) {
  const key = stableStringify({
    workflow_id:       raw.workflow_id       ?? 'unknown',
    agent_id:          raw.agent_id          ?? null,
    correlation_id:    raw.correlation_id    ?? null,
    step_index:        raw.step_index        ?? 0,
    event_type:        raw.event_type        ?? 'unknown',
    payload:           raw.payload           ?? {},
    lineage_ts:        raw.lineage_ts        ?? 0,
    consistency_level: raw.consistency_level ?? null,
  });
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

/**
 * computeTraceHash(entry)
 *
 * SHA-256 over the full canonical entry including prev_trace_hash.
 * This is what forms the hash chain.
 */
function computeTraceHash(entry) {
  const canonical = stableStringify({
    trace_id:          entry.trace_id,
    workflow_id:       entry.workflow_id,
    agent_id:          entry.agent_id         ?? null,
    correlation_id:    entry.correlation_id   ?? null,
    step_index:        entry.step_index,
    event_type:        entry.event_type,
    payload:           entry.payload          ?? {},
    lineage_ts:        entry.lineage_ts,
    consistency_level: entry.consistency_level ?? null,
    prev_trace_hash:   entry.prev_trace_hash  ?? GENESIS_HASH,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * buildEntry(raw, prevTraceHash?)
 *
 * Construct a fully-formed trace entry ready for DB insertion.
 */
function buildEntry(raw, prevTraceHash) {
  const canonical  = canonicalize(raw);
  const trace_id   = computeTraceId(raw);
  const withChain  = {
    ...canonical,
    trace_id,
    prev_trace_hash: prevTraceHash ?? GENESIS_HASH,
  };
  const trace_hash = computeTraceHash(withChain);
  return { ...withChain, trace_hash };
}

/**
 * verifyEntry(entry)
 *
 * Recompute trace_hash and compare to stored value.
 * Returns { valid: bool, expected, actual }.
 */
function verifyEntry(entry) {
  const expected = computeTraceHash(entry);
  const valid    = expected === entry.trace_hash;
  return { valid, expected, actual: entry.trace_hash };
}

module.exports = {
  stableStringify,
  canonicalize,
  computeTraceId,
  computeTraceHash,
  buildEntry,
  verifyEntry,
  TRACE_FIELDS_ORDERED,
  GENESIS_HASH,
};
