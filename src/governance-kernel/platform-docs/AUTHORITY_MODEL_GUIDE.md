# AUTHORITY_MODEL_GUIDE.md
# Governance Kernel — Authority Model Guide

---

## Authority hierarchy

```
┌─────────────────────────────────────────┐
│  PostgreSQL (single primary)            │  ← LINEARIZED authority source
│    pg_advisory_xact_lock                │
├─────────────────────────────────────────┤
│  Governance Kernel (per node)           │  ← DB_AUTHORITATIVE reads
│    AuthorityCoordinator                 │
│    FreezeController                     │
│    IncidentManager                      │
├─────────────────────────────────────────┤
│  In-memory state (per node, volatile)   │  ← CACHE_COHERENT / MEMORY_ONLY
│    epoch cache, freeze flag, incidents  │
├─────────────────────────────────────────┤
│  Application / Plugin layer             │  ← consumer only
│    OTA runtime, operator-ui             │
└─────────────────────────────────────────┘
```

---

## Authority sources

| Source | Level | Durability | Example |
|--------|-------|------------|---------|
| SNAPSHOT | DB_AUTHORITATIVE | Persisted | Freeze state at startup |
| EVENT | CACHE_COHERENT | Persisted (async) | Epoch increment event |
| REPLAY | Deterministic | Derived | Historical event playback |
| OPTIMISTIC | — | INTENTIONALLY ABSENT | Never used |

**Why OPTIMISTIC is absent:** LINEARIZED operations (freeze, epoch increment) require DB confirmation before the state is authoritative. Optimistic updates would present false confidence to operators.

---

## Consistency levels — detailed

### MEMORY_ONLY
- Lost on process restart
- Not shared across nodes
- Valid uses: session cache, in-flight request state, emergency freeze flag
- **HARD guarantee:** No durability. Do not rely on MEMORY_ONLY state surviving restart.

### CACHE_COHERENT
- Reflected in DB eventually (< STALE_THRESHOLD_MS = 120s)
- May diverge between nodes momentarily
- Valid uses: epoch reads, config reads between updates
- **SOFT guarantee:** Converges within threshold when DB is reachable.

### DB_AUTHORITATIVE
- Reads directly from PostgreSQL
- Authoritative for the node at read time
- Valid uses: freeze state verification, incident count checks
- **HARD guarantee:** Reflects DB state at the moment of the read. Not a future guarantee.

### LINEARIZED
- Serialized via `pg_advisory_xact_lock`
- Total order across all cluster nodes
- Valid uses: epoch increment, strong freeze, audit ledger commit
- **HARD guarantee:** No two nodes can execute a LINEARIZED operation simultaneously for the same resource.
- **ADVISORY:** If DB is unreachable, LINEARIZED operations fail. Use `freezeLocal()` as MEMORY_ONLY fallback.

---

## Operator authority model

### Roles

| Role | Level | Capabilities |
|------|-------|-------------|
| ADMIN | 3 | All operations including unfreeze, config update, key rotation |
| OPERATOR | 2 | Deployment ops, incident management, token issuance |
| VIEWER | 1 | Read-only access to all surfaces |

### Token format

```
base64url(JSON payload) + "." + HMAC-SHA256 signature
Payload: { v, oid, role, iat, exp, jti }
```

Tokens are HMAC-SHA256 signed with `OPERATOR_SECRET_KEY`.
JTI revocation is stored in DB and checked on every `verifyToken()` call.

### Attribution requirement

Every mutating operation must carry `operator_id` and `justification`. Operations without attribution are rejected by:
- `ConfigAuthority.update()` (throws without justification)
- `AuditLedger.appendEntry()` (accepts null operator_id but records null — creates audit gap)

---

## Authority confidence scoring

Used by operator UI for visual trust indicators:

| Score | Condition | Display |
|-------|-----------|---------|
| HIGH | LINEARIZED or DB_AUTHORITATIVE, < 5s stale | Green, lock icon |
| MEDIUM | CACHE_COHERENT, < 120s stale | Yellow |
| LOW | CACHE_COHERENT, > 120s stale | Orange |
| UNKNOWN | No authority source | Grey |
| DIVERGED | SPLIT_BRAIN detected | Red, warning |

---

## Split-brain semantics

Split-brain occurs when two nodes report divergent `authority_epoch` or `freeze_state`. The kernel does NOT automatically resolve split-brain. When detected:

1. UI disables all mutations (`selectCanSubmitMutations()` returns false)
2. Operator must perform DB-authoritative check (`isFrozenStrong(pool)`)
3. Operator confirms via `clearSplitBrain()` + snapshot refetch

**HARD guarantee:** Mutations remain blocked until operator explicitly clears split-brain.
**ADVISORY:** Automated split-brain resolution is planned for v3 (consensus-driven).
