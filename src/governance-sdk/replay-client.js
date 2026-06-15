'use strict';
/**
 * governance-sdk/replay-client.js
 *
 * ReplayClient: deterministic replay of SDK workflow execution traces.
 *
 * Maps recorded action sequences → kernel event emissions.
 * Uses kernel replay mode — all mutations blocked, read-only forensic view.
 *
 * Guarantees:
 *   - enterReplay() called before any trace processing
 *   - Steps replayed in step_index order (deterministic)
 *   - exitReplay() always called (finally block)
 *   - No mutations occur during replay
 */

class ReplayClient {
  constructor({ sdkClient, replayHooks, eventBus }) {
    this._sdkClient   = sdkClient;
    this._replayHooks = replayHooks;
    this._eventBus    = eventBus;
  }

  /**
   * replay(trace, correlationId)
   *
   * Deterministically replays a recorded workflow execution trace.
   * Events are emitted in step_index order (not wall-clock order).
   */
  async replay(trace, correlationId) {
    // Always enter replay mode before processing
    this._replayHooks.enterReplay(correlationId);

    const results = [];

    try {
      // Sort by step_index — deterministic ordering
      const steps = [...trace.steps].sort((a, b) => a.step_index - b.step_index);

      this._emit('sdk.replay.started', {
        correlation_id: correlationId,
        workflow_id:    trace.workflow_id,
        step_count:     steps.length,
      });

      for (const step of steps) {
        this._emit('sdk.replay.step', {
          correlation_id:  correlationId,
          step_index:      step.step_index,
          action:          step.action,
          original_status: step.status,
        });

        results.push({ step_index: step.step_index, action: step.action, replayed: true });
      }

      this._emit('sdk.replay.completed', {
        correlation_id: correlationId,
        workflow_id:    trace.workflow_id,
        step_count:     steps.length,
      });
    } finally {
      // Always exit replay — even on error
      this._replayHooks.exitReplay();
    }

    return {
      correlation_id:  correlationId,
      workflow_id:     trace.workflow_id,
      replayed_steps:  results.length,
      results,
    };
  }

  _emit(eventType, payload) {
    if (this._eventBus) this._eventBus.emit({ event_type: eventType, payload });
  }
}

module.exports = { ReplayClient };
