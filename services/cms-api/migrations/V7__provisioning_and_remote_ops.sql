-- V7: Player Provisioning + Remote Operations
--
-- Adds:
--   1. enrollment_tokens     — single-use tokens for first-boot player registration
--   2. remote_commands       — queue for remote player actions (reboot, diagnostics, etc.)
--   3. maintenance_mode      — per-screen maintenance flags (suppress alerts, exclude bulk ops)
--   4. venue_timeline_events — append-only log of every significant change per venue
--   5. operator_locks        — soft-lock for concurrent edit detection
--
-- Design principles:
--   - Enrollment tokens are one-time use. Cannot be reused after claim.
--   - Remote commands are append-only. Cancellation = new CANCELLED row.
--   - Maintenance mode is a mutable flag (not append-only) — operational state.
--   - Venue timeline is append-only — drives "what changed?" operator view.
--   - All tables have tenant isolation via enterprise_group_id or venue_id FK.

-- ─── Enrollment Tokens ────────────────────────────────────────────────────────
-- Created by operator via API. Claimed by player on first boot.
-- One token = one screen. Token expires after 48h or on claim, whichever first.
-- Hardware fingerprint recorded on claim for tamper detection.
CREATE TABLE enrollment_tokens (
  token_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  venue_id          UUID NOT NULL REFERENCES venues(venue_id),
  token_hash        TEXT NOT NULL UNIQUE,  -- SHA-256 of the cleartext token
  screen_name       TEXT NOT NULL,         -- pre-assigned human name (e.g. "Bar Screen 1")
  intended_zone_id  UUID REFERENCES screen_zones(screen_zone_id),
  created_by        TEXT NOT NULL,         -- principal_id
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + interval '48 hours',
  claimed_at        TIMESTAMPTZ,           -- set on successful enrollment
  claimed_by_hardware_id TEXT,            -- hardware fingerprint at claim time
  claimed_screen_id UUID REFERENCES screens(screen_id),  -- set after screen record created
  is_claimed        BOOLEAN GENERATED ALWAYS AS (claimed_at IS NOT NULL) STORED
);

CREATE INDEX idx_enrollment_tokens_venue ON enrollment_tokens (venue_id, created_at DESC);
CREATE INDEX idx_enrollment_tokens_unclaimed ON enrollment_tokens (venue_id)
  WHERE claimed_at IS NULL;

COMMENT ON TABLE enrollment_tokens IS
  'One-time tokens for Pi first-boot enrollment. A token can only be claimed once. '
  'Token text is never stored — only its SHA-256 hash. After claim, claimed_screen_id '
  'points to the created screen record.';

-- ─── Remote Commands ──────────────────────────────────────────────────────────
-- Operator issues a command → player polls and executes → player reports result.
-- Commands are append-only. Cancel = insert CANCELLED row.
-- Player processes at most one command per poll cycle (ordered by created_at).
CREATE TABLE remote_commands (
  command_id        UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  screen_id         UUID NOT NULL REFERENCES screens(screen_id),
  venue_id          UUID NOT NULL REFERENCES venues(venue_id),
  issued_by         TEXT NOT NULL,         -- principal_id
  command_type      TEXT NOT NULL CHECK (command_type IN (
    'RESTART_PLAYER',    -- restart player-runtime process (PM2 restart)
    'REBOOT_DEVICE',     -- full system reboot (sudo reboot)
    'COLLECT_DIAGNOSTICS', -- generate diagnostics bundle, upload
    'CLEAR_CORPUS_CACHE',  -- delete corpus files, force fresh sync on restart
    'SYNC_NOW',          -- trigger immediate corpus sync (no restart)
    'CANCEL'             -- cancels a pending command
  )),
  target_command_id UUID,               -- set for CANCEL type
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACKNOWLEDGED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
  )),
  payload           JSONB,              -- optional command parameters
  result            JSONB,              -- set by player on completion
  acknowledged_at   TIMESTAMPTZ,        -- when player first saw the command
  completed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (command_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TRIGGER remote_commands_append_only
  BEFORE DELETE OR UPDATE ON remote_commands
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TABLE remote_commands_2026_05
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE remote_commands_2026_06
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE remote_commands_2026_07
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE remote_commands_2026_08
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE remote_commands_2026_09
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE remote_commands_2026_10
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE remote_commands_2026_11
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE remote_commands_2026_12
  PARTITION OF remote_commands
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX idx_remote_commands_screen_pending
  ON remote_commands (screen_id, created_at ASC)
  WHERE status = 'PENDING';

-- ─── Maintenance Mode ─────────────────────────────────────────────────────────
-- Per-screen flag. When set: health alerts suppressed, bulk ops excluded.
-- Mutable — not append-only. Timeline event written on toggle.
CREATE TABLE maintenance_mode (
  screen_id         UUID PRIMARY KEY REFERENCES screens(screen_id),
  is_active         BOOLEAN NOT NULL DEFAULT false,
  reason            TEXT,
  activated_by      TEXT,             -- principal_id
  activated_at      TIMESTAMPTZ,
  expected_end_at   TIMESTAMPTZ,      -- advisory — not enforced
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE maintenance_mode IS
  'Per-screen maintenance flag. When active: fleet health alerts are suppressed '
  'for this screen, and it is excluded from bulk fleet operations (restart-all, etc.). '
  'Every activation/deactivation is logged in venue_timeline_events.';

-- ─── Venue Timeline Events ────────────────────────────────────────────────────
-- Append-only log of significant operational events per venue.
-- Powers the "what changed?" operator view and incident investigation.
-- Also used for shift handover context.
CREATE TABLE venue_timeline_events (
  event_id          UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  venue_id          UUID NOT NULL REFERENCES venues(venue_id),
  screen_id         UUID REFERENCES screens(screen_id),  -- null = venue-level event
  event_type        TEXT NOT NULL CHECK (event_type IN (
    'PLAYER_ENROLLED',       -- new device registered
    'PLAYER_ONLINE',         -- first heartbeat after offline
    'PLAYER_OFFLINE',        -- missed heartbeat threshold crossed
    'CORPUS_DEPLOYED',       -- new corpus version pushed
    'CORPUS_ROLLBACK',       -- rollback executed
    'MAINTENANCE_START',     -- maintenance mode activated
    'MAINTENANCE_END',       -- maintenance mode deactivated
    'REMOTE_COMMAND_ISSUED', -- operator issued remote command
    'REMOTE_COMMAND_COMPLETED',
    'EMERGENCY_OVERRIDE',    -- LEVEL_0 override triggered
    'HEALTH_WARNING',        -- watchdog/health warning first fired
    'HEALTH_RECOVERED',      -- warning cleared
    'ASSET_APPROVED',        -- asset approved for use
    'DEPLOYMENT_APPROVED',   -- deployment approved
    'INCIDENT_OPENED',       -- support incident opened
    'INCIDENT_CLOSED',
    'OPERATOR_ACTION'        -- generic operator UI action
  )),
  actor_id          TEXT,             -- principal_id who caused event (null = system)
  title             TEXT NOT NULL,    -- human-readable one-liner (shown in timeline)
  detail            JSONB,            -- structured context (corpus_version_id, etc.)
  PRIMARY KEY (event_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TRIGGER venue_timeline_append_only
  BEFORE DELETE OR UPDATE ON venue_timeline_events
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TABLE venue_timeline_events_2026_05
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE venue_timeline_events_2026_06
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE venue_timeline_events_2026_07
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE venue_timeline_events_2026_08
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE venue_timeline_events_2026_09
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE venue_timeline_events_2026_10
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE venue_timeline_events_2026_11
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE venue_timeline_events_2026_12
  PARTITION OF venue_timeline_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX idx_venue_timeline_venue
  ON venue_timeline_events (venue_id, created_at DESC);
CREATE INDEX idx_venue_timeline_screen
  ON venue_timeline_events (screen_id, created_at DESC)
  WHERE screen_id IS NOT NULL;

-- ─── Operator Locks (soft lock for concurrent edit detection) ─────────────────
-- Prevents two operators editing the same schedule/campaign simultaneously.
-- Not a hard lock — it's a signal. UI shows "Operator B has this open."
-- Locks expire automatically after 5 minutes of inactivity.
CREATE TABLE operator_locks (
  lock_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type     TEXT NOT NULL CHECK (resource_type IN (
    'CAMPAIGN', 'SCHEDULE', 'VENUE_CONFIG', 'CORPUS_DEPLOYMENT'
  )),
  resource_id       UUID NOT NULL,
  operator_id       TEXT NOT NULL,       -- principal_id
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes',
  heartbeat_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_locks_resource ON operator_locks (resource_type, resource_id, expires_at DESC);

COMMENT ON TABLE operator_locks IS
  'Soft lock for concurrent operator edit detection. Expiry = 5min from last heartbeat. '
  'Client must call PATCH /api/v2/locks/:id/heartbeat every 60s while editing. '
  'UI shows warning when another operator holds the lock but does NOT block saves. '
  'This prevents silent overwrites, not deliberate conflicts.';

-- ─── Schema version ───────────────────────────────────────────────────────────
INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (7, 'V7__provisioning_and_remote_ops.sql', 'bootstrap');
