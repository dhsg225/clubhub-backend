'use strict';
class NodejsRuntime {
  get name() { return 'nodejs'; }
  get capabilities() {
    return Object.freeze({
      advisory_locks:  true,
      crypto:          true,
      fs:              true,
      frozen_clock:    true,
      worker_threads:  true,
      determinism:     'DETERMINISTIC_PER_DB',
      max_ha_topology: 'ACTIVE_ACTIVE_2_NODE',
    });
  }
  now()              { return Date.now(); }
  randomBytes(n)     { return require('node:crypto').randomBytes(n); }
  createHmac(alg, k) { return require('node:crypto').createHmac(alg, k); }
}
module.exports = NodejsRuntime;
