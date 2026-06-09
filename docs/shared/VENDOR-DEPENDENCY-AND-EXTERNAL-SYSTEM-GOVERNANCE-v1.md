# Vendor Dependency and External System Governance
## Governing External Dependencies Without Surrendering Operational Sovereignty
### Version 1 — Phase M, Institutional Sovereignty and Commercial Pressure Resistance Era

---

## 1. Governing Principle

Every external dependency is a governed boundary, not a trusted extension of the platform. When a vendor's API changes, when a cloud provider's service degrades, when a SaaS platform alters its behavior, when an analytics provider modifies its data model — the platform must detect the change, contain its impact, and maintain its own operational truth independent of the external system's state.

The governing principle is:

> **The platform's operational truth is produced by the platform's governed kernel, using its own verified corpus. External systems may provide inputs. They do not provide truth. What external systems state becomes operational fact only when the governed kernel has verified and committed it.**

This principle applies to all external systems: cloud infrastructure, SaaS vendors, analytics platforms, content providers, authentication services, and monitoring tools. No external system has governance authority inside the platform. No external system's assertions replace the corpus record. No external system's failure causes the platform's operational truth to be uncertain.

---

## 2. External Dependency Trust Taxonomy

### 2.1 Trust Tiers for External Systems

**EXT-TIER-1 — Critical Infrastructure:**
Systems without which the platform cannot run at all in any region: compute infrastructure, block storage, network. These are infrastructure dependencies rather than service dependencies. Their failure mode is platform unavailability, not operational truth compromise. Governed through infrastructure resilience architecture.

**EXT-TIER-2 — Governed Service Dependencies:**
Systems that the platform actively calls and whose responses influence governance decisions. Examples: external authentication services, content delivery verification services, time authority services. These must be encapsulated with validation layers (see §6). Their responses are verified before use.

**EXT-TIER-3 — Data Input Dependencies:**
Systems that provide content, schedules, or metadata that the platform processes into governed state. Examples: content providers, CMS systems, schedule source systems. Their inputs pass through the platform's validation and governance before affecting operational state. Corrupted or unexpected inputs are rejected, not accepted.

**EXT-TIER-4 — Observability and Analytics Dependencies:**
Systems used to observe platform behavior: monitoring, logging, analytics platforms. Their failure does not affect operational truth (the corpus is the primary record). Their corruption can affect operational visibility but not operational state.

**EXT-TIER-5 — Non-Operational Dependencies:**
Systems used for business operations but not connected to governance: CRM, billing, communication platforms. Their failure does not affect operational state.

### 2.2 Trust Tier Implications

| Trust Tier | Failure Mode | Governance Response |
|---|---|---|
| EXT-TIER-1 | Platform unavailability | Infrastructure resilience; regional failover |
| EXT-TIER-2 | Governance decision quality | Validation layer; fallback behavior; circuit breaker |
| EXT-TIER-3 | Data integrity | Input validation; rejection of invalid inputs; corpus buffer |
| EXT-TIER-4 | Observability loss | Primary record (corpus) unaffected; acknowledge reduced visibility |
| EXT-TIER-5 | Business operations disruption | Outside operational governance scope |

---

## 3. Vendor Authority Boundaries

### 3.1 What Vendors May Not Do

Regardless of contract terms, service level agreements, or commercial relationship, external vendors may not:

- Write directly to the corpus
- Override governance kernel decisions
- Alter the platform's operational schedule without passing through the governed schedule input validation
- Receive copies of the corpus that are not subject to the platform's data governance
- Execute code in the platform's production environment that is not explicitly governed and version-controlled
- Provide "managed" governance functions that replace the platform's own governance kernel
- Access the operator identity and session management systems
- Define or alter the platform's SLA measurement methodology

### 3.2 What Vendors May Do

Within their declared trust tier:
- Provide service responses that the platform's validation layer accepts or rejects
- Provide infrastructure that the platform runs on (subject to infrastructure governance)
- Provide content and metadata that passes through the platform's input validation
- Provide observability data that supplements (but does not replace) the corpus record

### 3.3 Vendor Governance Contracts

Every EXT-TIER-2 or EXT-TIER-3 vendor relationship has a declared governance contract specifying:
- The API interface the platform depends on (version, schema, expected response types)
- The validation criteria the platform applies to the vendor's responses
- The fallback behavior if the vendor is unavailable or returns unexpected responses
- The blast radius if the vendor's responses are corrupt or malicious
- The review cadence for the dependency (annually at minimum)

---

## 4. Replay-Safe External Integration

### 4.1 The Replay Challenge for External Dependencies

The replay corpus records deterministic operational truth: given the same inputs, the governance kernel produces the same outputs. External dependencies introduce a challenge: if a governance decision depended on an external API response at time T, replaying that decision at time T+N requires either:
- The external API returns the same response (not guaranteed and often impossible)
- The response at time T was captured and stored in the corpus
- The decision is tested to be independent of the specific response value

### 4.2 External Response Capture

Every EXT-TIER-2 external API call whose response influences a governance decision is captured in the corpus at the time of the call:
- The request parameters
- The response received
- The validation result
- The governance decision made on the basis of the response

This capture means replay uses the captured response, not a new call to the external API. The governance decision is replayable even if the external API has changed.

### 4.3 External Response Validation Layer

External responses pass through a validation layer before reaching the governance kernel:
- Schema validation: the response conforms to the declared schema
- Value validation: the response values are within declared acceptable ranges
- Integrity validation: the response carries the expected authentication or signature

A response that fails validation is rejected. The governance kernel uses its fallback behavior (see §7). The rejected response and the validation failure are corpus events.

### 4.4 Isolation Requirement

External API calls are isolated from the governance kernel's core execution path:
- Calls are made by a dedicated integration layer, not by the governance kernel directly
- Responses are validated before they are passed to the governance kernel
- The integration layer cannot alter the corpus directly
- Timeouts and circuit breakers prevent external dependency failures from blocking governance execution

---

## 5. Dependency Replacement Survivability

### 5.1 The Replaceability Requirement

Every external dependency must be replaceable without altering the platform's constitutional properties. If replacing a vendor requires modifying the replay guarantee, the determinism guarantee, or the corpus structure, the dependency has become architectural rather than operational.

Architectural dependency on an external vendor is a sovereignty risk. The vendor can change terms, pricing, or behavior in ways the platform cannot resist, because replacement would require fundamental architectural change.

### 5.2 The Abstraction Boundary

Every external dependency is accessed through a declared abstraction boundary:
- The platform calls the abstraction interface, not the vendor's API directly
- The abstraction interface is implemented by a vendor-specific adapter
- Replacing the vendor requires writing a new adapter, not changing the platform's code
- The abstraction interface is documented independently of any vendor implementation

This is not a generic software engineering principle applied generically. It is a specific governance requirement for sovereign operation.

### 5.3 Replacement Readiness Assessment

Annually, each EXT-TIER-2 and EXT-TIER-3 dependency is assessed for replacement readiness:
- Does an abstraction boundary exist?
- Does an alternative vendor or self-hosted option exist?
- What is the estimated effort to replace this vendor?
- What is the operational impact during the replacement window?
- Has the abstraction been tested with an alternative implementation?

Dependencies that fail replacement readiness assessment are flagged as sovereignty risks and assigned remediation timelines.

---

## 6. Deterministic Encapsulation

### 6.1 What Deterministic Encapsulation Means

A non-deterministic external dependency — one whose responses may vary between calls with identical parameters — must be encapsulated so that its non-determinism does not propagate into the governance kernel's execution.

The governance kernel's execution must remain deterministic. An external dependency that introduces non-determinism is either:
- Captured (its response at the time of the governance decision is recorded) and replay uses the captured value
- Replaced with a deterministic alternative
- Excluded from the governance execution path (moved to a pre-computation or post-decision step)

### 6.2 Non-Determinism Sources in External Systems

External systems introduce non-determinism through:
- Current-time-based responses (responses that change based on wall clock)
- Random elements in responses (pagination tokens, request IDs)
- State-dependent responses (the response depends on the external system's current internal state)
- Environment-dependent responses (the response depends on the calling environment)

Each of these must be handled in the encapsulation layer:
- Current-time-based responses: the time value is captured at call time and recorded
- Random elements: captured at call time; not regenerated during replay
- State-dependent responses: the state at call time is recorded in the corpus
- Environment-dependent responses: environment parameters are normalized before calling

### 6.3 Encapsulation Verification

Before a new external dependency is approved for EXT-TIER-2 use, its deterministic encapsulation is verified:
- Call the dependency with identical parameters multiple times; capture all responses
- Verify that non-deterministic elements are correctly isolated in the encapsulation layer
- Verify that replay uses captured values, not re-calls to the dependency
- Run the determinism verification suite with the new dependency in place

---

## 7. Third-Party Drift Detection

### 7.1 What Vendor Drift Is

Vendor drift is the gradual change in external system behavior over time without formal notification. It is distinct from versioned API changes (which are announced) and from outages (which are visible). It is the silent mutation of behavior within a nominally stable interface.

Examples:
- Response latency increasing by 20% over 6 months without announced degradation
- Default behavior of an API parameter changing between API versions in an undocumented way
- Rate limiting thresholds changing without announcement
- Data formats gaining new fields that the platform's schema validation does not handle
- Authentication token validity periods changing

### 7.2 Drift Detection Protocol

EXT-TIER-2 and EXT-TIER-3 dependencies are monitored for drift through:
- **Response time monitoring:** Alerting when response time trend exceeds a declared threshold over a rolling window
- **Schema monitoring:** Alerting when responses contain fields or types not present in the declared schema
- **Behavioral monitoring:** Automated tests that verify specific dependency behaviors at declared intervals
- **Replay comparison:** Periodically comparing live dependency responses against captured corpus responses for the same request parameters

Drift alerts are surfaced in the infrastructure observability layer (see INFRASTRUCTURE-OBSERVABILITY-AND-RUNTIME-TRUST-v1.md) as dependency-specific events.

### 7.3 Drift Response

When drift is detected:
- The dependency enters DRIFT_ALERT state
- Affected operations are flagged in the corpus with DEPENDENCY_DRIFT_CONTEXT
- The platform's validation layer parameters are reviewed against the drifted behavior
- A response plan is developed: accept the drift (update the schema/validation), reject the drift (enforce the original schema and alert the vendor), or replace the dependency

---

## 8. "Externally Sourced Truth" Governance

### 8.1 The Problem with Externally Sourced Truth

When an external system is treated as authoritative for operational truth, the platform's sovereignty is compromised. The external system can produce incorrect, stale, or malicious outputs, and the platform accepts them as truth without verification.

Examples of externally sourced truth patterns:
- "Our analytics platform says uptime was 99.8% — that's the official number"
- "The content provider's API says this content is approved — no need to validate"
- "Our cloud monitoring says all systems are healthy — no need for internal health checks"

In each case, an external system's assertion has replaced the platform's own governance determination.

### 8.2 The Verification Requirement

Every claim about operational truth that originates from an external system must be verified against the platform's corpus before it becomes authoritative:

- An external SLA report is verified against corpus-derived metrics
- An external content approval is validated through the platform's content governance process
- An external health report is supplemented by internal corpus-derived health indicators

The corpus is the primary authority. External systems provide signals. Signals are verified; they are not accepted as facts.

### 8.3 Externally Sourced KPIs

When operational metrics are computed by external analytics platforms rather than derived from the corpus:
- The computation methodology is declared and auditable
- The corpus data used as input is the same corpus data the platform uses internally
- The external platform's computation is periodically compared against the internal computation
- Discrepancies are investigated and resolved before the external metric is used in any consequential context

---

## 9. Infrastructure Portability

### 9.1 The Portability Requirement

The platform must be deployable on any infrastructure that meets the declared runtime requirements. It may not have runtime dependencies that can only be satisfied by a single cloud provider, a single SaaS vendor, or a single infrastructure technology.

Portability is sovereignty. A platform that can only run on Provider A is at Provider A's commercial mercy.

### 9.2 Portability Requirements

**Compute:** The platform runs on standard container infrastructure with no provider-specific runtime features.

**Storage:** The corpus is stored using an open format with standard access interfaces. No proprietary storage features are used for corpus integrity (the hash chain is computed and maintained by the platform, not by a storage vendor's native versioning).

**Network:** No cloud-provider-specific networking features are required for the platform to function.

**Authentication:** The authentication infrastructure uses open standards (OAuth2, OIDC). The platform can replace its authentication backend without changing the governance kernel.

**Observability:** The platform's observability infrastructure is based on open standards (OpenTelemetry or equivalent). Vendor-specific observability features are used only for EXT-TIER-4 non-operational capabilities.

### 9.3 Portability Verification

Annually, portability is verified by reviewing each declared dependency against a list of infrastructure alternatives:
- Can the compute dependency be satisfied by an alternative provider?
- Can the storage dependency be satisfied by an alternative?
- Are any proprietary features being used that have no standard alternative?

New dependencies that reduce portability require explicit governance approval with documented rationale.

---

## 10. Emergency Vendor Severance Procedure

### 10.1 When Severance Is Required

Emergency vendor severance is required when:
- A vendor has been confirmed compromised and is presenting malicious inputs to the platform
- A vendor has materially breached its governance contract (unauthorized data access, integrity violation)
- A vendor is unreachable and the continued dependency is causing operational harm
- A regulatory or legal action requires the vendor relationship to be immediately terminated

### 10.2 Severance Protocol

**Phase 1 — Isolation (immediate):**
The vendor's integration is cut at the abstraction boundary. No further calls are made to the vendor. The circuit breaker is opened and locked.

**Phase 2 — Fallback activation:**
The declared fallback behavior for each affected operation is activated. Operations that cannot function without the vendor are restricted with visible explanation.

**Phase 3 — Corpus annotation:**
The severance event is a corpus record: timestamp, vendor, basis for severance, operational impact.

**Phase 4 — Alternative activation:**
If an alternative vendor or self-hosted alternative exists, the adapter is switched and the alternative is activated. If no alternative exists, the affected operations remain restricted until one is deployed.

**Phase 5 — Impact assessment:**
The corpus records during the vendor relationship are reviewed for any signs that the vendor's responses may have introduced errors during the dependency period.

### 10.3 Severance Without Alternative

If emergency severance occurs and no alternative is ready:
- The affected operations are restricted with explicit display of the basis and estimated restoration timeline
- Restricted operations that were in the survival hierarchy (see ACQUISITION-AND-ORGANIZATIONAL-SURVIVABILITY-v1.md §10) are prioritized for alternative deployment
- Operators at affected venues receive communication covering what is unavailable and what alternatives exist

---

## 11. Vendor Compromise Operational Modes

### 11.1 Compromise Mode Classification

When a vendor relationship enters a compromised state, the platform's operational mode is declared:

**VENDOR_SCRUTINY:** Vendor responses are accepted but logged at elevated detail. All responses are validated against the baseline. Anomalies are flagged but do not block operations.

**VENDOR_RESTRICTED:** Vendor responses are accepted only for operation types where the validation layer can guarantee integrity. Operations that require trusted vendor responses are restricted to self-hosted fallback.

**VENDOR_SUSPENDED:** All vendor calls are suspended. Fallback behavior is fully active. Vendor is under investigation.

**VENDOR_SEVERED:** Emergency severance executed. See §10.

### 11.2 Mode Visibility

The vendor operational mode is visible in the infrastructure trust surface:
- Current mode for each EXT-TIER-2 and EXT-TIER-3 dependency
- Time in current mode
- Operations affected
- Estimated restoration

Vendor modes are not hidden from operators. An operator whose operations are restricted because a vendor is under scrutiny is told the reason.

---

## 12. Human-Verifiable External State Transitions

### 12.1 The Verification Requirement

When an external system reports a state transition (content approved, authentication confirmed, schedule updated), that transition is human-verifiable: an operator with appropriate authority can examine the corpus and confirm that the state transition occurred, what triggered it, and what its operational consequence was.

State transitions that exist only in the external system's records — not reflected in the corpus with a verified event — are not authoritative operational facts.

### 12.2 State Transition Audit Trail

For each EXT-TIER-2 and EXT-TIER-3 state transition:
- The external system's assertion (what it reported)
- The platform's validation result (did the assertion pass the validation layer)
- The corpus event (what the governance kernel recorded)
- The operational consequence (what changed in operational state)

All four elements are required for a complete audit trail. A state transition with only the external system's assertion and no corpus event has not been governed.

---

## 13. Forbidden Dependency Patterns

The following dependency patterns are explicitly prohibited:

**GOVERNANCE_VENDOR:** No vendor provides governance-as-a-service that replaces the platform's governance kernel. Governance is self-sovereign.

**CORPUS_BYPASS_INTEGRATION:** No vendor integration writes operational state changes without going through the governance kernel and corpus ingestion pipeline.

**TRUTH_DELEGATION:** No vendor's assertion is treated as operational truth without corpus verification.

**LOCK_IN_WITHOUT_ABSTRACTION:** No vendor is accessed without an abstraction boundary that supports vendor replacement.

**MONITORING_AS_PRIMARY_RECORD:** No vendor-hosted monitoring platform is treated as the primary operational record. The corpus is the primary record.

**OPAQUE_MANAGED_SERVICES:** No "managed" service is used for any component in the survival hierarchy unless the managed service's configuration, operation, and data are fully accessible and auditable by the platform team.

**SINGLE_VENDOR_SURVIVAL_DEPENDENCY:** No Tier S1 or Tier S2 survival hierarchy capability (see ACQUISITION-AND-ORGANIZATIONAL-SURVIVABILITY-v1.md §10) depends on a single external vendor with no viable alternative.

---

## 14. Dependency Blast Radius Governance

### 14.1 Blast Radius Assessment

Every EXT-TIER-2 and EXT-TIER-3 dependency has a declared blast radius: the scope of operational capabilities that would be affected if the dependency became completely unavailable.

Blast radius is assessed in three dimensions:
- **Operational scope:** Which venue operations, which governance capabilities, which operator actions would be restricted
- **Duration scope:** How long operations would be restricted before fallback is fully active
- **Data scope:** What data, if the vendor is compromised, might be exposed or corrupted

### 14.2 Maximum Blast Radius

No EXT-TIER-2 or EXT-TIER-3 dependency may have a blast radius that encompasses any Tier S1 survival capability. A dependency that, if removed, would disable corpus integrity, deterministic execution, or action attribution is not a peripheral dependency — it is a governance threat.

Dependencies whose blast radius exceeds the declared maximum require:
- Architectural redesign to reduce the blast radius
- Or migration to an alternative that has a smaller blast radius
- Or explicit veto process documentation of why the risk is accepted

### 14.3 Blast Radius Visibility

Blast radius for each dependency is displayed in the infrastructure trust surface's dependency map. Operators can see, at any time:
- Which dependencies are currently functioning
- What would be restricted if each dependency became unavailable
- Which dependencies have active restrictions

---

## 15. Constitutional Restrictions on External Influence

The following are unconditionally prohibited regardless of vendor contract terms, cloud provider agreements, or commercial relationships:

1. **A vendor may not hold the authoritative copy of the corpus.** The platform holds the corpus. Vendors may receive replicated copies subject to data governance; they do not hold the primary.

2. **A vendor may not determine the governance kernel's configuration.** Configuration is governed internally and version-controlled.

3. **A vendor may not access operator identity data without explicit per-operator consent and audit trail.**

4. **A vendor may not alter the corpus hash chain verification process.** Hash chain verification is internal and immutable to vendor influence.

5. **A vendor's API change may not force an unreviewed change to the platform's governance logic.** API changes are absorbed in the adaptation layer and reviewed before any governance logic change.

6. **A vendor's terms of service may not constrain the platform's right to audit its own data.** Any vendor agreement that limits the platform's access to its own operational data is non-compliant with the platform's governance requirements.

---

## 16. Auditability Requirements for Third-Party Systems

Every EXT-TIER-2 and EXT-TIER-3 dependency is subject to annual third-party auditability review:

- The platform's team can access all data the vendor holds that originated from the platform
- The platform's team can verify that the vendor's retained data matches the platform's corpus records
- The vendor's security controls are auditable through standard audit interfaces (SOC 2, ISO 27001, or equivalent)
- The vendor's data processing agreements specify the platform's right to audit
- Any data processing by the vendor that goes beyond declared purposes is detectable

Vendors that cannot meet these auditability requirements are:
- Flagged as sovereignty risks
- Subject to a migration plan to a compliant alternative
- Not used for any Tier S1 or Tier S2 survival hierarchy capability
