# Certification and Simulation Operations
## Governing the Operation of Certification, Drills, Rehearsal, and Institutional Readiness
### Version 1 — Phase J, Operator Simulation and Replay Intelligence Era

---

## 1. Purpose and Governing Principle

This document governs the actual operation of the certification, rehearsal, and institutional readiness infrastructure for ClubHub TV.

Documentation of procedures is insufficient. The procedures must be exercised, validated, and continuously renewed. Operators who were certified two years ago and have not rehearsed since then may carry credentials that no longer reflect their operational capability. The certification infrastructure exists to ensure that credentials reflect current, demonstrable competence.

The governing principle:

> **Certification is evidence of capability, not a permanent credential. Competence that is not exercised is competence that degrades.**

Simulation and certification operations are treated with aviation-grade seriousness: formal authority hierarchies, explicit pass/fail criteria, immutable examination records, mandatory recertification cadences, and no social exceptions to failure standards.

---

## 2. Certification Authority Hierarchy

### 2.1 Level 1 — Certification Administrator

**Role:** Manages scheduling, logistics, and record-keeping for certification sessions.

**Authority:**
- Schedule certification examinations
- Assign operators to examination sessions
- Record outcomes in the certification register
- Issue certification credentials upon passing

**May not:**
- Modify examination scenarios
- Override pass/fail determinations
- Grant temporary certifications

### 2.2 Level 2 — Certification Examiner

**Role:** Conducts certification examinations and makes initial pass/fail determinations.

**Authority:**
- All Level 1 authority
- Conduct live certification examination sessions
- Make initial pass/fail determination based on examination rubric
- Provide post-examination feedback to candidates
- Recommend remediation paths for candidates who do not pass

**May not:**
- Override a fail determination without Level 3 review
- Modify the examination rubric
- Grant emergency certifications

### 2.3 Level 3 — Certification Authority

**Role:** Governs the certification system, resolves disputes, and authorizes exceptions.

**Authority:**
- All Level 2 authority
- Override a fail determination following documented review
- Grant emergency temporary certification (see §12)
- Modify examination rubrics following governance review
- Decertify operators (see §14)
- Suspend certifications (see §15)
- Approve new certification scenarios for operational use
- Review appeals of certification decisions

**There is one Certification Authority per platform operator.** This is not a role that can be delegated broadly. Certification Authority is a named position with accountability for the integrity of the entire certification record.

### 2.4 Level 4 — Platform Certification Governance

**Role:** Governs the certification system at the platform level across all operator organizations.

**Authority:**
- Define minimum certification requirements for each role level
- Define mandatory certification scenario categories
- Approve changes to certification tier definitions
- Review systematic certification failures across multiple operator organizations
- Authorize changes to certification retention and recertification cadences

---

## 3. Certification Tier Definitions

### Tier 0 — Orientation Complete

**Grants:** System access in observer mode. May view all operational surfaces. May not execute any operational commands.

**Requirements:** Completion of onboarding orientation curriculum. No examination required.

**Recertification:** None. Tier 0 does not expire.

### Tier 1 — Operational Basic

**Grants:** Ability to execute scheduled operational tasks, acknowledge alerts, and escalate to higher tiers.

**Requirements:**
- Written examination: system architecture, information surface navigation, alert semantics
- Simulation examination: 2 scenarios at BASELINE stress, passing score on both
- Supervised live session: minimum 2 hours under Tier 3 observation

**Recertification:** Annual examination. Annual simulation drill.

### Tier 2 — Operational Standard

**Grants:** Full operational authority for standard incidents. May handle all incident severity levels up to HIGH. May not handle CRITICAL incidents without Tier 3 confirmation.

**Requirements:**
- Tier 1 certification active for minimum 90 days
- Written examination: incident response procedures, runbook contents, escalation protocol
- Simulation examination: 3 scenarios at INFORMATION_DEGRADED stress, passing score on all
- Demonstrated resolution of 5 distinct incident types (corpus-evidenced, not self-reported)

**Recertification:** Annual examination. Semi-annual simulation drill. 12 documented incident resolutions per year.

### Tier 3 — Operational Expert

**Grants:** Full operational authority including CRITICAL incidents. May supervise Tier 1 and Tier 2 operators. May serve as on-call primary for multi-venue operations.

**Requirements:**
- Tier 2 certification active for minimum 6 months
- Written examination: advanced incident patterns, governance kernel behavior, multi-venue coordination
- Simulation examination: 4 scenarios including at least 1 at FULL_STRESS, passing score on all
- Demonstrated leadership in 3 multi-operator incident resolutions (corpus-evidenced)

**Recertification:** Annual examination. Quarterly simulation drill. 24 documented incident resolutions per year.

### Tier 4 — Certification Examiner

**Grants:** Authority to conduct certification examinations. All Tier 3 operational authority.

**Requirements:**
- Tier 3 certification active for minimum 12 months
- Examiner training: 40 hours formal curriculum
- Supervised examination delivery: 5 examinations co-delivered with existing Level 2 examiner
- Certification Authority endorsement

**Recertification:** Annual examination. Examiner peer review.

---

## 4. Recertification Cadence

| Certification Tier | Written Examination | Simulation Drill | Operational Evidence |
|---|---|---|---|
| Tier 1 | Annual | Annual | None |
| Tier 2 | Annual | Semi-annual | 12 incidents/year |
| Tier 3 | Annual | Quarterly | 24 incidents/year |
| Tier 4 | Annual | Quarterly (as operator) | Peer review |

### 4.1 Recertification Timing

Recertification examinations must be completed within 30 days before the certification expiry date. Certifications do not auto-renew. A certification that reaches its expiry date without a completed recertification becomes EXPIRED automatically.

An EXPIRED certification suspends the operator from the authorities granted by that tier. The operator retains the immediately lower tier's authorities until recertification is completed.

### 4.2 Recertification Failure

If an operator fails a recertification examination, they have one remediation opportunity within 30 days. If they do not pass within that window, the certification is SUSPENDED (see §15).

A second recertification failure within a 12-month period triggers a full capability review by the Certification Authority before a third attempt is permitted.

---

## 5. Incident Drill Governance

### 5.1 Purpose

Drills are not examinations. They are operational rehearsal. The purpose is to exercise procedures, build muscle memory, identify procedural gaps, and ensure operators remain comfortable with response protocols for infrequent but critical scenarios.

Drill outcomes are not used in certification records. They are used in training records.

### 5.2 Drill Scheduling

| Tier | Minimum Drill Frequency | Minimum Scenario Categories Per Drill |
|---|---|---|
| Tier 1 | Quarterly | 1 |
| Tier 2 | Bi-monthly | 2 |
| Tier 3 | Monthly | 3 |

Drill scheduling is the responsibility of the Certification Administrator. Drills must be conducted on a predictable cadence; unscheduled surprise drills require Certification Authority approval.

### 5.3 Drill Structure

1. **Pre-drill brief** — scenario context, learning objectives, no spoilers about specific events
2. **Execution** — operators respond as if live; instructors observe but do not guide
3. **Immediate debrief** — what happened, what worked, what didn't, no blame
4. **Documented findings** — procedures that need update, UI surfaces that caused confusion, gaps identified
5. **Follow-up tracking** — findings enter a tracked queue; they are reviewed at the next drill

### 5.4 Drill Scenario Selection

Drills should include:
- At least one scenario type from the preceding 90 days' actual incident corpus (to rehearse real patterns)
- At least one scenario type that has not appeared in the preceding 90 days (to prevent skill decay for rare events)
- At least one scenario that exposed a training gap in the previous drill

---

## 6. Stress Inoculation Sequencing

Operators must not be introduced to high-stress certification scenarios before they have demonstrated baseline competence. Stress inoculation is progressive and structured.

### 6.1 Inoculation Path

| Stage | Stress Level | Prerequisite | Purpose |
|---|---|---|---|
| 1 | BASELINE | Orientation complete | Establish baseline response patterns |
| 2 | INFORMATION_DEGRADED | 30 days at Tier 1 | Learn to act under incomplete information |
| 3 | MULTI_EVENT | Tier 1 certified | Learn to prioritize concurrent demands |
| 4 | COORDINATION_STRESS | 90 days at Tier 1 | Learn to operate with unreliable role support |
| 5 | FULL_STRESS | Tier 2 certified | Demonstrate resilience under maximum degradation |

### 6.2 Inoculation Governance

An operator who fails at a stress level returns to the previous level for additional rehearsal before reattempting. The inoculation path may not be compressed: an operator who has not passed Stage 3 may not attempt Stage 4.

### 6.3 Post-Stress Protocol

After any FULL_STRESS simulation session:
- A 15-minute decompression break is mandatory before any review
- The review session begins with a facilitator check-in, not immediately with performance critique
- Findings from FULL_STRESS sessions are reviewed against the scenario design — poor outcomes may indicate scenario design problems, not only operator gaps

---

## 7. Replay-Driven Examination

### 7.1 Examination from Real Events

Certification examinations may use replay-derived simulation, seeding the examination from actual incidents in the corpus.

This approach has significant advantages:
- Scenarios are rooted in real operational conditions
- The correct response is evidenced by how the incident was actually resolved (or could have been)
- Examination scenarios remain current as the corpus grows

### 7.2 Replay Selection Criteria

Replay packets used for certification examination must:
- Be Tier 1 corpus records with trust score ≥ 0.8
- Cover the incident category declared in the examination rubric
- Have been verified for fidelity against current system behavior
- Not have been used in a previous examination of the same candidate within 12 months

### 7.3 Counterfactual Examination Scenarios

Counterfactual scenarios (see OPERATOR-SIMULATION-RUNTIME-v1.md §2.4) are used for advanced certification levels where the examination tests not just whether the operator can follow the known correct path, but whether they can identify the optimal path when the outcome is not predetermined.

Counterfactual scenarios may only be used at Tier 2 and above.

---

## 8. Failure Replay Review Process

### 8.1 Purpose

When an operator fails a certification examination, or when a drill reveals a significant operational gap, a failure replay review is conducted.

The failure replay review is:
- A learning conversation, not a disciplinary proceeding
- Focused on understanding what the operator understood at the time of the failure
- Aimed at identifying whether the failure originated in training gaps, procedure gaps, or system design issues

### 8.2 Review Conduct

The failure replay review is conducted by a Certification Examiner (Level 2 or above) with the candidate present. It uses the simulation replay artifacts to reconstruct what the candidate saw, what they did, and at what points the response diverged from the expected path.

The review must:
1. Walk through the simulation timeline with the candidate
2. At each divergence point, ask the candidate what information they were using and what they intended
3. Distinguish between: incorrect information interpretation, missing knowledge, and correct interpretation of incorrect information surfaced
4. Produce a classified finding for each significant divergence

### 8.3 Finding Classification

| Classification | Description | Remediation |
|---|---|---|
| KNOWLEDGE_GAP | The operator did not know something that the training curriculum declares they should know | Targeted curriculum review |
| PROCEDURE_GAP | The operator knew the system but did not know the procedure | Runbook study and drill |
| INFORMATION_SURFACE_FAILURE | The system did not surface the information needed for the correct decision | UI/UX improvement recommendation |
| STRESS_THRESHOLD | The operator's response degraded significantly under stress conditions that are within the certification tier's requirements | Stress inoculation reset |
| SCENARIO_DESIGN_FAILURE | The scenario's expected response path was ambiguous or used information that the operator role would not realistically have | Scenario redesign |

### 8.4 Findings Use

Failure review findings inform:
- The operator's individualized remediation plan
- Training curriculum revisions (if KNOWLEDGE_GAP or PROCEDURE_GAP findings cluster across many candidates)
- Scenario revisions (if SCENARIO_DESIGN_FAILURE findings recur)
- System improvement requests (if INFORMATION_SURFACE_FAILURE findings recur)

Failure review findings do not feed directly into any operational consequence beyond the certification outcome.

---

## 9. Simulation Graduation Requirements

To graduate from training simulation to live operational authority:

### 9.1 Graduation Criteria

An operator has completed training simulation when:
- All required simulation scenarios for their target tier have been completed
- Passing scores achieved on all examination scenarios
- Stress inoculation sequence completed to the level required for their tier
- Failure replay reviews (if any) documented and remediation completed

### 9.2 Supervised Transition Period

Graduation from simulation does not mean immediate unsupervised operational authority. Each tier has a supervised transition period during which the operator works alongside a certified operator at the tier above:

| Tier | Supervised Transition Period |
|---|---|
| Tier 1 | 2 hours minimum live session observation |
| Tier 2 | 5 shifts alongside Tier 3 operator |
| Tier 3 | 3 CRITICAL incident responses alongside existing Tier 3, documented |

The supervising operator signs the transition completion record. They attest that the candidate has demonstrated the capabilities of the target tier under live conditions.

### 9.3 Incomplete Transition

If during the supervised transition period the candidate demonstrates a significant gap:
- The transition period is extended
- A specific remediation target is declared
- If the gap persists, the candidate is returned to simulation

A supervised transition period may not exceed 60 days. If the candidate has not demonstrated the target tier capabilities within 60 days, the training path is reviewed by the Certification Authority.

---

## 10. Multi-Role Certification Coordination

### 10.1 Role Interdependency

Some certification scenarios require multiple roles to function correctly. A Tier 3 operator who is being certified on CRITICAL incident response cannot be evaluated properly if the Tier 1 and Tier 2 operators in the same scenario are played by simulated roles at FIDELITY_LOW.

### 10.2 Coordination Requirements

For multi-role certification scenarios:
- Roles that have a significant impact on the candidate's assessed behavior must be played by certified operators or FIDELITY_HIGH simulated roles
- The choice of human vs. simulated supporting roles is declared in the scenario and does not change between examination sessions
- If human supporting role players are used, they may not be evaluating the candidate simultaneously (role conflict)

### 10.3 Cross-Venue Certification

When certifying operators who will work across multiple venues:
- At least one certification scenario must include multi-venue coordination complexity
- The operator must demonstrate familiarity with venue-specific configuration differences
- Cross-venue certification is at the Certification Authority's discretion and is documented separately from standard tier certification

---

## 11. Emergency Operator Qualification

### 11.1 Emergency Context

In rare circumstances — unexpected operator unavailability, rapid venue expansion, disaster response — an operator may need to be given operational authority before full certification is complete.

Emergency qualification is not a shortcut. It is a governed exception with explicit constraints.

### 11.2 Emergency Qualification Authority

Emergency qualification is granted only by the Certification Authority (Level 3). It may not be granted by a Certification Examiner alone.

### 11.3 Emergency Qualification Conditions

Emergency qualification may be granted when:
1. A specific operational need has been declared (named venue, named period, named operational requirement)
2. No fully certified operator is available for that need within the required timeframe
3. The candidate has completed at minimum the Tier 1 written examination
4. A fully certified operator at Tier 3 agrees to remain available for escalation during the emergency qualification period

### 11.4 Emergency Qualification Constraints

Emergency qualification grants only the authorities explicitly listed in the qualification document. It does not grant full tier authorities.

Duration is limited to 30 days. The operator must complete full certification requirements before day 30 or the emergency qualification lapses.

The qualifying operator's activity during the emergency qualification period is flagged in the operational record for review by the Certification Authority.

---

## 12. Decertification Triggers

Decertification removes a certification credential and revokes the operational authority it granted.

### 12.1 Automatic Decertification Triggers

The following trigger automatic decertification review by the Certification Authority:

- **Certification EXPIRY without recertification** — automatic downgrade to lower tier, not full decertification, unless the lower tier has also expired
- **CRITICAL incident involving governance failure attributable to operator action** — triggers review within 7 days
- **Two failed recertification attempts within 12 months** — triggers capability review before third attempt
- **Corpus evidence of systematic procedure deviation** — recurring deviation from declared procedures in documented incidents, confirmed by forensic review

### 12.2 Discretionary Decertification

The Certification Authority may initiate decertification review based on:
- Pattern of concerning operational behavior identified through aggregate analytics (with individual forensic review)
- Request from an operator organization following an internal review
- Evidence that the certification examination was not conducted with integrity

### 12.3 Decertification Process

Decertification is a governed process:
1. Certification Authority initiates formal review
2. Candidate is notified and receives the evidence basis
3. Candidate has 14 days to respond
4. Certification Authority makes determination, with documentation
5. Determination is recorded in the certification register
6. If decertified, the candidate may reapply for certification at the base level after a declared waiting period

No decertification takes effect without the full process above. Unilateral decertification without process is not permitted.

---

## 13. Temporary Certification Suspension

### 13.1 Suspension vs. Decertification

Suspension is a temporary measure that removes operational authority while a review is in progress. It is not a finding of fault. It is a precautionary state.

Decertification is a permanent removal of the credential following a completed review.

### 13.2 Suspension Authority

Suspension may be invoked by a Certification Examiner (Level 2) pending Certification Authority review when:
- An incident of CRITICAL severity has occurred and the operator's actions are under forensic review
- An immediate risk to operational safety exists if the operator retains authority during the review period

The Certification Authority must confirm or revoke the suspension within 72 hours of it being invoked.

### 13.3 Suspension Period

A suspension may not exceed 30 days without a formal determination. If the review cannot be completed within 30 days, the Certification Authority must make a decision to either:
- Extend the suspension with documented justification
- Reinstate the certification pending ongoing review
- Proceed to decertification

---

## 14. Certification Evidence Artifacts

Every certification outcome must be supported by the following artifacts, stored in the certification register:

1. **Session manifest** — candidate identity, tier being examined, examination date, examiner identity
2. **Scenario list** — all scenarios used in the examination with corpus packet references
3. **Simulation artifacts** — operator action logs from all examination sessions
4. **Rubric records** — the rubric used, the examiner's assessment of each rubric element, with evidence citations
5. **Pass/fail determination** — the formal determination with basis
6. **Examiner attestation** — signed statement by examining Level 2 or above
7. **Candidate acknowledgment** — the candidate's acknowledgment of the outcome (they may note disagreement)

Artifacts are retained for 5 years from the certification date.

### 14.1 Artifact Integrity

Certification artifacts are immutable once committed. Corrections are made via governed annotation. No retroactive modification of a pass/fail determination is permitted without Level 3 review.

---

## 15. Constitutional Pass/Fail Requirements

### 15.1 The Constitutional Standard

A certification examination is passed when the candidate has demonstrated the specific capabilities required for the target tier in a governed examination with full artifact documentation.

The standard is not "good enough relative to other candidates." It is not "passed with reservations." It is either PASS or FAIL.

### 15.2 Mandatory Pass Criteria

For every certification tier, the following are mandatory pass criteria. These may not be waived by any authority level:

**Tier 1:**
- Correctly identified the correct escalation path for at least 3 of 4 escalation scenarios
- Did not initiate an action that would have caused operational harm in the simulation
- Correctly used the information surface to locate the relevant data for each scenario decision

**Tier 2:**
- All Tier 1 criteria
- Resolved at least 2 of 3 simulation scenarios to declared successful outcomes within time limits
- Correctly identified when to escalate vs. when to act independently in all scenarios

**Tier 3:**
- All Tier 2 criteria
- Led the multi-operator scenario to resolution with correct delegation and escalation
- Demonstrated correct governance kernel understanding in at least one FULL_STRESS scenario

**Tier 4 (Examiner):**
- All Tier 3 criteria
- Conducted a mock examination session with correct rubric application
- Demonstrated correct failure replay review technique

---

## 16. "Confidence Without Competence" Detection

### 16.1 The Risk

An operator who acts with high confidence and low accuracy is more operationally dangerous than an operator who is uncertain and proceeds cautiously. Confidence without competence produces fast, authoritative actions that are wrong.

Certification must be able to detect this pattern.

### 16.2 Detection Indicators

**HIGH_CONFIDENCE_WRONG_ACTIONS:** The operator acts quickly and decisively in scenarios where the correct action requires gathering additional information first. The action is wrong; the confidence is high.

**ESCALATION_AVOIDANCE:** The operator consistently handles incidents without escalation even when the incident's complexity or severity is within the declared "escalate" criteria. This may indicate reluctance to signal uncertainty, not genuine competence.

**SCENARIO_PATTERN_MATCHING:** The operator applies a response pattern from a previous scenario to a current scenario that differs in critical ways. The surface pattern matches; the relevant differences do not register.

**POST-ACTION_RATIONALIZATION:** During the failure replay review, the operator expresses certainty about their rationale, but the rationale they describe is inconsistent with the information surface they had at the time.

### 16.3 Response

Confidence-without-competence detection is not a binary pass/fail signal. It is an indicator that an examiner uses to probe deeper.

If the examiner identifies this pattern during a certification examination:
- They note it in the rubric record
- They add additional probing questions during the post-simulation review
- If the pattern holds, it informs a FAIL determination
- The failure replay review specifically addresses confidence calibration

This pattern is treated as a training gap (specifically: gap in uncertainty acknowledgment and appropriate caution), not a character assessment.

---

## 17. Simulation Abuse Prevention

### 17.1 What is Simulation Abuse

Simulation abuse occurs when the simulation infrastructure is used in ways that undermine its legitimate purposes:

- Using simulations to covertly assess operators without their knowledge (prohibited by OPERATOR-SIMULATION-RUNTIME-v1.md §13.3)
- Designing scenarios intended to produce failure rather than learning (prohibited by OPERATOR-SIMULATION-RUNTIME-v1.md §13.6)
- Using simulation outcomes as the sole basis for consequential HR decisions
- "Stress testing" as cover for punitive simulation exposure
- Using simulation to rehearse responses to governance challenges rather than operational challenges

### 17.2 Prevention Requirements

- All simulation sessions must be declared in the session manifest with their stated purpose
- Simulation purposes that appear inconsistent with training, rehearsal, or certification require Certification Authority review
- Operators may review the session manifests for all sessions in which they participated
- An operator may raise a concern about simulation purpose with the Certification Authority without consequence

### 17.3 Reporting

If an operator believes they have been subject to simulation abuse, they may report to the Platform Certification Governance (Level 4) directly, bypassing the operator organization's Certification Authority.

Platform Certification Governance investigates simulation abuse reports and publishes anonymized findings in the annual certification integrity report.

---

## 18. Long-Duration Readiness Tracking

### 18.1 Readiness Degradation

Operational competence degrades without practice. A Tier 3 operator who has not encountered a CRITICAL incident for 8 months and has not completed their quarterly drill is less ready than their certification record suggests.

Long-duration readiness tracking identifies this gap between credential and actual current state.

### 18.2 Readiness Indicators

**DRILL_COMPLETION_CURRENCY:** Has the operator completed all drills required by their tier in the preceding certification period?

**INCIDENT_CURRENCY:** Has the operator handled incidents that demonstrate the capabilities of their tier within the certification period?

**KNOWLEDGE_CURRENCY:** Has significant system change occurred since the operator's last written examination, and has the operator completed the change briefing curriculum?

### 18.3 Readiness Status Classification

| Status | Meaning |
|---|---|
| CURRENT | All readiness indicators met |
| DRILL_OVERDUE | One or more required drills not yet completed |
| INCIDENT_GAP | Insufficient incident exposure for tier requirements |
| KNOWLEDGE_GAP_FLAG | Significant system changes since last written examination |
| PENDING_REVIEW | Certification active but readiness review requested |
| RECERTIFICATION_DUE | Within 60 days of certification expiry |

DRILL_OVERDUE and KNOWLEDGE_GAP_FLAG are visible to the operator and their supervisor. They are not operational disqualifiers. They are prompts to schedule remediation.

---

## 19. Institutional Readiness Metrics

Institutional readiness is the aggregate state of operational readiness across the operator population.

### 19.1 Metrics

**FLEET_CERTIFICATION_COVERAGE:** Percentage of operational shifts with at least one Tier 3-certified operator available per venue.

**DRILL_COMPLIANCE_RATE:** Percentage of required drills completed on schedule across all operators.

**CERTIFICATION_CURRENT_RATE:** Percentage of active operators whose certifications are CURRENT (not EXPIRED, SUSPENDED, or DRILL_OVERDUE).

**RECERTIFICATION_PASS_RATE:** Percentage of recertification examinations passed on first attempt. Trend over time indicates whether training is maintaining competence.

**INCIDENT_COVERAGE:** Percentage of incident types that have appeared in certification examination scenarios within the past 12 months. Low coverage indicates certification scenarios are not keeping pace with operational reality.

### 19.2 Readiness Floors

Operational policy must declare minimum readiness floors below which venues do not open or events do not proceed. These floors are policy decisions made by the operator organization; this document does not set them. But the certification infrastructure measures them.

### 19.3 Reporting Cadence

- Weekly: certification status dashboard for operational planning
- Monthly: institutional readiness report covering all metrics
- Quarterly: trend analysis with drill compliance, recertification rates, incident coverage
- Annual: full certification integrity report, published to all operators

---

## 20. Replay-Based Audit Procedures

### 20.1 Annual Certification Audit

The annual certification integrity audit verifies that:
- All certification examinations conducted in the year have complete, verified artifact sets
- A random sample of examination simulation artifacts can be replayed and produce consistent outcomes
- Pass/fail determinations are consistent with rubric records
- Emergency qualifications and suspensions were handled according to protocol
- No examination was conducted with an unqualified examiner

### 20.2 Incident-Triggered Audit

When a CRITICAL incident occurs:
- The certifications of all operators involved are reviewed for CURRENT status
- The relevant examination artifacts are retrieved and reviewed for coverage of the incident pattern
- If the incident type was not covered in the certification scenarios used, it is added to the next scenario update cycle
- Findings are incorporated into the nearest recertification examination

### 20.3 Audit Records

Audit records are maintained for the full retention period of the underlying certification artifacts. The audit record includes:
- What was audited
- Who conducted the audit
- What was found (with artifact citations)
- What follow-up was required
- Whether follow-up was completed

---

## 21. Ten Named Drill Scenarios

These represent the minimum required scenario categories that must appear in the drill library for each tier.

**DS-001 — SCHEDULE_DELIVERY_FAILURE**
The primary content delivery pathway fails mid-schedule. Operators must identify the failure, invoke the fallback pathway, and verify continuity. Multi-venue variant available.

**DS-002 — DEVICE_CLUSTER_DEGRADATION**
Three screens in a venue cluster fail simultaneously. Operators must assess the failure mode, determine whether it is systemic or isolated, and manage the audience experience while remediation is underway.

**DS-003 — AUTHORITY_ESCALATION_DRILL**
A governance decision requires Tier 3 authority but the primary Tier 3 operator is unavailable. Operators must correctly invoke the escalation procedure and operate within the constraints of waiting for authority confirmation.

**DS-004 — EMERGENCY_INTERRUPT_RESPONSE**
An emergency interrupt signal is received during a sponsored content window. Operators must correctly prioritize the interrupt over commercial content and verify propagation to all active screens within the required time window.

**DS-005 — MULTI_VENUE_CASCADE**
A network event causes degraded connectivity at 3 of 5 venues simultaneously. Operators must triage by venue severity, invoke venue-specific fallback procedures, and coordinate across venues without creating conflicting commands.

**DS-006 — REPLAY_MODE_TRANSITION**
The system is directed to transition a venue to replay mode following a live content delivery failure. Operators must correctly initiate the transition, verify 72-hour corpus availability, and communicate the transition to affected parties.

**DS-007 — OPERATOR_HANDOFF_UNDER_INCIDENT**
A shift handoff must occur while an active incident is in progress. The outgoing operator must brief the incoming operator with correct situational context, and the incoming operator must demonstrate sufficient situational awareness to take authority.

**DS-008 — CONFIGURATION_DRIFT_DISCOVERY**
A venue's device configuration is discovered to have drifted from the declared state during a routine check. Operators must correctly classify the drift severity, determine the safe remediation path, and execute it without creating an operational outage.

**DS-009 — INCOMPLETE_INFORMATION_RESPONSE**
Operators receive an alert that does not provide enough information to determine the correct response. The scenario tests whether operators correctly seek additional information before acting, rather than applying a pattern match to incomplete data.

**DS-010 — GOVERNANCE_BOUNDARY_TEST**
An operator is presented with a request from an authority source (simulated venue manager) to take an action that is outside the declared authority boundary for the operator's tier. The correct response is to decline and route to the appropriate authority, not to comply under social pressure.

---

## 22. Ten Named Certification Failure Patterns

These represent recurring patterns that lead to examination failure. They are documented here to inform curriculum design and examination rubric calibration.

**CF-001 — PREMATURE_ACTION**
The candidate acts before gathering the minimum information required to identify the correct action. Characterized by short information-gathering phase followed by high-confidence action that proves incorrect.

**CF-002 — ESCALATION_SUPPRESSION**
The candidate handles incidents beyond their tier's authority rather than escalating. May be motivated by desire to demonstrate competence, but results in out-of-scope action.

**CF-003 — PATTERN_LOCK**
The candidate identifies a superficial similarity to a known scenario type and applies the response pattern for that type without verifying that the current scenario matches the pattern's key conditions.

**CF-004 — INFORMATION_SURFACE_DEPENDENCE**
The candidate is unable to form a response when the expected information surface is unavailable or degraded. Has not learned to operate with incomplete information.

**CF-005 — PROCEDURE_INVERSION**
The candidate correctly identifies the steps required but executes them in the wrong order, producing a technically incorrect response even though the individual actions were all valid.

**CF-006 — CONFIRMATION_LOOP**
The candidate seeks repeated confirmation of information they already have before acting, consuming response time beyond the scenario's time constraints. May indicate uncertainty about information interpretation.

**CF-007 — MULTI_INCIDENT_PARALYSIS**
When multiple incidents are active simultaneously, the candidate is unable to prioritize and oscillates between incidents without resolving any. Has not internalized the prioritization framework.

**CF-008 — AUTHORITY_CONFUSION**
The candidate is uncertain about which authority level governs a specific type of decision and either acts outside their authority or incorrectly refuses to act within it.

**CF-009 — RECOVERY_ASSUMPTION**
The candidate assumes that an action they took was successful before receiving confirmation, and proceeds with a subsequent action that assumes the first succeeded. When the first action failed silently, the subsequent action causes additional degradation.

**CF-010 — DEBRIEF_RATIONALIZATION**
The candidate, during the failure replay review, constructs an explanation for their actions that is inconsistent with the information they had at the time. This indicates insufficient self-awareness about decision-making under pressure, which is itself a safety concern.

---

## 23. Readiness Degradation Indicators

The following indicators signal that institutional readiness is declining and require management intervention:

**DRILL_SKIP_PATTERN:** Three or more consecutive drill sessions where attendance was below 70% of required participants. Indicates organizational scheduling failure or low prioritization.

**RECERTIFICATION_FAIL_SPIKE:** First-attempt recertification failure rate exceeds 20% in a quarter. Indicates training is not maintaining competence, or the system changed significantly without curriculum update.

**INCIDENT_COVERAGE_GAP:** The certification scenario library has not been updated in 6 months and the incident corpus shows new pattern types that are not covered. Operators are not being certified on the incidents they are actually facing.

**EMERGENCY_QUALIFICATION_FREQUENCY:** Emergency qualifications are being issued at a rate of more than 2 per quarter. Indicates a staffing problem that is being addressed through exception rather than through building certified headcount.

**CERTIFICATION_EXPIRY_CLUSTER:** Multiple certifications expire in the same 30-day window without advance recertification. Indicates scheduling is not managing certification renewal proactively.

**STRESS_INDUCTION_REGRESSION:** An operator who previously passed FULL_STRESS scenarios is scoring below passing on INFORMATION_DEGRADED scenarios in recertification. Indicates a previously certified capability has degraded.

**DRILL_FINDING_ACCUMULATION:** Three consecutive drills have produced findings that were not addressed. The finding queue is growing rather than resolving. Indicates findings are not being actioned.
