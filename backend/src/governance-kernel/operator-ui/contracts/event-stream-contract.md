# Event Stream Contract — Operator Control Plane

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## Transport model (v1)

v1 uses HTTP polling, NOT WebSocket push.
See `UI_RUNTIME_MODEL.md §7` for poll intervals per category.

---

## Event envelope (required fields)

Every event from the governance kernel event stream MUST carry:

```json
{
  "event_id": "string (random bytes — for deduplication)",
  "event_type": "governance.kernel.* (from BUS_EVENTS catalog)",
  "lineage_ts": "ISO 8601 (governed clock at emission)",
  "deterministic_ts": "ISO 8601 (governed clock — same as lineage_ts)",
  "sequence_id": 42,
  "authority_epoch": 7,
  "consistency_level": "LINEARIZED | DB_AUTHORITATIVE | CACHE_COHERENT | MEMORY_ONLY"
}
```

---

## Ordering guarantees

- Events are returned in ascending `sequence_id` order per poll
- `lineage_ts` ordering is best-effort (ms precision, no sub-ms guarantee)
- Gap detection: if `sequence_id` of incoming event ≠ `last_known + 1`, a gap is detected
- On gap: client triggers snapshot refetch, event application halts

---

## Reconnect semantics

On reconnect, the client:
1. Provides `after=<last_sequence_id>` to event endpoint
2. Server replays events from `last_sequence_id + 1`
3. Client deduplicates by `event_id` (sliding window of 500)

If `last_sequence_id` is too old (server buffer expired):
- Server returns 410 Gone
- Client falls back to full snapshot fetch

---

## Replay stream contract

POST /governance/replay returns an array of events:

```json
[
  { "event_type": "...", "lineage_ts": "...", "sequence_id": ..., ... },
  ...
]
```

- Events MUST be returned pre-sorted by `lineage_ts` ascending
- Client additionally sorts before applying (defensive)
- Replay events do NOT carry `sequence_id` (they are historical)
- Replay events MUST carry `lineage_ts`

---

## Stale authority indicators

An event is considered STALE if:
- `authority_epoch` < current known epoch
- `lineage_ts` is > 120s behind current wall-clock (during live mode)

Stale events are not applied to live state (3+ consecutive stale → snapshot refetch).

---

## Split-brain indicators

An event carries split-brain indicators when:
- Server-side `DriftDetector.detect()` returns SPLIT_BRAIN
- Event carries `split_brain: true` field
- `divergent_instances` array populated

On receipt: `GovernedStateStore.detectSplitBrain(instances)` is called.

---

## Replay vs live stream distinction

| Field | Live event | Replay event |
|-------|------------|-------------|
| `_replay` | absent | `true` |
| `sequence_id` | present | absent |
| `lineage_ts` | governed clock (current) | governed clock (historical) |
| `deterministic_ts` | current | historical |
