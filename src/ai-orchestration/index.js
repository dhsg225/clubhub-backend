'use strict';
/**
 * ai-orchestration — Phase A8 Governed AI Orchestration Layer
 *
 * H1: Same input context → same policy result (deterministic evaluation)
 * H2: All AI proposals traced before execution
 * H3: All AI actions replayable (decision traces)
 * H4: AI recursion bounded (BoundedExecutor max_depth)
 * H5: AI freeze awareness mandatory (PolicyEngine freeze check first)
 * H6: AI execution quotas enforced (BoundedExecutor rate buckets)
 * H7: AI cannot mutate state outside SDK (GovernedAgent routes all mutations)
 * H8: Policy denial stops execution immediately (no continuation after DENIED)
 *
 * AI is NEVER authoritative. Kernel remains authoritative.
 *
 * Public API:
 *   PolicyEngine         — deterministic policy evaluation
 *   GovernedAgent        — policy-bounded agent wrapper
 *   DecisionTrace        — hash-chained decision records
 *   OrchestrationRuntime — coordinator
 *   BoundedExecutor      — quota and recursion enforcement
 *   Explainability       — structured reasoning summaries
 *   createOrchestration  — factory
 *
 * Execution flow:
 *   GovernedAgent.propose() → BoundedExecutor.check()
 *     → DecisionTrace.create() → PolicyEngine.evaluate()
 *     → DENIED/FROZEN: stop immediately (H8)
 *     → REQUIRES_OPERATOR: pause, emit ai.operator.required
 *     → APPROVED: sdkClient.execute() → DecisionTrace.finalize()
 */
const { PolicyEngine, POLICY_RESULTS, POLICY_ACTIONS } = require('./policy-engine');
const { GovernedAgent }    = require('./governed-agent');
const { DecisionTrace }    = require('./decision-trace');
const { OrchestrationRuntime } = require('./orchestration-runtime');
const { BoundedExecutor, CHECK_RESULTS, DEFAULT_LIMITS } = require('./bounded-executor');
const { Explainability, EXPLANATION_TYPES } = require('./explainability');

/**
 * createOrchestration({ sdkClient, clock, eventBus, policies, limits, traceStore })
 *
 * Creates a fully wired OrchestrationRuntime ready for agent registration.
 */
function createOrchestration(deps = {}) {
  const policyEngine    = new PolicyEngine();
  const decisionTrace   = new DecisionTrace();
  const boundedExecutor = new BoundedExecutor(deps.limits ?? {});

  if (Array.isArray(deps.policies)) {
    policyEngine.loadPolicies(deps.policies);
  }

  return new OrchestrationRuntime({
    sdkClient:       deps.sdkClient,
    clock:           deps.clock,
    eventBus:        deps.eventBus ?? null,
    traceStore:      deps.traceStore ?? null,
    policyEngine,
    decisionTrace,
    boundedExecutor,
  });
}

/** Built-in canonical policy set for common governance scenarios. */
const CANONICAL_POLICIES = Object.freeze([
  {
    id:         'P-001',
    name:       'deny_direct_kernel_mutation',
    priority:   1000,
    action:     'deny',
    conditions: [],
    forbidden_actions: ['kernel.direct_write', 'kernel.bypass', 'db.direct_write'],
    permitted_actions: null,
  },
  {
    id:         'P-002',
    name:       'freeze_blocks_destructive_actions',
    priority:   900,
    action:     'freeze_on',
    conditions: [{ field: 'frozen', op: 'truthy' }],
    forbidden_actions: ['FREEZE', 'UNFREEZE', 'PROMOTE_WAVE', 'ROLLBACK_DEPLOYMENT'],
    permitted_actions: null,
  },
  {
    id:         'P-003',
    name:       'require_operator_for_epoch_increment',
    priority:   800,
    action:     'require_operator',
    conditions: [{ field: 'action_type', op: 'eq', value: 'INCREMENT_EPOCH' }],
    permitted_actions: null,
    forbidden_actions: null,
  },
  {
    id:         'P-004',
    name:       'rate_limit_standard',
    priority:   100,
    action:     'rate_limit',
    conditions: [],
    rate_limit: { max_per_minute: 60, max_per_hour: 500 },
    permitted_actions: null,
    forbidden_actions: null,
  },
  {
    id:         'P-005',
    name:       'allow_standard_operations',
    priority:   10,
    action:     'allow',
    conditions: [],
    permitted_actions: null,
    forbidden_actions: null,
  },
]);

module.exports = {
  // Classes
  PolicyEngine,
  GovernedAgent,
  DecisionTrace,
  OrchestrationRuntime,
  BoundedExecutor,
  Explainability,

  // Constants
  POLICY_RESULTS,
  POLICY_ACTIONS,
  CHECK_RESULTS,
  DEFAULT_LIMITS,
  EXPLANATION_TYPES,
  CANONICAL_POLICIES,

  // Factory
  createOrchestration,

  // Orchestration mode marker
  ORCHESTRATION_MODE: 'GOVERNED_AUTONOMOUS',
};
