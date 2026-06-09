# ClubHub TV — Operational Workspace Architecture v1
# Operator Environments for Deterministic Orchestration

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, ENTROPY-OBSERVABILITY-UX-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, EXPLAINABILITY-UX-SPEC-v1.md, MARKET-VERTICAL-PATTERNS.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Workspace Philosophy

---

### 1.1 Operational Cognition Over Feature Navigation

Most CMS systems are organized around features: campaigns, schedules, media library, settings. The operator navigates to a feature to perform an action, completes the action, and returns to where they came from.

This architecture is appropriate for software where the primary operator question is: "What do I want to do?"

ClubHub TV operators have a different primary question: "What is actually happening right now — and is it what I intended?"

This is a state question, not a task question. It requires a different architecture. The ClubHub TV CMS must be organized around **operational state**, not feature categories. The operator's entry point is not a feature menu — it is a live view of what the system is currently doing.

**The key distinction:**

| Feature-navigation CMS | State-centric operational workspace |
|------------------------|--------------------------------------|
| "Where do I go to create a campaign?" | "What is currently controlling this screen?" |
| "How do I add an override?" | "Is this override still doing what I intended?" |
| "Where are my campaigns?" | "What campaigns are actively winning on screens right now?" |
| Task → find → act | Observe → understand → intervene |

The workspace model described in this document is designed for the second column.

---

### 1.2 State-Centric Architecture

Every workspace in the ClubHub TV CMS must expose **effective state** as its primary information surface. Effective state is the answer to: "What is this system actually doing right now, for each screen, in this venue?"

Effective state is not configuration state. Configuration state is what has been set up. Effective state is what is winning the resolution decision and being delivered. They are often the same. They are not always the same.

**The rule:** The operator should never need to navigate to three different screens to understand why content X is not showing. Effective state must be visible from a single entry point per scope (screen / zone / venue / network).

---

### 1.3 Temporal Awareness Everywhere

Operational state is not static. Rules have start times and expiry times. Campaigns have date ranges. Emergencies are created and cleared. The system's behavior at 9 AM is different from its behavior at 9 PM, and different again from its behavior next Tuesday.

Every workspace must have a temporal dimension. Operators must be able to:
- See what is happening **now**
- See what will happen **next** (next transition, next expiry, next scheduled change)
- Preview what will happen at a **specific future time**
- Reconstruct what happened at a **specific past time**

A workspace that only shows current state is operationally incomplete. The operator who sets up content for an event happening on Saturday needs to verify Saturday's state, not Tuesday's state.

---

### 1.4 Effective-State-First Design

The effective-state-first principle means: before showing operators their configuration objects, show them what is actually active on screens.

**Violated by:** CMS designs that open to a "Campaign List" or "Content Library" view. These show configuration, not effective state. An operator who opens a campaign list sees campaigns — but not which campaigns are winning, which are suppressed, and which are not reaching the screens they target.

**Implemented by:** Workspaces that open to a view of screen states — what is playing on each screen, via which rule, with which effective coverage. Configuration views are secondary, accessed when the operator needs to make a change.

This is a fundamental information architecture choice. The default view is a diagnostic of current operational reality, not a list of configuration objects.

---

## Part 2 — Primary Workspace Types

---

### 2.1 Live Operations Workspace

**Purpose:** The operator's primary environment for managing active operational state. Designed for day-to-day and event-day operations.

**Primary questions answered:**
- What is every screen in this venue showing right now?
- Are there any unexpected states (emergency active, override preventing expected content)?
- What changes in the next 2 hours?

**Operational priority:** Immediate operational awareness. Everything on this workspace is oriented toward "what is happening now and what needs attention."

**Information density:** Medium-high. Enough information to be actionable without requiring investigation. Details available on tap.

**Time sensitivity:** High — this workspace is used during live operations. Response time for all state updates: ≤ 15 seconds (one poll cycle).

**Entropy exposure:** Active override count, any screens in unexpected states, expiring rules in the next 2 hours.

**Key surfaces:**
- Venue screen grid (all screens, color-coded by active resolution level)
- Active override strip (horizontal strip showing all active overrides with age and expiry countdown)
- Upcoming transitions list (next N scheduled content transitions across all screens)
- Venue health indicator (grade + top 1–2 entropy signals)

**Entry condition:** This is the default landing workspace for Floor Operators and Venue Managers. It is what the operator sees when they open the CMS.

---

### 2.2 Future Simulation Workspace

**Purpose:** Pre-event planning and content verification. Designed for operators preparing for specific events, schedule reviews, or configuration testing.

**Primary questions answered:**
- What will every screen show during [event window]?
- Are there any coverage gaps or conflicts in the next 7 days?
- What happens to screen X at time Y if I make this change?

**Operational priority:** Predictive verification. Every surface here is about future state, not current state.

**Information density:** High — operators in this workspace are doing detailed planning work and need full resolution trace visibility.

**Time sensitivity:** Low — this workspace is used in advance, not during live operations.

**Entropy exposure:** Future entropy risks — overrides scheduled to expire during critical periods, coverage gaps in future windows, campaigns with end dates within the event window.

**Key surfaces:**
- Venue timeline view (24-hour timeline for all screens, with day/week navigation)
- Impact simulation panel (drag a proposed change and see its effect on the timeline)
- Coverage gap detector (scans upcoming windows for unscheduled periods)
- Future state explorer (time picker → "what does the venue look like at this time?")

---

### 2.3 Sponsorship Operations Workspace

**Purpose:** Sponsor commitment management and delivery verification. Designed for Sponsorship Managers and Venue Managers with sponsor accountability.

**Primary questions answered:**
- Are contracted sponsors receiving their committed share of voice?
- What is suppressing sponsor content on specific screens?
- What is the forecast for sponsor delivery over the contract period?

**Operational priority:** Contract compliance. Every surface is oriented toward "is this sponsor obligation being met?"

**Information density:** Medium — focused on sponsor-specific signals, not full venue state.

**Time sensitivity:** Medium — SOV shortfalls need correction within hours, not seconds.

**Key surfaces:**
- Sponsor roster with real-time contracted vs delivered SOV
- Suppression alert panel (sponsors being blocked by overrides or higher-level content)
- Delivery forecast (projected SOV over contract period based on current configuration)
- Per-screen sponsor visibility map

---

### 2.4 Venue Operations Workspace

**Purpose:** Venue-level configuration management and health oversight. Designed for Venue Managers reviewing configuration quality and entropy state.

**Primary questions answered:**
- Is the venue's configuration clean and well-maintained?
- Are there entropy signals that need attention?
- Are there configuration objects that need review, cleanup, or renewal?

**Operational priority:** Configuration governance. This workspace is where entropy is managed, not just observed.

**Information density:** Medium — focused on structural health signals, not moment-to-moment operations.

**Time sensitivity:** Low — used in periodic reviews (weekly / monthly), not during live operations.

**Key surfaces:**
- Venue health score with contributing signals
- Override age distribution panel
- Configuration review queue (rules needing review or cleanup)
- Operator activity summary (who created what, when, attribution overview)

---

### 2.5 Emergency Operations Workspace

**Purpose:** Emergency content activation, management, and clearance. Designed for any operator with emergency authority acting under time pressure.

**Primary questions answered:**
- What emergency content is currently active?
- What screens are affected?
- Is there anything that should have been cleared already?

**Operational priority:** Speed and clarity under pressure. The Emergency Operations Workspace must work correctly when the operator is stressed, time-constrained, and possibly not thinking clearly.

**Information density:** Low — maximum clarity, minimum noise. This is not a diagnostic workspace. It is an action workspace.

**Time sensitivity:** Extreme — emergency state must be visible and actionable within 3 taps from any other workspace.

**Key surfaces:**
- Emergency status panel (active / all clear — visible in large text)
- Active emergency list with age, scope, and creating operator
- Emergency activation flow (scoped, with expiry required)
- Emergency clearance confirmation (with consequence preview)

**Design requirement:** The Emergency Operations Workspace must be accessible from a persistent navigation element in every other workspace — not buried in a menu. During a genuine emergency, the operator must reach this workspace without thinking about navigation.

---

### 2.6 Network Operations Workspace

**Purpose:** Multi-venue oversight and operational anomaly detection. Designed for Org Admins and Network Operations operators managing a fleet of venues.

**Primary questions answered:**
- Which venues have active operational issues right now?
- Which venues have degrading entropy health?
- Are there patterns across venues that indicate systemic problems?

**Operational priority:** Exception detection and fleet health. This workspace is about identifying what needs attention, not managing individual screens.

**Information density:** Low per venue, high in aggregate. The venue list must be scannable; individual venue detail is accessed by drilling down.

**Time sensitivity:** Medium — anomalies should surface within minutes; individual venue state is visible by drill-down.

**Key surfaces:**
- Fleet venue grid (all venues, health grade, active alert count)
- Anomaly feed (real-time stream of Tier 2+ entropy signals across all venues)
- Venue comparison table (health grade trends across venues)
- Network-level emergency status (any active emergencies across any venue)

---

### 2.7 Executive Oversight Workspace

**Purpose:** Summary operational health for senior management. Designed to translate operational state into business-language reporting.

**Primary questions answered:**
- Is the network operating correctly overall?
- Are sponsor obligations being met?
- Are there compliance risks requiring attention?

**Operational priority:** Business signal translation. Everything is expressed in business language, not operational/technical language.

**Information density:** Very low — summary cards and trend indicators only. Detail is accessed by request, not surfaced by default.

**Key surfaces:**
- Network health summary (percentage of venues at each grade)
- Sponsor delivery summary (aggregate SOV performance across all contracts)
- Compliance status summary (are mandatory content obligations being met?)
- Active incident count (number of Tier 3–4 alerts currently open)

---

## Part 3 — Workspace State Models

---

### 3.1 State Model Summary Table

| Workspace | Primary question | Time axis | Entropy exposure | Default operator |
|-----------|-----------------|-----------|-----------------|-----------------|
| Live Operations | What is happening now? | Now + 2h | Active alerts | Floor Operator, Venue Manager |
| Future Simulation | What will happen? | Future | Future risks | Venue Manager, Org Admin |
| Sponsorship Operations | Are we delivering? | Now + rolling period | SOV signals | Sponsorship Manager |
| Venue Operations | Is configuration healthy? | Past 30 days + now | Full entropy | Venue Manager |
| Emergency Operations | Is emergency state clean? | Now + duration | Emergency age | Any (with authority) |
| Network Operations | What needs attention across venues? | Now + 24h | Fleet anomalies | Org Admin |
| Executive Oversight | Is the business performing? | Rolling period | Business signals | Executive |

---

### 3.2 Workspace Transitions

Workspaces are not isolated tabs. Operators move between them based on operational context. Transitions must be:

- **Fast:** No more than 2 taps between any two workspaces
- **Context-preserving:** If an operator is looking at Screen B1 in the Live Operations Workspace and switches to Future Simulation, they should see Screen B1's future state, not a generic venue timeline
- **State-aware:** The system should remember which workspace the operator was in and what they were looking at when they return

**Common transition patterns:**
- Live Operations → Screen introspection (operator taps a specific screen to investigate)
- Live Operations → Emergency Operations (operator activates emergency mode)
- Future Simulation → Override creation (operator identifies a gap and creates an override to fill it)
- Sponsorship Operations → Venue Operations (operator identifies SOV issue, investigates override causing suppression)
- Network Operations → Live Operations at specific venue (anomaly identified, drill into venue)

---

## Part 4 — Role-Adaptive Information Hierarchy

---

### 4.1 Novice Operator View

**Target:** New Floor Operators, first month of CMS use.

**Information hierarchy:**
1. What is playing on each screen (effective state, simplified)
2. Any alerts requiring attention (Tier 3–4 only)
3. Upcoming transitions in the next hour
4. Quick action: create override (most common urgent action)

**Suppressed (accessible but not prominent):**
- Resolution level details
- Entropy metrics
- Provenance attribution
- Full configuration history

**Novice mode design principle:** Give the operator enough to act without overwhelming them. The system will expose more detail as they need it. Novice mode is not permanently restricted — it is the default entry point, not a capability ceiling.

---

### 4.2 Advanced Operator View

**Target:** Experienced Floor Operators, Venue Managers, operators who have passed resolution literacy.

**Information hierarchy:**
1. Effective state with resolution level indicators
2. Active override panel (full list with ages)
3. Entropy signals (Tier 2–4)
4. Upcoming transitions (2-hour window)
5. Attribution for all active rules (who created what)

**Exposed by default:**
- Resolution level icons on all screen state indicators
- Override age indicators
- Suppression warnings on campaign status

---

### 4.3 Network Operations / Supervisor View

**Target:** Org Admins, Network Operations operators, Venue Managers with multi-venue responsibility.

**Information hierarchy:**
1. Fleet health overview (all venues, grades, anomaly counts)
2. Active Tier 3–4 alerts across network
3. Venue drill-down (full venue state on tap)
4. Configuration audit tools

**Additional capabilities:**
- Cross-venue override creation (network-level interventions)
- Organization-level entropy trend report
- Operator activity feed (who is doing what across venues)

---

### 4.4 Sponsorship / Fulfillment View

**Target:** Sponsorship Managers, sales operations staff.

**Information hierarchy:**
1. Sponsor SOV roster (all sponsors, contracted vs delivered)
2. Active suppression alerts (sponsors not receiving contracted exposure)
3. Delivery forecast (next 7 days projection)
4. Screen-level sponsor visibility

**Suppressed (not relevant):**
- Resolution level technical detail
- Campaign management tools
- Entropy metrics (except those directly affecting sponsor SOV)

---

### 4.5 Executive Abstraction View

**Target:** General managers, C-level, board-level oversight.

**Information hierarchy:**
1. Network health percentage (e.g., "94% of venues operating normally")
2. Sponsor fulfillment rate (e.g., "All contracts ≥98% SOV delivery")
3. Active incidents (count and severity only)
4. Compliance status (pass/fail per regulatory category)

**No technical detail exposed.** If the executive needs to understand why something is in a particular state, they should consult the relevant operational manager — not diagnose it themselves in the CMS.

---

## Part 5 — Temporal UX Requirements

---

### 5.1 The Temporal Stack

Every workspace must offer a coherent view of the system across the following time dimensions:

**Now:** Current effective state. What is every in-scope screen showing at this moment, via which rule. Refreshed every 15 seconds (poll cycle).

**Next:** Upcoming transitions. What is the next scheduled rule change for each screen, and when? Within a 2-hour window by default.

**Near future:** Short-range forecast. What will the venue look like at the next major operational milestone (next meal period, next event, end of business day)?

**Scheduled future:** Long-range configuration. What campaigns and overrides are scheduled to take effect or expire in the next 7–30 days?

**Historical replay:** Past reconstruction. What was the venue's state at a specific past time? (Uses PRE deterministic replay per PREVIEW-SYSTEMS-SPEC-v1.md §3.6)

**Divergence history:** Past divergence events. When did effective screen state differ from predicted/configured state, and why?

---

### 5.2 Temporal Navigation Controls

Every workspace with a temporal dimension must provide:

**Time picker:** Select any specific date/time for state reconstruction. Accessible from any temporal view. Not just "today" and "tomorrow" presets — a full calendar/time picker for arbitrary future or past dates.

**Quick offsets:** "Now", "+1h", "+4h", "Tomorrow same time", "This Saturday 18:00" — one-tap navigation to common operational time points.

**Timeline scrubber:** In timeline views, a scrubber allowing the operator to sweep forward or backward in time and watch the venue state change. This is the primary tool for verifying that configuration is correct across a time window.

**Anchoring:** When the operator moves to a future time, all workspace surfaces should reflect that time — not just the timeline, but the screen states, the active rule indicators, and the override panel. The entire workspace is time-anchored.

---

### 5.3 Time Zone Handling

Per ENGINEERING-CONSTITUTION-v1.md INV-9: timezone isolation. Every screen, venue, and schedule operates in its local timezone. The CMS must display times in the venue's local timezone, not the operator's timezone.

**Visual treatment:** All times in the CMS are followed by a timezone indicator:
```
Transition at 18:00 AEST
Override expires 23:59 NZDT
```

**Disambiguation rule:** When a Network Operations operator is viewing multiple venues across timezones, each venue's times must be clearly labeled with that venue's timezone. Displaying all times in a single "operator timezone" is a dangerous oversimplification — it would show the wrong transition times for venues in other zones.

---

## Part 6 — Multi-Venue Cognition

---

### 6.1 Fleet-Level Visibility

The Network Operations Workspace must provide a venue fleet view that conveys operational health at a glance for all venues, without requiring the operator to drill into each one.

**Fleet grid design:**

Venues are represented as cards in a grid. Each card shows:
```
┌─────────────────────────────┐
│ [VENUE_NAME]           [C↓] │  ← Health grade + trend
│ [CITY / REGION]             │
│                             │
│ 🔒×3  ⚠×0  ℹ×2             │  ← Active override count, alert counts
│ 23 screens  2 offline       │
│ Last activity: 14m ago      │
└─────────────────────────────┘
```

**Filterable by:**
- Health grade (A / B / C / D / F)
- Active alert type (override age, SOV shortfall, coverage gap, emergency active)
- Venue vertical (golf club, licensed club, hotel, etc.)
- Region / geography
- Operator assigned

---

### 6.2 Venue Clustering

When a network contains many venues, grouping by operational similarity helps the Network Operations operator identify patterns:

**Clustering dimensions:**
- **Geographic:** Venues in the same city or region
- **Vertical:** All golf clubs, all licensed clubs, all hotels
- **Health grade:** All C-grade venues grouped for batch review
- **Operator:** All venues managed by the same venue manager

**Cluster-level signals:** Each cluster shows aggregate health — e.g., "Golf clubs: 8 venues, average grade B, 1 venue at grade D needing attention."

---

### 6.3 Operational Anomaly Surfacing

Anomalies that need Network Operations attention must surface proactively, not wait for the operator to find them.

**Anomaly feed:** A real-time stream of Tier 2+ signals across all venues, ordered by severity:

```
Anomaly Feed — [ORG_NAME]                         Live ●

  ⚠ HIGH  [VENUE_A] — Emergency active 18 days, no expiry        2m ago
  ⚠ HIGH  [VENUE_B] — Compliance content blocked on 3 screens    6m ago
  ⚡ MED   [VENUE_C] — 4 overrides over 90 days old              1h ago
  ⚡ MED   [VENUE_D] — SOV 19% vs contracted 25%                 3h ago
  ℹ LOW   [VENUE_E] — Campaign fragmentation detected            6h ago
```

**Acknowledge-or-act:** Per ENTROPY-OBSERVABILITY-UX-v1.md §10.2 — anomalies cannot be silently dismissed.

---

### 6.4 Regional Divergence

When multiple venues in the same region or cluster develop diverging health states, this is a signal of systemic issues:

- Multiple venues in the same region developing override accumulation simultaneously → may indicate a regional operational training gap
- Venues managed by the same operator developing similar entropy patterns → operator-specific training need

**UX surface:** Divergence is surfaced in the Network Operations Workspace as a comparison panel: "Venues with similar configuration profiles but diverging health states." This surfaces patterns that would be invisible when viewing venues in isolation.

---

## Part 7 — Workspace Safety Rules

---

**WS-01: No Hidden State Mutation**
No workspace action should change system state without explicit operator confirmation. Read-only views must never have side effects. "Viewing" a configuration object should never modify it.

**WS-02: No Invisible Interventions**
All interventions (overrides created, emergencies activated, campaigns modified) must appear in the relevant operational view immediately. An operator who creates an override from the Future Simulation Workspace must see it appear in the Live Operations Workspace and the Venue Operations Workspace without requiring a manual refresh.

**WS-03: Effective State Always Visible**
No workspace should present only configuration state without exposing effective state. If a campaign is shown as "Active," the workspace must also show whether it is winning on its targeted screens or being suppressed.

**WS-04: Operational Debt Visibility**
Every workspace accessible to Venue Managers and above must include a persistent entropy health indicator — even if small and non-intrusive. The venue health grade must always be visible from any workspace, not only from the Venue Operations Workspace.

**WS-05: Preview Before Commit**
Any workspace action that modifies system state must provide a preview of the effective change before the change is committed. The preview must use actual PRE semantics (not simulation) per PREVIEW-SYSTEMS-SPEC-v1.md §6.1 Safety Rule S-01.

**WS-06: Temporal Context Always Visible**
When an operator is viewing a non-current time (future simulation, historical replay), the temporal offset must be prominently displayed in every workspace surface. An operator viewing Saturday's state must never believe they are looking at current state.

---

*End of OPERATIONAL-WORKSPACES-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Workspace state model changes require Agent 2 (CMS) coordination*
*API requirements for temporal replay require Agent 1 (Platform) coordination*
