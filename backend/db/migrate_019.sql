-- BL-048 Part 1: DB-backed layouts table with 4 system seed rows
CREATE TABLE IF NOT EXISTS layouts (
  slug         VARCHAR(60)  PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  definition   JSONB        NOT NULL,
  is_system    BOOLEAN      NOT NULL DEFAULT false,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO layouts (slug, display_name, is_system, sort_order, definition) VALUES
  ('fullscreen', 'Full Screen', true, 1,
   '{"grid_areas":"\"main\"","grid_rows":"1fr","grid_cols":"1fr","playlist_zones":["main"],"widget_slots":[]}'),
  ('split_horizontal', 'Split Horizontal', true, 2,
   '{"grid_areas":"\"main_left main_right\" \"ticker ticker\"","grid_rows":"1fr 60px","grid_cols":"1fr 1fr","playlist_zones":["main_left","main_right"],"widget_slots":[{"zone":"ticker","position":"left-fixed","width":120,"widget":"clock"},{"zone":"ticker","position":"fill","widget":"ticker_scroll","corpus_key":"ticker_items"}]}'),
  ('news_bar', 'News Bar', true, 3,
   '{"grid_areas":"\"main\" \"ticker\"","grid_rows":"1fr 60px","grid_cols":"1fr","playlist_zones":["main"],"widget_slots":[{"zone":"ticker","position":"left-fixed","width":120,"widget":"clock"},{"zone":"ticker","position":"fill","widget":"ticker_scroll","corpus_key":"ticker_items"}]}'),
  ('quad', 'Quad', true, 4,
   '{"grid_areas":"\"top_left top_right\" \"bottom_left bottom_right\"","grid_rows":"1fr 1fr","grid_cols":"1fr 1fr","playlist_zones":["top_left","top_right","bottom_left","bottom_right"],"widget_slots":[]}')
ON CONFLICT (slug) DO NOTHING;
