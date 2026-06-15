'use strict';
/**
 * autonomous-rollout.js
 *
 * Evidence-driven ring promotion evaluation.
 * Does NOT call store.promoteRing() — it evaluates whether promotion is safe
 * and returns a structured recommendation. Actual promotion is the caller's
 * responsibility after reviewing the outcome.
 */

// ── Deep freeze helper ────────────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(k => deepFreeze(obj[k]));
  return Object.freeze(obj);
}

// ── Promotion evaluation ──────────────────────────────────────────────────────

/**
 * Evaluate whether a ring promotion is safe.
 *
 * @param {object} opts
 * @param {string}  opts.currentState
 * @param {object}  opts.metrics              — { fleetSuccessRate, ringHealthScore, desyncCount, adoptionPct, recoveryFailures, manifestRejectionRate }
 * @param {number}  opts.observationElapsedMs
 * @param {number}  opts.observationWindowMs
 * @param {string}  opts.consensusStatus
 * @param {boolean} opts.authorityLeaseSafe
 * @param {object}  opts.policyEngine         — policy-engine module reference (required)
 * @param {object}  [opts.thresholds]
 * @returns {{ outcome, policy_decision, evidence_snapshot, evaluated_at, reason }}
 */
function evaluatePromotion(opts) {
  const {
    currentState,
    metrics = {},
    observationElapsedMs,
    observationWindowMs,
    consensusStatus,
    authorityLeaseSafe,
    policyEngine,
    thresholds,
  } = opts;

  if (!policyEngine || typeof policyEngine.evaluatePolicy !== 'function') {
    throw new Error('evaluatePromotion requires opts.policyEngine with evaluatePolicy()');
  }

  const {
    fleetSuccessRate   = 0,
    ringHealthScore    = 0,
    desyncCount        = 0,
    adoptionPct        = 0,
    recoveryFailures   = 0,
    manifestRejectionRate = 0,
  } = metrics;

  const inputSnapshot = {
    currentState,
    fleetSuccessRate,
    ringHealthScore,
    desyncCount,
    adoptionPct,
    observationElapsedMs,
    observationWindowMs,
    consensusStatus,
    authorityLeaseSafe,
  };

  const policy_decision = policyEngine.evaluatePolicy('rollout_promotion', inputSnapshot);

  const evidence_snapshot = deepFreeze({
    currentState,
    metrics: {
      fleetSuccessRate,
      ringHealthScore,
      desyncCount,
      adoptionPct,
      recoveryFailures,
      manifestRejectionRate,
    },
    observationElapsedMs,
    observationWindowMs,
    consensusStatus,
    authorityLeaseSafe,
    thresholds: thresholds ?? null,
  });

  let outcome;
  let reason;

  if (policy_decision.decision === 'ALLOW') {
    outcome = 'PROMOTE';
    reason  = 'All promotion checks passed';
  } else if (policy_decision.decision === 'FREEZE') {
    outcome = 'FREEZE';
    reason  = policy_decision.reason_codes.join(', ');
  } else if (policy_decision.decision === 'ESCALATE') {
    outcome = 'REQUIRE_REVIEW';
    reason  = policy_decision.reason_codes.join(', ');
  } else {
    // DENY — map by reason code
    const reason_code = policy_decision.reason_codes[0];
    if (reason_code === 'OBSERVATION_WINDOW_NOT_ELAPSED') {
      outcome = 'HOLD';
      reason  = 'Observation window has not elapsed yet';
    } else if (reason_code === 'FLEET_SUCCESS_RATE_BELOW_FLOOR' && recoveryFailures > 2) {
      outcome = 'ROLLBACK';
      reason  = 'Fleet success rate below floor with excessive recovery failures';
    } else if (reason_code === 'CONSENSUS_NOT_SAFE' || reason_code === 'NO_AUTHORITY_LEASE') {
      outcome = 'FREEZE';
      reason  = reason_code;
    } else {
      outcome = 'HOLD';
      reason  = reason_code;
    }
  }

  return {
    outcome,
    policy_decision,
    evidence_snapshot,
    evaluated_at: new Date().toISOString(),
    reason,
  };
}

// ── Rollback evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate whether a rollback should proceed or be blocked.
 *
 * @param {object} opts
 * @param {string}  opts.trigger
 * @param {number}  opts.adoptionPct
 * @param {number}  opts.recoveryFailures
 * @param {object}  opts.policyEngine
 * @returns {{ outcome, policy_decision, evidence_snapshot, evaluated_at, reason }}
 */
function evaluateRollback(opts) {
  const {
    trigger          = 'operator_requested',
    adoptionPct      = 0,
    recoveryFailures = 0,
    policyEngine,
  } = opts;

  if (!policyEngine || typeof policyEngine.evaluatePolicy !== 'function') {
    throw new Error('evaluateRollback requires opts.policyEngine with evaluatePolicy()');
  }

  const inputSnapshot = { trigger, adoptionPct, recoveryFailures };

  const policy_decision = policyEngine.evaluatePolicy('rollout_rollback', inputSnapshot);

  const evidence_snapshot = deepFreeze({ trigger, adoptionPct, recoveryFailures });

  let outcome;
  let reason;

  if (policy_decision.decision === 'ALLOW') {
    outcome = 'PROMOTE';  // In rollback context, ALLOW means "proceed with rollback"
    reason  = trigger;
  } else if (policy_decision.decision === 'FREEZE') {
    outcome = 'FREEZE';
    reason  = policy_decision.reason_codes.join(', ');
  } else {
    outcome = 'HOLD';
    reason  = policy_decision.reason_codes.join(', ');
  }

  return {
    outcome,
    policy_decision,
    evidence_snapshot,
    evaluated_at: new Date().toISOString(),
    reason,
  };
}

module.exports = { evaluatePromotion, evaluateRollback };
