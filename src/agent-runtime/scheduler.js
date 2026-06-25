'use strict';
/**
 * agent-runtime/scheduler.js
 *
 * DeterministicScheduler — event-driven workflow trigger scheduling.
 *
 * IMPORTANT: No setInterval or setTimeout used.
 * All scheduling is event-driven — triggered by governance event bus events.
 * This ensures scheduling behavior is identical in live and replay modes.
 *
 * In replay mode, triggers are sourced from the recorded event sequence.
 * New side effects are suppressed during replay.
 */

class DeterministicScheduler {
  constructor({ eventBus, replayHooks }) {
    this._eventBus    = eventBus;
    this._replayHooks = replayHooks ?? null;
    this._triggers    = new Map();  // triggerEventPattern → workflowId
    this._subscriptions = [];
    this._running     = false;
  }

  /**
   * schedule(workflowId, triggerEventPattern)
   *
   * Register a workflow to fire when a matching governance event is emitted.
   */
  schedule(workflowId, triggerEventPattern) {
    this._triggers.set(triggerEventPattern, workflowId);
    return this;
  }

  /**
   * start(onTrigger)
   *
   * Subscribe to all registered trigger patterns.
   * onTrigger(workflowId, triggerEvent) is called when a trigger fires.
   *
   * In replay mode: event listeners remain active (for observation)
   * but onTrigger is NOT called — no new side effects are initiated.
   */
  start(onTrigger) {
    if (this._running) return;
    this._running = true;

    for (const [pattern, workflowId] of this._triggers) {
      const sub = this._eventBus.subscribe(pattern, (event) => {
        // Replay mode: suppress new workflow triggers
        if (this._replayHooks && this._replayHooks.isReplayMode()) return;
        onTrigger(workflowId, event);
      });
      this._subscriptions.push(sub);
    }
  }

  stop() {
    this._running = false;
    for (const sub of this._subscriptions) {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    }
    this._subscriptions = [];
  }

  snapshot() {
    return {
      trigger_count:        this._triggers.size,
      active_subscriptions: this._subscriptions.length,
      running:              this._running,
    };
  }
}

module.exports = { DeterministicScheduler };
