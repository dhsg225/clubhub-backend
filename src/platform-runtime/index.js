'use strict';
const { PlatformRuntime, LIFECYCLE_STATES, RUNTIME_STATES } = require('./platform-runtime');
const { LifecycleCoordinator, VALID_TRANSITIONS }           = require('./lifecycle-coordinator');
const { RuntimeRegistry }                                    = require('./runtime-registry');
const { TopologyManager, ENTITY_TYPES }                     = require('./topology-manager');
const { HealthModel, HEALTH_STATUS, HEALTH_DIMENSIONS }     = require('./health-model');
const { ConvergenceEngine, DIVERGENCE_CODES }               = require('./convergence-engine');
const { ReplayOrchestrator, REPLAY_TYPES }                  = require('./replay-orchestrator');
const { ExecutionRouter, EXECUTION_SOURCES }                = require('./execution-router');
const { DeterministicBootstrap, BOOTSTRAP_PHASES }         = require('./deterministic-bootstrap');
const { DeterministicShutdown }                             = require('./deterministic-shutdown');

function createPlatformRuntime(deps = {}) {
  return new PlatformRuntime(deps);
}

module.exports = {
  // Factory
  createPlatformRuntime,

  // Core classes
  PlatformRuntime,
  LifecycleCoordinator,
  RuntimeRegistry,
  TopologyManager,
  HealthModel,
  ConvergenceEngine,
  ReplayOrchestrator,
  ExecutionRouter,
  DeterministicBootstrap,
  DeterministicShutdown,

  // Constants
  LIFECYCLE_STATES,
  RUNTIME_STATES,
  VALID_TRANSITIONS,
  ENTITY_TYPES,
  HEALTH_STATUS,
  HEALTH_DIMENSIONS,
  DIVERGENCE_CODES,
  REPLAY_TYPES,
  EXECUTION_SOURCES,
  BOOTSTRAP_PHASES,
};
