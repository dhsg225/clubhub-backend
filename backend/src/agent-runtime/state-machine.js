'use strict';
/**
 * agent-runtime/state-machine.js
 *
 * AgentStateMachine — 6-state deterministic transition machine.
 *
 * States:
 *   IDLE       — initialized, not yet running
 *   RUNNING    — actively executing workflow steps
 *   WAITING    — paused, pending an event trigger
 *   BLOCKED    — halted by kernel condition (FROZEN / REPLAY / DEGRADED)
 *   REPLAYING  — replaying historical execution trace
 *   TERMINATED — terminal state (no outgoing transitions)
 *
 * TERMINATED: []  ← terminal, zero outgoing transitions
 */

const AGENT_STATES = Object.freeze({
  IDLE:       'IDLE',
  RUNNING:    'RUNNING',
  WAITING:    'WAITING',
  BLOCKED:    'BLOCKED',
  REPLAYING:  'REPLAYING',
  TERMINATED: 'TERMINATED',
});

// VALID_TRANSITIONS table — validated on every transition() call
// TERMINATED: [] is the terminal marker
const VALID_TRANSITIONS = Object.freeze({
  [AGENT_STATES.IDLE]:       [AGENT_STATES.RUNNING, AGENT_STATES.TERMINATED],
  [AGENT_STATES.RUNNING]:    [AGENT_STATES.IDLE, AGENT_STATES.WAITING, AGENT_STATES.BLOCKED, AGENT_STATES.REPLAYING, AGENT_STATES.TERMINATED],
  [AGENT_STATES.WAITING]:    [AGENT_STATES.RUNNING, AGENT_STATES.BLOCKED, AGENT_STATES.TERMINATED],
  [AGENT_STATES.BLOCKED]:    [AGENT_STATES.RUNNING, AGENT_STATES.WAITING, AGENT_STATES.TERMINATED],
  [AGENT_STATES.REPLAYING]:  [AGENT_STATES.RUNNING, AGENT_STATES.BLOCKED, AGENT_STATES.TERMINATED],
  [AGENT_STATES.TERMINATED]: [],
});

class AgentStateMachine {
  constructor() {
    this._state   = AGENT_STATES.IDLE;
    this._history = [];
  }

  get currentState() { return this._state; }

  /**
   * transition(toState, reason)
   *
   * Validates transition against VALID_TRANSITIONS table.
   * Throws on invalid transition — fail-fast for correctness.
   */
  transition(toState, reason = '') {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed) {
      throw new Error(`AgentStateMachine: unrecognized state '${this._state}'`);
    }
    if (!allowed.includes(toState)) {
      throw new Error(
        `AgentStateMachine: invalid transition ${this._state} → ${toState} (reason: ${reason})`
      );
    }
    const from = this._state;
    this._state = toState;
    this._history.push({ from, to: toState, reason, seq: this._history.length });
    return { from, to: toState };
  }

  isTerminated() { return this._state === AGENT_STATES.TERMINATED; }
  isBlocked()    { return this._state === AGENT_STATES.BLOCKED; }
  isRunning()    { return this._state === AGENT_STATES.RUNNING; }
  isReplaying()  { return this._state === AGENT_STATES.REPLAYING; }
  isIdle()       { return this._state === AGENT_STATES.IDLE; }

  getHistory() { return [...this._history]; }
  snapshot()   { return { currentState: this._state, history_count: this._history.length }; }
}

module.exports = { AgentStateMachine, AGENT_STATES, VALID_TRANSITIONS };
