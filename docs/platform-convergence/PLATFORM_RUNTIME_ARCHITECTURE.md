# Platform Runtime Architecture

## Overview

Phase A9 introduces `PlatformRuntime` — a single operational entry point that owns, coordinates, and provides unified observability across all platform subsystems.

## Subsystem Ownership

```
PlatformRuntime
├── GovernanceKernel          (authority owner — sole)
├── TraceStore                (append-only audit ledger)
├── GovernanceSDK             (governed mutation surface)
├── OTARuntimeLifecycle       (deployment pipeline)
├── AgentRuntime              (workflow execution)
├── OrchestrationRuntime      (AI policy gateway)
├── SimulationRuntime         (adversarial testing)
├── OperatorUI                (read-only state model)
├── LifecycleCoordinator      (platform state machine)
├── TopologyManager           (entity graph)
├── HealthModel               (operational health)
├── ReplayOrchestrator        (unified replay surface)
├── ConvergenceEngine         (divergence detection)
└── ExecutionRouter           (canonical mutation path)
```

## Authority Hierarchy

```
Kernel (sole authority owner)
  └── SDK (governed mutation layer)
        ├── WorkflowExecutor
        ├── AgentRuntime
        ├── GovernedAgent (AI)
        └── OTA Runtime
```

No subsystem may hold authority. All mutations route:
```
Source → ExecutionRouter → sdkClient.execute() → Kernel API → Core
```

## Init Sequence (Deterministic)

```
Order  Phase         Component
1      kernel        GovernanceKernel.initialize()
2      trace_store   createTraceStore()
3      sdk           createGovernanceSDK()
4      ota_runtime   createOTARuntime()
5      agent_runtime createAgentRuntime()
6      orchestration createOrchestration()
7      simulation    createSimulationContext()
8      operator_ui   (read model wires to event stream)
9      topology      TopologyManager registers all runtimes
10     convergence   ConvergenceEngine wired to all subsystems
```

## Shutdown Sequence (Reverse)

Shutdown order is the mirror of init order. `DeterministicShutdown` continues past errors to prevent zombie runtimes. All mutation paths are blocked via `ExecutionRouter.block()` before shutdown begins.

## Key Invariants

- `PlatformRuntime.init()` must complete before any mutation is accepted
- `ExecutionRouter.block()` is called before `SHUTTING_DOWN` transition
- All subsystem instances are registered in `RuntimeRegistry` before topology linking
- `ConvergenceEngine` is the last component initialized — it observes all others
