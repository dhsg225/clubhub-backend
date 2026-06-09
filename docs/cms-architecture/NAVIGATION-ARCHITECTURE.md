# ClubHub TV — CMS Navigation Architecture
# Information Architecture Layer

**Document type:** Navigation model — authoritative traversal structure for operator interfaces
**Authority:** CMS Architecture
**Audience:** UX implementation, frontend engineers, agent phases 3–7
**Last updated:** 2026-05-26
**Status:** CANONICAL — no navigation structure may be implemented without conforming to this model

---

## Purpose

This document defines how operators navigate the ClubHub TV CMS: the primary contexts,
the navigation tree by role, deep linking, cross-context traversal, and navigation
boundaries. Navigation is not cosmetic structure — it is access control expressed as
interface topology. A role that cannot reach an entity through navigation cannot act on it.
Every boundary in this document reflects a security and operational decision, not a design
preference.

---

## Governing Philosophy

**Navigation communicates authority.** An operator who can see a control can use it. An
operator who cannot reach a section cannot be held responsible for its contents. Navigation
structure must exactly reflect role authority — neither more nor less.

**Deep links are stable contracts.** Every entity in the system has a canonical URL. That
URL is stable across sessions, across browser refreshes, and across operator context switches.
Deep links are shareable. Support escalations reference deep links. Audit responses reference
deep links. They must not change without a deprecation period and redirect.

**Context persists intentionally.** When an operator navigates within a venue context, that
context is preserved across navigation actions. An operator should never lose their working
context by clicking a breadcrumb — they should be able to navigate away and return to the
same context.

**Emergency access is never buried.** The emergency panel is reachable from any venue view
with a single action. In a live emergency situation, an operator cannot be asked to traverse
three levels of navigation to reach the acknowledgment flow.

---

## Section 1 — Primary Navigation Contexts

Five primary contexts structure the navigation model. Each context represents a distinct
operational frame — a different relationship between the operator and the system's state.

### 1.1 Fleet View

**Purpose:** Top-down operational health of the venue fleet.
**Primary consumer:** ENTERPRISE_ADMIN, REGIONAL_MANAGER
**Scope:** All venues within the operator's organizational scope
**Characteristic data:** Venue operational modes, entropy alert levels, active emergencies, canary promotion status, screen health aggregate

The Fleet View is the operational command surface. It does not expose content editing — it
exposes the health and operational posture of the fleet. An ENTERPRISE_ADMIN opening the CMS
lands here by default.

**Key surfaces:**
- Fleet health map (venue list with operational mode and alert indicators)
- Active emergency banner (across all venues with active emergencies)
- Entropy alert summary (venues in WARNING or CRITICAL entropy state)
- Canary promotion queue (venues with pending promotion decisions)
- System operational mode indicator (NORMAL / SHADOW / CANARY / DEGRADED)

---

### 1.2 Venue View

**Purpose:** Detailed operational management of a single venue.
**Primary consumer:** VENUE_OPERATOR, REGIONAL_MANAGER
**Scope:** Single venue and all its entities
**Characteristic data:** Screen status, active campaigns and schedules, override stack, entropy report, emergency state, corpus version

The Venue View is where most day-to-day operational work happens. A VENUE_OPERATOR lands
here on login, with their assigned venue pre-selected as context.

**Key surfaces:**
- Venue operational summary (current mode, active emergency, entropy status, corpus version)
- Screen zone grid (screens by zone, each with current resolution level and confidence score)
- Active override stack (current L1/L2 overrides with precedence order)
- Campaign timeline (active, scheduled, and recently completed campaigns)
- Emergency panel (accessible via shortcut; see Section 7)
- ScreenZone detail (screens within a zone, with per-screen resolution status)
- Screen detail (single screen PRE status, last manifest, confidence score, last entropy check)

---

### 1.3 Campaign View

**Purpose:** Lifecycle management of content programs.
**Primary consumer:** ENTERPRISE_ADMIN, REGIONAL_MANAGER, VENUE_OPERATOR
**Scope:** Campaigns and schedules within the operator's organizational scope
**Characteristic data:** Campaign status, schedule coverage, playlist associations, sponsorship bindings

**Key surfaces:**
- Campaign list (filterable by status, targeting scope, market vertical)
- Campaign detail (schedules, playlists, targeting, sponsorship links)
- Schedule builder (visual recurrence definition with conflict preview)
- Playlist editor (content assembly for a campaign's playlists)
- Campaign preview (link to PreviewSession for this campaign)
- Template gallery (available templates for campaign instantiation)

---

### 1.4 Audit View

**Purpose:** Replay audit, parity review, and entropy investigation.
**Primary consumer:** AUDITOR, ENTERPRISE_ADMIN, REGIONAL_MANAGER
**Scope:** ReplayAuditRecords, ParityRecords, EntropyReports within organizational scope
**Characteristic data:** Historical PRE invocations, divergence events, corpus drift reports

**Key surfaces:**
- Replay audit log (searchable by screen, time range, resolution level, checksum)
- Replay detail (full reason_trace for a single ReplayAuditRecord; link to PRE input state)
- Parity report log (shadow/canary comparison results; filterable by divergence class)
- Parity detail (full divergence detail for a single ParityRecord; link to both PRE and legacy output)
- Entropy report log (EntropyReports by venue and severity; filterable by status)
- Entropy detail (drift breakdown for a single EntropyReport; affected screens; corrective actions)

---

### 1.5 Governance View

**Purpose:** Constitutional controls, corpus management, deployment orchestration.
**Primary consumer:** PLATFORM_ADMIN, ENTERPRISE_ADMIN
**Scope:** CorpusVersions, DeploymentGroups, system operational mode, constitutional state
**Characteristic data:** Active corpus deployments, rollout state, circuit breaker status, constitutional mode

**Key surfaces:**
- Constitutional state panel (current operational mode, active circuit breakers, constitutional flags)
- Corpus version history (per venue, with checksum and replay vector status)
- Deployment group management (group composition, rollout state, pending corpus versions)
- Canary promotion controls (parity gate status, promotion trigger, rollback controls)
- Organization management (org hierarchy, compliance profiles, market verticals)
- Role assignment (user role grants within organizational scope)

---

## Section 2 — Navigation Tree by Role

### 2.1 PLATFORM_ADMIN

Full access to all navigation contexts and all constitutional controls.

```
/ (root)
├── /fleet                          ← Fleet View (all organizations)
│       ├── /fleet/orgs             ← Organization hierarchy management
│       └── /fleet/system           ← System operational mode, circuit breakers
├── /venue/:venue_id                ← Venue View (any venue)
│       ├── ...all venue sub-routes...
│       └── /venue/:venue_id/governance  ← Corpus + deployment (any venue)
├── /campaigns                      ← Campaign View (all orgs)
├── /audit                          ← Audit View (all)
│       ├── /audit/replay           ← ReplayAuditRecords
│       ├── /audit/parity           ← ParityRecords
│       └── /audit/entropy          ← EntropyReports
└── /governance                     ← Governance View (platform-level)
        ├── /governance/constitution ← Constitutional state, READ_ONLY, EMERGENCY_FREEZE
        ├── /governance/corpus       ← All venue corpus versions
        ├── /governance/roles        ← Role assignments across all orgs
        └── /governance/orgs         ← Organization CRUD, suspension, termination
```

---

### 2.2 ENTERPRISE_ADMIN

Access to all venues within their enterprise. No access to platform-level constitutional controls or cross-enterprise data.

```
/ (root) → /fleet (enterprise scope)
├── /fleet                          ← Fleet View (enterprise's venues only)
├── /venue/:venue_id                ← Venue View (venues within enterprise)
│       ├── /venue/:venue_id/screens
│       ├── /venue/:venue_id/campaigns
│       ├── /venue/:venue_id/overrides
│       ├── /venue/:venue_id/emergency
│       ├── /venue/:venue_id/entropy
│       └── /venue/:venue_id/corpus  ← read-only corpus + deployment group management
├── /campaigns                      ← Campaign View (enterprise + venue campaigns)
│       ├── /campaigns/enterprise   ← Enterprise-level campaign management
│       └── /campaigns/templates    ← Enterprise template management
├── /sponsorships                   ← Sponsorship management (enterprise scope)
├── /audit                          ← Audit View (enterprise scope)
│       ├── /audit/replay           ← Replay audit (enterprise venues)
│       ├── /audit/parity           ← Parity records (enterprise venues)
│       └── /audit/entropy          ← Entropy reports (enterprise venues)
└── /governance                     ← Governance View (enterprise scope)
        ├── /governance/corpus       ← Corpus versions (enterprise venues)
        ├── /governance/deployments  ← Deployment group management
        └── /governance/roles        ← Role assignments within enterprise
```

**Excluded:** `/governance/constitution`, platform operational mode controls, cross-enterprise data.

---

### 2.3 REGIONAL_MANAGER

Access to venues within their regional org. Can manage campaigns and overrides in scope. Reads audit data for their region. Cannot access platform-level governance.

```
/ (root) → /fleet (regional scope)
├── /fleet                          ← Fleet View (regional venues only)
├── /venue/:venue_id                ← Venue View (venues within regional org)
│       ├── /venue/:venue_id/screens
│       ├── /venue/:venue_id/campaigns
│       ├── /venue/:venue_id/overrides
│       ├── /venue/:venue_id/emergency
│       └── /venue/:venue_id/entropy
├── /campaigns                      ← Campaign View (regional + venue campaigns)
│       └── /campaigns/templates    ← Regional template management
├── /audit                          ← Audit View (regional scope)
│       ├── /audit/replay           ← Replay audit (regional venues)
│       └── /audit/entropy          ← Entropy reports (regional venues)
└── /governance (read-only)
        └── /governance/corpus       ← Corpus versions (regional venues, read-only)
```

**Excluded:** `/audit/parity` (ParityRecords require ENTERPRISE_ADMIN+ for review actions; read access via AUDITOR role only), deployment group mutation, role management, constitutional controls.

**Note:** A REGIONAL_MANAGER who is also granted AUDITOR role gains `/audit/parity` read access. Roles are additive.

---

### 2.4 VENUE_OPERATOR

Single-venue scope. Full operational access within venue. Cannot access fleet view, audit replay, parity, enterprise campaigns, or governance.

```
/ (root) → /venue/:venue_id (assigned venue)
├── /venue/:venue_id                ← Venue View (assigned venue)
│       ├── /venue/:venue_id/screens      ← Screen management and enrollment
│       ├── /venue/:venue_id/zones        ← Zone management
│       ├── /venue/:venue_id/campaigns    ← Venue-local campaign management
│       ├── /venue/:venue_id/overrides    ← Override creation and management (L2)
│       ├── /venue/:venue_id/emergency    ← Emergency activation and acknowledgment
│       ├── /venue/:venue_id/entropy      ← Entropy reports (read + acknowledge)
│       └── /venue/:venue_id/preview      ← PreviewSession creation
└── /campaigns
        └── /campaigns/venue/:venue_id   ← Alias for venue campaign list
```

**Excluded:** Fleet view, audit replay/parity, governance, enterprise/regional campaigns, other venues, parity records, CorpusVersion management.

**Multi-venue VENUE_OPERATOR:** A VENUE_OPERATOR with assignments to multiple venues sees a venue selector at `/venue/` that lists their assigned venues. Each venue has its own isolated navigation context. There is no cross-venue view for this role.

---

### 2.5 SPONSOR_STAKEHOLDER

Read-only. Restricted to campaigns and preview sessions for their sponsorships. Cannot view operational data, audit data, or any venue-level operational state.

```
/ (root) → /campaigns/sponsorships/:sponsorship_id
├── /campaigns/sponsorships/:sponsorship_id       ← Sponsorship detail (own)
│       ├── ...campaigns linked to this sponsorship...
│       └── /campaigns/sponsorships/:id/preview   ← Preview for sponsored content
└── /preview/:session_id                          ← PreviewSession results (own sponsored content)
```

**Excluded:** All fleet, venue, audit, governance, and non-sponsored campaign routes. Any attempt to access excluded routes returns 403, not a redirect to the restricted content. The 403 response does not reveal whether the resource exists.

**SPONSOR_STAKEHOLDER cannot see:**
- Any ReplayAuditRecord
- Any ParityRecord
- Any EntropyReport
- Any operational state of any venue (including whether an emergency is active)
- Any campaign not linked to their sponsorship
- Any screen, zone, or override data

---

### 2.6 AUDITOR

Read-only access to audit, replay, parity, and entropy data across all organizational scope granted. No mutation access anywhere.

```
/ (root) → /audit
├── /audit/replay                   ← ReplayAuditRecords (granted scope)
│       └── /audit/replay/:record_id ← Full replay detail + reason_trace
├── /audit/parity                   ← ParityRecords (granted scope)
│       └── /audit/parity/:parity_id ← Full parity detail
├── /audit/entropy                  ← EntropyReports (granted scope)
│       └── /audit/entropy/:report_id ← Full entropy report detail
└── /venue/:venue_id (read-only)    ← Venue state context (for audit investigation)
        ├── /venue/:venue_id/screens  (read-only)
        └── /venue/:venue_id/entropy  (read-only)
```

**Excluded:** All mutation routes. Campaign editing. Emergency activation. Override creation.
Governance controls. Preview session creation.

**Cross-linking:** AUDITOR navigating from a ParityRecord to the associated ReplayAuditRecord
is a first-class navigation action (see Section 5). This cross-context link is the primary
investigative path for parity divergence review.

---

## Section 3 — Deep Link Model

Every entity in the system has a stable canonical URL. Deep links are first-class system
artifacts — not implementation conveniences.

### 3.1 Canonical URL Patterns

```
/venue/:venue_id
/venue/:venue_id/screens/:screen_id
/venue/:venue_id/zones/:zone_id
/venue/:venue_id/campaigns/:campaign_id
/venue/:venue_id/overrides/:override_id
/venue/:venue_id/emergency/:emergency_id
/venue/:venue_id/entropy/:report_id
/venue/:venue_id/corpus/:corpus_id

/campaigns/:campaign_id
/campaigns/templates/:template_id
/sponsorships/:sponsorship_id

/audit/replay/:record_id
/audit/parity/:parity_id
/audit/entropy/:report_id

/governance/corpus/:corpus_id
/governance/orgs/:org_id
/preview/:session_id
```

### 3.2 Deep Link Stability Contract

- URL patterns are versioned. Pattern changes require a deprecation period of at minimum one release cycle.
- Old URLs redirect to new URLs (301) for a minimum of 90 days after pattern change.
- Entity deletion does not destroy the URL — the URL resolves to an archived/deleted state view (not 404).
- Deep links work across authentication sessions. Navigating to a deep link after login routes to the linked entity (subject to authorization).

### 3.3 Authorization at Deep Links

Navigating to a deep link for an entity outside the operator's scope:
- Returns 403 (not 404) for entities that exist but are out of scope.
- Returns 404 only if the entity genuinely does not exist.
- Does not redirect to the operator's default landing page without informing them that access was denied.

### 3.4 Deep Links in Audit Records

`ReplayAuditRecord.reason_trace` and `EntropyReport.divergence_detail` include deep links to
the entities that contributed to the resolution decision. These links are stamped at record
creation and are stable. An AUDITOR viewing a two-year-old audit record can follow its links
and view the archived state of the entities as they existed at resolution time.

---

## Section 4 — Context Persistence

### 4.1 Venue Context

When an operator navigates into a Venue View, the venue context persists:

- Across navigation within the Venue View (e.g., navigating from Screens to Campaigns within the same venue)
- Across page refreshes (venue context is URL-encoded)
- After returning from Audit View (if audit was entered from a venue context, returning to Fleet View surfaces the previously selected venue)

Venue context is **not** persisted across:
- Explicit venue selector changes (operator actively switches venue)
- Session expiry and re-login (operator lands at their default landing page)
- Role context switches (operator switches between role assignments)

### 4.2 Filter and Selection State

Within a view, filter state (campaign status filters, date range selectors, screen zone
selections) persists for the duration of the session. Filter state is stored in browser
session storage — not server-side. Closing the browser tab clears filter state.

Filter state is **not** deep-linked (URLs do not encode filter state), with one exception:
the active sort column and direction on list views is URL-encoded to support sharing sorted
views.

### 4.3 Preview Session Context

A PreviewSession, once initiated, preserves the hypothetical state and simulation timestamp
for the duration of the session. Navigating away from the Preview tab and returning restores
the same preview context. PreviewSessions expire after 4 hours (see ENTITY-MODEL.md §7.1).

---

## Section 5 — Cross-Context Navigation

Cross-context navigation is the ability to jump from one navigation context to another while
preserving navigational provenance — so the operator can trace their path back.

### 5.1 Parity Record → Replay Audit

**Trigger:** Operator viewing a ParityRecord with a CLASS_3 or CLASS_4 divergence
**Target:** The ReplayAuditRecord for the PRE invocation that produced the divergent output
**Mechanism:** "View PRE Invocation" link on ParityRecord detail
**Resulting URL:** `/audit/replay/:record_id` (with breadcrumb back to the ParityRecord)
**Authorization:** Requires AUDITOR or ENTERPRISE_ADMIN+ on the venue scope
**SPONSOR_STAKEHOLDER:** This route is inaccessible. The link does not appear on their interface.

### 5.2 EntropyReport → Screen Detail

**Trigger:** Operator viewing an EntropyReport with affected screens listed
**Target:** Screen detail for an affected screen
**Mechanism:** Inline screen link within the EntropyReport's affected_screen_ids list
**Resulting URL:** `/venue/:venue_id/screens/:screen_id` (with breadcrumb back to the report)
**Context:** Screen detail shows the corpus version mismatch that contributed to the entropy report

### 5.3 ReplayAuditRecord → Campaign Detail

**Trigger:** AUDITOR or ENTERPRISE_ADMIN reviewing a ReplayAuditRecord and seeing a campaign
in the reason_trace
**Target:** The Campaign that was active at resolution time
**Mechanism:** Campaign ID link in the reason_trace rendering
**Resulting URL:** `/campaigns/:campaign_id` (showing archived state if the campaign has since been archived)
**Note:** The campaign's state at resolution time is visible in the replay trace itself —
navigating to the campaign shows its current state, which may differ.

### 5.4 Venue View → Fleet View

**Trigger:** Operator in Venue View wants to return to fleet overview
**Mechanism:** "Fleet" breadcrumb at top of Venue View navigation
**Behavior:** Returns to Fleet View with the operator's previously selected venue highlighted.
Does not lose fleet-level context (org filter, sort state).

### 5.5 Screen Detail → Replay Audit (Last N Invocations)

**Trigger:** VENUE_OPERATOR or REGIONAL_MANAGER investigating why a screen shows unexpected content
**Target:** The most recent ReplayAuditRecords for this screen
**Mechanism:** "Resolution History" link on Screen detail page
**Resulting URL:** `/audit/replay?screen_id=:screen_id` (filtered audit view)
**Authorization:** VENUE_OPERATOR may see ReplayAuditRecords for screens in their venue.

---

## Section 6 — Navigation Boundaries

Navigation boundaries are enforced at two layers: server-side authorization (API returns 403
for unauthorized resources) and client-side navigation (prohibited routes do not appear in
navigation for roles that cannot access them).

### 6.1 SPONSOR_STAKEHOLDER Hard Boundaries

The following routes and surfaces MUST NOT be accessible to SPONSOR_STAKEHOLDER, and MUST NOT
appear in their navigation structure under any circumstance:

- Any ReplayAuditRecord or replay audit route
- Any ParityRecord or parity route
- Any EntropyReport or entropy route
- Any constitutional or governance route
- Any venue operational state (screens, overrides, emergencies, corpus)
- Any campaign not linked to their sponsorship
- Any fleet view

Implementation note: The SPONSOR_STAKEHOLDER navigation tree must be rendered from a separate
navigation model — not the full tree with visibility flags toggled off. A visibility flag on
a hidden link can be toggled by browser developer tools. SPONSOR_STAKEHOLDER must never
receive route definitions for prohibited routes.

### 6.2 AUDITOR Write Boundaries

AUDITOR role has read access to all audit data but zero write access. The following
constraints are enforced:

- AUDITOR sees no "Create", "Edit", "Cancel", "Activate", or "Acknowledge" controls on any surface
- AUDITOR navigating to an emergency panel sees the panel in read-only mode (history visible; no activation or acknowledgment controls)
- AUDITOR navigating to a ParityRecord with CLASS_3 divergence sees the divergence detail but has no "Review" action — they are observers, not reviewers
- AUDITOR cannot create PreviewSessions

### 6.3 Cross-Org Boundary

No operator may navigate to resources outside their organizational scope, regardless of role.
An ENTERPRISE_ADMIN for Org A cannot navigate to venues, campaigns, or audit records for Org B.
This boundary is enforced server-side (the API returns 403, not 200 with empty data).

---

## Section 7 — Emergency Shortcut

The emergency panel is accessible from any Venue View with a single action. This is a
constitutional navigation requirement — not a design preference.

### 7.1 Emergency Shortcut Placement

The emergency shortcut appears as a persistent element within all Venue View surfaces:
- Position: top-level action in the Venue View header, always visible regardless of scroll state
- Label: "Emergency" with venue name
- Visual treatment: distinct from all other navigation elements; not subject to information density collapsing
- Click target: minimum 44×44px touch target

### 7.2 Emergency Panel Behavior

Activating the emergency shortcut from any Venue View:
1. Opens the emergency panel as an overlay (does not navigate away from current context)
2. Panel shows: current emergency status for this venue (ACTIVE emergencies with start time, triggerer, scope); "Activate Emergency" action; "Acknowledge" action for any ACTIVE emergency
3. If an emergency is already ACTIVE: panel opens in acknowledgment mode by default
4. Closing the panel returns operator to their previous context without change

### 7.3 Emergency Navigation Priority

During an ACTIVE emergency at a venue, all navigation to that venue's Venue View opens with
the emergency panel surfaced in the foreground. The operator may dismiss the panel, but must
explicitly dismiss it — they cannot arrive at the venue's campaign list or screen view without
first seeing the active emergency status.

This is enforced in the navigation middleware: any route to `/venue/:venue_id/*` that
resolves while the venue has an ACTIVE emergency status will surface the emergency indicator
before rendering the target surface.

---

## Section 8 — Navigation State and the Canonical UI State Model

Navigation state is a component of the broader Canonical UI State Model (see
`docs/shared/CANONICAL-UI-STATE-MODEL.md`). Specific rules:

### 8.1 Navigation Mode Labeling

The navigation chrome indicates the current operational mode of the selected venue or fleet
context at all times:
- Fleet View header: system operational mode (NORMAL / SHADOW / CANARY / DEGRADED)
- Venue View header: venue operational mode + entropy alert level + active emergency indicator

These indicators are never hidden by information density controls. They are permanent.

### 8.2 Navigation in PREVIEW vs LIVE Context

When a PreviewSession is active, the navigation chrome surfaces a persistent PREVIEW banner
that is structurally distinct from the LIVE indicator. Navigation within a preview context
is labeled as preview throughout — the operator cannot mistake a preview-scoped campaign view
for the live campaign list.

Navigation between preview context and live context requires an explicit context switch, not
a breadcrumb click. The interface does not allow passive drift between preview and live state.

### 8.3 Navigation in READ_ONLY and EMERGENCY_FREEZE

When the system is in READ_ONLY or EMERGENCY_FREEZE constitutional state:
- All mutation controls are hidden (not disabled — hidden)
- A persistent system-wide banner is displayed in the navigation chrome for ALL roles, regardless of scope
- This banner is not dismissible
- Even SPONSOR_STAKEHOLDER sees the READ_ONLY / EMERGENCY_FREEZE banner — because it affects whether the system is operating normally

These states are visible to all authenticated users regardless of role or organizational scope.
See OPERATIONAL-CONTEXTS.md for full context transition rules.
