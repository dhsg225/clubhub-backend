# CONSISTENCY_MODEL.md
# Governance Kernel v1 — Consistency Model

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23

---

## 1. Consistency level definitions

Every governance operation in the kernel declares exactly one consistency level.
The level is a contractual guarantee to callers.

| Level | Symbol | Guarantee | Staleness | HA Safe |
|-------|--------|-----------|-----------|---------|
| MEMORY_ONLY | M | In-process memory. Lost on restart. | May diverge between instances | reads: ✓, writes: advisory |
| CACHE_COHERENT | C | Refreshed from DB on startup and periodic sync. | < STALE_THRESHOLD_MS (120s) | advisory for writes |
| DB_AUTHORITATIVE | A | Direct DB read at call time. | None — reads current DB state | ✓ for reads |
| LINEARIZED | L | Advisory-lock-serialized write, DB commit confirmed before memory update. | None | ✓ for writes |

---

## 2. Per-operation consistency table

### Epoch management

| Operation | Level | Notes |
|-----------|-------|-------|
| `getEpoch()` | C | In-memory counter, loaded from DB at init |
| `incrementEpoch()` | L | `pg_advisory_xact_lock` + atomic `UPDATE RETURNING` |
| `getEpochFromDb(pool)` | A | Direct SELECT (not yet implemented in v1) |

### Freeze management

| Operation | Level | Notes |
|-----------|-------|-------|
| `isDeploymentFrozen()` | C | In-memory `_rolloutFrozen` flag |
| `getFreezeStateStrong(pool)` | A | Direct SELECT from governance_state |
| `freezeStrong(reason, pool)` | L | Advisory lock + DB write + memory update |
| `freezeLocal(reason)` | M | In-memory only (FAIL_CLOSED fallback) |
| `unfreezeDeployment(reason)` | M+async | Memory immediate; DB write fire-and-forget |
| `getFreezeEpoch()` | C | In-memory `_freezeEpoch` |

**Design note:** `unfreeze` is intentionally weaker than `freeze`. Freezing is fail-safe
(FAIL_CLOSED); unfreezing requires operator intent and may propagate asynchronously.

### Config management

| Operation | Level | Notes |
|-----------|-------|-------|
| `getThreshold(dotPath)` | M | In-memory `_config` |
| `requireThreshold(dotPath)` | M | Throws if undefined |
| `getThresholdSnapshot()` | M | Frozen copy + hash |
| `GovernedConfig.update()` | M+async | Memory immediate; DB persist fire-and-forget |
| `GovernedConfig.initFromDb()` | A | Loads latest config version from DB |

**Consistency gap:** Config updates are `M+async`. In active/active, a config change
on instance A is not immediately visible on instance B. Both instances will converge
after restart (via `initFromDb`). For critical threshold changes, operators should
ensure all instances restart or trigger a DB re-load.

### Incident management

| Operation | Level | Notes |
|-----------|-------|-------|
| `createIncident()` | M+async | Memory immediate; DB write fire-and-forget |
| `getIncident(id)` | M | In-memory map |
| `getActiveIncidents()` | M | In-memory map |
| `transition(id, ...)` | M | In-memory state machine |
| `transitionStrong(pool, id, ...)` | L | Advisory lock + version check |
| `archiveResolvedIncidents(pool)` | A | Direct DB write + memory cleanup |

### Audit ledger

| Operation | Level | Notes |
|-----------|-------|-------|
| `appendEntry(opts)` | M+async | Memory immediate; DB write fire-and-forget |
| `appendEntryLinearized(pool, opts)` | L | Advisory lock; correct hash chain across instances |
| `getEntries()` | M | In-memory ledger |
| `verifyIntegrity()` | M | In-memory hash chain verification |

**Consistency gap:** `appendEntry()` hash chain is `DETERMINISTIC_PER_INSTANCE` in active/active.
Two concurrent instances may produce divergent hash chains. Use `appendEntryLinearized()`
for cross-instance correctness.

### Cluster consensus / node tracking

| Operation | Level | Notes |
|-----------|-------|-------|
| `recordNodeHeartbeat(id, fields)` | C+async | Memory immediate; DB write fire-and-forget |
| `getStatus()` | M | In-memory node map analysis |
| `getSnapshot()` | M | Full in-memory state snapshot |

### Token / session management

| Operation | Level | Notes |
|-----------|-------|-------|
| `isRevoked(jti)` | M | O(1) in-memory Set lookup |
| `revokeToken(jti, opts)` | M+async | Memory immediate; DB write fire-and-forget |
| `initFromDb(pool)` | A | Loads revoked JTIs from DB |

**Consistency gap:** `isRevoked()` is MEMORY_ONLY loaded at startup. A JTI revoked on
instance A is not visible on instance B until B restarts or re-queries the DB.
This is advisory-only for mid-session revocations.

---

## 3. Consistency violation scenarios

### Scenario: Active/active freeze divergence

```
Instance A: freezeStrong(reason)  → DB: freeze=true, epoch=5 → memory: frozen=true
Instance B: isDeploymentFrozen()  → returns false (memory, not yet synced)
                                  ← CACHE_COHERENT staleness window: up to 120s
Instance B: isDeploymentFrozenStrong(pool) → returns true (DB read)
                                           ← correct
```

**Recommendation:** Safety-critical paths MUST use `isFrozenStrong()`.

### Scenario: Config divergence in active/active

```
Instance A: govConfig.update({ 'ota.min_success_rate': 0.99 }, ...)
            → DB: config_version=5, persisted
            → memory: _config updated
Instance B: getThreshold('ota.min_success_rate')
            → returns old value (memory, not synced)
            ← MEMORY_ONLY staleness: until next restart
```

**Recommendation:** Critical threshold changes should be followed by rolling restart,
or instances should call `govConfig.initFromDb(pool)` to re-sync.

### Scenario: JTI revocation propagation

```
Instance A: revokeToken(jti='abc123')
            → DB: revoked JTIs table updated
            → memory: _revokedJtis.add('abc123')
Instance B: isRevoked('abc123')
            → returns false (MEMORY_ONLY, loaded at startup)
            ← KNOWN GAP: mid-session revocations not propagated
```

**Mitigation:** Force restart of instance B, or add periodic DB re-query (not in v1).

---

## 4. Consistency level upgrade paths

Callers can always upgrade consistency by choosing the Strong variant:

| CACHE_COHERENT | → | DB_AUTHORITATIVE |
|---------------|---|-----------------|
| `isDeploymentFrozen()` | → | `getFreezeStateStrong(pool)` |
| `getEpoch()` | → | (not yet implemented — use `incrementEpoch()` as proxy) |

| MEMORY_ONLY | → | DB_AUTHORITATIVE |
|------------|---|-----------------|
| `isRevoked(jti)` | → | `pool.query('SELECT ... FROM operator_revoked_tokens WHERE jti = $1')` |
| `getThreshold(path)` | → | `govConfig.initFromDb(pool)` then `getThreshold(path)` |

---

## 5. DB failure behavior by operation

| Operation | DB failure behavior | Policy |
|-----------|---------------------|--------|
| `freezeStrong()` | FAIL_CLOSED — freeze in memory anyway | Configurable: FAIL_CLOSED default |
| `unfreezeDeployment()` | Proceeds (DB write is fire-and-forget) | Memory update always succeeds |
| `incrementEpoch()` | Throws — epoch increment is DB-authoritative | No fallback |
| `appendEntry()` | Silently drops DB persist; memory chain intact | Fire-and-forget |
| `appendEntryLinearized()` | Throws — linearized requires DB | No fallback |
| `revokeToken()` | Memory update succeeds; DB persist silently drops | Fire-and-forget |
| `transitionStrong()` | Throws | No fallback |
| Config `update()` | Memory update succeeds; DB persist silently drops | Fire-and-forget |

**DB_FREEZE_FAILURE_POLICY environment variable** controls `freezeStrong()` behavior:
- `FAIL_CLOSED` (default): freeze regardless of DB outcome
- `FAIL_OPEN`: abort freeze if DB fails (NOT recommended for production)
- `STALE_OK`: use last known freeze state

---

## 6. Consistency ceiling

The kernel's maximum consistency level is **LINEARIZED** on a single PostgreSQL primary.

It cannot achieve:
- **Serializability across multiple DB primaries** — no multi-region arbitration
- **External linearizability** — `pg_advisory_xact_lock` is scoped to one DB connection pool
- **Read-your-writes in active/active for CACHE_COHERENT paths** — instances may read stale memory

The consistency ceiling is a property of the DB adapter. A future `TiKVAdapter` or `CockroachAdapter`
could provide cross-region linearizability, but would require an API review for all LINEARIZED paths.

---

## 7. Consistency levels by governance subject

| Governance subject | Read | Write | Write authority |
|-------------------|------|-------|-----------------|
| Authority epoch | CACHE_COHERENT | LINEARIZED | ✓ |
| Freeze state | CACHE_COHERENT → DB_AUTH | LINEARIZED | ✓ |
| Config thresholds | MEMORY_ONLY | M+async | advisory |
| Incidents | MEMORY_ONLY | M+async → LINEARIZED | advisory → ✓ |
| Audit ledger | MEMORY_ONLY | M+async → LINEARIZED | advisory → ✓ |
| JTI revocation | MEMORY_ONLY | M+async | advisory (mid-session) |
| Node heartbeats | MEMORY_ONLY | M+async | advisory |
