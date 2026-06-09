-- V6: Operational Hardening
-- Adds:
--   1. player_health_snapshots — current fleet health state (one row per screen)
--   2. Additional replay_audit_records indexes for investigation query performance
--   3. replay_audit_records partitions for upcoming months (proactive)
--   4. Partition management function + scheduled maintenance job hook
--   5. Corpus version freshness index for rollback target queries
--
-- CRITICAL NOTES:
--   replay_audit_records was correctly partitioned in V1.
--   This migration only adds indexes and pre-creates future partitions.
--   Never attempt to retrofit partitioning after data exists.
--
-- Performance target:
--   SELECT * FROM replay_audit_records WHERE venue_id=$1 AND created_at > now()-interval '1 hour'
--   must complete in <100ms at 10M rows per partition.
--   The composite index on (venue_id, created_at DESC) is the primary query pattern.
--   This was created in V1. V6 adds the investigation pattern: tenant+screen+time.

-- ─── Player Health Snapshots (fleet dashboard) ────────────────────────────────
-- One row per screen, upserted on each heartbeat.
-- NOT append-only — this is current state, not history.
-- History lives in replay_audit_records and heartbeat log (future).
CREATE TABLE player_health_snapshots (
  screen_id                UUID PRIMARY KEY REFERENCES screens(screen_id),
  last_seen_at             TIMESTAMPTZ,
  corpus_version_id        UUID REFERENCES corpus_versions(corpus_version_id),
  constitutional_state     TEXT,
  replay_cache_size_bytes  BIGINT,
  last_corpus_sync_at      TIMESTAMPTZ,
  consecutive_sync_failures INTEGER NOT NULL DEFAULT 0,
  disk_free_mb             INTEGER NOT NULL DEFAULT 0,
  memory_rss_mb            INTEGER NOT NULL DEFAULT 0,
  temperature_celsius      INTEGER,                    -- null = not available (non-Pi)
  corpus_load_source       TEXT CHECK (corpus_load_source IN ('current', 'previous', 'factory')),
  asset_url_expires_in_min INTEGER NOT NULL DEFAULT -1, -- -1 = no URLs tracked
  corpus_age_ms            BIGINT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_health_snapshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_health_snapshot_updated_at
  BEFORE INSERT OR UPDATE ON player_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_health_snapshot_timestamp();

-- Index for fleet dashboard queries: "show all degraded screens"
CREATE INDEX idx_player_health_status ON player_health_snapshots (last_seen_at DESC NULLS LAST);
CREATE INDEX idx_player_health_warnings ON player_health_snapshots (
  consecutive_sync_failures,
  disk_free_mb,
  corpus_load_source
) WHERE consecutive_sync_failures >= 3 OR disk_free_mb < 200 OR corpus_load_source != 'current';

COMMENT ON TABLE player_health_snapshots IS
  'Current operational state of each player. One row per screen, upserted on heartbeat. '
  'Not a history table — use replay_audit_records for history. '
  'This table drives the fleet health dashboard. Rows are never deleted unless screen is decommissioned.';

-- ─── Audit investigation index (V1 created venue+time; V6 adds tenant+screen+time) ──
-- Query pattern: "find all audit records for screen X in venue Y between 14:00–15:00"
-- Used by: audit investigation workflow, incident response, PRS compliance queries
CREATE INDEX idx_replay_audit_investigation
  ON replay_audit_records (screen_id, venue_id, created_at DESC)
  WHERE created_at > '2026-05-01';  -- partition-aware: planner prunes older partitions

-- Covering index for checksum verification queries (integrity check workflow)
-- Query: SELECT audit_record_id, record_checksum FROM replay_audit_records WHERE screen_id=$1
CREATE INDEX idx_replay_audit_checksum_lookup
  ON replay_audit_records (screen_id, audit_record_id, record_checksum);

-- ─── Pre-create future monthly partitions (replay_audit_records) ─────────────
-- Partitions must exist BEFORE data is inserted. Missing partition = INSERT failure.
-- Strategy: pre-create 6 months ahead, managed monthly by maintenance job.
-- OPERATOR ALERT: Add a calendar reminder to run maintain_audit_partitions() monthly.

CREATE TABLE replay_audit_records_2026_07
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE replay_audit_records_2026_08
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE replay_audit_records_2026_09
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE replay_audit_records_2026_10
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE replay_audit_records_2026_11
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE replay_audit_records_2026_12
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Pre-create for parity_records (same pattern)
CREATE TABLE parity_records_2026_07
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE parity_records_2026_08
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE parity_records_2026_09
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE parity_records_2026_10
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE parity_records_2026_11
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE parity_records_2026_12
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ─── Partition management function ───────────────────────────────────────────
-- Called monthly (via cron or manual) to pre-create the next month's partition.
-- Safe to call multiple times — uses IF NOT EXISTS equivalent via DO block.
--
-- Usage: SELECT maintain_audit_partitions();
-- Schedule: Run on the 20th of each month for the following month's partition.
--
-- OPERATIONAL RUNBOOK:
--   If this function is not called and a month's partition doesn't exist,
--   INSERTs to replay_audit_records will FAIL with:
--     "no partition of relation replay_audit_records found for row"
--   This will cause audit write failures and constitutional violations.
--   Recovery: manually create the partition, then resume.

CREATE OR REPLACE FUNCTION maintain_audit_partitions()
RETURNS TEXT AS $$
DECLARE
  next_month_start DATE;
  next_month_end   DATE;
  partition_name   TEXT;
  result_msg       TEXT := '';
  tables_to_manage TEXT[] := ARRAY['replay_audit_records', 'parity_records', 'canary_stage_history'];
  tbl TEXT;
BEGIN
  -- Create partitions for next 3 months from now
  FOR i IN 1..3 LOOP
    next_month_start := date_trunc('month', now() + (i || ' months')::interval);
    next_month_end   := next_month_start + interval '1 month';

    FOREACH tbl IN ARRAY tables_to_manage LOOP
      partition_name := tbl || '_' || to_char(next_month_start, 'YYYY_MM');

      IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = partition_name
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
          partition_name, tbl,
          next_month_start::text,
          next_month_end::text
        );
        result_msg := result_msg || 'Created: ' || partition_name || E'\n';
      ELSE
        result_msg := result_msg || 'Exists: ' || partition_name || E'\n';
      END IF;
    END LOOP;
  END LOOP;

  RETURN result_msg;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION maintain_audit_partitions() IS
  'Pre-create monthly partitions for audit/parity/canary tables. '
  'Run monthly on the 20th. Missing partitions cause INSERT failures. '
  'Schedule: SELECT maintain_audit_partitions() via cron or pg_cron extension.';

-- ─── Corpus rollback search index ─────────────────────────────────────────────
-- Enables fast lookup of rollback targets: "all deployments for group in last 7 days"
-- Non-partial index: partial indexes with now() are not allowed (now() is not IMMUTABLE)
CREATE INDEX idx_corpus_deployments_rollback_lookup
  ON corpus_deployments (deployment_group_id, deployed_at DESC, corpus_version_id);

-- ─── Schema version ───────────────────────────────────────────────────────────
INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (6, 'V6__operational_hardening.sql', 'bootstrap');
