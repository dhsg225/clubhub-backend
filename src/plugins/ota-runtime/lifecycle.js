'use strict';
/**
 * lifecycle.js — Governed OTA runtime lifecycle state machine.
 *
 * States:
 *   UNINITIALIZED — not yet started
 *   BOOTING       — initializing kernel dependencies
 *   RECOVERING    — recovering from degraded state or restart
 *   ACTIVE        — normal operation, mutations permitted
 *   FROZEN        — deployment frozen, mutations blocked
 *   DEGRADED      — partial authority failure, read-only
 *   REPLAY        — executing replay, side effects suppressed
 *   SHUTDOWN      — terminated
 *
 * Transitions emit to eventBus when initialized with one.
 * snapshot() and healthReport() are always available.
 */

const LIFECYCLE_STATES = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  BOOTING:       'BOOTING',
  RECOVERING:    'RECOVERING',
  ACTIVE:        'ACTIVE',
  FROZEN:        'FROZEN',
  DEGRADED:      'DEGRADED',
  REPLAY:        'REPLAY',
  SHUTDOWN:      'SHUTDOWN',
});

// Valid state transitions
const VALID_TRANSITIONS = Object.freeze({
  UNINITIALIZED: ['BOOTING'],
  BOOTING:       ['ACTIVE', 'RECOVERING', 'DEGRADED', 'SHUTDOWN'],
  RECOVERING:    ['ACTIVE', 'DEGRADED', 'SHUTDOWN'],
  ACTIVE:        ['FROZEN', 'DEGRADED', 'REPLAY', 'SHUTDOWN'],
  FROZEN:        ['ACTIVE', 'DEGRADED', 'SHUTDOWN'],
  DEGRADED:      ['RECOVERING', 'SHUTDOWN'],
  REPLAY:        ['ACTIVE', 'SHUTDOWN'],
  SHUTDOWN:      [], // terminal
});

class OTARuntimeLifecycle {
  constructor() {
    this._state        = LIFECYCLE_STATES.UNINITIALIZED;
    this._previousState = null;
    this._transitionTs  = new Date().toISOString();
    this._reason        = 'initial';
    this._history       = [];
    this._eventBus      = null;
    this._BUS_EVENTS    = null;
    this._certificationStatus = null;
    this._certificationTs     = null;
  }

  /**
   * Wire kernel event bus. Optional — lifecycle works without it.
   * @param {object} eventBus  — kernel event-bus module { emit, BUS_EVENTS }
   */
  setEventBus(eventBus) {
    this._eventBus   = eventBus;
    this._BUS_EVENTS = eventBus?.BUS_EVENTS ?? null;
  }

  /**
   * Transition to a new state.
   * @param {string} toState
   * @param {string} reason
   * @throws if transition is not valid
   */
  transition(toState, reason = '') {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed) {
      throw new Error(`OTARuntimeLifecycle: current state '${this._state}' has no transition table`);
    }
    if (!allowed.includes(toState)) {
      throw new Error(
        `OTARuntimeLifecycle: invalid transition '${this._state}' → '${toState}'. ` +
        `Allowed: [${allowed.join(', ')}]`
      );
    }

    const ts = new Date().toISOString();
    const record = Object.freeze({
      from:   this._state,
      to:     toState,
      reason: reason || '',
      ts,
    });
    this._history.push(record);
    this._previousState = this._state;
    this._state         = toState;
    this._transitionTs  = ts;
    this._reason        = reason;

    this._emitTransitionEvent(record);
    return record;
  }

  _emitTransitionEvent(record) {
    if (!this._eventBus) return;
    try {
      this._eventBus.emit('governance.runtime.lifecycle_changed', {
        plugin:        'ota',
        from_state:    record.from,
        to_state:      record.to,
        reason:        record.reason,
        lineage_ts:    record.ts,
      });
    } catch { /* non-fatal */ }
  }

  getState() {
    return this._state;
  }

  isActive() {
    return this._state === LIFECYCLE_STATES.ACTIVE;
  }

  isFrozen() {
    return this._state === LIFECYCLE_STATES.FROZEN;
  }

  isReplay() {
    return this._state === LIFECYCLE_STATES.REPLAY;
  }

  isShutdown() {
    return this._state === LIFECYCLE_STATES.SHUTDOWN;
  }

  isMutationPermitted() {
    return this._state === LIFECYCLE_STATES.ACTIVE;
  }

  /**
   * Called by certification runner after certifyRuntime() completes.
   */
  setCertificationStatus(status) {
    this._certificationStatus = status;
    this._certificationTs     = new Date().toISOString();
  }

  snapshot() {
    return Object.freeze({
      plugin:               'ota',
      state:                this._state,
      previous_state:       this._previousState,
      transition_ts:        this._transitionTs,
      reason:               this._reason,
      mutation_permitted:   this.isMutationPermitted(),
      certification_status: this._certificationStatus,
      certification_ts:     this._certificationTs,
    });
  }

  healthReport() {
    const warnings = [];
    if (this._state === LIFECYCLE_STATES.DEGRADED) {
      warnings.push('OTA runtime is DEGRADED — authority partial failure');
    }
    if (this._state === LIFECYCLE_STATES.FROZEN) {
      warnings.push('OTA runtime is FROZEN — deployment mutations blocked');
    }
    if (this._state === LIFECYCLE_STATES.REPLAY) {
      warnings.push('OTA runtime is in REPLAY — side effects suppressed');
    }
    if (this._certificationStatus && this._certificationStatus !== 'PASS') {
      warnings.push(`Certification not PASS: ${this._certificationStatus}`);
    }
    return Object.freeze({
      plugin:       'ota',
      state:        this._state,
      healthy:      this._state === LIFECYCLE_STATES.ACTIVE,
      warnings,
      transition_ts: this._transitionTs,
    });
  }

  getHistory() {
    return [...this._history];
  }
}

module.exports = { OTARuntimeLifecycle, LIFECYCLE_STATES };
