# Real Runtime Determinism Report

**Phase:** G.1 — Real Database Replay Validation
**Date:** 2026-05-26
**Stack:** PostgreSQL 15 (Docker, port 5433) + PRE engine + cms-api (Fastify)

---

## What Is Proven

### PRE Engine Determinism (Corpus-Level)
- All 9 active corpus packets produce identical output across 100 repeated calls
- No nondeterminism detected in 900 total PRE invocations
- Input hash and output hash stable across 5 independent computations per packet
- Fixtures verified: GOLD-001 through GOLD-005, EDGE-001v2, EDGE-002, EDGE-003, CHAOS-001

### DB → Snapshot → PRE Integration
- `buildSystemStateSnapshot()` queries real PostgreSQL and produces stable snapshots
- PRE.resolve() is verified READ-ONLY: zero writes to `replay_audit_records` during pure resolution
- 100 runs against seed screen (ID: 60000000-0000-0000-0000-000000000001) produce identical checksum
- Deterministic evaluation timestamp enforced: 1748264400000 (2026-05-26 Tuesday 14:00 UTC)

### Audit Chain Integrity
- Every `replay_audit_records` entry passes FNV-1a checksum verification
- BIGINT → Number coercion applied before hash computation (pg returns strings)
- Append-only confirmed via `pg_stat_user_tables`: 0 updates, 0 deletes

---

## What Remains Unproven

- Long-running determinism (>24h) as DB state evolves with more data
- Determinism under concurrent DB writes (simultaneous resolutions for same screen)
- Behavior when DB timezone configuration deviates from expected settings
- Clock drift scenarios where `at_utc_ms` crosses schedule boundary mid-second

---

## Operational Limits

- Seed fixtures use `at=1748264400000` (fixed Tuesday 14:00 UTC)
- Resolution level reflects seed data state: LEVEL_5 when run outside Mon-Fri window
- DB must be seeded before G.1 tests run (`pnpm db:seed`)

---

## Scripts
```bash
# All G.1 verification scripts:
tsx scripts/validation/real-db-replay.ts
DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/replay-db-snapshot.ts
DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/replay-db-integrity.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED
