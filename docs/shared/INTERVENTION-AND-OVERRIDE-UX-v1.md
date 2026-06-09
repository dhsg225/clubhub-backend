# ClubHub TV — Intervention and Override UX v1
# Controlled Operational Divergence

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, ENTROPY-OBSERVABILITY-UX-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, FAILURE-STORIES.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Override Philosophy

---

### 1.1 Overrides as Operational Debt

An override is a decision to diverge from the planned content resolution. It is not inherently wrong — operational divergence is sometimes the correct response to real-world events. An emergency requires content that wasn't in the campaign schedule. A VIP sponsor visit requires content that wasn't planned for this week. A compliance requirement changes overnight.

But every override is operational debt.

**Operational debt definition:** An override is operational debt in the same way that technical debt is engineering debt — it is a deferred cost. When the override is created, the operator accepts a liability: they must eventually review the override, decide whether it is still correct, and either renew it deliberately or remove it. Overrides that are not actively managed accumulate into the configuration entropy patterns documented in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §2.2.

The UX must communicate this debt nature explicitly and consistently. The goal is not to discourage overrides — it is to ensure that every operator who creates an override understands they are taking on a maintenance commitment, not just making a one-time content change.

**The debt framing in practice:**

- Override creation: "You are creating a temporary divergence from the planned schedule. This divergence will persist until it expires or is manually removed."
- Override list: Shows each override as a debt item with age, with the oldest and most consequential overrides most visually prominent.
- Override review: "You have N overrides that have not been reviewed in 30+ days. These are accumulated debt. [Review now]"

---

### 1.2 Temporary Divergence

Every override must have a temporal identity. An operational override is not a permanent configuration change — it is a temporary divergence with a defined or definable end.

**The temporal contract:** When an operator creates an override, they are making an implicit promise: "This override has a purpose. The purpose has a duration. When the duration ends, the override should end."

The UX enforces this contract by requiring every override creation to address expiry. Operators who cannot articulate when an override should end should be prompted to think through that question before creation — not blocked, but confronted with it.

**Permanent overrides exist** — some content configurations are legitimately indefinite. But indefinite overrides require explicit acknowledgment that they are indefinite, not the accidental outcome of forgetting to set an expiry.

---

### 1.3 Intervention Visibility

Every active override must be visible to any operator with venue-level read access. There must be no such thing as a "hidden" override — a configuration object that is affecting screen resolution but is not surfaced in any standard operational view.

**This directly prevents FAILURE-STORIES.md Story 1** ("The Campaign That Wasn't Showing"), where an operational override was suppressing a campaign but was invisible from the campaign management view.

**Implementation requirement:** The CMS must maintain an active-overrides feed that is:
- Accessible from every workspace (linked from the persistent navigation)
- Sorted by age by default (oldest first — most likely to be orphaned)
- Filterable by scope, creator, resolution level
- Showing the impact of each override on the screens it affects

---

### 1.4 Anti-Normalization Principles

The most dangerous outcome for the override system is normalization — when overrides stop being treated as operational exceptions and start being treated as the normal method of content management.

**Signs of normalization:**
- Operators create overrides before checking whether a campaign would serve the need
- Override count has grown to where there is always an override active on every screen
- Operators refer to overrides as "the way we schedule content here"
- New operators are trained to use overrides rather than campaigns

**The UX must resist normalization without blocking legitimate use.** This is a balance. The mechanisms:

1. **Override count friction:** When a venue already has more than N active overrides, creating a new one generates a gentle friction prompt: "This venue has [N] active overrides. Consider reviewing existing overrides before adding more."

2. **Override vs campaign guidance:** In the override creation flow, if the operator's stated need (content X on screen Y from time A to time B) could be served by a campaign, the CMS should offer a path: "This looks like a campaign might work better for this. [Create a campaign] [Continue with override]"

3. **Override aging as cost signal:** Old overrides should feel expensive to the operator — visually prominent, requiring active acknowledgment. The entropy cost should be visible.

---

## Part 2 — Intervention Types

---

### 2.1 Emergency Overrides (LEVEL_0)

**Operational context:** Genuine safety or compliance emergencies — fire, evacuation, regulatory requirement, safety announcement. These are the highest-authority interventions in the system.

**UX treatment:**
- Dedicated activation flow, accessed only from the Emergency Operations Workspace
- Scope selection required before activation (minimum viable scope — not global by default)
- Reason field required: "What is the emergency? [text]"
- Expiry required: time-bounded or explicit "until manually cleared" acknowledgment
- Post-activation: persistent banner in all workspaces showing emergency status, age, and creator

**Visual treatment in override list:** Emergency overrides are shown in red with the ⚠ symbol. They are listed first, regardless of age.

**Key design requirement:** Emergency override creation must be fast (3 taps or fewer) but must not be so fast that it bypasses scope and expiry. A 4-tap flow with required scope + expiry selection is acceptable. A 2-tap flow that creates a global, no-expiry emergency is not.

---

### 2.2 Sponsor Interventions

**Operational context:** A sponsor requires immediate content placement outside of their standard LEVEL_4 injection window — typically for an on-site visit, an event, or a time-sensitive promotion.

**UX treatment:**
- Accessed from the Sponsorship Operations Workspace or the override creation flow
- Scope selection: which screens? (default to the sponsor's contracted screens)
- Duration: typically short (hours, not days)
- SOV impact preview: "This intervention will increase [SPONSOR]'s SOV from [N]% to [M]% during this window"
- Displacement warning: "During this window, [OTHER_SPONSOR] content will not play on these screens"

**Key design principle:** Sponsor interventions are a business commitment, not just a technical configuration. The UX should surface the business implications (SOV changes, displacement of other sponsors) before the operator commits.

---

### 2.3 Venue-Local Overrides (LEVEL_1)

**Operational context:** The most common override type — a venue operator needs to change content for a period that doesn't fit the campaign schedule. A promotion running this weekend only. A staff-facing message during a shift change. A sports team's match day content.

**UX treatment:**
- Standard override creation flow
- Scope selection: screen, zone, or venue-wide
- Duration: required — time picker with "today only," "this weekend," "custom dates" shortcuts
- Impact preview: mandatory before confirmation (which screens are affected, what campaign content is displaced)
- Reason annotation: optional but encouraged ("Weekend promotion," "Match day content," etc.)

**Scope default:** Zone-level (the operator's current zone context), not venue-wide. The operator must explicitly expand to venue-wide scope.

---

### 2.4 Temporary Suppressions

**Operational context:** Suppressing existing campaign content for a brief period without replacing it with specific content — for maintenance windows, physical screen issues, or content that is temporarily inappropriate.

**Example:** "We're serving Christmas content but it's late January and the campaign hasn't been updated yet. Suppress it until the new campaign is ready."

**UX treatment:**
- Distinct from content-replacing overrides — a suppression creates a coverage gap rather than replacing with new content
- The fallback content (LEVEL_5) will serve during a suppression
- Clear labeling: "This override suppresses content. During this window, [FALLBACK_CONTENT] will play."
- Strong expiry enforcement: suppressions with no expiry are almost always unintentional

---

### 2.5 Pinned Content

**Operational context:** Content that must always appear on a specific screen regardless of any other scheduling — regulatory required content, permanent brand elements, always-on safety notices.

**UX treatment:**
- Pinned content is semantically distinct from an override — it is an intentional permanent configuration, not a temporary divergence
- In the override list, pinned content is shown in a separate "Permanent Content" section, not in the age-sorted override list
- Pinned content does not generate "aging" warnings — it is expected to be permanent
- Pinned content changes require explicit "I understand this is a permanent configuration change" acknowledgment

**Technical note:** Pinned content is implemented as a LEVEL_1 override with explicit "no expiry — permanent" flag. The UX treats it differently (separate list, different visual treatment) but the underlying mechanism is the same.

---

### 2.6 Operator Escalations

**Operational context:** An operator at one level (Floor Operator) creates a situation that requires resolution by a higher-level operator (Venue Manager) — a conflict they cannot resolve themselves, or an action requiring approval.

**UX treatment:**
- Escalation is a formal workflow, not just a notification
- The escalating operator creates the override request with reason and proposed scope
- The approving operator receives a structured request with impact preview
- Approval creates the override with the approving operator's attribution
- Denial returns to the escalating operator with explanation

**Audit trail:** All escalated overrides carry a two-operator attribution chain: requested by [OPERATOR_A], approved by [OPERATOR_B].

---

## Part 3 — Override Lifecycle UX

---

### 3.1 Creation Visibility

When an override is created, it must immediately appear in:
1. The active-overrides feed for the venue
2. The Live Operations Workspace screen grid (affected screens update their resolution level indicator)
3. The screen introspection view for all affected screens (override appears in the resolution trace)
4. The Venue Operations Workspace entropy signal summary (if the new override triggers a threshold)

**Response time requirement:** Override appearance in all affected views: ≤ 15 seconds (one poll cycle).

---

### 3.2 Impact Preview

Before any override is committed, the operator must see its impact. This is a non-negotiable requirement per PREVIEW-SYSTEMS-SPEC-v1.md §2.4 (Override Impact Simulation — Mode 4).

**Impact preview elements:**
- Affected screens: listed by name with their current state and their post-override state
- Non-affected screens: screens with higher-level rules that will not change (showing operator the override is not "escaping" into unexpected scope)
- Campaign displacement: which campaigns will be suppressed, for how long
- Sponsor displacement: if any sponsor content is affected, flag with SOV impact
- Coverage gaps: will any coverage gap result from this override?

**The preview is not a warning — it is operational information.** The operator may proceed after reviewing the impact. The purpose is not to create friction but to ensure the operator knows what they are doing.

---

### 3.3 Expiration Visibility

Approaching expiration must be surfaced proactively, not discovered after the fact.

**Expiration notification sequence:**

| Time before expiry | Signal | Delivered to |
|--------------------|--------|--------------|
| 24 hours | In-app notification | Creating operator + Venue Manager |
| 4 hours | Prominent in-app indicator | Creating operator |
| 1 hour | High-visibility indicator in Live Operations Workspace | Any logged-in operator at venue |
| Expired | Immediate removal from active rules; logged to override history | — |

**The "what happens at expiry" preview:** When an operator looks at an override that is expiring soon, they should see:

```
Override expires in: 3 hours 22 minutes

When this override expires:
  Screen B1, B2, B3: Campaign A will resume ([CONTENT_A])
  Screen B4: No campaign matches — fallback will play ← ⚡ Review
```

This preview gives the operator the opportunity to extend the override, modify the campaign, or accept the transition — before the expiry, not after.

---

### 3.4 Aging Indicators

Per ENTROPY-OBSERVABILITY-UX-v1.md §3.1 (Override Age Distribution), overrides age visually in the CMS:

| Age | Visual treatment | Label |
|-----|-----------------|-------|
| 0–7 days | Normal (green age indicator) | "N days old" |
| 7–30 days | Amber age indicator | "N days old — review?" |
| 30–90 days | Orange age indicator | "N days old — aging" |
| 90+ days | Red age indicator | "N days old — stale" |
| No expiry + departed operator | Red + italic attribution | "Possible orphan" |

Aging is a visual signal, not a warning modal. It is always visible in the override list; it does not require the operator to open each override. The operator should be able to scan the override list and immediately identify which overrides are old without clicking anything.

---

### 3.5 Stale Override Detection

An override is "stale" when it is likely no longer serving its original operational purpose. Heuristics:

- Age > 90 days with no expiry date
- Age > 30 days with no modification (no operator has looked at it)
- Created by a departed operator (account deactivated)
- Its stated reason (if provided) describes a past event ("Christmas promotion," "tournament day")

**UX surface:** Stale overrides appear in a dedicated "Stale overrides" section in the Venue Operations Workspace, separate from the normal override list. This makes the cleanup task explicit: the operator is not looking at an overwhelming list of all overrides — they are looking at a focused queue of overrides that probably need attention.

---

### 3.6 Cleanup Workflows

Cleanup is a first-class operation in the CMS. It is not an edge case accessed through settings — it is a regular operational task that the Venue Manager should perform on a scheduled basis.

**Cleanup workflow entry point:** "Review stale overrides" — a dedicated workflow accessible from the Venue Operations Workspace.

**Per-override cleanup actions:**
1. **Remove:** Override is no longer needed. Deactivate immediately.
2. **Extend:** Override is still needed. Set a new expiry date with a reason update.
3. **Convert to campaign:** Override has been running long enough that it should become a campaign. Create a campaign with the same content and scope; remove the override.
4. **Mark as intentional:** Override is permanent and correct. Add a "permanent — intentional" flag to suppress aging warnings.

**Batch cleanup:** "Remove all overrides from [departed operator's] account" — a single action that initiates a review flow for all of that operator's active configurations.

---

## Part 4 — Override Impact Visibility

---

### 4.1 What Is Displaced

Every override displaces something. The displacement must be visible before and after creation.

**Displacement types:**

| Displaced element | Visibility requirement |
|------------------|----------------------|
| Campaign content | Show which campaigns are suppressed, on which screens, for what duration |
| Sponsor content | Show which sponsors lose airtime, with estimated SOV impact |
| Scheduled overrides | Show which lower-level overrides are now also suppressed |
| Compliance content | ⚠ CRITICAL — any displacement of compliance-designated content requires explicit acknowledgment |

**Compliance displacement** is treated differently from other displacement. Suppressing compliance content may have regulatory implications. Any override that would suppress compliance-designated content (gaming area announcements, mandatory safety content) triggers an explicit, named warning:

```
⚠ WARNING: This override will suppress compliance content

  [SCREEN_G1] is configured to show [COMPLIANCE_CONTENT] during [TIME_WINDOW]
  This override will suppress that content during [OVERRIDE_DURATION]

  Before proceeding, confirm:
  ☐ I understand the compliance content will not play during this window
  ☐ This suppression is authorized by [ROLE]
  ☐ I have documented the reason for this suppression: [text field]

  [Proceed with override] [Modify scope to avoid compliance screens]
```

---

### 4.2 Which Sponsors Are Affected

Any override that affects screens carrying sponsor content must show the sponsor impact:

```
Sponsor impact of this override:

  [SPONSOR_X]: Will lose approximately 2.5 hours of scheduled exposure on B1–B3
    Rolling 7-day SOV impact: 25% → 21% (below 25% contract threshold) ⚠

  [SPONSOR_Y]: Will lose approximately 1 hour of scheduled exposure on B2
    Rolling 7-day SOV impact: 18% → 17% (within 20% contract threshold) ✓
```

The sponsor impact display must translate lost time into SOV impact. An operator who doesn't understand the sponsor contract implications needs to see whether the override pushes any sponsor below their contract threshold.

---

### 4.3 Which Venues Diverge

For network-level overrides (Org Admin creating an override that applies across multiple venues), the impact preview must show per-venue effects:

```
This override will affect [N] venues.

  Venue A: Current winner at LEVEL_3 (Campaign A) → will be replaced by this override
  Venue B: Current winner at LEVEL_1 (Override X) → not affected (existing higher override)
  Venue C: Current winner at LEVEL_3 (Campaign B) → will be replaced by this override
  ...
```

Network-level operators must never create a network override believing it affects all venues, when actually some venues have local overrides that will continue to take precedence.

---

### 4.4 Downstream Entropy Impact

For operators with Venue Manager or above access, the impact preview includes an entropy impact estimate:

```
Entropy impact of this override:

  Current venue health: B (Good)
  After this override: B (no change — override has 3-day expiry within threshold)

  If this override is not cleaned up within 30 days:
  Projected health impact: B → C
```

This surfaces the maintenance commitment in the creation flow: the override is low-cost if cleaned up on schedule; it becomes costly if orphaned.

---

## Part 5 — Emergency Intervention UX

---

### 5.1 High-Pressure Operational Cognition

Emergency intervention UX must be designed for the scenario where an operator is under acute stress — fire alarm, safety incident, regulatory enforcement action. See OPERATOR-COGNITIVE-MODELS-v1.md §5.2 (Emergency Cognition) for the full stress model.

**Design principles for high-pressure emergency UX:**

- **Maximum clarity, minimum text:** Every label must be immediately understandable without reading carefully. No jargon.
- **Minimum taps to activation:** Emergency activation must be reachable in 3 taps from the Live Operations Workspace.
- **Default to minimum scope:** A stressed operator will tend toward global scope. Default to the current zone or venue; require deliberate action to expand to network-wide.
- **Expiry required but pre-populated:** A default expiry of 4 hours should be pre-populated. The operator can change it. The default prevents no-expiry creation.
- **Immediate visual confirmation:** After activation, the entire CMS interface should visually change — a persistent emergency banner must be impossible to miss.

---

### 5.2 Panic-Resistant Workflows

The emergency workflow must be operable by someone who is scared, moving fast, and possibly not reading carefully:

**Emergency activation flow:**

```
Step 1: [Activate Emergency Content]
  Large, clearly labeled button in the Emergency Operations Workspace
  Always visible from persistent navigation

Step 2: Select scope
  ○ Current zone: [ZONE_NAME] ([N] screens)
  ○ This venue: [VENUE_NAME] ([M] screens)
  ○ All venues in [ORG] ([P] screens) ← requires explicit confirmation

Step 3: Emergency content
  Content automatically: [DEFAULT_EMERGENCY_CONTENT]
  ○ Use default emergency content
  ○ Select different content → [content picker]

Step 4: Duration
  ○ 2 hours
  ○ 4 hours ← pre-selected
  ○ End of today
  ○ Until I manually clear it ← requires extra confirmation

Step 5: Confirm
  [EMERGENCY CONTENT NOW ACTIVE ON [N] SCREENS]
  ← Large, red confirmation button
```

Total taps: 5 (one per step with default selections). This is acceptable for an emergency flow because each step has a pre-populated default — the operator can tap through without reading if they trust the defaults.

---

### 5.3 Minimal Ambiguity

During emergency activation, no step should present an ambiguous choice. Every option must be self-explaining:

✓ Good: "Current zone: Bar Area (4 screens)"
✗ Bad: "Zone-level scope"

✓ Good: "Until I manually clear it — this emergency will stay active until I come back and clear it"
✗ Bad: "No expiry"

✓ Good: "4 hours — recommended for operational incidents"
✗ Bad: "Custom duration"

---

### 5.4 Irreversible-Action Safeguards

Emergency activation is reversible — emergencies can be cleared. But for any intervention that has immediate, broad scope effects, a brief confirmation that names the scope is required:

```
You are activating emergency content on:
  ALL 23 SCREENS IN [VENUE_NAME]

Confirm? [ACTIVATE EMERGENCY] [Go back]
```

The confirmation must name the scope explicitly and numerically. "Venue-wide" is less clear than "all 23 screens."

---

### 5.5 Recovery Visibility

After an emergency is cleared, the CMS must show the operator what is restored:

```
Emergency cleared at 14:32

Resuming normal scheduling on [N] screens:
  Screens B1–B4: Campaign A resumes
  Screens D1–D2: Campaign B resumes
  Screen G1: Compliance content resumes ← confirm this
  ...

All screens should return to normal within 15 seconds (one poll cycle).
```

Recovery visibility provides closure — the operator knows the emergency is over and what is resuming. Without this, operators sometimes re-activate emergency content because they're not sure the clearance worked.

---

## Part 6 — Dangerous Intervention Failure Modes

---

### F-01: Override Addiction

**Definition:** Operators stop using campaigns and use overrides for all content management, because overrides feel more certain and reliable.

**Genesis:** OPERATOR-COGNITIVE-MODELS-v1.md §6.3. Caused by campaigns that fail to win without visible explanation.

**UX prevention:**
- When a campaign fails to win, explain why (suppression visibility)
- When an operator creates a new override for content that could be a campaign, offer the campaign path
- The override creation flow is slightly more friction than campaign management — not dramatically more, but enough to make campaigns the path of least resistance for planned content

---

### F-02: Emergency Normalization

**Definition:** Emergency-level overrides used for non-emergency operational needs because they provide "guaranteed" immediate content placement.

**Genesis:** OPERATOR-COGNITIVE-MODELS-v1.md §6.4 (Semantic Drift). Caused by operators who discover that LEVEL_0 emergency content cannot be suppressed.

**UX prevention:**
- Emergency activation requires a reason field — operators must articulate the emergency
- Entropy monitoring flags emergency reason fields containing non-emergency language (sponsor names, event names, etc.) as potential Emergency Semantic Collapse signals (Metric M-10)
- Emergency override count in the entropy summary increases visibility of emergency tool misuse

---

### F-03: Hidden Divergence

**Definition:** An override is active and suppressing content, but is not visible in the views operators normally use.

**Genesis:** UX designs that show campaigns and schedules separately from overrides, with no cross-reference.

**UX prevention:**
- The active-overrides feed is accessible from every workspace
- The campaign management view shows per-screen winning status — when a campaign is not winning on a screen, the suppressor is visible inline
- No configuration view may show "Active" status for a campaign without also showing whether it is winning on its targeted screens

---

### F-04: Silent Operational Decay

**Definition:** Override accumulation, aging, and orphaning happens over months without any operator noticing — because the system shows no signal.

**Genesis:** The absence of entropy observability surfaces. Without aging indicators, override count signals, and stale override detection, overrides accumulate silently.

**UX prevention:** All override aging surfaces from ENTROPY-OBSERVABILITY-UX-v1.md Part 3 are the structural countermeasure. The override list must never look the same whether there are 2 overrides or 22 overrides — the visual weight of accumulated overrides must increase visibly with override count.

---

### F-05: Layered Override Collapse

**Definition:** Multiple overrides at the same or different levels have accumulated over time, creating a complex resolution chain that no operator fully understands. The venue's effective content state is determined by accumulated override interactions that no single operator designed.

**Genesis:** Each override was created for a legitimate reason. No single override is wrong. The combination has become incomprehensible.

**UX prevention:**
- The screen introspection view must show the full override stack, not just the winning override
- When more than 3 overrides are active and competing for the same screens, a "complex resolution warning" surfaces: "Multiple overrides are active for these screens. Review to ensure the correct content is winning."
- The venue health grade degrades appropriately as override count increases, creating pressure toward cleanup before layered collapse is reached

---

## Part 7 — Intervention Governance Surfaces

---

### 7.1 Approval Visibility

For organizations with approval workflows (Venue Manager must approve Floor Operator overrides, or Org Admin must approve cross-venue interventions), the approval chain must be visible in the override detail:

```
Override: [OVERRIDE_NAME]
Status: Pending approval

Requested by: [OPERATOR_A] at [TIME]
Awaiting approval from: [OPERATOR_B] (Venue Manager)

Requested content: [CONTENT_NAME]
Proposed scope: Screens B1–B4
Proposed duration: This weekend (expires Sunday 23:59)
Stated reason: "Sponsor visit — need to show [SPONSOR] content prominently"

Impact preview: [show] → Campaign A suppressed on B1–B4 for 2 days

[Approve] [Deny with explanation] [Modify and approve]
```

---

### 7.2 Provenance Visibility

Every override must carry immutable provenance: who created it, when, and what reason they provided. Provenance is never editable — only notes may be added.

If an override was approved by a second operator (escalation workflow), both operators appear in the provenance:

```
Created by: [OPERATOR_A] — 2026-05-20 14:37
Approved by: [OPERATOR_B] — 2026-05-20 14:52
Last modified: [OPERATOR_A] — 2026-05-21 09:15 (extended expiry)
```

---

### 7.3 Intervention Auditability

The intervention audit log is a complete, append-only record of every override creation, modification, approval, rejection, and deactivation event.

**Audit log entry format:**
```
2026-05-20 14:37 | OVERRIDE_CREATED | [OPERATOR_A] | [OVERRIDE_NAME] | Scope: B1–B4 | Expiry: 2026-05-31
2026-05-20 14:52 | OVERRIDE_APPROVED | [OPERATOR_B] | [OVERRIDE_NAME]
2026-05-21 09:15 | OVERRIDE_MODIFIED | [OPERATOR_A] | [OVERRIDE_NAME] | Changed: expiry extended to 2026-06-15
```

The audit log is immutable — once written, entries cannot be changed or deleted. It serves as the authoritative record for dispute resolution, compliance audits, and incident investigation.

---

### 7.4 Escalation History

The full escalation history for a venue — every time a Floor Operator escalated to a Venue Manager, every time a Venue Manager escalated to Org Admin — is visible in the Venue Operations Workspace.

**Purpose:** Escalation history reveals patterns. If the same operator is escalating the same type of override request repeatedly, it suggests a training gap. If escalations are clustered around specific events (match days, compliance audits), it suggests a process gap for those event types.

---

### 7.5 Replay Compatibility

Every override, at every point in its lifecycle, must be fully replayable. The PRE's deterministic replay (INV-3) means that given the historical system state (including all historical overrides and their states at specific times), the PRE can reconstruct exactly what any screen was showing at any past time.

**Implementation requirement for Agent 1:** The override state log must preserve the full temporal history of each override — when it was created, when it was modified, what its state was at each point in time. Point-in-time reconstruction requires point-in-time state preservation.

---

## Related Documents

**FAILURE-CONTAINMENT-AND-RECOVERY-UX-v1.md** — When overrides cascade across multiple screens or venues, the scope-containment and blast-radius visualization requirements are defined there. These two documents address override cascades from different angles: this document covers the override lifecycle (creation, scope, aging, expiry, audit) — the operator's management of individual overrides over time; FAILURE-CONTAINMENT covers how cascade failures are visually bounded (blast-radius scope visualization, "clean since" confidence rebuilding, stabilization-first recovery). In a cascade failure scenario, both documents apply simultaneously.

---

*End of INTERVENTION-AND-OVERRIDE-UX-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Override state log and temporal preservation: Agent 1 (Platform) requirement*
*Override approval workflows and governance: Agent 2 (CMS) design responsibility*
*Anti-normalization thresholds require Agent 2 review before implementation*
