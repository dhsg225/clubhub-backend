# Operator Mental Load Profiles

**Version:** 1.0
**Status:** Authoritative
**Scope:** Cognitive ergonomics for all four operator roles managing the ClubHub TV constitutional media system
**Related:** ALERT-FATIGUE-PREVENTION.md, HIGH-TRUST-WORKFLOWS.md, SHIFT-HANDOVER-MODELS.md

---

## Purpose

This document defines what each operator role needs to think about, how often, and how the system must present information to reduce unnecessary cognitive effort without hiding operationally relevant signals. The goal is not to simplify the system — the system has genuine complexity — but to ensure that complexity surfaces only when it is relevant to the operator's current task.

Operators trust systems they can predict. Predictability requires that the system presents information at the right level of abstraction for each role, at the right moment, with a clear action path attached.

---

## 1. VENUE_OPERATOR Cognitive Profile

### Who This Is

A venue operator manages a single venue. They are typically bar staff, venue coordinators, or front-of-house managers who have operational ownership of screens but are not technical users. They are time-pressured, frequently interrupted, and operating in a loud physical environment. They use the operator interface on a tablet or at a venue management terminal between other duties.

They do not need to understand what PRE.resolve() does. They need to know: is the system working, what is playing right now, and what do I do if something is wrong.

### Daily Routine: Start of Shift

At the start of a shift, a venue operator needs to establish their operational baseline. This should require no more than 60 seconds and no more than three interactions:

1. **System health check**: Is the system in a healthy state? Any active alerts?
2. **Today's schedule review**: What is scheduled to play today? Any conflicts or gaps?
3. **Active overrides and expiry check**: Are there any overrides active from a previous shift, and when do they expire?

If all three answers are positive (healthy, schedule loaded, no unexpected overrides), the operator proceeds to normal operations. If any answer is negative, the system surfaces the specific issue with a clear action.

The system must never require the operator to hunt for basic health status. If the operator has to navigate more than two screens to confirm the system is healthy, the information hierarchy has failed.

### Daily Routine: End of Shift

At the end of a shift, a venue operator needs to:

1. **Confirm no unresolved alerts**: Any alerts that arrived during the shift and were not acted on must be visible and acknowledged or handed over explicitly.
2. **Check override expiry within next 8 hours**: Overrides expiring before the next operator shift arrives need to be reviewed — either extended intentionally or confirmed that expiry is acceptable.
3. **Generate handover report**: The system generates a structured summary of shift events for the incoming operator (see SHIFT-HANDOVER-MODELS.md).
4. **Active emergency confirmation**: If any emergency is still active at shift end, the operator must explicitly confirm that the incoming operator has been notified. This is not optional.

### High-Frequency Decisions (Multiple Times Per Shift)

These decisions happen often enough that operators must be able to make them quickly and with minimal friction:

**Jackpot and promotional state**
When the venue has a jackpot draw, promotional event, or special circumstance, the operator may need to confirm that the correct content is playing or adjust the scheduled content temporarily. This is a Level 2 operational decision (scheduled content layer). The operator needs to see: what is currently playing on which screens, whether the active schedule covers this event type, and how to create a short-duration override if needed.

**Specials and menu updates**
Venue operators frequently need to push updated specials content. This requires knowing which screens show food/drinks content, what content is available in the library for that category, and how quickly a published change will appear on screen. The system must give a clear expected propagation time — not "changes are being processed" but a specific expected time.

**Unscheduled schedule gaps**
If a segment has no scheduled content and the system falls back to structural content, the operator may notice this visually (wrong content on screen) before the system flags it. The operator needs to be able to quickly identify which screen is in fallback state and why.

### Low-Frequency, High-Stakes Decisions

These decisions happen rarely but require careful attention. The system must not rush the operator through these flows.

**Triggering an emergency override (Level 0)**
Triggering an emergency override affects all screens immediately and bypasses all other content layers. This is the highest-impact action a venue operator can take. The flow must:
- Require at least one explicit confirmation step
- Show the operator exactly which screens will be affected
- Show what content will appear immediately
- Confirm that the emergency is active within 5 seconds of trigger
- Remain clearly visible in the UI until the emergency is cleared

The flow must not be so cumbersome that operators hesitate to use it in a genuine emergency, but must not be so easy that it is triggered accidentally. A 2-step confirmation (select emergency type, confirm scope) is the appropriate friction level.

**Entropy alert acknowledgment**
When the system reports corpus entropy — content drift or schedule drift beyond advisory thresholds — the venue operator receives a notification. They must decide: acknowledge this as expected (e.g., content was intentionally changed by regional management), escalate to a regional manager, or take action. This decision requires the operator to understand what entropy means in plain terms. The system must not present raw entropy statistics. It must say: "The content for [screen type] has drifted from the expected schedule. [N] items are missing or mismatched. This has been the case for [duration]."

**Creating a non-emergency content override**
Overrides outside Level 0 (emergency) require the operator to specify scope, duration, and content. The stakes are moderate: an override that expires unnoticed can create a content gap. The system must present expiry time prominently during creation and send an expiry warning before the override ends.

### Cognitive Bottlenecks: Where Operators Make Mistakes

**Override expiry management**
The most common venue operator error is forgetting about active overrides. An override set at 11pm expires at 2am — the next shift arrives and the content is wrong with no visible explanation. Mitigation: overrides expiring within 8 hours are surfaced in the handover report; expiry warnings are sent 30 minutes before expiry; overrides expiring during unmanned periods require acknowledgment that expiry is intended.

**Compliance content checking**
If regulatory or contractual compliance requires specific content to run during specific windows (e.g., responsible gambling messages, age-verification content), the operator may not always know what compliance content looks like or when it is supposed to run. Mitigation: compliance content slots are distinctly labeled in the schedule view; missing compliance content triggers a HIGH alert (not just MEDIUM).

**Assuming emergencies clear automatically**
Operators sometimes trigger an emergency, resolve the physical situation, and assume the system returns to normal. It does not. EMERGENCY_FREEZE has no automatic exit; other emergency overrides must be manually cleared. The system must display a persistent "Active Emergency" indicator that does not clear without operator action.

### Information Hierarchy

**Tier 1 — Always Visible (persistent UI chrome)**
No navigation required. Present on every screen the operator sees.

- System constitutional health state: HEALTHY / DEGRADED / CONSTITUTIONAL_RISK / SHADOW_ONLY / PRE_DISABLED / READ_ONLY / EMERGENCY_FREEZE
- Active emergency indicator (if any): type, which screens, who triggered it
- Unresolved alert count by severity: CRITICAL / HIGH badge counts

**Tier 2 — One Click (primary dashboard, first navigation level)**
Accessible from any starting point with one interaction.

- Today's schedule: which content blocks are active, upcoming, or in fallback
- Active campaigns: what is currently live and what is pending review
- Screen status grid: all screens for this venue, health and current state at a glance
- Active overrides: scope, content, expiry time

**Tier 3 — Navigated (secondary views, require intentional navigation)**
Not surfaced until the operator specifically needs them.

- Historical audit log: what played on which screen, when, and why
- Entropy report detail: full drift analysis for this venue
- Parity reports: PRE vs legacy comparison data (rarely relevant to venue operator)
- Canary status: current canary stage and approval history

---

## 2. REGIONAL_MANAGER Cognitive Profile

### Who This Is

A regional manager oversees multiple venues (typically 5–25). They respond to escalations from venue operators, make tactical decisions about content and scheduling, and have authority to approve certain canary stage transitions. They are more comfortable with system dashboards than venue operators but are still operationally rather than technically focused. They are often responding to situations across multiple venues simultaneously.

### Cross-Venue Monitoring

A regional manager's primary cognitive challenge is pattern recognition across venues rather than deep attention to any single venue.

**Entropy across region**: The regional manager needs to see whether entropy is isolated to one venue or spreading across the region. A single venue with CRITICAL entropy may be a local misconfiguration. Three venues with WARNING entropy trending upward is a regional content delivery problem.

**Active emergencies**: Which venues currently have active emergencies, who triggered them, and how long they have been active. A 2-minute emergency at one venue is normal. A 45-minute emergency with no activity is a signal that something went wrong.

**Canary status**: If the system is in canary evaluation (shadow, internal canary, single venue, multi-venue, or fleet-wide promotion stage), the regional manager needs a readable summary: current stage, parity ratio trend, and whether any human approval is pending from them.

### Escalation Decisions

**Entropy acknowledgment vs escalation**
A regional manager receiving an entropy escalation from a venue operator must decide: is this a known content update that was correctly pushed (and the operator just needs reassurance), a local misconfiguration they can fix, or a regional/platform issue requiring escalation to enterprise admin?

The system must support this decision by showing: what changed, when, whether other venues have the same drift pattern, and the severity trend (improving or worsening). The regional manager should be able to answer "is this getting better or worse?" without calculating it themselves.

**Canary stage approval**
When a canary stage transition requires human approval from a regional manager (e.g., SINGLE_VENUE → MULTI_VENUE), the manager needs to see:
- Which venues are currently in the canary evaluation
- The parity ratio at this stage and the trend over time
- Count of CLASS_3 and CLASS_4 divergences (zero is the hard requirement)
- How long the current stage has been running
- The gate threshold that must be met and whether it is met

The decision is: approve promotion, hold for more data, or rollback. All three options must be equally accessible — the system must not default to "approve" in the layout.

### Incident Commander Cognitive State

During a P2 or P3 incident (regional impact), the regional manager is the incident commander. Their cognitive needs shift dramatically:

**Information needs during incident:**
- Scope: how many venues affected, which ones
- Severity: constitutional state of each affected venue
- Timeline: when did this start, is it spreading or contained
- Current actions: what have operators already done, what is in progress
- Communication: who is being notified (enterprise admin, platform admin)

**Interface requirements during incident:**
- The system must not present the same information it presents during normal operations — incident mode requires a different information density
- The most important information is scope and trend (is this getting better or worse)
- The regional manager must be able to see all affected venues in a single view without toggling
- Actions must be clearly elevated: "acknowledge all affected venues", "escalate to enterprise admin", "initiate regional emergency"

**Cognitive load reduction during incidents:**
During a P2/P3, a regional manager is under stress and making consequential decisions with incomplete information. The system must:
- Reduce unnecessary information to the minimum required for the current decision
- Make the "safe" action prominent (if in doubt, escalate rather than resolve)
- Not require the regional manager to remember the state of a venue they navigated away from
- Surface the sequence of events clearly — operators in stressful situations lose temporal track

---

## 3. ENTERPRISE_ADMIN Cognitive Profile

### Who This Is

An enterprise admin governs the full fleet. They make decisions about canary promotion to FLEET_WIDE or AUTHORITATIVE stages, configure governance policies, and respond to constitutional-level events. They are more strategic and less time-pressured than venue or regional operators. They are likely technically literate but are not engineers — they understand concepts like parity and divergence class but do not read source code.

### Fleet Health Dashboard

The enterprise admin's primary view is a single-screen fleet health summary. This screen must answer in under 10 seconds:

- How many venues are HEALTHY vs DEGRADED vs in any other state?
- Is any venue in CONSTITUTIONAL_RISK, READ_ONLY, or EMERGENCY_FREEZE?
- What is the current canary stage, and is any action required?
- Are there any fleet-wide entropy trends (multiple venues trending the same direction)?
- Are there any pending approvals requiring enterprise admin action?

This is a strategic dashboard, not a real-time operations screen. It should show trends over the last 24–72 hours, not just the current moment. An enterprise admin reviewing this dashboard at 9am needs to understand how overnight went, not just what is happening right now.

### Canary Promotion Decision

When a canary stage requires enterprise admin approval (MULTI_VENUE → FLEET_WIDE or FLEET_WIDE → AUTHORITATIVE), the enterprise admin needs to make a consequential governance decision. The system must present all relevant information on a single approval surface — the admin should not need to navigate to five different screens to gather data before deciding.

**Required information for canary promotion approval:**
- Current stage and which stage the approval would advance to
- Parity ratio at current stage: absolute value and 7-day trend
- CLASS_3 divergence count: must be zero for promotion; any non-zero is a hard block
- CLASS_4 divergence count: must be zero; any non-zero means rollback, not promotion
- Number of venues in current stage and how long they have been running
- Shadow comparison volume: how many comparisons have been made at this stage
- Replay determinism status: has nondeterminism been detected at any point in this stage?
- Any active entropy alerts across fleet: are there confounding environmental factors?

**Decision options — all three must be equally prominent:**
- Approve promotion to next stage
- Hold at current stage (collect more data)
- Rollback to previous stage

The approval must require an explicit action (not a default). The enterprise admin's approval token must be recorded and auditable.

### Constitutional Events

When the enterprise admin sees a CONSTITUTIONAL_RISK state for one or more venues, they need to understand what this means and what their role is.

**What CONSTITUTIONAL_RISK means in operational terms:**
The system has detected a CLASS_3 divergence — a case where PRE and the legacy resolver produced meaningfully different results. The system is still operating, but parity has been broken above the tolerance threshold. This state requires review and decision, not panic.

**What the enterprise admin can do:**
- Review the divergence classification and determine whether it is a known acceptable difference or a genuine error
- Consult with PLATFORM_ADMIN if the divergence appears to indicate a constitutional integrity issue
- Decide whether to roll back the canary to a previous stage while investigation happens
- The enterprise admin cannot reset a READ_ONLY or EMERGENCY_FREEZE state — that requires PLATFORM_ADMIN with a human authorization token

**What the enterprise admin cannot do alone:**
- Exit EMERGENCY_FREEZE state (PLATFORM_ADMIN + human token required)
- Reset circuit breakers that have reached OPEN state
- Override the PRE constitutional boundary

---

## 4. PLATFORM_ADMIN Cognitive Profile

### Who This Is

A platform admin is a technically expert operator with constitutional authority over the system. They handle rare, high-severity events: EMERGENCY_FREEZE exit, circuit breaker investigation, constitutional integrity failures. They are not part of normal daily operations. When they are involved, something serious is happening.

Their cognitive challenge is different from other roles: they are called in under stress, must quickly understand an unfamiliar (degraded) system state, and must take carefully considered actions with potentially large consequences.

### Constitutional State Navigation

A platform admin must be able to, within 5 minutes of being summoned, understand:
- What state is the system in and how did it get there?
- What is the exact sequence of events that led to this state?
- What is the blast radius (which venues, which content, which screens are affected)?
- What is the safe first action?

The system must support this through the forensic audit view (full state transition log, circuit breaker event log, and entropy event log — all correlated to a timeline).

### EMERGENCY_FREEZE Exit Procedure

EMERGENCY_FREEZE has no automatic exit. Exiting requires:
1. PLATFORM_ADMIN role authentication
2. A human authorization token (not system-generated — must be a deliberate human action)
3. Explicit confirmation of what state the system will transition to after exit
4. Explicit confirmation that the platform admin accepts accountability for the exit decision

The system must surface: why EMERGENCY_FREEZE was entered, what has been verified since entry, what the transition path is, and what happens next. Platform admins must not feel pressured to rush this process — the system should present no "timeout" or urgency signal on the EMERGENCY_FREEZE exit flow. The freeze is correct until it is correctly resolved.

---

## 5. Load Reduction Design Principles

### Zero-Ambiguity States

The system's constitutional state must never be ambiguous. An operator who looks at the system state indicator must be able to determine, with certainty, which of the eight states the system is in. "Mostly healthy" is not a state. "Appears to be working" is not a state.

If the system is in HEALTHY state, it is unconditionally healthy by the system's own certification. If it is in any other state, that state name is displayed, the reason is accessible in one click, and the primary action is visible.

### Progressive Disclosure

Routine operations are simple. Complexity surfaces only when needed.

A venue operator managing a normal shift sees a simple interface: schedule, screens, alerts. The entropy scoring system, canary parity ratios, and circuit breaker states are not visible because they are not relevant to routine operations. When an entropy alert fires, the relevant information becomes visible in context — not before, and not in a form that requires the operator to understand the full system to interpret it.

### Action Affordance

Every alert has a clear action path attached. An alert that says "something is wrong" without saying what the operator should do has failed its purpose. Every alert must surface:
- What the operator should do first
- What the expected outcome of that action is
- Who to contact if the action doesn't resolve the issue

Alerts without action paths create anxiety without resolution. They drain operator trust.

### Interrupt Minimization

Alerts are categorized by urgency, and operators should not be interrupted unless the urgency warrants it.

| Category | Interrupt Behavior | Response Expectation |
|---|---|---|
| "Act now" (CRITICAL) | Push notification, audio/visual if available | Within minutes |
| "Act today" (HIGH) | Dashboard badge, notification on next login | Within the shift |
| "Act this week" (MEDIUM) | Dashboard badge, no push notification | Within 24–72 hours |
| "For your information" (LOW) | Dashboard indicator, no notification | Review at operator discretion |
| Operational (logged only) | No notification | No response required |

Operators who receive too many interruptions begin to ignore them. The interrupt model must be strict. Misclassifying a MEDIUM alert as CRITICAL to "be safe" is a failure that degrades the alerting system's credibility.

---

## Summary: Mental Load Budget by Role

| Role | Tier 1 (Always Present) | Primary Dashboard Focus | High-Stakes Decision Frequency |
|---|---|---|---|
| VENUE_OPERATOR | System state, active emergency, alert counts | Schedule + screen status | Weekly (emergency, entropy ack) |
| REGIONAL_MANAGER | Multi-venue health aggregate, escalations | Regional entropy trends, canary status | Weekly-Monthly (canary approval, incident command) |
| ENTERPRISE_ADMIN | Fleet health, canary stage, pending approvals | Parity trends, constitutional events | Monthly (canary promotion, constitutional review) |
| PLATFORM_ADMIN | Constitutional state, circuit breakers | Forensic audit, state transition log | Rare (EMERGENCY_FREEZE, circuit breaker investigation) |

The system must calibrate its information presentation to these budgets. Showing an enterprise admin the same screen details as a venue operator wastes their attention. Showing a venue operator raw parity ratios without translation is operationally dishonest — it gives them information they cannot use.
