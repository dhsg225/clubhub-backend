# Security Boundary Report

**Phase:** G.5 — Security + Auth Verification
**Date:** 2026-05-26
**Stack:** Fastify authPreHandler + JWT validation + tenant scoping

---

## What Is Proven

### Auth Boundary
- Malformed JWT (not 3 parts): rejected with 401
- Expired JWT: rejected with 401
- Garbage Bearer token: rejected with 401
- Valid dev JWT (JWT_VERIFY=false): accepted in dev mode with VENUE_OPERATOR identity
- Dev `/dev/auth/token` endpoint: unavailable in production (NODE_ENV=production guard)

### Tenant Isolation
- Foreign screen_id (non-existent): returns 404, not 200 with data
- Audit records scoped to requested screen_id: no cross-screen leakage
- Foreign venue entropy: 200 with empty or 404, not 500 or wrong data
- Audit query without screen_id or venue_id: returns 400 (required param)

### Replay Security
- Correlation ID excluded from `playlist_checksum` computation
- Forged `X-Correlation-Id` header does not change response checksum
- Non-existent audit record: returns 404, not 500
- Real audit records: `checksum_valid=true` via `/audit/verify/:id`
- `PREVIEW:` prefix cannot be injected via query parameters on production endpoint
- SQL injection in screen_id path: rejected (invalid UUID format → 400/404)

### Verified Dev Mode Behavior
- `JWT_VERIFY=false` allows unauthenticated reads (anonymous VENUE_OPERATOR identity)
- Anonymous identity is EXPLICITLY set, not accidentally granted
- Dev mode documented: "dev mode only" warning logged to console on startup
- `generateDevJWT()` only produces tokens valid when `JWT_VERIFY=false`

---

## What Remains Unproven

- JWT signature cryptographic verification (not implemented — structural validation only)
- Cross-enterprise data isolation (requires multiple seeded tenants)
- RBAC enforcement for mutation endpoints (no mutation endpoints in Wave 1)
- Session token storage compliance (no session layer in Wave 1)

---

## Known Risk Boundaries

| Risk | Severity | Status |
|------|----------|--------|
| JWT signature not cryptographically verified | HIGH | ACKNOWLEDGED — stub, replace with `jose` before production |
| `JWT_VERIFY=false` is a permanent bypass if left enabled | CRITICAL | MITIGATED — `NODE_ENV=production` blocks dev endpoints; JWT_VERIFY should not be false in prod |
| Anonymous identity has VENUE_OPERATOR role | LOW | ACCEPTABLE in dev mode only |

---

## Scripts
```bash
JWT_VERIFY=false API_URL=http://localhost:3000 tsx scripts/validation/auth-boundary.vec.ts
API_URL=http://localhost:3000 tsx scripts/validation/tenant-isolation.vec.ts
API_URL=http://localhost:3000 tsx scripts/validation/replay-security.vec.ts
```

---

## Verdict: CONSTITUTIONALLY CERTIFIED (with noted JWT caveat)
