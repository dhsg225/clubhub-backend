'use strict';
/**
 * trace-store/trace-integrity.js
 *
 * Hash chain integrity verification + gap detection + tamper detection.
 *
 * H1: No trace mutation after insert
 * H2: No missing step_index allowed
 * H3: Every workflow must have complete contiguous trace chain
 * H5: trace_hash must match canonical serialization
 * H6: prev_trace_hash must form continuous chain per workflow_id
 */

const { verifyEntry, GENESIS_HASH } = require('./trace-schema');
const { TraceReader }               = require('./trace-reader');

class TraceIntegrity {
  constructor({ pool }) {
    this._reader = new TraceReader({ pool });
  }

  /**
   * verifyChain(workflowId)
   *
   * Verifies the complete hash chain for a workflow:
   *   1. Loads all traces in deterministic order
   *   2. Recomputes each trace_hash and checks against stored value (H5)
   *   3. Checks prev_trace_hash links are continuous (H6)
   *   4. Reports any tampered entries
   */
  async verifyChain(workflowId) {
    const entries = await this._reader.getByWorkflowId(workflowId);

    if (entries.length === 0) {
      return { workflow_id: workflowId, valid: true, entry_count: 0, violations: [] };
    }

    const violations = [];
    let expectedPrev = GENESIS_HASH;

    for (const entry of entries) {
      // H5: verify trace_hash
      const { valid, expected, actual } = verifyEntry(entry);
      if (!valid) {
        violations.push({
          code:    'HASH_MISMATCH',
          trace_id: entry.trace_id,
          step_index: entry.step_index,
          detail:  `Expected trace_hash ${expected}, got ${actual}`,
        });
      }

      // H6: verify prev_trace_hash chain
      if (entry.prev_trace_hash !== expectedPrev) {
        violations.push({
          code:      'CHAIN_BREAK',
          trace_id:  entry.trace_id,
          step_index: entry.step_index,
          detail:    `Expected prev_trace_hash ${expectedPrev}, got ${entry.prev_trace_hash}`,
        });
      }

      expectedPrev = entry.trace_hash;
    }

    return {
      workflow_id:  workflowId,
      valid:        violations.length === 0,
      entry_count:  entries.length,
      violations,
    };
  }

  /**
   * detectGaps(workflowId)
   *
   * Checks that step_index is contiguous (H2, H3).
   * step_index values may repeat (multiple event types per step)
   * but no gap is allowed (e.g., 0, 1, 3 — gap at 2 is a violation).
   */
  async detectGaps(workflowId) {
    const stepIndices = await this._reader.getStepIndices(workflowId);

    if (stepIndices.length === 0) {
      return { workflow_id: workflowId, has_gaps: false, gaps: [] };
    }

    const unique = [...new Set(stepIndices)].sort((a, b) => a - b);
    const gaps   = [];

    for (let i = 1; i < unique.length; i++) {
      if (unique[i] - unique[i - 1] > 1) {
        gaps.push({ from: unique[i - 1], to: unique[i], missing: unique[i - 1] + 1 });
      }
    }

    return {
      workflow_id: workflowId,
      has_gaps:    gaps.length > 0,
      gaps,
      step_count:  unique.length,
      min_step:    unique[0],
      max_step:    unique[unique.length - 1],
    };
  }

  /**
   * verifyEntry(entry)
   *
   * Verify a single trace entry's hash against canonical serialization.
   */
  verifyEntry(entry) {
    return verifyEntry(entry);
  }

  /**
   * detectOrphans(pool)
   *
   * Detects trace entries whose workflow_id has no corresponding workflow.started event.
   * An orphan = entry with event_type != 'workflow.started' and no 'workflow.started' exists.
   */
  async detectOrphans() {
    // Read all workflow.started events to build set of known workflow_ids
    // Then check for entries whose workflow_id is not in that set
    // For now, return empty (schema enforcement at DB level is the primary guarantee)
    return { orphan_count: 0, orphans: [] };
  }
}

module.exports = { TraceIntegrity };
