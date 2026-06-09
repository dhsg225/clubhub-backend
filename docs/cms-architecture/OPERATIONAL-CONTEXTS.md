# ClubHub TV — Operational Contexts
# Information Architecture Layer

**Document type:** Operational context model — authoritative system state and mode definitions
**Authority:** CMS Architecture / Platform Engineering
**Audience:** Backend engineers, CMS implementation, UX, agent phases 3–7
**Last updated:** 2026-05-26
**Status:** CANONICAL — all operational state handling must conform to this model

---

## Purpose

This document defines the operational contexts that shape how the ClubHub TV system presents
and behaves. An operational context is the combination of:

1. **Operational mode** — the current PRE authority state (NORMAL, SHADOW, CANARY, etc.)
2. **Market vertical context** — market-specific behavioral modifiers (TOURNAMENT_ACTIVE, JACKPOT_ACTIVE, EVENT_ACTIVE)
3. **Constitutional state** — whether constitutional constraints limit or halt system operation

Operational contexts are not UI themes or display preferences. They are authoritative system
states that determine which entities are active, which APIs are available, which mutations are
permitted, and what content appears on screens. An operator's interface must accurately reflect
the active operational context at all times. An operator who is unaware of the context cannot
operate safely.

---

## Governing Philosophy

**Context is not optional information.** When the system is in SHADOW mode, every operator
needs to know — because their campaign edits are being evaluated against a parity baseline
they cannot see unless they understand the mode. When a venue is in EMERGENCY mode, every
operator touching that venue needs to see that state immediately.

**Context transitions are events, not configuration.** Entering and exiting an operational
mode is an audited event. It is not a setting that an operator toggles in a form field and
forgets about. The transition itself — who triggered it, when, from what previous state —
is as operationally significant as the resulting state.

**Constitutional states propagate unconditionally.** READ_ONLY and EMERGENCY_FREEZE are
visible to every authenticated user regardless of role, scope, or organizational context.
These states affect the platform's fundamental ability to operate, and operators at every
level need that information to make sense of their experience.

---

## Section 1 — Operational Mode Definitions

Eight operational modes exist. Every venue is in exactly one operational mode at any given
time. The platform itself (independently of individual venues) also has a system-level
operational mode that applies to cross-cutting infrastructure (parity comparison, canary
promotion gates, corpus delivery).

### 1.1 NORMAL

**Definition:** Full PRE authority. All resolution levels active. All CMS features available.
No active parity comparison. No canary gates. No circuit breakers tripped.

**PRE behavior:** Full 7-level resolution (L0–L6). No constraints beyond those encoded in
the resolution hierarchy and invariants.

**CMS behavior:** All features available. All mutations permitted (subject to role authority).
Campaign management, override creation, emergency activation, corpus deployment — all operational.

**Operator experience:** No operational mode indicator beyond the absence of other state
indicators. The absence of badges and banners is itself the NORMAL state signal.

**Entry conditions:** Platform starts in NORMAL. Returns to NORMAL after SHADOW, CANARY,
and DEGRADED modes are resolved. Returns to NORMAL after circuit breaker reset from READ_ONLY.

**Exit conditions:** Any of the following transitions the system or a venue out of NORMAL:
- Shadow mode activation (platform-level decision, PLATFORM_ADMIN)
- Canary promotion to a subset of fleet (ENTERPRISE_ADMIN+)
- Entropy alert elevation to CRITICAL (automatic, entropy scheduler)
- Emergency activation at any scope (authorized role)
- Circuit breaker trip (automatic, failure detection subsystem)
- EMERGENCY_FREEZE trigger (PLATFORM_ADMIN)

---

### 1.2 SHADOW

**Definition:** PRE runs alongside the legacy system. Both systems evaluate every screen poll.
PRE output is compared to legacy output. ParityRecords are generated. PRE output is NOT
served to screens — the legacy system continues to serve manifests. SHADOW is a validation
mode, not a production mode.

**PRE behavior:** PRE.resolve() is invoked on every screen poll. Output is captured and
compared to legacy output. PRE output is not delivered to any screen. Parity comparison
produces ParityRecords with divergence_class classification.

**CMS behavior:** All campaign management and content editing is available. Changes affect
the corpus that the PRE evaluates in shadow — they do not affect what screens currently show
(because the legacy system is serving manifests). This is an important operator communication
requirement: operators editing campaigns during SHADOW mode must understand that their changes
are being shadowed, not deployed.

**Operator experience:**
- Fleet Workspace: system-level SHADOW mode banner in workspace header
- Venue Workspace: SHADOW mode indicator in venue header
- Campaign edit forms: a SHADOW mode notice: "This venue is in shadow mode. Campaign changes affect shadow evaluation only. Screens continue to receive legacy output."
- Audit Workspace: Parity log is active and receiving new records

**Entry conditions:** Activated by PLATFORM_ADMIN via Governance Workspace. Requires
EMERGENCY_FREEZE and READ_ONLY to not be active. A transition audit record is generated.

**Exit conditions:**
- Promoted to CANARY: ENTERPRISE_ADMIN+ triggers canary promotion after parity gates pass
- Reverted to NORMAL: PLATFORM_ADMIN determines shadow validation is complete and no canary is needed
- Forced to READ_ONLY: circuit breaker trips during shadow mode

**Parity gate for SHADOW → CANARY promotion:**
Before canary promotion is permitted, the shadow comparison must show:
- No CLASS_4 divergences (blocking)
- No unreviewed CLASS_3 divergences
- Sufficient ParityRecord volume (configurable threshold; default: 1000 records per venue)
- Parity record age: records must span at least 24 hours of operation

---

### 1.3 CANARY

**Definition:** PRE is serving a subset of the fleet (a "canary group"). The canary group's
screens receive PRE-resolved manifests. The remainder of the fleet continues to receive legacy
system output (or is itself a previously promoted NORMAL group). Parity comparison continues
between PRE-served and legacy-served screens.

**PRE behavior:** PRE.resolve() serves manifests to canary group screens. Resolution is live
and production. For non-canary screens in the same venue, the legacy system serves manifests.

**CMS behavior:** Campaign management is available. Operators editing campaigns must understand
that their changes immediately affect canary-group screens. Non-canary screens remain on the
legacy system.

**Operator experience:**
- Fleet Workspace: CANARY mode badge on affected venues
- Venue Workspace: CANARY banner showing which DeploymentGroups are in canary, canary duration, parity gate status, and promotion/rollback controls (ENTERPRISE_ADMIN+ only)
- Screen detail: individual screens indicate whether they are in the canary group (PRE-served) or not (legacy-served)
- VENUE_OPERATOR: sees canary status in read-only mode; cannot trigger promotion or rollback

**Entry conditions:** Promoted from SHADOW by ENTERPRISE_ADMIN+ after parity gates pass.
A transition audit record is generated naming who promoted, when, and the parity gate results.

**Exit conditions:**
- Promoted to NORMAL (full fleet): ENTERPRISE_ADMIN+ promotes the remaining screens after canary parity gates pass. The legacy system is decommissioned for this venue.
- Rolled back to SHADOW: parity gates detect CLASS_4 divergence on canary screens; ENTERPRISE_ADMIN+ triggers rollback. Canary screens return to legacy system. Rollback is audited.
- Rolled back to NORMAL (legacy): If the canary approach itself is abandoned, the canary group returns to legacy system, and the venue returns to NORMAL (legacy-served).

**Canary promotion gates (CANARY → NORMAL):**
- No CLASS_4 divergences in the canary period
- No unreviewed CLASS_3 divergences
- Canary duration minimum: 24 hours
- Parity record volume: 500 records per canary group
- ENTERPRISE_ADMIN+ explicit promotion action with confirmation

---

### 1.4 DEGRADED

**Definition:** Entropy alerts are CRITICAL for one or more venues. Corpus drift between
expected and deployed state is severe enough that PRE confidence in its outputs is reduced.
PRE continues to resolve, but the entropy subsystem has flagged that what screens are actually
displaying may diverge from what PRE expects.

**PRE behavior:** PRE.resolve() continues normally. L6 device truth annotation reflects low
confidence scores for affected screens. Fallback frequency may increase if devices are failing
to poll.

**CMS behavior:** All features available. Override creation and emergency activation remain
available. The DEGRADED mode is an alert state, not a restriction state. Operators can
continue to make changes — but are warned that entropy drift may mean those changes take
longer than expected to reach screens.

**Operator experience:**
- Fleet Workspace: DEGRADED badge on affected venues with entropy severity
- Venue Workspace: CRITICAL entropy alert badge in workspace header; entropy detail prominently surfaced
- Entropy Workspace: Entropy report detail with affected screens, drift types, and recommended corrective actions

**Entry conditions:** Automatic. Entropy scheduler elevates to CRITICAL based on corpus drift
thresholds (configurable per deployment; default: >5% of venue screens with corpus mismatch,
or any screen offline >10 minutes with undelivered corpus update).

**Exit conditions:** Automatic. Entropy scheduler returns to WARNING or NONE when drift is
resolved (re-deployment confirmed, screens back online and synced). DEGRADED → NORMAL when
all entropy alerts return to NONE.

**DEGRADED + EMERGENCY combination:**
A venue in both DEGRADED (critical entropy) and EMERGENCY state simultaneously is a
precondition for EMERGENCY_FREEZE consideration. The combination means: screens may not be
showing the emergency content (entropy drift) and there is an active emergency (content
criticality is high). This combination is surfaced to PLATFORM_ADMIN as an EMERGENCY_FREEZE
recommendation, but does not automatically trigger freeze. Human decision is required.

---

### 1.5 EMERGENCY

**Definition:** An Emergency (L0) is active at one or more scopes within the venue or platform.
All screens within the emergency scope are resolving at L0. All other resolution levels are
bypassed for in-scope screens.

**PRE behavior:** For in-scope screens: PRE.resolve() terminates at L0 with the Emergency's
Playlist. Reason trace records the emergency ID, scope, and trigger reason. For out-of-scope
screens (e.g., a zone-scoped emergency only affects that zone): normal resolution continues.

**CMS behavior:** Campaign management, override creation, and all other features remain
available for out-of-scope entities. For in-scope screens, new campaigns, overrides, and
sponsorships have no effect until the emergency is cleared — they are valid inputs but are
bypassed by L0.

**Operator experience:**
- Fleet Workspace: Emergency banner across all affected venues; time-since-activation
- Venue Workspace: Emergency panel indicator in workspace header; permanent across all sub-contexts; acknowledgment action for authorized roles
- All in-scope screens in the Screen view show "L0 — EMERGENCY" as their resolution level with the emergency's reason
- Campaign list shows affected campaigns as "SUSPENDED — EMERGENCY ACTIVE"

**Entry conditions:** Operator activation (VENUE_OPERATOR+ for venue/zone scope). Generates
immediate audit record. Emergency Playlist must be pre-approved.

**Exit conditions:** Human acknowledgment. No auto-expiry. Acknowledgment requires an
`acknowledgment_note`. After acknowledgment, PRE immediately re-evaluates in-scope screens
from L1 downward.

---

### 1.6 CONSTITUTIONAL_RISK

**Definition:** A CLASS_3 parity divergence has been detected and is unreviewed. The divergence
indicates a potentially significant behavioral difference between PRE and the legacy system
(or between corpus versions) that requires human review before promotion can proceed.

**PRE behavior:** Unaffected. PRE continues to resolve normally. CONSTITUTIONAL_RISK is a
governance alert, not an operational block (except on promotion gating).

**CMS behavior:** Canary promotion is blocked until all CLASS_3 divergences are reviewed by
ENTERPRISE_ADMIN+. All other features are available.

**Operator experience:**
- Governance Workspace: CONSTITUTIONAL_RISK alert in canary promotion panel; links to unreviewed ParityRecords
- Fleet Workspace: CONSTITUTIONAL_RISK badge on affected venues
- Audit Workspace (AUDITOR): CONSTITUTIONAL_RISK records are surfaced prominently in the parity log

**Entry conditions:** Automatic. Shadow or canary comparison subsystem detects a CLASS_3
divergence and creates an unreviewed ParityRecord.

**Exit conditions:** ENTERPRISE_ADMIN+ reviews all CLASS_3 ParityRecords and marks them
REVIEWED. The review includes a note explaining whether the divergence is acceptable
(expected due to a known difference) or requires remediation (indicates a PRE behavior
that must be corrected before promotion).

---

### 1.7 READ_ONLY

**Definition:** A circuit breaker has tripped, placing the platform in a read-only operational
state. No mutations are permitted. PRE continues to resolve and deliver manifests. Screens
continue to show content. But no operator can create, modify, or delete any CMS entity until
the circuit breaker is reset.

**PRE behavior:** Fully operational. Manifests are delivered normally. L0–L6 resolution
continues. Existing emergency states continue.

**CMS behavior:** All mutation APIs return 503 (Service Unavailable) with a body explaining
the READ_ONLY state and the active circuit breaker. Read APIs (GET requests) remain available.
Emergency activation is exempt from READ_ONLY (see Section 1.7.1 below).

**Operator experience:**
- All roles: System-wide banner in the browser viewport above the workspace header. Not dismissible. Content: "System is in READ_ONLY mode. [Circuit breaker name] tripped at [time]. Contact platform admin. [Support link]."
- All mutation controls hidden (not disabled).
- Emergency activation: Remains visible and functional (see below).

**1.7.1 Emergency Activation Exception in READ_ONLY:**
Emergency activation (L0 trigger) is deliberately exempt from READ_ONLY. The rationale:
READ_ONLY is triggered by infrastructure failure, not by content governance failure. A
venue-level emergency (e.g., fire alarm, evacuation message) must be activatable regardless
of infrastructure circuit breaker state. Emergency activation in READ_ONLY generates an
audit record noting the READ_ONLY context.

Emergency acknowledgment (clearance) is also exempt from READ_ONLY for the same reason.

**Entry conditions:** Automatic. Circuit breakers are defined in the failure model (FM-001
through FM-010; see `docs/failure-model/`). Examples: database write failure rate exceeds
threshold; hash chain integrity failure; entropy scheduler failure; audit log write failure.

**Exit conditions:** PLATFORM_ADMIN resets the circuit breaker via the Governance Workspace
after confirming the underlying failure condition is resolved. Reset generates an audit record.
Auto-reset with a time delay is not supported — human confirmation is required.

---

### 1.8 EMERGENCY_FREEZE

**Definition:** Full system halt triggered by PLATFORM_ADMIN with human-token confirmation.
No mutations of any kind. No new manifest deliveries. PRE is frozen — existing manifests
continue to be served by cached state on devices. The system is in a state of controlled
suspension pending investigation or major intervention.

**PRE behavior:** PRE.resolve() invocations are suspended. Screens receive their last cached
manifest (on-device fallback cache). If a device loses its cache (reboot), it receives the
L5 system fallback.

**CMS behavior:** All APIs return 503 with EMERGENCY_FREEZE status. No exceptions. Emergency
activation APIs are also unavailable — the system is in full halt, and the existing freeze
supersedes any venue-level emergency concern.

**Operator experience:**
- All roles: Full-viewport overlay (not a banner — it covers the workspace). Content: "System EMERGENCY_FREEZE active. [Triggering admin name] at [time]. [Human-token ID required for reset]."
- PLATFORM_ADMIN with valid human-token: Freeze management controls appear in the overlay.
- All other roles: Read-only status display and support contact information.

**Entry conditions:** PLATFORM_ADMIN explicit trigger via Governance Workspace, with
human-token confirmation. The human-token is a time-limited one-time code issued through
a separate channel (not the CMS itself) — it cannot be generated by the same session that
triggers the freeze. This two-channel requirement prevents a compromised PLATFORM_ADMIN
session from triggering and immediately resetting a freeze.

**Exit conditions:** PLATFORM_ADMIN provides the human-token via the freeze management
overlay. Reset generates a detailed audit record: who triggered, when, token ID, who
reset, when, reason for reset. After reset, the system returns to the operational mode
it was in before freeze.

---

## Section 2 — Market Vertical Operational Contexts

Market vertical contexts are behavioral modifiers that layer on top of the base operational
mode. They do not replace the operational mode — they add market-specific behaviors within it.

### 2.1 TOURNAMENT_ACTIVE (Golf market vertical)

**Trigger:** Activated when a golf venue has a tournament active in the tee-sheet integration.
May also be manually activated by VENUE_OPERATOR or REGIONAL_MANAGER.

**Behavioral modifications:**
- Leaderboard feed content is injected into the L3 campaign resolution (as a campaign linked to the tournament schedule).
- TOURNAMENT_NOTICE compliance assets become mandatory across all screens in the venue (added to `compliance_profile` for the duration).
- Content with duration_ms > 30,000 (30 seconds) is flagged as potentially disruptive during active tournament scoring windows (advisory, not blocking).
- PreviewSession for tournament times uses the tournament schedule as an active input, correctly simulating tournament content injection.

**CMS modifications:**
- Campaign creation form surfaces a "Tournament Context" section for campaigns targeting golf venues.
- Schedule builder shows tee times (from integration) as blocked windows.
- Venue Workspace header shows TOURNAMENT_ACTIVE badge.

**Entry conditions:** Automatic (tee-sheet integration detects tournament start) or manual
(VENUE_OPERATOR+ activation via Venue Workspace context controls).

**Exit conditions:** Automatic (tee-sheet integration detects tournament end) or manual
(VENUE_OPERATOR+ clearance). Clearance generates an audit record if manually cleared before
automatic detection.

---

### 2.2 JACKPOT_ACTIVE (Licensed clubs market vertical)

**Trigger:** Activated when a licensed venue's gaming monitoring system reports an active
jackpot state, or manually activated by VENUE_OPERATOR+.

**Behavioral modifications:**
- RESPONSIBLE_GAMBLING compliance assets become mandatory across all gaming zone screens (they are always required per the compliance profile, but JACKPOT_ACTIVE increases the mandatory inclusion frequency: every N minutes of play, a full-screen responsible gambling message must appear, overriding campaign content for that slot).
- The mandatory inclusion frequency rule is enforced at the corpus level — the compliance scheduler injects a high-frequency compliance schedule into gaming zone playlists.
- Non-gaming screens in the venue are not affected by JACKPOT_ACTIVE.
- Sponsor content in gaming zones is paused during mandatory compliance windows (the SOV calculation temporarily reduces to 0 for the compliance slot duration).

**CMS modifications:**
- Gaming zone Campaign creation form shows JACKPOT_ACTIVE frequency requirements.
- A JACKPOT_ACTIVE indicator appears in the gaming zone's ScreenZone detail.
- Override creation in gaming zones during JACKPOT_ACTIVE requires explicit acknowledgment that the operator understands the compliance window requirements.

**Entry conditions:** Automatic (gaming monitoring integration) or manual (VENUE_OPERATOR+).

**Exit conditions:** Automatic (gaming monitoring integration) or manual. Manual clearance
requires VENUE_OPERATOR+ and generates an audit record with the reason for manual clearance
before the automatic trigger.

---

### 2.3 EVENT_ACTIVE (Hotels/resorts market vertical)

**Trigger:** Activated when a hotel venue has a conference or event registered in the
property management system integration, or manually activated by VENUE_OPERATOR+.

**Behavioral modifications:**
- Event-specific content zones are activated (conference rooms, breakout areas, registration
  areas may have dedicated ScreenZones).
- Event playlists (pre-prepared for the event) become eligible at L3 for event-zone screens.
- General hotel content campaigns are suspended in event zones during the event schedule
  (event zone L2 Override is automatically created from the event booking and scheduled for
  the event's registered hours).
- Reception and lobby screens surface directional content (event room assignments,
  schedule overviews) via a campaign linked to the event schedule.

**CMS modifications:**
- Event management section in Venue Workspace (hotel venues only) for registering upcoming events.
- Event Workspace sub-context: pre-loaded with the event's zone configuration and content.
- VENUE_OPERATOR can preview event content injection using PreviewSession with the event schedule as a hypothetical input.

**Entry conditions:** Automatic (PMS integration) or manual.

**Exit conditions:** Automatic (event end time from PMS) or manual (VENUE_OPERATOR+ clearance).

---

## Section 3 — Context Transition Rules

### 3.1 Valid Transition Matrix

Not all operational mode transitions are valid. The following matrix defines permitted
transitions. "Direct" means the transition is permitted without intermediate states.
"Not permitted" means the transition requires passing through an intermediate mode.

| From \ To         | NORMAL | SHADOW | CANARY | DEGRADED | EMERGENCY | CONSTITUTIONAL_RISK | READ_ONLY | EMERGENCY_FREEZE |
|-------------------|:------:|:------:|:------:|:--------:|:---------:|:-------------------:|:---------:|:----------------:|
| NORMAL            | —      | Direct | No*    | Auto     | Direct    | Auto                | Auto      | Direct           |
| SHADOW            | Direct | —      | Direct | Auto     | Direct    | Auto                | Auto      | Direct           |
| CANARY            | Direct | Direct | —      | Auto     | Direct    | Auto                | Auto      | Direct           |
| DEGRADED          | Auto   | —      | —      | —        | Direct    | Auto                | Auto      | Direct           |
| EMERGENCY         | Auto** | —      | —      | Auto     | —         | Auto                | Auto      | Direct           |
| CONSTITUTIONAL_RISK | Auto | —      | —      | —        | —         | —                   | Auto      | Direct           |
| READ_ONLY         | Direct | —      | —      | —        | —         | —                   | —         | Direct           |
| EMERGENCY_FREEZE  | Direct | —      | —      | —        | —         | —                   | —         | —                |

*NORMAL → CANARY: Must pass through SHADOW first (canary requires parity baseline from shadow).
**EMERGENCY → NORMAL: Automatic after all emergencies in scope are acknowledged.
Auto = automatic transition triggered by system event; Direct = requires authorized human action.

### 3.2 Concurrent Mode Handling

Some modes coexist. When two modes apply simultaneously, both are surfaced:
- DEGRADED + EMERGENCY: Both indicators appear. EMERGENCY takes operational precedence for in-scope screens.
- SHADOW + DEGRADED: Both indicators. Shadow parity records note the entropy-degraded context.
- CANARY + EMERGENCY: Emergency is absolute; even canary-group screens resolve at L0. Canary metrics during an emergency period are excluded from promotion gating calculations.
- READ_ONLY + EMERGENCY: Emergency activation remains available (exempt from READ_ONLY).

### 3.3 Market Vertical Context Coexistence

Market vertical contexts (TOURNAMENT_ACTIVE, JACKPOT_ACTIVE, EVENT_ACTIVE) layer on top of
base operational modes. They do not transition the operational mode — they add behavioral
constraints within it.

- TOURNAMENT_ACTIVE during SHADOW: Tournament content is included in the PRE shadow evaluation. Parity records reflect whether the legacy system correctly handles tournament scheduling.
- JACKPOT_ACTIVE during EMERGENCY: The emergency (L0) supersedes the JACKPOT_ACTIVE compliance frequency requirements. Emergency content plays. JACKPOT_ACTIVE context is preserved but inactive while the emergency is live. On emergency clearance, JACKPOT_ACTIVE compliance requirements resume.
- EVENT_ACTIVE during READ_ONLY: Event-linked overrides cannot be created or modified (READ_ONLY blocks mutations). Existing event overrides that were created before READ_ONLY began continue to function. New events cannot be registered during READ_ONLY.

---

## Section 4 — Context Visibility by Role

Not all contexts are visible to all roles. The following table defines who sees what.

| Context                   | PLATFORM_ADMIN | ENTERPRISE_ADMIN | REGIONAL_MANAGER | VENUE_OPERATOR | SPONSOR_STAKEHOLDER | AUDITOR    |
|---------------------------|:--------------:|:----------------:|:----------------:|:--------------:|:-------------------:|:----------:|
| NORMAL                    | Yes            | Yes              | Yes              | Yes            | No                  | Yes        |
| SHADOW                    | Yes            | Yes              | Yes              | Yes (notice)   | No                  | Yes        |
| CANARY                    | Yes            | Yes              | Yes              | Yes (read-only)| No                  | Yes        |
| DEGRADED                  | Yes            | Yes              | Yes              | Yes            | No                  | Yes        |
| EMERGENCY                 | Yes            | Yes              | Yes              | Yes            | No                  | Yes (read) |
| CONSTITUTIONAL_RISK       | Yes            | Yes              | Yes (read)       | No             | No                  | Yes (read) |
| READ_ONLY                 | Yes            | Yes              | Yes              | Yes            | Yes*                | Yes        |
| EMERGENCY_FREEZE          | Yes (control)  | Yes (read)       | Yes (read)       | Yes (read)     | Yes*                | Yes (read) |
| TOURNAMENT_ACTIVE         | Yes            | Yes              | Yes              | Yes            | No                  | No         |
| JACKPOT_ACTIVE            | Yes            | Yes              | Yes              | Yes            | No                  | No         |
| EVENT_ACTIVE              | Yes            | Yes              | Yes              | Yes            | No                  | No         |

*SPONSOR_STAKEHOLDER sees READ_ONLY and EMERGENCY_FREEZE banners because these states explain
why the system is unavailable. They do not see the details (which circuit breaker, which
emergency) — only the top-level status and support contact.

**Notes:**
- "Yes (notice)" means the mode is visible but the operator receives a simplified explanation rather than full technical detail (e.g., VENUE_OPERATOR in SHADOW mode sees "Screens are in validation mode — your changes are being tested before going live" rather than "Shadow parity comparison active; PRE is running in shadow against legacy system").
- "Yes (read-only)" means the operator can see the context detail but cannot trigger transitions or take actions related to the mode.
- CONSTITUTIONAL_RISK is not surfaced to VENUE_OPERATOR — it is a governance concern handled at ENTERPRISE_ADMIN+. VENUE_OPERATOR may notice that canary promotion is not happening but is not given the specific CLASS_3 divergence detail.

---

## Section 5 — Constitutional State Surfacing Rules

READ_ONLY and EMERGENCY_FREEZE are the two constitutional states with unconditional
cross-role visibility. The surfacing rules for these states are non-negotiable interface
requirements — they cannot be deprioritized by information density settings, theme settings,
or accessibility mode.

### 5.1 READ_ONLY Surfacing

**Trigger for display:** Any authenticated session while platform is in READ_ONLY.
**Position:** Fixed banner above all workspace chrome. Appears before the workspace header in DOM order.
**Content:** "System read-only. [Circuit breaker name] tripped at [time]. Screens continue to operate normally. Contact support: [link]."
**Dismissibility:** Not dismissible. Remains until READ_ONLY state clears.
**Frequency:** Shown on every page load and every workspace navigation during READ_ONLY.
**Color treatment:** Amber or equivalent high-visibility non-red treatment (red is reserved for emergency/freeze states).

### 5.2 EMERGENCY_FREEZE Surfacing

**Trigger for display:** Any authenticated session while platform is in EMERGENCY_FREEZE.
**Position:** Full-viewport overlay. Not a banner. Not scrollable past.
**Content:** "System Emergency Freeze. Activated by [name] at [time]. Token ID: [token_id]. All operations suspended. Contact platform administrator."
**Dismissibility:** Not dismissible by any role except PLATFORM_ADMIN with valid human-token.
**Color treatment:** Red / high-urgency visual treatment. Structurally unmistakable as a critical system state.
**For PLATFORM_ADMIN:** Freeze management controls (token entry, reset confirmation) appear within the overlay after token validation.
**For all other roles:** Read-only content with support contact and estimated resolution timeline (if provided by PLATFORM_ADMIN at freeze activation).

### 5.3 Why Unconditional Visibility

The unconditional visibility of READ_ONLY and EMERGENCY_FREEZE to all roles including
SPONSOR_STAKEHOLDER serves two purposes:

1. **Explains unavailability.** A SPONSOR_STAKEHOLDER attempting to view their campaign preview
   during EMERGENCY_FREEZE would otherwise see unexplained API failures. The freeze banner
   explains why the system is unavailable without revealing operational detail.

2. **Maintains trust.** Hiding system states from users — even users with limited authority —
   creates the impression of an unreliable or deceptive system. Showing the state, at an
   appropriate level of detail, maintains trust and allows users to take appropriate action
   (contact support, wait, escalate to their account manager).

The detail of what tripped the circuit breaker or who triggered the freeze is role-gated.
The fact that the system is in a restricted state is not.

---

## Section 6 — Operational Context in Audit Records

Every ReplayAuditRecord includes the operational context at the time of resolution:

```
{
  "resolved_at": "...",
  "operational_mode": "CANARY",
  "market_vertical_contexts": ["TOURNAMENT_ACTIVE"],
  "constitutional_state": "NORMAL",
  ...reason_trace...
}
```

This allows an AUDITOR reviewing a historical record to reconstruct the exact operational
environment in which the PRE invocation occurred. A resolution that looks unexpected in
NORMAL mode may be entirely correct in CANARY mode with TOURNAMENT_ACTIVE context. Without
the context, forensic replay is incomplete.

Market vertical contexts in audit records are timestamped snapshots — they reflect the context
at resolution time, not the current context. An audit record from three months ago showing
TOURNAMENT_ACTIVE is accurate for that moment even if no tournament is active now.

---

## Appendix A — Context Transition Audit Record Format

Every operational mode transition generates an audit record. The format is:

```json
{
  "event_type": "OPERATIONAL_MODE_TRANSITION",
  "from_mode": "SHADOW",
  "to_mode": "CANARY",
  "scope": { "type": "VENUE", "id": "..." },
  "triggered_by": "user_id",
  "triggered_at": "2026-05-26T14:00:00Z",
  "transition_reason": "Parity gates passed. Promoting to canary.",
  "parity_gate_results": {
    "class_4_divergences": 0,
    "class_3_unreviewed": 0,
    "total_records": 1247,
    "span_hours": 26.5
  }
}
```

For automatic transitions (DEGRADED entry, EMERGENCY_FREEZE), the `triggered_by` field
contains the system component identifier ("entropy_scheduler", "circuit_breaker:CB-003")
rather than a user ID. The record is otherwise identical.

---

## Appendix B — Operational Context Glossary for Operator Communication

The following are the operator-facing descriptions of each mode. These are not technical
definitions — they are the language used in the CMS interface, training materials, and
operator notifications.

| Technical Mode       | Operator-Facing Description                                                                 |
|----------------------|---------------------------------------------------------------------------------------------|
| NORMAL               | (No special indicator — normal operation)                                                   |
| SHADOW               | "Validation mode: your changes are being tested before going live. Screens show current content." |
| CANARY               | "Staged rollout: some screens are testing new scheduling. Results are being monitored."      |
| DEGRADED             | "Screen sync alert: some screens may not be showing the latest content. Check entropy reports." |
| EMERGENCY            | "Emergency active: screens are showing emergency content. Acknowledge to resume normal operation." |
| CONSTITUTIONAL_RISK  | "Governance review required: scheduling comparison found an issue that needs administrator review." |
| READ_ONLY            | "System maintenance: content changes are temporarily paused. Screens continue to operate."  |
| EMERGENCY_FREEZE     | "System frozen: all operations suspended. Contact your platform administrator."              |
| TOURNAMENT_ACTIVE    | "Tournament mode: tournament content and leaderboard feeds are active for this venue."      |
| JACKPOT_ACTIVE       | "Jackpot mode: responsible gaming compliance windows are active for gaming areas."          |
| EVENT_ACTIVE         | "Event mode: event-specific content is active for event areas."                             |
