-- 001_workflow_traces.sql
-- Append-only trace store for governed workflow execution.
--
-- H1: No trace mutation after insert
--     → No UPDATE paths in application code (enforced via TraceWriter)
--     → UPDATE rule prevents accidental DB-level updates
--
-- H2: step_index continuity enforced by TraceWriter.appendTrace()
-- H3: Continuous trace chain per workflow guaranteed by hash chaining
-- H4: lineage_ts NOT NULL enforced at schema level
-- H5: trace_hash NOT NULL — canonical SHA-256 of entry
-- H6: prev_trace_hash — null only for first entry per workflow (GENESIS)

CREATE TABLE IF NOT EXISTS workflow_traces (
  trace_id          VARCHAR(64)   NOT NULL,
  workflow_id       VARCHAR(255)  NOT NULL,
  agent_id          VARCHAR(255),
  correlation_id    VARCHAR(255),
  step_index        INTEGER       NOT NULL DEFAULT 0,
  event_type        VARCHAR(255)  NOT NULL,
  payload           JSONB         NOT NULL DEFAULT '{}',
  lineage_ts        BIGINT        NOT NULL,
  consistency_level VARCHAR(64),
  trace_hash        VARCHAR(64)   NOT NULL,
  prev_trace_hash   VARCHAR(64),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  PRIMARY KEY (trace_id)
);

-- Deterministic replay ordering: step_index + lineage_ts per workflow
CREATE INDEX IF NOT EXISTS idx_workflow_traces_workflow_id
  ON workflow_traces (workflow_id, step_index ASC, lineage_ts ASC);

-- Replay correlation query
CREATE INDEX IF NOT EXISTS idx_workflow_traces_correlation_id
  ON workflow_traces (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Agent-scoped forensic query
CREATE INDEX IF NOT EXISTS idx_workflow_traces_agent_id
  ON workflow_traces (agent_id)
  WHERE agent_id IS NOT NULL;

-- lineage_ts range query
CREATE INDEX IF NOT EXISTS idx_workflow_traces_lineage_ts
  ON workflow_traces (lineage_ts ASC);

-- H1: Prevent any UPDATE at DB level
-- If application code accidentally tries to UPDATE, this rule fires and does nothing.
CREATE RULE workflow_traces_no_update AS
  ON UPDATE TO workflow_traces DO INSTEAD NOTHING;

-- H1: Prevent any DELETE at DB level
CREATE RULE workflow_traces_no_delete AS
  ON DELETE TO workflow_traces DO INSTEAD NOTHING;

COMMENT ON TABLE workflow_traces IS
  'Append-only governance trace store. No updates or deletes permitted.';

COMMENT ON COLUMN workflow_traces.trace_hash IS
  'SHA-256 of canonical entry including prev_trace_hash. Forms hash chain per workflow.';

COMMENT ON COLUMN workflow_traces.prev_trace_hash IS
  'Hash of preceding entry per workflow_id. NULL for first entry (GENESIS sentinel).';

COMMENT ON COLUMN workflow_traces.lineage_ts IS
  'Kernel logical clock value. Deterministic — NOT a wall-clock timestamp.';
