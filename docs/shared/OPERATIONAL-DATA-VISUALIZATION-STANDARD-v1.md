# OPERATIONAL-DATA-VISUALIZATION-STANDARD-v1

**Document type:** Canonical visualization governance
**Authority:** Agent 3 (UX/Design)
**Audience:** Frontend engineers, UX contributors, QA, product owners proposing new surfaces
**Depends on:** OPERATIONAL-VISUAL-SEMANTICS-v1.md, TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md, INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md, CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Visualization Governance Principles

### 1.1 Why Visualization Choices Have Safety Implications

ClubHub TV is an operational system, not a reporting system. The operators who use its surfaces are making real-time decisions about venue operations, sponsor obligations, and incident response. A visualization that implies a condition is healthy when it is not will delay intervention. A visualization that implies certainty when the underlying data is uncertain will produce misplaced confidence. A visualization that obscures which data is historical versus current will cause operators to issue commands against stale state.

Visualization choices are therefore not aesthetic preferences. They are operational decisions with consequences.

**The governing test for every visualization:** Does this representation make it faster and more accurate for an operator to answer "What is actually happening right now, and what — if anything — requires my action?" If a proposed visualization makes that question harder to answer, even slightly, it fails.

### 1.2 The "Never Imply More Certainty Than Exists" Rule

Every visualization must represent the confidence level of its underlying data, not the confidence level the operator would prefer to see.

**What this means in practice:**

- A venue health indicator backed by data that is 8 minutes old must visually signal its age. It must not render as if it were current.
- A trust level of UNKNOWN must not use a neutral visual treatment. UNKNOWN is not "probably fine." It means the system has no verified signal. It must be rendered pessimistically.
- A PRE resolution with low confidence must expose that low confidence in the display — not present the resolution as though it were authoritative.
- A delivery status derived from the last confirmed delivery, when device connectivity is currently unknown, must show that the status is based on the last known state, not the current state.

Implication of certainty that does not exist is a false signal. False signals cause worse decisions than missing data, because they produce active confidence in an incorrect state.

### 1.3 Freshness Visibility Requirement

Every data point displayed in any operational surface must expose its age. This is not optional and applies universally — there is no data point whose freshness is "obviously current" and therefore exempt.

**Freshness exposure forms:**
- A recency label adjacent to the value: "Resolved 12s ago," "Last confirmed 4m ago," "Computed 2026-06-01 14:32:07 AEST"
- A staleness indicator when the data exceeds its freshness threshold (per OPERATIONAL-VISUAL-SEMANTICS-v1.md §5.2)
- In tables, a timestamp column or last-updated header label

**Freshness thresholds by data type:**

| Data type | Freshness threshold | Stale treatment |
|---|---|---|
| PRE resolution output | 60 seconds | `color.mode.stale` on authority indicator |
| Device connectivity status | 90 seconds | `color.mode.stale` + "Last seen" label |
| Delivery confirmation | 5 minutes | `color.mode.stale` on delivery status |
| Trust level assessment | 10 minutes | UNKNOWN treatment if threshold exceeded |
| Entropy grade | 30 minutes | Amber staleness marker |
| Override stack state | 2 minutes | `color.mode.stale` on override count |
| Incident state | Real-time (no threshold) | Always subscribe live |

**Law:** A visualization that does not expose data age is prohibited from operational surfaces. It may exist in reporting or archival contexts only.

### 1.4 UNKNOWN Rendering Rule

UNKNOWN is a distinct, pessimistic state — not the absence of information, but the presence of a signal that information is unavailable.

**UNKNOWN must be rendered as:**
- A muted, non-green visual treatment (typically grey with reduced opacity — never neutral or positive-colored)
- An explicit text label: "Signal unavailable," "Trust state unknown," or equivalent — never a blank or dash
- An absence of positive inference: the operator must not be able to read UNKNOWN as "probably OK"

**Specifically prohibited for UNKNOWN:**
- Green, blue-green, or any color from the nominal/advisory range of the severity spectrum
- An empty cell or a dash character that could be read as "no data yet, check back"
- A spinner or loading indicator that implies data is "on its way" when UNKNOWN is a persistent state

This rule applies regardless of how long UNKNOWN has been present. An UNKNOWN that has persisted for 72 hours is not more likely to be fine than one that appeared 30 seconds ago.

### 1.5 Replay Mode Visualization Constraint

When any visualization is rendered in REPLAY mode (viewing historical corpus data), the following constraints apply universally:

- Trust levels are frozen at the historical value. If the data was DEGRADED_TRUST at the investigated moment, it must display as DEGRADED_TRUST — even if that device's trust has since been restored to TRUSTED.
- Retroactive trust improvement is forbidden. A device that was UNTRUSTED at 16:23 cannot display as TRUSTED in a replay of that moment.
- Freshness indicators are replaced with historical timestamps. The "age" displayed is the canonical governed_timestamp, not elapsed time from now.
- No live-update subscriptions. A replay visualization does not poll for updates. The data is fixed at corpus time.
- The REPLAY mode border (per OPERATIONAL-VISUAL-SEMANTICS-v1.md §4.1) applies to the entire visualization context, not only to specific panels.

---

## 2. Tables

### 2.1 Standard Operational Table

**When to use:**
Use a Standard Operational Table when the operator needs to review a finite, manageable set of entities to make a decision — override stack review, screen assignment list, operator session log, venue roster, alert queue. The distinguishing characteristic is that the set is bounded and the operator may need to act on individual rows.

**Required columns (in order):**
1. **Entity ID** — system-generated, copyable on click, truncated with tooltip for full value
2. **Governed timestamp** — the canonical timestamp of the record's creation or last state transition; absolute format required (YYYY-MM-DD HH:MM:SS TZ); relative time ("3 days ago") is a secondary label only and must not replace the absolute timestamp
3. **Status** — system-computed; operator-writable status fields are prohibited on this surface
4. **Actions** — rightmost column; shows available actions for this row based on current operator role; empty cell if no actions available (not hidden)

Additional columns are permitted between Governed timestamp and Status when required by the specific table's purpose. Column addition must not cause the required columns to be hidden by overflow without scroll.

**Sort behavior:**
- Default sort: governed_timestamp descending (newest first), unless the table's primary use case is approval priority (age ascending) or severity (severity descending)
- User-override sort: single-click to sort by column ascending; second click descending; third click resets to default
- Sort state is preserved for the session but not persisted across sessions
- Sort indicator: an upward or downward arrow adjacent to the column header; only one sort active at a time

**Pagination vs infinite scroll vs virtualization:**
- **Pagination:** Use when the total record count is bounded and known (e.g., override stack for one venue — maximum a few dozen). Page sizes: 25, 50, 100. Preferred for approval queues where batch selection spans a visible set.
- **Infinite scroll:** Use when the operator is skimming a feed without a specific target row and the total count is very large (e.g., audit log spanning months). Must include a position indicator ("Showing records 1–50 of 3,241") and a "jump to date" control.
- **Virtualization:** Use for tables that may contain thousands of rows but where the operator expects to search or filter to a small subset (e.g., corpus event table in replay). Requires a visible row count and filter controls.
- **Prohibited:** Pagination on append-only log tables. Append-only logs use infinite scroll.

**Row states:**
- **Normal:** Standard text weight, full opacity
- **Selected:** Highlighted background using the surface's selection token (not a severity color); selection is preserved across sort changes
- **SUPERSEDED:** Text at 50% opacity; a grey "SUPERSEDED" label in the status column; the row remains visible and selectable for audit purposes — it cannot be removed from the table view; hovering shows superseded_at timestamp and superseded_by entity
- **Highlighted (new arrival):** A single 400ms background pulse animation on row entry when new rows arrive in a live table. Pulse is single-occurrence only — it does not repeat or loop. After the pulse completes, the row adopts normal state. New arrival animation is prohibited during REPLAY mode.
- **Stale source:** When the entire table's data source has exceeded its freshness threshold, apply a stale banner above the table header (not individual row treatment). Individual row treatment is reserved for rows with individually stale data.

**Empty state:**
Every table must have a designed empty state — not a blank region. Empty state content:
- An icon (non-severity, informational)
- A label: "[Entity type] — None found" or "[Entity type] — No results match the current filter"
- If filters are active that are responsible for the empty set, a "Clear filters" action button

**Loading state:**
- Skeleton rows: 3–5 rows of shimmer placeholders matching the table's column structure
- Duration: if data has not arrived within 5 seconds, replace skeleton with an error state: "Unable to load [entity type]. Last known data shown." and display the most recent cached data at reduced opacity with a staleness indicator
- A persistent spinner is prohibited for tables that have failed to load — it implies data is coming when it may not be

**Stale data treatment:**
When the table's data source is confirmed stale (exceeds freshness threshold), a banner appears above the table header: "Data last refreshed [absolute timestamp]. Values may not reflect current system state." The table remains usable. No row editing or action-taking is permitted while the stale banner is active.

**When PROHIBITED:**
- Standard Operational Table is prohibited for displaying append-only audit logs (use Append-Only Log Table)
- Prohibited for timeline event streams (use Event Timeline or Activity Feed)
- Prohibited for trust level history over time (use Status History Timeline)
- Prohibited when the entity set exceeds 10,000 rows and the use case is temporal investigation (use Virtualized Event Stream or Timeline)

---

### 2.2 Append-Only Log Table

**Definition:** A table in which rows only ever appear — they are never deleted, never edited in place, and never reordered after initial insertion. The table grows only by prepending new rows at the top (newest first). This is the only table type permitted for audit logs, command logs, override logs, and annotation lists.

**When to use:**
Any data that is part of the immutable operational record: audit trail, command execution log, override creation/expiry history, annotation history within a replay session, system event log, delivery confirmation log. The Append-Only constraint is a data integrity guarantee, not only a UI choice — the visualization must enforce the property the underlying data model already provides.

**SUPERSEDED row rendering:**
In an append-only log, supersession means a later record has replaced the authority of an earlier record — not that the earlier record is deleted. SUPERSEDED rows:
- Remain visible in their chronological position
- Render at 50% text opacity
- Display a "SUPERSEDED" label as a badge in the type column
- Display a "superseded_by: [record ID]" link in the status column, which navigates to (or highlights) the superseding record
- Cannot be hidden by default — they may be filtered out by an explicit operator action via a "Hide SUPERSEDED" toggle, which defaults to OFF

**Prohibited on Append-Only Log Tables:**
- No row deletion (in UI or via API action from this surface)
- No row editing in place
- No re-sort to ascending order as default (newest-first is always default, reversible)
- No "clear log" action from any role below ADMIN
- No visual treatment that makes SUPERSEDED rows invisible by default

**Sort:** Newest first (by governed_timestamp) by default. A "Reverse" toggle shows oldest first. Reverse is not the default and must be explicitly activated.

---

### 2.3 Approval Queue Table

**When to use:**
Deployment approval gates, OTA promotion decisions, canary advancement approvals, content schedule approvals requiring explicit operator sign-off.

**Required columns:**
1. Entity ID (with type badge: OTA_ROLLOUT, SCHEDULE_PUBLISH, CANARY_STAGE, etc.)
2. Submitted at (absolute timestamp)
3. Age (calculated from submitted_at to now; displayed as duration string: "2h 14m")
4. Submitted by (operator name)
5. Status (PENDING, APPROVED, REJECTED, EXPIRED)
6. Actions (Approve / Reject / View detail — role-constrained)

**Age column visual treatment:**
- Age 0–4 hours: standard text
- Age 4–12 hours: amber text (approaching attention threshold)
- Age 12–24 hours: orange text with age badge
- Age 24+ hours: `color.status.alert` treatment; a "Stale approval request" label replaces the duration string

**Batch action affordance:**
- Batch approve is permitted when: all selected items are the same entity type, all selected items are in PENDING status, and the operator's role permits batch approval for that entity type.
- Batch approve is prohibited when: the selection spans entity types, any selected item is an OTA rollout in a CONSTITUTIONAL_RISK constitutional state, or the operator is in a degraded session (DEGRADED_TRUST authority).
- Batch selection uses a checkbox column at the far left. The "Select all visible" checkbox is in the column header. It selects only the currently visible page — not all records.

---

## 3. Timelines

### 3.1 Event Timeline

**Definition:** A horizontal time axis with swim lanes or colour-coded event markers, showing a sequence of system events in temporal order. The primary visualization for investigation and causality analysis.

**Use cases:**
- Replay Investigation Surface Tab 1 (primary canonical use)
- Incident history view (incident lifecycle events on a timeline)
- Audit trail visualization for a specific entity (override timeline, campaign timeline)

**Required swim lanes (one row per event category):**

| Lane | Event types | Visual marker |
|---|---|---|
| PRE Resolutions | PRE_RESOLVE, PRE_DIVERGENCE | Blue tick (resolve), red diamond (divergence) |
| Override Events | OVERRIDE_CREATED, OVERRIDE_EXPIRED, OVERRIDE_REMOVED | Orange upward triangle (created), grey downward triangle (expired/removed) |
| Device Health | DEVICE_OFFLINE, DEVICE_ONLINE, DEVICE_UNREACHABLE | Purple square |
| Emergency | EMERGENCY_ACTIVATION, EMERGENCY_CLEARANCE | Red star (activation), green star (clearance) |
| Player State | Player state transitions | Teal circle |
| Annotations | Session annotations (replay context only) | Yellow bookmark |
| Findings | Operational findings (replay context only) | Green flag |

Lanes with no events in the visible time window collapse to a 4px stub. An "Expand all" toggle restores collapsed lanes. A collapsed lane is never completely hidden — the stub confirms the lane exists and is empty, preventing the operator from inferring that the lane type does not exist.

**Playhead component:**
- A vertical red dashed line spanning the full height of the timeline frame
- A timestamp label directly below the playhead line, format: `YYYY-MM-DD HH:MM:SS TZ`
- Draggable: click-and-drag on the playhead line enters SCRUBBING mode; releasing sets the new playhead position
- Keyboard: left/right arrow keys move playhead by one event when timeline is focused
- Playhead movement during REPLAY mode pauses playback automatically

**Time scale:**
- Absolute time is always displayed on the time axis — no relative-time-only axis
- Relative labels ("3h ago") are permitted as secondary labels beneath absolute timestamps but must not replace them
- Minimum time axis resolution: 1 second per visible unit when fully zoomed in
- Maximum time axis span: 90 days per screen width
- Zoom controls: scroll wheel over timeline, plus/minus buttons, "Fit all" button

**Zoom behavior:**
- At maximum zoom out (90-day view): only HIGH and VERY HIGH significance events are shown (per TEMPORAL-COGNITION-AND-TIMELINE-UX-v1.md §4.4). Other events are clustered.
- At 7-day zoom: all event types are visible; clustering applies to events within 30-minute windows
- At 1-day zoom: individual events visible; cluster threshold 5-minute windows
- At 2-hour zoom: all events visible, no clustering
- At full zoom in: individual event markers have 8px minimum separation

**Annotation markers:**
- Shape: yellow bookmark icon, 14px, positioned above the event marker they are anchored to
- Click behavior: pauses playback; opens annotation detail in the detail panel
- SUPERSEDED annotations: grey bookmark with visual strikethrough on the bookmark shape, not on the event marker itself
- Contradicting annotations (two or more anchored to the same event with conflicting content): both markers visible, each with a red exclamation badge overlay

**SUPERSEDED event markers:**
Corpus events are immutable — they are never superseded. An event marker is never rendered as SUPERSEDED. When a record associated with an event (such as an override that was later removed) has a terminal state, the terminal-state transition is a new event in the timeline (OVERRIDE_REMOVED), not a modification of the original OVERRIDE_CREATED marker.

**PRE_DIVERGENCE markers:**
When the PRE detected a divergence (delivered state differed from computed state), a red diamond appears in the PRE Resolutions lane. Clicking opens the divergence detail: computed state, delivered state, parity ratio, divergence timestamp. Adjacent to the red diamond, a parity ratio label shows the computed vs delivered ratio (e.g., "Parity: 0.71").

**When a timeline is PROHIBITED:**
- Any event type without a `governed_timestamp` may not be placed on a timeline. The governed_timestamp is the canonical corpus timestamp — wall clock time of display is not a substitute.
- Timelines are prohibited for data where event ordering is ambiguous or source-dependent.
- Timelines are prohibited in Layer 1 density surfaces (per INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md §2). They are Layer 3 and Layer 5 components.

---

### 3.2 Status History Timeline

**Use case:**
Showing how a machine's state (device health, trust level, constitutional state) has changed over time. Each contiguous period in a given state is a segment.

**Segment rendering:**
- Each segment is a horizontal bar in the state's canonical color (per OPERATIONAL-VISUAL-SEMANTICS-v1.md §2.1)
- Segment width is proportional to duration
- Segment label shows the state name (e.g., TRUSTED, DEGRADED_TRUST, UNTRUSTED) in white or high-contrast text if the segment is wide enough; otherwise a tooltip on hover
- Minimum visible segment width: 4px regardless of duration (a very brief state change is not invisible)

**State transition markers:**
A vertical tick mark at every state boundary. Clicking a tick mark shows the transition event: previous state, new state, transition timestamp, triggering event ID.

**Gap rendering — critical rule:**
A gap in status data (period where no status record exists) is NEVER rendered as a continuation of the last known state and NEVER rendered as nominal/green. Gaps are rendered as an UNKNOWN segment: grey striped bar with a "No data" label. Gap duration is shown on hover. The operator must not be able to look at a gap and infer the device was healthy during that period.

---

### 3.3 Delivery Timeline

**Use case:**
Visualizing CMS content delivery tracking — when content packages were dispatched, confirmed received, and played by devices. The 72-hour window is the constitutional delivery lead-time minimum.

**Layout:** Venue-per-row, time on the horizontal axis. Each row shows the delivery status for one venue across the selected window.

**Threshold markers (vertical lines across all rows):**
- **72h before scheduled air:** Red dashed vertical line — content must be confirmed delivered by this point
- **24h before scheduled air:** Orange dashed vertical line — escalation threshold
- **6h before scheduled air:** Red solid vertical line — emergency threshold; automated alerts fire if content not confirmed delivered

**Row anatomy:**
- Venue name and ID (left label, links to venue record)
- Delivery status segments: DISPATCHED (blue), CONFIRMED_RECEIVED (green), CONFIRMED_PLAYED (teal), DELIVERY_FAILED (red), NO_DELIVERY_RECORD (grey striped — never blank)
- A "Delivered" checkmark on the right edge of the row when the full delivery is confirmed before the 72h threshold

**When a delivery window appears blank:**
No row may display a blank delivery period. If delivery data is absent, the period renders as a grey striped "No delivery record" segment. The system treats absence of confirmation as unconfirmed delivery, not confirmed delivery.

---

## 4. Activity Feeds

### 4.1 Real-Time Event Feed

**Use case:**
Zone C activity feed on operational workspaces; command log panel; live system event stream during normal operations.

**Entry anatomy (each row):**
```
[TYPE BADGE]  [HH:MM:SS TZ]  [SOURCE]  [PAYLOAD PREVIEW — max 80 chars]
```

- **Type badge:** Colour-coded by category (blue=PRE, orange=override, purple=device, red=emergency, grey=routine). Text is 2–4 uppercase characters.
- **Timestamp:** Absolute time in venue-local timezone; HH:MM:SS format for feeds covering a single day; YYYY-MM-DD HH:MM:SS when spanning multiple days
- **Source:** System component or device identifier, truncated with tooltip
- **Payload preview:** Human-readable summary, no raw JSON in the feed view; full payload on row expand

**Maximum visible entries before virtualization:**
50 entries visible in the viewport at one time. Entries above 50 are virtualized (rendered on scroll). A "Jump to latest" button appears when the operator has scrolled up and new entries are arriving below. The total entry count since session start is displayed above the feed.

**New entry animation:**
A single 250ms background pulse on row insertion. This is the only permitted animation. Continuous motion, looping pulses, sliding entrance animations, and fade-in sequences are prohibited. After the 250ms pulse completes, the row is static.

**Class A vs Class B event visual differentiation:**
- **Class A events** (constitutional, state-changing — emergency activation, PRE divergence, trust state change, incident declaration): displayed with a 3px left border in the event's severity color. They are never virtualized out of the visible viewport regardless of scroll position — they remain pinned until the operator explicitly acknowledges or dismisses them.
- **Class B events** (informational, routine — standard override created, delivery confirmation, routine PRE resolution): standard row, no left border. Subject to virtualization normally.

**EMERGENCY_FREEZE treatment:**
When the system is in EMERGENCY_FREEZE constitutional state, the real-time feed continues to display incoming events (EMERGENCY_FREEZE is a read-only operational state, not a system halt). The feed header shows: "EMERGENCY FREEZE ACTIVE — Feed is read-only. No operator commands are being accepted." A persistent amber banner replaces the normal feed header. Events continue to arrive and display normally.

---

### 4.2 Investigation Evidence Feed

**Use case:**
Replay Investigation Surface Tab 2 (Event Stream). A chronological list of all corpus events within the investigation session's time range.

**Corpus event immutability cue:**
Every corpus event row must carry a 3px amber left border and a "CORPUS" label (10px, uppercase, leftmost position of the row). This is unconditional — it appears on every corpus event row without exception. The purpose is to make unmistakable that corpus events are immutable historical records, not live data or annotations.

**Click-to-cite behavior:**
Expanding any corpus event row and clicking "Cite in finding" opens the finding write form with the event's ID pre-populated in the `evidence_citations` field. The operator does not manually type event IDs into findings.

**Filter panel specification:**
Above the event stream:
- Event type filter: multi-select (default: all selected)
- Source filter: text search against the `source` field
- Time range filter: start/end pickers, constrained to session time range
- "Show annotations only" toggle: hides events without attached annotations
- Active filter count badge; "Clear filters" button resets all to defaults

Filters are viewport-local; they do not affect the RP-TIMELINE above. The filter state persists for the session duration.

---

## 5. Hierarchy and Tree Displays

### 5.1 Tenancy Hierarchy Tree

**Use case:**
Displaying the organizational hierarchy: Platform → Network → League → Venue → Device. Used in venue selector, scope selectors for overrides and campaigns, and the platform administration surface.

**Node anatomy:**
- Node type icon (Platform, Network, League, Venue, Device — each has a distinct icon shape, not color alone)
- Node name (full, not truncated in expanded state)
- Health indicator: a 10px dot in the node's current health color (nominal/advisory/warning/alert/critical/terminal)
- Child count badge (e.g., "4 venues") on collapsed nodes
- Expand/collapse chevron at the right edge of the node

**Expand/collapse behavior:**
- Nodes expand to reveal immediate children only (not deep-expand by default)
- "Expand all" is available only for subtrees with fewer than 50 total nodes; above this threshold, expand is single-level
- Collapse on second click; no animation that exceeds 150ms

**Role visibility:**
- OPERATOR and VENUE_MANAGER see only their assigned venue's subtree plus its device children
- ORG_ADMIN sees their organisation's full subtree (Network down to Device)
- ADMIN sees the full Platform tree
- Nodes outside the operator's visible scope are not rendered — they do not appear as greyed or locked nodes. The tree boundary is clean. This prevents information leakage and prevents operators from inferring the shape of tenants outside their authority.

**When PROHIBITED:**
- The Tenancy Hierarchy Tree is prohibited for displaying incident relationships. Incidents are not structured as a tenancy hierarchy — they have their own parent/child lineage display (see §5.2).
- Prohibited for content schedule representation. Schedule relationships are not hierarchical in the tenancy sense.

---

### 5.2 Incident Lineage Tree

**Use case:**
Showing parent/child incident relationships — when one incident triggers or causes another, or when an incident is formally linked to a prior incident as a predecessor.

**Maximum depth:** 5 levels. Deeper nesting is flattened at level 5 with a "Further ancestors — view full lineage" link that opens a dedicated lineage surface.

**Node anatomy:**
- Incident ID (abbreviated, full on hover)
- Severity badge: S1–S5, color-coded per severity spectrum
- Incident state badge: WATCHING / DECLARED / CONTAINED / RESOLVED
- Age: duration since `declared_at` (for DECLARED/CONTAINED) or `resolved_at` (for RESOLVED)
- A "View" link opening the incident detail in the IC surface

**Cycle detection:**
Circular incident references (A is ancestor of B, B is ancestor of A) are a data integrity violation. If a cycle is detected at render time, the cycle node is rendered with a red "CYCLE DETECTED" badge and the chain terminates. A "Report this data error" link appears inline. The visualization never enters an infinite render loop.

---

### 5.3 Override Precedence Display

**Use case:**
Showing which overrides are active for a scope and which is currently authoritative, making SUPERSEDED state visible in the override stack.

**L1–L6 visual hierarchy:**
Overrides are displayed in precedence order: L6 at the top (highest authority), L1 at the bottom. Each level is labeled with its override level name (not just a number). The currently winning override is highlighted with a left border in `color.authority.override`.

**SUPERSEDED override treatment:**
An override that is not currently winning because a higher-authority override exists is marked SUPERSEDED within this stack context. Visual treatment:
- Text at 50% opacity
- A grey "SUPERSEDED" badge in the status column
- A "Superseded by: [override ID]" label linking to the winning override
- The row remains in the display — it is not hidden

**Zero-contribution label:**
Any override that is present in the stack but currently contributing zero time or scope to the effective state (because it is fully superseded or because its scope does not overlap the queried scope) shows a "Contributing: 0" label adjacent to its status. This prevents the operator from assuming an override is having an effect when it is not.

---

## 6. Relationship Views

### 6.1 Incident-Override Relationship View

**Purpose:** Shows which overrides are associated with a given incident — overrides created as part of the incident response, overrides that may have caused the incident, or overrides that were removed during resolution.

**Relationship types rendered:**
- CREATED_DURING: override created while this incident was in DECLARED state
- CREATED_AS_RESPONSE: override explicitly linked to this incident by the creating operator
- IMPLICATED: override was identified during investigation as a contributing cause
- REMOVED_TO_RESOLVE: override was removed as part of incident resolution

**Prohibited inference:**
The display must not imply causal relationship between an override and an incident unless the relationship type is explicitly IMPLICATED or CREATED_AS_RESPONSE. The label "Associated with" is used for CREATED_DURING relationships. "Caused by" or "Required for" language is prohibited unless explicitly set by an ADMIN-level annotation.

---

### 6.2 Content Delivery Relationship View

**Purpose:** Shows the chain from content package → schedule slot → venue assignment → confirmed delivery.

**Layout:** A three-column panel — Content (left), Schedule Slot (center), Venue Assignment (right). Lines connect related entities across columns.

**Delivery status per relationship:**
Each connection line carries a small status badge: SCHEDULED (grey), DISPATCHED (blue), CONFIRMED_RECEIVED (green), CONFIRMED_PLAYED (teal), FAILED (red). A line without a badge indicates no delivery record exists and must render as "No delivery record" — not blank.

---

## 7. Trust Visualizations

### 7.1 Trust Level Indicator

**Four states:** TRUSTED / DEGRADED_TRUST / UNTRUSTED / UNKNOWN

**Color mapping (per OPERATIONAL-VISUAL-SEMANTICS-v1.md §2.1):**

| State | Color token | Rationale |
|---|---|---|
| TRUSTED | `color.status.nominal` | System operating within expected parameters |
| DEGRADED_TRUST | `color.status.warning` | Threshold breached; operator awareness required |
| UNTRUSTED | `color.status.alert` | Action required; do not rely on this source |
| UNKNOWN | Muted grey (custom: `color.trust.unknown`) | Never green, never nominal, never advisory |

**Icon mapping:**
- TRUSTED: a closed shield icon (no fill)
- DEGRADED_TRUST: a shield with an amber exclamation mark
- UNTRUSTED: a shield with a red X
- UNKNOWN: a grey shield with a question mark

**Text label requirement:**
The text label is mandatory alongside the color and icon. Color alone is insufficient for trust communication. The label must appear in all contexts — inline, in tables, in panels, in tooltips. Minimum label set: "Trusted," "Trust degraded," "Untrusted," "Trust unknown."

**Historical trust in REPLAY mode:**
- The trust indicator is frozen at the historical value from the corpus record for the investigated timestamp
- If the corpus record shows UNTRUSTED at 16:23, the indicator shows UNTRUSTED regardless of the device's current live trust state
- No live-trust fetch or live-trust overlay occurs within a replay visualization
- A "Historical trust at [timestamp]" subtext must appear beneath the indicator in any REPLAY context

**Animation rules:**
- TRUSTED state: no animation. A TRUSTED indicator is static.
- DEGRADED_TRUST: a single slow pulse (1 cycle, 800ms) on initial appearance. Static thereafter.
- UNTRUSTED: a persistent amber glow animation at 1 pulse per 3 seconds, indicating an ongoing condition requiring attention. Stops when state returns to TRUSTED.
- UNKNOWN: static. UNKNOWN is not an urgent animation trigger — it may be a persistent long-duration condition. Pulsing UNKNOWN would exhaust operator attention budget.

---

### 7.2 Status Dimension Dashboard (7-Dimension Grid)

**Use case:**
Venue Operations workspace Tab 1. Provides a single-surface view of all 7 orthogonal status dimensions for a selected venue.

**Grid layout:** 7 equal cells in a responsive 2-3-2 or 3-4 arrangement depending on viewport width. Each cell displays one dimension.

**Cell anatomy:**

```
┌──────────────────────────┐
│ HEALTH                   │
│                          │
│    ◉ DEGRADED            │
│                          │
│  Last computed:          │
│  2026-06-01 14:32 AEST   │
└──────────────────────────┘
```

- **Dimension name:** All-caps, 12px, top-left of cell
- **Value:** The current computed value in the dimension's canonical vocabulary (e.g., HEALTHY, DEGRADED, CONSTITUTIONAL_RISK for HEALTH dimension)
- **Icon:** The status icon for the current value (per §7.1 icon conventions where applicable)
- **Last computed time:** Absolute timestamp of the most recent computation

**UNKNOWN cell treatment:**
Any dimension currently UNKNOWN renders its cell with:
- Grey cell background (`color.trust.unknown` at 15% opacity)
- "Signal unavailable" as the value text (never a dash or blank)
- "Last seen: [timestamp]" if a prior value exists; "No data" if the dimension has never resolved
- No color from the severity spectrum

**Stale cell treatment:**
Any dimension whose last-computed time exceeds its freshness threshold renders with a `color.mode.stale` top border on the cell and a staleness marker adjacent to the last-computed time. The value is retained but visually diminished.

---

### 7.3 PRE Level Visualization

**Use case:**
PRE Resolution Indicator component; Incident Commander workspace Tab 4; Venue Operations workspace Tab 5.

**Layout:** A vertical ladder or horizontal bar showing L0 through L6, with the currently active level highlighted.

**Ladder anatomy:**

```
L6 ■ STRUCTURAL         [inactive]
L5 ■ CAMPAIGN           [inactive]
L4 ■ SPONSORSHIP        [inactive — below active]
L3 ■ CAMPAIGN RULE      [ACTIVE]   ◄
L2 ■ SCHEDULED          [inactive — above active]
L1 ■ OPERATIONAL        [inactive]
L0 ■ EMERGENCY          [inactive]
```

- Each level labeled with its canonical name
- Active level: highlighted background in `color.authority.override` with an arrow pointer
- Inactive levels below the active level (lower authority, not winning): reduced opacity
- Inactive levels above the active level (higher authority, would win if present): standard display, indicating they are absent

**Contribution per level display:**
In expanded mode, each level row shows its current contribution text: "Winning: [rule name]" or "No rule active at this level" or "Suppressed by L[N]."

**Divergence indicator:**
Below the ladder, a parity ratio display: "Parity: 0.94 / Threshold: 0.90 — Within tolerance" or "Parity: 0.71 / Threshold: 0.90 — BELOW THRESHOLD" with `color.status.alert` treatment when below threshold.

---

## 8. Comparison Views

### 8.1 Corpus Diff View

**Use case:**
Replay Investigation Surface Tab 5. Side-by-side comparison of expected PRE output vs actual delivered state at a specific corpus timestamp.

**Layout:** Two equal columns. Left: "Expected (PRE computed)" — right: "Actual (delivered/confirmed)."

**Divergence highlighting:**
Any field where expected and actual differ is highlighted with `color.status.warning` background on both sides of the diff — not just the "wrong" side. Both values are shown; neither is hidden. A divergence count badge at the top of the view shows "N fields diverge."

**Per-field structure:**

```
┌──────────────────────────┬──────────────────────────┐
│ EXPECTED                 │ ACTUAL                   │
│ Resolution level: L3     │ Resolution level: L1  ◄▲ │
│ Content: Club_General    │ Content: Override_04  ◄▲ │
│ Trust: TRUSTED           │ Trust: TRUSTED           │
└──────────────────────────┴──────────────────────────┘
                              ▲ = field diverged
```

**Parity ratio indicator:**
Displayed above the diff table: "Parity ratio: 0.71 (8 of 11 fields match)." A progress bar visualization is prohibited here — the parity ratio is a precision measurement, and a bar implies gradation that may mislead at values close to the constitutional threshold (0.90). Show the ratio as a numeric fraction.

**Export affordance:**
An "Export diff" button produces a JSON document of the divergence record for use in external reporting. The export is read-only and contains no controls. Export is available to OPERATOR and above.

---

### 8.2 Content Version Comparison

**Use case:**
CMS content history — comparing two versions of a content record to understand what changed between them.

**Before/after field-level diff:**
Fields that changed are highlighted in amber. Fields that are identical are displayed at reduced opacity (60%) to reduce noise. Deleted fields show the old value with a red strikethrough; new fields show the new value with a green underline.

**Immutability note:**
A persistent banner below the version comparison: "Both versions are read-only. Neither version can be modified from this view. To create a new version, return to the content editor." This is not a tooltip — it is a visible, persistent instruction to prevent operator confusion about the editability of historical records.

---

## 9. Progression Views

### 9.1 Incident State Progression

**Use case:**
Showing the incident lifecycle — WATCHING → DECLARED → CONTAINED → RESOLVED — with timestamps at each completed transition.

**Step indicator:**
A horizontal or vertical stepper component with four steps. Each step is a labeled node connected by a line.

**Current state highlight:**
The active state node uses `color.status.alert` or `color.status.warning` fill (matched to current severity). Completed state nodes use a neutral fill with a checkmark. Future states use `color.mode.stale` treatment (not nominal green — they have not yet occurred).

**Forbidden transition indicators:**
Transitions that the incident governance model prohibits (e.g., RESOLVED → DECLARED without reopening through WATCHING) are shown as blocked edges — a strikethrough on the connecting line with a "Forbidden transition" tooltip. Operators must not be able to infer that skipping steps is an available option.

**Timestamp at each completed transition:**
Each completed step node shows the `transitioned_at` timestamp in absolute format below the step label. In-progress steps show duration since entry: "In DECLARED for 4h 12m." Future steps show no time label.

**Severity peak note:**
Below the stepper: "Historical severity peak: S2. Severity cannot be reduced from this peak in the historical record." This is displayed regardless of current active severity.

---

### 9.2 Recovery Workflow Stepper

**Use case:**
5-step venue recovery workflow (connectivity restoration, content resync, PRE verification, delivery confirmation, operational signoff).

**Current step highlight:** Active step uses a filled circle in `color.authority.override` with step number and name.

**Completed steps:** Checkmark icon replacing the step number; step name at full opacity.

**System-automated vs manual step differentiation:**
- System-automated steps: a gear icon next to the step name, grey text, no action button. The system completes these without operator action.
- Manual steps: an operator figure icon next to the step name, full-weight text, an action button ("Complete this step") that is available only when all preceding steps are complete.

This differentiation is critical: operators must not wait for a system-automated step that they believe requires their action.

---

### 9.3 Canary/Deployment Progression

**Use case:**
OTA delivery stages — displaying canary promotion progress and providing rollback affordance.

**Stage indicator:**
A numbered series of stages (typically 6 for the constitutional canary path). Each stage shows: stage name, completion percentage, start time (if entered), and the stage's pass/fail criteria summary.

**Rollback affordance per stage:**
At each completed stage, a "Rollback to this stage" link is available. Rollback links are disabled (not hidden) once a stage beyond them is committed. A disabled rollback shows "Rollback unavailable — [reason]" on hover. Rollback is never silently absent — its unavailability must always be explained.

**Constitutional halt display:**
When a canary stage has been halted by a constitutional trigger (entropy threshold exceeded, parity ratio breach, error rate spike), the halted stage renders with `color.status.critical` border and a "CONSTITUTIONAL HALT" banner with the triggering condition stated explicitly. Automatic rollback status is shown adjacent.

---

## 10. Legality Matrix

| Visualization | Legal Contexts | Prohibited Contexts |
|---|---|---|
| Standard Operational Table | Override stack review, venue roster, operator session log, screen assignment list, alert queue | Audit logs (use Append-Only), timeline events (use Event Timeline), trust history over time (use Status History) |
| Append-Only Log Table | Audit trail, command execution log, override creation/expiry history, annotation history, delivery confirmation log | Any entity where rows may be deleted, modified, or reordered after insertion |
| Approval Queue Table | OTA promotion gates, schedule publish approvals, canary advancement decisions | Audit/forensic review (use Append-Only), incident escalation decisions (use Incident State Progression) |
| Event Timeline | Replay Investigation Tab 1, incident history, entity-specific audit trail with temporal focus | Layer 1 primary dashboard surfaces, any event type without a governed_timestamp, real-time feeds (use Activity Feed) |
| Status History Timeline | Device trust history, constitutional state history, health grade history over time | Approval workflows, content delivery tracking (use Delivery Timeline) |
| Delivery Timeline | CMS content delivery tracking against 72h window, venue delivery status at a glance | Individual file transfer monitoring, device health history |
| Real-Time Event Feed | Zone C activity feed, command log, live system event stream during operations | Forensic investigation (use Investigation Evidence Feed), historical period review (use Event Timeline) |
| Investigation Evidence Feed | Replay Investigation Tab 2, forensic review of corpus events | Live operations monitoring, any context where events are not from the immutable corpus |
| Tenancy Hierarchy Tree | Venue/device scope selectors, platform administration, role-scoped navigation | Incident relationship display (use Incident Lineage Tree), content schedule visualization |
| Incident Lineage Tree | IC surface parent/child relationship display, postmortem investigation of incident chains | Tenancy or organizational hierarchy (use Tenancy Tree), override precedence (use Override Precedence Display) |
| Override Precedence Display | Override stack inspection, scope conflict resolution, entropy investigation | Schedule rule visualization (use PRE Level Visualization), incident relationship display |
| Corpus Diff View | Replay Investigation Tab 5, divergence analysis at a specific corpus timestamp | Live operational parity monitoring (use PRE Level Visualization divergence indicator) |
| Content Version Comparison | CMS content history, change review before campaign activation | Incident comparison, override comparison |
| Trust Level Indicator | Every surface where trust state is relevant — always with text label | Stand-alone color or icon without text label; in contexts where UNKNOWN may be rendered as neutral |
| 7-Dimension Status Grid | Venue Operations Tab 1, any surface requiring a complete multi-dimensional health snapshot | Executive summary dashboards (use compressed single-dimension indicators); Layer 1 ambient awareness surfaces |
| PRE Level Visualization | PRE Resolution Indicator, IC Tab 4, Venue Ops Tab 5, anywhere PRE resolution level is operationally relevant | Displaying content schedule overview; displaying entity counts by level |
| Incident State Progression | IC surface, incident detail view, postmortem timeline | Device recovery steps (use Recovery Workflow Stepper); OTA stages (use Canary Progression) |
| Recovery Workflow Stepper | Venue recovery workflow, 5-step operational restoration process | Incident lifecycle (use Incident State Progression); content approval (use Approval Queue) |
| Canary Progression | OTA rollout stages, deployment promotion tracking | Incident lifecycle, venue recovery |

---

## 11. Prohibited Visualization Patterns

The following patterns are constitutionally prohibited on all ClubHub TV operational surfaces. Each prohibition addresses a specific failure mode identified in operational context.

**P-VIZ-01: Gauge charts and dial indicators for health**
Health and status in this system are discrete categorical states (HEALTHY, DEGRADED, CONSTITUTIONAL_RISK, etc.), not points on a continuous scale. Gauge/dial visualizations imply analog gradation between states, suggesting that "almost healthy" is meaningfully different from "barely healthy" in a way that is not encoded in the data model. Prohibited on all surfaces.

**P-VIZ-02: Pie and donut charts for incident or override distribution**
Pie and donut charts communicate "parts of a whole." Incidents are not fractions of an incident budget. Overrides are not partitions of an override budget. These charts imply a compositional relationship that does not exist and obscure the absolute counts that operators need. Prohibited on all surfaces. Bar charts or count badges are the correct substitution.

**P-VIZ-03: Heatmaps where UNKNOWN renders as neutral-colored**
Heatmaps use color gradients to encode magnitude. UNKNOWN data in a heatmap will often default to zero or mid-range — both of which may appear as "normal" rather than "missing data." Any heatmap where an UNKNOWN cell could be rendered as a non-pessimistic color is prohibited. If heatmaps are used for aggregate reporting (executive layer only), UNKNOWN cells must render as a visually distinct "no data" treatment — striped, hatched, or an explicit grey that cannot be confused with any data magnitude.

**P-VIZ-04: Sparklines without explicit time axis**
A sparkline without a labeled time axis removes the temporal context that gives the trend meaning. A rising line in a sparkline without axis labels is ambiguous: Is this 10 minutes of data or 10 weeks? What is the Y-axis scale? Prohibited. Sparklines must carry minimum axis labels: start time, end time, and Y-axis range endpoints.

**P-VIZ-05: Relative time only**
Displaying only relative timestamps ("3 hours ago," "2 days ago") is prohibited for any operationally significant event. Relative time alone:
- Becomes ambiguous when a session spans multiple hours
- Is interpreted differently in replay mode (relative to when? the investigation session? the corpus timestamp?)
- Cannot be cited in incident reports or audit documents
Every timestamp must display absolute time (YYYY-MM-DD HH:MM:SS TZ). Relative time is a permitted secondary label but must never replace the absolute timestamp.

**P-VIZ-06: Composite health scores without component breakdown**
A single compressed health score (e.g., "73/100") hides which of the 7 status dimensions is contributing to the degradation. An operator who sees "73" cannot determine whether to investigate trust, freshness, connectivity, or integrity. Composite scores are prohibited unless immediately accompanied (within one tap/click) by the component breakdown. A number without a breakdown is not operational information — it is false simplicity.

**P-VIZ-07: Animated transitions that obscure state changes**
When a status indicator changes from TRUSTED to UNTRUSTED, that state change must be perceptible immediately. An animated transition that fades between states over 500ms creates a period during which the indicator is in an ambiguous visual state. Prohibited: cross-fade animations between severity states. Permitted: a single pulse after the transition completes to draw attention to the change.

**P-VIZ-08: Green for UNKNOWN or DEGRADED states**
Green carries the unambiguous operational meaning of nominal/healthy (per OPERATIONAL-VISUAL-SEMANTICS-v1.md §2.1). Using green for any state other than TRUSTED, HEALTHY, or nominal is prohibited. This includes the common pattern of rendering "not yet checked" or "no data" states in green because it looks clean.

**P-VIZ-09: Trend lines that imply future prediction for non-predictive data**
A line chart on a time axis naturally implies trend continuation to the right. For data that is not formally projected (device health, trust levels, real-time PRE output), extending the visible time axis beyond the last data point — even as empty space — may lead operators to infer that the system is predicting future state. Time axes for historical data must end at the last data point or at "now," with no empty future space.

**P-VIZ-10: In-place editing of any historical record from a visualization**
Visualizations of historical data (any corpus event, any closed incident, any superseded override, any delivery confirmation) must never include in-place editing controls. The read-only constraint on historical records is a data integrity property — the visualization must enforce it by offering no edit affordance whatsoever, not by showing an edit field that errors on submission.

**P-VIZ-11: Hiding SUPERSEDED records from default view**
SUPERSEDED records (overrides, annotations, rules) must be visible by default in any table or list that contains them. An operator must be able to see that a record was superseded, when, and by what. Defaulting to hidden SUPERSEDED records creates a misleading picture of the current state. SUPERSEDED records may be filtered out by an explicit operator action via a toggle that is clearly labeled "Hiding N superseded records," but the default is always visible.

**P-VIZ-12: Duration bars that imply ongoing activity for closed records**
A Gantt-style duration bar for a record that has ended (incident resolved, override expired, campaign closed) must terminate at the record's end time. A bar that extends to the right edge of the chart for a closed record implies the record is still active. Closed records must have a visible right terminus at their canonical end timestamp.

**P-VIZ-13: Status indicators without last-computed timestamp**
Every status indicator in the 7-dimension grid and every trust indicator must display its last-computed timestamp. An indicator without a timestamp cannot be assessed for freshness. An operator cannot know whether to trust the value. Prohibited: any status indicator whose freshness cannot be determined from the visualization.

**P-VIZ-14: Color-only differentiation for critical state distinctions**
LIVE vs REPLAY, TRUSTED vs UNTRUSTED, SUPERSEDED vs active — these distinctions must never rely on color alone. Shape, icon, text label, and position must reinforce color distinctions. This applies universally, not only for accessibility compliance: in operational conditions (dim venue lighting, screen glare, high-stress environment, color-vision deficiency), color differentiation degrades. The differentiation must remain clear when color is unavailable.

**P-VIZ-15: Non-system-computed status values displayed as authoritative**
Status values (health, trust, confidence, freshness, readiness, connectivity, integrity) are computed by the system. No visualization may display a status value that was set directly by an operator as if it were a system-computed value. Operator notes and annotations are displayed as annotations, not as status. If an operator has written "I believe this device is healthy," that text appears as an annotation — it does not replace or override the system's UNKNOWN trust indicator.

---

*End of OPERATIONAL-DATA-VISUALIZATION-STANDARD-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Color token implementation: requires Agent 1 (Platform) coordination for design-token propagation*
*Trust computation rules: Agent 1 authority; this document governs their visualization only*
