# Incident Response Runbook

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26

---

## Overview

This runbook covers all incident severity levels for the ClubHub TV platform. Severity is
determined by the failure class and the specific systems affected, not by how urgent it
feels. Using the correct severity level ensures the correct people are engaged and the
correct response steps are followed.

### Severity summary

| Severity | Failure class | Trigger | Response SLA |
|---|---|---|---|
| P1 | CLASS_4 / CLASS_5 | EMERGENCY_FREEZE, ReplayCircuitBreaker OPEN | 10 min (PLATFORM_ADMIN) |
| P2 | CLASS_3 | Shadow divergence, CONSTITUTIONAL_RISK state | 30 min (PLATFORM_ADMIN) |
| P3 | CLASS_2 | CRITICAL entropy alert | 15 min during operating hours (VENUE_OPERATOR) |
| P4 | CLASS_1 | Degraded parity, elevated error rate | Review in daily standup |
| P5 | CLASS_0 | Warning-level signals | Review in weekly report |

---

## P1 Incident: CLASS_4 / EMERGENCY_FREEZE

### Detection

P1 is triggered by any of the following:

- **ReplayCircuitBreaker opens** (threshold = 1 — one replay nondeterminism event is
  sufficient). System automatically enters CLASS_4 and transitions to EMERGENCY_FREEZE.
- **PLATFORM_ADMIN manually trips** GlobalConstitutionalBreaker (rare; use only if you
  have evidence of constitutional integrity compromise that circuit breakers have not yet
  detected).
- **constitutional-state.ts** transitions to EMERGENCY_FREEZE for any reason.

EMERGENCY_FREEZE has no automatic exits. A human PLATFORM_ADMIN with a valid authorization
token must execute the exit procedure. The system will not self-heal out of EMERGENCY_FREEZE
regardless of how much time passes.

### Immediate response (first 15 minutes)

1. **Player-runtime enters EMERGENCY_FALLBACK automatically.** Screens serve the last-
   known-good cached playlist. No action required to preserve screen content — this is
   handled by player-runtime's emergency state handler. Confirm by checking that screens
   are still displaying content (not black screen).

2. **All mutations blocked.** The CMS API returns 503 with error code `CONSTITUTIONAL_FREEZE`
   for all write operations. Read operations remain available. This is expected behavior.
   Do not attempt to bypass or restart the API to restore mutations — the block is
   intentional.

3. **PLATFORM_ADMIN paged.** On-call PLATFORM_ADMIN receives page via on-call system.
   SLA: acknowledge within 10 minutes. If primary PLATFORM_ADMIN does not acknowledge
   within 10 minutes, all PLATFORM_ADMINs are paged simultaneously.

4. **PLATFORM_ADMIN opens constitutional console.** Navigate to the constitutional console
   (PLATFORM_ADMIN role required). Locate the `ConstitutionalFreezeLog` entry for this
   event. The log entry includes:
   - `triggered_by`: which circuit breaker or manual action caused the freeze
   - `triggered_at`: timestamp
   - `triggering_event_id`: reference to the specific event (replay audit record ID,
     circuit breaker event ID, or manual trigger record)

5. **Determine scope.** From the ConstitutionalFreezeLog and the referenced triggering
   event:
   - Which venue(s) or screen(s) are affected?
   - Is the freeze localized (one venue) or platform-wide?
   - Which player(s) triggered the nondeterminism event?
   - Record answers in the incident log (create incident via CMS at `/incidents/new`).

### Investigation (15-60 minutes)

1. **Locate the triggering replay audit record.** The `triggering_event_id` in the freeze
   log points to a specific `replay_audit_records` entry. This record contains:
   - The two diverging outputs from the replay comparison
   - The corpus version, context, and input state that produced divergence
   - The timestamp and player that generated the nondeterminism

2. **Assess: genuine PRE nondeterminism or data corruption?**
   - Genuine PRE nondeterminism: the same input, corpus, and context produced different
     outputs on two invocations. This is the most serious constitutional violation.
   - Data corruption: the replay comparison encountered corrupt or missing data, causing
     a false divergence. Less serious, but still a CLASS_4 until proven.
   - To distinguish: inspect the two outputs in the replay audit record. If the input
     state is identical and the outputs differ, it is genuine nondeterminism. If the input
     state appears corrupted (missing fields, unexpected null values), it may be a data
     issue.

3. **Check corpus checksum state for affected venues.** Run or request an entropy scan on
   the affected venue(s). A failing entropy check suggests corpus corruption may have
   contributed to the event.

4. **Document root cause hypothesis.** In the incident log, record your hypothesis at
   this stage. It will be confirmed or revised during resolution.

### Resolution (1-4 hours)

1. **Execute EMERGENCY_FREEZE exit procedure** as documented in CONSTITUTIONAL-FREEZE-
   PROCEDURES.md. Summary of the procedure:
   - PLATFORM_ADMIN provides human authorization token (minimum 8 characters)
   - System transitions from EMERGENCY_FREEZE to READ_ONLY
   - In READ_ONLY state, reads are permitted; mutations remain blocked

2. **Run the integrity suite while in READ_ONLY.** All three checks must pass before
   proceeding:
   ```
   npx ts-node scripts/contracts/validate-contracts.ts --all
   npx ts-node scripts/system-integrity/full-stack-determinism.ts
   npx ts-node scripts/system-integrity/constitutional-boundary-check.ts
   ```
   If any check fails, do not proceed to HEALTHY. Investigate and resolve the failure.
   A failed integrity check after a freeze event indicates the underlying issue is not
   resolved.

3. **Approve READ_ONLY → HEALTHY.** Via the constitutional console, PLATFORM_ADMIN
   approves the transition. This action is logged with `principal_id` and timestamp.

4. **Monitor post-recovery.** For the 60 minutes following the HEALTHY transition:
   - Parity ratio: confirm it stabilizes at ≥ 0.999 (if shadow is active)
   - Entropy: confirm all venues show clean status
   - Heartbeats: confirm all players return green
   - PRECircuitBreaker: confirm it is CLOSED
   - ReplayCircuitBreaker: confirm it is CLOSED

   If any signal degrades during this monitoring window, re-evaluate whether the root
   cause was fully resolved.

### Post-incident (within 24 hours)

1. **Complete post-incident review.** Navigate to `/incidents/:id/review` in CMS. Required
   fields:
   - Timeline (detection → acknowledgement → resolution)
   - Root cause (confirmed, with evidence from audit log)
   - Impact (which venues, how many screens, how long was EMERGENCY_FALLBACK active)
   - Prevention plan (specific action items with owners and target dates)
   - Constitutional review: does this event reveal a gap in constitutional enforcement?

2. **Root cause documented with evidence.** Do not mark the incident resolved until the
   root cause is documented with a reference to the specific audit record or log entry
   that confirms it.

3. **Prevention plan has owners.** Every prevention action item must have a named owner
   and a date. Undated or unowned action items will not be followed up on.

---

## P2 Incident: CLASS_3 Divergence

### Detection

P2 is triggered by the shadow service detecting a CLASS_3 divergence in parity comparison.
CLASS_3 divergences indicate that PRE and the legacy system produce sufficiently different
results that the new corpus cannot be trusted at this venue or canary stage.

System behavior on CLASS_3 detection:
- Constitutional state transitions to CONSTITUTIONAL_RISK
- Deployment of new corpus versions is blocked (CI gate fails)
- Shadow comparison for the affected venue is paused
- ENTERPRISE_ADMIN receives CRITICAL alert

### Immediate response

1. **Deployment is automatically blocked.** No action required to prevent new deployments
   from landing — the CI gate handles this. Do not bypass the gate.

2. **ENTERPRISE_ADMIN notified** via CRITICAL alert. ENTERPRISE_ADMIN should acknowledge
   within 30 minutes.

3. **Shadow comparison paused for affected venue.** This prevents additional CLASS_3
   records from accumulating while the cause is investigated.

### Investigation

1. **Locate the CLASS_3 parity record.** In the parity dashboard, find the record
   corresponding to this event. The record contains:
   - Which field(s) diverged
   - The PRE output value and the legacy system output value
   - The corpus version and venue at the time of divergence
   - The scheduling context (campaign, slot, time)

2. **Assess the source of divergence.** Three possibilities:

   **Option A: PRE configuration is wrong.** The new corpus has an incorrect weight,
   slot assignment, or classification rule that causes PRE to diverge from the correct
   legacy behavior. This is the most common cause.

   **Option B: Legacy system has changed.** The legacy system's scheduling behavior
   changed (new campaign, new override, new compliance rule applied) and the comparison
   baseline is now stale. PRE may be correct; the baseline is wrong.

   **Option C: Acceptable known deviation.** The divergence is intentional and known —
   PRE is supposed to behave differently in this case (e.g., a compliance improvement
   where PRE is more conservative). This classification is rare and requires dual approval.

### Resolution paths

**Option A — Corpus fix:**
1. Identify the specific corpus configuration error.
2. Revise the corpus.
3. Re-sign and publish the revised corpus version.
4. Start a new canary cycle from Stage 1 (SHADOW_ONLY).
5. Do not skip stages because the previous corpus was almost correct.

**Option B — Legacy fix:**
1. Update the comparison baseline to reflect the current legacy system behavior.
2. Re-enable shadow comparison for the affected venue.
3. Confirm CLASS_3 does not recur with the updated baseline.
4. Resume canary from the current stage (do not restart from Stage 1 unless the
   baseline change is broad enough to affect earlier stage data).

**Option C — Classify acceptable deviation:**
This path requires both ENTERPRISE_ADMIN and PLATFORM_ADMIN to approve. Use this path
only when the divergence is demonstrably correct behavior by PRE (a constitutional
improvement) and the legacy system is known to be wrong.

Procedure:
1. ENTERPRISE_ADMIN documents the justification (why PRE's output is correct).
2. PLATFORM_ADMIN reviews and approves the justification.
3. Both approvals recorded in the parity record (append audit note — cannot modify the
   original record).
4. Comparison baseline updated to reflect the acceptable deviation.
5. Shadow comparison re-enabled.

---

## P3 Incident: CRITICAL Entropy

### Detection

Entropy service detects a checksum mismatch between the expected corpus asset and what is
present on a player's local cache. Severity CRITICAL means the mismatch affects content
that is currently scheduled to display (not future or expired content).

### Response

1. **VENUE_OPERATOR notified** via CRITICAL alert. If the venue operator is unavailable
   (outside operating hours), REGIONAL_MANAGER receives the alert instead.

2. **Operator opens entropy report** in the operator dashboard. The report identifies:
   - Which screens are affected
   - Which assets have checksum mismatches
   - The last time a successful sync occurred on the affected player

3. **Choose resolution path:**

   **ASSET_RESYNC** (preferred) — instruct the player to re-download the affected assets
   from the CDN. Use if the corpus version is correct but the local asset is corrupted.
   ```
   POST /entropy/resync/:screen_id
   Body: { asset_ids: ["..."] }
   ```

   **CORPUS_ROLLBACK** — revert the player to the previous signed corpus version. Use if
   the mismatch suggests the corpus version itself is wrong (not just asset corruption).
   This is a more significant action and should be confirmed with REGIONAL_MANAGER if
   the VENUE_OPERATOR is uncertain.
   ```
   POST /canary/rollback
   Body: { venue_id: "...", rollback_to_version_id: "...", human_approval_token: "..." }
   ```

4. **After resolution, trigger an entropy re-scan** to confirm the mismatch is resolved:
   ```
   POST /entropy/scan/:venue_id
   ```
   Wait for scan to complete (typically 5 minutes with staging heartbeat interval, 60
   minutes on production interval). Confirm the report shows clean status.

5. **Escalation if unresolved:**
   - After 2 hours without resolution: escalate to REGIONAL_MANAGER (if not already
     involved)
   - After 4 hours without resolution: escalate to ENTERPRISE_ADMIN
   - ENTERPRISE_ADMIN escalation triggers entropy circuit breaker review — if the
     ENTERPRISE_ADMIN determines the entropy pattern suggests a systemic corpus integrity
     issue, they may request PLATFORM_ADMIN involvement

---

## P4 Incident: CLASS_2

CLASS_2 events are logged automatically and surfaced in the monitoring dashboard. No
immediate response is required.

**P4 response protocol:**
- Review in the daily engineering standup
- Assign an engineer to investigate if the same CLASS_2 pattern appears more than 3 times
  in a 24h period (frequency suggests a systematic issue, not random noise)
- Document any findings in the incident log

CLASS_2 examples: momentary PRE latency spike, transient shadow comparison timeout,
heartbeat delayed (not missed), entropy scan timeout (not mismatch).

---

## P5 Incident: CLASS_1

CLASS_1 events are informational. They indicate a condition worth monitoring but not
requiring investigation.

**P5 response protocol:**
- Reviewed in the weekly operational report
- No investigation unless frequency increases week-over-week
- If CLASS_1 frequency doubles in a week, treat as P4 and review in daily standup

CLASS_1 examples: corpus sync completed successfully but slightly outside the 5-minute
window, audit buffer upload took longer than baseline.

---

## Appendix: Quick Reference

### Circuit breaker states to check during any P1

```
constitutional console → Circuit Breakers panel:
- PRECircuitBreaker: should be CLOSED (or explains DEGRADED state)
- ReplayCircuitBreaker: OPEN triggered this incident
- EntropyCircuitBreaker: check if entropy contributed
- ShadowCircuitBreaker: check if shadow comparison is affected
- GlobalConstitutionalBreaker: EMERGENCY_FREEZE — we are here
```

### Key commands for P1 investigation

```bash
# Confirm freeze state
GET /admin/constitutional/state

# Get freeze log
GET /admin/constitutional/freeze-log/latest

# Run integrity checks (while in READ_ONLY)
npx ts-node scripts/contracts/validate-contracts.ts --all
npx ts-node scripts/system-integrity/full-stack-determinism.ts
npx ts-node scripts/system-integrity/constitutional-boundary-check.ts

# Approve READ_ONLY → HEALTHY (via console — not CLI)
# Navigate to: /admin/constitutional/console
```

### Key commands for P3 entropy investigation

```bash
# View entropy report for venue
GET /entropy/report/:venue_id

# Trigger resync for specific screen
POST /entropy/resync/:screen_id

# Force entropy scan
POST /entropy/scan/:venue_id

# View scan result
GET /entropy/scan/:venue_id/latest
```
