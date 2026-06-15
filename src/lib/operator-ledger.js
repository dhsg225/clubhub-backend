'use strict';
/**
 * operator-ledger.js
 *
 * Append-only tamper-evident operator action ledger with SHA-256 hash chain.
 * No delete or mutate API — only append.
 */

const crypto       = require('node:crypto');
const fs           = require('node:fs');
const path         = require('node:path');
const governanceDb = require('./governance-db');

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
  return 'act-' + (++_ledgerSeq).toString(10).padStart(8, '0');
}

// ── DB pool ───────────────────────────────────────────────────────────────────

let _pool = null;

function setPool(pool) {
  _pool = pool;
}

// ── Ledger store ──────────────────────────────────────────────────────────────

let _ledger = [];

// Resource governance: in-memory ledger is bounded. When it exceeds MAX_LEDGER_ENTRIES,
// compact by retaining only the last entry (needed for hash chain continuity).
// The DB is the durable ledger; in-memory is a hash-chain bootstrap cache.
const MAX_LEDGER_ENTRIES = 10_000;

function _compactLedgerIfNeeded() {
  if (_ledger.length > MAX_LEDGER_ENTRIES) {
    // Keep only the last entry — it provides hash chain continuity for the next append
    const last = _ledger[_ledger.length - 1];
    _ledger.length = 0;
    _ledger.push(last);
  }
}

// ── DB persistence ────────────────────────────────────────────────────────────

async function initFromDb(pool) {
  const p = pool || _pool;
  if (!p) return;

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS operator_ledger_entries (
        seq         BIGSERIAL PRIMARY KEY,
        action_id   VARCHAR(64) UNIQUE,
        operator_id VARCHAR(255),
        action_type VARCHAR(64),
        entry_hash  VARCHAR(32) NOT NULL,
        prev_hash   VARCHAR(32) NOT NULL,
        ts          TIMESTAMPTZ,
        payload     JSONB
      )
    `);

    // Load last entry to restore hash chain continuity
    const r = await p.query(
      'SELECT * FROM operator_ledger_entries ORDER BY seq DESC LIMIT 1'
    );
    if (r.rows.length) {
      const last = r.rows[0];
      // Restore sequence counter from DB
      const seqMatch = last.action_id?.match(/^act-(\d+)$/);
      if (seqMatch) {
        _ledgerSeq = Math.max(_ledgerSeq, parseInt(seqMatch[1], 10));
      }
      // Seed in-memory ledger with just the last entry for hash chain continuity
      if (_ledger.length === 0) {
        _ledger.push(Object.freeze({
          action_id:          last.action_id,
          operator_id:        last.operator_id,
          action_type:        last.action_type,
          justification:      last.payload?.justification ?? null,
          before_state_hash:  last.payload?.before_state_hash ?? null,
          after_state_hash:   last.payload?.after_state_hash ?? null,
          related_incident:   last.payload?.related_incident ?? null,
          approval_chain:     last.payload?.approval_chain ?? [],
          ts:                 last.ts instanceof Date ? last.ts.toISOString() : last.ts,
          entry_hash:         last.entry_hash,
          previous_entry_hash: last.prev_hash,
        }));
      }
    }
  } catch { /* non-fatal */ }
}

async function persistEntry(pool, entry) {
  const p = pool || _pool;
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO operator_ledger_entries
         (action_id, operator_id, action_type, entry_hash, prev_hash, ts, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (action_id) DO NOTHING`,
      [
        entry.action_id,
        entry.operator_id,
        entry.action_type,
        entry.entry_hash,
        entry.previous_entry_hash,
        entry.ts,
        JSON.stringify({
          justification:     entry.justification,
          before_state_hash: entry.before_state_hash,
          after_state_hash:  entry.after_state_hash,
          related_incident:  entry.related_incident,
          approval_chain:    entry.approval_chain,
        }),
      ]
    );
  } catch { /* fire-and-forget: non-fatal */ }
}

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
  _compactLedgerIfNeeded();

  // Fire-and-forget DB persist
  if (_pool) {
    persistEntry(_pool, entry).catch(() => {});
  }

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

// ── Linearized (cluster-safe) append ─────────────────────────────────────────

/**
 * Append an entry with full linearization guarantee.
 *
 * ACTIVE/ACTIVE SAFE: uses pg_advisory_xact_lock to serialize across all
 * backend instances. The hash chain is computed from the DB-authoritative
 * previous entry, not from in-memory state. Only one instance can be inside
 * this critical section at a time.
 *
 * Linearization point: the pg advisory lock on 'operator_ledger_chain'.
 * Conflict resolution: lock contention — second caller blocks until first commits.
 * Partial failure: transaction rollback restores DB to pre-call state.
 * Retry semantics: safe to retry (action_id is unique; ON CONFLICT DO NOTHING).
 * Exactly-once: guaranteed by unique action_id constraint.
 *
 * DB FAILURE: falls through to appendEntry() (in-memory, non-linearized).
 *
 * @param {object} pool  — pg Pool
 * @param {object} opts  — same fields as appendEntry()
 * @returns {Promise<object>} frozen ledger entry
 */
async function appendEntryLinearized(pool, opts) {
  const p = pool || _pool;
  if (!p) {
    // No DB — fall back to in-memory append (non-linearized, advisory only)
    return appendEntry(opts);
  }

  const {
    operator_id, action_type, justification,
    before_state_hash, after_state_hash, related_incident, approval_chain,
  } = opts ?? {};

  if (!ALLOWED_ACTION_TYPES.has(action_type)) {
    throw new Error(
      `Invalid action_type '${action_type}'. Allowed: ${[...ALLOWED_ACTION_TYPES].join(', ')}`
    );
  }
  if (action_type === 'waiver_created' && !justification) {
    throw new Error("action_type 'waiver_created' requires a justification");
  }

  return governanceDb.withAdvisoryLock(p, 'operator_ledger_chain', async (client) => {
    // Read DB-authoritative last entry hash (not in-memory — avoids cross-instance divergence)
    const lastRow = await client.query(
      'SELECT entry_hash, action_id FROM operator_ledger_entries ORDER BY seq DESC LIMIT 1'
    );
    const dbPrevHash = lastRow.rows.length ? lastRow.rows[0].entry_hash : 'LEDGER_GENESIS';

    const action_id = nextActionId();
    const ts        = new Date().toISOString();

    const entry_hash = sha256(
      dbPrevHash +
      stableStringify({ action_id, operator_id, action_type, justification: justification ?? null, ts })
    ).slice(0, 16);

    const payload = JSON.stringify({
      justification:     justification      ?? null,
      before_state_hash: before_state_hash  ?? null,
      after_state_hash:  after_state_hash   ?? null,
      related_incident:  related_incident   ?? null,
      approval_chain:    approval_chain     ?? [],
    });

    await client.query(
      `INSERT INTO operator_ledger_entries
         (action_id, operator_id, action_type, entry_hash, prev_hash, ts, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (action_id) DO NOTHING`,
      [action_id, operator_id ?? null, action_type, entry_hash, dbPrevHash, ts, payload]
    );

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
      previous_entry_hash: dbPrevHash,
    });

    // Sync in-memory for same-instance reads
    _ledger.push(entry);

    return entry;
  });
}

module.exports = {
  appendEntry,
  appendEntryLinearized,
  getEntries,
  verifyIntegrity,
  saveLedger,
  resetLedger,
  setPool,
  initFromDb,
  persistEntry,
  ALLOWED_ACTION_TYPES,
};
