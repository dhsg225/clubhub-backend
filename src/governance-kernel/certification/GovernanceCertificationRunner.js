'use strict';
/**
 * GovernanceCertificationRunner
 *
 * Runs the full governance certification suite and produces a structured report.
 *
 * Certification levels (in order):
 *   DEVELOPMENT        — basic determinism + replay
 *   STAGING            — + HA consistency + authority convergence
 *   PRODUCTION_READY   — + resource bounds + incident recovery + freeze integrity
 *   HA_PRODUCTION      — + operator accountability + plugin safety
 *
 * Usage:
 *   const runner = new GovernanceCertificationRunner();
 *   const report = await runner.run();
 *   console.log(report.overall_rating); // PASS | CONDITIONAL | FAIL
 */

const fs   = require('node:fs');
const path = require('node:path');

const ReplayCertification               = require('./runners/ReplayCertification');
const DeterminismCertification          = require('./runners/DeterminismCertification');
const HAConsistencyCertification        = require('./runners/HAConsistencyCertification');
const AuthorityConvergenceCertification = require('./runners/AuthorityConvergenceCertification');
const ResourceBoundCertification        = require('./runners/ResourceBoundCertification');
const IncidentRecoveryCertification     = require('./runners/IncidentRecoveryCertification');
const FreezeIntegrityCertification      = require('./runners/FreezeIntegrityCertification');
const OperatorAccountabilityCertification = require('./runners/OperatorAccountabilityCertification');
const PluginSafetyCertification         = require('./runners/PluginSafetyCertification');

const CERTIFICATION_LEVELS = Object.freeze({
  DEVELOPMENT:      'DEVELOPMENT',
  STAGING:          'STAGING',
  PRODUCTION_READY: 'PRODUCTION_READY',
  HA_PRODUCTION:    'HA_PRODUCTION',
});

const RUNNER_SETS = {
  [CERTIFICATION_LEVELS.DEVELOPMENT]: [
    ReplayCertification,
    DeterminismCertification,
  ],
  [CERTIFICATION_LEVELS.STAGING]: [
    ReplayCertification,
    DeterminismCertification,
    HAConsistencyCertification,
    AuthorityConvergenceCertification,
  ],
  [CERTIFICATION_LEVELS.PRODUCTION_READY]: [
    ReplayCertification,
    DeterminismCertification,
    HAConsistencyCertification,
    AuthorityConvergenceCertification,
    ResourceBoundCertification,
    IncidentRecoveryCertification,
    FreezeIntegrityCertification,
  ],
  [CERTIFICATION_LEVELS.HA_PRODUCTION]: [
    ReplayCertification,
    DeterminismCertification,
    HAConsistencyCertification,
    AuthorityConvergenceCertification,
    ResourceBoundCertification,
    IncidentRecoveryCertification,
    FreezeIntegrityCertification,
    OperatorAccountabilityCertification,
    PluginSafetyCertification,
  ],
};

class GovernanceCertificationRunner {
  constructor(opts = {}) {
    this._level     = opts.level     ?? CERTIFICATION_LEVELS.HA_PRODUCTION;
    this._reportDir = opts.reportDir ?? null;
  }

  async run() {
    const runners  = (RUNNER_SETS[this._level] ?? RUNNER_SETS[CERTIFICATION_LEVELS.HA_PRODUCTION])
      .map(R => new R());

    const results = [];
    for (const runner of runners) {
      try {
        const result = await runner.run();
        results.push(result);
      } catch (err) {
        results.push({
          name:   runner.name ?? runner.constructor.name,
          rating: 'FAIL',
          caveats: [{ severity: 'FAIL', check: 'runner_error', detail: err.message }],
        });
      }
    }

    const overall_rating =
      results.some(r => r.rating === 'FAIL')        ? 'FAIL'
    : results.some(r => r.rating === 'CONDITIONAL') ? 'CONDITIONAL'
    : 'PASS';

    const report = {
      generated_at:    new Date().toISOString(),
      level:           this._level,
      overall_rating,
      runner_count:    results.length,
      pass_count:      results.filter(r => r.rating === 'PASS').length,
      conditional_count: results.filter(r => r.rating === 'CONDITIONAL').length,
      fail_count:      results.filter(r => r.rating === 'FAIL').length,
      results,
    };

    if (this._reportDir) {
      try {
        fs.mkdirSync(this._reportDir, { recursive: true });
        fs.writeFileSync(
          path.join(this._reportDir, 'governance-certification.json'),
          JSON.stringify(report, null, 2)
        );
      } catch { /* non-fatal */ }
    }

    return report;
  }
}

module.exports = GovernanceCertificationRunner;
module.exports.CERTIFICATION_LEVELS = CERTIFICATION_LEVELS;
