# Multi-Operator Coordination Specification v1

**Classification:** Implementation-grade operational specification
**Applies to:** All operator roles (VIEWER L1, OPERATOR L2/L3, ADMIN L4)
**Constitutional constraint:** All state changes logged with governed timestamp and actor. No operational state may exist only in a human's head.
**References:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, OPERATIONAL-WORKFLOW-ARCHITECTURE-v1.md

---

## Overview

The platform supports multiple simultaneous operators. Most operations are non-conflicting. Conflicts arise at specific boundaries: authority, scope, and timing. This document defines those boundaries and how conflicts resolve.

Governing principle: the platform makes conflict visible and auditable. It does not silently resolve conflicts.

---

## Concurrent Actions

### Rule CA-01: Parallel Non-Conflicting Operations

Multiple operators may simultaneously perform the following without any coordination mechanism. Each produces an independent audit trail entry.

**Permitted concurrent operations:**
- View any venue within assigned access scope
- Run independent replay sessions (each scoped to session_id + operator_id)
- Review approval queues
- Add annotations to incidents or replay sessions
- View the same incident in Incident Commander Surface (one is commander; others are observers)
- Place overrides at different levels on the same venue (different levels are additive in the PRE stack)
- Make schedule changes to non-overlapping time slots

**Approved behavior:** All of the above proceed without coordination, locks, or notifications.

**Forbidden behavior:** Requiring operator acknowledgment or coordination before performing any of the above.

**Operational consequence of over-restriction:** Operators unable to work in parallel; operational throughput collapses during incidents when multiple operators are needed.

**Verification:** Audit trail shows independent entries with distinct operator_id, timestamp, and action per concurrent operation.

---

### Rule CA-02: Conflicting Level Overrides

**Scenario:** Two operators attempt to place overrides at the same level on the same venue simultaneously.

**Resolution:** First-writer-wins. The override committed to the database first is active. The second operator's submission returns an error.

**Error message:** "A Level [N] override was placed on this venue while you were completing this form. Review current override stack and resubmit if needed."

**Approved behavior:** Error returned to second operator. First override is active. Second operator sees the current override stack immediately and can resubmit at the same or a different level.

**Forbidden behavior:** Silent merge of two overrides at the same level. Applying both overrides at the same level with undefined precedence.

**Operational consequence of silent merge:** Two overrides at the same level with no defined winner; PRE resolution undefined.

**Verification:** Override placement uses optimistic locking on `(venue_id, level)`. A second write to the same `(venue_id, level)` within the same transaction window returns a conflict error with the current stack state in the response body.

---

### Rule CA-03: Emergency Override During Normal Override Placement

**Scenario:** Operator A is completing a Level 1–5 override form. Operator B places a Level 6 emergency override on the same venue before Operator A submits.

**Resolution:** Level 6 wins immediately upon placement. Operator A's form is not invalidated — Operator A can still submit their Level 1–5 override. PRE will SUPPRESS that override because Level 6 is active, but the override enters the stack.

**System message to Operator A at submission:** "Emergency override (Level 6) was placed on this venue while you were completing this form. Your Level [N] override has been placed and is in the stack, but is currently SUPPRESSED by the active Level 6 override. It will become active when the emergency override is removed."

**Approved behavior:** Both overrides placed. Level 6 wins. Lower-level override enters stack with SUPPRESSED status. Both are auditable.

**Forbidden behavior:** Blocking Operator A's override placement because Level 6 is active. PRE handles suppression — both are placed. Silently discarding Operator A's override without recording it.

**Operational consequence of blocking:** Override that should enter the stack for post-emergency restoration is never placed; recovery state is incomplete.

**Verification:** PRE resolution trace always shows winner and all suppressed entries. Operator notified at placement time if their submitted override is immediately suppressed. Both override records present in `override_stack` table with correct `suppressed_by` reference.

---

## Authority Collisions

### Rule AUTH-01: Approval Authority Collision

**Scenario:** Two ADMIN operators attempt to approve the same pending item simultaneously.

**Resolution:** First-approver-wins. The approval committed first is recorded. Second approver receives an informational response.

**Response to second approver:** "This item was already approved by [operator_id] at [timestamp]."

**Approved behavior:** Single approval recorded. Second action returns informational message. Item status = APPROVED with single approver.

**Forbidden behavior:** Recording two approvals for one item. Silently no-oping the second approval without informing the second operator.

**Operational consequence of double approval:** Audit trail confusion; compliance checks may flag item as requiring re-review; intent of second approver is unrecorded.

**Verification:** Approval action uses check-and-set on `item.status`. If `status = APPROVED` at time of second write, return 409 with approver and timestamp. No second approval record created.

---

### Rule AUTH-02: Incident Commander Authority

At any moment, exactly one operator holds incident commander authority for a given incident. All state-changing actions in the incident — state transitions, recovery protocol initiation, Level 6 override via incident pathway — require the actor to be the current incident commander.

**Commander identity:** Stored as `commander_id` on the incident record. Updated only via explicit command transfer (see SHIFT-HANDOFF-AND-CONTINUITY-v1.md).

**Non-commander operators:** Action buttons (state transition, recovery initiation, L6 override via incident) are rendered greyed with tooltip: "Commander action only. Current commander: [operator_id]."

**Approved behavior:** Non-commander operators can view all incident data, add annotations, run replay sessions from incident context, and acknowledge notifications. They cannot change incident state.

**Forbidden behavior:** Multiple simultaneous incident commanders for one incident. State-changing incident actions accepted from non-commander operators.

**Operational consequence of multiple commanders:** Conflicting recovery actions; incident state transitions in contradictory sequence; undefined incident resolution ownership.

**Verification:** All state-changing incident actions validate actor against current `commander_id` server-side. Client-side greying is advisory only; server enforces authority. Validation failure returns 403 with current `commander_id`.

---

### Rule AUTH-03: Simultaneous Freeze Resolution Attempts

**Scenario:** Two ADMIN operators both attempt to initiate constitutional freeze resolution simultaneously.

**Resolution:** First-initiator-wins. Only one freeze resolution workflow may be open at a time.

**Response to second initiator:** "Freeze resolution is already in progress by [operator_id]. Monitor progress in Zone C Pane C4."

**Approved behavior:** First initiator proceeds through freeze resolution workflow. Second initiator is informed and directed to observe. Zone C Pane C4 shows resolution progress for all observers.

**Forbidden behavior:** Two simultaneous freeze resolution workflows producing conflicting authorization tokens. Allowing second initiation to proceed in parallel.

**Operational consequence of parallel resolution:** Double-resolution attempt; authorization token replay risk; constitutional state transitions from two independent workflows; audit trail contains contradictory resolution events.

**Verification:** Freeze resolution workflow uses an exclusive lock scoped to the freeze event ID. Only one `freeze_resolution_workflow` record with `status = OPEN` permitted per `freeze_event_id`. Second initiation attempt returns 409. Lock released on completion or operator-initiated cancellation only.

---

## Observation Sharing

### Rule OBS-01: Shared Incident View

Multiple operators can view the same incident in Incident Commander Surface simultaneously.

**Shared view contents (identical for all viewers):**
- IC-LEFT event log (live-updating from single source)
- IC-RIGHT state panels
- IC-TOP header including incident ID, severity, current state, and commander identity

**Operator presence:** Up to 5 operator identifiers shown in IC-TOP right margin. "+N more" shown when additional operators are present.

**Non-commander operators:** State-changing action buttons shown greyed with "Commander action only" tooltip. [Add Note] available to all operators regardless of commander role.

**Approved behavior:** Consistent shared read-only view with live updates. All operators see the same event log in the same order.

**Forbidden behavior:** Different operators seeing different versions of the incident event log. Commander and non-commander operators seeing different incident state data.

**Operational consequence of inconsistent views:** Coordination failure — operators believe incident is in different states; recovery actions based on incorrect state assumptions.

**Verification:** Incident event log served from single authoritative source. All clients subscribe to same event stream. Server-side event ordering is canonical. No client-side event filtering or reordering.

---

### Rule OBS-02: Replay Session Independence

Replay sessions are per-operator. Operator A opening a replay session for Venue X at T-2h does not create or affect Operator B's view.

**Session scope:** `session_id + operator_id`. Sessions are not shared by default.

**Sharing mechanism:** Evidence packages created by ADMIN can be shared by `package_id` with specific operators. Shared packages give named operators read access to the package's corpus snapshot, replay timeline, and annotations. Sharing is explicit — no passive discovery.

**Approved behavior:** Independent replay sessions. Evidence packages shared via explicit `package_id` grant.

**Forbidden behavior:** One operator's active replay session appearing in another operator's Replay & Forensics workspace. Passive broadcasting of replay sessions.

**Operational consequence of session bleed:** Operator confused by another operator's investigation state; annotations from a different investigation appear as own work.

**Verification:** Replay session records include `operator_id`. All session queries are scoped by `operator_id`. Evidence package access is checked against `package_grants` table on every access.

---

### Rule OBS-03: Live Venue State Consistency

All operators viewing the same venue simultaneously see the same Zone B state: same player state, same PRE resolution output, same override stack. Data is server-authoritative.

**Approved behavior:** Consistent live state across all simultaneous viewers. Any update propagates to all viewers within one server-push cycle.

**Forbidden behavior:** Different operators seeing different "current" override stacks for the same venue. Client-side speculation about live override state.

**Operational consequence of inconsistency:** Operators take coordination actions based on different state assumptions; two operators believe conflicting things about what content is playing.

**Verification:** Live venue data served from single source. State is pushed to all subscribed clients from the same authoritative snapshot. No client-side state synthesis for live views.

---

## Investigation Collaboration

### Rule IC-01: Parallel Investigation Sessions

Two operators can open independent replay sessions for the same venue and overlapping time ranges. Sessions do not interfere. Each produces independent annotations.

**Cross-session annotation visibility:** Annotations added in any replay session for a given `(venue_id, time_range)` are visible to any operator opening a subsequent replay session covering that time range. Annotations are not session-private.

**Approved behavior:** Parallel sessions. Annotations from both sessions visible in subsequent replay of the same timeframe.

**Forbidden behavior:** Two replay sessions for the same incident producing conflicting root cause determinations with no reconciliation mechanism beyond annotation visibility.

**Operational consequence of unreconciled contradictions:** Incident record contains two contradictory root cause annotations. Supervisory review required.

**Verification:** No system prevention of contradictory annotations. Behavioral expectation: annotations state the author's finding and reasoning. Contradiction is visible in the record. Supervisor reviews. Platform responsibility is transparency, not enforcement of agreement.

---

### Rule IC-02: Collaborative Evidence Package

An evidence package created by ADMIN can be shared with any operator via `package_id` grant. Package contents are immutable once created (hash-verified at creation). Viewing operators can add annotations to the package — annotations are additive and do not modify the base package.

**Approved behavior:** Shared evidence package with immutable base content. Additive annotations by any granted operator.

**Forbidden behavior:** Modifying the base evidence package content after creation. Annotations that overwrite or replace original package content.

**Operational consequence of mutable evidence:** Investigation evidence contaminated; hash verification fails; package inadmissible as audit artifact.

**Verification:** Package base content hash verified on each view access. Any attempt to modify base content (not add annotation) is rejected at the API layer. `package_content_hash` is stored at creation and re-verified on read.

---

## Locking Rules

### Rule LOCK-01: No Optimistic UI Locking for Normal Operations

Normal operations (placing overrides, editing schedule blocks, filling forms) do not lock the UI for other operators. Two operators can both be filling out override forms simultaneously. First writer wins (see CA-02).

**Rationale:** UI locking degrades operational fluency under normal conditions more than conflicts arise. Platform conflict rate is low; coordination overhead is high.

**Three operations that use hard locks:**
1. Approval of a specific item (AUTH-01) — check-and-set on item status
2. Incident commander state-changing actions (AUTH-02) — commander_id validation
3. Constitutional freeze resolution (AUTH-03) — exclusive lock per freeze event

All other operations use optimistic concurrency. Conflict is surfaced at write time, not at form-open time.

**Approved behavior:** Operators can initiate any form without checking whether another operator is doing the same. Conflicts resolved at submission.

**Forbidden behavior:** Locking a form to a single operator at open time. Preventing a second operator from opening a form because someone else has it open.

**Operational consequence of excessive locking:** Operator A's open form blocks Operator B indefinitely during incidents when parallel action is required.

**Verification:** No lock record created on form open. Conflict detection occurs at write time via optimistic locking fields (`updated_at`, `version`, or `(venue_id, level)` as appropriate).

---

### Rule LOCK-02: Schedule Block Editing

When an operator opens a schedule block for editing, the block is not locked for other operators. Two operators can edit the same block simultaneously.

**Conflict resolution:** Last writer wins at the data layer. Both edits enter the approval queue as separate pending items with distinct submitter and submission_timestamp. Approver reviews both and approves one, rejects the other.

**Approved behavior:** Both edits in approval queue. Approver sees both with submitter identity and submission time. Approver approves one and rejects the other with a rejection reason.

**Forbidden behavior:** Silently applying both edits (producing combined schedule block). Auto-merging edits. Approving both without distinguishing them.

**Operational consequence of silent merge:** Schedule block receives unintended combined edit; neither operator's intent is accurately executed.

**Verification:** Approval queue items include `submitter_id`, `submitted_at`, and a diff view showing what changed. Approver interface requires approving exactly one of the two conflicting edits before approving either.

---

## Advisory vs Authoritative Actions

All platform actions are classified as advisory or authoritative.

### Advisory Actions

Advisory actions inform operators without changing platform state. Multiple operators can perform any advisory action simultaneously without coordination, locks, or conflict detection.

**Advisory actions include:**
- Viewing PRE resolution trace
- Running counterfactual preview
- Reading entropy signals in Zone C
- Viewing the current override stack
- Reading the incident log
- Opening replay sessions
- Viewing approval queue contents
- Viewing any dashboard or surface

Each advisory action produces an audit trail entry (view events) but no state change.

### Authoritative Actions

Authoritative actions change platform state. Each authoritative action requires correct role, correct session elevation where specified, and the relevant concurrency control mechanism.

**Authoritative actions and their concurrency controls:**

| Action | Role required | Concurrency control |
|---|---|---|
| Place override (L1–L5) | L2+ OPERATOR | Optimistic lock on `(venue_id, level)` |
| Place emergency override (L6) | L3 elevated or L4 ADMIN | Optimistic lock on `(venue_id, level=6)` |
| Remove override | L3+ or L4 ADMIN (L6 requires elevation) | Check-and-set on override status |
| Declare incident | L2+ OPERATOR | No lock — multiple can declare; first creates incident |
| Transition incident state | Incident commander only | Commander_id validation |
| Approve schedule change | L4 ADMIN | Check-and-set on item status |
| Initiate freeze resolution | L4 ADMIN | Exclusive lock per freeze event |
| Trigger venue re-enrollment | L4 ADMIN | No lock |

**Approved behavior:** Authoritative actions validated server-side against role, session elevation, and concurrency state.

**Forbidden behavior:** Client-side role enforcement as the only gate. Skipping concurrency control because "conflicts are unlikely."

**Operational consequence of missing server validation:** Privilege escalation; conflicting state changes; audit trail gaps.

**Verification:** Server validates role and session elevation on every authoritative action endpoint. Concurrency control mechanisms tested with concurrent request injection.

---

## Conflict Resolution Summary

| Conflict type | Resolution mechanism | Notification to affected operator |
|---|---|---|
| Same-level override collision | First writer wins | Second operator: conflict error with current stack shown |
| Emergency override during form completion | Both placed; L6 wins | Second operator: advisory message at placement time |
| Simultaneous approval | First approver wins | Second approver: "already approved by [id] at [timestamp]" |
| Incident commander authority | Single commander; explicit transfer only | Non-commanders: greyed controls with current commander shown |
| Constitutional freeze resolution | Exclusive lock; first initiator proceeds | Second initiator: "in progress by [id]" with observer redirect |
| Schedule block edit collision | Both in approval queue; approver resolves | Approver: sees both edits with diff and submitter identity |

---

## Constitutional Constraints

1. Every authoritative action produces an audit trail entry with: actor (`operator_id`), timestamp (governed), action type, target, outcome, and any conflict details.
2. Conflict resolutions are never silent. The losing party always receives a message explaining what happened.
3. No operator is removed from a surface or workflow without a transition record.
4. Observation of any surface is always permitted regardless of authority level — read access is never gated by concurrency state.
5. The platform never assumes a conflict is impossible because two operators "shouldn't" be doing the same thing simultaneously.
