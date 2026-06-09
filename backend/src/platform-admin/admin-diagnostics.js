'use strict';
/**
 * AdminDiagnostics — deterministic platform diagnostics.
 * Read-only. No mutations.
 */

class AdminDiagnostics {
  constructor({ registry, lifecycle, topology, health, convergenceEngine }) {
    this._registry    = registry          ?? null;
    this._lifecycle   = lifecycle         ?? null;
    this._topology    = topology          ?? null;
    this._health      = health            ?? null;
    this._convergence = convergenceEngine ?? null;
  }

  runDiagnostics() {
    const report = {
      generated_at: Date.now(),
      lifecycle:    this._lifecycle?.snapshot()   ?? null,
      registry:     this._registry?.snapshot()    ?? null,
      topology:     this._topology?.snapshot()    ?? null,
      health:       this._health?.snapshot()      ?? null,
      convergence:  this._convergence?.snapshot() ?? null,
    };
    report.summary = this._summarize(report);
    return report;
  }

  _summarize(report) {
    const issues = [];
    if (report.health?.overall && report.health.overall !== 'HEALTHY') {
      issues.push(`health: ${report.health.overall}`);
    }
    if (report.convergence?.errors > 0) {
      issues.push(`convergence errors: ${report.convergence.errors}`);
    }
    if (report.lifecycle?.current_state === 'DEGRADED') {
      issues.push('platform degraded');
    }
    return { issue_count: issues.length, issues };
  }
}

module.exports = { AdminDiagnostics };
