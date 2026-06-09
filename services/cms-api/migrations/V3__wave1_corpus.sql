-- Wave 1: Corpus Management
-- Depends on V1 (venues, screens), V2 (content assets)

-- ─── Corpus Versions ─────────────────────────────────────────────────────────
-- Constitutional: corpus versions can NEVER be deleted while any replay_audit_record references them
CREATE TABLE corpus_versions (
  corpus_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  version TEXT NOT NULL,
  checksum TEXT NOT NULL,               -- fnv1a32 of serialized corpus JSON
  signature TEXT,                       -- set by corpus-publisher
  published_by TEXT NOT NULL,           -- principal_id
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_authoritative BOOLEAN NOT NULL DEFAULT false  -- true when AUTHORITATIVE canary stage
);

COMMENT ON TABLE corpus_versions IS
  'DELETION FORBIDDEN: Corpus versions cannot be deleted while any replay_audit_record references them. The corpus version is the key to replaying any historical PRE decision.';

CREATE INDEX idx_corpus_versions_venue ON corpus_versions (venue_id, published_at DESC);
CREATE UNIQUE INDEX idx_corpus_versions_venue_version ON corpus_versions (venue_id, version);

-- ─── Deployment Groups ────────────────────────────────────────────────────────
CREATE TABLE deployment_groups (
  deployment_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deployment_group_screens (
  deployment_group_id UUID NOT NULL REFERENCES deployment_groups(deployment_group_id),
  screen_id UUID NOT NULL REFERENCES screens(screen_id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deployment_group_id, screen_id)
);

-- ─── Corpus Deployments ───────────────────────────────────────────────────────
CREATE TABLE corpus_deployments (
  corpus_deployment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_version_id UUID NOT NULL REFERENCES corpus_versions(corpus_version_id),
  deployment_group_id UUID NOT NULL REFERENCES deployment_groups(deployment_group_id),
  deployed_by TEXT NOT NULL,            -- principal_id
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canary_stage TEXT NOT NULL DEFAULT 'SHADOW_ONLY' CHECK (
    canary_stage IN ('SHADOW_ONLY', 'INTERNAL_CANARY', 'SINGLE_VENUE', 'MULTI_VENUE', 'FLEET_WIDE', 'AUTHORITATIVE')
  )
);

-- Append-only: corpus deployments are never rolled back via deletion
-- Rollback = new deployment with previous corpus version
CREATE TRIGGER corpus_deployment_append_only
  BEFORE DELETE OR UPDATE ON corpus_deployments
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_corpus_deployments_group ON corpus_deployments (deployment_group_id, deployed_at DESC);

-- ─── Parity Records (shadow-service — append-only) ───────────────────────────
CREATE TABLE parity_records (
  parity_record_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  invocation_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  legacy_hash TEXT NOT NULL,
  pre_hash TEXT NOT NULL,
  divergence_class SMALLINT CHECK (divergence_class BETWEEN 0 AND 4),
  deterministic_checksum TEXT NOT NULL,
  PRIMARY KEY (parity_record_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TRIGGER parity_records_append_only
  BEFORE DELETE OR UPDATE ON parity_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TABLE parity_records_2026_05
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE parity_records_2026_06
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ─── Entropy Reports ─────────────────────────────────────────────────────────
CREATE TABLE entropy_reports (
  entropy_report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL CHECK (severity IN ('ADVISORY', 'WARNING', 'CRITICAL', 'NONE')),
  affected_screen_ids UUID[] NOT NULL DEFAULT '{}',
  missing_asset_ids TEXT[] NOT NULL DEFAULT '{}',
  checksum_mismatches INTEGER NOT NULL DEFAULT 0,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT
);

CREATE INDEX idx_entropy_reports_venue ON entropy_reports (venue_id, scanned_at DESC);
CREATE INDEX idx_entropy_reports_unresolved ON entropy_reports (venue_id, severity)
  WHERE acknowledged_at IS NULL AND severity != 'NONE';

INSERT INTO schema_migrations (migration_id, filename, checksum)
VALUES (3, 'V3__wave1_corpus.sql', 'bootstrap');
