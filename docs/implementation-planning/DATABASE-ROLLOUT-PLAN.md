# DATABASE-ROLLOUT-PLAN.md

**Status:** Engineering-Ready
**Authority:** Implementation planning document. Decisions here bind database engineers.
**Last updated:** 2026-05-26
**Depends on:** CLUBHUB_SYSTEM_CONTRACTS.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7

---

## 1. Technology Decisions

### 1.1 Primary Database: PostgreSQL 15+

**Rationale:**

- **JSONB for corpus packages:** PRE input corpus contains SystemStateSnapshot (nested screen/venue/org/overrides/schedules/campaigns/sponsorships). JSONB stores this naturally, supports GIN indexes for selective field queries, and allows corpus metadata to be queryable without deserializing the full blob in application code.
- **Row-level security (RLS):** PostgreSQL's RLS is the only realistic way to enforce the 5-tier tenant isolation requirement at the database layer rather than relying on application WHERE clauses. A bug in application code must not leak cross-tenant data.
- **Append-only enforcement via triggers:** PostgreSQL allows BEFORE DELETE and BEFORE UPDATE triggers that unconditionally RAISE EXCEPTION. This makes the append-only guarantee on `replay_audit_records`, `parity_records`, and `constitutional_freeze_log` a database-level invariant, not an application-level convention.
- **Declarative partitioning (PG 10+):** RANGE partitioning on `created_at` lets us detach and archive old monthly partitions with a single DDL statement (`ALTER TABLE ... DETACH PARTITION`) rather than DELETE operations. No data movement, no lock escalation on the live table.
- **ULID primary keys:** Lexicographic sortability by creation time with near-UUID collision resistance. Better index locality than random UUIDs (sequential inserts cluster in the B-tree). See §2 for per-table key strategy.

### 1.2 Redis

Used for:
- **Session tokens:** Short TTL (e.g. 24h with sliding expiry). Never persisted to PostgreSQL unless an operator action requires a durable session audit trail.
- **Emergency channel pub/sub:** Level 0 emergency activation must reach all connected screen clients within seconds. Redis pub/sub is the correct delivery primitive. PostgreSQL LISTEN/NOTIFY has per-connection limits and unreliable fan-out under load.
- **Player heartbeat tracking:** Screens send heartbeats every 30 seconds. Storing 2,160 heartbeats/screen/day in PostgreSQL for transient "is this screen alive?" logic is wasteful. Redis sorted sets (screen_id → last_seen_epoch) enable O(log N) TTL-based liveness checks.
- **PRE resolve cache:** Cache the most recent PRE output per screen_id with a 35-second TTL (slightly longer than the 30-second resolve interval). Prevents redundant full resolves when corpus has not changed.

Redis persistence mode: **AOF with fsync=everysec** for the emergency channel state. Pure in-memory (no persistence) for heartbeat and session tracking — these are reconstructible from screen reconnection.

### 1.3 Object Storage (S3-compatible)

- **Warm tier:** S3 Standard. Detached PostgreSQL partitions exported via `pg_dump --format=custom`, gzipped. Queryable via AWS Athena or restored to a temporary RDS instance for legal/regulatory requests.
- **Cold tier:** S3 Glacier Instant Retrieval for 1–3 year range; S3 Glacier Deep Archive for 3–7 year range.
- **Corpus binary packages:** S3 Standard with CloudFront CDN. Long TTL (365 days) because corpus_version_id is immutable once written. CDN cache-busting handled by version_id in URL path.

---

## 2. Migration Ordering and Table Specifications

Migration tooling: **Flyway** (Java-based, CLI-compatible, versioned migration files, supports PostgreSQL-specific DDL including RLS and partitioning).

File naming convention:
```
V{YYYYMMDD}_{sequence}__{description}.sql
```
Example: `V20260601_001__create_platforms.sql`

Rational: date prefix enables tracing a migration to the sprint that created it. Sequence disambiguates same-day migrations. Double underscore separates version from description (Flyway convention).

---

### Wave 1 — Identity and Tenancy (no foreign keys)

These tables are created first because every other table eventually references them. No RLS is needed on the root identity tables themselves — they are managed by PLATFORM_ADMIN only.

---

#### Table 1: `platforms`

Single-row table representing this ClubHub installation.

```sql
CREATE TABLE platforms (
  platform_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  config_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Enforce single-row constraint
  CONSTRAINT platforms_single_row CHECK (platform_id IS NOT NULL)
);
-- Prevent more than one row
CREATE UNIQUE INDEX platforms_singleton ON platforms ((true));
```

- **Primary key:** UUID (random). Single row — key locality is irrelevant.
- **Indexes:** None beyond PK.
- **RLS:** Disabled. PLATFORM_ADMIN only.
- **Delete policy:** FORBIDDEN. Drop and recreate only during provisioning.
- **Partition:** None.

---

#### Table 2: `enterprise_groups`

TIER_1 organizations. Typically managed by PLATFORM_ADMIN.

```sql
CREATE TABLE enterprise_groups (
  enterprise_group_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id          UUID NOT NULL REFERENCES platforms(platform_id),
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,  -- URL-safe identifier
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,           -- soft-delete
  config_json          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX enterprise_groups_platform ON enterprise_groups(platform_id);
CREATE INDEX enterprise_groups_active ON enterprise_groups(platform_id) WHERE deleted_at IS NULL;
```

- **Primary key:** UUID.
- **Indexes:** `platform_id`, partial index on active records.
- **RLS:** Disabled. Global table — PLATFORM_ADMIN manages.
- **Delete policy:** SOFT-DELETE only (`deleted_at`). HARD-DELETE FORBIDDEN if any venue or audit record references this enterprise.

---

#### Table 3: `regional_organizations`

TIER_2 — optional grouping between enterprise and venue. Nullable parent (some enterprises do not use regional grouping).

```sql
CREATE TABLE regional_organizations (
  regional_org_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  parent_regional_org_id UUID REFERENCES regional_organizations(regional_org_id),
  name                 TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX regional_orgs_enterprise ON regional_organizations(enterprise_group_id);
```

- **Primary key:** UUID.
- **Delete policy:** SOFT-DELETE only.

---

#### Table 4: `venues`

TIER_3. The primary operational scope for most queries.

```sql
CREATE TABLE venues (
  venue_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  regional_org_id      UUID REFERENCES regional_organizations(regional_org_id),
  name                 TEXT NOT NULL,
  timezone             TEXT NOT NULL,  -- IANA identifier, validated on insert
  country_code         CHAR(2) NOT NULL,  -- ISO 3166-1 alpha-2
  gdpr_region          BOOLEAN NOT NULL DEFAULT false,  -- EU data residency flag
  compliance_tier      TEXT NOT NULL DEFAULT 'STANDARD'
                         CHECK (compliance_tier IN ('STANDARD','LICENSED_ALCOHOL','LICENSED_GAMING')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  metadata_json        JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY venues_enterprise_isolation ON venues
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX venues_enterprise ON venues(enterprise_group_id) WHERE deleted_at IS NULL;
CREATE INDEX venues_compliance ON venues(compliance_tier, enterprise_group_id);
```

- **Primary key:** UUID.
- **RLS:** enterprise_group_id isolation.
- **Delete policy:** SOFT-DELETE only. HARD-DELETE FORBIDDEN if any `replay_audit_records` row references this `venue_id`.
- **compliance_tier:** Drives retention policy enforcement. LICENSED_GAMING = 7-year audit retention.

---

#### Table 5: `screen_zones`

TIER_4 — equivalent to `area` in current PRE types (maps to `AreaRecord.id`).

```sql
CREATE TABLE screen_zones (
  screen_zone_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             UUID NOT NULL REFERENCES venues(venue_id),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name                 TEXT NOT NULL,
  zone_type            TEXT,  -- e.g. 'bar', 'gaming_floor', 'entrance'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE screen_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY screen_zones_enterprise_isolation ON screen_zones
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX screen_zones_venue ON screen_zones(venue_id) WHERE deleted_at IS NULL;
```

- **Delete policy:** SOFT-DELETE only. HARD-DELETE FORBIDDEN if screens reference this zone.

---

#### Table 6: `screens`

Leaf of the tenancy hierarchy. Maps to `ScreenRecord` in PRE types.

```sql
CREATE TABLE screens (
  screen_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_zone_id       UUID REFERENCES screen_zones(screen_zone_id),
  venue_id             UUID NOT NULL REFERENCES venues(venue_id),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive','maintenance')),
  last_seen_at         TIMESTAMPTZ,
  last_checksum        TEXT,  -- FNV-1a 32-bit hex
  hardware_id          TEXT,  -- physical device identifier
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY screens_enterprise_isolation ON screens
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX screens_venue ON screens(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX screens_status ON screens(enterprise_group_id, status) WHERE deleted_at IS NULL;
```

- **Delete policy:** SOFT-DELETE only. HARD-DELETE FORBIDDEN if any `replay_audit_records` references this `screen_id`.
- **Note:** `last_seen_at` and `last_checksum` are also tracked in Redis (heartbeat store). PostgreSQL stores the durable record; Redis stores the live state.

---

### Wave 2 — Identity and Access

---

#### Table 7: `principals`

Users and service accounts.

```sql
CREATE TABLE principals (
  principal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID REFERENCES enterprise_groups(enterprise_group_id),  -- null = PLATFORM_ADMIN
  principal_type       TEXT NOT NULL CHECK (principal_type IN ('USER','SERVICE_ACCOUNT')),
  email                TEXT,  -- nullable; anonymizable for GDPR
  display_name         TEXT,  -- nullable; anonymizable for GDPR
  gdpr_anonymized_at   TIMESTAMPTZ,  -- set when personal data erased
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE principals ENABLE ROW LEVEL SECURITY;

CREATE POLICY principals_self_or_enterprise ON principals
  USING (
    principal_id = current_setting('app.current_principal_id', true)::uuid
    OR enterprise_group_id = current_setting('app.current_enterprise_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE INDEX principals_enterprise ON principals(enterprise_group_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX principals_email ON principals(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
```

- **Delete policy:** SOFT-DELETE only. HARD-DELETE FORBIDDEN if principal_id appears in any audit record. GDPR erasure: zero `email` and `display_name`, set `gdpr_anonymized_at`. The `principal_id` UUID is retained as an opaque reference in audit records.

---

#### Table 8: `role_assignments`

Maps principals to roles within a scope.

```sql
CREATE TABLE role_assignments (
  role_assignment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id         UUID NOT NULL REFERENCES principals(principal_id),
  role_type            TEXT NOT NULL,
  -- Exactly one scope FK must be non-null
  enterprise_group_id  UUID REFERENCES enterprise_groups(enterprise_group_id),
  regional_org_id      UUID REFERENCES regional_organizations(regional_org_id),
  venue_id             UUID REFERENCES venues(venue_id),
  screen_id            UUID REFERENCES screens(screen_id),
  granted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by           UUID REFERENCES principals(principal_id),
  revoked_at           TIMESTAMPTZ,
  CONSTRAINT role_assignments_single_scope CHECK (
    (enterprise_group_id IS NOT NULL)::int +
    (regional_org_id IS NOT NULL)::int +
    (venue_id IS NOT NULL)::int +
    (screen_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX role_assignments_principal ON role_assignments(principal_id) WHERE revoked_at IS NULL;
CREATE INDEX role_assignments_enterprise ON role_assignments(enterprise_group_id) WHERE revoked_at IS NULL;
```

- **Delete policy:** SOFT-DELETE via `revoked_at`. HARD-DELETE FORBIDDEN (role grants are an audit trail).

---

#### Table 9: `sessions`

Short-lived session records. Prefer Redis; this table is the durable fallback for compliance contexts requiring session audit trails.

```sql
CREATE TABLE sessions (
  session_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id         UUID NOT NULL REFERENCES principals(principal_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,
  revoked_at           TIMESTAMPTZ,
  ip_address           INET,
  user_agent           TEXT
);

CREATE INDEX sessions_principal ON sessions(principal_id, created_at DESC);
CREATE INDEX sessions_expiry ON sessions(expires_at) WHERE revoked_at IS NULL;
```

- **Delete policy:** Expired sessions older than 90 days can be hard-deleted (no compliance value). Active sessions: SOFT-DELETE via `revoked_at`.

---

### Wave 3 — Content Model

---

#### Table 10: `content_assets`

Media files with content-addressable checksums.

```sql
CREATE TABLE content_assets (
  content_asset_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name                 TEXT NOT NULL,
  asset_type           TEXT NOT NULL,  -- 'video', 'image', 'audio', etc.
  duration_ms          INTEGER,
  checksum_sha256      TEXT NOT NULL,  -- content-addressable identity
  storage_uri          TEXT NOT NULL,  -- S3 URI
  cdn_url              TEXT,
  compliance_class     TEXT NOT NULL DEFAULT 'STANDARD'
                         CHECK (compliance_class IN ('STANDARD','LICENSED')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_assets_enterprise ON content_assets
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX content_assets_enterprise_active ON content_assets(enterprise_group_id) WHERE deleted_at IS NULL AND is_active = true;
CREATE UNIQUE INDEX content_assets_checksum ON content_assets(enterprise_group_id, checksum_sha256);
```

- **Delete policy:** SOFT-DELETE only. HARD-DELETE FORBIDDEN if any active `replay_audit_records` reference this `content_asset_id` (via the `playlist` JSONB in corpus).

---

#### Table 11: `templates`

Campaign templates — reusable content structures.

```sql
CREATE TABLE templates (
  template_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name                 TEXT NOT NULL,
  template_json        JSONB NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_enterprise ON templates
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');
```

---

#### Table 12: `campaigns`

```sql
CREATE TABLE campaigns (
  campaign_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  venue_id             UUID REFERENCES venues(venue_id),  -- null = enterprise-wide
  template_id          UUID REFERENCES templates(template_id),
  name                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','published','archived')),
  starts_at            TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  schedule_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_enterprise ON campaigns
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX campaigns_venue_status ON campaigns(venue_id, status, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX campaigns_enterprise_status ON campaigns(enterprise_group_id, status) WHERE deleted_at IS NULL;
```

---

#### Table 13: `schedules`

Time-based rules. Maps to `ScheduleRecord` in PRE types.

```sql
CREATE TABLE schedules (
  schedule_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  campaign_id          UUID REFERENCES campaigns(campaign_id),
  content_asset_id     UUID REFERENCES content_assets(content_asset_id),
  target_type          TEXT NOT NULL CHECK (target_type IN ('screen','screen_zone','venue')),
  target_id            UUID NOT NULL,
  specificity          INTEGER NOT NULL DEFAULT 0,
  starts_at            TIMESTAMPTZ NOT NULL,
  expires_at           TIMESTAMPTZ,
  days_of_week         SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time_minutes   INTEGER,
  end_time_minutes     INTEGER,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  is_fallback          BOOLEAN NOT NULL DEFAULT false,
  priority             INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_enterprise ON schedules
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX schedules_active ON schedules(target_type, target_id, starts_at) WHERE is_active = true AND deleted_at IS NULL;
```

---

#### Table 14: `overrides`

Manual content overrides. Maps to `OverrideRecord` in PRE types.

```sql
CREATE TABLE overrides (
  override_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  venue_id             UUID REFERENCES venues(venue_id),
  content_asset_id     UUID REFERENCES content_assets(content_asset_id),
  target_type          TEXT NOT NULL CHECK (target_type IN ('screen','screen_zone','venue')),
  target_id            UUID NOT NULL,
  scope                TEXT NOT NULL,
  starts_at            TIMESTAMPTZ NOT NULL,
  expires_at           TIMESTAMPTZ,
  is_operational       BOOLEAN NOT NULL DEFAULT false,
  priority             INTEGER NOT NULL DEFAULT 0,
  reason               TEXT,
  issued_by            UUID REFERENCES principals(principal_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY overrides_enterprise ON overrides
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX overrides_active ON overrides(venue_id, target_type, target_id) WHERE deleted_at IS NULL;
```

---

#### Table 15: `sponsorships`

Sponsorship contracts. Maps to `SponsorshipContractRecord` in PRE types.

```sql
CREATE TABLE sponsorships (
  sponsorship_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  screen_zone_id       UUID REFERENCES screen_zones(screen_zone_id),
  content_asset_id     UUID NOT NULL REFERENCES content_assets(content_asset_id),
  sov_pct              NUMERIC(7,4) NOT NULL CHECK (sov_pct >= 0 AND sov_pct <= 1),
  starts_at            TIMESTAMPTZ NOT NULL,
  expires_at           TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  exclusivity_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsorships_enterprise ON sponsorships
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX sponsorships_active ON sponsorships(screen_zone_id, starts_at) WHERE is_active = true AND deleted_at IS NULL;
```

---

### Wave 4 — Corpus

---

#### Table 16: `corpus_versions`

Immutable versioned PRE input corpus. Deletion is unconditionally prohibited.

```sql
CREATE TABLE corpus_versions (
  corpus_version_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  version_number       BIGINT NOT NULL,
  corpus_checksum      TEXT NOT NULL,  -- fnv1a32 of canonical corpus JSON
  corpus_json          JSONB NOT NULL,  -- full SystemStateSnapshot corpus
  schema_version       TEXT NOT NULL DEFAULT '1.0.0',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID REFERENCES principals(principal_id),
  CONSTRAINT corpus_versions_unique_version
    UNIQUE (enterprise_group_id, version_number)
);

-- DELETION IS UNCONDITIONALLY PROHIBITED
CREATE OR REPLACE FUNCTION corpus_versions_prevent_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'corpus_versions: deletion is unconditionally prohibited. corpus_version_id=%, enterprise_group_id=%',
    OLD.corpus_version_id, OLD.enterprise_group_id;
END;
$$;

CREATE TRIGGER corpus_versions_no_delete
  BEFORE DELETE ON corpus_versions
  FOR EACH ROW EXECUTE FUNCTION corpus_versions_prevent_delete();

ALTER TABLE corpus_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY corpus_versions_enterprise ON corpus_versions
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX corpus_versions_enterprise_version ON corpus_versions(enterprise_group_id, version_number DESC);
CREATE INDEX corpus_versions_checksum ON corpus_versions(corpus_checksum);
```

---

#### Table 17: `deployment_groups`

Named sets of screens for corpus deployment targeting.

```sql
CREATE TABLE deployment_groups (
  deployment_group_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  name                 TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE deployment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY deployment_groups_enterprise ON deployment_groups
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');
```

---

#### Table 18: `deployment_group_screens`

Many-to-many: screens assigned to deployment groups.

```sql
CREATE TABLE deployment_group_screens (
  deployment_group_id  UUID NOT NULL REFERENCES deployment_groups(deployment_group_id),
  screen_id            UUID NOT NULL REFERENCES screens(screen_id),
  added_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deployment_group_id, screen_id)
);

CREATE INDEX dg_screens_screen ON deployment_group_screens(screen_id);
```

---

#### Table 19: `corpus_deployments`

Records which corpus version is deployed to which deployment group.

```sql
CREATE TABLE corpus_deployments (
  corpus_deployment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_version_id    UUID NOT NULL REFERENCES corpus_versions(corpus_version_id),
  deployment_group_id  UUID NOT NULL REFERENCES deployment_groups(deployment_group_id),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  deployed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_by          UUID REFERENCES principals(principal_id),
  is_active            BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE corpus_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY corpus_deployments_enterprise ON corpus_deployments
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX corpus_deployments_group_active ON corpus_deployments(deployment_group_id, deployed_at DESC) WHERE is_active = true;
```

---

### Wave 5 — Operational Records (All Append-Only)

All tables in this wave receive a BEFORE DELETE trigger that throws unconditionally, and a BEFORE UPDATE trigger that throws unconditionally. Immutability is enforced at the database layer.

```sql
-- Reusable append-only enforcement function
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only. DELETE and UPDATE are prohibited. id=%',
    TG_TABLE_NAME, OLD.ctid;
END;
$$;
```

---

#### Table 20: `replay_audit_records`

Core constitutional record. Partitioned by month.

```sql
CREATE TABLE replay_audit_records (
  audit_record_id      UUID NOT NULL,
  screen_id            UUID NOT NULL,
  venue_id             UUID NOT NULL,  -- denormalized for partition pruning + RLS
  enterprise_group_id  UUID NOT NULL,  -- denormalized for RLS
  at                   TIMESTAMPTZ NOT NULL,
  correlation_id       UUID NOT NULL,
  pre_output_hash      TEXT NOT NULL,
  playlist_checksum    TEXT NOT NULL,
  resolution_level     SMALLINT NOT NULL,
  is_fallback          BOOLEAN NOT NULL,
  divergence_class     SMALLINT,
  entropy_score_snapshot NUMERIC(5,4),
  shadow_parity_snapshot NUMERIC(5,4),
  invariants_passed    BOOLEAN NOT NULL,
  audit_written_at     TIMESTAMPTZ NOT NULL,
  record_checksum      TEXT NOT NULL,  -- fnv1a32 of all fields except this one
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()  -- partition key
) PARTITION BY RANGE (created_at);

-- Create initial partitions (12 months ahead)
CREATE TABLE replay_audit_records_2026_01
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... (repeat for each month; managed by maintenance job)

-- Append-only enforcement on parent table
CREATE TRIGGER replay_audit_no_delete
  BEFORE DELETE ON replay_audit_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER replay_audit_no_update
  BEFORE UPDATE ON replay_audit_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

ALTER TABLE replay_audit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY replay_audit_enterprise ON replay_audit_records
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

-- Indexes created on each partition (inherited automatically in PG 15)
CREATE UNIQUE INDEX replay_audit_id ON replay_audit_records(audit_record_id, created_at);
CREATE INDEX replay_audit_venue_time ON replay_audit_records(venue_id, created_at DESC);
CREATE INDEX replay_audit_screen_time ON replay_audit_records(screen_id, created_at DESC);
CREATE INDEX replay_audit_correlation ON replay_audit_records(correlation_id);
CREATE INDEX replay_audit_invocation ON replay_audit_records(audit_record_id);
```

- **Primary key strategy:** Composite (audit_record_id, created_at). The `created_at` column must be included in the PK for partitioning compatibility. `audit_record_id` alone is unique but PostgreSQL requires the partition key in a unique constraint.
- **Partition:** RANGE by `created_at`, monthly. One partition = one calendar month.
- **Archival:** After a partition passes the 90-day HOT window, it moves to WARM status (still in PostgreSQL but marked cold). After 365 days, it is detached and exported via `pg_dump --format=custom` to S3.
- **Delete policy:** FORBIDDEN via trigger. No exceptions.

---

#### Table 21: `parity_records`

Shadow comparison results. Immutable. Partitioned monthly.

```sql
CREATE TABLE parity_records (
  invocation_id        UUID NOT NULL,
  screen_id            UUID NOT NULL,
  venue_id             UUID NOT NULL,
  enterprise_group_id  UUID NOT NULL,
  timestamp_at         TIMESTAMPTZ NOT NULL,
  legacy_output_hash   TEXT NOT NULL,
  pre_output_hash      TEXT NOT NULL,
  divergence_class     SMALLINT,
  diff_summary         TEXT,
  replay_reference     UUID NOT NULL,
  canary_stage         TEXT NOT NULL,
  deterministic_checksum TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TRIGGER parity_no_delete
  BEFORE DELETE ON parity_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER parity_no_update
  BEFORE UPDATE ON parity_records
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

ALTER TABLE parity_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY parity_enterprise ON parity_records
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE UNIQUE INDEX parity_invocation ON parity_records(invocation_id, created_at);
CREATE INDEX parity_venue_time ON parity_records(venue_id, created_at DESC);
CREATE INDEX parity_divergence ON parity_records(enterprise_group_id, divergence_class, created_at DESC)
  WHERE divergence_class IS NOT NULL;
```

---

#### Table 22: `entropy_reports`

Append-only. `acknowledgment_at` is nullable — NULL means unacknowledged.

```sql
CREATE TABLE entropy_reports (
  entropy_report_id    UUID NOT NULL DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL,
  venue_id             UUID NOT NULL,
  severity             TEXT NOT NULL CHECK (severity IN ('ADVISORY','WARNING','CRITICAL')),
  entropy_label        TEXT NOT NULL,
  composite_score      NUMERIC(5,4) NOT NULL,
  advisory_tier        SMALLINT NOT NULL,
  affected_screen_ids  UUID[] NOT NULL DEFAULT '{}',
  metrics_json         JSONB NOT NULL,
  acknowledgment_at    TIMESTAMPTZ,  -- NULL = unacknowledged (mutable field only)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Note: acknowledgment_at is allowed to be set once (NULL -> value).
-- A separate trigger enforces this is a one-way transition.
CREATE OR REPLACE FUNCTION entropy_reports_limit_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow only acknowledgment_at to be set (from NULL to non-NULL)
  IF OLD.acknowledgment_at IS NOT NULL THEN
    RAISE EXCEPTION 'entropy_reports: acknowledgment_at is already set. Record is immutable.';
  END IF;
  IF NEW.entropy_report_id != OLD.entropy_report_id
  OR NEW.enterprise_group_id != OLD.enterprise_group_id
  OR NEW.venue_id != OLD.venue_id
  OR NEW.severity != OLD.severity
  OR NEW.composite_score != OLD.composite_score THEN
    RAISE EXCEPTION 'entropy_reports: only acknowledgment_at may be updated.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER entropy_reports_constrained_update
  BEFORE UPDATE ON entropy_reports
  FOR EACH ROW EXECUTE FUNCTION entropy_reports_limit_update();

CREATE TRIGGER entropy_reports_no_delete
  BEFORE DELETE ON entropy_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

ALTER TABLE entropy_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY entropy_reports_enterprise ON entropy_reports
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');

CREATE INDEX entropy_venue_severity ON entropy_reports(venue_id, severity, created_at DESC);
CREATE INDEX entropy_unacked ON entropy_reports(enterprise_group_id, severity, created_at DESC)
  WHERE acknowledgment_at IS NULL;
```

---

#### Table 23: `entropy_acknowledgments`

Separate audit trail of acknowledgment events. Append-only.

```sql
CREATE TABLE entropy_acknowledgments (
  acknowledgment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entropy_report_id    UUID NOT NULL,
  acknowledged_by      UUID NOT NULL REFERENCES principals(principal_id),
  acknowledged_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  note                 TEXT
);

CREATE TRIGGER entropy_acks_no_delete
  BEFORE DELETE ON entropy_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER entropy_acks_no_update
  BEFORE UPDATE ON entropy_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX entropy_acks_report ON entropy_acknowledgments(entropy_report_id);
CREATE INDEX entropy_acks_principal ON entropy_acknowledgments(acknowledged_by, acknowledged_at DESC);
```

---

#### Table 24: `canary_stage_history`

Append-only log of canary stage transitions.

```sql
CREATE TABLE canary_stage_history (
  canary_event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL,
  from_stage           TEXT NOT NULL,
  to_stage             TEXT NOT NULL,
  transition_type      TEXT NOT NULL CHECK (transition_type IN ('PROMOTE','ROLLBACK','RESET')),
  approved_by          UUID REFERENCES principals(principal_id),
  parity_score_24h     NUMERIC(5,4),
  parity_score_7d      NUMERIC(5,4),
  total_invocations    BIGINT,
  blocking_reason      TEXT,
  is_authoritative_promotion BOOLEAN NOT NULL DEFAULT false,
  event_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER canary_history_no_delete
  BEFORE DELETE ON canary_stage_history
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER canary_history_no_update
  BEFORE UPDATE ON canary_stage_history
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX canary_history_enterprise ON canary_stage_history(enterprise_group_id, event_at DESC);
CREATE INDEX canary_history_authoritative ON canary_stage_history(enterprise_group_id, event_at DESC)
  WHERE is_authoritative_promotion = true;
```

---

#### Table 25: `constitutional_freeze_log`

PERMANENT retention. Never purged, never archived. Physically stays in PostgreSQL forever (or until explicit PLATFORM_ADMIN decision with full audit trail).

```sql
CREATE TABLE constitutional_freeze_log (
  freeze_log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID,  -- NULL = platform-wide freeze
  freeze_type          TEXT NOT NULL,
  triggered_by         UUID REFERENCES principals(principal_id),
  reason               TEXT NOT NULL,
  constitutional_state TEXT NOT NULL,
  payload_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  permanent            BOOLEAN NOT NULL DEFAULT true,
  event_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PERMANENT: no delete, no update, no archival
CREATE TRIGGER constitutional_freeze_no_delete
  BEFORE DELETE ON constitutional_freeze_log
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER constitutional_freeze_no_update
  BEFORE UPDATE ON constitutional_freeze_log
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

-- No RLS: PLATFORM_ADMIN only. Cross-enterprise by design.
CREATE INDEX freeze_log_enterprise ON constitutional_freeze_log(enterprise_group_id, event_at DESC);
CREATE INDEX freeze_log_time ON constitutional_freeze_log(event_at DESC);
```

---

### Wave 6 — Constitutional State

---

#### Table 26: `circuit_breaker_state`

One row per circuit breaker type per enterprise. Upsert pattern only.

```sql
CREATE TABLE circuit_breaker_state (
  circuit_breaker_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id  UUID NOT NULL REFERENCES enterprise_groups(enterprise_group_id),
  breaker_type         TEXT NOT NULL,
  state                TEXT NOT NULL CHECK (state IN ('CLOSED','OPEN','HALF_OPEN')),
  failure_count        INTEGER NOT NULL DEFAULT 0,
  last_failure_at      TIMESTAMPTZ,
  opened_at            TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_group_id, breaker_type)
);

ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY circuit_breaker_enterprise ON circuit_breaker_state
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');
```

- **Pattern:** `INSERT ... ON CONFLICT (enterprise_group_id, breaker_type) DO UPDATE SET ...`
- **Delete policy:** CASCADE on enterprise deletion (soft-delete propagation). Hard-delete allowed when enterprise is fully decommissioned.

---

#### Table 27: `constitutional_state`

One row per enterprise — the current constitutional state.

```sql
CREATE TABLE constitutional_state (
  constitutional_state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_group_id     UUID NOT NULL UNIQUE REFERENCES enterprise_groups(enterprise_group_id),
  current_state           TEXT NOT NULL,
  reason                  TEXT,
  entered_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  canary_stage            TEXT NOT NULL DEFAULT 'SHADOW_ONLY',
  metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE constitutional_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY constitutional_state_enterprise ON constitutional_state
  USING (enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
         OR current_setting('app.bypass_rls', true) = 'true');
```

- **Pattern:** Upsert — one row per enterprise. Mutable (current state changes). History tracked via `canary_stage_history` and `constitutional_freeze_log`.
- **Delete policy:** CASCADE on enterprise soft-delete.

---

## 3. Migration Risk Notes

See MULTI-TENANCY-PARTITIONING.md §4 for anti-patterns.

Critical ordering constraint: **Wave 5 partitions must be created before production traffic starts.** Creating partitions retroactively on a populated table requires a full table rewrite.

FK validation risk: If Flyway migration fails mid-wave, rollback must be scripted explicitly. Flyway does not auto-rollback DDL on PostgreSQL (DDL is not transactional for partition creation).

The `enforce_append_only()` function in Wave 5 must be created once at the database level, not once per table. Migration `V20260601_020__create_append_only_function.sql` must run before any Wave 5 table creation.
