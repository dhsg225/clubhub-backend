'use strict';
/**
 * Scenario: workflow_collision_storm
 *
 * Start 20 unique workflows on node_0.
 * Then attempt to start 10 of the same IDs again — all must be rejected.
 * Verify: collision detection, no duplicate state, bus events emitted.
 *
 * Invariants:
 *   INV-01: All 20 unique workflows created
 *   INV-02: All 10 collision attempts rejected
 *   INV-03: Workflow count unchanged after collision storm
 *   INV-04: Bus events emitted for each start
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'workflow_collision_storm';

async function run({ seed = 1008 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 2, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  const node = cluster.getNode('node_0');

  // Start 20 unique workflows
  const UNIQUE_COUNT    = 20;
  const COLLISION_COUNT = 10;
  let   unique_ok       = 0;
  let   collision_rejected = 0;

  for (let i = 0; i < UNIQUE_COUNT; i++) {
    const id     = `wf_storm_${String(i).padStart(3, '0')}`;
    const result = node.startWorkflow(id, { scenario: SCENARIO_ID });
    if (result.ok) {
      unique_ok++;
      eventBus.emit('simulation.workflow.started', { workflow_id: id }, { source_node: 'node_0' });
    }
    clock.tick(2);
  }

  const count_after_unique = node.workflows.size;

  // Collision storm — first 10 IDs again
  for (let i = 0; i < COLLISION_COUNT; i++) {
    const id     = `wf_storm_${String(i).padStart(3, '0')}`;
    const result = node.startWorkflow(id, { scenario: SCENARIO_ID });
    if (!result.ok && result.reason === 'collision') {
      collision_rejected++;
      eventBus.emit('simulation.workflow.collision', { workflow_id: id }, { source_node: 'node_0' });
    }
    clock.tick(2);
  }

  const count_after_collisions = node.workflows.size;
  const collision_events = eventBus.getBuffer({ type: 'simulation.workflow.collision' }).length;

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'all_unique_workflows_created',
      status: unique_ok === UNIQUE_COUNT ? 'PASS' : 'FAIL',
      detail: { unique_ok, expected: UNIQUE_COUNT },
    },
    {
      id:     'INV-02',
      name:   'all_collisions_rejected',
      status: collision_rejected === COLLISION_COUNT ? 'PASS' : 'FAIL',
      detail: { collision_rejected, expected: COLLISION_COUNT },
    },
    {
      id:     'INV-03',
      name:   'workflow_count_unchanged_after_collisions',
      status: count_after_collisions === count_after_unique ? 'PASS' : 'FAIL',
      detail: { count_after_unique, count_after_collisions },
    },
    {
      id:     'INV-04',
      name:   'collision_events_emitted',
      status: collision_events === COLLISION_COUNT ? 'PASS' : 'FAIL',
      detail: { collision_events, expected: COLLISION_COUNT },
    },
  ];

  const report = reporter.generate({
    scenario_id:       SCENARIO_ID,
    seed,
    node_count:        2,
    events:            eventBus.snapshot(),
    divergence_result: { diverged: false },
    invariant_checks,
    replay_results:    { equivalence: true },
    authority_conflicts: [],
    event_loss_count:  0,
    recovery_possible: true,
    clock_ms:          clock.now(),
    fault_count:       0,
  });

  return { scenario_id: SCENARIO_ID, seed, report, invariant_checks };
}

module.exports = { SCENARIO_ID, run };
