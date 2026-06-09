# ClubHub TV — Preview Systems Specification v1
# Shared Operational Intelligence Layer

**Document type:** Operational UX specification — preview subsystem
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Reviewed against:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md, AGENT-3-UX-BOOTSTRAP.md
**Last updated:** 2026-05-22
**Status:** SPECIFICATION — governs all preview system design and implementation

---

## 0. Document Scope

This specification defines the ClubHub TV preview system: its philosophy, operational modes, explainability requirements, confidence modeling, UX safety rules, and vertical-specific adaptations.

The preview system is not a product feature. It is operational safety infrastructure that closes the most dangerous gap in the operator-system relationship: the gap between "what I configured" and "what is actually resolving." Every design decision in this specification is made to close that gap, not to create a pleasant visual experience.

---

## Part 1 — Preview Philosophy

### 1.1 Preview as Entropy Reduction Infrastructure

Entropy accumulates when operators cannot verify the outcomes of their configuration decisions without experimentation. When verification requires physically walking to a screen, operators stop verifying. Unverified configurations accumulate errors. Errors accumulate into drift. Drift becomes entropy.

The preview system is the mechanism that makes verification trivially easy at the exact moment of configuration. It eliminates the cost of verification. When the cost is zero, operators verify. When operators verify, errors are caught before they accumulate. When errors are caught early, entropy does not accumulate.

This is not a convenience argument. It is an operational risk argument.

**The causal chain:**
```
Verification is expensive → operators skip verification
→ errors not caught at origin
→ errors compound over time
→ entropy accumulates
→ screens show wrong content
→ operators discover via complaints
→ operators make emergency corrections
→ corrections create new errors
→ entropy compounds
```

**The preview chain:**
```
Verification is instant → operators verify routinely
→ errors caught at origin
→ no compounding
→ entropy does not accumulate
→ screens show intended content
→ operators trust the system
→ system is used correctly
```

### 1.2 Preview as Anti-Workaround Infrastructure

The three most destructive operator behaviors — emergency misuse, permanent overrides, and shadow scheduling — all originate from the same root: **the operator cannot confidently predict what will happen without trying it.**

When an operator creates a campaign and cannot know whether it will reach all targeted screens without physically checking, they:
- Create higher-priority schedules "just to be sure" (shadow scheduling)
- Create overrides on the screens they care most about (override addiction)
- Use emergency for guaranteed delivery (semantic collapse)

Each of these workarounds is locally rational. The system offers no better path.

Preview provides the better path: before taking any action, the operator can see exactly what will resolve. The need for workarounds disappears when the outcome is knowable in advance.

**Preview is not a substitute for understanding.** An operator who doesn't understand the resolution model but can use preview to verify outcomes will be more effective than an operator with deep model knowledge but no preview. However, preview also *builds* model understanding through repeated direct observation (OBS-020 in REAL-WORLD-OBSERVATIONS.md). Over time, operators who use preview develop accurate mental models. Preview is both a safety net and a teaching mechanism.

### 1.3 Preview as Cognitive Stabilization

Operational stress is reduced by predictive certainty. An operator who knows with certainty what will happen before taking an action operates with lower cognitive load, makes fewer errors, and requires fewer compensating behaviors.

The psychological mechanism is predictive reassurance: the confidence that comes from seeing the future state before committing to it. In aviation, this is the pre-flight check. In broadcast operations, it is the pre-air rundown review. In ClubHub TV, it is the pre-publish preview.

Without predictive reassurance, operators operate in a state of perpetual uncertainty about their system's actual state. This uncertainty manifests as:
- Over-engineering (adding more rules "just in case")
- Micro-management (physically checking screens after every change)
- Escalation shortcuts (emergency, maximum priority overrides)
- System distrust (believing the system is broken when it is working correctly)

Preview provides the cognitive stability that allows operators to work confidently within the system's designed boundaries.

### 1.4 Preview vs Experimentation

The absence of preview forces operators into an experimental mode: make a change, observe the outcome, adjust, repeat. This is not a healthy operational model. It is slow, creates orphaned intermediate configurations, and builds operator knowledge through trial and error rather than through understanding.

**The experimentation failure modes:**
- Intermediate configurations persist after the experiment (orphaned schedules, stale overrides)
- Operators learn "what works" without learning "why it works"
- The system state after a sequence of experiments may be far from what any operator intended
- Experiments conducted under time pressure produce particularly degraded configurations

**Preview prevents experimentation by making outcomes knowable before action.** An operator who can preview the resolution for any screen at any time never needs to "try it and see." They see it before they try it.

---

## Part 2 — Core Preview Modes

### 2.1 Mode Taxonomy

The preview system provides eight operational modes, each serving a distinct cognitive need:

```
MODE 1:  Screen Timeline Preview        — what will this screen show over time?
MODE 2:  Future Playback Simulation     — what will this screen show at a specific moment?
MODE 3:  Sponsor Visibility Forecasting — when and how often will sponsor content appear?
MODE 4:  Override Impact Simulation     — what will happen if I create this override?
MODE 5:  Emergency-Mode Simulation      — what will all affected screens show if I activate emergency?
MODE 6:  Venue-State Simulation         — what is every screen in this area/venue showing right now?
MODE 7:  Interruption Forecasting       — what upcoming rule transitions will change screen content?
MODE 8:  Low-Confidence Prediction Zone — which future time windows are difficult to predict?
```

All modes call the actual PRE function on real database state. No client-side approximation. No simulation that diverges from the replay-verified implementation.

### 2.2 Mode 1: Screen Timeline Preview

**Operational purpose:** Give operators a temporal view of what a single screen will show across a defined time range, showing all scheduled content, override windows, and transition points.

**What it shows:**
- A horizontal timeline for a screen across a user-specified time range (default: next 24 hours; range: up to 7 days)
- Each time segment colored by resolution level (LEVEL_0 emergency / LEVEL_1-2 override / LEVEL_3 campaign / LEVEL_5 fallback)
- At each segment: content name, duration, source rule
- Transition markers: exact times when the resolved content changes
- Override windows visually distinct from scheduled content windows
- Sponsorship injection shown as an overlay on the timeline (sponsor content frequency within each segment)

**Triggering contexts:**
- From screen detail view: "What will this screen show today?"
- From campaign view: "Show me this screen's timeline with my new campaign"
- From override creation: "Show me this screen's timeline if I apply this override"

**UX behavior:**
- Default to the next 24 hours from current venue local time
- Time axis labeled in venue local timezone (with explicit timezone indicator)
- Clicking any timeline segment opens Mode 2 (precise resolution at that moment)
- Segments shorter than a minimum visible width show a summary tooltip on hover

**Confidence treatment:**
- Time windows within the next 15 seconds: label "Resolution in progress"
- Time windows where conflicting rules exist: amber highlighting with "Resolution may vary" indicator
- Time windows more than 7 days out: show as HYPOTHETICAL with a reduced opacity and a note "Prediction confidence decreases beyond 7 days"

### 2.3 Mode 2: Future Playback Simulation

**Operational purpose:** Show exactly what the PRE will resolve for a specific screen at a specific moment in time, including the complete resolution trace.

**What it shows:**
- The resolved playlist: ordered content items, durations, weights
- The resolution level that produced this output (LEVEL_0 through LEVEL_5)
- The specific rule that won at each level, with rule identity (name, creator, creation date, scope)
- All rules that were evaluated and did NOT win, with the reason each was skipped
- Confidence score at the simulated time
- Whether this is a fallback result (is_fallback: true)

**Triggering contexts:**
- From the timeline view (clicking a segment)
- From the campaign publish confirmation ("Preview this screen at [campaign start time]")
- From the schedule creation confirmation ("Preview this screen after this schedule is active")
- From the "What will this show at [time]?" link in screen detail

**Time selection:**
- Date + time picker, pre-populated with current time
- Timezone: always venue local time, always displayed explicitly
- Quick options: "Right now," "In 1 hour," "Tomorrow at [same time]," "[Campaign start time]"

**Resolution trace display:**
- LEVEL_0: "Emergency: [content name] — [emergency scope]" or "No emergency active"
- LEVEL_1: "Operational override: [content name] — created by [operator] on [date], [expires/permanent]" or "No operational override"
- LEVEL_2: "Scheduled override: [content name] — [time window]" or "No scheduled override"
- LEVEL_3: "Campaign/Schedule: [content name] — [campaign name], targeting [scope], priority [N]" or "No active schedule"
- LEVEL_4: "Sponsorship injection: [sponsor content] — [SOV%] SOV" or "No active sponsorship"
- LEVEL_5: "System fallback — no schedulable content found"
- LEVEL_6: "Device truth annotation applied"

The winning level is highlighted. Losing levels show their content in muted treatment with the reason they lost: "Evaluated — no match found," "Evaluated — superseded by Level [N] rule."

### 2.4 Mode 3: Sponsor Visibility Forecasting

**Operational purpose:** Show how sponsor content will appear across a defined time range, allowing sponsorship managers to verify SOV delivery before and after contract changes.

**What it shows:**
- Per-sponsor: frequency of appearance across the forecast window (expressed as percentage of resolved screen time)
- Combined SOV across all active contracts
- Editorial content percentage (derived: 100% minus combined sponsor SOV)
- For each active sponsorship contract: contracted SOV vs forecast actual SOV (may differ if other content resolution affects the base playlist)
- Time windows where sponsor content will and will not appear (based on contract time windows)

**Triggering contexts:**
- From sponsorship contract creation confirmation: "Forecast impact before saving"
- From sponsorship health view: "Forecast sponsor visibility for this venue over next 30 days"
- From campaign publish: "How will this campaign interact with active sponsorship contracts?"

**The SOV projection model:**
Sponsor visibility in preview is computed by running PRE simulation across a sample of time points in the forecast window and observing what fraction of outcomes include each sponsor's content. This is deterministic (the PRE is deterministic) but may be approximate for large time ranges due to computational cost — approximation methodology must be documented and the approximation level must be surfaced in the UI ("Based on [N] sample points across the forecast window").

**Critical UX requirement:**
When total combined SOV exceeds 80%, the forecasting view must prominently display:
- "Total contracted SOV: [X]%"
- "Forecast editorial content: [Y]% of screen time"
- If Y < 20%: amber warning. If Y < 10%: orange. If Y ≈ 0%: red, with "Sponsor content will effectively crowd out editorial content."

### 2.5 Mode 4: Override Impact Simulation

**Operational purpose:** Before creating an override, show the operator exactly what will change on the affected screens, including which currently-resolving content will be displaced.

**What it shows:**
- For each screen in the override scope:
  - Current resolution: what is resolving now and under what rule
  - Proposed resolution after override: what will resolve
  - Delta: what the override will replace (displacing content labeled "Will stop showing")
- Any screens in the scope that are already under a higher-priority override (the new override will have no effect on these screens)
- Coverage: "[N] of [M] screens in [scope] will be affected by this override. [K] screens are under higher-priority rules and will not be affected."

**Triggering context:**
- Mandatory display in override creation workflow, before the final confirmation step
- This is not optional — the impact simulation is part of the override creation flow, not a separate check

**The "screens not affected" requirement:**
If any screens in the override scope are under a higher-level rule that will supersede the new override, those screens must be explicitly listed: "These [K] screens will NOT receive this override: [screen list] — each is under an active [emergency/operational override] that takes precedence."

This directly addresses the Failure Story 7 scenario ("The Preview That Lied") — an operator creating an override targeting "Bar Area" must see which bar screens are already locked by a higher rule.

### 2.6 Mode 5: Emergency-Mode Simulation

**Operational purpose:** Before activating emergency, show the operator exactly which screens will be affected and what they will show, making the blast radius explicit.

**What it shows:**
- Complete list of screens in the emergency scope: "[All 28 screens at Venue Name]"
- Current resolution for each screen (what will be replaced)
- Emergency content that will show on all screens
- Duration estimate: "Emergency will remain active until manually deactivated"

**UX safety requirements for emergency simulation:**
- Emergency scope must be stated in large, prominent text before any simulation begins: "This simulation shows the effect of activating venue-wide emergency at [Venue Name]."
- The simulation must be visually distinct from all other preview modes — a red/amber framing that communicates the severity of the action being previewed
- The simulation must show the reason field input box BEFORE the preview renders — the reason for the emergency must be formed in the operator's mind before they see the impact

**Critical design note:**
The emergency simulation is the only preview mode where the preview itself serves as a friction element. By making the operator see and confirm the full impact before activation, the simulation creates the "emergency frequency count" display (P-EU-01) and the "not a safety emergency? use operational override instead" alternative offer (P-EU-02) in context.

### 2.7 Mode 6: Venue-State Simulation

**Operational purpose:** Show the current resolution state of every screen in a venue or area simultaneously, in a single view.

**What it shows:**
- A spatial or list representation of all screens in the area/venue
- Each screen: current resolution level, content name, resolution source
- Visual grouping by area and tv_group
- Status indicators:
  - GREEN: Screen receiving area campaign as expected
  - AMBER: Screen under operational override (not receiving area campaign)
  - BLUE: Screen under scheduled override
  - RED: Screen showing system fallback
  - DARK RED: Screen in emergency state
  - GREY: Screen has not confirmed delivery in last [threshold] minutes

**The "What is my venue showing right now?" workflow:**
This is the primary use case for the org admin and venue manager roles. The venue-state simulation answers the question "are my screens showing what I think they're showing?" with a single view.

**Design requirement:**
The venue-state simulation must be accessible from the primary CMS navigation — it is a monitoring surface, not an advanced tool. It should be the default landing view for venue managers.

### 2.8 Mode 7: Interruption Forecasting

**Operational purpose:** Show all upcoming rule transitions on a screen — moments when the resolved content will change — in chronological order.

**What it shows:**
- For a given screen over a specified time range: all transition points where the resolved content will change
- At each transition: what was resolving before, what will resolve after, which rule caused the transition
- Override expiry transitions: "Override expires at [time] — resolution will revert to [campaign]"
- Schedule window opens/closes: "Schedule window opens at [time] — [content] will begin resolving"
- Campaign start/end dates: "Campaign [name] starts at [time]"
- Sponsorship contract transitions: "Sponsor [name] contract ends at [time] — SOV will drop from [X]% to [Y]%"

**Value for operators:**
Interruption forecasting answers the common operator question: "Is there anything I need to worry about between now and end of this week?" It surfaces the schedule's future state without requiring operators to mentally track multiple overlapping rules.

**Triggering contexts:**
- From screen detail: "What changes are coming for this screen?"
- From campaign planning: "Are there any conflicting rule changes in the next 7 days?"
- From the end-of-shift review workflow: "What will change after I leave?"

### 2.9 Mode 8: Low-Confidence Prediction Zones

**Operational purpose:** Identify time windows where the preview system's predictions are less reliable, and explain why.

**What this signals:**
Not all future states are equally predictable. Some time windows have characteristics that make the preview's prediction less certain:

- **High-entropy windows:** The screen has many active rules at similar priority/specificity. Small state changes could flip the resolution outcome. Label: "Multiple competing rules — resolution may shift"
- **Override-approaching-expiry windows:** A permanent override will expire soon, returning to an underlying rule that may have drifted since the override was created. Label: "Override expires — underlying resolution may surprise"
- **Sponsorship-contract-end windows:** A sponsorship contract is nearing its end. SOV will shift abruptly. Label: "Sponsor contract ending — content mix will change"
- **Far-future windows:** Predictions more than 7 days out have lower confidence because rules may be added, modified, or expired before then. Label: "Long-range prediction — subject to configuration changes"
- **Historically unreliable windows:** If delivery logs show that this screen frequently shows unexpected content during this time period (e.g., it's a sports bar screen that gets HDMI-switched during Saturday games), label: "Screen historically switches to non-ClubHub input during this window" [HYPOTHETICAL — requires screen metadata `shares_display_input`]

**How low-confidence zones are displayed:**
In the timeline view, low-confidence zones are shown with a hatching pattern or reduced opacity within the timeline segment. A tooltip on hover explains the specific reason for reduced confidence. The operator is not alarmed — they are informed.

---

## Part 3 — Preview Explainability

### 3.1 The Preview Must Explain Itself

A preview that shows "content X will play" without explaining why is operationally incomplete. The operator who cannot understand why a prediction is what it is cannot learn from the prediction, cannot identify the rules that produced it, and cannot make confident configuration decisions based on it.

**Every preview result must answer four questions:**
1. What will happen? (the resolution output)
2. Why will it happen? (the winning rule and why it won)
3. Why won't [something else] happen? (the losing candidates and why they lost)
4. How confident is this prediction? (the confidence classification)

### 3.2 Suppression Explanation Requirements

When an operator's expected content is not appearing in the preview, the preview must surface **why not** more prominently than **what is**. The "why not" answer is the operationally valuable one — it gives the operator the specific leverage point to change.

**Suppression explanation format:**
```
WHAT IS SHOWING: [Content Name]
WHY: [Rule name] at [Level N] — [plain language description]

WHY YOUR [CAMPAIGN / SCHEDULE] IS NOT SHOWING:
→ [Your campaign] targets [scope] at Level 3.
→ [Override name] created by [operator] on [date] is active at Level 1.
→ Level 1 rules are evaluated before Level 3 rules.
→ [Your campaign] cannot show while this override is active.
→ [View this override] [Deactivate this override]
```

The suppression explanation must:
- Name the specific rule that is suppressing the expected content
- State the level relationship in plain language ("Level 1 rules are evaluated before Level 3 rules")
- Identify the rule's creator and age (if provenance is available)
- Provide a direct action link to the suppressing rule

### 3.3 Precedence Expectations

When multiple rules at the same level are active, the preview must explain which one wins and why:

```
MULTIPLE LEVEL 3 RULES ACTIVE:
→ [Campaign A] — priority 45, targeting Bar Area (SPEC_3)
→ [Campaign B] — priority 72, targeting Venue (SPEC_2)
→ [Campaign A] wins because it has higher specificity (screen-specific targeting
   beats venue-wide targeting at the same resolution level).
→ Priority comparison is not applicable when specificity differs.
```

### 3.4 Conflict Probability Signaling

When multiple rules are near-competing — similar priority levels at the same specificity, overlapping time windows, similar scope — the preview should note: "This outcome depends on fine distinctions in the current configuration. Minor configuration changes could change this result."

This is not an error condition. It is an honesty signal that tells the operator: "your configuration has made this resolution sensitive to small changes."

---

## Part 4 — Confidence Modeling

### 4.1 Prediction Confidence Classification

Preview predictions are classified into four confidence zones:

**STABLE:**
The predicted resolution is robust — it would require a significant configuration change to alter. The winning rule has a clear advantage at a high level (e.g., LEVEL_0 emergency active, or LEVEL_1 override with no competing LEVEL_1 rules).

Indicator: No special marking. Clean, confident presentation.

**CONDITIONAL:**
The predicted resolution is correct given current state but could change if a specific condition changes. The operator should know about the condition.

Examples: "Prediction assumes override [X] remains active," "Prediction assumes no emergency is activated."

Indicator: A brief note listing the conditions this prediction depends on.

**UNCERTAIN:**
Multiple rules at similar priority and specificity are active. The resolution is correct for the current state but is sensitive to small configuration changes. Consider reviewing the configuration.

Indicator: Amber border on the prediction panel. "Multiple competing rules — resolution may shift if configuration changes."

**LOW CONFIDENCE:**
The prediction is technically correct but the time window has characteristics that historically produce unexpected outcomes (HDMI switching, high override churn, compliance screen with known maintenance gaps).

Indicator: Hatched timeline segment. Hover explanation.

### 4.2 Stable Prediction Zones

A screen is in a stable prediction zone when:
- It has exactly one active rule with clear winning conditions (no near-competitors)
- The winning rule has no near-expiry that would shift the resolution
- No sponsorship contracts are near their contract boundaries in this window
- The screen has a high confidence score (recent delivery confirmation)

### 4.3 Unstable Operational Periods

Certain operational periods produce systematically less reliable predictions:

**Event transition windows:** The 30 minutes before and after a major event (sports final, live entertainment, function room event). Operators are most likely to make rapid configuration changes during these windows. Preview at event transition time should note: "High-change period — configuration may change rapidly."

**Campaign publish windows:** Immediately after a major campaign publish, multiple screens transition to new content. In the first 2 minutes after publish, delivery logs haven't confirmed receipt yet. Preview during this window should note: "Recent campaign change — screens updating within 15 seconds."

**Override expiry clusters:** Venues often create overrides with similar durations (e.g., "for this weekend"). When many overrides expire simultaneously, the underlying resolution may resurface content that hasn't been active for weeks. Label: "Multiple overrides expiring in this window — underlying resolution resurfaces."

### 4.4 High-Interruption Environments

Sports bars, licensed clubs during event nights, and function rooms during conferences are high-interruption environments where configuration changes happen rapidly during live operations. Preview in these environments should be labeled: "Live operational environment — configuration may change rapidly. Preview reflects current state."

---

## Part 5 — Human Factors

### 5.1 Why Operators Need Predictive Reassurance

Operators who cannot predict system outcomes operate under chronic low-level anxiety about the system's state. This anxiety manifests as:

**Checking behavior:** Repeated physical screen checks after every configuration change. This is expensive, unreliable, and scales poorly as venue size increases.

**Over-engineering:** Creating more rules than necessary to ensure the desired outcome. "I'll add this schedule at priority 500 just to be absolutely sure." Each over-engineered rule creates more configuration complexity, which creates more unpredictability, which creates more anxiety, which creates more over-engineering. This is the priority inflation cycle.

**Escalation dependency:** Using the highest-priority tool available (emergency, LEVEL_1 override) for routine changes because these tools provide certainty. The operator knows emergency will work. They don't know if a campaign will work. Certainty is worth the operational cost.

Preview eliminates all three of these behaviors by providing certainty through a zero-cost verification mechanism.

### 5.2 Why Hidden Uncertainty Creates Overrides

When an operator creates a campaign but cannot verify that it will reach all targeted screens, they manage the uncertainty through pre-emptive control: creating per-screen overrides on the screens they care most about. The override provides certainty that the campaign cannot.

This is rational. The override works. The campaign may or may not work, depending on what other rules exist. The operator chooses the reliable mechanism over the uncertain one.

The long-term cost is the override accumulation that eventually blocks all campaign updates. But this cost is in the future and invisible. The certainty provided by the override is immediate and visible.

**Preview provides certainty before the override is needed.** An operator who can preview the campaign coverage map — seeing which screens will receive the campaign and which are already under override — no longer needs to create protective overrides on important screens. The campaign coverage is knowable, and knowing it removes the rational motivation for protective overrides.

### 5.3 Why Delayed Feedback Creates Folklore

When operators cannot verify outcomes immediately, they develop folk explanations for observed system behavior. These explanations are locally consistent with what they observe but systematically inaccurate about the actual cause.

**Common folklore examples:**
- "You have to set priority really high or the content won't show" — false (priority only operates within Level 3 at the same specificity), but consistent with observed behavior (high-priority content appears reliably because it wins Level 3 competition)
- "The emergency button is the only way to guarantee all screens update at once" — false (any venue-level rule change will propagate to all screens within one poll cycle), but consistent with observed behavior (emergency is the fastest verified delivery mechanism)
- "Old content never fully goes away — it always sneaks back in" — false (the PRE only evaluates active rules), but consistent with observed behavior (stale overrides from months ago resurface content that was supposed to be gone)

Folklore persists because it is internally consistent. When an operator's mental model produces correct predictions — even if the model is wrong for the right reasons — the model is reinforced.

Preview extinguishes folklore by making the actual mechanism visible. An operator who can see "this content is showing because of this Level 1 override from 6 months ago" does not need a folk explanation. The actual explanation is right there.

---

## Part 6 — UX Safety Rules

These rules govern the preview system's behavior and may not be violated by any implementation.

### S-01: Preview Must Not Diverge From Replay Semantics

**Rule:** The preview system calls the actual PRE function. It does not simulate PRE behavior with a client-side approximation. Any deviation between preview and actual resolution is a system defect.

**Enforcement:** The preview endpoint is the same code path as the production manifest endpoint, called with a (screen_id, t) pair. The preview output is a full PRE_Output object, not a derived representation.

**Consequence of violation:** Operators who discover that "preview showed X but screen showed Y" lose trust in the preview system and revert to physical verification. The entire value of the preview system collapses.

### S-02: Preview Cannot Invent Undocumented Assumptions

**Rule:** The preview must only reflect system state as it exists in the database at the time of the preview call. It must not incorporate assumptions about future configuration changes, inferred operator intentions, or heuristic predictions.

**Examples of prohibited behavior:**
- "The preview assumes you will also publish the campaign you have in draft" — the campaign in draft is not in the database; the preview must not assume it is
- "The preview interpolates between the current state and the expected state after your pending changes" — there are no "pending changes" in the PRE's model; only committed database state

### S-03: Preview Uncertainty Must Be Visible

**Rule:** Any time the preview result is based on conditions that may change (expiring rules, near-competing rules, high-entropy configurations), the uncertainty must be visually surfaced. The operator must not receive a confident-appearing preview for a prediction that is actually uncertain.

**The failure mode this prevents:** An operator who receives a confident-appearing prediction trusts it fully. When the prediction is wrong (because a competing rule they didn't know about fires first), the failure is doubly damaging — the prediction failed AND the operator had no warning it might fail.

### S-04: Preview Cannot Hide Operational Conflicts

**Rule:** If any screen in a preview scope is under a rule that will suppress the expected outcome, that screen must be explicitly shown as "not receiving this content" with the suppressing rule named. It is not acceptable to show "12 screens will show this content" when the actual number is 8.

**The failure mode this prevents:** The "Campaign That Wasn't Showing" failure (FAILURE-STORIES.md Story 1). The marketing coordinator who sees "campaign: active" without seeing "5 of 8 screens are under overrides" believes delivery is complete.

### S-05: Preview Must Display Venue-Local Time

**Rule:** All timestamps in the preview system are displayed in venue local time, with the IANA timezone name explicitly shown. UTC timestamps are not shown to operators. Historical UTC timestamps may be shown in diagnostic views with explicit UTC labeling.

**Rationale:** INV-9 (Timezone Isolation) governs that all time computations use venue.timezone. The preview UI must reflect this — an operator who sets a preview time of "12:00" must know whether that means noon in their timezone or noon in the venue's timezone.

### S-06: Preview Must Surface Confidence Classification

**Rule:** Every preview result must display its confidence classification (STABLE, CONDITIONAL, UNCERTAIN, LOW CONFIDENCE) with a brief explanation. An unclassified preview result is non-conformant.

---

## Part 7 — Vertical-Specific Preview Needs

Different venue types have fundamentally different preview requirements based on their operational urgency profile, entropy pattern, and operator behavior.

### 7.1 Licensed Clubs

**Primary preview need:** Override visibility before campaign launch.

Licensed clubs have the highest override accumulation rate of any vertical. A venue manager publishing a campaign without knowing that 35% of screens are under legacy overrides is the most common ClubHub TV failure in this vertical.

**Mandatory preview behavior for licensed clubs:**
- Campaign publish must always show override coverage map before confirmation
- Override coverage map must prominently display the count: "X of Y screens in [Area] are under active overrides and will not receive this campaign"
- One-click path from "screens under override" to the override management view, with each override's age prominently displayed

**Gaming area preview requirements:**
- Screens marked `is_compliance_screen: true` must show a compliance indicator in all preview modes
- Any preview that shows a compliance screen receiving non-compliance content during mandated compliance windows must surface an advisory: "Compliance schedule may be displaced"

### 7.2 Golf Clubs

**Primary preview need:** Temporal accuracy for tournament operations.

Golf clubs operate in two modes: weekly-cadence management (low urgency) and tournament day (high urgency, real-time). Preview serves different purposes in each mode.

**Off-season / routine management:** The interruption forecast (Mode 7) is the most valuable preview mode — it helps operators see what content changes are coming for the next week without requiring daily CMS attention.

**Tournament day:** The venue-state simulation (Mode 6) is critical — the operator needs to see all screens simultaneously to confirm that tournament content is reaching the right screens and that override states are correct before the first tee.

**Specific requirement:** Tournament day preview must show whether any screen that should be showing tournament content is still showing pre-tournament content (i.e., the tournament override hasn't been applied to that screen). A "not yet updated" indicator for screens that should be in tournament mode but aren't is essential.

### 7.3 Hotels

**Primary preview need:** Freshness and accuracy for menu boards and lobby information.

Hotels have low operational urgency but high content accuracy requirements (menu boards in particular). The preview's primary value here is not operational urgency but content accuracy verification.

**Hotel-specific preview:** Content item age is displayed in the preview timeline — when a content item is more than 90 days old, it should be flagged inline: "[Content Name] — 127 days old, consider reviewing for accuracy."

**Daypart transitions:** Hotel operations are daypart-structured (breakfast/lunch/dinner). The interruption forecast (Mode 7) should default to showing the next 24 hours with daypart boundaries marked, so the hotel operator can confirm that each daypart's content is correctly configured before the day begins.

**Multilingual note:** Where multilingual content is managed through multiple separate content items (the current workaround for absent native multilingual support), the preview should show the full sequence including language transitions so the operator can verify that all languages are correctly scheduled.

### 7.4 Sports Venues

**Primary preview need:** Speed and certainty under extreme time pressure.

Sports bars are the highest-urgency environment. Preview must work within the operator's 90-second attention window during an event.

**Sports venue preview constraints:**
- The primary preview for a shift manager during an event: "What is this screen showing right now?" — a single-screen instant resolution display, accessible in under 2 taps
- Coverage map must be accessible from the home screen, not buried in campaign management
- Preview results must be scannable at a glance — a shift manager cannot read a full resolution trace during a busy Saturday night

**HDMI switch awareness (UXH-019 relevant):**
Sports venue screens that are frequently switched to TV input will show degraded confidence scores. The preview system must distinguish "screen is under ClubHub control but not delivering" from "screen is expected to be on TV input right now." The former is an alert; the latter is expected.

**Half-time workflow integration:**
The interruption forecast (Mode 7) configured to show "what changes at half-time" is a specific use case for sports bars: the operator can preview exactly what content will appear when the half-time override fires, before the game reaches half-time. This is the pre-flight check for a half-time promotional push.

### 7.5 Resorts

**Primary preview need:** Zone coverage visibility across a large, multi-zone property.

Resorts have the most complex multi-zone configuration of any vertical, with zone managers operating independently. The venue-state simulation (Mode 6) is critical for the resort general manager to see the current state of all zones at once.

**Resort-specific requirement:** The venue-state simulation must support grouping by zone manager authority — "What is Pool Bar zone showing?" / "What is Restaurant zone showing?" — so that zone managers can verify their own zones without seeing all zones simultaneously.

**Zone collision detection:**
When an org-level campaign is published, the preview must show which zone managers have per-zone rules that will supersede the org-level campaign. The resort GM publishing a "flash sale" campaign needs to see: "Zone overrides will prevent this campaign from reaching [X] screens in [Pool Bar] zone."

### 7.6 Conference Environments

**Primary preview need:** Per-room verification before client session.

Conference environments require same-day, per-room content changes. The conference coordinator needs to verify that each room's screen is showing the correct content for the upcoming session before the client arrives.

**Conference-specific preview workflow:**
"Room readiness check" — a simplified view of all conference room screens showing: current content, expected content for the next session, match status (content matches expected / content does not match). This is a checklist, not a detailed resolution trace.

**Between-session transition verification:**
The interruption forecast (Mode 7) shows exactly when the current session's content will transition to the next session's content for each room. The coordinator can verify that the transition will happen automatically and at the correct time.

---

## Appendix A — Preview System Access Matrix

| Preview Mode | Shift Manager | Venue Manager | Org Admin | Marketing Manager |
|---|---|---|---|---|
| Screen Timeline (Mode 1) | Read | Full | Full | Read |
| Future Playback (Mode 2) | Read | Full | Full | Read |
| Sponsor Forecasting (Mode 3) | — | Read | Full | Full |
| Override Impact (Mode 4) | Mandatory at creation | Mandatory at creation | Mandatory at creation | — |
| Emergency Simulation (Mode 5) | Mandatory at activation | Mandatory at activation | Mandatory at activation | — |
| Venue State (Mode 6) | Current venue | Current venue | All venues | Read |
| Interruption Forecast (Mode 7) | 4-hour window | Full range | Full range | Full range |
| Low-Confidence Zones (Mode 8) | Indicators only | Full | Full | Read |

---

## Appendix B — Preview Implementation Requirements for Agent 1

The following are the API-level requirements the preview system imposes on Agent 1:

1. **Preview endpoint:** `GET /api/preview/screen/:screenId?t=[ISO8601_timestamp]` — returns full PRE_Output object including reason_trace, for the specified screen at the specified time. Must call the identical PRE function as the production manifest endpoint.

2. **Area coverage endpoint:** `GET /api/preview/area/:areaId?t=[ISO8601_timestamp]` — returns PRE_Output for all screens in the area, batched. Must support arrays of up to [venue max screen count] results.

3. **Timeline endpoint:** `GET /api/preview/timeline/:screenId?from=[ISO8601]&to=[ISO8601]&resolution=[minutes]` — returns an array of (timestamp, PRE_Output) pairs sampled at [resolution] intervals across the range. Resolution defaults to 15 minutes; minimum 5 minutes; maximum 60 minutes.

4. **Performance requirement:** Single-screen preview response: < 200ms. Area coverage (up to 30 screens): < 2 seconds. Timeline (24 hours at 15-minute resolution): < 3 seconds.

5. **Accuracy guarantee:** Preview output MUST be byte-identical to what the production manifest endpoint would return for the same (screen_id, t) pair. Any divergence is a critical defect.

---

*End of PREVIEW-SYSTEMS-SPEC-v1.md v1.0*
*This document is owned by Agent 3 with implementation requirements passing to Agent 1.*
*Preview endpoint accuracy is constitutionally required (INV-3 determinism).*
*Append new preview modes as deployment experience reveals new operator needs.*
*Performance requirements in Appendix B are targets — negotiate with Agent 1 as load characteristics become known.*
