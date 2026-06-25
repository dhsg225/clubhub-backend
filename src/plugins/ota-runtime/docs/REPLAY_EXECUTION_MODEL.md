# REPLAY_EXECUTION_MODEL.md
# OTA Runtime — Replay Execution Model

**Phase:** A3
**Effective:** 2026-05-24

---

## Replay mode activation

Replay mode is entered via the OTA runtime entry point:

```javascript
runtime.enterReplay(correlationId);
// ... replay execution ...
runtime.exitReplay();
```

This calls:
1. `replayHooks.enterReplay(correlationId)` — sets `_replayMode = true`, `_sideEffectsSuppressed = true`
2. `lifecycle.transition('REPLAY', 'kernel replay mode entered')` — if currently ACTIVE

On exit:
1. `replayHooks.exitReplay()` — clears replay state
2. `lifecycle.transition('ACTIVE', 'kernel replay mode exited')` — if currently REPLAY

---

## What happens in replay mode

### Mutations blocked

All governed mutation operations call `assertNotReplay()` or `assertCanMutateDeployment()` before executing. In replay mode, these throw `REPLAY_ISOLATION_VIOLATION`:

| Operation | Guard |
|-----------|-------|
| `promoteWave()` | `assertCanMutateDeployment(isFrozen, 'promoteWave')` |
| `freezeDeployment()` | `assertNotReplay('freezeDeployment')` |
| `unfreezeDeployment()` | `assertNotReplay('unfreezeDeployment')` |
| `rollbackDeployment()` | `assertNotReplay('rollbackDeployment')` |
| `completeDeployment()` | `assertCanMutateDeployment(isFrozen, 'completeDeployment')` |
| `incidents.create()` | `assertNotReplay('incidents.create')` |
| `incidents.transition()` | `assertNotReplay('incidents.transition')` |
| `incidents.transitionStrong()` | `assertNotReplay('incidents.transitionStrong')` |
| `incidents.archive()` | `assertNotReplay('incidents.archive')` |
| `config.update()` | `assertNotReplay('config.update')` |
| `operators.revokeToken()` | `assertNotReplay('operators.revokeToken')` |
| `operators.appendActionLinearized()` | `assertNotReplay('operators.appendActionLinearized')` |

### Side effects suppressed

The `suppressedSideEffect(label, fn)` helper executes `fn` only when NOT in replay mode:

```javascript
const result = suppressedSideEffect('audit-ledger', () => ledger.appendEntry(opts));
// Returns null in replay — ledger entry is not written
```

### Read operations permitted

The following are safe in replay mode:
- `configAuthority.get()`, `snapshot()`, `version()`, `isFrozen()`
- `incidentManager.get()`, `getActive()`
- `freezeController.isFrozen()`
- `authorityCoordinator.getEpoch()`
- `operatorAuthority.verifyToken()` (no side effects)

---

## Deterministic clock in replay

The `deploymentRuntime` accepts a clock dependency:

```javascript
runtime.init({ ..., clock: deterministicClock });
```

When `DeterministicClock` is in replay mode (`REPLAY` replay mode), `clock.nowIso()` returns the governed replay clock timestamp — not wall-clock.

If no clock is injected, `deployment-runtime.js` falls back to `new Date().toISOString()` (wall-clock). This is acceptable for the READ model (nondeterministic path, documented).

---

## Replay events through kernel event bus

During replay, events are emitted through `eventBus.emit()` with `deterministic_ts` from the governed clock. The event bus stamps `deterministic_ts` at emission time using `clock.nowIso()` — which under REPLAY mode uses the replay clock.

This preserves the replay determinism contract from the kernel:
- Events carry `deterministic_ts` (governed clock)
- Events carry `lineage_ts` (wall-clock for audit — intentionally nondeterministic)

---

## Replay restrictions summary

| Surface | In REPLAY mode |
|---------|---------------|
| Deployment mutations | BLOCKED (assertCanMutateDeployment) |
| Incident mutations | BLOCKED (assertNotReplay) |
| Config mutations | BLOCKED (assertNotReplay) |
| Token revocation | BLOCKED (assertNotReplay) |
| All read operations | PERMITTED |
| AuditLedger appendEntry | SUPPRESSED (via suppressedSideEffect) |
| EventBus emit | PERMITTED (timestamps use replay clock) |
| Lifecycle state | REPLAY state |

---

## Replay correlation tracking

`replayHooks.status()` exposes:

```json
{
  "replay_mode": true,
  "side_effects_suppressed": true,
  "replay_correlation_id": "corp-abc123",
  "replay_enter_ts": "2026-05-24T04:00:00.000Z",
  "replay_exit_ts": null,
  "suppressed_count": 14
}
```

`suppressed_count` tracks how many side effects were silently blocked during the replay session. This is observable via `GET /runtime/status`.
