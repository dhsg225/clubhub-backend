# ClubHub TV — Rendering Orchestration and View Stability
# Operational Execution Surface Era — Operational Application Shape Governance

**Document type:** Implementation governance — deterministic rendering order, view stability, and anti-jitter rules
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; render system implementors; all contributors touching rendering pipelines
**Last updated:** 2026-05-26
**Status:** CANONICAL — rendering behavior that disrupts operator perception of operational causality is a constitutional violation
**Phase:** Operational Execution Surface Era

---

## Purpose

This document governs stable rendering behavior during continuous operational change. It defines the rules by which the frontend maintains visual continuity, deterministic rendering order, and causality-preserving animations while a live operational system streams state updates continuously.

The threat this document addresses: **rendering instability as operational confusion.** An interface that shifts layout, repositions elements, or flickers during updates forces the operator to re-orient on every state change. Worse, rendering instability can create false causal impressions — an element that jumps from one position to another may appear to have changed state when it merely moved, or appear to be the same element when it has been replaced.

**The governing principle: operators must perceive continuity of operational causality even during rapid change.** An operator who is watching the display during an active incident must be able to follow the sequence of events without the display resetting their visual attention at every update.

---

## Section 1 — Deterministic Rendering Order

### 1.1 Render Order Priority

When multiple components need to update in the same render cycle, they render in defined priority order:

```
// Render priority (highest first):
const RENDER_PRIORITY = {
  EMERGENCY_SURFACES: 1,        // Emergency banners, critical alerts
  TIER_4_5_UPDATES: 2,          // Escalation/critical event components
  PENDING_STATE_RESOLUTION: 3,  // Pending → confirmed or rejected transitions
  INCIDENT_STATUS: 4,           // Incident timeline, escalation state
  OPERATIONAL_STATE_CHANGES: 5, // RS-01 through RS-05 transitions
  ADVISORY_UPDATES: 6,          // Tier 0–2 passive updates
  SHELL_INDICATORS: 7,          // Fleet health summary, sync state
};
```

**Why render priority matters:** When 8 components need to update simultaneously and the browser can only process 4 per frame, render priority determines which 4 the operator sees first. The operator's attention flows to whatever changes — so changes must happen in the order that produces correct causal understanding.

### 1.2 Causal Order Enforcement

Within the same priority tier, components that have causal relationships render in causal order:

```
// If component A caused component B to change state:
// A renders before B in every case — never B before A.

// Example: an override is removed → the effective content changes.
// Render order:
// 1. Override stack component (shows the override was removed)
// 2. Effective content component (shows the new effective content)
// If content rendered first, the operator would see new content with no explanation.

function causalRenderOrder(updates) {
  return topologicalSort(updates, (a, b) => isCausalPredecessor(a, b));
}
```

### 1.3 Simultaneous Update Atomicity

As defined in OPERATIONAL-FRONTEND-RUNTIME-v1.md Section 3.2: updates from the same event apply in the same render frame. Implementation:

```
// All updates from the same event_id are batched before the next frame.
// The batch is applied atomically — not split across frames.

function applyEventUpdates(event, affectedComponents) {
  // Collect all component state updates triggered by this event.
  const batch = collectBatch(event, affectedComponents);

  // Apply in a single React batch (React 18: automatic batching handles this
  // if all updates are synchronous within the event handler).
  startTransition(() => {
    batch.forEach(update => applyUpdate(update));
  });
  // All components in `batch` re-render in the same frame.
}
```

---

## Section 2 — View Stability Under Streaming Updates

### 2.1 Anti-Layout-Shift Rules

Layout shift is when visible elements move position due to a state update that the operator did not initiate. All layout shifts are prohibited unless:
- The operator explicitly triggered the change (sorting, filtering, scope change)
- An element is first appearing in the viewport (new content can push down)
- An element is in RS-03 TRANSITIONING and its position change is the defined transition

**Implementation rules:**

```
// Operational lists (venue lists, override stacks, event timelines) use fixed item heights.
// An item's height must not change due to content updates.
// If an item needs to show more content than its fixed height allows, it uses
// progressive disclosure within its fixed height container — not height expansion.

const OPERATIONAL_ITEM_HEIGHTS = {
  VENUE_LIST_ITEM: 72,        // px — fixed
  OVERRIDE_STACK_ITEM: 64,    // px — fixed
  EVENT_TIMELINE_ITEM: 56,    // px — fixed
  NOTIFICATION_ITEM: 48,      // px — fixed
};
```

### 2.2 Anti-Jitter Rules

Jitter is when an element's value fluctuates rapidly between displayed states because of high-frequency updates. Jitter makes it impossible to read an operational value.

```
// Minimum display duration for any value before it can be replaced:
const MINIMUM_VALUE_DISPLAY_MS = 400; // Same as max transition duration

function shouldApplyUpdate(component, newValue, lastUpdatedAt) {
  const timeSinceLastUpdate = Date.now() - lastUpdatedAt;

  if (timeSinceLastUpdate < MINIMUM_VALUE_DISPLAY_MS) {
    // Queue the update — do not apply immediately.
    // The value the operator is currently reading must complete its display cycle.
    queueUpdate(component, newValue);
    return false;
  }
  return true;
}
```

**Jitter prevention does not apply to:**
- Tier 4+ events — they preempt regardless of display duration
- Counters and timers (staleness duration, pending elapsed time) — they must update continuously

### 2.3 Scroll-Position Stability

```
// Scrollable lists must not change scroll position due to state updates.
// If new items are prepended to a list above the viewport,
// the scroll position adjusts to keep the visible items in place.
// (React "scroll anchoring" pattern.)

// When new items appear at the top of a timeline due to live updates:
// - Items slide in from the top with the defined animation
// - Existing items shift down
// - Scroll anchor maintains the operator's current reading position

useScrollAnchor(listRef, {
  anchored: true,
  anchorPosition: 'TOP_OF_VIEWPORT',
  // Operator's current view does not jump when new items are prepended
});
```

---

## Section 3 — List Virtualization Governance

### 3.1 Virtualization Requirements

Lists that may contain more than 50 items require virtualization. Virtualization must preserve:

```
// 1. Causal order: items must render in the same order they would without virtualization.
//    Virtualization is a rendering optimization — it must not change the logical order.

// 2. Search/filter accessibility: virtualized items that are off-screen must be
//    accessible via search and filter — not "not found" just because they're not rendered.

// 3. Live update handling: when a virtualized item receives a state update off-screen,
//    the update is applied to the data model. When the item scrolls into view, it renders
//    in its current (updated) state — not the stale state it had when it left the viewport.

// 4. Anchor identity stability: the key for each virtualized item must be stable across
//    renders. Using array index as key is forbidden for operational lists — items may
//    be reordered, and an index-keyed item would render the wrong state.
```

### 3.2 Forbidden Virtualization Behaviors

```
// FORBIDDEN: Re-mounting an item when it re-enters the viewport.
// An item that re-enters the viewport must hydrate from current state — not from a fresh mount.
// Re-mounting clears component state and may produce a visible flash.

// FORBIDDEN: "Loading" placeholder for off-screen items that scroll into view.
// Off-screen items are in the data model — they should render immediately when scrolled into view.
// A placeholder for data we already have is a false loading state.

// FORBIDDEN: Reordering items while the operator is scrolling.
// A sort or filter update that reorders a list the operator is actively scrolling
// causes them to lose their place. Sort/filter changes are only applied at a stable moment:
// - When the operator is not scrolling (100ms debounce after scroll stops)
// - Or when the operator explicitly applies the filter/sort
```

---

## Section 4 — Timeline Rendering Stability

### 4.1 Timeline Anchor Stability

A timeline must maintain a stable anchor point while live events are appended:

```
// The timeline's visible window is anchored to what the operator is viewing.
// New events appear at the "present" end — they do not shift existing events.
// The operator's viewport does not move when new events arrive.

<OperationalTimeline
  events={orderedEvents}
  viewportAnchor="OPERATOR_SELECTED" // Anchor to operator's current view position
  liveEndBehavior="APPEND"           // New events appear at the end
  // Operator can navigate to "present" to follow live updates
  // Or anchor to a historical point for investigation
/>
```

### 4.2 Timeline Event Identity

```
// Each timeline event has a stable identity derived from its PRE operational clock timestamp
// and event_id — not from its position in the event array.
// When events are appended, inserted, or modified, existing events retain their identity.

// A timeline event that receives a state update (e.g., an event that was PENDING
// is confirmed) updates in-place — it does not disappear and reappear.
// The update uses the TRANSITIONING rendering state (RS-03) to signal the change.
```

### 4.3 Causal Marker Preservation

```
// Timeline causal markers (TP-01 through TP-06) must remain stable during updates.
// A causal indicator that appears, then disappears, then reappears on the same event
// destroys the operator's causal model.

// Causal markers are derived from the PRE resolution output for a timeline position.
// They change only when the PRE resolution for that position changes — not due to UI state.
```

---

## Section 5 — Causality-Preserving Animations

### 5.1 Animation Legality (Rendering Context)

Only animations that communicate operational meaning are permitted. From LIVE-UPDATE-BEHAVIOR-SPEC.md, the permitted set:

| Animation | When applied | Duration |
|---|---|---|
| Fade to new value | Value change (Tier 1–2) | 200ms |
| Color transition | State threshold crossing | 400ms |
| Position transition | Rank reorder in list | 400ms |
| Temporal transition | LIVE ↔ REPLAY mode change | 600ms |
| Confirmation pulse | PENDING → TRANSITIONING (confirmed action) | 300ms |
| Synchronization animation | RS-05 STALE → RS-01 AUTHORITATIVE | 400ms |
| Slide-in (timeline) | New live event appearing | 300ms |

**Every other animation is forbidden.** A component that applies any animation not in this table is non-conforming regardless of how subtle the animation is.

### 5.2 Causality Communication Through Animation

```
// Animations must communicate direction and causality, not just "something changed."

// Color transition from green → yellow: "This value moved toward a threshold" (direction: worse)
// Color transition from yellow → green: "This value moved away from a threshold" (direction: better)
// The animation direction must match the operational direction of the change.

// Position transition in override stack:
// An override moving up means higher precedence — the visual movement communicates
// that this override now takes priority over others.
// An override moving down means lower precedence.
// The direction must be consistent — up always means higher priority, never reversed.
```

### 5.3 Animation Interruption Rules

```
// From RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md Section 3.2:
// Tier 4+ events may preempt ongoing transitions.
// Preempted transitions snap to terminal state in 100ms before the Tier 4 event renders.

function handleTier4PreemptionOfTransition(transitioningComponent, tier4Event) {
  // 1. Complete the transition to terminal state (100ms snap)
  snapToTerminalState(transitioningComponent, 100);
  // 2. After snap completes: render the Tier 4 event state
  setTimeout(() => renderTier4Event(tier4Event), 100);
  // Notification stream records: "[component] transition preempted by [event] at [timestamp]"
  emitPreemptionRecord(transitioningComponent, tier4Event);
}
```

---

## Section 6 — Render Interruption Prevention

### 6.1 Interaction-Phase Render Freeze

When an operator is in a consequential interaction flow (IF-01 through IF-07), renders to the components within the interaction scope are frozen:

```
// An operator completing an override creation form must not have the form fields
// re-rendered because the underlying operational state changed.
// The form operates against the state that was active when the form was opened.

const interactionLock = useInteractionLock(scope, interactionFlow);

function handleIncomingUpdate(update) {
  if (interactionLock.isLocked(update.scope)) {
    // Queue the update — apply after interaction completes
    interactionLock.queueUpdate(update);
    return;
  }
  applyUpdate(update);
}

// On interaction completion: apply queued updates as a single batch
interactionLock.onComplete(() => {
  const queuedUpdates = interactionLock.drainQueue();
  applyBatch(queuedUpdates);
});
```

### 6.2 What May Not Be Frozen

```
// Interaction-phase render freeze applies to components within the interaction scope.
// The following are NEVER frozen regardless of active interaction:

const NEVER_FROZEN = [
  'GlobalShellIndicators',      // Shell health indicators always update
  'EmergencyActivationControl', // Emergency always accessible
  'Tier4PlusNotifications',     // Escalation notifications always render
  'PendingActionElapsedTimer',  // Pending action timer always counts up
  'StalenessIndicators',        // Staleness indicators always update
];
```

---

## Section 7 — Focus-Safe Reconciliation

### 7.1 Reconciliation Must Not Move Focus

```
// React reconciliation (re-renders triggered by state updates) must not move focus.
// This requires:
// 1. Stable component keys for operational items (not array indices)
// 2. No component re-mounts due to state content changes
//    (Only scope changes cause re-mounts; content changes cause re-renders)
// 3. Refs used for focus tracking, not element identity

// Implementation guard:
// If the currently focused element is about to be re-keyed or re-mounted,
// save the focus and restore it after reconciliation.

function useFocusSafeReconciliation(elementRef) {
  const [savedFocus, setSavedFocus] = useState(null);

  useLayoutEffect(() => {
    if (savedFocus && document.activeElement !== elementRef.current) {
      elementRef.current?.focus();
      setSavedFocus(null);
    }
  });

  return {
    saveFocus: () => setSavedFocus(document.activeElement),
    restoreFocus: () => { /* handled in useLayoutEffect */ },
  };
}
```

### 7.2 Structural Change Focus Handling

```
// When structural changes occur (a panel appears or disappears due to mode change):
// - Focus moves to the nearest meaningful operational element, not to body
// - "Nearest meaningful" is defined by aria-label priority in the new structure
// - The transition animation gives the operator 400ms to perceive the structural change
//   before focus moves — they are not blindly navigated

const FOCUS_FALLBACK_PRIORITY = [
  '[data-focus-fallback="primary-action"]',
  '[data-focus-fallback="context-zone"]',
  '[data-focus-fallback="workspace-root"]',
  'main',
];
```

---

## Section 8 — Viewport Stability Rules

### 8.1 Sticky Headers in Operational Lists

```
// Operational lists with more than 10 items use sticky section headers.
// The section header (e.g., "Active Overrides", "Venue: The Crown") stays visible
// while the operator scrolls through items in that section.
// The operator never loses track of which section they are reading.

// Sticky headers must display the current aggregate state of their section:
// - "Active Overrides (3)" — count updates live while header is sticky
// - "Venues: Degraded (2 of 8)" — degraded count updates live
```

### 8.2 Progressive Loading vs. Pagination

```
// Operational lists must not use traditional pagination (page 1, page 2).
// Pagination causes the operator to lose their place when they navigate to a detail view
// and return — they are back at page 1.

// Instead: infinite scroll with scroll-position restoration.
// When the operator returns to a list, they are returned to their previous scroll position.
// Items they had already loaded are still in the rendered list — not cleared.

// Maximum initial load: 50 items. Beyond 50: load-on-scroll in batches of 25.
// The loading state for the next batch is a subtle indicator at the bottom of the list,
// not a "load more" button that the operator must explicitly click.
```

---

## Section 9 — Stale-Fragment Invalidation

### 9.1 Fragment Staleness Tracking

```
// A rendered fragment is "stale" when the PRE output it represents has been superseded
// by a newer PRE output for the same scope.
// Stale fragments must be invalidated — they may not continue to display old state.

// Invalidation timing:
// - Immediate for RS-01 AUTHORITATIVE fragments (no delay on confirmed updates)
// - Queued for RS-03 TRANSITIONING fragments (wait for transition to complete)
// - Deferred for RS-06 REPLAY-RENDERED fragments (replay fragments only invalidate
//   when the replay timestamp changes — they represent a historical state)

function invalidateFragment(fragment, newPREOutput) {
  if (fragment.renderingState === 'RS_06_REPLAY_RENDERED') {
    // Replay fragments are not invalidated by live PRE updates.
    return;
  }
  if (fragment.renderingState === 'RS_03_TRANSITIONING') {
    // Queue invalidation to apply after transition completes.
    fragment.queueInvalidation(newPREOutput);
    return;
  }
  // Apply immediately for AUTHORITATIVE and other states.
  fragment.apply(newPREOutput);
}
```

### 9.2 No Silent Stale Fragments

```
// A stale fragment that cannot be immediately invalidated (due to transition lock)
// must show a subtle "updating" indicator if the staleness exceeds 400ms.
// An operator who sees a value for 400ms+ without a visual change may assume it is current.
// The "updating" indicator prevents this false assumption.

{isUpdatePending && transitionDurationMs > 400 && (
  <UpdatingIndicator
    // Subtle — not a badge, not prominent
    // Just enough to signal: "this value is about to change"
  />
)}
```

---

## Section 10 — Replay-Frame Rendering Consistency

### 10.1 Deterministic Replay Rendering

```
// When a replay timestamp is set, all components subscribed to that scope
// must render the same output for the same timestamp every time.
// Replay rendering is deterministic.

// This requires:
// 1. No random values in component rendering (IDs, keys, colors must be derived from data)
// 2. No Date.now() calls in component rendering
// 3. No Math.random() calls in component rendering
// 4. Animation state must not affect replay rendering output
//    (animations are presentation layer — they do not affect what is displayed,
//     only how the transition to that display occurs)

// Testable assertion:
// render(scope, timestamp) === render(scope, timestamp)  // always, for same corpus entry
```

### 10.2 Replay Frame Boundary Clarity

```
// When the operator advances the replay scrubber, the transition between frames
// uses the temporal transition animation (600ms from animation legality table).
// The operator can perceive the frame change as a temporal step.

// What must not happen:
// - No instant snapping between replay frames without animation
//   (snapping destroys the operator's sense of temporal continuity)
// - No blending of two replay frames (one timestamp bleeding into the next)
//   (blending creates a state that was never operationally real)
// - No re-use of live animation state for replay transitions
//   (replay transitions are always temporal transitions, not state transitions)
```

---

## Section 11 — Prohibited Rendering Behaviors

The following rendering behaviors are unconditionally prohibited:

```
const PROHIBITED_RENDERING_BEHAVIORS = [
  // 1. Optimistic value display (showing unconfirmed state as current)
  'OPTIMISTIC_VALUE_RENDER',

  // 2. Silent stale fragment (displaying outdated value without disclosure)
  'SILENT_STALE_FRAGMENT',

  // 3. Replay/live blending (mixing temporal contexts without explicit labeling)
  'REPLAY_LIVE_BLEND',

  // 4. Unsolicited scroll movement (scroll position changes the operator did not initiate)
  'UNSOLICITED_SCROLL_CHANGE',

  // 5. Focus theft (focus moves due to state update, not operator action)
  'FOCUS_THEFT',

  // 6. Jitter (same value flickering due to high-frequency updates)
  'VALUE_JITTER',

  // 7. Layout shift from content update (elements moving position due to state change)
  'CONTENT_DRIVEN_LAYOUT_SHIFT',

  // 8. Unannotated animation (animation not in the permitted set)
  'NON_CANONICAL_ANIMATION',

  // 9. Replay frame blending (two replay timestamps visible simultaneously)
  'REPLAY_FRAME_BLEND',

  // 10. Interaction-frozen component showing live updates
  //     (updates visible within a frozen interaction scope)
  'FROZEN_SCOPE_LEAK',
];
```

---

## Failure Modes

### Failure Mode RO-01: Causal Inversion Through Render Order

**What it is:** A consequence renders before its cause due to incorrect render priority. The effective content component updates before the override stack component that explains the change. The operator sees new content and cannot immediately understand why.

**Prevention:** Causal render order enforcement (Section 1.2). Topological sort ensures causes render before consequences.

---

### Failure Mode RO-02: Jitter-Induced Unreadability

**What it is:** A high-frequency data source (health metrics, SOV percentages) updates at 10Hz. The displayed value flickers so rapidly that the operator cannot read it. They lose trust in the display and stop watching it.

**Prevention:** Anti-jitter rules (Section 2.2). Minimum display duration per value. High-frequency updates are queued and applied at the display rate, not the data rate.

---

### Failure Mode RO-03: Scroll Teleportation

**What it is:** The operator is reading item 47 in a venue list. A state update triggers a sort/filter change. The list re-renders with new ordering. The operator's scroll position is now at item 23 (the item that was at position 47 is now at position 12). The operator has lost their reading position.

**Prevention:** Anti-layout-shift rules (Section 2.1) and list virtualization governance (Section 3.2). Sort/filter changes are only applied when the operator is not actively scrolling. Scroll anchor maintenance prevents position loss during prepend operations.

---

### Failure Mode RO-04: Animation Accumulation

**What it is:** Multiple Tier 2 updates arrive while a Tier 1 animation is in progress. Each update queues its own animation. When the first animation completes, the queued animations fire in rapid succession. The operator sees 4 sequential animations instead of one coherent update.

**Prevention:** Render scheduling discipline from OPERATIONAL-FRONTEND-RUNTIME-v1.md Section 3.2. Multiple updates for the same component within the same batch window are collapsed into a single terminal-state animation — not sequential animations.

---

### Failure Mode RO-05: Non-Deterministic Replay

**What it is:** A replay frame renders differently on the second pass — because an animation's in-flight state leaked into the rendering, or because a random value was generated in the render function. The operator navigates back to a replay timestamp and sees a different display than they saw the first time.

**Prevention:** Replay-frame rendering consistency (Section 10.1). No non-deterministic values in component rendering functions. Animation state affects transitions only — not what is rendered.

---

## Related Documents

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — The rendering lifecycle states (RS-01 through RS-06) and concurrency governance rules that this document's orchestration rules implement.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — The permitted animation types and batching windows that Section 5 and Section 2 reference.

**WORKSPACE-COMPOSITION-ARCHITECTURE-v1.md** — The workspace zones that Section 6 interaction-phase render freeze applies to.

**FRONTEND-IMPLEMENTATION-PATTERNS-v1.md** — The implementation patterns (ES-01 ordering, PE-01 pending, RP-01 isolation) that this document's stability rules build on.

**OPERATIONAL-FRONTEND-RUNTIME-v1.md** — The render scheduler discipline (Section 3.2) that atomic compound updates and batch windows implement.

---

*End of RENDERING-ORCHESTRATION-AND-VIEW-STABILITY-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Event delivery ordering and batch window definitions reviewed by: Agent 1 and Agent 2*
*Rendering orchestration, view stability, and animation governance: Agent 3 definition authority*
