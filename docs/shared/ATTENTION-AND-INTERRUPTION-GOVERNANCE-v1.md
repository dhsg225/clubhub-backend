# Attention and Interruption Governance v1

**Document class:** Implementation-grade operational specification
**Status:** Authoritative
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, VENUE-OPERATIONS-DASHBOARD-v1.md

---

## Purpose

Operator attention is a constrained resource. The platform competes with the physical environment — venue noise, multiple screens, simultaneous conversations — for operator attention. Interruption governance defines what the platform may render, when it renders it, and how urgently it demands attention. It defines what must never interrupt under any circumstances.

The governing principle: interruption priority must match operational severity. A low-severity notification interrupting an operator during a high-severity investigation costs more than it saves.

This document does not make assumptions about operator cognitive state. It defines observable surface behaviors: what renders, when, and under what conditions.

---

## Interruption Hierarchy

Five interruption levels, ordered from highest to lowest priority. Higher levels always supersede lower levels. A surface implementing Level 2 behavior must not be suppressed by Level 3 behavior currently active.

---

### Level 1 — Constitutional Emergency

**Scope:** Overrides everything. No suppression mechanism exists for this level.

**Trigger conditions:**
- Constitutional state transitions to EMERGENCY_FREEZE, OR
- Constitutional state transitions to PRE_DISABLED.

**Display behavior:**
1. Entire UI bordered in red (4px solid, all four edges, inset against viewport).
2. System Status Bar turns solid red background. Text: "CONSTITUTIONAL EMERGENCY — [state name] — [timestamp]."
3. Any open modal is dismissed immediately. Modal state is lost.
4. Zone B content replaced: if operator is viewing a venue affected by the trigger, Zone B switches to the relevant surface (emergency display for EMERGENCY_FREEZE; incident commander surface for PRE_DISABLED). If operator is viewing an unaffected venue, Zone B switches to fleet constitutional status view.
5. No operator may suppress, dismiss, or minimize this display.

**Who may trigger this level:** SYSTEM only. Triggered by circuit breaker activation or an authorized ADMIN action that intentionally transitions to an emergency state.

**Approved behavior:** Red border and System Status Bar display persists until constitutional state resolves to HEALTHY or a non-emergency degraded state. Display is synchronous — it appears within the same render cycle as the state change event.

**Forbidden behavior:** Any UI mechanism that suppresses, delays, queues, or debounces Level 1 display. This includes: event listener debouncing on constitutional state transitions, z-index layering that occludes the border or Status Bar, CSS animations that delay the border appearance.

**Operational consequence of violation:** Operator is unaware of a constitutional emergency. They may continue taking actions (override placement, schedule changes) that are undefined during EMERGENCY_FREEZE and whose results are undetermined.

**Verification method:** Constitutional state change event triggers a synchronous UI update. The update must complete before any other rendering event in the same frame. Automated test: trigger EMERGENCY_FREEZE via test harness; assert red border appears within one animation frame (16ms); assert System Status Bar background color is red; assert no open modals remain.

---

### Level 2 — Active Incident Declaration

**Scope:** Interrupts current view. Requires operator acknowledgement. Cannot be fully dismissed for S1-S2.

**Trigger conditions:**
- A new incident is declared at S1, S2, S3, S4, or S5 on any venue the operator has access to.

**Display behavior:**

For S4-S5 incidents:
- Notification banner appears in System Status Bar below the constitutional state badge: "[Venue name] — Incident declared — Severity [N] — [View incident]."
- Banner has amber background.
- Banner persists until operator clicks it (acknowledgement) or explicitly dismisses it via [x].

For S1-S3 incidents:
- Notification banner appears (same format) but with red background.
- S3: persists until acknowledged. [x] appears after acknowledgement.
- S1-S2: no [x]. Banner persists until incident reaches CONTAINED state. Cannot be dismissed.

Zone B replacement:
- For S1-S2: if operator is currently viewing the affected venue in Zone B, Zone B replaces with Incident Commander Surface automatically. Zone B replacement for S1-S2 cannot be overridden by operator until incident reaches CONTAINED state.
- For S3-S5: no automatic Zone B replacement. Operator may navigate to Incident Commander Surface via [View incident] link in the banner.

**Approved behavior:** S4-S5 banner dismissed after operator acknowledgement (click or [x]). S3 banner dismissed after acknowledgement. S1-S2 banner persists through full incident lifecycle until CONTAINED. Zone B auto-replacement for S1-S2.

**Forbidden behavior:** Auto-dismissing any incident notification without operator interaction. Allowing S1-S2 banner to be dismissed before CONTAINED state.

**Operational consequence of violation:** Active incident remains unacknowledged. Operator believes no incident is active on a venue they have responsibility for.

**Verification method:** `incident_acknowledged` event logged with `operator_id` and `governed_timestamp` on banner interaction. Automated test: declare incident; assert banner appears in System Status Bar within one second; assert banner does not auto-dismiss after any timeout for S1-S2; assert [x] is absent from S1-S2 banner DOM until CONTAINED state.

---

### Level 3 — State Transition Alert

**Scope:** Banner in System Status Bar. Does not replace Zone B content.

**Trigger conditions:**
- A watched venue changes player machine state: LIVE → OFFLINE, LIVE → DEGRADED, OFFLINE → LIVE, DEGRADED → LIVE, or any other transition involving LIVE, OFFLINE, or DEGRADED.

**Display behavior:**
- Amber banner in System Status Bar below any existing Level 1-2 displays.
- Text: "[Venue name] — [old state] → [new state]."
- [View venue] link navigates to Venue Operations Dashboard for that venue.
- Auto-dismisses after 60 seconds if operator does not interact.
- Operator may dismiss immediately via [x].

**Alert storm threshold:** If more than 5 Level 3 notifications arrive within 60 seconds: individual venue banners are collapsed into a summary banner. See Alert Storm Handling section.

**Approved behavior:** Banner displayed until interaction or 60-second auto-dismiss. Dismissed after operator interaction.

**Forbidden behavior:** Stacking more than 5 simultaneous Level 3 banners in System Status Bar. Each additional banner beyond 5 collapses the set (see Alert Storm Handling).

**Operational consequence of violation:** Operator attention is fragmented across N banners. Status Bar overflows or becomes unreadable. Individual venue states are lost in the visual noise.

**Verification method:** Automated test: trigger 6 simultaneous venue state changes; assert individual banners collapse to summary banner; assert summary banner text includes count. Assert single banners auto-dismiss after 60 seconds with no interaction.

---

### Level 4 — Advisory Alert

**Scope:** Zone C only. No System Status Bar appearance unless explicitly escalated by operator.

**Trigger conditions:**
- Entropy score for a venue exceeds its configured threshold.
- Override accumulation on a venue exceeds 3 active overrides.
- Corpus sync is overdue for a venue.
- Certification expiry approaching (30-day advance warning).
- Any platform condition meeting the "advisory" classification that does not meet Level 3 threshold.

**Display behavior:**
- Zone C Pane C2 (system health indicators) or C4 (certification status) indicator updates with relevant badge.
- If Zone C is collapsed: Zone C tab indicator pulses once (a single animation cycle, not continuous) to signal new advisory content.
- No banner in System Status Bar.
- No toast notification.
- Advisory indicator persists until the condition normalizes.

**Suppression:** Operator collapses Zone C pane or navigates away. This is acceptable — advisory alerts do not demand immediate attention.

**Approved behavior:** Indicator updates in Zone C. Single pulse of Zone C tab if collapsed. Operator sees on next Zone C interaction.

**Forbidden behavior:** Raising an advisory alert to Level 3 or Level 2 without a corresponding change in operational severity. Advisory alerts must never appear in System Status Bar unless the platform has determined that severity threshold for Level 3 has been independently met.

**Operational consequence of violation:** Advisory signals treated as urgent produce alert fatigue. Operators begin ignoring Level 3 banners because they associate them with non-urgent events.

**Verification method:** Assert advisory events produce no System Status Bar appearance. Assert advisory events produce no toast. Assert Zone C pulse occurs at most once per new advisory event (not continuous). Assert advisory indicator clears when condition normalizes.

---

### Level 5 — Background Status Update

**Scope:** Silent. No visible interrupt of any kind.

**Trigger conditions:**
- PRE resolution cycle completed.
- Heartbeat received from player.
- Non-critical metric update (connection latency, sync progress, etc.).
- Any platform event classified as "background" that requires no operator attention.

**Display behavior:**
- Audit Trace Footer updates in place.
- Zone C Panel C1 (Operational Context) updates if pane is open.
- No notification, no animation, no sound.

**Approved behavior:** Data refreshes in place. No visual disruption to operator's current task.

**Forbidden behavior:** Any visual animation, toast, sound, or attention-drawing behavior for Level 5 events. This includes: count badges incrementing with animation, pulsing indicators for heartbeat receipts, progress spinners for routine PRE resolution.

**Operational consequence of violation:** Operator is distracted from the primary task (incident management, investigation, schedule changes) by routine platform activity.

**Verification method:** Assert PRE resolution cycle produces no animation in Zone A, B, or System Status Bar. Assert heartbeat events produce no visual change except data freshness timestamp. Assert no toast appears for Level 5 events.

---

## Notification Priority Table

Notifications are distinct from interruptions. A notification is a persistent record accessible by the operator. An interruption is an immediate attention demand that changes what is rendered.

| Event type | Interruption level | Notification persists? | Dismissible? |
|---|---|---|---|
| EMERGENCY_FREEZE | 1 | Until resolved | No |
| PRE_DISABLED | 1 | Until resolved | No |
| S1 incident declared | 2 | Until CONTAINED | No |
| S2 incident declared | 2 | Until CONTAINED | No |
| S3 incident declared | 2 | Until acknowledged | Yes (after acknowledgement) |
| S4 incident declared | 2 | Until acknowledged | Yes (immediate) |
| S5 incident declared | 2 | Until acknowledged | Yes (immediate) |
| Venue OFFLINE | 3 | Until resolved or dismissed | Yes |
| Venue DEGRADED | 3 | Until resolved or dismissed | Yes |
| Venue LIVE (recovery) | 3 | Auto-dismiss 60s | Yes |
| Entropy threshold exceeded | 4 | Until entropy normalizes | Zone C only |
| Override count > 3 | 4 | Until resolved | Zone C only |
| Certification expiry (30 days) | 4 | Until recertified | Zone C only |
| Corpus sync overdue | 4 | Until synced | Zone C only |
| PRE resolution cycle complete | 5 | No | N/A |
| Heartbeat received | 5 | No | N/A |
| Non-critical metric update | 5 | No | N/A |

---

## Interrupt Suppression Rules

### Rule IS-01: Investigation Focus Protection

**Context:** Operator is in Replay & Forensics workspace, actively investigating a historical state.

**Approved behavior:** Level 3 and Level 4 alerts for venues other than the venue currently being investigated appear only in Zone C during replay sessions. System Status Bar does not show Level 3 banners for non-investigated venues while operator is in a replay session.

**Approved behavior:** Level 1 and Level 2 alerts always interrupt regardless of active replay session. The replay session is not a justification for suppressing constitutional emergencies or new incident declarations.

**Forbidden behavior:** Suppressing Level 1 or Level 2 alerts because the operator is in replay mode. Any implementation that checks "is operator in replay session" before rendering a Level 1 or Level 2 interrupt is prohibited.

**Operational consequence:** Operator in replay mode investigating a historical incident misses a concurrent constitutional emergency. The investigation is about the past; the emergency is now.

**Verification method:** In replay mode, trigger a Level 1 constitutional state change. Assert red border appears and System Status Bar changes within one render cycle regardless of replay state. Assert replay session remains open (not destroyed by the interrupt). Assert Level 3 banner for a non-investigated venue does not appear in System Status Bar during replay.

---

### Rule IS-02: Training Mode Isolation

**Context:** Operator is in Training mode (sandboxed environment — no production data visible, no production actions possible).

**Approved behavior:** Operator in Training mode receives no Level 2, 3, or 4 interruptions from production events. Training mode is fully sandboxed from production notification streams.

**Approved behavior:** Level 1 constitutional emergency displays even in Training mode. The System Status Bar Level 1 display is not sandboxed — it reflects actual constitutional state.

**Forbidden behavior:** Hiding Level 1 alerts on the grounds that the operator is in a non-production mode.

**Operational consequence:** An operator in a training session is unaware that the production platform has entered a constitutional emergency while they are onboarding. They cannot respond until they exit training mode.

**Verification method:** In Training mode, trigger EMERGENCY_FREEZE. Assert System Status Bar Level 1 display appears. Assert no production incident notifications (Level 2, 3, 4) appear. Assert Training mode banner remains visible alongside Level 1 display.

---

### Rule IS-03: Incident Commander Focus

**Context:** Operator is managing an S1 or S2 incident in Incident Commander Surface.

**Approved behavior:** Level 3 banners from other venues are suppressed in System Status Bar during active S1-S2 incident management. Those venues' state changes are silently reflected in Zone A Venue Selector badge updates instead.

**Approved behavior:** If a second S1 or S2 incident is declared on a different venue while operator is managing the first, a Level 2 interrupt occurs with "[New venue] — New S1/S2 incident — [View]" banner that cannot be suppressed. This banner includes a [Switch to incident] link.

**Forbidden behavior:** Suppressing a new S1 or S2 incident declaration on any venue because the operator is already managing a different S1 or S2 incident.

**Operational consequence:** A second constitutional emergency goes undetected because the operator is absorbed in the first. The platform has a responsibility to surface both.

**Verification method:** While operator is on Incident Commander Surface for an S1 incident, declare a second S1 incident on a different venue. Assert Level 2 banner appears with [Switch to incident] link. Assert the banner is not suppressed. Assert Level 3 banners for non-S1/S2 events on other venues do not appear in System Status Bar during this period.

---

### Rule IS-04: Modal Integrity

**Context:** Operator is completing a confirmation modal for a destructive action (emergency override confirmation, incident resolution, freeze resolution, recovery attestation).

**Approved behavior:** Level 3 and Level 4 notifications do not interrupt an operator during a confirmation modal. The modal completes or is explicitly cancelled. No notification banner displaces modal context or disrupts the operator's view of the confirmation content.

**Approved behavior:** Level 1 and Level 2 interruptions dismiss open modals. Modal state is lost. The platform surfaces the emergency. The operator must re-initiate the modal after the emergency is addressed.

**Forbidden behavior:** Allowing a destructive confirmation modal to complete during a Level 1 interrupt. If EMERGENCY_FREEZE is active, new destructive modals must not be openable. If a modal is already open when Level 1 fires, the modal is dismissed.

**Operational consequence:** An operator completing a destructive action (such as a Level 6 override removal) during an EMERGENCY_FREEZE is committing an action in an undefined system state. The consequences of that action are unpredictable.

**Verification method:** Open a destructive confirmation modal. Trigger Level 1 constitutional state change. Assert modal is dismissed within one render cycle. Assert EMERGENCY_FREEZE prohibits opening new destructive modals (modal trigger buttons are disabled). Assert Level 3 notifications during modal completion do not cause modal to dismiss or reposition.

---

## Alert Storm Handling

An alert storm is a surge of Level 3 notifications that, if individually displayed, would make the System Status Bar unreadable and fragment operator attention across more venues than any individual can track.

**Detection threshold:** More than 5 Level 3 notifications arrive within any 60-second rolling window.

**Behavior on threshold breach:**

1. All pending individual Level 3 venue banners are collapsed immediately. No queuing of additional individual banners while storm is active.
2. A single summary banner replaces them: "[N] venues changed state — [View Fleet Summary]."
3. [View Fleet Summary] link opens Zone B in Fleet Summary view: a list of all affected venues, their prior state, and their new state, sorted by severity (OFFLINE first, then DEGRADED, then state recoveries).
4. Zone A Venue Selector refreshes to show all affected venues with updated state badges.
5. No individual venue Level 3 banners appear for the duration of the storm.

**Storm resolution:** When fewer than 3 new Level 3 notifications arrive in any 60-second window (three consecutive clean windows): individual venue banners resume for new state changes.

**Storm duration tracking:** Storm start and end timestamps are logged as `ALERT_STORM_STARTED` and `ALERT_STORM_RESOLVED` events with `venues_affected_count` and `duration_ms`.

**Approved behavior:** Single summary banner. Fleet Summary view accessible. Zone A badges updated. Individual banners suppressed during storm.

**Forbidden behavior:** Displaying more than 5 simultaneous individual Level 3 banners in System Status Bar at any time. This is an absolute ceiling — not a soft limit.

**Operational consequence:** An operator presented with 20 or more simultaneous venue banners cannot act on any of them effectively. The System Status Bar overflows. The operator has no path to triage.

**Verification method:** Trigger 10 simultaneous venue state changes in test harness. Assert System Status Bar shows exactly one summary banner (not 10 individual banners). Assert Fleet Summary view shows all 10 venues. Assert storm resolved event is logged after storm subsides.

---

## Focus Protection Rules

### Rule FP-01: Long-Form Input Protection

**Context:** Operator has an active form open. Active forms are defined as: incident declaration form, override placement form, schedule block form, recovery workflow step, annotation field with at least one character entered.

**Approved behavior:** While a form is in active input state (defined as: the form is open AND at least one field has been interacted with), Level 4 advisory alerts do not animate or pulse. Zone C tab does not pulse. Advisory indicators update silently in the background.

**Forbidden behavior:** Zone C pulsing, animating, or otherwise drawing visual attention during active form input.

**Operational consequence:** Operator makes a data entry error — wrong content_ref, wrong scope, wrong expiry — because a visual animation broke their focus during the input sequence.

**Verification method:** Open an override placement form. Enter text in the reason field. Trigger a Level 4 advisory event. Assert Zone C tab does not pulse. Assert no animation occurs anywhere in the UI. Assert Zone C indicator updates silently (data refresh without animation).

---

### Rule FP-02: Confirmation Modal Completeness

**Context:** Destructive action confirmation modals (Level 6 override, incident resolution, corpus re-enrollment authorization, emergency handoff acceptance).

**Approved behavior:** A started confirmation modal must be completed by the operator ([Confirm] click) or explicitly cancelled ([Cancel] click). The platform does not auto-dismiss confirmation modals after any timeout.

**Approved behavior:** [Cancel] is always available and functional in any confirmation modal (except when a Level 1 interrupt has already dismissed the modal — in that case the modal no longer exists).

**Forbidden behavior:** Auto-dismissing a destructive action confirmation modal after any timeout period. Adding a countdown timer that auto-cancels or auto-confirms.

**Operational consequence:** If auto-dismiss cancels: operator assumes the action was committed and does not re-attempt — a silent non-action. If auto-dismiss confirms: operator has committed a destructive action they did not intend.

**Verification method:** Open a Level 6 override removal confirmation modal. Wait 10 minutes without interacting. Assert modal is still present and functional. Assert [Cancel] is still available. Assert no auto-dismiss occurs.

---

### Rule FP-03: Replay Timeline Scroll

**Context:** Operator is scrolling the replay timeline in Replay & Forensics workspace.

**Approved behavior:** Operator scrolling the replay timeline does not trigger visible state changes in Zone A (Venue Selector) or Zone C (Operational Context). Zone A continues to display LIVE state for all venues (not the state at the replay cursor position). Zone C displays current live advisory state (not replay-time advisory state).

**Forbidden behavior:** Zone A venue state badges updating reactively as the operator scrolls the replay timeline. Zone A is a LIVE-only surface. It must not become a replay-time display under any circumstances.

**Operational consequence:** Zone A appears to show OFFLINE for a venue because the operator scrolled to a time when that venue was offline. The operator believes the venue is currently offline and initiates a recovery workflow. The venue is actually currently LIVE.

**Verification method:** Navigate to a replay session where a venue was OFFLINE at a historical timestamp. Scroll timeline to that OFFLINE moment. Assert Zone A badge for that venue shows LIVE (current state). Assert Zone A badge does not change color as timeline scrolls through historical states.

---

## Escalation Visibility

### Rule EV-01: Active Incident Always Visible

**Context:** Operator has navigated Zone B to a non-incident surface (schedule manager, training, replay).

**Approved behavior:** Zone A Pane A2 (Active Incidents) always shows the current list of active incidents accessible to the operator, regardless of what Zone B displays. If Zone B is on the schedule manager, Pane A2 still shows open incidents.

**Forbidden behavior:** Zone A Pane A2 becoming empty or hidden when incidents are active. Any navigation in Zone B that causes Zone A to lose its incident data is a violation.

**Operational consequence:** Operator navigates to the schedule manager, Zone A loses incident context, operator is no longer aware an incident is active on a venue they are assigned to.

**Verification method:** Declare an incident. Navigate Zone B to schedule manager. Assert Zone A Pane A2 still shows the incident with severity badge and [View] link. Assert Pane A2 incident data is correct (real-time, not cached from prior Zone B state).

---

### Rule EV-02: Constitutional State Always in Status Bar

**Context:** Any operator interaction that might scroll, occlude, or reposition the System Status Bar.

**Approved behavior:** System Status Bar always and continuously shows the current constitutional state badge. The constitutional state badge is the leftmost (highest priority) element in the Status Bar.

**Forbidden behavior:** System Status Bar scrolling off screen. System Status Bar being occluded by any modal, overlay, dropdown, or panel expansion. System Status Bar having a z-index lower than any other UI element.

**Operational consequence:** Operator is unaware of DEGRADED, CONSTITUTIONAL_RISK, or worse constitutional state because the Status Bar is hidden. They proceed with normal operations under the assumption that the platform is HEALTHY.

**Verification method:** Assert System Status Bar CSS has `position: fixed` and `z-index` that exceeds all modals, overlays, and panels. Assert System Status Bar remains visible during panel expansions, modal openings, and Zone B transitions. Assert constitutional state badge is rendered regardless of user scroll position.

---

### Rule EV-03: Emergency Content Badge Persistence

**Context:** A Level 6 emergency override is active on a venue the operator is viewing.

**Approved behavior:** "EMERGENCY CONTENT ACTIVE" badge displayed in Section 1 (Venue Identity Header) of Venue Operations Dashboard persists regardless of which sections below it are expanded or collapsed. The badge is part of the Section 1 header row, which is not collapsible.

**Forbidden behavior:** Emergency content badge being hidden, removed, or reduced to a smaller indicator because the operator collapsed Section 1 or any other section. Emergency content badge being rendered inside a collapsible section.

**Operational consequence:** Operator believes content is normal because the badge is hidden. They proceed without knowing that emergency content is active and that the override may not be intentional or may have expired.

**Verification method:** Place a Level 6 emergency override. Navigate to Venue Operations Dashboard. Assert "EMERGENCY CONTENT ACTIVE" badge is visible in Section 1. Collapse all collapsible sections. Assert badge remains visible. Assert Section 1 cannot be collapsed (no collapse affordance rendered for Section 1).

---

## Acknowledgement Behavior

### Rule ACK-01: S3-S5 Incident Acknowledgement

**Behavior:** An OPERATOR+ who has received a Level 2 notification for an S3, S4, or S5 incident must acknowledge it before the banner can be dismissed.

**Acknowledgement action:** Clicking the notification banner (not the [x]). Clicking the banner body logs `INCIDENT_NOTIFICATION_ACKNOWLEDGED`: `incident_id`, `acknowledged_by`, `governed_timestamp`.

**After acknowledgement:** [x] appears on the banner, enabling dismissal.

**Scope of acknowledgement:** Acknowledgement records that the operator saw the notification. It does not require the operator to navigate to the incident. It does not transfer any responsibility.

**Banner behavior on non-acknowledgement:** If operator navigates to another venue, opens a modal, or changes Zone B content without clicking the banner: banner remains in System Status Bar. It does not move or reposition. It does not escalate.

---

### Rule ACK-02: Per-Operator Acknowledgement

**Behavior:** Acknowledgement is per-operator. If 5 operators have access to an affected venue, all 5 must independently acknowledge the incident notification.

**One operator acknowledging does not dismiss the notification for other operators.** Each operator's notification stream is independent.

**Rationale:** Awareness must be distributed, not assumed. A supervisor acknowledging an incident on behalf of all operators does not mean all operators are aware.

**Implementation:** Acknowledgement state is stored per `(incident_id, operator_id)` tuple. Not per `incident_id` alone.

---

### Rule ACK-03: Implicit Acknowledgement

**Behavior:** Navigating to the Incident Commander Surface for a specific incident implicitly acknowledges all pending Level 2 notifications for that incident for the operator who navigated.

**This is the only form of implicit acknowledgement.** All other acknowledgements require explicit banner interaction.

**Implementation:** Navigation to IC surface with `incident_id` parameter triggers the same `INCIDENT_NOTIFICATION_ACKNOWLEDGED` event that explicit acknowledgement produces. The event type field distinguishes: `acknowledgement_type: "implicit_navigation"`.

---

## Attention Overload Observation Patterns

The platform does not detect operator cognitive state. It observes operational events in the audit trail. The following patterns indicate a condition that can be surfaced to a supervisor for review. They are not surfaced to the operator directly. The platform makes no diagnosis — it surfaces observations.

**Pattern 1 — Notification Acknowledgement Without Action**
Observable signal: operator acknowledges more than 5 incident notifications within a 30-minute window without navigating to any of them.
Audit trail query: `INCIDENT_NOTIFICATION_ACKNOWLEDGED` events for operator_id, count > 5 in 30-minute window, with no corresponding `IC_SURFACE_VIEWED` event for the acknowledged incident_ids.
Output: advisory note in ADMIN operator management view: "Operator [id] acknowledged [N] incident notifications in the last 30 minutes without navigating to any."

**Pattern 2 — Rapid Surface Switching**
Observable signal: operator opens more than 3 different Incident Commander surfaces in a 10-minute window without adding any annotations in any of them.
Audit trail query: `IC_SURFACE_VIEWED` events for operator_id, distinct incident_ids > 3 in 10-minute window, with no `OPERATOR_NOTE` events in that window.
Output: advisory note in ADMIN view: "Operator [id] viewed [N] incident surfaces in 10 minutes without annotating any."

**Pattern 3 — Skipped Advisory Preview**
Observable signal: override placed at a level where preview is advisory (Level 1-3) and no `schedule_preview_clicked_at` is present in the submission record.
Audit trail query: override_created events with level in (1, 2, 3) and `preview_clicked_at = null` in submission record.
Output: available in audit trail query. No active notification surfaced. Available for supervisor review.

**Pattern 4 — Modal Abandonment Pattern**
Observable signal: operator cancels more than 3 confirmation modals within 5 minutes.
Audit trail query: `MODAL_CANCELLED` events for operator_id, count > 3 in 5-minute window.
Output: advisory note in ADMIN view: "Operator [id] cancelled [N] confirmation modals in 5 minutes."

These patterns are not surfaced to the operator. They are available in audit trail queries for supervisor review. No automated action is taken. The platform surfaces observations.
