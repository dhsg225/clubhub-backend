# VENUE-OPERATIONS-WIREFRAMES-v1
# Venue Operations Dashboard — Single-Venue Deep-Dive Wireframes

**Document type:** Implementation-grade wireframe specification
**Surface:** Venue Operations Dashboard
**Authority:** UX/Design
**Audience:** Frontend engineers, UX designers, QA
**Depends on:** CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md, OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## Wireframe Index

| ID | Title | Role | Venue State | Tab |
|---|---|---|---|---|
| WF-VO-01 | Overview — LIVE healthy | OPERATOR | LIVE | Tab 1 Overview |
| WF-VO-02 | Overview — OFFLINE with autonomy clock | OPERATOR | OFFLINE | Tab 1 Overview |
| WF-VO-03 | Overview — RECOVERED_BUT_UNTRUSTED | OPERATOR | LIVE+UNTRUSTED | Tab 1 Overview |
| WF-VO-04 | Screen Management — enrollment flow | ADMIN | LIVE | Tab 2 Screens |
| WF-VO-05 | Content Delivery — delivery health | OPERATOR | LIVE | Tab 3 Content |
| WF-VO-06 | Override History — override list | OPERATOR | LIVE | Tab 4 Overrides |
| WF-VO-07 | PRE Resolution State — resolution tree | OPERATOR | LIVE | Tab 5 PRE State |
| WF-VO-08 | Venue History — event timeline | OPERATOR | LIVE | Tab 6 History |
| WF-VO-09 | Read-only — VIEWER role (all tabs visible) | VIEWER | LIVE | Tab 1 Overview |
| WF-VO-10 | Decommissioned venue archive view | ANY | DECOMMISSIONED | Tab 1 Overview |

---

## Layout Conventions (applies to all wireframes)

**Viewport:** 1440px wide desktop

**Column structure:**
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px, full width, fixed)                                         │
├───────────────────────────────────────────────────────────────────────────────────  │
│ VENUE IDENTITY HEADER (persistent, full width, does not scroll)                     │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│               │ TAB STRIP (underlined active tab)                                   │
│  ZONE A       ├─────────────────────────────────────────────────────────────────────┤
│  (280px)      │                                                                     │
│               │  ZONE B (fluid, ~880px at 1440px viewport)                          │
│               │  (tab content scrolls here)                                         │
│               │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

Note: The Venue Operations Dashboard uses Zone A + Zone B only (no Zone C at this surface per layout model). Zone C is reserved for surfaces with 3-panel layout. Quick diagnostics appear in the Venue Identity Header right section.

**Color tokens referenced in wireframes:**
- Green: #22c55e (LIVE, HEALTHY, TRUSTED, VERIFIED, CONNECTED)
- Amber: #f59e0b (DEGRADED, STALE, warning states)
- Red: #ef4444 (CRITICAL, FAILED, INCIDENT, OFFLINE badge text)
- Slate: #64748b (OFFLINE machine state badge background)
- Blue: #3b82f6 (SYNCING, ASSESSING, INITIALIZING)
- Navy: L1 override badge
- Teal: L3 override badge
- Orange: L4 override badge
- Deep red: L6 override badge

**Machine state badge dimensions:** 120×40px pill, white text, colored background per state.

**Override level badge colors:**
- L1: Navy background (#1e3a5f), white text
- L2: Blue (#1d4ed8), white text
- L3: Teal (#0f766e), white text
- L4: Orange (#c2410c), white text
- L5: Red (#b91c1c), white text
- L6: Deep red (#7f1d1d), white text, bold

**PRE level badge colors:**
- L0: Grey (#6b7280), white text
- L1: Blue (#1d4ed8), white text
- L2: Blue (#1d4ed8), white text
- L3: Amber (#b45309), white text
- L4: Orange (#c2410c), white text
- L5: Red (#b91c1c), white text
- L6: Dark red (#7f1d1d), white text

---

## WF-VO-01: Venue Overview — LIVE Healthy State

**ID:** WF-VO-01
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042
**Role:** OPERATOR
**Venue state:** LIVE
**Active tab:** Tab 1 — Overview
**Purpose:** Baseline healthy state — all 7 status dimensions green, no incidents, no overrides, no autonomy concerns.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │  ← System Status Bar (48px)
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    VENUE IDENTITY HEADER (persistent)                               │
│  ┌──────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐ │
│  │ Paddington RSL           │  │  ┌──────────────────┐  │  │ Last corpus sync:    │ │
│  │ venue_id: vn-0042        │  │  │       LIVE       │  │  │ 4 hours ago          │ │
│  │ [NETWORK] Licensed Club  │  │  └──────────────────┘  │  │ (green text)         │ │
│  └──────────────────────────┘  │  (120×40px green pill) │  └──────────────────────┘ │
│                                │  [LIVE→OFFLINE] 14:32  │                           │
│                                │  [OFFLINE→SYNCING]15:18│                           │
│                                │  [SYNCING→LIVE] 15:23  │                           │
│                                └────────────────────────┘                           │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │  ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                                                           │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │  STATUS DASHBOARD — 7 DIMENSIONS (4-3 grid)                        │
│ ▌ Paddington  │                                                                     │
│   RSL         │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│   vn-0042     │  │▌ HEALTH      │ │▌ TRUST       │ │▌ CONFIDENCE  │ │▌ FRESHNESS │ │
│               │  │  HEALTHY     │ │  TRUSTED     │ │  HIGH        │ │  CURRENT   │ │
│   Sydney CBD  │  │  (green)     │ │  (green)     │ │  (green)     │ │  (green)   │ │
│   RSL         │  │  ● HIGH      │ │  ● HIGH      │ │  ● HIGH      │ │  ● HIGH    │ │
│               │  │  All signals │ │  Hash verif. │ │  All inputs  │ │  Last upd. │ │
│   Pyrmont RSL │  │  within bnd  │ │  current     │ │  current     │ │  2m ago    │ │
│               │  │  Updated 2m  │ │  Updated 2m  │ │  Updated 2m  │ │  Updated   │ │
│   Glebe RSL   │  └──────────────┘ └──────────────┘ └──────────────┘ │  2m ago    │ │
│               │                                                       └────────────┘ │
│ ─────────────│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│ NAVIGATION   │  │▌ READINESS   │ │▌ CONNECTIVITY│ │▌ INTEGRITY   │               │
│               │  │  READY       │ │  CONNECTED   │ │  VERIFIED    │               │
│  Overview ◀  │  │  (green)     │ │  (green)     │ │  (green)     │               │
│  Screens     │  │  ● HIGH      │ │  ● HIGH      │ │  ● HIGH      │               │
│  Content     │  │  ✓ Player:   │ │  10/10 hbts  │ │  Hash:       │               │
│  Overrides   │  │    LIVE      │ │  received    │ │  a3f9...c21b │               │
│  PRE State   │  │  ✓ Corpus:   │ │  last 10min  │ │  verified    │               │
│  History     │  │    VERIFIED  │ │  Last hbt:   │ │  4h 32m ago  │               │
│               │  │  ✓ Clock:1s │ │  23s ago     │ │  Updated 2m  │               │
│               │  │  ✓ Hbt: OK  │ │  Updated 2m  │ └──────────────┘               │
│               │  │  Updated 2m │ └──────────────┘                                 │
│               │  └──────────────┘                                                  │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────    │
│               │  No active incidents  ✓                                            │
│               │  ─────────────────────────────────────────────────────────────    │
│               │  Active overrides: 1  (L4: 1)     [Manage overrides →]            │
│               │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Venue Identity Header Detail (persistent, full-width above tabs)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT                          CENTER                            RIGHT               │
│  ─────────────────────         ─────────────────────────────    ─────────────────── │
│  Paddington RSL                ┌──────────────────────────┐     Last corpus sync:   │
│  (20px semibold)               │          LIVE            │     4 hours ago         │
│                                └──────────────────────────┘     (green text)        │
│  venue_id: vn-0042             (120×40px pill, #22c55e bg,                          │
│  (12px monospace)              white text)                                           │
│                                                                                      │
│  [NETWORK] (blue pill)         Machine state history strip:                          │
│  Licensed Club (12px gray)     [LIVE→OFFLINE] 2026-06-02 14:32 AEST                 │
│                                [OFFLINE→SYNCING] 2026-06-02 15:18 AEST              │
│                                [SYNCING→LIVE] 2026-06-02 15:23 AEST                 │
│                                (12px pills, oldest left → newest right)             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Header notes:
- Corpus sync age text: green when <48h, amber when >48h, red with warning icon when >72h
- Machine state badge: display-only, no hover, no link
- History strip entries: "[FROM → TO]" pill + governed timestamp in venue local timezone
- If fewer than 3 transitions exist: only available entries shown, no padding

---

### Zone A Detail (280px fixed width)

```
┌─────────────────────────────┐
│ ← All Venues                │  ← Always present, navigates to Live Ops surface
│                             │
│ Search venues...            │  ← Filter input, searches name/id
│ [                         ] │
│                             │
│ ─────────────────────────── │
│                             │
│ ▌ Paddington RSL            │  ← Active venue: left border accent (#22c55e),
│   vn-0042                   │    semibold name, venue ID below
│                             │
│   Sydney CBD RSL            │  ← Other accessible venues, normal weight
│   Pyrmont RSL               │
│   Glebe RSL                 │
│                             │
│ ─────────────────────────── │
│ VENUE NAVIGATION            │
│                             │
│ ▌ Overview                  │  ← Active: left accent, bold
│   Screens                   │
│   Content                   │
│   Overrides                 │
│   PRE State                 │
│   History                   │
│                             │
│                             │
│ (No active incident panel   │
│  — absent when no incidents)│
└─────────────────────────────┘
```

Zone A notes:
- OPERATOR/VIEWER: list shows assigned venues only
- ADMIN: list shows all venues (full scrollable list)
- Active venue: left border accent, semibold text
- Active nav item: left border accent, bold text
- Active incident panel: absent in LIVE healthy state; appears at bottom of Zone A when incidents active

---

### Tab 1 — Overview Content Detail

**Status Dashboard — 7 dimension cards, 4-3 grid layout:**

Row 1 (4 cards, equal width ~210px each):

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ | HEALTH            │  │ | TRUST             │  │ | CONFIDENCE        │  │ | FRESHNESS         │
│                     │  │                     │  │                     │  │                     │
│   HEALTHY           │  │   TRUSTED           │  │   HIGH              │  │   CURRENT           │
│   (green text)      │  │   (green text)      │  │   (green text)      │  │   (green text)      │
│                     │  │                     │  │                     │  │                     │
│   ● HIGH (green)    │  │   ● HIGH (green)    │  │   ● HIGH (green)    │  │   ● HIGH (green)    │
│                     │  │                     │  │                     │  │                     │
│   All signals       │  │   Hash verified.    │  │   All inputs        │  │   Last update       │
│   within bounds     │  │   Clock sync OK.    │  │   current           │  │   2m ago            │
│                     │  │   Heartbeat fresh   │  │                     │  │   (window: 5m)      │
│   Updated 2m ago    │  │   Updated 2m ago    │  │   Updated 2m ago    │  │   Updated 2m ago    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
  green left border         green left border         green left border         green left border
```

Row 2 (3 cards, equal width ~280px each):

```
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│ | READINESS               │  │ | CONNECTIVITY             │  │ | INTEGRITY                │
│                           │  │                           │  │                           │
│   READY                   │  │   CONNECTED               │  │   VERIFIED                │
│   (green text)            │  │   (green text)            │  │   (green text)            │
│                           │  │                           │  │                           │
│   ● HIGH (green)          │  │   ● HIGH (green)          │  │   ● HIGH (green)          │
│                           │  │                           │  │                           │
│   ✓ Player state: LIVE    │  │   10 of 10 heartbeats     │  │   Hash: a3f9...c21b       │
│   ✓ Corpus hash: VERIFIED │  │   received (last 10 min)  │  │   verified 4h 32m ago     │
│   ✓ Clock sync: 1.2s delta│  │   Last heartbeat: 23s ago │  │                           │
│     (tolerance: 2s)       │  │                           │  │                           │
│   ✓ Heartbeat: CURRENT    │  │   Updated 2m ago          │  │   Updated 2m ago          │
│                           │  │                           │  │                           │
│   Updated 2m ago          │  │                           │  │                           │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
  green left border               green left border               green left border
```

Each card includes a `↻ Re-assess` link in the top-right corner (visible on hover; OPERATOR+ role required).

**Incidents indicator (below dashboard):**
```
─────────────────────────────────────────────────────────────────────────
✓  No active incidents
─────────────────────────────────────────────────────────────────────────
```

**Active overrides summary (below incidents):**
```
─────────────────────────────────────────────────────────────────────────
Active overrides: 1   (L4: 1)                  [Manage overrides →]
─────────────────────────────────────────────────────────────────────────
```

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| System Status Bar | Fixed top, full width, 48px | Platform nav, user menu |
| Venue Identity Header | Below status bar, full width, ~96px, persistent | Does not scroll |
| Zone A | Left, 280px, full height below header | Fixed position |
| Tab strip | Top of Zone B, below header | [Overview] underlined |
| Status Dashboard | Zone B, top section | 4-3 card grid |
| Incidents indicator | Zone B, below dashboard | Single line |
| Active overrides summary | Zone B, below incidents | Single line + link |
| ↻ Re-assess | Each status card, top-right | Hover-visible, OPERATOR+ |

---

### Interaction Notes

- **Tab switching:** Clicking any tab label navigates to that tab's route; URL updates (e.g., /venues/vn-0042/screens). Active tab underline updates immediately.
- **Venue switching:** Clicking a venue in Zone A list navigates to /venues/[new_venue_id]. Header and all tab content reload.
- **← All Venues:** Returns to Live Ops surface (/live-ops or equivalent multi-venue route).
- **↻ Re-assess:** On click, card enters loading state (spinner replaces value), result replaces current value within 120s. Audit event: `venue:status:reassessment-triggered`.
- **Manage overrides →:** Navigates to Tab 4 (/venues/vn-0042/overrides).
- **View in Incident Commander →:** Present only when incidents exist; navigates to IC surface.
- **Data polling:** Status cards refresh on each poll cycle. No manual refresh button — data is live.

---

### Disabled-State Behavior

- In LIVE healthy state, all OPERATOR controls are active.
- EMERGENCY_FREEZE: ↻ Re-assess becomes disabled (visible, not absent) with tooltip "Unavailable during Emergency Freeze".

---

### Replay-State Behavior

- This surface shows live venue state. It does not enter replay mode.
- The History tab (Tab 6) links to the Replay & Forensics surface for deep investigation.
- No replay banner appears on this surface unless the operator has navigated here from a forensics surface and a context parameter is passed (out of scope for this wireframe).

---

### Degraded-State Behavior

- If any status dimension becomes DEGRADED, that card shows amber left border and amber value text.
- If a signal is UNKNOWN, card shows grey left border, grey text, "Signal unavailable — last known value: [value] ([age] ago)".
- Stale data: "STALE" badge in amber added to card. Expired data: "EXPIRED" badge in red.
- HEALTH basis section lists the specific failing signal: e.g., "Memory pressure: 91% (threshold: 85%)".

---

### Incident-State Behavior

- Machine state badge turns red "INCIDENT".
- Active incidents indicator shows: "⚠ 2 active incidents — S1 (Declared), S3 (Watching)  [View in Incident Commander →]".
- Zone A active incident panel appears at bottom.
- HEALTH card transitions to CRITICAL or FAILED per incident severity.
- Amber bar below status dashboard: "Incident declared — this venue's health data reflects incident conditions".
- No "Declare Incident" button on this surface.

---

### Accessibility Notes

- Tab strip: `role="tablist"`, each tab `role="tab"`, `aria-selected="true"` on active tab, keyboard navigable with arrow keys.
- Status cards: `role="region"` with `aria-label="[DIMENSION] status"`. State value has `aria-live="polite"` for poll updates.
- Machine state badge: `aria-label="Machine state: LIVE"`.
- ↻ Re-assess: `aria-label="Re-assess [DIMENSION] status"`, keyboard focusable.
- Zone A venue list: `role="list"`, active venue `aria-current="page"`.
- Zone A nav shortcuts: `role="navigation"`, active item `aria-current="page"`.
- All color-coded states have text labels — no information conveyed by color alone.

---

---

## WF-VO-02: Venue Overview — OFFLINE State with 72-Hour Autonomy Clock

**ID:** WF-VO-02
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042
**Role:** OPERATOR
**Venue state:** OFFLINE
**Active tab:** Tab 1 — Overview
**Purpose:** Venue has lost connectivity; player is operating autonomously; autonomy clock is prominently displayed; recovery workflow is available.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    VENUE IDENTITY HEADER (persistent)                               │
│  ┌──────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐ │
│  │ Paddington RSL           │  │  ┌──────────────────┐  │  │ Last corpus sync:    │ │
│  │ venue_id: vn-0042        │  │  │     OFFLINE      │  │  │ 10 hours ago (amber) │ │
│  │ [NETWORK] Licensed Club  │  │  └──────────────────┘  │  │                      │ │
│  └──────────────────────────┘  │  (120×40px #64748b bg) │  │ ┌──────────────────┐ │ │
│                                │                        │  │ │AUTONOMOUS        │ │ │
│                                │  [LIVE→OFFLINE]14:32   │  │ │OPERATION         │ │ │
│                                │  (only 1 transition    │  │ │47h 23m remaining │ │ │
│                                │   shown — fewer than 3)│  │ │Player serving    │ │ │
│                                └────────────────────────┘  │ │content w/o sync  │ │ │
│                                                            │ │Corpus:           │ │ │
│                                                            │ │vn-0042-corpus-v31│ │ │
│                                                            │ └──────────────────┘ │ │
│                                                            └──────────────────────┘ │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │  ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                                                           │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │ ┌─────────────────────────────────────────────────────────────────┐ │
│ ▌ Paddington  │ │  VENUE OFFLINE — Connectivity lost 6h 14m ago              ⚠   │ │
│   RSL         │ │  Player is operating autonomously. 47h 23m of autonomy remaining│ │
│   vn-0042     │ │                                                                 │ │
│               │ │  [ Begin Recovery Workflow ]                                    │ │
│   Sydney CBD  │ └─────────────────────────────────────────────────────────────────┘ │
│   RSL         │ (slate-gray background, left border #f59e0b amber)                 │
│               │                                                                     │
│   Pyrmont RSL │  STATUS DASHBOARD — 7 DIMENSIONS                                   │
│               │                                                                     │
│   Glebe RSL   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│               │  │▌ HEALTH      │ │▌ TRUST       │ │| CONFIDENCE  │ │| FRESHNESS │ │
│ ─────────────│  │  DEGRADED    │ │  TRUSTED     │ │  MEDIUM      │ │  STALE     │ │
│ NAVIGATION   │  │  (amber)     │ │  (green)     │ │  (amber)     │ │  (amber)   │ │
│               │  │  ● MEDIUM   │ │  ● HIGH      │ │  ● MEDIUM    │ │  STALE▲   │ │
│  Overview ◀  │  │  Heartbeat   │ │  Last known  │ │  Heartbeat   │ │  Last upd. │ │
│  Screens     │  │  timeout     │ │  hash intact │ │  unavailable │ │  6h 14m ago│ │
│  Content     │  │  6h 14m ago  │ │  (cached)    │ │              │ │  (window:  │ │
│  Overrides   │  └──────────────┘ └──────────────┘ └──────────────┘ │  5m)       │ │
│  PRE State   │                                                       └────────────┘ │
│  History     │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│               │  │| READINESS   │ │| CONNECTIVITY│ │▌ INTEGRITY   │               │
│               │  │  NOT_READY   │ │  DISCONNECTED│ │  VERIFIED    │               │
│               │  │  (red)       │ │  (red)       │ │  (green)     │               │
│               │  │  ● LOW       │ │  ● NONE      │ │  ● HIGH      │               │
│               │  │  ✓ Player:   │ │  Last hbt:   │ │  Hash:       │               │
│               │  │    LIVE      │ │  6h 14m ago  │ │  a3f9...c21b │               │
│               │  │  ✓ Corpus:   │ │              │ │  verified    │               │
│               │  │    VERIFIED  │ │  Autonomy:   │ │  4h 32m ago  │               │
│               │  │  ✓ Clock:OK  │ │  47h 23m     │ │              │               │
│               │  │  ✗ Hbt:      │ │  remaining   │ │              │               │
│               │  │    MISSING   │ │  (amber text)│ │              │               │
│               │  └──────────────┘ └──────────────┘ └──────────────┘               │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────    │
│               │  Incident status unavailable — cannot confirm no active incidents  │
│               │  (amber text — absent API response, NOT empty array)               │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Venue Identity Header Detail — OFFLINE State

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT                          CENTER                            RIGHT               │
│  ─────────────────────         ────────────────────────────     ─────────────────── │
│  Paddington RSL                ┌──────────────────────────┐     Last corpus sync:   │
│  (20px semibold)               │         OFFLINE          │     10 hours ago        │
│                                └──────────────────────────┘     (amber text — >48h  │
│  venue_id: vn-0042             (120×40px pill, #64748b bg,       not yet triggered)  │
│  [NETWORK] Licensed Club       white text)                                           │
│                                                                  ┌─────────────────┐ │
│                                Machine state history strip:      │ AUTONOMOUS      │ │
│                                [LIVE→OFFLINE]                    │ OPERATION       │ │
│                                2026-06-02 14:32 AEST             │                 │ │
│                                (only one transition recorded;    │ 47h 23m         │ │
│                                 strip shows available entries    │ remaining       │ │
│                                 only — no placeholders)          │ (amber text,    │ │
│                                                                  │ 24h–48h range)  │ │
│                                                                  │                 │ │
│                                                                  │ Player serving  │ │
│                                                                  │ content without │ │
│                                                                  │ sync            │ │
│                                                                  │                 │ │
│                                                                  │ Corpus:         │ │
│                                                                  │ vn-0042-        │ │
│                                                                  │ corpus-v31      │ │
│                                                                  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**72-Hour Autonomy Clock — color progression at 47h 23m remaining (24h–48h range = amber):**
- Clock text: amber (#f59e0b)
- Background: transparent (not yet in red tint range)
- No "Autonomy low" label at this range
- Format: "47h 23m remaining" — always NNh NNm format, never decimal hours

**Autonomy clock appears in 4 locations:**
1. Header right section (shown above)
2. CONNECTIVITY card basis section: "In autonomous operation for 6h 14m — 47h 23m remaining"
3. Tab 3 Content Delivery corpus panel: "Autonomous operation: 47h 23m remaining" (not shown in this wireframe)
4. Zone A (not present — Zone A does not have autonomy clock per layout model)

---

### 72-Hour Autonomy Clock — Critical State (for reference, <6h remaining)

```
┌───────────────────────────────────┐
│ AUTONOMOUS OPERATION              │  ← pulsing border (2s cycle, opacity 1.0→0.5→1.0)
│                                   │  ← red tint background (#fef2f2)
│ AUTONOMY CRITICAL                 │  ← red bold label added at <6h
│ 5h 44m remaining                  │  ← red bold text (#ef4444)
│ Player serving content without    │
│ sync                              │
│ Corpus: vn-0042-corpus-v31        │
└───────────────────────────────────┘
```

---

### OFFLINE Venue — Recovery Workflow Overlay

Clicking "Begin Recovery Workflow" replaces Zone B entirely with a full-screen overlay. Zone A remains visible. Zone C (if present) collapses.

```
┌───────────────┬─────────────────────────────────────────────────────────────────────┐
│ ← All Venues  │                                                                     │
│               │  VENUE RECOVERY — Paddington RSL                                   │
│ Search venues │                                                                     │
│ [           ] │  Step 1 of 5: Confirm Venue Connectivity                           │
│               │  ─────────────────────────────────────────────────────────────────│
│ ▌ Paddington  │                                                                     │
│   RSL         │  Confirm that the venue network is accessible.                     │
│               │                                                                     │
│   Sydney CBD  │  ☐  Venue internet connection is physically active                 │
│   RSL         │     (check router/switch)                                          │
│               │  ☐  Venue is reachable by network ping from the                    │
│   Pyrmont RSL │     operations centre                                              │
│               │  ☐  No scheduled maintenance window is active for                  │
│   Glebe RSL   │     this venue                                                     │
│               │                                                                     │
│ ─────────────│  [ Mark Step 1 Complete ]  ← disabled until all checkboxes ticked  │
│ NAVIGATION   │  [ Cancel Recovery ]                                                │
│               │  ─────────────────────────────────────────────────────────────────│
│  Overview ◀  │                                                                     │
│  Screens     │  Step progress indicator:                                           │
│  Content     │  ① ── ② ── ③ ── ④ ── ⑤                                             │
│  Overrides   │  (step 1 highlighted, steps 2–5 grayed out)                        │
│  PRE State   │                                                                     │
│  History     │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

**Step 4 — System-assisted (corpus hash verification):**
```
  Step 4 of 5: Verify Corpus Integrity
  ─────────────────────────────────────────────────────────────────────
  Waiting for corpus verification...  ⠋ (spinner)
  (system-automated — this step will advance automatically)

  ─────────────────────────────────────────────────────────────────────
  [ Cancel Recovery ]   ← "Mark Step Complete" button absent during automation
```

**Recovery workflow — VIEWER role:**
- VIEWER sees the OFFLINE banner without the "Begin Recovery Workflow" button.
- Banner text only: "Venue is operating autonomously. 47h 23m of autonomy remaining."

---

### Zone A Detail — OFFLINE State

Same structure as WF-VO-01 Zone A. No active incident panel (no incident declared). Venue list item for "Paddington RSL" has a slate/offline visual indicator (dim icon or muted text color) next to the name.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| 72h Autonomy Clock panel | Header right section | Appears when offline; amber at 47h |
| OFFLINE recovery banner | Zone B, top of Tab 1, above status dashboard | Amber border |
| Begin Recovery Workflow | Inside recovery banner | OPERATOR/ADMIN; absent for VIEWER |
| CONNECTIVITY card | Status dashboard row 2 | Red left border, DISCONNECTED value |
| READINESS card | Status dashboard row 2 | Red left border, NOT_READY value |
| FRESHNESS card | Status dashboard row 1 | Amber border, STALE value + badge |
| Recovery workflow overlay | Full Zone B | Replaces all tab content when active |

---

### Interaction Notes

- "Begin Recovery Workflow" opens a full-screen overlay replacing Zone B. Zone A remains.
- Each recovery step: all checkboxes must be ticked before "Mark Step N Complete" activates.
- "Mark Step N Complete" emits `venue:recovery:step-completed`.
- "Cancel Recovery" shows confirmation before dismissing. Emits `venue:recovery:workflow-cancelled`.
- Step 4 auto-advances when corpus hash verification result is received.
- After Step 5 completion: overlay closes, dashboard returns to normal view.

---

### Disabled-State Behavior

- VIEWER role: "Begin Recovery Workflow" button absent from DOM.
- EMERGENCY_FREEZE: "Begin Recovery Workflow" disabled, tooltip "Unavailable during Emergency Freeze".

---

### Replay-State Behavior

- This surface reflects last known venue state. All status cards show "last known value: [value] ([age] ago)" basis text when data is stale.
- Corpus sync log on Tab 3 shows the last recorded sync events.

---

### Degraded-State Behavior

This wireframe IS the degraded state (OFFLINE/DISCONNECTED). Key behaviors:
- CONNECTIVITY card: red left border, "DISCONNECTED", basis "Last heartbeat: 6h 14m ago".
- HEALTH card: amber "DEGRADED" (heartbeat timeout is a degradation signal).
- FRESHNESS card: amber "STALE" with STALE badge.
- READINESS card: red "NOT_READY", basis includes ✗ Heartbeat: MISSING.
- Content Delivery tab (Tab 3): pending items show "Delivery blocked — venue offline" column.

---

### Incident-State Behavior

- If an incident is declared while OFFLINE: machine state badge turns red "INCIDENT", active incident panel appears in Zone A.
- OFFLINE + INCIDENT is a valid combined state. The OFFLINE recovery banner and the incident indicator both appear on Tab 1.

---

### Accessibility Notes

- Autonomy clock panel: `role="status"`, `aria-label="Autonomy clock: 47 hours 23 minutes remaining"`, `aria-live="polite"` for countdown updates.
- OFFLINE banner: `role="alert"`, `aria-live="assertive"`.
- Recovery workflow overlay: `role="dialog"`, `aria-modal="true"`, `aria-label="Venue Recovery Workflow"`. Focus trapped within overlay on open.
- Checkboxes in recovery steps: standard `<input type="checkbox">` with associated `<label>`.
- Step progress indicator: `aria-label="Recovery workflow: step 1 of 5"`.

---

---

## WF-VO-03: Venue Overview — RECOVERED_BUT_UNTRUSTED State

**ID:** WF-VO-03
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042
**Role:** OPERATOR
**Venue state:** LIVE (machine state), RECOVERED_BUT_UNTRUSTED (trust protocol flag)
**Active tab:** Tab 1 — Overview
**Purpose:** Venue has reconnected after offline period; corpus hash verification is in progress; venue must not be treated as healthy until verification completes.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    VENUE IDENTITY HEADER (persistent)                               │
│  ┌──────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐ │
│  │ Paddington RSL           │  │  ┌──────────────────┐  │  │ Last corpus sync:    │ │
│  │ venue_id: vn-0042        │  │  │       LIVE       │  │  │ 6 hours ago          │ │
│  │ [NETWORK] Licensed Club  │  │  └──────────────────┘  │  │ (amber — >4h stale   │ │
│  └──────────────────────────┘  │  (green pill)          │  │  but <48h)           │ │
│                                │  ┌──────────────────┐  │  └──────────────────────┘ │
│                                │  │    UNTRUSTED     │  │                           │
│                                │  └──────────────────┘  │                           │
│                                │  (secondary badge,amber)│                           │
│                                │  [OFFLINE→SYNCING]15:18│                           │
│                                │  [SYNCING→LIVE] 15:23  │                           │
│                                └────────────────────────┘                           │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │  ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                                                           │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │ ┌─────────────────────────────────────────────────────────────────┐ │
│ ▌ Paddington  │ │  RECOVERED — VERIFICATION PENDING                               │ │
│   RSL         │ │  ─────────────────────────────────────────────────────────────  │ │
│   vn-0042     │ │  This venue has reconnected but corpus integrity has not yet     │ │
│               │ │  been verified. Content continues to be served from the          │ │
│ Zone A note:  │ │  autonomy corpus. This venue is NOT counted as HEALTHY until     │ │
│ "Corpus verif │ │  verification completes.                                         │ │
│  pending —    │ │                                                                   │ │
│  venue        │ │  Reconnected at:  2026-06-02 15:18 AEST (5m ago)               │ │
│  UNTRUSTED"   │ │  Verification:    Corpus hash check in progress...  ●●●         │ │
│ (amber note   │ │                   (●●● animated, 1s left-to-right scroll)       │ │
│  at bottom    │ │                                                                   │ │
│  of Zone A,   │ │  Steps remaining:                                               │ │
│  not incident │ │  ✓  Heartbeat received (CURRENT)        (green checkmark)       │ │
│  shortcut)    │ │  ✗  Corpus hash not yet verified        (grey ✗ — pending)      │ │
│               │ │  ✗  Clock sync confirmation pending     (grey ✗ — pending)      │ │
│ ─────────────│ │                                                                   │ │
│ NAVIGATION   │ │  [ Request Re-Verification ]   ← OPERATOR/ADMIN only            │ │
│               │ └─────────────────────────────────────────────────────────────────┘ │
│  Overview ◀  │ (amber background, amber left border — full width panel)            │
│  Screens     │                                                                     │
│  Content     │  STATUS DASHBOARD — 7 DIMENSIONS                                   │
│  Overrides   │                                                                     │
│  PRE State   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  History     │  │▌ HEALTH      │ │| TRUST        │ │▌ CONFIDENCE  │ │▌ FRESHNESS │ │
│               │  │  HEALTHY     │ │  UNTRUSTED   │ │  MEDIUM      │ │  CURRENT   │ │
│               │  │  (green)     │ │  (red text)  │ │  (amber)     │ │  (green)   │ │
│               │  │  ● HIGH      │ │  ● MEDIUM    │ │  ● MEDIUM    │ │  ● HIGH    │ │
│               │  │  All signals │ │  Venue reconn│ │  Reconnect   │ │  Updated   │ │
│               │  │  within bnd  │ │  — corpus    │ │  confirmed,  │ │  2m ago    │ │
│               │  │              │ │  hash verif. │ │  verification│ │            │ │
│               │  │              │ │  pending     │ │  outstanding │ │            │ │
│               │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│               │   green left bdr   red left border   amber left bdr  green left bdr │
│               │                                                                     │
│               │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│               │  │| READINESS   │ │▌ CONNECTIVITY│ │| INTEGRITY    │               │
│               │  │  ASSESSING   │ │  CONNECTED   │ │  UNVERIFIED  │               │
│               │  │  (blue,pulse)│ │  (green)     │ │  (amber)     │               │
│               │  │  ● MEDIUM    │ │  ● HIGH      │ │  ● MEDIUM    │               │
│               │  │  ✓ Player:   │ │  10/10 hbts  │ │  Hash check  │               │
│               │  │    LIVE      │ │  received    │ │  initiated at│               │
│               │  │  ✗ Corpus:   │ │  Last hbt:   │ │  reconnection│               │
│               │  │    Not verif.│ │  23s ago     │ │  — awaiting  │               │
│               │  │  ✓ Clock:1s  │ │              │ │  result      │               │
│               │  │  ✓ Hbt: OK   │ │              │ │              │               │
│               │  └──────────────┘ └──────────────┘ └──────────────┘               │
│               │  blue left border  green left bdr   amber left bdr                 │
│               │  (pulsing anim.)                                                    │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────    │
│               │  No active incidents  ✓                                            │
│               │  Active overrides: 1  (L4: 1)   [Manage overrides →]              │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Venue Identity Header Detail — RECOVERED_BUT_UNTRUSTED

```
CENTER section — two badges stacked:
┌──────────────────────────┐
│           LIVE           │  ← Primary machine state badge (120×40px, #22c55e)
└──────────────────────────┘
┌──────────────────────────┐
│        UNTRUSTED         │  ← Secondary badge (smaller, amber #f59e0b bg, white text)
└──────────────────────────┘

Machine state history strip:
[OFFLINE→SYNCING] 2026-06-02 15:18 AEST   [SYNCING→LIVE] 2026-06-02 15:23 AEST
(2 transitions shown)
```

---

### RECOVERED_BUT_UNTRUSTED Banner — Full Specification

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  RECOVERED — VERIFICATION PENDING                                                   │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  This venue has reconnected but corpus integrity has not yet been verified.         │
│  Content continues to be served from the autonomy corpus.                           │
│  This venue is NOT counted as HEALTHY until verification completes.                 │
│                                                                                     │
│  Reconnected at:   2026-06-02 15:18 AEST (5m ago)                                 │
│  Verification:     Corpus hash check in progress...  ●●●                           │
│                    (●●● animated: scrolls left to right at 1s interval)            │
│                                                                                     │
│  Steps remaining:                                                                   │
│  ✓  Heartbeat received (CURRENT)         ← green checkmark — complete              │
│  ✗  Corpus hash not yet verified         ← grey ✗ — NOT red; pending, not failure  │
│  ✗  Clock sync confirmation pending      ← grey ✗ — pending                       │
│                                                                                     │
│  [ Request Re-Verification ]                                                        │
│    ↑ OPERATOR/ADMIN only. Absent for VIEWER.                                       │
│    On click: shows confirmation "Request immediate corpus re-verification?"        │
│    On confirm: button enters loading state, spinner replaces animated dots         │
│    Audit event: venue:corpus:re-verification-requested                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
  Background: amber (#fef3c7)
  Left border: 4px amber (#f59e0b)
  Full width of Zone B
```

**Important visual distinction — grey ✗ (pending) vs red ✗ (failure):**
- Grey ✗: condition not yet evaluated — this is a pending state, not an error
- Red ✗: condition evaluated and failed
- The RECOVERED_BUT_UNTRUSTED banner uses grey ✗ for pending conditions

---

### Corpus Integrity Failure Variant (MISMATCH — hash check returned mismatch)

This is a distinct state from UNVERIFIED. Shown for reference when corpus check completes with a mismatch:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  CORPUS INTEGRITY FAILURE                                            CRITICAL ⚠     │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  This venue has reconnected but the corpus hash does not match.                     │
│  Content being served may not match the platform-approved corpus.                   │
│                                                                                     │
│  Computed hash:  a3f9c21b...d445ee18                                               │
│  Expected hash:  9f12e3aa...8b21cc04                                               │
│  Mismatch detected at: 2026-06-02 15:23 AEST                                      │
│                                                                                     │
│  This venue is NOT counted as HEALTHY and NOT counted as TRUSTED.                  │
│  Operator acknowledgement required before this venue contributes                   │
│  to fleet-level decisions.                                                          │
│                                                                                     │
│  [ Acknowledge and Investigate ]  ← ADMIN only. Absent for OPERATOR and VIEWER.   │
│    Navigates to Replay & Forensics surface with venue + mismatch timestamp         │
│    pre-selected.                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
  Background: #fef2f2 (light red)
  Left border: 4px red (#ef4444)
  All-sides red border on INTEGRITY card (not just left border)
  INTEGRITY card value: "MISMATCH ✗" in red bold
```

---

### Zone A Detail — RECOVERED_BUT_UNTRUSTED

```
┌─────────────────────────────┐
│ ← All Venues                │
│                             │
│ Search venues...            │
│ [                         ] │
│                             │
│ ▌ Paddington RSL            │
│   vn-0042                   │
│                             │
│   Sydney CBD RSL            │
│   Pyrmont RSL               │
│   Glebe RSL                 │
│                             │
│ ─────────────────────────── │
│ VENUE NAVIGATION            │
│                             │
│ ▌ Overview                  │
│   Screens                   │
│   Content                   │
│   Overrides                 │
│   PRE State                 │
│   History                   │
│                             │
│ ─────────────────────────── │
│ ⚠ Corpus verification       │
│   pending — venue UNTRUSTED │
│   (amber note, non-incident)│
└─────────────────────────────┘
```

Note: This is NOT the active incident shortcut panel. It is a non-incident status note that appears in Zone A when the venue is in RECOVERED_BUT_UNTRUSTED state. It does not link to the Incident Commander surface.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| LIVE badge (primary) | Header center | Green, 120×40px |
| UNTRUSTED badge (secondary) | Header center, below LIVE badge | Amber, smaller pill |
| RECOVERED_BUT_UNTRUSTED banner | Zone B, top of Tab 1 | Full-width, amber bg |
| Request Re-Verification button | Inside banner | OPERATOR/ADMIN only |
| TRUST card | Status dashboard row 1 | Red left border, UNTRUSTED |
| INTEGRITY card | Status dashboard row 2 | Amber left border, UNVERIFIED |
| READINESS card | Status dashboard row 2 | Blue pulsing border, ASSESSING |
| CONNECTIVITY card | Status dashboard row 2 | Green left border, CONNECTED |
| Zone A status note | Zone A bottom | Amber text, non-incident |

---

### Interaction Notes

- "Request Re-Verification": confirmation dialog appears; on confirm, animated dots become a spinner; audit event emitted.
- When verification completes (success): banner disappears, TRUST→TRUSTED, INTEGRITY→VERIFIED, READINESS→READY. No "congratulations" message — card color changes are the signal.
- When verification fails (mismatch): banner transitions to CORPUS INTEGRITY FAILURE variant.
- CONNECTIVITY card: green because connectivity IS restored. Trust and integrity are orthogonal to connectivity.

---

### Disabled-State Behavior

- VIEWER: "Request Re-Verification" button absent from DOM.
- VIEWER: Banner text visible but no action controls.
- OPERATOR: "Acknowledge and Investigate" (mismatch variant) absent from DOM — ADMIN only.

---

### Replay-State Behavior

- Tab 5 (PRE Resolution) shows warning: "⚠ RECOVERED_BUT_UNTRUSTED — PRE resolutions are flagged UNTRUSTED_INPUT. Resolution outputs during this period are recorded with reduced confidence. This flag will clear when corpus verification completes."

---

### Degraded-State Behavior

- TRUST card is actively degraded (UNTRUSTED). This is the defining characteristic of this state.
- INTEGRITY card is UNVERIFIED (amber) — not MISMATCH unless hash check returns mismatch.
- READINESS card is ASSESSING (blue pulsing) — not READY.
- HEALTH card may be HEALTHY if all monitored signals are within bounds — HEALTH is independent of trust state.

---

### Incident-State Behavior

- If an incident is declared concurrently, the active incident panel appears in Zone A in addition to the Zone A trust note.
- Both indicators are present simultaneously.

---

### Accessibility Notes

- RECOVERED_BUT_UNTRUSTED banner: `role="alert"`, `aria-live="assertive"`, `aria-label="Venue recovery verification pending"`.
- Animated dots (●●●): `aria-label="Corpus hash verification in progress"`, `aria-live="off"` (animation is decorative; status is conveyed by text).
- UNTRUSTED secondary badge: `aria-label="Trust status: UNTRUSTED"`.
- READINESS card pulsing animation: CSS animation only; card value text and basis are the accessible representation.
- Grey ✗ symbols in steps: `aria-label="pending"` (not "error" or "failed").

---

---

## WF-VO-04: Screen Management — ADMIN — Screen Enrollment Flow

**ID:** WF-VO-04
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042/screens
**Role:** ADMIN
**Venue state:** LIVE
**Active tab:** Tab 2 — Screens
**Purpose:** ADMIN enrolls a new screen via the 3-step modal; screen list shows enrolled screens with per-row expand and overflow controls.

---

### Desktop Layout (1440px viewport) — Screen List View

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]   admin.user [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    VENUE IDENTITY HEADER (persistent)                               │
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE] 14:32  [OFFLINE→SYNCING]     │
│  Licensed Club                      │  15:18  [SYNCING→LIVE] 15:23                 │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │             ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                                                  │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │  SCREEN MANAGEMENT                              [+ Enroll New Screen]│
│ ▌ Paddington  │                                                                     │
│   RSL         │  SCREEN NAME       DEVICE ID       MACHINE STATE  LAST HBT  STATUS │
│   vn-0042     │  ─────────────────────────────────────────────────────────────────  │
│               │  Main Bar          dev-0042-001    [  LIVE  ]     23s ago    ✓      │
│   Sydney CBD  │  Lounge A          dev-0042-002    [ OFFLINE]     6h 14m ago ✗  ▾  │
│   RSL         │                                                   (red text)        │
│               │  ┌──────────────────────────────────────────────────────────────┐  │
│   Pyrmont RSL │  │  Machine state history:                                      │  │
│               │  │  [LIVE→OFFLINE] 2026-06-02 08:47 AEST                       │  │
│   Glebe RSL   │  │  (only one transition recorded)                              │  │
│               │  │                                                              │  │
│ ─────────────│  │  Corpus hash:    a3f9...c21b  ✓ MATCH vs venue corpus        │  │
│ NAVIGATION   │  │  Current content: vn-0042-corpus-v31 / Summer Promo v2       │  │
│               │  │  PRE level:      L4 — Operator Override                     │  │
│  Overview    │  │  Active overrides: ov-0044 (L4)                              │  │
│  Screens ◀   │  │  Last error:     Heartbeat timeout — no response 6h 14m      │  │
│  Content     │  │                                                              │  │
│  Overrides   │  │  [View this screen's content history →]                      │  │
│  PRE State   │  └──────────────────────────────────────────────────────────────┘  │
│  History     │                                                                     │
│               │  Entrance          dev-0042-003    [DEGRADED]     45s ago    ⚠  ▾  │
│               │  TAB Terminal      dev-0042-004    [  LIVE  ]     18s ago    ✓  ...│
│               │                                                 (... = overflow btn)│
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

**Screen row visual rules:**
- LIVE rows: no expand control (✓ only)
- Non-LIVE rows: [Expand ▾] control appears; expanded row shows sub-panel
- Last heartbeat amber when >5m ago; red when >1h ago
- Status column: ✓ green (LIVE), ✗ red (OFFLINE/FAILED), ⚠ amber (DEGRADED)
- ADMIN role: `...` overflow menu on each row (contains "Remove Screen")
- OPERATOR/VIEWER: no `...` overflow menu

---

### Screen Enrollment Modal — Step 1 (Device Pairing)

Triggered by "+ Enroll New Screen" button (ADMIN only). Opens as a modal overlay (not page navigation). Zone A and Identity Header remain behind the modal overlay.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Enroll New Screen                                            [ × ]  │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Step 1 of 3: Device Pairing                                         │
│ ① ─── ② ─── ③                                                      │
│                                                                     │
│ Enter the pairing code displayed on the device's setup screen.      │
│ The device must be powered on and connected to the venue network.   │
│                                                                     │
│ Device ID *                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ 12-character alphanumeric code (e.g., ABC123DEF456)                 │
│                                                                     │
│ Screen Name *                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ Max 60 characters. e.g., "Main Bar Screen"                          │
│                                                                     │
│ Screen Location                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ Optional. e.g., "Behind bar, facing seating area"                   │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│             [ Cancel ]                [ Verify Device ]             │
└─────────────────────────────────────────────────────────────────────┘
```

**"Verify Device" loading state:**
```
│ ─────────────────────────────────────────────────────────────────── │
│             [ Cancel ]             [ Verifying...  ⠋ ]             │
│                                    (button disabled, spinner shown) │
```

**"Verify Device" failure state:**
```
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✗  Device not found — confirm the device is powered on and      │ │
│ │    re-enter the code.                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ (red border on Device ID field, red error text)                     │
│             [ Cancel ]                [ Verify Device ]             │
```

---

### Screen Enrollment Modal — Step 2 (Screen Configuration)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Enroll New Screen                                            [ × ]  │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Step 2 of 3: Screen Configuration                                   │
│ ① ─── ② ─── ③                                                      │
│                                                                     │
│ Device confirmed:   dev-0042-005    ✓                               │
│ Device model:       ClubHub Pi 4B (64GB)                            │
│                                                                     │
│ Primary Display Zone *                                              │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Select zone...                                              ▾   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ Venue-specific zones (configured in venue settings)                 │
│                                                                     │
│ Content Groups                                                      │
│ ☐ Beverages & Promotions                                            │
│ ☐ TAB & Racing                                                      │
│ ☐ Entertainment & Events                                            │
│ ☐ Compliance & Regulatory                                           │
│ (multi-select checkboxes)                                           │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│    [ Back ]                              [ Enroll Screen ]          │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Screen Enrollment Modal — Step 3 (Confirmation)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Enroll New Screen                                            [ × ]  │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Step 3 of 3: Enrollment Confirmation                                │
│ ① ─── ② ─── ③                                                      │
│                                                                     │
│ ✓  Screen enrolled successfully.                                    │
│                                                                     │
│ Screen Name:     Bottle Shop Entrance                               │
│ Device ID:       dev-0042-005                                       │
│ Enrolled at:     2026-06-02 15:47:23 AEST                          │
│                                                                     │
│ The screen will begin syncing content. It will appear as SYNCING    │
│ in the screen list and transition to LIVE once the corpus is loaded.│
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│                                       [ Done ]                      │
└─────────────────────────────────────────────────────────────────────┘
```

"Done" closes modal and refreshes screen list. New screen appears as [SYNCING] in list.

---

### Screen Removal Confirmation Modal

Triggered by "Remove Screen" in `...` overflow menu (ADMIN only):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Remove Screen                                                [ × ]  │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Remove screen "Lounge A" (dev-0042-002)?                           │
│                                                                     │
│ This will:                                                          │
│ • Unenroll the device from this venue                               │
│ • Remove all content assignments for this screen                    │
│ • Preserve all historical data (this is not deletable)              │
│                                                                     │
│ This action cannot be undone.                                       │
│ The device will need to be re-enrolled to restore service.          │
│                                                                     │
│ Type "Lounge A" to confirm                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│    [ Cancel ]                      [ Remove Screen ]  ← red button  │
│                                    (disabled until text matches)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| + Enroll New Screen | Zone B top-right of tab | ADMIN only; absent for OPERATOR/VIEWER |
| Screen list table | Zone B main area | Column headers + rows |
| Expand ▾ control | Screen row, right of STATUS col | Non-LIVE rows only |
| Screen detail sub-panel | Below expanded row | Inline expansion, not modal |
| ... overflow menu | Screen row, rightmost | ADMIN only |
| Remove Screen (in overflow) | Overflow menu item | ADMIN only |
| Enrollment modal | Full modal overlay | 3 steps, focus trapped |
| Step progress indicator | Modal top | ① ─── ② ─── ③ |

---

### Interaction Notes

- Row expand/collapse: click [▾] to expand; [▴] to collapse. Multiple rows may be expanded simultaneously.
- "+ Enroll New Screen": opens modal, does not navigate.
- Modal "×" or "Cancel": closes without action.
- "Verify Device": calls device pairing API. Button disabled during call.
- "Back" (Step 2): returns to Step 1 with values preserved.
- "Enroll Screen" (Step 2): commits enrollment, advances to Step 3.
- "Done" (Step 3): closes modal, refreshes screen list.
- "View this screen's content history →": navigates to Content tab (Tab 3) filtered by this device.
- Overflow `...` menu: click to open, click away or press Escape to close.

---

### Disabled-State Behavior

- OPERATOR: "+ Enroll New Screen" absent from DOM. No overflow `...` menu on rows.
- VIEWER: Same as OPERATOR for write controls.
- EMERGENCY_FREEZE: "+ Enroll New Screen" disabled (visible) with tooltip. "Remove Screen" disabled.
- DECOMMISSIONED venue: entire tab read-only; "+ Enroll New Screen" absent.

---

### Replay-State Behavior

- Screen list reflects current state. Historical screen state changes visible in screen detail expand (machine state history strip).
- "View this screen's content history →" navigates to Content tab filtered by device.

---

### Degraded-State Behavior

- Rows with DEGRADED or OFFLINE screens show amber/red treatment.
- Expanded DEGRADED row: "Last reported error" field shows specific error text.
- Stale heartbeat (>5m): amber text. Very stale (>1h): red text.

---

### Incident-State Behavior

- Screen rows linked to an active incident may show an incident badge next to STATUS column.
- No incident controls present on this tab; link to IC surface via Zone A active incident panel.

---

### Accessibility Notes

- Screen list table: `role="table"`, `<thead>` and `<tbody>` elements, column headers with `scope="col"`.
- Expand control: `aria-expanded="false"/"true"`, `aria-controls="screen-detail-[device_id]"`.
- Machine state badge in row: `aria-label="Machine state: [STATE]"`.
- Enrollment modal: `role="dialog"`, `aria-modal="true"`, focus trapped. `aria-label="Enroll New Screen — Step [N] of 3"`.
- Step progress: `role="progressbar"` or `aria-label="Step N of 3"`.
- "Remove Screen" confirmation: text input has `aria-required="true"`, `aria-describedby` pointing to instruction text.

---

---

## WF-VO-05: Content Delivery — OPERATOR — Delivery Health

**ID:** WF-VO-05
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042/content
**Role:** OPERATOR
**Venue state:** LIVE
**Active tab:** Tab 3 — Content
**Purpose:** Shows corpus status, pending content items, upcoming sync schedule, and corpus sync log for a healthy LIVE venue.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE]14:32 [OFFLINE→SYNCING]15:18  │
│  Licensed Club                      │  [SYNCING→LIVE]15:23                         │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │                        ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                                        │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │ ┌──────────────────────────────────────────────────────────────────┐│
│ ▌ Paddington  │ │ CORPUS STATUS                                                    ││
│   RSL         │ │                                                                  ││
│   vn-0042     │ │ Current corpus hash:   a3f9c21b...d445ee18                       ││
│               │ │ Hash status:           VERIFIED ✓    Last verified: 4h 32m ago   ││
│   Sydney CBD  │ │                        (green text)                              ││
│   RSL         │ │ Corpus version:        vn-0042-corpus-v31                        ││
│               │ │ Last sync:             2026-06-02 10:14 AEST                     ││
│   Pyrmont RSL │ │                                                                  ││
│               │ │   ← "Request Manual Sync" button absent for OPERATOR role        ││
│   Glebe RSL   │ └──────────────────────────────────────────────────────────────────┘│
│               │                                                                     │
│ ─────────────│  ─────────────────────────────────────────────────────────────────  │
│ NAVIGATION   │  PENDING CONTENT ITEMS                                              │
│               │                                                                     │
│  Overview    │  CONTENT ITEM              TYPE        DELIVERY WINDOW    STATUS    │
│  Screens     │  ─────────────────────────────────────────────────────────────────  │
│  Content ◀   │  Summer Promo Bundle v3    Campaign    In 2h 14m          Queued    │
│  Overrides   │  TAB Odds Update 14:30     Scheduled   In 47m             Queued    │
│  PRE State   │  Emergency Contact Refresh Mandatory   Next sync          Pending   │
│  History     │                                        verification                │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  DELIVERY QUEUE — Next scheduled syncs                             │
│               │                                                                     │
│               │  SCHEDULED SYNC          ITEMS    AUTONOMY IMPACT                  │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  2026-06-02 16:00 AEST   3 items  Will extend autonomy clock to 72h│
│               │  2026-06-02 22:00 AEST   7 items  Scheduled nightly sync           │
│               │  2026-06-03 10:00 AEST   2 items  Campaign rotation update         │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  CORPUS SYNC LOG                              [< Prev]  [1]  [Next>]│
│               │                                                                     │
│               │  TIMESTAMP              TYPE            HASH              RESULT    │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  2026-06-02 10:14 AEST  Scheduled sync  a3f9c21b...d445  SUCCESS   │
│               │  2026-06-01 22:00 AEST  Nightly sync    a3f9c21b...d445  SUCCESS   │
│               │                                         (no change)                │
│               │  2026-06-01 10:02 AEST  Scheduled sync  9f12e3aa...8b21  SUCCESS   │
│               │  2026-05-31 22:00 AEST  Nightly sync    9f12e3aa...8b21  SUCCESS   │
│               │                                         (no change)                │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  Each row expandable to show full hash values and sync details  ▾  │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Corpus Status Panel — Full Specification

```
┌──────────────────────────────────────────────────────────────────────┐
│ CORPUS STATUS                                                        │
│                                                                      │
│ Current corpus hash:   a3f9c21b...d445ee18                           │
│ Hash status:           VERIFIED ✓    Last verified: 4h 32m ago       │
│                        (green text — only when hash_verified: true   │
│                         AND hash_match: true)                        │
│ Corpus version:        vn-0042-corpus-v31                            │
│ Last sync:             2026-06-02 10:14 AEST                         │
│                                                                      │
│ [OPERATOR role: "Request Manual Sync" button is ABSENT from DOM]     │
└──────────────────────────────────────────────────────────────────────┘
```

**ADMIN view variant — with Request Manual Sync:**
```
│ Last sync:             2026-06-02 10:14 AEST                         │
│                                                                      │
│ [ Request Manual Sync ]  ← ADMIN only                               │
```

**Request Manual Sync confirmation (ADMIN only):**
```
┌──────────────────────────────────────────────────┐
│ Request a manual corpus sync for Paddington RSL? │
│ This will initiate a fresh content sync from     │
│ the platform. The venue will briefly enter       │
│ SYNCING state.                                   │
│                                                  │
│        [ Cancel ]    [ Request Sync ]            │
└──────────────────────────────────────────────────┘
```
After confirmation: button → loading state; corpus status panel shows "Sync requested — awaiting response..."

**Corpus hash status visual treatments:**
- `VERIFIED ✓` — green (#22c55e) — when hash_verified: true AND hash_match: true
- `UNVERIFIED` — amber (#f59e0b) — when hash_verified: false
- `MISMATCH ✗` — red (#ef4444) — when hash_match: false
- `UNKNOWN` — grey (#6b7280) — when corpus_status absent or hash unavailable

**Forbidden:** "VERIFIED" must never appear when hash_verified is false or data is absent.

---

### Pending Content Items — OFFLINE Variant

When venue is offline, each pending item row adds a blocked indicator:

```
CONTENT ITEM              TYPE      DELIVERY WINDOW    STATUS          DELIVERY
─────────────────────────────────────────────────────────────────────────────────
Summer Promo Bundle v3    Campaign  In 2h 14m          Queued          Blocked —
                                                                       venue offline
TAB Odds Update 14:30     Sched.    In 47m             Queued          Blocked —
                                                                       venue offline
```

---

### Delivery Queue — OFFLINE Variant

When offline, Autonomy Impact column changes:
```
SCHEDULED SYNC          ITEMS    AUTONOMY IMPACT
────────────────────────────────────────────────────────────────────
2026-06-02 16:00 AEST   3 items  Delivery blocked — venue must reconnect first
2026-06-02 22:00 AEST   7 items  Delivery blocked — venue must reconnect first
```

---

### Corpus Sync Log — Result Value Treatments

| Result value | Color | Notes |
|---|---|---|
| SUCCESS | Green (#22c55e) | Hash delivered and confirmed |
| SUCCESS (no change) | Green muted (#86efac) | Hash unchanged from previous |
| FAILED | Red (#ef4444) | Sync attempt failed |
| PARTIAL | Amber (#f59e0b) | Some items delivered, some failed |
| ABORTED | Amber (#f59e0b) | Sync cancelled mid-operation |

Each sync log row is expandable (▾) to show:
- Full hash values (untruncated)
- Number of content items in sync
- Duration of sync operation
- Any error details (if FAILED or PARTIAL)

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| Corpus Status panel | Zone B, top of tab | Full width panel |
| Request Manual Sync | Inside corpus panel | ADMIN only; absent for OPERATOR/VIEWER |
| Pending Content Items | Zone B, below corpus panel | Table format |
| Delivery Queue | Zone B, below pending items | Table format |
| Corpus Sync Log | Zone B, bottom | Paginated table, 10 per page default |
| Pagination controls | Right of sync log header | [< Prev] [1] [Next >] |
| Row expand ▾ | Each sync log row | Inline detail expansion |

---

### Interaction Notes

- Corpus Sync Log pagination: 10 rows per page, navigate with Prev/Next or page number.
- Sync log row expand: click row or ▾ to expand; shows full hash values and sync details.
- "Request Manual Sync" (ADMIN): opens 1-click confirmation dialog. On confirm: button loading state, panel text updates.
- No content push controls on this surface (F-04: content delivery managed from CMS surface).

---

### Disabled-State Behavior

- OPERATOR: "Request Manual Sync" absent from DOM.
- VIEWER: same as OPERATOR for write controls.
- EMERGENCY_FREEZE: "Request Manual Sync" disabled with tooltip.

---

### Replay-State Behavior

- Sync log reflects actual historical events — unaffected by current venue state.
- Each sync log entry links to that sync's hash artifacts in Replay & Forensics (not shown as link in this wireframe — TBD by forensics surface).

---

### Degraded-State Behavior

- If corpus hash is UNVERIFIED: "UNVERIFIED" in amber. "VERIFIED" text never shown.
- If corpus hash is MISMATCH: "MISMATCH ✗" in red. Full mismatch detail shown below hash status.
- If OFFLINE: pending items show "Delivery blocked" column; delivery queue shows "Delivery blocked" impact column.

---

### Incident-State Behavior

- If content delivery failure is the cause of an incident: corpus status panel may show FAILED or PARTIAL status. Incident link appears on Overview tab (not this tab).

---

### Accessibility Notes

- Corpus Status panel: `role="region"`, `aria-label="Corpus status"`.
- Hash status value: `aria-label="Hash status: VERIFIED"` (state in label, not just icon).
- Pending items table: `role="table"`, sortable columns if implemented with `aria-sort`.
- Sync log pagination: `aria-label="Corpus sync log pagination"`, current page `aria-current="page"`.
- Row expand: `aria-expanded="false"/"true"`, `aria-controls="sync-detail-[row_id]"`.

---

---

## WF-VO-06: Override History — OPERATOR — Override List

**ID:** WF-VO-06
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042/overrides
**Role:** OPERATOR
**Venue state:** LIVE
**Active tab:** Tab 4 — Overrides
**Purpose:** Shows all active and historical overrides for this venue; OPERATOR may remove L4 own overrides; higher levels require ADMIN.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE]14:32 [SYNCING→LIVE]15:23    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │                                    ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲                          │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │  Active Overrides (3)                                              │
│ ▌ Paddington  │                                                                     │
│   RSL         │ ┌─────────────────────────────────────────────────────────────────┐ │
│   vn-0042     │ │ [L4] Venue Manager Override                        [ACTIVE]     │ │
│               │ │ Content: Summer Drinks Promo v2                                 │ │
│   Sydney CBD  │ │ Placed by: jane.operator@paddingtonrsl.com.au                   │ │
│   RSL         │ │ Placed:    2026-05-28 09:14 AEST                                │ │
│               │ │ Expires:   2026-06-30 23:59 AEST  (28 days remaining)           │ │
│   Pyrmont RSL │ │            (green text — >7 days remaining)                     │ │
│               │ │ Applies to: All screens                                         │ │
│   Glebe RSL   │ │                                                                 │ │
│               │ │ [ Remove Override ]  ← OPERATOR can remove own L4 override     │ │
│ ─────────────│ └─────────────────────────────────────────────────────────────────┘ │
│ NAVIGATION   │                                                                     │
│               │ ┌─────────────────────────────────────────────────────────────────┐ │
│  Overview    │ │ [L5] Scheduled Campaign                         [SUPERSEDED]     │ │
│  Screens     │ │ Content: Weekend Specials Board                                  │ │
│  Content     │ │ Placed by: system@platform.com                                   │ │
│  Overrides ◀ │ │ Placed:    2026-05-26 00:00 AEST                                │ │
│  PRE State   │ │ Expires:   2026-06-09 23:59 AEST  (7 days remaining)            │ │
│  History     │ │            (amber text — ≤7 days remaining)                     │ │
│               │ │ Applies to: All screens                                         │ │
│               │ │                                                                 │ │
│               │ │ Status: SUPERSEDED — this override is active but not winning.   │ │
│               │ │ Superseded by: L4 Override (override_id: ov-0044)              │ │
│               │ │ This override will become effective if the L4 override          │ │
│               │ │ is removed.                                                     │ │
│               │ │                                                                 │ │
│               │ │ ADMIN required to remove this override.                         │ │
│               │ │ (button absent from DOM for OPERATOR — note shown instead)     │ │
│               │ └─────────────────────────────────────────────────────────────────┘ │
│               │                                                                     │
│               │ ┌─────────────────────────────────────────────────────────────────┐ │
│               │ │ [L6] Default Content                             [ACTIVE]       │ │
│               │ │ Content: Standard Drinks Menu                                   │ │
│               │ │ Placed by: setup@platform.com                                   │ │
│               │ │ Placed:    2026-01-01 00:00 AEST                                │ │
│               │ │ Expires:   NEVER  ⚠                                             │ │
│               │ │            (amber text with ⚠ icon — no-expiry override)        │ │
│               │ │ Applies to: All screens                                         │ │
│               │ │                                                                 │ │
│               │ │ ADMIN with elevation required to remove this override.          │ │
│               │ │ (button absent from DOM for OPERATOR)                           │ │
│               │ └─────────────────────────────────────────────────────────────────┘ │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  ▸ Expired & Removed Overrides (12)   ← collapsed by default       │
│               │    Click to expand                                                 │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Override Accumulation Warning (appears when >3 active overrides)

Shown above the Active Overrides section when count > 3:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  Override accumulation: 5 active overrides                                        │
│    Venues with more than 3 concurrent overrides may have competing rules            │
│    and reduced content predictability. Consider reviewing and removing              │
│    expired or unnecessary overrides.                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
  Full-width amber banner. Threshold: >3 active overrides. Not configurable from UI.
  Type: OPERATIONAL_WARNING. Does not appear in alert feed — override tab only.
```

This warning is absent in the main wireframe above (3 active overrides — threshold is strictly >3).

---

### Override Card Detail — Full Specification

**Active override card (L4, OPERATOR can remove):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ [L4] Venue Manager Override                            [ACTIVE]     │
│      (orange badge: #c2410c bg, white text)            (green pill) │
│                                                                     │
│ Content:    Summer Drinks Promo v2                                  │
│ Placed by:  jane.operator@paddingtonrsl.com.au                      │
│ Placed:     2026-05-28 09:14 AEST                                   │
│ Expires:    2026-06-30 23:59 AEST  (28 days remaining)              │
│             (green text — >7 days)                                  │
│ Applies to: All screens                                             │
│                                                                     │
│ [ Remove Override ]                                                 │
│   ↑ Present for OPERATOR (own L4) and ADMIN                        │
│   Hover tooltip shows authority level required                      │
│   Immediate action — no confirmation dialog                         │
│   Audit event: venue:override:removed                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Expiry display rules:**
- >7 days: green text — "(28 days remaining)"
- ≤7 days: amber text — "(7 days remaining)"
- Today: red text — "(EXPIRING TODAY)"
- Never: amber text + ⚠ icon — "NEVER ⚠"

**SUPERSEDED badge:** Grey `[SUPERSEDED]` pill replaces green `[ACTIVE]` pill.

**ACTIVE badge:** Green `[ACTIVE]` pill.

**Override level badges (left side of card title):**
- [L1]: Navy #1e3a5f
- [L2]: Blue #1d4ed8
- [L3]: Teal #0f766e
- [L4]: Orange #c2410c
- [L5]: Red #b91c1c
- [L6]: Deep red #7f1d1d, bold

---

### Authority to Remove — DOM Presence Rules

| Override Level | VIEWER | OPERATOR | ADMIN |
|---|---|---|---|
| L1 Emergency | button absent | button absent | button present (elevation required note) |
| L2 Network Policy | button absent | button absent | button present |
| L3 League/Franchise | button absent | button absent | button present |
| L4 Venue Manager | button absent | button present (own overrides only) | button present |
| L5 Scheduled Campaign | button absent | button absent | button present |
| L6 Default Content | button absent | button absent | button present (elevation required note) |

When OPERATOR lacks authority: button is absent from DOM; note reads "[Role] required to remove this override."

---

### Expired & Removed Overrides — Expanded

Clicking `▸ Expired & Removed Overrides (12)` expands a collapsed section:

```
▾ Expired & Removed Overrides (12)

LEVEL  CONTENT                   PLACED BY             PLACED      ENDED       REASON
─────────────────────────────────────────────────────────────────────────────────────
[L4]   Summer Promo v1           jane.operator@...     2026-04-01  2026-05-01  Expired
[L2]   Network Compliance v3     system@platform       2026-03-15  2026-04-30  Removed by admin
[L6]   Default Drinks Menu       setup@platform        2026-01-01  2026-03-14  Superseded
...    (paginated, 20 per page)

                                                        [< Prev]  [1] [2]  [Next >]
```

Rows in this section are read-only. No expand, no remove controls. Historical record only.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| Override accumulation warning | Zone B, top (conditional) | Amber banner when >3 overrides |
| Active Overrides section header | Zone B | "Active Overrides (N)" |
| Override cards | Zone B, stacked vertically | One card per active override |
| [ACTIVE] / [SUPERSEDED] badge | Top-right of each card | Green / grey pill |
| Level badge [LN] | Top-left of each card title | Color per level |
| Remove Override button | Bottom of each card | Authority-dependent |
| Expired & Removed section | Zone B, below active | Collapsed by default |
| Expired overrides table | Inside collapsed section | 20 per page, paginated |

---

### Interaction Notes

- "Remove Override": immediate action (no confirmation dialog). Audit event emitted. Card disappears; active count decrements.
- Expanded section toggle: `▸`/`▾` control. Preserves state on tab navigation within session.
- Override card hover: "Remove Override" button tooltip shows required authority level.
- Clicking "[L4]" badge or "Manage overrides →" from Tab 1 navigates to this tab.

---

### Disabled-State Behavior

- VIEWER: all Remove Override buttons absent from DOM. Read-only view of all cards and expired section.
- EMERGENCY_FREEZE: "Remove Override" disabled (visible), tooltip "Unavailable during Emergency Freeze".
- DECOMMISSIONED: entire tab read-only; Remove Override absent.

---

### Replay-State Behavior

- Override history is a complete record. Expired & Removed section shows full history regardless of venue state.
- SUPERSEDED overrides note the superseding override by ID and level.

---

### Degraded-State Behavior

- If `override_stack._freshness` is STALE or EXPIRED: amber note below Active Overrides header: "— override data [N] minutes old".
- SUPERSEDED overrides remain displayed; PRE tab (Tab 5) shows the winning level.

---

### Incident-State Behavior

- An override conflict causing an incident will be visible here; link to Incident Commander via Zone A active incident panel.
- Override accumulation warning (>3 overrides) may be a contributing factor — displayed independently.

---

### Accessibility Notes

- Override cards: `role="article"`, `aria-label="[Level] [Label] override — [ACTIVE/SUPERSEDED]"`.
- Level badge: `aria-label="Override level [N]: [Label]"`.
- Expiry text: `aria-label="Expires [datetime], [N] days remaining"` or `"Expires: Never"`.
- Remove Override: `aria-label="Remove override: [content name], [level]"`.
- Collapsed section toggle: `aria-expanded="false"/"true"`, `aria-controls="expired-overrides-section"`.
- Override accumulation warning: `role="alert"`, `aria-live="polite"`.

---

---

## WF-VO-07: PRE Resolution State — OPERATOR — Resolution Tree

**ID:** WF-VO-07
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042/pre
**Role:** OPERATOR
**Venue state:** LIVE
**Active tab:** Tab 5 — PRE State
**Purpose:** Shows the full PRE resolution tree (L0–L6), the winning level, "why this content?" explainability, divergence status, and 24-hour resolution history chart.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE]14:32 [SYNCING→LIVE]15:23    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │                                                 ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲         │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │ ┌──────────────────────────────────────────────────────────────────┐│
│ ▌ Paddington  │ │ PRE RESOLUTION — CURRENT                                         ││
│   RSL         │ │                                                                  ││
│   vn-0042     │ │ Authoritative level:  L4 — Venue Manager Override                ││
│               │ │ Winning content:      Summer Drinks Promo v2                     ││
│   Sydney CBD  │ │ Resolved at:          2026-06-02 14:47:32 AEST                   ││
│   RSL         │ │ Confidence:           HIGH                                        ││
│               │ │                                                                  ││
│   Pyrmont RSL │ │ PRE divergence:       NONE — parity confirmed 12m ago            ││
│               │ └──────────────────────────────────────────────────────────────────┘│
│   Glebe RSL   │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│ ─────────────│  LEVEL-BY-LEVEL BREAKDOWN                                           │
│ NAVIGATION   │                                                                     │
│               │  LEVEL  LABEL                  STATUS          CONTRIBUTION        │
│  Overview    │  ──────────────────────────────────────────────────────────────────  │
│  Screens     │  [L0]   Emergency Override     Not active      —                   │
│  Content     │  [L1]   Constitutional Floor   Not active      —                   │
│  Overrides   │  [L2]   Network Policy         Not active      —                   │
│  PRE State ◀ │  [L3]   League/Franchise       Not active      —                   │
│  History     │  ──────────────────────────── WIN ─────────────────────────────────  │
│               │  [L4]   Venue Mgr Override   ACTIVE ← WIN     Summer Drinks        │
│               │         (green row, bold)                       Promo v2           │
│               │  ──────────────────────────────────────────────────────────────────  │
│               │  [L5]   Scheduled Campaign    Active           Weekend Specials     │
│               │                                                Board               │
│               │                               (suppressed by L4)                  │
│               │  [L6]   Default Content       Active           Standard Drinks Menu │
│               │                               (suppressed by L4 + L5)             │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  OVERRIDE CONTRIBUTIONS PER LEVEL                                  │
│               │                                                                     │
│               │  L4 — Venue Manager Override                                       │
│               │    Override ID:  ov-0044                                           │
│               │    Placed by:    jane.operator@paddingtonrsl.com.au                │
│               │    Placed:       2026-05-28 09:14 AEST                             │
│               │    Expires:      2026-06-30 23:59 AEST                             │
│               │    Content:      Summer Drinks Promo v2                            │
│               │                                                                     │
│               │  L5 — Scheduled Campaign                                           │
│               │    Override ID:  ov-0038                                           │
│               │    Placed by:    system@platform.com                               │
│               │    Placed:       2026-05-26 00:00 AEST                             │
│               │    Expires:      2026-06-09 23:59 AEST                             │
│               │    Content:      Weekend Specials Board                            │
│               │                                                                     │
│               │  L6 — Default Content                                              │
│               │    Override ID:  ov-0001                                           │
│               │    Placed by:    setup@platform.com                                │
│               │    Content:      Standard Drinks Menu                              │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  PRE DIVERGENCE STATUS                                             │
│               │                                                                     │
│               │  PRE Divergence Status:  NONE                                      │
│               │  Last parity check:      2026-06-02 14:35 AEST (12m ago)          │
│               │  Parity ratio:           1.00 (100% of resolution checks match)   │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  PRE RESOLUTION LEVEL — LAST 24 HOURS                             │
│               │                                                                     │
│               │  L0 │                                                              │
│               │  L1 │                                                              │
│               │  L2 │                                                              │
│               │  L3 │                                                              │
│               │  L4 │████████████████████████████████████████████████████████████ │
│               │  L5 │████████████████  (suppressed after L4 placed at 09:14)      │
│               │  L6 │████████████████  (suppressed after L5 placed)               │
│               │     └──────────────────────────────────────────────────────────── │
│               │     00:00 AEST      06:00      12:00      18:00      00:00 AEST   │
│               │                                                                     │
│               │  Legend: [L4] Venue Mgr  [L5] Campaign  [L6] Default             │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### PRE Resolution Current Panel — Full Specification

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRE RESOLUTION — CURRENT                                             │
│                                                                      │
│ Authoritative level:  L4 — Venue Manager Override                   │
│ Winning content:      Summer Drinks Promo v2                         │
│ Resolved at:          2026-06-02 14:47:32 AEST                      │
│ Confidence:           HIGH                                           │
│                                                                      │
│ PRE divergence:       NONE — parity confirmed 12m ago               │
└──────────────────────────────────────────────────────────────────────┘
```

**Expired data treatment:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ PRE RESOLUTION — CURRENT                          [EXPIRED DATA] ←red  │
│ (red panel border — all sides)                                          │
│                                                                         │
│ PRE data expired — last known resolution: Summer Drinks Promo v2       │
│ at 2026-06-02 14:47:32 AEST (8m ago)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Absent data treatment:**
```
PRE resolution unavailable — last known: Summer Drinks Promo v2 at 2026-06-02 14:47:32 AEST
(amber text)
No resolution-level information is inferred.
```

---

### Level-by-Level Breakdown — Row Treatments

```
LEVEL   LABEL                   STATUS            CONTRIBUTION
─────────────────────────────────────────────────────────────────────
[L0]    Emergency Override       Not active         —                  ← grey bg, grey text
[L1]    Constitutional Floor     Not active         —                  ← grey bg, grey text
[L2]    Network Policy           Not active         —                  ← grey bg, grey text
[L3]    League/Franchise         Not active         —                  ← grey bg, grey text
━━━━━━━━━━━━━━━━━━━━━━━━ WINNING LEVEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[L4]    Venue Mgr Override       ACTIVE ← WIN       Summer Drinks Promo v2   ← green bg, bold
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[L5]    Scheduled Campaign       Active             Weekend Specials Board    ← normal bg, muted
                                 (suppressed by L4)
[L6]    Default Content          Active             Standard Drinks Menu      ← normal bg, muted
                                 (suppressed by L4 + L5)
```

Row visual states:
- `Not active`: grey background (#f3f4f6), grey text
- `ACTIVE ← WIN`: green background (#f0fdf4), bold text, full-width highlight
- `Active` (not winning): white background, muted gray text
- "Suppressed by" text: italic, grey, indented under Status column

PRE level badge colors per level (see Layout Conventions at top of document).

---

### PRE Divergence — Detected Variant

When divergence is detected, the PRE Divergence Status section changes:

```
PRE Divergence Status:  DIVERGENCE DETECTED  ⚠
Last parity check:      2026-06-02 14:35 AEST (12m ago)
Parity ratio:           0.87 (87% of resolution checks match expected output)
Diverging checks:       3 of 23 — [View divergence details →]
```

"View divergence details →" navigates to Replay & Forensics surface for this venue.
Audit event: `venue:investigation:navigated`.

---

### History Chart — 24-Hour Timeline

```
PRE RESOLUTION LEVEL — LAST 24 HOURS
(read-only, no scrubbing, no interaction, updates on each poll)

L0 │
L1 │
L2 │
L3 │
L4 │████████████████████████████████████████████████████  ← green band
L5 │████████  (active before L4 override placed)           ← red band (suppressed period)
L6 │████████  (active before L5 placed, then suppressed)   ← grey band
   └───────────────────────────────────────────────────────
   00:00 AEST    06:00 AEST    12:00 AEST    18:00 AEST    Now

Legend:  [L4] Venue Manager Override  [L5] Scheduled Campaign  [L6] Default Content
         (grey levels with no activity shown as empty rows with axis label only)
```

Insufficient history message:
```
Insufficient history data — chart requires at least 1 hour of resolution history.
```

---

### RECOVERED_BUT_UNTRUSTED Indicator on Tab 5

When venue is in RECOVERED_BUT_UNTRUSTED state, this indicator appears inside the Current Resolution Panel, below the PRE divergence line:

```
⚠  RECOVERED_BUT_UNTRUSTED — PRE resolutions are flagged UNTRUSTED_INPUT
   Resolution outputs during this period are recorded with reduced confidence.
   This flag will clear when corpus verification completes.
```

The level-by-level breakdown continues to display normally. The warning does not suppress the resolution data.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| PRE Resolution Current panel | Zone B, top of tab | Full width panel |
| Level-by-Level Breakdown table | Zone B, below current panel | 7 rows (L0–L6) |
| Override Contributions sub-panels | Zone B, below level table | One per active level |
| PRE Divergence Status | Zone B, below contributions | Plain text block |
| History Chart | Zone B, bottom | Read-only, 24h timeline |
| Chart Legend | Below chart | Level label mapping |
| RECOVERED_BUT_UNTRUSTED note | Inside current panel (conditional) | Amber ⚠ text |

---

### Interaction Notes

- Level-by-Level table: read-only. No click action on rows.
- Override contribution sub-panels: read-only. No controls.
- "View divergence details →": navigates to Replay & Forensics surface. Present only when divergence detected.
- History chart: no user interaction. Read-only display. Updates on poll cycle.
- No PRE override controls on this surface — overrides managed from CMS or via override placement workflow (not this surface).

---

### Disabled-State Behavior

- All roles (VIEWER, OPERATOR, ADMIN): Tab 5 is read-only. No write controls present on this tab.

---

### Replay-State Behavior

- History chart reflects actual governed timestamps.
- Each override contribution sub-panel shows governed timestamps (placed, expires).
- "View divergence details →" links to Replay & Forensics surface for deep forensic investigation.

---

### Degraded-State Behavior

- If `pre_resolution._freshness` is EXPIRED: current panel border turns red, [EXPIRED DATA] badge added.
- If `pre_resolution` is absent: amber text "PRE resolution unavailable" with last known value.
- If divergence detected: divergence section shows amber/red treatment, parity ratio, diverging check count.

---

### Incident-State Behavior

- A PRE divergence detection may trigger or correlate with an incident.
- Active incident panel appears in Zone A if incident is declared; this tab's data is not affected by the incident declaration itself.

---

### Accessibility Notes

- Current resolution panel: `role="region"`, `aria-label="Current PRE resolution"`.
- Level breakdown table: `role="table"`, winning row `aria-label="Winning level: L4 Venue Manager Override"`.
- History chart: `role="img"`, `aria-label="PRE resolution level chart for the last 24 hours. Winning level L4 Venue Manager Override for the majority of the period."`. Chart is purely visual; summary description in aria-label serves screen readers.
- Divergence detected warning: `role="alert"`, `aria-live="polite"`.
- "View divergence details →": standard link, `aria-label="View PRE divergence details in Replay & Forensics"`.

---

---

## WF-VO-08: Venue History — OPERATOR — Event Timeline

**ID:** WF-VO-08
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042/history
**Role:** OPERATOR
**Venue state:** LIVE
**Active tab:** Tab 6 — History
**Purpose:** Complete historical record for the venue — incidents, recovery events, machine state transitions, filter and date-range controls. Paginated throughout.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE]14:32 [SYNCING→LIVE]15:23    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │                                                            ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │  FILTER CONTROLS                                                   │
│ ▌ Paddington  │  ─────────────────────────────────────────────────────────────────  │
│   RSL         │  Date range:  From [2026-05-03  ▾]   To [2026-06-02  ▾]           │
│   vn-0042     │               (default: last 30 days)                              │
│               │                                                                     │
│   Sydney CBD  │  Event types:  ☑ Incidents  ☑ Recovery Events                     │
│   RSL         │                ☑ Machine State Transitions  ☑ Override Events      │
│               │                                                                     │
│   Pyrmont RSL │  [Apply Filters]     [Clear Filters]                               │
│               │  ─────────────────────────────────────────────────────────────────  │
│   Glebe RSL   │                                                                     │
│               │  INCIDENT HISTORY                                                  │
│ ─────────────│                                                                     │
│ NAVIGATION   │  SEV   STATUS   DECLARED          RESOLVED      DURATION  ROOT CAUSE│
│               │  ─────────────────────────────────────────────────────────────────  │
│  Overview    │  S2    CLOSED   2026-05-14        2026-05-14    2h 14m    Corpus    │
│  Screens     │                 09:14 AEST        11:28 AEST              sync fail.│
│  Content     │  S3    CLOSED   2026-04-22        2026-04-22    44m       Override  │
│  Overrides   │                 14:07 AEST        14:51 AEST              conflict  │
│  PRE State   │  S4    CLOSED   2026-03-07        2026-03-08    18h 3m    Hardware  │
│  History ◀   │                 08:22 AEST        02:25 AEST              fault     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  No incidents → No incidents recorded for this venue.              │
│               │  (shown when incident table is empty after filters applied)        │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  RECOVERY EVENTS                                                   │
│               │                                                                     │
│               │  TIMESTAMP           TYPE               INITIATED BY   STEPS  RESULT│
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  2026-05-14 16:32    Venue Reconnect    system         5/5    SUCCESS│
│               │  AEST                                                      ▾        │
│               │  ┌──────────────────────────────────────────────────────────────┐  │
│               │  │  Root cause: Network equipment failure (ISP outage)          │  │
│               │  │  Step 1: Confirm connectivity — completed 16:32 AEST        │  │
│               │  │  Step 2: Confirm hardware — completed 16:34 AEST            │  │
│               │  │  Step 3: Initiate reconnection — completed 16:41 AEST       │  │
│               │  │  Step 4: Verify corpus integrity — completed 16:44 AEST     │  │
│               │  │  Step 5: Confirm LIVE status — completed 16:47 AEST         │  │
│               │  │  Time to recovery: 15 minutes                               │  │
│               │  └──────────────────────────────────────────────────────────────┘  │
│               │  2026-03-07 09:14    Hardware Replace.  admin@platform 5/5    SUCCESS│
│               │  AEST                                                               │
│               │                                                                     │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  MACHINE STATE HISTORY                          (newest first)     │
│               │                                                 [< Prev] [1] [Next>]│
│               │                                                                     │
│               │  TIMESTAMP              FROM          TO            TRIGGER        │
│               │  ─────────────────────────────────────────────────────────────────  │
│               │  2026-06-02 15:23 AEST  SYNCING       LIVE          Corpus sync    │
│               │  2026-06-02 15:18 AEST  OFFLINE       SYNCING       Network reconn.│
│               │  2026-06-02 14:32 AEST  LIVE          OFFLINE       Heartbeat tmout│
│               │  2026-06-01 22:15 AEST  SYNCING       LIVE          Corpus sync    │
│               │  2026-06-01 22:00 AEST  LIVE          SYNCING       Nightly sync   │
│               │  ...                                                               │
│               │                                                (50 per page)       │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Filter Controls — Full Specification

```
FILTER CONTROLS
─────────────────────────────────────────────────────────────────────────────────────
Date range:
  From  [ 2026-05-03  ▾ ]    To  [ 2026-06-02  ▾ ]
  (date picker dropdowns; default: last 30 days; From ≤ To enforced)

Event types:
  ☑  Incidents
  ☑  Recovery Events
  ☑  Machine State Transitions
  ☑  Override Events

Operator filter:  (ADMIN only — dropdown)
  [ All operators  ▾ ]
  Options: jane.operator@paddingtonrsl.com.au / admin@platform.com / system@platform ...

[ Apply Filters ]    [ Clear Filters ]
─────────────────────────────────────────────────────────────────────────────────────
```

**Operator filter:** ADMIN role only. Absent for OPERATOR and VIEWER.

**Apply Filters:** applies all active filter settings across all three sub-sections simultaneously.

**Clear Filters:** resets date range to last 30 days, all event types checked, operator filter cleared.

---

### Incident History — Row Link

Each incident row links to the Incident Commander surface for that specific incident:

```
S2    CLOSED   2026-05-14 09:14 AEST  →  link to /incidents/inc-0291 (read-only archive if closed)
```

Clicking the row (or a "View incident →" control) navigates to the IC surface. The IC surface renders in archive/read-only mode for closed incidents.

---

### Recovery Events — Expanded Row

```
2026-05-14 16:32 AEST    Venue Reconnect    system    5/5    SUCCESS    [▾]

▾ (expanded):
  Root cause: Network equipment failure (ISP outage)
  Steps:
    Step 1 — Confirm Venue Connectivity      completed 2026-05-14 16:32 AEST
    Step 2 — Confirm Player Hardware         completed 2026-05-14 16:34 AEST
    Step 3 — Initiate Reconnection           completed 2026-05-14 16:41 AEST
    Step 4 — Verify Corpus Integrity         completed 2026-05-14 16:44 AEST (system-assisted)
    Step 5 — Confirm LIVE Status             completed 2026-05-14 16:47 AEST
  Time to recovery: 15 minutes
```

---

### Machine State History — Pagination

Default sort: newest first. Sortable by timestamp (click column header).
50 rows per page. Pagination: [< Prev] [page numbers] [Next >].

FROM and TO state values rendered as colored pills matching machine state badge colors.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| Filter controls | Zone B, top | Date range + event type checkboxes |
| Operator filter | Filter controls (conditional) | ADMIN only |
| Apply / Clear Filters | Filter controls, right | Apply and Clear buttons |
| Incident History table | Zone B, first section | Sortable rows, links to IC |
| Recovery Events table | Zone B, second section | Expandable rows |
| Machine State History table | Zone B, third section | 50/page, sortable, paginated |

---

### Interaction Notes

- Filter changes do not auto-apply — operator must click "Apply Filters".
- "Clear Filters" immediately resets all filter state and re-renders with defaults.
- Incident row: full-row clickable, navigates to IC surface.
- Recovery event row expand: click ▾; shows step-by-step detail.
- Machine state history column header click: toggles sort asc/desc.
- All filters apply across all sub-sections simultaneously (incidents, recovery, machine state).

---

### Disabled-State Behavior

- VIEWER: all content is read-only. No write controls on this tab.
- OPERATOR filter: absent for OPERATOR and VIEWER roles (ADMIN only).

---

### Replay-State Behavior

- This tab is the primary entry point to deep-dive historical investigation.
- Each closed incident row links to the IC surface in archive/read-only mode.
- Each recovery event shows the governed timestamps of each step.
- Machine state history provides the authoritative transition log for replay package construction.

---

### Degraded-State Behavior

- If historical data query is slow: a loading spinner appears in each sub-section independently.
- If data is unavailable for a sub-section: "Unable to load [section name] — try again" with a retry link.
- Filters that produce zero results: "No [event type] events in the selected date range." for each sub-section.

---

### Incident-State Behavior

- If an active incident exists: its row appears in Incident History with status "DECLARED" or "WATCHING" (not CLOSED). Clicking navigates to the live IC surface.
- Active incidents link to the live IC surface; closed incidents link to the archive IC view.

---

### Accessibility Notes

- Filter checkboxes: `<fieldset>` + `<legend>Event types</legend>`, each checkbox with associated `<label>`.
- Date pickers: `aria-label="From date"` and `aria-label="To date"`, keyboard navigable.
- "Apply Filters": `aria-label="Apply filters to venue history"`.
- Incident table: `role="table"`, rows `role="row"`. Clickable rows: `role="button"` or `<a>` with descriptive text.
- Recovery event expand: `aria-expanded="false"/"true"`, `aria-controls="recovery-detail-[id]"`.
- Machine state history sort: `aria-sort="descending"/"ascending"` on sorted column header.
- Pagination: `aria-label="Machine state history pagination"`.

---

---

## WF-VO-09: VIEWER Role — Read-Only View

**ID:** WF-VO-09
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0042
**Role:** VIEWER
**Venue state:** LIVE
**Active tab:** Tab 1 — Overview
**Purpose:** Documents all visual differences and control absences when a VIEWER accesses the Venue Operations Dashboard. All tabs are visible; no write controls are present.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]   viewer.u ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Paddington RSL  │  [LIVE] (green)  │  Last corpus sync: 4 hours ago (green)       │
│  venue_id: vn-0042  [NETWORK]       │  [LIVE→OFFLINE]14:32 [SYNCING→LIVE]15:23    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │  ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲    (all tabs present, all navigable)                       │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │  STATUS DASHBOARD — 7 DIMENSIONS (4-3 grid — identical to WF-VO-01)│
│ ▌ Paddington  │  All cards rendered at full fidelity. No visual degradation.       │
│   RSL         │  Read-only indicator: no ↻ Re-assess controls on any card.         │
│   vn-0042     │  (↻ Re-assess is absent from DOM for VIEWER role)                 │
│               │                                                                     │
│   (only venues│                                                                     │
│    assigned   │  ─────────────────────────────────────────────────────────────────  │
│    to this    │  No active incidents  ✓                                            │
│    viewer are │  Active overrides: 1  (L4: 1)     [Manage overrides →]            │
│    shown)     │  (link present — navigates to Tab 4 — but no write controls on Tab4)│
│               │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### VIEWER — Controls Absent from DOM (not disabled — absent)

This is the complete list. These elements do not exist in the rendered HTML for VIEWER role.

**Tab 1 — Overview:**
- `↻ Re-assess` on all 7 status dimension cards
- `Begin Recovery Workflow` button in OFFLINE banner (banner text visible, button absent)
- `Request Re-Verification` in RECOVERED_BUT_UNTRUSTED banner (banner visible, button absent)
- `Acknowledge and Investigate` in CORPUS INTEGRITY FAILURE banner (banner visible, button absent)

**Tab 2 — Screens:**
- `+ Enroll New Screen` button
- `...` overflow menu on all screen rows (Remove Screen option)

**Tab 3 — Content:**
- `Request Manual Sync` button

**Tab 4 — Overrides:**
- `Remove Override` button on all override cards at all levels
- Each override card that would show "Remove Override" instead shows no button. Authority note is also absent (note is for OPERATOR who has partial authority; VIEWER has none and receives no note).

**Tab 6 — History:**
- `Operator filter` dropdown (ADMIN only feature; absent for VIEWER)

---

### VIEWER — Controls Visible but Non-Functional (links remain active)

These navigation and read controls remain fully functional for VIEWER:
- `← All Venues` back navigation
- All tab links
- All zone A venue list links
- `View in Incident Commander →` link on Tab 1
- `Manage overrides →` link on Tab 1 (navigates to Tab 4; no write controls there)
- `View divergence details →` on Tab 5 when divergence detected
- All expanded row details in Tab 2 (screen detail expand)
- All collapsed section toggles in Tab 4 (expired overrides expand)
- All history table row links on Tab 6 (incident rows navigate to IC surface)
- Corpus sync log row expand on Tab 3

---

### VIEWER — Zone A Differences

```
┌─────────────────────────────┐
│ ← All Venues                │
│                             │
│ Search venues...            │
│ [                         ] │
│                             │
│ ▌ Paddington RSL            │  ← Only assigned venues shown
│   vn-0042                   │
│                             │
│   (no other venues listed   │
│    unless assigned)         │
│                             │
│ ─────────────────────────── │
│ VENUE NAVIGATION            │
│                             │
│ ▌ Overview                  │
│   Screens                   │
│   Content                   │
│   Overrides                 │
│   PRE State                 │
│   History                   │
│                             │
│ (Active incident shortcut   │
│  appears when incidents     │
│  active — link is present   │
│  for VIEWER, no write ctrl) │
└─────────────────────────────┘
```

VIEWER sees only assigned venues. ADMIN sees all venues. OPERATOR sees assigned venues.

---

### VIEWER — OFFLINE State Differences

When venue is OFFLINE, VIEWER sees:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VENUE OFFLINE — Connectivity lost 6h 14m ago                               │
│  Player is operating autonomously. 47h 23m of autonomy remaining.            │
│                                                                              │
│  (No "Begin Recovery Workflow" button — absent from DOM for VIEWER)         │
└──────────────────────────────────────────────────────────────────────────────┘
```

The banner is visible. The action is absent. The VIEWER can observe the state but cannot initiate recovery.

---

### VIEWER — RECOVERED_BUT_UNTRUSTED Differences

Banner visible at full fidelity. "Request Re-Verification" button absent from DOM.

```
│  RECOVERED — VERIFICATION PENDING                                           │
│  ...                                                                        │
│  (No "Request Re-Verification" button — absent from DOM for VIEWER)        │
```

---

### Component Placement

Same as WF-VO-01 except all write controls listed in the "absent" table above are removed from DOM.

---

### Interaction Notes

- VIEWER cannot trigger any state changes.
- All links and navigation work identically to OPERATOR.
- VIEWER may navigate to IC surface; may not perform IC actions.
- VIEWER may view all PRE resolution data, override history, corpus sync log — read-only.

---

### Disabled-State Behavior

- EMERGENCY_FREEZE: no additional change for VIEWER (VIEWER already has no write controls).

---

### Replay-State Behavior

- Identical to OPERATOR for all read-only elements.
- History tab and replay links fully accessible.

---

### Degraded-State Behavior

- All degraded state indicators visible to VIEWER — amber/red card treatments, stale badges, UNKNOWN treatments, all rendered identically to OPERATOR view.
- VIEWER cannot take remediation actions.

---

### Incident-State Behavior

- Active incident panel appears in Zone A. Link to IC surface is present (read-only navigation).
- VIEWER can observe incident state but cannot declare, escalate, or resolve incidents.

---

### Accessibility Notes

- No additional accessibility requirements beyond WF-VO-01.
- Absent controls do not require aria-disabled treatment — they are not present in the DOM.
- The read-only nature of the surface does not require a banner or announcement.

---

---

## WF-VO-10: Decommissioned Venue — Archive View

**ID:** WF-VO-10
**Surface:** Venue Operations Dashboard
**Route:** /venues/vn-0019 (a decommissioned venue)
**Role:** ANY (VIEWER, OPERATOR, or ADMIN — same rendering for all)
**Venue state:** DECOMMISSIONED
**Active tab:** Tab 1 — Overview
**Purpose:** Permanent read-only archive view for a decommissioned venue. URL never returns 404. All historical data accessible. No operational actions possible.

---

### Desktop Layout (1440px viewport)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │  VENUE DECOMMISSIONED — This venue is no longer operational. All data is        │ │
│ │  preserved for historical access. No actions may be taken on this venue.        │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│ (Full-width red banner, above everything including the identity header)             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ ■ ClubHub TV Platform          [Live Ops] [Venues] [CMS] [Replays]    jane.op ▾ [?] │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                    VENUE IDENTITY HEADER (persistent)                               │
│  ┌──────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐ │
│  │ Glebe Social Club        │  │  ┌──────────────────┐  │  │ Last corpus sync:    │ │
│  │ venue_id: vn-0019        │  │  │  DECOMMISSIONED  │  │  │ 2025-12-01           │ │
│  │ [VENUE] Licensed Club    │  │  └──────────────────┘  │  │ (static — no longer  │ │
│  │ DECOMMISSIONED           │  │  (dark grey pill,       │  │  updating)           │ │
│  │ (red label below name)   │  │   #374151 bg,           │  └──────────────────────┘ │
│  └──────────────────────────┘  │   white text)           │                           │
│                                │                        │                           │
│                                │  [LIVE→DECOMMISSIONED] │                           │
│                                │  2025-12-01 09:00 AEST │                           │
│                                └────────────────────────┘                           │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│ ← All Venues  │ [Overview]  [Screens]  [Content]  [Overrides]  [PRE State][History] │
│               │  ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲ ̲    (all tabs present and navigable — no tabs hidden)        │
│ Search venues │─────────────────────────────────────────────────────────────────────│
│ [           ] │                                                                     │
│               │ ┌─────────────────────────────────────────────────────────────────┐ │
│ (Decommissioned│ │  THIS VENUE IS ARCHIVED — READ ONLY                             │ │
│  venue shown   │ │  Decommissioned: 2025-12-01 09:00 AEST                          │ │
│  in list with  │ │  Reason recorded: Venue permanently closed (operator decision)  │ │
│  grey/muted    │ │  All historical data below is preserved and immutable.          │ │
│  styling and   │ └─────────────────────────────────────────────────────────────────┘ │
│  [DECOM] badge)│ (amber background, full width — below tab strip, above content)   │
│               │                                                                     │
│ ▌ Glebe Social│  STATUS DASHBOARD — FINAL RECORDED STATE                          │
│   Club        │  (cards show last recorded values, all marked EXPIRED)             │
│   vn-0019     │                                                                     │
│               │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│ ─────────────│  │▌ HEALTH      │ │▌ TRUST       │ │▌ CONFIDENCE  │ │▌ FRESHNESS │ │
│ NAVIGATION   │  │  HEALTHY     │ │  TRUSTED     │ │  HIGH        │ │  EXPIRED   │ │
│               │  │  (grey)      │ │  (grey)      │ │  (grey)      │ │  EXPIRED▲  │ │
│  Overview ◀  │  │  EXPIRED▲    │ │  EXPIRED▲    │ │  EXPIRED▲    │ │  (red bdge)│ │
│  Screens     │  │  Last value  │ │  Last value  │ │  Last value  │ │  Last upd  │ │
│  Content     │  │  at decomm.  │ │  at decomm.  │ │  at decomm.  │ │  2025-12-01│ │
│  Overrides   │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│  PRE State   │  (grey left borders, grey text — final state shown, not live)       │
│  History     │                                                                     │
│               │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│               │  │▌ READINESS   │ │▌ CONNECTIVITY│ │▌ INTEGRITY   │               │
│               │  │  EXPIRED▲    │ │  EXPIRED▲    │ │  EXPIRED▲    │               │
│               │  │  (grey)      │ │  (grey)      │ │  (grey)      │               │
│               │  └──────────────┘ └──────────────┘ └──────────────┘               │
│               │                                                                     │
│               │  No active incidents (venue decommissioned)                        │
│               │  Override history preserved — view in Overrides tab               │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### VENUE DECOMMISSIONED Banner — Full Specification

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  VENUE DECOMMISSIONED — This venue is no longer operational.                        │
│  All data is preserved for historical access.                                       │
│  No actions may be taken on this venue.                                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
  Position: Fixed above system status bar (topmost element on page)
  Background: #fee2e2 (light red)
  Left border: 4px #ef4444 (red)
  Text: red (#ef4444), 14px
  Full viewport width
  Persistent — does not scroll away
```

---

### Identity Header — DECOMMISSIONED State

**Left section additions:**
- Venue name retains normal styling (20px semibold)
- Below venue tier badge, a red label: `DECOMMISSIONED`
- Installation type still shown in 12px gray

**Center section:**
- Machine state badge: `DECOMMISSIONED` in dark grey (#374151 bg, white text, 120×40px)
- Machine state history strip shows only the final transition: `[LIVE→DECOMMISSIONED] 2025-12-01 09:00 AEST`

**Right section:**
- "Last corpus sync:" shows the last recorded date (static, not age-relative)
- No autonomy clock (venue is permanently offline; autonomy concept does not apply to decommissioned venues)

---

### Archived Overview Banner (Tab 1, below tab strip)

```
┌─────────────────────────────────────────────────────────────────────┐
│  THIS VENUE IS ARCHIVED — READ ONLY                                 │
│  Decommissioned: 2025-12-01 09:00 AEST                             │
│  Reason recorded: Venue permanently closed (operator decision)      │
│  All historical data below is preserved and immutable.              │
└─────────────────────────────────────────────────────────────────────┘
  Background: amber (#fef3c7)
  Left border: 4px amber (#f59e0b)
  Full width of Zone B
```

---

### Status Dashboard — Decommissioned State

All 7 status dimension cards show their last recorded values with EXPIRED treatment:

```
Each card:
- Grey left border (not green/amber/red — these are historical, not live)
- Value: last recorded value at time of decommission (e.g., HEALTHY, TRUSTED)
- Value text: grey (#6b7280)
- EXPIRED badge in red on each card
- Basis section: "Final recorded value at decommission: 2025-12-01 09:00 AEST"
- Updated timestamp: "Last updated 2025-12-01" (static — not a live counter)
- ↻ Re-assess: absent from DOM for all roles
```

No cards show live or current data. No cards show UNKNOWN — they show the last known value with EXPIRED treatment.

---

### All Write Controls — Absent from DOM for All Roles

The following controls are absent from the DOM for ALL roles on a DECOMMISSIONED venue, regardless of ADMIN/OPERATOR/VIEWER:

- ↻ Re-assess (all status cards)
- + Enroll New Screen
- Remove Screen (overflow menu)
- Request Manual Sync
- Remove Override (all override cards)
- Begin Recovery Workflow
- Request Re-Verification
- Acknowledge and Investigate
- Apply Filters (Tab 6 history — filter controls are absent; all history shown unfiltered)

---

### Tab Behavior — DECOMMISSIONED Venue

All 6 tabs remain present and navigable. Each tab shows its historical data with read-only treatment:

**Tab 2 — Screens:** Screen list shows all screens as they were at decommission. All screen rows show OFFLINE/DECOMMISSIONED state. No expand controls (expand still functional for historical detail). No "+" Enroll button.

**Tab 3 — Content:** Corpus status shows last sync. Pending items: none. Delivery queue: empty. Corpus sync log: full historical log.

**Tab 4 — Overrides:** Active overrides at time of decommission shown with `[DECOMMISSIONED]` badge (not ACTIVE). Remove Override absent. Expired & Removed history fully accessible.

**Tab 5 — PRE State:** Last known resolution shown. History chart shows data up to decommission date. No current resolution (venue no longer resolving).

**Tab 6 — History:** Full history accessible. No filter controls (all history shown). Incident history, recovery events, machine state transitions — all preserved. No operator filter.

---

### Zone A — Decommissioned Venue in List

```
┌─────────────────────────────┐
│ ← All Venues                │
│                             │
│ Search venues...            │
│ [                         ] │
│                             │
│   Paddington RSL            │  ← Other active venues, normal display
│   Sydney CBD RSL            │
│                             │
│ ▌ Glebe Social Club         │  ← Active venue, left border accent
│   vn-0019                   │
│   [DECOM] (grey badge)      │  ← Decommissioned badge shown in list
│                             │
│ ─────────────────────────── │
│ VENUE NAVIGATION            │
│                             │
│ ▌ Overview                  │
│   Screens                   │
│   Content                   │
│   Overrides                 │
│   PRE State                 │
│   History                   │
│                             │
│ (No active incident panel   │
│  — decommissioned venues    │
│  cannot have active         │
│  incidents)                 │
└─────────────────────────────┘
```

Decommissioned venues appear in the venue list for ADMIN and for operators/viewers who had access. They are visually distinct with a grey [DECOM] badge and muted styling.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| VENUE DECOMMISSIONED banner | Top of page, above system bar | Fixed, always visible |
| DECOMMISSIONED machine state badge | Header center | Dark grey, 120×40px |
| DECOMMISSIONED label | Header left, below tier badge | Red text |
| Archived Overview banner | Zone B, below tab strip | Amber background |
| Status dashboard (expired) | Zone B, below archive banner | All cards show EXPIRED |
| No write controls | Entire surface | Absent from DOM, all roles |

---

### Interaction Notes

- URL /venues/vn-0019 always resolves to this archive view. It never returns 404.
- Navigation between tabs works normally — historical data is displayed on each tab.
- Links to IC surface from incident history rows work normally (archive view of closed incidents).
- "← All Venues" navigates back to Live Ops (which typically filters out decommissioned venues unless explicitly showing them).

---

### Disabled-State Behavior

This surface IS the fully disabled state for a venue. No EMERGENCY_FREEZE handling is needed — the venue cannot receive any writes.

---

### Replay-State Behavior

- All historical data accessible for replay investigation.
- Tab 6 (History) provides the complete machine state log for this venue's operational lifetime.
- Incident history rows link to IC surface archive views.
- Corpus sync log on Tab 3 shows the complete delivery history.

---

### Degraded-State Behavior

Not applicable. Decommissioned venues do not have live operational state. All cards show EXPIRED last-known values.

---

### Incident-State Behavior

Not applicable. Decommissioned venues cannot have active incidents. All incidents recorded for this venue are closed and accessible via Tab 6 History.

---

### Accessibility Notes

- VENUE DECOMMISSIONED banner: `role="banner"`, `aria-label="Venue decommissioned notice"`. Persistent announcement.
- DECOMMISSIONED machine state badge: `aria-label="Machine state: DECOMMISSIONED"`.
- All EXPIRED badges on status cards: `aria-label="Status expired — last recorded value"`.
- All tabs: `aria-disabled` is NOT set — tabs are navigable and content is accessible. Read-only content is not "disabled".
- Status cards with no live data: basis text "Final recorded value at decommission" is the accessible label for the EXPIRED state.
- No write controls exist — no aria-disabled needed for absent elements.

---

*End of VENUE-OPERATIONS-WIREFRAMES-v1.md*
*Document authority: UX/Design*
*Source: CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md, OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md*
*Version: 1.0*
*Status: CANONICAL*
