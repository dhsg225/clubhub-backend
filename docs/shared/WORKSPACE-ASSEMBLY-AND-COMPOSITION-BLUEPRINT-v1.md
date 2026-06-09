# Workspace Assembly and Composition Blueprint — v1

**Document type:** Implementation-grade architecture specification
**Audience:** Frontend engineering team
**Status:** Authoritative — do not deviate without architectural review
**Scope:** Application shell structure, workspace compositions, shared surface assemblies, coupling prohibitions, extension rules
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, FRONTEND-EVENT-AND-INTERACTION-MODEL-v1.md

---

## Purpose

This document specifies how the ClubHub TV frontend application is assembled from its component parts. It defines which components compose each workspace, the structural rules governing their arrangement, and the coupling boundaries that prevent workspaces from depending on each other incorrectly.

Frontend engineers must follow this blueprint when implementing any workspace or shared surface. Structural deviations require architectural review before implementation — not after.

---

## Application Shell Composition

The application shell is the outermost container. It is always mounted for the lifetime of the authenticated session. It is responsible for: WebSocket subscription management, constitutional state distribution, mode enforcement, and rendering the three-zone layout.

```
ApplicationShell
├── SystemStatusBar                    [fixed top, z-index: 1000]
│   ├── ConstitutionalStateIndicator   [full badge — state + color]
│   ├── ActiveModeIndicator            [LIVE / REPLAY / INCIDENT ACTIVE]
│   ├── SessionClock                   [wall clock, labeled "wall"]
│   ├── OperatorIdentityBadge          [display name + role]
│   ├── ElevateSessionButton           [requests elevated authority]
│   └── NotificationBadge             [unread count, opens A3 tray]
├── MainContent                        [flex row, fills viewport minus StatusBar and Footer]
│   ├── ZoneAPanel                     [280px fixed width, never resizable]
│   │   ├── VenueSelector (A1)
│   │   ├── IncidentList (A2)
│   │   ├── NotificationTrayAccess (A3)
│   │   └── OperatorToolsMenu (A4)
│   ├── ZoneBContainer                 [fluid, min-width: 640px]
│   │   └── WorkspaceRouter            [renders active workspace into Zone B]
│   └── ZoneCPanel                     [320px, collapsible to 48px icon rail]
│       ├── OperationalContext (C1)
│       ├── SystemHealthIndicators (C2)
│       ├── ActivityFeed (C3)
│       └── ConstitutionalAdvisory (C4)
└── AuditTraceFooter                   [fixed bottom, z-index: 1000]
    ├── LastAuditEventDisplay          [most recent audit event, governed timestamp]
    └── OpenReplayLink                 [enters replay at most recent event]
```

### Z-Index Contract

The z-index hierarchy is fixed and enforced. No workspace or panel component may claim a z-index above its designated ceiling.

| Layer | Z-index | Components |
|---|---|---|
| System chrome | 1000 | SystemStatusBar, AuditTraceFooter |
| Level 1 interrupts | 900 | InterruptDisplay (EMERGENCY_FREEZE, PRE_DISABLED) |
| Modal overlays | 800 | ConfirmationModal, all modal dialogs |
| Level 2 interrupts | 750 | InterruptDisplay (incident notifications, CONSTITUTIONAL_RISK) |
| Dropdown menus | 700 | All dropdown and popover components |
| Workspace content | 1 | Zone A, Zone B, Zone C panels and their children |

**Approved approach:** Assign z-index values from this table. Enforce via CSS custom property or design token that maps layer names to values.
**Forbidden approach:** Hardcoded z-index values above 800 in workspace components, or any workspace component claiming z-index 900+.
**Operational consequence:** A workspace component with z-index 900 can occlude an EMERGENCY_FREEZE interrupt. Operators may not see a constitutional emergency notification because a dropdown or modal is rendering on top of it.
**Verification method:** Trigger an EMERGENCY_FREEZE event while a modal overlay is open. Confirm the interrupt renders above the modal. Inspect computed z-index values for all layers.

### Shell Responsibilities

The ApplicationShell owns the following and must not delegate them to workspace components:

- WebSocket connection lifecycle (connect, reconnect, disconnect on session end)
- Subscription to `system:constitutional_state:changed` events
- Distribution of mode (`LIVE` / `REPLAY` / `INCIDENT` / `DEGRADED` / `EMERGENCY_FREEZE`) via application context
- Distribution of constitutional state via application context
- Rendering of InterruptDisplay at the correct z-index levels
- Zone A and Zone C rendering (independent of Zone B workspace)

**Approved approach:** ApplicationShell manages subscriptions centrally. Workspaces receive state via context, not via direct WebSocket access.
**Forbidden approach (Forbidden Coupling FC-01):** Workspace components directly subscribing to WebSocket events. Any workspace that imports a WebSocket client or establishes its own connection violates this rule.
**Operational consequence:** Multiple WebSocket connections from individual workspaces cause subscription fan-out, duplicate event processing, and race conditions when the same event is processed by multiple components simultaneously. In constitutional state change scenarios, this produces inconsistent UI state.
**Verification method:** Import graph analysis: confirm zero workspace module imports reference the WebSocket client module. Network inspector during workspace navigation: confirm connection count does not increase when switching workspaces.

---

## Zone A Panel

Zone A is always visible in LIVE mode. In REPLAY mode it may collapse to a 48px icon rail via keyboard shortcut only — not via click or gesture. Zone A never collapses in LIVE mode.

Zone A maintains its own subscription to venue state events. It does not receive venue state from Zone B. See `system:player_state:changed` in FRONTEND-EVENT-AND-INTERACTION-MODEL-v1.md.

**Approved approach:** Zone A subscribes to venue state independently via ApplicationShell context. Zone A renders its own venue state indicators from this independent subscription.
**Forbidden approach (Forbidden Coupling FC-02):** Zone A components rendering children of Zone B workspaces, or importing from workspace modules.
**Operational consequence:** A Zone A that depends on Zone B for venue state data will show stale state for venues not currently displayed in Zone B. Operators use Zone A for at-a-glance fleet health assessment — stale indicators cause incorrect triage decisions.
**Verification method:** Mount Zone B on a different venue than the one whose state changes. Confirm Zone A updates for the changed venue. Confirm no Zone B remount occurs.

---

## Workspace Compositions

### Workspace: Venue Operations Dashboard

**Route:** `/venues/:venue_id`
**Minimum role:** VIEWER

```
VenueOperationsDashboard
├── Section1_VenueIdentityHeader       [non-collapsible, always visible]
│   ├── VenueNameBadge
│   ├── PlayerStateBadge               [HEALTHY / DEGRADED / DISCONNECTED etc.]
│   └── EmergencyContentBanner         [conditional — see rendering rules below]
├── Section2_PlayerHealth              [collapsible, default: expanded]
│   ├── HeartbeatStatus                [last_heartbeat governed_timestamp + elapsed]
│   ├── CorpusHashStatus               [current hash, expected hash, match/mismatch]
│   ├── ClockSyncStatus                [governed clock vs wall clock delta]
│   └── ConnectivityStatus             [last_seen, connection_type, signal quality]
├── Section3_ContentPREStatus          [collapsible, default: expanded]
│   ├── PRE_EffectiveContent           [content currently resolved by PRE]
│   ├── PREResolutionLevel             [L0–L6 indicator with label]
│   ├── OverrideStackSummary           [count of active overrides, highest level]
│   └── PREExplainability              [shared surface, inline expandable]
├── Section4_InterventionSurface       [collapsible, default: expanded]
│   ├── PlaceOverrideButton            [absent for VIEWER; absent if state prohibits]
│   ├── DeclareIncidentButton          [absent for VIEWER]
│   └── RecoveryWorkflow               [conditional — see rendering rules below]
└── Section5_Timeline                  [collapsible, default: collapsed]
    └── VenueEventTimeline             [recent events in governed timestamp order]
```

**Section rendering rules:**

Section 1 — VenueIdentityHeader:
- Non-collapsible. No collapse affordance is rendered.
- EmergencyContentBanner: renders when the active override stack contains an L6 override. This banner cannot be hidden by any operator action, any constitutional state, or any other condition. It renders as long as an L6 override is in the stack.
- Section ordering: 1 → 2 → 3 → 4 → 5. Fixed. Cannot be user-reordered.

Section 4 — InterventionSurface:
- RecoveryWorkflow replaces PlaceOverrideButton and DeclareIncidentButton when a recovery workflow is active for this venue. The standard intervention buttons are not shown alongside the workflow — they are replaced by it.
- When a recovery workflow is active: PlaceOverrideButton and DeclareIncidentButton are unmounted, not hidden.
- When no recovery workflow is active: RecoveryWorkflow component is unmounted, not hidden.

**Approved approach:** Check `recovery_workflow_state` from the venue data. If present, render RecoveryWorkflow and unmount standard intervention buttons. If absent, render standard intervention buttons and unmount RecoveryWorkflow.
**Forbidden approach:** Rendering both intervention buttons and RecoveryWorkflow simultaneously, even in a "greyed out" or "secondary" state.
**Operational consequence:** Visible intervention buttons during active recovery invite operators to place independent overrides that conflict with the recovery procedure, producing an override stack conflict and an inconsistent audit trail.
**Verification method:** Load a venue with an active recovery workflow. Confirm PlaceOverrideButton and DeclareIncidentButton are absent from the DOM. Complete the recovery workflow. Confirm they reappear.

---

### Workspace: Incident Commander Surface

**Route:** `/incidents/:incident_id`
**Minimum role:** VIEWER (read), OPERATOR (action)

```
IncidentCommanderSurface
├── IC_TOP                             [full width, 80px height, non-scrolling, always visible]
│   ├── IncidentIdentityHeader         [incident_id (monospace), severity badge, machine state]
│   ├── CommanderStatus                [commander_id, commander_since governed_ts, LAPSED indicator]
│   ├── ConstitutionalStateMini        [compact constitutional state badge — shared surface]
│   └── IC_CommandActions              [Transfer Command, Add Annotation — role-gated]
├── IC_LEFT                            [scrollable, grows with log, ~40% width]
│   └── IncidentEventLog               [all state transitions + annotations, chronological asc]
├── IC_RIGHT                           [scrollable, ~60% width]
│   ├── BlastRadiusPanel               [affected venues list, each with current player state]
│   ├── PRE_TracePanel                 [current PRE resolution for incident scope — PREExplainability]
│   ├── ActiveRecoverySteps            [if recovery workflow is in progress for incident scope]
│   └── IC_InvestigationLinks          [links to linked replay sessions — click opens ReplayWorkspace]
└── IC_BOTTOM                          [full width, 72px height, non-scrolling, always visible]
    ├── EscalationButton               [Declare higher severity — absent for VIEWER]
    ├── ContainmentButton              [Declare CONTAINED — ADMIN required for S1-S2]
    ├── ResolutionButton               [Declare RESOLVED — requires annotation; absent for VIEWER]
    └── ViewVenueButton                [navigates Zone B to venue dashboard — does not close IC]
```

**IC assembly rules:**

IC-TOP is always visible and non-scrolling within the surface. IC-LEFT and IC-RIGHT scroll independently. IC-TOP height expands for S1 severity to accommodate the CONSTITUTIONAL FREEZE ACTIVE banner — this is not optional.

IC-BOTTOM is always visible and non-scrolling. For VIEWER role: EscalationButton, ContainmentButton, ResolutionButton are absent from the DOM. ViewVenueButton is present for all roles.

COMMANDER_LAPSED state: IC-TOP CommanderStatus shows the LAPSED indicator. IC_CommandActions (Transfer Command, Add Annotation) are disabled for all operators who are not currently the assigned commander. LAPSED does not hide the action buttons — it disables them with a "Command lapsed — claim command to proceed" tooltip.

**Approved approach:** IC-TOP always renders. IC-BOTTOM always renders. IC-LEFT and IC-RIGHT each have their own scroll container. Action buttons check `incident.commander_id === session.operator_id` before enabling.
**Forbidden approach:** Making IC-TOP or IC-BOTTOM scrollable. Making IC-LEFT and IC-RIGHT share a scroll container.
**Operational consequence:** A scrollable IC-TOP allows the incident identity header to scroll out of view during a long log review. Operators lose track of which incident and which severity they are managing, which is a cognitive safety failure during multi-incident scenarios.
**Verification method:** Populate IC-LEFT with 100 log entries. Scroll IC-LEFT to the bottom. Confirm IC-TOP is fully visible. Confirm IC-TOP has not scrolled.

**Forbidden Coupling FC-03:** Action surface components (OverrideControl, IncidentDeclaration, HandoffWorkflow, RecoveryWorkflow) must not import from each other.
**Operational consequence:** Cross-imports between action surfaces create circular dependency risks and make it impossible to render one surface without loading the module graph of all others. In performance-constrained incident scenarios, this degrades load time for the surface that is actually needed.
**Verification method:** Module dependency analysis: confirm each action surface component's import tree does not include any other action surface module.

---

### Workspace: Replay and Forensics Workspace

**Route:** `/replay/:session_id`
**Minimum role:** VIEWER

```
ReplayForensicsWorkspace
├── RP_TOP                             [full width, 64px height, non-scrolling]
│   ├── ReplayModeIndicator            [amber badge, "REPLAY MODE — no write actions permitted"]
│   ├── SessionScopeHeader             [venue name, time range, session type — human-readable]
│   ├── EventNavigationControls        [First / Previous / Next / Last + keyboard equivalents]
│   └── SessionActions                 [Conclude Session, Abandon — role-gated]
├── RP_TIMELINE                        [full width, 96px height, horizontal scroll]
│   ├── TimelineTrack
│   │   ├── PRE_ResolutionEvents       [dots on timeline]
│   │   ├── MachineTransitionEvents    [dots on timeline]
│   │   └── AnnotationMarkers         [distinct marker type]
│   └── TimelineScrubber               [draggable; updates ?t= via replaceState]
├── RP_MAIN                            [tab bar + tab content, ~60% of remaining height]
│   ├── TabBar
│   │   ├── Tab1_PREResolutionTrace    [always present]
│   │   ├── Tab2_StateMachineView      [always present]
│   │   ├── Tab3_OverrideStack         [always present]
│   │   ├── Tab4_CorpusEvidence        [always present]
│   │   ├── Tab5_DivergenceComparison  [disabled if no divergence data — greyed, not absent]
│   │   └── Tab6_Counterfactual        [absent entirely if role !== ADMIN — not greyed]
│   └── TabContent                     [renders active tab component]
└── RP_DETAIL                          [full width, ~30% of remaining height]
    ├── SelectedEventDetail            [detail of event selected in RP_MAIN or RP_TIMELINE]
    ├── AnnotationList                 [annotations for currently selected scope]
    └── AnnotationComposer             [write-once field; becomes read-only on confirmation]
```

**Replay assembly rules:**

RP_TOP ReplayModeIndicator must be visible in all tab states. The amber border must encompass the entire ReplayForensicsWorkspace. If this border is implemented as a CSS border on the workspace container, it applies regardless of which tab is active.

Tab 5 (DivergenceComparison): disabled (greyed, not clickable) when no divergence report is linked to the session. It is not absent — operators need to know the tab exists and is unavailable, not that it does not exist. Clicking a disabled Tab 5 shows a tooltip: "No divergence report linked to this session."

Tab 6 (Counterfactual): absent from the DOM for non-ADMIN roles. Not greyed. Not hidden with `display: none`. Not rendered at all. The DOM must not contain Tab 6 elements for non-ADMIN sessions.

AnnotationComposer: transitions to a permanent read-only annotation display after `replay:annotation:written:confirmed` is received. No edit affordance is rendered after this transition. The transition is irreversible for the lifetime of the session.

**Approved approach:** Check `session.role === 'ADMIN'` before including Tab 6 in the TabBar render. Check `session.divergence_report_id` before enabling Tab 5.
**Forbidden approach:** Rendering Tab 6 with `display: none` or `visibility: hidden` for non-ADMIN roles. Rendering Tab 6 as disabled/greyed for non-ADMIN roles.
**Operational consequence:** A hidden-but-present Tab 6 is accessible via keyboard navigation and developer tools. ADMIN-only analysis surfaces exposed to non-ADMIN operators violate the authority model and create audit liability.
**Verification method:** Authenticate as OPERATOR. Load ReplayForensicsWorkspace. Inspect DOM — confirm no Tab6 element exists. Confirm no keyboard navigation reaches a Tab 6 position. Authenticate as ADMIN. Confirm Tab 6 appears.

**Forbidden Coupling FC-04:** ReplayForensicsWorkspace must not import from CMSWorkspace or VenueOperationsDashboard. Replay investigation is an independent surface with no dependency on other workspace modules.
**Verification method:** Import graph analysis of ReplayForensicsWorkspace — zero imports from CMS or VenueOperations module paths.

---

### Workspace: CMS and Content Operations

**Route:** `/cms` (default tab), `/cms/schedule`, `/cms/overrides`, `/cms/library`, `/cms/sponsorship`, `/cms/venues`, `/cms/approvals`
**Minimum role:** OPERATOR

```
CMSWorkspace
├── CMSHeader                          [workspace title, active tab indicator]
├── CMSTabBar
│   ├── Tab_ScheduleManager            [/cms/schedule]
│   ├── Tab_OverrideControl            [/cms/overrides]
│   ├── Tab_ContentLibrary             [/cms/library]
│   ├── Tab_SponsorshipManager         [/cms/sponsorship]
│   ├── Tab_VenueAssignments           [/cms/venues]
│   └── Tab_ApprovalQueue             [/cms/approvals]
└── CMSTabContent
    └── [active tab component]
```

**CMS assembly rules:**

Switching tabs does NOT unmount the CMSWorkspace. Only the active tab component renders in CMSTabContent. Inactive tab components are unmounted, but their form state is preserved in workspace-level state (not component state).

Tab switches update the URL path and push a browser history entry (see `navigation:tab:changed`).

Override accumulation warning: when any venue scope has more than 3 active overrides, a warning banner renders at the top of Tab_OverrideControl content, regardless of which venue is currently selected within the tab. This warning persists for the duration of the CMS session — it is not dismissible.

**Approved approach:** CMSWorkspace maintains form state for all tabs in its own state object. When a tab unmounts, its form state is stored to workspace state. When a tab remounts, it receives saved state as initial values.
**Forbidden approach:** Storing tab form state in component-local state that is lost on unmount.
**Operational consequence:** Losing form state on tab switch means operators who navigate to the library to verify a content item before completing an override form must re-enter the entire form. In time-sensitive override placements, this delay is unacceptable.
**Verification method:** Enter partial data in Schedule tab. Switch to Library tab. Switch back to Schedule tab. Confirm all entered data is present.

---

### Workspace: Training and Certification

**Route:** `/training`
**Minimum role:** VIEWER

```
TrainingWorkspace
├── TrainingHeader                     [workspace title, mode indicator: "TRAINING — SANDBOX"]
├── TrainingModuleNav                  [6 modules; progress indicators per module]
│   ├── Module1_PlatformOrientation
│   ├── Module2_OverrideProcedures
│   ├── Module3_IncidentManagement
│   ├── Module4_ReplayInvestigation
│   ├── Module5_ShiftHandoff
│   └── Module6_EmergencyProtocols
└── TrainingContent
    ├── ModuleContent                  [current module content]
    ├── SimulationSandbox              [simulation runtime, isolated from production]
    └── SimulationControls             [instructor-only; emits training:simulation:action events]
```

**Training assembly rules:**

TrainingWorkspace must not import production API clients. It uses exclusively the simulation API client. This is enforced at the module level — the import is absent, not conditionally bypassed.

SimulationControls component is rendered only if `session.role === 'INSTRUCTOR'` or session has `training_instructor` permission flag. For non-instructors, SimulationControls is absent from the DOM.

The TRAINING — SANDBOX mode indicator must remain visible throughout all training module states. It must not be occluded by SimulationSandbox content.

**Forbidden Coupling FC-06:** TrainingWorkspace must not import production API clients.
**Approved approach:** Maintain a dedicated simulation API client module. TrainingWorkspace imports exclusively from the simulation client module.
**Operational consequence:** Production API imports in TrainingWorkspace allow simulation actions to reach live endpoints. Real overrides placed during training exercises cannot be distinguished from operational overrides in the audit trail without manual investigation.
**Verification method:** Static import analysis: confirm zero production API client imports in TrainingWorkspace module tree. Run a simulation action in training mode: confirm network request goes to simulation endpoint only.

---

### Workspace: Fleet Overview

**Route:** `/fleet`
**Minimum role:** VIEWER

```
FleetOverviewWorkspace
├── FleetHeader                        [venue count, overall constitutional state summary]
├── FleetVenueGrid                     [all venues accessible to operator, sortable]
│   └── VenueCard                      [venue name, player state, PRE level, last heartbeat]
└── FleetFilterBar                     [filter by state, PRE level, region]
```

Fleet Overview is a navigation surface. Clicking a VenueCard navigates to `/venues/:venue_id`. No write actions are available in Fleet Overview.

---

## Shared Surface Assemblies

Shared surfaces are components used in multiple workspaces. They have defined assembly contracts that must be followed in every location they appear.

### PREExplainability

A surface that displays the current PRE resolution trace — what content is shown, at what level, and why.

**Used in:**
- VenueOperationsDashboard Section 3: inline in Section3_ContentPREStatus, expandable
- IncidentCommanderSurface IC-RIGHT: inline in PRE_TracePanel
- ReplayForensicsWorkspace RP-MAIN Tab 1: inline in Tab1_PREResolutionTrace
- ReplayForensicsWorkspace RP-DETAIL: inline in SelectedEventDetail when event type is PRE resolution
- CMSWorkspace Tab_OverrideControl: inline in the override placement form (shows current resolution before the new override is placed)

**Assembly contract:**
- PREExplainability receives `pre_resolution` data as a prop from its parent.
- It does not fetch its own data. It is a display component only.
- The parent workspace is responsible for providing fresh `pre_resolution` data.
- In REPLAY mode, `pre_resolution` data reflects the state at the current replay timestamp — not the LIVE state.

**Approved approach:** Parent workspace passes `pre_resolution` as a prop. PREExplainability renders from props only.
**Forbidden approach:** PREExplainability making its own API calls or WebSocket subscriptions.
**Operational consequence:** PREExplainability fetching independently creates race conditions between the workspace data and the component data — different parts of the UI can show different PRE resolution states for the same venue at the same time.
**Verification method:** Mount PREExplainability with a mock prop. Confirm no network requests are made by the component. Update the prop from the parent. Confirm the component re-renders with new data without a network request.

---

### ConstitutionalStateIndicator

A component displaying the current constitutional state with appropriate color treatment.

**Used in:**
- SystemStatusBar: full badge with text and color
- ZoneCPanel C4 (ConstitutionalAdvisory): advisory view with implications
- IncidentCommanderSurface IC-TOP: compact badge — ConstitutionalStateMini variant

**Assembly contract:**
- All three instances receive constitutional state from the same source: ApplicationShell's WebSocket subscription, distributed via application context.
- The instances may render differently (different sizes, different amounts of explanatory text) but must show the same state value at the same time.
- If the three instances show different state values, it is an implementation defect.

**Approved approach:** ApplicationShell updates a single constitutional state context value on each `system:constitutional_state:changed` event. All instances read from this context.
**Forbidden approach:** Each instance of ConstitutionalStateIndicator maintaining its own WebSocket subscription or polling independently.
**Operational consequence:** Independent subscriptions cause state values to diverge during the period between subscription callbacks. An operator sees HEALTHY in the Status Bar and CONSTITUTIONAL_RISK in Zone C — and cannot determine which is correct.
**Verification method:** Trigger a constitutional state change. Confirm all three instances update to the new state within the same render cycle. Measure time delta between instances — must be zero (same render, not sequential renders).

---

### ConfirmationModal

A shared modal overlay for all destructive and irreversible operator actions.

**Props interface:**
- `title` (string): Modal heading
- `description` (string): Explanation of what will happen
- `confirmation_type` (enum: `TEXT_ENTRY` | `CHECKBOX`): How the operator confirms intent
- `confirmation_value` (string, required when `confirmation_type === TEXT_ENTRY`): The exact string the operator must type
- `on_confirm` (function): Called when confirmation is valid and operator clicks [Confirm]
- `on_cancel` (function): Called when operator clicks [Cancel] or presses Escape

**Assembly rules:**
- ConfirmationModal does not contain business logic. It knows nothing about incidents, overrides, or any operational entity. The parent component defines what happens via `on_confirm` and `on_cancel`.
- For `TEXT_ENTRY` type: [Confirm] button is disabled until the operator has typed the exact `confirmation_value` string. Character-by-character comparison. Case-sensitive.
- For `CHECKBOX` type: [Confirm] button is disabled until the checkbox is checked.
- Pressing Escape calls `on_cancel`.
- ConfirmationModal renders at z-index 800.

**Approved approach:** Parent component renders ConfirmationModal, passes `on_confirm` that calls the domain handler. ConfirmationModal validates input. Parent component is not involved in input validation.
**Forbidden approach:** Individual action components implementing their own confirmation modals instead of using ConfirmationModal.
**Operational consequence:** Custom confirmation implementations have inconsistent behavior (different validation, different keyboard handling, different z-index). An operator who learns the confirmation pattern for one surface expects it to work the same way on another. Inconsistency increases error rate under stress.
**Verification method:** Count distinct confirmation modal implementations in the codebase. Confirm the count is 1 (ConfirmationModal). Confirm all destructive action components reference this shared component.

---

### SectionHeader

A shared header component used by the collapsible sections in VenueOperationsDashboard.

**Props interface:**
- `title` (string): Section heading text
- `collapsible` (boolean): Whether a collapse affordance is rendered
- `default_expanded` (boolean): Initial expanded state when collapsible is true

**Assembly rules:**
- When `collapsible: false` — no collapse affordance renders. The section header has no interactive collapse element. This is the correct configuration for Section 1 (VenueIdentityHeader).
- When `collapsible: true` — a collapse toggle renders. Section content shows or hides based on toggle state.
- Collapsed state is local to the session. It is not persisted across sessions or venue changes.

**Approved approach:** Pass `collapsible={false}` for Section 1. Section 1 renders no toggle, no collapse animation, no state for expanded/collapsed.
**Forbidden approach:** Rendering a disabled/greyed collapse toggle for non-collapsible sections.
**Operational consequence:** A disabled collapse toggle implies the section could be collapsed under different conditions. Operators may spend time searching for the condition that enables it, or may file support requests for a feature that does not exist.
**Verification method:** Render Section 1. Confirm no collapse toggle element exists in the DOM for Section 1. Confirm Sections 2–5 render functional collapse toggles.

---

### StatusBadge

A shared badge component for displaying entity or system state with optional confidence display.

**Props interface:**
- `state` (string): The state value to display
- `confidence` (number 0–1): Confidence level for derived or computed states
- `show_confidence` (boolean, default: true): Whether confidence value is rendered

**Assembly rules:**
- When `show_confidence: false` — the badge must append a visual indicator (e.g., a subtle dot or asterisk) indicating that confidence information is available but suppressed. The suppression indicator informs operators they are seeing a compressed view.
- Rendering a StatusBadge with confidence information entirely hidden (no suppression indicator) is permitted only in compact contexts: Zone A venue list dots, Fleet Overview VenueCards where hover/tap reveals full status.
- All StatusBadge instances in non-compact contexts must use `show_confidence: true`.

**Approved approach:** Default to `show_confidence: true`. Pass `show_confidence={false}` only in Zone A venue list and Fleet Overview contexts. Always render suppression indicator when confidence is hidden.
**Forbidden approach:** Setting `show_confidence={false}` in Zone B workspaces or Zone C panels to achieve cleaner visual layouts.
**Operational consequence:** Hiding confidence in workspace contexts removes a critical signal. An operator seeing a HEALTHY badge with 32% confidence needs to know the badge is uncertain — without confidence display, they treat the state as authoritative and skip investigation that the low confidence warranted.
**Verification method:** Render StatusBadge in every workspace context. Confirm `show_confidence` defaults to true in all non-compact contexts. Confirm suppression indicator appears in all `show_confidence: false` instances.

---

## Forbidden Coupling Patterns

The following coupling patterns are architectural defects. They may not be accepted as technical debt. They must be corrected before the affected workspace is shipped.

| ID | Rule | Enforcement |
|---|---|---|
| FC-01 | Workspace components must not directly subscribe to WebSocket events | Import graph analysis: zero workspace imports of WebSocket client module |
| FC-02 | Zone A components must not render Zone B workspace children or import workspace modules | Import graph analysis: zero Zone A imports from workspace module paths |
| FC-03 | Action surface components (OverrideControl, IncidentDeclaration, HandoffWorkflow, RecoveryWorkflow) must not import from each other | Import graph analysis: each action surface has zero cross-imports to other action surfaces |
| FC-04 | ReplayForensicsWorkspace must not import from CMSWorkspace or VenueOperationsDashboard | Import graph analysis: zero replay workspace imports from CMS or VenueOps paths |
| FC-05 | SystemStatusBar must not import from any workspace component | Import graph analysis: zero SystemStatusBar imports from workspace module paths |
| FC-06 | TrainingWorkspace must not import production API clients | Import graph analysis: zero TrainingWorkspace imports from production API client modules |

All FC rules must be enforced by automated tooling (e.g., dependency-cruiser rules) that runs in CI and fails builds on violation. Manual review is insufficient.

---

## Workspace Extension Rules

### Adding a new tab to an existing workspace

1. New tab must not change the URL structure of existing tabs. Existing tab routes must remain valid and unchanged.
2. New tab defines its own data requirements as an additive extension to the workspace's data contract. The workspace's existing data fetching must not be modified to accommodate the new tab.
3. New tab must not break existing tab state persistence. Other tabs' form state must survive navigation to and from the new tab.
4. New tab must be added to the route inventory in APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md before implementation begins.

### Adding a new workspace

1. New workspace must be registered in WorkspaceRouter.
2. New workspace must declare all routes in the route inventory before implementation.
3. New workspace must receive venue_id or incident_id via route params — not via Zone A navigation data directly. Zone A and Zone B are decoupled.
4. New workspace must implement the mode check on mount. On mount, the workspace reads `_mode` from ApplicationShell context and suppresses all write controls if mode is not LIVE.
5. New workspace must declare which Class A events it may emit. Undeclared event types are rejected by the event bus.
6. New workspace must not import from existing workspace modules. It may import shared surfaces and shared utilities, not other workspace implementations.
