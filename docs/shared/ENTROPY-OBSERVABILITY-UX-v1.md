# ClubHub TV — Entropy Observability UX v1
# How Humans See Operational Decay

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design), with Agent 2 (CMS) co-authority on entropy metric definitions
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, ENGINEERING-CONSTITUTION-v1.md, DESIGN-PRINCIPLES-FOR-OPERATIONS.md, OPERATOR-COGNITIVE-MODELS-v1.md, FAILURE-STORIES.md, OPERATIONAL-INSIGHTS-LOG.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Entropy Visibility Philosophy

---

### 1.1 Entropy Is Invisible Until It Fails

Operational entropy does not announce itself. It accumulates silently — one override, one shadow schedule, one expired rule left uncleaned. Each individual addition is locally reasonable. A bar manager adds an override to ensure the right content plays for a Saturday event. A golf club coordinator creates a direct schedule for a tournament that has since ended. A venue manager escalates a campaign priority to push past a conflict they didn't understand.

None of these actions are mistakes in isolation. Collectively, they produce a system state in which no one can predict what will show on any given screen at any given time. The screens may be showing content — often the right content by chance. But the structure has decayed. The system is operating by accumulated accident rather than by design.

**This is the core observability problem:** entropy is a property of accumulated state, not of individual actions. Standard operational monitoring detects anomalies in individual events. Entropy is not an anomalous event — it is a pattern across many normal events.

The entropy observability system must detect and surface patterns, not events.

---

### 1.2 The Advisory-Only Principle

Entropy signals must be advisory, not blocking. This is a constitutional requirement grounded in ENGINEERING-CONSTITUTION-v1.md §4.4: "Visibility outranks automation" and §2.7: "Human operators are authoritative over intent."

The entropy observability system is not an enforcement system. It does not prevent operators from creating overrides. It does not block configurations that increase entropy metrics. It does not require approval workflows before allowing actions that degrade health scores.

It informs. It surfaces. It makes the invisible visible.

The reason this constraint exists is not timidity — it is operational realism. Operators will always have legitimate reasons for actions that look like entropy from the system's perspective. A high override count might be an active event management day, not entropy accumulation. An expired rule might be intentionally left in place as documentation of a past decision. The system cannot distinguish intentional operational choices from entropic drift without human context.

**The system flags. The operator decides.**

---

### 1.3 Warning Fatigue as an Entropy Risk

A poorly designed entropy observability system can itself cause entropy.

If entropy signals are: frequent, indiscriminate, poorly explained, or not actionable — operators will habituate to them. Warning fatigue produces operators who dismiss entropy signals reflexively, including genuine high-priority signals.

Warning fatigue is a design failure, not an operator failure. The design response is:

- **Signal fewer things, but surface them clearly.** An operator who sees 15 amber warnings on their dashboard will tune them all out. An operator who sees one clearly explained warning will address it.
- **Prioritize by operational impact, not by metric count.** A venue with 3 overrides that are suppressing a compliance content obligation is higher priority than a venue with 14 overrides that are all working correctly.
- **Make every signal actionable.** A warning that says "entropy elevated" without telling the operator what to do about it is noise. A warning that says "2 overrides are blocking your compliance content on gaming screens — [review now]" is actionable.
- **Resolve warnings explicitly.** When an operator addresses a warning, the warning should close. When an operator decides not to address a warning (legitimate reason), they should be able to dismiss it with a note. Warnings that can't be dismissed accumulate into noise.

---

### 1.4 The Entropy Observability Stack

Entropy observability operates at three distinct temporal layers:

**Layer 1 — Current state (real-time):** What is the operational health of the system right now? This is the venue health dashboard, the screen status indicators, the active override count. It answers: "Is anything visibly wrong today?"

**Layer 2 — Recent history (7–30 days):** How has the system been operating over the past month? This is the override age distribution, the campaign orphan trend, the priority escalation pattern. It answers: "Is the system accumulating entropy?"

**Layer 3 — Longitudinal trend (30–90 days):** Is the system getting healthier or less healthy over time? This is the entropy score trend, the health grade history, the comparison to deployment baseline. It answers: "Are we on a good trajectory?"

Each layer requires different UX surfaces and different operator attention models. Layer 1 is checked during operations. Layer 2 is checked during periodic reviews. Layer 3 is reviewed by management or network operations for venue health governance.

---

## Part 2 — Operational Debt Visualization

---

### 2.1 The Venue Health Score

**Definition:** A single aggregate health indicator for a venue's operational state, computed from weighted entropy metrics M-01 through M-12 (per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**Purpose:** Gives venue managers, network operators, and executives a fast headline assessment of venue operational health — without requiring them to understand individual metrics.

**Representation:**

The health score is expressed as a letter grade (A through F) rather than a numeric score. The reasons for this choice:

1. Letter grades have clear cultural meaning — operators instantly know that "C" means "needs improvement" without needing scale context
2. Letter grades are resistant to false precision — a numeric score implies measurement accuracy that is not warranted for derived metrics
3. Letter grades allow for natural threshold language: "We target A/B grade venues for sponsor content placements"

**Grade thresholds:**

| Grade | Entropy signal | Operational meaning |
|-------|---------------|---------------------|
| A | No significant entropy signals | System operating as designed |
| B | Minor entropy signals — monitoring advised | Proactive cleanup recommended |
| C | Moderate entropy — intervention recommended | Override accumulation or campaign fragmentation present |
| D | Significant entropy — intervention needed | Multiple entropy patterns active; operational risk elevated |
| F | Critical entropy — immediate review | System behavior is non-deterministic from operator perspective |

**Display contexts:**
- Venue list view: grade badge next to venue name
- Venue detail view: prominent above the fold, with "Why this grade?" expansion
- Network operations dashboard: filterable venue list by grade
- Weekly operator digest: grade trend (improving/stable/declining)

**Important:** The health score is a communication tool, not a performance metric. It must not be used to evaluate operator or venue performance for employment purposes. It is operational intelligence, not a KPI for accountability.

---

### 2.2 The Entropy Signal Summary

**Definition:** A structured summary of the specific entropy signals contributing to a venue's health grade, with operational severity and action paths.

**Replaces:** The undifferentiated "entropy elevated" message that produces warning fatigue.

**Format:**

```
Venue Health: C (Moderate)
3 signals contributing to this grade

  ⚠ HIGH: 2 overrides are blocking compliance content on gaming screens
    Active since: 47 days (OVERRIDE_001), 23 days (OVERRIDE_002)
    [Review overrides]

  ⚡ MEDIUM: 7 operational overrides are over 30 days old with no expiry
    These may be intended as permanent — or may be forgotten
    [Review override ages]

  ℹ LOW: Campaign fragmentation detected — 4 similar campaigns targeting
    the same screens with overlapping time windows
    [Review campaigns]
```

**Signal categories:**

| Symbol | Severity | Operational meaning | Default action |
|--------|----------|---------------------|---------------|
| ⚠ | HIGH | Active impact on content delivery — action recommended | Review and act |
| ⚡ | MEDIUM | Potential future impact — proactive attention recommended | Review when possible |
| ℹ | LOW | Structural issue — no immediate impact | Note and monitor |

**Priority ordering:** HIGH signals always appear before MEDIUM, which appear before LOW. The most important thing is always the first thing the operator sees.

---

### 2.3 Debt Timeline View

**Definition:** A timeline visualization showing how the venue's entropy level has changed over time, with events annotated to show when specific entropy-generating or entropy-reducing actions occurred.

**Purpose:** Makes the relationship between operator actions and entropy accumulation visible. Operators who can see that "override count increased significantly on March 3" and "March 3 was the day of the sponsor visit" can draw their own conclusions about why entropy increased — and whether the overrides from that day have been cleaned up.

**Timeline representation:**

```
Venue Entropy — 90 Day View

Oct      Nov      Dec      Jan      Feb
──────────────────────────────────────────
         ▲                     ▲
         │ Event: 6 overrides  │ Override
         │ created for sponsor │ cleanup:
         │ visit               │ 4 removed

A ═══════╗
B        ╚════════════════╗
C                         ╚══════════╗
D                                    ╚════
```

**Events annotated on the timeline:**
- Override creation spikes
- Override cleanup actions
- Campaign creation / deletion
- Emergency activations and clearances
- Operator account changes (onboarding / offboarding)

**This visualization directly addresses OPERATIONAL-INSIGHTS-LOG.md INSIGHT-007:** "The system must surface accumulating patterns, not just individual events." The debt timeline makes patterns visible in a form operators can interpret without requiring entropy metric expertise.

---

## Part 3 — Override Accumulation UX

---

### 3.1 Override Age Distribution

**Metric source:** M-02 Override Age Distribution (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**The signal:** What is the distribution of ages for active operational overrides? Are overrides being cleaned up after their purpose is served, or are they accumulating indefinitely?

**UX surface — Override Age Distribution Panel:**

```
Active Overrides — [VENUE_NAME]
14 total

  Age distribution:
  ─────────────────────────────────────────
  0–7 days:    ████████████  8  (normal)
  7–30 days:   ████          3  (review)
  30–90 days:  ██            2  ⚡ aging
  90+ days:    █             1  ⚠ stale
  ─────────────────────────────────────────

  [1 override has no expiry date and is 94 days old — review]
```

**Color coding:**
- 0–7 days: Green — expected operational age
- 7–30 days: Amber — may be intended long-term; worth reviewing
- 30–90 days: Orange — likely outdated; review for cleanup
- 90+ days: Red — high probability of being forgotten or orphaned

**Action path from override age view:**
- Single click on any age bucket → filtered list of overrides in that age range
- From filtered list → per-override review: "Was this intentional? Still needed?"
- Cleanup action: deactivate override with reason annotation

---

### 3.2 Override Coverage Map

**Definition:** A visualization of which rules are winning on which screens, across the entire venue, with override-active screens clearly distinguished from campaign-active screens.

**Purpose:** Allows the Venue Manager to see at a glance whether overrides are covering screens beyond their intended scope.

**UX surface — Venue Screen Grid:**

```
Venue Screen Coverage — [VENUE_NAME]

Zone: Bar Area          Zone: Dining          Zone: Gaming
┌────┐ ┌────┐           ┌────┐ ┌────┐        ┌────┐ ┌────┐ ┌────┐
│ 🔒 │ │ 📋 │           │ 📋 │ │ 📋 │        │ 📋 │ │ 📋 │ │ 📋 │
│ B1 │ │ B2 │           │ D1 │ │ D2 │        │ G1 │ │ G2 │ │ G3 │
└────┘ └────┘           └────┘ └────┘        └────┘ └────┘ └────┘
┌────┐ ┌────┐
│ ⚠  │ │ 📋 │
│ B3 │ │ B4 │
└────┘ └────┘

Legend:
🔒 Operational Override   ⚠ Emergency Active
📋 Campaign               ↩ Fallback
📺 Device Default         ⬛ Offline
```

**Immediate visible signals from this view:**
- Any screen showing 🔒 or ⚠ is not on campaign — operator can see at a glance if overrides are more widespread than expected
- Zone-level pattern detection: if an entire zone is showing 🔒, a zone-level override may be causing unintended broad coverage

**Interaction:** Tapping any screen icon opens the Level 1 explainability view (per EXPLAINABILITY-UX-SPEC-v1.md §4.1) for that screen.

---

### 3.3 Orphaned Override Detection

**Definition:** An override is "orphaned" when the operator who created it has left the organization, or when the override has been active significantly longer than any operational override would be expected to remain.

**Heuristics for orphan detection:**
- Override created by account that is now deactivated
- Override age > 90 days with no expiry date
- Override age > 30 days with no modification activity by any operator

**UX surface:**

Orphaned overrides appear in the override list with a distinct visual treatment (muted color, italic attribution showing "[FORMER OPERATOR]") and an inline prompt:

```
⚡ POSSIBLE ORPHAN
  Created by: [FORMER OPERATOR] (account deactivated 2026-01-14)
  Active for: 127 days
  No expiry date

  This override may have been forgotten when [FORMER OPERATOR] left.
  → Review content: still needed?
  → Deactivate if no longer needed
  → Mark as intentional if this override should remain
```

**This directly implements OPERATIONAL-INSIGHTS-LOG.md INSIGHT-014** — the requirement for CMS support for operator off-boarding workflow including configuration review.

---

## Part 4 — Stale State Detection

---

### 4.1 Expired Rule Persistence

**Definition:** Configuration objects (campaigns, overrides, schedules) that have passed their end date but remain in the system without being archived. They no longer win resolution decisions, but they persist as configuration noise and can cause operator confusion.

**Metric source:** M-07 Stale State Ratio (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**Why this matters operationally:** Operators who see a long list of "past" configurations alongside "current" configurations have difficulty identifying what is actually affecting screens. The signal-to-noise ratio of the configuration view degrades.

**UX surface:**

Expired configurations appear in their respective lists with a muted visual treatment and are collapsed behind "Show [N] expired items" by default. This keeps the primary view clean without deleting historical data.

```
Active Campaigns (3)
[Campaign A] [Campaign B] [Campaign C]

+ Show 7 expired campaigns
```

**Expanding shows:**

```
Expired Campaigns (7)
  [Campaign D] — ended 14 days ago
  [Campaign E] — ended 45 days ago
  ...
  [Archive all expired] [Review individually]
```

**Archive behavior:** Archiving an expired configuration removes it from the active list and entropy calculations. It remains accessible in the venue's historical archive view for audit purposes. Archive is not delete — archived configurations can be reviewed but not restored without explicit recreation.

---

### 4.2 Coverage Gaps

**Definition:** Time windows during which no content rule will resolve for a screen — the screen will fall through to structural fallback content (LEVEL_5) or device default (LEVEL_6).

**Metric source:** M-09 Coverage Gap Frequency (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**UX surface — Coverage Gap Indicator:**

Coverage gaps appear in the screen timeline view (PREVIEW-SYSTEMS-SPEC-v1.md Mode 1) as a distinct visual segment:

```
Screen Timeline — [SCREEN_NAME] — Tomorrow

[Campaign A] ██████████ 09:00–17:00
             ░░░░░░░░░░ 17:00–18:00 ← Coverage gap — fallback playing
[Campaign B] ██████████ 18:00–22:00
             ░░░░░░░░░░ 22:00–00:00 ← Coverage gap — fallback playing
```

Tapping a coverage gap segment opens:

```
Coverage Gap — 17:00–18:00
No campaign or override is configured for this screen during this window.
Your fallback content will play: [FALLBACK_CONTENT_NAME]

Is this intentional?
  → Schedule content for this window
  → The fallback is fine — no action needed
```

**Design principle:** Coverage gaps are not automatically problems. Fallback content is designed to play during unscheduled windows. But intentional use of fallback and accidental coverage gaps look identical to the system. The operator must be given visibility to decide which this is.

---

### 4.3 Long-Running Rules Without Review

**Definition:** Rules (campaigns, overrides) that have been active for a long time with no modification by any operator, suggesting they may not be under active management.

**Threshold for flagging:** Configurable per installation, default 60 days for operational overrides, 90 days for campaigns with no scheduled end date.

**UX surface:**

In the campaign/override list view, a "Last reviewed" indicator appears next to each item. Items not modified in 60/90+ days show a subtle aging indicator.

```
[CAMPAIGN_NAME]
Active since: 2026-02-03
Last modified: 2026-02-03 ← 108 days ago — consider reviewing
Targeting: 5 screens
```

**Operator action:** Tapping "consider reviewing" opens a simple review prompt:

```
[CAMPAIGN_NAME] hasn't been modified in 108 days.

Quick review:
☐ Content is still current and relevant
☐ Time windows are still appropriate
☐ Screen targeting is still correct
☐ Sponsor obligations are reflected

[All good — mark as reviewed] [Make changes]
```

This lightweight "heartbeat review" pattern prevents configurations from becoming forgotten while respecting that long-lived campaigns are often intentional.

---

## Part 5 — Fragmentation Visibility

---

### 5.1 Campaign Fragmentation Detection

**Definition:** Multiple campaigns covering the same screens with similar or overlapping time windows — suggesting that operators have been creating new campaigns instead of modifying existing ones.

**Metric source:** M-04 Campaign Orphan Rate (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**Why fragmentation forms:** Operators who don't understand how to modify existing campaigns, or who are not confident that modifying a campaign will have the intended effect, create new campaigns instead. Each "fix" adds a new campaign rather than updating the existing one.

**Detection heuristic:** Two campaigns targeting overlapping screen sets with overlapping time windows where one was created after the other. This suggests iteration-by-creation rather than modification.

**UX surface — Campaign Overlap Indicator:**

```
⚡ 3 campaigns may be duplicating coverage

  [Campaign A] covers Screens 1–5, Mon–Fri 09:00–17:00
  [Campaign B] covers Screens 1–5, Mon–Fri 09:00–17:00 ← Created 3 weeks after A
  [Campaign C] covers Screens 3–5, Mon–Fri 10:00–16:00 ← Created 1 week after B

  These campaigns are competing for the same screens and times.
  Only one will win on each screen — the others will not show.

  [Review overlapping campaigns]
```

**Review flow:** The overlap review shows which campaign is currently winning on each overlapping screen, and provides options to: merge campaigns, archive the losing ones, or confirm the overlap is intentional (different campaigns with different weights in the same window, for example).

---

### 5.2 Schedule Fragmentation

**Definition:** Multiple time-specific schedule rules covering the same screen across small increments, suggesting that complex time management has been done through accumulation rather than campaign design.

**Example:** A screen with 14 separate schedule entries covering Monday through Sunday in 2-hour increments — all created individually rather than through a campaign with a weekly pattern.

**UX surface:**

The screen detail view shows a "Schedule complexity" indicator:

```
[SCREEN_NAME] — Schedule complexity: HIGH
  14 individual schedule entries covering this week
  This may be easier to manage as a campaign

  [View schedule details] [Help: converting to a campaign]
```

The complexity indicator is informational only — it does not block the operator or force conversion. But it makes the complexity visible and provides a path to reduction.

---

## Part 6 — Sponsorship Drift Visibility

---

### 6.1 SOV Tracking

**Definition:** Share of voice (SOV) — the percentage of content playback time attributable to a specific sponsor across their contracted screens.

**Metric source:** M-06 Sponsor SOV Drift (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**UX surface — Sponsor SOV Panel:**

```
Sponsor Content Performance — [SPONSOR_NAME]
Contract: 25% SOV on Bar Area screens (SCREEN_B1–B4)
Period: 2026-01-01 – 2026-06-30

  7-day rolling SOV:  19.3%  ⚠ Below contract (–5.7%)
  30-day rolling SOV: 22.1%  ⚡ Approaching threshold
  90-day rolling SOV: 24.8%  ✓ Within contract

  Primary cause of current shortfall:
  → OVERRIDE_004 (active on B1, B2 since 47 days) is reducing
    available delivery windows for sponsor content

  [Review override] [See full SOV history]
```

**Operational significance:** SOV shortfall is often invisible until a sponsor audits. By the time the sponsor notices and escalates, the shortfall may have accumulated over months. The SOV panel makes the shortfall visible to venue operators before sponsor escalation — enabling proactive intervention.

---

### 6.2 Sponsor Content Suppression Visibility

**Definition:** Active identification of which configuration objects are currently suppressing sponsor content below its contracted delivery level.

**UX surface:**

When the 7-day rolling SOV is below contract threshold, the sponsor detail view surfaces:

```
⚠ Sponsor content delivery is below contracted SOV

Screens currently suppressing [SPONSOR_NAME]:
  SCREEN_B1: Blocked by OVERRIDE_004 (47 days, no expiry)
  SCREEN_B2: Blocked by OVERRIDE_004 (47 days, no expiry)
  SCREEN_B3: On campaign (sponsor content winning correctly)
  SCREEN_B4: On campaign (sponsor content winning correctly)

  Action options:
  → Review and remove OVERRIDE_004 if no longer needed
  → Adjust sponsor content time windows to avoid override periods
  → Log this shortfall as force majeure (document with reason)
```

This surface makes the causal chain from override to SOV shortfall explicit. It prevents the common failure mode where an operator knows SOV is low but doesn't understand why.

---

## Part 7 — Priority Inflation Detection

---

### 7.1 Priority Range Width

**Metric source:** M-08 Priority Range Width (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5).

**Definition:** The spread between the lowest and highest priority values assigned to content items across a venue's campaigns. A large priority range suggests that operators have been using priority escalation to resolve resolution conflicts — a behavior that generates entropy without solving the underlying problem.

**Why this forms:** OPERATOR-COGNITIVE-MODELS-v1.md §3.2 describes the Priority-as-Number Fallacy — operators who believe increasing priority will make content "win" resolution conflicts attempt to solve suppression by escalating content item priority. This produces priority inflation: content that was priority 1 → escalated to 5 → escalated to 10 → escalated to 100 → all content ends up at maximum priority and the SWRR weighting becomes meaningless.

**UX surface — Priority Distribution Indicator:**

```
Content Priority Distribution — [VENUE_NAME]

  Range: 1 → 100  ⚠ Wide range detected

  ██████████████████░░░░░░░░░░░░░░
        Most content at max priority
        SWRR weighting may not be functioning as intended

  [View priority breakdown] [Learn about content priority]
```

**Action path:** The "View priority breakdown" view shows content items sorted by priority with annotations for items that have been escalated (changed from their original priority) — indicating that escalation has occurred and the original intent may have been lost.

---

### 7.2 Escalation Pattern Detection

**Definition:** Detection of the pattern where a specific operator has repeatedly increased content item priorities over time, suggesting they are trying to use priority escalation to solve resolution conflicts.

**UX surface:** This appears as an advisory note in the operator's profile view (Venue Manager level):

```
Advisory: Content priority escalation pattern detected
  3 content items have been escalated to maximum priority
  in the last 30 days by [OPERATOR_NAME]

  Priority escalation does not affect which rules win —
  it only affects how often content appears within a playlist.

  If content isn't showing, the cause is likely a rule conflict,
  not content priority. [Diagnose why content isn't showing]
```

This is an educational intervention, not a disciplinary one. The operator is not doing something wrong — they are responding rationally to an incorrect mental model. The response is education and diagnosis, not blocking.

---

## Part 8 — Operator Collision Zones

---

### 8.1 Concurrent Edit Detection

**Definition:** Two or more operators making changes to the same venue's configuration within a short time window, creating a risk of conflicting configurations.

**Context:** This is most common during live events when multiple operators may be managing the venue simultaneously — one handling a sponsor request, another handling a scheduling change, a third responding to a screen issue.

**UX surface:**

When an operator opens a configuration object for editing, check for concurrent activity:

```
⚡ Active concurrent editing

  [OPERATOR_NAME] is currently viewing/editing configuration for this venue.

  To avoid conflicts:
  → Check with [OPERATOR_NAME] before making changes
  → Use the venue chat / team channel to coordinate
  → Changes made by both operators may conflict
```

This is an advisory — it does not prevent editing. But it makes concurrent activity visible, reducing the risk of two operators creating conflicting rules simultaneously.

---

### 8.2 Configuration Conflict Detection

**Definition:** Two active rules at the same resolution level and the same specificity level targeting the same screen(s) — creating an ambiguous resolution situation.

**Note on PRE behavior:** The PRE handles ties deterministically per INV-3. Ties are resolved by a defined tiebreak rule. The issue is not that the system is confused — it is that operator intent is ambiguous. Two operators may each believe their rule is "the" rule for a screen when actually both are competing.

**UX surface:**

The conflict appears as a warning on both rules:

```
⚡ Rule conflict detected

  This override is competing with [OTHER_OVERRIDE_NAME] for:
  Screens: B1, B2, B3
  Time window: Today 18:00–22:00

  Both overrides are at the same priority level.
  The system will apply [OTHER_OVERRIDE_NAME] based on
  creation timestamp (it was created first).

  Is this intentional?
  → Keep both (system will apply tiebreak)
  → Modify this override to avoid the conflict
  → Remove the other override if it is no longer needed
```

**This prevents the silent conflict failure mode** where two operators each believe their rule is active, neither realizes the other rule exists, and the system is applying one based on a tiebreak rule neither is aware of.

---

## Part 9 — Longitudinal Entropy Tracking

---

### 9.1 Entropy Trend

**Definition:** The direction and rate of change of the venue's health score over time.

**The three states:**

| Trend | Indicator | Operational meaning |
|-------|-----------|---------------------|
| Improving | ↑ Green | Entropy is decreasing — cleanup is happening, correct workflows are being used |
| Stable | → Amber | Entropy is holding steady — not getting worse, not improving |
| Declining | ↓ Red | Entropy is accumulating — intervention is needed |

**Display:** The health grade badge includes a trend arrow and the rate of change:

```
Venue Health: C ↓ (declining)
Down from B grade 30 days ago
Primary driver: Override accumulation (+7 overrides, 0 cleaned up)
```

---

### 9.2 Comparison to Deployment Baseline

**Definition:** The venue's current entropy state compared to its state at deployment. This answers: "Have we maintained the operational quality we launched with?"

**UX surface (Venue Manager and above):**

```
Operational Health vs Deployment

At deployment (2026-01-15):  Grade A
Today (2026-05-22):          Grade C

Changes since deployment:
  +14 operational overrides (0 at deployment)
  +8 shadow schedules (0 at deployment)
  Campaign adoption: 42% of schedule (vs 100% at deployment)

  [Discuss this with your ClubHub support team]
  [Entropy cleanup guide]
```

This surface addresses a key operational risk: venues that launched correctly and have drifted. By anchoring to the deployment baseline, the operator can see that drift has occurred and understand the magnitude.

---

### 9.3 Entropy Velocity

**Definition:** The rate at which new entropy-generating events are occurring vs entropy-reducing events (cleanups, expiry date additions, orphan removals).

**Simple formula:** Net entropy change per week = (new entropy-generating events) − (entropy-reducing events)

**UX surface:**

```
This week: +3 overrides created, 1 override cleaned up
Net entropy: +2 ↑ (generating faster than cleaning)

Last 4 weeks:
  Week 1: +5 / −0 = +5 ↑
  Week 2: +3 / −0 = +3 ↑
  Week 3: +2 / −4 = −2 ↓ (cleanup week)
  Week 4: +3 / −1 = +2 ↑

Trend: Entropy is accumulating. Consider a cleanup review.
[Schedule cleanup review]
```

The velocity view makes the accumulation pattern visible as a rate, not just an absolute count. An operator who sees "+3, +3, +2, +3" per week understands the trajectory without needing to understand entropy metrics.

---

## Part 10 — Advisory vs Enforcement UX

---

### 10.1 Advisory Signal Hierarchy

All entropy signals are advisory. But not all advisories are equally urgent. The advisory hierarchy must be consistent across the CMS:

**Tier 1 — Informational (ℹ):**
- No current operational impact
- Visible in detailed views, not surfaced in summary views
- No persistent indicator on dashboard
- Dismissed by navigation (viewing detail closes the info state)

**Tier 2 — Recommended (⚡):**
- Potential operational impact if unaddressed
- Surfaced in venue health summary
- Persistent until operator reviews and acts or dismisses
- Weekly digest inclusion if unaddressed

**Tier 3 — Elevated (⚠):**
- Current or imminent operational impact
- Surfaced prominently in dashboard and venue views
- Cannot be passively dismissed — requires explicit "acknowledge" or "act"
- Daily digest inclusion
- Escalates to network operations if unaddressed for 7 days

**Tier 4 — Critical (🔴):**
- Active impact on compliance, sponsor obligations, or emergency function
- Surfaced in red at top of every venue view
- Email notification to Venue Manager and Org Admin
- Cannot be dismissed without documented reason
- Escalates to network operations within 24 hours

---

### 10.2 The Acknowledge-or-Act Pattern

For Tier 2 and above advisories, the pattern is: **acknowledge or act — never silently dismiss.**

When an operator encounters a Tier 2+ advisory and chooses not to act on it, they should be prompted to acknowledge with a reason:

```
⚡ 3 overrides are over 60 days old

  [Review now] [Not now — why?]

  If "Not now":
  ○ These overrides are intentional — long-term configurations
  ○ I'll address these in my next scheduled review [pick date]
  ○ These are under review by another operator
  ○ Other reason: [text field]
```

**Why this matters:** Acknowledged advisories are different from ignored advisories. An operator who acknowledges "these overrides are intentional long-term configurations" has made a conscious choice. If the system re-surfaces this advisory in 30 days and it is still the same, the operator has to actively acknowledge again — they cannot permanently dismiss it.

This pattern prevents the "advisory blindness" failure mode: operators who see the same advisories every time they log in and stop reading them.

---

### 10.3 Gentle Friction Design

Entropy-generating actions should encounter gentle friction, not blocking enforcement. The friction must be:

- **Fast to clear** — one extra step maximum in urgent flows
- **Educational** — the friction explains why the system is raising it
- **Dismissable** — operators who know what they are doing should not be slowed down

Examples:

**Creating an override with no expiry date:**
```
Note: This override has no expiry date.
It will remain active until manually removed.
Are you sure? [Yes, create without expiry] [Add expiry date]
```

Default button: "Add expiry date" — the correct action is the prominent one.

**Creating a high-scope override (venue-wide):**
```
This override will affect all 23 screens in [VENUE_NAME].
Screens that will change content: [see list — 18 screens]
Screens already under higher-level overrides (no change): 5 screens

[Continue] [Review scope]
```

Default button: "Review scope" — the safer action is prominent.

**Creating content with maximum priority:**
```
This content is set to maximum priority (100).
Content priority affects how often it appears in a playlist,
not whether the campaign shows. If you're trying to ensure
this content appears on specific screens, [check campaign targeting].

[Continue] [Learn about content priority]
```

These friction points do not block the operator. They create one moment of pause and education. Over time, operators who encounter these prompts form more accurate mental models — the friction is itself a training mechanism.

---

## Part 11 — Venue Health Models

---

### 11.1 The Healthy Venue

A healthy venue has:
- Campaigns as the primary content management tool (>80% of screen-time managed via campaigns)
- Active operational overrides under 7 days old on average
- All operational overrides with expiry dates
- No overrides over 90 days old
- No coverage gaps on mandatory content screens (compliance, brand standards)
- Sponsor SOV within contract thresholds
- Emergency system used only for genuine emergencies (clean reason field)
- Configuration created by operators who are still active

**Health grade: A**

---

### 11.2 The Degrading Venue

A degrading venue has:
- Mix of campaigns and direct schedules (60–80% campaign, 20–40% direct)
- Some overrides over 30 days old
- Some overrides without expiry dates
- Campaign fragmentation visible (multiple similar campaigns)
- Sponsor SOV approaching lower threshold
- Priority escalation visible in content items

**Health grade: B–C**
**Intervention type:** Proactive cleanup and operator re-education — no urgency, but don't let it continue.

---

### 11.3 The Entropic Venue

An entropic venue has:
- Direct schedules dominant (>40% of screen-time)
- Multiple overrides over 90 days old, many without expiry
- Orphaned overrides from departed operators
- Campaign fragmentation extensive (many near-duplicate campaigns)
- Priority escalation extensive (most content at maximum priority)
- Emergency tool used for non-emergency operational urgency
- Coverage gaps on some screens
- Sponsor SOV below contract threshold

**Health grade: D–F**
**Intervention type:** Active cleanup engagement — venue manager walkthrough required. The system cannot self-recover from this state; human intervention is necessary.

---

### 11.4 The Unmanaged Venue

An unmanaged venue has:
- No operator logins in the past 30+ days
- All content managed by fallback or by very old configurations from departed operators
- No active campaigns with valid date ranges
- Overrides of unknown origin and unknown purpose

**Health grade: F**
**Intervention type:** Account recovery and fresh configuration. The venue's operational state has effectively reset to an unmanaged state. Entropy cleanup is less relevant than understanding what the venue's current content requirements are.

---

## Appendix A — Entropy Signal to Metric Mapping

For each entropy signal surfaced in the UX, the underlying metric from OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5:

| UX Signal | Metric | Threshold (default) |
|-----------|--------|---------------------|
| Override accumulation | M-01 Override Divergence Rate | >5 active overrides per venue |
| Override aging | M-02 Override Age Distribution | >1 override over 90 days |
| Orphaned overrides | M-03 Override Orphan Rate | Any override from deactivated account |
| Campaign fragmentation | M-04 Campaign Orphan Rate | >2 near-duplicate campaigns |
| Shadow scheduling | M-05 Schedule Fragmentation Index | >10 individual schedules per screen |
| Sponsor SOV drift | M-06 Sponsor SOV Drift | SOV delta >3% below contract |
| Stale rules | M-07 Stale State Ratio | >10% of rules past end date |
| Priority inflation | M-08 Priority Range Width | Range span >50 points |
| Coverage gaps | M-09 Coverage Gap Frequency | Any gap on mandatory-content screens |
| Emergency semantic collapse | M-10 Emergency Semantic Collapse | Any emergency with non-emergency reason language |
| Long-running rules | M-11 Configuration Staleness | Any campaign/override unreviewed >90 days |
| System non-predictability | M-12 Operator Predictability Index | Derived from override density + fragmentation |

Threshold values are configurable per installation. The defaults above represent the recommended starting points based on structural inference. Field validation should inform threshold adjustment.

---

## Appendix B — Entropy Observability Review Cadence

Recommended operator review schedules by role:

| Role | Daily | Weekly | Monthly |
|------|-------|--------|---------|
| Floor Operator | Check Tier 3–4 alerts | — | — |
| Venue Manager | Check Tier 2–4 alerts | Entropy signal summary | Health grade trend, override age review |
| Network Operations | Venue grade overview | Low-grade venue review | Longitudinal health report |
| Org Admin | — | Exception report | Org-wide health trend, compliance coverage |

Automated digests (email/notification) at weekly cadence for Venue Managers, monthly cadence for Org Admins — surfacing only Tier 2+ signals.

---

## Related Documents

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — The entropy signals defined in this document are the primary source of Tier 1–2 signals in the attention tier system. Advisory health signals (venue grade B–C warnings, override accumulation alerts) are Tier 1 in that system; active degradation signals (grade D–F, SOV delivery gaps) are Tier 2. These two documents address the same signals from different angles: this document defines what the signals mean and how they should be visually presented; ATTENTION-ECONOMICS defines how they compete for operator attention, how they are suppressed at fleet scale, and how signal credibility is preserved over time.

---

*End of ENTROPY-OBSERVABILITY-UX-v1.md*
*Document authority: Agent 3 (UX/Design); Agent 2 (CMS) co-authority on entropy metric definitions*
*Entropy metric thresholds require Agent 2 validation before field deployment*
*Advisory vs enforcement philosophy is constitutional — changes require constitutional amendment process*
