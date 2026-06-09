# AUTHORITY_SURFACE_GUIDE.md
# Operator UI — Authority Surface Guide

## Overview

Every operator UI control that can trigger a governance mutation is an "authority surface."
This document maps each surface to its required role, consistency level, and blocking conditions.

## Role hierarchy

```
ADMIN
  └── OPERATOR
        └── VIEWER
```

Higher roles include all permissions of lower roles. Tokens are JWT-signed by OperatorAuthority.

## Authority surfaces by domain

### Freeze controls

| Control              | Route                           | Required role | Consistency   | Blocked when          |
|----------------------|---------------------------------|---------------|---------------|-----------------------|
| Freeze deployment    | POST /deployment/freeze         | OPERATOR      | LINEARIZED    | already frozen        |
| Unfreeze deployment  | POST /deployment/unfreeze       | ADMIN         | LINEARIZED    | not frozen            |
| Emergency freeze     | POST /deployment/freeze-local   | OPERATOR      | MEMORY_ONLY   | never (emergency)     |

**Notes:**
- Freeze is LINEARIZED — acquires `pg_advisory_xact_lock`. May take 1–5s under contention.
- Emergency freeze (`freezeLocal`) is MEMORY_ONLY — completes immediately. Must be followed by DB freeze on recovery.
- Unfreeze requires ADMIN — stricter than freeze to prevent accidental unfreeze under active incident.

### Wave promotion

| Control         | Route                      | Required role | Consistency | Blocked when                    |
|-----------------|----------------------------|---------------|-------------|---------------------------------|
| Promote wave    | POST /deployment/promote   | OPERATOR      | LINEARIZED  | frozen; replay mode; split-brain|
| Complete deploy | POST /deployment/complete  | OPERATOR      | DB_AUTH     | frozen; replay mode             |
| Rollback deploy | POST /deployment/rollback  | ADMIN         | LINEARIZED  | not in active deployment        |

### Incidents

| Control             | Route                            | Required role | Consistency  | Blocked when   |
|---------------------|----------------------------------|---------------|--------------|----------------|
| Create incident     | POST /incidents                  | OPERATOR      | DB_AUTH      | replay mode    |
| Transition incident | POST /incidents/:id/transition   | OPERATOR      | DB_AUTH      | replay mode    |
| Archive incident    | POST /incidents/:id/archive      | OPERATOR      | DB_AUTH      | replay mode    |

### Config mutations

| Control       | Route            | Required role | Consistency | Blocked when             |
|---------------|------------------|---------------|-------------|--------------------------|
| Update config | POST /config     | ADMIN         | LINEARIZED  | frozen; replay mode      |

### Read surfaces (no authority required beyond VIEWER)

| Surface              | Route                     | Consistency    |
|----------------------|---------------------------|----------------|
| Runtime status       | GET /runtime/status       | MEMORY_ONLY    |
| Runtime snapshot     | GET /runtime/snapshot     | MEMORY_ONLY    |
| Incidents list       | GET /incidents            | CACHE_COHERENT |
| Config read          | GET /config               | CACHE_COHERENT |
| Event stream         | GET /events/stream        | MEMORY_ONLY    |

## Blocking condition matrix

```
Condition         │ Freeze │ Unfreeze │ Promote │ Incident │ Config │
──────────────────┼────────┼──────────┼─────────┼──────────┼────────┤
frozen=true       │   ✗    │    ✓     │    ✗    │    ✗     │   ✗    │
replay_mode=true  │   ✗    │    ✗     │    ✗    │    ✗     │   ✗    │
split_brain=true  │   ✗    │    ✗     │    ✗    │    ✗     │   ✗    │
epoch_diverge     │   ✗    │    ✗     │    ✗    │    ✓     │   ✗    │
```

Legend: ✓ = allowed, ✗ = blocked

**HARD rule**: UI MUST check blocking conditions before enabling controls. Do not rely solely
on server-side 403 responses — controls should be visually disabled with a tooltip explaining
why. This prevents confusing error states for operators under pressure.

## Split-brain UI behavior

On receiving `governance.authority.split_brain` event:

1. Show **SPLIT-BRAIN ALERT** banner (CRITICAL severity)
2. Disable ALL mutation controls immediately
3. Display: "Mutations are blocked. Two nodes have divergent authority epochs. Manual operator resolution required."
4. Show the DB-authoritative epoch from the event payload
5. Do not re-enable controls until `split_brain = false` is confirmed via DB poll

## Token expiry handling

OPERATOR and ADMIN tokens expire. On receiving a 401 response:

1. Suppress the failed operation
2. Show "Session expired — please re-authenticate"
3. Redirect to login
4. Do NOT auto-retry the mutation

## Audit attribution

Every POST operation appends to the audit ledger with:
- `operator_id` from the verified token
- `action` describing the operation
- `timestamp` (deterministic_ts)
- `correlation_id` if provided

The operator UI should surface audit entries in a read-only log view (VIEWER accessible).

## See also

- `UI_STATE_MACHINE.md` — how blocking conditions drive UI state
- `EVENT_STREAM_MODEL.md` — events that trigger blocking condition changes
- platform-docs: `AUTHORITY_MODEL_GUIDE.md` — kernel-level authority contract
