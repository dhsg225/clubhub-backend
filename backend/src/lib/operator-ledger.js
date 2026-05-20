'use strict';
/**
 * operator-ledger.js
 *
 * Append-only tamper-evident operator action ledger with SHA-256 hash chain.
 * No delete or mutate API — only append.
 */

const crypto = require('node:crypto');
const fs     = require('node:fs');
const path   = require('node:path');

// ── Stable serialisation ──────────────────────────────────────────────────────

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ── Allowed action types ──────────────────────────────────────────────────────

const ALLOWED_ACTION_TYPES = new Set([
  'rollout_promote',
  'rollout_rollback',
  'rollout_freeze',
  'rollout_unfreeze',
  'waiver_created',
  'quarantine_override',
  'manifest_invalidate',
  'policy_override',
  'threshold_override',
  'config_changed',
]);

// ── Sequential ID ─────────────────────────────────────────────────────────────

let _ledgerSeq = 0;
function nextActionId() {
  _ledgerSeq += 1;
  return 'act-' + _ledgerSeq.toString(16).padStart(8, '0');
}

// ── Ledger store ──────────────────────────────────────────────────────────────

let _ledger = [];

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Append an entry to the ledger.
 * THROWS if action_type is not in allowed set.
 * THROWS if action_type === 'waiver_created' and no justification.
 *
 * @returns {object} frozen ledger entry
 */
function appendEntry(opts) {
  const {
    operator_id,
    action_type,
    justification,
    before_state_hash,
    after_state_hash,
    related_incident,
    approval_chain,
  } = opts ?? {};

  if (!ALLOWED_ACTION_TYPES.has(action_type)) {
    throw new Error(
      `Invalid action_type '${action_type}'. Allowed: ${[...ALLOWED_ACTION_TYPES].join(', ')}`
    );
  }

  if (action_type === 'waiver_created' && !justification) {
    throw new Error("action_type 'waiver_created' requires a justification");
  }

  const action_id = nextActionId();
  const ts        = new Date().toISOString();

  const previous_entry_hash = _ledger.length === 0
    ? 'LEDGER_GENESIS'
    : _ledger[_ledger.length - 1].entry_hash;

  const entry_hash = sha256(
    previous_entry_hash +
    stableStringify({ action_id, operator_id, action_type, justification: justification ?? null, ts })
  ).slice(0, 16);

  const entry = Object.freeze({
    action_id,
    operator_id:        operator_id        ?? null,
    action_type,
    justification:      justification      ?? null,
    before_state_hash:  before_state_hash  ?? null,
    after_state_hash:   after_state_hash   ?? null,
    related_incident:   related_incident   ?? null,
    approval_chain:     approval_chain     ?? [],
    ts,
    entry_hash,
    previous_entry_hash,
  });

  _ledger.push(entry);
  return entry;
}

function getEntries() {
  return [..._ledger];
}

/**
 * Recompute hash chain and return { valid, violations }.
 */
function verifyIntegrity() {
  const violations = [];
  let previousHash = 'LEDGER_GENESIS';

  for (const entry of _ledger) {
    const expected = sha256(
      previousHash +
      stableStringify({
        action_id:    entry.action_id,
        operator_id:  entry.operator_id,
        action_type:  entry.action_type,
        justification: entry.justification,
        ts:           entry.ts,
      })
    ).slice(0, 16);

    if (entry.previous_entry_hash !== previousHash) {
      violations.push({
        action_id: entry.action_id,
        issue: `previous_entry_hash mismatch: expected '${previousHash}', got '${entry.previous_entry_hash}'`,
      });
    }

    if (entry.entry_hash !== expected) {
      violations.push({
        action_id: entry.action_id,
        issue: `entry_hash mismatch: expected '${expected}', got '${entry.entry_hash}'`,
      });
    }

    previousHash = entry.entry_hash;
  }

  return { valid: violations.length === 0, violations };
}

function saveLedger(reportsDir) {
  const dir = reportsDir ?? path.join(process.cwd(), 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'operator-ledger.json'),
    JSON.stringify({
      generated_at: new Date().toISOString(),
      integrity:    verifyIntegrity(),
      entries:      _ledger,
    }, null, 2)
  );
}

function resetLedger() {
  _ledger    = [];
  _ledgerSeq = 0;
}

module.exports = { appendEntry, getEntries, verifyIntegrity, saveLedger, resetLedger, ALLOWED_ACTION_TYPES };
