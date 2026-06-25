'use strict';
/**
 * DeterministicBootstrap — ordered platform initialization.
 * Same dependency set → same init sequence → same operational state.
 */

const BOOTSTRAP_PHASES = Object.freeze([
  { id: 'kernel',         label: 'Governance Kernel',       order: 1 },
  { id: 'trace_store',    label: 'Trace Store',             order: 2 },
  { id: 'sdk',            label: 'Governance SDK',          order: 3 },
  { id: 'ota_runtime',    label: 'OTA Runtime',             order: 4 },
  { id: 'agent_runtime',  label: 'Agent Runtime',           order: 5 },
  { id: 'orchestration',  label: 'AI Orchestration',        order: 6 },
  { id: 'simulation',     label: 'Simulation Runtime',      order: 7 },
  { id: 'operator_ui',    label: 'Operator UI',             order: 8 },
  { id: 'topology',       label: 'Topology Manager',        order: 9 },
  { id: 'convergence',    label: 'Convergence Engine',      order: 10 },
]);

class DeterministicBootstrap {
  constructor({ registry, lifecycle, eventBus } = {}) {
    this._registry  = registry;
    this._lifecycle = lifecycle;
    this._eventBus  = eventBus ?? null;
    this._log       = [];
  }

  async run(initMap) {
    // initMap: { [phaseId]: async () => void }
    for (const phase of BOOTSTRAP_PHASES) {
      const fn = initMap[phase.id];
      if (!fn) continue;

      this._emit('platform.bootstrap.phase_start', { phase: phase.id, order: phase.order });
      const t0 = Date.now();
      try {
        await fn();
        const elapsed = Date.now() - t0;
        this._log.push({ phase: phase.id, status: 'OK', elapsed_ms: elapsed });
        this._emit('platform.bootstrap.phase_done', { phase: phase.id, elapsed_ms: elapsed });
        if (this._registry) this._registry.setState(phase.id, 'READY');
      } catch (err) {
        const elapsed = Date.now() - t0;
        this._log.push({ phase: phase.id, status: 'FAIL', error: err.message, elapsed_ms: elapsed });
        this._emit('platform.bootstrap.phase_fail', { phase: phase.id, error: err.message });
        throw new Error(`DeterministicBootstrap: phase '${phase.id}' failed: ${err.message}`);
      }
    }
    return { phases_completed: this._log.length, log: [...this._log] };
  }

  _emit(type, fields) {
    if (this._eventBus) this._eventBus.emit(type, fields);
  }

  getLog() { return [...this._log]; }
}

module.exports = { DeterministicBootstrap, BOOTSTRAP_PHASES };
