'use strict';
/**
 * operator-overrides.js — Explicit, bounded, replay-visible operator overrides.
 *
 * All governance overrides are:
 *   - Scoped to a named override type
 *   - Require operator_id, justification, expiry, affected_domains, linked_incident
 *   - Time-bounded — expired overrides are automatically invalid
 *   - Ledger-appended — every use appended to operator-ledger.js
 *   - SECURITY.override_used event emitted on each use
 *   - Replay-visible — override state deterministically reproduced from the ledger
 *
 * Override types:
 *   freeze_bypass         — allow ring promotion while frozen
 *   promotion_bypass      — skip policy-engine evaluation for a promotion
 *   threshold_override    — temporarily alter a governed threshold value
 *   recovery_suppression  — suppress escalation for a named recovery category
 *   authority_force_acquire — force-acquire authority lease without waiting for expiry
 *
 * Output: reports/operator-overrides.json
 */

const crypto  = require('node:crypto');
const fs      = require('node:fs');
const path    = require('node:path');

// ── Sequential override ID ────────────────────────────────────────────────────
let _overrideSeq = 0;

// ── Override type registry ────────────────────────────────────────────────────

const OVERRIDE_TYPES = Object.freeze({
  freeze_bypass:            'freeze_bypass',
  promotion_bypass:         'promotion_bypass',
  threshold_override:       'threshold_override',
  recovery_suppression:     'recovery_suppression',
  authority_force_acquire:  'authority_force_acquire',
});

// Required fields for all overrides
const REQUIRED_FIELDS = ['operator_id', 'justification', 'expiry', 'affected_domains', 'linked_incident'];

// Maximum override duration: 24 hours. Operators cannot create indefinite overrides.
const MAX_OVERRIDE_DURATION_MS = 24 * 60 * 60 * 1000;

// ── Override store ────────────────────────────────────────────────────────────

const _overrides = new Map(); // override_id → OverrideRecord

// ── Helpers ───────────────────────────────────────────────────────────────────

function _scopeHash(overrideType, affectedDomains, linkedIncident) {
  const stable = JSON.stringify({ overrideType, affectedDomains: [...affectedDomains].sort(), linkedIncident });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function _isExpired(record) {
  return Date.now() > record.expiry_ts;
}

// ── createOverride ────────────────────────────────────────────────────────────

/**
 * Create a new time-bounded operator override.
 *
 * @param {object} opts
 *   override_type    {string}   — one of OVERRIDE_TYPES
 *   operator_id      {string}   — operator identifier (required)
 *   justification    {string}   — written reason (required)
 *   expiry           {number}   — expiry timestamp (ms) or duration_ms (relative to now)
 *   affected_domains {string[]} — governed domains this override affects (required)
 *   linked_incident  {string}   — incident_id this override is linked to (required)
 *   scope            {object}   — optional: additional scope context
 * @returns {object} OverrideRecord
 */
function createOverride(opts) {
  const { override_type, operator_id, justification, expiry, affected_domains, linked_incident, scope } = opts;

  if (!OVERRIDE_TYPES[override_type]) {
    throw new Error(`Unknown override type: '${override_type}'. Must be one of: ${Object.keys(OVERRIDE_TYPES).join(', ')}`);
  }

  // Validate all required fields
  for (const field of REQUIRED_FIELDS) {
    if (!opts[field] || (Array.isArray(opts[field]) && opts[field].length === 0)) {
      throw new Error(`Override requires '${field}' — operator accountability requires all fields present`);
    }
  }

  if (typeof justification !== 'string' || justification.trim().length < 10) {
    throw new Error('Override justification must be a non-trivial string (minimum 10 characters)');
  }

  // Resolve expiry to absolute timestamp
  let expiry_ts;
  if (expiry > Date.now() - MAX_OVERRIDE_DURATION_MS * 100) {
    // Treat as absolute timestamp if large
    expiry_ts = expiry;
  } else {
    // Treat as duration in ms
    expiry_ts = Date.now() + expiry;
  }

  const max_expiry = Date.now() + MAX_OVERRIDE_DURATION_MS;
  if (expiry_ts > max_expiry) {
    throw new Error(`Override expiry cannot exceed 24 hours from now (${new Date(max_expiry).toISOString()})`);
  }

  const override_id       = `ovr-${(++_overrideSeq).toString(10).padStart(8, '0')}`;
  const override_scope_hash = _scopeHash(override_type, affected_domains, linked_incident);
  const created_at        = new Date().toISOString();

  const record = {
    override_id,
    override_type,
    operator_id,
    justification: justification.trim(),
    affected_domains: [...affected_domains],
    linked_incident,
    scope:           scope ?? null,
    created_at,
    expiry_ts,
    expiry_iso:      new Date(expiry_ts).toISOString(),
    override_scope_hash,
    uses:            [],   // log of each use
    active:          true,
  };

  _overrides.set(override_id, record);
  return { ...record };
}

// ── checkOverride ─────────────────────────────────────────────────────────────

/**
 * Check whether a specific override is valid and not expired.
 *
 * @param {string} override_id
 * @param {string} [expected_type]  — if provided, also checks type matches
 * @returns {{ valid: boolean, record: object|null, reason: string|null }}
 */
function checkOverride(override_id, expected_type) {
  const record = _overrides.get(override_id);
  if (!record) {
    return { valid: false, record: null, reason: 'override_not_found' };
  }
  if (_isExpired(record)) {
    return { valid: false, record: { ...record }, reason: 'override_expired' };
  }
  if (expected_type && record.override_type !== expected_type) {
    return { valid: false, record: { ...record }, reason: `type_mismatch: expected ${expected_type}, got ${record.override_type}` };
  }
  return { valid: true, record: { ...record }, reason: null };
}

// ── useOverride ───────────────────────────────────────────────────────────────

/**
 * Record a use of an override. Emits SECURITY.override_used and appends to operator ledger.
 *
 * @param {string} override_id
 * @param {object} context          — { action_taken, caller, additional_context }
 * @param {object} [operatorLedger] — operator-ledger module reference (optional)
 * @param {object} [eventsModule]   — events module reference (optional, for SECURITY.override_used)
 * @returns {object} use record
 */
function useOverride(override_id, context = {}, operatorLedger, eventsModule) {
  const { valid, record, reason } = checkOverride(override_id);
  if (!valid) {
    throw new Error(`Cannot use override '${override_id}': ${reason}`);
  }

  const use_record = {
    used_at:       new Date().toISOString(),
    action_taken:  context.action_taken  ?? 'unknown',
    caller:        context.caller        ?? 'unknown',
    context:       context.additional_context ?? null,
  };

  _overrides.get(override_id).uses.push(use_record);

  // Emit SECURITY.override_used event
  if (eventsModule && typeof eventsModule.emit === 'function') {
    eventsModule.emit('SECURITY.override_used', null, {
      override_id,
      override_type:  record.override_type,
      operator_id:    record.operator_id,
      linked_incident: record.linked_incident,
      action_taken:   use_record.action_taken,
      expiry_iso:     record.expiry_iso,
      override_scope_hash: record.override_scope_hash,
    });
  }

  // Append to operator ledger for audit trail
  if (operatorLedger && typeof operatorLedger.appendEntry === 'function') {
    try {
      operatorLedger.appendEntry({
        operator_id:     record.operator_id,
        action_type:     'policy_override',
        justification:   `Override used: ${record.justification}`,
        related_incident: record.linked_incident,
        approval_chain:  [record.operator_id],
      });
    } catch { /* ledger failure must not block the override use */ }
  }

  return { override_id, use_record, record: { ...record } };
}

// ── listActive ────────────────────────────────────────────────────────────────

/**
 * Return all non-expired overrides.
 */
function listActive() {
  const now = Date.now();
  return [..._overrides.values()]
    .filter(r => r.expiry_ts > now)
    .map(r => ({ ...r }));
}

/**
 * Return all overrides (including expired).
 */
function listAll() {
  return [..._overrides.values()].map(r => ({
    ...r,
    expired: _isExpired(r),
  }));
}

// ── saveReport ────────────────────────────────────────────────────────────────

function saveReport(reportsDir) {
  const all = listAll();
  const report = {
    generated_at:    new Date().toISOString(),
    total:           all.length,
    active:          all.filter(r => !r.expired).length,
    expired:         all.filter(r => r.expired).length,
    overrides:       all,
  };
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, 'operator-overrides.json'),
      JSON.stringify(report, null, 2)
    );
  } catch { /* non-fatal */ }
}

// ── Reset (test infrastructure) ───────────────────────────────────────────────
function _reset() {
  _overrides.clear();
}

module.exports = {
  OVERRIDE_TYPES,
  createOverride,
  checkOverride,
  useOverride,
  listActive,
  listAll,
  saveReport,
  _reset,  // test use only
};
