# RUNTIME-CONSTITUTION-CORE-v1

**Status:** AUTHORITATIVE
**Scope:** PRE execution, replay determinism, state transitions, observability, violation detection, authority, mutation rules
**Supersedes:** All overlapping rules in docs/shared/

---

## RULES

### R-01 — PRE IS SOLE AUTHORITY ON EFFECTIVE STATE
The PRE is the only system permitted to compute effective content, resolution level, override priority order, emergency status, and health grades. No client, frontend, or downstream service may compute or infer these values. Any surface displaying an effective state must source it from a confirmed PRE resolution output.

**Testable violation:** A surface displays effective state without a corresponding PRE resolution call in the request log.

---

### R-02 — PRE OUTPUT IS DETERMINISTIC
Given identical inputs (rule configuration, scope parameters, priority ordering, governed clock time), the PRE must produce identical output on every invocation. No randomness, wall-clock access, or mutable external state is permitted inside the resolution function.

**Testable violation:** Running the PRE 5 times against the same corpus entry produces any differing output hash.

---

### R-03 — ALL TIMESTAMPS USE GOVERNED CLOCK
Every timestamp in PRE resolution output, corpus entries, event emissions, and state machine transitions must use `GovernedClock`. Wall-clock (`Date.now()`, `new Date()`, system time) is forbidden inside any governed module.

**Testable violation:** Any governed module imports or calls wall-clock APIs directly.

---

### R-04 — STALE STATE IS A FAILURE CONDITION, NOT A MODE
When a surface has not received confirmed PRE output within the staleness threshold (1 missed update cycle + 15-second grace period), it must immediately enter STALE state. STALE state blocks all consequential operator actions. The surface must not display stale data as current.

**Testable violation:** A surface allows override creation, emergency activation, or incident declaration while in STALE state.

---

### R-05 — OPTIMISTIC STATE TRANSITIONS ARE FORBIDDEN
No state machine may transition to a post-action state before backend confirmation. An in-flight operator action produces PENDING state only. PENDING is not equivalent to APPLIED. The state reverts to the prior confirmed state if the backend rejects the action.

**Testable violation:** A state machine reaches REPLAY, LIVE, or any post-action state before the confirming backend event is received.

---

### R-06 — REPLAY EVENTS NEVER ENTER THE LIVE EXECUTION PATH
The live event queue and the replay event queue are separate. No event from the replay queue is applied to the live state model. No live event is rendered while the display is in REPLAY state. When replay exits, the accumulated live state model is applied atomically.

**Testable violation:** A live event modifies rendered state while the player is in REPLAY state.

---

### R-07 — REPLAY-TO-LIVE TRANSITION ALWAYS PASSES THROUGH SYNCING
The transition from REPLAY to LIVE is never direct. It must pass through SYNCING to force PRE re-authorization. No historical replay context (packetId, replayTimestamp, historical explanation) may persist in any component after LIVE state is confirmed.

**Testable violation:** A component carries a `replayContext` field after the LIVE state badge is active.

---

### R-08 — STATE TRANSITIONS ARE SERIALIZED AND GUARDED
All state machine transitions are processed through a single FIFO mutation queue per machine (max depth 10). Illegal transitions are rejected, logged with full `TransitionAttempt` context, and emitted to the observability sink. Illegal transitions are never silently swallowed.

**Testable violation:** An illegal transition (not in the legal transition table) changes machine state. Or: a transition attempt produces no observability emission.

---

### R-09 — AI SIGNALS HAVE NO TRANSITION AUTHORITY
AI orchestration signals may not trigger state machine transitions. The authority hierarchy is: OPERATOR > BACKEND_EVENT > RECOVERY > SCHEDULED. AI is not in this hierarchy. Any transition request with `authority: AI` is rejected at the boundary.

**Testable violation:** A state machine transition occurs with `authority: AI` in the audit log.

---

### R-10 — EVERY STATE TRANSITION EMITS AN OBSERVABLE EVENT
All state machine transitions must emit a `StateMutationEvent` containing: `machineId`, `fromState`, `toState`, `trigger`, `authority`, `transitionDurationMs`, `timestamp` (GovernedClock), `traceId`. Transitions without emission are deployment-blocking violations.

**Testable violation:** A state transition occurs with no corresponding `StateMutationEvent` in the observability sink.

---

### R-11 — REPLAY RECONSTRUCTION FROM EVENTS IS MANDATORY
Given a sequence of `StateMutationEvent` records, the final state of any state machine must be deterministically reproducible. Implementations must expose `replayFromHistory(events: StateMutationEvent[]): string`. Divergence between live and replayed final state is a deployment-blocking failure.

**Testable violation:** `replayFromHistory(capturedEvents)` returns a different final state than the machine reached during live execution.

---

### R-12 — CORPUS ENTRY MUST STORE FULL INPUT STATE
A corpus entry must store the complete PRE input state at the recorded moment: rule configuration, override stack, schedule state, device states, GovernedClock timestamp. Storing only the output is insufficient. Reconstruction verification must be possible at any time.

**Testable violation:** A corpus entry cannot be used to re-run the PRE and produce the recorded output.

---

### R-13 — APPROXIMATED REPLAY MUST BE LABELED
When exact corpus input state is unavailable, the replay surface may produce a high-confidence approximation. Approximated outputs must carry a visible confidence label (HIGH / MEDIUM / LOW). Approximations may not be used as evidentiary basis for sponsor compliance or formal incident investigation. Exact reconstruction is required for those purposes.

**Testable violation:** A replay surface displays output without a confidence label when the corpus entry is not an exact match for the requested timestamp.

---

### R-14 — LIVE AND REPLAY RENDERING USE IDENTICAL COMPONENTS
The same rendering components, consuming the same PRE resolution output schema, must produce the live and replay displays. Separate rendering code paths for live and replay are a constitutional violation. The only permitted rendering differences are: state badge (LIVE vs REPLAY), live update feed visibility, action affordance availability, and temporal context header.

**Testable violation:** A live and replay render of the same PRE resolution output produce different effective state, resolution path, override stack order, or health grade values.

---

### R-15 — EVENTS ARE ORDERED BY PRE OPERATIONAL CLOCK, NOT ARRIVAL ORDER
Events for the same scope are applied in PRE operational clock timestamp order. The orchestration layer buffers events within a 500ms window to allow for out-of-order network delivery. Cross-class ordering when timestamps are equal: EC-05 (Degradation) → EC-02 (Sync) → EC-01 (PRE Resolution) → EC-03 (Operator Intervention) → EC-06 (Advisory).

**Testable violation:** Two events for the same scope are applied in arrival order when their PRE timestamps differ.

---

### R-16 — PRE RESOLUTION EVENTS ARE NEVER BATCHED
EC-01 (PRE Resolution) events are processed individually and rendered atomically. EC-02 (Synchronization) and EC-05 (Degradation) events are never batched. EC-03 (own operator actions) are never batched. EC-06 Advisory Tier 0–2 events may be batched with a maximum 5-second window. All batch windows reduce to 1 second during active incidents.

**Testable violation:** An EC-01 event is held or merged with another event before rendering.

---

### R-17 — INCIDENT MODE BLOCKS REPLAY INITIATION
While the incident state machine is in DECLARED, CONTAINED, or RESOLVING, the player state machine must refuse LIVE → REPLAY and DEGRADED → REPLAY transitions. PRE resolution state must refuse RESOLVED → REPLAY_BOUND. No replay may be initiated during an active incident.

**Testable violation:** A REPLAY transition succeeds while incident state is DECLARED.

---

### R-18 — CROSS-MACHINE SYNCHRONIZATION IS EVENT-DRIVEN, NOT DIRECT
State machines must not call transition methods on other state machines directly. Coordination occurs via event subscription: a transition in machine A emits an event; machine B subscribes and transitions independently. Direct cross-machine method calls are forbidden.

**Testable violation:** A state machine transition function directly calls `anotherMachine.transition()`.

---

### R-19 — ALL CONSEQUENTIAL ACTIONS ARE BLOCKED IN STALE AND DIVERGENT STATES
A surface in STALE state may not initiate override creation, emergency activation, or incident declaration. A surface in DIVERGENT state may not initiate any consequential action without explicit operator acknowledgment of the divergence. Read-only operations are permitted in both states.

**Testable violation:** An override is created while the surface state is STALE or DIVERGENT without divergence acknowledgment.

---

### R-20 — SCHEMA CHANGES ARE ADDITIVE-ONLY WITHOUT MIGRATION APPROVAL
New fields must be optional. Required fields may not be removed. Field types may not be narrowed. Any breaking schema change requires an approved migration plan. A breaking schema change without an approved migration plan unconditionally blocks deployment.

**Testable violation:** A required field is removed from a published schema without a migration plan. Or: an existing field type is narrowed.

---

### R-21 — REPLAY CORPUS DIVERGENCE UNCONDITIONALLY BLOCKS DEPLOYMENT
Any change that causes PRE output to differ from canonical corpus entries is a deployment-blocking violation unless accompanied by an approved corpus update. There is no override mechanism for this gate.

**Testable violation:** CI replay regression detects output divergence from the canonical corpus with no corresponding approved corpus update record.

---

### R-22 — COUNTERFACTUAL OUTPUT MUST NEVER BE CONFUSED WITH HISTORICAL RECORD
Counterfactual simulation output must be visually distinguished from actual historical replay at all times. The branch point must be labeled. The simulated branch must carry a persistent "SIMULATED — this did not occur" label. Counterfactual output must not be saved to the corpus as historical data.

**Testable violation:** A counterfactual output appears in the corpus. Or: a counterfactual branch renders without the "SIMULATED" label.

---

### R-23 — STATE SNAPSHOTS ENABLE ROLLBACK
Before any state machine transition, the current state must be snapshotted (`StateSnapshot`: machineId, state, context, capturedAt, transitionReason). Snapshots are retained for the last 10 transitions per machine. Rollback is triggered when: required side effects fail unrecoverably, or an operator explicitly requests undo within the undo window.

**Testable violation:** A failed transition side effect leaves the machine in a new state with no rollback available.

---

### R-24 — TRANSITION FUNCTIONS ARE PURE; SIDE EFFECTS ARE DECLARED OUTPUTS
Transition functions must be pure — no side effects within the function itself. Side effects are declared as transition outputs and executed by the runtime after the transition is committed. Random or time-dependent logic is forbidden inside transition functions.

**Testable violation:** A transition function directly calls an I/O operation, emits an event, or reads mutable state outside its declared inputs.

---

### R-25 — CONSTITUTIONAL VALIDATION GATES HAVE NO BYPASS
The following CI gates have no override mechanism: replay corpus regression, PRE non-determinism detection, breaking schema change without migration plan, rendering state machine violation, forbidden dependency introduction, canonical naming violation in constitutional modules. A deployment blocked by these gates must fix the violation — it may not be bypassed.

**Testable violation:** A merge occurs while any of the above gates are in failed state.

---

*Every rule above is independently testable, enforceable by CI, and non-overlapping.*
*Rules not listed here are not in scope for runtime enforcement.*
