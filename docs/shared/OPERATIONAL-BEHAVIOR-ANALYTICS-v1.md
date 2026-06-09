# Operational Behavior Analytics
## Behavioral Signal Analysis Without Surveillance or Authoritarianism
### Version 1 — Phase J, Operator Simulation and Replay Intelligence Era

---

## 1. Governing Principle

> **The system diagnoses process, not human worth.**

Operational behavior analytics exists to improve the reliability of the operational system — the combination of humans, procedures, software, and hardware that keeps ClubHub TV venues running.

It does not exist to evaluate, score, rank, or surveil individual operators. It does not exist to generate inputs for HR decisions. It does not exist to replace human operational judgment with automated verdicts.

This document defines what behavioral analytics may and may not do. Both halves of that definition are equally important.

---

## 2. Scope Boundaries

### 2.1 What Analytics May Analyze

- Patterns in how operators interact with the operational system
- Patterns in how incidents unfold across the fleet
- Patterns in response quality at the aggregate level
- Indicators that suggest the system is creating confusion (not that humans are confused)
- Trends in operational performance over time at venue, fleet, and platform levels

### 2.2 What Analytics May Not Analyze

- Individual operator competence rankings
- Individual operator risk scores
- Prediction of which operators will fail
- Comparison of individual operators against each other
- Any behavioral dimension that feeds into compensation, advancement, or disciplinary decisions without human review, contextual investigation, and explicit governance approval

The boundary is not one of feasibility — the data exists to do many of these things. The boundary is constitutional. Crossing it transforms an operational learning tool into a surveillance system, and surveillance systems produce fear, gaming, and the destruction of the trust that operational safety depends on.

---

## 3. Behavioral Signal Taxonomy

Behavioral signals are observations derived from replay and operational logs. They are raw materials for analysis, not conclusions.

### 3.1 Response Pattern Signals

**RESPONSE_LATENCY:** Time between an incident event becoming visible on the operator's information surface and the first operator action.

**ACTION_SEQUENCE:** The ordered set of actions taken during an incident response.

**ESCALATION_PATTERN:** When and how the operator invoked escalation paths.

**RESOLUTION_PATH:** The sequence of actions from incident onset to incident resolution.

**ABORT_PATTERN:** Instances where an operator began an action and did not complete it.

### 3.2 Interaction Quality Signals

**INFORMATION_REQUEST_PATTERN:** What additional information the operator sought before acting.

**UNDO_RATE:** Frequency of reversal actions following an initial action.

**MULTI_STEP_COHERENCE:** Whether a sequence of actions appears to follow a coherent response strategy.

**GUIDANCE_REFERENCE:** Whether and when operators accessed runbooks or contextual help during an incident.

### 3.3 Cognitive Load Indicators

**CONCURRENT_INCIDENT_HANDLING:** Number of simultaneous incidents an operator is managing.

**RAPID_CONTEXT_SWITCH_RATE:** Frequency of switching between different incident contexts in a short period.

**INCOMPLETE_ACTION_RATE:** Ratio of initiated actions to completed actions.

**EXTENDED_DWELL_TIME:** Duration of time spent viewing a specific information surface without action (may indicate comprehension difficulty or careful analysis).

### 3.4 Process Adherence Signals

**RUNBOOK_ALIGNMENT:** Degree to which an operator's response sequence matches the declared runbook for a given incident type.

**ESCALATION_TIMING_COMPLIANCE:** Whether escalations occurred within the declared time windows for incident severity levels.

**DOCUMENTATION_COMPLETION:** Whether post-incident documentation was completed within the declared window.

### 3.5 System-Operator Interface Signals

**INFORMATION_SURFACE_MISMATCH:** Cases where the operator's actions suggest they were acting on information different from what was surfaced (indicating a UI/UX gap).

**REPEATED_ACTION_WITHOUT_FEEDBACK:** An operator repeating the same action multiple times, suggesting the feedback loop is not providing confirmation.

**NAVIGATION_CONFUSION_PATTERN:** Navigation sequences that suggest the operator is searching for information that should be more accessible.

---

## 4. Safe vs. Forbidden Analytics Domains

### 4.1 Safe Analytics Domains

These domains are explicitly permitted and encouraged:

| Domain | Purpose | Permitted Outputs |
|---|---|---|
| INCIDENT_TYPE_FREQUENCY | Understand which incidents are most common | Fleet-level and venue-level frequency tables |
| RESPONSE_PATTERN_LIBRARY | Build corpus of effective response patterns | Pattern library for training content |
| SYSTEM_CONFUSION_DETECTION | Find where the system interface creates confusion | UI/UX improvement recommendations |
| PROCESS_GAP_IDENTIFICATION | Find gaps between declared procedures and actual behavior | Process improvement recommendations |
| TRAINING_EFFECTIVENESS | Assess whether training produces durable behavior change | Aggregate before/after comparison |
| ONBOARDING_PROGRESS | Understand how long it takes for new operators to reach competence | Onboarding curriculum improvement |
| CERTIFICATION_PATHWAY_ANALYSIS | Identify which certification pathways produce better long-term outcomes | Curriculum design |
| FLEET_READINESS | Understand aggregate readiness across venues | Operational planning |

### 4.2 Forbidden Analytics Domains

These domains are explicitly prohibited:

| Domain | Why Forbidden |
|---|---|
| INDIVIDUAL_OPERATOR_PERFORMANCE_SCORING | Converts behavioral signals into a verdict about a person's worth without human judgment |
| OPERATOR_RISK_RANKING | Creates a hidden ranking system that shapes decisions without operator awareness or recourse |
| OPERATOR_BEHAVIORAL_PREDICTION | Treats past behavior as deterministic predictor of future failure; creates self-fulfilling prophecy |
| COMPARATIVE_OPERATOR_RANKING | Encourages gaming, creates unhealthy competition, suppresses honest error reporting |
| FATIGUE_STATE_INFERENCE_FOR_ASSIGNMENT | Using behavioral signals to make scheduling decisions without operator consent and review |
| UNDISCLOSED_MONITORING | Any analysis that operators are not informed about and could not request to review |
| AI_DISCIPLINARY_CONCLUSIONS | Any output framed as a recommendation for disciplinary action generated without human review |

---

## 5. Operator Cognition Indicators

### 5.1 Purpose and Limitations

Cognition indicators are signals that may suggest an operator is experiencing cognitive difficulty with a specific system surface or incident type. They are not diagnostic of the operator's mental state — they are diagnostic of the operator-system interaction.

An operator who spends 90 seconds on an information surface before acting may be experiencing confusion, or may be being appropriately thorough. The signal cannot distinguish these. Only a human who examines the context can distinguish them.

### 5.2 Indicators

**COMPREHENSION_LATENCY:** Time from information presentation to action, relative to baseline for this incident type. Significant deviation above baseline may indicate the information surface is not communicating effectively.

**NAVIGATION_ENTROPY:** Number of distinct screens visited before taking the critical action. High entropy relative to baseline suggests the operator had difficulty finding the relevant information.

**CONFIRMATION_SEEKING:** Whether the operator sought confirmation from multiple sources before acting. High rates may indicate uncertainty — possibly due to system ambiguity, not operator inadequacy.

**PROCEDURE_DEVIATION:** Degree to which the operator's action sequence deviated from the declared runbook. Deviation is not inherently wrong — expert operators adapt to context. Systematic deviation across many operators suggests a procedure that doesn't match reality.

### 5.3 Cognition Indicator Governance

- All cognition indicators are computed at the aggregate level first
- Cognition indicators for individuals are only examined when the aggregate signals a systemic pattern
- Individual cognition indicator examination requires forensic investigation authority
- The purpose of individual examination is to identify system or procedure failures, not to assess the individual
- Findings from individual examination must be presented with the individual's right to review and respond

---

## 6. Fatigue Pattern Detection

### 6.1 Scope

Fatigue pattern detection identifies patterns in operational behavior that may indicate degraded state across extended shifts or following high-intensity incident periods. It is designed to inform scheduling and rest policy, not to surveil individuals.

### 6.2 Detectable Patterns

**RESPONSE_LATENCY_DEGRADATION:** A sustained increase in response latency across an extended session, relative to baseline for that operator's role and incident type.

**ERROR_RATE_ELEVATION:** A sustained increase in undo rate or incomplete action rate during the latter portion of an extended session.

**PATTERN_SIMPLIFICATION:** A shift from complex, context-aware response sequences to simpler, template-like sequences during extended sessions — possibly indicating cognitive resource depletion.

### 6.3 Governance Requirements

- Fatigue pattern data is never stored at the individual level
- Fleet-aggregate fatigue patterns inform shift length policies and rest requirements
- Venue-aggregate fatigue patterns may inform staffing decisions (more staff for long shifts)
- Individual fatigue signals may be surfaced to the operator themselves (as self-awareness support) but are never surfaced to supervisors without operator consent
- Any scheduling decision informed by fatigue pattern analysis must be reviewed by a human manager who knows the context

---

## 7. Confusion-Loop Analysis

### 7.1 What is a Confusion Loop

A confusion loop is a behavioral pattern where an operator takes an action, does not receive expected feedback, and repeats the action or seeks alternative paths in a way that suggests the feedback loop is broken.

Detection pattern: An operator performs action A, then within a short window performs action A again, or performs action B that would be expected only if A had failed.

### 7.2 Why It Matters

Confusion loops indicate system failure, not operator failure. If an action does not produce visible feedback, it is the system's responsibility to make the outcome clear. A system that silently succeeds or silently fails is creating confusion loops.

### 7.3 Confusion Loop Metrics

**LOOP_FREQUENCY_BY_ACTION_TYPE:** Which action types most frequently produce confusion loops?

**LOOP_FREQUENCY_BY_INFORMATION_SURFACE:** Which UI surfaces most frequently appear before loop events?

**LOOP_RESOLUTION_PATH:** How do operators escape confusion loops — eventual feedback, escalation, abandonment?

**LOOP_OUTCOME:** What happens to the underlying incident when an operator enters a confusion loop?

### 7.4 Response to Confusion Loop Analysis

Confusion loop analysis produces UI/UX improvement recommendations, not operator coaching. The finding is "the system does not provide adequate feedback for action type X on surface Y" — not "these operators are confused."

---

## 8. Intervention Quality Analysis

### 8.1 Purpose

Intervention quality analysis examines whether the actions operators take when responding to incidents are effective in resolving those incidents.

### 8.2 Quality Dimensions

**RESOLUTION_SPEED:** Time from first operator action to incident resolution.

**ACTION_ECONOMY:** Number of actions required to reach resolution. High action counts relative to incident complexity may indicate a mismatch between available interventions and the problem.

**RECURRENCE_RATE:** Whether the same incident type recurs at the same venue within a short window after resolution. High recurrence may indicate incomplete resolution procedures, not operator error.

**UNINTENDED_EFFECTS:** Whether the resolution of one incident creates or escalates another incident. This may indicate intervention side effects that should be documented in the runbook.

### 8.3 Aggregate-First Requirement

Intervention quality analysis is conducted at the aggregate level:
- Fleet-level patterns reveal systemic intervention gaps
- Venue-level patterns may reveal local procedure or configuration issues
- Individual-level examination requires forensic authority and a declared systemic hypothesis

---

## 9. Incident Response Pattern Analysis

### 9.1 Pattern Extraction

From the corpus, the analytics infrastructure extracts response patterns:
- The most common action sequences for each incident type
- The most effective action sequences (measured by resolution speed and completeness)
- The sequences used by operators who consistently achieve better-than-baseline outcomes

These patterns are extracted as aggregate behavioral models. They are not attributed to individual operators.

### 9.2 Pattern Library Use

The response pattern library is used to:
- Inform runbook design (do the declared procedures match the patterns that actually work?)
- Inform training content (are operators being trained on the patterns that work?)
- Inform certification scenarios (do certification scenarios test the patterns that matter most?)

The pattern library is not used to compare individual operators against "the best pattern."

### 9.3 Pattern Drift

Patterns change when the system changes. New deployments may invalidate previously effective response patterns. The pattern library is reviewed after every significant system change to identify pattern drift.

---

## 10. Drift Trend Extraction

### 10.1 Behavioral Drift vs. System Drift

**Behavioral drift:** The aggregate patterns of how operators respond to incidents change over time without a corresponding change in the system or incident types. This may indicate training effectiveness decay, procedural drift, or organizational change.

**System-induced drift:** Operator patterns change because the system changed. This is expected and should be tracked to confirm that system changes are producing the intended behavioral changes.

### 10.2 Drift Detection Protocol

- Baseline patterns are established for each incident type quarterly
- Monthly comparison identifies deviations from baseline
- Deviations above a declared threshold trigger a drift investigation
- Drift investigations look for root cause: system change, training gap, procedural obsolescence, or genuine unexplained drift

---

## 11. Replay-Backed Behavioral Interpretation

### 11.1 The Requirement

Every behavioral signal cited in an analysis must be traceable to a specific corpus record.

This is not a bureaucratic requirement. It is a safeguard against false pattern detection. Behavioral signals derived from incomplete or corrupted records produce false conclusions. Requiring corpus traceability means every analytical claim can be independently verified.

### 11.2 Citing Behavioral Evidence

When a finding cites a behavioral pattern, it must include:
- The corpus window the pattern was extracted from
- The number of instances the pattern was observed
- The trust score of the evidence (see REPLAY-INTELLIGENCE-AND-FORENSICS-v1.md §13)
- Any known limitations in the evidence (stream desync, redactions, gaps)

Findings that cannot provide this citation are analytical claims, not evidence-backed findings. They must be labeled as such.

---

## 12. Aggregate-Only Governance Rules

### 12.1 The Aggregate Boundary

The primary analytical outputs of the behavioral analytics system are aggregate-level. All reports, dashboards, and derived recommendations are aggregate by default.

Disaggregation to venue level requires: declared operational justification.
Disaggregation to role level within a venue requires: declared systemic hypothesis.
Disaggregation to individual level requires: forensic investigation authority.

### 12.2 Minimum Population Rule

No behavioral finding may be stated about a group of fewer than 5 individuals. This prevents "aggregate" analysis from being effectively individual analysis when small teams are involved.

### 12.3 Temporal Aggregation

Longitudinal individual records may not be maintained in the analytics system. Individual-level signals are aggregated to role-level within 30 days. Individual records older than 30 days exist only in the corpus (under Tier 1 governance) and are not queryable through the analytics API.

---

## 13. Privacy-Preserving Architecture

### 13.1 Data Minimization

The analytics pipeline processes only the behavioral signals declared in §3. It does not process:
- The content of operator communications
- Personal information not relevant to operational behavior
- Location data beyond venue assignment

### 13.2 Pseudonymization

Within the analytics pipeline (excluding the corpus itself), operators are identified by role pseudonym, not by name or persistent identity. Pseudonyms are generated per-session and cannot be linked across sessions without forensic authority.

### 13.3 Retention Minimization

Analytics-derived signals (as distinct from the corpus record) are retained according to:
- Session-level signals: 30 days
- Role-level aggregates: 12 months
- Venue-level aggregates: 36 months
- Fleet-level aggregates: retained for platform lifetime

### 13.4 Access Controls

Analytics system access is role-gated:
- Aggregate fleet and venue reports: operational management
- Role-level disaggregation: requires declared justification, logged
- Individual-level access: forensic authority only, logged with mandatory review

---

## 14. Constitutional Limits on Scoring and Ranking Humans

### 14.1 The Constitutional Prohibition

No component of the behavioral analytics system may output a score, rank, or rating attached to an individual operator, expressed as a judgment of that operator's competence, risk, or value.

This prohibition is not subject to exception for "training purposes," "performance management," or "safety requirements." These stated purposes do not change the nature of the output or its effects on the people being scored.

### 14.2 Why This Is Constitutional

Scoring creates a hidden authority structure where an algorithm's assessment of a person's behavior becomes the primary lens through which that person is viewed. This:
- Shifts operational truth from "what actually happened" to "what the algorithm measured"
- Creates gaming incentives that corrupt the behavioral signals the system depends on
- Destroys psychological safety, which is itself an operational safety requirement
- Replaces the institutional judgment of experienced managers with a quantitative substitute that lacks context

### 14.3 Permitted Alternatives to Scoring

Instead of operator scores, the system produces:
- **Process health indicators** — is this role category performing the process as designed?
- **System friction indicators** — which system surfaces create the most process friction?
- **Training gap indicators** — which scenario types show the lowest response quality at aggregate?
- **Readiness assessments** — (for certification purposes only) does an operator demonstrate the capabilities required for their certification level?

A readiness assessment is not a score. It is a binary determination (ready/not ready) for a specific certification level, based on observable demonstration of specific capabilities in a governed certification process.

---

## 15. Human-Review-Before-Action Governance

### 15.1 The Rule

No operational decision affecting an individual operator (scheduling, certification, assignment, training requirements) may be made solely on the basis of behavioral analytics outputs.

Every such decision requires:
1. A human reviewer who has read the contextual evidence, not just the analytics summary
2. The opportunity for the affected operator to review the evidence and respond
3. Documentation of the reasoning behind the decision that goes beyond citing an analytics output

### 15.2 Why This Matters

Analytics outputs are summaries. Summaries lose context. The operator who was slow to respond to three incidents in one day may have been managing a family emergency that shift — context that exists nowhere in the behavioral signal record. The human reviewer who knows this context makes a qualitatively better decision than any algorithm that only sees the timing data.

Requiring human review is not inefficiency. It is the mechanism by which context is preserved in consequential decisions.

### 15.3 Escalation to Analytics-Informed Review

When aggregate analytics signals a problem:
1. The aggregate signal is documented
2. A human investigator examines the context (corpus, operational logs, venue circumstances)
3. The investigator produces a finding that incorporates both the aggregate signal and the context
4. Recommendations are made based on the integrated finding, not the signal alone

---

## 16. Anti-Gamification Rules

### 16.1 The Gamification Risk

Any measurement system that is known to operators will be gamed. This is not a character flaw — it is a rational response to measurement that carries consequences.

Gamification corrupts behavioral signals, which in turn corrupts the analytics that depend on those signals. A system where operators optimize for the measurement rather than for operational excellence has failed at its primary purpose.

### 16.2 Anti-Gamification Requirements

**Measurement opacity:** The specific behavioral signals being collected are not disclosed to individual operators in a way that would allow optimization of those signals. Operators know that the system analyzes operational patterns. They do not know the precise metrics that feed any analytics output.

**Consequence opacity:** No behavioral signal may be directly linked to a specific operational consequence (access level, scheduling, certification) without the human review process in §15. This breaks the direct gaming incentive.

**Signal diversity:** The analytics system uses multiple independent signals to characterize patterns. Gaming one signal does not contaminate the full picture.

**Behavioral plausibility checks:** Analytics includes mechanisms to detect statistically implausible "improvement" in specific signals, which may indicate gaming rather than genuine behavioral change.

### 16.3 The Reporting Obligation

Anti-gamification architecture requires that operators be able to report, without consequence:
- Incidents they handled suboptimally
- Situations they found confusing
- Procedures they did not follow and why

Honest error reporting is more valuable operationally than optimized behavioral signals. Any analytics system that punishes honesty destroys operational learning. Honest reporting must be explicitly and visibly protected.

---

## 17. False-Confidence Prevention

### 17.1 The False-Confidence Risk

Behavioral analytics can produce outputs that appear precise and authoritative but rest on incomplete evidence. Decision-makers who trust these outputs may have more confidence than the evidence warrants.

### 17.2 Prevention Requirements

**Mandatory uncertainty disclosure:** All analytics outputs must declare:
- The size and representativeness of the evidence base
- Known gaps in the corpus for the relevant window
- The trust score of the primary evidence

**Extrapolation limits:** Analytics outputs may not extrapolate beyond the evidence base. If the corpus covers 3 months and a pattern is identified over 3 months, the output does not assert the pattern has persisted for longer.

**Causal labeling:** Correlation-based findings must be labeled as correlational. Causal findings must cite the causal chain (per REPLAY-INTELLIGENCE-AND-FORENSICS-v1.md §6).

**Minority behavior acknowledgment:** When the majority of a population exhibits a pattern, the output must also acknowledge the minority that does not, and not characterize the minority as anomalous without further investigation.

---

## 18. Analytics Retention Governance

| Signal Category | Retention Period | Deletion Trigger |
|---|---|---|
| Session-level individual signals | 30 days | Automatic |
| Role-level aggregates per venue | 12 months | Annual review |
| Venue-level aggregates | 36 months | Venue decommission |
| Fleet-level aggregates | Platform lifetime | Platform decommission |
| Investigation-cited signals | Duration of investigation + 5 years | Investigation closure + retention period |
| Certification examination records | 5 years | Retention period expiry |

Analytics data may not be retained beyond its retention period without explicit governance authorization. Retention extensions must declare the purpose and are themselves logged.

---

## 19. Explicit Prohibitions

The following are explicitly and unconditionally forbidden:

**HIDDEN_OPERATOR_SCORING:** No system component may compute, store, or transmit a numerical or categorical score attached to an individual operator without their knowledge.

**OPAQUE_RISK_RANKING:** No system component may maintain a ranking of operators by "risk" or "reliability" that is not disclosed to the ranked individuals.

**AI_GENERATED_DISCIPLINARY_CONCLUSIONS:** No output from the behavioral analytics system, or from any AI component operating on behavioral data, may be framed as a conclusion or recommendation that an individual operator should face disciplinary action.

**BEHAVIORAL_PREDICTION_REPLACING_OPERATIONAL_TRUTH:** No behavioral prediction model may be used as a substitute for the corpus record in determining what happened or what an operator did. The corpus is the record; prediction is not evidence.

**COVERT_MONITORING:** No behavioral signals may be collected from operators without their knowledge that the system monitors operational behavior patterns.

**WELFARE_THEATER:** No analytics capability may be implemented as an ostensible "operator wellness" feature while actually being used as a performance monitoring tool.

**CONSENT_BYPASS:** No behavioral analytics capability that would require individual operator consent may be implemented at a system level to avoid obtaining that consent.
