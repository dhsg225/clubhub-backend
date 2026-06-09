# CANONICAL-VENUE-OPERATIONS-SURFACE-v2
# Venue Operations Dashboard — Single-Venue Deep-Dive Reference Surface

**Document type:** Canonical reference surface specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Designers, frontend engineers, QA
**Depends on:** OPERATIONAL-WORKSPACES-v1.md, OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md, MULTI-VENUE-OBSERVABILITY-v1.md, FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md
**Version:** 2.0
**Status:** CANONICAL

---

## 1. Surface Identity

**Surface name:** Venue Operations Dashboard

**Canonical routes:**
- `/venues/:venue_id` — primary entry point
- `/venues/:venue_id/screens` — direct entry to Screen Management tab
- `/venues/:venue_id/content` — direct entry to Content Delivery tab
- `/venues/:venue_id/overrides` — direct entry to Override History tab
- `/venues/:venue_id/pre` — direct entry to PRE Resolution State tab
- `/venues/:venue_id/history` — direct entry to Venue History tab

**URL permanence requirement:** Venue URLs are permanent. `/venues/:venue_id` never becomes invalid, even if the venue is decommissioned. A decommissioned venue URL renders a read-only archive view with a "VENUE DECOMMISSIONED" banner; it does not redirect and does not return 404. This is a constitutional requirement — operators must be able to navigate to any previously-operated venue to access its history.

**Who can access:**
- VIEWER: Assigned venues only. Read-only. All tabs visible.
- OPERATOR: Assigned venues only. All tabs. May trigger reassessments and run recovery workflows.
- ADMIN: All venues. Full control including screen enrollment, override removal, and manual sync.

**Relationship to Live Ops surface:** The Live Ops surface is the multi-venue aggregate — it shows one row per venue with summary health indicators and an alert count. The Venue Operations Dashboard is the single-venue deep-dive. Operators reach this surface by clicking any venue name or venue card from Live Ops. The breadcrumb "All Venues → [Venue Name]" confirms the relationship. This surface provides no fleet-level aggregate data.

---

## 2. Venue Identity Header

The header is persistent — it does not scroll away. It spans the full width of the content area above the tab system.

**Left section:**
- Venue name in 20px semibold: e.g., `Paddington RSL`
- Venue ID in 12px monospace below the name: e.g., `venue_id: vn-0042`
- Venue tier badge: one of `NETWORK` / `LEAGUE` / `VENUE` — rendered as a small pill in muted blue
- Installation type: e.g., `Licensed Club` in 12px gray text

**Center section — Machine State Badge:**
The machine state is the most prominent element in the header. It occupies a 120×40px pill.

| Machine State | Background | Label text |
|---|---|---|
| LIVE | Green (#22c55e) | LIVE |
| SYNCING | Blue (#3b82f6) | SYNCING |
| INITIALIZING | Blue (#3b82f6) | INITIALIZING |
| DEGRADED | Amber (#f59e0b) | DEGRADED |
| INCIDENT | Red (#ef4444) | INCIDENT |
| OFFLINE | Slate (#64748b) | OFFLINE |

All machine state badges use white text. The badge has no hover state — it is display-only. The badge does not link anywhere.

**Machine state history strip** (below the badge):
Shows the last 3 state transitions in chronological order, oldest left, newest right. Each entry:
```
[LIVE → OFFLINE]  2026-06-02 14:32 AEST    [OFFLINE → SYNCING]  2026-06-02 15:18 AEST    [SYNCING → LIVE]  2026-06-02 15:23 AEST
```
Each transition is rendered as: `[FROM → TO]` in a small pill (12px), followed by the governed timestamp in venue local timezone. AEST / NZDT / etc. always appended. If fewer than 3 transitions exist, only available entries are shown; the strip does not pad with placeholders.

**Right section:**
- "Last corpus sync:" followed by a human-readable age: e.g., `4 hours ago` or `2 days ago`
- If corpus sync was more than 48 hours ago: age text turns amber
- If corpus sync was more than 72 hours ago: age text turns red with a warning icon and text: `Autonomy limit approaching`

**72-Hour Autonomy Clock** (appears in right section when venue is OFFLINE or DISCONNECTED):
A distinct panel that renders only when `autonomy_status.online: false` and `autonomy_status.offline_duration_ms` is non-null.

```
┌─────────────────────────────────────┐
│ AUTONOMOUS OPERATION                │
│ 47h 23m remaining                   │
│ Player serving content without sync │
│ Corpus: vn-0042-corpus-v31          │
└─────────────────────────────────────┘
```

Full autonomy clock specification is in Section 7.

---

## 3. Zone A — Navigation

Zone A is the left sidebar, present in all workspace views. For the Venue Operations Dashboard, Zone A contains:

**Pane A1 — Venue Selector (ADMIN view):**
When the operator has ADMIN role, Zone A shows a scrollable list of all venues. The current venue (`venue_id`) is highlighted with a left border accent and the venue name in semibold. VIEWER and OPERATOR roles see only their assigned venues in this list. The list is filterable by a search field at the top: `Search venues...`

**Back navigation (all roles):**
At the top of Zone A, above the venue list, a back control: `← All Venues`. Tapping this navigates to the Live Ops surface (multi-venue aggregate). This control is always present, regardless of role.

**Venue-specific navigation shortcuts (Zone A, below venue list):**
These shortcuts appear only when a venue is selected. They scroll to the same tabs as the header tab system:
- Overview
- Screens
- Content
- Overrides
- PRE State
- History

The active tab is highlighted in Zone A to match the active tab in Zone B.

**Active incident shortcut (Zone A, conditional):**
If the selected venue has one or more active incidents, a persistent indicator appears at the bottom of Zone A:
```
⚠ Active Incident
S2 — Declared 1h ago
[Go to Incident Commander →]
```
This navigates to the Incident Commander surface for the specific incident. It does not open a modal.

---

## 4. Zone B — Tab System

Zone B is the main content area. It contains a horizontal tab strip at the top followed by the active tab content.

Tab strip (left-aligned):
```
[Overview]  [Screens]  [Content]  [Overrides]  [PRE State]  [History]
```

Active tab is underlined. All tabs are always present in the DOM regardless of venue state. No tabs are hidden based on venue state.

---

### Tab 1: Venue Overview

This is the default tab when navigating to `/venues/:venue_id`. It provides a complete snapshot of venue health at a single moment.

#### Status Dashboard — 7 Dimensions

Each dimension is rendered as a card. Cards are arranged in a 4-3 grid (4 on top row, 3 on bottom row).

Each card contains:
- Dimension label (e.g., `HEALTH`)
- Current value in large text (e.g., `DEGRADED`)
- Confidence level as a colored dot with label: `HIGH` (green) / `MEDIUM` (amber) / `LOW` (red) / `NONE` (grey)
- Derivation basis: 1–2 lines of plain text explaining what drives the current value (e.g., `One heartbeat gap detected in the last 30 minutes`)
- Last updated timestamp: `Updated 2m ago` in 11px gray
- Freshness indicator: no badge if CURRENT; `STALE` badge in amber if stale; `EXPIRED` badge in red if expired

**Card visual treatments by value:**

| Value | Card border | Value text color |
|---|---|---|
| HEALTHY / TRUSTED / READY / CONNECTED / VERIFIED / CURRENT | Green left border | Green |
| DEGRADED / DEGRADED_TRUST / PARTIALLY_READY / INTERMITTENT / STALE | Amber left border | Amber |
| CRITICAL / UNTRUSTED / NOT_READY | Red left border | Red |
| FAILED / MISMATCH | Red border (all sides) | Red bold |
| UNKNOWN | Grey left border | Grey |
| ASSESSING | Blue left border, pulsing animation | Blue |

**UNKNOWN status visual treatment:** UNKNOWN is always displayed with a grey left border and grey value text. The basis section shows: `Signal unavailable — last known value: [value] ([age] ago)`. A grey "?" icon appears beside the dimension label. UNKNOWN is never displayed in a neutral or reassuring style. The card background is a very light grey (#f8fafc) to distinguish it from HEALTHY green cards.

**The 7 dimension cards in order:**

1. **HEALTH** — `HEALTHY / DEGRADED / CRITICAL / FAILED / UNKNOWN`
   - Basis shows: the specific monitoring signal(s) that are failing, e.g., `Memory pressure: 91% (threshold: 85%)`

2. **TRUST** — `TRUSTED / DEGRADED_TRUST / UNTRUSTED / UNKNOWN`
   - Basis shows: which trust signals (freshness / corpus hash / clock sync) are failing
   - If UNTRUSTED: basis text in red: e.g., `Corpus hash mismatch detected`

3. **CONFIDENCE** — `HIGH / MEDIUM / LOW / NONE`
   - Basis shows: `All inputs current` (HIGH) or the specific stale/missing inputs (MEDIUM/LOW)
   - If NONE: basis text: `Insufficient data — cannot assess. Missing: [signal names]`

4. **FRESHNESS** — `CURRENT / STALE / EXPIRED / UNKNOWN`
   - Basis shows: age of the data and configured freshness window: e.g., `Last update 8m ago (window: 2m)`

5. **READINESS** — `READY / PARTIALLY_READY / NOT_READY / ASSESSING`
   - Basis shows: the failing readiness conditions. Each condition on a separate line, with a ✓ or ✗ icon:
     ```
     ✓ Player state: LIVE
     ✓ Corpus hash: VERIFIED
     ✗ Clock sync: 4.2s delta (tolerance: 2s)
     ✓ Heartbeat: CURRENT
     ```

6. **CONNECTIVITY** — `CONNECTED / INTERMITTENT / DISCONNECTED / UNKNOWN`
   - Basis shows: heartbeat statistics: e.g., `9 of 10 heartbeats received (last 10 minutes)`
   - If DISCONNECTED: basis shows time since last heartbeat: `Last heartbeat: 6h 14m ago`

7. **INTEGRITY** — `VERIFIED / UNVERIFIED / MISMATCH / UNKNOWN`
   - Basis shows: corpus hash values if available: `Hash: a3f9...c21b — verified 4h ago`
   - If MISMATCH: basis shows both hashes: `Computed: a3f9...c21b — Expected: 9f12...44aa — Mismatch detected`

#### RECOVERED_BUT_UNTRUSTED Section

This section appears between the status dashboard and the active incidents indicator when `player_state` carries the `RECOVERED_BUT_UNTRUSTED` flag. It is not a card — it is a full-width banner panel with amber background.

Full specification in Section 8.

#### Active Incidents Indicator

Below the status dashboard:

If `active_incidents.incidents` contains entries:
```
⚠ 2 active incidents — S1 (Declared), S3 (Watching)
[View in Incident Commander →]
```
The link navigates to the Incident Commander surface, not a modal.

If `active_incidents` is absent from the API response (not an empty array — absent entirely):
```
Incident status unavailable — cannot confirm no active incidents
```
This is the required degraded rendering per FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md Rule DG-01. The phrase "No active incidents" must never appear when the data is unavailable.

If `active_incidents.incidents` is an empty array (data present, no incidents):
```
No active incidents
```

#### Active Overrides Summary

Below the incidents indicator:

```
Active overrides: 3  (L2: 1, L4: 1, L6: 1)
[Manage overrides →]
```

If `override_stack._freshness` is STALE or EXPIRED, add: `— override data [N] minutes old` in amber.

The link navigates to the Overrides tab (Tab 4).

---

### Tab 2: Screen Management

This tab lists all screens (devices) enrolled at this venue. Each screen represents a physical display device with its own player state.

#### Screen List

Column headers:
```
SCREEN NAME    DEVICE ID          MACHINE STATE    LAST HEARTBEAT    STATUS
```

Each row:
```
Main Bar       dev-0042-001       [LIVE]           23s ago           ✓
Lounge A       dev-0042-002       [OFFLINE]        6h 14m ago        ✗  [Expand ▾]
Entrance       dev-0042-003       [DEGRADED]       45s ago           ⚠  [Expand ▾]
TAB Terminal   dev-0042-004       [LIVE]           18s ago           ✓
```

Machine state badges on screen rows use the same color coding as the venue-level badge (Section 2).

Last heartbeat uses human-readable age. If last heartbeat is more than 5 minutes ago, age text is amber. If more than 1 hour ago, age text is red.

Rows with machine states other than LIVE have an `[Expand ▾]` control.

#### Screen Detail Expand

When a screen row is expanded, a sub-panel appears below the row with the following information:
- Machine state history (last 3 transitions with timestamps, same format as venue header)
- Corpus hash for this device: hash value + match status vs venue corpus
- Current content playing: content_ref value + description if available
- PRE resolution level active on this screen: e.g., `L4 — Operator Override`
- Active overrides applying to this screen: list of override_ids and levels
- Last reported error: if `machine_state` is DEGRADED or INCIDENT, shows the specific error message from the last heartbeat
- "View this screen's content history" link (navigates to Content tab filtered by this device)

#### Screen Enrollment — "Enroll New Screen" Flow

Button: `+ Enroll New Screen` — ADMIN role required. Absent from DOM for OPERATOR and VIEWER.

Clicking opens a modal (not a page navigation). The modal has 3 steps:

**Step 1 — Device Pairing:**
- Field: `Device ID` — 12-character alphanumeric code found on the device's setup screen or label
- Field: `Screen Name` — free text, required, max 60 characters, e.g., `Main Bar Screen`
- Field: `Screen Location` — free text, optional, e.g., `Behind bar, facing seating area`
- Instruction text: `Enter the pairing code displayed on the device's setup screen. The device must be powered on and connected to the venue network.`
- Button: `Verify Device` — calls the device pairing API. Shows a spinner while verifying.
- On failure: `Device not found — confirm the device is powered on and re-enter the code.`
- On success: advance to Step 2.

**Step 2 — Screen Configuration:**
- Shows: device_id confirmed, device model (from API response)
- Field: `Primary Display Zone` — dropdown, venue-specific zones configured in venue settings
- Field: `Content Groups` — multi-select checkboxes of available content groups for this venue
- Button: `Back` (returns to Step 1), `Enroll Screen` (commits enrollment)

**Step 3 — Enrollment Confirmation:**
- `Screen enrolled successfully.`
- Shows: Screen Name, Device ID, enrollment timestamp
- `The screen will begin syncing content. It will appear as SYNCING in the screen list and transition to LIVE once the corpus is loaded.`
- Button: `Done` (closes modal, refreshes screen list)

#### Screen Removal — ADMIN Only

A `Remove Screen` option appears in a `...` overflow menu on each screen row. Only present for ADMIN role.

Clicking opens a confirmation modal:
```
Remove screen "Lounge A" (dev-0042-002)?

This will:
- Unenroll the device from this venue
- Remove all content assignments for this screen
- Preserve all historical data (this is not deletable)

This action cannot be undone.
The device will need to be re-enrolled to restore service.

[ Cancel ]    [ Remove Screen ]
```

"Remove Screen" button is red. Clicking it requires typing the screen name in a confirmation field before the button becomes active:
- Label: `Type "Lounge A" to confirm`
- Input field: text input
- The "Remove Screen" button is disabled until the field exactly matches the screen name.

Audit event emitted: `venue:screen:removed`

---

### Tab 3: Content Delivery

This tab provides a complete view of content delivery status for the venue — what has been delivered, what is in queue, and the current corpus state.

#### Corpus Status Panel

Full-width panel at the top of this tab:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CORPUS STATUS                                                            │
│                                                                          │
│ Current corpus hash:   a3f9c21b...d445ee18                               │
│ Hash status:           VERIFIED ✓    Last verified: 4h 32m ago           │
│ Corpus version:        vn-0042-corpus-v31                                │
│ Last sync:             2026-06-02 10:14 AEST                             │
│                                                                          │
│ [ Request Manual Sync ] ← ADMIN only                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

Hash status visual treatment:
- `VERIFIED ✓` in green when `hash_match: true` and `hash_verified: true`
- `UNVERIFIED` in amber when `hash_verified: false` (hash check not yet performed or expired >24h)
- `MISMATCH ✗` in red when `hash_match: false`
- `UNKNOWN` in grey when corpus_status is absent or hash is unavailable

If `corpus_status` is entirely absent from the API response:
```
Corpus status: UNKNOWN — not verified
```
The text "VERIFIED" must not appear when `hash_verified` is false or data is absent.

**"Request Manual Sync" button:** ADMIN role only. Absent from DOM for OPERATOR and VIEWER. Clicking shows a confirmation:
```
Request a manual corpus sync for Paddington RSL?
This will initiate a fresh content sync from the platform.
The venue will briefly enter SYNCING state.

[ Cancel ]    [ Request Sync ]
```
After confirmation, the button enters a loading state and the corpus status panel shows `Sync requested — awaiting response...`. Audit event: `venue:corpus:manual-sync-requested`.

#### Pending Content Items

A list of content items scheduled for this venue but not yet delivered. Each row:
```
CONTENT ITEM                    TYPE        DELIVERY WINDOW        STATUS
Summer Promo Bundle v3          Campaign    In 2h 14m              Queued
TAB Odds Update 14:30           Scheduled   In 47m                 Queued
Emergency Contact Refresh       Mandatory   Next sync              Pending verification
```

If no pending items: `No content items pending delivery.`

If pending items exist but `autonomy_status.online: false`: each row shows an additional column `Delivery blocked — venue offline`.

#### Delivery Queue

The delivery queue shows the next N sync events scheduled, in time order:
```
SCHEDULED SYNC          ITEMS          AUTONOMY IMPACT
2026-06-02 16:00 AEST   3 items        Will extend autonomy clock to 72h
2026-06-02 22:00 AEST   7 items        Scheduled nightly sync
2026-06-03 10:00 AEST   2 items        Campaign rotation update
```

If `autonomy_status.online: false`, the autonomy impact column shows: `Delivery blocked — venue must reconnect first`.

#### Corpus Sync Log

A paginated table showing the last 20 sync events. Default: 10 per page.

```
TIMESTAMP                TYPE              HASH                    RESULT
2026-06-02 10:14 AEST    Scheduled sync    a3f9c21b...d445ee18     SUCCESS
2026-06-01 22:00 AEST    Nightly sync      a3f9c21b...d445ee18     SUCCESS (no change)
2026-06-01 10:02 AEST    Scheduled sync    9f12e3aa...8b21cc04     SUCCESS
2026-05-31 22:00 AEST    Nightly sync      9f12e3aa...8b21cc04     SUCCESS (no change)
```

Result values: `SUCCESS` (green), `SUCCESS (no change)` (green muted), `FAILED` (red), `PARTIAL` (amber), `ABORTED` (amber).

Each row is expandable to show full hash values and sync details.

---

### Tab 4: Override History

This tab shows all overrides that have ever been placed at this venue, scoped to venue_id.

#### Active Overrides Section

Header: `Active Overrides (N)` where N is the count of currently active overrides.

If no active overrides: `No active overrides at this venue.`

Each active override is displayed as a card:

```
┌─────────────────────────────────────────────────────────────────────┐
│ L4 — Venue Manager Override                    [ACTIVE]             │
│ Content: Summer Drinks Promo v2                                     │
│ Placed by: jane.operator@paddingtonrsl.com.au                       │
│ Placed:    2026-05-28 09:14 AEST                                    │
│ Expires:   2026-06-30 23:59 AEST  (28 days remaining)              │
│                                                                      │
│ Applies to: All screens                                             │
│                                                                      │
│ [ Remove Override ]  ← authority level required shown on hover     │
└─────────────────────────────────────────────────────────────────────┘
```

Override levels and required authority to remove:

| Override Level | Label | Can be removed by |
|---|---|---|
| L1 | Emergency Override | ADMIN with elevation |
| L2 | Network Policy Override | ADMIN |
| L3 | League/Franchise Override | ADMIN |
| L4 | Venue Manager Override | ADMIN or OPERATOR (own overrides) |
| L5 | Scheduled Campaign | ADMIN |
| L6 | Default Content | ADMIN with elevation |

"Remove Override" button: authority check per table above. If the current operator lacks authority, the button is absent from the DOM (not disabled). A note reads: `[Role] required to remove this override.`

**Override expiry display:**
- `Expires: [datetime]  (N days remaining)` — green text when >7 days remain
- `Expires: [datetime]  (N days remaining)` — amber text when ≤7 days remain
- `Expires: [datetime]  (EXPIRING TODAY)` — red text on expiry day
- `Expires: NEVER` — amber text with a ⚠ icon, indicating a no-expiry override

**SUPERSEDED state:**
An override is SUPERSEDED when a higher-level override makes it zero-contribution — the override is still active but is not winning the PRE resolution because a higher level is taking precedence.

SUPERSEDED overrides display with a grey `[SUPERSEDED]` badge replacing the green `[ACTIVE]` badge. The card body shows:
```
Status: SUPERSEDED — this override is active but not winning.
Superseded by: L1 Override (override_id: ov-0991)
This override will become effective if the L1 override is removed.
```

#### Override Accumulation Warning

When the active override count exceeds 3, a full-width amber warning banner appears at the top of the Active Overrides section:

```
⚠ Override accumulation: 5 active overrides
Venues with more than 3 concurrent overrides may have competing rules
and reduced content predictability. Consider reviewing and removing
expired or unnecessary overrides.
```

This is an `OPERATIONAL_WARNING` type alert. It does not appear in the alert feed — it is only shown on this tab. Threshold: 3 active overrides triggers the warning. The threshold is not configurable from the UI.

#### Expired / Removed Overrides Section

Below the active section, collapsible:

`Expired & Removed Overrides (N)` — default collapsed. Expand to see:

Each row in a compact table format:
```
LEVEL  CONTENT                   PLACED BY          PLACED         ENDED          REASON
L4     Summer Promo v1           jane.operator@...  2026-04-01     2026-05-01     Expired
L2     Network Compliance v3     system@platform    2026-03-15     2026-04-30     Removed by admin
L6     Default Drinks Menu       setup@platform     2026-01-01     2026-03-14     Superseded
```

Paginated: 20 per page. No expansion — these are read-only historical records.

---

### Tab 5: PRE Resolution State

PRE (Priority Resolution Engine) determines which content is authoritative for this venue at any given moment.

#### Current Resolution Panel

```
┌──────────────────────────────────────────────────────────────────┐
│ PRE RESOLUTION — CURRENT                                         │
│                                                                  │
│ Authoritative level: L4 — Venue Manager Override                │
│ Winning content:     Summer Drinks Promo v2                      │
│ Resolved at:         2026-06-02 14:47:32 AEST                   │
│ Confidence:          HIGH                                        │
│                                                                  │
│ PRE divergence:      NONE — parity confirmed 12m ago            │
└──────────────────────────────────────────────────────────────────┘
```

If `pre_resolution._freshness` is EXPIRED:
```
PRE data expired — last known resolution: [effective_content] at [age]
```
Panel border turns red. Content inside is shown with an `EXPIRED DATA` badge.

If `pre_resolution` is absent:
```
PRE resolution unavailable — last known: [effective_content] at [age]
```
The phrase "PRE resolution unavailable" is displayed in amber. No resolution-level information is inferred.

#### Level-by-Level Breakdown

A table showing all 7 resolution levels (L0–L6) and what each currently contributes:

```
LEVEL  LABEL                    STATUS         CONTRIBUTION
L0     Emergency Override       Not active     —
L1     Constitutional Floor     Not active     —
L2     Network Policy           Not active     —
L3     League/Franchise         Not active     —
L4     Venue Manager Override   ACTIVE ← WIN   Summer Drinks Promo v2
L5     Scheduled Campaign       Active         Weekend Specials Board (suppressed by L4)
L6     Default Content          Active         Standard Drinks Menu (suppressed by L4 + L5)
```

Color coding:
- `ACTIVE ← WIN` row: green background, level text bold
- `Active` rows (not winning): normal background, level text muted
- `Not active` rows: grey background, level text grey

"Suppressed by" text is always present when a lower level is active but not winning. It names the specific overriding level.

#### Override Contributions Per Level

Below the level table, for each level that has an active override, a sub-panel:
```
L4 — Venue Manager Override
  Override ID:    ov-0044
  Placed by:      jane.operator@paddingtonrsl.com.au
  Placed:         2026-05-28 09:14 AEST
  Expires:        2026-06-30 23:59 AEST
  Content:        Summer Drinks Promo v2
```

If no overrides are active at a level, that level has no sub-panel.

#### PRE Divergence Status

```
PRE Divergence Status:  NONE
Last parity check:      2026-06-02 14:35 AEST (12m ago)
Parity ratio:           1.00 (100% of resolution checks match expected output)
```

If divergence is detected:
```
PRE Divergence Status:  DIVERGENCE DETECTED  ⚠
Last parity check:      2026-06-02 14:35 AEST (12m ago)
Parity ratio:           0.87 (87% of resolution checks match expected output)
Diverging checks:       3 of 23 — [View divergence details →]
```

"View divergence details" navigates to the Replay & Forensics surface for this venue.

#### History Chart — PRE Resolution Level Over Time

A 24-hour horizontal timeline chart showing which PRE level was authoritative at each point in time. The X axis is time (last 24h). The Y axis is the resolution level (L0–L6). A horizontal band at each level, colored when that level was winning.

The chart is read-only. No scrubbing or interaction. It updates on each data poll.

Below the chart: a legend mapping level numbers to labels.

If insufficient history data: `Insufficient history data — chart requires at least 1 hour of resolution history.`

---

### Tab 6: Venue History

A complete historical record for this venue. Paginated throughout.

#### Incident History

Table of all incidents ever declared at this venue:

```
SEVERITY   STATUS     DECLARED          RESOLVED           DURATION   ROOT CAUSE
S2         CLOSED     2026-05-14        2026-05-14         2h 14m     Corpus sync failure
S3         CLOSED     2026-04-22        2026-04-22         44m        Override conflict
S4         CLOSED     2026-03-07        2026-03-08         18h 3m     Hardware fault
```

Each row links to the Incident Commander surface for that incident (read-only archive view if closed).

If no incidents: `No incidents recorded for this venue.`

#### Recovery Events

Table of all recovery events:

```
TIMESTAMP             TYPE                  INITIATED BY        STEPS COMPLETED   RESULT
2026-05-14 16:32 AEST Venue Reconnect       system              5/5               SUCCESS
2026-03-07 09:14 AEST Hardware Replacement  admin@platform      5/5               SUCCESS
```

Each row is expandable to show:
- Root cause as recorded
- Each step completed with timestamp
- Time to recovery

#### Machine State History

A full chronological log of all machine state transitions for this venue. Each row:
```
TIMESTAMP                FROM              TO                TRIGGER
2026-06-02 15:23 AEST    SYNCING           LIVE              Corpus sync complete
2026-06-02 15:18 AEST    OFFLINE           SYNCING           Network reconnected
2026-06-02 14:32 AEST    LIVE              OFFLINE           Heartbeat timeout
```

Paginated: 50 per page. Sortable by timestamp (default: newest first).

#### Search and Filter Controls

At the top of the Venue History tab:
- Date range picker: From / To date selectors (default: last 30 days)
- Event type filter: checkboxes for Incidents / Recovery Events / Machine State Transitions / Override Events
- Operator filter: dropdown of all operators who have performed actions at this venue (ADMIN only)
- `Apply Filters` button
- `Clear Filters` link

All filters apply across all sub-sections of the History tab simultaneously.

---

## 5. Zone C — Venue Context Panel

Zone C is a right-side panel, approximately 280px wide, visible at viewport widths ≥1280px. At narrower viewports it collapses and is accessible via a `[Details ▸]` toggle button.

Zone C is persistent across all tabs on the Venue Operations Dashboard.

**Active Incident Shortcut (conditional — when incidents active):**
```
┌──────────────────────────────────────┐
│ ACTIVE INCIDENT                      │
│ S2 — DECLARED                        │
│ Declared 1h 14m ago                  │
│ Commander: alice@operations.com      │
│ [Go to Incident Commander →]         │
└──────────────────────────────────────┘
```
If no active incidents, this panel is absent. If incident data is unavailable, the panel shows:
```
Incident status unavailable
```

**Quick Diagnostics:**
```
Connectivity     CONNECTED ✓
Last heartbeat   23s ago
Clock sync       1.2s delta (within tolerance)
```

If any diagnostic value is degraded, it renders in amber. If DISCONNECTED or failed, it renders in red.

**Corpus Integrity Quick Check:**
```
Corpus hash      VERIFIED ✓
Last check       4h 32m ago
```
If UNVERIFIED or MISMATCH, renders with corresponding amber or red treatment.

**Related Venues:**
A condensed list of other venues in the same network, showing their health grade:
```
Related Venues — Paddington RSL Group
  Sydney CBD RSL         A  ✓
  Pyrmont RSL            B  ⚡
  Glebe RSL              A  ✓
```

Each venue name links to that venue's Venue Operations Dashboard. If the operator does not have access to a venue, it is listed with name only and no link: `[Restricted]`.

If the venue is not part of a network group, this section is absent.

---

## 6. State Variations

### 6.1 LIVE and HEALTHY Venue

**Conditions:** `player_state.machine_state: "LIVE"`, all 7 status dimensions at their best values, no active incidents, `autonomy_status.online: true`.

**Visual state:**
- Machine state badge: green `LIVE`
- All 7 status cards: green left border
- No RECOVERED_BUT_UNTRUSTED banner
- No autonomy clock
- Active incidents indicator: `No active incidents` (green checkmark)
- Zone C diagnostics: all green
- Corpus sync log: latest entries showing SUCCESS

No alerts, warnings, or degraded panels appear. This is the baseline state.

### 6.2 OFFLINE Venue

**Conditions:** `player_state.machine_state: "OFFLINE"`, `autonomy_status.online: false`, heartbeat not received for 3× heartbeat_window.

**Visual state:**
- Machine state badge: slate `OFFLINE`
- CONNECTIVITY card: red left border, value `DISCONNECTED`
- FRESHNESS card: amber or red depending on data age
- Autonomy clock: visible in header, showing time remaining (Section 7)
- Content Delivery tab: pending items show "Delivery blocked — venue offline"

**What is still readable:** All 6 tabs remain fully readable. Status dimensions show their last known values with freshness/age indicators. Historical data is unaffected.

**What requires reconnection:** Content delivery, corpus sync, real-time PRE resolution updates, heartbeat data.

**"Begin Recovery" control:**

When `machine_state: "OFFLINE"` and `connectivity: "DISCONNECTED"`, a persistent banner appears at the top of the Overview tab:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  VENUE OFFLINE — Connectivity lost 6h 14m ago                           │
│  Player is operating autonomously. 47h 23m of autonomy remaining.        │
│                                                                          │
│  [ Begin Recovery Workflow ]                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

OPERATOR and ADMIN roles may begin the recovery workflow. VIEWER sees the banner without the button.

**5-Step Recovery Workflow:**

Clicking "Begin Recovery Workflow" opens a full-screen overlay (not a modal — it occupies Zone B entirely). Zone A remains visible. Zone C collapses.

```
VENUE RECOVERY — Paddington RSL

Step 1 of 5: Confirm Venue Connectivity
─────────────────────────────────────────────────────────────────────
Confirm that the venue network is accessible.

Checklist (operator must check each item):
☐ Venue internet connection is physically active (check router/switch)
☐ Venue is reachable by network ping from the operations centre
☐ No scheduled maintenance window is active for this venue

[ Mark Step 1 Complete ]    [ Cancel Recovery ]
─────────────────────────────────────────────────────────────────────
```

Each step must have all checkboxes ticked before the "Mark Step N Complete" button becomes active. Steps:

**Step 1:** Confirm venue connectivity (network, ping, no maintenance window)
**Step 2:** Confirm player hardware is powered on (power light, display active, no hardware alarm)
**Step 3:** Initiate reconnection (venue player rebooted, heartbeat expected within 5 minutes)
**Step 4:** Verify corpus integrity (monitor this tab — system will auto-run corpus hash check on reconnect)
**Step 5:** Confirm LIVE status (player state transitions to LIVE, corpus VERIFIED — manual confirmation)

Step 4 is system-assisted: the workflow pauses and shows a spinner: `Waiting for corpus verification... (system-automated)`. When corpus hash verification completes, the step auto-advances.

After Step 5: `Recovery complete. Venue is now LIVE and HEALTHY.` — workflow overlay closes, dashboard returns to normal view.

Audit event on completion: `venue:recovery:workflow-completed`

### 6.3 DEGRADED Venue

**Conditions:** `player_state.machine_state: "DEGRADED"`. Player is functional but one or more subsystems are outside normal bounds.

**Visual state:**
- Machine state badge: amber `DEGRADED`
- The specific failing dimension cards show amber or red treatment
- Each failing card's basis section shows the specific signal causing degradation: e.g., `Storage: 91% full (threshold: 85%)`

**What the operator can do:** Trigger reassessment (OPERATOR+) on any status dimension by clicking a `↻ Re-assess` control that appears on each card. The control triggers a fresh computation cycle and shows a spinner. The result replaces the current value within the configured assessment_timeout (default: 120s). The reassessment trigger is audit-logged.

**What is system-computed:** The operator cannot set any status value. Re-assessment runs the computation — if the underlying signal is still failing, the status remains DEGRADED after re-assessment.

### 6.4 RECOVERED_BUT_UNTRUSTED — Complete Specification

See Section 8 for complete UX specification. Summary of visual elements:

- Machine state badge: shows the actual machine state (typically LIVE), but the RECOVERED_BUT_UNTRUSTED banner is the dominant element on Tab 1
- TRUST card: `UNTRUSTED` with red treatment
- INTEGRITY card: `UNVERIFIED` with amber treatment
- READINESS card: `ASSESSING` with blue pulsing treatment
- The RECOVERED_BUT_UNTRUSTED banner is visible on Tab 1 and persists as a Zone C indicator

### 6.5 INCIDENT State

**Conditions:** `player_state.machine_state: "INCIDENT"`.

**Visual state:**
- Machine state badge: red `INCIDENT`
- Active incidents indicator on Tab 1: prominent, with incident severity and link
- Zone A: active incident shortcut panel appears
- Zone C: active incident shortcut panel appears

**What changes on the overview when incident is declared:**
- The machine state history strip shows the transition to INCIDENT with timestamp
- The HEALTH card transitions to `CRITICAL` or `FAILED` depending on the incident severity
- An amber bar appears below the status dashboard: `Incident declared — this venue's health data reflects incident conditions`

**This surface does not declare incidents.** An operator who needs to declare an incident navigates to the Incident Commander surface. There is no "Declare Incident" button on the Venue Operations Dashboard.

### 6.6 EMERGENCY_FREEZE

**Conditions:** `constitutional_state.state: "EMERGENCY_FREEZE"` received in API response.

**Visual state:**
- A persistent full-width red banner appears at the top of the entire page (above the header): `EMERGENCY FREEZE — All configuration changes are suspended`
- All write controls become disabled (not absent — disabled with explanation)
- Disabled control tooltip: `Unavailable during Emergency Freeze`
- The following controls are specifically disabled: Remove Override, Enroll New Screen, Remove Screen, Request Manual Sync, Begin Recovery Workflow, ↻ Re-assess (status reassessment)

**What remains visible:** All tabs remain accessible. All data remains readable. The status dashboard, screen list, corpus sync log, override history, PRE resolution, and venue history all remain navigable and readable.

**What is read-only:** Everything. No writes are accepted during EMERGENCY_FREEZE.

**Navigation restrictions:** No navigation restrictions. Operators may browse all tabs freely. They may navigate to the Incident Commander surface. They may not perform any write actions on any surface during EMERGENCY_FREEZE.

---

## 7. The 72-Hour Autonomy Clock — Complete Specification

The 72-hour autonomy clock represents the time remaining until the venue player cannot guarantee content correctness without a corpus sync from the platform. It counts down from 72 hours at the moment connectivity is lost.

### Where It Appears

1. **Venue Identity Header** (Section 2, right section) — when `autonomy_status.online: false`
2. **Tab 1 — Overview** — CONNECTIVITY card basis section: `In autonomous operation for [N]h [M]m — [remaining]h [M]m remaining`
3. **Tab 3 — Content Delivery** — corpus status panel below the main corpus hash: `Autonomous operation: [remaining] remaining`
4. **Zone C — Quick Diagnostics** — a single line below connectivity: `Autonomy: [remaining] remaining`

### What Time It Counts

The clock counts: `72h - offline_duration`. It shows time remaining until the 72-hour autonomy window closes.

The value is computed by the backend: `autonomy_status.autonomy_remaining_hours`. The frontend must not independently compute this from `offline_duration_ms`. The backend value is authoritative.

### Color Progression

| Autonomy remaining | Clock color | Background | Additional indicator |
|---|---|---|---|
| >48h | Green (#22c55e) | Transparent | None |
| 24h–48h | Amber (#f59e0b) | Transparent | None |
| 6h–24h | Red (#ef4444) | Light red tint (#fef2f2) | `Autonomy low` label |
| <6h | Red (#ef4444) bold | Red tint, pulsing border | `AUTONOMY CRITICAL` label + notification generated |

The pulsing border animation on <6h is a 2-second on/off pulse (opacity 1.0 → 0.5 → 1.0).

### Clock Display Format

Always displayed as `NNh NNm remaining`. Examples:
- `71h 58m remaining`
- `47h 23m remaining`
- `5h 44m remaining`
- `0h 12m remaining`

Never display in decimal hours (not `5.7h remaining`). Never display only hours when minutes are available.

### When Venue Reconnects

When `autonomy_status.online` transitions from `false` to `true`:
- All autonomy clock instances disappear from the UI within one poll cycle (maximum 15 seconds)
- The header right section reverts to `Last corpus sync: [time]`
- The corpus status panel shows the reconnection sync event
- No "reconnected" celebration message — the machine state badge transitioning to SYNCING then LIVE is the signal

### When 72h Is Exceeded

When `autonomy_remaining_hours` reaches 0 or becomes negative, the clock is replaced by a critical alert panel on Tab 1 (above the status dashboard):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AUTONOMY WINDOW EXCEEDED                                   CRITICAL ⚠  │
│                                                                          │
│  This venue has been offline for more than 72 hours.                     │
│  Content correctness beyond this window is not guaranteed.               │
│  Manual intervention is required.                                        │
│                                                                          │
│  Offline since:    2026-05-31 14:32 AEST  (74h 12m ago)                │
│  Autonomy corpus:  vn-0042-corpus-v31  (last verified 74h ago)          │
│                                                                          │
│  [ Begin Recovery Workflow ]  ← OPERATOR / ADMIN only                  │
└──────────────────────────────────────────────────────────────────────────┘
```

The autonomy clock widget itself is removed and replaced by this panel. The phrase "remaining" is never shown when autonomy is exceeded — the exceeded panel replaces it entirely.

---

## 8. RECOVERED_BUT_UNTRUSTED Protocol — Complete UX Specification

RECOVERED_BUT_UNTRUSTED is a named protocol state. It is not a generic "loading" or "verifying" indicator. It has a distinct banner, distinct status card treatments, and a distinct resolution path.

### Entry into RECOVERED_BUT_UNTRUSTED

**Trigger:** Venue transitions from DISCONNECTED connectivity to CONNECTED or INTERMITTENT. At the moment of reconnection, before corpus hash verification is complete, the venue enters RECOVERED_BUT_UNTRUSTED.

**API signals:**
- `player_state` carries `flags: ["RECOVERED_BUT_UNTRUSTED"]`
- `corpus_status.hash_verified: false`
- `player_state.constitutional_state.state` may be any value but trust status is UNTRUSTED

**Audit event written at entry:** `RECOVERED_BUT_UNTRUSTED_ENTRY` with `venue_id`, `disconnected_since`, `reconnected_at`, `verification_steps_pending[]`

### Duration of this State

From reconnection until corpus hash verification completes (hash confirmed VERIFIED) AND heartbeat freshness = CURRENT AND clock sync delta within drift_tolerance.

During this period the player continues serving content — the 72h autonomy corpus is trusted for playback continuity. Content delivery is not interrupted.

### Primary Visual Element — RECOVERED_BUT_UNTRUSTED Banner

This banner appears on Tab 1 (Overview), between the status dashboard and the active incidents indicator. It is a full-width panel with amber background and left amber border.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  RECOVERED — VERIFICATION PENDING                                        │
│                                                                          │
│  This venue has reconnected but corpus integrity has not yet been        │
│  verified. Content continues to be served from the autonomy corpus.      │
│  This venue is NOT counted as HEALTHY until verification completes.      │
│                                                                          │
│  Reconnected at:   2026-06-02 15:18 AEST (5m ago)                      │
│  Verification:     Corpus hash check in progress...  ●●●               │
│                                                                          │
│  Steps remaining:                                                        │
│  ✓ Heartbeat received (CURRENT)                                         │
│  ✗ Corpus hash not yet verified                                         │
│  ✗ Clock sync confirmation pending                                      │
│                                                                          │
│  [ Request Re-Verification ]  ← OPERATOR / ADMIN only                  │
└──────────────────────────────────────────────────────────────────────────┘
```

The three dots `●●●` in "Verification: in progress..." are animated (scrolling left to right, 1-second interval).

The steps remaining list uses ✓ (green) for completed conditions and ✗ (grey, not red — these are not failures, they are pending) for conditions not yet confirmed.

**"Request Re-Verification" control:**
- OPERATOR and ADMIN roles: button is present and active
- VIEWER role: button is absent from the DOM
- Clicking shows confirmation: `Request an immediate corpus re-verification for this venue? This will trigger a fresh hash check.`
- On confirm: button enters loading state, spinner replaces the animated dots
- Audit event: `venue:corpus:re-verification-requested`

### Status Card Changes During RECOVERED_BUT_UNTRUSTED

The following status cards change from their pre-reconnection values:

**TRUST card:**
- Value: `UNTRUSTED`
- Red left border
- Basis: `Venue reconnected — corpus hash verification pending. Trust will be restored when verification completes.`
- Confidence: MEDIUM (reconnection confirmed, but verification outstanding)

**INTEGRITY card:**
- Value: `UNVERIFIED`
- Amber left border
- Basis: `Hash check initiated at reconnection — awaiting result`

**READINESS card:**
- Value: `ASSESSING`
- Blue left border, pulsing animation
- Basis:
  ```
  ✓ Player state: LIVE
  ✗ Corpus hash: Not yet verified
  ✓ Clock sync: 1.2s delta (within tolerance)
  ✓ Heartbeat: CURRENT
  ```

**CONNECTIVITY card:**
- Value: `CONNECTED`
- Green left border (connectivity is restored)
- Note: CONNECTIVITY returns to green at reconnection. TRUST and INTEGRITY remain degraded until verification completes. These are orthogonal dimensions.

**HEALTH card:**
- Value depends on underlying signals. If all health signals are within bounds, HEALTH may be HEALTHY even during RECOVERED_BUT_UNTRUSTED. HEALTH is not automatically degraded by the RECOVERED_BUT_UNTRUSTED state — it reflects the monitored system conditions independently.

### PRE Resolution Implications During RECOVERED_BUT_UNTRUSTED

The PRE Resolution State tab (Tab 5) shows an additional indicator in the current resolution panel:

```
⚠ RECOVERED_BUT_UNTRUSTED — PRE resolutions are flagged UNTRUSTED_INPUT
   Resolution outputs during this period are recorded with reduced confidence.
   This flag will clear when corpus verification completes.
```

The level-by-level breakdown continues to show normally. The warning does not suppress the resolution data.

### Corpus Hash Mismatch vs Not-Yet-Verified

These are two distinct conditions. The UI must distinguish them clearly.

**Not-yet-verified (UNVERIFIED):**
- INTEGRITY card: `UNVERIFIED` in amber
- Banner text: `Corpus hash check in progress...`
- RECOVERED_BUT_UNTRUSTED banner: visible (amber)
- "Request Re-Verification" button: present

**Hash mismatch (MISMATCH):**
- INTEGRITY card: `MISMATCH ✗` in red (red all-sides border)
- Banner changes to:
```
┌──────────────────────────────────────────────────────────────────────────┐
│  CORPUS INTEGRITY FAILURE                                    CRITICAL ⚠ │
│                                                                          │
│  This venue has reconnected but the corpus hash does not match.          │
│  Content being served may not match the platform-approved corpus.        │
│                                                                          │
│  Computed hash:  a3f9c21b...d445ee18                                    │
│  Expected hash:  9f12e3aa...8b21cc04                                    │
│  Mismatch detected at: 2026-06-02 15:23 AEST                           │
│                                                                          │
│  This venue is NOT counted as HEALTHY and NOT counted as TRUSTED.        │
│  Operator acknowledgement required before this venue contributes         │
│  to fleet-level decisions.                                               │
│                                                                          │
│  [ Acknowledge and Investigate ]  ← ADMIN only                         │
└──────────────────────────────────────────────────────────────────────────┘
```

The "Acknowledge and Investigate" button is ADMIN only. OPERATOR sees the banner but cannot acknowledge. Clicking navigates to the Replay & Forensics surface with the venue and the mismatch timestamp pre-selected.

### Exit from RECOVERED_BUT_UNTRUSTED

**Exit: successful verification:**
- API delivers `corpus_status.hash_verified: true`, `corpus_status.hash_match: true`
- `player_state` flags no longer include `RECOVERED_BUT_UNTRUSTED`
- RECOVERED_BUT_UNTRUSTED banner disappears
- TRUST card transitions to `TRUSTED` (green)
- INTEGRITY card transitions to `VERIFIED` (green)
- READINESS card transitions from `ASSESSING` to `READY` (or `PARTIALLY_READY` if other conditions remain unmet)
- Audit event: `VERIFICATION_COMPLETE` with result `VERIFIED`
- No "congratulations" message — the status cards returning to green is the signal

**Exit: failed verification (hash mismatch):**
- Banner transitions to the CORPUS INTEGRITY FAILURE variant (above)
- Venue remains NOT_READY
- ADMIN acknowledgement required
- Audit event: `VERIFICATION_COMPLETE` with result `MISMATCH`

### Additional UI Elements That Change During RECOVERED_BUT_UNTRUSTED

1. **Venue Identity Header:** Machine state badge shows current machine state (e.g., `LIVE`), but a smaller secondary badge `UNTRUSTED` appears immediately below in amber
2. **Zone C Quick Diagnostics:** Connectivity shows `CONNECTED ✓` but adds a new row: `Corpus integrity: UNVERIFIED ⚠`
3. **Tab 3 — Content Delivery corpus status panel:** Hash status shows `UNVERIFIED` in amber, not `VERIFIED`
4. **Tab 5 — PRE Resolution:** Warning indicator present (described above)
5. **Zone A Active Incident Shortcut:** If no active incident, a non-incident status note appears: `Corpus verification pending — venue UNTRUSTED`

---

## 9. Interactive Controls — Complete Inventory

| Control Label | Location | Role Required | System State Required | Confirmation Required | Audit Event |
|---|---|---|---|---|---|
| `← All Venues` | Zone A top | Any | Any | No | None |
| `↻ Re-assess` (per status dimension) | Tab 1 status card | OPERATOR | Any except EMERGENCY_FREEZE | No | `venue:status:reassessment-triggered` |
| `View in Incident Commander →` | Tab 1 active incidents | Any | Active incident exists | No | None |
| `Manage overrides →` | Tab 1 override summary | Any | Any | No | None |
| `+ Enroll New Screen` | Tab 2 screen list | ADMIN | Any except EMERGENCY_FREEZE | Via 3-step modal | `venue:screen:enrolled` |
| `Remove Screen` (overflow menu) | Tab 2 screen row | ADMIN | Any except EMERGENCY_FREEZE | Yes — type screen name | `venue:screen:removed` |
| `View this screen's content history` | Tab 2 screen expand | Any | Any | No | None |
| `Request Manual Sync` | Tab 3 corpus panel | ADMIN | Any except EMERGENCY_FREEZE | Yes — 1-click confirm | `venue:corpus:manual-sync-requested` |
| `Remove Override` | Tab 4 override card | Level-dependent (see Tab 4) | Any except EMERGENCY_FREEZE | No (immediate) | `venue:override:removed` |
| `View divergence details →` | Tab 5 PRE divergence | Any | Divergence detected | No | None |
| `Go to Incident Commander →` | Zone A / Zone C | Any | Active incident exists | No | None |
| `Begin Recovery Workflow` | Tab 1 offline banner | OPERATOR / ADMIN | OFFLINE / DISCONNECTED | No (workflow guides) | `venue:recovery:workflow-started` |
| `Mark Step N Complete` | Recovery workflow overlay | OPERATOR / ADMIN | Recovery workflow active | All checklist items ticked | `venue:recovery:step-completed` |
| `Cancel Recovery` | Recovery workflow overlay | OPERATOR / ADMIN | Recovery workflow active | Yes — confirm cancel | `venue:recovery:workflow-cancelled` |
| `Request Re-Verification` | RECOVERED_BUT_UNTRUSTED banner | OPERATOR / ADMIN | RECOVERED_BUT_UNTRUSTED | Yes — 1-click confirm | `venue:corpus:re-verification-requested` |
| `Acknowledge and Investigate` | CORPUS INTEGRITY FAILURE banner | ADMIN | MISMATCH integrity | No | `venue:corpus:mismatch-acknowledged` |
| Apply Filters | Tab 6 filter bar | Any | Any | No | None |
| Clear Filters | Tab 6 filter bar | Any | Any | No | None |

Controls that are absent from the DOM (not disabled) when the operator lacks role authority:
- `+ Enroll New Screen` — absent for OPERATOR and VIEWER
- `Remove Screen` — absent for OPERATOR and VIEWER
- `Request Manual Sync` — absent for OPERATOR and VIEWER
- `Remove Override` at levels requiring ADMIN — absent for OPERATOR
- `Request Re-Verification` — absent for VIEWER
- `Acknowledge and Investigate` — absent for OPERATOR and VIEWER

Controls that are disabled (visible, not activatable) during EMERGENCY_FREEZE:
- `↻ Re-assess` — disabled, tooltip: `Unavailable during Emergency Freeze`
- `+ Enroll New Screen` — disabled, tooltip: `Unavailable during Emergency Freeze`
- `Remove Screen` — disabled
- `Request Manual Sync` — disabled
- `Remove Override` — disabled
- `Begin Recovery Workflow` — disabled
- `Request Re-Verification` — disabled

---

## 10. Audit Events Emitted

All audit events are in `{domain}:{entity}:{action}` format. All events carry `governed_timestamp`, `operator_id`, and `venue_id`.

| Event | Trigger | Required fields |
|---|---|---|
| `venue:status:reassessment-triggered` | Operator clicks ↻ Re-assess on any status dimension | `dimension`, `prior_value`, `result_value`, `result_confidence` |
| `venue:screen:enrolled` | Screen enrollment modal completed | `screen_name`, `device_id`, `enrolled_by` |
| `venue:screen:removed` | Screen removal confirmed | `screen_name`, `device_id`, `removed_by` |
| `venue:corpus:manual-sync-requested` | ADMIN clicks Request Manual Sync | `requested_by`, `prior_corpus_hash` |
| `venue:corpus:re-verification-requested` | Operator clicks Request Re-Verification | `requested_by`, `current_hash_status` |
| `venue:corpus:mismatch-acknowledged` | ADMIN acknowledges hash mismatch | `acknowledged_by`, `computed_hash`, `expected_hash` |
| `venue:override:removed` | Operator removes an override | `override_id`, `level`, `removed_by`, `override_age_hours` |
| `venue:recovery:workflow-started` | Operator clicks Begin Recovery Workflow | `initiated_by` |
| `venue:recovery:step-completed` | Operator marks a recovery step complete | `step_number`, `completed_by`, `checklist_items[]` |
| `venue:recovery:workflow-cancelled` | Operator cancels recovery workflow | `cancelled_by`, `steps_completed` |
| `venue:recovery:workflow-completed` | Recovery workflow Step 5 confirmed | `completed_by`, `time_to_recovery_minutes` |
| `venue:page:viewed` | Operator navigates to any venue tab | `tab_name`, `viewed_by` |
| `venue:investigation:navigated` | Operator clicks "View divergence details" | `navigated_by`, `target_surface` |

All events are append-only and immutable. No event in the `venue:*` domain may be modified or deleted after write.

---

## 11. Forbidden Patterns

The following behaviors are constitutionally prohibited on this surface. Each prohibition is followed by the rule it enforces.

**F-01: No operator-set health, trust, readiness, connectivity, or integrity values.**
Operators trigger reassessment. They do not set values. There is no control on any tab that accepts operator input to set a status dimension to a specific value. (Enforces OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md Ownership and Authority)

**F-02: UNKNOWN status must never be displayed as neutral or reassuring.**
UNKNOWN status cards use grey treatment and the text `Signal unavailable`. UNKNOWN is never styled with green or in a way that appears normal. (Enforces Rule H-03, Rule T-04)

**F-03: Absent incident data must not infer "no active incidents".**
If `active_incidents` is absent from the API response, the surface renders `Incident status unavailable`. The text "No active incidents" appears only when `active_incidents.incidents` is an empty array — not when the data object is absent. (Enforces FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md Rule DG-01)

**F-04: No direct content delivery from this surface.**
Content delivery is managed from the CMS surface. There is no control on the Venue Operations Dashboard that pushes content directly to screens. The "Request Manual Sync" control requests a sync — it does not select or push content.

**F-05: No direct incident declaration from this surface.**
Incidents are declared from the Incident Commander surface. There is no "Declare Incident" button on the Venue Operations Dashboard. The surface links to the Incident Commander surface; it does not host incident management controls.

**F-06: RECOVERED_BUT_UNTRUSTED venues must not be shown as HEALTHY.**
While a venue is in RECOVERED_BUT_UNTRUSTED state, the surface must not display language implying the venue is recovered, healthy, or trusted. The status cards and banner must reflect the actual state. (Enforces OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md §TI-05)

**F-07: Corpus hash must not show VERIFIED when hash_verified is false.**
If `corpus_status.hash_verified: false`, the corpus status panel shows `UNVERIFIED`. If `corpus_status` is absent, it shows `UNKNOWN`. The word `VERIFIED` appears only when `hash_verified: true` AND `hash_match: true`. (Enforces FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md degraded rendering rules)

**F-08: Trust indicators are never optional.**
Every component rendering operational status data checks `_trust_level` and renders the appropriate indicator. UNTRUSTED data is displayed with a red indicator and inline warning, not suppressed. (Enforces FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md Rule TM-01)

**F-09: Venue URLs must never become invalid.**
The route `/venues/:venue_id` must always resolve to a valid page. Decommissioned venues render a read-only archive view. 404 responses for venue_id routes are a constitutional violation.

**F-10: Confidence level must always accompany status values.**
HEALTHY with LOW confidence and HEALTHY with HIGH confidence must use different visual treatments. No status value is rendered without its accompanying confidence indicator. (Enforces OPERATIONAL-STATUS-AND-TRUST-MODEL-v1.md Rule C-02, Rule C-03)

---

*End of CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md*
*Document authority: Agent 3 (UX/Design)*
*Status dimension computation: Agent 1 (Platform) requirement*
*Override and PRE resolution APIs: Agent 2 (CMS) design requirement*
*Frontend implementation: consumed by frontend engineering team*
