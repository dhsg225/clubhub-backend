# MULTI-TENANCY-PARTITIONING.md

**Status:** Engineering-Ready
**Authority:** Implementation planning document. Defines multi-tenancy isolation, RLS design, and partitioning strategy.
**Last updated:** 2026-05-26
**Depends on:** DATABASE-ROLLOUT-PLAN.md, CLUBHUB_SYSTEM_CONTRACTS.md §1

---

## 1. Tenancy Model

ClubHub TV operates a 5-tier tenancy hierarchy:

```
PLATFORM_OWNER
  └── ENTERPRISE_GROUP          (e.g. "Premier Clubs Ltd")
        └── REGIONAL_ORG        (e.g. "Northern Region" — optional tier)
              └── VENUE         (e.g. "The Crown, Manchester")
                    └── SCREEN_ZONE   (e.g. "Gaming Floor", "Bar Area")
                          └── SCREEN  (individual display)
```

The fundamental isolation requirement: **an ENTERPRISE_GROUP and all its data must be invisible to any other ENTERPRISE_GROUP.** An enterprise's operators must not be able to construct any query — accidental or deliberate — that returns data from another enterprise.

This isolation is enforced at the database layer using PostgreSQL Row-Level Security (RLS). Application-level WHERE clauses are a secondary defense, not the primary one.

---

## 2. Row-Level Security Design

### 2.1 Session Setup

Before executing any tenant-scoped query, the application sets the enterprise identity on the database session:

```sql
-- On connection establishment (or at start of each request transaction):
SET LOCAL app.current_enterprise_id = '<enterprise_group_id_uuid>';
SET LOCAL app.current_principal_id  = '<principal_id_uuid>';
-- app.bypass_rls is NOT set in normal sessions
```

`SET LOCAL` ensures the value is scoped to the current transaction and automatically reset on transaction end. This is safer than `SET` (session-level), which persists across transactions on pooled connections.

**Connection pooling note:** When using PgBouncer in transaction-pooling mode (the recommended mode for high connection counts), `SET LOCAL` is safe because each transaction gets a fresh server connection assignment. However, confirm this behavior with the specific PgBouncer version and mode before production deployment. If PgBouncer is in session-pooling mode, `SET LOCAL` will NOT be reset between requests — use `SET` + explicit reset at request end in that case.

### 2.2 PLATFORM_ADMIN Bypass

PLATFORM_ADMIN sessions use a dedicated PostgreSQL role that has the `BYPASSRLS` attribute:

```sql
CREATE ROLE platform_admin_role BYPASSRLS;
GRANT platform_admin_role TO clubhub_platform_admin_user;
```

Alternatively, for application connections that sometimes act as PLATFORM_ADMIN:
```sql
SET LOCAL app.bypass_rls = 'true';
```

The RLS policies check for this setting:
```sql
USING (
  enterprise_group_id = current_setting('app.current_enterprise_id')::uuid
  OR current_setting('app.bypass_rls', true) = 'true'
)
```

The `true` second argument to `current_setting` means "return NULL if not set" rather than raising an error — this prevents RLS from blocking queries where the setting was never established.

### 2.3 RLS Policy Catalog

The following tables have RLS enabled. Policies are shown in simplified form — see DATABASE-ROLLOUT-PLAN.md for full DDL.

**Enterprise-scoped tables (RLS by `enterprise_group_id`):**

| Table | RLS Filter |
|---|---|
| `venues` | `enterprise_group_id = :current_enterprise` |
| `screen_zones` | `enterprise_group_id = :current_enterprise` |
| `screens` | `enterprise_group_id = :current_enterprise` |
| `campaigns` | `enterprise_group_id = :current_enterprise` |
| `schedules` | `enterprise_group_id = :current_enterprise` |
| `overrides` | `enterprise_group_id = :current_enterprise` |
| `sponsorships` | `enterprise_group_id = :current_enterprise` |
| `templates` | `enterprise_group_id = :current_enterprise` |
| `content_assets` | `enterprise_group_id = :current_enterprise` |
| `corpus_versions` | `enterprise_group_id = :current_enterprise` |
| `corpus_deployments` | `enterprise_group_id = :current_enterprise` |
| `deployment_groups` | `enterprise_group_id = :current_enterprise` |
| `canary_stage_history` | `enterprise_group_id = :current_enterprise` |
| `constitutional_state` | `enterprise_group_id = :current_enterprise` |
| `circuit_breaker_state` | `enterprise_group_id = :current_enterprise` |
| `replay_audit_records` | `enterprise_group_id = :current_enterprise` |
| `parity_records` | `enterprise_group_id = :current_enterprise` |
| `entropy_reports` | `enterprise_group_id = :current_enterprise` |

**Platform-scoped tables (NO RLS — PLATFORM_ADMIN only):**

| Table | Access |
|---|---|
| `platforms` | PLATFORM_ADMIN role required; no RLS needed |
| `enterprise_groups` | PLATFORM_ADMIN role required; no RLS needed |
| `constitutional_freeze_log` | PLATFORM_ADMIN role required; no RLS needed |

**Identity-scoped tables (RLS by `principal_id` and/or `enterprise_group_id`):**

| Table | RLS Filter |
|---|---|
| `principals` | `enterprise_group_id = :current_enterprise OR principal_id = :current_principal` |
| `role_assignments` | `enterprise_group_id = :current_enterprise OR principal_id = :current_principal` |
| `sessions` | Scoped via `principal_id` → `principals` (JOIN to verify enterprise) |

**Venue-scoped within enterprise (secondary filter):**

The `entropy_reports` and `entropy_acknowledgments` tables have enterprise-level RLS, with application code responsible for further filtering by `venue_id` within the enterprise. This is intentional — a venue manager should see only their venue's entropy reports, but this is an application concern (authorization), not a data isolation concern (RLS).

### 2.4 Denormalized `enterprise_group_id` Column

All high-volume tables (especially `replay_audit_records`, `parity_records`, `entropy_reports`, and `screens`) carry a **denormalized `enterprise_group_id` column** even though this value is derivable by joining to `venues` or `screens`. This denormalization is required because:

1. RLS policies on partitioned tables cannot efficiently evaluate a subquery for every row
2. A direct equality filter `enterprise_group_id = :setting` uses the index on `enterprise_group_id` directly
3. JOIN to `venues` for RLS would make every audit query do a join — unacceptable at 2,160 records/screen/day scale

The cost: `enterprise_group_id` must be set correctly on insert. The application is responsible for ensuring consistency. A trigger can enforce consistency at insert time:

```sql
CREATE OR REPLACE FUNCTION validate_enterprise_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  expected_enterprise UUID;
BEGIN
  SELECT enterprise_group_id INTO expected_enterprise
  FROM venues WHERE venue_id = NEW.venue_id;

  IF expected_enterprise != NEW.enterprise_group_id THEN
    RAISE EXCEPTION 'enterprise_group_id mismatch: venue % belongs to enterprise %, not %',
      NEW.venue_id, expected_enterprise, NEW.enterprise_group_id;
  END IF;
  RETURN NEW;
END;
$$;
```

Apply this trigger to `replay_audit_records`, `parity_records`, and `entropy_reports`.

---

## 3. Partition Strategy for High-Volume Tables

### 3.1 `replay_audit_records` — RANGE by `created_at` (Monthly)

```sql
CREATE TABLE replay_audit_records (...) PARTITION BY RANGE (created_at);
```

**Partition naming convention:** `replay_audit_records_YYYY_MM`

Example:
```sql
CREATE TABLE replay_audit_records_2026_01
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Partition management:**
- New partitions are created 60 days in advance by a scheduled job (e.g., a monthly cron that creates partitions for the next 2 months)
- Old partitions are detached after the WARM window expires (365 days from partition end date)
- Detached partitions are exported to S3 and dropped (see AUDIT-RETENTION-POLICY.md §7)

**Why monthly partitions:**
- Monthly granularity matches the HOT/WARM archival boundary (90 days = ~3 partitions in HOT)
- A single partition represents one calendar month of data — easy to reason about
- Weekly partitions would create 52 partition tables per year — PostgreSQL planner overhead increases with partition count
- Quarterly partitions would make it harder to detach exactly the 90-day HOT boundary

**Indexes per partition:**
PostgreSQL 15 inherits parent table indexes onto partitions automatically. Indexes are created on the parent:

```sql
CREATE UNIQUE INDEX replay_audit_id_idx ON replay_audit_records(audit_record_id, created_at);
CREATE INDEX replay_audit_venue_time_idx ON replay_audit_records(venue_id, created_at DESC);
CREATE INDEX replay_audit_screen_time_idx ON replay_audit_records(screen_id, created_at DESC);
CREATE INDEX replay_audit_correlation_idx ON replay_audit_records(correlation_id);
CREATE INDEX replay_audit_enterprise_time_idx ON replay_audit_records(enterprise_group_id, created_at DESC);
```

**Partition pruning:** PostgreSQL automatically prunes partitions from query plans when the `created_at` filter allows it. Always include `created_at` in audit queries, even when the actual business filter is `venue_id`. Example pattern:

```sql
-- Good: partition pruning applies
SELECT * FROM replay_audit_records
WHERE venue_id = $1
  AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC;

-- Bad: full table scan across all partitions
SELECT * FROM replay_audit_records
WHERE venue_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

---

### 3.2 `parity_records` — RANGE by `created_at` (Monthly)

Same strategy as `replay_audit_records`. Parity records and audit records are generated in the same operational flow and have the same retention requirements.

```sql
CREATE TABLE parity_records (...) PARTITION BY RANGE (created_at);
CREATE TABLE parity_records_2026_01
  PARTITION OF parity_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Volume note:** Parity records are only generated during active canary rollouts (10–20% of fleet at any time). At peak canary deployment, parity volume is ~20% of audit volume. At steady state (AUTHORITATIVE stage), parity generation stops entirely.

**Indexes:**
```sql
CREATE UNIQUE INDEX parity_invocation_idx ON parity_records(invocation_id, created_at);
CREATE INDEX parity_venue_time_idx ON parity_records(venue_id, created_at DESC);
CREATE INDEX parity_divergence_idx ON parity_records(enterprise_group_id, divergence_class, created_at DESC)
  WHERE divergence_class IS NOT NULL;
```

---

### 3.3 `entropy_reports` — RANGE by `created_at` (Monthly), secondary consideration for severity

**Initial implementation:** Monthly RANGE partition only (same as audit records).

```sql
CREATE TABLE entropy_reports (...) PARTITION BY RANGE (created_at);
```

**Rationale for not using LIST partition by severity initially:**
- CRITICAL entropy reports are queried frequently — but they are also rare. A `severity` index on the monthly partition achieves the same query performance without the complexity of multi-level partitioning.
- PostgreSQL's declarative multi-level partitioning (RANGE then LIST) is supported but adds DDL complexity (N months × 3 severities = 36 partition tables per year).
- Defer multi-level partitioning until query profiling shows it is needed (>50 venues, >1M entropy reports/month).

**Indexes:**
```sql
CREATE INDEX entropy_venue_severity_idx ON entropy_reports(venue_id, severity, created_at DESC);
CREATE INDEX entropy_unacked_idx ON entropy_reports(enterprise_group_id, severity, created_at DESC)
  WHERE acknowledgment_at IS NULL;
CREATE INDEX entropy_enterprise_time_idx ON entropy_reports(enterprise_group_id, created_at DESC);
```

---

## 4. Critical Index Strategy

### 4.1 Index Priority Classification

**P0 — Query correctness depends on this index (missing = table scan on multi-billion row table):**
- `replay_audit_records(venue_id, created_at DESC)` — primary audit query pattern
- `replay_audit_records(audit_record_id, created_at)` — unique, deduplication
- `replay_audit_records(enterprise_group_id, created_at DESC)` — RLS filter + time range

**P1 — Performance critical (missing = acceptable in dev, unacceptable in prod):**
- `replay_audit_records(correlation_id)` — cross-record tracing
- `replay_audit_records(screen_id, created_at DESC)` — per-screen audit queries
- `parity_records(invocation_id, created_at)` — deduplication
- `parity_records(divergence_class, created_at DESC)` — divergence investigation
- `campaigns(venue_id, status, starts_at)` — active campaign lookup in PRE

**P2 — Operational convenience (missing = slow reports, acceptable at low scale):**
- `screens(status, enterprise_group_id)` — fleet health dashboard
- `entropy_reports(acknowledgment_at IS NULL)` — unacked alerts
- `sponsorships(screen_zone_id, starts_at)` — active sponsorship lookup

### 4.2 Index Anti-Patterns to Avoid

**NEVER create:**

1. An index on `replay_audit_records` without a `created_at` component — every such index must interact with the partition scheme or it will scan all partitions.

2. A functional index on JSONB fields in `corpus_versions.corpus_json` for production query patterns. JSONB GIN indexes are appropriate for ad-hoc operator queries but not for the hot path of PRE corpus resolution. Cache the resolved corpus fields in application memory.

3. A non-partial index on `deleted_at IS NOT NULL` records — queries almost always filter for non-deleted records. Partial indexes where `deleted_at IS NULL` are smaller and faster.

4. Multiple single-column indexes on columns that are always queried together. Use composite indexes. Example: do not create separate indexes on `(venue_id)` and `(created_at)` for `replay_audit_records` — the composite `(venue_id, created_at DESC)` serves both patterns.

---

## 5. Cross-Tenant Join Prohibition

**PROHIBITION:** Application code MUST NOT perform JOIN operations that cross enterprise boundaries. This means:

1. Do not JOIN `replay_audit_records` for enterprise A with `replay_audit_records` for enterprise B in a single query
2. Do not JOIN `venues` from enterprise A with `venues` from enterprise B
3. Do not perform subqueries that span multiple enterprise_group_ids

**Why this matters beyond RLS:** RLS prevents data leakage at the row level, but a cross-tenant JOIN could produce a query plan that scans all partitions for both enterprises. At platform scale (100+ enterprises), this degrades into a full table scan regardless of indexes.

**The correct pattern for PLATFORM_ADMIN cross-enterprise reporting:** Run separate queries per enterprise (with RLS bypassed) and aggregate results in application memory. Do NOT use a single query with `WHERE enterprise_group_id IN (enterprise1, enterprise2, ...)`.

---

## 6. GDPR Data Residency (EU Venues)

Venues with `gdpr_region = true` in the `venues` table require that their replay audit records remain within EU data residency zones.

**Implementation strategy:**
- Deploy a separate PostgreSQL RDS instance in an AWS EU region (e.g., `eu-west-1` Ireland or `eu-central-1` Frankfurt) for EU-resident data
- EU-venue audit records are written to the EU RDS instance only
- Non-EU audit records are written to the primary instance (e.g., `us-east-1`)
- The application routing layer reads `venue.gdpr_region` to determine which database connection to use

**Operational complexity:** Two PostgreSQL instances means double the maintenance burden for partitioning, archival, and integrity verification. This complexity is the unavoidable cost of GDPR data residency compliance. Do not attempt to solve this with logical replication (replicating EU data to a US instance defeats the purpose).

**Redis:** Emergency channel pub/sub for EU venues should use an ElastiCache Redis cluster in the same EU region as the PostgreSQL instance. Player heartbeats from EU screens should also route to the EU Redis cluster.

**Cold storage:** EU replay audit partitions must be archived to an S3 bucket with `eu-west-1` or `eu-central-1` bucket location. Do not use S3 cross-region replication that moves EU data to US regions.

---

## 7. Horizontal Sharding Trigger

**Do not shard at launch.** A single PostgreSQL RDS instance (db.r6g.2xlarge or equivalent) can handle platform scale at 100 enterprises × avg 50 screens.

**The sharding trigger:** When a single enterprise generates more than **100M replay audit records per year**, the audit query latency for that enterprise will begin to degrade even with monthly partitioning (each monthly partition will be ~8M rows at that scale). At this point, horizontal sharding by `enterprise_group_id` becomes necessary.

**Sharding approach when triggered:**
1. Assign each enterprise a shard number via consistent hashing: `shard_id = hash(enterprise_group_id) % num_shards`
2. Shard routing table: a small PostgreSQL table in the platform database maps `enterprise_group_id → shard_host`
3. Each shard is an independent PostgreSQL RDS instance with the full schema
4. The application reads the shard routing table on connection pool initialization (refreshed every 60 seconds)
5. Cross-shard PLATFORM_ADMIN queries run in parallel (one query per shard, results merged in application)

**Shard routing table:**
```sql
-- In the platform (non-sharded) database:
CREATE TABLE enterprise_shard_assignments (
  enterprise_group_id  UUID PRIMARY KEY REFERENCES enterprise_groups(enterprise_group_id),
  shard_id             INTEGER NOT NULL,
  shard_host           TEXT NOT NULL,
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**When to plan:** At 500 venues on the platform (approximately 20–30 large enterprises), begin capacity planning for sharding. Shard migration is not zero-downtime without careful planning — start 6 months before the trigger is hit.
