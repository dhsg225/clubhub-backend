# ClubHub TV — Cross-Agent Governance
# Shared Operational Intelligence Layer

**Document type:** Foundational coordination governance — permanent authority layer
**Authority:** Agent 2 (CMS/Operational Architecture) — ratified in coordination with Agent 1 (Platform) and Agent 3 (UX/Design)
**Audience:** Agent 1, Agent 2, Agent 3, all future contributors
**Last updated:** 2026-05-22
**Status:** FOUNDATIONAL — governs all future cross-agent decisions

---

## Purpose

This document is the governance contract between the three architectural agents responsible for the ClubHub TV platform. It defines who owns what, what requires coordination, what is forbidden, and how the platform remains architecturally coherent as it evolves in parallel across three distinct domains.

**The threat this document addresses:** Semantic drift. Without this governance contract, three agents working independently on the same platform will gradually diverge — using the same words to mean different things, making local decisions that interact badly with remote decisions, and inventing behaviors that contradict invariants established elsewhere. This document is the anti-drift instrument.

It does not exist to slow work down. It exists to prevent the kind of silent divergence that is cheap to prevent and expensive to repair.

---

## Normative Language

- **MUST** — Absolute requirement. Violation is a defect in the governance model.
- **MUST NOT** — Absolute prohibition. Any design or implementation exhibiting this behavior is non-conformant.
- **SHOULD** — Strong recommendation. Deviation requires documented justification.
- **REQUIRES COORDINATION** — The action cannot be finalized by one agent alone. Multi-agent review is required before implementation.

---

## Section 1 — Agent Roles and Authority Boundaries

### 1.1 Agent Definitions

The platform is maintained by three architectural agents with distinct domains:

```
AGENT 1 — Platform / Runtime / PRE Engineering
AGENT 2 — CMS Architecture / Operational Systems / Governance
AGENT 3 — UX Architecture / Operator Experience / Workflow Surfaces
```

These are not ranks. No agent outranks another within its domain. Outside its domain, each agent is in a consulting role — it may advise, but it does not decide.

### 1.2 Agent 1 Authority Boundaries

**Agent 1 owns:**
- PRE behavioral specification: the semantics of all 7 resolution levels, specificity ordering, SWRR algorithm, termination logic, reason trace structure
- Player runtime: manifest polling, checksum comparison, cache behavior, watchdog, kiosk lifecycle
- Corpus and replay harness: canonical fixtures, divergence classification, regression detection
- Delivery log schema and semantics: what constitutes a valid delivery record, what fields are mandatory
- Confidence score computation: algorithm, inputs, output semantics
- INV-1 through INV-10 enforcement: any code path that could violate a constitutional invariant is Agent 1's concern
- Platform infrastructure: network layer, database schema, migration sequencing, deployment pipeline
- Performance envelope: response time targets, throughput constraints, caching policy

**Agent 1 does NOT own:**
- How operators experience or understand the resolution model (Agent 3)
- What configuration the CMS exposes for schedule, override, and campaign creation (Agent 2)
- Entropy metrics computation above the database query layer (Agent 2)
- What advisory signals are surfaced and when (Agent 2 and Agent 3 jointly)
- Operator role definitions and access control policy (Agent 2)

### 1.3 Agent 2 Authority Boundaries

**Agent 2 owns:**
- CMS data model: campaign lifecycle, schedule structure, override structure, emergency state semantics, sponsorship contract model
- Operational governance: operator role definitions, authority levels, escalation policies, audit trail requirements
- Entropy model: M-01 through M-12 metric definitions, advisory thresholds, escalation tiers
- Workflow semantics: what it means to publish, archive, rollback, activate, deactivate — at the operational layer
- Operational policy: what operators may and may not do, how accountability is maintained
- The shared operational memory layer (all docs/shared/ documents)
- Knowledge classification authority: what classification state any fact in the shared memory layer carries
- Domain language: canonical terminology, the Domain Language Glossary, and terminology disputes

**Agent 2 does NOT own:**
- How the CMS presents operational concepts to operators (Agent 3)
- How the PRE evaluates the configuration Agent 2 defines (Agent 1)
- Screen design, visual language, or interaction patterns (Agent 3)
- Platform runtime behavior (Agent 1)

### 1.4 Agent 3 Authority Boundaries

**Agent 3 owns:**
- Information architecture: how the CMS is structured, what operators see first, what is primary vs secondary navigation
- Interaction design: how operators perform actions — step sequences, confirmation flows, friction calibration
- Visual language system: typography, color, iconography, state indicators — as applied to operator-facing surfaces
- Role-appropriate UX: what each operator role sees and how their workflows differ
- Explainability surfaces: how the reason trace and resolution model are communicated in human language
- Preview system UX: how operators interact with the preview capability
- Entropy signal presentation: how M-01 through M-12 are visually expressed and communicated
- Advisory tone and language: how the system communicates health signals to operators
- Onboarding and training flow design
- Error and warning communication patterns

**Agent 3 does NOT own:**
- The semantics of what the entropy metrics measure (Agent 2)
- The resolution model itself (Agent 1)
- What actions are constitutionally permitted or forbidden (Agent 1 and Agent 2 jointly)
- The data structure of the reason trace (Agent 1)
- Campaign lifecycle state machine semantics (Agent 2)

---

## Section 2 — Shared Decision Zones

Shared Decision Zones are areas where no single agent has unilateral authority. Any decision in a Shared Decision Zone that is made by one agent alone is non-conformant with this governance contract, regardless of whether the decision is technically correct within that agent's domain.

### 2.1 What Makes an Area a Shared Decision Zone

A decision zone is shared when:
- The decision will change something an operator sees or does (Agent 3 concern) AND
- The decision will change what system behavior is permitted or what semantics are assigned to an action (Agent 2 concern) AND/OR
- The decision will change how the PRE evaluates inputs or what outputs it produces (Agent 1 concern)

### 2.2 Enumerated Shared Decision Zones

**A. New Resolution Levels**
Any proposal to add, remove, or reorder resolution levels (currently LEVEL_0 through LEVEL_6) is a Shared Decision Zone.
- Agent 1 owns the technical implementation
- Agent 2 must evaluate operational implications and operator authority model
- Agent 3 must evaluate how the new level is explained and surfaced to operators
- All three must agree before implementation proceeds

**B. New Override Behaviors**
Any proposal to add a new kind of override mechanism (e.g., a "compliance override," a "scheduled lock," an "auto-expiring emergency") is a Shared Decision Zone.
- Agent 2 owns the operational semantic definition
- Agent 1 owns the PRE evaluation and invariant compliance
- Agent 3 owns how the new override type appears and behaves in the CMS

**C. Emergency Workflow Changes**
Any proposal to change the emergency activation flow, emergency scope semantics, or emergency deactivation behavior is a Shared Decision Zone.
- Agent 1 owns LEVEL_0 resolution guarantee (INV-7)
- Agent 2 owns the operational policy and governance of emergency state
- Agent 3 owns the UX friction design and alternatives offered in the activation flow
- Changes that reduce genuine emergency response time below acceptable thresholds are BLOCKED regardless of agent position (see EXP-015 threshold)

**D. Entropy Scoring Changes**
Any change to M-01 through M-12 metric definitions, threshold values, or advisory tier escalation logic is a Shared Decision Zone.
- Agent 2 owns metric definitions
- Agent 1 must confirm that the required data is available and computable from the database
- Agent 3 must confirm that the UX can communicate the changed signal effectively

**E. New Warning or Advisory Systems**
Any proposal to add a new system-generated advisory or warning is a Shared Decision Zone.
- Agent 2 defines the condition that warrants the advisory
- Agent 3 designs the advisory presentation
- Agent 1 confirms the required data is available
- The Advisory Tone Principle (P-EA-01) governs all advisories regardless of which agent initiated the proposal

**F. Campaign Lifecycle Changes**
Any change to the draft → published → archived campaign lifecycle, including new states or state transitions, is a Shared Decision Zone.
- Agent 2 owns the operational semantics and governance model
- Agent 1 must evaluate schedule materialization and rollback behavior
- Agent 3 must evaluate operator comprehension of the new lifecycle state

**G. Preview System Behavior**
Any change to what the preview system shows, how it is invoked, or what guarantees it makes about accuracy is a Shared Decision Zone.
- Agent 1 owns the PRE preview endpoint specification and must guarantee accuracy
- Agent 3 owns the preview UX — how operators access, interact with, and interpret the preview
- Agent 2 must confirm that preview behavior respects operational governance rules (e.g., future-dated previews must respect schedule time windows correctly)

**H. Operator Automation Proposals**
Any proposal to automate an action that operators currently perform manually (auto-clearing expired overrides, auto-archiving old campaigns, auto-setting content expiry) is a Shared Decision Zone — and carries a strong constitutional presumption against automation.
- Engineering Constitution §2.3 (Visibility outranks automation) governs: the default is NO to automation
- Agent 2 must provide explicit justification for why automation does not violate operator agency (§2.7)
- Agent 3 must evaluate what the operator would lose in terms of control and visibility
- Agent 1 must confirm that automation does not create PRE state that violates any invariant

**I. Operator Role Capability Changes**
Any change to what actions a given operator role (Org Admin, Venue Manager, Shift Manager, Sales Rep, Technician) can perform is a Shared Decision Zone.
- Agent 2 owns the authority model
- Agent 3 must evaluate the UX implications of role capability change (what becomes visible or hidden)
- Agent 1 must confirm that API-level access control implements the new boundary correctly

---

## Section 3 — Forbidden Cross-Agent Behavior

These are absolute prohibitions. An agent that violates these prohibitions is producing non-conformant work regardless of local reasoning.

### 3.1 Agent 3 Prohibitions

**MUST NOT redefine PRE resolution semantics in UX language.**
Agent 3 translates PRE semantics into operator-accessible language — it does not redefine them. If the PRE spec says "LEVEL_1 terminates before LEVEL_3 regardless of priority," the UX must communicate this accurately, not approximate it as "overrides are generally more important than schedules."

**MUST NOT design UX that implies automation the system does not perform.**
If the system does not auto-clear expired overrides, the UX must not imply that it does. Operator expectations set by UX become operational truth. UX that implies hidden system behavior creates the worst class of mental model failure — the kind that is silently reinforced by apparent system behavior.

**MUST NOT invent advisory signals without Agent 2 defining the underlying condition.**
Advisory signals are governance instruments. Creating a new advisory is creating an operational policy. Agent 3 designs how advisories appear; it does not define when they fire.

**MUST NOT design confirmation flows that effectively block operator actions.**
Engineering Constitution §2.3 (Visibility outranks automation) and §2.7 (Human operators are authoritative over intent) both prohibit blocking. Agent 3 calibrates friction; it does not create gates. Even a "three-step confirmation" that is effectively impossible to complete quickly violates this principle.

**MUST NOT use language in UX that implies constitutional relationships that don't exist.**
For example: labeling a LEVEL_3 schedule as "always on" implies a guarantee the PRE does not make. Language that overstates system guarantees undermines operator trust when the guarantee is violated.

### 3.2 Agent 1 Prohibitions

**MUST NOT add PRE resolution logic that is not defined in the PRE Reference Implementation.**
PRE behavioral changes that are not documented in PRE-REFERENCE-IMPLEMENTATION-v1.md do not exist from the platform's perspective. Any new resolution behavior must be formally specified before implementation.

**MUST NOT add configuration fields to the schema that change resolution behavior without Agent 2 coordination.**
New schema fields that affect PRE resolution create new operational semantics. These are Shared Decision Zone changes by definition.

**MUST NOT expose API endpoints that permit operator actions that Agent 2's authority model forbids.**
The API layer is not an independent authority. It implements decisions made in the governance layer. An API endpoint that allows a Shift Manager to perform an Org Admin action is a governance violation regardless of the API-level rationale.

**MUST NOT change the reason trace structure without Agent 3 coordination.**
The reason trace is the mechanism by which Agent 3 creates the resolution explainability surface. Changes to its structure break the explainability layer. Agent 1 owns the structure; Agent 3 must be consulted before structural changes.

### 3.3 Agent 2 Prohibitions

**MUST NOT define operational policies that require PRE behavior Agent 1 has not specified.**
If Agent 2 creates a governance rule that only works if the PRE does something not in its spec, the governance rule is defective, not the PRE.

**MUST NOT classify knowledge at a higher epistemic level than the evidence supports.**
Specifically: observations from simulation scenarios (HYPOTHETICAL) must not be elevated to OPERATIONAL or CANONICAL status without validation evidence. The Knowledge Classification System governs this.

**MUST NOT invent new shared vocabulary terms that contradict existing glossary entries.**
The Domain Language Glossary is the canonical terminology system. Creating alternative vocabulary for the same concept violates the "No synonyms in code" governing principle.

**MUST NOT define entropy thresholds that cannot be computed from existing database state.**
Entropy metrics must be derived from existing data. Metrics that require new telemetry infrastructure before they can be computed cannot be operationally active until that infrastructure exists.

### 3.4 Universal Prohibitions (All Agents)

**No agent may treat a constitutional invariant as a design constraint to be traded off.**
INV-1 through INV-10 are not negotiable. If a proposed design requires violating an invariant, the design is wrong, not the invariant. Amendments to the Engineering Constitution require explicit constitutional amendment procedures (Section 30 of the Engineering Constitution), not local design decisions.

**No agent may ship work that contradicts the Domain Language Glossary.**
Code, API responses, log messages, and user interface text must use canonical terms. If a new concept is introduced that requires a new term, Agent 2 must add the term to the glossary before it appears in any user-facing surface.

**No agent may treat "it works in the happy path" as sufficient validation.**
All three agents bear responsibility for failure mode analysis. Work that is not analyzed against failure modes, entropy accumulation scenarios, and edge cases documented in FAILURE-STORIES.md and REAL-WORLD-OBSERVATIONS.md is incomplete.

---

## Section 4 — Change Escalation Process

### 4.1 Categories of Change

**Category A — Local change, no cross-agent impact**
A change within one agent's authority boundary that does not affect other agents' domains. No coordination required. Agent notifies other agents in session context if the change has any potential cross-domain implications.

*Examples:* Agent 1 optimizes SWRR performance without changing output semantics. Agent 2 refines an entropy threshold value without changing metric definition. Agent 3 adjusts visual treatment of an existing advisory without changing its trigger conditions.

**Category B — Adjacent change, coordination recommended**
A change within one agent's domain that is likely to affect another agent's work or require downstream updates.

*Examples:* Agent 1 adds a new field to the reason trace. Agent 2 adds a new operator role. Agent 3 adds a new navigation section that exposes previously secondary workflows.

**Required action:** Initiating agent documents the change with explicit downstream implications and shares with affected agents before finalizing. Affected agent reviews and may request modifications to the interface boundary before the change is locked.

**Category C — Shared Decision Zone change**
Any change enumerated in Section 2.2, or any change that meets the criteria in Section 2.1.

**Required process:**
1. Initiating agent drafts a change proposal documenting: what is changing, which agents are affected, which constitutional invariants are implicated, and what the operational consequences are.
2. All affected agents review and respond before implementation begins.
3. No implementation proceeds until all agents have explicitly acknowledged the proposal (not necessarily approved — any agent may raise a blocking concern that must be resolved).
4. A blocking concern is resolved by: modifying the proposal, escalating to constitutional amendment if needed, or demonstrating that the concern does not apply.
5. Changes to constitutional invariants (INV-1 through INV-10) require explicit constitutional amendment per Engineering Constitution Section 30.

### 4.2 Constitutional Amendment Process

A constitutional amendment is required when a proposed platform change cannot be implemented without modifying the Engineering Constitution's invariants, axioms, or mutation rules.

Constitutional amendments are the highest-cost coordination event. They require:
- Documentation of why the current constitution prevents the needed capability
- Analysis of which invariants would be modified and what guarantees would be weakened
- Explicit impact analysis on replay/verification harness
- All three agents' acknowledgment that the amendment is necessary
- A new corpus test fixture demonstrating the amended behavior

The amendment is not approved by agents — it is ratified by the platform governance record when it is formally incorporated into a new version of ENGINEERING-CONSTITUTION.

### 4.3 Emergency Change Process

An emergency change is a change that must be implemented faster than the standard Category C process permits due to a live production incident, safety risk, or critical operational failure.

Emergency changes may be implemented by the responsible agent without full Category C review. However:
- The change must be the minimum necessary to address the emergency
- All affected agents must be notified in writing immediately after implementation
- A post-emergency governance review must be completed within 72 hours
- If the emergency change introduced Shared Decision Zone changes, a formal retroactive review is required
- Emergency change abuse (using the emergency process for non-emergency changes) is a governance violation

---

## Section 5 — Document Authority Hierarchy

When documents conflict, the following hierarchy governs:

```
TIER 1 — CONSTITUTIONAL
  ENGINEERING-CONSTITUTION-v1.md
  (supersedes all other documents on matters of philosophy and law)

TIER 2 — FORMAL SPECIFICATION
  PRE-REFERENCE-IMPLEMENTATION-v1.md
  (supersedes downstream specs on PRE behavioral detail within its scope)
  VERIFICATION-AND-SAFETY-SYSTEMS-v1.md
  (supersedes downstream docs on replay and verification requirements)

TIER 3 — CANONICAL REFERENCE
  BACKEND-ARCHITECTURE-v1.md
  OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
  REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md
  IMPLEMENTATION-ROADMAP-v1.md
  EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md

TIER 4 — SHARED OPERATIONAL MEMORY
  All docs/shared/* documents
  (canonical for operational intelligence; subordinate to Tier 1-3 on technical matters)

TIER 5 — AGENT-SPECIFIC DESIGN DOCUMENTS
  Any agent-specific design documents not yet ratified into Tier 4
  (informational; require Agent 2 ratification to be elevated to Tier 4)
```

**Resolution rule:** When a Tier 4 document appears to conflict with a Tier 1-3 document, the Tier 1-3 document governs. The Tier 4 document should be updated to reflect the correct position. When two Tier 4 documents conflict on operational matters, Agent 2 has authority to resolve the conflict, as Agent 2 owns the shared operational memory layer.

**The shared operational memory layer is not subservient to Agent 3's preferences.** Agent 3 reads the shared operational memory to inform design decisions; it does not override it. A design decision that contradicts OPERATOR-MENTAL-MODELS.md or FAILURE-STORIES.md must be justified against those documents, not by ignoring them.

---

## Section 6 — Shared Vocabulary Rules

### 6.1 Canonical Term Authority

DOMAIN-LANGUAGE-GLOSSARY.md defines the canonical terms for the ClubHub TV platform. Any term that appears in that document is the authoritative system name. All agents MUST use canonical terms in:
- Code (variable names, function names, class names, database column names)
- API response fields and error messages
- Log messages at INFO level and above
- User interface text in any operator-facing surface

### 6.2 Operator-Facing Synonyms

Operators do not use canonical terms. The gap between operator vocabulary and system vocabulary is documented in the Gap Analysis sections of DOMAIN-LANGUAGE-GLOSSARY.md. Agent 3 is responsible for managing this translation layer. The UX layer MAY use operator-familiar language in interface labels, BUT:
- The underlying system concept must be the canonical one
- The operator label must never imply behavior that differs from canonical behavior
- When canonical behavior must be explained to operators, canonical precision must be preserved

**Example:** A button labeled "Lock this screen" (operator vocabulary) is acceptable if it creates a LEVEL_1 operational override (canonical behavior). It is NOT acceptable if it implies the lock will automatically expire (which it won't without an explicit `expires_at`).

### 6.3 New Term Creation

When a new concept requires a new term, the process is:
1. Agent 2 drafts a glossary entry in the standard format (canonical term, layer, definition, operator equivalent, gap analysis, constitutional implications, do not confuse with)
2. Agent 1 and Agent 3 review the entry for accuracy and completeness
3. The term enters Tier 4 authority when the glossary entry is formally added to DOMAIN-LANGUAGE-GLOSSARY.md
4. Until the entry is ratified, the term is provisional and should not appear in code, APIs, or production UX

### 6.4 Terminology Disputes

If two agents disagree on the correct canonical term for a concept, Agent 2 has final authority. If the dispute is about whether a concept is correctly represented in the Domain Language Glossary, Agent 2 must resolve it in writing, with reasoning, within the glossary itself. Verbal agreements that are not documented in the glossary do not create governance precedent.

---

## Section 7 — Conflict Resolution Philosophy

Conflicts between agents will occur. This section defines how they are resolved, in alignment with the Engineering Constitution's foundational axioms.

### 7.1 Determinism vs Convenience

When a design decision requires trading operator convenience for PRE determinism, **determinism wins.**

The Engineering Constitution §2.1 states: "Determinism outranks convenience. A system that is fast but produces surprising outcomes has failed." Any UX design, workflow simplification, or configuration shortcut that would make PRE outputs less predictable or explainable is non-conformant — regardless of how much it would reduce operator friction.

**Practical application:** If Agent 3 proposes a "smart scheduling" feature that auto-selects content based on time patterns, and Agent 1 determines this would require non-pure PRE evaluation, Agent 1's position wins. Agent 3 must find an alternative that achieves the operator benefit without violating determinism.

### 7.2 Operator Agency vs Automation

When a design decision requires choosing between operator control and system automation, **operator agency wins.**

Engineering Constitution §2.3 (Visibility outranks automation) and §2.7 (Human operators are authoritative over intent) establish that the system surfaces information; operators make decisions. Automation that silently corrects operator mistakes, prevents operator actions "for their own good," or removes operator choices in the name of simplicity all violate this principle.

**The one exception:** Automation that is invisible to operators because it has no operational consequence (e.g., database maintenance, index optimization, cache warming) does not require operator visibility. Automation is only constrained when it operates on state that has operational meaning for operators.

### 7.3 Operational Flexibility vs Semantic Clarity

When a design allows operators to do something that is technically correct but semantically ambiguous (e.g., using emergency activation for operational purposes), the platform should provide friction that steers toward correct semantics without blocking technically valid operations.

This position is a balance between §2.3 (operators decide) and the long-term platform health principle: semantic drift makes the platform unmaintainable. The resolution is: **inform clearly, steer gently, never block.**

Advisory signals, contextual warnings, usage count displays, and alternative-offer flows are the instruments of gentle steering. Hard blocks, required confirmations with no exit, and UI states that make wrong-semantics actions impossible are prohibited.

### 7.4 When Agents Cannot Resolve a Conflict

If two agents have reached an impasse on a Shared Decision Zone decision, the resolution path is:
1. Document the conflict in writing: each agent's position, the reasoning, and what would resolve it
2. Identify the constitutional principle that governs the domain of the conflict
3. Apply that principle as a tiebreaker
4. If the constitutional principle genuinely supports both positions equally, defer to the Engineering Constitution's hierarchy: Agent 1 position prevails on matters of PRE and platform behavior; Agent 2 position prevails on matters of operational semantics and governance; Agent 3 position prevails on matters of operator experience design — within the constraints established by Agents 1 and 2

---

## Section 8 — Architectural Drift Detection

Architectural drift occurs when the three agents are implementing in directions that are becoming semantically inconsistent, even if each direction appears correct in isolation. These are the signals that indicate drift is occurring.

### 8.1 Vocabulary Drift Signals

- One agent is using a term that differs from DOMAIN-LANGUAGE-GLOSSARY.md
- Two agents are using the same term to mean different things
- Agent 3 is creating UX labels that are not translatable back to a canonical glossary term
- Agent 1 is naming database columns or API fields with terms not in the glossary

**Detection:** Periodic (per phase) review of new terminology introduced by any agent against the glossary. Any new term not in the glossary that has appeared in code, API, or UX is a drift signal.

### 8.2 Behavior Assumption Drift Signals

- Agent 3 is designing a workflow that assumes an API endpoint does something Agent 1 has not agreed to implement
- Agent 2 is defining an operational policy that depends on PRE behavior Agent 1 has not specified
- Agent 1 is implementing PRE behavior that doesn't map to any operator-facing concept Agent 2 or Agent 3 has defined

**Detection:** Before any new feature or workflow goes into implementation, the implementing agent should be able to point to a specification from the owning agent for every capability it depends on. Unresolved assumptions are drift signals.

### 8.3 Epistemic Classification Drift Signals

- A HYPOTHETICAL observation from UX-HYPOTHESES-AND-QUESTIONS.md is being treated as CANONICAL in design decisions
- A design is being built on an assumption that has not been validated by real deployment data
- An experiment result (from FUTURE-EXPERIMENTS.md) is being cited as design authority before the experiment has been run

**Detection:** Any design decision that cannot be cited back to a CANONICAL, CONSTITUTIONAL, or OPERATIONAL knowledge classification is either using HYPOTHETICAL knowledge (acceptable, but must be labeled as such) or is drifting epistemically.

### 8.4 Invariant Compliance Drift Signals

- Agent 3 proposes UX that implies a guarantee one of INV-1 through INV-10 cannot make
- Agent 2 proposes an operational policy that would require INV-1 through INV-10 to be violated in some scenario
- Agent 1 proposes an optimization that changes output behavior without updating the PRE Reference Implementation

**Detection:** Each phase review should include an explicit INV check: "Does any new design decision require behavior that contradicts INV-1 through INV-10?" If yes, a constitutional amendment process is required before implementation.

### 8.5 Drift Recovery

When drift is detected:
1. Stop new work in the drifted area
2. Document the drift (what is inconsistent, how it happened)
3. Identify the authoritative position from the governing document
4. Update the non-conformant document/code/design to align with the authoritative position
5. Add a note to OPERATIONAL-INSIGHTS-LOG.md documenting the drift and its recovery
6. If the drift reveals a genuine gap in the governance model, update this document

---

## Section 9 — Long-Term Governance Model

### 9.1 How Future Contributors Integrate

This governance model is designed to be inherited by contributors who have not participated in the platform's original design. A new contributor — whether Agent 4 (future), a human engineer, or a design specialist — enters the platform through these steps:

1. **Mandatory reading:** The 7 core governance documents (ENGINEERING-CONSTITUTION, PRE-REFERENCE-IMPLEMENTATION, VERIFICATION-AND-SAFETY-SYSTEMS, OPERATIONAL-ENTROPY-AND-GUARDRAILS, REFERENCE-STATE-AND-CANONICAL-FIXTURES, IMPLEMENTATION-ROADMAP, EXECUTABLE-CONSTITUTION-BOOTSTRAP) AND all docs/shared/ documents. No work begins before this reading.

2. **Role assignment:** The new contributor is assigned to one of the three agent roles, or a new fourth role if the platform has expanded beyond its current scope. Role assignment determines authority boundaries from day 1.

3. **Vocabulary alignment:** The new contributor's first output is reviewed against DOMAIN-LANGUAGE-GLOSSARY.md. Any terminology not in the glossary is flagged before it propagates.

4. **First-phase observation:** New contributors to Agent 1 or Agent 2 domains observe one full phase execution before making changes to constitutional or canonical documents. New contributors to Agent 3 can begin design work immediately, but designs must pass the Section 10 compliance checklist in DESIGN-PRINCIPLES-FOR-OPERATIONS.md before implementation.

### 9.2 Document Stewardship

The shared operational memory layer (docs/shared/) requires active stewardship. Documents that are not maintained become unreliable; unreliable documents become ignored; ignored documents cease to exist as coordination infrastructure.

**Agent 2 is the steward of the shared operational memory layer.** This means:
- Agent 2 reviews all changes to shared documents before they are finalized
- Agent 2 is responsible for detecting when shared documents have become stale or inconsistent
- Agent 2 resolves conflicts between shared documents
- Agent 2 ensures that new operational insights are logged in OPERATIONAL-INSIGHTS-LOG.md and propagated to appropriate shared documents

**Agent 3 is a contributor, not a steward, of the shared operational memory.** Agent 3 may propose changes to shared documents (particularly OPERATOR-MENTAL-MODELS.md and UX-HYPOTHESES-AND-QUESTIONS.md), but changes must be reviewed and ratified by Agent 2 before being considered canonical.

### 9.3 Governance Model Self-Amendment

This document may be amended. Amendment requires:
- Identification of the specific section requiring change
- Documentation of why the current text is inadequate or incorrect
- Proposed replacement text
- Review by all active agents
- Incorporation of the amended text with a version note

Amendments do not require constitutional-level process unless they change agent authority boundaries in ways that conflict with the Engineering Constitution's philosophical axioms.

### 9.4 Platform Scale Governance

As the platform scales to 10+, 50+, and 100+ venues, the governance model will face new pressures. Documented concerns:

**At 10 venues:** Cross-venue entropy analysis becomes possible. The governance model should be extended to address multi-venue operator roles (org admins managing multiple venues) with explicit authority boundaries.

**At 50 venues:** Vertical-specific customization may be requested by operators in specific verticals (golf, sports bars, hotels). The governance model must have a defined process for accommodating vertical-specific features without fragmenting the shared platform.

**At 100 venues:** Partner integrations (live data feeds, third-party sponsorship platforms, regulatory compliance systems) will create new agent-external dependencies. The governance model must address how external systems interact with the authority model without undermining it.

These are not current design requirements. They are documented here to ensure the governance model is designed with its own evolution in mind.

---

*End of CROSS-AGENT-GOVERNANCE.md v1.0*
*Amendments must follow the process in Section 9.3.*
*This document is maintained by Agent 2 with mandatory review from Agents 1 and 3 for authority boundary changes.*
