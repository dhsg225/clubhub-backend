# FAILURE_RECOVERY_FLOW.md
# Failure Recovery Flow Diagram

```
DB unreachable detected
       │
       ├──► FreezeController.isFrozen() ── returns CACHE_COHERENT value
       ├──► FreezeController.freezeLocal(reason) ── MEMORY_ONLY freeze
       ├──► lifecycle ──► DEGRADED
       └──► eventBus.emit(governance.runtime.lifecycle_changed)

       │  DB recovers
       ▼
FreezeController.isFrozenStrong(pool)  ── DB_AUTHORITATIVE read
       │
       ├── was frozen ──► FreezeController.freeze(reason, pool)  LINEARIZED confirm
       └── not frozen ──► assess whether to freeze based on deployment state

       │
       ▼
AuthorityCoordinator.incrementEpoch()  ── confirm epoch is current
IncidentManager.init(pool)             ── reload active incidents
AuditLedger (in-memory entries persisted if pool available)
       │
       ▼
lifecycle DEGRADED ──► RECOVERING ──► ACTIVE

       │
       ▼
certifyRuntime()  ── confirm no regressions
```

## Split-brain recovery flow

```
Split-brain detected (divergent epochs)
       │
       ▼
All mutations blocked (selectCanSubmitMutations = false)
       │
       ▼
Operator: "Force DB Check" ──► isFrozenStrong(pool) DB_AUTHORITATIVE
       │
       ▼
Identify authoritative node (higher epoch wins)
       │
       ▼
Restart stale node ──► node re-joins with fresh epoch read
       │
       ▼
clearSplitBrain() ──► snapshot refetch ──► mutations re-enabled
```
