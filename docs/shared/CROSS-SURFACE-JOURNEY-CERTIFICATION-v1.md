# Cross-Surface Journey Certification Specification v1

**Classification:** Implementation-grade operational specification — simulation-executable scenarios
**Applies to:** Platform simulation infrastructure, certification test runners, acceptance testing
**Constitutional constraint:** PRE is the source of truth. All state transitions logged. No step may require information unavailable in the platform. Full journey replayable from audit trail alone.
**References:** CANONICAL-OPERATOR-WORKSPACE-SPECIFICATION-v1.md, INCIDENT-COMMANDER-SURFACE-SPECIFICATION-v1.md, REPLAY-AND-FORENSICS-WORKSPACE-SPECIFICATION-v1.md, CMS-AND-CONTENT-OPERATIONS-WORKSPACE-v1.md, VENUE-OPERATIONS-DASHBOARD-v1.md, OPERATIONAL-WORKFLOW-ARCHITECTURE-v1.md

---

## Overview

A Cross-Surface Journey Certification scenario proves:

1. The platform provides sufficient information at every step of the journey.
2. Operators can complete the journey without external briefing, verbal handoff, or off-platform communication.
3. No step requires information that exists only outside the platform.
4. The full journey is replayable from the audit trail alone — every decision point and its resolution are recorded.

Each scenario is defined in simulation-executable form: initial corpus state, injected events, expected audit trail outcomes. Each scenario specifies exact success and failure conditions.

Scenario format for each step:
- **Initial state:** Fully specified corpus state and operator session state
- **Trigger sequence:** Numbered steps with timestamps and injected events
- **Expected operator path:** The correct navigation and action sequence
- **Forbidden paths:** Actions that must be prevented or that indicate platform failure
- **Success conditions:** Verifiable audit trail and state outcomes
- **Failure conditions:** Conditions that indicate the platform failed to support the journey
- **Simulation executable:** Whether the scenario can be executed by automated simulation

---

## Scenario 1: Incident Detection to Full Recovery

**Purpose:** Verify the complete incident lifecycle — from first anomaly through declaration, investigation, containment, and resolution — is navigable without off-platform communication.

### Initial State

- Platform constitutional state: HEALTHY
- Venue `test-venue-001` player state: LIVE
- Active schedule block: `content://test/sports-main`, 09:00–17:00
- No active overrides
- No active incidents
- Operator A: L3 OPERATOR, session active, assigned to `test-venue-001`
- Admin B: L4 ADMIN, session active, assigned to `test-venue-001`

### Trigger Sequence

| T+ | Event | Source |
|---|---|---|
| 0 | Inject DEGRADED constitutional state event (simulated circuit breaker open) | Simulation |
| 30s | DEGRADED state propagates to Zone C Pane C4 for Operator A | Platform |
| 60s | Operator A acknowledges state change in Zone A Pane A2 | Operator |
| 90s | Operator A declares incident (S4) via Venue Operations Dashboard Section 4, `test-venue-001` | Operator |
| 2m | Zone B transitions to Incident Commander Surface, Operator A is commander | Platform |
| 2m30s | Operator A adds annotation: "PRE resolving to L5 fallback, investigating." | Operator |
| 3m | Operator A clicks [Initiate Replay Investigation] | Operator |
| 4m | Replay & Forensics workspace opens, scoped to `test-venue-001` at T-5min | Platform |
| 5m | Operator A navigates to Tab 2 (State Machine View) | Operator |
| 6m | Operator A identifies circuit breaker open event in state machine timeline | Operator |
| 7m | Operator A annotates trigger event: "Circuit breaker opened at [timestamp] — cause: simulated failure" | Operator |
| 8m | Operator A clicks [Return to Incident] — exits replay, returns to Incident Commander Surface | Operator |
| 9m | Admin B reviews recovery protocol options and approves initiation | Admin |
| 10m | Inject HEALTHY constitutional state event (simulated recovery) | Simulation |
| 11m | Operator A verifies PRE resolution trace shows return to L2 (schedule) | Operator |
| 12m | Operator A transitions incident to CONTAINED. Annotation: "PRE restored, schedule serving correctly." | Operator |
| 15m | Operator A transitions incident to RESOLVED. Annotation: "Recovery confirmed. Root cause: simulated circuit breaker. Duration: 15 minutes." | Operator |

### Expected Operator Path

1. Zone C Pane C4 shows DEGRADED badge. System Status Bar shows DEGRADED.
2. Zone A Pane A2 shows incident notification for `test-venue-001`. Operator acknowledges.
3. Operator selects `test-venue-001` in Zone A → Zone B renders Venue Operations Dashboard.
4. Section 4 of Venue Operations Dashboard shows [Declare Incident] with severity selector. Operator selects S4 and declares.
5. Zone B transitions to Incident Commander Surface. IC-TOP shows Operator A as commander. IC-LEFT event log starts.
6. Operator adds annotation via IC-LEFT [Add Note]. Annotation saved to incident log.
7. Operator clicks [Initiate Replay Investigation] in IC-RIGHT tools panel.
8. Replay & Forensics workspace opens as Zone B overlay or modal. Scoped to this incident and `test-venue-001`.
9. Operator navigates to Tab 2 (State Machine View). Timeline shows circuit breaker open event.
10. Operator annotates the circuit breaker event using inline annotation on the timeline event.
11. Operator clicks [Return to Incident] — Replay & Forensics closes. Zone B shows Incident Commander Surface. Replay session is linked to incident.
12. Admin B (as observer or commander, depending on S4 protocol) approves recovery protocol in IC-RIGHT approvals panel.
13. Operator A reviews PRE resolution trace via IC-RIGHT [PRE Resolution] panel. Confirms L2 resolved.
14. Operator A clicks [Transition to CONTAINED] in IC-RIGHT state panel. Adds annotation.
15. After 3 minutes in CONTAINED with confirmed stable PRE: Operator A clicks [Transition to RESOLVED]. Adds annotation.
16. IC-TOP shows RESOLVED. Zone B returns to Venue Operations Dashboard. Incident persists briefly in Zone A Pane A2 as RESOLVED before clearing.

### Forbidden Paths

| Path | Classification |
|---|---|
| Setting RESOLVED without at least one annotation explaining root cause | Platform failure — must enforce annotation before RESOLVED |
| Setting CONTAINED without Admin B approval (S4 requires ADMIN for CONTAINED transition) | Platform failure — must enforce ADMIN approval at S4 CONTAINED |
| Exiting replay without any annotation on the trigger event | Permitted — but replay session records `annotation_count = 0`; advisory shown: "No annotations added to this replay session." Non-blocking. |
| Closing Incident Commander Surface without transitioning incident to a terminal state | Forbidden — IC-TOP navigation away from active incident shows: "Incident is DECLARED. Navigate away without resolving?" with [Cancel] and [Keep open in background] options only. No [Close] option that terminates the incident view. |

### Success Conditions

All of the following must be verified in the audit trail:

- [ ] Incident record shows complete lifecycle: auto-created WATCHING event → DECLARED (by Operator A at T+90s) → CONTAINED (Admin B approval recorded) → RESOLVED
- [ ] At minimum 3 operator annotations in incident log: initial observation, replay finding with circuit breaker reference, resolution confirmation
- [ ] Replay session `session_id` linked to `incident_id` in `replay_incident_links` table
- [ ] Replay session contains at least one annotation on the circuit breaker trigger event
- [ ] Admin B approval record present with `approved_at` timestamp and `approver_id`
- [ ] RESOLVED event includes `resolution_annotation` with root cause and duration
- [ ] PRE resolution trace shows return to L2 after constitutional state returns to HEALTHY
- [ ] Zone B state is Venue Operations Dashboard after RESOLVED (verified by navigation event in audit trail)

### Failure Conditions

- RESOLVED transition accepted without annotation — platform failed to enforce minimum annotation requirement
- CONTAINED transition accepted without Admin B approval record — platform failed to enforce role requirement
- Replay session not linked to incident_id — platform failed to preserve investigation linkage
- PRE resolution trace not accessible from IC-RIGHT — platform failed the "no off-platform information" test for verification step
- Any navigation step requires information not shown in the current surface — platform information architecture failure

**Simulation executable:** Yes. Circuit breaker event injectable at specified timestamp. Constitutional state transitions controllable. PRE resolution output deterministic from fixture corpus. Approval workflow injectable via Admin B session simulation. Audit trail events queryable by scenario_id.

---

## Scenario 2: Divergence Investigation to Root Cause

**Purpose:** Verify that a shadow parity divergence can be investigated, classified, and resolved entirely within the Replay & Forensics workspace without external tooling.

### Initial State

- Platform constitutional state: HEALTHY
- Shadow parity: recent `parity_ratio < 0.9999` for `test-venue-002`
- Corpus contains one test fixture entry with known `input_hash` and `output_hash` where replay produces a different `output_hash` in one field
- Admin C: L4 ADMIN, session active, assigned to `test-venue-002`
- No active incidents

### Trigger Sequence

| T+ | Event | Source |
|---|---|---|
| 0 | Shadow parity alert surfaces in Zone C Pane C4: "Parity ratio below threshold for test-venue-002. Ratio: 0.9997." | Platform |
| 30s | Admin C acknowledges alert in Zone C | Admin |
| 1m | Admin C opens Replay & Forensics workspace for `test-venue-002` from Zone C advisory link | Admin |
| 2m | Admin C selects Tab 5 (Divergence Comparison) | Admin |
| 2m30s | Tab 5 shows: original `output_hash` vs replay `output_hash`. Diverging field highlighted in diff view. | Platform |
| 3m | Admin C reads diff: field name, original value, replay value, corpus entry timestamp | Admin |
| 4m | Admin C annotates the diverging corpus entry: "Field [name] diverges. Original: [value]. Replay: [value]. Investigating cause." | Admin |
| 5m | Admin C navigates to Tab 6 (Counterfactual Analysis) | Admin |
| 5m30s | Admin C runs counterfactual with same input parameters — result confirms divergence is reproducible | Admin |
| 6m | Admin C annotates: "Divergence reproducible under counterfactual. Classification: CLASS_3 — replay nondeterminism." | Admin |
| 7m | Admin C clicks [Escalate to Incident] in Tab 5 divergence panel. Severity: S3. | Admin |
| 8m | Incident created, severity S3. Incident record pre-populated with: diverging field, original/replay values, corpus entry reference, divergence class annotation, replay session ID. | Platform |

### Expected Operator Path

1. Zone C Pane C4 shows parity advisory with venue name, ratio, and [Open Replay Investigation] link.
2. Admin C clicks link → Replay & Forensics workspace opens for `test-venue-002`.
3. Tab 5 (Divergence Comparison) is active by default when opened from a parity alert (not Tab 1).
4. Tab 5 shows: two-column diff (original vs replay). Diverging field highlighted. Corpus entry timestamp shown. `input_hash` confirmed identical. `output_hash` confirmed different.
5. Admin C annotates the specific diverging event in the timeline annotation panel.
6. Admin C navigates to Tab 6 (Counterfactual) — ADMIN-only tab, rendered for Admin C.
7. Admin C configures counterfactual with same input (pre-populated from Tab 5 selection). Runs. Result shows same divergence.
8. Admin C annotates counterfactual result with divergence class.
9. Admin C clicks [Escalate to Incident (S3)] button in Tab 5 panel — button also available from Tab 6 results.
10. Incident creation modal shows pre-populated fields from replay context. Admin C confirms.
11. Incident created. Replay session linked to incident. Admin C is incident commander.

### Forbidden Paths

| Path | Classification |
|---|---|
| Closing replay session after seeing Tab 5 divergence without either escalating or annotating "False positive" | Advisory — system shows: "Divergence identified. Close without escalating or annotating?" Modal with [Annotate false positive], [Escalate], [Close anyway]. [Close anyway] permitted but logged. |
| Classifying divergence without running Tab 6 counterfactual | Permitted — classification annotation can be added from Tab 5. Tab 6 run not mandatory. If classification added without Tab 6: `counterfactual_verified = false` on annotation record. |
| Escalating without annotating the diverging field | Advisory only — [Escalate] button active without prior annotation. If escalating without annotation: incident pre-population note includes "No annotation added before escalation." |

### Success Conditions

- [ ] Tab 5 shows field-level diff with original value, replay value, corpus entry timestamp, and matching `input_hash`
- [ ] At minimum 2 annotations in replay session: initial field identification, divergence class conclusion
- [ ] Divergence class (`CLASS_3` or equivalent) recorded in annotation text and/or structured field on replay annotation
- [ ] Incident created with severity S3
- [ ] Incident record pre-populated with: `diverging_field`, `original_value`, `replay_value`, `corpus_entry_id`, `replay_session_id`
- [ ] Replay session `session_id` linked to new `incident_id`
- [ ] All steps completable without leaving the platform, without external diff tooling, without manual hash comparison

### Failure Conditions

- Tab 5 shows no diff despite injected divergence — platform failed to detect the parity failure
- Diverging field not identifiable from Tab 5 display — operator must use external tooling to identify field
- Replay session closeable after Tab 5 divergence detection without any modal or advisory — platform loses the divergence signal
- Incident created but not pre-populated with divergence detail — operator must re-enter information already present in replay session
- Tab 6 not accessible to Admin C — platform failed to render ADMIN-scoped counterfactual tab

**Simulation executable:** Yes. Divergent corpus fixture injectable with known field mismatch. Shadow parity alert injectable at T+0. Tab 5 diff display verifiable against injected divergence. Counterfactual result verifiable against fixture. Audit trail events verifiable.

---

## Scenario 3: Venue Disconnect to Full Restoration

**Purpose:** Verify that an operator can detect a venue disconnect, assess impact, execute recovery, and confirm restoration using only the Venue Operations Dashboard and Recovery Workflow — without off-platform communication.

### Initial State

- Venue `test-venue-003` player state: LIVE, constitutional state: HEALTHY
- Last corpus sync: 2 hours ago
- 72h autonomy window: approximately 70h remaining
- Active schedule block: `content://test/lounge-ambient`, continuous
- No active overrides, no active incidents
- Operator D: L2 OPERATOR, session active, assigned to `test-venue-003`
- Admin E: L4 ADMIN, session active, assigned to `test-venue-003`

### Trigger Sequence

| T+ | Event | Source |
|---|---|---|
| 0 | Player heartbeat stops | Simulation |
| 30s | Second missed heartbeat | Simulation |
| 60s | Third missed heartbeat | Simulation |
| 90s | Platform records `OFFLINE_DETECTED` after 3 missed heartbeats | Platform |
| 2m | Venue Operations Dashboard Section 1 shows OFFLINE badge with last-seen timestamp. Section 2 shows LAST KNOWN state with amber "STALE DATA" banner. | Platform |
| 2m15s | Zone A Pane A1 shows amber dot on `test-venue-003`. | Platform |
| 2m30s | Operator D notices state change in Zone A. | Operator |
| 3m | Operator D selects `test-venue-003` in Zone A → Zone B shows Venue Operations Dashboard. | Operator |
| 3m30s | Operator D reviews Section 1 (OFFLINE badge, last-seen: [timestamp], autonomy window: ~70h remaining). Section 2 (last known player state, last known resources). | Operator |
| 4m | Operator D clicks [Initiate Recovery Workflow] in Section 4. | Operator |
| 4m30s | Recovery Workflow opens: 5 steps shown. Step 1 active. | Platform |
| 4m45s | Step 1 (Physical Verification): Operator D reviews checklist, self-attests network check complete. Clicks [Step 1 Complete]. | Operator |
| 5m30s | Step 2 (Autonomy Assessment): Platform shows autonomy window (70h remaining), last corpus sync timestamp, scheduled content for next 24h. Operator D acknowledges. Clicks [Step 2 Complete]. | Operator |
| 6m | Step 3 (Reconnection Monitor): Step 3 is waiting. Platform injects player reconnect (heartbeat received). Step 3 auto-advances. | Simulation + Platform |
| 6m30s | Step 4 (Corpus Verification): Platform shows corpus checksum comparison. Admin E sees Step 4 pending. Admin E verifies checksum: MATCH. Marks [Step 4 Complete — Checksum Verified]. | Admin |
| 7m | Step 5 (Output Verification): Operator D sees PRE resolution preview — shows L2 schedule, `content://test/lounge-ambient`, correct time range. Operator D confirms display output matches expected. | Operator |
| 7m30s | Operator D clicks [Content is correct — Recovery complete]. | Operator |
| 8m | `RECOVERY_COMPLETE` event logged with: all 5 step completion records, completing operators, `offline_duration_ms`. | Platform |

### Expected Operator Path

1. Zone A Pane A1: amber indicator on `test-venue-003`. Operator selects venue.
2. Zone B: Venue Operations Dashboard. Section 1: OFFLINE badge with last-seen timestamp and autonomy window remaining. Section 2: last known state with amber "STALE DATA" banner.
3. Section 4: [Initiate Recovery Workflow] visible (L2 OPERATOR can initiate).
4. Recovery Workflow: 5-step sequential checklist. Each step shown with: title, description, required actor, completion button.
5. Step 1: Physical verification checklist. Operator D marks complete.
6. Step 2: Autonomy window display with corpus sync time and content schedule preview. Operator D acknowledges.
7. Step 3: "Waiting for reconnection..." with spinning indicator and last-seen timestamp updating. Auto-advances on heartbeat receipt — no operator action required.
8. Step 4: Corpus checksum comparison (venue checksum vs last-known-good checksum). Admin E required. Step 4 shows "Waiting for ADMIN verification." Operator D cannot complete Step 4. When Admin E arrives, [Verify Checksum] button active for Admin E only. Admin E clicks, MATCH shown, marks complete.
9. Step 5: PRE resolution preview panel shows current resolved output — level, content, time range. Operator D reviews, confirms. [Content is correct — Recovery complete] button enabled.
10. `RECOVERY_COMPLETE` event logged. Zone B returns to Venue Operations Dashboard. Section 1: LIVE badge. Autonomy indicator cleared (reconnected).

### Forbidden Paths

| Path | Classification |
|---|---|
| Completing Step 4 with non-ADMIN operator | Platform failure — Step 4 [Verify Checksum] button absent for L2 OPERATOR. Server rejects Step 4 completion from non-ADMIN. |
| Completing Step 5 without PRE resolution preview being displayed | Platform failure — [Content is correct] button not enabled until PRE preview panel has rendered with content |
| `RECOVERY_COMPLETE` logged without all 5 steps marked complete | Platform failure — recovery completion API validates all 5 step records present before writing RECOVERY_COMPLETE |
| Initiating an incident declaration instead of recovery workflow for a simple OFFLINE state | Advisory — if operator navigates to incident declaration while venue is OFFLINE but not DEGRADED/INCIDENT: "This venue is offline but not in incident state. Consider [Initiate Recovery Workflow] instead." Non-blocking — operator can still declare incident. |
| Admin E completing Step 4 with checksum MISMATCH without escalation | Step 4 MISMATCH path: Admin E sees "MISMATCH — checksums do not agree." Platform offers two options: [Escalate to Incident (S3)] or [Override with documented reason (ADMIN only, logged)]. Cannot simply mark complete on MISMATCH. |

### Success Conditions

- [ ] OFFLINE_DETECTED event at T+90s with `missed_heartbeat_count = 3`
- [ ] Recovery Workflow record shows all 5 steps with: `completed_by`, `completed_at`, and step-specific verification data
- [ ] Step 3 `completed_by = SYSTEM`, `trigger = heartbeat_received`, `auto_advanced = true`
- [ ] Step 4 `completed_by = Admin E`, `checksum_result = MATCH`, `admin_verified = true`
- [ ] Step 5 `pre_preview_displayed = true`, `operator_confirmed = true`
- [ ] `RECOVERY_COMPLETE` event includes `offline_duration_ms`, `recovery_workflow_id`, `completed_by = Operator D`
- [ ] Zone B navigation event to Venue Operations Dashboard recorded after RECOVERY_COMPLETE
- [ ] Section 1 of Venue Operations Dashboard shows LIVE badge after recovery — verified by UI state audit trail
- [ ] Autonomy window indicator cleared — reconnected player no longer showing autonomy countdown

### Failure Conditions

- Step 4 completable by Operator D (L2 OPERATOR) — role enforcement failure
- Step 5 [Content is correct] enabled before PRE preview panel rendered — gate enforcement failure
- RECOVERY_COMPLETE logged with any step missing from record — integrity enforcement failure
- Step 3 does not auto-advance on heartbeat receipt — automation failure
- Player state remains OFFLINE in Zone A Pane A1 after RECOVERY_COMPLETE — state propagation failure
- Corpus checksum comparison not displayed in Step 4 — information completeness failure (operator/admin must use external tools)

**Simulation executable:** Yes. Heartbeat injection controllable with precise timing. Corpus checksum result injectable as MATCH or MISMATCH. PRE resolution output deterministic from corpus fixture. Step completion events verifiable per actor. Autonomy window calculation verifiable from last-sync timestamp.

---

## Scenario 4: Shift Handoff During Active Incident

**Purpose:** Verify that an operator can hand off an active incident to an incoming operator with full situational transfer — no off-platform verbal briefing required.

### Initial State

- Active S4 incident on `test-venue-004`, state: DECLARED, active for 2 hours
- Incident commander: Operator F (L3 OPERATOR)
- Active Level 3 override on `test-venue-004`, no expiry, placed by Operator F
- 3 annotations in incident log
- Incoming operator: Operator G (L3 OPERATOR), fresh session
- No active incidents on any other venues

### Trigger Sequence

| T+ | Event | Source |
|---|---|---|
| 0 | Operator F navigates to operator tools menu → [Generate Handoff Package] | Operator F |
| 30s | Handoff Package generated. ID: `handoff-[uuid]`. Contents locked. | Platform |
| 45s | Operator F sends Handoff Package to Operator G via platform notification: "Handoff package from Operator F available. [Review and Accept]." | Operator F |
| 1m30s | Operator G opens Handoff Package notification. Handoff Package viewer opens. | Operator G |
| 2m | Operator G reviews Section 1 (Active Incidents): incident ID, severity S4, state DECLARED, 2h active, last 3 annotations shown. [Mark Section Reviewed] button. | Operator G |
| 2m30s | Operator G marks Section 1 reviewed. Navigates to Section 2 (Active Overrides): Level 3 override, no expiry, placed by Operator F, current PRE effect shown. | Operator G |
| 3m | Operator G marks Section 2 reviewed. Reviews Sections 3, 4, 5 (assigned venues, recent system events, operator notes). Marks each reviewed. | Operator G |
| 3m30s | All 5 sections reviewed. [Accept Handoff] button enabled. Operator G clicks [Accept Handoff]. | Operator G |
| 4m | `handoff_completed_at` logged. `test-venue-004` transferred to Operator G scope. | Platform |
| 4m30s | Operator G navigates to Incident Commander Surface for active S4 incident. Operator G shown as observer (commander still Operator F). | Operator G |
| 5m | Operator G clicks [Transfer Command] in IC-RIGHT tools panel. | Operator G |
| 5m30s | Command transfer modal opens. Transfer from: Operator F. Transfer to: Operator G (pre-selected as initiating operator). Transfer package shown: incident ID, severity, last 5 log entries, active Level 3 override summary. | Platform |
| 6m | 30-second mandatory review period begins. [Accept Command] button disabled. Timer shown: "Review period: [countdown]." | Platform |
| 6m30s | 30-second review period elapsed. [Accept Command] enabled. Operator G clicks [Accept Command]. | Operator G |
| 7m | Command transfer recorded. `new_commander_id = Operator G`. Operator F role: OBSERVER. | Platform |
| 7m30s | IC-TOP shows Operator G as incident commander. Operator F shown in observer presence list. | Platform |
| 8m | Operator G adds annotation: "Command accepted from Operator F. Continuing S4 incident management." | Operator G |

### Expected Operator Path

1. Operator F: [Generate Handoff Package] available in operator tools menu accessible from Zone A bottom navigation or System Status Bar tools.
2. Handoff Package is generated and its contents locked at generation time — it reflects state at that moment.
3. Operator G receives notification in Zone A notification panel. Opens Handoff Package viewer (overlay or dedicated Zone B view).
4. Handoff Package has 5 sections presented as sequential tabs. Each tab has [Mark Section Reviewed] which enables progress to next section. [Accept Handoff] only enabled after all 5 sections marked reviewed.
5. After Operator G accepts handoff, venue scope is transferred. Operator G can now see `test-venue-004` in Zone A.
6. Operator G navigates to the active incident from Zone A Pane A2. IC-TOP shows Operator G as observer, Operator F as commander. State-changing action buttons greyed for Operator G.
7. [Transfer Command] button in IC-RIGHT available to all OPERATOR-level users with access to the incident.
8. Transfer modal: initiator becomes recipient by default. Operator F does not need to initiate the transfer — Operator G can request it, Operator F receives notification and approves. (Alternative flow: Operator F initiates transfer FROM their IC surface, selecting Operator G as recipient.)
9. Transfer package shows: last 5 log entries (not 3), active override summary, current constitutional state.
10. 30-second mandatory review period: timer visible. [Accept Command] button disabled with countdown shown. Cannot be skipped.
11. After acceptance: Operator G is commander immediately. Operator F receives notification: "You are now an observer on incident [ID]. Command transferred to Operator G."
12. Operator G adds acknowledgment annotation to incident log.

### Forbidden Paths

| Path | Classification |
|---|---|
| Operator G clicking [Accept Handoff] before all 5 sections marked reviewed | Platform failure — [Accept Handoff] disabled until all 5 `section_reviewed = true` |
| Operator G clicking [Accept Command] before transfer package viewed | Platform failure — transfer modal must render transfer package before [Accept Command] enabled |
| Operator G clicking [Accept Command] before 30-second review period elapsed | Platform failure — [Accept Command] disabled with countdown timer; server also validates `review_elapsed_seconds >= 30` |
| Operator F continuing to use commander action buttons after Operator G accepts command | Platform failure — Operator F's commander actions must be immediately greyed after command transfer record written |
| Handoff Package not including the Level 3 override with no-expiry flag | Platform failure — active overrides with no expiry are high-risk items; omitting them from Section 2 fails the "no off-platform information" test |
| Transfer package showing fewer than 5 incident log entries | Platform failure — transfer package must include last 5 entries regardless of annotation content |
| Any step requiring information not available within the platform | Platform architecture failure |

### Success Conditions

- [ ] Handoff Package record: `generated_at`, `generated_by = Operator F`, all 5 sections present, `locked_at` timestamp
- [ ] Handoff acceptance record: all 5 sections show `reviewed_by = Operator G`, `reviewed_at` timestamps, `accepted_at`
- [ ] Venue scope transfer record: `test-venue-004` added to Operator G's active scope at `handoff_completed_at`
- [ ] Command transfer record: `transfer_package_viewed = true`, `review_elapsed_seconds >= 30`, `accepted_at`, `new_commander_id = Operator G`, `previous_commander_id = Operator F`
- [ ] IC-TOP commander display updates to Operator G within one UI refresh cycle of command transfer
- [ ] Operator F role on incident updated to OBSERVER in incident record
- [ ] Operator G's acceptance annotation logged in incident event log with `operator_id = Operator G`
- [ ] Operator G can successfully execute a commander action (state transition) immediately after command transfer
- [ ] Full incident lifecycle from S4 declaration through handoff reconstructible from audit trail without any verbal input

### Failure Conditions

- [Accept Handoff] enabled before all 5 sections acknowledged — gate enforcement failure
- [Accept Command] enabled before transfer package displayed — gate enforcement failure
- [Accept Command] enabled before 30-second elapsed — timer enforcement failure
- Operator F retains commander action controls after Operator G accepts — role transition failure
- Handoff Package Section 2 does not include the Level 3 override with no-expiry field — information completeness failure
- Transfer package shows fewer than 5 incident log entries — information completeness failure
- Operator G cannot execute commander actions immediately after transfer (requires page reload, re-authentication, etc.) — UX continuity failure

**Simulation executable:** Yes. Incident state injectable. Override state injectable. Operator sessions for F and G simulatable with specified roles. Timer enforcement (30-second review) verifiable with time-acceleration. All audit trail events verifiable by scenario_id. Notification delivery verifiable.

---

## Scenario 5: Emergency Override Placement and Removal

**Purpose:** Verify the emergency override (Level 6) lifecycle is auditable, requires correct authority, and PRE reflects the change within one resolution cycle.

### Initial State

- Venue `test-venue-005` player state: LIVE
- PRE resolving to L2 (schedule), `content://test/sports-main`
- No active overrides
- Operator H: L3 OPERATOR with active elevated session (elevation confirmed < 15 minutes ago)
- Admin I: L4 ADMIN, session active, assigned to `test-venue-005`
- No active incidents

### Trigger Sequence

| T+ | Event | Source |
|---|---|---|
| 0 | Operator H navigates to CMS Override Control for `test-venue-005` | Operator H |
| 15s | CMS Override Control shows override stack (empty) and [Declare Emergency Override] button (distinct red button, visible because elevated session active) | Platform |
| 30s | Operator H clicks [Declare Emergency Override] | Operator H |
| 45s | Emergency override confirmation modal opens: reason field (min 30 chars), scope selector (this venue), text confirmation field (type "EMERGENCY") | Platform |
| 1m | Operator H enters reason: "Emergency safety content required for venue incident — security team notified." Scope: this venue. Types "EMERGENCY" in confirmation field. Clicks [Place Emergency Override]. | Operator H |
| 1m10s | Override placed immediately. Level 6. `effective_content: EMERGENCY_CONTENT`. | Platform |
| 1m15s | PRE re-evaluates for `test-venue-005`. Resolves to Level 6. Winner: emergency override ID. | Platform |
| 1m20s | Venue Operations Dashboard Section 1 shows "EMERGENCY CONTENT ACTIVE" badge (red). Zone A Pane A1 shows emergency indicator on `test-venue-005`. | Platform |
| 1m30s | Section 3 Sub-panel A shows: Level 6 EMERGENCY, effective_content: EMERGENCY_CONTENT, override_id, placed_by: Operator H, placed_at: [timestamp]. | Platform |
| 5m | Situation resolved. Admin I opens Section 3 Sub-panel B for `test-venue-005`. | Admin I |
| 5m15s | Admin I locates Level 6 entry. Clicks [Remove Override] on the Level 6 entry. | Admin I |
| 5m30s | Override removal confirmation modal: reason field (min 20 chars), text confirmation field (type "CONFIRM REMOVAL"). | Platform |
| 5m45s | Admin I enters reason: "Emergency resolved. Returning to normal schedule." Types "CONFIRM REMOVAL." Clicks [Confirm Removal]. | Admin I |
| 6m | Override removed. Status: REMOVED. `removed_by: Admin I`. `removed_at`: [timestamp]. | Platform |
| 6m10s | PRE re-evaluates. Resolves to L2 schedule. | Platform |
| 6m15s | Section 1 "EMERGENCY CONTENT ACTIVE" badge removed. Section 3 shows L2 schedule as current resolution. Zone A emergency indicator cleared. | Platform |

### Expected Operator Path

1. Operator H: CMS Override Control for `test-venue-005`. [Declare Emergency Override] button visible (red, distinct from normal override buttons) because `session_elevation = true` and operator is L3.
2. Confirmation modal: reason field, scope selector, text confirmation field. All three fields required before [Place Emergency Override] enabled.
3. Override placed. PRE immediately re-evaluates (not queued — synchronous for L6).
4. Section 1 emergency badge appears. Zone A emergency indicator appears. Both within 1 PRE resolution cycle.
5. Section 3 Sub-panel A (Active Resolution) shows L6 as winner with full placement details.
6. Admin I: Section 3 Sub-panel B (Override Stack) shows L6 entry with [Remove Override] button (visible because Admin I is L4 ADMIN).
7. Removal confirmation modal: reason field and "CONFIRM REMOVAL" text field. Both required.
8. Override removed. PRE immediately re-evaluates.
9. Emergency badge and Zone A indicator cleared within 1 PRE resolution cycle.
10. Section 3 shows L2 schedule as current resolution.

### Forbidden Paths

| Path | Classification |
|---|---|
| [Declare Emergency Override] button visible for non-elevated L3 OPERATOR | Platform failure — button absent (not greyed) for L3 without elevated session |
| [Declare Emergency Override] visible for L2 OPERATOR regardless of elevation | Platform failure — L6 requires L3 elevated or L4; L2 cannot place L6 |
| [Place Emergency Override] enabled without "EMERGENCY" typed in confirmation field | Platform failure — both client and server enforce text confirmation |
| PRE not resolving to L6 within 1 resolution cycle after placement | Platform failure — L6 override triggers synchronous PRE re-evaluation |
| [Remove Override] on L6 entry enabled for non-elevated Operator H | Platform failure — L6 removal requires L3 elevated or L4 ADMIN; L3 elevation state must be re-verified at removal time |
| [Confirm Removal] enabled without reason field (min 20 chars) | Platform failure — server rejects removal without reason |
| [Confirm Removal] enabled without "CONFIRM REMOVAL" typed | Platform failure — text confirmation enforced client and server |
| "EMERGENCY CONTENT ACTIVE" badge visible in Section 1 after PRE resolves to L2 post-removal | Platform failure — badge state reflects current PRE output |

### Success Conditions

- [ ] L6 override record: `placed_by = Operator H`, `placed_at`, `reason` (min 30 chars stored), `scope = venue`, `confirmation_text = "EMERGENCY"`, `session_elevation_verified = true`
- [ ] PRE resolution trace entry after placement: `winner_level = 6`, `winner_override_id`, `effective_content = EMERGENCY_CONTENT`, within 1 resolution cycle of `placed_at`
- [ ] "EMERGENCY CONTENT ACTIVE" badge present in Section 1 within 1 PRE resolution cycle of placement
- [ ] Zone A emergency indicator present on `test-venue-005` within 1 PRE resolution cycle of placement
- [ ] L6 removal record: `removed_by = Admin I`, `removed_at`, `reason` (min 20 chars stored), `confirmation_text = "CONFIRM REMOVAL"`, `admin_session_verified = true`
- [ ] PRE resolution trace entry after removal: `winner_level = 2`, `effective_content = content://test/sports-main`, within 1 resolution cycle of `removed_at`
- [ ] "EMERGENCY CONTENT ACTIVE" badge absent from Section 1 within 1 PRE resolution cycle of removal
- [ ] Full L6 lifecycle — placement record, PRE activation, removal record, PRE restoration — reconstructible from audit trail

### Failure Conditions

- L6 placed without server-side elevated session verification — authority gate failure
- "EMERGENCY" text confirmation not server-enforced — confirmation bypass
- PRE does not re-evaluate synchronously after L6 placement — resolution timing failure
- L6 removable without reason field — audit record incomplete
- L6 removable by non-elevated L3 OPERATOR or any L2 OPERATOR — authority gate failure
- Emergency indicator persists in Section 1 or Zone A after PRE resolves to L2 — state propagation failure

**Simulation executable:** Yes. Elevated session injectable. L6 override placement controllable. PRE resolution output verifiable against fixture corpus. Override removal authority verifiable by session role. Audit trail events queryable. Badge state verifiable via UI state audit events.

---

## Cross-Surface Coverage Matrix

The following matrix shows which surfaces are exercised by each scenario. Coverage ensures no surface goes uncertified in cross-surface journeys.

| Surface | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| Venue Operations Dashboard | X | | X | | X |
| Incident Commander Surface | X | | | X | |
| Replay & Forensics Workspace | X | X | | | |
| CMS Override Control | | | | | X |
| Handoff Package viewer | | | | X | |
| Recovery Workflow | | | X | | |
| Zone A (Pane A1 venue list, Pane A2 incidents) | X | | X | X | X |
| Zone C (Pane C4 constitutional state + advisories) | X | X | | | |
| System Status Bar | X | | X | | X |

### Coverage Gaps for Future Scenarios

The following cross-surface journeys are not covered by Scenarios 1–5 and should be addressed in a subsequent revision:

1. **CMS Schedule Manager to Approval to PRE Verification:** Schedule change authored → enters approval queue → ADMIN approves → PRE reflects updated schedule → operator confirms. Tests the content authoring and governance path end-to-end.

2. **Training Certification to First Production Operation:** Operator completes certification scenario in simulation mode → certification record written → first production operation performed → first-operation advisory shown → operation completes successfully. Tests the certification-to-permission boundary.

3. **Multi-Operator Simultaneous Incident — Command Transfer Under Load:** Two operators both attempt to claim command on a new incident → authority collision resolution → one commander established → second operator requests transfer → transfer executed with both sessions active simultaneously. Tests authority collision and transfer under concurrent sessions.

4. **Corpus Delivery Latency Breach:** 72h corpus delivery window approaches threshold → system surfaces advisory → operator initiates emergency corpus push (or override to sustain operation) → corpus delivered → advisory cleared. Tests the offline autonomy boundary.

---

## Simulation Infrastructure Requirements

For these scenarios to be executed by simulation and replay infrastructure, the following capabilities are required. Requirements are handed to the simulation infrastructure team for implementation alignment.

### SI-01: State Injection

Platform can receive synthetic events at specified governed timestamps:
- Constitutional state transitions (HEALTHY → DEGRADED → HEALTHY)
- Player state transitions (LIVE → OFFLINE → LIVE)
- Heartbeat injection and suppression
- Shadow parity ratio injection
- Circuit breaker open/close events

All injected events must appear in the audit trail as `event_source = SIMULATION` with `scenario_id` tag.

### SI-02: Corpus Test Fixtures

Scenario-specific corpus entries with:
- Known `input_hash` and `output_hash`
- Known divergent `replay_output_hash` for S2
- Specifiable `content_id` and `effective_content`
- Fixture isolation: scenarios do not share corpus state

### SI-03: Operator Session Simulation

Multiple operator sessions simulatable simultaneously:
- Specified role (L2 OPERATOR, L3 OPERATOR, L4 ADMIN)
- Session elevation injectable (for S5)
- Independent session tokens
- Per-session audit trail events
- Concurrent action submission (for multi-operator scenarios)

### SI-04: Audit Trail Capture

All expected audit trail events capturable and queryable by `scenario_id`:
- Events tagged with `scenario_id` at injection time
- Post-scenario query: all events for `scenario_id` returned in governed timestamp order
- Verification: events match expected sequence
- Negative verification: forbidden events absent from trail

### SI-05: Timer Enforcement Testing

Enforced delays (30-second command transfer review, PRE resolution cycle timing) testable:
- Time acceleration: simulation clock runs faster than wall clock
- Timer thresholds remain constant (not scaled) — server checks elapsed time against simulation clock
- Verification: timer-gated actions fail before threshold and succeed after threshold

### SI-06: UI State Verification

Specific UI element states verifiable from outside the browser:
- Badge presence/absence (EMERGENCY CONTENT ACTIVE, OFFLINE, LIVE)
- Button enabled/disabled state
- Modal open/closed state
- Zone B surface identity (which workspace is displayed)
- Zone A indicator state (amber dot, emergency indicator)

Verification method: UI state emits structured events to simulation audit stream. Alternatively: DOM snapshot accessible to simulation runner for specific element queries.
