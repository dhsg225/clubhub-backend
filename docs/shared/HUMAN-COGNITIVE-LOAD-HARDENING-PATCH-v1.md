# Human Cognitive Load Hardening Patch — v1

**Document type:** UX hardening patch
**Scope:** All 5 operator surfaces, 50 wireframes
**Source audit:** HUMAN-FACTORS-AND-OPERATIONAL-ERGONOMICS-AUDIT-v1.md
**Date:** 2026-06-02
**Status:** AUTHORITATIVE — supersedes any conflicting interaction specification in referenced wireframes

---

## Purpose

This document applies targeted interaction and perceptual hardening to the ClubHub TV operator wireframes. Every patch addresses a specific human error risk identified in the Human Factors Audit. No new surfaces, workflows, roles, governance rules, or system states are introduced. All patches are surgical modifications to existing interaction specifications within existing wireframes.

---

## Hardening Requirements Addressed

| Req | Description | Patches |
|---|---|---|
| R-1 | Reduce cognitive load per second of operation | PATCH-016, PATCH-017, PATCH-018, PATCH-019, PATCH-020 |
| R-2 | Increase salience of critical system states | PATCH-004, PATCH-005, PATCH-007, PATCH-009, PATCH-010, PATCH-011, PATCH-012 |
| R-3 | Remove ambiguity in state transitions | PATCH-013, PATCH-014, PATCH-015 |
| R-4 | Eliminate silent mutations | PATCH-004, PATCH-005, PATCH-006, PATCH-007, PATCH-008 |
| R-5 | Eliminate typed confirmation under stress | PATCH-001, PATCH-002, PATCH-003 |

---

## Patch Registry

---

### PATCH-001: Replace L6 Emergency Override typed confirmation with chip-select + toggle

**Requirement:** R-5 — Eliminate typed confirmation under stress
**Audit reference:** HF-IC-1 (CRITICAL)
**Wireframes modified:** WF-IC-06
**Surfaces affected:** Incident Command Surface — Tab 3 Override Management

#### Before

The L6 override confirmation required the ADMIN to type the exact string `EMERGENCY` (case-sensitive, no trailing characters) into a free-text input before the [Place L6 Override] button would activate. Any deviation (trailing space, wrong case, autocorrect substitution) silently failed with only a generic "does not match exactly" message.

```
To confirm this is intentional, type the word EMERGENCY below:
┌─────────────────────────────┐
│ [free text input]           │  ← Case-sensitive exact match required
└─────────────────────────────┘
[Place L6 Override] — inactive until "EMERGENCY" typed
```

#### After

Replace the free-text input with a structured three-action confirmation sequence. All three actions must be completed for [Place L6 Override] to activate. None require keyboard typing.

```
┌───────────────────────────────────────────────────────────────────┐
│  ⚠ LEVEL 6 — EMERGENCY OVERRIDE                                   │
│                                                                    │
│  This override operates at the highest authority level.           │
│  It will suppress ALL content including L1–L5 overrides.         │
│  It will NEVER auto-expire. You must manually remove it.          │
│  L6 overrides are permanent audit records — they cannot be        │
│  deleted from the system.                                         │
│                                                                    │
│  Confirm all three before placing:                                │
│                                                                    │
│  Step 1 — Confirm intent                                          │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  This override is necessary and I have authority to      │     │
│  │  place it.                                               │     │
│  │                                            [✓ Confirm]  │     │
│  └──────────────────────────────────────────────────────────┘     │
│  ● Step 1 complete                                                 │
│                                                                    │
│  Step 2 — Confirm scope                                           │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  I understand ALL existing content including active      │     │
│  │  overrides will be suppressed on the affected scope.     │     │
│  │                                            [✓ Confirm]  │     │
│  └──────────────────────────────────────────────────────────┘     │
│  ○ Step 2 locked until Step 1 complete                            │
│                                                                    │
│  Step 3 — Confirm permanence                                      │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  I understand this override will NEVER auto-expire and   │     │
│  │  must be manually removed.                               │     │
│  │                                            [✓ Confirm]  │     │
│  └──────────────────────────────────────────────────────────┘     │
│  ○ Step 3 locked until Step 2 complete                            │
│                                                                    │
│  [Place L6 Override] ← active only when all 3 steps confirmed    │
│  [Cancel — discard all confirmations]                             │
└───────────────────────────────────────────────────────────────────┘
```

**Step interaction rules:**
- Each [✓ Confirm] chip is a large, tappable button (minimum 44px height, full card width)
- Steps unlock sequentially — Step 2 becomes interactive only after Step 1 is confirmed
- Each confirmed step turns its header from grey to green and shows "● Step N complete"
- Navigating away (tab switch or surface navigation) resets all step confirmations to unconfirmed — the ADMIN must complete all three steps in one sequence
- [Place L6 Override] is absent from the DOM (not disabled) until all 3 steps are confirmed
- On all-steps-confirmed: [Place L6 Override] renders as a full-width deep red button at the bottom of the confirmation panel

**What is unchanged:**
- The L6 override itself — its authority level, scope, permanence, and audit behavior
- The preceding level selector, content picker, scope picker, and reason field
- The governance requirement that an ADMIN role is required
- The audit event emitted before the write (IC-04)

**Rationale:**
Typed confirmation under fine-motor stress produces silent failures when trailing characters or autocorrect substitutions are present. The three-chip sequential confirmation requires only pointer actions (click/tap), is immune to keyboard input errors, and cannot be bypassed by speed — each step must be individually confirmed. The sequential lock prevents the operator from "clicking through" all three steps at once. Time-to-complete for a deliberate operator: approximately 8–12 seconds. This is acceptable for an L6 action that carries permanent consequences.

**Architectural/governance impact:** None. The confirmation mechanism changes. The L6 override entity, its authority, its permanence, and its audit trail are unchanged.

---

### PATCH-002: Replace L6 Override Removal typed confirmation with hold-to-confirm

**Requirement:** R-5 — Eliminate typed confirmation under stress
**Audit reference:** HF-IC-1 (CRITICAL, related)
**Wireframes modified:** WF-IC-05, WF-IC-06
**Surfaces affected:** Incident Command Surface — Tab 3 Override Management; Live Operations Surface — Section 4

#### Before

L6 override removal required typing "CONFIRM REMOVAL" (exact string, case-sensitive, space-sensitive) in a text input before the removal button activated. The same failure modes as PATCH-001 applied.

```
"CONFIRM REMOVAL"
┌─────────────────────────────────────────┐
│ [free text input]                       │
└─────────────────────────────────────────┘
[Remove L6 Override] — inactive until exact match
```

#### After

Replace with a hold-to-confirm button. The operator presses and holds the removal button for 3 seconds. A progress arc fills around the button during the hold. Release before completion cancels the action.

```
┌───────────────────────────────────────────────────────────────────┐
│  Remove L6 Override #[ID]?                                        │
│                                                                    │
│  ⚠ This is a permanent emergency override.                        │
│  Removing it will restore the content that was running before.   │
│  This action cannot be undone.                                    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ ████████████████████░░░░░░░░░░  Hold to confirm removal    │   │
│  │ [Hold 3 seconds to remove L6 Override]                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ← Release at any point to cancel                                 │
│                                                                    │
│  [Cancel]                                                         │
└───────────────────────────────────────────────────────────────────┘
```

**Hold-button behavior:**
- Default state: outlined red button labeled "Hold to remove L6 Override"
- On mousedown/touchstart: a progress arc animates clockwise over 3 seconds, filling the button border
- At 3 seconds: button activates and the removal is submitted
- On mouseup/touchend before 3 seconds: animation reverses to 0%, no action taken
- Progress arc is visible and labeled with a decreasing counter: "Hold (2.4s...)" updating every 200ms
- If the operator's pointer leaves the button boundary during hold, the action cancels and animation reverses

**For L5 overrides:** Use the same hold-to-confirm pattern at 2 seconds (reduced from 3, since L5 does not have the PERMANENT UNTIL REMOVED constraint of L6).

**For L1–L4 overrides:** Retain the existing inline confirmation card (type-free, single-click confirmation — no change needed).

**What is unchanged:**
- The governance rule requiring ADMIN + elevated session for L6 removal
- The audit trail for override removal
- The override entity itself

**Rationale:**
Hold-to-confirm is a standard safety UI pattern used in industrial control systems and medical devices. It requires sustained motor intention (impossible to trigger accidentally with a brief mis-click) while being immune to keyboard errors, autocorrect, and trailing-space failures. 3-second hold duration matches industry precedent for irreversible destructive actions.

**Architectural/governance impact:** None. The removal action and its governance are unchanged.

---

### PATCH-003: AssumeCommandConfirmCard — add incident context summary to confirmation

**Requirement:** R-5 — Eliminate typed confirmation under stress; R-1 — Reduce cognitive load
**Audit reference:** HF-IC-2 (CRITICAL)
**Wireframes modified:** WF-IC-03
**Surfaces affected:** Incident Command Surface — COMMANDER_LAPSED state

#### Before

The AssumeCommandConfirmCard showed responsibility language without repeating incident context:

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

#### After

Add a read-only incident context strip immediately above the responsibility statement. Content is drawn from data already present in the Incident Identity Bar above.

```
┌─────────────────────────────────────────────────────┐
│  Assume command of this incident?                    │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  [S2 CRITICAL]  INC-PKLAND-7f3a               │  │
│  │  Venue: The Parklands Golf Club               │  │
│  │  Duration: 00:42:18   Lapsed: 04:31 ago       │  │
│  │  Level 1 alert in: 10:29                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  You will become the Incident Commander.             │
│  You will be responsible for driving this incident   │
│  to CONTAINED and then RESOLVED.                     │
│                                                      │
│  [Confirm — Assume Command]    [Cancel]              │
└─────────────────────────────────────────────────────┘
```

**Context strip data binding:**
- Severity badge and label: from `incident.severity`
- Incident ID: from `incident.incident_id` (short form, first 8 chars)
- Venue name: from `incident.venue.name`
- Duration: live-updating from `now() - declared_at`
- Lapsed: live-updating from `now() - commander_lapsed_at`
- Level 1 alert countdown: live-updating from `commander_lapsed_at + 15m - now()`

The context strip is read-only. It cannot be clicked or expanded. It simply repeats what is already visible in the Identity Bar but within the confirmation scope, eliminating the need to look away from the card.

**Rationale:**
An operator arriving via notification link may not have read the Identity Bar before clicking [Assume Command]. The confirmation card is the moment of commitment — it must contain sufficient context for the operator to confirm they are assuming the right incident at the right severity. Adding context data the system already holds costs zero additional API calls and removes the working memory requirement of "I need to remember what incident this is while I read the confirmation text."

**Architectural/governance impact:** None. Confirmation mechanism and assume-command API call are unchanged.

---

### PATCH-004: Zone A incident badge — severity-colored by highest active incident

**Requirement:** R-2 — Increase salience; R-4 — Eliminate silent mutations
**Audit reference:** HF-LO-5 (HIGH)
**Wireframes modified:** WF-LO-01, WF-LO-02, WF-LO-06
**Surfaces affected:** Live Operations Surface — Zone A Pane A1 VenueSelector; Fleet View

#### Before

The incident count badge on each venue row in Pane A1 was a neutral red pill with a number. All incidents, regardless of severity, produced identical-looking badges.

```
Brisbane CBD     ● [❶]    ← red pill, count only
Riverside Golf   ~ [❷]    ← same red pill, 2 incidents
```

#### After

The badge background color reflects the highest-severity active incident for that venue, using the existing severity color set. The count number remains.

```
Brisbane CBD     ● [❶]    ← #C62828 deep red (S1/S2 active)
Riverside Golf   ~ [❷]    ← #F57C00 amber (S3 highest)
Gold Coast RSL   ⬤ [❶]    ← #FBC02D yellow (S4 highest)
```

**Color mapping (highest incident severity for that venue):**

| Highest severity | Badge background | Meaning |
|---|---|---|
| S1 EMERGENCY_FREEZE | `#C62828` deep red | Immediate response required |
| S2 CRITICAL | `#E64A19` deep orange | Urgent response required |
| S3 MAJOR | `#F57C00` amber | Active incident, monitor closely |
| S4 MINOR | `#FBC02D` yellow | Active incident, not critical |
| S5 WATCHING | `#558B2F` olive green | Watching state only |

**Badge behavior:**
- Badge renders only when `incident_count > 0`
- Color updates in real time via WebSocket (same cycle as venue state dot updates)
- Color change must not reset Zone A scroll position (same constraint as state dot updates)
- The count number is always white text regardless of badge background color

**Rationale:**
A 1-count badge and a 2-count badge on two different venues currently communicate nothing about severity. An operator managing a fleet with simultaneous S1 and S5 incidents needs to distinguish them at a glance in Zone A — the primary navigation surface — without navigating into each venue or checking Pane A2. Coloring the badge by severity uses an existing color set, requires no new component, and enables O(1) triage from Zone A.

**Architectural/governance impact:** None. This is a data-binding change to badge rendering. The incident data required (highest severity per venue) is already available via WebSocket.

---

### PATCH-005: Active Mode Indicator — INCIDENT ACTIVE amber pulse

**Requirement:** R-4 — Eliminate silent mutations; R-2 — Increase salience
**Audit reference:** HF-LO-4 (MEDIUM)
**Wireframes modified:** WF-LO-01, WF-LO-02, WF-LO-03, WF-LO-04, all IC wireframes
**Surfaces affected:** System Status Bar — Active Mode Indicator (all surfaces)

#### Before

The Active Mode Indicator displayed static text in the System Status Bar:
- `LIVE` — neutral white text
- `INCIDENT ACTIVE` — no visual differentiation from `LIVE` other than text length
- `EMERGENCY FREEZE` — red bar handles this case already

#### After

Mode indicator text and visual treatment by state:

| Mode value | Text | Color | Additional treatment |
|---|---|---|---|
| `LIVE` | LIVE | Neutral white / dark theme default | None — baseline state |
| `INCIDENT ACTIVE` | INCIDENT ACTIVE | `#FBC02D` amber | 8px pulsing amber dot immediately left of text (1s opacity cycle, 100%→50%) |
| `EMERGENCY FREEZE` | EMERGENCY FREEZE | `#FFFFFF` white on `#C62828` full bar | Existing behavior — no change |
| `REPLAY` | REPLAY | `#64B5F6` blue | Existing behavior from WF-IC-12 — no change |

**Pulse behavior:**
- The pulsing amber dot (8px diameter) uses the same animation already defined for COMMANDER_LAPSED
- Pulse respects `prefers-reduced-motion`: when reduced motion is set, the dot is static (solid amber) without animation
- The dot and text together remain within the Mode Indicator's reserved width in the Status Bar
- The dot ceases pulsing and is removed when mode returns to `LIVE`

**Rationale:**
"INCIDENT ACTIVE" and "LIVE" have the same visual weight in the current spec. An operator returning to their desk after a brief absence has no peripheral signal that the mode has changed. The amber pulse uses the system's existing animation token for urgency signals and requires no new component. The pulse is intentionally subdued (8px, moderate opacity cycle) — it draws the eye to the mode change without competing with the EMERGENCY_FREEZE full-bar treatment.

**Architectural/governance impact:** None. Mode indicator rendering logic only.

---

### PATCH-006: Training Mode active — persistent amber indicator in Zone A

**Requirement:** R-4 — Eliminate silent mutations
**Audit reference:** HF-CMS-4 (HIGH)
**Wireframes modified:** WF-CMS-09, all CMS wireframes with Zone A
**Surfaces affected:** CMS Operations Surface — Zone A Pane A4

#### Before

When Training Mode was active, only the System Status Bar showed a "TRAINING MODE" badge. The Zone A training mode toggle remained as a small unlabeled toggle in Pane A4, visually identical whether ON or OFF except for the toggle state indicator.

#### After

When Training Mode is `ON`, Zone A shows a persistent amber strip immediately above Pane A4 (the operator tools section). This strip is always visible when Training Mode is active, regardless of Zone A scroll position, because it is anchored to the bottom of Zone A above Pane A4.

```
Zone A — bottom section (when Training Mode = ON):

┌──────────────────────────────────────────────────┐
│  ████████████████████████████████████████████  │  ← amber strip
│  ⚠ TRAINING MODE — submissions non-destructive  │
│  ████████████████████████████████████████████  │
├──────────────────────────────────────────────────┤
│  Pane A4 — Operator Tools                        │
│  Jordan H. · OPERATOR                            │
│  Training mode: [ON ●]  ← toggle visible here    │
│  [Start Handoff]                                 │
│  [Request Elevated Session]                      │
│  [Sign Out]                                      │
└──────────────────────────────────────────────────┘
```

**Strip specification:**
- Height: 24px
- Background: `#F57C00` amber
- Text: "⚠ TRAINING MODE — submissions non-destructive" — 12px bold white
- Strip is NOT dismissible. It renders for the entire duration of Training Mode
- Strip disappears immediately when Training Mode toggle is set to OFF
- Strip is not present when Training Mode = OFF

**Rationale:**
The System Status Bar badge is at the top of the screen. After 30+ minutes in Training Mode, operators stop actively reading the status bar — they are focused on Zone B content. An amber strip immediately above their tool controls (Zone A Pane A4) remains within their Zone A interaction zone and is encountered naturally when they initiate any zone action. This prevents the "forgot Training Mode was on" scenario that silently swallows live submissions.

**Architectural/governance impact:** None. Rendering logic addition to Zone A.

---

### PATCH-007: RECOVERED_BUT_UNTRUSTED — distinct Zone A state dot

**Requirement:** R-2 — Increase salience; R-4 — Eliminate silent mutations
**Audit reference:** HF-LO-1 (CRITICAL)
**Wireframes modified:** WF-LO-08, WF-VO-03
**Surfaces affected:** Live Operations — Zone A Pane A1; Venue Operations — Zone A venue list

#### Before

The Cross-Wireframe Reference table in WF-LO used the same `~` amber symbol for both DEGRADED and RECOVERED_BUT_UNTRUSTED in Zone A venue state dots. The distinction was visible only within the Zone B `PlayerStateBadge` text ("Reconnected — Unverified").

| State | Zone A dot symbol | Zone A dot color |
|---|---|---|
| DEGRADED | `~` | amber |
| RECOVERED_BUT_UNTRUSTED | `~` | amber |

#### After

RECOVERED_BUT_UNTRUSTED uses a distinct animated dot in Zone A, preventing it from being read as a normal DEGRADED state.

| State | Zone A dot | Color | Animation |
|---|---|---|---|
| DEGRADED | `~` filled static dot | `#F59E0B` amber | None — stable DEGRADED |
| RECOVERED_BUT_UNTRUSTED | `↻` rotating sync icon | `#FB923C` amber-orange (distinct hue from DEGRADED amber) | 2-second rotation cycle |
| LIVE | `⬤` solid circle | `#22C55E` green | None |
| INCIDENT | `⬤` solid circle | `#EF4444` red | None |
| OFFLINE | `⬤` solid circle | `#64748B` slate | None |

**Animated dot specification:**
- Icon: a circular arrow (sync icon), 10px diameter, rendered inline with venue name
- Animation: continuous 360° rotation, 2 seconds per cycle, linear easing
- Color: `#FB923C` (orange-400 in Tailwind scale) — distinguishable from `#F59E0B` (amber-400 used for DEGRADED) under normal display conditions
- Animation ceases and dot changes to `⬤` green when trust verification completes (WebSocket event `TRUST_VERIFIED`)
- Animation respects `prefers-reduced-motion`: when set, the icon is static (no rotation) but the distinct hue is retained

**Tooltip on hover:**
"RECOVERED_BUT_UNTRUSTED — this venue has reconnected but corpus hash verification has not completed. Overrides blocked until verified." (Title attribute only — no new component.)

**Rationale:**
The distinction between "normally degraded, monitoring in progress" and "reconnected but unverified, action may be required" is operationally critical. Both were amber. The rotating sync icon is immediately legible as "something is in progress" rather than "something is wrong and stable" — which is the correct mental model for the RECOVERED_BUT_UNTRUSTED state. The distinct hue provides a color-independent secondary signal.

**Architectural/governance impact:** None.

---

### PATCH-008: IC Tab 2 annotation textarea — explicit content persistence across tab switches

**Requirement:** R-4 — Eliminate silent mutations
**Audit reference:** HF-IC-7 (MEDIUM)
**Wireframes modified:** WF-IC-04
**Surfaces affected:** Incident Command Surface — Tab 2 Command Log

#### Before

The annotation input textarea was specified as sticky-bottom in Zone B. No persistence behavior was defined for tab switches. Standard browser behavior would clear the textarea on unmount.

#### After

Add explicit state persistence specification to the Tab 2 annotation input:

**Behavior:**
- Textarea content is preserved in component local state across all tab switches within the same incident session
- Textarea content is not cleared when the operator switches to Tab 3, Tab 4, or Tab 5 and returns to Tab 2
- Textarea content is cleared only on explicit [Submit], [Clear], or when the incident session is closed (navigation away from the incident route entirely)
- When textarea is non-empty and the operator has navigated away from Tab 2, the Tab 2 label shows a small edit indicator: "Command Log ✎" — a pencil icon (8px, muted amber) superscripted on the tab label, indicating unsaved annotation content
- The [Clear] button appears in the textarea footer whenever content is non-empty: positioned left of the character count

```
Zone B Tab 2 — sticky annotation area (bottom of scroll container):

┌───────────────────────────────────────────────────────────────────┐
│ Add annotation to command log                                      │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ Screen 12 manifest re-sync attempt in progress. Expect      │   │
│ │ resolution by 17:00. Investigating override stack depth     │   │
│ │ after L1 was applied.                                       │   │
│ └─────────────────────────────────────────────────────────────┘   │
│ [Clear]                  162 / 500             [Add Annotation]   │
└───────────────────────────────────────────────────────────────────┘
```

**Tab label with unsaved content:**

```
[Situation Overview] [Command Log ✎] [Override Mgmt] [PRE Status] [Actions]
```

The `✎` icon is absent when the textarea is empty. It appears when any non-whitespace content is present. It does not replace the notification dot badge from PATCH-010 — both can render simultaneously.

**Rationale:**
A commander writing a multi-sentence operational note (common in S3+ incidents) should not lose their content when checking another tab. The combination of content preservation + tab indicator provides two signals: (1) silent data loss is eliminated, and (2) the operator has a visible reminder that they have unsaved annotation text.

**Architectural/governance impact:** None. This is a component state management specification. The annotation API endpoint and audit behavior are unchanged.

---

### PATCH-009: RECOVERED_BUT_UNTRUSTED machine state badge — combined amber pill

**Requirement:** R-2 — Increase salience
**Audit reference:** HF-VO-2 (MEDIUM)
**Wireframes modified:** WF-VO-03, WF-LO-08
**Surfaces affected:** Venue Operations — Venue Identity Header; Live Operations — Section 1 PlayerStateBadge

#### Before

RECOVERED_BUT_UNTRUSTED rendered as a green `LIVE` primary pill (120×40px) with an amber `UNTRUSTED` secondary badge immediately below it. The green pill visually dominated, allowing operators to scan "green = healthy" and miss the amber secondary.

```
Center of Venue Identity Header:
┌─────────────────┐
│      LIVE       │   ← green, 120×40px, dominant
└─────────────────┘
┌─────────────────┐
│   UNTRUSTED     │   ← amber, smaller, below
└─────────────────┘
```

#### After

RECOVERED_BUT_UNTRUSTED renders as a single combined pill. The green "LIVE" state is NOT rendered when trust is unverified — the trust state takes precedence over the connection state in this specific combination.

```
Center of Venue Identity Header:
┌─────────────────────────────┐
│  LIVE — UNVERIFIED          │   ← amber background, 180×40px
└─────────────────────────────┘
```

**Combined pill specification:**
- Width: 180px (wider than standard 120px to accommodate the longer label)
- Height: 40px (same as standard machine state badge)
- Background: `#F59E0B` amber (same as standard DEGRADED hue — but distinct from DEGRADED because the label text is different)
- Text: "LIVE — UNVERIFIED" in 14px semibold white
- Border radius: 8px (same as standard badge)
- Tooltip on hover: "This venue has reconnected but corpus hash verification is pending. Overrides are blocked until trust is verified."

**When this state clears:**
On `TRUST_VERIFIED` WebSocket event: the combined pill transitions back to the standard green "LIVE" pill. The transition is not animated (no fade) — it is an immediate swap consistent with the system's approach to state badge changes.

**Rationale:**
Two stacked badges create a visual hierarchy conflict — the operator's eye resolves to the larger, more colorful element (green LIVE) and may not register the secondary (amber UNTRUSTED). A single combined badge eliminates the hierarchy ambiguity. The amber color correctly signals "not fully healthy" without requiring the operator to integrate two separate UI elements.

**Architectural/governance impact:** None. The RECOVERED_BUT_UNTRUSTED machine state and its behavior are unchanged. This is a rendering change only.

---

### PATCH-010: IC and Replay tab strips — action-required dot badges

**Requirement:** R-2 — Increase salience
**Audit reference:** HF-IC-5 (HIGH), HF-RP-5 (LOW)
**Wireframes modified:** WF-IC-01, WF-IC-02, WF-IC-03, WF-IC-05, WF-IC-07, WF-IC-08; WF-RP-01, WF-RP-06
**Surfaces affected:** Incident Command Surface — Tab strip; Replay Investigation Surface — Tab strip

#### Before

Tab labels were static text with no indicators of actionable content or alert conditions:

```
[Situation Overview] [Command Log] [Override Mgmt] [PRE Status] [Actions]
```

#### After

Tab labels carry small dot badges when their content has an actionable condition the operator has not yet reviewed.

**Incident Command — tab badge conditions:**

| Tab | Badge appears when | Badge color | Dot size |
|---|---|---|---|
| Tab 3 — Override Mgmt | A new override has been placed or removed since the operator last viewed this tab | `#EF4444` red | 8px |
| Tab 4 — PRE Status | A PRE divergence is active (`pre_divergence_detected: true`) | `#EF4444` red | 8px |
| Tab 5 — Actions | The current commander has an available state transition (DECLARED → CONTAINED is possible, or CONTAINED → RESOLVED is ready) | `#4ADE80` green | 8px |

```
Tab strip with badges:
[Situation Overview] [Command Log] [Override Mgmt ●] [PRE Status ●] [Actions ●]
                                               ↑ red     ↑ red           ↑ green
```

**Replay Investigation — tab badge conditions:**

| Tab | Badge appears when | Badge color |
|---|---|---|
| Tab 3 — Annotations | Unresolved contradictions exist | `#FBC02D` amber |

**Badge behavior:**
- Dot is 8px diameter, rendered as a superscript on the tab label (top-right corner of the label text)
- Badge is cleared when the operator views the tab (dot disappears on tab activation)
- Badge reappears if a new condition is detected after the operator has viewed the tab (e.g., a new override is placed while the operator is on Tab 1)
- Badge for Tab 5 (Actions) only renders for the current commander — it does not render for non-commander OPERATOR role or VIEWER role
- In REPLAY mode: all badges absent (no live conditions apply in REPLAY)

**Rationale:**
An IC surface operator under S2 conditions may work primarily in Tab 1 and Tab 2 without systematically checking each tab. A PRE divergence in Tab 4 that is not reviewed delays root-cause identification. The small dot badge (already used throughout Zone A) provides the minimal possible signal — it does not demand attention with animation or sound, but it creates a visible asymmetry that the operator's eye will resolve.

**Architectural/governance impact:** None. The badge conditions are derived from data already present in the incident WebSocket stream.

---

### PATCH-011: OFFLINE autonomy countdown — duplicate into Zone B header area

**Requirement:** R-2 — Increase salience
**Audit reference:** HF-LO-6 (MEDIUM)
**Wireframes modified:** WF-LO-04, WF-VO-02
**Surfaces affected:** Live Operations — Section 1 (Venue Identity Header); Venue Operations — Venue Identity Header

#### Before

The offline autonomy countdown was located exclusively in Zone C C1 (Operational Context tab). Zone C can be collapsed to a 48px icon rail, rendering the countdown invisible.

#### After

When a venue is in OFFLINE state and `autonomy_status.online: false`, a one-line autonomy annotation renders immediately below the PlayerStateBadge in Zone B Section 1 (Live Operations) or the Venue Identity Header (Venue Operations Dashboard). This annotation is always visible regardless of Zone C state.

**Live Operations — Section 1 (WF-LO-04):**

```
Section 1 — Venue Identity Header:
┌────────────────────────────────────────────────────────────────────────────┐
│  Brisbane CBD                      [Offline]       Jordan H. · OPR  [14m] │
│  venue-brisbane-001                                                        │
│  ⚠ Offline — 47h 23m autonomy remaining  ·  Corpus: vn-brisbane-v31      │
└────────────────────────────────────────────────────────────────────────────┘
```

**Visual treatment of the autonomy annotation line:**

| Remaining autonomy | Color | Behavior |
|---|---|---|
| > 24h remaining | `#F59E0B` amber | Static text |
| 6h–24h remaining | `#EF4444` red | Static text with ⚠ prefix |
| < 6h remaining | `#EF4444` red | Text pulses (same pulse pattern as COMMANDER_LAPSED) |
| Autonomy expired (0h) | `#C62828` deep red | "AUTONOMY EXPIRED — venue serving fallback content" bold |

**The annotation line is:**
- Always visible when venue is OFFLINE, regardless of Zone C state
- Absent when venue is online (`autonomy_status.online: true`)
- Absent when venue is SYNCING (reconnection in progress — no autonomy risk)
- Not dismissible

**Rationale:**
Zone C is a workspace preference — operators who prefer Zone B width collapse it. The autonomy countdown is a safety-critical indicator: when it expires, the venue serves unapproved fallback content indefinitely. Placing a second rendering of the countdown in Zone B Section 1 (which is non-scrollable and non-collapsible) ensures the countdown is visible regardless of Zone C state.

**Architectural/governance impact:** None. Data already available from `autonomy_status` in the venue payload.

---

### PATCH-012: COMMANDER_LAPSED — "Who's online" presence indicator

**Requirement:** R-2 — Increase salience; R-5 — Reduce action barriers
**Audit reference:** HF-IC-3 (CRITICAL)
**Wireframes modified:** WF-IC-03
**Surfaces affected:** Incident Command Surface — COMMANDER_LAPSED state

#### Before

The COMMANDER_LAPSED indicator box and amber banner stated "Any OPERATOR+ can assume command" with no information about whether other operators were currently viewing the incident.

#### After

Add a "Currently viewing" presence indicator inside the COMMANDER_LAPSED indicator box, alongside the existing countdown and former commander name.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠ COMMANDER LAPSED                                   [Assume Command]│
│  Former commander: Alex Rangi                                         │
│  Lapsed: 04:32 ago   ·   Level 1 alert in: 10:28                    │
│  ─────────────────────────────────────────────────────────────────── │
│  Currently viewing this incident: 3 operators                         │
│  [Notify all operators viewing this incident →]                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Presence indicator behavior:**
- "Currently viewing" count: derived from real-time presence data (the same session presence data used for Replay collaborator indicators)
- Count includes all operators currently on the `/incidents/:incident_id` route, excluding the current operator (the count is "N other operators")
- If count is 0: "No other operators currently viewing this incident" in amber italic
- If count > 0: "Currently viewing: [N] other operators — [Notify all →]"
- "[Notify all →]" sends an in-system push notification to all operators currently on the incident route, with message: "Command command has lapsed on [INC-ID] at [Venue]. Assume command before Level 1 alert fires in [MM:SS]."
- The notify action is available to any OPERATOR+ currently viewing the surface — it does not require being the commander
- Sending the notification emits an audit event (`COMMANDER_LAPSED_NOTIFY_SENT`) to the command log
- The notify link becomes greyed and unclickable for 60 seconds after use to prevent notification floods ("Notification sent — [Resend in 54s]")

**Rationale:**
A junior operator viewing a COMMANDER_LAPSED incident faces a dilemma: assume command (high responsibility) or wait (risk the Level 1 alert firing). If they can see that 2 other operators are also viewing the incident, they have information to make a better decision. The [Notify all] link gives them a low-risk action to escalate awareness without personally assuming command. This addresses the specific failure mode: junior operator hesitates, alert fires, nobody acts.

**Architectural/governance impact:** None. Presence data is already in the system (Replay surface uses it). Notification mechanism already exists.

---

### PATCH-013: Replay transport controls — explicit state label

**Requirement:** R-3 — Remove ambiguity in state transitions
**Audit reference:** HF-RP-1 (CRITICAL)
**Wireframes modified:** WF-RP-01, WF-RP-02
**Surfaces affected:** Replay Investigation Surface — Session Header transport controls; RP-TIMELINE

#### Before

The replay playback state was communicated in two ways that used opposite icon conventions:
1. Session Header: "▶ REPLAYING" or "⏸ PAUSED" — icon shows current state
2. Transport button cluster: shows the action icon (▶ when paused = "click to play"; ⏸ when playing = "click to pause")

The internal inconsistency between "icon = state" (header) and "icon = action" (button) created ambiguity documented as a notation error in WF-RP-02.

#### After

Add a persistent, unambiguous state label immediately above the transport button cluster. The label shows current state in text, color, and icon — matching the Session Header convention throughout.

**Transport control cluster (updated):**

```
Session Header — centre section:

  STATE: ▶ REPLAYING          ← state label: green text, 13px semibold
  Speed: [0.25x] [0.5x] [1x★] [2x] [4x]
  ┌─────────────────────────────────┐
  │  [|◁]  [◁]  [⏸]  [▶]  [▶|]   │  ← buttons (⏸ = click to pause when REPLAYING)
  └─────────────────────────────────┘
  Playhead: 2026-05-28 16:23:41 AEST
```

**State label specification:**

| Playback state | Label text | Label color |
|---|---|---|
| `REPLAYING` | "STATE: ▶ REPLAYING" | `#4ADE80` green |
| `PAUSED` | "STATE: ⏸ PAUSED" | `#FBC02D` amber |
| `SCRUBBING` | "STATE: ◁ SCRUBBING" | `#64B5F6` blue |

**Label behavior:**
- Label is always visible — it does not collapse or hide at any viewport width
- Label updates immediately on state change (no animation delay)
- Label is non-interactive (display only)
- Label is positioned directly above the speed selector row

**Revised button cluster notation (resolves internal inconsistency in WF-RP-02):**
- When `REPLAYING`: centre button shows `[⏸]` (click to pause) — icon shows the action
- When `PAUSED`: centre button shows `[▶]` (click to play) — icon shows the action
- The STATE label above always shows the current state — removing any ambiguity about whether the icon represents state or action

**Rationale:**
The button icon convention (shows action) and the header convention (shows state) are both valid design patterns, but cannot coexist without explicit disambiguation. Adding the STATE label makes the current state unambiguous regardless of button icon convention. An operator cannot lose their investigation position by mis-reading the playback state because the state is explicitly labeled at all times.

**Architectural/governance impact:** None.

---

### PATCH-014: S1/S2 Zone B auto-replacement — return path banner

**Requirement:** R-3 — Remove ambiguity in state transitions
**Audit reference:** HF-IC-6 (HIGH)
**Wireframes modified:** WF-IC-10, WF-IC-02
**Surfaces affected:** Incident Command Surface — S1/S2 forced navigation states

#### Before

Zone B auto-replacement for S1/S2 incidents was documented in narrative form but WF-IC-10 (the primary EMERGENCY_FREEZE wireframe) did not show the return-path banner. An operator forced into the IC surface had no visible path back to the venue dashboard to check on other venue states or secondary screens.

#### After

Add a non-dismissible informational banner at the bottom of the IC surface Zone B content area for any session where Zone B was auto-replaced.

**Banner specification:**

```
Zone B — bottom of viewport, above the 28px Audit Trace Footer:

┌────────────────────────────────────────────────────────────────────┐
│  ⓘ You were automatically brought to this surface.                │
│     The venue dashboard remains accessible in a separate tab.     │
│     [View Venue Dashboard →]    opens in new browser tab          │
└────────────────────────────────────────────────────────────────────┘
```

**Banner properties:**
- Height: 36px
- Background: `#1E293B` dark slate (neutral, not alarming — this is informational)
- Text: 12px, `#94A3B8` muted grey
- "[View Venue Dashboard →]" link: opens `/venues/:venue_id` in a new tab
- Banner renders when and only when `ic_surface_entry_reason === "AUTO_REPLACE"` in session state
- Banner renders for all roles (OPERATOR, ADMIN, VIEWER) under the auto-replace condition
- Banner is never rendered when the operator voluntarily navigated to the IC surface
- Banner is not dismissible
- Banner is positioned above the Audit Trace Footer at z-index 1 (below all modals and overlays)

**Also add to WF-IC-10 Zone A:**

When the IC surface was auto-entered, the Zone A "← Back to Venue [NAME]" contextual item (from PATCH HF-XS-6 correction) renders at the top of Zone A, above the primary nav:

```
Zone A top:
← Back to Venue Dashboard (Brisbane CBD)
─────────────────────────────────────────
Home / Live Operations
Venues
Incidents [●1]
Replay & Forensics
Settings
```

This Zone A entry navigates Zone B back to the venue dashboard (in the same tab, not a new tab — distinct from the banner link which opens a new tab). When clicked, Zone B navigates to `/venues/:venue_id`. If the S1 incident is still active, the INCIDENT ACTIVE banner in Zone B reappears and the operator can navigate back to the IC surface from there.

**Rationale:**
S1 auto-replacement is a correct constitutional behavior — the IC surface must dominate Zone B for critical incidents. However, operators managing a fleet need occasional visibility into the venue's broader state (secondary screens, autonomy status, other connected devices). Providing both a same-tab return path (Zone A) and a new-tab path (banner) gives the operator complete flexibility without breaking the auto-replace constitutional requirement.

**Architectural/governance impact:** None. Zone B auto-replacement behavior and the constitutional requirement for it are unchanged.

---

### PATCH-015: Recovery workflow — session-storage state persistence

**Requirement:** R-3 — Remove ambiguity in state transitions
**Audit reference:** HF-VO-3 (MEDIUM)
**Wireframes modified:** WF-VO-02
**Surfaces affected:** Venue Operations Dashboard — OFFLINE state recovery workflow overlay

#### Before

The 5-step recovery workflow overlay (which replaces Zone B) had no specified persistence behavior when the operator navigated away. Standard component unmount behavior would discard step completion state.

#### After

**State persistence specification:**

The recovery workflow step completion state (`steps_completed: [1, 2, 3]`, `current_step: 4`) is persisted in `sessionStorage` keyed by `recovery_workflow_{venue_id}`. This persistence survives Zone B navigation (clicking another venue, receiving a notification that navigates Zone B) but does not survive page reload or tab close.

**On return to the OFFLINE venue with in-progress recovery workflow:**

Zone B does not automatically show the workflow overlay. Instead, a banner appears at the top of Zone B (below the Venue Identity Header):

```
┌────────────────────────────────────────────────────────────────────┐
│  ⟳ Recovery workflow in progress — Step 3 of 5 completed          │
│     [Resume recovery workflow →]    [Dismiss — start over]        │
└────────────────────────────────────────────────────────────────────┘
```

**Banner behavior:**
- "Resume recovery workflow →": re-renders the workflow overlay at the last completed step
- "Dismiss — start over": clears sessionStorage for this workflow, removes the banner. Operator can begin the workflow fresh from the venue dashboard.
- Banner renders only when `sessionStorage` contains in-progress workflow state for this `venue_id`
- Banner does not render when the workflow has been completed or when the venue is no longer OFFLINE

**Step state rendering on resume:**
When the operator resumes, completed steps (1–3) are shown with checkmarks and the operator who completed them (attributed to the current session operator). The current step (4 — system-automated corpus hash verification) re-fires its automated check. Steps 1–3 are not re-required.

**Rationale:**
Recovery workflows have 5 steps that include physical checks (confirming player hardware, verifying network connection). An operator interrupted mid-workflow should not be required to physically re-verify steps they have already completed, especially under time pressure when the venue's autonomy clock is counting down. Session-storage persistence is limited in scope (single browser tab session) — it does not persist across operators or page reloads, which is the correct scope for physical verification steps.

**Architectural/governance impact:** None. This is a frontend state management specification. The workflow API endpoints and their behavior are unchanged.

---

### PATCH-016: [Declare Incident] vs [Place Override +] — visual hierarchy correction

**Requirement:** R-1 — Reduce cognitive load
**Audit reference:** HF-LO-2 (HIGH)
**Wireframes modified:** WF-LO-01, WF-LO-02, WF-LO-07, WF-LO-08
**Surfaces affected:** Live Operations — Zone B Section 4 Intervention Surface

#### Before

[Place Override +] and [Declare Incident] appeared as two adjacent buttons at equal visual weight at the bottom of Section 4.

```
[Place Override +]    [Declare Incident]
```

#### After

The two actions are visually separated and hierarchically differentiated.

```
[Place Override +]   ← primary button (filled, system accent color)


─────────── Emergency actions ────────────

[Declare Incident]   ← secondary button (outlined, muted red), below a divider
```

**Specification:**

| Element | Before | After |
|---|---|---|
| [Place Override +] | Unspecified weight | Primary: filled background, system accent color (e.g., `#3B82F6` blue or design system primary) |
| [Declare Incident] | Same weight as Place Override | Secondary: outlined border only, `#EF4444` red border, `#EF4444` text |
| Separator | Absent | Horizontal rule with label "Emergency Actions" in 11px uppercase muted text |
| Spacing | Standard | Minimum 24px vertical gap between [Place Override +] and the separator |

**Role behavior:**
- For VIEWER: both buttons absent — no change
- For OPERATOR: both buttons present with updated hierarchy — no change to presence rules
- During EMERGENCY_FREEZE: [Place Override +] disabled for L1–L5 (tooltip); [Declare Incident] disabled for non-ADMIN (tooltip). Visual hierarchy and separation unchanged.

**Rationale:**
[Place Override +] is a routine operational action — used dozens of times per shift. [Declare Incident] is a high-consequence, rarely-used action that initiates the incident management workflow. Treating them as equals creates accidental-click risk. The separator and visual hierarchy make the boundary between "normal operation" and "emergency action" visible at a glance. The 24px gap and "Emergency Actions" divider label add a micro-interaction barrier between the routine and the consequential.

**Architectural/governance impact:** None.

---

### PATCH-017: 72h delivery banner — add plain-language operational implication

**Requirement:** R-1 — Reduce cognitive load
**Audit reference:** HF-CMS-1 (HIGH)
**Wireframes modified:** WF-CMS-02, WF-CMS-03
**Surfaces affected:** CMS Operations — Tab 2 Schedule Builder

#### Before

The 72h delivery banner was a single line with timestamp:

```
⚠ Content is safe to schedule for play after: THURSDAY 5 JUNE 2026, 14:23 AEST
```

#### After

Two-line format. Line 1 retains the existing timestamp. Line 2 adds the plain-language implication.

```
⚠ Safe to schedule after: THURSDAY 5 JUN 2026, 14:23 AEST
   Slots before this time may not sync to venue players before air.
```

**Updated "Submit with warning" confirmation dialog button:**

| Before | After |
|---|---|
| `[Cancel]  [Submit with warning]` (rightmost) | `[Cancel]  [⚠ Submit anyway]` (rightmost, same position, warning icon prepended) |

Additionally, the confirmation dialog body adds one sentence above the button row:

> "I understand this content may not reach venues before its scheduled play time."

This sentence is plain text (not a checkbox, not an input) — it is a statement the operator reads as part of the confirmation flow.

**Rationale:**
"Content is safe to schedule after [TIMESTAMP]" is understandable to operators familiar with corpus delivery. For operators new to the system or trained without deep corpus knowledge, the operational consequence ("may not sync to venue players before air") is not self-evident from "safe to schedule." Adding the plain-language line costs one line of text and eliminates the gap between understanding the rule and understanding the reason.

**Architectural/governance impact:** None. The 72h constraint itself is unchanged.

---

### PATCH-018: AssumeCommandConfirmCard — pre-stated incident context (see PATCH-003)

**Combined with PATCH-003.** Covered fully under PATCH-003.

---

### PATCH-019: Venue Operations status dashboard — semantic group labels

**Requirement:** R-1 — Reduce cognitive load
**Audit reference:** HF-VO-1 (HIGH)
**Wireframes modified:** WF-VO-01, WF-VO-02, WF-VO-03
**Surfaces affected:** Venue Operations Dashboard — Tab 1 Overview, status card grid

#### Before

7 status dimension cards were laid out in a 4-3 grid with no semantic grouping. The visual asymmetry between 4-column Row 1 (narrower cards) and 3-column Row 2 (wider cards) created scan inconsistency.

#### After

Group the 7 dimensions into two explicitly labeled semantic groups. The labels are rendered as small section headings above each row.

```
Zone B — Tab 1 Overview:

PLAYER STATUS
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  HEALTH  │ │READINESS │ │  TRUST   │ │ PRE LEVEL│
│          │ │          │ │          │ │          │
│  ● GOOD  │ │ ● STABLE │ │ ● FULL   │ │  L2 ●   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

SIGNAL QUALITY
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  CONFIDENCE │ │  FRESHNESS  │ │ CONNECTIVITY │
│             │ │             │ │              │
│  ● HIGH     │ │  ● CURRENT  │ │  ● STRONG    │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Group label specification:**
- Text: uppercase, 11px, `#64748B` muted slate, letter-spacing: 0.08em
- Position: above the row of cards, flush left with Zone B content margin
- Not interactive
- "PLAYER STATUS" group: HEALTH, READINESS, TRUST, PRE LEVEL (4 cards)
- "SIGNAL QUALITY" group: CONFIDENCE, FRESHNESS, CONNECTIVITY (3 cards)

**The 4-3 grid structure is retained** — the group labels provide semantic scaffolding without requiring a grid restructure.

**Rationale:**
Group labels give the operator a semantic map of the dashboard: "if I want to know about the player, look at PLAYER STATUS; if I want to know about connection quality, look at SIGNAL QUALITY." After the initial learning period, these labels reinforce spatial memory — the operator does not have to recall which card is which from memory alone. This is especially valuable after 6+ hours when mental energy is reduced.

**Architectural/governance impact:** None.

---

### PATCH-020: Machine state history strip — computed duration between transitions

**Requirement:** R-1 — Reduce cognitive load
**Audit reference:** HF-VO-4 (LOW)
**Wireframes modified:** WF-VO-01, WF-VO-02, WF-VO-03
**Surfaces affected:** Venue Operations — Venue Identity Header, machine state history strip

#### Before

```
[LIVE→OFFLINE] 14:32 AEST    [OFFLINE→SYNCING] 15:18 AEST    [SYNCING→LIVE] 15:23 AEST
```

Mental arithmetic required: offline duration = 46 minutes; sync duration = 5 minutes.

#### After

```
[LIVE→OFFLINE] 14:32   (46m offline)   [OFFLINE→SYNCING] 15:18   (5m sync)   [SYNCING→LIVE] 15:23
```

**Specification:**
- Duration between consecutive transitions is computed as `next_transition.timestamp - this_transition.timestamp`
- Format: `(Nm)` for durations under 1 hour; `(Nh Nm)` for durations 1–24 hours; `(Nd Nh)` for durations over 24 hours
- Rendered in 11px muted text `#64748B`, enclosed in parentheses, between consecutive transition entries
- If only 1 transition exists in the strip: no duration is computed (requires two endpoints)
- The duration is computed client-side from the timestamps already present in the history strip data

**Rationale:**
The operationally significant question is not "what time did the transition happen" but "how long was the venue in that state." The mental arithmetic is trivial for single-minute differences but becomes error-prone for durations spanning hours (e.g., a 3h 14m offline period spanning midnight). Precomputing and displaying the duration eliminates the arithmetic step entirely.

**Architectural/governance impact:** None. Computed display value only — no new API data required.

---

## Summary of All Patches

| Patch ID | Title | Req | Audit ref | Severity resolved | Wireframes |
|---|---|---|---|---|---|
| PATCH-001 | L6 Emergency Override — chip-select + toggle | R-5 | HF-IC-1 | CRITICAL | WF-IC-06 |
| PATCH-002 | L6 Override Removal — hold-to-confirm | R-5 | HF-IC-1 | CRITICAL | WF-IC-05, WF-IC-06 |
| PATCH-003 | AssumeCommandConfirmCard — incident context | R-5, R-1 | HF-IC-2 | CRITICAL | WF-IC-03 |
| PATCH-004 | Zone A incident badge — severity-colored | R-2, R-4 | HF-LO-5 | HIGH | WF-LO-01, WF-LO-02, WF-LO-06 |
| PATCH-005 | Active Mode Indicator — INCIDENT ACTIVE amber pulse | R-4, R-2 | HF-LO-4 | MEDIUM | All 55 wireframes (Status Bar) |
| PATCH-006 | Training Mode — persistent Zone A amber strip | R-4 | HF-CMS-4 | HIGH | WF-CMS-09, all CMS |
| PATCH-007 | RECOVERED_BUT_UNTRUSTED — distinct Zone A dot | R-2, R-4 | HF-LO-1 | CRITICAL | WF-LO-08, WF-VO-03 |
| PATCH-008 | IC Tab 2 annotation textarea — content persistence | R-4 | HF-IC-7 | MEDIUM | WF-IC-04 |
| PATCH-009 | RECOVERED_BUT_UNTRUSTED — combined amber badge | R-2 | HF-VO-2 | MEDIUM | WF-VO-03, WF-LO-08 |
| PATCH-010 | IC and Replay tab strips — action-required badges | R-2 | HF-IC-5 | HIGH | WF-IC-01–03, WF-IC-05, WF-IC-07–08; WF-RP-01, WF-RP-06 |
| PATCH-011 | OFFLINE autonomy countdown — Zone B header | R-2 | HF-LO-6 | MEDIUM | WF-LO-04, WF-VO-02 |
| PATCH-012 | COMMANDER_LAPSED — presence + notify | R-2, R-5 | HF-IC-3 | CRITICAL | WF-IC-03 |
| PATCH-013 | Replay transport — explicit state label | R-3 | HF-RP-1 | CRITICAL | WF-RP-01, WF-RP-02 |
| PATCH-014 | S1/S2 auto-replacement — return path banner | R-3 | HF-IC-6 | HIGH | WF-IC-10, WF-IC-02 |
| PATCH-015 | Recovery workflow — sessionStorage persistence | R-3 | HF-VO-3 | MEDIUM | WF-VO-02 |
| PATCH-016 | [Declare Incident] vs [Place Override] hierarchy | R-1 | HF-LO-2 | HIGH | WF-LO-01, WF-LO-02, WF-LO-07, WF-LO-08 |
| PATCH-017 | 72h delivery banner — plain language implication | R-1 | HF-CMS-1 | HIGH | WF-CMS-02, WF-CMS-03 |
| PATCH-018 | (Combined with PATCH-003) | — | — | — | — |
| PATCH-019 | VO status dashboard — semantic group labels | R-1 | HF-VO-1 | HIGH | WF-VO-01, WF-VO-02, WF-VO-03 |
| PATCH-020 | Machine state history — computed durations | R-1 | HF-VO-4 | LOW | WF-VO-01, WF-VO-02, WF-VO-03 |

**Total: 19 patches (PATCH-018 combined into PATCH-003)**

---

## Audit Issues Not Resolved by This Patch

The following audit issues from the HF audit are deferred or addressed by specification note only (not by wireframe patch):

| Audit ID | Title | Disposition |
|---|---|---|
| HF-LO-3 | EMERGENCY_FREEZE handoff path tooltip | Specification note only — tooltip text change, no wireframe update needed |
| HF-IC-4 | Duration clock "last action" secondary label | Specification addition — data binding spec, wire frames already accept the data slot |
| HF-RP-2 | Notification deferral strip — show held severity | Specification addition to notification component |
| HF-RP-3 | Zone C crowding — reorder contradictions to top | Specification addition — vertical order change, no ASCII needed |
| HF-RP-4 | Swim lane labels — hover tooltip expansion | Specification note — tooltip text only |
| HF-RP-5 | No keyboard shortcut for contradictions | Deferred — LOW severity, future enhancement |
| HF-CMS-2 | "Submit with warning" button label | Covered under PATCH-017 (button label change included) |
| HF-CMS-3 | <24h block error — Venue Admin contact path | Specification addition — label text + notification link |
| HF-CMS-5 | L4 sponsor ceiling — tooltip explanation | Specification note — tooltip text only |
| HF-XS-1 | Status bar text size minimum | Design token constraint — 14px minimum, WCAG AA contrast |
| HF-XS-2 | Audit Trace Footer — add "by whom" | Label content change — "by [operator_name]" addition |
| HF-XS-3 | Focus ring specification absent | Design system spec addition — 3px white ring, 2px offset, never suppressed |
| HF-XS-4 | Role abbreviation tooltips | Tooltip text addition — "OPR → Operator" etc. |
| HF-XS-5 | Touch-screen timestamp tap-to-reveal | Deferred — INFORMATIONAL, desktop primary deployment |
| HF-XS-6 | Back navigation breadcrumb inconsistency | Covered by PATCH-014 Zone A contextual back item |

---

## Architectural and Governance Confirmation

This document certifies:

- **No new surfaces introduced.** All patches apply to existing surfaces at existing routes.
- **No new workflows introduced.** PATCH-001 replaces a confirmation mechanism within an existing workflow. PATCH-012 adds a notification action using the existing notification system. No new workflow states or steps are created.
- **No new roles introduced.** All patches are role-neutral or apply existing role gates unchanged.
- **No governance rules modified.** L6 override authority, L6 permanence, COMMANDER_LAPSED 15-minute window, 72h delivery constraint, and all constitutional state rules are intact and unmodified.
- **No new system states introduced.** RECOVERED_BUT_UNTRUSTED, COMMANDER_LAPSED, EMERGENCY_FREEZE, OFFLINE, and all other system states remain exactly as defined in the canonical surface specifications.
- **No new components introduced.** PATCH-001 uses existing chip/button components. PATCH-002 uses existing button with a hold-duration modifier. All other patches use existing visual tokens (amber colors, pulse animations, dot badges) already defined in the system's design language.

---

## Success Criteria Verification

| Criterion | Met by |
|---|---|
| All incident-critical actions executable without typing | PATCH-001 (L6 place), PATCH-002 (L6 remove), PATCH-003 (Assume Command) |
| No silent state changes on any surface | PATCH-004 (incident severity), PATCH-005 (mode change), PATCH-006 (training mode), PATCH-007 (trust state), PATCH-008 (annotation loss) |
| All system-critical states visually distinguishable within 1–2 seconds | PATCH-007 (RECOVERED_BUT_UNTRUSTED dot), PATCH-009 (combined amber badge), PATCH-010 (tab badges), PATCH-011 (autonomy countdown), PATCH-012 (COMMANDER_LAPSED presence) |
| No operator action depends on recall under stress | PATCH-013 (replay state label), PATCH-014 (return path after auto-replace), PATCH-015 (recovery workflow persistence), PATCH-016 (action hierarchy), PATCH-019 (semantic groups) |
