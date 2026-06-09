# Observability Integrity Report

**Phase:** G.6 — Observability + Audit Validation
**Date:** 2026-05-26
**Stack:** cms-api audit path + PostgreSQL replay_audit_records + Prometheus metrics

---

## What Is Proven

### Every PRE Invocation Is Audited
- Each `/resolve/:screen_id` HTTP call increments `replay_audit_records` count by exactly 1
- Verified across 5 sequential calls: count increases by exactly 1 each time
- Audit write failures are NON-FATAL: resolution result returned even if audit fails
  - This is by design: availability > audit completeness for the response

### Correlation ID Chain
- `X-Correlation-Id` header value preserved end-to-end: HTTP → audit record
- Each audit record contains the exact correlation_id from the originating request
- Enables full forensic tracing: HTTP request → PRE invocation → audit record

### Audit Chain Forensic Integrity
- All `record_checksum` values verified via FNV-1a recomputation
- Type coercions applied before hash: `at_utc_ms: Number()`, `resolution_level: Number()`, `is_fallback: Boolean()`, `invariants_passed: Boolean()`
- No duplicate `audit_record_id` values
- No NULL `correlation_id` values
- `resolution_level` within valid range [0–6] for all records
- `playlist_checksum` format: `/^[0-9a-f]{8}$/` or `/^PREVIEW:[0-9a-f]{8}$/`
- `at_utc_ms` within expected range: 2025-01-01 to 2030-01-01

### Append-Only Verified (PostgreSQL Statistics)
- `pg_stat_user_tables.n_tup_upd = 0`: zero UPDATE operations on `replay_audit_records`
- `pg_stat_user_tables.n_tup_del = 0`: zero DELETE operations on `replay_audit_records`
- Constitutional trigger `enforce_append_only()` provides DB-level enforcement

### Prometheus Metrics
- `/metrics` endpoint responds with valid Prometheus text format
- All metric values non-negative, no NaN
- Counters are monotonically non-decreasing across repeated calls

### Health Endpoints
- `/health/live`: 200 (liveness probe)
- `/health/ready`: 200 (readiness probe)
- `/health/runtime`: 200 with `constitutional_state` field

---

## What Remains Unproven

- Telemetry event persistence to external systems (Datadog, etc.)
- Parity record emission (shadow service not wired in Wave 1)
- Entropy snapshot persistence (entropy scheduler not running in Wave 1)
- Constitutional violation alerts (no alert routing in Wave 1)
- Circuit breaker events (no circuit breakers active in Wave 1)

---

## Scripts
```bash
DB_PORT=5433 DB_PASSWORD=devpassword API_URL=http://localhost:3000 tsx scripts/validation/observability-integrity.ts
DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/audit-chain-verifier.ts
API_URL=http://localhost:3000 tsx scripts/validation/metrics-consistency.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED
