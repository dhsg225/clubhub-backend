# REPLAY_CONTRACT.md
# Governance Kernel v1 — Replay Contract

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23

---

## 1. What replay means

Replay is the ability to reconstruct governance state by re-processing a recorded sequence
of events in deterministic order. A replay run:

1. Freezes the governed clock
2. Iterates events in `lineage_ts` order
3. Pins the clock to each event's `lineage_ts` before processing
4. Emits events into the event bus (for subscribers to reconstruct state)
5. Does NOT write to the DB
6. Does NOT issue tokens
7. Does NOT perform any I/O side effects
8. Returns the clock to wall-clock after completion

Replay is correct when: the reconstructed state at any point T equals the original
authoritative state at time T, given the same event sequence.

---

## 2. Replay entry point

```javascript
await kernel.replay(events, opts);
```

Where `events` is an array of governance event objects, each with at minimum:
- `event_type` — string (from BUS_EVENTS catalog)
- `lineage_ts` — ISO 8601 timestamp (the governed clock value at emission time)
- any additional fields specific to the event type

Optional `opts`:
- `opts.mode` — currently unused, defaults to REPLAY_MODES.REPLAY

---

## 3. Clock contract during replay

### Clock behavior

| Mode | `clock.now()` returns | `clock.isFrozen()` |
|------|-----------------------|--------------------|
| LIVE | `Date.now() + _offset` | false |
| REPLAY | `_fixed + monotonic_delta` | true |
| SIMULATION | `_fixed + monotonic_delta` | true |
| FORENSIC | `Date.now()` (unmodified) | false |

### Clock pinning sequence

```
kernel.replay(events):
  clock.freeze()                       ← _frozen = true, _fixed = now()
  for each event in events:
    clock.setFixed(lineage_ts_as_ms)   ← pin to event's original timestamp
    eventBus.emit('replay_event', evt)
  clock.unfreeze()                     ← _fixed = null, _frozen = false
```

### Clock contract guarantees

1. **Within replay:** `clock.now()` returns `lineage_ts` (as ms) for the current event
2. **Monotonicity:** Events MUST be passed in ascending `lineage_ts` order. The kernel
   does not sort events; caller is responsible for ordering.
3. **Precision:** `lineage_ts` is ISO 8601 with ms precision. Sub-ms ordering is not
   guaranteed and should not be relied on.
4. **After replay:** Clock returns to wall-clock. Any `setOffset()` applied before
   replay is restored.

---

## 4. Deterministic surfaces during replay

These values are IDENTICAL in replay vs original execution:

| Value | How | Guarantee |
|-------|-----|-----------|
| Incident IDs | SHA-256 of `{type, severity, causal_chain}` | CONTENT_ADDRESSED |
| Config hashes | SHA-256 of stable-serialized config | CONTENT_ADDRESSED |
| Ledger entry hashes | SHA-256 of stable-serialized entry | CONTENT_ADDRESSED |
| DSL policy content_hash | SHA-256 of canonical policy | CONTENT_ADDRESSED |
| `lineage_ts` | Taken from event (pinned clock) | EXACT |

These values are DIFFERENT in replay vs original execution:

| Value | Why |
|-------|-----|
| `event_id` | `crypto.randomBytes(6)` — not deterministic |
| Operator token values | `iat`, `exp`, `jti` — not replayed (tokens not re-issued) |
| `received_at` in heartbeats | Wall-clock by design |
| DB sequence IDs | Sequential from DB `seq` |

---

## 5. Lineage mode during replay

Replay MUST use `LINEAGE_MODES.REPLAY` when calling `verifyLineage()`.

In REPLAY mode:
- `ORPHANED_EVENT` anomalies are SUPPRESSED (replayed events have no live causal parents)
- `BROKEN_CAUSAL_CHAIN` is still reported (the chain within the replayed set must be intact)
- `CROSS_INCIDENT_CONTAMINATION` is still reported
- `MISSING_AUTHORITY_CONTEXT` is still reported

Using `LINEAGE_MODES.STRICT` during replay WILL produce false ORPHANED_EVENT anomalies
and should not be used.

---

## 6. Side-effect prohibition during replay

The following MUST NOT occur during a `kernel.replay()` call:

| Action | Why prohibited |
|--------|---------------|
| DB writes | Replay is read-only reconstruction |
| Token issuance | Tokens are not replayed |
| JTI revocation | Revocation is a live-state action |
| `archiveResolvedIncidents(pool)` | DB write |
| `appendEntryLinearized(pool, ...)` | DB write |
| `incrementEpoch()` | Changes authoritative state |
| `freezeStrong(...)` | DB write |
| File system writes | Side effect |
| HTTP requests | Side effect |

**Enforcement:** The kernel sets `_mode = REPLAY_MODES.REPLAY` during replay.
Subsystems that perform DB writes SHOULD check the kernel mode before acting.
In v1, this is a caller contract — there is no automated enforcement guard.
This is a known gap (see Section 10).

---

## 7. Replay mode compatibility

Events emitted under different kernel configurations may be replayed if:

| Condition | Compatible? |
|-----------|-------------|
| Same config version (config_hash matches) | ✓ FULLY COMPATIBLE |
| Different config version, same threshold values | ✓ FUNCTIONALLY COMPATIBLE |
| Different config version, different threshold values | ⚠ POSSIBLY INCOMPATIBLE (policy decisions may differ) |
| Different Node.js version | ✓ COMPATIBLE (no version-specific crypto) |
| Different DB adapter (Postgres vs Memory) | ✓ COMPATIBLE in replay (no DB writes) |
| Events from a different `domain` replayed into another domain | ✗ NOT SUPPORTED in v1 |

**Config snapshot for replay:** callers SHOULD record `getThresholdSnapshot()` at
event emission time and include it in the replay context. This enables detection of
config divergence during replay.

---

## 8. Replay of unknown event types

If an event in the replay array has an `event_type` not in the `BUS_EVENTS` catalog:

- In `LINEAGE_MODES.REPORT`: the event is replayed without error; subscribers that don't recognize it ignore it
- In `LINEAGE_MODES.STRICT`: the event causes a `LINEAGE_ANOMALY.ORPHANED_EVENT` (missing causal chain)

Unknown events MUST NOT cause replay to halt. They MUST be passed to the event bus.
Subscribers that care about unknown types may handle them; all others ignore.

---

## 9. Forensic mode

`REPLAY_MODES.FORENSIC` is the read-only variant of REPLAY for post-incident analysis.

Differences from REPLAY:
- Clock is NOT frozen (forensic analysis runs in real time)
- Events are read without time manipulation
- The analyst sees the original event data alongside current live state

FORENSIC mode is a convention, not an enforcement. In v1, the kernel does not prevent
writes in FORENSIC mode — caller discipline required.

---

## 10. Known replay gaps (v1 advisory)

| Gap | Impact | Mitigation |
|-----|--------|-----------|
| No automated side-effect guard during replay | DB writes could corrupt state | Caller discipline; document in API |
| `event_id` is not deterministic | Can't use event_id as idempotency key in replay | Use `lineage_ts` + `event_type` + `correlation_id` |
| No event ordering enforcement | Out-of-order replay produces undefined state | Callers must sort by `lineage_ts` |
| `lineage_ts` uses wall-clock (ms precision) | Sub-ms ordering not preserved | Not an issue for most governance events |
| Multi-domain replay not supported | Cross-domain causal chains cannot be replayed | Planned for v2 |
| Replay does not reconstruct DB state | Only event bus state is reconstructed | Combine with DB snapshot restore |

---

## 11. Simulation mode

`REPLAY_MODES.SIMULATION` provides a fully deterministic execution environment:

- Clock: `SimulationRuntime` sets `clock.setFixed(opts.epochMs)` at construction
- Storage: `MemoryAdapter` (no DB required)
- Randomness: seeded PRNG via `SimulationRuntime.randomBytes(n)`
- Side effects: none (MemoryAdapter is in-process only)

Simulation is the basis for testing governance invariants without a running PostgreSQL instance.

```javascript
const sim = new SimulationRuntime({ epochMs: 1700000000000, seed: 42 });
sim.storage.setInt('governance.epoch', 5);
const epoch = await sim.storage.getInt('governance.epoch');
// epoch === 5 — deterministic, no DB
```
