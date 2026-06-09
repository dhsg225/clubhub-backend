# Privacy, Transparency, and Operational Ethics
## Governing Privacy and Ethics Without Destroying Operational Observability or Replay Value
### Version 1 — Phase L, Security, Trust Boundaries, and Operational Defensibility Era

---

## 1. Governing Principle

Privacy and operational transparency are often presented as opposing values requiring trade-off. In a replay-governed deterministic system, this framing is wrong.

The corpus records operational truth: what governance decisions were made, what operator actions occurred, what system states existed. This record serves the institution — its forensic, accountability, and learning functions depend on it. The record also involves real people: operators who took actions, venues whose staff are reflected in operational patterns, audiences who appeared in venue data.

The governing principle is not to choose between privacy and observability. It is to hold both:

> **Observable does not mean exploitable. The corpus records what is operationally necessary to record. It is governed, not mined. What it contains, it contains with purpose. What it does not need to contain, it does not contain.**

This document defines what that means in practice: what is retained, for what purpose, with what protections, under what governance. It defines the ethics of operational observation — how the system treats the humans who are part of its operational record, and what the institution owes them.

---

## 2. Privacy vs. Operational Truth Balancing

### 2.1 The Tension

Operational truth requires that governance decisions, operator actions, and system events be recorded with sufficient fidelity to support forensic investigation, certification review, and institutional learning. Privacy requires that information about individuals not be retained beyond what is necessary, not be used for purposes beyond what individuals would expect, and not be shared beyond what is needed.

These values are not irreconcilable, but they require careful boundary definition.

### 2.2 The Priority Ordering

When privacy and operational truth are in direct tension, the ordering is:

1. **Operational safety first:** If retaining specific information is necessary to prevent a safety-affecting operational failure, it is retained. Safety is not traded for privacy.

2. **Operational necessity second:** If retaining information is necessary for the platform to function correctly (governance decisions, attribution), it is retained with minimum fidelity.

3. **Privacy by default:** Information that is not necessary for operational safety or function is not retained in the corpus. When in doubt, do not retain.

### 2.3 What Operational Truth Requires

The corpus must contain:
- Governance decisions and their basis
- Operator action attribution (who, what authority, what action)
- System state transitions relevant to governance
- Security events
- Infrastructure health events relevant to operational decisions

The corpus does not require:
- Content of operator communications that are not governance-relevant commands
- Personal information about operators beyond what is necessary for attribution
- Information about audiences, visitors, or venue occupants
- HR-relevant performance information (see OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §14)

---

## 3. Data Minimization with Replay Survivability

### 3.1 The Data Minimization Principle

Data minimization means retaining the minimum information necessary for the declared operational purpose. It does not mean retaining as much as possible in case it becomes useful.

Applied to the corpus: if a piece of information is not necessary to support operational governance, forensic investigation, or certification review, it is not recorded. The corpus is not a surveillance archive — it is an operational record.

### 3.2 Minimum Fidelity Requirements

Each event type in the corpus has a declared minimum fidelity: the specific fields required for the event to serve its governance purpose.

**Example: Operator action event**
Required: session pseudonym, action type, target (venue/device), timestamp, outcome
Not required: operator's IP address (unless relevant to a security investigation), browser/client details, irrelevant UI context

**Example: Authentication event**
Required: credential ID (not value), IAL achieved, session ID assigned, timestamp
Not required: the specific authentication method details, client fingerprint, preceding session history

Minimum fidelity is declared per event type and enforced at ingestion. Fields beyond minimum fidelity require explicit justification and have a higher retention classification.

### 3.3 Replay Survivability

Data minimization must not damage replay capability. A replay that cannot reconstruct governance decisions because critical context was not retained is not a valid replay.

Before removing a field from an event type on privacy grounds:
1. Verify that the field is not referenced by any governance decision logic
2. Verify that forensic investigation of incidents of the relevant class does not require the field
3. Verify that replay comparison for drift detection does not use the field
4. Document the removal rationale in the schema governance record

If any of these verifications fail, the field is privacy-protected rather than removed (see §7 for protection methods).

---

## 4. Ethical Observability Boundaries

### 4.1 What May Be Observed

The operational system may observe:
- Actions taken through the declared operational surfaces
- System states that are part of the governance record
- Events that affect governance decisions
- Security events at trust boundaries

### 4.2 What May Not Be Observed

The operational system may not observe:
- Operator behavior outside the operational context (personal communications, non-work activity)
- Physical behavior at terminals (keylogging, continuous screen recording beyond declared session recording)
- Audio from operational spaces without explicit, informed consent
- Biometric data beyond what is necessary for declared authentication at a specific IAL

### 4.3 The Informed Observation Requirement

Operators must be informed, in clear terms, of:
- What the operational system records about their actions
- How long it is retained
- Who can access it
- What it may be used for

This is not a legal disclosure buried in an agreement. It is a standing part of operator orientation and is available on demand through the operational console.

---

## 5. Human Dignity Constraints

### 5.1 Dignity as an Operational Requirement

Operational systems that treat the humans within them as inputs to be optimized rather than people to be served eventually fail. Operators who do not trust that the system treats them with dignity make workarounds, avoid recording honest errors, and disengage from institutional learning. All of these outcomes harm operational safety.

Human dignity constraints are not soft values — they are operational safety requirements.

### 5.2 Dignity in Operational Records

The corpus records operational actions and their contexts. It does not contain:
- Evaluative characterizations of operators ("negligent," "reckless")
- Opinions about operator motivation or character
- Comparisons between operators in a degrading frame
- Information about operators' personal circumstances

Forensic findings about operator actions are stated factually: what happened, what information was available, what the action was, what the outcome was. Evaluative framing belongs in a human review process, not in the corpus.

### 5.3 Dignity in Investigation

When an operator's actions are investigated:
- They are treated as a witness to events, not as a suspect by default
- The investigation begins with the corpus evidence, not with an assumption about their intent
- They are given the opportunity to provide context before conclusions are communicated
- Conclusions are stated as findings about actions, not about character

### 5.4 Dignity in Certification and Training

Certification failure records contain the operational finding (what capabilities were not demonstrated) and the remediation path. They do not contain evaluative characterizations of why the operator failed. The record is about what was observed, not about the person.

---

## 6. Consent and Visibility Governance

### 6.1 What Consent Is Needed

Explicit, informed consent is required before:
- Recording operator behavior beyond what is declared in the standard operational record
- Using corpus records for purposes beyond operational governance, forensic investigation, and certification review
- Sharing individual-level records outside the declared access governance
- Retaining records beyond the declared retention period

### 6.2 What Consent Is Not Needed

Consent is not required for:
- Recording governance actions taken through the operational system (this is the declared operational purpose)
- Using the corpus for forensic investigation of security incidents
- Using the corpus for certification review
- Using aggregate analytics that meet the requirements of OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §12

Operators who use the operational system to take governance actions have been informed that those actions are part of the operational record. Taking an action through the operational system is not a covert act — it is a declared act in a governed environment.

### 6.3 Consent Conditions

Where consent is required, it must be:
- Informed: the operator understands what they are consenting to, in plain language
- Specific: consent to one use does not constitute consent to other uses
- Revocable: operators may withdraw consent (with operational implications that are disclosed at consent time)
- Not coerced: consent under threat of operational consequence is not valid

---

## 7. Replay Redaction Ethics

### 7.1 When Redaction Is Ethical

Redaction from the corpus is ethical when:
- A legal order requires removal of specific information
- Privacy protection requires removal of personally identifiable information that is not relevant to any operational, forensic, or certification purpose
- Security requirements mandate protection of specific technical details

Redaction is not ethical when:
- It is used to make an operational record more favorable to any party
- It removes evidence of an error or incident to avoid accountability
- It is used to conceal the basis for a governance decision

### 7.2 What Redaction May and May Not Remove

**May be redacted:**
- Personally identifiable information in event payloads that is not relevant to the governance decision
- Third-party data that must be protected by legal or contractual obligation
- Credential values that were erroneously included in corpus records (should never occur by design, but if it does, the credential value is redacted and an ingestion gap is fixed)

**May never be redacted:**
- Event type, timestamp, or attribution (who, what, when)
- The existence of an event (events may be content-redacted but may not disappear from the timeline)
- Hash chain linkages
- The fact that a redaction occurred (REDACTION_NOTICE is mandatory and permanent)

### 7.3 Redaction Governance Process

Redaction requires:
1. A written request with declared legal, privacy, or security basis
2. Review by the Governance Authority
3. Approval documentation
4. The redaction is applied with a permanent REDACTION_NOTICE annotation
5. The original record is archived in a separately governed store (not deleted)
6. The redaction is a corpus event: type, scope, basis (not the redacted content), approver, timestamp

---

## 8. "Observable Does Not Mean Exploitable"

### 8.1 The Distinction

The corpus contains information that, if misused, could be used to unfairly evaluate, rank, compare, or surveil operators. The fact that the corpus contains this information does not make those uses legitimate.

Observable means: the operational system records this because it serves a declared operational purpose.

Exploitable means: the information is used for purposes that were not declared, that the operators were not informed of, or that harm the operators' interests in ways they did not accept.

### 8.2 Prohibited Exploitative Uses

The following uses of corpus content are explicitly prohibited regardless of technical feasibility:

- Using operator action patterns to generate performance rankings without operator consent and human review
- Using corpus records to build predictive models of which operators will "fail" (see OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §19)
- Selling or sharing corpus records containing operator information to third parties without operator consent
- Using corpus records in commercial negotiations in ways that disadvantage operators
- Using aggregate behavioral analytics to make staffing decisions without the human review requirements of OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §15

### 8.3 Purpose Binding

Corpus records have declared purposes. Use of corpus records for purposes not in the declared set requires:
- A new purpose declaration
- Assessment of privacy impact of the new purpose
- Operator notification if the new purpose is individual-affecting
- Governance approval

Purpose binding prevents the gradual expansion of corpus use beyond what operators were informed of.

---

## 9. Operator Awareness Requirements

### 9.1 What Operators Must Know

Every operator who takes actions through the operational system must know:
- That their actions are recorded in the corpus
- The types of information that are recorded
- How long records are retained (by record type)
- Who may access records that involve their session (by role category, not necessarily by name)
- What the records may be used for (by declared purpose)
- How to request review of records that involve their session
- How to raise concerns about how records are being used

### 9.2 When Operators Must Be Informed

Operators are informed at:
- Initial orientation (before first session)
- When the information governance policy changes
- When their records are accessed for investigation (after the access, unless the investigation requires prior notification to be withheld — in which case notification occurs when the investigation is concluded or can safely reveal itself)
- When a decision that affects them is made using their records as a basis

Operators are not informed of aggregate analytics uses that do not involve their individual records.

### 9.3 Operators' Right to Review

An operator may request to review the corpus records that involve their session. This request:
- Is fulfilled within 10 business days
- Provides the records with pseudonyms resolved (so they can verify it is their session)
- Excludes records that are part of an active security investigation where disclosure would compromise the investigation (this exception is stated; the operator knows the review is incomplete due to the exception)
- Is logged as an access event in the corpus

---

## 10. Surveillance-Culture Prevention

### 10.1 What Surveillance Culture Is

Surveillance culture emerges when operators feel that everything they do is being watched, evaluated, and used against them. It produces:
- Avoidance of honest error reporting (errors go unreported rather than into a record)
- Risk aversion (operators take safe-looking actions rather than correct ones)
- Disengagement from institutional learning (operators do not contribute to process improvement for fear of surfacing their errors)
- General corrosion of trust between operators and the organization

Surveillance culture is an operational safety risk. Systems that feel like surveillance tools are used defensively rather than as operational partners.

### 10.2 Prevention Architecture

**No persistent individual performance monitoring.** As established in OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md, individual-level behavioral signals are not maintained beyond their minimum retention period. The corpus is not a performance database.

**Visible purpose.** Every type of corpus recording has a visible, declared purpose. Operators are not left to wonder why something is being recorded.

**Operator agency.** Operators can see what is recorded about them and can flag concerns. They have agency in the system, not only exposure.

**Honest-error protection.** Honest reporting of errors is explicitly protected. An operator who reports an error they made is not punished for the reporting. The error is in the corpus regardless; the question is whether the institutional response to honest reporting is safe or unsafe.

**No gameable metrics.** Per OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §16, metrics that can be gamed by individual operators are not surfaced to individual operators. Gaming metrics destroys both the metrics and the operational behavior.

---

## 11. Ethical Analytics Boundaries

### 11.1 The Permitted Domain of Analytics

Analytics is permitted where it improves the operational system without individual harm:
- System design improvement (which interfaces cause confusion)
- Process design improvement (which procedures don't match operational reality)
- Training design improvement (which scenario types show aggregate gaps)
- Institutional readiness (fleet-level and venue-level aggregate health)

### 11.2 The Forbidden Domain of Analytics

Analytics is forbidden where it creates harm to individuals regardless of aggregate value:
- Individual performance comparison or ranking
- Predictive failure modeling for specific operators
- Behavioral profiling that feeds into employment decisions without human review
- Any use that makes operators objects of analysis rather than subjects of support

### 11.3 New Analytics Governance

Before implementing a new analytics capability:
1. Declare the specific question the analytics is designed to answer
2. Declare the corpus data it uses
3. Assess the privacy impact (does it affect individual-level data?)
4. Confirm it is in the permitted domain
5. Document the purpose binding
6. Inform operators of the new analytics capability if it involves their individual data

Analytics capabilities are not self-expanding. Each capability is declared and governed independently.

---

## 12. Retention Governance

### 12.1 Retention Principles

Retention periods are determined by the minimum period necessary to serve the declared purpose. Data is not retained indefinitely because storage is cheap. It is retained exactly as long as needed and then deleted.

### 12.2 Retention Schedule

| Record Type | Purpose | Retention Period |
|---|---|---|
| Governance decisions | Operational record, forensic | 7 years |
| Operator action records | Attribution, forensic, certification | 5 years |
| Security events | Forensic, compliance | 7 years |
| Authentication records | Security investigation | 2 years |
| Session records | Attribution, security | 2 years |
| Infrastructure health events | Forensic, drift detection | 3 years |
| Certification examination records | Certification | 5 years |
| Simulation session records | Training | 1-5 years (by session type) |
| Aggregate analytics | Operational learning | 3 years |
| Individual behavioral signals | Process improvement | 30 days |
| Emergency access records | Compliance | 7 years |

### 12.3 Retention Compliance

Retention compliance is verified:
- Automated deletion processes run at declared intervals
- Deletion events are logged (type of records deleted, count, date)
- Retention periods may not be extended without governance authority approval and purpose declaration

### 12.4 Legal Hold

When records are subject to legal hold (litigation, regulatory investigation), retention periods are suspended and the hold is a governance record:
- Hold scope (what types of records, what time window)
- Hold basis (the legal or regulatory reason)
- Hold authority (who declared the hold)
- Hold duration (or open-ended with periodic review)

Records under legal hold may not be deleted or redacted without the hold authority's approval.

---

## 13. Sensitive-Data Classification

Some data in the operational corpus requires additional governance beyond the standard retention and access controls.

### 13.1 Sensitivity Tiers

**TIER S1 — STANDARD OPERATIONAL:**
Normal corpus records. Governed by standard retention and access controls.

**TIER S2 — OPERATOR-PERSONAL:**
Records that contain information that could identify an individual operator's specific behavior in a way that could affect their employment or professional standing. Access requires Tier 3 authority plus declared purpose. Retention per schedule.

**TIER S3 — SECURITY-SENSITIVE:**
Records related to security investigations, credential governance, or trust boundary breaches. Access requires security incident authority. Retention extended to 7 years.

**TIER S4 — LEGALLY-SENSITIVE:**
Records subject to legal hold, regulatory requirement, or that may constitute legal privilege. Access requires explicit legal review. Retention determined by legal hold or regulatory requirement.

### 13.2 Sensitivity Classification in the Corpus

Records are classified at ingestion where classification is determinable. Some records can only be classified post-hoc (when their involvement in a security investigation or legal matter is determined). Reclassification upward is always permitted; reclassification downward requires governance authority review.

### 13.3 Handling Requirements by Tier

Each tier's access, query, and export requirements are more restrictive than the tier below. S4 records may not be exported without explicit legal approval. S3 records may not be shared across regions without security incident coordination. S2 records may not be exported outside the organization without operator consent.

---

## 14. Auditability vs. Privacy Reconciliation

### 14.1 The Reconciliation Challenge

External auditors need access to corpus records to verify governance. Those records contain operator information protected by privacy governance. The reconciliation mechanism must provide audit access without violating privacy protections.

### 14.2 Audit Access Model

**For external governance audits:**
- Auditors receive access to corpus records with operator information pseudonymized
- Pseudonyms are consistent within the audit scope (so the auditor can see that Session X took actions in both event A and event B, without knowing who Session X is)
- Pseudonym resolution requires court order, regulatory mandate, or explicit operator consent

**For external security audits:**
- Same as governance audits for most records
- Security event records may require higher-fidelity access for specific investigation purposes
- Higher-fidelity access is declared and logged; the operator whose records are accessed is notified after the audit

**For regulatory audits:**
- The applicable regulatory requirements determine the access level
- The regulatory basis is documented in the corpus as a governance record
- Compliance with regulatory access requirements does not constitute a privacy governance failure

### 14.3 Audit Record

Each external audit access is a corpus event:
- Who accessed (auditor identity and organization)
- What was accessed (record types, time window, pseudonymization level)
- Declared purpose (governance audit, security audit, regulatory)
- Authorization basis
- Timestamp

---

## 15. Transparency Obligations

### 15.1 Institutional Transparency

The organization operating the ClubHub TV platform has transparency obligations to operators, venues, and oversight bodies regarding:
- What data is collected and how it is used
- What security controls are in place
- What rights individuals have regarding their data
- How to exercise those rights
- The outcome of institutional ethics reviews (see §16)

### 15.2 Transparency Publication

An annual transparency report is published covering:
- Types of data collected and their purposes
- Aggregate record counts by type
- Legal hold events (count, not content)
- External audit requests and their disposition
- Privacy-related governance decisions
- Ethical drift indicators detected and responses (see §16.3)
- Changes to the privacy governance framework

The report is available to all operators and to relevant oversight bodies.

### 15.3 Individual Transparency

Each operator has the right to:
- Know what records the corpus holds that are attributable to their sessions
- Access those records within the access governance framework
- Know when their records are accessed for investigation
- Know when their records are used as the basis for a decision that affects them

These rights are exercised through a declared process, available through the operational console.

---

## 16. Institutional Ethics Review Triggers

### 16.1 When Ethics Review Is Required

The following events trigger a formal institutional ethics review of operational data practices:

- A new data collection capability is proposed that involves individual operator behavioral data
- An existing analytics capability is proposed to be extended to individual-level analysis
- A third-party request is received to share corpus records containing operator information
- An internal request is received to use corpus records for a purpose not in the declared set
- A significant policy change is proposed (retention extension, new analytics purpose, new access grant)
- An operator or operators raise a formal concern about how their data is being used
- An audit finds a gap between declared practices and actual practices

### 16.2 Ethics Review Process

An institutional ethics review includes:
- Identification of the privacy interests affected
- Assessment of the operational necessity or other benefit of the proposed change
- Assessment of alternative approaches that might achieve the benefit with less privacy impact
- Operator representation: affected operators have the opportunity to provide input
- An independent reviewer who is not in the organizational chain of the requesting party
- A documented finding with rationale

### 16.3 Ethical Drift Indicators

Ethical drift is the gradual expansion of data practices beyond their original, consented-to scope. It often happens through individually-reasonable steps that collectively produce an unjustifiable outcome.

The following patterns indicate ethical drift:

**PURPOSE_CREEP:** Corpus data that was collected for operational purpose A is now routinely used for purposes B and C, without explicit declaration or operator notification.

**RETENTION_NORMALIZATION:** Retention periods that were declared as maximum periods have become treated as minimum periods; data is retained past its declared period by default.

**AGGREGATE_DISAGGREGATION:** Analytics that were declared as aggregate-only are being applied to specific teams or small groups where the aggregate effectively identifies individuals.

**CONSENT_CIRCUMVENTION:** Situations where consent is theoretically required but the process has evolved to treat a related consent as sufficient.

**INVESTIGATION_SCOPE_EXPANSION:** Security investigations that routinely access records beyond the scope of the suspected incident, treating the investigation as a license for broader access.

When an ethical drift indicator is identified, it triggers an ethics review and a remediation plan. The plan is published in the next transparency report.

---

## 17. Explicitly Forbidden Exploitative Practices

The following practices are explicitly and permanently prohibited:

**BEHAVIORAL_SURVEILLANCE_THEATER:** Presenting operational data collection as a "safety feature" or "quality improvement initiative" when the actual use is individual performance monitoring.

**CONSENT_LAUNDERING:** Obtaining a broad consent at orientation and using it to authorize specific subsequent uses that operators would not have consented to if asked directly.

**INVESTIGATIVE_FISHING:** Using a legitimate investigation as authorization to access corpus records that are not relevant to the investigation, building a broader behavioral profile than the investigation requires.

**RETENTION_HOARDING:** Retaining records beyond declared retention periods on the grounds that they "might be useful" without a specific declared purpose and governance authorization.

**AGGREGATE_AS_COVER:** Publishing aggregate analytics that are effectively individual analytics because the aggregated group is small enough to identify individuals.

**EXPORT_WITHOUT_CONSENT:** Exporting corpus records containing operator information to third parties (vendors, partners, analysts) without explicit operator consent and purpose declaration.

**REIDENTIFICATION_FROM_PSEUDONYMS:** Attempting to resolve pseudonymized corpus records to real identities outside the declared resolution process.

**ALGORITHMIC_ADJUDICATION:** Using automated analysis of corpus records as the decision mechanism for outcomes affecting individual operators (dismissal, demotion, suspension) without the human review requirements of OPERATIONAL-BEHAVIOR-ANALYTICS-v1.md §15.

**DATA_MINIMIZATION_DELAY:** Repeatedly postponing data minimization actions (field removal, retention cleanup) because the data "might be needed" without a specific declared need.

---

## 18. Ethical Drift Indicators Summary

| Indicator | Description | Review Trigger |
|---|---|---|
| PURPOSE_CREEP | Data used for undeclared purposes | Immediate ethics review |
| RETENTION_NORMALIZATION | Data retained beyond declared periods by default | Quarterly audit flagging |
| AGGREGATE_DISAGGREGATION | Small-group analytics effectively identifying individuals | Immediate halt and review |
| CONSENT_CIRCUMVENTION | Related consents used as substitutes for direct consent | Ethics review before next use |
| INVESTIGATION_SCOPE_EXPANSION | Investigations routinely accessing out-of-scope records | Audit pattern review |
| SILENT_CAPABILITY_EXPANSION | New analytics capabilities added without declaration | Immediate declaration required |
| TRANSPARENCY_DELAY | Transparency report delayed or incomplete | Governance escalation |
| OPERATOR_COMPLAINT_PATTERN | Multiple similar concerns from operators | Formal ethics review |

---

## 19. Replay-Safe Privacy Patterns

The following architectural patterns implement privacy while preserving replay capability:

**PSEUDONYMIZATION_AT_INGESTION:** Operator identities are pseudonymized when events are written to the corpus. The pseudonym is consistent within a session (so replay can reconstruct session-level behavior) but cannot be linked to a real identity without the credential store.

**MINIMUM_FIDELITY_SCHEMAS:** Each event type schema declares minimum and optional fields. Optional fields that contain individual-identifying information are not written to the corpus by default; they require explicit enrichment for specific investigation purposes.

**FIELD_LEVEL_REDACTION:** Specific fields within corpus records can be redacted without affecting the governance-relevant content. A redacted field is preserved as a REDACTED marker in the schema, not deleted from the record structure.

**SEPARATION_OF_CONCERNS:** Replay infrastructure is separated from identity infrastructure. The replay corpus does not hold identity resolution. Identity resolution is a separate service with separate governance.

**AGGREGATE_MATERIALIZATION:** Analytics that need individual-level data to compute aggregate results perform the computation and discard the individual inputs. The aggregate is materialized in the analytics store; the individual inputs are not retained there.

---

## 20. Constitutional Principles for Humane Operations

These principles govern how the platform treats the humans within its operational scope. They are not aspirational — they are requirements against which the platform is measured.

**PRINCIPLE 1 — DIGNITY:** The corpus records actions, not worth. Findings about actions are not findings about people.

**PRINCIPLE 2 — TRANSPARENCY:** Operators know what is recorded, why, how long, and who sees it. There is no covert observation.

**PRINCIPLE 3 — PURPOSE:** Data is used for declared purposes. Purpose expansion requires declaration, assessment, and operator notification.

**PRINCIPLE 4 — MINIMIZATION:** What does not need to be retained is not retained. The corpus serves governance; it does not serve institutional curiosity.

**PRINCIPLE 5 — PROTECTION:** Individual-level records are protected from uses that harm the individuals they concern. Observable is not exploitable.

**PRINCIPLE 6 — PARTICIPATION:** Operators have rights: to know, to review, to raise concerns, to respond before conclusions about them are communicated. These rights are real, not performative.

**PRINCIPLE 7 — ACCOUNTABILITY:** The institution is accountable for how data is used. Accountability is demonstrated through transparent reporting, ethics reviews, and responsive handling of concerns.

**PRINCIPLE 8 — PROPORTIONALITY:** Operational observation is proportionate to operational necessity. The scope of what is observed matches the scope of what is needed, not the scope of what is possible.
