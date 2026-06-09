# Unified Replay Model

## Replay Types

| Type            | Source                          | Isolation     |
|-----------------|----------------------------------|---------------|
| WORKFLOW        | TraceStore.getByWorkflow()       | Memory        |
| DECISION_CHAIN  | DecisionTrace._entries          | Memory        |
| INCIDENT        | TraceStore.getByWorkflow()       | Memory        |
| DEPLOYMENT      | TraceStore.getByWorkflow()       | Memory        |
| SIMULATION      | SimulationRuntime (re-seeded)    | Isolated ctx  |
| PLATFORM_STATE  | Multi-subsystem epoch snapshot   | Read-only     |

## Replay Flow

```
Operator/Test
    │
    ▼
ReplayOrchestrator.replayWorkflow(workflowId)
    │
    ├── Creates replay session (session_id, type, status=RUNNING)
    ├── Emits platform.replay.session_started
    │
    ├── Reads from TraceStore (no live DB mutation)
    │
    ├── Returns result object
    └── Emits platform.replay.session_complete
```

## Simulation Replay (Determinism Check)

```
ReplayOrchestrator.replaySimulation(scenarioId, seed)
    │
    ├── Creates ctx1 = createSimulationContext({ seed })
    ├── Creates ctx2 = createSimulationContext({ seed })
    ├── Runs scenario on both independently
    ├── Compares report hashes
    └── Returns { deterministic: true | false }
```

Same seed MUST yield identical report hashes (H1 invariant).

## Replay Constraints

- No live DB mutation during replay
- Clock is frozen at replay epoch
- All replay operations use MemoryAdapter or TraceStore reads
- Replay sessions are tracked in ReplayOrchestrator._activeSessions
- Decision chain replay verifies hash chain before returning

## Convergence Failure: Replay Drift

If `DecisionTrace.verifyChain()` returns `{ valid: false }`, the ConvergenceEngine emits `REPLAY_DRIFT` finding. This indicates a decision trace was tampered or corrupted. The platform does NOT auto-repair — operator investigation required.
