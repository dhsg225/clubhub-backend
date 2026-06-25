'use strict';
/**
 * Scenario: incident_storm
 *
 * Inject 50 incidents across all 3 nodes in rapid succession.
 * Verify all are tracked, none are lost, and ledger integrity holds.
 *
 * Invariants:
 *   INV-01: All 50 incidents recorded across nodes
 *   INV-02: Incident events emitted to bus
 *   INV-03: Ledger entries append correctly (no hash chain violations)
 *   INV-04: Node states remain coherent (not crashed)
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'incident_storm';
const INCIDENT_COUNT = 50;

async function run({ seed = 1003 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 3, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  const nodeIds   = cluster.nodeIds();
  let   totalIncidents = 0;

  // Inject 50 incidents, round-robin across nodes
  for (let i = 0; i < INCIDENT_COUNT; i++) {
    const targetId = nodeIds[i % nodeIds.length];
    const node     = cluster.getNode(targetId);
    const incident = {
      id:       `INC_${String(i).padStart(4, '0')}`,
      severity: i % 5 === 0 ? 'CRITICAL' : 'WARNING',
      message:  `Storm incident ${i}`,
    };
    node.addIncident(incident);
    // Also append to ledger
    node.appendLedgerEntry({ type: 'INCIDENT', incident_id: incident.id, severity: incident.severity });

    eventBus.emit('simulation.incident.detected', { incident, node_id: targetId }, { source_node: targetId });
    clock.tick(2);
    totalIncidents++;
  }

  // Verify all incidents recorded
  let sumIncidents = 0;
  const ledger_results = [];
  for (const id of nodeIds) {
    const node = cluster.getNode(id);
    sumIncidents += node.incidents.length;
    ledger_results.push({ node_id: id, result: node.verifyLedger() });
  }

  const allLedgersValid = ledger_results.every(r => r.result.valid);
  const incidentEvents  = eventBus.getBuffer({ type: 'simulation.incident.detected' }).length;

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'all_incidents_recorded',
      status: sumIncidents === INCIDENT_COUNT ? 'PASS' : 'FAIL',
      detail: { expected: INCIDENT_COUNT, actual: sumIncidents },
    },
    {
      id:     'INV-02',
      name:   'incident_events_emitted',
      status: incidentEvents === INCIDENT_COUNT ? 'PASS' : 'FAIL',
      detail: { expected: INCIDENT_COUNT, actual: incidentEvents },
    },
    {
      id:     'INV-03',
      name:   'ledger_integrity_intact',
      status: allLedgersValid ? 'PASS' : 'FAIL',
      detail: ledger_results,
    },
    {
      id:     'INV-04',
      name:   'all_nodes_active',
      status: nodeIds.every(id => cluster.getNode(id).state === 'ACTIVE') ? 'PASS' : 'FAIL',
      detail: Object.fromEntries(nodeIds.map(id => [id, cluster.getNode(id).state])),
    },
  ];

  const report = reporter.generate({
    scenario_id:       SCENARIO_ID,
    seed,
    node_count:        3,
    events:            eventBus.snapshot(),
    divergence_result: cluster.detectDivergence(),
    invariant_checks,
    replay_results:    { equivalence: true },
    authority_conflicts: [],
    event_loss_count:  eventBus.getDroppedCount(),
    recovery_possible: true,
    clock_ms:          clock.now(),
    fault_count:       injector.getActiveFaultCount(),
  });

  return { scenario_id: SCENARIO_ID, seed, report, invariant_checks };
}

module.exports = { SCENARIO_ID, run };
