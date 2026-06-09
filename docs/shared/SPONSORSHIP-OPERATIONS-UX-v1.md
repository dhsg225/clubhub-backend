# ClubHub TV — Sponsorship Operations UX v1
# Human-Sponsorship Operational Visibility

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md §2.3, ENTROPY-OBSERVABILITY-UX-v1.md §6, SCREEN-INTROSPECTION-SYSTEM-v1.md §3.4
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Sponsorship Operational Philosophy

---

### 1.1 Why Sponsorship Systems Fail

Most CMS systems fail sponsorship operations through one or more of four systemic failures:

**Failure 1 — Visibility gap:** The Sponsorship Manager can see that sponsor content is configured but cannot see whether it is actually winning on the contracted screens. "Active" campaigns and "delivered" content are treated as equivalent. They are not.

**Failure 2 — Suppression invisibility:** Operational overrides suppress LEVEL_4 sponsor content silently. The override was created for an unrelated reason (event management, staff content). The operator who created it didn't know — and wasn't told — that it would suppress sponsor content. The Sponsorship Manager doesn't know either until the SOV audit.

**Failure 3 — Fulfillment unverifiability:** When a sponsor asks "can you prove my content played?", the answer is typically either a screenshot, a verbal assurance, or an absence of evidence. None of these are adequate for commercial accountability.

**Failure 4 — Forecasting absence:** The Sponsorship Manager cannot forecast what SOV the sponsor will receive before the delivery period. They find out after the fact. If SOV is below contract, they have already failed to fulfill their obligation.

The ClubHub TV sponsorship operations system is designed to eliminate all four failures.

---

### 1.2 Sponsor Content as a Contract

Every sponsor relationship in ClubHub TV is a contract. The contract has:
- **Contracted parties:** The venue / organization and the sponsor
- **Contracted terms:** SOV percentage, screen scope, time windows, content categories
- **Contract duration:** Start date, end date
- **Delivery obligations:** What the venue is committing to deliver

The CMS must model sponsor content as a contract — not just as a content configuration. The distinction is operational: a content configuration can be ignored without consequence; a contract has fulfillment obligations. The UX must communicate the contractual nature of sponsor content at every relevant interaction.

**Practical implications:**
- SOV tracking is not a reporting feature — it is a contract compliance tool
- Suppression of sponsor content is not just a resolution event — it is a potential contract liability
- Proof of play is not an optional audit feature — it is a contractual deliverable

---

### 1.3 The Resolution Reality for Sponsor Content

Sponsor content operates at LEVEL_4 in the PRE resolution hierarchy — below Emergency (LEVEL_0), Operational Override (LEVEL_1), Scheduled Override (LEVEL_2), and Campaign (LEVEL_3).

This means sponsor content can be suppressed by any of those four higher levels. A venue with heavy override use will have sponsor content chronically suppressed during override windows — even though the sponsor is contracted to receive airtime during those windows.

**The Sponsorship Manager typically does not understand this resolution reality.** They see their content configured and assume it is delivering. The operations UX must make the resolution reality visible to them without requiring them to understand the PRE architecture.

**Plain language translation for Sponsorship Managers:**
"Your sponsor content plays during windows when no other priority content is scheduled. Events, special promotions, and manual overrides can displace it. We track exactly how much airtime your sponsor receives and alert you when it falls below the contracted level."

---

## Part 2 — Effective vs Contracted Exposure

---

### 2.1 The Three Exposure Numbers

Every sponsor contract has three distinct exposure numbers, all of which are operationally significant:

**Contracted SOV:** What the sponsor paid for. The contract obligation. Expressed as a percentage of total screen time on contracted screens.

**Configured SOV:** What the current CMS configuration would deliver if all campaigns run as configured and no overrides suppress sponsor content. Computed by simulating the PRE across the contract period with current configuration.

**Delivered SOV:** What the delivery log confirms was actually delivered to devices. This is the verifiable number — the proof of play.

**The three numbers diverge in two dangerous ways:**
- Configured ≠ Contracted: Configuration is below the contracted threshold. This is a fulfillment gap that will produce shortfall.
- Delivered ≠ Configured: Content is configured to deliver but devices are not confirming delivery. This may indicate device offline issues or network problems.

**UX requirement:** All three numbers must be visible in the Sponsorship Operations Workspace for every active sponsor contract. Showing only one number is operationally incomplete.

---

### 2.2 SOV Calculation Scope

SOV is calculated within a defined scope:

- **Screen scope:** Which screens count toward the contracted SOV? (Contracted screens only, not all venue screens)
- **Time scope:** Which hours of the day count? (If contract specifies "business hours 09:00–22:00," only those hours count)
- **Content category:** Does SOV count all content, or only editorial content? (A sponsor at 25% SOV of editorial content means 25% of non-emergency, non-operational content)

**UX requirement:** The SOV calculation scope must be visible in the sponsor detail view. Operators and Sponsorship Managers must be able to see exactly how the SOV percentage is being calculated — which screens, which hours, against what denominator.

---

### 2.3 SOV Display Model

```
[SPONSOR_NAME] — Contract Period: 2026-01-01 to 2026-06-30

CONTRACT OVERVIEW
─────────────────────────────────────────────────────────────────
Contracted SOV:    25%   on Bar Area screens (B1–B4), daily 09:00–22:00
Configured SOV:    23%   ⚡ Slightly below contract
Delivered SOV:     22%   (7-day rolling)

CONTRACT PROGRESS
─────────────────────────────────────────────────────────────────
Days elapsed:      142 of 181
Total contracted:  1810 hours
Total configured:  1658 hours  ⚡ 152h below contract
Total delivered:   1589 hours  (confirmed delivery log)

TREND
─────────────────────────────────────────────────────────────────
Past 7 days:      19%  ⚠ Below threshold (contract requires 25%)
Past 30 days:     22%  ⚡ Slightly below
Past 90 days:     24%  ✓ Within contract

Active suppressors:
  OVERRIDE_004 active on B1, B2 (47 days) — suppressing ~3% SOV daily
  [Review override]
```

---

## Part 3 — Sponsor Visibility Forecasting

---

### 3.1 Forward Projection

Sponsor visibility forecasting answers: "Based on current configuration, what SOV will this sponsor receive over the next [period]?"

This transforms the sponsorship management experience from reactive (finding out after the fact that SOV was below contract) to proactive (knowing in advance that current configuration will produce shortfall).

**Forecast model:**
1. Take all currently active sponsor content rules (LEVEL_4 injections) for this sponsor
2. Simulate the PRE across the forecast period with current configuration
3. Account for known future changes: scheduled override expirations, campaign date ranges, known events
4. Produce a projected SOV with confidence range

**Forecast output:**

```
SOV Forecast — [SPONSOR_NAME] — Next 30 days

Projected SOV: 22% ± 2%   (contract requires 25%)
  ⚠ Current trajectory is below contract threshold

Breakdown:
  Without Override_004 active: projected 25% ✓
  Override_004 expiry (2026-06-01): SOV recovers after expiry

  Event windows (reduced SOV expected):
  2026-05-25: Tournament Day — sponsor content suppressed 09:00–18:00
  2026-06-07: Club event — sponsor content suppressed 14:00–22:00

Actions to reach contract SOV:
  → Remove Override_004 (+3% projected SOV)
  → Add sponsor content to event coverage windows
  → Extend daily delivery window by 1 hour (+1% projected SOV)
```

---

### 3.2 Scenario Comparison

The Sponsorship Manager or Venue Manager may want to compare two configuration scenarios to find the one that meets contract SOV:

```
Scenario Comparison for [SPONSOR_NAME]

               Current     Remove      Extend
               Config      Override_4  Hours
────────────────────────────────────────────────
Projected SOV    22%         25% ✓      23%
Contract req.    25%         25%        25%
Status           ⚠ Below    ✓ Meets    ⚡ Close
Config effort    —           Low        Medium

Recommended: Remove Override_004 [See impact]
```

This decision-support surface translates configuration choices into contract outcomes — the language Sponsorship Managers need.

---

## Part 4 — Suppression Visibility

---

### 4.1 Active Suppression Identification

Any operator in the Sponsorship Operations Workspace must be able to see, for each sponsored content slot, exactly what is suppressing it when it is not winning.

**Suppression identification surface:**

```
[SPONSOR_NAME] — Screen-by-Screen Status

  SCREEN_B1  ⚠ SUPPRESSED
    Currently showing: [CONTENT_X] via Override_004 (LEVEL_1)
    Override created: 47 days ago by [OPERATOR_A]
    Override expires: 2026-06-01
    [Review this override]

  SCREEN_B2  ⚠ SUPPRESSED
    Currently showing: [CONTENT_X] via Override_004 (LEVEL_1)
    Same override affecting B1 and B2

  SCREEN_B3  ✓ DELIVERING
    Sponsor content playing via LEVEL_4 injection
    Current SOV this week: 25.3%

  SCREEN_B4  ✓ DELIVERING
    Sponsor content playing via LEVEL_4 injection
    Current SOV this week: 24.8%
```

This per-screen view is accessible from the Sponsorship Operations Workspace with a single tap on the sponsor's SOV summary.

---

### 4.2 Suppression Categories for Sponsor Content

Sponsor content at LEVEL_4 is suppressed by any active higher-level rule. Suppression reasons, in plain language for Sponsorship Managers:

| Suppressor | Plain language | Typical duration | Action |
|------------|----------------|-----------------|--------|
| Emergency (LEVEL_0) | "Emergency content is active on these screens" | Hours | Check when emergency clears |
| Operational Override (LEVEL_1) | "A manual override is covering these screens" | Days–weeks | Review override with venue |
| Scheduled Override (LEVEL_2) | "A scheduled event override is covering these screens" | Specific window | Check when scheduled override ends |
| Campaign (LEVEL_3) | "A content campaign is covering these screens" | Days–weeks | Review campaign targeting |

**Note:** LEVEL_3 Campaign at a SPEC_3+ specificity can suppress LEVEL_4 sponsor content. This is less common but can occur in high-specificity configurations.

---

### 4.3 Suppression Alerts

When sponsor content falls below a defined threshold due to active suppression, alerts surface proactively:

| Threshold | Alert type | Delivery |
|-----------|-----------|----------|
| SOV < contract − 5% for > 1 day | ⚠ HIGH — Contract at risk | In-app + email to Sponsorship Manager |
| SOV < contract − 3% for > 1 day | ⚡ MEDIUM — Below threshold | In-app notification |
| SOV < contract − 1% | ℹ LOW — Approaching threshold | In-app in Sponsorship workspace |

Alerts include the identified suppressor and a direct action path: "Override_004 is causing this shortfall. [Review the override]"

---

## Part 5 — Sponsorship Drift Detection

---

### 5.1 SOV Trend Analysis

A sponsor may be receiving above-contract SOV for months and then drift below threshold due to accumulated operational changes — new overrides, modified campaign targeting, event scheduling. Drift is gradual; the individual change that caused it may be invisible.

**Drift detection surface:**

```
[SPONSOR_NAME] — SOV Trend (90 days)

  ████████████████████████████████▄▄▄▄▄▃▃▃▂▂▂
  28% 27% 26% 25% 25% 24% 23% 22% 21% 20% 19%  ← 10-week trend

  Trend: DECLINING ↓
  Rate: approximately -1% per week
  At current rate: below contract threshold in 2 weeks

  Causal events in this period:
  2026-03-15: Override_004 created on B1, B2 (-3% impact)
  2026-04-02: Campaign A scope modified (excluded B3) (-2% impact)
  2026-04-20: New event scheduling campaign added (competing for airtime) (-1% impact)

  [See full causal timeline]
```

The causal events timeline is the key surface — it attributes the drift to specific configuration changes, each with its operator and timestamp. This enables the Sponsorship Manager and Venue Manager to have an informed conversation about which changes to address, rather than a generalized "the numbers are down" conversation.

---

### 5.2 Long-Term Fulfillment Tracking

For contracts longer than 3 months, cumulative fulfillment tracking matters. A sponsor who was over-delivered early in the contract may still receive below-contract SOV near the end if the venue's operational patterns have changed.

**Cumulative fulfillment view:**

```
[SPONSOR_NAME] — Contract Fulfillment Progress

  Contract: 2026-01-01 → 2026-06-30 (181 days)
  Elapsed: 142 days (78%)

  Cumulative contracted: 25% × 142 days = 35.5 days of SOV
  Cumulative delivered:  22% average × 142 days = 31.2 days of SOV
  Shortfall to date:     4.3 days of SOV

  To fulfill contract by end date:
  Remaining days: 39
  Required average SOV for remaining period: 31% ← above contract to compensate

  ⚠ This contract cannot be fully fulfilled at current trajectory
  [Discuss remediation with venue manager]
```

This surface converts the abstract SOV percentage into days of content — a concrete, intuitive measure of contract obligation.

---

## Part 6 — Saturation Detection

---

### 6.1 Sponsor Saturation

**Definition:** A situation where a sponsor's content is winning on contracted screens for more than their contracted SOV — potentially at the expense of editorial content, other sponsors, or the venue's own content.

**Why saturation matters:** Over-delivery is not inherently good. Venues often have contractual obligations to maintain editorial content ratios. Sports bars must maintain sufficient sports content. Hotels must maintain brand content. If a sponsor's content saturates a screen, the venue's own content commitments may be violated.

**Saturation detection surface:**

```
[SPONSOR_NAME] — Saturation Check

  Contracted SOV: 25%
  Current SOV: 38% ⚠ Above contracted level

  Possible causes:
  → Sponsor content configured for broader scope than contract specifies
  → Competing sponsors have lower priority, yielding more airtime to [SPONSOR]
  → Campaign configurations not limiting sponsor content to contract windows

  [Review sponsor content configuration]
```

---

### 6.2 Screen Saturation

**Definition:** A single sponsor occupying > 80% of a screen's editorial content time — making the screen feel like a branded display rather than a venue screen.

Per PREVIEW-SYSTEMS-SPEC-v1.md §2.3 (Sponsor Visibility Forecasting — Mode 3): "> 80% SOV warning" is a required UX element.

**UX surface:** In the sponsor content configuration view, when a single sponsor's scheduled content would exceed 80% of a screen's editorial time, a warning appears:

```
⚠ High sponsor saturation detected

  [SPONSOR_NAME] is configured for 84% of Screen B1's editorial time.
  This may feel like branded display rather than venue content.

  Consider:
  → Reducing sponsor content frequency
  → Adding editorial content to balance the screen
  → Confirming this is intentional (branded display is acceptable here)

  [Adjust] [This is intentional]
```

---

## Part 7 — Category Conflict Visibility

---

### 7.1 Competing Sponsor Categories

**Definition:** Two sponsors in the same product/service category (e.g., two beer brands, two betting platforms) contracted for the same screens.

**Why this matters:** Category conflicts may be prohibited by sponsor contracts ("exclusive category rights") or may simply create awkward content adjacency (competitor's brand appearing immediately after a sponsor's content).

**Category conflict detection surface:**

```
⚡ Category conflict detected

  [SPONSOR_A] (Beer — Premium Lager) and [SPONSOR_B] (Beer — Pale Ale)
  are both configured for Screen B1 during the same time windows.

  If [SPONSOR_A] has exclusive category rights for "Beer":
  → [SPONSOR_B] configuration may violate the contract
  → [Review category exclusivity contracts]

  If there is no exclusivity agreement:
  → Content will alternate between sponsors as configured
  → Operators should be aware of content adjacency
```

**Note:** The CMS cannot enforce category exclusivity automatically — it does not have access to contract terms. The category conflict detection surfaces a potential issue for human review. The human (Venue Manager or Org Admin) determines whether the conflict violates a contract.

---

### 7.2 Content Adjacency Awareness

Even when category conflicts are not contractually prohibited, content adjacency matters. A betting platform's advertisement immediately following an anti-gambling responsible gambling message is a negative adjacency. A children's birthday party booking advertisement following liquor promotion content is a negative adjacency.

**Adjacency checking surface (Future Capability — HYPOTHETICAL):**

Content adjacency checking requires semantic content classification — knowing what category each content item belongs to and which adjacencies are problematic. This is identified as a future platform capability. Current implementation focuses on sponsor category detection based on operator-applied tags.

---

## Part 8 — Venue-Specific Sponsorship Reality

---

### 8.1 Vertical-Specific Sponsorship Patterns

Each venue vertical has a distinct sponsorship operational context:

**Licensed Clubs (RSL, Bowling Clubs):** Sponsors are typically long-term relationships with local businesses or national product brands. SOV delivery is relatively stable — few events disrupt the regular schedule. Primary concern: ensuring that compliance content (gaming area mandatory content) does not crowd out sponsor obligations.

**Golf Clubs:** Sponsorship is event-driven. Tournament sponsors receive high visibility during tournament events; their contracted SOV may be concentrated in tournament periods. The Sponsorship Manager needs tournament-period vs non-tournament-period SOV visibility.

**Hotels and Resorts:** Multiple sponsor categories (food & beverage, local attractions, in-hotel services). Each sponsor category has appropriate screens (restaurant sponsors on dining area screens; attraction sponsors on lobby screens). Cross-zone spillover must be prevented.

**Sports Bars:** Sponsor content competes with live sports broadcasts. During match periods, many screens are on live broadcast input (non-ClubHub). Sponsor content may be significantly constrained during the venue's highest-attendance periods.

**Venue-specific context must inform the Sponsorship Operations Workspace layout.** A golf club's Sponsorship Operations Workspace should default to tournament-period views; a sports bar's workspace should surface match-period suppression clearly.

---

### 8.2 Multi-Screen Sponsorship Scenarios

Sponsors contracted across multiple screens or zones may have different effective delivery on each screen. A sponsor contracted for "all bar area screens" may be receiving 28% SOV on B1–B2 but only 19% on B3–B4 due to zone-specific override patterns.

The per-screen SOV breakdown (§4.1) is the primary tool for identifying this variation. Venue-level aggregate SOV may mask screen-level shortfalls.

---

## Part 9 — Event-Night Sponsorship UX

---

### 9.1 Pre-Event Sponsorship Verification

Before a major event (match night, tournament day, club function), the Sponsorship Manager or Venue Manager should verify:

1. All contracted sponsors are configured on contracted screens
2. No active suppressors will prevent sponsor content during the event
3. Event-specific sponsor content (if any) is correctly configured

**Pre-event sponsorship checklist surface:**

```
Pre-Event Sponsorship Check — [EVENT_NAME] — 2026-05-25

Event period: 14:00 – 22:00

  ✓ [SPONSOR_A] configured on B1–B4 during event
  ✓ [SPONSOR_B] configured on B1–B4 during event
  ⚠ [SPONSOR_C] has no configuration for event period — currently using default schedule
  ⚠ Override_007 active during event on B2 — suppressing [SPONSOR_B] during 16:00–18:00

  Recommended actions before event:
  → Configure [SPONSOR_C] for event period
  → Review Override_007: is it still needed during the event?

  [Event starts in: 4 hours 22 minutes]
```

---

### 9.2 Live Event Sponsorship Monitoring

During live events, the Sponsorship Operations Workspace should provide a real-time sponsorship monitoring view — showing which sponsors are currently delivering on which screens, with any active suppression highlighted.

This is the highest-urgency Sponsorship Operations use case: a sponsor representative is on-site during an event and their content is not showing. The Venue Manager needs to diagnose and resolve in under 5 minutes.

**Live event sponsorship monitoring surface:**

```
LIVE — Tournament Day — 2026-05-25 16:43

  [SPONSOR_A] ●●●●○ (75% of contracted screens delivering)
    ✓ B1, B2, B3 — delivering
    ✗ B4 — SUPPRESSED by Event_Override_003

  [SPONSOR_B] ●●○○○ (40% of contracted screens delivering)
    ✓ B1 — delivering
    ✗ B2, B3, B4 — SUPPRESSED by Tournament_Leaderboard override

  [Review Event_Override_003]
  [Review Tournament_Leaderboard override scope]
```

Live monitoring must update on each poll cycle (15 seconds). The delivery status is based on the PRE's current output, not delivery log confirmation — the delivery log has a trailing lag that makes it unsuitable for live monitoring. This distinction must be labeled: "Configured for delivery" (PRE output) vs "Confirmed delivered" (delivery log).

---

## Part 10 — Proof-of-Play Cognition

---

### 10.1 What Sponsors Ask For

When a sponsor contract period ends, or during a periodic fulfillment review, sponsors typically ask one or more of:

1. "What percentage of the contracted time was my content showing?" (SOV)
2. "Can you show me evidence that my content actually played?" (Proof of play)
3. "Was my content showing during the specific events I paid for?" (Event-specific delivery)
4. "How does my content delivery compare to what we contracted?" (Contract vs delivered)

The sponsorship operations system must be able to answer all four questions with documentable evidence, not operator assertion.

---

### 10.2 Proof-of-Play Report Architecture

A proof-of-play report is a structured document combining:

1. **PRE reconstruction:** The system's configured output for each contracted screen during the contract period — what the PRE was set to deliver
2. **Delivery log cross-reference:** Confirmed delivery records from the device manifest polling
3. **Divergence accounting:** Where PRE output and delivery log diverge, and the reason (device offline, HDMI switch, etc.)

**The three-tier structure:**

```
PROOF OF PLAY REPORT
[SPONSOR_NAME] | [VENUE_NAME] | [CONTRACT_PERIOD]

SUMMARY
─────────────────────────────────────────────────────────────────
Contracted SOV:    25% of editorial content on screens B1–B4
Configured SOV:    24.3% (averaged across period)
Confirmed SOV:     23.1% (delivery log confirmation)

Shortfall (contracted vs confirmed): 1.9%
  → Attributable to device offline events: 0.9%
  → Attributable to configuration gap: 1.0%

DETAIL
─────────────────────────────────────────────────────────────────
By screen:
  B1: Contracted 25%, Configured 24.8%, Confirmed 24.1%
  B2: Contracted 25%, Configured 23.7%, Confirmed 22.9%
  B3: Contracted 25%, Configured 24.9%, Confirmed 24.6%
  B4: Contracted 25%, Configured 24.0%, Confirmed 21.1%  ← B4 offline events

By period:
  [Day-by-day breakdown available in full report]

METHODOLOGY STATEMENT
─────────────────────────────────────────────────────────────────
Configured SOV is computed from the PRE's deterministic output using
preserved historical system state. Due to the PRE's constitutional
determinism (INV-3), this reconstruction is guaranteed to be identical
to the original live computation.

Confirmed SOV is computed from manifest delivery confirmation logs.
Divergences between configured and confirmed SOV are attributable to
device connectivity events.

Report generated: 2026-05-22 at 14:37
System version: [VERSION]
```

---

### 10.3 Proof-of-Play Integrity

The proof-of-play report's credibility depends on two properties:

1. **PRE reconstruction accuracy:** Guaranteed by INV-3 determinism. If historical system state is preserved, the reconstruction is identical to the original live output.
2. **Delivery log immutability:** The delivery log must be an append-only, tamper-evident record. No operator action should be able to modify delivery log entries. This is an Agent 1 infrastructure requirement.

The proof-of-play report must include a statement of these properties to allow sponsors to evaluate its credibility.

---

## Part 11 — Sales vs Operations Tension

---

### 11.1 The Core Tension

The sales team contracts sponsor commitments. The operations team delivers them. The tension arises when:

- Sales commits to SOV that operational reality cannot deliver (too many screens already committed, events will suppress the windows)
- Operations accumulates overrides that reduce available sponsor windows without informing sales
- Sales is unaware of which screens already have sponsor commitments when pricing new contracts
- Operations is unaware of which sponsor contracts are active when managing venue content

**This is an information asymmetry problem.** The CMS must provide the information infrastructure for sales and operations to make aligned decisions.

---

### 11.2 Capacity Planning Surface

Before a sponsor contract is finalized, the sales team needs to know: "Is there available capacity for this contract?"

**Capacity check surface (Org Admin / Sales access):**

```
Sponsorship Capacity — [VENUE_NAME] — [PROPOSED_PERIOD]

Contracted obligations on B1–B4 (proposed screens):
  [SPONSOR_A]: 25% SOV — contracted through 2026-06-30
  [SPONSOR_B]: 15% SOV — contracted through 2026-12-31

  Total existing sponsor commitments: 40% of editorial time
  Available editorial time: 60%

Proposed commitment: [NEW_SPONSOR] at 20% SOV
  If added: total sponsor commitments = 60%
  Editorial content remaining: 40%

  ✓ Within capacity (40% editorial remaining)
  Recommended review: confirm no planned events will disrupt delivery
```

The capacity planning surface prevents over-commitment at the contract stage — the most common source of SOV shortfall.

---

### 11.3 Operational Alert to Sales

When the operations team makes a configuration change that will materially affect sponsor SOV (creating an override, modifying a campaign's scope), sales-accessible notifications should reflect this.

**Notification to Org Admin / Sales when override will cause SOV shortfall:**

```
⚠ SOV impact notification

  [VENUE_MANAGER] created Override_004 on Screen B1–B2.
  This override will reduce [SPONSOR_A]'s SOV from 25% to 21%
  during 2026-05-20 to 2026-06-01.

  If the sponsor contract requires 25% SOV:
  → Alert sales team: [EMAIL_CHAIN]
  → Consider scope adjustment: [Review]
```

This notification enables sales to proactively manage sponsor relationships rather than being caught off-guard by delivery shortfalls.

---

## Part 12 — Sponsorship Trust Models

---

### 12.1 How Sponsors Trust the System

A sponsor's trust in the ClubHub TV platform is built on one thing: receiving what they paid for, with evidence.

Trust is earned through:
- Consistent SOV delivery at or above contracted levels
- Proactive communication when delivery is impacted (override created, event causing suppression)
- Credible proof-of-play reports when requested

Trust is lost through:
- SOV shortfall discovered at the audit stage (not communicated proactively)
- Inability to provide proof of play
- Over-commitment (contracted SOV that operational reality cannot deliver)
- Unexplained content adjacency problems (competitor's content playing immediately after sponsor's)

---

### 12.2 How Venues Trust the Sponsorship System

Venue trust in their own sponsorship management depends on:
- Visibility into whether sponsor obligations are being met (the SOV tracking surface)
- Proactive alerts before shortfalls accumulate to contract-violating levels
- Tools to diagnose and fix shortfalls when they occur (suppression identification and action paths)
- Proof-of-play capability that can be shared with sponsors

**Without these tools, venues operate reactively** — they find out about SOV shortfalls when sponsors complain, and they have no way to provide credible proof of delivery. The result is sponsor relationship degradation and lost renewal revenue.

---

### 12.3 The Proof-of-Play as Trust Anchor

The proof-of-play report is the single most important trust artifact in the sponsor relationship. A venue that can provide a credible, system-generated proof-of-play report at any point in the contract period has a fundamentally stronger relationship with sponsors than a venue that provides only operator assurances.

**Design commitment:** The proof-of-play capability is not a premium reporting feature. It is a core operational capability that every venue must have access to, because every venue with sponsor relationships has a commercial need for it.

---

*End of SPONSORSHIP-OPERATIONS-UX-v1.md*
*Document authority: Agent 3 (UX/Design)*
*SOV calculation methodology: Agent 2 (CMS) review required before implementation*
*Delivery log immutability and tamper-evidence: Agent 1 (Platform) requirement*
*Capacity planning surface: requires Agent 2 sponsorship data model*
