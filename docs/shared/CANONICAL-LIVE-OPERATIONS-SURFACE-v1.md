# CANONICAL-LIVE-OPERATIONS-SURFACE-v1

**Document type:** Canonical reference surface specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers, frontend engineers, QA
**Depends on:** OPERATIONAL-WORKSPACES-v1.md, FRONTEND-COMPONENT-TAXONOMY-v1.md,
FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md, APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md,
WORKSPACE-ASSEMBLY-AND-COMPOSITION-BLUEPRINT-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Surface Identity

### 1.1 Surface Name and Route

**Surface name:** Live Operations Surface (also referred to as the Venue Operations Dashboard or Venue Dashboard Workspace)

**Canonical routes:**
- `/venues/:venue_id` — single-venue view, primary form
- `/fleet` — multi-venue aggregate view (OPERATOR and ADMIN only; see Section 3.6)

**Workspace type:** Live operational monitoring. State-centric, not feature-centric.

**Component identifier:** `VenueOperationsDashboard`

**Default entry point:** This is the first workspace an authenticated operator sees. The `/` redirect resolves here for OPERATOR roles with a single assigned venue. For ADMIN and OPERATOR with multiple venues, `/` redirects to `/fleet`, from which any venue opens this surface.

### 1.2 Who Sees This Surface

| Role | Access | Constraints |
|------|--------|-------------|
| VIEWER | Yes | Read-only; all write controls absent from DOM |
| OPERATOR | Yes | Full access to write controls subject to state restrictions |
| ADMIN | Yes | Full access; additional multi-venue aggregate view at `/fleet` |

Minimum role: VIEWER. If a VIEWER has no assigned venues, they are redirected to `/unauthorized` with the message "No venues assigned to your account — contact your administrator."

### 1.3 What Triggers Navigation to This Surface

- Authenticated user with a single assigned venue: automatic redirect from `/`
- Clicking a venue in Zone A Pane A1 (VenueSelector)
- Clicking a VenueCard in the Fleet Overview workspace (`/fleet`)
- Clicking a venue name link from any notification item in Pane A3
- Deep-link to `/venues/:venue_id` from a notification, email, or shared URL
- Browser back navigation from an Incident Commander Surface when the IC was opened from this surface
- Pressing "View Venue" (ViewVenueButton) from within the Incident Commander Surface

### 1.4 What Is Never Shown on This Surface

- Incident command controls (EscalationButton, ContainmentButton, ResolutionButton) — those belong to the IC surface at `/venues/:venue_id/incident/:incident_id`
- Replay timeline scrubber for historical navigation — that belongs to the Replay and Forensics Workspace
- Training sandbox or simulation mode content
- Approval queue
- Sponsor SOV delivery metrics
- Any data marked `_replay: true` — this surface only renders live data
- Any data marked `_simulation: true`
- Tab 6 (Counterfactual) from replay — not present on this surface at all

---

## 2. Zone A — Left Navigation Panel (280px)

Zone A is 280px wide, fixed, never resizable. It renders for the entire authenticated session regardless of which Zone B workspace is active. Zone A data subscriptions are independent of Zone B — they are established at ApplicationShell mount and do not update when Zone B changes.

### 2.1 Zone A Structure

```
ZoneAPanel (280px fixed)
├── Pane A1 — VenueSelector
├── Pane A2 — IncidentList
├── Pane A3 — NotificationTrayAccess
└── Pane A4 — OperatorToolsMenu
```

### 2.2 Pane A1 — VenueSelector

**Label:** "Venues" (small, uppercase, grey label above the list)

Each venue entry shows:
- Venue name (truncated at 220px width with ellipsis)
- A colored state dot (right-aligned): green = LIVE, amber = DEGRADED or SYNCING, red = INCIDENT or OFFLINE, grey = INITIALIZING or UNKNOWN
- A small incident badge (red pill with count) if the venue has active incidents

**Active state:** The venue currently displayed in Zone B has a highlighted background (system accent color, full 280px width). The active venue row does not scroll out of view on load — it is scrolled into view if needed.

**Role behavior:**
- VIEWER: list shows only venues in `session.assigned_venue_ids`. No other venues shown.
- OPERATOR: list shows all venues. Venues not in `assigned_venue_ids` are shown in a secondary visual style (lighter text, no write actions available for them).
- ADMIN: list shows all venues with no visual distinction by assignment.

**Interaction:** Click any venue row to navigate Zone B to `/venues/:venue_id`. Does not affect Zone A state (the active highlight updates; Zone A does not remount or scroll to top).

**Update behavior:** State dots update in real-time via WebSocket. Updates to individual venue dots must not reset Zone A scroll position.

**Alert badge behavior:** A venue's incident count badge appears as soon as an incident transitions to `DECLARED` state. The badge count decrements within 60 seconds of an incident resolving. If a venue has 0 incidents, no badge is rendered (the space is not reserved).

**Authority annotation:** No venue in Pane A1 requires elevated session. Clicking a venue is always permitted.

### 2.3 Pane A2 — IncidentList

**Label:** "Active Incidents" (small, uppercase, grey label above the list)

Each incident entry shows:
- Severity badge: "S1", "S2", "S3", "S4", or "S5" in a colored pill (S1 = red, S2 = orange, S3 = amber, S4 = yellow, S5 = grey-blue)
- Venue name (truncated)
- Time since declaration: e.g., "14m ago"

**Sort order:** Severity descending (S1 first), then `declared_at` descending within the same severity tier.

**Maximum displayed:** 20 incidents. If more than 20 are active, a link at the bottom of the list reads "View all incidents →" and navigates to `/fleet` with an incident filter active.

**Empty state:** When there are no active incidents, Pane A2 renders a small text: "No active incidents" in muted grey. This empty state requires positive confirmation from the backend — if `active_incidents` data is unavailable, the pane renders "Incident status unavailable" in amber, not the empty state message.

**Interaction:** Click any incident entry to navigate Zone B to `/incidents/:incident_id`. Does not affect Zone A position or state.

**Resolved incidents:** Removed from Pane A2 within 60 seconds of resolution. Replay session links for resolved incidents are accessible via the venue dashboard timeline section or the Replay Workspace, not from Pane A2.

**During EMERGENCY_FREEZE:** Pane A2 remains active and fully interactive. Incident navigation is explicitly permitted during EMERGENCY_FREEZE.

### 2.4 Pane A3 — NotificationTrayAccess

**Label:** Bell icon with unread count badge (red circle, white number). If count is 0, no badge renders.

**Interaction:** Click the bell icon to open the notification tray as an overlay anchored to Zone A. This does not change Zone B or the URL.

**Notification tray overlay:**
- Renders above Zone A content at z-index 700 (dropdown/popover layer)
- Each notification shows: type icon, text summary, venue name, timestamp, and a clickable area that navigates Zone B to the relevant route and closes the tray
- "Mark all read" button at the top of the tray
- Tray closes on second click of the bell icon, on Escape key, or on click outside the tray

**During EMERGENCY_FREEZE:** Tray remains accessible. Notifications are displayed. Navigation from notifications to permitted routes works normally. Navigation to blocked routes (CMS, Training) from notifications shows a tooltip "Unavailable during Emergency Freeze" and does not navigate.

### 2.5 Pane A4 — OperatorToolsMenu

**Label:** Operator display name + role badge (e.g., "Jordan H. · OPERATOR"). Located at the bottom of Zone A.

**Contains:**
- **Handoff initiation:** Button labeled "Start Handoff." Opens a modal overlay. Does not change Zone B. Requires OPERATOR or ADMIN role; absent for VIEWER.
- **Session elevation request:** Button labeled "Request Elevated Session." Opens the elevation request flow as a modal overlay. Present for OPERATOR and ADMIN; absent for VIEWER.
- **Elevation countdown:** If `session.elevation_active: true`, displays a countdown in amber: "Elevated session: 14m remaining." This is derived from `session.elevation_expires_at` using the governed timestamp from the server, not `Date.now()`.
- **Session information:** Small text showing session_start time and certification_level.
- **Logout:** Button labeled "Sign Out."

**During EMERGENCY_FREEZE:** Handoff and elevation request are disabled with a tooltip "Session management restricted during Emergency Freeze." Logout remains active.

### 2.6 Zone A During EMERGENCY_FREEZE

When `constitutional_state.state === "EMERGENCY_FREEZE"`:

1. Zone A receives a red left border (4px, full height) to provide a persistent peripheral alarm signal.
2. Pane A1 venue list remains functional — operators must be able to navigate between venues to monitor state.
3. Pane A2 incident list remains functional.
4. CMS and Training navigation items (if accessible from Zone A shortcut affordances) are visually disabled with a tooltip "Unavailable during Emergency Freeze." They do not navigate.
5. Handoff and elevation request in Pane A4 are disabled.
6. The EMERGENCY_FREEZE visual treatment on Zone A cannot be dismissed or suppressed by any operator action.

---

## 3. Zone B — Primary Workspace (fluid center)

Zone B renders the VenueOperationsDashboard for the active venue. Minimum width: 640px. Fluid — fills the space between Zone A (280px) and Zone C (320px or 48px collapsed).

The workspace comprises five ordered sections plus the System Status Bar (top) and Audit Trace Footer (bottom). Sections 1 through 5 appear in fixed vertical order and cannot be user-reordered.

### 3.1 System Status Bar (48px top, fixed)

The System Status Bar is part of the ApplicationShell. It renders identically across all workspaces. It sits at z-index 1000 (above all workspace and panel content).

**Contents (left to right):**

1. **Constitutional State Indicator** (ConstitutionalStateIndicator, full badge variant)
   - Label: the constitutional state name in full (e.g., "HEALTHY", "CONSTITUTIONAL RISK", "EMERGENCY FREEZE")
   - Color: green (HEALTHY), amber (DEGRADED), orange (CONSTITUTIONAL_RISK, SHADOW_ONLY, PRE_DISABLED, READ_ONLY), red (EMERGENCY_FREEZE)
   - Confidence dot: rendered adjacent to the state badge. Green dot = HIGH, amber dot = MEDIUM, grey dot = LOW or NONE
   - Update frequency: pushed via WebSocket; maximum staleness 5 seconds
   - Staleness behavior: if `ConstitutionalState.freshness === "STALE"`, the confidence dot turns amber regardless of the computed confidence value. If `freshness === "EXPIRED"`, the text "State data expired" appears in red adjacent to the badge.
   - Absent state: if `ConstitutionalState` is missing from the server response, the badge renders "UNKNOWN" in grey with confidence NONE and the text "Constitutional state unavailable."

2. **Active Mode Indicator**
   - Displays one of: "LIVE", "REPLAY", "INCIDENT ACTIVE"
   - On this surface (Live Operations), the indicator reads "LIVE" during normal operation
   - "INCIDENT ACTIVE" appears when a declared incident exists for the currently-viewed venue
   - Update frequency: derived from WebSocket data; same cycle as constitutional state

3. **Session Clock** (labeled "Wall:")
   - Displays current wall clock time in the venue's local timezone
   - Format: HH:MM:SS TIMEZONE (e.g., "14:33:07 AEST")
   - Updates every second using the governed clock, not `Date.now()`
   - Label "Wall:" distinguishes this from the governed server time

4. **Operator Identity Badge**
   - Displays: operator display name + role abbreviation (e.g., "Jordan H. · OPR")
   - Non-interactive; clicking does nothing. Session actions are in Pane A4.

5. **Elevate Session Button**
   - Label: "Elevate Session" when no elevation is active
   - Label: "14m elevated" (countdown) when `elevation_active: true`
   - When elevation is active: button style is amber with a countdown derived from `elevation_expires_at` (governed timestamp)
   - Clicking opens the elevation request modal when not elevated; clicking when elevated shows session details
   - Absent for VIEWER role

6. **Notification Badge** (NotificationBadge)
   - Bell icon with unread count
   - Clicking opens the notification tray in Zone A (Pane A3 overlay)
   - If count is 0, the bell renders without a count badge

**System Status Bar during EMERGENCY_FREEZE:** The entire Status Bar receives a red background. The Constitutional State Indicator shows "EMERGENCY FREEZE" in white text on red. The Session Clock and Operator Identity Badge remain visible. The Active Mode Indicator shows "EMERGENCY FREEZE" instead of "LIVE." The Elevate Session Button is disabled (visible but non-interactive) with tooltip "Session elevation unavailable during Emergency Freeze."

### 3.2 Section 1 — Venue Identity Header (non-collapsible)

Section 1 is non-collapsible. No collapse toggle is rendered in the DOM. Section ordering is fixed: Section 1 always appears first.

**Height:** Variable. Minimum 64px when no Emergency Content Banner is present. Expands to accommodate the Emergency Content Banner when shown.

**Contents:**

**VenueNameBadge:**
- Displays: venue name (large, bold, 24px), venue location beneath it (14px grey, e.g., "Brisbane, QLD")
- Below the venue name: venue ID in monospace, small, grey (e.g., `venue-brisbane-001`) — intended for support and operations reference, not operational decision-making

**PlayerStateBadge:**
- Position: right side of the venue identity row, vertically centered
- Displays the player machine state as a colored badge:

| Machine State | Badge Label | Badge Color |
|--------------|-------------|-------------|
| INITIALIZING | "Initializing" | Grey |
| SYNCING | "Syncing" | Blue |
| LIVE | "Live" | Green |
| INCIDENT | "Incident" | Red |
| OFFLINE | "Offline" | Dark red |
| DEGRADED | "Degraded" | Amber |
| RECOVERED_BUT_UNTRUSTED | "Reconnected — Unverified" | Amber-orange (distinct from DEGRADED) |

- The badge also shows the trust level treatment per TM-01 and TM-02 (see Section 5.3 and Section 5.4 for full state variations)

**EmergencyContentBanner:**
- Renders when: the active override stack contains at least one L6 override
- Position: full-width bar directly below the VenueNameBadge and PlayerStateBadge row, within Section 1
- Visual treatment: red background, white text, 48px height, no close/dismiss affordance
- Content: "EMERGENCY CONTENT ACTIVE — [content_ref of the L6 override] · Placed by [placed_by] · [age, e.g., "3m ago"]"
- Non-suppressible: this banner cannot be hidden by any operator action, any constitutional state, or any other condition. It renders as long as any L6 override is in the override stack.
- If multiple L6 overrides are stacked (unusual but possible): the banner shows "EMERGENCY CONTENT ACTIVE — [count] emergency overrides active" and a "View details" link that expands a sub-list of the L6 overrides within the banner itself
- The EmergencyContentBanner is part of Section 1. Because Section 1 is non-collapsible, the EmergencyContentBanner can never be scrolled out of view or dismissed.

### 3.3 Section 2 — Player Health (collapsible, default: expanded)

**Section header:** "Player Health" with a collapse toggle (chevron icon, right-aligned). Default state: expanded.

When collapsed: only the SectionHeader is visible. No health data is shown. The collapse state is local to the session (not persisted across page reloads or sessions).

**Contents when expanded:**

**Heartbeat Status row:**
- Label: "Last Heartbeat"
- Value: relative time since last heartbeat (e.g., "12 seconds ago")
- Raw governed timestamp available on hover/focus: e.g., "2026-06-02T14:33:07Z AEST"
- Freshness indicator:
  - CURRENT (≤30s): green dot, no additional text
  - STALE (31s–120s): amber dot, "(stale)" adjacent to the relative time
  - EXPIRED (>120s): red dot, "(expired — last contact [X]m ago)"
- Trust treatment: if `player_state._trust !== "TRUSTED"`, the standard trust indicator appears inline (amber for DEGRADED_TRUST, red + warning text for UNTRUSTED, grey + "Trust unknown" for UNKNOWN)

**Corpus Hash Status row:**
- Label: "Corpus Hash"
- Value: short hash display (first 8 characters of `corpus_status.corpus_hash`, monospace)
- Match indicator:
  - `hash_verified: true` and `hash_match: true`: green text "Verified ✓"
  - `hash_verified: true` and `hash_match: false`: red text "MISMATCH — hash does not match expected"
  - `hash_verified: false`: amber text "Hash not verified"
  - `corpus_status` absent: amber text "Corpus status: UNKNOWN — not verified"
- Last sync time: "Last sync: [relative time]" in small grey text beneath the hash display
- Corpus hash status is never rendered as "OK" or "VERIFIED" unless `hash_verified: true` AND `hash_match: true`

**Clock Sync Status row:**
- Label: "Clock Sync"
- Value: delta between governed clock and wall clock, e.g., "+0.3s" or "−1.2s"
- Alarm threshold: delta > ±5s renders the value in amber; delta > ±30s renders in red with text "Clock drift detected"
- If governed clock is unavailable: "Governed clock unavailable" in amber

**Connectivity Status row:**
- Label: "Connection"
- Value: connection type (e.g., "Ethernet", "WiFi", "Cellular") and signal quality (e.g., "Strong", "Weak", "Poor")
- Last seen: "Last seen: [relative time]" in small grey text
- If player is OFFLINE: entire row renders in red with "No connection — player offline"

### 3.4 Section 3 — Content and PRE Status (collapsible, default: expanded)

**Section header:** "Content & PRE Resolution" with a collapse toggle. Default state: expanded.

This section answers: "What is this screen showing right now, and why?"

**Contents when expanded:**

**PRE Effective Content row:**
- Label: "Now Playing"
- Value: content name or reference (e.g., "Campaign: Summer Promo 2026" or "Fallback: Default Loop")
- If content is a campaign: shows campaign name + campaign ID in smaller monospace text beneath
- If content is a fallback (L0): shows "Fallback Content — L0" with a grey "No scheduling active" note
- Update frequency: WebSocket push, maximum staleness 15 seconds. If data is STALE: "(content data stale — [age ago])" appears in amber beneath the content name.

**PRE Resolution Level row:**
- Label: "Resolution Level"
- Value: level badge showing "L0" through "L6" with a short label:

| Level | Badge | Short Label |
|-------|-------|-------------|
| L0 | Grey "L0" | "Fallback" |
| L1 | Blue "L1" | "Scheduled" |
| L2 | Blue "L2" | "Campaign" |
| L3 | Amber "L3" | "Venue Override" |
| L4 | Orange "L4" | "Operator Override" |
| L5 | Red "L5" | "Admin Override" |
| L6 | Dark red "L6" | "Emergency" |

- The resolution level badge is always visible. It does not collapse or hide when content is playing normally.

**PREExplainability (inline expandable):**
- Default state: collapsed to a single line: "Why this content? [expand ▾]"
- Expanded state: shows the full PRE resolution path — all 7 levels evaluated, each showing:
  - Level badge (L0–L6)
  - "Evaluated" or "Skipped" status
  - "Won" indicator if this level won the resolution
  - `reason` text if present (e.g., "L3 skipped — no active venue override")
- PREExplainability receives `pre_resolution` as a prop from the parent workspace. It does not fetch its own data.
- In REPLAY mode: shows the resolution path at the current replay timestamp, not the live state. (This surface is live-only, so REPLAY mode is not expected here; this note is for completeness.)

**Override Stack Summary row:**
- Label: "Active Overrides"
- Value: count of active overrides (e.g., "3 active") + highest level present (e.g., "Highest: L4")
- If count is 0: "No active overrides" in muted grey
- If count ≥ 3: amber text "3 active — override accumulation warning" (the override accumulation threshold is 3)
- "View details" link at the end of the row opens Section 4 (Active Overrides) if collapsed, or scrolls to it if already expanded

### 3.5 Section 4 — Intervention Surface (collapsible, default: expanded)

**Section header:** "Active Overrides & Interventions" with a collapse toggle. Default state: expanded.

**Mutually exclusive rendering rule:** When a recovery workflow is active for this venue (`recovery_workflow_state` is present in the API response), the RecoveryWorkflow component is rendered and the PlaceOverrideButton and DeclareIncidentButton are unmounted (not hidden, not disabled — absent from the DOM). When no recovery workflow is active, RecoveryWorkflow is unmounted and the standard controls are rendered.

**Standard controls (no active recovery workflow):**

**Active Overrides List:**

Each override entry shows (in order):
- Level badge: "L1" through "L6" (color per table in Section 3.4)
- Override label: content name or ref (e.g., "Summer Promo — L3 override")
- Status: "PENDING", "APPROVED", "REJECTED", or "EXPIRED" — approval_status value
- Placed by: operator name (e.g., "Jordan H.")
- Placed at: relative time (e.g., "2h ago") with governed timestamp on hover
- Expires at: relative countdown (e.g., "Expires in 4h 22m") or "No expiry set" in amber if no expiry is defined
- For L6 overrides: a red "EMERGENCY" tag is added to the entry

**Sort order for overrides:** By level descending (L6 first), then by `placed_at` descending within the same level.

**Empty state:** "No active overrides" in muted grey with a small note "Screens are running scheduled content."

**Warning accumulation indicator:** Appears above the override list (inside Section 4, not replacing the list) when `accumulation_warnings` is present and `active_count ≥ 3`. The warning reads: "Override accumulation — [count] overrides active. Review and clear unnecessary overrides." Rendered in amber. This indicator is not dismissible.

**L1–L6 visual differentiation:**
- L1 (Scheduled): thin grey left border on the list entry
- L2 (Campaign): thin blue left border
- L3 (Venue Override): thin amber left border
- L4 (Operator Override): thick orange left border, slightly elevated background
- L5 (Admin Override): thick red left border, noticeably elevated background
- L6 (Emergency): full red background on the entry row, bold white text, red "EMERGENCY" tag

**Actions on individual override entries (role-gated):**
- "Clear Override" button on each entry: OPERATOR for L1–L4; ADMIN for L5; L6 requires ADMIN + elevated session
- For VIEWER: no action buttons rendered; override list is read-only
- During EMERGENCY_FREEZE: "Clear Override" buttons for L1–L5 are disabled (visible, not absent) with tooltip "Override modification unavailable during Emergency Freeze." L6 emergency override controls remain accessible to ADMIN with elevated session — clearing an L6 emergency during EMERGENCY_FREEZE is a permitted action (it is the mechanism for resolving the freeze).

**Place Override Button:**
- Label: "Place Override +"
- Position: below the override list
- Role: absent for VIEWER; present for OPERATOR and ADMIN
- Clicking opens the override placement flow (modal overlay with scope, level, content, and expiry fields)
- For L4–L6 override placement: the placement modal does not show a submit button until a PREPreview has been loaded and displayed. The submit button is absent from the DOM until the preview loads.
- During EMERGENCY_FREEZE: disabled for L1–L5 with tooltip "Override placement unavailable during Emergency Freeze." L6 placement remains available to ADMIN with elevated session.

**Declare Incident Button:**
- Label: "Declare Incident"
- Position: below the Place Override button
- Role: absent for VIEWER; present for OPERATOR and ADMIN
- Clicking opens the incident declaration form (modal overlay with severity, scope, and description fields)
- S1 severity declaration requires elevated session; the severity selector disables S1 if `elevation_active: false`, with an inline note "S1 requires elevated session."
- During EMERGENCY_FREEZE: disabled for all operators below ADMIN; ADMIN may declare new incidents.

**Recovery Workflow (replaces standard controls when active):**

When `recovery_workflow_state` is present:
- The section renders a progress stepper showing steps 1–5 with current step highlighted
- Current step has an "Execute" or "Confirm" button depending on step type
- Completed steps show a checkmark and the operator who completed them with governed timestamp
- "Recovery initiated by [operator name] at [governed timestamp]" appears at the top of the section
- Standard controls (Place Override, Declare Incident) are absent from the DOM for the duration of the workflow

### 3.6 Section 5 — Timeline (collapsible, default: collapsed)

**Section header:** "Recent Events" with a collapse toggle. Default state: collapsed (reduced DOM footprint when not needed).

**Contents when expanded:**

A chronological list of recent venue events, ordered by `governed_timestamp` descending (newest first). Each event entry shows:
- Event type icon (small icon indicating: PRE resolution change, state transition, override placed, override cleared, incident declared, heartbeat anomaly, corpus sync, operator action)
- Event description (e.g., "Override placed — L3 — Jordan H.", "PRE resolution changed to L2 from L0", "Player transitioned to DEGRADED")
- Governed timestamp (relative time, e.g., "3m ago"; absolute timestamp on hover)

Maximum displayed: 50 entries in the timeline. A "View full timeline in Replay →" link at the bottom navigates to `/venues/:venue_id/replay`.

The timeline data source is `recent_pre_history` (last 10 PREResolution objects) supplemented by the WebSocket event stream for recent transitions. This section is informational; it has no interactive controls beyond the "View full timeline" navigation link.

---

## 4. Zone C — Right Panel (320px collapsible)

Zone C is 320px wide. It collapses to a 48px icon rail via click on the collapse chevron (on the left edge of Zone C). When collapsed, each pane is represented by an icon; clicking an icon expands Zone C and activates that pane's content.

Zone C contains four panes with fixed labels:

```
ZoneCPanel (320px or 48px collapsed)
├── C1 — Operational Context
├── C2 — System Health Indicators
├── C3 — Activity Feed
└── C4 — Constitutional Advisory
```

### 4.1 Default Content on First Load

On first load of the VenueOperationsDashboard, Zone C is expanded (320px) with C1 (Operational Context) active. The active pane is selected by highlighting the pane tab at the top of Zone C.

**Tabs at the top of Zone C (in order):**
- "Context" (C1)
- "Health" (C2)
- "Activity" (C3)
- "Advisory" (C4)

### 4.2 C1 — Operational Context

**Purpose:** Shows the immediate operational context for the currently-viewed venue.

**Contents:**

**Current Time at Venue:**
- Label: "Venue Time"
- Value: current time in the venue's local timezone (HH:MM:SS TIMEZONE), updated every second
- Updates using governed clock

**Next Scheduled Transition:**
- Label: "Next Transition"
- Value: content name + time until transition (e.g., "Campaign: Evening Sports → in 2h 14m AEST")
- If no transition scheduled in the next 24 hours: "No transitions scheduled (next 24h)"
- Update frequency: updated on PRE resolution changes

**Upcoming Transitions List:**
- Label: "Upcoming (next 2h)"
- Up to 5 upcoming content transitions, each showing:
  - Scheduled time (HH:MM TIMEZONE)
  - Content that will become active
  - PRE level at which it will win
- If 0 transitions in 2 hours: muted grey text "No changes scheduled in the next 2 hours"

**Autonomy Status:**
- Label: "Offline Autonomy"
- Value:
  - If `autonomy_status.online: true`: "Online — autonomy standby"
  - If `autonomy_status.online: false` and `autonomy_remaining_hours` is not null: "Offline — [X]h [Y]m autonomy remaining" in amber
  - If offline and `autonomy_remaining_hours` is null (offline < 1h): "Offline — [duration]. Autonomy window begins at 1h."
  - If offline and autonomy_remaining_hours approaches 0 (< 1h): displayed in red with "Autonomy expiring — venue will serve fallback content."
- Basis note: small grey text "Sustaining on corpus version: [autonomy_basis]"

### 4.3 C2 — System Health Indicators

**Purpose:** Compact overview of all health signals for the current venue.

**Contents:**

A vertical list of health indicator rows. Each row has:
- Signal name (left)
- Status indicator (right): colored dot + short status text

Health signals shown (in order):
1. Player State: machine state badge (mirrors Section 1 PlayerStateBadge)
2. Constitutional State: current state + confidence (compact ConstitutionalStateIndicator variant)
3. Heartbeat: CURRENT / STALE / EXPIRED with last received time
4. Corpus Hash: VERIFIED / MISMATCH / NOT VERIFIED / UNKNOWN
5. Clock Sync: delta value; green if within ±5s, amber if ±5s–±30s, red if >±30s
6. Connection: connection type + quality
7. PRE Level: current level badge (L0–L6)
8. Override Count: count + accumulation warning if ≥ 3
9. Active Incidents: count; if 0, "None" in muted grey; if `active_incidents` is absent, "Status unavailable" in amber

**Trust display:** Each row respects trust metadata. If a row's underlying data has `_trust !== "TRUSTED"`, the trust indicator (amber, red, or grey depending on trust level) appears adjacent to the status value.

**RECOVERED_BUT_UNTRUSTED:** When the player machine state is RECOVERED_BUT_UNTRUSTED, the Player State row renders "Reconnected — Unverified" in amber-orange. The Corpus Hash row renders "Hash pending verification" in amber. The Constitutional State row shows DEGRADED (or the current state with LOW or NONE confidence) in amber.

### 4.4 C3 — Activity Feed

**Purpose:** Real-time stream of operator actions and system events for this venue.

**Contents:**

A scrollable list of recent activity entries, ordered newest first. Each entry shows:
- Operator name (or "System" for automated actions)
- Action description (e.g., "Placed L3 override — Summer Promo", "Cleared L4 override", "Declared S3 incident", "Corpus sync completed")
- Governed timestamp (relative, e.g., "2m ago"; absolute on hover)
- A small type icon (user icon for operator actions, gear icon for system actions)

Maximum displayed: 100 entries. Activity beyond 100 entries is accessible via the venue timeline in Section 5 or via Replay.

Update mechanism: WebSocket push. Activity entries appear in real-time without requiring page interaction.

**No activity state:** If no activity has occurred in the last hour: "No recent activity" in muted grey. If activity data is unavailable: "Activity feed unavailable" in amber (not the no-activity message).

### 4.5 C4 — Constitutional Advisory

**Purpose:** Explanation of the current constitutional state and its implications for operators.

**Contents:**

**ConstitutionalAdvisory** component receives constitutional state from ApplicationShell context (same data as SystemStatusBar — not independent).

For each constitutional state, the Advisory shows specific text:

- **HEALTHY:** "System operating normally. All resolution paths functional. No restrictions active." (Muted; minimal visual weight)
- **DEGRADED:** "System is degraded. Some resolution paths may be impaired. Monitor for escalation. [basis signals listed]"
- **CONSTITUTIONAL_RISK:** "Constitutional risk detected. Automatic interventions may be triggered. Operator action may be required. [basis signals listed]"
- **SHADOW_ONLY:** "Shadow mode active. System is running in shadow execution. Production output is not driven by live resolution. Contact administrator."
- **PRE_DISABLED:** "PRE resolution engine is disabled. Fallback content is active on all screens. No override or campaign resolution is occurring. Contact administrator immediately."
- **READ_ONLY:** "System is in read-only mode. Configuration changes are not permitted. Monitoring continues normally."
- **EMERGENCY_FREEZE:** "Emergency Freeze is active. All content changes are halted. Only emergency content management actions are permitted. Do not attempt to place overrides or modify schedules until the freeze is lifted."

The advisory text is not an alert — it is informational guidance for the operator. It has no dismiss control.

**During EMERGENCY_FREEZE:** The C4 advisory content is highlighted with a red border and the text is displayed in bold. The Zone C panel background turns to a light red tint for the duration of EMERGENCY_FREEZE.

### 4.6 Zone C During EMERGENCY_FREEZE

- Zone C remains expanded (cannot be collapsed during EMERGENCY_FREEZE)
- C4 (Constitutional Advisory) is automatically activated as the visible pane
- The operator may switch to C1, C2, or C3 while EMERGENCY_FREEZE is active (Zone C is not locked to C4)
- All write affordances within Zone C are absent — Zone C contains no write controls, so no specific restriction applies beyond the system-wide freeze
- The Zone C panel receives a subtle red tint background

---

## 5. State Variations

### 5.1 HEALTHY State Rendering

Constitutional state: HEALTHY, confidence: HIGH

**Zone A:** Standard rendering. No alarm borders. State dots for venues reflect their individual player machine states; most will be green (LIVE).

**System Status Bar:** Green constitutional state badge "HEALTHY ●" (green confidence dot). Active Mode Indicator: "LIVE".

**Section 1:** VenueNameBadge + PlayerStateBadge showing green "Live". No EmergencyContentBanner (no L6 override). Section 1 occupies minimum height.

**Section 2:** Heartbeat CURRENT (green dot), corpus hash VERIFIED (green), clock sync within tolerance (no alarm), connection strong.

**Section 3:** PRE resolution at L1 or L2 (scheduled or campaign content playing). Override stack summary: "No active overrides." PREExplainability collapsed.

**Section 4:** Active overrides list: empty state — "No active overrides." Place Override Button visible (OPERATOR/ADMIN). Declare Incident Button visible.

**Section 5:** Collapsed by default. No action needed.

**Zone C:** C1 active. Autonomy status: "Online — autonomy standby." Next transition shows upcoming scheduled change.

### 5.2 DEGRADED State Rendering

Constitutional state: DEGRADED, confidence: MEDIUM or LOW

**Zone A:** Amber left border (2px). Venue state dots may show individual venue degradation (amber dots).

**System Status Bar:** Amber constitutional state badge "DEGRADED ●" (amber or grey confidence dot). Active Mode Indicator: "LIVE" unless an incident is also active.

**Section 1:** PlayerStateBadge may show "Degraded" (amber badge). No EmergencyContentBanner unless an L6 override is also active.

**Section 2:** One or more rows showing degraded status (e.g., heartbeat STALE, connection Weak). The degraded row renders its status in amber.

**Section 3:** PRE resolution may be at a degraded level. If `pre_resolution` data is STALE: "(content data stale — [age ago])" in amber beneath the content name.

**Section 4:** Standard controls render. Place Override Button and Declare Incident Button are available (role-permitting).

**Zone C C2:** Constitutional State row shows "DEGRADED" with appropriate confidence. The basis signals contributing to DEGRADED are listed.

**Zone C C4:** Advisory text: "System is degraded. Some resolution paths may be impaired. Monitor for escalation. [basis signals]"

### 5.3 CONSTITUTIONAL_RISK Rendering

Constitutional state: CONSTITUTIONAL_RISK

**Zone A:** Orange left border (4px). If this state is present, the operator should understand it as a pre-emergency signal.

**System Status Bar:** Orange constitutional state badge "CONSTITUTIONAL RISK". Active Mode Indicator: "LIVE" or "INCIDENT ACTIVE" depending on context.

**System Status Bar interrupt:** An InterruptDisplay component mounts at z-index 750 (Level 2 interrupt layer) with the text: "Constitutional risk — system may trigger automatic interventions. Review advisory." The interrupt renders below the System Status Bar and above Zone B. It has an "Acknowledge" button for OPERATOR and ADMIN; clicking acknowledge dismisses the interrupt for the current session but does not change the constitutional state.

**Section 1–5:** Render normally. No specific content changes for CONSTITUTIONAL_RISK alone. The operator should investigate via Zone C C4 advisory and C2 health indicators.

**Zone C C4:** Advisory text is the CONSTITUTIONAL_RISK text above. Advisory is displayed with orange border.

### 5.4 EMERGENCY_FREEZE Rendering (Most Important)

Constitutional state: EMERGENCY_FREEZE

This is the most significant system state. Every restriction is documented here.

**System Status Bar:**
- Background: red (full bar)
- Constitutional State badge: "EMERGENCY FREEZE" in white text on red
- Confidence dot: not shown separately (the red background is the signal)
- Active Mode Indicator: "EMERGENCY FREEZE" (replaces "LIVE")
- Elevate Session Button: disabled (visible, non-interactive), tooltip "Session elevation unavailable during Emergency Freeze"

**InterruptDisplay (z-index 900 — Level 1 interrupt):**
A full-width banner below the System Status Bar:
- Background: red
- Text: "EMERGENCY FREEZE ACTIVE — All content changes are halted. Emergency content management is the only permitted write action."
- This banner is not dismissible during EMERGENCY_FREEZE. It disappears when the constitutional state transitions away from EMERGENCY_FREEZE.

**Zone A:**
- Red left border (4px, full height)
- Pane A1 (Venue Selector): functional and interactive
- Pane A2 (Incident List): functional and interactive
- CMS navigation shortcut (if present as a shortcut item in Zone A): visually disabled, tooltip "Unavailable during Emergency Freeze"
- Training navigation shortcut (if present): visually disabled, tooltip "Unavailable during Emergency Freeze"
- Pane A4: Handoff and elevation disabled

**Section 1 (Venue Identity Header):**
- EmergencyContentBanner: renders if an L6 override is in the stack (as always). No change in behavior.
- PlayerStateBadge: reflects actual player state
- Section 1 background: light red tint

**Section 2 (Player Health):**
- All rows render normally (read-only; Section 2 has no write controls)

**Section 3 (Content and PRE Status):**
- Renders normally (read-only)

**Section 4 (Intervention Surface):**
- Place Override Button for L1–L5: disabled (visible, not absent), tooltip "Override placement unavailable during Emergency Freeze"
- Place Override Button for L6: available to ADMIN with elevated session only. For OPERATOR: L6 button is absent (OPERATOR cannot place L6 regardless of freeze state). For ADMIN without elevation: L6 button is disabled with tooltip "L6 requires elevated session."
- Declare Incident Button: disabled for OPERATOR (visible, not absent), tooltip "Incident declaration restricted during Emergency Freeze." Available for ADMIN.
- Active override entries: "Clear Override" buttons for L1–L5 are disabled (visible), tooltip "Override modification unavailable during Emergency Freeze." L6 "Clear Override" is available to ADMIN with elevated session.
- **Rationale for disabled vs absent during EMERGENCY_FREEZE:** State-based restrictions (SYSTEM_STATE denial_reason) produce disabled controls per Rule AU-02. The operator must see the control and understand it is temporarily unavailable, not permanently inaccessible.
- RecoveryWorkflow (if active): continues to display and allows step completion. Recovery execution is permitted during EMERGENCY_FREEZE.

**Section 5 (Timeline):**
- Renders normally (read-only). "View full timeline in Replay →" link continues to function (Replay access is permitted).

**Zone C:**
- Zone C cannot be collapsed during EMERGENCY_FREEZE (collapse affordance is disabled)
- C4 (Constitutional Advisory) is automatically activated and shows the EMERGENCY_FREEZE advisory text in bold with red border
- Zone C background: light red tint
- All Zone C content is read-only (Zone C has no write controls)

**Navigation restrictions during EMERGENCY_FREEZE (see also ROUTE-AND-NAVIGATION §Emergency Navigation):**
- `/venues/:venue_id`: permitted (current surface — read-only)
- `/incidents/:incident_id`: permitted (read-only)
- `/venues/:venue_id/replay/:session_id`: permitted (REPLAY mode only)
- `/fleet`: permitted (read-only)
- `/cms/*`: navigation items are disabled in Zone A (if accessible as shortcuts), not absent. Clicking produces tooltip "Unavailable during Emergency Freeze." No navigation occurs.
- `/training/*`: same as CMS — disabled with tooltip.

### 5.5 OFFLINE Venue (Single Venue in Fleet Is Offline)

Applies when a specific venue's player is OFFLINE while the overall constitutional state is not EMERGENCY_FREEZE.

**Zone A Pane A1:**
- The offline venue's state dot shows dark red
- The venue row may show a "(Offline)" suffix label

**System Status Bar:** Constitutional state reflects fleet state, not individual venue state. If the offline venue is the one being viewed in Zone B, the Active Mode Indicator may show "INCIDENT ACTIVE" if an incident was declared for this venue.

**Section 1:**
- PlayerStateBadge: "Offline" (dark red badge)
- No EmergencyContentBanner unless an L6 override is stacked (possible if an operator placed emergency content before the venue went offline)

**Section 2:**
- Heartbeat Status: "EXPIRED — last contact [X]m ago" in red
- Connectivity Status: "No connection — player offline" in red
- Corpus Hash: shows last known hash state, with `_trust` treatment applied. If `_trust: UNKNOWN`, grey indicator "Trust unknown — last verified [age]"
- Clock Sync: "Governed clock unavailable" in amber

**Section 3:**
- PRE Effective Content: shows last known content. If `pre_resolution._freshness` is EXPIRED: "PRE data expired ([age])" with red border on the PRE section
- Override Stack: shows last known override stack state (may be stale)

**Section 4:**
- Place Override Button: disabled (visible) — tooltip "Override placement unavailable — player is offline"
- Declare Incident Button: available. Operators should be able to declare an incident for an offline venue.

**Zone C C1:**
- Autonomy Status: shows offline duration and remaining autonomy hours. If autonomy is expiring: red text "Autonomy expiring — venue will serve fallback content."

**Zone C C2:**
- Player State row: "Offline" (dark red)
- All health indicators showing EXPIRED data: rendered in red with ages

### 5.6 All Venues Offline

When all venues in the operator's assigned fleet are offline (or all venues if ADMIN):

**Zone A:**
- All venue state dots: dark red
- Pane A2 may show incidents if any were declared before or during the outage

**System Status Bar:** Constitutional state likely DEGRADED or CONSTITUTIONAL_RISK. The Active Mode Indicator shows "LIVE" (the platform itself is live; the venues are offline).

**Section 1 (whichever venue is being viewed):**
- PlayerStateBadge: "Offline"
- A system-level notice does not appear in Section 1 (Section 1 is venue-scoped)

**Fleet Overview (ADMIN/OPERATOR):** For all-venues-offline scenarios, the operator should navigate to `/fleet` for a fleet-wide view. No special surface change occurs on this page for fleet-wide outages — each venue is individually shown as offline.

**Zone C C4:** Advisory text may reflect CONSTITUTIONAL_RISK or DEGRADED constitutional state — it does not specifically call out "all venues offline" as a distinct advisory. This is an operational observation the operator makes from Pane A1 state dots.

---

## 6. Interactive Controls

### 6.1 All Controls on This Surface

The following tables enumerate every control on the Live Operations Surface. "Absent" means the control is not rendered in the DOM. "Disabled" means the control is rendered but non-interactive, with an explanatory tooltip.

**Section 1 — No interactive controls (read-only)**

**Section 2 — No interactive controls (read-only, collapsible header only)**

**Section 3 — Controls:**
| Control | Label | Action | VIEWER | OPERATOR | ADMIN | EMERGENCY_FREEZE |
|---------|-------|--------|--------|----------|-------|-----------------|
| PREExplainability expand | "Why this content? [expand]" | Expands inline PRE trace | Visible | Visible | Visible | Visible (read-only) |
| Section collapse toggle | Chevron icon | Collapse/expand Section 3 | Visible | Visible | Visible | Visible |

**Section 4 — Controls:**
| Control | Label | Action | VIEWER | OPERATOR | ADMIN | EMERGENCY_FREEZE |
|---------|-------|--------|--------|----------|-------|-----------------|
| Place Override | "Place Override +" | Opens override placement modal | Absent | Visible | Visible | Disabled (L1–L5); L6 available to ADMIN+elevated |
| Declare Incident | "Declare Incident" | Opens incident declaration modal | Absent | Visible | Visible | Disabled for OPERATOR; available for ADMIN |
| Clear Override (per entry, L1–L4) | "Clear" | Clears individual override | Absent | Visible | Visible | Disabled (visible) for all |
| Clear Override (L5) | "Clear" | Clears L5 override | Absent | Absent | Visible | Disabled (visible) |
| Clear Override (L6) | "Clear Emergency" | Clears L6 override | Absent | Absent | Visible (elevation required) | Available for ADMIN+elevated |
| Section collapse toggle | Chevron icon | Collapse/expand Section 4 | Visible | Visible | Visible | Visible |
| Recovery Workflow step Execute | "Execute Step" | Advances recovery workflow | Absent | Visible (if active) | Visible (if active) | Visible (recovery continues during freeze) |

**Section 5 — Controls:**
| Control | Label | Action | All Roles | EMERGENCY_FREEZE |
|---------|-------|--------|-----------|-----------------|
| View full timeline | "View full timeline in Replay →" | Navigates to `/venues/:venue_id/replay` | Visible | Visible |
| Section collapse toggle | Chevron | Collapse/expand Section 5 | Visible | Visible |

**Zone C — No write controls (informational panels only)**

**Confirmation requirements:**
- Place Override (L1–L3): checkbox confirmation ("I confirm this override is intentional")
- Place Override (L4): text entry confirmation — operator types the venue name
- Place Override (L5): text entry confirmation — operator types the content name
- Place Override (L6): text entry confirmation — operator types "EMERGENCY OVERRIDE" (exact string, case-sensitive) + elevated session required for ADMIN
- Clear Override (L5): checkbox confirmation
- Clear Override (L6): text entry confirmation — operator types "CLEAR EMERGENCY" (exact string, case-sensitive) + elevated session required for ADMIN
- Declare Incident: checkbox confirmation with severity preview

### 6.2 Controls Absent for VIEWER Role

The following controls are absent from the DOM (not rendered) when `session.role === "VIEWER"`:
- Place Override button
- Declare Incident button
- All "Clear Override" buttons on individual override entries
- Handoff Initiation button (Pane A4)
- Elevate Session button (System Status Bar and Pane A4)

VIEWER receives read-only views of all data. No "You don't have permission" messages appear inline — the controls are simply absent. Section headers include a note "VIEWER — read only" in small, muted grey text for Sections 4 only (the intervention section, where the absence of controls might otherwise be confusing).

---

## 7. Real-Time Update Behavior

### 7.1 What Updates Live (WebSocket-Driven)

All of the following update via WebSocket push without requiring page interaction:

| Data | Maximum latency | Stale threshold | Expired threshold |
|------|----------------|-----------------|-------------------|
| Constitutional state | 5 seconds | 5 seconds | 30 seconds |
| Player machine state (Pane A1 dots + Section 1 badge) | 10 seconds | 30 seconds | 120 seconds |
| PRE resolution (Section 3 content + level) | 15 seconds | 30 seconds | — |
| Override stack (Section 4 list) | 30 seconds | 60 seconds | — |
| Heartbeat status (Section 2) | 30 seconds | 30 seconds | 120 seconds |
| Active incidents (Pane A2 + Section 4) | 10 seconds | 30 seconds | — |
| Activity feed (Zone C C3) | Real-time push | — | — |
| Notification badge (System Status Bar) | Real-time push | — | — |

Zone A and Zone B subscribe to the same WebSocket connection (managed by ApplicationShell) but through independent channel subscriptions. Zone A subscribes to fleet-level state events. Zone B subscribes to `venue:{venue_id}` channel.

### 7.2 What Requires Page Interaction to Refresh

- Corpus hash verification result: must be explicitly requested via a "Verify hash" trigger (a governance action, not a display action). The hash display updates when the verification result is pushed via WebSocket after the request completes.
- Recovery workflow state: updates via WebSocket when a step completes; does not poll.
- Training certifications (Pane A4 session context): refreshed on session elevation request completion.

### 7.3 Staleness Indicators

**STALE (data between stale threshold and expired threshold):**
- Amber dot adjacent to the data element
- Text suffix: "(stale — [age])" appended to the relevant field value
- No alarm sound or interrupt-level notification for STALE data alone

**EXPIRED (data past expired threshold):**
- Red border on the containing row or section
- Explicit text: "[Field] data expired — last received [X]m ago"
- If constitutional state expires: the System Status Bar renders "UNKNOWN" state with "State data expired" in red

**WebSocket disconnection:**
- Occurs when the WebSocket connection is severed
- All real-time data immediately transitions to STALE
- After 5 seconds: constitutional state transitions to STALE
- After 30 seconds: constitutional state transitions to EXPIRED
- System Status Bar displays: "Connection lost — data may be outdated" in amber
- Reconnection: exponential backoff (1s initial, 30s max). On reconnection: full data refresh before resuming push updates. Stale/expired indicators clear once fresh data arrives.

---

## 8. Navigation Triggers from This Surface

### 8.1 Every Navigation Action Available

| Trigger | Destination | URL | History entry |
|---------|-------------|-----|---------------|
| Click venue in Pane A1 | Same surface, different venue | `/venues/:venue_id` | Push |
| Click incident in Pane A2 | Incident Commander Surface | `/incidents/:incident_id` | Push |
| Click notification link in Pane A3 | Route embedded in notification | Varies | Push |
| Click "View full timeline in Replay →" (Section 5) | Replay and Forensics Workspace | `/venues/:venue_id/replay` | Push |
| Click "Declare Incident" and complete form | Incident Commander Surface | `/venues/:venue_id/incident/:incident_id` | Push (automatic after declaration) |
| Incident reaches S1/S2 while on this surface | Incident Commander Surface | `/venues/:venue_id/incident/:incident_id` | Push (automatic) |
| Click venue in Fleet Overview (navigated from `/fleet`) | This surface | `/venues/:venue_id` | Push |
| Click "Open in Replay" from Activity Feed entry | Replay and Forensics Workspace | `/venues/:venue_id/replay` | Push |

**IC Surface takeover:** When a new S1 or S2 incident is declared for the venue currently being viewed (either by this operator or by another operator — the event arrives via WebSocket), Zone B automatically navigates to the IC surface. The route changes to `/venues/:venue_id/incident/:incident_id` via a browser history push. The operator may navigate back to this surface using the browser back button. A banner appears in the IC surface: "You were viewing the Venue Dashboard — [Return to Venue Dashboard]" if the operator navigated to IC automatically.

### 8.2 Deep-Link Behavior

When `/venues/:venue_id` is opened directly (no prior application state):

1. Session validity check: if no session, redirect to `/login?return=%2Fvenues%2F{venue_id}`
2. Entity resolution: fetch venue record. If not found: redirect to `/fleet` with notice "Venue not found."
3. Authority check: if VIEWER is not assigned to this venue: redirect to `/unauthorized` with message "You are not assigned to this venue."
4. Rendering: workspace renders a loading skeleton immediately. Data subscriptions are established in parallel. Sections render as their data arrives (Section 1 loads first; Section 5 may load last).

**Shared URLs:** Any URL in the form `/venues/:venue_id` is stable for the lifetime of the venue record. Sharing this URL always opens the current live state of the venue, not a historical state. For historical state sharing, use a replay session URL.

**State restored on deep-link:** The workspace always opens with Zone C expanded, C1 pane active, and all collapsible sections at their default states (Sections 2, 3, 4 expanded; Section 5 collapsed). Collapsed/expanded preferences are session-local and do not survive page reload.

---

## 9. Audit Events Emitted

Every user action that mutates state or initiates an action emits a structured audit event. Audit events use the format `{domain}:{entity}:{action}`.

| User Action | Audit Event | Emitting Condition |
|-------------|-------------|-------------------|
| Place Override (any level) | `override:entry:placed` | On server confirmation of placement |
| Clear Override | `override:entry:cleared` | On server confirmation of clearance |
| Declare Incident | `incident:declaration:created` | On server confirmation of declaration |
| Advance Recovery Workflow step | `recovery:workflow:step_completed` | On server confirmation of step |
| Request elevated session | `session:elevation:requested` | On submission of elevation request |
| Elevation request approved | `session:elevation:granted` | On session refresh confirming elevation |
| Initiate handoff | `operator:handoff:initiated` | On submission of handoff form |
| Handoff accepted | `operator:handoff:accepted` | On accepting operator's confirmation |
| PREExplainability expanded | `ui:pre_trace:expanded` | On operator expanding the explainability section |
| Timeline "View in Replay" clicked | `ui:replay:opened` | On navigation to replay workspace |
| Section collapsed | `ui:section:collapsed` | On toggle — includes section_id in payload |
| Section expanded | `ui:section:expanded` | On toggle — includes section_id in payload |

**AuditTraceFooter (28px bottom, fixed):**
The footer always shows the most recent audit event for the current session:
- "Last action: [audit_event_label] at [governed_timestamp]"
- A link "Open in Replay →" opens the Replay Workspace anchored to the most recent event
- The footer renders for all roles including VIEWER (read events like expand/collapse are audit-logged)
- The footer is part of ApplicationShell at z-index 1000 and cannot be occluded by workspace content

**Events not emitted:**
- Navigation between Pane A1 venues (navigation is tracked by the router, not as an audit event)
- Zone C pane tab switching (UI state, not operational action)
- Hover or tooltip interactions
- WebSocket subscription events (internal infrastructure, not operator actions)

---

## 10. Forbidden Patterns

### 10.1 What This Surface Must Never Do

**FP-01: Never render "No active incidents" when incident data is unavailable.**
If `active_incidents` is absent from the server response, the surface must render "Incident status unavailable" in amber. Rendering "No active incidents" when data is absent is an operational safety violation — operators may fail to investigate venues that are experiencing unreported incidents.

**FP-02: Never render constitutional state UNKNOWN as neutral.**
UNKNOWN constitutional state is not the same as HEALTHY. It must render with grey styling and explicit uncertainty text. A grey badge is not a "calm" state — it is an unresolved state.

**FP-03: Never render RECOVERED_BUT_UNTRUSTED as HEALTHY.**
When `player_state.machine_state` is RECOVERED_BUT_UNTRUSTED, the surface must not show green "Live" or any HEALTHY treatment. It renders as "Reconnected — Unverified" in amber-orange until corpus hash verification is confirmed.

**FP-04: Never suppress the EmergencyContentBanner.**
When an L6 override is in the override stack, the EmergencyContentBanner must render. No operator action, system state, or UI condition may prevent it from rendering. It cannot be dismissed, minimized, or hidden.

**FP-05: Never use `Date.now()` for governed timestamps.**
All time values displayed on this surface that originate from server-governed timestamps must be rendered from the governed value, not recomputed from the client clock.

**FP-06: Never render absent data as good news.**
If corpus hash status is absent: render "UNKNOWN — not verified." If player state is absent: render "Player state unknown." If override stack data is absent: render "Override stack status unavailable." The surface must not default to a healthy-looking empty state when the underlying data is missing.

**FP-07: Never make Zone A state contingent on Zone B.**
Zone A state dots, incident counts, and notification badges must update independently of what is displayed in Zone B. A venue state change for a venue not currently in Zone B must appear in Zone A without any Zone B interaction.

**FP-08: Never render write controls for VIEWER in the DOM.**
VIEWER-restricted controls (Place Override, Declare Incident, Clear Override, Handoff, Elevate Session) must be absent from the DOM, not disabled. Disabled controls imply a correctable condition. VIEWER controls are role-restricted, not state-restricted — they do not exist for VIEWERs.

**FP-09: Never allow PREExplainability to fetch data independently.**
PREExplainability receives `pre_resolution` as a prop. It may not issue API calls or WebSocket subscriptions. If the parent workspace has stale PRE data, PREExplainability reflects the same staleness (the parent's staleness indicator covers this).

**FP-10: Never render L4–L6 override submit button before PREPreview loads.**
The submit button for L4, L5, and L6 override placement is absent from the DOM until a PREPreview is loaded and displayed. A disabled submit button is not acceptable — the operator must see the preview before the submit affordance exists.

### 10.2 Cross-Coupling Prohibitions Specific to This Surface

**FC-01 applies:** The VenueOperationsDashboard must not directly subscribe to WebSocket events. It receives constitutional state and venue data via ApplicationShell context.

**FC-02 applies:** Zone A components must not import from the VenueOperationsDashboard module or render its children.

**FC-04 inverse applies:** VenueOperationsDashboard must not import from the ReplayForensicsWorkspace. Replay navigation is handled by route navigation, not component import.

**FC-03 applies:** The PlaceOverrideButton (OverrideControl action surface), DeclareIncidentButton (IncidentDeclaration action surface), and RecoveryWorkflow action surface must not import from each other.

**Live/Replay contamination:** This surface renders live data only. It must not render data marked `_replay: true`. If such data arrives via a WebSocket push, it must be discarded with an error logged to the observability sink: "VenueOperationsDashboard received replay-marked data — discarded."

---

*End of CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Layout and constitutional state changes require Agent 1 (Platform) coordination*
*Data contract changes require backend API team review*
*All write controls require integration testing against authority rules AU-01, AU-02, AU-03*
