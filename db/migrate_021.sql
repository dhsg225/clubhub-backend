-- BL-050: media_library — auto-catalogues every uploaded file for reuse
CREATE TABLE IF NOT EXISTS media_library (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  cdn_url     TEXT         NOT NULL,
  cdn_url_raw TEXT         NOT NULL,
  file_size   INTEGER,
  media_type  VARCHAR(20)  NOT NULL DEFAULT 'image',
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_library_tenant ON media_library (tenant_id, created_at DESC);
