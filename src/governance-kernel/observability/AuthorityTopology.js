'use strict';
const clusterConsensus = require('../core/cluster-consensus');

class AuthorityTopology {
  snapshot() {
    const status = clusterConsensus.getStatus();
    return Object.freeze({
      epoch:               clusterConsensus.getEpoch(),
      cluster_status:      status.status,
      node_count:          status.node_count ?? status.screen_count ?? 0,
      stale_count:         status.stale_count ?? 0,
      frozen:              clusterConsensus.isDeploymentFrozen?.() ?? clusterConsensus.isRolloutFrozen?.(),
      freeze_epoch:        clusterConsensus.getFreezeEpoch?.() ?? 0,
      artifact_generation: status.current_artifact_generation ?? status.generation ?? 0,
    });
  }
}
module.exports = AuthorityTopology;
