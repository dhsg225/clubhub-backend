# UI_RUNTIME_MODEL.md
# Governance Kernel v1 — Operator UI Runtime Model

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Runtime environment

The Operator Control Plane runs in two environments:

| Environment | Runtime | Notes |
|-------------|---------|-------|
| Server-side | Node.js (NodejsRuntime) | API gateway routes, event stream server, snapshot server |
| Client-side | Browser or Node.js CLI | GovernedStateStore, GovernedEventStream client, view renderers |

The server-side runtime MUST use `NodejsRuntime` from `adapters/runtime/NodejsRuntime.js`.
The client-side runtime is environment-agnostic (no kernel dependencies).

---

## 2. State lifecycle

```
DISCONNECTED
    │ connect()
    ▼
SNAPSHOT_LOADING
    │ snapshot received
    ▼
RECONCILING
    │ events replayed on top of snapshot
    ▼
LIVE
    │ live event stream active
    │
    ├── EVENT received → dispatch → LIVE (state updated)
    ├── GAP detected → SNAPSHOT_LOADING (re-fetch)
    ├── DISCONNECT → DISCONNECTED
    │
    └── replay_start command
            ▼
        REPLAY_RENDERING
            │ replay events consumed
            ▼
        SNAPSHOT_LOADING (refetch to return to live)
```

---

## 3. Client state model objects

Every object in `GovernedStateStore` carries a metadata envelope:

```javascript
{
  // payload
  value: { ...domainObject },

  // authority provenance
  authority_source: 'SNAPSHOT' | 'EVENT' | 'REPLAY' | 'OPTIMISTIC',
  consistency_level: 'MEMORY_ONLY' | 'CACHE_COHERENT' | 'DB_AUTHORITATIVE' | 'LINEARIZED',

  // temporal metadata
  lineage_ts: '2026-05-24T00:00:00.000Z',  // governed clock time of source event
  received_at: '2026-05-24T00:00:01.234Z', // wall-clock receipt time (stale detection)
  authority_epoch: 7,                       // epoch at which state was authoritative

  // replayability
  replayable: true | false,
  replay_cursor: null | number,             // set during replay rendering mode

  // stale detection
  stale_threshold_ms: 120000,               // null = no threshold
  is_stale: false,                          // computed from received_at vs stale_threshold_ms

  // sequence tracking
  sequence_id: 42,                          // from event stream; for gap detection
}
```

---

## 4. Authority epoch tracking

The client tracks `authority_epoch` independently per authority domain.

When an event arrives with `authority_epoch > current_epoch`:
- State object is updated
- `epoch_advanced` flag set on that state slice
- UI surfaces refresh their epoch badge

When an event arrives with `authority_epoch < current_epoch`:
- Event is marked as STALE
- Event is NOT applied to current state
- `stale_event_received` counter incremented
- If 3+ consecutive stale events: force snapshot refetch

---

## 5. Replay rendering model

During replay rendering:

```javascript
// GovernedStateStore replay mode
store.enterReplayMode(replayStartCursor);

// For each replay event:
store.dispatchReplayEvent(event);
// - applies event to state
// - sets authority_source = 'REPLAY'
// - sets lineage_ts from event
// - does NOT update received_at

// When replay complete:
store.exitReplayMode();
// - triggers snapshot refetch
// - clears replay_cursor
// - resumes live event stream
```

**Key invariant**: During replay rendering, `received_at` is NOT updated.
This prevents stale detection logic from triggering on historical events.

---

## 6. Event deduplication

Events are deduplicated by `event_id` within a sliding window of 500 events.

If a duplicate `event_id` is received:
- Event is silently dropped
- `duplicate_event` counter incremented
- No state change occurs

This handles reconnect scenarios where the server replays events from the last known cursor.

---

## 7. Polling model (v1 transport)

v1 uses polling + snapshot, NOT WebSocket push.

Poll intervals by data category:

| Category | Poll interval | Notes |
|----------|--------------|-------|
| Freeze state | 5s | Safety-critical — shorter interval |
| Incident state | 10s | |
| Topology / node heartbeats | 15s | |
| Audit ledger | 30s | |
| Certification status | 60s | |
| Config snapshot | 30s | |

On detection of state change (via sequence_id delta), reconciliation triggers immediately.

---

## 8. Rendering mode indicators

The runtime exposes `store.getRenderingMode()` which returns one of:

| Mode | Description | Visual indicator |
|------|-------------|-----------------|
| `LIVE` | Live state from event stream | Green dot |
| `REPLAY` | Historical replay in progress | Orange "REPLAY" banner |
| `FORENSIC` | Forensic overlay (live + historical) | Blue "FORENSIC" banner |
| `SIMULATION` | Simulation run (no DB) | Purple "SIMULATION" banner |
| `STALE` | Event stream interrupted | Yellow "STALE" banner |
| `SPLIT_BRAIN` | Topology divergence detected | Red "SPLIT BRAIN" banner |
| `RECONNECTING` | Transport recovering | Spinner |

These modes are EXCLUSIVE. The store maintains a single active mode.
