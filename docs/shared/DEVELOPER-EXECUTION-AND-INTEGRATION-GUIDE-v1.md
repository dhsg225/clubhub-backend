# DEVELOPER EXECUTION AND INTEGRATION GUIDE v1

**Era:** Implementation Bootstrap
**Status:** CANONICAL
**Scope:** Onboarding, development workflow, integration gates, certification, anti-patterns

---

## 1. PURPOSE

This document is the operational guide for engineers building the ClubHub TV frontend. It defines the constitutional development workflow — what you build, in what order, how you verify it, and how you certify it for deployment.

This is not a style guide. Non-compliance blocks deployment.

---

## 2. IMPLEMENTATION ONBOARDING

### 2.1 Required Reading Before Writing Code

Before writing any frontend code, read these documents in order:

1. `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md` — understand state authority
2. `COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md` — understand component topology
3. `FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1.md` — understand verification requirements
4. This document — understand the development workflow

### 2.2 Required Local Setup

```bash
# Install workspace
pnpm install

# Verify simulation runtime is functional
pnpm --filter @clubhub/player-frontend test:sim --scenario NOMINAL_LIVE_CYCLE

# Verify corpus packets are available
pnpm run verify-corpus

# Verify governed clock integration
pnpm --filter @clubhub/player-frontend test:unit governed-clock
```

All four commands must pass before beginning feature development.

### 2.3 Orientation Verification

Complete the orientation checklist before your first PR:

- [ ] Can locate the 5 canonical state machines and their state registries
- [ ] Can identify which component category (Shell, Workspace Container, Operational Pane, PRE-Boundary, Explainability, Content Renderer) each existing component belongs to
- [ ] Can run a single simulation scenario and read the output
- [ ] Can locate the PRE-Boundary component for the live player
- [ ] Can explain what happens when PRE resolution is STALE
- [ ] Can explain the difference between LIVE and REPLAY state machine behavior

---

## 3. CONSTITUTIONAL DEVELOPMENT WORKFLOW

Every feature follows this sequence. Steps are not skippable.

### Step 1: Identify the State Machine Impact

Before writing a line of implementation code, answer:
- Which state machine(s) does this feature affect?
- Does this feature add new states or transitions?
- Does this feature affect the REPLAY path?

If the answer to any of these is unclear, the feature is not ready to implement. Create a design document first.

**Gate:** If a new state or transition is required, it MUST be added to `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md` via a documented constitutional change before implementation begins.

### Step 2: Identify the Component Category

Determine which component category the new component belongs to (see `COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md` Section 2). If it doesn't fit cleanly into one category, split it until it does.

**Gate:** Mixed-category components are not permitted. If you cannot classify a component, raise it in architectural review before proceeding.

### Step 3: Write the Simulation Test First

Before implementing the component, write the simulation test that will verify it. Tests in the following categories are required for every new operational component:

- `STATE_MACHINE`: state transition legality
- `COMPONENT_BOUNDARY`: no illegal dependencies
- `RENDER_STABILITY`: no spurious re-renders

If the feature touches the replay path, also required:
- `REPLAY_PARITY`: corpus-backed determinism test
- `EXPLANATION_COMPLETENESS`: explanation for every new decision surface

**Gate:** Tests must exist (though they will fail until implementation is complete). No implementation without tests.

### Step 4: Implement Against the Test

Build the implementation to make the tests pass. Do not add functionality beyond what is tested.

Constitutional rules during implementation:
- Use `GovernedClock` for all timestamps (never `Date.now()`)
- Emit `StateMutationEvent` for every state transition
- Never bypass the PRE-Boundary for resolution data
- Never trigger state transitions via direct component calls

### Step 5: Run the Full Simulation Harness

```bash
pnpm --filter @clubhub/player-frontend test:sim
```

All 13 mandatory simulation scenarios must pass. If any fail, do not proceed.

### Step 6: Run the Replay Parity Suite

```bash
pnpm --filter @clubhub/player-frontend test:replay-parity
```

This runs 10 iterations of each corpus-backed test and verifies hash equivalence. Any divergence is a blocking failure.

### Step 7: Run the Component Boundary Checker

```bash
pnpm --filter @clubhub/player-frontend lint:boundaries
```

This verifies no illegal dependency directions exist. Violations produce a structured report. Fix all before PR.

### Step 8: Open PR with Certification Evidence

PRs must include in the description:
- Which state machines were affected (or "none")
- Simulation categories covered
- Replay parity result (pass/fail + run count)
- Component categories of new components
- Link to any architectural changes in governance docs

---

## 4. SAFE FEATURE INTEGRATION PROCESS

### 4.1 Feature Flag Usage

New features that affect operational state MUST be introduced behind a feature flag that is:
- Off by default in production
- Testable independently from existing behavior
- Integrated with the simulation harness (flag-on and flag-off scenarios both tested)

Feature flags for operational features are not permanent. They have a declared removal date in the PR that introduces them.

### 4.2 PRE Integration Pattern

When integrating a new data source from PRE resolution:

1. Define the data type in the PRE boundary contract
2. Add the resolution to the PRE-Boundary component's validation logic
3. Write a corpus test packet that includes the new data
4. Write the PRE_BOUNDARY and REPLAY_PARITY tests
5. Implement the renderer as a leaf Content Renderer component
6. Never let the new data bypass the boundary

### 4.3 State Machine Extension Pattern

When adding a state or transition:

1. Update `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md` (requires architectural review)
2. Update the state machine implementation
3. Add transition guard tests
4. Add replay reconstruction tests for the new path
5. Update the observability emission contract
6. Update simulation scenarios that may be affected

Do NOT add states by extending boolean flags or conditional context values. State machine changes are explicit and documented.

---

## 5. FRONTEND CERTIFICATION WORKFLOW

### 5.1 Certification Gate

A frontend build is certified for deployment when all of the following pass:

```
[ ] Unit tests: all STATE_MACHINE tests pass
[ ] Unit tests: all COMPONENT_BOUNDARY tests pass
[ ] Simulation: all 13 MANDATORY_SIMULATION_SCENARIOS pass
[ ] Replay parity: all corpus scenarios produce identical hash across 10 runs
[ ] Boundary checker: zero illegal dependency directions
[ ] Observability: all state transitions emit StateMutationEvent (verified by integration test)
[ ] Explanation completeness: all decision surfaces have explanation (verified by corpus test)
[ ] Shell stability: shell components do not crash in any simulation scenario
[ ] Tree-shake verification: no simulation harness components in production bundle
```

### 5.2 Certification Command

```bash
pnpm --filter @clubhub/player-frontend certify

# Output:
# [PASS] STATE_MACHINE (47 tests)
# [PASS] COMPONENT_BOUNDARY (12 tests)
# [PASS] SIMULATION (13 scenarios)
# [PASS] REPLAY_PARITY (9 corpus packets × 10 runs)
# [PASS] OBSERVABILITY_COVERAGE (all transitions emitting)
# [PASS] EXPLANATION_COMPLETENESS (all decision surfaces covered)
# [PASS] SHELL_STABILITY (no crashes in 13 scenarios)
# [PASS] BUNDLE_PURITY (no harness components in production bundle)
#
# CERTIFICATION: PASS
# Evidence hash: sha256:abc123...
# Valid for: 24h from this run
```

Certification evidence is attached to the deployment artifact. Deployments without valid certification are rejected by CI.

### 5.3 Certification Evidence Format

```typescript
interface FrontendCertificationEvidence {
  certifiedAt: string;          // ISO8601
  certificationHash: string;    // sha256 of all test results
  gitCommit: string;
  buildId: string;
  results: {
    [category: string]: {
      passed: number;
      failed: number;
      skipped: number;
    };
  };
  replayParityResults: {
    corpusPacketId: string;
    runCount: number;
    hashConsistency: 'PASS' | 'FAIL';
    outputHash: string;
  }[];
  validUntil: string;           // certifications expire after 24h
}
```

---

## 6. REQUIRED ARCHITECTURAL REVIEW GATES

The following changes REQUIRE architectural review before implementation:

| Change Type | Review Required | Reason |
|---|---|---|
| New state or transition in any canonical state machine | YES | Changes operational truth model |
| New component that spans multiple categories | YES | Boundary violation risk |
| New data type crossing the PRE boundary | YES | Operational truth surface change |
| Changes to explainability rendering | YES | Operator cognition impact |
| Changes to shell components | YES | Always-visible surface impact |
| Changes to incident-mode behavior | YES | Incident safety impact |
| Changes to replay pane component tree | YES | Corpus integrity impact |
| New cross-machine event type | YES | Causality model change |
| Changes to GovernedClock integration | YES | Determinism impact |

Architectural review is a PR review from a designated frontend governance reviewer. Not a committee meeting — a documented code review with explicit sign-off.

---

## 7. REPLAY-SENSITIVE DEVELOPMENT RULES

When working on any code in the replay path:

### 7.1 Never Use Wall Clock

All timestamps in the replay path MUST come from `GovernedClock`. Using `Date.now()`, `new Date()`, or `performance.now()` in the replay path is a constitutional violation and will be flagged by the linter.

```typescript
// VIOLATION — detected by lint:replay-safety
const timestamp = Date.now();

// CORRECT
import { GovernedClock } from '@clubhub/governed-clock';
const timestamp = GovernedClock.now();
```

### 7.2 Never Fetch During Replay

No `fetch`, `axios`, or any network call may be initiated from within the replay-bound component tree. All data comes from the corpus packet. Network calls in the replay path will be detected by the simulation harness.

### 7.3 Never Derive Explanations During Replay

Explanation content during replay MUST be taken from the corpus packet's `explanationPayload`. Do not call the explanation engine during replay. The explanation engine is a live-only concern.

### 7.4 Never Mutate Corpus Data

Corpus packet data is read-only. Components MUST NOT modify the resolution result or explanation payload they receive from a corpus packet. Mutations are detected by the determinism verifier.

### 7.5 Mark Replay-Path Code

Files and functions that execute in the replay path MUST be annotated:

```typescript
/**
 * @replay-safe
 * This function executes in both live and replay contexts.
 * Requirements: pure function, no network calls, uses GovernedClock.
 */
function buildRenderState(resolution: PREResolutionResult): RenderState {
  // ...
}
```

The `@replay-safe` annotation is checked by the linter. Unannotated functions in the replay path trigger a warning. Functions annotated `@replay-safe` that contain `Date.now()` or network calls trigger an error.

---

## 8. OPERATIONAL INTEGRITY CHECKLIST

Before every PR targeting the operational frontend:

```
PRE-SUBMISSION CHECKLIST

State Machine:
[ ] No new boolean flags replacing state machine states
[ ] No transitions triggered from render functions
[ ] All new transitions documented in state machine architecture
[ ] All transitions emit StateMutationEvent
[ ] GovernedClock used for all timestamps in state machine

Component Structure:
[ ] Every new component belongs to exactly one category
[ ] No upward dependencies introduced
[ ] No direct cross-component state sharing
[ ] No AI signal accepted as state transition trigger

Replay Safety:
[ ] No Date.now() in replay path
[ ] No network calls from replay-bound tree
[ ] Explanation content taken from corpus, not re-derived
[ ] Corpus data not mutated
[ ] Replay-path functions annotated @replay-safe

Testing:
[ ] Simulation tests written before implementation
[ ] Replay parity tests pass with 10-run hash consistency
[ ] Mandatory simulation scenarios all passing
[ ] Explanation completeness test passes

PRE Boundary:
[ ] No new PRE data bypasses the boundary component
[ ] STALE and FAILED states never reach renderers
[ ] New data types validated at boundary before crossing

Shell:
[ ] Shell components not conditionally hidden
[ ] Shell components not dependent on workspace state
[ ] Shell failures not silently swallowed
```

---

## 9. FRONTEND OBSERVABILITY INTEGRATION

### 9.1 Required Observability Sinks

Every frontend build must integrate with:

```typescript
import { frontendObservabilitySink } from '@clubhub/observability';

// State mutation events
frontendObservabilitySink.emitStateMutation(event: StateMutationEvent);

// Render records (sampled, not every render)
frontendObservabilitySink.emitRenderRecord(record: RenderRecord);

// Interaction events
frontendObservabilitySink.emitInteractionEvent(event: InteractionEvent);

// Boundary crossing events
frontendObservabilitySink.emitBoundaryCrossing(event: BoundaryCrossingEvent);
```

### 9.2 Observability Completeness Requirement

The observability integration test verifies:
- Every state transition emits to the sink
- Every PRE boundary crossing emits to the sink
- Every operator interaction emits to the sink
- No batch delay greater than 100ms for state mutation events

Observability incompleteness is a deployment-blocking failure.

### 9.3 Trace Correlation

Every frontend observability event MUST carry the `traceId` from the originating backend operation. This enables correlated audit of frontend state with backend PRE resolution decisions.

```typescript
// When handling a backend event:
const event = receiveBackendEvent();
frontendObservabilitySink.emitStateMutation({
  ...mutationDetails,
  traceId: event.traceId,   // propagated from backend
});
```

---

## 10. SAFE ROLLOUT SEQUENCING

Frontend deployments follow this sequence:

### Stage 1: Simulation Environment
- Full simulation harness runs against new build
- All 13 mandatory scenarios must pass
- Replay parity verified

### Stage 2: Staging Fleet
- Deployed to 1 staging screen
- Operator performs manual walkthrough against the operational integrity checklist
- Replay is initiated and verified against a known corpus packet
- Incident declaration tested

### Stage 3: Pilot Fleet (5%)
- Deployed to 5% of active screens
- Observability sink monitored for:
  - Any TERMINAL state entries
  - Any unexplained state machine divergence
  - Explanation coverage drop below 100%
  - Render stability regressions
- 24h soak minimum

### Stage 4: Progressive Rollout (25% → 50% → 100%)
- Each stage: 24h minimum soak
- Each stage: no deployment-blocking observability signals
- Rollback is automatic if terminal states or explanation failures exceed threshold

---

## 11. IMPLEMENTATION ANTI-PATTERNS

These are the most common constitutional violations. Do not do any of these.

### AP-1: The Ambient Flag
```typescript
// VIOLATION
let isInReplay = false;
function setReplayMode(v: boolean) { isInReplay = v; }

// Each component checks this flag:
if (isInReplay) { /* replay behavior */ }
```
**Why forbidden:** Non-serializable, non-replayable, invisible to state machines.

### AP-2: The God Context
```typescript
// VIOLATION
const AppContext = createContext({
  playerState, preResolution, incidentState, sessionState, isReplay, ...everything
});
// Every component consumes AppContext
```
**Why forbidden:** Unbounded blast radius, invisible dependencies, prevents pane isolation.

### AP-3: The Optimistic Transition
```typescript
// VIOLATION
function startReplay(packetId: string) {
  playerMachine.transition('REPLAY');  // immediately
  fetch('/api/replay/start', { body: { packetId } });  // backend call later
}
```
**Why forbidden:** Frontend state diverges from backend state if the request fails.

### AP-4: The Inline Mode Branch
```typescript
// VIOLATION
function SchedulePane({ isReplay, isIncident, isDegraded, isElevated }) {
  if (isReplay) { return <ReplayLayout />; }
  if (isIncident) { return <IncidentLayout />; }
  // ...
}
```
**Why forbidden:** Mode logic belongs in the state machine and container. Content components are mode-agnostic.

### AP-5: The Direct Machine Call
```typescript
// VIOLATION
function IncidentBanner({ onAcknowledge }) {
  function handleClick() {
    playerMachine.transition('INCIDENT');  // pane directly calling state machine
    incidentMachine.transition('DECLARED');  // and another
  }
}
```
**Why forbidden:** Component owns the state machines it shouldn't. Cross-machine coordination must be via events.

### AP-6: The Bypassed Boundary
```typescript
// VIOLATION — fetching PRE data directly in a pane
function LivePlayerPane() {
  const resolution = usePREQuery();  // bypasses boundary, no attestation
}
```
**Why forbidden:** Bypasses determinism attestation, STALE guard, and boundary crossing observability.

### AP-7: The Swallowed Shell Error
```typescript
// VIOLATION
<ErrorBoundary fallback={null}>  // shell error hidden from operator
  <OperationalStatusBar />
</ErrorBoundary>
```
**Why forbidden:** Shell failures must surface to the operator, not be silently suppressed.

### AP-8: The Re-derived Explanation
```typescript
// VIOLATION — during replay, calling the live explanation engine
function ExplainabilityZone({ item }) {
  const explanation = useExplanationEngine(item);  // re-derives, not from corpus
}
```
**Why forbidden:** Explanation must match corpus exactly. Re-derivation may produce different results.

---

## 12. COMMON CONSTITUTIONAL VIOLATIONS

| Violation | Symptom | Root Cause | Fix |
|---|---|---|---|
| Stale data presented as authoritative | Operator sees outdated schedule without warning | PRE boundary not checking resolution state | Add state guard at boundary |
| Replay contaminating live | Live content incorrect after replay exit | Shared state between replay/live pane | Separate pane trees, no shared state |
| State machine divergence under replay | Replayed history produces different final state | Non-deterministic transition function (uses Date.now() or random) | Replace with GovernedClock, eliminate randomness |
| Shell crashes during incident | Operator loses all operational visibility | Error boundary swallowing shell failures | Remove error boundary from shell, surface failures |
| Explanation missing during replay | Explainability zone empty during replay | Explanation re-derived from live engine instead of corpus | Read explanation from corpus packet |
| AI signal accepted | Unauthorized state transition | No authority validation on transition | Add authority guard to transition function |
| Duplicate re-renders | Janky UI, performance degradation | State machine subscription at wrong level | Move subscription to authorized pane level only |

---

## 13. CERTIFICATION EVIDENCE EXPECTATIONS

When submitting for production certification, provide:

```
1. CERTIFICATION_EVIDENCE.json
   - certifiedAt
   - certificationHash
   - gitCommit
   - buildId
   - all test results

2. SIMULATION_REPORT.md
   - each mandatory scenario: pass/fail
   - any conditional passes with documented context
   - replay parity results (10-run hash table)

3. ARCHITECTURAL_CHANGE_SUMMARY.md (if any architectural changes)
   - which state machines changed
   - which component categories changed
   - architectural review sign-offs

4. OBSERVABILITY_COVERAGE_REPORT.json
   - % of state transitions with observability coverage
   - any gaps with justification
```

Deployments without complete evidence are rejected at the CI gate.

---

*Document status: CANONICAL — Implementation Bootstrap Era*
*Do not modify without constitutional governance review*
