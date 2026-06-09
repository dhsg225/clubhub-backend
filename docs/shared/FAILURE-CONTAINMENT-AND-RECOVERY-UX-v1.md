# ClubHub TV — Failure Containment and Recovery UX
# Shared Operational Intelligence Layer

**Document type:** UX governance — failure visibility, containment, and recovery design
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** UX contributors, frontend engineers, incident response designers
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all failure mode, degradation, and recovery UX design

---

## Purpose

This document defines how the ClubHub TV platform makes operational failures visible, prevents small failures from propagating into large ones, and supports operator recovery with operational honesty rather than false confidence.

The threat this document addresses: invisible propagation. Small operational failures — a single screen diverging, a minor override collision, a subtle configuration gap — are manageable when detected early and visible clearly. The same failures become catastrophic when they propagate undetected through the operation, compound with other conditions, and surface only when the cumulative effect has crossed a threshold the operator cannot quickly recover from.

**The governing principle: every failure must be visibly contained.** The operator should always know the boundaries of a failure — what is affected, what is not affected, and what the current trajectory is. A failure with visible boundaries is manageable. A failure with invisible boundaries is terrifying.

**This document governs design, not recovery logic.** The mechanics of PRE resolution, delivery log semantics, and rollback behavior are Agent 1 domain. This document governs how operators see, understand, and respond to failures through the UX layer.

---

## Section 1 — Failure Containment Philosophy

### 1.1 Graceful Degradation

Graceful degradation is the principle that a system under partial failure should continue operating in a reduced but functional state, rather than failing completely or silently. For ClubHub TV, graceful degradation means:

- A screen that cannot receive a manifest update should continue playing its last valid manifest rather than showing a blank screen
- A venue that loses connectivity should continue operating on cached state rather than stopping
- An override that has expired should fall through to the next resolution level rather than leaving the screen in an undefined state

**The operator's role in graceful degradation:** The operator must be able to see when the system is operating in degraded mode, what exactly is degraded, and what the degraded state is. Graceful degradation is only valuable if it is visible. Silent degradation that the operator mistakes for healthy operation is a trust-destroying failure mode.

### 1.2 Local Failure Isolation

A failure that is clearly bounded to a specific screen, venue, or scope is far less dangerous than an unbounded failure. The platform's design should communicate scope clearly and immediately.

**Isolation visibility requirements:**
- Every failure display must show its scope unambiguously: single screen / venue section / full venue / multi-venue / fleet
- Scope boundaries must be visually represented, not just stated in text
- When a failure's scope is uncertain (possible propagation in progress), this uncertainty must be displayed — "scope: 2 confirmed, possibly expanding to 5"

### 1.3 Visible Instability Boundaries

Instability boundaries are the edges of a failure's current and potential scope. An operator needs to know not just what is currently failing, but what could be affected if the failure propagates.

**Instability boundary visualization:**
- Current confirmed failure scope: clearly marked (solid boundary)
- Potential propagation scope: visually distinct indicator (dashed boundary or secondary indicator)
- Clean scope: visible confirmation that areas outside the failure boundary are unaffected

Operators should not need to deduce what is safe — the display should tell them.

### 1.4 Trust-Preserving Degradation

When the system is operating in degraded mode — playing from cache, operating on stale state, running without override enforcement due to connectivity loss — the display must preserve operator trust through honesty.

**Trust preservation rules:**
- Never display a degraded state as a healthy state
- Never omit a staleness indicator to "avoid alarming" the operator — stale data with an honest label is better than stale data presenting as fresh
- Display what the system knows it is doing, including what it is uncertain about
- When the system is doing the best it can under constraints, say so explicitly: "Operating from cached manifest — last confirmed [N minutes ago]. Content delivery is continuing."

False confidence destroys more trust than acknowledged degradation. An operator who discovers that "healthy" was actually "degraded and hiding it" will never fully trust the platform again.

---

## Section 2 — Failure Classes and Containment UX

### Class F-01: Single-Screen Divergence

**What it is:** The content playing on one screen differs from what PRE predicts should be playing. This may be a device issue, a manifest delivery failure, or a divergence that PRE explains but the operator has not yet reviewed.

**Scope:** Single screen. Does not affect other screens unless the divergence is caused by a systemic condition (PRE logic error, shared override).

**Containment UX:**
- The affected screen shows a divergence indicator in the fleet view: a distinct icon that distinguishes "divergence from prediction" from "advisory condition"
- The divergence detail shows: what PRE predicted, what was actually delivered, when the divergence started, and whether it is still ongoing
- Non-diverging screens are visually clean — the operator can see at a glance that the failure is contained to one screen
- A link to replay-assisted investigation for the divergence period is immediately accessible

**Containment boundary display:** The fleet view with all non-affected screens showing clean state is the containment display. The affected screen is visually distinct; the rest are not.

---

### Class F-02: Venue-Local Instability

**What it is:** Multiple screens within a single venue are showing abnormal states, or the venue's operational configuration has entered an unstable condition (override storm, schedule fragmentation, rapid divergence accumulation).

**Scope:** One venue. Does not affect other venues unless the cause is systemic.

**Containment UX:**
- The affected venue is highlighted in the fleet view with an instability indicator
- The venue's internal state is shown with scope boundaries: which areas of the venue are affected vs. clean
- An instability timeline shows when the instability started and what events preceded it
- A suggested containment action surfaces if one is available: "3 conflicting overrides detected — review override stack to stabilize"
- Cross-venue view shows other venues as unaffected — the operator can confirm the failure is local

**Escalation trigger:** If instability within one venue does not improve within N minutes despite no systemic cause, a "requires investigation" prompt surfaces — not an automatic escalation, but a visible countdown to a decision point.

---

### Class F-03: Sponsorship Fulfillment Degradation

**What it is:** A sponsor's contracted SOV is not being delivered. May be caused by override conflicts, schedule configuration errors, campaign misconfiguration, or content delivery failures.

**Scope:** Sponsor-specific, may span multiple screens or venues.

**Containment UX:**
- The SOV dashboard shows contracted / configured / delivered as three distinct numbers — the gap between them is the failure
- The cause of the gap is shown if determinable: "Override stack suppressing sponsor content on 2 screens. Remove or adjust to restore delivery."
- Projected delivery by contract period end is shown: "At current delivery rate, contract will be fulfilled at 73%"
- The operator can see exactly which overrides or configurations are causing the shortfall, with links to each
- Business impact is shown in operator-appropriate language: "Sponsor contract at risk. Contact [sponsorship team contact] before [time]."

---

### Class F-04: Override Cascade

**What it is:** Override conflicts or a large volume of active overrides are producing unpredictable effective state across multiple screens. The override stack has become the primary driver of instability rather than scheduled content.

**Scope:** May affect multiple screens within a venue; may propagate if similar override patterns are present in other venues.

**Containment UX:**
- Override cascade indicator: a distinct visual state shown when active overrides exceed a threshold or when override collision rate is high
- Override stack visualization: all active overrides shown in a visual stack, with collision indicators between conflicting overrides
- Cascade contributor highlighting: overrides that are directly contributing to the instability are highlighted vs. overrides that are not in conflict
- Remediation pathway: "Removing these 3 overrides would stabilize effective state. Preview the result before applying."
- Entropy contribution display: the cascade's contribution to venue entropy grade is shown, with projection of grade improvement if cascade is resolved

---

### Class F-05: Stale-State Propagation

**What it is:** A cached or outdated state is driving PRE outputs because connectivity issues are preventing state refresh. The system is operating on what it last knew, which may no longer reflect operator intent.

**Scope:** Depends on which components are stale. May affect one venue or multiple if a network-level issue prevents state updates fleet-wide.

**Containment UX:**
- Explicit stale-state indicator on every affected operational surface: "Operating on cached state — last confirmed [time]"
- What is stale vs. what is confirmed: delivery is continuing but configuration changes made since [time] may not have propagated
- Impact assessment: "You applied an override at [time]. It is unknown whether it has propagated to all affected screens."
- Resolution pathway: "Connectivity restored — state is refreshing. Estimated sync complete in [time]."
- The operator can see clearly what they know, what they don't know, and what the system is doing about it

---

### Class F-06: Regional Operational Drift

**What it is:** Multiple venues in a geographic region or organizational cohort are showing similar operational patterns — similar entropy grades, similar override patterns, similar schedule fragmentation — suggesting a shared underlying cause (configuration templates, shared training, shared staffing patterns).

**Scope:** Multi-venue. Systemic rather than localized.

**Containment UX:**
- Regional drift indicator in the network view: a cluster of venues with similar conditions highlighted as a cluster
- Pattern analysis: "4 venues showing similar override accumulation patterns — possible shared configuration or training issue"
- Distinction from coincidence: the platform should not declare drift on weak evidence. N=2 is a coincidence; N=5 in the same pattern within 7 days is a signal.
- Investigation pathway: "Review configuration templates shared by these venues" / "Review recent operational training for this region"

---

### Class F-07: Fleet-Wide Incident

**What it is:** A condition affecting a significant portion of the fleet simultaneously — a PRE logic error, a platform-level failure, a shared configuration problem, or an external dependency failure.

**Scope:** Fleet-wide. Requires immediate escalation and coordinated response.

**Containment UX:**
- Fleet incident mode: the platform enters a distinct visual state that is unambiguously "this is a platform-level event"
- Fleet health grid: all venues shown simultaneously with their individual states, making the scope of the failure visible at a glance
- Confirmed affected vs. unconfirmed: the display distinguishes venues confirmed as affected from venues whose status is uncertain
- Fleet incident command: a single incident command context covering all affected venues, with a unified coordination log
- The platform's own operational status (is the platform itself degraded?) should be explicitly displayed during fleet incidents

---

## Section 3 — Containment Visibility

### 3.1 Instability Scope Visualization

Scope visualization translates abstract failure scope into a spatial or organizational representation the operator can immediately grasp.

**Spatial representations:**
- For multi-screen venues: a schematic of the venue's screen layout with affected screens highlighted
- For multi-venue fleet: a fleet grid where affected venues are highlighted with their health state

**Organizational representations:**
- For sponsor-scope failures: the sponsor's campaign coverage map showing which placements are affected
- For role-scope failures: which operator roles are affected by the current authority conditions

**Scope visualization principles:**
- Always show what is NOT affected alongside what is — the clean areas are as important as the affected areas
- Scope should be immediately legible, not requiring the operator to count or calculate
- When scope is uncertain, show the uncertainty explicitly — a dashed or dimmed potential-scope indicator is better than confident display of incorrect scope

### 3.2 Affected-Area Highlighting

The primary fleet or venue view should immediately communicate where the failure is without requiring the operator to interpret a metric.

**Highlighting requirements:**
- Affected elements use the severity color treatment appropriate to the failure tier
- Unaffected elements use their standard healthy treatment
- The visual contrast between affected and unaffected elements should be perceptible peripherally
- Highlighting persists as long as the failure persists — it does not time out or fade

### 3.3 Blast-Radius Cognition

Blast radius is the maximum potential scope of a failure if it propagates. Knowing the blast radius helps operators prioritize response effort proportionally to risk.

**Blast radius display:**
- For each active failure, a "potential scope if unresolved" indicator
- Example: "This override collision currently affects 2 screens. If the upstream schedule also fails, it could affect 8 screens."
- Blast radius is shown as a secondary indicator, never as primary — the current confirmed scope is always primary
- Blast radius that has been stable for N minutes without expansion may be demoted to a collapsed indicator

### 3.4 Downstream Consequence Visibility

Failures have downstream consequences that may not be immediately visible but will matter operationally. The platform should surface downstream consequences alongside the immediate failure.

**Downstream consequence display:**
- Sponsor SOV impact: "This delivery failure will reduce sponsor SOV by approximately X% if not resolved in [time]"
- Schedule integrity impact: "This override collision will affect the schedule transition at [time]"
- Entropy impact: "Resolving this will reduce venue entropy grade from C to B"
- Historical record impact: "This divergence will be visible in the delivery log and may appear in sponsor proof-of-play reports"

Operators make better recovery decisions when they can see what the failure will cost them if not resolved.

---

## Section 4 — Recovery UX

### 4.1 Stabilization Workflows

Stabilization is the process of bringing an unstable operation back to a stable state. Recovery is bringing it back to the pre-failure state. Stabilization comes first — stability must be achieved before restoration is attempted.

**Stabilization workflow design:**
- The first step should always be: confirm the current scope of the instability
- The second step: identify the immediate actions that will stop the instability from spreading
- The third step: apply the minimum intervention needed to achieve stability
- Stabilization actions should be clearly labeled as stabilization, not full recovery — an operator who stabilizes should know they have stabilized, not mistakenly believe they have fully recovered

### 4.2 Safe Rollback Visibility

When an operator needs to undo a recent intervention that contributed to a failure, the rollback action should be clearly identified and its consequences previewed before application.

**Safe rollback requirements:**
- "What would happen if I remove this override?" should be answerable with one tap, showing a PRE preview of the post-rollback state
- Rollback options should be time-ordered: the most recently applied intervention is the most likely rollback candidate
- Rollback should be reversible where possible — "undo the rollback" should be available for N minutes after the rollback is applied
- The effective state before the problematic intervention should be visible, so the operator can evaluate whether rolling back would restore the desired state or reveal a different problem beneath

### 4.3 Operational Reconciliation

After a failure is resolved, the operational record needs to be reconciled — the operator understands what happened, the record reflects it accurately, and any sponsor or compliance impacts are accounted for.

**Reconciliation workflow:**
- Post-resolution prompt: "This incident is resolved. Would you like to document the resolution? [Create incident record]"
- Incident record template: what happened, what was tried, what resolved it, what the impact was
- Sponsor impact reconciliation: if sponsor SOV was affected, a reconciliation record showing the delivery gap with operator notes
- The reconciliation is not mandatory for every minor condition, but should be prompted for any Tier 3+ event

### 4.4 Replay-Assisted Recovery

After a complex failure, operators often need to understand the exact sequence of events before they can confidently declare recovery complete. Replay-assisted recovery uses the deterministic replay capability to reconstruct what happened.

**Replay-assisted recovery workflow:**
- "Investigate what happened" link available after any Tier 3+ event resolution
- Replay pre-loaded to the 30 minutes before the failure began, with the failure's key events annotated
- The operator can step through the event sequence to understand: what triggered the failure, what interventions were applied, what resolved it, and what the operational state was at each moment
- This investigation does not need to happen immediately — it can be deferred to a quieter period

### 4.5 Confidence Rebuilding

After a significant failure, especially one that produced visible customer impact or sponsor contract risk, operators may have reduced confidence in the platform's reliability. This is a rational response to a real event.

**Confidence rebuilding design:**
- Post-recovery period monitoring: for N hours after a significant failure is resolved, the platform runs enhanced monitoring on the recovered scope and provides frequent positive confirmations: "All screens continuing to deliver correctly — [duration] since recovery"
- Recovery trajectory: a visible "clean since" indicator that shows how long the operation has been stable post-recovery
- Root cause communication: if the root cause is identified, communicate it to the operator: "This was caused by [X]. We have [done Y] to prevent recurrence." Operators who understand why something failed have more confidence that it won't fail again.

---

## Section 5 — Failure Escalation Rules

### 5.1 Local vs Regional Escalation

Not every venue-level failure requires escalation to regional or fleet operations. The escalation trigger should be based on:
- Scope: failures affecting only one venue should be handled at the venue level
- Duration: failures that persist beyond a threshold may warrant escalation regardless of scope
- Rate: failures appearing at multiple venues in close succession warrant regional escalation
- Business impact: failures affecting sponsor contracts or causing customer-visible problems warrant faster escalation

**Escalation trigger display:** The platform shows the current escalation status and what would trigger the next escalation level. The operator is not surprised by escalation — they can see it coming.

### 5.2 Containment Threshold Visibility

Containment thresholds are the conditions under which a failure stops being locally manageable and requires higher-authority response. These thresholds should be visible before they are crossed.

**Threshold displays:**
- "At the current rate of override accumulation, this venue will require network operations review in approximately [time]"
- "If this SOV gap is not addressed within [time], the sponsor contract will fall below the remediation threshold"
- "This failure has been active for [duration]. If unresolved in [time], escalation to Venue Manager will be triggered"

Operators who can see approaching thresholds can make better decisions about urgency.

### 5.3 Intervention Authority Transfer

When a failure's scope or severity has exceeded the current operator's authority to resolve, authority must transfer to a higher-level operator. This transfer must be explicit and visible.

**Authority transfer requirements:**
- Transfer is initiated by the current operator, not automatically by the platform — an automatic authority transfer without operator awareness is a governance violation (Engineering Constitution §2.7)
- Transfer shows: who is receiving authority, what they are being asked to handle, what has already been tried
- The receiving operator must accept the transfer before it is complete
- During pending transfer, the current operator retains authority but can see their escalation is pending acceptance

### 5.4 Incident Boundary Management

During a declared incident, the incident boundary defines the scope under incident command. Actions within the boundary are subject to incident governance. Actions outside the boundary are normal operations.

**Incident boundary display:**
- The incident boundary is explicitly displayed: "Incident active — scope: [venues/screens/fleet section]"
- Areas outside the boundary are shown as normal operations, not incident
- When the boundary expands (incident scope grows), the expansion is a distinct event with its own notification
- When the incident is resolved, the boundary is explicitly lifted: "Incident resolved — [scope] returning to normal operations"

---

## Section 6 — Human Factors

### 6.1 Panic Escalation

During operational failures, the human stress response can produce rapid, disproportionate escalation — a single-screen divergence that produces a call to executive management, a minor sponsor gap that produces a venue-wide override, a brief connectivity loss that produces emergency content activation.

Panic escalation is not irrational. It is a predictable response to uncertainty. An operator who doesn't know the scope of a failure, doesn't know if it will spread, and doesn't know what to do experiences genuine panic. The platform's role is to eliminate uncertainty, not to prevent operator emotion.

**Design response:** The most effective anti-panic design is rapid scope confirmation. An operator who can see within 5 seconds that a failure is contained to one screen, is not spreading, and has a clear resolution path will not panic. The containment scope visualization (Section 3.1) is the primary anti-panic instrument.

### 6.2 Blame Propagation

After a failure, there is a natural human tendency to assign blame. In operational settings, blame propagation produces several dangerous behaviors:
- Operators hide failures to avoid blame, making them harder to diagnose
- Operators escalate aggressively to push responsibility elsewhere
- Operators avoid taking recovery actions that might be "wrong" for fear of making things worse

**Design response:** The platform's incident record should be framed as an operational history, not a blame record. Operator actions are recorded for diagnostic purposes, not for performance evaluation (though the platform cannot control how the data is used — it can only control how it presents it). The platform should present operator actions in the context of the information available to them at the time: "Override applied at 8:47 PM — at that time, [context the operator could see]."

### 6.3 Hidden Instability Minimization

Operators may minimize instability to avoid triggering escalation, to protect their own performance record, or to avoid the cognitive cost of addressing a problem they hope will resolve itself. "It's probably fine" is a failure attribution that appears frequently in incident postmortems.

**Design response:** The platform makes it harder to maintain hidden instability than to address it. Advisories that are visible to multiple operators (including supervisors) cannot be privately hidden. Conditions that are visible in the shared operational state cannot be minimized through unilateral operator reassurance.

The design response is not to punish minimization but to make it less possible: when the operational state is visible to appropriate supervisors and colleagues by default, individual operators cannot maintain private assessments of "it's probably fine" for conditions that are observable.

### 6.4 Recovery Fatigue

After a complex or prolonged failure, operators may experience recovery fatigue — a state where the emotional and cognitive cost of the incident has been so high that completing the recovery process fully feels beyond capacity. Recovery steps get skipped, documentation doesn't get written, confidence-rebuilding monitoring gets ignored.

**Design response:** Post-incident recovery steps should be minimal in number and effort. The reconciliation workflow (Section 4.3) should auto-populate as much as possible from the incident record — the operator's role is confirmation and annotation, not reconstruction. Recovery fatigue is the enemy of complete operational recovery; the platform should require as little post-incident effort as possible while maintaining the operational record.

---

## Related Documents

**INTERVENTION-AND-OVERRIDE-UX-v1.md** — Override-specific cascade failures (where an ill-scoped or accumulated override produces collateral suppression) are governed jointly by this document and INTERVENTION-AND-OVERRIDE-UX. These are complementary angles: this document defines how failure scope is visually bounded and communicated (blast-radius visualization, instability scope, stabilization-first recovery, "clean since" confidence rebuilding); INTERVENTION-AND-OVERRIDE-UX defines how individual overrides are created, scoped, aged, and expired — the lifecycle management that, if handled correctly, prevents many of the cascades this document addresses.

---

*End of FAILURE-CONTAINMENT-AND-RECOVERY-UX-v1.md v1.0*
*Authority: Agent 3. Failure detection logic and PRE degradation semantics are Agent 1 domain.*
*Maintained by Agent 3 with Agent 1 review for changes to degraded-state communication requirements.*
