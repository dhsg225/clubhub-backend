'use strict';
const { TraceStoreCertification } = require('./runners/TraceStoreCertification');

class A6CertificationRunner {
  async run() {
    const results = [];
    try {
      results.push(await new TraceStoreCertification().run());
    } catch (err) {
      results.push({ name: 'TraceStoreCertification', rating: 'FAIL', pass_count: 0, fail_count: 1, warn_count: 0,
        checks: [{ id: 'runner_error', description: 'runner did not throw', status: 'FAIL', detail: err.message }] });
    }
    const overall_rating = results.some(r => r.rating === 'FAIL') ? 'FAIL' : 'PASS';
    const total_pass = results.reduce((s, r) => s + (r.pass_count ?? 0), 0);
    const total_fail = results.reduce((s, r) => s + (r.fail_count ?? 0), 0);
    return { generated_at: new Date().toISOString(), overall_rating, runner_count: results.length, total_pass, total_fail, results };
  }
}

async function certifyA6() { return new A6CertificationRunner().run(); }
module.exports = { A6CertificationRunner, certifyA6 };
