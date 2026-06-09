# ClubHub TV — Component Constitution
# Shared Operational Intelligence Layer — Phase C: Component Constitution

**Document type:** Rendering constitution — governance for all operator-facing components
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 1 (PRE state API); Agent 2 (data contracts)
**Last updated:** 2026-05-25
**Status:** CANONICAL — components not conforming to this constitution are not eligible for deployment
**Phase:** C — Component Constitution (operational semantic rendering governance)

---

## Purpose

This document is the constitutional governance layer for every operator-facing component in ClubHub TV. It defines what components are for, what they are responsible for, what they may never do, and how they fail.

The threat this document addresses: **frontend entropy through component proliferation.** As a platform grows, components multiply. Each new component is designed with good intentions for its specific use case. Over time, the set of components drifts — different components represent the same operational concept differently, similar interactions behave differently in different surfaces, the same data looks authoritative in one component and uncertain in another. No individual component is wrong. The aggregate is incoherent.

This is not a design system problem. Design systems govern visual consistency. The Component Constitution governs **semantic consistency** — whether components preserve or distort the operational truth they are rendering.

**The governing principle: components are operational instruments, not UI primitives.** A button is not a "button" — it is a commitment instrument. A timeline is not a "data visualization" — it is an operational record surface. A health grade badge is not a "status indicator" — it is a trust surface that communicates the platform's confidence in a venue's operational integrity. Every component is responsible for the operational meaning it communicates.

---

## Section 1 — Component Philosophy

### 1.1 Components as Operational Instruments

Every component in ClubHub TV serves an operational purpose. That purpose must be defined before the component is designed, and the design must serve the purpose — not the other way around.

The operational purpose of a component specifies:
- What operational truth it renders
- What operator understanding it creates or reinforces
- What operational decision it informs or enables
- What would happen if it rendered its truth incorrectly

A component whose operational purpose cannot be stated is not ready for design. A component whose design conflicts with its stated purpose is a constitutional violation.

### 1.2 Truth-Preserving Rendering

Components do not interpret operational state — they render it. The distinction is critical:

**Interpreting:** "This override has been active for a long time, so we'll show it as a mature override with less visual prominence." (The component is making a judgment about what the operator should notice.)

**Rendering:** "This override has been active for 14 hours and 23 minutes. Its age is rendered with the override-aging visual treatment defined in the intervention component specification." (The component renders the fact; the operator forms the judgment.)

Truth-preserving rendering means:
- The component renders what the data says, not what the designer thought would be useful
- Visual prominence communicates operational significance (state, severity, urgency) — not aesthetic hierarchy
- Components do not hide, smooth, or aggregate operational facts without explicit disclosure and navigation to the underlying facts
- A component that displays a summary must provide access to the constituent facts

### 1.3 Semantic Consistency Over Visual Variation

Visual design may vary — color schemes, layouts, information densities may be adapted for different workspaces, roles, or environments. Semantic meaning must not vary. The override stack component in the Venue Operations workspace and the override stack component in the NOC drill-down workspace may look different. They must mean the same thing.

Semantic consistency rules:
- A canonical term (override, emergency activation, suppression) renders the same concept in every component where it appears
- A canonical state (STALE, DEGRADED, DIVERGENT) renders with equivalent visual treatment across all components
- An action (commit, cancel, escalate) produces equivalent behavioral feedback in all components where it appears
- The same operational fact cannot be rendered as "confirmed" in one component and "estimated" in another without the difference being explicitly disclosed

### 1.4 Explainability Preservation

Every component that renders an operational outcome must preserve the ability to explain that outcome. Components are not the end of the explanation chain — they are a point in it.

Explainability preservation means:
- Every displayed value has an accessible explanation (what it means, how it was computed, what caused it)
- Progressive disclosure allows operators to go deeper: summary → operational explanation → forensic detail → replay
- No component displays a PRE-resolved outcome without providing access to the reason trace
- Components do not abstract operational causality into visual metaphors that cannot be traced back to the actual resolution logic

---

## Section 2 — Component Classes

Eight canonical component classes exist. Every component in the platform belongs to exactly one class. Class membership defines the component's primary constitutional responsibilities.

### Class CC-01: State Surfaces

**Purpose:** Render the current operational state of a scope (screen, venue, fleet segment) — what is happening right now, what state the platform is in, and what the operator should understand about current conditions.

**Examples:** Screen effective-state display, venue health panel, fleet health overview, live state indicator.

**Constitutional responsibilities:**
- Render effective state as primary content — not secondary, not buried in detail views
- Display state type label (LIVE / REPLAY / STALE / etc.) at all times
- Surface degradation when present — no healthy-looking display when degraded
- Make the authoritative data source accessible (what is this state sourced from?)

**Must never:**
- Display an inferred or cached state without labeling it as such
- Render a healthy state when the underlying data is STALE or DEGRADED
- Suppress state type labeling for aesthetic reasons

---

### Class CC-02: Timeline Surfaces

**Purpose:** Render the temporal history of operational events — overrides applied, schedules progressed, emergencies activated, incidents declared, content delivered.

**Examples:** Override timeline, schedule timeline, incident event log, sponsor delivery timeline, screen history.

**Constitutional responsibilities:**
- Represent time accurately — positions on the timeline reflect actual time, not approximated or scaled
- Label every event with timestamp, event type, and attribution (who or what caused it)
- Preserve causality order — events appear in the sequence they occurred, with no reordering for visual reasons
- Provide replay access for any displayed historical moment

**Must never:**
- Reorder events for visual clarity if reordering would create a false impression of causality
- Display approximate timestamps without disclosure
- Represent a gap in the record as a gap in the display without labeling the gap as missing data (vs. nothing happening)

---

### Class CC-03: Intervention Surfaces

**Purpose:** Enable and display operator interventions — override creation, emergency activation, escalation, incident declaration, rollback.

**Examples:** Override creation form, emergency activation control, escalation flow, incident declaration form.

**Constitutional responsibilities:**
- Implement all mandatory sequencing from INTERACTION-SEQUENCING-SPEC.md
- Display PRE-evaluated preview before commit, without exception for mandatory flows
- Show intervention consequence before commitment
- Create immutable audit record of intervention with attribution and timestamp

**Must never:**
- Allow commitment without previewing for any mandatory-preview action
- Suppress conflict warnings to simplify the interaction
- Proceed during STALE state without explicit acknowledgment

---

### Class CC-04: Explanation Surfaces

**Purpose:** Render the reasoning behind operational outcomes — why a screen is playing what it is playing, why an override took precedence, why a sponsor window was not delivered.

**Examples:** Reason trace panel, suppression tree, override resolution display, "why not playing" view.

**Constitutional responsibilities:**
- Trace causality directly to PRE resolution — not to a summary or approximation
- Display the full resolution path, not only the winning result
- Answer Q4 ("why not?") as readily as Q1 ("what is playing?")
- Make every explanation replayable — the replay record must confirm the displayed explanation

**Must never:**
- Display simplified explanations that omit causally significant factors
- Attribute resolution outcomes to factors that did not actually determine them
- Present an explanation that cannot be verified through replay

---

### Class CC-05: Fleet Surfaces

**Purpose:** Render the operational state of multiple venues simultaneously — enabling fleet-level cognition without losing the ability to drill to venue or screen detail.

**Examples:** Fleet health grid, venue count by health grade, fleet entropy map, multi-venue incident view.

**Constitutional responsibilities:**
- Preserve drill-down access to every aggregated item — no fleet surface is a dead-end
- Surface the worst condition visible in the aggregate — a fleet-level "all healthy" that conceals one DEGRADED venue is a constitutional violation
- Display the count and basis of aggregation: "47 venues: 41 healthy, 4 advisory, 2 degraded"
- Make the aggregation logic accessible (how is fleet health computed?)

**Must never:**
- Present a fleet-level health summary that hides operationally significant individual exceptions
- Use aggregation to smooth degraded conditions into a healthier-looking summary
- Hide the count of items excluded from the current filter

---

### Class CC-06: Sponsorship Surfaces

**Purpose:** Render sponsorship delivery state — contracted vs. configured vs. delivered SOV, forward projection, compliance status.

**Examples:** SOV three-number display, sponsor delivery timeline, campaign compliance indicator, proof-of-play log.

**Constitutional responsibilities:**
- Display three numbers always: contracted, configured, delivered (per SPONSORSHIP-OPERATIONS-UX-v1.md)
- Show forward projection alongside current delivery
- Surface compliance risks before they become compliance failures
- Make the delivery log underlying any summary accessible

**Must never:**
- Display only one or two of the three SOV numbers — the combination communicates what no individual number does
- Smooth forward projections to appear more optimistic than the data supports
- Hide a compliance gap because the gap is still within acceptable range

---

### Class CC-07: Replay Surfaces

**Purpose:** Render deterministic historical operational state — PRE-resolved outputs at specific past moments, timeline navigation, counterfactual comparison.

**Examples:** Replay scrubber, temporal context header, replay timeline, counterfactual overlay, historical effective state panel.

**Constitutional responsibilities:**
- Call actual PRE for replay evaluation — no approximation, no log-reconstruction
- Maintain temporal context visibility at all times (what moment is being viewed)
- Implement replay-mode visual distinction requirements from LIVE-UPDATE-BEHAVIOR-SPEC.md
- Surface the replay record's reliability (is the corpus complete for this period?)

**Must never:**
- Display approximated or reconstructed historical state when the actual replay record is available
- Render live updates within a replay surface without explicit labeling
- Allow replay actions to affect live operational state

---

### Class CC-08: Escalation Surfaces

**Purpose:** Surface operational signals that require operator awareness and may require action — across all severity tiers from ambient advisory to incident-critical.

**Examples:** Signal tier indicator, escalation banner, incident notification, fleet anomaly callout, advisory acknowledgment surface.

**Constitutional responsibilities:**
- Implement signal tier treatment consistently (Tier 0–5 per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md)
- Escalation surfaces do not auto-dismiss for Tier 3 and above without acknowledgment
- Escalation events are navigable — tapping the escalation surfaces navigates to the relevant scope and detail
- Escalation surfaces include attribution (what caused this escalation?)

**Must never:**
- Display a Tier 4 or 5 escalation as dismissible without operator acknowledgment
- Use escalation visual treatment for Tier 0–2 signals — over-escalation degrades the signal tier system's credibility
- Hide escalation count when multiple simultaneous escalations exist

---

## Section 3 — Component Invariants

These invariants apply to every component regardless of class. They are non-negotiable. A component that violates any invariant is constitutionally non-compliant regardless of any other design quality.

### Invariant CI-01: No Hidden State Mutation

A component must not mutate operational state without the operator's explicit, informed action. Components render state. They do not change it except as the direct result of an operator interaction with a confirmation step.

**What this prohibits:**
- Auto-correcting displayed state to match an expected value
- Normalizing incoming data before display without disclosure
- Silently refreshing state in the background and displaying the refreshed value without a synchronization event
- Adapting the display of state based on usage patterns ("you usually don't look at this, so we'll hide it")

### Invariant CI-02: No Replay Ambiguity

A component that can display either live or historical state must make the distinction unambiguous at all times. Ambiguity between live and historical state is one of the most dangerous conditions in the operational interface.

**What this requires:**
- The state type label (LIVE / REPLAY) is always visible when the component is capable of both modes
- The rendering treatment for REPLAY mode is structurally distinct from LIVE mode, not just differently labeled
- A component cannot transition between LIVE and REPLAY modes without a visible, operator-acknowledgeable transition

### Invariant CI-03: No Unlabeled Authority Change

When the authority for a displayed value changes — when the source of truth changes from one data source to another, when an override expires and authority returns to the schedule, when a degraded sensor is replaced by an estimated value — this must be labeled.

**What this requires:**
- Authority source is accessible for every displayed value
- Changes in authority source are surfaced as notable events
- Estimated or inferred values are labeled as such and cannot be visually equivalent to confirmed values

### Invariant CI-04: No Silent Synchronization Assumptions

A component must not assume that its displayed data is current without verifiable evidence that it is. Components must actively know whether their data is fresh, aging, or stale — and must display accordingly.

**What this requires:**
- Every component has a defined data freshness model: what data source does it consume, what is the expected update interval, what is the staleness threshold
- When data is beyond the aging threshold, the component renders in AGING state
- When data is beyond the staleness threshold, the component renders in STALE state
- Components do not render the same visual treatment for confirmed-current data as for aging data

### Invariant CI-05: No Causality Abstraction Loss

A component that summarizes operational causality must not lose the causal chain in the summarization. Every abstraction must remain traceable to the underlying causal facts.

**What this requires:**
- Summary displays provide drill-down to the constituent causal facts
- Aggregate metrics preserve access to the individual items that produced the aggregate
- A component cannot display "override resolved" without the operator being able to reach "override X at LEVEL_1 resolved because it had higher specificity than override Y at LEVEL_1 at scope venue vs. screen"

---

## Section 4 — Component Authority Rules

### 4.1 Authoritative Data Boundaries

Each component has defined data boundaries — the specific data it is authorized to display and the source that data must come from. A component must not consume data from an unauthorized source even if the data appears equivalent.

**Data boundary specification for every component must include:**
- Primary data source (which API endpoint, which PRE evaluation, which delivery log)
- Update mechanism (polling interval, push subscription, event-driven)
- Freshness guarantee (what latency is acceptable from state change to display update)
- Fallback behavior (what is displayed when the primary source is unavailable)

### 4.2 Stale-State Rendering

When a component's data has exceeded its freshness threshold, it must render in a stale-state treatment that is visually distinct from its fresh-state treatment. The stale treatment must be proportional to the staleness duration:

| Staleness duration | Visual treatment |
|---|---|
| Within expected update interval | Normal rendering |
| 1–2× expected update interval | Subtle aging indicator (e.g., reduced opacity timestamp) |
| 2–4× expected update interval | AGING state label visible |
| >4× expected update interval | STALE state — full stale treatment per CANONICAL-UI-STATE-MODEL.md |

**Stale treatment must not be defeatable.** A component in STALE state cannot be configured to display as fresh. The operator may not dismiss the stale indicator. Only actual data refresh can clear the stale treatment.

### 4.3 Degraded-State Visibility

When a component's data source is in DEGRADED state — partial, estimated, or reduced-confidence — this must be reflected in the component's rendering:

- A DEGRADED badge or indicator is displayed
- Values derived from degraded data are marked with a confidence qualifier
- Operations that require confirmed data are disabled with explanation
- The specific degradation is named (not "partial data" but "3 screens not reporting")

### 4.4 Partial-Data Honesty

When a component displays aggregated data where some items have full data and some do not:

- The count of items with full data and items with partial/missing data is displayed
- Missing items are represented as missing — not as zeros, not as averages, not as omitted
- Operations affecting all items must disclose that some items have missing data

### 4.5 Synchronization Disclosure

Components must disclose their synchronization state. Operators must be able to determine, for any displayed value: when was this last confirmed as current?

The synchronization disclosure model:
- **Active disclosure:** The component's timestamp or "last updated" indicator is accessible within one interaction
- **Passive disclosure:** When the data is current, no indicator needed; when aging or stale, the disclosure becomes prominent
- **Forced disclosure:** When an operator is about to take action based on the component's data, the synchronization state is disclosed in the action confirmation, not just in the component itself

---

## Section 5 — Component Failure Modes

### Failure Mode CF-01: Semantic Drift

**What it is:** A component's displayed meaning gradually diverges from its intended operational meaning. The "override stack" component begins to show only "active" overrides, omitting recently-expired ones — reducing operational context without disclosure. The "health grade" component begins to weight recent events more heavily than the algorithm specifies — producing grades that feel more current but are algorithmically inconsistent.

**Why it happens:** Small, individually reasonable implementation decisions that optimize for local usability without maintaining the operational semantic contract. "We only show active overrides because expired ones clutter the view" is a reasonable-sounding decision that constitutes a semantic violation.

**Prevention:** Component semantic specifications are formal documents, not design notes. Changes to what a component displays or how it computes its display are changes to the semantic specification and require the same review as changes to any other canonical document.

---

### Failure Mode CF-02: Abstraction Corruption

**What it is:** A component abstracts operational detail to the point where the abstraction no longer accurately represents the underlying state. A fleet health indicator that shows "healthy" for a fleet where 3 of 47 venues are DEGRADED has been abstracted past the point of operational honesty. An override stack that shows "5 overrides" without surfacing that one of them is a LEVEL_0 emergency has lost operationally critical detail in the count.

**Why it happens:** Design pressure to simplify — "operators don't need to see every detail, give them a summary." The summary is correct as far as it goes, but it omits the facts that would change the operator's understanding.

**Prevention:** Abstractions always surface the worst condition they contain. A "healthy" summary that contains a DEGRADED item is not permitted. A count that contains a critical item must surface the critical item separately from the count.

---

### Failure Mode CF-03: Replay Inconsistency

**What it is:** A component displays different state in replay context than it would display for the same moment in live context. An operator who investigates a past event in replay sees the event summarized differently than the operator who witnessed it live. The replay investigation is inconsistent with the live experience — producing different operational conclusions for the same operational event.

**Why it happens:** Separate code paths for live and replay rendering, diverging over time. Replay is treated as a special case rather than as the same rendering logic applied to historical inputs.

**Prevention:** Live and replay rendering use the same component, the same rendering logic, applied to different (current vs. historical) PRE outputs. There is not a "replay version" and a "live version" of the timeline component — there is one timeline component that renders PRE output, whether that output is from the live PRE or from the replay PRE.

---

### Failure Mode CF-04: Visual Contradiction

**What it is:** Two components on the same surface display contradictory information for the same operational fact. The health badge for Venue 14 shows grade B; the alert count for Venue 14 shows 3 unresolved Tier 3 conditions. These are not necessarily contradictory — a grade B venue can have Tier 3 conditions — but if the operator's expectation is that a grade B venue has no Tier 3 conditions, the visual contradiction creates uncertainty.

**Why it happens:** Components designed independently, without a shared understanding of how their outputs relate to each other. The health grade computation and the alert tier system are defined separately, and their relationship is not explicitly rendered.

**Prevention:** When components on the same surface display related values, their relationship must be explicit — either they are clearly derived from the same calculation, or their independence is clearly disclosed.

---

### Failure Mode CF-05: Operator Misprediction

**What it is:** A component's visual design creates a prediction in the operator's mind that is incorrect. The operator looks at the component, forms a mental model of the operational state, and acts on that model — only to discover that the component meant something different from what they inferred.

This is the ultimate failure mode because it is silent. The component rendered something. The operator saw it. The operator's interpretation was wrong. The component did not fail in an observable way — it failed in a cognitive way that only became visible when the operator's action produced unexpected results.

**Why it happens:** Visual design that optimizes for aesthetics or conventional UI patterns without considering what operational inference the design invites. A component that looks like a status indicator communicates "the system is OK" even when what it actually means is "I have not received any data in 5 minutes."

**Prevention:** For every component, before design begins: "What will an operator infer from looking at this?" The answer must match what the component actually means. Where they diverge, the design must be changed — not the documentation.

---

## Section 6 — Human Factors

### 6.1 Component Trust Formation

Operators build trust in components the same way they build trust in any system: through repeated prediction confirmed by observation. An operator who looks at the health grade badge, infers that the venue is healthy, navigates to the venue and confirms it is healthy — has a trust-confirming experience with the health grade badge. Each confirmation builds trust. The operator learns to rely on the component.

The risk: if the health grade badge is occasionally wrong — if it shows healthy when the venue is in early-stage DEGRADED, because the algorithm lags behind the actual state — the operator eventually discovers the discrepancy. The trust damage from a single disconfirmed prediction is disproportionate to a single data point. The operator now doubts every health grade they have ever seen.

**Design implication:** Component accuracy is not just an engineering goal — it is a trust maintenance goal. Components must be accurate within their stated confidence bounds. When they cannot be accurate (STALE, DEGRADED), they must visibly reduce their confidence, not maintain a confident appearance with outdated data.

### 6.2 Repeated Inconsistency Damage

Inconsistency across components — where the same operational concept is rendered differently in different places — creates a form of trust damage that is difficult to recover from. An operator who has seen "override" rendered as a blue badge in the venue dashboard and a red indicator in the NOC view eventually stops forming reliable associations with visual treatments. Every surface must be re-learned from scratch. Cross-surface operational coordination becomes unreliable.

**Design implication:** Semantic consistency (Section 1.3) is not a design preference — it is a trust architecture requirement. The investment in semantic consistency is an investment in cross-surface operational coordination.

### 6.3 Hidden Ambiguity Stress

When a component's meaning is slightly ambiguous — when the operator is not quite sure what it means, or when it could mean two slightly different things — this creates low-level cognitive stress that accumulates over time. The operator is always spending a small fraction of their attention on resolving the ambiguity. In calm conditions this is manageable. Under operational pressure, it becomes a disproportionate cognitive burden.

**Design implication:** Ambiguous components are not "good enough" — they are chronic cognitive tax. Every component whose meaning an experienced operator cannot state precisely is a component that needs redesign.

### 6.4 Visual Authority Assumptions

Operators make visual authority assumptions automatically: the larger element is more authoritative; the element in the primary position is more important; the brighter element is more urgent. These are heuristics, and they are mostly correct — but when a component's visual design creates authority assumptions that do not match operational reality, the assumptions produce errors.

An override that is displayed small and in a secondary position will be treated by operators as low-authority — even if it is a LEVEL_0 emergency override. A venue health grade that is displayed prominently and in bold will be treated as highly authoritative — even if the grade is STALE.

**Design implication:** Visual hierarchy must be calibrated to operational authority. What is most operationally significant must be most visually prominent. What is least certain must be least visually authoritative. Visual design that creates incorrect authority assumptions is a constitutional violation.

---

## Conformance Requirements

Every component must conform to this constitution before deployment. Conformance requires:

1. **Class declaration** — The component's class (CC-01 through CC-08) is documented
2. **Operational purpose statement** — What operational truth this component renders
3. **Invariant compliance** — All five invariants are explicitly addressed in the component specification
4. **Authority rules compliance** — Data boundaries, stale/degraded/partial rendering are defined
5. **Failure mode review** — Each of the five failure modes has been explicitly considered and mitigated
6. **Semantic specification** — What the component means, precisely, is documented and governed

---

## Related Documents

**OPERATIONAL-COMPONENT-SEMANTICS-v1.md** — The semantic definitions for canonical operational UI primitives. The Component Constitution defines the governance; this document defines what the specific components mean.

**TEMPORAL-AND-REPLAY-COMPONENTS-v1.md** — The specialized governance for time-aware rendering. Class CC-02 and CC-07 components are governed in detail there.

**EXPLAINABILITY-RENDERING-SYSTEM-v1.md** — The governance for explanation rendering. Class CC-04 components are governed in detail there.

**CANONICAL-UI-STATE-MODEL.md** — The state types that components must render and label (Phase A). State badge rendering (Section 2, OPERATIONAL-COMPONENT-SEMANTICS) implements this model.

**INTERACTION-SEQUENCING-SPEC.md** — Class CC-03 (intervention surfaces) implements the interaction flows defined there.

**SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md** — The cross-surface coherence rules that make semantic consistency (Section 1.3 of this document) enforceable across organizational and team boundaries.

---

*End of COMPONENT-CONSTITUTION-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*PRE data API surface for component consumption: Agent 1 co-authority.*
*Data contracts and component backend services: Agent 2 co-authority.*
*Changes to component classes, invariants, or authority rules require cross-agent review.*
*All frontend contributors are governed by this constitution without exception.*
