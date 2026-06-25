'use strict';
/**
 * SimulationEventBus — isolated, partition-aware event topology.
 *
 * Each simulation run gets its own bus instance.
 * H2: Simulation NEVER touches production DB or production bus.
 * H5: Partitions are reversible.
 *
 * Features:
 *   - Isolated from governance-kernel/event-bus.js
 *   - Partition-aware routing (events withheld across partition boundary)
 *   - Delayed propagation queue (deterministic delivery at fastForward time)
 *   - Drop accounting (no nondeterminism — caller supplies drop decision)
 *   - Deterministic event IDs (counter-based, not random)
 */

class SimulationEventBus {
  constructor(clock) {
    this._clock       = clock;
    this._subscribers = new Map();   // eventType → [{ handler, node_id }]
    this._buffer      = [];          // all emitted events (capped at MAX)
    this._delayed     = [];          // { deliverAt, eventType, fields, source_node }
    this._partitions  = new Set();   // 'nodeA:nodeB' canonical pairs
    this._counter     = 0;           // deterministic event ID counter
    this._dropped     = 0;           // total explicitly dropped events
    this._MAX         = 20_000;
  }

  /**
   * Emit event into the bus.
   * opts.source_node — originating node ID for partition filtering
   * opts.drop        — if true, count as dropped and return null (no delivery)
   */
  emit(eventType, fields = {}, opts = {}) {
    const { source_node = 'cluster', drop = false } = opts;
    if (drop) { this._dropped++; return null; }

    const event = Object.freeze({
      event_type:       eventType,
      event_id:         `sim_${++this._counter}`,
      deterministic_ts: this._clock.nowIso(),
      epoch_ms:         this._clock.now(),
      source_node,
      ...fields,
    });

    this._buffer.push(event);
    if (this._buffer.length > this._MAX) this._buffer.shift();

    this._dispatch(event, source_node);
    return event;
  }

  /**
   * Queue an event for delivery when clock reaches deliverAt.
   * Call flush(targetTimeMs) to deliver pending events.
   */
  emitDelayed(eventType, fields = {}, delayMs = 0, opts = {}) {
    const { source_node = 'cluster' } = opts;
    const deliverAt = this._clock.now() + delayMs;
    this._delayed.push({ deliverAt, eventType, fields: { ...fields }, source_node });
    return deliverAt;
  }

  /**
   * Deliver all queued events with deliverAt <= targetTimeMs.
   * Returns count of delivered events.
   */
  flush(targetTimeMs) {
    const ready  = this._delayed.filter(d => d.deliverAt <= targetTimeMs);
    this._delayed = this._delayed.filter(d => d.deliverAt > targetTimeMs);
    for (const d of ready) {
      this.emit(d.eventType, d.fields, { source_node: d.source_node });
    }
    return ready.length;
  }

  /** Add bidirectional network partition between nodeA and nodeB. */
  addPartition(nodeA, nodeB) {
    this._partitions.add(`${nodeA}:${nodeB}`);
    this._partitions.add(`${nodeB}:${nodeA}`);
  }

  /** Remove bidirectional partition (restores connectivity). */
  removePartition(nodeA, nodeB) {
    this._partitions.delete(`${nodeA}:${nodeB}`);
    this._partitions.delete(`${nodeB}:${nodeA}`);
  }

  /** Whether a unidirectional edge is partitioned. */
  isPartitioned(fromNode, toNode) {
    return this._partitions.has(`${fromNode}:${toNode}`);
  }

  /** Returns set of all active partition pairs. */
  getPartitions() {
    return new Set(this._partitions);
  }

  /**
   * Subscribe to events of a given type.
   * node_id — if set, events from partitioned sources are withheld from this subscriber.
   * Returns unsubscribe function.
   */
  subscribe(eventType, handler, node_id = null) {
    if (!this._subscribers.has(eventType)) this._subscribers.set(eventType, []);
    const entry = { handler, node_id };
    this._subscribers.get(eventType).push(entry);
    return () => {
      const list = this._subscribers.get(eventType);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  /** Query event buffer. */
  getBuffer(opts = {}) {
    const { type, source_node, limit } = opts;
    let events = [...this._buffer];
    if (type)        events = events.filter(e => e.event_type === type);
    if (source_node) events = events.filter(e => e.source_node === source_node);
    if (limit)       events = events.slice(-limit);
    return events;
  }

  /** Full buffer snapshot. */
  snapshot() { return [...this._buffer]; }

  getDroppedCount()   { return this._dropped; }
  getPendingDelayed() { return this._delayed.length; }
  getEventCount()     { return this._counter; }

  /** Full reset — used between simulation runs. */
  _reset() {
    this._subscribers.clear();
    this._buffer.length   = 0;
    this._delayed.length  = 0;
    this._partitions.clear();
    this._counter = 0;
    this._dropped = 0;
  }

  // — private ——————————————————————————————————————

  _dispatch(event, sourceNode) {
    for (const eventType of [event.event_type, '*']) {
      const handlers = this._subscribers.get(eventType);
      if (!handlers) continue;
      for (const { handler, node_id } of handlers) {
        if (sourceNode && node_id && this.isPartitioned(sourceNode, node_id)) continue;
        try { handler(event); } catch { /* safe — simulation bus never rethrows */ }
      }
    }
  }
}

module.exports = { SimulationEventBus };
