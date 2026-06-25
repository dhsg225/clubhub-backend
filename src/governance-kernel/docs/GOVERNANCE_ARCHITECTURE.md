# GOVERNANCE_ARCHITECTURE.md
# Governance Kernel v1 — Architecture Reference

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23
**Authority:** This document is normative. Deviations require a Governance RFC.

---

## 1. Purpose

The Governance Kernel is a domain-agnostic operational authority platform. It provides
deterministic, replayable, auditable governance for distributed operational systems.

It governs:
- deployment authority (who may promote, freeze, rollback)
- cluster state authority (who is current, who is stale)
- configuration authority (what are the current thresholds)
- incident authority (what is currently wrong, who owns it)
- operator authority (who is allowed to act, with what scope)
- lineage authority (what caused what)

It does NOT govern:
- business logic
- domain-specific deployment strategies
- UI rendering
- monitoring infrastructure
- external authentication systems

---

## 2. Architectural layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONSUMER LAYER                                                     │
│  (applications, plugins, CLI tools)                                 │
│  accesses kernel only through: api/ or event-bus subscriptions      │
└────────────────────┬────────────────────────────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────────────────────────────┐
│  API LAYER  (api/)                                                  │
│  GovernanceKernel   AuthorityCoordinator   FreezeController         │
│  LineageEngine      ConfigAuthority        OperatorAuthority        │
│  IncidentManager    AuditLedger            DeterministicClock       │
│                                                                     │
│  Rules: every method declares its consistency level                 │
│         every method is classified IMMUTABLE/EVOLVABLE/EXPERIMENTAL │
└────────────────────┬────────────────────────────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────────────────────────────┐
│  PLATFORM LAYER  (event-bus, plugins, domains, certification)       │
│  EventBus           PluginRegistry   DomainRegistry                 │
│  CertificationRunner  DSL            Observability                  │
│                                                                     │
│  Rules: event-bus receives from core, routes to subscribers         │
│         plugins cannot bypass api/ layer                            │
│         DSL compiles to pure-function evaluators                    │
└────────────────────┬────────────────────────────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────────────────────────────┐
│  CORE LAYER  (core/)                                                │
│  clock.js            lineage.js         deterministic-id.js         │
│  governance-db.js    config-authority.js distributed-authority.js   │
│  cluster-consensus.js  incident-manager.js                          │
│  audit-ledger.js     session-authority.js                           │
│                                                                     │
│  Rules: no Express/HTTP imports                                     │
│         no app-specific imports (no require('../../../routes/'))    │
│         all time via clock.js (not Date.now() in auth paths)        │
│         all IDs via deterministic-id.js (not Math.random())         │
└────────────────────┬────────────────────────────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────────────────────────────┐
│  ADAPTER LAYER  (adapters/)                                         │
│  PostgresAdapter    MemoryAdapter    SqliteAdapter                  │
│  NodejsRuntime      SimulationRuntime                               │
│                                                                     │
│  Rules: adapters must not change governance semantics               │
│         MemoryAdapter MUST produce identical governance outputs      │
│         to PostgresAdapter in replay mode                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core module responsibilities

| Module | Responsibility | Mutable State |
|--------|---------------|---------------|
| `core/clock.js` | Governed time — replay-safe | `_fixed`, `_offset`, `_frozen`, `_monotonic` |
| `core/lineage.js` | Causal event attribution | `_events[]` (ring buffer, 2000 max) |
| `core/deterministic-id.js` | Content-addressed IDs | none (pure function) |
| `core/governance-db.js` | Cluster state store + advisory locks | none (stateless wrapper) |
| `core/config-authority.js` | Versioned config + hash chain | `_config`, `_version`, `_history`, `_frozen` |
| `core/distributed-authority.js` | Multi-instance lease | lease row (DB) |
| `core/cluster-consensus.js` | Node fleet authority | `_nodes` Map, `_epoch`, `_freezeEpoch`, `_rolloutFrozen` |
| `core/incident-manager.js` | Incident state machine | `_incidents` Map (500 max) |
| `core/audit-ledger.js` | Append-only hash-chain ledger | `_ledger[]` (10,000 max) |
| `core/session-authority.js` | JTI revocation + key versioning | `_revokedJtis` Set, `_keyVersion` |

---

## 4. Dependency graph

```
GovernanceKernel
  ├── core/governance-db (DB schema init)
  ├── core/config-authority (singleton bootstrap)
  ├── core/cluster-consensus (epoch + freeze)
  ├── core/audit-ledger (ledger init)
  ├── core/session-authority (JTI init)
  ├── core/incident-manager (incident init)
  ├── core/clock (timestamp)
  └── event-bus (kernel events)

core/cluster-consensus
  ├── core/governance-db (advisory lock + atomic increment)
  └── core/clock (governed time for heartbeats)

core/incident-manager
  ├── core/governance-db (advisory lock for transitionStrong)
  ├── core/clock (governed timestamps)
  ├── core/lineage (withLineage on incident events)
  └── core/deterministic-id (incident IDs)

core/audit-ledger
  └── core/governance-db (advisory lock for appendEntryLinearized)

core/config-authority
  └── core/clock (governed timestamps in history)

core/lineage
  └── core/clock (lineage_ts)

event-bus
  └── core/clock (deterministic_ts on every event)
```

No circular dependencies in core/. All dependencies are downward-only.

---

## 5. HA topology

### Supported

| Topology | Status | Notes |
|----------|--------|-------|
| Single node | FULLY SUPPORTED | All operations safe |
| Active/passive (failover) | FULLY SUPPORTED | Epoch increment on takeover |
| Active/active reads (2 nodes) | SUPPORTED | Reads may be CACHE_COHERENT |
| Active/active writes (2 nodes) | CONDITIONALLY SUPPORTED | Requires LINEARIZED paths for all mutations |

### Not supported

| Topology | Status | Blocker |
|----------|--------|---------|
| Active/active (3+ nodes) | NOT SUPPORTED | pg_advisory_xact_lock latency increases linearly; no distributed quorum |
| Multi-region | NOT SUPPORTED | No cross-region arbitration; pg advisory locks are single-DB-scoped |
| Leaderless | NOT SUPPORTED | No CRDT-based state merge |
| Eventual consistency reads | ADVISORY ONLY | isDeploymentFrozen() is CACHE_COHERENT, not linearized |

---

## 6. Data flow — freeze path

```
Operator action
  │
  ▼ FreezeController.freeze(reason, pool)
  │
  ▼ cluster-consensus.freezeStrong(reason, pool)
  │
  ├─▶ DB: pg_advisory_xact_lock(freeze_lock_key)
  ├─▶ DB: governance_state SET freeze=true, freeze_epoch++
  ├─▶ (success) _rolloutFrozen = true, _freezeEpoch++
  ├─▶ (DB failure, FAIL_CLOSED) _rolloutFrozen = true anyway
  └─▶ event-bus.emit(AUTHORITY.FREEZE_COMMITTED)
```

---

## 7. Data flow — replay path

```
Stored events[]
  │
  ▼ kernel.replay(events)
  │
  ├─▶ clock.freeze()  ← all time now from events
  │
  ▼ for each event:
  │   clock.setFixed(event.lineage_ts)
  │   eventBus.emit('governance.kernel.replay_event', event)
  │
  ▼ subscribers receive events in lineage_ts order
  │
  └─▶ clock.unfreeze()  ← return to wall-clock
```

Side effects MUST NOT occur during replay. Replay is read-only reconstruction.

---

## 8. Plugin data flow

```
Plugin registration:
  plugin declares { name, version, determinismLevel, authorityLevel, haSafetyLevel, replayabilityLevel }
  │
  ▼ PluginRegistry.validate(plugin)
  │   rejects if: missing capabilities, bypassGovernance=true, unknown determinismLevel
  │
  ▼ PluginRegistry.register(plugin)
  │
  └─▶ event-bus.emit(PLUGIN.REGISTERED)

Plugin action (must route through API layer):
  plugin → API method → core module → DB → event-bus
  NEVER: plugin → core module directly (bypasses consistency guarantees)
```

---

## 9. Versioning

This document governs **Governance Kernel v1**. The version boundary is:

- v1.x.x: backward-compatible changes (EVOLVABLE APIs may change, IMMUTABLE APIs cannot)
- v2.0.0: breaking changes (requires new GOVERNANCE_ARCHITECTURE.md)

Any change that alters an IMMUTABLE API, removes a consistency guarantee, weakens
a certification check, or changes replay semantics requires a version bump and RFC.
