BEGIN;

-- Missing index on schedules.screen_group.
-- The manifest engine WHERE clause matches screen_group IS NOT NULL AND screen_group = $2,
-- but no index existed for this column. At 300+ screens polling every 15s, this is a
-- sequential scan on the schedules table for every manifest compute that involves a group.
-- Partial index (non-null rows only) keeps it small.
CREATE INDEX IF NOT EXISTS idx_schedules_screen_group
  ON schedules(screen_group)
  WHERE screen_group IS NOT NULL;

-- Compound index to accelerate the FIX-7 cache-bust subquery:
--   SELECT s.screen_id FROM schedules WHERE content_id = $1 AND screen_id IS NOT NULL
-- content_id index already exists (idx_schedules_content); this covering index adds
-- screen_id so Postgres can answer the subquery from the index alone (index-only scan).
CREATE INDEX IF NOT EXISTS idx_schedules_content_screen
  ON schedules(content_id, screen_id)
  WHERE screen_id IS NOT NULL;

COMMIT;
