# Constitutional Freeze Procedures

**Document type:** Operational procedure — constitutional authority
**Audience:** PLATFORM_ADMIN (primary), ENTERPRISE_ADMIN (notification and coordination), platform engineers (integrity suite execution)
**Depends on:** CLUBHUB_SYSTEM_CONTRACTS.md, INCIDENT-RECOVERY-WORKFLOWS.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md
**Version:** 1.0
**Status:** CANONICAL — THIS DOCUMENT IS AUTHORITATIVE FOR EMERGENCY_FREEZE PROCEDURES

---

## 1. What EMERGENCY_FREEZE Is

EMERGENCY_FREEZE is the platform's most protective constitutional state. When the GlobalConstitutionalBreaker is in EMERGENCY_FREEZE mode, the platform is in a full operational halt. All PRE invocations stop. All mutations stop. All content delivery to screens falls back to device-local last-known-good playlists (L6 cache). The platform becomes a read-only system until a PLATFORM_ADMIN explicitly authorizes exit.

**EMERGENCY_FREEZE is not a failure.** It is the platform protecting itself and its operators from acting on potentially invalid state. The platform has detected that its constitutional guarantees — specifically, PRE determinism — may have been violated. Until that is verified to have been resolved, the platform refuses to make decisions that could propagate the violation.

**The single most important property of EMERGENCY_FREEZE:** There is no automatic exit. No timer, no threshold, no automated recovery path. A human PLATFORM_ADMIN must authorize the exit. This is intentional and non-negotiable.

---

## 2. Entry Triggers

### 2.1 Automatic Entry — ReplayCircuitBreaker

**Threshold:** threshold=1 (any single event)

The ReplayCircuitBreaker monitors the determinism guarantee: given identical inputs, PRE.resolve() must produce identical outputs. If any invocation produces output that does not match the expected output for those inputs, the ReplayCircuitBreaker opens immediately.

This is a zero-tolerance threshold because PRE nondeterminism is a constitutional violation, not a performance degradation. A platform that resolves different playlists for the same inputs is not the platform it claims to be, and operators cannot trust its output.

**Sequence of events:**
1. Nondeterminism event detected (checksum mismatch on identical inputs)
2. ReplayCircuitBreaker transitions to OPEN
3. GlobalConstitutionalBreaker escalates to EMERGENCY_FREEZE
4. All PRE invocations halt immediately
5. ConstitutionalFreezeLog entry written within 1 second of detection
6. PLATFORM_ADMIN notified via all configured channels
7. All mutation operations begin returning `CONSTITUTIONAL_FREEZE` error

### 2.2 Automatic Entry — GlobalConstitutionalBreaker Escalation

The GlobalConstitutionalBreaker escalates to EMERGENCY_FREEZE when:
- System remains in CONSTITUTIONAL_RISK or READ_ONLY state beyond a configured duration without human acknowledgment (default: 30 minutes of sustained CLASS_3 condition)
- CLASS_4 (catastrophic) failure detection triggers the breaker directly

### 2.3 Manual Entry — PLATFORM_ADMIN

A PLATFORM_ADMIN may manually trip the GlobalConstitutionalBreaker to EMERGENCY_FREEZE at any time by providing:
- `reason`: Required free text describing why the manual freeze is necessary
- `constitutional_basis`: Which constitutional guarantee is at risk (from the defined list)

The manual trip is recorded in the ConstitutionalFreezeLog with the PLATFORM_ADMIN's user_id, reason, constitutional_basis, and timestamp. Manual trips carry the same full exit procedure as automatic trips — there is no abbreviated exit path for manually-triggered freezes.

---

## 3. System Behavior During EMERGENCY_FREEZE

### 3.1 Content Delivery

All screens fall back to their device-local last-known-good playlist (L6 cache). This is the content that was last successfully resolved, delivered, and confirmed on each device before the freeze.

The L6 cache is write-protected during EMERGENCY_FREEZE. No OTA content updates, no new asset delivery, no corpus version changes. The cache state at the moment of freeze is preserved exactly.

For screens with no L6 cache (newly commissioned devices that have never received content), a static system-provided fallback image is displayed. This image is a hardware-burned default, not a corpus asset, and is therefore unaffected by the freeze.

### 3.2 Mutation Operations

All mutation operations are rejected during EMERGENCY_FREEZE. The rejection is at the API gateway level — requests do not reach the application layer. This prevents any possibility of a partially-applied mutation creating inconsistent state.

Rejected operations include:
- Campaign creation, modification, approval, publishing
- Override creation, modification, expiry
- Sponsorship content loading, state transitions
- Screen commissioning or decommissioning
- Corpus version updates
- Entropy acknowledgments
- Canary stage transitions
- Any write to the workflow_traces audit table

**The only operations permitted during EMERGENCY_FREEZE are read operations.** GET endpoints, preview-adjacent read operations, and the ConstitutionalFreezeLog read path are available.

**Exception: PLATFORM_ADMIN may write to the ConstitutionalFreezeLog** (investigation notes, root cause documentation) during a freeze. This is the only write operation permitted, and it is restricted to ConstitutionalFreezeLog entries only.

### 3.3 Preview Availability

Preview is disabled during EMERGENCY_FREEZE. The rationale: if the platform's constitutional guarantees are in question, preview output would be based on potentially invalid state. Serving preview during a freeze could mislead operators about what the platform would actually do when unfrozen.

After the freeze exits to READ_ONLY, POINT_IN_TIME and SCHEDULE_WALK preview become available. WHAT_IF preview remains disabled in READ_ONLY.

### 3.4 Error Response Format

All rejected requests during EMERGENCY_FREEZE receive:
```json
{
  "error": "CONSTITUTIONAL_FREEZE",
  "code": "CF-001",
  "message": "Platform is in constitutional freeze. All mutations are suspended. Contact your PLATFORM_ADMIN.",
  "freeze_since": "<ISO8601 timestamp>",
  "constitutional_freeze_log_ref": "<freeze_log_entry_id>"
}
```

The `constitutional_freeze_log_ref` allows support staff to reference the specific freeze event in the audit log when helping operators who encounter the error.

---

## 4. ConstitutionalFreezeLog

The ConstitutionalFreezeLog is a dedicated append-only audit log that records all events related to constitutional freeze and exit. It is separate from the operational workflow_traces table to ensure it remains accessible for investigation even if the main audit infrastructure is involved in the freeze trigger.

### 4.1 Required Entries

Every EMERGENCY_FREEZE event must produce the following ConstitutionalFreezeLog entries:

| Entry Type              | When Written                        | Required Fields                                                          |
|-------------------------|-------------------------------------|--------------------------------------------------------------------------|
| FREEZE_ENTERED          | Immediately on freeze entry         | entry_id, trigger_source, trigger_detail, entered_at, triggered_by      |
| PLATFORM_ADMIN_NOTIFIED | Within 60s of freeze entry          | entry_id, notified_user_id, notification_channel, notified_at           |
| INVESTIGATION_STARTED   | When PA acknowledges                | entry_id, acknowledged_by, acknowledged_at, initial_assessment          |
| ROOT_CAUSE_DOCUMENTED   | When PA confirms root cause         | entry_id, root_cause_category, root_cause_detail, documented_by, at    |
| RESET_AUTHORIZED        | When PA calls reset()               | entry_id, authorized_by, human_auth_token_used (bool, not the token), at |
| INTEGRITY_SUITE_STARTED | Suite execution begins              | entry_id, suite_components[], started_at                                 |
| INTEGRITY_SUITE_RESULT  | Suite completes                     | entry_id, all_pass: bool, failed_checks[], completed_at                  |
| FREEZE_EXITED           | Transition to READ_ONLY confirmed   | entry_id, exited_at, freeze_duration_s, authorized_by                   |
| HEALTHY_RESTORED        | Transition to HEALTHY confirmed     | entry_id, restored_at, read_only_duration_s, final_verifications[]      |

---

## 5. Exit Procedure (Strict Sequential)

The EMERGENCY_FREEZE exit procedure consists of 10 steps that must be executed in order. No step may be skipped. No step may be executed by a role below PLATFORM_ADMIN (steps 1-4, 7). Platform engineers may execute steps 5-6 under PLATFORM_ADMIN direction.

### Step 1: PLATFORM_ADMIN Reviews ConstitutionalFreezeLog

**Actor:** PLATFORM_ADMIN
**What to review:**
- FREEZE_ENTERED entry: exact trigger source and detail
- All events in the system leading to the freeze (what was happening operationally at the time)
- Sequence of events that caused the ReplayCircuitBreaker to open (for automatic triggers)
- Whether this freeze is related to any previous recent freezes or P2 incidents

**Gate:** PLATFORM_ADMIN must record `INVESTIGATION_STARTED` entry in ConstitutionalFreezeLog before proceeding to step 2. This is the formal acknowledgment that an informed human is leading the recovery.

### Step 2: PLATFORM_ADMIN Reviews Replay Audit for Nondeterminism Event

**Actor:** PLATFORM_ADMIN (with platform engineer support)
**What to review:**
- The specific replay nondeterminism event that triggered the freeze (if automatic trigger)
- The two conflicting `playlist_checksum` values for the same inputs
- The `screen_id`, `at` timestamp, and `corpus_version_id` for the nondeterminism event
- Whether this was an isolated event or part of a pattern

**Tool:** Forensic replay interface — ReplayAuditRecord for the affected screen/time, plus the five independent verification runs that produced the diverging output.

**Gate:** PLATFORM_ADMIN must be able to identify the specific event. If the nondeterminism event cannot be located in the replay audit, the freeze cannot proceed to exit — the audit integrity itself may be compromised, which is a deeper problem requiring platform engineering escalation.

### Step 3: Root Cause Identification and Documentation

**Actor:** PLATFORM_ADMIN (with platform engineer support for technical analysis)
**Required output:** Root cause documented in ConstitutionalFreezeLog (`ROOT_CAUSE_DOCUMENTED` entry)

Root cause must be specific. Acceptable root cause categories:
- `CORPUS_INTEGRITY_FAILURE`: Specific asset(s) with specific corruption mechanism identified
- `PRE_IMPLEMENTATION_BUG`: Specific code path or condition that produces nondeterministic output identified; bug reference provided
- `INFRASTRUCTURE_FAILURE`: Clock skew, database split-brain, or other infrastructure condition identified; specific component named
- `EXTERNAL_DATA_CORRUPTION`: Third-party feed or external data source that caused corpus divergence; specific source and mechanism identified
- `CONFIGURATION_ERROR`: Specific misconfiguration that produced the violation identified

"Unknown" is not an acceptable root cause category if exit is to proceed. If root cause cannot be determined, the freeze remains in place until it is determined. The PLATFORM_ADMIN may request additional investigation time from stakeholders — this is preferable to exiting the freeze on an unresolved root cause.

**Gate:** `ROOT_CAUSE_DOCUMENTED` entry with non-empty `root_cause_detail` field must exist before step 4.

### Step 4: GlobalConstitutionalBreaker.reset()

**Actor:** PLATFORM_ADMIN only
**Mechanism:**
```
GlobalConstitutionalBreaker.reset(humanAuthorizationToken: string)
```

The `humanAuthorizationToken` must be ≥8 characters. It is not a cryptographic key — it is a deliberate speed bump that requires a PLATFORM_ADMIN to consciously provide a token, preventing accidental programmatic reset. The token is hashed (SHA-256) and stored in the ConstitutionalFreezeLog as proof of intentional authorization. The plaintext token is never stored.

**What this does NOT do:** Calling reset() does not return the system to HEALTHY. It transitions the system to READ_ONLY. From READ_ONLY, the system can proceed to HEALTHY only after steps 5-7.

**ConstitutionalFreezeLog entry:** `RESET_AUTHORIZED` written immediately on reset() call.

### Step 5: Full Integrity Suite Execution

**Actor:** Platform engineer (under PLATFORM_ADMIN direction)
**Components to run:**
1. `validate-contracts.ts` — verifies all system contracts are satisfied (CLUBHUB_SYSTEM_CONTRACTS.md bindings)
2. `full-stack-determinism.ts` — runs the 1000-invocation determinism check (from STEP 9 production runtime) across the corpus
3. `constitutional-boundary-check.ts` — verifies all constitutional state transitions in the freeze window were legal

**Execution context:** The suite runs against READ_ONLY state. No mutations are made. The suite is purely verification.

**Expected output:** All checks PASS. If any check fails, the system remains in READ_ONLY and step 7 is not available until the failure is addressed. The failure is added to the ConstitutionalFreezeLog as a new root cause item.

**ConstitutionalFreezeLog entries:** `INTEGRITY_SUITE_STARTED` at execution start; `INTEGRITY_SUITE_RESULT` at completion.

### Step 6: Integrity Suite Gate

If ALL integrity suite checks pass:
- `INTEGRITY_SUITE_RESULT` entry: `all_pass: true`
- Proceed to step 7

If ANY integrity suite check fails:
- `INTEGRITY_SUITE_RESULT` entry: `all_pass: false, failed_checks: [...]`
- Return to step 3: the root cause analysis must be updated to account for the new failures
- Address failures, re-run affected suite components
- Do not proceed to step 7 until all checks pass

### Step 7: PLATFORM_ADMIN Approves READ_ONLY → HEALTHY

**Actor:** PLATFORM_ADMIN only
**Preconditions verified by system:**
- `INTEGRITY_SUITE_RESULT` entry with `all_pass: true` exists
- All previous steps' ConstitutionalFreezeLog entries are present and complete
- No new constitutional violations detected since reset() was called

**Action:** PLATFORM_ADMIN provides explicit HEALTHY approval in the operator interface. This is a separate action from calling reset() — it is the final human gate before the system resumes normal operation.

**ConstitutionalFreezeLog entry:** Part of `FREEZE_EXITED` record (which is written when READ_ONLY → HEALTHY transition begins, not when it completes).

### Step 8: Entropy Re-Scan Across Affected Venues

**Actor:** System (automated, triggered by HEALTHY transition)

Immediately upon HEALTHY transition, an on-demand entropy scan runs for all venues that were affected by the freeze. This confirms that the L6 cache content on devices is consistent with the current corpus version.

Any CRITICAL entropy findings block the HEALTHY state from being fully confirmed — the system enters DEGRADED rather than HEALTHY for the affected venues, and the entropy resolution workflow begins (ENTROPY-REVIEW-WORKFLOWS.md).

**ConstitutionalFreezeLog entry:** `HEALTHY_RESTORED` written when all entropy scans complete and no CRITICAL findings block HEALTHY status.

### Step 9: Canary Stage Reset for Affected Deployment Groups

**Actor:** System (automated, triggered by HEALTHY transition)

All deployment groups that were in any canary stage at the time of the freeze are reset to SHADOW_ONLY. This is a precautionary measure: the freeze period represents a gap in parity verification, and the canary promotion criteria must be re-satisfied before the groups can advance again.

ENTERPRISE_ADMINs are notified of the canary resets. They must re-approve INTERNAL_CANARY transition for each affected group (same approval process as initial canary advancement).

### Step 10: Post-Freeze Review (Within 24 Hours)

**Actor:** PLATFORM_ADMIN (authors); ENTERPRISE_ADMINs (review); platform engineers (technical sections)
**Deadline:** 24 hours from EMERGENCY_FREEZE exit

Required document: Signed incident report (see INCIDENT-RECOVERY-WORKFLOWS.md §9.1 for full post-incident review requirements).

Post-freeze review is not optional. A freeze that exits without a post-review is a governance failure. The ConstitutionalFreezeLog remains "open" until the post-review is submitted and acknowledged.

**The post-freeze review must include:**
- Full ConstitutionalFreezeLog transcript
- Root cause analysis (from step 3)
- Integrity suite results (from steps 5-6)
- Impact assessment: venues affected, screen downtime duration, content delivery gaps, sponsor SOV impact, compliance slot gaps during freeze
- Constitutional review: which guarantee was violated and what is the updated guarantee given the root cause?
- Prevention plan: specific, measurable changes to prevent recurrence. Generic prevention plans ("we will be more careful") are not acceptable. The plan must name specific code changes, monitoring additions, or process changes with owners and timelines.
- Sign-off: PLATFORM_ADMIN signature (cryptographic or explicit attestation in the ConstitutionalFreezeLog)

---

## 6. Communication During Freeze

### 6.1 What VENUE_OPERATOR Sees

A system-wide banner in the operator UI: "Platform is in constitutional freeze. Screen content is displaying last-known-good playlists. No operational changes are possible at this time. Your PLATFORM_ADMIN is investigating. You will be notified when normal operation resumes."

No operational detail about the cause is displayed to VENUE_OPERATOR. This is intentional — constitutional freeze causes involve platform-level details that are not actionable at venue level and may cause alarm if communicated without context.

### 6.2 What REGIONAL_MANAGER Sees

Same banner as VENUE_OPERATOR, plus: "Expected resolution: [ETA if provided by PLATFORM_ADMIN, or 'Under investigation']. Contact your ENTERPRISE_ADMIN for status updates."

### 6.3 What ENTERPRISE_ADMIN Sees

Full freeze notification including: freeze trigger source (category only — not the specific technical detail), estimated duration (if provided by PLATFORM_ADMIN), which venues are affected, current sponsor impact (projected SOV loss for each affected sponsorship), compliance slot gap projection (how long compliance content will be absent if freeze continues at current rate).

ENTERPRISE_ADMIN receives status updates as ConstitutionalFreezeLog entries are made (ROOT_CAUSE_DOCUMENTED, INTEGRITY_SUITE_RESULT). They do not receive real-time system access — they receive summary notifications.

### 6.4 What SPONSOR_STAKEHOLDER Sees

"Your contracted screens are displaying pre-approved content due to a platform maintenance event. Your proof-of-play report will note this period as a platform-event delivery gap, which is a force majeure condition under your service agreement. You will be notified when delivery resumes."

SOV impact during a CONSTITUTIONAL_EMERGENCY is treated as force majeure in the proof-of-play report — it is excluded from the SOV denominator calculation. The platform's failure to deliver is not charged against the sponsor's contracted SOV.

---

## 7. Nested Freeze Prevention

The system cannot enter EMERGENCY_FREEZE while already in EMERGENCY_FREEZE. If a second trigger fires during an active freeze:
1. The trigger is recorded in the ConstitutionalFreezeLog as a `CONCURRENT_TRIGGER_DURING_FREEZE` entry
2. The trigger detail is added to the root cause investigation context
3. No state change occurs — the freeze state does not deepen or reset

This prevents a scenario where rapid successive triggers would extend the freeze duration or complicate the exit procedure. The PLATFORM_ADMIN handles all triggers as part of the single freeze investigation.

---

## 8. Documentation Requirement

Every EMERGENCY_FREEZE exit MUST produce:

1. A complete ConstitutionalFreezeLog for the freeze event (automatically maintained by the system)
2. A signed incident report (PLATFORM_ADMIN signature, within 24 hours)
3. A prevention plan with named owners and timelines (part of the incident report)

A freeze exit without these three documents is a governance failure. The ConstitutionalFreezeLog entry `HEALTHY_RESTORED` is marked `post_review_complete: false` until the incident report is submitted. The platform engineering team tracks open `post_review_complete: false` entries as outstanding governance obligations.

This documentation requirement is not waivable by any role, including PLATFORM_ADMIN. The PLATFORM_ADMIN produces the incident report — they cannot waive their own obligation.

---

## 9. Quick Reference: EMERGENCY_FREEZE Exit Sequence

```
Freeze entered (automatic or manual)
    │
    ▼
Step 1: PA reviews ConstitutionalFreezeLog
    │  Gate: INVESTIGATION_STARTED entry written
    ▼
Step 2: PA reviews replay audit for nondeterminism event
    │  Gate: Specific event located
    ▼
Step 3: Root cause identified and documented
    │  Gate: ROOT_CAUSE_DOCUMENTED entry with specific category and detail
    ▼
Step 4: GlobalConstitutionalBreaker.reset(humanAuthorizationToken)
    │  System transitions: EMERGENCY_FREEZE → READ_ONLY
    ▼
Step 5: Integrity suite executed (validate-contracts, full-stack-determinism, constitutional-boundary-check)
    │
    ├── Any FAIL → back to Step 3 (update root cause, fix issue, re-run)
    │
    └── All PASS ▼
Step 6: Integrity gate cleared
    │
    ▼
Step 7: PA approves READ_ONLY → HEALTHY
    │  System transitions: READ_ONLY → HEALTHY
    ▼
Step 8: Entropy re-scan across all affected venues (automated)
    │  Any CRITICAL entropy → venue enters DEGRADED (entropy resolution required)
    ▼
Step 9: Canary stage reset to SHADOW_ONLY for affected groups (automated)
    │  ENTERPRISE_ADMINs notified
    ▼
Step 10: Post-freeze review submitted within 24h
    │  ConstitutionalFreezeLog: post_review_complete: true
    ▼
Freeze fully resolved
```

No step can be skipped. No step can be reversed (once completed, it does not need to be redone unless a new failure is discovered in a later step). The sequence is designed to be linear and unambiguous.
