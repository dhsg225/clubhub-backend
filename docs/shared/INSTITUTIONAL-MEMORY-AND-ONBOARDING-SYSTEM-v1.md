# ClubHub TV — Institutional Memory and Onboarding System
# Shared Operational Intelligence Layer — Phase E: Operational Implementation Governance System

**Document type:** Cross-agent architectural governance — institutional memory architecture and operator onboarding system
**Authority:** SHARED DECISION ZONE — Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering); Agent 1 defines system truth lineage constraints
**Audience:** All contributors; operator training; platform architects; new team members
**Last updated:** 2026-05-25
**Status:** CANONICAL — institutional memory obligations defined here are operational infrastructure, not documentation policy
**Phase:** E — Operational Implementation Governance System (cross-agent shared decision zone)

---

## Purpose

This document defines how ClubHub TV preserves and transmits the knowledge that makes it operationally survivable across team turnover, organizational change, and the passage of time.

The threat this document addresses: **knowledge decay under operational continuity.** Systems that have been running for years often operate on the accumulated tacit knowledge of whoever built them. This knowledge lives in people, not in systems. When those people leave, the knowledge leaves with them. What remains is a system that works — until it doesn't — and a team that cannot explain why it works the way it does.

ClubHub TV is designed to be operated by people who may not have been involved in building it. Its constraints were derived from real operational failures. Its governance rules exist for specific reasons. Its design decisions represent deliberate tradeoffs. If future operators and contributors cannot access the reasoning behind these decisions, they will reverse them — not maliciously, but because the constraints will appear arbitrary without the context that makes them necessary.

**The governing principle: memory is operational infrastructure, not documentation.** The knowledge of why this system works the way it does is as critical to operational reliability as the code that implements it. Memory decay is an operational risk. Memory preservation is a technical requirement.

---

## Section 1 — Memory Philosophy

### 1.1 Systems Are Only Stable If Explainable to Newcomers

A system that only its creators can operate is fragile. Every time someone who built it leaves, a piece of operational resilience leaves with them. The test of a well-documented system is not whether current team members can operate it — it is whether someone new to the system, working only from the documentation, can operate it correctly.

**The newcomer test:** For any significant operational decision, a newcomer who reads the relevant documentation must be able to answer:
1. What does this system do in this situation?
2. Why does it do it this way and not another way?
3. What would happen if this constraint were relaxed?
4. Where can I verify my understanding?

If any of these cannot be answered from documentation alone, the documentation is incomplete as operational infrastructure.

### 1.2 Memory Is Operational Infrastructure

Documentation that exists to satisfy a compliance requirement is not memory. Memory, in the sense of this document, is the encoded reasoning that allows the system to be operated correctly by people who were not present when its rules were established.

**Memory as infrastructure means:**
- Memory has availability requirements: it must be accessible when it is needed, not only when it is convenient to produce
- Memory has integrity requirements: it must accurately represent the actual system behavior and the actual reasons behind it
- Memory has currency requirements: it must reflect the current system, not a historical version that has since changed
- Memory failure — inaccurate, unavailable, or outdated documentation — is an operational incident, not a documentation backlog item

### 1.3 Agent 1 — System Truth Lineage Constraints

Agent 1 defines the constraints on how system truth is transmitted through institutional memory:

- Every documented constraint that relates to PRE behavior must reference the specific PRE property it protects
- The lineage from operational failure to the constraint that prevents it must be preserved: why this constraint exists, what failure it prevents, what would happen without it
- Historical replay must remain available as truth verification: a newcomer must be able to verify any documented behavior claim by running a replay, not only by reading documentation
- Constraints derived from the deterministic properties of the PRE must be documented as PRE-derived, so future contributors understand they cannot be relaxed without re-evaluating PRE determinism

---

## Section 2 — Onboarding System

### 2.1 Operator Onboarding Sequence

The onboarding sequence is ordered by the operational concepts an operator must understand before they can be trusted to take consequential actions. It is not ordered by seniority, task familiarity, or organizational convenience.

**Stage 1 — System orientation (before any live access):**
1. What this system resolves: the PRE, its authority, what it computes, why it is deterministic
2. What operators can do: the intervention types, their authority levels, their consequences
3. What replay is: not just how to use it, but why it exists and what it makes possible
4. What the failure modes look like: what degraded state looks and behaves like, how to recognize it

**Stage 2 — Supervised live observation (read access, no intervention authority):**
- Observe a complete operational session with a trained operator
- Watch at least one escalation event, end-to-end
- Watch at least one override creation, including the preview step
- Identify every state badge currently visible and explain what each means

**Stage 3 — Supervised replay investigation (replay access, no live intervention authority):**
- Navigate the replay corpus to find a historical event
- Explain the causal sequence of events at a specific historical moment
- Use the explainability surfaces to answer: what played, why, what overrides were active, who authorized them
- Complete at least one failure-story replay (see Section 2.3)

**Stage 4 — Guided intervention (live access, supervised):**
- Complete an override creation flow with a supervisor present
- Complete an emergency activation in a training environment
- Respond to a simulated degraded state scenario

**Stage 5 — Independent operation (full access, unsupervised):**
- Access granted only after Stage 4 sign-off by a certified supervisor
- First 30 days: all consequential actions logged and reviewed in the following shift debrief

### 2.2 Replay-First Learning Model

The most important decision in the onboarding system is this: operators learn operational concepts by observing them in historical replay before they encounter them in live operations.

**Why replay-first:**
- Live operations move at operational pace — a new operator has no time to stop and understand what they are seeing
- Replay is controllable — operators can pause, rewind, inspect at depth, and ask questions without operational consequence
- The failure stories that justify the platform's constraints are historical events — they can only be shown in replay, not in live operations
- An operator who has seen a constraint violated in replay understands why it exists in a way that reading a rule document does not produce

**Replay-first requirements:**
- Every canonical interaction flow (INTERACTION-SEQUENCING-SPEC.md IF-01 through IF-07) must have at least one corpus entry that demonstrates the complete flow
- Every canonical failure mode in the governance documents must have at least one corpus entry that demonstrates the failure and its consequences
- Every degraded state (FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md DS-01 through DS-06) must have at least one corpus entry that demonstrates the degraded state and the recovery

### 2.3 Failure-Story-Driven Education

Every significant constraint in the governance corpus exists because something went wrong or was anticipated to go wrong. Those failure stories are the most powerful educational tool available.

**Failure story structure:**
- **What happened (or would have happened):** The operational event or projected failure scenario
- **Why it was dangerous:** What the operator saw, what action they took or would have taken, why that was wrong
- **What the system does now to prevent it:** The specific constraint, check, or governance rule
- **How to verify it:** The replay entry or test case that demonstrates the protection in action

**Failure stories are linked to governance rules.** When a newcomer reads a constraint and asks "why does this exist?", the answer must be accessible: a corpus entry, a historical incident record, or a formal failure mode analysis. The answer "because the spec says so" is not acceptable.

### 2.4 Progressive Responsibility Unlocking

Authority to take consequential operational actions is unlocked progressively:

| Responsibility level | Minimum prerequisite |
|---|---|
| Read-only observation | Stage 1 complete |
| Replay investigation | Stage 2 complete |
| Supervised live intervention | Stage 3 complete + supervisor designation |
| Unsupervised live intervention | Stage 4 sign-off + 30-day supervised period |
| Emergency activation authority | Emergency certification (90-second standard from REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md) |
| Override scope expansion (multi-venue, fleet-wide) | Advanced certification + demonstrated single-venue competency |

**Responsibility unlocking is not time-based.** A competency check, not a calendar period, gates each transition. An operator may complete Stage 1–3 in three days or three weeks depending on pace — the prerequisite is demonstrated understanding, not elapsed time.

---

## Section 3 — Institutional Memory Model

### 3.1 Why Decisions Were Made (Not Just What)

The governance corpus documents what the system does. The institutional memory model adds why it does it.

**Every significant constraint must have documented:**
- The operational failure or failure scenario that motivated it
- The alternative approaches that were considered and rejected, with the reasons for rejection
- The tradeoffs that were accepted: what was given up to gain this constraint
- The conditions under which this constraint might need to be revisited (if any)

**Decision lineage preservation:** When a constraint is modified through the formal change governance process (CONSTITUTIONAL-CHANGE-GOVERNANCE-v1.md), the modification record must include the above information for the new decision. The record of the original decision is preserved, not replaced — so future contributors can understand both the history and the evolution.

### 3.2 Replay-Linked Knowledge

Institutional knowledge that can be demonstrated in replay must be replay-linked:

- Every failure story has a corpus entry reference
- Every canonical interaction flow demonstration has a corpus entry reference
- Every degraded state demonstration has a corpus entry reference
- When the corpus entry is referenced in documentation, the reference is machine-verifiable: the corpus entry must exist and must demonstrate what the reference claims

**Replay-linked knowledge does not decay.** A reference to a replay corpus entry is not a reference to a specific person's memory of an event — it is a reference to a deterministic, reproducible piece of operational history. It remains accurate even as the team changes.

### 3.3 Historical Constraint Traceability

Every constraint in the governance corpus must be traceable to its source:

- **Operational failure source:** Constraint derives from a real operational incident — referenced by incident record
- **Projected failure source:** Constraint derives from a formal failure mode analysis — referenced by the analysis document
- **Architectural principle source:** Constraint derives from a foundational architectural decision — referenced by the relevant governance document with rationale

**Traceability prevents two failure modes:**
1. Future contributors relaxing a constraint without understanding what it prevents
2. Future contributors maintaining a constraint that is no longer necessary because the underlying concern was resolved

A constraint whose source cannot be traced cannot be correctly evaluated for modification. Untraceable constraints become cargo-cult rules: everyone follows them, no one knows why, and they are never reviewed.

---

## Section 4 — Knowledge Decay Prevention

### 4.1 Re-Validation Cycles

Institutional memory decays unless it is periodically re-validated against the current system:

- **Quarterly documentation review:** Each governance document is reviewed for accuracy against current system behavior. Divergences are resolved either by updating the document (if behavior changed through an approved process) or by correcting the system (if behavior drifted).
- **Annual corpus review:** The onboarding corpus is reviewed for completeness. Failure stories are verified: do the corpus entries still demonstrate what the documentation claims? Are there new failure modes that require new corpus entries?
- **Onboarding effectiveness review:** After each new operator completes onboarding, they are surveyed: what was unclear? what required additional explanation that the documentation did not provide? Survey findings are routed to documentation improvements.

### 4.2 Forgotten Constraint Detection

A constraint is "forgotten" when the team that maintains the system no longer knows why it exists. Forgotten constraints are dangerous in both directions: they may be unnecessarily maintained (adding cost without value) or they may be relaxed (removing protection without awareness of the risk).

**Forgotten constraint detection:**
- When a constraint is challenged ("why do we do this?"), if no team member can provide the rationale from memory and no documentation provides the rationale, the constraint is designated forgotten
- Forgotten constraints trigger an investigation: is there a traceable source (Section 3.3)? If yes, the documentation must be updated to make the source explicit. If no source can be found, the constraint is submitted for formal review — to either be re-justified or removed
- Forgotten constraints may not be silently maintained (no rationale, no review) or silently removed (no rationale, no documentation)

### 4.3 Outdated Assumption Surfacing

Constraints that were correct when established may become incorrect as the system evolves. The institutional memory system must surface these:

- When a system component changes significantly, a review must check whether any constraints that reference that component are still correctly calibrated
- When an operator reports behavior that the constraints were designed to prevent occurring anyway (the constraint is not working), this is surfaced as a constraint effectiveness signal
- The annual corpus review (Section 4.1) includes a check for constraints whose underlying failure mode no longer exists in the current system architecture

### 4.4 Onboarding Drift Correction

As the system evolves, the onboarding sequence may drift from the actual operational reality:

- When a new interaction flow is added (INTERACTION-SEQUENCING-SPEC.md), the onboarding sequence must be updated to include it
- When a new degraded state is added (FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md), the onboarding corpus must be updated to include a demonstration
- When a Stage 4 supervisor certifies an operator who then has difficulty in independent operation, the onboarding sequence that produced that certification must be reviewed

**Onboarding drift is a drift signal (OPERATIONAL-DRIFT-DETECTION-AND-PREVENTION-v1.md DT-05).** An operator who completes onboarding and then cannot operate the system correctly signals a mismatch between the onboarding sequence and the actual system. This mismatch is investigated and remediated.

---

## Section 5 — Failure Modes

### Failure Mode IM-01: Folklore-Based Operations

**What it is:** Operators develop informal explanations for system behavior that are partially correct, partially incorrect, and not verifiable from the documentation. These explanations are transmitted to new operators through verbal instruction and shadowing. Over time, the informal explanations diverge further from the actual system behavior. Operators who follow the folklore make decisions based on incorrect mental models.

**Example:** "The system always prioritizes the most recent override" — an informal rule that is partially correct for some override types and incorrect for others, but which gets transmitted as a universal truth.

**Prevention:** Replay-linked knowledge (Section 3.2) and replay-first learning (Section 2.2). An operator who can verify any behavioral claim in replay does not need folklore. When an informal explanation is offered, the correct response is: "let's verify that in replay."

---

### Failure Mode IM-02: Undocumented Tribal Knowledge

**What it is:** Critical operational knowledge exists only in the memory of specific team members who have worked on the system long enough to accumulate it. This knowledge is not transmitted to new team members unless those members have direct access to the veterans. When veterans leave, the knowledge leaves.

**Examples:** "There's a known edge case with that venue configuration that requires a specific recovery procedure" — known only to the senior operator who dealt with it three times; never documented.

**Prevention:** Incident records linked to recovery procedures. Every time an undocumented edge case is encountered, the institutional memory system requires it to be documented before the incident is closed. "We handled it" is not an acceptable incident close state; "we handled it and documented the procedure" is.

---

### Failure Mode IM-03: Onboarding Shortcut Culture

**What it is:** Under operational pressure, the onboarding sequence is shortened. Operators are granted live access before completing replay-first learning. Emergency certification is skipped because the need is immediate. The progressive responsibility unlocking is bypassed. Over time, the abbreviated onboarding becomes normalized. New operators routinely operate with incomplete knowledge.

**Prevention:** Responsibility unlocking is system-enforced, not only process-enforced. An operator who has not completed Stage 3 cannot be granted live intervention authority, regardless of organizational pressure. Emergency certification is required before emergency activation authority is granted — it cannot be granted retroactively. The onboarding sequence is a gate, not a guideline.

---

### Failure Mode IM-04: Loss of Causal Understanding Over Time

**What it is:** The team understands what the system does but not why it does it. Constraints are maintained because they are there, not because anyone understands what would happen if they were removed. When a constraint is expensive or inconvenient, there is no basis for evaluating whether it is worth maintaining. Some are relaxed inappropriately; others are maintained at high cost despite no longer being necessary.

**Prevention:** Failure-story-driven education (Section 2.3) and historical constraint traceability (Section 3.3). A team that can walk through the operational failure that motivated each constraint maintains causal understanding. When a constraint is challenged, the response is not "because the spec says so" — it is "here is the replay entry showing what happens without it."

---

## Related Documents

**OPERATIONAL-DRIFT-DETECTION-AND-PREVENTION-v1.md** — Drift detection depends on the institutional memory of specified behavior. This document defines how that memory is preserved and transmitted.

**CONSTITUTIONAL-CHANGE-GOVERNANCE-v1.md** — Decision lineage preservation (Section 3.1) integrates with the change governance record: every approved change contributes to the institutional memory of why the system is the way it is.

**REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md** — The 6-tier curriculum and emergency certification standard that the onboarding sequence (Section 2.1–2.4) implements.

**FUTURE-OPERATOR-SURVIVABILITY-v1.md** — The doctrine-level statement of why institutional memory is a long-term survivability mechanism, not merely a documentation policy.

**OPERATOR-COGNITIVE-MODELS-v1.md** — The 6 operator types and misconceptions that the onboarding system (Section 2) is designed to prevent from forming.

---

*End of INSTITUTIONAL-MEMORY-AND-ONBOARDING-SYSTEM-v1.md v1.0*
*Authority: SHARED — Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)*
*System truth lineage constraints and replay-linked knowledge integrity: Agent 1 authority*
*Onboarding corpus and failure story archive: Agent 2 and Agent 3 joint stewardship*
*Operator onboarding sequence and replay-first learning model: Agent 3 authority*
*Changes to the onboarding gate criteria require Agent 3 lead review and Agent 2 confirmation.*
