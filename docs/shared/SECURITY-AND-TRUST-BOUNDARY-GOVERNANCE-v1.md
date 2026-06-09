# Security and Trust Boundary Governance
## Constitutional Security Boundaries Without Sacrificing Operational Explainability
### Version 1 — Phase L, Security, Trust Boundaries, and Operational Defensibility Era

---

## 1. Governing Principle

Security exists to protect the trustworthiness of the operational system. It does not exist to protect the system from operators. Security controls that prevent operators from understanding what is happening — controls that block, mutate, or hide without explanation — are themselves a form of operational failure.

The governing principle is:

> **Security state must be operationally visible. Every security decision that affects an operator's ability to act must be explainable, attributable, and verifiable by the operator it affects.**

This creates a tension with some conventional security design, which relies on opacity as a control. In a replay-governed deterministic platform, that tension is resolved in favor of explainability. We do not trade operational truth for security theater.

The platform defends itself through transparency of truth, not concealment of state. An attacker who can observe that the system has detected their action and is isolating them has still lost. An operator who cannot tell whether the system is functioning correctly or has been silently altered is operationally blind regardless of how "secure" the silent control was.

---

## 2. Trust Boundary Taxonomy

### 2.1 What a Trust Boundary Is

A trust boundary is a declared interface between two components, roles, or domains at which:
- Authority claims are verified (not assumed)
- Identity is confirmed (not carried over implicitly)
- State mutations are governed (not freely shared)

Trust boundaries are not firewalls. They are governance checkpoints. When data or authority crosses a trust boundary, the crossing is:
- Logged in the corpus
- Authorized by the governing rule for that boundary
- Verifiable by replay

### 2.2 Trust Boundary Tiers

**TIER 1 — External/Internal Boundary:**
The boundary between the external world (content providers, external operators, public network) and the internal governance kernel. All ingress crosses this boundary. Everything entering must be validated before it influences internal state.

**TIER 2 — Inter-Service Boundary:**
The boundary between internal services (e.g., API surface to governance kernel, governance kernel to corpus). Services within this tier are trusted but not unconditionally — each crossing is authenticated and authorized.

**TIER 3 — Operator/System Boundary:**
The boundary between operator actions and system state. Operators interact with the system through declared surfaces; they cannot directly mutate internal state.

**TIER 4 — Replay/Live Boundary:**
The boundary between the immutable corpus (the operational record) and the mutable live operational state. The corpus cannot be modified through live operational channels. All live operations may add to the corpus but never subtract from it.

**TIER 5 — Cross-Region Boundary:**
The boundary between regional deployments. Authority claims do not cross this boundary without explicit governance (see MULTI-REGION-OPERATIONAL-CONSISTENCY-v1.md §2).

### 2.3 Boundary Visibility

Every trust boundary is declared in the system's configuration and is observable by operators:
- Each boundary's current state (nominal, degraded, in alarm)
- The governance rules applied at each boundary
- Recent crossings that required elevated verification
- Any boundary breaches (see §14)

---

## 3. Operator and Session Authority Boundaries

### 3.1 Session Authority Scope

An operator session has a declared authority scope at the time it is established:
- Tier level (1–4)
- Venue scope (which venues this session may affect)
- Time scope (when this session expires)
- Action class permissions (which action categories are available)

The authority scope is a corpus record. It is committed when the session is established and is not mutable during the session. If the authority needs to change, the session is re-established with the new scope — it is not silently adjusted.

### 3.2 Authority Escalation Governance

Authority escalation — the temporary granting of higher-than-normal authority — is:
- Explicitly requested with declared basis
- Approved by a Tier 3 or above operator in the chain of command
- Time-limited (expiry is required; it is not optional)
- Corpus-recorded at grant and expiry
- Operator-visible: the escalated operator sees their current authority clearly displayed

Authority escalation is never self-granted. An operator cannot elevate their own authority regardless of technical access to do so. Self-escalation is a security incident (see §14).

### 3.3 Session Boundary Enforcement

At every trust boundary crossing initiated by an operator session:
- The session token is verified (not assumed valid because it was valid 30 seconds ago)
- The session's authority scope is checked against the requested action
- If the session is not authorized, the action is rejected with a visible, explicit reason
- The rejection is logged in the corpus

Rejection messages tell operators what authority they need, not just that they were rejected. "This action requires Tier 3 authority for schedule modification" is the correct rejection message. "Access denied" is not.

### 3.4 Session Termination

Sessions terminate when:
- The declared time scope expires
- The operator explicitly ends the session
- A security event triggers mandatory session invalidation (see §14)
- The operator's certification becomes invalid (expired, suspended)

Session termination is visible to the operator. They are not silently logged out; they receive a clear termination notification with the reason.

---

## 4. PRE Trust Boundary Enforcement

### 4.1 PRE as a Security Boundary

The PRE (Platform Replay Engine) maintains the platform's deterministic operational truth. It is a trust boundary in itself: only events that have passed governance validation may influence PRE execution. An event that bypasses the governance validation layer and directly affects PRE state represents a category of breach that destroys replay integrity.

### 4.2 PRE Input Validation

All inputs to PRE are validated at the Tier 1 (External/Internal) and Tier 2 (Inter-Service) boundaries before they reach PRE:
- Event schema validation: the event conforms to the declared schema
- Authority validation: the actor submitting the event has authority for the event type
- Sequence validation: the event is in the correct sequence (no replayed old events, no out-of-order events)
- Integrity validation: the event has not been modified in transit (hash verification)

An event that fails any validation is rejected at the boundary. It does not reach PRE. The rejection is logged with the full event content and the specific validation that failed.

### 4.3 PRE Execution Isolation

PRE execution is isolated from direct modification by external or operator influence:
- PRE's execution state cannot be directly queried or modified through the API surface
- PRE's output is the authoritative governance decision; it cannot be overridden by post-hoc mutation
- Any deviation between PRE's output and the system's behavior is a governance breach

### 4.4 PRE Boundary Breach Indicators

A PRE trust boundary breach is indicated by:
- A system state that diverges from what PRE's corpus-backed execution would produce
- An event appearing in the operational state that is not in the corpus
- PRE execution producing output inconsistent with prior executions of identical inputs (determinism failure)

All three indicators trigger CORPUS_INTEGRITY_ALERT, the highest-severity security-related operational alert.

---

## 5. Replay Integrity Boundaries

### 5.1 The Replay Corpus as Security Infrastructure

The replay corpus is not only an operational record — it is the primary security infrastructure. Because the corpus is hash-chained and append-only, it provides:
- Tamper evidence: any modification of a committed record breaks the chain
- Attribution: every event is attributed to an actor and session
- Completeness: gaps in the chain are detectable
- Verifiability: any claim about what happened can be checked against the corpus

The security value of the corpus depends entirely on its integrity. Compromising the corpus is the highest-impact attack against the platform.

### 5.2 Corpus Write Controls

Corpus writes are constrained to the declared ingestion pipeline:
- Only the governance kernel may write to the corpus
- No external service, no operator, no administrative interface has direct write access to corpus records
- The ingestion pipeline authenticates the governance kernel before accepting each write
- Writes are acknowledged and hash-chain-verified before the write is considered complete

### 5.3 Corpus Read Controls

Corpus reads are unrestricted within declared session authority:
- Any operator with valid session authority may read corpus records within their venue scope
- Forensic investigation authority extends read access to cross-venue and cross-region records
- There is no "secret" corpus segment that is inaccessible to appropriate authority
- Read-only access does not create a security risk; the corpus is designed to be examined

### 5.4 Corpus Integrity Monitoring

Continuous corpus integrity monitoring runs:
- Hash chain verification for the most recent N packets at every ingestion
- Periodic full-chain audit (daily)
- Cross-region chain consistency check (hourly for each PRIMARY/SECONDARY pair)

Any chain break triggers immediate halt of corpus writes pending investigation. Corpus reads continue: operators need to understand the current state even while an integrity investigation is underway.

---

## 6. Infrastructure Trust Separation

### 6.1 Infrastructure as an Untrusted Layer

Infrastructure (compute, network, storage, external services) is treated as untrusted by default. This is not an assessment of the infrastructure provider's intentions — it is an architectural assumption that infrastructure may be compromised, misconfigured, or behaving unexpectedly.

Every infrastructure component's output is validated before it is used to make governance decisions:
- Database query results are validated for schema conformance
- Network messages are validated for integrity (hash verification)
- External API responses are validated for schema and authenticated for source

### 6.2 Infrastructure Compromise vs. Application Integrity

Infrastructure compromise (a database server is breached) and application integrity (the governance kernel is correct) are separately governed:
- Infrastructure compromise can expose data but cannot, by design, alter the corpus record without breaking the hash chain
- Application integrity compromise is a higher-severity event that affects governance decisions

The separation means operators can understand the blast radius of an infrastructure compromise: it may expose historical data but it does not corrupt governance state.

### 6.3 Infrastructure Security Observability

Infrastructure security state is visible on all operational surfaces (see INFRASTRUCTURE-OBSERVABILITY-AND-RUNTIME-TRUST-v1.md §2). A security-relevant infrastructure state change — a database authentication failure, an unexpected network connection, a certificate error — is surfaced as an infrastructure event in the operational record.

---

## 7. Credential Handling Governance

### 7.1 Credential Classification

Credentials are classified by their operational impact:

**OPERATOR_CREDENTIAL:** Used to authenticate a human operator to a session. Compromise affects the actions attributable to that operator.

**SERVICE_CREDENTIAL:** Used to authenticate an internal service. Compromise affects the authority that service can exercise at trust boundaries.

**INGESTION_CREDENTIAL:** Used to authenticate corpus writes. Compromise could allow unauthorized corpus writes (but cannot alter existing records due to hash chain protection).

**EXTERNAL_CREDENTIAL:** Used to authenticate to external dependencies (content providers, external auth services). Compromise affects the system's ability to receive authoritative content.

### 7.2 Credential Lifecycle Governance

Each credential class has a declared lifecycle:
- **Maximum validity period:** Credentials expire; they are not valid indefinitely
- **Rotation cadence:** Credentials are rotated before expiry, not only after compromise
- **Compromise response:** Specific rotation procedure for each credential class on suspected compromise
- **Revocation propagation:** When a credential is revoked, revocation propagates to all boundary enforcement points within a declared time window

Credential rotation is a corpus event: the rotation is logged with the reason (scheduled rotation vs. compromise response) and the credential class.

### 7.3 Credential Storage Rules

Credentials are never:
- Stored in the corpus (the corpus contains credential IDs and events, not credential values)
- Logged in operational logs in plaintext
- Transmitted in clear text across any trust boundary
- Accessible through the operator API surface

Credential values are stored in a separate credential store with access controls that are independent of the governance kernel. The credential store's integrity is monitored but its contents are not visible to operational surfaces.

---

## 8. Cross-Region Trust Constraints

### 8.1 No Implicit Regional Trust

A region that is part of the same deployment does not automatically trust messages from another region. Regional boundaries are trust boundaries. A message claiming to come from the PRIMARY region is authenticated before it is acted on.

This prevents an attacker who has compromised a SECONDARY region from escalating by claiming PRIMARY authority.

### 8.2 Regional Authentication

Cross-region communications are authenticated via:
- Mutual TLS at the network layer (both sides present certificates)
- Application-layer message signing (each message includes a signature verifiable by the receiving region)
- Session token verification for operator sessions that cross regional boundaries

A cross-region message that fails any authentication layer is rejected at the trust boundary. The rejection is logged in both regions' corpus.

### 8.3 Regional Trust Degradation

If a region produces authenticated messages with content that is inconsistent with the established corpus record (events that should not exist, authority claims that were not granted), the receiving region enters REGIONAL_TRUST_DEGRADED state for the sending region:
- Further messages from the degraded region are accepted but flagged TRUST_DEGRADED
- TRUST_DEGRADED messages require Tier 3 review before they affect governance decisions
- The receiving region notifies the incident authority of the trust degradation

Regional trust is not restored automatically. It requires investigation of the inconsistency and explicit Tier 3 restoration.

---

## 9. Security State Must Be Operationally Visible

### 9.1 The Visibility Requirement

Every security state that affects an operator's ability to act must be visible to that operator. This includes:
- Current session trust state
- Any trust boundary in ALARM or DEGRADED state
- Any security-related restrictions on current operations
- Any pending security events that have not been resolved
- The current status of credentials this session depends on

### 9.2 Security State Display

Security state is displayed as part of the operational console's persistent status layer:
- Session trust: VERIFIED / DEGRADED / EXPIRING
- Boundary status: NOMINAL / [N] boundaries in non-nominal state
- Active restrictions: list of any operations restricted for security reasons
- Security events: count of open security events affecting this operator's scope

Security state is not an additional screen the operator navigates to. It is present in the operational surface alongside the operational state.

### 9.3 Security Restrictions Are Explained

When a security restriction prevents an operator from taking an action:
- The restriction is displayed with its reason
- The reason is in operational terms: "this action is restricted because the session trust is DEGRADED following a credential rotation"
- The operator is given the path to resolution: "restore session trust by re-authenticating"

Unexplained security restrictions destroy operator trust in the system. An operator who cannot understand why they cannot do something cannot determine whether the restriction is appropriate or whether the system is malfunctioning. Explanation preserves both trust and safety.

---

## 10. Security Event Causality Requirements

### 10.1 Security Events Are Corpus Events

Security events — authentication failures, trust boundary breaches, credential rotations, session invalidations, authority escalations — are committed to the corpus as first-class events. They are not stored in a separate security log that is inaccessible to operational replay.

This is essential for forensic investigation: understanding an operational incident often requires understanding the security events that preceded or accompanied it. A corpus that shows what happened operationally but not the security context in which it happened is an incomplete record.

### 10.2 Security Event Causality

Each security event in the corpus must include:
- The detected condition that triggered it
- The actor or system that detected it
- The immediate operational consequence (what was restricted, rotated, or invalidated)
- The causal chain (what sequence of events led to this detection)

A security event that says only "authentication failure detected" without identifying the session, the boundary, the failure type, and the triggering pattern is insufficient for operational understanding.

### 10.3 Security Event Correlation

Security events are cross-referenced with concurrent operational events:
- An authentication failure that occurs immediately before an unusual operational action is a correlation that should be surfaced, not discovered accidentally
- A pattern of authentication failures across multiple operators may indicate a credential compromise or an infrastructure authentication failure

Security event correlation is part of the operational forensics capability. The corpus holds both kinds of events; the forensics infrastructure can query across them.

---

## 11. Human-Verifiable Trust Transitions

### 11.1 Trust Transitions Must Be Inspectable

When the system transitions from a higher to a lower trust state (or vice versa), the transition must be:
- Visible at the time it occurs
- Attributed to a specific cause
- Verifiable after the fact by examining the corpus record

A trust transition that the operator cannot see, understand, or verify is a hidden state change. Hidden state changes are what the platform is designed to prevent.

### 11.2 Trust Transition Types

**Automatic trust downgrade:** The system detects a condition that warrants lowering trust (credential expiry, authentication anomaly, boundary breach detection). The downgrade is immediate and visible. The operator can see exactly why the downgrade occurred.

**Operator-initiated trust change:** An operator explicitly changes a trust state (e.g., declares a session as compromised, initiates credential rotation). The operator's action is the corpus record.

**System-restored trust:** After a security event is resolved, the system may return to a higher trust state. Restoration requires positive confirmation, not just the absence of further alarms.

**Human-confirmed trust restoration:** Some trust restorations require explicit human confirmation (Tier 3 sign-off). The restoration is not automatic — it waits for the confirmation. This prevents a brief window of normal behavior from being sufficient to restore trust after a significant security event.

---

## 12. Temporary Trust Degradation States

When a security event does not yet warrant full containment but warrants elevated caution, the system enters temporary trust degradation:

### 12.1 Degradation States

**ELEVATED_SCRUTINY:**
Operations proceed normally. All actions in the degraded scope are logged with elevated detail. Certain sensitive actions require an additional confirmation step. Duration: declared at trigger, default 1 hour.

**RESTRICTED_OPERATION:**
Non-essential operations are restricted. Essential operations proceed with acknowledgment. Duration: declared at trigger; extends until root cause is identified and cleared.

**MINIMAL_OPERATION:**
Only critical operational actions are permitted. All non-critical operations are suspended. Duration: until root cause investigation concludes.

**ISOLATED:**
The affected scope (session, venue, region) is isolated from the rest of the platform. It can receive information but cannot send state-affecting commands. Duration: until explicit restoration by Tier 3 authority.

### 12.2 Degradation State Visibility

Every degradation state is:
- Displayed to the operator in the affected scope
- Recorded in the corpus with the triggering event
- Communicated to the incident authority
- Reviewed at declared intervals (degradation states do not persist indefinitely without review)

### 12.3 Degradation Expiry

Degradation states have declared maximum durations. If the root cause has not been resolved within the maximum duration, the degradation is escalated to the next severity level. Degradation states do not silently expire into normal operation.

---

## 13. Explicit Distrust States

When confidence in a component, session, or region is sufficiently low that its actions cannot be trusted, the system enters an explicit distrust state for that element.

### 13.1 Distrust Declaration

Distrust is declared by a Tier 3 operator or above, with:
- The specific element being distrusted (session ID, venue ID, region ID)
- The basis for distrust (observed behavior, security event, investigation finding)
- The operational implication (what cannot be accepted from the distrusted element)
- The restoration path (what must happen for trust to be restored)

Distrust cannot be self-declared (an element cannot distrust itself). It cannot be declared anonymously. The declaring authority is part of the corpus record.

### 13.2 Operating Under Distrust

When an element is in explicit distrust state:
- Its actions are received but not executed
- Its actions are logged in full for forensic review
- It is notified of its distrust state
- The restoration path is communicated to the distrusted element

Distrust is not silent. An operator whose session is in distrust state is told. A venue in distrust state is informed. The subject of distrust is not kept in the dark while their actions are silently ignored.

---

## 14. Boundary Breach Containment

### 14.1 Breach Detection

A boundary breach is detected when:
- An event crosses a trust boundary without satisfying the boundary's authentication requirements
- An event crosses a trust boundary with valid authentication but exceeds the scope of the authenticated authority
- An event appears in the corpus that could not have originated from any authorized actor at any authorized boundary crossing

### 14.2 Breach Containment Response

Containment is the immediate response to a detected breach. It has two goals:
1. Prevent the breach from propagating further
2. Preserve the evidence necessary to understand what happened

Containment steps (in order):
1. **Isolate the affected boundary crossing.** The specific trust boundary that was breached is placed in BREACH_HOLD: no further crossings until the breach is assessed.
2. **Preserve the evidence.** The event that triggered the breach detection, the surrounding corpus context, and the boundary state at the time are all captured immediately.
3. **Notify incident authority.** The Tier 3 incident authority is notified within 5 minutes.
4. **Assess blast radius.** Determine what state the breaching event may have affected.
5. **Quarantine affected state.** Any state that may have been affected by the breach enters TRUST_DEGRADED status.

### 14.3 Containment Without Disruption

Where possible, containment is scoped to the minimal affected surface. A breach at a specific venue's trust boundary does not immediately suspend all venue operations — it suspends the specific crossing type that was breached, notifies the incident authority, and continues investigating.

Wholesale operational shutdown in response to a boundary breach is the last resort, not the first response. The goal is to contain without destroying operational continuity.

---

## 15. Security Replay Integration

### 15.1 Security in the Replay Record

Security events are replay-able in the same way operational events are. This means:
- The sequence of security events leading to an incident can be reconstructed
- The exact trust state at any moment can be determined by replaying the corpus
- The causal relationship between security events and operational events is visible

A forensic investigation of a security incident uses the same replay infrastructure as a forensic investigation of an operational incident. The corpus is the unified record.

### 15.2 Security Event Replay Guarantees

Security events in the corpus carry the same guarantees as operational events:
- Hash-chain integrity: security events cannot be retroactively altered
- Completeness: every security-relevant event that the governance kernel observed is in the corpus
- Attribution: every security event identifies the detecting component or actor

### 15.3 Security Replay Privacy Constraints

Some security events contain sensitive information (credential IDs, session tokens). This information is handled per the privacy governance in PRIVACY-TRANSPARENCY-AND-OPERATIONAL-ETHICS-v1.md:
- Credential values are never in the corpus; credential event records contain only credential IDs
- Session token values are never in the corpus; session records contain only session IDs
- IP addresses and other identifying network information are retained for forensic purposes and subject to the declared retention governance

---

## 16. Deterministic Auditability Requirements

### 16.1 What Deterministic Auditability Means

Deterministic auditability means that every security-relevant decision is auditable by examining the corpus record and producing the same conclusion on each examination.

If a security decision cannot be reproduced by examining the corpus, that decision lacks auditability. Decisions that depend on ephemeral state (in-memory conditions at the time of the decision that are not recorded) or probabilistic factors (ML model outputs that change between examinations) fail the deterministic auditability requirement.

### 16.2 Auditability Requirements for Security Controls

Every security control must document:
- The triggering condition (what observable state causes the control to activate)
- The decision logic (how the system determines what action to take)
- The evidence (what corpus record exists to verify the decision was correctly made)

Security controls that cannot meet all three requirements must be redesigned. Probabilistic, opaque, or non-reproducible security controls are not permitted.

### 16.3 External Audit Support

The platform must support external security audit by providing:
- Complete corpus access for the audit period (with appropriate access controls for sensitive content)
- Replay capability for the audit period (an auditor can re-execute the corpus and verify governance decisions)
- Security event correlation views (what security events occurred and when, relative to operational events)

An external auditor should be able to independently verify the security posture of the platform by examining the corpus, without relying on the platform team's assertions.

---

## 17. Named Trust-Boundary Failure Modes

| ID | Name | Description |
|---|---|---|
| TB-001 | UNAUTHENTICATED_CROSSING | An event crosses a trust boundary without the required authentication; the boundary enforcement failed to reject it |
| TB-002 | AUTHORITY_OVERFLOW | An authenticated actor executes an action beyond their declared authority scope; the scope check failed |
| TB-003 | SELF_ESCALATION | An operator or service grants itself elevated authority without external authorization |
| TB-004 | CREDENTIAL_REUSE | A credential that has been revoked or has expired is successfully used; the revocation propagation failed |
| TB-005 | REPLAY_ATTACK | An old, valid message is replayed to a trust boundary; the sequence validation failed to detect the replay |
| TB-006 | BOUNDARY_BYPASS | An event affects governance state through a path that does not pass through the declared trust boundary |
| TB-007 | IMPLICIT_REGIONAL_TRUST | A region accepts authority claims from another region without explicit authentication; regional trust boundary not enforced |
| TB-008 | CORPUS_DIRECT_WRITE | State is written to the corpus through a path that bypasses the governance kernel |
| TB-009 | SILENT_BOUNDARY_ALARM | A trust boundary enters alarm state but the alarm is not surfaced to operators |
| TB-010 | TRUST_RESTORATION_WITHOUT_EVIDENCE | A trust state is restored to nominal before the root cause of the degradation has been confirmed resolved |

---

## 18. Forbidden Hidden-Security Behaviors

The following are unconditionally prohibited:

1. **Silent blocking.** If a security control blocks an operator action, the operator is told. The reason is explained. "Access denied" without explanation is not a valid security response.

2. **Auto-remediation that modifies governance state.** Security controls may restrict and isolate. They may not automatically alter operational configuration, schedule content, or governance decisions.

3. **Hidden trust state.** The trust state of every component that the operator depends on is visible. There is no concealed trust evaluation running in the background.

4. **Opaque security decisions.** Every security decision is attributable to a specific rule, a specific detected condition, and a specific actor or system.

5. **Silent credential rotation during active sessions.** Credential rotation that invalidates active sessions notifies those sessions before or at the moment of invalidation.

6. **Security event quarantine from the corpus.** Security events are in the same corpus as operational events. There is no separate, inaccessible security log.

7. **Deception as defense.** Honeypots, false signals, and misleading responses are not used in ways that make it impossible for legitimate operators to distinguish them from genuine system behavior.

---

## 19. Replay-Preserving Security Rules

Security controls must preserve replay integrity. The following rules govern security implementations to ensure they do not damage replay capability:

1. **Security events are corpus events.** Every security event is recorded in the corpus before the event's operational consequences take effect.

2. **Containment does not erase.** Security containment may restrict what new events are accepted. It does not remove existing corpus records.

3. **Security decisions are deterministic.** Given the same corpus state, a security control must make the same decision. ML-based or probabilistic security controls that are non-reproducible may not gate governance decisions.

4. **Replay surfaces security context.** When replaying corpus events, the security context at the time of the events is included. An operator conducting replay analysis can see the trust state, boundary states, and active security events concurrent with the events being reviewed.

5. **Redaction follows governance.** If security requirements mandate redacting sensitive content from corpus records (per PRIVACY-TRANSPARENCY-AND-OPERATIONAL-ETHICS-v1.md §6), the redaction follows the declared governance process and is annotated in the corpus. Security requirements do not bypass redaction governance.
