# ClubHub TV — Screen Introspection System v1
# Operator Visibility Into Any Screen At Any Time

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, EXPLAINABILITY-UX-SPEC-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, FAILURE-STORIES.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Screen Introspection Philosophy

---

### 1.1 Why Operators Lose Trust

Trust in the ClubHub TV system is built through accurate prediction and verified outcome. When an operator configures a screen, they form an expectation. When they check the screen (physically, or through the CMS), they verify the expectation. A sequence of correct predictions builds trust.

Trust collapses through a single mechanism: the screen is doing something the operator cannot explain.

Not necessarily something wrong — something unexplainable. An operator who walks past a screen and sees content they don't recognize, with no way to discover what rule is causing it or whether it is intentional, is an operator who has lost trust in the system's determinism. Even if the screen is showing the right content for the right reason, the inability to verify that is itself a trust failure.

**The CMS must make every screen explainable on demand, in under 30 seconds, to any authorized operator.**

Not in 30 seconds after navigating through 4 menus. In 30 seconds from the moment the operator opens the screen introspection view — which must be accessible from any screen's representation in any workspace.

---

### 1.2 Why "The Screen Is Wrong" Is Dangerous

When an operator observes that a screen is showing unexpected content and cannot explain it, they take one of three actions:

**Action 1 — Create an override.** "I don't know why it's showing that, but I need it to show this." The override may or may not fix the problem; it definitely adds entropy.

**Action 2 — Escalate.** The operator calls their manager, who calls their manager, who either creates a more forceful override (compounding entropy) or contacts support.

**Action 3 — Give up.** "The screens are unpredictable. I'll just check them before events and fix whatever's wrong." This is the transition to a permanent reactive-override operational mode. The operator has abandoned preventive configuration in favor of live correction.

All three responses are destructive. All three are caused by the same absence: **the operator cannot see why the screen is doing what it is doing.**

Screen introspection eliminates the cause. If the operator can open a screen view, see in plain language "This screen is showing [CONTENT] because [RULE] is active at [LEVEL] — created by [OPERATOR] on [DATE] with expiry [DATE]," all three destructive responses become unnecessary.

---

### 1.3 Visibility as Anti-Folklore Infrastructure

Folklore about system behavior (see OPERATOR-COGNITIVE-MODELS-v1.md §6.2) emerges when operators explain observed outcomes through informal inference rather than through documented system behavior. Folklore spreads because each operator who encounters an unexplained behavior forms their own hypothesis, and hypotheses that are occasionally confirmed become institutional belief.

Screen introspection is the structural counter to folklore. When any operator can look at any screen and see exactly why it is doing what it is doing — not an abstracted summary, but the full resolution trace — there is no gap in which folklore can form.

The screen introspection system must be complete enough that no operator ever needs to infer. Every observable screen behavior must have a complete, legible explanation accessible in the CMS.

---

## Part 2 — Screen State Model

---

### 2.1 The Complete Screen State

A screen's complete operational state at any given time consists of:

| State component | Description | Source |
|-----------------|-------------|--------|
| Current playback | What content item is currently being shown | PRE output → manifest delivery |
| Winning rule | Which rule is responsible for current playback | PRE reason_trace |
| Active candidates | All rules that could apply to this screen right now | PRE losing_candidates |
| Losing candidates | All rules evaluated but not winning, with loss reasons | PRE losing_candidates + suppression codes |
| Active overrides | All operational and scheduled overrides currently affecting this screen | Resolution trace LEVEL_1–2 |
| Sponsor injections | Any active LEVEL_4 sponsor content | Resolution trace LEVEL_4 |
| Emergency state | Whether LEVEL_0 emergency is active, scope, duration | Resolution trace LEVEL_0 |
| Confidence score | Delivery confidence based on recent delivery log | PRE output confidence field |
| Last delivery | Timestamp and content of last confirmed delivery | Delivery log |
| Operational context | Zone membership, venue-specific configurations | Screen metadata |

**Design requirement:** The screen introspection view must expose all of these state components. Not necessarily all at once (progressive disclosure applies), but all must be reachable from a single entry point.

---

### 2.2 Screen State Display — Three Panels

The screen introspection view is organized into three panels, each addressing a distinct operator need:

**Panel A — NOW: What is happening**
Current effective state. What content, what rule, what level. Answers Q1 ("Why is this playing?") from EXPLAINABILITY-UX-SPEC-v1.md.

**Panel B — WHY: How the resolution was decided**
The resolution trace, rendered progressively. Answers Q2 ("Why did this rule lose?") and Q3 ("What is suppressing this?").

**Panel C — WHEN: What changes over time**
The screen timeline — past, present, and future content transitions. Answers Q4 ("What changed?"), Q5 ("What plays next?"), and enables the counterfactual (Q7).

These three panels are the structural minimum for a complete screen introspection experience. Any screen view in the CMS that omits one of these panels is operationally incomplete.

---

### 2.3 Screen State Indicators

Before the operator opens the full introspection view, every representation of a screen in any workspace must carry a minimal state indicator conveying the screen's current operational context.

**Indicator elements:**

```
┌─────────────────────────────┐
│ SCREEN_NAME            🔒   │  ← Resolution level icon
│ Zone: Bar Area              │
│                             │
│ [CONTENT_NAME]              │  ← Current content
│ via Operational Override    │  ← Winning rule type (plain language)
│ 91% confidence              │  ← Confidence indicator
│ Override expires: Saturday  │  ← Next transition
└─────────────────────────────┘
```

**Resolution level icons** (from EXPLAINABILITY-UX-SPEC-v1.md §4.4):
- ⚠ Emergency (LEVEL_0)
- 🔒 Operational Override (LEVEL_1)
- 🗓 Scheduled Override (LEVEL_2)
- 📋 Campaign (LEVEL_3)
- 💰 Sponsor Injection (LEVEL_4)
- ↩ Fallback (LEVEL_5)
- 📺 Device Default (LEVEL_6)
- ⬛ Offline / No delivery

**Confidence indicator:** Shown as a percentage. Any screen below 70% confidence shows the percentage in amber. Below 50%, in red.

---

## Part 3 — Screen Timeline View

---

### 3.1 The Timeline as Primary Temporal Navigation

The screen timeline is the operator's primary tool for understanding a screen's past and future. It is a horizontal time axis showing content blocks — each block represents a contiguous period in which one rule is winning.

**Visual language:**

```
Screen: [SCREEN_NAME] — Tuesday 2026-05-26

 08:00     10:00     12:00     14:00     16:00     18:00     20:00
   │         │         │         │         │         │         │
   ████████████████████░░░████████████████████████████████████████
   Campaign A           ↑ Gap     Operational Override (expires 18:00)
                    Coverage
                      gap

   ↑ NOW
```

**Color legend:**
- Dark green: Campaign / Schedule (LEVEL_3) — normal operations
- Amber: Operational Override (LEVEL_1) — may be displacing campaigns
- Orange: Scheduled Override (LEVEL_2)
- Red: Emergency (LEVEL_0)
- Blue: Sponsor Injection (LEVEL_4)
- Light grey: Fallback (LEVEL_5)
- Dark grey: Device Default (LEVEL_6)
- Hatched / white: Coverage gap — no rule active, fallback will serve

**Interaction:**
- Tap any block → resolves to the full resolution trace for that time window
- Tap a coverage gap → "No content scheduled for this window" with an option to schedule
- Tap a transition point → see the full resolution change (what was active, what takes over, why the change)

---

### 3.2 Interruption Timeline

The interruption timeline is a secondary layer on the screen timeline showing rule transitions — every moment when the winning rule changes.

Transitions are marked with vertical tick marks:

```
 08:00     10:00     12:00     14:00     16:00
   │         │         │         │         │
   ████████████████████████▐████████████████
   Campaign A              ↑
                     Transition at 12:00:
                     Campaign A expires
                     Override B activates
```

Tapping a transition tick opens:

```
Transition at 12:00 — Tuesday 2026-05-26

Before (until 11:59):
  Campaign A — [CONTENT_A] — Level 3 (Campaign)
  Created by [OPERATOR_A] on 2026-01-10

After (from 12:00):
  Override B — [CONTENT_B] — Level 1 (Operational Override)
  Created by [OPERATOR_B] on 2026-05-20
  Expires: Saturday 23:59

Why the change:
  Override B at LEVEL_1 takes precedence over Campaign A at LEVEL_3
  from its activation time onward.
```

This is the most important surface for operators verifying that their configuration changes will take effect at the expected time.

---

### 3.3 Override Timeline Layer

The override timeline is a dedicated layer showing all overrides that are active during the visible time window — regardless of whether they are the winning rule at every moment.

This matters because an override may not be winning every moment (a higher-level override may be active) but it is still in the resolution chain and will become the winning rule when the higher override expires.

```
Override layer for [SCREEN_NAME] — Tuesday:

  LEVEL_0 Emergency: ░░░░░░░░░░░░░░░░░░ (none active)
  LEVEL_1 Override:  ████████████████░░░░ Override B (expires 18:00)
  LEVEL_2 Override:  ░░░████████░░░░░░░░░ Override C (12:00–14:00)
  LEVEL_3 Campaign:  ████░░░░░░░░░████████ Campaign A (ongoing)
```

This stacked layer view makes the resolution priority hierarchy visible in time — operators can see which rule is controlling which period by visual inspection without needing to open each individual rule.

---

### 3.4 Sponsorship Exposure Timeline

A third timeline layer showing sponsor content exposure across the visible window:

```
Sponsor exposure for [SCREEN_NAME] — Tuesday:

  [SPONSOR_X]:  ████░░████░░████░░████░░ (approx 40% of day)
  [SPONSOR_Y]:  ░░░░████░░░░░░░░████░░░░ (approx 20% of day)
  Editorial:    ░░░░░░░░░░████░░░░░░░░░░ (approx 20% of day)
  Override:     ████████████░░░░░░░░░░░░ (suppressing other content in morning)
```

This surface directly answers the Sponsorship Manager's primary question: is sponsor content getting the airtime it is contracted for, and what is displacing it when it isn't?

---

## Part 4 — Screen Reason Trace UX

---

### 4.1 Why Playing

The "Why Playing" panel is the Level 1 explainability surface for a screen (per EXPLAINABILITY-UX-SPEC-v1.md §4.1). It answers in one to three items:

```
This screen is showing:
  [CONTENT_NAME]

Because:
  Operational Override "[OVERRIDE_NAME]" is active
  Created by [OPERATOR] on [DATE]
  Expires: [DATE]

[See full resolution trace ↓]
```

This is the surface an operator sees in the first 3 seconds of opening screen introspection. It must always be present and always be accurate.

---

### 4.2 Why Not Playing

The "Why Not Playing" panel is accessed when an operator searches for a specific rule or content item and asks "why isn't this showing on this screen?"

This is the primary diagnostic surface for the system. See EXPLAINABILITY-UX-SPEC-v1.md §3.2 (Suppression Trees) for the full suppression tree specification.

Entry points:
- From campaign view: "Why isn't [CAMPAIGN_NAME] showing on [SCREEN_NAME]?"
- From override view: "Why isn't [OVERRIDE_NAME] winning on [SCREEN_NAME]?"
- From content item view: "Where is this content currently showing? Where is it not?"

---

### 4.3 What Suppressed This

The full suppression tree — showing every level evaluated, every rule considered, and the specific reason each one lost. Per EXPLAINABILITY-UX-SPEC-v1.md §3.2.

This is the Level 3 diagnostic view (per §4.1 progressive disclosure). It is accessed from "See full resolution trace" in the Why Playing panel, or from "Diagnose suppression" in the Why Not Playing panel.

**Full resolution trace for screen [SCREEN_NAME] at [TIME]:**

```
Resolution result: [CONTENT_B] via Override B at LEVEL_1

LEVEL_0 — Emergency [CLEAR — no active emergency]

LEVEL_1 — Operational Override ← WINNER
  ├── Override B: [CONTENT_B]
  │   Created: 2026-05-20 by [OPERATOR_B]
  │   Scope: Screen B1–B4 (this screen: B2 ✓)
  │   Expires: 2026-05-31
  │   Specificity: SPEC_3 (screen-zone targeted)
  └── Override A: [CONTENT_A] ← LOST at LEVEL_1
      Specificity: SPEC_2 (venue-level targeted)
      Loss reason: SPECIFICITY_OUTRANKED by Override B

LEVEL_2 — Scheduled Override [Not evaluated — LEVEL_1 resolved]
  └── (Would have matched: Override C — not evaluated)

LEVEL_3 — Campaign [Not evaluated — LEVEL_1 resolved]
  └── (Would have matched: Campaign A — suppressed)

LEVEL_4 — Sponsor Injection [Not evaluated — LEVEL_1 resolved]
  └── (Would have matched: Sponsor X — suppressed)

LEVEL_5–6 — [Not evaluated]
```

**Language rules:** Level identifiers in the technical display (Level 3 only) — plain language descriptions in Level 1–2 views. Every "not evaluated" entry must explain why it wasn't evaluated (because a higher level already resolved).

---

### 4.4 What Would Play Otherwise

The counterfactual view answers: "If [WINNING_RULE] were removed right now, what would play?"

This is a one-tap simulation from any suppression explanation:

```
Override B is active and winning.
If Override B were removed:

  Next winner would be:
  → Campaign A at LEVEL_3 via [CONTENT_A]
  Starting immediately
  This campaign is active until 2026-06-30

  [Remove Override B and restore Campaign A]
  [Keep Override B]
  [Preview what happens]
```

The "Preview what happens" option calls the PRE with the hypothetical state (override removed) and displays the result. This is the Q7 counterfactual ("What would happen if…?") from EXPLAINABILITY-UX-SPEC-v1.md §2.7.

---

## Part 5 — Deterministic Replay UX

---

### 5.1 Historical Screen Reconstruction

Any authorized operator must be able to reconstruct what any screen was showing at any past time, using the PRE's deterministic replay (INV-3).

**Access:** Screen introspection → time picker → navigate to past time → "Reconstruct what was playing at [TIME]"

**Display:** The reconstruction renders identically to the current screen introspection view, with all three panels (Now, Why, When), but anchored to the historical time. All labels are marked:

```
Historical reconstruction — 2026-05-10 at 19:45
────────────────────────────────────────────────
This view shows system state as it existed at this time.
It is not current state.

At that time, this screen was showing:
  [CONTENT_NAME] via [RULE_NAME] at LEVEL_3 (Campaign)
```

The historical view must not be visually similar to the current view without the timestamp clearly visible. An operator who believes they are looking at current state but is actually looking at 3-days-ago state has a dangerous mismatch.

---

### 5.2 Dispute Analysis

The deterministic replay capability enables formal dispute analysis: when a sponsor, operator, or compliance officer disputes what was playing at a specific time, the system can reconstruct the exact state.

**Dispute analysis flow:**

1. Operator enters the disputed time range
2. System reconstructs the PRE output for each screen in the dispute scope at the relevant times
3. System compares PRE output to delivery log (what was actually confirmed delivered)
4. Result: "At [TIME], screen [NAME] was configured to show [CONTENT] and delivery was [CONFIRMED / NOT CONFIRMED / UNVERIFIABLE]"

The distinction between "configured to show" and "confirmed delivered" is important. PRE output tells us what should have played. Delivery log tells us what was confirmed as delivered to the device. If a device was offline, the PRE output and the delivery log will diverge — this is not a PRE failure, it is a device connectivity event.

---

### 5.3 Sponsor Verification

For sponsor contracts that require proof of delivery, deterministic replay provides the technical foundation.

**Proof of play report generation:**

1. Select sponsor + date range + contracted screens
2. System reconstructs PRE output for all relevant screens during the period
3. System cross-references delivery log for delivery confirmation
4. Report: "For [SPONSOR_NAME] during [PERIOD], contracted SOV was [N]%. Configured SOV was [M]%. Confirmed delivered SOV was [P]%."

Three-way distinction:
- **Contracted:** What the sponsor paid for
- **Configured:** What the system was set up to deliver
- **Confirmed:** What the delivery log confirms was actually delivered

All three numbers matter. Configured ≠ Contracted reveals a fulfillment gap. Confirmed ≠ Configured reveals a delivery gap (device offline, network issues).

---

### 5.4 Operational Audit Support

For compliance audits (gaming area regulatory requirements, age-restricted content scheduling), replay enables verification that mandatory content was playing during required windows.

**Audit support flow:** Same as dispute analysis — reconstruct state for specific time windows, cross-reference delivery log, produce a report showing what was configured and what was confirmed delivered.

The audit report is a read-only document with timestamp, system version, and a statement of PRE determinism: "This reconstruction is computed from the preserved system state at the specified time and is guaranteed to be identical to the original PRE computation due to deterministic replay."

---

## Part 6 — Screen Health Model

---

### 6.1 Unstable Screens

**Definition:** A screen with frequent rule transitions — the winning rule changes many times per hour due to many short-duration rules competing.

**Signals:**
- More than N rule transitions in a 24-hour window (configurable threshold, default: 12)
- Multiple rules at the same level competing with different time windows
- Override and campaign rules alternating frequently

**Why instability matters:** Unstable screens are cognitively expensive to manage. Operators cannot form a stable mental model of what the screen is doing. They are also more likely to have unexpected content appearing during gaps or transition errors.

**UX treatment:** Unstable screens appear with a 〜 (wave) indicator in the screen grid. Tapping the indicator shows the transition count and a simplified version of the interruption timeline.

---

### 6.2 Entropy-Heavy Screens

**Definition:** A screen with a high concentration of entropy signals — many overrides, conflicting rules, orphaned configurations.

**Signals:**
- 3 or more active overrides (any combination of LEVEL_1–2)
- Active rule created by a departed operator with no expiry
- Conflicting rules at the same level

**UX treatment:** Entropy-heavy screens appear with the ⚡ indicator. The screen introspection view for an entropy-heavy screen shows an entropy summary at the top, before the standard panels:

```
⚡ This screen has elevated operational complexity

  3 active overrides (1 over 90 days old)
  1 orphaned rule from departed operator [NAME]

  [Review and clean up]
  [See full state]
```

---

### 6.3 Override-Saturated Screens

**Definition:** A screen where overrides are the primary content delivery mechanism — campaigns are present but consistently suppressed.

**Signals:** Campaign wins 0–20% of the screen's scheduled hours; overrides win 80–100%.

**Why this matters:** An override-saturated screen is a screen where campaign-based configuration has been abandoned in favor of direct override management. This is unsustainable — overrides require active management; campaigns do not. An override-saturated screen is at high risk of content failure when overrides expire without renewal.

**UX treatment:** Override-saturated screens appear with the 🔒 indicator (same as operational override level) but with a saturation annotation: "🔒 Override-saturated — campaigns suppressed." The Venue Operations Workspace flags these screens in the configuration review queue.

---

### 6.4 Stale-State Screens

**Definition:** A screen whose last delivery confirmation is older than expected given its expected poll cycle.

**Signals:** Delivery log shows no confirmation for > 1 poll cycle (>15 seconds in normal operation); or confidence score below 50%.

**Why this matters:** A screen with stale delivery confirmation may be offline, on a different HDMI input, or experiencing network issues. The system cannot verify that it is delivering the configured content. The operator should be alerted — not panicked, but informed.

**UX treatment:** Stale-state screens show the confidence score in red. The introspection view shows:

```
⚠ Last confirmed delivery: 47 minutes ago

  Possible causes:
  → Device offline (check power and network)
  → HDMI input switched to non-ClubHub source
  → Network connectivity issue

  Configured content: [CONTENT_NAME] via [RULE_NAME]
  Whether it is actually playing: unverifiable without device check
```

---

### 6.5 Divergence-Prone Screens

**Definition:** A screen with a history of divergences between PRE-predicted content and delivery log confirmation — even when the device is online.

**Signals:** Divergence history (per EXPLAINABILITY-UX-SPEC-v1.md §3.7) shows UNEXPECTED divergences (not explained by device offline or HDMI switch).

**Why this matters:** UNEXPECTED divergences are a signal of a possible constitutional violation — the PRE's deterministic output and the delivery log disagree for reasons that are not hardware-related. This must be investigated.

**UX treatment:** Divergence-prone screens appear with a ❓indicator. The introspection view shows the divergence history prominently with a "Requires investigation" flag. This is escalated to a Tier 3 advisory automatically.

---

## Part 7 — Human Factors

---

### 7.1 Why Operators Need Immediate Reassurance

The screen introspection system is not designed for calm, deliberate investigation. It must also work for operators in an elevated stress state — a Venue Manager who receives a complaint from a guest about wrong content, a Floor Operator who is checking a screen before an event, a Sponsorship Manager fielding a call from a sponsor whose content "isn't showing."

In these stress states, operators need:
1. **Immediate clarity** — the answer to "what is this screen doing?" within 3 seconds of opening the view
2. **Clear action paths** — if something is wrong, what do they do? Not a list of options — a recommended path
3. **Closure** — confirmation that their action worked. After fixing the problem, the screen introspection view should reflect the change

**Design requirement:** The Level 1 ("Now") panel must always load first and must always show the current state accurately, even if the Level 3 trace is still loading.

---

### 7.2 Why Ambiguity Creates Workaround Escalation

An operator who looks at the screen introspection view and still doesn't understand what is happening will escalate to an override. Every time ambiguity in the introspection view leads to an override, that override adds entropy.

The screen introspection view must be designed to the standard: **an operator who leaves this view without understanding what the screen is doing has experienced a UX failure.**

This is a testable standard. In usability testing, operators should be able to correctly answer "why is this screen showing this content?" after viewing the introspection view, with 100% accuracy for standard cases. Cases where they cannot answer correctly represent design failures to investigate and fix.

---

### 7.3 Why Visibility Reduces Panic Behavior

OPERATOR-COGNITIVE-MODELS-v1.md §5.3 describes "interruption panic" — the cognitive state when an operator discovers a wrong screen state under social observation. In this state, the operator's primary goal is to make the problem visually disappear, and they will use whatever tool is fastest.

Visibility reduces panic behavior because it gives the operator a diagnosis before they reach for the override. If the introspection view shows "this screen is showing [WRONG_CONTENT] because [OVERRIDE_A] is active (expired 2 days ago) — [remove override]," the operator can fix the problem correctly (remove the expired override) rather than incorrectly (add a new override on top of the old one).

The difference between a correct fix (one override removed) and an incorrect fix (one override added, one orphaned override remaining) is the difference between entropy reduction and entropy addition. Visibility enables the correct fix.

---

*End of SCREEN-INTROSPECTION-SYSTEM-v1.md*
*Document authority: Agent 3 (UX/Design)*
*PRE reason_trace and losing_candidate API: Agent 1 responsibility*
*Historical replay API: Agent 1 responsibility*
*Delivery log API: Agent 1 responsibility*
