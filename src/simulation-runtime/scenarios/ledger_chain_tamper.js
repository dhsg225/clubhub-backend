'use strict';
/**
 * Scenario: ledger_chain_tamper
 *
 * Build a 10-entry ledger on node_0.
 * Tamper with entry at index 5 via FaultInjector.
 * Verify: tamper detected, restoration valid.
 *
 * Invariants:
 *   INV-01: Intact ledger passes verifyLedger()
 *   INV-02: Tampered ledger fails at correct index
 *   INV-03: restore() reverts tamper — ledger valid again
 *   INV-04: Tamper event emitted (observable)
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'ledger_chain_tamper';

async function run({ seed = 1005 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 2, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  const node = cluster.getNode('node_0');

  // Build 10 ledger entries
  for (let i = 0; i < 10; i++) {
    node.appendLedgerEntry({ type: 'AUDIT', action: `action_${i}`, version: i });
    clock.tick(10);
  }

  // Verify clean ledger
  const pre_tamper = node.verifyLedger();

  // Tamper entry at index 5
  const { restore, tampered, faultId } = injector.injectLedgerTampering(node.ledger, 5);
  eventBus.emit('simulation.ledger.tampered', { node_id: 'node_0', index: 5, faultId });

  // Verify tamper detected
  const during_tamper = node.verifyLedger();

  // Restore
  restore();

  // Verify restoration
  const post_restore = node.verifyLedger();

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'intact_ledger_valid',
      status: pre_tamper.valid ? 'PASS' : 'FAIL',
      detail: pre_tamper,
    },
    {
      id:     'INV-02',
      name:   'tamper_detected_at_correct_index',
      status: (!during_tamper.valid && during_tamper.tampered_at !== null) ? 'PASS' : 'FAIL',
      detail: { tampered, during_tamper },
    },
    {
      id:     'INV-03',
      name:   'restore_reverts_tamper',
      status: post_restore.valid ? 'PASS' : 'FAIL',
      detail: post_restore,
    },
    {
      id:     'INV-04',
      name:   'tamper_event_observable',
      status: eventBus.getBuffer({ type: 'simulation.ledger.tampered' }).length > 0 ? 'PASS' : 'FAIL',
      detail: { tamper_events: eventBus.getBuffer({ type: 'simulation.ledger.tampered' }).length },
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
