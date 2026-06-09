# Frontend Component Taxonomy — v1

**Document type:** Implementation-grade architecture specification
**Audience:** Frontend engineering team
**Status:** Authoritative — do not deviate without architectural review
**Scope:** Every component category in the frontend application, with responsibilities, dependency rules, lifecycle contracts, and observability requirements

---

## Definitions

**Component category:** A classification of components by structural role. Components in the same category share dependency rules and lifecycle expectations.

**Import dependency:** A compile-time relationship. Component A imports Component B. This creates a build-time coupling that cannot be broken at runtime.

**Audit event:** A structured event emitted to the audit sink. Audit events are not UI telemetry — they are operational records of operator actions and system state changes.

**REPLAY mode:** The application mode active when the ReplayForensicsWorkspace is mounted and the current investigation session has `_replay: true`. All write-capable controls must self-suppress in REPLAY mode.

**Write-capable control:** Any UI element that, if activated, would issue a write request to the production backend. This includes buttons, form submissions, toggles, and confirmation dialogs.

**Confidence level:** A server-computed property (`HIGH | MEDIUM | LOW | NONE`) attached to constitutional state and health indicators. It must always be rendered alongside the status value.

---

## Component Categories

### Category 1: Shell Components

Shell components form the application frame. They mount once at session start, persist for the session lifetime, and must never contain business logic or workspace-specific data.

---

#### ApplicationShell

**Responsibility:** Renders the three-zone layout (Zone A, Zone B, Zone C), System Status Bar, and Audit Trace Footer. Manages zone visibility and collapse state.

**Ownership:** Platform shell team. No workspace team may modify ApplicationShell.

**Allowed dependencies:**
- SystemStatusBar
- AuditTraceFooter
- ZoneAPanel
- WorkspaceRouter
- ZoneCPanel
- Layout primitives (CSS variables, grid containers)

**Forbidden dependencies:**
- Any workspace component (items 6–11)
- Any operational surface component (items 12–20)
- Any data-fetching hook or API client
- Any component that contains business logic

**Lifecycle:**
- Mounts once when the authenticated session is established.
- Never unmounts while the session is active.
- On session expiry, ApplicationShell renders a session-expired overlay without unmounting. The overlay prevents interaction but preserves layout continuity.
- Zone B content (WorkspaceRouter) mounts and unmounts as routes change. The shell itself does not re-render on route changes.

**Observability:**
- Emits `shell_zone_layout_changed` on any zone width or visibility change. Payload: `{ zone: 'A' | 'B' | 'C', previous_state, new_state, triggered_by: 'operator' | 'system' }`.
- Emits `shell_session_expiry_overlay_shown` when the session-expired overlay appears.
- Does not emit route change events — route changes are the responsibility of the routing layer.

**Rules:**
Approved: ApplicationShell reads zone collapse state from `localStorage` keyed by `operator_id` to restore the last-used layout on login.
Forbidden: ApplicationShell fetching any operational data (venue states, incidents, constitutional state). It receives constitutional state as a prop from the session provider, never by fetching it.
Operational consequence: If the shell fetches operational data, it creates a second subscription path that can diverge from the authoritative subscription in SystemStatusBar, producing split views.
Verification: Confirm ApplicationShell has zero API calls in its network traffic. Confirm it renders correctly with all data props absent (graceful degradation).

---

#### SystemStatusBar

**Responsibility:** Renders the constitutional state badge, session clock, notification count, and active mode indicator (LIVE / REPLAY / INCIDENT / DEGRADED / EMERGENCY_FREEZE). Always visible at 48px fixed top.

**Ownership:** Platform shell team.

**Required data props:**
- `constitutional_state`: state, confidence, computed_at, freshness
- `session_duration_seconds`: integer, derived from session_start
- `unread_notification_count`: integer
- `active_mode`: LIVE | REPLAY | INCIDENT | DEGRADED | EMERGENCY_FREEZE

**Allowed dependencies:**
- ConstitutionalStateIndicator (for the constitutional state badge)
- Design token primitives

**Forbidden dependencies:**
- Any workspace component
- Any data-fetching hook (data arrives via props from the session/subscription provider)
- Any component that may be occluded by another component at z-index below the status bar

**Lifecycle:**
- Mounts with ApplicationShell. Never unmounts.
- Receives real-time constitutional state via WebSocket subscription managed by the session provider. The status bar itself does not subscribe — it receives updates as props.
- Session clock updates every second via a local timer. The timer is driven by `session_start` from the server, not by `Date.now()`. Clock drift relative to the server is corrected on each session context refresh.

**Z-index contract:** SystemStatusBar must be rendered at the highest z-index layer in the application. No other component may render above it. This is a constitutional constraint: the constitutional state must always be visible. This includes modals, overlays, drawers, notification panels, and toast messages.

**Observability:**
- Emits `status_bar_constitutional_state_change` when the rendered state changes. Payload: `{ previous_state, new_state, confidence, freshness }`.
- Emits `status_bar_mode_change` when the active mode indicator changes. Payload: `{ previous_mode, new_mode }`.

**Rules:**
Approved: EMERGENCY_FREEZE state renders the status bar with a distinct background (red) and a pulsing indicator. The state badge and confidence level are both visible.
Forbidden: Any other component placing a `position: fixed` element above the status bar. All fixed-position overlays must be z-index bounded below the status bar.
Operational consequence: If a modal or overlay covers the constitutional state, operators lose the only persistent view of system health, which is a constitutional display violation.
Verification: Render every modal, overlay, drawer, and toast in the application while SystemStatusBar is present. Confirm status bar is fully visible in all cases.

---

#### AuditTraceFooter

**Responsibility:** Renders the last PRE event and last audit trail entry. Always visible at 28px fixed bottom.

**Ownership:** Platform shell team.

**Required data props:**
- `last_pre_event`: { event_type, governed_timestamp, venue_id, level }
- `last_audit_entry`: { action_type, authored_by, governed_timestamp }

**Allowed dependencies:**
- Design token primitives only

**Forbidden dependencies:**
- Any interactive component (buttons, links, form elements)
- Any data-fetching hook
- Any component that would make any part of the footer interactive

**Lifecycle:**
- Mounts with ApplicationShell. Never unmounts.
- Updates when the session provider pushes new audit events or PRE events.

**Interactivity constraint:** The AuditTraceFooter is read-only. It must contain no clickable elements, no form controls, no navigation links, and no tooltips that require user interaction. It is a passive display.

**Observability:**
- Does not emit events. It is a passive display component.

**Rules:**
Approved: Footer truncates long event descriptions with ellipsis. Full text is available via CSS `title` attribute for accessibility.
Forbidden: Adding a "View full audit trail" link or any interactive element to the footer.
Operational consequence: If the footer becomes interactive, operators may attempt to use it for navigation during incidents, conflicting with Zone B and Zone A navigation contracts.
Verification: Inspect AuditTraceFooter DOM; confirm no `<button>`, `<a>`, `<input>`, or event handler elements are present.

---

#### ZoneAPanel

**Responsibility:** Renders all Zone A panes: VenueSelector (A1), IncidentList (A2), NotificationTray access (A3), OperatorTools (A4).

**Ownership:** Platform shell team.

**Allowed dependencies:**
- VenueSelector (A1 pane component)
- IncidentList (A2 pane component)
- NotificationTrayAccess (A3 pane component)
- OperatorTools (A4 pane component)
- Design token primitives

**Forbidden dependencies:**
- Any workspace component (items 6–11)
- Any operational surface component that reads Zone B state
- Any hook or subscription that reads the current Zone B route

**Lifecycle:**
- Mounts with ApplicationShell. Never unmounts.
- Each pane manages its own subscriptions (venue list, incident list, notification count). Pane subscriptions are independent.
- Zone A pane content is not rebuilt on Zone B route changes.

**Observability:**
- Emits `zone_a_venue_selected` when operator clicks a venue in Pane A1. Payload: `{ venue_id, previous_venue_id }`.
- Emits `zone_a_incident_selected` when operator clicks an incident in Pane A2. Payload: `{ incident_id }`.
- Emits `zone_a_notification_tray_opened` when operator opens notification tray.
- Emits `zone_a_operator_tool_activated` when operator activates a tool in Pane A4. Payload: `{ tool_name }`.

**Rules:**
Approved: Zone A panes subscribe to their own data via the session provider's venue and incident streams.
Forbidden: Zone A receiving updates from Zone B workspace components. No prop drilling, context sharing, or event bus coupling between Zone B and Zone A.
Operational consequence: If Zone A updates in response to Zone B state, the navigation surface becomes unreliable during workspace transitions, which is critical during incident response when Zone B may be transitioning between workspaces.
Verification: Navigate between all Zone B workspaces and assert Zone A's venue list, incident list, and notification count remain unchanged.

---

### Category 2: Workspace Components

Workspace components render in Zone B. They mount when their route is active and unmount when the route changes. They must not import from each other (Rule CG-01).

---

#### WorkspaceRouter

**Responsibility:** Selects and renders the correct workspace component based on the current route. Manages workspace mount/unmount lifecycle and handles workspace transitions.

**Ownership:** Platform shell team.

**Allowed dependencies:**
- All workspace components (items 6–11) — but only one may be rendered at a time

**Forbidden dependencies:**
- Operational surface components (items 12–20) — workspaces may use these, but WorkspaceRouter itself must not
- Any zone A or zone C component

**Lifecycle:**
- Renders exactly one workspace component at a time.
- On route change, the previous workspace unmounts before the new workspace mounts. No simultaneous rendering of two workspaces.
- Workspace transitions must produce a loading state (not a blank Zone B) during data fetch. The loading state is a WorkspaceRouter responsibility, not each workspace's responsibility.

**State survival contract:**
The following state survives workspace unmount by being persisted in the session provider or `localStorage`:

| State | Persistence mechanism | Key |
|---|---|---|
| CMS active tab | `localStorage` | `cms_active_tab:{operator_id}` |
| Replay active tab | `localStorage` | `replay_active_tab:{operator_id}:{session_id}` |
| Zone C collapse state | `localStorage` | `zone_c_state:{operator_id}` |
| IC sub-zone layout | `localStorage` | `ic_layout:{operator_id}:{incident_id}` |

State that does not survive unmount:
- Filter values in any workspace (reset on remount)
- Form in-progress data (prompt to save or discard before navigating away)
- Scroll position within workspace (reset to top on remount)

**Observability:**
- Emits `workspace_mounted` when a workspace component finishes mounting and renders content. Payload: `{ workspace_name, route_path, mount_duration_ms }`.
- Emits `workspace_unmounted` when a workspace unmounts. Payload: `{ workspace_name, time_in_workspace_ms }`.

---

#### VenueOperationsDashboard

**Responsibility:** Renders the per-venue operational view with five sections: Identity Header, Player Health, Content & PRE Status, Intervention Surface, and Venue Timeline.

**Ownership:** Venue operations team.

**Allowed dependencies:**
- VenueStatusDisplay
- PREExplainability
- RecoveryWorkflow
- InterventionSurface
- VenueTimeline
- OverrideStack (read-only mode, no placement actions)
- ConstitutionalStateIndicator
- Design token primitives

**Forbidden dependencies:**
- IncidentCommanderSurface (or any of its sub-components)
- ReplayForensicsWorkspace (or any of its sub-components)
- CMSWorkspace or any CMS sub-component
- TrainingWorkspace or any training sub-component

**Lifecycle:**
- Mounts when route is `/venues/:venue_id`.
- On mount, initiates subscriptions for: player state, PRE resolution, override stack, active incidents, venue heartbeat.
- On unmount, all subscriptions are cancelled.
- Route change from one venue to another produces an unmount/mount cycle (not a data refresh). This ensures clean subscription state.

**Observability:**
- Emits `venue_dashboard_loaded` with `{ venue_id, load_duration_ms, sections_rendered: string[] }`.
- Emits `venue_dashboard_section_visible` when each section enters the viewport (for time-to-interactive measurement).

**Rules:**
Approved: The Intervention Surface section is conditionally rendered based on player state. If `player_state.machine_state` is LIVE and no active incidents, intervention controls are visible but in passive state.
Forbidden: Rendering IncidentDeclaration within VenueOperationsDashboard. Incident declaration is accessible via a button that navigates to the IC surface, not an embedded form.
Operational consequence: If the IC surface is embedded in the venue dashboard, operators lose the full IC workspace context (IC-TOP, IC-LEFT, IC-RIGHT, IC-BOTTOM) and cannot perform structured incident response.
Verification: Confirm VenueOperationsDashboard imports do not include any class or component from the IncidentCommanderSurface module.

---

#### IncidentCommanderSurface

**Responsibility:** Renders the incident response workspace with four sub-zones: IC-TOP (incident header, severity, commander status), IC-LEFT (blast radius, affected venues), IC-RIGHT (PRE trace, override stack), IC-BOTTOM (incident log, recovery actions).

**Ownership:** Incident management team.

**Allowed dependencies:**
- IncidentHeader (IC-TOP component)
- BlastRadiusPanel (IC-LEFT component)
- PRE trace and override stack components (IC-RIGHT)
- IncidentLog (IC-BOTTOM component)
- RecoveryWorkflow (for recovery actions within IC-BOTTOM)
- ConstitutionalStateIndicator
- PREExplainability

**Forbidden dependencies:**
- VenueOperationsDashboard or any of its sub-components
- CMSWorkspace or any CMS sub-component
- TrainingWorkspace
- ReplayForensicsWorkspace

**Authority:**
- VIEWER: route renders but all action controls are absent (not disabled).
- OPERATOR (non-IC): route renders; action controls visible but disabled with "Requires Incident Commander role" message.
- OPERATOR (IC role): full access to declaration, annotation, and recovery workflow controls.

**IC sub-zone layout:**
IC-TOP, IC-LEFT, IC-RIGHT, IC-BOTTOM are layout positions, not navigable routes. They must be rendered simultaneously within Zone B. The layout is resizable within each quadrant but the four-zone structure is constitutional.

**Lifecycle:**
- Mounts when route is `/incidents/:incident_id` or `/venues/:venue_id/incident/:incident_id`.
- On mount, initiates WebSocket subscription for: incident log (must update in ≤2 seconds), blast radius venue states, command status.
- On unmount, subscriptions are cancelled. Incident data is not persisted locally beyond the session.

**Observability:**
- Emits `ic_surface_loaded` with `{ incident_id, commander_id, severity, load_duration_ms }`.
- Emits `ic_commander_status_change` when command status changes. Payload: `{ incident_id, previous_commander_id, new_commander_id, lapsed: boolean }`.
- Emits `ic_annotation_submitted` when an annotation is submitted. Payload: `{ incident_id, annotation_id }`.

**Rules:**
Approved: When the current operator is the Incident Commander and navigates away, a persistent banner appears in Zone B of the new workspace.
Forbidden: Rendering IncidentCommanderSurface as a panel, modal, or overlay within another workspace. It is always a full Zone B replacement.
Operational consequence: If IC is embedded in another workspace, the four sub-zones cannot render correctly, and the operator loses the structured response format that incident governance requires.
Verification: Navigate to an active incident from VenueOperationsDashboard; confirm Zone B fully replaces with IC surface and no venue dashboard content is visible.

---

#### ReplayForensicsWorkspace

**Responsibility:** Renders the replay investigation interface with four layout zones (RP-TOP, RP-TIMELINE, RP-MAIN, RP-DETAIL) and six analysis tabs.

**Ownership:** Forensics and replay team.

**Allowed dependencies:**
- RP-TOP (session header, mode indicator, time range controls)
- RP-TIMELINE (chronological event timeline)
- RP-MAIN (tab panel with 6 analysis tabs)
- RP-DETAIL (detail panel for selected timeline item)
- PREExplainability (read-only, within RP-MAIN tabs)
- OverrideStack (read-only, within Tab 3)
- ConstitutionalStateIndicator (read-only, historical context)

**Forbidden dependencies:**
- OverrideControl (write action — prohibited in REPLAY mode)
- IncidentDeclaration (write action — prohibited in REPLAY mode)
- HandoffWorkflow (write action — prohibited in REPLAY mode)
- RecoveryWorkflow (write action — prohibited in REPLAY mode)
- Any action surface component (items 16–19)
- Any workspace component (items 6–7, 9–11)

**REPLAY mode enforcement:**
REPLAY mode is activated by the presence of `session._replay: true` in the loaded session object. This is not a route-level flag — it is a data-level flag that must be checked by every sub-component within this workspace.

Approved: Each sub-component within ReplayForensicsWorkspace reads the replay context from a React context provider established by ReplayForensicsWorkspace on mount. Write-capable controls in shared components (e.g., PREExplainability if it ever gains an action) check this context and suppress themselves.
Forbidden: Relying solely on the route path to determine REPLAY mode. The data flag `session._replay: true` is the authoritative signal.
Operational consequence: If REPLAY mode is only route-enforced, a session marked as production that is accidentally loaded in the replay route would not be protected.
Verification: Load a replay session; attempt to render OverrideControl within the workspace (it must be absent from the DOM, not disabled); confirm `session._replay: true` is present in all data objects.

**Tab definitions:**

| Tab index | URL identifier | Minimum role | Data requirement |
|---|---|---|---|
| 1 | `pre-resolution-trace` | OPERATOR | `pre_traces[]` |
| 2 | `state-machine` | OPERATOR | `machine_transitions[]` |
| 3 | `override-stack` | OPERATOR | `override_history[]` |
| 4 | `corpus-evidence` | OPERATOR | `corpus_entries[]` |
| 5 | `divergence-comparison` | OPERATOR | `divergence_report` (optional — tab disabled if absent) |
| 6 | `counterfactual` | ADMIN | `counterfactual_capability: true` in session (tab absent for non-ADMIN) |

**Tab 6 absence rule:** Tab 6 must not be rendered (not in DOM) for non-ADMIN operators. It must not be disabled, greyed, or shown with a lock icon. ADMIN operators must not be able to infer that non-ADMIN operators are shown a different tab count.

**Lifecycle:**
- Mounts when route is `/venues/:venue_id/replay/:session_id` or `/replay/:session_id`.
- On mount: loads session object, verifies `_replay: true`, activates REPLAY mode context, fetches corpus timeline.
- REPLAY mode context is established before any sub-component renders.
- On unmount: REPLAY mode context is destroyed. Any subsequent workspace rendered in Zone B is not in REPLAY mode.

**Observability:**
- Emits `replay_session_loaded` with `{ session_id, venue_id, time_range_hours, replay_mode_confirmed: boolean }`.
- Emits `replay_tab_switched` when operator switches tabs. Payload: `{ from_tab, to_tab, session_id }`.
- Emits `replay_annotation_created` when operator creates an annotation. This is a permitted write action in replay sessions (annotations are forensic records, not production actions).

---

#### CMSWorkspace

**Responsibility:** Renders the content management surface with six tabs: Schedule Manager, Override Control, Content Library, Sponsorship Manager, Venue Assignments, Approval Queue.

**Ownership:** Content operations team.

**Allowed dependencies:**
- ScheduleManager (tab component)
- OverrideControl (tab component — action surface)
- ContentLibrary (tab component)
- SponsorshipManager (tab component)
- VenueAssignments (tab component)
- ApprovalQueue (tab component)
- PREExplainability (for PRE preview within Override Control and Schedule Manager)

**Forbidden dependencies:**
- VenueOperationsDashboard or any venue dashboard sub-component
- IncidentCommanderSurface
- ReplayForensicsWorkspace
- TrainingWorkspace

**Tab ownership:** Each tab is an independent sub-component that manages its own data subscriptions and does not read state from sibling tabs. Tab switching does not pass data between tabs.

**PRE preview contract:**
- PRE preview is mandatory before submission for L4–L6 overrides. The OverrideControl sub-component must gate the submit button behind a PRE preview load for these levels.
- PRE preview is advisory (but available) for L1–L3 overrides.
- PRE preview must use the `/preview` endpoint (not the production PRE resolution path).

**Lifecycle:**
- Mounts when route is `/cms` or any `/cms/*` sub-route.
- Active tab is determined by the URL path.
- On route change between CMS tabs: the outgoing tab sub-component does not unmount — tabs use CSS visibility, not DOM presence. This preserves filter and form state within a CMS session. Exception: if the operator has an in-progress L4+ override form, navigating to another CMS tab shows a "You have an unsaved override — leave without saving?" prompt.

**Observability:**
- Emits `cms_tab_activated` when a tab becomes active. Payload: `{ tab_name, previous_tab_name, operator_id }`.
- Emits `cms_form_abandoned` when an operator navigates away from an in-progress form. Payload: `{ tab_name, form_type, fields_populated: string[] }`.

---

#### TrainingWorkspace

**Responsibility:** Renders training and certification modules. Sandboxed — no production data, no production actions.

**Ownership:** Training and certification team.

**Allowed dependencies:**
- TrainingModuleList
- TrainingModuleViewer
- SimulationControls (instructor role only)
- TrainingBanner
- Certification progress components

**Forbidden dependencies:**
- Any operational surface component that accesses production data
- Any action surface component that issues production API calls
- VenueOperationsDashboard, IncidentCommanderSurface, or any production workspace component

**Sandboxing contract:**
- TrainingWorkspace must use the simulation API endpoint (separate from the production endpoint).
- All API responses consumed within TrainingWorkspace must carry `_simulation: true`.
- TrainingWorkspace must reject any API response without `_simulation: true` and render an error: "Training data source error — production data must not be used in training mode."

**Notification suppression:**
- Level 2–4 notifications (operational, campaign, sponsorship) must be suppressed during training mode. Suppression is achieved by pausing the notification subscription when TrainingWorkspace is the active Zone B component.
- Level 1 (constitutional emergency) must not be suppressed. Level 1 interrupts must penetrate training mode.

Approved: On TrainingWorkspace mount, the notification subscription is paused for L2–L4 notifications. Level 1 subscription remains active.
Forbidden: Suppressing Level 1 notifications during training mode under any circumstances.
Operational consequence: An operator in training who misses a Level 1 constitutional emergency because training mode suppressed it has not been warned of a genuine system crisis.
Verification: Simulate a Level 1 interrupt while TrainingWorkspace is active; confirm the interrupt renders in Zone B. Simulate a Level 3 notification; confirm it does not appear.

**Lifecycle:**
- Mounts when route is `/training` or `/training/:module_id` or `/training/simulation`.
- On mount: establishes simulation API context, activates TrainingBanner, pauses L2–L4 notification subscription.
- On unmount: restores L2–L4 notification subscription, removes TrainingBanner.

**Observability:**
- Emits `training_module_started` with `{ module_id, operator_id, certification_level_required }`.
- Emits `training_module_completed` with `{ module_id, operator_id, score, passed: boolean }`.
- Emits `training_simulation_started` with `{ operator_id, scenario_id }`.

---

#### FleetOverview

**Responsibility:** Multi-venue status display. Navigation surface — not an operational workspace. Shows aggregated venue health, active incident count, and constitutional state distribution across the fleet.

**Ownership:** Platform shell team.

**Allowed dependencies:**
- VenueStatusSummary (per-venue summary card — read-only)
- ConstitutionalStateIndicator (per-venue and fleet-level)
- Design token primitives

**Forbidden dependencies:**
- Any action surface component
- Any workspace component (FleetOverview is not a primary workspace — it must not attempt to render venue dashboards inline)
- Any component that issues write operations

**Navigation contract:** FleetOverview is a navigation surface. Its primary actions are navigation to venue dashboards and incident surfaces. Every interaction in FleetOverview that advances the operator's task navigates to a more specific workspace.

**Lifecycle:**
- Mounts when route is `/fleet`.
- On mount: subscribes to fleet-level venue state summary (not full venue objects — summary objects only).
- On unmount: subscription cancelled.

**Observability:**
- Emits `fleet_venue_selected` when operator clicks a venue card. Payload: `{ venue_id, venue_state, operator_action: 'navigate_to_dashboard' | 'navigate_to_incident' }`.

---

### Category 3: Operational Surface Components

Operational surface components are reusable across workspaces. They carry their own data requirements and display logic. They must not import from workspace components.

---

#### PREExplainability

**Responsibility:** Renders the PRE resolution trace for a venue at a given `governed_timestamp`. Shows resolution level (L0–L6), effective content winner, and resolution path.

**Allowed dependencies:**
- Read-only display primitives
- Design token primitives

**Forbidden dependencies:**
- Any action surface component
- Any workspace component
- Any component that would allow operators to modify PRE resolution

**Availability:** Must be available as an inline component in VenueOperationsDashboard, IncidentCommanderSurface, CMSWorkspace (OverrideControl tab), and ReplayForensicsWorkspace. It is not locked to Zone C.

**Observability:**
- Emits `pre_explanation_viewed` when the component enters the viewport with a specific venue and timestamp. Payload: `{ venue_id, governed_timestamp, resolution_level, winner_id }`.

---

#### OverrideStack

**Responsibility:** Renders the active override stack for a venue scope. Read-only display.

**Required data:**
- `override_stack[]`: each entry with `{ level, content_ref, placed_by, placed_at, expires_at, approval_status }`

**Forbidden dependencies:**
- OverrideControl (the placement component)
- Any form or input component

**Rules:**
Approved: OverrideStack renders alongside OverrideControl in the CMS workspace. They are sibling components with no shared state.
Forbidden: OverrideStack containing any affordance that triggers override placement, modification, or removal.
Operational consequence: If viewing and placement are coupled in one component, it becomes impossible to render a read-only view of the override stack in REPLAY mode.
Verification: Render OverrideStack in REPLAY mode; confirm no action affordances are present in the DOM.

**Observability:**
- Emits `override_stack_viewed` with `{ venue_id, stack_depth, highest_active_level }`.

---

#### ConstitutionalStateIndicator

**Responsibility:** Renders the current constitutional state with confidence level and basis summary.

**Required data:**
- `state`: HEALTHY | DEGRADED | CONSTITUTIONAL_RISK | SHADOW_ONLY | PRE_DISABLED | READ_ONLY | EMERGENCY_FREEZE
- `confidence`: HIGH | MEDIUM | LOW | NONE
- `basis`: string[]
- `freshness`: CURRENT | STALE | EXPIRED

**Confidence rendering rules:**

| State | Confidence | Rendering |
|---|---|---|
| HEALTHY | HIGH | Green badge, full opacity |
| HEALTHY | MEDIUM | Green badge, amber confidence dot |
| HEALTHY | LOW | Green badge, amber confidence dot, "Low confidence" text visible (not on hover only) |
| HEALTHY | NONE | Green badge, grey confidence dot, "Confidence unknown" text visible |
| DEGRADED | any | Amber badge with confidence indicator |
| CONSTITUTIONAL_RISK | any | Red badge with confidence indicator, pulsing |
| EMERGENCY_FREEZE | any | Red badge, full width, static (no pulse — pulse implies transient) |

**Rules:**
Approved: HEALTHY at LOW confidence renders the confidence indicator visibly — not hidden behind a hover/tooltip.
Forbidden: Rendering HEALTHY at LOW confidence with the same visual treatment as HEALTHY at HIGH confidence.
Operational consequence: If LOW confidence HEALTHY looks the same as HIGH confidence HEALTHY, operators make operational decisions based on health readings that are not trustworthy.
Verification: Render ConstitutionalStateIndicator with each combination of state and confidence. Confirm HEALTHY/LOW is visually distinguishable from HEALTHY/HIGH without hovering.

**Freshness rules:**
- STALE: amber border on the indicator, tooltip showing "Last updated [age]"
- EXPIRED: red border, explicit text "State data expired — [age] ago"

**Observability:**
- Emits `constitutional_state_indicator_rendered` with the full state + confidence object when first rendered.
- Emits `constitutional_state_freshness_degraded` when freshness transitions from CURRENT to STALE or EXPIRED.

---

#### InterruptDisplay

**Responsibility:** Renders active Level 1 (constitutional emergency) and Level 2 (operational priority) interrupts. Manages interrupt lifecycle on-screen.

**Level 1 interrupt behavior:**
- Replaces Zone B content entirely.
- Renders the interrupt message, the required action, and the workflow to resolve it.
- May not be dismissed by any operator action short of completing the required workflow.
- Level 1 interrupt persists across route changes — it is not a Zone B workspace, it overlays Zone B until resolved.

**Level 2 interrupt behavior:**
- Renders as a persistent banner below SystemStatusBar and above Zone B content.
- Does not replace Zone B content.
- Persists until the interrupt is acknowledged through the required workflow or the condition resolves.
- Acknowledgement is a server-side action — the banner is not dismissed by local state change.

**Forbidden:**
- Level 1 interrupt being dismissable by pressing Escape, clicking outside, or any affordance that does not complete the required workflow.
- Level 2 interrupt being dismissable by a single click without workflow completion.
- Level 1 interrupt being rendered as a modal dialog (which can be closed by standard accessibility patterns).

**Rules:**
Approved: Level 1 interrupt renders as a full Zone B replacement with a distinct visual treatment (not a modal, not a dialog, not a banner).
Forbidden: Rendering Level 1 interrupt as `<dialog>` or any component that can be dismissed by pressing Escape or clicking the backdrop.
Operational consequence: If Level 1 interrupts are dismissable, operators under pressure will dismiss them without completing the required response, leaving constitutional emergencies unresolved.
Verification: Trigger a Level 1 interrupt; attempt to dismiss it with Escape, click-outside, and browser navigation; confirm it persists in all cases until the workflow is completed.

**Observability:**
- Emits `interrupt_displayed` with `{ level: 1 | 2, interrupt_type, venue_id, governed_timestamp }`.
- Emits `interrupt_dismissed_by_workflow` when Level 1 workflow completes. Payload: `{ interrupt_type, resolution_governed_timestamp, resolving_operator_id }`.

---

### Category 4: Action Surface Components

Action surface components contain write-path logic. They issue requests to the production backend that change system state. Every action surface component must check REPLAY mode and session authority before rendering.

**Universal action surface rules:**

**Rule AS-01: REPLAY mode self-suppression**
All action surface components must read the REPLAY mode context on mount. If `_replay: true`, the component must not render (absent from DOM, not disabled).
Approved: Action surface component checks REPLAY context in its render function; if REPLAY, returns null.
Forbidden: Rendering a disabled version of the action surface in REPLAY mode.
Operational consequence: A disabled button in REPLAY mode implies the action is possible with different conditions. An absent button correctly communicates that this action is not available in this context.
Verification: Mount each action surface component with REPLAY context active; confirm the component is absent from the DOM.

**Rule AS-02: Server confirmation before UI update**
Action surface components may display an optimistic UI state for latency, but must roll back to pre-action state if the server rejects the request.
Approved: Show a loading indicator; apply UI change optimistically; on server rejection, revert and show error.
Forbidden: Applying a permanent UI state change before the server confirms success.
Operational consequence: If the UI shows a successful override placement that the server rejected, operators believe an override is active when it is not.
Verification: Intercept the confirmation response and return a rejection; confirm the UI reverts to pre-action state.

**Rule AS-03: Audit event before action completion**
Audit events must be emitted to the audit sink before the action is considered complete. If the audit event fails to emit, the action must be rolled back.
Approved: Audit event emission is part of the action confirmation flow, not a post-action side effect.
Forbidden: Emitting audit events asynchronously after confirming the action to the user.
Operational consequence: If audit emission is asynchronous and fails, the audit trail has no record of the action, which is a governance violation.
Verification: Intercept the audit sink and cause it to fail; confirm the action is rejected when the audit event cannot be emitted.

---

#### OverrideControl

**Responsibility:** Override placement form. Renders level-specific fields, confirmation string requirement, and PRE preview integration. Issues override placement requests to the backend.

**Authority:**
- L1–L5: OPERATOR role
- L6: OPERATOR role with `elevation_active: true`

**Forbidden:** Must not render in REPLAY mode (Rule AS-01).

**PRE preview gate:**
- L4–L6 overrides: PRE preview must be loaded and displayed before the submit button is enabled.
- L1–L3 overrides: PRE preview button available but does not gate submission.

**Confirmation string requirement:**
For L5–L6 overrides, the operator must type a confirmation string (venue name and timestamp) before submission. The confirmation string is validated client-side for format and server-side for content.

**Observability:**
- Emits `override_placement_initiated` when operator opens the placement form. Payload: `{ level, venue_id, operator_id }`.
- Emits `override_preview_loaded` when PRE preview completes. Payload: `{ level, venue_id, preview_effective_content, preview_resolution_level }`.
- Emits `override_placement_submitted` when submission is sent. This is the audit event per Rule AS-03.
- Emits `override_placement_confirmed` when server confirms. Payload: `{ override_id, level, venue_id }`.
- Emits `override_placement_rejected` when server rejects. Payload: `{ reason, level, venue_id }`.

---

#### IncidentDeclaration

**Responsibility:** Incident declaration form with severity selector and scope confirmation.

**Authority:** OPERATOR role.

**Forbidden:**
- Must not render in REPLAY mode.
- Must not pre-fill severity, scope, or any field with system-suggested values. Operators make explicit choices for all fields.

**Rules:**
Approved: The declaration form presents severity options (S1–S5) with descriptions of each severity level. The operator selects one.
Forbidden: Pre-selecting a severity based on system heuristics, AI inference, or previous incidents. The system must not guide the operator toward a specific severity choice.
Operational consequence: If the system pre-selects severity, operators confirm pre-selections under pressure without deliberate evaluation, leading to miscategorized incidents.
Verification: Open IncidentDeclaration; confirm all severity options are unselected on initial render; confirm no field has a default value.

**Observability:**
- Emits `incident_declaration_initiated` with `{ venue_id, operator_id }`.
- Emits `incident_declaration_submitted` with `{ severity, scope_id, operator_id }`. This is the audit event per Rule AS-03.
- Emits `incident_declaration_confirmed` with `{ incident_id, severity, declared_at }`.

---

#### HandoffWorkflow

**Responsibility:** Multi-step handoff package generation and acknowledgement.

**Steps:**
1. Situation summary (current venue states)
2. Active incidents and their status
3. Pending overrides and their expiry
4. Open decisions requiring follow-up
5. Acknowledgement by receiving operator

**Forbidden:**
- The [Accept Handoff] button must not be enabled until all 5 acknowledgement events have been recorded server-side.
- Client-side state tracking of acknowledgement steps is insufficient. The submit button reads server-confirmed step completion.

**Rules:**
Approved: After each step is completed, the frontend sends a step-confirmation request to the server. The server returns the updated acknowledgement state. The [Accept Handoff] button checks the server-returned state, not local component state.
Forbidden: Enabling [Accept Handoff] based on local state tracking (e.g., `step1Complete && step2Complete && ...`).
Operational consequence: If local state drives the submit affordance and the server fails to record one step, a handoff is completed without full acknowledgement, leaving the receiving operator unaware of a situation.
Verification: Complete 4 of 5 steps; intercept the 5th step confirmation response and drop it; confirm [Accept Handoff] remains disabled.

**Observability:**
- Emits `handoff_step_completed` for each of 5 steps. Payload: `{ step_number, operator_id, server_confirmed: boolean }`.
- Emits `handoff_completed` when all steps are server-confirmed and handoff is submitted. Payload: `{ from_operator_id, to_operator_id, venue_ids_in_scope }`.

---

#### RecoveryWorkflow

**Responsibility:** 5-step venue recovery checklist. Sequential — each step must be completed before the next is shown.

**Steps:**
1. Confirm player state (OPERATOR)
2. Verify network connectivity (OPERATOR)
3. Confirm corpus sync (OPERATOR)
4. Corpus hash verification (ADMIN)
5. Resume authorization (OPERATOR)

**Step rendering rules:**
- Only the current active step is rendered as interactive. All previous steps are rendered as completed (read-only). Future steps are not rendered at all (not disabled — absent).
- Step 4 requires ADMIN role. If the current operator is not ADMIN, Step 4 renders an "ADMIN authorization required" panel with a request-to-authorize flow, not a disabled form.

**Forbidden:**
- Steps are not skippable by any operator action.
- Step completion must be confirmed by the server before the next step renders.
- Rendering future steps as disabled (they must be absent from the DOM).

**Rules:**
Approved: After a step is submitted, the frontend waits for server confirmation before rendering the next step. If confirmation does not arrive within 10 seconds, a retry affordance is shown.
Forbidden: Rendering Step N+1 based on local step completion state before server confirms Step N.
Operational consequence: If a step is marked complete locally but the server has not confirmed it, the recovery workflow may advance while a step remains incompletely verified. A venue returned to production without verified corpus is a constitutional violation.
Verification: Submit Step 3; intercept server confirmation and drop it; confirm Step 4 does not render.

**Observability:**
- Emits `recovery_step_submitted` with `{ venue_id, step_number, operator_id }`.
- Emits `recovery_step_confirmed` with `{ venue_id, step_number, server_confirmed: boolean }`.
- Emits `recovery_workflow_completed` with `{ venue_id, total_duration_ms, completing_operator_id }`.

---

### Category 5: Intelligence Surface Components

Intelligence surface components render in Zone C.

---

#### ZoneCPanel

**Responsibility:** Renders Zone C panes: C1 (operational context / PRE explanation), C2 (system health indicators), C3 (historical activity feed), C4 (constitutional state and advisory indicators).

**Collapse behavior:**
When Zone C is collapsed to the 48px icon rail, Pane C4 constitutional state indicators must remain visible. The collapse action may hide C1, C2, and C3, but may not hide the constitutional state and advisory indicators from C4.

**Rules:**
Approved: When collapsed, Zone C renders a 48px rail containing: constitutional state badge (from ConstitutionalStateIndicator), advisory tier indicator, and a Zone C expand affordance.
Forbidden: Collapsing Zone C to a state where constitutional state is not visible.
Operational consequence: If constitutional state is hidden by Zone C collapse, operators lose system health awareness during routine workspace operations.
Verification: Collapse Zone C; confirm constitutional state badge and advisory indicator are visible in the 48px rail.

**Observability:**
- Emits `zone_c_collapsed` and `zone_c_expanded` with `{ triggered_by: 'operator' | 'system', from_width, to_width }`.

---

### Category 6: Training Surface Components

Training surface components exist only within the training sandbox. They must never appear in production contexts.

---

#### TrainingBanner

**Responsibility:** Renders the training mode visual indicator — a blue banner replacing (or overlaying) the System Status Bar with "TRAINING MODE — No production actions" text.

**Forbidden:**
- Must not appear outside of TrainingWorkspace.
- Must not appear when `active_mode` is anything other than a training context.
- Must not render in production mode under any condition.

**Rules:**
Approved: TrainingBanner is only exported from the training module and can only be imported by TrainingWorkspace.
Forbidden: TrainingBanner being importable by any shell or workspace component outside the training module.
Operational consequence: If TrainingBanner appears in a production context, operators may interpret a production system as a sandbox and take actions they believe to be simulated.
Verification: Verify at build time that TrainingBanner is imported only by TrainingWorkspace. Fail the build if any other importer is detected.

---

#### SimulationControls

**Responsibility:** Instructor controls for simulation scenarios: Inject Scenario, Freeze Time, Advance Time, Grant Elevated Session (simulation scope only).

**Authority:** Instructor role only. VIEWER, OPERATOR, and ADMIN roles who are not designated instructors must not see SimulationControls.

**Forbidden:**
- Must not exist in any bundle served to production users.
- Must not issue requests to production API endpoints.
- "Grant Elevated Session" in SimulationControls grants elevation within the simulation context only. It must not interact with the production session elevation endpoint.

**Build enforcement:** SimulationControls is conditionally excluded from the production build via a build flag (`INCLUDE_SIMULATION_CONTROLS=false` in production builds). The component must not be importable through any indirect path in the production bundle.

**Rules:**
Approved: SimulationControls uses a build-time conditional import that resolves to a null component in production builds.
Forbidden: Using runtime feature flags to hide SimulationControls in production. Build-time exclusion is required.
Operational consequence: If SimulationControls exists in the production bundle (even hidden by a flag), a flag misconfiguration exposes instructor controls to all operators.
Verification: Analyze the production bundle; confirm SimulationControls class and all its dependencies are absent.

---

## Component Governance Rules

### Rule CG-01: No cross-workspace imports

**Definition:** Workspace components (items 6–11) may not import from each other. Shared functionality must be extracted to operational surface components (items 12–20) or shell components (items 1–4).

**Approved:** VenueOperationsDashboard and IncidentCommanderSurface both import PREExplainability (an operational surface component).
**Forbidden:** VenueOperationsDashboard importing any component defined within the IncidentCommanderSurface module.
**Operational consequence:** Cross-workspace imports create a coupling that prevents independent workspace deployment and create risk of IC-specific state leaking into the venue dashboard.
**Verification method:** Run a dependency graph analysis at build time. Fail the build if any workspace component imports from another workspace module.

---

### Rule CG-02: No write actions in read-only surfaces

**Definition:** Any component rendered within a REPLAY session must check its mode context and refuse to render write-capable controls. This is enforced at the component level, not only at the route level.

**Approved:** OverrideControl reads the REPLAY context and returns null when `_replay: true`.
**Forbidden:** OverrideControl relying on the route path to determine whether to render in REPLAY mode.
**Operational consequence:** A component that checks only the route path would fail to suppress itself if the replay workspace were ever embedded, integrated, or deep-linked in an unexpected context.
**Verification method:** Write a test that mounts each action surface component with REPLAY context active; assert the component is absent from the rendered DOM.

---

### Rule CG-03: Server-validated state transitions

**Definition:** Action surface components (items 16–19) must confirm server acknowledgement before making any permanent UI state change. Optimistic updates are permitted for latency but must be rolled back on server rejection.

**Approved:** Submit override → show loading state → receive server confirmation → update UI.
**Forbidden:** Submit override → immediately update UI → asynchronously wait for server confirmation.
**Operational consequence:** If UI updates before server confirmation and the server rejects, the operator believes a state change is in effect when it is not. This is especially dangerous for override placement and incident declaration.
**Verification method:** For each action surface component, intercept the server confirmation response and return a rejection. Confirm UI reverts to pre-action state in all cases.

---

### Rule CG-04: Audit emission on every operator action

**Definition:** Every component in the Action Surface category must emit an audit event on every operator-initiated state change. Audit events must be emitted before the action is considered complete.

**Approved:** Audit event is emitted as part of the server confirmation request payload — the server records it as an atomic part of the action.
**Forbidden:** Emitting audit events as a side effect after the action completes (fire-and-forget).
**Operational consequence:** If audit emission is a side effect, a network failure after the action but before audit emission produces an action with no audit record.
**Verification method:** Block the audit sink and attempt each action surface operation. Confirm the action is rejected when the audit cannot be recorded.

---

### Rule CG-05: Zone A independence

**Definition:** No workspace component (items 6–11) may modify Zone A content. Zone A receives its data from its own subscriptions, independent of Zone B.

**Approved:** VenueOperationsDashboard and ZoneAPanel both subscribe to venue state from the same shared subscription registry. They receive updates independently.
**Forbidden:** VenueOperationsDashboard pushing venue state updates to Zone A via a shared context, event bus, or prop drilling.
**Operational consequence:** If Zone A responds to Zone B state changes, Zone A can become inconsistent during workspace transitions — a venue may appear selected in Zone A that does not match Zone B.
**Verification method:** Verify Zone A component subscriptions are established in the ZoneAPanel mount cycle, not in any workspace component.

---

### Rule CG-06: Status confidence always present

**Definition:** ConstitutionalStateIndicator and any component rendering health, trust, readiness, or connectivity status must always render the confidence level alongside the status value.

**Approved:** "HEALTHY — High confidence" (or equivalent visual treatment with confidence indicator).
**Forbidden:** Rendering "HEALTHY" without any confidence indicator, even when confidence is HIGH.
**Operational consequence:** Operators calibrate their response to operational status based on how reliable that status is. Removing confidence from status displays trains operators to treat all statuses as equally reliable, which is false.
**Verification method:** Render every status-bearing component at each confidence level (HIGH, MEDIUM, LOW, NONE); confirm confidence is visible at each level without user interaction.
