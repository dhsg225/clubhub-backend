'use strict';
/**
 * DecisionTrace — hash-chained AI decision records.
 *
 * H2: Every AI proposal is traceable before execution.
 * H3: Traces contain enough information to replay identical decision sequences.
 *
 * Trace format:
 *   decision_id       string   deterministic counter-based ID
 *   agent_id          string
 *   workflow_id       string
 *   prompt_hash       string   sha256 of prompt/proposal content
 *   context_hash      string   sha256 of evaluation context
 *   proposed_action   object   { action_type, args }
 *   policy_result     string   APPROVED | DENIED | REQUIRES_OPERATOR | FROZEN
 *   policy_id         string   matched policy id (nullable)
 *   reason            string   policy reason code
 *   execution_result  object   null until finalized
 *   lineage_ts        number   virtual clock ms
 *   prev_hash         string   hash of preceding entry (chain)
 *   replay_hash       string   sha256 of (all above fields)
 *
 * The trace chain is append-only. finalize() fills execution_result and
 * computes the final replay_hash including the outcome.
 */
const crypto = require('node:crypto');

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function sha256(obj) {
  return crypto.createHash('sha256').update(stableStringify(obj)).digest('hex');
}

class DecisionTrace {
  constructor() {
    this._entries   = [];   // append-only
    this._seq       = 0;
    this._prev_hash = '0'.repeat(64);
  }

  /**
   * Create a new decision record before policy evaluation.
   * Returns the decision_id for later finalization.
   *
   * @param {object} opts
   *   agent_id, workflow_id, proposed_action, context, lineage_ts
   */
  create(opts = {}) {
    const {
      agent_id       = 'unknown',
      workflow_id    = 'unknown',
      proposed_action = {},
      context        = {},
      lineage_ts     = 0,
    } = opts;

    const decision_id    = `dec_${agent_id}_${++this._seq}`;
    const prompt_hash    = sha256(proposed_action);
    const context_hash   = sha256(context);

    const pending = {
      decision_id,
      agent_id,
      workflow_id,
      prompt_hash,
      context_hash,
      proposed_action:  Object.freeze({ ...proposed_action }),
      policy_result:    null,   // filled by evaluate()
      policy_id:        null,
      reason:           null,
      execution_result: null,   // filled by finalize()
      lineage_ts,
      prev_hash:        this._prev_hash,
      replay_hash:      null,   // filled by finalize()
      _finalized:       false,
    };

    this._entries.push(pending);
    return decision_id;
  }

  /**
   * Record policy evaluation result on an existing pending entry.
   * Called immediately after PolicyEngine.evaluate().
   */
  recordPolicy(decision_id, policyEval) {
    const entry = this._findPending(decision_id);
    if (!entry) throw new Error(`DecisionTrace: unknown decision_id '${decision_id}'`);
    entry.policy_result = policyEval.result;
    entry.policy_id     = policyEval.policy_id ?? null;
    entry.reason        = policyEval.reason ?? null;
  }

  /**
   * Finalize a decision — set execution_result and compute replay_hash.
   * After this call the entry is immutable and hash-chained.
   *
   * @param {string} decision_id
   * @param {object} execution_result  — { status, outcome } or null on denial
   */
  finalize(decision_id, execution_result = null) {
    const entry = this._findPending(decision_id);
    if (!entry) throw new Error(`DecisionTrace: unknown decision_id '${decision_id}'`);
    if (entry._finalized) throw new Error(`DecisionTrace: already finalized '${decision_id}'`);

    entry.execution_result = execution_result;

    // Compute replay_hash over all deterministic fields
    const hashable = {
      decision_id:      entry.decision_id,
      agent_id:         entry.agent_id,
      workflow_id:      entry.workflow_id,
      prompt_hash:      entry.prompt_hash,
      context_hash:     entry.context_hash,
      proposed_action:  entry.proposed_action,
      policy_result:    entry.policy_result,
      policy_id:        entry.policy_id,
      reason:           entry.reason,
      execution_result: entry.execution_result,
      lineage_ts:       entry.lineage_ts,
      prev_hash:        entry.prev_hash,
    };

    entry.replay_hash = sha256(hashable);
    entry._finalized  = true;

    // Advance chain pointer for next entry
    this._prev_hash = entry.replay_hash;

    return Object.freeze({ ...entry });
  }

  /**
   * Verify hash chain integrity.
   * Returns { valid, broken_at, reason }.
   */
  verifyChain() {
    let prevHash = '0'.repeat(64);

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];
      if (!entry._finalized) continue; // skip pending entries

      if (entry.prev_hash !== prevHash) {
        return { valid: false, broken_at: i, reason: 'prev_hash_mismatch' };
      }

      // Recompute
      const hashable = {
        decision_id:      entry.decision_id,
        agent_id:         entry.agent_id,
        workflow_id:      entry.workflow_id,
        prompt_hash:      entry.prompt_hash,
        context_hash:     entry.context_hash,
        proposed_action:  entry.proposed_action,
        policy_result:    entry.policy_result,
        policy_id:        entry.policy_id,
        reason:           entry.reason,
        execution_result: entry.execution_result,
        lineage_ts:       entry.lineage_ts,
        prev_hash:        entry.prev_hash,
      };
      const computed = sha256(hashable);
      if (computed !== entry.replay_hash) {
        return { valid: false, broken_at: i, reason: 'hash_mismatch', computed, stored: entry.replay_hash };
      }

      prevHash = entry.replay_hash;
    }

    return { valid: true, broken_at: null, reason: null };
  }

  /**
   * Get all finalized entries (safe for export / persistence).
   */
  getFinalized() {
    return this._entries
      .filter(e => e._finalized)
      .map(e => Object.freeze({ ...e }));
  }

  getAll()   { return this._entries.map(e => ({ ...e })); }
  getCount() { return this._entries.length; }

  /**
   * Rebuild a DecisionTrace from a persisted sequence (for replay).
   * Returns { valid, trace } where trace is a new DecisionTrace instance.
   */
  static rebuild(entries) {
    const dt = new DecisionTrace();
    let prevHash = '0'.repeat(64);

    for (const entry of entries) {
      const hashable = {
        decision_id:      entry.decision_id,
        agent_id:         entry.agent_id,
        workflow_id:      entry.workflow_id,
        prompt_hash:      entry.prompt_hash,
        context_hash:     entry.context_hash,
        proposed_action:  entry.proposed_action,
        policy_result:    entry.policy_result,
        policy_id:        entry.policy_id,
        reason:           entry.reason,
        execution_result: entry.execution_result,
        lineage_ts:       entry.lineage_ts,
        prev_hash:        prevHash,
      };
      const computed = sha256(hashable);
      if (computed !== entry.replay_hash) {
        return { valid: false, broken_at: entry.decision_id, trace: null };
      }
      dt._entries.push({ ...entry, _finalized: true });
      dt._prev_hash = entry.replay_hash;
      dt._seq++;
      prevHash = entry.replay_hash;
    }

    return { valid: true, trace: dt };
  }

  _findPending(id) {
    return this._entries.find(e => e.decision_id === id && !e._finalized) ?? null;
  }
}

module.exports = { DecisionTrace, stableStringify, sha256 };
