# EXECUTION-STATE-MODEL-v1

**Status:** AUTHORITATIVE
**Scope:** All runtime state machines — implementable as explicit state machines
**Format:** States, legal transitions, forbidden transitions, trigger format, rollback rules, replay reconstruction rules

---

## 1. PLAYER STATE MACHINE

### States
```
INITIALIZING    — runtime loading; rendering blocked
SYNCING         — awaiting PRE authorization; controls locked
LIVE            — playing from confirmed current PRE resolution
REPLAY          — playing from historical corpus packet; live events queued, not rendered
DEGRADED        — playing with reduced fidelity; PRE reachable but partial
INCIDENT        — active operator-acknowledged incident; reduced action surface
SUSPENDED       — playback halted by operator or system authority
TERMINAL        — unrecoverable failure; operator restart required
```

### Legal Transitions
```
INITIALIZING  → SYNCING
SYNCING       → LIVE
SYNCING       → DEGRADED           trigger: backend unreachable within timeout
LIVE          → REPLAY             trigger: OPERATOR only; blocked during active incident
LIVE          → DEGRADED           trigger: connectivity loss or manifest error
LIVE          → INCIDENT           trigger: incident declaration event
LIVE          → SUSPENDED          trigger: OPERATOR override
REPLAY        → SYNCING            trigger: operator replay exit (REPLAY→LIVE is never direct)
REPLAY        → SUSPENDED          trigger: OPERATOR override during replay
DEGRADED      → SYNCING            trigger: reconnection detected
DEGRADED      → INCIDENT           trigger: incident escalation during degraded
INCIDENT      → LIVE               trigger: OPERATOR explicit incident resolution action
INCIDENT      → SUSPENDED          trigger: OPERATOR override
SUSPENDED     → SYNCING            trigger: OPERATOR resume
ANY           → TERMINAL           trigger: unrecoverable failure
TERMINAL      → INITIALIZING       trigger: OPERATOR-initiated restart only
```

### Forbidden Transitions
```
REPLAY        → LIVE               (direct — must pass through SYNCING)
SYNCING       → REPLAY             (cannot enter replay without prior LIVE confirmation)
LIVE          → REPLAY             (when incident state is DECLARED, CONTAINED, or RESOLVING)
DEGRADED      → REPLAY             (when incident state is DECLARED, CONTAINED, or RESOLVING)
ANY           → LIVE               (without passing through SYNCING for PRE authorization)
```

---

## 2. PRE RESOLUTION STATE MACHINE

### States
```
UNRESOLVED      — no resolution result available
RESOLVING       — resolution request in-flight; dependent actions locked
RESOLVED        — authoritative result confirmed; determinism verified
STALE           — result older than TTL; must not be used as truth
FAILED          — resolution failed; fallback policy applies
REPLAY_BOUND    — locked to historical corpus packet; read-only; no re-resolution
```

### Legal Transitions
```
UNRESOLVED    → RESOLVING
RESOLVING     → RESOLVED
RESOLVING     → FAILED            trigger: backend error
RESOLVED      → RESOLVING         trigger: TTL expiry
RESOLVED      → STALE             trigger: clock skew or forced invalidation
RESOLVED      → REPLAY_BOUND      trigger: operator replay activation; blocked during active incident
STALE         → RESOLVING         trigger: automatic
FAILED        → RESOLVING         trigger: retry
REPLAY_BOUND  → RESOLVED          trigger: replay exit + re-resolution confirmation
```

### Forbidden Transitions
```
STALE         → RESOLVED          (must pass through RESOLVING)
REPLAY_BOUND  → LIVE              (must pass through RESOLVED after re-resolution)
RESOLVED      → REPLAY_BOUND      (when incident state is DECLARED, CONTAINED, or RESOLVING)
```

---

## 3. OPERATOR SESSION STATE MACHINE

### States
```
UNAUTHENTICATED  — no valid session
AUTHENTICATING   — credentials submitted; all actions locked
AUTHENTICATED    — valid session; full surface available
ELEVATED         — operator invoked elevated authority (e.g., emergency override)
SESSION_EXPIRING — TTL within warning threshold
EXPIRED          — TTL exhausted; pending re-authentication
LOCKED           — locked due to inactivity or security trigger
```

### Legal Transitions
```
UNAUTHENTICATED  → AUTHENTICATING
AUTHENTICATING   → AUTHENTICATED     trigger: backend confirmation
AUTHENTICATING   → UNAUTHENTICATED   trigger: failure
AUTHENTICATED    → ELEVATED          trigger: OPERATOR-initiated with confirmation
AUTHENTICATED    → SESSION_EXPIRING  trigger: automatic at TTL threshold
AUTHENTICATED    → LOCKED            trigger: inactivity timeout
ELEVATED         → AUTHENTICATED     trigger: elevation expiry or OPERATOR release
SESSION_EXPIRING → AUTHENTICATED     trigger: session refresh
SESSION_EXPIRING → EXPIRED           trigger: TTL exhaustion
EXPIRED          → UNAUTHENTICATED
LOCKED           → AUTHENTICATING    trigger: OPERATOR unlock
```

---

## 4. INCIDENT STATE MACHINE

### States
```
NOMINAL        — no active incident
WATCHING       — anomaly detected; not yet confirmed
DECLARED       — operator-acknowledged; blast radius tracking active
CONTAINED      — blast radius bounded
RESOLVING      — operator actively resolving
RESOLVED       — incident closed; review window pending
POST_INCIDENT  — mandatory review window; supervised recovery
```

### Legal Transitions
```
NOMINAL        → WATCHING          trigger: threshold breach
WATCHING       → DECLARED          trigger: operator confirmation OR auto-escalation after timeout
WATCHING       → NOMINAL           trigger: threshold recovery before escalation
DECLARED       → CONTAINED         trigger: containment action taken
DECLARED       → RESOLVING         trigger: operator takes immediate resolution action
CONTAINED      → RESOLVING
RESOLVING      → RESOLVED          trigger: operator declares resolution
RESOLVED       → POST_INCIDENT     trigger: automatic; mandatory
POST_INCIDENT  → NOMINAL           trigger: review window closes
```

### Forbidden Transitions
```
RESOLVING      → NOMINAL           (must pass through RESOLVED and POST_INCIDENT)
DECLARED       → NOMINAL           (must pass through resolution path)
```

---

## 5. REPLAY SESSION STATE MACHINE

### States
```
IDLE       — no replay active
LOADING    — corpus packet being fetched and verified
READY      — packet loaded; integrity verified; not yet playing
PLAYING    — actively rendering
PAUSED     — paused at operator request
SCRUBBING  — operator adjusting position
COMPLETE   — reached packet end
FAILED     — aborted (integrity check failed or packet unavailable)
```

### Legal Transitions
```
IDLE       → LOADING              trigger: OPERATOR-initiated
LOADING    → READY                trigger: packet integrity verification PASS
LOADING    → FAILED               trigger: verification FAIL
READY      → PLAYING
PLAYING    → PAUSED               trigger: OPERATOR
PLAYING    → SCRUBBING            trigger: OPERATOR
PLAYING    → COMPLETE             trigger: automatic at packet end
PLAYING    → FAILED               trigger: integrity violation during playback
PAUSED     → PLAYING
PAUSED     → SCRUBBING
SCRUBBING  → PAUSED               trigger: position commit
COMPLETE   → IDLE                 trigger: OPERATOR dismissal
FAILED     → IDLE                 trigger: OPERATOR acknowledgment
```

---

## 6. UI SURFACE STATE MACHINE (applies to every rendered surface)

### States
```
LIVE                 — confirmed current PRE output; real-time updates active
REPLAY               — deterministic historical PRE output; no live updates rendered
PREVIEW              — PRE evaluation of hypothetical state; nothing committed
STALE                — synchronization lost; consequential actions blocked
DEGRADED             — partial data; PRE reachable; incomplete inputs
PENDING-INTERVENTION — operator action in-flight; awaiting confirmation
SYNCHRONIZED         — transitional; just confirmed current after reconnection
DIVERGENT            — contradictory state detected across surfaces for same scope
```

### Legal Transitions
```
LIVE                 → REPLAY               trigger: OPERATOR
LIVE                 → PREVIEW              trigger: OPERATOR
LIVE                 → STALE               trigger: missed update cycle + 15s grace
LIVE                 → DEGRADED             trigger: upstream partial
LIVE                 → PENDING-INTERVENTION trigger: OPERATOR action
REPLAY               → LIVE                trigger: OPERATOR replay exit
REPLAY               → PREVIEW             trigger: OPERATOR (simulation only; never commits to live)
PREVIEW              → LIVE                trigger: OPERATOR cancel
PREVIEW              → PENDING-INTERVENTION trigger: OPERATOR commit
STALE                → SYNCHRONIZED        trigger: synchronization restored
STALE                → DEGRADED            trigger: partial restoration
DEGRADED             → LIVE                trigger: upstream restored
DEGRADED             → STALE               trigger: degradation worsens to full sync loss
PENDING-INTERVENTION → LIVE               trigger: action confirmed OR failed
SYNCHRONIZED         → LIVE               trigger: automatic after confirmation period
DIVERGENT            → LIVE               trigger: divergence resolved
```

### Forbidden Transitions
```
REPLAY               → PENDING-INTERVENTION affecting live state
PREVIEW              → LIVE               without explicit commit or cancel
STALE                → PENDING-INTERVENTION (consequential actions blocked)
DIVERGENT            → PENDING-INTERVENTION without explicit divergence acknowledgment
ANY                  → LIVE              without synchronization confirmation
```

---

## 7. TRANSITION TRIGGER FORMAT

Every transition request must carry:
```typescript
interface TransitionRequest {
  toState: string;
  authority: 'OPERATOR' | 'BACKEND' | 'RECOVERY' | 'SCHEDULED';
  sourceId: string;       // operatorId, backendEventId, recoveryJobId, scheduledTaskId
  reason: string;         // human-readable
  governedTimestamp: string;  // ISO8601 from GovernedClock only
}
```

Every completed transition must emit:
```typescript
interface StateMutationEvent {
  machineId: string;
  fromState: string;
  toState: string;
  trigger: string;
  authority: string;
  transitionDurationMs: number;
  timestamp: string;      // GovernedClock ISO8601
  traceId: string;
  replayContext?: { packetId: string; packetTimestamp: string };
}
```

---

## 8. ROLLBACK RULES

Before any transition, snapshot current state:
```typescript
interface StateSnapshot {
  machineId: string;
  state: string;
  context: Record<string, unknown>;
  capturedAt: string;           // GovernedClock
  transitionReason: string;
}
```

Retain last 10 snapshots per machine (circular buffer).

Rollback triggers:
1. Transition completes but required side effects fail unrecoverably
2. Operator requests undo within the undo window

Optimistic transitions are **prohibited**. The machine never reaches a post-action state before backend confirmation.

---

## 9. REPLAY RECONSTRUCTION RULES

1. Every `StateMutationEvent` is sufficient to reconstruct state machine history.
2. Given a sequence of `StateMutationEvent` records, the final state is deterministically reproducible.
3. Implementations must expose: `replayFromHistory(events: StateMutationEvent[]): string`
4. This method is tested against known event sequences in the simulation harness.
5. Divergence between live and replayed final state is a deployment-blocking failure.
6. GovernedClock is frozen to the recorded timestamps during reconstruction — no wall-clock access.

---

## 10. AUTHORITY RESOLUTION (when multiple sources drive the same machine)

```
1. OPERATOR EXPLICIT ACTION      — highest; always wins
2. BACKEND SYSTEM EVENT          — wins over recovery and automation
3. SYSTEM RECOVERY MECHANISM     — wins over scheduled automation
4. SCHEDULED/AUTOMATIC TRIGGER   — lowest; yields to all above
   AI ORCHESTRATION SIGNAL       — NO AUTHORITY; rejected at boundary
```

---

## 11. INTERACTION LOCKS (state-derived, not boolean flags)

| Machine           | Lock-Inducing States             | Locked Behavior                        |
|-------------------|----------------------------------|----------------------------------------|
| Player            | INITIALIZING, SYNCING            | All playback controls disabled         |
| PRE Resolution    | RESOLVING                        | Dependent actions locked               |
| Operator Session  | AUTHENTICATING                   | All session actions disabled           |
| Replay Session    | LOADING, SCRUBBING               | All replay controls disabled           |
| UI Surface        | STALE, DIVERGENT                 | Consequential actions blocked          |
| UI Surface        | PENDING-INTERVENTION             | Conflicting actions blocked            |

Lock is active when machine is in the listed state. Lock releases on state exit. No manual lock management.
