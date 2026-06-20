-- migrate_016.sql
-- BL-040: card_templates registry (L2 of D-019 Three-Tier Template Governance Model)
--
-- card_templates is a catalogue of available template types.
-- system templates: tenant_id IS NULL
-- tenant-custom templates: tenant_id references tenants(id)
-- type_slug is the authoritative discriminator — must match content.template_type values.

CREATE TABLE IF NOT EXISTS card_templates (
  type_slug    VARCHAR(100) PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL,
  field_schema JSONB NOT NULL,
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system template
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed system templates (tenant_id IS NULL → available to all tenants)
INSERT INTO card_templates (type_slug, display_name, sort_order, field_schema) VALUES
  ('promo_slide',
   'Promotional Slide',
   1,
   '{"fields":[{"key":"title","label":"Title","type":"text","max_chars":60,"required":true},{"key":"subtitle","label":"Subtitle","type":"text","max_chars":120,"required":false},{"key":"background_color","label":"Background Colour","type":"color","required":false,"default":"#1a1a2e"},{"key":"text_color","label":"Text Colour","type":"color","required":false,"default":"#ffffff"}]}'
  ),
  ('event_banner',
   'Event Banner',
   2,
   '{"fields":[{"key":"event_name","label":"Event Name","type":"text","max_chars":60,"required":true},{"key":"date","label":"Date","type":"text","max_chars":30,"required":false},{"key":"time","label":"Time","type":"text","max_chars":20,"required":false},{"key":"description","label":"Description","type":"textarea","max_chars":200,"required":false}]}'
  ),
  ('sponsor_banner',
   'Sponsor Banner',
   3,
   '{"fields":[{"key":"sponsor_name","label":"Sponsor Name","type":"text","max_chars":60,"required":true},{"key":"tagline","label":"Tagline","type":"text","max_chars":120,"required":false},{"key":"tier","label":"Tier","type":"select","required":false,"options":["Platinum","Gold","Silver"]}]}'
  ),
  ('menu_board',
   'Menu Board',
   4,
   '{"fields":[{"key":"sections","label":"Menu Sections","type":"sections","required":false}]}'
  ),
  ('daily_specials',
   'Daily Specials',
   5,
   '{"fields":[{"key":"headline","label":"Headline","type":"text","max_chars":40,"required":true},{"key":"items","label":"Items","type":"items","required":false}]}'
  )
ON CONFLICT (type_slug) DO NOTHING;
