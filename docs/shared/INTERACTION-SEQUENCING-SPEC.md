# ClubHub TV — Interaction Sequencing Specification
# Shared Operational Intelligence Layer — Phase A: Canonical Interaction Governance

**Document type:** Interaction constitution — legal ordering of operational interactions
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 2 (workflow governance); operational leadership
**Last updated:** 2026-05-24
**Status:** CANONICAL — interaction flows not conforming to this spec are not eligible for deployment
**Phase:** A — Canonical Interaction Model (doctrine translation layer)

---

## Purpose

This document defines the legal ordering of operational interactions in ClubHub TV. It answers the question: when an operator wants to take a consequential operational action, in what sequence must steps occur, and why does that sequence matter?

The threat this document addresses: **interaction chaos under pressure**. In calm conditions, operators follow workflows correctly. Under pressure — during an incident, during a high-traffic event night, after an unexpected emergency activation — operators skip steps, act in wrong order, make assumptions that the interface does not correct, and commit actions they did not intend. The interaction sequences defined here are designed for the worst operational conditions, not the best ones.

**The governing principle: sequencing is cognition protection.** Every mandatory step in an interaction flow exists because some operator, in some real or foreseeable scenario, will skip it and regret it. The cost of the step is measured in seconds. The cost of skipping it is measured in operational consequences that may take hours to recover from.

---

## Section 1 — Interaction Philosophy

### 1.1 Sequencing as Cognition Protection

Interaction sequences in ClubHub TV are not workflow conveniences — they are cognitive scaffolding for operators working under load. A well-designed sequence:

- Ensures the operator has seen the consequences before committing
- Prevents commitment before readiness
- Provides a recovery point if the operator realizes mid-sequence that the action is wrong
- Creates an auditable record of what the operator saw and confirmed before acting

Sequences must not be shortened for "efficiency" when they exist for safety. An override creation flow that takes 45 seconds when done correctly takes 45 seconds. The correct response to operator time pressure is to make the steps faster, not to eliminate them.

### 1.2 Anti-Chaos Interaction Ordering

Chaos in interaction sequencing emerges when:
- Multiple consequential actions can be initiated simultaneously without conflict detection
- The interface allows commitment before consequence visibility
- Steps can be skipped when the operator is in a hurry
- The sequence changes based on context in ways the operator cannot predict

Anti-chaos sequencing rules:
- One consequential action at a time per operator scope
- Consequence visibility is mandatory before commit, not optional
- Skippable steps may only be those with negligible consequence
- Sequence structure is stable across operational contexts — the override creation flow is the same in calm conditions as in incident conditions

### 1.3 Consequence Visibility Before Commitment

No consequential operator action may be committed without the operator first seeing:
1. What will change (the effective state delta)
2. What will not change (the unaffected operational context)
3. What cannot be undone (explicitly flagged irreversible consequences)
4. Who will be affected (scope: screen, venue, fleet)
5. What the action will look like in the replay record

This is not the same as a confirmation dialog. A confirmation dialog asks "are you sure?" without answering why the operator should or should not be sure. Consequence visibility answers the substantive question: "here is what you are about to do, here is what it will change, here is what it will not change." The operator's confirmation is then meaningful.

---

## Section 2 — Canonical Interaction Flows

### Flow IF-01: Override Creation

**Trigger:** Operator initiates a new override from any workspace.

**Sequence:**
1. **Scope selection** — Operator selects scope: screen / venue / fleet segment. The current override stack for the selected scope is displayed immediately. If overrides already exist at or above the intended priority level, a count and summary are shown.
2. **Content specification** — Operator specifies override content, priority level, and duration.
3. **Conflict detection** — System immediately evaluates the proposed override against the current override stack. Any conflicts (same-priority collisions, scope overlaps with existing overrides) are surfaced before preview.
4. **PRE preview** — The actual PRE is called with the proposed override in the system state. The result is displayed: effective state before and after, scope visualization, estimated duration impact, sponsor SOV impact if applicable.
5. **Consequence review** — Operator reviews preview. The diff is highlighted (what changes, what stays the same). Irreversible consequences are explicitly flagged.
6. **Duration and expiry confirmation** — Operator confirms override duration. The system displays the expiry time explicitly: "This override will expire at [time] on [date]."
7. **Explicit commit** — Single commit action. Not double-tap. Not swipe. An explicit, labeled button: "Apply override."
8. **Confirmation** — System confirms application: "Override applied at [timestamp]. Scope: [scope]. Expiry: [time]. View in replay: [link]."

**Prohibited shortcuts:**
- Skipping conflict detection
- Using cached preview results from a prior evaluation
- Committing without duration confirmation
- Silent application without timestamped confirmation

**Degraded-mode variation:** In STALE or DEGRADED state, steps 1–3 are permitted for review only. Steps 4–8 require synchronization confirmation before proceeding (see Section 5).

---

### Flow IF-02: Emergency Intervention

**Trigger:** Operator activates emergency content intervention (LEVEL_0 absolute priority).

**This flow is designed for degraded operator cognition under extreme stress. It must work for a scared, time-pressured operator with one hand on a mobile device.**

**Sequence:**
1. **Emergency trigger** — Five-tap confirmation on the emergency activation control (per INTERVENTION-AND-OVERRIDE-UX-v1.md). The five-tap pattern prevents accidental activation. Each tap produces haptic feedback.
2. **Scope auto-detection** — System defaults to the most recently active scope (current venue or screen). Scope override is available but not required.
3. **Emergency content selection** — A pre-configured set of emergency content options is presented (not a full content browser — only pre-approved emergency content). Selection is single-tap.
4. **Immediate preview** — PRE preview is computed within 2 seconds. The result is displayed: "This will immediately replace all content on [scope] with [emergency content]. Current sponsor commitments will be suspended."
5. **Single confirmation** — One large, clearly labeled confirmation control: "ACTIVATE EMERGENCY."
6. **Immediate application** — No additional steps. Emergency content goes live.
7. **Confirmation and tracking** — "Emergency content active as of [timestamp]. Scope: [scope]. To deactivate: [instructions]."

**Emergency flow time target:** From trigger to confirmation, the entire flow must complete within 15 seconds for a practiced operator under stress.

**What this flow does NOT do:**
- Require detailed consequence review (abbreviated for emergency conditions)
- Require duration specification (emergencies are indefinite until explicitly deactivated)
- Block on conflict detection (emergency takes absolute priority by definition)

**What it MUST still do:**
- Record the action completely (operator, timestamp, scope, content, all confirmed in audit log)
- Display deactivation path immediately upon activation (operator must not have to hunt for how to turn it off)

---

### Flow IF-03: Sponsorship Modification

**Trigger:** Operator modifies a sponsorship window — content, timing, or SOV parameters.

**Sequence:**
1. **Current delivery state** — Before any modification, the current sponsored delivery state is displayed: contracted SOV vs. configured SOV vs. delivered SOV (three-number requirement per SPONSORSHIP-OPERATIONS-UX-v1.md).
2. **Modification specification** — Operator specifies the change.
3. **Forward projection** — System computes the effect of the modification on projected delivery through the current campaign period. "At current pace with this change: estimated delivery [X]% of contracted SOV."
4. **Contract compliance check** — If the modification will cause projected delivery to fall below contracted SOV, an explicit warning: "This modification may result in under-delivery of [sponsor] contract. Projected shortfall: [amount]."
5. **PRE preview** — Actual PRE evaluation showing effective state with modification applied.
6. **Approval pathway** — If modification creates a contract compliance risk, escalation to an authorized approver is required. The operator may not self-approve contract-risk modifications.
7. **Confirmation with audit record** — "Modification applied. Sponsor: [name]. Change: [description]. Approved by: [operator/approver]. Timestamp: [time]."

**Prohibited shortcuts:**
- Applying sponsorship modifications without forward projection
- Self-approving contract-risk modifications
- Hiding the three-number SOV state before modification

---

### Flow IF-04: Incident Escalation

**Trigger:** Operator escalates a detected condition to a formal incident.

**Sequence:**
1. **Condition summary** — The condition being escalated is displayed: affected scope, detected at time, current state, contributing factors.
2. **Incident classification** — Operator selects incident type (from the 8 canonical incident types in INCIDENT-OPERATIONS-UX-v1.md). Classification is required — "miscellaneous" is not a valid classification.
3. **Severity declaration** — Operator declares severity level L1–L4. The incident operations workspace adjusts its information density and escalation protocols to match.
4. **Incident command assignment** — Operator assigns incident command (may be self-assignment).
5. **Scope confirmation** — Affected screens/venues/fleet segments confirmed. Scope may be expanded later but must be declared at opening.
6. **Incident workspace activation** — The incident operations workspace opens, pre-populated with all available context for the declared incident.
7. **Notification dispatch** — Relevant stakeholders notified per severity level and notification configuration.

**Incident opening generates a replay link** — The moment of incident declaration is captured, and the replay from N minutes before the incident trigger is queued for investigation.

---

### Flow IF-05: Replay Investigation

**Trigger:** Operator initiates a replay investigation from any workspace.

**Sequence:**
1. **Context declaration** — What is being investigated? The operator specifies (or the system pre-fills from context): scope, approximate time range, the question being investigated.
2. **Mode transition** — Explicit LIVE → REPLAY transition with acknowledgment: "You are entering replay mode. No actions you take here will affect live operations."
3. **Temporal navigation** — Operator navigates to the relevant moment. Timeline is displayed with operational events marked.
4. **Investigation** — Operator reviews PRE resolution at selected moments. The reason trace is available for each moment in the timeline.
5. **Counterfactual option** — If the operator wants to explore "what would have happened if," this is available as a simulation that branches from the replay state (does not affect replay record).
6. **Finding capture** — Operator may annotate findings directly in the replay view. Annotations are linked to the specific replay moment.
7. **Exit** — Explicit REPLAY → LIVE transition: "Returning to live state. Notable changes since you entered replay: [summary or 'no changes']."

**Prohibited in replay:**
- Taking actions that affect live operational state
- Exiting replay without explicit acknowledgment (no accidental exits)

---

### Flow IF-06: Fleet Intervention

**Trigger:** Operator initiates an action affecting multiple venues or the full fleet simultaneously.

**Sequence:**
1. **Fleet scope definition** — Operator defines the intervention scope: all venues, a regional subset, a tagged group. The count of affected venues and screens is displayed immediately.
2. **Current state summary** — For each venue in scope, current health grade and active override count are displayed. The operator must see what they are intervening on.
3. **Heterogeneity warning** — If venues in scope are in significantly different states (e.g., some are healthy, some are degraded), this is surfaced: "This intervention will affect 12 venues in varied states. 3 venues are currently in DEGRADED state."
4. **Modification specification** — Operator specifies the fleet-wide change.
5. **PRE preview for sampled venues** — Full PRE preview cannot be computed for all venues simultaneously. A representative sample (typically: worst-state venue, median-state venue, best-state venue) is previewed. The operator is shown: "Preview computed for 3 representative venues. Results may vary for other venues."
6. **Consequence acknowledgment** — Given the scale of fleet intervention, explicit consequence acknowledgment is required: "This will apply [action] to [N] venues and [M] screens. Confirm."
7. **Progressive application** — Fleet interventions are applied progressively, not simultaneously, to prevent fleet-wide disruption from a single bad action. The operator watches progress.
8. **Completion summary** — "Fleet intervention complete. Applied to [N] venues. [M] venues had exceptions (see log)."

---

### Flow IF-07: Rollback

**Trigger:** Operator initiates rollback of a prior action — typically an override that produced unintended consequences.

**Sequence:**
1. **Action identification** — The action to be rolled back is identified (from override history, recent action log, or incident context).
2. **Rollback preview** — PRE evaluation of the state after rollback is applied. "Removing this override will restore [previous effective state]. Consequence: [description]."
3. **Dependency check** — Are there any actions that were taken after the target action that depend on it? If so, these are surfaced: "Removing this override may affect 2 subsequent overrides that were applied in response to it."
4. **Irreversibility disclosure** — If the rollback itself cannot be undone (e.g., removing an override that has already been partially applied for 2 hours), this is stated explicitly.
5. **Explicit commit** — Labeled: "Roll back [action name]."
6. **Confirmation** — "Rollback complete. [Previous state restored]. Timestamp: [time]."

---

## Section 3 — Preview-Before-Commit Rules

### 3.1 Mandatory Previews

The following actions require a PRE-evaluated preview before commitment, without exception:

| Action | Preview scope |
|---|---|
| Override creation | Full effective state delta for selected scope |
| Override modification | Delta from current override to modified override |
| Emergency activation | Effective state for all affected screens |
| Schedule modification | Effective state for affected time window |
| Sponsorship window modification | SOV projection impact, effective state delta |
| Fleet intervention | Sampled effective state (per IF-06) |
| Rollback | Effective state after rollback |
| Template application | Effective state for template scope |

### 3.2 Impact Visibility Ordering

The preview must present information in consequence order, not feature order:

1. **Primary impact** — What the effective state will be after this action (what operators and screens will see)
2. **Secondary impact** — What changes in the operational record (override stack, schedule, SOV)
3. **Downstream impact** — Effects on sponsor delivery, related overrides, dependent content
4. **Reversibility** — Whether and how the action can be undone, and within what time window

### 3.3 Irreversible Action Sequencing

Actions that cannot be undone or that have consequences that persist after any attempt at reversal must follow enhanced sequencing:

- **Irreversibility label** — The action must be explicitly labeled as irreversible or partially irreversible at the preview step
- **Delay before commit** — A minimum 3-second delay between the preview and the commit control becoming active. This prevents the operator from mechanically advancing through the flow without reading the preview.
- **Typed confirmation** — For the most consequential irreversible actions (fleet-wide interventions, content deletion, emergency activation in some contexts), the operator must type a specific confirmation phrase to proceed. Not a checkbox. Not a button. A typed phrase that requires active attention.

### 3.4 Replay Comparison Requirement

For any action taken in response to a past operational event (e.g., "we had a sponsor gap at 14:30, I want to create an override to prevent recurrence"), the preview must include a replay comparison:

- "At the moment of the prior event, the state was [X]"
- "With this action applied, the equivalent future moment would produce [Y]"
- The comparison must use actual PRE evaluation of both states

---

## Section 4 — Interruption Governance

### 4.1 Modal Interruption Legality

Not all operational conditions justify interrupting an operator's current interaction with a modal. The tier system from ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md governs modal interruption:

| Signal tier | Modal interruption permitted? |
|---|---|
| Tier 0 (silence) | No |
| Tier 1 (ambient) | No |
| Tier 2 (advisory) | No — use persistent indicator |
| Tier 3 (attention) | Yes — non-blocking banner |
| Tier 4 (escalation) | Yes — blocking if operator is in non-critical interaction |
| Tier 5 (incident-critical) | Yes — blocking always, including during critical interactions |

**During the emergency flow (IF-02):** No interruption may occur that blocks the emergency flow. All signals are deferred until emergency activation is complete. Only a Tier 5 signal from a different scope may interrupt.

**During preview (PREVIEW state):** Tier 3 and above signals may produce a non-blocking banner. The preview is not invalidated by the interruption. If the signal indicates that the live state underlying the preview has materially changed, the preview is flagged as potentially outdated.

### 4.2 Concurrent Interaction Handling

Two operators may be acting on the same scope simultaneously. The platform must:

1. **Detect** concurrent interactions as early as possible — ideally during scope selection (step 1 of most flows)
2. **Inform** both operators that a concurrent interaction is in progress: "Another operator is currently modifying this venue's override stack."
3. **Not block** either operator by default — operators are informed, not prevented
4. **Warn** of potential conflicts at the preview step: "Another override was applied to this scope in the last 30 seconds. Your preview may not reflect this change. Regenerate preview?"
5. **Apply last-write-wins** by default, with both actions logged

**Exception:** Emergency activations pre-empt concurrent interactions. If operator A is creating an override and operator B activates an emergency on the same scope, operator A's in-progress flow is interrupted with a notification and their action is cancelled.

### 4.3 High-Priority Interruption Behavior

When a Tier 4 or Tier 5 signal requires operator attention during an in-progress interaction:

- **Tier 4:** A non-dismissible banner appears at the top of the current interaction. The operator may choose to complete the current flow or abandon it to address the Tier 4 condition. Their in-progress work is saved as a draft.
- **Tier 5:** The current interaction is suspended. A full-screen incident notification appears. The operator is given a "Save draft and respond to incident" control. They cannot proceed with the original interaction until they have acknowledged the Tier 5 condition.

**Draft preservation:** Any in-progress flow that is interrupted must preserve its current state as a draft. The draft is recoverable after the interruption is resolved. An interrupted override creation resumes at the conflict detection step (step 3), not the beginning — the operator's prior inputs are preserved.

### 4.4 Interaction Suspension and Resume

Operators may be interrupted mid-flow by conditions unrelated to the platform (phone call, venue emergency, colleague interruption). The platform must support graceful suspension:

- **Timeout suspension:** After N minutes of inactivity within a flow, the flow is suspended with the operator's state saved as a draft. The timeout period must be long enough to accommodate real operational interruptions (minimum 10 minutes for standard flows, no timeout for emergency flows).
- **Explicit suspension:** Operator may explicitly pause a flow and return to it.
- **Resume from draft:** Resuming a flow shows the operator where they were and how much time has passed since suspension. If the underlying state has changed materially since suspension, the flow is restarted from the conflict detection step.

---

## Section 5 — Failure-State Interactions

### 5.1 Degraded-Mode Sequencing

When the platform is in DEGRADED state (partial data availability), interaction flows are modified as follows:

**What remains available:**
- All read operations (viewing state, override history, schedules, SOV data for unaffected components)
- Replay investigation (if replay system is unaffected)
- Emergency activation (cannot be blocked by degradation — emergency takes priority)

**What requires modified sequencing:**
- Override creation: proceeds but with an explicit warning at step 4 (preview): "Preview computed with partial data. [N] screens are not reporting. Override will be applied to reporting screens immediately; queued for unreachable screens."
- Fleet intervention: additional warning at the heterogeneity step: "Fleet intervention computed with partial fleet data. [N] venues are not reporting."

**What is blocked:**
- Sponsorship modifications that require accurate SOV data (if sponsorship delivery data is part of the degradation)
- Any action whose preview cannot be computed without the missing data

### 5.2 Partial-Data Interaction Rules

When an interaction flow is operating on partial data, the operator must be informed at every step that depends on the partial data. Not once at the beginning — at each step where partial data affects the output.

"This preview is based on data from 14 of 17 screens. 3 screens are not reporting."

The partial-data disclosure must be specific — which screens, which data types, how long they have been unavailable.

### 5.3 Synchronization-Failure Interaction Behavior

When the platform loses synchronization during an in-progress interaction flow:

- **LIVE → STALE transition during a flow:** The flow is paused. The operator is notified: "Connection lost during [action]. Your progress has been saved. The action has not been applied. Reconnecting..."
- **After reconnection:** The operator is shown their saved draft and offered to continue: "Connection restored. Your [action] is ready to continue. Confirm to proceed from step [N]."
- **If the underlying state changed during the synchronization gap:** "State changed while disconnected. Your preview may be outdated. Regenerate preview before continuing."

**Critical rule:** No action may be silently committed or silently abandoned due to a synchronization failure. The operator must always know what happened to their in-progress action.

---

## Section 6 — Human Factors

### 6.1 Panic-Click Behavior

Under high stress, operators exhibit panic-click behavior: rapid, imprecise tapping or clicking on any control that appears to offer a solution, without reading the controls' labels or the consequences being displayed. This behavior is predictable, well-documented in operational psychology, and must be designed against.

**Design responses to panic-click:**
- High-consequence controls must not be positioned near low-consequence controls. Inadvertent activation of emergency controls from a miss-click on an adjacent control is a design failure.
- Confirmation controls for consequential actions must be spatially and visually distinct from the information being confirmed. The operator must move their attention (and their hand/finger) from the information to the confirmation.
- The 3-second delay before the commit control becomes active (Section 3.3) specifically interrupts panic-click by requiring the operator to pause.
- Typed confirmation for the most consequential actions forces the operator into a deliberate mode that is incompatible with panic-click.

### 6.2 Sequencing Collapse Under Stress

Under stress, operators skip steps. They read the first line of the preview and commit. They skip the consequence review and go directly to the confirmation. They skip the duration specification and accept the default.

**Design response:** Steps that cannot be safely skipped must be impossible to skip — not difficult to skip, not warned against, but structurally impossible. The commit control does not appear until the consequence review step has been displayed for a minimum time. The duration confirmation field cannot be blank. The scope selector cannot proceed to preview with no scope selected.

Steps that can be safely skipped — because their consequence is minor and reversible — may be optional or dismissible with a single explicit action. The distinction between "cannot be skipped" and "may be skipped" must be obvious and consistent.

### 6.3 Skipped Comprehension Patterns

Operators who have performed a flow many times begin to execute it from muscle memory, without reading the content of each step. An override creator who has created hundreds of overrides may commit without reading the preview — the flow is automatic.

**This is not a failure mode to eliminate — it is a capability to support for experienced operators while preserving safety for all operators.**

Design response:
- Consequence visibility must include a change-highlighting mechanism that draws the operator's eye to what is different from the expected result. An experienced operator may not read the full preview, but they will notice an unexpected highlight.
- Anomaly detection in the preview (e.g., "this override will affect a significantly larger scope than your last 10 overrides") produces an attention-forcing callout that interrupts muscle-memory execution.
- The confirmation phrase requirement (Section 3.3) is specifically calibrated to interrupt automatic execution for the highest-consequence actions.

### 6.4 Interruption Disorientation

When an operator is interrupted mid-flow by a Tier 4 or Tier 5 signal, their mental model of where they were in the flow is disrupted. On return, they may not know where they left off, may re-execute steps they already completed, or may skip steps because they believe they already completed them.

**Design response:**
- On flow resume, the current step is shown with explicit context: "You were at step 3 of 7: reviewing the consequence preview."
- Steps already completed are shown as completed (with a visual completion state), not as if they haven't been done.
- Steps not yet completed are shown as pending, not as if they have been done.
- The operator is offered a "restart from beginning" option alongside "continue from where I was" — for cases where enough time or state change has occurred that starting over is safer than continuing.

---

## Related Documents

**CANONICAL-UI-STATE-MODEL.md** — The state model that governs what states operators are in when interaction flows occur. The sequencing spec assumes the state types defined there.

**LIVE-UPDATE-BEHAVIOR-SPEC-v1.md** — Defines how updates arriving during in-progress flows are handled without destroying the operator's interaction context.

**OPERATIONAL-NAVIGATION-GOVERNANCE-v1.md** — Navigation is itself an interaction with sequencing requirements. Navigation during in-progress flows is governed jointly by this document and the navigation spec.

**INTERVENTION-AND-OVERRIDE-UX-v1.md** — The detailed override lifecycle. Flow IF-01 in this document implements the high-level sequence; the intervention document provides the full behavioral specification.

**INCIDENT-OPERATIONS-UX-v1.md** — The incident lifecycle. Flow IF-04 implements the opening sequence; the incident operations document provides the full incident management model.

**DECISION-ERGONOMICS-v1.md** — The cognitive ergonomics principles that underlie the sequencing design here. The friction-proportional-to-consequence rule is operationalized in Section 3.3.

---

*End of INTERACTION-SEQUENCING-SPEC.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*Workflow approval routing and escalation paths: Agent 2 co-authority.*
*Emergency activation hardware integration: Agent 1 co-authority.*
*Changes to mandatory preview requirements or irreversible-action sequencing require cross-agent review.*
