-- Wave 1: Content Model
-- Depends on V1 (venues, screens must exist)

-- ─── Content Assets ───────────────────────────────────────────────────────────
CREATE TABLE content_assets (
  content_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  duration_ms INTEGER,                   -- null for images
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  compliance_type TEXT CHECK (
    compliance_type IN ('RESPONSIBLE_GAMBLING', 'LIQUOR_LICENCE', 'GENERAL', NULL)
  ),
  is_compliance_asset BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,               -- soft delete only
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constitutional: content assets referenced by audit records cannot be hard-deleted
-- This constraint is enforced at the application layer (FK to audit records checked before delete)
CREATE INDEX idx_content_assets_enterprise ON content_assets (enterprise_group_id);
CREATE INDEX idx_content_assets_checksum ON content_assets (checksum_sha256);

-- ─── Campaigns ────────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  venue_id UUID REFERENCES venues(venue_id),  -- null = enterprise-wide
  name TEXT NOT NULL,
  resolution_level SMALLINT NOT NULL CHECK (resolution_level BETWEEN 2 AND 4),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED')
  ),
  has_preview_session BOOLEAN NOT NULL DEFAULT false,  -- gated: REVIEW→APPROVED requires true
  created_by TEXT NOT NULL,   -- principal_id
  approved_by TEXT,           -- principal_id
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_venue_status ON campaigns (venue_id, status);
CREATE INDEX idx_campaigns_enterprise ON campaigns (enterprise_group_id);

-- Transition guard: prevent REVIEW→APPROVED without preview session
CREATE OR REPLACE FUNCTION guard_campaign_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status = 'REVIEW' AND NOT NEW.has_preview_session THEN
    RAISE EXCEPTION 'Constitutional: Campaign cannot be APPROVED without a completed preview session. Set has_preview_session = true after completing preview.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_approval_guard
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION guard_campaign_approval();

-- ─── Schedules ────────────────────────────────────────────────────────────────
CREATE TABLE schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id),
  days_of_week INTEGER[] NOT NULL,        -- array of 0-6 (0=Sun)
  start_time_hhmm INTEGER NOT NULL,       -- 900 = 09:00
  end_time_hhmm INTEGER NOT NULL,
  valid_from_utc TIMESTAMPTZ NOT NULL,
  valid_until_utc TIMESTAMPTZ,            -- null = indefinite
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_campaign ON schedules (campaign_id);

-- ─── Overrides ────────────────────────────────────────────────────────────────
CREATE TABLE overrides (
  override_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  created_by TEXT NOT NULL,              -- principal_id
  override_type TEXT NOT NULL CHECK (
    override_type IN ('IMMEDIATE', 'SCHEDULED', 'RECURRING', 'EMERGENCY')
  ),
  resolution_level SMALLINT NOT NULL CHECK (resolution_level BETWEEN 0 AND 2),
  active_from_utc TIMESTAMPTZ NOT NULL,
  active_until_utc TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_overrides_venue_active ON overrides (venue_id, active_from_utc, active_until_utc);

-- ─── Emergency State ──────────────────────────────────────────────────────────
CREATE TABLE emergency_events (
  emergency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  triggered_by TEXT NOT NULL,           -- principal_id
  emergency_type TEXT NOT NULL CHECK (
    emergency_type IN ('VENUE_EMERGENCY', 'FLEET_EMERGENCY', 'COMPLIANCE', 'EQUIPMENT_FAILURE', 'OTHER')
  ),
  note TEXT,
  acknowledged_by TEXT,                 -- principal_id
  acknowledgment_note TEXT,
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emergency_venue_active ON emergency_events (venue_id, cleared_at) WHERE cleared_at IS NULL;

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (2, 'V2__wave1_content_model.sql', 'bootstrap');
