# ClubHub TV — Operational Component Semantics
# Shared Operational Intelligence Layer — Phase C: Component Constitution

**Document type:** Rendering governance — semantic definitions for operational UI primitives
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; design contributors; Agent 2 (domain language)
**Last updated:** 2026-05-25
**Status:** CANONICAL — semantic definitions in this document govern all operational UI primitives
**Phase:** C — Component Constitution (operational semantic rendering governance)

---

## Purpose

This document defines the precise semantic meaning and behavioral specification of the canonical operational UI primitives in ClubHub TV — the building blocks from which all operational surfaces are assembled.

The threat this document addresses: **semantic proliferation.** Without a canonical set of defined primitives, each surface designer creates their own representations of the same operational concepts. Override stacks look different in five places. Health grades are displayed with five different visual treatments. State badges have different meanings in different contexts. The platform's visual language becomes a dialect — operators who have mastered one surface must re-learn the concepts in the next.

**The governing principle: one concept, one primitive, one semantic.** Every operational concept has a single canonical primitive. That primitive has a single defined meaning. It is rendered consistently — with permitted contextual variations that do not alter the semantic — across every surface in the platform.

---

## Section 1 — State Badges

State badges communicate the operational state type of any surface, panel, or scope. They implement the canonical state types defined in CANONICAL-UI-STATE-MODEL.md.

### Badge SB-01: LIVE

**Semantic:** This surface is displaying the current PRE-resolved operational state, synchronized within the expected update interval.

**Canonical label:** LIVE
**Visual treatment:** Persistent indicator; green accent (or equivalent operational-first color palette designation); no animation in stable LIVE state

**Behavioral rules:**
- Always visible when the surface is capable of multiple state types
- Does not require operator acknowledgment
- Disappears or changes when state transitions away from LIVE

**What it guarantees:** The operator can trust that what they see reflects current operational reality within the platform's stated synchronization latency.

**What it does not guarantee:** Absolute real-time accuracy. LIVE means synchronized within the expected update interval — not instantaneous. The expected update interval must be documented for each surface that carries a LIVE badge.

---

### Badge SB-02: REPLAY

**Semantic:** This surface is displaying a deterministic reconstruction of a specific past operational moment. No actions taken here affect live state.

**Canonical label:** REPLAY — [timestamp] (e.g., "REPLAY — 14:23:07")
**Visual treatment:** Persistent, high-visibility banner; distinct color treatment (not the LIVE color); the timestamp is part of the badge — "REPLAY" alone is insufficient

**Behavioral rules:**
- Structurally persistent — cannot be collapsed, minimized, or dismissed while in replay mode
- The timestamp updates as the operator scrubs the timeline
- All action affordances that would affect live state carry a "not available in replay" indicator

**What it guarantees:** The operator is viewing deterministic PRE output for the labeled historical moment. The state is exactly what the PRE resolved at that moment.

---

### Badge SB-03: STALE

**Semantic:** This surface's data has exceeded the staleness threshold. What is displayed may not reflect current operational reality.

**Canonical label:** STALE — [staleness duration] (e.g., "STALE — 4m 30s")
**Visual treatment:** High-prominence indicator; visually distinct from LIVE and REPLAY; the staleness duration updates continuously

**Behavioral rules:**
- Triggers at the staleness threshold (default: 4× expected update interval)
- Not dismissible — only data refresh can clear STALE state
- Action controls that require current data are disabled while STALE, with: "Actions unavailable — view not synchronized. Last synchronized: [timestamp]."
- Reconnection status is displayed alongside the STALE badge: "Reconnecting..." or "Reconnection failed — [reason]"

**What it communicates:** The operator should not make operational decisions based on this surface's data until synchronization is restored.

---

### Badge SB-04: DEGRADED

**Semantic:** This surface is displaying real-time data, but from a partial or reduced-confidence source. Some components of the operational state are missing or estimated.

**Canonical label:** DEGRADED — [specific degradation description] (e.g., "DEGRADED — 3 screens unreachable")
**Visual treatment:** Distinct from STALE (degraded means partial real-time data; stale means all data may be old); moderate prominence — visible but not as alarming as STALE

**Behavioral rules:**
- The specific degradation must be named — generic "DEGRADED" without a description is non-conforming
- Components displaying values derived from degraded data carry a degradation qualifier
- Operations affecting degraded components carry an explicit warning

---

### Badge SB-05: SYNCHRONIZED

**Semantic:** This surface has just completed synchronization — recovered from STALE or completed an explicit refresh. Displayed transiently.

**Canonical label:** SYNCHRONIZED — [timestamp] (e.g., "Synchronized at 14:23:07")
**Visual treatment:** Transitional — visible for 3–5 seconds or until dismissed; should visually communicate "good news" (recovery); transitions to LIVE badge after acknowledgment period

**Behavioral rules:**
- Displayed after every STALE recovery
- Displayed after every explicit manual refresh
- Displays count of changed values if any: "Synchronized. 3 values updated."
- Auto-transitions to LIVE badge after acknowledgment period

---

### Badge SB-06: DIVERGENT

**Semantic:** This surface is displaying state that contradicts another authoritative surface for the same operational scope. A cross-surface coherence failure has been detected.

**Canonical label:** DIVERGENT — [conflict description] (e.g., "DIVERGENT — conflicts with NOC view")
**Visual treatment:** High-prominence warning; distinct color treatment; includes navigation to the conflicting surface

**Behavioral rules:**
- Action controls are disabled until divergence is acknowledged
- The conflicting surfaces are identified and linked
- The authoritative surface is identified (per authority hierarchy in CANONICAL-UI-STATE-MODEL.md Section 5.1)
- Divergence is logged for investigation

**This badge should be rare.** Its appearance indicates a platform-level defect.

---

### Badge SB-07: SIMULATED / PREVIEW

**Semantic:** This surface is displaying the PRE-evaluated result of a proposed action — a simulated future state. Nothing has been committed.

**Canonical label:** PREVIEW — [proposed action summary] (e.g., "PREVIEW — override at screen scope")
**Visual treatment:** Persistent indicator; visually distinct from LIVE; diff highlighting shows what would change relative to current live state

**Behavioral rules:**
- All displayed values reflect the hypothetical post-action state, not current state
- Diff is mandatory: what changes (highlighted) and what stays the same (normal rendering)
- Preview may be invalidated by live state changes: "Live state changed — preview may be outdated. Regenerate?"
- Commit and cancel controls are prominent and unambiguous

---

### Badge SB-08: PENDING

**Semantic:** An operator action has been initiated and is being applied. The live state and the intended state may temporarily differ.

**Canonical label:** APPLYING — [action description] (e.g., "Applying: override to Screen: Bar Left")
**Visual treatment:** Active indicator; the action being applied is described; elapsed time is displayed

**Behavioral rules:**
- Conflicting actions are blocked while PENDING
- Timeout after defined period (typically 10 seconds) produces explicit error
- Success clears PENDING and briefly shows SYNCHRONIZED
- Failure clears PENDING and shows an error with recovery path

---

## Section 2 — Timeline Primitives

Timeline primitives are the building blocks of operational record surfaces (Class CC-02 in COMPONENT-CONSTITUTION-v1.md).

### Timeline Primitive TP-01: Interruption Marker

**Semantic:** A moment in time where normal operational flow was interrupted — by an override, an emergency activation, an incident declaration, or a system event.

**Visual treatment:** A vertical marker on the timeline at the exact interruption moment; labeled with interruption type and attribution

**Behavioral rules:**
- Position is precise — the marker represents the exact second of interruption
- Label is accessible on hover/tap: interruption type, operator attribution, timestamp, duration (if complete) or "ongoing"
- Tapping the marker navigates to replay at that exact moment
- Interruption markers are never clustered or merged for visual simplicity — if two interruptions occurred simultaneously, both markers are visible

---

### Timeline Primitive TP-02: Override Interval

**Semantic:** A period during which an override was active — from application timestamp to expiry or cancellation timestamp.

**Visual treatment:** A horizontal bar spanning the override's active period; visually distinct by override level (LEVEL_0 through LEVEL_5 have distinct visual treatments); labeled with override type, scope, and applying operator

**Behavioral rules:**
- The bar's width represents actual duration — proportional to time
- The bar's vertical position reflects the override's level in the resolution hierarchy (LEVEL_0 overrides appear at the highest position)
- Overlapping overrides at different levels are stacked, with visual separation
- Active (not yet expired) overrides extend to the current time with an open terminus
- Tapping the bar reveals override detail and navigation to the applying operator's action in the audit log

---

### Timeline Primitive TP-03: Sponsor Exposure Overlay

**Semantic:** A period during which sponsored content was scheduled for delivery and the actual delivery record for that period.

**Visual treatment:** A band spanning the scheduled sponsor window; within the band, actual delivery periods are shaded (delivered), and gaps are visually distinct (not delivered); SOV fraction is labeled on the band

**Behavioral rules:**
- Scheduled vs. delivered is always shown — the overlay cannot display only the scheduled window without the delivery record
- Delivery gaps are labeled if they exceed a threshold: "Gap: 4m 15s"
- Override intervals that suppress sponsor delivery are linked to the corresponding TP-02 Override Interval on the same timeline

---

### Timeline Primitive TP-04: Divergence Annotation

**Semantic:** A moment or period where the operational state diverged from expected — override accumulation exceeding threshold, device delivering unexpected content, replay verification failure.

**Visual treatment:** A callout annotation on the timeline; distinct from interruption markers (which mark deliberate interventions — divergence annotations mark unexpected conditions); includes divergence type and severity

**Behavioral rules:**
- Divergence annotations are linked to the specific event that created them (the delivery log entry, the replay verification result)
- Severity is labeled: minor divergence (informational) vs. significant divergence (requires investigation)
- Tapping navigates to replay at the divergence moment with the relevant explanation surface pre-loaded

---

### Timeline Primitive TP-05: Replay Boundary

**Semantic:** The boundary of the available replay record — the earliest available moment and the most recent available moment. Used to communicate corpus completeness to the operator.

**Visual treatment:** Visual boundaries at the start and end of the available replay record; labeled with timestamps; gaps in the corpus are shown as distinctly-styled gaps in the timeline (not as periods where nothing happened)

**Behavioral rules:**
- Gaps in the replay corpus are explicitly marked: "Replay unavailable: [period]. Cause: [reason if known]"
- The operator cannot navigate the scrubber into a gap without a disclosure: "Replay data is unavailable for this period."
- The boundary of the available corpus is labeled with the corpus hash for verification

---

### Timeline Primitive TP-06: Causality Indicator

**Semantic:** A visual link between two timeline events that have a causal relationship — the sponsor gap that was caused by the emergency override; the content playing at time T that was determined by the schedule block applied at T-2h.

**Visual treatment:** An arrow or connecting line between two TP-01/TP-02/TP-03 elements; labeled with the causal relationship

**Behavioral rules:**
- Causality indicators are derived from PRE resolution — they represent actual resolution-path relationships, not inferred or visual associations
- The causal link is accessible as text: "Emergency override [ID] suppressed sponsor delivery [ID] from 14:23 to 14:47"
- Causality indicators do not imply human intent — they indicate PRE resolution relationships

---

## Section 3 — Intervention Surfaces

Intervention surfaces implement the interaction flows defined in INTERACTION-SEQUENCING-SPEC.md.

### Intervention Surface IS-01: Override Stack

**Semantic:** The current ordered set of all active overrides for a scope — ordered by resolution priority, with the effective winner identified.

**Visual treatment:** A stacked list ordered by priority; the effective winner is visually distinguished; each item shows level, scope, content, applying operator, application time, and expiry

**Required information per override:**
- Override level (LEVEL_0 through LEVEL_5 — canonical level label, not a simplified equivalent)
- Content being applied
- Scope (screen / venue / fleet segment)
- Applying operator and timestamp
- Expiry time (explicit timestamp, not "in 2 hours")
- Age indicator (how long this override has been active — per override-aging design in INTERVENTION-AND-OVERRIDE-UX-v1.md)

**Behavioral rules:**
- Empty override stack is explicitly labeled: "No active overrides for this scope" — not rendered as absent
- Expired overrides that affected recent delivery are accessible via "Show recent expired" (not shown by default, but not hidden permanently)
- The resolution winner is labeled: "Effective: [override ID] — wins over [lower-priority overrides]"
- Adding, modifying, or removing overrides initiates Flow IF-01 from INTERACTION-SEQUENCING-SPEC.md

---

### Intervention Surface IS-02: Emergency Banner

**Semantic:** An emergency activation is active on this scope. This is LEVEL_0 priority content. All other content is suppressed.

**Visual treatment:** Full-width, high-prominence banner; cannot be collapsed or minimized while active; distinct emergency visual treatment across all surfaces

**Required information:**
- "EMERGENCY ACTIVE" label
- Content being displayed
- Scope of emergency
- Activating operator and timestamp
- Duration active
- Deactivation path: explicitly visible at all times while active

**Behavioral rules:**
- Emergency banner is displayed on every surface that shows the affected scope — not only in the emergency workspace
- Deactivation requires Flow IF-02 (abbreviated version) from INTERACTION-SEQUENCING-SPEC.md
- Emergency banner includes a direct link to the emergency activation audit record

---

### Intervention Surface IS-03: Escalation Indicator

**Semantic:** A condition has been escalated — either to a higher severity level within an incident, or to a different operator for response.

**Visual treatment:** Tier-appropriate treatment per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md; includes source condition, escalation path, and current ownership

**Required information:**
- What is being escalated (condition description)
- Escalation tier (Tier 3–5)
- Current owner (who is responsible for response)
- Time since escalation
- Expected response time (if defined by severity protocol)

---

### Intervention Surface IS-04: Intervention Ownership Marker

**Semantic:** A specific operator has declared ownership of this intervention or incident — they are the accountable party for response and resolution.

**Visual treatment:** Attribution label with operator name; visual distinction between "owner" and "contributor" operators active on the same scope

**Behavioral rules:**
- Ownership transfer requires explicit accept/reject per CROSS-ROLE-COLLABORATION-UX-v1.md escalation ownership transfer protocol
- Unowned escalations are labeled: "Unowned — escalation requires response"
- Ownership markers persist in the audit record after the intervention is resolved

---

### Intervention Surface IS-05: Expiration Visibility

**Semantic:** A time-limited operational intervention is aging toward its expiry. The operator should be aware of the approaching expiry.

**Visual treatment:** A continuous aging indicator on time-limited overrides; distinct visual treatment at threshold approaching (e.g., final 20% of override duration); explicit expiry timestamp always visible

**Behavioral rules:**
- Expiry countdown is visible at all times on time-limited interventions — not only when expiry is near
- The threshold for "approaching expiry" warning is configurable but defaults to: when less than 20% of original duration remains, or less than 30 minutes, whichever is larger
- Expiry events generate a U-02 (attention-worthy) update per LIVE-UPDATE-BEHAVIOR-SPEC.md
- Expired overrides are logged in the operational timeline as expired (not silently removed)

---

## Section 4 — Operational Status Surfaces

### Status Surface OS-01: Fleet Health

**Semantic:** The aggregate operational health of a group of venues, computed from the entropy model.

**Display format:** Grade letter (A–F) plus underlying metric summary; count breakdown (N venues at each grade)

**Required information:**
- The grade: A through F
- The underlying metric count summary: at minimum, the count of venues at each grade level
- Worst-condition callout: the worst single condition in the fleet must be surfaced, not hidden in the aggregate
- Data freshness: when was this grade last computed?

**Behavioral rules:**
- A grade cannot be "A" if any venue in the fleet is in DEGRADED or worse state — worst condition sets the floor for aggregate display, or the worst condition is surfaced as an exception alongside the grade
- Grade is computed per the documented entropy algorithm — no visual adjustment to make grades appear better
- Tapping the grade navigates to the grade breakdown and from there to specific venues

---

### Status Surface OS-02: Venue Health

**Semantic:** The operational health of a single venue, computed from the entropy model — the current grade plus the contributing factors.

**Display format:** Grade letter (A–F) plus contributing metric list; health grade trend (improving / stable / declining)

**Required information:**
- Current grade: A through F
- Contributing metrics: at minimum, the top 3 entropy contributors visible without drill-down
- Grade trend: direction of change over recent history
- Active conditions: count of active overrides, active escalations, unreachable devices

**Behavioral rules:**
- Grade reflects actual computed entropy — no rounding in the favorable direction
- Contributing metrics explain the grade — the operator can see why the grade is what it is
- Advisory-only: the grade surface does not suggest specific remediation actions (per ENTROPY-OBSERVABILITY-UX-v1.md advisory-only philosophy)

---

### Status Surface OS-03: Entropy Indicators

**Semantic:** A specific entropy metric has exceeded its advisory threshold. This is an observation, not an alarm.

**Display format:** Metric name, current value, threshold, and advisory language — "Override accumulation is elevated: 7 active overrides (advisory threshold: 5)"

**Behavioral rules:**
- Entropy indicators are advisory only — they do not require acknowledgment, they do not block actions
- Entropy indicator language is neutral: elevated, accumulating, diverging — not alarming, not urgent
- Multiple entropy indicators are displayed in aggregate when present: "3 entropy advisories active"
- Tapping navigates to the entropy observability view

---

### Status Surface OS-04: Synchronization Confidence

**Semantic:** How confident the platform is that this surface's data reflects the current authoritative operational state.

**Display format:** Confidence level (CONFIRMED / RECENT / AGING / STALE) and the last-confirmed timestamp

**Behavioral rules:**
- This surface is always accessible within one interaction from any status surface
- The confidence level is computed per Section 5.3 of CANONICAL-UI-STATE-MODEL.md
- Surfaces displaying AGING or STALE confidence carry the corresponding state badge

---

### Status Surface OS-05: Incident Severity

**Semantic:** An incident is active. This surface communicates its severity, scope, and ownership.

**Display format:** Severity level (L1–L4), scope summary, incident owner, time since declaration, current operational status of affected scope

**Required information per active incident:**
- Severity level with canonical label (L1: Advisory, L2: Operational, L3: Significant, L4: Critical)
- Affected scope (N screens / N venues / fleet segment)
- Incident owner
- Declaration timestamp and elapsed time
- Current operational state of affected scope (is the condition improving, stable, or worsening?)

---

## Section 5 — Component Consistency Rules

### 5.1 Semantic Parity Across All Surfaces

Every operational primitive defined in this document must be rendered identically across all surfaces where it appears. "Identically" means: same semantic meaning, same label, same behavioral rules, same data source requirements. Visual treatment may vary within the defined permitted variations for each primitive — but the meaning must be identical.

**Enforcement mechanism:** Before a surface ships, all primitives it uses are audited against this document. Any surface-local variant of a canonical primitive that differs in semantic from the canonical definition must be resolved — either the surface variant is corrected, or the canonical definition is updated through the formal governance process.

### 5.2 Mobile / Desktop Parity

Every canonical primitive has a mobile rendering that is semantically equivalent to its desktop rendering. Mobile may reduce information density — showing 2 items from a list instead of 5, showing a summary grade instead of the full metric breakdown — but the semantic meaning of what it shows must be identical to the desktop rendering.

**Mobile parity test:** An operator who reads a component's output on mobile and the same component's output on desktop (for the same operational scope at the same time) must reach the same operational conclusion. If they could reach different conclusions, the mobile rendering does not meet parity.

### 5.3 Replay / Live Parity

The canonical primitives render identically in live and replay contexts — because they are rendering PRE output, and live and replay PRE output are semantically identical. The only differences permitted between live and replay rendering are:

- The REPLAY state badge (SB-02) is displayed instead of the LIVE badge (SB-01)
- Action affordances that would affect live state are disabled
- Timeline navigation controls are visible in replay mode

All other rendering — the override stack, the health grade, the sponsor exposure overlay — is identical in live and replay.

### 5.4 Dashboard / Replay Parity

The operational dashboard and the replay investigation surface use the same primitives. An operator who sees a Tier 3 escalation indicator in the dashboard and then investigates the same moment in replay will see the same Tier 3 indicator at that historical moment. The dashboard did not suppress it; the replay did not amplify it. Same event, same rendering, different temporal context.

---

## Section 6 — Human Factors

### 6.1 Semantic Memory Formation

Operators who work with the platform regularly form semantic memories — they learn what each visual pattern means without consciously thinking about it. An override stack looks like an override stack; a health grade badge triggers an immediate "healthy / at risk / critical" categorization; a STALE badge triggers "I need to wait."

These semantic memories are among the most valuable things in an experienced operator's toolkit. They reduce cognitive load, enable fast pattern recognition, and free attention for the aspects of the operational state that require active reasoning.

**Design implication:** Semantic memory formation requires consistency over time. A component that changes its visual treatment — even for good design reasons — breaks the semantic memories of experienced operators who have to relearn the association. Visual treatment changes for canonical primitives require explicit migration support: displaying both old and new treatments simultaneously during a transition period, not a silent overnight change.

### 6.2 Cross-Surface Consistency Trust

When operators encounter a familiar primitive in a new surface — the override stack in a surface they haven't used before — their default assumption is that it means the same thing as in the surfaces they know. This assumption supports rapid onboarding to new surfaces.

If the assumption is sometimes wrong — if the override stack in the NOC view omits LEVEL_5 overrides, while the venue view shows all levels — the trust in cross-surface consistency degrades. Operators must now explicitly re-verify what every primitive means in every new surface they encounter. The cognitive cost of this re-verification eliminates the cross-surface onboarding benefit.

### 6.3 Operator Recognition Speed

Recognition speed — how quickly an operator can determine the operational significance of a surface — is directly correlated with semantic consistency. An operator who has learned the canonical primitives can scan an unfamiliar surface and extract its operational meaning in seconds. An operator who must re-learn the visual language of each surface works more slowly and makes more errors.

**Design implication:** Recognition speed is an operational efficiency metric. The consistent use of canonical primitives across all surfaces is the primary driver of recognition speed. Introducing novel visual patterns for operational concepts that already have canonical representations decreases recognition speed — even when the novel pattern is aesthetically superior.

### 6.4 Alert Meaning Permanence

Alert treatments — the visual pattern associated with an escalation, emergency, or critical condition — must be permanent. An operator who has learned that "red banner across the top of the screen" means emergency activation must encounter that treatment every time an emergency is active, without exception. If the same visual treatment is later used for something else — a promotional campaign, a software update notification — the alert meaning has been corrupted. The operator's learned association between the visual pattern and the operational urgency is broken.

**Design implication:** Escalation visual treatments are reserved exclusively for escalation contexts. They may not be repurposed for any non-escalation purpose. This is an irreversible design decision — once an escalation visual treatment is established, it cannot be changed without explicit cross-surface migration support.

---

## Related Documents

**COMPONENT-CONSTITUTION-v1.md** — The governing constitution for all components. This document defines specific semantics; the constitution defines the governance principles.

**TEMPORAL-AND-REPLAY-COMPONENTS-v1.md** — Detailed governance for timeline primitives (TP-01 through TP-06) and replay surfaces. This document defines their semantics; the temporal document defines their behavioral governance.

**EXPLAINABILITY-RENDERING-SYSTEM-v1.md** — Detailed governance for explanation surfaces and reason trace rendering.

**CANONICAL-UI-STATE-MODEL.md** — The state types that state badges (SB-01 through SB-08) implement. The semantic definitions here are derived from the canonical state model.

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — The signal tier system that escalation indicators (IS-03) and fleet/venue health surfaces (OS-01, OS-02) implement.

**ENTROPY-OBSERVABILITY-UX-v1.md** — The entropy model that venue health (OS-02) and entropy indicators (OS-03) surface.

---

*End of OPERATIONAL-COMPONENT-SEMANTICS-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*Domain Language Glossary alignment (when created): Agent 2 co-authority on term definitions.*
*Primitive visual treatment specifications (color palette, typography): to be defined in Component Phase C follow-on.*
*Changes to canonical primitive semantics require cross-agent review and formal governance process.*
