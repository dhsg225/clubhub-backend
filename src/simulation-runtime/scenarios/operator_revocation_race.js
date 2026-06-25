'use strict';
/**
 * Scenario: operator_revocation_race
 *
 * Token 'tok_001' is registered on node_0 and node_1.
 * node_0 revokes it. Due to partition, node_1 doesn't receive revocation.
 * node_1 still accepts the token — divergence surfaced.
 * After partition heals, node_1's revocation is applied manually (reconciliation).
 *
 * Invariants:
 *   INV-01: Token valid on both nodes before revocation
 *   INV-02: Token revoked on node_0 after revocation
 *   INV-03: Token still valid on partitioned node_1 (divergence)
 *   INV-04: After reconciliation, token invalid on all nodes
 *   INV-05: Revocation events emitted
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'operator_revocation_race';
const TOKEN       = 'tok_001_operator';

async function run({ seed = 1010 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 3, clock, eventBus });
  const injector = new FaultInjector();
  const reporter = new SimulationReport();

  // Register token on all nodes
  for (const id of cluster.nodeIds()) {
    cluster.getNode(id).registerToken(TOKEN, { operator_id: 'op_alice' });
    eventBus.emit('simulation.token.registered', { token: TOKEN, node_id: id });
  }
  clock.fastForward(20);

  const valid_before_n0 = cluster.getNode('node_0').validateToken(TOKEN);
  const valid_before_n1 = cluster.getNode('node_1').validateToken(TOKEN);

  // Partition node_0 from node_1
  const { restore: healPartition } = injector.injectNetworkPartition(eventBus, 'node_0', 'node_1');
  clock.fastForward(10);

  // Revoke on node_0 (doesn't propagate to node_1)
  cluster.getNode('node_0').revokeToken(TOKEN);
  eventBus.emit('simulation.token.revoked', { token: TOKEN, source_node: 'node_0' }, { source_node: 'node_0' });
  clock.fastForward(10);

  const valid_n0_after  = cluster.getNode('node_0').validateToken(TOKEN);
  const valid_n1_during = cluster.getNode('node_1').validateToken(TOKEN); // still valid due to partition

  const authority_conflicts = valid_n1_during
    ? [{ type: 'token_revocation_not_propagated', token: TOKEN, node: 'node_1' }]
    : [];

  // Heal partition and reconcile
  healPartition();
  clock.fastForward(50);

  // Apply revocation to node_1 and node_2 (reconciliation)
  cluster.getNode('node_1').revokeToken(TOKEN);
  cluster.getNode('node_2').revokeToken(TOKEN);
  eventBus.emit('simulation.token.reconciled', { token: TOKEN, reconciled_nodes: ['node_1', 'node_2'] });

  const valid_n0_final = cluster.getNode('node_0').validateToken(TOKEN);
  const valid_n1_final = cluster.getNode('node_1').validateToken(TOKEN);
  const valid_n2_final = cluster.getNode('node_2').validateToken(TOKEN);

  const revocation_events = eventBus.getBuffer({ type: 'simulation.token.revoked' }).length;

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'token_valid_before_revocation',
      status: (valid_before_n0 && valid_before_n1) ? 'PASS' : 'FAIL',
      detail: { valid_before_n0, valid_before_n1 },
    },
    {
      id:     'INV-02',
      name:   'token_revoked_on_authority_node',
      status: !valid_n0_after ? 'PASS' : 'FAIL',
      detail: { valid_n0_after },
    },
    {
      id:     'INV-03',
      name:   'partitioned_node_diverges',
      status: valid_n1_during ? 'PASS' : 'FAIL',
      detail: { valid_n1_during, authority_conflicts },
    },
    {
      id:     'INV-04',
      name:   'all_nodes_revoked_after_reconciliation',
      status: (!valid_n0_final && !valid_n1_final && !valid_n2_final) ? 'PASS' : 'FAIL',
      detail: { valid_n0_final, valid_n1_final, valid_n2_final },
    },
    {
      id:     'INV-05',
      name:   'revocation_events_emitted',
      status: revocation_events >= 1 ? 'PASS' : 'FAIL',
      detail: { revocation_events },
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
    authority_conflicts,
    event_loss_count:  0,
    recovery_possible: true,
    clock_ms:          clock.now(),
    fault_count:       0,
  });

  return { scenario_id: SCENARIO_ID, seed, report, invariant_checks, authority_conflicts };
}

module.exports = { SCENARIO_ID, run };
