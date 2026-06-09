# ClubHub TV — Rendering Lifecycle and Concurrency
# Shared Operational Intelligence Layer — Phase D: Operational Frontend Execution Architecture

**Document type:** Cross-agent architectural governance — rendering lifecycle states and concurrency governance
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; Agent 1 (event delivery timing); Agent 2 (state synchronization)
**Last updated:** 2026-05-25
**Status:** CANONICAL — rendering lifecycle behavior not conforming to this document is not eligible for deployment
**Phase:** D — Operational Frontend Execution Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the rendering lifecycle states of ClubHub TV UI components and the concurrency governance rules that prevent concurrent rendering activity from producing inconsistent or misleading displays.

The threat this document addresses: **concurrency-induced operational ambiguity.** Frontend rendering is inherently concurrent — multiple events arrive simultaneously, operators take actions while remote updates are arriving, and transitions between states overlap. Uncontrolled concurrency produces rendering artifacts: partial updates, interrupted transitions, conflicting visual treatments, and states that don't correspond to any actual operational reality.

In a consumer application, rendering artifacts are annoying. In ClubHub TV, they are dangerous — an operator who sees a partial state may take action based on the partial view, not realizing that additional changes are still in-flight.

**The governing principle: concurrency honesty.** When multiple things are happening simultaneously, this must be visible — not hidden behind smooth transitions or simultaneous renders that mask the multiplicity. The operator must always be able to determine how many things are changing and whether all changes have completed.

---

## Section 1 — Rendering Lifecycle Philosophy

### 1.1 Operational Rendering Discipline

Rendering discipline means that every visual change has a defined purpose, a defined duration, and a defined terminal state. There are no open-ended transitions, no indefinitely "loading" states, and no animations that continue beyond their operational purpose.

**Rendering discipline rules:**
- Every animation has a defined duration and a defined terminal state — it does not run indefinitely
- Every loading state has a defined timeout — after which the state transitions to either the loaded state or an explicit error/stale state
- Every pending state has a defined resolution path — confirmation, rejection, or timeout

### 1.2 Causality-Preserving Updates

Updates to the render model must preserve the causal order of the underlying operational events. When displaying multiple concurrent updates, the visual presentation must not create the impression that:

- A consequence appeared before its cause
- Two unrelated events were causally related
- An operator action and a remote event occurred simultaneously (when they did not)

**Causality preservation in rendering:**
- When an override and its consequence (content change) update simultaneously, the override stack updates visibly before or simultaneously with the effective state panel — never after
- When a remote operator's action and the current operator's subsequent reaction update simultaneously, the remote action is rendered before the reaction — establishing the causal sequence
- Animations that span causally related components must complete in causal order

### 1.3 Concurrency Honesty

When multiple things are changing simultaneously, this should be visible. Concurrency honesty means:

- If 3 components are updating due to the same event, this multiplicity is visible (they all change simultaneously — the operator can see the scope of the event)
- If 2 different events are being processed at once, the display does not merge them into a single visual change that obscures that two events occurred

---

## Section 2 — Rendering States

Six canonical rendering states exist. Every rendered component is in exactly one of these states at any given moment.

### Rendering State RS-01: AUTHORITATIVE

**Definition:** The component is displaying confirmed, current PRE-resolved state. No pending updates. No in-progress transitions. The displayed value is the operational ground truth.

**Visual treatment:** Normal rendering — no state modifier applied. The component's standard visual presentation.

**Transition conditions:**
- Receives new confirmed state → transitions to TRANSITIONING (if the change is above the animation threshold) or stays AUTHORITATIVE (if the change is below the animation threshold or is a passive update)
- Data freshness threshold exceeded → transitions to DEGRADED
- Pending action initiated by operator → component transitions to PENDING alongside the AUTHORITATIVE state of unchanged components

---

### Rendering State RS-02: PENDING

**Definition:** An operator action is in-flight for this component's scope. The component is displaying the current confirmed state plus a PENDING indicator for the in-flight action.

**Visual treatment:** The PENDING state badge (SB-08) displayed on or adjacent to the component. The confirmed current state continues to render normally. The pending target state is shown alongside as "being applied" — not as the current state.

**Transition conditions:**
- Backend confirms action → transitions to TRANSITIONING (into the new confirmed state)
- Backend rejects action → transitions to AUTHORITATIVE (prior state, with rejection notification)
- Action times out → transitions to AUTHORITATIVE (prior state, with timeout notification)

---

### Rendering State RS-03: TRANSITIONING

**Definition:** The component is in a visual transition between two states. A confirmed state change has been applied and the visual representation is updating.

**Duration rules:**
- Maximum transition duration: 400ms for data value changes; 600ms for component state type changes (e.g., LIVE → REPLAY)
- Transitions must not be interrupted by new state updates unless the new update is Tier 4+ (escalation-critical)
- Transitions that are interrupted by a Tier 4+ update abort immediately and display the escalation state without completing the original transition

**What is visible during TRANSITIONING:**
- The component is in a defined transition between state A and state B
- The transition direction is clear — the operator can tell which direction the change is going
- The prior state is accessible (e.g., the prior value is briefly visible or accessible on demand)

**What must not happen during TRANSITIONING:**
- Another state update to the same component may not render until the current transition completes (unless Tier 4+ preempt)
- The PENDING state badge for a concurrent operator action must remain visible even while a different value on the component transitions

---

### Rendering State RS-04: DEGRADED

**Definition:** The component is rendering state from a degraded or partial source. The data is real but reduced-confidence.

**Visual treatment:** DEGRADED badge applied to the component or to specific values within it. Affected values carry confidence qualifiers.

**Transition conditions:**
- Degradation source resolves → transitions to TRANSITIONING (into the new confirmed state)
- Degradation worsens to full staleness → transitions to STALE (via RS-05)

---

### Rendering State RS-05: STALE (rendering state)

**Definition:** The component has not received confirmed state within the staleness threshold. What is displayed may not reflect current operational reality.

**Visual treatment:** STALE state badge (SB-03). Staleness duration counter. Values displayed in reduced-confidence visual treatment.

**Interaction rules in STALE rendering state:**
- Consequential operator actions blocked
- Read operations permitted
- Automatic reconnection attempts displayed

---

### Rendering State RS-06: REPLAY-RENDERED

**Definition:** The component is rendering deterministic historical PRE output for a specific past moment. It is not displaying current state.

**Visual treatment:** REPLAY state badge (SB-02) from the REPLAY state header (RC-04). The component's standard rendering, applied to historical PRE output.

**Distinction from AUTHORITATIVE:** The data is just as accurate as in AUTHORITATIVE state — it is deterministic PRE output. The distinction is temporal: AUTHORITATIVE shows current state; REPLAY-RENDERED shows a confirmed historical state. Both are equally trustworthy within their respective temporal contexts.

---

## Section 3 — Concurrency Governance

### 3.1 Simultaneous Updates

When multiple components must update simultaneously as the result of a single event (compound update):

**Compound update rules:**
- All components affected by the event transition to TRANSITIONING in the same render frame
- All components complete their transitions before any of them returns to AUTHORITATIVE
- The render scheduler holds subsequent events for all affected components until the compound update is complete

**Exception for Tier 4+ events:** If a Tier 4+ event arrives during a compound update, the compound update is aborted. All transitioning components immediately complete (skip to terminal state) and the Tier 4+ event is rendered.

### 3.2 Render Collision Handling

A render collision occurs when a new event arrives for a component that is currently in TRANSITIONING state. The collision resolution rules:

| Colliding event tier | Resolution |
|---|---|
| Tier 0–2 (passive / advisory) | Queue behind current transition — apply after transition completes |
| Tier 3 (attention-worthy) | Queue with elevated priority — apply at next available render frame after transition |
| Tier 4–5 (escalation / critical) | Preempt — abort current transition, immediately render escalation state |

**Collision disclosure:** When a Tier 4+ event preempts a transition, the aborted transition's terminal state is still applied — the operator sees the escalation state, and when the escalation is acknowledged, the underlying state change is visible. The operator does not lose the information from the aborted transition.

### 3.3 Update Interruption Rules

**Rule UI-01:** No update may interrupt an operator interaction flow in progress (an operator filling out an override creation form) except Tier 4+ events, per INTERACTION-SEQUENCING-SPEC.md Section 4.3.

**Rule UI-02:** No update may interrupt the replay entry or exit transition sequence. If an event arrives during the replay entry sequence (the 6-step transition in Section 3.1 of REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md), it is queued and applied after the transition completes.

**Rule UI-03:** No update may interrupt an emergency activation flow (Flow IF-02 from INTERACTION-SEQUENCING-SPEC.md) for any reason. Emergency activation is atomic and uninterruptible.

### 3.4 Operator Interaction During Transition

When a component is TRANSITIONING, the operator may interact with other components normally. The TRANSITIONING component's interaction affordances are disabled during the transition (the operator cannot modify what is currently changing). After the transition completes, all affordances are restored.

**What this prevents:** An operator who sees a component transitioning to STALE state and immediately tries to take an action on it (before the STALE state is fully rendered and interaction blocking is applied) would otherwise be able to initiate an action on stale data. The interaction affordance disable during TRANSITIONING prevents this race condition.

---

## Section 4 — Transition Governance

### 4.1 Animation Legality (Rendering Context)

From LIVE-UPDATE-BEHAVIOR-SPEC.md Section 3.1, only the following animations are permitted. In the rendering lifecycle context, these map to specific lifecycle transitions:

| Animation | Lifecycle trigger |
|---|---|
| Fade to new value | AUTHORITATIVE → TRANSITIONING (value change, Tier 1–2) |
| Color transition | AUTHORITATIVE → TRANSITIONING (state threshold crossing) |
| Position transition | AUTHORITATIVE → TRANSITIONING (rank reorder) |
| Temporal transition | AUTHORITATIVE → REPLAY-RENDERED (or reverse) |
| Confirmation pulse | PENDING → TRANSITIONING (on confirmed action) |
| Synchronization animation | RS-05 STALE → RS-01 AUTHORITATIVE |

**No other animations are permitted.** A component that uses animation not listed above for any rendering lifecycle transition is non-conforming.

### 4.2 Interruption Visibility

When a transition is interrupted by a higher-priority event (Section 3.2, Tier 4+ preempt), the interruption must be visible:

- The transition does not "snap" — it quickly completes to its terminal state (100ms maximum) before the higher-priority render begins
- The notification stream records: "[component] update preempted by [event description] at [timestamp]"
- The operator who was watching the transition can understand that their view was interrupted and can investigate the cause

### 4.3 Rollback Visibility

When a PENDING action is rejected (the backend rejects the action), the component returns to its prior AUTHORITATIVE state. This return is itself a TRANSITIONING event and must be visible:

- The rollback transition uses a visually distinct treatment from a forward-transition (communicating "this is returning to prior state, not advancing to new state")
- The rejection reason is displayed alongside the rollback transition
- The prior AUTHORITATIVE state the component returns to is labeled as restored: "Override application rejected — displaying prior state"

### 4.4 Pending-Action Rendering (Lifecycle)

In the rendering lifecycle, PENDING state (RS-02) is the component's visual state while an operator action is in-flight. The PENDING rendering must preserve the current AUTHORITATIVE state while showing the pending action:

**PENDING rendering composition:**
- Background layer: current AUTHORITATIVE state (rendered normally)
- Foreground layer: PENDING indicator with action description and elapsed time
- No component in the background layer is hidden or replaced — the operator can always see the current state beneath the pending action

**What PENDING rendering does not do:**
- Replace the AUTHORITATIVE state with the pending target state (optimistic rendering, prohibited)
- Hide the AUTHORITATIVE state while the action is in-flight
- Show the PENDING state for a longer time than the defined action timeout

---

## Section 5 — Failure Modes

### Failure Mode RL-01: Transition Hallucination

**What it is:** The component appears to transition to a state and then transitions back, but no actual state change occurred in the PRE output — the component rendered an intermediate state that was never a valid operational state, and the operator may have interpreted the intermediate state as meaningful.

**Example:** An override stack briefly shows "empty" between the removal of one override and the rendering of the updated stack (which still contains other overrides). The operator concludes that all overrides were cleared.

**Prevention:** Atomic compound updates (Section 3.1 of OPERATIONAL-FRONTEND-RUNTIME-v1.md). The override stack does not render the empty intermediate state — the update is atomic, and the operator sees only the transition from the prior stack to the new stack.

---

### Failure Mode RL-02: Interrupted Render Ambiguity

**What it is:** A transition is interrupted (by a Tier 4+ event preempt) and the operator cannot determine what the terminal state of the interrupted transition was going to be. They know the transition was interrupted, but they don't know what they missed.

**Prevention:** Interruption visibility (Section 4.2). The transition completes quickly before the preempt renders. The notification stream records the interrupted transition's completion. The operator can see what the transition produced and then what preempted it.

---

### Failure Mode RL-03: Hidden Rollback

**What it is:** A PENDING action is rejected, and the component silently returns to its prior state without notifying the operator. The operator believes their action succeeded because the display "looks right" (it returned to a state they expected), when in fact the action was rejected.

**Prevention:** Rollback visibility (Section 4.3). All rejected actions produce explicit rejection notifications. The rollback transition is visually distinct from a forward transition. The operator cannot mistake a rejection for a success.

---

### Failure Mode RL-04: Timing Illusion

**What it is:** Two events that occurred 3 seconds apart in operational time appear to occur simultaneously in the display, because both arrived in the same batch window and rendered together. The operator forms an incorrect mental model of the causal relationship between the events.

**Prevention:** Temporal accuracy in transitions. When batch-processed events are rendered together, their individual timestamps are displayed alongside the visual update — not collapsed into "all happened now." The notification stream entry for each event shows its actual operational timestamp.

---

### Failure Mode RL-05: Concurrent-State Confusion

**What it is:** The component enters an undefined state where two rendering state machines are simultaneously active — PENDING from an in-flight operator action AND TRANSITIONING from a remote state update affecting the same component. The visual result is incoherent — neither the PENDING treatment nor the TRANSITIONING treatment is displayed clearly.

**Prevention:** Render state machine exclusivity (implied by the single state type definition — a component is in exactly one rendering state at a time). The concurrency governance rules define which state takes precedence when two would otherwise apply simultaneously: PENDING state from a current operator action takes precedence over TRANSITIONING state from a remote update, until the operator action is confirmed or rejected.

---

## Section 6 — Human Factors

### 6.1 Rendering Hesitation Perception

When the frontend deliberately holds a render to ensure atomic compound updates or correct event ordering, the operator may perceive a brief hesitation before state changes appear. This hesitation can be interpreted as lag, error, or system slowness.

**Design implication:** The maximum hold time before rendering must be calibrated to be imperceptible (target: under 100ms for normal operations, under 200ms under load). If the hold time exceeds 200ms due to event ordering requirements, a PENDING-style indicator should be shown to communicate "receiving update" rather than allowing the operator to interpret the hesitation as a system problem.

### 6.2 Animation Cognitive Load

Well-designed animations reduce cognitive load by communicating what changed and in which direction. Over-designed or simultaneous animations increase cognitive load by requiring the operator to process multiple visual events simultaneously.

**Design implication:** The maximum simultaneous animations constraint (from LIVE-UPDATE-BEHAVIOR-SPEC.md Section 3.5 — one thing moving at a time, with defined exceptions) is operationalized in the rendering lifecycle. The render scheduler ensures that multiple simultaneous TRANSITIONING states are animated sequentially or as unified compound animation — never as independent concurrent animations competing for attention.

### 6.3 Concurrency Interpretation

Operators who observe concurrent state changes instinctively interpret them as causally related — "these all changed because of the same thing." When concurrent changes are causally related (a compound update from a single event), this interpretation is correct. When they are coincidentally concurrent (two unrelated events arriving in the same batch window), the interpretation is wrong.

**Design implication:** Compound updates from the same event are visually grouped — they change together in a way that communicates "this is one event." Coincidentally concurrent updates from different events are rendered with a brief visual separation that communicates "these are separate events." The notification stream entry for each event provides the definitive disambiguation.

### 6.4 Transition Completeness Expectation

Operators develop an expectation that transitions complete before the display becomes authoritative. When they see a transition in progress, they wait for it to complete before trusting the displayed state. If transitions are interrupted or aborted, this expectation is violated — the operator may be waiting for a completion that will not come.

**Design implication:** Aborted transitions must explicitly complete to a defined terminal state, even if that completion is abbreviated (100ms snap to terminal state). The operator must always see a clear terminal state, never a mid-transition state frozen in place.

---

## Related Documents

**OPERATIONAL-FRONTEND-RUNTIME-v1.md** — The render scheduler (Section 3.2) that implements the concurrency governance defined here.

**EVENT-AND-STATE-ORCHESTRATION-v1.md** — The event classes and orchestration rules that drive state transitions in the rendering lifecycle.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — The animation legality rules (Section 3.1) that the TRANSITIONING rendering state implements.

**INTERACTION-SEQUENCING-SPEC.md** — The interaction flow interruption rules (Section 4) that determine when rendering updates may interrupt operator interactions.

**COMPONENT-CONSTITUTION-v1.md** — The component invariants that the rendering lifecycle states enforce. RS-02 PENDING implements CI-01 (no hidden state mutation) by keeping the current AUTHORITATIVE state visible alongside the pending indicator.

---

*End of RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 3 (UX/Rendering)*
*Event delivery timing affecting transition triggers: Agent 1 co-authority*
*Rendering lifecycle states and concurrency governance: Agent 3 definition authority*
*Animation durations and visual treatment: Agent 3 authority (within constitutional constraints)*
*Changes require consensus of Agent 1 and Agent 3.*
