# Wireframe Cross-Reference Matrix — v1

**Document type:** Master wireframe index and cross-reference
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers, design reviewers, frontend engineers, QA
**Status:** Authoritative — this document is the single lookup index for all 55 wireframes across all 5 surface documents
**Depends on:** WIREFRAME-GENERATION-SPECIFICATION-v1.md, CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md, CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md, CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md, CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md, CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md
**Version:** 1.0

---

## Purpose

This document is a master index and cross-reference for all 55 wireframes across the five canonical surface documents. It enables a designer to quickly locate any wireframe by role, operational state, surface, route, active tab, or component.

This document does not define wireframe content — it indexes it. All structural wireframe instructions are in WIREFRAME-GENERATION-SPECIFICATION-v1.md and the five surface specification documents. When this document and a surface specification document conflict, the surface specification governs.

---

## 1. Master Wireframe Inventory

All 55 wireframes across all 5 surfaces. Grouped by surface prefix.

### 1.1 Live Operations Surface (WF-LO-01 through WF-LO-08)

**Source document:** CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md
**Primary route:** `/venues/:venue_id` (single-venue), `/fleet` (multi-venue)
**Surface component:** `VenueOperationsDashboard`

| Wireframe ID | Surface | Document | Route | Role | State | Active Tab | Purpose |
|---|---|---|---|---|---|---|---|
| WF-LO-01 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | HEALTHY | Overview (default) | Baseline healthy state — canonical chrome reference for all shared components |
| WF-LO-02 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | INCIDENT ACTIVE (S3) | Overview with incident banner | S3 major incident visible in Zone A and banner; operator has not yet navigated to IC surface |
| WF-LO-03 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | EMERGENCY_FREEZE (S1) | Overview — Zone B replaced | S1 state: red Zone A border, non-dismissable Emergency Content Banner, Zone B replaced with EMERGENCY_FREEZE panel |
| WF-LO-04 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | OFFLINE / DEGRADED | Overview with autonomy clock | Venue offline: 72h autonomy clock panel visible, degraded connectivity indicators |
| WF-LO-05 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | VIEWER | HEALTHY | Overview (read-only) | Identical layout to WF-LO-01 with all write controls absent from DOM |
| WF-LO-06 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/fleet` | ADMIN | HEALTHY (multi-venue) | Fleet Overview | Multi-venue aggregate view with per-venue state tiles and severity roll-up |
| WF-LO-07 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | HEALTHY (override accumulation) | Overview with warning | Override accumulation warning panel visible when active overrides ≥ 3 |
| WF-LO-08 | Live Operations | CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md | `/venues/:venue_id` | OPERATOR | RECOVERED_BUT_UNTRUSTED | Overview with trust gate | Trust verification gate rendered; operator must confirm before dismissing untrusted state |

### 1.2 Incident Command Surface (WF-IC-01 through WF-IC-12)

**Source document:** CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md
**Primary route:** `/incidents/:incident_id` (canonical), `/venues/:venue_id/incident/:incident_id` (venue-scoped)
**Surface component:** `IncidentCommanderSurface`

| Wireframe ID | Surface | Document | Route | Role | State | Active Tab | Purpose |
|---|---|---|---|---|---|---|---|
| WF-IC-01 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | OPERATOR (non-commander) | DECLARED — S3 | Tab 1: Situation Overview | Non-commander OPERATOR view: commander-exclusive controls absent from DOM; severity S3 indicators active |
| WF-IC-02 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | COMMANDER | DECLARED — S2 | Tab 1: Situation Overview | Commander view of S2 critical: Transfer Command button present, Mark Contained accessible, elevated severity indicators |
| WF-IC-03 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | OPERATOR | COMMANDER_LAPSED | Tab 1 — Assume Command flow | COMMANDER_LAPSED state: pulsing red countdown timer visible, Assume Command CTA rendered, 15-min window displayed |
| WF-IC-04 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | COMMANDER | DECLARED | Tab 2: Command Log | Command log with annotation entry form; audit event emitted before write; COMMANDER_LAPSED log entry example |
| WF-IC-05 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | OPERATOR | DECLARED | Tab 3: Override Management | Place Override form open; override accumulation counter visible; L6 override path unavailable to non-ADMIN |
| WF-IC-06 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | ADMIN | DECLARED | Tab 3: Override Management | L6 Emergency Override confirmation: type "EMERGENCY" input; "PERMANENT UNTIL REMOVED" label; no auto-expiry option rendered |
| WF-IC-07 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | OPERATOR | DECLARED | Tab 4: PRE Status | PRE resolution state and confidence levels during active incident; explainability panel inline |
| WF-IC-08 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | COMMANDER | DECLARED | Tab 5: Incident Actions | Transition to CONTAINED action available to commander; confirmation flow for severity change |
| WF-IC-09 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | ADMIN | DECLARED | Tab 6: Evidence Package | Tab 6 visible in DOM (ADMIN only); evidence package, counterfactual links, corpus hash references |
| WF-IC-10 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | OPERATOR | S1 EMERGENCY_FREEZE | Tab 1 — automatic Zone B replacement | S1 state: Zone B replaced with EMERGENCY_FREEZE panel; command actions constrained to S1-approved list |
| WF-IC-11 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | VIEWER | DECLARED | Tab 1: Situation Overview (read-only) | VIEWER state: all write controls absent; Tab 6 absent; full read access to Tabs 1–5 |
| WF-IC-12 | Incident Command | CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md | `/incidents/:incident_id` | Any | REPLAY mode | Tab 1: Situation Overview (replay) | REPLAY amber persistent banner; all write controls absent (not disabled — absent from DOM); timeline controls present |

### 1.3 Replay Investigation Surface (WF-RP-01 through WF-RP-10)

**Source document:** CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md
**Primary route:** `/venues/:venue_id/replay/:session_id` (canonical), `/replay/:session_id` (unscoped alias)
**Surface component:** `ReplayForensicsWorkspace`

| Wireframe ID | Surface | Document | Route | Role | State | Active Tab | Purpose |
|---|---|---|---|---|---|---|---|
| WF-RP-01 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 1: Timeline — PAUSED | Session loaded, timeline paused at incident start; no write controls; REPLAY amber banner persistent |
| WF-RP-02 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 1: Timeline — REPLAYING 1x | Timeline in playback at 1x speed; playback controls visible; REPLAY banner persistent |
| WF-RP-03 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 2: Event Log — filtered | Event log with severity filter applied; event rows annotatable by OPERATOR+ |
| WF-RP-04 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 3: PRE Resolution Replay | PRE resolution state at replay cursor timestamp; explainability tree showing level-by-level resolution |
| WF-RP-05 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 4: Override History at timestamp | Override state as it existed at the pinned replay timestamp; audit trail linkage visible |
| WF-RP-06 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT | Tab 5: Findings & Annotations | Annotation entry form; additive-only annotations; existing annotations immutable (no delete, no edit) |
| WF-RP-07 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | ADMIN | POST_INCIDENT | Tab 6: Counterfactual Analysis | Tab 6 visible in DOM (ADMIN only); counterfactual scenario builder; ADMIN_ONLY label on tab |
| WF-RP-08 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | VIEWER | POST_INCIDENT | Tab 1: Timeline — PAUSED (read-only) | VIEWER state: no annotations, no Tab 6; Tab 5 visible but annotations absent; read-only event log |
| WF-RP-09 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | DIVERGENCE session | Tab 1: Timeline with corpus hash mismatch | Hash mismatch warning banner; DIVERGENCE badge on session header; investigation scope highlighted |
| WF-RP-10 | Replay Investigation | CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md | `/venues/:venue_id/replay/:session_id` | OPERATOR | POST_INCIDENT — multi-collaborator | Tab 1: Timeline (multi-collaborator) | Collaborator presence indicators; concurrent viewer count; no collaborative write conflicts possible (annotations are additive-only) |

### 1.4 CMS Content Operations Surface (WF-CMS-01 through WF-CMS-10)

**Source document:** CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md
**Primary route:** `/cms` (workspace root), with tab-specific paths `/cms/library`, `/cms/schedule`, etc.
**Surface component:** `CMSContentOperationsWorkspace`

| Wireframe ID | Surface | Document | Route | Role | State | Active Tab | Purpose |
|---|---|---|---|---|---|---|---|
| WF-CMS-01 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/library` | Content Creator | NORMAL | Tab 1: Content Library | Content library browse view; upload and tag controls visible; content cards with delivery status |
| WF-CMS-02 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/schedule` | Content Creator | NORMAL — 72h warning visible | Tab 2: Schedule Builder | Schedule builder with 72h lead-time warning banner on slots approaching the boundary |
| WF-CMS-03 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/schedule` | Content Creator | SUBMIT BLOCKED (within 24h) | Tab 2: Schedule Builder — blocked | Submit button blocked; "Content window closed" explanation; slot boundary enforcement visible |
| WF-CMS-04 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/templates` | League Admin | NORMAL | Tab 3: Template Management | Template list; template edit controls visible for League Admin role; L4 sponsor slot ceiling enforced |
| WF-CMS-05 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/sponsorship` | Venue Admin | NORMAL | Tab 4: Sponsor Management | Sponsor slot configuration; L4 ceiling indicator; contract dates and delivery windows |
| WF-CMS-06 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/delivery` | VIEWER | NORMAL | Tab 5: Delivery Status | Corpus delivery status per venue; read-only; no authoring controls; delivery health indicators |
| WF-CMS-07 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/history` | Platform Admin | NORMAL | Tab 6: Content History | Full content decision audit history; corpus hash references; ADMIN-level detail |
| WF-CMS-08 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms` | OPERATOR+ | EMERGENCY_FREEZE | Any tab — authoring disabled | All authoring nav items disabled with tooltip; EMERGENCY_FREEZE banner across Zone B; read-only mode enforced |
| WF-CMS-09 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/schedule` | Content Creator | Training Mode active | Tab 2: Schedule Builder — training | Training Mode badge in status bar; all submits intercepted; changes non-destructive; training corpus distinct |
| WF-CMS-10 | CMS Operations | CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md | `/cms/library` | VIEWER | NORMAL | Tab 1: Content Library (read-only) | Identical layout to WF-CMS-01 with all write controls absent from DOM |

### 1.5 Venue Operations Surface (WF-VO-01 through WF-VO-10)

**Source document:** CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md
**Primary route:** `/venues/:venue_id` (overview), with tab-specific paths `/venues/:venue_id/screens`, `/venues/:venue_id/content`, etc.
**Surface component:** `VenueOperationsDashboard` (deep-dive variant)

| Wireframe ID | Surface | Document | Route | Role | State | Active Tab | Purpose |
|---|---|---|---|---|---|---|---|
| WF-VO-01 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id` | OPERATOR | LIVE — HEALTHY | Tab 1: Overview | Full venue health overview; screens healthy; autonomy clock not shown; no active incidents |
| WF-VO-02 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id` | OPERATOR | OFFLINE — autonomy clock running | Tab 1: Overview with autonomy clock | 72h autonomy clock panel prominent; connectivity lost; offline operation context and time remaining |
| WF-VO-03 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id` | OPERATOR | RECOVERED_BUT_UNTRUSTED | Tab 1: Overview with trust gate | Trust verification gate: operator must confirm corpus integrity before trusting recovery; UNTRUSTED badge |
| WF-VO-04 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id/screens` | ADMIN | NORMAL | Tab 2: Screen Management — enrollment flow | New screen enrollment wizard; ADMIN-only controls; pairing code entry; screen assignment to zone |
| WF-VO-05 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id/content` | OPERATOR | NORMAL | Tab 3: Content Delivery | Corpus delivery health per content package; delivery clock; 72h buffer visual; next scheduled delivery |
| WF-VO-06 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id/overrides` | OPERATOR | NORMAL | Tab 4: Override History | Active and historical overrides; accumulation counter; L6 "PERMANENT UNTIL REMOVED" labels if present |
| WF-VO-07 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id/pre` | OPERATOR | NORMAL | Tab 5: PRE Resolution State | PRE resolution tree at current moment; level-by-level confidence; explainability inline |
| WF-VO-08 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id/history` | OPERATOR | NORMAL | Tab 6: Venue History | Chronological event timeline for venue; incident links; override history entries; corpus delivery events |
| WF-VO-09 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id` | VIEWER | HEALTHY | Tab 1: Overview (read-only) | Identical layout to WF-VO-01; all write controls absent from DOM; all tabs visible |
| WF-VO-10 | Venue Operations | CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md | `/venues/:venue_id` | Any | DECOMMISSIONED | Overview — archive view | "VENUE DECOMMISSIONED" banner; all data read-only; no write controls; URL still resolves (permanent URL requirement) |

---

## 2. Role Coverage Matrix

Which wireframes cover each role. A dash (—) indicates the role has no wireframes for that surface. Where a role appears in a cell, the wireframe IDs are listed.

| Role | WF-LO | WF-IC | WF-RP | WF-CMS | WF-VO |
|---|---|---|---|---|---|
| VIEWER | WF-LO-05 | WF-IC-11 | WF-RP-08 | WF-CMS-06, WF-CMS-10 | WF-VO-09 |
| OPERATOR (non-commander) | WF-LO-01, WF-LO-02, WF-LO-03, WF-LO-04, WF-LO-07, WF-LO-08 | WF-IC-01, WF-IC-03, WF-IC-05, WF-IC-07, WF-IC-10 | WF-RP-01, WF-RP-02, WF-RP-03, WF-RP-04, WF-RP-05, WF-RP-06, WF-RP-09, WF-RP-10 | WF-CMS-08 | WF-VO-01, WF-VO-02, WF-VO-03, WF-VO-05, WF-VO-06, WF-VO-07, WF-VO-08 |
| COMMANDER (OPERATOR acting as incident commander) | — | WF-IC-02, WF-IC-04, WF-IC-08 | — | — | — |
| ADMIN | WF-LO-06 | WF-IC-06, WF-IC-09 | WF-RP-07 | WF-CMS-07 | WF-VO-04 |
| Any role (state-driven) | — | WF-IC-12 | — | WF-CMS-08 | WF-VO-10 |
| Content Creator | — | — | — | WF-CMS-01, WF-CMS-02, WF-CMS-03, WF-CMS-09 | — |
| League Admin | — | — | — | WF-CMS-04 | — |
| Venue Admin | — | — | — | WF-CMS-05 | — |
| Platform Admin | — | — | — | WF-CMS-07 | — |

**Notes:**
- COMMANDER is an OPERATOR who currently holds `commander_id` in the incident record. It is not a separate authentication role — it is a runtime authority state.
- WF-IC-12 and WF-CMS-08 and WF-VO-10 are state-driven: the wireframe applies regardless of role. Access control within those states is specified in the surface documents.
- Content Creator, League Admin, Venue Admin, and Platform Admin are CMS-specific role designations. They are not platform-level roles and do not appear in Live Operations or Incident Command surfaces.

---

## 3. State Coverage Matrix

Which operational and UI states are visually covered across the wireframe set.

| Operational State | Wireframes covering this state |
|---|---|
| HEALTHY | WF-LO-01, WF-LO-05, WF-LO-06, WF-VO-01, WF-VO-09 |
| INCIDENT ACTIVE (S1 EMERGENCY_FREEZE) | WF-LO-03, WF-IC-10, WF-CMS-08 |
| INCIDENT ACTIVE (S2 CRITICAL) | WF-IC-02 |
| INCIDENT ACTIVE (S3 MAJOR) | WF-LO-02, WF-IC-01 |
| COMMANDER_LAPSED | WF-IC-03, WF-IC-04 (log entry showing lapsed state) |
| OFFLINE + 72h autonomy clock running | WF-LO-04, WF-VO-02 |
| RECOVERED_BUT_UNTRUSTED | WF-LO-08, WF-VO-03 |
| DEGRADED (general) | WF-LO-04 |
| REPLAY mode (active) | WF-IC-12, WF-RP-01, WF-RP-02, WF-RP-03, WF-RP-04, WF-RP-05, WF-RP-06, WF-RP-07, WF-RP-08, WF-RP-09, WF-RP-10 |
| POST_INCIDENT (replay investigation) | WF-RP-01 through WF-RP-10 |
| CORPUS DIVERGENCE / hash mismatch | WF-RP-09 |
| DECOMMISSIONED venue | WF-VO-10 |
| Override accumulation warning (≥ 3 active) | WF-LO-07, WF-IC-05, WF-VO-06 |
| Training Mode active | WF-CMS-09 |
| EMERGENCY_FREEZE (CMS blocked) | WF-CMS-08 |
| Submit blocked (within 72h / 24h window) | WF-CMS-02, WF-CMS-03 |
| Multi-collaborator session | WF-RP-10 |
| Screen enrollment in progress | WF-VO-04 |

---

## 4. Shared Chrome Components — Cross-Surface Reference

Shared components that appear across multiple surfaces. The canonical definition wireframe is the first wireframe where that component is fully specified. Subsequent appearances must match the canonical definition exactly.

| Component | Canonical definition wireframe | Also appears in |
|---|---|---|
| System Status Bar (48px, full width) | WF-LO-01 | All 55 wireframes — never absent |
| Audit Trace Footer (28px, full width) | WF-LO-01 | All 55 wireframes — never absent |
| Zone A Navigation Panel (280px fixed) | WF-LO-01 | WF-IC-01, WF-RP-01, WF-CMS-01, WF-VO-01 (and all variants) |
| ConstitutionalStateIndicator (in status bar) | WF-LO-01 | All wireframes — state + confidence label always paired |
| ActiveModeIndicator (LIVE / REPLAY / INCIDENT ACTIVE) | WF-LO-01 | WF-IC-01 (INCIDENT ACTIVE), WF-RP-01 (REPLAY), all others |
| SessionClock ("Wall:" label) | WF-LO-01 | All wireframes — always labeled "Wall:" not bare time |
| OperatorIdentityBadge (name + role) | WF-LO-01 | All wireframes |
| ElevateSessionButton (in status bar) | WF-LO-01 | All wireframes — disabled if elevation already active |
| NotificationBadge (unread count) | WF-LO-01 | All wireframes where unread count is non-zero |
| VenueSelector (Zone A, Pane A1) | WF-LO-01 | All venue-scoped wireframes |
| IncidentList with severity badges (Zone A, Pane A2) | WF-LO-02 | WF-IC-01, WF-VO-01, and all venue-scoped wireframes |
| Active incident banner (Zone A shortcut) | WF-LO-02 | WF-CMS-02 (if incident active), WF-VO-01 (if incident active) |
| EMERGENCY_FREEZE red Zone A border | WF-LO-03 | WF-IC-10, WF-CMS-08 |
| Emergency Content Banner (non-dismissable, L6) | WF-LO-03 | WF-VO-01 (when L6 active) |
| COMMANDER_LAPSED pulsing countdown indicator | WF-IC-03 | WF-IC-04 (visible in command log entry) |
| Assume Command CTA | WF-IC-03 | — (only rendered in COMMANDER_LAPSED state) |
| L6 "PERMANENT UNTIL REMOVED" label | WF-IC-06 | WF-IC-05 (if L6 override exists), WF-VO-06 (if L6 override exists) |
| Type "EMERGENCY" confirmation input | WF-IC-06 | — (only rendered for L6 confirmation) |
| Persistent REPLAY amber banner | WF-RP-01 | WF-IC-12, all WF-RP wireframes |
| Tab-suppressed write controls (absent, not disabled) | WF-RP-01 | WF-IC-12, WF-RP-01 through WF-RP-10, WF-IC-11 |
| 72h autonomy clock panel | WF-VO-02 | WF-LO-04, WF-VO-05 (delivery clock reference) |
| RECOVERED_BUT_UNTRUSTED trust gate | WF-LO-08 | WF-VO-03 |
| Override accumulation warning panel | WF-LO-07 | WF-IC-05, WF-VO-06 |
| PRE Explainability inline panel | WF-LO-01 (Section 3 reference) | WF-IC-07, WF-VO-07, WF-RP-04 |
| CORPUS DIVERGENCE hash mismatch banner | WF-RP-09 | — (only rendered in divergence sessions) |
| EMERGENCY_FREEZE CMS authoring block (disabled nav + tooltip) | WF-CMS-08 | — (only rendered in S1 state for CMS surface) |
| VENUE DECOMMISSIONED archive banner | WF-VO-10 | — (only rendered for decommissioned venues) |
| Training Mode badge (status bar variant) | WF-CMS-09 | — (only rendered when training mode is active) |
| 72h schedule boundary warning banner | WF-CMS-02 | WF-CMS-03, WF-VO-05 |
| Tab 6 ADMIN-only suppression (absent from non-ADMIN DOM) | WF-IC-09 (present) vs WF-IC-01 (absent) | WF-RP-07 (present) vs WF-RP-01 (absent) |

---

## 5. Navigation Flow Map

How operators navigate between surfaces in the course of normal and incident workflows. Routes shown are canonical routes from APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md.

```
Authentication (/login)
  └─→ / (root redirect)
        ├─→ /venues/:venue_id          [OPERATOR, single assigned venue]
        └─→ /fleet                     [ADMIN or OPERATOR with multiple venues]

Live Operations (/venues/:venue_id)  [WF-LO-01 through WF-LO-08]
  ├─→ /fleet                          [click "All Venues" in Zone A]
  ├─→ /venues/:venue_id               [Venue Operations deep-dive — same route,
  │                                     distinct workspace from Live Operations
  │                                     via tab navigation within the surface]
  ├─→ /incidents/:incident_id         [click active incident in Pane A2 incident list,
  │                                     or click incident banner in Zone B]
  └─→ /cms                            [Zone A navigation link]

Fleet Overview (/fleet)  [WF-LO-06]
  └─→ /venues/:venue_id               [click any venue tile]

Incident Command (/incidents/:incident_id)  [WF-IC-01 through WF-IC-12]
  ├─→ /venues/:venue_id/replay/:session_id  [Tab 1: "Open in Replay Workspace"
  │                                           button — generates session from
  │                                           incident corpus]
  └─→ /venues/:venue_id               [Zone A venue name link — returns to
                                        venue overview]

Replay Investigation (/venues/:venue_id/replay/:session_id)  [WF-RP-01 through WF-RP-10]
  ├─→ /venues/:venue_id               [session header venue link — returns to
  │                                     venue overview]
  └─→ /incidents/:incident_id         [incident reference link in session header
                                        — opens originating incident if session
                                        has incident_id]

Venue Operations (/venues/:venue_id + tab routes)  [WF-VO-01 through WF-VO-10]
  ├─→ /incidents/:incident_id         [Zone A active incident shortcut]
  ├─→ /venues/:venue_id/replay        [Venue History tab "Open Replay" for any event]
  └─→ /cms                            [Zone A navigation link]

CMS (/cms/*)  [WF-CMS-01 through WF-CMS-10]
  └─→ /venues/:venue_id               [delivery status venue link in Tab 5]

Deep-link entry points (shareable, permanent):
  /incidents/:incident_id             → Incident Command Surface
  /venues/:venue_id/replay/:session_id → Replay Investigation Surface
  /venues/:venue_id                   → Venue Operations (including decommissioned)

Note: Zone A is always visible. Navigation to a new surface changes Zone B only.
Zone A Pane A2 (IncidentList) is always reachable regardless of current workspace.
```

---

## 6. Constitutional Constraints Summary

Constraints that must be enforced visually in wireframes. Each row states the rule, the visual enforcement mechanism, and the wireframes that demonstrate it. Any wireframe depicting a state where this rule applies must implement the enforcement mechanism.

| Constitutional Rule | Visual Enforcement Mechanism | Wireframe IDs Demonstrating It |
|---|---|---|
| 72h corpus delivery lead time | "72h window closed" banner + slot boundary warning on schedule grid + blocked submit state | WF-CMS-02, WF-CMS-03, WF-VO-05 |
| Zero live write controls in REPLAY mode | Write controls absent from DOM (not disabled, not greyed — not rendered) | WF-RP-01, WF-RP-02, WF-RP-03, WF-RP-04, WF-RP-05, WF-RP-06, WF-RP-07, WF-RP-08, WF-RP-09, WF-RP-10, WF-IC-12 |
| L6 override requires typed "EMERGENCY" confirmation | Text input with exact-match validation; submit blocked until value matches | WF-IC-06 |
| L6 override never auto-expires | "PERMANENT UNTIL REMOVED" label on override entry; no expiry date/time field rendered | WF-IC-05, WF-IC-06, WF-VO-06 (when L6 active) |
| COMMANDER_LAPSED 15-min window enforced | Pulsing red countdown timer; Assume Command CTA; timer reaches 00:00 before system auto-escalates | WF-IC-03, WF-IC-04 (log entry) |
| Tab 6 ADMIN-only (Incident Command) | Tab element absent from DOM for non-ADMIN users (not hidden, not disabled — not rendered) | WF-IC-09 (Tab 6 present) vs WF-IC-01, WF-IC-11 (Tab 6 absent) |
| Tab 6 ADMIN-only (Replay Investigation) | Tab element absent from DOM for non-ADMIN users | WF-RP-07 (Tab 6 present) vs WF-RP-01, WF-RP-08 (Tab 6 absent) |
| RECOVERED_BUT_UNTRUSTED requires operator acknowledgement | Trust verification gate panel; no dismissal without explicit confirmation; UNTRUSTED badge persists until confirmed | WF-LO-08, WF-VO-03 |
| Emergency Content Banner non-dismissable (S1 / L6) | No close button, no dismiss control, no X rendered on banner | WF-LO-03 |
| EMERGENCY_FREEZE blocks CMS authoring | CMS navigation items rendered disabled with tooltip explaining freeze; Zone B shows EMERGENCY_FREEZE panel | WF-CMS-08 |
| Venue URL permanence (including decommissioned venues) | DECOMMISSIONED archive view renders at same URL; no redirect; no 404; VENUE DECOMMISSIONED banner | WF-VO-10 |
| Session clock is governed time, not wall clock | Clock always labeled "Wall:" — never bare time, never unlabeled | WF-LO-01 (canonical), all wireframes |
| Audit event emitted before write | Interaction annotations on write actions in command log wireframes | WF-IC-04, WF-IC-05 |
| Annotations are additive-only (Replay) | No delete or edit controls on existing annotation entries; only "Add annotation" action | WF-RP-06 |
| L4 sponsor content ceiling | Sponsor slot counter with ceiling cap indicator; slot creation blocked at ceiling | WF-CMS-04, WF-CMS-05 |
| Confidence level always paired with status | Status indicators always render confidence badge alongside state value | WF-LO-01 (canonical), WF-IC-07, WF-VO-07, WF-RP-04 |
| Commander-exclusive controls absent (not disabled) for non-commanders | Transfer Command, Mark Contained absent from DOM for non-commander OPERATORs | WF-IC-01 (absent) vs WF-IC-02 (present) |

---

## 7. Known Ambiguities and Open Design Questions

These are genuine design ambiguities that remain unresolved as of the wireframe specification phase. Each ambiguity is registered in FRONTEND-IMPLEMENTATION-READINESS-ASSESSMENT-v1.md and must be resolved before wireframes for the affected surfaces are declared implementation-ready.

| Ambiguity ID | Description | Affected Wireframes | Current status |
|---|---|---|---|
| A-07 | VIEWER / IC authority boundary. Specifically: which Incident Command Surface controls are absent vs disabled for a VIEWER who navigates to an active incident. The surface spec states "No write controls rendered" for VIEWER but does not enumerate each control individually. The question is whether any controls should be visually present but disabled (for discoverability) or fully absent (for authority purity). | WF-IC-11, and any IC wireframe used as a VIEWER comparison | OPEN — designer must not invent a resolution; wait for A-07 ruling |
| R-07 | `trust_state_at_event` corpus field. Replay Investigation Tab 1 event entries are specified to show per-event trust state. This field may not be populated in the corpus for older events. Wireframes showing event log rows with `trust_state_at_event` values may not accurately represent what is displayable until this field is confirmed in the corpus schema. | WF-RP-01, WF-RP-02, WF-RP-03, WF-RP-08, WF-RP-09 | OPEN — corpus schema confirmation pending |
| A-11 | Venue Operations route confirmation. The Venue Operations Surface spec uses `/venues/:venue_id` as the primary route, but an alternative path `/network/venues/:venue_id` appeared in early architecture drafts. The APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md document specifies `/venues/:venue_id` as authoritative. If this changes, all Venue Operations and Venue-scoped Incident Command wireframes are affected. | WF-VO-01 through WF-VO-10, WF-IC-01 through WF-IC-12, WF-RP-01 through WF-RP-10 | RESOLVED in route architecture doc — `/venues/:venue_id` is canonical. Confirm with platform team before starting WF-VO. |

---

## 8. Implementation Priority Sequence

Wireframes ordered by operator workflow criticality. P1 wireframes are required before any operator can use the platform. P4 wireframes cover administrative and edge-case states that are important but not blocking for initial deployment.

### P1 — Critical path (operators cannot perform core work without these)

These wireframes define the baseline operator experience. No operator can monitor a venue, respond to an incident, or identify a COMMANDER_LAPSED state without these being implemented.

| Wireframe ID | Rationale |
|---|---|
| WF-LO-01 | Canonical healthy state — all shared chrome is defined here; nothing else can be implemented without this reference |
| WF-IC-01 | Non-commander operator view of active incident — most common IC surface entry state |
| WF-IC-03 | COMMANDER_LAPSED — safety-critical; operators must be able to assume command within 15 minutes |
| WF-VO-01 | Venue overview healthy — operator first destination for any venue check |
| WF-VO-02 | Venue offline with autonomy clock — venue cannot be left unmonitored during outage |

### P2 — High value (incident response capability)

These wireframes are required for a complete incident response workflow. Without them, operators cannot declare, manage, or close an incident.

| Wireframe ID | Rationale |
|---|---|
| WF-IC-02 | Commander view — required for the operator who holds command authority |
| WF-IC-04 | Command log — required for annotation and audit compliance during incident |
| WF-IC-05 | Override Management — required for placing any override during an incident |
| WF-IC-08 | Incident Actions — required for transitioning to CONTAINED and closing incidents |
| WF-IC-10 | S1 EMERGENCY_FREEZE — safety-critical constitutional state; must be implemented before any live venue deployment |
| WF-LO-02 | Incident visible in Live Operations — operators must see incidents from the primary workspace |
| WF-LO-03 | EMERGENCY_FREEZE from Live Operations — safety-critical; must match WF-IC-10 state visually |

### P3 — Standard operations (required for operational completeness)

These wireframes enable the full standard operations loop: post-incident review, content scheduling, and venue management.

| Wireframe ID | Rationale |
|---|---|
| WF-RP-01 | Replay timeline paused — entry state for all post-incident investigations |
| WF-RP-02 | Replay timeline playing — required for navigating timeline during investigation |
| WF-CMS-01 | Content Library — first CMS surface operators encounter |
| WF-CMS-02 | Schedule Builder with 72h warning — required for operators to plan content |
| WF-VO-04 | Screen enrollment — required for ADMIN to add screens at a new venue |
| WF-VO-07 | PRE Resolution State — required for operators to understand why content is playing |

### P4 — Administrative and edge cases

Remaining wireframes covering role-specific administration, VIEWER access, advanced replay features, and permanent-state scenarios. Important for platform completeness and compliance but not blocking for initial operator deployment.

| Wireframe IDs | Category |
|---|---|
| WF-IC-06, WF-IC-09 | ADMIN-only IC actions (L6 override, Evidence Package) |
| WF-IC-11, WF-IC-12 | VIEWER access, REPLAY mode for IC surface |
| WF-RP-03 through WF-RP-10 | Full replay investigation tab coverage |
| WF-CMS-03 through WF-CMS-10 | Full CMS surface coverage including blocked states, ADMIN tabs, training mode |
| WF-LO-04 through WF-LO-08 | Live Operations edge states (degraded, VIEWER, fleet, override warning, trust gate) |
| WF-VO-03, WF-VO-05, WF-VO-06, WF-VO-08, WF-VO-09, WF-VO-10 | Venue Operations edge states (trust recovery, delivery, decommissioned) |

---

*Document version: 1.0 — 2026-06-02*
*Total wireframes indexed: 55 (WF-LO: 8, WF-IC: 12, WF-RP: 10, WF-CMS: 10, WF-VO: 10)*
*Next update: when new wireframes are added or surface documents are revised*
