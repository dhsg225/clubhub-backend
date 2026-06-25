'use strict';
/**
 * A7CertificationRunner — Phase A7 Simulation Environment certification.
 *
 * Runs all 5 A7 certification suites:
 *   1. SimulationDeterminismCertification  — H1 same seed, no wall-clock
 *   2. FaultInjectionCertification         — H5 reversible faults
 *   3. ReplayCorruptionCertification       — H3 corruption detection
 *   4. ClusterPartitionCertification       — H4 split-brain surfaced
 *   5. AdversarialReplayCertification      — end-to-end scenario correctness
 */
const SIM_CERT = require('../../simulation-runtime/certification');

class A7CertificationRunner {
  async run() {
    const results = [];

    const runners = [
      'SimulationDeterminismCertification',
      'FaultInjectionCertification',
      'ReplayCorruptionCertification',
      'ClusterPartitionCertification',
      'AdversarialReplayCertification',
    ];

    for (const name of runners) {
      try {
        const Ctor   = SIM_CERT[name];
        const result = await new Ctor().run();
        results.push(result);
      } catch (err) {
        results.push({
          name,
          rating:     'FAIL',
          pass_count: 0,
          fail_count: 1,
          warn_count: 0,
          checks: [{
            id:          'runner_error',
            description: 'runner did not throw',
            status:      'FAIL',
            detail:      err.message,
          }],
        });
      }
    }

    const overall_rating = results.some(r => r.rating === 'FAIL') ? 'FAIL' : 'PASS';
    const total_pass     = results.reduce((s, r) => s + (r.pass_count ?? 0), 0);
    const total_fail     = results.reduce((s, r) => s + (r.fail_count ?? 0), 0);

    return {
      generated_at:   new Date().toISOString(),
      phase:          'A7',
      description:    'Simulation Environment + Failure Injection + Adversarial Replay',
      overall_rating,
      runner_count:   results.length,
      total_pass,
      total_fail,
      results,
    };
  }
}

async function certifyA7() { return new A7CertificationRunner().run(); }
module.exports = { A7CertificationRunner, certifyA7 };
