# CMS MVP Cutline — v1

**Document type:** Implementation architecture cutline
**Status:** AUTHORITATIVE
**Audience:** Engineering, product leadership, operator onboarding leads
**Date:** 2026-06-03
**Supersedes:** Nothing (first cutline)
**Must be read alongside:** `API-CONTRACT-MATRIX-v1.md`, `IMPLEMENTATION-VERTICAL-SLICE-PLAN-v1.md`, `CMS-HCI-REFERENCE-SURFACE-v1.md`

---

## 1. MVP Definition

### What MVP Means for This Platform

MVP is the minimum system that allows trained operators to safely manage real venue deployments without falling back to spreadsheets, phone calls, or manual coordination for any critical workflow.

The first deployment is a pilot at 1–3 venues with 2–5 trained operators. No general public users. All operators know the system is new. MVP is scoped to this reality.

MVP does NOT need to be beautiful, fast, or comprehensive. It needs to be **correct and safe**.

### The Core Test

A system is at MVP if and only if a trained operator can handle the single most common failure mode — **an active incident at one venue** — from detection through resolution, entirely within the UI, without ambiguity about what action to take next.

If any part of that workflow requires a phone call, a spreadsheet lookup, a server-side query by an engineer, or a guess, the system is not at MVP.

### What MVP Is Not

MVP is not a demonstration, a prototype, or a feature-complete product. It is a production-safe system for a constrained pilot. Every feature in section 4 (Deferred) was explicitly evaluated and removed from MVP with a stated reason. Nothing in the deferred list was forgotten — it was deliberately excluded.

---

## 2. MVP Must-Have: Operator Value Threshold

The following features must exist before any operator can use the system in production. Each item has a stated justification. Nothing in this list is negotiable without a formal cutline revision.

### 2.1 Auth and Identity

| Feature | Justification |
|---------|---------------|
| Login / logout | Without authentication, the system cannot enforce role boundaries. All safety constraints are role-dependent. |
| Role-based access: VIEWER, OPERATOR, CONTENT_MANAGER, ADMIN | Authority boundaries are constitutional. Absent-not-disabled enforcement requires the system to know the current role at render time. |
| Session expiry handling with visible feedback | A session that expires silently during an incident can leave an operator believing a write succeeded when it was rejected. Session expiry must surface as a visible state, not a silent 401. |

### 2.2 Venue Monitoring

| Feature | Justification |
|---------|---------------|
| Real-time venue list with machine state (Zone A VenueSelector) | Operators must know the state of all venues at a glance. Without this, they cannot prioritize. |
| Venue health detail view (Zone B Live Ops: player health, PRE state, machine state badge) | Required to understand why a venue is in a degraded or incident state before taking action. |
| RECOVERED_BUT_UNTRUSTED display: PATCH-009 (LIVE—UNVERIFIED badge in Zone B) and PATCH-007 (Zone A dot) | Without visual distinction, an operator cannot know an override is blocked. The RECOVERED_BUT_UNTRUSTED override block (section 3, constraint 2) is unenforceable if the state is invisible. |
| 72h autonomy clock display (PATCH-011) | Operators must know when a venue loses its corpus safety net. Without the countdown, they cannot plan corpus refresh proactively. |
| System Status Bar with constitutional state | Operators must know whether the system they are operating is itself healthy. A degraded backend masquerading as healthy is an operator trap. |

### 2.3 Incident Management

| Feature | Justification |
|---------|---------------|
| Active incident list in Zone A | Operators cannot triage without knowing what incidents are active. |
| Incident Command surface: read incident, see severity, see state | Required to understand what is happening before acting. |
| Commander claim with CONCURRENCY_CONFLICT rejection handling | Without CONCURRENCY_CONFLICT handling, two operators can believe they are both in command. This is operationally catastrophic. |
| Commander release | Without release, a commander cannot cleanly hand off. |
| COMMANDER_LAPSED alert and notify action (PATCH-012) | A 15-minute window with no commander on an active incident is a safety gap. The alert must fire. Without it, incidents can stall with no responsible operator. |
| Zone B auto-replace for S1/S2 incidents with PATCH-014 orientation banner | Operators must be brought to the Incident Command surface automatically on emergency. Manual navigation during an S1 incident introduces time cost and operator confusion. Auto-replace is the constitutional response. |
| Incident severity display (PATCH-004 severity colors) | Severity determines what actions are available. A colorless incident list treats S1 and S5 identically. |

### 2.4 Override Management

| Feature | Justification |
|---------|---------------|
| L6 override placement: SequentialChipSelect 3-step flow (PATCH-001) | L6 is the highest priority content classification. Accidental placement has immediate operational consequences (section 3, constraint 4). A plain button is a safety regression. |
| L6 override removal: HoldToConfirmButton 3-second hold (PATCH-002) | Accidental L6 removal during an active incident exposes the venue to content it was shielded from. A plain button is a safety regression (section 3, constraint 5). |
| Override inventory display: Tab 3 with PATCH-010 red dot | Operators must know what overrides are active across venues. Without the inventory, they cannot audit or clean up after an incident. |
| AUTHORITY_BOUNDARY rejection modal | An operator who attempts a write outside their authority must receive a visible explanation. Silent rejection creates the false impression of success. |

### 2.5 Content Scheduling

| Feature | Justification |
|---------|---------------|
| Content calendar view (Tab 2, read-only sufficient for MVP) | CONTENT_MANAGERs and OPERATORs must be able to see what is scheduled. Without this, they cannot detect scheduling conflicts or validate their own writes. |
| 72h warning banners: ROUTINE and HIGH_PRIORITY variants (A-NEW-02) | The 72h delivery lead time is constitutional. Without warning banners, operators can schedule content that will not reach venues in time. Silent delivery failure at a real venue is unacceptable. |
| Content slot creation (POST /cms/calendar/slots) for CONTENT_MANAGER | Content scheduling must be doable within the system. Without write access, CONTENT_MANAGERs must use out-of-band tools — which is exactly the spreadsheet fallback MVP is designed to eliminate. |

### 2.6 Venue Hardware

| Feature | Justification |
|---------|---------------|
| Venue Operations surface Tab 1 (Status Dashboard) | Operators need hardware state visibility. Player health, corpus state, and connectivity status determine whether a venue can recover without a site visit. |
| Machine state history (Tab 5, PATCH-020) | Without state history, operators cannot distinguish a transient fault from a recurring instability. Corpus hash re-verification requires knowing what changed. |
| Corpus hash re-verification trigger | The operator must be able to initiate verification without engineering involvement. Without this, a RECOVERED_BUT_UNTRUSTED venue requires an engineer to clear — unacceptable at pilot scale. |

### 2.7 WebSocket Real-Time

| Feature | Justification |
|---------|---------------|
| Venue state updates (Zone A dots, machine state) | Without real-time updates, Zone A is a stale snapshot. Operators polling a stale list miss incidents. |
| Incident updates (Zone A badges, Incident Command surface) | Incident state changes — especially severity escalation — must surface immediately. |
| ZONE_B_AUTO_REPLACE event handling | The auto-replace safety mechanism (section 3, constraint 3) depends on the frontend processing this event correctly. Without it, Zone B does not respond to S1/S2 events. |

### 2.8 Write Rejection Feedback

| Feature | Justification |
|---------|---------------|
| All 4 rejection types produce visible UI response (A-NEW-04) | A write that fails silently leaves the operator with false confidence. They may proceed with an incident resolution workflow believing a blocking action succeeded when it did not. This is a direct safety failure. |
| No silent mutations | Optimistic updates are prohibited (see section 3, constraint 8 is implied). All UI state updates must be server-confirmed. |

---

## 3. MVP Must-Have: Safety Constraints

These constraints cannot be removed from MVP. The system is not operationally safe without them. Each one is defined by a specific failure mode that occurs if it is absent.

**Constraint 1: IC-03 enforcement**
Zero write controls are present in the DOM during REPLAY mode. Controls are absent, not disabled. A disabled button is still a UI affordance that creates operator confusion about whether the action is temporarily or permanently unavailable. The constitutional requirement is absence. Verified by DOM inspection: no write controls in any replay or VIEWER session.

**Constraint 2: RECOVERED_BUT_UNTRUSTED override block**
`POST /overrides` must be prevented client-side when the venue is in RECOVERED_BUT_UNTRUSTED state. The server also blocks this request, but client-side prevention is defense in depth. Without it, the operator must wait for a server round-trip to learn the write was blocked — and the server error message may not be as legible as the client-side UI state that triggered it.

**Constraint 3: Zone B auto-replace for S1/S2**
When a ZONE_B_AUTO_REPLACE event fires, the system must replace Zone B content with the Incident Command surface and display PATCH-014 orientation banner explaining why the view changed. Manual navigation during an S1/S2 emergency introduces time cost and the risk that an operator misses the incident entirely if they are on a different surface.

**Constraint 4: SequentialChipSelect for L6 placement**
L6 override placement must use the 3-step SequentialChipSelect confirmation flow (PATCH-001). A plain button permits accidental L6 placement with a single click. Given that L6 overrides the entire content classification hierarchy, accidental placement at a venue has immediate on-screen consequences that cannot be rolled back without deliberate action.

**Constraint 5: HoldToConfirmButton for L6 removal**
L6 override removal must use the 3-second hold confirmation (PATCH-002). Accidental L6 removal during an active incident restores the content stack to its pre-override state, which may include content that was being shielded. The hold time provides an irreversibility buffer.

**Constraint 6: COMMANDER_LAPSED alert**
The 15-minute lapsed commander alert must fire and produce a visible Zone A or Zone B notification with a notify action. An incident without a commander for 15 minutes is a gap in accountability. Without the alert, the gap is invisible until the incident worsens.

**Constraint 7: Server-authoritative timestamps everywhere**
`Date.now()` is prohibited in any time display — including autonomy clocks, incident durations, override ages, and scheduling deadlines. All displayed times are derived from server-provided timestamps. Client clock drift during a long incident shift can cause a countdown timer to diverge from actual venue state by minutes, which is operationally misleading.

**Constraint 8: Rejection responses are never silent**
Every 4xx response from a write operation produces a visible operator response. The four rejection types (AUTHORITY_BOUNDARY, CONCURRENCY_CONFLICT, SYSTEM_CONSTRAINT, VALIDATION_ERROR) each have distinct display paths. None may result in a silent state where the operator does not know the write was rejected.

---

## 4. MVP Deferred: Can Wait for Post-MVP

These features were evaluated and explicitly deferred. Each deferral has a stated reason and a promotion condition that specifies when the feature moves from deferred to required. Nothing in this list is abandoned.

### 4.1 Entire Surfaces Deferred

**Replay Investigation surface (entire surface)**
Reason: Post-incident forensics is valuable but not required for live operations management at pilot scale. A pilot with 1–3 venues and 2–5 operators can perform incident review using server-side tooling and raw log exports in the interim. The replay surface introduces significant backend contract dependencies (replay session endpoints, collaborator position push, annotation events) that are not otherwise needed for MVP. Deferring the surface defers those backend dependencies.
Promotion condition: Promote to required when post-incident forensics is needed by more than 1 operator per week, or when a post-incident review identifies a failure that could not have been diagnosed without the replay surface.

**IC Tab 4: PRE Divergence view**
Reason: Operators can manage incidents — claim, place overrides, resolve — without a PRE diff view. The PRE state is visible in the venue health detail view. Tab 4 adds forensic depth, not operational capability.
Promotion condition: Promote when PRE divergence becomes a recurring incident root cause requiring operator diagnosis during live incidents (not post-incident).

**IC Tab 6: Evidence Package**
Reason: This is an ADMIN forensics feature. At pilot scale, ADMIN forensics is performed by engineering using server-side tooling. The evidence package UI accelerates that workflow but does not gate it.
Promotion condition: Promote when ADMIN operators need self-service forensics without engineering involvement, or when the Replay Investigation surface is promoted.

**Venue Ops Tab 2: Screen Management**
Reason: Bulk screen enrollment and configuration at 1–3 venues with 2–5 known screens can be done via admin tooling at pilot scale. The UI for screen management adds convenience, not safety.
Promotion condition: Promote when the pilot expands beyond 5 venues or when screen enrollment frequency exceeds one new screen per week.

**Venue Ops Tab 6: Configuration**
Reason: Pilot venues will be pre-configured before operator handoff. The configuration tab is a maintenance surface, not an operations surface.
Promotion condition: Promote when venue configuration changes need to be made by operators without engineering involvement.

### 4.2 Features Deferred

**Multi-collaborator replay with position indicators (A-NEW-03)**
Reason: Deferred with the Replay Investigation surface. No replay surface means no collaborator positions to display.
Promotion condition: Follows Replay Investigation surface promotion.

**Zone C advisory visual state escalation (A-NEW-01 RECOMMENDED/URGENT colors)**
Reason: Zone C advisory text display (informational level) is sufficient for MVP. Operators can read advisory text without color escalation. The visual state escalation (RECOMMENDED/URGENT) adds scanability for a high-frequency advisory environment. At pilot scale with 1–3 venues, advisory volume is low enough that text scanning is adequate.
Promotion condition: Promote before general availability (not just pilot), or when operators report advisory overload at Zone C causing missed escalations.

**CMS Tab 3: Pending Approval workflow**
Reason: Content approval at pilot scale can use an out-of-band process (Slack, email) between CONTENT_MANAGER and ADMIN. The approval workflow UI is a collaboration accelerator, not a safety gate.
Promotion condition: Promote when content approval frequency exceeds 5 items per week, or when out-of-band approval creates audit trail gaps.

**CMS Tab 4: Distribution detail**
Reason: Delivery confidence (Tab 5) provides sufficient visibility into whether content reached venues. Tab 4 distribution detail adds granularity that is not needed for pilot-scale operations.
Promotion condition: Promote when operators need to diagnose distribution failures at the individual venue level without engineering help.

**CMS Tab 6: Archive**
Reason: Archive management is a housekeeping function, not an operations function.
Promotion condition: Promote when content archive size creates catalog navigation problems.

**Training Mode for CMS**
Reason: The first cohort of operators is onboarded directly by engineering in a controlled session. Training mode is valuable for self-directed onboarding of subsequent cohorts.
Promotion condition: Promote when onboarding a second cohort of operators (more than 5 operators total), or when engineering-assisted onboarding is no longer feasible.

**Advanced Zone A filtering (by severity, by state)**
Reason: At 1–3 venues, the Zone A list is short enough that filtering adds no meaningful scanability improvement.
Promotion condition: Promote when the venue count exceeds 10, or when operators report Zone A scanning difficulty during incidents.

**Fleet wall view (WF-LO-06)**
Reason: Fleet wall is a multi-venue monitoring surface optimized for operations centers. The pilot has a single operator station, not an operations center.
Promotion condition: Promote when an operator is routinely monitoring more than 5 venues simultaneously.

**NotificationTray beyond basic unread count**
Reason: The unread dot provides sufficient notification signal at low venue count. Full tray history is useful at scale; at pilot scale, operators are in active contact with their venues.
Promotion condition: Promote when notification volume exceeds what a single operator can process from the unread count alone.

**Keyboard shortcuts**
Reason: Keyboard shortcuts accelerate trained power users. At pilot scale with 2–5 operators who are being actively supervised during onboarding, speed is less important than correctness.
Promotion condition: Promote when operators are performing high-frequency repetitive actions during shift.

**Offline/PWA behavior**
Reason: Pilot venues are in controlled environments with reliable connectivity. Offline behavior introduces significant state reconciliation complexity that is not justified at pilot scale.
Promotion condition: Promote before deployment to venues with unreliable connectivity.

**Print/export for any surface**
Reason: No operational workflow at pilot scale requires printed output.
Promotion condition: Promote on explicit operator request with a stated workflow dependency.

**Audit trail UI**
Reason: At pilot scale, audit queries are performed by engineering using direct server-side tooling.
Promotion condition: Promote when ADMIN operators need self-service audit access without engineering involvement.

---

## 5. MVP Scope Per Role

What each role can do at MVP. Authority boundaries are enforced by absence (absent-not-disabled). Any action not listed for a role is absent from the DOM for that role.

### VIEWER

- View venue list with real-time machine state (Zone A)
- View venue health detail (Zone B Live Ops, read-only)
- View active incident list (Zone A)
- View Incident Command surface (read-only: severity, state, commander identity)
- View content calendar (read-only)
- View override inventory (read-only)
- View venue hardware status (Tab 1, read-only)

VIEWER cannot take any write action. No write controls are present in the DOM for VIEWER sessions. This is not a permission error — the controls do not exist.

### OPERATOR

Everything VIEWER can do, plus:

- Claim incident command (with CONCURRENCY_CONFLICT handling)
- Release incident command
- Declare incident
- Place L6 override via SequentialChipSelect (PATCH-001)
- Remove L6 override via HoldToConfirmButton (PATCH-002)
- Trigger corpus hash re-verification on a venue
- Respond to COMMANDER_LAPSED notify action

### CONTENT_MANAGER

Everything OPERATOR can do (OPERATOR inherits VIEWER), plus:

- Create content calendar slots (POST /cms/calendar/slots)
- Set delivery_priority flag (HIGH_PRIORITY) on calendar slots

Training Mode is deferred to post-MVP. CONTENT_MANAGER cannot toggle Training Mode at MVP.

### ADMIN

Everything CONTENT_MANAGER can do (and therefore everything above), plus:

At MVP, ADMIN has no additional UI surfaces beyond CONTENT_MANAGER. The following ADMIN features are deferred:

- IC Tab 6 Evidence Package (deferred with Replay surface)
- Venue configuration (Venue Ops Tab 6 deferred)
- Screen decommission (Venue Ops Tab 2 deferred)

ADMIN role at MVP is operationally equivalent to CONTENT_MANAGER. This is a known gap, acceptable at pilot scale where ADMIN forensics and configuration are performed by engineering.

---

## 6. MVP Infrastructure Requirements

The frontend cannot be built or tested against missing backend contracts. The following backend contracts are non-negotiable prerequisites for MVP frontend work. All others are deferred.

### 6.1 Non-Negotiable Backend Contracts for MVP

All endpoints in sections 2–7 of `API-CONTRACT-MATRIX-v1.md` that correspond to surfaces and features in section 2 of this document, with the following specific requirements:

**Rejection envelope on all 4xx write responses:**
```
{ rejection: { type, message, current_state, ... } }
```
All four rejection types must use this envelope: AUTHORITY_BOUNDARY, CONCURRENCY_CONFLICT, SYSTEM_CONSTRAINT, VALIDATION_ERROR. A 4xx without a rejection envelope is a contract violation that breaks the write rejection feedback requirement (section 3, constraint 8).

**WebSocket events required for MVP:**
- `VENUE_STATE_UPDATE` — Zone A real-time state
- `INCIDENT_UPDATE` — Zone A badges and IC surface refresh
- `ZONE_B_AUTO_REPLACE` — S1/S2 emergency auto-replace (section 3, constraint 3)
- `REJECTION_STATE_PUSH` — write rejection propagation to affected surfaces
- `COMMANDER_LAPSED` — 15-minute lapsed commander alert (section 3, constraint 6)

**Field requirements on existing contracts:**
- `advisory_level` field on advisory push (A-NEW-01) — Zone C advisory display. If absent, advisory defaults to INFORMATIONAL at MVP. Field is required for post-MVP visual state escalation.
- `delivery_priority` field on calendar slots and delivery confidence responses (A-NEW-02) — required for 72h warning banner differentiation (ROUTINE vs HIGH_PRIORITY).
- `trust_state` field on venue state responses — required for RECOVERED_BUT_UNTRUSTED display (PATCH-007, PATCH-009).

### 6.2 Deferred Backend Contracts (Not Needed for MVP)

The following backend contracts are not required for MVP. Frontend work that depends on them is in section 4 (Deferred).

- Replay session endpoints (`/replay/sessions/*` and all sub-resources)
- Collaborator position push (A-NEW-03 WebSocket events)
- `ANNOTATION_CREATED`, `ANNOTATION_UPDATED` WebSocket events
- IC Tab 6 evidence package endpoints
- Screen enrollment and decommission endpoints
- Venue configuration endpoints
- Audit trail query endpoints

---

## 7. MVP Build Sequence Summary

Vertical slices from `IMPLEMENTATION-VERTICAL-SLICE-PLAN-v1.md` and their MVP status.

| Slice | In MVP | Notes |
|-------|--------|-------|
| Slice 0: Foundation | YES | Required prerequisite for all slices. Auth substrate, WebSocket client, rejection handler framework, server-authoritative time utilities. |
| Slice 1: Venue Health | YES | Core monitoring. Zone A VenueSelector, Zone B Live Ops, RECOVERED_BUT_UNTRUSTED display, 72h autonomy clock. |
| Slice 2: Incident Awareness | YES | Core safety. Zone A incident list, IC surface read path, severity display, COMMANDER_LAPSED alert. |
| Slice 3: Commander Claim | YES | Core safety. Claim/release with CONCURRENCY_CONFLICT handling, Zone B auto-replace, PATCH-014 orientation banner. |
| Slice 4: Override Lifecycle | YES | Core safety. SequentialChipSelect L6 placement, HoldToConfirmButton L6 removal, override inventory, AUTHORITY_BOUNDARY rejection modal, RECOVERED_BUT_UNTRUSTED block. |
| Slice 5: Venue Operations | YES | Core monitoring. Tab 1 Status Dashboard, Tab 5 machine state history, corpus re-verification trigger. |
| Slice 6: CMS Operations | YES | Core content management. Calendar read view, slot creation, 72h warning banners, delivery confidence. |
| Slice 7: Replay Investigation | NO | Entire surface deferred. No replay session UI, no annotation UI, no collaborator positions. |
| Slice 8: Advisory + Notifications | PARTIAL | Advisory text display (Zone C, INFORMATIONAL level) is in MVP. Visual state escalation (A-NEW-01 RECOMMENDED/URGENT colors) is deferred. NotificationTray beyond unread count is deferred. |
| Slice 9: ADMIN Features | PARTIAL | IC Tab 6 deferred. Venue configuration deferred. Screen decommission deferred. ADMIN has no additional MVP UI beyond CONTENT_MANAGER. |

---

## 8. MVP Definition of Done

The MVP is complete when all of the following are true. Each condition is independently verifiable. No condition may be waived.

**Condition 1: End-to-end incident workflow**
A trained OPERATOR can log in, identify all venue states from Zone A, navigate to an active incident, claim command, place an L6 override using SequentialChipSelect, and resolve the incident without any UI confusion or need for external tools. The workflow must be completable by a trained operator who has not seen the specific incident before, without engineering support.

**Condition 2: Content scheduling workflow**
A trained CONTENT_MANAGER can schedule content for the next 7 days. Content within 72h of scheduled delivery must show the HIGH_PRIORITY or ROUTINE 72h warning banner (A-NEW-02) correctly. Content that has passed the 72h window must show a delivery-blocked or late-delivery state, not a normal scheduling state.

**Condition 3: Zone B auto-replace timing**
Zone B replaces with the Incident Command surface within 3 seconds of an S1 or S2 incident declaration, measured from the time the ZONE_B_AUTO_REPLACE WebSocket event is received. The PATCH-014 orientation banner must appear. This is verified by integration test against a test WebSocket server, not by manual timing.

**Condition 4: No silent write rejections**
All 4 rejection types (AUTHORITY_BOUNDARY, CONCURRENCY_CONFLICT, SYSTEM_CONSTRAINT, VALIDATION_ERROR) produce a visible operator response. Verified by test: fire each rejection type from the mock server, confirm UI response for each. A rejection that produces no visible change fails this condition.

**Condition 5: RECOVERED_BUT_UNTRUSTED visual distinction**
A venue in RECOVERED_BUT_UNTRUSTED state is visually distinct from LIVE and DEGRADED states in both Zone A (PATCH-007 dot color) and Zone B (PATCH-009 LIVE—UNVERIFIED badge). An operator must be able to distinguish RECOVERED_BUT_UNTRUSTED from LIVE without reading fine-print text. Verified by visual review of all three states side-by-side.

**Condition 6: IC-03 DOM enforcement**
Confirmed by DOM inspection: no write controls (buttons, inputs, selects, textareas) are present in the DOM during any REPLAY mode session or during any VIEWER role session. Disabled elements fail this condition — the controls must be absent. Verified by automated DOM query in CI.

**Condition 7: Vertical slice acceptance criteria**
The system passes acceptance criteria for Slices 0–6 as defined in `IMPLEMENTATION-VERTICAL-SLICE-PLAN-v1.md`. Slices 7–9 (deferred components) are not required.

**Condition 8: Zero TypeScript errors in CI**
`tsc --noEmit` passes with zero errors on the frontend workspace. Type errors that are suppressed with `// @ts-ignore` or `// @ts-expect-error` without a documented justification in the same comment fail this condition.

**Condition 9: Component unit tests pass**
All unit tests for `@clubhub/ui` components pass in CI:
- `SeverityBadge`: all 6 severity levels render with correct color token
- `MachineStateBadge`: LIVE, DEGRADED, RECOVERED_BUT_UNTRUSTED, OFFLINE render as distinct states
- `HoldToConfirmButton`: fires confirmation only after 3-second hold; cancels on release before 3 seconds; does not fire on click
- `SequentialChipSelect`: completes 3-step flow to confirmation; resets on cancel at any step; does not submit on step 1 or step 2 alone
- `CountdownClock`: displays server-provided timestamp, not `Date.now()`; updates correctly; shows expired state when countdown reaches zero

---

## Appendix A: Cutline Decision Log

This appendix records the reasoning for the most consequential cutline decisions. It exists so that future contributors understand why these choices were made, not just what they were.

**Why defer the Replay Investigation surface entirely?**
The Replay surface is forensics infrastructure, not live operations infrastructure. An operator managing a live incident does not need replay. The backend contracts it requires (replay sessions, collaborator positions, annotations) are non-trivial and would extend the MVP timeline without adding any safety capability. Post-incident review at pilot scale can be done by engineering using server-side tooling. Promoting the surface when forensic demand justifies it is lower-risk than carrying the complexity from day one.

**Why is RECOVERED_BUT_UNTRUSTED in MVP given its complexity?**
Because without it, the RECOVERED_BUT_UNTRUSTED override block (section 3, constraint 2) is effectively invisible to operators. An operator who cannot see that a venue is in RECOVERED_BUT_UNTRUSTED state will attempt overrides, receive a server rejection, and have no UI explanation for why. This creates an operator-system trust failure on day one of the pilot. The complexity cost of PATCH-007 and PATCH-009 is justified by the safety cost of omitting them.

**Why is SequentialChipSelect required rather than a standard confirmation dialog?**
A confirmation dialog for L6 placement can be dismissed accidentally (hitting Enter while the dialog is focused, or clicking the wrong button under time pressure during an incident). The 3-step SequentialChipSelect requires deliberate sequential selection that cannot be completed accidentally. The safety asymmetry of L6 (immediate full-stack content override, visible to all venue screens) justifies the friction.

**Why is Training Mode deferred?**
The first cohort of operators is onboarded by engineering in a supervised session. Training Mode is built for self-directed onboarding — it has value when operators are learning without engineering present. That situation does not exist for the first cohort. Introducing Training Mode before the operational surface is stable creates a risk that the training content teaches an outdated workflow.

**Why is ADMIN UI-equivalent to CONTENT_MANAGER at MVP?**
Because every ADMIN-specific feature is either forensics (Replay, Evidence Package) or configuration (Venue Config, Screen Management) — both of which are deferred. At pilot scale, ADMIN tasks are performed by engineering directly. Shipping ADMIN UI that doesn't match ADMIN capability would create the false impression that ADMIN operators can self-serve on tasks that still require engineering. Deferring the surfaces until they are actually functional is safer than shipping empty ADMIN surfaces.
