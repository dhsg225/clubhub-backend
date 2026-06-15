'use strict';
/**
 * MetricsExporter — export-only platform metrics. No mutation capability.
 */

class MetricsExporter {
  constructor({ registry, health, lifecycle }) {
    this._registry  = registry  ?? null;
    this._health    = health    ?? null;
    this._lifecycle = lifecycle ?? null;
  }

  export() {
    return {
      type:        'metrics',
      exported_at: Date.now(),
      lifecycle:   this._lifecycle?.getState() ?? null,
      health:      this._health?.snapshot()    ?? null,
      runtimes:    this._registry?.snapshot()  ?? null,
    };
  }

  toNDJSON() {
    return JSON.stringify(this.export()) + '\n';
  }
}

module.exports = { MetricsExporter };
