# Canonical Operator Workspace Specification v1

**Document type:** Operational Surface Specification
**Applies to:** All operator-facing frontend surfaces
**Status:** Constitutional — all implementations must conform
**Last updated:** 2026-06-01

---

## Overview

The canonical operator workspace is a fixed three-zone layout. The zones are designated Zone A (Navigation and Fleet Context), Zone B (Primary Work Surface), and Zone C (System Intelligence Panel). A persistent System Status Bar runs along the top. A persistent Audit Trace Footer runs along the bottom.

This layout is not configurable by operators. Layout predictability is an operational safety requirement: an operator under stress must find the same element in the same place, always.

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM STATUS BAR  (48px, always visible)                      │
├──────────────┬──────────────────────────────────┬───────────────┤
│              │                                  │               │
│   ZONE A     │         ZONE B                   │   ZONE C      │
│   280px      │         fluid                    │   320px       │
│   fixed      │         (min 640px)              │   (or 48px)   │
│              │                                  │               │
├──────────────┴──────────────────────────────────┴───────────────┤
│  AUDIT TRACE FOOTER  (28px, always visible)                     │
└─────────────────────────────────────────────────────────────────┘
```

Zone A is not collapsible in LIVE mode. It collapses to an icon rail (48px) via keyboard shortcut only in REPLAY mode. Zone C collapses to an icon rail (48px) by operator choice. Neither zone is resizable — the layout is fixed by constitutional requirement.

---

## System Status Bar

**Position:** Top. 48px height. Always visible. Never occluded by content.

### Layout

**Left region:** ClubHub TV logo followed by the platform constitutional state badge.

Constitutional state badge values and colors:

| Badge Text | Severity | Color Treatment |
|---|---|---|
| HEALTHY | L5 | Grey solid |
| DEGRADED | L4 | Blue solid |
| CONSTITUTIONAL_RISK | L3 | Yellow solid |
| SHADOW_ONLY | L3 | Yellow solid |
| PRE_DISABLED | L2 | Amber solid |
| READ_ONLY | L2 | Amber solid |
| INITIALIZING | L4 | Blue solid |
| EMERGENCY_FREEZE | L0 | Red solid |

Severity color mapping (applies to all severity indicators platform-wide):
- L0: red solid
- L1: orange solid
- L2: amber solid
- L3: yellow solid
- L4: blue solid
- L5: grey solid

**Center region:** Current mode indicator.

| Mode | Indicator |
|---|---|
| LIVE | Green dot (pulsing animation), text "LIVE" |
| REPLAY | Amber dot (static), text "REPLAY MODE", governed timestamp of replay origin |
| INCIDENT ACTIVE | Red dot (static), text "INCIDENT ACTIVE", incident ID |

Pulsing animation in LIVE mode uses a 2-second cycle. The animation is the only permitted animation in the Status Bar. All other Status Bar elements are static.

**Right region:** Operator identity (display name), role badge (VIEWER / OPERATOR / ADMIN), session clock (wall clock time — explicitly labeled "wall" in small text below the clock value), and a [Elevate Session] button for requesting elevated authority.

The session clock displays wall clock time, not governed clock time. This distinction is explicit and permanent. The governed clock is displayed elsewhere (in timestamps on events, PRE resolution traces, and the Audit Trace Footer).

### Emergency Freeze State

When constitutional state = EMERGENCY_FREEZE:
- Entire Status Bar background turns solid red.
- Constitutional freeze reason is displayed in center region, replacing the mode indicator.
- All non-emergency controls in the Status Bar are disabled and visually dimmed.
- The state badge continues to show EMERGENCY_FREEZE.

### Replay Mode State

When operator is in REPLAY mode:
- Entire Status Bar background turns amber.
- Center region shows: "REPLAY MODE — NOT LIVE" in large text. Governed timestamp of replay origin shown below.
- [Exit Replay] button appears at right of center region. This button is always accessible and always visible during replay.
- No operator role badge changes — identity remains visible.

---

## Audit Trace Footer

**Position:** Bottom. 28px height. Always visible. Never scrolls.

### Content

Displays continuously: last PRE resolution event type | resolution level (0–6) | correlation_id (truncated to first 8 characters) | governed timestamp of resolution.

Example: `PRE_RESOLUTION · Level 0 · a3f9bc12 · 2026-06-01T14:23:07Z`

In REPLAY mode: displays replay packet ID instead of correlation_id. Labeled "REPLAY" in amber to the left of the packet ID.

### Interaction

Clicking anywhere in the Audit Trace Footer opens Zone C (if collapsed) and switches Zone C to Pane C1 (PRE Resolution Explainer).

The footer never hides. It always reflects the most recent event. It does not animate or scroll between events — it updates in place when a new event occurs.

---

## Zone A — Navigation and Fleet Context

**Purpose:** Fleet situational awareness and navigation. This zone is read-only plus navigation. No operator actions are initiated from Zone A.

**Width:** Fixed 280px. Not resizable. Collapses to icon rail (48px) on screens narrower than 1280px or via operator-initiated pin toggle.

### Pane A1: Venue Selector

A scrollable list of venues the operator has access to. The list is filtered by operator role: ADMIN operators see all venues; OPERATOR and VIEWER roles see only venues to which they are assigned.

**Venue entry contents:**
- Venue name (primary label)
- Player state badge: LIVE / SYNCING / OFFLINE / DEGRADED / INCIDENT / INITIALIZING
- Active override count (shown as orange badge with numeral — only shown when count > 0)
- Entropy indicator dot: green (score < 0.3), amber (0.3–0.6), red (> 0.6), grey (entropy unavailable)

**Search filter:** Input at top of pane. Filters venue list in real time. Filter persists within session and clears on session end.

**Selection behavior:** Selecting a venue updates Zone B to show that venue's primary workspace. Multi-venue selection is not permitted. One venue is active at a time.

**VIEWER role behavior:** Venue list is visible. Venue selection is permitted. All actions within Zone B will be read-only.

**Failure behavior:** If the venue list fails to load, the pane shows "Fleet data unavailable" followed by the last-known venue list (all entries rendered greyed and non-interactive) and the timestamp of the last successful load.

### Pane A2: Active Incidents

A list of all open incidents, ordered by severity descending, then declared_at ascending (earliest first within the same severity).

**Incident entry contents:**
- Incident ID
- Severity badge (S1/S2/S3/S4/S5)
- Venue name
- Declared at (relative time, e.g., "14 minutes ago")
- Current incident machine state: WATCHING / DECLARED / CONTAINED / RESOLVED

**Interaction:** Clicking an incident entry switches Zone B to the Incident Commander Surface for that incident (see Document 2: Incident Commander Surface Specification).

**Empty state:** Shows "No active incidents" in neutral grey text. No badge is shown on the Zone A header when incident count is zero.

**Badge:** Zone A header shows a count badge with total open incidents when count > 0.

**Failure behavior:** If the incident feed is unavailable, the pane shows "Incident feed offline — manual monitoring required" in amber. No incident entries are shown.

### Pane A3: Navigation Links

Navigation links in fixed order:
1. Fleet Overview
2. CMS / Content Operations
3. Replay & Forensics
4. Training & Certification
5. Platform Administration (visible to ADMIN role only)

The currently active section link is highlighted. State changes are immediate — no transition animations.

Selecting a navigation link swaps Zone B to the corresponding workspace. Zone C persists across navigation changes.

**INCIDENT ACTIVE restriction (Severity 1–2):** All navigation links are disabled except Incident Commander. Hovering any disabled link shows tooltip: "Navigation restricted during active Severity 1–2 incident."

**REPLAY mode behavior:** Each navigation link shows a small REPLAY badge next to its label. Clicking any navigation link while in REPLAY mode triggers a confirmation dialog: "Exit replay? Current replay session will be lost." If operator confirms, replay exits and the selected workspace opens in LIVE mode. If operator cancels, navigation does not occur and replay continues.

---

## Zone B — Primary Work Surface

**Purpose:** The primary operational context. Zone B changes entirely based on navigation state, venue selection, and platform mode. Zone B maintains a minimum width of 640px.

### B-LIVE: Live Venue Operations

The default Zone B state when a venue is selected and the platform is in LIVE constitutional state (HEALTHY or DEGRADED with PRE active).

**Sub-pane B-LIVE-1: Player Status Header**

Full width, 72px height.

Contents:
- Venue name (primary heading)
- Player machine state badge: INITIALIZING / SYNCING / LIVE / INCIDENT / OFFLINE / DEGRADED
- Screen ID
- Last sync timestamp (governed, shown as both relative and absolute — ISO8601 on hover)
- 72-hour autonomy countdown: displayed only when player has been offline for more than 1 hour. Shows hours and minutes remaining before autonomy window expires.

**Sub-pane B-LIVE-2: Active Content Panel**

Full width, approximately 40% of Zone B height.

Contents:
- Current PRE-resolved content reference
- Resolution level badge (0–6, with color per severity model)
- Effective content URI (read-only, truncated with full value on hover)
- Schedule block active indicator: shows schedule block name, start time, end time (governed timestamps)
- Override stack summary: total count of active overrides, highest override level currently active

**Sub-pane B-LIVE-3: Override Stack Panel**

Full width, approximately 30% of Zone B height.

Contents: Ordered list of all active overrides, ordered by level descending (highest override level first).

**Each override entry contains:**
- Level badge (1–6)
- Content reference (truncated)
- Operator ID who placed the override
- Age (relative time since placement, e.g., "placed 23 minutes ago")
- Expiry (absolute governed timestamp, or "No expiry" if indefinite)
- Scope (venue-level, fleet-level, or screen-level)

**Expired override behavior:** When an override expires, its entry transitions to a greyed visual state and remains visible for 60 seconds before being removed from the list.

**Empty state:** Shows "No active overrides — schedule and PRE govern content." in neutral grey. This text is explicit — the empty state is never just blank space.

**Sub-pane B-LIVE-4: Action Bar**

Full width, 56px height.

Available actions based on operator role and current platform state:

| Button | VIEWER | OPERATOR | ADMIN |
|---|---|---|---|
| Place Override | Disabled | Active | Active |
| Declare Incident | Disabled | Active | Active |
| Preview Resolution | Disabled | Active | Active |
| Request Elevated Session | Active | Active | Active |

Disabled buttons are visible but non-interactive. Hovering a disabled button shows a tooltip explaining the specific reason for disablement (e.g., "Read-only access — VIEWER role cannot place overrides" or "Platform in EMERGENCY_FREEZE — override placement suspended").

### B-OFFLINE: Venue Offline

Zone B state when the selected venue's player machine state is OFFLINE.

Contents:
- Last known player state (badge)
- Time elapsed since player went offline (relative + absolute)
- 72-hour autonomy status: percentage of autonomy window elapsed (e.g., "31% of 72h autonomy window elapsed")
- Last corpus sync timestamp (the most recent corpus sync before going offline)

Actions:
- [Trigger Re-enrollment]: ADMIN only. Initiates remote re-enrollment workflow.
- [View Last Known State]: Opens last-known PRE resolution trace in a read-only overlay.
- [Initiate Recovery Workflow]: Opens the recovery workflow modal.

PRE resolution is not shown for offline venues — the player is operating autonomously from its local corpus. The content it is showing cannot be confirmed from the platform until sync resumes.

### B-DEGRADED: Venue Degraded

Zone B state when the selected venue's player machine state is DEGRADED.

Contents:
- Active failure mode classification badge: CLASS_1 / CLASS_2 / CLASS_3 / CLASS_4 / CLASS_5
- Degradation reason (text, from failure mode classification)
- Circuit breaker states: list of any circuit breakers in OPEN or HALF_OPEN state for this venue
- Override stack (same as B-LIVE-3) — each override entry flagged with "Serving from degraded state" indicator

Action bar is reduced to safe operations only:
- [View Degradation Detail]: Opens degradation classification detail in Zone C.
- [Escalate to Incident]: Opens incident declaration modal.
- [Contact Support]: Sends structured support alert. No UI side effects.

### B-INCIDENT: Incident Active

Zone B when an active incident is associated with the selected venue, or when an operator clicks an incident in Zone A Pane A2.

Zone B is replaced by the Incident Commander Surface. See Document 2: Incident Commander Surface Specification for the complete specification of this surface.

---

## Zone C — System Intelligence Panel

**Purpose:** PRE explainability, entropy signals, override context, audit trail. Zone C is advisory only. No operator actions are initiated from Zone C.

**Width:** Fixed 320px when open. Collapses to icon rail at 48px. Zone C collapses before Zone A when viewport is too narrow.

Zone C contains four panes, navigable via tabs at the top of Zone C.

### Pane C1: PRE Resolution Explainer

Default open pane. Shows the resolution path for the last resolved PRE output.

**Resolution path display — ordered by evaluation sequence:**

Each level in the evaluation sequence is shown as a row:

| Level | Entity Evaluated | Result | Reason |
|---|---|---|---|
| 6 — emergency | emergency_active flag | WIN or SKIP | reason string from PRE output |
| 5 — structural | structural content ref | WIN or SKIP | reason string |
| 4 — sponsorship | active sponsor block | WIN or SKIP | reason string |
| 3 — campaign | active campaign | WIN or SKIP | reason string |
| 2 — scheduled override | override entry | WIN or SKIP or SUPPRESSED | reason string |
| 1 — operational | override entry | WIN or SKIP or SUPPRESSED | reason string |
| 0 — schedule | schedule block | WIN or MISS | SCHEDULE_ACTIVE / SCHEDULE_DOW_MISMATCH / SCHEDULE_EXPIRED |
| Fallback | LEVEL_5_STRUCTURAL | ACTIVE or NOT_SET | — |

Result color coding: WIN = green, SKIP = grey, SUPPRESSED = amber, MISS = orange.

**Footer content:**
- Governed timestamp of this resolution (not wall clock)
- Correlation ID (full value, copyable via click)
- Static statement: "This resolution is deterministic. Re-running PRE with the same inputs at this governed timestamp will produce the same output."

**Failure behavior:** If PRE resolution data is unavailable, pane shows "Resolution explanation unavailable" with the timestamp of the last-known resolution.

### Pane C2: Entropy Indicators

**Advisory label (always shown, always prominent):** "ADVISORY — Entropy signals inform, they do not command."

Contents:
- Venue entropy score: numeric value (0.0–1.0) with color indicator: green (< 0.3), amber (0.3–0.6), red (> 0.6)
- Top entropy contributors: ordered list of up to 5 contributing factors, each showing factor name and individual score
- Last computed timestamp (governed)
- Entropy circuit breaker state: CLOSED (normal), OPEN (degraded), HALF_OPEN (probing)

**Entropy circuit breaker OPEN:** Shows "Entropy reporting degraded. Signals may be stale." in amber, positioned above the entropy score.

No operator actions are available in this pane. It is read-only.

### Pane C3: Override History

Shows the last 20 overrides placed or expired on the selected venue, ordered by placed_at descending.

**Each entry contains:**
- Operator ID who placed the override
- Level badge (1–6)
- Content reference (truncated — full value on hover)
- Placed at (governed timestamp, relative + absolute on hover)
- Expired at (governed timestamp) or "active" if currently active
- Duration (elapsed or total if expired)

Scroll is available for entries beyond the visible area. A "View full audit trail" link at the bottom of the pane opens the Replay & Forensics workspace filtered to this venue's override history.

### Pane C4: Constitutional State

Contents:
- Current constitutional state badge (same styling as System Status Bar badge)
- Active circuit breakers: list of any circuit breakers in OPEN or HALF_OPEN state (labels: PRE circuit breaker, entropy circuit breaker, shadow circuit breaker, replay circuit breaker, global constitutional circuit breaker)
- Global freeze status: "Unfrozen" or "Frozen" with freeze reason and frozen_at governed timestamp if frozen
- Canary stage: current PRE promotion stage (SHADOW_ONLY / SHADOW_VALIDATING / CANARY_5PCT / CANARY_20PCT / CANARY_50PCT / AUTHORITATIVE)

**EMERGENCY_FREEZE behavior:** When constitutional state = EMERGENCY_FREEZE, Pane C4 expands to occupy the full Zone C width and height. Freeze authorization requirement is shown prominently. Other panes are inaccessible until the freeze is resolved.

---

## Workspace Modes

### LIVE Mode

All three zones are active. Zone C is collapsible by operator choice. All operator actions are available per role. The governed clock is live. The System Status Bar shows the LIVE indicator (green, pulsing).

### REPLAY Mode

Zone B shows the Replay and Forensics Workspace (see Document 3).

System Status Bar shows amber REPLAY banner for the entire duration of the replay session.

Zone A remains visible. Venue list is navigable but venue selection triggers confirmation: "You are in a replay session. Selecting a different venue will exit replay." Zone A navigation links show REPLAY badge.

Zone C switches to replay-specific panels:
- Replay packet information (packet ID, scope, origin timestamp)
- Divergence status (NONE or DIVERGENCE DETECTED with timestamp)
- Annotation surface (operator can add text annotations to the current replay event)

No operator actions that modify platform state are available during replay. The only write operation permitted is adding annotations to the audit trail.

[Exit Replay] button is present in the System Status Bar throughout replay. It is always accessible.

### INCIDENT Mode (Severity 1–2)

Zone B is replaced by the Incident Commander Surface.

Zone A navigation links are locked to Incident Commander only.

Zone C shows incident-specific panels:
- Incident timeline summary
- Blast radius (affected venues and scope)
- Command transfer status (current commander identity)

System Status Bar shows red INCIDENT banner with incident ID and severity.

### DEGRADED Mode (Constitutional State: DEGRADED or CONSTITUTIONAL_RISK)

System Status Bar shows amber background with DEGRADED or CONSTITUTIONAL_RISK badge.

Zone C Pane C4 is pinned open and visually highlighted with amber border.

Operator action bar in Zone B is reduced to safe operations only. All destructive actions require a confirmation modal with explicit degraded-state acknowledgment checkbox: "I acknowledge this action is being taken while the platform is in a degraded state."

### EMERGENCY_FREEZE Mode

- A 4px solid red border is applied to all four edges of the viewport.
- System Status Bar is solid red.
- Zone C Pane C4 expands to full Zone C.

**Non-ADMIN operators:** All interactive elements are disabled except read-only views and the audit trail. A message is displayed in Zone B: "Platform in constitutional freeze. Contact platform administrator." The operator can still navigate between read-only views and view all current state.

**ADMIN operators:** Zone B shows freeze reason, frozen_at timestamp, authorization token input field, and [Initiate Resolution Protocol] button. The resolution protocol requires the authorization token (a human-held token, not an operator session token).

---

## Resize Behavior

**Zone A:** Fixed 280px. Not resizable. On screens narrower than 1280px, Zone A collapses automatically to icon rail (48px). Operator can pin open via toggle that persists for the session.

**Zone B:** Fluid width. Takes all remaining width between Zone A and Zone C. Minimum width: 640px. If the viewport is too narrow to maintain Zone B at 640px, Zone C collapses first (to 48px), then Zone A collapses (to 48px). Zone B is never allowed to go below 640px.

**Zone C:** Fixed 320px when open, 48px when collapsed to icon rail. Resizing is not permitted. Layout stability is a constitutional requirement.

---

## Docking Behavior

No custom docking. Zones cannot be repositioned, detached, or reordered by operators.

Rationale: layout predictability is operational safety. An operator managing an incident, acting under time pressure, in an unfamiliar venue, must find every element in the same position as always. Custom docking creates personalized layouts that break down when operators switch workstations or assist each other remotely.

---

## Modal Rules

Modals are used only for:
- Destructive action confirmation (override placement, incident declaration, session elevation)
- Elevated session request
- Emergency declaration

Maximum one modal may be open at a time.

**Modal presentation:** Centered on screen. Dark scrim overlay at 60% opacity covers all content behind the modal.

**Modal contents:**
- Action description (what is about to happen)
- Consequences statement (what this action will cause)
- Required confirmation text: operator must type the action name or a specified phrase to confirm
- [Cancel] button (left) and [Confirm] button (right)

**EMERGENCY_FREEZE:** Only the freeze resolution modal is permitted. All other modals are blocked.

**REPLAY mode:** No state-modifying modals. Only navigation confirmation modals (e.g., "Exit replay?").

---

## Multi-Monitor Behavior

**Primary monitor:** Full three-zone workspace (all zones, Status Bar, Footer).

**Secondary monitor (when configured):** Zone B extends to the secondary monitor. Primary monitor shows Zone A, Zone C, System Status Bar, and Audit Trace Footer. Secondary monitor shows Zone B full-screen.

Secondary monitor always shows the current mode indicator (LIVE / REPLAY / INCIDENT) in the top-right corner of the Zone B display.

Multi-monitor configuration is per-session. It persists across page reloads within the session. It resets when a new session begins.

---

## Accessibility Considerations

**Keyboard navigation:** All interactive elements are keyboard-navigable. Tab order: System Status Bar → Zone A → Zone B → Zone C → Audit Trace Footer.

**State indicators:** All state badges include text labels. Color is never the sole differentiator for state.

**LIVE/REPLAY distinction:** Conveyed by both color (green/amber) and explicit text label ("LIVE" / "REPLAY MODE — NOT LIVE"). Never color alone.

**Severity levels:** Color + text label + icon. All three channels present for every severity indicator.

**Screen reader landmarks:**
- `banner` role: System Status Bar
- `navigation` role: Zone A
- `main` role: Zone B
- `complementary` role: Zone C
- `contentinfo` role: Audit Trace Footer

**Emergency keyboard shortcut:** Ctrl+Shift+E launches the emergency override confirmation modal. The shortcut does not execute the action directly — it opens the confirmation modal. The shortcut is documented in the help overlay (accessible via the ? key).

---

## Cognitive Load Considerations

**Zone C defaults:** Zone C panels are collapsed by default for new operators. The system opens relevant panels contextually — for example, when an override is placed, Zone C opens to Pane C3 (Override History). Operators are not required to discover panels unprompted.

**Empty states:** Every potentially-empty list has an explicit empty state message. Empty space alone is never used to communicate "nothing here."

**Timestamps:** All timestamps display as relative ("3 minutes ago") with absolute ISO8601 value on hover. This applies to all timestamps in all zones.

**Action accessibility:** Buttons that require elevated session show the operator's current session level and what elevation is needed. "Permission denied" alone is never shown — the reason and resolution path are always surfaced.

**List truncation:** Scrollable lists truncate at 8 visible items before showing a scroll indicator with "N more" text. This applies to all scrollable lists in all zones.

**Override empty state:** The Override Stack (B-LIVE-3) always shows an explicit message when empty: "No active overrides — schedule and PRE govern content." The absence of overrides is a meaningful operational signal and must be communicated explicitly.
