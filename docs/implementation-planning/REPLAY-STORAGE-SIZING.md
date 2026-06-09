# REPLAY-STORAGE-SIZING.md

**Status:** Engineering-Ready
**Authority:** Implementation planning document. Storage sizing estimates and cost decisions for infrastructure planning.
**Last updated:** 2026-05-26
**Depends on:** DATABASE-ROLLOUT-PLAN.md, AUDIT-RETENTION-POLICY.md, MULTI-TENANCY-PARTITIONING.md

---

## 1. Per-Record Size Estimates

All estimates are for production records with full field population. Sizes are uncompressed JSON wire format (as stored in PostgreSQL), not memory-resident TypeScript objects.

### `ReplayAuditRecord` (~1.5KB per record)

Fields present in every record (from `src/audit/replay-audit-types.ts`):
```
audit_record_id:          36 chars (UUID)
screen_id:                36 chars (UUID)
at:                       13 chars (UTC ms)
correlation_id:           36 chars (UUID)
pre_output_hash:          10 chars (fnv1a32 hex)
playlist_checksum:        10 chars (fnv1a32 hex)
resolution_level:         1 char
is_fallback:              5 chars
divergence_class:         1-2 chars (nullable)
entropy_score_snapshot:   6 chars (0.0000 format, nullable)
shadow_parity_snapshot:   6 chars (nullable)
invariants_passed:        4-5 chars
audit_written_at:         13 chars (UTC ms)
record_checksum:          10 chars (fnv1a32 hex)
```

PostgreSQL row overhead: ~23 bytes per row (header + null bitmap + MVCC).
JSON field keys in JSONB storage: ~200 bytes of overhead for key names.
Total: field values (~300 bytes) + keys (~200 bytes) + PostgreSQL row overhead (~100 bytes) + JSONB structure = **~600-700 bytes raw storage per row.**

However, PostgreSQL JSONB storage format and index entries add overhead. With a (venue_id, created_at) index entry and the primary (audit_record_id, created_at) index entry, each record occupies approximately **1.5KB of total database storage** including index overhead.

Practical cross-check: at 100 records/second ingestion rate sustained for 1 hour, PostgreSQL should show approximately 540MB of new data — consistent with 1.5KB/record × 360,000 records.

### `ParityRecord` (~2KB per record)

Fields include:
```
invocation_id:            36 chars (UUID)
timestamp:                13 chars
legacy_output_hash:       10 chars (fnv1a32)
pre_output_hash:          10 chars (fnv1a32)
divergence_class:         1-2 chars (nullable)
diff_summary:             0-500 chars (text description of divergence, can be lengthy)
replay_reference:         36 chars (UUID)
canary_stage:             10-15 chars (e.g. 'SINGLE_VENUE')
deterministic_checksum:   10 chars (fnv1a32)
```

The `diff_summary` field is the size variable. When divergence_class is NULL (identical outputs), diff_summary is NULL. When a divergence occurs, diff_summary can be 100–500 characters. Average across records (most will be NULL divergence): ~50 chars for diff_summary.

With index overhead (invocation_id unique index + venue_id + time index): **~2KB per record.**

### `EntropyReport` (~3KB per record)

```
entropy_report_id:        36 chars
venue_id:                 36 chars
severity:                 8-10 chars
entropy_label:            8-10 chars
composite_score:          6 chars
advisory_tier:            1 char
affected_screen_ids:      36 chars × N (array of UUIDs, 0–50 screens)
metrics_json:             JSONB with 12 MetricResult objects (~200 chars each = ~2400 chars)
```

The `metrics_json` field is the dominant size. Each `MetricResult` carries `metric_id`, `value`, `raw_value`, `unit`, `threshold_warn`, `threshold_critical`, `explanation`, `contributing_factors`, `computed_at`. At 12 metrics × ~200 chars each, the metrics JSONB alone is ~2.4KB.

Total with overhead: **~3KB per record.**

### `ConstitutionalFreezeLog` (~0.5KB per record)

Small, rare records. `payload_json` is the variable field — typically contains the triggering event details, bounded by the event type. For CLASS_4 divergence events, payload is ~300 chars. For AUTHORITATIVE promotions, ~200 chars.

Total: **~500 bytes per record.** These records are rare enough that total table size is immaterial.

---

## 2. Invocation Volume Estimates

### Baseline Invocation Rate

```
PRE.resolve() is called every 30 seconds per screen during operating hours.

Operating hours assumption: 18 hours/day
  (venues open from 09:00 to 03:00 — gaming venues may run 24h; see LICENSED_GAMING note)

Invocations per screen per day:
  = (60 min × 18 hr) / 0.5 min = 2,160 invocations/screen/day

LICENSED_GAMING venues (24h operation):
  = 2,880 invocations/screen/day
```

Each invocation produces exactly 1 `replay_audit_record`. It MAY produce 1 `parity_record` if the screen is in an active canary rollout.

### Scale Tier Estimates

**SMALL venue (5 screens, STANDARD compliance):**
```
Audit records/day:    5 × 2,160 = 10,800
Storage/day:          10,800 × 1.5KB = ~16MB
Storage/month:        ~480MB
Storage/year:         ~5.6GB (before archival)
HOT storage (90d):    ~1.4GB
```

**MEDIUM venue (15 screens, STANDARD compliance):**
```
Audit records/day:    15 × 2,160 = 32,400
Storage/day:          32,400 × 1.5KB = ~47MB
Storage/month:        ~1.4GB
Storage/year:         ~17GB (before archival)
HOT storage (90d):    ~4.2GB
```

**LARGE venue (50 screens, LICENSED_GAMING — 24h):**
```
Audit records/day:    50 × 2,880 = 144,000
Storage/day:          144,000 × 1.5KB = ~210MB
Storage/month:        ~6.1GB
Storage/7 years:      ~525GB (compliance retention)
HOT storage (90d):    ~18.9GB
```

**MEDIUM GAMING venue (20 screens, LICENSED_GAMING — 24h):**
```
Audit records/day:    20 × 2,880 = 57,600
Storage/day:          57,600 × 1.5KB = ~84MB
Storage/month:        ~2.5GB
Storage/7 years:      ~210GB (compliance retention, all in cold storage after year 1)
HOT storage (90d):    ~7.5GB
```

---

## 3. Per-Enterprise Sizing Examples

### Example A: Premier Clubs Ltd (12 venues, avg 15 screens, STANDARD compliance)

```
Fleet:             12 venues × 15 screens = 180 screens
Records/day:       180 × 2,160 = 388,800
Storage/day:       388,800 × 1.5KB ≈ 566MB
Storage/month:     ~17GB
Storage/year:      ~207GB (before archival)

HOT tier (90d):    90 × 566MB ≈ 50GB PostgreSQL storage
WARM tier (91-365d): 275 × 566MB ≈ 153GB (pre-compression)
  After 5:1 compression: ~31GB in S3 Standard
COLD tier (1-2yr): ~153GB/yr (post-compression ~31GB/yr in S3 Glacier)
```

### Example B: Gaming Estates Ltd (5 venues, avg 20 screens, LICENSED_GAMING — 24h)

```
Fleet:             5 venues × 20 screens = 100 screens
Records/day:       100 × 2,880 = 288,000
Storage/day:       288,000 × 1.5KB ≈ 421MB
Storage/7 years:   421MB × 365 × 7 ≈ 1.07TB

HOT tier (90d):    ~37GB PostgreSQL storage
WARM tier (91-365d): ~112GB (pre-compression) → ~23GB compressed in S3
COLD tier (1-7yr): ~421MB/day × 275 days/yr × 6 remaining years
                   ≈ 693GB in S3 Glacier over 6 years (post year 1)
```

### Example C: Platform Total (100 enterprises, avg 50 screens each, mixed compliance)

```
Assumption: 80% STANDARD venues, 20% LICENSED_GAMING venues
Fleet:             100 × 50 = 5,000 screens
  STANDARD:        4,000 screens × 2,160 = 8.64M records/day
  LICENSED_GAMING: 1,000 screens × 2,880 = 2.88M records/day
  Total:           11.52M records/day

Storage/day:       11.52M × 1.5KB ≈ 16.7GB
Storage/month:     ~500GB
Storage/year:      ~6TB (before archival; includes parity records ≈ +10%)

HOT tier (90d):    ~1.5TB PostgreSQL storage
WARM tier (91-365d): ~4.5TB pre-compression → ~900GB compressed in S3
COLD tier (1yr+):  ~900GB/yr in S3 Glacier (growing)
  At 3 years:      ~2.7TB in Glacier
  At 7 years (compliance records):  ~5TB+ in Glacier
```

---

## 4. HOT Storage PostgreSQL Sizing

### Instance Sizing Recommendation

**Phase 1 (0–100 venues, <500 screens total):**
- Instance: `db.r6g.2xlarge` (8 vCPU, 64GB RAM, 2TB SSD gp3)
- Rationale: The 64GB RAM accommodates the PostgreSQL shared_buffers (16GB recommended, up to 25% of RAM), plus active index pages and query working memory. The 2TB SSD provides 2–3x headroom over the 90-day HOT storage requirement at 500 screens (~1.5TB HOT).
- Read replica: 1 replica for proof-of-play query isolation (sponsorship reporting is read-intensive and should not compete with write throughput on the primary)
- PostgreSQL `shared_buffers`: 16GB
- PostgreSQL `work_mem`: 64MB (per query — watch for parallel query memory multiplication)
- PostgreSQL `max_connections`: 200 (use PgBouncer in transaction mode to multiplex application connections)

**Phase 2 (100–500 venues, 500–2,500 screens):**
- Instance: `db.r6g.4xlarge` (16 vCPU, 128GB RAM, 4TB SSD)
- Add 2 read replicas (one for proof-of-play reporting, one for entropy dashboards)
- Consider moving EU-resident data to a dedicated `db.r6g.xlarge` in eu-west-1

**Phase 3 (500+ venues, >2,500 screens):**
- Begin horizontal sharding evaluation (see MULTI-TENANCY-PARTITIONING.md §7)
- Citus extension for PostgreSQL is an option before full sharding

### Partition Size at Scale

At 5,000 screens platform-wide, each monthly partition of `replay_audit_records` will contain:
```
11.52M records/day × 30 days = 345.6M records/month
345.6M × 1.5KB ≈ 500GB per monthly partition (uncompressed)
```

A 500GB partition is still manageable in PostgreSQL with proper indexing and partitioning. However, `pg_dump` of a 500GB table takes ~2 hours. Plan archival windows accordingly (off-peak, with monitoring).

---

## 5. WARM Storage (S3 + Athena)

### Compression Estimates

PostgreSQL JSONB (replay audit records) compresses at approximately **5:1** with gzip level 9. The dominant fields are UUIDs (36 chars each — not compressible within a record, but repetitive across records) and small integers/strings.

Practical validation: dump 1,000 records from a production-representative dataset and measure the gzip ratio. The 5:1 estimate is conservative — real compression may be closer to 7:1 for records with many NULL fields (inactive shadow mode, STANDARD venues).

### S3 Athena Query Configuration

For WARM tier queries (91–365 days old), use AWS Athena with the exported partition files:

```sql
-- Athena table definition (partition by year/month)
CREATE EXTERNAL TABLE IF NOT EXISTS replay_audit_warm (
  audit_record_id     STRING,
  screen_id           STRING,
  venue_id            STRING,
  enterprise_group_id STRING,
  at                  BIGINT,
  correlation_id      STRING,
  record_checksum     STRING,
  ...
)
PARTITIONED BY (year INT, month INT)
STORED AS ORC
LOCATION 's3://clubhub-audit-warm/replay_audit_records/'
TBLPROPERTIES ('classification'='orc');
```

Use ORC format (not raw NDJSON) for Athena storage — ORC provides columnar compression and predicate pushdown, making `venue_id + time range` queries 10x faster than NDJSON scanning.

**Warm query SLA:** <5s for a 30-day window query on a single venue, using Athena with ORC-formatted partitions. This is achievable because Athena will push the `venue_id` filter to the ORC reader, scanning only the relevant columns.

---

## 6. COLD Storage (S3 Glacier)

### Glacier Tier Selection

| Age | Tier | Retrieval Time | Cost |
|---|---|---|---|
| 1–3 years | S3 Glacier Instant Retrieval | Milliseconds | $0.004/GB/month |
| 3–7 years | S3 Glacier Deep Archive | 12–48 hours | $0.00099/GB/month |

**Instant Retrieval rationale (years 1–3):** Regulatory inquiries and incident investigations that require records from 1–2 years ago are relatively common. Instant Retrieval means these records are available without a retrieval job. The cost premium over Deep Archive is ~4x, but the total cold storage cost is not the dominant budget item (see §7).

**Deep Archive rationale (years 3–7):** Records older than 3 years are accessed only for formal regulatory proceedings. The 12–48 hour retrieval window is acceptable for these rare events. Cost savings are significant at scale.

---

## 7. Cost Breakdown (AWS Reference Pricing)

### Phase 1 Platform (100 enterprises, ~500 screens)

```
PostgreSQL RDS (db.r6g.2xlarge, 2TB gp3):
  Instance:          ~$700/month
  Storage (2TB gp3): ~$200/month
  Read replica:      ~$700/month
  Total RDS:         ~$1,600/month

Redis ElastiCache (cache.r6g.large, 2 nodes):
  ~$200/month

S3 Standard (warm tier, ~150GB/month → accumulates to ~900GB at end of year):
  ~$25/TB/month × 0.9TB = ~$22/month

S3 Glacier Instant (cold, accumulates ~1TB after year 1):
  ~$4/TB/month × 1TB = ~$4/month

S3 Glacier Deep Archive (compliance venues, begins year 3):
  ~$1/TB/month × growing

Total Phase 1: ~$1,850/month
```

**The dominant cost is the PostgreSQL RDS instance.** Cold and warm storage are single-digit percentages of the total bill. Optimizing S3 storage costs will have negligible impact on the total infrastructure spend — optimize the PostgreSQL instance sizing and read replica configuration instead.

### Phase 2 Platform (500 venues, ~2,500 screens)

```
PostgreSQL RDS (db.r6g.4xlarge, 4TB gp3):
  Primary:           ~$1,400/month
  2 Read replicas:   ~$2,800/month
  Storage (4TB gp3): ~$400/month
  EU instance:       ~$700/month
  Total RDS:         ~$5,300/month

S3 Standard warm:    ~$100/month (accumulated ~4TB)
S3 Glacier:          ~$20/month (accumulated ~5TB)

Total Phase 2: ~$5,500/month
```

---

## 8. Parity Record Sizing (Shadow/Canary Mode)

Parity records are only generated during active canary rollout phases.

**Assumptions for canary sizing:**
- A typical canary rollout covers 10–20% of fleet screens at any one time
- Duration per canary phase: 2–4 weeks per stage (SHADOW_ONLY through FLEET_WIDE = 4 stages = ~8–16 weeks)
- A platform with 100 enterprises rarely runs all of them through canary simultaneously

**Conservative canary scenario (10 enterprises in active canary, 50 screens each, 20% rollout):**
```
Screens in shadow mode: 10 × 50 × 20% = 100 screens
Parity records/day:     100 × 2,160 = 216,000
Storage/day:            216,000 × 2KB = ~432MB
Duration (16 weeks):    ~48GB total parity records per canary cohort
```

This is temporary storage — once the canary reaches AUTHORITATIVE and shadow mode ends, parity record generation stops. The accumulated parity records follow the same archival lifecycle as audit records.

**Budget impact:** During an active canary rollout, parity record generation adds ~30% to daily storage ingestion. This is a temporary, bounded cost. It does not change the steady-state infrastructure sizing.

---

## 9. Compliance Retention Cost Analysis

The 7-year compliance retention requirement for licensed venues is frequently cited as a concern. The actual cost is negligible:

### Licensed Gaming Venue Example (20 screens, 24h operation)

```
Records over 7 years:
  20 screens × 2,880 records/screen/day × 365 days × 7 years = 146.7M records

Storage before compression:
  146.7M × 1.5KB = ~213GB

In S3 Glacier Deep Archive (years 3–7 after 5:1 compression):
  213GB / 5 = ~43GB in Glacier Deep Archive
  Cost: 43GB × $0.00099/GB/month × 12 months/year = ~$0.51/year

In S3 Glacier Instant (years 1–3):
  ~$0.17/year per venue at this scale
```

**The 7-year compliance retention for a single gaming venue costs under $1/year in cold storage.**

This is the correct number to communicate to business stakeholders who are concerned about compliance storage costs. The cost argument against 7-year retention does not exist. The implementation complexity (separate S3 bucket, Glacier lifecycle policy, retrieval runbook) is the real cost.

---

## 10. Sizing Recommendations and Decision Points

### Start Here (Day 1 Infrastructure)

1. **Single PostgreSQL RDS instance:** `db.r6g.2xlarge` (64GB RAM, 2TB SSD gp3). Do not start with a larger instance — right-size based on observed query patterns, not projections.

2. **Partition `replay_audit_records` from day 1.** The partitioning DDL (DATABASE-ROLLOUT-PLAN.md Wave 5) must be in the initial migration. Retrofitting partitioning onto a populated table requires a full table rewrite. This is the highest-risk migration to defer.

3. **One read replica from day 1.** Proof-of-play reporting queries (sponsorship SOV verification) are read-intensive and should not compete with audit record writes. Set the read replica as the target for all reporting queries at the application level.

4. **Create the next 6 months of partitions in advance.** A partition creation job should run monthly and always stay 3–6 months ahead of the current month. A missing partition causes INSERT failures — not write slowdowns, actual failures.

### Scale Trigger Thresholds

| Metric | Threshold | Action |
|---|---|---|
| PostgreSQL storage utilization | >70% | Increase gp3 volume (online, no downtime) |
| PostgreSQL CPU sustained | >60% | Add read replica; profile slow queries |
| Monthly partition size | >50GB | Review index strategy; consider Citus |
| Total audit records | >1B | Begin shard planning |
| Read replica lag | >5s | Investigate write throughput; consider third replica |

### The Most Expensive Decision to Get Right Early

**Partitioning `replay_audit_records` from day 1** is the single most expensive mistake to defer. At 11.5M records/day at platform scale, the cumulative table will reach 1B rows within 90 days of full operation. Retrofitting monthly RANGE partitioning onto a 1B-row table is a multi-day maintenance event requiring table rebuilding, index recreation, and a maintenance window. Getting this wrong is not a performance problem — it is a planned outage problem. The DDL in DATABASE-ROLLOUT-PLAN.md table 20 must be in the initial schema, not a later migration.

The second most expensive decision: **not including `created_at` in the `replay_audit_records` primary key.** PostgreSQL requires the partition key to appear in any unique constraint on a partitioned table. If the initial schema uses `audit_record_id UUID PRIMARY KEY`, this must be changed to `PRIMARY KEY (audit_record_id, created_at)` before partitioning can be applied. Changing a primary key on a multi-billion row table requires a full table rewrite. Get this right in migration V1.
