# ClubHub TV — Operational Navigation Governance
# Shared Operational Intelligence Layer — Phase A: Canonical Interaction Governance

**Document type:** Interaction constitution — operational movement and context preservation
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 2 (workspace routing); operational leadership
**Last updated:** 2026-05-24
**Status:** CANONICAL — navigation behavior not conforming to this spec is not eligible for deployment
**Phase:** A — Canonical Interaction Model (doctrine translation layer)

---

## Purpose

This document defines how operators move through the ClubHub TV operational environment — between workspaces, across temporal contexts, into and out of incident modes, through fleet and venue hierarchies — without losing operational context or operational accuracy.

The threat this document addresses: **navigation as context destruction**. In most software systems, navigation resets context. You navigate to a new page; the previous page's state is gone. This model is incompatible with operational software, where context is not a convenience — it is the foundation of safe decisions. An operator who navigates from a venue's override stack to the fleet view and back must return to the override stack with the same operational understanding they left with, plus any relevant changes that occurred while they were away.

**The governing principle: navigation is movement through operational reality, not movement through feature space.** The operator is not browsing a product. They are moving their attention within a continuous operational environment. Navigation must preserve the thread of that operational reality — maintaining temporal reference, spatial context, and operational continuity across every transition.

---

## Section 1 — Navigation Philosophy

### 1.1 State-Centric Navigation

Navigation in ClubHub TV is state-centric, not feature-centric. This distinction is fundamental:

**Feature-centric navigation (conventional software):**
- "Go to the Overrides section"
- "Open the Sponsorship dashboard"
- "Navigate to Fleet View"

**State-centric navigation (operational software):**
- "Go to the override stack for Venue 14 as of right now"
- "Open the sponsorship delivery state for Campaign 7 in the current event"
- "Navigate to the fleet health view in the context of the current incident"

State-centric navigation carries context. Every navigation carries: what scope is in focus, what temporal reference is active, and what operational context (incident, normal ops, post-incident review) the operator is working within.

**Implementation requirement:** Navigation is parameterized. A link to "the override stack" includes the venue, the timestamp, and the operational context as parameters. A navigation action that drops the operator at a context-free feature view has failed the state-centric requirement.

### 1.2 Operational Continuity Preservation

Navigation must not destroy operational continuity. An operator who navigates away from a surface and returns must find:

- The same operational focus they left (same venue, same screen, same time reference)
- An indication of what changed while they were away
- Their in-progress work intact (if any)

Navigation is not equivalent to session reset. The operational environment persists across navigation. Scrolled positions, expanded details, active filters — all persist across navigation within a session.

**Exception:** Explicit reset actions (returning to a dashboard from a deep drill-down via the breadcrumb "home" level) may reset focus to the top level. This is intentional and must be labeled: "Return to fleet overview" rather than "Back."

### 1.3 Anti-Context-Loss Design

Context loss is the primary navigation failure mode. It occurs when:
- The operator navigates and cannot find their way back to where they were
- The operator returns to a workspace that has lost the state they were viewing
- The operator switches between workspaces and loses the temporal reference they were working with
- In-progress work (an unsaved override draft, a partially completed investigation) is lost during navigation

Anti-context-loss mechanisms:
- **Persistent breadcrumb** — The full navigation path is always visible, including scope and temporal context
- **State preservation** — Workspaces preserve their state when navigated away from and restored when returned to
- **Draft persistence** — In-progress work is saved as a draft on navigation away (not only on timeout)
- **Change notification on return** — When returning to a workspace, notable changes since departure are surfaced

---

## Section 2 — Primary Navigation Model

### 2.1 Workspace Hierarchy

Navigation in ClubHub TV follows a spatial hierarchy of operational scopes. The operator can be at any level of this hierarchy, and the navigation structure must make their current level unambiguous at all times.

**Level 0 — Fleet**
The broadest operational scope. All venues, all screens. This is the home view for NOC operators and the executive layer.

**Level 1 — Region or Group**
A defined grouping of venues (geographic, operational, or administrative). Optional level — not all deployments use regional grouping.

**Level 2 — Venue**
A single operational location. This is the home view for Venue Managers and Floor Operators.

**Level 3 — Zone**
A defined zone within a venue (bar area, gaming floor, event space). Not all venues define zones.

**Level 4 — Screen**
An individual screen or display. This is the deepest operational scope for override management and introspection.

**Navigation rule:** An operator at Level 4 must be able to reach Level 0 in at most three navigation steps. An operator at Level 0 must be able to reach Level 4 in at most three navigation steps.

### 2.2 Temporal Navigation

In addition to spatial scope (Level 0–4), operators navigate along the time dimension:

- **Present** — Current live state (LIVE mode per CANONICAL-UI-STATE-MODEL.md)
- **Historical** — Past operational state (REPLAY mode)
- **Projected** — Future simulated state (PREVIEW mode)

Temporal navigation is distinct from spatial navigation. An operator can be at Level 2 (Venue) in temporal position Present, or at Level 2 in temporal position Historical (14:23 on 2026-05-23). The combination of spatial scope and temporal position defines the operator's complete navigational context.

**Temporal context must always be visible.** An operator who has navigated to a historical moment must see the temporal context at all times, independent of their spatial scope.

**Temporal navigation rules:**
- Entering a historical moment requires explicit mode transition (per CANONICAL-UI-STATE-MODEL.md Section 3.3)
- Temporal position is preserved when the operator changes spatial scope within a temporal context: navigating from Level 2 to Level 4 while in historical mode keeps the historical timestamp
- Returning to present from historical requires explicit exit (per LIVE-UPDATE-BEHAVIOR-SPEC.md Section 4.3)

### 2.3 Incident Navigation

During an active incident, navigation enters an incident-modified mode. The operator's navigation is focused on the incident scope, with the broader operational context accessible but not in primary focus.

**Incident navigation model:**
- The incident scope (affected screens/venues) is the default navigation context
- Navigation outside the incident scope is available but requires explicit "expand scope" action — the operator does not accidentally navigate to an unrelated venue
- The incident timeline is accessible from any incident-scope navigation context
- Replay navigation during an incident is pre-anchored to the incident trigger time

**Incident navigation must not trap the operator.** The "expand scope" action is always available and never requires more than one interaction. An operator who discovers that the incident has a wider scope than initially declared must be able to expand the navigation context immediately.

### 2.4 Replay Navigation

Replay navigation adds the time dimension as a primary navigation axis. The operator navigates in time as well as in space.

**Replay navigation model:**
- The scrubber is the primary temporal navigation control
- The event timeline is a secondary navigation control — clicking an event in the timeline jumps the scrubber to that event's timestamp
- Spatial scope navigation is available within replay — the operator can navigate to different screens/venues while maintaining the same temporal position
- Forward and backward navigation (5-minute, 1-minute, 15-second increments) is available without using the scrubber

**Replay navigation anchoring:** When entering replay from a specific operational context (e.g., investigating an incident), the replay is anchored to the relevant moment. The operator navigates backward or forward from the anchor. The anchor is visible: "Anchored to: [incident trigger time]. Current position: [timestamp]."

### 2.5 Fleet Navigation

Fleet navigation is navigation across many venues simultaneously. It operates differently from single-venue navigation.

**Fleet navigation model:**
- The primary fleet view displays an aggregated overview of all venues (health grades, active incident count, active override count)
- Drill-down to a specific venue is always one interaction from the fleet view
- Multi-venue selection (for fleet interventions) is available from the fleet view
- Sorting and filtering in the fleet view are navigation tools — the operator uses them to find the venues requiring attention

**Fleet navigation rules:**
- Sort and filter state persists across navigation — an operator who has filtered to "grade D and F venues" returns to that filtered view when they return to the fleet view from a venue drill-down
- The count of venues matching the current filter is always visible: "Showing 7 of 42 venues (filtered: grade D–F)"
- A venue that the operator has recently navigated to is highlighted in the fleet view on return — providing spatial continuity

### 2.6 Escalation Navigation

Escalation navigation is navigation driven by an operational signal — the operator is navigating to investigate or respond to an alert, not browsing.

**Escalation navigation model:**
- Escalation signals are always navigable — tapping the signal takes the operator directly to the relevant scope at the relevant detail level
- The navigation carries context: "Navigated here from: [signal description] at [timestamp]"
- The breadcrumb includes the signal origin: "Fleet → [signal origin] → Venue 14 (from: Grade D alert)"
- The operator can return to the signal origin from any depth of the resulting drill-down

---

## Section 3 — Context Preservation Rules

### 3.1 Persistent Operational Context

The following context elements must persist across all navigation within a session:

| Context element | Persistence behavior |
|---|---|
| Current incident | Incident indicator visible at all scope levels; incident navigation available everywhere |
| Active temporal mode | REPLAY or PREVIEW mode persists across spatial navigation until explicitly exited |
| Applied filters (fleet view) | Filter state persists until explicitly cleared |
| In-progress drafts | Draft state persists across navigation; draft indicator visible at all scope levels |
| Breadcrumb path | Full path visible at all times; updates with each navigation step |
| Last-viewed venue | Returned to when navigating back to venue level after a screen drill-down |

### 3.2 Breadcrumb Governance

The breadcrumb is not decorative. It is the operator's map of where they are in the operational environment.

**Breadcrumb requirements:**
- Full path from fleet to current scope: "Fleet → Region: Pacific → Venue: Clubhouse 14 → Screen: Bar Left"
- Temporal context if in non-live mode: "Fleet → [Replay: 14:23] → Venue: Clubhouse 14"
- Operational context if in incident mode: "Incident: ID-2024-05-23-001 → Venue: Clubhouse 14 → Screen: Bar Left"
- Each breadcrumb element is navigable — tapping any element navigates to that level
- Signal origin if navigation was driven by a signal: "(from: Grade D alert)"

**Breadcrumb is always visible.** It does not collapse, hide, or abbreviate below a scope level. If the breadcrumb is long, the intermediate levels are abbreviated (abbreviated, not hidden) and the current scope is always displayed in full.

### 3.3 Cross-Workspace Continuity

When an operator navigates between workspaces (e.g., from Venue Operations to Incident Operations for the same venue), the spatial context transfers:

- The venue focus transfers to the incident workspace
- The override stack for that venue is immediately visible in the incident workspace
- The temporal context transfers if in replay mode

**Cross-workspace navigation must not require the operator to re-establish their context.** If they were focused on Venue 14 in Venue Operations, navigating to Incident Operations takes them directly to the incident context for Venue 14 — not to a blank incident workspace they must configure.

### 3.4 Replay-Context Persistence

Replay-context persistence is a specialized case of temporal context persistence. When an operator in replay mode navigates to a different spatial scope, the temporal context must transfer:

- Navigating from Venue 14 to Screen: Bar Left while in replay at 14:23 takes the operator to Screen: Bar Left at 14:23
- The replay position does not reset to "now" on spatial navigation
- If the new scope does not have data at the current replay position (e.g., a screen that was added after the replay timestamp), this is surfaced: "This screen was added after [replay time]. Earliest available: [date]."

---

## Section 4 — Attention-Safe Navigation

### 4.1 Interruption-Safe Transitions

Navigation transitions must not create cognitive interruption. The operator must be able to navigate without losing their train of thought about the operational state.

**Interruption-safe transition rules:**
- Transitions are fast — target: under 200ms for intra-workspace transitions, under 500ms for cross-workspace transitions
- Transitions do not include decorative animations that take operator attention
- The destination is pre-loaded where possible — the operator does not wait for data to load at the destination
- If loading is required, a progress indicator appears in the destination context, not as a full-screen blocker

**Navigating during an active thought:** An operator who is in the middle of evaluating a complex operational state and needs to navigate to get more information must be able to do so without losing the evaluation context. The breadcrumb system and context persistence rules ensure they can return to where they were. But additionally: a "note" feature allows the operator to capture their current thought before navigating away — a quick text note anchored to the current scope and timestamp, accessible on return.

### 4.2 Navigation Under Incident Pressure

During an active incident, operators navigate faster, with less deliberation, and with higher error rates. Navigation under incident pressure must account for this:

- **Larger touch targets** — Navigation controls expand during incident mode for mobile operators
- **Common navigation paths are shortened** — During an incident, the most common navigation actions (moving between incident scope, escalating to fleet, returning to incident dashboard) are accessible without traversing the full hierarchy
- **Navigation errors are recoverable** — An operator who accidentally navigates outside the incident scope is returned to the incident context immediately with one action: "Back to incident"
- **Incident context is never lost** — The incident indicator and "back to incident" control are persistent across all navigation scopes during an active incident

### 4.3 Mobile Operational Navigation

Mobile navigation follows the same spatial and temporal model as desktop, with adaptations for the physical constraints of mobile operation:

- **One-handed operation** — Primary navigation controls are accessible with the thumb of the operating hand. Navigation does not require both hands.
- **Touch target minimum** — All navigation elements have a minimum touch target of 44×44 points
- **Swipe navigation** — Swipe gestures navigate between frequently-used adjacent scopes (e.g., swiping between screens within a venue), but only where the swipe direction is unambiguous and does not conflict with scroll
- **No hover navigation** — Navigation must not depend on hover states unavailable on touchscreens

**Mobile context persistence:** On return to the app from backgrounding, the operator returns to the scope they were in, not to the home view. If significant time has passed (e.g., more than 5 minutes), a "state may have changed" notice is displayed — but the scope context is preserved.

### 4.4 Degraded-Attention Navigation

Operators in degraded-attention states (late shift, post-incident recovery, high-stress event) navigate less accurately and with less deliberation. Navigation for these states must:

- Forgive common navigation errors (easy "back" at every level)
- Reduce the cognitive load of navigating (fewer choices at each navigation step, not more)
- Highlight the most operationally significant destination at each level (the venue with the worst health grade is highlighted in the fleet view, not just listed)
- Maintain the breadcrumb as an orientation aid — an operator who is confused about where they are can read the breadcrumb

---

## Section 5 — Navigation Failure Modes

### Failure Mode N-01: Context Fragmentation

**What it is:** The operator navigates across workspaces and the operational context fragments — each workspace shows slightly different state for the same operational scope. The override stack in Venue Operations shows 4 overrides; the Incident Operations view for the same venue shows 3. The operator does not know which is correct.

**Why it happens:** Separate data fetching for each workspace, without shared state synchronization. Each workspace independently fetches state, and the fetches return slightly different snapshots.

**Prevention:** Cross-workspace state consistency rules (CANONICAL-UI-STATE-MODEL.md Section 4.2). All workspaces for the same scope reference the same authoritative data source. State is not independently fetched per workspace — it is shared and synchronized.

**Recovery:** DIVERGENT state (CANONICAL-UI-STATE-MODEL.md Section 2, State Type 8) surfaces the contradiction. The authoritative surface is identified. The operator knows which to trust.

---

### Failure Mode N-02: Navigation Thrashing

**What it is:** The operator navigates back and forth rapidly between two views, unable to see what they need in either. They go to the fleet view to see a venue's health grade, then to the venue view to see the override stack, then back to the fleet view to compare health grades across venues, then to the override stack for a second venue — losing context at each transition.

**Why it happens:** Information that the operator needs together is split across workspaces. The operator is compensating for an information architecture failure by manual navigation.

**Prevention:** Each workspace must contain the information needed to perform its primary operational function without requiring navigation to another workspace. An operator managing a venue's override stack should be able to see that venue's health grade without navigating to the fleet view.

**Detection signal:** An operator who navigates the same path more than twice in 5 minutes is experiencing navigation thrashing. This is an information architecture defect signal.

---

### Failure Mode N-03: Operator Disorientation

**What it is:** The operator does not know where they are in the operational environment. They cannot identify what scope is in focus, what temporal context they are in, or how to get to the scope they need.

**Why it happens:** Breadcrumb failure, context loss on navigation, or interface complexity that makes the current location ambiguous.

**Prevention:** Breadcrumb governance (Section 3.2). State-centric navigation parameters (Section 1.1). The operator's current scope is always labeled explicitly in the breadcrumb and in the workspace heading.

**Recovery:** The breadcrumb is always accurate and always navigable. An operator who is disoriented reads the breadcrumb to determine where they are, then navigates to where they need to be. If the breadcrumb itself is confusing, that is a design defect requiring immediate remediation.

---

### Failure Mode N-04: Replay-Context Collapse

**What it is:** The operator is in replay mode, navigates to a different scope, and the replay context resets — they are now in live mode in the new scope, without knowing it.

**Why it happens:** Temporal context not preserved across spatial navigation. The spatial navigation implementation resets to live state because the new scope's default is live.

**Prevention:** Replay mode is a session-level state, not a scope-level state. Navigating to a new scope within replay does not exit replay. The temporal context transfers with the navigation.

**Recovery:** If replay-context collapse occurs and the operator is not aware they have returned to live mode, this is a HIDDEN TRANSITION — one of the most dangerous navigation failures. The LIVE/REPLAY distinction must be persistent and prominent enough that even accidental mode return is immediately obvious. The operator who looks at the screen must see within one second whether they are in replay or live.

---

## Section 6 — Human Factors

### 6.1 Context-Switching Cost

Every navigation step has a cognitive cost. The operator must re-orient to the new scope, re-read the relevant state, and re-establish their operational understanding. This cost is typically small — a few seconds — but it accumulates. An operator who navigates 30 times in an hour is spending meaningful cognitive resources on re-orientation rather than on operational decisions.

**Design implication:** Navigation that could be eliminated without loss of operational capability should be eliminated. Information that the operator needs together should be visible together. The goal is to minimize the navigation steps required for the operator's most common operational workflows.

**Quantitative target:** For each canonical operational workflow (override creation, incident declaration, sponsorship review), the number of navigation steps from "operator decides to take action" to "action committed" must be counted and minimized. A workflow that requires more than 4 navigation steps is a candidate for architecture review.

### 6.2 Operational Tunnel Vision

Under pressure, operators develop tunnel vision — they navigate deeply into one operational area and lose awareness of the broader operational context. An operator managing an override conflict at a specific screen may not notice that two other venues have also entered DEGRADED state.

**Design implication:** Persistent indicators for the highest-severity operational condition must be visible at all navigation levels, not only at the fleet level. An operator at Level 4 (individual screen) must be able to see that a Tier 4 condition exists elsewhere — not the detail, but the existence. The escalation navigation model (Section 2.6) ensures they can reach the other condition in one action.

### 6.3 Navigation Panic

Under extreme stress, operators may navigate rapidly and randomly, clicking anything that might lead to a solution. This is a predictable failure mode — not irrationality, but a stress response where the operator's normal navigational strategy has broken down.

**Design implication:** The most critical operational destinations must be reachable from anywhere in at most two steps. The emergency activation flow (IF-02 in INTERACTION-SEQUENCING-SPEC.md) must be accessible from every navigation level. Incident declaration must be accessible from every navigation level. The operator who is panicking must find what they need quickly — not because they navigate correctly, but because the interface minimizes the search space.

**Panic recovery:** An operator who has navigated into an unfamiliar area under panic conditions must be able to return to a safe home context immediately. The fleet overview is always one step away — a persistent "home" control at the top of every workspace.

### 6.4 Spatial Cognition Under Stress

Operators under stress demonstrate reduced spatial memory — they have difficulty remembering where information is located, where they have been, and how to navigate back to where they want to go. The breadcrumb system is the primary compensation mechanism. The "most recent" navigation path (the last 3–5 navigation steps) should be accessible as a quick navigation history, allowing the operator to retrace their steps without having to remember the path.

**Navigation history:** A lightweight navigation history — the last N scopes visited, in order — is accessible as a dropdown from the breadcrumb or a distinct control. This is not a "recently visited pages" feature from consumer software. It is a cognitive aid that lets a stressed operator retrace their investigation path when they cannot remember where they have been.

---

## Conformance Requirements

Navigation implementations must conform to this document in addition to CANONICAL-UI-STATE-MODEL.md. Specific conformance checks:

1. **Breadcrumb completeness** — Full scope and temporal context visible at all navigation levels
2. **Context preservation** — State preserved on navigation away and restored on navigation return
3. **Temporal context persistence** — Replay/preview mode persists across spatial navigation
4. **Incident context persistence** — Incident context visible at all scope levels during active incidents
5. **Step count** — Primary operational workflows achieve target step counts
6. **Mobile accessibility** — All navigation accessible with one hand, meets touch target minimums
7. **Recovery accessibility** — "Back to fleet," "back to incident" accessible within two steps from anywhere

---

## Related Documents

**CANONICAL-UI-STATE-MODEL.md** — Navigation transitions are state transitions. The state model governs what states are valid at what navigation levels and what transitions are legal.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — What happens to live updates when the operator navigates between workspaces. Context preservation includes update continuity.

**INTERACTION-SEQUENCING-SPEC.md** — Navigation during in-progress interaction flows. Draft preservation and flow interruption rules.

**OPERATIONAL-WORKSPACES-v1.md** — The workspace types between which navigation occurs. The workspace hierarchy is the spatial structure that navigation moves through.

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — Escalation navigation is driven by signal tiers. Signal tier determines how navigation destinations are highlighted and how urgently the operator is directed toward them.

**PHYSICAL-ENVIRONMENT-AND-VENUE-COGNITION-v1.md** — Mobile navigation requirements in venue environments (one-hand operation, noise, interruption) inform the mobile navigation model in Section 4.3.

---

*End of OPERATIONAL-NAVIGATION-GOVERNANCE.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*Workspace routing implementation: Agent 2 co-authority.*
*State synchronization across navigation: Agent 1 and Agent 2 co-authority.*
*Changes to navigation hierarchy or temporal context preservation rules require cross-agent review.*
