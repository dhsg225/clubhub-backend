# ClubHub TV — Incident Operations UX v1
# How Operators Handle Operational Failure Safely

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, INTERVENTION-AND-OVERRIDE-UX-v1.md, ENTROPY-OBSERVABILITY-UX-v1.md, EXPLAINABILITY-UX-SPEC-v1.md, FAILURE-STORIES.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Incident Philosophy

---

### 1.1 Incident Cognition Under Stress

Incidents do not happen in controlled conditions. They happen when an operator is distracted, when multiple things are wrong at once, when a sponsor is on the phone, when a senior manager is watching. The cognitive state during an incident is degraded — narrowed attention, time pressure, social accountability, decision anxiety.

Standard UX principles optimize for calm, deliberate use. Incident UX must optimize for degraded cognition. The design must work when:
- The operator is scared
- The operator does not have time to read
- The operator is being observed by someone who expects results
- The operator cannot remember what they did five minutes ago
- Multiple operators are trying to take action simultaneously

These are not edge cases. They are the conditions under which the most consequential CMS actions are taken. If the UX is only safe in calm conditions, it is not safe enough.

---

### 1.2 Ambiguity Collapse

Under stress, ambiguity is amplified. An operator who encounters an unclear option during an incident will not stop to investigate — they will make a choice, and the choice will often be the highest-authority option available ("activate emergency" is clearer in outcome than "create a zone override"). This is **ambiguity collapse** — the operator defaults to certainty over precision.

**Design response:** Incident UX must minimize ambiguity at every decision point. Not by eliminating choices, but by making the expected outcome of each choice concrete and immediately visible. "Activate emergency on Bar Area (4 screens)" is unambiguous. "Emergency override" is not.

Every incident workflow must answer the operator's implicit question before they ask it: "If I tap this, what exactly will happen?"

---

### 1.3 Panic Behavior

OPERATOR-COGNITIVE-MODELS-v1.md §5.3 documents interruption panic — the cognitive state where an operator needs to visibly fix a problem under social observation. Under panic, the operator's primary goal is not to fix the root cause — it is to make the visible symptom disappear.

**Panic behavior patterns:**
- Create override to force correct content → symptom disappears; root cause remains
- Escalate scope of override beyond what is needed → "making sure it works" thinking
- Create multiple overrides in rapid succession → override cascade
- Skip impact review and confirmation → risk of unintended scope

**Design response:** The incident UX must make the "fix the root cause" path as fast as the "create an override to hide the symptom" path — or faster. If diagnosing the suppressor (which is the correct fix for most content problems) takes longer than creating a new override, operators under panic will always choose the override.

**Speed target:** From "I see the wrong content" to "I understand what is causing it" must be under 30 seconds in the screen introspection view. If it takes longer, the UX has failed the panic-resistance requirement.

---

### 1.4 Operational Trust Preservation

An incident is a moment of elevated trust risk. When something goes wrong, operators and stakeholders form judgments about the system's reliability — judgments that are disproportionately influenced by how the incident was handled, not just by the incident itself.

A well-handled incident (fast detection, clear explanation, appropriate intervention, visible recovery) builds more trust than a prevented incident that no one knows about. A poorly handled incident (confusion, blame uncertainty, unexplained behavior, no visible recovery) destroys trust even if the underlying issue was minor.

**The incident UX must be designed to produce well-handled incidents.** This means:
- Making detection fast and visible
- Making the intervention story clear
- Making recovery visible and confirmed
- Making the post-incident explanation available to all relevant parties

---

## Part 2 — Incident Types

---

### 2.1 Emergency Content Takeover

**Definition:** LEVEL_0 emergency content is activated, either intentionally (genuine emergency response) or erroneously (emergency tool misuse).

**Operational characteristics:** High visibility, high urgency, high authority. Every screen in scope stops showing campaign/sponsor content immediately.

**Correct detection signals:**
- All affected screens show red ⚠ emergency indicator simultaneously
- Emergency banner appears across all CMS workspaces for all logged-in operators at this venue
- Email/push notification sent to Venue Manager and Org Admin

**Erroneous activation signals:**
- Emergency activated outside business hours with no supporting context
- Emergency reason field contains non-emergency language
- Emergency activated for a scope (e.g., global) disproportionate to any evident local issue

**UX treatment:** Emergency is visible everywhere, immediately. The primary action path is: "There is an emergency active → [View emergency details] → [Clear if resolved]." The default view when any operator opens the CMS during an active emergency is the Emergency Operations Workspace.

---

### 2.2 Venue-Specific Failure

**Definition:** A venue's screens are showing unexpected content, or screens are offline, due to local configuration drift, device failures, or network issues — without an emergency being declared.

**Common manifestations:**
- Multiple screens showing fallback content (campaign coverage gap)
- Screens offline (delivery log gaps)
- Content wrong on specific screens (suppressor not understood)
- Screens in "override-saturated" state where campaign content has been entirely displaced

**Detection signals:**
- Confidence score drops below threshold on multiple screens simultaneously
- Health grade degrades from one period to the next
- Venue-level entropy alert generated

**UX treatment:** The Live Operations Workspace surfaces the venue failure visually — affected screens show amber or red indicators. The "What is happening?" diagnostic entry point is prominently available. The operator should be able to identify the nature of the failure (coverage gap, suppression, device offline) within 30 seconds.

---

### 2.3 Sponsorship Conflict

**Definition:** A sponsor's content is not delivering at contracted SOV levels, either because of active suppression or because of configuration gaps.

**Operational characteristics:** Medium urgency, medium visibility. May not be visible on screens (content may still be playing — just not the sponsor's content). Discovery often triggered by sponsor escalation, not proactive detection.

**Detection signals:**
- SOV alert: sponsor rolling SOV below contract threshold
- Sponsor escalation: external contact reporting content not visible
- Proof-of-play request: sponsor asking for delivery confirmation

**UX treatment:** Sponsorship Operations Workspace surfaces the shortfall with the identified suppressor. The action path is: "SOV shortfall → identified suppressor → review suppressor → remove or extend." The entire flow must be completable in under 5 minutes from the sponsorship workspace.

---

### 2.4 Screen-State Divergence

**Definition:** A screen's confirmed delivery state (delivery log) diverges from its configured/PRE-output state. The screen is showing something other than what the PRE computes as the correct output.

**Causes:**
- Device offline / serving stale manifest
- HDMI input switched to non-ClubHub source
- Network partition preventing manifest update
- Unexpected device behavior (rare — flag for investigation)

**Detection signals:**
- Confidence score drops below 50% for a specific screen
- Delivery log gap exceeds expected poll cycle

**UX treatment:** The screen shows a low-confidence indicator. The introspection view explains the divergence. Action paths: check device connectivity, check HDMI input, investigate if divergence is UNEXPECTED (potential constitutional violation).

---

### 2.5 Network Degradation

**Definition:** Multiple venues or the entire network experiences degraded delivery confirmation due to infrastructure issues.

**Operational characteristics:** High scope, high urgency. May affect ability to verify that content is being delivered across many venues.

**Detection signals:**
- Confidence scores dropping simultaneously across multiple venues
- Delivery log gaps across multiple devices at the same time
- Network Operations Workspace anomaly feed showing multiple simultaneous events

**UX treatment:** Network-level incident declaration (§3.1). All affected venues shown in degraded state. Operators informed that PRE configuration is correct; delivery confirmation is temporarily impaired.

---

### 2.6 Operator Error

**Definition:** An operator has made a configuration change that produced unintended consequences — override with wrong scope, campaign modification affecting unintended screens, emergency activated incorrectly.

**Operational characteristics:** Variable urgency and scope. Often discovered after the fact.

**Detection signals:**
- Unexpected state on screens (Live Operations Workspace)
- Sponsor SOV alert shortly after a configuration change
- Operator self-report ("I think I made a mistake")

**UX treatment:** The provenance timeline shows the causal event. The "undo" path (if action is reversible) is surfaced immediately. If not immediately reversible, the corrective action path is explained.

**Note on reversibility:** Most CMS actions are reversible. Override creation: remove the override. Campaign modification: restore previous configuration. Emergency activation: clear the emergency. The UX must make reversibility visible — "you can undo this by [action]."

---

### 2.7 Stale Override Accumulation

**Definition:** Not an acute incident but a chronic one — the venue has accumulated many old, orphaned, or no-longer-needed overrides, and the system's behavior has become opaque.

**Operational characteristics:** Low urgency but high entropy risk. The "boiling frog" incident — gradual degradation that seems normal until it causes a visible failure.

**Detection signals:**
- Health grade declining over weeks
- Override count increasing without cleanup
- Operators reporting that "the screens do unexpected things sometimes"

**UX treatment:** The Venue Operations Workspace surfaces the accumulation as a structured cleanup task, not as an emergency. The timeline shows when accumulation began. The cleanup workflow (INTERVENTION-AND-OVERRIDE-UX-v1.md §3.6) is the resolution path.

---

### 2.8 Event Interruption Storm

**Definition:** During a live event (match night, tournament, club function), multiple operators make competing interventions simultaneously, creating a conflict state where the effective screen content is determined by an uncoordinated accumulation of overrides rather than by planned configuration.

**Operational characteristics:** High urgency, high confusion, high entropy velocity. Multiple operators each believe their action is the correct fix; they are not coordinating.

**Detection signals:**
- Rapid creation of multiple overrides within minutes
- Override/campaign conflict warnings across multiple screens
- Concurrent edit alerts (ENTROPY-OBSERVABILITY-UX-v1.md §8.1)

**UX treatment:** The concurrent edit alert (§3.3) is the primary prevention mechanism. During events, a "coordination mode" option allows the Venue Manager to designate which operators are authorized to make changes, reducing uncoordinated intervention.

---

## Part 3 — Incident Command UX

---

### 3.1 Incident Declaration

For significant incidents (Tier 3–4 alerts, emergency activations, network degradation), a formal incident declaration creates a structured operational context:

```
[Declare Incident]

Incident type:
  ○ Emergency content issue
  ○ Content delivery failure
  ○ Sponsor content issue
  ○ Screen/device failure
  ○ Network degradation
  ○ Operator coordination issue
  ○ Other: [text]

Scope:
  ○ Single screen: [screen picker]
  ○ Zone: [zone picker]
  ○ Venue: [venue picker]
  ○ Multiple venues: [venue multi-select]

Severity:
  ○ High — content delivery impacted for guests/viewers
  ○ Medium — configuration issue, no immediate delivery impact
  ○ Low — monitoring concern, no immediate action needed

Notified roles: [Venue Manager] [Org Admin] [NOC]
  (based on scope and severity — adjustable)

[Declare Incident]
```

**Why formal declaration matters:** Incident declaration creates a named operational context. All subsequent actions taken in response to the incident are associated with the incident record. This produces the incident timeline (§4) and enables post-incident replay and learning.

---

### 3.2 Operational Authority Visibility

During an incident, operators need to know who is in charge — who has authority to make which decisions. This is especially important when multiple operators are active simultaneously.

**Authority display in incident mode:**

```
INCIDENT ACTIVE — Content failure on 3 screens

  Incident lead: [VENUE_MANAGER_NAME] (Venue Manager)
  Actions by: [VENUE_MANAGER_NAME] [FLOOR_OPERATOR_A]
  Currently viewing: [FLOOR_OPERATOR_A] [NETWORK_OPERATOR_B]

  Override authority: [VENUE_MANAGER_NAME] + any operator
  Emergency authority: [VENUE_MANAGER_NAME] only (during active incident)
```

The authority display prevents the "too many cooks" problem — multiple operators attempting to fix the same thing independently.

---

### 3.3 Escalation Hierarchy

When an incident exceeds the responding operator's authority or capability, escalation must be a defined, structured action — not an informal "I'll call my manager."

**Escalation levels:**

| Level | Triggers | Escalates to | Expected response |
|-------|----------|-------------|------------------|
| L1 | Content wrong on 1–3 screens | Venue Manager | Diagnose + fix within 30 min |
| L2 | Multiple screens affected, sponsor impact | Venue Manager + Org Admin | Diagnose + fix within 15 min |
| L3 | Venue-wide failure or emergency activation | Org Admin + NOC | Immediate response |
| L4 | Multi-venue failure or network degradation | NOC + exec notification | Incident command activated |

**Escalation UX:**

```
⚠ This incident may require escalation

  Current: [FLOOR_OPERATOR] handling Content failure on 5 screens
  Recommended: Escalate to [VENUE_MANAGER_NAME]

  Escalation will:
  → Notify [VENUE_MANAGER_NAME] via push notification + email
  → Transfer incident lead to [VENUE_MANAGER_NAME]
  → Give you read-only status on this incident

  [Escalate] [Handle myself]
```

---

### 3.4 Intervention Coordination

During events when multiple operators are active, a coordination surface prevents conflicting interventions:

**Intervention queue:** Proposed overrides and interventions during an event are queued and visible to all active operators before execution. The Venue Manager (or designated incident lead) approves or rejects queued interventions in real time.

```
Intervention Queue — [VENUE_NAME] — Active Incident

  [FLOOR_OPERATOR_A] → Override: [CONTENT_X] on B1–B3 for 2h
    Reason: "Sponsor content not visible in bar area"
    [Approve] [Reject] [Modify]

  [FLOOR_OPERATOR_B] → Override: [CONTENT_Y] on B1–B4 for 30min
    Reason: "Manager requested this content immediately"
    ⚡ Note: This conflicts with pending Override from [OPERATOR_A]
    [Approve] [Reject] [Modify]
```

The queue visibility prevents two operators from creating conflicting overrides simultaneously — a common event-night failure mode.

---

### 3.5 Operational Communication Surfaces

During incidents, operators need to communicate about the operational situation. The CMS is not a general communication platform, but it must surface enough context to enable coordination:

**Incident log:** An append-only note-taking surface within the incident record. Operators can add timestamped notes during the incident:

```
Incident Log — [INCIDENT_ID]

14:32  [FLOOR_OPERATOR_A]: Noticed Screen B1 showing wrong content. Creating override.
14:35  [FLOOR_OPERATOR_A]: Override created. B1 restored to correct content.
14:37  [VENUE_MANAGER]: Reviewing B2–B3 as well. Found same issue — Override_004 scope
14:41  [VENUE_MANAGER]: Override_004 was created for last week's event. Removing it now.
14:43  [VENUE_MANAGER]: Override_004 removed. All screens restored.
```

The incident log is not a chat system — it is an operational record. Entries are timestamped and attributed. The log becomes part of the incident postmortem record.

---

## Part 4 — Incident Timelines

---

### 4.1 The Incident Lifecycle Timeline

Every declared incident has a lifecycle: detection → escalation → intervention → stabilization → recovery → postmortem. The incident timeline surface maps this lifecycle chronologically:

```
Incident Timeline — [INCIDENT_ID]
Type: Content delivery failure — Sponsorship conflict
Scope: Screens B1–B4, [VENUE_NAME]
Severity: High

14:28  DETECTION
  Automated SOV alert: [SPONSOR_X] SOV 19% (contract: 25%)
  Trigger: 7-day rolling SOV crossed below threshold

14:31  ESCALATION
  Alert delivered to [VENUE_MANAGER] via push notification

14:33  INVESTIGATION
  [VENUE_MANAGER] opened Sponsorship Operations Workspace
  Identified: Override_004 suppressing sponsor content on B1–B2

14:41  INTERVENTION
  [VENUE_MANAGER] reviewed Override_004
  Determined: override no longer needed (event completed 3 weeks ago)
  Action: Override_004 deactivated

14:43  STABILIZATION
  B1–B2 returned to campaign content; sponsor injection resumed
  PRE output confirmed: [SPONSOR_X] content now winning on all 4 screens

14:50  RECOVERY CONFIRMED
  Delivery log confirmed: sponsor content delivered to all 4 screens

Duration: 22 minutes (detection to recovery confirmed)
```

---

### 4.2 Detection Phase

The detection phase is the period from when the problem first began to when an operator became aware of it. Minimizing this phase is the primary goal of proactive entropy monitoring.

**Detection latency analysis:**

The incident timeline should show both when the problem began (first PRE computation showing anomaly) and when it was detected (first operator aware). The gap is the detection latency.

High detection latency → the problem was not surfaced proactively → the monitoring threshold needs adjustment.

Zero detection latency → the monitoring system notified the operator immediately when the issue began → optimal.

---

### 4.3 Intervention Phase

The intervention phase shows every action taken during the incident, in order. Each action is attributed and timestamped. The intervention phase is the most important part of the incident timeline for postmortem learning:

- Did the first intervention fix the problem or make it worse?
- Were there unnecessary or redundant interventions?
- Did any intervention have unintended side effects?

The intervention phase is also the source of the "what actually worked" learning — interventions that successfully resolved the issue are marked as effective; interventions that had no effect or made things worse are marked for review.

---

### 4.4 Recovery Confirmation Phase

An incident is not resolved until recovery is confirmed — not just until the intervention is made. The recovery confirmation phase shows the return to normal operational state:

- PRE output confirms correct content on affected screens
- Delivery log confirms devices are receiving correct content
- Any monitoring alerts have cleared
- Sponsor SOV is recovering toward contract threshold (if applicable)

**Recovery is a temporal process.** After an override is removed, it takes one poll cycle (15 seconds) for the PRE to update manifests, and potentially multiple poll cycles for all devices to confirm delivery. The recovery confirmation phase must reflect this reality — it is not instant.

---

## Part 5 — Incident Replay UX

---

### 5.1 Postmortem Reconstruction

After an incident is resolved, the incident replay provides a complete reconstruction of what happened, in what order, and why.

**Entry point:** From the incident record → "Review incident replay"

**Replay surface:** Identical to the historical screen introspection view, but with incident-phase annotations:

```
Postmortem Replay — Incident [ID]
Period: 2026-05-20 12:00 — 2026-05-20 15:00

Screen: B1

  12:00  Override_004 winning (LEVEL_1) — [CONTENT_B]
           ← This was the state at incident start
  12:28  SOV alert generated (threshold crossed)
  12:31  [VENUE_MANAGER] notified
  14:41  Override_004 deactivated by [VENUE_MANAGER]
  14:43  Campaign A resumed (LEVEL_3) — [CONTENT_A]
           ← Recovery point
  14:50  Delivery confirmed by device

  Time from problem start to detection: 28 minutes
  Time from detection to intervention: ~2h 10min
  Time from intervention to recovery: 7 minutes
```

The 2h 10min gap between detection and intervention is the actionable insight from this postmortem — why was there such a long delay?

---

### 5.2 Causality Review

The causality review surface answers: "What series of events caused this incident?"

For the example incident above, the causality chain would show:
1. Override_004 created 3 weeks earlier for a tournament event
2. Override_004 never removed after the tournament ended
3. Override_004 accumulated to 47 days active with no expiry
4. Override_004 began suppressing sponsor content
5. SOV declined gradually over the 47-day period
6. SOV threshold crossed, triggering alert

**Root cause identification:** The root cause is not "Override_004 was not removed." The root cause is "Override_004 was created without an expiry date and there was no cleanup workflow to identify it as stale."

The causality review should distinguish between:
- **Proximate cause:** The immediate event that triggered the incident (Override_004 active)
- **Root cause:** The systemic condition that allowed the incident to develop (no expiry date, no cleanup workflow)

Addressing only the proximate cause (removing Override_004) resolves this incident. Addressing the root cause (implementing cleanup workflows and expiry defaults) prevents the next one.

---

### 5.3 Divergence Analysis

If the incident involved divergence between configured state and delivered state (device offline, HDMI switch, etc.), the divergence analysis reconstructs the full divergence record:

```
Divergence Analysis — Screen B4

  Period of non-delivery: 14:30–15:45 (75 minutes)
  Reason: Device offline (no delivery confirmation)
  PRE output during this period: Campaign A ([CONTENT_A])

  Content that should have played: Campaign A for 75 minutes
  Content that actually played: Unknown — device was offline
  Delivery gap: 75 minutes

  SOV impact: [SPONSOR_X] lost approximately 18.75 minutes of configured delivery
```

The divergence analysis produces the quantified delivery gap — the input to any sponsor compensation or contract adjustment discussion.

---

### 5.4 Timeline Annotation

Incident timelines can be annotated after the fact by Venue Managers and above. Annotations add operational context that the system cannot capture automatically:

- "This override was created for the tournament and should have been removed on the 15th — process failure"
- "Device B4 had been having network issues for 3 days before this incident"
- "The 2-hour delay in intervention was because [VENUE_MANAGER] was at an off-site meeting"

Annotations are attributed and timestamped. They become part of the permanent incident record and inform future operational improvements.

---

### 5.5 Sponsor Impact Accounting

For incidents that affected sponsor delivery, the postmortem includes a sponsor impact account:

```
Sponsor Impact — Incident [ID]

  [SPONSOR_X] — contracted 25% SOV on B1–B4
  Impact period: 2026-04-04 to 2026-06-01 (58 days — Override_004 active)

  Configured delivery shortfall: 3% × 58 days = ~1.7 days of content
  Confirmed delivery shortfall (delivery log): 1.9 days of content

  This incident is flagged for sponsor relationship review.
  [VENUE_MANAGER] should discuss remediation with [SPONSOR_X] account manager.

  Documentation available for sponsor:
  → Full proof-of-play report for contract period
  → Incident timeline showing cause and resolution
  → Recovery confirmation records
```

---

## Part 6 — High-Stress UX Principles

---

### P-HS-01: Minimal Ambiguity

Every decision point in an incident workflow must have exactly one correct answer with an unambiguous label. Where multiple options exist, each must describe its outcome, not just its action.

✓ "Activate emergency on Bar Area (4 screens) — all other content suppressed immediately"
✗ "Emergency Override — Bar Area"

---

### P-HS-02: Low Cognitive Branching

Incident workflows must not branch more than three levels deep. An operator who encounters a deeply nested decision tree under stress will make random choices to escape the tree. Each step must have a maximum of 3–4 options.

**Branching limit:** Incident activation → scope selection → expiry selection → confirm. Four steps maximum for any high-urgency action.

---

### P-HS-03: Confirmation Safeguards

High-scope, hard-to-reverse actions require a confirmation step that names the action's consequences explicitly. The confirmation must name scope (how many screens, which venues) and duration (how long will this last?).

The confirmation must not be a generic "are you sure?" modal — it must state what will happen.

---

### P-HS-04: Recovery Visibility

After every incident intervention, the CMS must confirm that the intervention worked. An operator who performs an action and sees no confirmation that it took effect will escalate to a more forceful action, compounding the problem.

**Recovery confirmation requirements:**
- After override creation: show which screens are now showing the override content (within 15 seconds)
- After emergency activation: show the emergency status banner (immediately)
- After emergency clearance: show that screens are returning to normal (within 15 seconds + one poll cycle)

---

### P-HS-05: Safe Rollback Awareness

Every incident intervention should be accompanied by a rollback path — the action that reverses it if the intervention makes things worse:

```
Override created — [OVERRIDE_NAME]

  This override is now active on screens B1–B4.
  If this override is not working as intended:
  [Remove this override — restores previous state]
```

The rollback path is presented at the moment of action confirmation, not buried in a settings screen. Under stress, operators need to know "how do I undo this" before they need to undo it.

---

## Part 7 — Failure-Oriented Design

---

### 7.1 Graceful Degradation

When parts of the system fail, the remaining parts must continue operating with clear indication of what is degraded:

| System failure | Degraded mode behavior | UX signal |
|----------------|----------------------|-----------|
| Delivery log unavailable | PRE output still computable; confidence scores unavailable | "Delivery confirmation unavailable — configured state shown" |
| PRE preview endpoint slow | Preview loads with delay; timeout at 5s | "Preview loading — checking scheduled content..." |
| Network Operations view unavailable | Individual venue views unaffected | Network Operations Workspace shows degraded state |
| Historical replay unavailable | Current state views unaffected | Replay queries show "historical data temporarily unavailable" |

In every case, the degraded mode must be labeled — operators must not mistake degraded-mode output for full-fidelity output.

---

### 7.2 Operational Continuity

The most important operational guarantee: **screens keep playing even when the CMS is unavailable.** Devices serve their last manifest. The PRE's most recent computation continues to govern screen content.

**UX implication:** If the CMS backend is temporarily unavailable, the operator-facing UI should surface this clearly:

```
⚠ CMS backend temporarily unavailable

  Screens are continuing to play content from their last configured state.
  No configuration changes can be made until the connection is restored.

  Affected: [N] venues
  Last successful connection: 4 minutes ago
  [Status: investigating]
```

Operators who do not see this message may assume the CMS is working normally — and then wonder why their configuration changes have no effect.

---

### 7.3 Fallback Visibility

When screens fall through to LEVEL_5 (Structural Fallback) or LEVEL_6 (Device Default), this must be clearly visible and understood as a coverage gap — not as normal operation.

**Fallback state indicator:**

```
↩ FALLBACK CONTENT
  No campaign or override is currently scheduled for this screen.
  Your configured fallback content is playing: [FALLBACK_CONTENT_NAME]

  This is expected if: no content is scheduled for this time window
  This may be a gap if: you expected a campaign to be active here

  [Check timeline] [Schedule content for this window]
```

The distinction between "expected fallback" and "unintended coverage gap" is the operator's determination — the UX provides the information to make that determination, not an automatic classification.

---

### 7.4 Degraded-Mode Trust Preservation

When the system is in a degraded state (delivery confirmation unavailable, preview endpoint slow, historical replay unavailable), the UX must maintain operator trust by:

1. Being honest about what is degraded and what is not
2. Clarifying what operators can and cannot rely on
3. Providing the best available information, clearly labeled with its limitations
4. Communicating when the degradation is resolved

**Trust preservation principle:** Operators who are informed about degradation and kept updated will trust the system more than operators who are shown apparently normal operation that is actually degraded. Transparency about limitations is a trust-building behavior, not a trust-damaging one.

---

*End of INCIDENT-OPERATIONS-UX-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Incident declaration data model: Agent 2 (CMS) design responsibility*
*Incident replay infrastructure: Agent 1 (Platform) requirement*
*Escalation notification system: Agent 1 (Platform) requirement*
