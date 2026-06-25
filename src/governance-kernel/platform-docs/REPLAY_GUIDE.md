# REPLAY_GUIDE.md
# Governance Kernel — Replay Guide

---

## Replay modes

| Mode | Description | Side effects | Clock |
|------|-------------|-------------|-------|
| LIVE | Normal operation | Active | Wall-clock |
| REPLAY | Historical event playback | Suppressed | Governed (replay) |
| FORENSIC | Read-only incident investigation | None (pure read) | Wall-clock |
| SIMULATION | What-if isolated execution | Isolated state only | Controlled |

---

## What the REPLAY contract guarantees

**HARD guarantees:**
1. Events are sorted ascending by `lineage_ts` before replay (deterministic ordering)
2. `received_at` is NOT updated during replay (stale detection does not trigger on historical events)
3. `applyReplayEvent()` throws if called outside replay mode
4. All deployment mutations are blocked during replay
5. Same event sequence → same final state (determinism)

**SOFT guarantees:**
- Sub-millisecond event ordering: not guaranteed when two events share the same `lineage_ts`

**ADVISORY (not guaranteed):**
- Replay clock advances: the governed clock advances between events, but does not guarantee real-time pacing

---

## Entering replay mode

```javascript
// 1. Via GovernedStateStore (operator-ui):
store.enterReplayMode();
// This transitions rendering mode to REPLAY
// Live events are silently dropped until exitReplayMode()

// 2. Via OTA Runtime:
runtime.enterReplay(correlationId);
// Sets replayHooks._replayMode = true
// Transitions lifecycle to REPLAY
// All assertNotReplay() calls now throw REPLAY_ISOLATION_VIOLATION

// 3. Via GovernedEventStream (transport):
stream.startReplay({ nodeId, from_ts, to_ts });
// Fetches events, sorts by lineage_ts, emits sequentially
```

---

## Replay event flow

```
Historical events (fetched from API/DB)
         │
         ▼
Sort by lineage_ts ascending
         │
         ▼
[event₁] → applyReplayEvent(event₁)
         │   ↳ assertReplayMode()
         │   ↳ _reduceEvent() — no received_at update
         │   ↳ no side effects
         ▼
[event₂] → applyReplayEvent(event₂)
         │
         ▼
[eventN] → applyReplayEvent(eventN)
         │
         ▼
Replay complete → exitReplayMode()
         │
         ▼
Snapshot refetch → live state restored
```

---

## Replay isolation violations

Any attempt to mutate state in replay mode throws:

```
REPLAY_ISOLATION_VIOLATION: 'promoteWave' is a mutating operation and must not execute during replay
```

Thrown by:
- `replayHooks.assertNotReplay(operationName)`
- `replayHooks.assertCanMutateDeployment(isFrozen, operationName)`
- `store.applyEvent()` when in REPLAY mode (silently drops, does not throw in UI layer)

---

## Forensic replay

Forensic replay is a READ-ONLY overlay on top of historical events:

```javascript
// ForensicView has no side effects:
const report = forensicView.buildIncidentReport(incidentId, allEvents);
const diff   = forensicView.buildBeforeAfterComparison(historicalTs, currentLiveState);
```

ForensicView:
- Has no kernel imports
- Has no DB access
- Has no token operations
- Is a pure function of its input events
- Certified by ReplaySurfaceCertification RSC-04

---

## Determinism assessment

| Surface | Deterministic | Notes |
|---------|--------------|-------|
| Event ordering (lineage_ts) | YES — HARD | Sub-ms ordering not guaranteed |
| applyReplayEvent() output | YES — HARD | Same events → same state |
| ForensicView reports | YES — HARD | Pure function of event array |
| ConfigDiffEngine.hash() | YES — HARD | SHA-256 of stableStringify() |
| received_at during replay | NO — intentional | Wall-clock, stale detection excluded |
| DeterministicClock in LIVE | NO — intentional | Wall-clock for audit timestamps |
