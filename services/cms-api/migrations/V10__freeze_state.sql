-- V10 — Freeze State: Postgres-authoritative recovery fallback
-- 2026-05-28
--
-- Problem this solves:
--   Redis/WebSocket are the fast path for freeze delivery. If Redis is
--   unavailable when an emergency freeze is issued, the command is lost.
--   Players that miss the WebSocket event have no way to recover freeze state.
--
-- Solution:
--   freeze_state is the authoritative record. Redis/WebSocket remain the fast
--   delivery path. Players call GET /freeze-status on reconnect/disconnect to
--   recover ground truth.
--
-- Invariant enforced by DB:
--   Exactly one row per tenant has is_current = TRUE at any time.
--   The partial unique index makes this a constraint, not a convention.

BEGIN;

CREATE TABLE IF NOT EXISTS freeze_state (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   UUID         NOT NULL,
  state       TEXT         NOT NULL CHECK (state IN ('ACTIVE', 'FROZEN')),
  reason      TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  is_current  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Lookup index: find current state for a tenant fast
CREATE INDEX IF NOT EXISTS idx_freeze_state_tenant_current
  ON freeze_state (tenant_id, is_current);

-- Correctness constraint: only one current row per tenant.
-- Any concurrent insert that would create a second is_current=TRUE row
-- for the same tenant will fail with a unique violation.
-- The transactional write (UPDATE → INSERT) makes this safe.
CREATE UNIQUE INDEX freeze_state_one_current
  ON freeze_state (tenant_id)
  WHERE is_current = TRUE;

COMMIT;

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (10, 'V10__freeze_state.sql', 'bootstrap');
