# Governed Deployment Guide

## Pre-Deployment Checklist

- [ ] `deployment/certification-profile.json` phase gates configured
- [ ] `deployment/runtime-capabilities.json` capability flags verified
- [ ] `deployment/config/platform-config-schema.json` matches environment config
- [ ] All required certifications pass (a7–a10)
- [ ] Operator tokens provisioned in AuthGateway
- [ ] Tenant registrations loaded in TenantRegistry
- [ ] Trace store migrations applied
- [ ] Health check endpoints registered

## Deployment Topology

```
[Load Balancer]
       │
       ▼
[ControlPlaneServer] ──► [ExecutionRouter] ──► [GovernanceSDK] ──► [GovernanceKernel]
       │                                                                    │
       │                                                             [PostgreSQL]
       │
[AdminRuntime] (internal only, not exposed via LB)
       │
[ObservabilityExport] ──► [Metrics/Topology/Trace sinks]
```

## Zero-Downtime Guidance

The platform does not support rolling deploy at the kernel layer. Safe deployment:

1. Drain control plane (ExecutionRouter.block() on old instance)
2. Start new instance through INITIALIZING → RECOVERING
3. Verify certifications pass on new instance
4. Transition new instance to ACTIVE
5. Redirect load balancer
6. Terminate old instance via SHUTTING_DOWN → TERMINATED

## Rollback

If new instance fails certification gate:
1. New instance stays at INITIALIZING (never reaches ACTIVE)
2. Old instance continues serving
3. AdminRecovery.runConvergenceScan() on new instance for diagnostics
4. Fix detected issues
5. Retry deployment

## Operational Runbook

| Scenario               | Action                                           |
|------------------------|--------------------------------------------------|
| High incident rate     | AdminActions.freezePlatform() → investigate      |
| Replay drift detected  | AdminRecovery.verifyTraceChain() → report        |
| Tenant quota breach    | TenantQuotaPolicy snapshot → operator review     |
| Cert regression        | AdminCertification.runAll() → identify failure   |
| Emergency stop         | ACTIVE → SHUTTING_DOWN via AdminActions          |
