'use strict';
/**
 * trace-store/trace-store.js
 *
 * TraceStore — main facade for all trace persistence operations.
 *
 * Provides:
 *   - appendTrace(event): persist a single trace entry
 *   - getTraceByWorkflowId(id): retrieve all traces for a workflow
 *   - getTraceByCorrelationId(id): retrieve traces for a replay session
 *   - getTraceRange(fromTs, toTs): retrieve traces by lineage_ts range
 *   - verifyIntegrity(workflowId): run hash chain + gap check
 *
 * Integration:
 *   - attachToEventBus(eventBus): subscribe to all governance/workflow/agent/sdk events
 *   - Non-invasive: works as a passive event bus subscriber
 *   - Can also be called directly from executor, client, workflows for explicit tracing
 *
 * H1–H6 invariants enforced via TraceWriter + TraceIntegrity.
 */

const { TraceWriter }    = require('./trace-writer');
const { TraceReader }    = require('./trace-reader');
const { TraceIntegrity } = require('./trace-integrity');
const { TraceReplay }    = require('./trace-replay');

// Event patterns to subscribe to when using event bus integration
const TRACE_EVENT_PATTERNS = [
  'governance.',
  'workflow.',
  'agent.',
  'sdk.',
];

class TraceStore {
  constructor({ pool }) {
    this._writer    = new TraceWriter({ pool });
    this._reader    = new TraceReader({ pool });
    this._integrity = new TraceIntegrity({ pool });
    this._replay    = new TraceReplay({ pool });
    this._subscriptions = [];
  }

  /**
   * appendTrace(event)
   *
   * Persist a single trace event.
   * Required fields: workflow_id, event_type, lineage_ts, step_index
   */
  async appendTrace(event) {
    return this._writer.appendTrace(event);
  }

  /**
   * appendTraceSafe(event)
   *
   * Non-throwing version for event bus integration.
   * Logs errors but does not propagate — ensures trace failures
   * never disrupt the governed operation being traced.
   */
  async appendTraceSafe(event) {
    try {
      return await this._writer.appendTrace(event);
    } catch (err) {
      // Trace write failure must not disrupt governance operations
      // But is logged as an error for operator visibility
      process.stderr.write(`[TraceStore] appendTraceSafe error: ${err.message}\n`);
      return null;
    }
  }

  /**
   * getTraceByWorkflowId(workflowId)
   *
   * Returns all trace entries, sorted step_index ASC, lineage_ts ASC.
   */
  async getTraceByWorkflowId(workflowId) {
    return this._reader.getByWorkflowId(workflowId);
  }

  /**
   * getTraceByCorrelationId(correlationId)
   */
  async getTraceByCorrelationId(correlationId) {
    return this._reader.getByCorrelationId(correlationId);
  }

  /**
   * getTraceRange(fromTs, toTs)
   *
   * Returns trace entries within a lineage_ts range.
   */
  async getTraceRange(fromTs, toTs) {
    return this._reader.getRange(fromTs, toTs);
  }

  /**
   * verifyIntegrity(workflowId)
   *
   * Run full integrity check:
   *   1. Hash chain verification (H5, H6)
   *   2. Gap detection (H2, H3)
   */
  async verifyIntegrity(workflowId) {
    const [chainResult, gapResult] = await Promise.all([
      this._integrity.verifyChain(workflowId),
      this._integrity.detectGaps(workflowId),
    ]);

    const valid = chainResult.valid && !gapResult.has_gaps;

    return {
      workflow_id:    workflowId,
      valid,
      chain:          chainResult,
      gaps:           gapResult,
    };
  }

  /**
   * rebuildExecution(workflowId)
   *
   * Reconstruct the full execution sequence from the trace store.
   */
  async rebuildExecution(workflowId) {
    return this._replay.rebuild(workflowId);
  }

  /**
   * attachToEventBus(eventBus, defaultWorkflowId?)
   *
   * Subscribe to all governance/workflow/agent/sdk events.
   * Each event is persisted non-invasively.
   * This is the passive integration path — no kernel code is modified.
   */
  attachToEventBus(eventBus, opts = {}) {
    const stepCounter = new Map(); // workflowId → current step

    for (const pattern of TRACE_EVENT_PATTERNS) {
      const sub = eventBus.subscribe(pattern + '*', async (event) => {
        const workflowId = event.payload?.workflow_id ?? opts.defaultWorkflowId ?? 'system';
        const stepIdx    = event.payload?.step_index  ?? this._nextStep(stepCounter, workflowId, event.event_type);

        await this.appendTraceSafe({
          workflow_id:       workflowId,
          agent_id:          event.payload?.agent_id         ?? null,
          correlation_id:    event.payload?.correlation_id   ?? null,
          step_index:        stepIdx,
          event_type:        event.event_type,
          payload:           event.payload ?? {},
          lineage_ts:        event.deterministic_ts ?? event.payload?.lineage_ts ?? 0,
          consistency_level: event.payload?.consistencyLevel ?? null,
        });
      });

      this._subscriptions.push(sub);
    }
  }

  _nextStep(counter, workflowId, eventType) {
    // Use event type to determine if this is a new step or same step
    const isStepEvent = eventType.includes('step');
    const current = counter.get(workflowId) ?? 0;
    if (isStepEvent) {
      counter.set(workflowId, current + 1);
      return current;
    }
    return current;
  }

  detachFromEventBus() {
    for (const sub of this._subscriptions) {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    }
    this._subscriptions = [];
  }
}

module.exports = { TraceStore };
