# Deployment Runtime Guide

## Startup Sequence

```
1.  Validate deployment/certification-profile.json
2.  Run required certifications (a9 minimum before ACTIVE)
3.  Load platform-config-schema.json + validate environment config
4.  DeterministicBootstrap.run():
      kernel → trace_store → sdk → ota_runtime → agent_runtime
      → orchestration → simulation → operator_ui → topology → convergence
5.  LifecycleCoordinator: BOOTSTRAP → INITIALIZING → ACTIVE
6.  ControlPlaneServer starts accepting requests
7.  AdminRuntime wires health probes
8.  Platform emits platform.lifecycle.transition { to: 'ACTIVE' }
```

## Health Probes

```
GET /health/ready  → PlatformHealthCheck.isReady()  → 200 if HEALTHY+ACTIVE
GET /health/alive  → PlatformHealthCheck.isAlive()  → 200 if not TERMINATED
GET /health/full   → PlatformHealthCheck.check()    → full JSON snapshot
```

## Shutdown Sequence

```
1.  Signal received (SIGTERM / operator shutdown command)
2.  ExecutionRouter.block() → no new mutations accepted
3.  LifecycleCoordinator: ACTIVE → SHUTTING_DOWN
4.  DeterministicShutdown.run() (reverse order):
      convergence → topology → operator_ui → simulation
      → orchestration → agent_runtime → ota_runtime → sdk → trace_store → kernel
5.  Traces flushed
6.  LifecycleCoordinator: SHUTTING_DOWN → TERMINATED
7.  Process exits 0
```

## Configuration Validation

`deployment/config/platform-config-schema.json` defines the required shape. Config is validated before `DeterministicBootstrap.run()`. Invalid config → process exits 1 with schema error.

## Certification Gate

`deployment/certification-profile.json` specifies minimum passing checks per phase. If any required certification FAILS on startup, the platform halts at INITIALIZING rather than transitioning to ACTIVE.
