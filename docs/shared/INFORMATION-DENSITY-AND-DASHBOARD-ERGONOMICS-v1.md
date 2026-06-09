# ClubHub TV — Information Density and Dashboard Ergonomics
# Shared Operational Intelligence Layer

**Document type:** UX governance — information architecture and density management
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** UX contributors, frontend engineers, product owners proposing new dashboard surfaces
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all dashboard and information display design

---

## Purpose

This document defines how operational information remains readable as the platform matures, data accumulates, and teams request increasingly comprehensive visibility surfaces. It governs the principles, patterns, and failure modes of operational information presentation.

The threat this document addresses: metric sprawl. Every team with operational stake in the platform will eventually request their own visibility into its state. Each request is individually reasonable. The aggregate produces a dashboard that looks like a data warehouse visualization — everything present, nothing readable, operators unable to extract operational meaning faster than they could by looking out the window.

**The governing principle: operational cognition over metric abundance.** A dashboard that answers the operator's three most critical questions in five seconds is more operationally valuable than a dashboard that answers forty questions in ninety seconds.

---

## Section 1 — Information Density Philosophy

### 1.1 Readability Over Completeness

Completeness is not an operational virtue. A complete representation of system state — every metric, every condition, every trend — is not readable. It is a data dump. Data dumps do not support operational cognition. They require operators to perform data analysis before they can reach operational awareness.

The goal of operational information presentation is not to show everything. It is to enable the operator to answer: "Is the operation running correctly, and if not, what requires my attention?" in the minimum cognitive effort possible.

**Design test:** Can an operator determine the current operational health of a venue by looking at the primary display for 5 seconds without zooming, scrolling, or navigating? If no, the display has failed the readability test regardless of how complete its data is.

### 1.2 Operational Cognition Over Metric Abundance

Metrics measure specific observable quantities. Operational cognition is the ability to understand what is happening and why. These are not the same thing.

A display showing:
- 97.3% delivery confidence
- 14.2 average override age (days)
- SOV: 23.1% contracted / 22.8% configured / 22.4% delivered
- Entropy grade: A
- 3 active overrides / 0 expiring today

...requires the operator to synthesize these metrics into operational understanding. A display that additionally shows:

"Currently: Sports highlights running. Next: Sponsor package in 4 min. No active advisories."

...has already done the synthesis.

**Design principle:** Synthesized operational understanding is primary. Supporting metrics are secondary. Metrics should be accessible but should not occupy primary display space that synthesized understanding could occupy.

### 1.3 Effective-State-First Hierarchy

Every operational display should answer the most fundamental question first: "What is actually playing right now, and is it what should be playing?"

The answer to this question is the effective state — the output of the PRE for the current moment, presented in human-readable form. Effective state should be the most visually prominent element on any primary operational display.

**Effective-state hierarchy:**
1. What is playing now (content identification, campaign name if applicable)
2. Why it's playing (level, rule type — 1–2 words)
3. What's playing next (next state, when)
4. Any operational condition affecting this (advisory indicator if present)

Everything else is secondary and should be visually subordinate to this hierarchy.

### 1.4 Anti-Dashboard-Bloat Principles

**The addition principle:** Every new metric or display element added to a primary dashboard reduces the visibility of existing elements. There is no free addition. Every addition is also a subtraction.

**The decision principle:** If adding a metric to the primary dashboard would not change any operator decision within the next hour, it belongs in a secondary view, not the primary dashboard.

**The stale-data principle:** A metric that displays data that is more than N time-units old without a staleness indicator is providing false confidence. Stale metrics should be visually distinguished from current metrics, or removed.

**The action principle:** Metrics that have no associated available action should not be on the primary dashboard. If the operator can do nothing about a metric's value, the metric belongs in a trend/reporting view, not a live operational surface.

---

## Section 2 — Information Layers

### Layer 1 — Ambient Operational Awareness

**Purpose:** The operator, at a glance, knows whether the operation is healthy or has conditions requiring attention.

**Contents:**
- Effective state for each active screen or screen group
- Operational health summary (healthy / advisory / degraded / incident)
- Active Tier 3+ signal count
- Time to next significant operational event (next interruption, schedule transition, override expiry)

**Density target:** Comprehensible in 3–5 seconds without zooming or drilling.

**Appropriate contexts:** Operator check-in, background awareness, shift start, periodic operational monitoring during non-critical periods.

**Density ceiling:** If adding any element to Layer 1 would push average comprehension time above 8 seconds, the element belongs in Layer 2.

---

### Layer 2 — Focused Operational Diagnosis

**Purpose:** The operator understands why a condition exists and what the available responses are.

**Contents:**
- Layer 1 content plus:
- Active signal detail (description, duration, affected scope, available actions)
- Current resolution trace summary (which rule is winning, why)
- Override stack state (how many, age, scope)
- Upcoming operational events with preview links
- Entropy grade detail (which metrics are contributing)

**Density target:** Complete operational picture accessible within 30 seconds of navigating to the relevant view.

**Appropriate contexts:** Responding to an advisory, investigating an unexpected condition, pre-event preparation.

---

### Layer 3 — Deep Forensic Analysis

**Purpose:** The operator can trace the exact causal chain from a condition or outcome back to its origin.

**Contents:**
- Full resolution trace (complete reason trace from PRE output)
- Override archaeology (provenance chain for each active override)
- Delivery log access for disputed playback periods
- Cross-venue comparison for systemic analysis
- Entropy metric history with causal annotations
- Replay reconstruction for any time window

**Density target:** Complete causal understanding achievable within 10 minutes for any operational question.

**Appropriate contexts:** Incident postmortem, sponsor audit, dispute resolution, training scenario analysis.

**Warning:** Layer 3 surfaces are not operational displays. They are forensic tools. They should not be designed to be comprehended at a glance — they are designed for deep, focused investigation. The failure mode is presenting Layer 3 data in a Layer 1 display and expecting operators to process it during live operations.

---

### Layer 4 — Executive Abstraction

**Purpose:** Leadership and non-operational stakeholders can understand operational health without operational expertise.

**Contents:**
- Venue health grades (A–F) across the fleet
- Sponsor fulfillment status (contracted vs delivered SOV, percentage)
- Fleet operational stability trend (30/60/90 day)
- Active incidents with business impact summary
- Override volume trend (proxy for operational entropy)

**Density target:** Business-level operational understanding in 60 seconds.

**Warning:** Executive abstraction must never hide operationally significant conditions. The failure mode is an executive layer so smoothed that an ongoing partial sponsor delivery failure shows as "mostly healthy." Abstraction must preserve meaningful business signal while reducing operational granularity.

---

### Layer 5 — Replay Investigation Density

**Purpose:** The operator is performing a specific historical investigation — a point-in-time reconstruction, a divergence analysis, a sponsor proof-of-play.

**Contents:**
- Full timeline rendering for the investigation period
- Overlaid operational events (overrides applied, schedules active, delivery records)
- Reason trace reconstruction at any investigated moment
- Divergence annotations (moments where delivered differed from predicted)
- Supporting documentation links (override notes, incident records)

**Density target:** Complete investigative dataset accessible in a structured, navigable format.

**This layer exists only for investigation.** It should never be visible during live operations as it would create Layer 3-in-Layer-1 confusion.

---

## Section 3 — Density Escalation Rules

### 3.1 Progressive Disclosure

Progressive disclosure is the design principle that information should be revealed in proportion to the depth of the operator's engagement. An operator doing a routine check should see Layer 1. An operator investigating a condition should move to Layer 2. An operator conducting a postmortem should move to Layer 3.

**Escalation triggers:**
- Selecting a signal, advisory, or operational element navigates to the relevant Layer 2 view for that element
- Selecting "investigate" or "trace" within Layer 2 navigates to the relevant Layer 3 view
- Layer 3 access is always explicit and intentional — the operator must actively request it

**Progressive disclosure is not "hiding information."** The information is accessible at one additional navigation step. Information that is operationally necessary during normal operations should not require a navigation step to access.

### 3.2 Drill-Down Thresholds

When should a Layer 1 element have drill-down access to Layer 2 or Layer 3?

**Always has drill-down:**
- Any active Tier 3+ signal (drill-down to signal detail and available actions)
- Current effective state (drill-down to resolution trace)
- Active override stack (drill-down to each override's provenance and scope)
- Entropy grade (drill-down to metric breakdown)

**Has drill-down only when non-normal:**
- SOV delivery status (drill-down only when divergence is detected)
- Screen health (drill-down only when anomaly detected)
- Delivery confidence (drill-down only when below threshold)

**No drill-down for routine healthy state indicators** — an operator should not be navigating into Layer 2 to confirm that a healthy indicator is healthy.

### 3.3 Contextual Detail Expansion

When an operator is working in a focused context — investigating an incident, reviewing a sponsorship delivery, preparing for an event — the relevant workspace should surface additional detail automatically for that context.

**Context detection:**
- Operator navigates to a venue's incident view: that venue's full override stack, delivery log, and divergence history expand automatically
- Operator navigates to sponsorship operations: SOV detail, exposure timeline, and fulfillment projections expand automatically
- Operator navigates to an override's detail view: that override's scope impact and entropy contribution expand automatically

Contextual expansion is reversible — returning to the main workspace collapses the expanded detail back to Layer 1 density.

### 3.4 Entropy-Aware Density Increase

When the platform's entropy grade for a venue decreases (A→B, B→C, etc.), the relevant workspace should automatically display slightly more diagnostic detail to help the operator understand and address the entropy sources. This is not an automatic Layer 2 escalation — it is a modest density increase that provides more context without a full drill-down.

**Entropy-driven density adjustments:**
- Grade A→B: Entropy advisory panel becomes visible (previously collapsed)
- Grade B→C: Override stack expanded by default (previously requires tap to expand)
- Grade C→D: Entropy metric breakdown visible in primary workspace
- Grade D→F: Full Layer 2 diagnostics in primary workspace — the venue is in operational distress

---

## Section 4 — Visual Priority Hierarchy

### 4.1 Effective Playback Prominence

What is playing now — the effective state — is always the visually dominant element. It should be:
- The largest text element on the screen
- In the highest-contrast color scheme
- Positioned in the primary visual field (upper-left to center for Western reading patterns)
- Always current — if the effective state data is stale, an explicit staleness indicator must accompany it

**Override all other hierarchy rules for effective playback.** Even during an active incident, the operator should be able to verify what is actually playing with a glance.

### 4.2 Operational Instability Prominence

When the operation is in an unstable state (divergence detected, override storm, schedule gap, or delivery failure), the instability indicator should be the second-most prominent element — clearly visible alongside, not below, the effective state.

Instability indicators should show:
- What type of instability (override collision, delivery gap, divergence)
- Scope (screen, venue, or fleet)
- Severity (Tier indicator)
- Time onset (how long has this been active)

### 4.3 Sponsor Risk Prominence

When a contracted sponsor's delivery is at risk (SOV falling below floor, campaign expiring without delivery completion, override suppressing sponsor content), this risk should surface prominently in the sponsorship section of the workspace.

**Sponsor risk is business-critical.** It is distinct from entropy — entropy is operational quality, sponsor risk is contractual obligation. Sponsor risk signals should be visually distinct from entropy advisories to prevent confusion.

### 4.4 Override Debt Prominence

When the override stack for a venue carries a significant debt load (many aging overrides, entropy contribution above threshold, or orphaned overrides), the debt indicator should be visible in the venue's primary view.

**Override debt representation:**
- A stack icon with a count badge showing total active overrides
- A color indicator: green (0–3, recent), amber (4–8 or any >30 days), red (9+ or any >90 days)
- Expanding the indicator shows the override stack in age order

Override debt should not dominate the primary display — it is a secondary health indicator, not a primary operational status. It should be visible at a glance but not occupy primary display space.

### 4.5 Causality Prominence

When an operator is viewing a non-normal state (unexpected content, advisory active, instability detected), the causality explanation should be immediately adjacent to the state display — not a click away.

**Causality adjacency rule:** Any displayed state that could prompt the operator to ask "why?" should have the answer visibly adjacent. If the effective state is unexpected, the reason it is playing should be on the same screen, same view, same layer.

This is the operational implementation of the explainability principle: causality should not require navigation.

---

## Section 5 — Dashboard Failure Modes

### Failure Mode F-DD-01: Metric Wallpaper

**What it is:** A dashboard covered in metrics that are all displayed with equal visual weight. No hierarchy. No prioritization. No synthesis. The operator must scan the entire surface to find what matters.

**Why it happens:** Teams request visibility into metrics without visibility design governance. Each metric addition seems modest. Accumulated metrics create wallpaper.

**Detection signal:** Operators stop using the primary dashboard and instead rely on specific sub-views or verbal updates from colleagues because "the main screen is too busy to read quickly."

**Prevention:** Every metric on the primary dashboard must pass the decision test (Section 1.4) and the action test (Section 1.4). New metric additions require design review against the visual priority hierarchy.

---

### Failure Mode F-DD-02: Simultaneous Urgency Collapse

**What it is:** Multiple elements displaying with the same urgency treatment simultaneously, making it impossible to determine what is most important. Red everywhere. Everything is "critical."

**Why it happens:** Each urgent condition is legitimately important. The design doesn't have a mechanism for relative prioritization when multiple urgent conditions coexist.

**Detection signal:** During incident response, operators report difficulty knowing where to focus. Post-incident reviews note that critical information was present but not actionable due to signal overload.

**Prevention:** Visual urgency must be relative, not absolute. When multiple Tier 4 signals coexist, they must be rank-ordered by severity and recency. Only one element can be the "most critical" — the display hierarchy must make this unambiguous.

---

### Failure Mode F-DD-03: Visualization Fetishism

**What it is:** Complex visualizations (heatmaps, 3D graphs, animated flows) that look impressive but do not communicate operational state faster than a simple text-and-icon representation would.

**Why it happens:** Dashboard design trends, stakeholder desire for impressive-looking tooling, and the assumption that more visual complexity indicates more analytical power.

**Detection signal:** Operators cannot explain what a visualization shows when asked. Operators screenshot the visualization for presentations but reference simple views during actual operations.

**Prevention:** Every visualization must answer: "Does this help an operator make a faster or better decision than the equivalent text representation?" If the answer is no, the visualization is for presentations, not operations, and should exist only in the executive/reporting layer.

---

### Failure Mode F-DD-04: Over-Compression

**What it is:** Information compressed so aggressively that important distinctions are lost. A single "health" score of 73% that obscures whether the problem is sponsor delivery, override entropy, or device reliability.

**Why it happens:** Desire for simplicity. Reaction against metric wallpaper. Well-intentioned "just give me one number" requests.

**Detection signal:** Operators describe the health score as "useless" or "misleading." Scenarios where the health score shows normal while a significant operational issue is occurring.

**Prevention:** Composite scores must have visible breakdowns of their components accessible within one tap/click. A compressed score is a summary, not a replacement — it must be supplemented by the underlying components.

---

### Failure Mode F-DD-05: Hidden Causality

**What it is:** A display that shows the effect but not the cause. "Content delivery failed" with no adjacent explanation of why, requiring the operator to navigate to a separate view to find the cause.

**Why it happens:** Causality information exists in a different data layer than state information. Dashboard design treats each data layer as a separate panel.

**Detection signal:** Operators routinely open multiple browser tabs or windows simultaneously to cross-reference state with cause. Operators cannot answer "why?" questions about current states without navigating away from the primary dashboard.

**Prevention:** Apply the causality adjacency rule (Section 4.5) universally. If a condition can prompt "why?", the answer must be on the same screen.

---

### Failure Mode F-DD-06: Executive Oversimplification

**What it is:** An executive-layer display that smooths over operationally significant conditions. Venues with ongoing partial failures show as "mostly healthy." Sponsor delivery shortfalls below the reporting threshold are invisible.

**Why it happens:** Executive layers are designed for brevity and positivity. The natural tendency is to hide noise — but some of what gets hidden is signal.

**Detection signal:** Executives receive reports of operational health that contradict what operational staff are dealing with. Incidents exist that are not visible in the executive layer until they become severe.

**Prevention:** The executive layer must have a floor below which abstraction is not permitted. Any condition that would change an executive's operational decision if they knew about it must surface in the executive layer, even if the detail is compressed.

---

## Section 6 — Long-Duration Operations

### 6.1 Fatigue-Resistant Layouts

Long operational shifts expose usability failures that short sessions do not reveal. An operator reviewing a dashboard for the twelfth time in a shift will notice visual elements they stopped registering two hours earlier.

**Fatigue-resistant layout principles:**

*Consistency over novelty.* Layouts that change based on operational state — even with good intentions — create cognitive overhead for fatigued operators. An operator who has learned where to find critical information should always find it there, regardless of operational state. Critical information should not move.

*High contrast at all states.* In long-duration operations, operators may be in suboptimal lighting conditions (dim venues, outdoor events, screen glare). Displays should maintain operationally critical readability in low-contrast conditions.

*Minimal color-only distinctions.* Distinguishing operational states solely by color fails for color-vision-deficient operators and for tired eyes that struggle with subtle color differentiation late in a shift. Shape, position, and text weight must reinforce color-based distinctions.

### 6.2 Scanning Ergonomics

An experienced operator scanning for anomalies in a familiar display is performing a pattern-detection task. Their eyes have learned the normal visual pattern of the display, and they are looking for deviations.

**Scanning ergonomics requirements:**

*Stable visual structure.* Metrics should appear in the same location every time. An element that shifts position in response to state changes breaks the operator's learned visual pattern.

*Anomaly pop.* When a condition deviates from normal, the visual difference between normal and anomalous states should be perceptible peripherally — not only when looking directly at the element. Color, size change, or iconography change can accomplish this.

*Visual density gradient.* The display should be densest at the primary attention zone (upper-left to center) and progressively less dense toward the periphery. Operators scan primary zones first; secondary information should be in secondary zones.

### 6.3 Sustained Observability

Operations that run continuously for hours or days (overnight events, multi-day tournaments, continuous venue operations) require sustained observability — the ability to maintain operational awareness over extended periods without fresh attention investment.

**Sustained observability requirements:**

*Temporal anchoring.* The display should always show the time clearly, with context: "Currently 2:47 AM — 3h 13m remaining until venue opens." Operators on overnight shifts can lose temporal grounding; the display should reinforce it.

*Shift summary accessibility.* At any point, an operator should be able to access a "since my shift started" summary: what happened, what was resolved, what remains active, what's coming.

*State comparison.* "How is this different from an hour ago?" should be answerable without effort. A subtle state comparison indicator (trending up/down/stable) beside key metrics provides this without adding a separate historical view.

### 6.4 Overnight Operational Readability

Overnight operators face specific cognitive challenges: circadian-rhythm cognitive depression (2–4 AM), reduced immediate support availability, and often sole responsibility for a venue or fleet. The platform should be designed to be safely operable by a fatigued overnight operator without increased error risk.

**Overnight readability principles:**

*Larger primary text targets for overnight contexts.* If the platform detects overnight session times, slightly increasing primary text sizes reduces misread risk.

*Simplified primary display during low-activity overnight periods.* An overnight shift monitoring a venue in an expected-quiet period does not need the same information density as a busy event shift. Overnight default to the minimal Layer 1 display.

*Explicit escalation for wake-type events.* During overnight low-activity periods, any Tier 3+ signal should produce a more prominent display response than during daytime operations — the operator's background vigilance level is lower, and the signal must overcome it.

---

*End of INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md v1.0*
*Authority: Agent 3. Metric definitions and thresholds require Agent 2 coordination.*
*Maintained by Agent 3 with Agent 2 review for any changes to Layer definitions.*
