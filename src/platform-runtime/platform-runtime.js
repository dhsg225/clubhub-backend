'use strict';
/**
 * PlatformRuntime — single operational entry point for the entire governed platform.
 * Owns all subsystem instances. Coordinates lifecycle. Enforces authority hierarchy.
 */

const { RuntimeRegistry, RUNTIME_STATES } = require('./runtime-registry');
const { LifecycleCoordinator, LIFECYCLE_STATES } = require('./lifecycle-coordinator');
const { TopologyManager, ENTITY_TYPES } = require('./topology-manager');
const { ConvergenceEngine } = require('./convergence-engine');
const { DeterministicBootstrap } = require('./deterministic-bootstrap');
const { DeterministicShutdown } = require('./deterministic-shutdown');
const { ReplayOrchestrator } = require('./replay-orchestrator');
const { ExecutionRouter, EXECUTION_SOURCES } = require('./execution-router');
const { HealthModel, HEALTH_STATUS } = require('./health-model');

class PlatformRuntime {
  /**
   * @param {object} deps
   *   kernel, sdk, traceStore, agentRuntime, orchestration, simulation, operatorUI, otaRuntime, eventBus
   */
  constructor(deps = {}) {
    this._deps      = deps;
    this._registry  = new RuntimeRegistry();
    this._lifecycle = new LifecycleCoordinator({
      eventBus:   deps.eventBus   ?? null,
      traceStore: deps.traceStore ?? null,
    });
    this._topology  = new TopologyManager({ eventBus: deps.eventBus ?? null });
    this._health    = new HealthModel();
    this._replay    = new ReplayOrchestrator({
      traceStore:           deps.traceStore    ?? null,
      decisionTrace:        deps.orchestration?.decisionTrace ?? null,
      orchestrationRuntime: deps.orchestration ?? null,
      simulationRuntime:    deps.simulation    ?? null,
      clock:                deps.kernel?.clock ?? null,
      eventBus:             deps.eventBus      ?? null,
    });
    this._convergence = new ConvergenceEngine({
      lifecycle:     this._lifecycle,
      registry:      this._registry,
      topology:      this._topology,
      traceStore:    deps.traceStore    ?? null,
      decisionTrace: deps.orchestration?.decisionTrace ?? null,
      orchestration: deps.orchestration ?? null,
      eventBus:      deps.eventBus      ?? null,
    });
    this._executionRouter = new ExecutionRouter({
      sdkClient:            deps.sdk?.client     ?? null,
      eventBus:             deps.eventBus         ?? null,
      lifecycleCoordinator: this._lifecycle,
      traceStore:           deps.traceStore        ?? null,
    });
    this._bootstrap = new DeterministicBootstrap({
      registry:  this._registry,
      lifecycle: this._lifecycle,
      eventBus:  deps.eventBus ?? null,
    });
    this._shutdown = new DeterministicShutdown({
      registry:  this._registry,
      lifecycle: this._lifecycle,
      eventBus:  deps.eventBus ?? null,
    });
    this._initialized = false;
  }

  async init() {
    await this._lifecycle.transition(LIFECYCLE_STATES.INITIALIZING, 'platform_init_called');

    // Register all runtimes
    const subs = [
      ['kernel',        this._deps.kernel,        { initOrder: 1,  shutdownOrder: 10, required: true  }],
      ['trace_store',   this._deps.traceStore,     { initOrder: 2,  shutdownOrder: 9,  required: false }],
      ['sdk',           this._deps.sdk,            { initOrder: 3,  shutdownOrder: 8,  required: true  }],
      ['ota_runtime',   this._deps.otaRuntime,     { initOrder: 4,  shutdownOrder: 7,  required: false }],
      ['agent_runtime', this._deps.agentRuntime,   { initOrder: 5,  shutdownOrder: 6,  required: false }],
      ['orchestration', this._deps.orchestration,  { initOrder: 6,  shutdownOrder: 5,  required: false }],
      ['simulation',    this._deps.simulation,     { initOrder: 7,  shutdownOrder: 4,  required: false }],
      ['operator_ui',   this._deps.operatorUI,     { initOrder: 8,  shutdownOrder: 3,  required: false }],
    ];

    for (const [id, instance, opts] of subs) {
      if (instance) {
        this._registry.register(id, instance, opts);
        this._topology.register(id, ENTITY_TYPES.RUNTIME, { subsystem: id });
      }
    }

    const initMap = {};
    for (const [id, instance] of subs) {
      if (!instance) continue;
      initMap[id] = async () => {
        if (instance.init) await instance.init();
        this._health.recordCheck(id, HEALTH_STATUS.HEALTHY);
      };
    }

    await this._bootstrap.run(initMap);
    await this._lifecycle.transition(LIFECYCLE_STATES.ACTIVE, 'bootstrap_complete');
    this._initialized = true;
    return { status: 'ACTIVE', registry: this._registry.snapshot() };
  }

  async shutdown() {
    this._executionRouter.block();
    await this._lifecycle.transition(LIFECYCLE_STATES.SHUTTING_DOWN, 'shutdown_requested');

    const shutdownMap = {};
    for (const entry of this._registry.getShutdownOrder()) {
      const instance = entry.instance;
      shutdownMap[entry.id] = async () => {
        if (instance.shutdown) await instance.shutdown();
      };
    }

    await this._shutdown.run(shutdownMap);
    await this._lifecycle.transition(LIFECYCLE_STATES.TERMINATED, 'shutdown_complete');
    return { status: 'TERMINATED', log: this._shutdown.getLog() };
  }

  // Accessors
  get lifecycle()      { return this._lifecycle; }
  get registry()       { return this._registry; }
  get topology()       { return this._topology; }
  get health()         { return this._health; }
  get replay()         { return this._replay; }
  get convergence()    { return this._convergence; }
  get executionRouter(){ return this._executionRouter; }

  snapshot() {
    return {
      lifecycle:       this._lifecycle.snapshot(),
      registry:        this._registry.snapshot(),
      topology:        this._topology.snapshot(),
      health:          this._health.snapshot(),
      replay:          this._replay.snapshot(),
      convergence:     this._convergence.snapshot(),
      executionRouter: this._executionRouter.snapshot(),
    };
  }
}

module.exports = { PlatformRuntime, LIFECYCLE_STATES, RUNTIME_STATES };
