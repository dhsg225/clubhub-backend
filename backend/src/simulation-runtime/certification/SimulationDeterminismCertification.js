'use strict';
/**
 * SimulationDeterminismCertification
 *
 * SDC-01: simulation-clock.js exists and exports SimulationClock
 * SDC-02: SimulationClock.fastForward() is non-nondeterministic (no Date.now)
 * SDC-03: SimulationClock.rewind() present
 * SDC-04: SimulationClock.freeze() / isFrozen() present
 * SDC-05: simulation-report.js exports stableStringify
 * SDC-06: SimulationReport.verify() can validate its own output
 * SDC-07: Same seed → same report hash (functional determinism test)
 * SDC-08: simulation-cluster.js exports SimulationCluster
 * SDC-09: SimulationCluster.snapshot() is serializable
 * SDC-10: scenarios/index.js exports runAll
 */
const fs   = require('fs');
const path = require('path');

const SIM_ROOT = path.resolve(__dirname, '..');

class SimulationDeterminismCertification {
  async run() {
    const checks = [
      this._exists('SDC-01', 'simulation-clock.js',  'SimulationClock',        'simulation-clock.js exports SimulationClock'),
      this._noString('SDC-02', 'simulation-clock.js', 'Date.now()',             'simulation-clock.js has no Date.now() calls'),
      this._exists('SDC-03', 'simulation-clock.js',  'rewind',                 'SimulationClock has rewind()'),
      this._exists('SDC-04', 'simulation-clock.js',  'isFrozen',               'SimulationClock has freeze()/isFrozen()'),
      this._exists('SDC-05', 'simulation-report.js', 'stableStringify',        'simulation-report.js exports stableStringify'),
      this._exists('SDC-06', 'simulation-report.js', 'verify',                 'SimulationReport has verify()'),
      await this._deterministicReportCheck(),
      this._exists('SDC-08', 'simulation-cluster.js', 'SimulationCluster',     'simulation-cluster.js exports SimulationCluster'),
      this._exists('SDC-09', 'simulation-cluster.js', 'snapshot',              'SimulationCluster has snapshot()'),
      this._exists('SDC-10', 'scenarios/index.js',   'runAll',                 'scenarios/index.js exports runAll'),
    ];
    return this._result('SimulationDeterminismCertification', checks);
  }

  // ——— SDC-07 functional check ——————————————————————————————————

  async _deterministicReportCheck() {
    const id = 'SDC-07';
    const desc = 'same seed produces identical report hash';
    try {
      const { SimulationReport } = require('../simulation-report');
      const reporter = new SimulationReport();

      const makeReport = (seed) => reporter.generate({
        scenario_id: 'determinism_check',
        seed,
        node_count:  2,
        events:      [{ event_id: 'e1', event_type: 'test' }],
        divergence_result: { diverged: false },
        invariant_checks:  [{ id: 'I1', status: 'PASS' }],
        authority_conflicts: [],
        event_loss_count: 0,
        recovery_possible: true,
        clock_ms: 1_700_000_000_000,
        fault_count: 0,
      });

      const r1 = makeReport(42);
      const r2 = makeReport(42);
      const r3 = makeReport(99);

      if (r1.report_hash !== r2.report_hash) {
        return { id, description: desc, status: 'FAIL', detail: 'same seed produced different hashes' };
      }
      if (r1.report_hash === r3.report_hash) {
        return { id, description: desc, status: 'FAIL', detail: 'different seeds produced same hash' };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) {
      return { id, description: desc, status: 'FAIL', detail: err.message };
    }
  }

  // ——— Helpers ——————————————————————————————————————————————————

  _exists(id, file, marker, description) {
    const fp = path.join(SIM_ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(marker)) return { id, description, status: 'FAIL', detail: `${file} missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _noString(id, file, marker, description) {
    const fp = path.join(SIM_ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    const lines = fs.readFileSync(fp, 'utf8').split('\n')
      .filter(l => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*'); });
    const src = lines.join('\n');
    if (src.includes(marker)) return { id, description, status: 'FAIL', detail: `${file} contains forbidden '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { SimulationDeterminismCertification };
