# API_STABILITY_MATRIX.md
# Governance Kernel v1 — API Stability Classification

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23

## Stability classes

| Class | Meaning |
|-------|---------|
| **IMMUTABLE** | Signature, semantics, and guarantees cannot change in v1.x. Breaking requires v2. |
| **EVOLVABLE** | Signature may gain optional parameters. Semantics are stable. Behavior additions allowed. |
| **EXPERIMENTAL** | May change in any v1.x minor. No compatibility guarantee. |
| **INTERNAL_ONLY** | Not for consumer use. May change without notice. Prefixed `_`. |
| **DEPRECATED** | Will be removed. Use documented replacement. |

## Consistency level definitions

| Level | Guarantee |
|-------|-----------|
| MEMORY_ONLY | Value reflects in-process memory. Lost on restart. May differ between instances. |
| CACHE_COHERENT | Value reflects DB at last sync (< STALE_THRESHOLD_MS). May be slightly stale in active/active. |
| DB_AUTHORITATIVE | Single authoritative DB read. Correct across all instances at call time. |
| LINEARIZED | Serialized via `pg_advisory_xact_lock`. Correct and ordered across all instances. |

## Persistence levels

| Level | Meaning |
|-------|---------|
| NONE | Lost on process restart |
| DB_ASYNC | Written to DB fire-and-forget (non-fatal if fails) |
| DB_SYNC | Written to DB before returning; failure throws |
| DB_LINEARIZED | Written under advisory lock before returning |

---

## GovernanceKernel (api/GovernanceKernel.js)

| Method | Stability | Determinism | Authority | Replayability | HA Safe | Persistence |
|--------|-----------|-------------|-----------|---------------|---------|-------------|
| `constructor(opts)` | IMMUTABLE | n/a | n/a | n/a | ✓ | NONE |
| `init(pool, opts?)` | IMMUTABLE | n/a | n/a | not replayable | ✓ | DB_SYNC |
| `recover(pool?)` | IMMUTABLE | n/a | LINEARIZED | not replayable | ✓ | DB_LINEARIZED |
| `snapshot()` | IMMUTABLE | DETERMINISTIC_PER_DB | CACHE_COHERENT | ✓ replayable | ✓ | NONE |
| `replay(events, opts?)` | IMMUTABLE | CONTENT_ADDRESSED | n/a (frozen) | ✓ replayable | single node only | NONE |
| `freeze(reason, pool?)` | IMMUTABLE | n/a | LINEARIZED | not replayable | ✓ | DB_LINEARIZED |
| `unfreeze(reason)` | EVOLVABLE | n/a | MEMORY_ONLY | not replayable | advisory | NONE |
| `certify(opts?)` | EVOLVABLE | n/a | n/a | n/a | ✓ | DB_ASYNC |
| `shutdown()` | EVOLVABLE | n/a | n/a | n/a | ✓ | NONE |
| `CONSISTENCY_LEVELS` (getter) | IMMUTABLE | n/a | n/a | n/a | ✓ | NONE |
| `REPLAY_MODES` (getter) | IMMUTABLE | n/a | n/a | n/a | ✓ | NONE |

**Forbidden mutations to GovernanceKernel:**
- Cannot add a `domain` parameter to `freeze()` — freeze is cluster-wide in v1
- Cannot make `init()` idempotent without versioning the semantics — currently errors on double-init
- Cannot make `replay()` emit DB writes — breaks Replay Law R1

---

## AuthorityCoordinator (api/AuthorityCoordinator.js)

| Method | Stability | Determinism | Consistency | Replayability | HA Safe |
|--------|-----------|-------------|-------------|---------------|---------|
| `incrementEpoch()` | IMMUTABLE | DETERMINISTIC_PER_DB | LINEARIZED | not replayable | ✓ |
| `getEpoch()` | IMMUTABLE | DETERMINISTIC_PER_DB | CACHE_COHERENT | ✓ | ✓ |
| `isDeploymentFrozen()` | IMMUTABLE | n/a | CACHE_COHERENT | ✓ | advisory |
| `isDeploymentFrozenStrong(pool)` | IMMUTABLE | n/a | DB_AUTHORITATIVE | not replayable | ✓ |
| `freezeStrong(reason, pool)` | IMMUTABLE | n/a | LINEARIZED | not replayable | ✓ |
| `unfreezeDeployment(reason)` | EVOLVABLE | n/a | MEMORY_ONLY | not replayable | advisory |
| `getClusterStatus()` | EVOLVABLE | n/a | MEMORY_ONLY | ✓ | ✓ |
| `recordNodeHeartbeat(nodeId, fields)` | EVOLVABLE | n/a | DB_AUTHORITATIVE | ✓ | ✓ |
| `isLeaseHolder()` | EXPERIMENTAL | n/a | CACHE_COHERENT | n/a | advisory |

**Note on `isDeploymentFrozen()` vs `isDeploymentFrozenStrong(pool)`:**
These are intentionally two separate methods. Do not unify them. The naming distinction
is the contract: callers that need authority MUST use Strong.

---

## FreezeController (api/FreezeController.js)

| Method | Stability | Consistency | Replayability | HA Safe |
|--------|-----------|-------------|---------------|---------|
| `constructor(opts?)` | IMMUTABLE | n/a | n/a | ✓ |
| `freeze(reason, pool)` | IMMUTABLE | LINEARIZED | not replayable | ✓ |
| `freezeLocal(reason)` | EVOLVABLE | MEMORY_ONLY | not replayable | advisory |
| `unfreeze(reason)` | EVOLVABLE | MEMORY_ONLY | not replayable | advisory |
| `isFrozen()` | IMMUTABLE | CACHE_COHERENT | ✓ | advisory |
| `isFrozenStrong(pool)` | IMMUTABLE | DB_AUTHORITATIVE | not replayable | ✓ |
| `getFreezeEpoch()` | EVOLVABLE | CACHE_COHERENT | ✓ | advisory |
| `DB_FAILURE_POLICIES` (getter) | IMMUTABLE | n/a | n/a | ✓ |

**Forbidden mutations to FreezeController:**
- `DB_FAILURE_POLICIES` values cannot be renamed (FAIL_CLOSED, FAIL_OPEN, STALE_OK are stable strings)
- Default policy MUST remain FAIL_CLOSED — changing to FAIL_OPEN would violate Freeze Law F1

---

## LineageEngine (api/LineageEngine.js)

| Method | Stability | Determinism | Consistency | Replayability |
|--------|-----------|-------------|-------------|---------------|
| `withLineage(fields, ctx)` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ |
| `verifyLineage(events, opts?)` | EVOLVABLE | n/a | MEMORY_ONLY | ✓ |
| `exportLineage(dir)` | EXPERIMENTAL | n/a | MEMORY_ONLY | n/a |
| `MODES` (getter) | IMMUTABLE | n/a | n/a | n/a |
| `ANOMALY` (getter) | IMMUTABLE | n/a | n/a | n/a |

**MODES values are frozen:** STRICT / REPORT / REPLAY cannot be renamed.
**ANOMALY values are frozen:** ORPHANED_EVENT / BROKEN_CAUSAL_CHAIN / CROSS_INCIDENT_CONTAMINATION / MISSING_AUTHORITY_CONTEXT / DUPLICATE_CORRELATION cannot be renamed.

---

## ConfigAuthority (api/ConfigAuthority.js)

| Method | Stability | Determinism | Consistency | Replayability | Persistence |
|--------|-----------|-------------|-------------|---------------|-------------|
| `get(dotPath)` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | NONE |
| `require(dotPath)` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | NONE |
| `snapshot()` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | NONE |
| `version()` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | NONE |
| `update(changes, opts)` | IMMUTABLE | n/a | DB_ASYNC | not replayable | DB_ASYNC |
| `getAll()` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | NONE |
| `freeze()` | EVOLVABLE | n/a | MEMORY_ONLY | not replayable | NONE |
| `unfreeze()` | EVOLVABLE | n/a | MEMORY_ONLY | not replayable | NONE |
| `isFrozen()` | EVOLVABLE | n/a | MEMORY_ONLY | ✓ | NONE |

**`update()` MUST always receive `opts.justification`** — omission throws. This is immutable behavior.

---

## OperatorAuthority (api/OperatorAuthority.js)

| Method | Stability | Determinism | Replayability | Notes |
|--------|-----------|-------------|---------------|-------|
| `issueToken(id, role, opts?)` | IMMUTABLE | NONDETERMINISTIC | not replayable | iat/exp are wall-clock |
| `verifyToken(token)` | IMMUTABLE | n/a | ✓ (read-only) | timingSafeEqual mandatory |
| `requireAuth(role?)` | IMMUTABLE | n/a | n/a | Express middleware factory |
| `revokeToken(jti, opts)` | IMMUTABLE | n/a | not replayable | DB write |
| `revokeOperator(id, opts)` | EVOLVABLE | n/a | not replayable | DB write |
| `rotateSigningKey(opts)` | EVOLVABLE | n/a | not replayable | DB write |
| `getKeyVersion()` | EVOLVABLE | n/a | ✓ | CACHE_COHERENT |
| `ROLES` (getter) | IMMUTABLE | n/a | n/a | ADMIN / OPERATOR / VIEWER |

**Token format v1:**
`base64url({ v:1, oid, role, iat, exp, jti }).HMAC_SHA256_hex`
This format cannot change in v1.x without breaking existing issued tokens.
Format version is declared in payload as `v: 1`.

---

## IncidentManager (api/IncidentManager.js)

| Method | Stability | Determinism | Consistency | Replayability |
|--------|-----------|-------------|-------------|---------------|
| `init(pool)` | EVOLVABLE | n/a | DB_SYNC | not replayable |
| `create(type, severity, chain)` | IMMUTABLE | CONTENT_ADDRESSED | DB_ASYNC | ✓ |
| `transition(id, toState, reason)` | IMMUTABLE | n/a | MEMORY_ONLY | not replayable |
| `transitionStrong(pool, id, state, r)` | IMMUTABLE | n/a | LINEARIZED | not replayable |
| `get(id)` | IMMUTABLE | n/a | MEMORY_ONLY | ✓ |
| `getActive()` | IMMUTABLE | n/a | MEMORY_ONLY | ✓ |
| `archive(id)` | EVOLVABLE | n/a | MEMORY_ONLY | not replayable |
| `archiveResolved(pool)` | EVOLVABLE | n/a | DB_SYNC | not replayable |
| `STATES` (getter) | IMMUTABLE | n/a | n/a | n/a |

**INCIDENT_STATES values are frozen:** DETECTED / TRIAGED / MITIGATING / FROZEN / RECOVERING / RESOLVED / POSTMORTEM_REQUIRED cannot be renamed.

---

## AuditLedger (api/AuditLedger.js)

| Method | Stability | Determinism | Consistency | Replayability | Persistence |
|--------|-----------|-------------|-------------|---------------|-------------|
| `appendEntry(opts)` | IMMUTABLE | DETERMINISTIC_PER_DB | MEMORY_ONLY | ✓ | DB_ASYNC |
| `appendLinearized(pool, opts)` | IMMUTABLE | DETERMINISTIC_PER_DB | LINEARIZED | ✓ | DB_LINEARIZED |
| `getEntries()` | IMMUTABLE | n/a | MEMORY_ONLY | ✓ | NONE |
| `verifyIntegrity()` | IMMUTABLE | n/a | MEMORY_ONLY | ✓ | NONE |
| `save(dir)` | EVOLVABLE | n/a | MEMORY_ONLY | n/a | n/a |
| `reset()` | INTERNAL_ONLY | n/a | n/a | n/a | NONE |
| `ALLOWED_TYPES` (getter) | EVOLVABLE | n/a | n/a | n/a | n/a |

**Hash chain is immutable by design.** Once an entry is committed to the chain, its hash
becomes the `previous_entry_hash` of the next entry. No retroactive modification is possible
without breaking `verifyIntegrity()`.

---

## DeterministicClock (api/DeterministicClock.js)

| Method | Stability | Determinism | Notes |
|--------|-----------|-------------|-------|
| `now()` | IMMUTABLE | DETERMINISTIC_PER_DB | Returns governed ms |
| `nowIso()` | IMMUTABLE | DETERMINISTIC_PER_DB | Returns ISO string |
| `monotonic()` | EVOLVABLE | CONTENT_ADDRESSED | ns-precision, replay-safe |
| `freeze()` | IMMUTABLE | n/a | Enters replay mode |
| `unfreeze()` | IMMUTABLE | n/a | Returns to wall-clock |
| `setOffset(ms)` | EVOLVABLE | n/a | Simulation/testing only |
| `setFixed(epochMs)` | IMMUTABLE | n/a | Replay mode clock pin |
| `isFrozen()` | IMMUTABLE | n/a | State query |
| `reset()` | INTERNAL_ONLY | n/a | Test cleanup only |

---

## EventBus (event-bus.js)

| Export | Stability | Notes |
|--------|-----------|-------|
| `emit(type, fields)` | IMMUTABLE | Returns frozen event object |
| `subscribe(type, fn)` | IMMUTABLE | Returns unsubscribe fn |
| `getBuffer(opts?)` | EVOLVABLE | Filter by type/limit |
| `snapshot()` | EVOLVABLE | Returns copy of buffer |
| `BUS_EVENTS` | IMMUTABLE | Catalog of typed event names |
| `_reset()` | INTERNAL_ONLY | Test cleanup only |

**BUS_EVENTS key structure is frozen.** Existing event type strings cannot be renamed.
New event type groups may be added. New events within a group may be added.
Removing an event type requires a deprecation notice + RFC.

---

## DSL (dsl/)

| Export | Stability | Notes |
|--------|-----------|-------|
| `parse(src)` | EXPERIMENTAL | Syntax may change in v1.x |
| `compile(ast)` | EXPERIMENTAL | AST shape may change |
| `evaluate(policy, ctx)` | EXPERIMENTAL | Context shape may change |

The DSL is EXPERIMENTAL in v1. No compatibility guarantee.
Compiled policy `content_hash` uniqueness is stable (SHA-256 of canonical representation).

---

## Adapters

| Adapter | Stability | Notes |
|---------|-----------|-------|
| `PostgresAdapter` | EVOLVABLE | CAPABILITIES map is stable |
| `MemoryAdapter` | EVOLVABLE | CAPABILITIES map is stable |
| `SqliteAdapter` | EXPERIMENTAL | May change or be removed |
| `NodejsRuntime` | EVOLVABLE | CAPABILITIES map is stable |
| `SimulationRuntime` | EXPERIMENTAL | API may change |

---

## Plugin System

| Export | Stability | Notes |
|--------|-----------|-------|
| `register(plugin)` | IMMUTABLE | Throws on invalid plugin |
| `get(name)` | IMMUTABLE | Returns plugin or undefined |
| `getAll()` | EVOLVABLE | Returns array |
| `PluginRegistry` | EVOLVABLE | Class may gain methods |
| `DETERMINISM_LEVELS` | IMMUTABLE | Frozen string array |
| `REPLAYABILITY_LEVELS` | IMMUTABLE | Frozen string array |
| `AUTHORITY_LEVELS` | IMMUTABLE | Frozen string array |
| `HA_SAFETY_LEVELS` | IMMUTABLE | Frozen string array |
