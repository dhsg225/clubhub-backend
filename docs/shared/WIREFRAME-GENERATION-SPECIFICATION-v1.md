# Wireframe Generation Specification — v1

**Document type:** Wireframe generation standard
**Audience:** Designers, design tool operators, design reviewers
**Status:** Authoritative — all wireframes produced for the ClubHub TV frontend must conform to this specification
**Scope:** Every wireframe produced for the CMS/HCI frontend — all surfaces, all states, all roles
**Depends on:** FRONTEND-COMPONENT-TAXONOMY-v1.md, WORKSPACE-ASSEMBLY-AND-COMPOSITION-BLUEPRINT-v1.md, FRONTEND-IMPLEMENTATION-READINESS-ASSESSMENT-v1.md, APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md, FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md

---

## 1. Purpose and Scope

### 1.1 What This Document Governs

This document specifies how wireframes for the ClubHub TV CMS/HCI frontend are produced. It defines:

- The canonical layout template (zones, dimensions, chrome)
- Which states require wireframes for each surface
- What every wireframe must annotate
- The exact component names, label text, and data placeholder values required
- What wireframes are prohibited from inventing

A designer reading this document can produce a complete wireframe set without making any structural decisions. Every structural decision has already been made in the canonical specification documents. This document translates those decisions into concrete wireframe instructions.

### 1.2 What This Document Does NOT Govern

This document does not govern:

- **Visual design.** Color choices, typography specifications, icon designs, spacing tokens, and motion behavior are governed by separate design constitution documents (Phase F Perceptual Governance, Typography Legibility, Design Token Constitution). Wireframes are structural documents — they show layout, label text, and component presence, not visual treatment.
- **Color coding beyond severity semantics.** Wireframes annotate severity levels (S1–S5) and trust levels, but do not specify color values. Annotations state what the color treatment is (e.g., "[AMBER indicator]") — not what the exact color is.
- **Typography specifications.** Wireframes show text hierarchy (heading, body, label) structurally. Font choices are not a wireframe concern.
- **Final interaction animations.** Wireframes show state transitions as before/after pairs. Motion behavior between states is governed by the Motion Governance document.

### 1.3 How to Use This Document

1. Read Section 2 first. Every wireframe begins with the canonical layout template.
2. Identify the surface you are wireframing. Go to the corresponding section in Section 3 (State Matrix).
3. Produce one wireframe per row in the state matrix for that surface.
4. Annotate every wireframe per Section 4 requirements before delivery.
5. Apply control fidelity requirements from Section 5 to every interactive element.
6. Check your wireframe set against Section 11 before declaring it complete.

---

## 2. Canonical Layout Template

### 2.1 Dimensions and Zones

Every wireframe in this specification uses the following layout. There are no exceptions.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SYSTEM STATUS BAR — 48px height, full width, z-index: 1000          │
├────────────┬──────────────────────────────────────┬──────────────────┤
│            │                                      │                  │
│  ZONE A    │           ZONE B                     │  ZONE C          │
│  280px     │           fluid                      │  320px           │
│  fixed     │           (min 640px)                │  collapsible     │
│            │                                      │                  │
│            │                                      │                  │
│            │                                      │                  │
├────────────┴──────────────────────────────────────┴──────────────────┤
│  AUDIT TRACE FOOTER — 28px height, full width, z-index: 1000         │
└──────────────────────────────────────────────────────────────────────┘
```

**Exact dimensions:**

| Zone | Width | Height | Behavior |
|---|---|---|---|
| System Status Bar | 100% viewport | 48px fixed | Never scrolls; always on top |
| Zone A | 280px fixed | viewport minus 48px (top) and 28px (bottom) | Never resizable; never collapses in LIVE mode |
| Zone B | viewport minus 280px minus Zone C width | viewport minus 76px | Scrollable; minimum 640px |
| Zone C | 320px | viewport minus 76px | Collapsible to 0px (not 1px, not icon-rail, not border) |
| Audit Trace Footer | 100% viewport | 28px fixed | Never scrolls; always on top |
| Minimum viewport | 1280px | 768px | No wireframe may depict a viewport narrower than this |

**Zone C collapsed state:** When Zone C is collapsed, Zone B expands to fill the full width minus Zone A. Zone C renders nothing — no border, no icon, no shadow. The collapse toggle is part of Zone B chrome, not Zone C.

**Zone A independence rule:** Zone A is not a child of any workspace. It does not change layout or content when Zone B changes workspace. Wireframes must never show Zone A content that is workspace-specific.

### 2.2 Required Chrome Elements

Every wireframe — without exception — must include all of the following:

**System Status Bar (48px top):**
- `ConstitutionalStateIndicator` — full badge: state label + confidence label side by side
- `ActiveModeIndicator` — shows current mode: `LIVE`, `REPLAY`, or `INCIDENT ACTIVE`
- `SessionClock` — labeled "Wall:" followed by a realistic time placeholder (e.g., `14:32:07`)
- `OperatorIdentityBadge` — display name + role (e.g., `J. Martinez — OPERATOR`)
- `ElevateSessionButton` — present for all roles; disabled if elevation is already active
- `NotificationBadge` — unread count (use `3` as placeholder when count is non-zero)

**Zone A Panel:**
- `VenueSelector` (Pane A1) — venue list with state indicators
- `IncidentList` (Pane A2) — active incidents with severity badges
- `NotificationTrayAccess` (Pane A3) — notification access point with badge
- `OperatorToolsMenu` (Pane A4) — tools and session management

**Zone B:** Active workspace — specified per surface in Section 3.

**Zone C (default state — open):**
- `OperationalContext` (C1) — contextual entity summary
- `SystemHealthIndicators` (C2) — current health signals
- `ActivityFeed` (C3) — recent activity items
- `ConstitutionalAdvisory` (C4) — advisory for current constitutional state

**Audit Trace Footer (28px bottom):**
- `LastAuditEventDisplay` — most recent audit event with governed timestamp placeholder
- `OpenReplayLink` — link to open replay at most recent event

**Zone C collapsed wireframe:** Required only when the wireframe's purpose is specifically to show the collapsed Zone C state. All other wireframes show Zone C open. The collapsed wireframe must show Zone C as absent (zero width), not as a narrow icon rail.

### 2.3 Annotation Layer Requirements

Every wireframe must carry the following annotation layer. Annotations may be placed as callouts, a legend panel, or numbered footnotes — the format is left to the designer, but the content is mandatory.

**Per-wireframe header annotations (placed at top of each wireframe):**

```
ROLE:              [VIEWER | OPERATOR | ADMIN]
CONSTITUTIONAL STATE: [HEALTHY | DEGRADED | CONSTITUTIONAL_RISK | EMERGENCY_FREEZE | ...]
MODE:              [LIVE | REPLAY | INCIDENT ACTIVE]
SURFACE:           [Surface name — exact name from Section 3]
WIREFRAME ID:      [Surface abbreviation]-[state abbreviation]-[role abbreviation]
                   e.g., VOD-HEALTHY-OP, IC-LAPSED-VW, RP-REPLAY-AD
```

**Per-control annotations (placed inline or as callouts on each interactive control):**

- `[ABSENT: role-based]` — control is not in DOM for this role; render nothing for this control in the wireframe
- `[ABSENT: state-based, state=X]` — control is not in DOM due to current state X
- `[DISABLED: state-based, state=X, tooltip="..."]` — control visible but not activatable; show tooltip text
- `[DATA: field.path from endpoint]` — for each data field, cite the source field and endpoint using exact names from FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md
- `[TRUST: UNKNOWN | DEGRADED_TRUST | UNTRUSTED]` — when the trust level is not TRUSTED, annotate the display treatment

**Authority annotation rule (critical):**
- If a control is absent because the user's role cannot perform this action under any system state: `[ABSENT: role-based]`
- If a control is absent because a specific system state prohibits it (but the role permits it when state allows): `[ABSENT: state-based, state=X]`
- If a control is visible but greyed and non-interactive because of current system state: `[DISABLED: state-based, state=X, tooltip="..."]`
- A control is never shown as `[DISABLED]` when the correct treatment is `[ABSENT]`.

---

## 3. State Matrix — Required Wireframe Sets

Each row is a required wireframe. The entire set for a surface must be delivered before the wireframe set is considered complete.

### 3.1 Venue Operations Dashboard (`/venues/:venue_id`)

Surface component: `VenueOperationsDashboard`

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| VOD-HEALTHY-VW | HEALTHY | VIEWER | Section 4: PlaceOverrideButton `[ABSENT: role-based]`, DeclareIncidentButton `[ABSENT: role-based]` |
| VOD-HEALTHY-OP | HEALTHY | OPERATOR | Section 4: both intervention buttons present and enabled |
| VOD-HEALTHY-AD | HEALTHY | ADMIN | Section 4: intervention buttons present; recovery workflow step 4 accessible |
| VOD-DEGRADED-OP | DEGRADED | OPERATOR | ConstitutionalStateIndicator shows DEGRADED; PRE section shows amber freshness |
| VOD-CONRISK-OP | CONSTITUTIONAL_RISK | OPERATOR | Full badge shows CONSTITUTIONAL_RISK; ConstitutionalAdvisory in Zone C shows risk detail |
| VOD-FREEZE-OP | EMERGENCY_FREEZE | OPERATOR | Level 1 interrupt visible at z-index 900; PlaceOverrideButton `[DISABLED: state-based, state=EMERGENCY_FREEZE, tooltip="Override placement unavailable during Emergency Freeze"]` |
| VOD-OFFLINE-ONE | HEALTHY (system) | OPERATOR | One venue shows OFFLINE in Zone A; autonomy clock visible in Section 2 |
| VOD-OFFLINE-ALL | DEGRADED | OPERATOR | All venues OFFLINE in Zone A; 72-hour autonomy clock displayed in Section 2 with `autonomy_remaining_hours` value |
| VOD-RECOVERY | HEALTHY | OPERATOR | Section 4: RecoveryWorkflow present; PlaceOverrideButton `[ABSENT: state-based, state=RECOVERY_ACTIVE]`; DeclareIncidentButton `[ABSENT: state-based, state=RECOVERY_ACTIVE]` |
| VOD-UNTRUSTED | HEALTHY | OPERATOR | Section 2: player_state shown with `[TRUST: UNTRUSTED]` treatment and inline warning; Section 3: PRE data shown with trust indicator |
| VOD-L6-ACTIVE | HEALTHY | OPERATOR | Section 1: EmergencyContentBanner rendered (L6 override active); Section 1 non-collapsible — no collapse toggle rendered |

**Section collapsibility wireframe rules:**
- Section 1 (`VenueIdentityHeader`): `SectionHeader` with `collapsible={false}`. No collapse toggle rendered — not even a greyed one. Annotate: `[SectionHeader: collapsible=false — no toggle in DOM]`
- Sections 2–5: `SectionHeader` with `collapsible={true}`. Show collapse toggle. Sections 2, 3, 4 default expanded; Section 5 default collapsed.

### 3.2 Incident Commander Surface (`/incidents/:incident_id`)

Surface component: `IncidentCommanderSurface`

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| IC-DECLARED-VW | DECLARED | VIEWER | IC-BOTTOM: EscalationButton `[ABSENT: role-based]`, ContainmentButton `[ABSENT: role-based]`, ResolutionButton `[ABSENT: role-based]`; ViewVenueButton present |
| IC-DECLARED-OP | DECLARED | OPERATOR | Full IC surface; operator IS the commander; all IC-BOTTOM actions enabled per role |
| IC-DECLARED-OP-NC | DECLARED | OPERATOR | Operator is NOT the commander; IC_CommandActions `[DISABLED: state-based, state=NOT_COMMANDER, tooltip="Claim command to proceed"]` |
| IC-LAPSED-OP | COMMANDER_LAPSED | OPERATOR | CommanderStatus shows LAPSED indicator with countdown display; Transfer Command `[DISABLED: state-based, state=COMMANDER_LAPSED, tooltip="Command lapsed — claim command to proceed"]`; Add Annotation `[DISABLED: state-based, state=COMMANDER_LAPSED, tooltip="Command lapsed — claim command to proceed"]`; countdown timer showing seconds remaining |
| IC-CONTAINED-OP | CONTAINED | OPERATOR | ContainmentButton replaced with closure confirmation; incident state badge shows CONTAINED |
| IC-RESOLVED-RO | RESOLVED | OPERATOR | Entire IC surface read-only; IC-BOTTOM buttons `[DISABLED: state-based, state=RESOLVED]`; incident log shows full history |
| IC-FREEZE-OP | EMERGENCY_FREEZE | OPERATOR | Level 1 interrupt overlay at z-index 900; S1 expansion of IC-TOP showing CONSTITUTIONAL FREEZE ACTIVE banner |
| IC-TAB6-AD | DECLARED | ADMIN | 6 tabs shown in tab bar (if surface has tab navigation); Tab 6 present in DOM |
| IC-TAB6-ABSENT-OP | DECLARED | OPERATOR | Tab 6 absent from wireframe entirely; 5-tab bar only; annotation: `[Tab 6: ABSENT from DOM — not rendered for non-ADMIN]` |
| IC-TRANSFER-OP | DECLARED | OPERATOR | IC Transfer flow: 30-second review modal at z-index 800; countdown timer; ConfirmationModal with CHECKBOX confirmation type |
| IC-S1-OP | DECLARED (S1) | OPERATOR | IC-TOP height expanded; CONSTITUTIONAL FREEZE ACTIVE banner visible; S1 severity badge |

**IC layout sub-zone rules for wireframes:**
- IC-TOP: always visible; height 80px (non-S1) or expanded (S1); non-scrolling. Annotate height.
- IC-LEFT: scrollable; approximately 40% width. Show scroll indicator when content overflows.
- IC-RIGHT: scrollable; approximately 60% width. Scroll independently from IC-LEFT.
- IC-BOTTOM: always visible; height 72px; non-scrolling. Annotate height.
- IC-LEFT and IC-RIGHT share the remaining height between IC-TOP and IC-BOTTOM.

### 3.3 Replay and Forensics Workspace (`/venues/:venue_id/replay/:session_id`)

Surface component: `ReplayForensicsWorkspace`

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| RP-REPLAY-OP | Active replay | OPERATOR | 5 tabs shown; Tab 6 `[ABSENT from DOM]`; ReplayModeIndicator visible; amber border on workspace |
| RP-REPLAY-AD | Active replay | ADMIN | 6 tabs shown; Tab 6 present; ReplayModeIndicator visible |
| RP-TAB5-DIS | Active replay (no divergence) | OPERATOR | Tab 5 `[DISABLED: state-based, state=NO_DIVERGENCE_REPORT, tooltip="No divergence report linked to this session"]`; tab is visible but greyed — not absent |
| RP-TAB6-ABS | Active replay | OPERATOR | Explicit wireframe showing 5-tab tab bar with no gap where Tab 6 would be; annotation: `[Tab 6: ABSENT from DOM — not rendered for non-ADMIN; not hidden, not disabled, not present]` |
| RP-ANNOTATE | Active replay, annotation write | OPERATOR | AnnotationComposer showing write state; text field active; Confirm button present |
| RP-ANNOTATED | Active replay, post-confirmation | OPERATOR | AnnotationComposer transitioned to read-only annotation display; no edit affordance in DOM; annotation: `[AnnotationComposer: read-only after replay:annotation:written:confirmed — irreversible for session lifetime]` |
| RP-TAB5-VIEW | Active replay (divergence present) | OPERATOR | Tab 5 enabled; divergence comparison content in RP-MAIN |
| RP-TAB6-CF | Active replay, counterfactual | ADMIN | Tab 6 active; counterfactual panel in RP-MAIN; elevation indicator visible (counterfactual requires elevation) |
| RP-LABEL | Active replay (any) | Any | "This is a replay session" label always visible in RP-TOP; amber border always present; `ActiveModeIndicator` shows `REPLAY` |

**Replay layout sub-zone rules for wireframes:**
- RP-TOP: full width; height 64px; non-scrolling. `ReplayModeIndicator` must be visible in all tab states — it is in RP-TOP, which does not change when tabs switch.
- RP-TIMELINE: full width; height 96px; horizontal scroll.
- RP-MAIN: tab bar + tab content; approximately 60% of remaining height.
- RP-DETAIL: full width; approximately 30% of remaining height.
- Amber border: shown as a border annotation enclosing the entire `ReplayForensicsWorkspace` zone. Label it: `[Amber border: enclosing entire workspace container — present in all tab states]`

**Tab label requirements (exact):**

| Tab | Label | Presence rule |
|---|---|---|
| Tab 1 | PRE Resolution Trace | Always present |
| Tab 2 | State Machine | Always present |
| Tab 3 | Override Stack | Always present |
| Tab 4 | Corpus Evidence | Always present |
| Tab 5 | Divergence Comparison | Always present; disabled when no divergence report |
| Tab 6 | Counterfactual | ADMIN only; absent from DOM for non-ADMIN |

### 3.4 CMS and Content Operations Surface (`/cms/*`)

Surface component: `CMSWorkspace`

Tab bar labels (exact, in order): Schedule Manager | Override Control | Content Library | Sponsorship Manager | Venue Assignments | Approval Queue

Note: `/cms/sponsorship` and `/cms/venues` require ADMIN role. For OPERATOR wireframes, these tabs are `[ABSENT: role-based]` — they are not in the tab bar, not greyed.

| WF ID | State / Tab | Role | Key differentiators |
|---|---|---|---|
| CMS-LIB-VW | Content Library tab | VIEWER | Sponsorship Manager tab `[ABSENT: role-based]`; Venue Assignments tab `[ABSENT: role-based]`; Schedule Manager tab `[ABSENT: role-based]`; Override Control tab `[ABSENT: role-based]` |
| CMS-LIB-OP | Content Library tab | OPERATOR | Sponsorship Manager tab `[ABSENT: role-based]`; Venue Assignments tab `[ABSENT: role-based]`; 4 tabs visible |
| CMS-SCHED-OP | Schedule Manager tab | OPERATOR | 72-hour warning banner visible (if pending_changes has items near deadline) |
| CMS-SCHED-72H | Schedule Manager tab, delivery warning | OPERATOR | `time_remaining_hours` ≤ 72 on a pending_changes item; warning banner rendered at top of tab content |
| CMS-OVER-OP | Override Control tab | OPERATOR | Override accumulation warning banner present (active_count > 3); `[DISABLED: state-based]` for L6 controls (operator without elevation) |
| CMS-OVER-L46 | Override Control tab, L4–L6 placement | OPERATOR | Submit button `[ABSENT: state-based, state=PRE_PREVIEW_NOT_LOADED]`; PRE preview panel visible; submit button appears only after preview loads |
| CMS-APPROV-OP | Approval Queue tab | OPERATOR | `ApprovalQueueItem` list with `time_remaining_hours` from backend; `requires_role` annotation on each item |
| CMS-SPONSOR-AD | Sponsorship Manager tab | ADMIN | L4 ceiling annotation visible: `[L4 ceiling: constitutional maximum for sponsorship overrides]` |
| CMS-VENUES-AD | Venue Assignments tab | ADMIN | Venue assignment interface |
| CMS-TRAINING | Any tab, simulation mode | OPERATOR | `[TRAINING — SANDBOX]` mode indicator visible; simulation API annotation |
| CMS-FREEZE | Any tab, EMERGENCY_FREEZE | OPERATOR | Zone A CMS navigation item `[DISABLED: state-based, state=EMERGENCY_FREEZE, tooltip="Unavailable during Emergency Freeze"]`; CMS workspace unreachable via navigation |

### 3.5 Venue Operations Dashboard — Extended States

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| VOD-RBU | RECOVERED_BUT_UNTRUSTED | OPERATOR | Section 2: all fields shown with `[TRUST: UNTRUSTED]` treatment; explicit inline warning text "Data trust unverified — treat with caution"; no data fields suppressed |
| VOD-AUTO-72 | OFFLINE, autonomy active | OPERATOR | Section 2: `autonomy_remaining_hours` shown; Section 2 shows `offline_duration_ms` converted to hours/minutes; `autonomy_basis` shown; 72-hour autonomy clock visual |
| VOD-INCIDENT | INCIDENT state | OPERATOR | Section 4: DeclareIncidentButton present; PRE section shows incident-affected resolution |

### 3.6 Fleet Overview (`/fleet`)

Surface component: `FleetOverviewWorkspace`

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| FLEET-HEALTHY-OP | All venues HEALTHY | OPERATOR | VenueCard grid; no write actions |
| FLEET-MIXED-OP | Mixed states | OPERATOR | VenueCards with different PlayerState values; heartbeat staleness shown |
| FLEET-FILTER-OP | Filtered view | OPERATOR | FleetFilterBar active; subset of venues shown |

### 3.7 Training and Certification Workspace (`/training`)

Surface component: `TrainingWorkspace`

| WF ID | State | Role | Key differentiators |
|---|---|---|---|
| TRAIN-NAV-VW | Module nav, no active module | VIEWER | 6 modules listed; progress indicators; `TRAINING — SANDBOX` label visible |
| TRAIN-SIM-OP | Simulation mode | OPERATOR | SimulationSandbox visible; `TRAINING — SANDBOX` label visible |
| TRAIN-INST-OP | Simulation with instructor | OPERATOR + instructor flag | SimulationControls visible (instructor only); for non-instructor: SimulationControls `[ABSENT: role-based (instructor flag required)]` |

---

## 4. Component Annotation Standard

### 4.1 Component Naming Convention

All wireframe annotations must use exact component names from FRONTEND-COMPONENT-TAXONOMY-v1.md and WORKSPACE-ASSEMBLY-AND-COMPOSITION-BLUEPRINT-v1.md. Do not abbreviate, paraphrase, or invent component names.

**Required component names (use these exactly):**

Shell components: `ApplicationShell`, `SystemStatusBar`, `AuditTraceFooter`, `WorkspaceRouter`, `InterruptDisplay`

Zone A components: `ZoneAPanel`, `VenueSelector`, `IncidentList`, `NotificationTrayAccess`, `OperatorToolsMenu`

Zone C components: `ZoneCPanel`, `OperationalContext`, `SystemHealthIndicators`, `ActivityFeed`, `ConstitutionalAdvisory`

Status bar sub-components: `ConstitutionalStateIndicator`, `ActiveModeIndicator`, `SessionClock`, `OperatorIdentityBadge`, `ElevateSessionButton`, `NotificationBadge`

Footer sub-components: `LastAuditEventDisplay`, `OpenReplayLink`

Shared surfaces: `PREExplainability`, `ConfirmationModal`, `SectionHeader`, `StatusBadge`, `ConstitutionalStateMini`

Venue Operations: `VenueOperationsDashboard`, `EmergencyContentBanner`, `PlaceOverrideButton`, `DeclareIncidentButton`, `RecoveryWorkflow`

IC Surface: `IncidentCommanderSurface`, `IncidentIdentityHeader`, `CommanderStatus`, `IC_CommandActions`, `IncidentEventLog`, `BlastRadiusPanel`, `PRE_TracePanel`, `ActiveRecoverySteps`, `EscalationButton`, `ContainmentButton`, `ResolutionButton`, `ViewVenueButton`

Replay Workspace: `ReplayForensicsWorkspace`, `ReplayModeIndicator`, `SessionScopeHeader`, `EventNavigationControls`, `TimelineTrack`, `TimelineScrubber`, `AnnotationComposer`, `AnnotationList`, `SelectedEventDetail`

CMS: `CMSWorkspace`, `CMSHeader`, `CMSTabBar`

Training: `TrainingWorkspace`, `TrainingHeader`, `TrainingModuleNav`, `SimulationSandbox`, `SimulationControls`

### 4.2 Authority Annotation Format

Every control on every wireframe must carry one of the following annotations:

| Annotation | Meaning | Wireframe rendering |
|---|---|---|
| `[PRESENT: enabled]` | Control is in DOM and interactive | Show as normal interactive element |
| `[PRESENT: disabled, reason="..."]` | Control is in DOM but not interactive; tooltip text required | Show as greyed element with tooltip label |
| `[ABSENT: role-based]` | Control not in DOM for this role; no hint of its existence | Show nothing; do not leave a gap or placeholder |
| `[ABSENT: state-based, state=X]` | Control not in DOM due to system state X | Show nothing; do not leave a gap or placeholder |

The distinction between `DISABLED` and `ABSENT` is governed by the authority rendering rule: role-based denial produces absence; state-based denial produces a disabled control. Never mix these.

### 4.3 Data Source Annotation Format

Every data field in a wireframe must cite its source. Use this format:

```
[DATA: {field_path} from {endpoint_or_object}]
```

Examples using exact field names from FRONTEND-DATA-CONTRACT-REQUIREMENTS-v1.md:

- `[DATA: player_state.machine_state from PlayerState]`
- `[DATA: pre_resolution.level from PREResolution]`
- `[DATA: command_status.lapsed from CommandStatus]`
- `[DATA: autonomy_status.autonomy_remaining_hours from AutonomyStatus]`
- `[DATA: override_stack.entries[].level from OverrideEntry]`
- `[DATA: incident.severity from Incident]`

---

## 5. Control Fidelity Requirements

### 5.1 Buttons and Actions

Every button and action surface on every wireframe must satisfy:

- **Exact label text.** No "Button 1", "Action", or placeholder label. Use the exact label as specified.

**Required button labels (use exactly as shown):**

| Button component | Label text |
|---|---|
| `PlaceOverrideButton` | Place Override |
| `DeclareIncidentButton` | Declare Incident |
| `EscalationButton` | Escalate Severity |
| `ContainmentButton` | Declare Contained |
| `ResolutionButton` | Declare Resolved |
| `ViewVenueButton` | View Venue |
| `ElevateSessionButton` | Elevate Session |
| `OpenReplayLink` | Open Replay |
| Transfer Command (IC_CommandActions) | Transfer Command |
| Add Annotation (IC_CommandActions) | Add Annotation |
| EventNavigationControls — First | ⏮ First |
| EventNavigationControls — Previous | ← Previous |
| EventNavigationControls — Next | Next → |
| EventNavigationControls — Last | Last ⏭ |
| SessionActions — Conclude | Conclude Session |
| SessionActions — Abandon | Abandon Session |

- **Authority state annotated** on every control: one of `[PRESENT: enabled]`, `[PRESENT: disabled, reason="..."]`, `[ABSENT: role-based]`, `[ABSENT: state-based, state=X]`.
- **Confirmation flow.** If a button triggers a `ConfirmationModal`, the wireframe set must include a separate wireframe showing the modal state. See Section 8.

### 5.2 Data Fields

- Every data field shows a realistic placeholder value. No "Lorem ipsum", no "---", no "N/A" unless `null` is the specified degraded value.
- Timestamps: ISO-8601 format — `2026-06-02T14:32:07Z`
- IDs: realistic format — `inc-20260602-0847`, `venue-0042`, `session-rf-2906-a3b1`
- Severity: `S1`, `S2`, `S3`, `S4`, `S5` — never "High", "Medium", "Low"
- Override levels: `L0`, `L1`, `L2`, `L3`, `L4`, `L5`, `L6` — never "Low Override", "High Override"
- Constitutional states: `HEALTHY`, `DEGRADED`, `CONSTITUTIONAL_RISK`, `SHADOW_ONLY`, `PRE_DISABLED`, `READ_ONLY`, `EMERGENCY_FREEZE` — never colloquialisms
- Confidence: `HIGH`, `MEDIUM`, `LOW`, `NONE` — rendered alongside state, never separately
- Trust: `TRUSTED`, `DEGRADED_TRUST`, `UNTRUSTED`, `UNKNOWN` — see trust rendering rules below

**Trust placeholder rendering:**

| Trust level | Wireframe rendering |
|---|---|
| `TRUSTED` | No indicator; data shown normally |
| `DEGRADED_TRUST` | `[AMBER indicator]` adjacent to value; tooltip: "Reduced confidence in this data" |
| `UNTRUSTED` | `[RED indicator]` adjacent to value; inline text (not tooltip): "Data trust unverified — treat with caution" |
| `UNKNOWN` | `[GREY indicator]` adjacent to value; inline text: "Trust unknown — last verified [age]" or "Trust unknown — not yet verified" |

`UNKNOWN` trust is never rendered as neutral. Never show a grey indicator without the accompanying explanatory text.

### 5.3 Tabs

- All tabs must be shown in their inactive state; active tab must be structurally differentiated (e.g., underline, bold label — indicate as annotation, not visual design).
- Tab count must match the specification exactly:
  - Replay workspace: 5 tabs for non-ADMIN; 6 tabs for ADMIN
  - CMS workspace: 4 tabs for VIEWER; 4 tabs for OPERATOR; 6 tabs for ADMIN
- Tab labels must match Section 3.3 and 3.4 exactly. No abbreviation.
- `Tab5_DivergenceComparison` when no divergence data: greyed label, not absent. Clicking shows tooltip: "No divergence report linked to this session." This tab is always present in the DOM — it is never absent like Tab 6.
- `Tab6_Counterfactual`: absent from DOM for non-ADMIN. Absent from wireframe. No greyed placeholder. No gap.

### 5.4 Status Indicators

**Severity badges:** Render as `S1`, `S2`, `S3`, `S4`, `S5`. Annotate color semantics as `[SEVERITY_INDICATOR: S1=most severe]` — do not specify exact color values in wireframes.

**Override levels:** Render as `L0` through `L6`. Annotate `[L4 ceiling: constitutional maximum for sponsorship overrides]` on any sponsorship display.

**Constitutional states:** Exact enum names only. The `ConstitutionalStateIndicator` always renders state AND confidence together: e.g., `HEALTHY — HIGH` or `DEGRADED — MEDIUM`.

**Freshness:** When data is STALE or EXPIRED, annotate the display with age: e.g., `"PRE resolution — last updated 4 minutes ago"`. EXPIRED data shows explicit text: "State data expired." STALE data shows amber indicator.

**COMMANDER_LAPSED:** The `CommanderStatus` in IC-TOP shows:
- Label: `COMMANDER LAPSED`
- Countdown display showing remaining seconds before auto-escalation
- Distinct visual treatment from the normal commander status (annotate as `[LAPSED_INDICATOR: countdown visible]`)

---

## 6. Zone A Specification for Wireframes

Zone A content is the same chrome across all surfaces. The following rules govern its wireframe representation.

### 6.1 Navigation Items in Zone A

**Pane A1 — VenueSelector:**
- Lists all venues accessible to the role (VIEWER: assigned venues only; OPERATOR/ADMIN: all venues)
- Each venue item shows: venue name, `PlayerState.machine_state` badge, staleness indicator when `heartbeat_freshness` is STALE
- Active venue (matching current Zone B workspace) is highlighted with an `[ACTIVE]` annotation
- Use placeholder venue names: `Venue — Eastgate Arena`, `Venue — Westfield Club`, `Venue — North Sports Hall`

**Pane A2 — IncidentList:**
- Lists active incidents ordered by severity descending, then `declared_at` descending
- Each incident shows: incident_id (monospace font), severity badge, current_state badge
- Incident being viewed in Zone B: `[ACTIVE]` annotation
- Maximum 20 items shown; if > 20: link "View all incidents" shown below list

**Pane A3 — NotificationTrayAccess:**
- Badge shows unread count; use `3` as non-zero placeholder
- Tray opens as Zone A overlay (not a modal; not a route change)

**Pane A4 — OperatorToolsMenu:**
- Contains: Handoff initiation (label: "Start Handoff"), Session info, Elevation request (label: "Elevate Session"), Logout (label: "Log Out")
- "Start Handoff" opens a modal overlay — does not change Zone B

### 6.2 Zone A During EMERGENCY_FREEZE

During `EMERGENCY_FREEZE`:
- CMS navigation items in Zone A: `[DISABLED: state-based, state=EMERGENCY_FREEZE, tooltip="Unavailable during Emergency Freeze"]` — items visible but greyed; clicking does not navigate
- Training navigation items in Zone A: `[DISABLED: state-based, state=EMERGENCY_FREEZE, tooltip="Unavailable during Emergency Freeze"]`
- Venue, Incident, Fleet, and Replay navigation items: `[PRESENT: enabled]`
- Zone A items are NEVER removed during EMERGENCY_FREEZE — they are disabled, not absent

### 6.3 Alert Badges on Zone A Items

- Active incident in Pane A2: amber badge on the `IncidentList` section header when one or more DECLARED incidents exist
- Unread notifications in Pane A3: badge count on `NotificationTrayAccess`
- Badges must appear in wireframe for states where the underlying data implies their presence

---

## 7. Zone C Specification for Wireframes

### 7.1 Default State Per Surface

| Surface | Zone C default | Notes |
|---|---|---|
| Venue Operations Dashboard | Open | All 4 panes visible |
| Incident Commander Surface | Open | C1 shows incident context; C4 shows advisory if CONSTITUTIONAL_RISK |
| Replay and Forensics Workspace | Open | C1 shows session scope; C3 shows session annotation activity |
| CMS Workspace | Open | C2 shows system health; C3 shows recent CMS activity |
| Fleet Overview | Open | C1 shows fleet summary |
| Training Workspace | Closed | Training workspace does not require Zone C context |

### 7.2 Zone C Collapse

- Collapse control is part of Zone B chrome, not Zone C. Annotate as: `[Zone C collapse: toggle in Zone B header rail — keyboard shortcut only in REPLAY mode; click/toggle in LIVE mode]`
- Collapsed state: Zone C is absent (zero width). Zone B expands to fill the freed space. Annotate: `[Zone C: 0px width — not a border, not an icon rail, no visual residue]`
- Collapsed wireframe ID format: append `-ZC-COL` suffix (e.g., `VOD-HEALTHY-OP-ZC-COL`)

### 7.3 Zone C in EMERGENCY_FREEZE

- Zone C renders normally during EMERGENCY_FREEZE
- `ConstitutionalAdvisory` (C4) shows EMERGENCY_FREEZE advisory with implications
- No Zone C content is suppressed during EMERGENCY_FREEZE

---

## 8. Interrupt and Modal Wireframe Requirements

Interrupts and modals require dedicated wireframes in addition to the surface wireframes they appear on.

### 8.1 Level 1 Interrupt (Constitutional Emergency)

Component: `InterruptDisplay` at z-index 900

**Required wireframe:** One wireframe showing the Level 1 interrupt active over a base surface.

**Layout requirements:**
- Full-screen overlay; z-index 900 (above modals at 800, above Level 2 at 750)
- Shows on top of any open modal (the modal must not be visible underneath)
- Cannot be dismissed by the operator
- Must contain: constitutional state label, severity of the triggering event, timestamp, and exactly one permitted action (if any)
- Must NOT contain: navigation controls, cancel button, or any dismissal affordance

**Annotation:** `[InterruptDisplay: z-index=900, CANNOT be occluded by any workspace component or modal]`

### 8.2 Level 2 Interrupt

Component: `InterruptDisplay` at z-index 750

**Required wireframe:** One wireframe showing Level 2 interrupt active (e.g., CONSTITUTIONAL_RISK notification, S1/S2 incident notification).

**Layout requirements:**
- Partial overlay (typically a banner or side panel, not full-screen)
- z-index 750 (below Level 1, below modals)
- Can be acknowledged by operator action
- Must show: trigger description, time since trigger, acknowledgement affordance

**Annotation:** `[InterruptDisplay: z-index=750, acknowledgeable by operator]`

### 8.3 Standard Modal (z-index 800)

Component: `ConfirmationModal`

A wireframe is required for every action that triggers a `ConfirmationModal`. Minimum required modal wireframes:

**Override placement confirmation (L1–L3):**
- `confirmation_type: CHECKBOX`
- Checkbox unchecked: Confirm button `[DISABLED]`
- Checkbox checked: Confirm button `[PRESENT: enabled]`
- Cancel button always `[PRESENT: enabled]`

**Override placement confirmation (L6 — "EMERGENCY" text entry):**
- `confirmation_type: TEXT_ENTRY`
- `confirmation_value`: the exact string `EMERGENCY`
- Text field shown; Confirm button `[DISABLED]` until field matches `EMERGENCY` exactly (case-sensitive)
- Label text on field: "Type EMERGENCY to confirm"
- Annotation: `[TEXT_ENTRY: case-sensitive; Confirm button absent from DOM until input matches exactly — becomes present on match]`

**Incident declaration confirmation:**
- `confirmation_type: CHECKBOX`
- Modal title: "Declare Incident"
- Description field shows severity, scope, and consequences

**IC Transfer — 30-second review modal:**
- `confirmation_type: CHECKBOX`
- Countdown timer showing seconds remaining in 30-second review period
- Accept button: `[DISABLED]` until countdown completes AND checkbox is checked
- Cancel button: `[PRESENT: enabled]` throughout
- Annotation: `[IC Transfer: 30-second mandatory review; Confirm button gated behind countdown + checkbox]`

**All modals:**
- z-index 800
- Escape key calls on_cancel
- Annotate: `[ConfirmationModal: z-index=800; Escape → cancel]`

---

## 9. Things Wireframes Must NOT Invent

The following are explicit prohibitions. A wireframe containing any of these items is non-conforming and must be revised.

### 9.1 Layout Prohibitions

- **No additional navigation tiers.** Zone A and contextual tab bars (within workspaces) are the only navigation structures. No secondary sidebars, no breadcrumb navigation trees, no drawer navigation.
- **No resizable zones.** Zone A is 280px fixed. Zone C is 320px or 0px. Zone B is fluid. No drag handles between zones.
- **No Zone A content that is workspace-specific.** Zone A is identical across all surfaces. Do not show Zone A items that only appear when a specific workspace is active.
- **No condensed or mobile layouts.** Minimum viewport is 1280×768. No responsive breakpoints below this.

### 9.2 Authority and Control Prohibitions

- **No controls that bypass the authority model.** Every control must respect role and state rules. Do not invent a "force override" or "emergency bypass" button that is not in the specification.
- **No greyed Tab 6 for non-ADMIN.** Tab 6 is absent — not greyed, not hidden, not disabled. If a wireframe shows a greyed "Counterfactual" tab for an OPERATOR role, it is non-conforming.
- **No disabled collapse toggle for Section 1.** Section 1 of VenueOperationsDashboard has no collapse affordance of any kind.
- **No "Recovery Workflow" rendered alongside standard intervention buttons.** When `RecoveryWorkflow` is active, `PlaceOverrideButton` and `DeclareIncidentButton` are absent — not alongside the workflow, not underneath it, not hidden.

### 9.3 Status and Trust Prohibitions

- **No UNKNOWN trust rendered as neutral.** `_trust_level: UNKNOWN` is never green, never a checkmark, never shown without explicit uncertainty text.
- **No additional trust levels beyond the four specified.** The trust levels are: `TRUSTED`, `DEGRADED_TRUST`, `UNTRUSTED`, `UNKNOWN`. Do not invent `PARTIALLY_TRUSTED`, `CHECKING`, or similar.
- **No additional constitutional states.** The constitutional states are exactly: `HEALTHY`, `DEGRADED`, `CONSTITUTIONAL_RISK`, `SHADOW_ONLY`, `PRE_DISABLED`, `READ_ONLY`, `EMERGENCY_FREEZE`. Do not invent `WARNING`, `CAUTION`, `MAINTENANCE`.
- **No additional status dimensions.** The 7 orthogonal trust/status dimensions are defined in the Operational Status and Trust Model. Do not add new dimensions.
- **No operator-set trust or health values.** Operators cannot set a venue as "trusted" or "healthy" through UI action. Trust is backend-determined.

### 9.4 Data and Pattern Prohibitions

- **No "are you sure?" dialogs for Class B navigation events.** Navigation between workspaces and tab switches do not trigger confirmation dialogs.
- **No pagination for append-only lists.** Incident logs, annotation lists, and corpus event lists are append-only. They use infinite scroll or a virtualized list. Annotate as: `[Virtualized list: infinite scroll, no pagination controls]`
- **No night mode or dark mode variants.** There is no dark mode. All wireframes use the single visual mode.
- **No color coding beyond the severity and trust semantics.** Do not introduce color meanings not defined by the severity (S1–S5), trust (TRUSTED/DEGRADED/UNTRUSTED/UNKNOWN), or constitutional state palette.
- **No stale data rendered as current.** If a data field is STALE or EXPIRED, the wireframe must show the staleness annotation. Never show stale data without the age display.
- **No "No active incidents" when data is absent.** When `active_incidents` is absent, the wireframe must show "Incident status unavailable" — not an empty list, not "No active incidents."

### 9.5 Interaction Prohibitions

- **No write controls in REPLAY mode.** The `ReplayForensicsWorkspace` suppresses all write-capable controls. `AnnotationComposer` is the sole write affordance, and it becomes read-only after its single write is confirmed.
- **No navigation away from replay that is blocked.** Operators can navigate away from the Replay workspace. The surface does not trap the operator.
- **No IC surface rendered as a modal.** The Incident Commander Surface is a Zone B workspace accessed via route change — not a modal, not an overlay.
- **No Zone B controlling Zone A.** No wireframe may show Zone B workspace content influencing Zone A layout or data display.

---

## 10. Disambiguation Table — Ambiguities and Resolutions

Based on the ambiguity register in FRONTEND-IMPLEMENTATION-READINESS-ASSESSMENT-v1.md, the following table specifies what wireframes must show for each ambiguous case.

| Ambiguity | ID | Wireframe instruction |
|---|---|---|
| CMS override stack in REPLAY mode | A-01 | Wireframe shows CMS workspace with all write controls absent (`[ABSENT: state-based, state=REPLAY_MODE]`); data display annotated `[TBD: whether data reflects historical state at replay timestamp or current LIVE state — product decision pending]`; show a placeholder notice: "Override state shown may not reflect replay timestamp — see Replay workspace for historical override investigation" |
| Stale heartbeat visual threshold | A-02 | Use threshold annotation: `[DATA: player_state.heartbeat_freshness — threshold values backend-configured, not hardcoded]`; show STALE treatment using amber indicator without specifying exact duration thresholds |
| ApprovalQueue authority model | A-03 | Show `ApprovalQueueItem` list with `requires_role` field annotated per item; approve/reject buttons annotated `[TBD: authority model for approval actions unresolved — see A-03]`; do not invent authority rules for self-approval |
| Operator presence in IC-TOP | A-04 | Show presence area in `IC-TOP` `CommanderStatus` region; annotate as `[DATA: operator_presence[] — data shape and update mechanism TBD per A-04]`; show up to 5 operator initial badges with "+N more" for overflow using placeholder initials `JM`, `AR`, `SW` |
| Training module content format | A-05 | Show `TrainingContent` region with `[TBD: content format per module unresolved — A-05 decision pending]`; do not invent module content types |
| WebSocket missed event recovery | A-06 | Show WebSocket disconnected banner in `SystemStatusBar` with text "Live updates paused — last update X minutes ago"; annotate `[TBD: reconnection and missed-event recovery behavior — A-06 decision pending]` |
| Certification progress persistence | A-07 | Show module progress indicators in `TrainingModuleNav`; annotate `[DATA: certification progress — persistence mechanism TBD per A-07]` |
| Fleet venue access scoping | A-08 | Show `FleetVenueGrid` with venue access scoping annotation `[DATA: accessible venues — API query pattern TBD per A-08]`; do not invent a filter or scoping UI |

**TBD annotation format:**
When a wireframe must show content for an unresolved ambiguity, use:
```
[TBD: {brief description} — {ambiguity ID} decision pending; do not implement without resolution]
```

---

## 11. Wireframe Delivery Checklist

This checklist must be completed for each surface wireframe set before delivery. A wireframe set is not complete until every item is checked.

### 11.1 Coverage

- [ ] All wireframe IDs in Section 3 for this surface are produced
- [ ] All roles are covered: VIEWER, OPERATOR, ADMIN (where role produces distinct output)
- [ ] Tab 6 absent wireframe included for IC Surface and Replay Workspace (non-ADMIN version)
- [ ] Tab 6 present wireframe included for IC Surface and Replay Workspace (ADMIN version)
- [ ] `COMMANDER_LAPSED` state depicted for IC Surface (with countdown display)
- [ ] `RECOVERED_BUT_UNTRUSTED` state depicted for Venue Operations Dashboard
- [ ] 72-hour autonomy clock depicted on Venue Operations Dashboard (VOD-AUTO-72)
- [ ] `REPLAY` mode label always visible on all Replay Workspace wireframes
- [ ] L4 sponsor ceiling annotation visible on CMS Sponsorship Manager wireframe
- [ ] `EMERGENCY_FREEZE` state depicted for all primary surfaces

### 11.2 Layout and Chrome

- [ ] Every wireframe uses the canonical three-zone layout (Section 2.1)
- [ ] System Status Bar present at 48px with all required sub-components
- [ ] Audit Trace Footer present at 28px with `LastAuditEventDisplay` and `OpenReplayLink`
- [ ] Zone A shows all four panes: A1 VenueSelector, A2 IncidentList, A3 NotificationTrayAccess, A4 OperatorToolsMenu
- [ ] Zone C shown in default open state for all wireframes not specifically depicting collapsed state
- [ ] `ConstitutionalStateIndicator` shows both state AND confidence on every wireframe
- [ ] `ActiveModeIndicator` shows correct mode for each wireframe

### 11.3 Controls and Authority

- [ ] Every interactive control has an exact label (no "Button 1" or placeholder labels)
- [ ] Every interactive control has an authority annotation: `[PRESENT: enabled]`, `[PRESENT: disabled]`, `[ABSENT: role-based]`, or `[ABSENT: state-based]`
- [ ] No greyed Tab 6 for non-ADMIN roles (Tab 6 must be absent, not disabled)
- [ ] No collapse toggle for Section 1 of VenueOperationsDashboard
- [ ] RecoveryWorkflow and standard intervention buttons are never shown simultaneously
- [ ] L6 override submit button absent from DOM when PRE preview not loaded (not disabled — absent)

### 11.4 Data and Annotations

- [ ] Per-wireframe header annotations present on every wireframe: ROLE, CONSTITUTIONAL STATE, MODE, SURFACE, WIREFRAME ID
- [ ] Every data field has a realistic placeholder value (ISO timestamps, realistic IDs, exact enum values)
- [ ] Every data field has a `[DATA: field.path from source]` annotation
- [ ] `UNKNOWN` trust is not rendered as neutral — grey indicator + explicit text present
- [ ] STALE or EXPIRED data includes age annotation
- [ ] Absent data rendered as "unavailable" — not as empty or as default-good state
- [ ] TBD annotations present for all A-01 through A-08 ambiguities that affect this surface

### 11.5 Modals and Interrupts

- [ ] ConfirmationModal wireframe produced for every action that triggers one
- [ ] L6 TEXT_ENTRY modal with "EMERGENCY" confirmation string depicted
- [ ] IC Transfer 30-second review modal depicted with countdown and gated Confirm button
- [ ] Level 1 interrupt wireframe depicts full-screen overlay above open modals (if applicable)
- [ ] All modal wireframes annotated with z-index 800
- [ ] All Level 1 interrupt wireframes annotated with z-index 900

### 11.6 Prohibited Patterns Verification

- [ ] No write controls rendered in Replay workspace (except AnnotationComposer before first write)
- [ ] No workspace-specific content shown in Zone A
- [ ] No pagination controls on append-only lists
- [ ] No additional constitutional states or trust levels invented
- [ ] No UNKNOWN trust rendered as neutral
- [ ] No CMS navigation items absent during EMERGENCY_FREEZE (they are disabled, not absent)
- [ ] No night mode or dark mode variants
