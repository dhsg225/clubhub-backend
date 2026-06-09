# Frontend Data Contract Requirements — v1

**Document type:** Implementation-grade architecture specification
**Audience:** Frontend engineering team and backend API team
**Status:** Authoritative — do not deviate without architectural review
**Scope:** All data shapes, metadata requirements, real-time contracts, authority metadata, and degraded-state rendering rules that the frontend requires from backend APIs

---

## Definitions

**Data contract:** A binding specification of the shape, metadata, and behavioral requirements of data exchanged between the frontend and backend. This document specifies what the frontend requires — it is not an API design document.

**Governed timestamp:** A timestamp originating from the backend time authority. Frontend-generated timestamps (e.g., `Date.now()`) must not be used as governed timestamps.

**Freshness:** The age of data relative to its source. Freshness is computed by the backend, not inferred by the frontend from `_fetched_at`.

**Trust level:** The backend's assessment of whether the data is from a reliable source and has not been compromised. Trust is separate from freshness.

**Degraded rendering:** A defined fallback display when required data is absent or untrusted, always more conservative than the normal display.

**REPLAY mode:** Active when the frontend is displaying an investigation session with `_replay: true`. All data consumed in REPLAY mode must carry this flag; data without it must not be rendered in a REPLAY context.

**Simulation mode:** Active when the frontend is in the Training Workspace. All data consumed in simulation mode must carry `_simulation: true`.

---

## Global Data Requirements

The following objects must be present on every authenticated API response. The frontend must treat any authenticated response without these objects as a degraded response and render accordingly.

### Constitutional State Object

**Required on:** Every authenticated API response.

```
ConstitutionalState {
  state:        "HEALTHY" | "DEGRADED" | "CONSTITUTIONAL_RISK" | "SHADOW_ONLY"
              | "PRE_DISABLED" | "READ_ONLY" | "EMERGENCY_FREEZE"
  confidence:   "HIGH" | "MEDIUM" | "LOW" | "NONE"
  basis:        string[]          // signals contributing to this state assessment
  computed_at:  governed_timestamp
  freshness:    "CURRENT" | "STALE" | "EXPIRED"
}
```

**Frontend rendering contract:**
- `confidence` must always be rendered alongside `state`. They are never displayed separately.
- If `ConstitutionalState` is absent from a response: render `SystemStatusBar` with `state: UNKNOWN`, `confidence: NONE`, and display "Constitutional state unavailable" in a degraded style. Do not render a previous state as if it were current.
- If `freshness` is `STALE`: amber confidence dot on the indicator.
- If `freshness` is `EXPIRED`: explicit text "State data expired" visible without user interaction.

**Update mechanism:** Delivered via WebSocket push. Maximum staleness in LIVE mode: 5 seconds. If the WebSocket connection is lost, the constitutional state freshness transitions to STALE after 5 seconds and EXPIRED after 30 seconds.

---

### Session Context Object

**Required on:** Every authenticated API response.

```
SessionContext {
  operator_id:          string
  role:                 "VIEWER" | "OPERATOR" | "ADMIN"
  session_start:        governed_timestamp
  elevation_active:     boolean
  elevation_expires_at: governed_timestamp | null   // null if elevation_active is false
  certification_level:  "L1" | "L2" | "L3" | "L4"
  assigned_venue_ids:   string[]
  default_route:        string                      // computed redirect target for /
}
```

**Frontend rendering contract:**
- `elevation_active` and `elevation_expires_at` are checked by action surface components before rendering L6 controls.
- `assigned_venue_ids` determines which venues appear in Zone A Pane A1.
- `default_route` is read once on authentication; the frontend does not recompute it.
- If `SessionContext` is absent: redirect to `/login`. Do not attempt to infer session context from cached state.

**Elevation expiry contract:**
When `elevation_active: true`, the frontend displays a countdown derived from `elevation_expires_at` (using the server-provided governed timestamp, not `Date.now()`). When the expiry time is reached according to the server clock, the session provider requests a session refresh. If the refreshed session returns `elevation_active: false`, L6 controls are suppressed immediately.

---

### Freshness Metadata

**Required on:** Every data object returned by the API.

```
FreshnessMetadata {
  _fetched_at: governed_timestamp   // when this data was retrieved from its source
  _freshness:  "CURRENT" | "STALE" | "EXPIRED" | "UNKNOWN"
  _trust:      "TRUSTED" | "DEGRADED_TRUST" | "UNTRUSTED" | "UNKNOWN"
}
```

**Frontend rules:**
- `_fetched_at` is the governed timestamp from the server, not the time the HTTP response arrived at the client.
- `_freshness` is computed by the backend. The frontend must not override or recompute it.
- If any of these fields are absent from a data object, the frontend must treat the object as `_freshness: UNKNOWN` and `_trust: UNKNOWN`.

---

## Venue Operations Dashboard — Data Requirements

### Required Data

The following fields must be present for the Venue Operations Dashboard to render its primary sections. Absence of required fields produces the degraded behavior defined below.

**`venue_identity`**
```
VenueIdentity {
  venue_id:           string
  name:               string
  location:           string
  installation_type:  string
  ...FreshnessMetadata
}
```

**`player_state`**
```
PlayerState {
  machine_state:      "INITIALIZING" | "SYNCING" | "LIVE" | "INCIDENT"
                    | "OFFLINE" | "DEGRADED"
  constitutional_state: ConstitutionalState
  last_heartbeat_at:  governed_timestamp
  heartbeat_freshness: "CURRENT" | "STALE" | "EXPIRED"
  ...FreshnessMetadata
}
```

**`autonomy_status`**
```
AutonomyStatus {
  online:                    boolean
  offline_duration_ms:       number | null        // null if online: true
  autonomy_remaining_hours:  number | null        // null if offline duration < 1h
  autonomy_basis:            string               // which corpus version is sustaining autonomy
  ...FreshnessMetadata
}
```

**`pre_resolution`**
```
PREResolution {
  level:              "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  effective_content:  string                // content_ref of the winning entry
  winner_id:          string
  resolution_path:    ResolutionPathEntry[] // ordered list of evaluated levels
  governed_timestamp: governed_timestamp
  ...FreshnessMetadata
}

ResolutionPathEntry {
  level:      "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  evaluated:  boolean
  won:        boolean
  reason:     string | null   // why this level won or was passed over
}
```

**`override_stack`**
```
OverrideStack {
  venue_id:   string
  entries:    OverrideEntry[]
  ...FreshnessMetadata
}

OverrideEntry {
  override_id:      string
  level:            "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  content_ref:      string
  placed_by:        string
  placed_at:        governed_timestamp
  expires_at:       governed_timestamp
  approval_status:  "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
}
```

**`corpus_status`**
```
CorpusStatus {
  last_sync_at:    governed_timestamp
  corpus_hash:     string
  hash_verified:   boolean
  hash_match:      boolean | null   // null if hash_verified is false
  ...FreshnessMetadata
}
```

**`active_incidents`**
```
ActiveIncidents {
  venue_id:   string
  incidents:  IncidentSummary[]
  ...FreshnessMetadata
}

IncidentSummary {
  incident_id:    string
  severity:       "S1" | "S2" | "S3" | "S4" | "S5"
  current_state:  "WATCHING" | "DECLARED" | "CONTAINED"
  declared_at:    governed_timestamp
  commander_id:   string | null
}
```

### Optional Data

The following data enriches the dashboard but its absence must not prevent rendering.

**`recent_pre_history`**: Last 10 `PREResolution` objects, ordered by `governed_timestamp` descending. Used for the Venue Timeline section.

**`recovery_workflow_state`**: Present only if a recovery workflow is active for this venue.
```
RecoveryWorkflowState {
  workflow_id:        string
  current_step:       1 | 2 | 3 | 4 | 5
  step_completions:   StepCompletion[]
  initiated_by:       string
  initiated_at:       governed_timestamp
}
```

### Degraded Rendering Rules

| Data field | Absent or expired | Rendering |
|---|---|---|
| `pre_resolution` | Absent | "PRE resolution unavailable — last known: [effective_content] at [age]" in amber |
| `pre_resolution._freshness` | EXPIRED | "PRE data expired ([age])" with red border on the PRE section |
| `player_state` | Absent | "Player state unknown" with UNKNOWN trust treatment (grey, not neutral) |
| `corpus_status` | Absent | "Corpus status: UNKNOWN — not verified" (not "VERIFIED") |
| `corpus_status.hash_verified` | false | "Hash not verified" — never render as "VERIFIED" |
| `active_incidents` | Absent | "Incident status unavailable" — do not infer no active incidents |

**Rule DG-01: Absent data is never inferred as good news**
Approved: If `active_incidents` is absent, render "Incident status unavailable."
Forbidden: If `active_incidents` is absent, rendering "No active incidents."
Operational consequence: Operators who see "No active incidents" when the data is unavailable may fail to investigate a venue that is experiencing an active incident.
Verification: Remove `active_incidents` from the mock response; confirm the dashboard renders the unavailable state, not the "no incidents" state.

---

## Incident Commander Surface — Data Requirements

### Required Data

**`incident`**
```
Incident {
  incident_id:     string
  declared_at:     governed_timestamp
  declared_by:     string
  severity:        "S1" | "S2" | "S3" | "S4" | "S5"
  current_state:   "WATCHING" | "DECLARED" | "CONTAINED" | "RESOLVED" | "CLOSED"
  scope_id:        string      // venue_id or fleet scope identifier
  commander_id:    string | null
  ...FreshnessMetadata
}
```

**`incident_log`**
```
IncidentLog {
  incident_id:  string
  entries:      IncidentLogEntry[]
  ...FreshnessMetadata
}

IncidentLogEntry {
  entry_id:           string
  entry_type:         "STATE_TRANSITION" | "ANNOTATION" | "RECOVERY_STEP" | "COMMANDER_CHANGE"
  authored_by:        string
  governed_timestamp: governed_timestamp
  content:            string
  previous_state:     string | null
  new_state:          string | null
}
```

**`blast_radius`**
```
BlastRadius {
  incident_id:      string
  affected_venues:  AffectedVenue[]
  ...FreshnessMetadata
}

AffectedVenue {
  venue_id:         string
  name:             string
  player_state:     PlayerState
  pre_resolution:   PREResolution
  containment_status: "AFFECTED" | "CONTAINED" | "CLEAR"
}
```

**`pre_trace`**
Full `PREResolution` object for the incident scope at current time.

**`command_status`**
```
CommandStatus {
  incident_id:      string
  commander_id:     string | null
  commander_since:  governed_timestamp | null
  lapsed:           boolean
  lapsed_at:        governed_timestamp | null
  ...FreshnessMetadata
}
```

**`recovery_actions`**
```
RecoveryActions {
  incident_id:    string
  active_steps:   RecoveryWorkflowState | null   // null if no recovery workflow active
  ...FreshnessMetadata
}
```

### Optional Data

**`linked_investigations`**: Investigation sessions linked to this incident.
**`correlated_incidents`**: Other active incidents sharing `correlation_id` with this incident.

### Real-Time Requirements

| Data field | Update mechanism | Maximum latency | Fallback behavior |
|---|---|---|---|
| `incident_log` | WebSocket push | 2 seconds | Poll at 10s; display "Live updates paused — polling" banner |
| `blast_radius` venue states | WebSocket push | 10 seconds | Poll at 15s |
| `command_status` | WebSocket push | 5 seconds | Poll at 10s |
| `incident.current_state` | WebSocket push | 5 seconds | Poll at 10s |

**COMMANDER_LAPSED contract:**
When `command_status.lapsed` transitions to `true`, the frontend must render the COMMANDER_LAPSED indicator within 5 seconds of the session expiry governed timestamp. Polling cannot meet this requirement. WebSocket delivery is required.

**WebSocket loss contract:**
When the WebSocket connection is lost during an active incident:
1. Render a persistent banner: "Live updates paused — last update [age ago]"
2. Begin polling at 10-second intervals for all incident data
3. Display the age of each data object using `_fetched_at`
4. Restore WebSocket subscription on reconnection; discard poll interval

---

## Replay & Forensics Workspace — Data Requirements

### Required Data

**`session`**
```
InvestigationSession {
  investigation_id:         string
  venue_id:                 string
  time_range_start:         governed_timestamp
  time_range_end:           governed_timestamp
  session_type:             "MANUAL" | "INCIDENT_LINKED" | "AUTOMATED"
  opened_by:                string
  status:                   "OPEN" | "CLOSED" | "ARCHIVED"
  counterfactual_capability: boolean
  _replay:                  true   // MUST be present; session must be rejected if absent
  ...FreshnessMetadata
}
```

**`corpus_timeline`**
```
CorpusTimeline {
  session_id:   string
  events:       CorpusEvent[]
  ...FreshnessMetadata
}

CorpusEvent {
  event_id:         string
  event_type:       string
  governed_timestamp: governed_timestamp
  actor:            string
  payload_summary:  string
}
```

**`pre_traces`**
Array of `PREResolution` objects, one per resolution event in the time range. Each must include the full `resolution_path`.

**`annotations`**
```
Annotation {
  annotation_id:  string
  authored_by:    string
  authored_at:    governed_timestamp
  anchored_to:    string    // event_id or governed_timestamp
  text:           string
  confidence:     "HIGH" | "MEDIUM" | "LOW"
}
```

**`findings`**
```
Finding {
  finding_id:     string
  authored_by:    string
  authored_at:    governed_timestamp
  finding_type:   string
  summary:        string
  evidence_refs:  string[]
}
```

### Per-Tab Data Requirements

| Tab | URL identifier | Required data | Optional data | Absent behavior |
|---|---|---|---|---|
| 1 | `pre-resolution-trace` | `pre_traces[]` with full `resolution_path` | — | "PRE resolution data unavailable for this time range" |
| 2 | `state-machine` | `machine_transitions[]` | — | "State machine data unavailable" |
| 3 | `override-stack` | `override_history[]` | — | "Override history unavailable" |
| 4 | `corpus-evidence` | `corpus_entries[]` with hash chain | — | "Corpus evidence unavailable" |
| 5 | `divergence-comparison` | `divergence_report` | — | Tab disabled (not absent), label "Divergence data unavailable" |
| 6 | `counterfactual` | `counterfactual_capability: true` in session; ADMIN role | Results loaded on demand | Tab absent from DOM for non-ADMIN |

**`machine_transitions[]`**
```
MachineTransition {
  machine_id:         string
  machine_type:       string
  from_state:         string
  to_state:           string
  governed_timestamp: governed_timestamp
  trigger:            string
  actor:              string | null
}
```

**`override_history[]`**
```
OverrideHistoryEntry {
  override_id:        string
  level:              "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  content_ref:        string
  placed_by:          string
  placed_at:          governed_timestamp
  expires_at:         governed_timestamp
  was_active_at:      governed_timestamp[]   // timestamps when this override was the effective override
}
```

**`corpus_entries[]`**
```
CorpusEntry {
  entry_id:           string
  entry_type:         string
  governed_timestamp: governed_timestamp
  hash:               string
  previous_hash:      string | null   // null for first entry
  content_summary:    string
}
```

**`divergence_report`**
```
DivergenceReport {
  session_id:          string
  original_output:     PREResolution
  replay_output:       PREResolution
  divergence_detected: boolean
  divergence_details:  string | null
}
```

### REPLAY Mode Data Contract

**Rule RM-01: All replay data must be stamped**
Every data object returned for a replay session must include `_replay: true` in its `FreshnessMetadata` extension.

**Rule RM-02: Unstamped data must not be rendered**
Any data object in a replay context without `_replay: true` must not be rendered. The frontend must log an error to the observability sink: "Replay context received unstamped data object — type: [object_type], session: [session_id]" and render a placeholder: "Data unavailable — source not confirmed as replay-safe."

**Rule RM-03: Live data must not contaminate replay view**
The frontend must maintain separate data contexts for live and replay sessions. A replay session opened in one tab must not receive live WebSocket updates. The WebSocket subscription for replay sessions must use a session-scoped channel, not the venue's live channel.

Approved: Replay session subscribes to `replay-session:{session_id}` WebSocket channel for annotation push updates. It does not subscribe to the venue's live state channel.
Forbidden: Replay session subscribing to `venue:{venue_id}` live channel to receive updates.
Operational consequence: If live data enters the replay view, operators draw conclusions from the current state rather than the historical record, which invalidates the forensic investigation.
Verification: Open a replay session; modify live venue data from a separate session; confirm no live data updates appear in the replay view.

---

## CMS Workspace — Data Requirements

### Schedule Manager Tab

**Required:**
```
ScheduleBlock {
  block_id:           string
  content_ref:        string
  starts_at:          governed_timestamp
  ends_at:            governed_timestamp
  venue_assignments:  string[]
  approval_status:    "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "LIVE"
  created_by:         string
  ...FreshnessMetadata
}
```

**`active_slots`**: Map of `venue_id` → `block_id` for currently live schedule blocks.

**`pending_changes`**: Schedule modifications in the approval queue. Each entry includes `change_type`, `submitted_by`, `submitted_at`, `time_remaining_hours`.

**PRE preview contract (Schedule Manager):**
```
// Request
GET /preview?input={encoded_schedule_block_context}

// Response
PREPreview {
  effective_content:  string
  level:              "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"
  resolution_path:    ResolutionPathEntry[]
  governed_timestamp: governed_timestamp
  preview_basis:      string   // which schedule block or override was evaluated
  _preview:           true     // must be present; preview responses must never reach production rendering
}
```

### Override Control Tab

**Required:**
```
// Per venue
VenueOverrideData {
  venue_id:           string
  override_stack:     OverrideEntry[]
  override_history:   OverrideHistoryEntry[]   // last 30 days
  ...FreshnessMetadata
}
```

**`accumulation_warnings`**:
```
AccumulationWarning {
  venue_id:         string
  active_count:     number    // number of active overrides
  highest_level:    string
  warning_threshold: number   // typically 3
}
```

### Approval Queue Tab

**Required:**
```
ApprovalQueueItem {
  item_id:           string
  item_type:         "SCHEDULE_BLOCK" | "OVERRIDE" | "CORPUS_CHANGE" | "SPONSORSHIP_SLOT"
  submitted_by:      string
  submitted_at:      governed_timestamp
  time_remaining_hours: number    // derived: (submitted_at + 48h) - now; computed by backend
  requires_role:     "OPERATOR" | "ADMIN"
  preview_available: boolean
  ...FreshnessMetadata
}
```

**`time_remaining_hours` contract:**
`time_remaining_hours` is computed by the backend using governed timestamps. The frontend must not independently compute this value from `submitted_at`. When `time_remaining_hours` reaches 0, the item is expired — the backend transitions the item state; the frontend must not auto-expire items based on a client-side countdown.

### Common CMS Data Rules

**Rule CMS-01: All CMS writes require session context**
Every write request from the CMS workspace must include the operator's `session_context` in the request payload. The backend must reject any write request without a valid session context. The frontend must not submit CMS forms without confirming `SessionContext` is fresh.

**Rule CMS-02: PRE preview mandatory for L4-L6**
Approved: Override Control tab gates the submit button behind a successful PRE preview load for L4–L6 overrides. The submit button is absent from the DOM until `PREPreview` is loaded and displayed.
Forbidden: Showing the L4–L6 submit button in a disabled state before PRE preview loads.
Operational consequence: A disabled button implies the operator can submit if they fix something. An absent button correctly communicates that preview is a mandatory prerequisite.
Verification: Open Override Control for an L5 override; confirm submit button is absent; load PRE preview; confirm submit button appears.

**Rule CMS-03: Server confirmation before UI update**
All write operations in the CMS workspace must wait for server confirmation before updating the UI. This applies to schedule block creation, override placement, approval queue actions, and venue assignment changes.

---

## Training Workspace — Data Requirements

### Required Data

**`operator_certifications[]`**
```
CertificationRecord {
  operator_id:      string
  level:            "L1" | "L2" | "L3" | "L4"
  issued_at:        governed_timestamp
  expires_at:       governed_timestamp
  status:           "ACTIVE" | "EXPIRED" | "REVOKED"
  issued_by:        string
}
```

**`available_modules[]`**
```
TrainingModule {
  module_id:                  string
  title:                      string
  prerequisites:              string[]   // module_ids that must be completed first
  estimated_duration_minutes: number
  required_certification_level: "L1" | "L2" | "L3" | "L4"
  version:                    string
  _simulation:                true       // must be present
}
```

**`simulation_scenarios[]`**
```
SimulationScenario {
  scenario_id:     string
  module_id:       string
  title:           string
  difficulty:      "BASIC" | "INTERMEDIATE" | "ADVANCED"
  _simulation:     true   // must be present
}
```

### Sandboxing Contract

**Rule TR-01: Simulation endpoint separation**
Training workspace API calls must go to the simulation endpoint (`/api/sim/...`), not the production endpoint (`/api/...`). The simulation endpoint is configured at build time. The frontend must not select the endpoint at runtime based on a feature flag.

**Rule TR-02: Simulation marker validation**
Every API response consumed within TrainingWorkspace must include `_simulation: true`. The TrainingWorkspace data provider must validate this marker on every response and reject unmarked responses with the following behavior:
- Log an error to the observability sink: "Training workspace received unmarked response — module: [module_id]"
- Render: "Training data source error — please refresh. If this persists, contact your administrator."
- Do not display the unmarked data.

Approved: Training data provider validates `_simulation: true` on every response before passing data to training components.
Forbidden: Training components individually checking the `_simulation` flag. Validation must be centralized in the data provider.
Operational consequence: If individual components check the flag inconsistently, a missing check in one component exposes real venue data to training mode operators.
Verification: Remove `_simulation: true` from a mock training API response; confirm the training workspace renders the data source error, not the training content.

**Rule TR-03: No production actions from training workspace**
All write operations in the training workspace must target the simulation API. The training workspace must not expose any affordance that targets a production write endpoint. This is enforced at the network layer (simulation endpoint does not proxy to production) and at the component layer (TrainingWorkspace forbids action surface components that use production endpoints).

---

## Real-Time Update Requirements

### Freshness Windows

| Data type | Maximum stale age (LIVE mode) | Update mechanism | On mechanism failure |
|---|---|---|---|
| Constitutional state | 5 seconds | WebSocket push | Transition to STALE at 5s; EXPIRED at 30s |
| Incident log | 2 seconds | WebSocket push | Poll at 10s; display "Live updates paused" banner |
| Player machine state | 10 seconds | WebSocket push | Poll at 15s |
| PRE resolution output | 15 seconds | WebSocket push | Poll at 30s; amber freshness indicator |
| Override stack | 30 seconds | WebSocket push or polling | Poll at 60s |
| Venue heartbeat status | 30 seconds | WebSocket push or polling | Poll at 60s |
| Command status (IC) | 5 seconds | WebSocket push | Poll at 10s |
| Blast radius states (IC) | 10 seconds | WebSocket push | Poll at 15s |
| Certification records | On demand | REST GET | Cached until next request |
| Corpus hash status | On demand | REST GET | Cached until next request |
| Training content | On demand | REST GET | Cached until next request |
| CMS approval queue | 60 seconds | Polling | Increase to 120s on error |

### WebSocket Connection Requirements

**Connection scoping:** One WebSocket connection per session. Channel subscriptions are managed within the single connection. The frontend does not open per-venue or per-workspace connections.

**Subscription management:**
- Zone A panes subscribe to: fleet venue states, active incidents, notification events
- VenueOperationsDashboard subscribes to: `venue:{venue_id}` channel on mount, unsubscribes on unmount
- IncidentCommanderSurface subscribes to: `incident:{incident_id}` channel on mount, unsubscribes on unmount
- ReplayForensicsWorkspace subscribes to: `replay-session:{session_id}` channel (annotation push only)

**Reconnection contract:**
On WebSocket disconnection:
1. Immediately transition all real-time data to STALE
2. Begin exponential backoff reconnection (initial: 1s; max: 30s)
3. On reconnection: request a full data refresh for all active subscriptions before resuming push updates
4. Display connection status in SystemStatusBar if disconnected for more than 5 seconds

**Rule RT-01: Polling is fallback, not primary**
Approved: WebSocket push is the primary delivery mechanism. Polling begins when WebSocket is unavailable.
Forbidden: Using polling as the primary delivery mechanism for any data type in the freshness table above.
Operational consequence: Polling at 10-second intervals produces a 10-second lag in incident log updates, violating the 2-second contract and preventing real-time incident coordination.
Verification: Confirm WebSocket subscriptions are established for all real-time data types. Confirm polling is only active when WebSocket is disconnected.

---

## Authority Metadata Requirements

### Authority Object

Every write-capable API response must include an `_authority` object describing whether the current session may perform the action.

```
AuthorityMetadata {
  required_role:    "OPERATOR" | "ADMIN"
  requires_elevation: boolean
  action_permitted: boolean
  denial_reason:    "INSUFFICIENT_ROLE" | "REQUIRES_ELEVATION" | "SYSTEM_STATE"
                  | "APPROVAL_PENDING" | "VENUE_NOT_ASSIGNED" | null
}
```

`denial_reason` must be non-null when `action_permitted: false`.

### Frontend Authority Rendering Rules

**Rule AU-01: Role-based denial — control is absent**
When `action_permitted: false` and `denial_reason` is `"INSUFFICIENT_ROLE"` or `"VENUE_NOT_ASSIGNED"`:
- The control must be absent from the DOM.
- A role gap explanation must be available through an alternative path (e.g., the section header explains the required role).

Approved: L6 override placement control is absent for OPERATOR without elevation, with a section note "L6 overrides require elevated session."
Forbidden: Rendering L6 override placement control in a disabled state for an operator who can never perform this action in their current role.
Operational consequence: Disabled controls imply a correctable condition. An OPERATOR seeing a disabled L6 control may waste time attempting to elevate their session rather than escalating to an ADMIN.
Verification: Log in as OPERATOR without elevation; confirm L6 override placement control is absent from DOM; confirm the section note explains the requirement.

**Rule AU-02: State-based denial — control is disabled**
When `action_permitted: false` and `denial_reason` is `"SYSTEM_STATE"` or `"APPROVAL_PENDING"`:
- The control must be rendered in a disabled state (visible but not activatable).
- A tooltip or adjacent text must explain the blocking condition.

Approved: Override placement disabled during EMERGENCY_FREEZE with text "Override placement unavailable during Emergency Freeze."
Forbidden: Hiding the override placement control entirely during EMERGENCY_FREEZE (the operator should be able to see the control and understand why it is temporarily unavailable).
Operational consequence: If state-based denials hide controls entirely, operators cannot distinguish "I can never do this" from "I cannot do this right now" — they lose situational understanding of the system's current constraints.
Verification: Trigger EMERGENCY_FREEZE state; confirm override placement is disabled (visible, not activatable) with explanatory text.

**Rule AU-03: Authority pre-computation is on the server**
The backend computes `action_permitted` using the server's view of the current session and system state. The frontend must not recompute authority from `required_role` and `requires_elevation` independently.

Approved: Frontend reads `action_permitted` and renders accordingly.
Forbidden: Frontend logic that computes `session.role === 'ADMIN' && session.elevation_active` to determine whether to show a control, ignoring `action_permitted`.
Operational consequence: If the frontend recomputes authority, it may diverge from the server's view when system state changes (e.g., during EMERGENCY_FREEZE), producing controls that appear available but return rejection responses.
Verification: Set `action_permitted: false` with `required_role: 'OPERATOR'` for a session that is OPERATOR role. Confirm the control is absent despite the role matching.

---

## Trust Metadata Requirements

### Trust Object

Every data object carrying operational status must include trust metadata.

```
TrustMetadata {
  _trust_level:     "TRUSTED" | "DEGRADED_TRUST" | "UNTRUSTED" | "UNKNOWN"
  _trust_basis:     string[]         // signals checked to determine trust
  _last_verified_at: governed_timestamp | null
}
```

`_last_verified_at` is null only when trust has never been verified (new installation, post-recovery before first verification).

### Frontend Trust Rendering Rules

**TRUSTED:**
Render the data normally. No trust indicator is required.

**DEGRADED_TRUST:**
Render the data with an amber indicator. The trust basis must be available — either rendered inline or accessible via hover/tap interaction. "Reduced confidence in this data — [basis summary]" must be shown when the amber indicator is focused or hovered.

**UNTRUSTED:**
Render the data with a red indicator and explicit warning text inline (not on hover): "Data trust unverified — treat with caution." The data is displayed, not suppressed. Operators must see the data and the warning. Do not suppress untrusted data.

**UNKNOWN:**
Render with a grey indicator and explicit text: "Trust unknown — last verified [age from _last_verified_at]". If `_last_verified_at` is null: "Trust unknown — not yet verified."

**Rule TM-01: Trust indicators are never optional**
Approved: Every component rendering operational status data checks `_trust_level` and renders the appropriate indicator.
Forbidden: Rendering operational status data without checking `_trust_level`; treating `_trust_level` as an optional enrichment field.
Operational consequence: Operators make deployment decisions based on venue health data. Untrusted data displayed without a warning produces incorrect operational decisions.
Verification: For each operational status component, test with all four trust levels; confirm a distinct visual treatment at each level.

**Rule TM-02: UNKNOWN trust is not TRUSTED**
Approved: `_trust_level: UNKNOWN` receives grey indicator and explicit uncertainty text.
Forbidden: Treating `_trust_level: UNKNOWN` or absent `_trust_level` as equivalent to `TRUSTED` and rendering without an indicator.
Operational consequence: A new venue installation before first corpus verification has UNKNOWN trust on all status readings. Displaying it as TRUSTED would cause operators to make decisions based on unverified baseline data.
Verification: Remove `_trust_level` from a mock response; confirm the component renders with grey indicator and "Trust unknown" text.

**Rule TM-03: Trust suppresses status optimism, not data**
Approved: UNTRUSTED player state displays the state value with a red trust indicator and inline warning.
Forbidden: Replacing an UNTRUSTED player state value with "Unknown" or hiding the value to avoid displaying untrusted data.
Operational consequence: The data, even if untrustworthy, may be the best available signal. Suppressing it entirely removes all signal; displaying it with a clear warning gives operators information to work with while communicating its reliability.
Verification: Set `_trust_level: UNTRUSTED` on a player state response; confirm the state value is displayed alongside the red indicator and warning text.

---

## Degraded Mode — Cross-Workspace Rules

### Rule DM-01: Degraded rendering is always more conservative

When data is unavailable, stale, or untrusted, the degraded rendering must never suggest a better state than is known.

| Situation | Correct degraded rendering | Forbidden rendering |
|---|---|---|
| `active_incidents` absent | "Incident status unavailable" | "No active incidents" |
| `corpus_status.hash_verified: false` | "Hash not verified" | "Corpus OK" or omitting the status |
| `player_state` absent | "Player state unknown" | Player shown as LIVE |
| `constitutional_state.confidence: NONE` | Grey indicator, "Confidence unknown" | Green HEALTHY badge |
| `_trust_level: UNTRUSTED` | Data + red indicator + warning | Data without indicator |

### Rule DM-02: Degraded state must be explicit, not inferred

The frontend must not infer system health from the absence of negative signals. Degraded state is only cleared when positive confirmation is received from the backend.

Approved: Player state displays "LIVE" only when `player_state.machine_state: "LIVE"` is received.
Forbidden: Player state displays "LIVE" because no OFFLINE or DEGRADED signal has been received recently.
Operational consequence: If positive confirmation is not required, a disconnected venue appears healthy until a negative signal arrives — which never comes if the heartbeat connection is severed.
Verification: Stop all data subscriptions for a venue while the dashboard is open; confirm the dashboard transitions to degraded indicators as data expires, not to a default healthy state.

### Rule DM-03: Data age must be visible in degraded state

When data is STALE or EXPIRED, the age of the data must be displayed alongside the data. The age is computed from `_fetched_at` using the server-originated timestamp.

Approved: "PRE resolution — last updated 4 minutes ago" displayed with the most recent PRE resolution data when freshness is STALE.
Forbidden: Displaying stale PRE resolution data without age information.
Operational consequence: Operators cannot assess the reliability of stale operational data without knowing how stale it is. 30-second-old PRE data is very different from 3-hour-old PRE data.
Verification: Mark PRE resolution data as STALE with `_fetched_at` set to 20 minutes ago; confirm the dashboard displays "last updated 20 minutes ago" adjacent to the PRE section.
