-- migrate_013.sql
-- Multi-tenancy: tenants master table + tenant_id columns + backfill (BL-034 / D-018)
BEGIN;

-- Master tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(50)  UNIQUE NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed default tenant (idempotent)
INSERT INTO tenants (name, slug)
VALUES ('ClubHub Default', 'default')
ON CONFLICT DO NOTHING;

-- Add tenant_id to every entity table
ALTER TABLE venues          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE screens         ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE content         ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE named_playlists ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE schedules       ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE ticker_items    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill all existing rows to the default tenant
UPDATE venues          SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE screens         SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE content         SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE named_playlists SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE schedules       SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE ticker_items    SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;

-- Indexes for query performance (D-018)
CREATE INDEX IF NOT EXISTS idx_venues_tenant          ON venues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_screens_tenant         ON screens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_tenant         ON content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playlists_tenant       ON named_playlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant       ON schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticker_items_tenant    ON ticker_items(tenant_id);

COMMIT;
