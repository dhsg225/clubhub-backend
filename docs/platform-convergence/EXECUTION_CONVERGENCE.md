# Execution Convergence

## Canonical Execution Path

All mutations in the platform route through a single path:

```
Mutation Source
    │
    ▼
ExecutionRouter.route(source, actionType, args, opts)
    │
    ├── Check: router blocked? → return { blocked: true }
    ├── Check: valid source?   → throw on unknown source
    ├── Assign correlation_id (or use provided)
    ├── Emit: platform.execution.routed
    │
    ▼
sdkClient.execute(actionType, args, { correlation_id, lineage_ts, ... })
    │
    ▼
Governance Kernel API
    │
    ▼
Core (authority-owned state)
    │
    └── Emit: platform.execution.completed
```

## Valid Execution Sources

| Source    | Origin                                     |
|-----------|---------------------------------------------|
| WORKFLOW  | AgentRuntime.WorkflowExecutor              |
| AI_AGENT  | GovernedAgent.propose()                    |
| OTA       | OTA Runtime governed actions               |
| OPERATOR  | Operator UI / API gateway                  |
| REPLAY    | ReplayOrchestrator (no live mutations)     |
| PLATFORM  | PlatformRuntime lifecycle coordination     |

## Shutdown Freeze

During `SHUTTING_DOWN`, `ExecutionRouter.block()` is called before any subsystem is stopped. Subsequent `route()` calls return `{ blocked: true, ok: false }`. This guarantees no mutations occur during teardown.

## Trace Propagation

Every routed mutation carries:
- `correlation_id` — auto-assigned if not provided
- `lineage_ts` — from virtual clock or wall clock
- `source` — which subsystem originated the call

These fields flow through to the SDK and into the TraceStore entry.

## No Bypass Guarantee

`ExecutionRouter` is the only object holding a reference to `sdkClient`. No subsystem may construct or import its own SDK client. This is enforced by the dependency injection pattern in `PlatformRuntime`.
