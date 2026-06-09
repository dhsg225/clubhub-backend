# INCIDENT-INFORMATION-MODEL-v1

**Document class:** Implementation-grade operational information model
**Authority:** Constitutional — incident records cannot be deleted or redacted
**Audience:** Backend API teams implementing incident CRUD, state machine, and audit trail; frontend teams implementing incident views and command transfer flows

---

## What Constitutes an Incident

An incident exists when **at least one** of the following conditions is true:

| Trigger | Severity floor | Creating actor |
|---------|---------------|----------------|
| Venue player machine state enters INCIDENT | S3 minimum | System (implicit declaration) |
| OPERATOR+ declares a constitutional state degradation below HEALTHY with severity S3 or higher | As declared | Operator |
| Circuit breaker triggers EMERGENCY_FREEZE | S1 (automatic) | System (implicit S1 incident) |

**What does not constitute an incident:**

| Condition | Correct entity | Why |
|-----------|---------------|-----|
| Venue goes OFFLINE without operator declaration | VENUE_STATUS change | Offline without declaration is a connectivity event, not an operational anomaly requiring coordination |
| Alert generated without operator acknowledgement and declaration | ALERT | Alert existence does not equal incident existence |
| Level 3–6 override placed | OVERRIDE | Override placement is a content governance action, not an anomaly declaration |
| PRE resolution divergence detected | OPERATIONAL_WARNING (PRE_DIVERGENCE) | Divergence is a warning that may escalate; it is not itself an incident |

The distinction is operationally meaningful: incidents require coordinated response and a commander. Alerts, warnings, and status changes do not.

---

## Incident Object Schema

### Required Fields

All fields required at declaration time. API must reject declaration without any required field.

| Field | Type | Mutability | Constraints |
|-------|------|-----------|-------------|
| `incident_id` | string | IMMUTABLE | Format: `inc-{venue_id}-{governed_timestamp_hash}`. Globally unique. Deterministic. Collision-resistant. |
| `declared_at` | governed_timestamp | IMMUTABLE | Set at declaration. Cannot be retroactively adjusted. The governed clock, not wall clock, is authoritative. |
| `declared_by` | operator_id | IMMUTABLE | The operator who made the declaration. Cannot be reassigned. |
| `severity` | enum S1–S5 | MUTABLE (with authority) | S1 = highest operational severity. S5 = lowest. See severity authority rules. |
| `scope_id` | venue_id or fleet_id | IMMUTABLE | Scope cannot change after declaration. Scope expansion requires a new incident or correlation link. |
| `current_state` | enum | MUTABLE (state machine only) | One of: WATCHING, DECLARED, CONTAINED, RESOLVED, COMMANDER_LAPSED. Not a directly writable field — transitions only via state machine endpoints. |

### Derived Fields

Computed at read time. Never stored. Any implementation storing these fields is incorrect.

| Field | Derivation rule |
|-------|----------------|
| `duration` | `now() - declared_at` |
| `commander_active_since` | Timestamp of the most recent COMMAND_TRANSFERRED event, or `declared_at` if no transfer has occurred |
| `annotation_count` | Count of OPERATOR_NOTE audit events bearing this `incident_id` |
| `linked_replay_count` | Count of INVESTIGATION records with `incident_id` matching this record |
| `severity_high_water` | Maximum `severity` value ever recorded — derived from SEVERITY_CHANGED audit events, never stored as a field |
| `commander_id` | Derived from the most recent COMMAND_TRANSFERRED event's `to_commander` field, or `declared_by` if no transfer has occurred |

### Optional Fields

| Field | Type | Notes |
|-------|------|-------|
| `parent_incident_id` | incident_id | Links this incident to a parent. Established at creation or by ADMIN only. Immutable once set. |
| `correlation_id` | string | Groups incidents sharing a root cause. ADMIN-set only. Not operator-settable. |
| `resolution_annotation` | string | Required at RESOLVED transition. Minimum 50 characters. Authored by the closing operator. |
| `resolution_reason` | enum | Required at RESOLVED transition. |
| `pre_verification_at_closure` | object | PRE resolution output recorded at time of RESOLVED transition. Set by system. |

### Immutable Fields Summary

The following fields cannot change under any circumstance after the incident record is created:

- `incident_id`
- `declared_at`
| `declared_by`
- `scope_id`
- `parent_incident_id` (once set — may be set after creation by ADMIN, but becomes immutable on set)

---

## Mutable Fields: Authority and Audit Requirements

### Severity

| Operation | Authority | Audit event |
|-----------|-----------|-------------|
| Initial set at declaration | OPERATOR+ | INCIDENT_DECLARED |
| Escalation (S3 → S2, etc.) | OPERATOR+ | SEVERITY_CHANGED |
| De-escalation | OPERATOR+ (S3–S5); ADMIN required for S1–S2 | SEVERITY_CHANGED |

**Severity immutability rule:** The `severity_high_water` is immutable. `severity` itself may be de-escalated (representing current operational assessment), but the audit trail preserves every value the severity has held. A de-escalated severity cannot erase the historical record of the higher severity. The API must expose `severity_high_water` as a derived field.

**Severity de-escalation does not change `current_state`.** State and severity are independent fields. De-escalating from S2 to S3 does not move the incident to CONTAINED. Containment is a separate state machine transition.

### current_state

Not writable via field update. Writable only through defined state machine transition endpoints. Direct `PATCH /incidents/{id}` with a `current_state` field is rejected.

### commander_id

Not a stored field. Derived from the audit trail. The command transfer workflow writes a COMMAND_TRANSFERRED event, from which `commander_id` is derived at read time.

---

## Incident State Machine

### States

| State | Operational meaning | Commander required |
|-------|--------------------|--------------------|
| WATCHING | Anomaly observed, monitoring. No commander assigned. Any OPERATOR+ may declare. | No |
| DECLARED | Active incident. Response in progress. Commander assigned and responsible. | Yes |
| COMMANDER_LAPSED | Sub-state of DECLARED or CONTAINED. Commander session expired. Incident continues. 15-minute claim window before Level 1 alert fires. | No (lapsed) |
| CONTAINED | Immediate risk neutralized. Root cause may not be resolved. Requires ADMIN approval at S1–S2. | Optional |
| RESOLVED | Incident closed. Root cause documented. Terminal state. | No |

### Valid Transitions

```
WATCHING ──────────────────────────────────────────► DECLARED
                                                          │
                                            (session      │  (OPERATOR+ claim
                                             expires)     ▼   after lapse)
                                        COMMANDER_LAPSED ◄────────────────────┐
                                                          │                    │
                                                          └──────────────────► DECLARED
                                                                                │
                                           (ADMIN req. for S1-S2)              │
                                        CONTAINED ◄─────────────────────────────┤
                                             │                                  │
                                      (re-escalation)                           │
                                             └─────────────────────────────────►┘
                                             │
                                        RESOLVED (terminal)
```

| From | To | Authority | Conditions |
|------|----|-----------|------------|
| WATCHING | DECLARED | OPERATOR+ | None beyond role |
| DECLARED | CONTAINED | OPERATOR+ (S3–S5); ADMIN (S1–S2) | No additional conditions |
| DECLARED | COMMANDER_LAPSED | SYSTEM only | Commander session expiry |
| COMMANDER_LAPSED | DECLARED | Any OPERATOR+ | Claiming command via [Claim Command] action |
| CONTAINED | RESOLVED | OPERATOR+ | resolution_annotation present; resolution_reason set; PRE verified |
| CONTAINED | DECLARED | OPERATOR+ | Re-escalation — any OPERATOR+ may re-escalate |

### Forbidden Transitions

| From | To | Reason |
|------|----|--------|
| WATCHING | RESOLVED | Must pass through DECLARED. WATCHING-to-RESOLVED bypasses the incident declaration record. |
| RESOLVED | Any state | RESOLVED is terminal. Re-emergent issues require a new incident with optional parent_incident_id reference. |
| DECLARED | RESOLVED | Must pass through CONTAINED. Skipping containment removes the required administrative checkpoint. |
| Any state | WATCHING | WATCHING is only an entry state. No backward transitions to WATCHING. |

---

## Commander Ownership Model

The incident commander is the current operational owner of the incident. There is always exactly one commander in DECLARED and CONTAINED states, or zero in WATCHING and COMMANDER_LAPSED states.

### Commander Identification

`commander_id` is not stored. It is derived at read time from the audit trail:
1. If no COMMAND_TRANSFERRED events exist: commander is `declared_by`
2. If COMMAND_TRANSFERRED events exist: commander is the `to_commander` field of the most recent COMMAND_TRANSFERRED event

### Commander Changes

| Mechanism | Initiator | Process | Audit event |
|-----------|-----------|---------|-------------|
| Initiated transfer | Outgoing commander | Selects recipient; recipient has 30-second review period; recipient acknowledges | COMMAND_TRANSFERRED |
| Lapse + claim | Any OPERATOR+ | Commander session expires → COMMANDER_LAPSED; any OPERATOR+ uses [Claim Command] | COMMAND_TRANSFERRED |
| ADMIN override | ADMIN | Direct assignment without recipient acknowledgement | COMMAND_TRANSFERRED with `transfer_type: ADMIN_OVERRIDE` |

**Previous commanders become observers.** They retain full visibility but lose write authority for commander-only actions. The COMMAND_TRANSFERRED audit event permanently records who held command, when, and how the transfer occurred.

### COMMANDER_LAPSED Behavior

When COMMANDER_LAPSED is entered:
- Incident remains active. No operations cease.
- Any OPERATOR+ may claim command. No ADMIN approval required.
- A 15-minute clock begins. After 15 minutes without a claim: Level 1 (Constitutional) alert fires for all operators with venue access.
- The lapse event is recorded with the timestamp and the identity of the commander whose session expired.

---

## Escalation and Lineage

### Severity Escalation

Severity escalation is permitted at any time by OPERATOR+. De-escalation of S1–S2 requires ADMIN.

Severity escalation does not automatically change `current_state`. A WATCHING incident at S5 that is escalated to S1 remains in WATCHING until an OPERATOR+ declaration transitions it to DECLARED. The severity and the state are independent dimensions.

### Parent-Child Relationship

`parent_incident_id` creates a lineage tree:

| Rule | Enforcement |
|------|-------------|
| Lineage established at incident creation, OR by ADMIN after creation | API rejects non-ADMIN post-creation lineage writes |
| Lineage is immutable once set | API rejects changes to `parent_incident_id` after it is set |
| Circular lineage (A → B → A) is forbidden | API validates full lineage chain on write; rejects if cycle detected |
| Maximum lineage depth: 5 levels | API rejects placement that would create depth >5 |

`child_incident_ids[]` is derived — computed by querying all incidents that reference this `incident_id` as `parent_incident_id`. It is never stored on the parent incident record.

### Correlation

`correlation_id` groups incidents believed to share a root cause. It is not a lineage relationship — it is a tagging mechanism.

| Rule | Detail |
|------|--------|
| Only ADMIN may set `correlation_id` | Non-ADMIN writes to this field are rejected |
| Multiple incidents may share a `correlation_id` | No uniqueness constraint on the value across incidents |
| Setting `correlation_id` does not merge incidents | Incidents remain independent records |
| `correlation_id` is not immutable | ADMIN may update or remove it |

---

## Incident Closure Requirements

RESOLVED transition is rejected unless all of the following conditions are met at transition time:

| Condition | Enforcement |
|-----------|-------------|
| `resolution_annotation` present with minimum 50 characters | API hard-block |
| `resolution_reason` set to a valid enum value | API hard-block |
| PRE resolution verified as expected — system records `pre_verification_at_closure` | System performs verification; transition blocked if PRE is currently in error state |
| For S1–S2: `current_state` is CONTAINED (not DECLARED) at time of RESOLVED transition request | API hard-block |
| For S1–S2: ADMIN has acknowledged the CONTAINED state | ADMIN_CONTAINED_ACKNOWLEDGED event required in audit trail |

### Resolution Reason Enum

| Value | Meaning |
|-------|---------|
| CAUSE_IDENTIFIED_AND_FIXED | Root cause known and remediated |
| CAUSE_IDENTIFIED_MONITORING | Root cause known; remediation ongoing; monitoring for recurrence |
| CAUSE_UNKNOWN_MONITORING | Incident resolved but root cause not identified; monitoring for recurrence |
| EXTERNAL_RESOLUTION | Resolved by external action (supplier, infrastructure, etc.) |
| FALSE_POSITIVE | Declared in error; underlying condition did not exist |

`FALSE_POSITIVE` does not remove the incident from the record. The incident exists as evidence that the declaration occurred. The resolution_reason provides context.

---

## Forbidden Field Patterns

These are enforced at the API layer. Violations must be rejected with an explicit error, not silently ignored.

| Forbidden pattern | Rejection reason |
|-------------------|-----------------|
| Setting `severity` to a value lower than the highest severity ever reached during this incident (without going through state transitions) | `severity` field may be de-escalated as an operational assessment, but the audit trail's `severity_high_water` is the authoritative history. Attempting to write a `severity` lower than the current value without going through CONTAINED is permitted for S3–S5 but the audit trail captures every value. |
| Writing `declared_at` as anything other than the governed_timestamp at declaration | Retroactive adjustment is forbidden. The governed_timestamp at declaration is the authoritative record, even if it differs from wall clock. |
| Writing `scope_id` after creation | Immutable after write. Returns 422. |
| Transitioning to RESOLVED with `resolution_annotation` under 50 characters | Returns 422 with field-level error. |
| Creating `parent_incident_id` that would form a cycle | Returns 409 with cycle path in error body. |
| Creating `parent_incident_id` that would exceed depth 5 | Returns 422 with current depth in error body. |
| Setting `correlation_id` without ADMIN role | Returns 403. |

---

## Forbidden Incident Mutations

These operations are not implemented. The API must not expose endpoints or parameters that would enable them.

| Forbidden operation | What to do instead |
|--------------------|--------------------|
| Delete an incident | Incidents are never deleted. Resolved incidents are archived. Archive is a read-state change, not deletion. |
| Redact the audit trail | No redaction endpoint exists for incident audit events. |
| Merge two incidents | Use `correlation_id` to link incidents. Merger is not permitted. |
| Edit `resolution_annotation` after RESOLVED | RESOLVED is terminal. The annotation is part of the closure record. |
| Transition from RESOLVED to any state | A new incident must be declared with `parent_incident_id` referencing the resolved incident. |

---

## Replay Reconstruction Requirements

The following must be reconstructible from the audit trail alone, without any external input, verbal record, or human memory:

| Reconstruction target | Required audit events |
|----------------------|----------------------|
| Full incident lifecycle | INCIDENT_DECLARED, INCIDENT_STATE_CHANGED (all), INCIDENT_RESOLVED |
| Full command chain | COMMAND_TRANSFERRED (all), including transfer_type and timestamps |
| Full annotation history | OPERATOR_NOTE (all), with authored_by and governed_timestamp |
| PRE resolution state at every point | PRE resolution log cross-referenced by governed_timestamp |
| Constitutional state at every point | Constitutional state change events cross-referenced by governed_timestamp |
| Severity history | SEVERITY_CHANGED (all) plus INCIDENT_DECLARED initial value |
| Commander identity at any point in time | COMMAND_TRANSFERRED chain from INCIDENT_DECLARED |

If any of the above cannot be reconstructed from the audit trail, the audit trail is incomplete. Incomplete audit trails are a data integrity violation.

---

## Audit Event Reference

Every audit event must include: `event_id`, `incident_id`, `event_type`, `governed_timestamp`, `authored_by` (operator_id or `system`).

| Event type | Trigger | Required additional fields |
|------------|---------|---------------------------|
| INCIDENT_DECLARED | Initial declaration | severity, scope_id, declared_by |
| INCIDENT_STATE_CHANGED | Any state transition | from_state, to_state, changed_by (or `system` for COMMANDER_LAPSED) |
| COMMAND_TRANSFERRED | Commander change | from_commander (or null), to_commander, transfer_type |
| SEVERITY_CHANGED | Severity change | from_severity, to_severity, changed_by |
| OPERATOR_NOTE | Annotation | note_text, authored_by |
| ADMIN_CONTAINED_ACKNOWLEDGED | ADMIN acknowledges CONTAINED for S1–S2 | acknowledged_by |
| INCIDENT_RESOLVED | RESOLVED transition | resolved_by, resolution_reason, pre_verification_hash |
| INCIDENT_LINKED | Lineage or correlation set | link_type (PARENT or CORRELATION), target_id, linked_by |
| COMMANDER_LAPSED_ALERT_FIRED | 15-minute lapse threshold exceeded | — |

---

## API Contract Summary

| Endpoint | Method | Authority | Notes |
|----------|--------|-----------|-------|
| `/incidents` | POST | OPERATOR+ | Declaration. All required fields in body. |
| `/incidents/{id}` | GET | OPERATOR+ (scoped) | Returns full record with all derived fields. |
| `/incidents/{id}/transition` | POST | Role-dependent (see state machine) | Body: `{to_state, ...required_fields_for_transition}` |
| `/incidents/{id}/command/transfer` | POST | Commander or ADMIN | Body: `{to_operator_id}` |
| `/incidents/{id}/command/claim` | POST | Any OPERATOR+ | Valid only in COMMANDER_LAPSED state |
| `/incidents/{id}/severity` | PUT | OPERATOR+ / ADMIN | Body: `{severity, reason}` |
| `/incidents/{id}/correlation` | PUT | ADMIN only | Body: `{correlation_id}` |
| `/incidents/{id}/lineage` | PUT | ADMIN only | Body: `{parent_incident_id}` — immutable after set |
| `/incidents/{id}/audit` | GET | OPERATOR+ | Full audit trail for this incident |

Field-level PATCH on `current_state`, `commander_id`, `declared_at`, `declared_by`, `scope_id`, or `incident_id` must be rejected with 405 Method Not Allowed.
