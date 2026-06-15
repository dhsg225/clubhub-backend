'use strict';
/**
 * Explainability — structured, deterministic reasoning summaries for AI decisions.
 *
 * H1: Same decision trace → same explanation output (no nondeterministic generation).
 *
 * ALLOWED outputs:
 *   - rule matched
 *   - policy violated
 *   - action denied
 *   - quota exceeded
 *   - freeze active
 *
 * FORBIDDEN:
 *   - nondeterministic narrative generation
 *   - stochastic reasoning
 *   - hidden chain-of-thought persistence
 *
 * All explanations are structured JSON objects — never free-form strings.
 */

const EXPLANATION_TYPES = Object.freeze({
  POLICY_ALLOW:       'POLICY_ALLOW',
  POLICY_DENIAL:      'POLICY_DENIAL',
  FREEZE_BLOCKED:     'FREEZE_BLOCKED',
  QUOTA_EXCEEDED:     'QUOTA_EXCEEDED',
  RECURSION_CEILING:  'RECURSION_CEILING',
  RATE_LIMITED:       'RATE_LIMITED',
  OPERATOR_REQUIRED:  'OPERATOR_REQUIRED',
  EXECUTION_COMPLETE: 'EXECUTION_COMPLETE',
  EXECUTION_FAILED:   'EXECUTION_FAILED',
  REPLAY_VERIFIED:    'REPLAY_VERIFIED',
  REPLAY_MISMATCH:    'REPLAY_MISMATCH',
});

class Explainability {
  /**
   * Generate a structured explanation from a finalized decision trace entry.
   *
   * @param {object} traceEntry — finalized DecisionTrace entry
   * @returns {object} structured explanation
   */
  explainDecision(traceEntry) {
    const { policy_result, reason, policy_id, proposed_action,
            decision_id, agent_id, workflow_id, lineage_ts,
            execution_result } = traceEntry;

    const base = {
      decision_id,
      agent_id,
      workflow_id,
      action_type:   proposed_action?.action_type ?? 'unknown',
      lineage_ts,
      policy_result,
    };

    switch (policy_result) {
      case 'APPROVED':
        return Object.freeze({
          ...base,
          type:        EXPLANATION_TYPES.POLICY_ALLOW,
          rule_matched: policy_id ?? 'default_allow',
          reason,
          outcome:     execution_result?.status ?? 'executed',
        });

      case 'DENIED':
        return Object.freeze({
          ...base,
          type:            EXPLANATION_TYPES.POLICY_DENIAL,
          rule_violated:   policy_id,
          violation_reason: reason,
          execution_blocked: true,
        });

      case 'FROZEN':
        return Object.freeze({
          ...base,
          type:              EXPLANATION_TYPES.FREEZE_BLOCKED,
          rule_triggered:    policy_id ?? 'freeze_check',
          freeze_reason:     reason,
          execution_blocked: true,
        });

      case 'REQUIRES_OPERATOR':
        return Object.freeze({
          ...base,
          type:              EXPLANATION_TYPES.OPERATOR_REQUIRED,
          rule_triggered:    policy_id,
          approval_required: true,
          reason,
        });

      default:
        return Object.freeze({
          ...base,
          type:   'UNKNOWN',
          reason: `Unrecognized policy_result: ${policy_result}`,
        });
    }
  }

  /**
   * Explain a quota or rate limit boundary check result.
   *
   * @param {object} checkResult — from BoundedExecutor.check()
   * @param {string} agent_id
   * @param {string} action_type
   */
  explainBoundaryCheck(checkResult, agent_id, action_type) {
    const base = { agent_id, action_type, check_result: checkResult.result };

    switch (checkResult.result) {
      case 'OK':
        return Object.freeze({ ...base, type: 'BOUNDARY_OK', blocked: false });

      case 'QUOTA_EXCEEDED':
        return Object.freeze({
          ...base, type: EXPLANATION_TYPES.QUOTA_EXCEEDED,
          blocked: true, detail: checkResult.detail,
        });

      case 'RECURSION_CEILING':
        return Object.freeze({
          ...base, type: EXPLANATION_TYPES.RECURSION_CEILING,
          blocked: true, detail: checkResult.detail,
        });

      case 'RATE_MINUTE':
        return Object.freeze({
          ...base, type: EXPLANATION_TYPES.RATE_LIMITED,
          window: 'per_minute', blocked: true, detail: checkResult.detail,
        });

      case 'RATE_HOUR':
        return Object.freeze({
          ...base, type: EXPLANATION_TYPES.RATE_LIMITED,
          window: 'per_hour', blocked: true, detail: checkResult.detail,
        });

      default:
        return Object.freeze({ ...base, type: 'UNKNOWN_BOUNDARY', blocked: true });
    }
  }

  /**
   * Explain a full execution outcome (post-execution summary).
   */
  explainExecution(traceEntry, executionResult) {
    const success = executionResult?.status === 'COMPLETED' || executionResult?.status === 'OK';
    return Object.freeze({
      type:         success ? EXPLANATION_TYPES.EXECUTION_COMPLETE : EXPLANATION_TYPES.EXECUTION_FAILED,
      decision_id:  traceEntry.decision_id,
      agent_id:     traceEntry.agent_id,
      workflow_id:  traceEntry.workflow_id,
      action_type:  traceEntry.proposed_action?.action_type,
      lineage_ts:   traceEntry.lineage_ts,
      status:       executionResult?.status ?? 'UNKNOWN',
      error:        executionResult?.error ?? null,
    });
  }

  /**
   * Explain a replay verification outcome.
   */
  explainReplay(original, replayed) {
    const match = original.replay_hash === replayed.replay_hash;
    return Object.freeze({
      type:             match ? EXPLANATION_TYPES.REPLAY_VERIFIED : EXPLANATION_TYPES.REPLAY_MISMATCH,
      decision_id:      original.decision_id,
      original_hash:    original.replay_hash,
      replayed_hash:    replayed.replay_hash,
      equivalence:      match,
      divergence_field: match ? null : this._findDivergence(original, replayed),
    });
  }

  /**
   * Generate a summary of all decisions in a trace sequence.
   * Structured catalog — no narratives.
   */
  summarizeTrace(entries) {
    const counts = { APPROVED: 0, DENIED: 0, FROZEN: 0, REQUIRES_OPERATOR: 0 };
    for (const e of entries) {
      if (e.policy_result && counts[e.policy_result] !== undefined) counts[e.policy_result]++;
    }
    return Object.freeze({
      type:             'TRACE_SUMMARY',
      decision_count:   entries.length,
      policy_outcomes:  counts,
      denied_actions:   entries.filter(e => e.policy_result === 'DENIED')
                               .map(e => ({ decision_id: e.decision_id, action_type: e.proposed_action?.action_type, reason: e.reason })),
      frozen_blocks:    entries.filter(e => e.policy_result === 'FROZEN').length,
      operator_pauses:  entries.filter(e => e.policy_result === 'REQUIRES_OPERATOR').length,
    });
  }

  // ——— Private ——————————————————————————————————————————————————————

  _findDivergence(a, b) {
    const keys = ['policy_result', 'reason', 'policy_id', 'execution_result', 'prompt_hash', 'context_hash'];
    for (const k of keys) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return k;
    }
    return 'unknown';
  }
}

module.exports = { Explainability, EXPLANATION_TYPES };
