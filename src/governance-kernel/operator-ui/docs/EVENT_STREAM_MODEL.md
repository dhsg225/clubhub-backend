# EVENT_STREAM_MODEL.md
# Operator UI — Event Stream Model

## Overview

The operator UI receives real-time governance events via Server-Sent Events (SSE) from the
`/api/operator/events/stream` endpoint. All events originate from the governance kernel's
in-process event bus and are forwarded to connected operator sessions.

## Event bus architecture

```
Governance Kernel
  ├── AuthorityCoordinator  ──► governance.authority.*
  ├── FreezeController      ──► governance.freeze.*
  ├── IncidentManager       ──► governance.incident.*
  ├── ConfigAuthority       ──► governance.config.*
  ├── AuditLedger           ──► governance.audit.*
  └── OTA RuntimeLifecycle  ──► governance.runtime.*
            │
            ▼
    EventBus (ring buffer, 5000 max)
            │
            ▼
    SSE bridge  ──► GET /api/operator/events/stream
            │
            ▼
    Operator UI (EventSource)
```

## Event envelope

Every event carries:

| Field            | Type   | Description                                      |
|------------------|--------|--------------------------------------------------|
| `event_type`     | string | Namespaced: `governance.<domain>.<action>`       |
| `event_id`       | string | UUID v4, unique per event                        |
| `deterministic_ts` | number | Monotonic logical clock value (DeterministicClock) |
| `received_at`    | string | ISO-8601 wall-clock at emission (NOT updated in replay) |
| `payload`        | object | Domain-specific fields                           |

## Event namespaces

### `governance.authority.*`

| Event type                            | Trigger                             |
|---------------------------------------|-------------------------------------|
| `governance.authority.epoch_changed`  | `incrementEpoch()` completes        |
| `governance.authority.split_brain`    | Epoch divergence detected           |

Payload includes: `epoch`, `node_id`, `consistency_level: 'LINEARIZED'`

### `governance.freeze.*`

| Event type                          | Trigger                           |
|-------------------------------------|-----------------------------------|
| `governance.freeze.frozen`          | `freeze()` completes              |
| `governance.freeze.unfrozen`        | `unfreeze()` completes            |
| `governance.freeze.local_freeze`    | `freezeLocal()` (MEMORY_ONLY)     |

Payload includes: `reason`, `freeze_epoch`, `consistency_level`

### `governance.incident.*`

| Event type                             | Trigger                          |
|----------------------------------------|----------------------------------|
| `governance.incident.created`          | `create()` completes             |
| `governance.incident.state_changed`    | `transition()` completes         |
| `governance.incident.archived`         | `archive()` completes            |

### `governance.config.*`

| Event type                       | Trigger               |
|----------------------------------|-----------------------|
| `governance.config.updated`      | `update()` completes  |

Payload includes: `changes` (keys only, not values), `version`

### `governance.runtime.*`

| Event type                               | Trigger                          |
|------------------------------------------|----------------------------------|
| `governance.runtime.lifecycle_changed`   | State machine transition         |

Payload includes: `from_state`, `to_state`, `reason`, `certification_status`

### `governance.audit.*`

| Event type                       | Trigger                           |
|----------------------------------|-----------------------------------|
| `governance.audit.entry_appended`| Any `appendEntry()` call          |

## Replay mode behavior

During replay, `received_at` is NOT updated on forwarded events. The UI must:

1. Display `deterministic_ts` as the canonical timestamp during replay
2. Suppress any real-time mutation controls (freeze, incident creation, config update)
3. Show a visible REPLAY MODE indicator
4. Emit `governance.replay.entered` / `governance.replay.exited` lifecycle events

## UI subscription contract

```javascript
// Connect
const es = new EventSource('/api/operator/events/stream');

// Handle all governance events
es.addEventListener('governance', (e) => {
  const event = JSON.parse(e.data);
  dispatch({ type: 'GOVERNANCE_EVENT', event });
});

// Handle connection lifecycle
es.addEventListener('error', () => reconnect());
```

## HARD guarantees

- Event order within a session matches kernel emission order (FIFO ring buffer)
- `deterministic_ts` is monotonically increasing within a node
- Split-brain events are emitted within one CACHE_COHERENT poll interval (default 5s)

## SOFT guarantees

- SSE delivery is best-effort; client must tolerate gaps on reconnect
- Event bus ring buffer (5000 max) may drop oldest events under load

## See also

- `REPLAY_VISUALIZATION_MODEL.md` — replay-specific display contract
- `AUTHORITY_SURFACE_GUIDE.md` — which events gate which UI controls
- `UI_STATE_MACHINE.md` — how events drive UI state transitions
