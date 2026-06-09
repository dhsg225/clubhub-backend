# ClubHub TV — Explainability Rendering System
# Shared Operational Intelligence Layer — Phase C: Component Constitution

**Document type:** Rendering governance — operational explanation architecture and causality visualization
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 1 (PRE reason trace API); Agent 2 (governance and audit)
**Last updated:** 2026-05-25
**Status:** CANONICAL — explanation rendering not conforming to this document is not eligible for deployment
**Phase:** C — Component Constitution (operational semantic rendering governance)

---

## Purpose

This document governs how ClubHub TV renders operational explanations — the reason traces, suppression trees, resolution paths, and causality chains that make the platform's deterministic behavior humanly accessible.

The threat this document addresses: **explanation drift and causality hiding.** A platform that produces correct operational outcomes but cannot explain them is not operationally trustworthy. Operators who cannot understand why a screen is playing what it plays will develop myths, workarounds, and incorrect mental models. Even if the platform is deterministically correct, unexplained correctness produces the same operational dysfunction as incorrectness — because operators cannot predict it.

Explanation drift occurs when the explanation layer simplifies, abstracts, or editorializes the PRE's actual resolution logic. A simplified explanation is not a different explanation — it is a wrong explanation, because it attributes the outcome to factors that did not fully determine it, or omits factors that did. The operator who learns from a simplified explanation forms a mental model that will produce prediction errors in edge cases.

**The governing principle: explanation as operational trust infrastructure.** The explanation system is not a UI convenience. It is the mechanism by which the platform's determinism becomes cognitively accessible to operators. Its accuracy is as constitutionally significant as the PRE's accuracy.

---

## Section 1 — Explainability Philosophy

### 1.1 Explanation as Operational Trust Infrastructure

Operators trust the platform to the extent that they can predict it. Prediction requires explanation. An operator who understands why an override took precedence will correctly predict the next override outcome. An operator who has been given a simplified explanation — "the override won because it was higher priority" — will not correctly predict outcomes in cases where priority is equal and specificity determines the winner.

The explanation system does not exist to satisfy curiosity. It exists to build operator predictive competence. Every explanation the system provides is an investment in the operator's ability to make accurate predictions about future platform behavior.

### 1.2 Visible Causality Chains

The PRE produces resolution outcomes through a deterministic chain of decisions: which content sources are available, which levels apply, which specificity rules govern, which temporal rules apply. This chain is the actual cause of the outcome. The explanation must trace this chain, not summarize the result of the chain.

**What a causality chain explanation contains:**
1. What the outcome is (the effective state)
2. What produced the outcome (the winning content source and why it won)
3. What the alternatives were (the content sources that did not win, and why they did not)
4. What rule determined the winner (the specific PRE resolution rule that applied)
5. What would change the outcome (the smallest change that would produce a different result)

### 1.3 No Opaque Operational Outcomes

There is no operational outcome in ClubHub TV that is exempt from explanation. Every screen state has a reason trace. Every sponsor gap has a causal account. Every override conflict has a resolution path. Every emergency activation has an attribution.

**What this prohibits:**
- Explanation surfaces that decline to explain a specific outcome ("this state was produced by the system")
- Explanation summaries that omit causally significant factors
- Explanations that attribute outcomes to composite or black-box factors ("the algorithm determined")
- Explanations that differ between surfaces for the same operational event (per SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md Rule E-INT-01)

---

## Section 2 — Reason Trace Rendering

The reason trace is the PRE's resolution path for a specific screen at a specific moment. It is the authoritative explanation of why a screen is in its current state.

### 2.1 Precedence Visualization

**Purpose:** Show which content source won the resolution contest and why.

**Required elements:**
- The effective content: what is currently displayed or scheduled
- The resolution level: which PRE level produced this outcome (LEVEL_0 through LEVEL_5, using canonical level labels)
- The winning source: the specific override, schedule block, or default content that produced the outcome
- Why it won over alternatives: the specific resolution rule (higher level wins; at equal level, higher specificity wins; at equal specificity, temporal order applies)
- Attribution: who applied the winning override (or which schedule produced the winning block)

**Rendering model:**
```
[Screen: Bar Left] — Effective state: Emergency Content "Closure Notice"

Resolution level: LEVEL_0 (Emergency)
Winning source: Emergency override applied by [Operator] at 14:23:07
Resolution rule: LEVEL_0 takes absolute precedence — no other source evaluated

Suppressed by this: LEVEL_2 Sponsorship window, LEVEL_3 Schedule block
```

**Progressive disclosure:**
- Level 1 (default visible): Effective state, resolution level, winning source
- Level 2 (one tap): Full precedence visualization including all suppressed sources
- Level 3 (drill-down): Full resolution path with each evaluation step

### 2.2 Suppression Explanation

**Purpose:** Explain why a specific piece of content is NOT playing — the inverse of the precedence visualization.

**This is Q4 in the explainability spec (EXPLAINABILITY-UX-SPEC-v1.md): "Why is [content] NOT playing?" This is the most operationally critical question an operator can ask.**

**Required elements:**
- What is being suppressed (the content that is not playing)
- What is suppressing it (the winning content source)
- The suppression rule (why the suppressing source wins over the suppressed source)
- When the suppression will end (if time-limited)
- What would be required to unsuppress (what change would allow this content to play)

**Rendering model:**
```
[Sponsor: Rolex] — NOT playing on Screen: Bar Left

Suppressed by: Emergency override (LEVEL_0)
Suppression reason: LEVEL_0 emergency takes absolute precedence over LEVEL_2 sponsorship
Active since: 14:23:07 (currently: 14:45 — suppressed for 22 minutes)
Suppression ends: When emergency override is deactivated

To play this content: Deactivate the emergency override on this screen/venue
```

**Suppression tree:**
When multiple content sources are suppressed by a single winning source, the suppression tree displays all of them in a single view — not as separate explanations for each suppressed item. The tree shows the winning source at the root and all suppressed items as branches.

### 2.3 Resolution-Path Rendering

**Purpose:** Show the full PRE evaluation path for a specific resolution — every content source that was evaluated, in the order it was evaluated, with the result of each evaluation.

**This is the forensic-level explanation (Level 3 in the progressive disclosure model). It is used for investigation, training, and dispute resolution — not for routine operational understanding.**

**Required elements (full resolution path):**
- Every content source evaluated, in evaluation order
- For each source: the source name, its type (override/schedule/default), the evaluation result (wins / loses to X / not applicable), and the reason for the result
- The final outcome: which source produced the effective state
- The resolution timestamp: the exact moment this resolution was computed

**Implementation requirement for Agent 1:** The PRE must expose a resolution path API that returns the full evaluation sequence for a specific screen at a specific moment. This API is called by the resolution-path rendering component — it is not reconstructed from the delivery log.

### 2.4 Why-Playing Surfaces

**Purpose:** Answer "what is playing on this screen and why?" — the entry point for routine operational understanding.

**Rendering model (screen introspection panel):**
```
[Screen: Bar Left] — NOW

Playing: "Happy Hour Promo 30s" (content ID: CH-4471)
Playing because: LEVEL_3 Schedule block "Happy Hour" (14:00–18:00)
Override stack: Empty — no active overrides
Health: A (fully synchronized, 0 entropy advisories)
Playing for: 12 more seconds → then "Bud Light 15s"
```

**The why-playing surface answers all seven questions from EXPLAINABILITY-UX-SPEC-v1.md:**
- Q1: What is playing? → "Happy Hour Promo 30s"
- Q2: Why is it playing? → "LEVEL_3 Schedule block"
- Q3: Who decided? → "Schedule set by [operator]"
- Q4: Why is X not playing? → (accessible via suppression explanation)
- Q5: What will play next? → "Bud Light 15s in 12 seconds"
- Q6: Who could change this? → "Any operator with override authority"
- Q7: When will this change? → "Schedule block ends at 18:00"

### 2.5 Why-Not-Playing Surfaces

**Purpose:** Answer "why is [specific expected content] not playing?" — the diagnostic entry point when something is missing that should be there.

**This surface is specifically for sponsor delivery investigation.** The question "why is the Rolex spot not playing?" is one of the most common and operationally significant questions in the platform.

**Required elements:**
- The specific content not playing (operator can search or select from schedule)
- The current suppression reason (what is playing instead, and why it wins)
- The historical delivery record: how long has this content been suppressed?
- Forward projection: when will this content play, given current override and schedule state?
- Recovery path: what actions would allow this content to play?

---

## Section 3 — Explanation Hierarchy

Operational explanations exist at four levels of detail. The explanation hierarchy defines what information is available at each level and when each level is appropriate.

### Level EH-1: Summary Explanation

**Audience:** All operators, routine operational monitoring.
**Purpose:** Confirm that the system is behaving as expected — or flag that it is not.
**Information depth:** The outcome and its category (override-driven, schedule-driven, emergency-driven). Not the resolution path.

**Example:** "Playing: Happy Hour Promo — Schedule"

**When appropriate:**
- Active operational monitoring dashboards
- Fleet health views
- Ambient-attention displays

**When insufficient:**
- When the operator needs to understand why a specific content source is winning
- When the operator is investigating a delivery gap
- When the operator is planning a new override

---

### Level EH-2: Operational Explanation

**Audience:** All operators, active operational decision-making.
**Purpose:** Provide enough information to make operational decisions confidently — create an override, acknowledge a delivery gap, declare an incident.
**Information depth:** The outcome, the winning source, why it won over the most directly relevant competing source.

**Example:**
```
Playing: Happy Hour Promo — LEVEL_3 Schedule (14:00–18:00)
No active overrides. Sponsor: Bud Light window active but yielding to schedule.
Next override: Sponsored content at 18:00.
```

**When appropriate:**
- Venue operations workspace
- Override creation preview
- Incident investigation initial view

---

### Level EH-3: Forensic Explanation

**Audience:** Experienced operators, incident investigation, postmortem analysis.
**Purpose:** Full causality reconstruction — every source evaluated, every rule applied, every decision made in the resolution.
**Information depth:** Complete resolution path.

**When appropriate:**
- Incident investigation
- Postmortem analysis
- Training and operational literacy building
- Dispute resolution (e.g., sponsor claiming content was not delivered as contracted)

---

### Level EH-4: Replay-Linked Explanation

**Audience:** All operators for verification; investigators for evidence.
**Purpose:** Ground the explanation in the deterministic replay record — confirm that the explanation matches what actually happened.
**Information depth:** EH-3 forensic explanation, plus a link to the replay record that confirms it.

**The replay link is the ground truth.** An explanation at EH-4 says: "Here is the full resolution path — and here is the replay record that proves it. You can verify this explanation by querying the PRE at this moment with this system state and confirming you get this output."

**When appropriate:**
- Any dispute that requires evidentiary weight
- Contract compliance verification
- Any situation where the operator's trust in the explanation needs to be grounded in something beyond the explanation itself

---

## Section 4 — Counterfactual Rendering

### 4.1 What Would Have Played

**Purpose:** Show what the PRE would have resolved if a specific override had not been applied.

**Required behavior:**
- Uses actual PRE evaluation with the specified override removed from the system state
- Displays the result alongside the actual outcome: "Actual: Emergency content — Without override: Sponsored content (Rolex 30s)"
- The comparison is displayed as a diff: what is the same (same device, same time) and what is different (different content, different resolution level)
- The hypothetical is labeled clearly: "Simulation — This did not happen"

### 4.2 What Superseded What

**Purpose:** In a resolution contest where one source superseded another, show the defeated source and the rule that defeated it.

**Required behavior:**
- The superseded source is displayed alongside the winning source
- The specific rule that determined the winner is named: "LEVEL_1 override superseded LEVEL_3 schedule block — resolution rule: higher level wins"
- The superseded source's full context is accessible: what content it would have played, at what time, with what SOV

### 4.3 Intervention Effect Visibility

**Purpose:** Show the operational effect of a past intervention — what changed as a result of this override, emergency activation, or schedule modification.

**Required behavior:**
- The pre-intervention state (what was playing or would have played without the intervention)
- The post-intervention state (what the intervention produced)
- The duration of the intervention's effect
- The downstream effects (sponsor delivery impact, schedule displacement)

**This surface is used after an intervention to confirm that the intervention had the intended effect.** It closes the operational loop: the operator took an action, and now they can see what that action produced.

### 4.4 Rollback Comparison Rendering

**Purpose:** In a rollback flow (IF-07 from INTERACTION-SEQUENCING-SPEC.md), show the state before the original action, the state after the original action, and the state after the rollback — three states in comparison.

**Required behavior:**
- Three-state comparison: Before action / After action / After rollback
- Differences are highlighted in each state
- The operator can see exactly what the rollback restores
- If the rollback does not produce the pre-action state exactly (because other state has changed since the original action), this is disclosed: "Rollback will restore the override stack to its pre-action configuration. However, other state changes have occurred since the original action — the effective state may differ from the pre-action state."

---

## Section 5 — Explanation Failure Modes

### Failure Mode EF-01: Oversimplification Drift

**What it is:** The explanation gradually simplifies over time as designers try to make it "more accessible." Each simplification is individually reasonable. The accumulated result is an explanation that omits the factors that matter in edge cases — exactly the cases where operators most need accurate explanation.

**Example:** "The override won because it had higher priority" is true in most cases but omits specificity as a tie-breaker. An operator who has only seen this simplified explanation will not understand why two LEVEL_2 overrides don't behave the same way — one at screen scope and one at venue scope.

**Prevention:** Explanation content is governed by this document. Changes to explanation content require the same governance process as changes to any canonical document. Simplifications that omit causally significant factors are not permitted.

---

### Failure Mode EF-02: Causality Hiding

**What it is:** The explanation presents a result without presenting the cause, or presents an intermediate cause without presenting the root cause.

**Example:** "Sponsor content is not playing because an override is active" — technically true, but does not answer why the override is active, whether it was intentional, or when it will end.

**Prevention:** Every explanation that can be deepened must provide access to the deeper explanation. The four-level hierarchy (EH-1 through EH-4) exists to support this. Level EH-1 summaries must link to EH-2 operational explanations, which must link to EH-3 forensic explanations. Causality chains must be followable to their root.

---

### Failure Mode EF-03: Explanation Inconsistency

**What it is:** The same operational outcome is explained differently in different surfaces. The venue dashboard explains it one way; the replay investigation explains it another way; the incident timeline explains it a third way. All three might be technically accurate, but they are using different frameworks, different vocabulary, or different levels of detail without disclosure.

**Why it happens:** Different surfaces designed by different teams, each explaining the outcome from their surface's perspective, without governance that requires cross-surface explanation consistency.

**Prevention:** SYSTEM-COHERENCE-AND-EXPERIENCE-INTEGRITY-v1.md Rule E-INT-01 (Explanation Consistency) requires that identical conditions be explained identically across all surfaces. This document implements that rule in the rendering layer: explanation components use shared explanation logic, not surface-local explanation implementations.

---

### Failure Mode EF-04: Replay / Explanation Mismatch

**What it is:** The explanation surface says one thing; the replay shows another. The explanation attributes the outcome to override X; the replay shows that override Y was the resolution winner. These can be produced by: explanation logic that approximates the PRE rather than calling it directly, explanation logic that is stale relative to the PRE, or explanation logic that handles edge cases differently from the PRE.

**Why it happens:** Explanation surfaces that do not consume the PRE's actual resolution output — instead reconstructing the explanation from logs, heuristics, or simplified resolution logic.

**Prevention:** Explanation surfaces consume the PRE's resolution path output directly. There is no separate "explanation algorithm" — the explanation is the PRE's resolution path, rendered for human consumption. When explanation and replay conflict, it means the explanation logic is not calling the PRE correctly, which is a bug, not a design choice.

---

### Failure Mode EF-05: Authority Ambiguity

**What it is:** The explanation is clear about what happened but ambiguous about who had the authority to make it happen. "An override was applied" — by whom? With what authority? Through what approval process? This ambiguity creates both operational uncertainty (was this authorized?) and institutional accountability gaps (who is responsible for this intervention?).

**Prevention:** Every explanation of an operational intervention includes attribution:
- The operator who initiated the action
- The operator's role and authority level at the time
- Whether approval was required and whether it was obtained
- The timestamp of the action

Attribution is non-optional and cannot be omitted from any EH-2 or higher explanation.

---

## Section 6 — Human Factors

### 6.1 Explanation-Driven Trust

Operators trust systems they can predict. Prediction requires explanation. The explanation system is not an audit trail — it is a prediction-building tool. An operator who has seen the PRE's resolution logic explained clearly, for several different scenarios, will begin to internalize the resolution rules and predict outcomes correctly without needing to look.

**Design implication:** The explanation system must be designed to build operator competence, not just to satisfy curiosity. This means:
- Explanations use consistent language (the canonical terms from the Domain Language Glossary)
- The same resolution rule is explained the same way every time — operators can pattern-match
- Explanations progress from outcome → cause → rule → prediction — each explanation leaves the operator one step closer to independent prediction

### 6.2 Cognitive Closure

Operators who understand why something happened achieve cognitive closure — a satisfying sense of understanding that allows them to move on to other operational concerns. Operators who do not understand why something happened remain in a state of cognitive uncertainty — spending ongoing attention on the unresolved question even while handling other operational tasks.

**Design implication:** Explanations must be complete enough to produce cognitive closure. An explanation that answers "what" but not "why" does not produce closure. An explanation that answers "why" in general but not "why in this specific case" does not produce closure.

The four-level explanation hierarchy exists specifically to support closure at multiple levels of detail: operators who need only EH-1 closure get it quickly; operators who need EH-3 closure can reach it without requiring others to wait for them.

### 6.3 Uncertainty Tolerance

Different operators have different tolerance for operational uncertainty. Some operators are comfortable acting on EH-1 summary explanations; others need EH-3 forensic confirmation before they can act confidently. The explanation hierarchy must accommodate both.

**Design implication:** The default explanation level shown must be sufficient for the operational action the surface supports. A surface that enables override creation must show at least EH-2 operational explanation — the operator needs to understand the resolution contest they are about to change. A surface that enables emergency activation can operate with EH-1 — in an emergency, operators act on summary understanding and investigate later.

The deeper explanation levels must be accessible without friction for operators who need them — but they must not be required for operators who have sufficient confidence at a higher level.

### 6.4 Replay-Assisted Understanding

Replay is the most powerful explanation tool in the platform because it allows operators to observe PRE resolution in action across a sequence of moments, not just at a single point. An operator who watches an override take precedence at 14:23, sees it aging through 14:30, and watches it expire at 14:45 — while observing how the effective state changes at each point — builds a deeper understanding of override lifecycle than any static explanation could produce.

**Design implication:** The explanation system must leverage replay. Every EH-3 forensic explanation should include a "watch this in replay" option that takes the operator to the replay record for the explanation's moment, with the reason trace visible. Replay-linked explanations (EH-4) are the gold standard precisely because they allow operators to verify their understanding through observation rather than taking the explanation on faith.

---

## Related Documents

**COMPONENT-CONSTITUTION-v1.md** — Class CC-04 (explanation surfaces) is governed by this document. The Component Constitution provides the governance framework; this document provides the rendering specification.

**OPERATIONAL-COMPONENT-SEMANTICS-v1.md** — The primitive components used by explanation surfaces. Reason trace rendering uses timeline primitives and state badges defined there.

**TEMPORAL-AND-REPLAY-COMPONENTS-v1.md** — Replay-linked explanations (EH-4) use the replay components defined there. The EH-4 level is implemented by combining the reason trace rendering here with the replay scrubber and timeline from the temporal components document.

**EXPLAINABILITY-UX-SPEC-v1.md** — The seven core explainability questions (Q1–Q7) that this rendering system answers. The UX spec defines the questions; this document defines how they are rendered.

**SCREEN-INTROSPECTION-SYSTEM-v1.md** — The screen introspection system's three-panel architecture (NOW/WHY/WHEN) is implemented using the rendering components defined in this document.

**CANONICAL-UI-STATE-MODEL.md** — Explanation surfaces must correctly represent the state types of the data they are explaining — stale explanations must be labeled as such, degraded-mode explanations must disclose their reduced-confidence basis.

---

*End of EXPLAINABILITY-RENDERING-SYSTEM-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*PRE resolution path API (required for EH-3 and EH-4): Agent 1 co-authority.*
*Domain Language Glossary alignment for explanation vocabulary: Agent 2 co-authority (when Glossary is created).*
*Changes to explanation hierarchy levels or reason trace rendering require cross-agent review.*
