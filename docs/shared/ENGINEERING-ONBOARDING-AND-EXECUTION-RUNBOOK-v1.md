# ENGINEERING ONBOARDING AND EXECUTION RUNBOOK v1

**Era:** Execution Acceleration
**Status:** CANONICAL
**Scope:** 30/60/90 day structure, reading order, minimum survivable understanding, safe first tasks, replay literacy, PRE mental models, certification milestones, architectural mistake recovery

---

## 1. PURPOSE

A new engineer who begins building on this system without adequate preparation will not just produce bugs. They will introduce constitutional violations that are harder to fix than bugs, because they propagate through the codebase as templates. The investment in onboarding is an investment in architectural survivability.

This runbook is not a checklist to complete quickly. It is a calibration process. The goal is not for the engineer to move fast — the goal is for the engineer to move safely.

**Slow is smooth. Smooth is fast.**

A new engineer who moves slowly and correctly for 30 days will outperform a fast engineer who introduces drift that costs the team three weeks to identify and remediate.

---

## 2. MINIMUM SURVIVABLE UNDERSTANDING

Before a new engineer writes a single line of production code, they must be able to answer these questions correctly without referring to documentation:

**About state machines:**
1. What are the five canonical state machines? What is the legal initial state of each?
2. What makes a transition illegal? What happens when an illegal transition is attempted?
3. What must happen for every state transition, without exception?
4. What authority levels exist for transitions? Which authority level can never trigger a transition?

**About PRE and the boundary:**
5. What is the PRE boundary component responsible for?
6. What happens when PRE resolution is in STALE state? What does the boundary do?
7. Can a content renderer subscribe to the PRE state machine? Why not?

**About replay:**
8. What is the difference between LIVE and REPLAY mode from the system's perspective?
9. What must be suppressed during replay that is active during live?
10. Why is `Date.now()` forbidden in the replay path?

**About component structure:**
11. What are the seven component categories? Name one example from each.
12. What direction are component dependencies allowed to flow?
13. What is the God Context anti-pattern and why is it forbidden?

**About incidents:**
14. What are the five degradation stages? What triggers each?
15. What information is never hidden, regardless of incident severity?

If the engineer cannot answer these without notes, they are not yet at minimum survivable understanding. They continue in the observation phase until they can.

---

## 3. DOCUMENT READING ORDER

The corpus has 71+ documents. Reading them in the wrong order creates confusion — later documents reference concepts from earlier ones. This is the correct reading sequence.

### Tier 1: Foundation (Days 1–5)
Read these first, in order. Do not skip ahead.

1. `OPERATIONAL-VISUAL-SEMANTICS-v1.md` — Start here. Gives you the operational vocabulary you will see everywhere else.
2. `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md` — The most important document in the corpus for frontend engineers. Read thoroughly.
3. `COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1.md` — Structure and dependency law.
4. `DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1.md` — Workflow and certification. Read before writing any code.
5. This document — You are reading it now. Refer back often.

### Tier 2: Implementation Craft (Days 5–15)
Read after Tier 1. These will now make sense with the foundation.

6. `CONSTITUTIONAL-ENGINEERING-PLAYBOOK-v1.md` — Keep this open daily.
7. `FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1.md` — How to verify your work.
8. `MOTION-AND-TRANSITION-GOVERNANCE-v1.md` — Before touching any animation.
9. `TYPOGRAPHY-AND-INFORMATION-LEGIBILITY-v1.md` — Before touching any text rendering.
10. `DESIGN-TOKEN-CONSTITUTION-v1.md` — Before using any color or scale value.

### Tier 3: Operational Context (Days 15–30)
These give you the operational WHY behind the engineering WHAT.

11. `OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1.md` — Why the system is built the way it is for humans.
12. `INCIDENT-REALITY-INTEGRATION-SYSTEM-v1.md` — What the incident surface must actually do.
13. `INCIDENT-MODE-APPLICATION-BEHAVIOR-v1.md` — Application-level incident behavior.
14. `OPERATIONAL-SHELL-AND-APPLICATION-CHROME-v1.md` — Shell governance.
15. `WORKSPACE-COMPOSITION-ARCHITECTURE-v1.md` — Workspace topology.

### Tier 4: System Depth (Days 30–60)
Read when your first tasks require deeper understanding.

16. `REFERENCE-IMPLEMENTATION-STRATEGY-v1.md` — Build order and dependency graph.
17. `TEAM-TOPOLOGY-AND-EXECUTION-GOVERNANCE-v1.md` — Team authority and cross-team contracts.
18. `OPERATIONAL-ROLLOUT-AND-DEPLOYMENT-SAFETY-v1.md` — Deployment governance.
19. `IMPLEMENTATION-DRIFT-AND-ARCHITECTURAL-DECAY-PREVENTION-v1.md` — Drift detection and prevention.
20. `CONSTITUTIONAL-VERIFICATION-SCENARIO-LIBRARY-v1.md` — The full verification scenario corpus.

### Tier 5: Architecture Depth (Days 60–90 and beyond)
Read as needed for deep architectural work or team leadership.

- All remaining documents in `docs/shared/` in any order
- Prioritize the document most relevant to your current task
- Pay particular attention to documents you have not read when touching a new constitutional surface

---

## 4. THE 30/60/90 DAY STRUCTURE

### Days 1–30: Observation and Orientation

**Goal:** Understand the system well enough to not break it accidentally.

**Activities:**
- Read Tier 1 and Tier 2 documents
- Run the simulation harness daily: `pnpm --filter @clubhub/player-frontend test:sim`
- Watch annotated corpus replays of nominal operation and at least one incident
- Attend all PR reviews as observer (read-only)
- Complete minimum survivable understanding self-assessment by day 15
- Complete simulation harness orientation by day 20 (per DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1 §2.2)
- Shadow a senior engineer on one complete task cycle

**Safe tasks during this period:** See Section 5.

**Forbidden tasks during this period:** See Section 6.

**Milestone at Day 30:** Pass the minimum survivable understanding oral check. Complete the simulation harness orientation. Receive shadow-review approval from pairing engineer.

### Days 31–60: Supervised Contribution

**Goal:** Contribute to the codebase without introducing architectural drift.

**Activities:**
- Read Tier 3 documents
- Complete first PR under shadow review (see Section 8)
- Build first complete component (category: Content Renderer only)
- Run full certification suite on your component
- Read Tier 4 documents during this period
- Identify one "this doesn't match" — a place where codebase and documentation diverge

**Safe tasks during this period:** Safe first-task categories (expanded from Day 30 list), under shadow review.

**Milestone at Day 60:** First PR merged with clean shadow review. Minimum survivable understanding demonstrated through actual implementation. One "this doesn't match" finding documented.

### Days 61–90: Independent Contribution with Review

**Goal:** Contribute at full velocity within authorized scope, with standard (not shadow) review.

**Activities:**
- Read Tier 5 documents as needed
- Complete constitutional comprehension checks (Section 9)
- Expand task scope to Operational Pane components
- Participate in PR reviews for others (begin developing the review heuristics from the playbook)
- Complete Level 1 operator certification (see TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1)

**Milestone at Day 90:** Level 1 operator certification complete. Constitutional comprehension checks passed. Standard (not shadow) review pathway approved by team lead.

---

## 5. SAFE FIRST TASKS

These tasks are safe for new engineers to work on during the first 30 days under shadow review. They are safe because they are bounded, testable, and do not touch constitutional boundaries.

- Content Renderer components for new display formats (leaf components, props-only, no subscriptions)
- Typography and token application in existing components (changing a hardcoded value to use a semantic token)
- Adding documentation to existing functions (not changing behavior)
- Writing new simulation test scenarios for existing behavior (does not affect production code)
- Writing corpus packets for new test scenarios (authoring tool, does not affect production runtime)
- Fixing rendering issues identified by the render stability tests (bounded scope, test-verified)
- Adding observability annotations to existing tests (no production code change)
- Reading and annotating existing code — identifying where constitutional requirements are implemented

---

## 6. FORBIDDEN EARLY-TASK CATEGORIES

These categories are explicitly forbidden for engineers during the first 60 days. Not because the work is too difficult, but because architectural judgment is required that takes time to develop.

**State machine changes:** Any modification to state machine transition tables, transition guards, or transition authority validation. These require deep constitutional understanding of the downstream implications.

**PRE boundary modifications:** Any change to the PRE-Boundary component itself. This is the most critical boundary in the system.

**Observability sink modifications:** The emission contracts are carefully designed. Changes here affect forensic auditability.

**Cross-surface refactors:** Refactors that touch multiple constitutional surfaces. New engineers are not yet calibrated on all the cross-surface constraints.

**Corpus packet schema changes:** Schema changes affect all historical corpus packets and require replay parity verification across the entire corpus.

**Performance optimizations in the replay path:** The most common place that GovernedClock bypasses are introduced. Requires replay safety expertise.

**CI gate configuration changes:** The gates are the enforcement mechanism. Changes require Platform Reliability Team involvement.

**Any workaround that crosses a constitutional boundary:** New engineers are not yet positioned to evaluate the blast radius of boundary-crossing workarounds.

---

## 7. REPLAY LITERACY ONBOARDING

Replay literacy is the ability to read and interpret corpus replays as operational records. It is not optional — it is the foundation of understanding why the system is built the way it is.

### Week 1: Observation Replay
- Watch corpus packet `nominal-live-001` with annotations enabled
- Follow the explanation overlay — understand what the PRE resolution engine decided and why at each point
- Watch corpus packet with a degraded mode scenario
- Watch corpus packet with an incident scenario

### Week 2: Comparative Replay
- Load the same corpus packet twice. Verify the rendering hash is identical.
- Load a corpus packet from before and after a significant system change. Compare the explanation payloads.
- Find one example where the live explanation engine would produce a different result than the historical corpus explanation. Understand why this is expected and correct.

### Week 3: Replay Construction
- Author a minimal corpus packet using the corpus authoring tool
- Verify the determinism hash is consistent across 5 runs
- Add the packet to the simulation harness as a test fixture
- Write a REPLAY_PARITY test using your packet

### Replay Literacy Completion Check
The engineer can:
- Load any corpus packet and explain what the system was doing at any point in the replay
- Describe the difference between a determinism hash and a content hash
- Explain why GovernedClock is required for replay reproducibility
- Identify a GovernedClock bypass in a code review scenario

---

## 8. SHADOW-REVIEW REQUIREMENTS

All PRs from engineers in the first 60 days go through shadow review before standard review.

### Shadow Review Process

1. Engineer completes implementation and runs the full evidence checklist (per DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1 §8)
2. Engineer requests shadow review from their assigned pairing engineer
3. Shadow reviewer examines the PR using the review heuristics from the playbook
4. Shadow reviewer responds with one of:
   - **CLEAR:** PR is constitutionally clean. Proceed to standard review.
   - **COACHING:** PR has issues that the engineer should fix before standard review. Explanation provided. Not a rejection — a learning moment.
   - **ESCALATE:** PR touches a surface or has implications that require senior constitutional review.

5. After shadow review is CLEAR: standard review proceeds normally.

### Shadow Reviewer Responsibilities

Shadow reviewers are senior engineers who have passed constitutional comprehension checks and have been explicitly approved for shadow review duties.

They are not gatekeepers — they are coaches. Their goal is not to find reasons to reject PRs but to prevent the engineer from inadvertently introducing constitutional violations that would be harder to fix after merging.

---

## 9. CONSTITUTIONAL COMPREHENSION CHECKS

At Day 30 and Day 90, engineers complete a constitutional comprehension check — a structured conversation (not a written test) with a senior engineer covering specific scenarios.

### Day 30 Check Topics
- Describe the behavior when PRE resolution transitions to STALE during live operation
- Given a component that reads from AppContext for operational mode — identify the violation and correct it
- Trace the full lifecycle of a backend incident event from arrival to UI rendering
- Explain why optimistic transitions are forbidden and what to do instead

### Day 90 Check Topics
- Design a new Content Renderer for a hypothetical new data type — what does the complete component look like?
- A PR arrives that disables the replay parity test "temporarily." What is the correct response?
- An engineer proposes using a boolean flag instead of a state machine state "because it's simpler." How do you respond?
- A performance optimization in the schedule view uses `Date.now()` for a timestamp. Identify the risk, find the correct fix.
- Describe the complete sequence from operator clicking "start replay" to replay content rendering. Every state machine transition, every boundary crossing, every observability emission.

---

## 10. PAIRING STRUCTURE

New engineers are paired for their first 60 days with a constitutional mentor — an engineer who has passed Day 90 comprehension checks and has at least one implementation cycle of experience on the system.

### Pairing Cadence
- Daily: 30-minute check-in (not code review — conceptual questions, mental model calibration)
- Weekly: 2-hour deep-dive pairing session on the current task
- Bi-weekly: Constitutional mentor reviews the new engineer's contribution history for drift patterns

### Pairing Handoff
At Day 60, the pairing relationship shifts from daily to weekly. At Day 90, it becomes available-on-request. The constitutional mentor remains available permanently for escalations.

---

## 11. SIGNS THE ENGINEER DOES NOT YET UNDERSTAND THE SYSTEM

These are observable signs, visible in code, PR descriptions, or conversations. They are not character flaws — they are calibration gaps that the onboarding process addresses.

| Observable Sign | Calibration Gap |
|---|---|
| Uses `useState` for operational mode (live/replay/incident) | Does not understand state machines as the authority |
| References `AppContext` or a global store for PRE resolution data | Does not understand boundary isolation |
| Adds a loading spinner with `color.status.warning` yellow | Does not understand severity color semantics |
| Writes a transition function with `new Date()` | Does not understand GovernedClock requirement |
| Disables a simulation test to unblock their PR | Does not understand test integrity as constitutional requirement |
| Proposes refactoring the PRE boundary "for simplicity" as a first task | Does not understand that the boundary IS the simplicity — it contains the complexity |
| Creates a component that does both layout AND data subscription | Does not understand component category boundaries |
| Describes replay as "just playing back old content" | Does not understand replay as an operational truth infrastructure |
| Adds error handling that returns null from a shell component on exception | Does not understand that shell failures must surface |
| Refers to the architecture documents as "the design docs" (historical, not authoritative) | Does not understand that documents ARE the specification |

When these signs are observed, the response is coaching, not criticism. The pairing engineer uses the observation as a teaching moment, not a performance flag.

---

## 12. RECOVERY PATH AFTER ARCHITECTURAL MISTAKES

Engineers will make mistakes. The question is not whether mistakes will happen but whether they will be caught quickly and corrected correctly.

### If You Introduce a Constitutional Violation

1. **Do not merge it.** If the CI gate or a reviewer catches it, good — it did not merge. Fix it per the coaching.

2. **If it merges before being caught:** Report it immediately. Create an architectural debt entry. Do not wait for the weekly audit. The sooner it is in the registry, the sooner it is on the remediation calendar.

3. **Do not attempt a silent fix.** A "fix-forward" commit that silently corrects a constitutional violation without documenting what the violation was leaves the original violation invisible in history. The architectural debt entry is required even if the fix is in the same day.

4. **Do not widen the violation.** If your workaround solved one problem by creating a boundary violation, and now another problem requires extending that workaround, stop. The extension makes the original violation harder to fix. Escalate to the State Authority Team or Operator Experience Team for the correct architectural path.

### If You Are Unsure

Ask before building, not after. The escalation path for implementation uncertainty is:
1. Your constitutional mentor (first stop)
2. The owning team for the relevant surface (second stop)
3. The constitutional governance function (for novel architectural questions)

"I wasn't sure so I just tried something" is a legitimate approach in many engineering contexts. It is not a legitimate approach when the "something" might violate replay determinism or expose operators to dangerous misunderstandings.

---

## 13. ESCALATION PATHS WHEN UNSURE

| Question Type | Escalate To |
|---|---|
| "Is this component category correct?" | Constitutional mentor |
| "Does this state machine change need a design doc?" | State Authority Team |
| "Is this a PRE boundary change or just a resolver change?" | PRE Engine Team |
| "Will this performance optimization affect replay?" | Verification Team |
| "Is this a perception fix or a system fix?" | Operator Experience Team + State Authority Team jointly |
| "Does this token change need constitutional governance review?" | Operator Experience Team → escalates to constitutional governance if semantic |
| "Should this go in the architectural debt registry?" | When in doubt: yes. Constitutional mentor confirms classification. |
| "Is this a W4 or W5 workaround?" | Constitutional mentor; escalate to owning team if W5 suspected |

The cost of asking is a conversation. The cost of not asking and getting it wrong is architectural debt that may be open for months.

---

*Document status: CANONICAL — Execution Acceleration Era*
*Traces to: DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1, CONSTITUTIONAL-ENGINEERING-PLAYBOOK-v1, IMPLEMENTATION-DRIFT-AND-ARCHITECTURAL-DECAY-PREVENTION-v1, TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1*
