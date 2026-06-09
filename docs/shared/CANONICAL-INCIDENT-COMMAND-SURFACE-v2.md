# CANONICAL-INCIDENT-COMMAND-SURFACE-v2

**Document class:** Canonical reference surface specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers (wireframes), frontend engineers (implementation), Agent 1 (Platform) for API contract reference
**Status:** CANONICAL — this document supersedes any surface-level incident UI descriptions in prior documents
**Depends on:** INCIDENT-INFORMATION-MODEL-v1.md, INCIDENT-OPERATIONS-UX-v1.md, OPERATIONAL-WORKSPACES-v1.md, FRONTEND-COMPONENT-TAXONOMY-v1.md, OPERATIONAL-WORKFLOW-ARCHITECTURE-v1.md
**Version:** 2.0

---

## 1. Surface Identity

### 1.1 Surface Name and Route

**Surface name:** Incident Command Surface
**Canonical route:** `/incidents/:incident_id`
**Deep-link format:** `https://[host]/incidents/inc-{venue_id}-{hash}`
**Surface type:** High-stakes operational workspace — not a workspace the operator browses to; a workspace the system or an emergency forces the operator into.

### 1.2 Access Requirements

| Role | Access | Write authority |
|------|--------|----------------|
| VIEWER | Read-only access — Zone B is not automatically replaced; VIEWER must navigate manually. No write controls rendered. All tab content visible except Tab 6. | None |
| OPERATOR | Full read access. Write controls rendered on Tabs 2, 3, 5. Can claim command in COMMANDER_LAPSED. Can place L1–L5 overrides. Cannot approve S1–S2 CONTAINED. | Limited (non-ADMIN actions only) |
| ADMIN | All OPERATOR access plus: Tab 6 visible and present in DOM; can approve S1–S2 CONTAINED; can assign `correlation_id`; can initiate ADMIN_OVERRIDE command transfer; can de-escalate S1–S2 severity. | Full |

**Commander-specific authority:** The operator currently identified as `commander_id` (derived from audit trail) has exclusive access to: [Transfer Command] button, [Mark Contained] transition for S3–S5, and annotation-gated actions. OPERATOR+ who are not commander see these controls as absent (not disabled, not greyed — absent from DOM).

### 1.3 Entry Points

**Entry from Live Operations Workspace:** When an incident in DECLARED or COMMANDER_LAPSED state exists for the operator's current venue scope, a persistent banner appears in the System Status Bar reading: "INCIDENT ACTIVE — [INCIDENT_ID] — [Severity badge] — [Open Incident]". Tapping [Open Incident] navigates to this surface.

**Entry from alert notification:** Push or email notifications for incident events include a direct deep link to `/incidents/:incident_id`. The link resolves and loads the correct incident.

**Automatic Zone B replacement (S1–S2 only):** For S1 and S2 incidents, Zone B is replaced with the Incident Command Surface automatically for all OPERATOR+ users viewing the affected venue. This replacement cannot be dismissed by any operator until the incident reaches CONTAINED state. The [Back] browser control is suppressed during EMERGENCY_FREEZE.

**Entry from COMMANDER_LAPSED alert:** A Level 1 constitutional alert that fires 15 minutes after lapse includes a direct link and a prominent [Claim Command] CTA. Tapping this link loads the surface and scrolls to the COMMANDER_LAPSED banner.

**Entry from Network Operations Workspace:** Venue cards with active incidents show an incident count badge. Tapping the badge navigates to the incident list for that venue; tapping an incident navigates to `/incidents/:incident_id`.

### 1.4 What Is Never Shown on This Surface

The following are never rendered on the Incident Command Surface regardless of state or role:

- Campaign library browsing or campaign creation flows
- Venue configuration editing (zone layout, screen naming, etc.)
- Sponsorship SOV dashboards (sponsor data surfaces in Tab 4 only in the context of PRE resolution — not as a standalone SOV tracker)
- Media library or asset management
- Schedule planning timelines (7-day future view is absent — this surface is about now and what happened, not what will happen)
- User account management or settings
- Network-level fleet overview (this surface is scoped to exactly one incident; fleet views are in Network Operations Workspace)
- Write controls of any kind in REPLAY mode (IC-03 enforcement)

---

## 2. Surface Header — Incident Identity Bar

The Incident Identity Bar sits directly below the 48px System Status Bar and above the tab system. It is always visible. Height: 72px. Background color: varies by severity (see Section 2.2). It does not scroll.

### 2.1 Fields in the Incident Identity Bar

**Left group (incident identity):**

| Field | Label/format | Notes |
|-------|-------------|-------|
| Incident ID | `INC-[venue_slug]-[short_hash]` — 8-character display hash | Tappable — copies full `incident_id` to clipboard with a "Copied" toast |
| Severity badge | See Section 2.2 | Always visible; updates live if severity changes |
| Incident state | `WATCHING` / `DECLARED` / `CONTAINED` / `RESOLVED` | Pill-shaped label, state color-coded per Section 2.3 |
| `declared_at` timestamp | Label: "Declared" — format: `DD MMM YYYY HH:mm [TIMEZONE]` | Example: `01 Jun 2026 14:32 AEST`. Governed timestamp, never wall clock. Immutable. |

**Center group (duration):**

| Field | Label/format | Notes |
|-------|-------------|-------|
| Duration clock | Label: "Duration" — format: `HH:MM:SS` | Live-updating. Derived from `now() - declared_at`. Font weight: bold. Not shown in WATCHING state. |

**Right group (commander identity):**

| Field | Label/format | Notes |
|-------|-------------|-------|
| Commander name | Label: "Commander" — value: operator display name | Derived from audit trail. If COMMANDER_LAPSED: replaced by COMMANDER_LAPSED indicator (Section 2.4) |
| [Transfer Command] button | Button label: "Transfer Command" | Visible only to current commander. Role: commander only. Leads to IC Transfer Flow (Section 7). |
| [Assume Command] button | Button label: "Assume Command" | Visible only in COMMANDER_LAPSED state. Visible to any OPERATOR+. See Section 2.5. |

### 2.2 Severity Badge Appearance

The severity badge appears as a filled rounded rectangle (border-radius: 4px), 28px tall, containing icon + label. The bar background color matches the severity badge at 15% opacity.

| Severity | Badge background | Badge text | Badge icon | Incident bar background tint |
|----------|-----------------|-----------|-----------|------------------------------|
| S1 — EMERGENCY_FREEZE | `#C62828` (deep red) | "S1 EMERGENCY" | ⬤ (solid circle) | `#C62828` at 15% on `#1A1A1A` |
| S2 — CRITICAL | `#E64A19` (deep orange) | "S2 CRITICAL" | ▲ (triangle) | `#E64A19` at 15% on `#1A1A1A` |
| S3 — MAJOR | `#F57C00` (amber) | "S3 MAJOR" | ◆ (diamond) | `#F57C00` at 15% on `#1A1A1A` |
| S4 — MINOR | `#FBC02D` (yellow) | "S4 MINOR" | ● (smaller circle) | `#FBC02D` at 15% on `#1A1A1A` |
| S5 — WATCHING | `#558B2F` (olive green) | "S5 WATCHING" | ◌ (open circle) | `#558B2F` at 15% on `#1A1A1A` |

If `severity_high_water` differs from `severity`, a secondary inline label appears to the right of the badge: "Peak: S[N]" in the peak severity color, 12px, muted. This communicates that the current severity has been de-escalated from a higher historical peak. It is never removable.

### 2.3 Incident State Indicator

The state indicator is a pill-shaped label rendered at 14px medium weight, positioned immediately to the right of the severity badge.

| State | Label | Pill background | Text color |
|-------|-------|----------------|-----------|
| WATCHING | "WATCHING" | `#37474F` (dark slate) | `#B0BEC5` |
| DECLARED | "DECLARED" | `#1565C0` (blue) | `#FFFFFF` |
| CONTAINED | "CONTAINED" | `#2E7D32` (dark green) | `#FFFFFF` |
| RESOLVED | "RESOLVED" | `#424242` (grey) | `#9E9E9E` |
| COMMANDER_LAPSED | No state pill — replaced by COMMANDER_LAPSED banner (Section 2.4) | — | — |

### 2.4 COMMANDER_LAPSED Indicator

When `current_state` is COMMANDER_LAPSED, the entire right group of the Incident Identity Bar is replaced by the COMMANDER_LAPSED indicator. The duration clock and declared_at remain visible.

**COMMANDER_LAPSED indicator layout (occupies the full right group, 280px):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠ COMMANDER LAPSED                               [Assume Command]   │
│  Former commander: [OPERATOR_NAME]                                    │
│  Lapsed: [HH:MM:SS] ago   ·   Level 1 alert in: [MM:SS]             │
└──────────────────────────────────────────────────────────────────────┘
```

**Visual specification:**

- Background: `#B71C1C` (deep red) at full opacity
- Border: 2px solid `#EF5350`
- Text color: `#FFFFFF`
- "⚠ COMMANDER LAPSED" — 14px bold, uppercase, tracking: 0.05em
- Former commander name — 12px regular, "Former commander: [name]"
- Lapsed duration — 12px regular, updates every second: "Lapsed: 04:32 ago"
- Countdown to Level 1 alert — 12px bold red `#FF8A80`, updates every second: "Level 1 alert in: 10:28". When under 3 minutes remaining: the countdown text pulses (opacity oscillates 100%→60% on a 1-second cycle)
- [Assume Command] button — present in this indicator, 32px height, background `#FFFFFF`, text `#B71C1C`, font 13px bold, label: "Assume Command"

**COMMANDER_LAPSED also modifies:**

- A full-width amber banner is inserted between the Incident Identity Bar and the tab system: "No incident commander — this incident is unmanaged. Any OPERATOR+ may assume command."
- The System Status Bar background shifts to `#B71C1C` while COMMANDER_LAPSED persists.
- Zone A active incident indicator (Section 3.4) gains a pulsing red dot.

### 2.5 Assume Command Control

The [Assume Command] button is rendered only when `current_state = COMMANDER_LAPSED`.

**Who can see it:** Any OPERATOR+ currently viewing this surface. VIEWER role: button not rendered.

**Confirmation required:** Yes. Tapping [Assume Command] triggers an inline confirmation card (not a modal) that expands below the COMMANDER_LAPSED indicator:

```
┌─────────────────────────────────────────────────────┐
│  Assume command of this incident?                    │
│                                                      │
│  You will become the Incident Commander.             │
│  You will be responsible for driving this incident   │
│  to CONTAINED and then RESOLVED.                     │
│                                                      │
│  [Confirm — Assume Command]    [Cancel]              │
└─────────────────────────────────────────────────────┘
```

On confirmation: POST to `/incidents/{id}/command/claim`. The UI updates only after server confirmation (IC-01). The COMMANDER_LAPSED indicator is replaced by the standard commander name display showing the new commander's name. An INCIDENT_STATE_CHANGED event (COMMANDER_LAPSED → DECLARED) and a COMMAND_TRANSFERRED event are emitted.

---

## 3. Zone A — Navigation During Incident

Zone A is 280px fixed, left side. The standard nav items remain, with incident-specific additions and suppression rules.

### 3.1 Standard Navigation Items — Active During Incident

The following Zone A nav items remain fully active during all incident states:

- Home / Live Operations
- Venues
- Incidents (highlighted — active incident visible here)
- Replay & Forensics
- Settings (ADMIN only)

### 3.2 Navigation Items Suppressed During EMERGENCY_FREEZE (S1)

During an S1 EMERGENCY_FREEZE incident in DECLARED state, the following Zone A nav items are rendered as non-interactive (no hover state, no click response, `pointer-events: none`, opacity: 0.35):

- Future Simulation Workspace
- Sponsorship Operations
- Campaign Management
- Media Library

**These items are not removed from the DOM** — they remain visible but visually muted. A tooltip on hover reads: "Unavailable during EMERGENCY_FREEZE." This suppression lifts when the incident transitions to CONTAINED.

### 3.3 Incident-Specific Navigation Items in Zone A

When any incident is active and the operator is on `/incidents/:incident_id`, Zone A displays an incident context block below the primary nav, separated by a divider:

```
─────────────────────────
THIS INCIDENT
  Situation Overview
  Command Log
  Override Management
  PRE Status
  Incident Actions
  [Evidence Package — ADMIN only]
─────────────────────────
```

These are the tab navigation labels mirrored in Zone A for keyboard and accessibility navigation. The currently active tab is highlighted with a 3px left border in the severity color.

### 3.4 Active Incident Indicator in Zone A

The "Incidents" nav item in Zone A always shows a badge when there are active incidents in the operator's scope. During an incident while the operator is on the IC Surface:

- Badge: solid colored pill with incident count (e.g., "1")
- Color: S1 = `#C62828`, S2 = `#E64A19`, S3 = `#F57C00`, S4 = `#FBC02D`, S5 = `#558B2F`
- In COMMANDER_LAPSED state: a pulsing red dot (8px diameter) appears to the left of the "Incidents" label, independent of the badge count

### 3.5 Venue Entropy Indicator in Zone A

Per workspace safety rule WS-04, the venue health grade remains persistently visible in Zone A as a small grade badge next to the venue name: e.g., "Riverside Golf Club — [C]". This is present on all workspaces including IC Surface. It does not suppress during incidents.

---

## 4. Zone B — Tab System

Zone B is the fluid center workspace. On the IC Surface it contains a six-tab system. Tab headers are 48px tall, full-width of Zone B, with tab labels in 14px medium weight. The active tab has a 3px bottom border in severity color.

**Tab rendering rules:**
- Tab 6 (Evidence Package): rendered in DOM only for ADMIN role. For OPERATOR and VIEWER roles this tab does not exist in the DOM — it is not greyed, not hidden, not accessible. The tab strip shows 5 tabs for non-ADMIN, 6 tabs for ADMIN.
- In REPLAY mode: all tabs render but write controls within each tab are absent (IC-03).
- Tab selection is remembered per session. On reload, Tab 1 (Situation Overview) is the default.

---

### Tab 1: Situation Overview

**Purpose:** First-order situational awareness. The operator opening this incident for the first time should understand what is happening within 30 seconds.

**Sections (vertical stack, scrollable):**

#### Section A — Incident Summary

Single card, full width. Contains:

| Field | Display label | Value source |
|-------|--------------|-------------|
| Incident ID | "Incident" | Full `incident_id`, monospace 13px |
| Declared by | "Declared by" | `declared_by` operator display name + role badge |
| Declared at | "Declared at" | Governed timestamp, formatted: `DD MMM YYYY HH:mm:ss [TIMEZONE]` |
| Scope | "Scope" | Venue name / venue group name / "Fleet". If venue: include health grade badge. |
| Current severity | "Severity" | Severity badge (Section 2.2) + "Peak: S[N]" if different |
| Current state | "State" | State pill (Section 2.3) |
| Description | "Description" | Free text from declaration, full display, not truncated |

#### Section B — Current Venue Status at Time of Incident

Two-column layout. Left: venue status at `declared_at`. Right: venue status now.

Each column shows:
- Constitutional state: one of `HEALTHY`, `CONSTITUTIONAL_RISK`, `EMERGENCY_FREEZE`, `DEGRADED`, `OFFLINE` — displayed as large bold label with color per constitutional state
- Screen count: "23 screens / 2 offline" (count of screens in scope, count offline)
- Active override count: "4 active overrides" — tappable, navigates to Tab 3
- PRE resolution status: "PRE: RESOLVED" or "PRE: ERROR" or "PRE: DIVERGENCE DETECTED"
- Confidence level: `HIGH` / `MEDIUM` / `LOW` / `NONE` — displayed as small badge with color:
  - HIGH: `#2E7D32` green
  - MEDIUM: `#F57C00` amber
  - LOW: `#C62828` red
  - NONE: `#424242` grey

If left and right column values differ, the changed fields are highlighted with a light background tint in the right column.

#### Section C — Active Overrides Relevant to This Incident

Heading: "Active Overrides — [venue name] — at declaration time". Subheading: "[N] overrides active when this incident was declared."

Each override shown as a row:

```
[L3] Override #[ID] — [CONTENT_NAME] on [SCOPE] — placed [AGE] ago by [OPERATOR]
     Expires: [EXPIRY_TIMESTAMP] or "Never"
```

Override level shown as a colored badge: L1=dark navy, L2=blue, L3=teal, L4=amber, L5=red, L6=deep red with bold "EMERGENCY" label.

If no overrides were active at declaration time: "No overrides were active at the time this incident was declared."

#### Section D — PRE State Comparison

Two-column comparison: "PRE at declaration" vs "PRE now".

Each column shows the PRE resolution tree summary:
- L0 (Emergency): active or inactive
- L1 (Operational): active rule name or "None"
- L2 (Scheduled): winning campaign name or "None"
- L3 (Campaign): winning campaign name or "None"
- L4 (Sponsorship): sponsor/slot active or "None"
- L5 (Structural Fallback): active or inactive
- L6 (Device Default): active or inactive

Differences between columns highlighted with amber background on changed rows.

#### Section E — Last Known Good State

Heading: "Last Known Good State"

Shows the PRE resolution output for the 15-minute window before `declared_at`. This is a read-only replay output labeled: "System state 15 minutes before declaration — [TIMESTAMP]".

Contains: constitutional state at that time, active overrides at that time (count + list), PRE resolution summary at that time. A button at the bottom of this section: [Open in Replay Workspace] — navigates to Replay & Forensics at that timestamp, linked to this incident_id.

---

### Tab 2: Command Log

**Purpose:** The chronological audit record of every action taken in this incident. Append-only. The truth record of the incident response.

#### Command Log Entry Anatomy

Each entry is a row with the following structure:

```
[TIMESTAMP] [OPERATOR_NAME] ([ROLE_BADGE])  [EVENT_TYPE_PILL]
[Entry body text — full text of the event or annotation]
[Authority level: OPERATOR / ADMIN / SYSTEM]
```

- Timestamp: governed timestamp, `HH:mm:ss [TIMEZONE]` format. Hover shows full datetime.
- Operator name: display name. For system-generated events: "System" in italic.
- Role badge: colored pill — VIEWER=grey, OPERATOR=blue, ADMIN=gold, SYSTEM=dark slate.
- Event type pill: one of the audit event types from the Incident Audit Event Reference — e.g., `INCIDENT_DECLARED`, `COMMAND_TRANSFERRED`, `SEVERITY_CHANGED`, `OPERATOR_NOTE`, `INCIDENT_STATE_CHANGED`.
- Entry body: human-readable description of the event. For OPERATOR_NOTE events: the full annotation text.
- Authority level: shown as a small muted label at the bottom right of the row.

Entries are ordered oldest-first (chronological, not reverse-chronological). New entries append at the bottom. An auto-scroll toggle is available at the top right of the tab: "Auto-scroll to latest: [ON/OFF]". Default: ON.

#### COMMANDER_LAPSED Entries in the Log

When a COMMANDER_LAPSED state is entered, the log entry is visually distinguished:

```
[TIMESTAMP]  System                          [COMMANDER_LAPSED]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commander session expired: [FORMER_COMMANDER_NAME]
Incident is unmanaged. 15-minute claim window begins now.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The row is full-width, has a `#B71C1C` left border (6px), and amber background at 10% opacity. It visually breaks the log as a significant event.

When COMMANDER_LAPSED_ALERT_FIRED occurs (15 minutes elapsed without claim), a second distinguished row appears:

```
[TIMESTAMP]  System                          [LEVEL 1 ALERT FIRED]
Level 1 constitutional alert fired. All OPERATOR+ users with venue access notified.
```

Row: full-width, `#C62828` background at 15% opacity, `#C62828` left border 6px.

#### Write Control: Add Annotation to Command Log

Available to: any OPERATOR+ who is not a VIEWER. Absent in REPLAY mode (IC-03).

Located at the bottom of the tab, below all log entries. A fixed-position input area (does not scroll away):

```
┌───────────────────────────────────────────────────────────────────┐
│ Add annotation to command log                                      │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ [textarea, 3 rows, placeholder: "Add operational note..."]  │   │
│ └─────────────────────────────────────────────────────────────┘   │
│ [N / 500 characters]                          [Add Annotation]    │
└───────────────────────────────────────────────────────────────────┘
```

Character count shown in real time. [Add Annotation] button is inactive until at least 1 character is present. No minimum for general annotations (the 50-character minimum applies only to the `resolution_annotation` field at closure — Tab 5).

On submit: audit event emitted at time of action attempt (IC-04), then POST to write endpoint. UI appends the entry only after server confirmation (IC-01). If server rejects: error shown inline below the textarea (IC-02), textarea content preserved.

#### Real-Time Update Behavior

The command log receives new entries via WebSocket subscription to the incident's audit stream. No manual refresh required. Entries arriving while the operator is scrolled up in the log appear as a toast at the bottom: "[N] new entries — scroll to latest" with an arrow button.

---

### Tab 3: Override Management

**Purpose:** View and manage overrides scoped to this incident's venue or scope. Place new overrides. Remove existing overrides.

#### Override List

Heading: "Active Overrides — [venue name]". Subheading: "[N] overrides currently active."

Each override shown as a card (full width):

```
┌───────────────────────────────────────────────────────────────────┐
│  [L3] Override #[ID]                          Auto-expires: [DATE] │
│  Content: [CONTENT_NAME]                                           │
│  Scope: [ZONE_NAME / SCREEN_NAME / "Venue-wide"]                  │
│  Placed: [TIMESTAMP] by [OPERATOR_NAME]                            │
│  Age: [N days / N hours]                                           │
│                                                                    │
│  [View Details]                            [Remove Override ▾]    │
└───────────────────────────────────────────────────────────────────┘
```

Override level badge colors: L1=`#1A237E`, L2=`#1565C0`, L3=`#00695C`, L4=`#E65100`, L5=`#B71C1C`, L6=`#880E4F` with bold white text "L6 EMERGENCY".

**Auto-expire vs never-expire visual differentiation:**

- Auto-expires: "Auto-expires: [date] [time] [TZ]" in `#2E7D32` green text with a clock icon (⏱)
- Never expires: "No expiry — manual removal required" in `#C62828` red text with a warning icon (⚠) and label "PERMANENT UNTIL REMOVED"
- L6 overrides always show "No expiry — manual removal required" and additionally show: "L6 overrides never auto-expire per constitutional rule."

#### Place Override Flow

Button label: "Place Override" — located at the top right of the tab. Role required: OPERATOR+. Absent in REPLAY mode (IC-03). Absent for VIEWER role.

Tapping [Place Override] expands an inline form panel (not a modal) below the button:

```
┌───────────────────────────────────────────────────────────────────┐
│  Place Override                                                    │
│                                                                    │
│  Level:  [L1] [L2] [L3] [L4] [L5]  [L6 — requires ADMIN role]   │
│          (L6 rendered only for ADMIN role)                         │
│                                                                    │
│  Content: [Content picker — search or browse]                      │
│                                                                    │
│  Scope:  ○ This screen: [Screen picker]                           │
│          ○ Zone: [Zone picker]                                     │
│          ○ Venue-wide                                              │
│                                                                    │
│  Expiry: ○ In: [duration picker — 15min / 30min / 1h / 2h / 4h]  │
│          ○ At: [date/time picker]                                  │
│          ○ No expiry (ADMIN only for L1–L4; any OPERATOR for L5)  │
│                                                                    │
│  Reason: [text field — required, min 10 characters]               │
│                                                                    │
│  [Cancel]                               [Preview Impact] [Place]  │
└───────────────────────────────────────────────────────────────────┘
```

[Preview Impact] is required before [Place] is enabled for L1–L3 overrides. [Preview Impact] calls the PRE preview endpoint and shows which screens will be affected and what content will be displaced.

[Place] button becomes active only after: all required fields filled, and (for L1–L3) [Preview Impact] has been invoked at least once.

On [Place]: audit event emitted immediately (IC-04), then POST. UI updates only after server confirmation (IC-01). Rejection shown inline (IC-02).

#### L6 Override Flow

L6 is available only to ADMIN role. When an ADMIN selects L6, the inline form shows an additional confirmation section that cannot be bypassed:

```
┌───────────────────────────────────────────────────────────────────┐
│  ⚠ LEVEL 6 — EMERGENCY OVERRIDE                                   │
│                                                                    │
│  This override operates at the highest authority level.           │
│  It will suppress ALL content including L1–L5 overrides.         │
│  It will NEVER auto-expire. You must manually remove it.          │
│                                                                    │
│  L6 overrides are permanent records and cannot be deleted.        │
│                                                                    │
│  To confirm this is intentional, type the word EMERGENCY below:  │
│                                                                    │
│  ┌─────────────────────────────┐                                  │
│  │ [text input]                │   ← Must match exactly: EMERGENCY│
│  └─────────────────────────────┘                                  │
│                                                                    │
│  [Place L6 Override] — button inactive until "EMERGENCY" typed   │
└───────────────────────────────────────────────────────────────────┘
```

The confirmation string must be typed exactly as `EMERGENCY` (case-sensitive, no spaces, no trailing characters). The [Place L6 Override] button remains inactive (`pointer-events: none`, opacity: 0.35) until the field value is exactly `EMERGENCY`. The field does not autocomplete and does not accept paste from some clipboard managers (implementation must accept paste but validate on submit).

[Place L6 Override] is a separate button from the standard [Place]. On tap: audit event emitted (IC-04), POST. UI update only after server confirmation (IC-01).

#### Override Removal Flow

[Remove Override ▾] is a split button — the ▾ reveals:
- "Remove Override" — standard removal
- "Schedule removal at: [time picker]" — remove at a future time

For L1–L4 overrides, tapping "Remove Override" shows an inline confirmation:

```
Remove Override #[ID]?
Content [CONTENT_NAME] will stop on [SCOPE] at the next poll cycle (≤15s).
Previous content will resume per PRE resolution.
[Confirm Removal]   [Cancel]
```

For L5–L6 overrides, the confirmation label changes to "CONFIRM REMOVAL" (uppercase, bold) and the explanation reads: "This is a high-authority override. Removing it will restore lower-authority content. Verify this is intended."

L6 override removal requires typing "CONFIRM REMOVAL" in a text input within the confirmation card before the removal button activates. The text must match exactly (case-sensitive, no spaces beyond the single space between words).

---

### Tab 4: PRE Status

**Purpose:** Show the current PRE resolution state for all venues in the incident scope. Surface any divergence between what PRE computes and what devices are delivering.

#### Venue Selector

If the incident scope covers multiple venues (fleet or venue group), a venue selector dropdown appears at the top of the tab: "Viewing PRE state for: [VENUE_NAME] [▼]". Default: the primary venue of the incident scope.

If scope is a single venue: no selector shown.

#### PRE Resolution Level Breakdown

Heading: "PRE Resolution — [VENUE_NAME]" with a timestamp showing when PRE was last computed: "Last resolved: [HH:mm:ss]".

Level-by-level breakdown table:

| Level | Label | Winning content or rule | Status |
|-------|-------|------------------------|--------|
| L0 | Emergency | [CONTENT_NAME or "Inactive"] | [ACTIVE in red / INACTIVE] |
| L1 | Operational Override | [CONTENT_NAME or "None"] | [ACTIVE / INACTIVE] |
| L2 | Scheduled Campaign | [CAMPAIGN_NAME or "None"] | [WINNING / SUPPRESSED / NONE] |
| L3 | Campaign | [CAMPAIGN_NAME or "None"] | [WINNING / SUPPRESSED / NONE] |
| L4 | Sponsorship Slot | [SPONSOR_NAME or "None"] | [WINNING / SUPPRESSED / NONE] |
| L5 | Structural Fallback | [FALLBACK_NAME or "Inactive"] | [ACTIVE / INACTIVE] |
| L6 | Device Default | [DEVICE_DEFAULT_NAME] | [ACTIVE / INACTIVE] |

The winning level row is highlighted with a subtle background: the level that is currently winning has a `#1565C0` left border (4px) and light blue background.

SUPPRESSED rows show a secondary label: "Suppressed by L[N]" indicating which higher-level rule is blocking this level.

#### Divergence Indicator

Divergence constitutes: the PRE computed output (what PRE says should be showing) differs from the delivery log (what the device last confirmed delivering).

If no divergence: green status card at the top of the tab: "✓ PRE CONSISTENT — Delivery confirmed matches PRE output. Confidence: [HIGH/MEDIUM/LOW]"

If divergence detected: amber/red warning card at the top of the tab:

```
┌───────────────────────────────────────────────────────────────────┐
│  ⚠ PRE DIVERGENCE DETECTED                                        │
│                                                                    │
│  PRE resolution output: [CONTENT_NAME] (L3)                       │
│  Last confirmed delivery: [CONTENT_NAME_B] (stale — 4m 22s ago)  │
│                                                                    │
│  Possible causes: device offline, HDMI input changed, network     │
│  partition, stale manifest.                                        │
│                                                                    │
│  Confidence: LOW                                                   │
│  [Investigate in Replay Workspace]                                 │
└───────────────────────────────────────────────────────────────────┘
```

Divergence card background: `#E65100` at 10% opacity. Border: 2px solid `#E65100`.

#### Confidence Indicator Rules

Confidence is a server-computed value (`HIGH | MEDIUM | LOW | NONE`) and must always be displayed alongside the PRE status.

- NONE: displayed only when delivery log is unavailable. Label reads: "Confidence: NONE — delivery confirmation unavailable. PRE configuration is authoritative but delivery cannot be verified."
- NONE confidence does not suppress the PRE resolution breakdown — it annotates it.

#### Polling vs WebSocket

PRE resolution state: polled every 15 seconds. A small "Last updated [N]s ago" label appears in the top right of the section, updating each second to show data age. Operators can see staleness without manual action.

If the PRE endpoint is returning errors: a degraded mode banner appears: "PRE status temporarily unavailable — last known state shown. Timestamp: [TIME]." The breakdown table remains visible with a grey "STALE" badge on each row.

---

### Tab 5: Incident Actions

**Purpose:** State machine controls. Severity escalation. Incident lifecycle transitions. This tab contains the highest-consequence write controls on the surface.

**Visible to:** OPERATOR+ with relevant authority. VIEWER: tab is readable but all write controls absent (not disabled — absent). In REPLAY mode: all write controls absent (IC-03).

#### Escalate Severity

Section heading: "Severity"

Current severity shown as a badge (Section 2.2). Next to it: [Escalate Severity] button.

Who can use it: OPERATOR+ for any escalation (severity increase). ADMIN only for de-escalation of S1–S2.

**Escalation flow (inline, not modal):**

```
Escalate severity to:
  ○ S4 — MINOR       (current: S5)
  ○ S3 — MAJOR
  ○ S2 — CRITICAL
  ○ S1 — EMERGENCY

Reason (required): [text field, min 10 characters]

[Cancel]    [Escalate]
```

Only higher severity options are shown when escalating. The selected option is highlighted.

#### Cannot Reduce Severity (OPERATOR Role)

For OPERATOR role attempting to de-escalate an S1 or S2 severity: the severity control renders with a note below the current badge: "De-escalation of S1–S2 severity requires ADMIN role. Contact your administrator." No de-escalation controls are shown to OPERATOR for S1–S2. This is not a disabled button — the controls are absent.

For S3–S5 de-escalation (any OPERATOR+): the escalation inline form shows lower severity options including a "De-escalate" section above the "Escalate" section.

**Severity_high_water enforcement:** If an operator attempts to escalate to a severity already held historically (e.g., incident was S2 and is now S3, operator tries to set to S2): the form accepts this — re-escalating to the historical peak is valid. The `severity_high_water` is the maximum, not a lock on re-elevation.

#### Transition: WATCHING → DECLARED

When `current_state = WATCHING`, a prominent action card appears:

```
┌───────────────────────────────────────────────────────────────────┐
│  This incident is in WATCHING state — no commander is assigned.   │
│                                                                    │
│  [Declare Incident and Assume Command]                            │
│                                                                    │
│  Declaring assigns you as Incident Commander.                     │
│  You will be responsible for driving this incident to resolution. │
└───────────────────────────────────────────────────────────────────┘
```

No further confirmation required — the button text is explicit enough. On tap: audit event emitted (IC-04), POST to transition endpoint. UI updates after server confirmation (IC-01).

#### Transition: DECLARED → CONTAINED

Section heading: "Containment"

Button label: "Mark Incident Contained"

Who can use it: Commander only (OPERATOR+ who is current `commander_id`) for S3–S5. ADMIN required for S1–S2.

**S3–S5 DECLARED → CONTAINED (commander only):**

Tapping [Mark Incident Contained] shows inline confirmation:

```
Mark this incident CONTAINED?

CONTAINED means: the immediate risk is neutralized.
The root cause may not yet be fully resolved.

You can move to RESOLVED once root cause is documented.

[Confirm — Mark Contained]    [Cancel]
```

On confirm: POST to transition endpoint. Audit event IC-04. UI update after server confirmation IC-01.

**S1–S2 DECLARED → CONTAINED (ADMIN required):**

For OPERATOR (non-ADMIN) viewing an S1 or S2 incident: the "Mark Incident Contained" section shows: "S1–S2 containment requires ADMIN approval. An ADMIN must mark this incident CONTAINED." The button is absent (not disabled — absent).

For ADMIN viewing an S1 or S2 incident in DECLARED state: [Mark Incident Contained — ADMIN Action] button is shown. Tapping it shows:

```
Mark S[N] incident CONTAINED?

This is an S[N] [SEVERITY_LABEL] incident.
ADMIN acknowledgement is required and will be recorded in the audit trail.

Your acknowledgement will be recorded as: ADMIN_CONTAINED_ACKNOWLEDGED
This record is permanent and cannot be removed.

[Confirm — ADMIN Acknowledges Containment]    [Cancel]
```

On confirm: POST emits ADMIN_CONTAINED_ACKNOWLEDGED event and transitions state. All subsequent UI updates after server confirmation only (IC-01).

#### Transition: CONTAINED → RESOLVED

Section heading: "Resolution"

This section is only rendered when `current_state = CONTAINED`. In all other states this section is absent.

**For S1–S2:** Additionally, the section renders only if ADMIN_CONTAINED_ACKNOWLEDGED event is present in the audit trail. If ADMIN acknowledgement is absent, this section shows: "ADMIN must acknowledge CONTAINED state before resolution is available. Waiting for ADMIN acknowledgement."

The resolution form (inline, not modal):

```
┌───────────────────────────────────────────────────────────────────┐
│  Resolve this incident                                             │
│                                                                    │
│  PRE Verification: [✓ VERIFIED — PRE resolved without error]     │
│                 or [⚠ PRE verification pending — cannot resolve] │
│                 or [✗ PRE in error state — cannot resolve]       │
│                                                                    │
│  Resolution reason:                                               │
│  [Dropdown — select one:]                                         │
│    CAUSE_IDENTIFIED_AND_FIXED                                      │
│    CAUSE_IDENTIFIED_MONITORING                                     │
│    CAUSE_UNKNOWN_MONITORING                                        │
│    EXTERNAL_RESOLUTION                                             │
│    FALSE_POSITIVE                                                  │
│                                                                    │
│  Resolution annotation (minimum 50 characters required):          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ [textarea, 5 rows]                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  [N / 2000 characters]  — [50 characters minimum not met ⚠]      │
│                                                                    │
│  [Cancel]                              [Resolve Incident]         │
└───────────────────────────────────────────────────────────────────┘
```

**Character count enforcement for resolution_annotation:**

- 0–49 characters: counter shown in `#C62828` red. Label: "[N] / 2000 — 50 minimum not met ⚠". [Resolve Incident] button inactive.
- 50–2000 characters: counter shown in `#2E7D32` green. Label: "[N] / 2000". [Resolve Incident] button active (if other conditions met).
- Over 2000 characters: textarea input blocked. Counter shown in red: "2000 / 2000 — maximum reached."

**PRE verification status:** The system computes and displays PRE verification status in real time. If PRE is in error state: [Resolve Incident] button is absent (not disabled — absent). The label reads: "Incident cannot be resolved while PRE is in error state. Resolve PRE error first." A link: [View PRE Status — Tab 4].

If PRE verification passes: the form proceeds and `pre_verification_at_closure` is set by the system at transition time.

On [Resolve Incident]: audit event emitted (IC-04), POST to transition endpoint. UI updates after server confirmation only (IC-01). On success: the entire surface transitions to RESOLVED read-only rendering (Section 6.5).

---

### Tab 6: Evidence Package (ADMIN Only)

This tab exists in the DOM only for ADMIN role. For OPERATOR and VIEWER, this tab is absent — not rendered, not in the tab strip, not accessible via keyboard navigation.

**Purpose:** Counterfactual analysis, evidence export, and forensic package generation.

**Sections:**

#### Section A — Counterfactual Analysis

Heading: "Counterfactual Analysis — ADMIN only"

Allows ADMIN to define an alternative scenario: "If [factor X] had not been present, what would PRE have resolved?"

Controls:
- Factor selector: "Remove this override from the scenario" / "Remove this campaign from the scenario" / "Assume venue was HEALTHY at [time]"
- [Run Counterfactual] button — triggers PRE computation with modified inputs
- Results appear below in the same level-by-level breakdown format as Tab 4, labeled "Counterfactual result — this is a simulation, not operational state"

Counterfactual results are read-only and labeled at all times. They cannot be applied to production state from this view.

#### Section B — Evidence Export

Heading: "Export Evidence Package"

Controls:
- Checkboxes for inclusion:
  - [x] Full audit trail (all events for this incident)
  - [x] Command log (all OPERATOR_NOTE events)
  - [x] PRE resolution snapshots at key timestamps
  - [x] Override history for incident scope
  - [ ] Delivery logs for incident scope (large file — warning shown)
  - [ ] Counterfactual analysis results (if run)
- Scope: "Export for: [VENUE_NAME] (current scope)" — read only
- Format: JSON (default) / PDF summary

[Generate Evidence Package] button. On tap: job submitted. Progress indicator shown. Download link provided when ready. All export actions logged to audit trail.

#### Section C — Correlation Assignment

Heading: "Incident Correlation — ADMIN only"

`correlation_id` field: text input, placeholder "Assign correlation ID (e.g., INFRA-2026-001)". Current value shown if set. [Save] button. Saves via PUT to `/incidents/{id}/correlation`.

Explanation: "Correlation groups incidents sharing a root cause. This does not merge incidents."

---

## 5. Zone C — Contextual Panel During Incident

Zone C is 320px, collapsible from the right, defaulting to expanded on the IC Surface.

### 5.1 Default Zone C Content on IC Surface

Zone C on the IC Surface contains three panels in a vertical stack, each collapsible with a toggle:

**Panel R1 — Incident-Scoped Alert Stream**

Heading: "Alerts — this incident"

An alert stream filtered to alerts bearing this `incident_id` or scoped to the same venue + generated after `declared_at`. Shows the 20 most recent alerts, ordered newest first. Each alert:

```
[SEVERITY_ICON] [ALERT_TITLE] — [AGE]
[Brief description, max 2 lines]
```

A toggle at the top right: "Incident only / All venue alerts". Default: "Incident only".

**Panel R2 — Related Incidents**

Heading: "Related Incidents"

Shows parent incident (if `parent_incident_id` set) and child incidents (incidents referencing this one as parent). Each shown as:

```
[DIRECTION] [INCIDENT_ID] — [SEVERITY_BADGE] — [STATE]
[Declared: DATE] — [Scope]
[Open ↗]
```

DIRECTION: "↑ Parent" or "↓ Child" — with arrow indicating relationship direction.

If no related incidents: "No related incidents. An ADMIN can link this incident to a parent via the Evidence Package tab."

Correlation group: if `correlation_id` is set, shows: "Correlation group: [CORRELATION_ID] — [N other incidents in this group]" with a [View group] link.

**Panel R3 — Presence Indicator**

Heading: "Currently viewing this incident"

A live-updating list of operators currently on `/incidents/:incident_id`:

```
[AVATAR_INITIALS] [OPERATOR_NAME] — [ROLE_BADGE]
[Commander badge if this operator is commander]
[Active since: HH:mm]
```

Presence is derived from WebSocket session tracking. Operators who have not sent a heartbeat in 30 seconds are shown as "(inactive)" and removed after 60 seconds of silence.

If `current_state = COMMANDER_LAPSED`: each non-commander operator entry shows a small [Assume Command] button next to their name as a reminder that they can act.

---

## 6. State Variations

### 6.1 WATCHING State

When `current_state = WATCHING`:
- Incident Identity Bar: state pill shows "WATCHING" (dark slate)
- Duration clock: not shown
- Commander field: "No commander assigned"
- Tab 5: shows "Declare Incident and Assume Command" card prominently, at the top of the tab
- Tab 2 (Command Log): shows INCIDENT_DECLARED event and any subsequent WATCHING-state events
- Tab 3: overrides can be viewed but the [Place Override] action is available only to OPERATOR+; the incident link on placed overrides will reference this incident
- Zone C Panel R3: shows any operators currently viewing

No zone B replacement is forced in WATCHING state for any role.

### 6.2 DECLARED State

Normal operating mode of the IC Surface. All tabs fully rendered per their specifications above. Zone B replacement is automatic for OPERATOR+ (for S1–S2: forced and undismissable until CONTAINED).

### 6.3 CONTAINED State

- State pill: "CONTAINED" in dark green
- Incident Identity Bar: duration clock continues running
- Tab 5 "Containment" section: shows "Incident is CONTAINED. Move to RESOLVED when root cause is documented." The [Mark Incident Contained] button is absent.
- Tab 5 "Resolution" section: now visible (Section 4.5 resolution form rendered)
- For S1–S2: Tab 5 "Resolution" section shows ADMIN acknowledgement requirement (Section 4.5)
- All other tabs: unchanged from DECLARED

Zone B replacement is released in CONTAINED state — operators can navigate away. The System Status Bar incident banner remains.

### 6.4 COMMANDER_LAPSED Rendering

Full specification:

**What changes when COMMANDER_LAPSED is entered:**

1. Incident Identity Bar right group: replaced by COMMANDER_LAPSED indicator (Section 2.4) — red background, former commander name, lapsed duration clock, countdown to Level 1 alert, [Assume Command] button.

2. Full-width amber warning banner injected between Incident Identity Bar and tab system:
   - Background: `#F57F17` (amber) at 20% opacity
   - Border bottom: 2px solid `#F57F17`
   - Text: "⚠ No incident commander — this incident is unmanaged. Any OPERATOR+ can assume command."
   - [Assume Command] button inline in the banner (32px, amber border, amber text)

3. System Status Bar: background shifts to `#B71C1C` for all operators on this surface.

4. Zone A "Incidents" nav item: pulsing red dot (8px diameter, 1-second pulse on a 2-second cycle).

5. Tab 5 (Incident Actions): all commander-exclusive actions are absent (no [Mark Incident Contained], no [Transfer Command]). A note card appears at the top of Tab 5: "No commander is assigned. Assume command to access incident actions."

**What controls are restricted (absent) in COMMANDER_LAPSED:**
- [Mark Incident Contained]
- [Transfer Command]
- [Escalate Severity] (if the escalation form requires commander authority) — OPERATOR+ may still escalate severity as it does not require commander status per the information model

**What the countdown looks like:**
- "Level 1 alert in: MM:SS" — live-updating every second
- Under 3 minutes remaining: text color shifts to bright red `#FF8A80` and the count pulses (opacity 100%→60% on a 1-second cycle, repeating)
- At 0:00: countdown stops and changes to "Level 1 alert FIRED" in static red. The COMMANDER_LAPSED_ALERT_FIRED event is logged.

**No automatic state change occurs at 0:00 other than the alert firing.** The incident remains in COMMANDER_LAPSED state until an OPERATOR+ claims command.

### 6.5 RESOLVED State (Read-Only Historical View)

When `current_state = RESOLVED`:

- Incident Identity Bar: state pill "RESOLVED" (grey). Severity badge remains. Duration clock stops and shows final duration: "Duration: [H]h [M]m [S]s — RESOLVED".
- All write controls absent from the entire surface — Tab 3 [Place Override] absent, Tab 5 all action buttons absent, Tab 2 [Add Annotation] absent. This is not a REPLAY mode indicator — it is the natural terminal state.
- A resolved summary card is shown at the top of Tab 1 (Situation Overview):

```
┌───────────────────────────────────────────────────────────────────┐
│  ✓ INCIDENT RESOLVED                                              │
│                                                                    │
│  Resolved by: [OPERATOR_NAME] at [TIMESTAMP]                      │
│  Resolution reason: [RESOLUTION_REASON_ENUM]                      │
│                                                                    │
│  Resolution annotation:                                            │
│  "[FULL RESOLUTION_ANNOTATION TEXT]"                              │
│                                                                    │
│  PRE verified at closure: ✓ [HASH — 8 characters displayed]      │
└───────────────────────────────────────────────────────────────────┘
```

- Tab 6 (ADMIN): Evidence export remains available. Counterfactual analysis remains available. Both are read-only analytical functions on a historical record.
- A note at the top of Tab 5: "This incident is resolved. To re-open a related issue, declare a new incident with this incident as parent."

### 6.6 EMERGENCY_FREEZE Overlay Behavior

When an S1 EMERGENCY_FREEZE incident is in DECLARED state:

- A full-width red overlay banner is fixed at the top of Zone B (below the Incident Identity Bar, above the tabs): "🔴 EMERGENCY_FREEZE ACTIVE — All non-emergency content suppressed across [SCOPE]." Background: `#C62828`. Text: white, 14px bold.
- Zone A non-critical nav items are suppressed (Section 3.2).
- The [Back] browser control is intercepted and suppressed. Navigation away from the IC Surface is blocked for the current commander.
- For non-commander OPERATOR+ users: navigation away is permitted but a departure confirmation appears: "You are leaving an active EMERGENCY_FREEZE incident. Are you sure?"
- VIEWER role: no navigation suppression.

---

## 7. IC Transfer Flow

### 7.1 Initiating Transfer (Commander)

Only the current commander sees [Transfer Command] in the Incident Identity Bar. Tapping it opens an inline panel (not a modal) that slides out from the right of the Incident Identity Bar:

```
┌───────────────────────────────────────────────────────────────────┐
│  Transfer Incident Command                                        │
│                                                                    │
│  Select recipient:                                                │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ [OPERATOR_A] — OPERATOR — Currently viewing this incident   │  │
│  │ [OPERATOR_B] — ADMIN — Active in venue                      │  │
│  │ [Other operator...] — [search field]                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Transfer note (optional):                                        │
│  [text field, placeholder: "Handoff context for incoming IC..."] │
│                                                                    │
│  [Cancel]                              [Initiate Transfer]       │
└───────────────────────────────────────────────────────────────────┘
```

Operators currently viewing the IC Surface are listed first, then all OPERATOR+ with venue access, alphabetical.

### 7.2 30-Second Mandatory Review Period

On [Initiate Transfer]: a POST to `/incidents/{id}/command/transfer` is made. The system enters a 30-second review period.

**What is shown during the 30-second review period:**

For the initiating commander: the [Transfer Command] panel is replaced by:

```
Transfer initiated. [RECIPIENT_NAME] is reviewing the handoff.
Waiting: [30] seconds remaining.
[Cancel Transfer] — available until recipient acknowledges
```

For the recipient: a high-priority notification banner appears at the top of their current viewport (regardless of which surface they are on):

```
┌───────────────────────────────────────────────────────────────────┐
│  ⚡ INCIDENT COMMAND TRANSFER                                      │
│                                                                    │
│  [OUTGOING_COMMANDER_NAME] is transferring command of             │
│  Incident [INCIDENT_ID] ([SEVERITY_BADGE]) to you.               │
│                                                                    │
│  Review incident before accepting:                               │
│  Severity: [S[N] LABEL]   State: [STATE]   Duration: [HH:MM]    │
│  [TRANSFER_NOTE if provided]                                      │
│                                                                    │
│  [Review Incident]   [Accept Command]   [Decline]                │
│                                                                    │
│  Accepting in: [28] seconds (auto-decline if no action)          │
└───────────────────────────────────────────────────────────────────┘
```

**What is blocked during the 30-second review period:**
- Commander-exclusive write actions (mark contained, place L6 override) are suspended for the initiating commander
- The recipient cannot yet access commander-exclusive controls — they are in "pending" state
- No other actions on the surface are blocked

### 7.3 Transfer Confirmation Requirements

The recipient must take an explicit action within 30 seconds. Auto-decline occurs if no action is taken. On [Accept Command]: COMMAND_TRANSFERRED event is written. Commander identity updates across all active sessions (WebSocket push).

On [Decline]: transfer is cancelled. Initiating commander regains full authority. A toast appears for the initiating commander: "[RECIPIENT_NAME] declined the transfer."

On auto-decline: same as [Decline]. Toast: "[RECIPIENT_NAME] did not respond within 30 seconds. Transfer cancelled."

### 7.4 COMMANDER_LAPSED — No Claim Within 15 Minutes

If COMMANDER_LAPSED state persists for 15 minutes without any OPERATOR+ claiming command:
- COMMANDER_LAPSED_ALERT_FIRED event is written to audit trail
- Level 1 constitutional alert fires for ALL OPERATOR+ users with access to this venue's scope — not just those currently on the IC Surface
- The alert notification includes: incident ID, severity, time lapsed, direct deep link with [Claim Command] CTA
- The IC Surface countdown changes from "Level 1 alert in: 00:00" to "Level 1 alert FIRED — [TIME_OF_FIRE]"
- The 15-minute clock does not restart. The Level 1 alert remains active until command is claimed.

---

## 8. Interactive Controls — Complete Inventory

| Control | Label | Tab / Location | Role required | State required | Confirmation required |
|---------|-------|---------------|---------------|---------------|----------------------|
| Copy incident ID | [INC-ID] (tappable) | Incident Identity Bar | Any | Any | None — toast on copy |
| Assume Command | "Assume Command" | Identity Bar / LAPSED banner / Tab 5 note | OPERATOR+ | COMMANDER_LAPSED | Inline card confirmation |
| Transfer Command | "Transfer Command" | Incident Identity Bar | Commander only | DECLARED or CONTAINED | Inline transfer panel + 30s review |
| Add log annotation | "Add Annotation" | Tab 2 | OPERATOR+ | Non-RESOLVED, Non-REPLAY | None — submit is confirmation |
| Place Override | "Place Override" | Tab 3 | OPERATOR+ | Non-RESOLVED, Non-REPLAY | Preview required for L1–L3; inline confirmation for all |
| Place L6 Override | "Place L6 Override" | Tab 3 | ADMIN | Non-RESOLVED, Non-REPLAY | Must type "EMERGENCY" exactly |
| Remove Override | "Remove Override" | Tab 3 | OPERATOR+ | Non-RESOLVED, Non-REPLAY | Inline confirmation; "CONFIRM REMOVAL" text required for L5–L6 |
| Declare Incident | "Declare Incident and Assume Command" | Tab 5 | OPERATOR+ | WATCHING | Button text is explicit — no extra confirmation |
| Escalate Severity | "Escalate Severity" | Tab 5 | OPERATOR+ | Non-RESOLVED | Inline form with reason field |
| De-escalate Severity | Within severity section | Tab 5 | OPERATOR+ (S3–S5); ADMIN (S1–S2) | Non-RESOLVED | Inline form with reason field |
| Mark Contained (S3–S5) | "Mark Incident Contained" | Tab 5 | Commander | DECLARED, S3–S5, Non-REPLAY | Inline confirmation card |
| Mark Contained (S1–S2) | "Mark Incident Contained — ADMIN Action" | Tab 5 | ADMIN | DECLARED, S1–S2, Non-REPLAY | Inline confirmation with ADMIN_CONTAINED_ACKNOWLEDGED notice |
| Resolve Incident | "Resolve Incident" | Tab 5 | Commander (non-ADMIN) or ADMIN | CONTAINED, PRE verified | resolution_annotation (50 char min), resolution_reason required |
| Run Counterfactual | "Run Counterfactual" | Tab 6 | ADMIN | Non-WATCHING | None |
| Export Evidence Package | "Generate Evidence Package" | Tab 6 | ADMIN | Any | None — confirmation is checkbox selection |
| Save Correlation ID | "Save" | Tab 6 | ADMIN | Any | None |
| Open in Replay Workspace | "Open in Replay Workspace" | Tab 1 | OPERATOR+ | Any | None — navigation |
| View PRE Status | "View PRE Status — Tab 4" | Tab 5 (resolution section) | OPERATOR+ | CONTAINED | None — navigation |

**Controls absent for VIEWER role (not disabled — absent from DOM):**
- Add Annotation
- Place Override / Place L6 Override
- Remove Override
- Declare Incident
- Escalate / De-escalate Severity
- Mark Contained
- Resolve Incident
- Assume Command
- Transfer Command
- All Tab 6 write controls (Tab 6 itself absent for non-ADMIN)

**Controls disabled (absent, not just greyed) during COMMANDER_LAPSED:**
- Mark Incident Contained (requires active commander)
- Transfer Command (no commander to transfer from — button absent)
- [Resolve Incident] is also absent — CONTAINED state is required first and cannot be reached without a commander marking containment

---

## 9. Real-Time Update Behavior

### 9.1 What Updates Live Without Operator Interaction

All the following update via WebSocket subscription to the incident's event stream. No manual refresh required.

| Data | Update mechanism | Update latency |
|------|-----------------|---------------|
| Incident state (`current_state`) | WebSocket push | ≤ 2 seconds from state change |
| Commander identity (`commander_id`) | WebSocket push | ≤ 2 seconds from COMMAND_TRANSFERRED event |
| Severity badge | WebSocket push | ≤ 2 seconds from SEVERITY_CHANGED event |
| Duration clock | Local computation from `declared_at` | Continuous — second-by-second |
| COMMANDER_LAPSED countdown | Local computation from lapse timestamp | Continuous — second-by-second |
| COMMANDER_LAPSED_ALERT countdown | Local computation from lapse timestamp | Continuous — second-by-second |
| Presence indicator (Zone C R3) | WebSocket heartbeat | ≤ 30 seconds |

### 9.2 Command Log — Append-Only Live Updates

The command log (Tab 2) receives entries via WebSocket. The subscription is to all `OPERATOR_NOTE`, `INCIDENT_STATE_CHANGED`, `SEVERITY_CHANGED`, `COMMAND_TRANSFERRED`, and `COMMANDER_LAPSED_ALERT_FIRED` events on this `incident_id`.

New entries arrive in real time and are appended at the bottom of the log list. If auto-scroll is ON (default), the list scrolls to show the new entry. If the operator has manually scrolled up, auto-scroll is suspended and a toast appears: "[N] new entries — scroll to latest ↓".

The command log is never polled. Loss of WebSocket connection: a reconnect attempt is made every 5 seconds. During reconnect, a banner appears: "Command log feed interrupted — reconnecting... Last received: [TIMESTAMP]."

### 9.3 PRE State — Polling

PRE resolution state (Tab 4) is polled every 15 seconds from the PRE resolution endpoint. It is not delivered via WebSocket — PRE resolution is a compute-on-demand operation, not a push event.

The "Last updated [N]s ago" counter increments each second between polls. At 15 seconds, the poll fires and the counter resets. If the poll fails: the counter continues incrementing, background shifts to amber at 30 seconds of staleness, red at 60 seconds.

### 9.4 Alert Stream — Zone C R1

Zone C Panel R1 (incident-scoped alerts) receives entries via WebSocket. The same reconnect behavior as the command log applies.

---

## 10. Audit Events Emitted

Every user action on this surface emits an audit event at the time of action attempt, before server confirmation (IC-04).

| User action | Audit event | Domain:entity:action format |
|------------|------------|----------------------------|
| Operator navigates to `/incidents/:id` | `incident:view:opened` | incident:view:opened |
| Operator taps [Assume Command] and confirms | `incident:command:claimed` | incident:command:claimed |
| Operator taps [Transfer Command] and initiates | `incident:command:transfer_initiated` | incident:command:transfer_initiated |
| Recipient accepts transfer | `incident:command:transfer_accepted` | incident:command:transfer_accepted |
| Recipient declines transfer | `incident:command:transfer_declined` | incident:command:transfer_declined |
| Transfer auto-declined (timeout) | `incident:command:transfer_expired` | incident:command:transfer_expired |
| Operator submits annotation | `incident:log:annotation_submitted` | incident:log:annotation_submitted |
| Operator taps [Place Override] and confirms | `incident:override:place_attempted` | incident:override:place_attempted |
| Operator taps [Place L6 Override] and confirms | `incident:override:l6_place_attempted` | incident:override:l6_place_attempted |
| Operator taps [Remove Override] and confirms | `incident:override:remove_attempted` | incident:override:remove_attempted |
| Operator taps [Declare Incident] | `incident:state:declare_attempted` | incident:state:declare_attempted |
| Operator taps [Escalate Severity] and submits | `incident:severity:escalate_attempted` | incident:severity:escalate_attempted |
| Operator taps de-escalate and submits | `incident:severity:deescalate_attempted` | incident:severity:deescalate_attempted |
| Operator taps [Mark Incident Contained] and confirms | `incident:state:contain_attempted` | incident:state:contain_attempted |
| ADMIN taps [Mark Incident Contained — ADMIN] and confirms | `incident:state:admin_contain_attempted` | incident:state:admin_contain_attempted |
| Operator taps [Resolve Incident] | `incident:state:resolve_attempted` | incident:state:resolve_attempted |
| ADMIN runs counterfactual analysis | `incident:forensics:counterfactual_run` | incident:forensics:counterfactual_run |
| ADMIN requests evidence export | `incident:forensics:export_requested` | incident:forensics:export_requested |
| ADMIN saves correlation ID | `incident:correlation:set_attempted` | incident:correlation:set_attempted |

All events include: `event_id`, `incident_id`, `operator_id`, `governed_timestamp`, `surface: incident_command_v2`.

---

## 11. Forbidden Patterns

The following must never occur on the Incident Command Surface.

**Violation of IC-01 (Write-confirm-then-update):**
Never update UI state optimistically before server confirmation. If the POST to claim command fails, the COMMANDER_LAPSED indicator must remain visible. If the PUT to place an override fails, the override must not appear in Tab 3.

**Violation of IC-02 (Rejection surfacing inline):**
API rejections must never surface as modal dialogs. They appear inline: below the field that caused the rejection, or below the action button. Example: if [Resolve Incident] is rejected because `resolution_annotation` is under 50 characters at the API level (even if the client counted 50+), the error appears below the annotation textarea, not as a blocking popup.

**Violation of IC-03 (REPLAY mode write controls):**
In REPLAY mode, zero write controls are rendered anywhere on this surface. No buttons, no form inputs, no confirmation dialogs. All tabs are readable. A persistent banner below the Incident Identity Bar reads: "REPLAY MODE — This is a historical view. No actions can be taken." Background: `#1565C0` at 20% opacity.

**Violation of IC-04 (Audit before confirmation):**
Audit events must be emitted at the moment the operator initiates the action (taps the button that triggers the write), not at the moment the server responds. This ensures actions that produce server errors are still recorded.

**Violation of IC-05 (Emergency interrupt priority):**
Level 1 and Level 2 interrupts must override any open modal confirmation on this surface. If an operator has opened the [Transfer Command] panel and a Level 1 alert fires, the alert takes priority. The transfer panel is dismissed. A toast informs the operator: "Transfer cancelled — emergency interrupt received."

**Severity reduction without proper authority:**
No de-escalation controls for S1–S2 are rendered for OPERATOR role. If such a control is somehow accessible and the server rejects it (403), the error appears inline: "S1–S2 severity changes require ADMIN authority. This action was rejected and recorded."

**Tab 6 accessible to non-ADMIN:**
Tab 6 must be absent from the DOM for OPERATOR and VIEWER roles. It must not be a hidden element, a disabled tab, a greyed label, or a locked panel. It is not present. If a non-ADMIN user navigates directly to a URL fragment that would select Tab 6, the surface defaults to Tab 1 silently.

**Showing write controls in RESOLVED state:**
RESOLVED is a terminal state. The surface renders no write controls when `current_state = RESOLVED`. This is distinct from REPLAY mode — RESOLVED is a permanent production state, not an investigative mode. No "re-open" button exists on this surface. A new incident must be declared separately.

**Navigating away during EMERGENCY_FREEZE (commander):**
The current commander cannot navigate away from the IC Surface during an S1 EMERGENCY_FREEZE DECLARED state. The browser [Back] control is intercepted. Zone A navigation links trigger a confirmation that reads: "You are the Incident Commander during an EMERGENCY_FREEZE. Leaving this surface does not transfer command. Confirm you intend to navigate away." Navigation proceeds only if the operator confirms.

**Fabricating PRE verification:**
The `pre_verification_at_closure` value is set by the system at the time of the RESOLVED transition, from the live PRE computation. The UI must never allow the operator to assert PRE verification manually or bypass the server-side verification. If PRE verification is unavailable at closure time, the [Resolve Incident] button must be absent.

**Inline severity badge misrepresenting high-water mark:**
If `severity_high_water` differs from current `severity`, the high-water indicator ("Peak: S[N]") is always shown and cannot be hidden by any operator action or setting. It is a permanent audit disclosure, not a removable annotation.

---

*End of CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md*
*Document authority: Agent 3 (UX/Design)*
*API contracts (transition endpoints, command claim/transfer, PRE verification): Agent 1 (Platform)*
*Override data model: Agent 2 (CMS)*
*Incident state machine enforcement: Agent 1 (Platform), INCIDENT-INFORMATION-MODEL-v1.md*
