# API Determinism Report

**Phase:** G.2 — Real API Determinism Validation
**Date:** 2026-05-26
**Stack:** Fastify cms-api + PostgreSQL + PRE engine

---

## What Is Proven

### Request Storm Determinism
- 1000 identical GET /resolve/:screen_id requests in batches of 50
- All responses produce byte-identical `playlist_checksum`
- All responses produce byte-identical `resolution_level` and `is_fallback`
- JSON key ordering stable across all responses

### PREVIEW: Boundary Enforcement
- Production `/resolve` endpoint: `playlist_checksum` NEVER contains `PREVIEW:` prefix
- Preview `/preview` endpoint: `playlist_checksum` ALWAYS starts with `PREVIEW:`
- Prefix cannot be injected via query parameters (`?preview=true` has no effect)

### Response Self-Consistency
- Each response's `playlist_checksum` is independently computable from playlist items
- Checksum format enforced: exactly 8 lowercase hex characters
- `output_schema_version: "1.0.0"` present on every response
- `content_mix` values sum to 1.0 (±0.001 floating-point tolerance)

### Legitimately Variable Fields (Excluded From Hash)
- `correlation_id`: per-request random UUID, excluded from replay hash
- `at_utc_ms` (response timestamp): excluded from replay hash
- HTTP headers (`X-Correlation-Id` echo, timing headers)

---

## What Remains Unproven

- Determinism across different DB migration versions (schema changes)
- Response determinism under partial pool exhaustion (> max pool connections)
- Behavior when system clock changes between requests (NTP adjustment)

---

## Operational Limits

- API must be running: `JWT_VERIFY=false pnpm --filter cms-api dev`
- DB must be seeded before test run
- Results use fixed evaluation timestamp in seed data; vary by day-of-week

---

## Scripts
```bash
API_URL=http://localhost:3000 tsx scripts/validation/api-determinism.ts
API_URL=http://localhost:3000 tsx scripts/validation/response-hash-verifier.ts
API_URL=http://localhost:3000 tsx scripts/validation/serialization-order-check.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED
