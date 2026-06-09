# Control Plane Architecture

## Overview

The external control plane exposes governed APIs for all platform operations. Every request is authenticated, lineage-tagged, rate-limited, and routed through the ExecutionRouter — never directly to the kernel.

## Request Flow

```
External Client
    │
    ▼
ControlPlaneServer.handle(request)
    │
    ├── 1. RequestLineage.tag()        → assign correlation_id, lineage_ts
    ├── 2. AuthGateway.validateRequest()  → authenticate token, check role permission
    ├── 3. validateRequest()           → contract validation (action_type, args)
    ├── 4. RateLimiter.check()         → per-operator + per-tenant limits
    ├── 5. Emit platform.control_plane.request event
    │
    ▼
ExecutionRouter.route('OPERATOR', actionType, args, opts)
    │
    ▼
sdkClient.execute() → Kernel API → Core
    │
    ▼
buildResponse(ok, result, { correlation_id })
```

## Authentication Model

| Role     | Permissions                                                          |
|----------|----------------------------------------------------------------------|
| ADMIN    | All actions including FREEZE, UNFREEZE, INCREMENT_EPOCH              |
| OPERATOR | PROMOTE_WAVE, ROLLBACK, CREATE_INCIDENT, APPROVE_AI_OPERATOR         |
| VIEWER   | Read-only (no mutations via control plane)                           |

## Controllers

| Controller              | Responsibility                          |
|------------------------|------------------------------------------|
| TenantController        | Tenant CRUD, health snapshots            |
| DeploymentController    | Wave promotion, rollback, complete       |
| ReplayController        | Tenant-scoped replay session management  |
| TopologyController      | Read-only topology views                 |
| IncidentController      | Create, transition, archive incidents    |
| PolicyController        | List, inspect, dry-run evaluate policies |
| CertificationController | Run and export certification reports     |

## No Bypass Guarantee

`ControlPlaneServer` holds the only `ExecutionRouter` reference accessible externally. No route calls `sdkClient.execute()` directly. All mutations go: controller → ControlPlaneServer.handle() → ExecutionRouter → SDK → Kernel.

## Rate Limiting

- Per-operator: 60 requests/minute (default)
- Per-tenant: 200 requests/minute (default)
- Limits are configurable at startup
- `RateLimiter` uses injected `lineage_ts` — no wall-clock dependency for core logic
