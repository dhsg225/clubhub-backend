# Low-Confidence State Handling

**Version:** 1.0
**Status:** Authoritative
**Scope:** System behavior and operator experience for all non-HEALTHY constitutional states
**Related:** OPERATOR-MENTAL-LOAD.md, HIGH-TRUST-WORKFLOWS.md, RECOVERY-ORIENTED-DESIGN.md

---

## Purpose

The ClubHub TV system operates across eight constitutional states. Only HEALTHY represents fully nominal operation. All other states represent degrees of degradation, uncertainty, or halt. This document defines how the system presents itself to operators in each non-HEALTHY state: what they see, what they can do, what is blocked, why the system is in that state, and how long they can expect to be there.

The governing principle is operational honesty. A degraded system that pretends to be healthy is worse than a degraded system that accurately describes its condition. Operators who know the system is in DEGRADED state can make appropriately calibrated decisions. Operators who believe the system is HEALTHY when it is not will make decisions based on false assumptions.

This principle has a corollary: the system must not overstate degradation. A system that shows CONSTITUTIONAL_RISK when it should show DEGRADED is also dishonest — it wastes operator attention and erodes trust in the state reporting itself.

---

## State Reference

The eight constitutional states and their structural significance:

| State | Significance |
|---|---|
| HEALTHY | All subsystems nominal; PRE authoritative; no active alerts |
| DEGRADED | One or more subsystems degraded; content delivery continuing |
| CONSTITUTIONAL_RISK | CLASS_3 divergence detected; parity review required; canary blocked |
| SHADOW_ONLY | PRE running alongside legacy; not yet authoritative; parity being earned |
| PRE_DISABLED | PRE halted by circuit breaker; legacy serving all content |
| READ_ONLY | ConstitutionalBreaker tripped; no mutations permitted; PLATFORM_ADMIN required |
| EMERGENCY_FREEZE | Global halt; all operations paused; PLATFORM_ADMIN + human token required to exit |
| INITIALIZING | System startup or state recovery in progress (brief transitional state) |

---

## 1. DEGRADED State

### What Caused This State

DEGRADED state is entered when one or more subsystems report health warnings but content delivery remains functional. Common causes:
- Entropy circuit breaker approaching threshold (multiple venues with elevated drift)
- Shadow circuit breaker in HALF_OPEN (recovery probe after failures)
- One or more venue screens with sustained offline status
- PRE response latency elevated above warning threshold without triggering full circuit breaker

DEGRADED does not mean content is wrong. It means the system is operating under reduced certainty about one aspect of its operation.

### What Operators See

**Status banner (venue-level):** An amber status bar appears across the top of the operator interface:
> "System is DEGRADED at [venue name]. [Specific cause in plain language]. Content delivery is continuing normally."

The status banner does not disappear on navigation. It is persistent until the state resolves.

**Dashboard indicator:** The system health indicator (always-visible, Tier 1 in the information hierarchy) shows DEGRADED with an amber indicator and a one-line cause description.

**Alert in feed:** A HIGH alert is generated with specific cause, trend (improving/worsening), and recommended action.

### What Operators Can Still Do

In DEGRADED state, operators retain full publishing authority. All content management actions — schedule changes, campaign management, override creation, emergency triggers — remain available.

The exception is any action directly related to the degraded subsystem. If the degradation is related to shadow comparison (shadow circuit breaker in HALF_OPEN), canary promotion approval is suspended. If degradation is related to entropy, entropy acknowledgment is still available.

### What Is Blocked

No content management operations are blocked in DEGRADED state. This is a key design principle: degradation affects system health monitoring, not operator authority over content.

Canary stage advancement may be blocked if the degradation is related to parity or the shadow subsystem.

### Primary Action

The recommended action depends on the cause of degradation. The status banner links directly to the relevant subsystem report (entropy report if entropy-related, circuit breaker status if breaker-related). The operator's first action is to review the report and determine whether the degradation is expected (e.g., a known content update causing temporary entropy) or unexpected.

### Expected Duration

Degraded states typically resolve within minutes to hours depending on cause:
- Entropy-related: resolves when content drift is corrected or acknowledged
- Circuit breaker HALF_OPEN: resolves within the recovery_probe_ms window (30 seconds) if probe succeeds
- Screen offline: resolves when network connectivity is restored

The system surface does not estimate duration (duration is often uncertain), but it shows whether the condition is improving or worsening: "Entropy severity: declining over last 30 minutes" or "Shadow comparison parity: stable at 0.9997 for last 2 hours."

---

## 2. CONSTITUTIONAL_RISK State

### What Caused This State

CONSTITUTIONAL_RISK is entered when a CLASS_3 divergence is detected: PRE.resolve() and the legacy resolver produced meaningfully different results, with the difference classified as a semantic-level divergence (not a metadata difference). This is a significant parity event because it means the new resolver would serve different content than the current system if it were authoritative.

Specifically, CLASS_3 divergence means the divergence affects a SEMANTIC_FIELD (content selection, sponsorship allocation, or emergency precedence) and the divergence has met the threshold for requiring human review.

### What Operators See

**Status banner (venue or fleet level, depending on scope):** A red status bar with a clear, non-technical description:
> "Constitutional Risk detected. The new content resolution system produced a different result than the current system. Canary promotion is blocked. Review required."

**Explanation link:** One click from the status banner opens a plain-language explanation of what was different (which content field, what the difference was) without requiring the operator to interpret divergence_class or delta values.

**Canary promotion blocked indicator:** If the system was in any canary stage, the promotion controls are visually disabled with a tooltip: "Canary promotion is blocked while CONSTITUTIONAL_RISK state is active. ENTERPRISE_ADMIN review required."

### What Operators Can Still Do

All content management operations continue. Content is being served by the legacy resolver. CONSTITUTIONAL_RISK does not affect content delivery — it is a governance state, not a delivery failure.

Operators can:
- View content, run previews, manage schedules and campaigns
- Review entropy reports, audit history, screen status
- Create and manage overrides
- Trigger emergencies if needed

### What Is Blocked

- Canary stage advancement
- Any action that would advance the canary pathway

### Who Should Act

ENTERPRISE_ADMIN reviews the divergence report and decides: acknowledge the divergence as acceptable (with documented justification), request investigation before proceeding, or roll back the canary to a previous stage.

VENUE_OPERATORs and REGIONAL_MANAGERs do not take direct action on CONSTITUTIONAL_RISK state. Their role is to continue normal operations and inform their ENTERPRISE_ADMIN that the state exists.

### Primary Action (For Each Role)

- **VENUE_OPERATOR:** Continue normal operations. Note the state in shift handover. No direct action required.
- **REGIONAL_MANAGER:** Ensure ENTERPRISE_ADMIN has been notified. Continue regional operations.
- **ENTERPRISE_ADMIN:** Open the divergence report. Review the specific CLASS_3 event. Decide: acknowledge, investigate, or rollback.
- **PLATFORM_ADMIN:** Available for consultation on whether the divergence indicates a constitutional integrity issue.

### Expected Duration

CONSTITUTIONAL_RISK state is held until the ENTERPRISE_ADMIN reviews and takes action. There is no automatic resolution. The state may persist for hours or days if the enterprise admin is not immediately available. This is acceptable — content is still being served normally, and the state is explicitly visible to all operators.

---

## 3. SHADOW_ONLY State

### What Caused This State

SHADOW_ONLY means PRE.resolve() is actively running and comparing its output against the legacy resolver, but PRE is not yet authoritative. This is the expected state during early canary evaluation (SHADOW_ONLY and INTERNAL_CANARY stages). The system entered this state because the platform team initiated the canary process.

SHADOW_ONLY is not a degraded state — it is a deliberate evaluation state. It means the upgrade pathway is actively proceeding.

### What Operators See

**Status banner (informational, not urgent):** A blue status indicator:
> "New resolution engine is running in shadow mode. Current content delivery is unaffected. Parity evaluation in progress."

This is not an error or warning banner. It is an informational status that explains why the system shows parity data in the dashboard.

**Parity display:** In SHADOW_ONLY state, the parity summary becomes visible in the Tier 2 dashboard (one click from home): current parity ratio, number of comparisons, CLASS_3/4 counts, current stage. This information is not shown in HEALTHY state because it is not relevant to routine operations.

### What Operators Can Still Do

All operations are available in SHADOW_ONLY state. PRE is not serving any content — it is only observing and comparing. The shadow system has no side effects on content delivery.

### What Is Blocked

Nothing is blocked. SHADOW_ONLY is a monitoring state, not a restriction state.

### Primary Action

VENUE_OPERATORs have no required action. The parity information is visible for awareness.

ENTERPRISE_ADMINs monitor the parity ratio trend and await the canary gate threshold being met before considering promotion.

### Expected Duration

SHADOW_ONLY state is held for a configured evaluation period (typically days to weeks). The system does not estimate completion — it shows the current parity ratio and the threshold required for promotion. When the threshold is met and the configured minimum comparison volume is reached, an ENTERPRISE_ADMIN receives a canary promotion notification.

---

## 4. PRE_DISABLED State

### What Caused This State

PRE_DISABLED means the PRECircuitBreaker has opened. PRE failed 3 consecutive times (threshold=3) and the circuit breaker stopped calling it. The legacy resolver is now serving all content. This happened automatically as a protective measure to prevent degraded PRE performance from affecting content delivery.

### What Operators See

**Status banner (HIGH severity, amber):**
> "New resolution engine is paused. The current system is serving all content normally. The new engine experienced repeated failures and has been temporarily disabled. [Link: View circuit breaker status]"

**Circuit breaker status accessible:** One click from the banner shows: when the breaker opened, the number of failures before it opened, the last error recorded, and the current state (OPEN or HALF_OPEN during recovery probe).

### What Operators Can Still Do

All content management operations continue. From a content delivery perspective, PRE_DISABLED looks identical to a pre-canary system — the legacy resolver is handling everything.

### What Is Blocked

- Canary stage advancement (PRE must be functioning for canary to proceed)
- Shadow comparison (shadow runner depends on PRE output)

### Primary Action

This state requires PLATFORM_ADMIN awareness and investigation. The root cause of PRE failure must be determined before the circuit breaker is reset.

- **VENUE_OPERATOR/REGIONAL_MANAGER:** Continue normal operations. Escalate to ENTERPRISE_ADMIN who will escalate to PLATFORM_ADMIN.
- **PLATFORM_ADMIN:** Review PRE error logs, determine root cause, remediate, then initiate circuit breaker recovery probe.

### Expected Duration

PRE_DISABLED state holds until the PRECircuitBreaker is manually reset (HALF_OPEN recovery probe) after PLATFORM_ADMIN investigation. Automatic recovery (HALF_OPEN probe) happens after recovery_probe_ms=30000 — but only if the root cause has been addressed. If the probe fails, the breaker returns to OPEN and the state continues.

The system does not estimate resolution time. It shows the circuit breaker's current sub-state (OPEN vs. HALF_OPEN) so operators know whether recovery is being attempted.

---

## 5. READ_ONLY State

### What Caused This State

READ_ONLY means the GlobalConstitutionalBreaker has entered its READ_ONLY threshold. This occurs when the system has detected a constitutional integrity condition that warrants halting all mutations to protect data consistency. Typical triggers: multiple circuit breakers tripping in a correlated pattern, or a constitutional boundary violation detected by contract enforcement.

This is a serious state. It is not entered casually.

### What Operators See

**Status banner (red, top of every screen):**
> "The system is in Read-Only mode. All content changes are blocked to protect system integrity. Content is playing normally. Platform Administrator review is required."

**Blocked action indicators:** Every action that would create a mutation (publish campaign, create override, update schedule, trigger emergency, clear emergency) is visually disabled. Disabled controls show a tooltip explaining:
> "This action is blocked while the system is in Read-Only mode. A constitutional integrity check failed. Contact your Platform Administrator."

This tooltip is specific and accurate — it does not say "something went wrong." It says exactly what condition is causing the block.

**PLATFORM_ADMIN contact information:** The status banner includes the configured PLATFORM_ADMIN contact (name, escalation channel). This is not a buried settings page — it is in the banner because it is the most important thing to know in READ_ONLY state.

### What Operators Can Still Do

Read-only operations remain fully available:
- View current schedule, campaign status, screen status
- Run content previews (preview uses a read-only path through PRE)
- Review audit history and forensic replay
- Review entropy reports and parity reports
- View active overrides (cannot create or modify)
- View active emergencies (cannot clear or create new ones)

Note: the inability to clear an active emergency in READ_ONLY state is an important operational consideration. If an emergency is active when the system enters READ_ONLY, it stays active until the system exits READ_ONLY. This is by design — allowing emergency clearance during READ_ONLY would require a write operation.

### What Is Blocked

- All content mutations: publishing campaigns, schedule changes
- Override creation, modification, or clearance
- Emergency trigger or clearance
- Any canary governance actions

### Primary Action

**VENUE_OPERATOR:** Continue monitoring. Do not attempt to publish or override. Escalate to REGIONAL_MANAGER → ENTERPRISE_ADMIN → PLATFORM_ADMIN through the escalation path.

**PLATFORM_ADMIN:** This is your event. Investigate the constitutional integrity condition that triggered READ_ONLY. Determine whether the GlobalConstitutionalBreaker can be safely reset. The reset procedure requires a human authorization token — this is not reversible without deliberate human action.

### Expected Duration

READ_ONLY state holds until PLATFORM_ADMIN investigation and deliberate reset. There is no automatic exit. The system does not estimate duration because it cannot — the investigation timeline is unknown.

The system does not create urgency pressure ("resolve this within X minutes"). READ_ONLY is the correct state for the system to be in while a constitutional integrity issue is being investigated. The urgency of resolution is a business decision, not a system demand.

---

## 6. EMERGENCY_FREEZE State

### What Caused This State

EMERGENCY_FREEZE is the most severe state in the system. The GlobalConstitutionalBreaker has determined that a condition requires halting all operations — not just mutations, but the entire operational system. Typical causes: replay nondeterminism detected (ReplayCircuitBreaker threshold=1 tripped, meaning this is an immediate CLASS_4 event), or a combination of constitutional violations that individually might trigger READ_ONLY but collectively indicate a systemic integrity failure.

### What Operators See

EMERGENCY_FREEZE must be the most visible system state possible. There is no ambiguity in presentation.

**Full-screen state indicator:** On login, EMERGENCY_FREEZE is shown as a full-screen state, not a banner. The operator must acknowledge they see it before accessing other views.

**State description in plain language:**
> "The system has detected a data integrity concern and has paused all operations to protect content accuracy. This is a precautionary measure. Your screens are displaying the last verified content."

This description is accurate and non-alarming. It explains what happened (integrity concern), why (precaution), and the current content state (last verified content is playing). It does not use technical terminology ("replay nondeterminism", "CLASS_4 event") in the primary display.

**What is playing:**
> "Screens are displaying the last verified content. [Content name] is running on [N] screens. No changes have been made to this content since [timestamp]."

Operators need to know that screens are not dark and that the content playing is the last known-good content, not random or incorrect content.

**Who to contact:**
> "This state requires Platform Administrator action. Contact: [PLATFORM_ADMIN name, escalation number/channel]."

The PLATFORM_ADMIN identity and contact is the most visible piece of escalation information in the interface.

**Timeline — no estimate:**
> "Resolution timeline: Unknown. This state is resolved when the Platform Administrator completes their investigation and confirms system integrity."

This is honest. False estimates (e.g., "should be resolved in 1–2 hours") create expectations the system cannot guarantee. Operators are better served by accurate uncertainty than inaccurate precision.

**Technical detail accessible, not prominent:** The specific events that caused EMERGENCY_FREEZE are accessible in one click for PLATFORM_ADMIN and ENTERPRISE_ADMIN, but are not the primary display for VENUE_OPERATOR or REGIONAL_MANAGER. Technical detail is available to those who need it; it does not obscure the operational message for those who don't.

### What Operators Can Still Do

EMERGENCY_FREEZE freezes all mutations and all non-essential system operations. However, operators can still:
- View current system state
- Access the forensic audit log (read-only)
- View what is playing on screens (last known state)
- View contact information for PLATFORM_ADMIN

Operators cannot:
- Make any content changes
- Create or clear overrides
- Trigger or clear emergencies
- View live preview (preview uses PRE, which is frozen)

### Who Can Exit EMERGENCY_FREEZE

Only PLATFORM_ADMIN can exit EMERGENCY_FREEZE, and only with a human authorization token. This is a deliberate two-factor requirement:
1. PLATFORM_ADMIN role authentication
2. A non-system-generated human token (the platform admin must explicitly confirm they authorize the exit)

The system must not make the EMERGENCY_FREEZE exit "easy." The friction is appropriate to the severity of the event. A PLATFORM_ADMIN who exits EMERGENCY_FREEZE without understanding what caused it and what has been verified since is creating new risk.

### Exit Confirmation

Before exiting EMERGENCY_FREEZE, the PLATFORM_ADMIN sees:
- What caused the freeze (specific events, timestamps)
- What has been verified since the freeze (what investigation was completed)
- What state the system will transition to (typically READ_ONLY, not immediately HEALTHY)
- Explicit confirmation: "I confirm that the condition that caused this freeze has been investigated and addressed."

The platform admin enters their human authorization token and confirms. The exit event is logged immutably.

---

## 7. Partial Degradation: Mixed-State Fleets

In a real enterprise deployment, it is common for some venues to be in HEALTHY state while others are in DEGRADED or CONSTITUTIONAL_RISK. The system must present this accurately.

### Fleet View (ENTERPRISE_ADMIN)

The fleet health dashboard shows per-venue constitutional states. Each venue appears with its current state indicator. The fleet summary shows:
- Count of venues in each state (e.g., "42 HEALTHY, 3 DEGRADED, 1 CONSTITUTIONAL_RISK")
- Aggregate health trend (improving, stable, worsening)
- Any venues requiring immediate action

A single venue in CONSTITUTIONAL_RISK does not put the entire fleet in CONSTITUTIONAL_RISK. States are scoped to the venue where they occur.

### Regional View (REGIONAL_MANAGER)

The regional dashboard shows the per-venue health grid within the region. A regional manager sees which venues they are responsible for and which are in non-HEALTHY states. They can drill down to the specific venue without affecting other venues.

**Key principle:** Healthy venues continue operating normally. Degraded state is scoped. A venue in DEGRADED state does not contaminate the operational status of neighboring venues. The system isolates degradation to its actual scope and does not over-report.

### Venue View (VENUE_OPERATOR)

A venue operator sees only their venue's state. If their venue is HEALTHY, they see a HEALTHY system — they are not shown the DEGRADED state of another venue. This is appropriate scope isolation: a venue operator cannot act on another venue's degradation, so surfacing it creates noise without enabling action.

The exception: if a fleet-wide event (EMERGENCY_FREEZE or fleet-wide READ_ONLY) affects all venues, all operators see the fleet-level state.

---

## Summary: State Operator Experience Matrix

| State | Primary Operator Impact | Content Delivery | Mutations Blocked | Who Acts |
|---|---|---|---|---|
| HEALTHY | Normal operations | Normal | None | All roles (routine) |
| DEGRADED | Monitoring degraded; amber alert | Normal | None | VENUE_OPERATOR/REGIONAL_MANAGER |
| CONSTITUTIONAL_RISK | Canary blocked; review required | Normal (legacy) | Canary advancement | ENTERPRISE_ADMIN |
| SHADOW_ONLY | Parity visible; no action required | Normal (legacy) | None | ENTERPRISE_ADMIN (monitors) |
| PRE_DISABLED | Circuit breaker open; PRE offline | Normal (legacy) | Canary advancement | PLATFORM_ADMIN |
| READ_ONLY | No mutations; contact PLATFORM_ADMIN | Normal (legacy) | All mutations | PLATFORM_ADMIN |
| EMERGENCY_FREEZE | All halted; last verified content | Last known-good | All operations | PLATFORM_ADMIN + human token |
