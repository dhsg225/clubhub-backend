# Incident Recovery Workflows

**Document type:** Operational workflow specification
**Audience:** All operator roles (awareness), REGIONAL_MANAGER+ (P2-P3 response), PLATFORM_ADMIN (P1 response), platform engineers
**Depends on:** CLUBHUB_SYSTEM_CONTRACTS.md, EMERGENCY-LIFECYCLE.md, ENTROPY-REVIEW-WORKFLOWS.md, CONSTITUTIONAL-FREEZE-PROCEDURES.md, REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Incident Classification

ClubHub TV incidents are classified by severity, which maps directly to the platform's failure class taxonomy. Every incident response action references a priority level (P-level) and the corresponding failure class.

| Priority | Failure Class | Description                                                              | Auto-response                          |
|----------|---------------|--------------------------------------------------------------------------|----------------------------------------|
| P1       | CLASS_4       | Catastrophic — system-wide impact, PRE halted, constitutional breach     | EMERGENCY_FREEZE                       |
| P2       | CLASS_3       | Constitutional risk — deploy blocked, canary frozen                      | PRE_DISABLED (affected group)          |
| P3       | CLASS_2       | Degraded — operator notification, heightened monitoring, no auto-block   | DEGRADED state for affected venue(s)  |
| P4       | CLASS_1       | Tolerated divergence — logged, monitored, no operator action required   | Logged only                            |
| P5       | CLASS_0       | Normal operation — within all thresholds                                 | None                                   |

**P1 is reserved for constitutional events.** A venue going dark or a campaign failing to resolve is not P1 — it is P2 or P3 depending on scope. P1 means the platform's constitutional guarantees have been violated (nondeterminism detected, circuit breaker in EMERGENCY_FREEZE, CLASS_4 detection).

---

## 2. Incident Detection Sources

| Source                       | Typical Priority | Notes                                                                             |
|------------------------------|------------------|-----------------------------------------------------------------------------------|
| ReplayCircuitBreaker open    | P1               | Any single replay nondeterminism event. Automatic EMERGENCY_FREEZE.              |
| GlobalConstitutionalBreaker  | P1               | Extended CLASS_3 state escalates to EMERGENCY_FREEZE.                            |
| CLASS_4 system detection     | P1               | Automatic platform-wide halt.                                                    |
| CLASS_3 shadow divergence    | P2               | PRE output divergence from legacy at constitutional threshold.                   |
| Entropy — CRITICAL (unack.)  | P2               | CRITICAL entropy unacknowledged beyond SLA.                                      |
| PRECircuitBreaker trip       | P2               | Three threshold events in 24h for same venue.                                    |
| CLASS_2 shadow divergence    | P3               | PRE parity below threshold but above CLASS_3 floor.                              |
| Entropy — WARNING            | P3               | WARNING entropy report for venue.                                                |
| Operator report              | P3 or P2         | Operator observes on-site content problem; classified on investigation.          |
| Replay audit failure         | P2 or P1         | Depends on whether nondeterminism is detected or replay integrity check fails.   |
| CLASS_1 shadow divergence    | P4               | Within tolerated threshold; logged automatically.                                |

Detection is primarily automated. Operator-reported incidents are classified after initial triage by REGIONAL_MANAGER+. An operator cannot classify an incident as P1 — P1 classification is automatic from system triggers or requires PLATFORM_ADMIN confirmation.

---

## 3. P1 Response: EMERGENCY_FREEZE

### 3.1 Automatic Entry

P1 incidents trigger EMERGENCY_FREEZE automatically. No human action is required to enter the freeze state. The automatic entry mechanisms are:
- ReplayCircuitBreaker opens (threshold=1: one replay nondeterminism event)
- GlobalConstitutionalBreaker escalates from READ_ONLY or CONSTITUTIONAL_RISK to EMERGENCY_FREEZE after sustained CLASS_3 condition
- CLASS_4 detection from any platform monitoring path

When EMERGENCY_FREEZE is entered:
1. All PRE invocations halted immediately
2. All screens fall back to device-local last-known-good playlist (L6 cache)
3. All mutation operations rejected with `CONSTITUTIONAL_FREEZE` error
4. PLATFORM_ADMIN receives immediate notification (all channels)
5. ConstitutionalFreezeLog entry written with `trigger_source`, `trigger_timestamp`, `trigger_detail`
6. All ENTERPRISE_ADMINs receive notification: "Platform in constitutional freeze. No operational changes possible. Contact your PLATFORM_ADMIN."

### 3.2 Human Assessment

**Actor:** PLATFORM_ADMIN only

The PLATFORM_ADMIN must:
1. Acknowledge the freeze (confirms they are aware and leading response)
2. Review ConstitutionalFreezeLog to understand trigger sequence
3. Review replay audit for the nondeterminism event that triggered the freeze
4. Determine root cause category:
   - Corpus integrity failure (assets corrupted, checksums wrong)
   - PRE implementation bug (code-level nondeterminism)
   - Infrastructure failure (clocks diverged, database split-brain)
   - External data corruption (third-party data feed caused corpus divergence)

### 3.3 Constitutional Reset

Full exit procedure is documented in CONSTITUTIONAL-FREEZE-PROCEDURES.md. Summary:

The reset sequence is strictly ordered and cannot be abbreviated:
1. Root cause identified and documented
2. `GlobalConstitutionalBreaker.reset(humanAuthorizationToken)` called
3. System transitions to READ_ONLY
4. Full integrity suite run (validate-contracts, full-stack-determinism, constitutional-boundary-check)
5. All gates pass: PLATFORM_ADMIN approves READ_ONLY → HEALTHY
6. Entropy re-scan across affected venues
7. Canary stage reset to SHADOW_ONLY for affected deployment groups
8. Post-freeze review within 24h

---

## 4. P2 Response: Constitutional Risk

### 4.1 Auto-Response

On P2 detection:
1. PRE_DISABLED constitutional state for the affected deployment group
2. If in canary/shadow stage: canary stage frozen at current position (no advancement, no regression — held in place)
3. ENTERPRISE_ADMIN notified immediately
4. REGIONAL_MANAGER notified if P2 originated in their region

PRE_DISABLED means PRE.resolve() is not called for screens in the affected group. Screens display last-resolved playlist (from before the P2 event). No new content changes go through PRE until the P2 is resolved.

### 4.2 Human Review Required

**Actor:** REGIONAL_MANAGER as incident commander; ENTERPRISE_ADMIN for authorization decisions; PLATFORM_ADMIN if P2 may escalate to P1

Steps:
1. REGIONAL_MANAGER assumes incident commander role: acknowledges P2 incident, begins investigation
2. Reviews CLASS_3 shadow divergence or CRITICAL entropy report that triggered P2
3. Determines whether divergence is:
   - PRE resolution bug: engineering investigation required; P2 held until fix deployed
   - Corpus delivery failure: CORPUS_ROLLBACK or ASSET_RESYNC path (see ENTROPY-REVIEW-WORKFLOWS.md)
   - Configuration error: ENTERPRISE_ADMIN corrects configuration; PRE re-enabled after verification
   - Canary content failure: ENTERPRISE_ADMIN authorizes canary rollback

### 4.3 Canary Rollback (P2 in Canary Stage)

If the P2 event occurred during a canary stage:
1. ENTERPRISE_ADMIN authorizes rollback to SHADOW_ONLY
2. Canary stage reset for the affected deployment group
3. Legacy content resumes for all screens in the group
4. P2 incident remains open until root cause is identified and a new canary advancement plan is approved

### 4.4 PRE Re-enablement

PRE_DISABLED is not automatically exited. A human must:
1. Confirm root cause is identified and resolved (or that continuing in PRE_DISABLED is the chosen path)
2. Run post-P2 verification (see §7)
3. ENTERPRISE_ADMIN approves PRE re-enable for the affected group
4. System transitions from PRE_DISABLED back to appropriate state (SHADOW_ONLY if in canary, HEALTHY if fully operational)

---

## 5. P3 Response: Degraded

### 5.1 Auto-Response

On P3 detection:
1. DEGRADED constitutional state for the affected venue(s)
2. Monitoring frequency increased (entropy scans run every 15 minutes instead of 60)
3. REGIONAL_MANAGER and VENUE_OPERATOR notified

No automatic halt to PRE. PRE continues to resolve content, but the system is flagged and monitoring is heightened.

### 5.2 Operator Response

**Actor:** VENUE_OPERATOR (initial triage); REGIONAL_MANAGER (incident commander for P3)

Steps:
1. VENUE_OPERATOR reports current on-site conditions (if operator-reported) or confirms automated alert
2. REGIONAL_MANAGER reviews entropy report and/or CLASS_2 shadow divergence data
3. If entropy-related: follow ENTROPY-REVIEW-WORKFLOWS.md resolution paths
4. If shadow divergence-related: review PRE vs. legacy comparison for the affected screens and time window
5. Determine whether P3 is trending toward P2 (escalate) or can be resolved at P3 level
6. If ASSET_RESYNC or CORPUS_ROLLBACK resolves the issue: run post-P3 verification (§7.3), transition DEGRADED → HEALTHY
7. If issue not resolved within 4 hours: escalate to P2 assessment

### 5.3 Heightened Monitoring Period

After P3 resolution, the venue remains in heightened monitoring for 24 hours:
- Entropy scans every 15 minutes (continuing from incident period)
- Any new CRITICAL or WARNING entropy in this window triggers immediate P2 assessment

After 24 hours without new alerts, monitoring returns to normal intervals.

---

## 6. Incident Commander Role

### 6.1 P1 Incident Commander

**Actor:** PLATFORM_ADMIN only

The PLATFORM_ADMIN is always the incident commander for P1. There is no delegation. If the PLATFORM_ADMIN is unreachable, the system remains in EMERGENCY_FREEZE until a PLATFORM_ADMIN is available. This is by design — EMERGENCY_FREEZE has zero automatic exits.

### 6.2 P2 Incident Commander

**Actor:** REGIONAL_MANAGER+ (ENTERPRISE_ADMIN may assume the commander role for cross-region P2 events)

Incident commander responsibilities:
- Acknowledges the incident (starts the formal response record)
- Coordinates investigation across relevant teams
- Makes or escalates decisions on resolution path
- Authorizes PRE re-enablement (or escalates to ENTERPRISE_ADMIN)
- Confirms recovery verification completion
- Signs off on post-incident report

Incident commander is a role, not just a notification. The person who assumes the role is accountable for the incident resolution. This accountability is recorded in the incident audit record.

### 6.3 P3 Incident Commander

**Actor:** REGIONAL_MANAGER (for region-scoped P3); VENUE_OPERATOR may handle with REGIONAL_MANAGER oversight for simple entropy-caused P3

For P3 incidents caused by entropy, the VENUE_OPERATOR can execute the resolution (ASSET_RESYNC) and the REGIONAL_MANAGER monitors. The REGIONAL_MANAGER is the commander but can delegate tactical execution.

---

## 7. Recovery Verification

Recovery verification is mandatory before any downgrading constitutional state transition (e.g., DEGRADED → HEALTHY, PRE_DISABLED → SHADOW_ONLY, READ_ONLY → HEALTHY). It is not optional and cannot be waived by any role.

### 7.1 Return-to-Healthy Checklist

All of the following must be confirmed before DEGRADED or PRE_DISABLED transitions to HEALTHY:

| Check                                | Description                                                                          |
|--------------------------------------|--------------------------------------------------------------------------------------|
| Root cause documented                | Incident record has a confirmed root cause, not "unknown"                           |
| PRE parity verified                  | 5 independent PRE invocations for same input produce identical output (determinism) |
| Entropy re-scan clean                | No CRITICAL or WARNING entropy reports for any affected venue                       |
| Replay audit integrity confirmed     | hash-chain integrity check passes for audit records during incident window          |
| No active CLASS_3+ shadow divergence | Shadow comparison showing clean parity for affected deployment group                |
| ENTERPRISE_ADMIN sign-off            | For P2; PLATFORM_ADMIN sign-off for P1                                             |

Only when all six checks are confirmed does the system permit the HEALTHY state transition.

### 7.2 P1 (EMERGENCY_FREEZE) Recovery Verification

Recovery verification for P1 is the full procedure in CONSTITUTIONAL-FREEZE-PROCEDURES.md. The checklist above is a subset. The constitutional procedure adds:
- Full integrity suite execution (validate-contracts.ts, full-stack-determinism.ts, constitutional-boundary-check.ts)
- Canary reset for all affected deployment groups
- Post-freeze review within 24 hours

### 7.3 P3 Recovery Verification

Lighter-weight verification for P3:
1. Entropy re-scan shows zero CRITICAL entropy for affected venues
2. PRE parity: 3 independent invocations for affected screens all match (reduced from 5 for P3)
3. REGIONAL_MANAGER confirms resolution

No ENTERPRISE_ADMIN sign-off required for P3 recovery.

---

## 8. Replay Audit in Incident Recovery

Every incident response action is recorded in the replay audit log. This has two operational implications:

**During investigation:** The replay audit provides a complete timeline of system events leading to the incident. An investigator can reconstruct exactly what PRE was resolving, which overrides were active, which campaigns were running, and what the entropy state was at any point before and during the incident.

**During post-incident review:** The replay audit is the evidence base for the post-incident report. Root cause analysis draws directly from audit records rather than from operator recollection. This makes root cause analysis objective and reproducible.

The replay audit's immutability means incident investigators cannot alter the record to conceal errors. The hash-chain ensures any tampering attempt is detectable. This is a constitutional guarantee.

---

## 9. Post-Incident Review

### 9.1 P1 (Mandatory)

**Actor:** PLATFORM_ADMIN (authors); ENTERPRISE_ADMINs (review and sign-off)
**Deadline:** Within 24 hours of EMERGENCY_FREEZE exit

Required sections:
- Timeline of events from first trigger to full recovery
- Root cause (specific, not general — "corpus checksum failure in asset X due to Y" not "corpus issue")
- What the platform's automatic response did and whether it was appropriate
- What human decisions were made and when
- Impact: affected screens, venues, duration, sponsor SOV impact, compliance gaps during freeze
- Constitutional review: did any constitutional guarantee fail? If so, which one and how?
- Prevention plan: specific changes to prevent recurrence (code, process, monitoring, or all three)
- Incident report signed by PLATFORM_ADMIN and at least one ENTERPRISE_ADMIN

### 9.2 P2 (Mandatory)

**Actor:** REGIONAL_MANAGER (authors); ENTERPRISE_ADMIN (sign-off)
**Deadline:** Within 48 hours of PRE_DISABLED exit

Required sections: Timeline, root cause, impact, resolution steps, prevention plan. No formal constitutional review required unless the P2 was near the P1 threshold.

### 9.3 P3 (Recommended)

P3 incidents do not require a formal post-incident report, but REGIONAL_MANAGER should document the incident in the operational log for pattern recognition. Three P3 incidents with the same root cause pattern within 30 days auto-escalates the pattern to a P2-severity review.

---

## 10. Incident Audit Record Reference

| Event                          | Emitted At                       | Required Fields                                                             |
|--------------------------------|----------------------------------|-----------------------------------------------------------------------------|
| `incident.declared`            | Detection or manual declaration  | incident_id, priority, class, detection_source, declared_at                |
| `incident.commander_assigned`  | Commander assumes role           | incident_id, commander_user_id, assigned_at                                |
| `incident.constitutional_state_entered` | Auto-response state change | incident_id, from_state, to_state, entered_at                          |
| `incident.investigation_note`  | Investigator adds context        | incident_id, note_by, note_at, note_text                                   |
| `incident.resolution_action`   | Each resolution step             | incident_id, action_type, performed_by, performed_at, action_detail        |
| `incident.recovery_check`      | Each checklist item confirmed    | incident_id, check_name, confirmed_by, confirmed_at, result                |
| `incident.resolved`            | All checks passed                | incident_id, resolved_at, resolution_duration_s, root_cause_category       |
| `incident.post_review_submitted` | Post-incident report filed     | incident_id, submitted_by, submitted_at, prevention_plan_items[]           |

All records append-only. Immutable after write.
