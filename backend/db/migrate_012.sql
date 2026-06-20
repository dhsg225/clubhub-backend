-- migrate_012.sql
-- Ticker items table for operator-authored scrolling text (BL-033)
BEGIN;

CREATE TABLE IF NOT EXISTS ticker_items (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id     VARCHAR(64)  REFERENCES screens(id) ON DELETE CASCADE,
  text          VARCHAR(280) NOT NULL,
  display_order INTEGER      DEFAULT 0,
  active        BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticker_items_screen_id ON ticker_items(screen_id);
CREATE INDEX IF NOT EXISTS idx_ticker_items_active     ON ticker_items(screen_id, active, display_order);

COMMIT;
