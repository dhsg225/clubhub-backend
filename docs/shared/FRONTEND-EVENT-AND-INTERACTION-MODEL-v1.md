# Frontend Event and Interaction Model — v1

**Document type:** Implementation-grade architecture specification
**Audience:** Frontend engineering team
**Status:** Authoritative — do not deviate without architectural review
**Scope:** All frontend events, their governance, propagation rules, and authority contracts
**Depends on:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, OPERATIONAL-ENTITY-CATALOG-v1.md

---

## Purpose

This document defines the complete event model for the ClubHub TV frontend. Every interaction an operator performs, every navigation event generated, and every system push received must conform to the classification, naming, and governance rules defined here. The event model is an audit and authority boundary — it is not merely a software design convenience.

An event that does not conform to this model has no defined behavior. Frontend engineers must not invent event handling patterns outside this specification.

---

## Event Classification

All frontend events belong to exactly one of three classes. Misclassifying an event is an implementation defect.

### Class A — Operator Actions

Events initiated by a deliberate operator interaction. These represent operator intent and must generate an audit trail entry on the server when confirmed.

**Defining properties:**
- Caused by operator input (click, keyboard, form submit)
- Submitted to the server for authority validation before taking effect
- Produce a server-confirmed event on success and a rejection event on failure
- Must never update authoritative state (incident list, override stack, annotation corpus) until server confirmation is received
- Client-side optimistic state permitted only for visual feedback (button loading state, spinner) — never for data state

**Approved approach:** Submit to server, await confirmation, then update displayed data.
**Forbidden approach:** Update displayed data first, then submit to server in the background.
**Operational consequence:** Optimistic data updates cause operators to act on state the server has not confirmed. In incident management, acting on unconfirmed state can cause multi-operator coordination failures.
**Verification method:** Test that submitting a Class A event while the server is unavailable leaves all data displays unchanged and renders only a pending indicator.

### Class B — Navigation Events

Events caused by operator navigation: workspace selection, tab switching, timeline scrubbing, entity deep-links. These update the URL and client history but do not directly mutate server-side operational state.

**Defining properties:**
- Caused by operator interaction but do not write operational entities
- Update browser URL and, for workspace/tab changes, push to browser history
- Must not cause server audit trail entries (client-side logging only)
- Must not lose unsaved form state without operator confirmation

**Approved approach:** Update URL, push history entry, emit to client-side analytics.
**Forbidden approach:** Silently discard entered form data when the operator navigates away.
**Operational consequence:** Discarding form data mid-override-placement causes operators to lose work during high-urgency operations. Losing an L6 emergency confirmation string requires the operator to retype under pressure.
**Verification method:** Test that navigating away from any form with unsaved data triggers a confirmation dialog and that declining the dialog leaves the form intact.

### Class C — System Events

Events received from the backend via WebSocket push or polling. These inform the frontend of state changes that occurred outside operator action. They must never be confused with operator-initiated events in any audit context.

**Defining properties:**
- Received, not initiated — the frontend is a subscriber, not an author
- Always tagged `_source: SYSTEM` in internal event metadata
- May trigger UI updates but must not create operator-attribution in audit context
- Subject to priority ordering (see Contract IC-05)

**Approved approach:** Tag all received events with `_source: SYSTEM`, route to appropriate display components, never echo back to server as operator-initiated.
**Forbidden approach:** Forwarding a received Class C event as though the operator initiated it (e.g., updating the audit trail UI to show the operator "performed" an action that was system-generated).
**Operational consequence:** Audit trail contamination — operators or auditors cannot distinguish between what an operator did and what the system did autonomously.
**Verification method:** Inspect audit trail after a system-generated state change. Confirm no operator attribution appears. Confirm `_source: SYSTEM` tag is present in all event metadata.

---

## Event Naming Standard

All events follow the pattern: `{domain}:{entity}:{action}`

This pattern is mandatory. Events with non-conforming names must not be processed by the event bus.

**Domain values:** `incident`, `override`, `replay`, `handoff`, `step`, `training`, `navigation`, `system`
**Entity values:** The specific entity type being acted upon (e.g., `declaration`, `placement`, `session`, `annotation`, `workspace`, `tab`, `constitutional_state`)
**Action values:** The lifecycle moment — `submitted`, `confirmed`, `rejected`, `opened`, `written`, `acknowledged`, `completed`, `changed`, `new`

Compound actions use past-tense verbs. The `submitted` action always precedes a server round-trip. The `confirmed` and `rejected` actions always follow a server response.

**Approved approach:** Name events using `{domain}:{entity}:{action}` and validate names at event bus registration.
**Forbidden approach:** Free-text event names, numeric event codes, or framework-specific event names (e.g., `onClick`, `formSubmit`).
**Operational consequence:** Non-standardized event names cannot be correlated across the audit trail, analytics system, or cross-component event bus. Debugging production incidents becomes non-deterministic.
**Verification method:** Static analysis rule: reject event registration where name does not match `^[a-z]+:[a-z_]+:[a-z_]+$`.

---

## Class A Event Specifications

### `incident:declaration:submitted`

**Source component:** IncidentDeclaration component
**Domain ownership:** Incident domain
**Propagation:**
1. Operator completes declaration form and activates [Declare Incident].
2. Component emits `incident:declaration:submitted` to the incident domain handler.
3. Handler submits to `POST /api/incidents`.
4. On server confirmation: emits `incident:declaration:confirmed`, navigates Zone B to `/incidents/:incident_id`.
5. On server rejection: emits `incident:declaration:rejected`, surfaces `rejection_reason` inline within the IncidentDeclaration component.

**Audit requirement:** Written to audit trail by server on confirmation. Client must not write audit events for this or any Class A action. The server is the sole audit author.
**Replay requirement:** Declaration event reconstructible from `declared_at` governed_timestamp and `declared_by` operator_id stored in the incident record.
**Forbidden:** Client must not add the new incident to Zone A Incident List (A2) before server confirmation arrives. The button may enter a loading state. The list must not change.
**Approved approach:** Show pending state on submit button. Await server response. On confirmation, navigate and update list. On rejection, show reason inline.
**Operational consequence:** Adding an incident to Zone A before server confirmation causes multi-operator environments to show ghost incidents. Operators may begin coordinating on an incident that was rejected.
**Verification method:** Intercept the confirmation response. Confirm Zone A incident list does not update until response is received.

---

### `override:placement:submitted`

**Source component:** OverrideControl component
**Domain ownership:** Override domain
**Propagation:**
1. Operator completes override form. For L6 overrides: client validates the typed "EMERGENCY" confirmation string before enabling [Place Override].
2. Component emits `override:placement:submitted`.
3. Handler submits to `POST /api/overrides`.
4. On confirmation: emits `override:placement:confirmed`, updates override stack display in Section 3 of VenueOperationsDashboard and in CMS Override Control tab.
5. On rejection: emits `override:placement:rejected`, surfaces `rejection_reason` inline.

**Authority check:** Client checks `_authority.action_permitted` before rendering the [Place Override] button. If `action_permitted` is false, the button is absent, not disabled. Server re-validates authority on receipt regardless of client check.
**Audit requirement:** Server writes to audit trail on confirmation.
**Forbidden:** Placing an L6 override without client-side validation of the "EMERGENCY" confirmation string. Server also validates — both checks are mandatory, not either/or.
**Approved approach:** Validate confirmation string client-side, enable submit button only when valid, submit to server, await confirmation before updating override stack.
**Operational consequence:** Bypassing L6 client validation allows accidental emergency content placement without the intentional friction the confirmation string provides.
**Verification method:** Attempt L6 placement without typing "EMERGENCY". Confirm submit button remains disabled. Confirm server still rejects if bypass is attempted via API directly.

---

### `replay:annotation:written`

**Source component:** AnnotationComposer within ReplayForensicsWorkspace
**Domain ownership:** Replay domain
**Propagation:**
1. Operator completes annotation text and submits.
2. Component emits `replay:annotation:written`.
3. Handler submits to `POST /api/replay/annotations`.
4. On confirmation: server returns `annotation_id`. Component transitions the text field to a read-only annotation display. Emits `replay:annotation:written:confirmed`.
5. On rejection: surfaces rejection reason inline.

**Audit requirement:** Annotation written to corpus by server. The `annotation_id` from the server response is the permanent record identifier.
**Forbidden:** Allowing any editing of the annotation field after `replay:annotation:written:confirmed` is received. The annotation is write-once and must become permanently read-only in the UI immediately on confirmation.
**Approved approach:** On confirmation, replace the AnnotationComposer input with a static read-only display of the annotation text and its governed timestamp.
**Operational consequence:** Allowing post-confirmation editing creates the appearance that an annotation can be modified, which it cannot — corpus annotations are immutable. This misleads operators and may cause them to believe a correction was saved when it was not.
**Verification method:** Submit an annotation, receive confirmation, attempt to click the annotation text. Confirm no input field renders. Confirm server returns 400/403 on any subsequent annotation edit attempt for the same annotation_id.

---

### `handoff:section:acknowledged`

**Source component:** HandoffWorkflow component
**Domain ownership:** Handoff domain
**Propagation:**
1. Operator acknowledges each of the 5 handoff sections individually.
2. Each acknowledgement emits `handoff:section:acknowledged` and submits independently to the server.
3. Server confirms each section acknowledgement individually.
4. [Accept Handoff] button becomes enabled only when all 5 acknowledgements have been server-confirmed.
5. On final acceptance: emits `handoff:accepted`, records incoming commander.

**Forbidden:** Enabling [Accept Handoff] based on client-side acknowledgement count alone. On page load, the component must query server-side acknowledgement state and use that to determine the button's enabled state.
**Approved approach:** On component mount, fetch current acknowledgement state from server. On each acknowledgement, submit to server. Enable [Accept Handoff] only after all 5 are confirmed by server.
**Operational consequence:** Client-side acknowledgement counting allows an operator to accept a handoff without the server recording acknowledgement of each section. This creates an audit record showing handoff completion without confirmation of operator comprehension.
**Verification method:** Acknowledge 4 of 5 sections. Reload the page. Confirm [Accept Handoff] is still disabled. Confirm the server reports 4 of 5 acknowledged, not 5.

---

### `step:recovery:completed`

**Source component:** RecoveryWorkflow component
**Domain ownership:** Recovery domain
**Propagation:**
1. Operator completes each recovery step.
2. Each step completion emits `step:recovery:completed` and submits to server.
3. Server validates step authority before confirming. Step 4 requires ADMIN role — server rejects OPERATOR-role completions of Step 4.
4. On confirmation: next step renders. On rejection: rejection reason renders inline.

**Forbidden:** Allowing an OPERATOR-role session to complete Step 4. This must be caught client-side (ADMIN role check before rendering the Step 4 completion control) AND server-side. Client check is not a substitute for server check.
**Approved approach:** Check session role before rendering each step's completion control. Submit to server. Await server confirmation before rendering the next step.
**Operational consequence:** A recovery workflow completed by an unauthorized operator role produces an audit trail with invalid authority attributions. If recovery fails, the audit record is unusable for forensic determination of what happened and who authorized it.
**Verification method:** Authenticate as OPERATOR. Navigate to an active recovery workflow with Step 4 in scope. Confirm Step 4 completion control is absent from the UI. Confirm direct API submission of Step 4 completion is rejected with 403.

---

### `training:simulation:action`

**Source component:** SimulationControls component (instructor role only within TrainingWorkspace)
**Domain ownership:** Training domain
**Propagation:**
1. Instructor activates a simulation scenario control.
2. Component emits `training:simulation:action` tagged with `_simulation: true`.
3. Handler submits to simulation API endpoint, never to production API endpoint.
4. Simulation responses are rendered within the sandboxed TrainingWorkspace only.

**Forbidden:** Any `training:simulation:action` event reaching production API endpoints. The simulation API client and the production API client must be separate modules. TrainingWorkspace must not import the production API client.
**Approved approach:** Maintain a dedicated simulation API client. TrainingWorkspace exclusively uses the simulation API client. Production API client is not imported in any TrainingWorkspace module.
**Operational consequence:** Simulation actions reaching production endpoints cause real overrides, real incident declarations, or real corpus writes that must then be manually reversed — creating audit trail pollution and potential operational disruption during live venue operation.
**Verification method:** Import graph static analysis: confirm TrainingWorkspace modules have zero imports from production API client modules. Integration test: confirm simulation actions return 404 or routing error when directed at production endpoints.

---

## Class B Event Specifications

### `navigation:workspace:changed`

**Source component:** WorkspaceRouter
**Domain ownership:** Navigation domain
**Propagation:**
1. Operator selects venue (A1), incident (A2), notification link (A3), or enters URL directly.
2. WorkspaceRouter emits `navigation:workspace:changed`.
3. URL updates to new workspace path. Browser history entry pushed.
4. Event emitted to client-side analytics. Not written to server audit trail.

**What triggers it:** Zone A venue selection, Zone A incident selection, direct URL navigation, notification click navigating to a workspace.
**Forbidden:** Changing workspace and silently discarding unsaved form data (override form, schedule form, handoff acknowledgements). If the departing component has unsaved data, a confirmation dialog must appear: "You have unsaved changes — leave anyway?" with [Leave] and [Stay] options.
**Approved approach:** Before unmounting a workspace with active form state, check for unsaved data. If present, show the confirmation dialog. Only unmount on [Leave] confirmation.
**Operational consequence:** Silent data loss during override placement means an operator believes an override is active when it was never submitted. In L6 scenarios this is a safety failure.
**Verification method:** Begin filling an override form. Navigate to a different venue. Confirm the unsaved data warning dialog appears. Confirm clicking [Stay] preserves the form. Confirm clicking [Leave] discards the form and completes navigation.

---

### `navigation:tab:changed`

**Source component:** WorkspaceTabs (within CMSWorkspace, ReplayForensicsWorkspace)
**Domain ownership:** Navigation domain
**Propagation:**
1. Operator selects a tab within a workspace.
2. WorkspaceTabs emits `navigation:tab:changed`.
3. URL updates (tab is a URL sub-path or query parameter).
4. Browser history entry pushed.

**Forbidden:** Tab changes within a workspace must not trigger a full component remount of the workspace shell. Only the tab content area unmounts and remounts. Zone A, Zone C, SystemStatusBar, and AuditTraceFooter must not re-render due to tab changes.
**Approved approach:** Implement tab switching as a state change within the mounted workspace component. Render only the active tab's content. Preserve inactive tab form state in workspace-level state.
**Operational consequence:** Full workspace remount on tab switch loses all in-progress work across tabs and causes visible flicker, which is disorienting in high-urgency incident investigation workflows.
**Verification method:** Enter data in CMS Tab 1. Switch to Tab 2. Switch back to Tab 1. Confirm data is preserved. Profile render tree during tab switch to confirm workspace shell does not remount.

---

### `navigation:replay:timeline:scrubbed`

**Source component:** ReplayTimeline component (RP-TIMELINE sub-zone)
**Domain ownership:** Navigation domain
**Propagation:**
1. Operator drags scrubber or inputs a governed timestamp.
2. ReplayTimeline emits `navigation:replay:timeline:scrubbed`.
3. URL `?t=` parameter updates via `history.replaceState` (not `pushState`) — scrubbing does not create history entries.
4. RP-MAIN and RP-DETAIL update to display content at the scrubbed position.

**Forbidden:**
- Timeline scrubbing must not push to browser history. Each scrub position must replace the current history entry. Using `pushState` during scrubbing creates an unusable history stack.
- Timeline scrubbing must not update Zone A venue state badges. Zone A always shows LIVE state, regardless of the replay timestamp being examined.

**Approved approach:** Use `history.replaceState` for `?t=` updates during scrubbing. Zone A subscribes to LIVE state independently from the replay session timeline.
**Operational consequence:** History stack pollution from scrubbing causes the browser back button to step through scrub positions instead of navigating to the previous workspace, trapping operators in an unusable navigation state.
**Verification method:** Scrub the replay timeline 20 positions. Press browser back. Confirm navigation goes to the workspace preceding the replay session, not to a prior scrub position. Confirm Zone A venue badges show current LIVE state throughout scrubbing.

---

## Class C Event Specifications

### `system:constitutional_state:changed`

**Source:** WebSocket subscription, system-wide scope
**Propagation:** Received by ApplicationShell. Distributed to:
- SystemStatusBar: updates constitutional state badge and (if EMERGENCY_FREEZE) turns entire bar red
- ZoneCPanel C4 (ConstitutionalAdvisory): updates advisory view
- InterruptDisplay: triggers Level 1 interrupt if state is EMERGENCY_FREEZE or PRE_DISABLED

**Internal metadata requirement:** `_source: SYSTEM` must be present in event metadata. This field must not be settable by any operator-facing component.
**Forbidden:** This event must not be confused with an operator action. Under no circumstances may a `system:constitutional_state:changed` event appear in the audit trail as operator-initiated.
**Approved approach:** ApplicationShell receives WebSocket messages, validates `_source: SYSTEM` tag, and distributes via application context. No operator-facing component publishes to the system channel.
**Operational consequence:** Audit trail contamination — if a constitutional state change is attributed to an operator, post-incident forensics cannot determine whether the state was triggered automatically or deliberately overridden by a human.
**Verification method:** Trigger a constitutional state change via backend. Confirm audit trail shows system as source. Confirm no `operator_id` appears in the audit entry for the state change event.

---

### `system:incident:new`

**Source:** WebSocket subscription, per-venue scope
**Propagation:**
1. Received by ApplicationShell (venue subscription channel).
2. Distributed to ZoneAPanel: updates A2 Incident List.
3. Triggers Level 2 interrupt display with incident ID and severity.
4. If IncidentCommanderSurface is currently active for the same venue, propagates incident data to it.

**Forbidden:** System-generated incident notifications must not appear as operator-initiated in any audit context. The interrupt display must label the source as "System notification."
**Approved approach:** Interrupt display triggered by `system:incident:new` shows the incident ID and severity badge. It does not imply that the viewing operator declared the incident.
**Operational consequence:** Misattribution of system-declared incidents to operators creates false authority records and undermines multi-operator coordination (operators may believe a colleague they cannot contact declared the incident).
**Verification method:** Have backend declare an incident without any operator UI action. Confirm Zone A updates. Confirm interrupt appears. Confirm audit trail correctly attributes declaration to the backend system actor.

---

### `system:player_state:changed`

**Source:** WebSocket subscription, per-venue scope
**Propagation:**
1. Received by ApplicationShell (venue subscription).
2. Distributed to VenueOperationsDashboard if that venue is currently displayed in Zone B.
3. Distributed to ZoneAPanel for the venue state indicator update.

**Forbidden:** Zone A must not rely on Zone B to update its venue state indicators. Zone A maintains its own direct subscription to venue state. If Zone B is not displaying the affected venue, Zone A still updates.
**Approved approach:** ZoneAPanel subscribes independently to per-venue state events. VenueOperationsDashboard also subscribes independently. Each subscribes via the ApplicationShell event distribution mechanism.
**Operational consequence:** If Zone A depends on Zone B for state updates, a venue whose dashboard is not currently displayed has a stale state indicator in Zone A. Operators navigating by Zone A indicators make decisions on stale data.
**Verification method:** Display Venue X in Zone B. Change to display Venue Y in Zone B. Trigger a player state change for Venue X. Confirm Zone A updates Venue X's indicator without Zone B being mounted for Venue X.

---

## Interaction Contracts

Interaction contracts are architectural rules. They take precedence over individual component implementation decisions.

### Contract IC-01: Write-Confirm-Then-Update

**Rule:** For all Class A events, the sequence is: (1) operator submits, (2) server confirms, (3) UI updates authoritative state. The sequence may never be reordered.

**Exception permitted:** Loading/pending visual states (spinner on submit button, button disabled) may render before confirmation. No data display may change before confirmation.

**Approved approach:** Submit handler sets button loading state, posts to server, awaits response, then updates data state on confirmation or shows inline error on rejection.
**Forbidden approach:** Any pattern where the data layer updates before the server response arrives. This includes optimistic mutation libraries configured to update state before server round-trip.
**Operational consequence:** Confirmed operators acting on unconfirmed state in multi-operator environments will produce coordination failures, particularly in incident declaration and override placement scenarios.
**Verification method:** Add artificial 2-second server delay. Submit any Class A action. Confirm data displays are unchanged for the full 2 seconds. Confirm button shows loading state. Confirm data updates on response.

---

### Contract IC-02: Rejection Surfacing

**Rule:** When a server rejects a Class A event, the rejection reason must be surfaced inline at the point of action. It must not appear only in a global notification.

**The rejection reason must be visible without the operator navigating away from the component that submitted the action.**

**Approved approach:** Each action component has an error state that renders rejection reasons below the submit button or at the top of the form. The component manages its own error state.
**Forbidden approach:** Routing rejection reasons exclusively to a global toast/notification system, from which they disappear after a timeout while the operator has already navigated away.
**Operational consequence:** Global-only rejection surfaces mean operators frequently do not see why their action was rejected. They retry the rejected action repeatedly, do not understand the authority constraint, and escalate incorrectly.
**Verification method:** Trigger a server rejection for each Class A event type. Confirm rejection reason renders inline in the submitting component. Confirm rejection reason persists until operator dismisses it or resubmits.

---

### Contract IC-03: Mode Enforcement

**Rule:** In REPLAY mode, all Class A events (write actions) must be blocked at the component level. Components check `_mode === 'REPLAY'` before rendering write controls.

**This is in addition to, not instead of, server-side authority checks.**

**Approved approach:** WorkspaceRouter or ApplicationShell provides `_mode` via context. Each component that has write controls checks mode on render. In REPLAY mode, write controls are absent, not disabled.
**Forbidden approach:** Relying on server-side mode enforcement only, leaving write controls visible and clickable in REPLAY mode.
**Operational consequence:** Write controls visible in REPLAY mode create operator confusion — operators believe they are in LIVE mode and making real changes. This is an operational safety failure that the amber REPLAY banner alone cannot prevent.
**Verification method:** Enter REPLAY mode. Navigate to every workspace. Confirm every write control (override placement, incident declaration, annotation composer before first submission, recovery steps) is absent from the UI. Confirm server also rejects any write attempt made in REPLAY mode.

---

### Contract IC-04: Audit Before Confirmation

**Rule:** The client must not display "success" to the operator until the server has confirmed the audit event was written.

A successful database write without a corresponding audit trail write is not a successful operation. The server must return a response indicating audit write success before the client shows confirmation.

**Approved approach:** Server API responses for Class A actions include an `audit_written: true` field. Client checks this field before transitioning to success state.
**Forbidden approach:** Treating HTTP 200 from the data write as confirmation of success if `audit_written` is absent or false.
**Operational consequence:** An operation that succeeded in the database but failed in the audit trail is a compliance failure. Operators shown "success" believe the operation is complete and move on. Forensic investigators later find the audit trail has a gap.
**Verification method:** Force an audit write failure on the server (test hook). Submit a Class A action. Confirm the client does not show success. Confirm the client shows an error state and the operator can retry.

---

### Contract IC-05: Emergency Interrupt Priority

**Rule:** Class C `system:constitutional_state:changed` events with state = EMERGENCY_FREEZE must be processed before any pending Class A or Class B event in the event queue.

**Emergency state changes are not queued behind user interactions.**

**Approved approach:** Implement priority queuing in the application event bus. EMERGENCY_FREEZE events are inserted at the front of the queue, interrupting any pending event processing.
**Forbidden approach:** Processing all events in arrival order, allowing a slow Class A server round-trip to delay rendering of an EMERGENCY_FREEZE interrupt.
**Operational consequence:** An EMERGENCY_FREEZE event delayed by a queued interaction means operators continue taking actions (placing overrides, declaring incidents) while the system has already frozen. These actions fail with cryptic errors rather than being cleanly preempted.
**Verification method:** Trigger a Class A action with artificial server delay. During the delay, trigger an EMERGENCY_FREEZE event from the backend. Confirm EMERGENCY_FREEZE interrupt renders immediately, before the Class A response is processed. Confirm Class A action is cancelled or marked as failed due to freeze state.

---

## Event Authority Boundaries

Events may only originate from specific sources. Violations of these boundaries are implementation defects, not configuration choices.

| Event prefix | Permitted origin | Rejection behavior |
|---|---|---|
| `system:*` | WebSocket channel only | Any `system:` event from a non-WebSocket source is rejected by the event bus and logged as a security anomaly |
| `training:*` | SimulationControls component only | Any `training:` event from a non-TrainingWorkspace source is rejected |
| `replay:*` write events | ReplayForensicsWorkspace only | Any `replay:annotation:written` event from outside ReplayForensicsWorkspace is rejected |
| `handoff:*` | HandoffWorkflow component only | Not routable from other components |
| `step:recovery:*` | RecoveryWorkflow component only | Not routable from other components |

**Enforcement mechanism:** The event bus must validate event source metadata at registration time. Components declare their permitted event types at instantiation. Attempts to publish out-of-scope event types are rejected and logged.

**Approved approach:** Event bus requires source component declaration. Publisher metadata is validated against the authority boundary table on each emit call.
**Forbidden approach:** Open event bus where any component can emit any event type.
**Operational consequence:** An open event bus allows frontend bugs (or a compromised component) to emit `system:constitutional_state:changed` with false state, causing the entire UI to enter EMERGENCY_FREEZE based on a frontend artifact rather than a real backend state change.
**Verification method:** Attempt to emit a `system:constitutional_state:changed` event from a non-WebSocket source. Confirm the event bus rejects it and logs the violation.

---

## Appendix: Event Quick Reference

| Event | Class | Source | Server round-trip | Audit trail |
|---|---|---|---|---|
| `incident:declaration:submitted` | A | IncidentDeclaration | Yes | Server on confirmation |
| `incident:declaration:confirmed` | A | Server response | — | Already written |
| `incident:declaration:rejected` | A | Server response | — | Not written |
| `override:placement:submitted` | A | OverrideControl | Yes | Server on confirmation |
| `override:placement:confirmed` | A | Server response | — | Already written |
| `replay:annotation:written` | A | AnnotationComposer | Yes | Server on confirmation |
| `replay:annotation:written:confirmed` | A | Server response | — | Already written |
| `handoff:section:acknowledged` | A | HandoffWorkflow | Yes (per section) | Server on confirmation |
| `handoff:accepted` | A | HandoffWorkflow | Yes | Server on confirmation |
| `step:recovery:completed` | A | RecoveryWorkflow | Yes | Server on confirmation |
| `training:simulation:action` | A | SimulationControls | Simulation only | Never audit trail |
| `navigation:workspace:changed` | B | WorkspaceRouter | No | Client analytics only |
| `navigation:tab:changed` | B | WorkspaceTabs | No | Client analytics only |
| `navigation:replay:timeline:scrubbed` | B | ReplayTimeline | No | None |
| `system:constitutional_state:changed` | C | WebSocket | — | Server-side (not client) |
| `system:incident:new` | C | WebSocket | — | Server-side (not client) |
| `system:player_state:changed` | C | WebSocket | — | Server-side (not client) |
