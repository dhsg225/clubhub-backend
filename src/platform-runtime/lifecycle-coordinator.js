'use strict';
/**
 * LifecycleCoordinator — canonical platform lifecycle state machine.
 * All transitions are typed, governed, and emit events.
 */

const LIFECYCLE_STATES = Object.freeze({
  BOOTSTRAP:     'BOOTSTRAP',
  INITIALIZING:  'INITIALIZING',
  RECOVERING:    'RECOVERING',
  ACTIVE:        'ACTIVE',
  DEGRADED:      'DEGRADED',
  REPLAY:        'REPLAY',
  FROZEN:        'FROZEN',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  TERMINATED:    'TERMINATED',
});

const VALID_TRANSITIONS = Object.freeze({
  BOOTSTRAP:     ['INITIALIZING'],
  INITIALIZING:  ['RECOVERING', 'ACTIVE', 'TERMINATED'],
  RECOVERING:    ['ACTIVE', 'DEGRADED', 'TERMINATED'],
  ACTIVE:        ['DEGRADED', 'FROZEN', 'REPLAY', 'SHUTTING_DOWN'],
  DEGRADED:      ['ACTIVE', 'RECOVERING', 'FROZEN', 'SHUTTING_DOWN'],
  REPLAY:        ['ACTIVE', 'DEGRADED', 'FROZEN', 'SHUTTING_DOWN'],
  FROZEN:        ['ACTIVE', 'SHUTTING_DOWN'],
  SHUTTING_DOWN: ['TERMINATED'],
  TERMINATED:    [],
});

class LifecycleCoordinator {
  constructor({ eventBus, traceStore, clock } = {}) {
    this._state      = LIFECYCLE_STATES.BOOTSTRAP;
    this._history    = [{ state: LIFECYCLE_STATES.BOOTSTRAP, reason: 'platform_init', ts: Date.now() }];
    this._eventBus   = eventBus   ?? null;
    this._traceStore = traceStore ?? null;
    this._clock      = clock      ?? null;
    this._listeners  = [];
  }

  getState() { return this._state; }

  canTransition(to) {
    return VALID_TRANSITIONS[this._state]?.includes(to) ?? false;
  }

  transition(to, reason = 'unspecified') {
    // Synchronous validation — throws before any async work so callers can catch without await
    if (!VALID_TRANSITIONS[this._state]) {
      throw new Error(`LifecycleCoordinator: unknown state '${this._state}'`);
    }
    if (!VALID_TRANSITIONS[this._state].includes(to)) {
      throw new Error(`LifecycleCoordinator: invalid transition ${this._state} → ${to} (reason: ${reason})`);
    }
    return this._applyTransition(to, reason);
  }

  async _applyTransition(to, reason) {
    const from = this._state;
    this._state = to;
    const record = { from, to, reason, ts: Date.now() };
    this._history.push({ state: to, reason, ts: record.ts });

    if (this._eventBus) {
      this._eventBus.emit('platform.lifecycle.transition', record);
    }

    if (this._traceStore) {
      try {
        await this._traceStore.appendTraceSafe?.({
          workflow_id:  `lifecycle_${to.toLowerCase()}_${record.ts}`,
          agent_id:     'platform_lifecycle',
          action_type:  'LIFECYCLE_TRANSITION',
          args:         { from, to, reason },
          policy_result:'APPROVED',
          lineage_ts:   record.ts,
        });
      } catch (_) { /* trace store may not be available during shutdown */ }
    }

    for (const fn of this._listeners) fn(from, to, reason);
    return record;
  }

  onTransition(fn) { this._listeners.push(fn); }

  getHistory() { return [...this._history]; }

  snapshot() {
    return {
      current_state: this._state,
      history:       this.getHistory(),
      valid_next:    VALID_TRANSITIONS[this._state] ?? [],
    };
  }
}

module.exports = { LifecycleCoordinator, LIFECYCLE_STATES, VALID_TRANSITIONS };
