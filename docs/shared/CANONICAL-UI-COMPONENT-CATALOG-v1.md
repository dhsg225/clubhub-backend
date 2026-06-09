# CANONICAL-UI-COMPONENT-CATALOG-v1

**Document type:** Construction-system component specification
**Authority:** Agent 3 (UX/Design)
**Audience:** Frontend engineers, QA, designers
**Status:** CANONICAL — implement directly from this document
**Depends on:** FRONTEND-COMPONENT-TAXONOMY-v1.md, CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md, CANONICAL-INCIDENT-COMMAND-SURFACE-v2.md, CANONICAL-REPLAY-INVESTIGATION-SURFACE-v2.md
**Version:** 1.0

---

## 1. Catalog Overview

### 1.1 How to Read This Catalog

This catalog specifies every reusable UI component in the ClubHub TV frontend. For each component you will find: purpose, required inputs, events emitted, all possible states, per-mode behavior, per-role behavior, accessibility requirements, and audit obligations.

Component specifications are construction-grade. Implement exactly as written. Do not interpret a "disabled" state where the spec says "absent" — these have different governance meanings. Disabled implies the action is possible under different conditions. Absent means the component does not exist in the DOM for this role or mode.

### 1.2 Component Naming Convention

Component names use PascalCase. They match exactly the names defined in FRONTEND-COMPONENT-TAXONOMY-v1.md. Extended components (Section 8) are named by their surface function and follow the same convention.

### 1.3 Category Structure

| Category | Count | Zone | Lifecycle |
|---|---|---|---|
| Shell | 4 | Persistent frame | Mount once; never unmount |
| Workspace | 6 | Zone B | Mount on route; unmount on route change |
| Operational Surface | 8 | Any zone (reusable) | Mount with parent; unmount with parent |
| Action Surface | 4 | Zone B / inline | Mount on demand; unmount on completion or cancel |
| Intelligence Surface | 1 | Zone C | Mount with workspace; unmount with workspace |
| Training Surface | 2 | Zone B (training only) | Mount with TrainingWorkspace |
| Extended | 10 | Varies | Mount with parent |

### 1.4 Behavior Mode Definitions

| Mode | Trigger | Key constraint |
|---|---|---|
| LIVE | Default operational mode | Write controls follow role authority |
| REPLAY | `session._replay: true` in loaded session object | All write controls absent from DOM (not disabled) |
| INCIDENT | Active S1–S5 incident in operator scope | Severity-specific visual treatment; some nav suppressed at S1 |
| DEGRADED | Constitutional state DEGRADED or CONSTITUTIONAL_RISK | Fallback display; reduced data confidence shown |
| EMERGENCY_FREEZE | Constitutional state EMERGENCY_FREEZE or active S1 incident | Non-incident nav suppressed; status bar red |
| TRAINING | TrainingWorkspace active; all data carries `_simulation: true` | Production write controls absent; simulation banner persistent |

---

## 2. Shell Components

### ConstitutionalStateIndicator

**Category:** Shell
**Purpose:** Renders the system constitutional state badge with confidence level and freshness indication wherever system health must be visible.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `state` | `HEALTHY \| DEGRADED \| CONSTITUTIONAL_RISK \| SHADOW_ONLY \| PRE_DISABLED \| READ_ONLY \| EMERGENCY_FREEZE` | Yes | Current constitutional state |
| `confidence` | `HIGH \| MEDIUM \| LOW \| NONE` | Yes | Server-computed confidence in this state reading |
| `basis` | `string[]` | Yes | Reasons contributing to current state |
| `freshness` | `CURRENT \| STALE \| EXPIRED` | Yes | Age classification of the state data |
| `computed_at` | `ISO8601 string` | Yes | Governed timestamp of last computation |
| `size` | `'compact' \| 'full'` | No | `full` shows basis text; `compact` shows badge only. Default: `full` |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `constitutional_state_indicator_rendered` | On first mount, with full state+confidence object | None (observability only) |
| `constitutional_state_freshness_degraded` | When freshness transitions from CURRENT to STALE or EXPIRED | None (observability only) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `healthy_high` | state=HEALTHY, confidence=HIGH | Green badge, full opacity, no additional indicator |
| `healthy_medium` | state=HEALTHY, confidence=MEDIUM | Green badge, amber confidence dot |
| `healthy_low` | state=HEALTHY, confidence=LOW | Green badge, amber confidence dot, "Low confidence" text always visible (not hover-only) |
| `healthy_none` | state=HEALTHY, confidence=NONE | Green badge, grey confidence dot, "Confidence unknown" text always visible |
| `degraded` | state=DEGRADED | Amber badge with confidence indicator |
| `constitutional_risk` | state=CONSTITUTIONAL_RISK | Red badge, pulsing animation (1-second cycle) |
| `shadow_only` | state=SHADOW_ONLY | Amber badge, "Shadow only" label |
| `pre_disabled` | state=PRE_DISABLED | Red badge, "PRE disabled" label |
| `read_only` | state=READ_ONLY | Amber badge, "Read only" label |
| `emergency_freeze` | state=EMERGENCY_FREEZE | Red badge, full-width treatment, no pulse (static — pulse implies transient) |
| `stale` | freshness=STALE | Amber border on badge, tooltip: "Last updated [age]" |
| `expired` | freshness=EXPIRED | Red border on badge, explicit text: "State data expired — [age] ago" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal rendering per state rules above |
| REPLAY | Renders historical state from corpus with "HISTORICAL" label; amber border always present |
| INCIDENT | No change to rendering; severity-driven changes apply to parent (SystemStatusBar), not this component |
| DEGRADED | Renders DEGRADED or CONSTITUTIONAL_RISK state per data |
| EMERGENCY_FREEZE | Renders EMERGENCY_FREEZE state; red badge, full-width |
| TRAINING | Renders simulation state data; simulation marker visible on parent |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only; no change |
| OPERATOR | Read-only; no change |
| ADMIN | Read-only; no change — this component has no role-gated affordances |

**Accessibility:**
- Minimum touch target: N/A (display-only component)
- Screen reader label: `aria-label="Constitutional state: [STATE], confidence: [CONFIDENCE], freshness: [FRESHNESS]"`
- Keyboard navigation: not focusable (display-only)
- Focus management: none required

**Audit Requirements:**
- No operator interactions to audit. Observability events only (not Class A).

---

### SystemStatusBar

**Category:** Shell
**Purpose:** Persistent 48px top bar that renders constitutional state, active mode, session clock, and notification count; always visible at the highest z-index layer.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `constitutional_state` | `ConstitutionalStateObject` | Yes | Full state + confidence + freshness object |
| `active_mode` | `LIVE \| REPLAY \| INCIDENT \| DEGRADED \| EMERGENCY_FREEZE \| TRAINING` | Yes | Current application mode |
| `session_duration_seconds` | `number` | Yes | Elapsed session time, derived from server-provided `session_start` |
| `unread_notification_count` | `number` | Yes | Count of unread notifications in operator scope |
| `incident_active` | `boolean` | No | Whether an active incident exists in operator scope |
| `incident_severity` | `S1 \| S2 \| S3 \| S4 \| S5` | No | Highest active incident severity; controls bar tint |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `status_bar_constitutional_state_change` | On rendered state change | None (observability) |
| `status_bar_mode_change` | On active mode change | None (observability) |
| `status_bar_notification_tray_opened` | When operator opens notification tray | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `normal` | No incident, state HEALTHY | Default dark background, green constitutional badge |
| `incident_active` | `incident_active: true` | Background tinted with severity color at 15% opacity |
| `commander_lapsed` | COMMANDER_LAPSED incident state | Background shifts to `#B71C1C` (deep red) |
| `emergency_freeze` | EMERGENCY_FREEZE mode or S1 incident | Red background (`#C62828`), pulsing indicator |
| `session_expired` | Session token expiry | Session-expired overlay rendered; all controls disabled but bar remains visible |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Default rendering |
| REPLAY | "REPLAY" mode indicator shown in amber; session clock continues |
| INCIDENT | Severity tint applied; incident badge visible |
| DEGRADED | Amber tint; constitutional state badge shows DEGRADED |
| EMERGENCY_FREEZE | Red background; pulsing state indicator |
| TRAINING | Bar replaced by TrainingBanner visual treatment |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Notification tray accessible but write controls within tray absent |
| OPERATOR | Full access |
| ADMIN | Full access; additional admin-scope indicators visible if configured |

**Accessibility:**
- Minimum touch target: notification bell icon — 44×44px
- Screen reader label: `role="banner"`, `aria-label="System status bar"`
- Keyboard navigation: Tab stops at notification tray icon and mode indicator
- Focus management: Focus returns to triggering element when notification tray closes

**Audit Requirements:**
- `status_bar:notification_tray:opened` — emitted when operator opens notification tray (Class A)
- Event naming: `shell:status_bar:notification_tray_opened`

---

### AuditTraceFooter

**Category:** Shell
**Purpose:** Passive 28px bottom bar displaying the last PRE event and last audit trail entry; always visible, never interactive.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `last_pre_event` | `{ event_type: string, governed_timestamp: string, venue_id: string, level: number }` | Yes | Most recent PRE resolution event |
| `last_audit_entry` | `{ action_type: string, authored_by: string, governed_timestamp: string }` | Yes | Most recent audit trail entry |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| None | This component is fully passive | — |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `current` | Data received within threshold | Normal display |
| `stale` | No update received for >60 seconds | Amber text color on timestamps |
| `empty` | No data yet received | Placeholder text: "Awaiting audit data..." |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Shows live audit and PRE events |
| REPLAY | Shows last historical event from corpus with "CORPUS" prefix on event description |
| INCIDENT | No change — passive display continues |
| DEGRADED | Continues to display last known values; stale treatment applies if data stops |
| EMERGENCY_FREEZE | No change — passive display continues |
| TRAINING | Shows simulation events; "SIM" prefix on event descriptions |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Identical display — no role differentiation; component is read-only for all roles |
| OPERATOR | Identical |
| ADMIN | Identical |

**Accessibility:**
- Minimum touch target: N/A — no interactive elements permitted
- Screen reader label: `role="contentinfo"`, `aria-label="Audit trace footer"`
- Keyboard navigation: not focusable
- Focus management: none required

**Audit Requirements:**
- No audit events. This component emits no events. DOM must contain no `<button>`, `<a>`, `<input>`, or event handler elements.

---

### NavigationShell

**Category:** Shell
**Purpose:** Renders Zone A (280px fixed left panel) with four panes: VenueSelector (A1), IncidentList (A2), NotificationTrayAccess (A3), and OperatorTools (A4); also manages Zone C collapse state.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_list` | `VenueSummary[]` | Yes | Venues in operator scope |
| `active_venue_id` | `string \| null` | Yes | Currently selected venue |
| `incident_list` | `IncidentSummary[]` | Yes | Active incidents in operator scope |
| `unread_notification_count` | `number` | Yes | Badge count for notification tray |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator's role |
| `active_mode` | `ApplicationMode` | Yes | Current application mode |
| `zone_c_collapsed` | `boolean` | Yes | Current Zone C collapse state |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `zone_a_venue_selected` | Operator selects a venue in Pane A1 | Class A |
| `zone_a_incident_selected` | Operator selects an incident in Pane A2 | Class A |
| `zone_a_notification_tray_opened` | Operator opens notification tray | Class A |
| `zone_a_operator_tool_activated` | Operator activates a tool in Pane A4 | Class A |
| `zone_c_collapsed` | Zone C collapses | None (observability) |
| `zone_c_expanded` | Zone C expands | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `default` | Normal operation | Full Zone A at 280px |
| `incident_active` | One or more active incidents | Incident badge on Incidents nav item; severity color |
| `commander_lapsed` | COMMANDER_LAPSED incident state | Pulsing red dot on Incidents nav item |
| `emergency_freeze` | S1 incident in DECLARED state | Non-incident nav items rendered at `pointer-events: none`, opacity: 0.35; tooltip: "Unavailable during EMERGENCY_FREEZE" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full navigation available |
| REPLAY | Override creation tool absent from Pane A4; "REPLAY" badge on active venue in A1 |
| INCIDENT | Incident context block rendered below primary nav (Situation Overview, Command Log, Override Management, PRE Status, Incident Actions); ADMIN: Evidence Package item present |
| DEGRADED | No suppression; all nav items available |
| EMERGENCY_FREEZE | Future Simulation, Sponsorship Operations, Campaign Management, Media Library nav items rendered non-interactive |
| TRAINING | L2–L4 notification subscription paused; nav items unchanged |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | OperatorTools pane (A4) absent — write tools not rendered |
| OPERATOR | Full access to A1–A4 |
| ADMIN | Full access; Settings nav item visible; Evidence Package visible in incident context block |

**Accessibility:**
- Minimum touch target: each nav item — 44×44px minimum
- Screen reader label: `role="navigation"`, `aria-label="Main navigation"`
- Keyboard navigation: Tab through nav items; Enter to activate; Escape collapses open panes
- Focus management: Focus returns to triggering nav item when panes close

**Audit Requirements:**
- `shell:navigation:venue_selected` — Class A, payload: `{ venue_id, previous_venue_id }`
- `shell:navigation:incident_selected` — Class A, payload: `{ incident_id }`
- `shell:navigation:tool_activated` — Class A, payload: `{ tool_name }`

---

## 3. Workspace Components

### VenueDashboardWorkspace

**Category:** Workspace
**Purpose:** Per-venue operational view with five sections: Identity Header, Player Health, Content and PRE Status, Intervention Surface, and Venue Timeline.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Venue identifier from route param |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `active_mode` | `ApplicationMode` | Yes | Current application mode |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `venue_dashboard_loaded` | Workspace finishes mounting and rendering | None (observability) |
| `venue_dashboard_section_visible` | Each section enters viewport | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Data fetch in progress on mount | Skeleton placeholders for all five sections |
| `loaded` | All data received | Full render |
| `stale` | WebSocket subscription gap >30s | Amber banner: "Live data connection interrupted — last updated [age] ago" |
| `error` | Critical data fetch failure | Red banner with error code; retry button |
| `no_venue` | `venue_id` not in operator scope | Full-page message: "Venue not found or not in your scope" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full render; Intervention Surface section visible with write controls per role |
| REPLAY | Intervention Surface section absent; historical timestamp shown in Identity Header; all data from corpus |
| INCIDENT | Active incident banner injected below Identity Header; links to IC surface |
| DEGRADED | Degraded data indicators on affected sections; confidence badges visible |
| EMERGENCY_FREEZE | Intervention Surface present but gated; only emergency-clearance actions rendered |
| TRAINING | All sections render with simulation data; "SIM" labels on all data values |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Intervention Surface absent from DOM; all read sections visible |
| OPERATOR | Full access; Intervention Surface rendered |
| ADMIN | Full access; additional venue configuration link visible in Identity Header |

**Accessibility:**
- Minimum touch target: all section-level interactive elements — 44×44px
- Screen reader label: `main` landmark with `aria-label="Venue operations dashboard — [VENUE_NAME]"`
- Keyboard navigation: Tab through sections; each section is a `<section>` with `aria-labelledby`
- Focus management: On mount, focus to Identity Header

**Audit Requirements:**
- Workspace itself emits no Class A audit events. Write-path sub-components (Intervention Surface, Override controls) emit their own Class A events per their specifications.

---

### IncidentCommandWorkspace

**Category:** Workspace
**Purpose:** Full Zone B incident response workspace with four sub-zones (IC-TOP, IC-LEFT, IC-RIGHT, IC-BOTTOM) and a six-tab analysis system.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `incident_id` | `string` | Yes | Incident identifier from route param |
| `operator_id` | `string` | Yes | Current operator ID |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `is_commander` | `boolean` | Yes | Whether current operator is the active Incident Commander |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `ic_surface_loaded` | Workspace finishes mounting | None (observability) |
| `ic_commander_status_change` | Commander status changes | Class A |
| `ic_annotation_submitted` | Annotation submitted to command log | Class A |
| `ic_tab_activated` | Tab selection changes | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Data fetch in progress | Skeleton for IC-TOP; spinner in IC-LEFT, IC-RIGHT, IC-BOTTOM |
| `watching` | Incident state WATCHING | S5 severity visual treatment; monitoring layout |
| `declared` | Incident state DECLARED | Severity-appropriate tint; commander name visible |
| `commander_lapsed` | Incident state COMMANDER_LAPSED | COMMANDER_LAPSED indicator replaces right group of IC-TOP; amber banner between IC-TOP and tabs; SystemStatusBar shifts to red |
| `contained` | Incident state CONTAINED | Muted severity tint; closure actions visible |
| `resolved` | Incident state RESOLVED | Grey treatment; read-only throughout |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Write controls per role and commander authority |
| REPLAY | All write controls absent from DOM (IC-03 enforcement); IC-TOP shows historical incident state; "REPLAY" indicator visible |
| INCIDENT | This workspace IS the incident mode workspace; severity-driven visual treatment applies |
| DEGRADED | Degraded data indicators on affected sub-zones; confidence badges visible |
| EMERGENCY_FREEZE | S1-specific: Zone B cannot be navigated away from until CONTAINED; back navigation suppressed |
| TRAINING | Simulation data only; all write controls route to simulation endpoints |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | All write controls absent from DOM; all tab content visible except Tab 6; Zone B not auto-replaced on incident |
| OPERATOR | Write controls on Tabs 2, 3, 5; can claim command in COMMANDER_LAPSED; cannot approve S1–S2 CONTAINED |
| ADMIN | All OPERATOR plus Tab 6 in DOM; can approve S1–S2 CONTAINED; can assign `correlation_id`; can initiate ADMIN_OVERRIDE command transfer; can de-escalate S1–S2 severity |

**Accessibility:**
- Minimum touch target: all action buttons — 44×44px; [Assume Command] — 32px (minimum acceptable given container constraints)
- Screen reader label: `main` landmark with `aria-label="Incident command — [INCIDENT_ID] — [SEVERITY] [STATE]"`
- Keyboard navigation: Tab through IC-TOP fields; then tab system; within each tab, Tab through interactive elements
- Focus management: On mount, focus to IC-TOP commander status area; on COMMANDER_LAPSED state change, focus to [Assume Command] button

**Audit Requirements:**
- `incident:command:annotation_submitted` — Class A, payload: `{ incident_id, annotation_id, operator_id }`
- `incident:command:commander_claimed` — Class A, payload: `{ incident_id, new_commander_id }`
- `incident:command:tab_write_action` — Class A for each write action within any tab

---

### ReplayForensicsWorkspace

**Category:** Workspace
**Purpose:** Forensic investigation workspace for historical corpus replay; four layout zones (RP-TOP, RP-TIMELINE, RP-MAIN, RP-DETAIL) and six analysis tabs; zero live-state write controls.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `session_id` | `string` | Yes | Replay session identifier from route param |
| `venue_id` | `string \| null` | No | Venue scope; null for cross-venue sessions |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `replay_session_loaded` | Session loaded and REPLAY mode context activated | None (observability) |
| `replay_tab_switched` | Operator switches analysis tabs | None (observability) |
| `replay_annotation_created` | Annotation written to corpus | Class A (forensic record) |
| `replay_finding_submitted` | Operational finding submitted | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Session object being fetched | Skeleton for RP-TOP, spinner in RP-TIMELINE and RP-MAIN |
| `active` | Session loaded, `_replay: true` confirmed | Amber REPLAY banner below RP-TOP; timeline rendered |
| `paused` | Operator pauses playback | `⏸ PAUSED` indicator in amber in RP-TOP centre section |
| `scrubbing` | Operator drags playhead | `◁ SCRUBBING` indicator in blue; notifications deferred up to 15s |
| `corpus_not_found` | Session ID resolves to no corpus record | Full-page: "Corpus record not found — this session ID does not exist in the corpus" |
| `error` | Session load failure (network or server) | Error state with retry; session URL preserved |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Not applicable — this workspace is always in REPLAY mode |
| REPLAY | All write controls affecting live venue state are absent from DOM. Annotation and finding write controls are present (they are forensic records, not production actions). |
| INCIDENT | If incident linked to session: incident shown in A2 as read-only link; no incident action controls rendered in this workspace |
| DEGRADED | Corpus data is immutable; degraded mode affects only session load path, not corpus data quality |
| EMERGENCY_FREEZE | No suppression of replay navigation; Level 1 interrupts penetrate normally |
| TRAINING | Not applicable — training uses separate simulation sessions, not corpus replay |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only; all annotation and finding write controls absent |
| OPERATOR | Read + annotation write + finding write; Tab 6 absent from DOM |
| ADMIN | Full access including Tab 6 (Counterfactual); Tab 6 must not be visible to non-ADMIN at any time |

**Accessibility:**
- Minimum touch target: playback controls — 44×44px; timeline scrub handle — 24px wide minimum
- Screen reader label: `main` landmark with `aria-label="Replay investigation — [SESSION_ID] — [VENUE_NAME] — [TIME_RANGE]"`
- Keyboard navigation: Arrow keys move playhead one event when timeline focused; Tab through playback controls; Tab through analysis tabs
- Focus management: On session load, focus to RP-TOP centre playback controls

**Audit Requirements:**
- `replay:annotation:submitted` — Class A, payload: `{ session_id, annotation_id, anchored_to, confidence }`
- `replay:finding:submitted` — Class A, payload: `{ session_id, finding_id, severity }`
- `replay:tab:counterfactual_accessed` — Class A (ADMIN only), payload: `{ session_id, operator_id }`

---

### CMSContentWorkspace

**Category:** Workspace
**Purpose:** Content management workspace with six tabs: Schedule Manager, Override Control, Content Library, Sponsorship Manager, Venue Assignments, Approval Queue.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `active_tab` | `string` | No | Initial tab; defaults to last-used tab from localStorage |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `active_mode` | `ApplicationMode` | Yes | Current application mode |
| `venue_scope` | `string[]` | Yes | Venues operator can affect with overrides |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `cms_tab_activated` | Tab becomes active | None (observability) |
| `cms_form_abandoned` | Operator navigates away from in-progress form | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Workspace mounting, initial data fetch | Tab headers visible; skeleton in tab content area |
| `ready` | Data loaded | Full render |
| `unsaved_changes` | In-progress L4+ override form when navigating away | Inline prompt: "You have an unsaved override — leave without saving?" with [Stay] and [Leave] |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full access per role |
| REPLAY | Write controls absent from all tabs; Schedule Manager and Override Control tabs render read-only views |
| INCIDENT | No suppression; operators may still manage content; active incident banner in Identity Header |
| DEGRADED | PRE preview endpoint may be unavailable; preview gate for L4+ overrides shows error with retry |
| EMERGENCY_FREEZE | Override Control tab still accessible; L6 emergency placement path remains active |
| TRAINING | All tab actions route to simulation endpoints; [Simulation] badge on each tab header |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Override Control, Approval Queue write controls absent; Schedule Manager and Content Library read-only |
| OPERATOR | Full access; L6 override requires `elevation_active: true` in session |
| ADMIN | Full access; Approval Queue approvals available; additional governance controls in Sponsorship Manager |

**Accessibility:**
- Minimum touch target: tab headers — 44px height minimum; all form controls — 44×44px
- Screen reader label: `main` landmark with `aria-label="Content management"`, tab system uses `role="tablist"` and `role="tab"`
- Keyboard navigation: Arrow keys navigate between tabs; Enter/Space activates tab
- Focus management: On tab change, focus to first interactive element within new tab content

**Audit Requirements:**
- Override placement events delegated to OverrideControl component (see Section 5).
- `cms:tab:approval_action` — Class A for any approval or rejection in Approval Queue.

---

### TrainingWorkspace

**Category:** Workspace
**Purpose:** Sandboxed training and certification workspace; no production data, no production write actions; all API responses must carry `_simulation: true`.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `module_id` | `string \| null` | No | Specific module to load; null shows module list |
| `scenario_id` | `string \| null` | No | Active simulation scenario |
| `operator_id` | `string` | Yes | Current operator |
| `is_instructor` | `boolean` | Yes | Whether to render SimulationControls |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `training_module_started` | Module begins | None (observability) |
| `training_module_completed` | Module finishes | None (observability) |
| `training_simulation_started` | Simulation scenario begins | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Module or scenario fetch in progress | Skeleton |
| `module_list` | No `module_id` provided | Module catalog grid |
| `module_active` | Module loaded | Module content with progress indicator |
| `simulation_active` | Simulation scenario running | Simulation layout with SimulationControls (instructor) |
| `production_data_error` | API response missing `_simulation: true` | Full-page error: "Training data source error — production data must not be used in training mode." Workspace frozen. |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Not applicable — this workspace establishes TRAINING mode on mount |
| REPLAY | Not applicable |
| INCIDENT | Level 1 interrupts penetrate; workspace not suppressed |
| DEGRADED | Training continues; simulation endpoint status shown |
| EMERGENCY_FREEZE | Level 1 interrupt penetrates; training suspended and operator directed to IC surface |
| TRAINING | This workspace operates exclusively in TRAINING mode |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Module list and viewer access; no simulation write controls |
| OPERATOR | Full module access; simulation participant role |
| ADMIN | Full access; can view certification reports |

**Accessibility:**
- Minimum touch target: module cards — 44×44px; simulation controls — 44×44px
- Screen reader label: `main` landmark with `aria-label="Training workspace"`
- Keyboard navigation: Tab through module list; Enter activates module
- Focus management: On module start, focus to first content element

**Audit Requirements:**
- No Class A audit events — training actions are not production records.

---

### FleetOverviewWorkspace

**Category:** Workspace
**Purpose:** Multi-venue navigation surface showing aggregated venue health, active incident counts, and constitutional state distribution; primary action is navigation to venue or incident workspaces.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `operator_role` | `OPERATOR \| ADMIN` | Yes | Minimum OPERATOR — VIEWER redirected |
| `venue_summaries` | `VenueSummary[]` | Yes | Fleet-level summary objects (not full venue objects) |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `fleet_venue_selected` | Operator clicks a venue card | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Initial data fetch | Skeleton card grid |
| `loaded` | Summaries received | Card grid with constitutional state badges |
| `stale` | Subscription gap >30s | Amber banner; last-updated timestamp visible |
| `empty` | No venues in scope | "No venues assigned — contact your administrator" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal fleet view |
| REPLAY | Not applicable — fleet view has no replay mode |
| INCIDENT | Active incident badges on affected venue cards; tapping navigates to IC surface |
| DEGRADED | Degraded state badges on affected venues |
| EMERGENCY_FREEZE | S1 venue cards highlighted with red border; [Open Incident] CTA prominent |
| TRAINING | Not applicable — OPERATOR minimum role excludes most training scenarios |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Route not accessible — redirected to single-venue view or `/unauthorized` |
| OPERATOR | Full access |
| ADMIN | Full access; fleet-level aggregate stats visible in header |

**Accessibility:**
- Minimum touch target: venue cards — 44×44px
- Screen reader label: `main` landmark with `aria-label="Fleet overview — [N] venues"`
- Keyboard navigation: Tab through venue cards; Enter navigates to venue dashboard
- Focus management: On mount, focus to first venue card

**Audit Requirements:**
- `fleet:navigation:venue_selected` — Class A, payload: `{ venue_id, venue_state, action: 'navigate_to_dashboard' | 'navigate_to_incident' }`

---

## 4. Operational Surface Components

### VenueStatusCard

**Category:** Operational Surface
**Purpose:** Compact read-only summary of a single venue's constitutional state, player health, screen count, and active override count; used in fleet views and zone A panels.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Venue identifier |
| `venue_name` | `string` | Yes | Display name |
| `constitutional_state` | `ConstitutionalStateObject` | Yes | Current constitutional state with confidence |
| `player_health` | `HEALTHY \| DEGRADED \| OFFLINE \| UNKNOWN` | Yes | Player health status |
| `screen_count` | `number` | Yes | Total screens at venue |
| `screens_offline` | `number` | Yes | Count of offline screens |
| `active_override_count` | `number` | Yes | Count of active overrides |
| `active_incident` | `IncidentSummary \| null` | No | Active incident if present |
| `health_grade` | `A \| B \| C \| D \| F` | No | Venue entropy health grade |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `venue_card_selected` | Operator taps/clicks card | Class A |
| `venue_card_incident_badge_selected` | Operator taps incident count badge | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `healthy` | state=HEALTHY, no incident | Green constitutional badge; normal card treatment |
| `degraded` | state=DEGRADED | Amber left border; amber constitutional badge |
| `constitutional_risk` | state=CONSTITUTIONAL_RISK | Red left border; pulsing red badge |
| `incident_active` | `active_incident` present | Severity-colored badge overlay on card |
| `offline` | player_health=OFFLINE | Striped grey treatment; "OFFLINE" label prominent |
| `loading` | Data not yet received | Skeleton card |
| `stale` | Last update >30s | Amber timestamp indicator |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal |
| REPLAY | Historical state badge; "HISTORICAL" label |
| INCIDENT | Incident badge visible; severity color |
| DEGRADED | Degraded confidence indicators |
| EMERGENCY_FREEZE | Red border; "EMERGENCY" badge |
| TRAINING | "SIM" label; simulation state data |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Card navigates to read-only venue view |
| OPERATOR | Card navigates to venue dashboard with write access |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: 44×44px (full card is tappable)
- Screen reader label: `role="button"`, `aria-label="[VENUE_NAME] — [STATE] — [N] screens — [N] incidents"`
- Keyboard navigation: Tab to card; Enter to navigate
- Focus management: Standard tab flow

**Audit Requirements:**
- `fleet:venue_card:selected` — Class A, payload: `{ venue_id, venue_state }`

---

### IncidentCard

**Category:** Operational Surface
**Purpose:** Compact display of a single incident showing ID, severity, state, declared time, and commander; used in Zone A incident list and fleet view incident panels.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `incident_id` | `string` | Yes | Incident identifier |
| `severity` | `S1 \| S2 \| S3 \| S4 \| S5` | Yes | Incident severity |
| `state` | `WATCHING \| DECLARED \| CONTAINED \| RESOLVED \| COMMANDER_LAPSED` | Yes | Incident state |
| `declared_at` | `ISO8601 string` | Yes | Governed declaration timestamp |
| `venue_name` | `string` | Yes | Affected venue display name |
| `commander_name` | `string \| null` | Yes | Current commander; null if COMMANDER_LAPSED |
| `duration_seconds` | `number` | No | Elapsed time since declaration; absent in WATCHING state |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `incident_card_selected` | Operator taps/clicks card | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `watching` | state=WATCHING | S5 olive green treatment; "WATCHING" pill |
| `declared` | state=DECLARED | Severity color treatment; "DECLARED" blue pill |
| `commander_lapsed` | state=COMMANDER_LAPSED | Red background at 15% opacity; "COMMANDER LAPSED" pill; pulsing red dot |
| `contained` | state=CONTAINED | Green treatment; "CONTAINED" pill |
| `resolved` | state=RESOLVED | Grey treatment; "RESOLVED" pill |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal; card navigates to IC surface |
| REPLAY | Historical incident state; card navigates to IC surface in read-only mode |
| INCIDENT | Card for the active incident is highlighted with active treatment |
| DEGRADED | No change |
| EMERGENCY_FREEZE | S1 card: full-width red treatment; prominent [Open Incident] CTA |
| TRAINING | "SIM" label; simulation incident data |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Card present; navigates to IC surface in read-only view |
| OPERATOR | Card present; navigates to full IC surface |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: 44×44px (full card tappable)
- Screen reader label: `role="button"`, `aria-label="Incident [ID] — [SEVERITY] — [STATE] — [VENUE_NAME] — Commander: [COMMANDER_NAME]"`
- Keyboard navigation: Tab to card; Enter to navigate
- Focus management: Standard tab flow

**Audit Requirements:**
- `navigation:incident_card:selected` — Class A, payload: `{ incident_id, severity, state }`

---

### AlertCard

**Category:** Operational Surface
**Purpose:** Displays a single operational alert with level, type, triggering condition, venue scope, and acknowledgement status; read-only display with navigation link.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `alert_id` | `string` | Yes | Alert identifier |
| `level` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | Yes | Alert interrupt level |
| `alert_type` | `string` | Yes | Classification label (e.g., `COMMANDER_LAPSED`, `PRE_DIVERGENCE`, `DEVICE_OFFLINE`) |
| `triggered_at` | `ISO8601 string` | Yes | Governed timestamp of alert trigger |
| `venue_id` | `string` | Yes | Venue in scope |
| `venue_name` | `string` | Yes | Display name |
| `acknowledged` | `boolean` | Yes | Whether alert has been acknowledged |
| `acknowledged_by` | `string \| null` | No | Operator name who acknowledged |
| `auto_expires` | `boolean` | Yes | Whether alert auto-expires (L6 never auto-expires) |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `alert_card_viewed` | Card enters viewport | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `active_unacknowledged` | `acknowledged: false` | Level-colored left border; full opacity |
| `acknowledged` | `acknowledged: true` | Grey left border; reduced opacity; acknowledgement details shown |
| `l1_active` | level=1, unacknowledged | Red background; full-width treatment; non-dismissable visual |
| `auto_expire_pending` | `auto_expires: true`, expiry <5min | Amber countdown visible |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal |
| REPLAY | Historical alert with "HISTORICAL" label; acknowledgement state from corpus |
| INCIDENT | No change |
| DEGRADED | No change |
| EMERGENCY_FREEZE | L1 alerts rendered with maximum prominence; no visual suppression |
| TRAINING | Simulation alerts only; "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only; no acknowledgement controls (acknowledgement is a write action — absent for VIEWER) |
| OPERATOR | Read-only display; acknowledgement handled by workflow, not this component |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: 44×44px (full card tappable for navigation link)
- Screen reader label: `role="article"`, `aria-label="Alert: [TYPE] — Level [N] — [VENUE_NAME] — [acknowledged/unacknowledged]"`
- Keyboard navigation: Tab to card; Enter to navigate to source
- Focus management: Standard tab flow

**Audit Requirements:**
- Alert acknowledgement is a workflow action (Class A), emitted by the workflow component, not AlertCard.

---

### OverrideDisplay

**Category:** Operational Surface
**Purpose:** Read-only display of the active override stack for a venue scope; renders each override's level, content, scope, placement time, and expiry.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `override_stack` | `OverrideEntry[]` | Yes | Array of active overrides; each: `{ override_id, level, content_name, scope, placed_by, placed_at, expires_at, approval_status }` |
| `venue_id` | `string` | Yes | Venue scope |
| `venue_name` | `string` | Yes | Display name |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `override_stack_viewed` | Component enters viewport | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `empty` | No active overrides | "No active overrides for [VENUE_NAME]" message |
| `loaded` | Overrides present | Stacked card list ordered by level (highest first) |
| `loading` | Data fetch in progress | Skeleton cards |
| `stale` | Data age >30s | Amber timestamp indicator |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current active overrides |
| REPLAY | Historical override stack from corpus at playhead timestamp; "HISTORICAL" label |
| INCIDENT | No change; override stack reflects current state during incident |
| DEGRADED | Best-available data; stale indicator if data age exceeds threshold |
| EMERGENCY_FREEZE | No change |
| TRAINING | Simulation override stack; "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Identical display — no action affordances for any role (this is display-only) |
| OPERATOR | Identical |
| ADMIN | Identical |

**Accessibility:**
- Minimum touch target: N/A — display-only, no interactive elements
- Screen reader label: `role="region"`, `aria-label="Active override stack — [VENUE_NAME] — [N] overrides"`
- Keyboard navigation: Not focusable (display-only)
- Focus management: None required

**Audit Requirements:**
- No Class A audit events. This component emits no write-path events. Override placement is handled exclusively by OverrideControl (Action Surface).

---

### PREResolutionIndicator

**Category:** Operational Surface
**Purpose:** Compact display of the current PRE resolution level (L0–L6) and effective content winner for a venue at a given governed timestamp.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Venue identifier |
| `governed_timestamp` | `ISO8601 string` | Yes | Timestamp of resolution (live: current; replay: playhead) |
| `resolution_level` | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6` | Yes | Winning resolution level |
| `effective_content_id` | `string` | Yes | ID of content winning the resolution |
| `effective_content_name` | `string` | Yes | Display name of winning content |
| `resolution_confidence` | `HIGH \| MEDIUM \| LOW \| NONE` | Yes | Confidence in this resolution output |
| `divergence_detected` | `boolean` | Yes | Whether a PRE divergence is present |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `pre_resolution_indicator_viewed` | Component enters viewport | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `resolved` | Normal resolution | Level badge + content name |
| `divergence` | `divergence_detected: true` | Red diamond badge; "DIVERGENCE DETECTED" label; amber border |
| `low_confidence` | `resolution_confidence: LOW` | Amber badge on confidence indicator; "Low confidence" text visible |
| `none_confidence` | `resolution_confidence: NONE` | Grey badge; "Confidence unknown" visible |
| `loading` | Data not yet received | Skeleton |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current resolution |
| REPLAY | Historical resolution at playhead timestamp; "HISTORICAL" label |
| INCIDENT | PRE at incident declaration time vs PRE now (if rendered in IC context) |
| DEGRADED | Best-available resolution with confidence indicators |
| EMERGENCY_FREEZE | L0 emergency resolution likely active; L0 badge prominent |
| TRAINING | Simulation resolution; "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only |
| OPERATOR | Read-only; [Explain] button navigates to PREExplainabilitySurface |
| ADMIN | Read-only; [Explain] button navigates to PREExplainabilitySurface |

**Accessibility:**
- Minimum touch target: 44×44px for [Explain] button
- Screen reader label: `aria-label="PRE resolution: Level [N] — [CONTENT_NAME] — Confidence: [CONFIDENCE]"`
- Keyboard navigation: Tab to [Explain] button; Enter activates
- Focus management: Standard tab flow

**Audit Requirements:**
- No Class A events from this component. Navigation to explainability surface logged by routing layer.

---

### ConnectivityDisplay

**Category:** Operational Surface
**Purpose:** Displays device connectivity status for a venue's screens including online/offline counts, last heartbeat timestamps, and autonomy clock countdown.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Venue identifier |
| `total_screens` | `number` | Yes | Total screen count |
| `screens_online` | `number` | Yes | Currently online screens |
| `screens_offline` | `number` | Yes | Currently offline screens |
| `last_heartbeat_at` | `ISO8601 string` | Yes | Most recent heartbeat from any device |
| `autonomy_hours_remaining` | `number` | Yes | Hours of corpus-based autonomy remaining on devices |
| `connectivity_state` | `FULL \| PARTIAL \| ISOLATED \| UNKNOWN` | Yes | Fleet connectivity classification |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `connectivity_display_viewed` | Component enters viewport | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `full` | All screens online | Green connectivity badge |
| `partial` | Some screens offline | Amber badge; offline count shown |
| `isolated` | All screens offline | Red badge; "ISOLATED" label; autonomy countdown prominent |
| `unknown` | `connectivity_state: UNKNOWN` | Grey badge; "Unknown — UNKNOWN is never neutral" label |
| `autonomy_critical` | `autonomy_hours_remaining < 4` | Red autonomy clock; pulsing |
| `autonomy_warning` | `autonomy_hours_remaining < 24` | Amber autonomy clock |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Real-time connectivity data |
| REPLAY | Historical connectivity from corpus at playhead timestamp |
| INCIDENT | No change; connectivity data reflects current state |
| DEGRADED | Best-available data; stale indicator if heartbeat gap exceeds threshold |
| EMERGENCY_FREEZE | No change |
| TRAINING | Simulated connectivity state; "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only |
| OPERATOR | Read-only display; connectivity recovery actions in separate Intervention Surface |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: N/A — display-only component
- Screen reader label: `aria-label="Connectivity: [STATE] — [N] online, [N] offline — Autonomy: [N] hours remaining"`
- Keyboard navigation: Not focusable
- Focus management: None required

**Audit Requirements:**
- No Class A events from this display component.

---

### TrustIndicator

**Category:** Operational Surface
**Purpose:** Renders the trust classification of a data source or venue state (TRUSTED, DEGRADED_TRUST, UNTRUSTED, UNKNOWN) with mandatory visual distinction; UNKNOWN is never rendered as neutral.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `trust_level` | `TRUSTED \| DEGRADED_TRUST \| UNTRUSTED \| UNKNOWN` | Yes | Trust classification |
| `source` | `string` | Yes | What this trust reading applies to (e.g., "PRE resolution", "corpus record") |
| `reason` | `string \| null` | No | Human-readable reason for non-TRUSTED state |
| `computed_at` | `ISO8601 string` | Yes | When trust was last computed |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| None | Display-only component | — |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `trusted` | `trust_level: TRUSTED` | Green badge; "TRUSTED" label |
| `degraded_trust` | `trust_level: DEGRADED_TRUST` | Amber badge; "DEGRADED TRUST" label; reason shown if provided |
| `untrusted` | `trust_level: UNTRUSTED` | Red badge; "UNTRUSTED" label; reason always shown |
| `unknown` | `trust_level: UNKNOWN` | Red-outlined badge; "UNKNOWN — verification required" label; reason shown if provided. Never grey; never neutral. |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current trust state |
| REPLAY | Historical trust state from corpus with "HISTORICAL" label |
| INCIDENT | No change |
| DEGRADED | Most likely to show DEGRADED_TRUST or UNKNOWN states |
| EMERGENCY_FREEZE | No change |
| TRAINING | Simulated trust state; "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Identical; read-only for all roles |
| OPERATOR | Identical |
| ADMIN | Identical |

**Accessibility:**
- Minimum touch target: N/A — display-only
- Screen reader label: `aria-label="Trust: [LEVEL] for [SOURCE]"`; if UNKNOWN: "Trust: UNKNOWN — verification required for [SOURCE]"
- Keyboard navigation: Not focusable
- Focus management: None required

**Audit Requirements:**
- No Class A events. Trust state changes are platform events, not operator actions.

---

### OperatorPresencePanel

**Category:** Operational Surface
**Purpose:** Displays which operators are currently viewing a workspace or investigation session; read-only presence indicator; used in ReplayForensicsWorkspace and IC surface.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `present_operators` | `OperatorPresence[]` | Yes | Each: `{ operator_id, display_name, initials, role, joined_at }` |
| `current_operator_id` | `string` | Yes | ID of the viewing operator (labeled "you") |
| `max_inline` | `number` | No | Maximum operators shown inline before "+N more". Default: 3 |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| None | Display-only; presence popover expand is local state only | — |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `solo` | Only current operator present | "[Your name] (you)" display; no collaborators shown |
| `multi` | Multiple operators present | Initials avatars + overflow "+N more" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Live presence data |
| REPLAY | Shows operators currently viewing this replay session |
| INCIDENT | Shows operators currently on the IC surface |
| DEGRADED | Best-available presence data; stale treatment if subscription gap |
| EMERGENCY_FREEZE | No change |
| TRAINING | Not applicable in most training contexts |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Identical display |
| OPERATOR | Identical |
| ADMIN | Identical |

**Accessibility:**
- Minimum touch target: "+N more" overflow button — 44×44px
- Screen reader label: `aria-label="[N] operators currently viewing — [NAME1], [NAME2], and [N] more"`
- Keyboard navigation: Tab to overflow button; Enter expands popover
- Focus management: Focus returns to overflow button when popover closes

**Audit Requirements:**
- No Class A events. Presence is observability data, not an operator action.

---

## 5. Action Surface Components

All action surface components enforce these universal rules:
- **AS-01:** If `_replay: true` in context, component returns null (absent from DOM — not disabled).
- **AS-02:** Server confirmation required before applying permanent UI state change.
- **AS-03:** Audit event emitted before action is considered complete; if audit fails, action rolls back.

---

### CommandActionSurface

**Category:** Action Surface
**Purpose:** Multi-purpose write control surface for standard operational commands: override placement (L1–L5), annotation submission, and intervention triggers; gated by role and session state.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Target venue |
| `action_type` | `'override' \| 'annotation' \| 'intervention'` | Yes | Command category |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `session_elevation_active` | `boolean` | Yes | Whether elevated session is active (required for L6) |
| `replay_mode` | `boolean` | Yes | AS-01 guard; if true, component returns null |
| `pre_preview_enabled` | `boolean` | No | Whether PRE preview gate is active for this action |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `command_action_initiated` | Operator opens the action surface | Class A |
| `command_action_submitted` | Submission sent to server (AS-03) | Class A |
| `command_action_confirmed` | Server confirms | Class A |
| `command_action_rejected` | Server rejects | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `idle` | Not yet opened | Trigger button visible |
| `open` | Operator has opened the surface | Form or step panel rendered inline |
| `preview_pending` | Awaiting PRE preview for L4+ | Preview loading indicator; submit blocked |
| `preview_ready` | PRE preview loaded | Preview result shown; submit enabled |
| `submitting` | Submission in flight | Loading indicator on submit button; form fields disabled |
| `confirmed` | Server confirms | Success indicator; form collapses |
| `error` | Server rejects | Error message inline below form; form content preserved; retry available |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full operation per role and session state |
| REPLAY | Component returns null (AS-01) — absent from DOM |
| INCIDENT | Available; override placement within IC surface context |
| DEGRADED | PRE preview may be unavailable; preview gate for L4+ shows error with retry |
| EMERGENCY_FREEZE | Only L6 emergency placement path active; all other levels blocked |
| TRAINING | Routes to simulation endpoint; [Simulation] badge on submit button |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Component absent from DOM (role-based denial → absent) |
| OPERATOR | Full access; L6 requires `session_elevation_active: true` |
| ADMIN | Full access including L6 without elevation requirement |

**Accessibility:**
- Minimum touch target: trigger button — 44×44px; all form controls — 44×44px
- Screen reader label: trigger button `aria-label="[ACTION_TYPE] — [VENUE_NAME]"`; form `role="form"` with `aria-label`
- Keyboard navigation: Escape closes open surface; Tab through form fields; Enter submits when focused on submit
- Focus management: On open, focus to first form field; on close, focus returns to trigger button

**Audit Requirements:**
- `command:action:initiated` — Class A, payload: `{ venue_id, action_type, operator_id }`
- `command:action:submitted` — Class A (AS-03), payload: `{ venue_id, action_type, fields_submitted }`

---

### ConfirmationSurface

**Category:** Action Surface
**Purpose:** Inline confirmation card for moderate-consequence actions; expands below the triggering element; never rendered as a modal dialog.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `action_label` | `string` | Yes | Human-readable description of the action being confirmed |
| `consequence_description` | `string` | Yes | What will happen if confirmed |
| `confirm_label` | `string` | Yes | Text for confirm button (e.g., "Confirm — Assume Command") |
| `cancel_label` | `string` | No | Text for cancel button. Default: "Cancel" |
| `replay_mode` | `boolean` | Yes | AS-01 guard |
| `on_confirm` | `() => void` | Yes | Callback on confirmation |
| `on_cancel` | `() => void` | Yes | Callback on cancellation |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `confirmation_shown` | Component mounts | None (observability) |
| `confirmation_confirmed` | Operator confirms | Class A |
| `confirmation_cancelled` | Operator cancels | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `visible` | Mounted | Inline card expanded below trigger |
| `confirming` | Confirm button tapped; waiting for server | Loading indicator on confirm button; both buttons disabled |
| `cancelled` | Cancel pressed | Component unmounts; focus returns to trigger |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal |
| REPLAY | Returns null (AS-01) |
| INCIDENT | Normal; used for [Assume Command] and other IC actions |
| DEGRADED | Normal |
| EMERGENCY_FREEZE | Normal; used for emergency clearance confirmations |
| TRAINING | Routes to simulation endpoint |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Component absent (parent action surface is absent) |
| OPERATOR | Full access |
| ADMIN | Full access |

**Accessibility:**
- Minimum touch target: confirm and cancel buttons — 44×44px
- Screen reader label: `role="alertdialog"`, `aria-label="Confirm: [ACTION_LABEL]"`, `aria-modal="false"` (inline, not modal)
- Keyboard navigation: Tab between confirm and cancel; Enter confirms when confirm focused; Escape cancels
- Focus management: On mount, focus to confirm button; on cancel, focus to trigger element

**Audit Requirements:**
- `action:confirmation:confirmed` — Class A, payload: `{ action_label, operator_id }`
- `action:confirmation:cancelled` — Class A, payload: `{ action_label, operator_id }`

---

### ApprovalSurface

**Category:** Action Surface
**Purpose:** Multi-step approval workflow for S1–S2 CONTAINED transitions and L4+ override approvals; server-confirmed step completion before advancing.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `approval_type` | `'incident_containment' \| 'override_l4plus'` | Yes | Type of approval workflow |
| `subject_id` | `string` | Yes | ID of the incident or override being approved |
| `required_steps` | `ApprovalStep[]` | Yes | Steps that must be server-confirmed before final approval |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `replay_mode` | `boolean` | Yes | AS-01 guard |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `approval_step_completed` | Each step server-confirmed | Class A |
| `approval_submitted` | Final approval sent | Class A |
| `approval_confirmed` | Server confirms approval | Class A |
| `approval_rejected` | Server rejects | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `step_active` | On current step | Step form rendered; previous steps shown as completed (read-only); future steps absent from DOM |
| `step_pending_confirmation` | Step submitted, awaiting server | Loading indicator; step form disabled |
| `step_failed` | Server returns error on step | Error inline; retry available |
| `all_steps_complete` | All steps server-confirmed | Final approval button enabled |
| `approved` | Server confirms approval | Success state; workflow collapses |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Normal multi-step flow |
| REPLAY | Returns null (AS-01) |
| INCIDENT | Incident containment approval used here |
| DEGRADED | Server confirmation may be slow; loading states extended; retry available |
| EMERGENCY_FREEZE | Not applicable (EMERGENCY_FREEZE incidents require S1 approval, handled here) |
| TRAINING | Routes to simulation endpoint |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Absent from DOM |
| OPERATOR | Can approve standard overrides; cannot approve S1–S2 CONTAINED |
| ADMIN | Full approval authority including S1–S2 CONTAINED |

**Accessibility:**
- Minimum touch target: step action buttons — 44×44px
- Screen reader label: `role="form"`, `aria-label="Approval workflow — [APPROVAL_TYPE] — Step [N] of [TOTAL]"`
- Keyboard navigation: Tab through step form fields; Escape cancels current step (not whole workflow)
- Focus management: On step advance, focus to first field of new step

**Audit Requirements:**
- `approval:step:completed` — Class A, payload: `{ approval_type, subject_id, step_number, server_confirmed: boolean }`
- `approval:workflow:submitted` — Class A, payload: `{ approval_type, subject_id, operator_id }`

---

### EmergencyActionSurface

**Category:** Action Surface
**Purpose:** High-consequence emergency action surface for L6 override placement and EMERGENCY_FREEZE clearance; requires typed confirmation string and elevated authority.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `action_type` | `'l6_override' \| 'emergency_freeze_clearance'` | Yes | Emergency action type |
| `venue_id` | `string` | Yes | Target venue |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `elevation_active` | `boolean` | Yes | Whether session elevation is active (required) |
| `confirmation_string_required` | `string` | Yes | The exact string the operator must type to proceed |
| `replay_mode` | `boolean` | Yes | AS-01 guard |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `emergency_action_initiated` | Operator opens the emergency surface | Class A |
| `emergency_confirmation_string_entered` | Operator types confirmation string | Class A |
| `emergency_action_submitted` | Submission sent (AS-03) | Class A |
| `emergency_action_confirmed` | Server confirms | Class A |
| `emergency_action_rejected` | Server rejects | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `locked` | Elevation not active | Surface renders with "Elevation required" state; no action controls accessible |
| `elevation_active` | `elevation_active: true` | Red-bordered form; "EMERGENCY ACTION" header |
| `confirmation_pending` | Waiting for typed confirmation string | Submit blocked; character-by-character validation |
| `confirmation_match` | Typed string matches required | Submit button enabled |
| `submitting` | Submission in flight | Full-surface loading overlay |
| `confirmed` | Server confirms | Success state with timestamp |
| `error` | Server rejects | Error displayed; typed confirmation cleared; operator must re-enter |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full emergency action path |
| REPLAY | Returns null (AS-01) |
| INCIDENT | Primary use case for this surface |
| DEGRADED | Emergency actions prioritized; degraded state does not block emergency path |
| EMERGENCY_FREEZE | Clearance action available here |
| TRAINING | Simulation elevation only; routes to simulation endpoint |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Absent from DOM |
| OPERATOR | L6 placement with `elevation_active: true`; EMERGENCY_FREEZE clearance not available |
| ADMIN | Full authority including EMERGENCY_FREEZE clearance |

**Accessibility:**
- Minimum touch target: all controls — 44×44px
- Screen reader label: `role="form"`, `aria-label="Emergency action — [ACTION_TYPE] — [VENUE_NAME]"`, `aria-describedby` pointing to consequence description
- Keyboard navigation: Tab through form; confirmation string field requires explicit typing
- Focus management: On mount, focus to first content (elevation warning or confirmation string field)

**Audit Requirements:**
- `emergency:action:initiated` — Class A (includes operator ID and action type)
- `emergency:action:submitted` — Class A (AS-03; if audit fails, action must not proceed)
- All emergency events include governed timestamp from server, not wall clock.

---

## 6. Intelligence Surface Components

### PREExplainabilitySurface

**Category:** Intelligence Surface
**Purpose:** Renders the full PRE resolution trace for a venue at a given governed timestamp; shows resolution path (L0–L6), effective content winner, and basis for each level; read-only.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Venue identifier |
| `governed_timestamp` | `ISO8601 string` | Yes | Timestamp to explain |
| `resolution_trace` | `PREResolutionTrace` | Yes | Full resolution output from `/preview` or corpus |
| `context` | `'live' \| 'preview' \| 'replay'` | Yes | Source context; affects labeling |
| `show_full_tree` | `boolean` | No | Whether to expand full L0–L6 tree by default. Default: false |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `pre_explanation_viewed` | Component enters viewport | None (observability) |
| `pre_level_expanded` | Operator expands a resolution level detail | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Resolution trace being fetched | Skeleton |
| `resolved` | Trace loaded; single clear winner | Winner highlighted; full path shown collapsed by default |
| `divergence` | `divergence_detected: true` in trace | Red divergence banner above tree; divergent levels highlighted |
| `error` | Trace fetch failed | Error with retry; "[Explanation unavailable]" fallback text |
| `preview` | `context: 'preview'` | Amber "PREVIEW" banner; "This is not the live resolution — it is a preview of what would happen" |
| `historical` | `context: 'replay'` | Amber "HISTORICAL" banner; governed timestamp shown prominently |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current live resolution trace |
| REPLAY | Historical resolution from corpus; `context: 'replay'` rendering |
| INCIDENT | Resolution at incident declaration time and current time (when used in IC Tab 1) |
| DEGRADED | Best-available trace; confidence indicators on degraded levels |
| EMERGENCY_FREEZE | L0 emergency level shown as active winner; full trace available |
| TRAINING | Simulation trace; `context: 'preview'` with "SIM" label |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only; no interactive expansion |
| OPERATOR | Can expand level details; no modification affordances |
| ADMIN | Same as OPERATOR for this component |

**Accessibility:**
- Minimum touch target: level expand buttons — 44×44px
- Screen reader label: `role="region"`, `aria-label="PRE resolution explanation — Level [N] active — [CONTENT_NAME]"`
- Keyboard navigation: Tab through level expand buttons; Enter/Space expands
- Focus management: On level expand, focus to first content within expanded section

**Audit Requirements:**
- No Class A events. Explanation view is observability only. PRE modification is not possible from this component.

---

## 7. Training Surface Components

### SimulationIndicator

**Category:** Training Surface
**Purpose:** Persistent visual indicator that the operator is in a simulation context; rendered within TrainingWorkspace only; never appears outside training scope.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `simulation_type` | `'module' \| 'scenario' \| 'instructor'` | Yes | Type of simulation context |
| `scenario_name` | `string \| null` | No | Active scenario name if applicable |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| None | Display-only | — |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `active` | Always when rendered | Blue banner: "SIMULATION MODE — [SIMULATION_TYPE]" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| TRAINING | Always rendered within TrainingWorkspace |
| All others | Must not be rendered. This component is build-time restricted to TrainingWorkspace imports only. |

**Role Behavior:**

| Role | Behavior |
|---|---|
| All | Identical |

**Accessibility:**
- Screen reader label: `role="status"`, `aria-label="Simulation mode active — [SIMULATION_TYPE]"`
- Keyboard navigation: Not focusable
- Minimum touch target: N/A

**Audit Requirements:**
- No audit events. Simulation actions are not production records.

---

### TrainingCertificationPanel

**Category:** Training Surface
**Purpose:** Displays operator certification progress, completed modules, certification level, and next-required module; used within TrainingWorkspace.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `operator_id` | `string` | Yes | Operator whose certification is displayed |
| `certification_level` | `1 \| 2 \| 3 \| 4` | Yes | Current certification level |
| `completed_modules` | `ModuleSummary[]` | Yes | Modules completed with scores |
| `required_modules` | `ModuleSummary[]` | Yes | Modules required for next level |
| `skill_decay_detected` | `boolean` | Yes | Whether skill decay pattern detected |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `certification_panel_viewed` | Component enters viewport | None (observability) |
| `module_selected` | Operator selects a module to begin | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `current_level` | Normal display | Certification badge with level; progress toward next level |
| `skill_decay_warning` | `skill_decay_detected: true` | Amber warning: "Skill decay detected — re-certification recommended" |
| `level_complete` | All required modules for level complete | Completion state; [View Certificate] if applicable |
| `loading` | Data fetch | Skeleton |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| TRAINING | Normal |
| All others | Must not be rendered outside TrainingWorkspace |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Can view own certification; cannot view others |
| OPERATOR | Can view own certification; cannot view others |
| ADMIN | Can view any operator's certification within their scope |

**Accessibility:**
- Minimum touch target: module selection items — 44×44px
- Screen reader label: `role="region"`, `aria-label="Certification panel — Level [N] — [N] modules complete"`
- Keyboard navigation: Tab through module items; Enter selects
- Focus management: Standard tab flow

**Audit Requirements:**
- No Class A events. Certification data is informational, not an operational record.

---

## 8. Extended Canonical Components

These components are not in the original 22-component taxonomy but are required by two or more canonical surfaces. Each meets the reusability threshold.

---

### TimelineComponent

**Category:** Extended
**Purpose:** Horizontal time-axis visualization of corpus events across a session time range; used in ReplayForensicsWorkspace (RP-TIMELINE) and VenueDashboardWorkspace (Venue Timeline section).

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `time_range_start` | `ISO8601 string` | Yes | Session start |
| `time_range_end` | `ISO8601 string` | Yes | Session end |
| `events` | `TimelineEvent[]` | Yes | Corpus events to render; each: `{ event_id, type, governed_timestamp, source }` |
| `annotations` | `AnnotationMarker[]` | No | Annotation markers to overlay on events |
| `playhead_timestamp` | `ISO8601 string \| null` | No | Current playhead position; shown as vertical red dashed line |
| `playback_state` | `'playing' \| 'paused' \| 'scrubbing'` | No | Controls playhead animation |
| `readonly` | `boolean` | No | Disables playhead dragging. Default: false |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `timeline_event_selected` | Operator clicks an event marker | None (observability) |
| `timeline_playhead_moved` | Operator drags playhead to new position | None (observability) |
| `timeline_zoom_changed` | Zoom level changes | None (observability) |
| `timeline_annotation_selected` | Operator clicks an annotation marker | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `loading` | Events being fetched | Skeleton timeline bar |
| `empty` | No events in range | "No events in this time range" message |
| `playing` | `playback_state: 'playing'` | Playhead moves; green `▶ REPLAYING` indicator |
| `paused` | `playback_state: 'paused'` | Static playhead; amber `⏸ PAUSED` indicator |
| `scrubbing` | `playback_state: 'scrubbing'` | Blue `◁ SCRUBBING` indicator; notifications deferred up to 15s |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Venue timeline shows recent events without playback controls |
| REPLAY | Full playback controls; playhead draggable |
| INCIDENT | Timeline shows incident-relevant events filtered by default |
| DEGRADED | Best-available event stream; gaps indicated |
| EMERGENCY_FREEZE | Emergency events highlighted |
| TRAINING | Simulation events only |

**Accessibility:**
- Minimum touch target: event markers — 24px diameter minimum; playhead handle — 24px wide
- Screen reader label: `role="region"`, `aria-label="Event timeline — [TIME_RANGE]"`
- Keyboard navigation: Arrow keys move playhead by one event when focused; Tab through playback controls
- Focus management: On event selection, focus to event detail panel

**Audit Requirements:**
- No Class A events. Timeline navigation is observability only.

---

### AnnotationCard

**Category:** Extended
**Purpose:** Renders a single annotation with confidence badge, author, anchor, full text, IMMUTABLE badge, and SUPERSEDED state; used in ReplayForensicsWorkspace Annotations tab and IC Command Log.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `annotation_id` | `string` | Yes | Annotation identifier |
| `confidence` | `CONFIRMED \| PROBABLE \| SPECULATIVE` | Yes | Author-assigned confidence |
| `author_name` | `string` | Yes | Display name of author |
| `authored_at` | `ISO8601 string` | Yes | Governed timestamp of writing |
| `anchor_description` | `string` | Yes | Human-readable anchor text |
| `text` | `string` | Yes | Full annotation body |
| `superseded` | `boolean` | Yes | Whether this annotation has been superseded |
| `superseded_by_id` | `string \| null` | No | ID of superseding annotation |
| `supersedes_id` | `string \| null` | No | ID of annotation this one supersedes |
| `finding_citations` | `string[]` | No | Finding IDs that cite this annotation |
| `show_supersede_action` | `boolean` | No | Whether to show [Supersede this annotation] button. Default: false |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `annotation_supersede_initiated` | Operator clicks [Supersede this annotation] | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `active` | `superseded: false` | Full opacity; confidence badge colored; IMMUTABLE badge |
| `superseded` | `superseded: true` | Grey-tinted background; 50% opacity text; "SUPERSEDED" watermark; link to superseding annotation; text remains fully readable (no hidden content) |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Not typically rendered in live mode |
| REPLAY | Primary use case; IMMUTABLE badge always present |
| INCIDENT | Command log annotations rendered here |
| DEGRADED | No change |
| EMERGENCY_FREEZE | No change |
| TRAINING | Not applicable |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | `show_supersede_action` must be false |
| OPERATOR | `show_supersede_action` may be true for own annotations |
| ADMIN | `show_supersede_action` may be true |

**Accessibility:**
- Minimum touch target: [Supersede] button — 44×44px
- Screen reader label: `role="article"`, `aria-label="Annotation by [AUTHOR] — [CONFIDENCE] — written [DATE]"`; if superseded: "SUPERSEDED annotation by [AUTHOR]"
- Keyboard navigation: Tab to [Supersede] button if present
- Focus management: Standard

**Audit Requirements:**
- `annotation:supersede:initiated` — Class A, payload: `{ annotation_id, operator_id, session_id }`

---

### FindingCard

**Category:** Extended
**Purpose:** Renders a single operational finding with severity, summary, evidence citations, and resolution status; used in ReplayForensicsWorkspace Findings tab.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `finding_id` | `string` | Yes | Finding identifier |
| `severity` | `CRITICAL \| MAJOR \| MINOR \| INFORMATIONAL` | Yes | Finding severity |
| `summary` | `string` | Yes | One-to-two sentence summary |
| `cited_annotations` | `string[]` | Yes | Annotation IDs cited as evidence |
| `authored_by` | `string` | Yes | Author name |
| `authored_at` | `ISO8601 string` | Yes | Governed timestamp |
| `resolution_status` | `OPEN \| IN_PROGRESS \| RESOLVED` | Yes | Finding resolution state |
| `show_edit_action` | `boolean` | No | Whether to render edit controls. Default: false |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `finding_edit_initiated` | Operator initiates edit | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `open` | `resolution_status: OPEN` | Severity-colored left border; "OPEN" badge |
| `in_progress` | `resolution_status: IN_PROGRESS` | Amber badge; progress indicator |
| `resolved` | `resolution_status: RESOLVED` | Grey treatment; "RESOLVED" badge with timestamp |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| REPLAY | Primary use case; finding is forensic record |
| All others | Findings are replay-context artifacts; not rendered in live operational views |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | `show_edit_action` must be false |
| OPERATOR | `show_edit_action` may be true for own findings |
| ADMIN | Full access |

**Accessibility:**
- Minimum touch target: edit button — 44×44px
- Screen reader label: `role="article"`, `aria-label="Finding [ID] — [SEVERITY] — [RESOLUTION_STATUS]"`
- Keyboard navigation: Tab to edit button if present
- Focus management: Standard

**Audit Requirements:**
- `finding:edit:initiated` — Class A, payload: `{ finding_id, operator_id, session_id }`

---

### ReplayControls

**Category:** Extended
**Purpose:** Playback control bar for replay session navigation: jump to start/end, step by event, pause/resume, speed selection; used in ReplayForensicsWorkspace RP-TIMELINE.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `playback_state` | `'playing' \| 'paused' \| 'scrubbing'` | Yes | Current state |
| `speed` | `0.25 \| 0.5 \| 1 \| 2 \| 4` | Yes | Current playback speed |
| `at_start` | `boolean` | Yes | Whether playhead is at session start |
| `at_end` | `boolean` | Yes | Whether playhead is at session end |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `replay_play_toggled` | Pause/resume pressed | None (observability) |
| `replay_stepped_forward` | Step forward pressed | None (observability) |
| `replay_stepped_backward` | Step backward pressed | None (observability) |
| `replay_jumped_to_start` | Jump to start pressed | None (observability) |
| `replay_jumped_to_end` | Jump to end pressed | None (observability) |
| `replay_speed_changed` | Speed selector pressed | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `playing` | `playback_state: 'playing'` | Pause icon shown on toggle button |
| `paused` | `playback_state: 'paused'` | Play icon shown on toggle button |
| `at_start` | `at_start: true` | Jump-to-start and step-back buttons disabled |
| `at_end` | `at_end: true` | Jump-to-end and step-forward buttons disabled |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| REPLAY | Full control bar rendered |
| All others | Not applicable — this component exists only in replay sessions |

**Role Behavior:**
All roles with replay access use identical controls.

**Accessibility:**
- Minimum touch target: all control buttons — 44×44px
- Screen reader label: each button with `aria-label` (e.g., "Play", "Pause", "Step forward", "Jump to start")
- Keyboard navigation: Tab through buttons; Space activates play/pause; arrow keys for step
- Focus management: Standard

**Audit Requirements:**
- No Class A events. Playback navigation is not an operational action.

---

### CommandLogEntry

**Category:** Extended
**Purpose:** Renders a single entry in the incident command log with timestamp, operator, role badge, event type pill, body text, and authority level; used in IncidentCommandWorkspace Tab 2.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `entry_id` | `string` | Yes | Log entry identifier |
| `governed_timestamp` | `ISO8601 string` | Yes | Governed timestamp of the event |
| `operator_name` | `string` | Yes | Display name; "System" for system-generated entries |
| `role` | `VIEWER \| OPERATOR \| ADMIN \| SYSTEM` | Yes | Source role or "SYSTEM" |
| `event_type` | `string` | Yes | Audit event type label |
| `body_text` | `string` | Yes | Human-readable event description |
| `authority_level` | `'OPERATOR' \| 'ADMIN' \| 'SYSTEM'` | Yes | Authority level label |
| `is_commander_lapsed_entry` | `boolean` | No | Special full-width styling for COMMANDER_LAPSED events |
| `is_level1_alert_entry` | `boolean` | No | Special full-width styling for Level 1 alert events |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| None | Display-only | — |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `normal` | Standard entry | Standard row layout |
| `commander_lapsed` | `is_commander_lapsed_entry: true` | Full-width row; `#B71C1C` 6px left border; amber background 10% opacity |
| `level1_alert` | `is_level1_alert_entry: true` | Full-width row; `#C62828` background 15% opacity; `#C62828` 6px left border |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current log entries; new entries append via WebSocket |
| REPLAY | Historical log from corpus; new entries do not append |
| All others | Not applicable outside IC context |

**Accessibility:**
- Minimum touch target: N/A — display-only
- Screen reader label: `role="listitem"`, `aria-label="[TIMESTAMP] — [OPERATOR_NAME] — [EVENT_TYPE]"`
- Keyboard navigation: Not focusable
- Focus management: Auto-scroll to latest entry managed by parent

**Audit Requirements:**
- No audit events. Log entries are rendered records of events already audited at source.

---

### ShiftHandoffCard

**Category:** Extended
**Purpose:** Displays the shift handoff package for operator review; renders five sections (situation summary, incidents, overrides, open decisions, acknowledgement); used in handoff workflow.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `handoff_id` | `string` | Yes | Handoff package identifier |
| `from_operator_name` | `string` | Yes | Outgoing operator name |
| `to_operator_name` | `string` | Yes | Incoming operator name |
| `situation_summary` | `SituationSummary` | Yes | Current venue states |
| `active_incidents` | `IncidentSummary[]` | Yes | Active incidents in scope |
| `pending_overrides` | `OverrideEntry[]` | Yes | Active overrides with expiry |
| `open_decisions` | `Decision[]` | Yes | Decisions requiring follow-up |
| `server_confirmed_steps` | `number[]` | Yes | Step numbers confirmed by server (1–5) |
| `replay_mode` | `boolean` | Yes | AS-01 guard for acknowledgement action |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `handoff_step_acknowledged` | Each section reviewed and submitted | Class A |
| `handoff_accepted` | All steps confirmed and final accept submitted | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `step_pending` | Current step not yet submitted | Step form interactive |
| `step_confirmed` | `server_confirmed_steps` includes step number | Step rendered as read-only completed |
| `all_steps_confirmed` | All 5 steps in `server_confirmed_steps` | [Accept Handoff] button enabled |
| `accepting` | Accept in flight | Loading overlay on [Accept Handoff] |
| `accepted` | Server confirms | Success state; package archived |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full handoff flow |
| REPLAY | Write controls absent (AS-01); historical handoff package displayed |
| All others | Standard |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Absent from DOM (handoff is an OPERATOR+ action) |
| OPERATOR | Full handoff receipt and acknowledgement |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: step action buttons and [Accept Handoff] — 44×44px
- Screen reader label: `role="form"`, `aria-label="Shift handoff package — Step [N] of 5"`
- Keyboard navigation: Tab through step form fields; Escape does not dismiss (handoff cannot be abandoned without explicit cancel)
- Focus management: On step advance, focus to first field of new step

**Audit Requirements:**
- `handoff:step:acknowledged` — Class A, payload: `{ handoff_id, step_number, operator_id, server_confirmed: boolean }`
- `handoff:workflow:accepted` — Class A, payload: `{ handoff_id, from_operator_id, to_operator_id }`

---

### CorpusDiffView

**Category:** Extended
**Purpose:** Side-by-side comparison of two corpus states (PRE resolution, constitutional state, override stack) at two different timestamps; used in ReplayForensicsWorkspace divergence and IC Tab 1 Section D.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `left_label` | `string` | Yes | Label for left column (e.g., "At declaration") |
| `right_label` | `string` | Yes | Label for right column (e.g., "Current") |
| `left_state` | `StateSnapshot` | Yes | State data for left column |
| `right_state` | `StateSnapshot` | Yes | State data for right column |
| `highlight_differences` | `boolean` | No | Whether to highlight changed fields. Default: true |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `corpus_diff_field_expanded` | Operator expands a changed field | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `no_diff` | All fields identical | Standard two-column layout; no highlighting |
| `diff_present` | One or more fields differ | Changed fields highlighted with amber background in right column |
| `loading` | State data being fetched | Skeleton in both columns |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| REPLAY | Primary use case; both columns from corpus |
| INCIDENT | IC Tab 1 Section D: left=at declaration, right=now |
| All others | Can be used wherever state comparison is needed |

**Accessibility:**
- Minimum touch target: expand buttons — 44×44px
- Screen reader label: `role="region"`, `aria-label="State comparison — [LEFT_LABEL] vs [RIGHT_LABEL]"`
- Keyboard navigation: Tab through expandable rows
- Focus management: On field expand, focus to expanded content

**Audit Requirements:**
- No Class A events. Comparison is a read-only forensic operation.

---

### AutonomyClockDisplay

**Category:** Extended
**Purpose:** Displays the remaining corpus-based operational autonomy for a venue's devices; critical when connectivity is lost; used in ConnectivityDisplay and Venue Dashboard.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `autonomy_hours_remaining` | `number` | Yes | Hours of autonomy remaining |
| `last_corpus_sync_at` | `ISO8601 string` | Yes | When corpus was last synced to devices |
| `venue_id` | `string` | Yes | Venue identifier |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `autonomy_threshold_crossed` | Autonomy drops below warning or critical threshold | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `healthy` | `autonomy_hours_remaining >= 24` | Green clock icon; "[N]h autonomy remaining" |
| `warning` | `autonomy_hours_remaining < 24` | Amber clock icon; amber text; "Corpus sync recommended" |
| `critical` | `autonomy_hours_remaining < 4` | Red pulsing clock; red text; "CORPUS SYNC REQUIRED — [N]h remaining" |
| `expired` | `autonomy_hours_remaining <= 0` | Red static; "AUTONOMY EXPIRED — device may have stopped playing" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Real-time autonomy countdown |
| REPLAY | Historical autonomy state from corpus |
| INCIDENT | Autonomy prominently visible; critical state highlighted |
| DEGRADED | If connectivity lost, autonomy clock is most critical display |
| EMERGENCY_FREEZE | No change |
| TRAINING | Simulated autonomy values |

**Accessibility:**
- Minimum touch target: N/A — display-only
- Screen reader label: `aria-label="Autonomy: [N] hours remaining — [STATE]"`; if critical: "CRITICAL — [N] hours remaining"
- Keyboard navigation: Not focusable
- Focus management: None

**Audit Requirements:**
- No Class A events. Autonomy state is system-derived, not an operator action.

---

### RecoveryWorkflowStepper

**Category:** Extended
**Purpose:** Five-step sequential venue recovery checklist; each step server-confirmed before next renders; Step 4 requires ADMIN authority; used in VenueDashboardWorkspace and IncidentCommandWorkspace.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `venue_id` | `string` | Yes | Recovery target venue |
| `current_step` | `1 \| 2 \| 3 \| 4 \| 5` | Yes | Server-confirmed current active step |
| `completed_steps` | `number[]` | Yes | Steps confirmed by server |
| `operator_role` | `VIEWER \| OPERATOR \| ADMIN` | Yes | Current operator role |
| `replay_mode` | `boolean` | Yes | AS-01 guard |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `recovery_step_submitted` | Step submitted to server | Class A |
| `recovery_step_confirmed` | Server confirms step | Class A |
| `recovery_workflow_completed` | All 5 steps confirmed | Class A |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `step_active` | Step is current | Interactive form rendered; confirm button present |
| `step_completed` | Step in `completed_steps` | Read-only completed row; green checkmark |
| `step_pending_confirmation` | Step submitted, awaiting server | Loading indicator; form frozen |
| `step_admin_required` | `current_step: 4`, `operator_role: OPERATOR` | "ADMIN authorization required" panel; [Request Authorization] flow; step 4 form absent |
| `step_error` | Server returns error | Error inline; retry button; step not advanced |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Full sequential workflow |
| REPLAY | Returns null (AS-01) |
| INCIDENT | Available in IC-BOTTOM recovery section |
| DEGRADED | Server confirmation may be slow; loading states extended |
| EMERGENCY_FREEZE | Recovery workflow available post-clearance |
| TRAINING | Routes to simulation endpoint |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Absent from DOM |
| OPERATOR | Steps 1–3, 5 interactive; Step 4 shows admin-required panel |
| ADMIN | All 5 steps interactive |

**Accessibility:**
- Minimum touch target: step action buttons — 44×44px
- Screen reader label: `role="form"`, `aria-label="Recovery workflow — [VENUE_NAME] — Step [CURRENT] of 5"`
- Keyboard navigation: Tab through step fields; Escape does not skip step
- Focus management: On step server confirmation, focus to first field of new step

**Audit Requirements:**
- `recovery:step:submitted` — Class A, payload: `{ venue_id, step_number, operator_id }`
- `recovery:step:confirmed` — Class A, payload: `{ venue_id, step_number, server_confirmed: boolean }`
- `recovery:workflow:completed` — Class A, payload: `{ venue_id, total_duration_ms, completing_operator_id }`

---

### ContentDeliveryStatusRow

**Category:** Extended
**Purpose:** Displays a single content item's delivery status to a venue or screen set including sync state, corpus hash match, and last delivery timestamp; used in CMSContentWorkspace and VenueDashboardWorkspace.

**Inputs (Props):**

| Prop | Type | Required | Description |
|---|---|---|---|
| `content_id` | `string` | Yes | Content identifier |
| `content_name` | `string` | Yes | Display name |
| `delivery_state` | `DELIVERED \| PENDING \| FAILED \| PARTIAL` | Yes | Current delivery status |
| `corpus_hash_match` | `boolean \| null` | Yes | Whether corpus hash matches expected; null if not yet verified |
| `delivered_at` | `ISO8601 string \| null` | No | Governed timestamp of successful delivery |
| `last_attempt_at` | `ISO8601 string \| null` | No | Timestamp of most recent delivery attempt |
| `affected_screen_count` | `number` | Yes | Number of screens targeted |

**Outputs (Events emitted):**

| Event | When | Audit class |
|---|---|---|
| `content_delivery_row_expanded` | Operator expands row detail | None (observability) |

**States:**

| State | Trigger | Visual treatment |
|---|---|---|
| `delivered` | `delivery_state: DELIVERED`, `corpus_hash_match: true` | Green checkmark; delivered timestamp |
| `pending` | `delivery_state: PENDING` | Amber spinner; "Delivery in progress" |
| `failed` | `delivery_state: FAILED` | Red X; last attempt timestamp; retry initiated by separate action |
| `partial` | `delivery_state: PARTIAL` | Amber warning; "[N] of [N] screens received" |
| `hash_mismatch` | `corpus_hash_match: false` | Red exclamation; "Hash mismatch — corpus integrity check failed" |
| `hash_unverified` | `corpus_hash_match: null` | Grey indicator; "Hash not yet verified" |

**Mode Behavior:**

| Mode | Behavior |
|---|---|
| LIVE | Current delivery state |
| REPLAY | Historical delivery state from corpus |
| INCIDENT | Delivery status during incident timeframe |
| DEGRADED | Best-available delivery data |
| EMERGENCY_FREEZE | No change |
| TRAINING | Simulated delivery state |

**Role Behavior:**

| Role | Behavior |
|---|---|
| VIEWER | Read-only |
| OPERATOR | Read-only; retry actions handled by separate action surface |
| ADMIN | Same as OPERATOR |

**Accessibility:**
- Minimum touch target: expand button — 44×44px
- Screen reader label: `role="row"`, `aria-label="[CONTENT_NAME] — [DELIVERY_STATE] — [N] screens"`
- Keyboard navigation: Tab to expand button; Enter expands
- Focus management: Standard

**Audit Requirements:**
- No Class A events from this display component. Content delivery retry actions emit Class A events from their action surface.

---

*End of CANONICAL-UI-COMPONENT-CATALOG-v1*
