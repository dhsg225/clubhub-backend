BEGIN;

CREATE TABLE IF NOT EXISTS named_playlists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  ordering_rule VARCHAR(20)  NOT NULL DEFAULT 'sequential',
  -- ordering_rule: 'sequential' | 'shuffle'
  items         JSONB        NOT NULL DEFAULT '[]',
  -- items shape: [{content_id: UUID, duration_seconds: int}]
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMIT;
