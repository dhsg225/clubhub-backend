'use strict';
const { PolicyEvaluator, EVAL_RESULTS }   = require('./policy-evaluator');
const { PolicyRegistry }                  = require('./policy-registry');
const { DEPLOYMENT_POLICIES }             = require('./deployment-policy');
const { TenantQuotaPolicy, DEFAULT_QUOTAS}= require('./tenant-quota-policy');
const { REPLAY_POLICIES }                 = require('./replay-auth-policy');
const { EXPORT_POLICIES }                 = require('./export-auth-policy');

function createOperationalPolicy(opts = {}) {
  const registry  = new PolicyRegistry();
  const evaluator = new PolicyEvaluator();

  // Publish canonical policies
  for (const p of [...DEPLOYMENT_POLICIES, ...REPLAY_POLICIES, ...EXPORT_POLICIES]) {
    registry.publish(p);
  }
  evaluator.loadPolicies(registry.list());

  return { registry, evaluator };
}

module.exports = {
  createOperationalPolicy,
  PolicyEvaluator,
  PolicyRegistry,
  TenantQuotaPolicy,
  EVAL_RESULTS,
  DEFAULT_QUOTAS,
  DEPLOYMENT_POLICIES,
  REPLAY_POLICIES,
  EXPORT_POLICIES,
};
