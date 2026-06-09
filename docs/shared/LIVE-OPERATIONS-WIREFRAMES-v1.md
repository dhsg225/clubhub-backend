# LIVE-OPERATIONS-WIREFRAMES-v1

**Document type:** Implementation-grade wireframe specification
**Authority:** Agent 3 (UX/Design)
**Audience:** UX designers, frontend engineers, QA
**Depends on:** CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md, FRONTEND-COMPONENT-TAXONOMY-v1.md,
APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## Purpose and Scope

This document provides complete ASCII wireframe layouts for every significant role/state combination
of the Live Operations Surface. A UX designer must be able to recreate the interface from this
document alone, without consulting any other specification.

Each wireframe is a 1440px desktop viewport representation. The three-zone layout is fixed:
- Zone A (left nav): 280px fixed, never resizable
- Zone B (center workspace): fluid — typically 840px at 1440px total width with Zone C expanded
- Zone C (right panel): 320px expanded / 48px collapsed

ASCII conventions used throughout:
- `┌─┐└─┘│` for box borders
- `[LABEL]` for interactive buttons
- `{data}` for dynamic values
- `••••` for truncated text
- `↕` for collapsible section toggles
- `⬤` for status dots (green = healthy, amber = degraded, red = error/incident)
- `▲` for warning indicators
- `◆` for state diamonds
- `█` for selected / highlighted rows
- `░` for disabled / unavailable controls
- `~` for amber / warning styled text

---

## Zone Layout Reference (All Wireframes)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  SYSTEM STATUS BAR (48px, z-index 1000)                                                                                                        │
│  [Zone A: 280px]                [Zone B: ~840px fluid]                                         [Zone C: 320px]                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Zone A (280px)   │  Zone B — Primary Workspace (~840px)                                        │  Zone C (320px)                            │
│  Left Nav Panel   │  VenueOperationsDashboard                                                   │  Right Panel                               │
│                   │                                                                             │                                            │
│  [A1 Venues]      │  [S1 Venue Identity Header]                                                 │  [C1 Context]                              │
│  [A2 Incidents]   │  [S2 Player Health]          ↕                                             │  [C2 Health]                               │
│  [A3 Notifs]      │  [S3 Content & PRE]          ↕                                             │  [C3 Activity]                             │
│  [A4 Tools]       │  [S4 Interventions]          ↕                                             │  [C4 Advisory]                             │
│                   │  [S5 Timeline]               ↕ (default: collapsed)                        │                                            │
│                   │                                                                             │                                            │
│                   │  AUDIT TRACE FOOTER (28px, z-index 1000)                                   │                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## WF-LO-01: Live Operations — OPERATOR — Single Venue — HEALTHY State

**ID:** WF-LO-01
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** HEALTHY (constitutional_state.state = HEALTHY, confidence = HIGH)
**Purpose:** Default primary screen for an operator viewing a single venue with all systems nominal.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬤ HEALTHY ●  LIVE   Wall: 14:33:07 AEST   Jordan H. · OPR   [Elevate Session]   🔔 0                                                        │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD   ⬤ │  Brisbane CBD                                    ⬤ Live               │ C1 — OPERATIONAL CONTEXT                     │
│   Melbourne     ⬤ │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│   Sydney        ⬤ │                                                                        │ Venue Time                                   │
│   Perth         ⬤ │                                                                        │ 14:33:07 AEST                                │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│ ACTIVE INCIDENTS    │  Player Health                                               ↕ [─]   │ Next Transition                              │
│─────────────────────│  Last Heartbeat   ⬤  12 seconds ago                                  │ Campaign: Evening Sports                     │
│  No active          │  Corpus Hash      ⬤  a3f8b2c1  Verified ✓                           │ → in 2h 14m AEST                             │
│  incidents          │  Clock Sync       ⬤  +0.3s                                           │                                              │
│                     │  Connection       ⬤  Ethernet · Strong                               │ Upcoming (next 2h)                           │
│                     │                                                                        │  15:30  Campaign: Evening Sports  L2         │
│ 🔔                  │  ─────────────────────────────────────────────────────────────────── │  16:00  Scheduled: Night Loop     L1         │
│  0 notifications    │  Content & PRE Resolution                                   ↕ [─]   │  17:45  Campaign: Weekend Promo   L2         │
│                     │  Now Playing      Campaign: Summer Promo 2026                        │                                              │
│                     │                  camp-summer-2026-001                                │ Offline Autonomy                             │
│                     │  Resolution Level ■ L2  Campaign                                     │ Online — autonomy standby                    │
│  Jordan H. · OPR    │  Why this content?  [expand ▾]                                       │ Corpus: corpus-v4-2026-06-01                 │
│  OPERATOR           │  Active Overrides  No active overrides                               │                                              │
│  Session: 09:14 AEST│                                                                        │                                              │
│  Cert: L2           │  ─────────────────────────────────────────────────────────────────── │                                              │
│  [Start Handoff]    │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│  [Request Elevated] │                                                                        │                                              │
│  [Sign Out]         │    No active overrides                                                │                                              │
│                     │    Screens are running scheduled content.                             │                                              │
│                     │                                                                        │                                              │
│                     │    [Place Override +]                                                 │                                              │
│                     │    [Declare Incident]                                                 │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
│                     │  (collapsed)                                                           │                                              │
│                     │                                                                        │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: ui:section:expanded at 14:28:55 AEST  [Open in Replay →]                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed
- Zone B (center workspace): fluid (1440 - 280 - 320 = 840px typical)
- Zone C (right panel): 320px expanded / 48px collapsed

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- A1 VenueSelector: Label "VENUES" (uppercase grey). Brisbane CBD row is highlighted (full-width accent background) as the active venue. Each row: venue name (truncated at 220px) + right-aligned colored state dot. All dots green in HEALTHY state. No incident badges visible (0 active incidents).
- A2 IncidentList: Label "ACTIVE INCIDENTS" (uppercase grey). Renders muted grey text "No active incidents" — this is the confirmed empty state (positive confirmation from backend).
- A3 NotificationTrayAccess: Bell icon, no badge (0 unread). Clicking opens overlay tray anchored to Zone A.
- A4 OperatorToolsMenu: Operator name "Jordan H. · OPR" with role badge at bottom. Contains: [Start Handoff], [Request Elevated Session], session start time, certification level (L2), [Sign Out].

**System Status Bar (48px, z-index 1000)**

Left to right:
1. ConstitutionalStateIndicator: green badge "HEALTHY" + green confidence dot
2. Active Mode Indicator: "LIVE"
3. Session Clock: "Wall: 14:33:07 AEST" (governed clock, updates every second)
4. Operator Identity Badge: "Jordan H. · OPR" (non-interactive)
5. Elevate Session Button: "[Elevate Session]" (interactive, opens elevation modal)
6. Notification Badge: bell icon, no count badge

**Zone B — Primary Workspace**

- S1 Venue Identity Header (non-collapsible): VenueNameBadge — "Brisbane CBD" (24px bold), "Brisbane, QLD" (14px grey), "venue-brisbane-001" (monospace small grey). PlayerStateBadge — right-aligned green badge "Live". No EmergencyContentBanner (no L6 override active).
- S2 Player Health (expanded): Section header "Player Health" + collapse toggle. Rows: Last Heartbeat (green dot, "12 seconds ago"), Corpus Hash (green dot, "a3f8b2c1 Verified ✓"), Clock Sync (green, "+0.3s"), Connection (green, "Ethernet · Strong").
- S3 Content & PRE Resolution (expanded): "Now Playing" — "Campaign: Summer Promo 2026" + "camp-summer-2026-001". "Resolution Level" — blue L2 badge "Campaign". "Why this content? [expand ▾]" (PREExplainability, collapsed). "Active Overrides" — "No active overrides" (muted grey).
- S4 Active Overrides & Interventions (expanded): Empty state "No active overrides · Screens are running scheduled content." Then: [Place Override +] button, [Declare Incident] button.
- S5 Recent Events (collapsed): Section header only with [+] expand toggle.

**Zone C — Right Panel (320px)**

Tabs at top: "Context" (active, underlined) | "Health" | "Activity" | "Advisory" | [‹] collapse affordance.

C1 Operational Context (active pane): Venue Time (14:33:07 AEST), Next Transition ("Campaign: Evening Sports → in 2h 14m AEST"), Upcoming list (3 entries with time/content/level), Offline Autonomy ("Online — autonomy standby"), corpus basis.

**Audit Trace Footer (28px, z-index 1000)**

"Last action: ui:section:expanded at 14:28:55 AEST [Open in Replay →]"

### Component Placement

| Component | Zone / Section | Notes |
|-----------|---------------|-------|
| ApplicationShell | Shell | Mounts entire layout |
| SystemStatusBar | Shell top | z-index 1000, 48px |
| AuditTraceFooter | Shell bottom | z-index 1000, 28px |
| ZoneAPanel | Zone A (280px) | |
| VenueSelector (Pane A1) | Zone A top | |
| IncidentList (Pane A2) | Zone A middle | Empty state shown |
| NotificationTrayAccess (Pane A3) | Zone A | No badge |
| OperatorToolsMenu (Pane A4) | Zone A bottom | |
| ConstitutionalStateIndicator | SystemStatusBar | Green HEALTHY badge |
| VenueNameBadge | Zone B S1 | |
| PlayerStateBadge | Zone B S1 right | Green "Live" |
| EmergencyContentBanner | Zone B S1 | Absent (no L6 override) |
| HeartbeatStatusRow | Zone B S2 | Green CURRENT |
| CorpusHashStatusRow | Zone B S2 | Green Verified |
| ClockSyncRow | Zone B S2 | Green +0.3s |
| ConnectivityStatusRow | Zone B S2 | Green Ethernet/Strong |
| PREEffectiveContentRow | Zone B S3 | |
| PREResolutionLevelRow | Zone B S3 | L2 badge |
| PREExplainability | Zone B S3 | Collapsed |
| OverrideStackSummaryRow | Zone B S3 | 0 overrides |
| ActiveOverridesList | Zone B S4 | Empty state |
| PlaceOverrideButton | Zone B S4 | Visible (OPERATOR) |
| DeclareIncidentButton | Zone B S4 | Visible (OPERATOR) |
| TimelineSection | Zone B S5 | Collapsed (default) |
| ZoneCPanel | Zone C (320px) | C1 active |
| OperationalContext (C1) | Zone C | Active pane |

### Interaction Notes

- VenueSelector rows: clickable, navigate Zone B to `/venues/:venue_id`. Active row not clickable (already here).
- IncidentList rows: clickable, navigate to `/incidents/:incident_id`. Empty state — no click targets.
- NotificationTrayAccess bell: click opens overlay tray at z-index 700.
- [Start Handoff]: opens handoff modal overlay. No Zone B change.
- [Request Elevated Session]: opens elevation request modal overlay.
- [Sign Out]: terminates session, redirects to `/login`.
- [Elevate Session] (Status Bar): same as [Request Elevated Session].
- Section collapse toggles (S2, S3, S4): click chevron to collapse. State is session-local.
- Section S5 expand toggle [+]: click to expand timeline.
- "Why this content? [expand ▾]": click to expand PREExplainability inline accordion within S3.
- [Place Override +]: opens override placement modal overlay (L1–L6 fields, scope, content, expiry).
- [Declare Incident]: opens incident declaration modal overlay (severity, scope, description).
- Zone C tabs (Context/Health/Activity/Advisory): click to switch active pane. No route change.
- Zone C [‹] collapse: collapses Zone C to 48px icon rail.
- "View full timeline in Replay →" (S5 when expanded): navigates to `/venues/:venue_id/replay`.
- Hover on governed timestamps: reveals absolute ISO timestamp with timezone.

### Disabled-State Behavior

In HEALTHY state with OPERATOR role, no controls are disabled. All standard OPERATOR controls are available:
- [Place Override +]: active
- [Declare Incident]: active
- [Start Handoff]: active
- [Request Elevated Session]: active
- Section S5 collapse toggle in Zone C: Zone C collapse affordance is active

### Replay-State Behavior

This is the Live Operations Surface. The surface only renders data where `_replay: false`. If WebSocket push delivers data marked `_replay: true`, it is silently discarded and an error is logged to the observability sink. The Active Mode Indicator reads "LIVE" at all times on this surface during normal operation. No replay scrubber, replay session controls, or historical navigation affordances are present on this surface.

### Degraded-State Behavior

Not applicable in this wireframe (HEALTHY state). See WF-LO-04 for degraded rendering.

### Incident-State Behavior

Not applicable in this wireframe (no incident). See WF-LO-02 for incident rendering. If an S1 or S2 incident is declared while viewing this surface, Zone B automatically navigates to `/venues/:venue_id/incident/:incident_id` via history push.

### Accessibility Notes

- Focus order: SystemStatusBar → Zone A (A1 → A2 → A3 → A4) → Zone B (S1 → S2 → S3 → S4 → S5) → Zone C tabs → Zone C content → AuditTraceFooter.
- VenueSelector rows: ARIA role="listitem", aria-current="page" on active venue.
- SystemStatusBar: ARIA role="banner". ConstitutionalStateIndicator has aria-live="polite" for state changes.
- Section collapse toggles: ARIA role="button", aria-expanded="true|false", aria-controls="{section-id}".
- PlayerStateBadge: aria-label="Player state: Live".
- [Place Override +] and [Declare Incident]: ARIA role="button", descriptive aria-label.
- PREExplainability expand: ARIA role="button", aria-expanded="false", aria-controls="pre-trace-detail".
- Zone C tabs: ARIA role="tablist" with individual role="tab" and aria-selected.
- All governed timestamps: title attribute with absolute ISO value for tooltip accessibility.
- Keyboard: all interactive elements reachable via Tab. Section collapses reachable via Enter/Space. Escape closes modal overlays and notification tray.

---

## WF-LO-02: Live Operations — OPERATOR — Single Venue — INCIDENT ACTIVE (S3)

**ID:** WF-LO-02
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** Incident declared at severity S3, constitutional_state = HEALTHY or DEGRADED, player state = INCIDENT
**Purpose:** Shows the operator the venue dashboard when an S3 incident is active — intervention controls remain accessible and the incident is surfaced in Zone A and the identity header.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬤ HEALTHY ●  INCIDENT ACTIVE   Wall: 15:04:22 AEST   Jordan H. · OPR   [Elevate Session]   🔔 2                                              │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD ⬤ ❶│  Brisbane CBD                                    ⬤ Incident           │ C1 — OPERATIONAL CONTEXT                     │
│   Melbourne     ⬤ │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│   Sydney        ⬤ │                                                                        │ Venue Time                                   │
│   Perth         ⬤ │  ─────────────────────────────────────────────────────────────────── │ 15:04:22 AEST                                │
│                     │  Player Health                                               ↕ [─]   │                                              │
│ ACTIVE INCIDENTS    │  Last Heartbeat   ⬤  8 seconds ago                                   │ Next Transition                              │
│─────────────────────│  Corpus Hash      ⬤  a3f8b2c1  Verified ✓                           │ Campaign: Evening Sports                     │
│  S3 Brisbane CBD    │  Clock Sync       ⬤  +0.5s                                           │ → in 1h 25m AEST                             │
│     22m ago         │  Connection       ⬤  Ethernet · Strong                               │                                              │
│                     │                                                                        │ Offline Autonomy                             │
│                     │  ─────────────────────────────────────────────────────────────────── │ Online — autonomy standby                    │
│ 🔔                  │  Content & PRE Resolution                                   ↕ [─]   │ Corpus: corpus-v4-2026-06-01                 │
│  2 notifications    │  Now Playing      Campaign: Summer Promo 2026                        │                                              │
│                     │                  camp-summer-2026-001                                │                                              │
│                     │  Resolution Level ■ L2  Campaign                                     │                                              │
│                     │  Why this content?  [expand ▾]                                       │                                              │
│  Jordan H. · OPR    │  Active Overrides  No active overrides                               │                                              │
│  OPERATOR           │                                                                        │                                              │
│  Session: 09:14 AEST│  ─────────────────────────────────────────────────────────────────── │                                              │
│  Cert: L2           │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│  [Start Handoff]    │                                                                        │                                              │
│  [Request Elevated] │    No active overrides                                                │                                              │
│  [Sign Out]         │    Screens are running scheduled content.                             │                                              │
│                     │                                                                        │                                              │
│                     │    [Place Override +]                                                 │                                              │
│                     │    [Declare Incident]                                                 │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
│                     │  (collapsed)                                                           │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: incident:declaration:created at 15:03:44 AEST  [Open in Replay →]                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px expanded

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- A1 VenueSelector: Brisbane CBD row highlighted (active), with a red state dot and a red incident badge "❶" (1 active incident).
- A2 IncidentList: Label "ACTIVE INCIDENTS". One entry: severity pill "S3" (amber), "Brisbane CBD", "22m ago". Entry is clickable — navigates to `/incidents/{incident_id}`.
- A3 NotificationTrayAccess: Bell icon with red badge showing "2".
- A4 OperatorToolsMenu: Standard. [Start Handoff] and [Request Elevated Session] both available.

**System Status Bar (48px)**

- ConstitutionalStateIndicator: green "HEALTHY ●"
- Active Mode Indicator: "INCIDENT ACTIVE" (replaces "LIVE" because the currently-viewed venue has a declared incident)
- Session Clock, Operator Badge, [Elevate Session], Notification Badge (shows 2)

**Zone B — Primary Workspace**

- S1 Venue Identity Header: VenueNameBadge unchanged. PlayerStateBadge: red badge "Incident". No EmergencyContentBanner (no L6 override). Section background: standard (not tinted — HEALTHY constitutional state).
- S2 Player Health: all signals green (S3 incident does not imply hardware failure in this scenario).
- S3 Content & PRE Resolution: unchanged from healthy — L2 campaign content still playing.
- S4 Active Overrides & Interventions: empty override list. Standard controls — [Place Override +] and [Declare Incident] both active. Note: the incident has already been declared; [Declare Incident] remains available for additional incident declarations on this venue.
- S5 Recent Events: collapsed.

**Zone C — Right Panel (320px)**

C1 active (default on load). Content unchanged from HEALTHY state except notification context.

### Component Placement

Same as WF-LO-01 with these differences:
- PlayerStateBadge: red "Incident" (not green "Live")
- Active Mode Indicator: "INCIDENT ACTIVE"
- IncidentList (A2): one S3 entry visible
- NotificationBadge: count = 2
- AuditTraceFooter: shows most recent incident-related audit event

### Interaction Notes

- Clicking the S3 entry in Pane A2 navigates Zone B to `/incidents/{incident_id}` (Incident Commander Surface). This is the primary path to work the incident.
- The current surface (WF-LO-02) remains the venue dashboard — it shows the incident status passively through state indicators but does not host incident command controls.
- [Declare Incident] remains fully interactive. A second incident can be declared for the same venue (e.g., escalation to a different scope).
- [Place Override +] remains interactive. Placing an override during an incident is a legitimate action (e.g., emergency content).
- Clicking the notification bell opens tray; notifications likely include the incident declaration event.

### Disabled-State Behavior

No controls are disabled in S3 incident state at HEALTHY constitutional state. S3 does not restrict the operator's write access on the venue dashboard. Full OPERATOR access applies.

### Replay-State Behavior

Same as WF-LO-01. Live-only data. "INCIDENT ACTIVE" mode indicator is distinct from REPLAY mode.

### Degraded-State Behavior

If the constitutional state were DEGRADED during this incident, Zone A would receive an amber left border, the status bar would show amber "DEGRADED ●", and Section 2 would show one or more amber rows. S3 incident state alone does not degrade the constitutional state.

### Incident-State Behavior

- Active Mode Indicator shows "INCIDENT ACTIVE".
- Pane A2 shows the S3 incident entry.
- PlayerStateBadge shows red "Incident".
- Notification badge incremented.
- AuditTraceFooter reflects incident declaration event.
- If the incident escalates to S1 or S2 while on this surface: automatic Zone B navigation to `/venues/{venue_id}/incident/{incident_id}` via history push. A banner appears in the IC surface: "You were viewing the Venue Dashboard — [Return to Venue Dashboard]."

### Accessibility Notes

- IncidentList entries: ARIA role="listitem", aria-label="S3 incident at Brisbane CBD, 22 minutes ago".
- Active Mode Indicator: aria-live="polite" for mode transitions.
- Notification badge: aria-label="2 unread notifications".
- Same focus order and keyboard navigation as WF-LO-01.

---

## WF-LO-03: Live Operations — OPERATOR — Single Venue — EMERGENCY_FREEZE State

**ID:** WF-LO-03
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** constitutional_state = EMERGENCY_FREEZE
**Purpose:** Shows an operator the full surface rendering during system-wide Emergency Freeze — maximum restriction state with all content changes halted and non-dismissible system-wide banners active.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│█████████████████████  EMERGENCY FREEZE ACTIVE   Wall: 16:22:01 AEST   Jordan H. · OPR   [░Elevate Session░]   🔔 5  ████████████████████████│
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│▌VENUES              │ ████████████████████████████████████████████████████████████████████  │▌ Context  Health  Activity  Advisory   [░‹░] │
│─────────────────────│ EMERGENCY FREEZE ACTIVE — All content changes are halted.              │──────────────────────────────────────────────│
│ █ Brisbane CBD  ⬤ ❶│ Emergency content management is the only permitted write action.       │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│   Melbourne     ⬤ │ ████████████████████████████████████████████████████████████████████  │ C4 — CONSTITUTIONAL ADVISORY (auto-active)   │
│   Sydney        ⬤ │                                                                        │ ┌──────────────────────────────────────────┐  │
│   Perth         ⬤ │  Brisbane CBD                                    ⬤ Live               │ │ EMERGENCY FREEZE is active.              │  │
│                     │  Brisbane, QLD · venue-brisbane-001                                   │ │                                          │  │
│ ACTIVE INCIDENTS    │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~             │ │ All content changes are halted.          │  │
│─────────────────────│  ⚠ EMERGENCY CONTENT ACTIVE — Campaign: Emergency Alert 2026         │ │ Only emergency content management        │  │
│  S1 Brisbane CBD    │    Placed by Admin A. · 4m ago                                        │ │ actions are permitted.                   │  │
│     4m ago          │                                                                        │ │                                          │  │
│                     │  ─────────────────────────────────────────────────────────────────── │ │ Do not attempt to place overrides        │  │
│                     │  Player Health                                               ↕ [─]   │ │ or modify schedules until the freeze     │  │
│ 🔔                  │  Last Heartbeat   ⬤  5 seconds ago                                   │ │ is lifted.                               │  │
│  5 notifications    │  Corpus Hash      ⬤  a3f8b2c1  Verified ✓                           │ └──────────────────────────────────────────┘  │
│                     │  Clock Sync       ⬤  +0.4s                                           │                                              │
│                     │  Connection       ⬤  Ethernet · Strong                               │  (Switch to Context / Health / Activity      │
│  Jordan H. · OPR    │                                                                        │   tabs to view other information)            │
│  OPERATOR           │  ─────────────────────────────────────────────────────────────────── │                                              │
│  Session: 09:14 AEST│  Content & PRE Resolution                                   ↕ [─]   │                                              │
│  Cert: L2           │  Now Playing      Campaign: Emergency Alert 2026                     │                                              │
│  [░Handoff░]        │                  camp-emergency-001                                   │                                              │
│  [░Req. Elevated░]  │  Resolution Level ■ L6  Emergency                                     │                                              │
│  [Sign Out]         │  Why this content?  [expand ▾]                                       │                                              │
│                     │  Active Overrides  1 active — Highest: L6                            │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│                     │                                                                        │                                              │
│                     │  ████████████████████████████████████████████████████████████████  │                                              │
│                     │  L6 EMERGENCY   Campaign: Emergency Alert 2026   APPROVED            │                                              │
│                     │  Placed by Admin A.  · 4m ago  · No expiry set ~                    │                                              │
│                     │  [░Clear Emergency░]  tooltip: L6 requires ADMIN + elevated session  │                                              │
│                     │  ████████████████████████████████████████████████████████████████  │                                              │
│                     │                                                                        │                                              │
│                     │  ▲ Override accumulation — 1 overrides active. Highest: L6.          │                                              │
│                     │                                                                        │                                              │
│                     │  [░Place Override +░]  Emergency Freeze — unavailable                │                                              │
│                     │  [░Declare Incident░]  Emergency Freeze — restricted                 │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: override:entry:placed at 16:21:58 AEST  [Open in Replay →]                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed, red left border (4px, full height)
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px — CANNOT be collapsed during EMERGENCY_FREEZE. [‹] affordance is disabled (rendered as `[░‹░]`).

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- Red left border (4px, full height) — persistent peripheral alarm signal. Cannot be dismissed.
- A1 VenueSelector: fully functional. Operators must navigate between venues to monitor state.
- A2 IncidentList: fully functional. S1 incident entry visible with red severity pill.
- A3 NotificationTrayAccess: functional. Bell with badge count 5. Navigation to permitted routes from tray works. Navigation to CMS/Training shows tooltip "Unavailable during Emergency Freeze."
- A4 OperatorToolsMenu: [Start Handoff] = disabled (rendered as `[░Handoff░]`, tooltip "Session management restricted during Emergency Freeze"). [Request Elevated Session] = disabled (`[░Req. Elevated░]`, same tooltip). [Sign Out] = active.

**System Status Bar (48px) — Red background**

- Full bar background: red
- ConstitutionalStateIndicator: "EMERGENCY FREEZE" in white text on red. No separate confidence dot.
- Active Mode Indicator: "EMERGENCY FREEZE" (replaces "LIVE")
- Session Clock: visible, standard rendering
- Operator Identity Badge: visible, standard
- Elevate Session Button: `[░Elevate Session░]` — disabled, tooltip "Session elevation unavailable during Emergency Freeze"
- Notification Badge: bell + count badge (5)

**InterruptDisplay (Level 1, z-index 900, full-width, red background)**

Renders below System Status Bar, above Zone B content. Non-dismissible. Text: "EMERGENCY FREEZE ACTIVE — All content changes are halted. Emergency content management is the only permitted write action."

**Zone B — Primary Workspace**

- S1 Venue Identity Header: light red tint background. VenueNameBadge standard. PlayerStateBadge green "Live" (the player itself is healthy; the freeze is constitutional, not hardware). EmergencyContentBanner: full-width red bar — "EMERGENCY CONTENT ACTIVE — Campaign: Emergency Alert 2026 · Placed by Admin A. · 4m ago".
- S2 Player Health: all rows render normally (read-only; no restriction applies). Standard green signals.
- S3 Content & PRE: L6 Emergency resolution level. "Now Playing: Campaign: Emergency Alert 2026." "Active Overrides: 1 active — Highest: L6."
- S4 Active Overrides & Interventions: L6 override entry rendered with full red background row, bold white text, red "EMERGENCY" tag. "Clear Override" button for L6 is `[░Clear Emergency░]` (disabled for OPERATOR — OPERATOR cannot clear L6 even outside of freeze; tooltip clarifies ADMIN+elevated required). [Place Override +] = `[░Place Override +░]` (disabled, tooltip). [Declare Incident] = `[░Declare Incident░]` (disabled for OPERATOR, tooltip "Incident declaration restricted during Emergency Freeze").

**Zone C — Right Panel (320px)**

- Cannot be collapsed. [‹] affordance is `[░‹░]` (disabled).
- C4 (Constitutional Advisory) automatically activated on EMERGENCY_FREEZE.
- C4 content: red-bordered advisory box with bold text — the EMERGENCY_FREEZE advisory.
- Zone C background: light red tint.
- Operator may switch to C1/C2/C3 tabs while EMERGENCY_FREEZE is active.

### Component Placement

| Component | Zone / Section | EMERGENCY_FREEZE treatment |
|-----------|---------------|---------------------------|
| SystemStatusBar | Shell top | Red background, all text white |
| InterruptDisplay | Below SystemStatusBar | z-index 900, red, non-dismissible |
| Zone A red border | Zone A full height | 4px left border, red |
| EmergencyContentBanner | Zone B S1 | Red bar, non-dismissible |
| S1 background | Zone B S1 | Light red tint |
| PlaceOverrideButton | Zone B S4 | Disabled (L1–L5); L6 absent for OPERATOR |
| DeclareIncidentButton | Zone B S4 | Disabled for OPERATOR |
| ClearOverride (L1–L5) | Zone B S4 entries | Disabled (visible, not absent) |
| ClearOverride (L6) | Zone B S4 L6 entry | Absent for OPERATOR |
| HandoffButton | Zone A A4 | Disabled |
| ElevateSessionButton | SystemStatusBar | Disabled |
| RequestElevatedButton | Zone A A4 | Disabled |
| ZoneC collapse affordance | Zone C | Disabled |
| ConstitutionalAdvisory (C4) | Zone C | Auto-activated, red-bordered, bold text |
| Zone C background | Zone C | Light red tint |

### Interaction Notes

- Pane A1 venue navigation: fully interactive. Operator can view other venues' states.
- Pane A2 incident navigation: fully interactive. Clicking S1 entry navigates to IC surface.
- Clicking any disabled button (`░░░` style) produces a tooltip. No action occurs. No alert or error message.
- Zone C tab switching (C1/C2/C3/C4): active. Operator can view health, context, activity.
- "View full timeline in Replay →" (S5 if expanded): active. Replay navigation is permitted.
- [Sign Out]: active. Session termination is always available.

### Disabled-State Behavior

Controls disabled (visible, non-interactive, with tooltip) for OPERATOR during EMERGENCY_FREEZE:
- [Place Override +] (L1–L5)
- [Declare Incident]
- All "Clear Override" buttons for L1–L5 overrides
- [Start Handoff]
- [Request Elevated Session]
- [Elevate Session] (System Status Bar)
- Zone C collapse affordance [‹]

Controls absent from DOM (not present for OPERATOR regardless of freeze):
- "Clear Emergency" button for L6 override (OPERATOR never has this; ADMIN+elevated required)
- Place L6 Override button (OPERATOR cannot place L6)

### Replay-State Behavior

Replay navigation is permitted during EMERGENCY_FREEZE. The "View full timeline in Replay →" link in S5 and "Open in Replay →" in the Audit Trace Footer both navigate as normal. The Replay workspace itself renders without freeze restrictions (EMERGENCY_FREEZE applies to live write actions, not replay investigation).

### Degraded-State Behavior

EMERGENCY_FREEZE takes visual precedence over DEGRADED. If health signals in S2 were also showing degradation, they would render their individual amber/red indicators as usual within the normally rendered S2 section. No additional visual layering.

### Incident-State Behavior

The S1 incident in Pane A2 is the mechanism that likely triggered the freeze. Incident navigation is fully permitted. The Active Mode Indicator shows "EMERGENCY FREEZE" which subsumes "INCIDENT ACTIVE" — both conditions are active.

### Accessibility Notes

- InterruptDisplay: ARIA role="alert", aria-live="assertive". Screen reader announces on mount.
- Red Zone A border: decorative. The systematic restriction is communicated through disabled control labels and tooltips.
- Disabled controls: aria-disabled="true", aria-describedby pointing to a tooltip element with the restriction reason.
- Zone C auto-switch to C4: emits focus to the C4 tab for screen reader announcement.
- EmergencyContentBanner: ARIA role="alert". Non-dismissible — no aria-close or dismiss affordance present.
- SystemStatusBar color change: not the sole signal — text "EMERGENCY FREEZE" is present for color-blind users.

---

## WF-LO-04: Live Operations — OPERATOR — Single Venue — OFFLINE/DEGRADED (Player Offline)

**ID:** WF-LO-04
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** Player machine state = OFFLINE for the viewed venue; constitutional_state = DEGRADED
**Purpose:** Shows the operator a venue whose player has gone offline — all last-known data is stale/expired, autonomy status is counting down, and override placement is blocked.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ~ DEGRADED ●  LIVE   Wall: 11:45:33 AEST   Jordan H. · OPR   [Elevate Session]   🔔 3                                                        │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD  ◆  │  Brisbane CBD                                    ◆ Offline             │ C2 — SYSTEM HEALTH INDICATORS                │
│   Melbourne     ⬤ │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│   Sydney        ⬤ │                                                                        │ Player State     ◆ Offline                   │
│   Perth         ⬤ │  ─────────────────────────────────────────────────────────────────── │ Constitutional   ~ DEGRADED ●                │
│                     │  Player Health                                               ↕ [─]   │ Heartbeat        ⬤ EXPIRED — 23m ago         │
│ ACTIVE INCIDENTS    │  Last Heartbeat   ⬤  EXPIRED — last contact 23m ago                  │ Corpus Hash      ~ Hash unknown (offline)    │
│─────────────────────│  Corpus Hash      ~  Hash unknown — last verified 23m ago            │ Clock Sync       ~ Governed clock unavail.   │
│  No active          │  Clock Sync       ~  Governed clock unavailable                      │ Connection       ⬤ No connection — offline   │
│  incidents          │  Connection       ⬤  No connection — player offline                  │ PRE Level        ~ L1 (last known, stale)    │
│                     │                                                                        │ Override Count   0 active                    │
│                     │  ─────────────────────────────────────────────────────────────────── │ Active Incidents ~ Status unavailable        │
│ 🔔                  │  Content & PRE Resolution                                   ↕ [─]   │                                              │
│  3 notifications    │  ⬤ PRE data expired (23m ago) ────────────────────────────────────  │                                              │
│                     │  Now Playing      Campaign: Summer Promo 2026  (last known)          │                                              │
│                     │                  camp-summer-2026-001                                │                                              │
│  Jordan H. · OPR    │  Resolution Level ■ L2  Campaign  (stale)                           │                                              │
│  OPERATOR           │  Why this content?  [expand ▾]                                       │                                              │
│  Session: 09:14 AEST│  Active Overrides  Override stack status unavailable                 │                                              │
│  Cert: L2           │                                                                        │                                              │
│  [Start Handoff]    │  ─────────────────────────────────────────────────────────────────── │                                              │
│  [Request Elevated] │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│  [Sign Out]         │                                                                        │                                              │
│                     │    No active overrides (last known state)                             │ C1 — OFFLINE AUTONOMY                        │
│                     │                                                                        │──────────────────────────────────────────────│
│                     │    [░Place Override +░]                                               │ Venue Time                                   │
│                     │      Player is offline — override placement unavailable               │ 11:45:33 AEST                                │
│                     │    [Declare Incident]                                                 │                                              │
│                     │                                                                        │ Offline Autonomy                             │
│                     │  ─────────────────────────────────────────────────────────────────── │ ~ Offline — 20h 37m autonomy remaining       │
│                     │  Recent Events                                               ↕ [+]   │   Sustaining on corpus version:              │
│                     │  (collapsed)                                                           │   corpus-v4-2026-06-01                       │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: ui:section:expanded at 11:22:14 AEST  [Open in Replay →]                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed, amber left border (2px, DEGRADED constitutional state)
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px expanded

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- Amber left border (2px) — DEGRADED constitutional state visual treatment.
- A1 VenueSelector: Brisbane CBD row highlighted (active). State dot is dark red (◆) indicating OFFLINE. No incident badge (no incident declared, though the player is offline).
- A2 IncidentList: "No active incidents" — confirmed empty state. Note: [Declare Incident] is available in S4 for the offline venue.
- A3 NotificationTrayAccess: Bell with badge "3".
- A4 OperatorToolsMenu: Standard. All controls active.

**System Status Bar (48px)**

- ConstitutionalStateIndicator: amber badge "DEGRADED ●" with amber or grey confidence dot.
- Active Mode Indicator: "LIVE" (no incident declared; the platform is live even though this venue's player is offline).

**Zone B — Primary Workspace**

- S1 Venue Identity Header: VenueNameBadge standard. PlayerStateBadge: dark red "Offline". No EmergencyContentBanner.
- S2 Player Health: Heartbeat row — red dot, "EXPIRED — last contact 23m ago". Corpus Hash row — amber, "Hash unknown — last verified 23m ago". Clock Sync row — amber, "Governed clock unavailable". Connection row — red, "No connection — player offline". All rows render; no collapse of individual rows.
- S3 Content & PRE: Red bordered section header "PRE data expired (23m ago)". "Now Playing: Campaign: Summer Promo 2026 (last known)" with stale annotation. "Resolution Level: L2 Campaign (stale)." "Active Overrides: Override stack status unavailable" (amber text — FP-06 compliance).
- S4 Active Overrides & Interventions: Override list shows "No active overrides (last known state)." [Place Override +] = `[░Place Override +░]` — disabled, tooltip "Override placement unavailable — player is offline." [Declare Incident] = active. (Operators must be able to declare an incident for an offline venue.)
- S5 Recent Events: collapsed.

**Zone C — Right Panel (320px)**

C2 (System Health Indicators) is shown in the wireframe to illustrate the degraded signal list. On first load, C1 would be active; the operator would likely switch to C2. Both are shown in the panel area above.

C1 section (below the health list, shown as a secondary area): Offline Autonomy shows amber text "Offline — 20h 37m autonomy remaining" with corpus basis note.

### Component Placement

Same component set as WF-LO-01 with these changes:
- PlayerStateBadge: dark red "Offline"
- Zone A amber border
- SystemStatusBar amber DEGRADED badge
- S2 Heartbeat, CorpusHash, ClockSync, Connection: all degraded/expired treatments
- S3 PRE section: red border on section header
- S4 PlaceOverrideButton: disabled
- Zone C C2: full degraded signal list

### Interaction Notes

- [Declare Incident]: active and recommended. The operator should declare an incident to formally track the offline venue.
- [░Place Override +░]: clicking does nothing. Tooltip appears on hover/focus.
- All Zone C tabs: interactive. C2 useful for surveying all degraded signals.
- "View full timeline in Replay →" (if S5 expanded): active. Reviewing the last events before the venue went offline is a valid investigation action.
- Pane A1: clicking other venues navigates Zone B to those venues (those may be healthy).

### Disabled-State Behavior

- [Place Override +]: disabled because `player_state.machine_state === "OFFLINE"`. Tooltip: "Override placement unavailable — player is offline." The control is visible but non-interactive.
- No other controls are disabled purely by OFFLINE state. [Declare Incident] remains active.

### Replay-State Behavior

Same as WF-LO-01. This surface is live-only. REPLAY investigation of the period before the venue went offline is accessed via "View full timeline in Replay →."

### Degraded-State Behavior

This wireframe IS the degraded state. Key indicators:
- Zone A: amber left border
- System Status Bar: amber DEGRADED badge
- Section 2: multiple expired/unavailable rows in red and amber
- Section 3: red-bordered PRE section header, stale content label
- Section 3 Override Stack: "Override stack status unavailable" (amber — not "No overrides" which would imply positive confirmation)
- Zone C C1: amber offline autonomy countdown
- Zone C C2: full list of degraded signals

### Incident-State Behavior

No incident is declared in this wireframe. If the operator clicks [Declare Incident], an S3 or higher incident may be appropriate. After declaration, the venue dashboard would show the incident in A2 and the mode indicator would switch to "INCIDENT ACTIVE."

### Accessibility Notes

- Stale/expired data rows: aria-label includes the staleness description (e.g., "Last heartbeat: expired, last contact 23 minutes ago").
- PlayerStateBadge "Offline": aria-label="Player state: Offline".
- Disabled [Place Override +]: aria-disabled="true", aria-describedby="override-disabled-reason". The reason element contains "Override placement unavailable — player is offline."
- Amber visual treatments are not sole indicators — explicit text ("EXPIRED," "unavailable," "stale") is always present.
- DEGRADED constitutional state indicator: aria-live="polite" for transition announcements.

---

## WF-LO-05: Live Operations — VIEWER — Single Venue — HEALTHY State (Read-Only)

**ID:** WF-LO-05
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** VIEWER
**State:** HEALTHY
**Purpose:** Shows the VIEWER-role read-only variant — all write controls absent from DOM, Section 4 labeled "VIEWER — read only."

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬤ HEALTHY ●  LIVE   Wall: 14:33:07 AEST   Sam K. · VWR                                   🔔 1                                               │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD   ⬤ │  Brisbane CBD                                    ⬤ Live               │ C1 — OPERATIONAL CONTEXT                     │
│                     │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│                     │                                                                        │ Venue Time                                   │
│                     │  ─────────────────────────────────────────────────────────────────── │ 14:33:07 AEST                                │
│                     │  Player Health                                               ↕ [─]   │                                              │
│ ACTIVE INCIDENTS    │  Last Heartbeat   ⬤  12 seconds ago                                   │ Next Transition                              │
│─────────────────────│  Corpus Hash      ⬤  a3f8b2c1  Verified ✓                           │ Campaign: Evening Sports                     │
│  No active          │  Clock Sync       ⬤  +0.3s                                           │ → in 2h 14m AEST                             │
│  incidents          │  Connection       ⬤  Ethernet · Strong                               │                                              │
│                     │                                                                        │ Upcoming (next 2h)                           │
│                     │  ─────────────────────────────────────────────────────────────────── │  15:30  Campaign: Evening Sports  L2         │
│ 🔔                  │  Content & PRE Resolution                                   ↕ [─]   │  16:00  Scheduled: Night Loop     L1         │
│  1 notification     │  Now Playing      Campaign: Summer Promo 2026                        │                                              │
│                     │                  camp-summer-2026-001                                │ Offline Autonomy                             │
│                     │  Resolution Level ■ L2  Campaign                                     │ Online — autonomy standby                    │
│                     │  Why this content?  [expand ▾]                                       │ Corpus: corpus-v4-2026-06-01                 │
│  Sam K. · VWR       │  Active Overrides  No active overrides                               │                                              │
│  VIEWER             │                                                                        │                                              │
│  Session: 13:00 AEST│  ─────────────────────────────────────────────────────────────────── │                                              │
│  Cert: L1           │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│  [Sign Out]         │  VIEWER — read only                                                   │                                              │
│                     │                                                                        │                                              │
│                     │    No active overrides                                                │                                              │
│                     │    Screens are running scheduled content.                             │                                              │
│                     │                                                                        │                                              │
│                     │  (No action controls — VIEWER role has read-only access)              │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
│                     │  (collapsed)                                                           │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: ui:section:expanded at 14:28:55 AEST  [Open in Replay →]                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px expanded

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- A1 VenueSelector: shows only venues from `session.assigned_venue_ids`. Brisbane CBD shown because it is assigned. No other venues listed (VIEWER sees only assigned venues). Active row highlighted.
- A2 IncidentList: "No active incidents" (positive confirmation). Functional and readable.
- A3 NotificationTrayAccess: Bell with badge "1". Functional.
- A4 OperatorToolsMenu: Shows "Sam K. · VWR" and "VIEWER" role. Contains: session start, certification level (L1), [Sign Out]. Absent: [Start Handoff], [Request Elevated Session] — these are not rendered for VIEWER.

**System Status Bar (48px)**

- ConstitutionalStateIndicator: green HEALTHY ●
- Active Mode Indicator: "LIVE"
- Session Clock standard
- Operator Identity Badge: "Sam K. · VWR"
- Elevate Session Button: **absent** — not rendered for VIEWER role
- Notification Badge: bell + badge "1"

**Zone B — Primary Workspace**

- S1: standard. PlayerStateBadge green "Live".
- S2: standard read-only health rows.
- S3: standard. PREExplainability expand available to VIEWER (read-only).
- S4: Section header "Active Overrides & Interventions." Small label "VIEWER — read only" (muted grey, below header). Empty override list shows "No active overrides." [Place Override +] = **absent from DOM**. [Declare Incident] = **absent from DOM**. No "Clear Override" buttons on any entries. No inline "You don't have permission" messages.
- S5: collapsed, standard.

**Zone C — Right Panel (320px)**

C1 active. Contents identical to WF-LO-01. Zone C contains no write controls.

### Component Placement

| Component | VIEWER treatment |
|-----------|-----------------|
| PlaceOverrideButton | Absent from DOM |
| DeclareIncidentButton | Absent from DOM |
| Clear Override buttons | Absent from DOM |
| Handoff button (A4) | Absent from DOM |
| Elevate Session button | Absent from DOM (both SystemStatusBar and A4) |
| S4 "VIEWER — read only" note | Visible, muted grey |
| PREExplainability expand | Visible (read-only) |
| Section collapse toggles | Visible (layout preference) |
| Zone C tabs | Visible (read-only) |
| Zone C [‹] collapse | Visible (layout preference) |

### Interaction Notes

- VIEWER can expand/collapse all sections (S2–S5). These are layout preferences, not write actions.
- VIEWER can expand PREExplainability to read the full resolution trace.
- VIEWER can switch Zone C tabs (C1–C4).
- VIEWER can collapse Zone C.
- VIEWER can click notification tray bell.
- VIEWER can navigate between their assigned venues via Pane A1.
- VIEWER cannot see any other venue (only assigned venues shown in Pane A1).
- No alert, tooltip, or messaging says "You don't have permission" — controls are simply absent.

### Disabled-State Behavior

VIEWER controls are absent, not disabled. The distinction matters: disabled implies a correctable condition (e.g., get elevated session). Absent means the role never has this capability. No disabled styling for VIEWER-restricted controls.

### Replay-State Behavior

Same as WF-LO-01. Live-only surface.

### Degraded-State Behavior

Identical visual treatment to WF-LO-04 degraded state for the health sections. VIEWER sees all degraded indicators in read-only form.

### Incident-State Behavior

VIEWER sees incident indicators passively: red PlayerStateBadge, "INCIDENT ACTIVE" mode indicator, S3 entry in Pane A2. Clicking the incident in A2 navigates to the IC surface — but since [Declare Incident] is absent, VIEWER cannot initiate incidents.

### Accessibility Notes

- No "You don't have permission" messages in the DOM (FP-08 compliance). No aria-labels referencing permission denial.
- Section 4 "VIEWER — read only" note: aria-label="Active Overrides section — viewer read only access".
- Absent controls have no DOM presence and therefore no aria entries.
- Focus order: same as WF-LO-01 but SystemStatusBar skips the absent Elevate Session button.
- All data rows are fully keyboard-navigable for reading.

---

## WF-LO-06: Live Operations — ADMIN — Fleet View (/fleet)

**ID:** WF-LO-06
**Surface:** Live Operations Surface — Fleet Overview
**Route:** `/fleet`
**Role:** ADMIN
**State:** Mixed fleet — 3 venues HEALTHY, 1 DEGRADED, 1 OFFLINE. Constitutional state: DEGRADED.
**Purpose:** Shows ADMIN the multi-venue aggregate view from which any individual venue can be opened.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ~ DEGRADED ●  LIVE   Wall: 10:15:44 AEST   Admin A. · ADM   [14m elevated]   🔔 7                                                            │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │  Fleet Overview                                                         │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│  5 venues · 3 healthy · 1 degraded · 1 offline                         │──────────────────────────────────────────────│
│   Brisbane CBD  ⬤ │                                                                        │ C1 — FLEET CONTEXT                           │
│   Melbourne     ⬤ │  ┌───────────────────────────────────────────────────────────────────┐│                                              │
│   Sydney        ~ │  │ Brisbane CBD                             ⬤ Live        [Open →]  ││ Fleet Status                                 │
│   Perth         ⬤ │  │ Brisbane, QLD · L2 Campaign · 0 overrides · Last hb: 8s ago      ││ ⬤ 3 healthy                                 │
│   Gold Coast    ◆ │  └───────────────────────────────────────────────────────────────────┘│ ~ 1 degraded                                │
│                     │                                                                        │ ◆ 1 offline                                  │
│ ACTIVE INCIDENTS    │  ┌───────────────────────────────────────────────────────────────────┐│                                              │
│─────────────────────│  │ Melbourne                                ⬤ Live        [Open →]  ││ Active Incidents                             │
│  S3 Sydney          │  │ Melbourne, VIC · L1 Scheduled · 0 overrides · Last hb: 11s ago   ││ 1 active (S3 · Sydney)                       │
│     41m ago         │  └───────────────────────────────────────────────────────────────────┘│                                              │
│                     │                                                                        │ Constitutional State                         │
│  View all →         │  ┌───────────────────────────────────────────────────────────────────┐│ ~ DEGRADED ● (MEDIUM)                        │
│                     │  │ Sydney                                   ~ Degraded    [Open →]  ││ Basis: Gold Coast offline,                   │
│ 🔔                  │  │ Sydney, NSW · L2 Campaign · 1 override · S3 INCIDENT · 41m ago   ││ Sydney S3 incident                           │
│  7 notifications    │  └───────────────────────────────────────────────────────────────────┘│                                              │
│                     │                                                                        │                                              │
│                     │  ┌───────────────────────────────────────────────────────────────────┐│                                              │
│  Admin A. · ADM     │  │ Perth                                    ⬤ Live        [Open →]  ││                                              │
│  ADMIN              │  │ Perth, WA · L1 Scheduled · 0 overrides · Last hb: 3s ago         ││                                              │
│  Session: 09:00 AEST│  └───────────────────────────────────────────────────────────────────┘│                                              │
│  Cert: L4           │                                                                        │                                              │
│  Elevated: 14m left │  ┌───────────────────────────────────────────────────────────────────┐│                                              │
│  [Start Handoff]    │  │ Gold Coast                               ◆ Offline     [Open →]  ││                                              │
│  [14m elevated]     │  │ Gold Coast, QLD · Last known: L0 Fallback · Offline 47m           ││                                              │
│  [Sign Out]         │  └───────────────────────────────────────────────────────────────────┘│                                              │
│                     │                                                                        │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: session:elevation:granted at 10:01:33 AEST  [Open in Replay →]                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed, amber left border (2px, DEGRADED)
- Zone B (center workspace): fluid (~840px) — shows Fleet Overview, not VenueOperationsDashboard
- Zone C (right panel): 320px expanded

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- Amber left border (2px, DEGRADED constitutional state).
- A1 VenueSelector: all 5 venues shown (ADMIN sees all). No row is highlighted as "active" (fleet view, no single venue selected). State dots reflect individual player states. Sydney row shows amber dot (~). Gold Coast row shows dark red dot (◆ offline). No ADMIN visual distinction by assignment.
- A2 IncidentList: One S3 entry ("Sydney · 41m ago"). "View all →" link if more than 20 incidents existed.
- A3 NotificationTrayAccess: Bell with badge "7".
- A4 OperatorToolsMenu: "Admin A. · ADM", ADMIN role, elevation active — amber countdown "Elevated: 14m left." [Start Handoff], [14m elevated] (amber countdown button replacing standard Elevate Session), [Sign Out].

**System Status Bar (48px)**

- ConstitutionalStateIndicator: amber "DEGRADED ●" with amber confidence dot.
- Active Mode Indicator: "LIVE".
- Elevate Session Button: amber "[14m elevated]" showing the countdown.
- Notification Badge: "7".

**Zone B — Fleet Overview Workspace**

Header: "Fleet Overview — 5 venues · 3 healthy · 1 degraded · 1 offline"

Five VenueCard components in a vertical list (not the VenueOperationsDashboard — this is the FleetOverviewWorkspace):
- Each VenueCard: venue name (bold), location, state badge (right-aligned), [Open →] button, one-line summary (PRE level, override count, last heartbeat or offline duration, incident if active).
- Brisbane CBD: green "Live" badge. Summary: "L2 Campaign · 0 overrides · Last hb: 8s ago"
- Melbourne: green "Live" badge. Summary: "L1 Scheduled · 0 overrides · Last hb: 11s ago"
- Sydney: amber "Degraded" badge. Summary: "L2 Campaign · 1 override · S3 INCIDENT · 41m ago"
- Perth: green "Live" badge. Summary: "L1 Scheduled · 0 overrides · Last hb: 3s ago"
- Gold Coast: dark red "Offline" badge. Summary: "Last known: L0 Fallback · Offline 47m"

**Zone C — Right Panel (320px)**

C1 active. Content: Fleet Status (3/1/1 summary), Active Incidents count, Constitutional State (DEGRADED, MEDIUM, basis signals).

### Component Placement

| Component | Fleet View treatment |
|-----------|---------------------|
| VenueOperationsDashboard | Absent (Zone B is FleetOverviewWorkspace) |
| FleetOverviewWorkspace | Zone B — 5 VenueCards |
| VenueCard (per venue) | Zone B — one per venue |
| [Open →] button (per card) | Zone B — navigates to `/venues/:venue_id` |
| VenueSelector (A1) | Zone A — all venues visible, none highlighted |
| Elevation countdown | SystemStatusBar + A4 |

### Interaction Notes

- [Open →] on any VenueCard: navigates Zone B to `/venues/{venue_id}` (VenueOperationsDashboard for that venue). History push.
- Clicking a venue row in Pane A1: same as [Open →] — navigates Zone B to that venue.
- Clicking the S3 Sydney entry in Pane A2: navigates to `/incidents/{incident_id}`.
- VenueCards update in real-time via WebSocket (state dots and heartbeat times update without page interaction).

### Disabled-State Behavior

No controls disabled in this fleet view. All [Open →] buttons active. ADMIN access is unrestricted at DEGRADED constitutional state.

### Replay-State Behavior

Fleet view is live-only. No replay affordances here. Replay is initiated from within individual venue views.

### Degraded-State Behavior

- Zone A amber border.
- Status bar amber DEGRADED badge.
- Sydney VenueCard: amber state badge.
- Gold Coast VenueCard: dark red state badge, offline duration shown.
- Zone C C1: fleet status summary reflects 1 degraded, 1 offline.

### Incident-State Behavior

- Sydney card has "S3 INCIDENT · 41m ago" inline summary.
- Pane A2 shows the S3 entry.
- Active Mode Indicator still reads "LIVE" (fleet view; no single venue selected for IC surface takeover).

### Accessibility Notes

- VenueCards: ARIA role="article" or role="listitem". Each [Open →] button: aria-label="Open venue: Brisbane CBD".
- Fleet header count "5 venues · 3 healthy · 1 degraded · 1 offline": aria-live="polite" for real-time updates.
- Elevation countdown "[14m elevated]": aria-live="polite" for countdown updates (updates at reasonable intervals, not every second, to avoid screen reader noise).
- Zone A amber border: decorative; DEGRADED state is communicated textually via status bar.

---

## WF-LO-07: Live Operations — OPERATOR — Override Accumulation Warning (≥3 Overrides)

**ID:** WF-LO-07
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** HEALTHY constitutional state; 3 active overrides (L4, L3, L2); accumulation warning active
**Purpose:** Shows the operator the surface when override accumulation reaches the threshold of 3 — the warning indicator is non-dismissible and the operator must review and clear unnecessary overrides.

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⬤ HEALTHY ●  LIVE   Wall: 13:17:48 AEST   Jordan H. · OPR   [Elevate Session]   🔔 1                                                        │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD   ⬤ │  Brisbane CBD                                    ⬤ Live               │ C2 — SYSTEM HEALTH INDICATORS                │
│   Melbourne     ⬤ │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│   Sydney        ⬤ │                                                                        │ Player State     ⬤ Live                      │
│   Perth         ⬤ │  ─────────────────────────────────────────────────────────────────── │ Constitutional   ⬤ HEALTHY ● (HIGH)          │
│                     │  Player Health                                               ↕ [─]   │ Heartbeat        ⬤ CURRENT — 7s ago          │
│ ACTIVE INCIDENTS    │  Last Heartbeat   ⬤  7 seconds ago                                   │ Corpus Hash      ⬤ Verified ✓               │
│─────────────────────│  Corpus Hash      ⬤  a3f8b2c1  Verified ✓                           │ Clock Sync       ⬤ +0.2s                     │
│  No active          │  Clock Sync       ⬤  +0.2s                                           │ Connection       ⬤ Ethernet · Strong         │
│  incidents          │  Connection       ⬤  Ethernet · Strong                               │ PRE Level        ■ L4  Operator Override      │
│                     │                                                                        │ Override Count   ~ 3 active ▲ accumulation   │
│                     │  ─────────────────────────────────────────────────────────────────── │ Active Incidents  None                       │
│ 🔔                  │  Content & PRE Resolution                                   ↕ [─]   │                                              │
│  1 notification     │  Now Playing      Override: Game Day Promo                           │                                              │
│                     │                  override-game-day-001                               │                                              │
│                     │  Resolution Level ■ L4  Operator Override                            │                                              │
│  Jordan H. · OPR    │  Why this content?  [expand ▾]                                       │                                              │
│  OPERATOR           │  ~ Active Overrides  3 active — override accumulation warning        │                                              │
│  Session: 09:14 AEST│          Highest: L4   [View details ↓]                              │                                              │
│  Cert: L2           │                                                                        │                                              │
│  [Start Handoff]    │  ─────────────────────────────────────────────────────────────────── │                                              │
│  [Request Elevated] │  Active Overrides & Interventions                            ↕ [─]   │                                              │
│  [Sign Out]         │                                                                        │                                              │
│                     │  ~ ▲ Override accumulation — 3 overrides active.                     │                                              │
│                     │      Review and clear unnecessary overrides.                          │                                              │
│                     │                                                                        │                                              │
│                     │  ████  L4  Override: Game Day Promo    APPROVED                     │                                              │
│                     │  Placed by Jordan H. · 45m ago · Expires in 3h 15m                  │                                              │
│                     │  [Clear Override]                                                     │                                              │
│                     │                                                                        │                                              │
│                     │  ───  L3  Override: Regional Sports    APPROVED                     │                                              │
│                     │  Placed by Jordan H. · 2h ago · Expires in 1h 45m                   │                                              │
│                     │  [Clear Override]                                                     │                                              │
│                     │                                                                        │                                              │
│                     │  ─    L2  Override: Summer Campaign    APPROVED                     │                                              │
│                     │  Placed by System · 3h ago · Expires in 55m                          │                                              │
│                     │  [Clear Override]                                                     │                                              │
│                     │                                                                        │                                              │
│                     │    [Place Override +]                                                 │                                              │
│                     │    [Declare Incident]                                                 │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: override:entry:placed at 12:32:04 AEST  [Open in Replay →]                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px expanded, C2 shown (operator switched to Health tab to review accumulation)

### Panel Breakdown

**Zone A — Left Navigation (280px)**

Standard rendering. No special treatment for override accumulation in Zone A.

**System Status Bar (48px)**

Standard green HEALTHY. No accumulation warning in the status bar — accumulation is a venue-scoped warning, not a constitutional state.

**Zone B — Primary Workspace**

- S1: standard green PlayerStateBadge "Live".
- S2: all green health rows.
- S3 Content & PRE Resolution: "Now Playing: Override: Game Day Promo." L4 badge. "Active Overrides: 3 active — override accumulation warning · Highest: L4 [View details ↓]" — amber text. "[View details ↓]" link scrolls to Section 4 or expands it.
- S4 Active Overrides & Interventions:
  - Top of section: amber accumulation warning banner — "▲ Override accumulation — 3 overrides active. Review and clear unnecessary overrides." Non-dismissible.
  - L4 entry: thick orange left border, elevated background. "[Clear Override]" button active for OPERATOR.
  - L3 entry: thin amber left border. "[Clear Override]" button active for OPERATOR.
  - L2 entry: thin grey left border (L2 is Campaign level per spec — thin blue; shown as grey for clarity in ASCII). "[Clear Override]" button active for OPERATOR.
  - [Place Override +]: active.
  - [Declare Incident]: active.

**Zone C — Right Panel (320px)**

C2 (System Health) shown. Override Count row reads "~ 3 active ▲ accumulation" in amber. All other rows green.

### Component Placement

| Component | Accumulation state treatment |
|-----------|------------------------------|
| OverrideStackSummaryRow (S3) | Amber text, accumulation warning, "View details" link |
| AccumulationWarning (S4 top) | Amber banner, non-dismissible |
| Override entries (S4) | 3 entries with level-differentiated borders |
| ClearOverride buttons | Active for all 3 entries (L4, L3, L2) |
| C2 Override Count row | Amber with accumulation indicator |

### Interaction Notes

- "[View details ↓]" in S3: scrolls to Section 4 if already expanded. If S4 is collapsed, expands S4 and scrolls.
- [Clear Override] on each entry: opens confirmation flow per level. L4 requires text entry of venue name. L1–L3 require checkbox confirmation.
- After clearing, the accumulation warning disappears if override count drops below 3. The warning banner is driven by live data — it clears within the WebSocket update cycle (max 30s for override stack updates).

### Disabled-State Behavior

No controls disabled in this state. Override accumulation is a warning, not a system restriction. OPERATOR retains full access.

### Replay-State Behavior

Same as WF-LO-01.

### Degraded-State Behavior

If constitutional state were DEGRADED simultaneously, Zone A amber border and status bar amber badge would appear as in WF-LO-04. The accumulation warning within Zone B is independent and additive.

### Incident-State Behavior

If an incident were also active: Active Mode Indicator would show "INCIDENT ACTIVE." Pane A2 would show the incident. Section 4 controls would remain accessible.

### Accessibility Notes

- Accumulation warning banner: ARIA role="alert" or aria-live="polite" (not assertive — it is not an emergency interrupt). aria-label="Override accumulation warning: 3 overrides active."
- Override list entries: ARIA role="listitem". Each [Clear Override] button: aria-label="Clear L4 override: Game Day Promo."
- "View details ↓" link: aria-label="View override details in Section 4."
- The warning banner has no dismiss affordance — no aria-close.

---

## WF-LO-08: Live Operations — OPERATOR — RECOVERED_BUT_UNTRUSTED Player State

**ID:** WF-LO-08
**Surface:** Live Operations Surface
**Route:** `/venues/:venue_id`
**Role:** OPERATOR
**State:** player_state.machine_state = RECOVERED_BUT_UNTRUSTED; constitutional_state = DEGRADED
**Purpose:** Shows the surface state immediately after a player reconnects but before corpus hash verification — the player is back online but the system cannot trust its state. The operator must not treat this as "healthy."

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ~ DEGRADED ●  LIVE   Wall: 09:52:17 AEST   Jordan H. · OPR   [Elevate Session]   🔔 4                                                        │
├─────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ VENUES              │                                                                        │ Context  Health  Activity  Advisory    [‹]   │
│─────────────────────│                                                                        │──────────────────────────────────────────────│
│ █ Brisbane CBD  ~ │  Brisbane CBD                            ~ Reconnected — Unverified    │ C2 — SYSTEM HEALTH INDICATORS                │
│   Melbourne     ⬤ │  Brisbane, QLD · venue-brisbane-001                                   │                                              │
│   Sydney        ⬤ │                                                                        │ Player State   ~ Reconnected — Unverified    │
│   Perth         ⬤ │  ─────────────────────────────────────────────────────────────────── │ Constitutional ~ DEGRADED ● (LOW)            │
│                     │  Player Health                                               ↕ [─]   │ Heartbeat      ⬤ CURRENT — 3s ago           │
│ ACTIVE INCIDENTS    │  Last Heartbeat   ⬤  3 seconds ago                                   │ Corpus Hash    ~ Hash pending verification   │
│─────────────────────│  Corpus Hash      ~  Hash pending verification                       │ Clock Sync     ~ +1.2s (within tolerance)    │
│  No active          │  Clock Sync       ⬤  +1.2s                                           │ Connection     ⬤ Ethernet · Strong           │
│  incidents          │  Connection       ⬤  Ethernet · Strong · Reconnected 4m ago          │ PRE Level      ~ L0 Fallback (unverified)    │
│                     │                                                                        │ Override Count  0 active                    │
│                     │  ─────────────────────────────────────────────────────────────────── │ Active Incidents None                        │
│ 🔔                  │  Content & PRE Resolution                                   ↕ [─]   │                                              │
│  4 notifications    │  Now Playing      Fallback: Default Loop  (unverified state)         │                                              │
│                     │                  fallback-default-001                                │ C4 — CONSTITUTIONAL ADVISORY (active)        │
│                     │  Resolution Level ■ L0  Fallback  (unverified)                      │──────────────────────────────────────────────│
│                     │  Why this content?  [expand ▾]                                       │ ~ System is degraded. Some resolution        │
│  Jordan H. · OPR    │  Active Overrides  Override stack status: pending verification       │   paths may be impaired. Monitor for         │
│  OPERATOR           │                                                                        │   escalation.                                │
│  Session: 09:14 AEST│  ─────────────────────────────────────────────────────────────────── │                                              │
│  Cert: L2           │  Active Overrides & Interventions                            ↕ [─]   │   Basis: Brisbane CBD reconnected            │
│  [Start Handoff]    │                                                                        │   but corpus not yet verified.               │
│  [Request Elevated] │  ~ ▲ Player reconnected — corpus verification in progress.            │                                              │
│  [Sign Out]         │     Override placement unavailable until verification completes.      │                                              │
│                     │                                                                        │                                              │
│                     │    No active overrides (state pending verification)                   │                                              │
│                     │                                                                        │                                              │
│                     │    [░Place Override +░]                                               │                                              │
│                     │      Verification in progress — unavailable                           │                                              │
│                     │    [Declare Incident]                                                 │                                              │
│                     │                                                                        │                                              │
│                     │  ─────────────────────────────────────────────────────────────────── │                                              │
│                     │  Recent Events                                               ↕ [+]   │                                              │
│                     │  (collapsed)                                                           │                                              │
├─────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ Last action: ui:section:expanded at 09:51:33 AEST  [Open in Replay →]                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Dimensions
- Zone A (left nav): 280px fixed, amber left border (2px, DEGRADED)
- Zone B (center workspace): fluid (~840px)
- Zone C (right panel): 320px expanded

### Panel Breakdown

**Zone A — Left Navigation (280px)**

- Amber left border (2px) — DEGRADED constitutional state.
- A1 VenueSelector: Brisbane CBD row highlighted (active). State dot is amber (~) for RECOVERED_BUT_UNTRUSTED — not green, not dark red.
- A2 IncidentList: "No active incidents."
- A3 NotificationTrayAccess: Bell with badge "4." Notifications include reconnection event.
- A4 OperatorToolsMenu: Standard OPERATOR controls. All active.

**System Status Bar (48px)**

- ConstitutionalStateIndicator: amber "DEGRADED ●" with grey confidence dot (LOW confidence).
- Active Mode Indicator: "LIVE."

**Zone B — Primary Workspace**

- S1 Venue Identity Header: PlayerStateBadge: amber-orange badge "Reconnected — Unverified." This is distinct from the amber "Degraded" badge (different color and label). VenueNameBadge standard. No EmergencyContentBanner.
- S2 Player Health: Heartbeat — green (3s ago — device is back online). Corpus Hash — amber, "Hash pending verification." Clock Sync — green/amber (+1.2s within ±5s tolerance). Connection — green, "Ethernet · Strong · Reconnected 4m ago." Trust indicator on Corpus Hash row: amber, "Trust: UNVERIFIED."
- S3 Content & PRE: "Now Playing: Fallback: Default Loop (unverified state)" — the player serves fallback during unverified state. Resolution Level: L0 badge with "(unverified)" annotation. Active Overrides: "Override stack status: pending verification" (amber, FP-06 compliance — cannot claim "0 overrides" when state is unverified).
- S4 Active Overrides & Interventions: Amber informational banner at top of section — "▲ Player reconnected — corpus verification in progress. Override placement unavailable until verification completes." [Place Override +] = `[░Place Override +░]` — disabled. [Declare Incident] = active.
- S5: collapsed.

**Zone C — Right Panel (320px)**

C2 active (showing health indicators with RECOVERED_BUT_UNTRUSTED treatments). C4 advisory also active (operator likely toggled to C4). Both shown in wireframe panel area.

C2: Player State "~ Reconnected — Unverified" (amber-orange). Corpus Hash "~ Hash pending verification." Constitutional "~ DEGRADED ● (LOW)."

C4: DEGRADED advisory with basis signal listing the reconnection event.

### Component Placement

| Component | RECOVERED_BUT_UNTRUSTED treatment |
|-----------|----------------------------------|
| PlayerStateBadge (S1) | Amber-orange "Reconnected — Unverified" — not green, not dark red |
| CorpusHashStatusRow (S2) | Amber "Hash pending verification" |
| Zone A state dot | Amber (not green) |
| Constitutional state (status bar) | DEGRADED, LOW confidence |
| S3 PRE content | L0 fallback, "(unverified)" annotation |
| S3 Active Overrides | "Override stack status: pending verification" |
| S4 accumulation banner | Amber banner, non-dismissible |
| PlaceOverrideButton (S4) | Disabled — verification in progress |
| DeclareIncidentButton (S4) | Active |
| C2 Player State row | "Reconnected — Unverified" amber-orange |
| C2 Corpus Hash row | "Hash pending verification" amber |

### Interaction Notes

- [░Place Override +░]: disabled until verification completes. On hover/focus: tooltip "Override placement unavailable — corpus verification in progress."
- [Declare Incident]: active. An operator may declare an incident to formally track the recovery period.
- Zone C C2: useful for monitoring verification progress. The Corpus Hash row will update to "Verified ✓" (green) when backend push arrives confirming verification.
- "View full timeline in Replay →" (S5 if expanded): active. Reviewing the last events before reconnection is a valid investigation path.
- When verification completes (corpus hash WebSocket push): PlayerStateBadge transitions to green "Live", RECOVERED_BUT_UNTRUSTED treatment clears, [Place Override +] becomes active, all stale/unverified annotations clear, constitutional state may transition to HEALTHY (if no other degradation signals).

### Disabled-State Behavior

- [Place Override +]: disabled because player state is RECOVERED_BUT_UNTRUSTED. Tooltip: "Override placement unavailable — corpus verification in progress." The control is visible but non-interactive (FP-03 compliance — system cannot trust that an override will be applied correctly until corpus hash is verified).

### Replay-State Behavior

Same as WF-LO-01.

### Degraded-State Behavior

This wireframe IS the degraded/unverified state. The key distinction from WF-LO-04 (full offline) is:
- Heartbeat is CURRENT (player is communicating)
- Connection is green (link is restored)
- But corpus hash is PENDING — cannot assert content integrity
- Constitutional state is DEGRADED (not full EMERGENCY_FREEZE)
- The player is serving fallback content (L0) until trust is re-established

### Incident-State Behavior

No incident declared. Operator has option to declare if the reconnection was preceded by a significant outage. [Declare Incident] is active.

### Accessibility Notes

- PlayerStateBadge "Reconnected — Unverified": aria-label="Player state: Reconnected, awaiting corpus verification."
- Amber-orange color is not the sole signal — the text "Unverified" is always present.
- Corpus Hash row: aria-label="Corpus hash: verification pending."
- Disabled [Place Override +]: aria-disabled="true", aria-describedby="override-verification-reason." Reason element: "Override placement unavailable — corpus verification in progress."
- Reconnection notification: Pane A3 badge update announced via aria-live="polite" on the notification badge element.
- When state transitions away from RECOVERED_BUT_UNTRUSTED: PlayerStateBadge update announced via aria-live="polite."

---

## Cross-Wireframe Reference

### State Dot Colors Across All Wireframes

| Player Machine State | Zone A dot | PlayerStateBadge label | PlayerStateBadge color |
|----------------------|-----------|------------------------|----------------------|
| LIVE | ⬤ green | "Live" | Green |
| DEGRADED | ~ amber | "Degraded" | Amber |
| INCIDENT | ⬤ red | "Incident" | Red |
| OFFLINE | ◆ dark red | "Offline" | Dark red |
| RECOVERED_BUT_UNTRUSTED | ~ amber | "Reconnected — Unverified" | Amber-orange (distinct) |
| INITIALIZING | grey | "Initializing" | Grey |
| SYNCING | blue | "Syncing" | Blue |

### Constitutional State — System Status Bar Colors

| Constitutional State | Status Bar | Badge color | Mode Indicator |
|---------------------|-----------|-------------|---------------|
| HEALTHY | Standard | Green | "LIVE" |
| DEGRADED | Standard | Amber | "LIVE" |
| CONSTITUTIONAL_RISK | Standard | Orange | "LIVE" or "INCIDENT ACTIVE" |
| SHADOW_ONLY | Standard | Orange | "LIVE" |
| PRE_DISABLED | Standard | Orange | "LIVE" |
| READ_ONLY | Standard | Orange | "LIVE" |
| EMERGENCY_FREEZE | Red full bar | White text on red | "EMERGENCY FREEZE" |

### Zone A Border Colors by Constitutional State

| Constitutional State | Zone A left border |
|---------------------|-------------------|
| HEALTHY | None |
| DEGRADED | Amber 2px |
| CONSTITUTIONAL_RISK | Orange 4px |
| EMERGENCY_FREEZE | Red 4px |

### Controls Presence by Role — Section 4

| Control | VIEWER | OPERATOR | ADMIN |
|---------|--------|----------|-------|
| Place Override (L1–L4) | Absent | Present | Present |
| Place Override (L5) | Absent | Absent | Present |
| Place Override (L6) | Absent | Absent | Present (elevation required) |
| Declare Incident (S1–S5) | Absent | Present | Present |
| Declare Incident (S1 only) | Absent | Requires elevation | Present |
| Clear Override (L1–L4) | Absent | Present | Present |
| Clear Override (L5) | Absent | Absent | Present |
| Clear Override (L6) | Absent | Absent | Present (elevation required) |
| Handoff (A4) | Absent | Present | Present |
| Elevate Session | Absent | Present | Present |

### Disabled Controls During EMERGENCY_FREEZE (OPERATOR role)

| Control | Treatment |
|---------|-----------|
| Place Override L1–L5 | Disabled (visible) |
| Place Override L6 | Absent (OPERATOR never has L6) |
| Declare Incident | Disabled (visible) |
| Clear Override L1–L5 | Disabled (visible) |
| Clear Override L6 | Absent (OPERATOR never has L6) |
| Start Handoff | Disabled (visible) |
| Request Elevated Session | Disabled (visible) |
| Elevate Session (Status Bar) | Disabled (visible) |
| Zone C collapse [‹] | Disabled (visible) |

---

*End of LIVE-OPERATIONS-WIREFRAMES-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Depends on: CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md v1.0*
*All state restrictions and role gates derived from the canonical source; do not deviate without canonical source update*
*Accessibility notes are implementation guidance; engineering team must verify against WCAG 2.1 AA*
