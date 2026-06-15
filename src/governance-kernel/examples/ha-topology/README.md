# HA Topology Example

Demonstrates the 2-node active/active HA topology with split-brain detection.

## Overview

This example shows how to:
- Simulate two nodes sharing a PostgreSQL primary
- Demonstrate epoch divergence leading to split-brain detection
- Show how mutations are blocked under split-brain conditions
- Show manual resolution via DB epoch reconciliation

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] Node A initialized (epoch=7)
[boot] Node B initialized (epoch=7)
[nodeA] Promoting: epoch 7 → 8 (LINEARIZED)
[nodeB] CACHE_COHERENT poll — epoch=8 detected
[topology] Both nodes at epoch=8: no split-brain
[simulate] Node B receives stale epoch (simulated partition)
[topology] SPLIT-BRAIN DETECTED: Node A epoch=9, Node B epoch=8
[topology] Mutations blocked on both nodes
[resolve] Operator reconciles via DB — both nodes at epoch=9
[topology] Split-brain cleared — mutations re-enabled
[done] HA topology example complete
```

## HA ceiling (HARD constraints)

```
Nodes:        2 max (active/active)
DB:           1 PostgreSQL primary (no replicas for writes)
Consensus:    pg_advisory_xact_lock (not Raft/Paxos)
Multi-region: NOT SUPPORTED
Auto-heal:    NOT SUPPORTED (manual operator resolution)
```

## Split-brain conditions

Split-brain occurs when two nodes report different `authority_epoch` values from DB.
This indicates divergent state and mutations MUST be blocked until resolved.

## Resolution procedure

See [HA_FAILOVER_PLAYBOOK.md](../../operator-playbooks/HA_FAILOVER_PLAYBOOK.md)

## See also

- [HA_TOPOLOGY_GUIDE.md](../../platform-docs/HA_TOPOLOGY_GUIDE.md)
- [FAILURE_MODE_GUIDE.md](../../platform-docs/FAILURE_MODE_GUIDE.md)
- Diagram: [HA_DEPLOYMENT_FLOW.md](../../diagrams/HA_DEPLOYMENT_FLOW.md)
