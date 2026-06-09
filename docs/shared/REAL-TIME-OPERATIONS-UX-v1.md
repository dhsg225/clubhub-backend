# ClubHub TV — Real-Time Operations UX
# Shared Operational Intelligence Layer

**Document type:** UX governance — live operational cognition architecture
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** UX contributors, frontend engineers, operational system designers
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all live-state and real-time display design

---

## Purpose

This document defines how operators maintain situational awareness of an operation that is constantly changing. The platform never stands still. Manifests poll. Schedules advance. Overrides age. Campaigns progress. Sponsor exposure accumulates. The operator's job is not to understand a static configuration — it is to maintain cognitive alignment with a living, evolving operational state.

The threat this document addresses: live-state disorientation. A display that updates too aggressively fragments the operator's mental model. A display that updates too infrequently lets the operator's model drift from operational reality. A display that communicates state changes unclearly causes operators to perceive normal state evolution as anomalies, or worse, to perceive genuine anomalies as normal state evolution.

**The governing principle: the platform must communicate live state in a way that maintains the operator's mental model without disrupting it.**

---

## Section 1 — Real-Time Philosophy

### 1.1 Operational Continuity Awareness

The operator's most critical cognitive need during live operations is not knowing the current value of any metric — it is knowing that the operation is continuing along the expected path. Continuity awareness means: what is happening is what was expected to happen.

Most of the time, the answer is yes. The currently-playing content is the schedule-predicted content. The next transition will occur at the scheduled time. No override is interfering. In these conditions, the operator's cognitive work is minimal — pattern confirmation.

**When continuity is broken** — when what is happening differs from what was expected — the operator needs to know immediately, clearly, and with enough context to understand why the break occurred. This is the moment when real-time UX is most important and most frequently fails.

**Continuity awareness design principle:** The default real-time display should communicate "everything is proceeding as expected" implicitly, through the absence of anomaly indicators. The system should not require the operator to actively verify continuity — it should make discontinuity obvious.

### 1.2 Live-State Trust Preservation

An operator who cannot trust that the displayed state matches the actual operational state will compensate by over-checking, developing workarounds that feel more reliable, or abandoning the platform for manual verification. Live-state trust is foundational.

Live-state trust requires:
- **Display currency:** The displayed state is the actual current state, within the known polling interval. Never older than one manifest polling cycle without explicit staleness indication.
- **Update honesty:** When the display updates, the update reflects an actual state change, not a display refresh artifact. Cosmetic updates (re-render without state change) that visually resemble state updates destroy trust.
- **Acknowledged uncertainty:** When the platform does not know the current state (device unreachable, delivery log gap), it must display explicit uncertainty rather than the last-known value.

### 1.3 Temporal Stability Under Motion

A display that is constantly in motion — numbers updating every second, indicators flickering, timelines scrolling — is cognitively exhausting and obscures meaningful state transitions within the noise of constant small changes.

**Temporal stability principle:** Changes in display should represent meaningful state changes. Updates that reflect normal operational continuity (a timer counting down, a percentage incrementing by 0.1%) should not produce visual disruption. Only changes that represent operational significance should produce visual events that claim attention.

**Implementation distinction:**
- A timer counting down from 4:00 to 3:59 should update smoothly without visual disruption (normal continuity)
- A schedule transition firing — changing the effective state — should produce a distinct visual event that signals: "The operational state just changed"
- A Tier 3 advisory appearing should produce an attention-claiming visual event that is clearly distinct from continuous-update noise

### 1.4 Anti-Chaos Visibility

During high-activity periods — event start, sponsor rotation, override creation, incident response — multiple state changes may occur nearly simultaneously. An operator seeing a display in rapid-change motion cannot form an accurate mental model of what changed and what the new state is.

**Anti-chaos design responses:**
- State changes within a 5-second window should be batched into a single visual update event where possible, rather than producing N sequential visual events
- After a rapid-change period, the display should present a clear "settled state" that shows the net result, not the sequence of changes
- The operator should be able to pause the live feed in high-activity periods to examine a stable snapshot before returning to live

---

## Section 2 — Live Operations Cognition

### 2.1 Now-State Confidence

The operator's primary cognitive question during live operations is: "Is what is playing right now what should be playing?"

**Now-state confidence requires:**
- The effective state displayed is accurate (within one polling cycle)
- The effective state displays which PRE level is driving it (one-word level indicator: "Emergency", "Override", "Schedule", "Default")
- The effective state displays how long it has been in this state (since when)
- The effective state displays what will change it next (next transition time and trigger)

**Now-state confidence failure:** Displaying content name and time without the driving level creates an operator who knows what is playing but not why. The "why" is not auxiliary information — it determines whether the state is correct.

### 2.2 Next-State Awareness

Real-time operations require not just knowing the current state, but anticipating the next state transition. An operator who knows the current state but does not know when or how it will change cannot plan interventions, verify pre-event configuration, or anticipate sponsorship transitions.

**Next-state information requirements:**
- What triggers the next state change (schedule transition, override expiry, emergency clearance)
- When the trigger fires (timestamp, not just "soon")
- What the new effective state will be after the transition
- Whether the new state is expected (green) or requires review (amber — state is technically correct but has advisory conditions attached)

**Next-state preview linkage:** The next-state display should link directly to a PRE preview for the post-transition state. The operator can verify the next state's resolution in one tap without leaving the live operations context.

### 2.3 Transition Anticipation

For transitions that are imminent (within 5 minutes), the platform should shift into anticipation mode for that transition: slightly elevated visual prominence for the next-state indicator, a countdown replacing the scheduled time display, and a pre-transition advisory if any configuration gaps or override conflicts will affect the transition.

**Anticipation mode timing:**
- 5 minutes before: next-state indicator gains visual prominence
- 2 minutes before: countdown becomes primary temporal display for that screen
- 30 seconds before: transition imminent indicator appears
- Post-transition: brief visual confirmation that the transition occurred as expected (or exception indicator if it did not)

The anticipation sequence should feel familiar and rhythmic for operators doing scheduled operations — it builds operational confidence in the predictability of the system.

### 2.4 Interruption Anticipation

For scheduled interruptions (sponsor rotations, override expiries, emergency clearances), the platform should surface interruption anticipation in the relevant workspace section in advance.

**Interruption anticipation:** If an override is scheduled to expire within the operator's current shift, it should surface in the "upcoming events" section at least 30 minutes before expiry, with a note about what the post-expiry effective state will be.

This allows the operator to make an informed decision about whether the expiry is correct, whether the override should be extended, or whether the expected post-expiry state needs adjustment — while there is still time to act.

### 2.5 Instability Awareness

Operational instability is a state where the PRE output is changing frequently or unpredictably — not due to normal schedule transitions, but due to override collisions, configuration conflicts, or configuration gaps. An unstable operation is one where the effective state is harder to predict than it should be.

**Instability indicators:**
- Transition rate above normal baseline for the venue (N transitions in last hour vs. expected transitions)
- Override stack changes within the last 30 minutes
- Delivery confidence declining over the last polling cycle
- Divergence between predicted next state and previous predicted next state (the system's own prediction changed)

Instability awareness should surface before the instability produces a visible failure — it is a leading indicator of problems developing.

---

## Section 3 — Real-Time Visualization Rules

### 3.1 Live Updates Without Disorientation

Every live update the platform displays must respect the following rules:

**Rule R-RT-01: Anchor before change.** Before updating a value, briefly display the previous value with a transition indicator, then show the new value. This gives the operator's eye a reference point. Abrupt value replacement without transition disrupts the operator's tracking of continuous state.

**Rule R-RT-02: Significance-proportionate visual weight.** A minor numerical update (SOV percentage ticking from 23.1% to 23.2%) should receive minimal visual treatment — the number changes, nothing else. A significant state change (effective state transition, new advisory appearing) should receive proportionate visual treatment that reflects its significance.

**Rule R-RT-03: Stable spatial layout.** The location of elements in the display should not change in response to state changes. An operator who has learned the layout should be able to find any element in the same position after a state update. Reordering lists, repositioning panels, or reflowing layouts in response to live state changes breaks spatial memory.

**Rule R-RT-04: Single-transition visual events.** A state change that would produce multiple simultaneous visual events (new advisory + override expiry + SOV alert) should be presented as a coordinated update, not N simultaneous independent visual events. The operator should experience one visual event representing "several things changed" rather than N separate events demanding N separate attention responses.

### 3.2 Animation Discipline

Animation in operational interfaces has a narrow mandate: to communicate that a change has occurred and to help the operator track what changed. Animation is not decoration. It is not a delight signal. Every animation that appears in an operational display must serve an explicit communication purpose.

**Permitted animation purposes:**
- State transition indicator: a brief visual motion communicating that the effective state changed
- Attention claim: a brief pulse or highlight drawing attention to a new high-priority signal
- Data loading indicator: communicating that a display is refreshing and the current view is stale

**Prohibited animation behaviors:**
- Continuous animation on elements that have not changed state (e.g., a pulsing element used as a "live" indicator)
- Decorative transitions that add time without adding information
- Animation that occurs while no state change has happened (e.g., animated charts that re-animate on each page render)
- Stagger animations that sequence changes across multiple elements — in operations, related state changes should appear simultaneously

### 3.3 State Transition Clarity

When the effective state changes — the most operationally significant event in live operations — the transition must be clearly communicated:

**State transition communication requirements:**
- Previous state briefly visible alongside new state for 2–3 seconds (not just replaced)
- Reason for transition visible: "Schedule advanced" / "Override expired" / "Emergency activated"
- New state's PRE level visible
- If the transition was expected: a subtle confirmation indicator (the operator can verify their expectation was correct)
- If the transition was unexpected: a distinct advisory indicator requiring acknowledgment

**Transition acknowledgment:** For unexpected state transitions, the operator should explicitly acknowledge the transition before the transition notification clears. This creates a record that the operator was aware of the unexpected state, and prevents unexpected transitions from being silently absorbed into background noise.

### 3.4 Temporal Continuity Preservation

The operator's sense of operational time — where the operation is in its timeline, what has happened, what is coming — should be maintained across all interaction with the platform.

**Temporal continuity requirements:**
- Navigating between workspace sections should not reset the temporal display — if the operator was looking at "T+2:14 into current schedule block," returning to the main view should show the current state of that block, not reset to a default view
- The now-indicator on any timeline view should always be clearly anchored
- Historical navigation (looking at past states in forensic views) should clearly distinguish historical from current — the operator should never be uncertain about whether they are seeing live state or historical state

---

## Section 4 — Incident-Time Operations

### 4.1 Rapid Triage Visibility

During an incident, the operator's primary need is rapid triage: understanding what is broken, what scope is affected, and what action is available — faster than they can read a paragraph.

**Triage information requirements (must be visible within 5 seconds):**
- What is the incident type (content failure, override collision, device unreachable, sponsor gap)
- What is the scope (single screen, venue, regional, fleet)
- What is currently playing on affected screens (is the failure visible to customers)
- What is the most immediately available intervention

**Triage display design:** The incident triage view should be pre-composed and instantly accessible from any operational view. It is not a view the operator navigates to by choosing "Incidents" — it should surface automatically when a Tier 4+ signal is generated.

### 4.2 Operator Coordination Awareness

During a multi-operator incident response, operators need to know what other operators are doing to prevent coordination failures: two operators making conflicting interventions, one operator waiting for another who has already resolved the condition, or redundant interventions wasting response time.

**Coordination awareness requirements:**
- Active interventions in progress should be visible to all operators with access to the affected venue
- "Operator X is investigating [scope]" should surface when another operator has the incident view open
- Override creation by one operator during incident response should be visible to coordinating operators in real time
- Intervention collision detection: if two operators attempt to apply conflicting overrides simultaneously, the system must surface a conflict warning before the second override is committed

**Coordination display:** A persistent "who is active" indicator in the incident workspace showing which operators are currently engaged with the incident, their current action, and the last state change they produced.

### 4.3 Intervention Collision Prevention

Intervention collisions occur when two operators attempt to apply operational changes that conflict with each other. During high-stress incident response, with multiple operators working in parallel, the risk of collision is highest precisely when its consequences are most damaging.

**Collision prevention mechanisms:**

*Pre-application collision check:* Before any override is committed during an active incident, the platform checks whether another override is in the process of being applied to the same scope by another operator. If yes, a collision warning surfaces: "Operator Y is applying an override to [scope]. Proceed anyway?" The operator can confirm, which records both interventions and the explicit decision to proceed despite the collision.

*Scope lock advisory:* An operator can optionally "claim" a scope for investigation during incident response. The claim is a display advisory only — it does not prevent other operators from acting, but it surfaces a warning when another operator attempts to act on a claimed scope. This is advisory, not blocking (Engineering Constitution §2.7).

*Intervention queue visibility:* During a complex incident, a visible queue of pending interventions (committed, in-progress, completed) lets operators see the full intervention picture before deciding on the next action.

### 4.4 Escalation Synchronization

During incident response, the escalation level (L1→L2→L3→L4) must be visible to all operators and updated in real time. An operator who doesn't know the current escalation level may apply a response appropriate for L1 to an incident that has escalated to L3.

**Escalation synchronization requirements:**
- Current incident escalation level visible in all workspace views, not just the incident view
- Escalation level changes produce a system-wide notification to all operators in the system
- The expected next escalation trigger is visible (what will cause this to escalate to the next level if not resolved)
- When escalation authority changes (from Venue Manager to Org Admin, for example), the authority handover is explicitly displayed

---

## Section 5 — Live Multi-Screen Cognition

### 5.1 Fleet Awareness at Motion

An operator monitoring a multi-screen or multi-venue fleet during an active operation is performing a rapid pattern-scanning task: looking for anomalies in a field of screens that should all be showing expected behavior.

**Fleet display at motion requirements:**
- Each screen or venue should show a minimal but complete health indicator: a colored status dot (green/amber/red) and the current effective state type (schedule/override/emergency)
- The fleet view should update in sync — not individual screens updating independently, which creates confusing motion patterns
- An operator should be able to scan a 20-screen fleet view and identify all anomalies within 10 seconds

**Fleet motion discipline:** The fleet view should update at the same cadence as the manifest polling cycle — not continuously. Updates that are faster than the polling cycle (visual refreshes, cosmetic changes) should not produce motion in the fleet view.

### 5.2 Anomaly Surfacing

In a fleet view, normal screens should be as visually quiet as possible, allowing anomalies to stand out naturally. The visual design should make the operator's pattern-detection task easier by reducing the visual noise from healthy, normal-state screens.

**Anomaly surfacing principles:**
- Healthy screens: minimal, uniform visual treatment. Same color, same icon, same visual weight.
- Advisory screens (Tier 2): slight visual distinction that is perceptible on peripheral scan — a subtle amber indicator
- Intervention-required screens (Tier 3): clearly distinct visual treatment — amber, larger indicator
- Escalation screens (Tier 4): prominent visual treatment that immediately pops against healthy screens
- Incident screens (Tier 5): maximum visual prominence — cannot be missed on any scan

**The healthy screen is the baseline.** Design healthy screens first. The anomaly treatment is the deviation from the baseline. If healthy screens have visual complexity, the anomaly has nothing to contrast against.

### 5.3 Synchronized Divergence Detection

Divergence — where the delivered content differed from what PRE predicted — is most significant when it occurs across multiple screens in a correlated pattern. A single screen's divergence may be a device issue. Multiple screens diverging simultaneously suggests a systemic issue.

**Synchronized divergence display:**
- When divergence is detected on multiple screens within a time window, the fleet view should group them visually: screens showing synchronized divergence should be highlighted as a group, not as N individual anomalies
- The divergence summary should show: time window, number of screens, common factor (same schedule block, same override, same device type)
- The operator can drill into the group to see the individual screen divergences or pull up the fleet-level divergence analysis

### 5.4 Operational Cluster Visibility

During scheduled events, a subset of the fleet is in "event mode" — higher operational priority, active sponsor rotations, potential interruptions. The operator needs to distinguish between the event cluster (high-attention required) and the ambient operation (low-attention expected).

**Cluster visibility requirements:**
- Active event clusters should be visually distinguishable in the fleet view
- Cluster grouping by event type: "Sponsor event — 4 screens" / "Emergency active — 1 screen" / "Standard operation — 15 screens"
- The operator should be able to view the fleet filtered by cluster: "Show only event-active screens"
- Cluster status should roll up to a cluster-level health indicator so the operator doesn't need to scan individual screens within a known cluster

---

## Section 6 — Failure Modes

### Failure Mode F-RT-01: Live-State Desynchronization

**What it is:** The displayed state and the actual operational state have diverged — the operator is looking at stale data that does not reflect current reality.

**Why it happens:** Network latency, polling cycle delays, frontend caching errors, or backend state propagation delays can cause the display to lag behind reality.

**Detection signal:** Operators report that "the screen showed X but it was actually playing Y." Delivery log divergences that correlate with display cache behavior. Operators requesting manual refresh more than once per shift.

**Prevention:** Every displayed operational value must have an explicit timestamp showing when it was last updated. Values older than one polling cycle must display a staleness indicator. Values older than two polling cycles must display a warning. The platform must not display a value as current when it cannot confirm currency.

---

### Failure Mode F-RT-02: Motion Blindness

**What it is:** The display is updating so continuously that the operator cannot distinguish meaningful state changes from normal update noise. Everything is in motion; nothing stands out.

**Why it happens:** Real-time data feeds updating at high frequency, multiple independent data sources updating at different rates, no aggregation layer between the data feed and the visual display.

**Detection signal:** Operators describe the display as "too busy" or "never settling." Operators miss state transitions because the transition didn't stand out from background motion. Screen recordings of the dashboard show continuous pixel-level changes throughout normal operation.

**Prevention:** Apply the significance-proportionate visual weight rule (Section 3.1). Implement update batching to prevent N rapid updates from producing N rapid visual events. Distinguish continuous-update elements (timers, progress indicators) from state-change-update elements (effective state, advisories) and design their visual behavior independently.

---

### Failure Mode F-RT-03: Update Jitter Confusion

**What it is:** Display updates that appear to "change back and forth" due to rapid state oscillation — a condition alternating between two states at a rate visible on the display. The operator perceives a confusing flickering between states and cannot determine the current state.

**Why it happens:** Underlying operational state oscillation (a device bouncing between connected and unreachable states, an override at threshold repeatedly applying and clearing), combined with a display that reflects each state change immediately.

**Detection signal:** Operators report a "flickering" advisory that keeps appearing and disappearing. Operators cannot determine whether a condition is active or resolved because the display keeps changing.

**Prevention:** Implement display debouncing: a signal must remain in a new state for at least N seconds before the display transitions to show the new state. This prevents display jitter from underlying state oscillation without delaying reporting of genuine sustained state changes.

---

### Failure Mode F-RT-04: Operational Time Lag Distrust

**What it is:** Operators have lost confidence that the displayed state reflects real-time operational reality. They begin manually verifying operational state through alternative means (walking to screens, calling venue staff) because they don't trust the platform display.

**Why it happens:** Accumulated experiences of live-state desynchronization (F-RT-01) or update jitter confusion (F-RT-03) have trained operators to distrust the display. Once this distrust is established, it is very difficult to reverse.

**Detection signal:** Operators using alternative verification methods as a routine practice, not just for specific anomalies. Operators who describe the platform as "slow to update" even after latency issues are resolved. Operators who are surprised by what they see on physical screens despite the platform showing a different state.

**Prevention:** Trust is earned through consistent accuracy over time. The most effective prevention is rigorous staleness indication (so operators always know when they're seeing confirmed vs possibly-stale data) and rapid resolution of any desynchronization incidents with transparent postmortem communication to operational staff.

---

*End of REAL-TIME-OPERATIONS-UX-v1.md v1.0*
*Authority: Agent 3. Polling cycle timing and delivery log semantics are Agent 1 domain.*
*Maintained by Agent 3 with Agent 1 review for any changes to live-state data currency guarantees.*
