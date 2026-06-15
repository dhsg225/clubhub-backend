'use strict';
/**
 * trace-store/trace-reader.js
 *
 * Replay query engine — deterministic ordering by step_index + lineage_ts.
 *
 * All queries are READ ONLY. No writes.
 * Results are ordered deterministically for replay reconstruction.
 */

const BY_WORKFLOW_SQL = `
  SELECT *
  FROM workflow_traces
  WHERE workflow_id = $1
  ORDER BY step_index ASC, lineage_ts ASC
`;

const BY_CORRELATION_SQL = `
  SELECT *
  FROM workflow_traces
  WHERE correlation_id = $1
  ORDER BY step_index ASC, lineage_ts ASC
`;

const BY_RANGE_SQL = `
  SELECT *
  FROM workflow_traces
  WHERE lineage_ts >= $1
    AND lineage_ts <= $2
  ORDER BY workflow_id ASC, step_index ASC, lineage_ts ASC
`;

const BY_AGENT_SQL = `
  SELECT *
  FROM workflow_traces
  WHERE agent_id = $1
  ORDER BY step_index ASC, lineage_ts ASC
`;

const LAST_ENTRY_SQL = `
  SELECT *
  FROM workflow_traces
  WHERE workflow_id = $1
  ORDER BY step_index DESC, lineage_ts DESC
  LIMIT 1
`;

const STEP_CHECK_SQL = `
  SELECT step_index
  FROM workflow_traces
  WHERE workflow_id = $1
  ORDER BY step_index ASC, lineage_ts ASC
`;

class TraceReader {
  constructor({ pool }) {
    this._pool = pool;
  }

  /**
   * getByWorkflowId(workflowId)
   *
   * Returns all trace entries for a workflow, ordered deterministically.
   * sort: step_index ASC, lineage_ts ASC
   */
  async getByWorkflowId(workflowId) {
    const result = await this._pool.query(BY_WORKFLOW_SQL, [workflowId]);
    return result.rows.map(this._parseRow);
  }

  /**
   * getByCorrelationId(correlationId)
   *
   * Returns all trace entries for a replay correlation ID.
   */
  async getByCorrelationId(correlationId) {
    const result = await this._pool.query(BY_CORRELATION_SQL, [correlationId]);
    return result.rows.map(this._parseRow);
  }

  /**
   * getRange(fromTs, toTs)
   *
   * Returns trace entries within a lineage_ts range.
   * Ordered by workflow_id + step_index + lineage_ts for deterministic reconstruction.
   */
  async getRange(fromTs, toTs) {
    const result = await this._pool.query(BY_RANGE_SQL, [fromTs, toTs]);
    return result.rows.map(this._parseRow);
  }

  /**
   * getByAgentId(agentId)
   */
  async getByAgentId(agentId) {
    const result = await this._pool.query(BY_AGENT_SQL, [agentId]);
    return result.rows.map(this._parseRow);
  }

  /**
   * getLastEntry(workflowId)
   */
  async getLastEntry(workflowId) {
    const result = await this._pool.query(LAST_ENTRY_SQL, [workflowId]);
    return result.rows[0] ? this._parseRow(result.rows[0]) : null;
  }

  /**
   * getStepIndices(workflowId)
   *
   * Returns all step_index values for gap detection.
   */
  async getStepIndices(workflowId) {
    const result = await this._pool.query(STEP_CHECK_SQL, [workflowId]);
    return result.rows.map(r => r.step_index);
  }

  _parseRow(row) {
    return {
      ...row,
      payload:    typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload ?? {}),
      step_index: parseInt(row.step_index, 10),
      lineage_ts: parseInt(row.lineage_ts, 10),
    };
  }
}

module.exports = { TraceReader };
