# IMPLEMENTATION DRIFT AND ARCHITECTURAL DECAY PREVENTION v1

**Era:** System Materialization
**Status:** CANONICAL
**Scope:** Drift mechanisms, detection during development, workaround governance, debt classification, replay mismatch escalation, mythology prevention, audit cadence, long-term survivability

---

## 1. PURPOSE

Architectural decay does not require malice. It does not require incompetence. It requires only time, delivery pressure, and the absence of mechanisms that make decay visible.

Every large codebase that was once well-architected and later became unmaintainable followed the same path: small, individually reasonable deviations that accumulated into a system whose behavior could no longer be understood by reading its architecture documents.

The ClubHub TV architecture is not immune to this. The 70+ document corpus defines constitutional law. But law without enforcement degrades into custom. Custom without memory degrades into mythology. Mythology without correction degrades into a system that no one fully understands.

This document defines the mechanisms that keep implementation aligned to architecture across time — specifically including the time after the original architects are no longer in the room.

---

## 2. HOW IMPLEMENTATION SLOWLY DIVERGES FROM DOCTRINE

Drift is not a single event. It is a process. Understanding the process is the first step toward interrupting it.

### 2.1 The Drift Mechanism

**Phase 1: The Justified Exception**
A constitutional requirement creates friction for a specific implementation task. The engineer finds a way to work around it that is locally correct but globally inconsistent. They document the exception in a code comment or a PR description. The exception is reviewed and approved under time pressure without full consideration of its systemic implications.

**Phase 2: The Template**
A later engineer encounters the same friction. They find the prior exception in the codebase and use it as a template. They do not re-litigate the exception — it was approved before. The exception propagates.

**Phase 3: The Assumption**
The exception is now present in multiple places. New engineers see it and assume it is the intended pattern. They do not know it was an exception. They build new components using it as a reference.

**Phase 4: The Inversion**
The exception is now more prevalent than the constitutional requirement it was an exception to. A new engineer reads the codebase to understand the pattern and concludes that the constitutional document is wrong — the codebase is the real specification.

**Phase 5: The Diverged System**
The system's behavior diverges from its constitutional specification. Operators experience inconsistencies that cannot be explained by the architecture documents. Replay behavior becomes unreliable. The team loses the ability to reason about system behavior from first principles.

### 2.2 Drift Accelerants

| Accelerant | How It Amplifies Drift |
|---|---|
| High team turnover | Context loss between phases 1–2 of drift mechanism |
| Long-lived feature branches | Changes accumulate without integration-time drift detection |
| Insufficient CI coverage | Drift that doesn't break tests goes undetected |
| Weak review culture | Exceptions approved without systemic consideration |
| Architecture documents that are hard to find or read | Engineers reference codebase instead of doctrine |
| No architectural debt registry | Exceptions are invisible; cannot be tracked or remediated |
| Performance optimization pressure | Optimizations often bypass abstractions that enforce constitutional behavior |
| "We'll refactor it later" culture | Later never comes; the exception becomes the architecture |

---

## 3. DRIFT DETECTION DURING ACTIVE DEVELOPMENT

Drift is most efficiently caught at the moment it is introduced. The cost of correction grows exponentially with time since introduction.

### 3.1 Automated Drift Detection

The CI pipeline enforces the following drift detection checks on every pull request:

**Check 1: Component Boundary Integrity**
Verifies that no illegal dependency directions exist (per `COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md`). Every upward dependency, every cross-surface dependency, every production-to-simulation dependency is flagged.

**Check 2: GovernedClock Leakage**
Static analysis detects any use of `Date.now()`, `new Date()`, `performance.now()`, or any platform clock API in the replay path or state machine code. Violations block merge.

**Check 3: PRE Boundary Bypass Detection**
Static analysis detects any component outside the designated PRE-Boundary component that consumes PRE resolution data from a state or context directly. Violations block merge.

**Check 4: Observability Emission Coverage**
The integration test verifies that every state transition in the state machine runtime emits to the observability sink. New transitions that do not emit are detected and block merge.

**Check 5: State Machine Transition Legality**
The transition guard tests verify that no transition in the implementation differs from the transition table in the architecture documents. A new transition that is not in the table blocks merge. A transition that the implementation allows but the table prohibits blocks merge.

**Check 6: Token Layer Compliance**
The token audit verifies that no component consumes Layer 1 primitive values directly and that no context token references a Layer 1 value. Violations block merge.

**Check 7: Test Integrity**
Verifies that the mandatory simulation scenario list has not been reduced, that no simulation test has been disabled without a linked architectural debt entry, and that the replay parity suite has not been modified to reduce iteration count.

**Check 8: Simulation Component Isolation**
The bundle analyzer verifies that no simulation harness component is present in the production bundle.

### 3.2 Pull Request Drift Signals

Beyond automated checks, reviewers look for manual drift signals in pull requests:

| Signal | Drift Risk |
|---|---|
| "This is a temporary workaround" in PR description | Phase 1 of drift mechanism — requires workaround governance process |
| Code comment explaining why a constitutional requirement doesn't apply here | Potential Phase 2 — requires architectural debt entry |
| New `// eslint-disable` on a constitutional linting rule | Immediate flag for owning team review |
| Test file that uses `skip` or `only` that was not present before | Check integrity gate may be being circumvented |
| Large refactor that touches multiple constitutional surfaces without a design document | High architectural risk regardless of intent |
| Performance optimization in a state machine transition function | Risk of non-determinism introduction |

---

## 4. TEMPORARY WORKAROUND GOVERNANCE

Temporary workarounds are the primary seed of drift. They must be governed with the same rigor as permanent architectural decisions, because they often become permanent.

### 4.1 Workaround Classification

Every workaround is classified at introduction:

**Class W1: Local Workaround**
Affects only a single component, does not touch any constitutional boundary, has no replay implications. The simplest class — fix can be deferred briefly.

**Class W2: Surface Workaround**
Affects one constitutional surface, may be seen by other components in the same surface. Requires owning team awareness.

**Class W3: Boundary Workaround**
Affects a constitutional boundary (PRE boundary, component category boundary, team interface contract). Requires cross-team awareness and an architectural debt entry.

**Class W4: Determinism Workaround**
Any workaround that touches the replay path, GovernedClock usage, state machine transitions, or PRE resolution. These have the highest risk of invisible breakage. Requires Verification Team review and a replay parity test run before merge.

**Class W5: Constitutional Violation**
A workaround that directly violates a constitutional requirement. These do NOT receive "temporary" status. They are architectural defects. They either block the affected functionality from shipping, or they require a constitutional governance decision to document the deviation as intentional and time-bounded.

### 4.2 Workaround Registration Requirements

Every workaround of class W2 or above requires:
1. An architectural debt entry (ID, surface, description, violation, blast radius, remediation plan, deadline)
2. A code annotation referencing the debt entry ID: `// ARCH-DEBT: AD-042 — temporary until PRE boundary v2`
3. A linked expiry: a pull request or ticket that will remediate the workaround, with a due date
4. Owner assignment: the team responsible for remediation

### 4.3 Workaround Expiry Enforcement

The CI pipeline maintains a registry of all workaround expiry dates. When an expiry date passes:
- The affected surface enters a partial freeze: no new features may be added until the workaround is remediated
- The debt entry is escalated to the owning team and the constitutional governance function
- The expiry is reported in the weekly architectural health report

Workaround expiry enforcement is automated. It does not depend on anyone remembering.

---

## 5. ARCHITECTURAL DEBT CLASSIFICATION

Not all architectural debt carries the same risk. Classification determines how urgently debt is prioritized.

### 5.1 Debt Risk Classifications

**CRITICAL Debt**
Debt that creates a silent determinism violation, a replay parity risk, or a dangerous misunderstanding risk for operators. Must be remediated before any new features are added to the affected surface. No time extensions.

Examples: GovernedClock bypass in replay path, PRE boundary bypass, state transition without observability emission.

**HIGH Debt**
Debt that violates a constitutional requirement but does not immediately produce determinism or safety failures. Must be remediated within 30 days or the affected surface enters a feature freeze.

Examples: Illegal component dependency direction, context token referencing Layer 1 primitive directly, upward component dependency.

**MEDIUM Debt**
Debt that represents an architectural inconsistency without immediate constitutional violation. Must be remediated within 90 days.

Examples: Hardcoded timeout that should reference a governance-controlled constant, event type without explicit ownership annotation, workaround without a linked remediation ticket.

**LOW Debt**
Debt that represents a departure from best practice without constitutional implication. Must be remediated within the next major refactoring cycle.

### 5.2 Debt Accumulation Ceiling

The total architectural debt load is monitored:
- CRITICAL debt: maximum 0 items. One CRITICAL debt item blocks all non-remediation work on the affected surface.
- HIGH debt: maximum 3 items across the entire codebase. Beyond this, all new feature work pauses until HIGH debt falls below 3.
- MEDIUM debt: maximum 10 items. Tracked but does not block new features.
- LOW debt: tracked, reviewed at quarterly audit, remediated opportunistically.

These ceilings are enforced. They are not aspirational.

---

## 6. REPLAY MISMATCH ESCALATION

Replay mismatch is the single highest-severity architectural decay signal. It indicates that the system's behavior has diverged in a way that is invisible during normal operation but breaks the foundational guarantee: that the system can always tell you exactly what it was doing and why.

### 6.1 Mismatch Severity Classification

| Mismatch Type | Severity | Response |
|---|---|---|
| Corpus packet produces different determinism hash | CRITICAL | Immediate implementation freeze; all hands investigation |
| State machine replayFromHistory() produces different final state | CRITICAL | Immediate implementation freeze |
| Explanation payload hash mismatch in replay | HIGH | Surface-specific freeze; Verification Team investigation within 24h |
| Rendering timing divergence (no hash change) | MEDIUM | Logged and monitored; investigation within 72h |
| Observability event count mismatch | MEDIUM | Observability team investigation within 48h |

### 6.2 Mismatch Investigation Protocol

For CRITICAL mismatches:
1. Freeze is declared immediately
2. The commit that introduced the mismatch is identified via binary search through recent commits
3. The root cause is classified: GovernedClock leak, state machine deviation, PRE resolution change, or corpus schema change
4. The fix is implemented and the full corpus round-trip is re-run before the freeze is lifted
5. An architectural debt entry is created documenting the mismatch, its cause, and the fix
6. The root cause is added to the drift detection suite as a new automated check

CRITICAL mismatch investigations are never closed with "we couldn't identify the cause." The investigation continues until the cause is known.

### 6.3 Mismatch as Canary

Replay mismatches are often the first visible symptom of drift that has been accumulating invisibly. When a mismatch is found, the investigation should not stop at identifying the immediate cause — it should ask: what other components may have the same underlying issue that has not yet produced a mismatch? The investigation scope expands to include the full surface, not just the specific component where the mismatch manifested.

---

## 7. IMPLEMENTATION MYTHOLOGY PREVENTION

Implementation mythology — informal beliefs about system behavior that are not grounded in the architecture — is a late-stage drift symptom. Once mythology is established, it is harder to correct than a code defect, because it lives in people's heads.

### 7.1 Mythology in Engineering Teams

Engineering team mythology differs from operator mythology (addressed in `HUMAN-SYSTEM-FEEDBACK-LOOP-v1.md`). Engineer myths often concern:
- "The state machine handles X automatically" (it doesn't — a workaround does, temporarily)
- "You can skip the PRE boundary if you're just reading, not writing" (you cannot)
- "GovernedClock doesn't matter for this component because it never replays" (it does matter — all components must be consistently stamped)
- "The corpus only needs to be updated when we add new content types" (it must be updated when any resolution behavior changes)

### 7.2 Mythology Prevention Mechanisms

**The Architecture-As-Spec Rule:** The canonical documents are the specification. When there is a discrepancy between the codebase and the documents, the documents are authoritative. Engineers who encounter discrepancies report them — they do not conclude that the documents are wrong.

**The Explanation Requirement:** Code comments that explain a design decision must reference the canonical document that motivated it. This creates a link between implementation and specification that prevents orphaned decisions from becoming myths.

**The Onboarding Reality Check:** Part of contributor onboarding (per `TEAM-TOPOLOGY-AND-EXECUTION-GOVERNANCE-v1.md`) is identifying a "this doesn't match" — a place where the codebase appears to conflict with the canonical documents. Every new engineer finds one. Either the document needs updating, or the code has a bug. Both outcomes are valuable.

**The Myth Registry:** When a myth is identified in the engineering team (via the "unexpected behavior" pattern in post-incident reviews, or via incorrect explanations given during code reviews), it is added to a myth registry and corrected at the next team knowledge-sharing session. The registry is cleared when the myth is corrected.

---

## 8. AUDIT CADENCE DURING THE BUILD ERA

### 8.1 Continuous Audit (Every Commit)

- All 8 automated drift detection checks (Section 3.1)
- Architectural debt expiry check
- Bundle purity check

### 8.2 Weekly Audit

- Architectural health report: CRITICAL/HIGH/MEDIUM/LOW debt counts
- Mismatch detection rate from shadow deployment
- Workaround expiry calendar (upcoming expirations in next 30 days)
- Component dependency graph regeneration and anomaly scan

### 8.3 Monthly Audit

- Full document corpus review: are the canonical documents up-to-date with implementation?
- Confusion event aggregation review (per `HUMAN-SYSTEM-FEEDBACK-LOOP-v1.md`)
- Drift signal review: patterns from PR reviews over the past month
- Onboarding experience review: what did new contributors find confusing?

### 8.4 Quarterly Audit

- Full architectural alignment review: is the codebase's behavior consistent with every canonical document?
- Myth registry clearance: what myths were identified and corrected?
- Certification scenario corpus update: are the scenarios still capturing the right failure modes?
- Debt remediation progress: are MEDIUM and LOW debt items being addressed?
- Team topology review: are team boundaries still aligned to constitutional surfaces?

### 8.5 Annual Audit

- Full canonical document review: do the documents still accurately describe the intended system?
- Implementation has revealed new constitutional questions — are they documented?
- Are there new failure modes that have been encountered in production but not yet captured in the training corpus?
- Has the architecture evolved informally in ways that should be formalized?
- Personnel continuity review: is constitutional knowledge spread across enough people to survive turnover?

---

## 9. LONG-TERM SURVIVABILITY AFTER ORIGINAL ARCHITECTS LEAVE

Every system eventually operates without the people who designed it. This is not a failure — it is success. But it requires deliberate preparation.

### 9.1 The Knowledge Concentration Risk

If constitutional knowledge is concentrated in two or three people, the architecture is one departure away from becoming a mystery. Teams will continue to extend the system, but they will be extending it in ways that contradict its constitutional foundations — not out of malice, but out of ignorance.

### 9.2 Knowledge Distribution Requirements

The following knowledge must exist in documented form, not only in people's memories:
- Why each constitutional requirement exists (the operational failure it prevents)
- Where each constitutional requirement is enforced (which CI check, which review gate)
- What the consequences are of violating each constitutional requirement
- Historical record of every constitutional decision (PR history, architectural decision records)

The "why" is specifically important. A team that knows "you must not use Date.now() in replay code" but not "because it breaks determinism, which makes replay produce different results than live, which breaks operator trust in the historical record" will violate the requirement the moment it creates friction, because they don't understand what they're preserving.

### 9.3 Architectural Decision Records

Every non-obvious architectural decision is documented as an Architectural Decision Record (ADR):

```
ADR-NNN: [Title]
Date: [ISO8601]
Status: Accepted | Deprecated | Superseded by ADR-NNN
Context: What situation prompted this decision?
Decision: What was decided?
Consequences: What are the implications? What is now easier? What is now harder?
Constitutional Grounding: Which canonical document motivated or constrains this decision?
```

ADRs are the institutional memory of architectural decisions. When an original architect leaves, the ADR for their most important decisions captures their reasoning. New engineers can read the ADR and understand why the system is the way it is.

### 9.4 The Constitution Is The Primary Document

Long after the original architects have left, the canonical documents are the primary reference for system behavior. This requires that the documents be maintained — kept accurate as the system evolves, extended as new constitutional questions arise, and deprecated gracefully when constitutional requirements change.

Document maintenance is a first-class engineering responsibility. Updating a canonical document when the implementation changes is not optional documentation work — it is a constitutional obligation.

### 9.5 Constitutional Succession

When the person holding the constitutional governance function is leaving the organization:
- A successor is identified and a 90-day handover period begins
- The successor shadows all constitutional governance decisions during the handover period
- The outgoing governance holder documents their decision-making framework — specifically, the cases where the canonical documents were insufficient and judgment was required
- The successor completes the constitutional governance role orientation, which includes reading every canonical document and every ADR

Constitutional governance authority transfers formally at the end of the handover period. There is no interim period without a designated constitutional governance function.

### 9.6 The "Would A New Engineer Understand This?" Test

For any piece of implementation code, the long-term survivability test is: could a new engineer, having read the canonical documents but with no other context, understand why this code is written the way it is?

If the answer is no, the code needs either:
- A code comment referencing the relevant canonical document and explaining the specific constraint being implemented
- An ADR documenting the decision
- Or both

This test is not applied at review time for every line of code. It is applied during monthly audits, and whenever a new engineer reports confusion about why something is implemented the way it is. Their confusion is a signal that the knowledge has not been sufficiently externalized.

---

## 10. THE FINAL SAFEGUARD: REPLAY AS TRUTH

The ultimate safeguard against architectural decay is the system's own replay capability. If the system can always replay any historical operation and produce an identical result, the architecture is intact. If replay diverges, the architecture has decayed.

Replay is not just an operator feature. It is the system's self-consistency check. The corpus is not just a training resource. It is the test suite that grows over time as the system accumulates operational history.

A system that maintains replay correctness across its operational lifetime is a system whose architecture has survived contact with reality.

That is the goal.

---

*Document status: CANONICAL — System Materialization Era*
*Do not modify without constitutional governance review*
