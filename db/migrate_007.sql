BEGIN;
ALTER TABLE content ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_content_expires_at ON content (expires_at) WHERE expires_at IS NOT NULL;
-- Backfill: extract expires_at from data JSONB for rows that have it there
UPDATE content SET expires_at = (data->>'expires_at')::TIMESTAMPTZ WHERE data ? 'expires_at' AND expires_at IS NULL;
COMMIT;
