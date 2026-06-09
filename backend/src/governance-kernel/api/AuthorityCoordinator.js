'use strict';
const clusterConsensus     = require('../core/cluster-consensus');
const distributedAuthority = require('../core/distributed-authority');

class AuthorityCoordinator {
  // LINEARIZED: advisory-lock increment
  async incrementEpoch()              { return clusterConsensus.incrementEpoch(); }
  // CACHE_COHERENT: in-memory epoch
  getEpoch()                          { return clusterConsensus.getEpoch(); }
  // CACHE_COHERENT: in-memory freeze check
  isDeploymentFrozen()                { return clusterConsensus.isDeploymentFrozen(); }
  // DB_AUTHORITATIVE: strong freeze read
  async isDeploymentFrozenStrong(pool){ return clusterConsensus.getFreezeStateStrong(pool); }
  // LINEARIZED: transactional freeze
  async freezeStrong(reason, pool)    { return clusterConsensus.freezeStrong(reason, pool); }
  // MEMORY_ONLY: in-memory unfreeze + DB
  unfreezeDeployment(reason)          { return clusterConsensus.unfreezeDeployment(reason); }
  // MEMORY_ONLY: cluster status
  getClusterStatus()                  { return clusterConsensus.getStatus(); }
  // DB-AUTHORITATIVE: record node heartbeat
  async recordNodeHeartbeat(nodeId, fields) { return clusterConsensus.recordNodeHeartbeat(nodeId, fields); }
  // Distributed authority lease
  isLeaseHolder()                     { return distributedAuthority.isLeaseHolder?.() ?? true; }
}

module.exports = { AuthorityCoordinator };
