# OPERATIONAL-STATUS-AND-TRUST-MODEL-v1

**Version:** 1.0
**Authority:** Platform Governance
**Applies to:** All platform subsystems that produce, consume, or display operational status values

---

## Status Dimensions

Status dimensions are orthogonal. They are not interchangeable. A HEALTHY health status does not imply TRUSTED trust status. A CONNECTED connectivity status does not imply READY readiness. Every status object must declare which dimension it represents.

The platform defines seven status dimensions:

| Dimension | What It Measures | Who Computes It |
|---|---|---|
| HEALTH | Operational condition of a system component | Platform monitoring subsystems |
| TRUST | Confidence in the reliability of data from a source | Corpus hash verification, heartbeat processing |
| CONFIDENCE | Certainty of the system's own assessment | Derived; accompanies every status computation |
| FRESHNESS | How current a piece of data is | Derived from last_updated timestamp |
| READINESS | Whether a venue is ready for content delivery | Composite: player state + corpus + clock + heartbeat |
| CONNECTIVITY | Network relationship between venue and platform | Heartbeat processing |
| INTEGRITY | Consistency of a data artifact with its expected hash | Corpus hash verification |

---

## Dimension: HEALTH STATUS

**Operational meaning:** The operational condition of a system component. Health is always a pessimistic assessment.

### States

| State | Meaning |
|---|---|
| HEALTHY | All monitored conditions within bounds |
| DEGRADED | One or more conditions outside bounds; system remains functional |
| CRITICAL | System functional but at measurable risk of failure |
| FAILED | System not functional |
| UNKNOWN | No data available to assess condition |

### Derivation rules

**Rule H-01:** Health status is always the worst state among all contributing signals. If three signals are HEALTHY and one is CRITICAL, the composite health status is CRITICAL.

**Rule H-02:** Computing an average or majority-vote across contributing signals is permanently forbidden. Health status is pessimistic.

**Rule H-03:** UNKNOWN is treated as DEGRADED for constitutional decision-making. An UNKNOWN health status is never treated as neutral or positive.

**Rule H-04:** Every computed health status must include `basis[]` — the list of contributing signals and their individual states. A health status without basis[] is malformed and must be rejected by consumers.

**Rule H-05:** Contributing signals are system-produced only. Operator input does not contribute to health status computation.

### Approved behavior

- Returning CRITICAL when any single contributing signal is CRITICAL, regardless of other signals
- Surfacing the specific signal that caused a degraded composite status
- Treating any gap in monitoring data as UNKNOWN for the affected component
- Escalating constitutional state if CRITICAL health status persists beyond the configured escalation window

### Forbidden behavior

- Averaging multiple HEALTHY and DEGRADED signals to produce HEALTHY
- Inferring HEALTHY from the absence of alerts (absence of signal = UNKNOWN, not HEALTHY)
- Presenting UNKNOWN health as reassuring or stable
- Suppressing CRITICAL or FAILED status from operator-visible surfaces

### Operational consequence

A FAILED health status on any component that contributes to PRE resolution must trigger an immediate CONSTITUTIONAL_RISK evaluation. A FAILED health status on more than one contributing component triggers SHADOW_ONLY minimum constitutional state.

### Verification method

Health status computation is tested by injecting a known set of signal values and asserting the output state. Test vectors must include: all signals HEALTHY → HEALTHY; one signal CRITICAL → CRITICAL; one signal UNKNOWN → UNKNOWN; all signals FAILED → FAILED.

---

## Dimension: TRUST STATUS

**Operational meaning:** Confidence in the reliability of data from a source. Trust is assessed per data source, not per piece of data.

### States

| State | Meaning |
|---|---|
| TRUSTED | Data freshness, integrity, and provenance are all verified |
| DEGRADED_TRUST | One or more trust signals stale or unverifiable; data used with caution |
| UNTRUSTED | Data fails provenance or integrity check; must not be used for decisions without operator acknowledgement |
| UNKNOWN | No trust assessment available; treated as UNTRUSTED operationally |

### Trust signals

Trust status is computed from three signals. Each signal independently affects the result.

| Signal | TRUSTED threshold | DEGRADED_TRUST threshold | UNTRUSTED threshold |
|---|---|---|---|
| Data freshness | Within configured freshness_window | Between freshness_window and expiry_window | Beyond expiry_window |
| Corpus hash match | Hash verified within 24h | Hash check expired (>24h) | Hash mismatch detected |
| Clock sync delta | Within configured drift_tolerance | Between drift_tolerance and 2× drift_tolerance | Beyond 2× drift_tolerance or NTP unreachable |

### Derivation rules

**Rule T-01:** Any single trust signal failing produces DEGRADED_TRUST minimum.

**Rule T-02:** Two or more trust signals failing produces UNTRUSTED.

**Rule T-03:** Any integrity violation (hash mismatch) produces UNTRUSTED regardless of other signals.

**Rule T-04:** UNKNOWN trust status is treated as UNTRUSTED for all operational purposes. UNKNOWN and UNTRUSTED are equivalent in decision-making.

**Rule T-05:** Trust status may not be computed by averaging trust signals. If any signal is UNTRUSTED, the source trust status is UNTRUSTED.

**Rule T-06:** Trust status reverts to TRUSTED only after all three trust signals independently confirm TRUSTED thresholds. Partial recovery produces DEGRADED_TRUST.

### Approved behavior

- Flagging PRE resolutions that depend on data from an UNTRUSTED source with `UNTRUSTED_INPUT` in the resolution trace
- Continuing content delivery from a venue with UNTRUSTED data (72h autonomy corpus remains operative), while flagging the condition
- Requiring operator acknowledgement before an UNTRUSTED source contributes to fleet-level decisions
- Surfacing the specific failing trust signal with its last known good value and age

### Forbidden behavior

- Presenting DEGRADED_TRUST as TRUSTED because the staleness is within a soft threshold
- Averaging trust signals where some are UNTRUSTED to produce DEGRADED_TRUST (if any signal is UNTRUSTED, result is UNTRUSTED)
- Using UNTRUSTED data in PRE resolution without flagging the resolution output
- Clearing the UNTRUSTED flag without all three trust signals independently verifying

### Operational consequence

An UNTRUSTED source cited in a PRE resolution must be recorded in the resolution trace. The operator on duty must be notified. If the source remains UNTRUSTED beyond the configured escalation window, the venue's readiness status transitions to PARTIALLY_READY minimum.

### Verification method

Trust status computation is tested by independently setting each trust signal to a failing state and asserting the output. Test vectors must include: any single failure → DEGRADED_TRUST; any two failures → UNTRUSTED; hash mismatch alone → UNTRUSTED; all signals healthy → TRUSTED.

---

## Dimension: CONFIDENCE LEVEL

**Operational meaning:** The certainty of the system's own status assessment. Confidence qualifies every derived status value. A status without a confidence level is incomplete.

### States

| State | Meaning |
|---|---|
| HIGH | All inputs current, verified, complete |
| MEDIUM | Some inputs stale or unverified; assessment is best-effort |
| LOW | Most inputs stale or unverified; assessment may be significantly wrong |
| NONE | Insufficient data to make any assessment |

### Rules

**Rule C-01:** Every derived status value must carry a confidence_level. A health status, trust status, readiness status, or any composite status must include confidence_level in its data structure.

**Rule C-02:** A HEALTHY status with LOW confidence must not be presented as reassuring. The confidence level must be visible alongside the status value in all operator-facing contexts.

**Rule C-03:** HEALTHY (HIGH confidence) and HEALTHY (LOW confidence) must use different visual treatment in all operator surfaces. The backend must provide the confidence_level field. The frontend must consume it and render differently.

**Rule C-04:** A NONE confidence level means no status assessment is possible. A status value accompanied by NONE confidence must not be surfaced as informative. Display: "Assessment not possible — [specific missing inputs]."

**Rule C-05:** Composite status values (fleet health, phase readiness) must inherit the lowest confidence level among their contributing components.

### Approved behavior

- Displaying confidence level prominently alongside status values, not as a footnote
- Declining to show a composite status when contributing inputs produce NONE confidence
- Including the confidence basis (which signals are stale, which are current) in the status data structure

### Forbidden behavior

- Displaying a status value without its confidence level when confidence is LOW or NONE
- Treating LOW confidence as a footnote or secondary display
- Omitting confidence_level from API responses on the grounds that "clients might not use it"
- Using the same visual treatment for any status value at HIGH confidence and the same status at LOW confidence

### Operational consequence

A status surface that produces NONE confidence must display the specific missing signals and their last known state. Operators may not make go/no-go decisions based on NONE confidence status without explicit acknowledgement that the assessment is unavailable.

### Verification method

API contracts must require confidence_level in all status response objects. Schema validation must reject status responses missing confidence_level. Frontend render tests must assert different visual output for HEALTHY/HIGH vs HEALTHY/LOW.

---

## Dimension: FRESHNESS

**Operational meaning:** How current a piece of data is relative to its expected update frequency.

### States

| State | Meaning |
|---|---|
| CURRENT | last_updated within configured freshness_window |
| STALE | last_updated between freshness_window and expiry_window |
| EXPIRED | last_updated beyond expiry_window |
| UNKNOWN | No last_updated timestamp available |

### Thresholds (configurable per deployment)

| Boundary | Default |
|---|---|
| freshness_window | 2× heartbeat interval |
| expiry_window | 5× heartbeat interval |

### Rules

**Rule F-01:** Freshness is computed from the last_updated timestamp of the specific piece of data, not from system uptime or connection state.

**Rule F-02:** STALE data may be used in assessments but must contribute MEDIUM confidence maximum to any derived status.

**Rule F-03:** EXPIRED data must contribute LOW confidence maximum. A status derived entirely from EXPIRED data must carry LOW confidence.

**Rule F-04:** UNKNOWN freshness (no timestamp) must be treated as STALE minimum for confidence purposes. It is never treated as CURRENT.

**Rule F-05:** Freshness windows are deployment configuration, not hardcoded. The defaults apply when no configuration is present. Configuration changes to freshness windows are audit-logged.

### Approved behavior

- Computing freshness per data item, not per data source
- Surfacing the specific age of each data item when freshness is STALE or EXPIRED
- Applying freshness in confidence derivation automatically, without operator action

### Forbidden behavior

- Presenting STALE data as CURRENT because "it hasn't changed"
- Using EXPIRED data in status computations without flagging the resulting confidence as LOW
- Computing freshness from connection state rather than actual data timestamp

### Operational consequence

EXPIRED inputs in a status computation automatically cap the composite confidence at LOW.

---

## Dimension: READINESS

**Operational meaning:** Whether a venue is ready for content delivery operations.

### States

| State | Meaning |
|---|---|
| READY | Player LIVE, corpus verified, clock synced, heartbeat CURRENT |
| PARTIALLY_READY | Player operational; one or more non-critical conditions impaired |
| NOT_READY | Player unable to serve content correctly |
| ASSESSING | Readiness check in progress; no prior result available |

### Derivation rules

**Rule R-01:** READY requires all four conditions: player state = LIVE, corpus hash = VERIFIED, clock sync delta within drift_tolerance, heartbeat freshness = CURRENT.

**Rule R-02:** Any single required condition failing produces PARTIALLY_READY or NOT_READY depending on the condition's criticality.

| Failing condition | Resulting state |
|---|---|
| Player state != LIVE (any other state) | NOT_READY |
| Corpus hash = MISMATCH | NOT_READY |
| Clock sync delta beyond 2× drift_tolerance | NOT_READY |
| Heartbeat freshness = STALE | PARTIALLY_READY |
| Heartbeat freshness = EXPIRED | NOT_READY |
| Clock sync = DEGRADED (within bounds) | PARTIALLY_READY |
| Corpus hash = UNVERIFIED | PARTIALLY_READY |

**Rule R-03:** A venue recovering from DISCONNECTED state is NOT_READY until corpus hash verification completes. See RECOVERED_BUT_UNTRUSTED in constitutional handling below.

**Rule R-04:** ASSESSING is a transient state only. It must transition to a definitive state within the configured assessment_timeout. If assessment_timeout is exceeded, the result is NOT_READY.

### Approved behavior

- Listing the specific failing conditions when state is PARTIALLY_READY or NOT_READY
- Running readiness checks automatically on reconnection after DISCONNECTED state
- Presenting ASSESSING as a named transient state, not as "loading" or "unknown"

### Forbidden behavior

- Presenting PARTIALLY_READY as READY because "only one condition is failing"
- Using PARTIALLY_READY to count a venue as READY for constitutional state derivation
- Leaving a venue in ASSESSING state indefinitely

---

## Dimension: CONNECTIVITY

**Operational meaning:** The network relationship between venue player and platform.

### States

| State | Meaning |
|---|---|
| CONNECTED | Heartbeat received within last heartbeat_window |
| INTERMITTENT | Heartbeat received with gaps exceeding heartbeat_window in the last 30 minutes |
| DISCONNECTED | No heartbeat in last 3× heartbeat_window |
| UNKNOWN | No heartbeat data available (new venue or reset) |

### Rules

**Rule CN-01:** CONNECTED requires a heartbeat within the configured heartbeat_window. This is not negotiable — a venue with no heartbeat for one heartbeat_window is not CONNECTED.

**Rule CN-02:** INTERMITTENT is a distinct state from CONNECTED. A venue that has sent 8 of 10 expected heartbeats is INTERMITTENT, not CONNECTED.

**Rule CN-03:** UNKNOWN is the initial state for a new venue and after any monitoring reset. UNKNOWN is not equivalent to DISCONNECTED (DISCONNECTED implies the venue was previously CONNECTED and has since lost contact). UNKNOWN implies no connection history.

**Rule CN-04:** A venue that transitions from DISCONNECTED to CONNECTED must go through ASSESSING readiness state before READY.

### Operational consequence

DISCONNECTED triggers the 72h autonomy clock review. If the venue has been DISCONNECTED for more than 72h, it must be flagged for manual intervention. Content correctness beyond 72h autonomous operation is not guaranteed by the platform.

---

## Dimension: INTEGRITY

**Operational meaning:** The consistency of a data artifact with its expected hash.

### States

| State | Meaning |
|---|---|
| VERIFIED | Computed hash matches expected hash |
| UNVERIFIED | Hash check not yet performed or expired (>24h since last check) |
| MISMATCH | Computed hash does not match expected hash |
| UNKNOWN | No hash available for comparison |

### Rules

**Rule I-01:** MISMATCH produces UNTRUSTED trust status on the affected data source, immediately and unconditionally.

**Rule I-02:** UNVERIFIED (>24h without hash check) contributes DEGRADED_TRUST to the source trust status.

**Rule I-03:** UNKNOWN (no hash available for comparison) contributes DEGRADED_TRUST. A corpus deployed without a hash is UNKNOWN integrity.

**Rule I-04:** Hash verification is scheduled automatically and must complete within the configured verification_interval. Failure to complete a scheduled verification produces UNVERIFIED.

**Rule I-05:** Hash computation uses the canonical algorithm defined at corpus deployment time. Algorithm changes are version-locked to the corpus version.

---

## Ownership and Authority

All status objects are system-owned. Operators do not set status values.

**Permitted status sources:**
1. Platform monitoring subsystems (health signals)
2. PRE resolution outputs (trust inputs)
3. Heartbeat processing (connectivity, freshness)
4. Corpus hash verification (integrity, trust)

**Operator actions on status:**
- VIEWER+: Read current status values
- OPERATOR+: Trigger manual status reassessment (re-computation, not value setting)
- ADMIN: Read + write status configuration (thresholds, windows); may force a re-assessment cycle

**Forbidden:** Any API endpoint that accepts operator input to directly set a health, trust, readiness, or connectivity status value. Status configuration (thresholds) is mutable by ADMIN. Status values are not.

**Manual reassessment:** When an OPERATOR triggers reassessment, the system runs the computation cycle immediately and returns the computed result. The operator does not influence the computation. The reassessment trigger is audit-logged.

---

## Cross-Venue Visibility

| Role | Venue Visibility | Status Dimensions Accessible | Historical Queries |
|---|---|---|---|
| VIEWER | Assigned venues only | Current values only | No |
| OPERATOR | Assigned venues only | All dimensions, current + basis[] | No (current only) |
| ADMIN | All venues | All dimensions, all fields | Yes |

Fleet-level status (constitutional state, fleet health) is computed from the per-venue status values. ADMIN may query fleet status. OPERATOR may query status for their assigned venues. Fleet status breakdown by venue is queryable by ADMIN.

---

## Constitutional Handling of Special States

### UNKNOWN treatment

UNKNOWN is always treated pessimistically:

| Context | UNKNOWN treated as |
|---|---|
| Health status computation | DEGRADED |
| Trust status computation | UNTRUSTED |
| Readiness check (preflight) | NOT_READY |
| Constitutional state derivation | Worst plausible state given the component's role |

**Approved behavior:** UNKNOWN state surfaces the specific missing signal, its last known value, and the age of that value.

**Forbidden behavior:**
- Treating UNKNOWN as neutral
- Treating UNKNOWN as HEALTHY, TRUSTED, or READY
- Displaying UNKNOWN to operators without identifying the missing signal
- Suppressing UNKNOWN from operator-visible surfaces because "it would worry them"

### DEGRADED treatment

DEGRADED does not prevent operations. It must be visible.

Requirements:
- Every degraded component must be listed explicitly by name, not summarized ("some components degraded" is forbidden)
- The specific signal causing degradation must be identified
- Duration of DEGRADED state must be displayed
- DEGRADED persisting beyond configured escalation_window triggers CRITICAL evaluation

### UNTRUSTED treatment

An UNTRUSTED source must not contribute to decision-making without operator acknowledgement.

Protocol:
1. PRE resolution detects dependency on UNTRUSTED source
2. Resolution output is flagged `UNTRUSTED_INPUT: true` in the resolution trace
3. Operator is notified (alert generated)
4. If the player is LIVE, content continues — the 72h autonomy corpus is trusted for playback
5. Operator acknowledgement records: acknowledged_by, acknowledged_at, acknowledgement_note
6. Without acknowledgement, subsequent fleet-level decisions exclude the affected venue from HEALTHY counts

### PARTIAL treatment

A partially recovered component must not be presented as RECOVERED.

Required presentation: RECOVERING or PARTIALLY_READY with the specific incomplete recovery steps listed.

Forbidden: Presenting a venue as READY when corpus sync is 90% complete. The venue is PARTIALLY_READY until sync is 100% complete and hash verified.

### RECOVERED_BUT_UNTRUSTED

A venue that reconnects after DISCONNECTED state enters RECOVERED_BUT_UNTRUSTED status until corpus hash verification completes successfully.

Behavior during RECOVERED_BUT_UNTRUSTED:
- Player continues serving content (72h autonomy corpus is trusted for playback)
- PRE resolutions are flagged `RECOVERED_BUT_UNTRUSTED` in their trace
- The venue is NOT counted as HEALTHY for constitutional state derivation
- Readiness state is ASSESSING (transitioning to PARTIALLY_READY or NOT_READY based on results)
- The operator sees the specific verification steps remaining and their expected completion time

Exit condition: Corpus hash verification completes successfully AND heartbeat freshness = CURRENT AND clock sync delta within drift_tolerance.

Audit event: `RECOVERED_BUT_UNTRUSTED_ENTRY` on transition into this state. `VERIFICATION_COMPLETE` on exit.

---

## Prohibited Trust Inflation

Trust inflation is the presentation of a status value more favorable than the underlying data supports. It is a constitutional violation.

### Specific prohibitions

**TI-01:** Presenting DEGRADED_TRUST as TRUSTED because the operator has not noticed the degradation.
Enforcement: Status values are computed by the backend. The backend must not produce TRUSTED when signals support DEGRADED_TRUST.

**TI-02:** Presenting STALE data as CURRENT because staleness is within a soft threshold.
Enforcement: Freshness thresholds are the sole arbiter of CURRENT vs STALE. Soft thresholds are not permitted.

**TI-03:** Averaging trust signals to produce DEGRADED_TRUST when any signal is UNTRUSTED.
Enforcement: If any trust signal is UNTRUSTED, the composite trust status is UNTRUSTED. No averaging.

**TI-04:** Showing HEALTHY constitutional state when any scoped venue has CRITICAL health.
Enforcement: Constitutional state derivation uses the worst health status across all scoped venues.

**TI-05:** Presenting RECOVERED status before corpus verification completes.
Enforcement: RECOVERED is not a valid venue status until all recovery criteria are independently confirmed.

**TI-06:** Suppressing UNKNOWN status from operator-visible surfaces.
Enforcement: UNKNOWN is a displayable, named state. Suppression is forbidden at API and UI levels.

**Enforcement boundary:** The backend must not produce trust-inflated values. The frontend is not responsible for preventing trust inflation — prevention is a backend API contract requirement.

---

## Prohibited Confidence Presentation

**CP-01:** Displaying a status value without its confidence level when confidence is LOW or NONE.

**CP-02:** Using the same visual treatment for HEALTHY/HIGH and HEALTHY/LOW.

**CP-03:** Omitting `basis[]` from a status data structure. Every status must include the inputs used to compute it.

**CP-04:** Displaying a composite fleet status without making the per-venue breakdown queryable.

**CP-05:** Displaying a composite status when contributing inputs produce NONE confidence. The composite status is unavailable when confidence is NONE.

---

## Replay-Safe Trust Rendering

Trust and status values at any historical governed_timestamp must be reconstructible from the corpus.

### Requirements

**RT-01:** Every status computation is an audit event with: `computed_at`, `basis[]`, `input_values[]`, `result_value`, `confidence_level`. This event is written to the append-only corpus at computation time.

**RT-02:** When replaying a historical point, the replayed status must match the originally computed status. Determinism requirement: the same inputs produce the same output, always.

**RT-03:** Trust status in replay shows the trust state AT THAT TIME. An operator reviewing a historical replay sees what the system trusted at that moment, not what it trusts now.

**RT-04:** Retroactively improving trust status for a historical period is permanently forbidden. If data was later verified that was previously UNTRUSTED, the historical record shows UNTRUSTED. The current record shows TRUSTED. Both are correct.

**RT-05:** A replay that requires re-computing historical trust status must use the historical input values, not current values.

---

## Audit Requirements

Every status state change must be written as an audit event. Audit events are append-only and permanent.

### Required audit events

| Event | Required fields |
|---|---|
| `STATUS_CHANGE` | scope_id, dimension, from_state, to_state, computed_at, basis[], confidence_level |
| `TRUST_DEGRADATION` | scope_id, signal_name, prior_value, new_value, reason, computed_at |
| `MANUAL_REASSESSMENT_TRIGGERED` | scope_id, triggered_by, triggered_at, result_state, result_confidence |
| `RECOVERED_BUT_UNTRUSTED_ENTRY` | venue_id, disconnected_since, reconnected_at, verification_steps_pending[] |
| `VERIFICATION_COMPLETE` | venue_id, verification_type, result (VERIFIED/MISMATCH), completed_at, hash_algorithm, computed_hash, expected_hash |
| `TRUST_INFLATION_PREVENTED` | scope_id, attempted_value, correct_value, prevention_rule, computed_at |

### Audit event requirements

- All audit events carry governed_timestamp, not wall-clock time
- All audit events are immutable after write
- All audit events include the operator_id of any human action that contributed to the state change (or `SYSTEM` for automated transitions)
- Audit events for status changes are written atomically with the status change (not in a separate async process)

---

## Status Data Structure Requirements

Every status object returned by the API must conform to the following minimum structure:

```
{
  scope_id: string,
  dimension: HEALTH | TRUST | CONFIDENCE | FRESHNESS | READINESS | CONNECTIVITY | INTEGRITY,
  value: [dimension-specific state],
  confidence_level: HIGH | MEDIUM | LOW | NONE,
  computed_at: governed_timestamp,
  basis: [
    {
      signal_name: string,
      signal_value: string,
      signal_age_seconds: integer,
      signal_freshness: CURRENT | STALE | EXPIRED | UNKNOWN
    }
  ],
  flags: [UNTRUSTED_INPUT | RECOVERED_BUT_UNTRUSTED | TRUST_INFLATION_PREVENTED]
}
```

A status object missing `confidence_level` or `basis[]` must be rejected at API contract validation.

---

## Configuration Reference

The following parameters are deployment-configurable. Defaults apply when absent. All configuration changes are audit-logged.

| Parameter | Default | Unit | Description |
|---|---|---|---|
| heartbeat_window | 60 | seconds | Expected heartbeat interval; CONNECTED threshold |
| freshness_window | 2× heartbeat | seconds | CURRENT freshness boundary |
| expiry_window | 5× heartbeat | seconds | STALE/EXPIRED boundary |
| drift_tolerance | 2 | seconds | Clock sync maximum acceptable delta |
| assessment_timeout | 120 | seconds | Maximum time for ASSESSING readiness |
| escalation_window | 300 | seconds | DEGRADED → CRITICAL escalation time |
| verification_interval | 86400 | seconds | Maximum time between corpus hash checks |
| backdating_tolerance | 5 | seconds | Maximum clock drift for governed_timestamp creation |
