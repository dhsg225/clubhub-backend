# Venue Operations Dashboard — v1

**Document type:** Operational Surface Specification
**Workspace:** Venue Operations Dashboard
**Audience:** Frontend engineering, product, QA
**Constitutional basis:** PRE is the source of truth. The dashboard explains PRE output. It does not override or predict it. All information is advisory or read-only unless otherwise stated.
**Version:** 1.0
**Status:** Authoritative

---

## Overview

The Venue Operations Dashboard is the default Zone B view when a venue is selected in Zone A and no specialized workspace (incident, replay, CMS) is active. It provides a comprehensive single-venue operational picture for the selected venue.

**Primary operator:** OPERATOR (L2+). Actions available per role and platform state.
**Secondary:** VIEWER (L1), read-only access to all panels. No action buttons visible.
**ADMIN:** all OPERATOR capabilities plus venue administration actions.

The dashboard is designed around the following sequence: orient, understand, then act. Section order enforces this — identity and health are visible before content state, and content state is visible before the action surface. Operators cannot accidentally act before they know what state they are acting on.

---

## Dashboard Layout

Zone B in dashboard mode contains five sections stacked vertically. Each section is independently collapsible (except Section 1). The collapse state is remembered per-session per-venue.

| Section | Name | Default state |
|---------|------|---------------|
| 1 | Venue Identity Header | Fixed — never collapsible |
| 2 | Player Health Panel | Open |
| 3 | Content and PRE Status Panel | Open |
| 4 | Intervention Surface | Open |
| 5 | Venue Timeline | Collapsed |

Section headers are keyboard-accessible collapse/expand controls. Pressing Enter or Space on a section header toggles its collapsed state. Focus is managed: on collapse, focus remains on the section header; on expand, focus moves to the first interactive element within the section.

---

## Section 1: Venue Identity Header

Always visible. Never collapses. Fixed 80px height. This section is the operational anchor — operators can always see which venue they are looking at and what state it is in regardless of scroll position within Zone B.

Contents (left to right):

**Venue Name:** large text, primary label.

**Venue ID:** small grey text beneath the venue name.

**Player Machine State Badge:** LIVE (green) / OFFLINE (grey) / DEGRADED (amber) / INCIDENT (red) / SYNCING (blue, animated pulse).

**Constitutional State Badge:** HEALTHY / DEGRADED / CONSTITUTIONAL_RISK / SHADOW_ONLY / PRE_DISABLED / READ_ONLY / EMERGENCY_FREEZE. Color coding:
- HEALTHY: green.
- DEGRADED: amber.
- CONSTITUTIONAL_RISK: amber, with warning icon.
- SHADOW_ONLY: blue.
- PRE_DISABLED: red.
- READ_ONLY: grey.
- EMERGENCY_FREEZE: red, bold.

**Last Sync Timestamp:** "Last synced [relative time]" — relative to current wall clock. Hover shows absolute governed timestamp. Color: green if < 5 minutes, amber if 5–30 minutes, red if > 30 minutes or unknown.

**72h Autonomy Indicator:** visible only when player has been offline for more than 1 hour. When visible:
- Label: "Autonomous mode — [N]h [M]m remaining."
- Color: green when > 48h remaining, amber when 12–48h remaining, red when < 12h remaining.
- Hover: "Player is serving from local corpus. CMS connection offline. Autonomy window expires at [governed timestamp]."
- When autonomy window has expired: red, "Autonomy window EXPIRED — player may be showing fallback content."

**Emergency Content Indicator:** visible only when an active Level 6 Emergency Override exists for this venue (directly or via group/fleet scope). Red badge. Label: "EMERGENCY CONTENT ACTIVE." Contents on hover or click-to-expand: override_id, placed_by (operator_id), placed_at (governed timestamp, absolute and relative). This indicator is placed in Section 1 so it is visible regardless of which other sections are collapsed.

---

## Section 2: Player Health Panel

Collapsible. Default: open. Provides hardware and connectivity health of the physical player device.

Section header label: "Player Health." Collapse/expand toggle at right.

Composed of three sub-panels. Sub-panels stack vertically within Section 2.

---

### Sub-panel A: Connectivity

**Network Status:** ONLINE (green) / OFFLINE (grey) / INTERMITTENT (amber).

INTERMITTENT is reported when the player has reported heartbeats in the last 10 minutes but missed more than 20% of expected heartbeats. ONLINE means all recent heartbeats received. OFFLINE means no heartbeat in the last 5 minutes.

**Last Heartbeat:** relative time. Color: green if < 30 seconds, amber if 30 seconds to 5 minutes, red if > 5 minutes. Hover shows absolute governed timestamp of last heartbeat.

**Clock Drift:** `clock_drift_ms` value in milliseconds. This is the player's reported difference from NTP. Color:
- Green: < 5000ms.
- Amber: 5000ms to 60000ms.
- Red: > 60000ms. Label changes to "NTP DESYNC" in red.

Hover on clock drift value: "Clock drift above 60 seconds will cause PRE to use a stale governed time reference. Content may resolve incorrectly until clock is corrected."

**Chromium Status:** ALIVE (green) / DEAD (red). DEAD state label: "CHROMIUM_DEAD — player may be displaying a black screen. Physical verification required."

---

### Sub-panel B: System Health

Three resource bars: CPU load, memory usage, disk usage. Each shown as a labeled percentage bar.

Color thresholds (applied to each bar independently):
- Green: value < 70%.
- Amber: 70–85%.
- Red: > 85%.

Values sourced from the most recent heartbeat report. Each bar carries a "Last updated [relative timestamp]" line below it.

If values are unavailable (player has not reported or reporting is incomplete): bar shows "—%" in grey. Section note: "Hardware metrics unavailable — player not reporting system health."

---

### Sub-panel C: Corpus Status

**Last Corpus Update:** relative timestamp of the last successful corpus delivery to this player. Hover for absolute governed timestamp.

**Corpus Checksum:** first 8 characters of the corpus checksum, followed by "[show full]" link. Full checksum in a small monospace overlay on click.

**Corpus Entry Count:** integer, count of active corpus entries currently on the player.

**Status:**
- CURRENT (green): player's corpus checksum matches the server's current corpus checksum for this venue.
- STALE (amber): player's corpus is older than 24 hours. Label: "STALE — corpus not updated in > 24 hours."
- UNKNOWN (grey): server cannot verify player corpus state (player offline or not reporting checksum).

---

### Failure Behavior for Section 2

**Player OFFLINE:**
All three sub-panels show last-known values. A grey banner spans the top of Section 2: "LAST KNOWN — player offline. Values displayed are from the last successful heartbeat at [governed timestamp]."

All values are presented in grey text to reinforce that they are not live.

**Player DEGRADED:**
Sub-panels show live values where available. Any sub-panel with missing or unreliable data carries a red "DEGRADED" badge in its sub-panel header. Sub-panels with complete data remain styled normally.

---

## Section 3: Content and PRE Status Panel

Collapsible. Default: open. Shows what is currently playing and why. This is the primary information section — it directly surfaces PRE output for the selected venue.

Section header label: "Content & PRE Status." Collapse/expand toggle at right.

Composed of four sub-panels.

---

### Sub-panel A: Currently Resolved Content

This sub-panel is the first visible element when Section 3 opens. The resolution level badge is the first visual element within it, by design — operators know what level PRE resolved before they read the detail.

**Resolution Level Badge:** prominent. Level and label:
- L0 — EMERGENCY (red, bold)
- L1 — OVERRIDE (dark orange)
- L2 — SCHEDULE (blue)
- L3 — CAMPAIGN (purple)
- L4 — SPONSORSHIP (teal)
- L5 — FALLBACK (grey)

**Effective Content:** `content_ref` in large text, below the resolution level badge. Copyable via [Copy] icon adjacent to the value.

**Resolution Timestamp:** governed timestamp, shown as both relative ("resolved [N] seconds ago") and absolute on hover.

**Winner ID:** visible when an override won the resolution. Shows: override_id and operator_id who placed it. Format: "Override [id] by [operator_id]." Not shown when resolution is schedule, campaign, sponsorship, or fallback.

**[Explain Resolution] link:** below the content ref. Clicking expands a PRE Resolution Trace inline within Section 3. The trace format is identical to Zone C Pane C1 (PRE Explainer). The trace is rendered within the Section 3 body — the operator does not need to open Zone C. When the trace is expanded, a [Collapse trace] link appears. The trace updates in real time as PRE resolves (same refresh cadence as Pane C1).

---

### Sub-panel B: Active Override Stack

Header label: "Active Overrides." Count badge in the header: shows count of active overrides on this venue. If count > 3: badge turns amber.

Ordered list of active overrides, level descending (highest level at top).

Each entry:
- Level badge: "L[N]" with label.
- content_ref.
- Placed by: operator_id.
- Age: relative time since placed_at. Hover for absolute governed timestamp.
- Expires at: relative time to expiry. Hover for absolute. If no expiry set: "No expiry" in amber.

If override stack is empty: "No active overrides. Resolution is governed by schedule and PRE." in neutral grey. No entries shown.

[Manage Overrides] link at bottom of sub-panel: opens CMS Override Control tab pre-filtered to this venue.

---

### Sub-panel C: Active Schedule Block

Header label: "Schedule."

**If a schedule block is active at the current governed time:**
- content_ref.
- Time range: starts_at — ends_at.
- DOW constraint indicator: calendar icon if DOW restriction applies. Hover: "Active on: [days]."
- Status: ACTIVE (green) / PENDING (amber, if the block exists but is not yet approved).

**If no schedule block is active:**
"No schedule block active at this time. Resolution falls to lower priority levels." in neutral grey.

**Next scheduled block (always shown if one exists within the next 24 hours):**
"Next: [content_ref] at [starts_at] (in [relative time])."

If no upcoming block within 24 hours: "No schedule blocks in the next 24 hours."

[Manage Schedule] link: opens CMS Schedule Manager for this venue.

---

### Sub-panel D: Sponsorship Status

Header label: "Sponsorship."

**Active Sponsorship Contracts:** count of active contracts affecting this venue.

**Current Effective SOV:** percentage of sponsored content in the current PRE output for this venue. Format: "[N.NN]% effective SOV."

If SOV > 90%: amber warning below the SOV value — "Sponsorship SOV high — review allocation."

If no active sponsorship contracts: "No active sponsorship contracts on this venue." in neutral grey.

[Manage Sponsorship] link: opens CMS Sponsorship Manager for this venue.

---

### Replay Behavior for Section 3

In replay mode, all four sub-panels show historical values at the replay timestamp:
- Sub-panel A: effective content and resolution level as resolved by PRE at the replay timestamp.
- Sub-panel B: override stack contents as of the replay timestamp.
- Sub-panel C: schedule block active at the replay timestamp.
- Sub-panel D: sponsorship SOV as of the replay timestamp.

A persistent amber label spans the top of Section 3: "REPLAY MODE — content state at [governed timestamp]."

[Manage Overrides], [Manage Schedule], and [Manage Sponsorship] links are disabled in replay mode. Tooltip: "CMS navigation unavailable in replay mode."

---

## Section 4: Intervention Surface

Collapsible. Default: open. The action surface for operators on the selected venue. What is shown in this section depends on: current venue machine state, current platform constitutional state, and the operator's role.

VIEWER (L1): Section 4 is not shown. The section does not appear in the DOM for VIEWER-role operators. No read-only version of Section 4 is shown — the next collapsed section below Section 3 is Section 5.

Section header label: "Actions." Collapse/expand toggle at right.

---

### Nominal State: LIVE, HEALTHY

Available actions shown in a consistent two-column grid layout:

Left column:
- [Place Override] (OPERATOR+): opens CMS Override Control, pre-scoped to this venue and pre-focused on the placement form.
- [Schedule Content] (OPERATOR+): opens CMS Schedule Manager for this venue.

Right column:
- [Preview PRE Resolution] (OPERATOR+): opens a counterfactual PRE preview panel inline within Section 4. The panel shows current PRE output by default. Operator can adjust parameters (hypothetical override level, hypothetical content_ref) to preview what PRE would resolve to. Results update as parameters are changed. This is a read-only preview — no submission occurs from this panel.
- [Declare Incident] (OPERATOR+): opens incident declaration modal. Modal contents: incident severity selector (S2–S5, with descriptions), affected scope (this venue / venue group), description field (required), [Declare] [Cancel].

Bottom of section (full width):
- [Request Elevated Session] (OPERATOR, shown when operator does not have an active elevated session): sends elevation request. Button changes to "Elevation Requested — pending ADMIN approval" after click.

Button positioning is fixed within this layout. [Place Override] is always top-left. [Declare Incident] is always bottom-right, in any state where both are displayed.

---

### OFFLINE State

All content-affecting actions are suspended. Section 4 shows:

[Initiate Recovery Workflow] (OPERATOR+): opens the venue recovery workflow checklist (see Venue Recovery Workflow section below). Full-width button, primary styling.

[View 72h Autonomy Status] (all roles that see Section 4): opens autonomy detail panel inline. Shows: hours remaining, last corpus sync timestamp, corpus checksum, whether the player is within the autonomy window, and what content will be served if within / outside the window.

[Trigger Re-enrollment] (ADMIN only): initiates hardware re-enrollment workflow. Confirmation modal: "Trigger re-enrollment for [venue name]? This sends a re-enrollment command to the device. The device must be reachable. [Confirm] [Cancel]." If device is not reachable: error shown — "Re-enrollment command cannot be delivered — player is offline. Restore connectivity and try again."

[Contact Venue] (OPERATOR+): opens a read-only panel showing the venue's emergency contact record — the designated OPERATOR for this venue, their name, and contact information (phone/email from the venue record). This is not a platform communication channel — it shows stored contact details only. "To reach the on-site contact for [venue name]: [contact details]."

---

### DEGRADED State

Override placement is suspended during degraded state. Section 4 shows:

[View Degradation Detail] (all roles that see Section 4): opens a degradation detail panel inline. Shows: failure class, active circuit breakers (names and trigger conditions), and the trigger event that caused the degradation (governed timestamp, event description).

[Escalate to Incident] (OPERATOR+): escalates the degradation to a formal incident. Opens incident declaration modal pre-populated with severity S3 (OPERATOR can adjust to S2 or S4). The degradation event ID is auto-linked to the incident.

[Place Override] is not shown in DEGRADED state. If an OPERATOR attempts to navigate directly to CMS Override Control while the venue is DEGRADED: a notice appears at the top of the Override Control tab — "Override placement suspended for [venue name] — venue is in DEGRADED state. Escalate to incident to unlock emergency actions."

---

### INCIDENT State (Active)

For active S1 and S2 incidents: Zone B is replaced by the Incident Commander Surface. Section 4 is not shown.

For S3, S4, and S5 incidents: Sections 1, 2, and 3 remain visible. Section 4 is replaced by a reduced incident-action surface:

- Incident summary bar: severity badge, incident_id, incident declared at, assigned to.
- [Open Incident Commander] (OPERATOR+): navigates to the Incident Commander Surface for this incident. Full-width, primary.
- [Place Emergency Override] (ADMIN or elevated session only): opens the Level 6 Emergency Override workflow from CMS Override Control (same as [Declare Emergency Override] in that tab), pre-scoped to this venue.
- [Escalate Severity] (OPERATOR+): opens severity escalation modal (e.g., escalate from S4 to S3). Reason field required.

No normal operational actions ([Schedule Content], [Preview PRE Resolution], [Request Elevated Session]) are shown during an active incident.

---

### EMERGENCY_FREEZE State

All operator actions are suspended. Section 4 shows:

Label: "Platform in constitutional freeze. No operational changes permitted." Red banner, full width.

[View Freeze Details] (all roles that see Section 4): read-only panel showing: freeze declaration timestamp, freeze reason, scope (venue / fleet), declared by. Read-only.

[Initiate Freeze Resolution] (ADMIN only): opens the constitutional freeze resolution workflow. This is a multi-step workflow requiring explicit confirmation. The workflow is defined in the Incident Commander specification. Within the Venue Operations Dashboard, this button opens that workflow in a full-screen modal overlay — it does not navigate away from the dashboard. The button is shown in gold (consistent with ADMIN-only actions that have significant system impact).

---

### CONSTITUTIONAL_RISK State

Override placement requires elevated session at any level (no normal OPERATOR placement).

[Place Override] shown but greyed for OPERATOR without elevated session. Tooltip: "Elevated session required during CONSTITUTIONAL_RISK. Request elevated session before placing overrides."

[Place Override] active for OPERATOR with elevated session and for ADMIN.

[Preview PRE Resolution]: available and accessible for all roles (no elevated session required for preview-only).

[Initiate Forensic Replay] (OPERATOR+): opens Replay & Forensics workspace scoped to this venue, with the current governed timestamp as the anchor point. Full-width button below the standard action grid.

[Escalate to Incident] (OPERATOR+): shown prominently with an advisory note: "Venue constitutional risk detected — consider declaring a formal incident." Not forced — operator decides.

---

## Section 5: Venue Timeline

Collapsible. Default: collapsed. A condensed operational history of the selected venue.

Section header label: "Venue Timeline [last updated N seconds ago]."

This section defaults collapsed to reduce cognitive load for operators performing routine checks. It is expanded when investigating anomalies, reviewing history, or preparing for a forensic replay.

---

### When Expanded

**Time range selector:** Last 1h / Last 4h / Last 24h / Custom range. Default: Last 4h. Custom range: date/time range pickers for start and end.

**Event log:** scrollable list, newest at bottom.

Each event:
- Governed timestamp (absolute).
- Event type badge.
- Event description (one line, truncated; expand on click).
- Actor: operator_id (for OPERATOR_ACTION events) or system component (for automated events).

Event type colors and labels:

| Type | Color | Description |
|------|-------|-------------|
| PRE_RESOLUTION | Blue | A PRE resolution occurred — content_ref and level shown |
| OPERATOR_ACTION | Orange | An operator performed an action on this venue |
| STATE_TRANSITION | Purple | Machine or constitutional state changed |
| CORPUS_UPDATE | Green | Corpus delivered and applied to player |
| HEARTBEAT | Grey | Player heartbeat received — collapsed by default |

HEARTBEAT events are collapsed by default (they are high-frequency and low-signal in normal operation). A [Show heartbeats] toggle above the event log enables them. Toggling heartbeat visibility does not affect other event types.

**Clicking any event:** opens a flyout detail panel on the right side of Section 5. The flyout shows the full event record: all fields, all metadata, governed timestamp, actor, system state at time of event. This is the same detail panel format as RP-DETAIL in the Replay & Forensics workspace.

**[Open in Replay Workspace] button:** visible at the top-right of Section 5 when expanded. If a specific event is selected (flyout open): the button opens the Replay & Forensics workspace anchored at the selected event's governed timestamp, scoped to this venue. If no event is selected: opens Replay & Forensics at the current time, scoped to this venue.

---

## State-Specific Dashboard Renderings

The following describes the complete dashboard appearance in each significant venue state. This supplements the per-section behavior above with a unified picture of each state.

---

### Nominal (LIVE, HEALTHY)

**Section 1:** Venue name and ID. LIVE badge (green). HEALTHY badge (green). Last sync within normal range. 72h autonomy indicator hidden. No emergency content badge.

**Section 2:** All sub-panels showing live values. Network ONLINE. Clock drift green. Chromium ALIVE. CPU/memory/disk green or amber (operating range). Corpus status CURRENT.

**Section 3:** Resolution level at whatever PRE is currently resolving (typically L2 — SCHEDULE for venues with active schedule). content_ref shown. Effective override stack empty or small. Schedule block active. Sponsorship SOV within normal range.

**Section 4:** Full action set: [Place Override], [Schedule Content], [Preview PRE Resolution], [Declare Incident], [Request Elevated Session] (if operator has no elevated session).

**Section 5:** Collapsed. No action required.

**Zone C:** Pane C1 (PRE Explainer) shows current resolution trace. Pane C4 (Circuit Breakers) shows all breakers CLOSED.

---

### Degraded (DEGRADED machine state)

**Section 1:** DEGRADED badge (amber). Constitutional state may be DEGRADED or CONSTITUTIONAL_RISK. Last sync may show recent amber timestamp.

**Section 2:** Affected sub-panels show the degradation source — e.g., if network is INTERMITTENT: Sub-panel A shows amber status. If hardware metrics are elevated: Sub-panel B shows amber/red bars. DEGRADED badge on any sub-panel with missing or unreliable data.

**Section 3:** Resolution level may show L5 — FALLBACK prominently if PRE is operating in degraded mode and schedule cannot be evaluated. Sub-panel A explains this: "Resolution at FALLBACK level — PRE operating in degraded mode. Schedule evaluation suspended." If PRE is still operating normally despite hardware degradation: Section 3 shows normal resolution.

**Section 4:** [Place Override] not shown. [View Degradation Detail] and [Escalate to Incident] shown. Override placement tooltip explains the suspension.

**Zone C:** Pane C4 shows which circuit breakers are OPEN and their trigger conditions.

---

### Disconnected (OFFLINE machine state)

**Section 1:** OFFLINE badge (grey). 72h autonomy indicator visible. Constitutional state shown as last known.

**Section 2:** All sub-panels show last-known values. Grey "LAST KNOWN — player offline" banner across top of Section 2. All values in grey text.

**Section 3:** "Content serving autonomously from local corpus. PRE is not running. Showing last known resolution." Sub-panels show last-known content resolution, override stack, schedule block, and sponsorship — all labeled "LAST KNOWN."

**Zone C Pane C1:** "PRE not active — player is serving autonomously from local corpus. PRE resolution shown is from last known evaluation at [timestamp]."

**Section 4:** Recovery workflow actions. [Initiate Recovery Workflow] (OPERATOR+), [View 72h Autonomy Status], [Trigger Re-enrollment] (ADMIN), [Contact Venue].

**Section 5:** Timeline frozen. Events stop at the last heartbeat timestamp. Last event shown: "HEARTBEAT — last received [governed timestamp]." Subsequent timeline is empty. [Open in Replay Workspace] available — opens replay at last heartbeat timestamp.

---

### Recovering (SYNCING)

**Section 1:** SYNCING badge (blue, animated pulse). Constitutional state badge reflects current state (typically HEALTHY if sync is routine, DEGRADED if recovering from incident).

**Section 2:** Sub-panel A: ONLINE. Last heartbeat green (player has reconnected). Sub-panel C: "SYNCING — updating corpus from server. [N]% received." If completion time estimate is available: "Estimated completion: [N] seconds."

**Section 3:** "Sync in progress. Content state may update after sync completes. Current display reflects pre-sync corpus." Sub-panels show current state as PRE sees it — which may still reflect the pre-sync corpus if sync has not completed.

**Section 4:** Read-only during sync. Actions limited to [Preview PRE Resolution] (available — uses server-side current state, not player corpus) and [View Sync Status] (inline panel showing sync progress). All modification actions ([Place Override], [Schedule Content]) shown in grey with tooltip "Actions suspended during corpus sync. Sync will complete in approximately [N] seconds."

**Section 5:** Timeline shows the reconnection event prominently: "STATE_TRANSITION — player reconnected at [timestamp]."

---

### Incident (Active)

**Section 1:** INCIDENT badge (red) with incident_id and severity (e.g., "INCIDENT — S3"). Constitutional state badge reflects associated constitutional state.

**Sections 2 and 3:** For S1/S2: Zone B is replaced by Incident Commander Surface — Sections 2, 3, 4, 5 are not shown. For S3/S4/S5: Sections 2 and 3 remain visible, providing context to the incident commander.

**Section 4:** For S3/S4/S5: reduced incident-action surface as described in the Intervention Surface section above.

**Section 5:** Timeline actively updating with incident-related events. Timeline expands automatically when an incident is declared, showing the last 1 hour by default during an active incident.

---

## Venue Recovery Workflow

Accessed via [Initiate Recovery Workflow] from Section 4 Intervention Surface (OFFLINE state). Opens as a modal panel overlay on Zone B. Modal does not close until explicitly dismissed or recovery is completed.

**Modal header:** "Venue Recovery — [venue name]." Status indicator: Step [N] of 5.

Sequential checklist. Each step must be completed (or explicitly skipped with ADMIN authority) before the next step is available.

---

**Step 1: Verify Physical Connection**

Text: "Confirm that the network cable is connected to the Pi, or that the correct WiFi SSID is active."

[Mark Complete — physical connection confirmed]: operator confirms manually. The system cannot automate this check when the player is offline.

Note: this is an operator attestation. The audit log records the attestation with the operator's operator_id and governed timestamp.

---

**Step 2: Check 72h Autonomy Window**

System displays:
- Autonomy hours remaining (or "EXPIRED" if past 72h).
- Last corpus sync timestamp (governed, absolute).
- Corpus checksum at last sync.

If within autonomy window: "The player may be serving content autonomously from its local corpus. Verify display output physically before proceeding with re-enrollment. If the screen is showing expected content, the player may be operating normally despite connection loss."

If beyond autonomy window: "The 72h autonomy window has expired. The player may be showing fallback content, a blank screen, or expired content. Physical verification of the display output is required before proceeding."

[Physical display verified]: operator attests to the display state.
[Display is showing correct content — recovery complete]: closes recovery workflow if operator is satisfied. Available at any step — operator can exit if they determine the player is fine.

---

**Step 3: Attempt Re-enrollment**

[Trigger Re-enrollment] (ADMIN only): sends re-enrollment command via CMS API. Button is greyed for OPERATOR with tooltip "ADMIN required for re-enrollment."

[Check Enrollment Status]: polls re-enrollment status. Shows: NOT STARTED / PENDING / IN_PROGRESS / COMPLETE / FAILED. Polling is manual (button-triggered) — not automatic.

If re-enrollment fails 3 times (3 consecutive FAILED statuses):
- Alert shown in red: "Re-enrollment failed 3 times. Automated re-enrollment is not resolving the issue."
- Instruction: "Proceed to manual recovery. Consult the enrollment troubleshooting runbook for USB recovery image procedures."
- Link: "03-enrollment-troubleshooting.md" (opens in documentation panel or new tab).
- Step 3 can be marked complete manually by ADMIN: [Mark as Complete — proceeding to manual recovery].

---

**Step 4: Verify Corpus Sync**

After re-enrollment completes:

- Player's reported corpus checksum displayed.
- Server's expected corpus checksum for this venue displayed.
- Visual comparison: MATCH (green) / MISMATCH (red).

[Verify Corpus Integrity] (ADMIN only): triggers a server-side corpus integrity check for this venue. Checks that the corpus on the player matches the expected corpus for this venue at the current point in time. Result: PASS (green) / FAIL (red, with description of discrepancy) / PENDING (checking...).

For OPERATOR without ADMIN: "Corpus checksum comparison shown above. Contact ADMIN to trigger full integrity verification if needed."

---

**Step 5: Verify PRE Resolution**

Final step. Operator verifies that the screen is now displaying expected content.

[Preview PRE Resolution]: available in this step. Shows what PRE is currently resolving to for this venue. Operator compares to physical display.

[Content is correct — mark recovery complete]: closes the recovery workflow. Logs recovery completion event with operator_id, governed timestamp, duration of recovery workflow. Venue returns to normal operational state in the dashboard.

[Content is incorrect — escalate to incident]: opens incident declaration modal pre-populated with severity S3, description "Post-recovery content mismatch," venue pre-filled. Opens Incident Commander Surface after declaration.

---

## Accessibility Considerations

**State badges:** every state badge uses color AND text. No state is communicated by color alone.
- OFFLINE: grey badge + text "OFFLINE."
- DEGRADED: amber badge + text "DEGRADED."
- INCIDENT: red badge + text "INCIDENT."
- EMERGENCY_FREEZE: red bold badge + text "EMERGENCY_FREEZE."
- LIVE: green badge + text "LIVE."
- Each badge also includes a distinct icon (specific icon per state, not only color) for operators who cannot distinguish color.

**72h Autonomy Countdown:** three indicators simultaneously — numeric display ("8h 23m remaining"), color (red at this value), and text label ("Critical — less than 12 hours of autonomous operation remaining"). All three present at all times the indicator is shown.

**Section headers:** keyboard-accessible. Enter/Space to collapse/expand. Tab order follows visual order (Section 1 → 2 → 3 → 4 → 5).

**Timestamps:** all timestamps shown as relative + absolute on hover. The hover tooltip is also accessible via keyboard focus (same content shown in a tooltip on focus as on hover).

**Links to CMS sub-workspaces:** all links use descriptive text that describes the destination and action. "Open Schedule Manager for [venue name]" — not "Manage" or "Click here."

**Color contrast:** all text and icons meet a minimum 4.5:1 contrast ratio against their background in all badge and section states.

---

## Cognitive Load Considerations

**Default state (Sections 1–4 open, Section 5 collapsed):** operators see all the information needed for routine operations without scrolling. Section 5 is present when investigation is needed, but does not add cognitive load during normal operations.

**Section order is intentional and enforced:** Section 3 (content state) precedes Section 4 (actions). Operators always see what PRE has resolved before they see what they can do about it. This is not configurable per-operator.

**Resolution level first:** the resolution level badge is always the first visual element in Section 3. Operators know the PRE resolution level before they read content_ref or any other detail.

**Emergency content cannot be missed:** the emergency content indicator is in Section 1 — the only section that cannot be collapsed. An active Level 6 override is visible regardless of scroll position, regardless of which sections are collapsed.

**Action button positions are stable:** [Place Override] is always top-left in Section 4's action grid. [Declare Incident] is always bottom-right. These positions do not shift based on the current state. If an action is not available in a given state, its grid position shows a greyed placeholder with tooltip explaining why — the positions do not reflow. This allows muscle memory to develop: OPERATOR always reaches for the same location for the same action.

**Section collapse state persists per-session per-venue:** if an operator collapses Section 2 because they rarely need it, it remains collapsed when they navigate to other venues and return. The preference is not persisted across sessions — each new session starts with the default state (Sections 1–4 open, Section 5 collapsed).

---

*End of Venue Operations Dashboard Specification v1*
