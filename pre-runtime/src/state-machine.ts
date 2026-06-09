import { TransitionRequest, StateMutationEvent, StateSnapshot } from './types';
import { GovernedClock } from './governed-clock';
import { sha256 } from './hash';
import { canonicalJSON } from './canonical-json';
import { TraceStore } from './trace-store';

const SNAPSHOT_BUFFER_SIZE = 10;

/**
 * Forbidden transition definition.
 * 'ANY' in `from` means the rule applies from any state.
 */
export interface ForbiddenRule {
  from: string; // state name or 'ANY'
  to: string;
  reason: string;
}

/**
 * State machine configuration.
 * transitions: maps each state to the set of states it may legally transition to.
 * forbidden: explicit rules with descriptive reasons (used when transition is rejected).
 */
export interface StateMachineConfig {
  id: string;
  initial: string;
  transitions: Record<string, string[]>; // fromState → [allowedToStates]
  forbidden: ForbiddenRule[];
}

/**
 * Generic deterministic state machine.
 *
 * Invariants:
 * - Illegal transitions throw — they never silently mutate state
 * - Every transition emits a StateMutationEvent to TraceStore
 * - State snapshots enable rollback for the last N transitions
 * - Transition functions are serialized (no concurrent mutation)
 * - AI authority is blocked unconditionally at the boundary
 */
export class StateMachine {
  private _state: string;
  private _snapshots: StateSnapshot[] = [];
  private _mutations: StateMutationEvent[] = [];
  private _locked = false;

  constructor(private readonly config: StateMachineConfig) {
    this._state = config.initial;
  }

  get state(): string {
    return this._state;
  }

  get id(): string {
    return this.config.id;
  }

  /** All mutation events emitted by this machine, in order. Immutable references. */
  getMutations(): readonly StateMutationEvent[] {
    return this._mutations;
  }

  /**
   * Attempt a state transition.
   *
   * Throws on:
   * - AI authority (unconditionally blocked)
   * - Forbidden transition (explicit rule match)
   * - Illegal transition (not in transitions table)
   * - Re-entrant call (machine locked during transition)
   *
   * Emits a StateMutationEvent to TraceStore on success.
   */
  transition(request: TransitionRequest): StateMutationEvent {
    if (this._locked) {
      throw new Error(
        `[${this.config.id}] Re-entrant transition attempt. Machine is locked during a transition.`
      );
    }

    // R-09: AI authority unconditionally blocked
    if ((request.authority as string) === 'AI') {
      throw new Error(
        `[${this.config.id}] AI authority is forbidden. ` +
          `Transition to ${request.toState} rejected at boundary.`
      );
    }

    this._locked = true;
    try {
      return this._executeTransition(request);
    } finally {
      this._locked = false;
    }
  }

  /**
   * Roll back to the last snapshot.
   * Returns true if rollback succeeded, false if no snapshot exists.
   */
  rollback(): boolean {
    const snap = this._snapshots.pop();
    if (!snap) return false;
    this._state = snap.state;
    return true;
  }

  /**
   * Reconstruct the final state from a sequence of StateMutationEvents.
   * R-11: Given same events → same final state, always.
   */
  replayFromHistory(events: StateMutationEvent[]): string {
    // Filter events for this machine
    const mine = events.filter((e) => e.machineId === this.config.id);
    if (mine.length === 0) return this.config.initial;
    return mine[mine.length - 1].toState;
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  private _executeTransition(request: TransitionRequest): StateMutationEvent {
    const { toState, authority, sourceId, reason, governedTimestamp } = request;
    const fromState = this._state;
    const startWall = Date.now(); // duration measurement only — not stored as operational truth

    // Check forbidden rules first (explicit descriptive rejection)
    const forbiddenRule = this.config.forbidden.find(
      (f) =>
        (f.from === fromState || f.from === 'ANY') && f.to === toState
    );
    if (forbiddenRule) {
      this._emitRejection(fromState, toState, reason, authority, governedTimestamp);
      throw new Error(
        `[${this.config.id}] Forbidden transition ${fromState} → ${toState}: ${forbiddenRule.reason}`
      );
    }

    // Check legal transition table
    const legal = [
      ...(this.config.transitions[fromState] ?? []),
      ...(this.config.transitions['ANY'] ?? []),
    ];
    if (!legal.includes(toState)) {
      this._emitRejection(fromState, toState, reason, authority, governedTimestamp);
      throw new Error(
        `[${this.config.id}] Illegal transition ${fromState} → ${toState}. ` +
          `Legal targets from ${fromState}: [${legal.join(', ') || 'none'}]`
      );
    }

    // Snapshot before mutating (R-23)
    this._pushSnapshot(fromState, reason, governedTimestamp);

    // Execute transition
    this._state = toState;
    const durationMs = Date.now() - startWall;

    // R-10: Emit StateMutationEvent
    const event: StateMutationEvent = Object.freeze({
      machineId: this.config.id,
      fromState,
      toState,
      trigger: reason,
      authority,
      transitionDurationMs: durationMs,
      timestamp: governedTimestamp,
      traceId: sha256(
        canonicalJSON({
          machineId: this.config.id,
          fromState,
          toState,
          timestamp: governedTimestamp,
          sourceId,
        })
      ),
    });

    this._mutations.push(event);
    TraceStore.appendState(event);

    return event;
  }

  private _pushSnapshot(state: string, reason: string, capturedAt: string): void {
    const snap: StateSnapshot = {
      machineId: this.config.id,
      state,
      context: {},
      capturedAt,
      transitionReason: reason,
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > SNAPSHOT_BUFFER_SIZE) {
      this._snapshots.shift();
    }
  }

  /** Emit a rejection trace event (transition was attempted but blocked). */
  private _emitRejection(
    fromState: string,
    toState: string,
    reason: string,
    authority: string,
    timestamp: string
  ): void {
    const event: StateMutationEvent = Object.freeze({
      machineId: this.config.id,
      fromState,
      toState: `REJECTED(${toState})`,
      trigger: reason,
      authority,
      transitionDurationMs: 0,
      timestamp,
      traceId: sha256(
        canonicalJSON({
          machineId: this.config.id,
          fromState,
          toState,
          timestamp,
          rejected: true,
        })
      ),
    });
    TraceStore.appendState(event);
  }
}
