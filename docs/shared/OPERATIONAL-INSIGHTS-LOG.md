# ClubHub TV — Operational Insights Log
# Shared Operational Intelligence Layer

**Document type:** Living operational intelligence log — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document is a structured, append-only log of operational insights — learnings about how the ClubHub TV system interacts with real-world venues, operators, and environments. It serves as the long-term operational memory of the platform.

Unlike other documents in the `docs/shared/` directory, this log is chronological and cumulative. It captures insights as they are discovered, preserving the temporal sequence of learning. Older entries remain valuable as context for why certain design decisions were made.

**Append only. Do not modify existing entries. Add new entries at the bottom of the appropriate section.**

---

## Log Entry Format

```
INSIGHT-NNN
Date: YYYY-MM-DD
Category: [SYSTEM | OPERATOR | VERTICAL | ARCHITECTURE | PROCESS]
Source: [STRUCTURAL_INFERENCE | ANALOGOUS | FIELD | EXPERIMENT | FAILURE_ANALYSIS]
Priority: [HIGH | MEDIUM | LOW]

Observation:
[What was observed or inferred]

Implication:
[What this means for the system, design, or operations]

Action status:
[OPEN — no action taken yet]
[IN_PROGRESS — action being designed/implemented]
[RESOLVED — action taken; note what was done]
[ACCEPTED — acknowledged; no action required]

Related:
[Links to related documents, observations, or failure stories]
```

---

## Section 1 — System Architecture Insights

---

**INSIGHT-001**
Date: 2026-05-22
Category: ARCHITECTURE
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
The PRE's purity constraint (INV-1) is the system's most architecturally valuable property, but it creates a structural gap: the PRE cannot observe its own output. It can compute what should play; it cannot know what is actually playing. The delivery log bridges this gap — but delivery log data arrives asynchronously, with a minimum 15-second delay, and reflects past rather than present state.

Implication:
Any confidence score computation (INV-6) that relies on delivery log data is inherently retrospective. A screen that is currently broken will only be detected after at least one failed poll cycle (15 seconds). A screen that has been silently rebooting and recovering may have intermittent delivery log gaps that are invisible to a confidence score computation looking at the most recent entry. The confidence score is a trailing indicator, not a real-time one.

Action status:
ACCEPTED — the 15-second trailing nature of confidence scores is constitutionally inherent to the poll-based architecture. UX must not imply real-time screen state certainty. Language on confidence indicators should reflect "last known good" rather than "currently."

Related:
- ENGINEERING-CONSTITUTION-v1.md INV-1, INV-6
- SCREEN-USE-CASES.md Use Case 4 (Sports/Entertainment Primary — HDMI switch detection)

---

**INSIGHT-002**
Date: 2026-05-22
Category: ARCHITECTURE
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
The 7-level resolution hierarchy (LEVEL_0 through LEVEL_6) creates a priority stack where higher levels are evaluated first. This is constitutionally correct and produces deterministic results. However, the hierarchy is not visible to operators at any point in the CMS. Operators experience the priority stack as "sometimes my content doesn't show" — a mysterious failure mode without an obvious cause.

Implication:
The resolution hierarchy is the single most important concept for operator mental model formation. It must be surfaced in the UX — not as a technical diagram for system engineers, but as a plain-language explanation accessible to non-technical operators: "Content priority works like this: Safety alerts always show > Operational locks > Time-based locks > Your scheduled campaigns."

Action status:
OPEN — UX translation of the resolution hierarchy into operator-accessible language is a pending design task.

Related:
- OPERATOR-MENTAL-MODELS.md §1.3 (Incorrect Model Elements — "Priority controls what plays")
- DOMAIN-LANGUAGE-GLOSSARY.md (Resolution Level entry)
- DESIGN-PRINCIPLES-FOR-OPERATIONS.md P-RT-04

---

**INSIGHT-003**
Date: 2026-05-22
Category: ARCHITECTURE
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
The SWRR (Smooth Weighted Round Robin) algorithm produces deterministic content interleaving — identical inputs always produce identical interleaving order. This is constitutionally required (INV-3). However, it means that if a content item has a very low weight, it may be positioned consistently at specific points in the rotation that happen to fall during low-viewership periods (e.g., always third in a 3-item cycle, always playing 8:00–8:20 in every 30-minute rotation). Low-weighted content has low-visibility correlation that is more predictable than random distribution would produce.

Implication:
Operators who observe that their low-weighted content "never seems to be on when I check" may be observing a real phenomenon — SWRR's determinism makes some content predictably visible at specific times. This is technically correct behavior but may feel like "the system is hiding my content." This is an edge case but worth documenting for support staff.

Action status:
ACCEPTED — this is correct constitutional behavior. UX documentation for support staff should note: "Low-weight content may appear to show consistently at specific times due to SWRR determinism."

Related:
- PRE-REFERENCE-IMPLEMENTATION-v1.md (SWRR algorithm)
- src/pre/algorithms/swrr.ts

---

**INSIGHT-004**
Date: 2026-05-22
Category: ARCHITECTURE
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
The campaign system (LEVEL_3) and the override system (LEVEL_1/2) were designed for different operator needs but are managed in the same CMS. Campaigns are for planned, managed, auditable promotional content. Overrides are for immediate, temporary operational changes. The UX does not currently distinguish between these as fundamentally different workflow types — both are accessible from the same navigation level.

Implication:
Conflating campaign management and override management in the same UI hierarchy teaches operators that they are interchangeable tools. They are not interchangeable — they operate at different resolution levels, have different semantic meanings, and generate different entropy risks. Presenting them as equivalent options in the same menu teaches the wrong mental model.

Action status:
OPEN — UX architecture should separate "Planned Content" (campaign management) from "Operational Changes" (override management) as distinct top-level workflows with distinct visual treatment.

Related:
- OPERATOR-MENTAL-MODELS.md §7.1 (Fix by Override Cascade)
- DESIGN-PRINCIPLES-FOR-OPERATIONS.md P-IA-01 (Configuration vs Resolution Separation)

---

**INSIGHT-005**
Date: 2026-05-22
Category: SYSTEM
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
The entropy metrics M-01 through M-12 are computable from existing database state without requiring new data collection. This is a significant architectural property — the system already has all the data needed to surface entropy signals. The only requirement is computation and surfacing.

Implication:
Entropy monitoring has near-zero data collection overhead — it is a derived view of existing state. This removes a common objection ("we'd need new telemetry infrastructure"). The investment is in computation and UX, not data infrastructure.

Action status:
ACCEPTED — entropy metric computation is a backlogged development item. Priority should be elevated given the zero data-collection cost.

Related:
- OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5 (Operational Health Metrics)
- src/verification/production-monitors/forbidden-state.ts (existing monitoring infrastructure)

---

## Section 2 — Operator Behavior Insights

---

**INSIGHT-006**
Date: 2026-05-22
Category: OPERATOR
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
The five entropy degradation patterns (A through E in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §2.2) are not independent failures — they compound each other. A venue that develops Override Accumulation (Pattern A) also develops Campaign Fragmentation (Pattern D, because operators learn that direct scheduling is faster than campaigns), which also develops Shadow Scheduling (Pattern C, because operators create multiple similar schedules). These patterns are self-reinforcing.

Implication:
Treating each entropy pattern as an independent problem to solve independently is insufficient. The patterns reinforce each other through the same underlying mechanism: operator shortcuts accumulate when the "correct" path is slower or less reliable than the "shortcut" path. Interventions must address the underlying mechanism, not just each symptom.

The underlying mechanism is: **the gap between what the correct workflow offers (auditability, structure, coverage) and what the shortcut offers (speed, certainty, immediate result).**

Design that reduces this gap — making correct workflows as fast and reliable as shortcuts — addresses all entropy patterns simultaneously.

Action status:
OPEN — this framing should guide the UX design philosophy for campaign creation and override management.

Related:
- OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §2.2
- DESIGN-PRINCIPLES-FOR-OPERATIONS.md P-EU-02 (Urgency-Appropriate Workflow Principle)

---

**INSIGHT-007**
Date: 2026-05-22
Category: OPERATOR
Source: ANALOGOUS
Priority: HIGH

Observation:
In analogy to aviation crew resource management (CRM), the most dangerous operator failure modes are not the ones that produce immediate visible errors, but the ones that accumulate silently over time and are confirmed by apparently correct intermediate outcomes. In aviation: each individual step in an accident chain looks safe. In ClubHub: each individual override creation or priority escalation looks correct. The system is working. The screen is showing content. No alarm fires. The error is invisible until it is large enough to surface as a complaint or content audit failure.

Implication:
The system must surface accumulating patterns, not just individual events. A single override creation generates no signal — correctly. 25 override creations over 3 months at a venue is a pattern that must generate a signal. The entropy metrics are the mechanism for pattern detection; they must be active and surfaced proactively.

Action status:
IN_PROGRESS — entropy monitoring infrastructure is being built (src/verification/production-monitors/).

Related:
- REAL-WORLD-OBSERVATIONS.md OBS-018
- FAILURE-STORIES.md Story 1 (Campaign That Wasn't Showing)

---

**INSIGHT-008**
Date: 2026-05-22
Category: OPERATOR
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
Operators who are most competent with the system — who understand the resolution model, use campaigns correctly, and set expiry dates on overrides — are the same operators who are most likely to leave the venue or be promoted out of the role within 12–18 months. High-competency operators are promoted; low-competency operators remain. This creates a systemic pattern where venue CMS competency degrades over time through attrition of the most capable users.

Implication:
The system must not require high competency to produce correct outcomes. Design that relies on operator understanding of the resolution model will fail as competent operators leave. Design that surfaces correct information and creates gentle friction toward correct behavior works for all competency levels.

Action status:
ACCEPTED — this is the foundational argument for self-explaining system design. Every design principle in DESIGN-PRINCIPLES-FOR-OPERATIONS.md is informed by this insight.

---

**INSIGHT-009**
Date: 2026-05-22
Category: OPERATOR
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
The operator's primary sensory feedback about system state is walking past a screen and looking at it. There is no dashboard visible to operators during their normal working day. The CMS is accessed intentionally, not ambient. Most operational decisions are made without consulting the system state.

Implication:
The gap between "the operator's view of the system" and "the actual system state" can grow for days or weeks without the operator noticing. Entropy accumulates during these gaps. The entropy monitoring system must be able to reach operators rather than waiting for operators to reach it — email digests, notification systems, and visible health indicators in the venue management interface (as a default landing screen) are the mechanisms.

Action status:
OPEN — notification and digest system design is pending.

Related:
- DESIGN-PRINCIPLES-FOR-OPERATIONS.md P-EV-01 (Entropy Score Contextual Display Principle)

---

## Section 3 — Vertical-Specific Insights

---

**INSIGHT-010**
Date: 2026-05-22
Category: VERTICAL
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
Golf clubs have a uniquely bimodal operational pattern: extremely low activity between tournaments (weekly or monthly schedule reviews at most) and extremely high urgency during tournament days (real-time content updates required). The same CMS must serve both modes for the same operators.

Implication:
Golf club UX must support both a "fire and forget" mode (configure once, run for weeks) and a "live operations" mode (update in real-time during tournament). These are fundamentally different operator needs. The transition between modes must be intuitive — a golf club pro shop manager who operates the system in low-urgency mode most of the year must be able to switch to high-urgency mode during tournament day without additional training.

Action status:
OPEN — tournament day "live mode" workflow is a pending UX design item.

Related:
- MARKET-VERTICAL-PATTERNS.md §2 (Golf Clubs)
- SCREEN-USE-CASES.md Use Case 6 (Golf Tournament Leaderboard)

---

**INSIGHT-011**
Date: 2026-05-22
Category: VERTICAL
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
Sports bars are unique in requiring content coordination between ClubHub-managed screens and non-ClubHub-managed screens (live broadcast on primary TVs via set-top box or IPTV). ClubHub cannot control the live broadcast screens, but those screens exist in the same physical space. Operators must coordinate content between the two systems manually.

Implication:
From the operator's perspective, "the screens" includes both ClubHub-managed and non-ClubHub-managed displays. The operator's mental model treats all screens as controllable through one system. When a screen is in "TV mode" (not ClubHub), the operator may still try to change its content through ClubHub, not realizing the input has been switched.

System implication: The delivery log will show no updates for screens that have been switched to TV input. The confidence score will degrade. The system correctly identifies a problem (no delivery confirmation) but the operator knows it's expected ("that TV is showing the game"). The system needs a way to express "expected non-delivery" vs "unexpected non-delivery."

Action status:
OPEN — screen metadata `shares_display_input` flag proposed in ENVIRONMENTAL-CONTEXTS.md §5.1. Implementation pending.

Related:
- ENVIRONMENTAL-CONTEXTS.md §3.3 (TV Input Competition)
- MARKET-VERTICAL-PATTERNS.md §5 (Sports Bars)

---

**INSIGHT-012**
Date: 2026-05-22
Category: VERTICAL
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
Licensed clubs (RSL, bowling, golf, etc.) in Australia and New Zealand operate under regulatory frameworks that mandate specific content on gaming area screens. These regulations change with government policy. The ClubHub system has no mechanism to track regulatory compliance requirements or alert operators when regulations change.

Implication:
A venue that was compliant at deployment may become non-compliant when regulations change, with no system-generated signal. The compliance content remains configured (not wrong by the system's assessment) but may no longer meet regulatory requirements.

This is an operational risk that extends beyond the technical scope of the PRE — but it affects what content the system delivers, which is within the operational scope.

Action status:
OPEN — compliance content type and regulatory change notification are future platform capabilities. Current workaround: operational process requiring manual compliance content review when regulatory changes are announced.

Related:
- SCREEN-USE-CASES.md Use Case 5 (Gaming Area Compliance Screen)
- PLAYOUT-PATTERN-LIBRARY.md Pattern 9 (Compliance-Constrained Content)

---

## Section 4 — Process Insights

---

**INSIGHT-013**
Date: 2026-05-22
Category: PROCESS
Source: STRUCTURAL_INFERENCE
Priority: MEDIUM

Observation:
The current deployment process (PILOT-VENUE-CHECKLIST.md) focuses on hardware, network, and kiosk configuration. It does not include operator training verification, initial content configuration review, or entropy baseline establishment. The checklist ends when the screens are showing content — not when the operators are capable of maintaining them correctly.

Implication:
Operators who pass the hardware checklist but fail to understand the resolution model will develop incorrect mental models from day 1. The incorrect models are harder to correct after they have been reinforced by 3 months of operation. A training checkpoint should be part of the deployment process, not separate from it.

Action status:
OPEN — propose adding to the pilot checklist: operator training session completion, initial configuration review, and 30-day entropy check scheduled at deployment.

Related:
- PILOT-VENUE-CHECKLIST.md
- DESIGN-PRINCIPLES-FOR-OPERATIONS.md §9 (Onboarding and Training Principles)

---

**INSIGHT-014**
Date: 2026-05-22
Category: PROCESS
Source: STRUCTURAL_INFERENCE
Priority: HIGH

Observation:
There is no defined off-boarding process for operators who leave a venue. When an operator leaves: their account persists, their overrides persist, their direct schedules persist, their rationale for configuration decisions disappears. The venue inherits a configuration state from a person who is no longer available to explain it.

Implication:
Operator off-boarding is as important as operator onboarding from an entropy management perspective. A structured off-boarding process would: deactivate the account, review and document or clean up their active configurations, and optionally transfer rationale documentation to a successor.

Action status:
OPEN — off-boarding workflow documentation is pending. Requires CMS support for "configuration review on account deactivation" workflow.

Related:
- FAILURE-STORIES.md Story 3 (The Stale Golf Club — operator departure without knowledge transfer)
- REAL-WORLD-OBSERVATIONS.md OBS-006 (Knowledge transfer decay)

---

*End of OPERATIONAL-INSIGHTS-LOG.md v1.0*
*Append new entries chronologically within sections.*
*Do not modify existing entries.*
*Review and update Action status fields as entries progress.*
