# Frontend Epic Breakdown v1
# ClubHub TV — Operator CMS Frontend

**Status:** AUTHORITATIVE
**Date:** 2026-06-04
**Audience:** Frontend engineering team
**Companion documents:**
- `IMPLEMENTATION-VERTICAL-SLICE-PLAN-v1.md` — slice definitions
- `CMS-MVP-CUTLINE-v1.md` — MVP scope decisions
- `FRONTEND-STORY-BACKLOG-v1.md` — story definitions referenced below
- `FRONTEND-SYSTEM-BLUEPRINT-v1.md` — component taxonomy and data contracts

---

## Purpose

This document converts the 10 implementation slices into engineering epics with acceptance criteria, complexity estimates, dependency chains, and blocking risks. Each epic maps one-to-one to a slice. Stories (S[N]-[NN]) are defined in `FRONTEND-STORY-BACKLOG-v1.md`; this document references them by ID only.

**Read this before estimating sprints. Read the companion story backlog before writing code.**

---

## EPIC-0: Foundation Infrastructure

**Slice:** 0
**Goal:** The monorepo builds cleanly, all packages scaffold without circular dependencies, the shell application renders with working routes and authenticated/unauthenticated states, and CI passes on every commit.
**In MVP:** YES — this is a hard prerequisite for all other epics. No operator-visible functionality ships in this epic alone.

### Dependencies

- None (this is the root dependency for all other epics)
- Infrastructure: Node 20 + pnpm 8 + Turborepo must be provisioned in CI environment
- Backend: `/auth/login` and `/auth/refresh` endpoints must be reachable from the dev environment (can use mock server at this stage)

### Stories

S0-01: Initialize pnpm workspace and Turborepo pipeline
S0-02: Scaffold `@clubhub/types` package with shared TypeScript types
S0-03: Scaffold `@clubhub/api` package with Axios client and auth interceptor
S0-04: Scaffold `@clubhub/state` package with Zustand stores (auth, incidents, venues)
S0-05: Scaffold `@clubhub/ui` package with base design tokens and empty component index
S0-06: Scaffold `@clubhub/hooks` package with useWebSocket singleton stub
S0-07: Build shell application with React Router v6, authenticated shell layout, and unauthenticated redirect
S0-08: Wire CI pipeline (lint, type-check, build, unit test) with Turborepo caching

### Acceptance Criteria

1. `pnpm run build` from monorepo root completes without errors across all packages and the shell app.
2. `pnpm run type-check` passes with zero TypeScript errors across all packages.
3. `pnpm run lint` passes with zero ESLint errors; IC-03 enforcement rule (`no-write-in-replay-mode`) is present in `.eslintrc` and fires on a test fixture that violates it.
4. Navigating to `/` without a valid auth token redirects to `/login` within 1 render cycle (no flash of protected content).
5. Navigating to `/` with a valid auth token renders the shell layout with Zone A, Zone B placeholder, and Zone C placeholder.
6. Refreshing the page with a valid token does not trigger a logout (token persisted to `localStorage`, refresh interceptor active).
7. The WebSocket singleton (`useWebSocket`) initializes once per session; a second call to `useWebSocket()` in the same session returns the same connection instance (verified by unit test).
8. CI pipeline on a feature branch PR runs lint + type-check + build + unit tests in under 3 minutes (Turborepo cache warm).
9. `@clubhub/types` exports are importable in all other packages without circular dependency warnings.
10. The `no-write-in-replay-mode` ESLint rule is documented in `packages/eslint-plugin-clubhub/README.md` with one passing and one failing example.

### Complexity Estimate

**M** — No new UI patterns, no backend integration. Complexity is in the number of moving parts: workspace linking, Turborepo pipeline ordering, ESLint plugin authorship, and auth interceptor correctness. The IC-03 ESLint rule requires writing a custom AST rule, which is non-trivial but well-scoped. Estimate 1.5 sprint weeks for a 2-engineer team.

### Blocking Risks

1. **pnpm workspace link failures:** Circular imports between packages (e.g., `@clubhub/state` importing from `@clubhub/api` which imports from `@clubhub/types`) are only detected at build time, not at scaffold time. Allocate 0.5 days for dependency graph audit before first build attempt.
2. **Turborepo cache invalidation:** If `turbo.json` pipeline inputs are misconfigured, CI will not cache correctly and build times will exceed the 3-minute target. Requires a dedicated pipeline review pass.
3. **IC-03 ESLint rule scope:** The rule must detect write operations (form submissions, button `onClick` with `mutation.*`) that are present in the DOM when `isReplayMode === true`. Defining "present in DOM" statically from AST requires careful rule design. If this proves intractable in sprint, fall back to a runtime assertion in the WebSocket store with an E2E test.
4. **Auth refresh race condition:** If two requests fire simultaneously with an expired token, the interceptor must serialize refresh calls (not fire two refresh requests). This is a known Axios interceptor footgun — must be explicitly tested.

### Definition of Done

- All 10 acceptance criteria pass.
- CI pipeline is green on the main branch.
- `pnpm run build` output has been manually inspected: no `node_modules` leaking across packages.
- The IC-03 ESLint rule has been reviewed by a second engineer.
- Auth flow has been tested manually: login, refresh, logout, token-expired-on-reload.
- Turborepo remote cache is configured for CI (not optional — required for 3-minute target).

---

## EPIC-1: Venue Health Monitoring

**Slice:** 1
**Goal:** An authenticated operator can log in and see a real-time list of venues with health state indicators; drilling into a venue shows player health, machine state, and live WebSocket-driven updates without a page refresh.
**In MVP:** YES

### Dependencies

- EPIC-0 complete (monorepo, shell, auth, WebSocket singleton)
- Backend: `GET /venues` — paginated venue list with `machine_state`, `player_health`, `incident_count`
- Backend: `GET /venues/{id}/detail` — full venue record with screens, zones, hardware summary
- Backend: `GET /venues/{id}/player-health` — per-screen health metrics (sync lag, last heartbeat, corpus hash)
- Backend: `WS VENUE_STATE_UPDATE` — push event with `venue_id`, updated `machine_state`, `player_health` delta

### Stories

S1-01: VenueListPage route and layout scaffold
S1-02: VenueRow component with MachineStateBadge (OPERATIONAL, DEGRADED, OFFLINE, RECOVERED_BUT_UNTRUSTED)
S1-03: Zone A venue list with search and sort
S1-04: VenueDetailPage route and layout (tabs: Overview, Player Health, Ops — tabs 2–3 stubbed for EPIC-5)
S1-05: PlayerHealthPanel component (per-screen sync lag, heartbeat, corpus hash)
S1-06: WebSocket VENUE_STATE_UPDATE subscription and Zustand store update
S1-07: MachineStateBadge RECOVERED_BUT_UNTRUSTED variant (PATCH-009: amber with lock icon, override-blocked tooltip)
S1-08: Venue list real-time update (badge animates on state change, no full re-render)
S1-09: Empty state and error state for venue list
S1-10: Auth role gate — VIEWER sees venue list read-only; OPERATOR sees same (no write controls in this epic)

### Acceptance Criteria

1. An OPERATOR logging in sees a venue list within 2 seconds of authentication (first contentful paint; list may be loading skeletons).
2. Each venue row displays a `MachineStateBadge` reflecting the server-provided `machine_state`. Badge colors match the design token spec exactly: OPERATIONAL (green/`--color-state-ok`), DEGRADED (amber/`--color-state-warn`), OFFLINE (red/`--color-state-critical`), RECOVERED_BUT_UNTRUSTED (amber with lock icon/`--color-state-untrusted`).
3. When the server pushes `VENUE_STATE_UPDATE` via WebSocket, the affected venue row's badge updates within 500ms without a page navigation or full list re-render.
4. Clicking a venue row navigates to `/venues/{id}` and displays the venue detail page with Overview tab active.
5. The PlayerHealthPanel on the Overview tab shows per-screen: last heartbeat timestamp (human-readable), corpus hash (truncated to 8 chars with copy-to-clipboard), and sync lag in seconds.
6. A venue with `machine_state === 'RECOVERED_BUT_UNTRUSTED'` shows the PATCH-009 badge variant: amber background, lock icon, tooltip text "Overrides blocked — corpus re-verification required." Tooltip visible on hover/focus.
7. If `GET /venues` returns a 401, the user is redirected to `/login` with session cleared.
8. If `GET /venues` returns a 500 or network error, a non-blocking error banner appears above the list; any previously loaded venue rows remain visible.
9. The venue list is accessible: all `MachineStateBadge` states have `aria-label` values; venue rows are keyboard-navigable with Enter to navigate to detail.
10. A VIEWER role sees the same venue list and detail as OPERATOR. No write controls are rendered for either role in this epic.

### Complexity Estimate

**M** — Straightforward data-fetch + display pattern with one real-time layer (WebSocket). The MachineStateBadge RECOVERED_BUT_UNTRUSTED variant (PATCH-009) requires pixel-accurate implementation and must not be confused with DEGRADED. WebSocket reconnect behavior under network interruption must be handled in the singleton from EPIC-0. Estimate 1.5 sprint weeks.

### Blocking Risks

1. **WebSocket reconnect under poor network:** If the venue list WebSocket drops and reconnects, the Zustand store must reconcile the delta push with a full re-fetch (or the store state becomes stale). Reconnect behavior must be explicitly specified and tested before this epic closes.
2. **PATCH-009 pixel accuracy:** The RECOVERED_BUT_UNTRUSTED badge variant has specific visual treatment (lock icon, amber, tooltip text). If the design token `--color-state-untrusted` is not yet finalized in `@clubhub/ui`, this story blocks.
3. **Backend `player-health` response shape:** If the per-screen health response nests differently than assumed (e.g., screens keyed by `screen_id` vs array), TypeScript types in `@clubhub/types` must be updated before S1-05 can be implemented.
4. **Venue list pagination:** If backend implements cursor-based pagination, the Zone A venue list must handle infinite scroll or page controls. This must be confirmed before S1-03 begins.

### Definition of Done

- All 10 acceptance criteria pass.
- MachineStateBadge Storybook stories exist for all 4 state variants, reviewed by design.
- WebSocket reconnect scenario tested manually: kill network for 5s, restore, verify badges update within 2s of reconnection.
- PATCH-009 variant reviewed against design spec by a second engineer.
- No TypeScript `any` types in S1-xx story code.
- Lighthouse accessibility score for VenueListPage >= 90.

---

## EPIC-2: Incident Read-Only Monitoring

**Slice:** 2
**Goal:** An operator can see all active incidents in Zone A, open any incident detail in Zone B to read its full timeline and current state, and receive a visible COMMANDER_LAPSED alert when an active incident has no commander.
**In MVP:** YES

### Dependencies

- EPIC-1 complete (auth, venue list, WebSocket singleton established)
- Backend: `GET /incidents/active` — list of active incidents with `incident_id`, `venue_id`, `severity`, `commander`, `lapsed_at`
- Backend: `GET /incidents/{id}` — full incident detail with timeline, tabs 1–5 (Tab 6 ADMIN-only, deferred)
- Backend: `WS INCIDENT_CREATED` — push with full incident payload
- Backend: `WS INCIDENT_UPDATE` — push with incident delta (state, commander, timeline entry)
- Backend: `WS COMMANDER_LAPSED` — push with `incident_id`, `lapsed_at` (must come from server, not computed client-side)

### Stories

S2-01: Zone A incident list panel with severity indicator and venue linkage
S2-02: IncidentDetailPage route `/incidents/{id}` with tab scaffold (Tabs 1–5; Tab 6 absent for non-ADMIN)
S2-03: Tab 1 — Incident Overview (severity, machine state, description, timeline)
S2-04: Tab 2 — Active Overrides read-only list (no write controls)
S2-05: Tab 3 — Player Health read-only (reuse PlayerHealthPanel from EPIC-1)
S2-06: COMMANDER_LAPSED banner component (amber full-width, incident name, time since lapse, Claim button — button enabled only for OPERATOR+)
S2-07: WebSocket INCIDENT_CREATED and INCIDENT_UPDATE subscriptions — Zustand incident store
S2-08: Zone B auto-replace behavior on ZONE_B_AUTO_REPLACE push (navigate to incident detail automatically)

### Acceptance Criteria

1. Zone A shows all active incidents within 2 seconds of page load, ordered by severity descending then by `created_at` ascending.
2. Each incident entry in Zone A shows: severity badge (color-coded per severity level), venue name, incident ID (last 8 chars), and a commander indicator (name if claimed, "Unclaimed" if not).
3. Clicking an incident in Zone A navigates to `/incidents/{id}` and renders Tab 1 with the incident timeline.
4. Tab 6 is absent from the DOM (not hidden, not disabled) for VIEWER and OPERATOR roles. ADMIN sees Tab 6 stub.
5. The COMMANDER_LAPSED banner appears within 500ms of receiving the `COMMANDER_LAPSED` WebSocket push. The banner displays the time since lapse formatted as "Commander lapsed Xm ago" where X is derived from the server-provided `lapsed_at` field (not computed by the client independently).
6. The Claim button inside the COMMANDER_LAPSED banner is absent from the DOM for VIEWER role. It is present but functional for OPERATOR+.
7. When `INCIDENT_CREATED` arrives via WebSocket, a new entry appears in Zone A without page reload, and an unobtrusive toast notification appears ("New incident: [venue name]").
8. When `INCIDENT_UPDATE` arrives, the affected incident's Zone A entry and, if currently open in Zone B, the detail page update without navigation.
9. If `ZONE_B_AUTO_REPLACE` is pushed, Zone B navigates to the incident detail of the referenced `incident_id`. If the operator has unsaved state in Zone B, the auto-replace is deferred until a dismiss confirmation is accepted.
10. Tab 3 Player Health panel in incident detail is identical to the panel from EPIC-1 (shared component; no duplication).

### Complexity Estimate

**M** — The data flow is read-only at this stage. Complexity comes from the Zone B auto-replace behavior (which requires Zone B to expose a navigation interception hook) and the COMMANDER_LAPSED banner (which must use server-provided timestamps, not client-derived). Estimate 1.5 sprint weeks.

### Blocking Risks

1. **COMMANDER_LAPSED `lapsed_at` field:** The backend must provide `lapsed_at` as an ISO timestamp on the push event. If the backend provides a duration (seconds) instead, the display calculation becomes ambiguous under clock skew. This must be confirmed in the backend API contract before S2-06.
2. **ZONE_B_AUTO_REPLACE event confirmation:** It is not yet confirmed whether the backend emits a dedicated `ZONE_B_AUTO_REPLACE` event or whether this is a frontend inference from `INCIDENT_CREATED` for the operator's assigned venue. If it is a frontend inference, the logic must be precisely specified to avoid spurious navigations.
3. **Tab 6 DOM absence enforcement:** The IC-03-adjacent requirement that Tab 6 is absent (not hidden) for non-ADMIN must be enforced via role gate in the tab renderer, not a CSS `display: none`. The EPIC-0 ESLint rule does not cover this case — requires a separate code review gate.
4. **Incident list ordering stability:** If `GET /incidents/active` returns incidents in a different order than the Zustand store (which may order by arrival time of WebSocket pushes), the Zone A list will flicker on update. A stable sort key must be agreed before S2-01.

### Definition of Done

- All 10 acceptance criteria pass.
- COMMANDER_LAPSED banner has been tested with a synthetic server push in the dev environment (not mocked in the component).
- Tab 6 DOM-absence verified with a browser DevTools inspect (not just a visual check).
- Zone B auto-replace tested: two incidents arrive in rapid succession; only the latest replaces Zone B.
- No TypeScript `any` types in S2-xx story code.
- Tab components (Tabs 1–5) have Storybook stories with fixture data.

---

## EPIC-3: Commander Claim

**Slice:** 3
**Goal:** An OPERATOR can claim command of an active incident, receive confirmation of the claim, release command, and have all concurrent claim conflicts rendered to the user with actionable resolution.
**In MVP:** YES

### Dependencies

- EPIC-2 complete (incident detail page, COMMANDER_LAPSED banner, incident Zustand store)
- Backend: `POST /incidents/{id}/commander/claim` — returns 200 (claimed) or 409 (conflict with `current_commander` payload)
- Backend: `DELETE /incidents/{id}/commander` — releases claim; returns 204 or 409 (not commander)
- Backend: `POST /incidents/{id}/commander/notify` — notifies lapsed commander; 60s server-enforced cooldown; returns 429 if within cooldown
- Backend: `WS COMMANDER_CLAIMED` — push with `incident_id`, `commander_id`, `commander_name`
- Backend: `WS COMMANDER_RELEASED` — push with `incident_id`
- Backend: `WS REJECTION_STATE_PUSH` — push confirming a write rejection (must be confirmed with backend team)

### Stories

S3-01: AssumeCommandConfirmCard component (confirmation modal before POST claim)
S3-02: Claim action wiring — POST /claim, success path, Zustand store update
S3-03: 409 conflict handling — ConcurrencyConflictModal showing current commander name
S3-04: Release command flow — ReleaseCommandConfirmCard, DELETE /commander, success path
S3-05: COMMANDER_CLAIMED and COMMANDER_RELEASED WebSocket handlers — update incident store and Zone A
S3-06: Notify lapsed commander button — POST /notify, 60s cooldown UI (countdown timer, disabled state)
S3-07: REJECTION_STATE_PUSH handler — display rejection reason on write operations that fail server-side

### Acceptance Criteria

1. The "Assume Command" button is present in the COMMANDER_LAPSED banner and on Tab 1 of incident detail only for OPERATOR and ADMIN roles. The button is absent from the DOM for VIEWER.
2. Clicking "Assume Command" opens the AssumeCommandConfirmCard modal. The modal displays the incident ID, venue name, and a plain-language statement of what command entails. The operator must click a confirm button (not just dismiss the modal) to proceed.
3. On successful claim (200), the modal closes, the incident's commander field updates to the claiming operator's name in Zone A and Zone B, and a success toast appears. No page reload required.
4. On 409 conflict (another operator claimed first), the modal transitions to a conflict state showing the name of the current commander. The operator is not left in an ambiguous state.
5. The "Release Command" action is only available to the current commander. It opens a ReleaseCommandConfirmCard and requires explicit confirmation. On success (204), the incident reverts to "Unclaimed" state in Zone A and Zone B.
6. When `COMMANDER_CLAIMED` arrives via WebSocket for an incident the operator is viewing, the Zone B commander field updates within 500ms without navigation.
7. When `COMMANDER_RELEASED` arrives, the incident reverts to "Unclaimed" in Zone A and Zone B. If the operator was the released commander (released by another ADMIN), a non-dismissable notification appears: "You have been removed as commander of [incident]."
8. The "Notify Commander" button (for lapsed incidents) is disabled for 60 seconds after a successful POST /notify. The button displays a countdown ("Notify again in 47s"). The cooldown state persists across Zone B navigation (stored in Zustand, not component state).
9. If `REJECTION_STATE_PUSH` arrives from the server for a claim attempt, the rejection reason is displayed in a toast. The UI does not enter a loading state indefinitely — rejection resolves the pending state.
10. All write operations (claim, release, notify) are non-optimistic: the UI does not update until a 200/204 response or a WebSocket confirmation arrives.

### Complexity Estimate

**M** — The happy path (claim + release) is straightforward. Complexity is concentrated in the concurrent conflict scenario (Story S3-03), the `REJECTION_STATE_PUSH` handler (Story S3-07, requires backend confirmation), and the cooldown timer persistence (S3-06, must survive Zone B navigation). None of these are architecturally novel but each requires careful state management. Estimate 1.5 sprint weeks.

### Blocking Risks

1. **`REJECTION_STATE_PUSH` event not confirmed in backend:** If the backend does not emit a dedicated push event for write rejections, the frontend must infer rejection from HTTP response alone. This changes the architecture of S3-07. Must be resolved before sprint planning.
2. **60s cooldown server-enforcement:** The notify cooldown must be enforced server-side (returning 429 with `retry_after`). If only client-side, a page refresh bypasses the cooldown and operators can spam notifications. Backend must confirm server-side enforcement before S3-06 ships.
3. **AssumeCommandConfirmCard scope:** It is not yet confirmed whether this modal is also used for non-COMMANDER_LAPSED claim flows (e.g., operator proactively claims a non-lapsed incident with no commander). If the modal has variant states, the design must be finalized before S3-01.
4. **Race between HTTP 409 and COMMANDER_CLAIMED push:** If the server returns 409 and also emits `COMMANDER_CLAIMED`, the frontend may receive the push before the HTTP response. The store must handle this race gracefully (push wins; HTTP 409 is informational).

### Definition of Done

- All 10 acceptance criteria pass.
- Concurrent claim scenario tested end-to-end with two browser sessions (not mocked): Session A and Session B both attempt to claim the same incident; Session A succeeds, Session B sees the conflict modal with Session A's username.
- 60s cooldown verified by attempting POST /notify twice in rapid succession — second attempt receives 429 and UI shows countdown.
- `REJECTION_STATE_PUSH` handler verified with a synthetic server push in dev environment.
- No optimistic updates present — confirmed by throttling network to Slow 3G and verifying UI waits for response.

---

## EPIC-4: L6 Override Lifecycle

**Slice:** 4
**Goal:** An OPERATOR who is incident commander can place an L6 content override using a 3-step chip-select flow, remove it using a hold-to-confirm gesture, and receive explicit feedback for all three rejection types (CONCURRENCY_CONFLICT, AUTHORITY_BOUNDARY, PRE_CONSTRAINT).
**In MVP:** YES

### Dependencies

- EPIC-3 complete (commander claim, incident Zustand store with commander identity)
- Backend: `POST /incidents/{id}/overrides/l6` — body: `{ zone_id, content_id, priority }` — returns 200 or rejection payload
- Backend: `DELETE /incidents/{id}/overrides/{override_id}` — returns 204 or rejection payload
- Backend: `WS OVERRIDE_PLACED` — push with full override object
- Backend: `WS OVERRIDE_REMOVED` — push with `override_id`
- Backend: Rejection payloads must include `rejection_type` enum: `CONCURRENCY_CONFLICT | AUTHORITY_BOUNDARY | PRE_CONSTRAINT | REPLAY_MODE`

### Stories

S4-01: SequentialChipSelect component — 3-step selection (Zone, Content, Priority); resets on navigate-away
S4-02: L6 override placement form — wires SequentialChipSelect to POST /overrides/l6
S4-03: Override placement success path — OVERRIDE_PLACED handler, Tab 2 list update, toast confirmation
S4-04: HoldToConfirmButton component — 3s press duration, progress ring, cancellable on pointer-up/touch-end
S4-05: Override removal flow — HoldToConfirmButton wired to DELETE /overrides/{id}
S4-06: Override removal success path — OVERRIDE_REMOVED handler, Tab 2 list update
S4-07: CONCURRENCY_CONFLICT rejection handling — modal with conflict details, retry option
S4-08: AUTHORITY_BOUNDARY rejection handling — blocking modal, must be explicitly acknowledged, no retry
S4-09: PRE_CONSTRAINT rejection handling — informational modal with constraint reason
S4-10: REPLAY_MODE rejection — absent from DOM enforcement (IC-03); server-side 400 as defensive catch
S4-11: RECOVERED_BUT_UNTRUSTED client-side override block — if venue is RECOVERED_BUT_UNTRUSTED, placement button absent from DOM
S4-12: Concurrent placement conflict — if OVERRIDE_PLACED arrives for the same zone from another operator while form is open, form resets with conflict notification

### Acceptance Criteria

1. The L6 override placement flow is a 3-step sequential chip select: Step 1 selects the zone, Step 2 selects the content item, Step 3 selects the priority. Completing Step 2 does not submit the form — Step 3 must be completed and a final "Place Override" button clicked.
2. If the operator navigates away from the incident detail page (or to a different tab within it) at any step of the chip select, the selection state resets completely on return. The reset is confirmed by a router listener (not a component unmount heuristic).
3. The HoldToConfirmButton for override removal requires a 3-second continuous hold. A progress ring advances during the hold. Releasing before 3 seconds cancels the removal — no confirmation is fired, no API call is made. This behavior applies to both pointer (mouse) and touch events.
4. On successful override placement (200 + `OVERRIDE_PLACED` push), the override appears in Tab 2 within 500ms. A success toast confirms placement with the override ID (last 8 chars).
5. On successful override removal (204 + `OVERRIDE_REMOVED` push), the override disappears from Tab 2 within 500ms.
6. On `CONCURRENCY_CONFLICT` rejection: a modal appears with the message "Another operator placed an override on this zone moments ago" and the conflicting operator's name. A "Retry" button is offered that re-opens the chip select with Step 1 reset.
7. On `AUTHORITY_BOUNDARY` rejection: a blocking modal appears. The modal cannot be dismissed by clicking outside or pressing Escape. The operator must click an explicit "I understand" button. No retry is offered from this modal.
8. On `PRE_CONSTRAINT` rejection: an informational modal appears with the server-provided constraint reason string. The operator can dismiss and attempt a different selection.
9. The override placement button and chip select are absent from the DOM (not disabled) when `isReplayMode === true` (IC-03 enforcement). The absence is enforced at the component level, not via CSS.
10. The override placement button is absent from the DOM when the venue's `machine_state === 'RECOVERED_BUT_UNTRUSTED'`. The Zone A venue badge shows the PATCH-009 indicator as an additional signal.
11. All rejection modals include the incident ID, rejection type label, and a timestamp of when the rejection occurred (server-provided in rejection payload).
12. Write operations (POST and DELETE) are non-optimistic. The Tab 2 list does not change until the server confirmation (200/204 + WebSocket push) is received.

### Complexity Estimate

**L** — This is the most mechanically complex epic in the MVP. Three sources of complexity:

1. **SequentialChipSelect** is a new UI pattern not present in any shared component library. It must handle partial state, navigation-away reset, and concurrent invalidation (S4-12). It is stateful in Zustand (not component state) to enable the router listener reset.
2. **HoldToConfirmButton** is a timing-sensitive interaction that must handle pointer and touch events, cancellation, and accessibility (keyboard equivalent: hold Enter for 3 seconds). The progress ring requires a `requestAnimationFrame` loop.
3. **Three distinct rejection UX patterns** (modal with retry, blocking modal without dismiss, informational modal) must be clearly differentiated — operators under stress must immediately understand which type they are seeing.

Estimate 2.5 sprint weeks.

### Blocking Risks

1. **SequentialChipSelect router-listener reset:** React Router v6 does not expose a stable hook for "user has navigated away from this route" with partial state cleanup. The implementation must use `useEffect` cleanup or a navigation listener from the router history. If the router history API is not accessible from within the chip select component's package boundary, this requires a hook in `@clubhub/hooks` — coordinate with EPIC-0 team.
2. **HoldToConfirmButton pointer-up vs touch-end:** On iOS Safari, `pointerup` does not always fire after a long press. The implementation must test `touchend` as the cancellation event explicitly. Budget 0.5 days for cross-device testing.
3. **AUTHORITY_BOUNDARY modal dismissal lock:** Preventing Escape key and click-outside from dismissing the modal requires overriding the default dialog behavior. Most dialog libraries (Radix, Headless UI) expose a prop for this, but it must be verified that the `@clubhub/ui` Dialog component supports it.
4. **Concurrent placement conflict (S4-12):** When `OVERRIDE_PLACED` arrives from another operator while the local operator has the chip select open, the chip select must reset without losing the operator's awareness of what happened. The UX for this state (notification + reset) must be specified in design before S4-12 begins.
5. **Rejection payload shape:** The backend must include `rejection_type`, `conflicting_operator_name` (for CONCURRENCY_CONFLICT), `constraint_reason` (for PRE_CONSTRAINT), and `rejected_at` in all rejection responses. If any field is absent, the corresponding rejection modal falls back to a generic message — this fallback must be implemented.

### Definition of Done

- All 12 acceptance criteria pass.
- SequentialChipSelect navigation-away reset verified: open to Step 2, click Zone A nav item, return to incident, confirm Step 1 is shown.
- HoldToConfirmButton tested on: Chrome desktop (pointer), Safari mobile (touch), keyboard (Enter hold). Pass on all three.
- AUTHORITY_BOUNDARY modal verified: Escape key press does not dismiss; click outside does not dismiss; only "I understand" button dismisses.
- RECOVERED_BUT_UNTRUSTED block verified: set venue to UNTRUSTED state in dev, confirm placement button is absent from DOM (DevTools inspect).
- IC-03 REPLAY_MODE absence verified: enter replay mode in dev, confirm chip select and placement button are absent from DOM.
- Concurrent conflict (S4-12) tested with two browser sessions simultaneously.
- All three rejection types tested with real server rejections (not mocked HTTP responses).

---

## EPIC-5: Venue Operations Surface

**Slice:** 5
**Goal:** An operator can navigate to the Venue Operations surface for any venue, view hardware state and machine state history with computed durations, see the RECOVERED_BUT_UNTRUSTED protocol steps, monitor the 72-hour autonomy clock, and trigger corpus re-verification.
**In MVP:** YES

### Dependencies

- EPIC-1 complete (venue detail page scaffolded, MachineStateBadge, PlayerHealthPanel)
- Backend: `GET /venues/{id}/ops-summary` — hardware inventory, connectivity status, last sync
- Backend: `GET /venues/{id}/status` — current machine state with `entered_at` timestamp
- Backend: `GET /venues/{id}/machine-state-history` — array of `{ state, entered_at, exited_at }` with server-computed durations
- Backend: `GET /venues/{id}/corpus-status` — `{ hash, verified_at, status: 'VERIFIED' | 'PENDING' | 'FAILED' }`
- Backend: `POST /venues/{id}/corpus-status/verify` — triggers re-verification; returns 202 (accepted) or 409 (already in progress)

### Stories

S5-01: Venue Ops tab navigation wired on VenueDetailPage (Tab: Venue Operations)
S5-02: VenueOpsPage layout with hardware summary section
S5-03: MachineStateHistoryTable component — columns: state, entered_at, exited_at, duration (server-provided)
S5-04: RECOVERED_BUT_UNTRUSTED protocol display — step-by-step instructions, current step indicator
S5-05: AutonomyClockDisplay component — countdown from server-provided `autonomy_expires_at` (PATCH-011)
S5-06: CorpusStatusPanel — hash, verified_at, status badge, trigger re-verification button
S5-07: POST /corpus-status/verify flow — 202 path (pending state), 409 path (already in progress)
S5-08: Corpus verification real-time update — WS or polling for status change PENDING → VERIFIED/FAILED

### Acceptance Criteria

1. The Venue Operations tab is visible on the VenueDetailPage for OPERATOR and ADMIN roles. It is absent from the DOM for VIEWER role.
2. The MachineStateHistoryTable shows at minimum the last 10 state transitions. Each row shows: state name, entered_at (formatted as local datetime), exited_at (or "Current" if active), and duration (formatted as "Xh Ym" or "Xm Ys"). Duration values are sourced from the server response — the client does not compute durations from timestamps.
3. The autonomy clock displays as a countdown in the format "XX:XX:XX (HH:MM:SS remaining)". The clock is sourced from the server-provided `autonomy_expires_at` field (PATCH-011). If `autonomy_expires_at` is null (venue is connected), the clock is replaced by "Connected — autonomy clock inactive."
4. When the autonomy clock reaches zero, it displays "AUTONOMY EXPIRED — reconnect required" in the `--color-state-critical` token color, and a persistent amber banner appears at the top of the Venue Ops surface.
5. The RECOVERED_BUT_UNTRUSTED protocol section is visible only when the venue's `machine_state === 'RECOVERED_BUT_UNTRUSTED'`. It shows a numbered list of steps (sourced from the spec, not server-provided strings) with the current step highlighted.
6. The CorpusStatusPanel shows: current corpus hash (full, with copy-to-clipboard), verified_at timestamp, and a status badge (VERIFIED/green, PENDING/amber, FAILED/red).
7. Clicking "Trigger Re-verification" sends `POST /venues/{id}/corpus-status/verify`. On 202, the status badge transitions to PENDING and the button becomes disabled with the label "Verification in progress."
8. On 409 (verification already in progress), a toast appears: "Verification already running — check back in a moment." The button remains in its current state.
9. When corpus verification completes (VERIFIED or FAILED), the status badge updates within 5 seconds. If FAILED, a non-dismissable alert appears with the failure reason.
10. The entire Venue Ops surface is read-only in REPLAY mode (IC-03). The "Trigger Re-verification" button is absent from the DOM in REPLAY mode.

### Complexity Estimate

**M** — No new interaction patterns. The autonomy clock (S5-05) requires careful handling: the countdown must be seeded from the server-provided `autonomy_expires_at` and use client-side `setInterval` only for display updates (not as the source of truth). The RECOVERED_BUT_UNTRUSTED protocol display (S5-04) is statically defined in the frontend (not server-driven strings) — the spec text must be locked before S5-04 begins. Estimate 1.5 sprint weeks.

### Blocking Risks

1. **Machine state duration server-sourcing (PATCH-020):** If the backend provides only `entered_at` and `exited_at` and expects the client to compute duration, this creates a dependency on clock accuracy. The contract must specify server-computed `duration_seconds` as a field on each history entry. Raise with backend before S5-03.
2. **Autonomy clock `autonomy_expires_at` field (PATCH-011):** If the backend provides a duration (seconds remaining) instead of an absolute ISO timestamp, the countdown display will drift over multiple page visits due to request latency. Must be confirmed as absolute timestamp before S5-05.
3. **Corpus status polling vs WebSocket:** `POST /corpus-status/verify` returns 202 (async). The spec does not confirm whether status updates arrive via WebSocket or require polling. If WebSocket, a new event type must be registered. If polling, a polling strategy (interval, max retries) must be specified. Confirm with backend before S5-08.
4. **RECOVERED_BUT_UNTRUSTED protocol step text:** The numbered steps displayed in S5-04 are static frontend text. The exact wording must be reviewed and locked by operations before the story ships, as operators will follow these steps in production.

### Definition of Done

- All 10 acceptance criteria pass.
- Autonomy clock tested: set `autonomy_expires_at` to 10 seconds in future, confirm countdown reaches zero and critical state renders.
- Machine state history duration values verified against server response (not computed by client) by inspecting network response.
- RECOVERED_BUT_UNTRUSTED protocol step text approved by operations team in writing.
- Corpus re-verification flow tested end-to-end: trigger verify, observe PENDING badge, wait for VERIFIED or FAILED result.
- IC-03 enforcement for re-verification button verified in REPLAY mode.

---

## EPIC-6: CMS Content Operations

**Slice:** 6
**Goal:** A CONTENT_MANAGER can view the content calendar, schedule content into slots, and see 72-hour delivery status with delivery priority differentiation; a HIGH_PRIORITY delivery failure shows the correct visual treatment.
**In MVP:** YES

### Dependencies

- EPIC-1 complete (auth, venue linkage, WebSocket)
- Backend: `GET /cms/calendar` — week/day grid of scheduled slots with `delivery_status`, `delivery_priority`
- Backend: `POST /cms/calendar/slots` — create slot; body: `{ content_id, venue_ids, start_at, end_at, priority }`
- Backend: `GET /cms/delivery-confidence` — per-slot confidence score with breakdown
- Backend: `PATCH /cms/training-mode` — toggle training mode (DEFERRED from MVP — stub endpoint acceptable)
- Backend: `WS DELIVERY_STATE_UPDATE` — push with `slot_id`, updated `delivery_status`, `delivery_priority`
- Backend: `delivery_priority` field must be present on calendar slots (A-NEW-02 gap — must be confirmed)

### Stories

S6-01: CMS workspace route `/cms` with Zone B calendar grid scaffold
S6-02: ContentCalendarGrid component — week view, day columns, slot blocks
S6-03: SlotBlock component — displays content name, venue count, delivery status badge
S6-04: 72h delivery warning banner — variant 1: STANDARD (amber, informational text)
S6-05: 72h delivery warning banner — variant 2: HIGH_PRIORITY (★ header, deep-orange border `--color-priority-high`)
S6-06: 72h delivery warning banner — variant 3: UNRESOLVABLE (red, "Delivery cannot be guaranteed" message)
S6-07: Slot creation flow — SlotCreationModal with content picker, venue multi-select, datetime inputs
S6-08: DeliveryConfidencePanel — per-slot confidence score, breakdown by venue, last updated timestamp
S6-09: DELIVERY_STATE_UPDATE WebSocket handler — slot badge and banner update without page reload
S6-10: Training mode stub — UI toggle present for CONTENT_MANAGER, sends PATCH /cms/training-mode, visible state change (deferred functionality)

### Acceptance Criteria

1. A CONTENT_MANAGER navigating to `/cms` sees a weekly calendar grid within 2 seconds. Each scheduled slot is rendered as a block with content name, number of targeted venues, and a delivery status badge.
2. The delivery status badge on each slot reflects: DELIVERED (green), IN_TRANSIT (amber), PENDING (grey), FAILED (red). Badge updates within 500ms of a `DELIVERY_STATE_UPDATE` push.
3. Any slot scheduled to air within 72 hours that has not reached DELIVERED status shows a banner below the slot block. The banner variant is determined by `delivery_priority`:
   - `delivery_priority === 'STANDARD'`: Amber banner with text "Delivery window closing — verify connectivity."
   - `delivery_priority === 'HIGH_PRIORITY'`: Deep-orange border (`--color-priority-high`), ★ icon in header, text "High-priority delivery at risk — escalate immediately." Visual treatment must match spec exactly.
   - `delivery_priority === 'UNRESOLVABLE'`: Red banner with text "Delivery cannot be guaranteed for this slot."
4. If the `delivery_priority` field is absent from the server response (A-NEW-02 fallback), the slot renders the STANDARD banner variant. No error is thrown.
5. Clicking "Add Slot" opens the SlotCreationModal. The modal requires: content selection (searchable dropdown), venue multi-select (minimum 1 venue), start datetime, end datetime. The form validates that `end_at > start_at + 1 hour` client-side before submission.
6. On successful slot creation (201), the new slot appears in the calendar grid at the correct time position without page reload. A success toast confirms with the slot ID.
7. Slot creation is rejected client-side if the selected time window overlaps with an existing slot on any of the selected venues. The modal shows which venues have conflicts before submission.
8. The DeliveryConfidencePanel for a selected slot shows: overall confidence percentage, breakdown by venue (venue name, confidence %, last heartbeat), and timestamp of last update.
9. The Training Mode toggle is visible for CONTENT_MANAGER and ADMIN roles. Toggling it sends `PATCH /cms/training-mode`. The toggle reflects the server response state (non-optimistic). If training mode is DEFERRED (backend returns 501), the toggle is disabled with a tooltip: "Training mode not yet available."
10. The entire CMS workspace is absent (not just read-only) for VIEWER and OPERATOR roles. Navigating to `/cms` as VIEWER redirects to `/` with a toast: "Access denied — Content Manager role required."

### Complexity Estimate

**L** — Three sources of complexity:

1. **Three 72h banner variants** require `delivery_priority` to be present and correctly typed in `@clubhub/types`. If A-NEW-02 is not resolved before development, the banner logic ships with a fallback-only path.
2. **Calendar grid slot conflict detection** must run client-side on slot creation for UX responsiveness, and also accept server-side 409 for conflicts the client missed (race condition with another content manager adding a slot simultaneously).
3. **HIGH_PRIORITY visual treatment** (`--color-priority-high`, ★ header) must be pixel-accurate against the spec. If the design token is not yet in `@clubhub/ui`, this blocks S6-05.

Estimate 2 sprint weeks.

### Blocking Risks

1. **`delivery_priority` field (A-NEW-02):** This field is not yet confirmed in the backend API. Without it, the HIGH_PRIORITY banner variant cannot be rendered correctly. The frontend can ship S6-04 (STANDARD) and S6-06 (UNRESOLVABLE) first, with S6-05 gated on backend confirmation. Do not ship S6-05 with a hardcoded `delivery_priority` assumption.
2. **HIGH_PRIORITY visual token:** `--color-priority-high` (deep-orange) must be added to the design token set in `@clubhub/ui` before S6-05. If not present, S6-05 must use a hardcoded hex value with a TODO comment — acceptable as a temporary measure but must be resolved before beta.
3. **Calendar grid library selection:** The content calendar requires a robust week-view grid that supports drag-to-create, slot overlap visualization, and WebSocket-driven updates. If `@clubhub/ui` does not include a calendar primitive, a third-party library (e.g., `react-big-calendar`) must be evaluated and approved before S6-02. This evaluation should happen in EPIC-0 spike time.
4. **Slot conflict detection race:** If two content managers create overlapping slots simultaneously, the client-side conflict check will not catch it (both see a clean calendar). The server must return a 409 with the conflicting slot's details, and the modal must handle this server-side rejection distinctly from client-side detection.

### Definition of Done

- All 10 acceptance criteria pass.
- HIGH_PRIORITY banner visual treatment reviewed against design spec by design team (screenshot comparison).
- `delivery_priority` field confirmed present in `GET /cms/calendar` response (A-NEW-02 resolved or explicit fallback documented).
- Slot conflict scenario tested: create two overlapping slots simultaneously from two browser sessions; verify server 409 is handled gracefully.
- Training mode toggle tested against a 501 response (deferred stub) — disabled state with tooltip confirmed.
- DELIVERY_STATE_UPDATE WebSocket handler tested: update arrives while slot detail is open, banner variant changes without reload.
- OPERATOR/VIEWER role redirect from `/cms` tested.

---

## EPIC-7: Replay Investigation Surface *(DEFERRED — not in MVP)*

**Slice:** 7
**Goal (full scope):** An operator with appropriate permissions can load a corpus replay session, transport through it frame-by-frame, add immutable annotations, see collaborators' positions in real-time, and identify contradiction events.
**In MVP:** NO — This entire surface is deferred from the MVP. Zero stories from this epic are scheduled. The route `/replay` must not exist in the MVP build.

### Dependencies

- EPIC-4 complete (IC-03 enforcement architecture; HoldToConfirmButton)
- Backend: `GET /replay/sessions` — session list
- Backend: `GET /replay/sessions/{id}` — session detail with corpus metadata
- Backend: `POST /replay/sessions/{id}/transport` — seek to frame/timestamp
- Backend: `GET /replay/sessions/{id}/annotations` — annotation list
- Backend: `POST /replay/sessions/{id}/annotations` — add annotation (ADMIN only for Tab 6)
- Backend: `WS COLLABORATOR_POSITION` — real-time collaborator cursor position
- Backend: `WS ANNOTATION_ADDED` — push when annotation created
- Backend: `WS ANNOTATION_CONTRADICTION_DETECTED` — push when contradiction identified

### Stories

S7-01 through S7-15 — defined in FRONTEND-STORY-BACKLOG-v1.md but not scheduled

### Acceptance Criteria

*(Not evaluated for MVP. Acceptance criteria will be written as a separate engineering spec when this epic is scheduled.)*

1. When this epic is scheduled, IC-03 enforcement (write controls absent in REPLAY mode) is the first acceptance criterion to be verified — this surface exists entirely within REPLAY mode context.
2. Annotation immutability: once an annotation is submitted, it cannot be edited or deleted from the UI. The API must enforce this server-side; the UI enforces it by never rendering an edit/delete control on submitted annotations.
3. Tab 6 (ADMIN-only annotation management) must return 404 from the backend for non-ADMIN sessions (role-obscuring — the route existence itself is hidden, not just access-blocked).

### Complexity Estimate

**XL** — Four independent sources of complexity, each of which would be L on its own:

1. **IC-03 enforcement architecture:** This surface lives inside REPLAY mode by definition. Every write control must be absent from the DOM. The enforcement must be verified at the ESLint rule level and at runtime.
2. **Multi-collaborator real-time:** Rendering collaborator positions (cursor, frame position) in real-time via `COLLABORATOR_POSITION` WebSocket events requires careful throttling (avoid re-renders on every event) and a collaborator presence model in Zustand.
3. **Contradiction detection rendering:** The `ANNOTATION_CONTRADICTION_DETECTED` event must surface a distinct visual treatment without disrupting the operator's current annotation view. The rendering logic for contradictions is architecturally novel.
4. **`ZONE_B_AUTO_REPLACE` suspension:** While in replay, the Zone B auto-replace behavior (from EPIC-2) must be suspended. Re-activating it on exit from replay requires the router to track replay state at the shell level.

This is the most complex single surface in the system. Do not partially build it — the IC-03 architecture makes partial builds dangerous (a partially-built replay surface with some write controls visible is a production safety violation).

### Blocking Risks

1. **Full deferral integrity:** The replay surface route must not exist in the MVP build. If any story from EPIC-7 is partially implemented (e.g., route scaffolded but not wired), the IC-03 ESLint rule will not catch the partial state. A CI check must verify the `/replay` route is absent from the MVP bundle.
2. **Backend replay endpoints:** All `/replay/sessions/*` endpoints and the three WebSocket event types are not yet confirmed. This epic cannot be estimated until the backend API contract is final.
3. **Tab 6 role-obscuring (404 vs 403):** The distinction between 404 (role-obscuring; route existence hidden) and 403 (access denied; route exists but blocked) for Tab 6 must be confirmed with the backend team. The frontend Tab 6 rendering logic depends on this.

### Definition of Done

*(Not applicable — epic is deferred. Definition of Done will be written when the epic is scheduled.)*

**Pre-condition for scheduling:** IC-03 ESLint rule from EPIC-0 must be proven sufficient for replay surface enforcement, or a supplementary mechanism must be designed. This must be evaluated before EPIC-7 sprint planning.

---

## EPIC-8: Advisory and Notification System

**Slice:** 8
**Goal (MVP partial):** Zone C displays advisory text for the operator's current context; the notification tray in the System Status Bar shows an unread count and allows marking notifications as read. Visual advisory escalation states (color-coded severity levels per A-NEW-01) are deferred to post-MVP.
**In MVP:** PARTIAL — Advisory text rendering and notification tray are in MVP. Full A-NEW-01 visual escalation states (beyond INFORMATIONAL rendering) are deferred.

### Dependencies

- EPIC-1 complete (Zone C panel rendered, WebSocket singleton)
- Backend: `WS ADVISORY_UPDATE` — must include `advisory_level` field (A-NEW-01 — new field, not yet confirmed); MVP fallback: if field absent, render as INFORMATIONAL
- Backend: `WS NOTIFICATION_CREATED` — push with notification payload
- Backend: `GET /notifications` — paginated notification list with `read` boolean
- Backend: `PATCH /notifications/{id}/read` — mark as read; returns 200

### Stories

S8-01: Zone C AdvisoryPanel component — displays advisory text, timestamp, source
S8-02: ADVISORY_UPDATE WebSocket handler — updates Zone C content; INFORMATIONAL fallback if `advisory_level` absent
S8-03: NotificationTray component in System Status Bar — bell icon with unread count badge
S8-04: NotificationTrayPanel — slide-out panel with notification list, mark-as-read action
S8-05: NOTIFICATION_CREATED WebSocket handler — unread count increments, tray updates
S8-06: A-NEW-01 advisory level visual states — color-coded severity per level (post-MVP; stub with INFORMATIONAL only in MVP)

### Acceptance Criteria

*(MVP scope — Stories S8-01 through S8-05)*

1. Zone C displays the most recent advisory text for the operator's session. If no advisory exists, Zone C shows "No active advisories."
2. When `ADVISORY_UPDATE` arrives via WebSocket, Zone C updates within 500ms. If the `advisory_level` field is absent from the push event (A-NEW-01 fallback), the advisory renders with INFORMATIONAL styling (no visual escalation).
3. The System Status Bar bell icon shows an unread notification count badge (red, max display "99+"). The count is sourced from `GET /notifications` on page load and increments on each `NOTIFICATION_CREATED` push.
4. Clicking the bell icon opens the NotificationTrayPanel as a slide-out from the right, overlaying Zone C. The tray shows the 20 most recent notifications with read/unread state.
5. Clicking a notification marks it as read (`PATCH /notifications/{id}/read`). The unread count badge decrements immediately (optimistic update is acceptable here — this is a low-safety read-state operation).
6. Marking a notification as read is non-destructive. The notification remains in the tray list in a read state; it is not removed.
7. The notification tray is accessible: notifications are in a list with `aria-label`; the bell icon has `aria-label="Notifications, X unread"` where X is the current count.
8. When the tray is open, new `NOTIFICATION_CREATED` pushes cause the new notification to appear at the top of the tray list in real-time.

*(Post-MVP — Story S8-06)*

9. When `advisory_level` is present in `ADVISORY_UPDATE`, Zone C renders the advisory with the corresponding color from the A-NEW-01 severity table (6 levels). The color is sourced from `@clubhub/ui` design tokens, not inline styles.

### Complexity Estimate

**S** (for MVP partial scope) — The advisory panel and notification tray are straightforward data-fetch + WebSocket display patterns. The only architectural consideration is the A-NEW-01 fallback: if `advisory_level` is absent, the panel must degrade gracefully without errors. The optimistic update for mark-as-read is intentional and documented.

**M** (for full scope including S8-06) — Adding A-NEW-01 requires 6 visual variants and a color token system that must be consistent with the severity model from the design system.

Estimate: 1 sprint week for MVP partial; 0.5 sprint weeks additional for S8-06 post-MVP.

### Blocking Risks

1. **`advisory_level` field (A-NEW-01):** If this field is not present on `ADVISORY_UPDATE`, the MVP ships with INFORMATIONAL-only rendering. This is acceptable per the MVP cutline. The risk is that A-NEW-01 is partially implemented (field present but with an unexpected enum shape), causing the fallback to trigger incorrectly. The TypeScript type for `ADVISORY_UPDATE` must have `advisory_level` as optional with a strict enum.
2. **Zone C layout conflict with NotificationTrayPanel:** The notification tray slides out from the right and overlays Zone C. If Zone C has sticky-positioned elements (e.g., an advisory alert), the z-index stack must be explicitly defined in `@clubhub/ui` to prevent the tray from rendering beneath Zone C content.
3. **Notification count accuracy across sessions:** If the operator has multiple tabs open, the unread count must remain consistent (or at least monotonically non-increasing as reads happen). This is a WebSocket fan-out concern for the backend — confirm that `NOTIFICATION_CREATED` is per-session, not per-user (which would cause double-increment).

### Definition of Done

- Acceptance criteria 1–8 pass (MVP scope).
- A-NEW-01 fallback tested: send `ADVISORY_UPDATE` without `advisory_level` field — confirm INFORMATIONAL rendering, no console error.
- Notification tray z-index tested: open tray while Zone C advisory is visible, confirm tray renders above advisory.
- Notification count accuracy tested across two tabs: read a notification in Tab 1, confirm Tab 2 count decrements (or documents that cross-tab sync is deferred).
- S8-06 is documented as a post-MVP story in the backlog with an explicit acceptance criterion added to this epic before scheduling.

---

## EPIC-9: ADMIN Features

**Slice:** 9
**Goal (MVP partial):** ADMIN role users have the same capabilities as CONTENT_MANAGER across all MVP surfaces; no additional ADMIN-exclusive surfaces are unlocked at MVP launch.
**Goal (full scope):** ADMIN users can access Tab 6 in Incident Command and Replay surfaces, manage venue configuration, and decommission screens.
**In MVP:** PARTIAL — At MVP, ADMIN role is granted CONTENT_MANAGER capability via role gate. No additional ADMIN-specific stories are required beyond those already completed in EPIC-0 through EPIC-6. The partial designation captures the gap between MVP and full scope.

### Dependencies

*(MVP partial — no additional dependencies beyond EPIC-0 through EPIC-6)*

*(Full scope)*

- EPIC-6 complete (for ADMIN access to CMS features)
- EPIC-7 complete (for Replay Tab 6 — DEFERRED until EPIC-7 is scheduled)
- Backend: Tab 6 in IC surface must return 403 for non-ADMIN (confirmed)
- Backend: Tab 6 in Replay surface must return 404 for non-ADMIN (role-obscuring — must be confirmed with backend; 404 behavior distinguishes from 403)
- Backend: `GET /venues/{id}/config` — venue configuration object
- Backend: `PATCH /venues/{id}/config` — update venue configuration
- Backend: `DELETE /venues/{id}/screens/{screen_id}` — decommission screen; returns 204 or 409 (screen active)

### Stories

*(MVP partial — 0 additional stories; ADMIN role handled by role gate in EPIC-0)*

*(Full scope)*

S9-01: Tab 6 in Incident Command surface — ADMIN-only annotation and override audit log
S9-02: Tab 6 access enforcement — 403 response from backend; frontend shows "Admin access required" inline (not a modal)
S9-03: Replay Tab 6 in Replay surface — ADMIN-only; 404 response for non-ADMIN (route existence concealed)
S9-04: Venue configuration editor — read/edit venue config fields; PATCH on save
S9-05: Screen decommission flow — confirmation modal, HoldToConfirmButton (reuse from EPIC-4), DELETE /screens/{id}
S9-06: Screen decommission conflict handling — 409 if screen is active (displaying content); modal with "Force decommission" option (requires second confirmation)

### Acceptance Criteria

*(MVP partial)*

1. An ADMIN-authenticated session has access to all features available to CONTENT_MANAGER across Slices 0–6 and Slice 8 (partial). This is verified by the role gate in `@clubhub/state` returning `['VIEWER', 'OPERATOR', 'CONTENT_MANAGER', 'ADMIN']` capabilities for the ADMIN role.
2. No ADMIN-specific UI surfaces or controls are visible to OPERATOR or CONTENT_MANAGER roles.

*(Full scope — to be verified when EPIC-7 and full EPIC-9 are scheduled)*

3. Tab 6 in Incident Command renders for ADMIN and is absent from the DOM for OPERATOR, CONTENT_MANAGER, and VIEWER. A 403 from the backend for Tab 6 content triggers a non-modal inline message within the tab body.
4. Tab 6 in Replay surface renders for ADMIN and does not exist as a route for non-ADMIN (404 from backend; frontend does not render the tab at all for non-ADMIN, preventing route discovery).
5. The venue configuration editor allows ADMIN to modify permitted config fields. PATCH sends only modified fields (partial update). A success toast confirms save. Unchanged fields are not sent in the PATCH body.
6. Screen decommission requires the HoldToConfirmButton (3-second hold, identical behavior to EPIC-4's override removal). On 204, the screen is removed from the venue detail screen list within 500ms.
7. On 409 (screen active), a modal appears: "This screen is currently displaying content. Force decommission?" with a second HoldToConfirmButton. Forcing requires an additional 5-second hold (extended hold for destructive action).

### Complexity Estimate

**M** (for full scope) — The MVP partial is zero net complexity (role gate already implemented in EPIC-0). Full scope complexity comes from:

1. Tab 6 dual enforcement (403 in IC vs 404 in Replay) — two different error handling paths for what appears to be the same pattern.
2. Screen decommission with double-hold confirmation (extended 5s hold) — reuses HoldToConfirmButton from EPIC-4 but with a variant prop.
3. Venue config editor — field set, validation, partial PATCH — standard but must handle schema changes without breaking older configs.

Estimate for full scope: 1.5 sprint weeks (after EPIC-7 and EPIC-4 are complete).

### Blocking Risks

1. **Replay Tab 6 404 vs 403 confirmation:** The distinction between 404 (role-obscuring) and 403 (access denied) for Replay Tab 6 must be confirmed with the backend team before S9-03. The frontend renders the tab differently in each case (404: tab is absent; 403: tab is present with an error message). Implementing against the wrong assumption requires rework.
2. **Venue config schema:** The set of editable fields in the venue config must be defined and locked before S9-04. If the schema changes between sprint planning and delivery, the editor form must be regenerated.
3. **Double-hold UX (5s):** The extended hold for force decommission (S9-06) is a deviation from the standard 3s hold pattern. If the HoldToConfirmButton component from EPIC-4 does not accept a `duration` prop, it must be extended. This is a small but breaking change to a shared component — requires coordination with any team members who have already shipped EPIC-4 stories.

### Definition of Done

*(MVP partial)*

- Acceptance criteria 1–2 pass.
- ADMIN role capability list in `@clubhub/state` reviewed and matches the spec.

*(Full scope)*

- Acceptance criteria 3–7 pass.
- Tab 6 absence verified for non-ADMIN by DevTools DOM inspect (not visual check) in both IC and Replay surfaces.
- Screen decommission double-hold (5s) tested on desktop and mobile.
- Venue config PATCH verified to send only modified fields (network inspection).

---

## Epic Dependency Graph (ASCII)

```
EPIC-0: Foundation Infrastructure
│
├── EPIC-1: Venue Health Monitoring
│   │
│   ├── EPIC-2: Incident Read-Only Monitoring
│   │   │
│   │   └── EPIC-3: Commander Claim
│   │       │
│   │       └── EPIC-4: L6 Override Lifecycle
│   │           │
│   │           └── EPIC-7: Replay Investigation [DEFERRED]
│   │               │
│   │               └── EPIC-9: ADMIN Features (full — Tab 6 Replay)
│   │
│   ├── EPIC-5: Venue Operations Surface
│   │
│   └── EPIC-6: CMS Content Operations
│       │
│       └── EPIC-9: ADMIN Features (full — venue config, decommission)
│
└── EPIC-8: Advisory + Notification System
    (depends on EPIC-1 for WebSocket singleton;
     runs in parallel with EPIC-2 onward)
```

**Notes on the graph:**

- EPIC-5 and EPIC-6 are parallelizable after EPIC-1 completes (different surfaces, no shared state mutation).
- EPIC-8 MVP stories can begin after EPIC-1 completes and run in parallel with EPIC-2/3/4/5/6.
- EPIC-7 is a hard dependency of full EPIC-9. Both are post-MVP.
- EPIC-9 MVP partial requires no dependencies beyond EPIC-0 (role gate wired at foundation).
- EPIC-3 is a hard prerequisite for EPIC-4 (commander identity must be established before override placement).

---

## MVP Epic Summary Table

| Epic | In MVP | Complexity | Est. Sprint Weeks | Blocking On |
|------|--------|------------|-------------------|-------------|
| EPIC-0: Foundation Infrastructure | YES | M | 1.5 | pnpm/Turborepo config; IC-03 ESLint rule |
| EPIC-1: Venue Health Monitoring | YES | M | 1.5 | EPIC-0; backend GET /venues + WS VENUE_STATE_UPDATE; PATCH-009 design token |
| EPIC-2: Incident Read-Only Monitoring | YES | M | 1.5 | EPIC-1; backend GET /incidents/active + WS COMMANDER_LAPSED with lapsed_at; ZONE_B_AUTO_REPLACE confirmed |
| EPIC-3: Commander Claim | YES | M | 1.5 | EPIC-2; backend POST /claim + REJECTION_STATE_PUSH confirmed; 60s cooldown server-enforced |
| EPIC-4: L6 Override Lifecycle | YES | L | 2.5 | EPIC-3; backend rejection payload shape; SequentialChipSelect router listener; HoldToConfirmButton touch testing |
| EPIC-5: Venue Operations Surface | YES | M | 1.5 | EPIC-1; PATCH-020 duration server-sourced; PATCH-011 autonomy_expires_at absolute timestamp; corpus status push/poll confirmed |
| EPIC-6: CMS Content Operations | YES | L | 2.0 | EPIC-1; A-NEW-02 delivery_priority field confirmed; HIGH_PRIORITY token in @clubhub/ui; calendar library selected |
| EPIC-7: Replay Investigation | NO (DEFERRED) | XL | — | EPIC-4; backend all /replay/* endpoints; Tab 6 404 confirmed; do not partially build |
| EPIC-8: Advisory + Notifications | PARTIAL | S (MVP) / M (full) | 1.0 (MVP) + 0.5 (full) | EPIC-1; A-NEW-01 advisory_level field (MVP fallback acceptable); Zone C z-index contract |
| EPIC-9: ADMIN Features | PARTIAL | M (full) | 0 (MVP) + 1.5 (full) | EPIC-0 (MVP partial); EPIC-7 + EPIC-4 (full); Tab 6 404 vs 403 backend confirmed |

**Total MVP sprint weeks (sequential critical path):**
EPIC-0 (1.5) → EPIC-1 (1.5) → EPIC-2 (1.5) → EPIC-3 (1.5) → EPIC-4 (2.5) = **8.5 weeks on critical path**

**Parallelizable after EPIC-1:**
EPIC-5 and EPIC-6 can run in parallel with EPIC-2/3/4. EPIC-8 MVP partial can run in parallel with EPIC-2.

**Estimated MVP calendar duration (2-engineer team, parallel execution):**
With one engineer on the EPIC-0→1→2→3→4 critical path and a second engineer running EPIC-5, EPIC-6, and EPIC-8 in parallel after EPIC-1 completes:

- Engineer A: EPIC-0 (1.5) + EPIC-1 (1.5) + EPIC-2 (1.5) + EPIC-3 (1.5) + EPIC-4 (2.5) = 8.5 weeks
- Engineer B: waits for EPIC-1 (1.5 weeks), then EPIC-5 (1.5) + EPIC-6 (2.0) + EPIC-8 MVP (1.0) = 1.5 + 4.5 = 6 weeks

**MVP calendar estimate: approximately 8.5–9 sprint weeks** (bound by critical path; Engineer B completes before Engineer A).

**Risk adjustment:** Add 1.5 weeks for backend contract resolution delays (A-NEW-01, A-NEW-02, PATCH-009, PATCH-011, PATCH-020, REJECTION_STATE_PUSH, ZONE_B_AUTO_REPLACE). These are not optional — they gate specific acceptance criteria.

**Revised MVP estimate with risk buffer: 10–11 sprint weeks.**

---

*This document is authoritative for epic scope and acceptance criteria. Story-level detail is in `FRONTEND-STORY-BACKLOG-v1.md`. Backend contract gaps identified here (A-NEW-01, A-NEW-02, PATCH-009, PATCH-011, PATCH-020, REJECTION_STATE_PUSH, ZONE_B_AUTO_REPLACE) must be resolved in backend sprint planning before the dependent frontend stories begin.*
