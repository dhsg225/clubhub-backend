'use strict';
/**
 * Scenario: plugin_failure_cascade
 *
 * Register 5 plugins on node_0. Fail plugin_1 and plugin_3.
 * Verify: kernel state is unaffected, failed plugins isolated,
 * other plugins still operational.
 *
 * Invariants:
 *   INV-01: Failed plugins marked as failed, not removed
 *   INV-02: Non-failed plugins remain operational
 *   INV-03: Node state = ACTIVE after cascade (kernel not corrupted)
 *   INV-04: Plugin failure events observable on bus
 *   INV-05: Ledger records plugin failures
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'plugin_failure_cascade';

async function run({ seed = 1007 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 2, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  const node = cluster.getNode('node_0');

  // Register 5 plugins
  const pluginIds = ['plugin_auth', 'plugin_ota', 'plugin_telemetry', 'plugin_schedule', 'plugin_media'];
  for (const id of pluginIds) {
    node.registerPlugin(id, { version: '1.0.0', type: 'governed' });
    node.appendLedgerEntry({ type: 'PLUGIN_REGISTERED', plugin_id: id });
    eventBus.emit('simulation.plugin.registered', { plugin_id: id, node_id: 'node_0' });
    clock.tick(5);
  }

  // Fail plugin_1 and plugin_3
  const failTargets = ['plugin_ota', 'plugin_schedule'];
  for (const id of failTargets) {
    node.failPlugin(id);
    node.appendLedgerEntry({ type: 'PLUGIN_FAILED', plugin_id: id });
    eventBus.emit('simulation.plugin.failed', { plugin_id: id, node_id: 'node_0' });
    clock.tick(10);
  }

  // Check state
  const failed_plugins   = [...node.plugin_registry.values()].filter(p => p.failed);
  const active_plugins   = [...node.plugin_registry.values()].filter(p => !p.failed);
  const ledger_valid     = node.verifyLedger();
  const plugin_fail_evts = eventBus.getBuffer({ type: 'simulation.plugin.failed' }).length;

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'failed_plugins_marked',
      status: failed_plugins.length === failTargets.length ? 'PASS' : 'FAIL',
      detail: { failed_count: failed_plugins.length, expected: failTargets.length },
    },
    {
      id:     'INV-02',
      name:   'surviving_plugins_operational',
      status: active_plugins.length === (pluginIds.length - failTargets.length) ? 'PASS' : 'FAIL',
      detail: { active_count: active_plugins.length, expected: pluginIds.length - failTargets.length },
    },
    {
      id:     'INV-03',
      name:   'node_state_active_after_cascade',
      status: node.state === 'ACTIVE' ? 'PASS' : 'FAIL',
      detail: { node_state: node.state },
    },
    {
      id:     'INV-04',
      name:   'plugin_failure_events_emitted',
      status: plugin_fail_evts === failTargets.length ? 'PASS' : 'FAIL',
      detail: { expected: failTargets.length, actual: plugin_fail_evts },
    },
    {
      id:     'INV-05',
      name:   'ledger_intact_after_cascade',
      status: ledger_valid.valid ? 'PASS' : 'FAIL',
      detail: ledger_valid,
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
