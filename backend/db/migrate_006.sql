-- migrate_006: add last_corpus_sync_at to screens
-- Tracks the last time the player successfully synced a corpus package.
-- Used for the 72h autonomy clock in the operator UI.
BEGIN;
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS last_corpus_sync_at TIMESTAMPTZ;
COMMIT;
