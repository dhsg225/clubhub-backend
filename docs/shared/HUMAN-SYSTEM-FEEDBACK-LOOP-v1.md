# HUMAN-SYSTEM FEEDBACK LOOP v1

**Era:** Operator Reality Integration
**Status:** CANONICAL
**Scope:** Operator confusion as system signal, UX learning from misunderstanding, perception vs system fix separation, cognitive drift detection, institutional learning, anti-mythology safeguards

---

## 1. PURPOSE

The system observes the world and presents operators with a model of it. Operators act on that model. Their actions — and especially their hesitations, errors, and corrections — are data about whether the model the system presented was comprehensible.

This feedback is currently lost. Operators who misread a surface, who hesitate before an action, who take an action and immediately undo it — these behaviors contain information about where the system's perceptual layer failed to communicate correctly. That information must be captured, structured, and routed into the improvement process.

The feedback loop defined here does not change PRE resolution semantics. It does not modify the deterministic runtime. It observes the boundary between the system and the operator's understanding of the system, and surfaces the gaps.

**Operator confusion is a signal. Signals must be routed, not discarded.**

---

## 2. WHAT OPERATOR CONFUSION LOOKS LIKE AS DATA

Confusion is not a subjective state — it produces observable behavioral patterns. These patterns are detectable from the interaction event stream.

### 2.1 Confusion Pattern Registry

| Pattern Name | Observable Signal | Likely Confusion Type |
|---|---|---|
| **Rapid Undo** | Operator takes an action and reverses it within 10 seconds | Unexpected action consequence; surface didn't communicate what would happen |
| **Confirmation Retry** | Operator goes through confirmation gate twice within 60 seconds | Confirmation surface didn't communicate clearly enough what was being confirmed |
| **Mode Check Loop** | Operator navigates to LIVE/REPLAY indicator more than 3× in 2 minutes | Uncertainty about current mode — indicator may not be ambient enough |
| **Stale Dismiss Loop** | Operator dismisses a stale data warning, action fails, stale warning acknowledged again | Operator did not understand that the stale warning was blocking their action |
| **Authority Probe** | Operator attempts actions at increasing permission levels in sequence | Unclear which authority level they hold; authority indicator may be ambiguous |
| **Long Dwell on Explanation** | Operator spends >60 seconds reading an explanation panel | Explanation is present but not immediately comprehensible |
| **Panic Navigation** | 3+ pane changes in 10 seconds without settling | Operator cannot find what they're looking for; information architecture may be broken for this task |
| **Missed Incident Window** | Incident goes unacknowledged for >120 seconds while operator is active | Incident indicator failed to break attention threshold |
| **Repeat Error** | Operator encounters the same error condition twice in one session | Error surface didn't communicate how to resolve the condition |
| **Abort Sequence** | Operator begins a multi-step workflow but abandons it before completion | Workflow progression was unclear; operator lost track of where they were |

### 2.2 Confusion Events

Each detected confusion pattern generates a structured event:

```typescript
interface OperatorConfusionEvent {
  pattern: string;               // pattern name from registry
  operatorId: string;
  sessionId: string;
  surfaceId: string;             // which surface the confusion occurred on
  operationalContext: {
    playerState: string;
    incidentState: string;
    sessionAuthority: string;
    preResolutionState: string;
  };
  timestamp: string;             // ISO8601
  precedingActions: InteractionEvent[];   // last 5 actions before confusion signal
  resolutionAction?: InteractionEvent;    // what the operator did to recover (if detected)
  confusionDurationMs?: number;          // time between confusion onset and resolution
}
```

These events are emitted to the same observability sink as state machine mutations, but routed to the UX feedback analysis pipeline, not the operational monitoring pipeline.

---

## 3. HOW UX LEARNS FROM OPERATIONAL MISUNDERSTANDINGS

The UX feedback pipeline converts raw confusion events into actionable understanding of where the perceptual layer fails.

### 3.1 Confusion Aggregation

Individual confusion events are not acted upon immediately. They are aggregated over a rolling 30-day window to distinguish:

- **Systematic confusion:** A pattern occurring across multiple operators on the same surface under the same conditions. Likely indicates a perceptual design failure.
- **Individual confusion:** A pattern occurring only with one operator, or only on unusual conditions. Likely indicates an operator training gap, not a design failure.
- **Contextual confusion:** A pattern that correlates with specific operational states (e.g., only occurs during DEGRADED mode). Indicates the surface fails specifically under that condition.

### 3.2 Confusion Threshold Triggers

| Aggregate Signal | Threshold | Action Triggered |
|---|---|---|
| Same confusion pattern, same surface, ≥3 operators in 30 days | Systematic | UX investigation ticket created |
| Same confusion pattern during incidents, ≥2 operators | Incident-critical | Urgent UX investigation; may trigger interim mitigation |
| Mode check loop frequency increasing month-over-month | Trend | Review of LIVE/REPLAY distinction indicators |
| Missed incident window ≥1 occurrence | Any | Immediate investigation — incident indicators are a safety surface |
| Abort sequence on same workflow ≥5 times in 30 days | Systematic | Workflow design review |

### 3.3 Investigation Process

When a threshold is crossed:
1. The confusion event corpus for that pattern/surface is reviewed
2. The surface is replayed in the simulation harness under the conditions that produced confusion
3. The root cause is classified (see Section 4)
4. A fix is proposed and tested in the simulation harness before deployment
5. Post-fix: a monitoring period with heightened confusion event tracking on the affected surface

---

## 4. SEPARATION BETWEEN PERCEPTION FIXES AND SYSTEM FIXES

This is the most important governance boundary in the feedback loop. Not all operator confusion indicates a system problem. Some confusion indicates a perception problem. These require different fixes and different governance.

### 4.1 Perception Fixes

A perception fix changes how the system communicates something, without changing what it communicates.

**Examples:**
- Increasing the size or contrast of the LIVE/REPLAY mode badge (operators keep checking it → it's not ambient enough)
- Rewriting an error message in plain language (operators repeat an error → they didn't understand how to resolve it)
- Changing the position of the incident banner to break attention more reliably (operators miss incidents → the indicator isn't in their scan path)
- Reducing information density in the degraded-mode view (operators confused during degraded mode → too much information competing with the degraded signal)

Perception fixes go through the standard frontend governance process (architectural review, simulation verification, deployment).

They do NOT go through constitutional governance review unless they affect a perceptual invariant (Section 9 of `OPERATIONAL-VISUAL-SEMANTICS-v1.md`) or a semantic token (per `DESIGN-TOKEN-CONSTITUTION-v1.md`).

### 4.2 System Fixes

A system fix changes what the system communicates, because what it was communicating was wrong — inaccurate, incomplete, or misleading about operational reality.

**Examples:**
- The STALE indicator was not surfaced during a particular PRE resolution state (operators relied on stale data → the boundary was not enforcing stale detection correctly)
- The authority indicator showed STANDARD during an ELEVATED session (operator took unintended high-consequence actions → the session state was not correctly propagated to the UI)
- The incident state machine did not transition correctly, so the incident banner didn't appear (operator missed incident → the state machine had a gap)

System fixes go through the full constitutional governance process. They may require backend changes, state machine updates, or PRE boundary changes.

### 4.3 The Classification Gate

Before any confusion event becomes a fix, it must be classified as perception or system. Classification requires:
- Can the operator's confusion be explained by the visual/perceptual layer failing to communicate correctly what the system was doing?
  - If YES → perception fix
- Was the system itself in an incorrect or ambiguous state?
  - If YES → system fix

This classification must be made before work begins. Mixed fixes (a system issue that also surfaces as a perception issue) must be decomposed: the system issue fixed first (constitutional process), then the perception issue fixed to communicate the corrected system state.

---

## 5. COGNITIVE DRIFT DETECTION FROM OPERATOR BEHAVIOR

Over time, operators develop mental models of the system. If those mental models drift from the system's actual behavior, they become operationally dangerous — the operator will predict system behavior incorrectly and act on false predictions.

### 5.1 Drift Indicators

Cognitive drift manifests as:
- Actions based on an assumption that is no longer accurate (e.g., an operator assumes a particular content type always plays in a specific slot — true historically, not true after a PRE configuration change)
- Surprise reactions to system behavior that is documented and expected (visible in post-incident operator reports as "unexpected system behavior" when the behavior was constitutional)
- Repeated use of deprecated workflows that no longer function as the operator expects

### 5.2 Drift-Producing System Events

Certain system events are known to produce cognitive drift if not actively managed:
- PRE configuration changes that alter resolution behavior
- OTA updates that change default behaviors
- New failure modes that operators have not encountered before
- Changes to the incident surface behavior
- Changes to the LIVE/REPLAY distinction mechanics

For each of these events, a targeted communication is sent to all affected operators at certification, explaining what changed and why. The communication is not optional — it appears as a required acknowledgment before the operator can access the live system after the change is deployed.

### 5.3 Drift Detection from Corpus Comparison

When an operator's action pattern diverges from the historical normal pattern for their role and venue type, that divergence is flagged for review. This is not punitive — it surfaces for the operator's supervisor as a "pattern change detected" notification, prompting a brief check-in.

Pattern comparison uses the same corpus infrastructure as the replay system. The operator's interaction history is a corpus that can be replayed and analyzed.

---

## 6. INSTITUTIONAL LEARNING PIPELINE FROM REAL USAGE

Individual confusion events become institutional knowledge through a structured pipeline.

### 6.1 The Pipeline

```
Real Operation
  → Confusion Event Captured
  → 30-day Aggregation Window
  → Threshold Assessment
  → Root Cause Classification (Perception vs System)
  → Fix Proposal and Simulation Verification
  → Deployment
  → Post-Deployment Monitoring
  → Knowledge Article Created (what failed, why, what was fixed)
  → Knowledge Article Added to Training Corpus
  → Future Trainee Certification Includes Scenario Based on Real Failure
```

The end of the pipeline is the beginning of the training pipeline. Real operational failures become training scenarios. The training system is not static — it grows from real usage.

### 6.2 Knowledge Article Format

Every confusion event that produces a fix generates a knowledge article:

```
TITLE: [What the confusion was]
SURFACE AFFECTED: [Which surface]
CONFUSION PATTERN: [Pattern name from registry]
CONDITIONS: [What operational state produced the confusion]
WHAT OPERATORS SAW: [Plain description of what was visible]
WHAT OPERATORS UNDERSTOOD: [What the confusion pattern suggests they believed]
WHAT THE SYSTEM ACTUALLY WAS DOING: [Accurate description]
THE GAP: [Where perception and reality diverged]
WHAT CHANGED: [The fix — perception or system]
HOW TO RECOGNIZE THIS SITUATION: [For future operators encountering similar conditions]
SIMULATION SCENARIO: [ID of the scenario that now trains for this condition]
```

Knowledge articles are available to all operators at all certification levels. They are surfaced during training sessions and referenced during post-incident reviews.

### 6.3 Feedback Loop Cadence

The institutional learning pipeline operates on a defined cadence:

| Activity | Frequency |
|---|---|
| Confusion event aggregation review | Monthly |
| Threshold trigger investigation | Within 5 business days of threshold crossing |
| Knowledge article publication | Within 30 days of fix deployment |
| Training corpus update with new scenarios | Quarterly |
| Full feedback loop audit (are we catching what we should?) | Annually |

---

## 7. ANTI-MYTHOLOGY SAFEGUARDS

Operational teams develop informal knowledge — "folk rules" about how the system works that are not documented, not verified, and not necessarily accurate. These myths are operationally dangerous because they guide behavior without system accountability.

### 7.1 What Mythology Looks Like

Examples of operational mythology:
- "The system always plays sponsor content first when there's a conflict" (may have been true historically; may not be after a PRE configuration change)
- "If you see the orange indicator, wait 30 seconds and it clears itself" (incorrect generalization from one specific scenario)
- "Don't change the schedule less than 5 minutes before an event, the system can't handle it" (a historical limitation that was fixed; the myth persists)
- "The replay always takes 2–3 minutes to load" (true for large packets; becomes an incorrect expectation applied to all packets)

Mythology forms when operators lack access to accurate explanations and substitute pattern-matching and rumors.

### 7.2 Anti-Mythology Mechanisms

**Mechanism 1: Explain Every Behavior**
The explanation system surfaces the reason for every significant system behavior. If the system always surfaces "why," operators have less incentive to invent explanations.

**Mechanism 2: Myth Challenge Workflow**
Operators can mark a behavior as "unexpected" with a single action during live operation. This creates a confusion event and also enters a queue for a plain-language response: "Here's what actually happened and why." The response appears in the operator's notification surface within 24 hours.

**Mechanism 3: Training Corpus Myth Inoculation**
Identified myths are added to the training corpus as deliberate misconception challenges. Trainees are shown a scenario and asked "what will happen next?" The wrong answer often reflects a known myth. The correct answer is explained.

**Mechanism 4: Onboarding Myth Registry**
New operators receive a plain-language document listing the most common myths at their venue or organization, with corrections. This is compiled from the confusion event history for their deployment.

**Mechanism 5: Post-Incident Myth Detection**
Post-incident reviews include a structured question: "Was any operator action based on an assumption about system behavior that turned out to be incorrect?" Affirmative answers trigger a myth investigation.

### 7.3 Anti-Mythology Governance

If a myth is found to be influencing operator behavior at scale — meaning it appears in the behavioral patterns of multiple operators at multiple venues — it is treated as a systematic confusion event and follows the full investigation and fix pipeline.

The fix may be:
- A perception fix (the system wasn't communicating clearly why it was behaving a certain way)
- A system fix (the behavior the myth describes was actually a real inconsistency that operators detected correctly but attributed incorrectly)
- A training fix (the myth is not grounded in any system behavior; it is a cultural artifact that needs targeted correction in the training corpus)

---

## 8. FEEDBACK LOOP INTEGRITY CONSTRAINTS

The feedback loop has constitutional constraints that protect the rest of the system.

### 8.1 Feedback Does Not Change PRE Semantics

Operator confusion about a PRE resolution decision does not change how PRE resolves. Operators may find the explanation confusing; the explanation can be improved. But the resolution logic responds only to constitutional governance, not to operator comprehension preference.

**Example:** Multiple operators find the entropy-based preemption rule confusing. The fix is to improve the explainability surface's description of entropy-based preemption. The fix is NOT to change how entropy-based preemption works.

### 8.2 Feedback Does Not Weaken Deterministic Guarantees

If operators find the confirmation gate annoying (evident from rapid confirmation completions), the gate is not removed. The gate is reviewed for whether it is appropriately applied — perhaps it is triggering on scenarios where CLASS-D consequences don't apply. But the gate is not removed to reduce friction.

### 8.3 Feedback Does Not Introduce Hidden Automation

If operators consistently forget to take a particular action (e.g., confirming incident resolution), the system does not automate that action for them. The fix is a better reminder or a clearer incident resolution workflow. The operator must always be the agent of operational decisions.

### 8.4 Feedback Does Not Override Constitutional Perceptual Invariants

If operators report preferring a different color for the critical severity indicator, that preference is acknowledged but not implemented. The perceptual invariants are constitutional. Operator preference surveys are not constitutional governance.

---

## 9. THE FEEDBACK LOOP AS OPERATIONAL SAFETY INFRASTRUCTURE

The human-system feedback loop is not a product improvement feature. It is operational safety infrastructure.

A system that does not learn from operator confusion will progressively diverge from operator comprehension. That divergence is a latent hazard — invisible until an incident exposes the gap between what operators believed and what was true.

The feedback loop exists to close that gap continuously, before incidents reveal it catastrophically.

Every confusion event captured is an incident that didn't happen.

---

*Document status: CANONICAL — Operator Reality Integration Era*
*Do not modify without constitutional governance review*
