# CMS-OPERATIONS-WIREFRAMES-v1

**Document type:** Implementation-grade wireframe specification
**Surface:** CMS Content Operations Surface
**Routes:** /cms/library, /cms/schedule, /cms/templates, /cms/sponsorship, /cms/delivery, /cms/history
**Authority:** UX/Design — converts CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2 into buildable screens
**Status:** CANONICAL

A UX designer must be able to recreate every screen from this document without consulting any other file.

---

## Layout Conventions (All Wireframes)

```
Viewport: 1440px wide
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px, full width)                                                │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px, fixed)  │ ZONE B (fluid, 1160px at 1440px viewport)                 │
│                        │                                                            │
│                        │                                                            │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

- Zone A is fixed-width, always visible, never collapses on CMS surface
- Zone B fills remaining width; contains tab navigation bar + active tab content
- No Zone C by default — Zone C (Preview Panel) is an overlay that slides in from the right when "Preview" is activated; it does not compress Zone B
- System Status Bar sits above both zones (full width, 48px height)
- CMS navigation in Zone A uses vertical stacking (not horizontal tabs)

---

## Zone A Reference (Used in All Wireframes)

The following Zone A structure is shared across all CMS wireframes. Each wireframe specifies which elements are active, highlighted, or modified by state.

```
┌─────────────────────────────────────┐
│ SYSTEM STATUS BAR INDICATOR         │
│  ● HEALTHY                          │  <- green dot + label
│    Constitutional state: NORMAL     │
├─────────────────────────────────────┤
│ PANE A1 — VENUE SELECTOR            │
│  Venue: ▼ [The Golf Club Drummoyne] │
│  [Change venue]                     │
├─────────────────────────────────────┤
│ PANE A2 — ACTIVE INCIDENT BANNER    │
│  (conditional — hidden when none)   │
│  ┌───────────────────────────────┐  │
│  │ INCIDENT ACTIVE               │  │
│  │ INC-2847 · S2                 │  │
│  │ [Open Incident Commander →]   │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│ CMS NAVIGATION                      │
│                                     │
│  ○ Content Library    /cms/library  │
│  ○ Schedule Builder   /cms/schedule │
│  ○ Templates          /cms/templates│
│  ○ Sponsor Mgmt    /cms/sponsorship │
│  ○ Delivery Status    /cms/delivery │
│  ○ Content History    /cms/history  │
│                                     │
│  Active item shown with left border │
│  ● active (solid left bar, bold)    │
│  ○ inactive (no bar)                │
├─────────────────────────────────────┤
│ PANE A3 — NOTIFICATION TRAY         │
│  🔔 Notifications  [3]              │  <- badge count
│  (click = tray overlay, no nav)     │
├─────────────────────────────────────┤
│ PANE A4 — OPERATOR TOOLS            │
│  Training mode:  [OFF]  ○           │
│  ─────────────────────────────────  │
│  J. Rodriguez                       │
│  Content Creator                    │
│  The Golf Club Drummoyne            │
│  [Logout]                           │
└─────────────────────────────────────┘
```

**Zone A states:**
- HEALTHY: green dot, all nav items active
- DEGRADED: amber dot, all nav items active, delivery-related warnings shown
- EMERGENCY_FREEZE: red dot, all nav items visually disabled (cursor: not-allowed), tooltip on hover: "Content authoring unavailable during Emergency Freeze"
- Training mode ON: amber dot next to toggle label "Training mode: ON", training indicator in nav area

---

## WF-CMS-01: CMS Operations — Content Library

**ID:** WF-CMS-01
**Surface:** CMS Content Operations Surface
**Route:** /cms/library
**Role:** Content Creator
**Active tab:** Tab 1 — Content Library
**State:** Normal / HEALTHY
**Purpose:** The operator browses and manages all media assets available for scheduling; uploads new content; monitors approval status.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [J. Rodriguez ▼]    48px status bar  │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — CONTENT LIBRARY                                  │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │ [Content Library]●  Schedule  Templates  Sponsor     │   │
│ VENUE                  │ │                     Delivery  History                │   │
│ ▼ Golf Club Drummoyne  │ └──────────────────────────────────────────────────────┘   │
│ [Change venue]         │                                                            │
│                        │ ┌──────────────────────────────────────────────────────┐   │
│ ─────────────────────  │ │ TAB 1 HEADER BAR                                     │   │
│ (no active incident)   │ │  🔍 [Search content...        ]  [Filters ▼]         │   │
│                        │ │  Type: [All ▼]  Tier: [All ▼]  Status: [All ▼]       │   │
│ CMS NAVIGATION         │ │  Delivery: [All ▼]  In use: [All ▼]  [Reset filters] │   │
│                        │ │                    [⊞ Grid] [≡ List]  [Upload content]│   │
│ ● Content Library      │ └──────────────────────────────────────────────────────┘   │
│ ○ Schedule Builder     │                                                            │
│ ○ Templates            │ ┌────────────────── CONTENT GRID ──────────────────────┐   │
│ ○ Sponsor Mgmt         │ │                                                      │   │
│ ○ Delivery Status      │ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│ ○ Content History      │ │ │ [THUMBNAIL]  │ │ [THUMBNAIL]  │ │ [THUMBNAIL]  │  │   │
│                        │ │ │  16:9 frame  │ │  16:9 frame  │ │  16:9 frame  │  │   │
│ ─────────────────────  │ │ │              │ │              │ │              │  │   │
│ 🔔 Notifications  [3]  │ │ │ Weekend Promo│ │ Happy Hour   │ │ Golf Tips    │  │   │
│                        │ │ │ [LIVE      ] │ │ [APPROVED  ] │ │ [DRAFT     ] │  │   │
│ ─────────────────────  │ │ │ Video · 0:30 │ │ Video · 0:15 │ │ Image · 0:10 │  │   │
│ Training mode: [OFF] ○ │ │ │ Tier: Venue  │ │ Tier: Venue  │ │ Tier: Venue  │  │   │
│                        │ │ │ Scheduled:   │ │ Scheduled:   │ │ Not scheduled│  │   │
│ J. Rodriguez           │ │ │ 3 slots      │ │ 1 slot       │ │              │  │   │
│ Content Creator        │ │ │ [⋯ Actions ▼]│ │ [⋯ Actions ▼]│ │ [Submit for  │  │   │
│ Golf Club Drummoyne    │ │ └──────────────┘ └──────────────┘ │  approval]   │  │   │
│ [Logout]               │ │                                   └──────────────┘  │   │
│                        │ │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│                        │ │ │ [THUMBNAIL]  │ │ [THUMBNAIL]  │ │ [THUMBNAIL]  │  │   │
│                        │ │ │              │ │              │ │              │  │   │
│                        │ │ │ Sponsor Reel │ │ Club Events  │ │ Bar Special  │  │   │
│                        │ │ │ [PENDING   ] │ │ [APPROVED  ] │ │ [REJECTED  ] │  │   │
│                        │ │ │ Video · 0:60 │ │ Loop · cont. │ │ Image · 0:15 │  │   │
│                        │ │ │ Tier: Venue  │ │ Tier: League │ │ Tier: Venue  │  │   │
│                        │ │ │ Awaiting     │ │ Scheduled:   │ │ See rejection│  │   │
│                        │ │ │ review       │ │ 2 slots      │ │ note         │  │   │
│                        │ │ │ [View sub.]  │ │ [⋯ Actions ▼]│ │ [⋯ Actions ▼]│  │   │
│                        │ │ └──────────────┘ └──────────────┘ └──────────────┘  │   │
│                        │ │                                                      │   │
│                        │ │  ── Archived content (hidden) ──  [Show archived ▼] │   │
│                        │ └──────────────────────────────────────────────────────┘   │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- System Status Bar indicator: green dot + "HEALTHY" + "Constitutional state: NORMAL"
- Venue selector (Pane A1): dropdown showing "Golf Club Drummoyne"; [Change venue] link below
- No Active Incident Banner (Pane A2): section hidden, no space consumed
- CMS Navigation: "Content Library" has left border highlight (active); all others inactive
- Notification tray (Pane A3): bell icon + badge showing count "3"
- Operator Tools (Pane A4): Training mode toggle OFF; operator name "J. Rodriguez", role "Content Creator", venue "Golf Club Drummoyne"; Logout button

---

### Tab Content Detail — Content Library

**Tab Header Bar (below tab strip):**
- Search field: full-width text input, placeholder "Search content...", debounced 300ms
- Filter row: Type dropdown (All/Video/Image/Loop), Tier dropdown (All/Platform/Network/League/Venue), Status dropdown (All/Draft/Pending Approval/Approved/Live/Archived), Delivery dropdown (All/Delivered/Pending/Failed/Stale), In use dropdown (All/Scheduled/Unscheduled)
- Reset filters button: right of filter row
- View toggle: grid icon (active) / list icon — right side of header bar
- Upload content button: primary button, right of view toggle; present in DOM for Content Creator role

**Content Grid (card view):**
Cards in a responsive grid, 3 columns at 1440px.

**Card anatomy (per card):**
```
┌──────────────────────────────────────────┐
│ [THUMBNAIL — 16:9, full card width]      │
│ ──────────────────────────────────────── │
│ Weekend Promo                 [LIVE    ] │  <- title left, status badge right
│ Video · 0:30                             │  <- type · duration
│ Tier: Venue                              │
│ Scheduled on 3 slot(s)  [View slots →]   │  <- in-use link
│ ──────────────────────────────────────── │
│ [Preview] [Edit] [Archive]  [⋯ More ▼]  │  <- action row
└──────────────────────────────────────────┘
```

**Status badge colors:**
- DRAFT: grey background, dark text
- PENDING_APPROVAL: amber background, dark text — actions row replaced with "[View submission]" only
- APPROVED: blue background, white text
- LIVE: green background, white text
- REJECTED: red background, white text — rejection note visible below status badge on card expand

**PENDING_APPROVAL card restriction:** Edit and Archive actions are absent from the DOM. Only "View submission" and "Preview" appear. The submitting operator (J. Rodriguez) does not see Approve/Reject controls on their own submission.

**REJECTED card:** A rejection note appears as an expandable section below the card metadata: "Rejection note: [operator note text] — [reviewer name] [timestamp]". A "Revise and resubmit" button appears, which opens the edit form pre-populated with existing content.

**Archived section:** Collapsed by default. "Show archived" toggle at bottom of grid expands to show archived items. Archived cards are visually muted (reduced opacity, strikethrough on title).

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Top of Zone A, 48px band |
| VenueSelector | Pane A1, below status indicator |
| CMSNavigationList | Zone A, below venue selector |
| NotificationTrayBell | Pane A3, Zone A lower section |
| OperatorTools (training toggle, identity, logout) | Pane A4, Zone A bottom |
| TabStripBar | Top of Zone B, below system bar |
| ContentFilterBar | Below tab strip, full Zone B width |
| ViewToggle (grid/list) | Right of filter bar |
| UploadContentButton | Far right of filter bar |
| ContentCardGrid | Main Zone B content area |
| ArchivedToggle | Below card grid |

---

### Interaction Notes

**Upload content flow:**
1. Operator clicks "Upload content" button
2. Slide-over panel opens from right, overlaying Zone B (does not change route)
3. Form fields: Title (required), Content type (dropdown), File upload (drag-drop or picker), Duration (auto-populated), Tier (dropdown, restricted to operator's authority — no options above Venue for Content Creator), Description (optional), Tags (optional)
4. File upload shows progress bar during transfer
5. Submit: content enters DRAFT state; slide-over closes; toast "Content '[TITLE]' uploaded successfully. Status: DRAFT."
6. New card appears in grid with DRAFT badge

**"Submit for approval" on DRAFT item:**
1. Operator clicks "Submit for approval" on card actions
2. Confirmation dialog: "Submit '[TITLE]' for review? Once submitted, editing is locked until the reviewer acts. [Cancel] [Submit]"
3. On confirm: card badge changes to PENDING_APPROVAL (amber); edit/archive actions replaced with "View submission"

**Archive flow (APPROVED/LIVE item):**
1. Operator clicks "Archive" in card actions
2. If item is referenced by active slots: modal warning "This content is referenced by [N] active schedule slot(s). Archive anyway? Slots referencing archived content will move to CONFLICT status and require reassignment. [Cancel] [Archive anyway]"
3. If not in use: simple confirmation dialog
4. On confirm: card moves to archived section; status changes to ARCHIVED

**View slots link:**
- Clicking "Scheduled on [N] slot(s)" on a card opens a slide-over panel listing schedule slots using this content; each entry shows slot name, venue, time range, approval status, and a "Go to slot →" link that navigates to /cms/schedule with that slot selected

**Grid/list view toggle:**
- Grid view: card layout as above (default)
- List view: table with columns: Thumbnail (small), Title, Type, Tier, Status, Duration, Delivery Status, Uploaded by, Upload date, Last modified, Actions

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- "Upload content" button is disabled (greyed out, cursor: not-allowed); tooltip: "Content authoring unavailable during Emergency Freeze"
- "Submit for approval" absent from all cards
- "Edit" action absent from all cards
- "Archive" action absent from all cards
- "View submission", "Preview", "View slots" remain active (read-only actions unaffected)
- A red banner appears across the top of Zone B: "EMERGENCY FREEZE ACTIVE — Content authoring is suspended. Read-only access only."

**PENDING_APPROVAL state (individual item):**
- Edit and archive actions absent from DOM for that specific card
- All other cards unaffected

---

### Replay-State Behavior

This surface is not a replay surface. CMS operates in planning/authoring mode only. If the operator navigates to /cms while a Replay Investigation session is active in another workspace, the CMS surface renders normally; it has no replay context to display. The "PREVIEW — not live data" watermark only appears in Zone C when a PRE preview is explicitly run.

---

### Degraded-State Behavior

- Zone A status indicator: amber dot + "DEGRADED"
- Content cards that have FAILED or STALE delivery show a delivery warning icon on the card (amber triangle for STALE, red for FAILED)
- Content Library itself remains fully functional for authoring; degradation affects delivery visibility only
- If backend is unreachable (offline): "Upload content" button disabled with tooltip "Upload requires a live connection"; existing DRAFT edits preserved with "Unsaved — offline" flag; toast on reconnect: "Connection restored. [Sync pending changes]"

---

### Incident-State Behavior

- Pane A2 Active Incident Banner appears in Zone A with incident ID and severity
- Clicking banner navigates to Incident Commander surface; does not close or alter CMS state
- CMS authoring continues normally during S3–S5 incidents
- During S1 incidents: EMERGENCY_FREEZE may be active — see Disabled-State Behavior above
- During S2: amber banner in Zone A; authoring continues; delivery status may show degraded states

---

### Accessibility Notes

- All card actions accessible via keyboard Tab navigation; action buttons within cards in tab order
- Status badges use both color and text label (not color alone) to convey state
- Upload drop target has visible focus outline and keyboard-accessible file picker fallback
- Search field has label "Search content" (visually hidden via sr-only if design chooses placeholder-only approach, but aria-label must be set)
- Filter dropdowns have aria-label matching visible label text
- "Show archived" toggle has aria-expanded state
- Card thumbnails have alt text matching content title + type (e.g., "Weekend Promo — Video thumbnail")

---

## WF-CMS-02: CMS Operations — Schedule Builder — 72h Warning State

**ID:** WF-CMS-02
**Surface:** CMS Content Operations Surface
**Route:** /cms/schedule
**Role:** Content Creator
**Active tab:** Tab 2 — Schedule Builder
**State:** Normal / HEALTHY — slot within 72h warning zone visible
**Purpose:** The operator builds content schedules; a near-term slot (within 72h but outside 24h) triggers an amber warning; the 72h safe boundary banner is always visible.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [J. Rodriguez ▼]    48px status bar  │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — SCHEDULE BUILDER                                 │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │  Content Library  [Schedule Builder]●  Templates    │   │
│ VENUE                  │ │  Sponsor  Delivery  History                          │   │
│ ▼ Golf Club Drummoyne  │ └──────────────────────────────────────────────────────┘   │
│ [Change venue]         │                                                            │
│                        │ ┌──────────────────────────────────────────────────────┐   │
│ ─────────────────────  │ │ ⏱ 72-HOUR DELIVERY WINDOW BANNER (amber, permanent) │   │
│ (no active incident)   │ │   Content is safe to schedule for play after:        │   │
│                        │ │   THURSDAY 5 JUNE 2026, 14:23 AEST                  │   │
│ CMS NAVIGATION         │ │   Content scheduled before this time requires        │   │
│                        │ │   verified pre-delivery or may not reach venues.     │   │
│ ○ Content Library      │ └──────────────────────────────────────────────────────┘   │
│ ● Schedule Builder     │                                                            │
│ ○ Templates            │ ┌──── SCHEDULE HEADER ─────────────────────────────────┐   │
│ ○ Sponsor Mgmt         │ │ [< Prev]  MON 2 JUNE 2026  [Next >]  [Date picker]  │   │
│ ○ Delivery Status      │ │ Scope: [Venue: Golf Club Drummoyne ▼]                │   │
│ ○ Content History      │ │ View: [Timeline ●] [List ○]         [+ Add slot]     │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│ ─────────────────────  │                                                            │
│ 🔔 Notifications  [3]  │ ┌──── TIMELINE CANVAS ─────────────────────────────────┐   │
│                        │ │       08:00  10:00  12:00  14:00  16:00  18:00  20:00 │   │
│ ─────────────────────  │ │                           ¦ ←72h boundary            │   │
│ Training mode: [OFF] ○ │ │ Zone 1│                   ¦ ░░░░░░[SLOT A ⚠]░░░░░░  │   │
│                        │ │ Zone 2│    [  SLOT B  ]   ¦                          │   │
│ J. Rodriguez           │ │ Zone 3│                   ¦        [SLOT C]          │   │
│ Content Creator        │ │                                                      │   │
│ Golf Club Drummoyne    │ │ SLOT A = amber diagonal stripe (within 72h)          │   │
│ [Logout]               │ │ SLOT B = normal blue (APPROVED, >72h from now)       │   │
│                        │ │ SLOT C = normal blue (APPROVED, >72h from now)       │   │
│                        │ │                                                      │   │
│                        │ │ ¦ = dashed red vertical line at 72h boundary         │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│                        │ ┌──── SLOT DETAIL PANEL (expands on slot click) ────────┐  │
│                        │ │ SLOT A — "Happy Hour Promo"                    [×]    │  │
│                        │ │ Content:   Happy Hour Special                         │  │
│                        │ │ Time:      Mon 2 June 16:00 → 20:00 AEST             │  │
│                        │ │ Tier:      Venue                                      │  │
│                        │ │ Status:    DRAFT                                      │  │
│                        │ │ Venue:     Golf Club Drummoyne                        │  │
│                        │ │                                                       │  │
│                        │ │ ┌─────────────────────────────────────────────────┐  │  │
│                        │ │ │ ⚠  72-HOUR DELIVERY WARNING                     │  │  │
│                        │ │ │    This slot is within the 72-hour delivery      │  │  │
│                        │ │ │    window. Verify delivery is in progress        │  │  │
│                        │ │ │    before submitting.                            │  │  │
│                        │ │ │    Time until play: 1d 4h 37m                   │  │  │
│                        │ │ └─────────────────────────────────────────────────┘  │  │
│                        │ │                                                       │  │
│                        │ │ [Edit slot]  [Submit for approval ⚠]  [Delete]       │  │
│                        │ └───────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

Same base structure as WF-CMS-01. Active nav item: "Schedule Builder" (left border highlight). No active incident banner.

---

### 72-Hour Warning Specifications

**Safe Scheduling Banner (permanent, non-dismissible):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⏱  72-hour delivery window                                                   │
│    Content is safe to schedule for play after:                               │
│    THURSDAY 5 JUNE 2026, 14:23 AEST                                          │
│    Content scheduled to play before this time requires verified              │
│    pre-delivery or may not reach venues in time.                             │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Background: amber (#FFF3CD or equivalent token)
- Left border: 4px solid amber
- Icon: clock/timer symbol
- Timestamp: computed as current system time + 72h, in venue local timezone
- Not dismissible: no close button, no collapse control
- Updates every 60 seconds (timestamp ticks forward)

**72h Boundary Line on Timeline:**
```
       08:00  10:00  12:00  14:23  16:00  18:00  20:00
                             ¦
                             ¦  <- dashed red vertical line
                             ¦     label: "72h" at top of line
```
- Rendered as a CSS border-left dashed, red, spanning full timeline height
- Label "72h" pinned to top of line with a small flag marker
- Line position moves with time (updated each 60s poll cycle)

**Slot with amber 72h warning (between 72h and 24h from play):**
```
┌────────────────────────────────────┐
│ ░░░░ Happy Hour Promo ░░░░░░░░░░░  │  <- amber diagonal stripe pattern
│      16:00 → 20:00         ⚠      │  <- warning icon right-aligned
└────────────────────────────────────┘
```
- Slot bar: amber diagonal stripe overlaid on status color (CSS: repeating-linear-gradient at 45deg)
- Warning triangle icon (⚠) in top-right corner of slot bar
- Tooltip on hover: "Within 72-hour delivery window — verify delivery before submitting"

**Slot detail panel — 72h warning box:**
```
┌───────────────────────────────────────────────────────┐
│ ⚠  This slot is within the 72-hour delivery window.  │
│    Verify delivery is in progress before submitting.  │
│    Time until play: 1d 4h 37m                        │
│    [Learn about delivery requirements →]              │
└───────────────────────────────────────────────────────┘
```
- Background: amber
- Positioned above action buttons in the detail panel
- "Submit for approval" button remains present but carries ⚠ icon to signal operator acknowledgement needed

**Approval confirmation dialog when slot is within 72h:**
```
┌─────────────────────────────────────────────────────────┐
│ Submit for approval?                                    │
│                                                         │
│ Slot: "Happy Hour Promo"                                │
│ Time: Mon 2 June 16:00 → 20:00 AEST                    │
│ Venue: Golf Club Drummoyne                              │
│                                                         │
│ ⚠ Warning: This slot is within the 72-hour delivery    │
│   window. Delivery may not reach all venues before      │
│   play time.                                            │
│                                                         │
│ Once submitted, editing is locked until reviewer acts.  │
│                                                         │
│              [Cancel]  [Submit with warning]            │
└─────────────────────────────────────────────────────────┘
```

---

### Tab Content Detail — Schedule Builder

**Schedule Header Bar:**
- Date navigation: [< Prev] date label [Next >] with calendar icon date picker
- Scope selector: "Venue: [Golf Club Drummoyne ▼]" — switches between per-venue and per-zone views
- View mode toggle: Timeline (radio) / List (radio)
- "+ Add slot" button: primary action, opens slot creation form slide-over

**Timeline Canvas:**
- Horizontal axis: hours 00:00–23:59, scrollable
- Vertical axis: one row per content zone or screen (configurable via scope selector)
- Slot bars: colored horizontal rectangles spanning their time range
- Slot colors:
  - Grey fill: DRAFT
  - Amber fill: PENDING_APPROVAL
  - Blue fill: APPROVED
  - Green fill: LIVE
- Conflict state: red outline on both overlapping slots
- 72h boundary: dashed red vertical line

**Content Library Sidebar (collapsed by default, expand via toggle):**
When expanded: a 240px right panel opens within Zone B (not Zone C) showing a list of APPROVED content items that can be dragged onto the timeline.

**Slot creation via "+ Add slot":**
Slide-over form:
1. Slot name (required, max 80 chars)
2. Content item — searchable dropdown showing APPROVED content only; note below: "Only approved content may be scheduled."
3. Start time: date + time picker in venue local timezone
4. End time: date + time picker (or duration auto-compute)
5. Venue assignment: multi-select (scope-restricted to operator's venues)
6. Override level: dropdown — "No override (standard)" or "L4 — Sponsor (constitutional maximum)" — no L5/L6 options
7. Repeat: None / Daily / Weekly / Custom

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top |
| 72hDeliveryBanner | Zone B, above schedule header, below tab strip |
| ScheduleHeaderBar | Zone B, below 72h banner |
| TimelineCanvas | Main Zone B content area |
| 72hBoundaryLine | Overlay on TimelineCanvas |
| SlotBar (per slot) | Within TimelineCanvas rows |
| SlotDetailPanel | Below TimelineCanvas, expands on slot click |
| AddSlotButton | Schedule header bar, right side |
| ContentLibrarySidebar | Zone B far right, collapsible |

---

### Interaction Notes

**Drag-and-drop slot creation:**
1. Operator expands Content Library Sidebar
2. Drags content card from sidebar to timeline row at desired time position
3. Drop creates a DRAFT slot; duration auto-populated from content metadata
4. Resize handles appear on both ends of slot bar; drag to adjust time range
5. Inline conflict detection runs on drop; overlapping slot gets red outline immediately

**Slot click → detail panel:**
1. Click slot bar: detail panel expands below timeline
2. Panel shows all slot fields (read-only) plus action buttons appropriate to current state and role
3. Click elsewhere on canvas: panel collapses

**72h warning acknowledgement:**
- Submission with 72h warning: operator must click "Submit with warning" (not just "Submit") to acknowledge
- Warning state does not block submission — only the <24h state blocks

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- "+ Add slot" button disabled, cursor: not-allowed, tooltip: "Content authoring unavailable during Emergency Freeze"
- Drag-and-drop disabled
- "Submit for approval" absent from all DRAFT slot detail panels
- "Edit slot" absent from all slot detail panels
- Red banner above 72h banner: "EMERGENCY FREEZE ACTIVE — Content authoring is suspended. Read-only access only."
- Timeline read-only; slots visible for inspection

**PENDING_APPROVAL slot:**
- Slot bar shows amber lock icon
- Detail panel shows all fields read-only
- Only "Withdraw submission" (submitter only) and "Preview" available

---

### Replay-State Behavior

Not a replay surface. CMS timeline shows the planned schedule; it is never populated with replay data. If a slot's delivery is being investigated in a replay session on another surface, the slot in this timeline shows its current state normally — no replay mode indicator propagates here.

---

### Degraded-State Behavior

- Zone A: amber dot + "DEGRADED"
- 72h banner remains amber (its own color; no additional degraded treatment needed)
- Slots for STALE or FAILED venues: an amber delivery warning icon appears on the slot bar (distinct from the 72h stripe); tooltip: "Delivery status at [VENUE] is [STALE/FAILED] — verify before play time"
- Timeline canvas continues to function; degradation only affects delivery confidence signals

---

### Incident-State Behavior

- Pane A2 incident banner shown in Zone A
- S1/EMERGENCY_FREEZE: see Disabled-State Behavior
- S2–S5: authoring continues normally; incident banner persists in Zone A
- The 72h banner remains visible and unchanged during all incident states

---

### Accessibility Notes

- Timeline canvas: keyboard navigation — Tab to focus timeline, arrow keys to move focus across slots, Enter to open slot detail panel
- Slot bars: role="button", aria-label="[SLOT NAME] [TIME RANGE] [STATUS]"
- 72h boundary line: aria-hidden="true" (decorative); 72h constraint is communicated via the banner text (screen-readable) and the slot detail warning text
- Drag-and-drop: keyboard-accessible alternative is the "+ Add slot" form button
- Date navigation: prev/next buttons have aria-label="Previous day" / "Next day"; date picker is keyboard-navigable
- Warning badges: both icon and text present; not icon-only

---

## WF-CMS-03: CMS Operations — Schedule Builder — Submit Blocked (<24h)

**ID:** WF-CMS-03
**Surface:** CMS Content Operations Surface
**Route:** /cms/schedule
**Role:** Content Creator
**Active tab:** Tab 2 — Schedule Builder
**State:** Normal / HEALTHY — slot within <24h hard block zone
**Purpose:** The operator attempts to submit a schedule slot that starts within 24 hours; submission is blocked; the UI shows the exact error state and the operator's available options.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [J. Rodriguez ▼]    48px status bar  │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — SCHEDULE BUILDER                                 │
│                        │                                                            │
│ ● HEALTHY              │ ┌──── 72h BANNER (amber, permanent) ───────────────────┐   │
│ Constitutional: NORMAL │ │ ⏱  Safe scheduling after: THU 5 JUN 14:23 AEST      │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│ VENUE                  │                                                            │
│ ▼ Golf Club Drummoyne  │ ┌──── SCHEDULE HEADER ─────────────────────────────────┐   │
│ [Change venue]         │ │ [< Prev]  WED 4 JUNE 2026  [Next >]  [Date picker]  │   │
│                        │ │ Scope: [Venue: Golf Club Drummoyne ▼]  [+ Add slot]  │   │
│ ─────────────────────  │ └──────────────────────────────────────────────────────┘   │
│ (no active incident)   │                                                            │
│                        │ ┌──── TIMELINE CANVAS ─────────────────────────────────┐   │
│ CMS NAVIGATION         │ │     10:00   12:00   13:47   16:00   18:00   20:00    │   │
│                        │ │               ¦CRITICAL ¦                            │   │
│ ○ Content Library      │ │ Zone 1│        ¦ ████████[SLOT X]████████            │   │
│ ● Schedule Builder     │ │ Zone 2│        ¦                                     │   │
│ ○ Templates            │ │                                                      │   │
│ ○ Sponsor Mgmt         │ │ SLOT X = red solid outline + amber diagonal stripe   │   │
│ ○ Delivery Status      │ │ Current time = 13:47; Slot X starts at 15:00 (1h13m) │   │
│ ○ Content History      │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│ ─────────────────────  │ ┌──── SLOT DETAIL PANEL — SLOT X ──────────────────────┐  │
│ 🔔 Notifications  [3]  │ │ SLOT X — "Tuesday Lunch Promo"                 [×]   │  │
│                        │ │ Content:   Lunch Special Video                        │  │
│ ─────────────────────  │ │ Time:      Wed 4 June 15:00 → 17:00 AEST             │  │
│ Training mode: [OFF] ○ │ │ Tier:      Venue                                     │  │
│                        │ │ Status:    DRAFT                                      │  │
│ J. Rodriguez           │ │ Venue:     Golf Club Drummoyne                        │  │
│ Content Creator        │ │                                                       │  │
│ Golf Club Drummoyne    │ │ ┌─────────────────────────────────────────────────┐  │  │
│ [Logout]               │ │ │ ✗  SUBMISSION BLOCKED                           │  │  │
│                        │ │ │    This slot starts in less than 24 hours.      │  │  │
│                        │ │ │    Submission is blocked. Adjust the start       │  │  │
│                        │ │ │    time or manually verify delivery.             │  │  │
│                        │ │ │    Time until play: 1h 13m                      │  │  │
│                        │ │ │                                                  │  │  │
│                        │ │ │    [Trigger emergency re-delivery →]             │  │  │
│                        │ │ └─────────────────────────────────────────────────┘  │  │
│                        │ │                                                       │  │
│                        │ │ [Edit slot]  [Delete]                                │  │
│                        │ │ (Submit for approval is absent from DOM)              │  │
│                        │ └───────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

Same base structure. Active: "Schedule Builder". No incident banner.

---

### Slot Error State — Complete Specification

**Slot bar treatment (< 24h from play):**
```
┌──────────────────────────────────────────────────────┐
│ ░░░░░░░░ Tuesday Lunch Promo ░░░░░░░░░░░░░░░░░░░░░░ │  <- amber diagonal stripe
│          15:00 → 17:00                          ✗   │  <- red X icon right
└──────────────────────────────────────────────────────┘
Outer border: 2px solid red (#DC3545 or equivalent error token)
```

**Slot detail error box:**
```
┌───────────────────────────────────────────────────────────────┐
│ ✗  This slot starts in less than 24 hours.                    │
│    Submission is blocked. Adjust the start time or            │
│    manually verify delivery.                                  │
│                                                               │
│    Time until play: 1h 13m                                    │
│                                                               │
│    [Trigger emergency re-delivery →]                          │
└───────────────────────────────────────────────────────────────┘
Background: red (#FFF5F5 or error-tint token)
Left border: 4px solid red
```

**"Submit for approval" button:** Absent from DOM entirely (not disabled — absent). This prevents any mechanism (keyboard, screen reader) from triggering submission for a sub-24h slot.

**Available actions in detail panel:**
- "Edit slot" — opens slot form to adjust start time to a future-safe time
- "Delete" — removes the DRAFT slot entirely
- "Trigger emergency re-delivery →" — link to Tab 5 Delivery Status for this venue; available to Venue Admin and above only; for Content Creator, this link is absent and replaced with: "Contact your Venue Admin to trigger emergency re-delivery."

**< 6h variant (critical state):**
When time until play is under 6 hours:
```
┌───────────────────────────────────────────────────────────────┐
│ ✗  CRITICAL: Content cannot be delivered in time through      │
│    normal corpus sync.                                        │
│    Time until play: [N] hours [N] minutes                    │
│    Contact your Network Admin for emergency delivery options. │
└───────────────────────────────────────────────────────────────┘
```
Slot bar gains a CSS pulse animation (opacity oscillates at ≤ 1Hz) in addition to red outline + amber diagonal stripe.

---

### 72-Hour Warning Specifications

Same safe scheduling banner as WF-CMS-02. The 72h boundary line on this day's timeline view is behind SLOT X (slot X is entirely within the danger zone — to the left of the 72h line).

---

### Component Placement

Same as WF-CMS-02 with the following differences:
- SlotBar: error state rendering active
- SlotDetailPanel: error box replacing warning box; Submit button absent from DOM
- EmergencyRedeliveryLink: present in error box (role-gated: Venue Admin and above)

---

### Interaction Notes

**Editing to resolve the block:**
1. Operator clicks "Edit slot"
2. Slot form opens pre-populated
3. Start time field shows inline validation: "Start time must be at least 24 hours from now (currently blocked: [TIMESTAMP]). Minimum allowed start: [TIMESTAMP+24h]"
4. Operator adjusts start time to a valid future time
5. On save: if new time is >72h from now — slot returns to normal state, Submit button re-appears
6. On save: if new time is between 24h and 72h — slot returns to amber warning state, Submit button re-appears with ⚠ acknowledgement

**"Trigger emergency re-delivery" link behavior:**
- Navigates to /cms/delivery with the venue pre-selected and affected item highlighted
- This is navigation, not a direct action; no confirmation dialog at this step

---

### Disabled-State Behavior

**EMERGENCY_FREEZE adds to the blocked state:**
- Red "EMERGENCY FREEZE" banner shown above the slot error box
- "Edit slot" also becomes disabled during EMERGENCY_FREEZE
- Only "Delete" remains available (deleting a DRAFT slot is always permitted)

---

### Replay-State Behavior

Not a replay surface. No replay-specific modifications.

---

### Degraded-State Behavior

The sub-24h block is not affected by degraded state. Degraded state (amber dot in Zone A) may co-exist with the sub-24h block, but they are independent conditions.

---

### Incident-State Behavior

Same as WF-CMS-02. Incident banner in Zone A; authoring continues; the sub-24h block is a content delivery constraint independent of incident state.

---

### Accessibility Notes

- Error box uses role="alert" so screen readers announce it when it renders
- "Submit for approval" being absent from DOM means it does not appear in the tab order or to screen readers — this is intentional and correct
- Error icon (✗) paired with error text; not icon-only
- Pulse animation on <6h slot bar: prefers-reduced-motion media query must disable the pulse; the red border remains visible without animation
- "Trigger emergency re-delivery" link: aria-label="Trigger emergency re-delivery for [VENUE NAME]"

---

## WF-CMS-04: CMS Operations — Template Management

**ID:** WF-CMS-04
**Surface:** CMS Content Operations Surface
**Route:** /cms/templates
**Role:** League Admin
**Active tab:** Tab 3 — Template Management
**State:** Normal / HEALTHY
**Purpose:** The operator manages scheduling and sponsorship templates; reviews confidence signals; creates, edits, archives templates within their tier authority.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [A. Patel ▼]       48px status bar  │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — TEMPLATE MANAGEMENT                              │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │  Content Library  Schedule  [Templates]●  Sponsor   │   │
│ VENUE                  │ │  Delivery  History                                   │   │
│ ▼ Drummoyne League     │ └──────────────────────────────────────────────────────┘   │
│ [Change scope]         │                                                            │
│                        │ ┌──── TAB 3 HEADER BAR ────────────────────────────────┐   │
│ ─────────────────────  │ │  Type: [All ▼]  Tier: [All ▼]  Status: [All ▼]      │   │
│ (no active incident)   │ │  Active/Archived: [Active ▼]         [Create template]│  │
│                        │ └──────────────────────────────────────────────────────┘   │
│ CMS NAVIGATION         │                                                            │
│                        │ ┌──── TEMPLATE TABLE ──────────────────────────────────┐   │
│ ○ Content Library      │ │                                                      │   │
│ ○ Schedule Builder     │ │ NAME ↓        TYPE      TIER    REVIEW   USAGE  CONF │   │
│ ● Templates            │ │ ─────────────────────────────────────────────────── │   │
│ ○ Sponsor Mgmt         │ │ Weekend Sched T-01:Sched League  CURRENT   12   HIGH │   │
│ ○ Delivery Status      │ │ [Preview][Edit][Duplicate][Archive]                  │   │
│ ○ Content History      │ │ ─────────────────────────────────────────────────── │   │
│                        │ │ Happy Hour    T-01:Sched Venue   CURRENT   5    HIGH │   │
│ ─────────────────────  │ │ [Preview][Edit][Duplicate][Archive]                  │   │
│ 🔔 Notifications  [2]  │ │ ─────────────────────────────────────────────────── │   │
│                        │ │ Sponsor Block T-02:Spon  League  ⚠REVIEW   8    MED  │   │
│ ─────────────────────  │ │ [Preview][Edit][Duplicate][Archive]                  │   │
│ Training mode: [OFF] ○ │ │ ─────────────────────────────────────────────────── │   │
│                        │ │ Emergency     T-03:Emrg  League  ✗REQUIRED 3    LOW  │   │
│ A. Patel               │ │ [Preview][Edit][Duplicate][Archive]                  │   │
│ League Admin           │ │ ─────────────────────────────────────────────────── │   │
│ Drummoyne League       │ │ Event Special T-05:Event Venue   CURRENT   1    HIGH │   │
│ [Logout]               │ │ [Preview][Edit][Duplicate][Archive]                  │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│                        │ ┌──── TEMPLATE DETAIL SLIDE-OVER (on row click) ────────┐  │
│                        │ │ Weekend Schedule Template          [×]                 │  │
│                        │ │ Type: T-01 Scheduling   Tier: League                  │  │
│                        │ │ Review: CURRENT  · Next review: 1 Sep 2026            │  │
│                        │ │                                                        │  │
│                        │ │ Confidence:                                            │  │
│                        │ │   Review recency:     ✓ Reviewed 12 days ago          │  │
│                        │ │   Applications:       ✓ Applied 12 times, 0 incidents │  │
│                        │ │   Assumption stability: ✓ No conditional assumptions  │  │
│                        │ │   Blast radius:       ✓ Zone-limited                  │  │
│                        │ │   PRE match rate:     ✓ 99% match rate                │  │
│                        │ │   OVERALL:            HIGH                             │  │
│                        │ │                                                        │  │
│                        │ │ Slot Definitions:                                      │  │
│                        │ │   Slot A — {sponsor_content} — 18:00→22:00 — L4       │  │
│                        │ │   Slot B — {event_content}   — 14:00→18:00 — no ovrd  │  │
│                        │ │                                                        │  │
│                        │ │ Last modified: A. Patel · 21 May 2026 14:30            │  │
│                        │ │ Lineage: Created from scratch                          │  │
│                        │ │ [View modification history ▼]                          │  │
│                        │ │ [View deployment history ▼]                            │  │
│                        │ │                                                        │  │
│                        │ │ [Edit template]  [Duplicate]  [Archive]               │  │
│                        │ └────────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- Status indicator: green dot + "HEALTHY"
- Venue selector shows league scope: "Drummoyne League" with [Change scope] link
- No active incident banner
- Active nav: "Templates" with left border
- Notification badge: [2]
- Operator identity: "A. Patel / League Admin / Drummoyne League"

---

### Tab Content Detail — Template Management

**Tab Header Bar:**
- Type filter: dropdown (All / T-01 Scheduling / T-02 Sponsorship / T-03 Emergency / T-04 Onboarding / T-05 Event / T-06 Layout / T-07 Escalation)
- Tier filter: dropdown (All / Platform / Network / League / Venue) — for League Admin, Platform and Network tiers are visible but items at those tiers are read-only
- Review status filter: dropdown (All / Current / Review Recommended / Review Required)
- Active/Archived toggle: dropdown (Active / Archived / Both)
- "Create template" button: primary, right of header bar; available to League Admin and above

**Template Table:**
Columns: Name | Type badge | Tier badge | Review status | Usage count | Confidence badge | Actions row (below or inline)

Sortable by clicking any column header. Default sort: Last modified, descending.

**Review status visual encoding:**
- CURRENT: green checkmark + "CURRENT"
- REVIEW_RECOMMENDED: amber triangle + "⚠ REVIEW"
- REVIEW_REQUIRED: red X + "✗ REQUIRED" — row has amber left border to draw attention

**Confidence badge encoding:**
- HIGH: green badge
- MEDIUM: amber badge
- LOW: red badge
- UNVERIFIED: grey badge

**Actions per row (inline below row, or accessible via row click):**
- Preview: opens read-only slide-over
- Edit: opens editable slide-over (role-gated — read-only for tiers above operator's authority)
- Duplicate: creates a copy of the template in DRAFT state; prompt for new name
- Archive: confirmation dialog required

**Template Detail Slide-Over:**
Opens from the right, overlays Zone B (does not change route or push content). Width: 480px. Contains:
1. Header: template name (editable by authorized operator), type badge, tier badge
2. Review status + next review date
3. Confidence indicator section (multi-signal, as above)
4. Slot Definitions expandable section
5. Content Rules expandable section
6. Tier Constraints expandable section
7. Lineage section (origin, author, timestamp)
8. Modification history (collapsible)
9. Deployment history (collapsible, links to replay records)
10. Action buttons: Edit / Duplicate / Archive

**"Derived from" badge (child templates):**
If a template is derived from a parent, a badge appears below the template name: "Derived from: [PARENT_TEMPLATE_NAME] →" (clickable, opens side-by-side comparison view).

**Parent updated banner:**
```
┌────────────────────────────────────────────────────────────┐
│ ⚠  Parent template updated 3 days ago.                    │
│    2 field(s) in the parent have changed since this        │
│    template was derived.  [Review differences →]           │
└────────────────────────────────────────────────────────────┘
```

**REVIEW_REQUIRED template row treatment:**
Row has amber left border (4px). Actions include a prominent "Review now" button in addition to standard actions.

---

### Create Template Flow

Triggered by "Create template" button. Opens a full slide-over form:

```
┌──────────────────────────────────────────────────────────────┐
│ Create Template                                       [×]    │
│ ─────────────────────────────────────────────────────────── │
│ Template name *                                              │
│ [                                                    ]       │
│                                                              │
│ Type *          Tier *                                       │
│ [Scheduling ▼]  [League ▼]                                   │
│                 (Platform/Network options absent for         │
│                  League Admin — not disabled, absent)        │
│                                                              │
│ Governance level                                             │
│ [No override ▼]  (L5/L6 absent if sponsor type selected)    │
│                                                              │
│ Description * (min 50 characters)                            │
│ [                                                          ] │
│ [                                                          ] │
│                                                              │
│ Context specificity * (select all that apply)                │
│ [×] Golf Club  [ ] Licensed Club  [ ] Hotel                  │
│ [ ] Sports Bar  [ ] Other                                    │
│                                                              │
│ + Add slot definition                                        │
│  Slot A: [content rule...] [time range] [tier constraint]   │
│                                                              │
│ Review cycle: [90 days ▼]                                    │
│                                                              │
│              [Cancel]  [Save template]                       │
└──────────────────────────────────────────────────────────────┘
```

Validation errors appear inline below the relevant field. "Save template" is disabled until all required fields pass validation.

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top |
| TemplateFilterBar | Zone B tab header |
| CreateTemplateButton | Zone B tab header, right |
| TemplateTable | Main Zone B content area |
| TemplateDetailSlideOver | Overlays Zone B right side |
| ConfidenceIndicator | Inside TemplateDetailSlideOver |
| CreateTemplateSlideOver | Overlays Zone B (opened by Create button) |

---

### Interaction Notes

**Template edit (tier-authority enforcement):**
- Fields governing tier and governance level are read-only in the edit form if the template tier is above the operator's authority
- "Edit template" button not shown for templates above operator's tier; only "Preview" and "Duplicate" shown

**Duplicate:** Creates a copy with name "[ORIGINAL NAME] (Copy)"; operator is immediately placed in edit mode for the new copy. The copy begins with review status CURRENT and today's date as creation date.

**Archive with usage:** If the template has active usage (venues currently running it), a warning modal: "This template is currently applied at [N] venue(s). Archiving will not remove it from those venues, but no new applications will be possible. [Cancel] [Archive anyway]"

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- "Create template" button disabled; tooltip: "Content authoring unavailable during Emergency Freeze"
- "Edit template" controls in slide-over disabled
- "Archive" disabled
- Preview, modification history, deployment history remain accessible

---

### Replay-State Behavior

Not a replay surface. Template deployment history entries link to replay records on the Replay Investigation surface (separate route); the link opens in a new surface context.

---

### Degraded-State Behavior

- Zone A amber dot
- Template table itself is unaffected by delivery degradation
- If backend is offline: table shows last cached state with "_freshness: STALE" indicator in table footer; create/edit/archive disabled

---

### Incident-State Behavior

- Incident banner in Zone A (Pane A2) if active
- Template authoring continues during all incident states except EMERGENCY_FREEZE

---

### Accessibility Notes

- Table columns have sortable aria-sort attributes (aria-sort="descending" on active sort column)
- Review status uses both color and text; confidence badge uses both color and text
- Slide-over panels trap focus when open; Escape key closes
- "Archive anyway" confirmation requires explicit focus on the confirm button (no default focus on destructive action)
- All form fields in Create Template form have visible labels (not placeholder-only)
- Minimum description length enforced with aria-describedby pointing to character count helper text

---

## WF-CMS-05: CMS Operations — Sponsor Management

**ID:** WF-CMS-05
**Surface:** CMS Content Operations Surface
**Route:** /cms/sponsorship
**Role:** Venue Admin
**Active tab:** Tab 4 — Sponsor Management
**State:** Normal / HEALTHY
**Purpose:** The operator configures sponsor contracts, assigns content, tracks SOV delivery, and views the constitutional L4 ceiling — which is permanently displayed and non-dismissible.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [M. Thompson ▼]    48px status bar   │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — SPONSOR MANAGEMENT                               │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │  Library  Schedule  Templates  [Sponsor Mgmt]●       │   │
│ VENUE                  │ │  Delivery  History                                   │   │
│ ▼ Golf Club Drummoyne  │ └──────────────────────────────────────────────────────┘   │
│ [Change venue]         │                                                            │
│                        │ ┌──── L4 CEILING BANNER (permanent, non-dismissible) ───┐  │
│ ─────────────────────  │ │ CONSTITUTIONAL CONSTRAINT                            │  │
│ (no active incident)   │ │ Sponsor content is capped at L4 override level.      │  │
│                        │ │ This ceiling is fixed and cannot be configured.       │  │
│ CMS NAVIGATION         │ │ Sponsor content will be suppressed by any active      │  │
│                        │ │ L1–L3 override on the targeted screens.               │  │
│ ○ Content Library      │ └──────────────────────────────────────────────────────┘  │
│ ○ Schedule Builder     │                                                            │
│ ○ Templates            │ ┌──── TAB 4 HEADER ────────────────────────────────────┐   │
│ ● Sponsor Mgmt         │ │  🔍 [Search sponsors...]        [Add sponsor]         │   │
│ ○ Delivery Status      │ │  Sort: [Contract end: soon ▼]   [Show expired ▼]     │   │
│ ○ Content History      │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│ ─────────────────────  │ ┌──── SPONSOR TABLE ───────────────────────────────────┐   │
│ 🔔 Notifications  [1]  │ │ SPONSOR      CAMPAIGN    TIER   SOV    SOV    SOV    │   │
│                        │ │ NAME         NAME        MAX    CNTRD  CNFGD  DLVRD  │   │
│ ─────────────────────  │ │ ──────────────────────────────────────────────────── │   │
│ Training mode: [OFF] ○ │ │ Fosters      Summer Promo L4(max) 25%   24%   23%   │   │
│                        │ │ Contract: 1 Mar → 31 Aug 2026  Status: ● DELIVERED   │   │
│ M. Thompson            │ │ [View] [Edit] [Deactivate] [Proof of Play]            │   │
│ Venue Admin            │ │ ──────────────────────────────────────────────────── │   │
│ Golf Club Drummoyne    │ │ Toyota       Club Events  L4(max) 15%   15%   12%   │   │
│ [Logout]               │ │ Contract: 15 Apr → 15 Jul 2026  Status: ⚠ AT RISK   │   │
│                        │ │ [View] [Edit] [Deactivate] [Proof of Play]            │   │
│                        │ │ ──────────────────────────────────────────────────── │   │
│                        │ │ Local Realty Listing Push L4(max) 10%   10%   10%   │   │
│                        │ │ Contract: 1 Jun → 30 Sep 2026  Status: ● DELIVERED   │   │
│                        │ │ [View] [Edit] [Deactivate] [Proof of Play]            │   │
│                        │ │ ──────────────────────────────────────────────────── │   │
│                        │ │ CoolBrew     Winter Promo L4(max) 20%   20%   19%   │   │
│                        │ │ Contract: 1 Jun → 31 Aug 2026                        │   │
│                        │ │ [Expiring in 5 days]  Status: ● DELIVERED            │   │
│                        │ │ [View] [Edit] [Deactivate] [Proof of Play]            │   │
│                        │ │ ──────────────────────────────────────────────────── │   │
│                        │ │  ── Expired contracts ──  [Show expired ▼]           │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│                        │ ┌──── SPONSOR DETAIL PANEL (on row click) ──────────────┐  │
│                        │ │ Toyota — Club Events Campaign              [×]         │  │
│                        │ │ Tier: L4 (constitutional maximum)                      │  │
│                        │ │ Contract: 15 Apr → 15 Jul 2026                         │  │
│                        │ │ SOV contracted: 15%  Configured: 15%  Delivered: 12%   │  │
│                        │ │ ⚠ AT RISK — SOV delivered (12%) is below contracted   │  │
│                        │ │   (15%). Review delivery configuration.                │  │
│                        │ │                                                         │  │
│                        │ │ Content items assigned (3):                            │  │
│                        │ │   Toyota Summer Video  [APPROVED]                      │  │
│                        │ │   Club Sponsor Banner  [APPROVED]                      │  │
│                        │ │   Event Sponsor Loop   [APPROVED]                      │  │
│                        │ │                                                         │  │
│                        │ │ Preview on venue:                                      │  │
│                        │ │   Venue: [Golf Club Drummoyne ▼]                       │  │
│                        │ │   Screen: [Bar Screen 1 ▼]                             │  │
│                        │ │   Time: [18:00 today ▼]                                │  │
│                        │ │   [Preview delivery]                                   │  │
│                        │ │                                                         │  │
│                        │ │ [Edit campaign]  [Proof of Play]  [Deactivate]        │  │
│                        │ └────────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- Status indicator: green dot + "HEALTHY"
- Venue selector: "Golf Club Drummoyne"; [Change venue]
- No active incident banner
- Active nav: "Sponsor Mgmt" with left border
- Operator: "M. Thompson / Venue Admin / Golf Club Drummoyne"

---

### L4 Ceiling Banner — Exact Specification

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ CONSTITUTIONAL CONSTRAINT — Sponsor content is capped at L4 override level.   │
│ This ceiling is fixed and cannot be configured. Sponsor content will be        │
│ suppressed by any active L1–L3 override on the targeted screens.               │
└────────────────────────────────────────────────────────────────────────────────┘
```
- Background: neutral grey-blue informational tone (not amber — this is not a warning, it is a permanent operating constraint)
- Left border: 4px solid blue/slate
- No close button. No collapse affordance. Always visible at top of Tab 4.
- Appears on every page load of /cms/sponsorship

---

### Tab Content Detail — Sponsor Management

**Header bar:**
- Search field: "Search sponsors..."
- "Add sponsor" button: primary, right of search; available to Venue Admin and above
- Sort dropdown: "Contract end: soon" (default) / Name / SOV Contracted / SOV Delivered
- "Show expired" dropdown: Active only (default) / Include expired / Expired only

**Sponsor table columns:**
Sponsor name | Campaign name | Tier (always "L4 (max)") | SOV Contracted % | SOV Configured % | SOV Delivered (7-day rolling) % | Contract dates | Delivery status | Actions

**Delivery status indicators:**
- Green dot + "DELIVERED": SOV delivered within tolerance of contracted SOV
- Amber triangle + "AT RISK": delivered SOV more than 3% below contracted
- Red dot + "FAILED": delivery pipeline failure for this sponsor content

**Contract expiry badges:**
- 30–7 days before expiry: amber badge "Expiring in [N] days"
- ≤7 days before expiry: red badge "Expiring in [N] days" (as shown for CoolBrew in wireframe)
- Day of expiry: red badge "Expires today"

**Expired contracts section:**
Collapsed by default at bottom of table. Toggle "Show expired" expands to show expired records. Expired rows visually muted; all edit/deactivate actions absent; "View" and "Proof of Play" remain.

**Sponsor Detail Panel (slide-over on row click):**
- Header: sponsor name + campaign name
- Tier label: "L4 (constitutional maximum)" — text, not a dropdown
- Contract dates and SOV summary
- SOV at-risk warning if delivered < contracted (amber box)
- Assigned content items list with status badges
- "Preview on venue" controls: venue selector + screen selector + time selector + "Preview delivery" button
- Preview result (after clicking): shows PRE resolution output for that venue/screen/time — either "Sponsor content PLAYS at this time" (green) or "Sponsor content SUPPRESSED by [Override ID] (L[N])" (amber)
- Action buttons: Edit campaign / Proof of Play / Deactivate

**Add Sponsor form (slide-over):**
```
┌──────────────────────────────────────────────────────┐
│ Add Sponsor                                   [×]    │
│ ────────────────────────────────────────────────── │
│ Sponsor name *   [                           ]       │
│ Campaign name *  [                           ]       │
│                                                      │
│ Override level:                                      │
│  L4 — Sponsor (constitutional maximum)               │
│  (This field is read-only. Sponsor content is        │
│  constitutionally capped at L4.)                     │
│                                                      │
│ Content items *  [Search APPROVED content... ▼]      │
│  (shows APPROVED content tagged as sponsor)          │
│                                                      │
│ Contract start * [Date picker]                       │
│ Contract end *   [Date picker]                       │
│                                                      │
│ Contracted SOV * [    ] %  (0–100)                   │
│                                                      │
│ Screen scope *   [Select screens... ▼]               │
│ Time window      [09:00] → [22:00]                   │
│                                                      │
│ Notes            [                           ]       │
│                                                      │
│              [Cancel]  [Save sponsor]                │
└──────────────────────────────────────────────────────┘
```
The override level field is a read-only informational label — not a form input, not a dropdown. L5/L6 are not present anywhere in this form.

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top |
| L4CeilingBanner | Zone B top, below tab strip, non-dismissible |
| SponsorSearchBar | Zone B tab header |
| AddSponsorButton | Zone B tab header, right |
| SponsorTable | Main Zone B content area |
| SponsorDetailPanel | Slide-over, overlays Zone B right |
| PreviewOnVenueControls | Inside SponsorDetailPanel |
| AddSponsorSlideOver | Slide-over (opened by Add Sponsor button) |

---

### Interaction Notes

**Add sponsor flow:**
1. Click "Add sponsor" → slide-over opens
2. Complete all required fields; override level is read-only (L4 displayed as informational text)
3. On save: sponsor record created; row appears in table with PENDING delivery status
4. A "Submit for approval" action does not apply to sponsor records — they are managed by the Venue Admin directly

**Proof of Play report:**
- Clicking "Proof of Play" opens a report slide-over showing: sponsor name, campaign, date range selector, per-venue SOV actuals, verification status
- Report is exportable as PDF or CSV
- A `cms:sponsor:proof_of_play_generated` audit event is emitted

**SOV tracking columns:**
- SOV Contracted: the agreed percentage in the contract
- SOV Configured: what the current slot configuration would deliver (calculated from scheduled slot durations vs total programming time)
- SOV Delivered: confirmed delivery over the rolling 7 days (from corpus verification data)
- If Configured < Contracted: amber warning icon in SOV Configured column with tooltip "Configured SOV is below contracted — review slot assignments"
- If Delivered < Contracted by >3%: amber "AT RISK" delivery status

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- "Add sponsor" button disabled; tooltip: "Content authoring unavailable during Emergency Freeze"
- Edit/Deactivate actions in sponsor rows disabled
- Red banner above L4 Ceiling Banner: "EMERGENCY FREEZE ACTIVE — Content authoring is suspended. Read-only access only."
- View, Proof of Play, and preview functions remain active

**Viewer role (read-only):**
- "Add sponsor" button absent from DOM
- Edit/Deactivate actions absent from DOM
- View, Proof of Play, preview available

---

### Replay-State Behavior

Not a replay surface. Preview function uses `_preview: true` stamp but is not a replay session — it is a PRE resolution preview for planning purposes.

---

### Degraded-State Behavior

- Zone A: amber dot + "DEGRADED"
- SOV Delivered column shows stale data with a "_freshness: STALE" grey indicator if last delivery sync is >24h
- "AT RISK" status may appear for sponsors where delivery data is stale; tooltip: "Delivery data is stale (last verified [AGE] ago) — confirm venue status"
- Sponsor management authoring (adding/editing records) continues normally during degraded state

---

### Incident-State Behavior

- Pane A2 incident banner if active
- During S1/EMERGENCY_FREEZE: see Disabled-State Behavior
- During S2–S5: authoring continues; L4 ceiling banner remains; SOV tracking may show degraded data

---

### Accessibility Notes

- L4 ceiling banner: role="note" or role="region" with aria-label="Constitutional constraint: sponsor content level ceiling"
- SOV columns: numeric values paired with accessible label (e.g., aria-label="Contracted SOV 25 percent")
- Delivery status icons: both icon and text; not icon-only
- Expiry badges: both color and text; not color-only
- "Preview delivery" result: if sponsor is suppressed, the suppression reason is announced to screen readers via a live region update
- Slide-over panels trap focus; Escape key closes

---

## WF-CMS-06: CMS Operations — Delivery Status (Viewer — 72h Countdown)

**ID:** WF-CMS-06
**Surface:** CMS Content Operations Surface
**Route:** /cms/delivery
**Role:** Viewer
**Active tab:** Tab 5 — Delivery Status
**State:** Normal / HEALTHY — showing per-venue 72h countdown
**Purpose:** A read-only operator views delivery status across all venues; the 72h countdown per item shows delivery risk clearly; no write actions are available to this role.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [S. Williams ▼]    48px status bar   │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — DELIVERY STATUS                                  │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │  Library  Schedule  Templates  Sponsor  [Delivery]●  │   │
│ VENUE                  │ │  History                                              │   │
│ ▼ All assigned venues  │ └──────────────────────────────────────────────────────┘   │
│ [Change filter]        │                                                            │
│                        │ ┌──── TAB 5 HEADER ────────────────────────────────────┐   │
│ ─────────────────────  │ │  Status: [All ▼]  Region: [All ▼]  🔍 [Venue name]  │   │
│ (no active incident)   │ │  Auto-refresh: every 60s  [Last refreshed: 14:23:01] │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│ CMS NAVIGATION         │                                                            │
│                        │ ┌──── VENUE DELIVERY TABLE ────────────────────────────┐   │
│ ○ Content Library      │ │ VENUE         LAST SYNC  HASH      PENDING FAILED  STATUS│
│ ○ Schedule Builder     │ │ ────────────────────────────────────────────────────── │  │
│ ○ Templates            │ │ Golf Club     2h ago     a1b2c3d4  2       0       ●PENDING│
│ ○ Sponsor Mgmt         │ │ Drummoyne     verified ✓            items                 │
│ ● Delivery Status      │ │ [▶ Expand]                                               │
│ ○ Content History      │ │ ────────────────────────────────────────────────────── │  │
│                        │ │ Riverstone    14h ago    e5f6g7h8  0       0       ●CURRENT│
│ ─────────────────────  │ │ RSL Club      verified ✓                                  │
│ 🔔 Notifications  [0]  │ │ [▶ Expand]                                               │
│                        │ │ ────────────────────────────────────────────────────── │  │
│ ─────────────────────  │ │ The Clubhouse 26h ago    --------  1       2       ✗FAILED│
│ Training mode: [OFF] ○ │ │ Parramatta    ✗ NOT VERIFIED                             │
│                        │ │ [▶ Expand]                                               │
│ S. Williams            │ │ ────────────────────────────────────────────────────── │  │
│ Viewer                 │ │ Western Hotel 3d 2h ago  f1g2h3i4  0       0       ⚠STALE│
│ All assigned venues    │ │ Penrith       verified ✓                                  │
│ [Logout]               │ │ [▶ Expand]                                               │
│                        │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│                        │ ┌──── EXPANDED VENUE ROW: Golf Club Drummoyne ──────────┐  │
│                        │ │ ▼ Golf Club Drummoyne                          [×]     │  │
│                        │ │                                                         │  │
│                        │ │ ITEM              STATUS   PLAY TIME      72H COUNTDOWN │  │
│                        │ │ ──────────────────────────────────────────────────────  │  │
│                        │ │ Happy Hour Promo  PENDING  Mon 2 Jun 16:00  1d 4h 37m  │  │
│                        │ │ ⚠ AT RISK — within 72-hour window                       │  │
│                        │ │ Delivery window: ⚠ Verify delivery is in progress       │  │
│                        │ │                                                         │  │
│                        │ │ Weekend Special  PENDING  Sat 7 Jun 10:00  4d 19h 52m  │  │
│                        │ │ ✓ Sufficient time for delivery                          │  │
│                        │ │                                                         │  │
│                        │ │ (Viewer: no Trigger re-delivery button visible)         │  │
│                        │ └────────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- Status indicator: green dot + "HEALTHY"
- Venue selector: "All assigned venues" (Viewer sees only their assigned venues; dropdown to filter to a single venue)
- No active incident banner
- Active nav: "Delivery Status" with left border
- Operator: "S. Williams / Viewer / All assigned venues"

---

### Tab Content Detail — Delivery Status

**Tab Header Bar:**
- Status filter: All / CURRENT / PENDING / FAILED / STALE
- Region filter: All / [region names]
- Venue search: text field filtering table by venue name
- Auto-refresh label: "Auto-refresh: every 60s" + "Last refreshed: [HH:MM:SS]"
- No manual refresh button needed (auto-refresh every 60s); a manual "Refresh now" link available for impatient operators

**Venue Delivery Table:**

Columns: Venue name | Last sync (relative time) | Corpus hash (8 chars) | Hash verified | Pending items count | Failed items count | Overall status

**Overall status visual encoding:**
- Green dot + "CURRENT": all verified, no failures, sync within 4h
- Amber triangle + "PENDING": pending items or sync 4–24h ago
- Red dot + "FAILED": any FAILED items or hash verification failure
- Grey chevron + "STALE": last sync >24h ago (not necessarily failed)

**Row expand (click [▶ Expand]):**
Inline expansion below the venue row — no navigation or route change. Shows per-item delivery status.

**Per-item fields in expanded view:**
- Item name (links to content library item)
- Delivery status badge (DELIVERED / PENDING / FAILED / STALE)
- Scheduled play time (venue local timezone)
- Time until play (calculated countdown)
- 72h countdown section (conditional):

**72h countdown display per item:**

```
> 72h until play (SUFFICIENT):
──────────────────────────────────────────────────────────
Weekend Special    PENDING    Sat 7 Jun 10:00    4d 19h 52m
✓ Delivery window: Sufficient time for delivery
──────────────────────────────────────────────────────────

< 72h, > 24h until play (AT RISK):
──────────────────────────────────────────────────────────
Happy Hour Promo   PENDING    Mon 2 Jun 16:00    1d 4h 37m
⚠ AT RISK — within 72-hour minimum
   Delivery window: ⚠ Verify delivery is in progress
──────────────────────────────────────────────────────────

< 24h until play (CRITICAL):
──────────────────────────────────────────────────────────
Lunch Special      PENDING    Today 18:00        6h 12m
✗ CRITICAL — Less than 24 hours until play
   Content may not reach venue in time.
   [Trigger emergency re-delivery] ← ABSENT for Viewer role
   Contact your Venue Admin to trigger emergency re-delivery.
──────────────────────────────────────────────────────────
```

**FAILED item detail (expanded):**
```
──────────────────────────────────────────────────────────────
Tuesday Reel       FAILED     Tue 3 Jun 14:00    2d 14h 8m
✗ DELIVERY FAILED
   Last attempt:  2 Jun 2026 10:14
   Error type:    HASH_MISMATCH
   Error detail:  Venue returned unexpected corpus hash
   Previous attempts: 3 (all failed)
   First failure: 1 Jun 2026 22:30

   [Retry delivery] ← ABSENT for Viewer role
   [View venue status →]  [Open support ticket →]
──────────────────────────────────────────────────────────────
```

For Viewer role: write actions ("Trigger re-delivery", "Retry delivery") are absent from DOM. A contextual note appears: "Contact your Venue Admin or Network Admin to trigger re-delivery." This note is present only when failures or at-risk items are present; it is not shown when all items are CURRENT.

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top |
| DeliveryFilterBar | Zone B tab header |
| VenueDeliveryTable | Main Zone B content area |
| VenueRowExpander | Inline below venue row |
| ItemDeliveryRow (per item) | Inside expanded venue row |
| 72hCountdownDisplay (per item) | Inside ItemDeliveryRow |
| FailureDetailExpander | Inside ItemDeliveryRow (FAILED items) |

---

### Interaction Notes

**Venue row expand/collapse:**
- Click [▶ Expand] to expand venue row inline
- Click [▲ Collapse] (replaces [▶] after expand) to collapse
- Multiple rows can be expanded simultaneously

**Item name link:**
- Clicking item name navigates to /cms/library with that content item selected/highlighted

**"View venue status" link:**
- Opens Venue Operations Dashboard (separate surface) in a new tab

**"Open support ticket" link:**
- Opens support system in a new browser tab; pre-populates with venue name, item name, failure details

**Auto-refresh:**
- Table refreshes every 60 seconds without user action
- Delivery status badge animations (spinner) while a refresh is in progress
- No full-page reload; only table rows update

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- Viewer has no write actions anyway; the EMERGENCY_FREEZE banner appears at top of Zone B
- "Trigger re-delivery" (which Viewer cannot see anyway) is mentioned in the contextual note as unavailable: "Re-delivery is unavailable during Emergency Freeze. Emergency content delivery is managed by the platform."
- Read-only viewing continues normally

**Viewer role (this wireframe):**
- All write actions absent from DOM; no disabled buttons visible — the interface is simply read-only without visible disabled states
- This is intentional: a viewer sees a clean read-only surface, not a disabled version of a write surface

---

### Replay-State Behavior

Not a replay surface. Delivery status data is always current live data (or stale live data if polling fails). The concept of "replay" does not apply here.

---

### Degraded-State Behavior

- Zone A: amber dot + "DEGRADED"
- If backend polling fails: table shows last cached data; a banner in Zone B: "Delivery status data may be outdated — last successful refresh [AGE] ago"
- STALE items multiply during degraded state; amber "_freshness: STALE" note appears in table footer
- Auto-refresh continues attempting but shows "Connection issues — retrying..." if repeated failures

---

### Incident-State Behavior

- Pane A2 incident banner if active S1/S2 incident for scoped venue
- During S1: EMERGENCY_FREEZE may also be active (see Disabled-State Behavior)
- Delivery failures that caused or resulted from the incident are visible in the FAILED items view
- Viewer may monitor delivery status to observe recovery without being able to trigger re-delivery

---

### Accessibility Notes

- Auto-refresh: aria-live="polite" region wraps the table so screen readers announce significant state changes (e.g., FAILED items appearing) without announcing every 60s tick
- Row expand/collapse: aria-expanded state on the expand control; expanded rows are part of the same table structure (not a separate modal)
- Status icons: paired with text labels at all times
- 72h countdown numbers: announce the full string (e.g., "1 day 4 hours 37 minutes") not just "1d 4h 37m" in aria-label
- Color-only differentiation avoided: each status uses icon + color + text

---

## WF-CMS-07: CMS Operations — Content History / Audit

**ID:** WF-CMS-07
**Surface:** CMS Content Operations Surface
**Route:** /cms/history
**Role:** Platform Admin
**Active tab:** Tab 6 — Content History / Audit
**State:** Normal / HEALTHY
**Purpose:** A Platform Admin reviews the immutable chronological audit log of all content operations; filters by operator, action type, venue, and date range; views approval chains; inspects corpus hash history.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [C. Okafor ▼]      48px status bar   │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — CONTENT HISTORY / AUDIT                          │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR                                              │   │
│                        │ │  Library  Schedule  Templates  Sponsor  Delivery     │   │
│ VENUE                  │ │  [Content History]●                                  │   │
│ ▼ All venues           │ └──────────────────────────────────────────────────────┘   │
│ [Change scope]         │                                                            │
│                        │ ┌──── AUDIT FILTER BAR ─────────────────────────────────┐  │
│ ─────────────────────  │ │  Date range: [29 May 2026] → [5 Jun 2026]  [Apply]   │  │
│ (no active incident)   │ │  Operator: [All operators ▼]                          │  │
│                        │ │  Content:  [Search content title...]                  │  │
│ CMS NAVIGATION         │ │  Action:   [All actions ▼]  Venue: [All venues ▼]    │  │
│                        │ │                 [Clear filters]  [Export CSV] [Export PDF]│
│ ○ Content Library      │ └──────────────────────────────────────────────────────┘   │
│ ○ Schedule Builder     │                                                            │
│ ○ Templates            │ ┌──── AUDIT LOG ───────────────────────────────────────┐   │
│ ○ Sponsor Mgmt         │ │ (reverse chronological, most recent first)           │   │
│ ○ Delivery Status      │ │                                                      │   │
│ ● Content History      │ │ ── 5 Jun 2026, 14:18:03 AEST ─────────────────────  │   │
│                        │ │ J. Rodriguez  [Content Creator]                      │   │
│ ─────────────────────  │ │ Action:  cms:content:approval_submitted              │   │
│ 🔔 Notifications  [0]  │ │ Target:  Happy Hour Promo                            │   │
│                        │ │ Venue:   Golf Club Drummoyne                         │   │
│ ─────────────────────  │ │ Detail:  Submitted content item for approval         │   │
│ Training mode: [OFF] ○ │ │ [▶ View approval chain]                              │   │
│                        │ │                                                      │   │
│ C. Okafor              │ │ ── 5 Jun 2026, 11:42:17 AEST ─────────────────────  │   │
│ Platform Admin         │ │ A. Patel  [League Admin]                             │   │
│ All venues             │ │ Action:  cms:template:created                        │   │
│ [Logout]               │ │ Target:  Weekend Schedule Template                   │   │
│                        │ │ Venue:   Drummoyne League (all venues)               │   │
│                        │ │ Detail:  Created scheduling template, type T-01,     │   │
│                        │ │          tier League, review cycle 90d               │   │
│                        │ │                                                      │   │
│                        │ │ ── 4 Jun 2026, 09:15:44 AEST ─────────────────────  │   │
│                        │ │ M. Thompson  [Venue Admin]                           │   │
│                        │ │ Action:  cms:delivery:redelivery_triggered           │   │
│                        │ │ Target:  Venue: The Clubhouse Parramatta             │   │
│                        │ │ Detail:  Re-delivery triggered for 2 FAILED items,   │   │
│                        │ │          1 STALE item                                │   │
│                        │ │                                                      │   │
│                        │ │ ── 4 Jun 2026, 08:00:22 AEST ─────────────────────  │   │
│                        │ │ System  [automated]                                  │   │
│                        │ │ Action:  cms:content:approved                        │   │
│                        │ │ Target:  Weekend Special Video                       │   │
│                        │ │ Venue:   Golf Club Drummoyne                         │   │
│                        │ │ Detail:  Approved by M. Thompson [Venue Admin]       │   │
│                        │ │ [▶ View approval chain]                              │   │
│                        │ │                                                      │   │
│                        │ │ ── 3 Jun 2026, 17:55:09 AEST ─────────────────────  │   │
│                        │ │ J. Rodriguez  [Content Creator]                      │   │
│                        │ │ Action:  cms:content:uploaded                        │   │
│                        │ │ Target:  Lunch Special Video                         │   │
│                        │ │ Venue:   Golf Club Drummoyne                         │   │
│                        │ │ Detail:  Uploaded video content, tier Venue, 0:45   │   │
│                        │ │                                                      │   │
│                        │ │ [Load older entries ▼]                              │   │
│                        │ └──────────────────────────────────────────────────────┘  │
│                        │                                                            │
│                        │ ┌──── APPROVAL CHAIN EXPANSION ────────────────────────┐  │
│                        │ │ Approval chain — Happy Hour Promo          [×]        │  │
│                        │ │ ─────────────────────────────────────────────────── │  │
│                        │ │ Submitted by: J. Rodriguez  5 Jun 14:18 AEST         │  │
│                        │ │ Reviewed by:  M. Thompson   5 Jun 14:45 AEST         │  │
│                        │ │ Decision:     APPROVED                               │  │
│                        │ │ Note: "Content verified correct for weekend schedule" │  │
│                        │ │ ─────────────────────────────────────────────────── │  │
│                        │ └────────────────────────────────────────────────────┘   │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- Status indicator: green dot + "HEALTHY"
- Venue selector: "All venues" (Platform Admin sees all venues)
- No active incident banner
- Active nav: "Content History" with left border
- Operator: "C. Okafor / Platform Admin / All venues"

---

### Tab Content Detail — Content History / Audit

**Audit Filter Bar (below tab strip):**
- Date range: start date picker + end date picker (default: last 7 days); [Apply] button applies selection
- Operator dropdown: all operators who have made changes within scope
- Content search: free text search on content title
- Action type dropdown: All Actions / Upload / Schedule / Approval / Delivery / Template / Sponsor
- Venue dropdown: venue selector
- "Clear filters" button: resets all filters to defaults
- "Export CSV" button and "Export PDF" button: right-aligned; both download the current filtered view; emit `cms:audit:exported` event

**Audit Log:**
Reverse-chronological list. Each entry is a block with:
- Timestamp (full date + time + timezone)
- Operator name + role at time of action (in brackets)
- Action: action code (from audit events table, e.g., `cms:content:approval_submitted`)
- Target: the content item, slot, template, sponsor, or venue that was acted upon
- Venue scope: the venue or scope the action applied to
- Detail: human-readable summary of the change
- Optional: [▶ View approval chain] — shown for approval-type events only

**Audit entries are immutable:** No edit, delete, or annotation controls appear on any log entry. The log is an append-only record.

**"Load older entries" paginator:**
The log loads in pages of 50 entries. A "Load older entries" button at the bottom of the log appends the next page inline (no page navigation, no full-page reload).

**Approval Chain Expansion:**
Clicking [▶ View approval chain] on an approval event expands an inline panel below the log entry (or a slide-over, designer's choice — recommend inline for this surface). The chain shows the full sequence of submit → review → decision for that item. If the item was rejected and resubmitted, all iterations are shown chronologically.

**Corpus Hash History:**
A secondary section within the audit surface: a "Corpus delivery log" sub-view accessed via a secondary tab or toggle within Tab 6.
```
Corpus Delivery Log
Venue: [Golf Club Drummoyne ▼]

TIMESTAMP            CORPUS HASH   VERIFIED   OPERATOR
──────────────────────────────────────────────────────
5 Jun 14:23 AEST     a1b2c3d4      ✓          System
4 Jun 22:10 AEST     e5f6g7h8      ✓          System
3 Jun 09:00 AEST     --------      ✗ MISMATCH System

[Click hash to view content items in that corpus version]
```

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top |
| AuditFilterBar | Zone B tab header |
| ExportButtons (CSV, PDF) | Zone B tab header, right |
| AuditLogList | Main Zone B content area |
| ApprovalChainExpander | Inline within AuditLogList |
| CorpusHashLog | Secondary view within Tab 6 |
| PaginationLoader | Bottom of AuditLogList |

---

### Interaction Notes

**Filter application:**
- Date range filter: operator selects dates then clicks [Apply]; other filters apply immediately on change (no apply button needed for dropdowns)
- Filters are additive (AND logic)
- Filter state is not URL-persisted; lost on refresh

**Export:**
- CSV: downloads immediately; filename format: `cms-audit-[venue]-[start]-[end].csv`
- PDF: generates server-side; a spinner appears on the button; download begins when ready
- Export applies all active filters; exports only the filtered result set

**Corpus hash click:**
- Clicking a hash value in the Corpus Delivery Log opens a slide-over showing the full list of content items in that corpus version (item name, type, tier, status at time of delivery)

**Platform Admin scope:**
- "Operator" filter dropdown shows all operators across all venues
- "Venue" filter shows all venues
- This is the widest-scope view; League Admin and Venue Admin see only their scoped operators and venues

---

### Disabled-State Behavior

**EMERGENCY_FREEZE:**
- This tab has no write actions; EMERGENCY_FREEZE does not affect content history viewing
- Red banner appears at top of Zone B per the standard pattern
- Export buttons remain active (read-only operations)

---

### Replay-State Behavior

Not a replay surface in the forensic sense. This is a planning audit log, not an execution trace. Replay records referenced in template deployment history are links to the Replay Investigation surface (separate route/workspace).

---

### Degraded-State Behavior

- Zone A: amber dot
- If backend unavailable: log shows last cached entries with "Offline — showing cached audit data from [AGE] ago" banner; export disabled with tooltip "Export requires a live connection"
- Auto-pagination ("Load older entries") disabled while offline

---

### Incident-State Behavior

- Pane A2 incident banner if active
- Incident-related audit events appear in the log (e.g., delivery failures, re-delivery triggers) as they occur
- No special treatment for incident state on this tab; operators can filter by action type "Delivery" to see incident-related delivery events

---

### Accessibility Notes

- Log entries: each entry is a `<article>` or `<li>` with an accessible heading (timestamp + operator name)
- Timestamps in the log include a machine-readable `<time datetime="...">` element
- Approval chain expansion: aria-expanded on the trigger; expanded content follows the trigger in DOM order
- Export buttons: aria-label describes the format ("Export audit log as CSV" / "Export audit log as PDF")
- Date range pickers: both inputs have labels ("Start date" / "End date"); calendar picker is keyboard-navigable
- "Load older entries" button: aria-label="Load older audit entries" to distinguish from other load patterns on the page

---

## WF-CMS-08: CMS Operations — EMERGENCY_FREEZE Active

**ID:** WF-CMS-08
**Surface:** CMS Content Operations Surface
**Route:** /cms/schedule (illustrative — applies to all /cms/* routes)
**Role:** Any OPERATOR+ (Content Creator shown)
**Active tab:** Tab 2 — Schedule Builder (representative tab)
**State:** EMERGENCY_FREEZE
**Purpose:** Shows the complete visual and interaction state of the CMS surface when an EMERGENCY_FREEZE constitutional state is active; all authoring is suspended; the operator can read but not write.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ✗ EMERGENCY_FREEZE  ClubHub TV CMS     [?] Help   [J. Rodriguez ▼]   48px bar      │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — SCHEDULE BUILDER                                 │
│                        │                                                            │
│ ✗ EMERGENCY_FREEZE     │ ┌──── EMERGENCY FREEZE BANNER (red, Zone B top) ────────┐  │
│ Constitutional:        │ │ ✗  EMERGENCY FREEZE ACTIVE                            │  │
│ EMERGENCY_FREEZE       │ │    Content authoring is suspended.                     │  │
│                        │ │    Read-only access only.                              │  │
│ VENUE                  │ │    [View constitutional state →]                       │  │
│ ▼ Golf Club Drummoyne  │ └──────────────────────────────────────────────────────┘  │
│ [Change venue]         │                                                            │
│                        │ ┌──── TAB BAR ──────────────────────────────────────────┐  │
│ ┌───────────────────┐  │ │  Library  [Schedule Builder]●  Templates  Sponsor     │  │
│ │ ✗ EMERGENCY FREEZE│  │ │  Delivery  History                                    │  │
│ │   CMS authoring   │  │ └──────────────────────────────────────────────────────┘  │
│ │   is suspended.   │  │                                                            │
│ │ All tabs read-only│  │ ┌──── 72h BANNER (amber, unchanged) ───────────────────┐  │
│ └───────────────────┘  │ │ ⏱  Safe scheduling after: THU 5 JUN 14:23 AEST      │  │
│                        │ └──────────────────────────────────────────────────────┘  │
│ CMS NAVIGATION         │                                                            │
│ (all items muted)      │ ┌──── SCHEDULE HEADER ──────────────────────────────────┐ │
│                        │ │ [< Prev]  MON 2 JUNE 2026  [Next >]                   │ │
│ ○ Content Library      │ │ Scope: [Venue: Golf Club Drummoyne ▼]                  │ │
│ ● Schedule Builder     │ │ View: [Timeline] [List]                                │ │
│ ○ Templates            │ │ [+ Add slot ✗]  ← disabled, cursor:not-allowed        │ │
│ ○ Sponsor Mgmt         │ └──────────────────────────────────────────────────────┘  │
│ ○ Delivery Status      │                                                            │
│ ○ Content History      │ ┌──── TIMELINE CANVAS (read-only) ─────────────────────┐  │
│                        │ │       08:00   12:00   16:00   20:00                   │  │
│ Hover any nav item:    │ │ Zone 1│     [   Weekend Promo  ]                      │  │
│ "Content authoring     │ │ Zone 2│               [ Happy Hour ]                  │  │
│  unavailable during    │ │                                                       │  │
│  Emergency Freeze"     │ │ Slots visible, not interactive                        │  │
│                        │ │ No resize handles visible                             │  │
│ ─────────────────────  │ └──────────────────────────────────────────────────────┘  │
│ 🔔 Notifications  [3]  │                                                            │
│                        │ ┌──── SLOT DETAIL PANEL (on click) ────────────────────┐  │
│ ─────────────────────  │ │ Weekend Promo                                  [×]    │  │
│ Training mode: [OFF] ○ │ │ Content:  Weekend Special Video                       │  │
│ (toggle disabled)      │ │ Time:     Mon 2 Jun 18:00 → 22:00 AEST               │  │
│                        │ │ Status:   APPROVED                                    │  │
│ J. Rodriguez           │ │ Venue:    Golf Club Drummoyne                         │  │
│ Content Creator        │ │                                                       │  │
│ Golf Club Drummoyne    │ │ [Preview ✓]   (only read action available)            │  │
│ [Logout]               │ │ [Edit slot ✗]  cursor:not-allowed                     │  │
│                        │ │ [Delete ✗]     cursor:not-allowed                     │  │
│                        │ │ [Submit for approval ✗]  cursor:not-allowed           │  │
│                        │ │                                                       │  │
│                        │ │ Tooltip on disabled actions:                          │  │
│                        │ │ "Unavailable during Emergency Freeze"                 │  │
│                        │ └────────────────────────────────────────────────────┘   │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px) — EMERGENCY_FREEZE Specific

- Status indicator: **red dot** + "EMERGENCY_FREEZE" label in red text
- Constitutional state label: "EMERGENCY_FREEZE" (replaces "NORMAL")
- A red informational box below the status indicator (not in Pane A2 — this is an additional state indicator):
  ```
  ┌────────────────────────────────────┐
  │ ✗ EMERGENCY FREEZE                │
  │   CMS authoring is suspended.     │
  │   All tabs are read-only.         │
  └────────────────────────────────────┘
  ```
- Venue selector: unchanged, still operable (venue switching allowed for read-only inspection)
- Pane A2 Active Incident Banner: present if an incident caused the freeze (links to Incident Commander)
- CMS Navigation items: visually muted (reduced opacity, no hover color change). Hovering any nav item shows tooltip: "Content authoring unavailable during Emergency Freeze". Navigation to tabs is still permitted (for read-only inspection).
- Notification tray: unchanged
- Training mode toggle in Pane A4: disabled, cursor: not-allowed. Tooltip: "Training mode cannot be changed during Emergency Freeze."
- Operator identity: unchanged

---

### EMERGENCY_FREEZE Visual Treatment — Complete Specification

**System Status Bar (48px top bar):**
- Background: red (#DC3545 or equivalent danger token)
- Text: "✗ EMERGENCY_FREEZE" in white
- All other status bar items unchanged

**Zone B Emergency Banner:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✗  EMERGENCY FREEZE ACTIVE                                                   │
│    Content authoring is suspended. Read-only access only.                    │
│    [View constitutional state →]                                              │
└──────────────────────────────────────────────────────────────────────────────┘
Background: red (#FFF5F5 tint or full red — designer's choice based on visual weight)
Left border: 4px solid red
```
This banner appears at the top of Zone B on every CMS tab during EMERGENCY_FREEZE. It is positioned below the tab strip but above all tab content (including the 72h banner on Tab 2). It is not dismissible.

**Disabled controls (every tab):**

| Tab | Controls that become disabled |
|---|---|
| Tab 1 (Library) | "Upload content", "Submit for approval", "Edit", "Archive" |
| Tab 2 (Schedule) | "+ Add slot", drag-and-drop, "Edit slot", "Delete", "Submit for approval", resize handles |
| Tab 3 (Templates) | "Create template", "Edit template", "Archive" |
| Tab 4 (Sponsor) | "Add sponsor", "Edit campaign", "Deactivate" |
| Tab 5 (Delivery) | "Trigger re-delivery", "Force re-delivery" |
| Tab 6 (History) | Export buttons remain active (read-only operation) |

Controls that are disabled follow Rule AU-02:
- Visible in DOM (not hidden)
- `disabled` attribute set
- `cursor: not-allowed`
- Tooltip on hover/focus: "Unavailable during Emergency Freeze"

The exception is "Submit for approval" on sub-24h slots — that button was already absent from DOM before the freeze. During a freeze, it remains absent.

**Controls that remain active:**
- All navigation (tab switching, venue switching)
- All preview/view actions
- Notification tray
- Logout
- Read-only inspection of all schedule slots, templates, sponsor records, delivery status, history

---

### Tab Content Detail (representative: Schedule Builder)

- 72h banner: unchanged (still amber, still present, still non-dismissible)
- Timeline canvas: rendered normally; slots visible
- Slot bars: not interactive (no click to get resize handles; drag-and-drop disabled)
- Slot bars can still be clicked to open the detail panel for read-only inspection
- Slot detail panel: shows all fields read-only; action buttons present but disabled (except Preview which remains active)

---

### Component Placement

Same as WF-CMS-02 with the following additions/modifications:
- EmergencyFreezeBanner: inserted at Zone B top (below tab strip, above 72h banner)
- EmergencyFreezeZoneAIndicator: inserted in Zone A below status indicator
- All write-capable controls: `disabled` attribute set + tooltip

---

### Interaction Notes

**EMERGENCY_FREEZE entry:**
The constitutional state changes server-side. The CMS surface detects the state change via the 60-second polling cycle or WebSocket push. On detection:
1. System Status Bar immediately updates to red + "EMERGENCY_FREEZE"
2. Zone B inserts the Emergency Freeze banner at top
3. All write controls receive `disabled` attribute
4. Toast notification: "Emergency Freeze active — content authoring suspended"

**EMERGENCY_FREEZE exit:**
When the constitutional state returns to HEALTHY or DEGRADED:
1. Status bar reverts to green/amber
2. Emergency Freeze banner removed from Zone B
3. Write controls re-enabled
4. Toast: "Emergency Freeze lifted — content authoring restored"

**What operators can do during EMERGENCY_FREEZE:**
- Review all scheduled content
- Inspect delivery status (read-only)
- View template configurations
- Inspect sponsor records
- View audit history and export it
- Run content previews in Zone C

---

### Disabled-State Behavior

This wireframe documents the disabled state itself. See above.

---

### Replay-State Behavior

Not applicable. EMERGENCY_FREEZE is a live constitutional state, not a replay scenario.

---

### Degraded-State Behavior

EMERGENCY_FREEZE and DEGRADED can co-exist. When both are active:
- System Status Bar shows "EMERGENCY_FREEZE" (takes precedence over "DEGRADED")
- Zone A status indicator is red (takes precedence over amber)
- Both the Emergency Freeze Zone B banner and any degraded-state delivery warnings remain visible
- The operator sees both conditions clearly

---

### Incident-State Behavior

EMERGENCY_FREEZE is itself the most severe incident-driven state. The Pane A2 Active Incident Banner is expected to be present during EMERGENCY_FREEZE, pointing to the causing incident.

---

### Accessibility Notes

- All disabled controls retain `disabled` attribute (not just visual styling) — they are removed from tab order
- The Emergency Freeze banner: role="alert" so screen readers announce it when it appears
- Status bar color change is paired with text change ("✗ EMERGENCY_FREEZE") — not color-only
- Tooltip text "Unavailable during Emergency Freeze" accessible via aria-describedby on each disabled control
- The constitutional state link "View constitutional state →" has a clear aria-label: "View constitutional state — opens platform status"

---

## WF-CMS-09: CMS Operations — Training Mode Active

**ID:** WF-CMS-09
**Surface:** CMS Content Operations Surface
**Route:** /cms/library (representative — applies to all /cms/* routes in training mode)
**Role:** Content Creator
**Active tab:** Tab 1 — Content Library (representative tab)
**State:** Training Mode active
**Purpose:** Shows the complete visual treatment when training mode is active; all content operations target the simulation endpoint only; the operator is clearly informed they are not affecting live venues.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS  [TRAINING MODE]   [?] Help   [J. Rodriguez ▼]   48px   │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — CONTENT LIBRARY [TRAINING MODE]                  │
│                        │                                                            │
│ ● HEALTHY              │ ┌──── TRAINING MODE BANNER (yellow, permanent) ──────────┐ │
│ Constitutional: NORMAL │ │ 🎓  TRAINING MODE                                      │ │
│                        │ │    Content authored here goes to the simulation         │ │
│ VENUE                  │ │    endpoint only. No changes affect live venues.        │ │
│ ▼ Golf Club Drummoyne  │ └──────────────────────────────────────────────────────┘  │
│ [Change venue]         │                                                            │
│                        │ ┌──────────────────────────────────────────────────────┐  │
│ ┌─────────────────┐    │ │ TAB BAR                                              │  │
│ │ Training mode:  │    │ │  [Content Library]●  Schedule  Templates  Sponsor   │  │
│ │   ON  ●━━━━━━━● │    │ │  Delivery  History                                  │  │
│ │ (toggle: amber  │    │ │                                                      │  │
│ │  dot active)    │    │ └──────────────────────────────────────────────────────┘  │
│ └─────────────────┘    │                                                            │
│                        │ ┌──── TAB 1 HEADER ─────────────────────────────────────┐ │
│ ─────────────────────  │ │  🔍 [Search simulation content...]  [Filters ▼]        │ │
│ (no active incident)   │ │  Type: [All ▼]  Tier: [All ▼]  Status: [All ▼]        │ │
│                        │ │           [⊞ Grid] [≡ List]  [Upload content]          │ │
│ CMS NAVIGATION         │ └──────────────────────────────────────────────────────┘  │
│                        │                                                            │
│ ● Content Library      │ ┌──── CONTENT GRID (simulation content only) ───────────┐ │
│ ○ Schedule Builder     │ │                                                       │ │
│ ○ Templates            │ │ ┌──────────────────┐  ┌──────────────────┐            │ │
│ ○ Sponsor Mgmt         │ │ │ [THUMBNAIL]      │  │ [THUMBNAIL]      │            │ │
│ ○ Delivery Status      │ │ │                  │  │                  │            │ │
│ ○ Content History      │ │ │ Training Promo   │  │ Sim Event Video  │            │ │
│                        │ │ │ [SIMULATION    ] │  │ [SIMULATION    ] │            │ │
│ ─────────────────────  │ │ │ [DRAFT        ] │  │ [APPROVED      ] │            │ │
│ 🔔 Notifications  [3]  │ │ │ Video · 0:30    │  │ Video · 1:00    │            │ │
│                        │ │ │ Tier: Venue     │  │ Tier: Venue     │            │ │
│ ─────────────────────  │ │ │ [Submit (train)]│  │ Not scheduled   │            │ │
│ Training mode: [ON] ●  │ │ └──────────────────┘  └──────────────────┘            │ │
│ amber indicator dot    │ │                                                       │ │
│                        │ │ No live content cards appear here during training.    │ │
│ J. Rodriguez           │ │ Simulation endpoint: https://sim.clubhub.internal/    │ │
│ Content Creator        │ │                                                       │ │
│ Golf Club Drummoyne    │ └───────────────────────────────────────────────────────┘ │
│ [Logout]               │                                                            │
│                        │ ┌──── ZONE C HEADER (when Preview panel active) ────────┐ │
│                        │ │ PREVIEW — simulation data                             │ │
│                        │ │ Simulation endpoint: https://sim.clubhub.internal/api/│ │
│                        │ │ sim/  (Production endpoint not in use)                │ │
│                        │ └──────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px) — Training Mode Specific

- Status indicator: green dot + "HEALTHY" (constitutional state is unaffected by training mode)
- Training mode section (Pane A4):
  ```
  ┌──────────────────────────────────────┐
  │ Training mode:  ON  ●━━━━━━━●        │  <- toggle in ON position, amber
  │ ● Simulation endpoint active         │  <- amber indicator dot
  └──────────────────────────────────────┘
  ```
- Training mode toggle in ON position; amber indicator dot next to "ON" label
- CMS Navigation items: all accessible (training mode does not disable navigation)
- Operator identity: unchanged

---

### Training Mode Visual Treatment — Complete Specification

**System Status Bar:**
- A "[TRAINING MODE]" label appears in the status bar alongside the normal HEALTHY indicator
- Background color unchanged (training mode is not an error or warning state)
- The training mode label is styled in amber/yellow to distinguish it from constitutional state

**Zone B Training Mode Banner (every tab, permanent, non-dismissible):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🎓  TRAINING MODE                                                             │
│     Content authored here goes to the simulation endpoint only.              │
│     No changes affect live venues.                                            │
└──────────────────────────────────────────────────────────────────────────────┘
Background: yellow (#FFF9C4 or training-mode token)
Left border: 4px solid yellow/amber
```
Positioned below the tab strip, above all tab content (above the 72h banner on Tab 2).

**Zone B content area watermark:**
A diagonal "TRAINING MODE" text watermark in very light grey (opacity ~8–12%) overlaid across Zone B content. Does not obscure any content. CSS: `pointer-events: none; user-select: none`.

**SIMULATION badge on every content item:**
Every card, row, slot, template entry, and sponsor record shows a "SIMULATION" badge in yellow, positioned alongside the normal status badge.

```
┌──────────────────────────────────────────────┐
│ [THUMBNAIL]                                  │
│ Training Promo       [SIMULATION] [DRAFT]    │  <- both badges
│ Video · 0:30                                 │
│ Tier: Venue                                  │
│ [Submit (training scenario)]                 │  <- relabelled submit action
└──────────────────────────────────────────────┘
```

**Relabelled action buttons during training mode:**

| Normal label | Training mode label |
|---|---|
| "Submit for approval" | "Submit (training scenario)" |
| "Approve" | "Approve (training)" |
| "Trigger re-delivery" | Absent — replaced with simulated venue delivery model |

**Tab 5 (Delivery Status) in training mode:**
The tab header shows "Simulation venues only — no real venue data" in place of the normal filter bar. The delivery table shows only simulation venue entries.

**72h rule in training mode (Tab 2):**
The 72h delivery window banner is still shown for instructional value, but the hard blocks are not enforced. The banner text is modified:
```
┌────────────────────────────────────────────────────────────────────────┐
│ ⏱  TRAINING MODE — 72-hour delivery window (not enforced)             │
│    In production, content must be scheduled 72h+ before play time.    │
│    Tight timelines are permitted in simulation for learning purposes.  │
└────────────────────────────────────────────────────────────────────────┘
```
The "Submit for approval" button appears for all slots regardless of time proximity (no blocking).

**Simulation endpoint label in Zone C:**
When Zone C (Preview Panel) is open during training mode:
```
Simulation endpoint: https://sim.clubhub.internal/api/sim/
(Production endpoint not in use during training mode)
```
This is an informational label, not interactive.

---

### Entering and Exiting Training Mode

**Entry:**
1. Pane A4 → toggle "Training mode" to ON position
2. Confirmation dialog:
   ```
   ┌──────────────────────────────────────────────────────────┐
   │ Switch to training mode?                                 │
   │                                                          │
   │ All content operations will target the simulation        │
   │ endpoint. No changes will affect live venues.            │
   │                                                          │
   │              [Cancel]  [Enter training mode]             │
   └──────────────────────────────────────────────────────────┘
   ```
3. On confirm: page reloads; connects to simulation endpoint; toast "Training mode active — simulation endpoint connected."

**Exit:**
1. Pane A4 → toggle "Training mode" to OFF position (currently ON)
2. Confirmation dialog:
   ```
   ┌──────────────────────────────────────────────────────────┐
   │ Exit training mode?                                      │
   │                                                          │
   │ You will return to the live production environment.      │
   │ Any training-mode content remains in the simulation only.│
   │                                                          │
   │              [Cancel]  [Exit training mode]              │
   └──────────────────────────────────────────────────────────┘
   ```
3. On confirm: page reloads; reconnects to production; toast "Live mode restored — production endpoint connected."

---

### Component Placement

| Component | Location |
|---|---|
| SystemStatusBar | Zone A top (with training mode label added) |
| TrainingModeBanner | Zone B top, below tab strip, non-dismissible |
| TrainingModeWatermark | Zone B content area overlay, pointer-events:none |
| SimulationBadge (per item) | On every content card/row/slot |
| TrainingModeToggle | Pane A4, Zone A |
| SimulationEndpointLabel | Zone C header (when preview panel open) |

---

### Interaction Notes

**What changes in training mode:**
- All API calls route to `/api/sim/...` instead of `/api/...`
- All server responses include `_simulation: true`; surface validates this on every response
- If a response lacks `_simulation: true` during training mode: error banner "Training data source error — data received without simulation marker. Please refresh."
- Training mode content is never promotable to live corpus (network-layer enforcement)

**What is unchanged in training mode:**
- Navigation between tabs
- All read-only viewing of simulation content
- Preview function (uses simulation endpoint, stamps `_preview: true`)
- Logout and session management

**Data isolation:**
Simulation data and live data never mix. Page reload on entry/exit flushes all cached data to prevent cross-contamination.

---

### Disabled-State Behavior

**EMERGENCY_FREEZE during training mode:**
The EMERGENCY_FREEZE overlay supersedes training mode. The EMERGENCY_FREEZE banner appears above the training mode banner. Write actions are disabled. Training mode toggle becomes disabled (cannot exit training mode during EMERGENCY_FREEZE — state transition requires operator action when the freeze is lifted).

---

### Replay-State Behavior

Not applicable. Training mode simulation does not intersect with the forensic replay system.

---

### Degraded-State Behavior

Degraded state (amber dot) can co-exist with training mode. Zone A shows green for constitutional state + amber for system health. Training mode banner remains yellow. Both conditions are independently visible.

---

### Incident-State Behavior

Training mode is a session-level setting, not a response to an incident. During active S1/S2 incidents, the operator may still be in training mode (or may exit to provide operational support). If EMERGENCY_FREEZE activates while training mode is on, see Disabled-State Behavior above.

---

### Accessibility Notes

- Training mode banner: role="note" with aria-label="Training mode active — simulation endpoint only"
- Zone B watermark: aria-hidden="true" (purely decorative)
- SIMULATION badge on each item: screen readers announce it as part of the card description
- Confirmation dialogs: focus is placed on the dialog on open; Escape key maps to "Cancel"
- Training mode toggle: aria-label="Training mode toggle" + aria-checked state; aria-pressed for the toggle affordance
- Entry/exit confirmation dialogs: the primary action button ("Enter training mode" / "Exit training mode") does not receive default focus — Cancel receives focus by default to prevent accidental activation

---

## WF-CMS-10: CMS Operations — Viewer Read-Only

**ID:** WF-CMS-10
**Surface:** CMS Content Operations Surface
**Route:** /cms/delivery (default landing for Viewer — read-heavy tab)
**Role:** Viewer
**Active tab:** Tab 5 — Delivery Status (representative — all tabs visible)
**State:** Normal / HEALTHY
**Purpose:** Shows the complete Viewer experience: all six tabs visible and navigable; no write controls present anywhere in the DOM; read-only CMS is a clean, uncluttered surface without disabled buttons.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ● HEALTHY  ClubHub TV CMS          [?] Help   [S. Williams ▼]    48px status bar   │
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ZONE A (280px)         │ ZONE B — DELIVERY STATUS (Viewer view)                    │
│                        │                                                            │
│ ● HEALTHY              │ ┌──────────────────────────────────────────────────────┐   │
│ Constitutional: NORMAL │ │ TAB BAR (all 6 tabs visible to Viewer)               │   │
│                        │ │  Library  Schedule  Templates  Sponsor  [Delivery]●  │   │
│ VENUE                  │ │  History                                              │   │
│ ▼ My assigned venues   │ └──────────────────────────────────────────────────────┘   │
│ (2 venues)             │                                                            │
│ [View venue list]      │ ┌──── READ-ONLY NOTICE (non-intrusive, Viewer only) ────┐  │
│                        │ │ ℹ  You have read-only access to this surface.         │  │
│ ─────────────────────  │ │    To make changes, contact your Venue Admin.         │  │
│ (no active incident)   │ └──────────────────────────────────────────────────────┘  │
│                        │                                                            │
│ CMS NAVIGATION         │ ┌──── TAB 5 HEADER ────────────────────────────────────┐   │
│ (all visible, all nav- │ │  Status: [All ▼]  Region: [All ▼]  🔍 [Venue name]  │   │
│  igable for Viewer)    │ │  Auto-refresh: every 60s  [Last refreshed: 14:23:01] │   │
│                        │ └──────────────────────────────────────────────────────┘   │
│ ○ Content Library      │                                                            │
│ ○ Schedule Builder     │ ┌──── VENUE DELIVERY TABLE ────────────────────────────┐   │
│ ○ Templates            │ │ VENUE          LAST SYNC  HASH      PEND  FAIL STATUS │   │
│ ○ Sponsor Mgmt         │ │ ───────────────────────────────────────────────────── │   │
│ ● Delivery Status      │ │ Golf Club      2h ago     a1b2c3d4  1     0  ●PENDING │   │
│ ○ Content History      │ │ Drummoyne      verified ✓                             │   │
│                        │ │ [▶ Expand]                                             │   │
│ ─────────────────────  │ │ ───────────────────────────────────────────────────── │   │
│ 🔔 Notifications  [0]  │ │ Riverstone RSL 14h ago    e5f6g7h8  0     0  ●CURRENT │   │
│                        │ │                verified ✓                             │   │
│ ─────────────────────  │ │ [▶ Expand]                                             │   │
│ Training mode: [OFF] ○ │ └──────────────────────────────────────────────────────┘   │
│                        │                                                            │
│ S. Williams            │ ┌──── EXPANDED VENUE: Golf Club Drummoyne ──────────────┐  │
│ Viewer                 │ │ ▼ Golf Club Drummoyne                           [×]    │  │
│ 2 assigned venues      │ │                                                         │  │
│ [Logout]               │ │ ITEM            STATUS  PLAY TIME    72H COUNTDOWN      │  │
│                        │ │ ─────────────────────────────────────────────────────── │  │
│                        │ │ Happy Hour Promo PENDING Mon 2 Jun 16:00  1d 4h 37m    │  │
│                        │ │ ⚠ AT RISK — within 72-hour delivery window             │  │
│                        │ │ Delivery window: ⚠ Verify delivery is in progress      │  │
│                        │ │                                                         │  │
│                        │ │ Contact your Venue Admin to action delivery issues.     │  │
│                        │ │                                                         │  │
│                        │ │ (No Trigger re-delivery button — Viewer role)           │  │
│                        │ └────────────────────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

### Zone A Detail (280px)

- Status indicator: green dot + "HEALTHY"
- Venue selector: "My assigned venues (2 venues)" — Viewer sees only their assigned venues; [View venue list] link shows a simple list; no venue creation/editing
- No active incident banner
- CMS Navigation: all 6 items visible; all are navigable (Viewer has read access to all tabs)
- Notification tray: unchanged
- Training mode toggle: available to Viewer (minimum role to enter training mode is Viewer)
- Operator: "S. Williams / Viewer / 2 assigned venues"

---

### Read-Only Notice — Specification

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ℹ  You have read-only access to this surface. To make changes, contact your   │
│    Venue Admin.                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
Background: light blue informational (#E3F2FD or info token)
Left border: 4px solid blue
```
- Appears once at top of Zone B (below tab strip, above tab content) on the first CMS tab the Viewer lands on per session
- A "Dismiss" link on the right side: once dismissed, does not reappear in the same session (localStorage flag: `cms.viewerNotice.dismissed`)
- Does not appear on the same tab on subsequent tab switches within the session after dismissal
- Does NOT appear at all if the operator has any write role (Content Creator or above)

This notice communicates the Viewer's status without littering every tab with disabled buttons. The interface is clean because write controls are simply absent.

---

### Per-Tab Behavior for Viewer Role

**Tab 1 — Content Library:**
- All content cards visible (those within assigned venue scope)
- "Upload content" button: absent from DOM
- Card action row: "Preview" only; Edit, Archive, Submit for approval all absent from DOM
- "View slots" link: present (navigates to read-only schedule view)
- Filter and search controls: fully functional (read-only actions)

**Tab 2 — Schedule Builder:**
- Timeline and list views: both available in read-only mode
- "+ Add slot" button: absent from DOM
- Drag-and-drop: disabled at interaction level (canvas does not respond to drag events)
- Slot bars: click to open detail panel
- Slot detail panel: all fields shown read-only; Edit, Delete, Submit for approval all absent from DOM
- 72h banner: present and visible (informational)
- "Content Library Sidebar" expand: present (can view content list) but cannot drag items

**Tab 3 — Template Management:**
- Template table: fully visible
- "Create template" button: absent from DOM
- Per-row actions: "Preview" only; Edit, Duplicate (creates content), Archive all absent from DOM
- Template detail slide-over: opens read-only; modification history and deployment history visible

**Tab 4 — Sponsor Management:**
- Sponsor table: fully visible
- "Add sponsor" button: absent from DOM
- Per-row actions: "View" and "Proof of Play" only; Edit, Deactivate absent from DOM
- L4 Ceiling Banner: visible (informational, present for all roles)

**Tab 5 — Delivery Status (this wireframe):**
- All venue rows visible (assigned venues only)
- Row expand: functional
- "Trigger re-delivery" / "Force re-delivery": absent from DOM
- "Retry delivery": absent from DOM
- Contextual note on at-risk or failed items: "Contact your Venue Admin to action delivery issues."

**Tab 6 — Content History / Audit:**
- Full audit log visible (within assigned venue scope)
- Export buttons: absent from DOM (Viewer cannot export audit records)
- Approval chain expansion: fully functional (read-only)
- Corpus hash log: visible; clicking hash shows content list (read-only)
- Operator filter: absent from DOM (minimum role to filter by operator is "Operator" — above Viewer)

---

### Component Placement

Same structure as WF-CMS-06 with:
- ReadOnlyNotice: Zone B top (below tab strip) — dismissible after first view
- All write-action components: absent from DOM across all tabs
- ContextualViewerNote (on at-risk/failed items): present in Delivery Status and where relevant

---

### Interaction Notes

**Tab switching:**
All 6 tabs are fully navigable. Viewer does not see a degraded or restricted navigation experience — they see the full CMS navigation with full read access.

**Viewer vs. disabled state distinction:**
This is important: Viewer sees a clean read-only interface. Controls they cannot use are not shown as disabled buttons — they are absent from the DOM entirely. This is intentional per FP-03 principles applied broadly: showing disabled options implies achievability, which is misleading. A Viewer's interface should not communicate "you could do this if you had the right role" for every action — only the read-only notice contextualises the role.

**Preview in Zone C:**
Viewer can use the Zone C preview panel (accessible via "Preview" toggle). The "Preview at venue" function is available. All preview operations use `_preview: true` stamp.

---

### Disabled-State Behavior

**EMERGENCY_FREEZE during Viewer session:**
The Emergency Freeze banner appears in Zone B. No change to Viewer's interaction model (they have no write actions anyway). The banner informs them of the system state.

---

### Replay-State Behavior

Not a replay surface. Viewer's read-only CMS access is always in planning/live mode.

---

### Degraded-State Behavior

- Zone A: amber dot + "DEGRADED"
- Delivery status table may show STALE data; amber warning in table footer
- Viewer observes degradation but cannot take any action (consistent with their role)
- The read-only notice is unchanged; degraded state does not add additional notices for Viewer

---

### Incident-State Behavior

- Pane A2 incident banner if active S1/S2 incident for scoped venue
- Viewer can see the incident banner and navigate to the Incident Commander surface via the banner link (read-only access to incident surfaces, subject to that surface's role gating)
- CMS continues to show read-only data during incidents; Viewer is unaffected by write-blocking states they cannot trigger anyway

---

### Accessibility Notes

- Read-only notice: role="note" with aria-label="Read-only access notice"; the Dismiss button has aria-label="Dismiss read-only notice"
- Because write controls are absent from DOM: no need for aria-disabled on absent elements; screen readers encounter a clean interface without "dimmed" buttons requiring explanation
- Tab navigation strip: all 6 tabs in tab order; active tab has aria-selected="true"
- Venue selector: shows count "2 venues" in accessible label
- Filter dropdowns: fully keyboard operable (read-only actions do not need write permissions)
- "Contact your Venue Admin" contextual note: role="note" so it is read in the correct flow context without interrupting

---

## Summary — Wireframe Coverage

| ID | Surface | Route | Role | State |
|---|---|---|---|---|
| WF-CMS-01 | Content Library | /cms/library | Content Creator | Normal/HEALTHY |
| WF-CMS-02 | Schedule Builder | /cms/schedule | Content Creator | 72h warning active |
| WF-CMS-03 | Schedule Builder | /cms/schedule | Content Creator | <24h hard block |
| WF-CMS-04 | Template Management | /cms/templates | League Admin | Normal/HEALTHY |
| WF-CMS-05 | Sponsor Management | /cms/sponsorship | Venue Admin | Normal/HEALTHY |
| WF-CMS-06 | Delivery Status | /cms/delivery | Viewer | Normal/HEALTHY, 72h countdown |
| WF-CMS-07 | Content History / Audit | /cms/history | Platform Admin | Normal/HEALTHY |
| WF-CMS-08 | Schedule Builder (representative) | /cms/schedule | Any OPERATOR+ | EMERGENCY_FREEZE |
| WF-CMS-09 | Content Library (representative) | /cms/library | Content Creator | Training Mode |
| WF-CMS-10 | Delivery Status (representative) | /cms/delivery | Viewer | Normal, read-only |

---

## Constitutional Constraints Encoded in These Wireframes

| Constraint | Where enforced in wireframes |
|---|---|
| 72-hour delivery lead time | WF-CMS-02 (warning), WF-CMS-03 (hard block), WF-CMS-06 (countdown), WF-CMS-09 (training mode relaxation) |
| L4 sponsor ceiling | WF-CMS-05 (permanent banner + read-only field), WF-CMS-04 (governance level dropdown restriction) |
| No self-approval | WF-CMS-01 (PENDING_APPROVAL card — Approve absent for submitter) |
| No submit for sub-24h slot | WF-CMS-03 (Submit button absent from DOM) |
| No write during EMERGENCY_FREEZE | WF-CMS-08 (all write controls disabled, tooltip enforces) |
| Training content never to live corpus | WF-CMS-09 (simulation endpoint label, banner, page-reload isolation) |
| Viewer sees clean read-only surface | WF-CMS-10 (write controls absent from DOM, not disabled) |
| 72h banner non-dismissible | WF-CMS-02, WF-CMS-03 (no close button on banner) |
| Sponsor L5/L6 absent from dropdown | WF-CMS-05 (override level is read-only text, not a dropdown at all) |
| No live override from CMS | All wireframes — no override controls present anywhere on the CMS surface |

---

*End of CMS-OPERATIONS-WIREFRAMES-v1.md*
*Source authority: CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md*
*All wireframes translate existing architecture into buildable screens.*
*No new governance, components, or information models introduced.*
