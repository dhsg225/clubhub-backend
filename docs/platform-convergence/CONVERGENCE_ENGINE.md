# Convergence Engine

## Purpose

The ConvergenceEngine detects divergence between platform subsystems. It is a read-only diagnostic layer. It NEVER mutates state, triggers recovery, or auto-heals.

## Divergence Codes

| Code                     | Trigger                                             | Severity |
|--------------------------|-----------------------------------------------------|----------|
| REPLAY_DRIFT             | DecisionTrace chain broken                          | ERROR    |
| STALE_AUTHORITY          | Lifecycle entered RECOVERING >3 times               | WARN     |
| ORPHANED_WORKFLOW        | WORKFLOW entity has no linked AGENT                 | WARN     |
| LIFECYCLE_INCONSISTENCY  | Required runtime not in READY state                 | ERROR    |
| EXECUTION_BYPASS         | Mutation routed outside ExecutionRouter             | ERROR    |
| TRACE_GAP                | TraceStore entry missing decision trace correlation | WARN     |
| TOPOLOGY_MISMATCH        | Runtime registered but absent from topology         | WARN     |
| DECISION_CHAIN_BREAK     | Hash chain break in decision records                | ERROR    |
| FROZEN_MUTATION_ATTEMPT  | Mutation attempted during FROZEN lifecycle state    | ERROR    |

## Scan Operations

```
ConvergenceEngine.runFullScan()
    │
    ├── detectSubsystemDivergence()   → LIFECYCLE_INCONSISTENCY
    ├── detectReplayDrift()           → REPLAY_DRIFT
    ├── detectStaleAuthority()        → STALE_AUTHORITY
    ├── detectOrphanedWorkflows()     → ORPHANED_WORKFLOW
    └── detectTopologyMismatch()      → TOPOLOGY_MISMATCH
```

Returns: `{ scan_at, finding_count, errors, warnings, findings[] }`

## Event Emission

Every finding emits `platform.convergence.finding` with the finding object. Operators can subscribe to this event to implement alerting.

## No Automatic Recovery

The ConvergenceEngine is intentionally passive. It surfaces divergence; operators decide remediation. This preserves the constitutional principle: **operators trust systems they can predict**.
