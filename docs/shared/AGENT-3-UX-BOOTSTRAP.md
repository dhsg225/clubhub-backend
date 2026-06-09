# ClubHub TV — Agent 3 UX Bootstrap
# Shared Operational Intelligence Layer

**Document type:** Foundational UX governance — mandatory reading for all UX contributors
**Authority:** Agent 3 (UX Architecture / Operator Experience) — ratified against Agent 2 governance layer
**Audience:** Agent 3 (current and future), human UX/design contributors, frontend engineers who design operator-facing surfaces
**Last updated:** 2026-05-22
**Status:** FOUNDATIONAL — governs all future operator-facing design work

---

## Purpose

This document is the orientation and governance framework for anyone designing operator-facing systems for ClubHub TV. It teaches what kind of platform this is, what UX constraints exist and why, what instincts will lead you wrong, and what design philosophy is required to do this work safely.

It must be read before any UX design work begins. It is not a style guide. It is not a component library. It is an explanation of why this problem is fundamentally different from most UX work, and what that difference demands from a designer.

**If you read this document and proceed to design as if you were building a standard SaaS product, you will produce harm.** Not bad aesthetics — operational harm. Operators who cannot understand what their screens are showing. Entropy that accumulates silently over months. Compliance failures. Audit trail collapse. Trust erosion. The stakes are real.

---

## Part 1 — The Core UX Problem

### 1.1 This Is Not Normal SaaS UX

Most SaaS products have the following UX contract: the user controls the software, the software serves the user's preferences, and the software does what the user tells it to in the way the user expects. Friction is the enemy. Simplicity is the goal. If the user finds a feature confusing, the feature is poorly designed.

ClubHub TV is not this.

ClubHub TV is **operational infrastructure** for managing content on physical screens in venues that have paying customers, regulatory obligations, commercial sponsorship commitments, and operational urgency. The operators who use it are not "users" in the consumer software sense — they are **operators** in the aviation, industrial systems, and broadcast operations sense. They manage a system on behalf of an organization that depends on correct outcomes.

This changes everything.

**The key differences:**

| Standard SaaS | ClubHub TV |
|---|---|
| User controls everything | Operator manages deterministic system |
| Simplicity is primary goal | Correctness is primary goal |
| Friction is the enemy | Some friction prevents harm |
| If it looks right, it works | Looks right ≠ resolves correctly |
| User sees the output directly | Operator configures inputs; screen is the output |
| Mistakes are recoverable | Some mistakes accumulate silently |
| More automation = better | Visibility outranks automation |
| User expertise optional | Operator mental model determines outcomes |

### 1.2 What ClubHub TV Actually Is

ClubHub TV is a **deterministic operational orchestration platform** with a human management layer.

The Playback Resolution Engine (PRE) is a pure deterministic function: given a screen ID, a timestamp, and the current system state, it computes exactly which content should play. It has no preferences. It has no memory of past operator intent. It does not know what you meant when you created a schedule — it only knows what state that schedule created in the database.

Operators interact with the management layer to configure the system state. The PRE evaluates that state and produces outputs. The gap between "what the operator intended" and "what the system state actually encodes" is the source of every operational failure documented in FAILURE-STORIES.md.

**The UX problem is therefore not:** "How do we make this software pleasant to use?"

**The UX problem is:** "How do we make the gap between operator intent and system state minimally small, maximally visible, and self-correcting over time?"

### 1.3 The Determinism Contract

The PRE is deterministic. This is not a constraint — it is the platform's most valuable property. It means:

- For any screen, at any time, the PRE will always produce the same output given the same inputs
- Outputs are predictable, reproducible, and explainable
- Every output can be traced back to the rule that produced it
- No output is random, probabilistic, or context-dependent in ways that can't be examined

The UX must **honor and surface** this determinism, not hide it. A UX that makes the system feel "magical" — where content appears on screens without an obvious causal chain — violates the determinism contract. Operators must be able to understand why any screen is showing what it shows. If they can't, the UX has failed regardless of how beautiful it looks.

---

## Part 2 — Constitutional UX Constraints

These are absolute. They derive from the Engineering Constitution and are not subject to UX design preferences. No design that violates these constraints may be implemented.

### C-01: Visibility Outranks Automation

**Source:** Engineering Constitution §2.3

The UX must not silently correct operator mistakes. It must not automatically clean up expired content. It must not silently remove overrides that seem old. It must not infer operator intent and act on that inference without operator awareness.

The system surfaces problems; operators decide. This is not a limitation — it is the correct model for a system where operator accountability for outcomes is real and non-trivial.

**Design implication:** Every automated behavior the system performs must be visible to operators. If the system does anything automatically (e.g., expires a scheduled override at the `expires_at` time), this must be surfaced as an observable event — an audit record, a notification, a state change that operators can inspect.

### C-02: Operator Agency Is Authoritative

**Source:** Engineering Constitution §2.7

The UX must not infer, assume, or correct operator intent. When an operator makes a configuration choice that the system considers entropy-producing (creating a permanent override, escalating a priority, skipping campaign creation), the UX may surface the concern, but the operator decides whether to proceed.

**Design implication:** Advisory signals NEVER block operator actions. Warning dialogs must have a clear "proceed anyway" path. The design must convey "here is information that may be important to you" — not "you are not allowed to do this because the system knows better."

The one exception: actions that would violate constitutional invariants (e.g., activating emergency without specifying scope) may require specific inputs before they are valid. These are completeness requirements, not agent-overriding gates.

### C-03: Explainability Outranks Optimization

**Source:** Engineering Constitution §2.2

For any screen, at any time, an operator must be able to determine: what is currently resolving, which rule caused it, and what prevented other rules from resolving. The UX must provide this path without requiring system expertise.

**Design implication:** The resolution explorer (P-RT-04 in DESIGN-PRINCIPLES-FOR-OPERATIONS.md) is not a "power user feature." It is a required accessibility feature for every operator who needs to understand why a screen shows what it shows. It must be accessible from every screen-level view.

### C-04: Resolution State vs Configuration State Must Be Distinguished

**Source:** Engineering Constitution §2.1 (Determinism), DESIGN-PRINCIPLES-FOR-OPERATIONS.md P-IA-01

The CMS shows operators the configuration they have created. The screens show the output of PRE resolution. These are different things. A UX that presents configuration state as if it were resolution state is actively misleading.

**Design implication:** Any view that shows configuration state (campaigns, schedules, overrides) must clearly label it as configuration state. Resolution state must be available and clearly labeled as resolution state. The phrase "Published = Playing" must never be an implication of any UI element.

### C-05: The PRE Is a Pure Function — The UX Must Not Imply Otherwise

**Source:** PRE-REFERENCE-IMPLEMENTATION-v1.md INV-1

The PRE has no side effects, reads no wall-clock time, and issues no network calls. It accepts inputs and produces outputs. The UX must not imply that the system makes "intelligent" decisions, "learns" from patterns, or has any behavior beyond what the rules determine.

**Design implication:** No UX language like "the system will automatically find the best content" or "smart scheduling will optimize your content mix." The correct language describes what the rules do: "this content will play when no higher-priority rule is active."

### C-06: Emergency Resolution Is Absolute

**Source:** Engineering Constitution INV-7

When emergency is active at a scope, all screens in that scope show emergency content. No other content resolves. This is absolute. The UX must communicate this absoluteness clearly at activation time.

**Design implication:** Emergency activation confirmation must display scope ("All 28 screens at [Venue Name] will show emergency content") prominently. The word "all" must be unambiguous.

---

## Part 3 — PRE-Safe UX Principles

UX that is "PRE-safe" is UX that surfaces, rather than hides, the PRE's behavior.

### P-01: Explain the Resolution Model, Don't Conceal It

The resolution model (7 levels, specificity hierarchy, priority tiebreaker within levels) is the most important concept for operator understanding. The temptation is to hide it behind simplified language — to say "overrides always win" rather than "operational overrides resolve at Level 1, which means they evaluate before scheduled campaigns at Level 3, regardless of priority."

Hiding the model feels user-friendly. It produces mental model failures. When the simplified model breaks down (as it always does — the operator who believes "overrides always win" is confused by the fact that two overrides at the same level compete), the operator has no framework for diagnosing the failure.

**PRE-safe approach:** Express the resolution model in operator language, at operator depth. Not the full technical specification — but an accurate simplified version. "Content priority works like this: Safety alerts are always first. Operational locks come next. Time-specific locks come after that. Then your scheduled campaigns. Then sponsorships. Then the default content." This is accurate and accessible.

### P-02: The Reason Trace Is Not Internal Data

The reason trace (stored in every PRE output) records which rule at which level and specificity terminated resolution, and why other rules were skipped. This is the explainability mechanism for every screen state.

The UX must surface the reason trace in natural language. Not raw JSON. Not technical level numbers. Natural language that answers "why is this screen showing this?"

**PRE-safe approach:** The Resolution Explorer translates the reason trace into operator-readable narrative:
- "Showing: Summer Drinks Campaign"
- "Why: This campaign targets Bar Area and has been active since Tuesday."
- "Why not Winter Menu: An operational lock set by [Operator Name] on [Date] is currently showing Beer Brand content on this screen. [View the lock]"

This narrative must be accurate — it must precisely reflect the reason trace. Inaccurate natural language that misleads operators is worse than showing the raw JSON.

### P-03: Preview Is Not a Convenience Feature

The preview endpoint calls the actual PRE function on actual system state. The result shows exactly what will resolve for a specific screen at a specific time. This is the most powerful tool for closing the gap between operator intent and system reality.

Preview must be available from every surface where an operator makes a configuration decision that affects playout. Not as a "check your work" option in a separate section — as an immediate, one-click verification at the point of action.

**PRE-safe approach:**
- After creating a schedule: "Preview what this screen will show" — opens preview for the affected screens
- After publishing a campaign: "Verify delivery across [Area]" — shows coverage map for all screens in scope
- After creating an override: "Preview what this screen will show now" — confirms the override is resolving as expected

### P-04: The 15-Second Poll Cycle Is a UX Reality

Screens poll the server every 15 seconds. Changes take effect within 15 seconds. The UX must communicate this, not apologize for it. "Changes take effect within 15 seconds" is the correct framing. "Queued for next poll" is a useful state indicator.

**What to avoid:** A UX that implies changes are instant (they aren't) or a UX that treats the 15-second cycle as a shameful limitation to hide (it isn't — it's a deliberate architecture that enables the delivery log).

### P-05: Confidence Score Language Must Reflect Its Trailing Nature

The confidence score is a trailing indicator. It reflects the last known delivery state, not the current state. A screen with confidence score 0.95 was confirmed delivering 15+ seconds ago. The UX must not imply real-time certainty.

**PRE-safe language:** "Last confirmed delivering at [timestamp]" rather than "Currently showing." "Delivery not confirmed in the last X minutes" rather than "Screen is not showing content."

---

## Part 4 — Entropy-Safe UX Design

Entropy is the accumulation of human decisions that interact over time to produce a system state no single operator would have chosen. The UX can be entropy-producing or entropy-reducing depending on its design choices. This section identifies how UX creates entropy and how to design against it.

### E-01: Urgency-Permanence Conflation

**How UX creates entropy:** When the override creation workflow places the content selection field before the expiry field, operators under time pressure complete the urgent task (selecting content) and skip the less-urgent task (setting expiry). Permanent overrides accumulate.

**Entropy-safe design:** The expiry field is the first field in override creation. The question "how long should this last?" precedes the question "what should show?" Forcing temporal context before content context changes the mental frame of the action from "make something show now" to "make something show for how long?"

### E-02: Resolution Level Invisibility

**How UX creates entropy:** When the campaign list and the override list are in separate sections of the CMS with no cross-reference, operators who check the campaign list have no way of knowing that overrides are silently winning resolution for 30% of their screens.

**Entropy-safe design:** Screen-level resolution state is visible in every context where screens appear. A campaign view shows which screens are receiving the campaign and which are under override. The override and campaign layers are not separate worlds — they are always shown in relation to each other.

### E-03: Missing Consequence Visualization

**How UX creates entropy:** When operators add a new sponsorship contract and see only "Contract created: 20% SOV," they have no awareness that total SOV is now 110% and editorial content has been effectively eliminated.

**Entropy-safe design:** Prospective impact is surfaced at the moment of action. Before confirmation: "Adding this contract will bring total SOV to 110%. At this level, editorial content will receive approximately 0% of scheduled screen time. [View impact] [Proceed anyway]"

### E-04: Advisory Habituation

**How UX creates entropy:** An advisory that fires constantly (e.g., an SOV warning active for 14 months) becomes invisible to operators. They dismiss it automatically. When the underlying condition worsens to a critical state, the advisory is already trained to be ignored.

**Entropy-safe design:** Advisories escalate visually over time (P-EV-02 in DESIGN-PRINCIPLES-FOR-OPERATIONS.md). A warning that has been active for 14 months is visually different from a warning that fired yesterday. Operators can "acknowledge and snooze" with a reason — which resets the escalation but creates an audit record.

### E-05: Override Orphaning

**How UX creates entropy:** When overrides display only their content and status, without creator identity, creation date, and rationale, operators who inherit an existing deployment have no basis for deciding whether to keep, modify, or delete existing overrides. They leave them in place (risk: accumulation) or delete them blindly (risk: breaking needed configuration).

**Entropy-safe design:** Every override record displays its full provenance inline: created by [name], [X days ago], reason: [reason if provided or "No reason given"]. This context makes deletion decisions safe and accumulation obviously problematic.

### E-06: Priority Escalation Reinforcement

**How UX creates entropy:** When the priority field in schedule creation has no guidance, operators learn through trial and error that raising priority makes their content appear more reliably. The priority range inflates. After 18 months, the max priority might be 890 for content that "needs to show."

**Entropy-safe design:** When a schedule is created at a priority close to the current maximum (top 10%), the UX surfaces context: "This schedule is in the highest priority range for this area. Priority only affects scheduling when two active schedules compete at the same scope. It cannot override operational locks. [Check if an operational lock is preventing your content]" — and links to the resolution explorer for the affected screens.

---

## Part 5 — Dangerous UX Instincts

These are the intuitions that designers bring from general UX experience that are actively harmful in this context. Knowing them by name allows you to catch yourself before acting on them.

### DANGER-01: Hiding Complexity

**The instinct:** "This is too complicated for operators. Let's hide the resolution level hierarchy and just say 'overrides always win.'"

**Why it causes harm:** Simplified models break at the edges. An operator who has been told "overrides always win" is completely baffled when two overrides compete and one wins unpredictably. The simplified model breaks exactly when it is most needed (during a diagnostic situation under time pressure), with no framework for recovery.

**The alternative:** Simplify the language of the resolution model, not the model itself. "Safety alerts are always first. Operational locks come next. Scheduled campaigns come after that." This is simple, accessible, and accurate.

### DANGER-02: Auto-Correcting Operator Behavior

**The instinct:** "Operators often forget to set expiry dates on overrides. Let's auto-expire overrides after 30 days."

**Why it causes harm:** Auto-expiration removes a legitimately permanent override that a senior operator created intentionally. The operator returns to find that the "beer brand sponsorship" screens they explicitly configured have reverted to the venue campaign without warning. Auto-correction violates operator agency and destroys trust in system predictability.

**The alternative:** Make expiry-setting so easy and prominent that operators set it deliberately. Escalating advisories for permanent overrides. A "review permanent overrides" workflow. Friction at creation time. Never silent correction after the fact.

### DANGER-03: Simplifying Away Specificity

**The instinct:** "The targeting hierarchy (screen, group, area, venue, org) is confusing. Let's simplify to just 'area' and 'all screens.'"

**Why it causes harm:** Real operator workflows require the full specificity hierarchy. A golf club needs per-hole sponsor targeting. A licensed club needs gaming area compliance content isolated from bar area content. Simplifying the targeting model means operators who need fine-grained control are forced into workarounds (multiple overrides, priority hacks) that produce more entropy than the full specificity model.

**The alternative:** The full specificity model is exposed but not forced. Operators who only need area-level targeting never need to think about screen-level targeting. Operators who need screen-level targeting have full access. Complexity is available; it is not obligatory.

### DANGER-04: Suppressing Warnings

**The instinct:** "There are too many warnings. Operators are ignoring them all. Let's show fewer warnings."

**Why it causes harm:** The correct response to warning fatigue is not fewer warnings — it is better warnings. Fewer warnings that are still ignored produce the same outcome as more warnings that are all ignored, but now critical conditions are invisible. Warning fatigue is a signal quality problem, not a warning quantity problem.

**The alternative:** Prioritize warnings by severity. Consolidate related warnings into single, actionable advisories. Escalate persistent warnings. Make every warning actionable (each has a direct action path). Silence is the signal for health — the system only speaks when there is something genuinely worth attending to.

### DANGER-05: Smart Automation

**The instinct:** "Let's build a smart scheduling assistant that analyzes content performance and automatically optimizes the content mix."

**Why it causes harm:** "Smart" systems that make decisions operators can't inspect or understand violate determinism and explainability simultaneously. If the system "optimizes" the content mix, operators can no longer answer "why is this screen showing that?" — because the answer is "the algorithm decided." This is incompatible with the platform's operational philosophy.

**The alternative:** Observation without inference. The system can surface patterns: "This content item has not been scheduled in the past 90 days" or "This area's content has not been updated since February." It does not act on these observations — it presents them. Operators decide.

### DANGER-06: Magical Scheduling Behavior

**The instinct:** "When an operator publishes a campaign, let's show a satisfying animation of content flowing to screens."

**Why it causes harm:** Animations and UX flourishes that imply instantaneous, complete delivery are visual lies. Publishing a campaign creates schedule rows in the database. The PRE will evaluate those rows at the next poll for each screen. For screens under override, the rows will lose. There is no "flow." There is a database write and a pending PRE evaluation.

**The alternative:** Honest mechanics. "Campaign published. Screens will begin receiving this content within 15 seconds. [View coverage for this campaign]" — a link that shows the actual coverage state across all targeted screens.

### DANGER-07: Task-Completion Focus Over Outcome Focus

**The instinct:** "The operator pressed publish. The action succeeded. Show a success state and move on."

**Why it causes harm:** Completing the action is not the same as achieving the intended outcome. An operator who publishes a campaign has completed the task. Whether the campaign is actually reaching any screens is the outcome. If 8 of 12 screens are under override, the task was completed but the outcome was not achieved. A success state after task completion that doesn't check outcome is systematically misleading.

**The alternative:** Success states that surface outcome, not just task completion. "Campaign published. 8 of 12 screens in Bar Area will receive this campaign. 4 screens are under operational locks. [View affected screens]"

---

## Part 6 — Explainability Requirements

Operators must be able to answer specific questions about the system state at any time. The UX must provide paths to answer each of these questions. If any path is missing, the explainability requirement is not met.

### Required Explanations

**Q1: Why is this screen showing this content right now?**
Path: Screen detail view → Resolution Explorer → "Showing [content] because [reason in natural language]"
Evidence: reason_trace from PRE output, translated to natural language

**Q2: Why is this screen NOT showing my campaign?**
Path: Campaign view → Coverage map → Affected screens → Override detail
Evidence: Override record with creator, date, reason

**Q3: When will this override expire?**
Path: Override detail view → expiry_at field clearly labeled ("Expires: [date]" or "Permanent until manually removed")

**Q4: Why did this campaign not reach all its targeted screens?**
Path: Campaign view → Coverage gap indicator → "X screens in [Area] are under operational locks and will not receive this campaign [View screens]"

**Q5: Why is the sponsor content appearing so frequently?**
Path: Sponsorship health view → Current SOV by contract → Combined SOV total → Editorial content percentage

**Q6: What is this screen showing right now, right this moment?**
Path: Screen detail view → "Last confirmed showing: [content] [X seconds ago]" with confidence score

**Q7: What will this screen show tomorrow at 2pm?**
Path: Preview system with time picker → "Preview as of [datetime] [timezone]"

**Q8: Who created this override and why?**
Path: Override detail view → creator name, creation date, reason field (if provided), age in human-readable format

**Q9: Has anything changed on these screens in the last 24 hours?**
Path: Area activity view → audit events sorted by recency, filtered to last 24 hours

**Q10: Are all my screens actually showing what they should be?**
Path: Area coverage map → per-screen resolution state at a glance → anomalies surfaced without requiring click-through for each screen

---

## Part 7 — Preview Philosophy

The preview system is the most important single feature for operator trust and mental model formation. It deserves a dedicated treatment.

### 7.1 What Preview Is

The preview system calls the actual PRE function on actual current database state for a specific (screen_id, t) pair. The result is the literal PRE output — the same computation that determines what the Pi appliance will download at its next poll.

This is not an approximation. It is not a simulation. It is the answer.

### 7.2 What Preview Does for Operators

**Immediate:** Closes the feedback loop between "I made a configuration change" and "I verified the result." Without preview, operators verify by walking to a physical screen. With preview, verification is available immediately from any CMS screen.

**Over time:** Builds accurate mental models through direct observation. An operator who has used preview to check their work 50 times has seen the PRE's actual behavior in 50 contexts. They have built an intuition for how the resolution model works that cannot be built through documentation alone (OBS-020).

**For complex configurations:** Makes multi-screen verification tractable. Without preview, verifying that a campaign is reaching all 12 screens in an area requires either physically checking 12 screens or checking the delivery log for 12 screens. With the area coverage map (P-PS-03), the operator sees all 12 at once.

### 7.3 Preview System UX Requirements

**Accuracy is non-negotiable (P-PS-02).** If operators discover that "the preview showed X but the screen showed Y," they will stop trusting the preview. The preview must call the real PRE. No client-side simulation. No approximate resolution.

**Access from every action surface (P-PS-01).** The operator must never have to navigate away from their current task to use preview. Every action that affects playout has a preview link adjacent to or integrated into the action confirmation.

**Multi-screen view (P-PS-03).** The area coverage map shows every screen in the area with its current resolution state. Operators should be able to see at a glance whether a just-published campaign is reaching all targeted screens.

**Temporal preview (P-PS-04).** Operators can preview what a screen will show at a future time. This is essential for verifying daypart schedules before they activate, for confirming that a campaign will start correctly on its start date, and for checking that an override will clear correctly at its expiry time.

### 7.4 The Preview Trust Contract

Preview creates a contract with operators: "If it shows X in preview, the screen will show X within 15 seconds."

This contract must be honored. Any condition that would cause a screen to show something different from the preview — and that is not surfaced to the operator — breaks the contract and breaks operator trust.

Known conditions that break the preview contract and must be surfaced:
- The screen is currently on a different HDMI input (TV/live sport) — preview shows PRE resolution, not physical display
- The screen has been offline for more than X minutes and the cache may be stale
- An emergency is active (the preview endpoint must reflect emergency state)

---

## Part 8 — Vertical-Aware UX

The shared operational memory layer documents seven distinct market verticals, each with different operational profiles, entropy patterns, urgency models, and operator types. A UX designed for one vertical will be suboptimal or actively harmful in another.

### 8.1 The Fundamental Vertical Differences

**Sports bars** need real-time operational tools. A 5-step campaign creation workflow is a failure for a bar manager who needs to change content at half-time in 90 seconds. Speed is the primary design constraint.

**Golf clubs** need low-urgency, high-fidelity seasonal management tools. They configure screens at season start and operate on a weekly or monthly review cadence for most of the year. During tournament days, they need real-time urgency mode.

**Hotels** need aesthetic control, content freshness signals, and multilingual management. They have the lowest operational urgency of any venue type and the highest brand precision requirement.

**Licensed clubs** need zone-specific content management with gaming compliance awareness, shift manager override tools, and strong entropy visibility (they have the highest entropy accumulation rate of any vertical).

**Community venues** need extreme simplicity, staleness prevention, and the lowest possible barrier to content updates. Their operators are often part-time or volunteer staff with the lowest CMS competency.

### 8.2 Design Principle: Vertical Defaults, Not Vertical Walls

The UX should not be forked into separate products for each vertical. The underlying system is the same; the operator experience should adapt to the operational context. The approach:

- **Default configurations** calibrated to the vertical: a golf club deployment shows tournament day workflows prominently; a community venue deployment hides the advanced sponsorship management.
- **Role-appropriate depth** that is configurable: a shift manager in a sports bar sees a different primary view than a shift manager in a hotel (sports bar: urgency-first; hotel: ambient-first).
- **Entropy advisory calibration**: staleness alerts fire much sooner for community venues (14 days vs 30+ for active commercial venues); override accumulation alerts fire sooner for sports bars.

### 8.3 Do Not Design for the Median Operator

The median operator is not the most important operator. The most important operator is the one who is doing the most damage to the system's configuration integrity. That operator is:
- A shift manager in a sports bar on game day, making override decisions in 30-second windows
- A new marketing coordinator who inherited a venue with 47 active overrides from three previous operators
- A community venue volunteer who last logged in 4 months ago and is now updating screens for the first time

Design for these operators' failure modes, not for the competent operator's happy path.

---

## Part 9 — Operational Time Models

Operators experience time pressure differently across roles and verticals. The UX must match the operator's temporal context.

### 9.1 The Three Urgency Profiles

**Ambient urgency** (hotel lobby manager, community venue coordinator, golf club off-season):
- Changes can wait. No one is watching the screen right now. Getting it right matters more than getting it fast.
- Design for: deliberate workflows, review steps, consequence disclosure, advisory surfacing.
- Time horizon: days to weeks.

**Scheduled urgency** (venue manager publishing a weekly campaign, marketing coordinator launching a promotion):
- Changes must be ready by a specific time. There is planning time before the deadline, but the deadline is real.
- Design for: completion workflows, pre-launch verification, coverage confirmation, scheduled preview ("what will this look like at 9am Monday?").
- Time horizon: hours to days ahead.

**Immediate urgency** (shift manager during an event, sports bar operator at half-time, club manager during a compliance issue):
- Changes must happen NOW. Every second of the current workflow is a second of wrong content on live screens.
- Design for: minimal steps, maximum certainty, immediate feedback. 3 taps from any screen to "content is changing." The confirmation that the change is working must arrive within 15 seconds.
- Time horizon: seconds to minutes.

### 9.2 The Urgency-Accuracy Tradeoff

Under immediate urgency, operators accept reduced configuration quality for speed. They create permanent overrides instead of time-bounded ones. They skip campaign creation and make direct schedules. They activate emergency instead of creating an operational override.

The UX cannot eliminate this tradeoff under genuine time pressure. What it can do:
- Make the "correct" workflow as fast as the "shortcut" workflow for the most common immediate-urgency use cases (P-EU-02: "Quick change" workflow)
- Surface the consequence of the shortcut immediately, while the operator can still choose: "This override will persist indefinitely unless you set an expiry. [Set expiry now] [Continue without expiry]"
- Make correction easy after the fact: a "clean up your changes" workflow that surfaces all configuration created under urgency for post-hoc review

### 9.3 Time Zone Awareness

The PRE evaluates time-of-day schedules using venue local time. An operator who is not in the same timezone as the venue will create schedules that activate at the wrong time if the interface doesn't make timezone explicit.

**Every time input must display the venue's local timezone explicitly:**
"Lunch special from 12:00 PM – 2:00 PM (venue local time: AEST)"

This is not optional. It prevents a real class of scheduling errors that are entirely preventable by clear UI design.

---

## Part 10 — Attention-Aware Design

The UX serves operators under different attention conditions. Not all operators approach the CMS with full attention and ample time.

### 10.1 The Attention Budget

A shift manager who accesses the CMS while managing a busy Saturday night has a fraction of the attention they would have during a quiet Tuesday morning. The CMS interface they encounter must be usable with the attention they have, not the attention they would have under ideal conditions.

**Design for the worst attention state the operator will realistically be in.** A venue manager who checks the screen state while talking to a bar staff member and managing a delivery is the real user. Not the venue manager who sits down at a desk with 20 minutes blocked for CMS review.

### 10.2 High-Stress Operators

Shift managers and venue managers during live events are operating under:
- Divided attention (managing multiple things simultaneously)
- Time pressure (decisions are needed in seconds, not minutes)
- Social observation pressure (staff and patrons are present)
- Physical movement (they may be checking the CMS on a phone while walking the floor)

**Design requirements for high-stress contexts:**
- The most important action is accessible within 3 taps from the home screen
- Success and failure states are immediately distinguishable without reading (color + icon, not text alone)
- "I made a change" feedback is immediate, not delayed until the next screen poll
- Error messages are actionable, not technical. "This screen is under an operational lock" rather than "Resolution at LEVEL_1 precludes LEVEL_3 evaluation."

### 10.3 Casual Operators

Marketing managers and org admins accessing the CMS for periodic review have more attention to give. They can handle more information density, more configuration depth, and more nuanced advisory content.

**Design requirements for low-stress contexts:**
- Information density can be higher — more context, more advisory detail, more historical data visible
- Multi-step workflows are acceptable — campaign creation, audience targeting, SOV review
- Comparative data (this week vs last week, this venue vs venue average) is valuable

### 10.4 The Role-Appropriate Depth Principle

The same CMS interface must not be the default for all roles. The information that is valuable to an org admin reviewing cross-venue health is noise to a shift manager who needs to change one screen's content immediately.

Role-appropriate views as defined in P-IA-02:
- **Shift manager default:** What's playing right now + Make a quick change. Everything else is secondary.
- **Venue manager default:** Campaign management + What's playing in each area + Entropy indicators.
- **Org admin default:** Cross-venue health overview + User management + Sponsorship contracts + Org-level campaigns.

---

## Part 11 — Failure-Oriented UX

Good operational UX assumes failure is normal. It is designed not for the happy path but for the recovery path.

### 11.1 Failure Assumptions

Design every operator-facing surface assuming:

**Configuration confusion:** The operator does not understand why the screen is showing what it is. The UX must provide an obvious path to the answer.

**Stale configuration:** Some of the schedules and overrides the operator is looking at are months or years old and no longer reflect anyone's current intent. The UX must surface age and provenance.

**Override misuse:** Some operational overrides on screens were created for "temporary" purposes and never expired. The UX must not treat permanent overrides as normal — they must be visually distinct.

**Fragmented schedules:** The schedule table for any active venue is likely a mixture of current, stale, and orphaned records. The UX must provide a view that helps operators triage this mixture.

**Urgency shortcuts:** Many operational changes were made under time pressure with suboptimal configuration choices. The UX must make post-hoc correction easy and must surface configurations that should be reviewed.

**Unknown rationale:** Operators regularly encounter configuration they didn't create and can't explain. The UX must surface the available provenance information for every record.

### 11.2 The Recovery Path

Every failure state has a recovery path. The UX must design the recovery path as carefully as the creation path.

**Override accumulation:** Recovery path = "Review active overrides for this area, sorted by age" — showing each override with age, creator, reason, and one-click expiry or deactivation.

**Priority inflation:** Recovery path = "Schedule health view" — showing all active schedules sorted by priority, with duplicate detection and orphan detection.

**Stale content:** Recovery path = "Content that may need review" — content items older than X days referenced by active schedules.

**Coverage gaps:** Recovery path = Area coverage map showing which screens are receiving the campaign and which are under override, with direct navigation from each affected screen to its override record.

**Emergency semantic collapse:** Recovery path = Emergency audit log with all activations, durations, and reasons, allowing the org admin to assess the pattern and have a conversation about correct emergency usage.

### 11.3 Failure Visibility Before Complaint

The ideal is for operators to discover problems before the problems manifest as patron complaints or operational failures. Entropy monitoring (M-01 through M-12) is the primary mechanism for this. The UX must surface entropy signals proactively — not in response to operator-initiated investigation, but as part of the routine CMS experience.

The entropy score displayed in primary navigation (P-EV-01) is the mechanism for routine entropy awareness. An operator who sees their venue score change from 85 to 72 between last week and this week knows that something has accumulated and can investigate before it becomes a complaint.

---

## Part 12 — Human Factors Engineering

ClubHub TV's UX draws on design disciplines that are rarely considered in typical SaaS product design. Understanding these disciplines is required to reason correctly about operator-facing design.

### 12.1 Aviation: Crew Resource Management

CRM in aviation established that the majority of aviation accidents are not caused by technical failure but by human error in information management and decision-making under time pressure. The principles developed for aviation cockpit design apply directly to content management operations:

**Situational awareness:** Operators must have an accurate picture of the current state of the system at all times. The aviation equivalent is the instrument panel — it shows the current state without requiring the pilot to query for it. The entropy health indicator, the area coverage map, and the per-screen resolution display are the ClubHub equivalent.

**Error chain interruption:** CRM designs barriers that interrupt the chain of small errors that lead to accidents. Override expiry prompting, coverage gap disclosure, and emergency frequency surfacing are error chain interruptions in the ClubHub context.

**Crew coordination:** In multi-operator venues, operators must be able to understand what their colleagues have done and why. The audit trail visible from every configuration record is the CRM equivalent of the "handover brief."

### 12.2 Broadcast Operations

Broadcast control rooms manage real-time content delivery to large audiences under time pressure. Key design lessons:

**Pre-flight checks:** Broadcast operators confirm the state of every element before going live. The "verify coverage before campaign publish" workflow is the ClubHub equivalent of the broadcast pre-flight check.

**Dead air is the enemy:** A broadcast that goes to dead air is the worst outcome. System fallback content on a screen is the ClubHub equivalent. The confidence score monitoring and delivery log staleness advisories are the mechanisms for preventing "dead air."

**Talkback and logging:** Broadcast operations log every action taken during a broadcast for accountability and post-event review. The audit trail in ClubHub serves the same function — every configuration change is logged with who did it, when, and what they changed.

### 12.3 Industrial Control Systems

ICS design for safety-critical environments provides principles for systems where mistakes have physical consequences:

**Configuration documentation:** In ICS, undocumented configuration is a safety risk. ClubHub's rationale fields and creator provenance on every configuration record serve the same function — making configuration interpretable by anyone, not just its creator.

**Change management:** ICS environments require formal change control processes for configuration changes because undocumented changes can interact badly with other configuration. The campaign lifecycle (draft → published → archived) and the pre-action consequence disclosure are ClubHub's change management instruments.

**Alarm management:** ICS alarm systems that fire too frequently train operators to ignore them. The principles of alarm rationalization (every alarm must be significant, actionable, and distinguishable from others) apply directly to ClubHub's entropy advisory system.

### 12.4 Casino Operations

Casinos manage high-entropy, high-urgency operations with large numbers of staff across complex physical environments. Relevant lessons:

**Zone sovereignty:** Casinos operate with clear authority zones — the floor manager owns the floor, the cage manager owns the cage. The ClubHub area/venue hierarchy maps to this model. UX must respect and reinforce zone boundaries.

**Shift handover:** Casino shift changes involve formal handover of state — every open issue is documented and passed to the incoming shift. The "end of shift override review" workflow (P-OM-02 in DESIGN-PRINCIPLES-FOR-OPERATIONS.md) is the ClubHub equivalent.

**Incident log:** Casinos maintain incident logs that capture unusual events for review and training. The Emergency activation audit log and the FAILURE-STORIES.md narrative format are both incident log mechanisms.

---

## Part 13 — Workflow Integrity

Workflow integrity means that the workflows operators follow in the CMS produce complete, coherent, auditable outcomes — not partial outcomes, orphaned records, or configuration that will be confusing to future operators.

### 13.1 The Campaign Workflow as the Gold Standard

The campaign lifecycle (draft → published → archived) is designed for workflow integrity:
- Draft creation is low-stakes (no immediate effect)
- Review and coverage confirmation before publishing
- Publication creates schedule rows that are linked to the parent campaign
- Archival removes the campaign from active resolution while preserving the record

This workflow produces coherent outcomes at every stage. Any UX that provides shortcuts around this workflow (e.g., allowing operators to modify schedule rows created by campaigns directly, outside the campaign context) compromises workflow integrity.

### 13.2 Workflow Fragmentation

Workflow fragmentation occurs when an operator's intent is split across multiple unlinked configuration records with no audit trail connecting them. The "Priority Wars" failure (FAILURE-STORIES.md Story 4) demonstrates fragmentation — 67 schedule rows, many orphaned, with no visible connection to the operational intent that created them.

**Design for workflow completion:** Every workflow that creates configuration records should prompt for the full set of fields that make the record self-explanatory in the future. An override with no reason, no expiry, and no link to a campaign is a fragmentation risk. The creation workflow should prompt for all three.

### 13.3 Orphan Prevention

Orphaned records (schedule rows not linked to a campaign, overrides with no creator context, content items not referenced by any schedule) are entropy in documentary form. They accumulate over time and contribute to the cognitive load of managing a mature venue.

**Design for lifecycle completeness:** Every configuration record should have an explicit lifecycle. When a campaign is archived, its associated schedule rows should be archived or explicitly retained with a reason. When an override expires, an audit record should confirm its expiration. When an operator deletes a content item, a warning should fire if the item is still referenced by active schedules.

---

## Part 14 — Operator Trust

Trust in the system is earned through accuracy and predictability. It is lost through surprises — when the system does something the operator didn't expect, or when the system fails to surface something the operator needed to know.

### 14.1 How Trust Is Earned

**Accuracy:** The preview shows what the screen actually shows. Advisories fire when the conditions they describe exist. Coverage maps are correct. When an operator acts on system information and the outcome matches the prediction, trust is built.

**Predictability:** The system behaves the same way in the same circumstances. The PRE produces the same output for the same inputs every time. An operator who understands the resolution model can always predict the outcome before they make a change.

**Transparency:** The system never acts in ways that are invisible to operators. Every state change is an observable event. Every configuration record has a visible history. There are no hidden behaviors.

### 14.2 How Trust Is Lost

**False success states:** "Campaign published" appears when in fact 40% of targeted screens won't receive the campaign due to overrides. The operator believes the system worked; the screens tell a different story.

**Silent changes:** An automatic system action (a cache expiry, a scheduled cleanup, an automatic archival) changes the system state without operator awareness. The operator returns to a state they don't recognize.

**Inaccurate preview:** The preview shows X; the screen shows Y. Even once, this breaks the trust foundation. Operators who cannot trust the preview revert to physical screen verification, and the mental model gap reopens.

**Advisory fatigue:** The operator has learned to dismiss all advisories because they fire constantly without meaningful action paths. A critical advisory fires; the operator dismisses it on reflex. By the time the damage surfaces, trust in the advisory system is gone.

### 14.3 Trust Recovery

Once lost, operator trust is hard to recover. The best approach is to never lose it. The second best approach is to surface the loss immediately, acknowledge the failure, and provide a recovery path.

When a system bug or design error causes false or missing information, the recovery communication should be:
- Specific about what was wrong ("Coverage maps were not showing screens with multi-area targeting correctly")
- Clear about what was affected ("This affected venues with more than 3 areas — [affected venues listed]")
- Complete about what operators should do ("Review coverage for any campaign published in [date range]")
- Not minimized — operators who have been acting on incorrect information deserve an accurate account of what they missed

---

## Part 15 — Future UX Governance

As the platform evolves, new UX proposals will be made. This section defines how proposals are evaluated against constitutional constraints before implementation.

### 15.1 The UX Proposal Review Checklist

Before any significant UX proposal advances to implementation, verify:

| Check | Document | Required Outcome |
|-------|----------|-----------------|
| Does this design surface resolution state or configuration state? | P-RT-01 | Resolution state clearly surfaced |
| Are screens under override visually distinct? | P-RT-02 | Yes, with accessible treatment |
| Does a coverage-affecting action show impact before confirmation? | P-RT-03 | Yes |
| Is there a path to explain why any screen shows what it shows? | P-RT-04 | Yes |
| Does override creation make expiry prominent? | P-OM-01 | Yes — first, required field |
| Does this design block operator agency? | EC §2.7 | No |
| Does this design imply automation the system does not perform? | DANGER-02 | No |
| Does this design hide the resolution model? | P-01 | No |
| Does the design use canonical terms or accurate operator-language translations? | DOMAIN-LANGUAGE-GLOSSARY | Yes |
| Is the advisory tone informational rather than accusatory? | P-EA-01 | Yes |
| Does each advisory include an actionable path? | P-EA-02 | Yes |
| Is friction proportional to action blast radius? | P-CC-02 | Yes |
| Does this design honor the knowledge classification of the claims it depends on? | KNOWLEDGE-CLASSIFICATION-SYSTEM | Yes — HYPOTHETICAL designs labeled |
| Has this design been reviewed against FAILURE-STORIES.md failure modes? | FAILURE-STORIES | Yes |
| Has this design been reviewed against the relevant vertical profiles? | MARKET-VERTICAL-PATTERNS | Yes |

### 15.2 Proposals That Require Cross-Agent Review

Per CROSS-AGENT-GOVERNANCE.md Section 2, any UX proposal that touches a Shared Decision Zone requires review from Agent 1 and Agent 2 before finalization. Agent 3 does not have unilateral authority over:

- New advisory signals (requires Agent 2 to define the condition)
- Preview system behavior changes (requires Agent 1 to confirm accuracy guarantees)
- Emergency workflow changes (requires all three agents)
- Resolution model language that could imply different PRE behavior than specified

### 15.3 The Evolution Principle

The UX will evolve as the platform matures, as field observations accumulate, and as hypotheses are validated or invalidated. The governance framework for evolution:

- UX proposals that improve operator experience WITHOUT compromising explainability, operator agency, or resolution transparency are automatically in scope for Agent 3
- UX proposals that improve operator experience AND require adjusting an advisory threshold require Agent 2 review
- UX proposals that improve operator experience AND require platform behavior changes require all agents
- Any change that a reasonable reader could interpret as hiding the resolution model from operators requires Agent 2 review and sign-off, even if it is technically within Agent 3's domain

### 15.4 Research Obligations

Agent 3 has an ongoing obligation to accumulate field evidence for HYPOTHETICAL claims in UX-HYPOTHESES-AND-QUESTIONS.md. For each HYPOTHETICAL claim that a UX design depends on:

- The design documentation notes the dependency
- There is an active path to validating the hypothesis (either an experiment in FUTURE-EXPERIMENTS.md or a field observation protocol)
- If the hypothesis is invalidated, the design is flagged for reassessment

This is not bureaucratic overhead — it is how the platform avoids building on false foundations.

---

## Appendix A — The Design Review Question

When reviewing any design decision, ask this single question:

**Can every operator, at every competency level, in every urgency condition, always answer: "Why is that screen showing that content right now?"**

If yes: the design may proceed.
If no: the design is incomplete, regardless of how elegant or simple it appears.

---

## Appendix B — Reading List

Before designing any operator-facing surface for ClubHub TV, the following documents are mandatory reading in this order:

1. `docs/ENGINEERING-CONSTITUTION-v1.md` — the philosophical axioms
2. `docs/OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md` — the entropy model
3. `docs/shared/OPERATOR-MENTAL-MODELS.md` — who operates this system and how they think
4. `docs/shared/FAILURE-STORIES.md` — what goes wrong when design fails
5. `docs/shared/DOMAIN-LANGUAGE-GLOSSARY.md` — the canonical vocabulary
6. `docs/shared/DESIGN-PRINCIPLES-FOR-OPERATIONS.md` — the design principles derived from the above
7. `docs/shared/MARKET-VERTICAL-PATTERNS.md` — the operational contexts
8. `docs/shared/REAL-WORLD-OBSERVATIONS.md` — what has been observed
9. `docs/shared/UX-HYPOTHESES-AND-QUESTIONS.md` — what is still unknown
10. `docs/shared/CROSS-AGENT-GOVERNANCE.md` — coordination rules
11. `docs/shared/KNOWLEDGE-CLASSIFICATION-SYSTEM.md` — epistemological standards

This document last.

Reading these documents in order is not optional. The design work is grounded in operational reality. That reality is encoded in these documents. Design without this grounding produces harm.

---

*End of AGENT-3-UX-BOOTSTRAP.md v1.0*
*This document is maintained by Agent 3, with mandatory cross-reference to Agent 2's shared operational memory layer.*
*Amendments require review against the Engineering Constitution and CROSS-AGENT-GOVERNANCE.md.*
*Future UX contributors: read this document before every new design engagement, not just at initial onboarding. The operational context evolves. The constraints remain.*
