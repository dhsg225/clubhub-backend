# RUNTIME_LIFECYCLE_GUIDE.md
# Governance Kernel — Runtime Lifecycle Guide

---

## GovernanceKernel lifecycle states (LIFECYCLE_STATES)

```
UNINITIALIZED ──► INITIALIZING ──► ACTIVE
                                     │
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                       FROZEN    DEGRADED    REPLAY
                          │          │          │
                          └────────► ACTIVE ◄───┘
                                     │
                                     ▼
                                  SHUTDOWN
```

| State | Description | Authority available |
|-------|-------------|---------------------|
| UNINITIALIZED | Pre-init | None |
| INITIALIZING | Loading DB state, wiring dependencies | Read-only |
| ACTIVE | Full operation | All |
| FROZEN | Deployment freeze active | Read-only + freeze management |
| DEGRADED | DB or authority partial failure | MEMORY_ONLY reads only |
| REPLAY | Historical replay in progress | Read-only |
| SHUTDOWN | Terminated | None |

---

## OTA Runtime lifecycle states (Phase A3)

```
UNINITIALIZED ──► BOOTING ──► RECOVERING ──► ACTIVE
                                               │
                                  ┌────────────┼─────────────┐
                                  ▼            ▼             ▼
                               FROZEN      DEGRADED       REPLAY
                                  │            │             │
                                  └──────────► ACTIVE ◄──────┘
                                               │
                                               ▼
                                           SHUTDOWN (terminal)
```

---

## Consistency level progression at startup

```
1. UNINITIALIZED → BOOTING
   - No state available
   - FreezeController.isFrozen() returns false (default safe)

2. BOOTING → RECOVERING
   - DB connection established
   - incidentManager.init(pool) loads active incidents
   - configAuthority singleton wired

3. RECOVERING → ACTIVE
   - CACHE_COHERENT state loaded
   - GovernanceKernel.isInitialized() = true
   - LINEARIZED operations available

4. ACTIVE (steady state)
   - All consistency levels available
   - Event bus active
   - Certification available
```

---

## Shutdown sequence

```
1. Receive SHUTDOWN signal
2. Stop accepting new LINEARIZED operations
3. Drain in-flight DB operations (advisory locks)
4. Save AuditLedger if configured
5. Export lineage if configured
6. Emit governance.kernel.shutdown event
7. Terminate
```

**HARD guarantee:** In-progress advisory-lock transactions complete before shutdown.
**SOFT guarantee:** In-memory events may be lost if event bus buffer not flushed.

---

## Recovery from DEGRADED

When DB connection is lost:
1. `FreezeController.isFrozen()` returns last CACHE_COHERENT value
2. LINEARIZED operations fail with DB error
3. `FreezeController.freezeLocal(reason)` available as MEMORY_ONLY emergency freeze
4. On DB reconnect: `FreezeController.isFrozenStrong(pool)` re-establishes truth
5. `AuthorityCoordinator.incrementEpoch()` resumes once advisory lock available

**HARD guarantee:** After DB reconnect, first `isFrozenStrong()` call is authoritative.

---

## Clock behavior per lifecycle state

| State | DeterministicClock.nowIso() |
|-------|----------------------------|
| LIVE | Wall-clock (nondeterministic) |
| REPLAY | Replay clock (deterministic, advances with events) |
| FORENSIC | Wall-clock for observation timestamps |
| SIMULATION | Controlled clock (set by simulation) |

**HARD guarantee:** Replay clock never goes backward within a replay session.
**HARD guarantee:** LIVE mode always uses wall-clock — intentionally nondeterministic.
