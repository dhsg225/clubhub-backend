-- V9 — Wave 1 Remediation Fixes
-- 2026-05-28
--
-- 1. constitutional_freeze_active view — correct abstraction for deployment gate
-- 2. player_health_snapshots new columns — chromium_alive, ntp_synced,
--    system_time_utc, last_resolution_level
-- 3. screen_re_enrollment_tokens table — hardware replacement workflow
-- 4. pg_cron audit partition maintenance — prevents December partition failure
-- 5. heartbeat response includes emergency state — reduces override lag

-- ── 1. Constitutional freeze active view ─────────────────────────────────────
-- The constitutional_freeze_log records all freeze/unfreeze events.
-- This view provides a boolean "is a freeze currently active?" for the
-- deployment gate without querying the event log directly.
--
-- A freeze is active if the latest log entry is a FREEZE with no subsequent UNFREEZE.
CREATE OR REPLACE VIEW constitutional_freeze_active AS
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM constitutional_freeze_log
      WHERE exit_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) THEN true
    ELSE false
  END AS is_frozen,
  (
    SELECT reason FROM constitutional_freeze_log
    WHERE exit_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) AS reason,
  (
    SELECT created_at FROM constitutional_freeze_log
    WHERE exit_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) AS frozen_since;

-- ── 2. player_health_snapshots new columns ────────────────────────────────────
-- Add columns for new heartbeat fields from Wave 1 remediation.
-- All nullable with safe defaults so existing heartbeat writers are unaffected.

ALTER TABLE player_health_snapshots
  ADD COLUMN IF NOT EXISTS chromium_alive        BOOLEAN,          -- null = unknown (old player versions)
  ADD COLUMN IF NOT EXISTS ntp_synced            BOOLEAN,          -- null = unknown
  ADD COLUMN IF NOT EXISTS system_time_utc       BIGINT,           -- player's reported Unix ms
  ADD COLUMN IF NOT EXISTS last_resolution_level SMALLINT,         -- 0-5 PRE level
  ADD COLUMN IF NOT EXISTS clock_drift_ms        INTEGER;          -- |system_time - server_time|

-- Index for fleet dashboard: "show all screens with Chromium dead"
CREATE INDEX IF NOT EXISTS idx_player_health_chromium
  ON player_health_snapshots (chromium_alive)
  WHERE chromium_alive = false;

-- Index for "show all screens with NTP desync"
CREATE INDEX IF NOT EXISTS idx_player_health_ntp
  ON player_health_snapshots (ntp_synced)
  WHERE ntp_synced = false;

-- Index for "show all screens serving fallback content"
CREATE INDEX IF NOT EXISTS idx_player_health_resolution_level
  ON player_health_snapshots (last_resolution_level);

-- ── 3. Screen re-enrollment tokens ───────────────────────────────────────────
-- Hardware replacement: operator issues a replacement token for an existing screen_id.
-- The replacement Pi uses the same enrollment flow but presents this token.
-- CMS validates token, updates hardware_id, preserves all screen history.

CREATE TABLE IF NOT EXISTS screen_re_enrollment_tokens (
  token_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id         UUID NOT NULL REFERENCES screens(screen_id),
  token             TEXT NOT NULL UNIQUE,          -- single-use enrollment token
  issued_by         TEXT NOT NULL,                 -- operator who issued it
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '48 hours',
  used_at           TIMESTAMPTZ,                   -- null = not yet used
  used_by_hardware  TEXT,                          -- hardware_id that consumed token
  reason            TEXT NOT NULL                  -- e.g. "Pi hardware failure", "theft replacement"
);

-- Only one active (unused, unexpired) re-enrollment token per screen at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_re_enrollment_active_screen
  ON screen_re_enrollment_tokens (screen_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE screen_re_enrollment_tokens IS
  'Single-use tokens for replacing Pi hardware while preserving screen_id and audit history';

-- ── 4. Audit partition maintenance automation ─────────────────────────────────
-- Ensure the next 3 months of replay_audit_records partitions always exist.
-- Called by: pg_cron (monthly), API preflight endpoint, manual operator.
--
-- This extends the existing maintain_audit_partitions() function from V6
-- to create partitions up to 3 months in advance (was 1 month).

CREATE OR REPLACE FUNCTION maintain_audit_partitions_extended()
RETURNS void AS $$
DECLARE
  target_month DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Create partitions for current month + next 3 months
  FOR i IN 0..3 LOOP
    target_month := date_trunc('month', now()) + (i || ' months')::INTERVAL;
    partition_name := 'replay_audit_records_' || to_char(target_month, 'YYYY_MM');
    start_date := target_month;
    end_date := target_month + INTERVAL '1 month';

    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF replay_audit_records
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
      RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run immediately to ensure next 3 months exist right now
SELECT maintain_audit_partitions_extended();

-- ── 5. pg_cron monthly partition maintenance ──────────────────────────────────
-- Requires pg_cron extension. On managed databases (RDS, Supabase, Neon),
-- pg_cron is usually available. On bare Postgres, install separately.
-- If pg_cron is unavailable, the API preflight and the manual function above
-- serve as fallback.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule on 1st of each month at 02:00 UTC
    PERFORM cron.schedule(
      'clubhub-audit-partition-maintenance',
      '0 2 1 * *',
      'SELECT maintain_audit_partitions_extended()'
    );
    RAISE NOTICE 'pg_cron job scheduled for monthly partition maintenance';
  ELSE
    RAISE NOTICE 'pg_cron not available — manual partition maintenance required monthly';
    RAISE NOTICE 'Run: SELECT maintain_audit_partitions_extended() monthly';
    RAISE NOTICE 'Or add an application-level cron to call POST /api/v2/admin/maintain-partitions';
  END IF;
END;
$$;

-- ── 6. Emergency state on heartbeat response ──────────────────────────────────
-- Store the active emergency state per screen so heartbeat response can
-- include it — reduces emergency override propagation from 60s to 30s.
-- The player checks the heartbeat response, not just the corpus poll.

CREATE TABLE IF NOT EXISTS screen_emergency_state (
  screen_id         UUID PRIMARY KEY REFERENCES screens(screen_id),
  is_frozen         BOOLEAN NOT NULL DEFAULT false,
  frozen_by         TEXT,
  frozen_at         TIMESTAMPTZ,
  reason            TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE screen_emergency_state IS
  'Per-screen emergency freeze state. Returned in heartbeat response to '
  'reduce emergency propagation lag from 60s (corpus poll) to 30s (heartbeat).';

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (9, 'V9__remediation_fixes.sql', 'bootstrap');
