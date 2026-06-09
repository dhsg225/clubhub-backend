# ClubHub TV — Future Experiments
# Shared Operational Intelligence Layer

**Document type:** Living experimental roadmap — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document catalogs experiments that the ClubHub TV platform should run to validate architectural decisions, test operator behavior hypotheses, and identify opportunities for system improvement. These are structured experiments — not feature requests or product ideas — that generate evidence for decisions that cannot be made on intuition alone.

An experiment has: a question it answers, a hypothesis it tests, a measurable outcome, and a defined success criterion. An experiment that does not meet these criteria is not an experiment — it is a feature idea that belongs in the product backlog.

---

## Experiment Status Tags

- `[DESIGNED]` — Experiment fully designed; ready to run when conditions are met.
- `[BLOCKED]` — Cannot run until a dependency is resolved.
- `[RUNNING]` — Currently in progress.
- `[COMPLETE]` — Finished; results documented.
- `[CANCELLED]` — No longer relevant; reason noted.

---

## Experiment Priority Tiers

**Tier 1 — Pre-Launch Critical:** Must be run before the platform scales to 5+ venues. Results inform architectural decisions that are hard to reverse.

**Tier 2 — Early Deployment:** Run in first 3–6 months of multi-venue operation. Results inform UX and operational workflow design.

**Tier 3 — Scale:** Run as platform grows to 20+ venues. Results inform cross-venue management and platform architecture decisions.

---

## Section 1 — Tier 1: Pre-Launch Critical

---

**EXP-001** `[DESIGNED]`
**Title:** Override expiry field position impact
**Tier:** 1
**Question answered:** Does making the expiry field the first field in override creation reduce permanent (null expiry) override creation?
**Hypothesis:** UXH-002 (expiry-first reduces permanent overrides by >50%)
**Method:**
- Venue A: Override creation form with expiry as first required field.
- Venue B: Override creation form with expiry as last optional field.
- Run for 90 days each (or sufficient N to reach statistical significance).
- Measure: percentage of created overrides with `expires_at IS NULL`.
**Success criterion:** Venue A shows >50% reduction in null-expiry overrides vs Venue B.
**Minimum viable sample:** 30 override creation events per variant to detect 50% effect size.
**Dependencies:** Two venues operational simultaneously with different form configurations.
**Expected duration:** 90 days.
**Design decision this unlocks:** Override creation form field order.

---

**EXP-002** `[BLOCKED — requires preview system deployment]`
**Title:** Preview system mental model impact
**Tier:** 1
**Question answered:** Does access to the preview system at campaign creation time reduce coverage gap discoveries (complaints, screen audits) within 7 days of campaign publication?
**Hypothesis:** UXH-003 (coverage map reduces gap discoveries)
**Blocking dependency:** Preview system must be deployed and accessible from campaign creation workflow.
**Method:**
- Pre-preview baseline: measure coverage gap discovery events per campaign publication (complaints, operator manual checks, bug reports about "wrong content").
- Post-preview: measure same metrics with preview accessible at publication.
- Compare rates with pre-preview baseline.
**Success criterion:** >50% reduction in post-publication coverage gap discoveries.
**Confound risk:** Operator learning curve may independently reduce errors over time. Run with control group (venues without preview access) to isolate preview effect.
**Expected duration:** 60 days post-preview deployment.

---

**EXP-003** `[DESIGNED]`
**Title:** Emergency activation friction impact
**Tier:** 1
**Question answered:** Does adding friction (reason field + usage count display + alternative offer) to the emergency activation flow reduce non-emergency emergency activations?
**Hypothesis:** UXH-007 (usage count display reduces misuse >40%) + UXH-008 (alternative offer reduces misuse >30%)
**Method:**
- Baseline: measure emergency activation frequency and average duration over 60-day period before friction is added.
- Intervention: add reason field (required), usage count display, and "Create Operational Override" alternative link.
- Measure: activation frequency, average duration, and percentage of activations with duration < 4 hours (proxy for operational misuse) for 60 days post-intervention.
**Success criterion:** >30% reduction in short-duration (<4 hour) emergency activations, with no increase in genuine emergency response time.
**Risk:** Friction may delay genuine emergency response. Measure time-to-activate for legitimate emergencies (must not increase).
**Expected duration:** 120 days total (60 baseline + 60 post-intervention).

---

**EXP-004** `[DESIGNED]`
**Title:** 3-month entropy review advisory effectiveness
**Tier:** 1
**Question answered:** Does a scheduled "3-month health review" advisory prompt operators to take entropy-reducing actions?
**Hypothesis:** OBS-007 (3-month mark is highest-leverage entropy intervention point)
**Method:**
- Control: venues with no proactive entropy advisory.
- Intervention: venues that receive a structured "3-month content health review" advisory with a guided workflow for reviewing overrides, schedules, and content age.
- Measure: entropy score (M-01 through M-12 composite) at 6 months in both groups.
**Success criterion:** Intervention venues show significantly lower 6-month entropy scores than control venues.
**Expected duration:** 6 months per venue cohort.

---

## Section 2 — Tier 2: Early Deployment

---

**EXP-005** `[BLOCKED — requires sufficient operator base]`
**Title:** Role-appropriate interface depth
**Tier:** 2
**Question answered:** Does a simplified shift manager interface (vs full CMS) reduce override and emergency misuse without reducing task completion rate?
**Hypothesis:** UXH-011 (simplified interface reduces entropy-producing choices)
**Blocking dependency:** Sufficient shift manager users to power a valid comparison.
**Method:**
- Venue A: Shift managers see simplified interface (What's Playing + Quick Change only).
- Venue B: Shift managers see full CMS interface.
- Measure: override creation rate, emergency activation rate, task completion rate, error rate, time-on-task.
**Success criterion:** Simplified interface group shows >30% lower override creation rate with equivalent task completion rate.
**Risk:** Simplified interface may frustrate capable shift managers. Include operator satisfaction measurement.
**Expected duration:** 90 days.

---

**EXP-006** `[DESIGNED]`
**Title:** Advisory format comparison for prospective impact
**Tier:** 2
**Question answered:** Which format for prospective entropy impact communication produces the highest correct interpretation rate? (UXH-015)
**Formats to test:**
1. Percentage: "Total SOV will be 78%"
2. Before/after: "Sponsor content: 40% → 78% | Editorial content: 60% → 22%"
3. Natural language: "After this addition, more than 3 in 4 minutes of screen time will be sponsor content"
4. Visual: Pie chart showing before/after distribution
**Method:**
- Usability research with 5–8 venue managers per format.
- Present each format when simulating sponsor contract addition.
- Measure: correct interpretation rate, decision quality, time to understand.
**Success criterion:** Identify format with >80% correct interpretation rate.
**Expected duration:** 2–3 weeks of research sessions.
**Design decision this unlocks:** Format for all prospective impact communications.

---

**EXP-007** `[DESIGNED]`
**Title:** Override rationale prompt impact on audit trail quality
**Tier:** 2
**Question answered:** Does prominently prompting operators for an override rationale at creation time (optional, but featured) increase audit trail quality (percentage of overrides with non-empty rationale) without increasing workflow abandonment?
**Method:**
- Control: Rationale field present but not prominently featured.
- Intervention: Rationale field with prompt text "Why is this content change needed? (This helps future managers understand the context)" prominently positioned.
- Measure: percentage of overrides with non-empty rationale, override creation workflow completion rate.
**Success criterion:** >50% of overrides have non-empty rationale, with <5% increase in workflow abandonment.
**Expected duration:** 60 days.

---

**EXP-008** `[DESIGNED]`
**Title:** Priority range width advisory threshold calibration
**Tier:** 2
**Question answered:** At what priority range width does operator confusion about schedule competition become operationally significant?
**Method:**
- Analyze support ticket and operator feedback content for priority-related confusion ("why isn't my content showing?") across venues.
- Correlate with priority range width (M-04) at time of confusion event.
- Identify the range width threshold at which confusion events begin occurring.
**Success criterion:** Identify specific threshold values for ADVISORY and REVIEW levels with data-backed confidence.
**Expected duration:** Ongoing, 6+ months of data.
**Design decision this unlocks:** M-04 threshold configuration.

---

## Section 3 — Tier 3: Scale

---

**EXP-009** `[BLOCKED — requires 10+ venues]`
**Title:** Cross-venue entropy pattern analysis
**Tier:** 3
**Question answered:** Do entropy patterns cluster by venue type, operator experience, or other factors? Are there leading indicators that predict which venues will develop high entropy?
**Method:**
- Multi-venue longitudinal analysis of entropy metrics (M-01 through M-12).
- Cluster analysis to identify venue cohorts with similar entropy trajectories.
- Correlation with: venue type, operator role composition, training quality, CMS usage frequency, deployment age.
**Success criterion:** Identify 2–3 leading indicators that predict high-entropy venues at 3 months with >75% accuracy.
**Expected duration:** 12 months of multi-venue data.
**Design decision this unlocks:** Proactive entropy intervention targeting for high-risk venue profiles.

---

**EXP-010** `[BLOCKED — requires 10+ venues]`
**Title:** Org-admin cross-venue dashboard action rate
**Tier:** 3
**Question answered:** When org admins have a cross-venue entropy dashboard, how frequently do they take action on entropy signals, and what entropy improvements result? (UXH-017)
**Method:**
- Baseline: org admins with no cross-venue dashboard. Measure entropy improvement events (reduction in M-01 through M-12 scores following org admin action).
- Intervention: org admins with cross-venue entropy dashboard. Measure same.
**Success criterion:** >60% of venues crossing an entropy threshold receive org admin-initiated corrective action within 7 days.
**Expected duration:** 12 months.

---

**EXP-011** `[BLOCKED — requires live data integration feasibility assessment]`
**Title:** Live data integration operator satisfaction
**Tier:** 3
**Question answered:** If live data integration is available (e.g., jackpot values, tee time availability), does operator satisfaction with the system increase significantly compared to venues without live data?
**Method:**
- Operator satisfaction survey at 6 months.
- Compare: venues with live data integration vs venues without.
- Measure: operator satisfaction score, system usage frequency, NPS.
**Success criterion:** Live data venues show >20% higher satisfaction score.
**Expected duration:** 6 months post-live-data deployment.

---

## Section 4 — Platform Architecture Experiments

---

**EXP-012** `[DESIGNED]`
**Title:** 15-second poll cycle operator perception
**Tier:** 2
**Question answered:** Do operators perceive the 15-second poll latency as acceptable for their operational needs, or is it a source of frustration?
**Method:**
- Structured usability sessions where operators make changes and observe the update propagation.
- Timing observation: how often do operators check the screen immediately after a change? How long do they wait?
- Satisfaction survey question: "How quickly does the system apply your changes? Is this fast enough for your needs?"
**Success criterion:** >70% of operators rate 15-second update latency as "acceptable" or "fast enough."
**Design decision this unlocks:** Whether latency reduction investment is warranted. If acceptable: no action. If not acceptable: evaluate push notification architecture.
**Expected duration:** 2–3 weeks of research sessions.

---

**EXP-013** `[DESIGNED]`
**Title:** Corpus replay harness confidence in PRE correctness
**Tier:** 1
**Question answered:** Does the 9-packet corpus (GOLD-001 through CHAOS-001) provide sufficient coverage to catch PRE regressions before they reach production?
**Method:**
- Deliberately introduce 5 known PRE behavior regressions (in a test branch).
- Run the corpus replay harness against the regressed implementation.
- Measure: which regressions are detected, which are missed.
**Success criterion:** Corpus detects >80% of the introduced regressions. Gaps identified in corpus coverage are addressed by adding new packets.
**Expected duration:** 2–3 days engineering work.
**Design decision this unlocks:** Whether corpus expansion is needed before the PRE implementation goes live.

---

**EXP-014** `[DESIGNED]`
**Title:** Priority mental model correction via in-context tooltip
**Tier:** 2
**Question answered:** Does displaying a contextual tooltip explaining the priority system (specifically that it only operates within Level 3 and cannot override Level 1 overrides) at the moment of schedule priority field interaction reduce priority escalation behavior?
**Method:**
- Control: Priority field with no additional guidance.
- Intervention: Priority field with tooltip: "Priority determines which schedule 'wins' when multiple schedules target the same screen. It has no effect on Operational Overrides (which always take priority)."
- Measure: Schedule priority escalation patterns (M-04) and self-reported "priority doesn't seem to work" support contact rate.
**Success criterion:** Intervention group shows <20% lower priority range width growth over 90 days.
**Expected duration:** 90 days.

---

## Section 5 — Emergency Procedure Validation

---

**EXP-015** `[DESIGNED]`
**Title:** Genuine emergency activation response time under friction
**Tier:** 1 — SAFETY-CRITICAL
**Question answered:** Does adding the reason field and usage count display to emergency activation increase response time for genuine emergencies?
**Rationale:** EXP-003 tests friction for misuse reduction, but must verify no degradation in genuine emergency response.
**Method:**
- Tabletop exercise: present operators with simulated genuine emergency scenario ("fire alarm has sounded, activate emergency now").
- Measure: time from scenario presentation to successful emergency activation.
- Test with and without friction elements.
**Success criterion:** Friction elements add <10 seconds to genuine emergency activation time.
**Critical threshold:** If friction adds >30 seconds to genuine emergency response, the friction design must be reconsidered.
**Expected duration:** 1–2 days of tabletop exercises.

---

*End of FUTURE-EXPERIMENTS.md v1.0*
*Append new experiments as design questions emerge.*
*Update status tags as experiments are initiated and completed.*
*Results must be documented in this file and the relevant hypothesis in UX-HYPOTHESES-AND-QUESTIONS.md updated.*
