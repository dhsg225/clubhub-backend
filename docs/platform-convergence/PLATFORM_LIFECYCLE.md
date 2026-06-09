# Platform Lifecycle

## States

```
BOOTSTRAP → INITIALIZING → RECOVERING → ACTIVE → DEGRADED → REPLAY → FROZEN → SHUTTING_DOWN → TERMINATED
```

## Canonical Lifecycle Graph

```
                    ┌─────────────────────────────────────────────────┐
                    │                                                 │
BOOTSTRAP ──► INITIALIZING ──► RECOVERING ──► ACTIVE ◄──── DEGRADED │
                    │               │            │               ▲    │
                    │               ▼            ▼               │    │
                    │           DEGRADED ◄──► FROZEN             │    │
                    │               │            │               │    │
                    │               └──────┬─────┘               │    │
                    │                      ▼                      │    │
                    └──────────► SHUTTING_DOWN ──► TERMINATED     │    │
                                                                  │    │
                    ACTIVE ──► REPLAY ──────────────────────────► ┘    │
                               │                                       │
                               └──► SHUTTING_DOWN                      │
```

## Transition Rules

| From         | Allowed To                                      |
|-------------|--------------------------------------------------|
| BOOTSTRAP   | INITIALIZING                                     |
| INITIALIZING| RECOVERING, ACTIVE, TERMINATED                   |
| RECOVERING  | ACTIVE, DEGRADED, TERMINATED                     |
| ACTIVE      | DEGRADED, FROZEN, REPLAY, SHUTTING_DOWN          |
| DEGRADED    | ACTIVE, RECOVERING, FROZEN, SHUTTING_DOWN        |
| REPLAY      | ACTIVE, DEGRADED, FROZEN, SHUTTING_DOWN          |
| FROZEN      | ACTIVE, SHUTTING_DOWN                            |
| SHUTTING_DOWN | TERMINATED                                     |
| TERMINATED  | (none)                                           |

## Requirements

- All transitions emit `platform.lifecycle.transition` event
- All transitions are recorded in lifecycle history
- Invalid transitions throw synchronously — no silent failure
- All transitions optionally traced into TraceStore
- `canTransition(to)` is a read-only predicate
- `getHistory()` returns immutable snapshot

## Operational Failure Examples

### Stuck in RECOVERING
```
Platform enters RECOVERING more than 3 times → ConvergenceEngine flags STALE_AUTHORITY
```

### Freeze during active deployment
```
ACTIVE → FROZEN (operator_freeze_command)
OTA mutations rejected at execution-router.js
FROZEN → ACTIVE (operator_unfreeze_command)
```

### Emergency shutdown from DEGRADED
```
DEGRADED → SHUTTING_DOWN (emergency_stop)
DeterministicShutdown runs in reverse order
TERMINATED
```
