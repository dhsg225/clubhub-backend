# Incident Commander Surface Specification v1

**Document type:** Operational Surface Specification
**Applies to:** Zone B — Incident Commander Surface
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md
**Status:** Constitutional — all implementations must conform
**Last updated:** 2026-06-01

---

## Overview

The Incident Commander Surface replaces Zone B when an incident is declared against a venue or when an operator navigates to an active incident via Zone A Pane A2. Zone A and Zone C remain visible and functional. Zone C switches from its standard panels to incident-specific panels for the duration of the incident view.

The surface has four sub-zones arranged in a fixed layout:

```
┌──────────────────────────────────────────────────────┐
│  IC-TOP  (Command Header, full width, 80px)          │
├──────────────────────┬───────────────────────────────┤
│                      │                               │
│  IC-LEFT             │  IC-RIGHT                     │
│  (Timeline + Log)    │  (Blast Radius + State)       │
│  ~40% width          │  ~60% width                   │
│                      │                               │
├──────────────────────┴───────────────────────────────┤
│  IC-BOTTOM  (Action Rail, full width, 72px)          │
└──────────────────────────────────────────────────────┘
```

---

## Severity Model

Incidents have five severity levels. Severity determines constitutional state, incident machine state, action availability, and the visual treatment of the surface.

| Severity | Constitutional State | Incident Machine State | Trigger Condition |
|---|---|---|---|
| S1 | EMERGENCY_FREEZE | DECLARED | Global constitutional freeze active |
| S2 | PRE_DISABLED or READ_ONLY | DECLARED | PRE circuit breaker OPEN |
| S3 | CONSTITUTIONAL_RISK | DECLARED | Replay divergence detected or CLASS_4 failure |
| S4 | DEGRADED | WATCHING or DECLARED | Performance thresholds breached |
| S5 | HEALTHY (monitoring) | WATCHING | Anomaly detected, below declaration threshold |

Severity badges use the following color model:

| Severity | Color |
|---|---|
| S1 | Red solid |
| S2 | Red outline (red border, transparent fill) |
| S3 | Orange solid |
| S4 | Amber solid |
| S5 | Yellow solid |

---

## IC-TOP: Command Header

**Position:** Full width. 80px height. Always visible within the Incident Commander Surface.

### Standard Contents

- **Incident ID:** Stable identifier assigned at declaration. Never changes for the lifetime of the incident. Always displayed in monospace font.
- **Severity badge:** S1/S2/S3/S4/S5 with color per severity model above.
- **Incident machine state:** Current state badge — WATCHING / DECLARED / CONTAINED / RESOLVED.
- **Declared at:** Governed timestamp of declaration, followed by wall clock elapsed in parentheses (e.g., "2026-06-01T14:22:07Z (47 minutes ago)").
- **Incident commander:** Display name and operator ID of the operator who declared the incident, followed by "Current:" and display name of the current commander (these may differ after a command transfer).
- **Affected scope:** Venue name(s). Fleet-wide incidents show "ALL VENUES — FLEET SCOPE" in red.
- **Operator presence:** Up to 5 operator initials/avatars at the right of IC-TOP, with "+N more" for additional operators viewing the incident simultaneously.

### S1 Override

When severity = S1 (EMERGENCY_FREEZE), IC-TOP expands vertically to accommodate the freeze banner:
- "CONSTITUTIONAL FREEZE ACTIVE" in large red text, centered, full width.
- Freeze reason displayed in smaller text directly below.
- Standard incident ID, declared_at, and commander remain visible but are secondary.

---

## IC-LEFT: Incident Timeline and Log

**Position:** Left column, approximately 40% of Zone B width minus IC-TOP and IC-BOTTOM.

### Log Structure

Chronological event log. Newest events appear at the bottom. Events are append-only — operators cannot delete or edit any log entry.

**Each log entry contains:**
- Governed timestamp
- Event type badge: STATE_TRANSITION / PRE_EVENT / OPERATOR_ACTION / SYSTEM_EVENT
- Actor: "system" or operator_id
- Description: human-readable event description

Event type colors (these are type colors, not severity colors):
- STATE_TRANSITION: purple
- PRE_EVENT: blue
- OPERATOR_ACTION: orange
- SYSTEM_EVENT: grey

### Scroll Behavior

Default scroll position locks to the bottom (newest events). A "Jump to top" button is always visible when the operator has scrolled up. Auto-scroll to bottom resumes automatically when a new event arrives, provided the operator's scroll position is within 3 entries of the bottom. If the operator has scrolled further up, auto-scroll does not interrupt their position.

### Operator Annotations

Operators can add a text note to the incident log at any time using the annotation input at the bottom of IC-LEFT. Annotations are labeled "OPERATOR NOTE" in a visually distinct style (indented, italic, amber left border). Annotations are appended to the audit trail with operator identity, governed timestamp of annotation, and incident ID. Annotations are replay-visible — any future replay session covering this incident timeframe will include these annotations.

Annotation input is available to any operator viewing the incident regardless of role.

### S1/S2 Treatment

In S1 and S2 incidents, the log column shows a continuous amber left border for the full height of the log, indicating elevated operational state.

---

## IC-RIGHT: Blast Radius and State

**Position:** Right column, approximately 60% of Zone B width minus IC-TOP and IC-BOTTOM. Divided into three sub-panels stacked vertically.

### Panel R1: Affected Surfaces

A list of all venues and screens affected by this incident.

**Each venue entry contains:**
- Venue name
- Player machine state badge
- Last PRE resolution level (0–6)
- Last sync timestamp (governed, relative + absolute on hover)

**Impact scope badge:** Displayed at the top of R1.
- LOCAL: single venue affected
- REGIONAL: multiple venues, not all
- FLEET: all venues

In S1 (constitutional freeze): all venues are listed with FROZEN state badge. No PRE resolution level is shown because no resolution is occurring.

### Panel R2: Current PRE State

Shows what PRE is currently resolving to for the affected venue(s).

**Contents:**
- Resolution level badge (0–6)
- Effective content reference
- Resolution path: simplified view showing only the winning step (the step whose result = WIN). Full resolution trace is available in Zone C Pane C1.
- Circuit breaker states relevant to PRE

**PRE_DISABLED state:** Shows "PRE is disabled. Content serving from last committed corpus entry. No new resolution possible." in amber. Resolution level and content reference fields are not shown because PRE is not running.

**EMERGENCY_FREEZE state:** Shows "All operations halted. No PRE resolution occurring." in red.

### Panel R3: Recovery Pathway

Step-by-step recovery pathway determined by the constitutional state machine and recovery policies. These steps are derived from constitutional RECOVERY-POLICIES — they are not invented or modified by operators.

**Each step contains:**
- Step number
- Description of the action
- Role required to execute (VIEWER read-only / OPERATOR+ / ADMIN only)
- Current status badge: PENDING / ACTIVE / COMPLETE / BLOCKED

**BLOCKED steps:** Show blocking reason below the step description (e.g., "Blocked: PRE circuit breaker must be in HALF_OPEN state before this step can execute").

**S5 recovery pathway:** Shows "No recovery action required — monitoring." This is explicit text, not an empty state.

---

## IC-BOTTOM: Action Rail

**Position:** Full width. 72px height. Always visible at the bottom of the Incident Commander Surface.

Available actions depend on: current severity, operator role, and incident machine state. Actions not available for the current context are either hidden (if they would never be available at this severity) or visible but disabled with tooltip explanation (if they are available at this severity but blocked by role or state).

### Actions by Severity and Role

**S5 — WATCHING — any authenticated role:**
- [Escalate to Declared] — available to OPERATOR and ADMIN. Triggers confirmation modal requiring a written reason.
- [Resolve — False Alarm] — available to OPERATOR and ADMIN. Triggers confirmation modal.
- [Add Note] — available to all roles including VIEWER.

**S4 — DECLARED — OPERATOR and ADMIN:**
- [Place Emergency Override] — opens override confirmation modal. Scope pre-populated from incident context (affected venue, suggested level). VIEWER: disabled, tooltip "Read-only access."
- [Contain Incident] — marks incident machine state as CONTAINED and begins the recovery pathway sequence. VIEWER: disabled.
- [Escalate to S3] — ADMIN only. Hidden from VIEWER and OPERATOR.
- [Transfer Command] — opens command transfer modal (see Command Transfer Workflow section).
- [Add Note] — all roles.

**S3 — DECLARED — OPERATOR and ADMIN:**
- [Place Emergency Override] — same as S4.
- [Initiate Replay Investigation] — opens the Replay and Forensics Workspace (Document 3) in Zone B with incident context pre-loaded. Available to all roles with read-access.
- [Contain Incident] — ADMIN only at S3. OPERATOR: visible but disabled, tooltip "Containment at S3 requires ADMIN authority."
- [Escalate to S2] — ADMIN only. Hidden from other roles.
- [Transfer Command] — OPERATOR and ADMIN.
- [Add Note] — all roles.

**S2 — DECLARED — recovery operations ADMIN only:**
- [Initiate PRE Recovery Protocol] — ADMIN only. Triggers the circuit breaker half-open probe sequence. Requires confirmation modal.
- [Authorize Manual Corpus Rollback] — ADMIN only. Requires both authorization token input and confirmation modal.
- [Request Platform Engineering Support] — available to all roles. Sends a structured alert to platform engineering. No UI side effects beyond a confirmation toast.
- [Add Note] — all roles.
- OPERATOR/VIEWER see action rail with read-only indicators and [Add Note] and [Request Platform Engineering Support] only.
- Explicit warning in action rail for all roles: "Operator overrides cannot be placed while PRE is disabled."

**S1 — DECLARED:**
- [Initiate Constitutional Freeze Resolution] — ADMIN only. Requires authorization token (human-held token, not session token). Visible to ADMIN only. Opens the freeze resolution workflow.
- [Authorize Emergency Content Broadcast] — ADMIN only. Places a fleet-wide Level 6 override. Requires authorization token and confirmation modal with explicit "I understand this broadcasts to all venues" acknowledgment.
- [Add Note] — all roles.
- [View Full Audit Trail] — all roles.
- Non-ADMIN operators: action rail shows [Add Note] and [View Full Audit Trail] only. All other buttons absent.

**Available at all severities and roles:**
- [View Full Audit Trail] — opens Replay & Forensics workspace.
- [Add Note] — appends operator annotation to incident log.

---

## Severity-Specific Screen Descriptions

### S5 — WATCHING

IC-TOP shows S5 badge (yellow) and WATCHING machine state. Severity indicator does not dominate the header — it is proportionate to the monitoring nature of S5.

IC-LEFT shows the event log with the anomaly trigger event highlighted at the top of the visible log area. Log otherwise scrolls normally.

IC-RIGHT:
- R1: Affected surfaces list with current player state badges.
- R2: PRE resolution operating normally. Resolution level and content reference shown. No warnings.
- R3: Shows "No recovery action required — monitoring."

IC-BOTTOM: [Escalate to Declared], [Resolve — False Alarm], [Add Note].

Zone C: Pane C1 (PRE Resolution Explainer) and Pane C4 (constitutional state — HEALTHY). Panes C2 and C3 accessible via tab.

### S4 — DEGRADED

IC-TOP shows S4 badge (amber) and DECLARED machine state.

IC-LEFT shows the degradation event sequence with the initial failure event highlighted. Log continues with subsequent events.

IC-RIGHT:
- R1: Affected surfaces with DEGRADED state badges.
- R2: PRE resolving but potentially through degraded path. If resolution fell back to LEVEL_5_STRUCTURAL, this is shown prominently: "Resolution fell back to structural content (Level 5)."
- R3: Recovery pathway with typical S4 steps:
  1. Identify failure class — ACTIVE
  2. Apply class recovery policy — PENDING
  3. Verify resolution restoration — PENDING

IC-BOTTOM: [Place Emergency Override], [Contain Incident], [Escalate to S3] (ADMIN only), [Transfer Command], [Add Note].

Zone C Pane C4 shows DEGRADED constitutional state with active circuit breakers listed.

### S3 — CONSTITUTIONAL RISK

IC-TOP shows S3 badge (orange) and DECLARED machine state. A secondary label below the severity badge shows either "REPLAY DIVERGENCE DETECTED" or "CLASS_4 FAILURE" depending on trigger.

IC-LEFT: If divergence triggered this incident, the divergence detection event is prominently highlighted in red within the log.

IC-RIGHT:
- R1: Affected surfaces.
- R2: If the shadow circuit breaker has tripped: "SHADOW ONLY mode active — PRE output is running but not yet verified. Divergence investigation is required before outputs can be trusted."
- R3: Recovery pathway:
  1. Initiate forensic replay — AVAILABLE
  2. Classify divergence root cause — PENDING
  3. Human review of replay output — PENDING
  4. Authorize recovery — PENDING

Zone C Pane C4 shows CONSTITUTIONAL_RISK state. Replay circuit breaker OPEN indicator is highlighted in amber.

IC-BOTTOM: [Initiate Replay Investigation] is displayed prominently (wider button or left-most position). [Place Emergency Override], [Contain Incident] (ADMIN), [Escalate to S2] (ADMIN), [Add Note].

### S2 — PRE DISABLED

IC-TOP shows S2 badge (red outline) and DECLARED machine state. Secondary label: "PRE CIRCUIT BREAKER OPEN."

IC-RIGHT R2: "PRE is disabled. No resolution occurring. Last committed content serving autonomously from corpus." This message is displayed prominently — it is the primary informational content of R2 at S2. The resolution level and content reference fields are replaced by this message.

IC-RIGHT R3: PRE recovery protocol steps as defined in constitutional RECOVERY-POLICIES. Steps are the primary focus of IC-RIGHT at S2.

Zone C Pane C4 shows PRE_DISABLED state.

IC-BOTTOM for non-ADMIN: [Add Note], [Request Platform Engineering Support], [View Full Audit Trail]. Explicit warning: "Operator overrides cannot be placed while PRE is disabled."

IC-BOTTOM for ADMIN: [Initiate PRE Recovery Protocol], [Authorize Manual Corpus Rollback], [Request Platform Engineering Support], [Add Note], [View Full Audit Trail].

### S1 — EMERGENCY FREEZE

Zone B fills with the constitutional freeze display. The normal IC-LEFT / IC-RIGHT split is overridden at S1.

IC-TOP expands to show "CONSTITUTIONAL FREEZE ACTIVE" in large red text, centered, full width. Freeze reason directly below. Frozen_at governed timestamp. Authorized_by (operator who triggered the freeze or the constitutional trigger).

IC-LEFT: Full constitutional event log from the moment the freeze was triggered. This is a complete append-only log of all events since freeze_at. Annotation input remains available at the bottom.

IC-RIGHT: Three panels.
- R1: All venues shown as FROZEN. Player state badge = FROZEN for every venue. No PRE resolution levels shown.
- R2: "All operations halted. No PRE resolution occurring. All screens serving last-committed corpus content autonomously."
- R3: Constitutional freeze resolution protocol steps (derived from RECOVERY-POLICIES, not invented by operator). Each step shows the role required. Steps requiring the authorization token are clearly marked.

Zone C: Pane C4 expands to full Zone C. Freeze details are shown: freeze reason, frozen_at, authorized_by, authorization token requirement. Panes C1, C2, C3 are inaccessible until freeze is resolved.

IC-BOTTOM for non-ADMIN: [Add Note], [View Full Audit Trail] only. All other buttons absent.

IC-BOTTOM for ADMIN: [Initiate Constitutional Freeze Resolution] (prominent, primary position), [Authorize Emergency Content Broadcast] (secondary position), [Add Note], [View Full Audit Trail].

The [Initiate Constitutional Freeze Resolution] button is visually distinct at S1 — larger, red, with brief description text below it: "Requires human authorization token."

---

## Information Reveal Sequencing

The Incident Commander Surface reveals information and controls progressively as severity escalates. Controls for future severity levels are not shown until that severity is reached.

**S5 → S4:** Incident log expands to full event sequence. Recovery pathway panel R3 appears. Degradation detail (failure class, circuit breaker states) becomes visible. Override placement and containment controls appear in action rail.

**S4 → S3:** Replay investigation surface becomes available ([Initiate Replay Investigation] appears in action rail). Shadow mode indicator appears in R2 if shadow circuit breaker has tripped. PRE state in R2 shows verification status. Divergence information, if applicable, appears highlighted.

**S3 → S2:** All non-recovery actions are disabled or hidden. R2 replaces PRE resolution detail with "PRE is disabled" message. PRE recovery protocol steps become the primary focus of R3. "Operator overrides cannot be placed" warning appears in action rail.

**S2 → S1:** Full freeze display replaces normal IC-LEFT/IC-RIGHT layout. All operator actions except freeze resolution workflow are removed from the action rail. Constitutional freeze resolution protocol becomes the exclusive recovery focus.

---

## Command Transfer Workflow

### Initiating a Transfer

Any operator with OPERATOR or ADMIN role and active session in the incident view can initiate a command transfer. VIEWER role cannot hold or transfer incident command.

The initiator clicks [Transfer Command] in the action rail. A modal opens showing a list of operators currently active in the incident session. The initiator selects the recipient. Clicking [Confirm Transfer] sends the transfer request.

### Recipient Experience

The recipient receives a notification in their workspace: "You have been requested to assume incident command for [Incident ID]. Accept?" The notification shows the incident ID, severity, current commander's name, and [Accept] / [Decline] buttons.

**On Accept:** Commander identity in IC-TOP updates immediately. The previous commander reverts to OPERATOR role for this incident. The transfer is logged as a SYSTEM_EVENT audit entry with governed timestamp.

**On Decline:** Transfer is cancelled. The initiator sees a notification: "[Operator name] declined command transfer." The incident commander does not change.

### Lapsed Commander State

If the current incident commander's session expires before command is transferred, the incident enters COMMANDER_LAPSED state. IC-TOP shows "COMMANDER LAPSED — No active commander" in amber. A [Claim Command] button appears in the action rail for any operator with ADMIN role. OPERATOR role cannot claim command from a lapsed state — ADMIN authority is required.

Claiming command is logged as an audit event.

---

## Multi-Operator Coordination

Multiple operators can view the same incident simultaneously. Operator presence is shown in IC-TOP via initials/avatars (up to 5, "+N more" for additional).

Only the incident commander can perform state-changing actions. All other operators view the incident in a read-only state. State-change action buttons in IC-BOTTOM show a "Commander action only" tooltip when the viewing operator is not the commander.

[Add Note] is available to any operator in the incident view regardless of commander status.

There is no real-time cursor sharing or collaborative annotation surface. All coordination occurs sequentially through the append-only audit log. Operators communicate intent through log annotations, and command transfers are the mechanism for changing who can act.

---

## Replay Behavior

When an incident is viewed within a replay session (entered via [Initiate Replay Investigation] or from Replay & Forensics workspace):

**IC-TOP:** Shows amber REPLAY banner with the governed timestamp currently being displayed. Incident ID, original severity, and original commander are shown as historical record.

**IC-LEFT:** Shows the historical event log at the current replay timestamp. Only events up to that timestamp are visible. The operator can navigate forward/backward through events using keyboard arrows (left/right) or the RP-TIMELINE controls in Zone B (see Document 3).

**IC-RIGHT:** Shows all panels (R1, R2, R3) as they existed at the current replay timestamp. R2 shows what PRE was resolving to at that moment in history. R3 shows which recovery steps had been completed versus pending at that point.

**IC-BOTTOM:** No operator state-changing actions are available. Action rail shows only [Add Annotation] and [Exit Replay].

Annotations added during replay are persisted to the audit trail with operator_id, governed timestamp of annotation, and the replay session ID. They are distinct from the original incident log entries.

---

## Degraded-Network Behavior

If the operator loses network connectivity while viewing the Incident Commander Surface:

An amber banner appears in IC-TOP: "Connection lost — incident view may be stale. Last updated: [timestamp]."

Last-known incident state is preserved and displayed. All state-changing action buttons are disabled. [Add Note] remains available — annotations are buffered locally and will sync to the audit trail on reconnection.

On reconnection: the full incident state refreshes automatically. The event log resumes live updates. Buffered annotations are flushed to the audit trail in the order they were written, with their original governed timestamps preserved if available, or with a "BUFFERED" label if governed timestamps could not be confirmed while offline.
