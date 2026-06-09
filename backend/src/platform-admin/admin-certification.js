'use strict';
/**
 * AdminCertification — run and export certification reports.
 */

class AdminCertification {
  constructor({ certRunners = {}, adminAudit }) {
    this._runners = certRunners;
    this._audit   = adminAudit;
    this._history = [];
  }

  async runAll(operatorId) {
    this._audit.record('RUN_ALL_CERTIFICATIONS', operatorId, {});
    const results = {};
    for (const [phase, runner] of Object.entries(this._runners)) {
      try { results[phase] = await runner(); } catch (err) { results[phase] = { error: err.message }; }
    }
    const report = { generated_at: Date.now(), operator_id: operatorId, results };
    this._history.push(report);
    return report;
  }

  async runPhase(operatorId, phase) {
    this._audit.record('RUN_CERTIFICATION', operatorId, { phase });
    const runner = this._runners[phase.toLowerCase()];
    if (!runner) return { ok: false, reason: `no runner for '${phase}'` };
    return runner();
  }

  getHistory() { return [...this._history]; }
}

module.exports = { AdminCertification };
