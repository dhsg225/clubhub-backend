# Identity, Authority, and Operational Authenticity
## Governing Identity, Authority Delegation, and the Authenticity of Operational Action
### Version 1 — Phase L, Security, Trust Boundaries, and Operational Defensibility Era

---

## 1. Governing Principle

Every action in the operational system is attributable. Attribution is not a post-hoc forensic convenience — it is the foundation of operational accountability, replay integrity, and operator trust.

An operator who acts under an identity that is not verifiably their own creates an action record that cannot be trusted. An operator who acts under authority they do not hold creates governance state that cannot be verified. An operator who acts without confirmation that their identity claim has been authenticated creates events in the corpus that cannot be defended.

The governing principle is:

> **Every action must be attributable to a verified identity exercising verified authority. Attribution that cannot be verified is not attribution — it is assumption.**

This principle applies symmetrically: operators are protected by the attribution system as much as the system is protected by it. An operator whose session is correctly attributed cannot have actions falsely imputed to them. The corpus is the witness for both directions.

---

## 2. Identity Assurance Levels

Identity assurance levels declare how confident the system is in the binding between a claimed identity and the actual person or service making the claim.

### 2.1 Level Definitions

**IAL-0 — Unauthenticated:**
No identity claim has been made or verified. The actor is anonymous. Permitted operations: read-only access to public information only. No governance operations are permitted at IAL-0.

**IAL-1 — Credential-Based:**
The actor has presented a valid credential (username/password, API key). The identity is bound to the credential, not directly to a person. Appropriate for automated service accounts with limited authority.

**IAL-2 — MFA-Authenticated:**
The actor has presented a valid credential plus a second factor (TOTP, hardware key, biometric). The identity claim is substantially stronger. This is the minimum level for Tier 1 operator authority.

**IAL-3 — MFA-Authenticated with Session Continuity:**
IAL-2 plus continuous session verification (periodic re-validation that the session is still held by the original authenticator). Required for Tier 3 authority and above. Session continuity prevents session hijacking from operating undetected for extended periods.

**IAL-4 — Elevated Verification:**
IAL-3 plus an additional out-of-band confirmation from a second authority. Required for emergency access procedures, authority escalation beyond normal bounds, and security incident responses. This level cannot be achieved unilaterally.

### 2.2 IAL and Action Authority

| Certification Tier | Minimum IAL Required |
|---|---|
| Tier 0 (Observer) | IAL-1 |
| Tier 1 (Operational Basic) | IAL-2 |
| Tier 2 (Operational Standard) | IAL-2 |
| Tier 3 (Operational Expert) | IAL-3 |
| Tier 4 (Certification Examiner) | IAL-3 |
| Emergency Authority | IAL-4 |
| Security Incident Authority | IAL-4 |

IAL requirements are enforced at the trust boundary crossing, not just at session establishment. A Tier 3 session established at IAL-3 that drops to IAL-2 (e.g., session continuity verification fails) loses Tier 3 action authority until IAL-3 is re-established.

---

## 3. Session Authenticity Guarantees

### 3.1 Session Establishment

A session is established when an identity has been verified at the required IAL for the requested authority tier. Session establishment is a corpus event:
- Session ID (not the credential value)
- Identity pseudonym (see §12.1)
- IAL achieved
- Authority tier granted
- Venue scope
- Session expiry timestamp
- Establishing service and timestamp

The session establishment event is the authoritative record of what authority was granted and when.

### 3.2 Session Authenticity During Operation

Session authenticity is maintained throughout the session through:
- Periodic re-validation at the IAL required for the session's authority tier
- Validation that the session token has not been presented from an unexpected network location (location continuity, where available)
- Validation that session activity patterns are consistent with a single operator (not distributed across multiple simultaneous sessions)

### 3.3 Session Authenticity Signals

The session displays authenticity signals to the operator:
- Current IAL for this session
- Time of last re-validation
- Next required re-validation window
- Any authenticity anomalies detected (unexpected location, concurrent session detected)

Operators can see that their session is authentic. They are not left to assume it.

### 3.4 Session Token Security

Session tokens are:
- Cryptographically random with sufficient entropy
- Not reusable after session termination
- Not transmitted in URLs or query strings
- Validated at every trust boundary crossing

Session token compromise is a security incident. Any session whose token is suspected to have been exposed is invalidated immediately with notification to the session holder and the incident authority.

---

## 4. Authority Delegation Governance

### 4.1 What Authority Delegation Is

Authority delegation is the explicit granting of a subset of one operator's authority to another operator or service for a declared purpose and duration.

Delegation is not authority transfer (the delegating operator retains their authority). It is authority sharing under declared constraints.

### 4.2 Delegation Requirements

A valid delegation requires:
- The delegating operator has the authority they are delegating (you cannot delegate what you don't have)
- The delegation is for a specific declared purpose
- The delegation has a declared expiry (no indefinite delegations)
- The delegation is recorded in the corpus with all the above details
- The recipient of the delegation explicitly accepts it (delegations are not silently applied)

### 4.3 Delegation Scope Constraints

Delegated authority is scoped:
- Delegations may not grant authority beyond what the delegating operator holds
- Delegations may not include the right to re-delegate (sub-delegation requires the original authority holder's explicit approval)
- Delegations are scoped to venue(s) — a delegation for Venue A does not extend to Venue B unless explicitly declared

### 4.4 Delegation Visibility

Delegated authority is visible in all operational surfaces:
- An operator operating under delegated authority sees the delegation displayed on their console
- Other operators see that a delegation is active when they interact with operations in the delegated scope
- The corpus shows the full delegation chain for any action taken under delegated authority

### 4.5 Delegation Revocation

Delegations may be revoked before their expiry by:
- The delegating operator
- A Tier 3 operator in the authority chain
- Security incident response (automatic revocation of delegations held by a compromised session)

Revocation is immediate and corpus-recorded. The delegated operator is notified of the revocation at the moment it occurs.

---

## 5. Shared-Terminal Operation Rules

### 5.1 The Shared-Terminal Problem

In some venues, multiple operators share a physical terminal. A session established by one operator should not be usable by another without re-authentication. Shared-terminal operation without proper governance creates attribution ambiguity: when an action occurs at a shared terminal, who is responsible?

### 5.2 Shared-Terminal Governance

When a terminal is declared as shared-use:
- Each operator authenticates individually before their session is active
- The terminal maintains a session stack: the currently active session is the most recently authenticated
- When an operator leaves the terminal, they must explicitly lock or end their session
- The terminal automatically locks after a declared inactivity period
- An action at a locked terminal is rejected until a session is re-established

### 5.3 Session Locking

Locking a session preserves the session's state without terminating it:
- The session enters LOCKED state
- No actions may be taken in LOCKED state
- The session is unlocked by the authenticated operator re-presenting their credential
- The lock/unlock events are corpus records

Locking is not the same as session termination. A locked session remains attributed to its operator for the period it is locked.

### 5.4 Handoff at Shared Terminals

When a shift handover occurs at a shared terminal:
- The outgoing operator terminates their session (not just locks it)
- The incoming operator establishes a new session with their own credentials
- The terminal's session history shows the handoff clearly in the corpus
- Operational context (active incidents, pending operations) is communicated through declared handoff channels, not by transferring a session

---

## 6. Emergency Access Procedures

### 6.1 What Emergency Access Is

Emergency access is access granted under conditions where the normal authentication process cannot be completed due to operational urgency or infrastructure failure.

Emergency access is not a back door. It is a governed exception to normal authentication with elevated logging, strict time limits, and mandatory post-access review.

### 6.2 Emergency Access Authorization

Emergency access requires IAL-4 (see §2.1): the normal credential process plus an out-of-band confirmation from a second authority. This ensures that emergency access cannot be invoked unilaterally.

The second authority must be:
- A different person from the requestor
- Available via a declared emergency communication channel
- At Tier 3 or above

### 6.3 Emergency Access Scope

Emergency access grants are scoped to the minimum authority required:
- The specific actions needed are declared before access is granted
- Access is time-limited to the expected duration of the emergency (default: 30 minutes, extendable by re-authorization in 30-minute increments)
- Access is venue-scoped: emergency access to Venue A does not extend to Venue B

### 6.4 Emergency Access Record

Every emergency access event produces a detailed corpus record:
- Requestor identity
- Authorizing second authority
- Stated emergency basis
- Specific authority granted
- Actual actions taken during the emergency access window
- Duration
- Closing attestation from the requestor

Emergency access events are reviewed within 24 hours by the Certification Authority to confirm the access was used appropriately.

---

## 7. Identity Degradation Handling

### 7.1 What Identity Degradation Is

Identity degradation occurs when the system's confidence in the binding between a session and its claimed identity decreases during an active session. This is distinct from authentication failure at session establishment — it is the deterioration of confidence during an already-authenticated session.

### 7.2 Degradation Triggers

**Session continuity failure:** The IAL-3 session continuity check fails (the periodic re-validation does not succeed).

**Concurrent session detection:** The same session token is presented from two different network locations simultaneously.

**Anomalous action pattern:** Actions in the session exhibit a pattern inconsistent with the declared operator's known behavior profile (e.g., Tier 1 operator session performing actions at the pace of an automated tool).

**Credential state change:** The credential associated with the session has been rotated or revoked since the session was established.

### 7.3 Degradation Response

Identity degradation triggers:
1. The session's authority is downgraded to the level supportable by the current IAL
2. The operator is notified of the degradation and its reason
3. The operator is given the re-authentication path
4. Actions taken during the degradation window are flagged IDENTITY_DEGRADED in the corpus
5. A security alert is generated for the incident authority

Identity degradation does not immediately terminate the session. It restricts it. This preserves operational continuity while the operator re-establishes their identity claim.

---

## 8. Credential Compromise Containment

### 8.1 Compromise Indicators

A credential is considered potentially compromised when:
- The credential is presented from an unexpected geographic location
- The credential is used during hours inconsistent with the operator's declared operational schedule
- The credential is used at an access rate inconsistent with human operation
- A security incident investigation identifies the credential as potentially exposed

### 8.2 Containment Protocol

Upon credential compromise indicator:
1. The credential is immediately placed in SCRUTINY state: all uses are logged at maximum detail
2. The credential owner is notified through a secondary channel (not through the platform, which may be compromised)
3. The incident authority is notified
4. If compromise is confirmed, the credential is REVOKED and rotation is initiated
5. All sessions using the revoked credential are terminated and their holders notified

### 8.3 Revocation Propagation

Credential revocation must propagate to all trust boundaries within 60 seconds. Any trust boundary that has not received the revocation is placed in SCRUTINY state until revocation propagation is confirmed.

Revocation propagation is verified and logged. A credential that has been revoked but whose revocation has not propagated to a boundary is a security gap.

### 8.4 Post-Compromise Corpus Review

After a credential compromise is confirmed, the corpus is reviewed for all actions taken during the period the credential was potentially compromised:
- Actions are reviewed for whether they were consistent with the authorized operator's normal scope
- Suspicious actions are escalated for investigation
- The review period begins at the earliest possible exposure time, not at the compromise confirmation time

---

## 9. Action Attribution Guarantees

### 9.1 The Attribution Guarantee

Every action recorded in the corpus is attributed to a specific session, and through the session to a specific identity claim, and through the identity claim to a verified credential at a declared IAL.

This attribution chain is unbroken. There is no action in the corpus that cannot be traced back to an authentication event.

### 9.2 Attribution Chain Structure

For each corpus event:
```
EVENT
  → Session ID
      → Session Establishment Record
          → IAL achieved
          → Identity pseudonym
          → Credential ID (not credential value)
              → Credential class
              → Credential registration record
                  → Operator certification tier
                  → Operator organization
```

The chain is traversable from any event backward to the original identity claim.

### 9.3 Attribution Immutability

Attribution cannot be retroactively altered. Once an event is in the corpus with its session attribution, that attribution is permanent. A credential rotation, session termination, or operator suspension does not alter the attribution of events that occurred before the change.

This protects both the organization (actions cannot be falsely re-attributed away from their source) and the operator (correct attribution cannot be silently re-assigned to them for actions they did not take).

---

## 10. "Uncertain Identity" Operational States

### 10.1 When Identity is Uncertain

Identity is uncertain when the system cannot confirm the binding between a session and its claimed identity at the IAL required for the action being attempted. This is a first-class operational state.

**IDENTITY_UNCONFIRMED:** Session exists and credential was valid at session establishment, but current IAL cannot be confirmed (e.g., re-validation is overdue).

**IDENTITY_DISPUTED:** Concurrent session detection or other anomaly suggests the session may be in use by more than one actor.

**IDENTITY_DEGRADED:** The IAL has dropped below the minimum required for the session's authority tier.

**IDENTITY_UNKNOWN:** The system's identity verification infrastructure is itself unavailable and cannot confirm any identity claims.

### 10.2 Operating Under Uncertain Identity

Under each uncertain identity state, operations are restricted to the authority level that can be safely exercised given the uncertainty:

- IDENTITY_UNCONFIRMED: read-only until re-validation completes
- IDENTITY_DISPUTED: session immediately restricted to IAL-1 equivalent; disputed session alert generated
- IDENTITY_DEGRADED: authority reduced to the tier supportable by the current IAL
- IDENTITY_UNKNOWN: only locally-verifiable actions permitted; remote authority verification required for governance decisions

### 10.3 Uncertain Identity in the Corpus

Actions taken under uncertain identity states are marked with the identity state at the time:
- They are not silently attributed as if identity were confirmed
- Post-incident review can identify all actions taken under uncertain identity and assess their appropriateness

---

## 11. Operator Authenticity Visibility

### 11.1 What Operators Need to See

An operator needs to know:
- That their session is authentic (they are who they authenticated as)
- That the system they are interacting with is the genuine system (not a compromised or replacement endpoint)
- That their actions are being correctly attributed to them

### 11.2 Operator-Facing Authenticity Indicators

On every operational surface:
- **Session IAL indicator:** Current identity assurance level, updated in real time
- **Re-validation status:** "Next re-validation in: [N minutes]" for IAL-3 sessions
- **Session integrity indicator:** Confirms no concurrent session detection, no credential state changes
- **Endpoint verification:** The console displays the verified endpoint identity (TLS certificate subject, service signing key fingerprint) so operators can confirm they are on the genuine system

### 11.3 What to Do When Authenticity Is Uncertain

The console provides clear guidance when authenticity indicators show uncertainty:
- What is uncertain
- What to do to resolve it (re-authenticate, close concurrent sessions, contact security)
- What operations can safely proceed during the uncertainty

Operators are partners in maintaining their own session security. Authenticity indicators are designed to be understood and acted on, not ignored.

---

## 12. Replay Identity Reconstruction

### 12.1 Identity in Replay

When a corpus replay is used for forensic analysis, the identity context at the time of each event must be reconstructable. This means the forensic analyst can answer: who was authenticated to what session at what IAL when this action was taken?

### 12.2 Pseudonymization in Replay

For privacy preservation (see PRIVACY-TRANSPARENCY-AND-OPERATIONAL-ETHICS-v1.md §3), operator identities in the corpus are stored as pseudonyms, not as real names. Pseudonym-to-identity mapping is held in the credential store with access controls separate from the corpus.

Forensic replay shows the pseudonym. Resolution to a real identity requires:
- Forensic investigation authority
- Documented investigation basis
- Logged access to the pseudonym-to-identity mapping

### 12.3 Identity Reconstruction in Distributed Replay

In multi-region forensics, sessions that crossed regional boundaries carry the session establishment record from each region. Identity reconstruction across regions uses the cross-region trust record established at the session's trust boundary crossing.

---

## 13. Delegated Authority Expiration

### 13.1 Expiration is Mandatory

Every delegation has a declared expiry. There is no such thing as an indefinite delegation. If an operation requires authority that was needed once, it gets a time-limited delegation. If an operation recurrently needs delegated authority, it gets a recurrently-renewed delegation, not an indefinite one.

### 13.2 Expiration Behavior

When a delegation expires:
- Actions that require the delegated authority are immediately restricted
- The session holding the delegation is notified
- The delegation expiry is a corpus event
- Renewal requires a new delegation with a new explicit grant

Expiration is not the same as revocation. Expiration is the expected end of a time-limited grant. Revocation is the early termination of a grant due to changed circumstances.

### 13.3 Expiration Warning

Delegations approaching expiration surface a warning:
- 15 minutes before expiry: advisory notification
- 5 minutes before expiry: active warning
- At expiry: authority restricted, notification sent

Operators are not surprised by delegation expiry. They have the opportunity to renew before expiry if the need persists.

---

## 14. Multi-Operator Authenticity Coordination

### 14.1 When Multiple Operators Are Co-Present

In multi-operator scenarios (certification examinations, major incident response, shared venue operations), operators interact with the same operational scope. Authenticity coordination ensures that each operator's actions are attributed to them individually, not conflated.

### 14.2 Coordination Requirements

- Each operator has their own active session. There is no "shared session" that multiple operators can authenticate into.
- Operators in the same venue scope are visible to each other: the operational surface shows which operators are currently active in the scope.
- An action taken by one operator does not require acknowledgment from another, but cross-operator visibility means each operator can see what others have done.

### 14.3 Coordinator Authority

In multi-operator scenarios with a declared coordinator (incident commander, certification examiner), the coordinator's authority does not absorb the other operators' sessions. The coordinator can direct actions; they cannot take actions in another operator's name.

If a coordinator needs to take an action that is within another operator's authority but that operator is unavailable, the coordinator may request authority delegation from that operator (or invoke emergency procedures if the operator is genuinely unreachable).

---

## 15. Human Confirmation Requirements

### 15.1 When Human Confirmation Is Required

Certain actions require explicit human confirmation before execution, regardless of the operator's authority level. Human confirmation is not an additional permission layer — it is a deliberate friction mechanism for high-consequence actions.

**Actions requiring confirmation:**
- Any action that cannot be reversed within 5 minutes (permanent configuration changes, content deletion, corpus annotation)
- Any action at or above the operator's tier boundary (an action that the operator can take but that is at the edge of their authority)
- Any action taken during an active security incident
- Any authority escalation
- Any action taken under emergency access
- Any action that would affect 10 or more venues simultaneously

### 15.2 Confirmation Format

Human confirmation requires:
- Display of the specific action and its expected consequences
- Explicit acknowledgment (not a timeout-based auto-confirm)
- For highest-consequence actions: a second independent confirmation from a different session

The confirmation is a corpus event: the display content, the acknowledgment timestamp, and the confirming session are all recorded.

### 15.3 Confirmation Fatigue Prevention

Too many confirmation prompts produce confirmation fatigue — operators reflexively confirm without reading. Confirmation fatigue defeats the purpose of human confirmation.

Confirmation requirements are scoped precisely to high-consequence actions. Routine operations do not require confirmation. The confirmation prompt is not the default; it is the exception.

---

## 16. Operational Impersonation Prevention

### 16.1 What Impersonation Means Here

Operational impersonation is the use of one identity to exercise authority that should require a different identity. This includes:
- Using another operator's credentials to take actions in their name
- Using a service account credential for human operator operations
- Using a delegated authority beyond its declared scope
- Using a suspended operator's credentials

### 16.2 Prevention Architecture

**Credential binding:** Operator credentials are bound to the specific human or service they represent. Credentials issued to Operator A cannot be used to establish a session attributed to Operator B.

**Service-account separation:** Service accounts cannot be used to establish human operator sessions. The session establishment process distinguishes between human and service account authentication and applies different governance.

**Delegation scope enforcement:** Delegated authority is bound to a specific recipient session. The delegation cannot be sub-delegated and cannot be exercised from a different session.

**Suspension enforcement:** Suspended credentials produce rejected session establishment attempts. The suspension is logged regardless of whether the rejected party is the legitimate credential holder or an impersonator.

### 16.3 Impersonation Detection

Impersonation detection monitors for:
- Credential use patterns inconsistent with the associated operator's history
- Concurrent session attempts on the same credential from different locations
- Authority scope usage inconsistent with the credential's tier

Detected impersonation indicators trigger the same response as other identity degradation events: SCRUTINY state, notification, investigation.

---

## 17. Named Authenticity Failure Modes

| ID | Name | Description |
|---|---|---|
| AF-001 | SESSION_HIJACK | An active session token is used by an actor other than the one who established the session |
| AF-002 | CREDENTIAL_STUFFING | Valid credentials obtained from external breaches are used to establish sessions |
| AF-003 | DELEGATION_OVERFLOW | A delegated authority is used for actions beyond the declared delegation scope |
| AF-004 | GHOST_SESSION | A session that should have been terminated (due to inactivity, credential rotation) remains active |
| AF-005 | SHARED_SESSION_ABUSE | A session established for one purpose is used by multiple parties at a shared terminal without re-authentication |
| AF-006 | EMERGENCY_ACCESS_SCOPE_CREEP | Emergency access is used for actions beyond the declared emergency scope |
| AF-007 | ATTRIBUTION_GAP | An action occurs in a window where session attribution cannot be confirmed (e.g., during identity infrastructure degradation) |
| AF-008 | RE_AUTHENTICATION_BYPASS | The IAL-3 session continuity check is circumvented, allowing a session to persist at Tier 3 authority beyond the authenticated window |
| AF-009 | DELEGATION_CHAIN_ABUSE | Sub-delegation occurs without the original authority holder's approval |
| AF-010 | CONCURRENT_SESSION_ESCALATION | Multiple concurrent sessions for the same identity are used to appear to have different authority scopes simultaneously |

---

## 18. Unsafe Identity Recovery Patterns

The following identity recovery approaches are documented as unsafe and prohibited:

**PASSWORD_RESET_WITHOUT_VERIFICATION:** Resetting a credential without verifying that the requestor is the credential's legitimate owner. A password reset email to an address that may also be compromised is not sufficient for credentials at IAL-2 or above.

**SESSION_EXTENSION_UNDER_COMPROMISE:** Extending a session that has triggered compromise indicators rather than terminating and re-establishing it from a clean starting point.

**AUTHORITY_RECOVERY_VIA_SELF_ATTESTATION:** Restoring revoked authority based on the affected operator's own attestation that the compromise was not their fault. Recovery requires evidence, not assertion.

**RETROACTIVE_ATTRIBUTION_CHANGE:** Attempting to change the attribution of corpus events after the fact because the attributed session is suspected to have been compromised. Attribution is immutable; the investigation annotates the corpus records, it does not alter them.

**CREDENTIAL_SHARING_AS_WORKAROUND:** Sharing credentials to work around a revocation or suspension. If an operator's credentials are revoked and another operator shares theirs to allow operations to continue, both operators' sessions are now at risk and the attribution record is corrupted.

---

## 19. Constitutional Restrictions on Authority Escalation

The following authority escalation behaviors are unconditionally prohibited:

1. **Self-escalation.** An operator cannot grant themselves authority beyond their current certification tier. Even a Tier 4 operator who believes they need authority beyond their tier must obtain it through the declared escalation path.

2. **Escalation by consensus.** Multiple Tier 1 operators cannot collectively authorize an action that requires Tier 3. Authority is not additive — it is hierarchical.

3. **Escalation by emergency claim without evidence.** An operator cannot claim emergency access simply by asserting that an emergency exists. The emergency must be verifiable, and the second-authority confirmation (IAL-4) must be obtained.

4. **Time-unlimited escalation.** Authority escalations are time-limited. There is no open-ended escalation. If an emergency persists, the escalation is explicitly renewed, not assumed to remain valid indefinitely.

5. **Escalation inheritance.** Delegated authority does not carry escalation rights. If Operator A has emergency access and delegates some authority to Operator B, Operator B's delegation does not include the emergency access escalation.

6. **Escalation by inaction.** A Tier 3 operator who is not available cannot be considered to have "implicitly approved" an escalation by virtue of their unavailability. Unavailability triggers the authority-orphan escalation protocol, not silent escalation.
