'use strict';
/**
 * AdminTopology — read-only topology access for administrators.
 */

class AdminTopology {
  constructor({ topology, adminAudit }) {
    this._topology = topology;
    this._audit    = adminAudit;
  }

  getFullSnapshot(operatorId) {
    this._audit.record('GET_TOPOLOGY_SNAPSHOT', operatorId, {});
    return this._topology.snapshot();
  }

  getByType(operatorId, type) {
    this._audit.record('GET_TOPOLOGY_BY_TYPE', operatorId, { type });
    return this._topology.getByType(type);
  }

  getRelated(operatorId, entityId) {
    this._audit.record('GET_TOPOLOGY_RELATED', operatorId, { entityId });
    return this._topology.getRelated(entityId);
  }
}

module.exports = { AdminTopology };
