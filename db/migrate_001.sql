BEGIN;

-- Template registry
CREATE TABLE IF NOT EXISTS templates (
  type       VARCHAR(100) PRIMARY KEY,
  version    INTEGER      NOT NULL DEFAULT 1,
  name       VARCHAR(255) NOT NULL,
  schema     JSONB        NOT NULL,
  defaults   JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO templates (type, version, name, schema, defaults) VALUES (
  'promo_slide',
  1,
  'Promo Slide',
  '{"type":"object","required":["headline"],"properties":{"headline":{"type":"string","maxLength":80},"subheadline":{"type":"string","maxLength":120},"image":{"type":"string"}}}',
  '{"subheadline":"","image":null}'
) ON CONFLICT (type) DO NOTHING;

-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id         VARCHAR(100) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  timezone   VARCHAR(100) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO venues (id, name, timezone)
VALUES ('venue-1', 'Default Venue', 'UTC')
ON CONFLICT (id) DO NOTHING;

-- Screens (backward compat: screen-1 maps to venue-1)
CREATE TABLE IF NOT EXISTS screens (
  id           VARCHAR(100) PRIMARY KEY,
  venue_id     VARCHAR(100) NOT NULL REFERENCES venues(id),
  name         VARCHAR(255),
  screen_group VARCHAR(100),
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO screens (id, venue_id, name)
VALUES ('screen-1', 'venue-1', 'Default Screen')
ON CONFLICT (id) DO NOTHING;

-- Schedules
CREATE TABLE IF NOT EXISTS schedules (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        UUID         NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  venue_id          VARCHAR(100) REFERENCES venues(id),
  screen_id         VARCHAR(100) REFERENCES screens(id),
  screen_group      VARCHAR(100),
  priority          INTEGER      NOT NULL DEFAULT 10,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  days_of_week      INTEGER[],
  time_of_day_start TIME,
  time_of_day_end   TIME,
  duration          INTEGER      NOT NULL DEFAULT 10,
  is_fallback       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_content ON schedules(content_id);
CREATE INDEX IF NOT EXISTS idx_schedules_venue   ON schedules(venue_id);
CREATE INDEX IF NOT EXISTS idx_schedules_screen  ON schedules(screen_id);

-- Manifest cache (thundering-herd guard)
CREATE TABLE IF NOT EXISTS manifest_cache (
  screen_id   VARCHAR(100) PRIMARY KEY,
  manifest    JSONB        NOT NULL,
  checksum    VARCHAR(16)  NOT NULL,
  version     INTEGER      NOT NULL DEFAULT 1,
  computed_at TIMESTAMPTZ  DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

COMMIT;
