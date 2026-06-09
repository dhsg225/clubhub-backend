# Security Incident and Forensic Operations
## Governing Investigation and Handling of Operational Security Incidents
### Version 1 — Phase L, Security, Trust Boundaries, and Operational Defensibility Era

---

## 1. Governing Principle

Security incidents are not crises to be managed by panic. They are operational events to be understood by evidence.

The replay corpus exists specifically for this: when something goes wrong, the record of what happened is preserved, tamper-evident, and fully reconstructable. A security incident in a replay-governed system is not a mystery — it is an investigation. The evidence is already captured. The task is to examine it methodically, contain the impact without destroying the record, and restore trust through demonstrated understanding, not through speed of declaration.

The governing principle is:

> **Containment preserves evidence. Resolution requires understanding. Trust is restored through verified recovery, not through asserted confidence.**

This means security incident handling is forensic by default. Operators do not guess. They investigate. They do not declare recovery when the system looks normal — they declare it when the evidence supports it.

---

## 2. Security Incident Taxonomy

### 2.1 Classification by Impact

**CLASS 1 — PROBE:**
Reconnaissance or attempted access that did not result in any change to operational state. No governance state affected. Examples: failed authentication attempts, boundary probe attempts, credential stuffing that did not succeed.

**CLASS 2 — PARTIAL_BREACH:**
An unauthorized crossing of a trust boundary that resulted in read access to operational information but no modification of governance state. The corpus record is intact. The scope of information exposed is determinable from the corpus.

**CLASS 3 — GOVERNANCE_INTERFERENCE:**
Unauthorized action that modified operational state but the governance kernel and corpus remain intact. Examples: unauthorized schedule change, unauthorized device configuration modification. The change is visible in the corpus; its effects are bounded.

**CLASS 4 — CORPUS_INTEGRITY_THREAT:**
An attempt or success at affecting the integrity of the corpus record. This is the highest impact category. It includes hash chain breaks, unauthorized corpus writes, ingestion pipeline manipulation, and corpus record modification attempts.

**CLASS 5 — IDENTITY_COMPROMISE:**
Operator credential or session token compromise with confirmed unauthorized use. Governance decisions may have been made under a false identity. The affected window requires full forensic review.

**CLASS 6 — INFRASTRUCTURE_COMPROMISE:**
Infrastructure components (database servers, event bus, compute) have been compromised. Even if the application layer is intact, infrastructure compromise creates risk of data exposure and may affect future operations.

### 2.2 Classification by Certainty

Each incident is also classified by how certain the classification is:

**CONFIRMED:** Evidence sufficient to classify without reasonable doubt.
**PROBABLE:** Evidence strongly suggests this classification but alternative explanations exist.
**SUSPECTED:** Indicators suggest this classification but evidence is not yet sufficient.
**UNDER_INVESTIGATION:** An anomaly has been detected; classification has not been determined.

Incidents begin at UNDER_INVESTIGATION and are reclassified as investigation proceeds. Premature certain classification before evidence supports it is an anti-pattern (see §18).

---

## 3. Evidence Preservation Governance

### 3.1 Evidence Preservation is the First Priority

At the moment a security incident is suspected, evidence preservation takes priority over operational continuity. Evidence that is overwritten, lost, or contaminated during incident response may make it impossible to understand what happened, who was responsible, and what was affected.

Containment steps that would destroy evidence require explicit Certification Authority approval. When in doubt, preserve and restrict rather than clean and restore.

### 3.2 What Must Be Preserved

**Corpus state at detection time:**
A snapshot of the corpus state at the time the incident was first detected is taken immediately and stored as the incident anchor. Subsequent changes to the corpus are additions; the anchor snapshot is immutable.

**Authentication and session records:**
All authentication events, session establishment records, and session activity logs for the period beginning 24 hours before the earliest suspected incident event.

**Trust boundary crossing records:**
All trust boundary crossing logs for the affected boundaries and the 24-hour window.

**Infrastructure logs:**
System logs from affected infrastructure components, captured before any restarts or remediation that would overwrite log buffers.

**Network flow records:**
Where available, network flow records for the incident window. These may exist in infrastructure monitoring systems outside the corpus.

### 3.3 Evidence Integrity

Preserved evidence is hash-verified at the time of capture:
- Each evidence artifact is given an evidence hash at capture time
- The hash is recorded in the incident corpus record
- Any examination of the evidence must verify the hash before drawing conclusions
- Evidence whose hash does not verify is noted as potentially tainted

### 3.4 Chain of Custody

Evidence custody is tracked from capture:
- Who captured it
- When it was captured
- Where it is stored
- Who has accessed it and when
- The purpose of each access

Chain-of-custody records are stored in the incident corpus record. Evidence without a chain of custody cannot be cited as primary evidence in any consequential finding.

---

## 4. Replay-Backed Forensic Workflows

### 4.1 The Forensic Replay Advantage

Because the corpus is append-only and hash-chained, the forensic investigator has an unusual advantage: the record of what happened is immutable. The question is not "is the evidence intact?" (it is, by design) but "what does the evidence show?"

Forensic replay (see REPLAY-INTELLIGENCE-AND-FORENSICS-v1.md §8) is the primary investigation tool. The investigator replays the corpus from before the suspected incident window and traces what happened through the record.

### 4.2 Security-Enhanced Forensic Replay

Security forensic replay uses the same replay infrastructure as operational forensic replay, with additions:
- Security events (authentication, boundary crossings, trust state changes) are included in the replay stream
- Identity context at each event is shown (IAL, session state, delegation status at that moment)
- Concurrent activity across sessions is visible (multiple operators or services acting in the same window)

This produces a complete picture of both what happened operationally and who was authenticated to do what at each moment.

### 4.3 Replay of Suspected Manipulation

When corpus manipulation is suspected (CLASS 4 incident):
- Replay is run both forward (from anchor to incident detection) and hash-check-forward (verifying each packet in the chain)
- Any hash chain break is the evidence of the manipulation point
- The replay before the break is trusted; the replay at and after the break is under investigation
- The investigator does not proceed past the break without documenting it explicitly

### 4.4 Comparative Replay

For some security incidents, comparative replay is valuable:
- Replay the suspected compromise window from the incident anchor
- Replay the same period from a known-clean state (if available in a SECONDARY region)
- Compare the two outputs event by event

Differences between the two replays indicate state changes that are not explained by events in the primary corpus window — a strong indicator of unauthorized state modification.

---

## 5. Compromise Confidence Classification

Before any consequential response action is taken, the compromise is classified by confidence level. This prevents over-response to false positives and under-response to real incidents.

### 5.1 Confidence Levels

**CONFIDENCE_0 — UNCLASSIFIED:**
An anomaly has been detected. It has not been assessed. No conclusion yet.

**CONFIDENCE_1 — LOW:**
The anomaly is more likely explained by operational conditions (configuration drift, timing, human error) than by compromise. Monitoring is elevated; no containment yet.

**CONFIDENCE_2 — MODERATE:**
The evidence is consistent with compromise but also consistent with non-malicious explanations. Active investigation with light containment (elevated scrutiny, session flagging).

**CONFIDENCE_3 — HIGH:**
The evidence strongly supports compromise. Alternative explanations would require unlikely coincidence. Active containment is warranted.

**CONFIDENCE_4 — CONFIRMED:**
The evidence is sufficient to conclude compromise without reasonable doubt. Full containment and investigation protocol.

### 5.2 Classification Governance

Classification is made by the security incident authority (Tier 3 or above) based on:
- Corpus evidence with trust scores
- Infrastructure evidence
- Pattern analysis

Classification may not be made based solely on automated detection output without human review of the underlying evidence. Automated detection alerts are CONFIDENCE_0 or CONFIDENCE_1 until human review upgrades them.

---

## 6. Incident Containment Sequencing

### 6.1 Containment Principles

Containment scope must be proportional to confidence level. Contain the minimum scope necessary to prevent further damage at the current confidence level. Expand containment as confidence increases.

**CONFIDENCE_1:** Monitor-only. No operational restriction.
**CONFIDENCE_2:** Elevate scrutiny on affected sessions/boundaries. Log at maximum detail.
**CONFIDENCE_3:** Restrict affected sessions/boundaries. Alert incident authority.
**CONFIDENCE_4:** Isolate affected scope. Notify all affected parties.

### 6.2 Containment Steps at CONFIDENCE_3 and Above

1. **Identify the containment scope.** Which sessions, venues, regions, and system components are in the blast radius of the confirmed or suspected compromise?

2. **Notify affected operators.** Before restricting their sessions, notify operators in the affected scope. Do not silently restrict. The notification includes what is happening and what they can still do.

3. **Restrict the affected scope.** Apply the appropriate degradation state (see SECURITY-AND-TRUST-BOUNDARY-GOVERNANCE-v1.md §12) to the affected scope.

4. **Preserve further evidence.** Evidence continues to be generated during containment. Continue capturing and hashing it.

5. **Assess for propagation.** Has the compromise propagated beyond the initially identified scope? Continuously assess as investigation proceeds.

6. **Communicate to incident authority.** The incident authority receives continuous updates. Not a single initial briefing and silence.

### 6.3 Containment Without Operational Shutdown

Containment does not mean stopping all operations. It means stopping the specific operations that the compromise affects or threatens. An incident at a single venue's trust boundary does not require shutting down all venues.

When in doubt, the principle is: restrict the affected, preserve the unaffected. Do not quarantine the entire system to protect against a threat that may be contained to a smaller scope.

---

## 7. Operational Continuity During Compromise

### 7.1 The Continuity Obligation

The platform has venues that depend on it for their operations. Security incidents must be managed in a way that minimizes operational disruption to venues that are not in the compromise scope.

This requires accurate blast-radius assessment at the outset. Overly broad containment that disrupts unaffected venues is a governance failure as well as a security response failure.

### 7.2 Continuity During CLASS 1–3 Incidents

For CLASS 1 (probe), CLASS 2 (partial breach), and CLASS 3 (governance interference):
- Normal operations continue at venues outside the incident scope
- Venues within the incident scope operate under the degradation level appropriate to the confidence classification
- Operators at all venues are informed at the appropriate level of detail

### 7.3 Continuity During CLASS 4–6 Incidents

For CLASS 4 (corpus integrity threat), CLASS 5 (identity compromise), CLASS 6 (infrastructure compromise):
- The affected region or component enters formal security incident state
- Operations that depend on confirmed corpus integrity are restricted platform-wide until the integrity assessment is complete
- Schedule execution continues from local venue cache (which does not depend on ongoing corpus integrity)
- The 72-hour venue survivability architecture provides operational continuity during the investigation

### 7.4 Continuity Communication

All operators receive communications appropriate to their role and the incident's relevance to their operations:
- Operators in the incident scope: full briefing on what is happening, what is restricted, and what they can do
- Operators outside the incident scope: notification that an investigation is underway, status of their own operations, and what to report if they notice anything unusual

Silence about an active security investigation to operators who may be affected is not acceptable. Withholding information that operators need to safely perform their work is itself a governance failure.

---

## 8. "Trusted, Degraded, Compromised, Unknown" Trust States

### 8.1 The Four Trust States

Every operational component, session, and region exists in one of four trust states:

**TRUSTED:**
The component is operating within verified parameters. Its outputs are accepted as authoritative at its declared tier. Evidence of correct behavior has been confirmed recently.

**DEGRADED:**
The component is experiencing conditions that reduce confidence in its outputs but does not indicate confirmed compromise. Its outputs are accepted with declared uncertainty. Examples: elevated authentication failure rate, replication lag, recent boundary anomaly under investigation.

**COMPROMISED:**
Evidence confirms that the component has been affected by unauthorized action. Its outputs are not accepted without additional verification. Active investigation and containment are underway.

**UNKNOWN:**
The component's trust state cannot be determined. Its outputs are accepted only for non-governance operations (read-only, locally-scoped). All governance decisions that depend on this component are suspended or routed around it until the state is determined.

### 8.2 Trust State Transitions

Trust state transitions are always explicit, always corpus-recorded, and always communicated to operators who depend on the component:

- TRUSTED → DEGRADED: triggered by anomaly detection, with the specific anomaly declared
- DEGRADED → TRUSTED: requires positive confirmation that the anomaly has been explained or resolved
- DEGRADED → COMPROMISED: requires CONFIDENCE_3 or above classification
- COMPROMISED → TRUSTED: requires full forensic review completion and recovery re-establishment (§13)
- Any state → UNKNOWN: triggered when the assessment mechanism itself fails

### 8.3 The UNKNOWN State

UNKNOWN is not a resting state — it is an investigation trigger. The system cannot operate in a coherent way with major components in UNKNOWN trust state. UNKNOWN components are assigned immediate investigation priority.

If an UNKNOWN state cannot be resolved within 4 hours, it is escalated to COMPROMISED for governance purposes. This is conservative (it may not be compromised) but it ensures that unresolved UNKNOWN does not silently enable compromised-state operation.

---

## 9. Credential Rotation Governance

### 9.1 Rotation Categories

**Scheduled rotation:** Credentials are rotated before their maximum validity period expires. This is planned, non-urgent, and has no operational urgency.

**Precautionary rotation:** Credentials are rotated because a potential exposure has been identified, even without confirmed compromise. Faster than scheduled rotation; still planned.

**Incident-driven rotation:** Credentials are rotated immediately as part of incident containment. The rotation must not destroy evidence; the sequence is capture evidence first, then rotate.

### 9.2 Rotation Sequencing

For incident-driven rotation:
1. Preserve evidence (§3.2) before any rotation begins
2. New credentials are generated and distributed through secure channels
3. The old credential is revoked
4. Revocation propagates to all trust boundaries (60-second window)
5. All active sessions using the old credential are invalidated
6. Session holders are notified and given re-authentication guidance
7. The rotation is a corpus event: old credential ID, new credential ID (not values), rotation reason, timestamp

### 9.3 Rotation Without Evidence Destruction

Credential rotation must not destroy evidence of how the credential was used. The credential's usage history in the corpus is preserved:
- The corpus contains credential IDs, not credential values
- Rotating the credential value does not affect the corpus records that reference the credential ID
- Post-rotation, the old credential ID in the corpus is annotated with its rotation event

---

## 10. Insider-Threat Handling Constraints

### 10.1 The Insider-Threat Problem

Insider threats — authorized operators acting outside their authority or against the platform's interests — require careful handling. The investigation process must not:
- Make false accusations
- Damage the working environment for the majority who are not threats
- Create a surveillance culture that destroys operational trust
- Pre-judge outcomes before evidence is examined

### 10.2 Evidence-First Protocol

Insider-threat investigations begin with the corpus evidence, not with suspicion:
1. An anomaly in operational behavior is detected
2. The corpus is examined for the relevant events
3. The investigation is framed around what happened, not around who might have done it
4. If the evidence points toward a specific session, the session is investigated — not the person, until the session evidence is examined

### 10.3 Investigation Separation

Insider-threat investigations are conducted by personnel who are not in the affected operator's organizational chain:
- A supervisor cannot investigate a report involving themselves
- The investigation authority must be independent of the suspected scope

### 10.4 Operator Protections

An operator whose session is under investigation retains rights:
- They are not silently monitored without their knowledge that an investigation is active (they are informed that their session has been flagged, though not necessarily the full scope of the investigation)
- Evidence is examined before conclusions are communicated to their organization
- They have the right to review the corpus evidence that involves their session and to respond

These protections are not obstacles to investigation. They are requirements for investigations that produce trustworthy findings. An investigation that violates them produces findings that cannot be defended.

---

## 11. Forensic Replay Chain of Custody

### 11.1 Chain of Custody for Replay Evidence

When corpus replay is used in a forensic investigation, the replay evidence itself has a chain of custody:
- Which corpus packets were replayed (identified by packet ID and hash)
- The trust score of each packet at the time of replay
- Who ran the replay, on what system, at what time
- The output of the replay (what the replay produced) captured and hashed

The chain of custody ensures that findings derived from replay can be independently verified. Another investigator can run the same replay on the same corpus and produce the same output.

### 11.2 Replay Environment Integrity

Forensic replay is run in an environment that is confirmed to be running the same software version as the system did at the time of the events:
- Software version is declared and verified against the version record in the corpus
- The replay environment is isolated from the live system (it cannot affect live state)
- The replay environment's integrity is verified before use

### 11.3 Replay Evidence Presentation

When replay evidence is presented in a consequential review (incident finding, certification decision, external audit):
- The corpus packet IDs and hashes are cited
- The chain of custody is attached
- The replay environment configuration is documented
- The output is presented with confidence caveats where applicable (trust score, any gaps or redactions)

Findings that cite replay evidence without chain of custody cannot be used as primary evidence in consequential decisions.

---

## 12. Security-Event Observability

### 12.1 Security Events Are Visible

Security events are not a hidden system. They appear in the operational surface for operators with the appropriate scope:
- Session-affecting security events are visible to the session holder
- Venue-scope security events are visible to operators with venue authority
- Regional-scope security events are visible to regional authority

The visibility model ensures that the people most able to provide context about a security event (the operators who were present) are informed.

### 12.2 Security Event Feed

A security event feed is available to operators at Tier 3 and above showing:
- All open security events in their scope
- Classification, confidence level, and current containment state
- Investigation progress (what has been examined, what is pending)
- Actions taken and their outcomes

The security event feed is read-only for operators who are not the incident authority. Operators can see what is happening without being able to interfere with the investigation.

### 12.3 Anti-Panic Security Communication

Security event communication is designed to inform without panicking:
- Events are described in operational terms (what is affected, what operators can do)
- Confidence levels are explicit (this is suspected, not confirmed)
- The response is described (what the system is doing about it)
- The impact on current operations is clear (what operators can still do)

Security event communications that are vague, alarmist, or that restrict operations without explanation produce panic and workarounds. Both are worse than the original incident.

---

## 13. Recovery Trust Re-Establishment

### 13.1 Trust is Earned Back Through Evidence

After a security incident, trust in affected components is re-established through evidence of clean state, not through elapsed time or asserted confidence.

The criteria for trust re-establishment differ by incident class:

**CLASS 1–2:** Trust is restored when the corpus record shows no state modification from the incident and the boundary anomaly has been explained and remediated.

**CLASS 3:** Trust is restored when the unauthorized modification has been identified, contained, and its effects assessed. The corpus annotation of the affected events is complete.

**CLASS 4:** Trust is restored only after full corpus integrity verification passes. The hash chain is intact from the anchor through the present.

**CLASS 5:** Trust is restored only after all potentially compromised credentials have been rotated, all sessions in the affected window have been reviewed, and all actions during the compromise window have been classified (authorized or unauthorized).

**CLASS 6:** Trust is restored only after infrastructure integrity has been verified by an independent assessment, not solely by the infrastructure provider's assurance.

### 13.2 RECOVERED_BUT_UNTRUSTED Applied to Security

The RECOVERED_BUT_UNTRUSTED state from DISTRIBUTED-INCIDENT-AND-RECOVERY-GOVERNANCE-v1.md §10 applies to security recovery:
- Operations resume when it is necessary to resume them
- The corpus is transparent about which events occurred under reduced trust
- Post-recovery review will classify these events

Security recovery does not require waiting for perfect certainty before resuming operations. It requires transparency about what is and is not confirmed.

---

## 14. Cross-Region Compromise Handling

### 14.1 Scope Assessment

When a security incident is detected, the first cross-region question is: is the compromise confined to one region or has it propagated?

Cross-region propagation is assessed by:
- Reviewing the cross-region trust boundary crossing records for the incident window
- Checking for the incident's indicators of compromise in each region's security event record
- Comparing corpus state across regions for unexpected divergence

### 14.2 Isolated vs. Cross-Region Incidents

**ISOLATED:** The incident's indicators are confined to one region's corpus and security records. Other regions are notified but their operations are unaffected.

**PROPAGATED:** The incident's indicators appear in multiple regions' records. All affected regions enter the appropriate trust state. Cross-region coordination follows the distributed incident protocol (DISTRIBUTED-INCIDENT-AND-RECOVERY-GOVERNANCE-v1.md §4).

### 14.3 Cross-Region Evidence Sharing

Evidence gathered in one region's investigation is shared with other regions through:
- The cross-region incident coordination record (not direct corpus access)
- Explicit evidence transfer with chain-of-custody documentation
- Trust boundary authentication between regions (the evidence transfer itself crosses a trust boundary)

Evidence shared across regions is marked with its source region and the trust score of its originating corpus records.

---

## 15. Anti-Panic Security UX

### 15.1 Why Security Panic is a Security Risk

Operator panic during a security incident produces:
- Hasty actions that destroy evidence
- Over-broad containment that creates operational failures
- Communication failures that leave operators uninformed
- Workarounds that create new vulnerabilities
- Premature "all clear" declarations driven by desire for the incident to be over

Security UX is designed to keep operators informed and calm, not to maximize the apparent severity of what is happening.

### 15.2 Anti-Panic Design Requirements

**Contextualized severity:** Security events are communicated with their operational impact, not in maximally alarming technical terms. "Authentication anomaly detected for your session; session is restricted to read-only pending re-authentication" is better than "SECURITY BREACH DETECTED."

**Specific actionability:** Every security communication tells operators what they can do. "Please re-authenticate to restore your session" is actionable. "Contact your security team" without contact information is not.

**Progress visibility:** If an investigation is ongoing, operators see its progress. They are not left wondering whether anyone is addressing the situation.

**Restoration path:** From the moment an operator is restricted due to a security event, they can see what must happen for their restriction to be lifted. There is no ambiguity about the restoration path.

**Honest uncertainty:** When the investigation has not yet determined the scope or cause, this is communicated honestly. "We have detected an anomaly and are investigating. We will update you as we learn more. Your current operations are unaffected" is better than silence or a false all-clear.

---

## 16. Constitutional Limits on Emergency Authority During Security Incidents

The following are unconditionally prohibited even during active security incidents:

1. **Suspension of corpus integrity monitoring.** The moment when evidence is most needed is during and after an incident. Corpus integrity monitoring must continue during incident response, not be suspended to improve performance.

2. **Anonymous security actions.** Every action taken during incident response is attributed to a session and recorded in the corpus. Incident responders do not operate under generic "incident response" credentials.

3. **Silent state modifications.** Incident response actions that modify operational state (revoke credentials, restrict sessions, alter configurations) are corpus events with attribution. They are not taken silently.

4. **Evidence deletion as remediation.** Removing evidence of the incident is not remediation. Containment and remediation are operational actions that are additive to the corpus. They are not achieved by removing corpus records.

5. **Permanent emergency authority.** Authority granted for incident response is time-limited. An incident that requires ongoing elevated authority is managed through declared, time-limited authority renewals, not through permanent elevation.

6. **Bypassing human review for containment expansion.** Expanding the scope of containment beyond the initially identified blast radius requires human review and authorization. Automated containment expansion without human oversight is prohibited.

7. **Coordinated silence to external parties.** If external parties (venues, operator organizations) are affected by a security incident, they are informed appropriately. Coordinating silence across affected parties to prevent disclosure is prohibited.

---

## 17. Twelve Named Security Incident Scenarios

**SI-001 — CREDENTIAL_STUFFING_CAMPAIGN**
A sustained authentication attempt using credentials from external breach databases. Multiple failed attempts from distributed IP addresses. Indicators: authentication failure rate spike, geographically distributed sources. Response: elevate scrutiny on all authentication, identify any successes, contain any sessions established from the campaign.

**SI-002 — SESSION_HIJACK_DURING_HANDOFF**
A session token is intercepted during a shared-terminal handoff and used from a separate location while the legitimate operator also has an active session. Indicators: concurrent session detection for the same credential. Response: terminate both sessions, require fresh authentication, investigate the interception vector.

**SI-003 — CORPUS_INGESTION_INJECTION_ATTEMPT**
An unauthorized event is submitted to the corpus ingestion pipeline with a forged governance kernel signature. Indicators: failed signature verification at ingestion, unusual event type from unexpected service. Response: preserve the injected event record as evidence, trace the source, verify corpus integrity around the injection attempt.

**SI-004 — INSIDER_SCHEDULE_MODIFICATION**
An operator with schedule modification authority makes unauthorized schedule changes outside their declared scope (wrong venue, wrong time window). Indicators: schedule modification events outside normal patterns for the session, scope boundary violations. Response: corpus review of all schedule modifications in the window, restoration of affected schedules, investigation of authorization failure.

**SI-005 — REGIONAL_BOUNDARY_SPOOFING**
A service claims to be the PRIMARY region in cross-region communications, using a valid certificate from a different service. Indicators: cross-region messages with correct TLS but inconsistent application-layer claims. Response: regional trust boundary ALARM, suspend cross-region operations pending authentication investigation.

**SI-006 — REPLAY_ATTACK_ON_COMMAND**
A previously valid governance command is replayed after its intended execution window. Indicators: sequence number anomaly at the trust boundary, timestamp inconsistency with current corpus state. Response: reject the replayed command (handled by boundary enforcement), investigate why the replay protection did not prevent the attempt at the source.

**SI-007 — INFRASTRUCTURE_COMPROMISE_WITH_DATA_ACCESS**
A database server is compromised, allowing read access to corpus content without modification. The hash chain remains intact but corpus content has been read by an unauthorized party. Indicators: unusual database access patterns, external traffic anomalies. Response: assess scope of exposure, rotate infrastructure credentials, brief affected operator organizations on data exposure.

**SI-008 — AUTHORITY_ESCALATION_CHAIN**
An operator at Tier 1 exploits a delegation chain to acquire Tier 3 authority through a series of individually-authorized steps that together exceed the intended authority. Indicators: unusual delegation pattern, scope of delegation exceeds normal for the role. Response: revoke the delegation chain, review all actions taken under the escalated authority, close the delegation governance gap.

**SI-009 — EMERGENCY_ACCESS_SCOPE_ABUSE**
Emergency access is invoked and used for operations beyond the stated emergency scope. The corpus shows the emergency basis and the actual actions taken, and they do not match. Indicators: corpus comparison of emergency declaration scope vs. actual actions. Response: flag the excess actions for review, security incident classification, emergency access review process.

**SI-010 — LONG_TERM_PERSISTENCE**
An initial compromise from an earlier period has maintained persistence without triggering ongoing detection. The initial event is a CLASS 1 probe that was assessed as low-confidence and not further investigated. Later analysis reveals the probe was successful and a persistent foothold was established. Response: full forensic review of the period from the initial probe, assessment of all actions that may have occurred through the persistent access.

**SI-011 — FORENSIC_CONTAMINATION_ATTEMPT**
During an ongoing security investigation, an attempt is made to alter or add to the corpus record to change the forensic picture. The attempt may come from the compromised account, from an insider, or from an attacker who retains access. Indicators: hash chain break at or after the investigation anchor, unexpected corpus writes. Response: CLASS 4 incident declaration, full corpus integrity assessment, investigation into the contamination attempt.

**SI-012 — SUPPLY_CHAIN_DEPENDENCY_COMPROMISE**
A software dependency used in the platform is compromised at the supply chain level, introducing modified behavior into a deployed service. Indicators: divergent behavior in replay comparison, behavior inconsistent with declared code, infrastructure behavior anomaly. Response: dependency audit, replay comparison to identify affected behavior window, assessment of governance decisions made during the affected period.

---

## 18. Named Forensic Corruption Failures

| ID | Name | Description |
|---|---|---|
| FC-001 | HASH_CHAIN_BREAK | Corpus integrity is compromised at a specific packet; all packets after the break cannot be trusted without independent verification |
| FC-002 | EVIDENCE_OVERWRITE | Recovery actions overwrite log buffers or infrastructure records before they are captured as evidence |
| FC-003 | CUSTODY_GAP | Evidence was accessed without a chain-of-custody record; its integrity cannot be verified |
| FC-004 | REPLAY_ENVIRONMENT_DRIFT | The forensic replay environment differs from the production environment at the time of the events; replay results may not match original execution |
| FC-005 | ANCHOR_CONTAMINATION | The incident anchor snapshot was taken after some compromise had already occurred; the "clean" baseline contains compromised state |
| FC-006 | ANNOTATION_BEFORE_INVESTIGATION | Corpus annotations were made to the incident window before the investigation concluded; the annotations may reflect premature conclusions |
| FC-007 | WITNESS_CONTAMINATION | An operator who is potentially a witness was given detailed investigation findings before being interviewed; their account may now reflect investigation conclusions rather than independent recollection |
| FC-008 | INCOMPLETE_SCOPE | The investigation was concluded while the compromise scope was still growing; subsequent events that fall within the same compromise are investigated as separate incidents, losing the unified picture |
| FC-009 | FALSE_NEGATIVE_CLOSURE | The investigation concluded no compromise based on absence of evidence, when the absence of evidence was itself due to evidence destruction |
| FC-010 | TIMELINE_RECONSTRUCTION_ERROR | The investigation produced a timeline that does not match the corpus timestamps due to clock skew handling errors |

---

## 19. Unsafe Compromise-Response Behaviors

The following compromise-response approaches are documented as unsafe and prohibited:

**WIPE_AND_REINSTALL AS INVESTIGATION SUBSTITUTE:** Rebuilding compromised infrastructure before forensic capture destroys the evidence needed to understand the compromise. Infrastructure must be captured before remediation.

**CREDENTIAL_ROTATION_BEFORE_EVIDENCE_CAPTURE:** Rotating credentials before capturing evidence of how the current credentials were used destroys the attribution chain for actions in the compromise window.

**PREMATURE_ALL_CLEAR:** Declaring the incident resolved before evidence-based criteria for resolution are met. The primary driver is often stakeholder pressure; this pressure must be resisted.

**SCOPE_MINIMIZATION_FOR_COMMUNICATION:** Communicating a narrower compromise scope than the evidence supports, to reduce apparent severity. The communicated scope must match the evidenced scope.

**INVESTIGATION_TIMELINE_COMPRESSION:** Shortening the investigation timeline due to operational pressure before the investigation criteria are met. A shorter investigation that misses the scope leaves the platform vulnerable.

**EVIDENCE_QUARANTINE_FROM_OPERATORS:** Refusing to share with affected operators the corpus evidence that involves their sessions, on the grounds that it might interfere with the investigation. Operators have the right to review evidence that involves their sessions.

**RESPONSE_THROUGH_SILENCE:** Addressing a security incident through containment without communicating to affected operators. Operators have the right to know that their operations are being affected by a security response and why.
