'use strict';
/**
 * PolicyEvaluator — deterministic evaluation engine for operational policies.
 * Same input → same result. No Date.now(). No Math.random().
 */

const EVAL_RESULTS = Object.freeze({
  ALLOWED:          'ALLOWED',
  DENIED:           'DENIED',
  QUOTA_EXCEEDED:   'QUOTA_EXCEEDED',
  REQUIRES_APPROVAL:'REQUIRES_APPROVAL',
});

class PolicyEvaluator {
  constructor() {
    this._policies = [];  // sorted by priority desc
  }

  loadPolicies(policies) {
    this._policies = [...policies].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  addPolicy(policy) {
    this._policies.push(policy);
    this._policies.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  evaluate(context, request) {
    for (const policy of this._policies) {
      if (!this._matches(context, request, policy)) continue;
      return { result: this._mapAction(policy.action), policy_id: policy.id, reason: policy.reason ?? policy.action };
    }
    return { result: EVAL_RESULTS.ALLOWED, policy_id: null, reason: 'default_allow' };
  }

  _matches(context, request, policy) {
    if (!policy.conditions || policy.conditions.length === 0) return true;
    return policy.conditions.every(c => this._evalCondition(context, request, c));
  }

  _evalCondition(context, request, cond) {
    const lookup = { ...context, ...request };
    const val    = lookup[cond.field];
    switch (cond.op) {
      case 'eq':      return val === cond.value;
      case 'neq':     return val !== cond.value;
      case 'gt':      return val >  cond.value;
      case 'gte':     return val >= cond.value;
      case 'lt':      return val <  cond.value;
      case 'lte':     return val <= cond.value;
      case 'truthy':  return !!val;
      case 'falsy':   return !val;
      case 'in':      return Array.isArray(cond.value) && cond.value.includes(val);
      case 'not_in':  return Array.isArray(cond.value) && !cond.value.includes(val);
      default:        return false;
    }
  }

  _mapAction(action) {
    switch (action) {
      case 'allow':            return EVAL_RESULTS.ALLOWED;
      case 'deny':             return EVAL_RESULTS.DENIED;
      case 'quota_exceeded':   return EVAL_RESULTS.QUOTA_EXCEEDED;
      case 'require_approval': return EVAL_RESULTS.REQUIRES_APPROVAL;
      default:                 return EVAL_RESULTS.DENIED;
    }
  }

  getPolicies() { return [...this._policies]; }
}

module.exports = { PolicyEvaluator, EVAL_RESULTS };
