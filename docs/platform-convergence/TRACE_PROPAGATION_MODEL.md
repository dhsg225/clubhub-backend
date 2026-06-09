# Trace Propagation Model

## Required Fields on Every Trace Entry

| Field              | Source                          |
|--------------------|----------------------------------|
| correlation_id     | ExecutionRouter (auto or injected) |
| workflow_id        | Originating workflow             |
| agent_id           | Originating agent                |
| action_type        | SDK action type                  |
| lineage_ts         | Virtual clock timestamp          |
| policy_result      | PolicyEngine result              |
| replay_hash        | DecisionTrace.finalize()         |
| prev_hash          | Hash chain predecessor           |

## Propagation Layers

```
GovernedAgent.propose()
    │
    ├── DecisionTrace.create()        [agent_id, workflow_id, lineage_ts set here]
    ├── PolicyEngine.evaluate()
    ├── DecisionTrace.recordPolicy()  [policy_result, policy_id, reason set here]
    │
    ▼
sdkClient.execute(actionType, args, opts)
    │
    ├── TraceStore.appendTraceSafe()  [execution_result persisted]
    └── DecisionTrace.finalize()      [replay_hash computed, chain advanced]
```

## Orphan Trace Detection

An orphan trace is a TraceStore entry with no corresponding DecisionTrace entry (for AI-originated actions). ConvergenceEngine flags `TRACE_GAP` when this pattern is detected.

## Replay Chain Verification

```
DecisionTrace.verifyChain()
    │
    ├── Walk _entries in order
    ├── Recompute replay_hash for each
    ├── Verify prev_hash matches prior entry
    └── Return { valid, broken_at, reason }
```

If `valid: false`, ConvergenceEngine flags `DECISION_CHAIN_BREAK`.

## Lifecycle Traces

Every platform lifecycle transition is also traced:
```
LifecycleCoordinator.transition()
    └── traceStore.appendTraceSafe({
          workflow_id:  'lifecycle_{state}_{ts}',
          agent_id:     'platform_lifecycle',
          action_type:  'LIFECYCLE_TRANSITION',
          args:         { from, to, reason }
        })
```
