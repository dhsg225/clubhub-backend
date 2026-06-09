# ClubHub TV — Operational Frontend Observability
# Implementation Translation Era — Operational Frontend Execution Standards

**Document type:** Implementation governance — frontend observability requirements and audit trail standards
**Authority:** Agent 3 (UX Architecture / Rendering Integrity); Agent 2 defines backend observability integration points
**Audience:** Frontend engineers; platform SRE; operations; all agent leads
**Last updated:** 2026-05-26
**Status:** CANONICAL — a frontend that is not observable is not constitutionally compliant
**Phase:** Implementation Translation Era

---

## Purpose

This document defines what must be observable about frontend behavior — how the frontend's own rendering state, interaction state, synchronization state, and failure state become visible to operations, audit, and future investigation.

The threat this document addresses: **frontend invisibility as an operational risk.** The PRE is observable — it produces a corpus of deterministic outputs that can be replayed and audited. The backend is observable — it produces delivery logs, synchronization state records, and event streams. The frontend is frequently not observable — it processes events, applies state, runs transitions, and fails silently. When something goes wrong in the frontend, there is often no record of what the frontend was doing, what state it was in, or what it rendered at the moment the problem occurred.

**The governing principle: the frontend is part of operational truth infrastructure. Frontend invisibility is constitutionally unsafe.** If an operator makes an incorrect decision because the frontend displayed incorrect state, and there is no record of what the frontend displayed, the incident cannot be investigated, the cause cannot be identified, and the failure cannot be prevented from recurring.

---

## Section 1 — Render-State Observability

### 1.1 Rendering State Emission

Every component state transition must emit an observable event. This is not optional instrumentation — it is a required operational record.

**Required emissions per component:**

```
// Every rendering state transition emits to the frontend observability stream.
function emitRenderingStateTransition(component, fromState, toState, trigger) {
  frontendObservabilityStream.emit({
    type: 'RENDERING_STATE_TRANSITION',
    component: component.id,
    scope: component.scope,
    fromState,       // RS-01 through RS-06
    toState,
    trigger: {
      eventClass: trigger.eventClass,  // EC-01 through EC-06
      eventId: trigger.eventId,
      preTimestamp: trigger.preTimestamp,
    },
    deviceTimestamp: Date.now(),
    sessionId: currentSessionId,
  });
}
```

**Required transitions to emit:**
- Any transition into RS-04 DEGRADED or RS-05 STALE
- Any transition out of RS-02 PENDING (confirmation, rejection, or timeout)
- Any transition into RS-06 REPLAY-RENDERED (replay entry)
- Any transition out of RS-06 REPLAY-RENDERED (replay exit)
- Any RS-03 TRANSITIONING that is aborted by a Tier 4+ preempt

### 1.2 Render Frame Audit Trail

For audit purposes, each render frame records what state it produced:

```
// Render frame audit record — written on each render of an operational component.
{
  frameId: uuid(),
  componentId: string,
  scope: Scope,
  renderingState: RS_01 | RS_02 | RS_03 | RS_04 | RS_05 | RS_06,
  renderedValues: {
    // The operational values that were rendered in this frame.
    // Enough to reconstruct what the operator saw.
  },
  sourceEventId: string,        // The event that triggered this render
  sourcePreTimestamp: number,   // The PRE operational clock timestamp of that event
  renderTimestamp: number,      // Device timestamp of the render
  sessionId: string,
}
```

**Retention:** Render frame audit records are retained for the session duration plus 48 hours. They are uploaded to the backend audit store at session end or on request.

### 1.3 UI State Reconstruction Capability

Given the render frame audit trail, it must be possible to reconstruct what an operator was shown at any point during their session:

**Reconstruction query:**
```
// What was the operator shown for scope X at time T?
reconstructUIState(sessionId, scope, deviceTimestamp) → {
  renderedValues: RenderedValues,
  renderingState: RenderingState,
  sourcePreTimestamp: number,  // The PRE timestamp of the data that was displayed
  confidence: 'CONFIRMED' | 'AGING' | 'STALE',
}
```

**Constitutional requirement:** If an operator reports that they took an action based on incorrect information, the reconstruction must be able to show: (a) what was displayed when they took the action, (b) what the actual PRE output was at that time, and (c) whether there was a divergence between (a) and (b).

---

## Section 2 — Hydration Mismatch Visibility

### 2.1 Server/Client State Mismatch Detection

For server-rendered or server-streamed content, hydration mismatches must be surfaced and logged — not silently corrected:

```
// Hydration mismatch: server rendered state S1, client hydrated with state S2.
// This is a constitutional concern if S1 ≠ S2 for an operational value.

function onHydrationMismatch(field, serverValue, clientValue) {
  if (isOperationalField(field)) {
    // Log as a High severity observability event.
    frontendObservabilityStream.emit({
      type: 'HYDRATION_MISMATCH',
      severity: 'HIGH',
      field,
      serverValue,
      clientValue,
      scope: getCurrentScope(),
      timestamp: Date.now(),
    });
    // Use the client value (more current) but disclose the mismatch.
    // DO NOT silently use server value for operational fields.
  }
}
```

### 2.2 Mismatch Operator Visibility

When a hydration mismatch affects operator-visible operational values, the component must briefly enter RS-04 DEGRADED state until the authoritative value is confirmed:

```
// A hydration mismatch is treated as a synchronization uncertainty.
// RS-04 DEGRADED state persists until the authoritative state is confirmed via the live event stream.
// The operator sees that the displayed value has uncertain authority.
```

---

## Section 3 — Stale Render Detection

### 3.1 Stale Render Definition

A stale render occurs when a component displays state that was confirmed at time T, but the current PRE operational clock time is T+Δ and no update has been received. The component is rendering state that may no longer reflect operational reality.

**Stale render is distinct from stale data.** The data may genuinely not have changed (the stale render correctly shows the current state). Or new data exists but was not delivered (the stale render shows outdated state). Both cases require the STALE badge — the frontend cannot distinguish them.

### 3.2 Stale Render Detection Implementation

```
// Each component tracks the PRE operational clock timestamp of its last confirmed state.
// The stale render detector compares this against the current PRE clock.

function useStaleRenderDetector(scope, confirmedAt) {
  const currentPreClock = usePreOperationalClock();

  useEffect(() => {
    const ageMs = currentPreClock - confirmedAt;

    if (ageMs > FRESHNESS_THRESHOLDS.STALE_AFTER_MS) {
      emitRenderingStateTransition(scope, RS_01_AUTHORITATIVE, RS_05_STALE, {
        trigger: 'FRESHNESS_THRESHOLD_EXCEEDED',
        ageMs,
      });
    } else if (ageMs > FRESHNESS_THRESHOLDS.AGING_AFTER_MS) {
      // Apply aging indicator — not yet STALE but approaching threshold.
    }
  }, [currentPreClock, confirmedAt]);
}
```

### 3.3 Stale Render Observability Event

```
{
  type: 'STALE_RENDER_DETECTED',
  component: string,
  scope: Scope,
  lastConfirmedAt: number,         // PRE operational clock timestamp
  currentPreClock: number,
  staleDurationMs: number,
  renderingState: 'RS_05_STALE',
  sessionId: string,
  deviceTimestamp: number,
}
```

---

## Section 4 — Replay/Render Divergence Detection

### 4.1 Live-vs-Replay Divergence

When the same scope is rendered in both live and replay modes (side-by-side comparison), divergence between the two must be measured and disclosed:

```
function detectReplayLiveDivergence(liveState, replayState, replayTimestamp) {
  const divergence = computeDivergence(liveState, replayState);

  if (divergence.hasDivergence) {
    frontendObservabilityStream.emit({
      type: 'REPLAY_LIVE_DIVERGENCE',
      scope: liveState.scope,
      replayTimestamp,
      divergentFields: divergence.fields,
      // Each field shows: live value, replay value, and which is expected.
    });
  }
}
```

### 4.2 Unexpected Divergence Classification

Not all divergence is unexpected. Expected divergence (the live state has advanced beyond the replay timestamp) is operationally normal. Unexpected divergence requires investigation:

| Divergence type | Classification | Action |
|---|---|---|
| Live state newer than replay timestamp | Expected | No action — inform operator |
| Live and replay show different values for same timestamp | Unexpected | High severity observability event |
| Replay shows state that live never showed | Unexpected | High severity — potential PRE non-determinism |
| Live shows state that replay cannot reproduce | Unexpected | High severity — corpus gap or delivery failure |

---

## Section 5 — Interaction Latency Visibility

### 5.1 Interaction Latency Measurement

Every consequential operator interaction is timed from initiation to confirmed completion:

```
function measureInteractionLatency(interactionId, flow) {
  const startTime = preOperationalClock.now();

  return {
    onActionSubmitted: () => {
      frontendObservabilityStream.emit({
        type: 'INTERACTION_SUBMITTED',
        interactionId,
        flow,           // IF-01 through IF-07
        submittedAt: preOperationalClock.now(),
        latencyToSubmitMs: preOperationalClock.now() - startTime,
      });
    },
    onActionConfirmed: (result) => {
      frontendObservabilityStream.emit({
        type: 'INTERACTION_CONFIRMED',
        interactionId,
        flow,
        result,         // 'CONFIRMED' | 'REJECTED' | 'TIMEOUT'
        confirmedAt: preOperationalClock.now(),
        totalLatencyMs: preOperationalClock.now() - startTime,
      });
    },
  };
}
```

### 5.2 Latency Disclosure to Operators

Expected latency ranges are defined per action type. When latency exceeds expected range:

```
// Show "Processing is taking longer than expected" after threshold.
// Threshold is per-action-type, not a global constant.
const LATENCY_DISCLOSURE_THRESHOLDS = {
  'IF-01_OVERRIDE_CREATION': 5_000,      // 5 seconds
  'IF-02_EMERGENCY_ACTIVATION': 2_000,   // 2 seconds
  'IF-06_FLEET_INTERVENTION': 8_000,     // 8 seconds
};
```

---

## Section 6 — Dropped-Event Visibility

### 6.1 Event Drop Detection

An event is "dropped" if it was expected (a gap in sequence numbers) but not received within the hold timeout:

```
function onEventDropDetected(scope, expectedSequenceNumber, gapDurationMs) {
  // Surface to operator: "An event may have been missed."
  emitEventOrderingDisclosure(scope, expectedSequenceNumber);

  // Emit observability record.
  frontendObservabilityStream.emit({
    type: 'EVENT_DROP_DETECTED',
    severity: 'MEDIUM',
    scope,
    expectedSequenceNumber,
    gapDurationMs,
    disclosure: 'OPERATOR_NOTIFIED',
  });
}
```

### 6.2 Operator-Visible Event Drop Disclosure

```
// Operator-visible disclosure when an event may have been missed.
// Not hidden, not suppressed, not deferred until a convenient moment.
<EventDropDisclosure
  scope={scope}
  message={`Event may have been missed for ${scope.name}. State may be incomplete.`}
  recommends="Verify current state before taking consequential action."
  dismissible={true}
  persistsUntilConfirmed={true}
  // Remains visible until next confirmed state update for the affected scope.
/>
```

---

## Section 7 — WebSocket Degradation Visibility

### 7.1 Connection State Observability

WebSocket connection state is part of synchronization state and must be surfaced through the standard synchronization state model:

```
// WebSocket degradation maps to synchronization states.
const WS_TO_SYNC_STATE = {
  CONNECTED:         'SS-01_SYNCHRONIZED',
  RECONNECTING:      'SS-06_DISCONNECTED', // brief reconnection
  DEGRADED_LATENCY:  'SS-04_STALE',        // connected but delayed
  DISCONNECTED:      'SS-06_DISCONNECTED',
};

// State transitions are emitted when WebSocket state changes.
// Operators see synchronization state changes, not raw WebSocket events.
```

### 7.2 WebSocket Health in Frontend Audit Trail

```
{
  type: 'WEBSOCKET_STATE_CHANGE',
  fromState: 'CONNECTED',
  toState: 'RECONNECTING',
  attemptNumber: 3,
  gapDurationMs: 4200,
  affectedScopes: ['venue:123', 'venue:456'],
  deviceTimestamp: number,
  sessionId: string,
}
```

### 7.3 Degraded Delivery Escalation

When WebSocket degradation persists beyond the defined thresholds, the synchronization state escalates:

```
const WS_DEGRADATION_THRESHOLDS = {
  // Connection lost for > 5 seconds: enter SS-06 DISCONNECTED
  DISCONNECTED_AFTER_MS: 5_000,
  // Reconnecting for > 30 seconds: surface as operator-visible incident
  INCIDENT_AFTER_MS: 30_000,
  // Reconnecting for > 120 seconds: escalate to highest degraded state DS-05
  BACKEND_UNAVAILABLE_AFTER_MS: 120_000,
};
```

---

## Section 8 — Operator-Visible Frontend Health

### 8.1 Frontend Health Indicator

A frontend health indicator is part of the operator-visible system — operators should not need to infer frontend health from unusual behavior; it should be explicitly disclosed.

```
// Frontend health surfaces in the system status area.
// It summarizes the frontend's current operational state.

<FrontendHealthIndicator
  synchronizationState={currentSyncState}    // SS-01 through SS-07
  staleScopeCount={staleScopeCount}
  pendingActionCount={pendingActionCount}
  wsConnectionState={wsState}
  lastConfirmedAt={lastConfirmedAt}
/>
// This is ambient information — visible but not prominent in normal operation.
// Escalates to prominent when synchronization state degrades.
```

### 8.2 Health Indicator Content Requirements

The frontend health indicator must convey:

1. **Connection status:** Connected, reconnecting, disconnected — specific, not binary healthy/unhealthy
2. **Synchronization currency:** How old is the most recently confirmed state?
3. **Pending actions:** How many operator actions are awaiting confirmation?
4. **Degraded scopes:** How many scopes are currently in a degraded state?

**Forbidden:**
```
// DO NOT show a binary green/red health indicator.
// Binary indicators hide the nature and scope of degradation.
// An operator who sees "red" knows something is wrong but not what, how bad, or what to do.
```

---

## Section 9 — Frontend Audit Trails

### 9.1 Session Audit Record Structure

A complete session audit record enables post-session reconstruction. Each session produces:

```
SessionAuditRecord {
  sessionId: string,
  operatorId: string,
  sessionStart: number,       // PRE operational clock
  sessionEnd: number,
  workspaces: WorkspaceVisit[],
  interactions: InteractionRecord[],
  renderingStateTransitions: RenderingStateTransition[],
  eventDrops: EventDropRecord[],
  degradationEvents: DegradationRecord[],
  wsStateChanges: WSStateChange[],
  stalenessEvents: StalenessRecord[],
}
```

### 9.2 Interaction Record Requirements

Every consequential interaction must produce an interaction record with enough information to reconstruct the operator's context at the time of the action:

```
InteractionRecord {
  interactionId: string,
  flow: 'IF-01' | 'IF-02' | 'IF-03' | 'IF-04' | 'IF-05' | 'IF-06' | 'IF-07',
  scope: Scope,
  initiatedAt: number,          // PRE operational clock
  confirmedAt: number | null,
  result: 'CONFIRMED' | 'REJECTED' | 'TIMEOUT' | 'ABANDONED',
  // Snapshot of what the operator saw when they initiated the action.
  contextSnapshot: {
    renderingState: RenderingState,
    displayedValues: DisplayedValues,
    sourcePreTimestamp: number,   // The PRE timestamp of the data they were acting on
    confidence: Confidence,
  },
}
```

### 9.3 Audit Trail Integrity

Audit trail entries must be tamper-evident and ordered:

- Entries are written to an append-only log
- Each entry references the prior entry's hash (chain structure)
- The audit trail cannot be retroactively modified
- Gaps in the sequence are visible as gaps — not silently bridged

---

## Section 10 — UI State Reconstruction Capability

### 10.1 Reconstruction Requirement

**Constitutional requirement:** Any operator-visible state at any point during a session must be reconstructible from the session audit trail combined with the PRE replay corpus.

Reconstruction provides:
1. What the operator saw (from render frame audit trail)
2. What the PRE said at that moment (from replay corpus)
3. Whether (1) and (2) agreed (divergence detection)
4. What event caused the current display (from rendering state transitions)
5. What the operator did in response (from interaction records)

### 10.2 Reconstruction API

```
// Required interface — must be implementable from session audit trail + corpus.

reconstructOperatorContext(
  sessionId: string,
  timestamp: number,  // PRE operational clock
) → {
  displayedState: Record<Scope, DisplayedValues>,
  renderingStates: Record<Scope, RenderingState>,
  pendingActions: PendingAction[],
  synchronizationState: SynchronizationState,
  preOutputAtTimestamp: Record<Scope, PreResolutionOutput>,
  divergences: Divergence[], // displayedState vs preOutputAtTimestamp
}
```

### 10.3 Reconstruction Gap Reporting

If the audit trail is incomplete (events were dropped, the session was interrupted), the reconstruction must disclose the gap:

```
// A reconstruction that covers 80% of the session is valid — with the gap disclosed.
// A reconstruction that silently bridges a gap with interpolated values is forbidden.
ReconstructionResult {
  coverage: 0.0 to 1.0,   // Fraction of session time with complete records
  gaps: TimeRange[],       // Periods with incomplete records
  gapCause: string[],      // Why each gap exists
  reliability: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT',
}
```

---

## Related Documents

**OPERATIONAL-REGRESSION-AND-DRIFT-AUDITING-v1.md** — The audit types (Section 2.3 frontend rendering audits, Section 2.5 operator workflow audits) that consume the observability data defined here.

**AUTOMATED-CONSTITUTIONAL-VALIDATION-v1.md** — The automated validation checks that use render-state observability data (Section 2.4 frontend validation).

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — The rendering lifecycle states (RS-01 through RS-06) that Section 1 emission requirements reference.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — The synchronization states (SS-01 through SS-07) that Section 7 WebSocket degradation mapping references.

**FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md** — The degraded states (DS-01 through DS-06) that Section 7.3 degradation escalation thresholds reference.

---

*End of OPERATIONAL-FRONTEND-OBSERVABILITY-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Backend observability integration points and session upload contracts: Agent 2 authority*
*PRE replay corpus integration for reconstruction: Agent 1 authority*
*Frontend observability data structures and operator-visible health: Agent 3 definition authority*
