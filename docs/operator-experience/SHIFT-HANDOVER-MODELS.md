# Shift Handover Models

**Version:** 1.0
**Status:** Authoritative
**Scope:** Operational context transfer between operator shifts — requirements, format, audit protocol
**Related:** OPERATOR-MENTAL-LOAD.md, ALERT-FATIGUE-PREVENTION.md, TRAINING-AND-ONBOARDING.md

---

## Purpose

Shift handover is where operational continuity either holds or breaks. An outgoing operator who does not surface an active emergency, an expiring override, or an unresolved entropy alert leaves the incoming operator working with an incomplete operational picture. The incoming operator then either discovers the gap through failure ("the emergency content is still showing and I don't know why") or through an alert they were not warned about.

This is a preventable class of operational failure. The system must make complete, accurate handover the path of least resistance — easier to do correctly than to skip.

The handover model defined here establishes what information transfers between shifts, how it is structured by role, and how the audit trail ensures accountability for operational knowledge.

---

## 1. Handover Information Requirements

Regardless of role, every shift handover must transfer the following categories of operational context. These categories represent the complete set of information an incoming operator needs to take effective operational ownership.

### Category 1: Active Emergencies

**What transfers:** Any emergency override that is currently active.

**Required information:**
- Emergency type (venue emergency, regional emergency, compliance emergency)
- Which screens are affected
- Who triggered the emergency and at what time
- Why it was triggered (if documented — operators can add notes at trigger time)
- How long the emergency has been active
- Whether the emergency has a configured end condition or must be manually cleared

**Why this cannot be skipped:** An active emergency overrides all other content layers. An incoming operator who does not know an emergency is active may try to update content and be confused when their changes appear not to take effect. Worse, they may clear the emergency without understanding why it was triggered, restoring content that should remain overridden.

**Incoming operator acknowledgment required:** The incoming operator must explicitly acknowledge active emergencies in the handover report before gaining full publishing authority. This is not optional — it is a governance gate. The acknowledgment records: incoming operator identity, timestamp, and the specific emergencies acknowledged.

### Category 2: Unresolved Entropy Alerts

**What transfers:** Any entropy reports that have been received but not acknowledged or resolved.

**Required information:**
- Which venue/screen(s) affected
- Entropy severity level (ADVISORY / WARNING / CRITICAL)
- How long the entropy has been active (first detected)
- Whether a previous operator has started investigation
- Any notes the outgoing operator added to the entropy record

**Why this cannot be skipped:** Unresolved entropy alerts that are not handed over effectively disappear — the incoming operator sees a MEDIUM badge but has no context for why it is there or whether anything has been investigated. Entropy that has been present for 6 hours without investigation is more urgent than entropy that appeared 20 minutes ago. Age context changes the appropriate response.

### Category 3: Active Overrides with Upcoming Expiry

**What transfers:** All overrides currently active, with emphasis on those expiring within the next 8 hours.

**Required information:**
- Override scope (which screens)
- Override content (what is playing)
- Expiry time (exact datetime)
- Whether the expiry is intended (the operator who created it wanted it to expire) or needs renewal
- Who created the override and why (if documented)

**8-hour window rationale:** An 8-hour window covers a full shift plus buffer. An override expiring at 4am during a night shift needs to be known by the closing shift operator who may still be on duty. An override expiring at 10am during the day shift needs to be known by the opening operator.

**Expiry intent:** This is critical. An override that was intentionally set to expire at 2am is different from one that was created "temporarily" but where the operator forgot to set an expiry or set an inadvertently short window. The outgoing operator should mark expiry as "intended" or "review" to give the incoming operator appropriate context.

### Category 4: Pending Approvals

**What transfers:** Any content awaiting operator review or approval.

**Required information:**
- Campaigns awaiting review (name, submitter, how long pending)
- Canary promotions awaiting approval (if applicable to role)
- Any other approval actions that have been queued and not yet acted on

**Why this cannot be skipped:** Approvals have business consequences. A campaign that has been waiting for 36 hours for operator review may have a start time that is now in the past. An incoming operator who does not know a review is pending may not check the approval queue until they encounter other work.

### Category 5: Recent Incidents (Last 24 Hours)

**What transfers:** Any P1, P2, or P3 incidents that occurred in the last 24 hours, regardless of whether they are resolved.

**Required information:**
- Incident type and severity (P1/P2/P3)
- What happened (brief plain-language description)
- Current status (resolved, in progress, monitoring)
- Any follow-up actions that are outstanding
- Who the incident was escalated to (if applicable)

**Why resolved incidents transfer:** A resolved incident from 6 hours ago may have follow-up actions that have not been completed. The incoming operator needs to know the incident history to understand why they see certain actions in the audit log, whether follow-up is expected, and whether the system is still in a post-incident monitoring state.

### Category 6: Constitutional State

**What transfers:** The current constitutional state and, if not HEALTHY, the reason.

**Required information:**
- Current state (HEALTHY / DEGRADED / CONSTITUTIONAL_RISK / etc.)
- If not HEALTHY: what state the system is in, why it entered that state, how long it has been in that state
- Any actions the outgoing operator took regarding the state
- Who has been notified (if state is non-HEALTHY)

**Why this is always transferred, even when HEALTHY:** An incoming operator who does not know the constitutional state must spend their first minutes discovering it. Explicitly confirming "system is HEALTHY at handover" takes 2 seconds and removes that uncertainty.

---

## 2. Handover Format by Role

### VENUE_OPERATOR Handover

The venue operator handover is a single-venue report generated automatically by the system based on the operator's shift activity and current system state. The operator reviews and supplements it before the shift ends.

**Handover report structure (VENUE_OPERATOR):**

```
SHIFT HANDOVER — [Venue Name]
Outgoing: [Operator Name] | Shift: [start time] – [end time]
Generated: [timestamp]

CONSTITUTIONAL STATE
  Current: HEALTHY  (or non-HEALTHY with reason)

ACTIVE EMERGENCIES (N)
  [Emergency details if any, or "None"]

UNRESOLVED ENTROPY ALERTS (N)
  [Alert details if any, or "None"]

ACTIVE OVERRIDES — EXPIRING WITHIN 8 HOURS (N)
  [Override details if any, or "None"]

ALL ACTIVE OVERRIDES (N total)
  [Full list]

PENDING APPROVALS (N)
  [Approval items if any, or "None"]

RECENT INCIDENTS — LAST 24H (N)
  [Incident summaries if any, or "None"]

OPERATOR NOTES
  [Free text: anything the outgoing operator wants the incoming operator to know]

HANDOVER CONFIRMATION
  Outgoing operator confirms this report is complete and accurate: [checkbox]
```

The system generates all sections except "Operator Notes" automatically. The outgoing operator reviews, adds notes if needed, and confirms. The confirmation is a logged audit event.

**Generation on demand vs. at shift end:** Operators can generate the handover report at any time during their shift. They can generate it at shift end (most common) or earlier if they need to hand over mid-shift due to an emergency. The report always reflects current system state at generation time.

### REGIONAL_MANAGER Handover

The regional manager handover covers all venues in the region. It follows the same six categories but is aggregated.

**Key difference:** The regional handover report is a two-level document. The top level shows regional aggregates (how many venues have active emergencies, how many have entropy alerts). The second level shows per-venue drill-down for any category with non-zero entries.

A regional manager who oversees 15 venues with all venues HEALTHY and no alerts should have a short, clean handover report. A regional manager with 3 venues in DEGRADED state and 2 active emergencies has a substantive handover report with per-venue detail.

**Cross-venue patterns:** The regional handover includes a pattern summary: "3 venues are showing ADVISORY entropy related to the weekend promotional content — this appears to be a consistent regional pattern, not isolated incidents." This is qualitative operator knowledge that the system cannot auto-generate — it requires the outgoing regional manager's assessment.

### Enterprise Admin and Platform Admin Handover

Handover for these roles follows the same structure but with fleet-level scope. Enterprise admin handover includes:
- Fleet constitutional state summary
- Canary promotion status and any pending approvals
- Active fleet-level governance decisions
- Any CONSTITUTIONAL_RISK or higher states at any venue

Platform admin handover is less frequent (these roles are not typically shift-based) but is required when a PLATFORM_ADMIN is transitioning coverage responsibility (e.g., on-call rotation change, extended leave).

---

## 3. Handover Audit Protocol

### Immutable Handover Log

Every handover report generation and confirmation is logged as an immutable audit event:

- Who generated the report (outgoing operator, identity)
- Timestamp of generation
- System state at generation (constitutional state, all six categories captured at that moment)
- Whether the outgoing operator confirmed the report
- Who acknowledged the handover (incoming operator, if applicable)
- Timestamp of incoming operator acknowledgment

The handover audit log cannot be modified after creation. If the outgoing operator generated a report that was incorrect, the error is visible in the subsequent incident or audit review — not hidden.

### Incoming Operator Acknowledgment

For emergencies and constitutional states that are not HEALTHY, the incoming operator must explicitly acknowledge in the system before their first publishing action. This is not a soft prompt — it is a governance gate on publishing authority.

**What acknowledgment means:** By acknowledging the handover, the incoming operator confirms they have seen the emergency, alert, or state information. They cannot later claim they were unaware of an active emergency that was in the handover report they acknowledged.

This is not punitive. It is an acknowledgment that operational accountability transfers with the shift. The incoming operator who acknowledges an active emergency becomes the accountable operator for decisions made about that emergency during their shift.

### Emergency Acceptance

For active emergencies specifically, acknowledgment is an explicit "accept" action rather than a passive "I've read this" confirmation. The UI presents:

> "There is an active emergency override at [venue]. Triggered by [outgoing operator] at [time]. Reason: [if documented]. This emergency is still active. Do you accept operational responsibility for this emergency? [Accept] [Escalate to Regional Manager]"

The incoming operator chooses between accepting responsibility (and becoming the accountable operator for the emergency) or escalating to the regional manager. They cannot dismiss the prompt without choosing. If they choose "Escalate," the regional manager receives an immediate alert.

---

## 4. Operational Continuity Guarantees

### State Persists Across Shifts

The system makes no state transitions based on shift changes. An emergency active at the end of one shift is active at the start of the next. An override created at 11pm by the closing shift is still active at 7am when the opening shift arrives. Operational state is not shift-scoped.

This is sometimes counterintuitive for operators who expect the "new shift" to bring a clean slate. The training material (see TRAINING-AND-ONBOARDING.md) must address this explicitly. The system does not reset at shift boundaries. The handover is the continuity mechanism — the system just preserves state.

### Incoming Operator Event History

When an incoming operator logs in, they can view the complete event history for the period since their last shift ended. This covers: what content played, what alerts fired, what actions were taken, and what state the system was in. The incoming operator does not depend solely on the handover report — the full audit record is available.

This is a trust feature: operators can verify the handover report against the audit log. If the outgoing operator said "no incidents" but the audit log shows a P3 incident that was resolved quickly and not documented, the incoming operator can see it.

### Override Expiry Visibility for Incoming Operator

Upon login, overrides expiring within the next 8 hours are surfaced immediately in the incoming operator's dashboard — not buried in the handover report. This is a Tier 1 operational concern: an operator logging in at 6am should immediately see that an override expires at 8am, regardless of whether the handover report surfaced it prominently.

---

## 5. On-Call and Out-of-Hours Coverage

### On-Call Designation

Every venue has a designated on-call operator for out-of-hours periods. The on-call designation is:
- Visible to all operators for that venue (they know who is on call tonight)
- Visible to the REGIONAL_MANAGER (for escalation without looking up contact details)
- Stored in the system, not just on a paper rota

### On-Call Alert Routing

During unmanned hours:
- CRITICAL alerts for the venue are routed to the on-call VENUE_OPERATOR
- If the on-call VENUE_OPERATOR does not acknowledge within 15 minutes, the alert escalates to the REGIONAL_MANAGER
- CRITICAL alerts are never silenced by time-of-day settings

### On-Call Handover

When on-call coverage changes (e.g., nightly rotation), the system generates an on-call handover report identical in structure to the shift handover report. The outgoing on-call operator (even if they were not on-site and had no events during their coverage) confirms the handover.

If the outgoing on-call period had no events, the handover report is short: all categories show "None." This is still generated and confirmed. The habit of confirming handover must not be contingent on whether anything happened.

### Escalation Path Documentation

The escalation path — VENUE_OPERATOR → REGIONAL_MANAGER → ENTERPRISE_ADMIN → PLATFORM_ADMIN — must be visible to every operator in the interface at all times. Not in a settings menu. Not in a help page. In the persistent UI chrome, accessible in one click from any view.

During an active incident or non-HEALTHY constitutional state, the escalation path for that specific state is surfaced in the state explanation banner. Operators do not need to remember the escalation chain under stress — the system tells them who to call.

---

## 6. Known Failure Modes in Handover

These failure modes have been identified as common operational risks. Training and system design must address them.

**Outgoing operator rushes the handover.** The outgoing operator is at the end of their shift, tired, and eager to leave. They confirm the handover report without reviewing it carefully. Mitigation: the system requires acknowledgment of each non-zero category separately (not a single "confirm all" button). The incoming operator also has access to the audit log for independent verification.

**Incoming operator dismisses the handover without reading it.** The incoming operator is in a hurry to start their shift and clicks through the handover confirmation without reading. Mitigation: emergencies and non-HEALTHY states require specific acknowledgment text that names the specific event (cannot be passed by clicking a generic confirm button).

**Handover report is accurate at generation but the situation changes.** The outgoing operator generated the handover at 5:30pm; the shift ends at 6pm; a CRITICAL alert fires at 5:55pm. The handover report does not include it. Mitigation: the incoming operator's dashboard shows current system state independently of the handover report. The handover report is a snapshot; current state is always live.

**On-call contact information is out of date.** The designated on-call operator is listed in the system but has changed their contact information. Mitigation: on-call contact information must be validated (by the operator themselves) at least monthly. Stale contact information is flagged as an operational risk and surfaced to the REGIONAL_MANAGER.
