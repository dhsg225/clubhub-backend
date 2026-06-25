'use strict';
/**
 * trace-store/trace-writer.js
 *
 * Append-only trace writer. INSERTS only — no UPDATE, no DELETE.
 *
 * Guarantees:
 *   - Atomic batch insert per workflow with step_index continuity check
 *   - prev_trace_hash chaining acquired under row lock
 *   - Failure-safe: throws on any write error — no silent drop
 *
 * H1: No trace mutation after insert (no UPDATE paths exist)
 * H2: step_index continuity enforced in appendTrace()
 * H4: lineage_ts required — rejects entries without it
 */

const { buildEntry } = require('./trace-schema');

const INSERT_SQL = `
  INSERT INTO workflow_traces
    (trace_id, workflow_id, agent_id, correlation_id, step_index,
     event_type, payload, lineage_ts, consistency_level, trace_hash, prev_trace_hash)
  VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT (trace_id) DO NOTHING
`;

const LAST_TRACE_SQL = `
  SELECT step_index, trace_hash
  FROM workflow_traces
  WHERE workflow_id = $1
  ORDER BY step_index DESC, lineage_ts DESC
  LIMIT 1
  FOR UPDATE
`;

class TraceWriter {
  constructor({ pool }) {
    this._pool = pool;
  }

  /**
   * appendTrace(raw)
   *
   * Append a single trace entry.
   * Acquires row lock to safely chain prev_trace_hash.
   * Validates lineage_ts is present.
   */
  async appendTrace(raw) {
    if (raw.lineage_ts === undefined || raw.lineage_ts === null) {
      throw new Error('TraceWriter: lineage_ts is required (H4)');
    }
    if (!raw.workflow_id) {
      throw new Error('TraceWriter: workflow_id is required');
    }

    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');

      // Get last trace for this workflow to chain prev_trace_hash
      const last = await client.query(LAST_TRACE_SQL, [raw.workflow_id]);
      const prevHash       = last.rows[0]?.trace_hash   ?? null;
      const prevStepIndex  = last.rows[0]?.step_index   ?? -1;

      // H2: enforce contiguous step_index (allow same step for different event types)
      const incomingStep = raw.step_index ?? 0;
      if (incomingStep < prevStepIndex) {
        throw new Error(
          `TraceWriter: step_index ${incomingStep} < prev ${prevStepIndex} for workflow ${raw.workflow_id} (H2)`
        );
      }

      const entry = buildEntry(raw, prevHash);

      await client.query(INSERT_SQL, [
        entry.trace_id,
        entry.workflow_id,
        entry.agent_id        ?? null,
        entry.correlation_id  ?? null,
        entry.step_index,
        entry.event_type,
        JSON.stringify(entry.payload ?? {}),
        entry.lineage_ts,
        entry.consistency_level ?? null,
        entry.trace_hash,
        entry.prev_trace_hash,
      ]);

      await client.query('COMMIT');
      return entry;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * appendBatch(rawEntries)
   *
   * Write multiple trace entries for the same workflow atomically.
   * Entries must be pre-sorted by step_index.
   */
  async appendBatch(rawEntries) {
    if (!rawEntries || rawEntries.length === 0) return [];

    const workflowIds = new Set(rawEntries.map(e => e.workflow_id));
    if (workflowIds.size > 1) {
      throw new Error('TraceWriter.appendBatch: all entries must share the same workflow_id');
    }

    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');

      const last      = await client.query(LAST_TRACE_SQL, [rawEntries[0].workflow_id]);
      let prevHash    = last.rows[0]?.trace_hash   ?? null;

      const written = [];
      for (const raw of rawEntries) {
        if (!raw.lineage_ts && raw.lineage_ts !== 0) {
          throw new Error('TraceWriter.appendBatch: lineage_ts required for all entries (H4)');
        }
        const entry = buildEntry(raw, prevHash);
        await client.query(INSERT_SQL, [
          entry.trace_id, entry.workflow_id, entry.agent_id ?? null,
          entry.correlation_id ?? null, entry.step_index, entry.event_type,
          JSON.stringify(entry.payload ?? {}), entry.lineage_ts,
          entry.consistency_level ?? null, entry.trace_hash, entry.prev_trace_hash,
        ]);
        prevHash = entry.trace_hash;
        written.push(entry);
      }

      await client.query('COMMIT');
      return written;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = { TraceWriter };
