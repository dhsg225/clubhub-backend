'use strict';
const PLATFORM_CERT = require('../../platform-runtime/certification');

class A10CertificationRunner {
  async run() {
    const results = [];
    const runners = [
      'ControlPlaneCertification',
      'TenantIsolationCertification',
      'DeploymentPackagingCertification',
      'AdminGovernanceCertification',
      'ObservabilityExportCertification',
      'ReplayPackageCertification',
      'OperationalPolicyCertification',
      'ProductionReadinessCertification',
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
    return { generated_at: new Date().toISOString(), phase: 'A10',
             description: 'Operational Productization + External Control Plane',
             overall_rating, runner_count: results.length, total_pass, total_fail, results };
  }
}

async function certifyA10() { return new A10CertificationRunner().run(); }
module.exports = { A10CertificationRunner, certifyA10 };
