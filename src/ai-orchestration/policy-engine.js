'use strict';
/**
 * PolicyEngine — deterministic policy evaluation for governed AI orchestration.
 *
 * H1: Same context + same policy set → identical result (no Date.now, no randomness).
 * H8: DENIED result stops execution immediately — callers must respect this.
 *
 * Policy schema:
 *   {
 *     id:                string,
 *     name:              string,
 *     priority:          number (higher wins on conflict),
 *     action:            'allow' | 'deny' | 'require_operator' | 'require_quorum' | 'freeze_on',
 *     permitted_actions: string[] | null  (null = all permitted),
 *     forbidden_actions: string[] | null,
 *     rate_limit:        { max_per_minute: N, max_per_hour: N } | null,
 *     max_depth:         number | null,
 *     conditions:        Condition[],     (ALL must match for policy to apply)
 *   }
 *
 * Condition schema:
 *   { field: string, op: 'eq'|'neq'|'gt'|'gte'|'lt'|'lte'|'in'|'not_in'|'truthy'|'falsy', value: any }
 *
 * Evaluation context:
 *   {
 *     frozen:            boolean,
 *     epoch:             number,
 *     incident_count:    number,
 *     agent_id:          string,
 *     workflow_id:       string,
 *     action_type:       string,
 *     depth:             number,
 *     lineage_ts:        number,    (virtual clock ms)
 *     rate_state:        { calls_last_minute: N, calls_last_hour: N },
 *   }
 *
 * Result values:
 *   APPROVED          — execute immediately
 *   DENIED            — stop immediately (H8)
 *   REQUIRES_OPERATOR — pause for human approval
 *   FROZEN            — cluster frozen, action blocked
 */

const POLICY_RESULTS = Object.freeze({
  APPROVED:          'APPROVED',
  DENIED:            'DENIED',
  REQUIRES_OPERATOR: 'REQUIRES_OPERATOR',
  FROZEN:            'FROZEN',
});

const POLICY_ACTIONS = Object.freeze({
  ALLOW:            'allow',
  DENY:             'deny',
  REQUIRE_OPERATOR: 'require_operator',
  REQUIRE_QUORUM:   'require_quorum',
  FREEZE_ON:        'freeze_on',
  RATE_LIMIT:       'rate_limit',
});

class PolicyEngine {
  constructor() {
    this._policies = [];   // sorted by priority desc at load time
  }

  /**
   * Load a set of policies, sorted by priority (highest first).
   * Replaces any previously loaded policies.
   */
  loadPolicies(policies) {
    if (!Array.isArray(policies)) throw new TypeError('policies must be an array');
    this._policies = [...policies].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this._policies.length;
  }

  /**
   * Append a single policy without replacing existing ones.
   * Maintains priority sort order.
   */
  addPolicy(policy) {
    this._policies.push(policy);
    this._policies.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Remove a policy by id.
   */
  removePolicy(id) {
    const before = this._policies.length;
    this._policies = this._policies.filter(p => p.id !== id);
    return this._policies.length < before;
  }

  getPolicies() { return [...this._policies]; }

  /**
   * Evaluate context + proposedAction against all loaded policies.
   *
   * Evaluation order:
   *   1. Freeze check (H5: AI freeze awareness mandatory)
   *   2. Forbidden actions (unconditional deny)
   *   3. Policy set in priority order — first match wins
   *   4. Default: APPROVED (open unless denied)
   *
   * @returns {object} { result, reason, matched_rule, explanation, policy_id }
   */
  evaluate(context, proposedAction) {
    // H5: Freeze check takes absolute precedence
    if (context.frozen) {
      return this._result(POLICY_RESULTS.FROZEN, null, 'cluster_frozen',
        `Action '${proposedAction.action_type}' blocked: cluster is frozen`);
    }

    // H4: Depth check (recursion ceiling)
    if (typeof proposedAction.depth === 'number' && proposedAction.depth > 0) {
      const maxDepthPolicy = this._policies.find(p => p.max_depth != null);
      const ceiling = maxDepthPolicy?.max_depth ?? 10;
      if (proposedAction.depth > ceiling) {
        return this._result(POLICY_RESULTS.DENIED, maxDepthPolicy?.id ?? 'recursion_ceiling',
          'depth_exceeded',
          `Recursion depth ${proposedAction.depth} exceeds ceiling ${ceiling}`);
      }
    }

    // Evaluate each policy in priority order
    for (const policy of this._policies) {
      if (!this._matchesConditions(context, proposedAction, policy)) continue;

      // Forbidden actions unconditionally deny
      if (Array.isArray(policy.forbidden_actions) &&
          policy.forbidden_actions.includes(proposedAction.action_type)) {
        return this._result(POLICY_RESULTS.DENIED, policy.id, 'forbidden_action',
          `Action '${proposedAction.action_type}' is explicitly forbidden by policy '${policy.name}'`);
      }

      // Permitted actions check
      if (Array.isArray(policy.permitted_actions) &&
          !policy.permitted_actions.includes(proposedAction.action_type)) {
        return this._result(POLICY_RESULTS.DENIED, policy.id, 'action_not_permitted',
          `Action '${proposedAction.action_type}' is not in permitted_actions of policy '${policy.name}'`);
      }

      // Rate limit check
      if (policy.rate_limit && context.rate_state) {
        if (policy.rate_limit.max_per_minute != null &&
            context.rate_state.calls_last_minute >= policy.rate_limit.max_per_minute) {
          return this._result(POLICY_RESULTS.DENIED, policy.id, 'rate_limit_per_minute',
            `Rate limit exceeded: ${context.rate_state.calls_last_minute}/${policy.rate_limit.max_per_minute} calls/min`);
        }
        if (policy.rate_limit.max_per_hour != null &&
            context.rate_state.calls_last_hour >= policy.rate_limit.max_per_hour) {
          return this._result(POLICY_RESULTS.DENIED, policy.id, 'rate_limit_per_hour',
            `Rate limit exceeded: ${context.rate_state.calls_last_hour}/${policy.rate_limit.max_per_hour} calls/hour`);
        }
      }

      // Map policy action to result
      switch (policy.action) {
        case POLICY_ACTIONS.ALLOW:
          return this._result(POLICY_RESULTS.APPROVED, policy.id, 'policy_allow',
            `Approved by policy '${policy.name}'`);

        case POLICY_ACTIONS.DENY:
          return this._result(POLICY_RESULTS.DENIED, policy.id, 'policy_deny',
            `Denied by policy '${policy.name}'`);

        case POLICY_ACTIONS.REQUIRE_OPERATOR:
        case POLICY_ACTIONS.REQUIRE_QUORUM:
          return this._result(POLICY_RESULTS.REQUIRES_OPERATOR, policy.id, 'requires_operator',
            `Policy '${policy.name}' requires operator approval`);

        case POLICY_ACTIONS.FREEZE_ON:
          return this._result(POLICY_RESULTS.FROZEN, policy.id, 'policy_freeze_on',
            `Policy '${policy.name}' mandates freeze during this condition`);

        case POLICY_ACTIONS.RATE_LIMIT:
          // Rate limit already handled above; if we reach here it passed
          return this._result(POLICY_RESULTS.APPROVED, policy.id, 'rate_limit_pass',
            `Within rate limits defined by policy '${policy.name}'`);
      }
    }

    // Default: no matching policy → APPROVED (open system unless denied)
    return this._result(POLICY_RESULTS.APPROVED, null, 'no_policy_matched',
      `No policy matched — default APPROVED`);
  }

  // ——— Condition Evaluation ——————————————————————————————————————————

  _matchesConditions(context, proposedAction, policy) {
    if (!Array.isArray(policy.conditions) || policy.conditions.length === 0) return true;

    // Flatten context + proposedAction into a single lookup map
    const lookup = { ...context, ...proposedAction };

    return policy.conditions.every(cond => this._evalCondition(lookup, cond));
  }

  _evalCondition(lookup, cond) {
    const actual = cond.field.split('.').reduce((obj, k) => obj?.[k], lookup);
    const { op, value } = cond;

    switch (op) {
      case 'eq':      return actual === value;
      case 'neq':     return actual !== value;
      case 'gt':      return actual > value;
      case 'gte':     return actual >= value;
      case 'lt':      return actual < value;
      case 'lte':     return actual <= value;
      case 'in':      return Array.isArray(value) && value.includes(actual);
      case 'not_in':  return Array.isArray(value) && !value.includes(actual);
      case 'truthy':  return !!actual;
      case 'falsy':   return !actual;
      default:        return false;
    }
  }

  // ——— Result Builder ————————————————————————————————————————————————

  _result(result, policy_id, reason, detail) {
    return Object.freeze({ result, policy_id: policy_id ?? null, reason, detail });
  }
}

module.exports = { PolicyEngine, POLICY_RESULTS, POLICY_ACTIONS };
