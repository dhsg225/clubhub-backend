# ClubHub TV — Knowledge Classification System
# Shared Operational Intelligence Layer

**Document type:** Foundational epistemological governance — permanent authority layer
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1, Agent 2, Agent 3, all future contributors
**Last updated:** 2026-05-22
**Status:** FOUNDATIONAL — governs the epistemological standards of all shared platform knowledge

---

## Purpose

This document defines the epistemology of the ClubHub TV platform. It answers the question: **how do we know what we know, and how certain should we be?**

Without this system, the platform accumulates mythology. Ideas proposed in design sessions become "established patterns." Simulations get cited as field observations. Analogues from other systems become facts about this system. Hypotheses that feel correct become operational policies. Over years, the platform's documentation base becomes a mixture of genuine knowledge and inherited assumptions — indistinguishable from each other — and the platform loses the ability to reason about its own behavior with confidence.

The Knowledge Classification System prevents this. It assigns every claim in the shared operational memory layer a classification that tells the reader: how this knowledge was produced, what evidence supports it, how confident the claim is, and under what conditions it should be trusted.

This is not academic bureaucracy. It is operational safety infrastructure.

---

## Governing Philosophy

**Evidence outranks intuition.** A claim that feels obviously true but is not supported by evidence is a hypothesis. It should be labeled as such and tested before it becomes a design constraint.

**Classification is not judgment.** A HYPOTHETICAL classification is not a mark of low quality — it is a mark of intellectual honesty. The worst classification is UNCLASSIFIED: a claim that is being treated as canonical when its evidence status is unknown.

**Precision of language reflects precision of knowledge.** A document that mixes CONSTITUTIONAL claims with HYPOTHETICAL claims, using the same language for both, is actively misleading. The classification system creates a language for expressing confidence level alongside content.

**Classification changes over time.** A claim that is HYPOTHETICAL today may become CANONICAL after validation. A claim that was CANONICAL may become CONTESTED when evidence emerges against it. The system is a living map of the platform's knowledge state, not a permanent stamp on individual claims.

---

## Section 1 — Why Classification Exists

### 1.1 The Semantic Drift Problem

The shared operational memory layer contains documents written over an extended period, by multiple agents, drawing on simulation, structural inference, analogy, and field observation. Without classification, all of this material reads with equal authority. A reader cannot distinguish:

- A claim derived from the Engineering Constitution (absolute authority)
- A claim derived from a full corpus replay (strong empirical authority)
- A claim inferred from the structural properties of the system (high confidence inference)
- A claim drawn from analogy to other digital signage platforms (plausible but unverified)
- A claim projected from expected operator behavior (hypothesis pending validation)
- A claim proposed in a design session that felt right at the time

When these six levels of confidence are all written in the same voice, the reader treats them all as equally authoritative. Decisions get made on hypotheses that are presented as facts. Design choices get locked in based on analogues that don't actually apply.

Classification surfaces the confidence level alongside the claim.

### 1.2 The Mythology Accumulation Problem

Over years, every platform develops mythology — beliefs about how the system works that are accepted as true without anyone verifying them. In digital signage platforms specifically, mythology tends to accumulate around:

- What operators "always do" (often based on one early deployment observation)
- Why specific design decisions were made (rationale gets lost when the decision-maker leaves)
- What edge cases the system handles (claims about behavior that was never tested in that scenario)
- What the "right" thresholds are for advisory signals (originally set by intuition, never validated)

The classification system prevents mythology accumulation by requiring that every claim in the shared documents carry an explicit statement of how it was established. A claim that cannot be classified is a claim whose origin is unknown — which is the first symptom of mythology.

### 1.3 The Operator Trust Problem

Operators trust the system when the system is accurate. Documentation that is wrong — because it was written based on hypotheses that turned out to be false — erodes operator trust when operators discover the discrepancy. Classification makes the confidence level of claims visible, so that documentation that is based on validated field observation is distinguishable from documentation that is based on analogy.

---

## Section 2 — Knowledge States

### 2.1 CONSTITUTIONAL

**Meaning:** A claim that is derived directly from and supported by the Engineering Constitution. CONSTITUTIONAL claims are the non-negotiable axioms of the platform. They do not require field validation because they are architectural commitments, not empirical claims.

**Examples:**
- "The PRE is a pure function with no side effects" (INV-1)
- "Emergency resolution at LEVEL_0 is absolute — no other rule can override it" (INV-7)
- "The system MUST NOT auto-correct operator mistakes" (§2.3)

**Evidence standard:** Citation to a specific section or invariant in ENGINEERING-CONSTITUTION-v1.md.

**Mutation rules:** CONSTITUTIONAL claims may only be changed through a formal constitutional amendment (Engineering Constitution Section 30). No implementation decision, design preference, or operational convenience justifies treating a CONSTITUTIONAL claim as negotiable.

**Authority level:** Absolute. Supersedes all other knowledge classifications.

**Who can promote/demote:** Constitutional amendment process only. No single agent has authority to promote to or demote from CONSTITUTIONAL.

**Operational implications:** Any design decision that would violate a CONSTITUTIONAL claim is non-conformant. The design must change; the claim does not.

---

### 2.2 CANONICAL

**Meaning:** A claim that is formally specified in a Tier 2 or Tier 3 document and has been validated against the platform's corpus or formal specification review. CANONICAL claims represent the platform's committed, tested behavioral specifications.

**Examples:**
- "LEVEL_1 resolution (Operational Override) terminates before LEVEL_3 (Campaign) regardless of the numeric priority field on any LEVEL_3 schedule row"
- "The PRE evaluates time-of-day constraints using venue.timezone — no other timezone source is permitted"
- "The manifest version is monotonically increasing and is incremented exactly when the playlist checksum changes"

**Evidence standard:** Citation to PRE-REFERENCE-IMPLEMENTATION-v1.md, BACKEND-ARCHITECTURE-v1.md, or another Tier 2-3 document, AND validation through the corpus replay harness or explicit specification review.

**Mutation rules:** CANONICAL claims may be changed through a formal specification update with corpus test coverage. Any change to a CANONICAL claim requires updating the authoritative Tier 2-3 document AND adding or updating corpus test fixtures that validate the new behavior.

**Authority level:** High. Supersedes OPERATIONAL, OBSERVED, and all lower classifications.

**Who can promote:** Agent 1 may promote platform behavior claims to CANONICAL after specification and corpus coverage. Agent 2 may promote operational semantics claims to CANONICAL after formal documentation and review. Agent 3 cannot promote claims to CANONICAL unilaterally — Agent 3 designs within CANONICAL constraints.

**Who can demote:** Any agent may flag a CANONICAL claim as CONTESTED if evidence emerges against it. Demotion requires formal review.

**Operational implications:** CANONICAL claims are safe to design on. UX designs, operational policies, and CMS workflows may depend on CANONICAL claims without risk of the claim being invalidated by a design session.

---

### 2.3 OPERATIONAL

**Meaning:** A claim about how operators behave, what workflows they follow, or what mental models they hold, that has been derived from structural analysis of the system and its environment. OPERATIONAL claims are high-confidence inferences — not yet validated by field observation but grounded in strong structural reasoning about operator incentives, role pressures, and system properties.

**Examples:**
- "Override accumulation is not a risk — it is a certainty in any deployment where overrides can be created without mandatory expiry" (OBS-001, STRUCTURAL)
- "Shift managers operate the CMS during peak operational periods and have the least time and highest urgency" (OPERATOR-MENTAL-MODELS.md §2.1)
- "The 3-month mark is the highest-leverage point for entropy intervention" (OBS-007, STRUCTURAL)

**Evidence standard:** Structural inference from the documented properties of the system and the documented operational environment. The reasoning must be explicit — it must be possible to trace the claim to specific structural properties that make it logically necessary.

**Mutation rules:** OPERATIONAL claims should be promoted to OBSERVED or CANONICAL when field data validates them, or demoted to HYPOTHETICAL if the structural reasoning is found to be flawed. They should NOT be treated as field observations — they are strong inferences, not direct evidence.

**Authority level:** Medium-high. Suitable for design decisions at the principle level. Specific threshold values or behavioral predictions that depend on OPERATIONAL claims should be validated before being locked in.

**Who can promote:** Agent 2 may elevate an OPERATIONAL claim to OBSERVED when field data validates it. Agent 1 may elevate OPERATIONAL claims about platform behavior to CANONICAL when specification review confirms them.

**Operational implications:** OPERATIONAL claims are reliable enough to design on, but decisions that are highly sensitive to whether the claim is precisely correct (e.g., specific advisory threshold values) should be validated before being finalized.

---

### 2.4 OBSERVED

**Meaning:** A claim that has been directly observed in real deployments. OBSERVED claims represent genuine field evidence — what actually happened, not what was predicted to happen.

**Examples:**
- "Venue X had 47 active schedule rows in the bar area, with priority values ranging from 5 to 890, after 18 months of operation" (if from a real deployment)
- "Emergency activation frequency at sports bars averages X per month" (from delivery telemetry)
- "The marketing coordinator verified the campaign on one screen and concluded all screens were showing it" (from incident report)

**Evidence standard:** Direct observation from real deployment data, incident reports, operator sessions, analytics, or field visits. The observation must be specific and traceable to its source.

**Mutation rules:** OBSERVED claims become RETIRED when the deployment context changes (e.g., the venue reconfigured its system), or CONTESTED when conflicting observations emerge.

**Authority level:** High for the specific context observed; medium for general claims derived from limited observations. The authority of an OBSERVED claim depends on the sample size — a single observation is weak evidence for a general claim.

**Who can promote:** Any agent who has direct access to the deployment data or field observation. The observation must be documented with source, date, and context.

**Operational implications:** OBSERVED claims are the highest-value evidence for validating OPERATIONAL and HYPOTHETICAL claims. When field data confirms an OPERATIONAL inference, the OPERATIONAL claim should be updated to OBSERVED (or retained as OPERATIONAL with a note that it is "confirmed by field observation").

---

### 2.5 ANALOGOUS

**Meaning:** A claim borrowed from an analogous system — another digital signage platform, a broadcast operations system, an aviation CRM context, an industrial control system — that is plausibly applicable to ClubHub TV but has not been validated in ClubHub-specific deployments.

**Examples:**
- "Content libraries accumulate 60–80% obsolete assets after 12–18 months" (from digital signage industry, OBS-003)
- "Emergency activation systems used for non-emergency purposes have high probability of repeat misuse" (from broadcast operations, OBS-008)
- "Configuration debt is a safety risk in industrial control systems" (from ICS literature, OBS-019)

**Evidence standard:** The analogous system must be documented (what system, what source), and the reasoning for applicability to ClubHub TV must be explicit. The analogy must be qualified: in what ways is the analogy strong? In what ways might it fail to apply?

**Mutation rules:** ANALOGOUS claims should be promoted to OPERATIONAL (strong structural reasoning applies) or OBSERVED (field data validates) as evidence accumulates. They should be demoted to HYPOTHETICAL if the analogy turns out to be weaker than assumed, or RETIRED if the analogy is definitively wrong.

**Authority level:** Medium. ANALOGOUS claims are valuable for generating hypotheses and design principles but should not be the sole basis for specific threshold values or behavioral predictions.

**Who can promote:** Any agent may document an ANALOGOUS claim. Promotion to OPERATIONAL requires Agent 2 to document the structural reasoning. Promotion to OBSERVED requires field data.

**Operational implications:** ANALOGOUS claims provide useful design direction but require explicit acknowledgment of their analogical nature. Designs built on ANALOGOUS claims should include a validation plan.

---

### 2.6 HYPOTHETICAL

**Meaning:** A claim about expected behavior, operator response, or system outcome that is plausible and logically motivated, but has not been validated. HYPOTHETICAL claims are honest predictions.

**Examples:**
- "Sports bars during live events may disable the ClubHub system entirely" (OBS-005 [H])
- "Golf clubs in off-season may have screens running content configured 6 months ago with no management activity" (OBS-009 [H])
- "Preview system access at campaign creation time reduces coverage gap discoveries by >50%" (UXH-003)

**Evidence standard:** A HYPOTHETICAL claim requires only that it is plausible (consistent with the system's documented properties and operational context) and that the reasoning is explicit. There is no evidence standard — by definition, a HYPOTHETICAL has not been validated.

**Mutation rules:** HYPOTHETICAL claims must be tested. A HYPOTHETICAL that has been active in the documentation for more than 6 months without being tested should be flagged for research prioritization. A HYPOTHETICAL that is invalidated by evidence becomes CONTESTED and then RETIRED. A HYPOTHETICAL that is validated becomes OBSERVED.

**Authority level:** Low for specific design decisions. HYPOTHETICAL claims are valuable for generating design direction and research questions but should never be the sole basis for an implementation decision. Design decisions built on HYPOTHETICAL claims must explicitly acknowledge the uncertainty.

**Who can create:** Any agent may create a HYPOTHETICAL claim. All `[H]`-tagged observations in REAL-WORLD-OBSERVATIONS.md and all entries in UX-HYPOTHESES-AND-QUESTIONS.md are HYPOTHETICAL by default.

**Operational implications:** When using a HYPOTHETICAL claim in a design decision, the decision documentation must note: "This design is based on the hypothesis that [X]. If the hypothesis is invalidated, this design requires reassessment." This creates a dependency map between designs and the hypotheses they rely on.

---

### 2.7 EXPERIMENTAL

**Meaning:** A claim that is actively under investigation through a defined experiment in FUTURE-EXPERIMENTS.md. The claim may be a hypothesis that is currently being tested, or a measurement that is currently being taken.

**Examples:**
- "Emergency activation friction reduces misuse by >40%" (EXP-003 — while running)
- "Override expiry first field reduces permanent override creation by >50%" (EXP-001 — while running)

**Evidence standard:** A valid experiment design as documented in FUTURE-EXPERIMENTS.md, including: question, hypothesis, method, success criterion, and status = [RUNNING].

**Mutation rules:** EXPERIMENTAL claims become OBSERVED (validated) or HYPOTHETICAL-INVALIDATED (disproven) when the experiment completes. During the experiment, the claim should not be used as design authority — the experiment exists precisely because the claim is not yet established.

**Authority level:** Informational only. An EXPERIMENTAL claim cannot be cited as design authority for anything other than the experiment itself.

**Who can create:** Any agent may design an experiment. Experiments require documentation in FUTURE-EXPERIMENTS.md before a claim can be classified as EXPERIMENTAL.

**Operational implications:** Running experiments in the context of live deployments requires care about what is being tested and on whom. Experiments that could produce worse operator outcomes than the baseline must be designed with safeguards.

---

### 2.8 CONTESTED

**Meaning:** A claim that has conflicting evidence — some evidence supports it, some evidence contradicts it, and the conflict has not been resolved.

**Examples:**
- "Prospective SOV impact communication prevents over-commitment" — contested if field evidence shows operators ignore it
- "15-second poll cycle is acceptable to operators" — contested if some deployments show operators complaining about latency

**Evidence standard:** CONTESTED claims require documentation of: what the claim is, what evidence supports it, what evidence contradicts it, and what resolution process is underway.

**Mutation rules:** A CONTESTED claim must not remain contested indefinitely. A resolution process must be active. If no resolution is possible (conflicting evidence in different contexts), the claim should be reframed as "X is true in context A, Y is true in context B" — two more specific claims that are no longer contested.

**Authority level:** Cannot be used as design authority. A design decision that depends on a CONTESTED claim is on hold until the contest is resolved.

**Who can create:** Any agent may flag a claim as CONTESTED. Contesting a claim requires documenting the conflicting evidence specifically.

**Operational implications:** CONTESTED claims represent active research obligations. They should appear in UX-HYPOTHESES-AND-QUESTIONS.md as open questions and in FUTURE-EXPERIMENTS.md as experiments to resolve them.

---

### 2.9 RETIRED

**Meaning:** A claim that was once accepted (at any classification level) but is no longer operative because it has been superseded, disproven, or its operational context has changed.

**Examples:**
- A threshold value that was set for early deployments but has been updated based on field data
- A mental model claim that was valid for the initial operator population but has been superseded by updated research
- An analogy from another platform that was found to not apply to ClubHub's specific operational context

**Evidence standard:** RETIRED claims must document: what the claim was, why it was retired, and what replaced it (if anything). Retired claims are NOT deleted — they are preserved with their retirement rationale.

**Mutation rules:** RETIRED claims are not subject to promotion. They remain in the archive as historical record.

**Authority level:** Zero. RETIRED claims must not be cited in design decisions.

**Operational implications:** Preservation of RETIRED claims prevents mythology resurrection — the phenomenon where a retired belief is independently rediscovered and re-adopted without awareness that it was previously rejected.

---

### 2.10 HISTORICAL

**Meaning:** A claim about a past state of the system that is accurate for its time but no longer reflects current behavior. HISTORICAL claims are not wrong — they describe what was true at a specific point in time.

**Examples:**
- "As of Phase 2 completion, the PRE operated in shadow mode with PRE_ENABLED = false by default"
- "Before the enforcement convergence phase, override state was not persisted across restarts"
- "The initial deployment corpus contained 3 canonical fixtures; it now contains 9"

**Evidence standard:** The HISTORICAL claim must specify the time period it applies to (before/after what event, phase, or date).

**Mutation rules:** HISTORICAL claims are archived, not updated. They represent the platform's operational history.

**Authority level:** Context-specific. HISTORICAL claims are authoritative for their time period. They must not be applied to current system behavior.

**Operational implications:** HISTORICAL claims are valuable for understanding why current design decisions were made. The reasoning trail from past state to present state helps contributors understand architectural evolution.

---

## Section 3 — Truth Hierarchy

The classification states form a hierarchy of authority:

```
CONSTITUTIONAL    — Absolute. Cannot be overridden by design decisions.
CANONICAL         — High. Supersedes OPERATIONAL and below.
OPERATIONAL       — Medium-high. Supersedes OBSERVED for general principles.
OBSERVED          — High (within observed context). Supersedes HYPOTHETICAL.
ANALOGOUS         — Medium. Supersedes HYPOTHETICAL as design direction.
HYPOTHETICAL      — Low. Generates questions; does not resolve them.
EXPERIMENTAL      — Informational. Not yet evidence.
CONTESTED         — On hold. Cannot be used as design authority.
RETIRED           — Zero. Must not be cited.
HISTORICAL        — Context-specific.
```

**Important nuance:** OBSERVED does not automatically supersede OPERATIONAL when the observation conflicts with structural reasoning. A single field observation that contradicts a strong structural inference requires investigation before the structural inference is demoted. The structural reasoning may reveal that the observation is an edge case, a sampling artifact, or incorrectly recorded.

---

## Section 4 — Observation vs Hypothesis Separation

This distinction is critical and frequently violated.

### 4.1 What Makes Something an Observation

An observation is:
- Something someone directly perceived with their senses or with measurement instruments
- A specific event at a specific time in a specific context
- Reproducible in principle (under the same conditions, the same phenomenon can be observed again)
- Independent of the observer's theory of why it happened

### 4.2 What Makes Something a Hypothesis

A hypothesis is:
- A prediction about what will happen, or what would have happened, or what typically happens
- A belief about why an observation occurred
- A claim about a population based on a sample
- A claim about unmeasured contexts based on measured ones

### 4.3 The Failure Mode: Observation-Washing

The most common classification failure is **observation-washing**: treating a hypothesis as if it were an observation by describing it in past tense, concrete terms.

**Observation-washed hypothetical:**
"Operators don't set expiry dates on overrides when they're busy."

**Correct classification:**
HYPOTHETICAL: "We predict that operators are less likely to set expiry dates during high-urgency periods (OBS-002 provides structural support for this). This has not been directly observed — it is inferred from the structural pressure of shift manager time constraints."

**Why this matters:** A design built on an "observation" that is actually a hypothesis will fail if the hypothesis is wrong. A design built on an explicitly labeled hypothesis is designed with an awareness of its own uncertainty.

### 4.4 Structural Inference as OPERATIONAL

The OPERATIONAL classification was created to accommodate a specific and valuable type of claim: strong inferences that follow necessarily from documented system and context properties. These are not observations, but they are not mere hypotheses either.

"Override accumulation is a certainty, not a risk" is classified OPERATIONAL because it follows necessarily from:
- Overrides can be created without expiry (documented system property)
- Creation requires responding to an immediate need; removal requires deliberate re-visit (documented operational context)
- There is no natural mechanism for reduction without deliberate action (structural property)

This reasoning chain makes the conclusion near-certain without field data. OPERATIONAL classification captures this intermediate epistemic state.

---

## Section 5 — Promotion Rules

A claim's classification may be promoted when new evidence supports a higher classification.

### 5.1 HYPOTHETICAL → OPERATIONAL

**Trigger:** Structural reasoning is documented that makes the hypothesis follow necessarily from system and context properties.

**Process:** Agent 2 documents the structural reasoning chain. The claim moves from UX-HYPOTHESES-AND-QUESTIONS.md to REAL-WORLD-OBSERVATIONS.md as a STRUCTURAL observation with HIGH confidence.

### 5.2 HYPOTHETICAL / OPERATIONAL → OBSERVED

**Trigger:** Field data, operator research, deployment analytics, or formal experiment confirms the claim.

**Process:** The agent with access to the data documents the observation with source, date, sample size, and context. The OBSERVED entry is added to REAL-WORLD-OBSERVATIONS.md. The corresponding HYPOTHETICAL entry in UX-HYPOTHESES-AND-QUESTIONS.md is updated to [VALIDATED]. The experiment in FUTURE-EXPERIMENTS.md (if applicable) is updated to [COMPLETE] with results.

### 5.3 ANALOGOUS → OPERATIONAL

**Trigger:** Agent 2 documents that the analogy applies to ClubHub's specific structural context, with explicit reasoning for why the analogous system's behavior is expected in ClubHub.

**Process:** The ANALOGOUS entry is updated with the structural reasoning. The claim is reclassified as OPERATIONAL with a note citing the analogy as supporting evidence.

### 5.4 OPERATIONAL / OBSERVED → CANONICAL

**Trigger:** The claim is formally specified in a Tier 2-3 document AND validated through corpus replay or formal specification review.

**Process:** Agent 1 adds corpus test coverage for the claim. Agent 2 updates the Tier 2-3 document to include the formal specification. The claim is reclassified as CANONICAL.

### 5.5 CANONICAL → CONSTITUTIONAL

**Trigger:** The platform determines that the claim is an architectural commitment that must be protected by the constitutional amendment process, not just a formal specification.

**Process:** This is the highest-cost promotion. It requires explicit constitutional amendment per Engineering Constitution Section 30. It is reserved for invariants that, if violated, would produce platform behavior that is fundamentally inconsistent with the platform's operational purpose.

---

## Section 6 — Retirement Rules

A claim should be retired when:
- It has been superseded by a more accurate or more specific claim
- It has been disproven by field evidence
- The system has changed such that the claim no longer applies
- The context it described no longer exists

**Retirement process:**
1. The claim is marked as RETIRED with a date and rationale
2. The rationale must include: what the claim was, why it is being retired, and what (if anything) replaces it
3. The claim is preserved in place with RETIRED classification — it is not deleted
4. Any documents that cite the retired claim must be updated to note the retirement
5. Any designs that depended on the retired claim must be flagged for reassessment

**What retirement is NOT:**
- A way to suppress inconvenient evidence
- A way to remove claims that an agent disagrees with (the CONTESTED classification handles that)
- A way to simplify documents by removing old content (old content is historically valuable)

---

## Section 7 — Experimental Isolation

Experiments are a necessary mechanism for advancing platform knowledge. However, experiments in the context of live deployments carry risks that must be managed.

### 7.1 Experimental Contamination

**The risk:** An experiment that seems to confirm a design hypothesis may actually be confirming a different hypothesis, creating an artifact, or measuring an effect that will not replicate in different contexts.

**The protection:** Experimental results must be classified as EXPERIMENTAL until the experiment is formally completed. EXPERIMENTAL results cannot be promoted to OBSERVED without review of the experimental design, sample characteristics, and confound analysis.

### 7.2 Hypothesis-in-Production Risk

**The risk:** A design built on a HYPOTHETICAL claim is shipped to production before the hypothesis is validated. The production deployment becomes an inadvertent "experiment" on real operators without the rigor of a defined experiment.

**The protection:** Before any design built on HYPOTHETICAL claims is implemented, the HYPOTHETICAL must be:
1. Explicitly labeled in the design documentation
2. Assessed for risk (if the hypothesis is wrong, what is the operational consequence?)
3. Either validated (promoted to OBSERVED or OPERATIONAL) OR the design must include a mechanism to measure the hypothesis in production

### 7.3 Constitutional Assumptions as Experimental Variables

**Absolute prohibition:** Constitutional claims (INV-1 through INV-10) may NEVER be experimental variables. No experiment may test "what happens if we violate an invariant." The invariants are not hypotheses — they are architectural commitments. Treating them as experimental is equivalent to testing whether the platform's foundation can be removed.

---

## Section 8 — Citation Expectations

All documents in the shared operational memory layer should cite the classification of claims when the classification level matters for how the claim is used.

### 8.1 When Citation Is Required

**Always cite classification for:**
- Threshold values (M-01 through M-12 advisory thresholds) — the reader must know if these are CANONICAL, OPERATIONAL, or HYPOTHETICAL
- Operator behavioral claims used to justify design decisions — the reader must know if these are OBSERVED or HYPOTHETICAL
- Claims about what "typically happens" or "always happens" — these are almost always OPERATIONAL or HYPOTHETICAL, not OBSERVED
- Claims that support a specific design recommendation — the classification of the supporting claim affects the confidence of the recommendation

**No citation required for:**
- CONSTITUTIONAL claims (they are always clearly derived from the Engineering Constitution)
- Self-evident structural properties (e.g., "the PRE is called once per poll" — this is directly verifiable from code)

### 8.2 Citation Format

Within document text, classification citations appear as: `[OPERATIONAL]`, `[HYPOTHETICAL]`, `[OBSERVED — OBS-NNN]`, `[CANONICAL — PRE §X.Y]`, `[ANALOGOUS — OBS-NNN]`.

Example usage:
> "Override accumulation is a structural certainty in any unmanaged deployment [OPERATIONAL — OBS-001], and field observation will validate or specify the rate [HYPOTHETICAL — UXH-002 expected to provide data]."

### 8.3 Unclassified Claims

A claim that appears in a shared document without classification should be treated as HYPOTHETICAL until classified. The presence of an unclassified claim is a documentation gap that should be flagged for Agent 2 review.

---

## Section 9 — Replay and Verification Relationship

The platform's corpus replay harness is the primary mechanism for elevating claims about PRE behavior from HYPOTHETICAL or OPERATIONAL to CANONICAL.

### 9.1 How Corpus Replay Elevates Classification

A PRE behavioral claim becomes CANONICAL when:
1. It is formally specified in PRE-REFERENCE-IMPLEMENTATION-v1.md
2. At least one corpus fixture (canonical or chaos) tests the claim
3. The replay harness confirms that the implementation produces the specified output for the fixture's input

If a claim about PRE behavior passes step 1 but not steps 2-3, it is OPERATIONAL at best. A specification without test coverage is a claim without evidence.

### 9.2 Divergence Classification and Knowledge Confidence

The five divergence classes (0=cosmetic through 4=catastrophic) in the verification system have a direct relationship to knowledge classification:

- A Class 4 (catastrophic) divergence invalidates a CANONICAL claim about PRE behavior — it demotes the claim to CONTESTED
- A Class 3 (major) divergence suggests a CANONICAL claim is imprecisely specified — it may demote to OPERATIONAL pending specification clarification
- A Class 0-2 divergence does not affect the classification of the relevant CANONICAL claim — cosmetic and minor divergences are within the specified behavior envelope

### 9.3 Field Evidence and Classification Promotion

Field deployment data (delivery logs, entropy metrics, operator behavior analytics) is the primary mechanism for promoting OPERATIONAL and HYPOTHETICAL claims to OBSERVED. The following data sources, when available, should be systematically used for classification review:

- Delivery log analytics → validates claims about poll frequency, cache behavior, confidence score patterns
- Entropy metric trends → validates claims about entropy accumulation rates and patterns
- Override creation patterns → validates claims about operator behavior (expiry rates, frequency, duration)
- Support ticket content → validates claims about operator mental model failures and confusion points
- Emergency activation patterns → validates claims about emergency misuse patterns

---

## Section 10 — Field Observation Intake

When new field data becomes available (from a deployment, an operator session, an experiment, or a field visit), it should be incorporated into the shared knowledge base through the following process.

### 10.1 Intake Process

1. **Capture:** Document the observation as soon as possible after the observation event. Raw observations lose precision over time.

2. **Classify:** Apply the classification system. Is this OBSERVED (direct measurement or observation), or is it an OPERATIONAL inference from what was observed?

3. **Specificity check:** Is this a claim about a specific deployment in a specific context, or is it a general claim? Be precise about what is being claimed. "Venue X had 23 overrides" is OBSERVED. "Venues typically accumulate 20+ overrides" is HYPOTHETICAL without more data.

4. **Hypothesis validation:** Does this observation validate or invalidate any existing HYPOTHETICAL claims? If so, update the corresponding entries in UX-HYPOTHESES-AND-QUESTIONS.md.

5. **Insight extraction:** Does this observation produce a new OPERATIONAL insight that was not previously documented? If so, add it to OPERATIONAL-INSIGHTS-LOG.md.

6. **Cross-reference:** Does this observation affect any DESIGN-PRINCIPLES-FOR-OPERATIONS.md principle? If so, note the connection.

### 10.2 The Observer Bias Problem

Field observations are filtered through the observer's pre-existing mental model. An observer who expects to find override accumulation will notice overrides more than other entropy patterns. This bias is not eliminable, but it can be mitigated by:

- Documenting what the observer was looking for when the observation was made
- Structuring field visits around explicit observation protocols rather than open-ended exploration
- Having multiple independent observers review the same deployment
- Distinguishing between "we looked for this and found it" (strong evidence) and "we noticed this while looking for something else" (weaker evidence)

---

## Section 11 — Future Safety

The purpose of the Knowledge Classification System is not merely to maintain documentary hygiene today. It is to prevent the platform from accumulating mythology over years of evolution.

### 11.1 How Platforms Accumulate Mythology (and How to Prevent It)

**The mythology cycle:**
1. A design decision is made based on a hypothesis
2. The hypothesis is never validated
3. The design persists and is cited as evidence that the hypothesis is correct ("we designed for it, so it must be real")
4. The hypothesis is elevated to canonical status through repeated citation
5. Future decisions are made on the now-canonical claim, which was never validated
6. The platform has mythology

**The prevention:**
- Every design decision cites the classification of the claims it depends on (Section 8)
- HYPOTHETICAL claims must have an explicit validation plan (Section 7.2)
- Claims that are cited repeatedly without validation are flagged for testing (the increasing citation count without validation evidence is a mythology risk indicator)
- RETIRED claims are preserved with their retirement reasoning (prevents mythology resurrection)

### 11.2 The Documentation Review Cycle

The Knowledge Classification System requires active maintenance. The following reviews should be scheduled:

**Per phase:** Review all HYPOTHETICAL claims that have been used in the phase's designs. Have any of them accumulated enough evidence to be promoted? Are any of them being used in ways that require them to be validated before the phase ships?

**Quarterly (at scale):** Review all OPERATIONAL claims against available field data. Can any be promoted to OBSERVED? Are any being contradicted by field data (should move to CONTESTED)?

**Annually:** Review all ANALOGOUS claims. Does the analogy still apply? Has ClubHub-specific evidence superseded the analogous system's evidence?

### 11.3 The Classification Debt Problem

Classification debt accumulates when documents are written without explicit classification of their claims. The initial shared documentation layer contains a mix of classified and unclassified claims. The following priority order for classification debt remediation:

1. **Threshold values** (highest risk — unclassified thresholds may be wrong)
2. **Operator behavioral claims used in design principles** (medium-high risk — wrong behavioral models produce wrong designs)
3. **Claims about what "typically" or "always" happens** (medium risk — these are almost always OPERATIONAL or HYPOTHETICAL)
4. **Historical context claims** (low risk — mainly for documentation clarity)

---

## Appendix A — Classification Quick Reference

| State | Evidence Required | Design Authority | Promotion Path |
|-------|------------------|-----------------|----------------|
| CONSTITUTIONAL | Citation to Engineering Constitution | Absolute | Constitutional amendment only |
| CANONICAL | Formal spec + corpus coverage | High | Must have corpus test |
| OPERATIONAL | Structural reasoning documented | Medium-high | Field data → OBSERVED |
| OBSERVED | Direct field observation | High (for context) | Corpus → CANONICAL |
| ANALOGOUS | Analogous system documented + applicability argued | Medium | Structural reasoning → OPERATIONAL |
| HYPOTHETICAL | Plausibility + explicit reasoning | Low | Validation → OBSERVED or OPERATIONAL |
| EXPERIMENTAL | Running experiment in FUTURE-EXPERIMENTS | None | Completion → OBSERVED or invalidated |
| CONTESTED | Conflicting evidence documented | None | Resolution → higher state |
| RETIRED | Supersession rationale documented | None | Not promotable |
| HISTORICAL | Time period specified | Context-specific | Not applicable |

---

*End of KNOWLEDGE-CLASSIFICATION-SYSTEM.md v1.0*
*This document is maintained by Agent 2.*
*Classification disputes are resolved by Agent 2.*
*Constitutional claims require constitutional amendment process.*
*Append new sections as the platform's epistemological needs evolve.*
