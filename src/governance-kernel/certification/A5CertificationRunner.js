'use strict';
/**
 * A5CertificationRunner — runs all 5 A5 SDK + agent runtime certification suites.
 *
 * Suites:
 *   SDKSurfaceCertification      — SDK surface structure (6 checks)
 *   AgentDeterminismCertification — agent runtime determinism (6 checks)
 *   WorkflowReplayCertification  — workflow replay compatibility (6 checks)
 *   SDKBoundarySafetyCertification — boundary safety (8 checks)
 *   AgentLifecycleCertification  — agent lifecycle state machine (8 checks)
 */

const { SDKSurfaceCertification }       = require('./runners/SDKSurfaceCertification');
const { AgentDeterminismCertification } = require('./runners/AgentDeterminismCertification');
const { WorkflowReplayCertification }   = require('./runners/WorkflowReplayCertification');
const { SDKBoundarySafetyCertification } = require('./runners/SDKBoundarySafetyCertification');
const { AgentLifecycleCertification }   = require('./runners/AgentLifecycleCertification');

const A5_RUNNERS = [
  SDKSurfaceCertification,
  AgentDeterminismCertification,
  WorkflowReplayCertification,
  SDKBoundarySafetyCertification,
  AgentLifecycleCertification,
];

class A5CertificationRunner {
  async run() {
    const results = [];

    for (const Runner of A5_RUNNERS) {
      try {
        const result = await new Runner().run();
        results.push(result);
      } catch (err) {
        results.push({
          name:       Runner.name,
          rating:     'FAIL',
          pass_count: 0,
          fail_count: 1,
          warn_count: 0,
          checks:     [{ id: 'runner_error', description: 'runner did not throw', status: 'FAIL', detail: err.message }],
        });
      }
    }

    const overall_rating = results.some(r => r.rating === 'FAIL') ? 'FAIL' : 'PASS';
    const total_pass     = results.reduce((s, r) => s + (r.pass_count ?? 0), 0);
    const total_fail     = results.reduce((s, r) => s + (r.fail_count ?? 0), 0);

    return {
      generated_at:   new Date().toISOString(),
      overall_rating,
      runner_count:   results.length,
      total_pass,
      total_fail,
      results,
    };
  }
}

async function certifyA5() {
  return new A5CertificationRunner().run();
}

module.exports = { A5CertificationRunner, certifyA5 };
