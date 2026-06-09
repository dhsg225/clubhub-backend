# FRONTEND STATE MACHINE ARCHITECTURE v1

**Era:** Implementation Bootstrap
**Status:** CANONICAL
**Scope:** Operational state machine definitions, transition governance, replay safety, concurrency control

---

## 1. PURPOSE

This document translates constitutional state governance into executable state machine specifications for frontend engineering teams.

Every operational surface in ClubHub TV is governed by an explicit state machine. No ad-hoc boolean flags, no ambient condition checks, no implicit state inference.

State machines are the **unit of operational truth** on the frontend.

---

## 2. CANONICAL STATE MACHINE REGISTRY

### 2.1 Player State Machine

```
States:
  INITIALIZING        — runtime loading, not yet safe to render content
  SYNCING             — fetching authoritative PRE resolution from backend
  LIVE                — playing from current authoritative manifest
  REPLAY              — playing from historical corpus packet
  DEGRADED            — playing with reduced fidelity (partial manifest, fallback content)
  INCIDENT            — operator-acknowledged incident active, reduced UI surface
  SUSPENDED           — playback halted by operator or system authority
  TERMINAL            — unrecoverable state, requires operator intervention

Transitions (legal only):
  INITIALIZING → SYNCING
  SYNCING → LIVE
  SYNCING → DEGRADED          (if backend unreachable within timeout)
  LIVE → REPLAY               (operator-initiated only)
  LIVE → DEGRADED             (on connectivity loss or manifest error)
  LIVE → INCIDENT             (on incident declaration)
  LIVE → SUSPENDED            (operator override)
  REPLAY → LIVE               (on replay exit, always via SYNCING re-entry)
  REPLAY → SUSPENDED          (operator override during replay)
  DEGRADED → SYNCING          (on reconnection, before returning to LIVE)
  DEGRADED → INCIDENT         (on incident escalation during degraded)
  INCIDENT → LIVE             (on incident resolution, requires explicit operator action)
  INCIDENT → SUSPENDED        (operator override)
  SUSPENDED → SYNCING         (on operator resume)
  ANY → TERMINAL              (on unrecoverable failure)
  TERMINAL → INITIALIZING     (on operator-initiated restart only)
```

**Replay Re-entry Rule:** REPLAY → LIVE is never a direct transition. It always passes through SYNCING to force backend re-authorization before live content resumes.

### 2.2 Operator Session State Machine

```
States:
  UNAUTHENTICATED     — no valid operator session
  AUTHENTICATING      — credentials submitted, awaiting backend confirmation
  AUTHENTICATED       — valid session, full operator surface available
  ELEVATED            — operator has invoked elevated authority (e.g., emergency override)
  SESSION_EXPIRING    — session TTL within warning threshold
  EXPIRED             — session expired, pending re-authentication
  LOCKED              — session locked due to inactivity or security trigger

Transitions (legal only):
  UNAUTHENTICATED → AUTHENTICATING
  AUTHENTICATING → AUTHENTICATED     (on backend confirmation)
  AUTHENTICATING → UNAUTHENTICATED   (on failure)
  AUTHENTICATED → ELEVATED           (operator-initiated only, requires confirmation)
  AUTHENTICATED → SESSION_EXPIRING   (automatic on TTL threshold)
  AUTHENTICATED → LOCKED             (on inactivity timeout)
  ELEVATED → AUTHENTICATED           (on elevation expiry or operator release)
  SESSION_EXPIRING → AUTHENTICATED   (on session refresh)
  SESSION_EXPIRING → EXPIRED         (on TTL exhaustion)
  EXPIRED → UNAUTHENTICATED
  LOCKED → AUTHENTICATING            (operator unlock)
```

### 2.3 PRE Resolution State Machine

```
States:
  UNRESOLVED          — no resolution result available
  RESOLVING           — resolution request in-flight
  RESOLVED            — authoritative result available, determinism verified
  STALE               — resolution result older than TTL, must not be used as truth
  FAILED              — resolution failed, fallback policy applies
  REPLAY_BOUND        — resolution locked to historical corpus packet (read-only)

Transitions (legal only):
  UNRESOLVED → RESOLVING
  RESOLVING → RESOLVED
  RESOLVING → FAILED              (on backend error)
  RESOLVED → RESOLVING            (on TTL expiry, re-resolution required)
  RESOLVED → STALE                (on clock skew or forced invalidation)
  RESOLVED → REPLAY_BOUND         (on operator replay activation)
  STALE → RESOLVING               (automatic re-resolution trigger)
  FAILED → RESOLVING              (on retry)
  REPLAY_BOUND → RESOLVED         (on replay exit + re-resolution confirmation)
```

### 2.4 Incident State Machine

```
States:
  NOMINAL             — no active incident
  WATCHING            — anomaly detected, not yet confirmed
  DECLARED            — incident declared, operator-acknowledged
  CONTAINED           — blast radius bounded, degradation limited
  RESOLVING           — operator actively resolving
  RESOLVED            — incident closed, post-incident review pending
  POST_INCIDENT       — review window, system in supervised recovery

Transitions (legal only):
  NOMINAL → WATCHING              (on threshold breach)
  WATCHING → DECLARED             (operator confirmation or auto-escalation after timeout)
  WATCHING → NOMINAL              (on threshold recovery before escalation)
  DECLARED → CONTAINED            (on blast-radius containment action)
  DECLARED → RESOLVING            (direct if operator takes immediate resolution action)
  CONTAINED → RESOLVING
  RESOLVING → RESOLVED            (operator declares resolution)
  RESOLVED → POST_INCIDENT        (automatic, mandatory review window)
  POST_INCIDENT → NOMINAL         (after review window closes)
```

### 2.5 Replay Session State Machine

```
States:
  IDLE                — no replay active
  LOADING             — corpus packet being fetched and verified
  READY               — packet loaded, determinism verified, not yet playing
  PLAYING             — replay actively rendering
  PAUSED              — replay paused at operator request
  SCRUBBING           — operator adjusting replay position
  COMPLETE            — replay reached packet end
  FAILED              — replay aborted (integrity check failed, packet unavailable)

Transitions (legal only):
  IDLE → LOADING                  (operator-initiated)
  LOADING → READY                 (on packet integrity verification PASS)
  LOADING → FAILED                (on verification FAIL)
  READY → PLAYING
  PLAYING → PAUSED                (operator)
  PLAYING → SCRUBBING             (operator)
  PLAYING → COMPLETE              (automatic on packet end)
  PLAYING → FAILED                (on integrity violation during playback)
  PAUSED → PLAYING
  PAUSED → SCRUBBING
  SCRUBBING → PAUSED              (on position commit)
  COMPLETE → IDLE                 (operator dismissal)
  FAILED → IDLE                   (operator acknowledgment)
```

---

## 3. TRANSITION LEGALITY ENFORCEMENT

### 3.1 Transition Guard Contract

Every state machine implementation MUST enforce transition legality at the boundary. Illegal transitions must throw a recoverable error with structured context:

```typescript
interface TransitionAttempt {
  machine: string;           // e.g., "PlayerStateMachine"
  fromState: string;
  toState: string;
  trigger: string;           // what caused the transition attempt
  timestamp: string;         // ISO8601
  operatorId?: string;       // if operator-initiated
  replayContext?: string;    // if in replay mode
}

interface TransitionResult {
  allowed: boolean;
  fromState: string;
  toState: string;
  guardEvaluation: string;   // human-readable explanation of allow/deny decision
  sideEffects: string[];     // what was triggered as a result
}
```

Illegal transition attempts MUST be:
1. Rejected (state not changed)
2. Logged with full `TransitionAttempt` context
3. Surfaced to the frontend observability sink
4. Never silently swallowed

### 3.2 Transition Authority Rules

| Trigger Type | Authority |
|---|---|
| Operator UI action | Always allowed if transition is legal |
| Backend event (PRE update, incident declaration) | Allowed if not in REPLAY or SUSPENDED |
| Automatic (TTL, timeout) | Only from pre-declared auto-transition states |
| System recovery | Only from FAILED, TERMINAL, or EXPIRED |
| AI orchestration signal | NEVER. AI cannot trigger transitions directly. |

### 3.3 Replay-Mode Transition Restrictions

While Player state machine is in REPLAY:
- Backend events MUST NOT trigger state transitions
- Only operator actions may modify state
- PRE resolution transitions are FROZEN (no re-resolution)
- Incident state machine continues to operate independently
- Operator session state continues normally

This prevents backend state drift from contaminating historical replay.

---

## 4. CONCURRENT STATE MUTATION GOVERNANCE

### 4.1 Mutation Serialization Requirement

State machines are NOT concurrent. All transition requests MUST be serialized through a single mutation queue per machine.

```
MutationQueue (per machine):
  - FIFO processing
  - Each transition request processed atomically
  - Pending queue is inspectable (for debugging)
  - Max queue depth: 10 (drop oldest if exceeded, emit warning)
  - No transition begins until previous transition is COMPLETE (including side effects)
```

### 4.2 Cross-Machine Transition Coordination

When a transition in one machine requires a synchronized transition in another, the coordinating machine is the **source of truth**. The dependent machine reacts via subscription, not direct coupling.

**Legal pattern:**
```
PlayerStateMachine transitions to INCIDENT
  → emits PlayerEnteredIncident event
  → IncidentStateMachine subscribes, transitions to DECLARED
  → UI subscribes to both machines independently
```

**Illegal pattern:**
```
PlayerStateMachine directly calls IncidentStateMachine.transition()
```

### 4.3 Interaction Lock Semantics

During certain transitions, operator input MUST be locked to prevent race conditions:

| Machine | Lock-Inducing States | Lock Behavior |
|---|---|---|
| Player | SYNCING | Disable all playback controls; show sync indicator |
| Player | INITIALIZING | Disable all controls; show loading state |
| PRE Resolution | RESOLVING | Disable actions that depend on resolved state |
| Operator Session | AUTHENTICATING | Disable all session actions |
| Replay | LOADING | Disable all replay controls |
| Replay | SCRUBBING | Disable play/pause until scrub commits |

Locks are **state-derived**, not boolean flags. If the machine is in a lock-inducing state, the lock is active. If it transitions out, the lock releases. No manual lock management.

---

## 5. STALE TRANSITION INVALIDATION

### 5.1 Async Transition Staleness

When a transition is initiated asynchronously (e.g., backend round-trip required), the initiating state must be captured. If the machine transitions to a different state before the async operation completes, the async result MUST be invalidated.

```typescript
interface AsyncTransitionToken {
  machineId: string;
  fromState: string;       // state at time of initiation
  expectedToState: string;
  initiatedAt: string;     // ISO8601
  expiresAt: string;       // ISO8601
}

// On async result arrival:
function applyAsyncResult(token: AsyncTransitionToken, result: unknown): void {
  const currentState = machine.getState();
  if (currentState !== token.fromState) {
    // Machine moved. This result is stale. Discard.
    emitStaleTransitionWarning(token, currentState);
    return;
  }
  if (Date.now() > Date.parse(token.expiresAt)) {
    // Token expired. Discard.
    emitExpiredTransitionWarning(token);
    return;
  }
  machine.applyTransition(token.expectedToState, result);
}
```

### 5.2 Backend Event Staleness

Backend events carrying state update instructions MUST include a sequence number. The frontend MUST reject events with sequence numbers older than the last applied event.

---

## 6. INCIDENT-MODE TRANSITION OVERRIDES

When `IncidentStateMachine` is in DECLARED, CONTAINED, or RESOLVING:

- Player state machine MUST refuse transitions that increase operational complexity
- Forbidden during incident: LIVE → REPLAY (no replay initiation during active incident)
- Forbidden during incident: any scheduled/automated content transitions
- Permitted during incident: LIVE → SUSPENDED (operator may halt playback)
- Permitted during incident: LIVE → DEGRADED (system may degrade further)

Incident overrides are defined declaratively:

```typescript
const INCIDENT_TRANSITION_BLOCKLIST: TransitionBlockRule[] = [
  { machine: 'player', from: 'LIVE', to: 'REPLAY', reason: 'No replay during active incident' },
  { machine: 'player', from: 'DEGRADED', to: 'REPLAY', reason: 'No replay during active incident' },
  { machine: 'pre', from: 'RESOLVED', to: 'REPLAY_BOUND', reason: 'No replay binding during active incident' },
];
```

---

## 7. STATE AUTHORITY HIERARCHY

When multiple sources attempt to drive the same state machine, authority is resolved by this hierarchy (highest wins):

```
1. OPERATOR EXPLICIT ACTION         — highest authority, always wins
2. BACKEND SYSTEM EVENT             — wins over automation
3. SYSTEM RECOVERY MECHANISM        — wins over scheduled automation
4. SCHEDULED/AUTOMATIC TRIGGER      — lowest authority, yields to all above
5. AI ORCHESTRATION SIGNAL          — NO AUTHORITY. Blocked at boundary.
```

Authority metadata MUST be attached to every transition request:

```typescript
interface TransitionRequest {
  toState: string;
  authority: 'OPERATOR' | 'BACKEND' | 'RECOVERY' | 'SCHEDULED';
  sourceId: string;    // operatorId, backendEventId, etc.
  reason: string;
}
```

---

## 8. ROLLBACK-SAFE STATE BEHAVIOR

### 8.1 State Snapshot Requirement

Before any transition, the current state MUST be snapshotted to enable rollback:

```typescript
interface StateSnapshot {
  machineId: string;
  state: string;
  context: Record<string, unknown>;  // machine-specific context data
  capturedAt: string;                // ISO8601
  transitionReason: string;
}
```

Snapshots are retained for the last 10 transitions per machine (circular buffer).

### 8.2 Rollback Conditions

A rollback to the last snapshot is triggered when:
- A transition completes but required side effects fail unrecoverably
- A backend confirmation fails after a UI-optimistic transition (PROHIBITED — see below)
- An operator explicitly requests undo (within undo window)

### 8.3 Optimistic State Transitions — PROHIBITED

No state machine may transition to a new state before backend confirmation, except for strictly local UI transitions (e.g., form input focus state).

**Prohibited:**
```
operator clicks "start replay"
→ PlayerStateMachine immediately transitions to REPLAY
→ backend call made in background
```

**Required:**
```
operator clicks "start replay"
→ backend call initiated
→ PlayerStateMachine transitions to LOADING (intermediate, local)
→ backend confirms → PlayerStateMachine transitions to REPLAY
→ backend fails → PlayerStateMachine returns to prior state
```

---

## 9. OBSERVABLE STATE MUTATION REQUIREMENTS

All state transitions MUST emit to the frontend observability sink:

```typescript
interface StateMutationEvent {
  machineId: string;
  fromState: string;
  toState: string;
  trigger: string;
  authority: string;
  transitionDurationMs: number;
  timestamp: string;
  traceId: string;          // correlates with backend trace
  replayContext?: {
    packetId: string;
    packetTimestamp: string;
  };
}
```

This enables:
- Replay-correlated state audit
- Operator session forensics
- Regression test anchoring
- Certification evidence generation

---

## 10. FORBIDDEN STATE MACHINE PATTERNS

The following patterns are constitutional violations:

| Pattern | Why Forbidden |
|---|---|
| Boolean flags replacing state (`isLoading`, `isError`) | Ambiguous, non-serializable, incomposable |
| Implicit state inferred from data presence | Hidden state, untraceable, non-deterministic |
| Direct state field mutation outside transition function | Bypasses guard enforcement |
| State shared between unrelated components via prop drilling | Creates invisible dependency chains |
| Transitions triggered by render side effects | Non-deterministic, causes render loops |
| State machine reinitialization on component remount | Loses transition history, breaks rollback |
| Optimistic transitions before backend confirmation | Violates operational truth requirement |
| AI signal as transition authority | Constitutional violation |
| Transitions without observability emission | Invisible mutation, untraceable |
| Cross-machine direct method calls for synchronization | Creates hidden coupling, impossible to replay |

---

## 11. DETERMINISTIC TRANSITION REQUIREMENTS

State machine behavior MUST be deterministic:
- Given the same state and the same input, the transition and resulting state are always identical
- Transition functions are pure: no side effects within the transition function itself
- Side effects are declared as transition outputs and executed by the runtime AFTER the transition is committed
- Random or time-dependent logic is PROHIBITED inside transition functions
- All time references use governed clock (`GovernedClock`), not `Date.now()`

---

## 12. REPLAY RECONSTRUCTION GUARANTEES

The state machine architecture MUST support replay reconstruction:

- Every `StateMutationEvent` is sufficient to replay the state machine history
- Given a sequence of `StateMutationEvent` records, the final state is deterministically reproducible
- State machine implementations expose a `replayFromHistory(events: StateMutationEvent[]): string` method
- This method is tested in the simulation harness against known sequences
- Divergence between live and replayed final states is a deployment-blocking failure

---

*Document status: CANONICAL — Implementation Bootstrap Era*
*Do not modify without constitutional governance review*
