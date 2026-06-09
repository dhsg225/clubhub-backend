-- Wave 1: Schema gap patches
-- Adds fields required by PRE's SystemStateSnapshot that were missing from V2

-- ─── Extend schedules for PRE compatibility ───────────────────────────────────
ALTER TABLE schedules
  ADD COLUMN target_type TEXT NOT NULL DEFAULT 'venue' CHECK (
    target_type IN ('screen', 'tv_group', 'area', 'venue')
  ),
  ADD COLUMN target_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN specificity INTEGER NOT NULL DEFAULT 1 CHECK (specificity BETWEEN 1 AND 4),
  ADD COLUMN is_operational BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_fallback BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

-- Existing schedules link to campaign — make target_id default to venue of campaign
-- (post-insert, applications must set target_type/target_id correctly)

CREATE INDEX idx_schedules_target ON schedules (target_type, target_id);

-- ─── Sponsorship Contracts ────────────────────────────────────────────────────
-- Constitutional: Sponsor content ALWAYS at L4 — not configurable, not purchasable
-- SOV_MAX_EFFECTIVE = 0.9999 (enforced in PRE, not here)
CREATE TABLE sponsorship_contracts (
  sponsorship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  area_id UUID REFERENCES screen_zones(screen_zone_id),  -- null = venue-wide
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  content_asset_id UUID NOT NULL REFERENCES content_assets(content_asset_id),
  sov_pct NUMERIC(6,4) NOT NULL CHECK (sov_pct > 0 AND sov_pct <= 1),  -- share-of-voice [0,1]
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,   -- null = perpetual
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsorship_contracts_venue ON sponsorship_contracts (venue_id, is_active);
CREATE INDEX idx_sponsorship_contracts_area ON sponsorship_contracts (area_id) WHERE area_id IS NOT NULL;

-- ─── Content Campaign Items ────────────────────────────────────────────────────
-- Links campaigns to their content assets
CREATE TABLE campaign_items (
  campaign_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id),
  content_asset_id UUID NOT NULL REFERENCES content_assets(content_asset_id),
  weight NUMERIC(6,4) NOT NULL DEFAULT 1.0,  -- relative weight in playlist
  position INTEGER,  -- explicit ordering (null = weight-based)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_items_campaign ON campaign_items (campaign_id);

-- ─── Screen Delivery Log (for last_delivery in SystemStateSnapshot) ──────────
-- Tracks what was last delivered to each screen (for confidence scoring in L6)
CREATE TABLE screen_delivery_log (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES screens(screen_id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  playlist_checksum TEXT NOT NULL,
  resolution_level SMALLINT NOT NULL CHECK (resolution_level BETWEEN 0 AND 6),
  corpus_version_id UUID REFERENCES corpus_versions(corpus_version_id)
);

CREATE INDEX idx_screen_delivery_screen ON screen_delivery_log (screen_id, delivered_at DESC);

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (5, 'V5__wave1_schema_gaps.sql', 'bootstrap');
