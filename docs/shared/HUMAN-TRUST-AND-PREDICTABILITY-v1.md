# ClubHub TV — Human Trust and Predictability v1
# How Operational Trust Is Created, Maintained, and Lost

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, EXPLAINABILITY-UX-SPEC-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md, FAILURE-STORIES.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Trust Philosophy

---

### 1.1 Predictability Over Convenience

Trust in an operational system is not produced by ease of use, visual polish, or feature completeness. It is produced by one thing: **the system behaves the way the operator expects it to behave.**

This is predictability. Predictability is not the same as simplicity — a complex system can be highly predictable if its rules are transparent and consistently applied. Simplicity without predictability produces systems that are easy to start but progressively harder to trust as operators discover that the simplified surface hides behavior they cannot anticipate.

For ClubHub TV, the constitutional property that makes predictability achievable is determinism (INV-3). Given the same inputs, the PRE always produces the same output. A system that is deterministic at its core is a system that can be fully understood — operators who understand the resolution model can predict any outcome.

**The UX's role in trust is not to simplify the system. It is to make the system's deterministic logic accessible to human understanding.** An operator who understands the system can predict it. An operator who can predict it trusts it. An operator who trusts it uses it correctly. An operator who uses it correctly produces low-entropy venues.

The chain from determinism → explainability → predictability → trust → low entropy is the platform's primary value creation mechanism.

---

### 1.2 Trust as Replay Alignment

The deepest form of operational trust is **replay alignment**: the operator's mental model of the system so accurately reflects the system's actual logic that they can mentally replay any scenario and predict the correct outcome.

An operator with replay alignment can answer any of the seven core explainability questions (EXPLAINABILITY-UX-SPEC-v1.md Part 2) without opening the CMS. They know why content is playing, what would suppress it, what would restore it, and what will happen next. Their mental simulation of the system matches the PRE's computation.

This is not a metaphor. The PRE's replay infrastructure (INV-3 determinism + preserved state) means that a mental simulation can be verified: the operator predicts outcome X, then uses the replay system to confirm. Repeated confirmation builds the mental model until it is reliably accurate.

**Replay alignment is the trust state that makes override addiction impossible.** An operator who can predict that their campaign will win after an override expires does not need to create a precautionary override. An operator who cannot predict this does.

---

### 1.3 Why Hidden State Destroys Trust

Hidden state is any system behavior that affects operator-visible outcomes without being surfaced in any CMS view. Examples:

- An override that is active and suppressing a campaign, but not visible in the campaign view
- A scheduled rule transition that occurs without any notification
- A confidence score degrading silently while the screen appears to be showing content normally
- An emergency that has been active for 18 days that appears nowhere in the venue's main operational view

Hidden state does not just produce incorrect outcomes. It destroys the operator's ability to form accurate mental models. An operator who sees screen X showing content Y cannot learn why — because the cause is hidden. They cannot correct their understanding. They cannot improve their prediction accuracy.

Over time, repeated experiences of unexplained outcomes accumulate into a general belief: "the system does things I can't predict." This belief is self-fulfilling — operators who believe the system is unpredictable stop trying to predict it and start treating every configuration as uncertain. They create redundant overrides, escalate priorities defensively, and approach the CMS with anxiety rather than confidence.

**Hidden state is trust destruction infrastructure.** Every hidden state that exists in the CMS is an active contribution to operator anxiety and entropy accumulation.

---

### 1.4 Why Operational Folklore Replaces Weak Explainability

When the system does not explain itself, operators explain it for themselves. The explanations they produce are called folklore — informal, often incorrect beliefs about system behavior that emerge from observation without understanding.

Folklore is not irrational. It is the rational response to an information gap. An operator who observes that "setting priority to maximum always seems to fix problems" has made a real observation (the problem was sometimes fixed after this action) and drawn an incorrect causal inference (the priority setting was the cause). Without the explainability system to show the actual cause, the folklore is uncontradicted and spreads.

**The rate of folklore generation is inversely proportional to the quality of the explainability system.** A system that fully explains every outcome in accessible language produces no folklore. A system that explains nothing produces an elaborate folk model that may bear little resemblance to the actual system.

The folklore problem compounds over time: as new operators are trained by experienced ones, they inherit the folk model. The folk model is taught as institutional knowledge. Correcting folk models that have been institutionalized is harder than preventing them — it requires overcoming not just ignorance but belief.

---

## Part 2 — Trust Formation Cycles

---

### 2.1 The Prediction → Confirmation Loop

The fundamental trust formation cycle:

1. **Prediction:** The operator expects the system to do X, based on their current mental model
2. **Action:** The operator makes a configuration change
3. **Verification:** The operator checks whether X happened
4. **Outcome A — Confirmation:** X happened as predicted. Mental model is reinforced. Trust increases.
5. **Outcome B — Contradiction:** Y happened instead of X. If explanation is provided, mental model is corrected. Trust maintained. If no explanation, trust decreases.

**The UX's role in this cycle:**
- Facilitate prediction (preview system)
- Enable verification (live operations workspace, screen introspection)
- Provide explanation when prediction fails (explainability surfaces)

The explainability on Outcome B is the most important design consideration. A system that only supports Outcome A (confirmation of correct predictions) does not build accurate mental models — it only reinforces existing ones. A system that fully explains Outcome B (prediction failures) builds increasingly accurate mental models through correction.

---

### 2.2 The Preview → Outcome Verification Cycle

A specific form of the prediction → confirmation loop using the preview system:

1. Operator uses preview to simulate the expected outcome of a proposed change
2. Preview shows expected state X
3. Operator commits the change
4. System transitions to state X (or to Y if something changed in the interval)
5. Operator verifies by checking the live state

When preview shows X and live state is X: strong trust reinforcement — preview is accurate, system is predictable.

When preview shows X and live state is Y: trust risk event. Must be explained immediately and specifically — what changed between preview and execution?

**Design requirement:** Every preview engagement should be followed, within one poll cycle (15 seconds), by a verification prompt if the operator is still in the CMS: "Your change has taken effect. [Verify screen state]." This closes the prediction → confirmation loop explicitly, rather than leaving the operator uncertain whether their change worked.

---

### 2.3 The Replay → Understanding Reinforcement Cycle

The replay system creates a trust formation path that does not require the operator to wait for a prediction to fail:

1. Operator observes an outcome they did not fully understand (e.g., screen showed unexpected content)
2. Operator uses replay to reconstruct what happened
3. Replay reveals the cause: a rule the operator didn't know was active
4. Operator's mental model is corrected
5. The corrected model enables better predictions in future

This cycle does not require a prediction failure — it uses past observations as learning inputs. Every past operational event can become a trust formation opportunity if the replay system is accessible.

**Trust maintenance through retrospective learning:** Replay allows the system to continuously correct the operator's mental model using the evidence of their own operational history. The operator's venue is the most credible training environment possible — they already know it, they remember the events, and the lessons are personally relevant.

---

### 2.4 The Intervention → Consequence Visibility Cycle

When operators take interventions (creating overrides, modifying campaigns, clearing emergencies), the consequence of the intervention must be visible — and the visibility must be attributable:

1. Operator creates Override_004
2. System shows: "Override_004 is now active on B1–B2. Campaign A is suppressed on these screens."
3. Operator sees exactly what their action did
4. The intervention and its consequence are part of the permanent record

This cycle builds two forms of trust:
- **Self-trust:** The operator knows what effect their own actions have. They are not operating in the dark about their own contributions to system state.
- **System trust:** The operator can verify that the system responded to their action in the way they expected. The system did what it was supposed to do.

**The absence of consequence visibility** is the condition in which operators never develop accurate self-models of their operational impact. They create overrides without understanding what they displace. They cannot connect their past actions to present problems. They cannot learn from operational consequences because the consequences are not visible.

---

## Part 3 — Trust Failure Modes

---

### TF-01: Preview Mismatch

**Failure:** Preview shows state X. Live system shows state Y. No explanation is offered.

**Trust damage:** Catastrophic. The preview system is the platform's primary predictability tool. If preview is unreliable, the operator has no safe way to verify outcomes before committing changes. They revert to experimentation — the behavior preview was designed to replace.

**Reference:** FAILURE-STORIES.md Story 7 ("The Preview That Lied"). This failure destroyed preview trust at one venue and reverted the operator to override-first operations.

**Recovery:** Requires explicit divergence explanation (what changed between preview time and execution time) and divergence history transparency (EXPLAINABILITY-UX-SPEC-v1.md §3.7). Preview trust must be rebuilt through demonstrated accuracy over multiple successive predictions.

---

### TF-02: Stale State Visibility

**Failure:** The CMS shows a confidence score or state that has not been updated recently, and does not label the staleness. The operator acts on stale data, making decisions based on a system state that no longer exists.

**Trust damage:** Moderate-to-high. The operator's action produces an unexpected outcome not because the system behaved incorrectly, but because the operator was acting on outdated information. The operator may not realize the information was stale — they conclude the system is unpredictable.

**Prevention:** All state displays must include a "last updated" timestamp when the update is more than one poll cycle (15 seconds) old. State older than 3 poll cycles must show a staleness warning. State older than 5 minutes must show a strong staleness warning and discourage decision-making.

---

### TF-03: Invisible Overrides

**Failure:** An active override is suppressing content, but the operator viewing the suppressed campaign cannot see the suppressor. The campaign shows "Active" status. The screen shows different content. The cause is invisible.

**Trust damage:** High. The campaign appears to be broken — it is active but not delivering. The operator cannot distinguish between a system failure and a suppression event. They may escalate to support, create more rules, or abandon the campaign system.

**Reference:** FAILURE-STORIES.md Story 1. OPERATOR-COGNITIVE-MODELS-v1.md M-01 ("Active means showing").

**Prevention:** Cross-reference visibility (EXPLAINABILITY-UX-SPEC-v1.md F-02). Campaign views must show per-screen winning status. "Active" must never appear without per-screen delivery confirmation.

---

### TF-04: Inconsistent Terminology

**Failure:** The same concept is described with different words in different parts of the CMS. "Override" in one view, "direct schedule" in another, "content lock" in a third — all referring to the same LEVEL_1 resolution mechanism.

**Trust damage:** Moderate but insidious. Terminological inconsistency suggests the system is internally inconsistent. Operators develop separate mental models for what they believe are different mechanisms. When they discover they are the same thing, they lose confidence in their understanding of other mechanisms.

**Prevention:** DOMAIN-LANGUAGE-GLOSSARY.md as the authoritative terminology source. All CMS copy must use canonical terms. Terminological consistency audits as part of the release process.

---

### TF-05: Delayed Updates

**Failure:** The operator makes a change and the CMS does not reflect it for an unexplained period. The operator does not know whether the change took effect, is pending, or failed.

**Trust damage:** Moderate. Uncertainty about whether an action worked is uncertainty about system reliability. Operators who are unsure whether their action worked repeat it — creating duplicate configurations.

**Prevention:** Every committed action must show a clear state: "Change saved — will take effect within 15 seconds." The poll cycle delay is expected and explainable; unexplained delays are not. If a change takes more than 30 seconds, a status update must explain why.

---

### TF-06: Unexplained Suppression

**Failure:** Content is not playing and the system provides no explanation. The operator sees that their content is not active, but no suppressor is identified.

**Trust damage:** High. Unexplained suppression is the most common trust-destroying experience in CMS operation. The operator does not know whether the problem is their configuration, another operator's configuration, a system issue, or device failure.

**Prevention:** The suppression tree (EXPLAINABILITY-UX-SPEC-v1.md §3.2) must always identify the suppressor. If no active rule suppressor can be identified, the system must explain the alternative: "This rule is not suppressed by another rule. Check: is the content itself expired? Is the screen assignment correct? Is the time window active?"

---

### TF-07: False-Success Workflows

**Failure:** A workflow completes with a "success" confirmation but the underlying goal was not achieved. "Override created successfully" when the override has a scope that does not include the screen the operator intended to affect.

**Trust damage:** High and delayed. The operator believes the action succeeded. They check the screen later and find it unchanged. They cannot diagnose the failure because the system told them it succeeded. They repeat the action (which also "succeeds" but achieves nothing), then escalate.

**Prevention:** Success confirmations must confirm the operational outcome, not just the technical action. Not "Override created" but "Override created — affecting [N] screens including [SCREEN_NAME]." If the intended screen is not in the affected list, this is visible immediately.

---

## Part 4 — Trust Recovery Systems

---

### 4.1 Replay-Assisted Recovery

When trust has been damaged by an unexplained discrepancy (preview mismatch, unexplained suppression, false-success), replay provides the mechanism for recovery:

1. Identify the specific trust failure event (what the operator expected, what actually happened)
2. Use replay to reconstruct the actual system state at the time of the event
3. Show the operator exactly what happened and why
4. Validate: "Does this explanation make sense to you?"
5. If yes: mental model updated, one data point toward recovery
6. If no: investigate further — the explanation may reveal a genuine system error

**Replay-assisted recovery is not automatic.** It requires a human to guide the operator through the replay and confirm that the explanation is satisfying. Automated replay access helps; a support conversation using replay is often more effective.

---

### 4.2 Operational Transparency

After a trust failure, the system must be more transparent than usual — actively surfacing information that would normally be accessed on demand, rather than waiting for the operator to request it.

**Post-mismatch transparency mode:**

When a preview-to-outcome mismatch is detected (the preview showed X, the delivered state was Y), the system enters a brief transparency mode for the affected operator:

```
We noticed something unexpected

  Your preview showed [CONTENT_A] on screen B1 at 14:00.
  The screen delivered [CONTENT_B] instead.

  Here is what happened:
  → Between your preview (13:45) and delivery (14:00), [OPERATOR_B]
    created Override_005 covering screen B1.
  → Override_005 takes precedence over your campaign at LEVEL_3.

  This was not a system error — it was a configuration change by another
  operator during the preview window.

  Your campaign is still active and will resume when Override_005 expires
  (Saturday 23:59) or is removed.

  [View Override_005] [Contact [OPERATOR_B]] [Preview Saturday's state]
```

This explanation transforms a trust-damaging event into a trust-building one — the operator now understands exactly what happened and has a path forward.

---

### 4.3 Divergence Acknowledgment

When the system has produced an outcome that diverged from what was configured (device offline, delivery failure, HDMI switch), the CMS must explicitly acknowledge the divergence rather than showing configured state as if it were delivered state:

```
⚡ Delivery confirmation gap

  Screen B4 was configured to show Campaign A from 16:00–18:00.
  Delivery was not confirmed during this window (device offline).

  We cannot confirm whether Campaign A was actually displayed during
  this period. The screen's device reconnected at 18:07.

  This information is relevant if you have a sponsor delivery obligation
  for this window. [Generate divergence report]
```

Acknowledgment of divergence, delivered honestly and clearly, is a trust-preserving behavior. It demonstrates that the system is honest about its limitations. An operator who discovers a delivery gap through a sponsor complaint — without the system ever acknowledging the gap — loses trust in both the system's accuracy and its honesty.

---

### 4.4 Confidence Rebuilding Flows

After a significant trust failure (preview mismatch, extended invisible suppression, unexplained emergency behavior), the CMS can provide a structured confidence rebuilding experience:

**Confidence rebuilding sequence:**

1. **Acknowledge the failure:** "We know you had an unexpected experience with [specific event]. Here is what happened." (Full replay-backed explanation)

2. **Verify current state:** "Here is what every screen in your venue is doing right now and why." (Full venue state view with resolution traces visible by default)

3. **Verify upcoming state:** "Here is what will happen in the next 24 hours and why." (Full timeline with no compression)

4. **Confirm your change works:** Guided through a single end-to-end preview → commit → verify cycle, with each step confirmed before proceeding

5. **Establish a check-in:** "Would you like a brief daily summary of any unexpected state changes for the next 7 days?" (Elevated monitoring for a short period)

This sequence is not standard workflow — it is a recovery protocol. It should be triggered by support staff when a trust failure has been identified, not by automated detection alone.

---

## Part 5 — Long-Term Trust Maintenance

---

### 5.1 Semantic Consistency

Trust in a long-running system depends on terminology that means the same thing today that it meant when the operator was trained. If the system renames concepts, redefines behaviors under the same names, or introduces synonyms that create ambiguity, operators lose confidence that their understanding is current.

**Semantic stability commitments:**
- No renaming of canonical terms without a versioned migration plan
- No behavior changes to existing features without operator communication
- Additive changes (new features) do not affect existing terminology
- When language must change (correction of a poor initial term), the change process includes: documentation update, operator communication, in-product notification, training update

**Semantic stability is a governance responsibility.** SEMANTIC-GOVERNANCE-UX-v1.md defines this system in full.

---

### 5.2 Explanation Continuity

The explanations the system provides for its own behavior must be consistent over time. An operator who received explanation E1 for a suppression event in 2025 should receive a substantively identical explanation in 2026 for the same suppression event type — not a different framing that suggests the system has changed or that their previous understanding was wrong.

**Explanation continuity requirements:**
- Reason trace language is governed by the domain language glossary
- Suppression reason codes (LEVEL_OUTRANKED, SPECIFICITY_OUTRANKED, etc.) are stable identifiers that do not change
- When explanation language is improved (made clearer, more accurate), the improvement must be documented and operators informed

---

### 5.3 Operational Memory Retention

Trust in an organization depends partly on institutional memory — knowledge that was earned through past operational experience, preserved so it doesn't have to be relearned.

When an organization has survived an override accumulation incident, cleaned it up, and learned from it — that learning must persist. If the organization's operational memory is lost (staff turnover, lack of documentation), the same incident recurs and trust in the system's reliability is damaged again.

**OPERATIONAL-MEMORY-AND-INSTITUTIONAL-LEARNING-v1.md** defines the full operational memory system. The trust implication: institutional memory is a trust maintenance mechanism. Organizations with good operational memory avoid re-learning the same trust failures.

---

### 5.4 Institutional Onboarding Continuity

New operators who join an organization with an established ClubHub TV deployment must inherit the trust state of their predecessors — not start from zero. An operator who joins a venue with a grade-A health history should learn why the venue has been well-maintained, not just how to maintain it.

**Onboarding with institutional context:**

When a new operator is onboarded to an existing venue, their onboarding should include:
- The venue's health history (not just current state)
- Any past significant incidents and their resolutions
- The venue's specific operational patterns (which campaigns are long-running, which overrides are permanent)
- The reason behind existing configurations (why was this campaign created? why is this override marked as permanent?)

This institutional onboarding produces operators who inherit accurate mental models of the specific venue, not just generic system training.

---

## Part 6 — Vertical Trust Differences

---

### 6.1 High-Chaos Environments (Sports Bars, Event Venues)

In high-chaos environments, trust is tested most frequently and most severely. Multiple operators may be active simultaneously. Interventions happen under time pressure. Unexpected events (team wins, breaking news, last-minute sponsor visits) require immediate response.

**Trust maintenance requirements for high-chaos:**
- The system must be visibly stable under chaos — its own state must remain coherent and readable even when many changes are happening fast
- Each intervention must confirm immediately (within 15 seconds) that it took effect
- Concurrent edits must be visible (concurrent edit detection prevents operators from working at cross-purposes)
- The incident coordination surface must prevent the "too many cooks" breakdown of trust

---

### 6.2 Ambient Hospitality (Hotels, Resorts)

In ambient hospitality environments, trust is maintained through consistency and predictability over long periods — weeks and months. These operators check the CMS infrequently; they rely on the system to run autonomously between checks.

**Trust maintenance requirements for ambient hospitality:**
- Long-running campaigns must not change behavior unexpectedly between operator check-ins
- Automatic notification if anything changes unexpectedly during the ambient period
- When the operator does check in, the system should show them what has happened since their last session — not just current state

---

### 6.3 Sponsorship-Sensitive Venues

For venues with significant sponsor relationships, trust includes sponsor trust — the venue's confidence that the system is delivering on their sponsor commitments, and the sponsor's confidence that the platform is reliable.

**Trust maintenance requirements for sponsorship-sensitive:**
- SOV reporting must be available at any time, for any period, without requiring pre-configuration
- Divergence between configured and delivered SOV must be acknowledged, not hidden
- Proof-of-play reports must be credible and tamper-evident (SPONSORSHIP-OPERATIONS-UX-v1.md §10.3)

---

### 6.4 Executive Trust Expectations

Executives trust platforms differently from operational users. Their trust is based on:
- Consistent, clear reporting that doesn't change its story week to week
- Absence of surprises (unexpected incidents that the platform should have predicted)
- Credible accountability — when something goes wrong, the system shows clearly what happened and why

**Executive trust failures are organizational trust failures.** An executive who loses trust in the platform may withdraw investment, mandate operational changes that increase entropy, or seek alternative systems. Their trust must be maintained through reliable summary reporting, honest incident acknowledgment, and consistent operational narratives.

---

*End of HUMAN-TRUST-AND-PREDICTABILITY-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Replay infrastructure for trust recovery: Agent 1 (Platform) requirement*
*Trust failure detection and escalation: Agent 2 (CMS) design responsibility*
