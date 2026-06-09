# ClubHub TV — Explainability UX Specification v1
# Human Interpretation Layer for PRE Decisions

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future UX contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, DOMAIN-LANGUAGE-GLOSSARY.md, FAILURE-STORIES.md, OPERATOR-MENTAL-MODELS.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Explainability Philosophy

---

### 1.1 Explainability as Trust Infrastructure

Explainability is not a UX nicety. It is the structural mechanism through which operators form accurate mental models of PRE behavior — and accurate mental models are the primary defense against entropy accumulation.

The causal chain is direct:

```
Operator cannot understand why screen X is playing content Y
    → Operator cannot predict whether their change will produce outcome Z
        → Operator experiments with overrides and direct schedules instead of campaigns
            → Each experiment creates residual state
                → Residual state accumulates into entropy
                    → System becomes increasingly opaque to everyone
```

This is not a theoretical risk. It is the mechanism documented in FAILURE-STORIES.md Story 1 ("The Campaign That Wasn't Showing") and Story 4 ("The Priority Wars"). In both cases, operator inability to see why the system was behaving as it was led to escalating intervention attempts that made the situation worse.

Explainability is entropy prevention at the source.

**Constitutional grounding:** ENGINEERING-CONSTITUTION-v1.md §4.3 — "Explainability outranks optimization." The PRE must be designed so that its decisions can be fully explained to any authorized operator at any time. This is not optional. A system that cannot explain its decisions forfeits operator trust — and operators who do not trust the system will not use it correctly.

---

### 1.2 Visibility vs Abstraction: The Wrong Trade-off

The natural instinct in UX design is to abstract complexity — to show operators a simplified view that hides the resolution hierarchy, the specificity calculations, the losing candidate chain. The intent is kindness: operators shouldn't need to understand all of that.

This instinct is wrong for ClubHub TV. It is wrong because:

**Abstraction removes the operator's ability to self-diagnose.** When content is not appearing as expected, the operator needs to know exactly why. A simplified view that says "Campaign Active" without showing what is suppressing it at a higher level gives the operator no actionable information. They cannot fix what they cannot see.

**Abstraction creates folklore.** When operators cannot verify system behavior through inspection, they infer it from observation. The inferences are often wrong — see REAL-WORLD-OBSERVATIONS.md OBS-014 ("Operators frequently infer that a higher-priority override is always needed to change what is playing, even when the actual blocker is an expired rule that was never cleaned up"). These folklore-derived mental models spread between operators and become institutional knowledge. They are harder to correct than gaps in knowledge because they feel verified by experience.

**Abstraction makes the system feel magical.** A system whose behavior cannot be explained feels unpredictable even when it is perfectly deterministic. Operators who feel the system is unpredictable respond by over-engineering their configurations — adding redundant overrides "just in case," setting higher priorities than needed "to be safe." This is entropy Pattern A (Override Accumulation) and Pattern E (Priority Escalation) in direct action.

The correct trade-off is not **visibility vs abstraction** but **visibility vs cognitive load**. The system must expose full resolution information. The UX challenge is exposing it progressively, at the right depth for the right context, without overwhelming operators who only need a surface-level answer.

Full information must always be accessible. The question is how it is presented, not whether it is present.

---

### 1.3 Why Folklore Emerges

Folklore emerges from three conditions, all of which the explainability system must address:

**Condition 1: Outcome without cause.** The operator sees what is playing but cannot see why. They form their own hypothesis. If the hypothesis is confirmed by one or two observations (even accidentally), it becomes belief.

**Condition 2: Missing failure visibility.** The operator made a change that didn't take effect. The system gave no explanation. The operator doesn't know whether their change was wrong, whether something is overriding it, or whether there is a delay. They try again, or they try harder. Both responses worsen the situation.

**Condition 3: No recovery path.** The operator knows something is wrong but cannot diagnose it. There is no structured "why isn't this working?" workflow. They escalate, or they create a workaround. The workaround becomes the permanent solution.

Each of these conditions has a direct explainability response:
- Condition 1 → Resolution traces: always show the winning rule and why it won
- Condition 2 → Suppression trees: always show what is blocking a rule that should be winning
- Condition 3 → Diagnostic workflows: guided "why is this wrong?" investigation paths

---

### 1.4 Why "Why Not?" Matters More Than "Why?"

The PRE explanation operators most need is not "why is this content playing?" The answer to that question is usually satisfying and often obvious after the fact.

The explanation operators most need is: **"Why is my content NOT playing?"**

This asymmetry is architecturally important. Consider:

- An operator creates a campaign. The campaign is configured correctly. The campaign is associated with the correct screens. The campaign has correct dates. The campaign is active.
- The screen is not showing the campaign content.
- The operator checks the campaign — it looks correct.
- The operator cannot figure out what is wrong.

The answer, structurally, is always one of:
1. Something at a higher resolution level is suppressing the campaign (LEVEL_0, LEVEL_1, or LEVEL_2 override)
2. The campaign's specificity is being outranked by a more specific rule at the same level
3. The screen is assigned to a different venue zone than the campaign targets
4. The campaign has a time window and the current time is outside it
5. The content playlist is empty or all content items have expired

None of these are visible from the campaign configuration screen alone. Finding the suppressor requires navigating to a different part of the system — or, more commonly, operators don't find it at all and assume the system is broken.

**The "why not?" question is the diagnostic question.** It is the question operators ask when something they expected to happen didn't happen. It is the question that, if unanswered, leads directly to override creation and entropy accumulation.

The explainability system must be designed around this question as a primary design driver, not a secondary feature.

---

### 1.5 Transparency as Operator Respect

There is a values claim embedded in the explainability philosophy: operators are capable of understanding the system when it is explained correctly. Hiding complexity from operators is not protecting them — it is assuming they cannot handle the reality of how the system works.

This assumption is wrong and harmful. The operators of ClubHub TV venues are responsible adults managing real business operations. They are managing compliance obligations, sponsor relationships, and event coordination. They can handle a 7-level resolution hierarchy if it is explained in plain language.

The design commitment: **never hide information to protect the operator from complexity**. Present complexity at the right level, in the right context, with the right language. But present it.

---

## Part 2 — Core Questions the System Must Answer

---

The explainability system is organized around seven questions. Every explainability surface in the CMS must contribute to answering one or more of these questions. If a surface does not answer any of these questions, its explainability value is low.

---

### Q1: "Why is this playing?"

**The question operators ask when:** Content is playing on a screen and the operator wants to understand why — either to verify the system is working as intended, or because they see unexpected content and want to understand the source.

**What the answer requires:**
- The winning rule: which rule won the PRE resolution, at which level, with which specificity
- The rule's provenance: when was this rule created, by whom, as part of what configuration object (campaign, override, default)
- The rule's validity window: how long will this rule continue to win

**Answer format (plain language):**
```
This screen is showing [CONTENT_NAME] because:
  → [RULE_SOURCE] is active at [RESOLUTION_LEVEL]
  → It has been active since [START_TIME] and expires [EXPIRY or "no expiry set"]
  → Created by [OPERATOR_NAME] on [DATE]
  → [N other rules were considered but did not win — tap to see why]
```

**Failure mode if not answered:** Operators assume content is playing by default or by coincidence. They do not understand that a specific rule is responsible. When they want to change the content, they create a new rule rather than modifying the existing one.

---

### Q2: "Why did this rule lose?"

**The question operators ask when:** They know a rule exists (campaign, override, scheduled content) and they know it should be applying to a screen, but it is not. They want to understand why it lost the resolution decision.

**What the answer requires:**
- The specific reason the rule lost: was it outranked by a higher-level rule, outranked by a more specific rule at the same level, outside its validity window, or assigned to a different scope
- The rule that beat it: the identity, level, and specificity of the winning rule
- The margin of difference: is this a close contest (same level, different specificity) or a clear hierarchy gap (different levels)

**Answer format:**
```
[RULE_NAME] is not currently active on this screen because:
  → [WINNING_RULE] at [LEVEL] is taking precedence
  → [WINNING_RULE] is [more specific / higher level] — this is expected behavior
  → To make [RULE_NAME] take effect, you would need to: [action path]
```

**Failure mode if not answered:** This is the exact failure mode documented in FAILURE-STORIES.md Story 1. The campaign manager could not see that an operational override was suppressing the campaign. They escalated the campaign priority, which created a conflict with the override. The campaign still didn't show. They escalated further. The priority conflict became a system-wide issue.

---

### Q3: "What is suppressing this?"

**The question operators ask when:** Content they created is not appearing and they want to find the specific suppressor. This is the "why not?" investigative mode — a deeper version of Q2 for when the operator is actively trying to diagnose a problem.

**What the answer requires:**
- A suppression tree: the full chain of rules evaluated for this screen at this time, ordered by resolution level, with the outcome of each evaluation
- The blocking rule highlighted: which rule is the active suppressor
- The suppression reason: clear language about why the suppressor beats the suppressed rule

**Answer format (suppression tree):**
```
Resolution trace for [SCREEN_NAME] at [TIME]:

  LEVEL_0 Emergency: [No active emergency] — PASS
  LEVEL_1 Operational Override: [OVERRIDE_NAME] ← WINNER
    → Active since [DATE], expires [DATE]
    → Scope: [SCOPE]
    → Created by [OPERATOR]
  LEVEL_2 Scheduled Override: [Not evaluated — LEVEL_1 already resolved]
  LEVEL_3 Campaign: [CAMPAIGN_NAME] ← SUPPRESSED by LEVEL_1
  ...
```

**Failure mode if not answered:** Operators who cannot see the suppression tree treat the system as a black box. They try to fix a problem at the wrong level — adjusting the campaign when the suppressor is an override, or adjusting the override when the suppressor is an emergency. They cannot solve the problem systematically because they cannot see the system structure.

---

### Q4: "What changed?"

**The question operators ask when:** Content was playing correctly yesterday and is not today, or a screen changed behavior unexpectedly. They need to identify the causal event.

**What the answer requires:**
- A provenance timeline: the chronological sequence of configuration events that affected this screen's resolution
- The most recent change: what changed, when, by whom, and how it affects current behavior
- The delta: what was playing before vs. what is playing now, and which rule change caused the transition

**Answer format:**
```
This screen's content changed at [TIME]:
  → [CHANGE_EVENT]: [OPERATOR] [action] [RULE_NAME] at [TIME]
  → Before this change: [PREVIOUS_CONTENT] was showing via [PREVIOUS_RULE]
  → After this change: [CURRENT_CONTENT] is showing via [CURRENT_RULE]
  → [N other changes in the last 7 days — tap to see full history]
```

**Failure mode if not answered:** Without provenance visibility, operators who experience unexpected behavior have no mechanism for understanding what caused it. They cannot roll back the causal event because they cannot identify it. They create new overrides to force the desired outcome, which compounds the configuration entropy.

---

### Q5: "What plays next?"

**The question operators ask when:** They want to verify upcoming content transitions — particularly before events (tournament day, happy hour, compliance period) or after making changes they want to verify will take effect.

**What the answer requires:**
- The next rule transition: when the current winning rule expires or is scheduled to end, what rule takes over
- The transition chain: the ordered sequence of rule transitions for the next N hours
- Warning if any transition produces an unexpected result: coverage gaps, unintended content, expired rules with no fallback

**Answer format:**
```
Upcoming transitions for [SCREEN_NAME]:
  [NOW] → [CONTENT] via [RULE] (currently active)
  [TIME_1] → [CONTENT] via [RULE] (when [CURRENT_RULE] expires)
  [TIME_2] → [CONTENT] via [RULE] (scheduled transition)
  [TIME_3] → ⚠ Coverage gap — no rule active, fallback will apply
```

This is the Interruption Forecasting surface from PREVIEW-SYSTEMS-SPEC-v1.md Mode 7, integrated into the explainability context.

**Failure mode if not answered:** Operators create emergency overrides before events because they cannot verify that the scheduled content will take effect. "I couldn't check, so I added an override to be sure" is the direct path to Override Accumulation (Entropy Pattern A).

---

### Q6: "What resolution layer won — and why?"

**The question operators ask when:** They understand that there is a priority hierarchy and they want to understand which layer of the hierarchy is controlling this screen right now — not just what content is playing, but at what structural level the decision was made.

**What the answer requires:**
- The active resolution level: LEVEL_0 through LEVEL_6, with a plain-language description of what that level means
- Why this level won: the specific content of the winning rule at this level
- The operational implication: what would need to change to affect content at this level

**Answer format:**
```
[SCREEN_NAME] is currently controlled at:
  LEVEL_1 — Operational Override
  "Operational overrides are immediate changes applied outside the campaign schedule.
   They take precedence over all campaign content and scheduled overrides."

  Active override: [OVERRIDE_NAME]
  To change this screen's content: modify or remove this override, or create a
  higher-level override. Campaign changes will not take effect while this override is active.
```

**Failure mode if not answered:** Operators who do not understand resolution levels treat all configuration objects as equivalent. They cannot predict which change will take effect. They create multiple competing rules hoping one will "win" — which is entropy Pattern D (Campaign Fragmentation) and Pattern E (Priority Escalation) genesis.

---

### Q7: "What would happen if…?"

**The question operators ask when:** They want to understand the consequences of a change they are considering before they make it — the counterfactual question. This is the preview system's primary use case, but it applies equally to the explainability context.

**What the answer requires:**
- A simulation of the proposed change applied to current state
- The difference between current behavior and post-change behavior: which screens change, what content changes, what transitions change
- Side effects: are there other rules that would be affected by the change, or rules that would suddenly become active or inactive

**Answer format:**
See PREVIEW-SYSTEMS-SPEC-v1.md Mode 4 (Override Impact Simulation) — the "what would happen if?" answer for overrides. The same pattern applies to campaigns, schedule changes, and content item changes.

**Failure mode if not answered:** Without counterfactual simulation, operators make changes and observe the outcome. If the outcome is unexpected, they create another change to correct it. Each correction adds state. Iterative correction through observation-and-override is the primary mechanism of entropy accumulation.

---

## Part 3 — Explainability Surfaces

---

### 3.1 Resolution Traces

**Definition:** A resolution trace is the complete record of the PRE's decision for a specific screen at a specific time. It shows every rule evaluated, the level at which it was evaluated, why it won or lost, and the final output.

**Source:** The `reason_trace` field from the PRE output. This is an existing constitutional output field — the UX surface renders it, it does not compute it.

**UX rendering requirements:**

The resolution trace must be rendered as a structured tree, not a flat list. The tree structure reflects the hierarchical nature of the resolution process.

```
Resolution for [SCREEN_NAME] at [TIME]
├── LEVEL_0: Emergency [CLEAR — no active emergency]
├── LEVEL_1: Operational Override [ACTIVE — WINNER]
│   └── Rule: [OVERRIDE_NAME]
│       Created: [DATE] by [OPERATOR]
│       Scope: [SCOPE_DESCRIPTION]
│       Expires: [DATE or "no expiry — ⚠"]
│       Content: [CONTENT_NAME]
├── LEVEL_2: Scheduled Override [NOT EVALUATED — LEVEL_1 resolved]
├── LEVEL_3: Campaign [NOT EVALUATED — LEVEL_1 resolved]
│   └── (Would have matched: [CAMPAIGN_NAME] — suppressed by LEVEL_1)
└── LEVEL_4–6: [NOT EVALUATED — LEVEL_1 resolved]
```

**Display contexts:**
- Screen detail view: always available as "Why is this playing?" link
- Override creation flow: preview trace shown before confirmation
- Campaign management: "Why is this campaign not showing?" diagnostic entry point
- Emergency management: trace showing emergency scope and affected screens

**Depth levels:**
- Summary level: shows winning level and winning rule only (for operators who just want confirmation)
- Intermediate level: shows all evaluated rules and their outcomes
- Full level: shows all evaluated rules including non-evaluated levels, with specificity scores and exact match criteria (for diagnostics)

**Language requirements:**
- Resolution levels must be described in plain language, not technical identifiers
- LEVEL_0 = "Safety Emergency" (not "LEVEL_0")
- LEVEL_1 = "Operational Override"
- LEVEL_2 = "Scheduled Override"
- LEVEL_3 = "Campaign / Schedule"
- LEVEL_4 = "Sponsor Injection"
- LEVEL_5 = "Fallback Schedule"
- LEVEL_6 = "Device Default"

---

### 3.2 Suppression Trees

**Definition:** A suppression tree is a visualization of why a specific rule is NOT winning. It is the diagnostic complement to the resolution trace — while the trace explains what won, the suppression tree explains what lost and why.

**Entry point:** The suppression tree is accessed when an operator asks "why isn't [RULE_NAME] showing?" — either through a direct search, or through a diagnostic entry point on the rule's configuration screen.

**Suppression classification:**

Every suppressed rule is suppressed for exactly one of five reasons:

| Code | Plain Language | Display Color |
|------|----------------|---------------|
| LEVEL_OUTRANKED | A higher-priority rule is active | Red — action may be required |
| SPECIFICITY_OUTRANKED | A more targeted rule at the same level wins | Amber — review targeting |
| WINDOW_INACTIVE | This rule is outside its scheduled time window | Grey — expected behavior |
| SCOPE_MISMATCH | This rule does not target this screen | Blue — targeting issue |
| CONTENT_EMPTY | This rule's content is empty or expired | Red — content issue |

**UX rendering requirements:**

```
[RULE_NAME] is not active on [SCREEN_NAME]

Suppression reason: LEVEL_OUTRANKED
  → [WINNING_RULE] at LEVEL_1 (Operational Override) is taking precedence
  → This campaign operates at LEVEL_3 (Campaign / Schedule)
  → LEVEL_1 always takes precedence over LEVEL_3

  The winning override:
    Name: [OVERRIDE_NAME]
    Created: [DATE] by [OPERATOR]
    Expires: [DATE]
    ↳ After [DATE], this campaign will resume if it is still active and targeted

  To change this:
    Option A: Remove or modify the override → [link]
    Option B: This suppression is intentional → no action needed
```

**Note on action paths:** The suppression tree must always provide at least one actionable path forward. Explaining why something is not working without explaining how to fix it is an incomplete explainability experience. If the fix is "no action needed," that is also an acceptable answer — it tells the operator the system is working as designed.

---

### 3.3 Losing Candidate Visibility

**Definition:** Losing candidate visibility shows the full roster of rules that were evaluated but did not win for a given screen/time, in order of their evaluation, with their loss reasons.

This is distinct from the suppression tree (which focuses on one specific rule) — losing candidate visibility shows ALL losing rules, giving a complete picture of "what else was trying to show on this screen."

**When this matters:**

An operator configuring a new campaign may want to know: are there other rules competing for this screen that might suppress my campaign? The answer requires seeing all losing candidates, not just the winner.

Losing candidate visibility also reveals:
- **Zombie overrides:** old overrides that are still in the resolution chain even though the operator thinks they were "done"
- **Redundant rules:** multiple rules at the same level with the same scope, suggesting unnecessary duplication
- **Conflicting priorities:** multiple rules at the same level with different priorities, suggesting manual priority escalation history

**UX rendering:**

Show in the screen detail view as a collapsible section: "Other rules considered for this screen." Default collapsed — expanding reveals the full losing candidate list. This follows the progressive disclosure principle: the information is accessible without being forced on operators who don't need it.

---

### 3.4 Provenance Timelines

**Definition:** A provenance timeline is a chronological record of all configuration events that affected a specific screen's resolution — what rules were created, modified, activated, and deactivated for this screen over time, and by whom.

**Scope:** The provenance timeline answers Q4 ("What changed?") in full historical form. It is the audit trail for a screen's content history.

**Timeline entry format:**
```
[TIMESTAMP] — [OPERATOR] [ACTION] [RULE_NAME]
  Effect: [Screen transitioned from X to Y] / [No immediate effect — rule queued]
  Current relevance: [Still active] / [Has since expired] / [Was overridden by ...]
```

**Time range:** Default 7 days, configurable to 30 days, 90 days, or custom range.

**UX access points:**
- Screen detail view → "Content History" tab
- Override management → "History" tab on individual override
- Incident investigation workflow → the provenance timeline is the primary investigation tool

**Failure mode to prevent:** Provenance timelines must show operator attribution for every action. Anonymous configuration changes (system events excepted) are a governance failure. If an operator cannot see who made a change, they cannot ask that person about intent, and they cannot hold anyone accountable for entropy-causing behavior.

---

### 3.5 Operational Causality Chains

**Definition:** An operational causality chain is a visualization of the multi-step sequence of operator actions and system responses that led to the current state. It goes beyond the provenance timeline (which records events) to show how events causally connected to produce current behavior.

**When this is needed:**

Causality chains are needed when the current state is the result of multiple prior actions and the relationship between them is not obvious. The primary use case is incident investigation: "How did this screen end up in this state?"

**Example causality chain visualization:**

```
Current state: Screen is showing emergency content that was never cleared

Causality chain:
  2026-03-15 09:23 — [OPERATOR_A] created EMERGENCY_001 for tournament delay
  2026-03-15 14:07 — [OPERATOR_B] modified CAMPAIGN_005 (unrelated to emergency)
  2026-03-15 17:00 — [OPERATOR_A] logged out; shift ended
  2026-03-16 08:00 — No operator action (emergency still active)
  ...
  2026-04-02 — TODAY — EMERGENCY_001 is 18 days old with no expiry
  ↳ ROOT CAUSE: Emergency created without expiry date; no operator cleared it
```

**This is operationalization of FAILURE-STORIES.md Story 2 ("The Emergency That Wasn't").** The failure was invisible because there was no causality chain surface to show the 18-day-old emergency.

---

### 3.6 Replay Introspection

**Definition:** Replay introspection is the ability to reconstruct what the PRE would have computed for any screen at any past time, using historical system state. It answers: "What was this screen showing at 7:30 PM last Thursday, and why?"

**Architectural dependency:** Replay introspection requires that historical system state is preserved and that the PRE is called with historical state (not current state) for the target timestamp. This is an Agent 1 implementation requirement.

**UX access points:**
- Screen detail view: "What was playing at…?" time picker
- Incident investigation workflow: "Reconstruct what happened" entry point
- Compliance audit: "Show me what was playing on gaming screens during [audit period]"

**Rendering:** The replay introspection surface renders identically to the live resolution trace, but with clear timestamp and "historical replay" labeling to prevent operators from treating historical output as current state.

**Constitutional requirement (INV-3):** Because the PRE is deterministic, replay introspection using preserved historical state will always produce the same result as the original live computation. The accuracy of replay is guaranteed by determinism — not by caching or logging.

---

### 3.7 Divergence History

**Definition:** Divergence history shows the record of times when the PRE's prediction (the preview result) differed from what was actually delivered (as recorded in the delivery log). This surface answers: "Has the preview system been accurate for this screen?"

**Purpose:** Divergence history is a trust calibration surface. If operators know that previous previews were accurate, they trust future previews. If previous previews were inaccurate, operators need to know — both to calibrate their trust and to identify the cause.

**Divergence categories:**

| Category | Description | Typical Cause |
|----------|-------------|---------------|
| CONFIG_CHANGE | A configuration change occurred between preview and playback | Another operator modified state in the interval |
| DEVICE_OFFLINE | Device was offline during expected delivery window | Network or device failure |
| INPUT_SWITCHED | Screen was switched to non-ClubHub input | HDMI switch or manual input change |
| DELIVERY_TIMEOUT | Manifest polling failed to deliver in expected window | Network instability |
| UNEXPECTED | Delivery log diverges from PRE prediction with no known cause | Requires investigation |

**UNEXPECTED divergences require investigation.** If the PRE output and the delivery log disagree for reasons that are not hardware/network related, it indicates a possible PRE invariant violation. This is a high-severity signal.

**Display:** Show divergence history as a rolling 30-day summary with trend. If divergence rate is increasing, flag it as an entropy signal.

---

## Part 4 — Cognitive Load Management

---

### 4.1 Progressive Disclosure Architecture

The explainability system contains a significant volume of information. Presenting all of it simultaneously would overwhelm operators and, paradoxically, reduce their ability to understand what is happening.

Progressive disclosure is the mechanism for managing this volume. It is not the same as hiding information — information is never hidden. It is the structured sequencing of information depth, with each level accessible on demand.

**Three disclosure levels:**

**Level 1 — Surface Answer**
One sentence. Answers the most likely operator question in the most compact form.

```
"This screen is showing [CAMPAIGN_NAME] via your active campaign."
"This campaign is not showing because an operational override is active."
"This screen has no content scheduled for this time window."
```

Level 1 is the default. It appears inline in the screen view without requiring any navigation.

**Level 2 — Explanation**
Two to five items. Identifies the key actors: what rule is active, who created it, when it expires. Provides one-tap action paths.

Level 2 is accessed by expanding the Level 1 answer, or by tapping "Why?" or "How do I fix this?"

**Level 3 — Full Resolution Trace**
Complete PRE resolution trace with all evaluated rules, all losing candidates, specificity scores, and provenance attribution.

Level 3 is accessed via "Show full resolution details" — a deliberate action from Level 2. It is the diagnostic surface for operators actively investigating a problem.

**Never suppress Level 3.** If an operator wants the full trace, they must be able to access it. The progressive disclosure architecture provides a path through the information, not a barrier to it.

---

### 4.2 Layered Detail Depth

Different explainability surfaces have different natural detail depths. The progressive disclosure architecture applies consistently:

| Surface | Level 1 Default | Level 2 On Expand | Level 3 On Request |
|---------|----------------|------------------|-------------------|
| Screen status indicator | Icon + one-line status | Winning rule + expiry | Full resolution trace |
| Campaign "why not showing?" | Suppression reason | Suppressor identity + action path | Full suppression tree |
| Override creation flow | Impact summary | Affected screens list | Per-screen resolution preview |
| Content history | Last change timestamp | Change event + operator | Full provenance timeline |
| Emergency status | Active/clear indicator | Emergency rule details + scope | All affected screens + causality |

---

### 4.3 Novice vs Expert Explainability

**The novice operator's question:** "Why isn't my content showing?"
The novice needs: a plain-language explanation of what is blocking the content, and a direct path to fix it.

**The expert operator's question:** "What is the exact specificity score of this rule, and is there a conflicting rule at the same level that I haven't noticed?"
The expert needs: the full resolution trace with specificity scores, all competing candidates, and level/scope details.

**Design requirement:** The system must serve both without requiring the novice to navigate expert interfaces or requiring the expert to be blocked by novice-optimized abstractions.

The progressive disclosure architecture achieves this — Level 1 serves the novice, Level 3 serves the expert, and both are always accessible from the same entry point.

**Language adaptation by role:**

| Term | Novice language | Expert language |
|------|-----------------|-----------------|
| LEVEL_1 | "A manual override is blocking this" | "Operational Override — LEVEL_1" |
| Specificity score | "This rule is more specifically targeted" | "Specificity score: SPEC_3 > SPEC_2" |
| SWRR weight | "This content shows more often" | "Weight: 3.0 in SWRR cycle" |
| Reason trace | "Here's why this is showing" | "Reason trace: {level: 1, rule_id: ...}" |

**Implementation note:** The CMS should adapt language based on operator role, not individual preference. Floor Operators receive novice language by default. Org Admins and Technical operators can toggle to expert language in settings.

---

### 4.4 Operational Compression Techniques

Operators working at speed — during event preparation, during operational incidents — cannot afford to read detailed explainability trees. The system must be able to communicate critical information in compressed forms appropriate to high-urgency contexts.

**Compression technique 1: Status icons with semantic meaning**

Each resolution level has an assigned icon and color that communicates the level's operational nature at a glance. The icon is visible in screen status indicators without requiring expansion.

| Level | Icon | Color | Meaning at a glance |
|-------|------|-------|---------------------|
| LEVEL_0 | ⚠ | Red | Emergency active — everything else suppressed |
| LEVEL_1 | 🔒 | Amber | Manual override active — campaigns not showing |
| LEVEL_2 | 🗓 | Amber | Scheduled override active — campaigns may not show |
| LEVEL_3 | 📋 | Green | Campaign active — normal operations |
| LEVEL_4 | 💰 | Blue | Sponsor injection active |
| LEVEL_5 | ↩ | Grey | Fallback content only — no campaign matched |
| LEVEL_6 | 📺 | Dark grey | Device default — no configured content |

An operator scanning a screen list can immediately see which screens are in emergency, which have active overrides, and which are running normally — without reading any text.

**Compression technique 2: One-line diagnostic messages**

When a screen is in an unusual state, the one-line Level 1 diagnostic message must be specific enough to be actionable:

✓ Good: "Manual override active — expires Saturday 18:00"
✗ Bad: "Override active"

✓ Good: "Campaign not matching — check dates: campaign ends tomorrow"
✗ Bad: "Campaign issue"

✓ Good: "No content scheduled for this window — fallback is playing"
✗ Bad: "Playing fallback"

Vague status messages do not aid operator understanding. They are the operational equivalent of "an error occurred."

**Compression technique 3: Action prompts over information dumps**

In high-urgency contexts, compress explainability into a decision frame:

```
[SCREEN_NAME] is showing emergency content
  Emergency: [EMERGENCY_NAME]
  Active for: 18 days

  → Clear emergency and restore normal scheduling
  → Review emergency content
  → See full details
```

This compression presents the most important fact (18 days), the most important actions (clear it or review it), and a path to full details if needed.

---

## Part 5 — Dangerous Explainability Failures

---

This section documents the explainability failure modes that must be actively designed against. Each represents a pattern where an attempt at "helpful" design actually degrades operator understanding.

---

### F-01: Oversimplification — Hiding the Resolution Model

**The failure:** The UX shows operators only the "happy path" — what is playing, clean and simple. The resolution hierarchy, the suppressed rules, the losing candidates are all hidden behind a polished "this screen is showing Campaign X" summary.

**Why it seems reasonable:** It looks clean. It looks professional. It doesn't overwhelm operators with complexity they don't need most of the time.

**Why it is dangerous:** When the operator needs to diagnose a problem, the resolution model is invisible. They cannot identify the suppressor, the level conflict, or the scope mismatch. They cannot self-serve. They call support, or they create an override.

**The invariant it violates:** ENGINEERING-CONSTITUTION-v1.md §4.3 — "Explainability outranks optimization."

**Detection signal:** If an operator needs to call support or create an override to diagnose what is blocking their content, the UX has failed the explainability requirement.

---

### F-02: Hidden Suppression — The Silent Override

**The failure:** An operational override is active and suppressing all campaigns on a screen. The campaign management view shows the campaign as "Active." The screen list shows the screen as "Showing content." There is no visible signal that the override exists.

**Why it happens:** Each view is correct in its own context — the campaign IS active (not deleted, not paused), and the screen IS showing content (the override's content). The UX is technically accurate and nonetheless completely misleading.

**Why it is dangerous:** This is the exact failure mode of FAILURE-STORIES.md Story 1. The campaign manager spent hours trying to understand why the campaign wasn't showing. The override was invisible from the campaign view.

**The fix:** Cross-reference visibility. The campaign view must show whether the campaign is currently winning on each of its targeted screens, or what is suppressing it. "Active" should never mean "configured correctly but not showing" without explanation.

---

### F-03: False Confidence — Certainty Where There Is Uncertainty

**The failure:** The explainability surface presents resolution results with 100% certainty in contexts where future state is actually uncertain. "Your campaign will play at 7 PM on Friday" stated flatly, with no indication that an active override expiring at 6:59 PM is making this prediction depend on the override actually expiring.

**Why it happens:** Simple language removes conditional clauses. "Will play" sounds confident. "Should play, assuming the current override expires as scheduled and no new overrides are created between now and then" sounds anxious.

**Why it is dangerous:** Operators who receive false confidence make operational decisions based on it. They do not add verification steps they would otherwise add. When the reality diverges from the confident prediction, the system's credibility suffers.

**The fix:** Conditional predictions must be marked as conditional. See PREVIEW-SYSTEMS-SPEC-v1.md §4 (Confidence Modeling) — CONDITIONAL and UNCERTAIN prediction zones require explicit qualification language, not flat assertions.

---

### F-04: Ambiguous Terminology — When Words Mean Different Things

**The failure:** Using the word "priority" to mean multiple different things in the same interface. Or using "override" to describe both LEVEL_1 (Operational Override) and LEVEL_2 (Scheduled Override) without distinction. Or describing content as "scheduled" when it is actually managed by a campaign with a schedule attached.

**Why it happens:** The system uses precise technical vocabulary. The UX translates this into "plain language" that is actually imprecise and ambiguous.

**Why it is dangerous:** Operators who internalize ambiguous vocabulary apply it incorrectly. "Just add a higher priority" as a problem-solving strategy emerges from operators who have learned that "priority" controls what shows — but they don't understand that the relevant "priority" is the resolution level, not the content weight. This is FAILURE-STORIES.md Story 4 ("The Priority Wars") genesis.

**The fix:** Use the canonical vocabulary from DOMAIN-LANGUAGE-GLOSSARY.md consistently. Translate resolution levels to plain language but do so consistently. Never use the same word for two different concepts. When a concept is introduced, define it the first time it appears in context.

---

### F-05: Invisible Overrides — What Exists Is Not Shown

**The failure:** The screen list, venue view, or schedule view does not visually distinguish screens that are currently under active overrides from screens in normal campaign-driven operation. Everything looks the same.

**Why it happens:** Visual uniformity is a common design preference. A "clean" interface treats all states identically.

**Why it is dangerous:** Overrides that are invisible normalize. An operator who sees that all screens look the same in the interface infers that all screens are in the same state. When something is wrong with a screen that has an orphaned override, the invisible-override UX gives no diagnostic starting point.

**INSIGHT-002 from OPERATIONAL-INSIGHTS-LOG.md directly describes this failure:** "Operators experience the priority stack as 'sometimes my content doesn't show' — a mysterious failure mode without an obvious cause."

**The fix:** Override state must be visually encoded in every context where screen state is displayed. No view of a screen's status should omit the active override indicator if one exists.

---

### F-06: Replay Mismatch — When the Explanation Doesn't Match Reality

**The failure:** The explainability surface shows a resolution trace that differs from what was actually delivered. This can happen if: the trace was computed at a different time than delivery, the state was modified between preview and delivery, or a device was offline and served stale manifest data.

**Why it is dangerous:** This is the most destructive explainability failure. If operators discover that "why is this playing?" answers don't match what they observe on screens, they will stop trusting the explainability system entirely. A mistrusted explainability system drives operators directly to folklore-based workarounds.

**FAILURE-STORIES.md Story 7 ("The Preview That Lied") is precisely this failure.** A preview showed content A would play. Content B played. The operator concluded previews were unreliable and stopped using them. They returned to the over-override strategy.

**The fix:** Resolution traces must be computed from the same state as delivery, or clearly marked with their computation timestamp and state version. Divergences between predicted traces and delivery log must be surfaced in the divergence history (Section 3.7) and flagged as anomalies requiring investigation.

---

## Part 6 — Vertical Differences

---

Different market verticals have different primary explainability needs. The same information architecture serves all verticals, but the emphasis, default view, and urgency model differ.

---

### 6.1 Urgency-Driven Verticals (Sports Bars, Golf Tournaments, Licensed Clubs During Events)

**Primary explainability need:** Real-time state visibility during event operations.

**What this means for the UX:**
- Resolution traces must be accessible in 2 taps from any screen view
- Suppression reasons must be immediately visible — no expansion required
- Override attribution must show the creator's name, because during live events operators need to know who created an override to coordinate with them
- The "what changed?" timeline must have a "last 2 hours" shortcut, not just the default 7-day view
- Status indicators for all venue screens must be visible on a single summary screen accessible from the main navigation

**Operator behavior in urgency mode:** See OPERATOR-MENTAL-MODELS.md §4.3 — operators in urgency mode skip full diagnostic flows. The Level 1 compressed answer (Section 4.4) must be accurate enough to act on without requiring Level 3 expansion.

**Critical failure to prevent:** An operator in event mode who encounters the "show full resolution details" path and has to navigate through 3 levels of progressive disclosure to find out why a screen is wrong is an operator who will create an override instead. In urgency-driven verticals, the explainability must surface the answer before the override is created, not after.

---

### 6.2 Hospitality Verticals (Hotels, Resorts, Restaurants)

**Primary explainability need:** Content provenance for brand compliance.

**What this means for the UX:**
- Content playing on screens must always show the content item's source: which campaign, which content library, which version
- Provenance timelines must be accessible for brand audit purposes: "show me what was playing in the lobby between 5 PM and 7 PM on [date]"
- Sponsor injection visibility (LEVEL_4) must be clear — hospitality operators need to distinguish their own content from sponsor-injected content
- Zone-level explainability: hotels and resorts operate screens in multiple zones with different content requirements; the explainability surface must reflect zone context

**Operator behavior in hospitality mode:** Hospitality operators are often performing brand compliance reviews — scheduled audits, not real-time diagnosis. The provenance timeline and replay introspection surfaces are the primary explainability tools for this vertical.

---

### 6.3 Sports-Event Verticals (Golf Clubs, Sports Clubs)

**Primary explainability need:** Pre-event configuration verification.

**What this means for the UX:**
- The "what plays next?" (Q5) surface is the primary entry point — tournament organizers want to verify their configuration before the event, not diagnose it during
- Campaign coverage verification: "Is every screen showing the right content during the tournament?" requires a venue-wide coverage summary view
- Leaderboard screen explainability: the leaderboard screen is a special case — operators need to understand when it is showing live data vs fallback content, and why
- Interruption forecasting must cover the entire tournament window (4–8 hours), not just the next few transitions

**Operator behavior in sports-event mode:** Pre-event. The operator has a checklist. Explainability surfaces should map to that checklist: "Is emergency cleared?", "Is sponsor content configured?", "Is fallback content set if live data is unavailable?"

---

### 6.4 Sponsor-Centric Contexts (Any Venue with Active Sponsor Relationships)

**Primary explainability need:** Sponsor obligation verification.

**What this means for the UX:**
- Sponsor injection (LEVEL_4) must be explicitly visible in every resolution trace — it cannot be folded into generic "content" language
- SOV (share of voice) reporting must be linked from the resolution trace: "This sponsor's content is playing. Their contracted SOV is 25%. Current rolling 7-day SOV: 19%."
- When sponsor content is being suppressed by a higher level, the suppression must be clearly marked as a potential contract obligation issue, not just a technical state

**Failure to prevent:** A sponsor whose contracted SOV is not being delivered because a venue operator added overrides that crowd out the sponsor injection window is an invisible failure. The operator may not realize the overrides are affecting sponsor SOV. The explainability surface must surface this visibility: "Active overrides are reducing [SPONSOR]'s share of voice from contracted 25% to current 18%. Review overrides."

---

## Part 7 — Explainability Surface Implementation Requirements

---

### 7.1 Data Requirements for Agent 1

The explainability surfaces described in this document require the following API inputs from the PRE runtime (Agent 1 scope):

| Data | Description | Format |
|------|-------------|--------|
| `reason_trace` | Full resolution trace for PRE output | Structured JSON per PRE spec |
| `losing_candidates` | All rules evaluated but not winning | Array ordered by evaluation sequence |
| `specificity_scores` | Numeric specificity for each candidate | Per PRE specificity hierarchy |
| `historical_state_replay` | PRE evaluation against preserved historical state | Endpoint accepting `(screen_id, timestamp)` |
| `config_event_log` | Timestamped record of all configuration events affecting a screen | Append-only log per screen |
| `delivery_log` | Actual delivery records from device poll confirmations | Per manifest delivery |

Agent 3 does not implement these. Agent 1 is responsible for exposing them via API. The explainability UX surfaces render this data.

### 7.2 Language and Terminology Requirements

All explainability surfaces must use terminology consistent with DOMAIN-LANGUAGE-GLOSSARY.md. Specific requirements:

- Resolution levels are always described in plain language in primary text, with the technical level identifier (LEVEL_0, etc.) available in Level 3 detail
- "Override" always specifies the type: "Operational Override" or "Scheduled Override"
- "Priority" is never used as a verb ("high priority override") unless referring specifically to content weight within a SWRR playlist
- "Schedule" refers to configured time windows for rules; "Campaign" refers to managed promotional content objects — these are not interchangeable
- Confidence scores are always presented as classifications (STABLE / CONDITIONAL / UNCERTAIN / LOW CONFIDENCE) in primary text, with numeric scores available in Level 3 detail
- Attribution is always present: "Created by [OPERATOR] on [DATE]" — anonymous actions are not surfaced without investigation note

### 7.3 Accessibility and Performance Requirements

**Performance:**
- Level 1 (surface answer) must render within 200ms — it is inline in the screen view
- Level 2 (explanation) must render within 500ms on expansion
- Level 3 (full trace) must render within 1000ms on request
- Historical replay queries must complete within 3000ms for queries within 90-day window

**Accessibility:**
- All status icons must have text alternatives — icon-only status is not acceptable
- Color is never the only differentiator — all color-coded states have shape or text reinforcement
- Screen status summary view must be readable at venue network speeds (graceful degradation for slow connections)

---

## Appendix A — Explainability Coverage Audit

For each major CMS view, this table maps the view to the Q1–Q7 questions it must answer and the explainability surfaces it must include.

| CMS View | Must Answer | Required Surfaces |
|----------|-------------|------------------|
| Screen detail view | Q1, Q2, Q3, Q4, Q5 | Resolution trace, Suppression tree (on demand), Provenance timeline, Interruption forecast |
| Campaign management view | Q2, Q3, Q6 | Per-screen winning status, Suppression reason if not winning |
| Override creation flow | Q7 | Impact simulation preview (mandatory before confirmation) |
| Override list view | Q1, Q4 | Status by screen, Attribution, Expiry |
| Emergency management | Q1, Q4, Q6 | Scope visualization, Causality chain, Duration indicator |
| Venue health dashboard | Q1, Q5 | All-screens status summary, Entropy indicators |
| Content audit / compliance | Q1, Q4 | Replay introspection, Provenance timeline |
| Sponsor management | Q1, Q3 | SOV tracking, Suppression visibility |

---

## Appendix B — Explainability Anti-Patterns Reference

Quick reference of the six dangerous explainability failures with their detection signals:

| Failure | Code | Detection Signal |
|---------|------|------------------|
| Oversimplification | F-01 | Operator contacts support to find why campaign isn't showing |
| Hidden Suppression | F-02 | Campaign shows "Active" but not delivering; operator can't see why |
| False Confidence | F-03 | Preview said X, delivery was Y; no conditional language was shown |
| Ambiguous Terminology | F-04 | "Priority" used to mean both resolution level and content weight |
| Invisible Overrides | F-05 | Screen list shows no distinction between override-active and normal screens |
| Replay Mismatch | F-06 | Explanation trace differs from delivery log without flagging |

---

*End of EXPLAINABILITY-UX-SPEC-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Review required for changes to: Sections 2 (Core Questions), 3 (Surfaces) — requires Agent 2 coordination*
*Review required for changes to: Section 3.1 (Resolution Traces), 3.6 (Replay Introspection), 3.7 (Divergence History) — requires Agent 1 coordination*
