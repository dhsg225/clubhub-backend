'use strict';
/**
 * TopologyManager — unified topology graph for all platform entities.
 * Detection and observation only. No mutations.
 */

const ENTITY_TYPES = Object.freeze({
  NODE:            'NODE',
  RUNTIME:         'RUNTIME',
  AGENT:           'AGENT',
  WORKFLOW:        'WORKFLOW',
  INCIDENT:        'INCIDENT',
  REPLAY_SESSION:  'REPLAY_SESSION',
  FREEZE:          'FREEZE',
  PARTITION:       'PARTITION',
  OPERATOR_SESSION:'OPERATOR_SESSION',
});

class TopologyManager {
  constructor({ eventBus } = {}) {
    this._entities  = new Map();   // id → entity
    this._edges     = new Map();   // id → Set of related ids
    this._eventBus  = eventBus ?? null;
    this._seq       = 0;
  }

  _nextId(type) { return `${type.toLowerCase()}_${++this._seq}`; }

  register(id, type, attrs = {}) {
    if (this._entities.has(id)) throw new Error(`TopologyManager: '${id}' already registered`);
    if (!Object.values(ENTITY_TYPES).includes(type)) throw new Error(`TopologyManager: unknown type '${type}'`);
    const entity = { id, type, attrs, registered_at: Date.now(), snapshot: () => ({ id, type, attrs }) };
    this._entities.set(id, entity);
    if (!this._edges.has(id)) this._edges.set(id, new Set());
    if (this._eventBus) this._eventBus.emit('platform.topology.registered', { id, type });
    return entity;
  }

  deregister(id) {
    if (!this._entities.has(id)) return false;
    this._entities.delete(id);
    this._edges.delete(id);
    for (const [, edges] of this._edges) edges.delete(id);
    if (this._eventBus) this._eventBus.emit('platform.topology.deregistered', { id });
    return true;
  }

  link(fromId, toId) {
    if (!this._edges.has(fromId)) this._edges.set(fromId, new Set());
    if (!this._edges.has(toId))   this._edges.set(toId,   new Set());
    this._edges.get(fromId).add(toId);
    this._edges.get(toId).add(fromId);
  }

  get(id) { return this._entities.get(id) ?? null; }

  getByType(type) {
    return [...this._entities.values()].filter(e => e.type === type);
  }

  getRelated(id) {
    const ids = this._edges.get(id) ?? new Set();
    return [...ids].map(rid => this._entities.get(rid)).filter(Boolean);
  }

  snapshot() {
    const entities = {};
    for (const [id, e] of this._entities) {
      entities[id] = { id, type: e.type, attrs: e.attrs };
    }
    const edges = {};
    for (const [id, related] of this._edges) {
      edges[id] = [...related];
    }
    return {
      entity_count: this._entities.size,
      entities,
      edges,
      snapshot_at: Date.now(),
    };
  }
}

module.exports = { TopologyManager, ENTITY_TYPES };
