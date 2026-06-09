# CONSTITUTIONAL ENGINEERING PLAYBOOK v1

**Era:** Execution Acceleration
**Status:** CANONICAL
**Scope:** Workflow recipes, safe implementation sequences, checklists, traps, diagnosis tables, review heuristics

---

## 1. PURPOSE

This document is a working engineer's reference. It does not introduce new doctrine. It translates the constitutional corpus into actionable patterns, checklists, and diagnostics that can be used daily during implementation.

Keep this document open while building. Refer to it before asking "is this okay."

---

## 2. HOW TO BUILD SAFELY — CANONICAL SEQUENCES

### 2.1 Building a New Operational Component

Follow this sequence exactly. Do not skip steps.

```
Step 1: Classify the component
  → Which of the 7 categories does this belong to?
     Shell | Workspace Container | Operational Pane | PRE-Boundary |
     Explainability | Content Renderer | Simulation-Only
  → If it spans two categories: split it into two components.

Step 2: Identify state machine subscriptions
  → Which state machines does this component observe?
  → Is this component authorized to observe them? (check dependency direction)
  → If observing PRE Resolution: must go through PRE-Boundary, not direct subscription.

Step 3: Identify event emissions
  → What events does this component emit?
  → Is this component the declared owner of those event types?
  → If not: it must not emit them. Route via a state machine transition instead.

Step 4: Write the simulation test FIRST
  → STATE_MACHINE test: does this component respond correctly to each relevant state?
  → COMPONENT_BOUNDARY test: do the linters pass with no upward dependencies?
  → RENDER_STABILITY test: does it re-render only when its inputs actually change?
  → If replay-path: REPLAY_PARITY test using a corpus packet.

Step 5: Implement against the test
  → Use GovernedClock for all timestamps.
  → Emit StateMutationEvent for every state transition this component drives.
  → Accept operational mode as a prop from the pane level — do not read global context.
  → Pass determinism attestation prop to all content renderers.

Step 6: Run the checklist (Section 3)

Step 7: Open PR with evidence artifacts (Section 10)
```

### 2.2 Extending a State Machine

Never extend a state machine by adding boolean flags to its context. Add states and transitions.

```
Step 1: Read the transition table in FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md.
  → Is the new state/transition already implied?
  → If yes: use the existing state; do not add a new one.

Step 2: If a new state is genuinely needed:
  → Open a design document. Do not write code yet.
  → Identify: what transitions into the new state? What transitions out?
  → Are any existing transitions affected?
  → Does the new state have replay implications?
     (Will it appear in corpus history? Does replay reconstruction handle it?)
  → Get State Authority Team approval before proceeding.

Step 3: Update FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md first.
  → The document update is committed separately from the implementation.
  → The implementation PR references the document PR.

Step 4: Update the transition guard tests.
  → New state has tests for all legal transitions into it.
  → New state has tests for all legal transitions out of it.
  → Tests for formerly legal transitions that are now blocked by the new state.

Step 5: Add replay reconstruction test for the new path.
  → A sequence that passes through the new state must be in replayFromHistory() tests.

Step 6: Add observability emission for every transition involving the new state.
```

### 2.3 Integrating a New PRE Data Type

```
Step 1: Define the data type in the PREResolutionContract interface.
  → This interface is owned by the PRE Engine Team.
  → Propose the addition; get PRE Engine Team approval.

Step 2: Add the new field to corpus packet authoring tooling.
  → Author a corpus packet that includes the new field.
  → Verify determinism hash includes the new field.

Step 3: Add STALE and FAILED handling in the PRE-Boundary component.
  → The boundary must validate presence and freshness of the new field.
  → If the field is absent in a RESOLVED state, the boundary must treat as FAILED.

Step 4: Write the PRE_BOUNDARY test:
  → RESOLVED with new field present → passes to renderer
  → RESOLVED with new field absent → falls back to DegradedResolutionFallback
  → STALE → does not pass to renderer regardless of new field
  → FAILED → does not pass to renderer

Step 5: Write the REPLAY_PARITY test:
  → Corpus packet with new field → rendering hash consistent across 10 runs
  → Corpus packet without new field (historical packets) → does not break boundary

Step 6: Implement the Content Renderer for the new data.
  → Renderer is a leaf component.
  → Receives data as props only.
  → Carries determinism attestation prop.
  → Does not subscribe to any state machine directly.
```

### 2.4 Implementing Live-Update Integration

```
Step 1: Backend event arrives. It carries:
  → traceId (required — must be propagated forward)
  → sequenceNumber (required — must be checked against last applied)
  → authority level (required — must be validated)

Step 2: Check sequence number against last applied.
  → If sequenceNumber ≤ last applied: discard event. Emit stale-event warning to observability.
  → If sequenceNumber > last applied: proceed.

Step 3: Validate authority.
  → AI orchestration signals: blocked at this boundary. Do not pass to state machine.
  → Other authority levels: pass the authority metadata with the transition request.

Step 4: Create a TransitionRequest with authority metadata.
  → Do not call machine.transition() directly with just a state name.
  → Always include: { toState, authority, sourceId, reason }

Step 5: The state machine applies or rejects the transition.
  → If rejected (illegal transition or not in authority): log TransitionAttempt, emit to sink.
  → If accepted: the state machine emits StateMutationEvent with traceId.

Step 6: UI re-renders from state machine subscription.
  → No component reads the backend event directly.
  → The state machine output is the source of truth.
```

### 2.5 Implementing Incident-Mode Behavior

```
Step 1: Incident-mode behavior is derived from the IncidentStateMachine state.
  → Components subscribe to IncidentStateMachine.
  → They do NOT receive an isIncident prop drilled from above.

Step 2: Map incident states to component behavior:
  → NOMINAL: full operational surface
  → WATCHING: shell shows advisory indicator only; no workspace change
  → DECLARED: workspace compresses to Stage 2 (per incident reality doc)
  → CONTAINED / RESOLVING: Stage 3 compression
  → CRITICAL: Stage 4 compression (incident surface replaces workspace)
  → TERMINAL: Stage 5 single-surface

Step 3: Verify incident-mode behavior does NOT:
  → Hide the LIVE/REPLAY mode indicator
  → Hide the session authority indicator
  → Hide active stale data warnings
  → Suppress the incident banner itself
  → Block the operator's one primary action button

Step 4: Add INCIDENT_MODE simulation test.
  → Inject incident at each severity level.
  → Verify workspace compression is correct for each level.
  → Verify shell surfaces remain visible at all levels.
  → Verify the single-next-action rule applies at Stage 3+.
```

---

## 3. REPLAY-SAFE IMPLEMENTATION CHECKLIST

Run this checklist before every PR that touches any code that could execute during replay.

```
REPLAY SAFETY CHECKLIST

Timestamps:
[ ] All timestamps use GovernedClock.now() — no Date.now(), new Date(), performance.now()
[ ] All duration calculations use GovernedClock deltas, not wall-clock deltas
[ ] Timeout/interval durations use governed constants, not inline literals

Network:
[ ] No fetch(), axios, XHR, or WebSocket calls from replay-bound component tree
[ ] No HTTP request initiated as a side effect of replay-mode rendering
[ ] Corpus data is consumed as received — no re-fetching from the corpus

State Machine:
[ ] No state transition triggered by a render side effect
[ ] All transitions use TransitionRequest with authority metadata
[ ] All transitions emit StateMutationEvent to the observability sink
[ ] replayFromHistory() test written for any new state path

PRE Boundary:
[ ] STALE state does not reach any renderer
[ ] FAILED state does not reach any renderer
[ ] During replay: PRE state is REPLAY_BOUND, not RESOLVED
[ ] Explanation content comes from corpus packet, not re-derived during replay

Observability:
[ ] All state transitions in this code have observability emission
[ ] traceId is propagated from originating backend event
[ ] Replay context (packetId, packetTimestamp) is attached to events during replay

Determinism:
[ ] No randomness in any function in the replay path
[ ] No branching on environment variables in the replay path
[ ] No memoization that persists across replay session boundaries
[ ] Function is annotated @replay-safe if in the replay path

Tests:
[ ] Corpus-backed REPLAY_PARITY test exists
[ ] 10-run hash consistency verified
[ ] replayFromHistory() covers this state path
```

---

## 4. PRE-BOUNDARY HANDLING — CONCRETE EXAMPLES

### 4.1 Correct Boundary Consumption

```typescript
// CORRECT: Pane consumes through boundary, not directly
function LivePlayerPane() {
  const { resolution, state } = usePREBoundary('live');
  // resolution is only non-null when state === 'RESOLVED' or 'REPLAY_BOUND'
  // boundary component has already enforced STALE/FAILED guards

  if (state === 'DEGRADED') {
    return <DegradedPaneView />;
  }

  return <ScheduleRenderer resolution={resolution} />;
}

// CORRECT: Content renderer receives only resolved data
function ScheduleRenderer({
  resolution,
  deterministicAttestation
}: {
  resolution: PREResolutionResult;
  deterministicAttestation: DeterminismAttestation;
}) {
  // No state machine subscriptions here
  // No data fetching here
  // Receives only what it renders
}
```

### 4.2 STALE Enforcement Example

```typescript
// CORRECT: Boundary enforces STALE before crossing
function PREResolutionBoundary({ children }: { children: React.ReactNode }) {
  const resolutionState = usePREStateMachine();

  if (resolutionState.state === 'STALE') {
    return (
      <DegradedResolutionFallback
        staleSince={resolutionState.lastResolvedAt}
        onForceResolve={() => resolutionState.dispatch({ type: 'FORCE_RESOLUTION' })}
      />
    );
  }

  if (resolutionState.state === 'FAILED') {
    return <ResolutionFailedSurface reason={resolutionState.failureReason} />;
  }

  if (resolutionState.state !== 'RESOLVED' && resolutionState.state !== 'REPLAY_BOUND') {
    return <ResolutionPendingSurface />;
  }

  // Only RESOLVED and REPLAY_BOUND cross the boundary
  return (
    <PREBoundaryContext.Provider value={resolutionState.resolution}>
      {children}
    </PREBoundaryContext.Provider>
  );
}
```

### 4.3 The Most Common PRE Boundary Violation

```typescript
// VIOLATION: Component reaches past the boundary
function SchedulePane() {
  // This bypasses the boundary entirely — no STALE guard
  const resolution = usePREStateMachine().resolution;
  // resolution could be null, STALE, or FAILED — this component doesn't know
}

// ALSO A VIOLATION: Pane fetches PRE data directly
function SchedulePane() {
  const { data } = useQuery('/api/pre/resolve'); // bypasses boundary AND state machine
}
```

---

## 5. FAST DIAGNOSIS LOOKUP TABLE

When something is broken, find your symptom and follow the diagnostic path.

| Symptom | Most Likely Cause | First Check |
|---|---|---|
| Replay produces different output on second run | GovernedClock bypass or randomness in replay path | Grep for `Date.now()` in replay-bound files |
| State machine final state differs after replayFromHistory() | Transition function has side effects or non-deterministic guard | Inspect transition guards for Date.now(), Math.random() |
| STALE data reaching a renderer | PRE boundary missing or not enforcing state guard | Check if boundary is rendering DegradedFallback on STALE |
| Incident banner not appearing | Incident state machine transition not reaching frontend | Check backend event → frontend event bus → IncidentStateMachine subscription |
| Incident banner appears but UI doesn't compress | Component not subscribed to IncidentStateMachine for compression logic | Check WorkspaceRoot's incident state subscription |
| Shell component crashes on incident | Error boundary swallowing shell failure | Remove error boundary from shell; surface failures |
| Content re-renders when unrelated state changes | Component subscribed to a context that changes too broadly (God Context) | Check subscription scope; narrow to specific state machine |
| Explanation missing during replay | Explanation re-derived from live engine during replay | Check ExplainabilityZone — must read from corpus packet, not useExplanationEngine() |
| Certification hash inconsistent across runs | Non-deterministic rendering (usually timestamps or env-dependent branching) | Run `pnpm test:replay-parity` with verbose mode; inspect first diverging hash |
| AI signal accepted as state transition | Authority validation not implemented on transition receiver | Add authority guard: reject if authority === 'AI_ORCHESTRATION' |
| Two panes sharing scroll state | Replay and live panes sharing a context or ref | Confirm replay pane has completely independent component tree from live pane |
| Sponsor content color conflicts with severity signal | Sponsor brand color in severity spectrum range | Run colorDistance check against all severity tokens |
| Operator action rejected silently | Event bus rejection not surfaced to operator | Check rejection handler for UI notification emission |
| New state machine state not appearing in corpus replay | New state not in replayFromHistory() test | Add the new state path to replayFromHistory() test and re-run replay suite |

---

## 6. COMMON ENGINEERING TRAPS MAPPED TO CONSTITUTIONAL VIOLATIONS

### Trap 1: "I'll just use a boolean flag for this"

```typescript
// TRAP
const [isInReplay, setIsInReplay] = useState(false);
const [isIncident, setIsIncident] = useState(false);

// WHY IT FAILS
// → Not serializable — cannot be replayed
// → Not synchronized with state machine — can drift
// → Not observable — no StateMutationEvent emitted
// → Multiple booleans combine into implicit states (isInReplay && isIncident — what does this mean?)

// CORRECT
const playerState = usePlayerStateMachine().state;
const incidentState = useIncidentStateMachine().state;
// State is authoritative, observable, serializable, replay-safe
```

**Constitutional violation:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md Section 10 (Forbidden Patterns: Boolean flags replacing state)

### Trap 2: "This context holds all the state; components just read what they need"

```typescript
// TRAP
const AppContext = createContext({
  playerState, preResolution, incidentState, sessionState, replayMode, ...
});
// Every component reads from AppContext

// WHY IT FAILS
// → Any update to AppContext re-renders all subscribers
// → Blast radius is unbounded — a session state change re-renders content renderers
// → Replay pane and live pane share state — contamination is guaranteed

// CORRECT
// Each component subscribes to exactly the state machine it is authorized to observe.
// No shared operational context object.
```

**Constitutional violation:** COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md Section 9.1 (God Context — forbidden)

### Trap 3: "Let me make this transition and the backend will confirm it"

```typescript
// TRAP
function startReplay(packetId: string) {
  playerMachine.setState('REPLAY'); // optimistic
  fetch('/api/replay/start', { body: { packetId } })
    .catch(() => playerMachine.setState('LIVE')); // rollback on failure
}

// WHY IT FAILS
// → Backend may return an error after UI has already changed
// → Any operator action taken during the optimistic window is on incorrect state
// → Rollback may not restore all side effects

// CORRECT
function startReplay(packetId: string) {
  playerMachine.setState('LOADING_REPLAY');
  fetch('/api/replay/start', { body: { packetId } })
    .then(() => playerMachine.setState('REPLAY'))
    .catch(() => playerMachine.setState('LIVE'));
}
```

**Constitutional violation:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md Section 8.3 (Optimistic State Transitions — Prohibited)

### Trap 4: "I'll add the observability later, first get it working"

The component works. It passes tests. No observability. Later: incident occurs, team cannot reconstruct what happened. The forensics chain is broken.

Observability is not an enhancement — it is part of the state machine contract. State transition without emission = the transition did not happen from the system's perspective.

**Constitutional violation:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md Section 9 (Observable State Mutation Requirements)

### Trap 5: "The simulation test is slow, I'll comment it out while iterating"

This is the most dangerous trap because it feels productive. Disabling the replay parity test unblocks fast iteration and creates a hidden divergence that may not be caught until it appears in production.

CI blocks on test disables. If the test is too slow, the solution is to optimize the test, not to disable it.

**Constitutional violation:** DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1.md Section 3.3 (Scope-Reduced Certification — forbidden)

---

## 7. REVIEW HEURISTICS FOR SENIOR ENGINEERS

When reviewing a pull request, apply these heuristics in order. The first issue found should be reported before reviewing the rest — multiple issues in a PR often share a root cause.

### Heuristic 1: The Boundary Audit (30 seconds)

Scan imports. Does any component outside `PREResolutionBoundary` import from the PRE state machine or resolution context? Does any content renderer import from a pane component? Flag immediately.

### Heuristic 2: The Timestamp Audit (60 seconds)

Grep for `Date.now()`, `new Date()`, `performance.now()` in the diff. Any hit in a non-test file is a constitutional violation. Verify the use is not in a replay path.

### Heuristic 3: The Optimism Audit (2 minutes)

Look for any state machine transition that precedes an async operation. If the transition happens before the backend confirms, it is optimistic. Ask: what happens if the backend call fails after this transition?

### Heuristic 4: The Mock Audit (2 minutes)

Does the PR include any new mock of a gate component (PRE engine, state machine runtime, corpus system) in a non-test context? Mock-that-stays prevention.

### Heuristic 5: The Test Reduction Audit (1 minute)

Does the PR reduce the number of tests, reduce iteration counts in replay parity tests, or add `skip()` or `only()` to simulation tests? This is a certification integrity issue.

### Heuristic 6: The Incident Path Audit (3 minutes)

If the PR touches the incident surface or incident-mode behavior: does the change maintain all the invariants from the "never hide during incident" list? Shell visible? LIVE/REPLAY distinct? Stale warnings present?

### Heuristic 7: The Myth Detector (1 minute)

Read code comments. Do any comments explain why a constitutional requirement doesn't apply in this specific case? These are Phase 1 drift events. They require a constitutional governance decision or an architectural debt entry — not just a comment.

---

## 8. "WHAT GOOD LOOKS LIKE" EXAMPLES

### Good: A state machine transition

```typescript
// Complete, correct transition with all required elements
function handleReplayRequested(packet: CorpusPacket, operatorId: string): void {
  const result = playerMachine.requestTransition({
    toState: 'LOADING_REPLAY',
    authority: 'OPERATOR',
    sourceId: operatorId,
    reason: `Replay requested for packet ${packet.id}`,
  });

  if (!result.allowed) {
    frontendObservabilitySink.emitTransitionRejection({
      machineId: 'player',
      fromState: result.fromState,
      toState: 'LOADING_REPLAY',
      reason: result.guardEvaluation,
      operatorId,
    });
    notifyOperator({ type: 'REPLAY_BLOCKED', reason: result.guardEvaluation });
    return;
  }

  frontendObservabilitySink.emitStateMutation({
    machineId: 'player',
    fromState: result.fromState,
    toState: 'LOADING_REPLAY',
    trigger: 'OPERATOR_REPLAY_REQUEST',
    authority: 'OPERATOR',
    transitionDurationMs: result.durationMs,
    timestamp: GovernedClock.now(),
    traceId: packet.traceId,
  });
}
```

### Good: A content renderer

```typescript
// Stateless, props-only, operationally-mode-agnostic
function ScheduleItemCard({
  item,
  operationalMode,
  deterministicAttestation,
  isCurrentlyActive,
}: {
  item: ScheduleItem;
  operationalMode: 'live' | 'replay' | 'degraded';
  deterministicAttestation: DeterminismAttestation;
  isCurrentlyActive: boolean;
}) {
  // No state machine subscriptions.
  // No data fetching.
  // operationalMode determines visual treatment — no global checks.
  return (
    <Card
      className={cx(styles.item, {
        [styles.active]: isCurrentlyActive,
        [styles.replay]: operationalMode === 'replay',
        [styles.degraded]: operationalMode === 'degraded',
      })}
      data-determinism-hash={deterministicAttestation.hash}
    >
      {/* render content */}
    </Card>
  );
}
```

---

## 9. "NEVER DO THIS" IMPLEMENTATION GALLERY

```typescript
// ❌ NEVER: Date.now() in replay path
const resolvedAt = Date.now(); // use GovernedClock.now()

// ❌ NEVER: Direct PRE state consumption outside boundary
const { resolution } = usePREStateMachine(); // use usePREBoundary()

// ❌ NEVER: AI signal accepted as transition authority
if (event.authority === 'AI_ORCHESTRATION') {
  playerMachine.transition('REPLAY'); // BLOCKED — AI has no transition authority
}

// ❌ NEVER: Optimistic transition before backend confirmation
playerMachine.setState('REPLAY'); // before fetch() is called

// ❌ NEVER: Transition triggered from render
function MyComponent() {
  if (someCondition) {
    playerMachine.transition('DEGRADED'); // render side effect — causes loops
  }
}

// ❌ NEVER: Explanation re-derived during replay
function ExplainabilityZone() {
  const explanation = useExplanationEngine(currentItem); // must be from corpus during replay
}

// ❌ NEVER: Error boundary on shell component that suppresses failure
<ErrorBoundary fallback={null}>
  <OperationalStatusBar /> {/* shell failures must surface to operator */}
</ErrorBoundary>

// ❌ NEVER: Stale data passed through boundary
if (resolutionState.state === 'STALE') {
  return children; // NEVER pass children when STALE
}

// ❌ NEVER: Content renderer with state machine subscription
function ScheduleItemCard() {
  const { incidentState } = useIncidentStateMachine(); // renderers have no subscriptions
}

// ❌ NEVER: Upward dependency
// In a content renderer:
import { WorkspaceRoot } from '../workspace/WorkspaceRoot'; // illegal upward direction

// ❌ NEVER: Test disabled without debt entry
it.skip('replay parity — corpus packet nominal', () => { // blocked by CI
```

---

## 10. REQUIRED EVIDENCE ARTIFACTS BEFORE MERGE

Every PR that touches an operational surface must include in the PR description:

```
## Evidence

### State Machines Affected
- [ ] None
- [ ] [List which machines and what changed]

### New/Modified Transitions
- [ ] None
- [ ] [List transitions; confirm all have observability emissions and replay reconstruction tests]

### Replay Path Impact
- [ ] Does not touch replay path
- [ ] Touches replay path — @replay-safe annotations added; replay parity test result: [PASS/FAIL]

### Simulation Categories Covered
- [ ] STATE_MACHINE tests: [count]
- [ ] COMPONENT_BOUNDARY tests: [count]
- [ ] REPLAY_PARITY tests: [count, hash consistency result]
- [ ] INCIDENT_MODE tests (if applicable): [count]

### PRE Boundary Impact
- [ ] No boundary change
- [ ] Boundary modified — STALE/FAILED guard tests added

### Certification
- [ ] pnpm certify: [PASS / not run — reason]

### Architectural Debt
- [ ] No new workarounds introduced
- [ ] New workaround: [AD-NNN] — [class] — [expiry date]
```

---

*Document status: CANONICAL — Execution Acceleration Era*
*Traces to: FRONTEND-STATE-MACHINE-ARCHITECTURE-v1, COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1, DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1, FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1*
