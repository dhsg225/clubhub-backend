# ClubHub TV — Attention Economics and Signal Priority
# Shared Operational Intelligence Layer

**Document type:** UX governance — attention management architecture
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** UX contributors, frontend engineers, operational system designers
**Last updated:** 2026-05-23
**Status:** CANONICAL — governs all alert, notification, and signal design

---

## Purpose

This document defines how the ClubHub TV platform earns, preserves, and manages human attention as an operational resource. It governs every signal, alert, advisory, notification, and status indicator the platform surfaces to operators.

The threat this document addresses: signal inflation. Every system that can generate alerts will generate too many. Teams add indicators for good reasons. Each addition seems modest. The cumulative effect is a platform where everything appears important, operators learn to ignore everything, and the one genuinely critical signal is lost in the noise.

This is not a theoretical risk. It is the documented failure mode of every large operational system that begins with good intentions and ends with operators who have habituated to alerts the way residents habituate to street noise.

**The governing principle: the platform earns attention. It does not demand it.**

---

## Section 1 — Attention Philosophy

### 1.1 Attention Is a Finite Operational Resource

Human attention during operations is finite, depletable, and non-renewable within a shift. An operator working a busy event has a fixed budget of focused attention. Every signal the platform sends consumes a portion of that budget. Signals that consume attention without delivering operational value are not merely wasteful — they actively impair the operator's ability to process the signals that matter.

This is not a user experience preference. It is a human factors reality. An operator who has spent four hours processing moderate-urgency alerts will have diminished response quality when a genuine emergency occurs. The platform's signal design choices directly affect operational safety.

**Operational consequence:** Every signal the platform surfaces must earn its right to exist by providing value proportional to the attention it consumes. Advisory signals that operators routinely ignore without consequence should be redesigned or removed.

### 1.2 Signal Credibility Is a Shared Resource

Every time the platform generates an alert that does not require operator action, it depletes signal credibility — not just for that alert type, but for all alerts. Operators do not evaluate each alert in isolation. They develop a prior distribution about what the platform's alerts mean. A platform that cries wolf trains operators to expect wolves that don't arrive, which produces precisely the attention failure mode that makes real emergencies dangerous.

**Signal credibility is a commons.** Individual teams requesting "just one more advisory" are each making a locally reasonable request while collectively destroying the shared resource.

Governance rule: new signal types require explicit justification for why they will not degrade existing signal credibility.

### 1.3 Operational Silence Is a Feature

The absence of alerts, when the system is healthy, is meaningful operational information. It communicates: "Nothing requires your attention right now." This signal — operational silence — has value only if the platform has maintained the discipline to not interrupt when interruption is unwarranted.

A platform that continuously generates low-urgency ambient noise cannot communicate operational silence. The absence of alerts from a noisy platform means nothing. The absence of alerts from a credibly disciplined platform means the operation is running cleanly.

**Design principle:** Design for silence as the operational default. Signals are exceptions. The question is not "what should we show?" but "what is the minimum this operator needs to know to maintain awareness?"

### 1.4 Why Alert Inflation Destroys Trust

Alert inflation follows a predictable sequence:
1. Team adds advisory for a real condition worth knowing
2. Advisory fires frequently, often in non-actionable contexts
3. Operators begin ignoring the advisory by pattern recognition
4. Advisory becomes visual wallpaper
5. A genuine instance of the advisory occurs requiring action
6. Operator misses it because it blends with the wallpaper
7. Operational failure occurs
8. Postmortem concludes the alert was present but not acted upon

This sequence does not indicate operator failure. It indicates platform design failure. The platform created the conditions that made the miss predictable.

**Alert inflation is a platform safety issue, not a training issue.**

---

## Section 2 — Signal Tiers

Five signal tiers govern all platform-generated signals. Each tier has defined characteristics, display behavior, interruption authority, and attention cost.

### Tier 0 — Operational Silence

**What it is:** The absence of active signals. The system is within normal operating parameters. No operator action is required or beneficial.

**Display behavior:** No alert indicators. Status indicators show normal state. Background operational data visible through normal workspace access.

**Interruption authority:** None. The platform does not interrupt an operator during Tier 0 for any reason.

**Attention cost:** Zero.

**Governing rule:** Tier 0 is the target state. Platform design should minimize time spent outside Tier 0 for any individual signal type.

---

### Tier 1 — Ambient Informational Signals

**What it is:** Background operational awareness data. Metrics, trends, and state information that is useful to an operator who chooses to look but does not require action.

**Examples:** Campaign delivery rate at 97% (healthy). Override aging distribution (no anomaly). SOV trending within contracted range. Entropy grade A or B.

**Display behavior:** Available in dedicated information panels and workspace sections. Does not appear in primary operational status. No color urgency treatment beyond normal informational styling. Does not count toward active alert load.

**Interruption authority:** None. Never interrupts. Never pulses, flashes, or produces motion to attract attention. The operator accesses Tier 1 information; Tier 1 information does not reach for the operator.

**Attention cost:** Near-zero when accessed. Zero when not accessed.

**Governing rule:** The majority of operational data should be Tier 1. Metrics that are informational should stay informational. The temptation to escalate informational data to actionable status because it "feels important" is the primary driver of signal inflation.

---

### Tier 2 — Actionable Operational Signals

**What it is:** A condition that warrants operator awareness and may benefit from action, but does not require immediate intervention. The operation continues safely without immediate response.

**Examples:** Override aging past 30 days without review. Campaign orphaned after schedule archive. SOV drifting outside configured range. Entropy grade dropping from B to C. Screen that has not reported delivery in 2 hours.

**Display behavior:** Visible in relevant workspace section. Advisory badge or indicator on the relevant operational area. Amber color treatment. Does not interrupt current operator task. Surfaces when the operator navigates to the relevant area.

**Interruption authority:** No active interruption. However, these signals accumulate in a visible advisory count that operators may review. An advisory count above a threshold may surface a summary in the primary workspace, but the summary does not interrupt — it is visible when the operator looks.

**Attention cost:** Low. Operator reviews on their own schedule.

**Governing rule:** Tier 2 is the correct home for the majority of entropy advisories. Most entropy conditions do not require immediate action — they require eventual awareness and voluntary prioritization.

---

### Tier 3 — Intervention-Required Signals

**What it is:** A condition that requires operator action within the current operational period. The operation faces risk if the condition is not addressed. However, the risk is not immediate or catastrophic.

**Examples:** Sponsor SOV falling below contracted floor with campaign running. Override collision detected that will cause incorrect content delivery at a scheduled time. Screen enrollment failure on a venue device. Configuration gap creating schedule void in the next 4 hours.

**Display behavior:** Surfaces actively in the primary operational status view. Amber-to-red color treatment depending on urgency. May produce a single notification if the operator is in a different workspace section. Does not repeat the notification until a new triggering event.

**Interruption authority:** One notification. Does not repeat. Does not escalate until the underlying condition worsens to Tier 4. Operator acknowledgment clears the notification (does not clear the underlying condition — that requires action).

**Attention cost:** Moderate. Operator should review within the current hour.

**Governing rule:** Tier 3 signals should be rare enough that operators treat them as genuinely important. If Tier 3 fires multiple times per shift as a baseline, the threshold is too low and should be recalibrated.

---

### Tier 4 — Escalation Signals

**What it is:** A condition requiring urgent action. The operation is being actively harmed or is on the verge of failure. Operator attention is required now.

**Examples:** Emergency content activation failure. Sponsor content not delivering when contracted. Screen unresponsive with active event running. Network degradation affecting fleet delivery. Override applied at incorrect scope causing fleet-wide content failure.

**Display behavior:** Active escalation in primary operational status. Red treatment. Persistent notification until acknowledged. Prominent in all workspace views. Does not scroll out of view.

**Interruption authority:** Active interruption once, with re-interruption on escalation. Sound notification permitted (if operator notifications are enabled). Escalation timer shows time since signal generated.

**Attention cost:** High. Operator is expected to respond within minutes.

**Governing rule:** Tier 4 must remain rare. In a healthy operation, Tier 4 fires at most a few times per month per venue. If Tier 4 fires frequently, it indicates either an operational problem requiring root cause resolution, or incorrect threshold calibration requiring recalibration.

---

### Tier 5 — Incident-Critical Signals

**What it is:** Active incident. Operational failure in progress. Fleet-level or safety-level event.

**Examples:** Emergency content failure across multiple venues. Compliance-required content not delivering during regulatory window. Catastrophic manifest failure causing screen content loss.

**Display behavior:** Full incident mode. Incident banner in all workspaces. All other signals subordinated to the incident signal. Clear incident ownership and escalation status. Red + persistent.

**Interruption authority:** Maximum. Incident is visible in all platform surfaces. All operators working in the system see the incident state. Cannot be cleared without explicit incident resolution.

**Attention cost:** Full. All available operator attention should be focused on the incident.

**Governing rule:** Tier 5 requires immediate platform-level response. Every Tier 5 event should have a postmortem. Tier 5 must never be normalized.

---

## Section 3 — Signal Credibility System

### 3.1 The False-Positive Problem

A false positive in operational signaling is any signal that fires but does not require operator response. False positives are not just wasteful — they are credibility-destroying. An operator who responds to a Tier 3 signal and discovers it does not actually require action has learned: "Tier 3 does not necessarily require action." Their response threshold for the next Tier 3 signal is now higher. After several such experiences, Tier 3 is effectively demoted to Tier 2 in the operator's cognitive model — even if the platform still treats it as Tier 3.

**This is habituation.** It cannot be undone by training. It can only be prevented by maintaining signal discipline.

### 3.2 False-Positive Tolerance by Tier

Different tiers have different false-positive tolerance:

| Tier | Name | False-Positive Tolerance | Consequence of Excess |
|------|------|--------------------------|----------------------|
| Tier 1 | Ambient | High | Minor — operator learns to not engage |
| Tier 2 | Actionable | Moderate | Advisories accumulate without review |
| Tier 3 | Intervention-Required | Low | Operators begin deferring Tier 3 review |
| Tier 4 | Escalation | Very Low | Operators treat Tier 4 as "probably not urgent" |
| Tier 5 | Incident-Critical | Zero | Incident response credibility collapses |

**Signal credibility degrades upward.** When Tier 3 false positives are common, operators de-facto treat Tier 3 as Tier 2. The only available Tier then for genuine urgency is Tier 4 — which then faces elevated false-positive pressure. The inflation propagates.

### 3.3 Stale Warning Blindness

A stale warning is a signal that has persisted unchanged for so long that it has become visual background. Operators have seen it, assessed it, mentally filed it as "known issue, not actionable," and now it registers only as background texture.

**Stale warnings do not protect.** They occupy visual space without delivering protection value. When the condition the warning describes actually requires action, the stale warning is invisible.

Design responses to stale warnings:
- Warnings that have been visible without operator acknowledgment for more than N days should escalate to a summary prompt ("You have 4 advisories older than 30 days")
- Warnings that have not changed state for extended periods should enter a "dormant" visual state that is clearly distinct from an active new advisory
- Operators should be able to explicitly "defer" a warning for a specified period, at which point it will resurface — this is different from dismissal, which would hide it permanently

### 3.4 Escalation Inflation

Escalation inflation occurs when a platform escalates signals upward in tier over time to "get operator attention." This is the operational equivalent of spam. Escalating a Tier 2 advisory to Tier 3 because the operator hasn't addressed it yet does not make the underlying condition more urgent — it trains operators that escalation is not meaningful.

**Signal tier is determined by operational urgency, not operator response time.** The correct response to an unacknowledged Tier 2 advisory is not to promote it to Tier 3. The correct response is to present a "deferred advisories" summary that the operator must consciously acknowledge.

### 3.5 Trust-Preserving Alert Discipline

Alert discipline is the practice of actively maintaining signal credibility over time. It requires:

**Regular calibration reviews:** On a recurring schedule (suggested: monthly), review the false-positive rate for each Tier 3 and Tier 4 signal type. Any signal type with a false-positive rate above threshold should be recalibrated or demoted.

**Signal retirement:** Signals that are no longer actionable should be retired. A signal type that consistently produces stale warnings with no available operator action is providing no value.

**No silent escalation:** Escalation between tiers requires explicit justification and documentation. "We added urgency because operators weren't responding" is not a valid justification — it addresses a symptom, not the cause.

**Operator feedback loops:** Operators should be able to flag a signal as "not actionable in this context." Flagged signals should trigger threshold review, not be ignored.

---

## Section 4 — Attention Budgeting

### 4.1 Simultaneous Signal Limits

The human cognitive system has a limited capacity for simultaneous signal processing. Research in operational environments (aviation, NOC, emergency dispatch) consistently demonstrates that processing quality degrades when the number of simultaneous signals requiring attention exceeds 4–6.

**Platform signal limit targets:**
- Active Tier 4+ signals visible simultaneously: maximum 3 before entering "incident storm" mode
- Active Tier 3 signals visible simultaneously: maximum 7 before triggering summary collapse
- Total advisory count (Tier 2+) without summary collapse: maximum 15

When these limits are exceeded, the platform should not display more signals — it should enter a summary mode that presents the highest-severity items clearly and groups lower-severity items into counts.

**Grouping rules for summary mode:**
- Signals from the same venue group together
- Signals of the same type group together
- Oldest signals surface first within a group
- Group headers show count and maximum severity

### 4.2 Interruption Budgeting

Interruptions are the highest-cost form of attention consumption. An interruption pulls an operator out of a current cognitive task and requires task switching, which carries a cognitive cost independent of the content of the interruption.

**Interruption budget per operator per hour:**
- Normal operations: maximum 2 active interruptions per hour
- Event operations: maximum 4 active interruptions per hour
- Incident operations: interruption budget is suspended — incident takes priority

An "active interruption" is any signal that requires the operator to break their current task to respond. Ambient Tier 1 and passive Tier 2 signals that do not interrupt the current task do not count against the interruption budget.

**Interruption pacing:** If the platform has already interrupted an operator twice in the current hour, a new Tier 3 signal should queue for display in the operator's advisory panel rather than generating a third active interruption — unless the new signal has escalated to Tier 4.

### 4.3 Escalation Pacing

When a platform generates multiple escalating signals in rapid succession, operators cannot process them effectively. Rapid-fire escalation creates "alert storm" conditions where individual signals become unreadable.

**Escalation pacing rules:**
- Tier 3+ signals generated within 60 seconds of each other should be grouped and presented as a single event with multiple components
- Escalation grouping should show: count, venues affected, highest severity, most actionable item first
- Grouped escalations have a single acknowledgment trigger ("Review all 4") that opens the group
- Individual signals within a group can be resolved independently, but the group is not cleared until all members are resolved or deferred

### 4.4 Operator Cognitive Saturation Indicators

The platform can detect early signals of cognitive saturation by observing operator behavior patterns:

**Saturation signals:**
- Acknowledgment rate spike without resolution rate spike (operator pressing acknowledge without addressing the condition)
- Response latency exceeding 2× normal baseline for same signal type
- Repeated acknowledgment of the same signal without action within a single session
- Override creation rate spike without corresponding schedule interaction (operator jumping to overrides as shortcut)

When saturation signals are detected, the platform should:
1. Reduce ambient information density automatically (shift toward minimal display mode)
2. Suppress Tier 2 advisory notifications until the operator explicitly requests them
3. Surface a non-intrusive status indicator: "High activity period — advisory detail available on request"

This is not "the platform hiding information." The information remains accessible. The platform is reducing the push surface and requiring the operator to pull lower-priority information consciously.

---

## Section 5 — Multi-Venue Attention Management

### 5.1 Local vs Systemic Prioritization

Multi-venue operations multiply the potential signal volume. N venues with independent signal generation can produce N× the interruption rate of a single venue. Without explicit multi-venue attention management, an operator managing 10 venues will be in a state of constant alert processing.

**The fundamental question for every multi-venue signal:** Is this a local condition at one venue, or is this a systemic condition affecting multiple venues?

Local conditions: handled at the venue level by venue-assigned operators. Network-level operators see a summary count, not individual alerts.
Systemic conditions: surface at the network level with clear multi-venue scope.

**Routing rules:**
- A signal affecting 1 venue routes to the venue's assigned operator
- A signal affecting 2–4 venues routes to the network operator as a "cluster" signal with venue list
- A signal affecting 5+ venues routes to the network operator as a "fleet" signal with immediate escalation consideration

### 5.2 Fleet-Level Interruption Storms

A fleet-level interruption storm occurs when a systemic condition triggers independent signals at many venues simultaneously. Without storm suppression, this produces a flood of identical or near-identical alerts that cannot be processed individually.

**Storm detection:** If more than 3 venues produce the same signal type within 60 seconds, the platform should:
1. Suppress individual venue signals
2. Generate a single fleet-level signal: "Network-wide [signal type] detected at N venues"
3. Provide a drill-down view showing venue list and individual states
4. Resolve the fleet signal when all constituent venue signals are resolved

**Storm suppression does not hide information.** The drill-down view shows every venue's status. The suppression only changes the interruption surface — from N separate interruptions to 1 fleet-level interruption.

### 5.3 Sponsor Escalation Collisions

During events with multiple sponsors, multiple sponsor-related signals may be generated simultaneously. A venue running 3 sponsor campaigns may generate 3 independent SOV advisories within minutes of each other.

**Sponsor signal collisions** should be grouped by venue and presented as a single "Sponsorship review required" prompt that opens a consolidated sponsorship view for that venue.

Cross-venue sponsor escalation collisions (same sponsor, multiple venues) should be routed to the sponsor operations workspace as a single sponsor-level signal rather than N venue-level signals.

### 5.4 Incident Clustering

When incidents occur at multiple venues simultaneously or in rapid succession, the operator's primary attention management challenge is determining: are these related (systemic) or coincidental (local)?

The platform should support incident clustering analysis:
- Incidents involving the same signal type at multiple venues within a time window surface as "possible systemic event — N venues affected"
- Incidents involving the same content item or campaign across venues surface as "content-related multi-venue event"
- Incidents with no apparent systemic link surface independently

**Clustering is for routing and context — not for automated response.** The operator makes the determination of whether clustered incidents represent a single systemic cause. The platform surfaces the cluster; the operator investigates.

---

## Section 6 — Human Factors

### 6.1 Inattentional Blindness

Inattentional blindness is the failure to notice a clearly visible stimulus because attention is focused elsewhere. It is not a character flaw or a training gap. It is a fundamental property of focused human attention.

In operational settings, inattentional blindness explains why an operator can miss an alert that was "right there on the screen." If the operator is focused on resolving an active incident (Tier 5), they may fail to notice a new Tier 3 signal that appeared during the incident.

**Design responses:**
- During active incidents, new Tier 3+ signals must be surfaced in the incident workspace, not just in their normal workspace location
- Signals that appear during high-focus periods should persist until acknowledged, not time out
- The incident workspace must have a peripheral status indicator showing non-incident signals that have accumulated during the incident

### 6.2 Habituation

Habituation is the decrease in response to a stimulus that occurs with repeated exposure. An operator who sees the same advisory appear and disappear dozens of times will gradually reduce their cognitive engagement with that advisory — regardless of intention.

Habituation cannot be prevented through training or discipline. It is an automatic neural process. The only design response is to ensure that:
1. Signals that habituate are not operationally critical (move critical signals to higher tiers)
2. Signal appearance changes when the underlying state changes, preventing the advisory from looking identical whether the condition is improving or worsening
3. Periodic advisory summaries replace continuously-visible stale advisories

### 6.3 Cognitive Exhaustion

Cognitive exhaustion is the depletion of executive function through sustained high-demand cognitive work. In operational settings, it produces:
- Reduced ability to evaluate options (increased impulsive decision-making)
- Reduced ability to process novel situations (increased template-matching)
- Reduced inhibition of habitual responses (increased reliance on workarounds)
- Reduced ability to maintain complex mental models (tunnel vision)

**The platform cannot prevent cognitive exhaustion.** It can reduce the cognitive load required to maintain operational awareness, leaving more of the operator's available cognitive budget for decisions that require judgment.

**Design responses to cognitive exhaustion:**
- Effective-state-first displays that require minimal interpretation
- Action suggestions that require confirmation rather than generation ("Stop this override?" rather than requiring the operator to determine what action is available)
- Clear visual differentiation between current state and required action

### 6.4 Tunnel Vision During Incidents

During high-stress incidents, operators tend to narrow attentional focus to the immediate problem. This is an adaptive response — focused attention enables faster problem-solving for the primary issue. But it creates a vulnerability: the operator may miss collateral issues developing in peripheral areas.

**Design responses to incident tunnel vision:**
- Incident workspace must include a "peripheral status" panel showing high-level operational health outside the incident scope
- New Tier 4+ signals outside the incident scope must interrupt the incident workspace with a "secondary escalation detected" indicator
- Operators should be able to explicitly request "full status review" during an incident without losing incident context

---

## Related Documents

**ENTROPY-OBSERVABILITY-UX-v1.md** — Entropy signals (venue health grade, override accumulation, SOV delivery drift) are the primary source of Tier 1–2 signals in the attention tier system defined here. For the definition of what each entropy signal means, its visual presentation, the advisory-only philosophy that governs how it is surfaced, and the per-role monitoring cadences, see ENTROPY-OBSERVABILITY-UX-v1.md. These two documents are complementary: this document defines how signals compete for operator attention; ENTROPY-OBSERVABILITY defines what the signals mean and how they should be rendered.

---

*End of ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md v1.0*
*Authority: Agent 3. Signal tier definitions (when signals fire) require Agent 2 coordination.*
*Maintained by Agent 3 with Agent 2 review for threshold calibration changes.*
