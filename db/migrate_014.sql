-- migrate_014: drop layout_template column if it still exists alongside screen_layout
-- Handles the case where Agent 3 added screen_layout as a new column before migrate_011
-- ran. If both exist, backfill then drop. If only layout_template exists, rename it.
-- Safe to re-run (idempotent via DO $$ checks).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'screens' AND column_name = 'layout_template'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'screens' AND column_name = 'screen_layout'
    ) THEN
      -- Both exist: backfill screen_layout from layout_template where null, then drop old column
      UPDATE screens SET screen_layout = layout_template
      WHERE screen_layout IS NULL AND layout_template IS NOT NULL;
      ALTER TABLE screens DROP COLUMN layout_template;
    ELSE
      -- Only layout_template exists: rename it (what migrate_011 intended)
      ALTER TABLE screens RENAME COLUMN layout_template TO screen_layout;
    END IF;
  END IF;
END $$;
