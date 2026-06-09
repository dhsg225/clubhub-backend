# ClubHub TV — Temporal and Replay Components
# Shared Operational Intelligence Layer — Phase C: Component Constitution

**Document type:** Rendering governance — time-aware component behavior and replay integrity
**Authority:** Agent 3 (UX Architecture / Operator Experience)
**Audience:** All frontend contributors; Agent 1 (PRE replay API); Agent 2 (corpus and delivery log)
**Last updated:** 2026-05-25
**Status:** CANONICAL — temporal and replay rendering not conforming to this document is not eligible for deployment
**Phase:** C — Component Constitution (operational semantic rendering governance)

---

## Purpose

This document governs all time-aware rendering behavior in ClubHub TV — how operational timelines are rendered, how replay components function, how temporal context is maintained across navigation, and how the platform communicates the relationship between past, present, and simulated future states.

The threat this document addresses: **temporal ambiguity and replay divergence.** Time is not a simple dimension in ClubHub TV. The platform operates with multiple temporal contexts simultaneously: the live present, historical operational records accessible through replay, and previewed future states. When components fail to clearly communicate which temporal context they are rendering, operators can act on historical state believing it is current, or view live state believing it is historical. These errors are not correctable in the moment because the operator does not know they have made them.

**The governing principle: time as operational truth.** The moment an operational event occurred is a fact. The sequence in which events occurred is a fact. The PRE's resolution at any specific past moment is a fact. These facts must be rendered with the same commitment to accuracy as any other operational truth in the platform.

---

## Section 1 — Temporal Rendering Philosophy

### 1.1 Time as Operational Truth

Every displayed timestamp, timeline position, and temporal reference in ClubHub TV represents an operational fact. Timestamps are not decorative — they are evidence. The exact moment an override was applied determines what content played. The exact sequence of events in a 30-minute window determines whether sponsor delivery was achieved. The exact divergence point on a timeline determines where investigation should focus.

Temporal rendering rules derived from this principle:
- Timestamps are always precise — "14:23:07" not "2 minutes ago" for operational events (relative time is acceptable for very recent events in low-stakes contexts, but the exact timestamp must always be accessible)
- Timeline positions are proportional — a 5-minute period occupies the same visual space as every other 5-minute period at the same zoom level
- Event order is always chronological — visual presentation may not reorder events for aesthetic reasons
- Time zones are unambiguous — the time zone for all timestamps is disclosed at the surface level

### 1.2 Replay Integrity

Replay integrity means that the platform's historical record is an accurate, deterministic, and complete account of what happened. Replay is the authoritative source of operational truth for past events. When replay and any other account of past events conflict, replay governs.

Replay integrity in rendering means:
- Replay components call the actual PRE for historical state resolution — they do not reconstruct from logs, estimates, or summaries
- The replay corpus completeness is surfaced to the operator — gaps in the corpus are disclosed, not hidden
- Replay outputs are deterministic — the same moment, queried at any time by any operator, produces the same result
- Replay components are not "read from cache" unless the cache is a guaranteed-accurate snapshot of a prior actual PRE evaluation

### 1.3 Temporal Orientation Preservation

The operator's temporal orientation — their understanding of what moment they are currently viewing and how that moment relates to the present — must be preserved across all navigation and interactions.

Temporal orientation preservation rules:
- The current temporal context (live / replay timestamp / preview state) is always visible
- Navigation between scopes does not change the temporal context
- Entry into and exit from replay mode are explicit events with explicit visual transitions
- The relationship between historical moments and the current present is always accessible: how long ago was this? What has happened since this moment?

---

## Section 2 — Replay Component Types

### Replay Component RC-01: Replay Scrubber

**Purpose:** Allows the operator to navigate to any available moment in the operational history.

**Required behavior:**
- The scrubber spans the full available replay corpus, from oldest to most recent available moment
- The current position is labeled with a precise timestamp, updating continuously as the operator scrubs
- Corpus gaps are represented as visually distinct gaps in the scrubber track — not as empty periods that look like normal operational time
- Scrubbing is smooth and responsive — the displayed state updates to match the scrubber position with latency below 500ms for prepared replay data
- Events are marked on the scrubber track as navigable waypoints (overrides, escalations, incident declarations, emergency activations)
- The scrubber includes increment controls: back/forward 15 seconds, 1 minute, 5 minutes — for precise navigation to specific moments

**What the replay scrubber does not do:**
- Allow navigation to moments outside the available corpus (the scrubber cannot extend beyond corpus boundaries)
- Display anything during a corpus gap except the disclosure: "Replay unavailable for this period"
- Allow live state updates to affect the displayed historical state while scrubbing

---

### Replay Component RC-02: Replay Timeline

**Purpose:** Displays the sequence of operational events during the period under investigation, with the current replay position marked.

**Required behavior:**
- All event categories are displayed on distinct tracks: schedule events, override events, sponsor events, device events, system events
- The current replay position (from the scrubber) is marked on the timeline with a precise timestamp cursor
- Events are clickable navigation targets — tapping an event jumps the scrubber to that event's timestamp
- The timeline's time axis is labeled at consistent intervals
- The timeline can be zoomed — from a view spanning hours to a view spanning minutes — without changing which events are shown (zoom affects density, not visibility)
- Causality indicators (TP-06 from OPERATIONAL-COMPONENT-SEMANTICS-v1.md) are rendered on the timeline when causal relationships between events are known

**Information density at each zoom level:**
- Wide view (hours): event type icons with no labels; clicking produces full event detail
- Medium view (30 minutes): event type icons with brief labels
- Narrow view (5 minutes): full event labels visible without interaction

---

### Replay Component RC-03: Temporal Marker

**Purpose:** A labeled point in time on any timeline or scrubber, marking an operationally significant moment.

**Types:**
- **Event marker:** A specific operational event (override applied, incident declared, emergency activated)
- **Investigation anchor:** The starting point of the current replay investigation, set when replay was entered from an operational context
- **Counterfactual branch point:** A moment from which a counterfactual simulation diverges from the historical record
- **Corpus boundary marker:** The start and end of the available replay corpus

**Required information on each temporal marker:**
- Type (from the list above)
- Precise timestamp
- Brief description (for event markers: event type and attribution)
- On tap: full event detail and navigation to the replay position

---

### Replay Component RC-04: Replay-State Header

**Purpose:** A persistent surface element that communicates the operator's current temporal context during replay — what moment they are viewing, how it relates to the present, and what investigation context they entered replay with.

**Required content:**
- **Mode badge:** SB-02 (REPLAY) from OPERATIONAL-COMPONENT-SEMANTICS-v1.md — always visible
- **Current position:** The exact timestamp currently displayed (e.g., "Viewing: 14:23:07 on 2026-05-23")
- **Time since present:** How far in the past the current position is (e.g., "1 day, 6 hours ago")
- **Investigation anchor:** What moment the operator entered replay from (e.g., "Anchored: incident IC-2026-05-23-001 declared at 14:18:42")
- **Exit control:** A visible, accessible "Return to live" control at all times

**Behavioral rules:**
- The replay-state header is structurally persistent — it cannot be hidden, collapsed, or scrolled out of view while in replay mode
- The header occupies a fixed position in the interface that does not change with workspace navigation within replay
- The current position timestamp in the header updates in real time as the operator scrubs

---

### Replay Component RC-05: Counterfactual Overlay

**Purpose:** Displays a simulated alternative operational history starting from a specific branch point — "what would have happened if this override had not been applied" or "what would have played if the schedule had been different."

**Required behavior:**
- The counterfactual simulation is clearly distinguished from the actual historical record — visual treatment that makes their relationship immediately clear
- The branch point is labeled: "Simulation starts here. Before this point: actual history. After this point: simulation."
- The counterfactual uses actual PRE evaluation — it is not an estimate
- The counterfactual cannot be committed to live state — it is a simulation for investigation purposes only
- Exiting the counterfactual overlay returns to the actual historical state at the branch point

**Permitted uses:**
- Investigating what would have played without a specific override
- Training operators on the consequences of hypothetical decisions
- Post-incident analysis of alternative response strategies

**Prohibited uses:**
- Using counterfactual simulation to "preview" a live action (previews of live actions use the live preview system, not the replay counterfactual system)

---

### Replay Component RC-06: Historical Divergence Indicator

**Purpose:** Marks moments in the operational history where the actual delivered content differed from what the PRE resolved — device divergence, delivery failures, or corpus verification failures.

**Required behavior:**
- Divergence indicators appear on the timeline at the moment of divergence
- The type of divergence is labeled: "Device divergence: Screen expected [content], device reported [different content]"
- Severity is indicated (minor discrepancy vs. significant delivery failure)
- Tapping navigates to the divergence detail and the relevant delivery log entry

---

## Section 3 — Live / Replay Coexistence

### 3.1 Side-by-Side Comparison Legality

Side-by-side display of live state and replay state — where one panel shows the current live operational state and an adjacent panel shows a specific historical moment — is a powerful investigation tool. It is also a temporal confusion risk.

**Side-by-side comparison is permitted under these conditions only:**
- Both panels carry persistent, unambiguous temporal context labels (SB-01 LIVE and SB-02 REPLAY)
- The two panels are visually distinct in treatment — not merely labeled differently, but structurally distinguishable
- The temporal gap between the panels is displayed: "Live is [X] ahead of replay"
- Actions from the live panel must not reference replay state as their basis without explicit disclosure

**Side-by-side comparison is prohibited when:**
- The visual treatment of the two panels could be confused
- The operator is using the replay panel for comparison during an emergency flow (emergency flows require exclusive live state focus)

### 3.2 Replay / Live Switching Rules

Switching between LIVE and REPLAY modes requires an explicit transition — no implicit or accidental mode switching.

**LIVE → REPLAY:**
1. Operator initiates replay entry (explicit action)
2. Mode transition animation (distinct from all data update animations)
3. REPLAY state header appears
4. Live updates cease on all panels
5. Temporal context displays the entry point

**REPLAY → LIVE:**
1. Operator initiates live return (from the persistent "Return to live" control)
2. Reconciliation summary: "You were viewing [time]. Notable changes since: [list or 'none']"
3. Mode transition animation
4. LIVE badge replaces REPLAY header
5. SYNCHRONIZED state briefly displayed
6. Live updates resume

**What is never permitted:**
- Transitioning from REPLAY to LIVE as a side effect of a navigation action
- Allowing live state updates to "bleed through" into replay panels
- Transitioning without the operator's explicit initiation

### 3.3 Replay Exit Visibility

Replay exit is as consequential as replay entry. An operator who returns to live state without awareness of what changed during their replay investigation may miss critical developments.

**Replay exit reconciliation (mandatory):**

The reconciliation summary must include:
- Duration of time spent in replay: "You spent 12 minutes investigating [period]"
- Time elapsed since replay entry: "14 minutes have passed since you entered replay"
- Notable changes during the replay period: using the same categorization as attention-worthy updates (U-02) from LIVE-UPDATE-BEHAVIOR-SPEC.md
- If an active incident was declared during the replay period, this is surfaced first regardless of other changes

The reconciliation summary is displayed as an overlay before the full live state is restored — the operator sees the summary, acknowledges it, and then the full live state loads. This prevents the scenario where critical changes are buried in a busy live dashboard that the operator scans past.

### 3.4 Replay Context Persistence

Replay context — including the investigation anchor, the current scrubber position, and any annotations made during the investigation — persists across navigation within replay mode.

**Persistence rules:**
- Navigating to a different venue or screen within replay mode does not change the scrubber position
- Annotations are linked to both the timestamp and the scope at which they were created
- The investigation anchor (the moment replay was entered from) is preserved for the duration of the replay session
- On replay exit, the investigation record (anchor, positions visited, annotations) is available in the operational memory for review

---

## Section 4 — Temporal Consistency Rules

### 4.1 Timestamp Authority

Every timestamp displayed in the platform must come from an authoritative source. The authoritative timestamp source is the PRE's operational clock.

**Timestamp authority rules:**
- Client-side timestamps (browser/device time) are never used as the authoritative timestamp for operational events
- Timestamps are displayed in the operational timezone (defined at deployment), with the timezone always labeled
- Timestamps are precise to the second for operational events (override application, emergency activation, incident declaration)
- Timestamps precise to the minute are acceptable for slower-moving metrics (health grade computation, SOV accumulation) provided the precision is disclosed

### 4.2 Timezone Governance

All timestamps across all surfaces use the same reference timezone (the operational venue's local time, or UTC for fleet-level views — defined per deployment). The timezone is labeled on every timestamp-bearing surface.

**Cross-timezone deployments:** Fleets spanning multiple timezones display the venue's local time for venue-level timestamps and UTC (or a defined fleet-wide timezone) for fleet-level timestamps. The reference timezone is always labeled — never implied.

**What is never permitted:**
- Unlabeled timestamps that could be interpreted as either local time or UTC
- Different surfaces displaying the same event with different timezone offsets without disclosure
- Timestamps derived from operator client time rather than the authoritative server clock

### 4.3 Event Ordering

Events on any timeline are ordered strictly by timestamp (chronological, oldest to newest, left to right). No reordering is permitted for visual, categorical, or aesthetic reasons.

**When two events have the same timestamp** (to the resolution of available precision): the tie-breaking order is:
1. Emergency activations
2. Override applications
3. Schedule events
4. System events
5. Device events

The tie-breaking order is disclosed if multiple events share a timestamp: "Multiple events at 14:23:07 — ordered by type precedence."

### 4.4 Delayed-Event Rendering

Some events are not recorded at the moment they occur — delivery log aggregations, entropy computations, corpus verifications run on a scheduled basis. These events have a computation timestamp that is later than the operational moment they describe.

**Delayed-event rendering rules:**
- The display position on the timeline reflects the operational moment (when the event occurred), not the computation timestamp
- The computation lag is disclosed on the event: "Delivery confirmed at 14:30 (computed at 14:35)"
- Events with significant computation lag carry a disclosure: "This data was computed [N] minutes after the operational period. It reflects the authoritative record, not a real-time reading."

### 4.5 Causality Preservation

The operational timeline must preserve the causal order of events — the sequence in which decisions and their consequences occurred. Visual representations that display consequences before causes, or that omit the causal relationship between events, violate this rule.

**Causality preservation rules:**
- Cause always appears before effect on the timeline
- Causal relationships are surfaced when known (causality indicators TP-06)
- Summary views that condense a causal chain must preserve the initiating event: not "sponsor delivery gap" but "emergency override (14:23) → sponsor delivery suppressed (14:23–14:47)"

---

## Section 5 — Temporal Failure Modes

### Failure Mode TF-01: Replay Confusion

**What it is:** The operator does not know whether they are in LIVE or REPLAY mode. They take what they believe is a live operational action, not realizing they are in replay mode — or they fail to act on a live condition because they believe they are in replay.

**Why it happens:** Insufficient visual distinction between LIVE and REPLAY mode. The mode badge is present but not prominent enough to register during focused operational work.

**Prevention:** The REPLAY state header (RC-04) is structurally persistent and visually dominant. The color treatment for REPLAY mode is structurally distinct from LIVE mode — not a different shade of the same color, a categorically different visual state. The "Return to live" control is permanently visible during replay so the operator always has a clear anchor for which mode they are in.

---

### Failure Mode TF-02: Temporal Collapse

**What it is:** Multiple temporal contexts (live, replay, preview) are simultaneously visible without clear distinction, causing the operator to lose track of which context they are operating in. This is distinct from replay confusion — temporal collapse occurs when the interface attempts to show multiple temporal contexts at once without sufficient visual separation.

**Why it happens:** Side-by-side comparison implementations that do not maintain sufficient visual distinction between panels. Dashboard surfaces that display historical data (rolling averages, previous period comparisons) alongside live data without clear temporal labeling.

**Prevention:** Any surface displaying multiple temporal contexts simultaneously must maintain explicit, persistent temporal labeling for every panel or data element. When temporal contexts are mixed, the operator must be able to determine the temporal context of any specific value in under 2 seconds without requiring interaction.

---

### Failure Mode TF-03: Timestamp Ambiguity

**What it is:** The operator cannot determine what a displayed timestamp means — is this when the event occurred, when it was recorded, when it was computed, or when it was last updated? Different interpretations of the same timestamp can produce different operational conclusions.

**Why it happens:** Timestamps without context labels. "Last updated: 14:23" on a metric that is computed from data that is itself 5 minutes delayed — the "14:23" computation time obscures that the underlying data reflects state as of 14:18.

**Prevention:** Every timestamp carries a semantic label: "Applied at," "Computed at," "Delivered at," "Last synchronized at." The label is not optional. Timestamps without semantic labels are non-conforming.

---

### Failure Mode TF-04: Causality Inversion

**What it is:** The displayed timeline presents events in an order that implies a causal relationship opposite to the actual one. An override expiry appears before the content change it caused — or a sponsor delivery gap appears before the override suppression that caused it — because the visualization was ordered by a different criterion.

**Why it happens:** Timeline rendering that orders events by category (all overrides together, all delivery events together) rather than by timestamp. Category-ordered timelines invert causality when a cause and its effect belong to different categories.

**Prevention:** Timeline rendering is always chronological. Category grouping is applied as visual styling (color, track position) not as temporal ordering. The time axis is always the primary axis.

---

### Failure Mode TF-05: Hidden Delay Distortion

**What it is:** The platform displays a "current" value that is actually computed from data that is significantly behind the present moment, without disclosing the delay. The health grade appears current but is computed from delivery data that is 15 minutes old. The SOV figure appears precise but is last confirmed 8 minutes ago. The operator makes decisions based on what they believe is current information, not realizing the lag.

**Why it happens:** Metrics computed from delayed pipelines, displayed without disclosure of the computation lag. The UI presents the most recent computation as if it were a real-time value.

**Prevention:** Delayed metrics carry explicit delay disclosure on the surface that displays them: "Health grade: A (updated 4m ago, based on data through 14:19)." The delay disclosure is not in fine print — it is adjacent to the value it modifies, legible at the same font size.

---

## Section 6 — Human Factors

### 6.1 Temporal Disorientation

Temporal disorientation — losing track of what time context one is currently in — is a specific form of operational confusion that is particularly dangerous in a platform with multiple simultaneous temporal contexts. Unlike spatial disorientation (being in the wrong workspace), temporal disorientation is invisible — the operator believes they are in the right place, but the wrong time.

**Design responses:**
- The replay state header (RC-04) is the primary defense: persistent, prominent, impossible to confuse with live mode
- The reconciliation summary on replay exit is the secondary defense: the operator cannot exit replay without seeing a summary of what changed while they were away
- The "how long ago is this?" display (the time-since-present in the replay header) maintains continuous temporal orientation

### 6.2 Replay Cognitive Anchoring

When operators enter replay for investigation purposes, they need a cognitive anchor — a reference point that orients their investigation. Without an anchor, operators scrub the timeline aimlessly, spending cognitive resources on navigation rather than investigation.

**Design response:** The investigation anchor (the operational context from which replay was entered — an incident, an anomaly, a specific operator question) is preserved and displayed throughout the replay session. The operator always knows why they entered replay and can orient their investigation relative to the anchor.

**Anchor types:**
- Incident anchor: replay entered from an incident context — anchored to incident declaration time
- Anomaly anchor: replay entered from an anomaly alert — anchored to anomaly detection time
- Sponsor gap anchor: replay entered from a delivery gap — anchored to the gap start time
- Manual anchor: operator manually set a specific moment for investigation

### 6.3 Event-Order Memory

Operators who work with the platform regularly develop event-order memory — they learn the typical sequence of operational events and can quickly detect anomalies because "that's not the right order." An emergency activation appearing before any content change is unexpected. A schedule event appearing in the middle of an override interval raises questions.

**Design response:** The timeline presentation must support event-order memory formation by being consistently ordered and consistently categorized. Operators who can predict the typical pattern of events on a timeline will notice deviations faster than operators who must read every event explicitly.

### 6.4 Causality Reconstruction

When operators investigate past incidents, they are performing causality reconstruction — building a mental model of which events caused which other events. This is a cognitively demanding task that is supported or impeded by how the timeline presents event relationships.

**Design response:** Causality indicators (TP-06) are the primary tool for supporting causality reconstruction. The investigation anchor, the chronological ordering, and the causal links together provide the scaffolding for accurate causality reconstruction without requiring the operator to hold the entire event sequence in working memory.

---

## Related Documents

**COMPONENT-CONSTITUTION-v1.md** — The governing constitution. Class CC-02 (timeline surfaces) and Class CC-07 (replay surfaces) are governed by this document.

**OPERATIONAL-COMPONENT-SEMANTICS-v1.md** — The semantic definitions for timeline primitives (TP-01 through TP-06) used in this document's component specifications.

**CANONICAL-UI-STATE-MODEL.md** — The LIVE and REPLAY state types that temporal components implement and label.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — The live/replay distinction rendering requirements (Section 4). The component specifications here implement those requirements.

**OPERATIONAL-NAVIGATION-GOVERNANCE.md** — Temporal context persistence across navigation (Section 3.4). The replay context persistence rules in this document implement the navigation spec's temporal continuity requirements.

**REPLAY-TRAINING-AND-OPERATIONAL-LITERACY-v1.md** — How replay is used for training and operational literacy. The component governance here enables the replay-first learning model described there.

---

*End of TEMPORAL-AND-REPLAY-COMPONENTS-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Operator Experience).*
*PRE replay API and corpus completeness: Agent 1 co-authority.*
*Delivery log and event record: Agent 2 co-authority.*
*Changes to replay component behavior or temporal consistency rules require cross-agent review.*
