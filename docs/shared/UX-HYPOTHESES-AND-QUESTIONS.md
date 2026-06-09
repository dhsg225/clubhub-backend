# ClubHub TV — UX Hypotheses and Questions
# Shared Operational Intelligence Layer

**Document type:** Living research backlog — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document captures open UX hypotheses and research questions that must be resolved before key design decisions can be made with confidence. It is the shared research backlog for CMS and UX design work.

**Hypothesis:** A testable belief about how operators will behave or what they need.
**Question:** An unknown that must be answered before a design decision can be made.

Hypotheses are tested through: user research, A/B testing, field observation, analytics, or structured operator interviews. Questions are answered through research or validated through deployment experience.

---

## Status Tags

- `[OPEN]` — Not yet investigated.
- `[ACTIVE]` — Currently being investigated.
- `[VALIDATED]` — Hypothesis confirmed; update the OPERATOR-MENTAL-MODELS or REAL-WORLD-OBSERVATIONS documents.
- `[INVALIDATED]` — Hypothesis disproven; note the correct finding.
- `[ANSWERED]` — Question answered; note the answer.
- `[BLOCKED]` — Cannot be investigated until a dependency resolves.

---

## Section 1 — Resolution Model Communication

---

**UXH-001** `[OPEN]`
**Domain:** Resolution model understanding
**Type:** Hypothesis
**Statement:** Showing operators a visual resolution level hierarchy diagram (LEVEL_0 through LEVEL_6) at onboarding significantly improves their ability to correctly predict which content will appear on a screen compared to text-only description.
**Rationale:** The resolution model is counterintuitive (a LEVEL_3 schedule at priority 1000 loses to a LEVEL_1 override at priority 1). Visual hierarchies are better retained than textual descriptions for spatial/priority mental models.
**Test approach:** A/B onboarding: text description vs visual hierarchy diagram. Measure: ability to correctly predict resolution outcome in 5 test scenarios.
**Success criteria:** Diagram group predicts correctly 80%+ vs text group 50%+.
**Design implication if validated:** Resolution hierarchy diagram is a required onboarding asset, presented before any configuration workflow.

---

**UXH-002** `[OPEN]`
**Domain:** Override creation behavior
**Type:** Hypothesis
**Statement:** Requiring operators to select an expiry duration before any other override field reduces permanent override creation by >50% compared to an expiry field placed after the content selection fields.
**Rationale:** Field ordering in forms significantly influences which fields are completed. If expiry is the LAST field and feels optional, it will be skipped under time pressure. If it is the FIRST field and is required, it establishes the temporal context of the action before the operator commits to the content.
**Test approach:** A/B: override creation form with expiry first vs expiry last. Measure: percentage of created overrides with null expiry_at.
**Success criteria:** Expiry-first form reduces null expiry_at by >50%.
**Design implication if validated:** Override creation form must lead with expiry selection. Permanent override must be explicitly labeled.

---

**UXH-003** `[OPEN]`
**Domain:** Coverage gap communication
**Type:** Hypothesis
**Statement:** Operators who see a per-screen coverage map before confirming campaign publish are >70% less likely to discover coverage gaps through complaints or manual screen checks within the following 7 days.
**Rationale:** The "Campaign That Wasn't Showing" failure (FAILURE-STORIES.md Story 1) demonstrates the damage of undiscovered coverage gaps. Pre-publish disclosure of gaps closes the feedback loop.
**Test approach:** Field study comparing venues with and without pre-publish coverage disclosure. Measure: time-to-discover coverage gaps, complaint rate.
**Success criteria:** Coverage map group discovers gaps before complaints rather than through complaints.
**Design implication if validated:** Pre-publish coverage map is a required step in campaign publish workflow.

---

**UXH-004** `[OPEN]`
**Domain:** Resolution explainability
**Type:** Question
**Statement:** What language do operators use when they want to know "why is that screen showing that?" — and does the language differ significantly by role?
**Rationale:** The reason_trace is technical JSON. Translating it to operator language requires knowing the operator's vocabulary. "The scheduled override at Level 2 is terminating resolution" vs "The time-specific lock from Tuesday is showing on this screen." Different roles may need different framings.
**Research approach:** Structured interviews with venue managers, shift managers, and org admins. Present each with "that screen is showing X instead of Y — investigate" scenario. Record vocabulary used.
**Design implication:** Resolution explorer UI must use role-appropriate language. This question must be answered before the resolution explorer is designed.

---

**UXH-005** `[OPEN]`
**Domain:** Entropy score communication
**Type:** Question
**Statement:** What reference frame do operators use to interpret a composite score (e.g., entropy score of 68)? School grades (60–70 = "D")? Sports (68 out of 100 = "okay")? Medical (68% = something diagnostic)?
**Rationale:** The meaning of the entropy score depends entirely on what reference frame operators apply. If they interpret 68 as "failing" (school grade D), they may over-react. If they interpret it as "fine" (sports percentage), they may under-react. The reference frame the UX implies must match operator intuition.
**Research approach:** Show operators entropy scores in the range 40–90 without explanation. Ask: "Is this venue healthy? What would you do?" Record interpretation.
**Design implication:** Score display design (color, label, percentage representation) must align with the intuitive reference frame most operators apply. This question must be answered before entropy dashboard design is finalized.

---

**UXH-006** `[OPEN]`
**Domain:** Preview system adoption
**Type:** Hypothesis
**Statement:** Operators who use the preview system at least 3 times in their first week of operation maintain correct mental models significantly longer than operators who don't use preview, as measured by override accumulation rate at 3 months.
**Rationale:** Preview builds mental model through direct observation (OBS-020). The correlation between early preview adoption and long-term mental model quality can be tested through behavioral analytics.
**Test approach:** Track preview usage in first week vs override accumulation at 30, 60, 90 days post-deployment. Correlation analysis.
**Success criteria:** Significant negative correlation between early preview usage and override accumulation rate.
**Design implication if validated:** First-week onboarding must include mandatory or strongly guided preview usage as a mental model training mechanism.

---

## Section 2 — Emergency Feature Design

---

**UXH-007** `[OPEN]`
**Domain:** Emergency misuse prevention
**Type:** Hypothesis
**Statement:** Displaying the number of recent emergency activations at the point of emergency activation reduces non-emergency use by >40%.
**Rationale:** The "Emergency That Wasn't" failure (FAILURE-STORIES.md Story 2) shows that operators don't self-monitor emergency frequency. Making the count visible in the activation moment creates self-awareness.
**Test approach:** A/B with and without usage count display on emergency activation screen. Measure: emergency activation frequency over 90-day period.
**Success criteria:** Count-display group shows >40% lower emergency activation frequency.
**Design implication if validated:** Usage count display is required in emergency activation UI.

---

**UXH-008** `[OPEN]`
**Domain:** Emergency alternative offer
**Type:** Hypothesis
**Statement:** Offering "Create Operational Override Instead" as a prominently positioned alternative in the emergency activation flow reduces emergency misuse by >30% among operators who activate emergency for operational reasons.
**Rationale:** Emergency misuse occurs because the alternative (operational override) is harder to reach or less familiar. If the alternative is offered directly in the emergency flow, operators who would have misused emergency may take the correct path.
**Test approach:** A/B with and without alternative-offer in emergency flow. Track emergency vs operational override usage ratio.
**Success criteria:** Significant shift toward operational override usage in A/B group.
**Design implication if validated:** Alternative-offer is a required element of emergency activation UI.

---

**UXH-009** `[OPEN]`
**Domain:** Emergency severity understanding
**Type:** Question
**Statement:** Do shift managers understand that emergency activation affects ALL screens in the scope, not just the screen they're looking at?
**Rationale:** An operator activating emergency thinking it affects one screen, when it actually affects all 28 screens in the venue, is a significant misuse risk. The blast radius of emergency must be understood before activation.
**Research approach:** Ask shift managers in structured interview: "If you activate emergency, which screens does it affect?" before any training on emergency scope.
**Design implication:** Emergency activation confirmation must display scope ("This will affect ALL 28 screens in [Venue Name]") in large, prominent text.

---

## Section 3 — Operator Workflow Design

---

**UXH-010** `[OPEN]`
**Domain:** Quick update workflow
**Type:** Question
**Statement:** What is the acceptable maximum time for a shift manager to make a content change under time pressure? Is 60 seconds achievable and sufficient?
**Rationale:** Design principle P-EU-02 specifies a "quick change" workflow, but the target time needs to be validated with actual shift managers under realistic conditions.
**Research approach:** Contextual testing with shift managers during actual service periods. Measure time from "I need to change this" decision to "content has changed on the screen." Identify acceptable threshold.
**Design implication:** Target time from validated research must drive workflow design. If 60 seconds is too slow, redesign. If 90 seconds is acceptable, that changes the design scope.

---

**UXH-011** `[OPEN]`
**Domain:** Role-appropriate depth
**Type:** Hypothesis
**Statement:** Shift managers who see a simplified CMS interface (showing only "What's playing" and "Make a quick change") complete tasks faster and make fewer entropy-producing configuration choices than shift managers who see the full CMS interface.
**Rationale:** Information overload on the full CMS interface causes shift managers to take the fastest available path (override, emergency) rather than the appropriate path. Reducing visible options reduces inappropriate option selection.
**Test approach:** A/B with full vs simplified interface for shift manager sessions. Measure: task completion time, override/emergency usage rate, error rate.
**Design implication if validated:** Role-specific interface depth is a design requirement, not a preference. Full CMS interface must not be the default for shift managers.

---

**UXH-012** `[OPEN]`
**Domain:** Onboarding effectiveness
**Type:** Question
**Statement:** How long does correct mental model retention last after initial training, and what is the primary driver of mental model decay?
**Rationale:** Mental model decay (documented in OPERATOR-MENTAL-MODELS.md §1.6) is expected but not quantified. Understanding the timeline and drivers helps determine when re-training or in-system nudging is needed.
**Research approach:** Assess mental model accuracy at 1 month, 3 months, 6 months post-training. Correlate with: staff turnover in role, operational urgency events, CMS usage frequency, entropy score.
**Design implication:** If mental model decay is rapid (3 months), in-system guidance must be persistent, not just present at onboarding. If it's slow (12 months), onboarding investment is relatively more durable.

---

## Section 4 — Entropy Signal Design

---

**UXH-013** `[OPEN]`
**Domain:** Advisory fatigue
**Type:** Hypothesis
**Statement:** Operators who see 4 or more simultaneous active advisories on the entropy dashboard dismiss all of them without action more than 80% of the time, compared to <30% dismissal when only 1–2 advisories are active.
**Rationale:** Alert fatigue is well-documented in monitoring systems. The advisory system's value depends on operators engaging with advisories. If multiple simultaneous advisories produce blanket dismissal, the system needs to prioritize rather than surface all signals simultaneously.
**Test approach:** Measure advisory click-through and action rates as a function of simultaneous advisory count.
**Design implication if validated:** The entropy dashboard must surface at most 2–3 high-priority advisories rather than all active signals. Priority ordering and consolidation are required features.

---

**UXH-014** `[OPEN]`
**Domain:** Advisory persistence escalation
**Type:** Hypothesis
**Statement:** Escalating the visual treatment of advisories that have been active for 30+ days (design principle P-EV-02) increases operator engagement with those advisories by >40% compared to static advisory treatment.
**Rationale:** Design principle P-EV-02 posits that persistent advisories that don't escalate lose signal value. This hypothesis tests whether escalating visual treatment prevents the loss.
**Test approach:** A/B: static advisory treatment vs escalating treatment. Measure: advisory engagement rate at days 1, 14, 30, 60.
**Design implication if validated:** Escalating visual treatment is required for persistent advisories. Non-escalating treatment produces advisory blindness.

---

**UXH-015** `[OPEN]`
**Domain:** Prospective impact communication
**Type:** Question
**Statement:** What format is most effective for communicating the prospective impact of an action to an operator? Options include: percentage change, before/after comparison, absolute count, or natural language summary.
**Rationale:** Design principle P-EV-03 requires prospective impact surfacing for entropy-worsening actions. The most effective format is an empirical question.
**Research approach:** Test impact communication formats in usability research. Show operators: "Adding this contract will bring total SOV to [X%]" vs "After this addition: Sponsor content [before%] → [after%], Editorial content [before%] → [after%]" vs "[number] screens will lose editorial content priority." Measure: correct interpretation rate, decision quality.
**Design implication:** Format that produces the highest correct interpretation rate should be used for prospective impact communication.

---

## Section 5 — Multi-Venue and Org-Level Questions

---

**UXH-016** `[OPEN]`
**Domain:** Cross-venue management
**Type:** Question
**Statement:** For org admins managing 5+ venues, what is the primary information need when accessing the CMS? "Which venues have problems?" or "What does the entire fleet look like right now?"
**Rationale:** The org admin home screen must be designed around the primary use case. These two needs produce very different designs: anomaly-first (show me problems) vs panoramic (show me everything). Neither is obviously right without research.
**Research approach:** Contextual observation of org admin CMS sessions. Observe: what do they look at first? What actions do they take? What information do they seek?
**Design implication:** Org admin dashboard primary view design depends on this answer.

---

**UXH-017** `[OPEN]`
**Domain:** Org-level entropy visibility
**Type:** Hypothesis
**Statement:** Org admins who have a cross-venue entropy dashboard take corrective action on high-entropy venues within 7 days of the entropy threshold being crossed more than 60% of the time.
**Rationale:** Org admins currently have no visibility into venue-level entropy without actively drilling into each venue. A cross-venue dashboard changes this to a push model — org admins see problems without seeking them.
**Test approach:** Compare time-to-action on entropy signals in venues with org admin cross-venue dashboard vs venues without.
**Design implication if validated:** Cross-venue entropy dashboard is a high-priority feature for org admin UX, not a nice-to-have.

---

## Section 6 — Technical-UX Interface Questions

---

**UXH-018** `[OPEN]`
**Domain:** Preview system design
**Type:** Question
**Statement:** Should the preview system show a static representation of the PRE output (e.g., "the first item in the playlist is X") or should it simulate actual playback (show items cycling at their specified durations)?
**Rationale:** A static representation is simpler to implement and easier to reason about. A simulated playback provides more accurate preview of the temporal experience. The choice depends on what operators actually need to verify.
**Research approach:** Prototype both approaches. Test with operators: "Verify that this screen will show what you expect." Measure: verification accuracy, time to complete.
**Design implication:** Whichever format produces higher verification accuracy and confidence is the correct implementation.

---

**UXH-019** `[OPEN]`
**Domain:** Resolution explorer design
**Type:** Question
**Statement:** How much resolution depth do operators need in the resolution explorer? Do they need to see all 6 levels evaluated (including skipped levels with explanations), or do they only need "what is resolving and why"?
**Rationale:** Full resolution trace (all levels, including null levels) gives complete explainability but may be overwhelming. Minimal trace (only winning rule) is cleaner but may leave unexplained "but why isn't X showing?"
**Research approach:** Present operators with both formats when investigating "why is screen showing Y instead of X?" scenarios. Measure: task completion rate, time to answer, comprehension confidence.
**Design implication:** If operators need to understand skipped levels (e.g., "why didn't my schedule work?"), full trace is required. If they only need the winning rule, minimal trace is sufficient.

---

*End of UX-HYPOTHESES-AND-QUESTIONS.md v1.0*
*Append new hypotheses and questions as design work surfaces unknowns.*
*Update status tags as research findings accumulate.*
*Validated hypotheses should update OPERATOR-MENTAL-MODELS.md and REAL-WORLD-OBSERVATIONS.md with confirmed findings.*
