'use strict';
/**
 * ConvergenceExporter — export-only convergence findings.
 */

class ConvergenceExporter {
  constructor({ convergenceEngine }) {
    this._ce = convergenceEngine ?? null;
  }

  export() {
    if (!this._ce) return { type: 'convergence', error: 'engine_unavailable', exported_at: Date.now() };
    const snap = this._ce.snapshot();
    return { type: 'convergence', exported_at: Date.now(), ...snap };
  }

  exportScan() {
    if (!this._ce) return { type: 'convergence_scan', error: 'engine_unavailable', exported_at: Date.now() };
    const scan = this._ce.runFullScan();
    return { type: 'convergence_scan', exported_at: Date.now(), ...scan };
  }

  toNDJSON() {
    return JSON.stringify(this.export()) + '\n';
  }
}

module.exports = { ConvergenceExporter };
