# ClubHub TV — Temporal Cognition and Timeline UX v1
# How Humans Understand Operational Time

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, SCREEN-INTROSPECTION-SYSTEM-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, OPERATIONAL-WORKSPACES-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Temporal UX Philosophy

---

### 1.1 Why Operational Time Matters

A screen is not a static object. It is a temporal object — its effective state changes continuously as rules activate, expire, and transition. The PRE computes a different output at 09:00 than at 18:00, on a Tuesday versus a Saturday, during a tournament week versus a regular week. The system's behavior is inherently temporal.

Most CMS systems are designed for state snapshots: "here is what is configured." ClubHub TV must be designed for state evolution: "here is how operational state has changed, is changing, and will change."

The distinction is not cosmetic. Operators who see only the current snapshot form a mental model of the system as static — a configuration that holds until they change it. When the system's behavior changes due to rule transitions they didn't track, they are surprised. Surprise leads to override creation. Override creation leads to entropy.

Operators who see the temporal evolution of system state understand that behavior changes according to a schedule they can inspect and verify. When a rule expires, they expected it to expire. When a campaign takes over from an override, they watched it coming in the timeline. There is no surprise — therefore no override reflex.

**Temporal visibility eliminates surprise. Eliminated surprise reduces entropy.**

---

### 1.2 Why Snapshots Create Confusion

The cognitive problem with snapshots is that they show a single moment without context. An operator who sees "Screen B1: showing Campaign A" knows the current state but not:
- How long has Campaign A been winning?
- What was winning before Campaign A?
- What will replace Campaign A when it expires?
- Is this the state that was configured, or the result of a surprise transition?

Without temporal context, the operator cannot evaluate whether the current state is expected. They cannot answer "is this right?" without research. They default to assuming it is right — and when it is wrong, they find out by accident rather than by detection.

**Temporal context is the difference between "I know why this is happening" and "I hope this is what was intended."**

---

### 1.3 Why Drift Is Temporal

Operational entropy (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §2.2) is inherently temporal. Override accumulation happens over weeks. Campaign fragmentation develops over months. Emergency semantic collapse requires repeated misuse across multiple incidents.

No entropy metric can be understood from a single snapshot. Every entropy metric is a measure of state over time:
- Override Divergence Rate (M-01): how has override count changed over time?
- Override Age Distribution (M-02): how long have these overrides been accumulating?
- Campaign Orphan Rate (M-04): are campaigns being created faster than old ones are cleaned up?

A CMS that shows only current state cannot surface any of these metrics. Temporal visibility is not an enhancement to entropy observability — it is a precondition for it.

---

### 1.4 Why Operators Need Causality Over Time

When something is wrong, operators need to know what caused it. Causality is a temporal relationship: cause precedes effect. The operator who wants to know "why is this screen showing the wrong content?" needs to see the sequence of events that led to the current state, in chronological order.

This is the operational causality chain (EXPLAINABILITY-UX-SPEC-v1.md §3.5) expressed as a temporal system requirement. The causality chain is not a conceptual tool — it requires a temporal data structure (append-only event log) and a temporal UX surface (timeline with annotated events).

**Causality without timeline is incomplete explanation.** "An override was created" tells the operator what happened. "An override was created 47 days ago by [OPERATOR], after the tournament day when Campaign A wasn't reaching the required screens" tells the operator what happened, why, and what to do about it.

---

## Part 2 — Temporal Stack Model

---

### 2.1 The Seven Temporal Horizons

The ClubHub TV temporal system must support seven distinct temporal horizons, each with different UX requirements and different cognitive needs:

---

**Horizon 1 — Immediate Now (0–15 seconds)**
The current PRE output for each screen. Refreshed on each poll cycle. The most time-sensitive data in the system.

*Cognitive need:* Is the system doing what I expect right now?
*UX requirement:* Accurate within one poll cycle. Confidence indicators for delayed confirmation.
*UX surface:* Live Operations Workspace screen grid.

---

**Horizon 2 — Transitional Now (15 seconds – 2 hours)**
The near-term rule transitions — what will change in the next 2 hours. This is the operator's immediate planning horizon: "what do I need to know before the event starts in 90 minutes?"

*Cognitive need:* What is about to change? Do I need to act?
*UX requirement:* Ordered list of upcoming transitions with time-to-transition, on-screen counts, and rule identities.
*UX surface:* Upcoming transitions strip in Live Operations Workspace.

---

**Horizon 3 — Next-State Visibility (2–8 hours)**
The operational day ahead — what content transitions are scheduled for the rest of the day, where the coverage gaps are, where sponsor content may be suppressed.

*Cognitive need:* Is today's configuration correct? Are there problems I should fix before they happen?
*UX requirement:* Full timeline for today, with gap detection and suppression warnings.
*UX surface:* Screen timeline view (SCREEN-INTROSPECTION-SYSTEM-v1.md §3.1), today view.

---

**Horizon 4 — Near-Future Operational Horizon (2–7 days)**
The upcoming week — the most common planning window for event preparation, campaign scheduling, and override management.

*Cognitive need:* Is the venue correctly configured for upcoming events and the coming week's operations?
*UX requirement:* 7-day venue timeline, campaign coverage, expiry alerts for rules expiring in this window.
*UX surface:* Future Simulation Workspace, default 7-day view.

---

**Horizon 5 — Long-Range Scheduling Horizon (7–90 days)**
The long-range future — campaign planning, sponsor contract period tracking, seasonal content strategy.

*Cognitive need:* Are long-range content commitments correctly set up? Are sponsor contracts being fulfilled over time?
*UX requirement:* 90-day calendar view with campaign coverage, sponsor SOV projection, expiry tracking.
*UX surface:* Future Simulation Workspace, extended view. Sponsorship Operations Workspace SOV forecast.

---

**Horizon 6 — Historical Replay Horizon (0–90 days past)**
The recent past — dispute analysis, sponsor verification, incident postmortem, operational audit.

*Cognitive need:* What was happening at a specific past time? What caused what?
*UX requirement:* PRE deterministic replay for any past time within the preserved state window. Delivery log cross-reference.
*UX surface:* Screen introspection historical reconstruction (SCREEN-INTROSPECTION-SYSTEM-v1.md §5.1). Incident replay (see Incident Operations UX).

---

**Horizon 7 — Divergence History Horizon (rolling 90 days)**
The long-run pattern of how effective state has diverged from configured state, and how entropy has accumulated or been reduced over time.

*Cognitive need:* Is the system getting healthier or less healthy over time? When did drift begin?
*UX requirement:* Entropy trend visualization, divergence event log, operator action attribution.
*UX surface:* Entropy accumulation timeline (§3.5 below). Venue Operations Workspace.

---

### 2.2 Horizon Navigation Controls

Each workspace has a default temporal horizon. Navigation between horizons must be fast and context-preserving:

```
Temporal navigation — [SCREEN_NAME]

  ←────────────────────── PAST ──────── NOW ──── FUTURE ──────────────────────→
  90 days     30 days     7 days     [NOW]    7 days    30 days     90 days

  [Historical] [Replay] [Last week]  [Live]  [Planning] [Campaign] [Long-range]
```

Tapping any segment of the temporal navigation bar jumps the workspace to that horizon. The current position is always highlighted. When not in the "Live" position, the workspace shows a persistent banner:

```
⏸ Viewing historical state — 2026-05-10 at 19:45
   This is not current operational state.   [Return to live]
```

---

## Part 3 — Timeline Systems

---

### 3.1 Playback Timeline

**Definition:** A horizontal time axis showing what content a screen has been playing (past) and is scheduled to play (future), color-coded by resolution level. The primary temporal surface for a single screen.

Full specification: SCREEN-INTROSPECTION-SYSTEM-v1.md §3.1. The following extensions apply in the temporal cognition context:

**Past reconstruction in the playback timeline:**

When viewing historical state, the playback timeline should show both the configured/PRE-computed timeline (what the system was set to deliver) and the delivery-confirmed timeline (what was actually confirmed to devices):

```
Screen: [SCREEN_NAME] — 2026-05-20

Configured:  ████████████████████████████████████████████████████████
Delivered:   ████████████████████████████████░░░░░░██████████████████
                                              ↑
                                         16:00–17:00: Device offline
                                         No delivery confirmation
```

The gap between configured and delivered is visible as a divergence zone. Operators can see exactly when delivery was interrupted and why.

---

### 3.2 Interruption Timeline

**Definition:** A timeline layer showing all rule transitions across a time window — every moment when the winning rule changed for a screen.

Full specification: SCREEN-INTROSPECTION-SYSTEM-v1.md §3.2. Extended for temporal cognition context:

**Interruption density visualization:**

Some screens have many transitions per day; others have very few. The interruption density is itself an operational signal. High interruption density may indicate:
- Legitimate complex scheduling (different content for different time blocks)
- Override and campaign rules alternating, suggesting an underlying resolution conflict
- Many short-duration rules competing, increasing operational complexity

The interruption timeline should display a density indicator — an icon or color variation that signals "this period has high interruption density, which may indicate complexity worth investigating."

---

### 3.3 Override Timeline

**Definition:** A timeline showing all active and historical overrides for a screen or venue, ordered by time of creation and overlaid with their coverage periods.

**Visualization purpose:** The override timeline makes override accumulation visible as a temporal pattern — the operator can see that overrides have been accumulating steadily without cleanup, or that there was a cleanup event that cleared a backlog.

```
Override History — [VENUE_NAME] — Last 90 days

LEVEL_1 Overrides (operational):
  ┌───────────────────────────────────────────────────────────────────┐
  │ Override_001 ████████████████████████████████████████ (91 days)  │
  │ Override_002          ████████████████████████ (67 days)         │
  │ Override_003                   ████████████ (45 days)            │
  │ Override_004                          ██████ (23 days)           │
  │ Override_005                               ██ (8 days)           │
  └───────────────────────────────────────────────────────────────────┘
  ↑ Pattern: No overrides cleaned up in 91 days. Accumulation detected.
```

This pattern view immediately communicates what the individual override list cannot: the override accumulation pattern over time. An operator who sees this visualization understands the operational debt in a way that reading a list of override ages cannot convey.

---

### 3.4 Sponsorship Exposure Timeline

**Definition:** A timeline showing sponsor content delivery across contracted screens over time, overlaid with the actual SOV realized.

Full specification: SCREEN-INTROSPECTION-SYSTEM-v1.md §3.4. Extended for temporal cognition context:

**SOV trend line:** Overlay the realized weekly SOV as a line on the exposure timeline, so the relationship between specific override events and SOV changes is visually direct:

```
[SPONSOR_NAME] — SOV history — Last 90 days

SOV %:
30% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
25% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ contract ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
20% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

Delivered:   ████████████████████████████████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
                                              ↑
                                         Override_004 created
                                         (2026-04-04)
```

The visual relationship between Override_004 creation and the subsequent SOV decline is immediate and causal. The Sponsorship Manager does not need to read a report — they see the cause and effect in the timeline.

---

### 3.5 Entropy Accumulation Timeline

**Definition:** A timeline showing the venue's operational health score over time, annotated with the events that caused health changes (overrides created, overrides cleaned up, campaigns modified, operators leaving).

This is the primary surface for answering: "When did this venue start drifting, and what caused it?"

```
Venue Health — [VENUE_NAME] — 90 days

Grade A ──────────╗
Grade B           ╚══════════════════╗
Grade C                              ╚══════════════╗
Grade D                                             ╚════
                  ↑                  ↑               ↑
              Override_001       Campaign A       Operator_A
              created (no        modified         left; configs
              expiry set)        (scope reduced)  orphaned
              + 3 more that week
```

The annotated timeline makes the governance story legible: health degraded in three distinct steps, each attributable to specific operational events, each recoverable by specific interventions.

---

### 3.6 Venue-State Evolution Timeline

**Definition:** A timeline showing how the entire venue's effective operational state has evolved — not just one screen, but the aggregate operational posture.

**Use case:** A Venue Manager reviewing the last 30 days to understand the trajectory of their venue's health, or a Network Operations operator looking at a venue that has been flagged for declining health.

**Visualization:** A stacked area chart showing the proportion of screen-time at each resolution level over time:

```
Screen-time composition — [VENUE_NAME] — 90 days

100%  ┤
 90%  ┤
 80%  ┤████████████████████████████████████████████████████▄▄▄▄▄▄▄▄
 70%  ┤Campaign 3                                            Campaign
 60%  ┤
 50%  ┤░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 40%  ┤Fallback                         LEVEL_1 Override (increasing)
 30%  ┤
 20%  ┤
 10%  ┤
  0%  └─────────────────────────────────────────────────────────────
     Day 1                        Day 45                      Day 90
```

The trend is readable at a glance: LEVEL_1 override content has been increasing as a proportion of total screen-time, displacing campaign content. This is Override Accumulation Pattern in temporal view.

---

### 3.7 Operational Incident Timeline

**Definition:** A structured timeline for a specific operational incident — showing detection, escalation, intervention, and recovery as a chronological sequence.

Full specification in INCIDENT-OPERATIONS-UX-v1.md §4. Referenced here as a temporal system component.

---

## Part 4 — Timeline Compression

---

### 4.1 Operational Summarization

Long time periods contain many events. The override timeline for 90 days may contain hundreds of events. Showing all events at equal resolution would overwhelm operators.

Timeline compression addresses this: events are summarized into clusters and significant events are highlighted, while routine events are condensed.

**Compression rule hierarchy:**
1. Always show significant events at full resolution (rule transitions affecting content delivery, override creations with SOV impact, entropy threshold crossings)
2. Cluster routine events (multiple overrides created in the same day → "3 overrides created 2026-03-15")
3. Summarize quiet periods (5 days with no events → compressed as a grey bar)
4. Expand any cluster or period on demand

---

### 4.2 Anomaly Highlighting

In a compressed timeline, anomalies must stand out — they should not be buried in the compressed clusters.

**Anomaly highlighting criteria:**
- Any event that caused the health grade to change
- Any override created with no expiry date
- Any SOV drop below contract threshold
- Any emergency activation
- Any delivery confirmation gap longer than 1 hour
- Any configuration event by an operator who has since left

Anomalies are shown with a colored highlight marker on the compressed timeline. Tapping the marker expands the full event detail.

---

### 4.3 Causality Condensation

When multiple events are causally linked (operator creates override → SOV drops → sponsor escalates → Venue Manager reviews override → override removed → SOV recovers), the condensed view should represent this as a causal sequence rather than as four independent events:

```
March 2026 — Sponsor SOV incident

  ● [OPERATOR_A] created Override_004 on B1–B2
    → [SPONSOR_X] SOV fell from 25% to 19%
    → Sponsor escalation: [SPONSOR_X] called to report low delivery
    → [VENUE_MANAGER] reviewed and removed Override_004
    → [SPONSOR_X] SOV recovered to 24%

  Resolved in: 14 days
  Total SOV shortfall: approx. 2.3 days of content
```

This condensed causal story is more informative than four separate event entries, and it surfaces the operational lesson: the 14-day delay between Override_004 creation and its removal caused 2.3 days of SOV shortfall.

---

### 4.4 Significance Weighting

Not all events are equally significant. The timeline weighting system assigns visual prominence based on operational impact:

| Event type | Weight | Visual prominence |
|------------|--------|-----------------|
| Emergency activation / clearance | Very high | Full-width annotation, red |
| SOV contract threshold crossed | High | Prominent marker, amber |
| Override creation without expiry | High | Prominent marker, orange |
| Health grade change | High | Grade transition marker |
| Operator departure (configs orphaned) | High | Personnel event marker |
| Standard override creation | Medium | Normal marker |
| Campaign modification | Low | Small tick |
| Override cleanup / expiry | Low | Small green tick |
| Routine delivery confirmation | Minimal | Not shown in compressed view |

---

### 4.5 Event Clustering

Events that occur close together in time and share operational context are clustered into a single expandable entry:

```
2026-03-15 — 4 events [expand]

  Expanded:
  14:32 — [OPERATOR_A] created Override_004 (LEVEL_1, B1–B2)
  14:35 — [OPERATOR_A] created Override_005 (LEVEL_1, B3)
  15:01 — Campaign A lost on B1, B2, B3 (suppressed by new overrides)
  15:30 — [SPONSOR_X] SOV crossed below contract threshold
```

The cluster label ("4 events") gives the operator a sense of activity density without requiring them to read every event. The expand reveals the causal chain when needed.

---

## Part 5 — Temporal Explainability

---

### 5.1 Why State Changed

The core temporal explainability question: "The screen is showing different content than it was yesterday. Why?"

**Answer surface:** The provenance timeline (EXPLAINABILITY-UX-SPEC-v1.md §3.4) filtered to show only events that caused a state change for this screen.

**Response format:**

```
[SCREEN_NAME] state changed at 12:00 on 2026-05-20

Before:  Campaign A ([CONTENT_A]) via LEVEL_3 Campaign
After:   Override_004 ([CONTENT_B]) via LEVEL_1 Operational Override

Cause:
  Override_004 was created at 11:47 by [OPERATOR_A]
  Scope included Screen B2 (this screen)
  Created with reason: "Tournament day sponsor content"
  Expiry: 2026-05-31

The override began suppressing Campaign A immediately on creation.
```

---

### 5.2 When Drift Began

**The diagnostic question:** "This venue's health has been declining. When did it start, and what started it?"

**Answer surface:** Entropy accumulation timeline (§3.5) with a "when drift began" annotation — the first event that caused the health score to decline from its peak.

```
Venue health began declining on: 2026-02-28

First contributing event:
  [OPERATOR_A] created Override_001 with no expiry date
  This was the first override created without an expiry date at this venue.

Subsequent events that accelerated decline:
  2026-03-05: 3 more overrides created (all without expiry dates)
  2026-03-20: Campaign A scope modified (reducing coverage)
  2026-04-04: Override_004 created, causing SOV shortfall for [SPONSOR_X]
```

The "when drift began" surface is the primary tool for incident postmortem analysis and for the "venue health intervention" workflow that Network Operations performs on declining venues.

---

### 5.3 What Caused Instability

**The pattern question:** "This screen has been unstable — content keeps changing in ways we didn't expect. What is the underlying cause?"

**Answer surface:** The interruption timeline overlaid with the rule creation/modification events that caused each transition.

**Instability patterns and their temporal signatures:**

| Pattern | Temporal signature | Underlying cause |
|---------|-------------------|-----------------|
| Override cascade | Multiple overrides created in rapid succession, each at higher scope | Escalating operator response to a problem that wasn't diagnosed |
| Campaign/override churn | Campaign wins, then override created, then campaign modified, then another override | Operator conflict or misunderstanding of resolution hierarchy |
| Expiry storm | Many rules expiring simultaneously, causing rapid state changes | Rules created together without staggered expiry |
| Orphan activation | Rule that had been dormant suddenly activates (another higher rule expired) | Orphaned rule that was never cleaned up suddenly becomes visible |

---

### 5.4 What Intervention Altered Outcomes

For any period where an operator took action, the timeline must show the relationship between the intervention and the outcome:

```
Intervention analysis — Override_004 removed 2026-06-01

Before removal:
  B1, B2 showing [CONTENT_B] via Override_004 (LEVEL_1)
  [SPONSOR_X] SOV at 19% (contract: 25%)

After removal (within one poll cycle):
  B1, B2 returned to Campaign A ([CONTENT_A]) via LEVEL_3
  [SPONSOR_X] SOV projected to recover to 24% within 7 days

Outcome confirmed (7 days later):
  [SPONSOR_X] SOV: 24.2% ✓ (within contract threshold)
```

This intervention analysis is the operational learning loop — it shows operators that their intervention worked, what it restored, and confirms the outcome. It turns interventions into learning events rather than just operational actions.

---

### 5.5 Counterfactual Timelines

**The simulation question:** "If that override had been cleaned up 30 days ago instead of today, how much sponsor exposure would have been preserved?"

Counterfactual timelines apply the PRE's deterministic replay to a hypothetical configuration — what would have happened if a specific event had occurred differently.

**UX surface:**

```
Counterfactual analysis: Override_004 removed 30 days earlier

  Actual timeline:
  2026-04-04 to 2026-06-01 (58 days): Override_004 active
  [SPONSOR_X] SOV shortfall during this period: ~87 hours below contract

  Counterfactual: Override removed 2026-05-01 (28 days earlier)
  [SPONSOR_X] SOV shortfall reduced by: ~42 hours
  Health grade during counterfactual period: C → B (29 days earlier)

  Learning: Earlier override cleanup would have prevented approximately
  half of the sponsor SOV shortfall and maintained B-grade health.
```

This is not a blame tool — it is an operational learning tool. The counterfactual is surfaced in the context of operational education and improvement, not accountability enforcement.

---

## Part 6 — Human Factors

---

### 6.1 Why Humans Misremember Operational History

Human memory of operational events is reconstructive, not archival. When an operator recalls why a screen was showing unexpected content three weeks ago, they construct a narrative that fits their current understanding — which may not match the actual sequence of events. This is not dishonesty; it is how human memory works.

**Operational consequences:** Misremembered history produces incorrect root cause attribution. "I think [OPERATOR_A] changed something that week" may be wrong — but if there is no authoritative timeline, the misremembered explanation becomes the institutional narrative.

**The timeline system is the authoritative operational memory.** When it exists, operator recollection is not the primary evidence. The timeline shows what actually happened, in the order it actually happened, attributed to the operators who actually did it.

---

### 6.2 Why Recency Bias Creates False Narratives

Recency bias causes operators to over-attribute current problems to recent events — to look for the "last change" and blame it, even when the root cause predates that change by weeks.

**Example:** Screen B1 started showing wrong content this morning. The operator looks for the most recent change — they find that Campaign B was modified yesterday. They conclude Campaign B modification caused the problem. In fact, Override_001 (created 45 days ago) has been the controlling rule all along; Campaign B's modification was irrelevant to the effective state.

**The timeline's role:** A timeline that shows the full history of which rule was winning at each point in time prevents this recency attribution error. The operator can see that Override_001 has been winning since its creation, and that Campaign B's modification had no effect on effective state.

---

### 6.3 Why Replay Reduces Blame Folklore

When operational problems occur without authoritative explanation, blame folklore develops — informal narratives that attribute problems to specific operators or actions based on incomplete information.

Blame folklore is toxic to operational culture. It reduces willingness to report problems, increases defensive override creation ("I'm protecting myself against someone else's configuration"), and erodes trust between operators at the same venue.

Replay eliminates the information gap that blame folklore fills. When any operator can reconstruct exactly what happened, in what order, and why, the narrative is determined by evidence rather than by whoever tells the story most confidently.

**Design commitment:** The timeline and replay systems are constructed as neutral operational records — they attribute events to operators factually, without judgment language. "Override_001 was created by [OPERATOR_A] on [DATE]" is a factual record. It is not presented as accusatory. The operational narrative is facts + causality, not facts + judgment.

---

## Part 7 — Vertical Differences

---

### 7.1 Event-Driven Timelines (Golf Clubs, Sports Bars, Licensed Clubs)

Event-driven venues have operational time defined by events: tournaments, match days, club functions. The timeline must be navigable by event, not just by date:

```
Timeline navigation — [GOLF_CLUB_NAME]

  By date: ← May 2026 →
  By event: ← Tournament: May Open  |  Club Function: 18th May  |  →
```

Event-based navigation allows operators to jump to "what was the configuration for the May Open" without knowing the specific dates. Events are defined in the system (or imported from venue calendar integrations) and serve as named anchors in the timeline.

**Characteristic temporal pattern for event-driven venues:**
- Long quiet periods with stable campaign-driven content
- Short high-intensity event windows with many overrides and manual interventions
- Post-event cleanup periods where event overrides should be removed

The timeline visualization should reflect this pattern — quiet periods shown compressed; event windows shown at full resolution.

---

### 7.2 Ambient Venue Timelines (Hotels, Resorts)

Ambient venues have slow, gradual operational evolution — content changes are planned weeks in advance and executed through campaigns, not live interventions. The characteristic pattern is smooth, predictable, with infrequent transitions.

**Temporal focus:** Long-range scheduling horizon (Horizon 5) is the most important for ambient venue operators. They need to see the next 30–60 days to verify that content is scheduled correctly for seasonal campaigns, promotional periods, and partnership obligations.

**Anomaly detection:** In an ambient venue timeline, any sudden change (override creation, emergency activation, rapid transition) is immediately visible as an anomaly against the smooth background. The timeline's signal-to-noise ratio is naturally high.

---

### 7.3 Hospitality Pacing (Restaurants, Bars)

Hospitality venues have daily rhythmic patterns — content transitions between morning service, lunch, evening, late night. The timeline repeats a similar pattern each day, with the 7-day view showing the weekly rhythm:

```
Weekly timeline — [RESTAURANT_NAME]

           Mon    Tue    Wed    Thu    Fri    Sat    Sun
Breakfast  ████   ████   ████   ████   ████   ████   ████
Lunch      ████   ████   ████   ████   ████   ████   ████
Happy Hour ░░░░   ░░░░   ░░░░   ░░░░   ████   ████   ░░░░  ← Fri/Sat only
Evening    ████   ████   ████   ████   ████   ████   ████
```

The rhythmic pattern is visually clear. Deviations from the pattern (a missing happy hour campaign on Friday, a coverage gap in the Saturday evening slot) are immediately visible.

---

### 7.4 Sports Interruption Rhythms (Sports Bars)

Sports bars experience frequent content interruptions during live broadcast periods — screens switch to live broadcast input, removing ClubHub from the delivery chain. The delivery log shows gaps during these periods; the timeline should reflect them:

```
[SCREEN_B1] — Match Night — 2026-05-20

Configured:  ████████████████████████████████████████████████████████
Delivered:   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
             ↑         ↑                                        ↑
           18:00    18:30                                     22:30
           Pre-match  Match starts                            Post-match
                      (HDMI switch —                          resumes
                      expected non-delivery)
```

The expected-non-delivery periods (HDMI switch to live broadcast) must be distinguishable from unexpected non-delivery (device offline, network failure). If the screen has the `shares_display_input` flag (per ENVIRONMENTAL-CONTEXTS.md §5.1), expected gaps are marked differently from unexpected gaps.

---

### 7.5 Tournament Operational Progression

Tournament venues (golf clubs primarily) have a single, complex operational event that spans a day or multiple days with distinct phases:

```
Tournament Timeline — [GOLF_CLUB] — Championship Day

Phase 1: Pre-tournament (07:00–09:00)
  Sponsor content, course information, draw display
  Override: Tournament_Welcome active

Phase 2: Active play (09:00–17:00)
  Leaderboard live data feed, sponsor rotation, hole-by-hole
  Override: Tournament_Leaderboard active (suppresses standard campaigns)

Phase 3: Final holes (17:00–18:30)
  Leaderboard focus, viewer engagement, sponsor prominence
  Override: Tournament_Final active (expanded scope — all screens)

Phase 4: Ceremony (18:30–20:00)
  Presentation content, sponsor recognition
  Override: Ceremony_Content active

Phase 5: Post-tournament (20:00+)
  Return to standard operations
  Tournament overrides should expire / be cleared

⚠ Tournament overrides not cleared by 22:00 will generate cleanup alerts
```

The tournament phase timeline is a pre-planned operational script. The CMS should support defining this script in advance (as a named event configuration), then executing it on tournament day with minimal manual intervention — each phase transition is pre-scheduled, and the operator's role is monitoring and exception handling, not live configuration.

---

*End of TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Timeline data structures (event log, temporal state preservation): Agent 1 (Platform) requirement*
*Event-based timeline navigation: Agent 2 (CMS) design coordination*
