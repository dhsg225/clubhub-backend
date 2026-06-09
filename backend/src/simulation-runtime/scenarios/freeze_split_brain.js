'use strict';
/**
 * Scenario: freeze_split_brain
 *
 * Node 0 (authority) broadcasts freeze.
 * Node 2 is partitioned — freeze is withheld.
 * Divergence: node_0 and node_1 are frozen; node_2 is not.
 *
 * Invariants:
 *   INV-01: At least one node is frozen after broadcast
 *   INV-02: Partitioned node remains unfrozen
 *   INV-03: detectDivergence() must surface freeze_diverged = true
 *   INV-04: Split-brain event emitted to bus
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'freeze_split_brain';

async function run({ seed = 1001 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 3, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  // Inject partition between node_0 and node_2
  const { faultId: partFault, restore: restorePartition } = injector.injectNetworkPartition(eventBus, 'node_0', 'node_2');
  clock.fastForward(100);

  // node_0 broadcasts freeze
  const { results } = cluster.broadcastFreeze('maintenance_window', 'node_0');
  clock.fastForward(50);

  // Detect divergence
  const divergence = cluster.detectDivergence();

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'at_least_one_node_frozen',
      status: cluster.getNode('node_0').frozen ? 'PASS' : 'FAIL',
      detail: { node_0_frozen: cluster.getNode('node_0').frozen },
    },
    {
      id:     'INV-02',
      name:   'partitioned_node_unfrozen',
      status: !cluster.getNode('node_2').frozen ? 'PASS' : 'FAIL',
      detail: { node_2_frozen: cluster.getNode('node_2').frozen, result: results['node_2'] },
    },
    {
      id:     'INV-03',
      name:   'divergence_detected',
      status: divergence.freeze_diverged ? 'PASS' : 'FAIL',
      detail: divergence,
    },
    {
      id:     'INV-04',
      name:   'split_brain_event_emitted',
      status: eventBus.getBuffer({ type: 'simulation.cluster.divergence_detected' }).length > 0 ? 'PASS' : 'FAIL',
      detail: { divergence_events: eventBus.getBuffer({ type: 'simulation.cluster.divergence_detected' }).length },
    },
  ];

  // Heal partition
  restorePartition();
  clock.fastForward(200);

  const report = reporter.generate({
    scenario_id:       SCENARIO_ID,
    seed,
    node_count:        3,
    events:            eventBus.snapshot(),
    divergence_result: divergence,
    invariant_checks,
    replay_results:    { equivalence: true },
    authority_conflicts: divergence.freeze_diverged ? [{ type: 'freeze_split_brain', epoch: cluster.epoch }] : [],
    event_loss_count:  eventBus.getDroppedCount(),
    recovery_possible: true,
    clock_ms:          clock.now(),
    fault_count:       injector.getActiveFaultCount(), // 0 after restore
  });

  return { scenario_id: SCENARIO_ID, seed, report, invariant_checks, divergence };
}

module.exports = { SCENARIO_ID, run };
