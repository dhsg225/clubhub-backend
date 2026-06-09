# INFORMATION-LIFECYCLE-AND-RETENTION-v1

**Version:** 1.0
**Authority:** Platform Governance
**Applies to:** All subsystems that store, archive, or expose operational information. Supersedes any prior retention policy or data lifecycle specification.

---

## Governing Principles

Five principles govern all information lifecycle decisions in this platform. No subsystem, role, or operational circumstance overrides these principles.

**1. Append-only corpus.** The corpus never loses information. Records move through lifecycle states but are never deleted. A corpus that has lost records is corrupted, not managed.

**2. Replay permanence.** Any operational event that has ever been part of the corpus must remain reconstructible indefinitely. Archival does not impair reconstruction. Storage management does not override replay obligations.

**3. Attribution permanence.** Who did what, when, is never erasable. Operator IDs, governed timestamps, and author fields on any entity are immutable and irremovable.

**4. Supersession, not mutation.** When information becomes outdated, a new record supersedes the old. The old record remains, marked SUPERSEDED. The platform has no general mutation path for operational records.

**5. Redaction scope.** Only operator-authored free-text fields may be redacted, and only on receipt of a legal order. Machine-produced fields, IDs, timestamps, structured data fields, and status fields may never be redacted.

---

## Lifecycle Stages

All operational entities exist in exactly one lifecycle stage at any point in time. Stages are mutually exclusive.

| Stage | Meaning | Queryable | Replay obligation | Mutation permitted |
|---|---|---|---|---|
| ACTIVE | Current, relevant, in operational use | Yes | Yes | Per update governance table |
| ARCHIVED | Retention period active; not in active operational use | Yes | Yes | No |
| SUPERSEDED | Replaced by a newer version; original remains | Yes | Yes | No (marker only) |
| REDACTED | Free-text fields replaced with redaction marker; all other fields intact | Yes | Yes (redacted fields shown as markers) | No (redaction is one-way) |

### Forbidden stage: DELETED

DELETED is not a permitted lifecycle stage for any operational entity class. Deletion is permanently prohibited for all entities listed in this document.

### Exception procedure for test/duplicate record deletion

If a record was created in error (test data promoted to production, duplicate records produced by a defect), deletion may be performed only when all of the following are satisfied:

1. An ADMIN must approve the deletion explicitly
2. A formal deletion request must be opened as an incident record documenting: the nature of the error, the records affected, and the reason standard supersession cannot address the problem
3. The deletion must be executed by a platform engineer with direct database access (not through the application API)
4. A deletion log must be created and retained permanently. The deletion log records: entity class, entity ID, deleted_by, deleted_at, governing incident_id, reason, hash of deleted content

The deletion log itself is permanent and cannot be deleted. The absence of a deletion log for a missing record is a corpus integrity violation.

---

## Entity Class Retention Table

| Entity Class | Minimum Retention | Archival Trigger | Replay Obligation | May Be Redacted |
|---|---|---|---|---|
| Incident | 7 years | 1 year after RESOLVED | Yes — full lifecycle including every state transition and commander assignment | Annotation text (closure note) only |
| Alert | 2 years | 90 days after EXPIRED or ACKNOWLEDGED | Yes — source event must reconstruct the alert condition | No |
| Override | 7 years | 90 days after REMOVED or EXPIRED | Yes — PRE resolution at the override's scope and time must reproduce the override's effect | Reason text (operator-entered justification) only |
| Venue Status | 2 years (state changes only; not continuous) | 30 days after supersession | Yes | No |
| Recovery Action | 7 years | 1 year after workflow COMPLETE | Yes | Notes field only |
| Investigation Session | 7 years | 1 year after CONCLUDED or ABANDONED | Yes — all annotations must be queryable at archival | No |
| Replay Annotation | Permanent | Never archived — always queryable | Yes | No |
| Handoff Package | 7 years | 1 year after COMPLETED or EXPIRED | Yes | Outgoing operator annotation only |
| Certification Record | 10 years | 2 years after EXPIRED | Yes — issuance event must reconstruct the certification state at any point in validity | No |
| Trust Signal | 90 days | 30 days after supersession | Yes — the basis used for any trust computation must be reconstructible | No |
| Readiness Signal | 90 days | 30 days after supersession | Yes | No |
| Operational Warning | 2 years | 90 days after RESOLVED | Yes | No |
| Operational Finding | Permanent | Never archived | Yes — evidence_basis[] must be queryable at any time | No |
| Audit Trail Events | Permanent | Never — audit events are never archived or truncated | Yes | No |

---

## What May Never Be Deleted

The following entity classes carry a permanent deletion prohibition. Deletion is forbidden even with ADMIN credentials, database access, or a platform engineer's manual intervention, except under the exception procedure above.

1. Any audit trail event
2. Any replay annotation
3. Any operational finding (including SUPERSEDED findings)
4. Any incident record (including incidents in RESOLVED state)
5. Any handoff package record (including EXPIRED packages)
6. Any certification record (including EXPIRED certifications)
7. Any corpus entry (the PRE resolution corpus is append-only at the schema level — enforced by DB constraint)
8. Any `COMMAND_TRANSFERRED` event (command chain must be permanently reconstructible)
9. Any `EMERGENCY_HANDOFF` event
10. Any constitutional state transition event (every transition between HEALTHY, DEGRADED, CONSTITUTIONAL_RISK, SHADOW_ONLY, PRE_DISABLED, READ_ONLY, EMERGENCY_FREEZE)
11. Any INVESTIGATION_OPENED, INVESTIGATION_CONCLUDED, or INVESTIGATION_ABANDONED event
12. Any `ANNOTATION_WRITTEN` audit event (even when the annotation itself is SUPERSEDED)

**Enforcement:** The application API must return 405 Method Not Allowed for DELETE on all entity endpoints for these classes. The database schema must enforce append-only constraints on corpus tables. Schema-level enforcement takes precedence over application-level enforcement — the database must independently reject deletions.

**Audit enforcement:** Any attempt to delete a permanently prohibited entity must itself be logged as an audit event: `DELETION_ATTEMPT_BLOCKED`: entity_class, entity_id, attempted_by, attempted_at, result.

---

## What May Be Redacted

Redaction replaces a field value with a redaction marker. The entity record, all other fields, all IDs, and all timestamps remain intact. The redaction is itself an audit event.

**Redaction marker format:**
```
[REDACTED - legal order #[ORDER_ID] - redacted_at:[governed_timestamp] - redacted_by:[operator_id]]
```

**Redaction authority:** ADMIN role + a formal legal order document. Redaction without a legal order is a constitutional violation.

### Fields eligible for redaction

| Entity class | Eligible field | Notes |
|---|---|---|
| Replay Annotation | `text` | The annotation body. annotation_id, authored_by, authored_at, anchored_to remain |
| Incident | `resolution_annotation` | The operator-entered closure note only |
| Override | `reason` | The operator-entered justification text only |
| Recovery Action | `notes` | Operator notes field only |
| Operational Finding | `finding_text` | The conclusion text. evidence_basis[], authored_by, authored_at remain |
| Handoff Package | `outgoing_operator_annotation` | The optional annotation added by the outgoing operator |

### Fields that may never be redacted

Permanently non-redactable:
- Any `_id` field (entity IDs, operator IDs, session IDs, venue IDs, scope IDs)
- Any `_at` timestamp field (governed timestamps of any kind)
- Any state, status, or classification field
- Any hash field (text_hash, corpus_hash, content_hash)
- Any `authored_by`, `placed_by`, `declared_by`, `completed_by`, `removed_by`, `triggered_by`, `run_by`, or equivalent attribution field
- Any `scope_id` or `venue_id`
- Any `evidence_basis[]` array
- Any machine-produced structured data field (PRE input/output, trust signal basis, health computation basis)

**Redaction audit event:** `REDACTION_EVENT`: entity_class, entity_id, field_name, redacted_by, governed_timestamp, legal_order_id, prior_hash (hash of the value before redaction, for integrity verification).

---

## What May Be Superseded

Supersession is the primary lifecycle operation for replacing outdated information with current information. The old record remains. The new record references the old.

### Supersession data model

```
{
  superseded_entity_id: string,  // the record being superseded
  supersedes: string,             // on the NEW record — ID of the record it supersedes
  superseded_by: string,          // on the OLD record — ID of the new record (system-written)
  superseded_at: governed_timestamp
}
```

### Entities that use supersession

| Entity | When supersession occurs | Authority |
|---|---|---|
| Operational Finding | A new finding for the same investigation explicitly references the prior finding | Investigation session owner or ADMIN |
| Certification Record | Renewal — the renewed certification supersedes the prior | System on scenario completion; or ADMIN on instructor attestation |
| Operational Warning | Re-assessment produces a new warning record for the same condition | System (automated re-assessment) |
| Trust Signal | Each new trust computation supersedes the prior for the same source | System (automated computation) |
| Venue Status | Each new state supersedes the prior for the same venue and dimension | System (automated computation) |
| Replay Annotation | A corrective annotation references a prior annotation via `supersedes` | Any operator who is a participant in the session |

**Supersession chain:** Multiple supersessions are permitted. A record may be superseded by a record that is itself later superseded. The full chain must be queryable. The effective current record is the most recent non-superseded record in the chain.

**Supersession audit event:** `ENTITY_SUPERSEDED`: entity_class, old_entity_id, new_entity_id, superseded_at, superseded_by_operator_id (or SYSTEM).

---

## What Must Remain Permanently Reconstructible

The following operational facts must be reconstructible at any governed_timestamp from the audit trail alone, without reliance on external systems, backups, or operator memory.

| Reconstructible fact | Required source data | Reconstruction method |
|---|---|---|
| PRE resolution output for any venue at any governed_timestamp | Corpus event for that resolution + all active overrides + active corpus at that time | Replay corpus events in sequence |
| Constitutional state at any governed_timestamp | All constitutional state transition events | Walk the transition event chain to the target timestamp |
| Incident lifecycle for any incident | All state transition events for the incident_id | Replay state transitions from DECLARED to terminal state |
| Command chain for any incident | All `COMMAND_TRANSFERRED` and `EMERGENCY_HANDOFF` events for the incident_id | Walk the command assignment chain |
| Override stack for any venue at any governed_timestamp | All override create/expire/remove events for the venue_id | Compute active overrides at target timestamp from event history |
| Certification status for any operator at any governed_timestamp | All certification issuance and supersession events for the operator_id | Walk the certification chain |
| Venue readiness at any governed_timestamp | Heartbeat events, corpus hash verification events, player state transition events | Compute readiness from contributing signal history |
| Handoff completion for any handoff | Handoff package creation, section acknowledgement, acceptance events | Walk the handoff event chain |

**Reconstruction test requirement:** For each fact in this table, a reconstruction test must exist that: (1) populates the corpus with known events, (2) queries the reconstructible fact at a historical timestamp, (3) asserts the result matches the known expected state. These tests must be run in CI.

---

## Creation Governance

### When entities are created

| Entity class | Creation trigger | Minimum role |
|---|---|---|
| Incident | OPERATOR+ explicit declaration, or system on EMERGENCY_FREEZE | OPERATOR (manual); SYSTEM (automatic) |
| Alert | System event processing only | SYSTEM only |
| Override | OPERATOR+ explicit creation with appropriate level authority | OPERATOR (L1–L3); ADMIN (L4–L6) |
| Investigation Session | OPERATOR+ opens a replay session | OPERATOR |
| Replay Annotation | OPERATOR+ writes within an open investigation session | OPERATOR |
| Handoff Package | OPERATOR+ initiates handoff | OPERATOR |
| Certification Record | System on scenario completion or ADMIN on instructor attestation | SYSTEM (automated); ADMIN (instructor) |

### Creation constraints

**CC-01:** Every entity must have a governed_timestamp at creation. Wall-clock time (Date.now(), new Date()) may not be used as the governing timestamp. The governed clock (from the platform clock authority) must be used.

**CC-02:** Every entity must have an author or creator field (`opened_by`, `declared_by`, `placed_by`, `authored_by`, or equivalent). No entity may be created without an attributed creator.

**CC-03:** Every entity must have a scope_id — either a venue_id (for venue-scoped entities) or a fleet_id (for fleet-scoped entities). Unscoped entities are not permitted.

**CC-04:** governed_timestamp at creation must be within the configured backdating_tolerance (default: 5 seconds) of the current governed clock time. governed_timestamp values more than 5 seconds in the past are rejected as backdated.

**CC-05:** governed_timestamp values in the future are rejected unconditionally.

### Forbidden creation patterns

- Creating an entity with a past governed_timestamp beyond backdating_tolerance (backdating)
- Creating an entity without a creator ID
- Creating an entity without a scope_id
- Creating an entity by copying a record from another venue without creating a new entity_id and governed_timestamp
- Creating audit events separately from (or asynchronously with) the entity creation they describe — audit events must be written in the same transaction

---

## Update Governance

Most entities are immutable after creation. Supersession is the path for outdated information. The following table specifies the complete set of permitted post-creation mutations.

| Entity | Mutable fields | Authority | Audit requirement |
|---|---|---|---|
| Incident | `current_state` (per state machine), `severity` (per severity governance), `commander_id` (on command transfer) | Per state machine and severity rules | Every mutation is an audit event; no batch mutations |
| Override | `expires_at` (extension only, never earlier), `status` (ACTIVE → REMOVED or EXPIRED only) | `placed_by` operator or ADMIN | Extension event records old_value and new_value; ADMIN extensions additionally record justification |
| Investigation Session | `concluded_at`, `conclusion_type`, `linked_finding_ids[]` | Session owner (`opened_by`) or ADMIN | Conclusion event |
| Handoff Package | `to_operator_id` (only if current value is UNASSIGNED), `section_acknowledgements[]` (append-only), `completed_at` (once only) | System-written on operator action | Each section acknowledgement is a separate audit event |
| Certification Record | `expires_at` (renewal only; must be later than current value), `skill_decay_detected_at` (set once by system) | System only | Renewal event records prior_expires_at and new_expires_at |

### Forbidden updates — permanent prohibition

The following fields may never be changed after their initial write, by any role, under any circumstance:

- Any `_at` timestamp field on any entity (`created_at`, `opened_at`, `declared_at`, `authored_at`, `placed_at`, `concluded_at`, `completed_at` — once written, immutable)
- Any `_by` attribution field on any entity (`opened_by`, `declared_by`, `authored_by`, `placed_by`, `concluded_by` — once written, immutable)
- An incident's `scope_id`, `declared_at`, or `declared_by`
- An override's `placed_at`, `placed_by`, `level`, or `scope_id`
- An annotation's `text`, `authored_by`, `authored_at`, or `anchored_to`
- A finding's `authored_by`, `authored_at`, or `evidence_basis[]` (evidence may only be extended by supersession, not mutation)
- A certification record's `issued_at`, `issued_by`, `operator_id`, or `scenario_ids[]`
- A handoff package's `opened_at`, `opened_by`, `venue_id`, or `section_contents[]` (sections are immutable once written)

**Enforcement:** The application API must return 422 Unprocessable Entity for any attempt to mutate a forbidden field. The error response must name the specific forbidden field. The database schema must enforce immutability via trigger or constraint where feasible.

---

## Archival Requirements

Archival moves an entity from ACTIVE to ARCHIVED. Archival does not delete records. Archival does not impair reconstruction.

### Requirements for archived records

**AR-01:** Archived records must remain queryable via API. The archive flag is a filter option — archived records are hidden from default operational views but are returned when `include_archived=true` is passed.

**AR-02:** Archived records must remain included in audit trail exports. An audit export that omits archived records is incomplete.

**AR-03:** Archived records must remain replay-reconstructible. Archival does not truncate the audit trail for the affected entities.

**AR-04:** Archived records must carry `archived_at` (governed_timestamp) set at the time of archival.

**AR-05:** The audit trail for an archived entity must not be truncated at archival. All audit events for the entity remain queryable.

**AR-06:** Archival before the scheduled trigger (early archival) may only be performed by ADMIN. Early archival must include a justification reason. The justification is logged as an audit event: `EARLY_ARCHIVAL`: entity_class, entity_id, archived_by, archived_at, justification, scheduled_archival_date.

**AR-07:** Early archival may not be used to evade audit requirements or retention obligations. Early archival of an entity with open linked investigations is rejected.

### Archival trigger mechanism

Archival is time-based (see retention table). The platform must maintain an archival scheduler that evaluates entities against their configured archival triggers. The archival scheduler runs on a configurable interval (default: daily). Each archival action is an audit event.

---

## Lifecycle Verification Tests

These tests must exist and must pass in CI for each entity class.

### LV-01: Creation immutability

**Procedure:** Create an entity. Attempt to modify an immutable field via the API (e.g., PATCH `authored_by`).

**Assert:** HTTP 422 response. Error response names the specific forbidden field. No audit event is written for the attempted modification. The entity record is unchanged.

### LV-02: Supersession chain integrity

**Procedure:** Create entity A. Create entity B that supersedes A. Query entity A. Query entity B.

**Assert:** Entity A is marked SUPERSEDED with `superseded_by = B.entity_id`. Entity B contains `supersedes = A.entity_id`. Both records exist in the corpus. The supersession audit event exists with both entity IDs.

### LV-03: Deletion rejection

**Procedure:** Attempt to DELETE any entity via API (DELETE method on any entity endpoint).

**Assert:** HTTP 405 Method Not Allowed for all entity endpoints in the permanently prohibited class. No record is removed from storage. A `DELETION_ATTEMPT_BLOCKED` audit event is written.

### LV-04: Replay reconstruction

**Procedure:** For each entity class: create an entity, advance it through lifecycle states, then query the entity state at a historical governed_timestamp (before the entity reached its current state).

**Assert:** The returned state matches the recorded state at that timestamp. The response is identical across multiple queries for the same historical timestamp (determinism). The reconstruction does not require data outside the audit trail.

### LV-05: Redaction audit completeness

**Procedure:** Perform a redaction on an eligible field. Query the entity. Query the audit trail.

**Assert:** The field value is replaced with the redaction marker (format: `[REDACTED - legal order #X - ...]`). All other fields on the record are unchanged. A `REDACTION_EVENT` exists in the audit trail with: field_name, entity_id, redacted_by, governed_timestamp, legal_order_id, prior_hash.

### LV-06: Retention floor enforcement

**Procedure:** Attempt to archive an entity before its minimum retention period has elapsed.

**Assert:** The archival is rejected. The error response states: "Minimum retention period not elapsed. Entity [ID] is eligible for archival at [ISO date]." No archive action is taken. No audit event for archival is written (a `RETENTION_FLOOR_VIOLATION_ATTEMPT` event may be written if configured).

### LV-07: Permanent entity permanence

**Procedure:** For entities in the "may never be deleted" class: attempt deletion via the administrative API using credentials with ADMIN role.

**Assert:** HTTP 403 Forbidden even with ADMIN credentials. The permanent entity flag (enforced at DB schema level) cannot be unset by any API call. A `DELETION_ATTEMPT_BLOCKED` audit event is written for the ADMIN attempt.

### LV-08: Creation timestamp integrity

**Procedure:** Attempt to create an entity with a `governed_timestamp` value more than 5 seconds in the past (beyond configured backdating_tolerance).

**Assert:** HTTP 422 Unprocessable Entity. Error message: "governed_timestamp backdating not permitted. Provided: [timestamp]. Current governed time: [timestamp]. Difference: [N] seconds exceeds tolerance of 5 seconds." No entity is created. No audit event is written for the creation.

### LV-09: Audit atomicity

**Procedure:** For every entity creation and state mutation: examine the database transaction log to confirm that the entity write and the corresponding audit event write occur in the same transaction.

**Assert:** There is no state in which the entity record exists but the corresponding audit event does not. There is no state in which the audit event exists but the entity record does not.

### LV-10: Archival queryability

**Procedure:** Archive an entity. Query the entity endpoint without `include_archived=true`. Query again with `include_archived=true`.

**Assert:** First query returns 404 or empty result (entity excluded from default view). Second query returns the entity with `archived_at` set and `status: ARCHIVED`. The entity's full audit trail is queryable. Reconstruction of the entity at any historical timestamp succeeds.

---

## Governing Clock Requirements

All lifecycle timestamps in this platform use the governed clock, not wall-clock time.

**GC-01:** `governed_timestamp` is produced by the platform's clock authority (the governed clock subsystem). It is not `Date.now()`, `new Date()`, or any OS-level clock call.

**GC-02:** The governed clock incorporates drift correction. Clock drift beyond the configured drift_tolerance must trigger a DEGRADED trust signal for any entity created during the drift period.

**GC-03:** Clock-skewed entities (created during a period of clock drift) are not retroactively corrected. Their governed_timestamps remain as recorded. The drift event is recorded in the audit trail, providing context for investigators reviewing events from that period.

**GC-04:** All archival triggers, retention floor computations, and expiry calculations use governed clock time, not wall-clock time.

---

## Cross-Reference: Related Documents

| Document | Relationship |
|---|---|
| OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md | Defines trust signals that are subject to the retention rules in this document |
| INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1.md | Defines investigation, annotation, and finding entities; this document governs their lifecycle |
| INCIDENT-INFORMATION-MODEL-v1.md | Defines incident entities; this document governs incident retention and lifecycle stages |
| HANDOFF-AND-COMMAND-TRANSFER-MODEL-v1.md | Defines handoff packages; this document governs handoff retention |
| CERTIFICATION-AND-TRAINING-MODEL-v1.md | Defines certification records; this document governs certification lifecycle |
