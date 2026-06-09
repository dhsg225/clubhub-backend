# CMS and Content Operations Workspace — v1

**Document type:** Operational Surface Specification
**Workspace:** CMS and Content Operations
**Audience:** Frontend engineering, product, QA
**Constitutional basis:** PRE is the source of truth. CMS creates inputs to PRE. CMS does not command what plays.
**Version:** 1.0
**Status:** Authoritative

---

## Overview

The CMS and Content Operations Workspace is entered via Zone A navigation. Activating it replaces Zone B with the content management surface. Zone A and Zone C remain active throughout.

Zone C in CMS mode shows three persistent items:
- Approval queue status: count of pending items, oldest pending item age.
- Active schedule summary: count of active schedule blocks across all venues the operator has access to.
- Upcoming schedule changes: changes taking effect in the next 4 hours, ordered by time ascending.

This workspace handles: content asset management, schedule creation and editing, emergency override placement, approval workflows, sponsorship slot management, venue content assignment, and audit visibility of content decisions.

### The CMS-PRE Distinction

All content decisions that affect live screens go through PRE. The CMS does not directly command what plays. It creates the inputs — schedule blocks, overrides, sponsorship slots — that PRE evaluates against the governed clock and constitutional state.

This distinction is surfaced at every point where an operator might confuse "I scheduled this" with "this is playing now." The CMS uses the following language conventions throughout:

- "This will be evaluated by PRE" — not "this will play."
- "PRE resolved to this content" — not "the schedule is playing this."
- "Schedule block submitted for approval" — not "content scheduled."
- "Override placed — PRE will resolve immediately" — not "content switched."

Operators are never shown a direct cause-effect line between their CMS action and screen output. The PRE resolution path is always the visible intermediary.

---

## CMS Navigation Tabs

Six tabs within Zone B. Active tab highlighted. Tab switching does not reset Zone C.

| Tab | Name | Minimum Role |
|-----|------|--------------|
| 1 | Schedule Manager | VIEWER (read), OPERATOR (edit) |
| 2 | Override Control | OPERATOR |
| 3 | Content Library | VIEWER |
| 4 | Sponsorship Manager | OPERATOR (with sponsorship permissions) |
| 5 | Venue Assignments | ADMIN |
| 6 | Approval Queue | OPERATOR (own items), ADMIN (all items) |

---

## Tab 1: Schedule Manager

**Purpose:** Create, edit, and manage schedule blocks for venue screens.
**Primary operator:** OPERATOR (L2+). Viewing: VIEWER (L1). Approval: ADMIN or designated approver.

### Layout

- Left sub-panel (280px): venue/screen selector, date picker, view toggle (day/week).
- Main panel (fluid): schedule grid for selected venue and date range.
- Right sub-panel (240px): selected block detail and available actions.

Venue/screen selector in left sub-panel: dropdown ordered by venue group, then venue name. Operator sees only venues assigned to their account. ADMIN sees all venues.

Date picker: defaults to today. Day view and week view available. Week view columns are Mon–Sun.

### Schedule Grid

Rows represent time of day (00:00 to 23:59). Display resolution: 15-minute slots, scrollable. Each 15-minute slot is one row height unit. Taller blocks span proportionally.

Columns in day view: time labels (left) and a single content column (right). Columns in week view: time labels (left) and one column per day Mon–Sun.

Each schedule block is rendered as a colored rectangle spanning its time range. Block contains:
- content_ref: truncated to fit. Full value on hover.
- DOW constraint icon: small calendar icon, visible only if the block has a day-of-week restriction. Hovering icon shows "Active on: [day list]."
- Expiry date label: shown only if block has an expiry set. Format: "Expires [date]."

Block state colors:
- APPROVED / ACTIVE: solid fill, full opacity.
- PENDING (new or edit): dashed border, grey fill.
- EDIT PENDING: solid fill, amber dashed border.
- REMOVAL PENDING: solid fill, red dashed border, strikethrough on content_ref.
- DOW INACTIVE (block exists but DOW constraint means it does not apply today): lighter shade, "DOW INACTIVE" label.

Overlapping blocks are shown side-by-side as stacked columns within the affected time slot. Overlapping blocks are an unusual state. When an overlap exists, an amber warning icon appears in the time slot header: "Multiple blocks overlap this time slot. PRE resolves by priority." This is informational — PRE handles resolution. It is not an error.

### Adding a Block

1. Operator clicks an empty time slot or presses [+ Add Block].
2. A form opens in the right sub-panel with these fields:
   - content_ref: content selector drawing from Content Library. Search by asset name or content_ref.
   - starts_at: time picker, 15-minute resolution, pre-populated from clicked slot if applicable.
   - ends_at: time picker, 15-minute resolution.
   - DOW constraint: checkboxes Mon through Sun. Default: all selected.
   - Venue scope: radio group — "This venue only" / "Venue group: [name]" / "All my assigned venues."
3. [Preview PRE Resolution] button. Mandatory before submit if the block's time range overlaps any currently-live time slot. The button is not blocked for future-only blocks, but it is available and encouraged. Clicking it:
   - Sends a PRE preview request with this block in the evaluation set.
   - Uses the governed clock at the current real time for current-slot previews. Uses the governed clock at the start_at time for future previews.
   - Returns the full PRE resolution path: what would win, at what level, and why.
   - Result is displayed in the right sub-panel below the form, labeled "PRE Preview — not live until approved."
4. [Submit for Approval]: sends the block to the Approval Queue. Block appears in schedule grid in PENDING state (dashed border, grey fill). Block is not evaluated by PRE until approved.
5. ADMIN alternative: [Approve and Activate]. Skips the approval queue. Block activates immediately. Audit log records this as a self-approval with the ADMIN's operator_id and governed timestamp.

### Editing a Block

Clicking an existing block in the schedule grid opens the right sub-panel with block detail and these actions: [Edit], [Remove], [Preview PRE Impact].

[Edit] opens the same form pre-populated with current block values.

If the block being edited covers a currently-live time slot (its time range includes the current governed time and the block is ACTIVE): an amber notice appears at the top of the form: "This block is currently active. Changes will take effect immediately upon approval and may interrupt active content."

Edits go to the Approval Queue. The block shows in the schedule grid with "EDIT PENDING" state (amber dashed border). The original block remains active until the edit is approved.

ADMIN self-approval via [Approve and Activate] applies to edits as it does to new blocks.

### Removing a Block

[Remove] opens a confirmation modal with:
- Description of the block being removed.
- PRE impact preview: "If this block is removed, PRE will resolve to: [preview result]." The preview is computed at the time of the removal request.
- For any block that is currently active or active within the next 4 hours: PRE preview is mandatory. The [Confirm Removal] button is disabled until [Preview PRE Impact] has been clicked and a result returned.
- [Confirm Removal] [Cancel].

After confirmation: removal goes to the Approval Queue. Block shows in schedule grid with "REMOVAL PENDING" state (red dashed border, strikethrough on content_ref). The block remains active until the removal is approved.

### DOW Constraint Behavior

Schedule blocks with DOW constraints apply on matching days only. On non-matching days:
- Block is displayed in the schedule grid in lighter shade.
- Label reads "DOW INACTIVE."
- Block occupies the visual slot but PRE will not resolve it as a winner on this day.
- PRE preview for days with DOW-inactive blocks reflects this: the block does not appear in the resolution path.

Hovering the DOW constraint icon on any block shows: "Active on: [list of active days]."

### Conflict Detection

When a new block is submitted that overlaps in time with an existing block on the same venue:
- Right sub-panel shows a warning: "This block overlaps with '[existing block content_ref]' during [time range]. PRE resolves by level priority. Both blocks will be evaluated simultaneously."
- Warning is informational. It is not an error. PRE handles overlapping blocks correctly.
- Operator must acknowledge the warning by checking a checkbox before [Submit for Approval] activates.

### Replay Behavior

The schedule grid can be viewed in replay mode for any past date. Select a past date in the date picker to enter historical view.

In replay mode:
- Grid shows the schedule exactly as it existed at the end of that date.
- Blocks that were subsequently deleted are shown with a strikethrough and "DELETED [relative date]" label.
- Blocks that were created after the selected date are not shown.
- Edit, Add, and Remove actions are disabled. The right sub-panel shows block detail and [Preview PRE Impact] only — and Preview in replay mode shows historical PRE evaluation, not current.
- A persistent amber overlay banner spans the top of the schedule grid: "REPLAY MODE — schedule view is historical. No changes can be made."

---

## Tab 2: Override Control

**Purpose:** Place, manage, and remove content overrides.
**Primary operator:** OPERATOR (L2+). Emergency overrides: ADMIN or OPERATOR with elevated session.

### Layout

- Override Stack Display (left, 360px): current active overrides on the selected venue, ordered by level descending. Below the active stack: expired overrides from the last 24 hours, collapsed by default with expand toggle.
- Override Placement Form (right, fluid): form for a new override or for editing an existing override.

Venue selector at top of left panel. Defaults to the venue selected in Zone A.

### Current Override Stack

Each active override is displayed as a card. Card contents:

- Level badge: "L[N]" with label (e.g., "L5 — Operational Override").
- content_ref: displayed prominently. Copyable.
- Placed by: operator_id.
- Placed at: relative time. Hover shows absolute governed timestamp.
- Expires at: relative time. Hover shows absolute governed timestamp. If no expiry set: "No expiry" in amber.
- Scope badge: "This venue" / "Venue group: [name]" / "Fleet."
- [Remove Override]: OPERATOR can remove their own overrides. ADMIN can remove any override.
- [Preview Without This Override]: clicking sends a PRE preview request omitting this override. Returns what PRE would resolve to if this override were absent. Result shown inline below the card.

Override stack is ordered level descending (highest level override at top). Within the same level, ordered by placed_at ascending (oldest first).

**Override accumulation warning:** If the selected venue has more than 3 active overrides, an amber banner spans the top of the Override Stack Display: "Override debt: [N] active overrides on this venue. Overrides are operational debt. Review regularly and remove when no longer needed."

Expired overrides section (collapsed by default): shows overrides that expired or were removed in the last 24 hours. Each entry shows original placement details and removal/expiry event with timestamp. Read-only. [Expand] / [Collapse] toggle.

### Placing a New Override

1. [Place Override] button opens the form in the right panel.
2. Form fields:
   - Level: selector 1–5. Level 6 has a separate Emergency Override workflow (see below). Each level shown with label: 1 — Structural Fallback, 2 — Sponsorship, 3 — Campaign, 4 — Schedule, 5 — Operational Override.
   - content_ref: selector from Content Library.
   - Scope: radio group — "This venue" / "Venue group: [name]" / "All my assigned venues."
   - Expires at: datetime picker. Optional. If left empty and operator role is not ADMIN: warning displayed — "No expiry set. This override will remain active until manually removed. Consider setting an expiry." If left empty and operator is ADMIN: warning displayed — "No expiry set. This override will remain active indefinitely unless manually removed. Indefinite overrides require review."
   - Reason: required free-text field. Appended verbatim to the audit trail entry. Minimum 10 characters. Placeholder: "Describe why this override is needed."
3. [Preview PRE Resolution]: mandatory for any level 4 or 5 override before submission — [Submit for Approval] is disabled until preview has been run and returned a result. For levels 1–3: advisory — preview available but does not gate submission.
   - Preview shows the full PRE resolution path with the proposed override in the stack.
   - Result displayed below the form with label "PRE Preview — not live until approved."
4. [Submit for Approval]: sends override request to Approval Queue. Override card appears in the stack in PENDING state (grey, dashed border).
5. ADMIN alternative: [Place Now] — places override immediately without approval queue. Audit log records placement with ADMIN's operator_id, governed timestamp, and the reason field value.

Override placed via [Place Now] is immediately evaluated by PRE. PRE resolution updates on all affected screens within the next resolution cycle.

### Emergency Override (Level 6)

Entry point: [Declare Emergency Override] button. Visually distinct — red, separated from [Place Override]. Located at the bottom of the left Override Stack Display panel, below the stack cards.

Available to: OPERATOR with an active elevated session, ADMIN.

Workflow:

1. Clicking [Declare Emergency Override] opens a dedicated modal. The modal is full-screen overlay — it does not share space with the normal form layout.

2. Modal content:
   - Header: "Emergency Override — Level 6" in red.
   - Explanation: "A Level 6 Emergency Override will suppress ALL other content on the selected scope — schedule blocks, all lower-level overrides, campaigns, and sponsorships. PRE will resolve to EMERGENCY_CONTENT immediately upon placement. This action is logged with your identity and a governed timestamp. It cannot be undone silently — removal also requires explicit confirmation."
   - Reason field: required. Minimum 20 characters. Placeholder: "State the emergency and reason for emergency content activation."
   - Scope selector: "This venue" / "Venue group: [name]" / "All my assigned venues." Fleet-wide scope requires ADMIN role.
   - Confirmation field: type the word EMERGENCY to enable [Confirm Emergency Override].
   - [Confirm Emergency Override] [Cancel].

3. On confirm:
   - Override placed immediately. No approval queue.
   - PRE resolves to EMERGENCY_CONTENT on all affected venues within the next resolution cycle.
   - Zone A pane A2 (Active Incidents) highlights with "Emergency Content Active" indicator for all affected venues.
   - All affected venue entries in Zone A show a red emergency badge.
   - Zone C top updates to show: "Emergency Override active — [venue count] venue(s) affected. Placed by [operator_id] [relative timestamp]."

4. Override card in the stack shows: large red header "EMERGENCY OVERRIDE — LEVEL 6." Fields: reason (full text), placed_by, placed_at, scope. Expiry field: emergency overrides default to no expiry — shown as "No expiry — manual removal required" in red.

5. Removal of an emergency override:
   - [Remove Override] on an emergency override card opens a distinct removal modal.
   - Required: same elevated session or ADMIN role.
   - Reason field (required, minimum 20 characters): "State why emergency content is no longer needed."
   - Confirmation field: type CONFIRM REMOVAL to enable [Confirm Removal].
   - On confirm: override removed. PRE immediately re-evaluates. Normal resolution resumes. Removal logged with operator_id, governed timestamp, reason.

### Override Removal (Non-Emergency)

[Remove Override] on a non-emergency override card opens a confirmation modal:
- "Remove this override? PRE will re-evaluate immediately upon removal."
- PRE preview: "Without this override, PRE would resolve to: [preview result]." Preview is computed when the modal opens.
- Reason field (required for ADMIN removing another operator's override — optional for operator removing own).
- [Confirm Removal] [Cancel].

On confirm: override removed immediately (no approval queue for removal of own overrides by OPERATOR; ADMIN removal is also immediate). PRE re-evaluates. Removal logged.

---

## Tab 3: Content Library

**Purpose:** Browse, search, and select content assets. This tab is reference only — no content playback or asset file management. Asset files are managed in an external DAM.
**Access:** VIEWER and above (all roles).

### Layout

- Search and filter bar: full width, top.
- Content grid or list: main panel, fluid. Toggle between grid view and list view with icon button. Default: list view.
- Selected asset detail: right panel, 280px. Appears when an asset is selected.

### Content Asset Entry

Each asset shown as a row (list view) or card (grid view). Contents:

- Asset name: primary label.
- content_ref: URI, displayed below asset name, copyable via [Copy] icon.
- Asset type badge: VIDEO / IMAGE / LIVE_FEED / PLAYLIST / EMERGENCY.
- Duration: shown for VIDEO and PLAYLIST types. Format: M:SS or H:MM:SS.
- Approved for use badge: APPROVED (green) / PENDING APPROVAL (amber) / REJECTED (red).
- Assigned venues: count with tooltip listing venue names. Full list in detail panel.
- Last scheduled: relative timestamp. "Never scheduled" if no schedule history.

### Search and Filters

Search field: matches on asset name and content_ref. Case-insensitive substring match.

Filter controls (collapsible filter bar below search):
- Approved status: All / Approved only / Pending only.
- Asset type: All / VIDEO / IMAGE / LIVE_FEED / PLAYLIST / EMERGENCY.
- Venue assignment: show only assets assigned to a specific venue.

### Selected Asset Detail Panel

Clicking an asset opens the right detail panel:

- Full asset name.
- Full content_ref (copyable).
- Asset type.
- Duration (if applicable).
- Approved for use: status badge + approved_at timestamp (if approved) + approved_by (if approved).
- Venues assigned: full list, each venue name linkable to Venue Assignments tab.
- Last scheduled: relative + absolute timestamp, and which venue it was scheduled on.
- Schedule history: last 5 schedule entries (venue, time range, approved_by). Link to full audit trail.
- [View Audit Trail]: opens Replay & Forensics workspace filtered to content operations events for this content_ref.
- [Use in Schedule]: available when accessed from Schedule Manager flow — copies content_ref to clipboard and returns operator to Schedule Manager form.
- [Use in Override]: same, returns to Override Control form.

### Content Approval

Content approval status is read from source of record (external DAM or approval system). The CMS reflects current approval status. Approval workflow for content assets is not managed within the CMS. Assets in PENDING APPROVAL state can be referenced in schedule blocks and overrides, but a PENDING APPROVAL asset will not be resolved as a winner by PRE until it reaches APPROVED status.

Assets with REJECTED status are shown with the rejected badge but cannot be selected in the Schedule Manager or Override Control forms. If a previously-approved asset is rejected after a schedule block using it was already approved: the schedule block is automatically placed in SUSPENDED state and a notification sent to the ADMIN.

---

## Tab 4: Sponsorship Manager

**Purpose:** Manage sponsorship slots — the L2 layer in PRE content hierarchy. Sponsorship slots are additive (SOV-based), not exclusive content slots.
**Primary operator:** OPERATOR (L2+) with sponsorship permissions. ADMIN.

### Constitutional Constraint

Sponsorship cannot exceed SOV_MAX_EFFECTIVE (99.99% of content slots). At least one slot in every output is reserved for non-sponsored content. This enforcement is performed by PRE and cannot be overridden through the CMS. The Sponsorship Manager surfaces SOV values and warns when approaching limits. It does not prevent placement of contracts that would theoretically exceed the limit — PRE enforces the ceiling at resolution time.

### Layout

- Left panel (320px): sponsorship contract list — tabs for ACTIVE, SCHEDULED, EXPIRED, SUSPENDED.
- Right panel (fluid): selected contract detail and slot configuration.

### Sponsorship Contract Card (list view)

Each contract in the list shows:
- Sponsor name (primary label).
- Contract ID (secondary, grey).
- start_date — end_date.
- SOV target: the percentage this contract specifies.
- SOV effective: the percentage PRE is currently delivering after enforcement (may differ from target if other contracts compete).
- Status badge: ACTIVE (green) / SCHEDULED (blue) / EXPIRED (grey) / SUSPENDED (amber).
- Assigned venues: count.

Clicking a contract opens its detail in the right panel.

### Contract Detail Panel

- All fields from list card, expanded.
- Assigned venues: full list, each linkable to Venue Assignments tab.
- Slot configuration: content_refs for sponsored slots (one or more). Ordered list. Each content_ref with [Remove] (OPERATOR+).
- SOV weight: numeric. Editable (OPERATOR+).
- Daypart restrictions: time ranges when this sponsorship applies. Format: HH:MM–HH:MM. Multiple ranges allowed. Empty means all day.
- DOW restrictions: checkboxes Mon–Sun. Default: all selected.

Actions:
- [Edit Slot Config] (OPERATOR+): opens slot configuration form inline.
- [Suspend] (ADMIN): places contract in SUSPENDED state. PRE stops resolving this sponsorship until unsuspended. Reason field required.
- [Unsuspend] (ADMIN): restores contract from SUSPENDED state. Reason field required.
- [View PRE Impact]: runs PRE preview with this contract's current configuration. Shows how sponsored slots appear in current PRE output — SOV breakdown, which content_refs are receiving sponsored slots at current time.
- [Preview SOV Without This Contract] (ADMIN): shows what SOV would be across all active contracts if this contract were removed. Useful for reviewing suspension impact.

### Slot Configuration Form

- content_refs: multi-select from Content Library. At least one required.
- SOV weight: integer 1–100.
- Daypart restrictions: time range picker. [Add Range] / [Remove Range].
- DOW restrictions: checkboxes.
- [Preview PRE Resolution with this sponsorship]: mandatory before save. Shows playlist composition at current time with proposed configuration.

Changes to SOV weight and content_refs require ADMIN approval. Changes to daypart and DOW restrictions require OPERATOR approval. Form clearly labels which field changes require which approval level.

### SOV Warnings

When slot configuration is saved or previewed, the system checks combined SOV for each affected venue:
- Combined SOV 80–90%: amber notice "Combined SOV on [venue] is [N]%. Monitor allocation."
- Combined SOV > 90%: amber warning "Combined SOV on [venue] is [N]%. Approaching platform maximum. Review sponsorship allocation."
- Combined SOV > 99.99%: the SOV_MAX_EFFECTIVE ceiling. PRE will enforce this automatically. Warning shown: "Combined SOV on [venue] exceeds platform maximum. PRE will cap delivery at 99.99%. Non-sponsored content slots will be preserved by PRE enforcement."

### Approval Workflow

New sponsorship contracts: require ADMIN approval. Contract shows as SCHEDULED (pending approval) until approved.
SOV weight changes: require ADMIN approval.
content_ref changes: require ADMIN approval.
Daypart and DOW restriction changes: require OPERATOR (L2+) approval — handled by designated approver, not necessarily ADMIN.
Suspension and unsuspension: ADMIN direct action, no separate approval queue.

All changes go to the Approval Queue (Tab 6) before taking effect.

---

## Tab 5: Venue Assignments

**Purpose:** Assign content rules and permissions to venues.
**Primary operator:** ADMIN only.

### Layout

- Left panel (280px): venue/venue group selector. Hierarchical: venue groups listed first, venues nested under groups. ADMIN sees all.
- Right panel (fluid): assignment detail for the selected venue or venue group.

### Venue Assignment Panel

The right panel for a single venue shows:

**Active Schedule Blocks:** list of all approved schedule blocks assigned to this venue. Columns: content_ref, time range, DOW constraint, expiry. [Open in Schedule Manager] link.

**Active Sponsorship Contracts:** list of active contracts assigned to this venue. Columns: sponsor name, SOV effective, status. [Open in Sponsorship Manager] link.

**Operator Permissions:** list of operators with access to this venue. Columns: operator_id, display name, role on this venue (VIEWER / OPERATOR / ADMIN), access granted date, granted by. Actions:
- [Add Operator Access] (ADMIN): opens form — select operator_id, select role, [Confirm]. Logged with ADMIN's operator_id and governed timestamp.
- [Modify Role] (ADMIN): change operator's role on this venue. Confirmation required. Logged.
- [Remove Access] (ADMIN): remove operator's access to this venue. Confirmation modal: "Remove [operator_id] from this venue? They will no longer be able to view or manage content for this venue." Logged.

**Content Approval Restrictions:** any content type restrictions specific to this venue (e.g., "No LIVE_FEED content approved for this venue"). Managed by ADMIN. [Add Restriction] [Remove Restriction].

**Emergency Contact:** venue's designated emergency operator — the OPERATOR with primary responsibility for this venue in incident scenarios. Name, operator_id, contact information. [Set Emergency Contact] (ADMIN). Used in incident workflows to surface contact information to the Incident Commander.

### Venue Group Panel

When a venue group is selected, the right panel shows:
- Group name and group ID.
- Venues in group: list, each linkable to that venue's individual assignment panel.
- Shared schedule blocks assigned to the group (applied to all venues in the group).
- Shared sponsorship contracts assigned to the group.
- [Add Venue to Group] (ADMIN). [Remove Venue from Group] (ADMIN) — confirmation required.
- Operator permissions are managed per-venue, not per-group. This limitation is stated explicitly in the group panel.

Schedule and override placement on a group applies simultaneously to all venues in the group. PRE evaluates these group-level assignments for each venue independently — group placement is shorthand for per-venue placement, not a single resolution.

---

## Tab 6: Approval Queue

**Purpose:** Review and action pending schedule changes, override placements, and content changes.
**Access:** ADMIN sees all items. OPERATOR sees only their own submitted items. VIEWER has no access to this tab (tab is not shown in navigation for VIEWER role).

### Layout

- Left panel (400px): queue list.
- Right panel (fluid): selected item detail and action controls.

### Queue List

Items ordered by submitted_at ascending (oldest item at top). Tabs: PENDING / APPROVED / REJECTED / EXPIRED. Default view: PENDING.

Each list item shows:
- Request type badge: SCHEDULE_ADD / SCHEDULE_EDIT / SCHEDULE_REMOVE / OVERRIDE_PLACE / OVERRIDE_REMOVE / SPONSORSHIP_CHANGE.
- Submitted by: operator_id.
- Submitted at: relative time. Hover for absolute governed timestamp.
- Affected venues: count with tooltip list.
- Status badge.
- Age indicator: items pending > 24 hours show amber age indicator. Items pending > 48 hours show red indicator and are approaching expiry.

### Queue Item Detail

Clicking a list item shows detail in the right panel:

- Full request description: what is being added, edited, removed, or changed.
- Submitted by, submitted at (governed timestamp).
- Affected venues: full list.
- Reason field: operator's stated reason (displayed verbatim).
- PRE preview result: computed at submission time. Shown inline labeled "PRE Preview at submission time — not a live resolution." Format identical to the preview panel in Schedule Manager and Override Control.

### Approval Actions (ADMIN only)

Three actions available in the right panel for PENDING items:

[Approve]:
- Item activates immediately.
- Audit log entry: item_id, approved_by (ADMIN operator_id), governed timestamp.
- Submitting operator receives notification: "Your [request type] for [venue] was approved."

[Reject]:
- Reason field: required, minimum 10 characters.
- [Confirm Rejection].
- Audit log entry: item_id, rejected_by, governed timestamp, reason.
- Submitting operator receives notification: "Your [request type] for [venue] was rejected. Reason: [text]."
- Item moves to REJECTED tab.

[Request Clarification]:
- Message field: required. Text sent to submitting operator.
- Item remains in PENDING state.
- A "CLARIFICATION REQUESTED" label appears on the list item.
- Submitting operator can respond via their own PENDING items view — response shown in the item thread.

### Expired Items

Items not actioned within 48 hours of submission automatically move to EXPIRED state. This is logged.

In the EXPIRED tab (ADMIN only):
- Each expired item shows original submission details and expiry timestamp.
- ADMIN can [Mark as Withdrawn] (records administrative closure, notifies submitter) or [Resubmit] (creates a new queue entry identical to the original, resets the clock, notifies submitter that it has been resubmitted on their behalf).

### OPERATOR View

OPERATOR sees only their own submitted items across all status tabs. They cannot see items submitted by other operators. Queue detail is read-only for OPERATOR — no approval actions visible. Operators can see:
- Their item's current status.
- Whether clarification has been requested.
- The reason for rejection if rejected.

---

## Audit Visibility (All CMS Tabs)

Zone C (right intelligence panel) in CMS mode shows a persistent audit indicator at the bottom of each tab view: "Last change on [selected venue]: [description] by [operator_id] [relative timestamp]." Hover shows absolute governed timestamp.

[View Full Audit Trail] in Zone C opens the Replay & Forensics workspace pre-filtered to the current venue and content operations event types. This link is available on every CMS tab.

Operators cannot see each other's in-progress form state. Only submitted and approved changes are visible to other operators. In-progress form data is local session state only — it does not persist, sync, or become visible to other operators until [Submit for Approval] or [Place Now] is pressed.

---

## Degraded-Network Behavior

All CMS tabs degrade gracefully when the platform backend is unreachable.

**Schedule Manager:**
- If backend unavailable: schedule grid shows last-cached state. Amber banner across grid: "Displaying cached schedule — last updated [timestamp]. Edit actions are disabled."
- [+ Add Block], [Edit], [Remove] actions are disabled. Buttons shown greyed with tooltip "Unavailable — connection required."
- [Preview PRE Resolution] also disabled — preview requires live backend evaluation.

**Override Control:**
- If unavailable: override stack shows last-known state as grey list. Amber banner: "Override state may be stale — displaying last known data. Placement actions disabled."
- [Place Override], [Place Now], [Declare Emergency Override], [Remove Override] all disabled.

**Approval Queue:**
- If unavailable: amber banner "Approval queue offline — pending items may not be shown." ADMIN approval actions disabled. List shows last-cached items with "CACHED" label.

**Content Library:**
- If unavailable: last-cached asset list shown with "Displaying cached content library" banner. [View Audit Trail] disabled.

**On reconnect:** all CMS tabs perform a full data refresh automatically. Amber banners clear. A transient green notice "Connection restored — data refreshed" appears for 3 seconds.

---

## Replay Behavior (All CMS Tabs)

Any CMS tab can be viewed in replay mode. Replay mode is entered by setting the governed clock to a historical timestamp in the Replay & Forensics workspace and then navigating to the CMS.

In replay mode, every CMS tab shows:
- A persistent amber overlay banner spanning the top of Zone B: "REPLAY MODE — historical view at [governed timestamp]. No changes can be made."
- All data shown reflects the state at the replay timestamp.
- Edit, add, remove, and approval actions are all disabled.

**Schedule Manager in replay mode:** grid shows schedule as it existed at the replay timestamp. Blocks subsequently deleted shown with strikethrough. Blocks created after the replay timestamp not shown.

**Override Control in replay mode:** override stack shows overrides that were active at the replay timestamp. Expired overrides shown as active if their expiry was after the replay timestamp.

**Approval Queue in replay mode:** queue shows items that were in the queue at the replay timestamp, with their status at that time.

**Sponsorship Manager in replay mode:** contracts and SOV shown as of the replay timestamp.

---

*End of CMS and Content Operations Workspace Specification v1*
