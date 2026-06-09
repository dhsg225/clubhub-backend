# CAPACITY MODEL

**Version:** 1.0.0
**Status:** ENFORCED
**Authority:** Defines capacity projections, scaling breakpoints, and economic risk
thresholds for ClubHub TV at 10, 100, 1,000, and 10,000 screen deployments.
All calculations derive from current system constants. Governed values are in
`test-config/capacity.json`.

---

## 0. ASSUMPTIONS AND CONSTANTS

All projections use these values derived from the existing codebase:

| Constant | Value | Source |
|----------|-------|--------|
| Poll interval | 15,000ms | `simulator/fake-pi.js:21` |
| Polls per minute per screen | 4 | 60,000 / 15,000 |
| Manifest response size | 2KB (median est.) | JSON manifest with ~10 schedule items |
| Read rate limit | 120 req/min per IP | `rateLimiter.js:53` |
| Screens per IP at rate limit | 30 | 120 / 4 |
| Backend request timeout | 10,000ms | `timeout.js:15` |
| Log line size | 200 bytes | Structured JSON with required fields |
| Log lines per screen per minute | 5 | 1 poll event + 4 status/debug lines |
| OTA image size | 20MB (est. Pi firmware) | Estimate; varies by build |
| Manifest cache row size | 5KB | JSON + metadata per screen |
| DB connection pool (default pg) | 10 connections | Node pg default |

---

## 1. POLLING AMPLIFICATION

All screens poll independently on a 15s cycle. Aggregate request rate is linear.

| Screens | Polls/min | Polls/hour | Polls/day |
|---------|-----------|------------|-----------|
| 10 | 40 | 2,400 | 57,600 |
| 100 | 400 | 24,000 | 576,000 |
| 1,000 | 4,000 | 240,000 | 5,760,000 |
| 10,000 | 40,000 | 2,400,000 | 57,600,000 |

**Rate limit constraint:** At 120 req/min read limit, a single IP saturates at
30 screens. Venues with > 30 screens behind a single NAT will hit rate limits.
This is documented in SYSTEM_CONTRACTS §8 and is the primary small-scale constraint.

---

## 2. BANDWIDTH

Outbound from backend. Inbound from Pi is negligible (~200 bytes per poll request).

| Screens | Bandwidth/min | Bandwidth/hour | Bandwidth/day |
|---------|--------------|----------------|--------------|
| 10 | 80 KB | 4.8 MB | 115 MB |
| 100 | 800 KB | 48 MB | 1.15 GB |
| 1,000 | 8 MB | 480 MB | 11.5 GB |
| 10,000 | 80 MB | 4.8 GB | 115 GB |

**Notes:**
- Cache hit rate 80% reduces unique manifest computations but does NOT reduce
  bandwidth — the manifest is still transmitted even on a cache hit.
- OTA traffic is additional to poll traffic (see §4).
- At 1,000+ screens, bandwidth cost becomes a meaningful operating expense.
  115 GB/day at $0.09/GB egress = **$10.35/day or $3,778/year** at 1,000 screens.

---

## 3. DATABASE GROWTH

### 3.1 manifest_cache Table

| Screens | Cache table size | Write rate |
|---------|-----------------|-----------|
| 10 | 50 KB | 40 writes/min (one per poll, upsert) |
| 100 | 500 KB | 400 writes/min |
| 1,000 | 5 MB | 4,000 writes/min = 67 writes/sec |
| 10,000 | 50 MB | 40,000 writes/min = 667 writes/sec |

**DB bottleneck: 667 writes/sec approaches single Postgres write capacity.**
Postgres can sustain ~2,000–5,000 simple upserts/sec on commodity hardware.
At 10,000 screens: monitor for lock contention on manifest_cache.

Cache hit rate mitigates this: at 80% hit rate, only 20% of polls trigger a
manifest_cache upsert. Effective write rate at 10,000 screens:
667 × 0.20 = **134 writes/sec** — sustainable on a single Postgres instance.

### 3.2 Content and Schedules Tables

These are operator-driven and bounded by human action rate. Not a scaling concern
at any realistic screen count.

### 3.3 DB Connection Pool Pressure

| Screens | DB queries/sec (no cache) | Effective (80% cache) |
|---------|--------------------------|----------------------|
| 10 | 0.67 | 0.13 |
| 100 | 6.67 | 1.33 |
| 1,000 | 66.7 | 13.3 |
| 10,000 | 666.7 | 133 |

Default pg pool size: 10 connections.
At 1,000 screens with 80% cache: 13.3 queries/sec, avg latency ~5ms → pool sufficient.
At 10,000 screens with 80% cache: 133 queries/sec → **pool exhaustion risk.**
Scale action: increase `PG_POOL_SIZE` to 50 before 5,000-screen deployment.

---

## 4. OTA TRAFFIC

One OTA update per screen per release. OTA traffic is a one-time spike, not continuous.

| Screens | Traffic per OTA update | Duration at 10 Mbps uplink |
|---------|----------------------|--------------------------|
| 10 | 200 MB | 160 seconds |
| 100 | 2 GB | 26 minutes |
| 1,000 | 20 GB | 4.4 hours |
| 10,000 | 200 GB | 44 hours |

**Critical observation:** At 1,000+ screens, a staged rollout (rings of 30%, 70%, 100%)
is not just governance — it is a **throughput necessity**. Pushing to 10,000 screens
simultaneously over a single server uplink is not feasible.

Ring-staged OTA traffic:
- Ring 1 (30%): 60 GB at 1,000 screens → 13.3 hours at 10 Mbps
- Using a CDN or S3 pre-signed URLs for OTA packages is required at 1,000+ screens.

---

## 5. LOG GROWTH

| Screens | Log/min | Log/day | Log/72h (forensic window) |
|---------|---------|---------|--------------------------|
| 10 | 10 KB | 14 MB | 43 MB |
| 100 | 100 KB | 144 MB | 432 MB |
| 1,000 | 1 MB | 1.44 GB | 4.3 GB |
| 10,000 | 10 MB | 14.4 GB | 43.2 GB |

**Log rotation constraint:** Current production compose limits to 100MB × 10 files
= 1GB total log retention. This covers:
- 10 screens: 72 days (adequate)
- 100 screens: 7 days (marginally adequate)
- 1,000 screens: 17 hours (BELOW 72h forensic requirement)

**Scale action required at 100+ screens:** External log aggregation before
100-screen deployment. This is a contractual requirement per OBSERVABILITY.md §4.3.

---

## 6. SCALING BREAKPOINTS

These are the inflection points where the current architecture requires a change
before scale-out is safe.

| Breakpoint | Screen Count | Bottleneck | Required Action |
|------------|-------------|-----------|----------------|
| BP1 | 30 screens per venue NAT | Rate limit per IP | Configure per-screen IP or increase read limit with contract amendment |
| BP2 | ~150 screens | DB connection pool (default 10, no cache) | Increase `PG_POOL_SIZE` to 25 |
| BP3 | ~500 screens | Log forensic coverage < 72h | Deploy external log aggregation |
| BP4 | ~1,000 screens | OTA traffic via single server | CDN or object storage for OTA packages |
| BP5 | ~2,000 screens | manifest_cache write volume | Consider cache TTL tuning or Redis cache layer |
| BP6 | ~5,000 screens | Single backend process concurrency | Add second backend instance behind Caddy load balancer |
| BP7 | ~10,000 screens | Single Postgres write capacity | Read replica for manifest queries; primary for writes only |

**BP1 is the only currently active constraint.** All others are projections based
on linear extrapolation. Actual breakpoints depend on hardware, network topology,
and content update frequency.

---

## 7. OPERATIONAL STAFFING PRESSURE

Human time required to operate the platform grows super-linearly due to incident
management, not proportionally.

| Screen Count | Estimated Operational Load | Staffing Model |
|-------------|---------------------------|---------------|
| 1–10 | < 1 hour/week | Founder/developer, no dedicated ops |
| 10–50 | 1–4 hours/week | Part-time developer handles ops |
| 50–200 | 2–8 hours/week | Dedicated on-call rotation begins |
| 200–1,000 | 0.5–1 FTE | Dedicated operations engineer |
| 1,000–5,000 | 1–2 FTE | Ops engineer + on-call rotation |
| 5,000–10,000 | 2–4 FTE | SRE team; 24×7 coverage; automation critical |

**Driver:** Incident rate grows with screen count. At 0.1% daily incident rate
(1 screen failure per 1000 per day), 1,000 screens → 1 incident/day. 10,000 screens
→ 10 incidents/day. Each incident requires 30–120 minutes to diagnose and resolve.

---

## 8. ECONOMIC RISK THRESHOLDS

These are not operating costs — they are the points at which the cost of a failure
exceeds the cost of the mitigation.

| Risk | Threshold | Mitigation Cost | Incident Cost Estimate |
|------|----------|----------------|----------------------|
| Single server failure (all screens dark) | > 100 screens | $50/month HA instance | $500–$5,000/incident (venue contracts) |
| DB data loss | > 10 screens | $10/month automated backup | Data loss unrecoverable; catastrophic |
| OTA brick (all screens) | > 50 screens | Ring governance (no cost) | $5,000–$50,000 (venue emergency response) |
| Log data loss (forensic gap) | > 100 screens | $20/month log service | Compliance exposure + incident resolution delay |
| SD card batch failure | > 20 screens (same batch) | Spare inventory | $50–$200 per screen hardware replacement |

**Risk-adjusted investment rule:** Any mitigation whose monthly cost is < 1% of
the incident cost at the current fleet size is justified without further analysis.

---

## 9. ECONOMIC PROJECTIONS BY DEPLOYMENT SIZE

| Size | Monthly Infra Cost (est.) | Monthly Op Cost (est.) | Total/Screen/Month |
|------|--------------------------|----------------------|-------------------|
| 10 screens | $20 (single VPS) | $0 (developer) | $2.00 |
| 100 screens | $50 (VPS + log service) | $200 (0.1 FTE) | $2.50 |
| 1,000 screens | $300 (larger VPS + CDN) | $3,000 (0.5 FTE) | $3.30 |
| 10,000 screens | $2,000 (multi-instance + CDN + log) | $15,000 (2 FTE) | $1.70 |

**Unit economics improve at scale** once infrastructure is shared across screens.
The 1,000-screen deployment is the most expensive per-screen due to staffing cost
growth preceding infrastructure automation.

---

## 10. GOVERNED CAPACITY THRESHOLDS

The following values are in `test-config/capacity.json` and MUST be reviewed before
any deployment that crosses a breakpoint:

```json
{
  "breakpoints": {
    "rate_limit_screens_per_ip": 30,
    "db_pool_exhaustion_screens": 150,
    "log_forensic_gap_screens": 100,
    "ota_cdn_required_screens": 1000,
    "cache_tuning_required_screens": 2000,
    "backend_scale_out_screens": 5000,
    "db_read_replica_screens": 10000
  },
  "projections": {
    "manifest_size_bytes": 2048,
    "log_line_bytes": 200,
    "log_lines_per_screen_per_min": 5,
    "ota_image_bytes": 20971520,
    "manifest_cache_row_bytes": 5120,
    "db_pool_default_size": 10
  }
}
```

Any update to these values requires review of CAPACITY_MODEL.md §6 and §8.
Updates follow the same evidence-based process as thresholds.json (SYSTEM_CONTRACTS §3.4).

---

## 11. INTERACTION WITH OTHER MATURITY DOCUMENTS

| Document | Interaction |
|----------|-------------|
| OBSERVABILITY.md | Log growth projections determine retention requirements (§4.3) |
| OTA_GOVERNANCE.md | OTA traffic per ring uses §4 projections |
| SECURITY_MODEL.md | Token validation adds < 1ms per poll; negligible at any scale |
| CLUBHUB_STATE_AUTHORITY.md | Tier 2 write amplification drives BP5 and BP7 |
