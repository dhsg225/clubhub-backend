# REPLAY-INVESTIGATION-WIREFRAMES-v1

**Document type:** Implementation-grade wireframe specification
**Surface:** Replay Investigation Surface
**Authority:** Agent 3 (UX/Design)
**Depends on:** CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md, INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1.md
**Version:** 1.0
**Status:** CANONICAL — implement directly from this document

---

## Layout Conventions

All wireframes use a 1440px desktop viewport.

**Vertical stack (top to bottom):**
```
┌─ System Status Bar ──────────────────────────────────────────────── 48px ─┐
├─ Session Header ─────────────────────────────────────────────────── 72px ─┤
├─ REPLAY Banner (amber) ──────────────────────────────────────────── 28px ─┤
├─ Tab Strip ──────────────────────────────────────────────────────── 48px ─┤
├─ Zone A (280px) │ Zone B (fluid) │ Zone C (280px, collapsible) ─── flex ──┤
└──────────────────────────────────────────────────────────────────────────┘
```

**Zone B vertical split (inside Zone B below tab strip):**
```
┌─ RP-TIMELINE (upper ~25%, min 100px, drag-resizable) ───────────────────┐
├─ RP-MAIN (lower ~75%, min 200px) ───────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

**ASCII symbols:**
- `▶` Play  `⏸` Pause  `◁◁` Jump to start  `▶▶` Jump to end  `◁` Step back  `▶` Step forward
- `───` Timeline bar  `▼` Playhead marker  `★` Active selection
- `[0.25x]` `[0.5x]` `[1x★]` `[2x]` `[4x]` Speed selector (★ marks active)
- `░` Divergence / gap zone  `◆` Red diamond (PRE divergence)  `▲` Override created  `▽` Override removed
- `●` Blue tick (PRE resolution)  `■` Purple square (device event)  `★` Red star (emergency)
- `🔖` Annotation marker  `🚩` Finding marker  `!` Contradiction badge

---

## WF-RP-01: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 1 (Timeline) — PAUSED at incident peak

**ID:** WF-RP-01
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 1 — Timeline
**Purpose:** OPERATOR pauses replay at the incident peak timestamp to examine the override stack and annotate the divergence event on the timeline.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline★] [Event Stream] [Annotations] [Findings] [Corpus Diff]                                                                       │ 48px tab strip
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE ─────────────────────────────────────────────────────────────────── │  Linked incident          │
│ The Parklands Golf Club ▾ │                                                                                   │  INC-2026-0528-001        │
│                           │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │                                                                                   │  Sponsor SOV shortfall    │
│ Investigations            │  14:00     15:00      16:00   16:23↓  17:00      18:00      19:00    19:45       │  [View incident →]        │
│ ▶ INV-2026-0601-abc1      │  PRE  ●────────────────────────────●──┊──────────────────────────────────────   │                           │
│   POST_INCIDENT  ACTIVE   │  OVRD ────────────────▲────────────────┊──────────────────────────────────────   │  ─────────────────────    │
│                           │  DEVH ─────────────────────────────────┊────■────────────────────────────────   │  Evidence collected       │
│ ─────────────────────     │  EMRG ──────────────────────────────────────────────────────────────────────   │  Annotations:  7 (2 SUP)  │
│ Incidents (read-only)     │  PLYR ──────────────────────────────────────────────────────────────────────   │  Findings:     2          │
│  INC-2026-0528-001        │  ANNO ──────────────────────────────────────────────────────────────────────   │  Contradictions: 2 ⚠      │
│  CLASS_3 · CONTAINED      │  FIND ──────────────────────────────────────────────────────────────────────   │  Corpus events: 5         │
│  [→ View on IC surface]   │                                                                                   │                           │
│                           │       ↑ Playhead: 2026-05-28 16:23:41 AEST                                       │  ─────────────────────    │
│ ─────────────────────     │       (red dashed vertical line spanning all swim lane rows)                      │  Unresolved ⚠             │
│ Notification Tray         │                                                                                   │  2 contradictions block   │
│  [🔔 3 notifications]     │  Range: [══════════════════════════════════════════════════] [Clear range]        │  incident closure.        │
│                           │                                                                                   │  ANN-0025 vs ANN-0027     │
│ ─────────────────────     │  RP-MAIN ──────────────────────────────────────────────────────────────────────  │  → event e_0928a1         │
│ Operator Tools            │                                                                                   │  [Resolve now →]          │
│  [Browse investigations]  │  Event selected: PRE resolution e_0928a1                                         │                           │
│  [New investigation]      │                                                                                   │  ANN-0031 vs ANN-0033     │
│                           │  ┌───────────────────────────────────────────────────────────────────────────┐  │  → 16:30–16:45 range      │
│  (No override controls    │  │ Event ID:    e_0928a1                                                      │  │  [Resolve now →]          │
│   in Zone A during        │  │ Type:        PRE_RESOLVE                                                   │  │                           │
│   replay — absent)        │  │ Timestamp:   2026-05-28 16:23:41 AEST                                      │  │  ─────────────────────    │
│                           │  │ Source:      pre-engine-01                                                 │  │  Session collaborators    │
│                           │  │ Trust state (at event time): RECOVERED_BUT_UNTRUSTED (historical)          │  │  J. Rangi (you — owner)   │
│                           │  │                              [as of 2026-05-28 16:23 AEST]                  │  │  Active now               │
│                           │  │                                                                            │  │  M. Chen                  │
│                           │  │ Payload (collapsed) ▶                                                     │  │  Active now               │
│                           │  │   Winning level: L1 Override                                              │  │                           │
│                           │  │   Winning content: OVR-0442 — Club_Sponsor_B                              │  │                           │
│                           │  │   Override stack depth: 3                                                  │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │ Annotations on this event:                                                 │  │                           │
│                           │  │   🔖 ANN-0029 · J. Rangi · CONFIRMED                                      │  │                           │
│                           │  │   "The L1 override OVR-0442 was winning..."  [view]                       │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │  [Annotate this event]                                                    │  │                           │
│                           │  └───────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Persistent REPLAY Banner (always visible, 28px amber strip)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Background: amber (`--color-replay-banner-bg`)
- Text: dark (`--color-replay-banner-text`), 13px, uppercase for "THIS IS A REPLAY SESSION", normal weight for the remainder
- Icon: `⏸` (pause icon, 14px) at left margin
- Never collapses. Never requires dismissal. Never scrolls away. Present in DOM before corpus loads.
- At narrow viewports: truncate descriptive clause before removing "THIS IS A REPLAY SESSION" label

---

### Session Header Detail (72px)

```
┌─ LEFT: Session identity ──────────────────────────────────────────────┬─ CENTRE: Replay controls ───────────────────────────────────┬─ RIGHT: Owner + collaborators ──┐
│ [INVESTIGATION] INV-2026-0601-abc1                                    │ ⏸ PAUSED                                                    │ Owner: J. Rangi (you)           │
│ Venue: The Parklands Golf Club [↗]                                    │ Speed: [0.25x] [0.5x] [1x★] [2x] [4x]                      │ Also here: M. Chen  [+0 more]   │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST            │ Playhead: 2026-05-28 16:23:41 AEST                          │ [⋯ Session actions ▾]           │
│ Type: POST_INCIDENT                                                   │                                                             │                                 │
└───────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

- `⏸ PAUSED` rendered in amber text, 15px bold
- Venue name: linked text (`[↗]` opens venue record in new tab — does NOT navigate current workspace)
- Speed selector: five discrete buttons; `[1x★]` has highlighted/active state; clicking any button updates active speed
- Playhead time: static when PAUSED; format `YYYY-MM-DD HH:MM:SS TZ`
- `[⋯ Session actions ▾]` dropdown contains: `[Conclude investigation]`, `[Abandon investigation]` — both require confirmation; owner and ADMIN only

---

### Timeline Scrubber (RP-TIMELINE — full width of Zone B)

```
  [◁◁] [◁] [⏸] [▶] [▶▶]     [0.25x] [0.5x] [1x★] [2x] [4x]                                              [−] [+] [Fit all]

  Swim lanes:

  PRE resolutions  ●────────────────────────────────────────●──────────────────────────────────────────────────
                                                             ▼ 16:23:41
  Override events  ────────────────────▲────────────────────┊──────────────────────────────────────────────────
                   14:11 OVR-0442 ▲                          ┊
  Device health    ──────────────────────────────────────────┊────■────────────────────────────────────────────
  Emergency        ──────────────────────────────────────────────────────────────────────────────────────────
  Player health    ──────────────────────────────────────────────────────────────────────────────────────────
  Annotations      ──────────────────────────────────────────🔖───────────────────────────────────────────────
  Findings         ──────────────────────────────────────────────────────────🚩──────────────────────────────

  Time axis:  14:00        15:00        16:00   16:23        17:00        18:00        19:00        19:45

  Range sel:  [════════════════════════════════════════════════════════════════════════════════] [Clear range]
```

- Playhead (`▼`) is a red dashed vertical line spanning all swim lane rows, labeled `16:23:41` directly below
- Clicking anywhere on the timeline moves the playhead and PAUSES playback
- Drag the `▼` marker to scrub; status switches to `◁ SCRUBBING` (blue text) during drag
- `[◁◁]` jumps playhead to 14:00; `[▶▶]` jumps to 19:45
- `[◁]` / `[▶]` step by one corpus event
- Scroll wheel over timeline: zoom in/out centred on cursor
- `[−]` `[+]` zoom buttons at right edge
- `[Fit all]` resets to full session range
- Range selector handles drag independently to restrict visible window (view filter only, does not change session time_range)
- Yellow `🔖` markers: annotations in this session. Grey `🔖` with strikethrough: SUPERSEDED annotations
- Red `!` badge on annotation marker: contradiction detected

---

### Zone A Detail (280px)

```
┌─────────────────────────────────────────────────────┐
│  [REPLAY]  ← amber badge, 12px, above venue name    │
│  The Parklands Golf Club               ▾             │
│  VenueSelector — available, no change               │
│ ─────────────────────────────────────────────────── │
│  Investigations                                     │
│  ▶ INV-2026-0601-abc1  POST_INCIDENT  ACTIVE        │
│    [Current session — highlighted]                  │
│                                                     │
│ ─────────────────────────────────────────────────── │
│  Incidents (read-only links)                        │
│  INC-2026-0528-001  CLASS_3  CONTAINED              │
│  The Parklands — Sponsor SOV shortfall              │
│  [→ View on IC surface]                             │
│                                                     │
│  (No incident action controls here.                 │
│   No declaration, no escalation, no commander       │
│   assignment, no state transition buttons.)         │
│                                                     │
│ ─────────────────────────────────────────────────── │
│  Notification Tray                                  │
│  [🔔 3 notifications]                               │
│                                                     │
│ ─────────────────────────────────────────────────── │
│  Operator Tools                                     │
│  [Browse investigations]                            │
│  [New investigation]                                │
│                                                     │
│  (Override creation tool is ABSENT from Zone A      │
│   during all replay sessions. Not disabled —        │
│   not rendered.)                                    │
└─────────────────────────────────────────────────────┘
```

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px full width | Global platform bar |
| SessionHeader (RP-TOP) | Below status bar, 72px | Left: identity, Centre: controls, Right: presence |
| ReplayBanner | Below session header, 28px amber | Always visible, non-dismissible |
| TabStrip (Tabs 1–5) | Below replay banner, 48px | Tab 1 active; no Tab 6 (OPERATOR role) |
| ZoneA | Left 280px, below tab strip | VenueSelector + nav + tools; no override controls |
| RP-TIMELINE | Upper ~25% of Zone B | Swim lanes + playhead + controls |
| RP-MAIN (event detail panel) | Lower ~75% of Zone B | Selected event: e_0928a1 detail |
| ZoneC | Right 280px, collapsible | Linked incident + evidence + collaborators + contradictions |
| DragHandle | Between RP-TIMELINE and RP-MAIN | Drag-resizable divider |

---

### Interaction Notes

- **Pause state:** `⏸` icon and "PAUSED" amber text in session header centre; playhead timestamp is static
- **Resume:** clicking `[▶]` (the play/pause toggle in RP-TIMELINE controls) resumes playback; header updates to `▶ REPLAYING` green text
- **Speed selector:** clicking `[2x]` deactivates `[1x★]`, activates `[2x★]`; applies to playback only, not annotation display
- **Annotate this event:** clicking `[Annotate this event]` in RP-MAIN opens the annotation write form inline below the event detail panel; form is not a modal
- **Annotation marker click on timeline:** clicking a `🔖` marker moves playhead to that annotation's anchor timestamp, selects the annotation in RP-MAIN, and keeps playback PAUSED
- **Contradiction badge `!`:** clicking opens the contradiction detail in RP-MAIN; both contradicting annotations shown side-by-side
- **Zone C `[Resolve now →]`:** navigates to Tab 3 and scrolls to the relevant contradiction pair; Zone C remains visible
- **Venue name `[↗]`:** opens venue record in a new browser tab; does not navigate the replay workspace
- **Range selector handles:** drag to restrict visible timeline window; `[Clear range]` button resets to full range; does not change session time_range fields

---

### Disabled-State Behavior

The following are NEVER rendered on this surface regardless of operator role, session state, or any other condition:

- Override creation form, button, or icon
- Override removal, clearance, or scope modification
- Emergency activation or clearance form
- Incident declaration form
- Incident severity escalation button
- Incident commander assignment
- Incident CONTAINED/RESOLVED transition button
- Handoff or recovery workflow components
- PRE parameter modification controls
- Screen content push controls
- Schedule activation/deactivation
- Campaign start/stop controls
- Session revocation or role modification in Zone B

These are absent from the DOM — not hidden, not disabled, not greyed. Implementing them as disabled elements is an implementation defect.

---

### Replay-State Behavior

This IS the replay surface. Replay-specific behaviours:

- All data displayed is historical corpus data; no live venue state is shown anywhere
- Playback is corpus-driven: the playhead moves forward through historical events at the selected speed
- PAUSED state: playhead is frozen at 2026-05-28 16:23:41 AEST; all tabs display data as of this timestamp
- Speed selector affects only playback speed; annotation list, event stream, and findings tabs show full session data regardless of speed
- `trust_state_at_event` is rendered for every event using the historical value from the corpus record, NOT the current trust state
- All trust indicators carry `(historical)` label in 10px grey text inline
- Annotation write: OPERATOR may write annotations while in PAUSED state; annotations are written to the investigation session (not to the corpus event itself)
- "2 notifications held while scrubbing" counter: appears if operator drags the scrub handle; notifications resume on release

---

### Degraded-State Behavior

**Corpus unavailable:**
- RP-TIMELINE renders: "Corpus data unavailable — timeline cannot be loaded." (static error state)
- Tab 1 RP-MAIN shows error with venue, session range, attempted load time
- Tabs 2 (Event Stream) and 5 (Corpus Diff) disabled with "Corpus data required."
- Tabs 3 (Annotations) and 4 (Findings) remain available; existing annotations readable; new annotations may be written anchored to manually entered timestamps
- A second amber banner below the REPLAY banner: "Corpus data is unavailable. Annotations and findings can still be written, but event citations and timeline navigation are offline."

**Data gaps in timeline:**
- Swim lane rows with no events in a period show a flat line (no events is valid — not an error state)
- Missing delivery confirmation for a device: amber hatching on the device health row for that period; tooltip: "No delivery confirmation from this device for this period"
- `trust_state_at_event` absent from a corpus event: trust indicator renders "UNKNOWN (historical trust data unavailable)" in amber text

**Corpus loading > 8s:**
- Advisory below RP-TIMELINE skeleton: "Corpus loading is taking longer than expected. Large time ranges may take up to 60 seconds."

---

### Incident-State Behavior

- POST_INCIDENT session: Zone C shows linked incident `INC-2026-0528-001` with CLASS_3 badge and CONTAINED status
- Incident appears in Zone A IncidentList as a read-only link; no action controls in Zone A
- Tab 4 (Findings) shows the incident closure constraint notice (2 unresolved contradictions currently block closure)
- Zone C contradiction panel shows red "CLOSURE BLOCKED: 2 unresolved contradictions" badge
- Navigating to IC surface: use Zone A link or Zone C `[View incident →]`; opens in new tab; does not navigate replay workspace
- Incident badge on timeline: any corpus event linked to the incident period receives a small orange `INC` badge on its swim lane marker

---

### Accessibility Notes

- Timeline keyboard navigation: when RP-TIMELINE has focus, left/right arrow keys move playhead by one corpus event
- `Tab` key moves focus through playback controls left to right: `[◁◁]` → `[◁]` → `[⏸]` → `[▶]` → `[▶▶]` → speed selector buttons → zoom buttons
- Speed selector: each speed button is individually focusable; `Enter` or `Space` activates
- Scrub drag is supplemented by left/right arrow keys when playhead handle has focus
- RP-TIMELINE swim lane labels ("PRE resolutions", "Override events", etc.) are accessible text labels, not images
- Annotation markers (`🔖`) have aria-label: "Annotation at [timestamp]: [confidence] — [first 50 chars of text]"
- Contradiction badge `!`: aria-label: "Contradiction detected — click to review"
- REPLAY banner: role="status", aria-live="polite" on mount; does not re-announce on subsequent renders
- All trust state indicators include the "(historical)" suffix in accessible text

---

## WF-RP-02: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 1 (Timeline) — REPLAYING at 1x speed

**ID:** WF-RP-02
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** REPLAYING
**Active tab:** Tab 1 — Timeline
**Purpose:** OPERATOR is watching the corpus replay advance in real time at 1x speed; playhead is moving through the 14:00–15:30 range before the incident peak.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ▶ REPLAYING    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]        │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 14:52:17 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▶  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline★] [Event Stream] [Annotations] [Findings] [Corpus Diff]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE                                                                      │  Linked incident          │
│ The Parklands Golf Club ▾ │                                                                                   │  INC-2026-0528-001        │
│                           │  [◁◁] [◁] [▶] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │  (centre button is now [▶] in PLAYING state = pause affordance)                  │  [View incident →]        │
│ Investigations            │                                                                                   │                           │
│ ▶ INV-2026-0601-abc1      │  14:00   14:52▼  15:00        16:00         17:00        18:00        19:45      │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  PRE  ●───────●──────────────────────────────────────────────────────────────   │  Evidence collected       │
│                           │  OVRD ──────────────────────────────────────────────────────────────────────   │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  DEVH ──────────────────────────────────────────────────────────────────────   │  Findings:     2          │
│ Incidents (read-only)     │  EMRG ──────────────────────────────────────────────────────────────────────   │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  PLYR ──────────────────────────────────────────────────────────────────────   │  Corpus events: 5         │
│  [→ View on IC surface]   │  ANNO ──────────────────────────────────────────────────────────────────────   │                           │
│                           │  FIND ──────────────────────────────────────────────────────────────────────   │  ─────────────────────    │
│ ─────────────────────     │                                                                                   │  Unresolved ⚠             │
│ Notification Tray         │       ↑ Playhead: 2026-05-28 14:52:17 AEST — advancing in real time             │  2 contradictions         │
│  [🔔 3 notifications]     │       (red dashed vertical line, animated — moves left-to-right)                 │  [Resolve now →]          │
│                           │                                                                                   │                           │
│ ─────────────────────     │  Range: [════════════════════════════════════════════════════] [Clear range]      │  ─────────────────────    │
│ Operator Tools            │                                                                                   │  Session collaborators    │
│  [Browse investigations]  │  RP-MAIN                                                                         │  J. Rangi (you — owner)   │
│  [New investigation]      │                                                                                   │  Active now               │
│                           │  ┌───────────────────────────────────────────────────────────────────────────┐  │  M. Chen                  │
│                           │  │  Click any event in the timeline above to view its details.               │  │  Active now               │
│                           │  │                                                                            │  │                           │
│                           │  │  (No event currently selected — playback is in progress)                  │  │                           │
│                           │  └───────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Session Header Detail (72px) — REPLAYING state

```
┌─ LEFT ──────────────────────────────────────────────────────────────┬─ CENTRE ─────────────────────────────────────────────────────┬─ RIGHT ─────────────────────────┐
│ [INVESTIGATION] INV-2026-0601-abc1                                  │ ▶ REPLAYING                                                  │ Owner: J. Rangi (you)           │
│ Venue: The Parklands Golf Club [↗]                                  │ Speed: [0.25x] [0.5x] [1x★] [2x] [4x]                      │ Also here: M. Chen              │
│ Time range: 2026-05-28 14:00 → 19:45 AEST  Type: POST_INCIDENT     │ Playhead: 2026-05-28 14:52:17 AEST  (animating)             │ [⋯ Session actions ▾]           │
└─────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

- `▶ REPLAYING` in green text, 15px bold
- Playhead timestamp updates in real time (animated counter advancing by the clock rate × speed multiplier)
- Play/pause toggle in RP-TIMELINE shows `[▶]` (click to pause); not `[⏸]`
- Note: The play/pause button icon shows the action that will occur on click — when REPLAYING, button shows `[⏸]` (pause affordance)

---

### Persistent REPLAY Banner — REPLAYING state

```
│ ▶  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │
```

- Same amber background; icon switches to `▶` when REPLAYING, `⏸` when PAUSED, `◁` when SCRUBBING
- Otherwise identical to WF-RP-01 banner specification

---

### RP-MAIN Content — No Event Selected

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                      │
│    Click any event in the timeline above to view its details.                                        │
│                                                                                                      │
│    Clicking an event will pause playback and display the event detail here.                          │
│                                                                                                      │
└──────────────────────────────────────────────────────────────────name──────────────────────────────────┘
```

- Shown when no event is selected; clicking any swim lane marker selects the event, pauses playback, and loads event detail
- Clicking the timeline background (not a marker): moves playhead to that timestamp and pauses; RP-MAIN shows "Click any event marker to view its details."

---

### Focus Protection During Active Playback

```
  (If 2+ notifications arrive during REPLAYING state — deferred for up to 15s at Level 2 and below)

  ┌─ Notification deferral counter ─────────────────────────────────────────────────┐
  │  2 notifications held while replaying — [show now]                              │
  └─────────────────────────────────────────────────────────────────────────────────┘
  (Renders as a discreet strip below the tab strip, right-aligned, 24px height)
```

- Level 1 constitutional interrupts are NEVER deferred
- Deferral is dismissed when operator pauses playback or clicks "show now"

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | As per WF-RP-01 |
| SessionHeader | 72px, below status bar | Centre shows `▶ REPLAYING` green text; playhead animating |
| ReplayBanner | 28px amber | Icon is `▶` in REPLAYING state |
| TabStrip | 48px, Tab 1 active | 5 tabs (OPERATOR role) |
| ZoneA | Left 280px | Identical to WF-RP-01 |
| RP-TIMELINE | Upper ~25% Zone B | Playhead (`▼`) advancing left-to-right; play button shows pause affordance |
| RP-MAIN | Lower ~75% Zone B | "Click any event" prompt — no event selected |
| ZoneC | Right 280px | Identical to WF-RP-01 |
| NotificationDeferralStrip | Below tab strip, right-aligned | Only visible if notifications have been deferred |

---

### Interaction Notes

- **Click an event marker while REPLAYING:** pauses playback immediately, loads event detail in RP-MAIN
- **Click timeline background while REPLAYING:** moves playhead to that timestamp, pauses playback; RP-MAIN shows default "click an event marker" prompt
- **Speed change while REPLAYING:** new speed applies immediately; playhead continues advancing at new rate
- **Tab switch while REPLAYING:** switching to Tab 2–5 does not pause playback; timeline continues advancing; Tab 2 event stream scrolls to keep pace with playhead timestamp
- **Scrub while REPLAYING:** starting a drag on the playhead handle pauses playback and enters SCRUBBING state; releasing sets new position and PAUSES (does not auto-resume)

---

### Disabled-State Behavior

Identical to WF-RP-01. No live write controls anywhere on surface.

---

### Replay-State Behavior

- Active playback: corpus events appear in the timeline as the playhead reaches their timestamp
- Swim lane markers for future events (timestamps ahead of current playhead) are visible but dimmed (50% opacity) to indicate they have not yet been "reached" in the replay
- Markers at or before the current playhead position are at full opacity
- Annotation and finding markers always render at full opacity regardless of playhead position (they were written during this investigation session and are always visible)

---

### Degraded-State Behavior

Identical to WF-RP-01 degraded-state specification.

---

### Incident-State Behavior

Identical to WF-RP-01 incident-state specification.

---

### Accessibility Notes

- `▶ REPLAYING` status has role="status" aria-live="polite" — announces on change from PAUSED to REPLAYING
- Animated playhead timestamp: aria-live="off" by default to prevent screen reader flooding; operator can toggle verbosity in accessibility settings
- When REPLAYING, the play/pause button aria-label reads: "Pause replay" (action affordance, not current state label)
- Timeline playhead line: aria-label="Playhead at [current timestamp]", updated on each event step

---

## WF-RP-03: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 2 (Event Stream) — filtered by type

**ID:** WF-RP-03
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1#events
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 2 — Event Stream
**Purpose:** OPERATOR has filtered the event stream to show only PRE_RESOLVE and OVERRIDE_CREATED events in order to trace the override stack during the incident period.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream★] [Annotations] [Findings] [Corpus Diff]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible regardless of active tab)                            │  Linked incident          │
│ The Parklands Golf Club ▾ │                                                                                   │  INC-2026-0528-001 ···    │
│                           │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │  14:00       15:00       16:00  16:23▼  17:00        18:00       19:45           │  [View incident →]        │
│ Investigations            │  PRE  ●──────────────────────────●──────────────────────────────────────────   │                           │
│ ▶ INV-2026-0601-abc1      │  OVRD ──────────────▲────────────┊──────────────────────────────────────────   │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  DEVH ──────────────────────────────────────────────────────────────────────   │  Evidence collected       │
│                           │  Range: [═══════════════════════════════════════════════════] [Clear range]      │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │                                                                                   │  Findings:     2          │
│ Incidents (read-only)     │  RP-MAIN ─── Tab 2: Event Stream ───────────────────────────────────────────── │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │                                                                                   │  Corpus events: 5         │
│  [→ View on IC surface]   │  ┌─ Filter bar ──────────────────────────────────────────────────────────────┐  │                           │
│                           │  │ Event types:  [✓ PRE_RESOLVE] [✓ OVERRIDE_CREATED] [ ] DEVICE_OFFLINE     │  │  ─────────────────────    │
│ ─────────────────────     │  │               [ ] OVERRIDE_EXPIRED  [ ] EMERGENCY  [ ] PLAYER_TRANSITION  │  │  Unresolved ⚠             │
│ Notification Tray         │  │ Source: [____________]   Time: [14:00]→[19:45]   [ ] Annotations only     │  │  2 contradictions         │
│  [🔔 3 notifications]     │  │ [Clear filters  2 ×]                                                       │  │  [Resolve now →]          │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│ ─────────────────────     │                                                                                   │  ─────────────────────    │
│ Operator Tools            │  Showing 47 events  (filtered: PRE_RESOLVE + OVERRIDE_CREATED)                   │  Session collaborators    │
│  [Browse investigations]  │                                                                                   │  J. Rangi (you — owner)   │
│  [New investigation]      │  ┌─ Event row ───────────────────────────────────────────────────────────────┐  │  Active now               │
│                           │  │ │CORPUS│ PRE_RESOLVE   2026-05-28 16:23:41 AEST   pre-engine-01            │  │  M. Chen                  │
│                           │  │         L1 Override → Club_Sponsor_B (OVR-0442)  [🔖 2 annotations]       │  │  Active now               │
│                           │  ├───────────────────────────────────────────────────────────────────────────┤  │                           │
│                           │  │ │CORPUS│ PRE_RESOLVE   2026-05-28 16:22:59 AEST   pre-engine-01            │  │                           │
│                           │  │         L1 Override → Club_Sponsor_B (OVR-0442)  [🔖 1 annotation]        │  │                           │
│                           │  ├───────────────────────────────────────────────────────────────────────────┤  │                           │
│                           │  │ │CORPUS│ OVERRIDE_CREATED   2026-05-28 14:11:07 AEST   op-session-T.Naka  │  │                           │
│                           │  │         OVR-0442  L1  Club_Sponsor_B  screens: B1–B4  no-expiry  [🔖 0]   │  │                           │
│                           │  ├───────────────────────────────────────────────────────────────────────────┤  │                           │
│                           │  │ │CORPUS│ PRE_RESOLVE   2026-05-28 14:11:03 AEST   pre-engine-01            │  │                           │
│                           │  │         L3 Campaign → Campaign_Club_General  (pre-override)  [🔖 0]        │  │                           │
│                           │  └───────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │  · · · (43 more rows, scroll to view) · · ·                                      │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Filter Bar Detail

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Event types:                                                                                                                              │
│   [✓ PRE_RESOLVE]  [✓ OVERRIDE_CREATED]  [ ] OVERRIDE_EXPIRED  [ ] DEVICE_OFFLINE  [ ] DEVICE_ONLINE  [ ] EMERGENCY_ACTIVATED           │
│   [ ] EMERGENCY_CLEARED  [ ] PLAYER_TRANSITION  [ ] DIVERGENCE_DETECTED  [ ] PRE_DIVERGENCE                                              │
│                                                                                                                                           │
│ Source:  [________________________]    Time range:  [2026-05-28 14:00] → [2026-05-28 19:45]    [ ] Show annotations only                 │
│                                                                                                                                           │
│ [Clear filters  2 ×]   ← badge shows count of active filter criteria                                                                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Multi-select checkboxes for event types; checked = included in results
- Source: free-text partial match against the `source` field
- Time range pickers constrained to session time_range_start / time_range_end
- "Show annotations only": toggle shows only events with at least one annotation attached
- `[Clear filters N ×]`: resets all filters; badge count = number of active non-default filter criteria
- Filters are local to Tab 2; do not affect RP-TIMELINE swim lanes

---

### Event Row Anatomy

```
Single-row (collapsed):
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ │CORPUS│  [PRE_RESOLVE · blue]   2026-05-28 16:23:41 AEST   pre-engine-01   L1 Override → Club_Sponsor_B (OVR-0442)   [🔖 2 annotations] ▼ expand │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Expanded row (after clicking ▼):
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ │CORPUS│  [PRE_RESOLVE · blue]   2026-05-28 16:23:41 AEST   pre-engine-01                                         ▲ collapse         │
│                                                                                                                                      │
│ Full payload (syntax-highlighted JSON, read-only, scrollable):                                                                       │
│ {                                                                                                                                    │
│   "event_id": "e_0928a1",                                                                                                            │
│   "event_type": "PRE_RESOLVE",                                                                                                       │
│   "governed_timestamp": "2026-05-28T06:23:41Z",                                                                                     │
│   "source": "pre-engine-01",                                                                                                         │
│   "trust_state_at_event": "RECOVERED_BUT_UNTRUSTED",                                                                                 │
│   "winning_level": "L1",                                                                                                             │
│   "winning_content": "Club_Sponsor_B",                                                                                               │
│   "override_id": "OVR-0442",                                                                                                         │
│   "override_stack_depth": 3                                                                                                          │
│ }                                                                                                                                    │
│                                                                                                                                      │
│ Trust state (at event time): RECOVERED_BUT_UNTRUSTED  (historical)                                                                   │
│                                                                                                                                      │
│ Annotations on this event (2):                                                                                                       │
│   🔖 ANN-0029  CONFIRMED  J. Rangi  2026-06-01 09:14                                                                                │
│      "The L1 override OVR-0442 was winning at this timestamp..."  [view in Tab 3]                                                    │
│   🔖 ANN-0025  PROBABLE  M. Chen  2026-06-01 08:32  [! CONTRADICTION]                                                               │
│      "Override stack suggests a lower-priority rule was also..."  [view in Tab 3]                                                    │
│                                                                                                                                      │
│  [Annotate this event]                                                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- `│CORPUS│`: 3px amber left border + "CORPUS" in 10px uppercase on every corpus event row without exception
- Type badge colour-coded: blue (PRE events), orange (override), purple (device), red (emergency), teal (player)
- Timestamp: venue-local timezone (AEST), governed timestamp from corpus — not wall clock display time
- Payload preview: max 80 chars; full JSON visible on expand
- `[🔖 N annotations]`: bookmark icon + count; click to expand row and view annotations
- `[! CONTRADICTION]` badge: appears on annotation entries within expanded rows when contradiction exists
- `[Annotate this event]`: opens annotation write form inline below the expanded row; pre-populates anchor

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | Global |
| SessionHeader | 72px | PAUSED state |
| ReplayBanner | 28px amber | Unchanged |
| TabStrip | 48px | Tab 2 active (Event Stream) |
| ZoneA | Left 280px | Unchanged from WF-RP-01 |
| RP-TIMELINE | Upper ~25% Zone B | Visible on all tabs; playhead at 16:23:41 |
| FilterBar | Top of RP-MAIN | Multi-select event type + source + time + annotations-only |
| ResultCount | Below filter bar | "Showing N events (filtered: ...)" |
| EventStreamList | Below result count, scrollable | Rows with CORPUS badge; collapsed by default |
| AnnotationInlineForm | Below expanded event row (when `[Annotate this event]` clicked) | Not a modal |
| ZoneC | Right 280px | Unchanged |

---

### Interaction Notes

- **Expand event row:** click anywhere on the row (or `▼` button) to expand; click `▲` to collapse
- **Filter changes:** results update immediately (no submit); result count updates
- **`[Clear filters]`:** resets all filters to defaults (all types checked, no source filter, full time range, annotations-only off)
- **`[Annotate this event]`:** opens write form inline (not a modal); form anchor is pre-filled with this event ID; form appears below the expanded row; other rows remain visible
- **Annotation form submission:** collapses form; new annotation appears in expanded row's annotation list immediately; Tab 3 annotation count in Zone C updates
- **`[view in Tab 3]` on annotation:** switches active tab to Tab 3, scrolls to that annotation; RP-TIMELINE stays visible
- **`[! CONTRADICTION]` badge:** clicking opens contradiction detail inline within the expanded row; shows both contradicting annotations and resolution options

---

### Disabled-State Behavior

Identical to WF-RP-01. No live write controls anywhere on surface. Event payload JSON is read-only (no edit affordance).

---

### Replay-State Behavior

- RP-TIMELINE remains visible and interactive while Tab 2 is active
- Event stream is synchronised with the playhead: if REPLAYING, the stream auto-scrolls to keep the most recently-reached event near the top of the visible list
- Filtering does not affect playback or RP-TIMELINE
- Events ahead of the current playhead position are shown at 80% opacity with a "(future in replay)" indicator if the stream is not time-filtered

---

### Degraded-State Behavior

- **Corpus unavailable:** Tab 2 displays "Corpus data required — event stream cannot be loaded." with session range and attempted load time; filter bar is hidden; RP-TIMELINE shows error state
- **Partial corpus gap:** rows within the gap period are absent from the stream; a gap indicator row is inserted: "─── No corpus data for this period (16:05 – 16:18) ───"
- **Missing `trust_state_at_event`:** expanded row shows trust state as "UNKNOWN (historical trust data unavailable)" in amber

---

### Incident-State Behavior

- Events linked to the incident period display an orange `INC` badge alongside the type badge
- Incident-correlated events are not reordered; they remain in chronological sequence
- No incident action controls appear anywhere in the event stream

---

### Accessibility Notes

- Event rows: role="row" in a role="grid"; keyboard navigation with arrow keys
- `Tab` key: focuses filter bar first, then event rows
- `Enter` or `Space` on collapsed row: expands; on expanded row: collapses
- Filter checkboxes: standard checkbox role with visible label
- Annotation count badge: aria-label="N annotations attached — click to expand and view"
- CORPUS left border: supplemented with aria-label="Corpus event — immutable" on each row

---

## WF-RP-04: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 3 (PRE Resolution Replay) — viewing resolution at specific timestamp

**ID:** WF-RP-04
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1#annotations
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 3 — Annotations
**Purpose:** OPERATOR is reviewing annotations in chronological order; has arrived at a contradiction pair and is about to write a superseding annotation to resolve it.

Note: Per the canonical spec, Tab 3 is the Annotations tab (labeled "Annotations", URL `#annotations`). The wireframe task description calls it "PRE Resolution Replay" but the canonical tab ordering makes Tab 3 the Annotations tab. This wireframe covers Tab 3 as specified in the canonical surface document.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations★] [Findings] [Corpus Diff]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  INC-2026-0528-001        │
│                           │  14:00       16:23▼                        19:45              │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │  [swim lanes as per WF-RP-01]                                                     │  [View incident →]        │
│ Investigations            │  Range: [═══════════════════════════════════════════════════] [Clear range]        │                           │
│ ▶ INV-2026-0601-abc1      │                                                                                   │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  RP-MAIN ─── Tab 3: Annotations ──────────────────────────────────────────────── │  Evidence collected       │
│                           │                                                                                   │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  ┌─ Sort and filter ───────────────────────────────────────────────────────────┐  │  Findings:     2          │
│ Incidents (read-only)     │  │ Sort: [authored_at desc★] [authored_at asc] [anchor time] [author] [conf.]  │  │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  │ Filter: Author [All ▾]  Confidence [All ▾]  Anchor [All ▾]                  │  │  Corpus events: 5         │
│  [→ View on IC surface]   │  │ [ ] Show SUPERSEDED  (2 superseded annotations hidden — [Show all])         │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │  ─────────────────────    │
│ ─────────────────────     │                                                                                   │  Unresolved ⚠             │
│ Notification Tray         │  [+ Write annotation]                                   7 annotations (5 active) │  2 contradictions block   │
│  [🔔 3 notifications]     │                                                                                   │  incident closure.        │
│                           │  ┌─ Annotation ANN-0029 ───────────────────────────────────────────────────────┐  │  ANN-0025 vs ANN-0027     │
│ ─────────────────────     │  │ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST               │  │  anchor: event e_0928a1   │
│ Operator Tools            │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41            │  │  [Resolve now →]          │
│  [Browse investigations]  │  │                                                                             │  │                           │
│  [New investigation]      │  │ "The L1 override OVR-0442 was winning at this timestamp and suppressing     │  │  ANN-0031 vs ANN-0033     │
│                           │  │  Campaign_Club_General. This matches the observed blackout on screen B2."   │  │  anchor: 16:30–16:45      │
│                           │  │                                                                             │  │  [Resolve now →]          │
│                           │  │ Cited in: Finding F-003            [IMMUTABLE — written 2026-06-01]         │  │                           │
│                           │  │  [Supersede this annotation]                                                │  │  ─────────────────────    │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │  Session collaborators    │
│                           │                                                                                   │  J. Rangi (you — owner)   │
│                           │  ┌─ Annotation ANN-0025 (CONTRADICTION) ──────────────────────────────────────┐  │  Active now               │
│                           │  │ [PROBABLE] ●  M. Chen  ·  Written: 2026-06-01 08:32:05 AEST                │  │  M. Chen                  │
│                           │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41           │  │  Active now               │
│                           │  │ [! CONTRADICTION DETECTED]                                                  │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ "The override stack at 16:23 was 3 levels deep. The winning level           │  │                           │
│                           │  │  appears to be L1 but the stack configuration suggests L2 also had          │  │                           │
│                           │  │  a conflicting rule active at the same time."                               │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │                                      [IMMUTABLE — written 2026-06-01]       │  │                           │
│                           │  │  [Supersede this annotation]                                                │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Annotation ANN-0027 (CONTRADICTION PAIR) ─────────────────────────────────┐  │                           │
│                           │  │ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:05:11 AEST              │  │                           │
│                           │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41           │  │                           │
│                           │  │ [! CONTRADICTION DETECTED]                                                  │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ "Reviewed the override stack trace: only one L1 rule was active at          │  │                           │
│                           │  │  16:23:41. No L2 conflict. M. Chen's observation in ANN-0025 is based       │  │                           │
│                           │  │  on an incorrect stack depth reading."                                      │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │                                      [IMMUTABLE — written 2026-06-01]       │  │                           │
│                           │  │  [Supersede this annotation]                                                │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Contradiction detail (expanded) ─────────────────────────────────────────┐  │                           │
│                           │  │ Contradiction detected                                                     │  │                           │
│                           │  │ Between: ANN-0025 (M. Chen) and ANN-0027 (J. Rangi)                        │  │                           │
│                           │  │ Anchor: Event e_0928a1 at 2026-05-28 16:23:41                              │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ These annotations make conflicting observations about the same event.       │  │                           │
│                           │  │ The system cannot determine which is correct — you must resolve this.       │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ Unresolved contradictions block incident closure for POST_INCIDENT.         │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │  [Resolve by annotation]  [Resolve by finding]  [Dismiss reminder]         │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Annotation Card Detail (full anatomy)

```
Active (non-SUPERSEDED) annotation card:
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST                                       │
│ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41  [jump to event →]                 │
│                                                                                                     │
│ "The L1 override OVR-0442 was winning at this timestamp and suppressing Campaign_Club_General.       │
│  This matches the observed blackout on screen B2."                                                  │
│                                                                                                     │
│ Cited in: Finding F-003  [view →]                         [IMMUTABLE — written 2026-06-01]           │
│  [Supersede this annotation]                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

(Note: NO edit button. NO delete button. NO pencil icon. NO hover edit state. Only [Supersede this annotation].)
```

---

### SUPERSEDED Annotation Card (if "Show SUPERSEDED" toggle is ON)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░ SUPERSEDED — see ANN-0029 below ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ [SPECULATIVE] ●  J. Rangi  ·  Written: 2026-06-01 08:47:01 AEST                                     │
│ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41                                    │
│ Superseded by: ANN-0029 (below)                                                                     │
│                                                                                                     │
│ [grey dimmed text, 60% opacity — full text visible, not blurred or hidden]                           │
│ "The divergence may have been caused by network latency on screen B2."                              │
│                                                                                                     │
│ [IMMUTABLE — written 2026-06-01]  [SUPERSEDED]                                                      │
│ (No [Supersede this annotation] button — superseded annotations cannot be further superseded)        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
    │
    └──▶  (visual connector to superseding annotation below)
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST                                       │
│ Supersedes: ANN-0028 (above)                                                                         │
│ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41                                    │
│                                                                                                     │
│ [full opacity, full colour — active annotation]                                                     │
│ "Correction of ANN-0028: ..."                                                                       │
│                                                                                                     │
│ [IMMUTABLE — written 2026-06-01]  [SUPERSEDES ANN-0028]                                             │
│  [Supersede this annotation]                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Write Annotation Form (inline, opened via `[Resolve by annotation]` or `[+ Write annotation]`)

```
┌─ Write annotation ──────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  Writing a correction to ANN-0025. The original annotation will be permanently marked              │
│    SUPERSEDED but will remain visible.                                                              │
│    Preview: "The override stack at 16:23 was 3 levels deep. The winning level appears..."           │
│    (grey background, first 100 chars of ANN-0025)                                                   │
│                                                                                                     │
│ Supersedes: ANN-0025  [read-only — cannot change]                                                   │
│                                                                                                     │
│ Anchor this annotation to:                                                                          │
│   ● Specific event  [Event ID: e_0928a1]  [Browse events]                                           │
│   ○ Specific timestamp  [2026-05-28] [__:__:__] AEST                                               │
│   ○ Time range  [from: ____] [to: ____] AEST                                                        │
│                                                                                                     │
│ Annotation text (required — 10–2000 characters):                                                    │
│ ┌───────────────────────────────────────────────────────────────────────────────────────────────┐  │
│ │                                                                                               │  │
│ │                                                                                               │  │
│ └───────────────────────────────────────────────────────────────────────────────────────────────┘  │
│ [Characters remaining: 2000]                                                                        │
│                                                                                                     │
│ Confidence (required):                                                                              │
│   ○ CONFIRMED — I have high certainty based on direct evidence                                      │
│   ● PROBABLE  — I believe this is correct but acknowledge uncertainty                               │
│   ○ SPECULATIVE — My evidence is indirect or I am not certain                                       │
│                                                                                                     │
│  [Cancel]   [Submit annotation]                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Form opens at the top of Tab 3, not inline with the annotation being superseded
- "Supersedes" field is read-only and pre-filled
- On submit: form collapses; ANN-0025 immediately receives SUPERSEDED visual treatment; new annotation appears at top of list; "Annotation written. This annotation is permanent." auto-dismisses after 3 seconds

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | |
| SessionHeader | 72px | PAUSED state |
| ReplayBanner | 28px amber | |
| TabStrip | 48px | Tab 3 active (Annotations) |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | Always visible |
| SortFilterBar | Top of RP-MAIN | Sort + author/confidence/anchor filters + show SUPERSEDED toggle |
| WriteAnnotationButton | Above annotation list | `[+ Write annotation]` |
| WriteAnnotationForm | Top of RP-MAIN, above list | Opened when supersede or new annotation initiated |
| AnnotationList | Scrollable below filter bar | Cards in authored_at desc order |
| ContradictionDetail | Below contradiction pair cards | Expanded inline; shows resolution options |
| ZoneC | Right 280px | |

---

### Interaction Notes

- **`[+ Write annotation]`:** opens write form at top of Tab 3 (not a modal); rest of annotation list remains visible below
- **`[Supersede this annotation]`:** opens write form with supersedes pre-filled and ANN preview shown; form at top of tab
- **`[Resolve by annotation]` in contradiction detail:** same as clicking `[Supersede this annotation]` on one of the contradicting annotations
- **`[Resolve by finding]`:** switches to Tab 4 and opens the finding write form
- **`[Dismiss reminder]`:** removes the contradiction detail prompt; `[! CONTRADICTION]` badge on the annotations remains; re-clicking badge re-opens the detail
- **`[jump to event →]` in anchor line:** switches to Tab 2, expands that event row, scrolls to it
- **Sort selector:** changes annotation order immediately; no page reload
- **Show SUPERSEDED toggle:** default off; toggling on inserts SUPERSEDED cards into their position relative to superseding annotation; notice "N superseded annotations hidden" becomes "Showing all annotations"

---

### Disabled-State Behavior

- No edit, modify, or delete controls on any annotation
- `[Supersede this annotation]` button is the only action on a submitted annotation
- SUPERSEDED annotations have no action buttons (cannot be further superseded)
- Annotation text is selectable/copyable but not editable in any state

---

### Replay-State Behavior

- Annotations displayed are those written within this investigation session (by any collaborator)
- All annotations reference historical corpus events via their `anchored_to` field; no annotation references or modifies live state
- RP-TIMELINE bookmark markers (`🔖`) correspond to annotations shown in this list

---

### Degraded-State Behavior

- **Corpus unavailable:** annotation list remains fully available; existing annotations readable; new annotations may be written anchored to manually entered timestamps or event IDs
- **Missing linked event:** "Anchored to: event e_0928a1 (event record not available in current corpus load)" — annotation itself remains visible

---

### Incident-State Behavior

- Unresolved contradictions show red `[! CONTRADICTION DETECTED]` badge on both annotation cards
- Contradiction detail box shows: "Unresolved contradictions block incident closure for POST_INCIDENT sessions."

---

### Accessibility Notes

- Each annotation card: role="article"; aria-label="Annotation [ANN-ID] by [author], [confidence], anchored to [anchor description]"
- `[! CONTRADICTION DETECTED]` badge: role="alert" on first render; aria-label="Contradiction detected — click to review"
- SUPERSEDED card: aria-label includes "SUPERSEDED — see superseding annotation [ANN-ID]"
- `[IMMUTABLE]` badge: aria-label="This annotation is permanent and cannot be modified"
- Contradiction detail form buttons: `[Resolve by annotation]` aria-label="Open write form to resolve contradiction by writing a superseding annotation"; `[Resolve by finding]` aria-label="Open findings tab to resolve contradiction by submitting a finding"
- Write form: aria-live="polite" announces "Annotation write form opened" on mount; "Annotation submitted — this annotation is permanent" on success

---

## WF-RP-05: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 4 (Override History) — viewing override stack at replay timestamp

**ID:** WF-RP-05
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1#findings
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 4 — Findings
**Purpose:** OPERATOR is reviewing the Findings tab, which shows the incident closure constraint and the current state of submitted findings, preparing to submit a new finding to resolve the remaining contradiction.

Note: Per the canonical spec, Tab 4 is the Findings tab (URL `#findings`). The wireframe task description refers to "Override History" but the canonical tab ordering maps Tab 4 to Findings. This wireframe covers Tab 4 as specified in CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations] [Findings★] [Corpus Diff]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  INC-2026-0528-001        │
│                           │  [swim lanes — playhead at 16:23:41]                                             │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │  Range: [═══════════════════════════════════════════════════] [Clear range]        │  [View incident →]        │
│ Investigations            │                                                                                   │                           │
│ ▶ INV-2026-0601-abc1      │  RP-MAIN ─── Tab 4: Findings ───────────────────────────────────────────────── │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │                                                                                   │  Evidence collected       │
│                           │  ┌─ Incident closure constraint notice ───────────────────────────────────────┐  │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  │ ℹ  This investigation is linked to incident INC-2026-0528-001.              │  │  Findings:     2          │
│ Incidents (read-only)     │  │    For that incident to transition to RESOLVED, at least one CONFIRMED      │  │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  │    or PROBABLE finding with at least one evidence citation must exist,      │  │  Corpus events: 5         │
│  [→ View on IC surface]   │  │    and all contradictions must be resolved.                                 │  │                           │
│                           │  │                                                                             │  │  ─────────────────────    │
│ ─────────────────────     │  │    Current status:                                                         │  │  Unresolved ⚠             │
│ Notification Tray         │  │    ● Supported findings: 1 (CONFIRMED)                          ✓          │  │  CLOSURE BLOCKED          │
│  [🔔 3 notifications]     │  │    ● Unresolved contradictions: 2                    ✗ — blocks closure    │  │  2 unresolved contrad.    │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │  ANN-0025 vs ANN-0027     │
│ ─────────────────────     │                                                                                   │  [Resolve now →]          │
│ Operator Tools            │  [+ Submit finding]                                    2 findings                 │                           │
│  [Browse investigations]  │                                                                                   │  ANN-0031 vs ANN-0033     │
│  [New investigation]      │  ┌─ Finding F-003 ──────────────────────────────────────────────────────────┐  │  [Resolve now →]          │
│                           │  │ [CONFIRMED]  CLASS_3 divergence    F-003    J. Rangi  ·  2026-06-01 10:02 │  │                           │
│                           │  │                                                                            │  │  ─────────────────────    │
│                           │  │ "The L1 operational override OVR-0442, placed on 2026-05-28 at 14:11       │  │  Session collaborators    │
│                           │  │  by T. Nakamura, suppressed Campaign_Club_General on screens B1–B4         │  │  J. Rangi (you — owner)   │
│                           │  │  from 14:11 through 19:45, causing the sponsor SOV shortfall of 5.3 hrs.   │  │  Active now               │
│                           │  │  The override had no configured expiry and was not reviewed."              │  │  M. Chen                  │
│                           │  │                                                                            │  │  Active now               │
│                           │  │ Evidence basis:                                                            │  │                           │
│                           │  │   ● ANN-0029 (corpus event citation)                                       │  │                           │
│                           │  │   ● Event e_0928a1 (PRE resolution)                                        │  │                           │
│                           │  │   ● Event e_1044c2 (override created)                                      │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │ Linked incident: INC-2026-0528-001  [view →]                               │  │                           │
│                           │  │ [IMMUTABLE — written 2026-06-01]                                           │  │                           │
│                           │  │  [Supersede this finding]                                                  │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Finding F-004 (UNSUPPORTED) ──────────────────────────────────────────────┐  │                           │
│                           │  │ [SPECULATIVE]    F-004    A. Okafor  ·  2026-06-01 10:44                   │  │                           │
│                           │  │ ⚠  UNSUPPORTED — No evidence citations provided                             │  │                           │
│                           │  │    This finding cannot be used as the sole basis for incident closure.      │  │                           │
│                           │  │    At least one CONFIRMED or PROBABLE supported finding must exist.         │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │ "The network issues observed may have been caused by firmware on device     │  │                           │
│                           │  │  D-0041, but I have not been able to confirm this in the corpus."          │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │ Evidence basis: (none)                                                     │  │                           │
│                           │  │ [IMMUTABLE — written 2026-06-01]  [UNSUPPORTED]                            │  │                           │
│                           │  │  [Supersede this finding]                                                  │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Incident Closure Constraint Notice (always visible when session has linked incident_id)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ℹ  This investigation is linked to incident INC-2026-0528-001.                                         │
│    For that incident to transition to RESOLVED, at least one CONFIRMED or PROBABLE finding with        │
│    at least one evidence citation must exist, and all contradictions must be resolved.                  │
│                                                                                                        │
│    Current status:                                                                                     │
│    ● Supported findings: 1 (CONFIRMED)                                                      ✓          │
│    ● Unresolved contradictions: 2                                           ✗ — blocks closure          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Background: info-blue tinted panel
- `✓` in green; `✗` in red
- Live-updating: if a contradiction is resolved, the count decrements and `✗` changes to `✓`
- No buttons within this notice that affect incident state (no "go to incident", no resolve-incident button)

---

### Write Finding Form (inline, opened via `[+ Submit finding]`)

```
┌─ Submit finding ────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                         │
│ Finding text (required — 50–5000 characters):                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐    │
│ │                                                                                                 │    │
│ │                                                                                                 │    │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘    │
│ [Characters remaining: 5000]                                                                            │
│                                                                                                         │
│ Evidence citations (recommended — leaving empty produces UNSUPPORTED finding):                          │
│   + Add annotation citation   [ANN-______]                                                              │
│   + Add corpus event citation [EVT-______]                                                              │
│   [Browse annotations]   [Browse events]                                                                │
│                                                                                                         │
│   Current citations: (none)                                                                             │
│                                                                                                         │
│ Confidence (required):                                                                                  │
│   ○ CONFIRMED    ● PROBABLE    ○ SPECULATIVE                                                            │
│                                                                                                         │
│ Divergence classification (optional):                                                                   │
│   [CLASS_1 — Operational]  [CLASS_2 — Significant]  [CLASS_3 — Serious]  [CLASS_4 — Critical]          │
│   (None selected)                                                                                       │
│                                                                                                         │
│ Link to incident (optional):                                                                            │
│   [INC-2026-0528-001 ▾]  (pre-populated if session has linked incident_id)                              │
│                                                                                                         │
│ Supersedes finding? (optional):                                                                         │
│   [Select finding to supersede ▼]                                                                       │
│                                                                                                         │
│  [Cancel]   [Submit finding]                                                                            │
│                                                                                                         │
│  (If evidence_basis is empty at submit time, a warning appears here before the button:                  │
│   "Warning: You have no evidence citations. This finding will be marked UNSUPPORTED.")                  │
│                                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Finding Card Divergence Class Colour Reference

| Class badge | Colour | Meaning |
|---|---|---|
| CLASS_1 | Blue border/text | Operational — minor, recoverable |
| CLASS_2 | Amber border/text | Significant — intervention required |
| CLASS_3 | Orange border/text | Serious — material impact |
| CLASS_4 | Red border/text | Critical — structural/compliance breach |
| (none) | Grey | Unclassified |

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | |
| SessionHeader | 72px | PAUSED |
| ReplayBanner | 28px amber | |
| TabStrip | 48px | Tab 4 active (Findings) |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | Always visible |
| IncidentClosureNotice | Top of RP-MAIN | Always rendered when session has linked incident_id |
| SubmitFindingButton | Below closure notice | `[+ Submit finding]` |
| WriteFindingForm | Top of RP-MAIN (when open) | Not a modal; above finding list |
| FindingList | Scrollable | Cards in authored_at desc order |
| ZoneC | Right 280px | Contradiction panel shows "CLOSURE BLOCKED" badge |

---

### Interaction Notes

- **`[+ Submit finding]`:** opens write form at top of RP-MAIN; finding list remains visible below
- **`[Browse annotations]` in form:** opens a panel listing all annotations in this session; click an annotation to add it as a citation
- **`[Browse events]` in form:** opens a panel listing corpus events; click to add event citation
- **`[Supersede this finding]`:** opens write form with `supersedes` pre-filled; existing finding remains visible and immediately receives SUPERSEDED treatment on submission
- **Evidence citation links in finding card:** clicking ANN-ID navigates to Tab 3, scrolls to that annotation; clicking event EVT-ID navigates to Tab 2, expands that event row
- **`[view →]` on linked incident:** navigates to IC surface in a new tab; does not navigate replay workspace

---

### Disabled-State Behavior

- No edit, modify, or delete controls on any finding
- `[Supersede this finding]` is the only action on a submitted finding
- UNSUPPORTED badge and warning text are not collapsible; they are permanent on UNSUPPORTED findings
- No incident state transition controls anywhere (no "mark incident resolved", no "escalate")

---

### Replay-State Behavior

Identical to WF-RP-03/04. All findings reference historical corpus events; no finding write modifies live state.

---

### Degraded-State Behavior

- **Corpus unavailable:** Findings tab remains fully available; existing findings readable; new findings may be submitted; evidence citation IDs may be entered manually but cannot be browsed
- **Cited event unavailable:** finding card shows "Event e_0928a1 (corpus record unavailable at this time)" — finding itself remains valid

---

### Incident-State Behavior

- Closure constraint notice rendered prominently at top of RP-MAIN (as shown above)
- Zone C contradiction panel shows red "CLOSURE BLOCKED" badge when unresolved contradictions exist
- If all contradictions resolved and a CONFIRMED finding with evidence exists: closure notice updates to show all checks `✓`; no automatic incident transition is triggered from this surface

---

### Accessibility Notes

- Finding cards: role="article"; aria-label="Finding [F-ID] by [author], [confidence], [class or unclassified]"
- UNSUPPORTED badge: role="alert" on first render; aria-label="This finding is unsupported — no evidence citations provided"
- Closure constraint notice: role="status"; live count of unresolved contradictions announced when changed
- Write form `[Submit finding]` button: aria-describedby pointing to the UNSUPPORTED warning text if evidence_basis is empty

---

## WF-RP-06: Replay Investigation — OPERATOR — POST_INCIDENT — Tab 5 (Findings & Annotations) — adding finding

**ID:** WF-RP-06
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1#corpus-diff
**Role:** OPERATOR
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 5 — Corpus Diff
**Purpose:** OPERATOR is reviewing the Corpus Diff tab to examine the parity ratio and identify the exact divergence zones on each screen, before correlating with the override event.

Note: Per the canonical spec, Tab 5 is the Corpus Diff tab (URL `#corpus-diff`). This wireframe covers Tab 5 as specified in the canonical document.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      J. Rangi ▾  [?]  [🔔 3]      │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi (you)   Also here: M. Chen [⋯]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations] [Findings] [Corpus Diff★]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [swim lanes — playhead at 16:23:41]                                             │  INC-2026-0528-001        │
│                           │  Range: [═══════════════════════════════════════════════════] [Clear range]        │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │                                                                                   │  [View incident →]        │
│ Investigations            │  RP-MAIN ─── Tab 5: Corpus Diff ───────────────────────────────────────────────  │                           │
│ ▶ INV-2026-0601-abc1      │                                                                                   │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  Corpus Diff — The Parklands Golf Club — 2026-05-28 14:00 – 19:45 AEST           │  Evidence collected       │
│                           │                                                                                   │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  ┌─ Parity summary ────────────────────────────────────────────────────────┐    │  Findings:     2          │
│ Incidents (read-only)     │  │ Parity ratio: 94.1%  [amber — below 95% threshold]                      │    │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  │ Divergence found in: 23 / 412 resolution windows                         │    │  Corpus events: 5         │
│  [→ View on IC surface]   │  │                                                   [Download corpus diff as CSV] │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘    │  ─────────────────────    │
│ ─────────────────────     │                                                                                   │  Unresolved ⚠             │
│ Notification Tray         │  Screen B1:                                                                       │  2 contradictions         │
│  [🔔 3 notifications]     │  EXPECTED  ──────────────────────────────────────────────────────────────────    │  [Resolve now →]          │
│                           │  ACTUAL    ────────────────────────────────────░░░░░░░░░░░──────────────────    │                           │
│ ─────────────────────     │                                                 ↑ 16:23–17:12                     │  ─────────────────────    │
│ Operator Tools            │                                                 Divergence zone                    │  Session collaborators    │
│  [Browse investigations]  │                                                 ◆ PRE_DIVERGENCE                  │  J. Rangi (you — owner)   │
│  [New investigation]      │                                                                                   │  Active now               │
│                           │  Screen B2:                                                                       │  M. Chen                  │
│                           │  EXPECTED  ──────────────────────────────────────────────────────────────────    │  Active now               │
│                           │  ACTUAL    ────────────────────────────────────░░░░░░░░░░░░░░░░──────────────    │                           │
│                           │                                                 ↑ 16:23–18:34                     │                           │
│                           │                                                 ◆ PRE_DIVERGENCE events (3)       │                           │
│                           │                                                                                   │                           │
│                           │  Screen B3:                                                                       │                           │
│                           │  EXPECTED  ──────────────────────────────────────────────────────────────────    │                           │
│                           │  ACTUAL    ──────────────────────────────────────────────────────────────────    │                           │
│                           │                                                 (No divergence)                   │                           │
│                           │                                                                                   │                           │
│                           │  Screen B4:                                                                       │                           │
│                           │  EXPECTED  ──────────────────────────────────────────────────────────────────    │                           │
│                           │  ACTUAL    ─────────────────────────────████████████████────────────────────    │                           │
│                           │                                          ↑ 16:23–19:45                            │                           │
│                           │                                          No delivery confirmation                 │                           │
│                           │                                                                                   │                           │
│                           │  [─── Divergence zone detail panel (expanded) ────────────────────────────────]  │                           │
│                           │  Screen B2  ·  16:23 – 18:34                                                     │                           │
│                           │  ┌──────────────────────────────────────────────────────────────────────────┐   │                           │
│                           │  │ Expected (PRE resolution output):                                        │   │                           │
│                           │  │   Winning level: L3 (Campaign)                                          │   │                           │
│                           │  │   Content: Campaign_Club_General                                         │   │                           │
│                           │  │   Resolution source: pre-engine-01                                       │   │                           │
│                           │  │                                                                          │   │                           │
│                           │  │ Actual (delivery record):                                                │   │                           │
│                           │  │   Content delivered: Club_Sponsor_B (OVR-0442)                           │   │                           │
│                           │  │   Delivery confirmed: YES                                                │   │                           │
│                           │  │   Trust state (at event time): RECOVERED_BUT_UNTRUSTED  (historical)     │   │                           │
│                           │  │                                                                          │   │                           │
│                           │  │ PRE_DIVERGENCE event payload:                                            │   │                           │
│                           │  │   Event e_1092f3  ·  2026-05-28 16:23:41                                 │   │                           │
│                           │  │   Override OVR-0442 overriding scheduled campaign resolution             │   │                           │
│                           │  └──────────────────────────────────────────────────────────────────────────┘   │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Corpus Diff Visual Legend

```
──────────────────────────────────────────────────  Delivery matching expected (no divergence)
░░░░░░░░░░░░░░  Amber hatching — expected ≠ actual (delivered different content than PRE computed)
████████████  Red fill — no delivery confirmation (expected content, device did not report delivery)
◆  Red diamond — PRE_DIVERGENCE event at this timestamp, consistent with Tab 1 marker
```

---

### Parity Ratio Colour Rules

| Value | Display colour | Threshold |
|---|---|---|
| 100% | Green | Perfect parity |
| 95%–99.9% | Amber | Below ideal |
| 85%–94.9% | Amber | Below 95% threshold (current: 94.1%) |
| <85% | Red | Critical divergence |

---

### Tab 5 Disabled State (No Divergence Report)

If no `divergence_report` is associated with this session:
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                     │
│    No divergence report is associated with this investigation session.                              │
│                                                                                                     │
│    Corpus Diff is available when a divergence_report is linked to this session.                     │
│    A divergence_report is automatically attached when a DIVERGENCE session is created,              │
│    or when an operator manually attaches one.                                                       │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Tab is visible in the tab strip but content area shows this message. Tab label is not greyed out — it is accessible but shows the above panel.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | |
| SessionHeader | 72px | PAUSED |
| ReplayBanner | 28px amber | |
| TabStrip | 48px | Tab 5 active (Corpus Diff) |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | Always visible |
| ParitySummaryPanel | Top of RP-MAIN | Ratio + divergence count + CSV download |
| ScreenDiffRows | Below summary, scrollable | One EXPECTED + ACTUAL row pair per screen |
| PlayheadMarkerOnDiff | Vertical dashed line on EXPECTED/ACTUAL rows | Aligned with RP-TIMELINE playhead |
| DivergenceDetailPanel | Below screen rows (expanded on zone click) | Expected vs actual comparison |
| DownloadCSVButton | Top-right of parity summary | `[Download corpus diff as CSV]` |
| ZoneC | Right 280px | |

---

### Interaction Notes

- **Click divergence zone (amber `░` area):** opens divergence detail panel below the screen rows showing expected vs actual comparison
- **Click PRE_DIVERGENCE marker (`◆`):** opens detail panel showing the PRE_DIVERGENCE event payload
- **`[Download corpus diff as CSV]`:** downloads CSV with columns: timestamp, screen_id, expected_content_id, expected_resolution_level, actual_content_id, delivered_confirmed, divergence; emits `replay:corpus_diff:downloaded` audit event; no other side effects
- **Scroll:** screen rows scroll independently within RP-MAIN; RP-TIMELINE stays fixed
- **Zoom on screen rows:** horizontal zoom on screen rows is synchronised with RP-TIMELINE zoom
- **Close detail panel:** click outside the panel or press `Esc`

---

### Disabled-State Behavior

No live write controls anywhere. `[Download corpus diff as CSV]` is a read-only export. Counterfactual results are never interspersed with corpus events in this view.

---

### Replay-State Behavior

- A vertical dashed line on the screen diff rows corresponds to the current playhead position, aligned with RP-TIMELINE
- Divergence zones ahead of the current playhead position may be shown at slightly reduced opacity; zones at or before the playhead are at full opacity

---

### Degraded-State Behavior

- **Corpus unavailable:** Tab 5 disabled: "Corpus data required — Corpus Diff cannot be loaded."
- **Partial delivery data missing:** affected screen rows show "Delivery confirmation data incomplete for this period" in amber text within the ACTUAL row for the affected period
- **`trust_state_at_event` absent:** divergence detail panel shows trust state as "UNKNOWN (historical trust data unavailable)" in amber

---

### Incident-State Behavior

- Divergence zones within the incident period carry an orange `INC` badge on the ACTUAL row
- No incident action controls in this tab

---

### Accessibility Notes

- Screen diff rows: each screen is a labeled section with aria-label="Screen [ID] delivery comparison"
- EXPECTED and ACTUAL rows: aria-label="Expected delivery for screen [ID]" and "Actual delivery for screen [ID]"
- Divergence zone: aria-label="Divergence zone [start]–[end]: expected [content] not delivered — click to expand detail"
- Red fill zone: aria-label="No delivery confirmation for screen [ID] from [start] to [end]"
- `[Download corpus diff as CSV]` aria-label="Download full corpus diff for this session as CSV file"
- PRE_DIVERGENCE marker `◆`: aria-label="PRE divergence event at [timestamp] — click to view"
- Detail panel: role="dialog" aria-modal="false"; `Esc` closes

---

## WF-RP-07: Replay Investigation — ADMIN — POST_INCIDENT — Tab 6 (Counterfactual Analysis) — ADMIN only

**ID:** WF-RP-07
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1#counterfactual
**Role:** ADMIN
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 6 — Counterfactual (ADMIN only)
**Purpose:** ADMIN is running a counterfactual analysis to determine what PRE would have resolved if the override stack depth had been 1 instead of 3 at the incident peak timestamp.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                     S. Kapoor (ADMIN) ▾  [?]  [🔔] │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi   Also here: M. Chen [⋯]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations] [Findings] [Corpus Diff] [Counterfactual]                                                        │ 48px — 6 tabs for ADMIN
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [swim lanes — playhead at 16:23:41]                                             │  INC-2026-0528-001        │
│                           │  Range: [═══════════════════════════════════════════════════] [Clear range]        │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │                                                                                   │  [View incident →]        │
│ Investigations            │  RP-MAIN ─── Tab 6: Counterfactual ─────────────────────────────────────────── │                           │
│ ▶ INV-2026-0601-abc1      │                                                                                   │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  ┌─ HYPOTHETICAL ANALYSIS header ──────────────────────────────────────────────┐  │  Evidence collected       │
│                           │  │ HYPOTHETICAL ANALYSIS — Results are advisory only.                           │  │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  │ They do not change the corpus. Running a counterfactual generates            │  │  Findings:     2          │
│ Incidents (read-only)     │  │ an audit event before execution.                                             │  │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  └────────────────────────────────────────────────────────────────────────────┘  │  Corpus events: 5         │
│  [→ View on IC surface]   │                                                                                   │                           │
│                           │  ┌─ Counterfactual parameters ─────────────────────────────────────────────────┐  │  ─────────────────────    │
│ ─────────────────────     │  │                                                                             │  │  Session collaborators    │
│ Notification Tray         │  │ Base event:                                                                 │  │  J. Rangi (session owner) │
│  [🔔 0 notifications]     │  │   [e_0928a1 — PRE resolution at 2026-05-28 16:23:41 ▾]                      │  │  Active now               │
│                           │  │   Currently selected: e_0928a1 — PRE resolution at 2026-05-28 16:23:41      │  │  M. Chen                  │
│ ─────────────────────     │  │                                                                             │  │  Active now               │
│ Operator Tools            │  │ Modified parameters:                                                        │  │  S. Kapoor (you)          │
│  [Browse investigations]  │  │   Parameter                  Original value   Hypothetical value            │  │  Active now               │
│  [New investigation]      │  │   override_stack_depth        3                [1          ]                 │  │                           │
│                           │  │   campaign_priority_weight    1.0              [___________]                 │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │   [+ Add parameter]                                                         │  │                           │
│                           │  │   (Only parameters present in the base_input schema may be added)           │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │   [Run counterfactual]                                                      │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ HYPOTHETICAL RESULT ───────────────────────────────────────────────────────┐  │                           │
│                           │  │ HYPOTHETICAL RESULT — This did not occur. This is a simulation.             │  │                           │
│                           │  │ ─────────────────────────────────────────────────────────────────────────── │  │                           │
│                           │  │ Run ID: CF-2026-0601-001    Run by: S. Kapoor    Run at: 2026-06-01 10:58   │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ Modified: override_stack_depth: 3 → 1                                       │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ Counterfactual PRE output:                                                  │  │                           │
│                           │  │   Winning level: L3 (Campaign)                                             │  │                           │
│                           │  │   Winning content: Campaign_Club_General                                    │  │                           │
│                           │  │   (vs actual: L1 Override — OVR-0442 — Club_Sponsor_B)                     │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ Interpretation: Under the hypothetical configuration,                       │  │                           │
│                           │  │ Campaign_Club_General would have won on screen B2 at this resolution        │  │                           │
│                           │  │ point.                                                                      │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │  [Cite in finding]   [Run another counterfactual]                           │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Counterfactual history (this session) ────────────────────────────────────┐  │                           │
│                           │  │ CF-2026-0601-001  S. Kapoor  10:58:22  override_stack_depth: 3→1  [view]   │  │                           │
│                           │  │ CF-2026-0601-002  S. Kapoor  11:03:45  campaign_priority_weight: 1→0.5 [view] │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Critical Implementation Rule: Tab 6 for Non-ADMIN

```
NON-ADMIN OPERATOR sees this tab strip (5 tabs only — Tab 6 absent from DOM):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Timeline] [Event Stream] [Annotations] [Findings] [Corpus Diff]                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

ADMIN sees this tab strip (6 tabs):
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Timeline] [Event Stream] [Annotations] [Findings] [Corpus Diff] [Counterfactual]                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Tab 6 MUST NOT appear for non-ADMIN in any form:**
- Not as a disabled tab
- Not as a greyed-out tab
- Not as a tab with a lock icon
- Not as a tab with "upgrade" or "contact admin" messaging
- Not as a gap in the tab list
- Not as a hidden element that affects tab list layout

If a non-ADMIN navigates to `#counterfactual` directly: render a blank panel — no error text, no explanation of what the panel is.

---

### HYPOTHETICAL ANALYSIS Header (always visible in Tab 6)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HYPOTHETICAL ANALYSIS — Results are advisory only.                                                 │
│  They do not change the corpus.                                                                     │
│  Running a counterfactual generates an audit event (COUNTERFACTUAL_RUN) before execution.           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Background: distinct from the form area; amber-tinted info panel
- Cannot be collapsed or dismissed
- Appears 3 times: (1) at form header, (2) at top of result panel, (3) when `[Cite in finding]` is clicked

---

### Counterfactual Parameters Form Detail

```
Base event selector:
  [Dropdown ▾] — lists all PRE resolution events in the session corpus
  Selected: e_0928a1 — PRE resolution at 2026-05-28 16:23:41

Modified parameters table:
  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
  │  Parameter                  │  Original value  │  Hypothetical value                         │
  ├──────────────────────────────────────────────────────────────────────────────────────────────┤
  │  override_stack_depth        │  3               │  [1          ]  (text input)                │
  │  campaign_priority_weight    │  1.0             │  [___________]  (text input, empty)         │
  └──────────────────────────────────────────────────────────────────────────────────────────────┘

  [+ Add parameter]
  Note: Only parameters from the original base_input schema may be added.
  Entering a parameter name not in the base_input is not permitted (dropdown-only selection).

  [Run counterfactual]
  (button is primary action; generates COUNTERFACTUAL_RUN audit event before execution)
```

---

### Hypothetical Result Panel (post-run)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HYPOTHETICAL RESULT — This did not occur. This is a simulation.                                    │
│  ──────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                     │
│  Run ID: CF-2026-0601-001   Run by: S. Kapoor   Run at: 2026-06-01 10:58:22 AEST                   │
│                                                                                                     │
│  Base event: e_0928a1 — PRE resolution at 2026-05-28 16:23:41                                       │
│  Modified: override_stack_depth: 3 → 1                                                              │
│                                                                                                     │
│  Counterfactual PRE output:                                                                         │
│    Winning level:    L3 (Campaign)                                                                  │
│    Winning content:  Campaign_Club_General                                                          │
│    (vs actual:       L1 Override — OVR-0442 — Club_Sponsor_B)                                      │
│                                                                                                     │
│  Interpretation:                                                                                    │
│  Under the hypothetical configuration, Campaign_Club_General would have won on screen B2            │
│  at this resolution point.                                                                          │
│                                                                                                     │
│   [Cite in finding]    [Run another counterfactual]                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- "HYPOTHETICAL RESULT — This did not occur. This is a simulation." always at top, large text, amber background strip
- Results are not displayed in the event stream or timeline; they are isolated to this panel
- Counterfactual results cannot be promoted to corpus annotations
- `[Cite in finding]` opens Tab 4 write form pre-populated with counterfactual_result summary and a notice: "You are citing a counterfactual result. Your finding text must make clear this is a hypothetical, not a description of what actually happened."
- `[Run another counterfactual]` resets the form fields; prior result remains in the history log

---

### Counterfactual History Log

```
┌─ Counterfactual history (this session) ─────────────────────────────────────────────────────────────┐
│  CF-2026-0601-001   S. Kapoor   10:58:22   override_stack_depth: 3→1                 [view]         │
│  CF-2026-0601-002   S. Kapoor   11:03:45   campaign_priority_weight: 1.0→0.5         [view]         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Always appended; never truncated or cleared within a session
- `[view]` loads that run's parameters and result into the display panel
- History is limited to this investigation session; does not show counterfactuals from other sessions

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | Role shows "(ADMIN)" |
| SessionHeader | 72px | Owner: J. Rangi (not current user); current user is S. Kapoor (ADMIN collaborator) |
| ReplayBanner | 28px amber | |
| TabStrip | 48px | 6 tabs for ADMIN; Tab 6 active |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | Always visible |
| HypotheticalHeader | Top of RP-MAIN, always visible in Tab 6 | Advisory notice, not dismissible |
| CounterfactualForm | Below header | Base event selector + parameters table + run button |
| ResultPanel | Below form (after run) | HYPOTHETICAL RESULT header + output + cite/run-another |
| HistoryLog | Below result panel | Audit trail of all runs this session |
| ZoneC | Right 280px | Shows ADMIN as a collaborator |

---

### Interaction Notes

- **`[Run counterfactual]`:** generates `investigation:counterfactual:run` audit event immediately before executing; run is not cancellable once started; results appear below the form
- **Base event dropdown:** lists only PRE_RESOLVE events in corpus; other event types not selectable
- **`[+ Add parameter]`:** opens dropdown of parameter names from the base_input schema; free-text entry of parameter names is not permitted
- **`[Cite in finding]`:** switches to Tab 4, opens finding write form pre-populated with counterfactual_result summary; shows advisory notice about hypothetical nature
- **`[view]` in history:** restores that run's parameters and result; form is repopulated; result panel shows that run's output
- **`[Run another counterfactual]`:** clears form fields; result panel clears; prior run is preserved in history log

---

### Disabled-State Behavior

- `[Run counterfactual]` is disabled with "Corpus data required to run counterfactual." when corpus is unavailable
- `[Cite in finding]` is only available after a successful run
- Tab 6 itself is absent from non-ADMIN operators' DOM (not disabled — not rendered)

---

### Replay-State Behavior

- Running a counterfactual does not advance the playhead or modify the corpus in any way
- Results are never shown in the RP-TIMELINE swim lanes or the Tab 2 event stream
- Results exist only within Tab 6 and the history log

---

### Degraded-State Behavior

- **Corpus unavailable:** `[Run counterfactual]` disabled; history log of prior runs still viewable; `[view]` on history items shows the prior result without re-running
- **Base event not found:** "Selected event e_0928a1 could not be loaded from corpus. Please select a different event."

---

### Incident-State Behavior

Identical across all tabs. No incident action controls. Linked incident visible in Zone C as read-only.

---

### Accessibility Notes

- Tab 6 label: rendered in tab strip for ADMIN only; aria-label="Counterfactual analysis — ADMIN only"
- HYPOTHETICAL RESULT header: role="alert" on first render after a run
- History log: role="log" aria-live="polite" — new entries announced when added
- `[Run counterfactual]` aria-label="Run counterfactual analysis — generates audit event before execution"
- Parameter input fields: aria-label="Hypothetical value for [parameter_name] (original: [original_value])"
- Base event dropdown: aria-label="Select PRE resolution event to run counterfactual against"

---

## WF-RP-08: Replay Investigation — VIEWER — any session — read-only (no annotation write, no Tab 6)

**ID:** WF-RP-08
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1
**Role:** VIEWER
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 3 — Annotations
**Purpose:** VIEWER is reading annotations and findings written by other operators; the VIEWER role has no write access and sees no annotation write controls, no finding submit button, and no Tab 6.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                     R. Patel (VIEWER) ▾  [?]  [🔔] │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi   Also here: M. Chen [⋯]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations★] [Findings] [Corpus Diff]                                                                        │ 48px — 5 tabs (no Tab 6)
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  INC-2026-0528-001        │
│                           │  [swim lanes — playhead at 16:23:41]                                             │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │  Range: [═══════════════════════════════════════════════════] [Clear range]        │  [View incident →]        │
│ Investigations            │                                                                                   │                           │
│ ▶ INV-2026-0601-abc1      │  RP-MAIN ─── Tab 3: Annotations (VIEWER — read-only) ───────────────────────── │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │                                                                                   │  Evidence collected       │
│                           │  ┌─ Sort and filter ───────────────────────────────────────────────────────────┐  │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  │ Sort: [authored_at desc★] [authored_at asc] [anchor time] [author] [conf.]  │  │  Findings:     2          │
│ Incidents (read-only)     │  │ Filter: Author [All ▾]  Confidence [All ▾]  Anchor [All ▾]                  │  │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │  │ [ ] Show SUPERSEDED  (2 superseded annotations hidden — [Show all])         │  │  Corpus events: 5         │
│  [→ View on IC surface]   │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │  ─────────────────────    │
│ ─────────────────────     │  (No [+ Write annotation] button — absent from DOM for VIEWER role)              │  Session collaborators    │
│ Notification Tray         │                                                                                   │  J. Rangi (session owner) │
│  [🔔 0 notifications]     │  7 annotations (5 active)                                                        │  Active now               │
│                           │                                                                                   │  M. Chen                  │
│ ─────────────────────     │  ┌─ Annotation ANN-0029 ───────────────────────────────────────────────────────┐  │  Active now               │
│ Operator Tools            │  │ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST               │  │  R. Patel (you)           │
│  [Browse investigations]  │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41            │  │  Active now               │
│                           │  │                                                                             │  │                           │
│  (No override controls)   │  │ "The L1 override OVR-0442 was winning at this timestamp and suppressing     │  │                           │
│  (No write controls)      │  │  Campaign_Club_General. This matches the observed blackout on screen B2."   │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ Cited in: Finding F-003            [IMMUTABLE — written 2026-06-01]         │  │                           │
│                           │  │  (No [Supersede this annotation] button — absent for VIEWER role)           │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Annotation ANN-0025 (CONTRADICTION) ──────────────────────────────────────┐  │                           │
│                           │  │ [PROBABLE] ●  M. Chen  ·  Written: 2026-06-01 08:32:05 AEST                │  │                           │
│                           │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41           │  │                           │
│                           │  │ [! CONTRADICTION DETECTED]                                                  │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ "The override stack at 16:23 was 3 levels deep..."                          │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │                                      [IMMUTABLE — written 2026-06-01]       │  │                           │
│                           │  │  (No [Supersede this annotation] — absent for VIEWER)                       │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  ┌─ Contradiction detail (read-only for VIEWER) ──────────────────────────────┐  │                           │
│                           │  │ Contradiction detected                                                     │  │                           │
│                           │  │ Between: ANN-0025 (M. Chen) and ANN-0027 (J. Rangi)                        │  │                           │
│                           │  │ Anchor: Event e_0928a1 at 2026-05-28 16:23:41                              │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ These annotations make conflicting observations about the same event.       │  │                           │
│                           │  │ Resolution requires an operator with write access.                          │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │  (No [Resolve by annotation], [Resolve by finding], [Dismiss reminder]     │  │                           │
│                           │  │   buttons — all absent for VIEWER role)                                    │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### VIEWER Role: Complete Differential from OPERATOR

The following table documents every element that is ABSENT for VIEWER that is present for OPERATOR.

| Element | OPERATOR | VIEWER | Location |
|---|---|---|---|
| `[+ Write annotation]` button | Present | **Absent from DOM** | Tab 3 top |
| `[Supersede this annotation]` button | Present per annotation | **Absent from DOM** | Each annotation card |
| `[Annotate this event]` button | Present | **Absent from DOM** | Tab 1 event detail, Tab 2 expanded row |
| `[Resolve by annotation]` button | Present in contradiction detail | **Absent from DOM** | Contradiction detail panel |
| `[Resolve by finding]` button | Present in contradiction detail | **Absent from DOM** | Contradiction detail panel |
| `[Dismiss reminder]` button | Present in contradiction detail | **Absent from DOM** | Contradiction detail panel |
| `[+ Submit finding]` button | Present | **Absent from DOM** | Tab 4 top |
| `[Supersede this finding]` button | Present per finding | **Absent from DOM** | Each finding card |
| Tab 6 (Counterfactual) | Absent (not ADMIN) | **Absent from DOM** | Tab strip |
| `[⋯ Session actions ▾]` dropdown | Present | **Absent from DOM** | Session header right |
| `[Link to incident]` in Zone C | Present (session owner/ADMIN) | **Absent from DOM** | Zone C |

"Absent from DOM" means not rendered. Not disabled, not greyed out. The card layouts and content panels render normally, minus the write and action controls.

---

### VIEWER Annotation Card (no write controls)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST                                       │
│ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41  [jump to event →]                 │
│                                                                                                     │
│ "The L1 override OVR-0442 was winning at this timestamp and suppressing Campaign_Club_General.       │
│  This matches the observed blackout on screen B2."                                                  │
│                                                                                                     │
│ Cited in: Finding F-003  [view →]                         [IMMUTABLE — written 2026-06-01]           │
│                                                                                                     │
│ (No [Supersede this annotation] button)                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- `[IMMUTABLE — written YYYY-MM-DD]` badge: always present (same for all roles)
- No `[Supersede this annotation]`: absent from DOM for VIEWER
- Text remains selectable/copyable

---

### VIEWER Contradiction Detail (no resolution controls)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Contradiction detected                                                                              │
│ Between: ANN-0025 (M. Chen) and ANN-0027 (J. Rangi)                                                 │
│ Anchor: Event e_0928a1 at 2026-05-28 16:23:41                                                       │
│                                                                                                     │
│ These annotations make conflicting observations about the same event.                               │
│ Resolution requires an operator with write access.                                                  │
│                                                                                                     │
│ (No [Resolve by annotation], [Resolve by finding], or [Dismiss reminder] buttons)                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### VIEWER on Tab 2 (Event Stream) — No Annotate Control

```
Expanded event row for VIEWER:
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ │CORPUS│  [PRE_RESOLVE · blue]   2026-05-28 16:23:41 AEST   pre-engine-01              ▲ collapse   │
│                                                                                                      │
│ Full payload JSON (read-only)...                                                                     │
│                                                                                                      │
│ Annotations on this event (2):                                                                       │
│   🔖 ANN-0029  CONFIRMED  J. Rangi                                                                   │
│   🔖 ANN-0025  PROBABLE  M. Chen  [! CONTRADICTION]                                                  │
│                                                                                                      │
│  (No [Annotate this event] button — absent for VIEWER)                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### VIEWER on Tab 1 (Timeline) — No Annotate Control

```
RP-MAIN event detail panel for VIEWER:
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Event ID: e_0928a1   Type: PRE_RESOLVE   Timestamp: 2026-05-28 16:23:41 AEST                         │
│ Source: pre-engine-01                                                                                │
│ Trust state (at event time): RECOVERED_BUT_UNTRUSTED  (historical)                                   │
│                                                                                                      │
│ Payload (collapsed) ▶                                                                               │
│                                                                                                      │
│ Annotations on this event:                                                                           │
│   🔖 ANN-0029 · J. Rangi · CONFIRMED  "The L1 override OVR-0442..."  [view]                         │
│                                                                                                      │
│  (No [Annotate this event] button — absent for VIEWER)                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### VIEWER Playback Controls

VIEWER retains full playback control (play/pause, scrub, speed, seek). Playback is a read action; it does not modify any state.

```
Retained for VIEWER:
  [◁◁] [◁] [⏸/▶] [▶] [▶▶]   [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]
  Timeline click-to-seek
  Timeline drag-to-scrub
  Range selector handles
  [Clear range]
  All tab switching
  All filter controls (Tab 2, Tab 3)
  [Download corpus diff as CSV] (Tab 5)
```

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | Role shown as "(VIEWER)" |
| SessionHeader | 72px | `[⋯ Session actions ▾]` absent for VIEWER |
| ReplayBanner | 28px amber | Identical |
| TabStrip | 48px | 5 tabs; Tab 6 absent from DOM |
| ZoneA | Left 280px | No write controls; nav available |
| RP-TIMELINE | Upper ~25% Zone B | Full playback controls available |
| SortFilterBar | Tab 3 top | Available to VIEWER |
| AnnotationList | Scrollable | Cards without supersede/write controls |
| ContradictionDetail | Below contradiction pair | Read-only; no resolution buttons |
| ZoneC | Right 280px | `[Link to incident]` absent; collaborators list shows VIEWER presence |

---

### Interaction Notes

- VIEWER may navigate all 5 tabs freely
- VIEWER may use all playback controls
- VIEWER may use all filter controls (Tab 2, Tab 3)
- VIEWER may expand/collapse event rows in Tab 2
- VIEWER may download corpus diff CSV in Tab 5
- VIEWER may not write, supersede, or submit any annotation, finding, or contradiction resolution
- VIEWER navigating to `#counterfactual`: blank panel, no explanation

---

### Disabled-State Behavior

All live write controls are absent from the DOM. No write affordances are shown in a disabled state.

---

### Replay-State Behavior

Identical to OPERATOR replay state behaviour for all read operations.

---

### Degraded-State Behavior

Identical to OPERATOR degraded-state behaviour for Tab 1, Tab 2, Tab 5. Tabs 3 and 4 remain fully readable.

---

### Incident-State Behavior

Identical to OPERATOR incident-state display. No incident action controls for any role on this surface.

---

### Accessibility Notes

- Role indicator "(VIEWER)" in system status bar: aria-label includes role
- Absent write buttons do not generate empty aria placeholders; they simply do not exist in the DOM
- Read-only annotation cards: aria-label="Annotation [ANN-ID] by [author], [confidence] — read only"
- Contradiction detail: aria-label includes "Resolution requires write access" when VIEWER is viewing

---

## WF-RP-09: Replay Investigation — OPERATOR — DIVERGENCE session type — corpus hash mismatch highlighted

**ID:** WF-RP-09
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_div_002
**Role:** OPERATOR
**Session type:** DIVERGENCE
**Playhead state:** PAUSED
**Active tab:** Tab 5 — Corpus Diff
**Purpose:** OPERATOR is investigating a DIVERGENCE session triggered automatically by a parity divergence event; the tab strip defaults to Tab 5 (Corpus Diff) for DIVERGENCE session types; a corpus hash mismatch is highlighted in the Corpus Diff view.

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                     J. Rangi ▾  [?]  [🔔 5]        │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0602-div2    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-06-02 09:14:00 AEST → 2026-06-02 09:44:00 AEST    Type: DIVERGENCE     Playhead: 2026-06-02 09:22:18 AEST               │ 72px
│ Divergence report: DIV-2026-0602-001                                                     Owner: J. Rangi (you)                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠  DIVERGENCE SESSION — This investigation was triggered by a parity divergence event. Corpus hash mismatch detected.                    │ 28px red banner
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations] [Findings] [Corpus Diff★]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Divergence report        │
│ The Parklands Golf Club ▾ │                                                                                   │  DIV-2026-0602-001        │
│                           │  [◁◁] [◁] [⏸] [▶] [▶▶]  [0.25x] [0.5x] [1x★] [2x] [4x]   [−] [+] [Fit all]   │  Triggered: 09:22:18      │
│ ─────────────────────     │                                                                                   │  Class: PRE_DIVERGENCE    │
│ Investigations            │  09:14       09:18    09:22▼     09:26       09:30       09:37       09:44        │                           │
│ ▶ INV-2026-0602-div2      │  PRE  ●──────────────────◆──────────────────────────────────────────────────   │  ─────────────────────    │
│   DIVERGENCE  ACTIVE      │  OVRD ──────────────────────────────────────────────────────────────────────   │  Corpus hash mismatch     │
│                           │  DEVH ──────────────────────────────────────────────────────────────────────   │  Expected:  a3f2b8c1...   │
│ ─────────────────────     │  EMRG ──────────────────────────────────────────────────────────────────────   │  Actual:    9d1e44f7...   │
│ Incidents (read-only)     │  ANNO ──────────────────────────────────────────────────────────────────────   │  At: 09:22:18 AEST        │
│  (none linked)            │                                                                                   │  [! HASH MISMATCH]        │
│                           │  Range: [═══════════════════════════════════════════════════] [Clear range]        │                           │
│ ─────────────────────     │                                                                                   │  ─────────────────────    │
│ Notification Tray         │  RP-MAIN ─── Tab 5: Corpus Diff ───────────────────────────────────────────────  │  Evidence collected       │
│  [🔔 5 notifications]     │                                                                                   │  Annotations:  0          │
│                           │  ┌─ Parity summary ────────────────────────────────────────────────────────┐    │  Findings:     0          │
│ ─────────────────────     │  │ Parity ratio: 71.3%  [RED — below 85% critical threshold]               │    │  Contradictions: 0        │
│ Operator Tools            │  │ Divergence found in: 82 / 289 resolution windows                         │    │  Corpus events: 0 cited   │
│  [Browse investigations]  │  │ Corpus hash mismatch: DETECTED at 09:22:18  [! HASH MISMATCH]           │    │                           │
│  [New investigation]      │  │                                              [Download corpus diff as CSV] │    │  ─────────────────────    │
│                           │  └────────────────────────────────────────────────────────────────────────────┘    │  Session collaborators    │
│                           │                                                                                   │  J. Rangi (you — owner)   │
│                           │  ┌─ Hash mismatch detail ────────────────────────────────────────────────────┐  │  Active now               │
│                           │  │ ⚠  CORPUS HASH MISMATCH                                                   │  │                           │
│                           │  │    At timestamp: 2026-06-02 09:22:18 AEST                                 │  │                           │
│                           │  │    Expected hash: a3f2b8c1d9e4f501a2b3c4d5e6f78901                        │  │                           │
│                           │  │    Actual hash:   9d1e44f7a8b2c3d4e5f6a7b8c9d0e1f2                        │  │                           │
│                           │  │    Divergence class: PRE_DIVERGENCE                                        │  │                           │
│                           │  │    Source: pre-engine-01 at resolution tick 09:22:18                       │  │                           │
│                           │  │                                                                            │  │                           │
│                           │  │    This mismatch indicates the corpus record at this resolution tick       │  │                           │
│                           │  │    does not match the expected deterministic output. This requires         │  │                           │
│                           │  │    investigation. Annotate the event or submit a finding to record your    │  │                           │
│                           │  │    analysis.                                                               │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
│                           │  Screen B1:                                                                       │                           │
│                           │  EXPECTED  ────────────────────────────────────────────────────────────────   │                           │
│                           │  ACTUAL    ──────────────────────░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░────────   │                           │
│                           │                                  ↑ 09:22–09:37                                │                           │
│                           │                                  Divergence zone  ◆ hash mismatch here        │                           │
│                           │                                                                                   │                           │
│                           │  Screen B2:                                                                       │                           │
│                           │  EXPECTED  ────────────────────────────────────────────────────────────────   │                           │
│                           │  ACTUAL    ──────────────────────░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░───   │                           │
│                           │                                  ↑ 09:22–09:44                                │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### DIVERGENCE Session Banner (additional, below REPLAY banner)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  DIVERGENCE SESSION — This investigation was triggered by a parity divergence event. Corpus hash mismatch detected.                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Background: red (`--color-divergence-banner-bg`)
- Text: white, 13px
- This is a second banner, stacked below the amber REPLAY banner
- Both banners visible simultaneously; neither is dismissible
- DIVERGENCE banner is only present for `session_type: DIVERGENCE`

---

### Session Header: DIVERGENCE-specific fields

```
┌─ LEFT ──────────────────────────────────────────────────────────────┬─ CENTRE ─────────────────────────────────────────────────────┬─ RIGHT ─────────────────────────┐
│ [INVESTIGATION] INV-2026-0602-div2                                  │ ⏸ PAUSED                                                    │ Owner: J. Rangi (you)           │
│ Venue: The Parklands Golf Club [↗]                                  │ Speed: [0.25x] [0.5x] [1x★] [2x] [4x]                      │                                 │
│ Time range: 2026-06-02 09:14 → 09:44 AEST   Type: DIVERGENCE        │ Playhead: 2026-06-02 09:22:18 AEST                          │ [⋯ Session actions ▾]           │
│ Divergence report: DIV-2026-0602-001                                │                                                             │                                 │
└─────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

- `Divergence report: DIV-2026-0602-001` is an additional field shown only for DIVERGENCE session types
- Clicking the divergence report ID is not interactive (displayed as text)

---

### Zone C: Divergence Report Panel (replaces linked incident for DIVERGENCE sessions)

```
┌─────────────────────────────────────────────────────┐
│  Divergence report                                  │
│  DIV-2026-0602-001                                  │
│  Triggered: 2026-06-02 09:22:18 AEST                │
│  Class: PRE_DIVERGENCE                              │
│                                                     │
│  ─────────────────────────────────────────          │
│  Corpus hash mismatch                               │
│  Expected:  a3f2b8c1d9e4...                         │
│  Actual:    9d1e44f7a8b2...                         │
│  At: 09:22:18 AEST                                  │
│  [! HASH MISMATCH]  (red badge)                     │
│                                                     │
│  ─────────────────────────────────────────          │
│  Evidence collected                                 │
│  Annotations:  0                                    │
│  Findings:     0                                    │
│                                                     │
│  ─────────────────────────────────────────          │
│  Session collaborators                              │
│  J. Rangi (you — owner)   Active now                │
└─────────────────────────────────────────────────────┘
```

---

### Tab Strip Default for DIVERGENCE Session

For `session_type: DIVERGENCE`, the tab strip defaults to Tab 5 (Corpus Diff) as the initially active tab on workspace mount. All 5 tabs (or 6 for ADMIN) are accessible; the default active tab is Tab 5.

---

### Hash Mismatch Visual Treatment on Timeline

```
PRE resolution swim lane with hash mismatch marker:

PRE resolutions  ●──────────────────────◆──────────────────────────────────────────────────
                                         ↑ 09:22:18
                                         ◆ Red diamond — PRE_DIVERGENCE / hash mismatch
                                         Label: "HASH MISMATCH"
```

- Red diamond `◆` symbol, consistent with other PRE_DIVERGENCE markers
- Additional text label "HASH MISMATCH" below the diamond marker, 11px red text
- Clicking `◆` opens event detail in RP-MAIN (Tab 1) or hash mismatch detail panel (Tab 5)

---

### Parity Ratio Colour in DIVERGENCE Session

```
Parity ratio: 71.3%  ← RED (below 85% critical threshold)
```

At 71.3%, the parity ratio indicator renders in red text with a red border on the summary panel. Below 85% is the critical threshold.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | |
| SessionHeader | 72px | `Divergence report:` field added |
| ReplayBanner | 28px amber | Always present |
| DivergenceBanner | 28px red, below ReplayBanner | Present for DIVERGENCE session_type only |
| TabStrip | 48px | Tab 5 default active for DIVERGENCE |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | `◆` marker with "HASH MISMATCH" label |
| ParitySummaryPanel | Top of RP-MAIN | Ratio in red; hash mismatch badge |
| HashMismatchDetail | Below parity summary | Auto-expanded for DIVERGENCE sessions |
| ScreenDiffRows | Below hash detail | Divergence zones highlighted |
| ZoneC | Right 280px | Divergence report panel instead of incident panel |

---

### Interaction Notes

- **`◆` hash mismatch marker in timeline:** clicking switches to Tab 5 if not already active, expands hash mismatch detail panel, scrolls to the affected timestamp
- **`[! HASH MISMATCH]` badge:** clicking opens hash mismatch detail panel in RP-MAIN
- **`[Annotate this event]` on the divergence event:** available for OPERATOR; opens annotation write form for the PRE_DIVERGENCE event
- **Expected conclusion type:** DIVERGENCE sessions typically conclude with a divergence class classification (not ROOT_CAUSE_IDENTIFIED); the `[Conclude investigation]` dropdown offers: "CLASS_1 Operational" / "CLASS_2 Significant" / "CLASS_3 Serious" / "CLASS_4 Critical" / "FALSE_POSITIVE" as conclusion types

---

### Disabled-State Behavior

Identical to all other wireframes. No live write controls anywhere.

---

### Replay-State Behavior

- Session time range is typically short (30–60 minutes) for DIVERGENCE sessions, compared to POST_INCIDENT (multi-hour)
- Default zoom level in RP-TIMELINE shows the full 30-minute session range
- RP-TIMELINE swim lanes: hash mismatch period is visually highlighted with a red background band spanning all swim lanes for the affected period

---

### Degraded-State Behavior

- **Corpus unavailable:** Tab 5 shows "Corpus data required — divergence diff cannot be loaded."; hash mismatch detail still renders from the `divergence_report` metadata (which is available without corpus data)
- **Divergence report missing:** the DIVERGENCE banner still renders; Zone C shows "Divergence report: not found"; hash mismatch detail shows "Divergence report could not be loaded — metadata unavailable"

---

### Incident-State Behavior

- DIVERGENCE sessions typically have no linked incident; Zone C shows "No linked incident. [Link to incident]"
- If an incident is later linked, Zone C updates and Tab 4 Findings renders the closure constraint notice

---

### Accessibility Notes

- DIVERGENCE banner: role="alert" aria-live="assertive" on mount (more urgent than REPLAY banner which uses polite)
- `◆` PRE_DIVERGENCE marker: aria-label="PRE divergence event — corpus hash mismatch at [timestamp] — click to view detail"
- `[! HASH MISMATCH]` badge: role="alert" first render; aria-label="Corpus hash mismatch detected at [timestamp]"
- Red parity ratio: aria-label="Parity ratio 71.3% — critical threshold exceeded (below 85%)"

---

## WF-RP-10: Replay Investigation — OPERATOR — multi-collaborator session (Owner + 2 others present)

**ID:** WF-RP-10
**Surface:** Replay Investigation Surface
**Route:** /venues/venue_parklands/replay/inv_abc1
**Role:** OPERATOR (current user is a non-owner collaborator — M. Chen)
**Session type:** POST_INCIDENT
**Playhead state:** PAUSED
**Active tab:** Tab 3 — Annotations
**Purpose:** Three operators are simultaneously viewing the same investigation session; M. Chen (current user) is a collaborator, not the session owner; the surface shows presence indicators for all collaborators and surfaces the authority model clearly (session owner controls are absent for non-owner collaborators).

---

### Desktop Layout (1440px viewport)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS BAR                                                  ClubHub TV Platform                      M. Chen ▾  [?]  [🔔 2]        │ 48px
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club         ⏸ PAUSED    Speed: [0.25x] [0.5x] [1x★] [2x] [4x]           │
│ Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Type: POST_INCIDENT        Playhead: 2026-05-28 16:23:41 AEST               │ 72px
│                                                                                          Owner: J. Rangi    Also here: M. Chen (you)  A. Okafor  [+0 more] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.                                 │ 28px amber
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Timeline] [Event Stream] [Annotations★] [Findings] [Corpus Diff]                                                                       │ 48px
├──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────┤
│ ZONE A  280px             │ ZONE B  (fluid)                                                                   │ ZONE C  280px             │
│                           │                                                                                   │                           │
│ [REPLAY]                  │  RP-TIMELINE (always visible)                                                     │  Linked incident          │
│ The Parklands Golf Club ▾ │  [swim lanes — playhead at 16:23:41]                                             │  INC-2026-0528-001        │
│                           │  Range: [═══════════════════════════════════════════════════] [Clear range]        │  CLASS_3 · CONTAINED      │
│ ─────────────────────     │                                                                                   │  [View incident →]        │
│ Investigations            │  RP-MAIN ─── Tab 3: Annotations ──────────────────────────────────────────────── │                           │
│ ▶ INV-2026-0601-abc1      │                                                                                   │  ─────────────────────    │
│   POST_INCIDENT  ACTIVE   │  ┌─ Sort and filter ───────────────────────────────────────────────────────────┐  │  Evidence collected       │
│                           │  │ Sort: [authored_at desc★]  Filter: Author [All ▾]  Confidence [All ▾]       │  │  Annotations:  7 (2 SUP)  │
│ ─────────────────────     │  │ [ ] Show SUPERSEDED  (2 superseded hidden)                                  │  │  Findings:     2          │
│ Incidents (read-only)     │  └────────────────────────────────────────────────────────────────────────────┘  │  Contradictions: 2 ⚠      │
│  INC-2026-0528-001        │                                                                                   │  Corpus events: 5         │
│  [→ View on IC surface]   │  [+ Write annotation]                                   7 annotations (5 active) │                           │
│                           │                                                                                   │  ─────────────────────    │
│ ─────────────────────     │  ┌─ Annotation ANN-0029 ───────────────────────────────────────────────────────┐  │  Unresolved ⚠             │
│ Notification Tray         │  │ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST               │  │  2 contradictions         │
│  [🔔 2 notifications]     │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41            │  │  [Resolve now →]          │
│                           │  │                                                                             │  │                           │
│ ─────────────────────     │  │ "The L1 override OVR-0442 was winning..."                                   │  │  ─────────────────────    │
│ Operator Tools            │  │                                                                             │  │  Session collaborators    │
│  [Browse investigations]  │  │ [IMMUTABLE — written 2026-06-01]                                            │  │  ┌─────────────────────┐  │
│  [New investigation]      │  │  [Supersede this annotation]                                                │  │  │ J. Rangi            │  │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │  │ Session owner        │  │
│                           │                                                                                   │  │ Active now    ●      │  │
│                           │  ┌─ Annotation ANN-0025 ───────────────────────────────────────────────────────┐  │  ├─────────────────────┤  │
│                           │  │ [PROBABLE] ●  M. Chen (you)  ·  Written: 2026-06-01 08:32:05 AEST           │  │  │ M. Chen (you)       │  │
│                           │  │ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41           │  │  │ Collaborator         │  │
│                           │  │ [! CONTRADICTION DETECTED]                                                  │  │  │ Active now    ●      │  │
│                           │  │                                                                             │  │  ├─────────────────────┤  │
│                           │  │ "The override stack at 16:23 was 3 levels deep..."                          │  │  │ A. Okafor           │  │
│                           │  │                                                                             │  │  │ Collaborator         │  │
│                           │  │ [IMMUTABLE — written 2026-06-01]                                            │  │  │ Last seen 14m ago ◌  │  │
│                           │  │  [Supersede this annotation]                                                │  │  └─────────────────────┘  │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │  Presence: live (WS)      │
│                           │  ┌─ Annotation ANN-0031 ───────────────────────────────────────────────────────┐  │  (No messaging controls)  │
│                           │  │ [SPECULATIVE] ●  A. Okafor  ·  Written: 2026-06-01 10:22:11 AEST            │  │                           │
│                           │  │ Anchored to: time range 16:30–16:45 AEST                                    │  │                           │
│                           │  │ [! CONTRADICTION DETECTED]                                                  │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ "During 16:30–16:45 the player on screen B3 may have been..."               │  │                           │
│                           │  │                                                                             │  │                           │
│                           │  │ [IMMUTABLE — written 2026-06-01]                                            │  │                           │
│                           │  │  [Supersede this annotation]                                                │  │                           │
│                           │  └────────────────────────────────────────────────────────────────────────────┘  │                           │
│                           │                                                                                   │                           │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

### Session Header — Multi-Collaborator Presence Display

```
┌─ RIGHT section of session header ────────────────────────────────────────────────────────────────────────┐
│ Owner: J. Rangi     Also here: M. Chen (you)  A. Okafor  [+0 more]                                       │
│                                                                                                          │
│ Presence display rules:                                                                                  │
│  - Owner always listed first with "Session owner" label                                                  │
│  - Current user marked "(you)"                                                                           │
│  - Maximum 3 names shown inline (owner counts as one of the 3)                                           │
│  - Overflow: "[+N more]" — click to expand popover listing all collaborators                             │
│  - Green dot ● = active now (WebSocket heartbeat received in last 60s)                                   │
│  - Grey ring ◌ = last seen > 60s ago; tooltip shows elapsed time "Last seen 14m ago"                    │
│  - No avatars required — initials or names acceptable                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Zone C Collaborators Panel — Detail

```
┌─ Session collaborators ──────────────────────────────────┐
│  J. Rangi                                                │
│  Session owner                                           │
│  ● Active now                                            │
│  ──────────────────────────────────────────────────────  │
│  M. Chen (you)                                           │
│  Collaborator                                            │
│  ● Active now                                            │
│  ──────────────────────────────────────────────────────  │
│  A. Okafor                                               │
│  Collaborator                                            │
│  ◌ Last seen 14m ago                                     │
└──────────────────────────────────────────────────────────┘

Presence notes:
  - Presence is WebSocket-driven; updates without page reload
  - ● Active: green filled dot; heartbeat received < 60s
  - ◌ Inactive: grey ring; heartbeat not received; elapsed time shown
  - No messaging, call, or coordination controls in this panel
  - No "kick collaborator" or "transfer ownership" controls visible to non-owner collaborators
```

---

### Session Actions Dropdown — Non-Owner Collaborator

For M. Chen (collaborator, not session owner), the `[⋯ Session actions ▾]` dropdown is ABSENT from the DOM.

```
OWNER (J. Rangi) sees:         [⋯ Session actions ▾]  →  [Conclude investigation]  [Abandon investigation]
NON-OWNER COLLABORATOR sees:   (⋯ Session actions dropdown absent from DOM)
```

The `[Conclude investigation]` and `[Abandon investigation]` actions require the session owner or ADMIN. Non-owner collaborators do not see the dropdown at all — it is absent, not disabled.

---

### Annotation Authorship Marking

When the current user is M. Chen, annotations authored by M. Chen display "(you)" after the author name:

```
[PROBABLE] ●  M. Chen (you)  ·  Written: 2026-06-01 08:32:05 AEST
```

Annotations by other collaborators display their name without "(you)":

```
[CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST
[SPECULATIVE] ●  A. Okafor  ·  Written: 2026-06-01 10:22:11 AEST
```

The `[Supersede this annotation]` button is available on ALL annotations regardless of authorship — any collaborator with OPERATOR (or higher) role may supersede any annotation, including annotations written by other collaborators.

---

### Write Annotation Form — Concurrent Write Behaviour

If two collaborators open the annotation write form simultaneously, the system does not show real-time awareness of the concurrent form state. Each operator completes their annotation independently. Resulting contradictions (if both annotations anchor to the same event with conflicting claims) are detected post-submission and surfaced as the standard contradiction handling flow.

There is no "user X is typing..." indicator. The write form is private to the current user until submitted.

---

### Authority Model Summary for Multi-Collaborator Session

| Action | Session owner | Other collaborators (OPERATOR) |
|---|---|---|
| Write annotation | Yes | Yes |
| Supersede any annotation | Yes | Yes |
| Submit finding | Yes | Yes |
| Supersede any finding | Yes | Yes |
| Conclude investigation | Yes | **No — `[Conclude]` absent from DOM** |
| Abandon investigation | Yes | **No — `[Abandon]` absent from DOM** |
| Link to incident (Zone C) | Yes | **No — `[Link to incident]` absent from DOM** |

ADMIN override: an ADMIN who is a collaborator (not the owner) may access conclude/abandon actions.

---

### Component Placement

| Component | Location | Notes |
|---|---|---|
| SystemStatusBar | Top 48px | Current user: M. Chen |
| SessionHeader | 72px | Owner: J. Rangi; Also here: M. Chen (you), A. Okafor; `[⋯ Session actions ▾]` absent for M. Chen |
| ReplayBanner | 28px amber | |
| TabStrip | 48px | Tab 3 active; 5 tabs |
| ZoneA | Left 280px | |
| RP-TIMELINE | Upper ~25% Zone B | |
| SortFilterBar | Tab 3 top | |
| WriteAnnotationButton | Above annotation list | M. Chen (OPERATOR) can write annotations |
| AnnotationList | Scrollable | ANN-0025 shows "(you)" for M. Chen |
| ZoneC CollaboratorsPanel | Right 280px, Zone C | Owner listed first; J. Rangi, M. Chen (you, active), A. Okafor (inactive 14m) |

---

### Interaction Notes

- **Concurrent annotation submission:** both J. Rangi and M. Chen may submit annotations simultaneously; if they contradict, the contradiction is detected on next annotation list refresh or via WebSocket push
- **Presence heartbeat:** collaborator presence indicators update in real time via WebSocket; no page reload required; A. Okafor's indicator shows grey ◌ because heartbeat has not been received for 14 minutes
- **Tab navigation independence:** each collaborator's active tab is independent; M. Chen switching to Tab 5 does not affect J. Rangi's view
- **Playhead independence:** each collaborator's playhead position is independent; there is no "follow J. Rangi's playhead" mode

---

### Disabled-State Behavior

Identical to WF-RP-01. No live write controls.

Non-owner-specific absences:
- `[⋯ Session actions ▾]` dropdown absent
- `[Conclude investigation]` absent
- `[Abandon investigation]` absent
- `[Link to incident]` in Zone C absent

---

### Replay-State Behavior

Identical to WF-RP-01 replay state specification for all read operations. Write operations (annotations, findings) apply identically to all OPERATOR collaborators regardless of ownership.

---

### Degraded-State Behavior

- **WebSocket disconnection:** presence indicators freeze at last known state; a discreet notice below Zone C collaborators panel: "Presence updates paused — connection lost. [Retry]" — this is informational only; the investigation session remains fully functional
- **Corpus unavailable:** identical to WF-RP-01 degraded-state specification

---

### Incident-State Behavior

Identical to WF-RP-01. Linked incident in Zone C shows read-only. No incident action controls for any collaborator.

---

### Accessibility Notes

- Presence indicators: `●` aria-label="Active now"; `◌` aria-label="Last seen [N] minutes ago"
- Collaborator list: role="list"; each collaborator is role="listitem"
- "(you)" suffix on annotation author: aria-label on the annotation card includes "authored by you" when current user is the author
- Session actions dropdown absent for non-owners: no aria placeholder; DOM does not contain the dropdown element
- Concurrent activity: no screen reader announcements for other collaborators' write actions (would be disruptive); collaborator list presence updates use aria-live="polite" with a 10s debounce

---

*End of REPLAY-INVESTIGATION-WIREFRAMES-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Source documents: CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md, INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1.md*
*Wireframes: WF-RP-01 through WF-RP-10*
*Total wireframes: 10*
