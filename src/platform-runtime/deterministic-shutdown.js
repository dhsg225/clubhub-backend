'use strict';
/**
 * DeterministicShutdown — reverse-order platform shutdown.
 * Flushes traces, finalizes streams, freezes mutation paths.
 */

class DeterministicShutdown {
  constructor({ registry, lifecycle, eventBus } = {}) {
    this._registry  = registry;
    this._lifecycle = lifecycle;
    this._eventBus  = eventBus ?? null;
    this._log       = [];
  }

  async run(shutdownMap) {
    // shutdownMap: { [runtimeId]: async () => void }
    // Reverse of bootstrap order
    const order = this._registry
      ? this._registry.getShutdownOrder()
      : Object.keys(shutdownMap).map(id => ({ id }));

    for (const entry of order) {
      const fn = shutdownMap[entry.id];
      if (!fn) continue;

      this._emit('platform.shutdown.phase_start', { phase: entry.id });
      const t0 = Date.now();
      try {
        await fn();
        const elapsed = Date.now() - t0;
        this._log.push({ phase: entry.id, status: 'OK', elapsed_ms: elapsed });
        this._emit('platform.shutdown.phase_done', { phase: entry.id, elapsed_ms: elapsed });
        if (this._registry) this._registry.setState(entry.id, 'TERMINATED');
      } catch (err) {
        const elapsed = Date.now() - t0;
        this._log.push({ phase: entry.id, status: 'FAIL', error: err.message, elapsed_ms: elapsed });
        this._emit('platform.shutdown.phase_fail', { phase: entry.id, error: err.message });
        // Continue shutdown despite errors — must not leave zombie runtimes
      }
    }
    return { phases_completed: this._log.length, log: [...this._log] };
  }

  _emit(type, fields) {
    if (this._eventBus) this._eventBus.emit(type, fields);
  }

  getLog() { return [...this._log]; }
}

module.exports = { DeterministicShutdown };
