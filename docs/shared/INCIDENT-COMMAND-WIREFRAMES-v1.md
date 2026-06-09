# INCIDENT-COMMAND-WIREFRAMES-v1

**Document class:** Implementation-grade wireframe specification
**Surface:** Incident Command Surface (`/incidents/:incident_id`)
**Authority:** Derived from CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md
**Audience:** UX designers, frontend engineers
**Status:** CANONICAL — do not deviate without architectural review
**Depends on:** CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md, FRONTEND-COMPONENT-TAXONOMY-v1.md, INCIDENT-INFORMATION-MODEL-v1.md

---

## Layout Conventions (applies to all wireframes)

```
Viewport: 1440px wide
Zone A: 280px fixed left
Zone B: fluid (~1160px) — NO Zone C on Incident Command Surface
System Status Bar: 48px — always topmost
Incident Identity Bar: 72px — always below System Status Bar, never scrolls
Tab Strip: 48px — always below Identity Bar, never scrolls
Tab Content: scrollable — fills remaining viewport height
```

**ASCII drawing conventions:**
- `┌─┐└─┘│` — panel/card borders
- `[BUTTON]` — interactive button
- `{value}` — dynamic runtime data
- `═══` — full-width divider
- `···` — continuation / scrollable area below
- `▶` — active tab indicator (3px bottom border in severity color)
- `○ ●` — radio button unselected / selected
- `□ ■` — checkbox unchecked / checked
- `[▼]` — dropdown control

**Severity tint annotations** (background on Identity Bar row):
- S1: `// bg: #C62828 at 15%`
- S2: `// bg: #E64A19 at 15%`
- S3: `// bg: #F57C00 at 15%`
- S4: `// bg: #FBC02D at 15%`
- S5: `// bg: #558B2F at 15%`

**Zone A tab mirrors** (always present when on IC Surface):
```
─────────────────────────
THIS INCIDENT
  Situation Overview        ← active tab has 3px left border in severity color
  Command Log
  Override Management
  PRE Status
  Incident Actions
  [Evidence Package]        ← ADMIN only — absent from Zone A for OPERATOR/VIEWER
─────────────────────────
```

---

## WF-IC-01: Incident Command — OPERATOR (non-commander) — DECLARED — S3 MAJOR — Tab 1

**ID:** WF-IC-01
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** OPERATOR
**Commander status:** Not commander (viewing only — commander is a different operator)
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 1 — Situation Overview
**Purpose:** Show what a non-commander OPERATOR sees on first arrival at an active S3 incident — full situational awareness with no commander-exclusive write controls present.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)  // bg: #1A1A1A                                                                       │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay] [Settings·ADMIN]    [Riverside Golf Club — C]  [JD▼] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // bg: #F57C00 at 15% on #1A1A1A  (S3 amber tint)                               │
│                                                                                                                  │
│  LEFT GROUP                          CENTER GROUP              RIGHT GROUP                                       │
│  [INC-riverside-a3f8b2]              Duration                  Commander                                        │
│  ◆ S3 MAJOR  [DECLARED]             02:14:38                  Jordan Ellis (OPERATOR)                           │
│  Declared  01 Jun 2026 14:32 AEST                                                                               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ ZONE B — TAB STRIP (48px)  // bg: #1E1E1E                                         │
│ // bg: #121212           │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│                          │ │    (active — 3px amber bottom border)                                              │
│  ◉ Home / Live Ops       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Venues                │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Incidents  [●1]       │ │ ZONE B — TAB 1 CONTENT (scrollable)                                               │
│  ◉ Replay & Forensics    │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│  ─────────────────────   │ │  SECTION A — INCIDENT SUMMARY                                                      │
│  THIS INCIDENT           │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  ▶ Situation Overview    │ │ │  Incident        inc-riverside-a3f8b2c1d4e5f6a7b8  (monospace 13px)           │ │
│    Command Log           │ │ │  Declared by     Jordan Ellis  [OPERATOR]                                      │ │
│    Override Mgmt         │ │ │  Declared at     01 Jun 2026 14:32:07 AEST                                     │ │
│    PRE Status            │ │ │  Scope           Riverside Golf Club  [C]                                      │ │
│    Incident Actions      │ │ │  Severity        ◆ S3 MAJOR                                                    │ │
│                          │ │ │  State           [DECLARED]                                                     │ │
│  ─────────────────────   │ │ │  Description     PRE resolution returned divergence on screens 4, 7, 12.       │ │
│  Riverside Golf Club [C] │ │ │                  Scheduled campaign not delivering to Zone B. Manual           │ │
│                          │ │ │                  intervention may be required.                                  │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION B — VENUE STATUS COMPARISON                                               │
│                          │ │                                                                                     │
│                          │ │  ┌───────────────────────────────┐   ┌───────────────────────────────┐           │
│                          │ │  │  AT DECLARATION               │   │  NOW                          │           │
│                          │ │  │  01 Jun 2026 14:32 AEST       │   │  01 Jun 2026 16:46 AEST       │           │
│                          │ │  │                               │   │                               │           │
│                          │ │  │  CONSTITUTIONAL_RISK          │   │  CONSTITUTIONAL_RISK          │           │
│                          │ │  │  (amber bold 20px)            │   │  (amber bold 20px)            │           │
│                          │ │  │                               │   │                               │           │
│                          │ │  │  Screens: 23 / 2 offline      │   │  Screens: 23 / 2 offline      │           │
│                          │ │  │  Overrides: 3 active          │   │  Overrides: 4 active  ← tint  │           │
│                          │ │  │  PRE: DIVERGENCE DETECTED     │   │  PRE: DIVERGENCE DETECTED     │           │
│                          │ │  │  Confidence: [LOW]            │   │  Confidence: [LOW]            │           │
│                          │ │  └───────────────────────────────┘   └───────────────────────────────┘           │
│                          │ │    Note: right column fields differing from left are highlighted amber             │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION C — ACTIVE OVERRIDES AT DECLARATION                                       │
│                          │ │  "Active Overrides — Riverside Golf Club — at declaration time"                    │
│                          │ │  "3 overrides active when this incident was declared."                             │
│                          │ │                                                                                     │
│                          │ │  [L3] Override #4821 — ClubHouse Sponsor on Zone B — placed 3h ago by JE          │
│                          │ │       Expires: 01 Jun 2026 18:00 AEST                                             │
│                          │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─            │
│                          │ │  [L2] Override #4815 — Emergency Fallback on Screen 12 — placed 5h ago by SA      │
│                          │ │       Expires: Never  ⚠ PERMANENT UNTIL REMOVED                                   │
│                          │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─            │
│                          │ │  [L1] Override #4802 — Operational Hold on Screens 4,7 — placed 8h ago by SA      │
│                          │ │       ⏱ Auto-expires: 01 Jun 2026 22:00 AEST                                      │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION D — PRE STATE COMPARISON                                                  │
│                          │ │                                                                                     │
│                          │ │  ┌────────────────────────────────┐  ┌────────────────────────────────┐          │
│                          │ │  │  PRE AT DECLARATION            │  │  PRE NOW                       │          │
│                          │ │  │                                │  │                                │          │
│                          │ │  │  L0 Emergency    INACTIVE      │  │  L0 Emergency    INACTIVE      │          │
│                          │ │  │  L1 Operational  Hold Rule A   │  │  L1 Operational  Hold Rule A   │          │
│                          │ │  │  L2 Scheduled    Suppressed    │  │  L2 Scheduled    Suppressed    │          │
│                          │ │  │  L3 Campaign     None          │  │  L3 Campaign     None          │          │
│                          │ │  │  L4 Sponsor      None          │  │  L4 Sponsor      None          │          │
│                          │ │  │  L5 Fallback     ACTIVE ◀WIN   │  │  L5 Fallback     ACTIVE ◀WIN   │          │
│                          │ │  │  L6 Device Def   ACTIVE        │  │  L6 Device Def   ACTIVE        │          │
│                          │ │  └────────────────────────────────┘  └────────────────────────────────┘          │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION E — LAST KNOWN GOOD STATE                                                 │
│                          │ │  "System state 15 minutes before declaration — 01 Jun 2026 14:17 AEST"            │
│                          │ │                                                                                     │
│                          │ │  Constitutional state: HEALTHY                                                     │
│                          │ │  Active overrides: 2  (Override #4802, Override #4815)                            │
│                          │ │  PRE: L3 Campaign — Summer Tournament winning                                      │
│                          │ │                                                                                     │
│                          │ │  [Open in Replay Workspace]                                                        │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Incident Identity Bar Detail

```
// HEIGHT: 72px  // bg: #F57C00 at 15% on #1A1A1A

LEFT GROUP (grows to ~500px):
  Row 1: [INC-riverside-a3f8b2]  ← tappable, copies full incident_id, shows "Copied" toast
  Row 2: ◆ S3 MAJOR  (badge: #F57C00 bg, white text, border-radius 4px, 28px tall)
         [DECLARED]  (pill: #1565C0 bg, white text, 14px medium)
  Row 3: Declared  01 Jun 2026 14:32 AEST  (12px regular, immutable)

CENTER GROUP (200px, centered):
  Label: "Duration"  (12px muted)
  Value: 02:14:38  (bold, live-updating second-by-second)

RIGHT GROUP (280px):
  Label: "Commander"  (12px muted)
  Value: Jordan Ellis (OPERATOR)  (14px regular)
  [Transfer Command] button: ABSENT — this operator is not the commander
```

### Zone A Detail (280px)

```
┌──────────────────────────┐
│  ClubHub TV logo         │
│  ─────────────────────   │
│  ◉ Home / Live Ops       │
│  ◉ Venues                │
│  ◉ Incidents  [●1]       │  ← badge: #F57C00 (S3 amber), count "1"
│  ◉ Replay & Forensics    │
│                          │
│  ─────────────────────   │
│  THIS INCIDENT           │  ← section label, 11px uppercase muted
│  ▶ Situation Overview    │  ← active: 3px left border #F57C00
│    Command Log           │
│    Override Mgmt         │
│    PRE Status            │
│    Incident Actions      │
│  (no Evidence Package    │
│   — non-ADMIN role)      │
│                          │
│  ─────────────────────   │
│  Riverside Golf Club [C] │  ← venue entropy grade badge
└──────────────────────────┘
```

**S1 nav suppression:** NOT active (this is S3). All nav items fully interactive.

### Tab Content Detail — Tab 1 Situation Overview

Five sections stacked vertically, each full-width of Zone B, separated by full-width dividers:

**Section A — Incident Summary card:** Single card, no action buttons for non-commander OPERATOR. Read-only display of 7 fields.

**Section B — Venue Status Comparison:** Two equal columns side-by-side. "Active overrides" count differs between columns (3 vs 4) — the right column value is highlighted with amber background tint. Tapping the override count in either column navigates to Tab 3.

**Section C — Active Overrides at Declaration:** List of 3 override rows. Level badge colors: L1=`#1A237E`, L2=`#1565C0`, L3=`#00695C`. L2 override shows red "PERMANENT UNTIL REMOVED" label. L1 override shows green clock "Auto-expires" label.

**Section D — PRE State Comparison:** Two equal columns. Winning level (L5 Structural Fallback) row has `#1565C0` left border 4px. "Suppressed" rows (L2) show secondary label "Suppressed by L1".

**Section E — Last Known Good State:** Read-only replay output block. [Open in Replay Workspace] button navigates to Replay & Forensics workspace at the 14:17 timestamp, linking `incident_id`.

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| ApplicationShell | Full viewport frame | Zone A + Zone B only (no Zone C on IC surface) |
| SystemStatusBar | Top 48px | Incident banner: "INCIDENT ACTIVE — INC-riverside-a3f8b2 — ◆ S3 MAJOR — [Open Incident]" |
| IncidentIdentityBar | Below System Status Bar, 72px | S3 amber tint background |
| TabStrip | Below Identity Bar, 48px | 5 tabs (non-ADMIN) |
| SituationOverviewTab | Zone B tab content | Sections A–E |
| StatusComparisonPanel | Section B | Two-column layout |
| OverrideListItem | Section C, ×3 rows | Read-only — no remove controls (non-commander) |
| PRESummaryTable | Section D | Two-column comparison |
| LastKnownGoodCard | Section E | Read-only with replay navigation link |
| ZoneANavigation | Zone A | Incident context block with tab mirrors |

### Interaction Notes

- Tapping `[INC-riverside-a3f8b2]` in Identity Bar: copies full `incident_id` to clipboard, shows "Copied" toast (3s).
- Tapping override count in Section B right column: navigates to Tab 3.
- Tapping `[Open in Replay Workspace]` in Section E: navigates to `/replay?incident=inc-riverside-a3f8b2&ts=2026-06-01T14:17:00`.
- Duration clock in Identity Bar: live-updating, derived from `now() - declared_at`, local computation.
- Tapping tab labels in Zone A "THIS INCIDENT" block: navigates to that tab.
- Tapping "INCIDENT ACTIVE" banner in System Status Bar → already on this surface, banner does nothing (or scrolls to top).

### Disabled-State Behavior

- [Transfer Command] button: **absent** — this operator is not the commander. Not greyed, not disabled — not in DOM.
- [Assume Command] button: **absent** — incident state is DECLARED (not COMMANDER_LAPSED).
- No write controls appear on Tab 1 in any state. Tab 1 is read-only for all roles.

### Replay-State Behavior

Tab 1 is fully readable in REPLAY mode. No write controls exist on Tab 1, so IC-03 has no visible effect here beyond the persistent REPLAY MODE banner that appears below the Identity Bar. [Open in Replay Workspace] link remains present (it is a navigation, not a write).

### Degraded-State Behavior

- If PRE endpoint unreachable: Section D shows "STALE" badge on each PRE row and a banner: "PRE status temporarily unavailable — last known state shown."
- If venue health data stale: Confidence badge in Section B shows `[LOW]` or `[NONE]` with explanation label.
- If WebSocket disconnected: Duration clock continues from local computation. No live updates for Section B override count.

### Incident-State Behavior

- S3 amber tint (`#F57C00` at 15%) on Identity Bar background.
- S3 amber color on "Incidents" badge in Zone A.
- Active tab (Situation Overview) has 3px bottom border in `#F57C00`.
- Zone A tab mirror "Situation Overview" has 3px left border in `#F57C00`.
- No EMERGENCY_FREEZE overlay (S3 — not S1).
- No COMMANDER_LAPSED modifications (state is DECLARED with commander).

### Accessibility Notes

- Identity Bar: `role="banner"`, `aria-label="Incident INC-riverside-a3f8b2 — S3 MAJOR — DECLARED"`
- Tab strip: `role="tablist"`. Each tab: `role="tab"`, `aria-selected="true/false"`, `aria-controls="panel-{n}"`.
- Tab content panels: `role="tabpanel"`, `aria-labelledby="tab-{n}"`.
- Duration clock: `aria-live="off"` (live-updating numeric — screen reader should not announce every second).
- Incident ID tappable: `role="button"`, `aria-label="Copy incident ID"`.
- Focus order: System Status Bar → Identity Bar → Tab Strip → Tab Content (Section A → B → C → D → E → [Open in Replay Workspace]).
- Keyboard: Tab/Shift-Tab navigates. Arrow keys navigate tab strip. Enter activates tab.
- Zone A "THIS INCIDENT" nav: each item `role="link"`, keyboard-accessible.

---

## WF-IC-02: Incident Command — COMMANDER — DECLARED — S2 CRITICAL — Tab 1

**ID:** WF-IC-02
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-f9c1d4`
**Role:** OPERATOR (is commander)
**Commander status:** IS commander
**Incident state:** DECLARED
**Severity:** S2 — CRITICAL
**Active tab:** Tab 1 — Situation Overview
**Purpose:** Show what the incident commander sees at an active S2 incident — same Tab 1 situational awareness as WF-IC-01 but with commander-exclusive controls present (Transfer Command) and S2 deep-orange visual treatment.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)  // bg: #1A1A1A                                                                       │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay] [Settings·ADMIN]    [Riverside Golf Club — C]  [JE▼] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // bg: #E64A19 at 15% on #1A1A1A  (S2 deep-orange tint)                         │
│                                                                                                                  │
│  LEFT GROUP                          CENTER GROUP              RIGHT GROUP                                       │
│  [INC-riverside-f9c1d4]              Duration                  Commander                                        │
│  ▲ S2 CRITICAL  [DECLARED]          01:07:22                  Jordan Ellis (OPERATOR) ← YOU                    │
│  Declared  01 Jun 2026 15:39 AEST                             [Transfer Command]                                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ ZONE B — TAB STRIP (48px)  // bg: #1E1E1E                                         │
│ // bg: #121212           │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│                          │ │    (active — 3px deep-orange bottom border #E64A19)                                │
│  ◉ Home / Live Ops       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Venues                │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Incidents  [●1]       │ │ ZONE B — TAB 1 CONTENT (scrollable)                                               │
│  ◉ Replay & Forensics    │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│  ─────────────────────   │ │  SECTION A — INCIDENT SUMMARY                                                      │
│  THIS INCIDENT           │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  ▶ Situation Overview    │ │ │  Incident        inc-riverside-f9c1d4a2b3e8c9d0  (monospace 13px)            │ │
│    Command Log           │ │ │  Declared by     Jordan Ellis  [OPERATOR]                                      │ │
│    Override Mgmt         │ │ │  Declared at     01 Jun 2026 15:39:44 AEST                                     │ │
│    PRE Status            │ │ │  Scope           Riverside Golf Club  [C]                                      │ │
│    Incident Actions      │ │ │  Severity        ▲ S2 CRITICAL                                                 │ │
│                          │ │ │  State           [DECLARED]                                                     │ │
│  ─────────────────────   │ │ │  Description     Multiple screens unresponsive. PRE in error state.            │ │
│  Riverside Golf Club [C] │ │ │                  Potential network partition detected. Escalated from          │ │
│                          │ │ │                  S3 at 15:52 by Jordan Ellis.                                  │ │
│                          │ │ │                  Peak: S2  (current severity = high-water)                     │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION B — VENUE STATUS COMPARISON                                               │
│                          │ │  ┌───────────────────────────────┐   ┌───────────────────────────────┐           │
│                          │ │  │  AT DECLARATION               │   │  NOW                          │           │
│                          │ │  │  01 Jun 2026 15:39 AEST       │   │  01 Jun 2026 16:46 AEST       │           │
│                          │ │  │  CONSTITUTIONAL_RISK          │   │  EMERGENCY_FREEZE ← tint      │           │
│                          │ │  │  (amber bold 20px)            │   │  (deep red bold 20px)  ← tint │           │
│                          │ │  │  Screens: 23 / 3 offline      │   │  Screens: 23 / 7 offline ←tnt │           │
│                          │ │  │  Overrides: 2 active          │   │  Overrides: 2 active          │           │
│                          │ │  │  PRE: ERROR                   │   │  PRE: ERROR           ← tint  │           │
│                          │ │  │  Confidence: [MEDIUM]         │   │  Confidence: [NONE]   ← tint  │           │
│                          │ │  └───────────────────────────────┘   └───────────────────────────────┘           │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION C — ACTIVE OVERRIDES AT DECLARATION                                       │
│                          │ │  "2 overrides active when this incident was declared."                             │
│                          │ │                                                                                     │
│                          │ │  [L2] Override #4831 — Emergency Broadcast on Venue-wide — placed 2h ago by JE    │
│                          │ │       ⏱ Auto-expires: 01 Jun 2026 20:00 AEST                                      │
│                          │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─              │
│                          │ │  [L1] Override #4828 — Network Hold on Zone A — placed 3h ago by SA               │
│                          │ │       ⏱ Auto-expires: 01 Jun 2026 21:00 AEST                                      │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION D — PRE STATE COMPARISON                                                  │
│                          │ │  ┌────────────────────────────────┐  ┌────────────────────────────────┐          │
│                          │ │  │  PRE AT DECLARATION            │  │  PRE NOW                       │          │
│                          │ │  │  L0 Emergency    INACTIVE      │  │  L0 Emergency    ACTIVE ← tint │          │
│                          │ │  │  L1 Operational  Hold Rule A   │  │  L1 Operational  Hold Rule A   │          │
│                          │ │  │  L2 Scheduled    Suppressed    │  │  L2 Scheduled    Suppressed    │          │
│                          │ │  │  (winning: L1)                 │  │  (winning: L0)         ← tint  │          │
│                          │ │  └────────────────────────────────┘  └────────────────────────────────┘          │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION E — LAST KNOWN GOOD STATE                                                 │
│                          │ │  "System state 15 minutes before declaration — 01 Jun 2026 15:24 AEST"            │
│                          │ │  Constitutional state: HEALTHY                                                     │
│                          │ │  Active overrides: 0                                                               │
│                          │ │  PRE: L3 Campaign — Weekend Promo winning                                         │
│                          │ │                                                                                     │
│                          │ │  [Open in Replay Workspace]                                                        │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Incident Identity Bar Detail

```
// HEIGHT: 72px  // bg: #E64A19 at 15% on #1A1A1A

LEFT GROUP:
  Row 1: [INC-riverside-f9c1d4]  ← tappable copy
  Row 2: ▲ S2 CRITICAL  (badge: #E64A19 bg, white text, triangle icon)
         [DECLARED]  (pill: #1565C0 bg, white)
  Row 3: Declared  01 Jun 2026 15:39 AEST

CENTER GROUP:
  "Duration"  (12px muted)
  01:07:22  (bold, live)

RIGHT GROUP:
  "Commander"  (12px muted)
  Jordan Ellis (OPERATOR) — YOU  (14px; "YOU" in muted 11px italic to distinguish self)
  [Transfer Command]  ← PRESENT — this operator IS the commander
    Button: 32px height, secondary style, label "Transfer Command"
    Tapping opens Transfer panel inline (see Section 7 of spec)
```

### Zone A Detail (280px)

Same structure as WF-IC-01. Key differences:
- Incidents badge color: `#E64A19` (S2 deep orange)
- Active tab left border: `#E64A19`
- No Evidence Package item (OPERATOR role)

### Component Placement

Same components as WF-IC-01 with additions:
- [Transfer Command] button in Identity Bar right group (commander-only)
- S2 severity styling throughout (deep orange, triangle icon)

### Interaction Notes

- [Transfer Command]: opens inline transfer panel anchored to Identity Bar right group. Panel slides in from right of Identity Bar. Lists operators currently viewing + all OPERATOR+ with venue access.
- All Section interactions identical to WF-IC-01.
- S2 incident: Zone B is automatically replaced for all OPERATOR+ users (forced, undismissable until CONTAINED). Browser [Back] suppressed for commander.

### Disabled-State Behavior

- Commander context: [Transfer Command] present. No other commander-exclusive write controls on Tab 1.
- Section B override count: tappable → Tab 3.
- [Assume Command]: **absent** — state is DECLARED with active commander.

### Replay-State Behavior

[Transfer Command] button absent in REPLAY mode (IC-03). [Open in Replay Workspace] link present. REPLAY MODE banner below Identity Bar. Tab 1 otherwise identical.

### Degraded-State Behavior

Same as WF-IC-01. Additionally: if Confidence = NONE in Section B right column, the label reads "Confidence: NONE — delivery confirmation unavailable. PRE configuration is authoritative but delivery cannot be verified."

### Incident-State Behavior

- S2 deep-orange tint on Identity Bar (`#E64A19` at 15%).
- Incidents badge in Zone A: `#E64A19`.
- Active tab bottom border: `#E64A19`.
- S2 auto-replaced Zone B for all OPERATOR+ users (forced navigation to IC surface).
- No EMERGENCY_FREEZE overlay (S2 does not trigger EMERGENCY_FREEZE label — that is S1 only).
- Commander can be blocked from [Back] navigation if S2 triggers the EMERGENCY_FREEZE constitutional state (see WF-IC-10 for S1 explicit case).

### Accessibility Notes

- [Transfer Command]: `role="button"`, `aria-label="Transfer incident command to another operator"`.
- S2 badge: `aria-label="Severity S2 CRITICAL"`.
- All other accessibility notes identical to WF-IC-01.
- Emergency keyboard shortcut consideration: Tab key should reach [Transfer Command] quickly from Identity Bar. Recommend placing it in focus order immediately after incident ID copy control.

---

## WF-IC-03: Incident Command — OPERATOR — COMMANDER_LAPSED — Any Severity — Tab 1

**ID:** WF-IC-03
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-b7e2a1`
**Role:** OPERATOR (not former commander — a different operator viewing this incident)
**Commander status:** No current commander (COMMANDER_LAPSED)
**Incident state:** COMMANDER_LAPSED
**Severity:** S3 — MAJOR
**Active tab:** Tab 1 — Situation Overview
**Purpose:** Show the full COMMANDER_LAPSED visual treatment — red Identity Bar right group, amber warning banner between Identity Bar and tabs, pulsing Zone A dot, countdown clock under 3 minutes (pulsing red), and the [Assume Command] confirmation flow.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)  // bg: #B71C1C  ← shifts to deep red during COMMANDER_LAPSED                        │
│  ClubHub TV   [Live Ops] [Venues] [⚡Incidents ●1] [Replay]    [Riverside Golf Club — C]               [SA▼] │
│                                     ↑ pulsing red 8px dot                                                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // bg: #F57C00 at 15% on #1A1A1A  (S3 amber tint on base)                       │
│                                                                                                                  │
│  LEFT GROUP                          CENTER GROUP              RIGHT GROUP (REPLACED — 280px)                   │
│  [INC-riverside-b7e2a1]              Duration                 ┌──────────────────────────────┐                 │
│  ◆ S3 MAJOR  [DECLARED]             03:41:15                 │ ⚠ COMMANDER LAPSED            │                 │
│  Declared  01 Jun 2026 13:05 AEST                            │ Former commander: Alex Kim     │                 │
│                                                               │ Lapsed: 12:47 ago             │                 │
│                                                               │ Level 1 alert in: 02:13 ←pulse│                 │
│                                                               │ [Assume Command]              │                 │
│                                                               └──────────────────────────────┘                 │
│                                                               // bg: #B71C1C, border: 2px #EF5350              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ COMMANDER_LAPSED WARNING BANNER (40px)  // bg: #F57F17 at 20%, border-bottom: 2px #F57F17                      │
│  ⚠ No incident commander — this incident is unmanaged. Any OPERATOR+ can assume command.  [Assume Command]     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ ZONE B — TAB STRIP (48px)                                                          │
│ // bg: #121212           │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Home / Live Ops       │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Venues                │ │ ZONE B — TAB 1 CONTENT (scrollable)                                               │
│  ⚡◉ Incidents [●1]      │ │                                                                                     │
│  ↑ pulsing red 8px dot   │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│  ◉ Replay & Forensics    │ │  SECTION A — INCIDENT SUMMARY (same structure as WF-IC-01)                        │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  ─────────────────────   │ │ │  Incident        inc-riverside-b7e2a1...                                      │ │
│  THIS INCIDENT           │ │ │  Declared by     Alex Kim  [OPERATOR]                                         │ │
│  ▶ Situation Overview    │ │ │  State           [DECLARED]                                                    │ │
│    Command Log           │ │ │  Severity        ◆ S3 MAJOR                                                    │ │
│    Override Mgmt         │ │ │  (all other fields as per spec)                                               │ │
│    PRE Status            │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│    Incident Actions      │ │                                                                                     │
│                          │ │  [Sections B–E rendered identically to WF-IC-01 — no modifications for           │
│  ─────────────────────   │ │   COMMANDER_LAPSED on Tab 1 content itself]                                       │
│  Riverside Golf Club [C] │ │                                                                                     │
└──────────────────────────┘ └───────────────────────────────────────────────────────────────────────────────────┘
```

### COMMANDER_LAPSED Indicator Detail (right group of Identity Bar)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠ COMMANDER LAPSED                               [Assume Command]   │
│  Former commander: Alex Kim                                           │
│  Lapsed: 12:47 ago   ·   Level 1 alert in: 02:13                    │
└──────────────────────────────────────────────────────────────────────┘

Visual specification:
  Width: 280px (full right group)
  Height: 72px (fills Identity Bar height)
  Background: #B71C1C full opacity
  Border: 2px solid #EF5350
  Text: #FFFFFF

  "⚠ COMMANDER LAPSED"  — 14px bold uppercase, letter-spacing 0.05em
  "Former commander: Alex Kim"  — 12px regular
  "Lapsed: 12:47 ago"  — 12px regular, updates every second
  "Level 1 alert in: 02:13"  — 12px bold #FF8A80, pulses (opacity 100%→60%, 1s cycle)
    ↑ pulsing because under 3 minutes remaining
  [Assume Command]  — 32px height, bg #FFFFFF, text #B71C1C, 13px bold
```

### Assume Command Confirmation Flow (inline card)

When [Assume Command] is tapped (from either the indicator or the banner), an inline confirmation card expands **below the COMMANDER_LAPSED indicator** without opening a modal:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Assume command of this incident?                                                │
│                                                                                  │
│  You will become the Incident Commander.                                         │
│  You will be responsible for driving this incident to CONTAINED and then        │
│  RESOLVED.                                                                       │
│                                                                                  │
│  [Confirm — Assume Command]                           [Cancel]                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Card appears inline, pushing tab content down. Width: full Zone B. After [Confirm — Assume Command]: POST to `/incidents/{id}/command/claim`. UI does not update until server responds (IC-01). On success: COMMANDER_LAPSED indicator replaced by standard commander display; amber banner removed; System Status Bar background reverts; Zone A pulsing dot removed.

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| CommanderLapsedIndicator | Identity Bar right group | Replaces standard commander name |
| CommanderLapsedBanner | Between Identity Bar and Tab Strip | Amber, full-width |
| AssumeCommandButton | In indicator AND in banner | Both trigger same confirmation card |
| AssumeCommandConfirmCard | Inline below indicator | Not a modal; expands in-place |
| SystemStatusBar | Top 48px | Background #B71C1C during COMMANDER_LAPSED |
| PulsingDot | Zone A "Incidents" nav item | 8px red dot, 1-second pulse on 2-second cycle |
| CountdownTimer | In COMMANDER_LAPSED indicator | "Level 1 alert in: MM:SS" — under 3 min = pulses |

### Interaction Notes

- [Assume Command] (in indicator): triggers confirmation card expanding below indicator.
- [Assume Command] (in amber banner): same action, same confirmation card.
- [Confirm — Assume Command]: POST `/incidents/{id}/command/claim`. IC-01 applies (no optimistic update).
- [Cancel]: dismisses confirmation card. COMMANDER_LAPSED state persists.
- Tapping tab labels still works — operator can navigate to Command Log to see the lapse entry.
- Tab 5 will show "No commander is assigned. Assume command to access incident actions." note card.

### Disabled-State Behavior

- [Transfer Command]: **absent** — no commander exists to initiate transfer.
- [Mark Incident Contained]: **absent** — requires active commander (Tab 5).
- [Resolve Incident]: **absent** — CONTAINED state not reachable without commander.
- VIEWER role: [Assume Command] button **absent** (VIEWER cannot assume command).

### Replay-State Behavior

In REPLAY mode: [Assume Command] buttons (indicator + banner) are **absent** (IC-03). Confirmation card cannot be triggered. COMMANDER_LAPSED visual treatment (red indicator, amber banner, pulsing dot, red System Status Bar) is still shown — these are historical state indicators, not write controls. REPLAY MODE banner appears below the amber banner.

### Degraded-State Behavior

- If WebSocket disconnects during COMMANDER_LAPSED: countdown clock continues locally (derived from known lapse timestamp). Reconnect banner appears at bottom of Zone B.
- If claim POST fails (network error): inline error appears below confirmation card buttons: "Failed to claim command. Please try again. Error recorded." Confirmation card remains open.

### Incident-State Behavior

**All COMMANDER_LAPSED modifications active simultaneously:**
1. Identity Bar right group: replaced by red COMMANDER_LAPSED indicator.
2. Full-width amber banner between Identity Bar and tab strip.
3. System Status Bar background: `#B71C1C`.
4. Zone A "Incidents" item: pulsing 8px red dot.
5. Tab 5 "Incident Actions": commander-exclusive controls absent, note card present.
6. Countdown under 3 min: pulses at `#FF8A80`.
7. At 00:00: countdown changes to "Level 1 alert FIRED" static red; COMMANDER_LAPSED_ALERT_FIRED event in Command Log.

### Accessibility Notes

- COMMANDER_LAPSED indicator: `role="alert"`, `aria-live="assertive"` — screen readers announce immediately on state change.
- Amber banner: `role="status"`, `aria-live="polite"`.
- Countdown: `aria-live="off"` (do not read every second). `aria-label` updates only at key thresholds (e.g., "Level 1 alert in under 3 minutes").
- [Assume Command] buttons: `role="button"`, `aria-label="Assume command of this incident"`.
- Confirmation card: `role="dialog"` (inline), `aria-modal="false"`, `aria-labelledby="assume-command-heading"`.
- Focus: on [Assume Command] tap, focus moves to confirmation card. On [Cancel], focus returns to [Assume Command] button.
- Keyboard: Escape dismisses confirmation card.

---

## WF-IC-04: Incident Command — COMMANDER — DECLARED — Tab 2 (Command Log with annotation input)

**ID:** WF-IC-04
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** OPERATOR (is commander)
**Commander status:** IS commander
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 2 — Command Log
**Purpose:** Show the chronological audit log with real-time WebSocket updates, COMMANDER_LAPSED historical entry styling, and the fixed-position annotation input at the bottom of the tab.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay]    [Riverside Golf Club — C]               [JE▼]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:14:38   Commander: Jordan Ellis  [Transfer]  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)                                                                   │
│                          │ │  Situation Overview  │  ▶ Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│  ◉ Home / Live Ops       │ │                         (active — 3px amber bottom border)                        │
│  ◉ Venues                │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Incidents  [●1]       │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Replay & Forensics    │ │ TAB 2 — COMMAND LOG CONTENT                                                       │
│                          │ │                                                                                     │
│  ─────────────────────   │ │  Auto-scroll to latest: [ON ▶]           ← toggle top-right of tab                │
│  THIS INCIDENT           │ │                                                                                     │
│    Situation Overview    │ │ ──────────────────────────────────────────────────────────────────────────────── │
│  ▶ Command Log           │ │  14:32:07  Jordan Ellis [OPERATOR]         [INCIDENT_DECLARED]                    │
│    Override Mgmt         │ │  Incident declared by Jordan Ellis. Severity: S3 MAJOR. Scope: Riverside Golf.    │
│    PRE Status            │ │  Authority: OPERATOR                                                               │
│    Incident Actions      │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  14:35:22  Jordan Ellis [OPERATOR]         [OPERATOR_NOTE]                        │
│  ─────────────────────   │ │  PRE divergence confirmed on screens 4, 7, 12. Investigating manifest sync.       │
│  Riverside Golf Club [C] │ │  Authority: OPERATOR                                                               │
│                          │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  14:38:45  System (italic)                 [SEVERITY_CHANGED]                     │
│                          │ │  Severity unchanged — no escalation at this time.                                  │
│                          │ │  Authority: SYSTEM                                                                  │
│                          │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  14:52:11  System (italic)                 [COMMANDER_LAPSED]                     │
│                          │ │  ┌ ── COMMANDER_LAPSED ENTRY ── 6px #B71C1C left border, amber bg 10% ─ ┐        │
│                          │ │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│        │
│                          │ │  Commander session expired: Alex Kim                                       │        │
│                          │ │  Incident is unmanaged. 15-minute claim window begins now.                │        │
│                          │ │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│        │
│                          │ │  └ ────────────────────────────────────────────────────────────────────── ┘       │
│                          │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  14:54:08  Jordan Ellis [OPERATOR]         [COMMAND_TRANSFERRED]                  │
│                          │ │  Jordan Ellis assumed command of this incident.                                    │
│                          │ │  Authority: OPERATOR                                                               │
│                          │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  15:10:44  Jordan Ellis [OPERATOR]         [OPERATOR_NOTE]                        │
│                          │ │  Manifest sync restored on screens 4 and 7. Screen 12 still divergent.            │
│                          │ │  Authority: OPERATOR                                                               │
│                          │ │ ──────────────────────────────────────────────────────────────────────────────── │
│                          │ │  16:44:52  Jordan Ellis [OPERATOR]         [OPERATOR_NOTE]                        │
│                          │ │  Ongoing monitoring. No further escalation needed at this time.                   │
│                          │ │  Authority: OPERATOR                                                               │
│                          │ │                                                                                     │
│                          │ │  ·  ·  ·  (new entries append here via WebSocket)                                 │
│                          │ │                                                                                     │
│                          │ │ ════════════════════════════════════════════════════════════════════════════════  │
│                          │ │  ADD ANNOTATION (fixed-position — does not scroll away)                           │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  Add annotation to command log                                                 │ │
│                          │ │ │  ┌─────────────────────────────────────────────────────────────────────────┐  │ │
│                          │ │ │  │ Screen 12 manifest re-sync attempt in progress. Expect resolution by    │  │ │
│                          │ │ │  │ 17:00 AEST.                                                              │  │ │
│                          │ │ │  │ _                                                                        │  │ │
│                          │ │ │  └─────────────────────────────────────────────────────────────────────────┘  │ │
│                          │ │ │  83 / 500 characters                            [Add Annotation]              │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Command Log Entry Anatomy

Each standard entry follows this structure:
```
[HH:mm:ss TZ]  [Operator Name] ([ROLE_BADGE])      [EVENT_TYPE_PILL]
[Entry body — full text, not truncated]
                                                    Authority: [LEVEL]
─────────────────────────────────────────────────────────────────────
```

Role badge colors: VIEWER=grey `#757575`, OPERATOR=blue `#1565C0`, ADMIN=gold `#F57C00`, SYSTEM=dark slate `#37474F`.

Event type pill: border-only style (outline), 11px, colored per event type. Key event type colors:
- INCIDENT_DECLARED: `#1565C0` blue
- COMMANDER_LAPSED: `#B71C1C` red
- COMMAND_TRANSFERRED: `#2E7D32` green
- OPERATOR_NOTE: `#37474F` slate
- SEVERITY_CHANGED: `#E65100` orange
- INCIDENT_STATE_CHANGED: `#6A1B9A` purple

### COMMANDER_LAPSED Log Entry (special styling)

```
Full-width row
Left border: 6px solid #B71C1C
Background: amber at 10% opacity (#F57C00 at 10%)
━━━ rule above and below the text
Text "Commander session expired: [NAME]" + "Incident is unmanaged." in white on dark
```

### Annotation Input Component (fixed-position)

```
Position: sticky bottom-0 in Zone B scroll container (does not scroll away)
Height: ~120px
Border-top: 1px solid #2A2A2A
Background: #161616

Layout:
  Row 1: "Add annotation to command log"  (label, 13px muted)
  Row 2: Textarea — 3 rows, resizable vertically, max 500 characters
          Placeholder: "Add operational note..."
  Row 3: "[N / 500 characters]" left-aligned muted
          [Add Annotation] button right-aligned
            — inactive (opacity 0.35, pointer-events none) when textarea is empty
            — active when ≥1 character present
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| CommandLogList | Zone B tab content, scrollable area | Ordered oldest-first |
| CommandLogEntry (standard) | Each row in log list | Role badge + event pill + body + authority |
| CommandLogEntry (COMMANDER_LAPSED) | Special row | Full-width, red left border, amber bg |
| AutoScrollToggle | Top-right of tab content | Default: ON |
| NewEntriesIndicator | Bottom of log, appears when scrolled up | "[N] new entries — scroll to latest ↓" |
| AnnotationInput | Fixed at bottom of tab | Textarea + char count + submit button |
| WebSocketReconnectBanner | Bottom of Zone B | Shown only on connection loss |

### Interaction Notes

- Auto-scroll toggle [ON/OFF]: when ON, log scrolls to bottom on each new WebSocket entry. When manually scrolled up: auto-scroll suspends and shows "N new entries" toast at bottom.
- [Add Annotation] button: active only when textarea has ≥1 character. On submit: audit event emitted immediately (IC-04), then POST to log endpoint. Entry appears only after server confirmation (IC-01). On server rejection: error inline below textarea (IC-02).
- Timestamp hover: shows full datetime (`DD MMM YYYY HH:mm:ss TZ`) in a tooltip.
- Commander-specific: [Transfer Command] button remains in Identity Bar on this tab, identical to WF-IC-02.

### Disabled-State Behavior

- VIEWER role: [Add Annotation] input and button **absent** from DOM.
- RESOLVED state: [Add Annotation] input and button **absent**.
- Character count at 500: textarea blocks further input. Character label shifts to red.

### Replay-State Behavior

[Add Annotation] textarea and button **absent** (IC-03). Log is fully readable. REPLAY MODE banner below Identity Bar. No auto-scroll toggle changes — toggle present but has no new entries to scroll to in historical mode.

### Degraded-State Behavior

- WebSocket disconnected: banner at bottom of log: "Command log feed interrupted — reconnecting... Last received: 16:44:52 AEST." Reconnect attempted every 5 seconds.
- On reconnect: banner dismissed. Any entries received during gap append normally.

### Incident-State Behavior

- COMMANDER_LAPSED entries visually distinguished as described.
- COMMANDER_LAPSED_ALERT_FIRED entry: full-width row, `#C62828` bg at 15%, `#C62828` left border 6px, text: "Level 1 constitutional alert fired. All OPERATOR+ users with venue access notified."
- S3 amber active-tab indicator.

### Accessibility Notes

- Log list: `role="log"`, `aria-live="polite"`, `aria-relevant="additions"` — new entries announced non-intrusively.
- Auto-scroll toggle: `role="switch"`, `aria-checked="true/false"`.
- Textarea: `aria-label="Add annotation to command log"`, `aria-describedby="char-count"`.
- [Add Annotation] button: `aria-disabled="true"` when inactive (empty textarea).
- COMMANDER_LAPSED entry: `aria-label="Important: Commander session expired"` on the distinguished row.
- Keyboard shortcut (emergency scenario): Ctrl+Shift+A focuses annotation textarea.

---

## WF-IC-05: Incident Command — OPERATOR — DECLARED — Tab 3 (Override Management with Place Override inline form)

**ID:** WF-IC-05
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** OPERATOR (not commander — non-commander operators can still place L1–L5 overrides)
**Commander status:** Not commander
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 3 — Override Management
**Purpose:** Show the override list and the expanded Place Override inline form (Level 3 selected, after [Preview Impact] has been invoked, [Place] button now active).

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay]    [Riverside Golf Club — C]               [SA▼]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:31:09   Commander: Jordan Ellis               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)                                                                   │
│                          │ │  Situation Overview  │  Command Log  │  ▶ Override Mgmt  │  PRE Status  │  Actions │
│  ◉ Incidents  [●1]       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ─────────────────────   │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  THIS INCIDENT           │ │ TAB 3 — OVERRIDE MANAGEMENT CONTENT (scrollable)                                  │
│    Situation Overview    │ │                                                                                     │
│    Command Log           │ │  HEADER ROW:                                                                       │
│  ▶ Override Mgmt         │ │  "Active Overrides — Riverside Golf Club"    [Place Override]                      │
│    PRE Status            │ │  "4 overrides currently active."                                                   │
│    Incident Actions      │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│  ─────────────────────   │ │  PLACE OVERRIDE INLINE FORM (expanded — appears below header, above override list)│
│  Riverside Golf Club [C] │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  Place Override                                                                │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Level:  [L1]  [L2]  ■L3■  [L4]  [L5]                                       │ │
│                          │ │ │         (L6 absent — OPERATOR role, not ADMIN)                               │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Content:  ┌─────────────────────────────────────────────────────────┐      │ │
│                          │ │ │            │ Riverside Welcome Loop v3             [× Clear]  [▼]    │      │ │
│                          │ │ │            └─────────────────────────────────────────────────────────┘      │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Scope:  ● This screen:  [Screen 12 — Zone B Display       [▼]]             │ │
│                          │ │ │          ○ Zone:          [Zone picker                      [▼]]             │ │
│                          │ │ │          ○ Venue-wide                                                         │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Expiry: ● In:  [1 hour                                    [▼]]             │ │
│                          │ │ │          ○ At:  [date/time picker]                                            │ │
│                          │ │ │          ○ No expiry  (ADMIN only for L1–L4 — absent here)                   │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Reason: ┌─────────────────────────────────────────────────────────┐        │ │
│                          │ │ │          │ Screen 12 divergence — forcing known-good content        │        │ │
│                          │ │ │          │ during incident investigation.                            │        │ │
│                          │ │ │          └─────────────────────────────────────────────────────────┘        │ │
│                          │ │ │          54 / 500 characters (min 10 required — met ✓)                       │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  ┌──────────────────────────────────────────────────────────────────────┐   │ │
│                          │ │ │  │  ✓ PREVIEW IMPACT RESULT (computed)                                  │   │ │
│                          │ │ │  │  Screens affected: 1 (Screen 12)                                     │   │ │
│                          │ │ │  │  Content displaced: Summer Tournament Campaign (L3)                  │   │ │
│                          │ │ │  │  Effective immediately at next poll cycle (≤15s)                    │   │ │
│                          │ │ │  └──────────────────────────────────────────────────────────────────────┘   │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  [Cancel]                       [Preview Impact ✓]    [Place]               │ │
│                          │ │ │                                  (already invoked)      (active — all met)   │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  OVERRIDE LIST                                                                      │
│                          │ │                                                                                     │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  [L3] Override #4821                           ⏱ Auto-expires: 18:00 AEST     │ │
│                          │ │ │  Content: ClubHouse Sponsor Loop                                               │ │
│                          │ │ │  Scope: Zone B                                                                 │ │
│                          │ │ │  Placed: 01 Jun 2026 13:28 AEST by Jordan Ellis                               │ │
│                          │ │ │  Age: 3 hours                                                                  │ │
│                          │ │ │                               [View Details]    [Remove Override ▾]            │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  [L2] Override #4815                    ⚠ No expiry — PERMANENT UNTIL REMOVED  │ │
│                          │ │ │  Content: Emergency Fallback Screen                                            │ │
│                          │ │ │  Scope: Screen 12                                                              │ │
│                          │ │ │  Placed: 01 Jun 2026 11:03 AEST by Sam Admin                                  │ │
│                          │ │ │  Age: 5 hours                                                                  │ │
│                          │ │ │                               [View Details]    [Remove Override ▾]            │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  [L2] Override #4830  (NEW — just placed, awaiting server confirm)            │ │
│                          │ │ │  [spinner] Placing override...                                                 │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │  ·  ·  ·  (additional overrides below fold)                                       │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Place Override Form — Field Details

```
LEVEL SELECTOR:
  Five buttons: [L1] [L2] [■L3■] [L4] [L5]
  L3 selected: button has filled background (#00695C teal), white text, border-radius 4px
  L1=navy, L2=blue, L4=amber, L5=red — outline style when unselected
  L6 absent entirely from DOM (OPERATOR role)

CONTENT PICKER:
  Search-or-browse input field, 100% width
  Shows currently selected content name with × clear and ▼ expand
  Dropdown shows recently used + search results

SCOPE RADIO GROUP:
  Three radio options. "This screen" selected.
  Screen picker: dropdown showing screen list for venue

EXPIRY RADIO GROUP:
  "In": dropdown — options: 15min / 30min / 1h / 2h / 4h. "1 hour" selected.
  "At": date+time picker (hidden — appears when this radio selected)
  "No expiry": absent for L1–L4 OPERATOR (visible only to ADMIN)

REASON FIELD:
  Textarea, min 10 characters required
  Character count shown. Green when ≥10 chars and ≤500 chars.

PREVIEW IMPACT RESULT CARD:
  Shown after [Preview Impact] successfully called
  Green checkmark header
  Lists affected screen count + displaced content + timing
  If not yet invoked: card is absent; [Place] button is inactive

BUTTONS (bottom row, right-aligned):
  [Cancel]          — dismisses inline form
  [Preview Impact ✓] — grayed with checkmark when already invoked; re-invokeable
  [Place]           — active (all conditions met: fields filled + preview invoked)
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| OverrideManagementHeader | Top of tab content | Heading + override count + [Place Override] button |
| PlaceOverrideForm | Inline panel below header | Expanded state shown here |
| LevelSelector | Inside form | 5 buttons (no L6 for OPERATOR) |
| ContentPicker | Inside form | Search/browse component |
| ScopePicker | Inside form | Radio group + contextual picker |
| ExpiryPicker | Inside form | Radio group + duration/datetime picker |
| ReasonField | Inside form | Textarea with char count |
| PreviewImpactCard | Inside form | Shown after preview call |
| OverrideCard | One per active override | Full-width card with level badge + details |
| RemoveOverrideSplitButton | In each override card | [Remove Override ▾] with dropdown |

### Interaction Notes

- [Place Override] button (top-right of tab): tapping expands inline form panel, pushes override list down. Does not open modal.
- Level buttons: tapping changes selection. L3→L1–L3 requires preview before place.
- [Preview Impact]: calls PRE preview endpoint. While loading: button shows spinner, label "Previewing...". On success: preview result card appears. [Place] becomes active.
- [Place]: active only after all required fields filled AND preview invoked (for L1–L3). On tap: audit event (IC-04), POST. Override appears in list only after server confirmation (IC-01). Pending state shown as spinner card.
- [Remove Override ▾]: split button. Main click = direct remove. Dropdown shows "Remove Override" + "Schedule removal at: [time]". For L1–L4: inline confirmation card appears.
- [Cancel] in form: dismisses inline form without placing override.

### Disabled-State Behavior

- [Place] button: inactive (opacity 0.35, pointer-events none) until all required fields filled + preview invoked (L1–L3).
- "No expiry" option: **absent** for L1–L4 OPERATOR role.
- L6 level button: **absent** for OPERATOR role.
- VIEWER role: [Place Override] button **absent**, [Remove Override] button **absent** — entire tab is read-only.

### Replay-State Behavior

[Place Override] button **absent**. [Remove Override] buttons **absent**. All form controls **absent** (IC-03). Override list visible as read-only. REPLAY MODE banner below Identity Bar.

### Degraded-State Behavior

- If content picker API returns error: "Could not load content list. Search by name or try again." with a [Retry] link.
- If PRE preview endpoint returns error: preview result card shows "Preview failed — PRE endpoint unavailable. You may place the override without impact preview, but delivery cannot be predicted." [Place] button remains inactive for L1–L3 until network restored.
- If POST fails: spinner card replaced with error card: "Override placement failed. Error recorded. [Retry]".

### Incident-State Behavior

- S3 amber styling on Identity Bar and tab indicator.
- No S1 overlay or suppression.
- COMMANDER_LAPSED: [Place Override] still present for OPERATOR (override placement does not require commander status).

### Accessibility Notes

- Level selector: `role="radiogroup"`, each button `role="radio"`, `aria-checked="true/false"`.
- Content picker: `role="combobox"`, `aria-expanded`, `aria-autocomplete`.
- Scope radio group: standard `<fieldset>` + `<legend>` + `<input type="radio">`.
- [Preview Impact]: `aria-label="Preview impact of this override on content delivery"`.
- Preview result card: `aria-live="polite"` — announced when it appears.
- [Place]: `aria-disabled="true"` when conditions not met.
- Override cards: `role="article"`, `aria-label="Override [LEVEL] #[ID]"`.
- [Remove Override ▾] split button: `aria-haspopup="menu"` on dropdown trigger.
- Keyboard: Tab through form fields in order Level → Content → Scope → Expiry → Reason → Preview → Place.

---

## WF-IC-06: Incident Command — ADMIN — DECLARED — Tab 3 — L6 Emergency Override Confirmation Flow

**ID:** WF-IC-06
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** ADMIN
**Commander status:** Not commander (ADMIN viewing incident)
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 3 — Override Management
**Purpose:** Show the L6 Emergency Override selection with its mandatory EMERGENCY text confirmation — the inline form after ADMIN has selected L6, filled all fields, and must type "EMERGENCY" before [Place L6 Override] activates.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay] [Settings]   [Riverside Golf Club — C]    [SA▼]     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:45:00   Commander: Jordan Ellis               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)                                                                   │
│                          │ │  Situation Overview  │  Command Log  │  ▶ Override Mgmt  │  PRE Status  │  Actions │
│  ◉ Incidents  [●1]       │ │                                                              Evidence Pkg ←ADMIN   │
│  ─────────────────────   │ └───────────────────────────────────────────────────────────────────────────────────┘
│  THIS INCIDENT           │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│    Situation Overview    │ │ TAB 3 — OVERRIDE MANAGEMENT  (ADMIN view — 6 tabs visible in strip)               │
│    Command Log           │ │                                                                                     │
│  ▶ Override Mgmt         │ │  "Active Overrides — Riverside Golf Club"    [Place Override]                      │
│    PRE Status            │ │  "4 overrides currently active."                                                   │
│    Incident Actions      │ │                                                                                     │
│    Evidence Package      │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  PLACE OVERRIDE INLINE FORM — L6 SELECTED                                         │
│  ─────────────────────   │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  Riverside Golf Club [C] │ │ │  Place Override                                                                │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Level:  [L1]  [L2]  [L3]  [L4]  [L5]  ■L6 EMERGENCY■                       │ │
│                          │ │ │         L6 selected: #880E4F bg, bold white, full border                      │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Content:  ┌────────────────────────────────────────────────────────────┐    │ │
│                          │ │ │            │ EMERGENCY — Venue Closure Notice               [× ] [▼]   │    │ │
│                          │ │ │            └────────────────────────────────────────────────────────────┘    │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Scope:  ● Venue-wide   (L6 defaults to venue-wide; other options present)   │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Expiry: No expiry — L6 overrides never auto-expire per constitutional rule. │ │
│                          │ │ │          (Expiry picker absent — not selectable for L6)                       │ │
│                          │ │ │                                                                                │ │
│                          │ │ │  Reason: ┌─────────────────────────────────────────────────────────┐        │ │
│                          │ │ │          │ Emergency venue closure — immediate content freeze       │        │ │
│                          │ │ │          │ required per incident INC-riverside-a3f8b2.              │        │ │
│                          │ │ │          └─────────────────────────────────────────────────────────┘        │ │
│                          │ │ │          78 / 500 characters ✓                                               │ │
│                          │ │ │                                                                                │ │
│                          │ │ │ ┌─────────────────────────────────────────────────────────────────────────┐  │ │
│                          │ │ │ │  ⚠ LEVEL 6 — EMERGENCY OVERRIDE                                         │  │ │
│                          │ │ │ │                                                                           │  │ │
│                          │ │ │ │  This override operates at the highest authority level.                  │  │ │
│                          │ │ │ │  It will suppress ALL content including L1–L5 overrides.                │  │ │
│                          │ │ │ │  It will NEVER auto-expire. You must manually remove it.                 │  │ │
│                          │ │ │ │                                                                           │  │ │
│                          │ │ │ │  L6 overrides are permanent records and cannot be deleted.               │  │ │
│                          │ │ │ │                                                                           │  │ │
│                          │ │ │ │  To confirm this is intentional, type the word EMERGENCY below:         │  │ │
│                          │ │ │ │                                                                           │  │ │
│                          │ │ │ │  ┌──────────────────────────────────────────┐                            │  │ │
│                          │ │ │ │  │ EMERGENCY_                               │  ← typed, exact match      │  │ │
│                          │ │ │ │  └──────────────────────────────────────────┘                            │  │ │
│                          │ │ │ │  ✓ Confirmation text matches — [Place L6 Override] is now active        │  │ │
│                          │ │ │ │                                                                           │  │ │
│                          │ │ │ │  [Cancel]                        [Place L6 Override]  ← ACTIVE          │  │ │
│                          │ │ │ └─────────────────────────────────────────────────────────────────────────┘  │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  OVERRIDE LIST (below form, scrollable)                                            │
│                          │ │  [existing overrides as per WF-IC-05...]                                           │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### L6 Confirmation Section — Detailed States

**State A — EMERGENCY not yet typed (default):**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠ LEVEL 6 — EMERGENCY OVERRIDE                                      │
│  [warning text as above]                                              │
│                                                                       │
│  ┌─────────────────────────────────┐                                 │
│  │ [empty — placeholder: type EMERGENCY]│                             │
│  └─────────────────────────────────┘                                 │
│  Must match exactly: EMERGENCY (case-sensitive)                       │
│                                                                       │
│  [Cancel]          [Place L6 Override]  ← inactive (opacity 0.35)    │
└──────────────────────────────────────────────────────────────────────┘
```

**State B — partial text typed ("EMERGE"):**
```
  ┌─────────────────────────────────┐
  │ EMERGE_                         │  ← no match yet
  └─────────────────────────────────┘
  Waiting for exact match: EMERGENCY
  [Place L6 Override] still inactive
```

**State C — "EMERGENCY" typed exactly (active state shown in main layout):**
```
  ┌─────────────────────────────────┐
  │ EMERGENCY_                      │  ← green border on field
  └─────────────────────────────────┘
  ✓ Confirmation text matches
  [Place L6 Override] active — bg #880E4F, white text, fully clickable
```

**State D — typo or trailing character ("EMERGENCY " with space):**
```
  ┌─────────────────────────────────┐
  │ EMERGENCY _                     │  ← red border — trailing space
  └─────────────────────────────────┘
  ✗ Does not match exactly. Check for extra spaces or characters.
  [Place L6 Override] still inactive
```

### L6 Override — Expiry Behavior

The Expiry picker is completely absent when L6 is selected. In its place:
```
  Expiry: No expiry — L6 overrides never auto-expire per constitutional rule.
          (static label, no input, no picker)
```

### Zone A Detail (ADMIN role — 280px)

Same as other wireframes with addition of "Evidence Package" link in the THIS INCIDENT block. Tab strip shows 6 tabs.

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| LevelSelector | Inside form | All 6 levels shown; L6 selected |
| L6ConfirmationSection | Inside form, below reason field | Replaces standard preview section |
| EmergencyConfirmInput | Inside L6 section | Text input, no autocomplete, paste accepted |
| PlaceL6OverrideButton | Bottom of L6 section | Separate from standard [Place] button |

### Interaction Notes

- Selecting L6 in level selector: immediately shows L6 confirmation section. Preview Impact button absent for L6 (not required — L6 always venue-wide with known effect).
- Emergency input: validates on every keystroke. Field border: `#2E7D32` green when exact match, `#C62828` red when content present but not matching. Neutral when empty.
- Paste accepted: `paste` event fires; value is validated on the resulting content.
- [Place L6 Override]: active only when field value is exactly `EMERGENCY` (case-sensitive, no whitespace). On tap: audit event emitted immediately (IC-04), POST to override endpoint. Override appears in list only after server confirmation (IC-01).
- [Cancel]: dismisses inline form.

### Disabled-State Behavior

- [Place L6 Override]: inactive (`pointer-events: none`, opacity: 0.35) until exact match. This is the only exception to the "absent vs disabled" rule — the button must be visible (as a target) but inactive, to communicate that input completion enables it.
- Non-ADMIN role: L6 option entirely absent from level selector. If somehow navigated to via URL: server rejects with 403, error shown inline.

### Replay-State Behavior

Entire Place Override form **absent** (IC-03). L6 confirmation section never appears in REPLAY mode.

### Degraded-State Behavior

If POST fails after [Place L6 Override] is tapped: inline error below L6 section: "L6 override placement failed. This action has been recorded in the audit trail. Error: [SERVER_MESSAGE]. [Retry]". L6 override does not appear in list (IC-01).

### Incident-State Behavior

ADMIN role gains: 6th tab in strip (Evidence Package), "Evidence Package" in Zone A THIS INCIDENT block, L6 in level selector, Settings in nav. All other S3 MAJOR / DECLARED styling identical to OPERATOR view.

### Accessibility Notes

- L6 confirmation section: `role="alertdialog"` (inline, not modal), `aria-labelledby="l6-warning-heading"`.
- Emergency input: `aria-label="Type EMERGENCY to confirm — case sensitive"`, `aria-describedby="l6-match-status"`.
- Match status label: `aria-live="polite"` — announces "Confirmation text matches" when matched.
- [Place L6 Override]: `aria-disabled="true"` when inactive.
- On activation (field matches): browser focus should remain on input; Tab moves to [Place L6 Override].
- Keyboard: pressing Enter in the input field when [Place L6 Override] is active triggers it.

---

*End of WF-IC-01 through WF-IC-06*

---

## WF-IC-07: Incident Command — OPERATOR — DECLARED — Tab 4 (PRE Status)

**ID:** WF-IC-07
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** OPERATOR (not commander)
**Commander status:** Not commander
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 4 — PRE Status
**Purpose:** Show the PRE resolution breakdown with a divergence warning, confidence indicators, the 15-second polling freshness counter, and a degraded-mode stale-data state.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay]    [Riverside Golf Club — C]               [JD▼]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:41:00   Commander: Jordan Ellis               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)                                                                   │
│                          │ │  Situation Overview  │  Command Log  │  Override Mgmt  │  ▶ PRE Status  │  Actions │
│  ◉ Incidents  [●1]       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ─────────────────────   │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  THIS INCIDENT           │ │ TAB 4 — PRE STATUS CONTENT (scrollable)                                           │
│    Situation Overview    │ │                                                                                     │
│    Command Log           │ │  HEADING ROW:                                                                      │
│    Override Mgmt         │ │  "PRE Resolution — Riverside Golf Club"         Last updated: 8s ago              │
│  ▶ PRE Status            │ │  (single venue — no venue selector shown)       (counter increments each second)  │
│    Incident Actions      │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│  ─────────────────────   │ │  DIVERGENCE WARNING CARD                                                           │
│  Riverside Golf Club [C] │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  ⚠ PRE DIVERGENCE DETECTED                                                    │ │
│                          │ │ │                                                                                 │ │
│                          │ │ │  PRE resolution output:  Riverside Welcome Loop v3  (L3)                      │ │
│                          │ │ │  Last confirmed delivery: Summer Tournament Campaign  (stale — 4m 22s ago)     │ │
│                          │ │ │                                                                                 │ │
│                          │ │ │  Possible causes: device offline, HDMI input changed, network partition,      │ │
│                          │ │ │  stale manifest.                                                               │ │
│                          │ │ │                                                                                 │ │
│                          │ │ │  Confidence: [LOW]                                                             │ │
│                          │ │ │  [Investigate in Replay Workspace]                                             │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │  // Divergence card bg: #E65100 at 10%. Border: 2px solid #E65100                 │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  PRE RESOLUTION LEVEL BREAKDOWN                                                    │
│                          │ │  "Last resolved: 16:46:22 AEST"                                                    │
│                          │ │                                                                                     │
│                          │ │  ┌──────────────────────────────────────────────────────────────────────────┐    │
│                          │ │  │ Lvl │ Label               │ Winning content / rule   │ Status           │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L0  │ Emergency           │ Inactive                 │ INACTIVE         │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L1  │ Operational Override│ Hold Rule A              │ ACTIVE           │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L2  │ Scheduled Campaign  │ Weekend Morning Promo    │ SUPPRESSED       │    │
│                          │ │  │     │                     │                          │ Suppressed by L1 │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L3  │ Campaign            │ Riverside Welcome Loop v3│ SUPPRESSED       │    │
│                          │ │  │     │                     │                          │ Suppressed by L1 │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L4  │ Sponsorship Slot    │ None                     │ NONE             │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L5  │ Structural Fallback │ Default Venue Loop       │ ◀ WINNING        │    │
│                          │ │  │     │                     │ ← 4px #1565C0 left border, light blue bg   │    │
│                          │ │  ├─────┼─────────────────────┼──────────────────────────┼──────────────────┤    │
│                          │ │  │ L6  │ Device Default      │ Factory Default Loop     │ ACTIVE           │    │
│                          │ │  └──────────────────────────────────────────────────────────────────────────┘    │
│                          │ │                                                                                     │
│                          │ │  Confidence: [LOW]  — Low confidence in delivery confirmation.                    │
│                          │ │  Delivery log last confirmed: 4m 22s ago.                                         │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### PRE Level Table — Row Detail

```
WINNING ROW (L5 in this example):
  Background: light blue tint (#1565C0 at 8%)
  Left border: 4px solid #1565C0
  Status cell: "◀ WINNING" in blue #1565C0 bold

SUPPRESSED ROW (L2, L3):
  Secondary status label below main status: "Suppressed by L1" — 11px muted italic

INACTIVE ROW (L0, L4):
  Status cell: grey muted text

ACTIVE ROW (L1 — winning here means it is the authority that suppresses others):
  Status cell: "ACTIVE" — green #2E7D32 when not the winning resolver
  Note: L1 here is active and suppresses L2–L4, but L5 is the output winner (L1 is an
  override rule that causes L2–L4 to be suppressed, leaving L5 as the delivery winner)
```

### Confidence Indicator Rendering

```
Confidence badge positioned below the breakdown table:

HIGH:   [HIGH]   — bg #2E7D32, white text
MEDIUM: [MEDIUM] — bg #F57C00, white text
LOW:    [LOW]    — bg #C62828, white text, additional label:
                   "Low confidence in delivery confirmation."
NONE:   [NONE]   — bg #424242, grey text, additional label:
                   "Confidence: NONE — delivery confirmation unavailable.
                    PRE configuration is authoritative but delivery cannot be verified."
```

### Polling Freshness Counter

```
Top-right of tab, persistent:
  "Last updated: 8s ago"  → increments each second
  At 15s: poll fires, counter resets to "0s ago"
  At 30s+ without successful poll: counter background shifts to amber
  At 60s+ without successful poll: counter background shifts to red
    + banner appears: "PRE status temporarily unavailable — last known state shown.
                       Timestamp: 16:46:22 AEST."
    + STALE badge appears on each row in the breakdown table (grey pill "STALE")
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| PRESectionHeader | Top of tab | Venue name + freshness counter |
| VenueSelector | Top of tab | Absent (single-venue incident) |
| PreDivergenceCard | Below header | Shown only when divergence detected |
| PreLevelTable | Main content | 7-row table, L0–L6 |
| ConfidenceBadge | Below table | Always shown alongside PRE status |
| StaleBadgeOverlay | On each table row | Shown only in degraded/stale mode |
| InvestigateInReplayLink | In divergence card | Navigation to Replay & Forensics |

### Interaction Notes

- [Investigate in Replay Workspace]: navigates to `/replay?incident={id}&divergence=true` — no confirmation required.
- Freshness counter: visual only, no user interaction.
- Table rows: no click action (read-only data display).
- PRE data is polled every 15 seconds — not WebSocket. No user-initiated refresh control (freshness counter makes staleness transparent).

### Disabled-State Behavior

Tab 4 has no write controls for any role. No disabled-state variations. Read-only at all times for all roles.

### Replay-State Behavior

Tab 4 is fully readable in REPLAY mode. No write controls exist here, so IC-03 has no visible effect beyond the REPLAY MODE banner. The divergence card, table, and confidence badge all display historical PRE state at the replay timestamp. Freshness counter is absent in REPLAY mode (data is not live).

### Degraded-State Behavior

**PRE endpoint unreachable:**
```
  ┌───────────────────────────────────────────────────────────────────┐
  │  PRE status temporarily unavailable — last known state shown.    │
  │  Timestamp: 16:46:22 AEST.                                        │
  └───────────────────────────────────────────────────────────────────┘
  + STALE grey badge on each level row
  + Freshness counter in red (60s+ elapsed)
```

**Confidence = NONE:**
- Table rendered normally with NONE badge.
- Additional label below table: "Confidence: NONE — delivery confirmation unavailable. PRE configuration is authoritative but delivery cannot be verified."
- Does not suppress the table — annotates it.

### Incident-State Behavior

- S3 amber styling on Identity Bar and tab indicator.
- Divergence card background `#E65100` at 10% — this is always shown when divergence exists regardless of incident severity.
- Tab 4 is available in all incident states (WATCHING, DECLARED, CONTAINED, RESOLVED).

### Accessibility Notes

- PRE table: `role="table"`, column headers `role="columnheader"`, cells `role="cell"`.
- WINNING row: `aria-label="L5 Structural Fallback — currently winning"`.
- SUPPRESSED rows: `aria-label="L2 Scheduled Campaign — suppressed by L1"`.
- Divergence card: `role="alert"` — announced immediately when it appears.
- Confidence badge: `aria-label="Confidence: LOW — low confidence in delivery confirmation"`.
- Freshness counter: `aria-live="off"` — do not announce every second. Update aria-label at meaningful thresholds (e.g., stale at 30s/60s).
- [Investigate in Replay Workspace]: `role="link"`, opens in same window (no new tab).

---

## WF-IC-08: Incident Command — COMMANDER — DECLARED — Tab 5 (Incident Actions — transition to CONTAINED)

**ID:** WF-IC-08
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** OPERATOR (is commander)
**Commander status:** IS commander
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 5 — Incident Actions
**Purpose:** Show the full Incident Actions tab for a commander at an S3 incident — severity section, containment section with [Mark Incident Contained] inline confirmation expanded, and the WATCHING → DECLARED card (absent since already DECLARED). S1–S2 ADMIN-only notes absent (S3 shown here).

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay]    [Riverside Golf Club — C]               [JE▼]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 03:05:14   Commander: Jordan Ellis (YOU)         │
│                                                                           [Transfer Command]                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)                                                                   │
│                          │ │  Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │▶ Actions   │
│  ◉ Incidents  [●1]       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ─────────────────────   │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  THIS INCIDENT           │ │ TAB 5 — INCIDENT ACTIONS CONTENT (scrollable)                                     │
│    Situation Overview    │ │                                                                                     │
│    Command Log           │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│    Override Mgmt         │ │  SECTION: SEVERITY                                                                 │
│    PRE Status            │ │                                                                                     │
│  ▶ Incident Actions      │ │  Current severity: ◆ S3 MAJOR                                                     │
│                          │ │                                                                                     │
│  ─────────────────────   │ │  [Escalate Severity]                                                               │
│  Riverside Golf Club [C] │ │  (de-escalate section also available for S3 — shown for commander+OPERATOR+)      │
│                          │ │                                                                                     │
│                          │ │  DE-ESCALATE (expanded — S3 can be reduced by OPERATOR+):                         │
│                          │ │  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│                          │ │  │  De-escalate severity to:                                                   │  │
│                          │ │  │    ● S4 — MINOR                                                             │  │
│                          │ │  │    ○ S5 — WATCHING                                                          │  │
│                          │ │  │                                                                             │  │
│                          │ │  │  Reason (required, min 10 chars):                                          │  │
│                          │ │  │  [text field — empty]                                                       │  │
│                          │ │  │                                                                             │  │
│                          │ │  │  [Cancel]      [De-escalate]  ← inactive until reason filled               │  │
│                          │ │  └─────────────────────────────────────────────────────────────────────────────┘  │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION: CONTAINMENT                                                              │
│                          │ │                                                                                     │
│                          │ │  [Mark Incident Contained]  ← commander-only button, S3 = commander can mark     │
│                          │ │                                                                                     │
│                          │ │  CONFIRMATION CARD (expanded after tapping [Mark Incident Contained]):            │
│                          │ │ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │ │  Mark this incident CONTAINED?                                                │ │
│                          │ │ │                                                                               │ │
│                          │ │ │  CONTAINED means: the immediate risk is neutralized.                         │ │
│                          │ │ │  The root cause may not yet be fully resolved.                               │ │
│                          │ │ │                                                                               │ │
│                          │ │ │  You can move to RESOLVED once root cause is documented.                     │ │
│                          │ │ │                                                                               │ │
│                          │ │ │  [Confirm — Mark Contained]                     [Cancel]                     │ │
│                          │ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION: RESOLUTION                                                               │
│                          │ │                                                                                     │
│                          │ │  (ABSENT — Resolution section only visible when current_state = CONTAINED)        │
│                          │ │  This section does not exist in the DOM in DECLARED state.                        │
│                          │ │                                                                                     │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Escalate Severity Section — Detail

When [Escalate Severity] is tapped (inline form expands below the current severity badge):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Escalate severity to:                                                           │
│    ○ S2 — CRITICAL                                                               │
│    ○ S1 — EMERGENCY                                                              │
│    (S4 and S5 not shown — escalation shows only higher severities)               │
│                                                                                  │
│  Reason (required, min 10 characters):                                           │
│  [text field — empty]                                                            │
│                                                                                  │
│  [Cancel]    [Escalate]  ← inactive until severity selected + reason ≥10 chars  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

De-escalate section (for S3 — OPERATOR+ can de-escalate S3–S5 without ADMIN):

```
  De-escalate section shows S4 and S5 options only (lower than current S3).
  Note: For S1–S2 incidents, de-escalate controls are ABSENT for OPERATOR role.
  This is not a disabled state — for S1–S2, the controls are not in the DOM.
  Instead: "De-escalation of S1–S2 severity requires ADMIN role. Contact your administrator."
```

### Containment Confirmation Card — After [Confirm — Mark Contained]

```
On confirm:
  1. Audit event emitted immediately: incident:state:contain_attempted (IC-04)
  2. POST to transition endpoint
  3. UI updates ONLY after server response (IC-01):
     — State pill changes to [CONTAINED]
     — [Mark Incident Contained] button removed
     — Resolution section becomes visible
     — Zone B replacement released (operators can navigate away)
     — System Status Bar incident banner updated
```

### Non-Commander OPERATOR View of Tab 5 (contrast)

```
SEVERITY section: [Escalate Severity] present (OPERATOR+ can escalate)
CONTAINMENT section:
  "S3–S5: the Incident Commander must mark this incident CONTAINED.
   Only Jordan Ellis (current commander) can mark this incident contained."
  [Mark Incident Contained] button: ABSENT (not disabled — absent from DOM)
RESOLUTION section: ABSENT (state is DECLARED)
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| SeveritySection | Top of tab content | Current badge + [Escalate Severity] + de-escalate inline form |
| EscalateForm | Inline below severity section | Only visible when [Escalate Severity] tapped |
| ContainmentSection | Middle of tab | [Mark Incident Contained] button + confirmation card |
| ContainmentConfirmCard | Inline below [Mark Incident Contained] | Expanded state shown here |
| ResolutionSection | Bottom of tab | **Absent** in DECLARED state |

### Interaction Notes

- [Escalate Severity]: expands escalation inline form. Tapping [Cancel] collapses it. Only higher-severity options shown.
- [De-escalate]: (for S3–S5 only) expands de-escalation inline form with lower-severity options.
- [Mark Incident Contained]: expands confirmation card inline. [Confirm — Mark Contained] triggers POST. IC-01 applies.
- [Transfer Command] in Identity Bar: present (commander). Clicking opens transfer panel per Section 7.

### Disabled-State Behavior

- [Escalate] button: inactive until severity option selected + reason ≥10 chars.
- [Mark Incident Contained]: **absent** for non-commanders.
- S1–S2 de-escalation controls: **absent** for OPERATOR role (shown only for ADMIN).
- [Resolve Incident]: **absent** in DECLARED state.
- VIEWER: all controls on Tab 5 **absent**.

### Replay-State Behavior

All write controls on Tab 5 **absent** (IC-03): [Escalate Severity], [De-escalate], [Mark Incident Contained], inline forms all absent. Note card at top: "REPLAY MODE — No incident actions can be taken." Tab content shows current severity badge and state as read-only labels.

### Degraded-State Behavior

- If containment POST fails: inline error below confirmation card buttons: "State transition failed. Error recorded. [Retry]". Confirmation card remains open.
- If severity escalation POST fails: inline error below escalation form: "Severity change failed. Error recorded. [Retry]". Form remains open with input preserved.

### Incident-State Behavior

**COMMANDER_LAPSED on Tab 5:**
- Note card at top of Tab 5: "No commander is assigned. Assume command to access incident actions."
- [Mark Incident Contained]: **absent** (requires commander).
- [Escalate Severity]: **present** (escalation does not require commander status per spec).

**CONTAINED state on Tab 5:**
- Containment section: "Incident is CONTAINED. Move to RESOLVED when root cause is documented." Button absent.
- Resolution section: NOW VISIBLE with resolution form (resolution_reason dropdown + 50-char annotation textarea).

### Accessibility Notes

- Severity section heading: `role="heading"`, `aria-level="2"`.
- Escalation form: `role="group"`, `aria-labelledby="escalate-heading"`.
- Severity radio group: `role="radiogroup"`, each option `role="radio"`.
- Containment confirmation card: `role="dialog"` (inline), `aria-modal="false"`, `aria-labelledby="contain-confirm-heading"`.
- [Confirm — Mark Contained]: `aria-label="Confirm — mark this incident as contained"`. Destructive action class.
- Focus: on [Mark Incident Contained] tap, focus moves to confirmation card heading. On [Cancel], focus returns to [Mark Incident Contained].
- Keyboard: Escape dismisses open inline forms.
- IC-05 interruption: if Level 1 alert fires while containment confirmation is open, card dismissed, toast shown: "Action cancelled — emergency interrupt received."

---

## WF-IC-09: Incident Command — ADMIN — DECLARED — Tab 6 (Evidence Package — ADMIN Only)

**ID:** WF-IC-09
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** ADMIN
**Commander status:** Not commander
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 6 — Evidence Package
**Purpose:** Show the ADMIN-only Tab 6 with counterfactual analysis, evidence export, and correlation assignment. Confirm Tab 6 is absent from DOM for non-ADMIN roles — this wireframe shows the ADMIN view only.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay] [Settings]   [Riverside Golf Club — C]    [SA▼]     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 03:10:00   Commander: Jordan Ellis               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px) — 6 TABS (ADMIN sees Evidence Package)                           │
│                          │ │  Situation Ov. │ Command Log │ Override Mgmt │ PRE Status │ Actions │▶ Evidence   │
│  ◉ Incidents  [●1]       │ │                                                               (6th tab, ADMIN only)│
│  ─────────────────────   │ └───────────────────────────────────────────────────────────────────────────────────┘
│  THIS INCIDENT           │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│    Situation Overview    │ │ TAB 6 — EVIDENCE PACKAGE CONTENT (scrollable)                                     │
│    Command Log           │ │                                                                                     │
│    Override Mgmt         │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│    PRE Status            │ │  SECTION A — COUNTERFACTUAL ANALYSIS                                               │
│    Incident Actions      │ │  "Counterfactual Analysis — ADMIN only"                                            │
│  ▶ Evidence Package      │ │                                                                                     │
│                          │ │  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│  ─────────────────────   │ │  │  Define a counterfactual scenario:                                           │ │
│  Riverside Golf Club [C] │ │  │                                                                               │ │
│                          │ │  │  Factor: [Remove this override from the scenario    ▼]                       │ │
│                          │ │  │  Select override to remove: [Override #4821 — L3 ClubHouse Sponsor  ▼]       │ │
│                          │ │  │                                                                               │ │
│                          │ │  │  [+ Add another factor]                                                       │ │
│                          │ │  │                                                                               │ │
│                          │ │  │  [Run Counterfactual]                                                         │ │
│                          │ │  └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │  COUNTERFACTUAL RESULT (shown after [Run Counterfactual] is tapped):              │
│                          │ │  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │  │  ⚠ Counterfactual result — this is a SIMULATION, not operational state       │ │
│                          │ │  │                                                                               │ │
│                          │ │  │  Scenario: Override #4821 removed                                             │ │
│                          │ │  │                                                                               │ │
│                          │ │  │  Lvl │ Label               │ Result                    │ Status             │ │
│                          │ │  │  L0  │ Emergency           │ Inactive                  │ INACTIVE           │ │
│                          │ │  │  L1  │ Operational         │ Hold Rule A               │ ACTIVE             │ │
│                          │ │  │  L2  │ Scheduled Campaign  │ Weekend Morning Promo     │ ◀ WINNING          │ │
│                          │ │  │  L3  │ Campaign            │ Riverside Welcome Loop v3 │ SUPPRESSED by L2   │ │
│                          │ │  │  L4  │ Sponsorship         │ None                      │ NONE               │ │
│                          │ │  │  L5  │ Structural Fallback │ Default Venue Loop        │ ACTIVE             │ │
│                          │ │  │  L6  │ Device Default      │ Factory Default           │ ACTIVE             │ │
│                          │ │  │                                                                               │ │
│                          │ │  │  This result cannot be applied to production state from this view.           │ │
│                          │ │  └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION B — EVIDENCE EXPORT                                                       │
│                          │ │  "Export Evidence Package"                                                         │
│                          │ │                                                                                     │
│                          │ │  Include:                                                                          │
│                          │ │   ■ Full audit trail (all events for this incident)                               │
│                          │ │   ■ Command log (all OPERATOR_NOTE events)                                        │
│                          │ │   ■ PRE resolution snapshots at key timestamps                                    │
│                          │ │   ■ Override history for incident scope                                           │
│                          │ │   □ Delivery logs for incident scope  ⚠ Large file — may be 50–200MB             │
│                          │ │   □ Counterfactual analysis results (if run)                                      │
│                          │ │                                                                                     │
│                          │ │  Scope: Export for: Riverside Golf Club (current scope)  [read only]              │
│                          │ │  Format: ● JSON   ○ PDF summary                                                   │
│                          │ │                                                                                     │
│                          │ │  [Generate Evidence Package]                                                       │
│                          │ │                                                                                     │
│                          │ │  (After tap — progress state:)                                                     │
│                          │ │  ┌───────────────────────────────────────────────────────────────────────────────┐ │
│                          │ │  │  Generating evidence package...  [████████░░] 80%                            │ │
│                          │ │  │  Estimated: 15 seconds remaining                                              │ │
│                          │ │  └───────────────────────────────────────────────────────────────────────────────┘ │
│                          │ │                                                                                     │
│                          │ │ ══════════════════════════════════════════════════════════════════════════════════ │
│                          │ │  SECTION C — CORRELATION ASSIGNMENT                                                │
│                          │ │  "Incident Correlation — ADMIN only"                                               │
│                          │ │                                                                                     │
│                          │ │  ┌───────────────────────────────────────────────────────┐  [Save]               │
│                          │ │  │ INFRA-2026-042                                        │                        │
│                          │ │  └───────────────────────────────────────────────────────┘                        │
│                          │ │  Correlation groups incidents sharing a root cause.                               │
│                          │ │  This does not merge incidents.                                                    │
│                          │ │                                                                                     │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### Tab Strip for ADMIN (6 tabs)

```
Tab strip renders 6 tabs for ADMIN role:
  1. Situation Overview
  2. Command Log
  3. Override Management
  4. PRE Status
  5. Incident Actions
  6. Evidence Package  ← 6th position, active here

For OPERATOR/VIEWER: Tab strip renders 5 tabs. Tab 6 not present in DOM.
If non-ADMIN navigates to URL fragment #tab6: surface silently defaults to Tab 1.
```

### Zone A (ADMIN-specific additions)

```
THIS INCIDENT block:
  Situation Overview
  Command Log
  Override Management
  PRE Status
  Incident Actions
  Evidence Package  ← present for ADMIN only

Primary nav: includes [Settings] link (ADMIN only)
```

### Counterfactual Factor Selector Options

```
Dropdown options:
  - Remove this override from the scenario
  - Remove this campaign from the scenario
  - Assume venue was HEALTHY at [time]

On selecting "Assume venue was HEALTHY at [time]":
  A time picker appears to the right, pre-filled with declared_at
```

### Evidence Export — Download Ready State

```
After generation completes:
  ┌───────────────────────────────────────────────────────────────────┐
  │  ✓ Evidence package ready                                        │
  │  [Download evidence-inc-riverside-a3f8b2-20260601.json] (2.3MB) │
  │  This export has been logged to the audit trail.                 │
  └───────────────────────────────────────────────────────────────────┘
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| CounterfactualSection | Section A | Factor selector + [Run Counterfactual] + results table |
| CounterfactualResultTable | Section A, below form | Only visible after run. Labeled as simulation. |
| EvidenceExportSection | Section B | Checkboxes + scope + format + generate button |
| ExportProgressIndicator | Section B, after tap | Progress bar + ETA |
| ExportDownloadLink | Section B, after completion | Download link + audit notice |
| CorrelationSection | Section C | Text input + [Save] button |

### Interaction Notes

- [Run Counterfactual]: POST to PRE preview endpoint with modified scenario. Results appear below. Logged to audit trail (incident:forensics:counterfactual_run). No confirmation required.
- [+ Add another factor]: adds a second factor row to the scenario form.
- [Generate Evidence Package]: submits export job. Progress indicator shown. Download link when ready. Logged (incident:forensics:export_requested).
- [Save] (correlation): PUT to `/incidents/{id}/correlation`. Logged (incident:correlation:set_attempted). No confirmation required.
- Counterfactual results: read-only. Label "this is a SIMULATION, not operational state" always visible. Cannot be applied to production.

### Disabled-State Behavior

No disabled-state variations specific to Tab 6. All controls are ADMIN-only and fully available in DECLARED state.

### Replay-State Behavior

In REPLAY mode: Tab 6 is still visible for ADMIN (it is a forensic/read function). [Run Counterfactual] is **absent** (it would write audit events — IC-03). [Generate Evidence Package] remains **present** — export is an analytical function on historical data, not a write to production state. [Save] (correlation) is **absent** in REPLAY mode (IC-03). REPLAY MODE banner below Identity Bar.

**Rationale for [Generate Evidence Package] in REPLAY mode:** Export is a data retrieval operation on the existing audit trail, not a production state change. It is consistent with IC-03 intent.

### Degraded-State Behavior

- If counterfactual POST fails: error inline below [Run Counterfactual]: "Counterfactual analysis failed. Error recorded. [Retry]".
- If export job fails: "Package generation failed. [Retry]. Error recorded in audit trail."
- If correlation [Save] fails: inline error: "Correlation ID could not be saved. [Retry]."

### Incident-State Behavior

Tab 6 is always ADMIN-only regardless of incident state. Available in WATCHING, DECLARED, CONTAINED, RESOLVED. In RESOLVED state: all sections remain functional (export of resolved incident evidence is a primary use case).

### Accessibility Notes

- Tab 6 label: `aria-label="Evidence Package — ADMIN only"`. Not present in DOM for non-ADMIN.
- Counterfactual section: `role="region"`, `aria-labelledby="counterfactual-heading"`.
- Results table: same `role="table"` structure as PRE table. Additional `aria-label="Counterfactual result — simulation only"`.
- Export checkboxes: standard `<input type="checkbox">` with `<label>`.
- [Generate Evidence Package]: `aria-label="Generate and download evidence package"`.
- Progress indicator: `role="progressbar"`, `aria-valuenow`, `aria-valuemax="100"`.
- Download link: `aria-label="Download evidence package JSON file, 2.3 megabytes"`.
- Correlation input: `aria-label="Assign correlation ID — groups incidents sharing a root cause"`.

---

## WF-IC-10: Incident Command — OPERATOR — S1 EMERGENCY_FREEZE — DECLARED — Zone B replacement + browser Back suppressed

**ID:** WF-IC-10
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-s1a9b8`
**Role:** OPERATOR (is commander)
**Commander status:** IS commander
**Incident state:** DECLARED
**Severity:** S1 — EMERGENCY_FREEZE
**Active tab:** Tab 1 — Situation Overview (auto-opened)
**Purpose:** Show the full S1 EMERGENCY_FREEZE treatment: deep-red tint on Identity Bar, EMERGENCY_FREEZE overlay banner at top of Zone B, Zone A nav suppression of non-critical items, browser Back intercepted, and the warning shown when commander attempts to navigate away.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)  // bg: #1A1A1A                                                                       │
│  ClubHub TV   [Live Ops] [Venues] [Incidents ●1] [Replay]    [Riverside Golf Club — C]               [JE▼]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // bg: #C62828 at 15% on #1A1A1A  (S1 deep red tint)                            │
│                                                                                                                  │
│  LEFT GROUP                          CENTER GROUP              RIGHT GROUP                                       │
│  [INC-riverside-s1a9b8]              Duration                  Commander                                        │
│  ⬤ S1 EMERGENCY  [DECLARED]         00:22:14                  Jordan Ellis (YOU)                               │
│  Declared  01 Jun 2026 17:24 AEST                             [Transfer Command]                                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ EMERGENCY_FREEZE OVERLAY BANNER (fixed, 48px)  // bg: #C62828, text white 14px bold                            │
│  🔴 EMERGENCY_FREEZE ACTIVE — All non-emergency content suppressed across Riverside Golf Club.                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px)  // bg: #1E1E1E                                                   │
│ // bg: #121212           │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Home / Live Ops       │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Venues                │ │ ZONE B — TAB 1 CONTENT (scrollable)                                               │
│  ◉ Incidents  [●1]       │ │                                                                                     │
│  ◉ Replay & Forensics    │ │  [Tab 1 sections A–E rendered identically to WF-IC-01 with S1 styling]            │
│                          │ │  [Section A shows S1 EMERGENCY badge, deep red tint on affected values]           │
│  ── SUPPRESSED ──────    │ │                                                                                     │
│  ░ Future Simulation     │ │  SECTION A:                                                                        │
│    (opacity 0.35,        │ │  Severity: ⬤ S1 EMERGENCY  State: [DECLARED]                                     │
│     pointer-events none) │ │  Constitutional state: EMERGENCY_FREEZE (deep red bold)                           │
│  ░ Sponsorship Ops       │ │  Description: All screens non-responsive. Network partition suspected.            │
│    (tooltip: "Unavail.   │ │  ...                                                                               │
│     during FREEZE")      │ │                                                                                     │
│  ░ Campaign Mgmt         │ │  [All sections B–E as per Tab 1 spec — no modifications to Tab 1 content]         │
│  ░ Media Library         │ │                                                                                     │
│                          │ │  [Open in Replay Workspace] button present at Section E                           │
│  ─────────────────────   │ │                                                                                     │
│  THIS INCIDENT           │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ▶ Situation Overview    │
│    Command Log           │
│    Override Mgmt         │
│    PRE Status            │
│    Incident Actions      │
│                          │
│  ─────────────────────   │
│  Riverside Golf Club [C] │
└──────────────────────────┘
```

### S1 Zone A Navigation Suppression Detail

```
SUPPRESSED items (pointer-events: none, opacity: 0.35, cursor: not-allowed):
  - Future Simulation Workspace
  - Sponsorship Operations
  - Campaign Management
  - Media Library

These items REMAIN IN THE DOM — they are visible but non-interactive.
On hover: tooltip "Unavailable during EMERGENCY_FREEZE."
Suppression lifts automatically when incident transitions to CONTAINED.

NOT suppressed (fully interactive):
  - Home / Live Ops
  - Venues
  - Incidents
  - Replay & Forensics
  - Settings (ADMIN only)
  - THIS INCIDENT tab mirrors
```

### Browser Back Suppression and Navigation Warning

```
COMMANDER attempting to navigate away (via browser Back, Zone A link, or address bar):

A browser-level beforeunload / history intercept fires. In-page confirmation overlay:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠ You are the Incident Commander during an EMERGENCY_FREEZE                    │
│                                                                                  │
│  Leaving this surface does not transfer command.                                │
│                                                                                  │
│  Confirm you intend to navigate away.                                           │
│                                                                                  │
│  [Stay on Incident]                            [Leave Surface]                  │
└─────────────────────────────────────────────────────────────────────────────────┘

[Stay on Incident]: dismisses overlay. User remains on IC surface.
[Leave Surface]: navigation proceeds. Command is NOT transferred.
  — An INCIDENT_STATE_CHANGED-style event logs commander departure.
  — Incident enters COMMANDER_LAPSED state if commander closes browser/navigates away.
```

**Non-commander OPERATOR navigation warning (softer):**
```
"You are leaving an active EMERGENCY_FREEZE incident. Are you sure?"
[Cancel]   [Leave]
```

**VIEWER role:** No navigation suppression. Can navigate freely.

### EMERGENCY_FREEZE Overlay Banner

```
Position: fixed, full-width of Zone B, between Incident Identity Bar and Tab Strip
Height: 48px
Background: #C62828 solid
Text: white, 14px bold, centered
Content: "🔴 EMERGENCY_FREEZE ACTIVE — All non-emergency content suppressed across {scope}."
Z-index: above tab content, below Identity Bar
```

### S1 Identity Bar — Severity Badge

```
S1 badge: ⬤ (solid circle icon) + "S1 EMERGENCY" text
Badge background: #C62828
Identity Bar background tint: #C62828 at 15% on #1A1A1A
Incidents badge in Zone A: #C62828
Active tab bottom border: #C62828
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| EmergencyFreezeBanner | Fixed, below Identity Bar, above Tab Strip | #C62828, full Zone B width |
| S1IdentityBar | Identity Bar | Deep red tint, solid-circle badge |
| SuppressedNavItems | Zone A | 4 items: opacity 0.35, pointer-events none |
| NavigationDepartureWarning | In-page overlay (not browser native) | Commander only — triggered by nav attempt |
| ZoneAReplacement | Zone B content | Automatic replacement for all OPERATOR+ at S1 |

### Interaction Notes

- Zone B replacement (S1): all OPERATOR+ users viewing the affected venue are redirected here automatically. This is a push replacement via WebSocket event.
- Browser Back: intercepted. Commander sees departure confirmation. Non-commander OPERATOR sees softer confirmation. VIEWER: no interception.
- Suppressed nav items: tooltip "Unavailable during EMERGENCY_FREEZE." on hover. Non-interactive.
- [Transfer Command]: present and functional. Commander can transfer command even during S1.

### Disabled-State Behavior

- Suppressed Zone A nav items: not disabled in the interactive sense — removed from tab order, `pointer-events: none`, `aria-disabled="true"`, visible at 35% opacity.
- [Assume Command]: **absent** — incident state is DECLARED with active commander.

### Replay-State Behavior

In REPLAY mode at an S1 historical incident:
- EMERGENCY_FREEZE overlay banner is shown (historical state indicator, not a write control).
- Zone A suppression is shown (historical state).
- All write controls absent (IC-03).
- Navigation departure warning: **absent** (REPLAY mode — no live incident state to protect).
- REPLAY MODE banner below EMERGENCY_FREEZE banner.

### Degraded-State Behavior

Same as WF-IC-01 degraded behaviors. S1 adds: if WebSocket push for Zone B replacement fails (network issue), OPERATOR+ users who are not on the IC surface see a persistent System Status Bar banner: "EMERGENCY_FREEZE active — [Open Incident]" and must navigate manually.

### Incident-State Behavior

S1 activates all three layers simultaneously:
1. Deep red Identity Bar tint (`#C62828` at 15%).
2. EMERGENCY_FREEZE fixed overlay banner (solid `#C62828`).
3. Zone A suppression of 4 non-critical nav items.
4. Zone B auto-replacement for all OPERATOR+.
5. Browser Back intercepted for commander.

Suppression lifts (all three layers) simultaneously when incident transitions to CONTAINED.

### Accessibility Notes

- EMERGENCY_FREEZE banner: `role="alert"`, `aria-live="assertive"` — announced immediately on S1 declaration.
- Suppressed nav items: `aria-disabled="true"`, `tabindex="-1"` (removed from tab order). Tooltip accessible via `aria-describedby`.
- Navigation departure confirmation: `role="alertdialog"`, `aria-modal="true"`, focus trapped until user chooses.
- [Stay on Incident]: receives focus automatically when overlay opens.
- S1 badge: `aria-label="Severity S1 EMERGENCY_FREEZE"`.
- High-contrast requirement: S1 deep red must meet 4.5:1 contrast against white text in the overlay banner.

---

## WF-IC-11: Incident Command — VIEWER — DECLARED — Read-Only (no write controls anywhere)

**ID:** WF-IC-11
**Surface:** Incident Command Surface
**Route:** `/incidents/inc-riverside-a3f8b2`
**Role:** VIEWER
**Commander status:** Not applicable (no write authority)
**Incident state:** DECLARED
**Severity:** S3 — MAJOR
**Active tab:** Tab 1 — Situation Overview (default on load)
**Purpose:** Show the complete read-only VIEWER experience — all tabs visible (except Tab 6 which is absent from DOM), no write controls anywhere, no Zone B auto-replacement (VIEWER navigates manually), no Assume Command button.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents] [Replay]          [Riverside Golf Club — C]           [VW▼]     │
│              ↑ No "●1" badge — VIEWER does not receive same alert treatment for Zone B replacement             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint                                                                 │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:14:38   Commander: Jordan Ellis               │
│  (no [Transfer Command] button — VIEWER role)                                                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px) — 5 TABS (VIEWER — Tab 6 absent)                                 │
│                          │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│  ◉ Home / Live Ops       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Venues                │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Incidents             │ │ ZONE B — TAB 1 CONTENT (read-only, scrollable)                                    │
│  ◉ Replay & Forensics    │ │                                                                                     │
│  (no Settings link)      │ │  All 5 sections A–E displayed identically to WF-IC-01 (non-commander OPERATOR)    │
│                          │ │  EXCEPT: Section C override rows show no [View Details] or [Remove Override]      │
│  ─────────────────────   │ │  buttons — these are absent for VIEWER.                                           │
│  THIS INCIDENT           │ │                                                                                     │
│  ▶ Situation Overview    │ │  "Viewing as VIEWER — read-only access"  ← subtle label below section heading     │
│    Command Log           │ │  (informational, 11px muted, not obtrusive)                                       │
│    Override Mgmt         │ │                                                                                     │
│    PRE Status            │ │  SECTION A: (identical to WF-IC-01, no action buttons)                            │
│    Incident Actions      │ │  SECTION B: (identical)                                                            │
│  (no Evidence Package)   │ │  SECTION C: Override rows shown but [Remove Override ▾] buttons ABSENT            │
│                          │ │  SECTION D: (identical)                                                            │
│  ─────────────────────   │ │  SECTION E: [Open in Replay Workspace] present (navigation, not write)            │
│  Riverside Golf Club [C] │ │                                                                                     │
│                          │ └───────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────┘
```

### VIEWER — Complete Controls Inventory (all absent)

The following controls are **absent from the DOM** for VIEWER role. Not disabled, not greyed — not present:

```
Identity Bar:
  [Transfer Command] — absent
  [Assume Command] — absent (also in COMMANDER_LAPSED indicator / banner)

Tab 2 (Command Log):
  [Add Annotation] textarea and button — absent
  Auto-scroll toggle — present (it is a display preference, not a write control)

Tab 3 (Override Management):
  [Place Override] button — absent
  [Remove Override ▾] on each override card — absent
  [View Details] on each override card — absent (per spec: Tab 3 write controls absent)
  The override list itself: visible and readable

Tab 5 (Incident Actions):
  [Escalate Severity] — absent
  [De-escalate Severity] form — absent
  [Mark Incident Contained] — absent
  [Resolve Incident] — absent
  [Declare Incident and Assume Command] — absent
  Severity badge: present (read-only display)
  State label: present (read-only display)

Tab 6 (Evidence Package):
  ENTIRELY ABSENT from DOM — not in tab strip, not accessible via keyboard or URL fragment
```

### VIEWER — Tab 5 Appearance

```
TAB 5 — INCIDENT ACTIONS  (VIEWER view)

  SECTION: SEVERITY
  Current severity: ◆ S3 MAJOR  [read only — no Escalate/De-escalate controls]

  SECTION: CONTAINMENT
  [read only — "S3 MAJOR — DECLARED. The incident commander will manage containment."
   No [Mark Incident Contained] button.]

  SECTION: RESOLUTION
  [Absent — state is DECLARED]
```

### VIEWER — Zone B Replacement Behavior

```
VIEWER role: Zone B is NOT automatically replaced for S1 or S2 incidents.
VIEWER must navigate manually to /incidents/:id.
Once on the surface: VIEWER sees the full read-only view.
Zone A suppression (S1 EMERGENCY_FREEZE): NOT applied to VIEWER.
Navigation departure warning: NOT applied to VIEWER.
Browser Back: NOT suppressed for VIEWER.
```

### Component Placement

All components same as WF-IC-01 with write controls removed:

| Absent Component | Tab | Reason |
|-----------------|-----|--------|
| [Transfer Command] | Identity Bar | VIEWER — no authority |
| [Assume Command] | Identity Bar (COMMANDER_LAPSED) | VIEWER — no authority |
| [Add Annotation] | Tab 2 | VIEWER — no write authority |
| [Place Override] | Tab 3 | VIEWER — no write authority |
| [Remove Override ▾] | Tab 3 | VIEWER — no write authority |
| [Escalate Severity] | Tab 5 | VIEWER — no write authority |
| [Mark Incident Contained] | Tab 5 | VIEWER — no write authority |
| Tab 6 (entire) | Tab strip | VIEWER — Tab 6 absent |

### Interaction Notes

- All remaining interactions are navigational (no writes): tab switching, [Open in Replay Workspace], tapping override count to jump to Tab 3, copying incident ID.
- VIEWER can view all tabs 1–5 freely.
- VIEWER can read the full command log (Tab 2) without auto-scroll control (or: auto-scroll is present since it is a display preference — not a write control).

### Disabled-State Behavior

No disabled states apply. VIEWER has no controls that could become disabled. All write controls are simply absent.

### Replay-State Behavior

VIEWER in REPLAY mode: identical to VIEWER in live mode. No additional controls to suppress. REPLAY MODE banner shown below Identity Bar. Write controls were already absent.

### Degraded-State Behavior

Same as WF-IC-01 degraded behaviors (stale PRE data, low confidence indicators). VIEWER has no ability to take remediation actions regardless of degradation level.

### Incident-State Behavior

**COMMANDER_LAPSED state:**
- COMMANDER_LAPSED indicator shown in Identity Bar right group.
- Amber warning banner shown between Identity Bar and tab strip.
- [Assume Command] buttons in indicator and banner: **absent** (VIEWER cannot assume command).
- Red System Status Bar: shown (all users see this, not just OPERATOR+).
- Zone A pulsing dot: shown (all users see this).

**S1 EMERGENCY_FREEZE:**
- EMERGENCY_FREEZE overlay banner shown.
- Zone A suppression: NOT applied to VIEWER.
- Browser Back: NOT suppressed for VIEWER.
- Zone B auto-replacement: NOT triggered for VIEWER.

### Accessibility Notes

- Surface still has full read accessibility: all ARIA roles, labels, and live regions present.
- Where write controls would have been: no placeholder, no "disabled" button, no empty space. Layout flows naturally without the absent elements.
- Keyboard navigation: tab through surface reaches all readable content. No traps from absent controls.
- Screen reader: announces incident state, severity, duration, commander name — all the situational awareness content.

---

## WF-IC-12: Incident Command — Any Role — REPLAY Mode

**ID:** WF-IC-12
**Surface:** Incident Command Surface (historical view)
**Route:** `/incidents/inc-riverside-a3f8b2` (accessed via Replay & Forensics with `_replay: true` session)
**Role:** OPERATOR (or any role — REPLAY mode applies universally)
**Commander status:** Historical (Jordan Ellis was commander at time of replay)
**Incident state:** DECLARED (at time of replay — the historical state, not current)
**Severity:** S3 — MAJOR
**Active tab:** Tab 1 — Situation Overview
**Purpose:** Show the complete REPLAY mode treatment — zero write controls anywhere (IC-03), persistent REPLAY MODE banner below Identity Bar, all tabs readable, no [Assume Command], no annotation input, no override placement, no incident actions. The distinction between REPLAY mode and RESOLVED terminal state.

---

### Desktop Layout (1440px viewport)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR (48px)                                                                                        │
│  ClubHub TV   [Live Ops] [Venues] [Incidents] [Replay ◀active] [Settings·ADMIN]  [Riverside — C]   [JD▼]     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INCIDENT IDENTITY BAR (72px)  // S3 amber tint — historical severity still shown                               │
│  [INC-riverside-a3f8b2]   ◆ S3 MAJOR  [DECLARED]   Duration: 02:14:38   Commander: Jordan Ellis               │
│  (All Identity Bar fields are historical values — not live)                                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REPLAY MODE BANNER (fixed, 40px)  // bg: #1565C0 at 20%, border-bottom: 2px solid #1565C0                      │
│  REPLAY MODE — This is a historical view. No actions can be taken.                                              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────┐ ┌───────────────────────────────────────────────────────────────────────────────────┐
│ ZONE A (280px)           │ │ TAB STRIP (48px) — 5 tabs (OPERATOR) or 6 tabs (ADMIN) — all readable             │
│                          │ │  ▶ Situation Overview  │  Command Log  │  Override Mgmt  │  PRE Status  │  Actions │
│  ◉ Home / Live Ops       │ └───────────────────────────────────────────────────────────────────────────────────┘
│  ◉ Venues                │ ┌───────────────────────────────────────────────────────────────────────────────────┐
│  ◉ Incidents             │ │ ZONE B — TAB 1 CONTENT (read-only historical, scrollable)                         │
│  ◉ Replay & Forensics    │ │                                                                                     │
│  ◉ Settings (if ADMIN)   │ │  "Viewing historical incident state at: 01 Jun 2026 16:46:38 AEST"               │
│                          │ │  (timestamp label below section heading — shows replay point-in-time)             │
│  ─────────────────────   │ │                                                                                     │
│  THIS INCIDENT           │ │  SECTION A–E: All content rendered identically to live view                       │
│  ▶ Situation Overview    │ │  [Open in Replay Workspace] button present (navigation — not a write)             │
│    Command Log           │ │                                                                                     │
│    Override Mgmt         │ │                                                                                     │
│    PRE Status            │ └───────────────────────────────────────────────────────────────────────────────────┘
│    Incident Actions      │
│  (Evidence Pkg if ADMIN) │
│                          │
│  ─────────────────────   │
│  Riverside Golf Club [C] │
└──────────────────────────┘
```

### REPLAY MODE Banner Specification

```
Position: fixed, full-width Zone B, immediately below Incident Identity Bar
Height: 40px
Background: #1565C0 at 20% opacity
Border-bottom: 2px solid #1565C0
Text: "REPLAY MODE — This is a historical view. No actions can be taken."
Text style: 13px medium, #FFFFFF
Alignment: left-padded 16px

This banner persists across ALL tab switches while in REPLAY mode.
It is never dismissable by the operator.
```

### REPLAY Mode — Complete Write Controls Inventory (all absent)

IC-03 enforcement: **zero write controls rendered anywhere on this surface.**

```
Identity Bar:
  [Transfer Command] — absent (IC-03)
  [Assume Command] — absent (IC-03)

Tab 2 (Command Log):
  [Add Annotation] textarea — absent (IC-03)
  [Add Annotation] button — absent (IC-03)
  Auto-scroll toggle — present (display preference, not a write)

Tab 3 (Override Management):
  [Place Override] button — absent (IC-03)
  [Remove Override ▾] on each card — absent (IC-03)
  Override list: fully readable

Tab 5 (Incident Actions):
  [Escalate Severity] — absent (IC-03)
  [De-escalate Severity] — absent (IC-03)
  [Mark Incident Contained] — absent (IC-03)
  [Resolve Incident] — absent (IC-03)
  [Declare Incident] — absent (IC-03)
  Severity badge and state label: present (read-only display)

Tab 6 (ADMIN — Evidence Package):
  [Run Counterfactual] — absent (IC-03) — would write audit event
  [Generate Evidence Package] — PRESENT (retrieval, not production write)
  [Save] (correlation) — absent (IC-03)
```

### REPLAY vs RESOLVED — Distinguishing Characteristics

```
REPLAY mode:
  - Triggered by: Replay & Forensics workspace session with _replay: true
  - Applies to: any incident state (DECLARED, CONTAINED, RESOLVED, etc.)
  - REPLAY MODE banner: blue (#1565C0) — "This is a historical view."
  - Duration clock in Identity Bar: shows historical value at replay timestamp (frozen)
  - Tab 2 log: shows entries up to replay timestamp only
  - Timestamp header in tab content: "Viewing historical state at: [TIMESTAMP]"
  - OPERATOR can exit REPLAY mode via navigating back to Replay & Forensics workspace

RESOLVED state (terminal — NOT replay):
  - Triggered by: incident reaching RESOLVED state in production
  - Applies to: production view of a resolved incident
  - No special banner — state pill shows "RESOLVED" in grey
  - Duration clock: stopped, shows final duration "Duration: [H]h [M]m — RESOLVED"
  - All write controls absent (not IC-03 — this is the natural terminal state)
  - Cannot be exited — this is the permanent historical record
```

### Tab 2 (Command Log) in REPLAY Mode

```
Log entries shown up to the replay timestamp.
Entries after the replay timestamp: not shown (historical point-in-time view).

If replay timestamp is mid-incident:
  Entries after the timestamp are absent.
  A label at the bottom of the log: "Viewing log up to 01 Jun 2026 16:46:38 AEST.
  [N] more entries exist after this timestamp — navigate replay forward to view."

[Add Annotation] input: ABSENT (IC-03).
Auto-scroll toggle: present.
```

### Tab 3 (Override Management) in REPLAY Mode

```
Override list shows overrides active at replay timestamp.
Overrides placed/removed after the timestamp: not shown.
[Place Override] button: ABSENT.
[Remove Override ▾]: ABSENT.
Override cards: read-only display with all metadata fields.
```

### Tab 5 (Incident Actions) in REPLAY Mode

```
Severity section: current badge shown (historical severity at replay timestamp).
All action forms: ABSENT.

A note card at the top of Tab 5:
  ┌────────────────────────────────────────────────────────────┐
  │  REPLAY MODE — No incident actions can be taken.          │
  │  This is a historical view at 01 Jun 2026 16:46 AEST.    │
  └────────────────────────────────────────────────────────────┘
```

### Duration Clock in REPLAY Mode

```
Identity Bar Duration: shows value frozen at replay timestamp.
Example: "Duration: 02:14:38 (at replay time)"
Does NOT continue counting — clock is stopped.
Label: "Duration at" or styled with a clock icon to indicate frozen state.
```

### Component Placement

| Component | Location | Notes |
|-----------|----------|-------|
| ReplayModeBanner | Fixed below Identity Bar | Blue, persistent, never dismissable |
| FrozenDurationClock | Identity Bar center group | Static value, not live |
| ReplayTimestampLabel | Below section headings in tab content | "Viewing historical state at: [TIMESTAMP]" |
| ReplayLogTruncationNotice | Bottom of Tab 2 log | If entries exist after replay timestamp |
| ReplayActionsNoteCard | Top of Tab 5 | Explains no actions available |

### Interaction Notes

- No write interactions possible anywhere.
- [Open in Replay Workspace] (Tab 1 Section E): navigates back to Replay & Forensics with this incident loaded. Allowed in REPLAY mode (navigation, not write).
- Tab switching: fully functional.
- Zone A tab mirrors: fully functional (navigation only).
- Incident ID copy: present (IC-03 allows read operations).

### Disabled-State Behavior

No disabled states. All write controls absent. No enabled-but-inactive buttons. No forms waiting for input.

### Replay-State Behavior

This wireframe IS the REPLAY state. See all sections above.

**REPLAY mode does not affect:**
- All readable content (Tab 1–6 content visible)
- Tab navigation
- Zone A navigation
- Incident ID copy
- [Open in Replay Workspace] link
- Freshness counter on Tab 4 (absent — PRE data is historical, not polled)
- Auto-scroll toggle on Tab 2

### Degraded-State Behavior

In REPLAY mode, degraded-state warnings from live polling are absent (PRE is not polled, WebSocket not subscribed). Data shown is from replay corpus. If replay data is incomplete: a banner "Some data unavailable at this replay point — corpus may be incomplete. Verify in audit trail." No degraded-state confidence colors apply (those are live-system indicators).

### Incident-State Behavior

REPLAY mode shows the historical incident state at the replay timestamp. Any incident state can be viewed in REPLAY mode:
- COMMANDER_LAPSED (historical): indicator shown, amber banner shown, pulsing dot shown — **but [Assume Command] absent** (IC-03).
- EMERGENCY_FREEZE (historical): overlay banner shown, Zone A suppression shown — **but no navigation blocking** (IC-03: no active production constraint applies).
- All visual state indicators are present as historical records. Only write controls are suppressed.

### Accessibility Notes

- REPLAY MODE banner: `role="status"`, `aria-live="polite"` — announced once on mode entry.
- Frozen duration: `aria-label="Duration at replay time: 2 hours 14 minutes 38 seconds"`.
- Replay timestamp labels: `aria-label="Viewing historical incident state at {datetime}"`.
- With write controls absent: keyboard navigation flows naturally through readable content. No orphaned tab stops, no inactive form fields.
- Screen reader announcement on REPLAY mode entry: "Replay mode active. This is a historical view. No incident actions can be taken."
- Escape key in REPLAY mode: does not dismiss REPLAY mode (it is a session-level mode, not a panel state). Any Escape handler should close any open read-only panels (e.g., counterfactual results in Tab 6).

---

## Cross-Wireframe Reference Summary

### Role Matrix — Control Visibility by Wireframe

| Control | WF-01 OPER (non-cmd) | WF-02 OPER (cmd) | WF-03 LAPSED | WF-11 VIEWER | WF-12 REPLAY |
|---------|---------------------|-----------------|--------------|-------------|-------------|
| [Transfer Command] | Absent | Present | Absent | Absent | Absent |
| [Assume Command] | Absent | Absent | Present | Absent | Absent |
| [Add Annotation] (T2) | Present | Present | Present | Absent | Absent |
| [Place Override] (T3) | Present | Present | Present | Absent | Absent |
| [Remove Override] (T3) | Present | Present | Present | Absent | Absent |
| [Escalate Severity] (T5) | Present | Present | Present | Absent | Absent |
| [Mark Contained] (T5) | Absent | Present | Absent | Absent | Absent |
| Tab 6 (Evidence Pkg) | Absent | Absent | Absent | Absent | ADMIN only |

### Identity Bar States Summary

| Wireframe | Severity | Tint Color | Right Group Content |
|-----------|----------|-----------|---------------------|
| WF-IC-01 | S3 | #F57C00 at 15% | Commander name (not YOU) |
| WF-IC-02 | S2 | #E64A19 at 15% | Commander name (YOU) + [Transfer Command] |
| WF-IC-03 | S3 | #F57C00 at 15% | COMMANDER_LAPSED indicator (red box) |
| WF-IC-04–09 | S3 | #F57C00 at 15% | Commander name + [Transfer Command] (WF-04/08) |
| WF-IC-10 | S1 | #C62828 at 15% | Commander (YOU) + [Transfer Command] |
| WF-IC-11 | S3 | #F57C00 at 15% | Commander name (not YOU, no button) |
| WF-IC-12 | S3 | #F57C00 at 15% | Historical commander name (no buttons) |

### Zone B Banner Stack Order (top to bottom, when multiple banners co-present)

```
1. System Status Bar (48px) — always topmost
2. Incident Identity Bar (72px) — always below System Status Bar
3. COMMANDER_LAPSED amber warning banner (40px) — when COMMANDER_LAPSED
   OR
   EMERGENCY_FREEZE red overlay banner (48px) — when S1 DECLARED
   OR
   REPLAY MODE blue banner (40px) — when in REPLAY mode
4. Tab Strip (48px)
5. Tab content (scrollable)
```

If both COMMANDER_LAPSED and REPLAY mode banners would appear: REPLAY mode takes precedence (a replay of a COMMANDER_LAPSED incident shows REPLAY banner only). COMMANDER_LAPSED visual state is still shown in the Identity Bar right group (historical indicator), but the amber banner is suppressed by the REPLAY banner. Rationale: only one banner can occupy the slot between Identity Bar and tab strip without compressing tab content unacceptably.

---

*End of INCIDENT-COMMAND-WIREFRAMES-v1.md*
*Document authority: Derived from CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md*
*Source specification: /docs/shared/CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md*
*Component taxonomy: /docs/shared/FRONTEND-COMPONENT-TAXONOMY-v1.md*
