# INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1

**Version:** 1.0
**Authority:** Platform Governance
**Applies to:** All subsystems that produce, store, or expose investigation sessions, replay annotations, operational findings, and counterfactual analyses

---

## Core Principle

Replay is a historical record, not a mutable narrative.

Investigation produces findings. Findings interpret the historical record. The historical record itself does not change when a finding is added.

Relationship between layers:
- **Corpus events:** Machine-produced, immutable facts. Highest evidentiary authority.
- **Annotations:** Operator interpretations of corpus facts. Write-once. Immutable after authorship.
- **Findings:** Operator conclusions drawn from annotated evidence. Supersession-only lifecycle (old finding remains).
- **Counterfactuals:** Hypothetical analyses. Advisory only. Cannot modify the corpus.

None of these operations change the corpus. The corpus is append-only.

---

## Entity: Investigation Session

An investigation session is a bounded period of operator interaction with a historical corpus window for a specific venue and time range.

### Required fields

| Field | Type | Constraints |
|---|---|---|
| `investigation_id` | string | Globally unique; system-generated |
| `opened_at` | governed_timestamp | Set at creation; immutable |
| `opened_by` | operator_id | Immutable after write; minimum role: OPERATOR |
| `venue_id` | string | The venue whose corpus is being investigated; immutable |
| `time_range_start` | governed_timestamp | Historical timestamp; must be in the past |
| `time_range_end` | governed_timestamp | Historical timestamp; may be open-ended for ongoing incidents |
| `session_type` | enum | FORENSIC | DIVERGENCE | SCHEDULED_VERIFICATION | POST_INCIDENT |

### Optional fields

| Field | Type | Meaning |
|---|---|---|
| `incident_id` | string | Links session to an active or closed incident |
| `divergence_report_id` | string | Triggered by a parity divergence event |
| `concluded_at` | governed_timestamp | Set on conclusion; system-written |
| `concluded_by` | operator_id | Set on conclusion |
| `conclusion_type` | enum | ROOT_CAUSE_IDENTIFIED | CONTRIBUTING_FACTORS | INCONCLUSIVE | FALSE_POSITIVE |
| `linked_finding_ids[]` | string[] | IDs of findings that belong to this session |
| `contradictions[]` | object[] | Computed list of unresolved annotation contradictions (see Contradiction Handling) |

### Lifecycle

```
OPEN
  |
  | (first annotation added)
  |
ACTIVE
  |
  +---> CONCLUDED (conclusion_type set, concluded_at written)
  |
  +---> ABANDONED (closed without annotation or conclusion)
```

**ABANDONED handling:** An ABANDONED investigation is permitted. When an operator closes an investigation without annotations or a conclusion, the system logs the ABANDONED transition and records `abandoned_at`. An advisory is displayed: "Investigation closed without annotations or conclusion. Closing reason?" — non-blocking. The closing reason is recorded as an optional field.

**Deletion:** Investigations are never deleted. An ABANDONED investigation with zero annotations remains in the corpus permanently.

### Session type semantics

| Type | Typical trigger | Expected outcome |
|---|---|---|
| FORENSIC | Manual operator initiation | ROOT_CAUSE_IDENTIFIED or INCONCLUSIVE |
| DIVERGENCE | Automatic trigger on parity divergence event | Divergence class classification |
| SCHEDULED_VERIFICATION | Periodic compliance check | INCONCLUSIVE (no issues) or CONTRIBUTING_FACTORS |
| POST_INCIDENT | Incident reaches RESOLVED state | ROOT_CAUSE_IDENTIFIED |

A POST_INCIDENT investigation linked to an incident blocks the incident's RESOLVED transition if unresolved contradictions exist (see Contradiction Handling).

### Authority

- OPERATOR+: May open an investigation on any assigned venue
- ADMIN: May open an investigation on any venue
- Session ownership: The `opened_by` operator is the session owner. Only the session owner or ADMIN may conclude or abandon the session.

---

## Entity: Replay Annotation

An annotation is an operator-authored note attached to a specific point in the historical corpus during an investigation session.

### Required fields

| Field | Type | Constraints |
|---|---|---|
| `annotation_id` | string | Globally unique; system-generated |
| `investigation_id` | string | Parent session; must be in OPEN or ACTIVE state at time of write |
| `authored_by` | operator_id | Immutable after write; must be a current participant in the session |
| `authored_at` | governed_timestamp | Time the annotation was written, not the historical time being annotated; immutable |
| `anchored_to` | object | One of: `{type: "event", event_id}`, `{type: "timestamp", governed_timestamp}`, `{type: "time_range", start, end}` |
| `text` | string | Minimum 10 characters; maximum 2000 characters |

### Optional fields

| Field | Type | Meaning |
|---|---|---|
| `finding_id` | string | Set when this annotation is cited as evidence in a finding |
| `divergence_class` | enum | CLASS_1 | CLASS_2 | CLASS_3 | CLASS_4 — if annotation classifies a divergence event |
| `confidence` | enum | CONFIRMED | PROBABLE | SPECULATIVE — operator's self-assessment |
| `supersedes` | string | annotation_id of the annotation this one supersedes |
| `superseded_by` | string | annotation_id of the superseding annotation (system-written on supersession) |

### Immutability rules

**Rule A-01:** Annotations are immutable after write. There is no edit operation.

**Rule A-02:** To correct an annotation, the operator writes a new annotation with `supersedes: [prior_annotation_id]`. The prior annotation is not deleted. It is marked SUPERSEDED (system sets `superseded_by` on the prior record). The text of the prior annotation remains in the corpus unchanged.

**Rule A-03:** DELETE is permanently forbidden on any annotation record.

**Rule A-04:** UPDATE is permanently forbidden on `annotation.text`, `annotation.authored_by`, `annotation.authored_at`, and `annotation.anchored_to` after initial write.

**Rule A-05:** A SUPERSEDED annotation must never be presented as current without displaying the superseding annotation alongside it.

**Rule A-06:** Any API query returning annotations must include `superseded_by` in each annotation object. A consumer that does not display SUPERSEDED status is in violation of this contract.

### Approved behavior

- Writing a corrective annotation with `supersedes` reference and explaining the correction in the text
- Displaying both the superseded and superseding annotations in investigation UI, with clear status markers
- Allowing annotations on any point in the historical time range (time_range_start to time_range_end) for the open investigation

### Forbidden behavior

- Editing annotation text after write
- Deleting an annotation, including SUPERSEDED annotations
- Writing an anonymous annotation (authored_by is always required)
- Writing a corrective annotation that omits the `supersedes` reference when explicitly correcting a prior annotation
- Hiding SUPERSEDED annotations from investigation views

### Audit event

`ANNOTATION_WRITTEN`: `annotation_id`, `investigation_id`, `authored_by`, `authored_at`, `anchored_to`, `text_hash`

Note: `text_hash` is recorded in the audit event, not the full text. The full text is stored in the annotation record. The hash allows verification that the text has not changed since authorship.

---

## Entity: Operational Finding

A finding is an operator-authored interpretive conclusion drawn from investigation evidence.

### Required fields

| Field | Type | Constraints |
|---|---|---|
| `finding_id` | string | Globally unique; system-generated |
| `investigation_id` | string | Parent session; must be in OPEN or ACTIVE state at write |
| `authored_by` | operator_id | Immutable after write |
| `authored_at` | governed_timestamp | Immutable after write |
| `finding_text` | string | Minimum 50 characters |
| `evidence_basis[]` | string[] | Array of annotation_ids and/or corpus event_ids; may be empty (produces UNSUPPORTED flag) |

### Optional fields

| Field | Type | Meaning |
|---|---|---|
| `incident_id` | string | Links finding to an incident |
| `divergence_class` | enum | CLASS_1 | CLASS_2 | CLASS_3 | CLASS_4 |
| `confidence` | enum | CONFIRMED | PROBABLE | SPECULATIVE |
| `superseded_by` | string | finding_id of the superseding finding (system-written) |
| `supersedes` | string | finding_id of the finding this one supersedes |
| `counterfactual_result` | string | Summary of a supporting counterfactual analysis |

### UNSUPPORTED flag

A finding submitted with an empty `evidence_basis[]` is marked `UNSUPPORTED: true` by the system. UNSUPPORTED findings:
- Are visible in the investigation
- Are displayed with a distinct marker indicating absence of evidence basis
- Cannot be used as the sole basis for incident closure
- Cannot be the effective conclusion of a POST_INCIDENT investigation without at least one supported finding also present

### Lifecycle

```
SUBMITTED
  |
  | (new finding submitted for same investigation with supersedes: this_finding_id)
  |
SUPERSEDED
```

Both the SUBMITTED and SUPERSEDED finding remain in the corpus. The investigation's effective conclusion is the most recent non-SUPERSEDED finding with a non-SPECULATIVE confidence (or, if all findings are SPECULATIVE, the most recent finding).

**Finding deletion:** Permanently forbidden. SUPERSEDED findings remain.

### Evidentiary hierarchy

When multiple pieces of evidence exist, their authority is ranked:

| Rank | Evidence type | Authority |
|---|---|---|
| 1 (highest) | Corpus events — machine-produced, immutable | Highest |
| 2 | Annotations citing specific corpus events | Operator interpretation of specific evidence |
| 3 | Annotations citing time ranges | Operator interpretation of a period |
| 4 | Findings with multiple annotation citations | Synthesis |
| 5 (lowest) | Findings citing other findings | Inferred conclusions |

A finding that cites only other findings (rank 5) and no corpus events or annotations must be presented with a clear indicator that it is inferential, not evidentiary.

### Incident closure constraints

A finding must meet the following conditions to support incident closure:

1. `evidence_basis[]` is not empty (not UNSUPPORTED)
2. `confidence` is CONFIRMED or PROBABLE (not SPECULATIVE)
3. The investigation's unresolved contradictions are zero (or the finding explicitly addresses all listed contradictions)

A SPECULATIVE finding may not be the sole basis for closure. At least one CONFIRMED or PROBABLE finding must support the closure annotation.

---

## Entity: Counterfactual Analysis

A counterfactual is a hypothetical PRE resolution run: "What would PRE have resolved if input parameter X had been Y?"

### Required fields

| Field | Type | Constraints |
|---|---|---|
| `counterfactual_id` | string | Globally unique; system-generated |
| `investigation_id` | string | Parent session; must be OPEN or ACTIVE |
| `run_by` | operator_id | ADMIN role required; immutable after write |
| `run_at` | governed_timestamp | Immutable after write |
| `base_input` | PREInput | The original PREInput that was replayed (full input record) |
| `modified_parameters` | object | The parameters changed for this counterfactual and their new values |
| `result` | PREOutput | The output produced by the hypothetical run |

### Governance rules

**Rule CF-01:** Counterfactual results are advisory. They cannot change the corpus.

**Rule CF-02:** Counterfactual results may be cited in findings via the `counterfactual_result` field. They are not evidence of what happened — they are evidence of what would have happened under different conditions. The finding must make this distinction explicit in its `finding_text`.

**Rule CF-03:** Counterfactual results do not retroactively change what content was served. The corpus record of what was served is unaffected by any counterfactual.

**Rule CF-04:** All ADMIN counterfactual runs are audit-logged and visible in the investigation session view.

**Rule CF-05:** Counterfactual runs require ADMIN role. OPERATOR role may view counterfactual results but may not initiate runs.

**Rule CF-06:** Counterfactual results are permanent. They may not be deleted or modified after write.

### Approved behavior

- Citing a counterfactual result in a finding as supporting evidence that a different configuration would have prevented the issue
- Displaying counterfactual results with clear labeling: "HYPOTHETICAL — this did not occur"
- Running multiple counterfactuals against the same base_input to test different parameter combinations

### Forbidden behavior

- Using a counterfactual result as the basis for claiming what "actually happened"
- Deleting or modifying a counterfactual result after it is written
- Running counterfactuals with OPERATOR role
- Presenting counterfactual results without the "HYPOTHETICAL" designation in operator-facing surfaces

---

## Additive-Only Annotation Governance

The corpus is append-only. Annotations and findings extend the corpus. They do not modify it.

### Rules

**AO-01:** No annotation may delete, modify, or overwrite a corpus event.

**AO-02:** Annotations are write-once. The edit path produces a SUPERSEDING annotation; it does not produce a modification.

**AO-03:** SUPERSEDED annotations remain in the corpus. Any query that returns annotations must include `superseded_by` status. Filtering out SUPERSEDED annotations from a full-corpus query is a violation.

**AO-04:** Deletion of annotations is permanently forbidden. ADMIN cannot delete an annotation.

**AO-05:** Investigations are not deletable. An investigation record opened but immediately abandoned, with zero annotations, remains in the corpus.

**AO-06:** Findings are not deletable. A SUPERSEDED finding remains in the corpus.

**AO-07:** Counterfactual results are not deletable.

**AO-08:** All write operations on investigation entities (open session, write annotation, submit finding, run counterfactual) generate audit events. No write operation on any investigation entity may succeed without generating a corresponding audit event in the same transaction.

---

## Contradiction Handling

When two annotations contradict each other on the same anchored_to point, neither is removed. Both remain. The contradiction is surfaced.

### Detection

Contradictions are detected by proximity scoring: annotations anchored to the same event_id or overlapping time ranges that contain conflicting signals (e.g., one annotating "PRE resolved correctly" and another annotating "PRE divergence detected" on the same event) are flagged as potential contradictions.

Detection is structural, not semantic. The platform does not perform natural language analysis. The investigating operator is responsible for evaluating whether a detected proximity conflict is a genuine contradiction.

### Surfacing

The investigation session object includes `contradictions[]`:

```
contradictions: [
  {
    annotation_ids: [string, string],
    anchored_to: object,
    detected_at: governed_timestamp,
    resolved: boolean,
    resolved_by_annotation_id: string | null,
    resolved_by_finding_id: string | null
  }
]
```

### Resolution

The investigating operator resolves a contradiction by:
1. Writing a superseding annotation that explicitly addresses both prior annotations and states which is correct and why, OR
2. Submitting a finding that cites both annotations and explains the resolution

A contradiction is marked `resolved: true` when either a superseding annotation explicitly references both `annotation_ids` in the contradiction record, or a finding cites both and has a `confidence` of CONFIRMED or PROBABLE.

### Operational consequence

**POST_INCIDENT investigations:** An unresolved contradiction in an investigation linked to an incident blocks the CONTAINED → RESOLVED transition with a warning: "N contradictions in linked investigation [ID] have not been addressed." This is a soft block — the operator may override with ADMIN credentials. The override is audit-logged.

**Other investigation types:** Unresolved contradictions are displayed as warnings. They do not block any state transitions.

---

## Confidence Classification

Confidence applies to annotations and findings. It is operator-declared, not system-computed.

| Value | Meaning | Operational restrictions |
|---|---|---|
| CONFIRMED | Author has high certainty based on direct evidence | None |
| PROBABLE | Author believes correct but acknowledges uncertainty | May not be sole basis for incident closure if multiple contradictions unresolved |
| SPECULATIVE | Author is guessing or evidence is indirect | May not be sole basis for incident closure; must be accompanied by at least one CONFIRMED or PROBABLE finding |

**Rule CONF-01:** Confidence is self-reported by the annotation or finding author. The system does not compute confidence.

**Rule CONF-02:** A finding with SPECULATIVE confidence may not be used as the sole basis for incident closure. At least one CONFIRMED or PROBABLE finding must support the closure annotation.

**Rule CONF-03:** Confidence is immutable after write. An operator who reassesses their confidence must write a superseding annotation or finding with the updated confidence value.

---

## Retention

| Entity | Retention | Archival | Deletion |
|---|---|---|---|
| Investigation Sessions | 7 years minimum | 1 year after CONCLUDED or ABANDONED | Never |
| Replay Annotations | Permanent | Never — always queryable | Never |
| Operational Findings | Permanent | Never | Never |
| Counterfactual Results | Permanent | Never | Never |
| Abandoned Investigations | Permanent | Never | Never |

All investigation artifacts travel with the corpus on archival or migration. A corpus archive that omits investigation artifacts is incomplete.

---

## Attribution

Every annotation, finding, and counterfactual carries `authored_by` (operator_id) and `authored_at` (governed_timestamp). Attribution is immutable.

**ATTR-01:** No finding or annotation may have its `authored_by` field changed after write, even by ADMIN.

**ATTR-02:** No finding or annotation may have its `authored_at` field changed after write.

**ATTR-03:** Anonymous annotations are forbidden. An annotation without a valid operator_id in `authored_by` must be rejected with 422.

**ATTR-04:** Attributing an annotation or finding to a different operator after write is permanently forbidden. If an annotation was written in error under the wrong session, the correct action is a superseding annotation by the correct author.

---

## Audit Requirements

### Required audit events

| Event | Required fields |
|---|---|
| `INVESTIGATION_OPENED` | investigation_id, opened_by, opened_at, venue_id, time_range_start, time_range_end, session_type |
| `INVESTIGATION_CONCLUDED` | investigation_id, concluded_by, concluded_at, conclusion_type, linked_finding_ids[] |
| `INVESTIGATION_ABANDONED` | investigation_id, abandoned_by, abandoned_at, annotation_count, closing_reason (optional) |
| `ANNOTATION_WRITTEN` | annotation_id, investigation_id, authored_by, authored_at, anchored_to, text_hash |
| `ANNOTATION_SUPERSEDED` | annotation_id, superseded_by_annotation_id, supersession_at |
| `FINDING_SUBMITTED` | finding_id, investigation_id, authored_by, authored_at, evidence_basis[], confidence, unsupported_flag |
| `FINDING_SUPERSEDED` | finding_id, superseded_by_finding_id, supersession_at |
| `COUNTERFACTUAL_RUN` | counterfactual_id, investigation_id, run_by, run_at, modified_parameters |
| `CONTRADICTION_DETECTED` | investigation_id, annotation_ids[], anchored_to, detected_at |
| `CONTRADICTION_RESOLVED` | investigation_id, contradiction_annotation_ids[], resolved_by, resolved_at, resolution_type |
| `INCIDENT_CLOSURE_BLOCKED` | incident_id, investigation_id, unresolved_contradiction_count, blocked_at |
| `INCIDENT_CLOSURE_OVERRIDE` | incident_id, investigation_id, overridden_by, override_at |

### Audit event requirements

- All events carry governed_timestamp
- All events are immutable after write
- All events include system-generated IDs — never caller-supplied IDs
- Events for annotation writes must be written atomically with the annotation record (not async)

---

## Corpus Event Replay Requirements

When an investigation session is opened, the corpus events for the specified venue and time range must be fully reconstructible and queryable.

### Requirements

**RE-01:** All PRE resolution outputs for the venue and time range must be replayed in their original sequence, with original input values, original output values, and original governing timestamps.

**RE-02:** Trust and health status values at any point in the replay window must reflect the values computed at that time, not current values.

**RE-03:** The replayed sequence must be deterministic: replaying the same corpus window produces identical output every time.

**RE-04:** Operator annotations authored during the investigation are displayed alongside the corpus events they are anchored to, without modifying the corpus event records.

**RE-05:** If a counterfactual was run during the investigation, the counterfactual results are displayed in a separate panel, clearly labeled HYPOTHETICAL, not interspersed with corpus events.

**RE-06:** SUPERSEDED annotations are displayed in the investigation view with their SUPERSEDED status clearly marked, alongside the superseding annotation.

---

## API Contract Requirements

### Endpoint constraints

| Endpoint | Permitted methods | Notes |
|---|---|---|
| `/investigations` | GET, POST | No DELETE |
| `/investigations/{id}` | GET, PATCH (conclude/abandon only) | No DELETE, no PUT |
| `/annotations` | GET, POST | No DELETE, no PUT, no PATCH on text/authored_by/authored_at/anchored_to |
| `/annotations/{id}` | GET | Read-only after creation |
| `/findings` | GET, POST | No DELETE, no PUT |
| `/findings/{id}` | GET | Read-only after creation |
| `/counterfactuals` | GET, POST (ADMIN only) | No DELETE, no PUT |
| `/counterfactuals/{id}` | GET | Read-only after creation |

### Schema requirements

All responses must include:

- `status` field with the entity's current lifecycle state
- `superseded_by` field (null or populated) on annotations and findings
- `unsupported_flag` on findings with empty evidence_basis[]
- `contradictions[]` on investigation session objects
- `authored_by`, `authored_at` on all annotation, finding, and counterfactual objects

Any response missing these fields must be treated as a malformed response and rejected by consuming services.
