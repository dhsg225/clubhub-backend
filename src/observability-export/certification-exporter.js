'use strict';
/**
 * CertificationExporter — export-only certification snapshots.
 */

class CertificationExporter {
  constructor({ certRunners = {} } = {}) {
    this._runners  = certRunners;
    this._cache    = new Map();
  }

  async exportPhase(phase) {
    const runner = this._runners[phase.toLowerCase()];
    if (!runner) return { type: 'certification', error: `no runner for '${phase}'`, exported_at: Date.now() };
    try {
      const result = await runner();
      this._cache.set(phase, result);
      return { type: 'certification', exported_at: Date.now(), phase, ...result };
    } catch (err) {
      return { type: 'certification', error: err.message, exported_at: Date.now() };
    }
  }

  async exportAll() {
    const results = {};
    for (const phase of Object.keys(this._runners)) {
      results[phase] = await this.exportPhase(phase);
    }
    return { type: 'certification_bundle', exported_at: Date.now(), phases: results };
  }

  toNDJSON(result) {
    return JSON.stringify(result) + '\n';
  }
}

module.exports = { CertificationExporter };
