# State Contracts — Operator Control Plane

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## State slice contracts

Every state slice in `GovernedStateStore` carries:

```typescript
interface StateSlice<T> {
  value: T | null;
  authority_source: 'SNAPSHOT' | 'EVENT' | 'REPLAY';
  consistency_level: 'MEMORY_ONLY' | 'CACHE_COHERENT' | 'DB_AUTHORITATIVE' | 'LINEARIZED';
  lineage_ts: string | null;   // ISO 8601 — governed clock at source event
  received_at: string | null;  // ISO 8601 — wall-clock at receipt
  authority_epoch: number | null;
  replayable: boolean | null;
  replay_cursor: string | null; // set during replay mode
  stale_threshold_ms: number | null;
  is_stale: boolean;
  sequence_id: number | null;
}
```

---

## Slice-specific contracts

### freeze

```typescript
{
  frozen: boolean | null,
  reason: string | null,
  freeze_epoch: number | null,
  confirmed_at: string | null,  // lineage_ts of confirmation event
  operator_id: string | null,
}
```

Consistency: `CACHE_COHERENT` from snapshot; `LINEARIZED` after freeze_confirmed event.
`is_authoritative: true` only when consistency_level is LINEARIZED or DB_AUTHORITATIVE.

### incidents

```typescript
{
  items: { [incident_id: string]: {
    id: string,
    type: string,
    severity: string,
    state: INCIDENT_STATE,
    causal_chain: string | null,
    correlation_id: string | null,
    created_at: string,
    transitions: [{ from, to, reason, at }],
  }}
}
```

Consistency: `MEMORY_ONLY` — local incident state machine.

### topology

```typescript
{
  nodes_map: { [node_id: string]: { id, last_seen, freeze_epoch, status, ... } },
  split_brain: boolean,
  divergent_instances: [...] | null,
}
```

Consistency: `CACHE_COHERENT` from heartbeat events.

### epoch

```typescript
{ value: number }
```

Consistency: `CACHE_COHERENT` from snapshot; `LINEARIZED` after epoch_advanced event.

### config

```typescript
{
  config_hash: string | null,
  version: number | null,
  updated_at: string | null,
  updated_by: string | null,
}
```

Consistency: `MEMORY_ONLY` — fire-and-forget DB writes.

---

## Event envelope contract

Every event applied to the store must carry:

```typescript
{
  event_id: string,              // for deduplication
  event_type: string,            // from BUS_EVENTS catalog
  lineage_ts: string,            // ISO 8601 governed clock
  sequence_id: number,           // for gap detection
  authority_epoch: number,       // current authority epoch
  correlation_id?: string,       // for lineage graph
  caused_by?: string,            // for causal chain
  operator_id?: string,          // for attribution
}
```

Events missing `sequence_id` are still applied but cannot trigger gap detection.
Events missing `lineage_ts` are applied with null `lineage_ts`.
