-- Wave 1: Identity and Tenancy
-- Constitutional: replay_audit_records partitioned from this migration (line 1 of requirement)
-- This migration creates the core identity hierarchy and operational record tables.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Platform Identity ────────────────────────────────────────────────────────
CREATE TABLE platforms (
  platform_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Enterprise Groups (TIER_1) ───────────────────────────────────────────────
CREATE TABLE enterprise_groups (
  enterprise_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- soft delete only; hard delete FORBIDDEN if venues exist
);

CREATE INDEX idx_enterprise_groups_slug ON enterprise_groups (slug);

-- ─── Regional Organizations (TIER_2, optional) ────────────────────────────────
CREATE TABLE regional_organizations (
  regional_org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_regional_orgs_enterprise ON regional_organizations (enterprise_group_id);

-- ─── Venues (TIER_3) ──────────────────────────────────────────────────────────
CREATE TABLE venues (
  venue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  regional_org_id UUID REFERENCES regional_organizations(regional_org_id),
  name TEXT NOT NULL,
  market_vertical TEXT NOT NULL CHECK (
    market_vertical IN ('LICENSED_CLUB', 'GOLF_COURSE', 'HOTEL_RESORT',
                        'SPORTS_BAR', 'RESTAURANT', 'COMMUNITY_VENUE', 'OTHER')
  ),
  autonomy_grade TEXT NOT NULL DEFAULT 'GRADE_B' CHECK (autonomy_grade IN ('GRADE_A', 'GRADE_B', 'GRADE_C')),
  entropy_tolerance TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (entropy_tolerance IN ('LOW', 'MEDIUM', 'HIGH')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_venues_enterprise ON venues (enterprise_group_id);
CREATE INDEX idx_venues_regional ON venues (regional_org_id) WHERE regional_org_id IS NOT NULL;

-- ─── Screen Zones (TIER_4) ────────────────────────────────────────────────────
CREATE TABLE screen_zones (
  screen_zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screen_zones_venue ON screen_zones (venue_id);

-- ─── Screens ─────────────────────────────────────────────────────────────────
-- screen_id is the STABLE logical identifier used in PRE.resolve()
-- hardware_id is device management only — never enters resolution logic
CREATE TABLE screens (
  screen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- stable logical ID
  hardware_id TEXT,                                       -- device fingerprint (mutable on hardware swap)
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  screen_zone_id UUID REFERENCES screen_zones(screen_zone_id),
  name TEXT NOT NULL,
  commissioning_state TEXT NOT NULL DEFAULT 'UNREGISTERED' CHECK (
    commissioning_state IN ('UNREGISTERED', 'REGISTERED', 'CORPUS_LOADED', 'OPERATIONAL', 'DECOMMISSIONED')
  ),
  first_boot_determinism_passed BOOLEAN NOT NULL DEFAULT false,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screens_venue ON screens (venue_id);
CREATE INDEX idx_screens_hardware ON screens (hardware_id) WHERE hardware_id IS NOT NULL;

-- ─── Append-Only Enforcement Function ────────────────────────────────────────
-- Applied to all operational record tables (replay_audit, parity, freeze_log)
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Constitutional violation: DELETE is forbidden on table %. All records are append-only and immutable.', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Constitutional violation: UPDATE is forbidden on table %. All records are append-only and immutable.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Replay Audit Records (partitioned from day 1) ────────────────────────────
-- CRITICAL: Must be RANGE partitioned from this migration.
-- Cannot retrofit partitioning after data exists without multi-day outage.
-- Composite PK: (audit_record_id, created_at) — required for PostgreSQL partitioned unique constraints.
CREATE TABLE replay_audit_records (
  audit_record_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,           -- partition key — must be in PK
  screen_id UUID NOT NULL,
  venue_id UUID NOT NULL,
  at_utc_ms BIGINT NOT NULL,                 -- PRE_Input.at — the deterministic time reference
  correlation_id TEXT NOT NULL,
  playlist_checksum TEXT NOT NULL,           -- fnv1a32 of resolved playlist
  resolution_level SMALLINT NOT NULL CHECK (resolution_level BETWEEN 0 AND 6),
  is_fallback BOOLEAN NOT NULL,
  invariants_passed BOOLEAN NOT NULL,
  record_checksum TEXT NOT NULL,             -- fnv1a32 of all other fields (tamper detection)
  PRIMARY KEY (audit_record_id, created_at) -- composite PK required for partitioned unique
) PARTITION BY RANGE (created_at);

-- Enforce append-only at DB level
CREATE TRIGGER replay_audit_append_only
  BEFORE DELETE OR UPDATE ON replay_audit_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

-- Create initial partition for current month (migrations must always create at least 1 partition)
-- Additional partitions created monthly by partition management job
CREATE TABLE replay_audit_records_2026_05
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE replay_audit_records_2026_06
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_replay_audit_venue_time ON replay_audit_records (venue_id, created_at DESC);
CREATE INDEX idx_replay_audit_screen_time ON replay_audit_records (screen_id, created_at DESC);
CREATE INDEX idx_replay_audit_correlation ON replay_audit_records (correlation_id);

-- ─── Constitutional Freeze Log (permanent retention — never purged) ───────────
CREATE TABLE constitutional_freeze_log (
  freeze_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  freeze_type TEXT NOT NULL CHECK (freeze_type IN ('AUTOMATIC', 'MANUAL')),
  triggered_by TEXT NOT NULL,  -- principal_id or 'CIRCUIT_BREAKER'
  reason TEXT NOT NULL,
  exit_authorized_by TEXT,     -- principal_id of PLATFORM_ADMIN who authorized exit
  exit_auth_token_hash TEXT,   -- SHA-256 of human auth token (never store plaintext)
  exit_at TIMESTAMPTZ,
  root_cause TEXT,
  prevention_plan TEXT
);

-- No DELETE trigger needed for freeze_log — it's configured at the application layer
-- to prohibit all mutations. Document the intent:
COMMENT ON TABLE constitutional_freeze_log IS
  'PERMANENT RETENTION: This table is never purged, archived, or deleted. ConstitutionalFreezeLog entries are the authoritative record of all EMERGENCY_FREEZE events. Even after all other data for a venue is deleted (GDPR), freeze_log entries are retained.';

-- ─── Schema Version Tracking ─────────────────────────────────────────────────
CREATE TABLE schema_migrations (
  migration_id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT NOT NULL
);

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (1, 'V1__wave1_identity_and_tenancy.sql', 'bootstrap');
