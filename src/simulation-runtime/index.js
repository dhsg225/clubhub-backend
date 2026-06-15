'use strict';
/**
 * simulation-runtime — Phase A7 Deterministic Simulation Environment
 *
 * H1: Same seed → identical simulation output
 * H2: No production DB — MEMORY/REPLAY adapters only
 * H3: Replay corruption always detected
 * H4: Split-brain explicitly surfaced
 * H5: All fault injections reversible
 * H6: Simulation mode enforces no external service calls
 *
 * Public API:
 *   SimulationClock       — deterministic virtual clock
 *   SimulationEventBus    — isolated partition-aware event bus
 *   SimulationCluster     — multi-node deterministic cluster
 *   FaultInjector         — reversible fault injection
 *   AdversarialReplay     — hash-chain replay verification
 *   SimulationReport      — deterministic hashable reports
 *   scenarios             — 10 canonical adversarial scenarios
 *   certifyA7()           — run all 5 certification suites
 */
const { SimulationClock }    = require('./simulation-clock');
const { SimulationEventBus } = require('./simulation-event-bus');
const { SimulationCluster }  = require('./simulation-cluster');
const { FaultInjector }      = require('./fault-injector');
const { AdversarialReplay }  = require('./adversarial-replay');
const { SimulationReport, stableStringify } = require('./simulation-report');
const scenarios              = require('./scenarios');

/** Create a complete simulation context from a seed. */
function createSimulationContext({ seed, nodeCount = 3, baseEpochMs } = {}) {
  const clock    = new SimulationClock(baseEpochMs);
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount, clock, eventBus });
  const injector = new FaultInjector();
  const replayer = new AdversarialReplay(clock, eventBus);
  const reporter = new SimulationReport();
  return { seed, clock, eventBus, cluster, injector, replayer, reporter };
}

module.exports = {
  // Core infrastructure
  SimulationClock,
  SimulationEventBus,
  SimulationCluster,
  FaultInjector,
  AdversarialReplay,
  SimulationReport,
  stableStringify,

  // Scenarios
  scenarios,

  // Factory
  createSimulationContext,

  // Simulation mode marker — checked by certifications
  SIMULATION_MODE: 'DETERMINISTIC_ADVERSARIAL',
};
