# FRONTEND TESTING AND SIMULATION HARNESS v1

**Era:** Implementation Bootstrap
**Status:** CANONICAL
**Scope:** Replay-backed testing, operational simulation, deterministic verification, certification gates

---

## 1. PURPOSE

This document defines the complete testing and simulation architecture for the ClubHub TV frontend. Tests are not optional coverage targets — they are the primary mechanism by which operational safety is verified before deployment.

A frontend that cannot be verified against corpus replay, degraded-mode simulation, and multi-operator concurrency is not deployable.

---

## 2. TEST CATEGORY REGISTRY

Every test in the frontend harness belongs to one of the following categories. Category membership determines deployment-blocking status and simulation requirements.

| Category | Deployment Blocking | Replay Required | Description |
|---|---|---|---|
| STATE_MACHINE | YES | YES | State machine transition legality and determinism |
| PRE_BOUNDARY | YES | YES | PRE resolution boundary behavior |
| REPLAY_PARITY | YES | YES | Live vs replay rendering equivalence |
| DEGRADED_MODE | YES | NO | Frontend behavior under connectivity loss |
| INCIDENT_MODE | YES | NO | Frontend behavior during active incident |
| OPERATOR_CONCURRENCY | YES | NO | Multi-operator simultaneous action safety |
| EXPLANATION_COMPLETENESS | YES | YES | Explanation availability for every decision surface |
| RENDER_STABILITY | YES | NO | Anti-jitter, causal ordering, no spurious re-renders |
| STALE_STATE | YES | YES | Frontend behavior on stale PRE resolution |
| COMPONENT_BOUNDARY | YES | NO | Dependency direction, isolation, blast radius |
| INTEGRATION | YES | YES | Cross-component causality via event bus |
| CERTIFICATION | YES | YES | Full operational scenario end-to-end |
| PERFORMANCE | NO | NO | Render timing, memory, frame rate (non-blocking but tracked) |

---

## 3. REPLAY-BACKED FRONTEND TESTING

### 3.1 Corpus Packet as Test Fixture

Every frontend test that touches PRE resolution MUST be backed by a corpus packet — the same corpus used by the backend replay system.

```typescript
interface FrontendReplayFixture {
  packetId: string;
  packetTimestamp: string;        // ISO8601
  resolutionResult: PREResolutionResult;
  explanationPayload: ExplanationPayload;
  determinismHash: string;        // used to verify frontend doesn't mutate
  manifestSnapshot: ManifestSnapshot;
  expectedRenderState: ExpectedRenderState;
}
```

Test setup loads the corpus packet, feeds it through the PRE-Boundary component, and asserts the rendered output matches `expectedRenderState`.

### 3.2 Determinism Verification Test

```typescript
describe('PRE Boundary Determinism', () => {
  it('renders identically across N invocations for same corpus packet', async () => {
    const fixture = loadCorpusPacket('EDGE-001-replacement');
    const results: string[] = [];

    for (let i = 0; i < 10; i++) {
      const rendered = await renderWithCorpusPacket(fixture);
      results.push(rendered.deterministicHash());
    }

    // All renders must produce identical hash
    expect(new Set(results).size).toBe(1);
  });
});
```

### 3.3 Replay Reconstruction Test

```typescript
describe('State Machine Replay Reconstruction', () => {
  it('reconstructs final state from event history deterministically', async () => {
    const { machine, history } = await runPlayerScenario('nominal-live-to-replay');

    const finalStateLive = machine.getState();
    const finalStateReplayed = machine.replayFromHistory(history);

    expect(finalStateReplayed).toBe(finalStateLive);
  });
});
```

### 3.4 Required Corpus Scenarios

These corpus scenarios MUST have frontend tests:

| Scenario | Test Focus |
|---|---|
| `nominal-live` | Standard live rendering, explanation surface |
| `nominal-replay` | Replay rendering, historical explanation |
| `degraded-partial-manifest` | Degraded mode rendering, fallback content |
| `incident-declared` | Incident mode surface, shell escalation |
| `stale-resolution` | Stale boundary rendering, no content pass-through |
| `resolution-failed` | Failed boundary rendering, operator notification |
| `replay-integrity-fail` | Replay abort, operator error surface |
| `live-to-replay-transition` | Transition safety, pane isolation |
| `replay-to-live-transition` | Re-sync after replay, no live contamination |

---

## 4. OPERATIONAL SIMULATION HARNESSES

### 4.1 Simulation Runtime Interface

The frontend simulation runtime provides a controllable environment for testing operational behavior:

```typescript
interface FrontendSimulationRuntime {
  // Clock control
  setGovernedTime(timestamp: string): void;
  advanceTime(ms: number): void;

  // Network simulation
  setNetworkCondition(condition: NetworkCondition): void;
  dropNextNRequests(n: number): void;
  addLatency(ms: number): void;

  // Backend event injection
  injectBackendEvent(event: BackendEvent): void;
  injectIncidentDeclaration(incident: IncidentPayload): void;
  injectPREResolution(resolution: PREResolutionResult): void;
  injectPREFailure(reason: string): void;

  // Operator simulation
  simulateOperatorAction(action: OperatorAction): void;
  simulateConcurrentOperators(count: number, actions: OperatorAction[]): void;

  // State inspection
  getStateMachineState(machineId: string): string;
  getEventBusHistory(): OperationalEvent[];
  getRenderHistory(): RenderRecord[];
  getObservabilityEmissions(): StateMutationEvent[];
}
```

### 4.2 Network Condition Presets

```typescript
const NETWORK_CONDITIONS = {
  NOMINAL:              { latencyMs: 20,   packetLoss: 0,    bandwidth: 'unlimited' },
  DEGRADED_WIFI:        { latencyMs: 250,  packetLoss: 0.05, bandwidth: '2mbps' },
  POOR_4G:              { latencyMs: 400,  packetLoss: 0.10, bandwidth: '500kbps' },
  INTERMITTENT:         { latencyMs: 100,  packetLoss: 0.30, bandwidth: '1mbps' },
  OFFLINE:              { latencyMs: null, packetLoss: 1.0,  bandwidth: '0' },
  BACKEND_UNREACHABLE:  { latencyMs: null, packetLoss: 1.0,  bandwidth: 'unlimited', backendDown: true },
} as const;
```

---

## 5. DETERMINISTIC RENDERING VERIFICATION

### 5.1 Render Hash Verification

Every operational render produces a deterministic hash of its visible content. This hash is:
- Computed from the rendered DOM tree structure + content (not timing or session-specific data)
- Stored in the render record
- Compared against the expected hash from the corpus packet

```typescript
interface RenderRecord {
  componentId: string;
  renderTimestamp: string;       // GovernedClock
  inputHash: string;             // hash of all inputs (props + state machine state)
  outputHash: string;            // hash of rendered output
  deterministicAttestationHash: string;   // from PRE boundary
  replayContext?: string;        // packetId if in replay
}
```

### 5.2 Anti-Jitter Verification

```typescript
describe('Render Stability — Anti-Jitter', () => {
  it('does not re-render content renderers when unrelated state changes', async () => {
    const { sim, getRenderCounts } = createSimulation();
    await sim.loadScenario('nominal-live');

    const baselineCounts = getRenderCounts('ScheduleItemCard');

    // Inject unrelated state change (session expiry warning)
    sim.injectBackendEvent({ type: 'session:expiry-warning' });
    await sim.waitForSettled();

    const newCounts = getRenderCounts('ScheduleItemCard');

    // Content renderers must not have re-rendered
    expect(newCounts).toEqual(baselineCounts);
  });
});
```

### 5.3 Causal Order Verification

```typescript
describe('Render Causality', () => {
  it('renders shell updates before workspace updates on incident declaration', async () => {
    const { sim, getRenderOrder } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.injectIncidentDeclaration({ level: 'DECLARED', reason: 'test' });
    await sim.waitForSettled();

    const renderOrder = getRenderOrder(['IncidentBanner', 'LivePlayerPane']);

    // Shell must render before workspace
    expect(renderOrder.indexOf('IncidentBanner'))
      .toBeLessThan(renderOrder.indexOf('LivePlayerPane'));
  });
});
```

---

## 6. INTERACTION SAFETY TESTING

### 6.1 Interaction Lock Enforcement

```typescript
describe('Interaction Locks', () => {
  it('disables playback controls during SYNCING', async () => {
    const { sim, getControlState } = createSimulation();
    sim.setNetworkCondition(NETWORK_CONDITIONS.DEGRADED_WIFI);
    await sim.triggerPlayerTransition('SYNCING');

    const controls = getControlState('PlaybackControls');
    expect(controls.enabled).toBe(false);
    expect(controls.lockReason).toBe('SYNCING');
  });

  it('re-enables controls after SYNCING completes', async () => {
    const { sim, getControlState } = createSimulation();
    await sim.triggerPlayerTransition('SYNCING');
    await sim.resolvePREResolution('nominal');

    const controls = getControlState('PlaybackControls');
    expect(controls.enabled).toBe(true);
  });
});
```

### 6.2 Stale Transition Invalidation

```typescript
describe('Stale Transition Invalidation', () => {
  it('discards async result if machine state changed before completion', async () => {
    const { sim, getStateMachineState } = createSimulation();

    // Initiate async transition
    const token = sim.beginAsyncTransition('player', 'LIVE', 'REPLAY');

    // Machine moves to different state before async completes
    sim.simulateOperatorAction({ type: 'suspend-playback' });
    await sim.waitForSettled();

    // Deliver stale async result
    sim.deliverAsyncTransitionResult(token, { success: true });
    await sim.waitForSettled();

    // Machine should be SUSPENDED, not REPLAY
    expect(getStateMachineState('player')).toBe('SUSPENDED');
  });
});
```

---

## 7. MULTI-OPERATOR CONCURRENCY SIMULATION

### 7.1 Concurrent Action Safety

```typescript
describe('Multi-Operator Concurrency', () => {
  it('serializes concurrent replay initiation from two operators', async () => {
    const { sim, getStateMachineState, getEventBusHistory } = createSimulation();
    await sim.loadScenario('nominal-live');

    // Two operators simultaneously attempt to start replay
    await sim.simulateConcurrentOperators(2, [
      { type: 'initiate-replay', packetId: 'packet-A', operatorId: 'op-1' },
      { type: 'initiate-replay', packetId: 'packet-B', operatorId: 'op-2' },
    ]);

    await sim.waitForSettled();

    // Only one replay should be active
    const state = getStateMachineState('player');
    expect(state).toBe('REPLAY');

    // Exactly one replay should have been initiated (second rejected)
    const replayEvents = getEventBusHistory().filter(e => e.type === 'replay:initiated');
    expect(replayEvents.length).toBe(1);

    // The rejected operator should have received an error surface
    const rejectionEvents = getEventBusHistory().filter(e => e.type === 'replay:concurrency-rejection');
    expect(rejectionEvents.length).toBe(1);
  });
});
```

### 7.2 Session Authority Concurrency

```typescript
describe('Session Elevation Concurrency', () => {
  it('prevents two operators from holding elevation simultaneously', async () => {
    const { sim } = createSimulation();

    sim.simulateOperatorAction({ type: 'request-elevation', operatorId: 'op-1' });
    await sim.waitForSettled();

    sim.simulateOperatorAction({ type: 'request-elevation', operatorId: 'op-2' });
    await sim.waitForSettled();

    // Only op-1 should hold elevation
    const elevatedOperators = sim.getElevatedOperators();
    expect(elevatedOperators).toHaveLength(1);
    expect(elevatedOperators[0]).toBe('op-1');
  });
});
```

---

## 8. DEGRADED-MODE SIMULATION

### 8.1 Connectivity Loss Scenarios

```typescript
describe('Degraded Mode — Backend Unreachable', () => {
  it('transitions to DEGRADED without crashing', async () => {
    const { sim, getStateMachineState } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.setNetworkCondition(NETWORK_CONDITIONS.BACKEND_UNREACHABLE);
    await sim.advanceTime(PRE_RESOLUTION_TIMEOUT_MS + 100);

    expect(getStateMachineState('player')).toBe('DEGRADED');
  });

  it('shows degraded indicator in shell during DEGRADED state', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.setNetworkCondition(NETWORK_CONDITIONS.BACKEND_UNREACHABLE);
    await sim.advanceTime(PRE_RESOLUTION_TIMEOUT_MS + 100);

    const shell = getRenderedContent('OperationalStatusBar');
    expect(shell.connectivityStatus).toBe('DEGRADED');
    expect(shell.degradedIndicatorVisible).toBe(true);
  });

  it('does not show stale PRE resolution as authoritative during DEGRADED', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.setNetworkCondition(NETWORK_CONDITIONS.BACKEND_UNREACHABLE);
    await sim.advanceTime(STALE_THRESHOLD_MS + 100);

    const pane = getRenderedContent('LivePlayerPane');
    expect(pane.resolutionStatus).toBe('STALE');
    expect(pane.showingStaleWarning).toBe(true);
    expect(pane.presentingAsAuthoritative).toBe(false);
  });
});
```

### 8.2 Partial Manifest Degradation

```typescript
describe('Degraded Mode — Partial Manifest', () => {
  it('renders available content with explicit partial indicator', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadScenario('degraded-partial-manifest');

    const pane = getRenderedContent('LivePlayerPane');
    expect(pane.partialManifestIndicatorVisible).toBe(true);
    expect(pane.renderedSlots.some(s => s.isFallback)).toBe(true);
  });
});
```

---

## 9. INCIDENT-MODE SIMULATION

### 9.1 Incident Escalation Behavior

```typescript
describe('Incident Mode', () => {
  it('surfaces incident banner immediately on DECLARED', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.injectIncidentDeclaration({ level: 1, reason: 'threshold-breach' });
    await sim.waitForSettled();

    const shell = getRenderedContent('IncidentBanner');
    expect(shell.visible).toBe(true);
    expect(shell.level).toBe(1);
    expect(shell.requiresAcknowledgment).toBe(true);
  });

  it('blocks replay initiation during active incident', async () => {
    const { sim, getStateMachineState } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.injectIncidentDeclaration({ level: 2, reason: 'cascade' });
    await sim.waitForSettled();

    sim.simulateOperatorAction({ type: 'initiate-replay', packetId: 'any' });
    await sim.waitForSettled();

    // Player must remain in INCIDENT or LIVE, not REPLAY
    const state = getStateMachineState('player');
    expect(['INCIDENT', 'LIVE', 'DEGRADED']).toContain(state);
    expect(state).not.toBe('REPLAY');
  });

  it('workspace minimizes to incident surface on level-3 incident', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadScenario('nominal-live');

    sim.injectIncidentDeclaration({ level: 3, reason: 'critical' });
    await sim.waitForSettled();

    const workspace = getRenderedContent('WorkspaceRoot');
    expect(workspace.activeMode).toBe('INCIDENT_SURFACE');

    const shell = getRenderedContent('ShellZone');
    expect(shell.visible).toBe(true);  // shell must always be visible
  });
});
```

---

## 10. EXPLANATION COMPLETENESS VERIFICATION

### 10.1 Explanation Coverage Test

```typescript
describe('Explanation Completeness', () => {
  it('every schedule decision has an explanation surface', async () => {
    const { sim, getRenderedContent } = createSimulation();
    await sim.loadCorpusPacket('nominal-live');

    const scheduleItems = getRenderedContent('LivePlayerPane').scheduleItems;
    const explanations = getRenderedContent('ExplainabilityZone').explanations;

    // Every rendered schedule item must have a corresponding explanation
    for (const item of scheduleItems) {
      const explanation = explanations.find(e => e.targetItemId === item.id);
      expect(explanation).toBeDefined();
      expect(explanation.causalChain.length).toBeGreaterThan(0);
      expect(explanation.resolverChain.length).toBeGreaterThan(0);
    }
  });

  it('replay explanation matches corpus packet, not re-derived', async () => {
    const { sim, getRenderedContent } = createSimulation();
    const packet = await sim.loadCorpusPacket('nominal-replay');

    await sim.enterReplayMode(packet.packetId);

    const explanations = getRenderedContent('ExplainabilityZone').explanations;
    const corpusExplanation = packet.explanationPayload.items[0];
    const renderedExplanation = explanations[0];

    // Must match corpus exactly
    expect(renderedExplanation.deterministicHash)
      .toBe(corpusExplanation.deterministicHash);
  });
});
```

---

## 11. RENDER STABILITY TESTING

### 11.1 Re-render Frequency Validation

```typescript
describe('Render Stability', () => {
  it('content renderers render at most once per PRE resolution update', async () => {
    const { sim, getRenderCounts } = createSimulation();
    await sim.loadScenario('nominal-live');

    const before = getRenderCounts('ScheduleItemCard');

    // Inject exactly one PRE resolution update
    sim.injectPREResolution(buildNominalResolution());
    await sim.waitForSettled();

    const after = getRenderCounts('ScheduleItemCard');

    // Each card renders at most once
    for (const cardId of Object.keys(before)) {
      expect(after[cardId] - before[cardId]).toBeLessThanOrEqual(1);
    }
  });
});
```

---

## 12. MANDATORY SIMULATION CATEGORIES

The following simulation scenarios MUST pass before any frontend deployment is permitted:

```typescript
const MANDATORY_SIMULATION_SCENARIOS = [
  'NOMINAL_LIVE_CYCLE',         // full live session, state machine completeness
  'LIVE_TO_REPLAY_ROUNDTRIP',   // transition safety, no contamination
  'BACKEND_UNREACHABLE_60S',    // 60 seconds offline, graceful degradation
  'INCIDENT_LEVEL_1_TO_5',      // full escalation path
  'CONCURRENT_OPERATORS_3',     // 3 operators simultaneous, no race conditions
  'STALE_RESOLUTION_RECOVERY',  // stale → re-resolution → live
  'REPLAY_INTEGRITY_FAIL',      // corrupted packet, abort and surface
  'SESSION_EXPIRY_MID_OPERATION', // operator session expires during workflow
  'PARTIAL_MANIFEST_LIVE',      // degraded content, explicit fallbacks
  'EXPLANATION_ALL_SURFACES',   // every decision surface has explanation
] as const;
```

If any of these fail, the deployment is blocked regardless of other test results.

---

## 13. DEPLOYMENT-BLOCKING FAILURES

The following failures are ALWAYS deployment-blocking:

| Failure | Reason |
|---|---|
| State machine produces different final state on replay | Determinism violation |
| PRE boundary passes STALE data to renderer | Operational truth violation |
| Replay pane reads live PRE state | Corpus contamination |
| Shell component crashes silently | Operator awareness violation |
| Content renderer renders without determinism attestation | Invisible authority violation |
| Explanation missing for any rendered decision | Explainability violation |
| Incident declaration not surfaced within 500ms | Incident cognition failure |
| Any state transition without observability emission | Invisible mutation |
| Upward component dependency detected | Boundary violation |
| AI signal accepted as state transition authority | Constitutional violation |
| Production component imports simulation component | Test contamination |

---

## 14. REPLAY PARITY VALIDATION RULES

A frontend implementation passes replay parity validation if and only if:

1. The hash of the rendered output for a given corpus packet is identical across N≥10 runs
2. The state machine final state after replaying event history matches live final state
3. No network requests are made from the replay-bound component tree
4. The explanation rendered during replay matches the corpus explanation exactly
5. The replay-to-live transition does not carry any replay-context data into live state
6. GovernedClock is used for all timestamps (no Date.now() in replay path)

---

## 15. OPERATOR COGNITION VERIFICATION STANDARDS

Tests asserting operator cognition must verify:

```typescript
interface OperatorCognitionAssertion {
  // Every operational change is visible
  stateChangeVisibleWithin: 500;     // ms

  // Every decision is explainable
  explanationAvailableFor: 'ALL_SCHEDULE_DECISIONS';

  // Degraded mode is never ambiguous
  degradedModeIndicatorVisible: true;
  stalePresentedAsAuthoritative: false;

  // Incident is never silent
  incidentNotificationWithin: 500;   // ms of declaration

  // Replay is never mistaken for live
  replayModeIndicatorVisible: true;
  replayTimestampVisible: true;
}
```

Cognition tests run against the simulation runtime with operator-perspective rendering assertions.

---

*Document status: CANONICAL — Implementation Bootstrap Era*
*Do not modify without constitutional governance review*
