# CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2

**Document type:** Canonical reference surface specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers, frontend engineers, QA, platform team
**Depends on:** OPERATIONAL-WORKSPACES-v1.md, INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1.md, FRONTEND-COMPONENT-TAXONOMY-v1.md, TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md
**Version:** 2.0
**Status:** CANONICAL — write wireframes directly from this document

---

## 1. Surface Identity

**Surface name:** Replay Investigation Surface

**Canonical routes:**
- `/venues/:venue_id/replay/:session_id` — venue-scoped investigation (primary path)
- `/replay/:session_id` — unscoped investigation (used for cross-venue or standalone sessions)

**URL permanence requirement:** Replay session URLs are permanent for the corpus lifetime. A URL constructed today pointing to `session_id=abc123` must resolve identically in 7 years. These URLs are cited in incident postmortems, compliance reports, and audit documents. Do not implement redirect chains or session expiry behavior that changes the URL. If the corpus record exists, the URL must resolve. If the corpus record does not exist (not yet the case — corpus is never deleted), the URL renders an appropriate "corpus record not found" state.

**Who can access this surface:**

| Role | Access | Tab 6 visible |
|---|---|---|
| VIEWER | Read-only, all tabs except Tab 6 | No |
| OPERATOR | Read + annotation/finding writes, all tabs except Tab 6 | No |
| VENUE_MANAGER | Read + annotation/finding writes, all tabs except Tab 6 | No |
| ORG_ADMIN | Read + annotation/finding writes, all tabs except Tab 6 | No |
| ADMIN | Full access including Tab 6 (Counterfactual) | Yes |

**What this surface is:**
The Replay Investigation Surface is the forensic investigation workspace. Operators load historical corpus recordings and step through events in sequence, writing annotations and operational findings to interpret what occurred. This surface exists to produce an evidentiary record of what happened, why, and what should be done about it.

**What this surface is not:**
- Not a live monitoring surface. It has no live state subscriptions for production venue operations.
- Not a configuration surface. No override creation, no campaign modification, no content library access.
- Not an incident declaration surface. Incidents may be linked to this session, but incident state transitions do not occur here.
- Not a PRE modification surface. The PRE resolve rules under investigation are historical and immutable.

**The defining constraint:** Zero write controls that affect live venue state may be rendered anywhere on this surface. This is not a capability the surface suppresses — it is a capability this surface does not possess. There is no REPLAY mode toggle that could expose these controls.

---

## 2. Replay Session Header (RP-TOP)

The session header occupies the top of Zone B, below SystemStatusBar, and is always visible during the investigation session. It does not scroll with the rest of the workspace.

**Header height:** 72px fixed.

**Left section — Session identity:**

```
[INVESTIGATION] INV-2026-0601-abc1    Venue: The Parklands Golf Club
Time range: 2026-05-28 14:00 AEST → 2026-05-28 19:45 AEST    Session type: POST_INCIDENT
```

Displayed fields (all read-only):
- `investigation_id` — system-generated ID, shown in abbreviated form (first 12 chars)
- Venue name and ID (links to venue record, opens in a new tab — does not navigate this workspace)
- `time_range_start` and `time_range_end` — both displayed with venue-local timezone suffix
- `session_type` — one of: FORENSIC | DIVERGENCE | SCHEDULED_VERIFICATION | POST_INCIDENT

**Centre section — Replay status:**

```
▶ REPLAYING    Speed: 1x    [0.25x] [0.5x] [1x] [2x] [4x]
Playhead: 2026-05-28 16:23:41 AEST
```

Status indicator cycles through three states with distinct visual treatment:
- `▶ REPLAYING` — green text, animated playhead time
- `⏸ PAUSED` — amber text, static playhead time
- `◁ SCRUBBING` — blue text, shown during drag-scrub operations

Speed selector: five buttons displaying 0.25x, 0.5x, 1x, 2x, 4x. Active speed is highlighted. Speed applies to replay playback only; it does not affect annotation display or tab content.

Playhead time: shows the current investigation timestamp being viewed, updated in real time during playback. Format: `YYYY-MM-DD HH:MM:SS TZ`.

**Right section — Session owner and collaborators:**

```
Owner: J. Rangi (you)    Also here: M. Chen, A. Okafor    [+1 more]
```

Session owner: the `opened_by` operator. Labeled "you" when the current operator is the owner.
Collaborators: avatars or initials for each operator currently viewing this investigation session, drawn from session presence data. Maximum 3 shown inline; remainder shown as `+N more` which expands on click to a popover list.

The collaborator list is a read-only presence display. It does not enable messaging or communication.

**Persistent REPLAY mode indicator:**

A banner immediately below the session header, full width, 28px height, amber background:

```
⏸  THIS IS A REPLAY SESSION — You are viewing historical corpus data. No live venue state is shown here.
```

This banner is always visible. It does not collapse. It does not require dismissal. It is not a notification — it is a persistent session context indicator. It must be visible at all viewport widths without truncation (truncate the descriptive text before removing the "THIS IS A REPLAY SESSION" label).

---

## 3. Zone A — Navigation During Replay

Zone A remains fully functional during replay sessions. All navigation items are available. The operator may leave the replay session at any time.

**Zone A during replay — what does and does not change:**

| Zone A element | During replay | Change |
|---|---|---|
| VenueSelector (A1) | Available | No change |
| IncidentList (A2) | Available — incidents visible | Incidents are read-only links to navigate to IC surface; no incident action controls appear in Zone A during replay |
| NotificationTray (A3) | Available | No change |
| OperatorTools (A4) | Available | Override creation tool is absent from A4 during replay; all other tools available |

**REPLAY mode badge in Zone A:**

A small "REPLAY" badge appears above the venue name in A1, adjacent to the venue indicator, amber background, 12px text. It serves as a persistent secondary reminder that the operator is in a replay session for this venue. It does not replace the venue name.

**No incident command controls in Zone A during replay:**

If an incident is linked to this investigation session, the incident appears in the IncidentList (A2) as a clickable link to the IC surface. It does not gain action controls (declaration controls, severity escalation, commander assignment) in Zone A while the replay workspace is active. Incident actions require navigating to the IC surface.

---

## 4. Zone B — Tab System

Zone B in the Replay Investigation Surface is divided into two horizontal sections:
- **RP-TIMELINE** (upper ~25% of Zone B, below RP-TOP header): always visible, always shows the full corpus timeline for the session.
- **RP-MAIN** (lower ~75% of Zone B): contains the six analysis tabs.

The divider between RP-TIMELINE and RP-MAIN is drag-resizable, with minimum heights of 100px (RP-TIMELINE) and 200px (RP-MAIN).

---

### Tab 1: Timeline

Tab label: **Timeline**
URL segment: `#timeline`
Minimum role: OPERATOR

**What the timeline shows:**

The RP-TIMELINE component spans the full width of Zone B and displays a horizontal time axis for the investigation session's `time_range_start` to `time_range_end`. When Tab 1 is active, the RP-MAIN area shows the detail panel for the currently selected timeline event.

**Time scale:**

Default scale: the full session time range compressed to fit the RP-TIMELINE width. For sessions shorter than 2 hours, the default scale is 1 minute per pixel (approx.). For longer sessions, the scale is auto-calculated to fit the range. Zooming in/out changes the visible time window without changing the corpus data.

Time scale controls:
- Scroll wheel over timeline: zooms in/out on the timeline, centred on cursor position
- `[−]` `[+]` zoom buttons at the right edge of the timeline
- `[Fit all]` button: resets to show the full session range

**Event types rendered on the timeline:**

Each event type is a distinct row (swim lane) in the timeline, or colour-coded within a shared row, depending on density. Designer note: Use swim lanes for primary event types; colour within lanes for sub-types.

| Event type | Visual | Row |
|---|---|---|
| PRE resolution output | Blue tick mark | PRE resolutions |
| PRE divergence detected | Red diamond | PRE resolutions |
| Override created | Orange upward triangle | Override events |
| Override expired / removed | Grey downward triangle | Override events |
| Device connectivity event (offline/online) | Purple square | Device health |
| Emergency activation / clearance | Red star (activation), green star (clearance) | Emergency |
| Player state transition | Teal circle | Player health |
| Corpus annotation (written during this session) | Yellow bookmark | Annotations |
| Operational finding (submitted during this session) | Green flag | Findings |
| Contradiction detected | Red exclamation on annotation marker | Annotations |

**Playhead position indicator:**

A vertical red dashed line spanning the full height of the timeline, labeled with the current playhead timestamp directly below the line. The playhead moves during playback and is draggable for scrubbing.

**Playback controls:**

Located at the left edge of RP-TIMELINE:
- `[◀◀]` Jump to start of session range
- `[◀]` Step back one event
- `[⏸/▶]` Pause / Resume playback toggle
- `[▶]` Step forward one event
- `[▶▶]` Jump to end of session range
- Speed selector (same as RP-TOP header): `[0.25x]` `[0.5x]` `[1x]` `[2x]` `[4x]`

**Seek behavior:**

- Click anywhere on the timeline: moves playhead to that timestamp. Pauses playback.
- Click and drag on the playhead line: scrub mode. Status indicator switches to `◁ SCRUBBING`. Release to set playhead position.
- Keyboard: left/right arrow keys move playhead by one event when timeline is focused.

**Annotation markers on the timeline:**

Annotations written during this investigation session appear as yellow bookmark icons above the event they are anchored to. SUPERSEDED annotations appear as grey bookmark icons with a strikethrough visual treatment. Clicking any annotation marker opens the annotation detail in the RP-MAIN detail panel and pauses playback.

When two annotation markers for the same anchor point contradict each other, both markers are shown with a red exclamation badge overlay. Clicking either marker opens both annotations side-by-side in the detail panel and shows the contradiction record.

**Time range selection for investigation scope:**

Below the main timeline row: a range selector bar (similar to a minimap). Operators drag the start/end handles to restrict the visible timeline window. This does not change the session's `time_range_start` / `time_range_end` — it is a view filter only. A `[Clear range]` button resets to the full session range.

**Focus protection:**

When the operator is actively dragging a timeline scrub or range selection, all incoming notifications (Level 2 and below) are deferred for up to 15 seconds. Level 1 constitutional interrupts are never deferred. A discreet counter shows if notifications have been deferred: "2 notifications held while scrubbing — [show now]". Releasing the scrub dismisses the deference.

**Tab 1 — RP-MAIN content:**

When Tab 1 is active and a timeline event is selected, RP-MAIN shows the event detail panel:
- Event ID, type, governed_timestamp, source
- Full event payload (collapsed by default, expandable)
- Any annotations anchored to this event
- `[Annotate this event]` button — opens the annotation write form inline (see Section 4.3 / Tab 3 for write form anatomy)

When no event is selected, RP-MAIN shows a prompt: "Click any event in the timeline above to view its details."

---

### Tab 2: Event Stream

Tab label: **Event Stream**
URL segment: `#events`
Minimum role: OPERATOR

**Purpose:** A chronological list of all corpus events within the session's time range, shown as a scrollable stream.

**Event stream entry anatomy:**

Each entry in the event stream is a single row:

```
[TYPE BADGE]  [GOVERNED_TIMESTAMP]  [SOURCE]  [PAYLOAD PREVIEW]  [ANCHOR ICON]
PRE_RESOLVE   2026-05-28 16:23:41   pre-engine-01   L3 Campaign → Club_TV_General   [📎 2 annotations]
```

Fields:
- **Type badge:** Short label for the event type (PRE_RESOLVE, OVERRIDE_CREATED, DEVICE_OFFLINE, etc.), colour-coded by category (blue for PRE, orange for override, purple for device, red for emergency).
- **Governed timestamp:** The event's canonical timestamp in venue-local timezone. Not the wall clock time it was displayed — the governed timestamp from the corpus.
- **Source:** The system component or device that emitted the event.
- **Payload preview:** A short, human-readable summary of the event payload (max 80 characters). Full payload is accessible by expanding the row.
- **Anchor icon:** If annotations are attached to this event, a bookmark icon with annotation count. Click: open the annotations panel for this event.

**Corpus event immutability cue:**

All corpus events are displayed with a visual indicator on their left edge — a 3px amber left border and the label "CORPUS" in 10px uppercase text at the far left of the row. This communicates that the event is immutable and is not an annotation or finding. The corpus label and border appear on every corpus event row without exception.

**Expanding an event row:**

Clicking a row expands it to show:
- Full payload JSON (syntax-highlighted, read-only)
- All annotations anchored to this event (in compact form)
- `[Annotate this event]` action button

**Filter controls:**

Above the event stream, a filter bar:
- **Event type filter:** Multi-select checklist of event types. Default: all selected.
- **Source filter:** Free-text search on the `source` field.
- **Time range filter:** Start/end pickers, constrained to the session time range.
- **Show annotations only:** Toggle to show only events with attached annotations.
- `[Clear filters]` button: resets all filters.

Filters are local to this tab. They do not affect the timeline in RP-TIMELINE. The active filter count is shown as a badge on the `[Clear filters]` button.

**How SUPERSEDED events appear:**

A corpus event itself is never superseded — corpus events are immutable. However, if an annotation anchored to an event is superseded, the annotation appears in the expanded event row with the SUPERSEDED treatment (see Tab 3). The event row itself remains visually unchanged.

**Click-to-annotate on an event:**

Every expanded event row includes an `[Annotate this event]` button. Clicking it opens the annotation write form as an inline panel below the event row (not a modal). The form pre-populates `anchored_to: {type: "event", event_id: <this_event_id>}`. Submission collapses the form and adds the annotation to the event row immediately without a page reload.

---

### Tab 3: Annotations

Tab label: **Annotations**
URL segment: `#annotations`
Minimum role: OPERATOR

**Annotation list:**

All annotations written within this investigation session, ordered by `authored_at` descending (most recent first). Sort controls at the top allow sorting by: authored_at (default), anchored_to timestamp (the historical time being annotated), author, confidence.

**Annotation entry anatomy:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST              │
│ Anchored to: PRE resolution event e_0928a1 at 2026-05-28 16:23:41           │
│                                                                             │
│ "The L1 override OVR-0442 was winning at this timestamp and suppressing     │
│  Campaign_Club_General. This matches the observed blackout on screen B2."   │
│                                                                             │
│ Cited in: Finding F-003                     [IMMUTABLE — written 2026-06-01]│
└─────────────────────────────────────────────────────────────────────────────┘
```

Fields displayed:
- **Confidence badge:** CONFIRMED (green) | PROBABLE (amber) | SPECULATIVE (grey)
- **Author:** operator name, not editable
- **Written timestamp:** `authored_at` in venue-local timezone
- **Anchored to:** the `anchored_to` object rendered as human-readable text: event ID + event timestamp, or time range
- **Annotation text:** full text, no truncation by default (may collapse if >400 characters with `[show more]`)
- **Finding citation:** if this annotation is cited in a finding, the finding ID is shown as a link to jump to Tab 4
- **IMMUTABLE badge:** always present at the bottom right of every annotation. Text: `[IMMUTABLE — written YYYY-MM-DD]`. This is not a status that changes — it is a permanent label on all annotations.

**SUPERSEDED annotation rendering:**

A superseded annotation is shown immediately adjacent to its superseding annotation. They are visually grouped with a connecting line or indentation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [SPECULATIVE] ●  J. Rangi  ·  Written: 2026-06-01 08:47:01 AEST            │
│ ░░░░░░░░░░░░░░░░░░ SUPERSEDED ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ Superseded by: annotation ANN-0029 (see below)                              │
│                                                                             │
│ [grey, dimmed text]                                                         │
│ "The divergence may have been caused by network latency on screen B2."      │
│                                                                             │
│ [IMMUTABLE — written 2026-06-01] [SUPERSEDED]                               │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    └──▶
┌─────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED] ●  J. Rangi  ·  Written: 2026-06-01 09:14:22 AEST              │
│ Supersedes: ANN-0028 (above)                                                │
│                                                                             │
│ [active text, full opacity]                                                 │
│ "Correction of ANN-0028: The cause was not network latency but the L1      │
│  override OVR-0442 suppressing Campaign_Club_General. Confirmed via PRE     │
│  resolution trace for event e_0928a1."                                      │
│                                                                             │
│ [IMMUTABLE — written 2026-06-01] [SUPERSEDES ANN-0028]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Visual rules for SUPERSEDED annotations:
- Background: grey-tinted (e.g., `#f5f5f5` on light theme)
- Text colour: dimmed (50% opacity)
- A horizontal "SUPERSEDED" watermark-style text across the body
- The original text remains fully readable (do not use `display: none`, `visibility: hidden`, or blur)
- A link to the superseding annotation is shown directly below the SUPERSEDED marker
- The `[IMMUTABLE]` badge remains, joined by a `[SUPERSEDED]` badge

**Write annotation form:**

Accessed via `[+ Write annotation]` button at the top of the Annotations tab, or via `[Annotate this event]` from the Event Stream or Timeline tabs.

Form fields:

```
Anchor this annotation to:
  ● Specific event  [Event ID: ____________] [Browse events]
  ○ Specific timestamp  [2026-05-28] [__:__:__] AEST
  ○ Time range  [from: ____] [to: ____] AEST

Annotation text (required — 10–2000 characters):
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
[Characters remaining: 2000]

Confidence (required):
  ○ CONFIRMED — I have high certainty based on direct evidence
  ● PROBABLE  — I believe this is correct but acknowledge uncertainty
  ○ SPECULATIVE — My evidence is indirect or I am not certain

Supersedes annotation? (optional — use when correcting a prior annotation):
  [Select annotation to supersede ▼]
  Note: The prior annotation is not removed. It will be marked SUPERSEDED.

[Cancel]  [Submit annotation]
```

On form submission:
- The annotation is written to the backend immediately
- The form collapses
- The new annotation appears at the top of the annotation list
- The `[IMMUTABLE — written YYYY-MM-DD]` badge appears immediately on the new annotation
- No edit button is rendered. The annotation entry has no edit, modify, or delete affordance.
- If the annotation was submitted with a `supersedes` reference, the superseded annotation is immediately updated in the list to show the SUPERSEDED treatment

**Annotation after submission — exact UI state:**

The submitted annotation renders with:
- Author, written timestamp, confidence badge, anchor, full text — all as described above
- `[IMMUTABLE — written YYYY-MM-DD]` badge — always present
- No `[Edit]` button
- No `[Delete]` button
- No text input affordance of any kind
- The only action available on a submitted annotation: `[Supersede this annotation]` — which opens the write form pre-populated with `supersedes: <this_annotation_id>`

**Supersede annotation path:**

`[Supersede this annotation]` button appears below each non-SUPERSEDED annotation. Clicking it opens the annotation write form with:
- The `supersedes` field pre-filled with the annotation ID and its first 100 characters shown as a preview
- A warning: "You are writing a correction to annotation ANN-0028. The original annotation will remain visible marked SUPERSEDED. Your new annotation must explain the correction."
- All other form fields empty (text, confidence, anchor — all must be filled by the author)

The operator cannot pre-populate the text with the prior annotation's text. The new annotation must be written independently.

**Contradiction indicator:**

If two annotations are detected as proximity-based contradictions (same `anchored_to` event or overlapping time ranges with conflicting signals), both annotations display a red `[! CONTRADICTION DETECTED]` badge. Clicking the badge opens the contradiction detail:

```
Contradiction detected
Between: ANN-0025 (J. Rangi) and ANN-0027 (M. Chen)
Anchor: Event e_0928a1 at 2026-05-28 16:23:41

These annotations make conflicting observations about the same event.
The system cannot determine which is correct — you must resolve this.

To resolve: Write a superseding annotation citing both, OR submit a finding
citing both with a confidence of CONFIRMED or PROBABLE.

Unresolved contradictions block incident closure for POST_INCIDENT sessions.

[Resolve by annotation]  [Resolve by finding]  [Dismiss reminder]
```

"Dismiss reminder" removes the prompt from the contradiction detail but does not mark the contradiction resolved. The `[! CONTRADICTION]` badge remains until the contradiction is programmatically resolved.

**Sort and filter options:**

- Sort: authored_at desc (default), authored_at asc, anchored_to timestamp, author name, confidence
- Filter: by author (multi-select), by confidence level (multi-select), by anchor type (event / timestamp / time_range), show SUPERSEDED (toggle — default off, showing only active annotations)

When "Show SUPERSEDED" is toggled off (default): SUPERSEDED annotations are hidden from the list but remain in the corpus. A notice below the filter bar reads: "N superseded annotation(s) hidden. [Show all]"

---

### Tab 4: Operational Findings

Tab label: **Findings**
URL segment: `#findings`
Minimum role: OPERATOR

**Finding list:**

All findings submitted within this investigation session, ordered by `authored_at` descending.

**Finding entry anatomy:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [CONFIRMED]  CLASS_3 divergence    F-003    J. Rangi  ·  2026-06-01 10:02   │
│                                                                             │
│ "The L1 operational override OVR-0442, placed on 2026-05-28 at 14:11 by    │
│  T. Nakamura, suppressed Campaign_Club_General on screens B1–B4 from        │
│  14:11 through 19:45, causing the sponsor SOV shortfall of 5.3 hours.       │
│  The override had no configured expiry and was not reviewed before the       │
│  session ended."                                                             │
│                                                                             │
│ Evidence basis:                                                             │
│   ● ANN-0029 (corpus event citation)    ● Event e_0928a1 (PRE resolution)  │
│   ● Event e_1044c2 (override created)                                       │
│                                                                             │
│ Linked incident: INC-2026-0528-001                                          │
│ [IMMUTABLE — written 2026-06-01]                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

Fields displayed:
- **Confidence badge:** CONFIRMED | PROBABLE | SPECULATIVE
- **Divergence class:** CLASS_1 | CLASS_2 | CLASS_3 | CLASS_4 (if set)
- **Finding ID:** system-generated, abbreviated
- **Author and authored_at**
- **Finding text:** full text (no truncation)
- **Evidence basis:** list of cited annotation IDs and corpus event IDs, each as a link to that entity in the relevant tab
- **Linked incident:** if set, a link to the incident
- **IMMUTABLE badge:** permanent, always visible

**UNSUPPORTED finding rendering:**

A finding submitted with no evidence_basis entries is marked UNSUPPORTED:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [SPECULATIVE]  F-004    A. Okafor  ·  2026-06-01 10:44                      │
│ ⚠  UNSUPPORTED — No evidence citations provided                              │
│    This finding cannot be used as the sole basis for incident closure.       │
│    It cannot be the effective conclusion of a POST_INCIDENT investigation    │
│    without at least one CONFIRMED or PROBABLE supported finding.             │
│                                                                             │
│ "The network issues observed may have been caused by firmware on device      │
│  D-0041, but I have not been able to confirm this in the corpus."            │
│                                                                             │
│ Evidence basis: (none)                                                       │
│ [IMMUTABLE — written 2026-06-01] [UNSUPPORTED]                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

The UNSUPPORTED badge and warning text are always visible on UNSUPPORTED findings. They are not collapsible. This is not an error state — it is a valid finding state with documented operational restrictions.

**Write finding form:**

```
Finding text (required — 50–5000 characters):
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘

Evidence citations (recommended — may be left empty, produces UNSUPPORTED):
  + Add annotation citation   [ANN-______]
  + Add corpus event citation [EVT-______]
  [Browse annotations]  [Browse events]

  Current citations:
  ● ANN-0029  (J. Rangi — "The L1 override OVR-0442...")
  ● e_0928a1  (PRE resolution 2026-05-28 16:23:41)

Confidence (required):
  ○ CONFIRMED   ● PROBABLE   ○ SPECULATIVE

Divergence classification (optional):
  [CLASS_1 — Operational]  [CLASS_2 — Significant]  [CLASS_3 — Serious]  [CLASS_4 — Critical]

Link to incident (optional):
  [Select incident ▼]

Supersedes finding? (optional):
  [Select finding to supersede ▼]

[Cancel]  [Submit finding]
```

If evidence_basis is empty at submission, the system accepts the finding but immediately renders the UNSUPPORTED marker. No blocking confirmation is required — but the UNSUPPORTED warning appears in the submit button area before submission: "Warning: You have no evidence citations. This finding will be marked UNSUPPORTED."

**Finding severity levels and rendering:**

Severity is expressed through the divergence classification, not a separate severity field.

| Class | Colour | Meaning |
|---|---|---|
| CLASS_1 | Blue | Operational — minor divergence, recoverable |
| CLASS_2 | Amber | Significant — notable divergence, intervention required |
| CLASS_3 | Orange | Serious — material impact on delivery or compliance |
| CLASS_4 | Red | Critical — structural failure, sponsor or compliance breach |

Unclassified findings render without a class badge (grey).

**Findings and incident closure:**

A notice at the top of the Findings tab, rendered when this investigation is linked to an incident:

```
ℹ  This investigation is linked to incident INC-2026-0528-001.
   For that incident to transition to RESOLVED, at least one CONFIRMED or PROBABLE
   finding with at least one evidence citation must exist, and all contradictions
   must be resolved.

   Current status:
   ● Supported findings: 1 (CONFIRMED)        ✓
   ● Unresolved contradictions: 2             ✗ — blocks closure
```

---

### Tab 5: Corpus Diff (Divergence View)

Tab label: **Corpus Diff**
URL segment: `#corpus-diff`
Minimum role: OPERATOR
Available: Only when `divergence_report` is present for this session. If absent, the tab is visible but disabled with the message: "No divergence report is associated with this investigation session."

**What corpus diff shows:**

A side-by-side or overlay comparison of:
- **Expected state** (left panel): what PRE computed the venue should be delivering at each time point within the session range
- **Actual state** (right panel): what delivery-confirmed data shows was actually delivered to devices

The comparison is shown as a timeline per screen, similar to the delivery confirmation view in TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md §3.1.

**Layout:**

```
Corpus Diff — The Parklands Golf Club — 2026-05-28 14:00–19:45

Parity ratio: 94.1%    [Divergence found in: 23/412 resolution windows]

Screen B1: ─────────────────[EXPECTED]────────────────────────────────────────
           ─────────────────[ACTUAL  ]────────────────────░░░░░░░░░░──────────
                                                           ↑ 16:23–17:12
                                                           Divergence zone

Screen B2: ─────────────────[EXPECTED]────────────────────────────────────────
           ─────────────────[ACTUAL  ]────────────────────░░░░░░░░░░░░░░░──────
                                                           ↑ 16:23–18:34
                                                           PRE_DIVERGENCE events
```

Divergence zones are highlighted in amber (expected vs actual mismatch) or red (delivery confirmation gap — device did not report delivery).

**PRE_DIVERGENCE events in the timeline:**

When a PRE_DIVERGENCE event exists in the corpus for a time point shown in the diff view, that time point is marked with a red diamond on the expected/actual comparison line, consistent with the event type marker used in Tab 1.

**Parity ratio indicator:**

Displayed prominently at the top of the tab: the percentage of resolution windows within the session time range where expected state matched actual state. Below 95%: amber. Below 85%: red. At 100%: green.

**How divergence is highlighted:**

- Divergence zones (expected ≠ actual): amber hatching pattern on the actual delivery row
- No-delivery zones (expected content, no delivery confirmation): red fill on the actual delivery row
- PRE_DIVERGENCE flagged events: red diamond marker on the timeline, consistent with Tab 1 event markers

Clicking a divergence zone or PRE_DIVERGENCE marker opens a detail panel below the screen rows showing:
- The expected PRE resolution output at that timestamp
- The actual delivery record (or absence thereof)
- Any PRE_DIVERGENCE event payload

**Download corpus diff:**

At the top right of the tab: `[Download corpus diff as CSV]` button. Downloads a CSV containing all resolution windows in the session range with columns: timestamp, screen_id, expected_content_id, expected_resolution_level, actual_content_id, delivered_confirmed (boolean), divergence (boolean). This is a read-only export with no side effects.

---

### Tab 6: Counterfactual Analysis (ADMIN only)

**Critical designer instruction:** Tab 6 does not exist in the DOM for non-ADMIN operators. It is not a disabled tab, not a greyed-out tab, not a tab with a lock icon. It is absent from the rendered tab list. The tab navigation for a non-ADMIN operator shows tabs 1–5 only. There is no visible affordance that suggests a sixth tab exists. The tab container renders exactly five tabs for non-ADMIN operators, with no gaps, no lock icons, and no "upgrade" messaging.

Tab label: **Counterfactual** (ADMIN only)
URL segment: `#counterfactual`
Minimum role: ADMIN

If a non-ADMIN operator somehow navigates directly to the `#counterfactual` URL fragment, the system renders a blank panel with: "This section is not available." No explanation of what the section is or why it is unavailable.

**Counterfactual parameters form:**

```
HYPOTHETICAL ANALYSIS — Results are advisory. They do not change the corpus.
─────────────────────────────────────────────────────────────────────────────

Base event: [Select PRE resolution event to run counterfactual against ▼]
  Currently selected: e_0928a1 — PRE resolution at 2026-05-28 16:23:41

Modified parameters:
  Parameter                     Original value        Hypothetical value
  override_stack_depth          3                     [___________]
  campaign_priority_weight      1.0                   [___________]
  [+ Add parameter]

[Run counterfactual]
```

Only parameters present in the original `base_input` may be modified. Introducing new parameters not present in the original input is not permitted (the form does not allow adding parameters with names that do not exist in the base_input schema).

The `[Run counterfactual]` button generates a `COUNTERFACTUAL_RUN` audit event before the run executes.

**Counterfactual output:**

After a run completes, the result is displayed below the form:

```
HYPOTHETICAL RESULT — This did not occur. This is a simulation.
─────────────────────────────────────────────────────────────────────────────
Run ID: CF-2026-0601-001    Run by: J. Rangi    Run at: 2026-06-01 10:58:22

Modified: override_stack_depth: 3 → 1

Counterfactual PRE output:
  Winning level: L3 (Campaign)
  Winning content: Campaign_Club_General
  (vs actual: L1 Override — OVR-0442 — Club_Sponsor_B)

Interpretation: Under the hypothetical configuration, Campaign_Club_General
would have won on screen B2 at this resolution point.

[Cite in finding]  [Run another counterfactual]
```

**Advisory-only label:**

The HYPOTHETICAL label appears:
1. In the form header before running
2. In large text at the top of the result panel
3. On the result panel when the operator clicks `[Cite in finding]`

The `[Cite in finding]` button opens the finding write form (Tab 4) pre-populated with the `counterfactual_result` field containing a summary of this run. The finding write form shows a notice: "You are citing a counterfactual result. Your finding text must make clear this is a hypothetical, not a description of what actually happened."

**Results are not annotations:**

Counterfactual results are a separate entity type. They appear in the counterfactual tab only, not in Tab 3 (Annotations). They cannot be promoted to annotations. They can be cited in findings via the `counterfactual_result` field, which is a string summary, not a direct entity link.

**Audit log of counterfactual runs:**

Below the result display, a log of all counterfactual runs in this investigation session:

```
Counterfactual history (this session)
CF-2026-0601-001  J. Rangi  10:58:22  override_stack_depth: 3→1    [view]
CF-2026-0601-002  J. Rangi  11:03:45  campaign_priority_weight: 1.0→0.5  [view]
```

Clicking `[view]` on a historical run restores that run's parameters and output in the display panel.

---

## 5. Zone C — Investigation Context Panel

Zone C (right panel, ~280px width by default, collapsible) shows the investigation context for the current session. Zone C content is persistent — it does not change when the operator switches tabs in Zone B.

**Related incident(s) panel:**

If this investigation session has a linked `incident_id`, a panel shows:

```
Linked incident
INC-2026-0528-001  ·  CLASS_3  ·  CONTAINED
The Parklands Golf Club — Sponsor SOV shortfall
[View incident →]
```

"View incident" navigates to the IC surface in a new tab. It does not navigate the current workspace.
If no incident is linked: the panel shows "No linked incident. [Link to incident]" — which allows ADMIN and session owner to link this session to an existing incident. Linking requires entering an incident ID and confirmation.

**Evidence package panel:**

A running count of evidence collected so far in this session:

```
Evidence collected
  Annotations:  7 (2 SUPERSEDED)
  Findings:     2 (1 CONFIRMED, 1 SPECULATIVE)
  Contradictions: 2 unresolved ⚠
  Corpus events cited: 5
```

This is a summary panel, not a list. Clicking any line navigates to the relevant tab.

**Session collaborators panel:**

```
Session collaborators
  J. Rangi (you — session owner)    Active now
  M. Chen                           Active now
  A. Okafor                         Last seen 14m ago
```

Collaborator presence is live (WebSocket-driven). The presence indicators update without page refresh. The collaborators panel is read-only: it does not include messaging, call, or coordination controls.

**Contradiction summary:**

A dedicated panel showing unresolved contradictions:

```
Unresolved contradictions ⚠
  2 contradictions require resolution before incident closure.

  1. ANN-0025 vs ANN-0027 — anchor: event e_0928a1
     [Resolve now →]
  2. ANN-0031 vs ANN-0033 — anchor: 16:30–16:45 range
     [Resolve now →]
```

"Resolve now" navigates to Tab 3 (Annotations) and scrolls to the relevant contradiction pair. Zone C remains visible during this navigation.

---

## 6. State Variations

### 6.1 Active Replay (Corpus Available)

Default state. All tabs enabled as described above (Tab 6 per role). Timeline loaded and interactive. Playback controls operational. The session header shows `▶ REPLAYING` or `⏸ PAUSED`.

### 6.2 Corpus Loading State

While the corpus data is being fetched on workspace mount:

- RP-TIMELINE: shows a loading skeleton (animated grey bars representing the time axis)
- RP-MAIN: shows a loading spinner with text "Loading corpus data for this session..."
- RP-TOP header: session identity fields show, but playback controls are disabled (dimmed, non-interactive)
- REPLAY mode banner: visible immediately on mount, before corpus loads

If corpus loading takes more than 8 seconds, an advisory appears: "Corpus loading is taking longer than expected. Large time ranges may take up to 60 seconds."

### 6.3 Corpus Unavailable / Offline (Degraded Replay)

If the corpus backend is unreachable or the corpus for this session's time range is not available:

- RP-TIMELINE: renders a static error state: "Corpus data unavailable — timeline cannot be loaded."
- RP-MAIN Tab 1 (Timeline): shows the error state with venue, session range, and attempted load time.
- Tabs 2 (Event Stream) and 5 (Corpus Diff): disabled. Error state: "Corpus data required."
- Tabs 3 (Annotations) and 4 (Findings): available. Annotations and findings already written within this session are readable. New annotations and findings may still be submitted — they will be anchored to timestamps or manually entered event IDs.
- Tab 6 (ADMIN only): available for viewing prior counterfactual results, but `[Run counterfactual]` is disabled with "Corpus data required to run counterfactual."

A persistent amber banner below the REPLAY mode banner: "Corpus data is unavailable. Annotations and findings can still be written, but event citations and timeline navigation are offline."

### 6.4 Post-Incident Replay (Linked to a Resolved Incident)

The investigation session has `session_type: POST_INCIDENT` and a linked `incident_id`.

Additional UI elements compared to the default state:
- Zone C shows the linked incident with its RESOLVED status
- Tab 4 (Findings) shows the incident closure constraint notice (described in Section 4.4)
- If contradictions are unresolved, the contradiction summary in Zone C shows a red badge: "CLOSURE BLOCKED: 2 unresolved contradictions"
- The `[Conclude investigation]` action (accessible via the session header dropdown) checks for unresolved contradictions before allowing conclusion. If contradictions exist, the conclusion workflow shows: "2 unresolved contradictions exist. Concluding will require ADMIN override. [Override with ADMIN credentials] [Resolve contradictions first]"

### 6.5 Standalone Investigation (Not Linked to an Incident)

The investigation session has no `incident_id`. There is no linked incident in Zone C.

The `[Link to incident]` affordance is shown in Zone C. Incident closure constraints in Tab 4 are absent. Contradiction warnings are shown but do not reference incident closure.

The session can be concluded without resolving contradictions (a warning is shown, but it is not blocking).

---

## 7. REPLAY Mode Enforcement

### Controls absent from this surface

The following controls are absent from this surface at all times. "Absent" means not rendered in the DOM. If any of these elements appear on the Replay Investigation Surface, it is an implementation defect:

**Override controls (all absent):**
- Override creation form or button
- Override removal or clearance button
- Override scope modification
- Emergency override activation
- Emergency clearance button

**Incident controls (all absent):**
- Incident declaration form or button
- Incident severity escalation button
- Incident commander assignment
- Incident CONTAINED / RESOLVED transition button
- Handoff workflow trigger

**PRE modification controls (all absent):**
- PRE resolution parameter modification
- Live fallback content selection
- PRE disable / re-enable toggle
- Shadow mode toggle

**Content delivery controls (all absent):**
- Screen content push
- Schedule activation or deactivation
- Campaign start / stop

**Session and authentication controls (absent from Zone B):**
- Session revocation
- Role modification
- Operator permission changes

### Persistent "This is a replay session" label

The amber banner described in Section 2 must:
- Remain visible at all viewport widths (minimum 320px)
- Remain visible when Zone C is collapsed
- Remain visible when RP-TIMELINE is scrolled horizontally
- Remain visible behind all open drawers (the banner is not an overlay; drawers render over Zone B below the banner)
- Not be collapsible, dismissible, or hideable by any operator action
- Be present in the DOM from the moment the workspace mounts (before corpus data loads)

### Server-side rejection behavior

If a write attempt for a production write action somehow reaches the backend while the session is in REPLAY mode (for example, due to a browser extension or malformed request), the backend will reject the request with HTTP 403 and the response body:

```json
{
  "error": "REPLAY_MODE_WRITE_REJECTED",
  "message": "This session is a replay investigation session. Production write operations are not permitted.",
  "session_id": "...",
  "attempted_action": "..."
}
```

The frontend, if it receives this response (which should not happen under correct implementation), renders an inline error panel:

```
Write rejected by server
Action: [attempted action description]
Reason: This is a replay investigation session. Production state cannot be modified.

This is a system error — replay sessions should not attempt production writes.
Contact your platform administrator if this persists.

[Dismiss]
```

The `[Dismiss]` button removes the error panel. No retry. No further action available to the operator from this panel.

---

## 8. Historical Trust Rendering

### How trust state is displayed at historical time

Every event, PRE resolution output, and device health indicator in the Replay Investigation Surface is rendered using the trust state computed at the time of that event — not the current trust state.

**Implementation requirement:** The corpus event record must carry `trust_state_at_event` and `confidence_at_event` fields. The frontend renders these values, not the current constitutional state. If these fields are absent from a corpus event, the frontend renders a trust state indicator of "UNKNOWN (historical trust data unavailable)" — amber text.

**Visual treatment:**

On any trust or health indicator in the Replay Investigation Surface:
```
Trust state (at event time): RECOVERED_BUT_UNTRUSTED  [as of 2026-05-28 16:23 AEST]
```

A small "(historical)" label follows every trust indicator. This label is not a tooltip — it is always visible inline, 10px text, grey, immediately after the trust state value.

### RECOVERED_BUT_UNTRUSTED in historical timeline

When the corpus contains a trust state of RECOVERED_BUT_UNTRUSTED for a device or venue at a given time point, the timeline renders:
- A distinct amber dot on the device health swim lane
- The label "RECOVERED_BUT_UNTRUSTED" in 11px amber text below the dot
- In the event detail panel: a notice explaining what this means: "At this time, the device or venue had recovered from an outage or degradation event but trust had not been re-established. PRE resolution output is available but delivery confirmation from this device during this period is lower-authority evidence."

### Retroactive trust improvement is forbidden

Trust state displayed for any historical event must not be improved or updated to reflect subsequent trust restoration. If a device was RECOVERED_BUT_UNTRUSTED at 16:23, it must be shown as RECOVERED_BUT_UNTRUSTED for all events at or before that time, even if the same device was later re-established as TRUSTED.

The frontend must not:
- Fetch the current trust state for a device and apply it to historical event rendering
- Show "TRUSTED" for an event where the historical trust state was RECOVERED_BUT_UNTRUSTED
- Apply any post-hoc trust improvement to historical data visualizations

This rule applies to all tabs and all components in the Replay Investigation Surface without exception.

---

## 9. Annotation Immutability UX

### After annotation submission — exact UI change

At the moment of annotation submission (user clicks `[Submit annotation]`, server returns success):
1. The write form collapses to zero height with a transition animation
2. The submitted annotation appears at the top of the Tab 3 annotation list
3. The annotation renders in its final immutable form: author, timestamp, confidence, anchor, text
4. The `[IMMUTABLE — written YYYY-MM-DD]` badge renders immediately in the bottom-right corner of the annotation card
5. No edit input, no pencil icon, no hover state that suggests editability
6. The annotation card border is rendered in a completed/settled visual state (not the active/editable border used during form input)
7. The `[Supersede this annotation]` button appears at the bottom of the card — this is the only action available

The transition from "form submitted" to "immutable annotation" should be visually distinct enough that the operator understands they cannot go back. A brief confirmation message is acceptable: "Annotation written. This annotation is permanent." — auto-dismissing after 3 seconds.

### "Supersede annotation" path

When the operator clicks `[Supersede this annotation]` on an existing annotation:

1. The write form opens at the top of Tab 3 (not inline with the annotation being superseded)
2. The form shows a non-collapsible notice: "Writing a correction to ANN-XXXX. The original annotation will be permanently marked SUPERSEDED but will remain visible."
3. A preview of the annotation being superseded is shown: first 100 characters, grey background
4. The `supersedes` field is pre-filled and is read-only — the operator cannot de-select which annotation they are superseding
5. All other form fields (text, anchor, confidence) must be filled by the operator
6. On submission, the prior annotation immediately receives the SUPERSEDED visual treatment (grey, dimmed, watermark)
7. The new superseding annotation appears above the superseded annotation in the list, with a visual connector
8. Both annotations show the relationship: the superseded annotation shows "Superseded by ANN-YYYY", and the superseding annotation shows "Supersedes ANN-XXXX"

### How SUPERSEDED annotations render

SUPERSEDED annotations are never deleted, never hidden (unless the filter "show SUPERSEDED" is toggled off), and never shown without their SUPERSEDED status.

Rendering specification:
- Background fill: `--color-surface-superseded` (grey-tinted, approximately 10% darker than the default surface)
- Text opacity: 60%
- Full text remains readable — do not use blur, redaction bars, or `display: none`
- A horizontal banner across the top of the annotation card: "SUPERSEDED — see ANN-YYYY below"
- The `[IMMUTABLE — written YYYY-MM-DD]` badge remains
- A `[SUPERSEDED]` badge appears alongside the immutable badge
- The `[Supersede this annotation]` action is absent (a superseded annotation cannot itself be superseded — to further correct, the operator supersedes the superseding annotation)
- The annotation text remains interactable for selection/copy — it is visually dimmed but not disabled

---

## 10. Interactive Controls — Complete Inventory

The following table lists every interactive control on the Replay Investigation Surface. Zero controls in this list affect live venue state.

| Control | Location | Action | Role required | Confirmation required |
|---|---|---|---|---|
| Play/Pause toggle | RP-TOP, RP-TIMELINE | Starts/stops corpus replay playback | OPERATOR | No |
| Speed selector (0.25x/0.5x/1x/2x/4x) | RP-TOP, RP-TIMELINE | Sets replay playback speed | OPERATOR | No |
| Step forward/back buttons | RP-TIMELINE controls | Advances/retracts playhead by one corpus event | OPERATOR | No |
| Jump to start/end buttons | RP-TIMELINE controls | Sets playhead to session start/end | OPERATOR | No |
| Timeline click to seek | RP-TIMELINE | Moves playhead to clicked timestamp, pauses | OPERATOR | No |
| Timeline drag to scrub | RP-TIMELINE | Moves playhead continuously during drag | OPERATOR | No |
| Timeline zoom in/out | RP-TIMELINE | Adjusts time scale of visible range | OPERATOR | No |
| Fit all button | RP-TIMELINE | Resets zoom to show full session range | OPERATOR | No |
| Range selector handles | RP-TIMELINE | Adjusts investigation focus window (view only) | OPERATOR | No |
| Clear range button | RP-TIMELINE | Resets range selector to full session range | OPERATOR | No |
| Tab switcher (Tabs 1–5, or 1–6 for ADMIN) | RP-MAIN | Switches active analysis tab | OPERATOR | No |
| Event row expand | Tab 2 | Expands event row to show full payload | OPERATOR | No |
| Event stream filters | Tab 2 | Filters the event stream by type/source/range | OPERATOR | No |
| Clear filters button | Tab 2 | Resets event stream filters | OPERATOR | No |
| Write annotation button | Tab 3, Tab 2, Tab 1 | Opens annotation write form | OPERATOR | No |
| Submit annotation | Tab 3 write form | Submits annotation to backend | OPERATOR | No (see validation rules) |
| Cancel annotation form | Tab 3 write form | Dismisses form without submitting | OPERATOR | No |
| Supersede annotation button | Tab 3, per annotation | Opens write form pre-filled with supersedes reference | OPERATOR | No |
| Contradiction resolve by annotation | Tab 3 contradiction detail | Opens write form | OPERATOR | No |
| Contradiction resolve by finding | Tab 3 contradiction detail | Opens Tab 4 write form | OPERATOR | No |
| Contradiction dismiss reminder | Tab 3 contradiction detail | Removes the prompt (does not resolve the contradiction) | OPERATOR | No |
| Annotation sort selector | Tab 3 | Changes annotation sort order | OPERATOR | No |
| Annotation filter controls | Tab 3 | Filters annotation list | OPERATOR | No |
| Show SUPERSEDED toggle | Tab 3 | Toggles visibility of superseded annotations | OPERATOR | No |
| Submit finding button | Tab 4 write form | Submits finding to backend | OPERATOR | No (warning displayed if UNSUPPORTED) |
| Cancel finding form | Tab 4 write form | Dismisses form without submitting | OPERATOR | No |
| Supersede finding button | Tab 4, per finding | Opens write form with supersedes reference | OPERATOR | No |
| Corpus diff download | Tab 5 | Downloads CSV of divergence data | OPERATOR | No |
| Divergence zone click | Tab 5 | Opens detail panel for that zone | OPERATOR | No |
| Run counterfactual | Tab 6 (ADMIN) | Executes counterfactual PRE run | ADMIN | No (audit event generated) |
| Add counterfactual parameter | Tab 6 (ADMIN) | Adds modified parameter row to form | ADMIN | No |
| Cite in finding | Tab 6 (ADMIN) | Opens finding write form pre-filled | ADMIN | No |
| Run another counterfactual | Tab 6 (ADMIN) | Resets the counterfactual form | ADMIN | No |
| View historical counterfactual run | Tab 6 (ADMIN) | Loads a prior run into the display panel | ADMIN | No |
| Link to incident | Zone C | Links this session to an existing incident | Session owner or ADMIN | Yes — enter incident ID + confirm |
| View incident link | Zone C | Navigates to IC surface in new tab | OPERATOR | No |
| Resolve contradiction (Zone C) | Zone C | Navigates to Tab 3 and scrolls to contradiction | OPERATOR | No |
| Conclude investigation | RP-TOP session dropdown | Concludes the investigation session | Session owner or ADMIN | Yes — select conclusion type |
| Abandon investigation | RP-TOP session dropdown | Abandons the investigation (advisory prompt) | Session owner or ADMIN | Yes — advisory (non-blocking) |
| Zone C collapse/expand | Zone C panel edge | Collapses or expands Zone C | OPERATOR | No |

---

## 11. Audit Events Emitted

All events use the format `{domain}:{entity}:{action}`.

Replay navigation events are Class B (navigation/telemetry). Investigation write events are Class A (operator action, audit-grade).

| Event name | Class | Trigger | Required payload fields |
|---|---|---|---|
| `replay:session:loaded` | B | Workspace mounts and corpus loads successfully | session_id, venue_id, time_range_hours, session_type |
| `replay:session:load_failed` | B | Corpus load fails | session_id, venue_id, error_type |
| `replay:playback:started` | B | Operator presses play | session_id, playhead_position, speed |
| `replay:playback:paused` | B | Operator presses pause | session_id, playhead_position |
| `replay:playback:speed_changed` | B | Operator changes speed | session_id, previous_speed, new_speed |
| `replay:playback:seeked` | B | Operator clicks or drags to seek | session_id, previous_position, new_position, seek_type (click\|drag) |
| `replay:tab:switched` | B | Operator switches analysis tab | session_id, from_tab, to_tab |
| `replay:event:selected` | B | Operator clicks a corpus event | session_id, event_id, event_type |
| `replay:annotation:opened` | B | Operator opens annotation write form | session_id, anchor_type, anchor_event_id (if event anchor) |
| `investigation:annotation:written` | A | Annotation submitted successfully | annotation_id, investigation_id, authored_by, authored_at, anchored_to_type, text_hash, confidence, supersedes (if set) |
| `investigation:annotation:superseded` | A | Annotation marked superseded | annotation_id, superseded_by_annotation_id, supersession_at |
| `investigation:finding:submitted` | A | Finding submitted successfully | finding_id, investigation_id, authored_by, authored_at, evidence_count, confidence, unsupported_flag, divergence_class (if set) |
| `investigation:finding:superseded` | A | Finding marked superseded | finding_id, superseded_by_finding_id, supersession_at |
| `investigation:counterfactual:run` | A | ADMIN runs counterfactual | counterfactual_id, investigation_id, run_by, run_at, base_event_id, modified_parameter_count |
| `investigation:contradiction:detected` | A | System detects proximity contradiction | investigation_id, annotation_ids[], anchored_to, detected_at |
| `investigation:contradiction:resolved` | A | Contradiction marked resolved | investigation_id, contradiction_annotation_ids[], resolved_by, resolved_at, resolution_type |
| `investigation:session:concluded` | A | Investigation concluded | investigation_id, concluded_by, concluded_at, conclusion_type, linked_finding_ids[] |
| `investigation:session:abandoned` | A | Investigation abandoned | investigation_id, abandoned_by, abandoned_at, annotation_count, closing_reason (if provided) |
| `investigation:incident:linked` | A | Session linked to an incident | investigation_id, incident_id, linked_by |
| `replay:corpus_diff:downloaded` | B | Operator downloads corpus diff CSV | session_id, investigation_id, download_timestamp |
| `replay:write_rejected:received` | A | Server returns REPLAY_MODE_WRITE_REJECTED | session_id, attempted_action, rejection_received_at |

---

## 12. Forbidden Patterns

The Replay Investigation Surface must never do any of the following. Each item is a hard constraint — not a design preference.

**Live state write controls:**
- Must never render a button, form, toggle, or any affordance that writes to live venue operational state (overrides, incidents, emergencies, campaigns, PRE configuration)
- Must never render the OverrideControl component or any of its sub-elements
- Must never render the IncidentDeclaration component or any incident state transition control
- Must never render the HandoffWorkflow or RecoveryWorkflow components
- Must never render the EmergencyActivation or EmergencyCleared forms

**Annotation and finding manipulation:**
- Must never render an edit button, edit icon, or text input over an existing annotation or finding
- Must never allow annotation text, authored_by, authored_at, or anchored_to to be modified after write
- Must never render a delete button, remove button, or archive option on any annotation, finding, or counterfactual
- Must never hide a SUPERSEDED annotation without explicit operator filter action (the "show SUPERSEDED" toggle)
- Must never show a SUPERSEDED annotation as the primary/active annotation without simultaneously showing its superseding annotation

**Historical trust manipulation:**
- Must never apply current trust state to historical event rendering
- Must never show a trust improvement for historical events retroactively
- Must never render "TRUSTED" for a device at a historical time when the corpus trust state was RECOVERED_BUT_UNTRUSTED or lower

**Tab 6 for non-ADMIN:**
- Must never render Tab 6 in the DOM for non-ADMIN operators
- Must never render a disabled, greyed, locked, or placeholder tab 6 for non-ADMIN operators
- Must never show messaging that implies a sixth tab exists for non-ADMIN operators
- If a non-ADMIN operator navigates to the `#counterfactual` URL fragment: render a blank panel, not an error explaining what the panel is

**Incident state transitions:**
- Must never allow incident CONTAINED → RESOLVED transition from this surface
- Must never allow incident severity escalation from this surface
- Must never allow incident commander assignment or change from this surface

**Corpus modification:**
- Must never allow any operation that modifies, overwrites, or removes a corpus event record
- Must never allow counterfactual results to be written back to the corpus or presented as corpus events
- Must never intersperse counterfactual results with corpus events in the Event Stream or Timeline

**Navigation side effects:**
- Must never trigger a production API write as a side effect of navigating between tabs, seeking in the timeline, or loading the workspace
- Must never change the current operator's operational context (active venue, active incident) as a side effect of loading a replay session

---

*End of CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md*
*Document authority: Agent 3 (UX/Design)*
*Data model authority: INVESTIGATION-AND-REPLAY-INFORMATION-MODEL-v1.md (Platform governance)*
*Component structure authority: FRONTEND-COMPONENT-TAXONOMY-v1.md (Platform shell team)*
*Historical trust rendering: coordinates with Platform for `trust_state_at_event` corpus field requirement*
