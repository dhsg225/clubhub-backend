-- migrate_020.sql
-- Widget registry: DB-backed catalogue of available widgets for layout zones.

CREATE TABLE IF NOT EXISTS widgets (
  slug          VARCHAR(60)  PRIMARY KEY,
  display_name  VARCHAR(120) NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  config_schema JSONB        NOT NULL DEFAULT '{"fields":[]}',
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed the 3 built-in widgets
INSERT INTO widgets (slug, display_name, description, config_schema, sort_order) VALUES
  ('clock',
   'Clock',
   'Live HH:MM:SS time display. Updates every second. Timezone-aware via config.',
   '{"fields":[{"key":"timezone","label":"Timezone","type":"text","default":"Asia/Singapore","required":false,"max_chars":40}]}',
   1),
  ('date_display',
   'Date Display',
   'Shows current date (e.g. Friday 20 June). Updates at midnight. Timezone and format configurable.',
   '{"fields":[{"key":"timezone","label":"Timezone","type":"text","default":"Asia/Singapore","required":false,"max_chars":40},{"key":"format","label":"Format","type":"select","default":"DD MMM YYYY","required":false,"options":["DD MMM YYYY","DDD DD MMM","DD/MM/YYYY"]}]}',
   2),
  ('ticker_scroll',
   'Ticker Scroll',
   'Horizontally scrolling text strip. Receives text items from the ticker manager. Speed and direction configurable.',
   '{"fields":[{"key":"speed","label":"Speed (px/s)","type":"text","default":"80","required":false,"max_chars":5},{"key":"direction","label":"Direction","type":"select","default":"ltr","required":false,"options":["ltr","rtl"]}]}',
   3)
ON CONFLICT (slug) DO NOTHING;
