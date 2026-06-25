'use strict';
const clusterConsensus = require('../core/cluster-consensus');

const DB_FAILURE_POLICIES = Object.freeze({
  FAIL_CLOSED: 'FAIL_CLOSED',
  FAIL_OPEN:   'FAIL_OPEN',
  STALE_OK:    'STALE_OK',
});

class FreezeController {
  constructor(opts = {}) {
    this._policy = opts.dbFailurePolicy ?? DB_FAILURE_POLICIES.FAIL_CLOSED;
  }
  // LINEARIZED: transactional strong freeze
  async freeze(reason, pool)          { return clusterConsensus.freezeStrong(reason, pool); }
  // MEMORY_ONLY: fast in-memory freeze (FAIL_CLOSED scenarios)
  freezeLocal(reason)                 { clusterConsensus.setFreeze(reason); }
  // MEMORY_ONLY
  unfreeze(reason)                    { clusterConsensus.unfreezeDeployment(reason); }
  // CACHE_COHERENT
  isFrozen()                          { return clusterConsensus.isDeploymentFrozen(); }
  // DB_AUTHORITATIVE
  async isFrozenStrong(pool)          { return clusterConsensus.getFreezeStateStrong(pool); }
  getFreezeEpoch()                    { return clusterConsensus.getFreezeEpoch?.() ?? 0; }
  get DB_FAILURE_POLICIES()           { return DB_FAILURE_POLICIES; }
}

module.exports = { FreezeController, DB_FAILURE_POLICIES };
