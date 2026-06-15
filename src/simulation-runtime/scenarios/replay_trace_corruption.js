'use strict';
/**
 * Scenario: replay_trace_corruption
 *
 * Build a valid hash-chained trace of 10 events.
 * Corrupt in 4 ways: tampered hash, reorder, duplicate, truncate.
 * Every corruption must be detected by verifyTrace().
 *
 * Invariants:
 *   INV-01: Tampered hash detected
 *   INV-02: Reordered trace detected
 *   INV-03: Duplicated trace detected
 *   INV-04: Valid trace passes verification
 *   INV-05: Truncated valid prefix passes verification
 */
const { SimulationCluster }   = require('../simulation-cluster');
const { SimulationClock }     = require('../simulation-clock');
const { SimulationEventBus }  = require('../simulation-event-bus');
const { FaultInjector }       = require('../fault-injector');
const { AdversarialReplay }   = require('../adversarial-replay');
const { SimulationReport }    = require('../simulation-report');

const SCENARIO_ID = 'replay_trace_corruption';

async function run({ seed = 1004 } = {}) {
  const clock    = new SimulationClock();
  const eventBus = new SimulationEventBus(clock);
  const cluster  = new SimulationCluster({ seed, nodeCount: 2, clock, eventBus });
  const injector = new FaultInjector();
  const replayer = new AdversarialReplay(clock, eventBus);
  const reporter = new SimulationReport();

  // Build 10 deterministic events
  const raw_events = Array.from({ length: 10 }, (_, i) => ({
    event_id:        `trace_evt_${i}`,
    event_type:      'governance.audit.entry',
    deterministic_ts: new Date(clock.now() + i * 100).toISOString(),
    payload:         { action: 'config_update', index: i },
  }));

  const trace = replayer.buildTrace(raw_events);

  // Corrupt in 4 ways using FaultInjector
  const { corrupted: tampered }   = injector.injectReplayCorruption(trace, { mode: 'tamper_hash', index: 3 });
  const { corrupted: reordered }  = injector.injectReplayCorruption(trace, { mode: 'reorder' });
  const { corrupted: duplicated } = injector.injectReplayCorruption(trace, { mode: 'duplicate', index: 0 });
  const { corrupted: truncated }  = injector.injectReplayCorruption(trace, { mode: 'truncate', keepCount: 5 });

  // Verify valid trace
  const valid_result     = replayer.verifyTrace(trace);
  // Verify corrupted traces
  const tampered_result  = replayer.verifyTrace(tampered);
  const reordered_result = replayer.verifyTrace(reordered);
  const dup_result       = replayer.verifyTrace(duplicated);
  const trunc_result     = replayer.verifyTrace(truncated);

  clock.fastForward(500);

  const invariant_checks = [
    {
      id:     'INV-01',
      name:   'tampered_hash_detected',
      status: !tampered_result.valid ? 'PASS' : 'FAIL',
      detail: tampered_result,
    },
    {
      id:     'INV-02',
      name:   'reordered_trace_detected',
      status: !reordered_result.valid ? 'PASS' : 'FAIL',
      detail: reordered_result,
    },
    {
      id:     'INV-03',
      name:   'duplicated_trace_detected',
      status: !dup_result.valid ? 'PASS' : 'FAIL',
      detail: dup_result,
    },
    {
      id:     'INV-04',
      name:   'valid_trace_passes',
      status: valid_result.valid ? 'PASS' : 'FAIL',
      detail: valid_result,
    },
    {
      id:     'INV-05',
      name:   'truncated_prefix_passes',
      status: trunc_result.valid ? 'PASS' : 'FAIL',
      detail: trunc_result,
    },
  ];

  injector.restoreAll();

  const report = reporter.generate({
    scenario_id:       SCENARIO_ID,
    seed,
    node_count:        2,
    events:            eventBus.snapshot(),
    divergence_result: { diverged: false },
    invariant_checks,
    replay_results:    { equivalence: valid_result.valid },
    authority_conflicts: [],
    event_loss_count:  0,
    recovery_possible: true,
    clock_ms:          clock.now(),
    fault_count:       0,
  });

  return { scenario_id: SCENARIO_ID, seed, report, invariant_checks };
}

module.exports = { SCENARIO_ID, run };
