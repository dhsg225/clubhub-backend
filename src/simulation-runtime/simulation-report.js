'use strict';
/**
 * SimulationReport — deterministic, hashable simulation report generator.
 *
 * H1: Same inputs → same report hash.
 * Reports are fully serializable and replayable.
 *
 * Required fields per spec:
 *   scenario_id, seed, node_count, divergence_detected,
 *   invariant_failures, replay_equivalence, authority_conflicts,
 *   event_loss_count, recovery_possible
 *
 * Additional fields:
 *   schema_version, invariant_pass_count, event_count,
 *   clock_ms, fault_count, report_hash
 */
const crypto = require('node:crypto');

/** Stable JSON serialization — deterministic key ordering. */
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

class SimulationReport {
  constructor() {
    this._schema_version = '1.0';
  }

  /**
   * Generate a deterministic simulation report.
   *
   * @param {object} opts
   *   scenario_id        {string}   canonical scenario name
   *   seed               {number}   simulation seed
   *   node_count         {number}
   *   events             {Array}    all emitted events
   *   divergence_result  {object}   from cluster.detectDivergence()
   *   invariant_checks   {Array}    [{ id, name, status, detail }]
   *   replay_results     {object}   { equivalence: bool, detail }
   *   authority_conflicts {Array}   list of detected conflicts
   *   event_loss_count   {number}   explicitly dropped events
   *   recovery_possible  {boolean}
   *   clock_ms           {number}   final virtual clock value
   *   fault_count        {number}   active faults injected
   * @returns frozen report object with report_hash
   */
  generate(opts = {}) {
    const {
      scenario_id       = 'unknown',
      seed              = 0,
      node_count        = 0,
      events            = [],
      divergence_result = null,
      invariant_checks  = [],
      replay_results    = null,
      authority_conflicts = [],
      event_loss_count  = 0,
      recovery_possible = true,
      clock_ms          = 0,
      fault_count       = 0,
    } = opts;

    const invariant_failures  = invariant_checks.filter(c => c.status === 'FAIL');
    const invariant_pass_count = invariant_checks.filter(c => c.status === 'PASS').length;

    const body = {
      schema_version:      this._schema_version,
      scenario_id,
      seed,
      node_count,
      divergence_detected: divergence_result?.diverged ?? false,
      divergence_detail:   divergence_result ?? null,
      invariant_failures,
      invariant_pass_count,
      invariant_fail_count: invariant_failures.length,
      replay_equivalence:   replay_results?.equivalence ?? null,
      replay_detail:        replay_results ?? null,
      authority_conflicts,
      event_loss_count,
      recovery_possible,
      event_count:          events.length,
      clock_ms,
      fault_count,
    };

    // report_hash must be excluded from its own computation
    const report_hash = crypto.createHash('sha256')
      .update(stableStringify(body))
      .digest('hex');

    const report = Object.freeze({ ...body, report_hash });
    return report;
  }

  /**
   * Verify that a report's hash matches its content.
   * Returns true iff the report has not been tampered.
   */
  verify(report) {
    if (!report || typeof report.report_hash !== 'string') return false;
    const { report_hash, ...body } = report;
    const computed = crypto.createHash('sha256')
      .update(stableStringify(body))
      .digest('hex');
    return computed === report_hash;
  }

  /**
   * Compute a replay-identity fingerprint from a set of reports.
   * Two runs with the same seed must produce the same fingerprint.
   */
  fingerprint(reports) {
    const seeds    = reports.map(r => r.seed).sort((a, b) => a - b);
    const hashes   = reports.map(r => r.report_hash).sort();
    return crypto.createHash('sha256')
      .update(stableStringify({ seeds, hashes }))
      .digest('hex');
  }

  /** Render a human-readable summary (for CI logs). */
  summarize(report) {
    const lines = [
      `SimulationReport: ${report.scenario_id} (seed=${report.seed})`,
      `  nodes=${report.node_count}  events=${report.event_count}  faults=${report.fault_count}`,
      `  divergence=${report.divergence_detected}  event_loss=${report.event_loss_count}`,
      `  invariants: ${report.invariant_pass_count} PASS / ${report.invariant_fail_count} FAIL`,
      `  replay_equivalence=${report.replay_equivalence}  recovery_possible=${report.recovery_possible}`,
      `  authority_conflicts=${report.authority_conflicts?.length ?? 0}`,
      `  hash=${report.report_hash}`,
    ];
    return lines.join('\n');
  }
}

module.exports = { SimulationReport, stableStringify };
