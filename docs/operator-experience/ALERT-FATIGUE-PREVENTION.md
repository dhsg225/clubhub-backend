# Alert Fatigue Prevention

**Version:** 1.0
**Status:** Authoritative
**Scope:** Alerting model for all operator roles — taxonomy, delivery, deduplication, actionability
**Related:** OPERATOR-MENTAL-LOAD.md, LOW-CONFIDENCE-STATE-HANDLING.md

---

## Purpose

Alert fatigue is not a minor inconvenience — it is a safety failure. When operators receive too many alerts, too frequently, or without clear action paths, they begin to suppress alerts habitually. The alert that gets ignored because of habituation is statistically the one that matters most.

This document defines the alerting model that prevents alert fatigue without hiding critical signals. The tension between "don't miss anything important" and "don't cry wolf" is resolved by strict alert classification, mandatory action paths, role-scoped delivery, and aggressive deduplication.

The system does not alert unless it has something actionable to say.

---

## 1. Alert Taxonomy

Alerts are classified into five levels. The classification determines interrupt behavior, delivery mechanism, and expected response time.

### CRITICAL — Act Now

CRITICAL alerts interrupt the operator immediately. They represent events that require a response within minutes. In a venue environment, this means push notification and, where the venue management hardware supports it, an audio or visual interrupt.

**Events classified as CRITICAL:**

| Event | Constitutional Significance |
|---|---|
| CLASS_4 divergence detected | ReplayCircuitBreaker threshold=1 — immediate constitutional breach |
| EMERGENCY_FREEZE state entered | Global constitutional breaker tripped; all mutations halted |
| Replay nondeterminism detected | PRE produced different output for identical inputs; constitutional invariant violated |
| Compliance content failure | Regulated content required by contract or law failed to play during its required window |
| READ_ONLY state entered | ConstitutionalBreaker tripped; no mutations possible; PLATFORM_ADMIN required |
| Circuit breaker OPEN: PRECircuitBreaker | PRE failed 3 consecutive times; now bypassed; system serving legacy only |

**Delivery:** Push notification regardless of whether operator is in the application. If an operator has the mobile app, it wakes the device. CRITICAL alerts are never silenced by time-of-day settings.

**Response expectation:** Within 5–10 minutes from delivery.

---

### HIGH — Act Today

HIGH alerts require attention within the current shift. They are surfaced prominently in the dashboard but do not interrupt outside the application. An operator who logs in after receiving a HIGH alert sees it immediately upon arrival.

**Events classified as HIGH:**

| Event | Constitutional Significance |
|---|---|
| CLASS_3 divergence detected | Shadow parity broken above tolerance; CONSTITUTIONAL_RISK state may be imminent |
| CRITICAL entropy severity | Corpus drift exceeds warning threshold; content accuracy risk |
| PRECircuitBreaker state: HALF_OPEN | PRE returning after failure; recovery probe in progress; watch for re-failure |
| Screen offline >30 minutes | Venue display loss beyond tolerance for normal network interruption |
| DEGRADED state entered | One or more subsystems degraded; system still operational |
| Canary parity dropping: threshold warning | Parity ratio declining trend across current canary stage; may prevent promotion |

**Delivery:** Dashboard badge with prominent visual indicator. No push notification unless the operator has configured opt-in for HIGH alerts (recommended only for on-call operators). Visible immediately on login.

**Response expectation:** Before end of current shift.

---

### MEDIUM — Act This Week

MEDIUM alerts represent situations that need attention but are not operationally urgent. They appear as dashboard badges and are included in the operator's end-of-shift review, but they do not interrupt workflow.

**Events classified as MEDIUM:**

| Event | Constitutional Significance |
|---|---|
| WARNING entropy severity | Corpus drift within warning range; trending toward critical |
| CLASS_2 divergence pattern | Multiple CLASS_2 divergences observed; may indicate systematic difference |
| Canary parity dropping: early warning | Parity ratio trend declining but above threshold; early signal |
| Override expiring within 8 hours | Active override approaching unattended expiry |
| Pending campaign review > 48 hours | Campaign awaiting operator approval for extended period |
| Screen offline 5–30 minutes | Network interruption within normal recovery range |

**Delivery:** Dashboard badge. No push notification. Included in handover report.

**Response expectation:** Within 24–72 hours.

---

### LOW — Informational

LOW alerts are informational signals that may be relevant but require no immediate or near-term action. They appear in the dashboard for operators who review them but generate no badges or notifications.

**Events classified as LOW:**

| Event | Notes |
|---|---|
| ADVISORY entropy severity | Drift within advisory range; monitoring only |
| CLASS_1 divergence | Non-semantic field difference; does not affect content |
| Screen offline < 5 minutes | Within expected intermittent range |
| Preview session completed | Operator previewed content; confirmation only |
| Canary stage dwell time warning | Stage has been running longer than typical; informational only |
| Override acknowledged | Incoming operator accepted handover acknowledgment |

**Delivery:** Available in dashboard alert history. No badge. No notification.

**Response expectation:** Operator discretion.

---

### OPERATIONAL — Logged Only

Operational events are system activity records, not alerts. They are logged for audit and forensic replay purposes but generate no user-facing notification of any kind.

**Events classified as OPERATIONAL:**

| Event | Why No Notification |
|---|---|
| CLASS_0 divergence | Insignificant difference; within acceptable threshold |
| Successful PRE.resolve() invocations | Expected normal operation |
| Normal shadow comparisons (parity maintained) | System doing what it should |
| Scheduled content transitions | Normal schedule execution |
| Entropy report generated (no deviation) | Routine monitoring output |
| Audit log write | Record-keeping; not an event |

Operational events appearing in operator alert views is a failure mode. They create visual noise that trains operators to ignore the alert feed.

---

## 2. Alert Delivery by Role

Each role receives alerts scoped to their operational domain. An alert that is delivered to the wrong role creates noise for that role and may create a false impression that the right role has been notified.

### VENUE_OPERATOR Alert Delivery

Venue operators receive only alerts scoped to their venue. They do not receive alerts about other venues, fleet-level canary events, or system-wide governance decisions.

| Level | Delivery Method |
|---|---|
| CRITICAL | Push notification + persistent dashboard banner |
| HIGH | Dashboard banner on login + badge |
| MEDIUM | Dashboard badge |
| LOW | Available in alert history on request |
| OPERATIONAL | Not delivered; logged only |

Exception: a CRITICAL alert for an event the venue operator cannot act on alone (e.g., READ_ONLY state, EMERGENCY_FREEZE) must still be delivered with clear instruction to contact the escalation path — not because the operator can resolve it, but because they need to know their system is halted.

### REGIONAL_MANAGER Alert Delivery

Regional managers receive alerts aggregated across their region. Individual venue CRITICAL alerts are escalated to the regional manager if the venue operator has not acknowledged within 15 minutes (configurable).

| Level | Delivery Method |
|---|---|
| CRITICAL (any venue in region) | Push notification with venue identification |
| HIGH (regional aggregate) | Dashboard banner with per-venue drill-down |
| HIGH (individual venue, unacknowledged > 2h) | Escalated to regional manager feed |
| MEDIUM (regional trend) | Dashboard badge with regional aggregate view |
| LOW | Regional dashboard alert history |

Regional managers should see the regional entropy aggregate (average entropy across region, count of venues at each severity level) rather than per-venue entropy alerts for every venue — that would be proportional to the number of venues and quickly become noise.

### ENTERPRISE_ADMIN Alert Delivery

Enterprise admins receive fleet-level alerts and governance events. They do not receive individual venue operational alerts unless they escalate to the fleet level.

| Level | Delivery Method |
|---|---|
| CRITICAL (fleet-wide or constitutional) | Push notification |
| HIGH (canary governance, fleet entropy trend) | Dashboard banner |
| HIGH (regional escalation unacknowledged > 4h) | Escalated to enterprise admin feed |
| MEDIUM (parity trend, canary dwell) | Dashboard badge |
| Canary promotion pending approval | Dedicated prompt in governance dashboard |

### PLATFORM_ADMIN Alert Delivery

Platform admins receive all constitutional alerts regardless of scope. This role is the system's backstop — when something reaches platform admin, it is genuinely serious.

| Level | Delivery Method |
|---|---|
| CRITICAL (any) | Push notification, all venues |
| Circuit breaker OPEN (any) | Push notification |
| EMERGENCY_FREEZE (any venue) | Push notification |
| Replay nondeterminism (any) | Push notification |
| Constitutional state transition | Push notification for any non-HEALTHY state entry |

Platform admins should configure direct escalation paths (pager, SMS, or equivalent) for CRITICAL alerts. The application delivery mechanism alone is insufficient for events requiring response within minutes.

---

## 3. Alert Deduplication Rules

The system must deduplicate alerts aggressively. Without deduplication, a fleet-wide entropy event generates one alert per affected screen per check interval — potentially hundreds of notifications for a single underlying cause.

### Entropy Event Deduplication

**Rule:** One entropy alert per venue per 4-hour window, regardless of the number of affected screens within that venue.

**Rationale:** Entropy is a venue-level condition. If 12 screens at one venue all have content drift from the same source event, this is one problem at one venue. Alerting 12 times trains operators to ignore entropy alerts.

**Exception:** If entropy severity increases within the deduplication window (e.g., from WARNING to CRITICAL), a new alert is issued immediately for the severity change. Deduplication does not suppress severity escalation.

**Regional aggregation:** If three or more venues in a region cross the same entropy threshold within a 1-hour window, the regional manager receives one regional alert rather than three venue alerts.

### Circuit Breaker Event Deduplication

**Rule:** One alert when circuit breaker state changes to OPEN; one alert when it returns to CLOSED. No per-invocation alerts.

**Rationale:** A circuit breaker tripping means a subsystem has failed repeatedly. Alerting on each failed invocation (which may be thousands per minute) is catastrophically noisy. The operator needs to know the breaker is open and when it closes.

**HALF_OPEN:** When a circuit breaker enters HALF_OPEN (recovery probe), a single alert is issued: "PRE circuit breaker is recovering. Monitoring probe in progress."

### Shadow Divergence Deduplication

**Rule:** Aggregate shadow divergences by divergence class, per venue, per hour. One alert per class per hour (e.g., one "CLASS_2 divergences observed" per hour, not one per comparison).

**Rationale:** The shadow runner compares every PRE invocation against legacy output. At scale, this is thousands of comparisons. Individual comparison alerts are not actionable — the operator needs the aggregate picture.

**CLASS_3 and CLASS_4 exception:** CLASS_3 and CLASS_4 divergences are never deduplicated. Each CLASS_3 or CLASS_4 event is individually logged and immediately surfaced. These are constitutional events, not operational noise.

### Canary Stage Events

**Rule:** One alert when a canary stage transition occurs; one alert when human approval is required. Not per-venue within a stage.

**If approval has been pending > 24 hours:** Re-alert once. Do not re-alert repeatedly.

---

## 4. Alert Actionability Requirements

An alert that does not tell the operator what to do has failed. Every alert delivered to an operator must include the information needed to take the first action.

### CRITICAL Alert Content Requirements

Every CRITICAL alert must contain:

1. **What happened** — specific event, not category. Not "circuit breaker event" but "PRE circuit breaker opened after 3 consecutive failures. PRE is now bypassed."
2. **Which system / venue / screen** — exact scope. Not "a venue" but the venue name and, where applicable, which specific screens or subsystems.
3. **What to do now (first action)** — the specific first step. Not "contact your administrator" but "Open the circuit breaker status page. Verify legacy resolver is serving content. Contact PLATFORM_ADMIN at [configured contact]."
4. **Who to notify** — the escalation path relevant to this event type.
5. **Link to relevant entity** — clicking the alert opens the directly affected entity: clicking an entropy alert opens the entropy report for that venue; clicking a circuit breaker alert opens the circuit breaker status view.

### HIGH Alert Content Requirements

Every HIGH alert must contain:

1. **What is wrong** — specific condition
2. **Severity trend** — is this improving or worsening? (e.g., "Parity ratio declining over last 2 hours: 0.9999 → 0.9991")
3. **Recommended action** — what the operator should do during their shift
4. **Link to relevant entity**

### MEDIUM Alert Content Requirements

Every MEDIUM alert must contain:

1. **What requires attention**
2. **Impact if not addressed** — what happens if this is ignored through the current response window
3. **Suggested action**
4. **Link to relevant entity**

### LOW Alert Content Requirements

LOW alerts are informational. They must be readable, specific, and non-alarming. They do not require a recommended action but may link to relevant context.

---

## 5. Anti-Patterns to Actively Avoid

These patterns have been documented as causes of alert fatigue in operational systems. They are forbidden in the ClubHub TV alerting model.

### Vague Alert Text

**Forbidden:** "The system had some issues with content delivery."
**Required:** "Screen 'Bar Area Display' at Venue 'The Crown' has been offline for 35 minutes. Last contact: 14:22. Expected content: promotional_rotation_v3."

Vague alerts cannot be acted on. They create anxiety without resolution. They cause operators to dismiss alerts as noise.

### Duplicate Alerts from the Same Underlying Event

**Forbidden:** 12 screen offline alerts because 12 screens at one venue lost connectivity to the same network switch.
**Required:** One alert: "Network connectivity lost to all 12 screens at Venue 'The Crown'. Possible upstream network issue. Check venue networking."

One alert for one cause. The deduplication rules in section 3 exist to enforce this.

### Alerts Without Action Paths

**Forbidden:** "CONSTITUTIONAL_RISK state detected."
**Required:** "CONSTITUTIONAL_RISK state detected at Venue 'The Crown'. Cause: CLASS_3 divergence between PRE and legacy resolver at 14:35. Canary promotion is blocked. Recommended action: Open the parity divergence report and review the divergence detail. Contact ENTERPRISE_ADMIN if the divergence is unexpected."

### Alerts Sent to the Wrong Role Level

**Forbidden:** Sending fleet-wide canary parity alerts to VENUE_OPERATORs.
**Forbidden:** Not sending CRITICAL venue alerts to REGIONAL_MANAGER when venue operator is unresponsive.
**Required:** Alerts are scoped to the role that can act on them, with escalation to higher roles when action is not taken within the expected response window.

### Informational Noise Masking Actionable Alerts

**Forbidden:** Mixing CLASS_0 divergence records with CLASS_3 divergence alerts in the same feed.
**Required:** Operational events (CLASS_0, successful invocations, normal shadow comparisons) are logged but never surfaced in the alert feed. The alert feed contains only events that require attention.

---

## 6. Operator-Specific Alert Tuning

### VENUE_OPERATOR: Entropy Suppression

A VENUE_OPERATOR can suppress ADVISORY entropy notifications for a venue if they have explicitly acknowledged that certain content deviations are acceptable for their venue (e.g., a venue that regularly runs custom content that diverges from the regional baseline).

**Requirements:**
- Suppression requires an explicit acknowledgment action (not a passive setting)
- The acknowledgment is logged as an audit event
- Suppression applies to ADVISORY severity only — WARNING and CRITICAL entropy cannot be suppressed by a venue operator
- Suppression can be set for a maximum of 7 days; it must be renewed intentionally
- The entropy report continues to generate and is accessible; suppression affects notification delivery only, not logging

### ENTERPRISE_ADMIN: Aggregate vs. Individual Venue Alerts

For fleet-scale operations, an enterprise admin can configure whether they receive per-venue HIGH alerts or aggregate regional alerts.

**Default:** Aggregate regional view. Individual venue HIGH alerts appear in regional roll-up.
**Opt-in:** Individual venue HIGH alerts for specific venues (e.g., pilot venues under active observation).

This configuration is available for HIGH and MEDIUM levels only. CRITICAL alerts are never aggregated — each CRITICAL event is surfaced individually regardless of configuration.

---

## 7. Alert System Health Monitoring

The alert system itself must be monitored. Alerting failures can be more dangerous than the events they were meant to surface.

Metrics to track:
- **Alert volume by level per 24 hours** — sudden spikes indicate a deduplication failure or a genuine fleet-wide event
- **Acknowledgment rate by level** — LOW acknowledgment on CRITICAL alerts indicates operator inattention or alert fatigue
- **Time-to-acknowledge by level** — average time from CRITICAL delivery to operator acknowledgment; should be <15 minutes
- **Escalation rate** — how often venue-level CRITICAL alerts escalate to regional manager due to non-acknowledgment; high rates indicate venue-level staffing gaps

If CRITICAL alert acknowledgment time exceeds 30 minutes on average, the alerting model has failed and must be reviewed. Operators are not the failure — the system is.
