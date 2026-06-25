'use strict';
const { buildResponse } = require('./api-contracts');

class TopologyController {
  constructor({ topology, tenantRegistry }) {
    this._topology = topology;
    this._registry = tenantRegistry;
  }

  getSnapshot(tenantId) {
    const snap = this._topology.snapshot();
    // Filter to tenant-scoped entities
    const entities = {};
    for (const [id, e] of Object.entries(snap.entities)) {
      if (!e.attrs?.tenant_id || e.attrs.tenant_id === tenantId) entities[id] = e;
    }
    return buildResponse(true, { ...snap, entities, entity_count: Object.keys(entities).length });
  }

  getEntity(entityId) {
    const entity = this._topology.get(entityId);
    if (!entity) return buildResponse(false, `entity '${entityId}' not found`);
    return buildResponse(true, entity.snapshot ? entity.snapshot() : { id: entity.id, type: entity.type, attrs: entity.attrs });
  }

  getRelated(entityId) {
    const related = this._topology.getRelated(entityId);
    return buildResponse(true, related.map(e => ({ id: e.id, type: e.type })));
  }
}

module.exports = { TopologyController };
