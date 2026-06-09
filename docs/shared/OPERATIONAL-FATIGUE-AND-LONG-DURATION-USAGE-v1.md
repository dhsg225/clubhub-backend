# Operational Fatigue and Long-Duration Usage Specification v1

**Classification:** Implementation-grade operational specification
**Applies to:** All operator roles during extended sessions, overnight operations, long-running incidents
**Governing constraint:** The system surfaces observations. The system never makes a diagnosis. The system never assumes a cause.
**References:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, SHIFT-HANDOFF-AND-CONTINUITY-v1.md

---

## Overview

Operators working extended shifts, overnight operations, or long-running incidents exhibit observable operational patterns that differ from short-session operations. The platform must be survivable under these conditions.

This document defines how the platform behaves. Not how to manage human fatigue.

No wellness language. Only operational survivability.

---

## Fatigue Detection: System-Observable Patterns

The platform observes audit trail events. It does not observe the operator. The following patterns are detectable from the event stream and are surfaced to appropriate observers — not to the operator themselves unless specified.

Every detection rule includes:
- What the system observes (audit trail event type and threshold)
- What the system surfaces (display behavior, recipient)
- What the system never assumes (explicit prohibition on inference)
- Who sees it
- Approved and forbidden behaviors
- Operational consequence of suppression
- Verification method

---

### Pattern FD-01: Extended Session Duration

**Observable:** `session_duration > 8 hours` — session has been continuously active without a new login event for more than 8 hours.

**What the system detects:** Duration of the session token, not operator presence.

**What the system surfaces:**
- System Status Bar session indicator (always visible) shows session duration as HH:MM.
- At 8 hours: session clock color changes from green to amber.
- No banner, no modal, no notification. Color change only.

**What the system never assumes:** The operator is fatigued, impaired, or making errors due to session duration. The operator may have been active for 8 hours doing entirely correct and necessary work.

**Who sees it:**
- The operator: session clock in System Status Bar.
- ADMIN: session clock amber state visible in operator session monitoring list (if implemented).

**Approved behavior:** Session duration visible to operator and ADMIN. No automatic actions. No automatic logout.

**Forbidden behavior:** Auto-logging out an operator because session duration exceeded a threshold. Displaying a warning message to the operator about their session duration. Reducing any notification priority or disabling any action because of session duration.

**Operational consequence of auto-logout:** Operator is ejected during an active incident; incident commander vacated mid-incident; recovery workflow interrupted.

**Verification:** Session clock renders amber when `session_duration > 28800` seconds (8 hours). No other behavior change at this threshold. Automated test: inject 8h session, verify clock renders amber, verify no other UI state changes.

---

### Pattern FD-02: Action Rate Decline

**Observable:** An operator whose audit trail shows > 10 events per hour drops to < 3 events per hour for > 2 consecutive hours.

**What the system detects:** A sustained reduction in event rate for this operator compared to their own prior rate within this session. Not compared to other operators.

**What the system surfaces:** Advisory in ADMIN's operator monitoring view: "Operator [id] — low activity for [N]h [M]m."

**What the system never assumes:** The operator is sleeping, distracted, or incapacitated. The operator may be monitoring without acting — which is correct operational behavior. A venue with no anomalies requires no actions.

**Who sees it:** ADMIN only. Not surfaced to the operator.

**Approved behavior:** ADMIN advisory only. No operator-facing display. ADMIN may choose to check in or schedule a replacement. No platform-initiated action.

**Forbidden behavior:** Displaying this advisory to the operator. Reducing the operator's action permissions because of low activity rate. Using this pattern as evidence of anything.

**Operational consequence of presenting to operator:** Operator interrupted or self-conscious while performing legitimate monitoring work; creates distrust between operator and platform.

**Verification:** Event rate computed from `audit_trail` events filtered by `operator_id` per hour. Advisory threshold configurable in platform settings (default: 2-hour window, < 3 events/hour after prior rate > 10 events/hour). Advisory fires once per 2-hour window, not continuously.

---

### Pattern FD-03: Repeated Verification Skipping

**Observable:** Operator places > 3 advisory-level overrides (Level 1–3) within a 30-minute window without clicking [Preview PRE Resolution] before any of them.

**What the system detects:** The [Preview PRE Resolution] button was not clicked before override submission on 3 or more placements in a rolling 30-minute window.

**What the system surfaces:** After the third placement in the window, the override form for that operator shows a non-blocking inline advisory at the top of the form: "You have placed [N] overrides in the past 30 minutes without previewing PRE resolution. Current resolution: [shows current output inline — level and effective_content]."

The current PRE resolution output is shown inline in the advisory. This is the same information that [Preview PRE Resolution] would show. The operator does not need to click anything to see it.

**What the system never assumes:** The operator is acting incorrectly. Skipping the advisory preview is permitted. The operator may already know the PRE output by other means.

**Who sees it:** The operator, inline on the override form. No ADMIN advisory for this pattern.

**Approved behavior:** Advisory shown after threshold. Override placement not blocked. Advisory shows current PRE output so operator has the information regardless of whether they clicked the button.

**Forbidden behavior:** Blocking override placement for Level 1–3 because the preview was not clicked. Requiring a preview click before submission. Showing this advisory for Level 4–6 overrides (those have their own confirmation mechanics).

**Operational consequence of no advisory:** Advisory-level overrides placed without operator knowing current PRE output; unexpected content resolution; override placement without understanding of effect.

**Verification:** Click event tracking for [Preview PRE Resolution] button per session, per override form instance. Advisory threshold at 3 within 30-minute rolling window. Advisory content includes live PRE resolution output at the moment of form render.

---

### Pattern FD-04: Annotation Absence During Extended Incident

**Observable:** An incident has been active for > 4 hours and no operator annotation has been added to the incident log in the last 2 hours.

**What the system detects:** The timestamp of the most recent annotation event in the incident log exceeds 2 hours ago.

**What the system surfaces:** A system-generated passive event is added to the incident log: "Incident has been active for [N]h [M]m. No operator annotations in the last 2 hours." This event is visible to all operators viewing the incident and is included in evidence packages.

**What the system never assumes:** The incident is abandoned, mismanaged, or the operator is unavailable. The incident may be stable and under active monitoring with nothing to annotate.

**Who sees it:** All operators viewing the incident in Incident Commander Surface.

**Approved behavior:** System annotation added to incident log as an informational event. No blocking behavior. No notification. No escalation.

**Forbidden behavior:** Auto-escalating incident severity because annotation is absent. Auto-notifying ADMIN because of annotation absence. Treating absence of annotation as evidence of operator non-performance.

**Operational consequence of no system annotation:** Incident log contains a 2-hour gap with no record of what was happening; post-incident audit cannot establish a timeline of attention.

**Verification:** Background job checks active incidents with `severity >= S2` every 15 minutes. If `last_annotation_at < now() - 2 hours` AND `incident_duration > 4 hours`: insert system event to `incident_log`. Event type: `SYSTEM_CHECKPOINT`. One event per 2-hour gap — does not fire again until a new annotation is added and another 2-hour gap accumulates.

---

## Cognitive Degradation Indicators

The following observable patterns do not indicate cognitive degradation. They indicate operational patterns that carry elevated risk independent of cause. The platform detects and surfaces them without implying causation.

---

### Pattern CDI-01: Modal Abandonment Rate

**Observable:** Operator starts destructive confirmation modals (emergency override, incident declaration, override removal) and cancels them > 3 times in 20 minutes without completing any.

**System behavior:** No display change to the operator. Logged in audit trail as `modal_abandoned` events with `modal_type`, `operator_id`, and `timestamp`.

**Supervisory visibility:** ADMIN advisory after 3 abandonments within 20 minutes: "Operator [id] has started and cancelled [N] high-stakes actions in the past 20 minutes."

**What the system never assumes:** The operator is confused, indecisive, or under duress. The operator may be verifying before committing — which is correct behavior. Modal abandonment is not an error.

**Forbidden behavior:** Preventing the operator from continuing to initiate these actions. Disabling modals after abandonment threshold. Presenting the abandonment count to the operator.

**Verification:** `modal_opened` and `modal_cancelled` events tracked per operator session. Advisory threshold: 3 cancellations within 20-minute rolling window. Advisory clears after 20 minutes with no further abandonments.

---

### Pattern CDI-02: Error Recovery Rate

**Observable:** Operator submits a form with validation errors > 3 times for the same form instance.

**System behavior:** After the third failed submission, the form shows a consolidated validation summary at the top of the form. The summary lists all current validation errors in a single block above the form fields, not just inline next to each field. This supplements the inline errors — it does not replace them.

**What the system never assumes:** The operator does not understand the form. The operator may be testing boundary conditions or entering complex data across multiple attempts.

**Forbidden behavior:** Locking the operator out of the form after repeated failures. Adding a wait period between submission attempts. Presenting a "are you sure you want to continue?" challenge after failed attempts.

**Verification:** Validation attempt tracking per form instance (keyed by form_type + form_instance_id). Summary display at 3 failures within the same form instance. Summary shows all current validation errors, not historical ones.

---

### Pattern CDI-03: Repeated Replay Navigation

**Observable:** Operator opens and closes the same replay timeframe (same `venue_id + time_range`) > 5 times within 30 minutes.

**System behavior:** On the sixth open of the same timeframe within the window, the Replay & Forensics workspace header shows: "You have opened this timeframe [N] times today. Your annotations from previous sessions: [count]. [View annotations]."

The annotation list (if non-empty) is accessible via the [View annotations] link, which opens the annotations panel pre-filtered to this time range and operator.

**What the system never assumes:** The operator is confused. The operator may be cross-referencing this timeframe with other data sources, or navigating repeatedly for operational reasons.

**Forbidden behavior:** Preventing the replay session from opening due to repeated access. Adding a confirmation prompt before opening a frequently-accessed timeframe. Notifying ADMIN of repeated replay access.

**Verification:** Replay session scope tracking per `operator_id + venue_id + time_range_hash` within a 30-minute rolling window. Message shown on 6th open within window. Does not repeat after shown — shown once per 30-minute window.

---

## Attention Collapse Patterns

These patterns detect conditions where the platform has generated signals but the operator has not engaged with them. The platform surfaces the gap. It does not act on it.

---

### Pattern AC-01: Acknowledged-But-Not-Acted

**Observable:** Operator acknowledges Level 2 or higher incident notifications for > 3 distinct incidents without navigating to any of them within 15 minutes.

**What the system detects:** `notification_acknowledged` events without corresponding `surface_navigation` events to the incident within a 15-minute window.

**System behavior:** Zone A Pane A2 (Active Incidents) shows a count badge with distinct styling: "[N] acknowledged, not viewed." Non-blocking. Badge is a link — clicking navigates to the first unviewed acknowledged incident.

**ADMIN advisory:** ADMIN operator monitoring shows: "Operator [id] — [N] acknowledged incidents not viewed."

**What the system never assumes:** The operator is overwhelmed. The operator may be deliberately prioritizing and will navigate when ready. Acknowledgment is an intentional action — the operator has seen the notification.

**Forbidden behavior:** Auto-navigating the operator to incident views. Escalating incidents to ADMIN because the acknowledging operator has not viewed them. Removing the operator as assignee.

**Verification:** `notification_acknowledged` event tracking per operator session. Navigation event tracking per incident. Badge shown when acknowledged count minus navigated count > 3, persisting for > 15 minutes.

---

### Pattern AC-02: Zone C Ignored During Elevated Constitutional State

**Observable:** Constitutional state is DEGRADED or CONSTITUTIONAL_RISK for > 30 minutes and Zone C Pane C4 has not been opened by any operator with access during that period.

**System behavior:** After 30 minutes, Pane C4 header in Zone C pulses once — a single CSS animation cycle, not looping. The pulse completes in approximately 2 seconds. No repeat until the state is resolved and re-enters an elevated condition.

**What the system never assumes:** The operator does not know the state is elevated. The System Status Bar always shows the constitutional state badge regardless of Zone C activity. Operators may be deliberately prioritizing other actions.

**Forbidden behavior:** Continuous pulsing animation. Banner or modal interruption. Reducing operator permissions because Zone C was not opened. Notifying ADMIN because Zone C was not opened within 30 minutes.

**Operational consequence of continuous animation:** Attention capture degrades over time; after repeated exposure the animation loses signal value entirely; operators train themselves to ignore it.

**Verification:** Zone C Pane C4 open event tracking. Constitutional state duration tracking. Single pulse animation triggered once at 30-minute threshold. Animation fires again only if: constitutional state returns to HEALTHY, then re-enters DEGRADED/CONSTITUTIONAL_RISK for a new 30-minute window.

---

## Repetitive-Task Drift

Operators performing high-volume repetitive tasks — approving a queue of similar schedule changes, placing the same override type repeatedly — are at risk of approval drift: approving without reviewing.

### Platform Mitigation: Approval Queue Drift

**Trigger:** Operator approves > 10 items from the same submitter within a 2-hour rolling window.

**System behavior:** Item 11 and subsequent items in the approval queue from that same submitter show a subtle visual separator above the item: "You have approved [N] items from [submitter_id] in the past 2 hours. This item: [item summary — type, target venue, description]."

The summary shows the key fields of this specific item. It forces a brief content engagement before the approval button is active. The approval button is enabled after the summary has been visible for 3 seconds (not a click requirement — time-based only).

No additional confirmation required. No blocking. No ADMIN notification.

**Approved behavior:** Visual separator with item summary shown. 3-second display before approval button active. Approval proceeds normally.

**Forbidden behavior:** Blocking approval because of high approval rate. Requiring a second click or confirmation beyond normal approval flow. Notifying ADMIN that an operator is approving at high rate (high approval rate may be entirely correct during planned content pushes).

**Operational consequence of no mitigation:** Schedule changes approved without review during high-volume periods; errors in a content push pass through undetected.

**Verification:** Approval count tracking per `(submitter_id, approver_id)` per 2-hour window. Visual separator renders at count > 10. 3-second timer tracked client-side with server-side flag `approval_display_time_elapsed = true` required before approval accepted.

---

### Platform Mitigation: Approval Without Preview Flag

**Trigger:** Operator approves an approval queue item without having clicked [Preview PRE Resolution] for that specific item.

**System behavior:** Approval record includes `approval_without_preview_viewed = true` flag. No blocking. No message to the operator. Available in audit trail for supervisor review.

**Approved behavior:** Approval proceeds. Flag recorded.

**Forbidden behavior:** Blocking approval because preview was not viewed. Displaying a warning to the operator at approval time.

**Operational consequence of no flag:** Supervisors cannot identify which approvals were made without PRE preview review; cannot assess approval quality patterns over time.

**Verification:** Preview click event tracked per approval queue item instance. If approval submitted without preceding preview click event: `approval_without_preview_viewed = true` stored in approval record.

---

## Long-Running Incidents

An incident active for > 8 hours presents distinct operational challenges. The platform addresses these with informational surfaces and advisories. No automatic escalation, no automatic handoff.

### Extended Incident Timeline Marker

**Trigger:** `incident_duration > 8 hours`.

**Display:** Incident timeline in IC-LEFT shows a horizontal rule with label "EXTENDED INCIDENT — active [N]h [M]m." rendered in amber, positioned at the 8-hour mark in the timeline. Updated every 30 minutes: label changes to current duration.

**Approved behavior:** Informational only. No behavioral change.

**Forbidden behavior:** Changing incident severity because duration exceeded 8 hours. Auto-escalating to ADMIN.

---

### Command Relief Advisory

**Trigger:** Same `commander_id` on incident for > 12 hours.

**Display:** IC-TOP shows amber text: "Incident command held for [N]h. Consider command handoff." Dismissible by commander with [Dismiss] control.

**Recurrence:** After dismissal, does not reappear for 4 hours. After 4 hours, shown again once. Cycle: show → dismiss → 4h → show → dismiss → repeat.

**Approved behavior:** Advisory shown to incident commander. Dismissible. No automatic action.

**Forbidden behavior:** Mandating command handoff. Transferring command automatically after duration threshold. Notifying ADMIN that commander has held command for > 12 hours. Preventing commander from dismissing the advisory.

**Operational consequence of mandate:** Active commander ejected from incident during critical phase because of duration alone.

**Verification:** `commander_assigned_at` timestamp on incident record. IC-TOP advisory triggered at `now() - commander_assigned_at > 43200 seconds` (12 hours). Dismissal record per `(incident_id, commander_id, interval)`. 4-hour recurrence tested with time-injection.

---

### Automatic Evidence Package Checkpoint

**Trigger:** `incident_duration >= 8 hours`.

**System behavior:** Platform background job creates a time-stamped evidence package preserving the incident investigation state at the 8-hour mark: incident record, override stack, PRE resolution trace, all annotations, all linked replay session references, current corpus state reference. Package is accessible to ADMIN via [Evidence Packages] in the incident detail view.

**Not surfaced to operators unless accessed.** No notification. No display change.

**Approved behavior:** Background package creation. ADMIN accessible.

**Forbidden behavior:** Surfacing this package creation to operators as a notification. Treating package creation as an escalation signal.

**Verification:** Background job runs every hour, checks active incidents. Creates package if `incident_duration >= 8 hours` and no 8-hour package exists for this incident. Package `created_at` and `content_hash` recorded.

---

### PRE Verification Pulse

**Trigger:** Active incident with `severity >= S3`, incident duration > 0.

**System behavior:** Every 2 hours from incident declaration, the system inserts a verification event into the incident log: "PRE verification pulse — current resolution level: [N], effective_content: [content_id], constitutional state: [state], timestamp: [governed_timestamp]."

Event type: `SYSTEM_PRE_PULSE`. Visible to all operators in the incident log.

**Rationale:** Ensures the incident log contains regular platform state checkpoints even when no operator is actively annotating. Post-incident review can establish what PRE was doing at 2-hour intervals throughout the incident.

**Approved behavior:** System event inserted every 2 hours. Visible in incident log.

**Forbidden behavior:** Suppressing the PRE pulse because the constitutional state is HEALTHY. Treating absence of a PRE pulse as a system error. Using PRE pulse events as a substitute for operator annotations.

**Verification:** Background job tracks last `SYSTEM_PRE_PULSE` event per incident. Inserts new event if `now() - last_pulse_at > 7200 seconds` (2 hours) and incident is active.

---

## Overnight Operations

Overnight operations (00:00–06:00 local time, platform active, human operators present) have no constitutional distinction. The platform does not change behavior based on time of day. Time of day is not operationally relevant to platform correctness.

**No changes during overnight operation:**
- No "night mode" or reduced-brightness UI
- No reduced notification priority
- No suppressed alerts
- No reduced audit trail verbosity
- No special session handling

Organizational realities of overnight operation (reduced staffing, longer escalation response times) are addressed through the handoff and continuity mechanisms defined in SHIFT-HANDOFF-AND-CONTINUITY-v1.md. The platform itself does not compensate for staffing levels.

---

## What the System Never Assumes

These prohibitions are absolute. No future feature, optimization, or "helpfulness" improvement may violate them.

1. **The system never assumes an operator is unavailable because they are not interacting with the platform.** Monitoring and waiting are legitimate operational behaviors. Low event rate does not mean absence.

2. **The system never assumes an operator is fatigued because their session is long.** Session duration is observable. Fatigue is not.

3. **The system never assumes an operator made an error because they abandoned a modal.** Modal abandonment is correct behavior before high-stakes actions. The platform encourages deliberate commitment, not fast commitment.

4. **The system never assumes an incident is under control because it has been active without state changes.** Stable incident state may mean active monitoring, not inattention.

5. **The system never assumes an operator understands the current platform state.** The platform surfaces current state on demand at all times. State is never assumed known — it is always available.

6. **The system never reduces notification priority based on perceived operator saturation.** A Level 3 incident notification at hour 10 of a session is delivered with the same signal characteristics as at hour 1.

7. **The system never assumes a cause for any observable pattern.** Every detection produces an observation. Zero detections produce diagnoses.
