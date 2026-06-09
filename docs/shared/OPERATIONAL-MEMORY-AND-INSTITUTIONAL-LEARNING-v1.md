# ClubHub TV — Operational Memory and Institutional Learning v1
# How the Organization Remembers Operational Reality

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md, TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md, INCIDENT-OPERATIONS-UX-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, FAILURE-STORIES.md, OPERATIONAL-INSIGHTS-LOG.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Operational Memory Philosophy

---

### 1.1 Replay as Institutional Memory

Human memory is reconstructive. Organizational memory is worse — it is the aggregate of individual reconstructive memories, filtered through the social dynamics of who tells the story, who is in the room, and what interpretation the organization is motivated to accept.

This produces a systematic pattern: organizations forget the operational lessons they paid the most to learn. The incident that caused three weeks of sponsor disputes. The emergency that persisted for 18 days because no one could remember who activated it. The override cascade that made six venue screens unmanageable for two months. These are exactly the events whose lessons matter most — and they are exactly the events that organizational memory reconstructs inaccurately over time.

**The PRE's deterministic replay is a structural solution to organizational memory failure.** Every past operational event, every configuration state, every resolution decision is preserved and reconstructible. The system does not forget. It cannot reconstruct with bias. It cannot revise history to protect someone.

But replay is passive — it can only answer the questions it is asked. The operational memory system is the active layer that asks the right questions at the right times, preserves the lessons in accessible form, and surfaces them when they are most relevant.

**Replay is the raw material. Operational memory is the system that makes replay useful over years.**

---

### 1.2 Anti-Amnesia Systems

Organizational amnesia follows a predictable pattern:

1. Incident occurs — lessons are fresh, understanding is high
2. Incident is resolved — immediate pressure is gone, lessons begin to fade
3. Weeks pass — the incident is remembered but details are uncertain
4. Months pass — the incident is mentioned occasionally as context for decisions
5. Staff turns over — the people who experienced the incident have moved on
6. Years pass — the incident is folklore: "I heard there was a problem once with overrides"
7. The same type of incident recurs — no one recognizes the pattern

Anti-amnesia systems interrupt this decay cycle at multiple points:

- **At incident resolution:** Immediately capture the lessons while they are fresh (incident postmortem archive)
- **At 30/90 days:** Review the incident resolution — are the lessons still being applied?
- **At operator onboarding:** New operators receive the relevant incident history for their venue
- **At pattern recurrence:** When the system detects a pattern resembling a past incident, surface the relevant history

---

### 1.3 Operational Anthropology Preservation

The ClubHub TV platform's operational anthropology — the documented knowledge about how human operators actually behave, what mistakes they make, what workarounds they develop, what mental models they hold — is as important as the technical documentation.

This knowledge is concentrated in documents like:
- OPERATOR-COGNITIVE-MODELS-v1.md: why operators behave as they do
- FAILURE-STORIES.md: the specific patterns of failure that have been observed
- OPERATIONAL-INSIGHTS-LOG.md: the accumulated operational intelligence about system-venue interactions

These documents are not static. As the platform deploys to more venues, as more incidents occur, as more operator behavior is observed, these documents must grow. The operational anthropology must be actively maintained — not as a historical archive, but as a living body of knowledge that shapes current design decisions.

**The operational memory system's anthropology function:** Surface relevant historical operator behavior context when decisions are being made. When a new operator is being onboarded, show them the relevant failure patterns. When a venue's health is declining, show the Venue Manager the historical failure stories that match the pattern.

---

## Part 2 — Failure Memory Systems

---

### 2.1 Incident Archive UX

Every declared incident (per INCIDENT-OPERATIONS-UX-v1.md §3.1) is archived at resolution with a structured record:

**Incident archive entry:**

```
Incident Archive — [INC-2026-0047]

Title: Sponsor SOV shortfall — Override accumulation
Date: 2026-05-20
Venue: [VENUE_NAME]
Severity: High (contract SLA impact)
Duration: 22 minutes (detection to resolution)

Summary:
  Override_004 created for tournament day (2026-04-04) without expiry.
  Override accumulated to 47 days active, suppressing [SPONSOR_X] content
  on B1–B2. SOV fell to 19% vs contracted 25%.

Root cause:
  Override created without expiry date. No cleanup workflow identified it
  as stale. SOV monitoring threshold set at 20% — too low to detect drift
  before breach.

Resolution:
  Override_004 removed (2026-05-20 14:41). SOV recovering toward threshold.
  Threshold adjusted to 22% to provide earlier warning.

Lessons applied:
  ☑ Mandatory expiry default for event overrides: implemented 2026-05-22
  ☑ SOV monitoring threshold adjusted to 22%: implemented 2026-05-21
  ☐ Post-event override cleanup workflow: pending implementation

Recurrence prevention:
  This incident matches OPERATOR-COGNITIVE-MODELS-v1.md §6.3 (Override Addiction
  genesis pattern). See that section for design mitigations.

Related incidents:
  [INC-2025-0031] — Similar pattern at [VENUE_B] (6 months ago)
```

The archive entry is written at incident resolution and stored in the CMS for access by Venue Managers and above. It is not hidden — it is a searchable operational record.

---

### 2.2 Replay-Linked Postmortems

The incident archive entry links to a replay session that any authorized operator can open:

```
[View full incident replay] → Opens PRE reconstruction for incident period

  Screen-by-screen state at each phase
  Resolution traces for affected screens
  Suppression chain for sponsor content
  Timeline of operator actions during incident
  Before/after state comparison
```

The replay link is not just documentation — it is a live educational tool. A new Venue Manager who reads the incident archive can open the replay and see exactly what happened, exactly why, in full PRE-accurate reconstruction. The incident becomes a training scenario, not just a historical record.

---

### 2.3 Historical Drift Timelines

At the venue level, a "drift history" view shows the full 12-month health trajectory — not just a trend line, but an annotated history that attributes each health change to specific operational events:

```
Venue Health History — [VENUE_NAME] — 12 months

Grade A ──────────────╗
Grade B               ╚═══════╗
Grade C                       ╚════════════╗
Grade D                                    ╚══
        ↑             ↑        ↑            ↑
     Deploy         Override  Campaign     Operator
     (Grade A)     accumulation  scope     departure
                   begins      reduced     (configs
                               (less       orphaned)
                               coverage)
```

The annotated drift timeline is the primary accountability and learning surface for Venue Managers reviewing their venue's operational history, and for Org Admins doing governance reviews.

**The timeline does not assign blame** — it assigns causality. "Override accumulation begins" is a factual description of what happened. The organizational response (training, process improvement, cleanup) is separate from the factual record.

---

### 2.4 Override History Archaeology

"Override archaeology" is the process of examining all active overrides at a venue and reconstructing why each one was created — tracing their origins through the provenance timeline and incident archive.

**Why this matters:** Venues that have been operating for years may have overrides with no living organizational memory of why they exist. These are the most dangerous configurations — they might be doing something important (permanent compliance content, critical sponsor placement) or they might be completely irrelevant (created for a promotion that ended two years ago).

**Override archaeology view:**

```
Override Archaeology — [VENUE_NAME]

  14 active overrides — provenance analysis

  CLEAR ORIGIN (7 overrides):
  Override_008: Created by [OPERATOR_A] for Christmas 2025. Reason: seasonal promotion.
    → Note: Christmas has passed. Likely eligible for removal.

  TRACEABLE ORIGIN (4 overrides):
  Override_003: Created by [OPERATOR_B] (departed 2026-02). No reason recorded.
    → Matches configuration pattern for compliance content — may be intentional.
    → Recommend: verify with Org Admin before removing.

  UNKNOWN ORIGIN (3 overrides):
  Override_001: Created 2024-11-15 by [OPERATOR_C] (account deleted).
    No reason recorded. Account deactivated with no off-boarding.
    → Origin unknown. Requires investigation before removal.
    ⚠ This override has been active for 18 months.
```

Override archaeology is not a routine operation — it is triggered by: a venue health review, an operator off-boarding, a compliance audit, or when the health grade drops below C.

---

## Part 3 — Knowledge Retention Models

---

### 3.1 Institutional Learning

Institutional learning is the organizational process of converting individual operational experiences into shared knowledge that persists beyond the individuals who had the experience.

**The learning pipeline:**

```
Incident → Postmortem → Archive → Pattern extraction → Documentation update → Training integration
```

Each step requires deliberate action. The system provides the tools (incident archive, replay, pattern library); the organization must commit to using them consistently.

**Learning pipeline failure modes:**

| Step | Common failure | Prevention |
|------|---------------|-----------|
| Incident → Postmortem | Incident resolved without formal postmortem | Tier 2+ incidents require postmortem before closure |
| Postmortem → Archive | Postmortem exists but is not stored accessibly | Archive is a required field in incident closure |
| Archive → Pattern extraction | Archives not reviewed for patterns | Monthly pattern review by NOC/Org Admin |
| Pattern extraction → Documentation | Patterns identified but not documented | Documentation update is a required output of pattern review |
| Documentation → Training integration | Documentation exists but training is not updated | Training materials have version dependencies on documentation |

---

### 3.2 Operational Pattern Library

The operational pattern library is a structured collection of named operational patterns — both failure patterns (what goes wrong and how) and success patterns (what healthy operational behavior looks like).

**Pattern entry format:**

```
PATTERN: Override Accumulation with Tournament Trigger

Description:
  An override is created for a specific event (tournament, match night, function).
  The override is effective during the event. After the event ends, the override is
  not removed — either because the operator forgets, or because no cleanup process
  exists. The override persists, suppressing campaign and sponsor content.

Trigger conditions:
  → Event-driven venue (golf club, sports bar, licensed club)
  → Override created without expiry date or with expiry set past event end
  → No post-event cleanup workflow

Detection signals:
  → Override age exceeds event duration by > 7 days
  → Stale override reason field references a past event

Historical instances:
  → [INC-2026-0047] — Golf Club, 47-day override
  → [INC-2025-0031] — Sports Bar, 31-day override
  → See FAILURE-STORIES.md Story 3 (Stale Golf Club)

Prevention:
  → Event override templates with auto-expiry (event end + 24 hours)
  → Post-event cleanup reminder (triggered 24h after event end if override still active)
  → Override reason field parsing for past-event language

Recovery:
  → Override archaeology (§2.4) to identify and assess orphaned overrides
  → SOV recovery monitoring for affected sponsors
```

**The pattern library is the organizational crystallization of operational experience.** Every time an incident follows a known pattern, it does not need to be rediscovered — it needs to be recognized and the established prevention/recovery workflow applied.

---

### 3.3 Scenario Repositories

The scenario repository is a library of operational scenarios — specific situations that operators may encounter — with structured walkthroughs of how to handle them.

**Scenario entry format:**

```
SCENARIO: Campaign not showing, reason unknown

Symptom: Campaign A is configured and active, but Screen B1 is not showing Campaign A content.

Investigation:
  Step 1: Open Screen B1 introspection → identify current winning rule
  Step 2: Is the winner at LEVEL_0–2?
    Yes → An override is suppressing Campaign A. [See Override Suppression scenario]
    No → Continue to Step 3
  Step 3: Is the winner Campaign A at LEVEL_3?
    Yes → Campaign A is winning. Check delivery log for confirmation.
    No → Check Campaign A's scope — is B1 included?

Resolution paths:
  A: Override suppression → review and remove or accept override
  B: Scope mismatch → add Screen B1 to Campaign A's targeting
  C: Time window inactive → check Campaign A's scheduled hours
  D: Content expired → replace expired content items in Campaign A

Estimated resolution time: 5–15 minutes
Related incidents: [INC-2026-0047] [INC-2025-0031]
```

The scenario repository enables self-service incident resolution — operators can match their current situation to a known scenario and follow the structured resolution path without requiring support.

---

### 3.4 Failure-Pattern Indexing

The failure-pattern index maps observed failure symptoms to known patterns, enabling rapid pattern recognition:

**Index entry:**

```
Symptom: Campaign shows as "Active" but is not visible on targeted screens
  → Pattern: Override Suppression (most common)
  → Pattern: Scope Mismatch (if override is not present)
  → Pattern: Content Expiry (if other rules are also not matching)

Symptom: Sponsor SOV declining over several weeks
  → Pattern: Override Accumulation (if override created recently without expiry)
  → Pattern: Campaign Scope Reduction (if a campaign was modified)
  → Pattern: Seasonal Override Persistence (if event-night overrides not cleaned up)

Symptom: Emergency content still showing after incident is resolved
  → Pattern: Emergency Persistence (no expiry set, no clearance performed)
  → See FAILURE-STORIES.md Story 2
```

The failure-pattern index is the diagnosis accelerator. When an operator opens a support request or begins an incident investigation, the first step is matching the symptom to a known pattern. If a pattern is found, the investigation follows the pattern's documented path. If no pattern is found, the investigation produces a new pattern entry.

---

## Part 4 — Memory Decay Prevention

---

### 4.1 Recurring Replay Reviews

The operational memory system does not maintain itself — it requires deliberate, recurring investment. Recurring replay reviews are scheduled reviews of historical operational data designed to:

1. Confirm that past incident lessons are still being applied
2. Identify whether known patterns are recurring
3. Update pattern library entries with new observations

**Review schedule:**

| Review type | Frequency | Participants | Focus |
|-------------|-----------|-------------|-------|
| Venue operational review | Monthly | Venue Manager | Last 30 days incident archive, override age distribution |
| Regional pattern review | Quarterly | Regional Manager + NOC | Cross-venue pattern analysis, training gaps |
| Organizational memory review | Annually | Org Admin + Platform team | Full pattern library review, scenario repository update |

**Review format:** Not a meeting for its own sake — a structured walk through the replay data with specific questions to answer. "Is Pattern X recurring? What interventions were tried? Did they work?"

---

### 4.2 Training Refresh Systems

REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md §7.1 defines behavioral drift triggers that prompt refresher training. The operational memory system adds a time-based trigger:

**Training expiry model:**

All certifications have a validity period. After the validity period, the operator's certification is marked as "refresh due" — they are still authorized but are prompted to complete a refresher.

| Certification | Initial validity | Refresh interval | Refresh type |
|--------------|-----------------|-----------------|-------------|
| Floor Operator training | No expiry (base competency) | Annual review encouraged | Self-directed |
| Emergency authority | 12 months | Annual | Timed drill |
| Override governance | 18 months | 18-month refresh | Review + quiz |
| Venue Manager certification | 24 months | 24-month refresh | Scenario walkthrough |

Refresher content uses updated historical material — if a new incident occurred that illustrates the training concept, the refresher uses that incident rather than older material. The training stays current with operational reality.

---

### 4.3 Drift Reminders

The system provides proactive reminders when a venue's operational pattern resembles a historically problematic state:

```
⚡ Pattern match: Override persistence detected

  [VENUE_NAME] currently has 8 overrides with no expiry date.
  This pattern matches an override accumulation trajectory observed at
  this venue in Q4 2025 (see Incident Archive [INC-2025-0019]).

  In that incident, the trajectory led to a grade C health state
  within 30 days.

  [Review incident history] [Review current overrides] [Dismiss]
```

The drift reminder explicitly references the historical incident — it is not just a warning about current state, it is a warning that connects current state to a specific known failure trajectory. The operator who sees this reminder can choose to investigate the historical incident and understand what happened.

---

### 4.4 Operational Retrospectives

Quarterly operational retrospectives are structured reviews of the preceding quarter's operational history across all venues. The retrospective is not a performance review — it is a learning session that addresses:

1. What failure patterns occurred this quarter? Were they new or recurring?
2. Which prevention mechanisms worked? Which didn't?
3. What should be added to the pattern library?
4. Are there systemic issues (training, process, tool gaps) that created conditions for multiple incidents?
5. What should change before next quarter?

**Retrospective format:** Facilitated walkthrough of the quarterly incident archive, pattern library review, and operational trend analysis. Output: updated pattern library entries, updated training scenarios, and documented process improvements.

The retrospective output becomes part of the institutional operational memory — it is archived and accessible to future retrospectives, enabling year-over-year learning.

---

## Part 5 — Organizational Transition Support

---

### 5.1 Staff Turnover Continuity

When an operator leaves a venue, their operational knowledge leaves with them. The CMS can partially compensate through documentation — but only if the documentation exists.

**Turnover continuity protocol:**

When an operator account is deactivated:
1. The system generates a "configuration review prompt" listing all active configurations created by that operator
2. The Venue Manager reviews each configuration: keep, modify, or remove
3. For configurations that are kept: a note is added documenting why (so the reason is not lost)
4. For configurations that are removed: they are archived with the reason
5. The incident archive preserves any incidents the departing operator was involved in — their operational context is not lost when they leave

**This is the off-boarding workflow specified in OPERATIONAL-INSIGHTS-LOG.md INSIGHT-014,** implemented as a UX system rather than just a process recommendation.

---

### 5.2 Onboarding Historical Context

New operators joining an existing venue should receive:

1. **Venue operational history summary:** Health grade history, any significant incidents, operational patterns specific to this venue
2. **Configuration provenance brief:** Who created the major active configurations and why (documented rationale)
3. **Pattern awareness:** Which known failure patterns have been active at this venue? Have they been resolved?
4. **Predecessor briefing:** A summary of the configurations, incidents, and lessons from the operator they are replacing (if applicable)

**New operator context brief (auto-generated):**

```
Welcome to [VENUE_NAME] — Operational Context Brief

Health history:
  This venue has maintained grade B–A health for the past 14 months.
  One grade C period in Q4 2025 (November–January) due to holiday
  override accumulation. Resolved January 2026.

Current configuration notes:
  Override_012 (active on Gaming screens): Permanent compliance content.
    Created 2025-08-01 by [FORMER_OPERATOR]. Verified by [MANAGER] on 2026-01-15.
    Do not remove without compliance review.

  Campaign: New Year Promotion — started January, should have expired.
    Currently showing "Active" but may need content update.
    [Review this campaign]

Patterns to watch:
  This venue has a history of override accumulation in Q4 around holiday events.
  Be proactive about setting expiry dates on event overrides.

Incidents in the last 12 months:
  2 incidents — both resolved, both related to override persistence.
  [View incident archive]
```

This brief gives the new operator immediate operational context — they know what to watch for, what to avoid, and where to look first if something seems wrong.

---

### 5.3 Executive Transition Visibility

When organizational leadership changes (new general manager, new regional director), the incoming executive needs operational context at an appropriate abstraction level.

**Executive transition brief:**

```
[ORG_NAME] — Executive Operational Context

Platform overview:
  26 venues, 847 screens
  Current network health: 69% grade A/B (18 venues), 23% grade C (6 venues),
  8% grade D/F (2 venues)

Key ongoing matters:
  2 venues require immediate attention (grade D or below)
  1 active sponsor SOV shortfall (negotiation in progress with [SPONSOR_X])
  Q4 override accumulation pattern expected — mitigation plan in place

Historical context:
  Platform in production for 24 months
  4 significant incidents in 24 months — all resolved
  Network health has been stable at B average for 18 months
  Most common operational pattern: post-event override persistence (6 incidents)

Governance:
  Override authority model and escalation hierarchy → [link]
  Sponsorship delivery accountability → [link]
  Incident response protocol → [link]
```

The executive transition brief is not an operational manual — it is the essential context for making informed governance decisions. The new executive knows the current state, the known risks, the historical trajectory, and where to find detail.

---

### 5.4 Regional Knowledge Transfer

When regional management changes or when a new region is established, operational knowledge from established regions must be transferred rather than requiring each region to learn independently.

**Regional knowledge transfer package:**

1. **Pattern library:** All failure patterns observed in comparable regions, with incident examples
2. **Scenario repository:** Scenarios relevant to the vertical mix in this region
3. **Intervention playbooks:** Structured response guides for common operational situations
4. **Benchmark data:** What healthy venues in comparable regions look like (health grades, override counts, campaign adoption rates)

The knowledge transfer package prevents each region from treating its operational challenges as unique when many of them are predictable and have established solutions.

---

## Part 6 — Long-Term Anti-Folklore Design

---

### 6.1 Evidence-Linked Explanations

Every explanation the system provides must be linkable to its evidence. An operator who is told "your content is being suppressed by an operational override" must be able to see exactly which override, when it was created, by whom — not just receive the explanation.

**Evidence chain requirement:**

All explanatory statements in the CMS must be verifiable: tapping any explanatory statement reveals the evidence behind it. "Campaign A is suppressed" → tap → full resolution trace showing the suppressor, its creation date, its creator, its expiry.

This evidence chain is the structural anti-folklore mechanism. Folklore exists when explanations are not verifiable. When every explanation is backed by inspectable evidence, there is no space for alternative unofficial explanations to take hold.

---

### 6.2 Replay-Backed Operational Claims

When operators make claims about system behavior based on their experience ("this always happens when you set priority to maximum"), the system can offer a replay-backed verification:

```
[OPERATOR]: "Setting priority to 10 should fix it"

System prompt (for Venue Manager view):
  Would you like to verify this claim?
  Open replay for the last 5 occasions this operator encountered a similar
  issue and check whether priority changes affected the resolution outcome.
  [Run verification]
```

This is not a confrontational tool — it is a collaborative investigation tool. It allows the organization to convert operational folklore into documented fact or documented disproof, building the institutional knowledge base.

---

### 6.3 Contestable Operational Narratives

Institutional narratives about system behavior must be contestable — when an organizational belief is wrong, there must be a mechanism to challenge it with evidence.

**Contestation mechanism:**

The incident archive and pattern library allow any authorized operator to add a "contested finding":

```
[OPERATOR_A] (Venue Manager): I believe override frequency is fine at this venue
  because we always clean them up after events.

[NOC_OPERATOR]: Override history at this venue shows 7 overrides over 90 days old.
  [See override history] — 3 of these have reason fields referencing past events.
  Cleanup is happening but is incomplete.
```

The contestation is resolved by evidence — the override history is the authoritative record, not the manager's belief. The mechanism prevents institutional narratives from becoming unchallenged dogma.

---

### 6.4 Institutional Myth Detection

Over long operational periods, organizational myths develop — "we had a problem years ago so we never do X" (where X is actually correct and safe) or "our venue needs to be managed differently from others because of Y" (where Y is an outdated constraint).

**Myth detection signals:**
- An operator refers to a historical incident as the reason for a current configuration, but the incident archive shows no such incident
- A venue has a documented "special requirement" that contradicts organizational standards, with no documented rationale
- A pattern of behavior at one venue is described as "how ClubHub works" when it is actually a local workaround

**Myth investigation protocol:**

When a potential institutional myth is identified:
1. Document the claim: what is the belief and where did it come from?
2. Search the incident archive for the foundational event
3. Review the replay for the period in question (if it falls within the replay window)
4. If the foundational event cannot be verified: flag the belief as "unverified institutional claim" in the venue's operational notes
5. If the belief is disproved: document the disproof and provide a structured correction to the operator(s) who held the belief

The myth detection process is not punitive — it is corrective. Organizations that hold incorrect beliefs about their systems operate less safely. Correcting those beliefs improves operations.

---

### 6.5 The Living Memory Contract

The operational memory system's effectiveness depends on an organizational commitment — the "living memory contract":

**Organizations using ClubHub TV commit to:**

1. **Record incidents at resolution.** Not "we'll write it up later" — at resolution, while context is fresh.
2. **Review the pattern library quarterly.** Patterns that are never reviewed are patterns that never inform future decisions.
3. **Onboard with historical context.** New operators receive the venue's operational history, not just a system tutorial.
4. **Off-board with configuration review.** Departing operators' configurations are reviewed before their account is deactivated.
5. **Contest unverifiable claims.** When someone says "this always happens because X," verify X using replay.

These are not technical requirements — they are organizational practices. The platform provides the tools; the organization provides the commitment to use them consistently.

**The platform's role:** Surface prompts for each practice at the appropriate time. Incident closure prompts the postmortem archive. Quarterly calendar events prompt the pattern library review. Operator departure prompts the configuration review. New operator onboarding prompts the historical context brief.

The living memory contract is enforced not by blocking workflows but by prompting the right practices at the right moments — and making it easier to follow the practice than to dismiss it.

---

*End of OPERATIONAL-MEMORY-AND-INSTITUTIONAL-LEARNING-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Incident archive data model: Agent 2 (CMS) design responsibility*
*Long-term state preservation for replay: Agent 1 (Platform) requirement*
*Pattern library governance: Agent 2 (CMS) + Agent 3 (UX) joint responsibility*
