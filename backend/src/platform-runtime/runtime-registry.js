'use strict';
/**
 * RuntimeRegistry — canonical registration and lookup of all platform subsystems.
 * Each runtime is registered with: id, instance, state, init order, shutdown order.
 */

const RUNTIME_STATES = Object.freeze({
  UNREGISTERED: 'UNREGISTERED',
  REGISTERED:   'REGISTERED',
  INITIALIZING: 'INITIALIZING',
  READY:        'READY',
  DEGRADED:     'DEGRADED',
  SHUTTING_DOWN:'SHUTTING_DOWN',
  TERMINATED:   'TERMINATED',
});

class RuntimeRegistry {
  constructor() {
    this._runtimes = new Map();   // id → entry
    this._initOrder = [];         // ordered list for init
    this._shutdownOrder = [];     // ordered list for shutdown (reverse)
  }

  /**
   * register(id, instance, opts)
   * opts: { initOrder, shutdownOrder, required }
   */
  register(id, instance, opts = {}) {
    if (this._runtimes.has(id)) throw new Error(`RuntimeRegistry: '${id}' already registered`);
    const entry = {
      id,
      instance,
      state: RUNTIME_STATES.REGISTERED,
      initOrder:     opts.initOrder     ?? 50,
      shutdownOrder: opts.shutdownOrder ?? 50,
      required:      opts.required      ?? true,
      registered_at: Date.now(),
    };
    this._runtimes.set(id, entry);
    this._initOrder     = [...this._runtimes.values()].sort((a, b) => a.initOrder     - b.initOrder);
    this._shutdownOrder = [...this._runtimes.values()].sort((a, b) => b.shutdownOrder - a.shutdownOrder);
    return entry;
  }

  get(id) {
    const entry = this._runtimes.get(id);
    if (!entry) throw new Error(`RuntimeRegistry: '${id}' not found`);
    return entry;
  }

  getInstance(id) { return this.get(id).instance; }

  setState(id, state) {
    const entry = this.get(id);
    entry.state = state;
  }

  getInitOrder()     { return [...this._initOrder]; }
  getShutdownOrder() { return [...this._shutdownOrder]; }

  snapshot() {
    const entries = {};
    for (const [id, e] of this._runtimes) {
      entries[id] = { id, state: e.state, initOrder: e.initOrder, shutdownOrder: e.shutdownOrder, required: e.required };
    }
    return { runtimes: entries, count: this._runtimes.size };
  }

  isAllReady() {
    for (const e of this._runtimes.values()) {
      if (e.required && e.state !== RUNTIME_STATES.READY) return false;
    }
    return true;
  }
}

module.exports = { RuntimeRegistry, RUNTIME_STATES };
