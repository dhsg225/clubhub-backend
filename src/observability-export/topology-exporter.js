'use strict';
/**
 * TopologyExporter — export-only topology snapshots. Replay-safe.
 */

class TopologyExporter {
  constructor({ topology }) {
    this._topology = topology ?? null;
  }

  export(tenantId = null) {
    if (!this._topology) return { type: 'topology', error: 'topology_unavailable', exported_at: Date.now() };
    const snap = this._topology.snapshot();
    const entities = tenantId
      ? Object.fromEntries(Object.entries(snap.entities).filter(([, e]) =>
          !e.attrs?.tenant_id || e.attrs.tenant_id === tenantId))
      : snap.entities;
    return { type: 'topology', exported_at: Date.now(), tenant_id: tenantId, ...snap, entities, entity_count: Object.keys(entities).length };
  }

  toNDJSON(tenantId = null) {
    return JSON.stringify(this.export(tenantId)) + '\n';
  }
}

module.exports = { TopologyExporter };
