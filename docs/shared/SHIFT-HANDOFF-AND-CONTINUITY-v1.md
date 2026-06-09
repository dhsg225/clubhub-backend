# Shift Handoff and Continuity v1

**Document class:** Implementation-grade operational specification
**Status:** Authoritative
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, VENUE-OPERATIONS-DASHBOARD-v1.md, OPERATIONAL-WORKFLOW-ARCHITECTURE-v1.md

---

## Governing Principle

No operational state may exist only in a human's head.

Operational continuity is the property that the system can be understood and operated by a replacement operator with no verbal briefing from the outgoing operator. The platform achieves this through two mechanisms: (1) the audit trail is complete and queryable, and (2) the handoff protocol surfaces the relevant subset of the audit trail at transition time.

This document defines the minimum viable handoff across all transition types. It does not define communication protocols between operators — verbal communication between operators is encouraged but is not the operational record. The platform record is authoritative. This document defines what the system must surface and what operators must acknowledge.

---

## Shift Change Handoff

### Definition

A planned transition where an incoming operator assumes responsibility for one or more venues from an outgoing operator, with advance notice.

### Prerequisites

- Outgoing operator: has an active OPERATOR+ session.
- Incoming operator: has an active OPERATOR+ session, certification level adequate for all venues being transferred.
- No active S1 or S2 incident on any venue being transferred. (Planned shift changes are blocked for venues with active S1-S2 incidents. See Exception below.)

### Handoff Package

The platform generates a Shift Handoff Package on demand via [Generate Handoff Package] in the operator tools menu (Zone A). Package generation queries the live audit trail and assembles the following five sections at the moment of generation.

**Section 1 — Active Incidents**
All open incidents on the outgoing operator's assigned venues being transferred. For each: `incident_id`, severity, current state, `declared_at`, duration to now, commander identity, last state transition timestamp, last annotation text (truncated to 200 characters).

**Section 2 — Active Overrides**
All active overrides on assigned venues being transferred. For each: level, `content_ref`, `placed_at`, `operator_id` who placed it, scope, `expires_at` (or "NO EXPIRY SET" if no expiry). Overrides with no expiry set are called out at the top of Section 2 with a distinct warning: "The following overrides have no expiry set and will remain active indefinitely unless manually removed."

**Section 3 — Pending Approvals**
All items in the approval queue submitted by, or awaiting action from, the outgoing operator or any ADMIN user on the transferred venues. For each: item type (schedule block, override), `submitted_by`, `submitted_at`, time elapsed since submission.

**Section 4 — Venue Anomalies**
Any venue being transferred that is not in HEALTHY + LIVE state. For each: venue name, current machine state, current constitutional state, how long in this state, last operator action taken on this venue.

**Section 5 — Certification and Coverage**
Confirmation that the incoming operator holds current (non-expired) certification at the required level for all venues being transferred. If any certification gap is detected: Section 5 lists the gap explicitly and [Accept Handoff] is disabled until an ADMIN overrides the certification requirement or the incoming operator completes recertification.

### Handoff Procedure

**Step 1 — Package Generation**

Outgoing operator clicks [Generate Handoff Package]. Platform creates a Handoff Record:

`handoff_id`, `from_operator_id`, `to_operator_id`, `generated_at` (governed_timestamp), `venues` (array of venue_ids being transferred), `package_contents_hash` (hash of all 5 section contents at generation time).

Package is sent to incoming operator's session. If incoming operator is not currently logged in: package is queued and delivered on next login within 4 hours (see Incomplete Handoff Detection).

**Step 2 — Recipient Review**

Incoming operator opens the Handoff Package. Platform records `package_opened_at` (governed_timestamp).

Package is displayed as a five-section review interface. Each section has its own acknowledgement control.

**Step 3 — Section Acknowledgements**

Incoming operator must acknowledge all five sections independently. Acknowledgement controls:

- Section 1: [Acknowledge — No active incidents] or [Acknowledge — [N] active incident(s) reviewed]
- Section 2: [Acknowledge — No active overrides] or [Acknowledge — [N] active override(s) reviewed]
- Section 3: [Acknowledge — No pending approvals] or [Acknowledge — [N] pending item(s) reviewed]
- Section 4: [Acknowledge — All venues in normal state] or [Acknowledge — [N] venue anomalie(s) reviewed]
- Section 5: [Acknowledge — Certification confirmed for all venues]

Each acknowledgement click generates an event: `HANDOFF_SECTION_ACKNOWLEDGED`: `handoff_id`, `section_number`, `acknowledged_by`, `governed_timestamp`, `section_summary` (e.g., "2 active incidents reviewed").

[Accept Handoff] button is disabled until all five sections are acknowledged.

**Step 4 — Handoff Acceptance**

Incoming operator clicks [Accept Handoff].

Platform records: `handoff_completed_at` (governed_timestamp). Venue assignments transferred from outgoing to incoming operator. Outgoing operator's access to those venues transitions from ASSIGNED to OBSERVER (read-only, no actions) for 24 hours post-handoff, to allow for questions. After 24 hours: OBSERVER access expires.

`HANDOFF_COMPLETE` event logged: `handoff_id`, `from_operator_id`, `to_operator_id`, `completed_at`, `venues_transferred` (array).

**Minimum review advisory:** If incoming operator opens the Handoff Package and clicks [Accept Handoff] in fewer than 60 seconds from `package_opened_at`: system adds advisory note to the handoff record (not shown to the incoming operator): "Handoff completed in [N] seconds from package open — package may not have been fully reviewed." This is available for supervisor review only. It does not block or delay the handoff.

### Approved and Forbidden Behavior

**Approved behavior:** Complete 5-section acknowledgement before [Accept Handoff]. Outgoing operator retains OBSERVER access for 24 hours post-acceptance.

**Forbidden behavior:** Accepting handoff without generating a Handoff Package first. [Accept Handoff] button must not be rendered unless a Handoff Package has been generated for this handoff instance.

**Operational consequence:** Incoming operator assumes venue responsibility without knowing about active incidents, indefinite overrides, or venue anomalies. The incoming operator operates on assumptions; the outgoing operator's verbal briefing (if any) is not in the record.

**Verification method:** [Accept Handoff] button absent from DOM until `handoff_id` exists and all 5 `HANDOFF_SECTION_ACKNOWLEDGED` events are present for the incoming operator_id. Server-side: POST /handoffs/:id/accept returns 422 if acknowledgement events are not complete.

### Exception — S1-S2 Incident Active

Planned shift change is blocked for any venue with an active S1 or S2 incident. [Generate Handoff Package] for those venues shows a warning: "Venue [name] has an active S1/S2 incident. Planned handoff is blocked for this venue until the incident reaches CONTAINED state."

Options for the outgoing operator:

(a) Wait until the incident reaches CONTAINED state before initiating handoff for that venue. Handoff proceeds normally after containment.

(b) Perform an Emergency Handoff (see Emergency Handoff section), which transfers incident commander role separately from venue assignment.

(c) Keep the venue assigned to the outgoing operator and transfer only the other venues in scope. The venue with the active incident remains assigned until the incident is resolved.

---

## Operator Replacement (Unplanned)

### Definition

An operator must be replaced without advance notice — illness, equipment failure, or emergency exit — and the outgoing operator cannot initiate a standard handoff.

### Detection

Operator session expires (no activity for the session timeout period, typically 30 minutes of inactivity). Platform detects whether unattended responsibilities exist at session expiry.

### Unattended Responsibility Detection

When an operator session expires or is explicitly logged out while any of the following exist:

- Active S1-S4 incident where the operator is the incident commander.
- Active overrides placed by this operator with no expiry set.
- Pending approval queue items submitted by this operator that are awaiting ADMIN review.
- An ongoing recovery workflow step that was assigned to this operator and has not been completed.

Platform generates an Unattended Responsibility Alert immediately on session expiry detection.

**For incident commander lapse:**
Incident transitions to "COMMANDER_LAPSED" sub-state within the existing incident state. Zone A Pane A2 shows a COMMANDER_LAPSED badge on the affected incident entry for all operators with access to the venue. Any ADMIN user may claim command via [Claim Command] in IC-TOP. Level 3 alert raised in System Status Bar for all ADMIN users with venue access: "[Venue] — Incident commander session expired — [Claim Command]."

**For active overrides with no expiry:**
Overrides remain active. Platform does not automatically remove overrides when an operator's session expires — an expired session does not constitute authorization for content changes. ADMIN receives a Level 3 notification: "Operator [id] session expired — [N] override(s) with no expiry remain active on [venue list]."

**For pending approvals:**
Items remain in approval queue. Normal queue expiry rules apply. ADMIN notified: "Operator [id] session expired — [N] pending submission(s) in approval queue."

**For recovery workflow:**
Recovery workflow transitions to "OPERATOR_LAPSED" state. Any OPERATOR+ with access to the venue can claim and resume the recovery from the last completed step. The platform shows which step was last completed and by whom. Level 3 alert: "[Venue] — Recovery workflow operator session expired — [Claim workflow]."

### Approved and Forbidden Behavior

**Approved behavior:** All unattended responsibilities are surfaced immediately to ADMIN and relevant operators upon session expiry. Each responsibility type surfaces via appropriate Level 3 notification.

**Forbidden behavior:** Auto-completing any abandoned workflow step on session expiry. Platform must not assume the departed operator's intent. No automatic: override removal, incident resolution, recovery step completion, or approval queue clearance.

**Operational consequence of violation:** If the platform auto-removes an override because the operator's session expired, content that was being actively managed is silently changed. If the platform auto-completes a recovery step, a venue is marked recovered when the departed operator never confirmed content was correct.

**Verification method:** In test harness: create an active incident with an operator as commander; expire the operator session; assert incident shows COMMANDER_LAPSED state; assert no auto-resolution of incident; assert Level 3 notification delivered to ADMIN users.

### Incoming Replacement Procedure

1. Replacement operator claims incident command, recovery workflow, or approval responsibilities via explicit [Claim] action on each item.
2. Platform auto-generates an abbreviated Handoff Package from the departed operator's last known session state: active incidents, active overrides, venue anomalies.
3. Replacement operator reviews the abbreviated package and acknowledges 5 sections (same structure as standard handoff).
4. Replacement operator clicks [Accept Responsibilities]. Event logged: `UNPLANNED_HANDOFF_COMPLETE`, `from_operator_id` (departed), `to_operator_id` (replacement), `completed_at`, `claimed_items` (array of incident_ids, workflow_ids, override_ids).

---

## Incident Commander Transfer

### Definition

Transfer of the incident commander role from one operator to another during an active incident. This is distinct from a full venue handoff — the incident role transfers; venue assignment may remain with the original operator.

See also: INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md (command transfer modal). This section defines the continuity requirements.

### Transfer Package

Before the transfer request is presented to the recipient, the platform compiles a Command Transfer Summary. The summary is generated at the moment the outgoing commander initiates the transfer request.

**Command Transfer Summary contents:**

1. Incident ID, severity, current state, time since declared.
2. Last 5 incident log entries (state transitions and operator notes, chronological).
3. Active actions in progress: any pending recovery workflow steps, pending approvals linked to this incident, outstanding escalations.
4. Outstanding decisions required: any step in the recovery or response workflow that is awaiting action.
5. PRE current resolution level for the affected scope.

### Recipient Review

The recipient sees the Command Transfer Summary in full before [Accept Command] is presented.

`TRANSFER_SUMMARY_VIEWED` event logged with `recipient_operator_id` and `governed_timestamp` when the summary is opened.

[Accept Command] button is disabled for 30 seconds after the recipient opens the summary. This is an enforced minimum review period. A countdown is visible: "Review in progress — [N] seconds remaining."

After 30 seconds: [Accept Command] becomes available.

**Approved behavior:** Recipient reviews transfer summary. [Accept Command] becomes available after 30-second review period. Recipient accepts at their discretion after that.

**Forbidden behavior:** Transfer completing before recipient has opened and viewed the transfer summary. [Accept Command] available before the 30-second review period has elapsed.

**Operational consequence:** New commander accepts an active S1/S2 incident without knowing what steps have been taken, what decisions are outstanding, or what PRE is currently resolving to.

**Verification method:** Assert [Accept Command] is disabled until `TRANSFER_SUMMARY_VIEWED` event exists for the recipient and 30 seconds have elapsed since that event. Assert transfer endpoint returns 422 if preconditions not met.

### On Transfer Acceptance

- Commander identity in IC-TOP updates to new commander's name, role, and `commander_since` timestamp.
- Prior commander receives OBSERVER role on this incident. Observer can view all incident surfaces but cannot place commands.
- `COMMAND_TRANSFERRED` event logged: `incident_id`, `from_commander_id`, `to_commander_id`, `transferred_at`, `governed_timestamp`.
- Prior commander's OBSERVER access persists until incident is RESOLVED.

---

## Degraded Network Handoff

### Definition

A shift change or operator replacement occurring while the operator's browser connection to the backend is degraded or lost.

### Problem

Handoff Package generation and 5-section acknowledgement require a live server connection. If the operator's browser is offline, the package cannot be fetched or acknowledged in the standard flow.

### Behavior

**Package generation under degraded connection:**

[Generate Handoff Package] button shows: "Connection required — [last successful sync timestamp] — [Generate from cached data]."

[Generate from cached data] is always available regardless of connection state.

When generated from cache: package is assembled from the most recently cached state of each data type. The `generated_at` timestamp reflects the cache timestamp, not the current time. The package is prominently marked: "CACHED HANDOFF — data reflects state as of [cached_at timestamp]. Live data not available."

Package is marked `handoff_type: CACHED_HANDOFF` in the audit trail.

**Acknowledgement under degraded connection:**

If the incoming operator is also offline at time of acknowledgement: acknowledgements are stored locally and sync to the server on reconnect. `HANDOFF_SECTION_ACKNOWLEDGED` events carry `local_timestamp` (the time of local acknowledgement) and `sync_timestamp` (the time the event reached the server). Both timestamps are stored.

**Post-reconnect advisory:**

When both operators reconnect: platform surfaces advisory to the incoming operator: "This handoff was completed while connection was degraded. Package reflects state as of [cached_at timestamp]. Review current state for any changes since [cached_at]. [Review current state]."

[Review current state] opens a diff view showing what changed between `cached_at` and the current time for the transferred venues.

### Approved and Forbidden Behavior

**Approved behavior:** Cached handoff generated, clearly marked as CACHED_HANDOFF, advisory surfaced on reconnect. Diff view available.

**Forbidden behavior:** Blocking handoff entirely during degraded network. An operator must be able to transfer responsibility even without full connectivity. Preventing handoff when the physical operator needs to leave creates an uncovered venue.

**Operational consequence:** Incoming operator starts with potentially stale handoff data and may be unaware of incidents or overrides that occurred after the cache timestamp.

**Verification method:** In test harness: simulate offline condition; attempt [Generate Handoff Package]; assert cached version is generated with CACHED_HANDOFF flag; assert advisory is surfaced on reconnect; assert diff view shows events after cached_at timestamp.

---

## Emergency Handoff

### Definition

A handoff required immediately — no time for the standard 5-section procedure. Trigger: outgoing operator must leave the building immediately (medical emergency at venue, security incident, family emergency).

### Trigger

Outgoing operator initiates via [Emergency Handoff] in the operator tools menu (Zone A). This button is always visible to OPERATOR+ regardless of whether an incoming operator has been identified.

### Emergency Handoff Package

The package is generated in under 5 seconds by querying only the highest-priority subset of state. Three-section abbreviated package:

**Section 1 — Active Incidents:** Incident ID, severity, current state, time since declared. No annotation history — summary only.

**Section 2 — Critical Overrides:** Level 5 and Level 6 active overrides only. Other override levels omitted for speed. If more than 3 Level 5-6 overrides exist: all are shown.

**Section 3 — Non-LIVE Venues:** Any venue not currently in LIVE machine state. Venue name and current state only.

### Procedure

1. Outgoing operator clicks [Emergency Handoff].
2. Operator selects or types the incoming operator's ID (or marks "UNASSIGNED — no recipient identified").
3. Platform generates 3-section abbreviated package immediately.
4. If incoming operator is identified: they receive a notification: "[Operator ID] has initiated an emergency handoff to you — [Review and Accept]."
5. Incoming operator sees one-screen display of the abbreviated package.
6. Single acknowledgement: [I have received the emergency handoff and understand my responsibilities].
7. Transfer complete. `EMERGENCY_HANDOFF_COMPLETE` event logged.

**If recipient is UNASSIGNED:** Responsibilities enter the Unattended Responsibility state (see Operator Replacement section). ADMIN receives Level 3 notification: "Emergency handoff initiated — no recipient assigned — [N] venues require coverage."

**Post-handoff advisory:** System auto-generates a full 5-section Handoff Package retrospectively based on state at the emergency handoff timestamp. This full package is attached to the handoff record within 60 seconds and available for review. Incoming operator receives Zone C advisory: "Full handoff package now available for review — [View]."

Platform recommends incoming operator review the full package within 15 minutes, but this is advisory only. No enforcement.

### Approved and Forbidden Behavior

**Approved behavior:** Abbreviated 3-section handoff with single acknowledgement. Immediate transfer. Full retrospective package attached within 60 seconds.

**Forbidden behavior:** Requiring full 5-section acknowledgement during emergency handoff. Any flow that prevents the outgoing operator from completing the transfer because the incoming operator has not met the standard acknowledgement requirements.

**Operational consequence:** Emergency handoff blocked; outgoing operator cannot leave. If this happens during a genuine physical emergency (medical), the operator remains at the venue against their will or leaves entirely without any handoff record — the worst possible outcome.

**Verification method:** Assert [Emergency Handoff] flow bypasses the 5-section acknowledgement modal entirely. Assert transfer completes on single [Accept] click. Assert full retrospective package is generated within 60 seconds and attached to handoff record.

---

## Incomplete Handoff Detection

### Definition

A handoff instance that was initiated (Handoff Package generated) but not completed (no [Accept Handoff] event) within the validity window.

### Detection

Handoff Package generated but `handoff_completed_at` absent from the handoff record after 4 hours from `generated_at`.

### Behavior on Detection

- Handoff record status set to INCOMPLETE.
- ADMIN receives Level 3 notification: "Handoff from [operator A] to [operator B] initiated [N] hours ago and not completed — [View]."
- Venues remain assigned to the outgoing operator. No automatic responsibility transfer.
- Handoff record marked EXPIRED if not completed within 8 hours. A new handoff package must be generated for a new attempt (state may have changed significantly).

**No automatic transfer on timeout.** The platform never automatically transfers responsibility without an operator explicitly accepting it. Automatic transfers create false safety: the incoming operator believes they are not responsible for something they are.

### Abandoned Responsibility (no handoff initiated)

When an operator session expires without any handoff having been initiated while unattended responsibilities exist: see Operator Replacement section. The distinction is:

- Unplanned replacement: session expired, no handoff initiated.
- Incomplete handoff: handoff initiated, recipient did not accept.

Both result in unattended responsibilities, but they are tracked separately in the audit trail.

---

## Handoff Verification Checklist

The following items must be present in the audit trail for a handoff to be recorded as COMPLETE. If any item is missing: handoff status = INCOMPLETE. Queryable by ADMIN via `handoff_id`.

| Item | Required | Audit trail record |
|---|---|---|
| Handoff Package generated | Yes | `handoff_package_generated_at` timestamp on handoff record |
| Package viewed by recipient | Yes | `package_opened_at` timestamp on handoff record |
| Section 1 acknowledged | Yes | `HANDOFF_SECTION_ACKNOWLEDGED` for section_number = 1 |
| Section 2 acknowledged | Yes | `HANDOFF_SECTION_ACKNOWLEDGED` for section_number = 2 |
| Section 3 acknowledged | Yes | `HANDOFF_SECTION_ACKNOWLEDGED` for section_number = 3 |
| Section 4 acknowledged | Yes | `HANDOFF_SECTION_ACKNOWLEDGED` for section_number = 4 |
| Section 5 acknowledged | Yes | `HANDOFF_SECTION_ACKNOWLEDGED` for section_number = 5 |
| [Accept Handoff] clicked | Yes | `handoff_completed_at` timestamp on handoff record |
| Certification adequacy confirmed | Yes | System check logged at package generation time |

For Emergency Handoff, the following reduced checklist applies:

| Item | Required | Audit trail record |
|---|---|---|
| Emergency Handoff initiated | Yes | `EMERGENCY_HANDOFF_INITIATED` event |
| Abbreviated package generated | Yes | `emergency_package_generated_at` timestamp |
| Recipient acknowledgement | Yes | `EMERGENCY_HANDOFF_ACCEPTED` with `acknowledged_by` and `governed_timestamp` |
| Full retrospective package attached | Yes | `FULL_RETROSPECTIVE_PACKAGE_ATTACHED` within 60 seconds |

For Cached Handoff (degraded network), the standard checklist applies with the addition of:

| Item | Required | Audit trail record |
|---|---|---|
| Cached handoff flag | Yes | `handoff_type: CACHED_HANDOFF` on handoff record |
| Cache timestamp | Yes | `package_cache_timestamp` on handoff record |
| Post-reconnect advisory surfaced | Yes | `CACHED_HANDOFF_ADVISORY_SURFACED` event after reconnect |

---

## Audit Requirements

All handoff events are append-only and hash-chained in the corpus.

**Standard handoff events:**
- `HANDOFF_PACKAGE_GENERATED`: `handoff_id`, `from_operator_id`, `to_operator_id`, `generated_at`, `venues`, `package_contents_hash`.
- `HANDOFF_PACKAGE_OPENED`: `handoff_id`, `opened_by`, `opened_at`.
- `HANDOFF_SECTION_ACKNOWLEDGED`: `handoff_id`, `section_number`, `acknowledged_by`, `governed_timestamp`, `section_summary`.
- `HANDOFF_COMPLETE`: `handoff_id`, `from_operator_id`, `to_operator_id`, `completed_at`, `venues_transferred`, `time_to_accept_seconds`.
- `HANDOFF_INCOMPLETE`: `handoff_id`, `detected_at`, `reason` (timeout or expired).

**Emergency handoff events:**
- `EMERGENCY_HANDOFF_INITIATED`: `handoff_id`, `from_operator_id`, `to_operator_id` (nullable), `initiated_at`.
- `EMERGENCY_HANDOFF_ACCEPTED`: `handoff_id`, `acknowledged_by`, `governed_timestamp`.
- `FULL_RETROSPECTIVE_PACKAGE_ATTACHED`: `handoff_id`, `attached_at`, `package_hash`.

**Unplanned replacement events:**
- `UNATTENDED_RESPONSIBILITY_DETECTED`: `operator_id`, `session_expired_at`, `responsibilities` (array: type, id, details).
- `RESPONSIBILITY_CLAIMED`: `handoff_id`, `claimed_by`, `claimed_at`, `responsibility_type`, `responsibility_id`.
- `UNPLANNED_HANDOFF_COMPLETE`: `handoff_id`, `from_operator_id`, `to_operator_id`, `completed_at`, `claimed_items`.

**Command transfer events (incident commander):**
- `COMMAND_TRANSFER_INITIATED`: `incident_id`, `from_commander_id`, `to_commander_id`, `initiated_at`.
- `TRANSFER_SUMMARY_VIEWED`: `incident_id`, `recipient_operator_id`, `viewed_at`.
- `COMMAND_TRANSFERRED`: `incident_id`, `from_commander_id`, `to_commander_id`, `transferred_at`, `governed_timestamp`.
