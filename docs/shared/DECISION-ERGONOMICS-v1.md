# ClubHub TV — Decision Ergonomics v1
# Reducing Poor Cognition Under Pressure

**Document type:** Canonical UX specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future contributors
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, OPERATOR-COGNITIVE-MODELS-v1.md, INTERVENTION-AND-OVERRIDE-UX-v1.md, INCIDENT-OPERATIONS-UX-v1.md, EXPLAINABILITY-UX-SPEC-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## Part 1 — Decision Ergonomics Philosophy

---

### 1.1 Operational Cognition Under Load

Decision ergonomics is the study of how interface design affects the quality of decisions made under real operational conditions — not in controlled environments, but in the conditions under which operators actually work.

Operators in ClubHub TV venues make decisions under cognitive load:
- Floor operators managing screens while also managing bar staff, customer service, and event logistics
- Venue managers checking the CMS between meetings, phone calls, and physical venue walkthroughs
- Sponsorship managers receiving a call from a sponsor while navigating the SOV dashboard
- NOC operators monitoring 40 venues simultaneously while receiving alerts from multiple sources

Cognitive load degrades decision quality in predictable ways:
- **Reduced working memory:** Operators can hold fewer variables in mind simultaneously
- **Increased heuristic reliance:** Operators fall back on rules of thumb rather than systematic analysis
- **Reduced consequence evaluation:** Operators think about immediate effects, not downstream ones
- **Increased confirmation bias:** Operators notice information that confirms their current hypothesis

**Decision ergonomics does not attempt to eliminate cognitive load — that is impossible.** It designs interfaces that produce good outcomes even when operator cognition is impaired. A decision ergonomically sound interface produces safe outcomes when operators are distracted, rushed, or stressed — not only when they are calm and deliberate.

---

### 1.2 Ambiguity Minimization

Ambiguity in an interface decision point — when the operator cannot confidently predict what an action will do — increases cognitive load. The operator must spend working memory evaluating the ambiguity before they can act. Under cognitive load, operators resolve ambiguity through shortcuts: they choose the familiar option, the top option, the most prominently styled option, or they proceed through the fastest path.

**Design principle:** Every decision point must have unambiguous outcomes. Not "what this button does" ambiguity — that is basic UX. The required standard is higher: "what the outcome will be for the operational system" unambiguity.

✓ Unambiguous: "Activate emergency content on Bar Area (4 screens). All other content suppressed. Active until [EXPIRY]."
✗ Ambiguous: "Emergency override — apply."

✓ Unambiguous: "This override affects 12 screens, including 3 screens with active sponsor content."
✗ Ambiguous: "This override affects multiple screens."

---

### 1.3 Consequence Visibility

Most poor operational decisions are not the result of malice or incompetence — they are the result of incomplete consequence visibility. The operator knew what they wanted to happen. They did not know what else would happen as a result.

**Consequence visibility** means the interface shows the full operational consequence of an action before it is committed — not just the primary intended effect, but the secondary and downstream effects as well.

Secondary consequences that must be visible:
- Content displaced on screens the operator did not intend to target
- Sponsor SOV affected by the action
- Entropy cost increase (does this action degrade the venue health grade?)
- Future state implications (what happens when this rule expires with no successor?)

---

### 1.4 Reversible vs Irreversible Actions

Operational actions are not equally consequential. Some are easily reversed. Others have lasting effects that cannot be cleanly undone.

**Reversible actions** (low friction requirements):
- Viewing any CMS content (no state change)
- Creating an override with a short expiry (effect ends when expiry is reached)
- Creating a campaign (can be paused or deleted with immediate effect)
- Clearing an emergency (effect immediate; no residual)

**Partially reversible actions** (moderate friction requirements):
- Modifying a campaign that has already been running (historical delivery records remain; future delivery changes)
- Extending an override expiry (extension cannot be retroactively contracted)
- Creating an override with no expiry (the "irreversibility" is that cleanup requires deliberate future action)

**Irreversible or hard-to-reverse actions** (high friction requirements):
- Deleting a configuration object with historical delivery records (the records remain, but the configuration and its rationale are gone)
- Deactivating an operator account (their configurations become orphaned)
- Broadcasting a network-level override to all venues (scope cannot be "un-broadcast," only actively reversed)

The friction level applied to each action class must be proportional to the difficulty of reversal and the scope of potential harm.

---

## Part 2 — Decision Classes

---

### 2.1 Low-Risk Operational Changes

**Definition:** Changes with narrow scope, easy reversal, and limited downstream consequences.

Examples:
- Creating a zone-level override with a 7-day expiry
- Modifying a campaign's content (not its scope or timing)
- Adjusting SWRR weights on content items within an existing playlist

**UX treatment:**
- Standard creation/modification flow
- Impact preview shown but not required to acknowledge
- Confirmation step: single "Save" action
- Inline success confirmation with scope summary

**Friction level:** Minimal. The operator should be able to complete these changes in under 30 seconds without friction that feels disproportionate to the action.

---

### 2.2 Sponsorship-Impacting Changes

**Definition:** Changes that will affect the delivery of contracted sponsor content — reducing SOV below threshold, suppressing sponsor content during contracted windows, or modifying sponsor content configurations.

Examples:
- Creating an override that covers screens with active sponsor content
- Modifying a campaign that competes with sponsor injection windows
- Deactivating sponsor content before contract expiry

**UX treatment:**
- Mandatory impact preview showing sponsor SOV effect
- If SOV drops below contract threshold: explicit acknowledgment step required
- Confirmation step names the sponsor and the SOV impact

**Friction level:** Moderate. The operator can proceed, but must demonstrate awareness of the sponsor impact. The friction is not a barrier — it is an accountability moment.

---

### 2.3 Emergency Actions

**Definition:** LEVEL_0 emergency content activation or clearance. Highest authority, broadest scope.

Full specification in INTERVENTION-AND-OVERRIDE-UX-v1.md §5 and INCIDENT-OPERATIONS-UX-v1.md Part 6.

**UX treatment:**
- Fast activation path (3 taps) with pre-populated safe defaults
- Scope selection defaults to minimum viable scope
- Expiry required (pre-populated with 4 hours)
- Confirmation names scope and duration explicitly
- Post-activation: full workspace visual state change (emergency banner)

**Friction level:** Calibrated. Emergency activation must be fast under genuine stress. The friction is scope and expiry selection — these are safety-critical defaults, not bureaucratic steps.

---

### 2.4 Fleet-Wide Interventions

**Definition:** Configuration changes that affect multiple venues simultaneously — network-level overrides, org-level campaign changes, regional configuration updates.

**UX treatment:**
- Mandatory per-venue impact preview (which venues are affected and how)
- Explicit scope confirmation naming the number of venues and screens affected
- Staged rollout option: apply to pilot venues first, then expand
- Rollback plan surfaced: "To reverse this change, [action]"
- Post-commit monitoring: enhanced alerting on affected venues for 24 hours

**Friction level:** High. Fleet-wide changes cannot be undone venue by venue efficiently. The friction is the staged preview and confirmation — necessary because the blast radius is large.

---

### 2.5 Destructive Operations

**Definition:** Operations that permanently remove or irrecoverably modify configuration objects, delivery records, or operator accounts.

**UX treatment:**
- Explicit "this action cannot be undone" warning with explanation of what is lost
- Require operator to type the name of the thing being deleted (prevents accidental confirmation)
- Show what depends on the object being deleted (other rules that reference it, reporting that will be affected)
- 24-hour recovery window where possible (soft delete with pending deletion state)

**Friction level:** Maximum. Destructive operations must never be fast. The cognitive requirement (typing the name) ensures the operator is deliberate, not click-through.

---

### 2.6 Temporary Overrides

**Definition:** Overrides intended to be active for hours or days, not permanently. The most common operational action class.

**UX treatment:**
- Impact preview: which screens affected, which content displaced, sponsor impact
- Duration selection prominent: pre-populated options (today, this weekend, 7 days, custom)
- "No expiry" option requires extra acknowledgment step (not the default)
- Aging indicators begin showing immediately (operator knows from the moment of creation that this is accumulating debt)

**Friction level:** Low-to-moderate. Common enough that excessive friction would drive operators away from using expiry dates at all. But sufficient friction to ensure expiry is always considered.

---

## Part 3 — Consequence Visibility

---

### 3.1 Impact Previews

Every configuration change must offer an impact preview before commitment. Impact previews are not confirmation dialogs — they are operational intelligence.

**Required elements in every impact preview:**

1. **Primary effect:** What the change does to the target (screen, zone, venue)
2. **Scope confirmation:** Exactly which screens are in scope (named, counted)
3. **Displacement:** What currently winning rules will be displaced, and what they were delivering
4. **Sponsor impact:** If any sponsor content is affected, named with SOV impact
5. **Coverage implication:** Are any coverage gaps created? Any mandatory content affected?
6. **Expiry consequence:** What happens when this change expires or ends?

**Impact preview anti-patterns:**
- Generic "this will affect N screens" without naming them
- Impact preview that requires navigation to verify (must be inline)
- Impact preview that only shows immediate effect without downstream effects
- Impact preview that can be skipped entirely without viewing

---

### 3.2 Downstream Visibility

Downstream visibility is consequence visibility extended in time. "What happens next" after a change is committed is as important as "what happens now."

**Downstream scenarios that must be surfaced:**

*Override expires with no successor:*
```
When this override expires on Saturday 23:59:
  Screen B1: Campaign A resumes (✓ this is likely expected)
  Screen B2: No campaign matches this window — fallback will play ⚡
  Screen B3: Campaign B resumes (✓)
```

*Campaign ends with no replacement:*
```
Campaign A ends on 2026-06-30.
After that date:
  12 screens will have no scheduled campaign content
  These screens will fall to fallback content

[Schedule a replacement campaign] [This is acceptable]
```

*Operator with many configurations is deactivated:*
```
Deactivating [OPERATOR_A]'s account will orphan:
  14 active overrides (2 of which are > 90 days old)
  3 campaigns
  7 direct schedules

Before deactivating, consider reviewing these configurations.
[Review configurations] [Proceed with deactivation]
```

---

### 3.3 Sponsor Impact Awareness

Any operation that touches screens with active sponsor contracts must surface the sponsor impact inline — not as a separate reporting step.

**Inline sponsor impact display:**

```
Sponsor impact of this change:
  [SPONSOR_X] (contract: 25% SOV on B1–B4)
    This override on B1–B2 reduces SPONSOR_X's projected SOV to 21%
    ⚠ Below contract threshold (25%)

  [SPONSOR_Y] (contract: 15% SOV on B3–B4)
    No impact — this override does not cover B3–B4 ✓
```

The sponsor impact display must be present in the impact preview for any operator role — not only for Sponsorship Managers. A Floor Operator creating an event-night override must see that it affects sponsor content, even if they do not normally manage sponsorship.

---

### 3.4 Entropy Cost Indicators

Every action that creates or extends operational debt must display an entropy cost indicator:

**Entropy cost scale:**

| Action | Entropy cost | Indicator |
|--------|-------------|----------|
| Creating override with expiry < 7 days | Low | ☁ No significant debt |
| Creating override with expiry 7–30 days | Medium | ⚡ Small debt — remember to review |
| Creating override with expiry > 30 days | High | ⚡ Significant debt — will need cleanup |
| Creating override with no expiry | Very High | ⚠ Permanent debt until manually reviewed |
| Creating 5+ overrides at same time | Very High | ⚠ Override accumulation pattern starting |

The entropy cost indicator is not a barrier — it is an operational cost label, similar to how a financial system shows transaction costs. Operators can proceed; they do so with cost visibility.

---

### 3.5 Operational Blast Radius

"Blast radius" is the term for how many operational things are affected by a change. A single-screen change has a small blast radius. A network-wide change has a large one.

**Blast radius visualization:**

For any multi-screen action, show a visual radius indicator — how many screens, zones, venues are within the action's scope:

```
This override affects:

  ●●●●●●●●●●●●●●●●●●●●   Bar Area (20 screens)
  ●●●●●●●●                Dining Area (8 screens)
  ○○○○○○                  Gaming Area (6 screens) ← NOT affected
  ○○○○                    Outdoor Area (4 screens) ← NOT affected

  Total: 28 screens affected, 10 screens not affected
```

Showing what is NOT affected is as important as showing what IS affected. An operator who believes their override affects only the Bar Area must see that the Dining Area is also in scope — or confirm that it is intentional.

---

## Part 4 — High-Stress Decision Support

---

### 4.1 Panic-Resistant UX

Panic-resistant UX is designed for operators who are in the stress state described in OPERATOR-COGNITIVE-MODELS-v1.md §5.3 (Interruption Panic). The design principles:

**Visible affordances, not hidden ones.** Under panic, operators will use whatever is most visibly available. The correct action must be the most visible one. Wrong content → most visible action should be "Why is this showing?" (diagnostic), not "Create override" (potentially incorrect fix).

**Linear flows, not branching ones.** Under panic, operators make worse decisions at branch points. Critical workflows must have one path, not five. If there are choices (which screens? what expiry?), they must have prominent safe defaults.

**Immediate feedback.** After an action, confirmation must appear in under 3 seconds. An operator under panic who sees no feedback will take another action — creating a double-action problem.

**Undo availability.** The most important panic-resistance feature is knowing you can undo. Every significant action must show its rollback path immediately after execution. This reduces the psychological cost of acting, which reduces hesitation and over-deliberation that also causes problems.

---

### 4.2 Low-Cognitive-Branching Workflows

A workflow has high cognitive branching when the operator must make many independent decisions in sequence, each of which requires evaluating multiple options.

**High branching (bad):**
1. What type of change do you need? (5 options)
2. Which screens? (open-ended selector)
3. What content? (open-ended content picker)
4. What expiry? (open-ended date picker)
5. What scope? (5 scope options)
6. Any additional options? (12 checkboxes)

**Low branching (good):**
1. Start from the affected screen → what do you need to change?
2. What content should play instead? (3 common options + custom)
3. How long? (4 preset durations + custom)
4. Confirm impact preview

The difference is not the number of decisions — both require the same information. The difference is that low branching uses context (which screen, current state) to reduce options, uses preset values for common cases, and concentrates decisions at the point of maximum information (the affected screen).

---

### 4.3 Interruption-Safe Interfaces

Operators are interrupted during CMS tasks — phone calls, staff requests, guest interactions. An interruption-safe interface preserves operator context across interruptions without data loss.

**Interruption safety requirements:**
- All form progress is auto-saved (operator can close and return without losing work)
- When returning to an in-progress form, show a clear state: "You were creating an override. Continue?"
- Uncommitted changes have a visual draft state — clearly distinguished from committed changes
- No action is committed until the operator explicitly confirms — auto-save of draft is not auto-submit

---

### 4.4 Authority Clarity

Under stress, operators need to know instantly: "Do I have the authority to do this, and am I the right person to be doing it?"

**Authority clarity requirements:**
- Any action the operator cannot take due to insufficient authority shows an immediate explanation: "You need Venue Manager access for this. [Contact MANAGER_NAME]"
- Any action that should involve another operator shows an indication: "This action has fleet-wide scope and should involve your Org Admin"
- During an active incident, the incident lead is visible on all active operator views: "Incident lead: [MANAGER_NAME] — coordinate before taking actions"

---

### 4.5 Rollback Awareness

Every significant action must be followed by a rollback path — not buried in settings, but presented immediately and specifically:

```
Override created: [OVERRIDE_NAME]
Active on: 12 screens
Expires: Saturday 23:59

If you need to reverse this:
  [Remove this override immediately] ← one tap to undo
```

The rollback path is the psychological safety net that enables operators to take decisive action under stress without fear of creating irreversible harm. An operator who knows they can undo an action within one tap will act more decisively, with less over-deliberation.

---

## Part 5 — Dangerous Ergonomic Failures

---

### EF-01: Confirmation Blindness

**Failure:** Confirmation dialogs are so routine that operators click through them without reading. The confirmation is technically present but cognitively absent.

**Origin:** Confirmation dialogs that fire too frequently, are worded generically, or do not vary based on action severity. When every action has a "Are you sure?" dialog, operators habituate and click through all of them — including the ones that matter.

**Prevention:**
- Confirmation dialogs must be proportional to action severity (low-risk actions have no confirmation; high-risk actions have specific, named confirmations)
- Confirmation text must vary based on actual content of the action, not generic boilerplate
- High-risk confirmations require active engagement (typing a name, selecting a checkbox) not passive acceptance (OK button)
- Rate limit confirmations: if the operator has seen the same confirmation type 5 times in one session, they are habituated to it — it is no longer providing cognitive protection

---

### EF-02: Click-Through Fatigue

**Failure:** Multi-step workflows have so many steps that operators develop a rhythm of clicking "Next" → "Next" → "Confirm" without reading individual steps.

**Origin:** Workflows that protect against rare risks by adding steps that are irrelevant to common operations. An operator who must confirm impact for every change, even routine low-risk ones, will eventually stop reading the impact and just click.

**Prevention:**
- Reserve multi-step confirmation flows for genuinely consequential actions
- Low-risk operations: single-step (save)
- Medium-risk operations: impact preview + confirm (two steps)
- High-risk operations: impact preview + explicit acknowledgment + confirm (three steps)
- Never add steps "for safety" that don't contain operationally distinct information

---

### EF-03: Hidden Side Effects

**Failure:** An action has side effects that are not visible in the primary workflow. The operator takes an action targeting X and unknowingly affects Y.

**Origin:** Feature interactions that were not designed with consequence visibility in mind. A campaign scope modification that changes which screens are covered — but the scope change view only shows the new scope, not which screens were removed.

**Prevention:** Every action with side effects must show those effects in the impact preview, even if they are secondary. "Changing Campaign A's scope removes coverage from screen B3, which will fall to fallback content during Campaign A's scheduled windows."

---

### EF-04: Irreversible Ambiguity

**Failure:** An action that is irreversible (or very difficult to reverse) does not clearly communicate its irreversibility at the decision point.

**Examples:**
- Deleting a configuration object with a simple "Delete" button that looks identical to a reversible "Remove from view" button
- An override with no expiry that is created through the same workflow as a temporary override, with the only distinction being an unchecked "no expiry" checkbox

**Prevention:** Irreversible actions must be visually distinct from reversible ones — different color, different icon, different label, and explicit irreversibility statement at the confirmation step.

---

### EF-05: Operational Overconfidence

**Failure:** The UX presents operational state with more certainty than is warranted, causing operators to make decisions based on overconfident assumptions.

**Examples:**
- Showing confidence score as a simple "active" indicator without quantification
- Showing "Schedule set" without indicating whether the schedule is currently winning or suppressed
- Showing "Campaign active on 5 screens" without showing that 3 of those screens have active overrides that are suppressing the campaign

**Prevention:** Confidence calibration is a first-class design concern. Every status indicator must represent the actual certainty level — not a simplified "active/inactive" binary when the reality is "active but not winning on 3 screens."

---

## Part 6 — Temporal Decision Ergonomics

---

### 6.1 Delayed Consequence Awareness

Many operational decisions have consequences that materialize later in time, not immediately. An override created today affects screens for the next 30 days. A campaign scheduled without a coverage review will produce gaps in 3 weeks when another campaign expires.

**Temporal consequence surfaces:**

When an operator makes a change, the preview must extend into the future to show delayed consequences:

```
Impact of Override_007 (today through Saturday):

  Today → Saturday:
    B1: Override_007 active (Campaign A suppressed)
    B2: Override_007 active (Campaign A suppressed)

  After Saturday (when override expires):
    B1: Campaign A resumes ✓
    B2: No content scheduled for Saturday night through Sunday ⚡
        → Fallback content will play

  Action: Schedule Campaign A extension for Saturday evening
  [Schedule now] [Accept fallback for that window]
```

The Saturday-evening gap is a delayed consequence of the current decision. Without temporal consequence visibility, the operator creates the override today and discovers the gap on Saturday.

---

### 6.2 Future-State Visibility

Operators making changes that take effect in the future must see what the future state will be — not just that the change is scheduled, but that the change produces the intended outcome given all other rules that will be active at that time.

**Future-state verification requirement:**

Before any future-dated change is committed, the preview must call the PRE for the target time and show the result. "This campaign will be active from Saturday" is not enough — "This campaign will win on screens B1–B4 from Saturday, because the current Override_004 expires Friday night" is the required standard.

---

### 6.3 Cumulative Operational Debt Awareness

Individual decisions accumulate into organizational patterns. An operator who creates one no-expiry override is managing a single debt item. An operator who has created 14 no-expiry overrides over 3 months is managing an entropy pattern.

**Cumulative debt display:**

In the override creation flow, show the operator's running total:

```
Override creation

  Your active overrides: 14
  Your overrides with no expiry: 6  ⚡
  Your overrides over 30 days old: 4  ⚡

  Adding this override: 1 additional override with no expiry

  [Review your existing overrides before adding more?]
  [Continue creating]
```

This display makes the cumulative pattern visible at the moment of decision — not as a separate governance report, but in the workflow where new debt is being added. The operator can see their own operational pattern in context.

---

*End of DECISION-ERGONOMICS-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Impact preview API: Agent 1 (Platform) requirement (PRE simulation endpoint)*
*Action authority model: Agent 2 (CMS) design responsibility*
