# Operational Workflow Architecture v1

**Document class:** Implementation-grade operational specification
**Status:** Authoritative
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, REPLAY-AND-FORENSICS-WORKSPACE-SPECIFICATION-v1.md, CMS-AND-CONTENT-OPERATIONS-WORKSPACE-v1.md, VENUE-OPERATIONS-DASHBOARD-v1.md

---

## Purpose

This document defines canonical operational workflows across the ClubHub TV platform. Each workflow defines the precise sequence of steps an operator follows, the system state at each step, the authority required, the audit record produced, and the replay expectations.

This document does not redefine surface layout or component behavior. It defines how operators move through the system over time to accomplish operational objectives.

**Constitutional constraints in force across all workflows:**

- PRE is the source of truth. No workflow step changes what PRE resolves — it only changes the inputs PRE evaluates.
- No operator action that affects content delivery takes effect without a governed audit event.
- All state transitions carry: actor, governed timestamp, prior state, new state, reason.
- Corpus is append-only and hash-chained. No workflow step silently removes history.
- Replay of any past operational state is possible from the corpus alone.
- No operational state may exist only in a human's head.

---

## Workflow 1: Incident Lifecycle

### Start Conditions

One or more of the following:

- System detects an anomaly meeting the WATCHING threshold on a monitored metric.
- An OPERATOR+ manually declares an incident via the [Declare Incident] button in the Venue Operations Dashboard.
- Constitutional state transitions to CONSTITUTIONAL_RISK or worse — auto-escalates to an S3 incident.

### End Conditions

All three must be true simultaneously:

- Incident machine state = RESOLVED.
- Incident commander closes the incident record.
- Post-incident annotation is complete: root cause noted in the incident log with a minimum of 20 characters of explanatory text.

### Step Sequence

**Step 1 — Incident Record Creation**

System state entering this step: anomaly detected or operator has clicked [Declare Incident].

The platform creates an incident record containing: `incident_id` (deterministic, generated from scope + governed_timestamp), `severity_estimate` (S1–S5), `scope` (venue / venue group / fleet), `declared_by` (operator_id or "SYSTEM"), `declared_at` (governed timestamp from PRE clock), `description` (minimum 20 characters; required for operator-declared incidents).

For system-declared incidents triggered by constitutional state change: description populated automatically as "Constitutional state transition to [state] detected." Operator may augment but not remove this initial description.

System state after this step: incident record exists in append-only incident log. Incident is in DECLARED state.

**Step 2 — Incident Commander Assignment**

System state entering this step: incident in DECLARED state.

Auto-assigned to the declaring operator. For system-declared incidents: assigned to the first OPERATOR+ who opens the incident record. If no operator opens the incident record within 5 minutes: unassigned incident alert raised in Zone A Pane A2 for all OPERATOR+ users with access to the affected scope.

Transferable via Command Transfer modal in IC-TOP. See Incident Commander Transfer in SHIFT-HANDOFF-AND-CONTINUITY-v1.md.

System state after this step: incident_commander_id populated. IC-TOP in Incident Commander Surface shows commander identity.

**Step 3 — Zone B Surface Transition**

System state entering this step: incident in DECLARED state, commander assigned.

Zone B switches to Incident Commander Surface for all OPERATOR+ users currently viewing the affected venue. VIEWER role users viewing the affected venue receive a Level 2 notification banner but Zone B does not automatically replace for VIEWER — they must navigate manually.

For S1-S2: Zone B replacement is automatic and cannot be dismissed by any operator until the incident reaches CONTAINED state.

System state after this step: all OPERATOR+ users viewing the affected venue are on the Incident Commander Surface.

**Step 4 — Scope Confirmation**

System state entering this step: Incident Commander Surface visible.

Incident commander reviews and confirms scope: venue, venue group, or fleet. If scope is incorrect (e.g., a fleet-wide network issue was initially scoped to one venue), commander selects [Adjust Scope] in IC-TOP. Scope adjustment is logged as a scope_change event with prior_scope, new_scope, adjusted_by, governed_timestamp, reason.

System state after this step: incident scope confirmed and locked unless subsequently adjusted.

**Step 5 — Recovery Pathway Loading (S1-S2 only)**

System state entering this step: S1 or S2 incident with confirmed scope.

Constitutional recovery pathway loaded in IC-RIGHT Panel R3. Pathway is read-only and determined by incident severity and constitutional state. Incident commander follows pathway steps sequentially. Each step completed is logged.

For S3-S5: constitutional recovery pathway panel is not automatically loaded. Incident commander proceeds to investigation as needed.

**Step 6 — Replay Investigation Session (S3+)**

System state entering this step: S3, S4, or S5 incident in DECLARED state.

Replay & Forensics workspace session opened and linked to `incident_id`. Session created with: session_id, scope (matching incident scope), anchor_timestamp (set to declared_at minus 15 minutes by default), initiated_by (incident_commander_id).

For S1-S2: replay session is optional at commander discretion. Platform does not block S1-S2 progression on absence of replay session.

System state after this step: replay session record exists in audit trail with incident_id linkage.

**Step 7 — Containment**

System state entering this step: incident in DECLARED state, root cause investigation underway.

Before CONTAINED state can be set:

1. Incident commander adds at least one OPERATOR_NOTE to the incident log since DECLARED state was entered. Note must include: what was observed, hypothesis or confirmed cause. Minimum 20 characters.
2. Root cause must be identified (may be preliminary for fast-moving incidents) and noted in the incident log.
3. Containment action must be taken: an operator action (override, schedule change, enrollment trigger, or explicit annotation "no platform action required because [reason]").

For S4-S5 incidents: OPERATOR+ may set CONTAINED state.
For S3+ incidents: ADMIN only may set CONTAINED state.

System state after this step: incident in CONTAINED state. CONTAINED_at timestamp logged.

**Step 8 — Post-Containment PRE Verification**

System state entering this step: incident in CONTAINED state.

Incident commander opens PRE resolution preview for the affected scope and confirms that PRE is resolving to the expected output. Confirmation is one of:

- [PRE output confirmed — resolution is correct]: logs `pre_verification_event` with operator_id, governed_timestamp, expected_resolution, actual_resolution, match = true.
- [PRE output unexpected — do not resolve]: incident remains in CONTAINED state. New note added. Investigation continues.

If PRE is in fallback mode (L5 or higher suppression level active): [Mark CONTAINED] button remains available but the PRE resolution level is displayed in IC-BOTTOM. Confirmation modal adds: "WARNING: PRE is currently resolving to LEVEL [N] FALLBACK. The content now serving may not be the intended schedule. Are you certain this is the expected state? [Confirm] [Cancel]."

System state after this step: PRE verification event logged. If match = true: incident may proceed to RESOLVED.

**Step 9 — Closing Annotation**

System state entering this step: post-containment PRE verification completed.

Incident commander adds a closing annotation before RESOLVED state is set. Minimum required content: root cause (confirmed or best available), whether PRE behaved as expected during incident, one-line resolution description. Minimum 40 characters.

[Resolve Incident] button disabled until closing annotation has been submitted.

System state after this step: closing annotation logged as INCIDENT_CLOSE_NOTE with operator_id, governed_timestamp.

**Step 10 — Resolution**

System state entering this step: closing annotation submitted.

Incident commander clicks [Resolve Incident]. For S4-S5: OPERATOR+ may resolve. For S3+: ADMIN only may resolve.

System records RESOLVED event: `resolved_by`, `resolved_at` (governed_timestamp), `duration` (resolved_at minus declared_at, stored as integer milliseconds), `resolution_summary` (from closing annotation, up to 500 characters extracted by platform or manually entered).

System state after this step: incident in RESOLVED state. Zone B returns to normal workspace for all operators who were on Incident Commander Surface. A resolution banner is displayed in System Status Bar for 60 seconds: "[Incident ID] resolved — [duration]."

### Optional Steps

- Evidence package generation by ADMIN: package_id, incident_id, created_by, hash-linked to corpus snapshot.
- Counterfactual replay session: "what if this override had not been placed" — available in Tab 6 of Replay & Forensics workspace, ADMIN only.
- Escalation to platform engineering: generates a structured alert with incident_id and last 10 log entries. No UI side effects. Logged as ESCALATION_RAISED event.
- Command transfer to another operator: covered in INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md.

### Forbidden Shortcuts

**FS-01: Setting CONTAINED without annotating root cause**
- Forbidden behavior: clicking [Contain Incident] without adding at least one OPERATOR_NOTE event to the incident log since DECLARED state.
- Operational consequence: incident log is incomplete; root cause cannot be determined from replay alone; post-incident analysis is impossible without human recollection.
- Verification method: CONTAINED transition is blocked in the UI until at least one OPERATOR_NOTE event exists in the incident log after DECLARED_at. Backend enforces same precondition: PATCH /incidents/:id/state returns 422 if precondition not met.

**FS-02: Setting RESOLVED while PRE is in fallback**
- Forbidden behavior: resolving an incident while PRE is still resolving to L5 or higher suppression level, without acknowledging the fallback state.
- Operational consequence: venue left in undisclosed degraded state recorded as resolved; future operators assume venue is healthy.
- Verification method: [Resolve Incident] button surface displays the PRE current resolution level. If L5 or worse: confirmation modal adds "WARNING: PRE is currently resolving to LEVEL 5 FALLBACK. Are you certain this is the expected state?" Two-click confirmation required (modal → [Confirm Resolve]).

**FS-03: Dismissing DEGRADED notification without accountability**
- Forbidden behavior: dismissing a DEGRADED constitutional state notification without either escalating to an incident or annotating the reason escalation is not required.
- Operational consequence: degradation enters the audit trail without an accountable actor; future investigation cannot distinguish genuine degradation from acknowledged safe degradation.
- Verification method: when constitutional state returns to HEALTHY from DEGRADED without an associated incident record, the platform auto-generates a system annotation appended to the venue timeline: "State normalized without incident declaration. No operator accountability logged. Constitutional state was DEGRADED from [from_ts] to [to_ts]."

**FS-04: Skipping incident declaration for acknowledged S4+ degradation**
- Forbidden behavior: an OPERATOR+ acknowledges a DEGRADED banner or opens the Venue Operations Dashboard for a venue in DEGRADED state, then navigates away without initiating an incident or adding an annotation.
- Operational consequence: operator awareness logged without follow-through; audit trail shows acknowledgement but no response.
- Verification method: when an OPERATOR+ acknowledges a DEGRADED state banner without a subsequent incident record or annotation within 15 minutes, a system-generated note is added to the venue timeline: "Operator [id] acknowledged DEGRADED state at [ts]. No incident declared and no annotation added within 15 minutes."

### Authority Requirements

| Transition | Minimum role | Notes |
|---|---|---|
| WATCHING → DECLARED (manual) | OPERATOR+ | Any OPERATOR or ADMIN on affected venue |
| WATCHING → DECLARED (auto) | SYSTEM | Constitutional state trigger |
| DECLARED → CONTAINED (S4-S5) | OPERATOR+ | |
| DECLARED → CONTAINED (S3+) | ADMIN only | |
| CONTAINED → RESOLVED (S4-S5) | OPERATOR+ | |
| CONTAINED → RESOLVED (S3+) | ADMIN only | |
| DECLARED → S1 FREEZE | SYSTEM | Not operator-triggered |
| S1 freeze resolution | ADMIN only | Requires human authorization token |

### Replay Expectations

- Every incident has a replayable event sequence linkable by `incident_id`.
- Replay shows all events from the first WATCHING event through RESOLVED, in governed-timestamp order.
- All operator annotations are visible in replay at their original governed timestamps.
- PRE resolution trace is available at every timestamp during the incident duration.
- Replay of the full incident lifecycle must be possible from corpus alone — no human-held state required.
- Evidence packages (if generated) are hash-linked and accessible in replay.

### Audit Requirements

- Incident record: `incident_id`, `severity_estimate`, `scope`, `declared_by`, `declared_at`, `description`.
- Every state transition: `from_state`, `to_state`, `transitioned_by`, `governed_timestamp`, `reason`.
- Every operator note: `note_id`, `incident_id`, `operator_id`, `governed_timestamp`, `text`.
- PRE verification event: `incident_id`, `operator_id`, `governed_timestamp`, `expected_resolution`, `actual_resolution`, `match` (boolean).
- RESOLVED event: `resolved_by`, `resolved_at`, `duration_ms`, `resolution_summary`.
- Evidence package (if generated): `package_id`, `incident_id`, `created_by`, `created_at`, `hash`.
- All records append-only. No incident record field may be modified after write — only appended to.

---

## Workflow 2: Schedule Modification Lifecycle

### Start Conditions

- OPERATOR+ opens CMS Schedule Manager for a venue to which they are assigned.
- Operator clicks an empty time slot or [+ Add Block] to create a new block, OR selects an existing block to edit or remove.

### End Conditions

One of the following terminal states:

- Block is ACTIVE: approved, within time window, DOW constraint satisfied, no higher-priority block suppressing it.
- Block is EXPIRED: `ends_at` has passed; block no longer active but remains in corpus.
- Block is REMOVED: approved removal executed; block visible in history but no longer in active schedule.
- Block is REJECTED: approval queue decision was REJECTED; block never became active.

### Step Sequence — New Block

**Step 1 — Form Completion**

System state entering this step: empty slot clicked or [+ Add Block] selected.

Operator completes the block creation form:

- `content_ref`: required. Points to a content item existing in the corpus.
- `starts_at`: required. Must be a future timestamp (minimum 5 minutes ahead for schedule blocks; emergency overrides follow Override Lifecycle).
- `ends_at`: required. Must be after `starts_at`.
- `dow_constraint`: optional. Days-of-week bitmask. If not set: block applies every day.
- `scope`: required. Venue or venue group. Defaults to currently selected venue.
- `note`: optional. Operator rationale. If provided, appended to audit trail.

System state after this step: form data validated client-side. [Submit] button is not yet enabled.

**Step 2 — Overlap Acknowledgement (conditional)**

System state entering this step: form data valid.

If the proposed block overlaps any active or upcoming time slot in the schedule grid: a warning banner appears above the form:

"Multiple blocks overlap this slot — PRE resolves by priority. The active block during this window will be determined by PRE at resolution time. Acknowledge to continue: [Acknowledge overlap]."

Operator must click [Acknowledge overlap]. This logs a `SCHEDULE_OVERLAP_ACKNOWLEDGED` event with operator_id, governed_timestamp, and the IDs of conflicting blocks.

If no overlap: this step is skipped.

System state after this step: overlap acknowledged (or no overlap). [Preview PRE Resolution] button now enabled.

**Step 3 — PRE Resolution Preview (mandatory for live slots)**

System state entering this step: form data valid, overlap acknowledged if applicable.

If the proposed block affects a currently-live time slot (starts_at is now or within the next 30 minutes): [Preview PRE Resolution] must be clicked before [Submit] is enabled.

On click: platform sends proposed block to PRE in preview mode (no corpus write). PRE resolves the full schedule stack including the proposed block and returns: `would_serve_content_ref`, `winning_priority_level`, `block_id_that_wins`, `reason`.

Preview result is displayed in the form panel: "If this block is placed, PRE would serve: [content_ref] (via [winning block description])."

Preview click timestamp logged as `schedule_preview_clicked_at`. Preview result logged as `schedule_preview_result`.

For blocks with `starts_at` beyond the live window: preview is advisory (button visible, not required before [Submit]).

System state after this step: preview result displayed. [Submit] button enabled.

**Step 4 — Submission**

System state entering this step: form complete, required previews clicked.

Operator clicks [Submit]. Block enters PENDING state in the schedule grid (shown with dashed border).

- ADMIN role: may self-approve via [Approve and Activate] button visible on their own submissions. If self-approving: block goes directly to ACTIVE state, skipping approval queue.
- OPERATOR role: submission goes to approval queue. Block remains PENDING. Submitting operator cannot approve their own submission.

Submission event logged: `block_id`, `submitted_by`, `submitted_at`, `preview_result_hash` (hash of PRE preview result at submission time), `form_data_hash`.

System state after this step: block in PENDING state. Approval queue updated for ADMIN users assigned to the venue.

**Step 5 — Approval Review**

System state entering this step: block in PENDING state in approval queue.

ADMIN approver sees: block detail, PRE preview result from submission time (stored at Step 4), submitting operator identity, submission timestamp, time elapsed since submission.

Approver actions:
- [Approve]: block transitions to ACTIVE at next applicable time window. `approved_by`, `approved_at` logged.
- [Reject]: rejection reason required (minimum 10 characters). Block transitions to REJECTED. `rejected_by`, `rejected_at`, `rejection_reason` logged. Submitting operator notified via Zone C advisory.

If no approver acts within 24 hours: advisory alert raised in Zone C for all ADMIN users assigned to the venue. Block remains PENDING — not auto-approved, not auto-rejected.

System state after this step: block in ACTIVE, PENDING (if still awaiting), or REJECTED state.

**Step 6 — Activation**

System state entering this step: block approved.

Block transitions to ACTIVE at the next applicable time window (when current time enters the `starts_at` to `ends_at` range and DOW constraint is satisfied). PRE immediately includes this block in subsequent resolution cycles.

`BLOCK_ACTIVATED` event logged: `block_id`, `activated_at`.

### Step Sequence — Block Removal

**Step 1 — Remove Initiated**

Operator clicks existing block in schedule grid → [Remove Block].

System state entering this step: block in ACTIVE, PENDING, or EXPIRED state (EXPIRED blocks can be removed from the visible history to move them to archive view, but this does not delete corpus records).

**Step 2 — PRE Resolution Preview Without This Block (conditional)**

System state entering this step: operator has clicked [Remove Block].

If block is currently active OR becomes active in the next 4 hours: [Preview PRE Resolution Without This Block] is mandatory before [Submit Removal] is enabled.

On click: PRE resolves schedule stack without the targeted block. Result displayed: "Without this block, PRE would serve: [content_ref] (via [winning block description], or 'no content defined for this window')."

Preview result logged at submission time.

System state after this step: preview result displayed. [Submit Removal] enabled.

**Step 3 — Removal Confirmation**

Operator sees confirmation modal:

"Remove this block?
Block: [content_ref], [starts_at] to [ends_at]
Without this block, PRE would serve: [preview output]
Confirm removal: [Remove] [Cancel]"

Operator clicks [Remove]. Removal request enters approval queue. Block shows "PENDING REMOVAL" state in schedule grid (shown with red-dashed border).

**Step 4 — Approval**

Same approval flow as new block approval. ADMIN approves or rejects.

If approved: block status set to REMOVED. PRE excludes block from subsequent resolution cycles. `BLOCK_REMOVED` event logged: `block_id`, `removed_by`, `removed_at`, `approved_by`, `approved_at`.

If rejected: block returns to prior state. Rejection reason logged.

### Optional Steps

- Operator adds `note` to block at any time post-creation (appended to audit trail, does not change block state).
- Operator sets `expiry_date` on block: block auto-removes at `expiry_date` without re-entering approval workflow. Expiry auto-removal logs `BLOCK_EXPIRED` event.
- Operator duplicates block to adjacent time slots: creates N new PENDING blocks in a single submission. Each treated as a separate block in the approval queue.

### Forbidden Shortcuts

**FS-01: Bypassing preview for currently-active slot modifications**
- Forbidden behavior: submitting a schedule change for a live slot (active or activating within 30 minutes) without having clicked [Preview PRE Resolution].
- Operational consequence: operator modifies content schedule without knowing what PRE will serve; venue may serve unintended content.
- Verification method: [Submit] button remains disabled until [Preview PRE Resolution] has been clicked. `preview_clicked_at` timestamp recorded and checked server-side at submission time. Server rejects submission with 422 if `preview_clicked_at` is absent for a live-slot change.

**FS-02: Self-approving changes as OPERATOR**
- Forbidden behavior: an OPERATOR (non-ADMIN) approving their own pending schedule change.
- Operational consequence: schedule change bypasses four-eyes review; single operator controls content unilaterally.
- Verification method: approval queue UI does not render the [Approve] button for the submitting operator's own pending items. Backend enforces the same rule: PATCH /schedule/blocks/:id/approve returns 403 if requesting user is the submitter.

**FS-03: Removing a block without entering the approval queue**
- Forbidden behavior: directly activating a block removal without it passing through the approval queue (except ADMIN self-approval).
- Operational consequence: unapproved content removal; no second-party review.
- Verification method: removal endpoint requires approval record. No direct-delete path for OPERATOR role.

### Authority Requirements

| Action | Minimum role | Notes |
|---|---|---|
| Draft / submit block | OPERATOR+ | For assigned venues only |
| Approve / reject block | ADMIN | Or designated venue approver |
| Direct activation (no queue) | ADMIN only | Self-approval with audit trail |
| Expiry auto-removal | SYSTEM | No operator action at expiry time |
| View pending queue | OPERATOR+ | Can view all; OPERATOR cannot approve own |

### Replay Expectations

- Schedule grid in Replay & Forensics workspace shows the historical schedule state at any replay timestamp.
- Each block's full lifecycle (PENDING → ACTIVE → EXPIRED/REMOVED) is visible in replay at governed timestamps.
- PRE resolution for any past time slot shows which schedule block was active and whether it was the winning block in the resolution stack.
- Overlap acknowledgements are visible in replay as SCHEDULE_OVERLAP_ACKNOWLEDGED events.

### Audit Requirements

- Every block creation, edit, approval, rejection, and removal logged with `operator_id` and `governed_timestamp`.
- Preview results logged at submission time: `preview_clicked_at`, `would_serve_content_ref`, `winning_priority_level`, `preview_result_hash`.
- Rejection reasons stored and queryable by `block_id`, `venue`, and `time_range`.
- Block full history queryable by `content_ref`, `operator_id`, `venue`, and time range.
- All records append-only.

---

## Workflow 3: Override Lifecycle

### Start Conditions

- OPERATOR+ opens CMS Override Control, OR
- Venue Operations Dashboard Section 4 [Place Override] is clicked.
- Platform is not in EMERGENCY_FREEZE state (overrides blocked during freeze — confirmed before [Place Override] is rendered).

### End Conditions

One of the following terminal states (overrides are never silently deleted):

- Override EXPIRED: `expires_at` reached. System removes from active resolution stack. Override remains visible in 24-hour history with EXPIRED badge.
- Override REMOVED: operator or ADMIN explicitly removes. Logged. Override remains in history.
- Override SUPERSEDED: a higher-level override has been placed — original remains in stack as a visible entry but does not win PRE resolution. Superseded overrides are shown in the stack with a SUPERSEDED badge.

### Step Sequence — Level 1-5 Override

**Step 1 — Form Completion**

Operator selects: `level` (1–5), `content_ref`, `scope` (venue / venue group), `expires_at` (optional but restricted — see FS-02), `reason` (required, minimum 20 characters).

System state after this step: form data valid. [Preview PRE Resolution] button enabled.

**Step 2 — PRE Resolution Preview**

For Level 4-5: [Preview PRE Resolution] is mandatory. [Place Override] button disabled until preview clicked.

For Level 1-3: [Preview PRE Resolution] is advisory. Button visible and labeled "Preview (recommended)." Not blocking.

On preview click: PRE resolves with the proposed override active. Result displayed: "With this override, PRE would serve: [content_ref] (Override at Level [N] wins over schedule block [description])."

Preview result logged: `preview_clicked_at`, `preview_result`.

System state after this step: for Level 4-5, preview clicked and result confirmed. [Place Override] enabled.

**Step 3 — Submission**

Operator clicks [Place Override]:

- Level 1-3 placement by ADMIN: override becomes ACTIVE immediately. No approval queue.
- Level 1-3 placement by OPERATOR: enters approval queue. Override shows PENDING status in active stack.
- Level 4-5 placement by ADMIN: override becomes ACTIVE immediately (mandatory preview must have been clicked).
- Level 4-5 placement by OPERATOR: enters approval queue. Override shows PENDING status.

Submission event logged: `override_id`, `level`, `content_ref`, `scope`, `expires_at`, `placed_by`, `placed_at`, `reason`, `preview_result_hash`.

**Step 4 — PRE Re-evaluation (on activation)**

System state entering this step: override is ACTIVE (either directly placed by ADMIN or approved via queue).

PRE immediately re-evaluates the resolution stack for all affected scope. The new override appears as a WIN or SUPPRESSED entry depending on its level relative to other active overrides.

PRE resolution trace updated. Next PRE resolution cycle reflects override.

`OVERRIDE_ACTIVATED` event logged: `override_id`, `activated_at`, `pré_resolution_result`.

**Step 5 — Stack Visibility**

Override appears in the active stack in Venue Operations Dashboard Sub-panel B.

Active stack entry shows: level, content_ref, placed_by, placed_at, expiry status, WIN or SUPPRESSED indicator.

### Step Sequence — Level 6 Emergency Override

**Step 1 — Initiation**

Operator locates [Declare Emergency Override] — a distinct red button, separate from the standard [Place Override] button. This button is only visible to ADMIN users or OPERATOR users with an active elevated session.

System state entering this step: operator has located the emergency override button.

**Step 2 — Confirmation Modal**

Three-field confirmation modal:

1. `reason`: required, minimum 30 characters.
2. `scope`: venue, venue group, or fleet. Operator must explicitly select (no default to fleet).
3. Confirmation text field: operator types "EMERGENCY" exactly (case-sensitive) to enable [Declare].

No approval queue. No preview requirement (speed is priority in genuine emergency).

**Step 3 — Immediate Activation**

On [Declare]: override logged and immediately ACTIVE. PRE resolves to EMERGENCY_CONTENT on the selected scope within one resolution cycle.

All affected venue entries in Zone A show an emergency content indicator badge.

Venue Identity Header (Section 1) in Venue Operations Dashboard shows "EMERGENCY CONTENT ACTIVE" badge for all affected venues.

`EMERGENCY_OVERRIDE_PLACED` event logged: `override_id`, `level = 6`, `scope`, `reason`, `placed_by`, `placed_at`, `session_elevation_token` (if elevated session), `confirmation_text = "EMERGENCY"`.

### Optional Steps

- Setting `expires_at` on Level 1-5 overrides (recommended; see FS-02 for restrictions on omitting this).
- Adding a note to an active override after placement: appended to override record with `operator_id` and `governed_timestamp`.
- Previewing "remove this override" counterfactual before removal: available via [Preview Without This Override] on the override stack entry.

### Forbidden Shortcuts

**FS-01: Placing Level 6 override without elevated session or ADMIN role**
- Forbidden behavior: OPERATOR without an elevated session accessing or using [Declare Emergency Override].
- Operational consequence: unauthorized emergency content broadcast on potentially venue-wide or fleet-wide scope.
- Verification method: [Declare Emergency Override] button is entirely absent from the DOM for OPERATOR users without elevated session. Elevated session state is checked server-side at override creation time; Level 6 override creation by non-elevated OPERATOR returns 403.

**FS-02: Level 3-5 override with no expiry without explicit acknowledgement**
- Forbidden behavior: submitting a Level 3-5 override with no `expires_at` without the submitting operator explicitly acknowledging the risk.
- Operational consequence: permanent override accumulates in the active stack unmanaged; future operators may not notice content is being overridden indefinitely.
- Verification method: for OPERATOR role, `expires_at` is a required field — form does not submit without it. For ADMIN role, omitting `expires_at` surfaces an acknowledgement checkbox: "No expiry set. This override will remain active indefinitely unless manually removed. I understand: [checkbox]." [Place Override] disabled until checkbox checked. ADMIN acknowledgement logged as `NO_EXPIRY_ACKNOWLEDGED` event.

**FS-03: Removing Level 6 override without authorization**
- Forbidden behavior: removing a Level 6 emergency override without elevated session or ADMIN role, and without completing the three-step removal confirmation.
- Operational consequence: emergency content removed without accountability; potential content gap if no other schedule is active.
- Verification method: Level 6 override removal requires: (1) elevated session or ADMIN role, (2) reason field (minimum 20 characters), (3) operator types "CONFIRM REMOVAL" in a text field (case-sensitive). All three enforced in UI and server-side. PATCH /overrides/:id/remove for Level 6 returns 403 if session elevation or confirmation text missing.

**FS-04: Placing an override while EMERGENCY_FREEZE is active**
- Forbidden behavior: any override placement (Level 1-6) while platform is in EMERGENCY_FREEZE constitutional state.
- Operational consequence: undefined interaction between new override and freeze state; content stack becomes inconsistent.
- Verification method: [Place Override] and [Declare Emergency Override] buttons are disabled with tooltip "Platform is in EMERGENCY_FREEZE state — overrides are blocked." Server-side: override creation endpoint returns 423 during EMERGENCY_FREEZE.

### Authority Requirements

| Action | Minimum role | Notes |
|---|---|---|
| Level 1-3 placement | OPERATOR (approval queue); ADMIN (direct) | |
| Level 4-5 placement | OPERATOR (approval queue, mandatory preview); ADMIN (direct) | |
| Level 6 placement | OPERATOR with elevated session; ADMIN | |
| Level 1-5 removal (own override) | OPERATOR+ | |
| Level 1-5 removal (any override) | ADMIN | |
| Level 6 removal | Elevated session or ADMIN | Three-step confirmation |

### Replay Expectations

- Override stack at any past timestamp is reconstructible from the corpus event log.
- PRE resolution trace shows which override was active and whether it was WIN or SUPPRESSED at each timestamp.
- Expired overrides are visible in replay as greyed entries in the historical stack view.
- Level 6 override events include the confirmation text in the logged record, visible in replay.

### Audit Requirements

- Every placement, approval, rejection, removal, and expiry logged with `operator_id`, `governed_timestamp`, `reason`.
- Level 6 override additionally logged with: `scope_confirmation`, `confirmation_text` field value.
- Override accumulation: total active overrides per venue queryable at any past timestamp (derivable from active stack events).
- No-expiry acknowledgement for ADMIN (FS-02) logged as separate `NO_EXPIRY_ACKNOWLEDGED` event.

---

## Workflow 4: Venue Recovery Lifecycle

### Start Conditions

One or more of the following:

- Player machine state transitions to OFFLINE (missed 3 or more consecutive heartbeats within the expected heartbeat window).
- 72-hour autonomy window enters WARNING range (less than 12 hours remaining at last sync).
- OPERATOR+ initiates [Initiate Recovery Workflow] from Venue Operations Dashboard Section 2.

### End Conditions

All four must be true simultaneously:

- Player machine state = LIVE.
- Corpus checksum matches server record (status = CURRENT).
- PRE resolution output for the affected venue matches expected content.
- Operator explicitly marks recovery complete (self-attested Step 5).

### Step Sequence

**Step 1 — Offline Detection and Logging**

System state entering this step: player has missed 3 consecutive heartbeats.

Platform records `OFFLINE_DETECTED` event: `venue_id`, `governed_timestamp`, `last_heartbeat_timestamp`, `heartbeats_missed_count`.

`OFFLINE_DETECTED` is the anchor event for the recovery workflow. It is immutable.

System state after this step: venue machine state = OFFLINE. `OFFLINE_DETECTED` in corpus.

**Step 2 — Dashboard State Display**

System state entering this step: OFFLINE_DETECTED logged.

Venue Operations Dashboard Section 2 shows:

- Machine state badge: OFFLINE (red).
- "LAST KNOWN STATE: [state at last heartbeat]" with `last_heartbeat_timestamp`.
- If offline duration > 1 hour: 72-hour autonomy countdown visible in Section 1 Venue Identity Header.
- Recovery workflow prompt: "Player is offline. [Initiate Recovery Workflow]."

OPERATOR+ reviews: time offline, last known state, 72-hour autonomy window remaining.

System state after this step: operator has assessed the offline situation.

**Step 3 — Recovery Workflow Initiation**

Operator clicks [Initiate Recovery Workflow]. Modal opens with a sequential 5-step checklist. Steps cannot be completed out of order — each step is locked until the prior step is marked complete.

`RECOVERY_WORKFLOW_STARTED` event logged: `workflow_id`, `venue_id`, `initiated_by`, `initiated_at`, `offline_duration_at_initiation_ms`.

**Step 4 — Step 1: Physical Verification**

Checklist Step 1 — Physical Verification:

"Confirm physical connection status. Check: Is the player device powered on? Is the network cable connected or Wi-Fi signal present?"

Operator self-attests by selecting one of:
- [Connection confirmed — player has network access]
- [Connection lost — physical intervention required]
- [Cannot determine remotely]

Attestation logged: `step = 1`, `completed_by`, `completed_at`, `attestation = [selected option]`.

Step 1 marked complete regardless of attestation content. Attestation is informational, not blocking.

**Step 5 — Step 2: Autonomy Assessment**

Checklist Step 2 — Autonomy Assessment:

Platform displays: autonomy window remaining (hours and minutes), content that the player will serve autonomously until reconnect (PRE-resolved against cached corpus), last corpus sync timestamp.

Operator acknowledges by checking: "I have reviewed the autonomy window and understand the content risk."

Acknowledgement logged: `step = 2`, `completed_by`, `completed_at`, `autonomy_hours_remaining`, `content_serving_in_autonomy`.

**Step 6 — Step 3: Reconnection**

Checklist Step 3 — Reconnection:

Two paths:

- (a) Player reconnects automatically: when a heartbeat is received from the player, this step auto-advances. System notifies: "Heartbeat received from [venue_id]. Player reconnected."
- (b) Operator initiates manual reconnection via external means (physical venue visit, remote management tool). When heartbeat is received, step auto-advances.

If no heartbeat received within the 72-hour autonomy window expiry: platform escalates automatically to a WARNING state and raises a Level 3 banner: "72-hour autonomy window expiring in [N] hours for [venue_id]."

Heartbeat-received event logged: `step = 3`, `completed_by = SYSTEM`, `completed_at`, `heartbeat_source`.

**Step 7 — Step 4: Re-enrollment Verification**

Checklist Step 4 — Corpus Re-enrollment (ADMIN only):

ADMIN reviews corpus checksum status for the reconnected player:

- If corpus checksum = CURRENT: ADMIN marks step complete. No re-enrollment needed. `step = 4`, `completed_by`, `completed_at`, `corpus_status = CURRENT`.
- If corpus checksum = STALE or MISMATCH: ADMIN clicks [Trigger Re-enrollment]. Platform initiates corpus sync. Step 4 is marked complete when corpus checksum = CURRENT after re-enrollment.
- If re-enrollment fails 3 times: USB recovery path becomes available. ADMIN may click [Authorize USB Recovery]. `RE_ENROLLMENT_FAILED` logged per attempt with `attempt_number`, `failure_reason`.

[Mark Complete] at Step 4 requires corpus status = CURRENT, OR ADMIN explicit override: "Corpus status is [status]. Mark Step 4 complete despite mismatched corpus? [Confirm — I accept responsibility for content accuracy] [Cancel]." Override acknowledgement logged.

Step 5 is locked (not clickable) until Step 4 is marked complete by ADMIN.

**Step 8 — Step 5: Content Verification**

Checklist Step 5 — Content Verification (OPERATOR+):

Operator views PRE resolution preview for the venue in its current state. Platform displays: "PRE would currently serve: [content_ref]. Verify this matches the venue display."

Operator makes physical or visual verification and selects:

- [Content is correct — recovery complete]: `RECOVERY_COMPLETE` event logged (see below). Workflow closed.
- [Content is incorrect — escalate to incident]: incident creation modal pre-populated with recovery workflow context (`workflow_id`, `offline_duration_ms`, `steps_completed_summary`). Operator adds description and declares incident. Recovery workflow remains OPEN pending incident resolution.

**Step 9 — Recovery Complete**

System state entering this step: Step 5 attestation = "Content is correct."

`RECOVERY_COMPLETE` event logged: `workflow_id`, `venue_id`, `completed_by`, `completed_at` (governed_timestamp), `offline_duration_ms` (from `OFFLINE_DETECTED` to `RECOVERY_COMPLETE`), `steps_completed` (array of step completion records).

Venue machine state confirmed as LIVE. Recovery workflow banner dismissed.

### Optional Steps

- [Authorize USB Recovery] (ADMIN) if re-enrollment fails 3 times.
- Adding annotation in Section 5 timeline at any point during recovery (appended to venue timeline with `operator_id` and `governed_timestamp`).

### Forbidden Shortcuts

**FS-01: Marking recovery complete without corpus checksum confirmed**
- Forbidden behavior: completing Step 4 without corpus status = CURRENT (unless ADMIN explicitly overrides with acknowledgement).
- Operational consequence: player may serve stale or mismatched corpus autonomously after recovery; venue appears recovered but is serving incorrect content.
- Verification method: Step 5 is locked until Step 4 is marked complete. Step 4 completion requires `corpus_status = CURRENT` or an explicit ADMIN override acknowledgement. ADMIN override is logged separately and is visible in recovery audit trail.

**FS-02: Marking recovery complete without physical content verification**
- Forbidden behavior: navigating away from the recovery workflow without completing Step 5, leaving the recovery in an indeterminate state.
- Operational consequence: venue is considered recovered in the audit trail but actual display content has not been confirmed.
- Verification method: if operator navigates away from the recovery workflow after Step 4 completion without completing Step 5, platform displays: "Recovery workflow incomplete. Venue [id] remains in RECOVERING state until Step 5 is completed." Venue machine state displayed as RECOVERING (not LIVE) in Section 1 until Step 5 complete.

### Authority Requirements

| Step | Minimum role |
|---|---|
| Steps 1-3 | OPERATOR+ |
| Step 4 (enrollment trigger, override) | ADMIN only |
| Step 4 (corpus status view) | OPERATOR+ (view only) |
| Step 5 | OPERATOR+ |

### Replay Expectations

- Offline event and all recovery workflow steps are visible in the venue timeline in replay.
- Corpus checksum state at each point during recovery is visible in the Corpus Evidence tab of Replay & Forensics workspace.
- Content PRE resolution at time of recovery completion is verifiable from corpus.
- Re-enrollment attempts (including failures) are visible in replay with failure reasons.

### Audit Requirements

- `OFFLINE_DETECTED` event: `venue_id`, `governed_timestamp`, `last_heartbeat_timestamp`, `heartbeats_missed_count`.
- Recovery workflow start: `workflow_id`, `initiated_by`, `initiated_at`, `offline_duration_at_initiation_ms`.
- Each step completion: `workflow_id`, `step_number`, `completed_by`, `completed_at`, `attestation_text`.
- Re-enrollment failures: `attempt_number`, `failure_reason`, `timestamp` (each attempt individually logged).
- `RECOVERY_COMPLETE` event: `operator_id`, `governed_timestamp`, `offline_duration_ms`, `steps_completed` (array).

---

## Workflow 5: Certification Lifecycle

### Start Conditions

- New operator account created: auto-enrolled in Module 1 training.
- Operator requests upgrade to a higher certification level.
- Certification reaches expiry (12-month expiry from `certified_at`).
- Instructor identifies skill decay (more than 90 days of audit trail event absence for a required capability).

### End Conditions

All three must be true simultaneously:

- Operator holds valid certification at required level for their assigned role.
- Certification is not expired (`certified_at` + 12 months > now).
- No active skill decay alert for required capabilities.

### Step Sequence — L1 Certification (initial)

**Step 1 — Module 1 Completion**

Module 1: Platform Orientation. Completion requirement: 100% pass on identification assessment.

Assessment tasks: operator must identify all Zone labels, all state badges (machine and constitutional), all interruption level indicators, and the emergency content badge. Pass = all identified correctly.

System state after this step: `module_1_completed_at` logged for operator.

**Step 2 — Navigation Demonstration**

Operator demonstrates ability to navigate all zones (A, B, C) and identify all state badge types. This is self-guided — no instructor required for L1. Completion is implicit upon module assessment pass.

**Step 3 — L1 Certification Issued**

L1 certification issued automatically by system upon Module 1 completion.

`CERTIFICATION_ISSUED` logged: `certification_id`, `operator_id`, `level = 1`, `certified_by = SYSTEM`, `certified_at` (governed_timestamp), `expires_at` (12 months from `certified_at`).

### Step Sequence — L2 Certification

**Step 1 — Module 2 Completion**

Prerequisite: Module 1 complete.

Module 2: Schedule and Override Operations. Pass threshold: 8 out of 10 questions correct.

**Step 2 — Module 3 Completion**

Module 3: Override Scenarios. 5 override placement scenarios. Operator must place overrides correctly in all 5 scenarios (correct level, content, scope, and preview confirmation sequence).

**Step 3 — L2 Certification Issued**

Issued automatically upon Module 3 completion.

`CERTIFICATION_ISSUED` logged: `level = 2`, `certified_by = SYSTEM`, `module_scores_hash`.

### Step Sequence — L3 Certification

**Step 1 — L2 Prerequisite Confirmed**

L3 module access blocked until L2 certification is current and not expired.

**Step 2 — Module 4 Completion**

Module 4: Incident Response. 4 scenarios. Operator must respond correctly to 3 of 4 scenarios (75% threshold). Each scenario has a 90-second time limit. Time-to-correct-action is measured and logged.

**Step 3 — Module 5 Completion**

Module 5: Forensic Replay. 3 investigative questions. Operator navigates a replay session and answers all 3 questions correctly. Questions require operator to: identify trigger event, trace causal chain, and annotate conclusion.

**Step 4 — L3 Certification Issued**

Issued automatically upon Module 5 completion.

`CERTIFICATION_ISSUED` logged: `level = 3`, `certified_by = SYSTEM`, `module_scores_hash`.

### Step Sequence — L4 Certification

**Step 1 — L3 Prerequisite Confirmed**

L4 access blocked until L3 certification is current.

**Step 2 — Instructor Session Scheduled**

Operator requests L4 instructor session via [Request L4 Certification Session] in their certification record.

An instructor (a different operator with current L4 certification) accepts the session. Session scheduled, both parties confirm time.

**Step 3 — Module 6 Execution**

Module 6: Emergency Response. Executed with instructor present. Instructor observes operator's responses to 4 emergency scenarios in the training sandbox.

**Step 4 — Instructor Grading**

Instructor grades the session using a 4-dimension rubric:

- Scenario comprehension (1–5): Did the operator correctly identify what was wrong?
- First action correctness (1–5): Was the first action the correct one per constitutional protocol?
- Recovery workflow (1–5): Did the operator follow the recovery sequence correctly?
- Annotation quality (1–5): Were operator notes sufficient for future replay investigation?

Total required: 16 out of 20 minimum.

Instructor submits grades via [Submit Certification Grading] in TC-RIGHT panel. [Certify at Level 4] button enabled only if total ≥ 16.

**Step 5 — L4 Certification Issued**

Instructor clicks [Certify at Level 4].

`CERTIFICATION_ISSUED` logged: `level = 4`, `certified_by = instructor_operator_id`, `certified_at` (governed_timestamp), `rubric_scenario_comprehension`, `rubric_first_action`, `rubric_recovery_workflow`, `rubric_annotation_quality`, `rubric_total`.

### Step Sequence — Recertification (any level)

**Step 1 — Advance Notice**

At 11 months from `certified_at`: advisory notification raised in Zone C for the operator. Text: "Your [Level N] certification expires in 30 days. [Begin Recertification]."

**Step 2 — Module Reassessment**

Operator retakes relevant module assessments at the same pass thresholds as initial certification.

**Step 3 — L4 Recertification Specifics**

L4 recertification requires a new instructor-led Module 6 session with a current L4 instructor. The prior rubric scores are not reused.

**Step 4 — Access Level Reduction on Expiry (if not recertified)**

If recertification is not completed before `expires_at`: operator's access level is reduced to the next lower valid certification level at exactly `expires_at`. Reduction is logged as `CERTIFICATION_EXPIRED` event: `operator_id`, `expired_level`, `expired_at`, `new_access_level`.

Reduction is not retroactive — actions taken by the operator before `expires_at` remain valid.

**Step 5 — Recertification Issued**

Same `CERTIFICATION_ISSUED` event as initial certification. Prior certification record remains in audit trail (append-only).

### Optional Steps

- Operator requests instructor feedback at any module (feedback appended to module record).
- Instructor assigns remediation modules with notes (logged as `REMEDIATION_ASSIGNED` event).

### Forbidden Shortcuts

**FS-01: Skipping module prerequisites**
- Forbidden behavior: beginning Module 2, 3, 4, 5, or 6 before completing prior module(s).
- Operational consequence: operator lacks foundational knowledge required for advanced operations; may hold a certification they do not have the prerequisites for.
- Verification method: module buttons for modules with prerequisites display "LOCKED — complete [Module N] first." Module start endpoint checks prerequisites server-side; returns 403 if not met.

**FS-02: Self-certifying at L4**
- Forbidden behavior: an operator certifying themselves at L4 — the certifying instructor must have a different `operator_id` from the trainee.
- Operational consequence: uncertified operator holds emergency authority; L4 gate is security-relevant.
- Verification method: [Certify at Level 4] button is only visible to L4-certified operators who are not the trainee in the current session. Server-side: certification issuance endpoint checks `certified_by != operator_id`; returns 403 if same.

**FS-03: Continuing L3/L4 operations after certification expiry**
- Forbidden behavior: executing OPERATOR or ADMIN actions after certification has expired.
- Operational consequence: operator acts beyond their current competency and authorization level.
- Verification method: access level is checked against current certification status at the time of each action, not at login. If certification is expired: action returns 403 with message "Your [Level N] certification expired at [timestamp]. Recertification required before this action is available."

### Authority Requirements

| Action | Requirement |
|---|---|
| L1/L2/L3 certification | Automated — no human approver |
| L4 certification | Active L4 instructor (different operator_id) required |
| Recertification | Same requirements as initial certification |

### Replay Expectations

- All training sessions are replayable (sandboxed corpus; session events logged).
- Certification issuance events are logged with full context including rubric scores (L4).
- Skill decay audit trail is derived from production audit trail: which capabilities were exercised and when.

### Audit Requirements

- Module completion: `module_id`, `operator_id`, `score`, `passed_at`, `attempt_count`, `time_on_scenario_ms` (per scenario for Module 4).
- Certification issued: `certification_id`, `operator_id`, `level`, `certified_by`, `certified_at`, `expires_at`, `rubric_scores` (L4 only).
- Certification expiry: `expiry_at`, `notified_at`, `new_access_level`.
- Skill decay alert: `operator_id`, `capability`, `last_exercised_at`, `alert_raised_at`.

---

## Workflow 6: Investigation Lifecycle

### Start Conditions

- Operator opens Replay & Forensics workspace directly, OR
- [Initiate Replay Investigation] clicked from Incident Commander Surface (incident_id passed as context), OR
- Divergence detected by shadow parity system: auto-triggers investigation prompt for ADMIN.

### End Conditions

All three must be true simultaneously:

- Root cause identified and annotated in the replay session (minimum one annotation with root cause text).
- Operator explicitly exits the replay session ([Exit Replay] in RP-TOP).
- If divergence was detected: divergence is classified as either escalated to incident or annotated as false positive with reason.

### Step Sequence

**Step 1 — Session Creation**

System state entering this step: operator has initiated investigation.

Replay session record created: `session_id`, `scope` (venue / incident / time_range), `anchor_timestamp`, `initiated_by` (operator_id), `initiated_at` (governed_timestamp), `incident_id` (if linked, null otherwise).

RP-TOP displays: session ID, scope, anchor timestamp, operator identity.

Session is visible in Replay & Forensics workspace header immediately upon creation.

**Step 2 — Tab Selection**

Operator selects the investigation tab appropriate for their investigation type:

- Tab 1: PRE Trace — for investigating content resolution decisions.
- Tab 2: State Machine Timeline — for investigating venue machine state transitions.
- Tab 3: Operator Audit Trail — for reviewing operator actions.
- Tab 4: Corpus Evidence — for inspecting corpus state and checksum history.
- Tab 5: Divergence Analysis — for hash mismatch investigation.
- Tab 6: Counterfactual Engine — for "what if" scenarios (ADMIN only).

Tab selection logged as `SESSION_TAB_VIEWED` event: `session_id`, `tab_id`, `viewed_at`.

**Step 3 — Trigger Event Identification**

Operator navigates the timeline (RP-LEFT Timeline Panel) to the timestamp where the anomalous behavior began.

For incident-linked sessions: anchor_timestamp is set to `incident declared_at minus 15 minutes`. Operator may adjust.

Trigger event identified: the event in the timeline immediately preceding the observed anomaly.

**Step 4 — Trigger Annotation**

Operator adds annotation to the trigger event: what was observed, initial hypothesis for cause.

Annotation created: `annotation_id`, `session_id`, `event_id`, `operator_id`, `governed_timestamp`, `text`.

Minimum content for trigger annotation: observed behavior description (may be brief). No minimum character count enforced for trigger annotations.

**Step 5 — Causal Chain Tracing**

Operator navigates forward and backward from the trigger event to establish the causal sequence. Platform does not enforce a tracing procedure — this is investigative and operator-directed.

Multiple tab views and timeline navigations are logged individually as `SESSION_TAB_VIEWED` and `TIMELINE_NAVIGATED` events.

**Step 6 — Conclusion Annotation**

Operator adds a conclusion annotation: root cause, whether PRE behaved correctly, whether any machine transition was incorrect.

For incident-linked sessions: conclusion annotation is required before [Exit Replay] is enabled (see FS-01).

Conclusion annotation: `annotation_id`, `session_id`, event_id = null (session-level annotation), `operator_id`, `governed_timestamp`, `text` (minimum 30 characters for incident-linked sessions).

**Step 7 — Divergence Classification (conditional)**

System state entering this step: divergence (output_hash mismatch) was detected and appears in Tab 5.

If Tab 5 shows a hash mismatch: operator must complete one of:

- [Escalate to Incident (S3)]: incident creation modal appears pre-populated with divergence data. Operator adds description and declares incident. Escalation event logged: `DIVERGENCE_ESCALATED`, `session_id`, `incident_id`, `escalated_by`, `governed_timestamp`.
- Annotation containing "False positive" text: operator explains why the divergence is not a genuine issue. Annotation logged. Divergence marked as `CLASSIFIED_FALSE_POSITIVE`.

If neither action taken: [Exit Replay] surfaces a warning (see FS-02).

**Step 8 — Session Exit**

Operator clicks [Exit Replay] in RP-TOP.

Platform transitions from Replay mode to LIVE mode. Zone A returns to LIVE state. Replay banner in System Status Bar dismissed.

`SESSION_CLOSED` event logged: `session_id`, `closed_by`, `closed_at`, `annotations_count`, `divergence_resolved` (boolean — true if classified, false if not applicable or unresolved).

**Step 9 — Incident Linkage (conditional)**

If session was initiated from an incident (has `incident_id`): session record is automatically linked to the incident in the audit trail. The incident record's `linked_replay_sessions` array is updated with `session_id`.

### Optional Steps

- Evidence package generation (ADMIN): `package_id`, `session_id`, `hash`, `created_by`, `created_at`.
- Counterfactual run (Tab 6, ADMIN only): "what if this override had not been placed" — counterfactual results logged as `COUNTERFACTUAL_RUN` event.
- Opening multiple replay sessions for the same incident: each independently tracked with separate `session_id`.

### Forbidden Shortcuts

**FS-01: Closing incident-linked replay session without annotation**
- Forbidden behavior: exiting a replay session that has an `incident_id` without adding at least one annotation.
- Operational consequence: investigation with no findings — future operators cannot distinguish "found nothing suspicious" from "did not investigate."
- Verification method: if session has `incident_id` and `annotations_count = 0` at the time [Exit Replay] is clicked: confirmation modal shown: "You have not added any annotations to this investigation. Exit without annotating? [Exit anyway — log as unannotated] [Stay and annotate]." The operator can exit anyway. The choice is logged as `UNANNOTATED_EXIT` if they proceed.

**FS-02: Treating divergence as resolved without classifying it**
- Forbidden behavior: closing a replay session while Tab 5 shows an unresolved hash mismatch without either escalating to incident or annotating as false positive.
- Operational consequence: constitutional divergence silently dismissed; no accountability for output correctness.
- Verification method: on [Exit Replay], if the session tab 5 showed a divergence and neither `DIVERGENCE_ESCALATED` nor a "False positive" annotation exists: modal displayed: "Divergence detected in this session and not resolved. Exit anyway? [Exit — log as unresolved divergence] [Stay and resolve]." If operator exits: `DIVERGENCE_UNRESOLVED_EXIT` event logged with `session_id`, `operator_id`, `governed_timestamp`. This event is available for ADMIN review.

### Authority Requirements

| Action | Minimum role | Notes |
|---|---|---|
| Open replay session | VIEWER+ | All roles may investigate |
| Annotate session | VIEWER+ | |
| Generate evidence package | ADMIN | |
| Run counterfactual (Tab 6) | ADMIN | |
| Escalate to incident from replay | OPERATOR+ | |

### Replay Expectations

- Replay sessions are themselves replayable: all session events (tab views, annotations, navigation) are logged to the audit trail.
- Annotations from prior replay sessions for the same timeframe are visible in subsequent sessions as historical annotations.
- Session ID and all session events are linked for future investigation of the investigation itself.
- VIEWER-role annotations are included in replay — all annotations, regardless of role, are corpus-level records.

### Audit Requirements

- Session creation: `session_id`, `scope`, `anchor_timestamp`, `initiated_by`, `initiated_at`, `incident_id` (nullable).
- All annotations: `annotation_id`, `session_id`, `event_id` (nullable for session-level), `operator_id`, `governed_timestamp`, `text`.
- Session closure: `closed_by`, `closed_at`, `annotations_count`, `divergence_resolved` (boolean).
- Evidence packages: `package_id`, `session_id`, `hash`, `created_by`, `created_at`.
- Unannotated exit (FS-01): `UNANNOTATED_EXIT` event with operator_id and governed_timestamp.
- Divergence unresolved exit (FS-02): `DIVERGENCE_UNRESOLVED_EXIT` event with session_id, operator_id, governed_timestamp.
