'use strict';
const clock        = require('../../core/clock');
const MemoryAdapter = require('../storage/MemoryAdapter');

class SimulationRuntime {
  constructor(opts = {}) {
    this._storage     = new MemoryAdapter();
    this._seedCounter = opts.seed ?? 0;
    if (opts.epochMs) clock.setFixed(opts.epochMs);
  }
  get name()    { return 'simulation'; }
  get storage() { return this._storage; }
  get capabilities() {
    return Object.freeze({
      advisory_locks:  false,
      crypto:          true,
      fs:              false,
      frozen_clock:    true,
      worker_threads:  false,
      determinism:     'CONTENT_ADDRESSED',
      max_ha_topology: 'SINGLE_NODE',
      replay_mode:     true,
    });
  }
  now() { return clock.now(); }
  randomBytes(n) {
    const buf = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      this._seedCounter = (this._seedCounter * 1664525 + 1013904223) >>> 0;
      buf[i] = this._seedCounter & 0xff;
    }
    return buf;
  }
  reset() { this._storage._reset(); clock.unfreeze(); this._seedCounter = 0; }
}
module.exports = SimulationRuntime;
