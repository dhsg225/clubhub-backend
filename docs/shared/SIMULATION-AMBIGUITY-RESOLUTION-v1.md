# Simulation Ambiguity Resolution — v1

**Document type:** Authoritative ambiguity resolution
**Scope:** 4 ambiguity items (A-NEW-01 through A-NEW-04) that prevent CERTIFIED_SAFE simulation status
**Source document:** OPERATIONAL-STRESS-SIMULATION-AND-FAILURE-VALIDATION-SUITE-v1.md
**Date:** 2026-06-03
**Status:** AUTHORITATIVE — implementation teams must not interpret; they must implement exactly as specified

---

## Preamble

This document resolves four specification gaps discovered during simulation design. Each resolution is final and deterministic. No further clarification is required before implementation.

Resolutions are constrained to: no new roles, no new governance, no new workflows, no new system states, no architectural expansion. Every resolution operates within the existing canonical surface specs, constitutional rules, and patch set.

After implementation of all four resolutions, the simulation suite is unblocked and the system is eligible for re-evaluation against CERTIFIED_SAFE criteria.

---

## A-NEW-01: Zone C Advisory Escalation Visual Signaling

### 1. Problem Statement

Zone C Pane C4 (Advisory) renders advisory content as text within a fixed panel. When advisory content escalates from "no action required" to "action recommended within N hours," the text updates in-place with no change to the panel's visual state, color, border, or chrome. An operator who has habituated to the panel shows the same visual treatment for both states and will not perceive the escalation through peripheral vision or cognitive shortcut.

### 2. Why Simulation Exposed It

SIM-FAT-07 (Zone C Advisory Panel Habituation) requires a pass criterion: operator notices advisory escalation within 30 minutes of the content change. In the current spec, Zone C Pane C4 has no mechanism to produce a peripheral visual change when content changes. The scenario cannot pass because the system produces no distinguishable signal.

### 3. Architectural Impact

Zone C Pane C4 already exists. It already receives push updates. The resolution adds a **visual state layer** to the existing panel — it does not add a new panel, new pane, or new architectural component. The push event for advisory updates already carries advisory content; it must additionally carry an `advisory_level` field that drives panel visual state.

No new WebSocket events are required. The existing advisory push event payload is extended with one field.

### 4. Operational Impact

Without resolution: operators habituate to Zone C Pane C4 and miss escalations, leading to action-required advisories going unaddressed past their recommended window.

With resolution: Zone C Pane C4 has a visually distinct state for escalated advisories that is perceptible under peripheral attention without competing with incident-critical signals in Zone A or the System Status Bar.

The resolution must NOT introduce a Zone C signal that could be mistaken for an S1/S2 incident. Zone C signals are always subordinate to Zone A and System Status Bar signals in the visual hierarchy.

### 5. Human Factors Impact

Two competing risks:
- **Habituation risk (under-signal):** If the advisory escalation looks the same as the background state, fatigued operators miss it.
- **Alarm fatigue risk (over-signal):** If the advisory escalation is too prominent (flashing, red, modal), it competes with actual incident signals and trains operators to dismiss Zone C entirely.

The resolution must thread between these two failure modes. The signal must be "noticeable from the corner of eye, but clearly not an emergency."

### 6. Candidate Resolutions Considered

**Option A:** Add a Zone C pane-level badge count (e.g., "1 new advisory") in the Zone C header.
- Rejected: the zone is already open; a badge count on an already-open panel does not produce peripheral signal.

**Option B:** Add a toast notification for advisory escalation.
- Rejected: toasts are already used for rejection feedback (A-NEW-04). Overloading toasts with advisory escalation events creates noise. Toasts also auto-dismiss, meaning a fatigued operator may miss the window.

**Option C:** Add a Zone A Pane A4 (Operator Tools Menu) badge for advisory escalation.
- Rejected: Zone A badges are currently reserved for incident and override signals (severity-colored). Adding a new badge type to Zone A risks badge habituation and dilutes the incident-severity signal system.

**Option D:** Animate the Zone C panel border and change the advisory card background color when advisory_level changes.
- **Selected.** Zone C is already visible. A border and card background change within Zone C produces a peripheral color signal without occupying Zone A, the System Status Bar, or any modal surface.

**Option E:** Add an audio signal for advisory escalation.
- Rejected as a standalone: audio is device-dependent and cannot be the only mechanism. Can accompany Option D as an optional secondary signal if audio alerts are configured, but is not required.

### 7. Rejected Resolutions and Rationale

**Zone A badge for advisory:** Zone A badges carry incident severity semantics. Adding a non-incident advisory badge would dilute the severity color contract and conflict with PATCH-004. Rejected.

**System Status Bar advisory indicator:** The System Status Bar carries venue-level constitutional health signals. Advisory escalation is not a constitutional state change. Rejected.

**Modal or blocking overlay:** Advisory escalation does not require immediate operator action — it recommends action within a time window (hours, not seconds). A modal would be disproportionate and would train operators to dismiss modals. Rejected.

### 8. Final Authoritative Resolution

#### 8.1 Advisory Level Classification

Every advisory carries an `advisory_level` field with one of three values:

| Level | Definition | Action required |
|-------|-----------|----------------|
| `INFORMATIONAL` | No action required; monitoring only | None |
| `RECOMMENDED` | Action recommended within the stated window | Within stated time window |
| `URGENT` | Action recommended within 2 hours or sooner | Within 2 hours |

The `advisory_level` field is set by the backend advisory system. Frontend renders visual state based on this field. Frontend does NOT infer advisory level from text content.

#### 8.2 Zone C Pane C4 Visual State Rules

When `advisory_level` is `INFORMATIONAL` (default state):
- Pane C4: no border treatment, no background color change
- Advisory card: standard card background (`surface-2`)
- No animation

When `advisory_level` transitions to `RECOMMENDED`:
- Pane C4 outer border: `2px solid #F59E0B` (amber-400)
- Advisory card background: `#FFFBEB` (amber-50)
- Advisory card: left border accent `4px solid #F59E0B`
- Zone C panel header label "Advisory": renders `#F59E0B` text color
- No pulsing, no animation — static border change only
- Transition: CSS `transition: border-color 300ms, background-color 300ms` (smooth, not jarring)

When `advisory_level` transitions to `URGENT`:
- Pane C4 outer border: `2px solid #E64A19` (deep-orange-700)
- Advisory card background: `#FBE9E7` (deep-orange-50)
- Advisory card: left border accent `4px solid #E64A19`
- Zone C panel header label "Advisory": renders `#E64A19` text color
- A single pulse animation fires once on transition (one cycle of opacity 100%→70%→100% over 800ms), then becomes static
- Pulse fires once on transition only — NOT a continuous animation. Continuous animation in Zone C would compete with Zone A incident severity signals.

#### 8.3 Zone C Pane C4 State Reversion

When advisory is resolved (backend sets `advisory_level` back to `INFORMATIONAL`):
- All border and background treatments revert to default via CSS transition (300ms)
- No explicit "resolved" animation
- Panel returns to its habituated baseline state

#### 8.4 Color Conflict Avoidance

The amber-400 (`#F59E0B`) used for `RECOMMENDED` advisory is the same amber used for:
- PATCH-009: LIVE — UNVERIFIED pill (machine state badge)
- PATCH-011: offline autonomy countdown (>24h warning)

This is intentional: amber in this system means "attention required, not emergency." Zone C `RECOMMENDED` is consistent with this convention.

The deep-orange (`#E64A19`) used for `URGENT` advisory is the same color used for S2 CRITICAL incident badges. To prevent confusion:
- Zone C `URGENT` advisory does NOT produce a badge in Zone A
- Zone C `URGENT` advisory does NOT appear in the System Status Bar
- The visual signal is entirely contained within Zone C
- The pulse fires once (not continuously) — continuous pulse is reserved for Zone A incident badges (PATCH-005)

An operator who sees Zone C border turn deep-orange should understand: "Something in Zone C needs attention soon." They should NOT confuse it with an active S2 incident because: (a) S2 incidents fire Zone B auto-replace and Zone A severity badges, (b) Zone C is a secondary surface, (c) the signal is static (not pulsing continuously).

#### 8.5 Pane A3 (NotificationTrayAccess) Integration

When `advisory_level` transitions to `RECOMMENDED` or `URGENT`, a notification entry is also added to Pane A3 (NotificationTray). This provides a secondary signal path for operators who have Zone C collapsed (Zone C is collapsible to 48px per the canonical spec).

The NotificationTray entry format:
```
[Advisory] {advisory_title} — {advisory_level} — {recommended_action_window}
```

NotificationTray entries follow existing NotificationTray visual rules. No new badge type or color treatment is added to Pane A3 beyond what the existing notification system provides.

### 9. Required Document Updates

- **CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md:** Add Zone C Pane C4 advisory level state table and visual state rules (Section 8.2 above)
- **WIREFRAME-CROSS-REFERENCE-MATRIX-v1.md:** Add A-NEW-01 to the resolved ambiguity section; remove from open ambiguity register
- **LIVE-OPERATIONS-WIREFRAMES-v1.md:** Add advisory_level visual states to WF-LO-01 interaction notes (Zone C section)

### 10. Validation Criteria

SIM-FAT-07 (Zone C Advisory Panel Habituation) passes when:
- Zone C Pane C4 border changes from default to amber on `RECOMMENDED` transition — visually distinct in screenshot comparison
- A single pulse fires on `URGENT` transition and does not repeat
- NotificationTray entry appears in Pane A3 for both `RECOMMENDED` and `URGENT` transitions
- Color values match exactly: `#F59E0B` (RECOMMENDED), `#E64A19` (URGENT)
- No Zone A badge appears as a result of advisory escalation (Zone A is not modified by this resolution)

---

## A-NEW-02: 72-Hour Warning Urgency Differentiation

### 1. Problem Statement

The 72-hour delivery lead time requirement is a constitutional constraint on corpus delivery. The current CMS surface renders 72h warnings identically regardless of what underlies the urgency:

- A routine weekly slot that will be filled by standard content before the deadline
- A connectivity-degraded delivery path where corpus may not arrive in time even if submitted now
- A high-criticality live event (e.g., venue tournament finals) where no content means a live failure

All three render the same 72h amber banner. An operator who has seen hundreds of routine 72h warnings will apply the same habituated response to the tournament finals warning, potentially causing a live content failure.

### 2. Why Simulation Exposed It

SIM-FAT-08 (72h Delivery Timer Habituation) requires a pass criterion: operator reads the banner and correctly prioritizes the critical-event case over routine cases. In the current spec, the banner content is identical for all three urgency types. The scenario cannot produce a reliable pass because the system provides no urgency-differentiation signal.

### 3. Architectural Impact

The resolution operates entirely within the existing 72h banner component (already specified in CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md, Tab 2 and Tab 5). No new components, no new tabs, no new workflows.

The resolution requires one additional field on the corpus delivery schedule entry: `delivery_priority` (`ROUTINE` / `DEGRADED` / `HIGH_PRIORITY`). This field is set by:
- Backend delivery scheduler (for `DEGRADED` — based on connectivity state)
- Content Manager at content creation time (for `HIGH_PRIORITY` — operator-declared priority)
- Default: `ROUTINE` (no action required)

### 4. Operational Impact

Without resolution: operators apply habituated 72h dismissal to all three warning types, including HIGH_PRIORITY events.

With resolution: the banner visually distinguishes urgency tier. Operators can triage multiple simultaneous 72h warnings by priority without opening each one.

### 5. Human Factors Impact

The resolution must not add cognitive load to the routine case. The `ROUTINE` banner must remain exactly as it is — operators who have habituated to it for routine cases are correct to use their habituated response. The signal change must be limited to the non-routine cases.

The `HIGH_PRIORITY` banner must be visually distinct enough to break the habituated dismissal pattern without being so alarming that it trains operators to treat all 72h warnings as emergencies.

### 6. Candidate Resolutions Considered

**Option A:** Add a text label ("ROUTINE" / "HIGH PRIORITY") to the banner header line.
- Retained as part of the final resolution (label alone is sufficient for operators reading the banner; additional color treatment is needed for peripheral signal).

**Option B:** Change banner color for HIGH_PRIORITY (amber → red).
- Partially retained: for `HIGH_PRIORITY`, the banner border becomes deep-orange, not red. Full red is reserved for the hard-block state (72h deadline passed). Using red for HIGH_PRIORITY before deadline would create false urgency.

**Option C:** Add a separate HIGH_PRIORITY inbox or filter in Tab 2.
- Rejected: introduces a new workflow path. Operators must not need to navigate to a new location to identify urgency.

**Option D:** Add a sort/filter control that elevates HIGH_PRIORITY entries in the calendar grid.
- Retained as a secondary mechanism (Tab 2 calendar grid ordering), not as the primary signal.

### 7. Rejected Resolutions and Rationale

**New workflow path (dedicated HIGH_PRIORITY queue):** Introduces a new navigation pattern. Rejected — constraint prohibits new workflow paths.

**Modal alert for HIGH_PRIORITY 72h warnings:** A modal that fires when the operator opens Tab 2 would be intrusive and would create dismissal training. Rejected.

**Audio alert for HIGH_PRIORITY:** Cannot be the primary mechanism (device-dependent). May accompany visual changes but does not substitute. Rejected as standalone.

### 8. Final Authoritative Resolution

#### 8.1 Delivery Priority Classification

Three tiers, set by backend or operator:

| Priority | Definition | Set by | Banner treatment |
|----------|-----------|--------|-----------------|
| `ROUTINE` | Standard corpus delivery within normal parameters | Automatic (default) | Existing amber banner, no change |
| `DEGRADED` | Delivery path degraded (connectivity issues, partial sync) — content may not arrive even if submitted on time | Backend delivery monitor | Amber banner + connectivity warning line |
| `HIGH_PRIORITY` | Operator-declared critical event — live failure consequence if content misses deadline | Content Manager at creation | Distinct visual treatment (see 8.2) |

#### 8.2 Banner Visual Treatment Per Priority

**ROUTINE (unchanged from current spec + PATCH-017):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ 72h delivery lead time required for [date/time]       │
│   Slots before this time may not sync to venue players   │
│   before air                                             │
│   [⚠ Submit anyway]                    [Cancel]         │
└─────────────────────────────────────────────────────────┘
```
Border: `#F59E0B` (amber-400). Background: `#FFFBEB`. No label change.

**DEGRADED:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ 72h delivery lead time required for [date/time]       │
│   DEGRADED DELIVERY PATH — venue connectivity impaired.  │
│   Content submitted now may not arrive before deadline.  │
│   [⚠ Submit anyway]                    [Cancel]         │
└─────────────────────────────────────────────────────────┘
```
Border: `#F59E0B` (amber-400). Background: `#FFFBEB`. Added bold "DEGRADED DELIVERY PATH" line replacing Line 2. No color change from ROUTINE (connectivity degradation is already visible in Zone A / System Status Bar — the CMS banner should not duplicate that severity signal).

**HIGH_PRIORITY:**
```
┌─────────────────────────────────────────────────────────┐
│ ★ HIGH PRIORITY — 72h deadline: [date/time]             │
│ Event: [event_name] · Declared by: [operator_name]      │
│   Slots before this time will not sync before air.      │
│   [⚠ Submit anyway]                    [Cancel]         │
└─────────────────────────────────────────────────────────┘
```
Border: `2px solid #E64A19` (deep-orange-700). Background: `#FBE9E7` (deep-orange-50). Header line replaced with "★ HIGH PRIORITY — 72h deadline: [date/time]". Second line identifies the event name and who declared it HIGH_PRIORITY. The ★ symbol (star) is used exclusively for HIGH_PRIORITY 72h banners — not used anywhere else in the surface.

#### 8.3 Tab 2 Calendar Grid Ordering

In the content calendar grid (Tab 2), entries with `delivery_priority: HIGH_PRIORITY` render with a ★ prefix in the slot label and are sorted to appear above ROUTINE entries within the same day column, regardless of time. This allows operators to visually triage without opening individual slots.

`DEGRADED` entries render with a `~` prefix (same symbol used for DEGRADED venue state in Zone A) in the slot label. They do not reorder above ROUTINE entries — degradation is a condition, not a content priority.

#### 8.4 HIGH_PRIORITY Declaration Flow

When a Content Manager creates a content entry (Tab 2 slot creation form), a priority selector is available:
- Default: ROUTINE (no selection required)
- Optional: [★ Mark as High Priority] — a single checkbox or toggle, labeled "Critical event — content failure has live consequence"

Selecting HIGH_PRIORITY requires no additional confirmation. It is not an escalation workflow — it is a metadata field. The form submits as normal.

HIGH_PRIORITY cannot be set retroactively by a VIEWER. It can be set or cleared by CONTENT_MANAGER or above.

#### 8.5 Tab 5 Delivery Confidence Panel

Tab 5 (Delivery Confidence) countdown color treatment, per priority:

| Priority | Countdown color (>48h remaining) | Countdown color (24–48h) | Countdown color (<24h) |
|----------|----------------------------------|--------------------------|------------------------|
| ROUTINE | `#558B2F` (green) | `#F59E0B` (amber) | `#E64A19` (deep-orange) |
| DEGRADED | `#F59E0B` (amber, always) | `#E64A19` | `#C62828` (red) |
| HIGH_PRIORITY | `#F59E0B` (amber) | `#E64A19` | `#C62828` (pulsing, 1s cycle) |

HIGH_PRIORITY entries begin amber at >48h (ROUTINE begins green) — earlier escalation to reflect the consequence of missing.

HIGH_PRIORITY <24h: countdown pulses (same 1s opacity cycle as PATCH-011 autonomy clock) — this is the only other context in the system where a pulsing countdown appears, making the pattern consistent and learnable.

### 9. Required Document Updates

- **CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md:** Add delivery_priority field definition, banner visual treatment table, Tab 2 ordering rules, Tab 5 color treatment table
- **CMS-OPERATIONS-WIREFRAMES-v1.md:** Add WF-CMS-NEW-01 (HIGH_PRIORITY 72h banner state) as an addendum wireframe; update WF-CMS-06 to reflect DEGRADED banner variant
- **WIREFRAME-CROSS-REFERENCE-MATRIX-v1.md:** Resolve A-NEW-02; add WF-CMS-NEW-01 to master inventory

### 10. Validation Criteria

SIM-FAT-08 passes when:
- ROUTINE banner: unchanged from current spec (regression check)
- HIGH_PRIORITY banner: ★ symbol in header, `#E64A19` border, `#FBE9E7` background, event name visible
- DEGRADED banner: "DEGRADED DELIVERY PATH" line present, `#F59E0B` border (same as ROUTINE — no escalation beyond connectivity signal already in Zone A)
- Tab 2 calendar: HIGH_PRIORITY entries prefixed with ★ and sorted above ROUTINE entries in same day column
- Tab 5: HIGH_PRIORITY countdown begins amber at >48h (not green); pulses below 24h
- No new tabs, no new workflow paths, no new navigation introduced

---

## A-NEW-03: Multi-Collaborator Replay Timeline Positioning

### 1. Problem Statement

The canonical Replay Investigation Surface spec defines collaborator presence (avatar icons in the session header) but does not specify:
- Whether each collaborator's current timeline position is visible to others
- How simultaneous annotations at the same timestamp are ordered
- How contradicting annotations are detected and flagged
- What "follow leader" behavior (if any) exists

SIM-RPL-08 (Multi-Collaborator Replay — Conflicting Timeline Positions) and SIM-CON-06 (Simultaneous Replay Annotation Conflict) cannot be evaluated without authoritative rules for these behaviors.

### 2. Why Simulation Exposed It

SIM-RPL-08 requires that collaborators can see each other's timeline positions. SIM-CON-06 requires that contradicting annotations are detected and flagged. Neither behavior is defined in the canonical spec. Implementation teams have no basis for deterministic behavior.

### 3. Architectural Impact

The resolution adds:
1. A timeline position field to the collaborator presence data (already pushed via WebSocket)
2. A contradiction detection rule at the annotation API level
3. A display rule for collaborator position indicators on the Timeline (Tab 1)

No new components, no new tabs. The session header already renders collaborator avatars. The Timeline (Tab 1) already renders a scrubber. The annotation system already accepts writes.

### 4. Operational Impact

Without resolution: multi-collaborator replay sessions have undefined rendering behavior. Collaborators may silently diverge (each seeing their own position; no awareness of others). Annotation conflicts are silently accumulated without flag.

With resolution: collaborators have real-time mutual awareness of each other's investigation position. Annotation contradictions are surfaced immediately. Investigations are more coordinated.

### 5. Human Factors Impact

The resolution must not add visual complexity to Tab 1 (Timeline) that impairs the lead investigator's ability to read the timeline. Collaborator position indicators must be subordinate to the primary timeline scrubber.

The contradiction detection must surface in Tab 3 (Annotations) via the amber dot mechanism (PATCH-010) — not via a modal or interrupt.

### 6. Candidate Resolutions Considered

**Option A:** Show collaborator avatars pinned to their current timeline position on the scrubber track.
- **Selected** for position awareness. Small avatar chips (24px diameter) rendered on the scrubber track at each collaborator's position. The lead operator's scrubber handle is the primary interactive element; collaborator chips are non-interactive indicators.

**Option B:** Show a separate "positions" panel listing each collaborator's timestamp.
- Rejected: adds a new panel. The session header + scrubber track combination is sufficient.

**Option C:** "Follow leader" mode where all collaborators are locked to one operator's position.
- Rejected: introduces a new workflow (leader designation). Outside scope. Collaborators maintain independent positions.

**Option D:** Sort annotations by client timestamp (when the operator submitted).
- Rejected: client timestamps are not authoritative (clock skew, network delay). Server-received timestamp is authoritative for all ordering.

### 7. Rejected Resolutions and Rationale

**New "collaboration panel" tab:** Adds a new tab. Rejected — constraint prohibits new components.

**Mandatory position sync:** Forcing all collaborators to the same position would remove independent investigation capability. Rejected.

**Automatic contradiction resolution (merge annotations):** Annotations are additive-only and immutable. No merge or resolution mechanism can modify them. The system flags contradictions; humans resolve them. Rejected as an automated merge.

### 8. Final Authoritative Resolution

#### 8.1 Collaborator Position Indicators — Session Header

The session header (72px, always visible) already renders collaborator avatar circles. Each avatar circle is extended to show the collaborator's current timeline position as a timestamp label below the avatar:

```
Session Header (72px)
┌────────────────────────────────────────────────────────────────────┐
│ [Session Identity]    [◁ ⏸ ▶ ▶▶]  [Speed]    [A] [B] [C]  [✕]   │
│                       STATE: ⏸ PAUSED                T+01:15:22   │
│                                                   A        B   C   │
│                                              T+01:12:00 T+00:45:00 T+01:15:22 │
└────────────────────────────────────────────────────────────────────┘
```

- Each collaborator avatar shows their current `timeline_position` as `T+HH:MM:SS` below the avatar
- Position updates in real-time via WebSocket push (same cadence as existing presence data)
- The local operator's own position is shown under their avatar with bold styling
- Avatar labels are `10px` — subordinate to all other session header content
- If a collaborator has not interacted with the timeline (position = session start), show `T+00:00:00`

#### 8.2 Collaborator Position Indicators — Timeline Scrubber Track

On Tab 1 (Timeline), the scrubber track renders each collaborator's current position as a small colored pip on the track:

```
Timeline scrubber track:
──────────────●──────────────────────────────────
              ↑ Lead scrubber (interactive)

With collaborators:
──────A───────●───────────────B──────────────────
              ↑ Lead           ↑ B is ahead
  ↑ A is behind
```

- Pip shape: `6px × 16px` vertical bar, colored with the collaborator's avatar color (same color system as existing presence avatars)
- Pip is non-interactive — it does not respond to hover or click
- Pip renders below the primary scrubber track, not on top (z-index subordinate)
- Pip label: collaborator initial only (e.g., "A", "B") — no timestamp (timestamp is in session header)
- Maximum 5 collaborator pips rendered; if >5 collaborators, remaining are not shown on track (session header still shows all avatars)

#### 8.3 Annotation Ordering Rules

All annotations are displayed in Tab 3 (Annotations) sorted by their `server_received_at` timestamp, ascending (earliest first).

If two annotations share the same `session_timeline_position` (i.e., both annotate the same moment in the replay):
- They are sub-sorted by `server_received_at` (first received, first displayed)
- No merging, no conflict suppression
- Both annotations are visible in full

If two annotations share the same `session_timeline_position` AND are authored by the same operator (same `operator_id`):
- This is a "duplicate" (same person, same moment, two annotations)
- Both are accepted and displayed — no deduplication
- A small `[2 at T+01:15:22]` grouping indicator may appear but is not required

#### 8.4 Contradiction Detection Rules

An **annotation contradiction** is defined as:

Two annotations that satisfy ALL of the following:
1. Same `session_timeline_position` (within ±10 seconds)
2. Different `operator_id` (two different collaborators)
3. The annotation content contains mutually exclusive factual claims about the same observable entity

Condition 3 is evaluated by a keyword-based contradiction detector at the annotation API level. The detector checks for pairs of opposing terms applied to the same entity reference:

| Opposing pair | Entity context |
|---------------|---------------|
| `L2` / `L5`, `L1` / `L6`, etc. (PRE levels) | Any PRE level reference |
| `healthy` / `degraded`, `connected` / `offline` | Venue/player state |
| `normal` / `abnormal`, `expected` / `unexpected` | General state assertion |
| `no concern` / `concern`, `no action` / `action required` | Disposition assertion |

If contradiction detected:
1. Both annotations remain stored (additive-only, immutable)
2. Both annotations receive a `contradiction_flag: true` field in the API response
3. A `ANNOTATION_CONTRADICTION_DETECTED` audit event is written with both annotation IDs
4. Tab 3 amber dot badge fires (PATCH-010) for all collaborator sessions
5. Contradicting annotation pairs are rendered with a visual grouping and an amber `⚠ Contradiction` label between them

The amber `⚠ Contradiction` label renders inline in the Tab 3 list:
```
┌──────────────────────────────────────────────────┐
│ Investigator A · T+01:15:22                      │
│ PRE level dropped to L2 — content continuity     │
│ concern                                          │
├──────────────────────────────────────────────────┤
│ ⚠ CONTRADICTION — same timestamp, opposing claim │
├──────────────────────────────────────────────────┤
│ Investigator B · T+01:15:22                      │
│ PRE level at L5 — no concern                     │
└──────────────────────────────────────────────────┘
```

#### 8.5 Contradiction Resolution

Contradictions are resolved by human decision only. No automated resolution.

An ADMIN may add an annotation at the same timestamp that explicitly references the contradiction: "Resolution: PRE level confirmed L2 by corpus diff — see Tab 5." This annotation does not programmatically clear the `contradiction_flag` — the flags and amber dot persist until the session is closed.

The amber dot on Tab 3 persists for the life of the session once fired. Operators are not given a "dismiss contradiction" action — contradictions are evidentiary artifacts and must remain visible.

#### 8.6 Simultaneous Investigation Sessions — Same Venue, Same Time Window

It is valid for multiple operators to have independent Replay Investigation sessions open for the same venue and overlapping time windows. These are separate sessions; collaborator presence is session-scoped (only operators in the same session appear in that session's header).

Cross-session coordination is out of scope for the UI layer. Operators who want to coordinate across sessions must do so via Tab 2 (Shift Notes / Investigation Notes) or out-of-band communication.

### 9. Required Document Updates

- **CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md:** Add Section: "Multi-Collaborator Presence and Timeline Positioning" (rules from 8.1–8.6 above); add contradiction detection rules to annotation model
- **REPLAY-INVESTIGATION-WIREFRAMES-v1.md:** Update WF-RP-07 (Multi-Collaborator) to show session header with per-collaborator position timestamps and scrubber pips; add annotation contradiction rendering to WF-RP-05 (Tab 3)
- **WIREFRAME-CROSS-REFERENCE-MATRIX-v1.md:** Resolve A-NEW-03

### 10. Validation Criteria

SIM-RPL-08 passes when:
- Session header shows per-collaborator timeline positions (`T+HH:MM:SS`) under each avatar
- Scrubber track shows collaborator position pips for each active collaborator
- Pips are non-interactive (no click response)
- Position updates via push within 2s of collaborator scrub action

SIM-CON-06 passes when:
- Both annotations are accepted and stored (additive model preserved)
- Contradiction detected and flagged (`contradiction_flag: true` on both)
- Tab 3 amber dot fires for all collaborator sessions
- Inline `⚠ CONTRADICTION` label renders between the two annotations
- `ANNOTATION_CONTRADICTION_DETECTED` audit event written

---

## A-NEW-04: Forced State Push After Write Rejection

### 1. Problem Statement

When an operator's write action is rejected, the system must:
1. Communicate the rejection to the operator with sufficient specificity
2. Refresh the operator's session state to reflect the authoritative server state
3. Ensure the operator's UI does not remain in an action-pending or stale state

Four distinct rejection contexts exist, each with different causes, different operator expectations, and different recovery paths:

| Rejection type | Cause | Operator expectation violated |
|----------------|-------|------------------------------|
| **Operator action rejected** | Concurrency conflict, stale session, role boundary violation | "My action should have worked" |
| **Backend authority rejects mutation** | Constitutional constraint, governance rule, capacity limit | "I have permission but the system blocked it" |
| **PRE rejects mutation** | PRE content resolution rule prevents override at requested level | "The override I placed doesn't apply" |
| **Replay mode rejects mutation** | IC-03: write controls absent; operator bypassed DOM via API | "I thought I was in live mode" |

None of these rejection paths are fully specified in the current canonical surface specs. SIM-CON-01, SIM-CON-02, SIM-CON-05, and SIM-CON-08 all depend on defined rejection behavior.

### 2. Why Simulation Exposed It

SIM-CON-08 requires that when a write is rejected (override placement while venue is RECOVERED_BUT_UNTRUSTED), the rejecting server must push the correct state to the stale session. Without a forced state push, the operator's UI remains at the stale state that caused them to attempt the write in the first place — they see their override was rejected but still see the incorrect LIVE (green) state that suggested the override was valid.

Multiple SIM-CON scenarios require visible rejection UX (error message, not silent failure). None of this UX is currently defined.

### 3. Architectural Impact

The resolution defines a **Rejection Response Envelope** — a standard response structure for all write rejections, regardless of rejection type. The frontend processes this envelope uniformly. The backend emits it for all four rejection types.

Additionally, the resolution defines a **Forced State Push** mechanism: when certain rejection types occur, the server proactively pushes the authoritative state to the rejecting session. This is not a new WebSocket event type — it reuses the existing state push mechanism, triggered by the rejection event rather than by the periodic heartbeat.

### 4. Operational Impact

Without resolution: write rejections may be silent (no visible error), or the error message may not give the operator enough information to understand why their action failed. Stale sessions may persist in incorrect state after rejection. Operators may retry the same rejected action.

With resolution: every write rejection produces a visible, specific, actionable response. The operator knows: (1) what was rejected, (2) why, (3) what the current authoritative state is, (4) what they should do next. Sessions are refreshed to authoritative state after applicable rejections.

### 5. Human Factors Impact

The rejection response must be:
- **Specific enough** to distinguish the four rejection types (operator confusion requires precise language)
- **Brief enough** to read under stress (no multi-paragraph explanations)
- **Non-blocking** — most rejections should not use modals; toasts are preferred unless the rejection requires operator acknowledgment before proceeding
- **Dismissible** — operators must not be trapped in a rejection state

The forced state push must NOT reset scroll position, collapse Zone C, or otherwise disrupt the operator's workspace. It must update only the specific affected entities.

### 6. Candidate Resolutions Considered

**Option A:** Toast notification for all rejection types.
- **Selected** as the primary mechanism for rejections that do not leave the UI in an inconsistent state. Toasts are non-blocking, have appropriate persistence (5–8 seconds), and are already used in operator workflows.

**Option B:** Inline error within the affected control.
- **Selected** as a secondary mechanism when the rejected control is still visible in the UI (e.g., a form that was submitted). The inline error appears adjacent to the control.

**Option C:** Modal for rejections that require operator acknowledgment.
- **Selected only for** "Operator action rejected due to constitutional constraint" — these require the operator to explicitly acknowledge that a governance boundary blocked their action, for audit integrity.

**Option D:** Silent rejection (no visible response).
- Rejected categorically. Silent mutations (including silent rejections) are a CLASS-CRITICAL failure mode defined in the simulation suite.

### 7. Rejected Resolutions and Rationale

**Page reload on rejection:** Would reset all session state, disrupt in-progress work, and destroy un-submitted form data. Rejected.

**Full session refresh (complete state re-fetch):** Would cause scroll position reset and loss of in-progress work. Rejected. The forced state push must be surgical — only affected entities are updated.

**"Undo" action offered after rejection:** Undo implies the action succeeded. Rejected actions did not succeed; there is nothing to undo.

### 8. Final Authoritative Resolution

#### 8.1 Rejection Response Envelope

All write rejection API responses carry a standard envelope in addition to the HTTP error code:

```json
{
  "rejection": {
    "type": "CONCURRENCY_CONFLICT" | "AUTHORITY_BOUNDARY" | "PRE_CONSTRAINT" | "REPLAY_MODE",
    "message": "Human-readable rejection reason (max 120 characters)",
    "current_state": { ... },
    "retry_permitted": true | false,
    "affected_entity": "venue_id | incident_id | override_id | etc",
    "audit_event_id": "..."
  }
}
```

HTTP status codes by type:
- `CONCURRENCY_CONFLICT` → 409 Conflict
- `AUTHORITY_BOUNDARY` → 403 Forbidden
- `PRE_CONSTRAINT` → 422 Unprocessable Entity
- `REPLAY_MODE` → 403 Forbidden (with `type: REPLAY_MODE` in body to distinguish from authority boundary)

#### 8.2 Rejection Type 1: Concurrency Conflict

**Cause:** Operator's write arrived after another write already committed for the same entity (e.g., SIM-CON-01: two simultaneous override placements; SIM-CON-02: two simultaneous commander claims).

**Visual response:**
- Toast notification (severity: WARNING, amber border)
- Toast title: "Action not applied — conflict detected"
- Toast body: "[Specific message from rejection.message field]"
- Toast persistence: 8 seconds (longer than standard 5s — operator needs time to read the context)
- Toast action button: "[See current state →]" — scrolls to the affected entity in the current surface

**State refresh behavior:**
- Server triggers a targeted state push for `affected_entity` to the rejecting session
- The push updates only the affected entity (e.g., the override list in Tab 3, or the commander identity in the Incident Identity Bar)
- Push must arrive within 2 seconds of the rejection response
- Session scroll position is NOT reset
- Zone C is NOT collapsed

**Operator notification behavior:**
- Toast as described above
- The `[See current state →]` button in the toast navigates the operator to the relevant tab/section where the conflict is visible
- No modal — conflict does not require explicit acknowledgment (the state push shows the operator what won)

**Audit requirement:**
- Both the successful write AND the rejected write are logged
- Rejected write audit entry includes: `operator_id`, `attempted_action`, `rejection_type: CONCURRENCY_CONFLICT`, `winning_write_id`, `timestamp`

#### 8.3 Rejection Type 2: Authority Boundary Rejection

**Cause:** A write was rejected because it violates a constitutional constraint, governance rule, or capacity limit (e.g., attempting to place a second L6 override when one already exists at maximum; attempting to approve a canary promotion when constitutional risk is active).

**Visual response:**
- Modal (not toast) — authority boundary rejections require explicit operator acknowledgment
- Modal title: "Action blocked — governance constraint"
- Modal body: "[rejection.message] — [link to relevant governance rule documentation if available]"
- Modal has ONE button: "[Understood]" — acknowledges the block
- Modal does NOT have a "retry" option — the action cannot succeed until the constraint is resolved

**State refresh behavior:**
- Server triggers a targeted state push for `affected_entity`
- The push confirms the current authoritative state (e.g., existing overrides, current constitutional state)
- Session state is refreshed to show WHY the constraint applies (e.g., if the constraint is that a L6 already exists, the existing L6 entry is highlighted in Tab 3 via a brief background pulse — `300ms #FBC02D` pulse on the affected row)

**Operator notification behavior:**
- Modal as described (blocking until acknowledged)
- After acknowledgment: toast confirmation "Constraint acknowledged — see [affected section] for current state"
- No second notification after the toast

**Audit requirement:**
- `AUTHORITY_BOUNDARY_REJECTION` event: `operator_id`, `attempted_action`, `blocking_constraint_id`, `timestamp`
- This event is part of the governance audit trail (not just application logging)

#### 8.4 Rejection Type 3: PRE Constraint Rejection

**Cause:** An override or content mutation was rejected because PRE resolution rules prevent it at the requested level (e.g., attempting to place an L3 override when an L6 is already active; attempting to modify corpus content that PRE has frozen due to emergency level resolution).

**Visual response:**
- Toast notification (severity: WARNING, amber border)
- Toast title: "Content action blocked — PRE constraint"
- Toast body: "[rejection.message]" — must be specific about which PRE level and why (e.g., "L6 EMERGENCY override active — lower-level overrides cannot be placed while L6 is in effect")
- Toast persistence: 8 seconds
- Toast action button: "[View PRE state →]" — navigates to the PRE resolution panel (Zone B Section 3 / Content & PRE)

**State refresh behavior:**
- Server sends a targeted push for the PRE resolution state — the operator's Zone B Section 3 (Content & PRE) is updated to show the current PRE level hierarchy
- This push ensures the operator understands which PRE level is blocking them and from where it originates
- No scroll reset

**Operator notification behavior:**
- Toast as described
- The "[View PRE state →]" button is the primary recovery path — the operator can see why PRE blocked them and what they would need to resolve first

**Audit requirement:**
- `PRE_CONSTRAINT_REJECTION` event: `operator_id`, `attempted_override_level`, `blocking_pre_level`, `blocking_pre_source`, `timestamp`

#### 8.5 Rejection Type 4: Replay Mode Rejection

**Cause:** A write API call was received from a session that is in REPLAY mode. This is an IC-03 violation — write controls should be absent from the DOM in REPLAY mode. If this rejection fires, either (a) the operator used a keyboard shortcut or other DOM bypass, or (b) there is an IC-03 enforcement bug in the frontend.

**Visual response:**
- Toast notification (severity: ERROR, red border — this is a higher severity than standard rejection because it indicates either operator bypass or a frontend bug)
- Toast title: "Write blocked — read-only session"
- Toast body: "This session is in REPLAY mode. No changes can be made to live system state from a replay session."
- Toast persistence: 10 seconds (extended — the operator needs to understand this is a mode issue, not a data issue)
- No action button

**State refresh behavior:**
- No targeted state push required (replay mode has no "stale state" — the state is the replay corpus)
- However: the frontend must re-evaluate its REPLAY mode enforcement and confirm that all live write controls are absent from DOM
- If any live write controls were present (that allowed the bypassed write attempt), the frontend must log a `IC03_ENFORCEMENT_GAP` client-side error event

**Operator notification behavior:**
- Toast as described
- If this rejection fires more than once in a session, the second occurrence triggers a modal: "Repeated write attempt in REPLAY mode. If you need to make changes to live state, navigate to the Live Operations surface." — with one button: "[Open Live Operations →]"

**Audit requirement:**
- `REPLAY_MODE_WRITE_REJECTION` event: `operator_id`, `attempted_action`, `session_id`, `session_mode: REPLAY`, `timestamp`
- If `IC03_ENFORCEMENT_GAP` is also logged: `IC03_ENFORCEMENT_GAP` is a separate event flagged for engineering review (not just operations audit)

#### 8.6 Forced State Push — Authoritative Rules

A forced state push (server-initiated, triggered by rejection event) is required for rejection types 1 (CONCURRENCY_CONFLICT) and 2 (AUTHORITY_BOUNDARY). It is optional (but recommended) for type 3 (PRE_CONSTRAINT). It is not applicable for type 4 (REPLAY_MODE).

**Forced state push constraints:**
- Must arrive within 2 seconds of the rejection response
- Must update only the `affected_entity` and its direct dependencies — no full session refresh
- Must not reset scroll position in any zone
- Must not collapse Zone C
- Must not re-render Zone A (unless the affected entity is a venue state that changes Zone A display — e.g., RECOVERED_BUT_UNTRUSTED venue state correcting a stale LIVE display in Zone A)
- Must use the existing WebSocket push channel — no new channel required
- The push payload must include `triggered_by: REJECTION` so the frontend can apply rejection-specific rendering (e.g., the brief highlight pulse on the affected entity)

**Forced state push — Entity highlight:**
When a forced state push arrives after a rejection, the updated entity in the UI receives a brief highlight animation to draw attention to what changed:
- `300ms` background pulse: from entity's normal background color to `#FBC02D` (amber-400) and back
- This is the same animation used in Zone B when real-time state updates arrive
- Fires once on the push arrival; does not repeat

**Forced state push — Failure handling:**
If the forced state push is not received within 5 seconds of the rejection:
- Frontend shows a secondary toast: "Session state may be stale — [Refresh →]" with a manual refresh link
- The manual refresh reloads only the affected entity data (targeted fetch), not the full page

#### 8.7 Universal Rejection Rules

Regardless of rejection type, the following rules apply unconditionally:

1. **No silent rejections.** Every write rejection produces a visible operator response within 1 second of the rejection response arriving at the frontend.

2. **Rejection does not block further operator action.** The operator can immediately attempt a different action after any rejection. Modals (type 2 authority boundary) must be dismissible within 3 seconds maximum.

3. **Rejection is not retried automatically.** The frontend does not retry rejected writes without explicit operator action.

4. **Every rejection is audited.** The audit event is written server-side at the time of rejection — the audit does not depend on the operator seeing or acknowledging the rejection.

5. **Rejection messages are specific.** Generic messages like "An error occurred" are prohibited. Every rejection message must identify: what was rejected, why, and (where applicable) who or what is holding the conflicting state.

### 9. Required Document Updates

- **CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md:** Add Section: "Write Rejection Behavior" — types 1–4, visual responses, state refresh rules
- **CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md:** Add Section: "Write Rejection Behavior" — applicable types (1, 2, 3)
- **CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md:** Add Section: "Write Rejection Behavior" — applicable types (1, 2, 3)
- **CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md:** Add Section: "Write Rejection Behavior" — applicable types (1, 2)
- **CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md:** Add Section: "Write Rejection Behavior" — type 4 only; reiterate IC-03 enforcement requirement
- **All wireframe documents:** Update interaction notes sections to reference the rejection envelope for any wireframe that includes write actions
- **WIREFRAME-CROSS-REFERENCE-MATRIX-v1.md:** Resolve A-NEW-04

### 10. Validation Criteria

SIM-CON-01 passes when:
- Rejection toast appears within 1 second of 409 response arriving at frontend
- Toast is not silent — it is visible and readable for 8 seconds
- Forced state push arrives within 2 seconds and updates Tab 3 to show the winning override
- Highlight pulse fires on the winning override entry
- Both write attempts are in the audit log with outcomes

SIM-CON-02 passes when:
- Authority boundary modal appears for the losing claim attempt
- Modal is dismissible; disappears after "[Understood]" click
- Incident Identity Bar updates for all sessions within 5 seconds via state push
- `AUTHORITY_BOUNDARY_REJECTION` audit event written

SIM-CON-05 passes when:
- 409 response for severity escalation conflict triggers toast with current severity in message
- Forced state push refreshes severity display for the rejecting session within 2 seconds

SIM-CON-08 passes when:
- Override write for RECOVERED_BUT_UNTRUSTED venue returns 403 with `AUTHORITY_BOUNDARY` type
- Modal appears; operator must acknowledge before continuing
- Forced state push updates Zone B Section 1 to LIVE — UNVERIFIED state within 2 seconds of rejection
- Override controls become absent (not disabled) within 2 seconds of state push

---

## Summary: Resolution Status and Unblock Status

| Ambiguity | Resolution status | Blocked scenarios unblocked |
|-----------|------------------|----------------------------|
| A-NEW-01 | RESOLVED — Zone C advisory level field + visual state rules | SIM-FAT-07 |
| A-NEW-02 | RESOLVED — delivery_priority field + three banner tiers + Tab 5 color rules | SIM-FAT-08 |
| A-NEW-03 | RESOLVED — per-collaborator timeline position in session header + scrubber pips + contradiction detection + Tab 3 rendering | SIM-RPL-08, SIM-CON-06 |
| A-NEW-04 | RESOLVED — four rejection type envelope + forced state push rules + universal rejection rules | SIM-CON-01, SIM-CON-02, SIM-CON-05, SIM-CON-08 |

**All four ambiguities are resolved. No simulation scenario remains blocked by undefined behavior.**

The system is eligible for re-evaluation against CERTIFIED_SAFE criteria upon implementation of:
1. `advisory_level` field and Zone C visual state rules (A-NEW-01)
2. `delivery_priority` field and CMS banner tiers (A-NEW-02)
3. Collaborator timeline position push + contradiction detection (A-NEW-03)
4. Rejection response envelope + forced state push (A-NEW-04)
5. All 5 specification document updates listed across the four resolutions

---

## Residual Risk Update

Following these resolutions, the Residual Risk Register from the simulation suite is updated:

| Risk ID | Previous status | Updated status |
|---------|----------------|----------------|
| RR-002 | CRITICAL / UNMITIGATED | RESOLVED — A-NEW-01 defines Zone C visual escalation signal |
| RR-005 | HIGH / PARTIAL | RESOLVED — A-NEW-02 defines delivery priority differentiation |
| RR-004 | HIGH / UNMITIGATED | RESOLVED — A-NEW-03 defines collaborator timeline positions |
| RR-010 | HIGH / UNMITIGATED | RESOLVED — A-NEW-04 defines forced state push on rejection |

Remaining unresolved residual risks (from the original register): RR-001, RR-003, RR-006, RR-007, RR-008, RR-009.

These six items are implementation recommendations, not blocking specification gaps. They do not prevent CERTIFIED_SAFE status but should be addressed in the implementation phase.
