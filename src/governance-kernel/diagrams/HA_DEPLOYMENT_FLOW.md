# HA_DEPLOYMENT_FLOW.md
# HA Deployment Flow Diagram

```
┌─────────────────────────┐    ┌─────────────────────────┐
│        Node A            │    │        Node B            │
│  epoch=7  frozen=false   │    │  epoch=7  frozen=false   │
│  ACTIVE                 │    │  ACTIVE                 │
└──────────┬──────────────┘    └─────────────┬───────────┘
           │                                  │
           │      pg_advisory_xact_lock        │
           └──────────────┬───────────────────┘
                          │
               ┌──────────▼──────────┐
               │   PostgreSQL        │
               │   primary           │
               │   epoch=7           │
               │   frozen=false      │
               └─────────────────────┘

Wave promotion (Node A):
  Node A acquires pg_advisory_xact_lock
  Node A: epoch 7 ──► 8  (LINEARIZED)
  Node A releases lock
  Node B: reads epoch=8 on next CACHE_COHERENT poll

Freeze (Node A):
  Node A acquires pg_advisory_xact_lock
  DB: frozen = true, freeze_epoch = 8
  Node A releases lock
  Node B: isFrozenStrong(pool) ──► frozen=true  (DB_AUTHORITATIVE)

Node B goes stale (no heartbeat > 30s):
  TopologyGraph: Node B status ──► STALE
  DriftVisualization: STALE_NODES INFO alert
  > 120s: Node B status ──► EVICTED

Node B epoch diverges (split-brain):
  TopologyGraph: split_brain = true
  DriftVisualization: SPLIT_BRAIN CRITICAL alert
  selectCanSubmitMutations ──► false (mutations blocked)
```

## HA ceiling summary

```
Nodes:       2 max (active/active)
DB:          1 PostgreSQL primary (no replicas for writes)
Consensus:   pg_advisory_xact_lock (not Raft/Paxos)
Multi-region: NOT SUPPORTED
Auto-heal:   NOT SUPPORTED (manual operator resolution)
```
