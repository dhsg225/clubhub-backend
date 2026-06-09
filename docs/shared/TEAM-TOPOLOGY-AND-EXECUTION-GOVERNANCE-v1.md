# TEAM TOPOLOGY AND EXECUTION GOVERNANCE v1

**Era:** System Materialization
**Status:** CANONICAL
**Scope:** Team boundaries, authority ownership, cross-team contracts, escalation paths, freeze authority, integrity conflict resolution, contributor onboarding, anti-hero safeguards

---

## 1. PURPOSE

Architecture fails during implementation not only because of technical shortcuts, but because of organizational dynamics that are invisible in the architecture documents. Teams build what they are structured to build. When team boundaries do not align with architectural boundaries, integration becomes the site of semantic negotiation — and semantic negotiation under delivery pressure always resolves in favor of the path of least resistance, not the path of constitutional correctness.

This document defines team structure that is aligned to the constitutional surfaces. It defines who owns what, who can block what, and what happens when delivery pressure and architectural integrity conflict.

**Team topology is architecture. An organization that contradicts its architecture in structure will produce a system that contradicts its architecture in behavior.**

---

## 2. CONSTITUTIONAL TEAM SURFACES

The implementation organization is structured around the major constitutional surfaces, not around conventional engineering specializations (frontend, backend, DevOps). Each constitutional surface has a designated team that owns it end-to-end — from spec to deployment verification.

### 2.1 Surface: Resolution Authority (PRE Engine Team)

**Owns:** PRE resolution engine (L0–L6 resolvers), corpus authoring tooling, determinism verification, hash computation, corpus integrity.

**Does NOT own:** How resolution results are rendered, state machine definitions, incident logic.

**Constitutional obligation:** Every resolution result is deterministic, hash-attested, and corpus-reproducible. No resolver may introduce non-determinism. The team is the first line of defense against replay mismatch.

**Authority boundary:** This team has veto authority over any change that could affect PRE resolution determinism, including changes proposed by other teams that touch the resolution API surface.

### 2.2 Surface: Operational State (State Authority Team)

**Owns:** All five canonical state machines (backend and frontend implementations), transition guard enforcement, observability emission contracts, state machine replay reconstruction.

**Does NOT own:** Visual presentation of state, network layer, PRE resolution logic.

**Constitutional obligation:** Every state transition is legal, observable, and replay-reconstructible. The transition table is the specification. Deviations from the table are defects, not features.

**Authority boundary:** This team has veto authority over any change to state machine transition tables, transition guard logic, or observability emission contracts. No state is added or modified without this team's sign-off.

### 2.3 Surface: Perceptual Layer (Operator Experience Team)

**Owns:** Component assembly (all component categories), visual semantics implementation, token system, motion governance, typography, PRE boundary component, shell components, operational pane components, interaction patterns.

**Does NOT own:** State machine logic, PRE resolution logic, backend session management.

**Constitutional obligation:** Every visual element carries exactly the operational meaning defined in the perceptual governance documents. No visual treatment carries ambiguous meaning. The LIVE/REPLAY distinction is always enforced. Cognitive survivability rules are implemented and simulation-verified.

**Authority boundary:** This team has veto authority over any visual change, any component dependency change, and any token value change. Token changes at the semantic layer require a joint review with the constitutional governance function.

### 2.4 Surface: Operational Infrastructure (Platform Reliability Team)

**Owns:** Deployment pipeline, CI/CD gates, observability infrastructure, governed clock implementation, database migrations, OTA delivery system, backup/restore, production monitoring.

**Does NOT own:** Application logic, state machine definitions, UI components.

**Constitutional obligation:** The CI pipeline enforces all constitutional gates. No deployment proceeds without valid certification evidence. Observability infrastructure is available and receiving before any operator-facing component ships.

**Authority boundary:** This team has veto authority over any change to the CI gate configuration, deployment pipeline, and observability sink contract.

### 2.5 Surface: Simulation and Verification (Verification Team)

**Owns:** Frontend simulation harness, mandatory simulation scenario corpus, certification suite, corpus packet authoring and integrity, replay parity test suite, component boundary checker.

**Does NOT own:** Application implementation, but has read access to all components for verification purposes.

**Constitutional obligation:** The certification suite is the arbiter of constitutional compliance. Certification evidence is unforgeable. The verification team is independent — it does not report to any team whose output it is certifying.

**Authority boundary:** This team has veto authority over any change to the mandatory simulation scenario list, certification criteria, or evidence format. They cannot be overruled by delivery pressure from other teams.

---

## 3. AUTHORITY OWNERSHIP DURING IMPLEMENTATION

### 3.1 The Owner-Approver Model

Every constitutional surface has exactly one owning team (as defined above). Changes to a surface require approval from the owning team before merging, regardless of which team authored the change.

This is not a bureaucratic gate. It is an expertise gate. The owning team has the deepest understanding of the constitutional constraints on their surface. They are best positioned to identify when a change violates those constraints in ways that are not immediately obvious.

### 3.2 Cross-Surface Changes

Changes that touch multiple constitutional surfaces require approval from all owning teams. These changes are the highest-risk category — they are where semantic drift most commonly originates.

**Example:** A change that modifies the state machine transition table AND changes how that state is rendered requires sign-off from both the State Authority Team and the Operator Experience Team. The temptation is to bypass one of the reviews because "it's really just a state machine change." The rendering consequence of the state machine change is exactly what the second review catches.

### 3.3 The Constitutional Governance Function

Above the team authority level, there is a constitutional governance function — a designated role (not a committee) responsible for:
- Approving changes to constitutional documents
- Resolving cross-team authority conflicts
- Declaring implementation freezes
- Making the final call when delivery-vs-integrity conflicts cannot be resolved at the team level

This role has architectural veto authority over any change. It is not a management role — it is a constitutional authority role. The person holding it may be a senior engineer, not necessarily a manager.

---

## 4. CROSS-TEAM COORDINATION CONTRACTS

### 4.1 Interface Contracts

When two teams share a boundary (one team's output is another team's input), the interface must be defined as an explicit contract before either team begins implementation:

```typescript
// Example: PRE Engine Team → Operator Experience Team
interface PREResolutionContract {
  // This interface is owned by PRE Engine Team
  // Operator Experience Team may not extend or modify it
  // Changes require PRE Engine Team approval

  resolutionId: string;
  resolvedAt: string;            // GovernedClock ISO8601
  determinismHash: string;       // sha256 of canonical resolution inputs
  resolverChain: string[];       // ordered resolvers applied
  result: ManifestSnapshot;
  explanationPayload: ExplanationPayload;
  state: 'RESOLVED' | 'STALE' | 'FAILED' | 'REPLAY_BOUND';
  corpusPacketId?: string;       // if REPLAY_BOUND
}
```

Contract changes are proposed by the consuming team, reviewed and approved by the owning team, and versioned. Breaking changes require a migration period during which both old and new contract versions are supported.

### 4.2 Event Bus Ownership

The operational event bus carries typed events between surfaces. Each event type is owned by exactly one team — the team whose surface emits it. Consuming teams may subscribe but not emit.

Event type additions require the owning team's approval. Event schema changes require a versioned migration (same as interface contracts above).

### 4.3 Shared Artifact Governance

Some artifacts are owned jointly and require coordinated change governance:

| Artifact | Joint Owners |
|---|---|
| Corpus packet schema | PRE Engine Team + Verification Team |
| Mandatory simulation scenario list | Verification Team + constitutional governance |
| Design token semantic layer | Operator Experience Team + constitutional governance |
| State machine transition tables | State Authority Team + constitutional governance |
| CI gate configuration | Platform Reliability Team + constitutional governance |

Joint ownership means changes require explicit approval from both owners. Neither owner can unilaterally modify a joint artifact.

---

## 5. REVIEW ESCALATION PATHS

### 5.1 Standard Review Path

Author → Peer review (same team) → Owning team approval (if cross-surface) → CI gate → Merge.

### 5.2 Escalation Triggers

A change escalates above the standard path when:
- The change modifies a joint artifact
- The change is identified as touching a constitutional invariant
- The owning team's review is inconclusive (not a veto, but unresolved questions)
- The change is proposed during a freeze period
- The change is classified as "reversing a constitutional constraint"

Escalated changes go to the constitutional governance function before merging.

### 5.3 Mandatory Escalation: Replay-Affecting Changes

Any change that could affect replay determinism or replay parity is mandatory-escalated to the Verification Team for review, regardless of which team authored it. This includes:
- GovernedClock modifications
- Corpus schema changes
- State machine transition changes
- PRE resolution algorithm changes
- Any component in the replay-bound rendering path

### 5.4 Dispute Resolution

When two teams disagree on whether a change is constitutional:
1. Both teams document their position in the pull request
2. The constitutional governance function reviews and decides
3. The decision is documented as a constitutional note on the pull request
4. If the decision involves a novel constitutional question, the relevant doctrine document is updated

Disputes are never resolved by delivery pressure. "We need to ship this" is not a constitutional argument.

---

## 6. IMPLEMENTATION FREEZE AUTHORITY

### 6.1 Who Can Declare a Freeze

| Freeze Scope | Declarable By |
|---|---|
| Full implementation freeze (no merges) | Constitutional governance function |
| Surface-specific freeze (one team's surface) | That surface's owning team |
| Replay system freeze | Verification Team or State Authority Team |
| Deployment freeze | Platform Reliability Team |

### 6.2 Freeze Triggers

A freeze is declared when:
- A replay mismatch is detected in the corpus (all development halts until root cause is identified)
- A dangerous partial implementation state is detected in a deployment candidate
- A CI gate is found to be incorrectly passing changes it should have blocked
- A constitutional document is being updated (freeze until the update is complete and all teams have reviewed)
- A production incident is active at severity level 3+ (no deployments during active containment)

### 6.3 Freeze Lifting

Freezes are lifted by the same authority that declared them, after the triggering condition is resolved and documented. Freezes do not expire automatically. "We've been frozen long enough" is not a lifting condition.

---

## 7. DELIVERY-VS-INTEGRITY CONFLICT RESOLUTION

This is the most important governance mechanism in this document. Delivery pressure is real. It is not dismissed. But it does not override constitutional constraints.

### 7.1 The Conflict Taxonomy

When delivery and integrity conflict, the conflict is classified:

**Class 1: Deferred Feature**
A feature not yet implemented is requested earlier than the implementation plan allows. Resolution: negotiate the delivery date, not the implementation order. Deferrable components (per `REFERENCE-IMPLEMENTATION-STRATEGY-v1.md` Section 2.2) may be deferred further. Non-deferrable components are not moved earlier by removing gate dependencies.

**Class 2: Shortcut Pressure**
A constitutional requirement is identified as the blocking factor on delivery. Pressure to skip or simplify it. Resolution: the constitutional governance function reviews the requirement. If it is genuinely misapplied, it can be narrowed through a documented constitutional decision. If it is correctly applied, it holds. Delivery schedule is adjusted.

**Class 3: Dangerous Partial State**
A deployment is proposed that would put the system in one of the dangerous partial implementation states. Resolution: the deployment does not proceed. The question of how to deliver the missing gate component faster is the engineering challenge, not the question of whether to deploy without it.

**Class 4: Post-Hoc Rationalization**
A shortcut has already been taken and is being rationalized as acceptable. This is the most dangerous class because it is discovered after the fact. Resolution: the shortcut is treated as a defect, entered into the architectural debt registry (Section 7.2), and a remediation plan is required before the affected surface can be extended.

### 7.2 The Architectural Debt Registry

Architectural debt is not a metaphor. It is a ledger. Each entry:

```typescript
interface ArchitecturalDebtEntry {
  id: string;                    // sequential identifier
  discoveredAt: string;          // ISO8601
  surface: string;               // which constitutional surface
  description: string;           // what the deviation is
  constitutionalViolation: string; // which constitutional requirement is violated
  blastRadius: string;           // what other components depend on this deviation
  remediationPlan: string;       // how it will be fixed
  remediationDeadline: string;   // ISO8601 — must not be open-ended
  owner: string;                 // team responsible for remediation
  blockedDeployments: string[];  // which deployments cannot proceed until remediated
}
```

The debt registry is visible to all teams. It is reviewed at every checkpoint. Entries without remediation plans or with missed deadlines trigger a freeze on the affected surface.

---

## 8. CONTRIBUTOR ONBOARDING REQUIREMENTS

### 8.1 Required Reading Before First Contribution

Every engineering contributor to the ClubHub TV implementation must complete the following before making any pull request:

1. `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md` — transition legality, authority hierarchy, replay safety
2. `COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md` — dependency directions, boundary rules
3. `DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1.md` — constitutional workflow, anti-patterns
4. This document — team boundaries, authority model, escalation paths

Reading is verified through a brief structured conversation with a constitutional governance reviewer. This is not a quiz. It is a conversation to surface misunderstandings before they become pull requests.

### 8.2 Surface-Specific Onboarding

Contributors to specific surfaces read the additional canonical documents for that surface. A contributor to the Perceptual Layer surface reads all four perceptual governance documents. A contributor to the PRE Engine reads the PRE implementation documents.

Surface-specific onboarding is completed before a contributor makes their first pull request to that surface, even if they have prior experience on other surfaces.

### 8.3 Simulation Harness Orientation

Every contributor, regardless of surface, completes:
- Running the full mandatory simulation scenario suite locally
- Reading the output and understanding what each scenario verifies
- Running the replay parity suite and verifying the hash consistency output

This orientation ensures that every contributor understands the verification system they are building for, not just the component they are building.

---

## 9. ANTI-HERO-ENGINEERING SAFEGUARDS

Hero engineering — one person making large, undiscussed architectural decisions under delivery pressure — is the primary vector through which constitutional constraints are silently eroded.

### 9.1 Observable Hero Patterns

| Pattern | Indicator |
|---|---|
| Large pull requests touching multiple surfaces | >500 lines changed across >3 constitutional surfaces |
| Bypassing owning team review | Pull request merged without the owning team's approval |
| "I'll fix the tests later" commits | Tests removed or disabled in the same commit as new implementation |
| Working outside normal review channels | Changes committed directly to main or through alternative merge paths |
| Constitutional re-interpretation in code comments | Comments that explain why a requirement doesn't apply in this specific case, without a governance decision |

### 9.2 Structural Safeguards

**Branch protection:** The main branch requires at least two approvals. One approval must be from the owning team for the primary surface touched. CI must pass.

**Large PR policy:** Pull requests modifying more than 3 constitutional surfaces require a constitutional governance review before merge, regardless of approvals received.

**No-disable policy:** Test removal or disabling in a pull request that also modifies implementation is automatically flagged for verification team review.

**Constitutional comment policy:** Code comments that explain why a constitutional requirement is not being met are automatically flagged. Every such comment requires a linked architectural debt entry.

### 9.3 The Brilliance Trap

Hero engineering is often associated with genuinely brilliant engineers who can see a faster path and take it. The trap is that the faster path they see is faster within their own mental model — which may not account for the constitutional constraints that other teams depend on.

The safeguard is not to prevent brilliant engineers from contributing — it is to ensure their contributions are visible, reviewable, and constitutional. Brilliance in implementation that respects constitutional boundaries is exactly what the architecture needs. Brilliance that quietly overrides them is the threat.

---

*Document status: CANONICAL — System Materialization Era*
*Do not modify without constitutional governance review*
