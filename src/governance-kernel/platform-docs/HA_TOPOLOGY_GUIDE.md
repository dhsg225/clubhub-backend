# HA_TOPOLOGY_GUIDE.md
# Governance Kernel — HA Topology Guide

---

## Deployment ceiling

**HARD ceiling:** 2-node active/active, shared PostgreSQL primary.

This is a formal invariant, not an aspiration:
- No Raft or Paxos consensus
- No cross-node memory synchronization
- No multi-region write distribution
- Advisory lock serialization only

---

## Topology model

```
┌──────────┐         ┌──────────┐
│  Node A  │         │  Node B  │
│          │         │          │
│  epoch=7 │         │  epoch=7 │
│  frozen=F│         │  frozen=F│
│  ACTIVE  │         │  ACTIVE  │
└────┬─────┘         └────┬─────┘
     │                     │
     └──────────┬──────────┘
                │
      ┌─────────┴──────────┐
      │   PostgreSQL        │
      │   (single primary)  │
      │   advisory locks    │
      └────────────────────┘
```

Both nodes read/write the shared PostgreSQL primary. Serialization is via `pg_advisory_xact_lock`.

---

## Node states

| State | Condition | Confidence |
|-------|-----------|-----------|
| HEALTHY | Last heartbeat ≤ 30s | HIGH |
| STALE | Last heartbeat 30–120s | MEDIUM |
| EVICTED | Explicitly removed from cluster | LOW |
| UNKNOWN | Never seen or > 120s without heartbeat | UNKNOWN |

---

## Split-brain conditions

Split-brain occurs when:
- Two nodes report divergent `authority_epoch`
- Two nodes report divergent `freeze_state`
- One node is HEALTHY, another is STALE with different epoch

**Detection:** `TopologyGraph.build()` compares node epochs and freeze states.

**Safe behavior (HARD guarantee):**
1. `DriftVisualization.analyze()` produces CRITICAL alert with `blocks_mutations: true`
2. `selectCanSubmitMutations('SPLIT_BRAIN')` returns `false`
3. All operator mutation routes reject until split-brain is cleared

**Resolution:**
1. Operator selects "Force DB check" → calls `isFrozenStrong(pool)` (DB_AUTHORITATIVE)
2. Operator confirms via `clearSplitBrain()` → snapshot refetch → live state restored

---

## Freeze epoch divergence

A lighter split-brain variant: nodes share the same epoch but have different `freeze_epoch`:

```
Node A: epoch=7, freeze_epoch=3
Node B: epoch=7, freeze_epoch=5  ← different freeze_epoch
```

This indicates a freeze event was applied to one node but not the other. The UI shows a FREEZE_EPOCH_DIVERGENCE warning (not CRITICAL). Mutations are not blocked but operators should investigate.

---

## DB unreachable scenarios

| Scenario | Behavior | Operator action |
|----------|----------|----------------|
| DB unreachable + NOT frozen | CRITICAL: LINEARIZED ops unavailable | Investigate DB; use `freezeLocal()` if critical |
| DB unreachable + frozen (FAIL_CLOSED) | WARNING only: FAIL_CLOSED is safe state | Monitor; unfreeze only after DB recovery |
| DB unreachable + split-brain | CRITICAL: compound failure | Force local freeze; restore DB first |

**HARD guarantee:** `freezeLocal()` immediately halts deployment mutations in memory across the affected node. It does NOT propagate to the other node. DB recovery + `freezeStrong()` is required for cluster-wide certainty.

---

## HA advisory gaps

| Gap | Impact | v2/v3 target |
|-----|--------|-------------|
| No WebSocket push | Freeze state lag up to 5s | v2: BUS_EVENTS WebSocket push |
| No cross-node memory sync | Nodes may briefly diverge | Architecture constraint; resolved by DB reads |
| No automatic split-brain resolution | Manual operator intervention required | v3: consensus-driven |
| Multi-region | NOT supported | Out of scope for v1 |
| > 2 nodes | NOT tested; advisory lock semantics may degrade | Requires explicit capacity planning |
