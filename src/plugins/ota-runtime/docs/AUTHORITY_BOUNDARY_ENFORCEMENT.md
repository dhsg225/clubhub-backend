# AUTHORITY_BOUNDARY_ENFORCEMENT.md
# OTA Runtime — Authority Boundary Enforcement

**Phase:** A3
**Effective:** 2026-05-24

---

## Authority boundary definition

The OTA runtime sits at the boundary between:

```
Application layer (OTA routes, external callers)
         ↓
OTA Runtime boundary ← this document
         ↓
Governance Kernel APIs (api/*.js)
         ↓
Governance primitives (core/*.js)
         ↓
PostgreSQL (single authoritative primary)
```

**Rule:** OTA runtime modules MUST NOT cross the boundary downward more than one level. All access to governance primitives must go through kernel API classes.

---

## Boundary violations (hard failures)

### FV-1: Direct core/ import
**Violation:** Any `require('...governance-kernel/core/...')` in ota-runtime/
**Certified by:** AuthorityBypassCertification ABC-06
**Why:** Core primitives have no authority enforcement layer. Direct access bypasses consistency level guarantees and audit attribution.

### FV-2: Direct lib/governed-config import
**Violation:** Any `require('...lib/governed-config...')` in ota-runtime/
**Certified by:** AuthorityBypassCertification ABC-01
**Why:** lib/governed-config is a singleton from before kernel extraction. Using it directly bypasses ConfigAuthority's hash chain and audit ledger integration.

### FV-3: Direct lib/governed-clock import
**Violation:** Any `require('...lib/governed-clock...')` in ota-runtime/
**Certified by:** AuthorityBypassCertification ABC-02
**Why:** Clock must be injected by kernel. Direct lib/ import bypasses DeterministicClock's replay mode behavior.

### FV-4: pg.Pool creation in runtime
**Violation:** `new Pool(...)` or `new pg.Pool(...)` in ota-runtime/
**Certified by:** AuthorityBypassCertification ABC-03
**Why:** Pool ownership belongs to application bootstrap layer. Runtime modules receive pool as a dependency for LINEARIZED operations — they do not own the pool.

### FV-5: Direct epoch increment
**Violation:** Calling epoch manipulation without AuthorityCoordinator
**Certified by:** AuthorityBypassCertification ABC-05
**Why:** Epoch increment must use advisory lock (`pg_advisory_xact_lock`) for LINEARIZED consistency. Direct core call would bypass lock acquisition.

### FV-6: Direct freeze without FreezeController
**Violation:** Calling freeze without FreezeController
**Certified by:** AuthorityBypassCertification ABC-04
**Why:** FreezeController encapsulates FAIL_CLOSED policy. Direct core calls bypass the configured DB failure policy.

---

## Emergency freeze path

The only documented exception to the "no direct core access" rule:

```javascript
governedDeployment.freezeLocal(reason, opts)
```

This calls `FreezeController.freezeLocal(reason)` — which IS a FreezeController call, not a direct core call. The `freezeLocal()` is MEMORY_ONLY and documented as:

> MEMORY_ONLY: used only on DB-unreachable + critical failure.
> Must be followed by freezeDeployment() as soon as DB becomes available.

Emergency freezes are logged to `_emergencyFreezeLog` and appended to AuditLedger.

---

## Role enforcement boundary

All OTA routes that mutate state require role gating:

| Route | Minimum role |
|-------|-------------|
| GET /runtime/status | VIEWER |
| GET /runtime/snapshot | OPERATOR |
| POST /deployment/promote | OPERATOR |
| POST /deployment/freeze | OPERATOR |
| POST /deployment/unfreeze | **ADMIN** |
| POST /deployment/rollback | **ADMIN** |
| POST /deployment/complete | OPERATOR |
| GET /incidents | VIEWER |
| POST /incidents | OPERATOR |
| POST /incidents/:id/transition | OPERATOR |
| POST /incidents/:id/archive | OPERATOR |
| GET /config | VIEWER |
| POST /config | **ADMIN** |

Role enforcement is done server-side by `OperatorAuthority.requireAuth(role)`. Client-side role gating (operator-ui) is advisory only.

---

## Audit attribution guarantee

Every operator mutation through OTA runtime routes appends to AuditLedger with:
- `action_type` (specific action)
- `operator_id` (from verified token)
- `justification` (required by API contract)

This is certified by GovernedRoutingCertification GRC-07: `appendAction` called on every POST route.

For LINEARIZED operations (freeze, rollback), `appendLinearized(pool, opts)` may be used to ensure the ledger entry is co-committed with the DB advisory lock.

---

## Certification matrix

| Boundary check | Certification | Check ID |
|----------------|--------------|----------|
| No core/ imports | AuthorityBypassCertification | ABC-06 |
| No lib/governed-config | AuthorityBypassCertification | ABC-01 |
| No lib/governed-clock | AuthorityBypassCertification | ABC-02 |
| No pg.Pool creation | AuthorityBypassCertification | ABC-03 |
| FreezeController used for freeze | AuthorityBypassCertification | ABC-04 |
| AuthorityCoordinator used for epoch | AuthorityBypassCertification | ABC-05 |
| No DB pool in deployment-runtime | AuthorityBypassCertification | ABC-07 |
| replay-hooks has no kernel imports | AuthorityBypassCertification | ABC-08 |
| RequireAuth on all POST routes | GovernedRoutingCertification | GRC-01 |
| appendAction on all POST routes | GovernedRoutingCertification | GRC-07 |
| No lib/ imports in routes | GovernedRoutingCertification | GRC-02 |
