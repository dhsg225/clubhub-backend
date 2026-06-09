# ClubHub TV — Live Update Behavior Specification
# Shared Operational Intelligence Layer — Phase A: Canonical Interaction Governance

**Document type:** Interaction constitution — live state update rendering governance
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 1 (PRE update delivery); Agent 2 (state synchronization)
**Last updated:** 2026-05-24
**Status:** CANONICAL — live update behavior not conforming to this spec is not eligible for deployment
**Phase:** A — Canonical Interaction Model (doctrine translation layer)

---

## Purpose

This document defines how ClubHub TV surfaces update their displayed state as the operational reality changes — without destroying the operator's ability to maintain situational awareness.

The threat this document addresses: **update-induced cognition disruption**. A platform that updates its displays constantly, unpredictably, or without discipline produces operators who cannot trust what they see. If a value the operator is reading changes mid-read, they must re-read it. If a panel they are interpreting reorganizes while they are interpreting it, they lose their place. If motion and change are constant, operators learn to ignore them — and then miss the changes that matter.

Live operational data is inherently in motion. The platform cannot choose not to update. It can choose how to update: in ways that preserve operator cognition and signal what matters, or in ways that create noise operators learn to filter out along with everything else.

**The governing principle: continuity over motion.** The operator's mental model of the current operational state is more valuable than the pixel-perfect accuracy of any individual value at any individual moment. Updates serve the mental model — they do not override it.

---

## Section 1 — Live Update Philosophy

### 1.1 Continuity Over Motion

Continuous motion is the enemy of operational awareness. A dashboard that flickers, reorders, and refreshes constantly is one where operators have no stable anchor for their attention. They cannot read a value because it keeps changing. They cannot remember a pattern because the layout is different every time they look.

Continuity rules:
- Stable elements stay stable. Layout does not change during normal operations. Item positions within a list do not change unless the change is operationally significant and explicitly visible.
- Values update in-place. A number that changes updates where it is — it does not reorganize the display.
- Reordering is reserved for genuine rank changes. If a venue moves from 8th-worst to 3rd-worst in fleet health, this is operationally significant and a reorder is appropriate — with visible animation indicating the move.
- Color changes are state changes. A value changing color communicates a state change, not just a value change. Color changes must map to the canonical state types (Section 2 of CANONICAL-UI-STATE-MODEL.md).

### 1.2 Stable Cognition Under Change

The test for any update behavior is: does the operator who was mid-thought about the operational state have to restart their thought because of this update? If yes, the update behavior is wrong.

An operator who is reading an override stack should be able to finish reading it even if an unrelated value somewhere else on the screen changes. An operator who is reviewing a sponsor delivery gap should be able to complete that review even if a new override is applied elsewhere.

Stable cognition requires:
- Updates that are outside the operator's current focus of attention must not interrupt that focus
- Updates to the operator's focus area must be visible but not disruptive
- Updates that require the operator's attention must request it, not demand it (except Tier 4+ signals)

### 1.3 Anti-Chaos Update Behavior

The anti-chaos rule: the most important update on screen at any moment must be visually dominant. If ten things are updating simultaneously, and nine of them are routine and one is critical, the critical update must be the one that gets attention — not the nine routine ones.

Anti-chaos requires deliberate suppression of routine updates. A fleet health dashboard should not display all 50 venues' health values flickering with every device heartbeat. It should display stable aggregate values that change only when something genuinely changes.

Updating infrequently is not failure — it is discipline. A value that updates every 30 seconds when the underlying data changes every 5 seconds is doing the operator a service: it is filtering noise.

---

## Section 2 — Update Types

Five canonical update types exist. Every update the platform delivers to the UI must be classified as one of these types. The update type determines how the update is rendered.

### Update Type U-01: Passive Update

**Definition:** A routine value change that reflects normal operational variation. The system is behaving as expected. No operator attention is required.

**Examples:** Minor SOV fluctuation within contracted range. Device heartbeat timestamp. Ambient health grade stable within current letter grade.

**Rendering rules:**
- Value updates in-place with no animation
- No color change unless a state threshold is crossed
- No notification, no badge, no sound
- Timestamp of last update is accessible but not prominently displayed

**Update pacing:** Passive updates are batched. The UI does not render every individual passive update as it arrives. A 5-second batch window is standard — values reflect the most recent state at each batch boundary. This eliminates flickering while maintaining accuracy within an acceptable window.

---

### Update Type U-02: Attention-Worthy Update

**Definition:** A value change that the operator should know about but does not require immediate action. The state has changed in a way that is operationally significant — a venue has moved to a new health grade, an override has expired, a sponsor delivery has crossed a threshold.

**Examples:** Venue health grade change. Override expiry. Sponsor SOV crossing 90% of contracted value. Schedule divergence detection.

**Rendering rules:**
- Value updates in-place with a brief visual emphasis (fade transition, not flash)
- If the update crosses a threshold (grade B → grade C), color change to reflect new state
- A subtle indicator (unread dot, count badge) appears on the surface that changed, visible from the parent workspace
- No full-screen notification, no interruption of current operator task

**Update pacing:** Attention-worthy updates are rendered immediately — no batching. The operator should see the change within the platform's standard update latency (typically 2–5 seconds from state change).

**Operator acknowledgment:** Not required for attention-worthy updates. The operator is informed; they choose when to investigate.

---

### Update Type U-03: Escalation Update

**Definition:** A value change that requires operator awareness and may require action. A condition has moved into a tier that demands response.

**Examples:** Venue health grade dropping to D or F. Emergency content activation on any screen. Override stack accumulation exceeding threshold. Incident escalation.

**Rendering rules:**
- Update renders immediately
- A persistent visual indicator appears (not a toast — a persistent badge or state change that does not auto-dismiss)
- The signal is surfaced at the appropriate tier in the attention tier system (Tier 3+ per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md)
- The update is surfaced in the notification stream with timestamp and navigable link
- On mobile: push notification if the app is backgrounded

**Operator acknowledgment:** Required for escalation updates affecting the operator's assigned scope. Unacknowledged escalation updates remain visible until acknowledged.

---

### Update Type U-04: Replay-Transition Update

**Definition:** The temporal reference of the display changes — either entering replay mode, scrubbing within replay, or exiting replay to return to live state. This is not a data update; it is a fundamental change in what the surface is showing.

**Examples:** Replay mode entered. Timeline scrubber moved to a new position. Replay exited (returning to live state).

**Rendering rules:**
- Mode indicator updates immediately and prominently
- All displayed values update simultaneously to reflect the new temporal reference — no panel-by-panel update, no partial state
- A temporal context line is displayed: "Viewing: [timestamp]" during replay; "Live — last synchronized: [timestamp]" on return
- On replay exit: a brief reconciliation summary before fully transitioning: "You were viewing [prior time]. Since then: [notable changes, or 'no notable changes']."

**Animation:** Replay transitions use a distinct visual treatment that communicates temporal movement — not the same animation as a data update. This signals to the operator that they have moved in time, not just that data has refreshed.

---

### Update Type U-05: Synchronization Update

**Definition:** The platform has completed a state synchronization — recovering from STALE state, completing an explicit refresh, or receiving confirmation of a pending action.

**Examples:** Reconnection from STALE state. Manual refresh completion. Override application confirmed.

**Rendering rules:**
- SYNCHRONIZED state indicator as defined in CANONICAL-UI-STATE-MODEL.md Section 2
- Timestamp of synchronization displayed: "Synchronized at [timestamp]"
- Changes since the last known-good state highlighted: "3 values updated since last synchronization"
- Resolves to LIVE state after the acknowledgment period (3–5 seconds, or on explicit operator dismiss)

---

## Section 3 — Update Visibility Rules

### 3.1 What Animates

Animation in the operational interface is not decoration. Every animation must serve a specific communicative purpose. Animations are permitted only for the following purposes:

| Purpose | Permitted animation |
|---|---|
| Value change (attention-worthy) | Brief fade to new value |
| State threshold crossing | Color transition to new state color |
| Reorder due to rank change | Position transition showing movement direction |
| Replay temporal movement | Temporal transition treatment (distinct from data animation) |
| Pending → applied | Brief confirmation pulse on the affected element |
| STALE → SYNCHRONIZED | Synchronization confirmation animation |
| New escalation signal | Entrance animation for the signal indicator |

### 3.2 What Never Animates

The following must never animate:
- Layout changes (the structural layout of any workspace is static during normal operations)
- Passive value updates (routine operational variations)
- Values that are currently being read (an element under the operator's cursor or focus must not animate)
- Every value simultaneously (if multiple values update at once, animation is suppressed for all but the highest-priority change)

### 3.3 Update Pacing

Passive updates are batched on a 5-second window. Attention-worthy and above are immediate. No exceptions for lower-tier updates entering a batch during an incident — during incidents, update pacing is relaxed further to reduce noise (see INCIDENT-OPERATIONS-UX-v1.md).

**Minimum display duration:** Any displayed value must be visible for a minimum of 2 seconds before updating again. A value that changes faster than 2 seconds is displayed at the pace of the platform's batch window, not the pace of the underlying data changes.

### 3.4 Temporal Continuity Preservation

The platform must not create the impression that time has jumped. Updates that reflect continuous operational progression must be rendered as continuous — not as a series of disconnected snapshots.

**Implementation rules:**
- Timestamps update smoothly (not in 5-second jumps)
- Override age indicators increment continuously, not in discrete steps
- Timeline views display elapsed time as a continuous progression
- If a display is paused for any reason (operator is in replay, connection is STALE), the return to live must include a reconciliation that bridges the gap — operators see what happened while they were away, not just the current state as if the gap did not exist

### 3.5 Motion Discipline

No surface may have more than one thing moving or transitioning at the same time, except in specific cases:

**Permitted simultaneous motion:**
- Replay transition (all panels update simultaneously — this is a single event)
- Fleet-wide emergency activation (all affected screens show state change simultaneously — this is appropriate because it communicates simultaneity of the event)
- Synchronization completion (multiple values may update together — this communicates that the synchronization included multiple changes)

**Prohibited simultaneous motion:**
- Unrelated passive updates animating at the same time
- Background ambient activity creating constant movement in any panel
- Progress indicators for multiple simultaneous operations in the same visual zone

---

## Section 4 — Live / Replay Distinction

### 4.1 Replay-Mode Visual Governance

The visual treatment of REPLAY mode must be persistently, unambiguously different from LIVE mode. This distinction is not a badge — it is a structural visual state.

**Replay-mode visual requirements:**
- A persistent mode indicator occupying a fixed position in the interface: "REPLAY — [timestamp]"
- This indicator must be visible regardless of scroll position, information density, or workspace configuration
- The color palette of the replay surface must differ from the live surface — not a slight variation, a distinct treatment that makes the mode immediately obvious to a peripheral glance
- Timeline controls (scrubber, playback controls) must be prominently visible in replay mode
- All action controls that would affect live state must be visually inactive — grayed, hidden, or explicitly labeled "not available in replay"

### 4.2 Replay-Entry Visibility

Entry into replay mode is a U-04 update. It must be rendered as a distinct moment, not a smooth transition that the operator might not notice.

**Replay entry sequence:**
1. Mode transition animation (distinct from all other animations in the platform)
2. Temporal context display: "Viewing: [timestamp]"
3. All live updates cease — the operator must see that the live stream has stopped
4. Timeline is displayed with the selected position marked

**The operator must not be able to enter replay mode without knowing they have entered it.**

### 4.3 Replay-Exit Visibility

Exit from replay mode is equally significant. The operator is returning from a past state to current operational reality.

**Replay exit sequence:**
1. Explicit exit action required — no accidental replay exit
2. Brief reconciliation display: "You were viewing [time]. You have been in replay for [duration]. Returning to live state."
3. Notable changes summary: "Since [replay time]: [list of significant operational changes, or 'no notable changes']."
4. SYNCHRONIZED state moment (brief confirmation that live state has been loaded)
5. Resolves to LIVE state

**The operator must not return to live state confused about what has changed during their replay investigation.**

### 4.4 Temporal Context Persistence

During replay, the temporal context (what moment is being viewed) must persist visibly across all panels and must be synchronized. If the operator navigates to a different panel while in replay, that panel displays the same temporal moment as the panel they came from.

The temporal context line must update immediately when the scrubber moves — operators can see the time changing as they scrub.

---

## Section 5 — Multi-Operator Update Behavior

### 5.1 Concurrent Intervention Visibility

When another operator takes an action that affects a scope the current operator is viewing, this must be surfaced immediately as a U-02 or U-03 update depending on the significance of the action.

**Visibility requirements:**
- The action is attributed: "[Operator name] applied an override to [screen/venue] at [time]"
- The effective state change is shown immediately
- The override stack updates to include the new override with clear attribution
- If the new action creates a conflict with something the current operator is doing or planning, a conflict alert is surfaced (per INTERACTION-SEQUENCING-SPEC.md Section 4.2)

### 5.2 Remote Operator Update Awareness

The current operator must be able to see, at any time, whether other operators are active on the same scope. This is not blocking information — other operators are not locked out — it is awareness information.

**Concurrent operator indicators:**
- A subtle indicator showing the count of operators currently viewing the same scope: "[N] operators viewing this venue"
- If another operator is in an active interaction flow on the same scope: a more prominent indicator: "[Operator name] is making changes to this venue"
- This indicator updates in near-real-time — the current operator should know within seconds if another operator begins an interaction flow on their scope

**What this indicator does NOT do:**
- Block the current operator from taking action
- Show what the other operator is doing (interaction flows are private until committed)
- Require acknowledgment

### 5.3 Synchronization Acknowledgment

When a remote operator's committed action produces a state change visible to the current operator, the change must be surfaced as a U-02 or U-03 update with attribution. The current operator must be able to distinguish between:

- State changes caused by the PRE's normal resolution (schedule progression, override expiry)
- State changes caused by another operator's deliberate action

Attribution in the update: "Override applied by [Operator name]. Effective: [state change]."

---

## Section 6 — Human Factors

### 6.1 Motion Blindness

Motion blindness (change blindness) is the well-documented phenomenon where humans fail to notice changes that occur during a saccade, a blink, or a moment of inattention — even large, obvious changes. This is not a failure of attention; it is a fundamental property of human visual processing.

**Operational consequence:** An operator can fail to notice a significant operational change even if it happened on screen while they were looking. If the change occurred during a glance away, during the processing of another piece of information, or during any moment of shifted focus, they may miss it entirely.

**Design responses:**
- Changes that matter must persist their visual state after the change — a changed value must remain in an "attention-worthy" visual state until the operator has had a reasonable opportunity to notice it. Not until they acknowledge it — but at minimum until the changed state has been displayed for a full attention cycle (typically 3–5 seconds).
- Critical changes must not be the only signal — a changed value must be accompanied by a secondary signal (a count badge on the parent workspace, an entry in the notification stream) that persists independently of whether the operator noticed the primary change.
- Animations that occur once and then stop may be missed. Important transitions should repeat once at a low intensity after the initial animation.

### 6.2 Update Fatigue

When a dashboard updates constantly, operators develop update fatigue: they stop processing the updates as meaningful signals and start treating them as background noise. Update fatigue is directly caused by poor update discipline — too many updates, too frequent, too uniformly urgent.

**Design responses:**
- Passive update batching (Section 3.3) directly addresses update fatigue by reducing the frequency of visual change
- The strict hierarchy of update types (U-01 through U-05) ensures that updates which warrant attention look different from updates that don't
- The attention budget (from ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md) sets a maximum on how frequently the operator can be meaningfully interrupted in a given operational period
- Operators experiencing update fatigue are experiencing a signal that the dashboard is misconfigured for their operational context — this is a dashboard entropy signal, per ENTROPY-OBSERVABILITY-UX-v1.md

### 6.3 Temporal Disorientation

When an operator enters and exits replay mode frequently — or uses multiple panels simultaneously, some in replay and some live — they may lose track of which temporal frame they are currently in. Temporal disorientation in an operational context is dangerous: an operator who believes they are viewing live state but is actually in replay may take no action on a genuine emergency because they believe the emergency is a historical event they are investigating.

**Design responses:**
- The structural visual distinction between REPLAY and LIVE mode (Section 4.1) is the primary defense. If the mode is structurally obvious at a glance, temporal disorientation requires the operator to be ignoring very prominent signals.
- The temporal context line must be persistent and prominent. An operator who is uncertain about whether they are in replay can look at the temporal context line and immediately know.
- Replay exit must include an explicit reconciliation moment (Section 4.3) that helps the operator re-anchor to the current live time.
- Mixed-mode displays (some panels in replay, some in live) are prohibited. The entire workspace is in one mode at a time.

### 6.4 Unnoticed State Changes

The most dangerous update failure is a state change that was rendered correctly but went unnoticed. The operator was looking elsewhere. The change was a passive update. The visual treatment was a subtle fade. Hours later, the operator discovers the state changed and they never saw it.

**Design responses:**
- State changes that have operational consequences must be logged in a persistent, accessible notification stream. The notification stream is the fallback: even if the operator missed the change on screen, they can review the notification stream and see what changed.
- The notification stream is ordered chronologically, is never cleared automatically, and is accessible from any workspace.
- Significant state changes must generate timeline entries. The operational timeline is the permanent record: even if the notification was missed, the timeline shows what happened.
- State changes that affect the operator's assigned scope must generate a count indicator on the scope's parent view — an operator who navigates to a venue they haven't looked at in 30 minutes must see an indicator that things have changed there.

---

## Related Documents

**CANONICAL-UI-STATE-MODEL.md** — Defines the eight state types that live updates transition between. Update types U-01 through U-05 correspond to transitions and changes within those states.

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — The signal tier system that governs which updates warrant interruption. Update type classification (U-01 through U-05) maps to signal tiers.

**INTERACTION-SEQUENCING-SPEC.md** — Defines what happens when an escalation update (U-03) interrupts an in-progress operator interaction flow.

**OPERATIONAL-NAVIGATION-GOVERNANCE-v1.md** — Navigation between workspaces is itself a form of state transition. The temporal context persistence rules in Section 4.4 apply to cross-workspace navigation as well as within-workspace scrubbing.

**REAL-TIME-OPERATIONS-UX-v1.md** — The real-time operational context within which these update behaviors occur. LIVE-UPDATE-BEHAVIOR-SPEC governs how updates are rendered; REAL-TIME-OPERATIONS-UX governs the operational scenarios that produce those updates.

---

*End of LIVE-UPDATE-BEHAVIOR-SPEC.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*Update delivery latency and synchronization contracts: Agent 1 and Agent 2 co-authority.*
*Update pacing thresholds (batch windows, staleness declarations) require Agent 2 coordination for deployment configuration.*
*Changes to the canonical update types or animation rules require Agent 3 review.*
