# Operational Topology Model

## Entity Types

| Type             | Example IDs              |
|------------------|--------------------------|
| NODE             | node_0, node_1           |
| RUNTIME          | kernel, sdk, ota_runtime |
| AGENT            | agent_ai_001             |
| WORKFLOW         | wf_deploy_v2_001         |
| INCIDENT         | inc_network_001          |
| REPLAY_SESSION   | replay_workflow_001      |
| FREEZE           | freeze_001               |
| PARTITION        | partition_001            |
| OPERATOR_SESSION | ops_session_001          |

## Topology Graph

```
kernel (RUNTIME)
    │
    ├──► sdk (RUNTIME)
    │        │
    │        ├──► agent_001 (AGENT)
    │        │        │
    │        │        └──► wf_001 (WORKFLOW)
    │        │
    │        └──► ota_runtime (RUNTIME)
    │
    └──► trace_store (RUNTIME)
```

## Key Operations

- `register(id, type, attrs)` — add entity to graph
- `link(fromId, toId)` — bidirectional edge (agent ↔ workflow)
- `getByType(type)` — enumerate all entities of a type
- `getRelated(id)` — get directly linked entities
- `deregister(id)` — remove entity and all edges
- `snapshot()` — serializable topology state

## Convergence: Topology Mismatch

If a runtime is registered in `RuntimeRegistry` but absent from `TopologyManager`, `ConvergenceEngine.detectTopologyMismatch()` flags `TOPOLOGY_MISMATCH`.

## Convergence: Orphaned Workflow

If a WORKFLOW entity has no linked AGENT, `ConvergenceEngine.detectOrphanedWorkflows()` flags `ORPHANED_WORKFLOW`.

Both are detection-only findings. No automatic remediation.
