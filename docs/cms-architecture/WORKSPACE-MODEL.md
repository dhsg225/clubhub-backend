# ClubHub TV — Workspace Model
# Information Architecture Layer

**Document type:** Workspace model — authoritative operational context definition
**Authority:** CMS Architecture
**Audience:** UX implementation, frontend engineers, operator experience design, agent phases 3–7
**Last updated:** 2026-05-26
**Status:** CANONICAL — workspace behavior must conform to this model in all interface implementations

---

## Purpose

This document defines the workspace model: the scoped operational context within which a
ClubHub TV operator works. The workspace is the unit of operator agency — it determines
what entities are visible, what actions are available, what alerts are surfaced, and what
scope is assumed by all operator actions within it.

The workspace model exists because operators are not stateless API clients. They are humans
with sustained operational intent — they are "in" a venue, managing a campaign, investigating
an entropy alert. The workspace model captures that sustained context and ensures that the
interface reflects it consistently across all surfaces the operator touches.

---

## Governing Philosophy

**A workspace is a context, not a filter.** A filter removes things from view. A workspace
changes what the interface means. An action taken in a Venue Workspace is implicitly scoped
to that venue — the operator should never need to specify the venue again on every form field.

**Workspace state is operational truth.** If a venue is in EMERGENCY state, the workspace
must surface that state in every view within the workspace. An operator cannot work in a
venue's campaign list while being unaware that an emergency is active on that venue's screens.

**Context switching is explicit.** Moving between workspaces (e.g., from Venue A to Venue B)
is an explicit operator action. Clicking a link that resolves to a different venue context
must surface a context switch notification — the interface does not silently change the
operator's scope.

---

## Section 1 — Workspace Definition

A workspace is the set of:
1. **Entity scope:** Which organizations, venues, zones, and screens the operator can see and act on in this context
2. **Operational context:** The current operational mode (NORMAL, SHADOW, CANARY, DEGRADED, EMERGENCY) of the workspace's primary entity
3. **Alert state:** Active entropy alerts, emergency indicators, canary promotion flags, circuit breaker status
4. **Role-derived capability set:** Which actions are available (create, modify, activate, acknowledge, etc.)
5. **Temporal mode:** Whether the workspace is in LIVE, REPLAY, PREVIEW, or STALE mode (see Canonical UI State Model)

Workspaces are not persisted server-side. They are reconstructed from server state on each
session. The operator's workspace preferences (last viewed venue, filter state, active sort
column) are persisted in browser session storage.

---

## Section 2 — Workspace Types

### 2.1 Fleet Workspace

**Primary role:** ENTERPRISE_ADMIN
**Secondary roles:** REGIONAL_MANAGER (regional scope), PLATFORM_ADMIN (all scope)
**Scope:** All venues within the operator's organizational scope

**What the Fleet Workspace shows:**
- Venue health grid: each venue as a card or row, showing operational mode, entropy alert level, active emergency flag, active screen count, offline screen count
- System operational mode banner (NORMAL / SHADOW / CANARY / DEGRADED — applies to the whole system)
- Active emergency summary: count of venues with ACTIVE emergencies; expandable to list
- Entropy alert summary: count of venues in WARNING or CRITICAL entropy state
- Canary promotion queue: venues awaiting promotion decision
- Fleet-level campaign overview: enterprise campaigns and their coverage

**What the Fleet Workspace does NOT show:**
- Per-screen resolution detail (that is a Venue Workspace concern)
- Campaign editing (that is a Campaign View concern)
- Audit records (that is an Audit Workspace concern)

**Workspace-level actions available in Fleet Workspace:**
- Navigate to any in-scope Venue Workspace
- Activate or acknowledge emergency at a venue (via emergency shortcut panel — not inline)
- Filter fleet by operational mode, entropy status, market vertical

---

### 2.2 Regional Workspace

**Primary role:** REGIONAL_MANAGER
**Scope:** The subset of venues within the operator's REGIONAL_ORG assignment

The Regional Workspace is structurally identical to the Fleet Workspace, scoped to the
operator's regional org. A REGIONAL_MANAGER sees only their region's venues in the fleet
health grid.

**Distinction from Fleet Workspace:**
- No enterprise-level campaign management
- No cross-region visibility (even if the REGIONAL_MANAGER suspects another region has a related issue)
- Entropy acknowledgment authority is bounded by regional scope

**When a REGIONAL_MANAGER is also granted ENTERPRISE_ADMIN on a subset of venues:**
Those venues appear in both the regional and the enterprise views. The REGIONAL_MANAGER
uses the role context switcher (see Section 5) to operate under the appropriate role for
each action.

---

### 2.3 Venue Workspace

**Primary role:** VENUE_OPERATOR
**Secondary roles:** REGIONAL_MANAGER (contextual), ENTERPRISE_ADMIN (contextual)
**Scope:** Single venue and all its entities

The Venue Workspace is the primary operational surface for day-to-day venue management.
It is the context within which a VENUE_OPERATOR spends the majority of their working session.

**Workspace header state (always visible, never collapsible):**
- Venue name and operational mode
- Active emergency indicator (present if any zone has an ACTIVE emergency)
- Entropy alert badge (NONE / WARNING / CRITICAL)
- Current corpus version and deployment status
- Canary status (if venue is in CANARY operational mode)

**Workspace sub-contexts (left navigation within the Venue Workspace):**
- **Screens:** Zone-organized screen grid with per-screen resolution level, confidence score, last poll time
- **Campaigns:** Venue campaign list with status and schedule coverage summary
- **Overrides:** Active L2 override stack; override creation; override clearance
- **Emergency:** Emergency panel (see Navigation Architecture §7); activation and acknowledgment
- **Entropy:** EntropyReport list for this venue; detail and acknowledgment
- **Preview:** PreviewSession creation and review

**Workspace-level actions available:**
- Create venue-local Campaign, Schedule, Playlist, Override
- Activate/acknowledge Emergency (VENUE_OPERATOR authority)
- Acknowledge EntropyReport
- Enroll new Screen
- Create PreviewSession

---

### 2.4 Audit Workspace

**Primary role:** AUDITOR
**Secondary roles:** ENTERPRISE_ADMIN (with read-only audit access), REGIONAL_MANAGER (same)
**Scope:** ReplayAuditRecords, ParityRecords, EntropyReports within granted scope

The Audit Workspace is a read-only investigative surface. No mutations are possible from
within it. Its primary purpose is forensic reconstruction: understanding why a specific
screen played specific content at a specific time.

**Workspace header state:**
- Scope indicator (which org/region is being audited)
- Time range selector (default: last 24 hours; maximum: all time)
- Active filter summary

**Workspace sub-contexts:**
- **Replay:** ReplayAuditRecord log, searchable by screen, time, resolution level, checksum
- **Parity:** ParityRecord log, filterable by divergence class, reviewed/unreviewed
- **Entropy:** EntropyReport log, filterable by venue, severity, status

**Operational state visibility in Audit Workspace:**
The Audit Workspace surfaces read-only venue state (current operational mode, active
emergencies) as context for investigations. An AUDITOR investigating a replay record from a
venue that is currently in EMERGENCY state can see that context. They cannot act on it.

---

### 2.5 Governance Workspace

**Primary role:** PLATFORM_ADMIN
**Secondary roles:** ENTERPRISE_ADMIN (corpus and deployment management within their scope)
**Scope:** Constitutional state, CorpusVersions, DeploymentGroups, organization management

The Governance Workspace is the constitutional control surface. It is the only surface where
READ_ONLY mode, EMERGENCY_FREEZE mode, circuit breaker state, and corpus deployment management
are accessible.

**Workspace header state:**
- System constitutional state (NORMAL / READ_ONLY / EMERGENCY_FREEZE)
- Active circuit breaker count
- Pending canary promotions count

**Workspace sub-contexts (PLATFORM_ADMIN):**
- **Constitutional State:** Current operational mode controls, circuit breaker status, EMERGENCY_FREEZE trigger and reset
- **Corpus Management:** All venue corpus versions, replay vector status, manual corpus compilation trigger
- **Deployment Groups:** Group composition, rollout state, canary promotion controls
- **Organizations:** Org hierarchy, suspension, termination
- **Role Management:** Role assignments across all organizations

**Workspace sub-contexts (ENTERPRISE_ADMIN):**
- **Corpus Management:** Enterprise venue corpus versions (read-only); deployment trigger for their venues
- **Deployment Groups:** Group management within enterprise scope
- **Role Management:** Role assignments within enterprise scope

---

## Section 3 — Workspace State

Each workspace carries operational state that is surfaced persistently within the workspace
header. Workspace state is derived from server-side operational data — it is not a UI
preference, it is a reflection of system truth.

### 3.1 Active Emergency Indicators

When any entity within the workspace scope has an ACTIVE Emergency:

- **Fleet Workspace:** An emergency banner appears at the top of the venue grid. The banner names the affected venues and shows time-since-activation. The banner is not dismissible until all emergencies in scope are acknowledged.
- **Venue Workspace:** An emergency panel indicator appears in the workspace header. The indicator shows the emergency scope (VENUE or specific ZONE), time-since-activation, and the operator who triggered it. A single-click action opens the acknowledgment panel.
- **Audit Workspace:** A read-only emergency context badge appears in the workspace header when auditing records from a venue with an active emergency. No action available.

Emergency indicators are never hidden by information density controls. They are structurally
primary in the workspace header.

### 3.2 Entropy Alert Badges

Entropy alert badges reflect the venue's current `entropy_alert_level` (NONE / WARNING / CRITICAL):

- **NONE:** No badge displayed.
- **WARNING:** Amber badge in workspace header. Non-blocking. Operator should investigate but is not prevented from other actions.
- **CRITICAL:** Red badge with pulse animation (or equivalent distinct visual treatment) in workspace header. The entropy detail link is surfaced prominently alongside the badge. Critical entropy alerts are also listed in the Fleet Workspace's alert summary.

A CRITICAL entropy alert does not prevent campaign editing or override creation. It is an
informational alert. However, if a CRITICAL entropy alert is accompanied by an EMERGENCY
state, the combined condition may trigger EMERGENCY_FREEZE (see OPERATIONAL-CONTEXTS.md).

### 3.3 Canary Promotion Status

When a venue is in CANARY operational mode with a promotion decision pending:

- **Fleet Workspace:** A "Pending Promotion" indicator appears on the venue card.
- **Venue Workspace:** A canary status banner appears in the workspace header, showing parity gate results and the "Promote" / "Rollback" actions (ENTERPRISE_ADMIN+ only; read-only for VENUE_OPERATOR and REGIONAL_MANAGER).
- **Governance Workspace:** Full canary promotion management surface.

The VENUE_OPERATOR can see the canary status but cannot trigger promotion or rollback.
They can see how many parity records have been collected and what the gate threshold is.

---

## Section 4 — Multi-Workspace Operators

An operator may hold multiple role assignments at different organizational scopes. For example:
- VENUE_OPERATOR on Venue A
- REGIONAL_MANAGER on REGIONAL_ORG_X (which includes Venue A and Venue B)
- AUDITOR on ENTERPRISE_GROUP_Y (which includes all regional orgs)

### 4.1 Context Switcher

Multi-role operators see a role context switcher in their session header. The switcher
shows their current active role context and allows selection of any of their granted contexts.

Each context represents:
- `{ role: REGIONAL_MANAGER, scope: REGIONAL_ORG_X }` → Regional Workspace for Org X
- `{ role: VENUE_OPERATOR, scope: VENUE_A }` → Venue Workspace for Venue A
- `{ role: AUDITOR, scope: ENTERPRISE_GROUP_Y }` → Audit Workspace for Enterprise Y

Switching context is an explicit action. The interface surfaces a confirmation step that
names the scope the operator is switching to: "Switch to Regional Manager — Central Region?".
The previous context is not lost — returning to it restores the previous view and filter state
(within the same session).

### 4.2 Context Isolation

Different contexts are isolated from each other. An operator cannot act under one context
while viewing state from another. If an operator is in `REGIONAL_MANAGER / REGIONAL_ORG_X`
context and navigates to a venue that falls under `VENUE_OPERATOR / VENUE_A` context, the
system does not automatically promote their authority. They see the venue within their
REGIONAL_MANAGER scope (which is broader). To act as the VENUE_OPERATOR (if they need the
VENUE_OPERATOR capability set specifically), they switch context explicitly.

### 4.3 Additive Authorities

When the operator's current context is their most privileged role for the in-scope entity,
they operate with the full capability set of that role. There is no need to "escalate" within
scope — the role grants full authority within scope by design.

An ENTERPRISE_ADMIN operating on one of their enterprise's venues has all ENTERPRISE_ADMIN
capabilities for that venue. They do not need a separate VENUE_OPERATOR grant for venue-level
actions — the ENTERPRISE_ADMIN capability set includes all VENUE_OPERATOR capabilities within
scope.

---

## Section 5 — Workspace and Constitutional State

Constitutional state affects all workspaces regardless of scope or role. Two constitutional
states have workspace-wide surface requirements.

### 5.1 READ_ONLY Constitutional State

When the platform is in READ_ONLY constitutional state (a circuit breaker has tripped;
see OPERATIONAL-CONTEXTS.md):

- **All workspaces, all roles:** A system-wide banner appears at the top of the browser viewport, above the workspace header. The banner reads the READ_ONLY operational context description and the reason (circuit breaker name, trigger condition).
- **All mutation controls are hidden.** Not disabled with a tooltip — hidden entirely. Forms that would create or modify entities are replaced with read-only views of the same data.
- **Exception:** Emergency activation is still available to VENUE_OPERATOR+ during READ_ONLY state. Emergencies are constitutional-level actions and are not gated by the operational circuit breaker.
- **Exception:** Emergency acknowledgment (clearing an emergency) is still available.

The READ_ONLY banner is not dismissible. It clears automatically when the circuit breaker
is reset by PLATFORM_ADMIN and the system returns to NORMAL operational mode.

### 5.2 EMERGENCY_FREEZE Constitutional State

EMERGENCY_FREEZE is a full system halt. More restrictive than READ_ONLY:

- **All workspaces, all roles:** A full-viewport overlay replaces the normal workspace header. This overlay is structurally different from the READ_ONLY banner — it cannot be scrolled past or dismissed.
- The overlay identifies: which PLATFORM_ADMIN triggered the freeze, at what time, and what human-token confirmation is required to reset.
- Only PLATFORM_ADMIN with a valid human-token can interact with the EMERGENCY_FREEZE overlay. All other roles see a read-only status display with a support contact.
- **No mutations of any kind are possible under EMERGENCY_FREEZE.** Emergency activation is also blocked (because the system is already in full halt).

The EMERGENCY_FREEZE state is the most visible constitutional state in the entire platform.
Any operator, at any role level, opening the CMS while EMERGENCY_FREEZE is active sees the
freeze overlay before anything else.

---

## Section 6 — Workspace Collaboration

Multiple operators may be in the same Venue Workspace simultaneously. This is a normal
operational scenario (e.g., a VENUE_OPERATOR and a REGIONAL_MANAGER investigating an entropy
alert together; two VENUE_OPERATORs covering a shift handover).

### 6.1 Concurrent Presence Awareness

The Venue Workspace surfaces concurrent presence:
- An indicator in the workspace header lists other operators currently active in this workspace (by display name and role).
- The indicator is informational — it does not provide real-time cursor tracking or co-editing. It provides session-level awareness: "who else is in here right now."

Concurrent presence is detected server-side via session heartbeat. A user who has the workspace
open but has been inactive for more than 5 minutes is not shown in the concurrent presence list.

### 6.2 Mutation Conflict Handling

The platform uses optimistic last-write-wins for most CMS mutations. The exception is emergency
operations.

**Standard mutations (campaigns, schedules, overrides):**
- Last write wins. If Operator A and Operator B both edit the same Campaign simultaneously, the last API call to commit wins. The other operator's in-progress edit is not blocked.
- Stale edit detection: When Operator A opens a campaign edit form, the campaign's `last_modified_at` is captured. If the campaign has been modified by Operator B by the time Operator A submits, the API returns a conflict error (409) with the updated state. The UI surfaces: "This campaign was modified by [user] at [time]. Your changes were not saved. Review the current version before trying again."
- The operator is shown the current server state side-by-side with their submitted changes and must re-confirm their edit against the current state.

**Emergency operations (activation, acknowledgment):**
- Emergency operations are not last-write-wins. Emergency activation and acknowledgment are serialized server-side using an advisory lock per venue.
- If two operators attempt to acknowledge the same emergency simultaneously, one succeeds and the other receives: "This emergency was acknowledged by [user] at [time]. No further action is needed."
- Emergency activation when an emergency is already active returns: "An emergency is already active on this venue (activated by [user] at [time])." The operator is directed to the existing emergency's acknowledgment flow.

### 6.3 Lock-Based Editing (Override Operations)

Override creation and clearance use a soft lock: when an operator begins the override creation
flow, a lock is acquired for that venue's override stack for the duration of the form session
(maximum: 2 minutes). If another operator attempts to create an override on the same venue
simultaneously, they see: "Override creation is in progress by [user]. Try again in a moment."

Lock expiry (2 minutes without activity) releases the lock automatically. The lock-holding
operator's form is marked stale and they must re-initiate.

---

## Section 7 — Workspace Persistence

### 7.1 Session-Persisted State

The following workspace state is persisted for the duration of the browser session
(cleared on tab close or session expiry):

- Last visited Venue Workspace (venue_id)
- Last viewed sub-context within Venue Workspace (screens / campaigns / overrides / etc.)
- Active filter state (campaign status filters, date range selectors)
- Active sort column and direction (URL-encoded; survives page refresh)
- PreviewSession ID (active preview session; allows return to preview context)
- Role context selection (which of their multiple role contexts is active)

### 7.2 Cross-Session Persistence

The following state is persisted server-side and survives session expiry and browser restarts:

- Default workspace for new sessions (derived from role assignments; a VENUE_OPERATOR lands on their venue, an ENTERPRISE_ADMIN lands on fleet)
- Notification preferences (which alert types generate in-app notifications)

Campaign edits, override drafts, and preview sessions in progress at session expiry are NOT
persisted. An operator who has begun but not submitted a campaign edit will find the form
empty on next login. This is intentional — partially-entered data can be more dangerous than
a clean start.

### 7.3 Workspace Exit Conditions

The following conditions clear workspace context and return the operator to their default
landing page:

- **Session expiry:** Inactivity timeout (default: 4 hours). All workspace state cleared.
- **Role context revocation:** If an operator's role grant is revoked while they have an active session, the next API call returns 401. The interface surfaces: "Your access level has changed. Please reload." Reload redirects to their remaining accessible workspaces.
- **Emergency clearance:** When the only ACTIVE emergency in a Venue Workspace is acknowledged, the emergency indicator clears. The operator remains in the Venue Workspace — they are not navigated away.
- **Corpus deployment completion:** When a CorpusVersion transitions to DEPLOYED, the Venue Workspace canary status banner auto-updates. The operator is not navigated away.

Session expiry is the only condition that forces a full workspace exit and re-login.

---

## Section 8 — Workspace Entry Flows

### 8.1 New Session Entry

On new session (post-login):
- PLATFORM_ADMIN → Fleet Workspace (all orgs)
- ENTERPRISE_ADMIN → Fleet Workspace (enterprise scope)
- REGIONAL_MANAGER → Regional Workspace (regional org scope)
- VENUE_OPERATOR (single venue) → Venue Workspace (assigned venue)
- VENUE_OPERATOR (multiple venues) → Venue selector (list of assigned venues)
- SPONSOR_STAKEHOLDER → Sponsorship list (their sponsorships)
- AUDITOR → Audit Workspace (granted scope)

### 8.2 Deep Link Entry

When an operator enters via a deep link (shared URL, support escalation link, audit reference):
1. Authentication is checked. If not authenticated, redirect to login with the deep link as the post-login redirect target.
2. After authentication, authorization is checked for the specific resource. If unauthorized, render 403 (not the default landing page).
3. If authorized, render the resource within the appropriate workspace context. The workspace header reflects the entity's parent scope (e.g., a campaign deep link opens within the Venue Workspace for the campaign's venue).

### 8.3 Emergency State Entry

When any operator navigates to a Venue Workspace for a venue with an ACTIVE emergency:
1. The workspace renders normally.
2. The emergency panel indicator in the workspace header is immediately surfaced and highlighted.
3. If the operator's role permits acknowledgment (VENUE_OPERATOR+), the acknowledgment action is shown in the header.
4. The operator is not forced to the emergency panel — they can navigate to other sub-contexts. But the indicator persists across all sub-contexts within the workspace.

**Rationale:** Forcing the operator to the emergency panel before they can access anything else
risks creating friction that causes operators to avoid acknowledging emergencies just to resume
their work. The persistent header indicator provides constant awareness without forcing an
interaction sequence. The emergency shortcut (one-click from anywhere in the workspace) provides
immediate access when the operator is ready to act.
