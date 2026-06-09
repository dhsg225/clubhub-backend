# ClubHub TV — Frontend Implementation Patterns
# Implementation Translation Era — Operational Frontend Execution Standards

**Document type:** Implementation governance — approved and forbidden frontend patterns
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; component library contributors; all contributors writing operator-facing code
**Last updated:** 2026-05-26
**Status:** CANONICAL — implementation patterns not conforming to this document are not eligible for deployment in operational contexts
**Phase:** Implementation Translation Era

---

## Purpose

This document translates the constitutional frontend architecture into implementation patterns: specific, named, testable approaches for building operator-facing frontend code. For every major implementation concern, it defines what is approved, what is forbidden, and why.

**Each pattern entry provides:**
- The approved approach
- The forbidden approach(es)
- The operational consequence of the forbidden approach
- The testable assertion that verifies compliance

**The governing principle: no frontend abstraction may obscure operational truth.** Every abstraction that makes code easier to write must be evaluated for whether it makes operational state easier or harder to reason about. Abstractions that simplify code but hide state authority, timing, or causality are forbidden.

---

## Section 1 — PRE-Connected Views

### Pattern PRE-01: Authoritative State Subscription

**Approved:**
```
// Subscribe to PRE resolution output via the authoritative state channel.
// The view renders only confirmed PRE output.
// No local computation of PRE-domain values.
const resolvedState = useAuthoritativeState(scope);
// resolvedState.value — confirmed PRE output
// resolvedState.timestamp — PRE operational clock timestamp
// resolvedState.confidence — CONFIRMED | AGING | STALE
// resolvedState.renderingState — RS-01 through RS-06
```

**Forbidden:**
```
// DO NOT derive PRE-domain values locally.
const effectiveContent = overrides.length > 0 ? overrides[0].content : schedule.content;
// This replicates PRE resolution logic in the frontend.
// It will diverge from actual PRE output under complex precedence rules.
```

**Operational consequence of forbidden pattern:** The frontend resolves a different effective content than the PRE computed. Operators see a display that does not match operational reality. Replay against the same inputs will show a different resolution than what the operator was shown.

**Testable assertion:** For any scope, `useAuthoritativeState(scope).value` must equal the PRE resolution output for that scope at the same timestamp. Verified in replay regression suite.

---

### Pattern PRE-02: State Authority Hierarchy

**State authority rule:** A view component has exactly one authoritative state source. Multiple state sources for the same operational fact are forbidden.

**Approved:**
```
// One authoritative state source per scope.
// Additional context comes from related scopes, not from multiple authorities for the same scope.
const venueState = useAuthoritativeState({ type: 'venue', id: venueId });
const fleetState = useAuthoritativeState({ type: 'fleet' });
```

**Forbidden:**
```
// DO NOT merge state from multiple sources for the same fact.
const effectiveHealthGrade = localOverrideGrade ?? apiHealthGrade ?? cachedHealthGrade;
// Which is authoritative? Under what conditions does each take precedence?
// This pattern creates invisible authority inversion.
```

**Testable assertion:** Any displayed operational value must be traceable to exactly one authoritative state source. A value that can be sourced from multiple paths is a pattern violation.

---

### Pattern PRE-03: Rendering Hierarchy

The rendering hierarchy defines in what order data flows to render:

```
PRE resolution output (Agent 1 authority)
  → Backend event delivery (Agent 2 authority)
    → Frontend state model (authoritative, not local)
      → Rendering lifecycle state machine
        → Component render
          → Operator display
```

**Nothing may be injected between PRE resolution output and operator display that modifies the operational meaning of what is displayed.** Presentation transformations (formatting timestamps, truncating long strings with access to full value) are permitted. Semantic transformations (rounding a health grade, smoothing a value over time, inferring confidence from field presence) are forbidden.

---

## Section 2 — Replay-Aware Rendering

### Pattern RP-01: Rendering Mode Isolation

**Approved:**
```
// Check rendering mode before subscribing to state.
// Live and replay state models are completely isolated.
const renderingMode = useRenderingMode(); // 'LIVE' | 'REPLAY'

if (renderingMode === 'REPLAY') {
  // Subscribe to replay state model only.
  const state = useReplayState(scope, replayTimestamp);
} else {
  // Subscribe to live state model only.
  const state = useAuthoritativeState(scope);
}
```

**Forbidden:**
```
// DO NOT use a single state subscription that conditionally blends live and replay.
const state = isReplaying ? replayState ?? liveState : liveState;
// The fallback to liveState during replay is a contamination path.
// If replayState is undefined, live state renders in a replay context — invisible to operators.
```

**Operational consequence of forbidden pattern:** A historical replay briefly shows current live state because the replay state was not yet loaded. The operator sees live state in what they believe is a historical view and may make operational decisions based on incorrect temporal context.

**Testable assertion:** When `renderingMode === 'REPLAY'`, no live state event may cause a component re-render. Verified by injecting a live event during replay and asserting zero component updates.

---

### Pattern RP-02: Replay State Badge Permanence

**Approved:**
```
// The replay state header is mounted at the layout level, not within any component.
// It cannot be unmounted, hidden, or collapsed during replay.
<ReplayStateHeader
  position={timestamp}
  timeSincePresent={delta}
  investigationAnchor={anchor}
  onExit={handleReplayExit}
/>
// ReplayStateHeader has no hidden/collapsed/minimized state.
```

**Forbidden:**
```
// DO NOT make the replay header dismissible, collapsible, or conditional.
{showReplayHeader && <ReplayStateHeader ... />}
// An operator who accidentally dismisses the header loses temporal context.
```

---

### Pattern RP-03: Replay/Live Coexistence

When side-by-side replay/live comparison is permitted (REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md), both panels must maintain strict state isolation:

**Approved:**
```
// Two isolated panels with independent state subscriptions.
// Panels share no state; each has its own rendering mode.
<ReplayPanel timestamp={selectedTimestamp} scope={scope} />
<LivePanel scope={scope} />
// No shared state between panels.
// ReplayPanel cannot read from LivePanel's state model.
```

**Forbidden:**
```
// DO NOT use a shared state store that both panels read from.
// DO NOT pass live state as a prop to the replay panel "for comparison."
```

---

## Section 3 — Pending-State Handling

### Pattern PE-01: PENDING Rendering Composition

**Approved:**
```
// PENDING state renders current confirmed state as the background.
// The PENDING indicator overlays — it does not replace.
<ComponentContent state={confirmedAuthoritativeState} />
{isPending && (
  <PendingOverlay
    action={pendingAction}
    elapsedMs={pendingElapsedMs}
    // Never hides the content beneath it.
    // Does not show the pending target state as current.
  />
)}
```

**Forbidden:**
```
// DO NOT replace the confirmed state with the pending target state.
<ComponentContent state={isPending ? pendingTargetState : confirmedState} />
// This is optimistic rendering. It shows unconfirmed state as current.
// The operator cannot distinguish current reality from pending aspiration.
```

**Operational consequence of forbidden pattern:** The operator believes an action has taken effect. They make a subsequent decision based on the assumed new state. The backend rejects the action. The display rolls back. The operator's subsequent decision was based on state that never existed.

**Testable assertion:** When `isPending === true`, the rendered component output must be identical to the rendered output when `isPending === false` for the same `confirmedAuthoritativeState`, plus the PENDING overlay. No component value may differ based on `pendingTargetState`.

---

### Pattern PE-02: Pending Timeout and Rollback

```
// PENDING state has a defined maximum duration.
// After timeout, the pending action is assumed failed.
// The component returns to AUTHORITATIVE with a timeout disclosure.
const PENDING_TIMEOUT_MS = 30_000;

usePendingTimeout(pendingAction, PENDING_TIMEOUT_MS, () => {
  // On timeout: transition to AUTHORITATIVE (prior state).
  // Display timeout notification: "Action timed out — displaying prior state."
  // Do NOT silently drop the pending state.
  emitPendingTimeout(pendingAction);
});
```

**Forbidden:**
```
// DO NOT allow pending state to persist indefinitely.
// DO NOT silently clear pending state without notification.
```

---

## Section 4 — Optimistic-State Prohibition

### Pattern OS-01: No Optimistic Rendering for Consequential Actions

**Definition:** Optimistic rendering is when the frontend displays the expected post-action state before the backend confirms the action.

**Prohibited for:** All actions that modify operational state — override creation, emergency activation, schedule modification, sponsorship adjustment, fleet-wide changes.

**Permitted for:** Display-only preferences with no operational consequence (panel expansion, filter selections, sort order).

**Implementation guard:**
```
// All state-modifying actions must set pendingAction, never optimisticState.
// The distinction is enforced in the state management layer.

// Approved:
dispatch({ type: 'ACTION_SUBMITTED', pendingAction: { ... } });
// Forbidden:
dispatch({ type: 'STATE_OPTIMISTICALLY_UPDATED', newState: expectedState });
```

**Testable assertion:** No component renders a value derived from an unconfirmed backend state. All rendered operational values must be traceable to a confirmed PRE output.

---

## Section 5 — Multi-Operator Synchronization

### Pattern MO-01: Remote Action Attribution

**Approved:**
```
// Remote operator actions are displayed with attribution.
// Attribution is non-blocking — it does not interrupt the current operator's workflow.
// Attribution uses the remote update channel, not the local action state.
{remoteUpdate && (
  <RemoteUpdateBanner
    operator={remoteUpdate.operatorId}
    action={remoteUpdate.actionDescription}
    timestamp={remoteUpdate.preTimestamp}
    scope={remoteUpdate.scope}
    // Dismissible after acknowledgment threshold (5 seconds)
    // Does not block interaction
  />
)}
```

**Forbidden:**
```
// DO NOT block local interactions while showing remote attribution.
// DO NOT merge remote update state with local authoritative state.
// DO NOT show remote update as a local pending action.
```

### Pattern MO-02: Concurrent Intent Visibility

When two operators are acting on the same scope simultaneously:

```
// Show the remote operator's in-progress action on the shared scope.
// This is awareness, not blocking.
{concurrentAction && (
  <ConcurrentActionIndicator
    operator={concurrentAction.operatorId}
    intent={concurrentAction.description}
    scope={concurrentAction.scope}
    // Does not prevent the local operator from acting.
    // Provides visibility, not enforcement.
  />
)}
```

---

## Section 6 — Degraded-Mode Rendering

### Pattern DM-01: Degraded State Must Be Specific

**Approved:**
```
// Degraded state disclosure is specific about what is degraded and why.
<DegradedBadge
  degradedState="DS-04"
  description="Event delivery delayed: last update 47 seconds ago"
  affectedValues={['contentResolution', 'overrideStatus']}
  lastConfirmedAt={lastConfirmedTimestamp}
/>
```

**Forbidden:**
```
// DO NOT use generic degraded messaging.
<DegradedBadge description="Data unavailable" />
// Operators cannot act on generic degradation.
// They need to know what is unavailable, how long, and what is still reliable.
```

### Pattern DM-02: Partial Data Legality

```
// When some fields are degraded and others are confirmed, render both.
// The confirmed fields render normally.
// The degraded fields render with confidence qualifiers.

<VenueHealthDisplay
  grade={venueState.grade}                           // confirmed — renders normally
  gradeConfidence={venueState.gradeConfidence}       // 'CONFIRMED' | 'AGING' | 'STALE'
  contentResolution={venueState.contentResolution}   // may be degraded
  contentResolutionAge={venueState.contentResolutionAge}
/>
// Aggregate denominators use the count of reporting venues, not total venues.
// A fleet-average that includes non-reporting venues is forbidden.
```

### Pattern DM-03: Authoritative State Persists Under Degradation

```
// The last confirmed authoritative state remains visible under degraded conditions.
// It is never replaced with empty, null, or a loading state.
// It is labeled with its confirmation timestamp.

<StateDisplay
  value={state.value}
  confidence={state.confidence}
  confirmedAt={state.confirmedAt}
  renderingState={state.renderingState} // RS-04 DEGRADED or RS-05 STALE
/>
// If state.confidence === 'STALE', state.value is still displayed.
// The STALE badge communicates reduced confidence; it does not hide the value.
```

---

## Section 7 — Timeline Virtualization

### Pattern TV-01: Temporal Reference Authority

```
// All timeline rendering uses PRE operational clock timestamps as the reference.
// Device time and network arrival time are never used as timeline position references.

const timelinePosition = preOperationalClockTimestamp; // always
// NOT: Date.now()
// NOT: event.receivedAt
// NOT: performance.now() + serverOffset (drift-prone)
```

### Pattern TV-02: Large Timeline Virtualization

For timelines spanning > 24 hours, virtualization is required. Virtualization must preserve:

```
// Temporal accuracy: the visual distance between events must be proportional
// to their actual operational time distance.
// Compression/expansion factors must be disclosed to operators.

<Timeline
  events={events}
  startTimestamp={rangeStart}
  endTimestamp={rangeEnd}
  compressionFactor={compressionFactor} // displayed if > 1x
  // Events are not reordered for visual convenience.
  // Causal markers remain in causal order.
/>
```

**Forbidden:**
```
// DO NOT reorder timeline events for visual spacing.
// DO NOT batch events into "clusters" that obscure their individual timestamps.
// DO NOT hide events that fall in compressed regions — use progressive disclosure instead.
```

---

## Section 8 — Explanation Rendering

### Pattern EX-01: Explanation Availability Requirement

```
// Every displayed operational value must have an accessible explanation.
// EH-2 (Operational level) is the minimum for any value an operator uses to make decisions.

<OperationalValue
  value={resolvedContent}
  onExplain={() => openExplanation({
    level: 'EH-2',
    resolutionPath: resolvedContent.resolutionPath,
    suppressionTree: resolvedContent.suppressionTree,
    resolvedAt: resolvedContent.preTimestamp,
  })}
/>
// The explanation affordance is always present — not conditional on the value being interesting.
// An operator must be able to ask "why?" about any value at any time.
```

### Pattern EX-02: Suppression Tree Rendering

```
// When an item was not selected (suppressed), the operator can ask "why not?"
// The suppression tree answers this.

<SuppressedItemIndicator
  item={suppressedItem}
  winner={suppressionTree.winner}
  suppressionReason={suppressionTree.reason}
  // Does not say "not eligible" without specifying the rule that made it ineligible.
  // Does not say "lower priority" without specifying what had higher priority and why.
/>
```

**The "why not?" question is the most operationally critical explanation.** An operator who cannot determine why expected content is not playing cannot diagnose whether the cause is correct operation or a misconfiguration.

---

## Section 9 — State Freshness Indicators

### Pattern SF-01: Freshness Thresholds

```
// State freshness is tracked per value, not per component.
// A component may have confirmed and aging values simultaneously.

const FRESHNESS_THRESHOLDS = {
  AGING_AFTER_MS: 15_000,    // 15 seconds — show subtle age indicator
  STALE_AFTER_MS: 30_000,    // 30 seconds — show STALE badge
  CRITICAL_AFTER_MS: 120_000, // 2 minutes — block consequential interactions
};
```

### Pattern SF-02: Freshness Display

```
// Age indicators are relative to PRE operational clock, not device clock.
// Age indicators update continuously — not only on re-render.

<FreshnessIndicator
  confirmedAt={state.confirmedAt}
  threshold={FRESHNESS_THRESHOLDS}
  onThresholdCrossed={(level) => {
    if (level === 'STALE') emitStalenessEvent(scope);
  }}
/>
```

**Forbidden:**
```
// DO NOT suppress freshness indicators because "it looks cluttered."
// Freshness indicators are operational truth, not decoration.
```

---

## Section 10 — Event-Stream Handling

### Pattern ES-01: Event Ordering Compliance

```
// Events are applied to the render model in PRE operational clock order.
// Events that arrive out of order are held until the prior event arrives or the hold timeout expires.

const eventQueue = useOrderedEventQueue({
  orderBy: 'preOperationalClockTimestamp',
  holdTimeoutMs: 500, // Maximum hold — see EVENT-AND-STATE-ORCHESTRATION-v1.md
  onHoldTimeout: (heldEvent, missingPrior) => {
    // Disclose to operator that an event may have been missed.
    emitEventOrderingDisclosure(heldEvent, missingPrior);
    // Apply the held event — do not drop it.
  },
});
```

### Pattern ES-02: Event Deduplication

```
// Events are deduplicated by event_id before entering the render pipeline.
// Duplicate events are silently dropped — they do not cause double renders.

const processedEventIds = useDeduplicationWindow(1000); // Rolling last 1000

function onEvent(event) {
  if (processedEventIds.has(event.event_id)) return; // Silently drop duplicate
  processedEventIds.add(event.event_id);
  processEvent(event);
}
```

### Pattern ES-03: Batching Compliance Per Event Class

```
// Event batching windows are defined per class.
// These are maximum windows — events may render sooner if no other events are pending.

const BATCH_WINDOWS_MS = {
  EC_01_PRE_RESOLUTION: 0,      // Never batched
  EC_02_SYNCHRONIZATION: 0,     // Never batched
  EC_03_OPERATOR_OWN: 0,        // Never batched
  EC_03_OPERATOR_REMOTE_CURRENT: 2_000,
  EC_03_OPERATOR_REMOTE_OTHER: 10_000,
  EC_04_REPLAY: 0,              // Never batched — replay has its own path
  EC_05_DEGRADATION: 0,         // Never batched
  EC_06_ADVISORY_TIER_3_PLUS: 0,
  EC_06_ADVISORY_TIER_0_2: 5_000,
};
```

---

## Section 11 — Suspense and Loading Governance

### Pattern SL-01: No Indefinite Loading States

**Every loading state has a defined timeout.** After the timeout, the component transitions to either the loaded state or an explicit degraded/error state — not an indefinite spinner.

```
<AuthoritativeStateLoader
  scope={scope}
  timeoutMs={LOADING_TIMEOUT_MS}
  onTimeout={() => transitionToDegraded('DS-04', scope)}
  // After timeout: show last known state with STALE badge.
  // Never: show indefinite spinner.
/>
```

**Forbidden:**
```
// DO NOT show an indefinite loading spinner for operational state.
{isLoading && <Spinner />}
// After LOADING_TIMEOUT_MS, this spinner communicates nothing useful to the operator.
```

### Pattern SL-02: Skeleton States Are Informational, Not Operational

```
// Skeleton/placeholder states may be shown during initial load.
// They must be visually distinct from actual operational state.
// They must transition to either real state or an explicit degraded state — not persist.

const SKELETON_MAX_DURATION_MS = 3_000;
// After 3 seconds without data: transition to DS-05 Backend Unavailable.
// A skeleton that persists is operationally misleading — it implies data is coming.
```

---

## Section 12 — Frontend Failure Isolation

### Pattern FI-01: Component Error Boundaries

```
// Every operational component is wrapped in an error boundary.
// An error boundary catches rendering errors and displays a degraded state,
// not a blank panel or a crash.

<OperationalErrorBoundary
  scope={scope}
  fallback={
    <DegradedComponent
      description="Rendering failure — last known state unavailable"
      scope={scope}
      reportedAt={Date.now()} // Use device time for the failure timestamp only
    />
  }
>
  <OperationalComponent scope={scope} />
</OperationalErrorBoundary>
```

### Pattern FI-02: Failure Isolation Scope

```
// Component rendering failures must not propagate to sibling components.
// A failed venue health component must not affect the override stack component.

// Each operational region has its own error boundary.
// Fleet-level failures degrade fleet-level components only.
// Venue-level failures degrade that venue's components only.
// Screen-level failures degrade that screen's components only.
```

---

## Related Documents

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — The rendering lifecycle states (RS-01 through RS-06) that patterns PE-01, DM-03, and SF-01 implement.

**EVENT-AND-STATE-ORCHESTRATION-v1.md** — The event class batching windows that pattern ES-03 encodes.

**OPERATIONAL-FRONTEND-RUNTIME-v1.md** — The runtime execution model that patterns PRE-01, RP-01, and ES-01 implement.

**FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md** — The degraded states (DS-01 through DS-06) that pattern DM-01 references.

**EXPLAINABILITY-RENDERING-SYSTEM-v1.md** — The explanation hierarchy (EH-1 through EH-4) that patterns EX-01 and EX-02 implement.

---

*End of FRONTEND-IMPLEMENTATION-PATTERNS-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*PRE-connected view authority rules reviewed by: Agent 1*
*Event-stream handling and synchronization patterns reviewed by: Agent 2*
*Rendering patterns and operator-facing patterns: Agent 3 definition authority*
