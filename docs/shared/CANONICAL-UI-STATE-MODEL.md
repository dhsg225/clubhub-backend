# ClubHub TV — Canonical UI State Model
# Shared Operational Intelligence Layer — Phase A: Canonical Interaction Governance

**Document type:** Interaction constitution — authoritative UI state semantics
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors, Agent 1 (PRE API surface), Agent 2 (state synchronization contracts)
**Last updated:** 2026-05-24
**Status:** CANONICAL — no frontend implementation may proceed without conforming to this model
**Phase:** A — Canonical Interaction Model (doctrine translation layer)

---

## Purpose

This document is the frontend equivalent of PRE operational law. It defines the authoritative state model for all UI behavior in ClubHub TV — what states exist, how they transition, how they are displayed, and what the operator must always be able to determine from any view at any time.

The threat this document addresses: **state ambiguity in the interface**. When the UI fails to make its own state legible — when an operator cannot tell whether a view is live or stale, whether an action is committed or pending, whether two panels are showing the same moment in time — the platform's operational truth guarantee is broken at the rendering layer. The PRE can be perfectly deterministic. The replay harness can be exactly correct. If the UI introduces ambiguity about what it is currently showing, operators cannot trust it — and operators who cannot trust the interface cannot safely operate the platform.

**The governing principle: the UI has one job.** It is a transparent window onto the platform's authoritative operational state. Its job is not to interpret, smooth, approximate, or editorialize that state. Its job is to show it, label it precisely, and make its own rendering state unambiguous at all times.

---

## Section 1 — UI State Philosophy

### 1.1 Authoritative State Visibility

Every UI surface must display exactly one authoritative operational state at any given moment. That state is:

- **Named** — the operator can see what kind of state the surface is in (live, replay, preview, stale, etc.)
- **Sourced** — the operator can determine where the state came from (PRE resolution, operator input, remote update, historical record)
- **Timestamped** — the operator can determine when the state was last authoritative
- **Bounded** — the operator can determine the scope of the state (which screen, venue, fleet segment)

No surface may display state without making all four properties accessible. They need not all be permanently visible — progressive disclosure is acceptable — but they must be reachable within two taps or clicks from any operational view.

### 1.2 Effective-State Primacy

The effective state is what the PRE has resolved as the current operational output. It is the ground truth. All UI state representations are downstream of it.

**Effective-state primacy rules:**
- The effective state is always displayed in the primary position on any screen or venue view
- Contributory states (override stack, schedule block, emergency activations) are displayed as context for the effective state, never as replacements for it
- If the effective state cannot be determined (network failure, PRE unavailable), this must be shown explicitly — the interface must not display a cached or inferred effective state without labeling it as such
- No UI transformation, simplification, or summarization may change the semantic meaning of the effective state

### 1.3 No Hidden Operational Truth

There is no operational fact that may be withheld from a surface that is responsible for acting on it.

This is a constitutional rule, not a design preference. If an override is affecting the effective state of a screen, that override must be visible on any surface that manages that screen — regardless of scope, role, or information density constraints. If a screen is in degraded state, that degradation must be visible on any surface that is responsible for that screen.

Information that affects operational decisions must be present in the interface for operators making those decisions. The information may be compressed (a count, a grade, an indicator) but the underlying condition must be accessible.

### 1.4 Replay / Live / Simulated Distinction

The most critical state distinction in the interface is whether the operator is viewing:

- **Live state** — the current PRE-resolved operational reality, updating in real time
- **Replay state** — a deterministic reconstruction of a past operational moment
- **Preview state** — a PRE-evaluated simulation of a future or hypothetical state
- **Stale state** — a live view that has lost synchronization and may no longer reflect current reality

These four modes are operationally incompatible. An action taken in replay state has no effect. An action taken on stale data may override correct operational state with outdated information. An operator who confuses preview for live may believe an action has been committed when it has only been simulated.

**The distinction must be unambiguous at all times.** Not inferrable. Not indicated by a small badge. Structurally obvious from the interface state — through persistent mode labeling, visual treatment, and behavioral differences that the operator cannot fail to notice.

---

## Section 2 — Canonical State Types

Eight canonical UI state types exist. Every surface in the platform must be in exactly one of these states at any given moment. States are mutually exclusive for any given surface scope.

### State Type 1: LIVE

**Definition:** The surface is displaying the current PRE-resolved operational state, receiving real-time updates, and is synchronized with the authoritative operational record.

**Operator understanding:** What I see is what is happening right now. Actions I take are immediate and real.

**Visual indicators:**
- Live state indicator: persistent, never hidden, never defeatable by information density settings
- Last-synchronized timestamp: visible, updating continuously
- No temporal qualifier on displayed state

**Behavioral requirements:**
- Updates propagate within defined latency thresholds (see LIVE-UPDATE-BEHAVIOR-SPEC-v1.md)
- Operator actions are committed immediately upon confirmation
- Replay controls are disabled or hidden
- Preview mode is accessible but requires explicit mode transition

**Prohibited in LIVE state:**
- Displaying historical data without explicit temporal labeling
- Showing predicted or inferred state as if it were confirmed current state
- Blocking updates without operator acknowledgment

---

### State Type 2: REPLAY

**Definition:** The surface is displaying a deterministic reconstruction of a past operational moment, sourced from the PRE replay engine. No live updates are occurring. Operator actions have no effect on live operational state.

**Operator understanding:** What I see is what was happening at a specific past moment. I cannot change anything from here.

**Visual indicators:**
- REPLAY mode banner: persistent, high-visibility, cannot be dismissed
- Temporal context: the exact moment being viewed, displayed prominently
- Timeline scrubber: visible and accessible
- All action affordances that would affect live state: disabled with explanatory label

**Behavioral requirements:**
- PRE replay must be called directly — no approximation or reconstruction from logs
- The replay moment must be precise to the second
- Navigation within replay must update all panels simultaneously to the same temporal reference
- Exit from replay must restore the pre-replay live state context

**Prohibited in REPLAY state:**
- Enabling any action that affects live operational state
- Displaying live-state updates alongside replay state without explicit labeling
- Allowing the temporal reference to drift between panels

---

### State Type 3: PREVIEW

**Definition:** The surface is displaying the result of a PRE evaluation of a hypothetical state — the consequence of a proposed action before it is committed. No changes have been made to live operational state.

**Operator understanding:** I am seeing what would happen if I applied this action. Nothing has changed yet.

**Visual indicators:**
- PREVIEW mode indicator: persistent, visually distinct from LIVE and REPLAY
- The proposed action clearly labeled and visible
- Diff presentation: what changes relative to current live state (highlighted, not just the new state)
- Commit and cancel affordances: prominent and unambiguous

**Behavioral requirements:**
- Preview must call actual PRE evaluation — never a simulation, approximation, or cached prior result
- The hypothetical state must be derived from the current live state plus the proposed action
- Preview must remain valid only while the underlying live state has not materially changed; if live state changes during preview, the preview must be invalidated with a "state changed — regenerate preview" prompt
- Preview must show the full effective state impact, including downstream consequences (sponsor SOV, schedule gaps, override conflicts)

**Prohibited in PREVIEW state:**
- Committing changes without explicit operator confirmation following preview review
- Presenting preview as a guarantee of future state (live state may change between preview and commit)
- Hiding consequences that are unfavorable but operationally significant

---

### State Type 4: STALE

**Definition:** The surface was displaying live state but has lost synchronization with the authoritative operational record. The displayed state may no longer reflect current reality. The duration and degree of staleness are known and displayed.

**Operator understanding:** My view has fallen behind. I may be seeing information that is no longer accurate. I must not act on this view without understanding the staleness.

**Visual indicators:**
- STALE state indicator: prominent, cannot be dismissed
- Staleness duration: how long since last confirmed synchronization
- Last known good state: clearly labeled as past-tense
- Reconnection status: actively attempting to resynchronize, with visible progress

**Behavioral requirements:**
- Staleness must be detected and displayed within one update cycle of the expected update interval
- The threshold for staleness declaration is: one missed update cycle plus one grace period (typically 15 seconds total, configurable by deployment)
- Actions that require current state (override creation, emergency activation) must be blocked in STALE state with an explicit explanation: "Cannot apply — view is not synchronized. Last synchronized: [timestamp]."
- Read-only information operations (viewing override history, reviewing schedules) may continue in STALE state with staleness clearly labeled
- Reconnection must be attempted automatically; the operator must not be required to manually refresh

**Prohibited in STALE state:**
- Allowing consequential operator actions without explicit staleness acknowledgment
- Displaying stale state as if it were current
- Hiding the staleness duration

---

### State Type 5: DEGRADED

**Definition:** The surface is displaying live state from a degraded or partial operational source. The PRE is operating, but some inputs are unavailable (device unreachable, partial fleet data, reduced-confidence resolution). The displayed state is real but incomplete.

**Operator understanding:** The system is running but something is wrong. My view is accurate for what it has, but it may be missing information.

**Visual indicators:**
- DEGRADED state indicator: persistent, with specific degradation description ("3 screens unreachable," "Sponsor delivery data delayed")
- Confidence qualifier on all displayed values: which values are fully confirmed, which are partial
- Degradation scope: which screens, venues, or data types are affected

**Behavioral requirements:**
- Degraded state must specify what is degraded — generic "partial data" is insufficient
- Operations may proceed in DEGRADED state, but the operator must understand which information is reliable and which is not
- Actions affecting degraded components must carry additional confirmation: "This screen is currently unreachable. Override will be applied when connectivity is restored."
- Recovery from DEGRADED state must be surfaced visibly — "screen reconnected, state updated"

**Prohibited in DEGRADED state:**
- Presenting partial data as complete without degradation labeling
- Silently averaging or filling missing data without disclosure

---

### State Type 6: PENDING-INTERVENTION

**Definition:** The surface is displaying live state with one or more operator actions that have been initiated but not yet confirmed as applied. The live state and the operator's intended state may temporarily differ.

**Operator understanding:** I have taken an action. It is being applied. I am waiting for confirmation that it succeeded.

**Visual indicators:**
- Pending action indicator: which action is in-flight
- Estimated completion time (if known) or "applying..." with elapsed time
- The current live state and the pending action's intended state displayed together
- Success/failure confirmation when the action resolves

**Behavioral requirements:**
- Pending state must not persist beyond a defined timeout (typically 10 seconds); after timeout, the action must either confirm, fail, or escalate to an error state
- Operator must not be able to initiate a conflicting action while one is PENDING
- If the underlying live state changes while an action is PENDING in a way that invalidates the action, the operator must be notified before the action is applied

**Prohibited in PENDING-INTERVENTION state:**
- Silently failing a PENDING action without operator notification
- Allowing conflicting actions to be queued without explicit operator acknowledgment
- Hiding the pending state (displaying the action as already applied before it is confirmed)

---

### State Type 7: SYNCHRONIZED

**Definition:** The surface has just completed a state refresh, reconnection, or explicit synchronization with the authoritative operational record. It is now current and confirmed. This state is transitional — it resolves to LIVE after acknowledgment.

**Operator understanding:** My view has just been confirmed as current. I can trust what I see.

**Visual indicators:**
- Brief synchronization confirmation: "View updated — synchronized at [timestamp]"
- Not a persistent banner — transitional only (visible for 3–5 seconds or until dismissed)
- Resolves to LIVE state automatically after the confirmation period

**Behavioral requirements:**
- SYNCHRONIZED state must appear after every reconnection from STALE
- Must appear after an explicit manual refresh
- Must appear after replay-exit when returning to live state
- The synchronization timestamp must be precise — not "just now" but the actual time

---

### State Type 8: DIVERGENT

**Definition:** The surface is displaying state that is known to differ from another authoritative surface for the same operational scope. Two panels, workspaces, or operator views are showing contradictory state for the same screen, venue, or fleet segment.

**Operator understanding:** What I see here does not match what [another surface] shows. There is a conflict that must be resolved.

**Visual indicators:**
- DIVERGENT state indicator: specific, identifying which surfaces are contradicting each other
- The conflicting values: shown side by side where possible
- Divergence timestamp: when the contradiction was first detected
- Resolution path: how to investigate (replay link, data source audit)

**Behavioral requirements:**
- Divergence must be detected automatically when multiple surfaces display contradictory state for the same operational scope
- The platform must identify the authoritative surface and label it as such
- Operators must not be allowed to take consequential actions on a DIVERGENT surface without acknowledgment
- Divergence must be logged for investigation

**This state should be rare.** Its existence indicates a platform-level coherence failure per SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md. Every instance of DIVERGENT state is a defect to be investigated, not a normal operational condition to be managed.

---

## Section 3 — State Transition Governance

### 3.1 Valid Transitions

The following state transitions are legal. Transitions not listed here are prohibited.

```
LIVE          → REPLAY              (operator initiates replay investigation)
LIVE          → PREVIEW             (operator initiates action preview)
LIVE          → STALE              (synchronization lost)
LIVE          → DEGRADED            (upstream data source becomes partial)
LIVE          → PENDING-INTERVENTION (operator initiates action)

REPLAY        → LIVE               (operator exits replay)
REPLAY        → PREVIEW            (operator previews action against replay state — simulation only, never commits to live)

PREVIEW       → LIVE               (operator cancels preview)
PREVIEW       → PENDING-INTERVENTION (operator commits previewed action)

STALE         → SYNCHRONIZED       (synchronization restored)
STALE         → DEGRADED           (synchronization partially restored)

DEGRADED      → LIVE               (upstream data source restored)
DEGRADED      → STALE              (degradation worsens to full synchronization loss)

PENDING-INTERVENTION → LIVE        (action confirmed applied)
PENDING-INTERVENTION → LIVE        (action failed, state reverts)

SYNCHRONIZED  → LIVE               (after confirmation period)

DIVERGENT     → LIVE               (divergence resolved)
```

### 3.2 Invalid Transitions

The following transitions are prohibited and must be prevented at the implementation level:

- **REPLAY → PENDING-INTERVENTION against live state** — replay actions must never affect live operational state
- **PREVIEW → LIVE without explicit commit or cancel** — preview must not silently resolve
- **STALE → PENDING-INTERVENTION** — actions requiring current state are blocked in STALE
- **DIVERGENT → PENDING-INTERVENTION** — operator must acknowledge divergence before acting
- **Any state → LIVE without synchronization confirmation** — live state must be confirmed, not assumed

### 3.3 Transition Visibility Requirements

Every state transition must be visible to the operator. No transition may occur silently.

**Transition visibility rules:**
- State name: the new state must be labeled immediately upon transition
- Trigger: the operator must be able to see what caused the transition ("Replay initiated by: [operator action]," "Synchronization lost: [reason if known]")
- Timestamp: when the transition occurred
- Reversibility: whether and how the operator can return to the prior state

Transitions that occur without operator action (LIVE → STALE, LIVE → DEGRADED) must be more prominent than operator-initiated transitions — the operator did not choose this and must be actively notified.

### 3.4 Transition Acknowledgment Rules

Some transitions require explicit operator acknowledgment before proceeding:

**Required acknowledgment:**
- LIVE → REPLAY (operator must confirm they are entering historical investigation mode)
- STALE → PENDING-INTERVENTION (operator must explicitly acknowledge staleness before acting — cannot be bypassed)
- DIVERGENT → PENDING-INTERVENTION (operator must acknowledge the divergence before acting)
- PREVIEW commit (operator must explicitly confirm previewed action)

**Not required (automatic):**
- LIVE → STALE (system-initiated, operator is notified not prompted)
- LIVE → DEGRADED (system-initiated, operator is notified)
- SYNCHRONIZED → LIVE (automatic after confirmation period)
- PENDING-INTERVENTION → LIVE on success (automatically resolves)

### 3.5 Authority Transfer Visibility

When operational authority for a screen, venue, or fleet segment transfers between sources (e.g., an override expires and authority returns to the schedule; an emergency activation is cancelled and authority returns to normal resolution), this must be explicitly surfaced:

- The transfer event must appear in the operational timeline
- The new authoritative source must be labeled
- The effective state change must be highlighted (not just the authority change — the operator must see what the consequence is)
- If the authority transfer produces a significant change in displayed content, this must be surfaced in the relevant workspaces as a notable event, not a silent update

---

## Section 4 — State Consistency Rules

### 4.1 Cross-Panel Consistency

Within a single workspace, all panels must display state from the same temporal reference at all times.

**Rule:** If Panel A displays the override stack at T=14:23:45 and Panel B displays the effective state for the same screen, Panel B must also reflect T=14:23:45. Panels showing different moments for the same operational scope are incoherent.

**Implementation requirement:** State updates must propagate to all panels within a workspace before any panel is rendered with the new state. Partial updates — where some panels show T+1 and others show T — are prohibited.

**Exception:** Panels that explicitly display historical context (timeline, event log) may show historical state alongside current state, provided the temporal distinction is clearly labeled for each data point.

### 4.2 Cross-Workspace Consistency

When an operator navigates between workspaces (e.g., from Venue Operations to Incident Operations for the same venue), the state visible in each workspace must be coherent:

- An override visible in the Venue Operations override stack must be visible in the Incident Operations override view
- A health grade displayed in the NOC fleet view must match the health grade displayed in the Venue Operations view for the same venue
- An emergency activation shown in the Emergency Operations workspace must appear in the Venue Operations workspace for affected venues

Cross-workspace consistency is tested by the coherence audit defined in SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md.

### 4.3 Mobile / Desktop Consistency

An action taken on mobile is identical in the operational record to the same action taken on desktop. An override created on mobile appears in the desktop override stack. An incident acknowledged on mobile is resolved on desktop.

Mobile-specific information density reductions (fewer visible data points, simplified views) must not create the impression that the operational reality is different. What is simplified or hidden on mobile must be accessible through explicit drill-down, not absent from the operational record.

### 4.4 Replay / Live Parity

When an operator exits replay and returns to live state, the live state they return to must be coherent with the replay they just viewed. If the replay showed an override expiring at 14:30 and the current live time is 14:35, the live view should reflect the post-expiry state — and this transition should be surfaced to the operator, not silently applied.

Replay exit must include a reconciliation moment: "You were viewing [time]. Current live state is [time]. Notable changes since then: [summary or 'no changes'.]"

### 4.5 Timeline Consistency

Any operational timeline displayed across multiple surfaces (venue dashboard timeline, incident timeline, NOC event feed) must use:

- The same event categorization taxonomy
- The same temporal reference frame
- The same event labels for identical event types
- The same ordering rule (chronological, newest-first — must be consistent)

An override appearing as "Applied" in one timeline and "Activated" in another for the same event is a semantic consistency failure per SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md.

---

## Section 5 — State Authority Model

### 5.1 Authoritative Surfaces

For any given operational scope, one surface is the designated authority for displaying that scope's state. Other surfaces that display the same scope must be consistent with the authoritative surface.

**Authority hierarchy by scope:**

| Scope | Authoritative surface | Consistent surfaces |
|---|---|---|
| Individual screen | Screen Introspection panel | Venue dashboard, NOC drill-down |
| Venue | Venue Operations workspace | NOC fleet view, Executive overview |
| Fleet | NOC Network Operations workspace | Executive overview, fleet health map |
| Historical (any scope) | PRE replay engine output | Incident timeline, audit log |
| Proposed action | PRE preview evaluation | Preview panel in any workspace |

When an operator is uncertain which surface to trust, the hierarchy above determines the answer. This hierarchy must be communicated in the interface itself — not just in documentation.

### 5.2 Stale-State Indicators

Stale state must be indicated at three levels:

**Level 1 — Component staleness:** A single data element within a surface has not been refreshed within expected interval. Indicated with a subtle freshness indicator on that element (e.g., "schedule data: 45s old").

**Level 2 — Surface staleness:** The entire surface has lost synchronization. STALE state activated for the surface (see Section 2, State Type 4).

**Level 3 — Workspace staleness:** Multiple surfaces within a workspace are stale. STALE state activated for the workspace, with explicit count of stale surfaces.

### 5.3 Synchronization Confidence

For each data element displayed, the surface must be able to report synchronization confidence on request:

- **CONFIRMED:** This value was received from the authoritative source within the expected update interval
- **RECENT:** This value was received within 2× the expected update interval — still likely accurate
- **AGING:** This value was received more than 2× the expected update interval ago — may be outdated
- **STALE:** This value has not been updated for longer than the staleness threshold — treat as potentially inaccurate

Synchronization confidence need not be permanently visible for all data elements — on-demand disclosure is acceptable. But it must always be accessible.

### 5.4 Delayed-State Disclosure

When displayed state is known to be delayed (e.g., a reporting pipeline that runs on a 5-minute cadence), this must be disclosed:

- The delay must be labeled at the surface level: "Sponsor delivery data: updates every 5 minutes. Last updated: 14:23."
- Actions taken on delayed data must carry a warning: "This decision is based on data that may be up to 5 minutes old."
- Delayed data must never be presented with the same freshness indicators as real-time data

### 5.5 Partial-Data Visibility

When a surface is displaying state for a scope that includes some items with confirmed data and some without:

- Items with missing data must be labeled — not hidden, not omitted, not averaged-over
- The count of items with missing data must be visible: "12 of 15 screens reporting. 3 screens: data unavailable."
- Operations affecting the full scope must account for the partial data: "Apply to all screens? 3 screens are currently not reporting and may not receive this override."

---

## Section 6 — Human Factors

### 6.1 Ambiguity Intolerance

Operators working in high-stakes, time-pressured operational environments have near-zero tolerance for state ambiguity. When the interface is ambiguous about what it is showing, the operator's cognitive response is not to investigate — it is to make an assumption. That assumption is often wrong, and its consequences are not discovered until later.

**Design implication:** Every ambiguity in the UI state model is a latent operational risk. The canonical state types in Section 2 exist specifically to eliminate ambiguity by making every possible rendering state named and governed. A surface that could be in an unnamed state — one not in the canonical eight — is a design failure.

### 6.2 Stale-State Distrust

When operators discover that the state they were viewing was stale — that actions they took were based on outdated information — the trust consequence extends beyond the specific incident. Operators who have experienced stale-state surprises begin to distrust the interface even when it is current. They develop manual verification habits, external checks, and workarounds that indicate the interface has failed its fundamental job.

**Design implication:** Stale state must be detected and disclosed proactively, before the operator acts on it. Late disclosure — "by the way, that data was old" — is nearly as damaging to trust as no disclosure at all. The STALE state type exists specifically to catch this before consequential action.

### 6.3 Hidden Transition Confusion

State transitions that occur without visible acknowledgment disorient operators. An operator who was viewing replay and is suddenly viewing live state — without a visible transition — does not know where they are. An operator whose preview silently expired and reverted to live is not aware that their previewed action was not committed.

**Design implication:** Every transition must be visible. The transition visibility requirements in Section 3.3 are not aesthetic choices — they are the mechanism by which operators maintain a coherent model of where they are in the interface at all times.

### 6.4 Authority Ambiguity Stress

Operators under stress who cannot determine which surface is authoritative — which panel to trust when two panels disagree — experience a specific form of operational paralysis. They spend cognitive resources trying to resolve the authority question rather than taking operational action. In high-stakes scenarios, this delay has consequences.

**Design implication:** The authority hierarchy in Section 5.1 must be communicated in the interface, not only in documentation. When two surfaces display contradictory state (DIVERGENT state type), the interface must immediately surface the authority hierarchy so the operator knows which surface to trust and can act on it. The DIVERGENT state type is defined precisely to eliminate this paralysis.

---

## Conformance Requirements

Every frontend surface in ClubHub TV must conform to this document before shipping. Conformance requires:

1. **State labeling:** Every surface must display its current state type (Section 2) at all times
2. **Transition visibility:** Every state transition must be visible and attributed (Section 3.3)
3. **Consistency:** Cross-panel, cross-workspace, and mobile/desktop consistency rules must be enforced (Section 4)
4. **Authority legibility:** Every surface must make its authority source accessible within two interactions (Section 5)
5. **No unnamed states:** Every possible rendering state of the surface must map to one of the eight canonical state types

Non-conforming surfaces are not eligible for production deployment.

---

## Related Documents

**INTERACTION-SEQUENCING-SPEC-v1.md** — Defines the legal ordering of operator actions across state types. The canonical state model defines what states exist; the sequencing spec defines what operators can do in each state and in what order.

**LIVE-UPDATE-BEHAVIOR-SPEC-v1.md** — Defines how state transitions are rendered to operators. The canonical state model defines what the transitions are; the live-update spec defines how they are visually communicated without destroying cognition.

**OPERATIONAL-NAVIGATION-GOVERNANCE-v1.md** — Defines how operators move between states and workspaces while preserving operational context. Navigation is state management made spatial.

**PREVIEW-SYSTEMS-SPEC-v1.md** — The authoritative specification for the PREVIEW state type. CANONICAL-UI-STATE-MODEL governs the behavioral rules; PREVIEW-SYSTEMS-SPEC governs the PRE integration and confidence modeling.

**SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md** — The cross-surface coherence rules that make the state consistency requirements in Section 4 enforceable across organizational boundaries.

---

*End of CANONICAL-UI-STATE-MODEL.md v1.0*
*Authority: Agent 3 (UX Architecture). PRE state API surface: Agent 1 co-authority.*
*State synchronization contracts: Agent 2 co-authority.*
*No frontend implementation may proceed without conforming to this model.*
*Changes to canonical state types or transition rules require cross-agent review.*
