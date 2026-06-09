# Operational Administration

## Admin Runtime

`AdminRuntime` is the central admin coordinator. It owns:

| Component         | Responsibility                               |
|-------------------|----------------------------------------------|
| AdminActions      | Governed admin operations (freeze, export)   |
| AdminDiagnostics  | Read-only diagnostic snapshots               |
| AdminRecovery     | Trace chain verify, convergence report       |
| AdminCertification| Run and cache certification suites           |
| AdminTopology     | Read-only topology access with audit trail   |
| AdminAudit        | Append-only log of all admin operations      |

## Admin Action Flow

```
AdminRuntime.actions.freezePlatform(operatorId, reason, lineage_ts)
    │
    ├── AdminAudit.record('FREEZE_PLATFORM', operatorId, { reason })
    └── ExecutionRouter.route('OPERATOR', 'FREEZE', { reason }, opts)
```

All admin actions are:
1. Recorded to AdminAudit before execution
2. Routed through ExecutionRouter (no direct kernel access)
3. Traceable via correlation_id

## Operator Escalation

```
Normal operation:
  OPERATOR role → DeploymentController (wave promote, rollback)

Escalation required:
  ADMIN role → AdminActions (platform freeze, epoch increment)

Emergency:
  ADMIN → AdminActions.freezePlatform()
        → LifecycleCoordinator: ACTIVE → FROZEN
        → ExecutionRouter continues to block destructive mutations
```

## Recovery Operations (Operator-Initiated Only)

| Operation           | Method                           | Audit |
|---------------------|----------------------------------|-------|
| Verify trace chain  | AdminRecovery.verifyTraceChain() | YES   |
| Convergence report  | AdminRecovery.runConvergenceScan()| YES  |
| Get lifecycle history| AdminRecovery.getLifecycleHistory()| YES |

No automatic mutation recovery. Detection surfaces findings; operators decide action.
