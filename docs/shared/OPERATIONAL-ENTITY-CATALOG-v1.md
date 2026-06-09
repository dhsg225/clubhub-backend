# OPERATIONAL-ENTITY-CATALOG-v1

**Document class:** Implementation-grade operational information model
**Authority:** Constitutional — entities defined here cannot be removed without platform succession protocol
**Audience:** Backend API teams, frontend display teams, audit system implementers

---

## Catalog Conventions

Every entity entry defines:
- **Purpose** — one sentence, no ambiguity
- **Owner** — who creates and controls the entity
- **Authority source** — what grants authority over the entity
- **Required attributes** — fields that must always be present; API must reject creation without them
- **Optional attributes** — fields that may be present; API must not require them
- **Lifecycle** — ordered states with valid transitions
- **Visibility rules** — who can see what
- **Replay obligations** — what must be reconstructible from corpus alone
- **Audit obligations** — what events must be written to the immutable audit trail

**Notation conventions:**

| Symbol | Meaning |
|--------|---------|
| `[IMMUTABLE]` | Field cannot change after write |
| `[DERIVED]` | Computed at read time; never stored directly |
| `[SYSTEM]` | Written by system only; operator write rejected |
| `[ADMIN]` | Write requires ADMIN role |

---

## Constitutional Entity Declaration

The following entities are **constitutional**. They cannot be deleted, only archived. Their audit trail events cannot be redacted under any operational circumstance. Archival is not the same as deletion — archived entities remain queryable and reconstructible.

| Entity | Constitutional Basis |
|--------|---------------------|
| INCIDENT | Operational record; regulatory audit surface |
| OVERRIDE | PRE authority record; determinism requires full history |
| INVESTIGATION | Replay artifact; evidence chain |
| REPLAY_ANNOTATION | Corpus artifact; immutable once written |
| CERTIFICATION_RECORD | Operator authority history |
| HANDOFF_PACKAGE | Command authority transfer record |
| OPERATIONAL_FINDING | Evidence conclusion; linked to corpus events |

Non-constitutional entities may be purged per retention policy. Constitutional entities may not be purged. Retirement of a constitutional entity requires a platform succession event, not a routine API call.

---

## Entity Catalog

---

### INCIDENT

**Purpose:** Records a declared operational anomaly requiring coordinated response.

**Owner:** Incident Commander — the operator who currently holds command authority over the incident.

**Authority source:** OPERATOR+ session required to declare. Command transfer requires recipient acknowledgement. ADMIN may override commander assignment.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `incident_id` [IMMUTABLE] | string | Format: `inc-{venue_id}-{governed_timestamp_hash}`. Globally unique. Deterministic. |
| `declared_at` [IMMUTABLE] | governed_timestamp | Set at declaration. Cannot be retroactively adjusted. |
| `declared_by` [IMMUTABLE] | operator_id | The operator who declared the incident. |
| `severity` | enum S1–S5 | S1 = highest. Mutable with authority rules. Historical high-water mark immutable. |
| `scope_id` [IMMUTABLE] | venue_id or fleet_id | Cannot change after write. Scope expansion requires new incident or correlation link. |
| `current_state` | enum | One of: WATCHING, DECLARED, CONTAINED, RESOLVED, COMMANDER_LAPSED |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `commander_id` | operator_id | Null in WATCHING state. Set on DECLARED. Changes via transfer workflow only. |
| `parent_incident_id` | incident_id | Links this incident to a parent. Lineage established at creation or by ADMIN only. |
| `correlation_id` | string | Groups incidents sharing root cause. ADMIN-set only. |
| `linked_replay_sessions[]` | investigation_id[] | Derived from investigations that reference this incident_id. |
| `linked_findings[]` | finding_id[] | Derived from findings that reference this incident_id. |

#### Derived Fields (never stored)

| Field | Derivation |
|-------|------------|
| `duration` | `now() - declared_at` |
| `commander_active_since` | Timestamp of last COMMAND_TRANSFERRED event, or `declared_at` if no transfer |
| `annotation_count` | Count of OPERATOR_NOTE audit events for this `incident_id` |
| `linked_replay_count` | Count of INVESTIGATION records referencing this `incident_id` |
| `severity_high_water` | Maximum severity ever recorded — derived from audit trail, never stored |

#### Lifecycle

```
WATCHING → DECLARED → CONTAINED → RESOLVED
                ↓              ↑
         COMMANDER_LAPSED ─────┘ (claim restores DECLARED)
```

| State | Entry condition | Exit conditions |
|-------|----------------|-----------------|
| WATCHING | System detects anomaly OR OPERATOR+ initiates without full declaration | OPERATOR+ declares |
| DECLARED | OPERATOR+ declaration, commander assigned | Contained, or commander session expires |
| COMMANDER_LAPSED | Commander session expires while in DECLARED or CONTAINED | Any OPERATOR+ claims command |
| CONTAINED | Immediate risk neutralized; ADMIN approval required at S1–S2 | Re-escalated to DECLARED, or RESOLVED |
| RESOLVED | Resolution annotation present; resolution_reason set; PRE verified | Terminal — no exit |

**Forbidden transitions:**
- WATCHING → RESOLVED (must pass through DECLARED)
- RESOLVED → any state (RESOLVED is terminal)
- DECLARED → RESOLVED (must pass through CONTAINED)

#### Visibility Rules

| Role | Visibility |
|------|-----------|
| VIEWER | Incidents on venues they have access to; severity and state only |
| OPERATOR | Full incident record for venues they are assigned to |
| ADMIN | All incidents, all venues, all fields |

#### Replay Obligations

From the audit trail alone, without external input, must be reconstructible:
1. Full incident lifecycle — every state, every transition, when, by whom
2. Full command chain — every commander, when held, transfer circumstances
3. Full annotation history — every note, when written, by whom
4. PRE resolution state at every point during the incident
5. Constitutional state at every point during the incident

#### Audit Obligations

| Event | Trigger | Required fields |
|-------|---------|-----------------|
| INCIDENT_DECLARED | Declaration | incident_id, declared_by, severity, scope_id, governed_timestamp |
| INCIDENT_STATE_CHANGED | Any state transition | incident_id, from_state, to_state, changed_by, governed_timestamp |
| COMMAND_TRANSFERRED | Commander change | incident_id, from_commander, to_commander, transfer_type, governed_timestamp |
| SEVERITY_CHANGED | Severity escalation or de-escalation | incident_id, from_severity, to_severity, changed_by, governed_timestamp |
| OPERATOR_NOTE | Annotation added | incident_id, authored_by, governed_timestamp |
| INCIDENT_RESOLVED | RESOLVED transition | incident_id, resolved_by, resolution_reason, pre_verification_hash, governed_timestamp |
| INCIDENT_LINKED | Lineage or correlation established | incident_id, link_type, target_id, linked_by, governed_timestamp |

---

### ALERT

**Purpose:** A system-generated signal that a condition requires operator attention.

**Owner:** System. Alerts are never operator-created.

**Authority source:** Backend constitutional state machine. No operator action creates an alert directly — alerts are generated by system events.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `alert_id` [IMMUTABLE] | string | Globally unique. |
| `generated_at` [IMMUTABLE] [SYSTEM] | governed_timestamp | Set at generation. |
| `level` [IMMUTABLE] | integer 1–5 | 1 = Constitutional, 5 = Informational. See classification hierarchy. |
| `source_event_id` [IMMUTABLE] | event_id | The specific system event that triggered generation. Required. Non-null. |
| `scope_id` [IMMUTABLE] | venue_id or fleet_id | The scope to which this alert applies. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `incident_id` | incident_id | Set when alert is generated in context of an active incident. |
| `venue_id` | venue_id | When scope is fleet-level but alert applies to a specific venue. |
| `auto_expiry_at` | governed_timestamp | Level 3 alerts only. Null for Level 1–2. |

#### Per-Operator State (stored separately from alert record)

Each operator has independent acknowledgement state for each alert. The alert record itself does not change on acknowledgement — a separate `alert_delivery` record tracks per-operator state.

| Field | Type | States |
|-------|------|--------|
| `delivery_state` | enum | DELIVERED, ACKNOWLEDGED, DISMISSED, EXPIRED |
| `acknowledged_at` | governed_timestamp | Null until acknowledged |
| `dismissed_at` | governed_timestamp | Null unless dismissed (Level 3–4 only; Level 1–2 cannot be dismissed) |

#### Lifecycle

```
ACTIVE → ACKNOWLEDGED (per operator)
ACTIVE → SUPERSEDED (when a newer alert on same scope+type supersedes)
ACTIVE → EXPIRED (Level 3 only, after 60 seconds without interaction)
```

Level 1 and Level 2 alerts do not expire. They resolve only when the underlying condition resolves.

#### Visibility Rules

| Role | Visibility |
|------|-----------|
| VIEWER | Alerts on assigned venues; no dismiss capability |
| OPERATOR | Alerts on assigned venues; may acknowledge and dismiss Level 3–4 |
| ADMIN | All alerts; all venues |

#### Replay Obligations

An alert must be reconstructible from its `source_event_id` alone. Given the source event, the system must be able to recompute whether an alert should have been generated and what its content should have been.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| ALERT_GENERATED | Alert creation |
| ALERT_DELIVERED | Delivery to operator session |
| ALERT_ACKNOWLEDGED | Operator acknowledgement (per operator) |
| ALERT_DISMISSED | Operator dismissal (per operator; Level 3–4 only) |
| ALERT_EXPIRED | Auto-expiry of Level 3 alert |
| ALERT_SUPERSEDED | Supersession event |

---

### OVERRIDE

**Purpose:** An operator-placed instruction that modifies PRE resolution output for a defined scope.

**Owner:** The operator who placed it (L1–L4); ADMIN (L5–L6 placement authority).

**Authority source:** Operator role plus session elevation requirements per level. See authority table.

#### Authority by Level

| Level | Minimum role | Session elevation | Approval required | Confirmation required |
|-------|-------------|-------------------|-------------------|-----------------------|
| L1 | OPERATOR | No | No | No |
| L2 | OPERATOR | No | No | No |
| L3 | OPERATOR | No | Yes (non-ADMIN) | No |
| L4 | OPERATOR | Yes | Yes | No |
| L5 | ADMIN | No | Yes | No |
| L6 | OPERATOR (elevated) or ADMIN | Yes (for OPERATOR) | No | String: "EMERGENCY" |

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `override_id` [IMMUTABLE] | string | Globally unique. |
| `placed_at` [IMMUTABLE] | governed_timestamp | |
| `placed_by` [IMMUTABLE] | operator_id | |
| `level` [IMMUTABLE] | integer 1–6 | PRE hierarchy level. |
| `scope_id` [IMMUTABLE] | venue_id or fleet_id | |
| `content_ref` | content_id or playlist_id | The content instruction. |
| `governed_timestamp` [IMMUTABLE] | governed_timestamp | Clock-governed placement time used in PRE resolution. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `expires_at` | governed_timestamp | Required for L5. Advisory for L6. Optional for L1–L4 (generates warning if absent). |
| `expiry_warning_at` | governed_timestamp | When to generate approaching-expiry advisory. |
| `reason` | string | Operator-provided context. |
| `approval_id` | approval_id | Reference to the approval record for L3–L5. |
| `parent_override_id` | override_id | When this override is placed in direct response to another. |
| `incident_id` | incident_id | When placed during an active incident. Set automatically if incident is active on scope. |

#### Lifecycle

```
[L3-L4 non-ADMIN]: PENDING_APPROVAL → ACTIVE → EXPIRED | REMOVED | SUPERSEDED
[L1-L2, L5-L6]:   ACTIVE → EXPIRED | REMOVED | SUPERSEDED
```

| State | Meaning |
|-------|---------|
| PENDING_APPROVAL | Placed, awaiting approval. PRE effect: none. |
| ACTIVE | PRE-effective. Modifies resolution output. |
| EXPIRED | Auto-expired at `expires_at` (written as SYSTEM event). PRE effect: none. |
| REMOVED | Explicitly removed by authorized operator. PRE effect: none. |
| SUPERSEDED | A higher-level override on the same scope is active. This override's PRE contribution is zero. PRE effect resumes if the higher-level override is removed and this override has not expired. |

#### Removal Authority

| Level | Who may remove |
|-------|----------------|
| L1–L4 | Placed-by operator OR ADMIN |
| L5 | ADMIN only |
| L6 | OPERATOR+ with active elevated session, OR ADMIN. Requires confirmation string: "CONFIRM REMOVAL" |

#### Visibility Rules

All operators with access to the scope may view the override stack. PRE queries the override stack directly. Override stack is queryable without authentication for internal PRE resolution, but the API surface exposing override details requires OPERATOR+ authentication.

#### Replay Obligations

An override must reproduce identical PRE resolution output when replayed. The combination of `override_id`, `placed_at`, `level`, `scope_id`, and `content_ref` must be sufficient to reconstruct the PRE override contribution at any point in time.

#### Audit Obligations

| Event | Trigger | Authority written |
|-------|---------|------------------|
| OVERRIDE_PLACED | Placement | placed_by, level, scope_id |
| OVERRIDE_APPROVAL_REQUESTED | L3–L5 placement | |
| OVERRIDE_APPROVED | Approval granted | approved_by |
| OVERRIDE_ACTIVATED | Transition to ACTIVE | |
| OVERRIDE_EXPIRED | Auto-expiry | SYSTEM |
| OVERRIDE_REMOVED | Explicit removal | removed_by, removal_confirmation if L6 |
| OVERRIDE_SUPERSEDED | Supersession by higher level | superseded_by_override_id |

---

### VENUE_STATUS

**Purpose:** The current operational state of a physical venue installation.

**Owner:** System. Derived, not operator-set. Operators may not directly write venue status.

**Authority source:** Derived from player heartbeat, corpus state, PRE resolution output, circuit breaker state, and clock sync data. No single source is authoritative alone — all inputs are required.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `venue_id` [IMMUTABLE] | string | |
| `computed_at` [SYSTEM] | governed_timestamp | Time of computation. Always current. |
| `machine_state` [SYSTEM] | enum | INITIALIZING, SYNCING, LIVE, INCIDENT, OFFLINE, DEGRADED |
| `constitutional_state` [SYSTEM] | enum | HEALTHY, DEGRADED, CONSTITUTIONAL_RISK, SHADOW_ONLY, PRE_DISABLED, READ_ONLY, EMERGENCY_FREEZE |
| `last_heartbeat_at` [SYSTEM] | governed_timestamp | Most recent player heartbeat timestamp. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `autonomy_remaining_hours` | float | Hours of content playback capacity remaining without CMS sync. Max 72. |
| `corpus_hash` | string | Hash of the current corpus on the player device. Used for integrity verification. |
| `last_resolution_level` | integer 0–6 | The PRE level that resolved the most recent content decision. |
| `connectivity_state` | enum | CONNECTED, DEGRADED_CONNECTIVITY, OFFLINE |

#### Lifecycle

VENUE_STATUS is not a lifecycle entity. It is always the most recently computed state. Historical states are reconstructible from the audit trail — operators do not manage lifecycle states directly.

**Machine state definitions:**

| State | Meaning |
|-------|---------|
| INITIALIZING | Player booting or performing initial corpus load |
| SYNCING | Player syncing corpus with CMS; content delivery paused or running from cache |
| LIVE | Player delivering content from active PRE resolution |
| INCIDENT | Player has entered incident state; constitutional response active |
| OFFLINE | Player not reachable; autonomy clock running |
| DEGRADED | Player reachable but operating below full capacity (e.g., partial corpus, fallback-only PRE) |

#### Visibility Rules

| Role | Visibility |
|------|-----------|
| VIEWER | Machine state and constitutional state for assigned venues |
| OPERATOR | Full VENUE_STATUS record for assigned venues |
| ADMIN | Full record, all venues |

#### Replay Obligations

The VENUE_STATUS at any governed_timestamp must be reconstructible from the corpus. Required inputs: player heartbeat log, PRE resolution log, circuit breaker event log, corpus sync log.

#### Audit Obligations

Audit events written on state change only — not on every heartbeat. Heartbeat receipt is logged at the telemetry layer, not the audit trail layer.

| Event | Trigger |
|-------|---------|
| VENUE_STATE_CHANGED | machine_state or constitutional_state changes |
| VENUE_HEARTBEAT_MISSED | Heartbeat overdue by configured threshold |
| VENUE_AUTONOMY_THRESHOLD | autonomy_remaining_hours crosses threshold (24h, 8h, 2h) |
| VENUE_CORPUS_MISMATCH | corpus_hash does not match expected hash |

---

### RECOVERY_ACTION

**Purpose:** A structured operator-attested step within a venue recovery workflow.

**Owner:** The operator who claims and completes the step. Ownership transfers on claim.

**Authority source:** OPERATOR+ for most steps. ADMIN required for the corpus verification step within a recovery workflow.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `action_id` [IMMUTABLE] | string | |
| `workflow_id` [IMMUTABLE] | string | The recovery workflow this action belongs to. |
| `step_number` [IMMUTABLE] | integer | Ordered within the workflow. |
| `claimed_by` | operator_id | Set on claim. Null until claimed. |
| `claimed_at` | governed_timestamp | Null until claimed. |
| `completed_by` | operator_id | May differ from `claimed_by` if workflow permits handoff. |
| `completed_at` | governed_timestamp | Null until completed. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `verification_data` | object | Corpus hash comparison result, PRE preview data, or other structured verification output. |
| `notes` | string | Operator-authored notes at completion time. |

#### Lifecycle

```
PENDING → CLAIMED → COMPLETED
                  → LAPSED (claim timeout exceeded without completion)
LAPSED → CLAIMED (re-claim by any eligible operator)
```

**LAPSED** does not terminate the workflow. The step returns to PENDING-equivalent for re-claim. Lapse timeout is defined per workflow type.

#### Visibility Rules

All operators with venue access may view recovery workflow status. Any OPERATOR+ may claim an unclaimed or lapsed step.

#### Replay Obligations

The step completion sequence must be reconstructible. Verification data is preserved as part of the audit record and must be queryable without external lookup.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| RECOVERY_STEP_CLAIMED | Operator claims the step |
| RECOVERY_STEP_COMPLETED | Operator attests completion |
| RECOVERY_STEP_LAPSED | Timeout exceeded |
| RECOVERY_STEP_RECLAIMED | Re-claim after lapse |

---

### INVESTIGATION

**Purpose:** A structured inquiry into a historical operational event, grounded in replay.

**Owner:** The operator who opened the replay session.

**Authority source:** OPERATOR+ for standard investigation. ADMIN required for counterfactual analysis tab.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `investigation_id` [IMMUTABLE] | string | |
| `opened_at` [IMMUTABLE] | governed_timestamp | |
| `opened_by` [IMMUTABLE] | operator_id | |
| `venue_id` [IMMUTABLE] | venue_id | |
| `time_range_start` [IMMUTABLE] | governed_timestamp | Replay window start. Immutable after open. |
| `time_range_end` [IMMUTABLE] | governed_timestamp | Replay window end. Immutable after open. |
| `session_type` [IMMUTABLE] | enum | STANDARD, COUNTERFACTUAL. COUNTERFACTUAL requires ADMIN. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `incident_id` | incident_id | Links investigation to an active or resolved incident. |
| `divergence_class` | enum | Classification of any detected PRE divergence. |
| `findings[]` | finding_id[] | Findings authored during or after this investigation. |
| `annotations[]` | annotation_id[] | Annotations written during this investigation. |
| `conclusion_text` | string | Operator-authored summary at CONCLUDED state. |

#### Lifecycle

```
OPEN → ANNOTATED (first annotation written)
ANNOTATED → CONCLUDED
OPEN | ANNOTATED → ABANDONED
```

CONCLUDED investigations are immutable. No new annotations or findings may be added after conclusion. ABANDONED investigations preserve all annotations and findings written before abandonment.

#### Visibility Rules

All operators with venue access may view all investigations for that venue. Findings and annotations are platform-visible records.

#### Replay Obligations

The investigation itself is a replay artifact. After conclusion, it is immutable and must be reconstructible from the corpus. The corpus includes: the investigation record, all annotations, all findings, the replay window events, and the PRE resolution log for the time range.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| INVESTIGATION_OPENED | Session opened |
| INVESTIGATION_ANNOTATED | Annotation added |
| INVESTIGATION_FINDING_SUBMITTED | Finding submitted |
| INVESTIGATION_CONCLUDED | Conclusion written |
| INVESTIGATION_ABANDONED | Abandoned |
| INVESTIGATION_LINKED | Linked to incident |

---

### REPLAY_ANNOTATION

**Purpose:** An operator-authored note attached to a specific point in a replay session.

**Owner:** The operator who authored it. Immutable after write.

**Authority source:** Any authenticated operator with investigation access.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `annotation_id` [IMMUTABLE] | string | |
| `authored_by` [IMMUTABLE] | operator_id | |
| `authored_at` [IMMUTABLE] | governed_timestamp | |
| `investigation_id` [IMMUTABLE] | investigation_id | |
| `anchored_to` [IMMUTABLE] | event_id or governed_timestamp | The specific corpus point this annotation references. Required. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `text` | string | Operator-authored observation. No minimum length requirement. |
| `finding_id` | finding_id | Links this annotation as evidence for a finding. |
| `divergence_class` | enum | Classification of divergence observed at this point. |

#### Lifecycle

```
DRAFT (local only, < 30 seconds) → WRITTEN (immutable, persisted)
```

DRAFT state is client-side only. The system does not persist drafts. Once written (submitted to the API), the annotation is immutable. No edit events exist. No delete events exist.

**Forbidden operations:** Edit, delete, redact. Annotations are constitutional entities.

#### Visibility Rules

All operators may view all written annotations for any investigation they have access to. Annotations survive the investigation session and are accessible after the investigation is concluded.

#### Replay Obligations

Annotations are part of the corpus. They travel with the replay record. Given the corpus, every annotation must be reconstructible, anchored to its original point.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| ANNOTATION_WRITTEN | Annotation persisted to the corpus |

No further audit events. The annotation itself is the audit record.

---

### HANDOFF_PACKAGE

**Purpose:** A system-generated transfer record capturing operational state at the moment of shift change.

**Owner:** Outgoing operator generates it; incoming operator accepts it.

**Authority source:** OPERATOR+ to generate; OPERATOR+ to accept.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `handoff_id` [IMMUTABLE] | string | |
| `from_operator_id` [IMMUTABLE] | operator_id | |
| `generated_at` [IMMUTABLE] [SYSTEM] | governed_timestamp | |
| `venues[]` [IMMUTABLE] | venue_id[] | Venues in scope at generation time. |
| `package_contents_hash` [IMMUTABLE] | string | Hash of package contents at generation. Integrity check on open. |
| `handoff_type` [IMMUTABLE] | enum | STANDARD, EMERGENCY, CACHED |

**Handoff types:**

| Type | Trigger | `to_operator_id` |
|------|---------|-----------------|
| STANDARD | Outgoing operator initiates | Specified |
| EMERGENCY | Commander_lapsed auto-generation | Null (UNASSIGNED) |
| CACHED | No incoming operator available at shift end | Null; expires after configured window |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `to_operator_id` | operator_id | Null for EMERGENCY and CACHED types. |
| `section_acknowledgements[]` | object[] | Per-section acknowledgement records. |
| `completed_at` | governed_timestamp | When incoming operator completed review. |

#### Lifecycle

```
GENERATED → OPENED → ACKNOWLEDGED → COMPLETED
                                  → INCOMPLETE (package expired before all sections acknowledged)
          → EXPIRED (CACHED type, no operator claimed within window)
```

#### Visibility Rules

| Accessor | Visibility |
|----------|-----------|
| From-operator | Full package, all states |
| To-operator | Full package after opening |
| ADMIN | All handoff packages |
| Other OPERATOR | EMERGENCY type packages visible to any OPERATOR+ |

#### Replay Obligations

Package contents must be reconstructible from the corpus at `generated_at`. No package content is authoritative if it cannot be verified against the corpus hash.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| HANDOFF_GENERATED | Package created |
| HANDOFF_OPENED | Incoming operator opens |
| HANDOFF_SECTION_ACKNOWLEDGED | Per-section acknowledgement |
| HANDOFF_COMPLETED | All sections acknowledged |
| HANDOFF_EXPIRED | Package expired without completion |

---

### CERTIFICATION_RECORD

**Purpose:** An attestation that an operator has demonstrated proficiency at a specific certification level.

**Owner:** System issues on successful completion. Operators do not self-certify.

**Authority source:** L1–L3: automated scenario runner. L4: requires instructor attestation (instructor_id required in `issued_by`).

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `certification_id` [IMMUTABLE] | string | |
| `operator_id` [IMMUTABLE] | operator_id | |
| `level` [IMMUTABLE] | enum L1–L4 | Immutable — a renewed certification is a new record, not a mutation. |
| `issued_at` [IMMUTABLE] [SYSTEM] | governed_timestamp | |
| `expires_at` | governed_timestamp | Set at issuance. Mutable only via renewal (new record). |
| `issued_by` [IMMUTABLE] | string | `system` for L1–L3; `instructor:{operator_id}` for L4. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `scenario_ids[]` | string[] | Scenario runner session IDs used to issue. |
| `score_data` | object | Structured scenario performance data. |
| `instructor_notes` | string | L4 only. |
| `skill_decay_detected_at` | governed_timestamp | Set by system when skill decay pattern detected. |

#### Lifecycle

```
ACTIVE → EXPIRING (30 days before expires_at)
EXPIRING → EXPIRED
ACTIVE | EXPIRING → RENEWED (new CERTIFICATION_RECORD created; this record marked SUPERSEDED)
```

Renewal creates a new CERTIFICATION_RECORD with a new `certification_id`. The old record is marked SUPERSEDED, not deleted.

#### Visibility Rules

| Accessor | Visibility |
|----------|-----------|
| Operator (own) | Full record |
| ADMIN | All records |
| Handoff package | Adequacy check only (level + expiry status; no score_data) |
| Other operators | Level and expiry status only |

#### Replay Obligations

Certification issuance must be reconstructible from the scenario completion record. Given the scenario_ids, the system must be able to verify the issuance was valid at that time.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| CERTIFICATION_ISSUED | Issuance |
| CERTIFICATION_EXPIRY_WARNING | 30 days before expires_at |
| CERTIFICATION_EXPIRED | Expiry |
| CERTIFICATION_RENEWED | Renewal (references old certification_id) |
| SKILL_DECAY_DETECTED | System detects decay pattern |

---

### TRUST_SIGNAL

**Purpose:** A system-computed assessment of the trustworthiness of a data source or venue state.

**Owner:** System. Computed, never operator-set.

**Authority source:** Derived from heartbeat freshness, corpus hash match, clock sync status, and PRE determinism checks. No single source is authoritative alone.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `signal_id` [IMMUTABLE] [SYSTEM] | string | |
| `computed_at` [SYSTEM] | governed_timestamp | |
| `scope_id` | venue_id or fleet_id | |
| `signal_type` | enum | HEARTBEAT_FRESHNESS, CORPUS_INTEGRITY, CLOCK_SYNC, PRE_DETERMINISM |
| `value` | float 0.0–1.0 | 1.0 = fully trusted. Thresholds per signal_type. |
| `basis[]` [SYSTEM] | event_id[] | The specific events that contributed to this computation. Non-empty. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `confidence_level` | enum | HIGH, MEDIUM, LOW. Reflects completeness of basis data. |
| `degradation_reason` | string | When value < threshold, human-readable reason. |

#### Lifecycle

TRUST_SIGNAL is not a lifecycle entity. It is always the most recently computed value. Previous values are queryable from the audit trail.

#### Visibility Rules

All operators on scope may view trust signals. Trust signals are inputs to constitutional state derivation — they are not directly actionable by operators but are visible for diagnostic purposes.

#### Replay Obligations

The trust signal at any timestamp must be reconstructible from its basis events. Given the basis event_ids, the computation must produce the same value.

#### Audit Obligations

Every computed trust signal written with its basis. Written on every computation cycle — not only on change. The audit trail is the historical record.

---

### READINESS_SIGNAL

**Purpose:** A system-computed assessment of whether a venue is ready for content delivery.

**Owner:** System.

**Authority source:** Derived from player state, corpus state, connectivity status, and clock sync.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `signal_id` [IMMUTABLE] [SYSTEM] | string | |
| `computed_at` [SYSTEM] | governed_timestamp | |
| `venue_id` [IMMUTABLE] | venue_id | |
| `ready` [SYSTEM] | boolean | True = all blocking conditions clear. |
| `basis[]` [SYSTEM] | event_id[] | Source events used in computation. Non-empty. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `blocking_conditions[]` | enum[] | Specific conditions preventing readiness. |
| `estimated_recovery` | governed_timestamp | System estimate of when readiness will be restored. Advisory only. |

**Blocking condition types:**

| Condition | Meaning |
|-----------|---------|
| PLAYER_NOT_LIVE | Player machine state is not LIVE |
| CORPUS_INCOMPLETE | Corpus not fully synced |
| CLOCK_UNSYNCHRONIZED | Player clock drift exceeds threshold |
| CONNECTIVITY_INSUFFICIENT | Connectivity state insufficient for reliable delivery |
| PRE_RESOLUTION_FAILED | PRE cannot produce a valid resolution |

#### Lifecycle

Point-in-time assessment only. Not a lifecycle entity.

#### Visibility Rules

OPERATOR+ on assigned venues. ADMIN globally. Used as gate in venue preflight procedure.

#### Replay Obligations

Reconstructible from player telemetry at that timestamp. Given the same telemetry inputs at the same governed_timestamp, the computation must produce the same result.

#### Audit Obligations

Written on state change only — not every computation cycle. Written when `ready` changes value or when `blocking_conditions` set changes.

---

### OPERATIONAL_WARNING

**Purpose:** A system-generated observation that a condition is approaching a risk threshold.

**Owner:** System.

**Authority source:** Backend monitoring rules applied to operational data streams.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `warning_id` [IMMUTABLE] [SYSTEM] | string | |
| `generated_at` [IMMUTABLE] [SYSTEM] | governed_timestamp | |
| `warning_type` | enum | See warning types table below. |
| `scope_id` | venue_id or fleet_id | |
| `threshold_value` | numeric or string | The configured threshold being approached or crossed. |
| `observed_value` | numeric or string | The observed value at generation time. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `incident_id` | incident_id | If warning generated in context of an active incident. |
| `venue_id` | venue_id | When scope is fleet-level. |
| `auto_resolves_at` | governed_timestamp | Estimated time of auto-resolution, if applicable. Not a guarantee. |

#### Warning Types

| Type | Trigger condition |
|------|------------------|
| OVERRIDE_ACCUMULATION | >3 active overrides on a scope |
| CERTIFICATION_EXPIRY | Certification expires in <30 days |
| CORPUS_SYNC_OVERDUE | Corpus not synced within configured window |
| AUTONOMY_THRESHOLD | Venue offline, <24h autonomy remaining (after >1h offline) |
| NO_EXPIRY_OVERRIDE | L1–L4 override placed without `expires_at` |
| ANNOTATION_ABSENCE | No operator annotation on active incident in >2 hours |
| COMMAND_DURATION | Same operator held incident command >12 hours |
| PRE_DIVERGENCE | PRE replay produces different output than original resolution |

#### Lifecycle

```
ACTIVE → RESOLVED (condition cleared)
ACTIVE → ESCALATED (operator or system escalates to incident)
ACTIVE → ACKNOWLEDGED_AND_DISMISSED (operator explicit dismissal — audited)
```

**Warnings that may never be auto-resolved:**
- NO_EXPIRY_OVERRIDE: resolves only when the override gains an `expires_at` or is removed
- PRE_DIVERGENCE: resolves only when ADMIN classifies the divergence and closes it

#### Visibility Rules

Operators on scope see active warnings for their venues. ADMIN sees all warnings globally.

#### Replay Obligations

Warning reconstructible from the monitoring event that generated it at the `generated_at` governed_timestamp.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| WARNING_GENERATED | Warning creation |
| WARNING_RESOLVED | Condition cleared |
| WARNING_ESCALATED | Operator or system escalation |
| WARNING_DISMISSED | Operator explicit dismissal |

---

### OPERATIONAL_FINDING

**Purpose:** An operator-authored conclusion drawn from investigation evidence.

**Owner:** The operator who authored it.

**Authority source:** Any OPERATOR+ with investigation access.

#### Required Attributes

| Field | Type | Constraints |
|-------|------|-------------|
| `finding_id` [IMMUTABLE] | string | |
| `authored_by` [IMMUTABLE] | operator_id | |
| `authored_at` [IMMUTABLE] | governed_timestamp | |
| `investigation_id` [IMMUTABLE] | investigation_id | |
| `finding_text` | string | No minimum length enforced by platform, but DRAFT state is not persisted. |
| `evidence_basis[]` [IMMUTABLE] | (annotation_id or event_id)[] | Non-empty. Must reference corpus events. |

#### Optional Attributes

| Field | Type | Notes |
|-------|------|-------|
| `divergence_class` | enum | If finding is about a PRE divergence. |
| `confidence` | enum | CONFIRMED, PROBABLE, SPECULATIVE |
| `incident_id` | incident_id | If finding links to an incident. |

#### Lifecycle

```
DRAFT (client-side only) → SUBMITTED → SUPERSEDED (by a later finding on the same investigation)
```

SUPERSEDED findings are not deleted. They remain as the historical record of investigative conclusions.

#### Visibility Rules

All operators may see submitted findings. Findings are platform-visible records — they are not scoped to the investigation's operator.

#### Replay Obligations

Findings are replay artifacts. The `evidence_basis` links to specific corpus events. A finding is only valid if all evidence_basis entries are resolvable in the corpus.

#### Audit Obligations

| Event | Trigger |
|-------|---------|
| FINDING_SUBMITTED | Finding written to corpus |
| FINDING_SUPERSEDED | Later finding on same investigation submitted |

---

## Entity Relationship Summary

| Entity | Creates | References | Owned by |
|--------|---------|------------|---------|
| INCIDENT | — | OVERRIDE (incident_id annotation), ALERT (incident_id) | Commander |
| ALERT | — | INCIDENT (optional), source_event | System |
| OVERRIDE | — | INCIDENT (optional annotation) | Placing operator / ADMIN |
| VENUE_STATUS | — | Player telemetry, PRE resolution | System |
| RECOVERY_ACTION | — | workflow_id | Claiming operator |
| INVESTIGATION | REPLAY_ANNOTATION, OPERATIONAL_FINDING | INCIDENT (optional) | Opening operator |
| REPLAY_ANNOTATION | — | INVESTIGATION, corpus event | Authoring operator (immutable) |
| HANDOFF_PACKAGE | — | venues, incidents | System / outgoing operator |
| CERTIFICATION_RECORD | — | operator_id, scenario_ids | System |
| TRUST_SIGNAL | — | basis events | System |
| READINESS_SIGNAL | — | venue_id, basis events | System |
| OPERATIONAL_WARNING | — | scope_id, monitoring event | System |
| OPERATIONAL_FINDING | — | INVESTIGATION, evidence_basis | Authoring operator |

---

## Retention Policy

| Entity | Retention | Purgeable |
|--------|-----------|-----------|
| INCIDENT | Indefinite | No — constitutional |
| ALERT | 90 days | Yes (after expiry/acknowledgement) |
| OVERRIDE | Indefinite | No — constitutional |
| VENUE_STATUS | 90 days (historical snapshots) | Yes |
| RECOVERY_ACTION | 1 year | Yes |
| INVESTIGATION | Indefinite | No — constitutional |
| REPLAY_ANNOTATION | Indefinite | No — constitutional |
| HANDOFF_PACKAGE | 1 year | Yes |
| CERTIFICATION_RECORD | Indefinite | No — constitutional |
| TRUST_SIGNAL | 30 days | Yes |
| READINESS_SIGNAL | 30 days (on-change records) | Yes |
| OPERATIONAL_WARNING | 90 days | Yes |
| OPERATIONAL_FINDING | Indefinite | No — constitutional |
