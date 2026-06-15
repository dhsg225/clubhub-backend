'use strict';
const PLATFORM_CERT = require('../../platform-runtime/certification');

class A9CertificationRunner {
  async run() {
    const results = [];
    const runners = [
      'PlatformLifecycleCertification',
      'ReplayConvergenceCertification',
      'ExecutionPathCertification',
      'TracePropagationCertification',
      'TopologyConsistencyCertification',
      'DeterministicBootstrapCertification',
      'ConvergenceIntegrityCertification',
    ];
    for (const name of runners) {
      try {
        results.push(await new PLATFORM_CERT[name]().run());
      } catch (err) {
        results.push({ name, rating: 'FAIL', pass_count: 0, fail_count: 1, warn_count: 0,
          checks: [{ id: 'runner_error', description: 'runner did not throw', status: 'FAIL', detail: err.message }] });
      }
    }
    const overall_rating = results.some(r => r.rating === 'FAIL') ? 'FAIL' : 'PASS';
    const total_pass     = results.reduce((s, r) => s + (r.pass_count ?? 0), 0);
    const total_fail     = results.reduce((s, r) => s + (r.fail_count ?? 0), 0);
    return { generated_at: new Date().toISOString(), phase: 'A9',
             description: 'Operational Convergence + Full Platform Integration',
             overall_rating, runner_count: results.length, total_pass, total_fail, results };
  }
}

async function certifyA9() { return new A9CertificationRunner().run(); }
module.exports = { A9CertificationRunner, certifyA9 };
