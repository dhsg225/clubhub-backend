# Emergency Lifecycle

**Document type:** Operational workflow specification
**Audience:** All roles (emergency awareness), VENUE_OPERATOR+ (operational response), PLATFORM_ADMIN (constitutional response)
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, CLUBHUB_SYSTEM_CONTRACTS.md, INCIDENT-RECOVERY-WORKFLOWS.md, CONSTITUTIONAL-FREEZE-PROCEDURES.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

An emergency is a declared state that overrides all normal content resolution and places the system into a protective operational mode. Emergencies are the highest-priority event class in the ClubHub TV platform. They interact directly with constitutional state — a CONSTITUTIONAL_EMERGENCY is one of the primary paths into EMERGENCY_FREEZE.

This document covers three emergency types with distinct trigger actors, resolution behaviors, and clearance procedures. Understanding the hierarchy between emergency types is essential for operators: a FLEET_EMERGENCY contains VENUE_EMERGENCY; a CONSTITUTIONAL_EMERGENCY supersedes both.

---

## 2. Emergency Types

### 2.1 VENUE_EMERGENCY

**Scope:** Single venue — affects all screens within the venue

**Definition:** A declared operational emergency at a specific venue requiring immediate content intervention. The most common emergency type in day-to-day operations.

**Typical triggers:**
- Physical evacuation notice (fire alarm, structural concern)
- On-site incident requiring immediate operator-controlled content
- Compliance breach discovered on-site (e.g., age-restricted content displayed in all-ages area)
- Patron complaint requiring immediate content interruption
- Equipment failure requiring "maintenance mode" content

**Content behavior:** PRE resolves at L0 (Emergency Resolution). The emergency_content corpus slot is the content source. This slot is pre-loaded per venue with content appropriate for the emergency type (e.g., directional signage, "be back shortly" content, compliance recovery content).

**PRE level:** L0 — supersedes all other levels including operational overrides (L1)

### 2.2 FLEET_EMERGENCY

**Scope:** Multiple venues or entire fleet

**Definition:** An emergency condition affecting multiple venues simultaneously, typically from a systemic cause requiring coordinated response.

**Typical triggers:**
- Regulatory notice requiring immediate content change across licensed venues
- System integrity event detected across the fleet (e.g., corrupted content distributed to multiple venues)
- CLASS_3 failure detected in deployment group that spans multiple venues
- Coordinated operational event (e.g., national brand safety incident)
- Automated CLASS_3/4 detection across entropy threshold at fleet scale

**Content behavior:** Same as VENUE_EMERGENCY at L0 for all affected venues. Fleet-level emergency_content slot used (overrides venue-specific emergency content unless venue-specific is explicitly preserved in the emergency declaration).

**PRE level:** L0 across all affected venues

### 2.3 CONSTITUTIONAL_EMERGENCY

**Scope:** System-wide — affects the platform itself

**Definition:** An emergency condition arising from constitutional state machine violation, circuit breaker trip, or PLATFORM_ADMIN explicit declaration. A CONSTITUTIONAL_EMERGENCY is not an operational event — it is a system integrity event.

**Triggers:**
- ReplayCircuitBreaker opens (any single replay nondeterminism event)
- GlobalConstitutionalBreaker transitions to EMERGENCY_FREEZE
- CLASS_4 (catastrophic) failure detection
- PLATFORM_ADMIN explicit constitutional trip with reason

**Content behavior:** All PRE invocations are halted. Screens fall back to device-local last-known-good playlist (L6 cache). No new content is resolved or pushed during CONSTITUTIONAL_EMERGENCY. This is distinct from VENUE/FLEET emergencies where content still flows (from the emergency_content slot) — during a CONSTITUTIONAL_EMERGENCY the content resolution engine itself is suspended.

**Constitutional state entered:** EMERGENCY_FREEZE

---

## 3. Trigger Actors

### 3.1 VENUE_EMERGENCY Triggers

| Actor                   | Trigger Path                                             | Notes                                            |
|-------------------------|----------------------------------------------------------|--------------------------------------------------|
| VENUE_OPERATOR          | Manual declaration via operator UI                      | Immediate; no approval required                  |
| REGIONAL_MANAGER        | Manual declaration for any venue in their region        | Immediate; no approval required                  |
| Automated — circuit breaker | PRECircuitBreaker opens at venue scope              | Requires operator acknowledgment within SLA      |
| Automated — entropy     | Critical entropy threshold exceeded at venue scope      | Requires REGIONAL_MANAGER+ acknowledgment        |

### 3.2 FLEET_EMERGENCY Triggers

| Actor                   | Trigger Path                                             | Notes                                            |
|-------------------------|----------------------------------------------------------|--------------------------------------------------|
| REGIONAL_MANAGER        | Manual declaration (own region scope)                   | Immediate; ENTERPRISE_ADMIN notified             |
| ENTERPRISE_ADMIN        | Manual declaration (any scope)                          | Immediate                                        |
| Automated — CLASS_3/4   | Detection across multiple venues simultaneously         | ENTERPRISE_ADMIN notified; requires confirmation |
| Automated — entropy     | Fleet-level entropy critical threshold                  | ENTERPRISE_ADMIN+ required to acknowledge        |

### 3.3 CONSTITUTIONAL_EMERGENCY Triggers

| Actor / System           | Trigger Path                                             | Notes                                              |
|--------------------------|----------------------------------------------------------|----------------------------------------------------|
| PLATFORM_ADMIN           | Explicit constitutional trip (requires reason)          | Immediate; ConstitutionalFreezeLog entry created   |
| ReplayCircuitBreaker     | Automatic on first replay nondeterminism                | threshold=1; no human approval needed to ENTER     |
| GlobalConstitutionalBreaker | Automatic escalation from extended CLASS_3 state    | Requires human auth token to EXIT                  |
| CLASS_5 system halt      | Automatic on catastrophic platform failure              | Treated as CONSTITUTIONAL_EMERGENCY                |

No actor below PLATFORM_ADMIN can manually trigger a CONSTITUTIONAL_EMERGENCY. Automated triggers are the only other path.

---

## 4. Emergency Content During Active Emergency

### 4.1 Content Source Priority During VENUE or FLEET Emergency

During a VENUE_EMERGENCY or FLEET_EMERGENCY, PRE resolves at L0. The L0 resolution chain is:

1. Venue-specific emergency content (emergency_content corpus slot, venue scope)
2. Regional emergency content (if venue-specific is absent or flagged as insufficient)
3. Fleet-wide emergency content (fallback if regional is also absent)
4. Device-local emergency content (L6 last-resort — pre-loaded during screen commissioning)

The emergency_content corpus slot MUST be populated before a venue enters operational status (see SCREEN-COMMISSIONING.md §5). A venue with an empty emergency_content slot is a commissioning failure.

### 4.2 Content Behavior During CONSTITUTIONAL_EMERGENCY

During CONSTITUTIONAL_EMERGENCY / EMERGENCY_FREEZE:
- PRE invocations are halted — no new resolution occurs
- Screens play the device-local last-known-good playlist from L6 cache
- This content is whatever was last successfully delivered and confirmed on the device
- The L6 cache is write-protected during EMERGENCY_FREEZE — no OTA content updates can overwrite it
- If a screen has no L6 cache (newly commissioned, never received content), it displays a static system-provided fallback image

### 4.3 Compliance Content During Emergency

During a VENUE_EMERGENCY or FLEET_EMERGENCY, compliance content obligations are suspended for the duration of the emergency. The emergency declaration itself is recorded as the justification for compliance content absence. After emergency clearance, the normal compliance content schedule resumes.

During CONSTITUTIONAL_EMERGENCY, no content resolution occurs at all — compliance content is suspended by definition.

Post-emergency, the compliance audit trail includes the emergency declaration record as justification for any compliance gaps during the emergency window.

---

## 5. Emergency Acknowledgment and Clearance

### 5.1 VENUE_EMERGENCY Clearance

**Who:** VENUE_OPERATOR+ (the declaring actor or any higher-authority actor)

**Steps:**
1. Actor confirms the emergency condition has resolved (on-site verification)
2. Actor provides clearance reason (required free text)
3. System emits `emergency.cleared` audit record
4. PRE resumes normal L3 resolution for the venue at next tick
5. Recovery verification run: PRE parity check for the venue (5 independent invocations must produce identical output)
6. If parity check fails: venue remains in DEGRADED state until investigation completes

**Audit record:** `emergency.cleared` with `emergency_id`, `cleared_by`, `clearance_reason`, `cleared_at`, `duration_s`, `parity_check_result`

### 5.2 FLEET_EMERGENCY Clearance

**Who:** ENTERPRISE_ADMIN+ (or REGIONAL_MANAGER if the emergency was regional scope and ENTERPRISE_ADMIN is unavailable — requires ENTERPRISE_ADMIN ratification within 4 hours)

**Steps:**
1. Actor confirms fleet-level condition resolved
2. Clearance applied venue-by-venue or as fleet (operator choice)
3. Per-venue recovery verification run for all affected venues
4. ENTERPRISE_ADMIN review of post-emergency entropy across affected fleet
5. Fleet state transitions from DEGRADED back toward HEALTHY as each venue clears

**Audit record:** `emergency.fleet_cleared` with `emergency_id`, `cleared_by`, `affected_venues[]`, `per_venue_parity_results`, `cleared_at`

### 5.3 CONSTITUTIONAL_EMERGENCY Clearance (EMERGENCY_FREEZE Exit)

Constitutional emergency clearance is a strict sequential procedure documented in full in CONSTITUTIONAL-FREEZE-PROCEDURES.md. Summary:

1. PLATFORM_ADMIN reviews ConstitutionalFreezeLog
2. PLATFORM_ADMIN reviews replay audit for nondeterminism event
3. Root cause identified and documented
4. `GlobalConstitutionalBreaker.reset(humanAuthorizationToken)` called — token must be ≥8 characters
5. System transitions to READ_ONLY (not directly to HEALTHY)
6. Full integrity suite run (validate-contracts, full-stack-determinism, constitutional-boundary-check)
7. PLATFORM_ADMIN approves READ_ONLY → HEALTHY transition
8. Entropy re-scan across all affected venues
9. Canary stage reset to SHADOW_ONLY for all affected deployment groups

**This procedure has zero shortcuts.** No step may be skipped. No role below PLATFORM_ADMIN may authorize the exit.

---

## 6. Nested Emergencies

### 6.1 Venue Emergency During Fleet Emergency

When a VENUE_EMERGENCY is declared while a FLEET_EMERGENCY is already active for the same venue:

- The FLEET_EMERGENCY takes precedence (it is already at L0)
- The VENUE_EMERGENCY is recorded as a concurrent declaration
- Clearance requires both conditions to be resolved — the venue cannot exit emergency state until both the fleet and venue conditions are cleared
- Clearance order: FLEET_EMERGENCY must be cleared first (or exclude the venue from fleet scope), then VENUE_EMERGENCY cleared separately

### 6.2 Fleet Emergency During Constitutional Emergency

A FLEET_EMERGENCY declared while a CONSTITUTIONAL_EMERGENCY is active:

- Is recorded as an audit event
- Does NOT change system behavior (CONSTITUTIONAL_EMERGENCY already halts all PRE invocations)
- Is held as a pending emergency to be addressed during the CONSTITUTIONAL_EMERGENCY recovery process
- After constitutional emergency clearance, the FLEET_EMERGENCY is re-evaluated and cleared or maintained by ENTERPRISE_ADMIN+

### 6.3 Constitutional Emergency Preempts All

CONSTITUTIONAL_EMERGENCY cannot be nested. If the system is already in EMERGENCY_FREEZE and another trigger fires, the trigger is recorded in the ConstitutionalFreezeLog but the state does not change. There is no "deeper freeze" — EMERGENCY_FREEZE is the floor.

---

## 7. Replay Implications

All emergency lifecycle events generate ReplayAuditRecords:

| Event                        | Required Fields                                                                         |
|------------------------------|-----------------------------------------------------------------------------------------|
| `emergency.declared`         | emergency_id, type, declared_by, scope, trigger_reason, declared_at                   |
| `emergency.l0_activated`     | emergency_id, screen_ids[], emergency_content_slot, activation_tick                   |
| `emergency.acknowledged`     | emergency_id, acknowledged_by, acknowledged_at                                          |
| `emergency.cleared`          | emergency_id, cleared_by, clearance_reason, cleared_at, duration_s, parity_check_result|
| `emergency.parity_restored`  | emergency_id, venue_id, pre_invocations_verified, all_deterministic                    |
| `emergency.constitutional_trip` | emergency_id, trigger_source, freeze_log_entry_id                                  |
| `emergency.constitutional_cleared` | emergency_id, cleared_by, human_auth_token_used (boolean), integrity_suite_passed |

Emergency audit records are immutable. They cannot be amended, retracted, or deleted — including by PLATFORM_ADMIN. This is a constitutional guarantee for forensic integrity.

---

## 8. Recovery Verification After Emergency

### 8.1 PRE Parity Re-verification

After any emergency clearance, PRE must pass a parity verification before the venue or deployment group returns to HEALTHY state:

- PRE.resolve() invoked 5 times for the same input (same `at` timestamp, same `screen_id`, same corpus version)
- All 5 outputs must be bit-identical (identical `playlist_checksum`)
- If any invocation produces different output: venue remains in DEGRADED state, REGIONAL_MANAGER notified, investigation required before return to HEALTHY

### 8.2 Entropy Re-scan

After emergency clearance, an entropy re-scan is triggered for all affected venues:
- Scan checks that device-local corpus state matches the expected corpus for the current CorpusVersion binding
- Any discrepancy opens an ADVISORY or WARNING entropy report (see ENTROPY-REVIEW-WORKFLOWS.md)
- CRITICAL entropy findings after an emergency clearance block the return to HEALTHY

### 8.3 Post-Incident Report

For all emergencies:
- **VENUE_EMERGENCY:** Incident summary auto-generated; VENUE_OPERATOR prompted to confirm details within 48 hours
- **FLEET_EMERGENCY:** Full incident report required by ENTERPRISE_ADMIN within 24 hours; includes root cause, affected screens, content gap analysis, sponsor impact
- **CONSTITUTIONAL_EMERGENCY:** Mandatory PLATFORM_ADMIN signed incident report within 24 hours; includes ConstitutionalFreezeLog review, replay audit integrity confirmation, systemic prevention plan

Incident reports become part of the immutable audit trail. They cannot be deleted.

---

## 9. Operator Communication During Emergency

### 9.1 What VENUE_OPERATOR Sees

During a VENUE_EMERGENCY: a banner indicating emergency mode active, which screens are affected, what content is playing, when the emergency was declared, and a prominent clearance action.

During a FLEET_EMERGENCY: notification that their venue is under fleet emergency; same detail as venue emergency plus fleet-scope context; clearance action disabled (only ENTERPRISE_ADMIN+ can clear fleet emergency).

During CONSTITUTIONAL_EMERGENCY: a system-wide notice that the platform is in constitutional freeze; no operational actions available; contact PLATFORM_ADMIN guidance.

### 9.2 What ENTERPRISE_ADMIN Sees

During any emergency: live view of all emergencies in their enterprise scope; affected screen counts; emergency duration; estimated sponsor impact; pending acknowledgment/clearance actions.

### 9.3 What SPONSOR_STAKEHOLDER Sees

During an emergency affecting their contracted screens: a notification that their contracted delivery window is disrupted by an active emergency; estimated duration if known; the emergency record will appear in their proof-of-play audit as a justified delivery gap.

Sponsors do not see the nature of the emergency — only that one occurred and for how long it affected their contracted screens.
