# Recovery-Oriented Design

**Version:** 1.0
**Status:** Authoritative
**Scope:** Design principles and operational protocols for fast, confident, and safe system recovery
**Related:** LOW-CONFIDENCE-STATE-HANDLING.md, HIGH-TRUST-WORKFLOWS.md, SHIFT-HANDOVER-MODELS.md

---

## Purpose

Recovery is where operational confidence is ultimately tested. Any system can work when it is working. The question that determines whether operators trust a system is: when something goes wrong, can I fix it without making it worse?

The ClubHub TV platform is designed so that the answer is yes. This document defines the design principles that make recovery fast, the action catalogue that makes recovery specific, and the confidence indicators that make recovery verifiable.

One principle runs through everything here: recovery is not complete until the system confirms it. Not when the operator thinks they have fixed it. Not when the alert clears. When the system's own verification mechanisms confirm that the condition that caused the failure is no longer present and the system has returned to its expected operating state.

---

## 1. Recovery Design Principles

### Principle 1: The System Must Know What It Last Did

Recovery from any failure requires knowing what state the system was in before the failure, what happened during the failure, and what state it is in now. Without this, recovery is guesswork.

The replay audit provides this. Every PRE.resolve() invocation produces an immutable audit record: inputs, outputs, resolution level, content selected, confidence score, and the corpus version that was active at resolution time. This record is hash-chained — each record references the hash of the previous record, making tampering detectable.

**What this enables in recovery:**
- Operators can reconstruct exactly what any screen was playing at any point in the past
- Operators can identify the exact moment a failure first manifested (not "sometime overnight" but the specific timestamp and resolution where things changed)
- Platform admins can replay any historical moment to verify whether a corrective action would have produced a different result
- Post-incident reviews have a complete factual record, not a reconstructed narrative

**The corpus version is part of the record.** If a content delivery failure is related to a corpus change (a campaign was published that affected resolution), the audit record shows which corpus version was active and exactly how it influenced the resolution.

### Principle 2: Recovery Must Not Require Memory

An operator who was not present when a failure occurred must be able to understand the failure and participate in recovery without relying on another person's recollection.

Handover reports, audit logs, incident records, and the state transition log collectively eliminate dependency on "who was here before." An operator who logs in to find the system in DEGRADED state with an active entropy alert from 4 hours ago has everything they need in the system:
- The entropy report shows what was expected, what was found, and when it started
- The audit log shows what actions were taken since the entropy alert appeared
- The state transition log shows what state transitions occurred and why
- The handover report (if a shift change occurred) documents what the previous operator knew

**Recovery documentation is not optional.** When a PLATFORM_ADMIN exits EMERGENCY_FREEZE, they document what they investigated and what they verified. This documentation goes into the incident record. If the failure recurs and a different PLATFORM_ADMIN responds, they have the previous incident's investigation as context.

### Principle 3: Every Failure Has a Clear Recovery Path

The system has no undefined failure modes. The FAILURE-TAXONOMY.md classifies failures into 6 classes (CLASS_0 through CLASS_5 halt). The RECOVERY-POLICIES.md defines the recovery action for each class. Every incident that maps to a known failure class has a documented recovery path.

**What this means for operators:** When the system enters a non-HEALTHY state, the state explanation tells the operator not just what is wrong but what the defined recovery path is. There is no "contact your administrator and hope" — there is a specific first action, a specific escalation path, and a specific verification step to confirm resolution.

**What this means for system design:** Any failure mode that surfaces to operators without a documented recovery path represents a gap that must be filled. If operators are asking "what do I do when X happens?" and the answer is not in the system, that is a documentation and design failure.

### Principle 4: Preview Before Every Recovery Action

Before committing any recovery action — corpus rollback, emergency override, canary rollback, circuit breaker reset — the operator must be able to preview the post-recovery state. What will content look like after this rollback? Which screens will be affected? What will play next?

This principle prevents recovery actions that create secondary failures. A corpus rollback that fixes the entropy issue but inadvertently removes a campaign that was correctly added is a recovery that makes things worse. Preview allows the operator to detect this before committing.

**Preview applies to all recovery actions, not just content changes.** Before a canary rollback (e.g., MULTI_VENUE → SINGLE_VENUE), the enterprise admin sees: which venues will be returned to legacy-only, what the parity status was at the SINGLE_VENUE stage, and what the expected effect on those venues is.

### Principle 5: Rollback Must Be Faster Than Rollforward

The time from "operator recognizes failure" to "system is restored to last-known-good state" must be minimized. Rollforward (fixing the underlying cause) is often slower and more complex. Rollback (returning to a previous known-good state) must be achievable quickly.

**Target: <60 seconds from incident detection to rollback commitment.**

This target applies to:
- CORPUS_ROLLBACK: reverting a venue to the previous CorpusVersion
- CANARY_ROLLBACK: returning to the previous canary stage
- OVERRIDE_EMERGENCY: placing an emergency override to freeze screens at safe content while root cause is investigated
- ASSET_RESYNC: pushing missing assets to affected screens

Sixty seconds is achievable because rollback actions are explicitly supported operations with well-defined paths, not improvised sequences of system administration steps.

---

## 2. Recovery Action Catalogue

The following recovery actions are explicitly supported operations in the system. Each has a defined entry point, a defined scope, a defined effect, and a defined verification step.

### ASSET_RESYNC

**What it does:** Pushes missing or stale assets to affected screens. Used when a screen is serving fallback content because expected assets are not locally cached.

**When to use:** Entropy alert indicates missing assets; screen introspection shows fallback state due to asset availability.

**Who can perform:** VENUE_OPERATOR (Level 2), REGIONAL_MANAGER.

**Process:**
1. Identify affected screens via screen introspection view
2. Confirm the asset is available in the content library (not a publishing gap)
3. Initiate asset resync for the specific screens
4. Monitor resync progress — each screen confirms asset receipt
5. Verify screen exits fallback state after resync

**Expected duration:** 1–5 minutes depending on asset size and network conditions.

**Verification:** Screen introspection confirms the screen is no longer in fallback state; current resolution uses the expected asset.

**Recovery incomplete until:** All affected screens confirm asset receipt and the system verifies they are no longer in fallback.

---

### CORPUS_ROLLBACK

**What it does:** Reverts a venue's active CorpusVersion to the previous known-good version. Rolls back campaign changes, schedule changes, or any content modifications that were published after the rollback target.

**When to use:** Publishing a corpus update introduced entropy or a resolution error that cannot be quickly corrected forward.

**Who can perform:** REGIONAL_MANAGER with ENTERPRISE_ADMIN confirmation for venue-scoped rollback; ENTERPRISE_ADMIN for fleet-scoped rollback.

**Process:**
1. Identify the target rollback version (previous known-good corpus version, shown in version history)
2. Preview the rollback: what content will be active after rollback? Which campaigns will be removed? Which schedule changes will be reverted?
3. Confirm that the rollback does not inadvertently remove compliance content that must be active
4. Commit the rollback with documented justification
5. Monitor entropy reports to verify drift resolves after rollback

**Expected duration:** Rollback commit is immediate; propagation to screens is 1–3 minutes.

**Verification:** Entropy re-scan (not just acknowledgment) confirms that the drift detected before rollback is no longer present at the current corpus version.

**Recovery incomplete until:** Entropy re-scan confirms resolution. The operator acknowledging the entropy alert is not sufficient — the system must confirm the underlying content is now correct.

**Caution:** CORPUS_ROLLBACK removes all content changes made between the rollback target and the current version. The operator must understand what they are removing, not just what they are restoring. The preview step is mandatory.

---

### OVERRIDE_EMERGENCY

**What it does:** Places an immediate Level 0 emergency override on specified screens, freezing them at designated emergency content while root cause investigation proceeds.

**When to use:** Root cause of a content failure cannot be immediately determined; the safest action is to hold screens at known-good emergency content while investigation occurs.

**Who can perform:** VENUE_OPERATOR (Level 2), REGIONAL_MANAGER, ENTERPRISE_ADMIN.

**Role in recovery:** OVERRIDE_EMERGENCY is a stabilization action, not a resolution action. It removes the urgency of the failure (screens show safe content) while allowing measured root cause investigation. It should not be confused with fixing the underlying problem.

**Process:**
1. Assess which screens are showing incorrect or failed content
2. Trigger emergency override for the affected screens (2-step confirmation: select scope, confirm)
3. Confirm emergency is active on all affected screens (the confirmation view shows per-screen status)
4. Shift focus to root cause investigation with screens stabilized

**Expected duration:** Emergency takes effect within 5 seconds of trigger; per-screen confirmation within 30 seconds.

**Verification:** Screen introspection confirms emergency content is playing on all affected screens.

**Clearing the emergency:** Emergency is not cleared until root cause is identified and the correct content is verified to be ready. Clearing the emergency before the underlying failure is resolved will immediately surface the failure again.

---

### CIRCUIT_BREAKER_RESET

**What it does:** Initiates the recovery probe for a circuit breaker that is in OPEN state. The breaker transitions to HALF_OPEN, executes a probe, and closes (or re-opens) based on the probe result.

**When to use:** After PLATFORM_ADMIN has investigated the root cause of the circuit breaker trip and confirmed the underlying issue is resolved.

**Who can perform:** PLATFORM_ADMIN only.

**Process (PRECircuitBreaker example):**
1. Identify the root cause of PRE failures from the circuit breaker error log
2. Verify the root cause has been addressed (fix deployed, configuration corrected, dependency restored)
3. Initiate HALF_OPEN recovery probe from the circuit breaker management view
4. Monitor probe execution: the system attempts one PRE invocation
5. If probe succeeds: circuit breaker returns to CLOSED; PRE resumes
6. If probe fails: circuit breaker returns to OPEN; platform admin must investigate further

**Why PLATFORM_ADMIN only:** Resetting a circuit breaker without understanding why it tripped guarantees recurrence. The circuit breaker exists to protect the system from repeated failures. Bypassing it without root cause resolution removes that protection.

**Verification:** Circuit breaker status shows CLOSED; PRE.resolve() invocations are succeeding; system returns to HEALTHY or progresses toward HEALTHY from PRE_DISABLED.

**Recovery incomplete until:** Circuit breaker status is CLOSED and sustained for at least one full monitoring cycle (typically 5 minutes). The HALF_OPEN → CLOSED transition alone is not confirmation — the breaker may re-open.

---

### CANARY_ROLLBACK

**What it does:** Reverts the canary stage to a previous stage (e.g., MULTI_VENUE → SINGLE_VENUE). All venues currently in the rolled-back stage return to legacy-only operation. PRE continues running in shadow mode for the venues that remain in the stage.

**When to use:** CLASS_3 or CLASS_4 divergence detected at the current stage; parity ratio declining below acceptable threshold; investigative findings suggest the current stage is not ready for the venues it covers.

**Who can perform:** ENTERPRISE_ADMIN (with explicit human approval confirmation); PLATFORM_ADMIN for emergency rollback.

**Process:**
1. Assess: what has caused the canary rollback decision? (CLASS_3 event, parity decline, CONSTITUTIONAL_RISK state)
2. Preview: which venues will be affected by rollback to the target stage? What parity ratio was the target stage at when it was originally approved?
3. Confirm rollback with human approval confirmation (approval is documented in the canary audit record)
4. Monitor the fleet as rolled-back venues return to legacy operation
5. Document the rollback reason in the incident record — this information is required for future promotion attempts

**Staging:** Canary rollback is sequential, one stage at a time. There is no "rollback to SHADOW_ONLY in one step." This is a safety mechanism: rolling back one stage at a time reduces the blast radius of each rollback action and allows verification at each stage.

**Verification:** Parity reports for rolled-back venues confirm they are no longer serving PRE-sourced content; legacy resolver is handling all content; entropy is stable.

**Recovery incomplete until:** All rolled-back venues confirm stable parity (parity tracking is paused for rolled-back venues but entropy monitoring continues); the CONSTITUTIONAL_RISK state (if that is what triggered the rollback) has been reviewed by ENTERPRISE_ADMIN.

---

### CONSTITUTIONAL_RESET (EMERGENCY_FREEZE Exit)

**What it does:** Exits EMERGENCY_FREEZE state, transitions the system to READ_ONLY for verification, and (after verification) progresses toward HEALTHY.

**When to use:** Only when the condition that caused EMERGENCY_FREEZE has been fully investigated, the root cause is understood, and the platform admin is confident the system can safely resume operation.

**Who can perform:** PLATFORM_ADMIN only, with human authorization token.

**Process:**
1. Enter the EMERGENCY_FREEZE investigation view (full forensic audit available)
2. Identify the triggering event (ReplayCircuitBreaker trip, constitutional boundary violation, or GlobalConstitutionalBreaker event)
3. Investigate the root cause using: full-stack-determinism.ts, cross-subsystem-consistency.ts, failure-mode-validation.ts
4. Determine whether the root cause was a transient event or a systematic failure
5. Document findings in the incident record (this documentation is part of the exit procedure, not post-hoc)
6. Enter the human authorization token
7. Confirm exit to READ_ONLY (not directly to HEALTHY — READ_ONLY is the first safe state after EMERGENCY_FREEZE)
8. In READ_ONLY: run verification checks to confirm system integrity
9. If verification passes: initiate the READ_ONLY → HEALTHY transition (also requires explicit confirmation)
10. Monitor the system in HEALTHY state for at least one monitoring cycle before declaring incident resolved

**Why READ_ONLY is the intermediate state:** Exiting EMERGENCY_FREEZE does not mean the system is healthy. It means the immediate crisis has been addressed. READ_ONLY provides a safe state for the PLATFORM_ADMIN to verify system integrity (run integrity checks, confirm replay determinism, confirm parity reporting) before allowing mutations to resume.

**Verification:** The system must confirm:
- Replay determinism: 5 consecutive deterministic runs of the same corpus packet (via full-stack-determinism.ts)
- Contract compliance: validate-contracts.ts passes (0 violations)
- Circuit breaker states: all circuit breakers in CLOSED state
- Parity stable: shadow comparison (if running) showing stable parity

**Recovery incomplete until:** All four verification checks pass and the PLATFORM_ADMIN explicitly initiates the READ_ONLY → HEALTHY transition with documented confirmation.

---

## 3. Recovery Confidence Indicators

Recovery is not a binary event — it is a progression. The system must show operators that recovery is progressing, not just assert that it is complete.

### Post-Rollback Parity Recovery

After a corpus rollback or canary rollback, the system shows a parity recovery trend: how is the parity ratio changing since the rollback action?

If parity was declining before rollback and is now stable or recovering, this is a positive signal. If parity continues to decline after rollback, the rollback did not address the root cause.

The recovery trend is shown as a sparkline on the relevant entity (venue entropy report, canary status view) for at least 30 minutes post-rollback. The operator does not need to manually calculate whether things are improving.

### Post-Entropy-Resolution Re-Scan

When entropy is reported and the operator takes corrective action (corpus update, asset resync, schedule correction), the system does not simply acknowledge the operator's action as resolution. It performs an entropy re-scan.

The re-scan uses the same entropy detection logic that generated the original alert. If the re-scan finds the same drift, the entropy remains active — the corrective action did not resolve it. If the re-scan finds no drift, the entropy alert is marked as resolved (not just acknowledged).

**This is the critical distinction:** Acknowledging an entropy alert says "I know about this." Resolving an entropy alert (via re-scan confirmation) says "the underlying drift is no longer present."

### Post-Emergency PRE Determinism Verification

After any emergency event — particularly after EMERGENCY_FREEZE exit — PRE determinism is re-verified before the system returns to full HEALTHY status.

Determinism verification: the same corpus packet is submitted to PRE.resolve() 5 consecutive times with identical inputs. All 5 outputs must have identical hashes. Any variation is a determinism failure and re-triggers the EMERGENCY_FREEZE investigation path.

This verification is not manual — it runs as part of the HEALTHY transition confirmation. The platform admin initiating the READ_ONLY → HEALTHY transition sees the determinism check results before the transition completes.

### Recovery Is Not Complete Until the System Confirms It

This principle applies to every recovery action. The operator's conviction that the fix worked is not the confirmation. The system's own verification — re-scan, parity trend, determinism check, circuit breaker status — is the confirmation.

Operators who declare recovery complete before system confirmation risk operating in a false HEALTHY state. The system must present the verification status clearly: "Recovery action completed. Verifying resolution... [progress indicator]. Resolution confirmed." or "Recovery action completed. Verification in progress — do not declare incident resolved until confirmation appears."

---

## 4. Operator Recovery Psychology

### Operators Must Never Feel Trapped

The most dangerous moment in system recovery is when an operator does not know what action is available to them. A trapped operator improvises. Improvisation in a constitutional system creates uncontrolled state transitions that may be worse than the original failure.

The system prevents this by ensuring that in any constitutional state, there is always a visible "safe first action" — something the operator can do that is guaranteed not to make things worse. Typically:
- In DEGRADED: review the entropy or circuit breaker report (read-only, no risk)
- In CONSTITUTIONAL_RISK: review the divergence report; escalate to ENTERPRISE_ADMIN
- In READ_ONLY: review the audit log; contact PLATFORM_ADMIN
- In EMERGENCY_FREEZE: view the state explanation; contact PLATFORM_ADMIN

The "safe first action" is always read-only or escalation — actions that gather information or pass responsibility to a role with more authority. These actions cannot make the situation worse.

### Recovery Actions Are Reversible Where Possible

The recovery action catalogue is ordered from most-reversible to least-reversible:

| Action | Reversibility |
|---|---|
| OVERRIDE_EMERGENCY | Easily reversible: clear the emergency override |
| ASSET_RESYNC | Easily reversible: assets can be removed or re-versioned |
| CANARY_ROLLBACK | Reversible: re-approval can advance the canary again |
| CORPUS_ROLLBACK | Reversible: re-publish the reverted content |
| CIRCUIT_BREAKER_RESET | Partially reversible: the breaker can re-open if the underlying issue recurs |
| CONSTITUTIONAL_RESET | Irreversible in direction: cannot re-enter EMERGENCY_FREEZE without a new triggering event |

**The escalation ladder principle:** Prefer reversible actions early in recovery. Use OVERRIDE_EMERGENCY to stabilize while investigating rather than immediately committing to CORPUS_ROLLBACK. The escalation ladder runs: emergency stabilization → targeted fix → broad rollback → constitutional intervention. Do not jump steps unless the severity demands it.

### Soft → Hard → Freeze: The Escalation Ladder in Practice

When a content failure is detected, the default escalation path is:

1. **Emergency stabilization (soft):** OVERRIDE_EMERGENCY to hold screens at safe content. Reversible immediately.
2. **Targeted investigation:** Use audit, screen introspection, and entropy reports to identify root cause.
3. **Targeted fix:** ASSET_RESYNC or corpus update to address the specific failure point. Reversible.
4. **Broad rollback (hard):** CORPUS_ROLLBACK or CANARY_ROLLBACK if the targeted fix is insufficient. Reversible but with larger scope.
5. **Constitutional intervention (freeze):** EMERGENCY_FREEZE is entered by the system, not triggered by the operator, when the GlobalConstitutionalBreaker determines a halt is required. Exit requires PLATFORM_ADMIN.

Operators do not jump to CORPUS_ROLLBACK without attempting targeted fixes. Operators do not initiate constitutional resets — the system does this automatically when warranted. The operator's role in the escalation ladder is to take the minimum necessary action at each step and verify before proceeding.

### Post-Incident Review Is Not Punitive

The audit trail — every PRE invocation, every state transition, every alert acknowledgment, every handover report — exists for system improvement, not blame assignment.

Post-incident review asks: what happened, what could have detected it sooner, what could have contained it faster, and what design or training change would reduce the likelihood or impact of recurrence? It does not ask: which operator made the mistake?

Operators who fear post-incident review will hide incidents, delay escalation, and avoid documenting their actions. This is the most dangerous possible outcome for a constitutionally governed system where audit trail integrity is a first-class property.

The culture around incident review must be explicitly non-punitive. This is not a soft aspiration — it is an operational requirement. Post-incident reviews that result in operator blame, rather than system improvement, must be escalated as organizational failures.

---

## 5. Recovery Readiness Requirements

The system must maintain continuous readiness for recovery operations. The following conditions must hold at all times:

**Rollback targets must always be available.** The previous corpus version must be retained and accessible for CORPUS_ROLLBACK. If retention policy would delete the rollback target, the delete must be blocked until a new stable corpus version has been established.

**Emergency content must always be verified.** The content configured for OVERRIDE_EMERGENCY must be verified at least weekly. A recovery procedure that triggers emergency content only to find the emergency content asset is missing is a compounding failure.

**Circuit breaker states are monitored, not just reacted to.** Platform admins should be aware of circuit breaker trends before they trip. A PRECircuitBreaker that has been HALF_OPEN twice in 48 hours is showing signs of instability that warrant investigation before the third trip.

**Recovery action authority is always available.** At any point in time, there must be an operator with PLATFORM_ADMIN authority who is reachable. The on-call platform admin schedule must have no gaps. If a PLATFORM_ADMIN cannot be reached, there is no safe path to EMERGENCY_FREEZE exit — this is a business continuity failure.
