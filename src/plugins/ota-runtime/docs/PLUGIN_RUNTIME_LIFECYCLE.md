# PLUGIN_RUNTIME_LIFECYCLE.md
# OTA Runtime — Plugin Lifecycle Model

**Phase:** A3
**Effective:** 2026-05-24

---

## Lifecycle states

```
UNINITIALIZED ──► BOOTING ──► RECOVERING ──► ACTIVE
                      │                        │
                      ▼                        ├──► FROZEN ──► ACTIVE
                  DEGRADED ◄──────────────────┤
                      │                        ├��─► DEGRADED
                      ▼                        │
                  RECOVERING                   ├──► REPLAY ──► ACTIVE
                                               │
                                               └──► SHUTDOWN (terminal)
```

| State | Description | Mutations permitted |
|-------|-------------|---------------------|
| UNINITIALIZED | Not yet started | No |
| BOOTING | Initializing kernel dependencies | No |
| RECOVERING | Recovering from degraded state or restart | No |
| ACTIVE | Normal operation | Yes |
| FROZEN | Deployment frozen | No |
| DEGRADED | Partial authority failure, read-only | No |
| REPLAY | Executing replay, side effects suppressed | No |
| SHUTDOWN | Terminated | No (terminal) |

---

## Valid transitions

| From | To | When |
|------|----|------|
| UNINITIALIZED | BOOTING | `init()` called |
| BOOTING | ACTIVE | Dependencies initialized, kernel healthy |
| BOOTING | RECOVERING | Kernel reports degraded state at startup |
| BOOTING | DEGRADED | Critical dependency unavailable |
| BOOTING | SHUTDOWN | Fatal startup failure |
| RECOVERING | ACTIVE | Recovery complete |
| RECOVERING | DEGRADED | Recovery failed |
| RECOVERING | SHUTDOWN | Fatal recovery failure |
| ACTIVE | FROZEN | `freezeDeployment()` called |
| ACTIVE | DEGRADED | Kernel authority partial failure |
| ACTIVE | REPLAY | `enterReplay()` called |
| ACTIVE | SHUTDOWN | `shutdown()` called |
| FROZEN | ACTIVE | `unfreezeDeployment()` called |
| FROZEN | DEGRADED | Authority failure while frozen |
| FROZEN | SHUTDOWN | `shutdown()` called |
| DEGRADED | RECOVERING | Manual recovery initiated |
| DEGRADED | SHUTDOWN | `shutdown()` called |
| REPLAY | ACTIVE | `exitReplay()` called |
| REPLAY | SHUTDOWN | `shutdown()` called |

---

## Lifecycle events emitted

Every state transition emits `governance.runtime.lifecycle_changed`:

```json
{
  "event_type": "governance.runtime.lifecycle_changed",
  "event_id": "...",
  "deterministic_ts": "...",
  "plugin": "ota",
  "from_state": "BOOTING",
  "to_state": "ACTIVE",
  "reason": "startup complete",
  "lineage_ts": "..."
}
```

---

## Lifecycle snapshot

`lifecycle.snapshot()` returns:

```json
{
  "plugin": "ota",
  "state": "ACTIVE",
  "previous_state": "RECOVERING",
  "transition_ts": "2026-05-24T04:00:00.000Z",
  "reason": "startup complete",
  "mutation_permitted": true,
  "certification_status": "PASS",
  "certification_ts": "2026-05-24T04:00:01.000Z"
}
```

---

## Health report

`lifecycle.healthReport()` returns:

```json
{
  "plugin": "ota",
  "state": "ACTIVE",
  "healthy": true,
  "warnings": [],
  "transition_ts": "..."
}
```

Warnings are added when state is DEGRADED, FROZEN, REPLAY, or certification is not PASS.

---

## Certification integration

`certifyRuntime()` runs all 5 A3 certification suites and calls `lifecycle.setCertificationStatus(rating)`. The certification rating appears in subsequent `lifecycle.snapshot()` calls and is visible via `GET /runtime/status`.

---

## Lifecycle invariants

| Invariant | Enforcement |
|-----------|-------------|
| SHUTDOWN has no outgoing transitions | LifecycleConsistencyCertification LLC-07 |
| lifecycle.js emits events on transitions | LifecycleConsistencyCertification LLC-03 |
| BOOTING is the first reachable state from UNINITIALIZED | Transition table — only valid first transition |
| Mutations only permitted in ACTIVE state | `lifecycle.isMutationPermitted()` — checked before governed operations |
