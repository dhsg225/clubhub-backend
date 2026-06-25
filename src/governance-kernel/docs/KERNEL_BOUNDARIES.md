# KERNEL_BOUNDARIES.md
# Governance Kernel v1 — Boundary Definitions

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23

---

## 1. What IS the kernel

The kernel is the set of files under `backend/src/governance-kernel/`.

It includes:
- all core/ modules (10 primitive modules)
- all api/ wrappers (9 typed API classes)
- event-bus.js
- plugins/ system
- domains/ multi-tenancy
- certification/ suite
- adapters/ (storage + runtime)
- dsl/ (parser, compiler, evaluator)
- observability/ (topology, drift)

---

## 2. What is NOT the kernel

| Thing | Status | Reason |
|-------|--------|--------|
| `backend/src/lib/` modules | NOT kernel | OTA-specific, pre-extraction originals |
| `backend/src/routes/` | NOT kernel | HTTP transport layer |
| `backend/src/middleware/screenAuth.js` | NOT kernel | Screen-specific auth |
| `backend/src/middleware/operatorAuth.js` | NOT kernel | App-level middleware (kernel has OperatorAuthority API) |
| `backend/src/db.js` | NOT kernel | App pool; kernel accepts pool as parameter |
| `backend/src/lib/events.js` | NOT kernel | App-level event catalog (superset of BUS_EVENTS) |
| `backend/src/lib/rollout-state.js` | NOT kernel | OTA-specific deployment state machine |
| `backend/src/lib/rollout-store.js` | NOT kernel | OTA-specific DB persistence |
| `backend/src/lib/manifestEngine.js` | NOT kernel | OTA-specific manifest computation |
| `backend/src/lib/policy-engine.js` | NOT kernel | OTA-specific policy rules |
| `backend/src/lib/autonomous-rollout.js` | NOT kernel | OTA-specific promotion evaluation |
| `test-runner/` | NOT kernel | OTA contract validation system |
| PostgreSQL pool | NOT kernel | Passed in as dependency, not owned |

---

## 3. Kernel external dependencies

The kernel depends on ONLY:

| Dependency | Allowed usage | Scope |
|-----------|--------------|-------|
| `node:crypto` | HMAC, SHA-256, timingSafeEqual, randomBytes | core, api |
| `node:fs` | Report writes, config history persistence | certification, config-authority |
| `node:path` | File path construction | certification, config-authority |
| PostgreSQL pool (pg) | Passed in — never imported directly | core, via governance-db |
| `node:events` | NOT USED — kernel uses own event-bus | — |

**Forbidden kernel dependencies:**
- `express` — kernel has no HTTP transport
- `cors`, `body-parser` — HTTP middleware
- `dotenv` — environment loading is caller's responsibility
- `../../../routes/` — no app imports
- `../../../lib/` — no app-lib circular imports
- `../../../db.js` — pool is injected, never required
- Any npm package not in the list above

---

## 4. Plugin boundaries

### What plugins CAN do

- Register with `PluginRegistry.register(plugin)` by declaring capabilities
- Subscribe to `eventBus` events
- Call API layer methods (`AuthorityCoordinator`, `FreezeController`, etc.)
- Emit to `eventBus` (for observability)
- Declare their own domain via `DomainRegistry`
- Use `DSL` to define governance policies

### What plugins CANNOT do

- Import core modules directly to mutate state (bypasses consistency guarantees)
- Set `bypassGovernance: true` (rejected by PluginRegistry)
- Call `clock._reset()` (test-only, kernel-internal)
- Call `auditLedger.resetLedger()` in production (test-only)
- Emit events with `event_type` in the `governance.kernel.*` or `governance.authority.*` namespace without going through the API layer
- Hold their own PostgreSQL pool separate from the kernel pool (no split-pool scenarios)

### Plugin capability requirements (all mandatory)

| Capability | Allowed values |
|-----------|---------------|
| `name` | string, unique |
| `version` | semver string |
| `determinismLevel` | NONDETERMINISTIC \| DETERMINISTIC_PER_DB \| CONTENT_ADDRESSED |
| `replayabilityLevel` | NOT_REPLAYABLE \| PARTIALLY_REPLAYABLE \| FULLY_REPLAYABLE |
| `authorityLevel` | ADVISORY \| CACHE_COHERENT \| DB_AUTHORITATIVE \| LINEARIZED |
| `haSafetyLevel` | SINGLE_NODE \| ACTIVE_PASSIVE \| ACTIVE_ACTIVE_READS \| ACTIVE_ACTIVE_WRITES |
| `bypassGovernance` | MUST be false or absent |

---

## 5. Domain boundaries

Each `AuthorityNamespace` (domain) is isolated on:
- freeze state (domain freeze does not affect other domains)
- operator scope (per-domain allowedOperators set)
- clock offset (per-domain simulation offset)
- incident tracking (domain-scoped incident maps planned — not yet enforced in v1)

**Cross-domain lineage:** not currently supported. Incidents and events do not carry domain-boundary attribution in v1. This is a known gap.

---

## 6. Forbidden mutations

The following MUST NEVER happen in kernel code:

1. **Calling `Date.now()` for governance-critical timestamps** — use `clock.now()` or `clock.nowIso()`
2. **Using `Math.random()` for governance IDs** — use `deriveDeterministicId()` or `crypto.randomBytes()`
3. **Emitting events without `deterministic_ts`** — `eventBus.emit()` adds this automatically; do not bypass
4. **Modifying the audit ledger hash chain** — entries are append-only; no UPDATE on existing entries
5. **Skipping `verifyIntegrity()` before ledger export** — callers must verify before save
6. **Direct state mutation of `_nodes` Map** — always through `recordNodeHeartbeat()` or `eviction`
7. **Bypassing `freezeStrong()` via `freezeLocal()` except in explicit FAIL_CLOSED scenarios**
8. **Using `setFixed()` in LIVE mode** — test/replay only; documented in `_reset()` pattern

---

## 7. Undefined behavior

The following scenarios are explicitly undefined in v1. Callers must not rely on any particular behavior:

1. **`kernel.replay()` called while `kernel.freeze()` is in progress** — clock state race
2. **Two concurrent `freezeStrong()` calls on different pool connections** — advisory lock serializes them, but event order is undefined
3. **`audit-ledger` overflow while `appendEntryLinearized` is in flight** — compaction may discard pending entry
4. **`PluginRegistry.register()` called after kernel is initialized** — registration is allowed but the plugin may miss KERNEL.INITIALIZED event
5. **DSL evaluation with circular `policy_ref` chains** — will loop; no cycle detection in v1
6. **`DomainRegistry.delete()` while events are in flight for that domain** — no graceful drain
7. **Multi-instance revocation propagation** — `_revokedJtis` is loaded at startup; mid-session revocations from peer instances are advisory-only until restart

---

## 8. Stability boundaries

| Surface | Stability | Notes |
|---------|-----------|-------|
| `core/` module public APIs | HIGH — see API_STABILITY_MATRIX | Breaking changes require RFC |
| `api/` class method signatures | HIGH — IMMUTABLE or EVOLVABLE classified | |
| `BUS_EVENTS` catalog keys | HIGH — consumers depend on string values | Cannot rename existing keys |
| Certification runner names | MEDIUM — new runners OK, existing cannot weaken | |
| DSL syntax | LOW — experimental in v1 | May change without deprecation warning |
| `adapters/` internal implementation | LOW — only CAPABILITIES map is stable | |
| `observability/` API | LOW — experimental | |
