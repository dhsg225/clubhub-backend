'use strict';
/**
 * trace-store/trace-replay.js
 *
 * Rebuild + validate full workflow execution from trace store.
 *
 * Replay guarantee:
 *   - Reconstruction sort: step_index ASC, lineage_ts ASC (deterministic)
 *   - SDK + Agent + Kernel call sequence reproducible from trace
 *   - No DB writes during replay reconstruction
 *   - Execution sequence is identical to original if trace is complete and untampered
 */

const { TraceReader }     = require('./trace-reader');
const { TraceIntegrity }  = require('./trace-integrity');

class TraceReplay {
  constructor({ pool }) {
    this._reader    = new TraceReader({ pool });
    this._integrity = new TraceIntegrity({ pool });
  }

  /**
   * rebuild(workflowId)
   *
   * Reconstruct the full execution sequence for a workflow from the trace store.
   * Returns entries in deterministic order (step_index ASC, lineage_ts ASC).
   *
   * This is the "ground truth" sequence for forensic replay.
   */
  async rebuild(workflowId) {
    // Step 1: verify chain integrity before replaying
    const chainResult = await this._integrity.verifyChain(workflowId);
    if (!chainResult.valid) {
      return {
        workflow_id:    workflowId,
        valid:          false,
        violations:     chainResult.violations,
        execution_sequence: [],
      };
    }

    // Step 2: check for step_index gaps
    const gapResult = await this._integrity.detectGaps(workflowId);
    if (gapResult.has_gaps) {
      return {
        workflow_id: workflowId,
        valid:       false,
        gaps:        gapResult.gaps,
        execution_sequence: [],
      };
    }

    // Step 3: load entries in deterministic order
    const entries = await this._reader.getByWorkflowId(workflowId);

    // Step 4: build execution sequence
    const execution_sequence = entries.map(entry => ({
      trace_id:         entry.trace_id,
      step_index:       entry.step_index,
      event_type:       entry.event_type,
      action:           entry.payload?.action ?? null,
      consistency_level: entry.consistency_level,
      lineage_ts:       entry.lineage_ts,
      agent_id:         entry.agent_id,
      correlation_id:   entry.correlation_id,
    }));

    return {
      workflow_id:        workflowId,
      valid:              true,
      entry_count:        entries.length,
      execution_sequence,
      lineage_ts_range:   {
        from: entries[0]?.lineage_ts,
        to:   entries[entries.length - 1]?.lineage_ts,
      },
    };
  }

  /**
   * rebuildByCorrelation(correlationId)
   *
   * Reconstruct execution for a specific replay correlation session.
   */
  async rebuildByCorrelation(correlationId) {
    const entries = await this._reader.getByCorrelationId(correlationId);

    const execution_sequence = entries.map(entry => ({
      trace_id:         entry.trace_id,
      workflow_id:      entry.workflow_id,
      step_index:       entry.step_index,
      event_type:       entry.event_type,
      consistency_level: entry.consistency_level,
      lineage_ts:       entry.lineage_ts,
    }));

    return {
      correlation_id:     correlationId,
      entry_count:        entries.length,
      execution_sequence,
    };
  }

  /**
   * validate(workflowId, expectedSequence)
   *
   * Compare rebuilt execution sequence against an expected sequence.
   * Returns whether replay is equivalent to original.
   *
   * Used for certification: trace replay == original execution.
   */
  async validate(workflowId, expectedSequence) {
    const rebuilt = await this.rebuild(workflowId);

    if (!rebuilt.valid) {
      return { equivalent: false, reason: 'trace integrity check failed', rebuilt };
    }

    const actual   = rebuilt.execution_sequence;
    const expected = expectedSequence;

    if (actual.length !== expected.length) {
      return {
        equivalent: false,
        reason:     `step count mismatch: expected ${expected.length}, got ${actual.length}`,
        actual_count:   actual.length,
        expected_count: expected.length,
      };
    }

    // Compare step-by-step
    const mismatches = [];
    for (let i = 0; i < expected.length; i++) {
      if (actual[i].event_type !== expected[i].event_type ||
          actual[i].step_index  !== expected[i].step_index) {
        mismatches.push({
          index:    i,
          expected: { event_type: expected[i].event_type, step_index: expected[i].step_index },
          actual:   { event_type: actual[i].event_type,   step_index: actual[i].step_index },
        });
      }
    }

    return {
      equivalent: mismatches.length === 0,
      mismatch_count: mismatches.length,
      mismatches,
    };
  }
}

module.exports = { TraceReplay };
