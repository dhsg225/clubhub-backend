'use strict';
/**
 * policy-engine.js
 *
 * Deterministic runtime policy decision engine.
 * Each evaluatePolicy() call produces a frozen decision envelope.
 * No side effects except writing to in-memory _decisions array.
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

function sha256prefix(str, len = 16) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, len);
}

// ── Sequential ID generator ───────────────────────────────────────────────────

let _policySeq = 0;
function nextPolicyId() {
  _policySeq += 1;
  return 'pol-' + _policySeq.toString(16).padStart(8, '0');
}

// ── Deep clone + freeze ───────────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(k => deepFreeze(obj[k]));
  return Object.freeze(obj);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Named policy implementations ──────────────────────────────────────────────

const POLICIES = {

  rollout_promotion(input) {
    const {
      consensusStatus, authorityLeaseSafe, fleetSuccessRate,
      desyncCount, observationElapsedMs, observationWindowMs, ringHealthScore,
    } = input;

    if (consensusStatus === 'SPLIT_BRAIN' || consensusStatus === 'AUTHORITY_LOSS') {
      return { decision: 'DENY', reason_codes: ['CONSENSUS_NOT_SAFE'] };
    }
    if (authorityLeaseSafe === false) {
      return { decision: 'DENY', reason_codes: ['NO_AUTHORITY_LEASE'] };
    }
    if (fleetSuccessRate < 98) {
      return { decision: 'DENY', reason_codes: ['FLEET_SUCCESS_RATE_BELOW_FLOOR'] };
    }
    if (desyncCount > 0) {
      return { decision: 'DENY', reason_codes: ['ACTIVE_DESYNC'] };
    }
    if (observationElapsedMs < observationWindowMs) {
      return { decision: 'DENY', reason_codes: ['OBSERVATION_WINDOW_NOT_ELAPSED'] };
    }
    if (ringHealthScore < 0.85) {
      return { decision: 'DENY', reason_codes: ['RING_HEALTH_SCORE_BELOW_FLOOR'] };
    }
    return { decision: 'ALLOW', reason_codes: ['ALL_CHECKS_PASSED'] };
  },

  rollout_freeze(input) {
    return { decision: 'FREEZE', reason_codes: [input.trigger ?? 'freeze_requested'] };
  },

  rollout_rollback(input) {
    const { trigger, recoveryFailures } = input;
    if (recoveryFailures > 3) {
      return { decision: 'FREEZE', reason_codes: ['EXCESSIVE_RECOVERY_FAILURES'] };
    }
    return { decision: 'ALLOW', reason_codes: [trigger ?? 'rollback_requested'] };
  },

  recovery_escalation(input) {
    const { escalationPolicy, attempts, maxRetries } = input;
    if (escalationPolicy === 'FATAL') {
      return { decision: 'ESCALATE', reason_codes: ['FATAL_RECOVERY_CATEGORY'] };
    }
    if (attempts > maxRetries) {
      return { decision: 'ESCALATE', reason_codes: ['MAX_RETRIES_EXCEEDED'] };
    }
    return { decision: 'ALLOW', reason_codes: ['RECOVERY_WITHIN_LIMITS'] };
  },

  operator_override(input) {
    const { justification, operatorId } = input;
    if (!justification) {
      return { decision: 'DENY', reason_codes: ['JUSTIFICATION_REQUIRED'] };
    }
    if (!operatorId) {
      return { decision: 'DENY', reason_codes: ['OPERATOR_ID_REQUIRED'] };
    }
    return { decision: 'REQUIRE_OPERATOR_APPROVAL', reason_codes: ['REQUIRES_APPROVAL'] };
  },

  manifest_rejection(input) {
    const { reason } = input;
    if (reason === 'integrity_failure') {
      return { decision: 'FREEZE', reason_codes: ['MANIFEST_INTEGRITY_VIOLATED'] };
    }
    return { decision: 'DENY', reason_codes: [reason ?? 'manifest_rejected'] };
  },
};

// ── Decision store ────────────────────────────────────────────────────────────

let _decisions = [];

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Evaluate a named policy against an input snapshot.
 *
 * @param {string} policyName
 * @param {object} input
 * @param {{ causedBy?: string }} [options]
 * @returns {object} frozen decision envelope
 */
function evaluatePolicy(policyName, input, options = {}) {
  const fn = POLICIES[policyName];
  if (!fn) throw new Error(`Unknown policy: ${policyName}`);

  const inputSnapshot = deepFreeze(deepClone(input));
  const inputHash     = sha256prefix(stableStringify(input));

  const { decision, reason_codes, evidence_refs } = fn(inputSnapshot);

  const policyHash = sha256prefix(stableStringify({
    policy_name: policyName,
    input_hash:  inputHash,
    decision,
    reason_codes,
  }));

  const envelope = Object.freeze({
    policy_id:       nextPolicyId(),
    policy_name:     policyName,
    input_snapshot:  inputSnapshot,
    input_hash:      inputHash,
    decision,
    reason_codes,
    evidence_refs:   evidence_refs ?? [],
    evaluated_at:    new Date().toISOString(),
    caused_by:       options.causedBy ?? null,
    policy_hash:     policyHash,
  });

  _decisions.push(envelope);
  return envelope;
}

function getDecisions() {
  return [..._decisions];
}

function saveDecisions(reportsDir) {
  const dir = reportsDir ?? path.join(process.cwd(), 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'policy-decisions.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), decisions: _decisions }, null, 2)
  );
}

function resetDecisions() {
  _decisions = [];
  _policySeq = 0;
}

module.exports = { evaluatePolicy, getDecisions, saveDecisions, resetDecisions };
