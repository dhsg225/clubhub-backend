-- BL-038: social cross-posting queue
-- Stores async cross-post jobs created when content is saved with cross_post: true.
CREATE TABLE IF NOT EXISTS social_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID        NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL DEFAULT 'facebook',
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id   UUID        NOT NULL
);

CREATE INDEX IF NOT EXISTS social_jobs_status_idx ON social_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS social_jobs_tenant_idx ON social_jobs (tenant_id);
