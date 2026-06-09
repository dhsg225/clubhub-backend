# ClubHub TV — Multi-Venue Observability v1
# Fleet-Scale Operational Cognition

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATIONAL-WORKSPACES-v1.md, ENTROPY-OBSERVABILITY-UX-v1.md, TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md §2.4, MARKET-VERTICAL-PATTERNS.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Fleet Observability Philosophy

---

### 1.1 Local vs Systemic Problems

When a venue has a content problem, the first question is: is this a local problem (specific to this venue's configuration or operator behavior) or a systemic problem (affecting multiple venues, indicating a platform issue or an organizational pattern)?

Most operational problems in ClubHub TV are local. A stale override at Venue A is a local governance failure. An emergency that wasn't cleared at Venue B is a local operator error. These are individual, addressable, venue-specific issues.

But some operational problems are systemic. If 8 of 12 venues in a regional franchise develop override accumulation patterns in the same quarter, that is not 8 independent failures — it is a systemic training gap or a systemic organizational pattern. If sponsor SOV is below contract at every venue where a specific Venue Manager was deployed, that is an individual operator pattern that requires an organizational response.

**The multi-venue observability system must distinguish local from systemic.** A system that only shows individual venue health hides the patterns that reveal systemic issues. A system that only shows aggregate network health hides the individual venues that need intervention.

The fleet observability system must support both levels simultaneously — individual venue resolution and network-level pattern recognition.

---

### 1.2 Operational Pattern Recognition

At fleet scale, patterns become visible that are invisible at the individual venue level. The multi-venue observability system is designed to surface these patterns:

**Temporal patterns:** Multiple venues developing the same entropy pattern in the same time period — suggests a platform change, an organizational process change, or a seasonal operational event.

**Geographic patterns:** Venues in the same region developing similar issues — suggests regional training gaps, regional operational culture, or regional compliance changes.

**Operator patterns:** Venues managed by the same individual developing similar issues — suggests operator-specific training gaps or management style problems.

**Vertical patterns:** All venues of the same type developing similar issues — suggests vertical-specific operational challenges not addressed by current training or tooling.

Pattern recognition at scale is impossible without fleet-level views. The Network Operations Workspace (OPERATIONAL-WORKSPACES-v1.md §2.6) is the surface; this document defines the observability system that powers it.

---

### 1.3 Divergence Visibility

Divergence is the multi-venue analog of entropy. Just as entropy measures how far a single venue has drifted from its intended operational state, divergence measures how far venues in the same organization have drifted from each other.

**Why divergence matters:**
- Organizations with a brand consistency obligation expect all venues to operate within similar content standards. High divergence means the brand experience varies significantly across venues.
- Franchise operations may have specific contractual requirements for operational consistency. High divergence may represent franchise agreement violations.
- Sponsor contracts at the network level assume roughly consistent delivery across venues. High divergence means some venues are over-delivering and some are under-delivering — averaging to contract, but with neither end of the distribution meeting the contract.

**Divergence types:**
- **Health divergence:** Some venues at grade A, others at grade D, within the same organization
- **Content divergence:** Venues running substantially different content despite similar operational mandates
- **Override divergence:** Some venues with zero overrides, others with 20+, within the same franchise
- **Sponsor delivery divergence:** Some venues delivering 27% SOV, others delivering 18%, for the same sponsor contract

---

### 1.4 Entropy Propagation

Entropy in one venue can propagate to others through organizational mechanisms:

**Training propagation:** A Venue Manager who develops incorrect mental models (override addiction, emergency misuse) gets promoted to a regional role and trains venue managers across the region in the same incorrect patterns.

**Process propagation:** An organizational process that encourages override creation ("just add an override to be safe before events") produces override accumulation across all venues in the organization simultaneously.

**Template propagation:** A venue configuration template that includes no expiry defaults on overrides will propagate that pattern to every venue where the template is applied.

The fleet observability system must surface these propagation patterns so they can be addressed at the organizational level rather than requiring intervention at each venue individually.

---

## Part 2 — Multi-Venue Visibility Models

---

### 2.1 Regional Views

The regional view groups venues by geography, providing a spatial understanding of operational health distribution.

**Regional health map:**

```
[ORG_NAME] — Regional Health Overview

  Region: NSW/ACT (12 venues)
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │    [A]Sydney CBD  [A]Parramatta                        │
  │         [B]Randwick                                     │
  │    [A]Bondi                                            │
  │                [C]Penrith  ←── declining               │
  │              [D]Blue Mountains ←── needs attention     │
  │                                                         │
  │  [B]Canberra CBD  [A]Civic                             │
  │       [C]Woden                                         │
  └─────────────────────────────────────────────────────────┘

  Region average: B grade
  Attention needed: 2 venues (Penrith C↓, Blue Mountains D↓)
  Pattern: Western Sydney venues showing decline this quarter
```

**Geographic clustering signal:** Western Sydney venues declining together suggests a regional pattern worth investigating — same regional manager? Same regional training delivery? Same regional compliance change?

---

### 2.2 Venue Clustering

Venues can be clustered by multiple operational dimensions. Each clustering reveals different patterns:

**Vertical clustering (by venue type):**

```
Golf Clubs (8 venues)     Hotels (5 venues)    Licensed Clubs (12 venues)
  Grade A: 3 venues         Grade A: 3 venues     Grade A: 8 venues
  Grade B: 4 venues         Grade B: 2 venues     Grade B: 2 venues
  Grade C: 1 venue          Grade C: 0 venues     Grade C: 1 venue
  Grade D: 0 venues         Grade D: 0 venues     Grade D: 1 venue ← attention

Pattern: Licensed clubs have more grade D venues than other verticals
→ Check: is this a licensed club-specific operational pattern?
```

**Operator clustering (by assigned Venue Manager):**

```
Venues managed by [MANAGER_A] (6 venues):
  Average grade: C  ← below organization average (B)
  Common pattern: Override accumulation, low expiry rate

Venues managed by [MANAGER_B] (6 venues):
  Average grade: A  ← above organization average (B)
  Common pattern: High campaign adoption, low override count
```

This clustering surfaces an operator-pattern diagnosis: [MANAGER_A]'s venues consistently show override accumulation. This is an individual training/coaching need, not a venue problem.

---

### 2.3 Venue Health Map

The fleet-level venue health map provides a scannable grid of all venues with their key indicators:

```
Fleet Health Overview — [ORG_NAME] — 2026-05-22

  VENUE                  GRADE  TREND  OVERRIDES  ALERTS  LAST ACTIVITY
  ─────────────────────────────────────────────────────────────────────
  [VENUE_A]              A      →      2          0       2h ago
  [VENUE_B]              A      ↑      1          0       4h ago
  [VENUE_C]              B      →      5          1⚡     1h ago
  [VENUE_D]              B      ↓      8          2⚡     3h ago  ← declining
  [VENUE_E]              C      ↓      14         1⚠     6h ago  ← needs attention
  [VENUE_F]              C      →      11         0       2h ago
  [VENUE_G]              D      ↓      22         3⚠     12h ago ← urgent
  [VENUE_H]              F      ↓      31         5⚠     2d ago  ← critical
  ─────────────────────────────────────────────────────────────────────

  Sort by: [Grade ↕] [Override count ↕] [Trend ↕] [Alert count ↕]
  Filter: [Grade: all] [Has alerts] [Declining only]
```

**Sort and filter defaults:** Sorted by grade (worst first) — the venues needing most attention are always at the top without manual sorting. The NOC operator's first view shows the most critical venues.

---

### 2.4 Sponsor Fulfillment Map

A network-level view of sponsor SOV delivery across all venues where a sponsor has contracted placement:

```
[SPONSOR_X] — Network Fulfillment
Contract: 25% SOV across 8 venues
Period: 2026-01-01 → 2026-06-30

  VENUE                  CONTRACTED  DELIVERED  STATUS
  ────────────────────────────────────────────────────
  [VENUE_A]              25%         26.1%      ✓ Delivering
  [VENUE_B]              25%         24.8%      ✓ Near threshold
  [VENUE_C]              25%         23.2%      ⚡ Below threshold
  [VENUE_D]              25%         19.4%      ⚠ Shortfall
  [VENUE_E]              25%         17.8%      ⚠ Significant shortfall
  [VENUE_F]              25%         25.2%      ✓ Delivering
  [VENUE_G]              25%         24.9%      ✓ Near threshold
  [VENUE_H]              25%         12.1%      ⚠ Critical shortfall
  ────────────────────────────────────────────────────
  Network average:        25%         21.7%      ⚠ Below network average

  → [VENUE_D], [VENUE_E], [VENUE_H] require investigation
  Primary cause identified: Override accumulation at 3 venues
```

This view enables sponsor account management at network level — a Sponsorship Manager or Org Admin can see which venues are failing to deliver and drill into each one to find the specific suppressor.

---

### 2.5 Operational Consistency Scoring

**Definition:** A metric measuring how consistently the same operational standards are being applied across all venues in the organization.

**Components:**
- Override age distribution consistency: are all venues maintaining similar override ages?
- Campaign adoption rate consistency: are all venues using campaigns at similar rates?
- Emergency usage consistency: are all venues using the emergency system for genuine emergencies at similar rates?
- Expiry rate consistency: are all venues setting expiry dates on overrides at similar rates?

**Consistency score display:**

```
Operational Consistency — [ORG_NAME]

  Overall consistency: 71%  ⚡ Moderate variance

  By dimension:
  Override governance:  58%  ⚠ High variance — some venues excellent, some poor
  Campaign adoption:    82%  ✓ Good consistency
  Emergency discipline: 91%  ✓ Excellent consistency
  Expiry compliance:    54%  ⚠ High variance

  Highest-variance venues: [VENUE_H], [VENUE_G], [VENUE_E]
  (These venues diverge most from organizational average)
```

---

## Part 3 — Cross-Venue Anomaly Detection UX

---

### 3.1 Divergence Hotspots

A divergence hotspot is a venue (or cluster of venues) that is significantly different from similar venues in the organization — worse health, higher override count, lower campaign adoption, more entropy signals.

**Hotspot identification algorithm:** Compare each venue's key metrics against the median for similar venues (same vertical, same region, same operational profile). Venues more than 1.5 standard deviations from the median on two or more dimensions are flagged as hotspots.

**Hotspot display:**

```
⚠ Divergence Hotspots — [ORG_NAME]

  [VENUE_H] — significantly below peer group
  Comparison: Licensed Clubs in [Region], average grade B
  Metrics vs peer average:
    Override count: 31 vs peer avg 6  (+417%)
    Campaign adoption: 23% vs peer avg 78%  (-70%)
    Expiry compliance: 8% vs peer avg 72%   (-89%)

  This venue is an outlier across multiple dimensions.
  [Schedule intervention] [View venue details]
```

---

### 3.2 Override Outliers

At fleet scale, venues with unusually high override counts can be identified relative to their peer group:

```
Override Count Analysis — [ORG_NAME]

  Fleet average: 7.3 overrides per venue
  Fleet median: 5 overrides per venue

  Outliers (> 2x median):
  [VENUE_H]: 31 overrides  ⚠ (6.2x median)
  [VENUE_G]: 22 overrides  ⚠ (4.4x median)
  [VENUE_E]: 14 overrides  ⚡ (2.8x median)

  These venues have unusual override accumulation relative to peers.
  This may indicate: operator training gaps, process issues, or complex
  operational circumstances requiring investigation.
```

---

### 3.3 Unstable Venue Identification

Venues where the Live Operations Workspace would show frequent state changes — many transitions per day, many concurrent overrides, rapidly changing effective state — are operationally unstable.

**Stability index:** Computed from transition frequency, concurrent override count, and override age distribution. Low stability = high operational complexity.

**Unstable venue signal:**

```
⚡ Operationally Complex Venues

  [VENUE_E] — High operational complexity
  Indicators:
  → 34 content transitions yesterday (fleet avg: 8)
  → 14 concurrent overrides
  → 3 overrides at LEVEL_1 competing for the same screens

  This may indicate: too many competing rules, fragmented configuration,
  or active event operations. Investigate to determine if intervention needed.
```

---

### 3.4 Sponsorship Risk Regions

Geographic or organizational clusters where sponsor delivery is below contract threshold across multiple venues:

```
Sponsorship Risk — [SPONSOR_X]

  At-risk venues: 3 of 8 contracted venues
  Geographic pattern: Western region (3 of 4 western venues below threshold)

  Western region venues:
  [VENUE_D]: 19% SOV  ⚠ (contract: 25%)
  [VENUE_E]: 18% SOV  ⚠ (contract: 25%)
  [VENUE_H]: 12% SOV  ⚠ (contract: 25%)

  Common factor identified: Western region Venue Manager [MANAGER_A]
  manages all three venues. Override accumulation pattern consistent
  across all three.

  Recommended action: Regional operational review with [MANAGER_A]
```

---

### 3.5 Emergency Overuse Clusters

When multiple venues in the same cluster show unusually high emergency activation frequency, this is Emergency Semantic Collapse (Entropy Pattern) at organizational scale:

```
⚡ Emergency Usage Alert — [ORG_NAME]

  Expected: Emergency content activated for safety/compliance reasons only
  Fleet average: 0.8 emergency activations per venue per month

  Above-average venues:
  [VENUE_A]: 4.2 activations/month  ← review emergency reason fields
  [VENUE_B]: 3.8 activations/month  ← review emergency reason fields
  [VENUE_C]: 3.1 activations/month

  Review of reason fields for [VENUE_A] and [VENUE_B]:
  → 67% of activations contain operational language (not safety language)
  → Probable: Emergency tool used for operational urgency

  Pattern suggests: Regional training gap on emergency vs override distinction
```

---

## Part 4 — Executive Operational Views

---

### 4.1 Abstraction Without Blindness

The executive oversight view must abstract operational complexity into business-relevant signals without hiding the operational reality beneath. The risk of excessive abstraction: executives who see a clean dashboard believe operations are clean. When a systemic problem becomes visible, they are blindsided — the dashboard "lied."

**Design principle: abstraction should never exceed what is recoverable.** The executive view shows high-level summaries, but every summary must be drillable — the executive (or their operational delegate) must be able to see exactly what is behind each headline number.

```
Network Health Summary — [ORG_NAME]

  26 venues total

  Operating normally:  18 venues (69%)
  Needs attention:      6 venues (23%)   ← These exist. You can see them.
  Urgent action needed: 2 venues (8%)   ← These need you.

  [See all venues]
```

The summary does not say "most venues are fine" — it says exactly how many are fine and exactly how many are not. The executive is invited to look at the not-fine venues, not encouraged to feel reassured and look away.

---

### 4.2 Trust-Preserving Summarization

Summary numbers must be computed consistently and labeled clearly so that executives can track them over time and trust that changes in the numbers reflect real operational changes.

**Consistency requirements:**
- Health grades computed from the same entropy metric thresholds every time
- SOV delivered numbers computed from the same methodology every period
- Comparisons (this month vs last month) based on the same scope

**Label requirements:**
- "Venues operating normally" must define what "normally" means (grade A or B)
- "Sponsor contracts meeting SOV" must define the threshold (within 2% of contracted)
- "Active incidents" must define what counts as an incident (Tier 3+ alerts)

**Trust is built through definitional consistency.** Executives who receive consistently defined metrics can track trends. Executives who receive metrics with changing definitions cannot evaluate whether changes are real or methodological.

---

### 4.3 Operational Health Narratives

In addition to metrics, the executive view provides a brief narrative summary — a paragraph that contextualizes the current health state:

```
Operational Summary — Week of 2026-05-19

This week, 2 venues require attention: [VENUE_G] and [VENUE_H].
Both venues have accumulated significant override debt (22 and 31 overrides
respectively) over the past 90 days. Venue Managers have been notified and
cleanup interventions are scheduled for next week.

Sponsor delivery across the network is averaging 23.1% vs contracted 25%.
The shortfall is concentrated in 3 venues in the western region, where override
accumulation is suppressing sponsor content. A regional operational review is
scheduled with regional manager [MANAGER_A] on 2026-05-28.

No active emergencies. No compliance content failures.
```

The narrative is generated by the system from operational data and reviewed/annotated by the NOC operator before delivery. It is not automated prose — it is a structured interpretation of the week's events, written for a business audience.

---

### 4.4 Fleet Drift Visibility

For executives responsible for long-term operational governance, the fleet drift view shows whether the network is getting healthier or less healthy over time:

```
Network Health Trend — Last 12 Months

  Grade A venues:  ████████████████████████████████▄▄▄▄▄▄▄  (declining)
  Grade B venues:  ████████████████████████████████████████  (stable)
  Grade C venues:  ████████░░░░░░░░░░░░░░░░░░░░░░░▄▄▄▄▄▄▄▄  (increasing)
  Grade D/F venues: ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▄▄  (increasing)

  12-month trend: Moderate degradation
  Grade A/B percentage: 78% → 62%  (-16%)

  Primary driver: Override accumulation across new venues onboarded Q3/Q4
  Recommendation: Review onboarding process and first-month operator training
```

Fleet drift over time is the executive's primary governance signal. Degradation across a quarter is a management-attention item. Degradation across a year requires organizational process review.

---

## Part 5 — Temporal Fleet Analysis

---

### 5.1 Venue Trend Evolution

Individual venue trends, viewed across all venues simultaneously, reveal organizational patterns:

**Cohort analysis:** Group venues by onboarding date and compare health grade trajectories:

```
Health Trajectory by Onboarding Cohort

  Venues onboarded Jan–Mar 2026 (8 venues):
  Month 1:  ████████  All grade A–B
  Month 2:  ███████░  7/8 grade A–B, 1 grade C
  Month 3:  ██████░░  6/8 grade A–B, 2 grade C
  Month 4:  █████░░░  5/8 grade A–B, 3 grade C
  Month 5:  ████░░░░  4/8 grade A–B, 4 grade C (current)

  Venues onboarded Jul–Sep 2025 (6 venues):
  Month 1:  ██████    All grade A–B
  Month 2:  ██████    All grade A–B
  ...
  Month 12: ████░░    4/6 grade A–B, 2 grade C (stable from month 6)
```

The cohort analysis shows that the 2026 onboarding cohort is degrading faster than the 2025 cohort did. This is a quality-of-onboarding signal — something in the 2026 onboarding process is producing operators who accumulate entropy faster.

---

### 5.2 Entropy Trajectories

At fleet scale, entropy trajectories show whether the network's operational burden is increasing or decreasing overall:

```
Fleet Entropy Trajectory — Last 24 Months

Total operational debt (override-months accumulated across all venues):

Month 1:  ████  (new platform, all venues clean)
Month 6:  █████████  (normal operational accumulation)
Month 12: █████████████  (some cleanup, but accumulation faster)
Month 18: █████████████████████  (accumulation accelerating)
Month 24: ████████████████████████████  (current — high fleet entropy)

Without intervention, trajectory suggests:
  → 40% of venues will be grade C or below by month 30
  → Sponsorship delivery may fall below network average contract by month 28

Recommended: Fleet-wide cleanup campaign + operator re-certification program
```

The trajectory visualization makes the extrapolated risk concrete. Without this view, the accumulated entropy is visible only as individual venue problems — each manageable, but collectively indicating a fleet-wide trend that requires organizational response.

---

### 5.3 Seasonal Operational Behavior

Some operational patterns are seasonal — they appear at the same time each year and should be anticipated, not discovered:

```
Seasonal Pattern Analysis — [ORG_NAME]

  Recurring Q4 pattern (November–January):
  → Override count increases 40% above annual average
  → Explanation: Holiday event scheduling drives high override creation
  → Risk: Post-holiday override cleanup often incomplete

  Recommendation: Pre-configure Q4 override cleanup workflow:
  → Schedule cleanup review for all venues in January
  → Set mandatory expiry on all Q4 event overrides (max 60 days)
  → Alert NOC if override count doesn't decline by 20% in January

  Recurring Q2 pattern (April–June):
  → Golf club venues have high tournament traffic
  → Override count spikes on tournament days
  → SOV shortfalls for non-tournament sponsors common

  Recommendation: Pre-configure tournament override templates with
  7-day expiry and scheduled cleanup review 48h post-tournament.
```

Seasonal patterns inform proactive operational planning — the organization can prepare for known high-entropy periods rather than reacting to them.

---

### 5.4 Intervention Trend Analysis

Fleet-level tracking of interventions (when operators cleaned up, when entropy was addressed) shows whether the organization is becoming more or less proactive over time:

```
Intervention Patterns — [ORG_NAME] — Last 12 Months

  Reactive interventions (triggered by alerts, sponsor complaints, incidents):
  Q1: 84% of interventions reactive
  Q2: 76% of interventions reactive
  Q3: 68% of interventions reactive
  Q4: 71% of interventions reactive (slight regression)

  Proactive interventions (scheduled cleanup, periodic reviews):
  Q1: 16%
  Q2: 24%
  Q3: 32%
  Q4: 29% (slight regression)

  Trend: Moving toward more proactive operations, but Q4 regression
  suggests the holiday period is creating reactive patterns.
```

The intervention trend is a measure of organizational operational maturity — as the organization matures, a higher proportion of interventions should be proactive (scheduled cleanup, periodic reviews) rather than reactive (responding to alerts and complaints).

---

## Part 6 — Human Factors

---

### 6.1 Why Executives Over-Trust Dashboards

Executive decision-makers are trained to trust aggregated data. A dashboard number represents a complex underlying reality distilled to a single figure — the executive trusts the distillation process.

This trust is appropriate when the distillation is accurate. It becomes dangerous when:
- The distillation methodology changes without disclosure
- Individual extreme values are averaged away
- The metric measures what was configured to happen, not what actually happened
- The dashboard shows a moment-in-time snapshot treated as a trend

**Design response:** Every executive dashboard metric must have a definition link (what exactly does this number mean?), a methodology link (how was it computed?), and a drill path (show me the individual venues behind this aggregate). The goal is not to make executives suspicious of their dashboards — it is to make the dashboards genuinely trustworthy.

---

### 6.2 Why Abstraction Can Hide Instability

The greatest risk of multi-venue abstraction is averaging. A fleet average health grade of "B" can be produced by 20 grade-A venues and 6 grade-D venues. The average looks good. The distribution reveals a serious problem.

**Design response:** Executive views must show distribution, not just average. "Average grade B" must be shown alongside the distribution of venues by grade. The 6 grade-D venues must not be invisible behind the average.

The "abstraction without blindness" principle (§4.1) is the specific design response to this human factor.

---

### 6.3 Why Operational Narratives Matter

Numbers are necessary but not sufficient for executive operational understanding. Executives make decisions based on stories — they need to understand not just what the numbers are but why they are what they are and what should be done.

**The narrative gap:** A dashboard showing "3 venues below sponsor SOV contract" leaves executives with questions: Is this a recurring pattern or a new problem? Is there a root cause we can address? What will happen if we don't intervene? What does intervention look like?

The operational health narrative (§4.3) answers these questions. It is not a replacement for the dashboard — it is the interpretive layer that makes the dashboard actionable.

---

## Part 7 — Scaling Risks

---

### 7.1 Semantic Fragmentation

As organizations grow and operate across different regions and verticals, the vocabulary and practices used to describe operations may fragment. "Override" means something different to a golf club operator trained in 2024 than to a licensed club operator trained in 2026 with updated training materials.

**Design response:** The domain language glossary (DOMAIN-LANGUAGE-GLOSSARY.md) must be the single source of truth for terminology across all venues, all roles, and all training materials. The multi-venue observability system must use this vocabulary consistently — it cannot use regional or informal terminology.

When the platform updates terminology (improving clarity, adding new concepts), all venues must receive the update simultaneously through the in-product language updates (REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md §7.3).

---

### 7.2 Local Workaround Cultures

Individual venues develop local workarounds — informal practices that work for that venue's specific operational context. A sports bar might develop a practice of "always put an override before any match night, just in case." A golf club might develop a practice of using emergency content for tournament leaderboards.

These local cultures are:
- Often internally consistent and effective for the venue in the short term
- Often entropy-generating in the medium term
- Often inconsistent with organizational governance standards
- Often invisible to Network Operations until they produce a visible failure

**Detection signal:** The divergence hotspot detection (§3.1) identifies venues with significantly different operational patterns from their peer group. These are the venues most likely to have local workaround cultures.

**Response:** The fleet observability system surfaces the divergence; Network Operations investigates; the response is education and process improvement, not enforcement. Local workarounds form for a reason — they are usually the symptom of a gap in the official workflow.

---

### 7.3 Regional Override Drift

When override accumulation develops in a region, it creates a regional operational culture where high override counts feel normal. New operators onboarded into this culture learn the regional norm, not the organizational standard.

**Detection:** The regional override count analysis (§3.2) surfaces this — regions with consistently high override counts relative to other regions are showing regional drift.

**Response:** Regional-level override audit and cleanup, combined with targeted regional training. The goal is to reset the regional norm to the organizational standard.

---

### 7.4 Operational Inconsistency Expansion

As organizations grow by adding venues, the variance in operational quality typically increases before it decreases. New venues are onboarded imperfectly, develop local patterns, and diverge from established venues.

**Managing expansion inconsistency:**
- Consistent onboarding process and first-month monitoring for all new venues
- Early entropy monitoring with intervention triggers (not waiting for grade D to intervene)
- Mentor pairing: new venues paired with a well-governed established venue for the first 90 days
- Expansion cohort analysis (§5.1): compare new venue trajectories to established venue trajectories; intervene early when new cohorts diverge

---

*End of MULTI-VENUE-OBSERVABILITY-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Fleet health computation: Agent 2 (CMS) data model requirement*
*Cross-venue aggregation APIs: Agent 1 (Platform) requirement*
*Regional management data model: Agent 2 (CMS) design responsibility*
