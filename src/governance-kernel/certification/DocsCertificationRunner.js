'use strict';
/**
 * DocsCertificationRunner
 *
 * Runs all 4 documentation certification suites and produces a combined report.
 *
 * Runners:
 *   DocumentationCompletenessCertification  — 12 platform doc checks
 *   OperationalPlaybookCertification        — 9 playbook checks
 *   DiagramConsistencyCertification         — 8 diagram checks
 *   ExampleIntegrityCertification           — 5 example checks
 *
 * Usage:
 *   const runner = new DocsCertificationRunner();
 *   const report = await runner.run();
 *   console.log(report.overall_rating); // PASS | FAIL
 */

const { DocumentationCompletenessCertification } = require('./runners/DocumentationCompletenessCertification');
const { OperationalPlaybookCertification }        = require('./runners/OperationalPlaybookCertification');
const { DiagramConsistencyCertification }         = require('./runners/DiagramConsistencyCertification');
const { ExampleIntegrityCertification }           = require('./runners/ExampleIntegrityCertification');

const DOCS_RUNNERS = [
  DocumentationCompletenessCertification,
  OperationalPlaybookCertification,
  DiagramConsistencyCertification,
  ExampleIntegrityCertification,
];

class DocsCertificationRunner {
  async run() {
    const results = [];

    for (const Runner of DOCS_RUNNERS) {
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

    const total_pass = results.reduce((s, r) => s + (r.pass_count ?? 0), 0);
    const total_fail = results.reduce((s, r) => s + (r.fail_count ?? 0), 0);

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

async function certifyDocs() {
  const runner = new DocsCertificationRunner();
  return runner.run();
}

module.exports = { DocsCertificationRunner, certifyDocs };
