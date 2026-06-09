# Replay and Forensics Workspace Specification v1

**Document type:** Operational Surface Specification
**Applies to:** Zone B — Replay and Forensics Workspace
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md
**Status:** Constitutional — all implementations must conform
**Last updated:** 2026-06-01

---

## Overview

The Replay and Forensics Workspace replaces Zone B when an operator enters replay mode. Zone A and Zone C remain visible. Zone C switches to replay-specific panels for the duration of the session.

The System Status Bar displays the amber REPLAY banner for the entire duration of the replay session. This banner is the persistent, non-dismissible signal that the operator is not in LIVE mode.

Replay mode is stateless with respect to the platform. The only write operation permitted during replay is adding text annotations to the audit trail.

### Entry Points

Replay mode is entered from any of the following:
- Clicking the Audit Trace Footer (opens replay at the most recent PRE resolution event, scoped to current venue)
- [Initiate Replay Investigation] from the Incident Commander Surface (pre-scoped to the incident's venue and timeframe)
- [View Full Audit Trail] link from Zone C Pane C3 or from the Incident Commander Surface (opens at most recent event for the venue)
- Direct navigation to Replay & Forensics in Zone A Pane A3 (opens scope selector before loading)

### Replay Session Scope

Every replay session has a defined scope established at entry:
- **Venue-scoped:** All events for a specific venue, within a specified time range.
- **Incident-scoped:** All events associated with a specific incident ID and its affected venues.
- **Corpus-packet-scoped:** All events associated with a specific corpus packet ID.
- **Time-range-scoped:** All events within a specified governed time range, across all venues accessible to the operator.

Scope is established at session start and cannot be changed mid-session. Changing scope requires exiting and re-entering replay.

---

## Zone B Layout in Replay Mode

Four sub-zones in fixed arrangement:

```
┌──────────────────────────────────────────────────────────────┐
│  RP-TOP  (Replay Session Header, full width, 64px)           │
├──────────────────────────────────────────────────────────────┤
│  RP-TIMELINE  (Timeline Ruler, full width, 96px)             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  RP-MAIN  (Primary Evidence Surface, fluid, ~60% height)     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  RP-DETAIL  (Detail Panel, full width, ~30% height)          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## RP-TOP: Replay Session Header

**Position:** Full width. 64px height. Always visible within the Replay and Forensics Workspace.

### Contents

- **Replay session ID:** Stable identifier for this replay session. Monospace font. Present for the full session duration.
- **Scope description:** Human-readable scope label, e.g.:
  - "Venue: The Anchor Manchester | Time range: 2026-06-01T12:00:00Z – 14:30:00Z"
  - "Incident: INC-20260601-001 | Venue: The Crown Liverpool"
  - "Corpus packet: GOLD-001"
- **Replay origin:** Governed timestamp at which this replay session is rooted (the earliest event in scope).
- **Current position:** Governed timestamp of the event currently displayed. Updates as the operator navigates.
- **Event navigation controls:**
  - [⏮ First] — jump to first event in scope
  - [← Previous Event] — step backward one event
  - [→ Next Event] — step forward one event
  - [⏭ Last] — jump to most recent event in scope
  - Keyboard equivalents: Home / Left Arrow / Right Arrow / End
- **Speed control:** Default is event-by-event navigation (discrete steps). Operator can switch to timestamp scrubbing via a toggle, enabling input of a specific governed timestamp to jump directly to the nearest event.
- **[Exit Replay] button:** Always visible at the right of RP-TOP. Always accessible. Clicking exits replay and returns the operator to LIVE mode for the workspace they were in before entering replay.
- **Divergence status:** If divergence is detected during the replay session, this shows "DIVERGENCE DETECTED at [governed timestamp]" in amber, to the left of the [Exit Replay] button. If no divergence, this area is empty.

---

## RP-TIMELINE: Timeline Ruler

**Position:** Full width. 96px height. Below RP-TOP.

### Structure

A horizontal time axis spanning the replay session scope. Left edge = earliest event in scope. Right edge = most recent event in scope. The currently displayed position is marked with a vertical red line.

### Event Markers

Each event in scope is marked as a vertical tick on the timeline. Tick color corresponds to event type:

| Event Type | Color |
|---|---|
| PRE_RESOLUTION | Blue |
| OPERATOR_ACTION | Orange |
| STATE_TRANSITION | Purple |
| SYSTEM_EVENT | Grey |
| CORPUS_WRITE | Green |
| DIVERGENCE | Red |

### Interaction

**Hover:** Hovering a tick mark displays a tooltip with event type, actor, and a one-line description of the event.

**Click:** Clicking a tick mark navigates directly to that event. RP-MAIN and RP-DETAIL update to reflect the selected event.

**Zoom:** Scroll wheel zooms in or out on the time axis. Minimum zoom shows individual events with spacing between them. Maximum zoom shows the complete available history in the scope within the ruler width. Time range labels are displayed at the left and right ends of the ruler at all zoom levels.

**Incident band:** If the replay session is incident-scoped, or if an incident overlaps the time range, an amber horizontal band is rendered on the timeline ruler spanning the incident's declared_at to resolved_at (or to the current governed time if unresolved).

**Event count:** Below the ruler, a label shows: "N events in selected range." This updates when the operator zooms.

---

## RP-MAIN: Primary Evidence Surface

**Position:** Full width. Approximately 60% of remaining Zone B height (after RP-TOP and RP-TIMELINE).

RP-MAIN displays content in tabs. The tab bar is at the top of RP-MAIN. The operator selects which view to examine.

Default tab on entry: Tab 1 (PRE Resolution Trace).

### Tab 1: PRE Resolution Trace

Shows the complete resolution path for the PRE evaluation that occurred at the current timeline position.

**Contents:**

- Resolution level (0–6) badge.
- Resolution path table — one row per level evaluated, in evaluation order:

| Level | Entity Evaluated | Result | Reason |
|---|---|---|---|
| 6 — emergency | emergency_active | WIN / SKIP | reason string from PRE output |
| 5 — structural | structural content ref | WIN / SKIP | reason string |
| 4 — sponsorship | sponsor block | WIN / SKIP | reason string |
| 3 — campaign | campaign ref | WIN / SKIP | reason string |
| 2 — scheduled override | override entry | WIN / SKIP / SUPPRESSED | reason string |
| 1 — operational | override entry | WIN / SKIP / SUPPRESSED | reason string |
| 0 — schedule | schedule block | WIN / MISS | SCHEDULE_ACTIVE / SCHEDULE_DOW_MISMATCH / SCHEDULE_EXPIRED |
| Fallback | LEVEL_5_STRUCTURAL | ACTIVE / NOT_SET | — |

Result color coding: WIN = green, SKIP = grey, SUPPRESSED = amber, MISS = orange.

- **Input hash:** The hash of the PREInput struct that was evaluated.
- **Output hash:** The hash of the PREOutput struct that was produced.
- **Corpus entry ID:** The corpus entry that this resolution committed to (if committed). Clicking the corpus entry ID navigates to Tab 4 (Corpus Evidence) and selects that entry.
- **Static statement:** "This output is deterministic. Replaying PRE with these inputs at this governed timestamp will produce identical output."

**Divergence detected:** If a divergence was detected at or before the current timeline position, the resolution trace shows a comparison:
- Left column (red header): "ORIGINAL" — the output hash from the original corpus entry.
- Right column (green header): "REPLAY" — the output hash from the replay execution.
- Differing fields are highlighted. Matching fields are shown normally.

### Tab 2: State Machine View

Shows the state of all registered machines at the current timeline position.

**Machine list:** Each machine displays:
- Machine ID (monospace)
- State at this governed timestamp (badge)
- Last transition: from-state → to-state, reason, authority (BACKEND / OPERATOR / RECOVERY / SCHEDULED), governed timestamp of transition

**Selecting a machine:** Clicking a machine row expands or opens a detail panel showing its full transition history from the replay origin timestamp to the current timeline position. Each historical transition is listed with: governed timestamp, from-state, to-state, reason, authority, actor.

**Forbidden transitions:** If any forbidden transition occurred between the replay origin and the current timeline position, it is highlighted in red in the machine list with a warning label: "FORBIDDEN TRANSITION."

### Tab 3: Override Stack

Shows the override stack as it existed at the current timeline position.

**Active overrides at this timestamp:** Each entry shows:
- Level badge (1–6)
- Content reference (truncated, full on hover)
- Placed by (operator_id)
- Placed at (governed timestamp)
- Expires at (governed timestamp) or "No expiry"
- Scope (venue-level / fleet-level / screen-level)

**Expired overrides:** Overrides that had already expired before the current timeline position are shown in a greyed visual state, below the active overrides, labeled "EXPIRED BEFORE THIS POINT."

**Future overrides:** Overrides placed after the current timeline position are not shown. The stack reflects exactly what existed at the moment being examined.

### Tab 4: Corpus Evidence

Shows the corpus chain up to the current timeline position.

**Corpus chain table:**

| Entry ID | Governed Timestamp | Input Hash | Output Hash | Prior Entry Hash | Entry Hash | Chain Status |
|---|---|---|---|---|---|---|
| GOLD-001 | 2026-06-01T10:00:00Z | a3f9... | b2d1... | — | c8e4... | VALID |
| GOLD-002 | 2026-06-01T10:15:00Z | d7a2... | e9f3... | c8e4... | f1a7... | VALID |

Chain status values:
- VALID: green — prior_entry_hash matches previous entry's entry_hash.
- BROKEN: red — prior_entry_hash does not match. The entry that breaks the chain is highlighted and labeled "CHAIN BREAK HERE."

**Selecting an entry:** Clicking a corpus entry row loads the full PREInput and PREOutput for that entry into RP-DETAIL.

### Tab 5: Divergence Comparison

This tab is only visible when a divergence has been detected during the replay session (i.e., output_hash from corpus does not match output_hash from replay re-execution).

**Layout:** Side-by-side comparison.

- **Left panel (labeled "ORIGINAL"):** The PRE output from the corpus entry — what the system actually output at the time.
- **Right panel (labeled "REPLAY"):** The PRE output from re-running PRE — what the system would output today with the same inputs.
- **Field-level diff:** Fields that differ are highlighted in red in the ORIGINAL panel and green in the REPLAY panel. Matching fields are shown without highlighting.

**Divergence classification:** Below the diff, the divergence class is shown:
- CLASS_1: Input data difference (expected, not a breach)
- CLASS_2: Non-deterministic timing (investigation required)
- CLASS_3: Logic difference (constitutional concern)
- CLASS_4: Forbidden state (constitutional breach)
- CLASS_5: Chain corruption (critical)

**Severity statement:** If any difference is found, this text is shown in red: "If any difference exists here, this is a constitutional breach requiring immediate escalation."

**Escalation action:** [Escalate to Incident (S3)] button. Clicking creates a new S3 incident pre-populated with: the divergence class, the corpus entry ID, the governed timestamp of divergence, and the input/output hash pair. The operator is returned to the Incident Commander Surface with the new incident open.

### Tab 6: Counterfactual

This tab is visible only to operators with ADMIN role.

**Purpose:** Construct a hypothetical input to PRE and preview what PRE would resolve to. This is a pure simulation. Nothing is written. Nothing is changed. Nothing is queued.

**Persistent banner (always shown at top of Tab 6):** "COUNTERFACTUAL MODE — Output is hypothetical. Nothing is written. Nothing is changed."

**Operator-configurable inputs:**
- Governed timestamp (select a different point in time)
- Override stack (add, remove, or modify overrides in the hypothetical)
- Schedule block (select a different schedule block or none)
- emergency_active flag (toggle on or off)
- structural content ref (select a different structural content reference)

**[Compute Preview] button:** Runs PRE.resolve() with the hypothetical input. Output is displayed using the same resolution trace format as Tab 1.

**Output label:** The result is labeled "HYPOTHETICAL OUTPUT" in amber at the top of the output area. The resolution path shows which step would win given the modified inputs.

There is no save, commit, export, or copy function for counterfactual outputs. The tab is exploration-only.

---

## RP-DETAIL: Detail Panel

**Position:** Full width. Approximately 30% of remaining Zone B height.

RP-DETAIL shows full detail for the event currently selected on RP-TIMELINE, or the corpus entry selected in Tab 4.

### Event Detail Contents

- Event type (text label + color badge)
- Governed timestamp (full value, not truncated)
- Actor: "system" or operator_id
- Authority: BACKEND / OPERATOR / RECOVERY / SCHEDULED
- Full event payload: JSON, syntax-highlighted, read-only, scrollable. The payload is the verbatim event data stored in the audit trail.
- Correlation ID: full value, copyable via click. Clicking copies to clipboard and briefly shows "Copied" confirmation.
- Trace ID: shown if present in event payload.
- Related events: up to 5 events correlated by the same trace_id or corpus_entry_id. Each shown as a link with event type and governed timestamp. Clicking a related event link jumps the timeline to that event.

### Annotation Surface

Always present at the bottom of RP-DETAIL, below the event detail.

**Purpose:** Operator-authored text annotations attached to specific timeline events.

**Annotation input:** A labeled text area ("Add annotation to this event") with a [Save Annotation] button.

**Constraints:**
- Maximum annotation length: 2000 characters. A character counter is shown in the lower-right of the text area.
- Annotations cannot be deleted or edited after saving.
- A superseding note can be added: prefixing the new annotation with "SUPERSEDING NOTE: " visually associates it with a prior annotation on the same event in future replay sessions.

**Persistence:** Annotations are written to the audit trail with: operator_id, governed timestamp of the annotation write, replay session ID, and the governed timestamp of the event being annotated. Annotations are replay-visible — any future replay session that includes this event in its scope will display annotations from prior sessions.

**Display of prior annotations:** If the current event already has annotations from prior replay sessions, they are displayed above the annotation input in the order they were written. Each shows operator_id, annotation timestamp, and text.

---

## Investigation Workflows

### Workflow 1: Incident Forensic Investigation

**Entry point:** [Initiate Replay Investigation] from the Incident Commander Surface.

**Session setup:** Replay session scoped automatically to the incident ID and affected venue. Timeline is pre-positioned at the incident's declared_at governed timestamp. Tab 1 (PRE Resolution Trace) opens by default.

**Procedure:**
1. Operator reviews PRE resolution state at the moment of declaration (Tab 1).
2. Operator navigates backward in time to find the first anomalous event (RP-TIMELINE).
3. Operator examines state machine transitions around the causative event (Tab 2).
4. Operator checks override stack at the time of failure (Tab 3).
5. Operator adds annotations at key events to record observations.
6. If divergence is suspected, operator moves to Tab 4 (Corpus Evidence) to verify chain integrity.

**Goal:** Establish whether PRE output was correct at each step, whether any state machine transition was forbidden, and which event sequence led to the incident declaration.

**Evidence package (ADMIN only):** [Generate Evidence Package] button appears in RP-TOP for ADMIN role. Clicking triggers the PackageBuilder to bundle corpus entries, trace events, and annotations for the incident timeframe. The resulting package has a deterministic hash that can be used for future verification. Package generation does not modify any system state.

### Workflow 2: Divergence Investigation

**Entry point:** Alert from the shadow parity system showing parity ratio below threshold, or via the Divergence tab appearing after replay detection of an output_hash mismatch.

**Procedure:**
1. Operator opens Tab 5 (Divergence Comparison) to identify which fields differ between original and replay output.
2. Operator examines the PREInput for both executions (loaded into RP-DETAIL from Tab 4).
3. Operator classifies divergence: was the input different, or was the PRE logic different?
4. If CLASS_3 or CLASS_4: [Escalate to Incident (S3)] button is displayed prominently. Operator annotates the divergence event with their cause hypothesis before escalating.
5. Evidence package generated.

### Workflow 3: Scheduled Content Verification

**Entry point:** Operator wants to verify that a scheduled content transition resolved correctly at a specific governed timestamp.

**Procedure:**
1. Operator opens Replay & Forensics. Scope is set to the venue and the time range of the schedule transition.
2. RP-TIMELINE shows PRE_RESOLUTION events at each poll cycle as blue tick marks.
3. Operator clicks the tick mark at the scheduled transition time.
4. Tab 1 (PRE Resolution Trace) shows the resolution path. Operator verifies:
   - Level 0 (schedule) shows WIN with reason SCHEDULE_ACTIVE.
   - No higher-level override has WIN result.
   - Effective content reference matches the expected schedule block content.
5. Tab 3 (Override Stack) confirms no unexpected override was active at the transition time.

If verification passes, no escalation is needed. Operator closes replay by clicking [Exit Replay] in RP-TOP or in the System Status Bar.

### Workflow 4: Post-Incident Review

**Entry point:** After an incident is resolved, an operator opens Replay & Forensics to review the complete incident arc for institutional learning.

**Procedure:**
1. Operator scopes the replay to the incident full timeframe (declared_at to resolved_at).
2. Tab 2 (State Machine View) shows the complete transition history across all machines for the incident period.
3. Operator steps through events from declaration to resolution, annotating key decision points.
4. Tab 3 (Override Stack) shows which overrides were in effect at each phase of the incident.
5. ADMIN operators may use Tab 6 (Counterfactual) to explore alternative response scenarios — e.g., "What if an emergency override had been placed 3 minutes earlier?"
6. Evidence package generated for the institutional record.

---

## What Operators Cannot Do in Replay

The following actions are not available during replay sessions. Buttons for these actions are absent from the interface — they are not disabled with a tooltip, they are not present.

- Place or remove overrides
- Declare or resolve incidents
- Change PRE configuration
- Write to corpus
- Modify operator sessions
- Change constitutional state
- Initiate any governed machine state transition
- Change the replay session scope mid-session

The only write operation permitted during replay is adding text annotations to the audit trail.

This constraint is absolute. It does not vary by operator role. ADMIN operators in replay cannot perform state-modifying actions any more than VIEWER operators can.

---

## Zone C in Replay Mode

When the operator is in a replay session, Zone C switches from its standard panels to replay-specific panels.

**Replay Pane C-R1: Replay Packet Information**
- Replay session ID
- Session scope (venue, incident, corpus packet, or time range)
- Replay origin governed timestamp
- Total events in scope

**Replay Pane C-R2: Divergence Status**
- Divergence detected: YES / NO
- If YES: governed timestamp of first detected divergence, divergence class (if classified), link to Tab 5 in RP-MAIN

**Replay Pane C-R3: Annotation Summary**
- Count of annotations added in this replay session
- List of events that have been annotated (event type, governed timestamp, link to jump to that position)

Standard Zone C panes (C1 through C4) are not available during replay. Zone C returns to standard panes when replay exits.

---

## Degraded-Network Behavior

If the operator loses network connectivity during a replay session:

An amber banner appears in RP-TOP: "Connection lost — replay session data frozen at [governed timestamp]." The [Exit Replay] button remains accessible.

Events already loaded into the replay session remain visible and navigable. Operators can continue examining loaded events, navigating between them, and reading their details in RP-DETAIL.

Events that were not yet loaded (typically events near the edges of the time range that had not been fetched) are represented as blank tick marks with tooltip "Event not loaded — reconnect to view."

Annotation input remains available. Annotations written while offline are buffered locally.

On reconnection: the replay session resumes from the last loaded position. New events in scope load and appear on RP-TIMELINE. Buffered annotations are flushed to the audit trail.

**Session timeout:** Replay sessions expire after 4 hours of inactivity (no navigation events and no annotation saves). A warning appears at 3 hours 45 minutes: "This replay session will expire in 15 minutes due to inactivity. Navigate to any event to reset the timer." On timeout, the session closes and the operator is returned to LIVE mode.

---

## Accessibility Considerations

**Timeline keyboard navigation:** Left Arrow and Right Arrow step between events. Home jumps to first event. End jumps to most recent event. These keyboard shortcuts function when focus is in the RP-TIMELINE or RP-MAIN area.

**Timeline event markers:** Each tick mark on RP-TIMELINE has an ARIA label containing event type and governed timestamp (e.g., "PRE_RESOLUTION event at 2026-06-01T14:23:07Z"). Screen readers can navigate between markers.

**Diff view (Tab 5):** Field differences are conveyed by both color and text symbol:
- Added or new value: preceded by "+"
- Removed or old value: preceded by "-"
- Changed: old value preceded by "~", new value preceded by ">"

Color is never the sole indicator of difference in the divergence comparison view.

**Annotation text area:** Labeled with ARIA label "Add annotation to this event." Character counter is an ARIA live region updating as the operator types.

**"You are in replay" reminder:** Accessible via ARIA landmark — the System Status Bar REPLAY banner has role="banner" and is the first landmark in tab order. Screen reader users encounter the REPLAY banner before any other interactive content.

---

## Cognitive Load Considerations

**Default entry state:** On entering replay, Tab 1 (PRE Resolution Trace) is shown at the most recent event in scope. The operator immediately sees what PRE resolved to at the most recent point. This is the most common starting question ("what was PRE doing?") and is answered without any navigation.

**Event navigation:** Navigation buttons ([← Previous], [→ Next]) are large and positioned for both mouse and keyboard use. They are the primary navigation affordance — the timeline ruler is supplementary.

**Persistent orientation:** "You are in replay" is communicated through three simultaneous channels: System Status Bar amber background, "REPLAY MODE — NOT LIVE" text, and the amber banner in RP-TOP showing the session scope. Operators cannot mistake replay state for LIVE state.

**Event count visibility:** RP-TIMELINE shows event count at all times. Operators know how many events are in scope and can calibrate their investigation accordingly.

**Counterfactual access restriction:** Tab 6 is only visible to ADMIN role operators. For all other roles, the tab does not exist. This prevents cognitive overhead from an advanced feature that standard operators do not need.

**Scope immutability:** Scope cannot be changed mid-session. This eliminates decisions about scope mid-investigation. To investigate a different scope, the operator exits replay and re-enters. This is a deliberate constraint — mid-session scope changes create ambiguity about which events belong to which investigation.
