# Frontend Story Backlog v1
# ClubHub TV — Operator CMS

**Platform:** React 18 + TypeScript operator CMS
**Roles:** VIEWER, OPERATOR, CONTENT_MANAGER, ADMIN
**Total Stories:** 67
**Date:** 2026-06-04

---

## Epic Index

| Epic | Name | Stories |
|------|------|---------|
| EPIC-0 | Foundation Infrastructure | S0-01 – S0-08 |
| EPIC-1 | Venue Health Monitoring | S1-01 – S1-10 |
| EPIC-2 | Incident Read-Only Monitoring | S2-01 – S2-08 |
| EPIC-3 | Commander Claim | S3-01 – S3-07 |
| EPIC-4 | L6 Override Lifecycle | S4-01 – S4-12 |
| EPIC-5 | Venue Operations Surface | S5-01 – S5-08 |
| EPIC-6 | CMS Content Operations | S6-01 – S6-10 |
| EPIC-8 (partial) | Advisory + Notifications | S8-01 – S8-04 |

---

## EPIC-0: Foundation Infrastructure

### S0-01
**Epic:** EPIC-0
**As a** developer, **I want to** set up a Turborepo monorepo with pnpm workspaces **so that** packages can be built in dependency order.
**Technical notes:** Create `pnpm-workspace.yaml` with `packages: ['apps/*', 'packages/*']`. Create `turbo.json` with pipeline: `build` depends on `^build`, `type-check` depends on `^build`, `test` has no dependencies. Create packages: `@clubhub/types`, `@clubhub/api`, `@clubhub/state`, `@clubhub/hooks`, `@clubhub/ui`. Create app: `apps/cms-operator` with Vite + React 18.
**Dependencies:** None
**Acceptance criteria:**
- [ ] `pnpm install` succeeds without errors
- [ ] `pnpm -r build` builds all packages in correct dependency order (types before api, api before state, etc.)
- [ ] `pnpm -r type-check` passes with 0 errors
- [ ] `turbo run build` executes the pipeline correctly via Turborepo
- [ ] All packages and the `apps/cms-operator` app are listed in `pnpm-workspace.yaml`
**Complexity:** 3

---

### S0-02
**Epic:** EPIC-0
**As a** developer, **I want to** have all shared TypeScript interfaces in one package **so that** all packages use the same type definitions.
**Technical notes:** Define interfaces in `@clubhub/types`: `MachineState`, `ConstitutionalState`, `OperatorRole`, `Venue`, `VenueDetail`, `Incident`, `IncidentSeverity`, `Override`, `Advisory`, `AdvisoryLevel`, `DeliveryPriority`, `Notification`, `PlayerHealth`, `SystemHealth`, `OperatorIdentity`, `WsEvent`, `RejectionType`, `RejectionDetail`. No logic, no imports from other packages. All types exported from `index.ts`.
**Dependencies:** S0-01
**Acceptance criteria:**
- [ ] `@clubhub/types` builds with 0 TypeScript errors
- [ ] All listed interfaces are exported from `index.ts`
- [ ] Package has no imports from other `@clubhub/*` packages
- [ ] No runtime logic — types only
- [ ] `MachineState` includes `RECOVERED_BUT_UNTRUSTED` as a valid state value
**Complexity:** 2

---

### S0-03
**Epic:** EPIC-0
**As a** developer, **I want to** have a typed fetch wrapper that parses the API response envelope and rejection types **so that** all API calls get consistent error handling.
**Technical notes:** Typed fetch wrapper in `@clubhub/api`: unwraps `{ data, meta }` envelope, parses `{ error: { code, message, rejection } }` error envelope. `ApiError` class with `rejectionType: RejectionType | null`. `isApiError(e)` type guard. All timestamps returned as ISO strings — never modified client-side.
**Dependencies:** S0-02
**Acceptance criteria:**
- [ ] Unit test: 200 response with `{ data: {...} }` envelope → returns `data` payload
- [ ] Unit test: 409 response with rejection `CONCURRENCY_CONFLICT` → throws `ApiError` with `rejectionType: 'CONCURRENCY_CONFLICT'`
- [ ] Unit test: 403 with `AUTHORITY_BOUNDARY` rejection → `rejectionType: 'AUTHORITY_BOUNDARY'`
- [ ] `isApiError(e)` correctly narrows type in a catch block
- [ ] Timestamps in returned data are untouched ISO strings — not converted to Date objects
**Complexity:** 2

---

### S0-04
**Epic:** EPIC-0
**As a** developer, **I want to** have a singleton WebSocket client with automatic reconnection **so that** real-time events are reliably delivered to the frontend.
**Technical notes:** `RealtimeClient` class in `@clubhub/api`: `connect(token)`, `disconnect()`, `subscribe(venue_ids)`, `on(event, handler)`, `off(event, handler)`. Parses messages as `{ event, payload, sequence_number, timestamp }`. Reconnect: exponential backoff 1s / 2s / 4s / 8s / 16s / 30s cap, unlimited retries. On reconnect: re-subscribe to all previously subscribed entities. Application-level heartbeat: ping every 25s, treat no pong within 10s as disconnect.
**Dependencies:** S0-02
**Acceptance criteria:**
- [ ] Unit test with fake timers: client reconnects after close with correct backoff timing (1s, 2s, 4s, 8s, 16s, 30s, 30s, ...)
- [ ] Unit test: client re-subscribes to all previously subscribed venue IDs on reconnect
- [ ] Unit test: registered handler receives correctly parsed payload object on message
- [ ] Unit test: `off(event, handler)` removes the handler so it is no longer called
- [ ] Application-level heartbeat: ping sent every 25s; if no pong within 10s, client enters reconnect flow
**Complexity:** 3

---

### S0-05
**Epic:** EPIC-0
**As a** developer, **I want to** have shared Zustand stores and React Query configuration **so that** auth state, UI state, and WebSocket connection state are accessible from any component.
**Technical notes:** `QueryClient` in `@clubhub/state` with stale times: venues 10s, incidents 5s, systemHealth 15s, deliveryConfidence 30s; retry: 1. `authStore` (AuthState). `uiStore` (UIState: `selected_venue_id`, `zone_c_collapsed`, `active_surface`, `training_mode`, `prior_surface`). `wsStore` (WsState: `connection_state`, `subscribed_venue_ids`). Export typed `useAuthStore`, `useUIStore`, `useWSStore` hooks.
**Dependencies:** S0-02
**Acceptance criteria:**
- [ ] Unit test: `authStore.setAuth(identity)` → `useAuthStore().role` equals `identity.role`
- [ ] Unit test: `uiStore.setSelectedVenue('v-001')` → `useUIStore().selected_venue_id` equals `'v-001'`
- [ ] Unit test: `wsStore.setConnectionState('RECONNECTING')` → `useWSStore().connection_state` equals `'RECONNECTING'`
- [ ] `QueryClient` stale times match specification for each query key
- [ ] All three stores are independently importable and do not share state unintentionally
**Complexity:** 2

---

### S0-06
**Epic:** EPIC-0
**As an** operator, **I want to** be redirected to login if I am not authenticated **so that** unauthorized users cannot access the CMS.
**Technical notes:** React Router v6 `createBrowserRouter`. Routes: `/` → redirect to `/ops/live`, `/login` → LoginPage, `/ops/live` → AuthGuard → ShellLayout → LiveOpsVenueView (stub), `/ops/incidents/:id` → stub, `/ops/venues/:venue_id` → stub, `/ops/cms` → stub, `/ops/replay/:session_id` → stub. `AuthGuard`: reads authStore; if null → redirect to `/login?return_to=currentPath`.
**Dependencies:** S0-05
**Acceptance criteria:**
- [ ] Unauthenticated visit to `/ops/live` → redirect to `/login?return_to=/ops/live`
- [ ] Unauthenticated visit to `/ops/incidents/123` → redirect to `/login?return_to=/ops/incidents/123`
- [ ] Authenticated visit to `/ops/live` → renders ShellLayout shell without redirect
- [ ] `/` → redirect to `/ops/live`
- [ ] All stub routes render without error for authenticated users
**Complexity:** 2

---

### S0-07
**Epic:** EPIC-0
**As a** developer, **I want to** have the zone layout render **so that** surfaces can be developed in context.
**Technical notes:** ShellLayout: SystemStatusBar (48px top, `position: sticky`), flex row below: ZoneA (280px fixed width), main Zone B (`flex-grow`, `overflow-y: auto`), ZoneC (320px, collapsible to 48px). All zones render placeholder content. Zone B uses `<Outlet />` from React Router. ZoneC toggle button updates `uiStore.zone_c_collapsed`.
**Dependencies:** S0-06
**Acceptance criteria:**
- [ ] ShellLayout renders all 4 zones (SystemStatusBar, ZoneA, Zone B, ZoneC)
- [ ] ZoneC toggles between 320px and 48px width when collapse button clicked
- [ ] `uiStore.zone_c_collapsed` reflects collapse state
- [ ] Zone B renders `<Outlet />` child route content
- [ ] SystemStatusBar is sticky at the top and does not scroll away
**Complexity:** 2

---

### S0-08
**Epic:** EPIC-0
**As a** developer, **I want to** have CI block merges with type errors, lint failures, or test failures **so that** the codebase stays clean.
**Technical notes:** GitHub Actions (or equivalent): `pnpm -r type-check`, `pnpm -r lint` (ESLint with `@typescript-eslint` + `local/no-write-control-without-replay-guard` rule stub), `pnpm -r test`. All 3 must pass for PR to merge. Add `turbo run type-check lint test` as the CI command.
**Dependencies:** S0-01
**Acceptance criteria:**
- [ ] CI runs on every pull request
- [ ] A PR with a TypeScript error blocks merge
- [ ] A PR with a failing test blocks merge
- [ ] A PR with an ESLint violation blocks merge
- [ ] `pnpm -r test` runs all package unit tests
**Complexity:** 2

---

## EPIC-1: Venue Health Monitoring

### S1-01
**Epic:** EPIC-1
**As an** operator, **I want to** log in with my credentials **so that** I can access the CMS.
**Technical notes:** LoginPage: email + password form. `POST /auth/login` → receive JWT. Store JWT in memory (not localStorage). Decode role from JWT claims or from `GET /operators/me` response. Set authStore with `role`, `operator_id`, `display_name`. Redirect to `return_to` query param or `/ops/live` on success.
**Dependencies:** S0-06
**Acceptance criteria:**
- [ ] Successful login → `authStore` has `role`, `operator_id`, `display_name`
- [ ] Redirect to `return_to` param after login if present; otherwise redirect to `/ops/live`
- [ ] Failed login (401) → inline error message displayed below the form
- [ ] JWT stored in memory only — not in localStorage or sessionStorage
- [ ] Form submit is disabled (loading state) while POST is in flight
**Complexity:** 2

---

### S1-02
**Epic:** EPIC-1
**As an** operator, **I want to** see all venues I have access to in the left nav **so that** I can select a venue to monitor.
**Technical notes:** `useVenues()` hook → `useQuery(['venues'], getVenues, { staleTime: 10000 })`. `ZoneAVenueSelector`: renders venue name + `MachineStateDot` per venue. Loading state: skeleton list items. Error state: "Failed to load venues — [Retry]". [Retry] calls `refetch()`.
**Dependencies:** S0-05, S1-01
**Acceptance criteria:**
- [ ] Zone A shows venue list after successful login
- [ ] Each entry has venue name and a `MachineStateDot` reflecting current machine state
- [ ] Loading skeleton shown while fetching (before data resolves)
- [ ] Error state + [Retry] button shown on network failure
- [ ] [Retry] button triggers refetch
**Complexity:** 2

---

### S1-03
**Epic:** EPIC-1
**As an** operator, **I want to** see Zone A venue dots show correct colors for each machine state **so that** I can triage venue health at a glance.
**Technical notes:** `MachineStateDot` component: `LIVE` → `#558B2F` solid circle; `OFFLINE` → `#9E9E9E`; `DEGRADED` → `#F59E0B`; `INCIDENT` → `#E64A19`; `RECOVERED_BUT_UNTRUSTED` → `#FB923C` with CSS `animation: spin 1.5s linear infinite` on ↻ character (PATCH-007); `INITIALIZING` / `SYNCING` → `#9E9E9E` pulsing opacity.
**Dependencies:** S1-02
**Acceptance criteria:**
- [ ] Unit test: `machine_state='LIVE'` → dot color `#558B2F`, no animation class
- [ ] Unit test: `machine_state='OFFLINE'` → dot color `#9E9E9E`
- [ ] Unit test: `machine_state='DEGRADED'` → dot color `#F59E0B`
- [ ] Unit test: `machine_state='INCIDENT'` → dot color `#E64A19`
- [ ] Unit test: `machine_state='RECOVERED_BUT_UNTRUSTED'` → ↻ character rendered, color `#FB923C`, spin animation class present
- [ ] Unit test: `machine_state='INITIALIZING'` → `#9E9E9E` with pulsing opacity class
**Complexity:** 1

---

### S1-04
**Epic:** EPIC-1
**As an** operator, **I want to** click a venue and see its health detail in Zone B **so that** I can investigate a specific venue.
**Technical notes:** Click in `ZoneAVenueSelector` → `uiStore.setSelectedVenue(venue_id)` → navigate to `/ops/live` (venue_id in URL state or query param). `LiveOpsVenueView` reads `selected_venue_id` from uiStore → calls `useVenueDetail(venue_id)`.
**Dependencies:** S1-02, S0-07
**Acceptance criteria:**
- [ ] Clicking a venue in Zone A renders venue detail in Zone B
- [ ] URL reflects selected venue (via query param or state)
- [ ] `uiStore.selected_venue_id` is updated to the clicked venue's ID
- [ ] Back navigation (browser back) preserves the previously selected venue
- [ ] `LiveOpsVenueView` calls `useVenueDetail` with the correct `venue_id`
**Complexity:** 2

---

### S1-05
**Epic:** EPIC-1
**As an** operator, **I want to** see the venue name and current machine state prominently at the top of Zone B **so that** I know which venue I am managing.
**Technical notes:** `VenueIdentityHeader`: venue name (h1), location subtitle, `MachineStateBadge`, screen count chip. Non-scrolling — sticky at Zone B top. `RECOVERED_BUT_UNTRUSTED` → `MachineStateBadge` renders a single amber pill reading "LIVE — UNVERIFIED" (PATCH-009 — single pill, not two separate badges).
**Dependencies:** S1-04, S0-02
**Acceptance criteria:**
- [ ] `VenueIdentityHeader` renders venue name as h1 element
- [ ] Location subtitle is displayed below the venue name
- [ ] Screen count chip is rendered
- [ ] `RECOVERED_BUT_UNTRUSTED` → single amber pill text reads "LIVE — UNVERIFIED"
- [ ] Header does not scroll away as Zone B content scrolls (sticky positioning confirmed)
- [ ] `MachineStateBadge` for `LIVE` state renders a green badge
**Complexity:** 2

---

### S1-06
**Epic:** EPIC-1
**As an** operator, **I want to** see player status and signal quality cards **so that** I can assess venue hardware health.
**Technical notes:** `PlayerHealthSection`: "PLAYER STATUS" text label (PATCH-019) above 4 `PlayerHealthCard` components from `player_cards` array in API response; "SIGNAL QUALITY" text label above 3 `PlayerHealthCard` components from `signal_cards` array. `PlayerHealthCard`: label, value, status indicator dot (green / amber / red). Data from `useVenuePlayerHealth(venue_id)`.
**Dependencies:** S1-04
**Acceptance criteria:**
- [ ] "PLAYER STATUS" text label renders above the 4 player cards
- [ ] 4 `PlayerHealthCard` components render in the player status section
- [ ] "SIGNAL QUALITY" text label renders above the 3 signal cards
- [ ] 3 `PlayerHealthCard` components render in the signal quality section
- [ ] Each card's status indicator dot color matches the `status` field (green for healthy, amber for warning, red for error)
- [ ] Card label and value text match API response fields
**Complexity:** 2

---

### S1-07
**Epic:** EPIC-1
**As an** operator, **I want to** see the System Status Bar show current constitutional state **so that** I can see platform-wide health at all times.
**Technical notes:** `SystemStatusBar`: reads `useSystemHealth()`. Renders `constitutional_state` as label + color: `HEALTHY` → green; `DEGRADED` → amber; `CONSTITUTIONAL_RISK` / `EMERGENCY_FREEZE` → red. Renders 6 status indicator pills from `status_bar` record in API response. Always visible (sticky top, z-index 1000).
**Dependencies:** S0-07, S0-05
**Acceptance criteria:**
- [ ] Status bar renders `constitutional_state` label with correct color for HEALTHY (green)
- [ ] Status bar renders `constitutional_state` label with correct color for DEGRADED (amber)
- [ ] Status bar renders `constitutional_state` label with correct color for CONSTITUTIONAL_RISK (red)
- [ ] Status bar renders `constitutional_state` label with correct color for EMERGENCY_FREEZE (red)
- [ ] 6 status indicator pills render from the `status_bar` record
- [ ] Status bar remains visible during Zone B scroll (z-index 1000, sticky top)
**Complexity:** 2

---

### S1-08
**Epic:** EPIC-1
**As an** operator, **I want to** see Zone A venue dots update in real-time when venue state changes **so that** I always see current state without refreshing.
**Technical notes:** `RealtimeProvider` wraps app. On `VENUE_STATE_UPDATE` event: call `venueStateUpdateHandler(payload, queryClient)` — `queryClient.setQueryData(['venues'], (old) => old.map(v => v.venue_id === payload.venue_id ? { ...v, ...payload } : v))`. Check `sequence_number` before applying — discard if `payload.sequence_number` < cached venue's `sequence_number`.
**Dependencies:** S1-02, S0-04
**Acceptance criteria:**
- [ ] Integration test (MSW WebSocket): fire `VENUE_STATE_UPDATE` → Zone A dot re-renders with new `machine_state` color within 1 render cycle
- [ ] Fire event with lower `sequence_number` → Zone A does NOT update (stale event discarded)
- [ ] `RealtimeProvider` is mounted at app root and provides the `RealtimeClient` instance via context
- [ ] Cache update is applied optimistically (no network refetch required)
- [ ] All venue entries in Zone A update independently based on `venue_id` matching
**Complexity:** 3

---

### S1-09
**Epic:** EPIC-1
**As an** operator, **I want to** see `RECOVERED_BUT_UNTRUSTED` venues display distinctly from LIVE and DEGRADED **so that** I know a venue is not yet safe to operate.
**Technical notes:** Zone A: ↻ spinning `#FB923C` dot (PATCH-007). Zone B `MachineStateBadge`: amber "LIVE — UNVERIFIED" single pill (PATCH-009). `InterventionSurface`: `canPlaceOverride(venue)` returns false when `machine_state === 'RECOVERED_BUT_UNTRUSTED'` → override controls absent from DOM (not `disabled` — fully absent). Triggered by `VENUE_STATE_UPDATE` with `machine_state=RECOVERED_BUT_UNTRUSTED`.
**Dependencies:** S1-08, S1-05
**Acceptance criteria:**
- [ ] HF-REG-005 passes: override controls absent from DOM (not `disabled`) when venue is `RECOVERED_BUT_UNTRUSTED`
- [ ] DOM inspection confirms no `[data-testid="override-button"]` in document when in this state
- [ ] Zone A dot is ↻ icon with orange color `#FB923C` and spin animation
- [ ] Zone B badge reads "LIVE — UNVERIFIED" in a single amber pill
- [ ] State triggered correctly via `VENUE_STATE_UPDATE` WS event
**Complexity:** 2

---

### S1-10
**Epic:** EPIC-1
**As an** operator, **I want to** see a "reconnecting" indicator when real-time updates pause **so that** I know when my view may be stale.
**Technical notes:** `wsStore.connection_state` drives `SystemStatusBar` reconnect indicator. If `RECONNECTING` or `FAILED` → amber non-blocking indicator appended to Status Bar: "Real-time updates paused — reconnecting...". Disappears when `CONNECTED` restored. Does not block interaction — not a modal, not an overlay.
**Dependencies:** S1-07, S0-04
**Acceptance criteria:**
- [ ] Simulate WS disconnect (close in test) → amber "Real-time updates paused — reconnecting..." indicator appears in Status Bar
- [ ] Simulate reconnect → indicator disappears
- [ ] Indicator is non-blocking — all Zone A, Zone B, Zone C controls remain interactive while indicator is visible
- [ ] Indicator is part of the Status Bar, not a modal or full-screen overlay
- [ ] `wsStore.connection_state` drives the indicator (not a local component state)
**Complexity:** 2

---

## EPIC-2: Incident Read-Only Monitoring

### S2-01
**Epic:** EPIC-2
**As an** operator, **I want to** see all active incidents in Zone A **so that** I can triage which incidents require attention.
**Technical notes:** `ZoneAIncidentList`: reads `useQuery(['incidents', 'active'], getActiveIncidents)`. Renders one entry per incident: venue name + `SeverityBadge` (PATCH-004 colors). Sorted by severity (S1 first). Clicking an entry navigates to `/ops/incidents/{id}`.
**Dependencies:** S1-02
**Acceptance criteria:**
- [ ] Incident list shows a `SeverityBadge` for each active incident
- [ ] Incidents are sorted S1 → S5 (most severe first)
- [ ] Clicking an incident entry navigates to `/ops/incidents/{id}`
- [ ] `INCIDENT_CREATED` WS event adds a new entry to the list without page refresh
- [ ] Empty state shown when no active incidents
**Complexity:** 2

---

### S2-02
**Epic:** EPIC-2
**As an** operator, **I want to** see incident details (severity, duration, commander) when I navigate to an incident **so that** I understand the current state.
**Technical notes:** Route `/ops/incidents/:id` → IC surface. `IncidentIdentityBar` (72px height): `SeverityBadge`, incident ID, venue name, duration clock (counts up from `incident.created_at` — server-provided timestamp), commander identity ("No commander assigned" if null). Duration derived entirely from server timestamp, not `Date.now()`.
**Dependencies:** S2-01, S0-06
**Acceptance criteria:**
- [ ] `IncidentIdentityBar` renders `SeverityBadge` with correct color for the incident's severity level
- [ ] Incident ID is displayed
- [ ] Venue name is displayed
- [ ] Duration clock increments from server-provided `created_at` timestamp
- [ ] "No commander assigned" is shown when no commander is set
- [ ] Commander display name is shown when a commander is set
**Complexity:** 2

---

### S2-03
**Epic:** EPIC-2
**As an** operator, **I want to** navigate between incident tabs **so that** I can access different aspects of incident management.
**Technical notes:** `ICTabSystem`: Tab 1 Overview, Tab 2 Shift Notes (✎ icon when notes present — PATCH-008), Tab 3 Override Inventory (red dot when overrides active — PATCH-010), Tab 4 PRE Divergence (amber dot when divergence active), Tab 5 Transitions (green dot when transitions available — PATCH-010), Tab 6 Evidence (ADMIN only — absent from DOM for non-ADMIN). `TabBadge` components per tab. Active tab via local state.
**Dependencies:** S2-02
**Acceptance criteria:**
- [ ] Tab navigation switches Zone B content between tab views
- [ ] Tab 6 is absent from DOM entirely for OPERATOR role (not just hidden)
- [ ] Tab 6 is absent from DOM for CONTENT_MANAGER role
- [ ] Tab 6 is absent from DOM for VIEWER role
- [ ] Tab 2 shows ✎ icon on the tab label when notes content is non-empty
- [ ] PATCH-010 tab badge dots: red on Tab 3 when overrides active, amber on Tab 4 when PRE divergence active, green on Tab 5 when transitions available
**Complexity:** 2

---

### S2-04
**Epic:** EPIC-2
**As an** operator, **I want to** read full incident details in Tab 1 **so that** I understand the incident context.
**Technical notes:** Tab 1 content: incident description, severity display (read-only — severity change controls are in a later epic), incident state (`ACTIVE` / `RESOLVING` / `CLOSED`), `opened_at` timestamp (formatted from server ISO string in local timezone), affected venue, affected screens count. All data from `useIncident(incident_id)`.
**Dependencies:** S2-03
**Acceptance criteria:**
- [ ] Tab 1 renders incident description text
- [ ] Severity is displayed as read-only (no edit controls)
- [ ] Incident state (`ACTIVE` / `RESOLVING` / `CLOSED`) is displayed
- [ ] `opened_at` timestamp is formatted in local timezone from server ISO string
- [ ] Affected venue name is shown
- [ ] Affected screens count is shown
- [ ] No write controls are present in Tab 1 at this stage
**Complexity:** 1

---

### S2-05
**Epic:** EPIC-2
**As an** operator, **I want to** see shift notes that persist across sessions **so that** I have context from previous shifts.
**Technical notes:** `ShiftNotesTab` (Tab 2): fetches from `GET /incidents/{id}/notes`. Renders server-persisted notes in a textarea. ✎ icon on Tab 2 label when notes content is non-empty (PATCH-008). If notes empty, textarea shows placeholder "No shift notes yet." Textarea is editable — save is wired in S3-05.
**Dependencies:** S2-03
**Acceptance criteria:**
- [ ] Tab 2 fetches and displays existing notes from server via `GET /incidents/{id}/notes`
- [ ] ✎ icon on Tab 2 label when content is non-empty
- [ ] Textarea shows "No shift notes yet." placeholder when notes are empty
- [ ] Textarea is editable (typing works) — save is deferred to S3-05
- [ ] Notes content is displayed as-is from server (no truncation)
**Complexity:** 1

---

### S2-06
**Epic:** EPIC-2
**As an** operator, **I want to** see a Level 1 alert when no commander has been assigned for 15 minutes **so that** incidents are never left ungoverned.
**Technical notes:** `COMMANDER_LAPSED` WS event: `{ incident_id, lapsed_at }`. Store `lapsed_at` in incident state. `CommanderLapsedAlert` renders when `lapsed_at` is set: "COMMANDER LAPSED" Level 1 alert, time-since-lapse computed from server `lapsed_at` (not `Date.now()`). PATCH-012: "Currently viewing: N operators — [Notify all →]" link. [Notify all →] fires `POST /incidents/{id}/commander/notify`; 60s cooldown after fire.
**Dependencies:** S2-02
**Acceptance criteria:**
- [ ] `COMMANDER_LAPSED` WS event → `CommanderLapsedAlert` renders with "COMMANDER LAPSED" heading
- [ ] Time-since-lapse is computed from server-provided `lapsed_at` timestamp (not local `Date.now()`)
- [ ] "Currently viewing: N operators" count is displayed per PATCH-012
- [ ] "[Notify all →]" link is present
- [ ] Clicking "[Notify all →]" fires `POST /incidents/{id}/commander/notify`
- [ ] Clicking twice within 60s results in only one POST call (second click blocked during cooldown)
**Complexity:** 3

---

### S2-07
**Epic:** EPIC-2
**As an** OPERATOR, **I want to** be automatically brought to the Incident Command surface when an S1/S2 emergency fires **so that** I can respond immediately.
**Technical notes:** `ZoneBAutoReplace`: listens for `ZONE_B_AUTO_REPLACE` WS event (only fires for S1/S2 severity). On event: save current surface to `uiStore.prior_surface`; set `uiStore.active_surface` to IC; navigate to `/ops/incidents/{incident_id}`. Render PATCH-014 banner at Zone B bottom: "You were automatically brought here — [View Venue Dashboard →]". Banner links to `uiStore.prior_surface`. Only applies to OPERATOR, CONTENT_MANAGER, ADMIN roles — not VIEWER.
**Dependencies:** S2-02, S0-05
**Acceptance criteria:**
- [ ] HF-REG-010 passes
- [ ] `ZONE_B_AUTO_REPLACE` WS event triggers route change to IC surface
- [ ] Prior surface is saved to `uiStore.prior_surface` before navigation
- [ ] PATCH-014 banner renders at Zone B bottom: "You were automatically brought here — [View Venue Dashboard →]"
- [ ] "[View Venue Dashboard →]" link navigates back to the prior surface
- [ ] VIEWER sessions: `ZONE_B_AUTO_REPLACE` event does NOT trigger auto-navigation
**Complexity:** 3

---

### S2-08
**Epic:** EPIC-2
**As an** operator, **I want to** see what incident state transitions are available **so that** I understand my options.
**Technical notes:** Tab 5: `GET /incidents/{id}/transitions`. Renders list of available transition types with description text. Write controls (apply transition buttons) are stubs only at this stage — wired in EPIC-4. Green dot badge on Tab 5 label when transitions are available (PATCH-010).
**Dependencies:** S2-03
**Acceptance criteria:**
- [ ] Tab 5 renders the transitions list fetched from `GET /incidents/{id}/transitions`
- [ ] Each transition entry displays transition type and description text
- [ ] Green dot badge appears on Tab 5 label when at least one transition is available
- [ ] No write controls are functional at this stage (stubs only)
- [ ] Empty state shown when no transitions are available
**Complexity:** 1

---

## EPIC-3: Commander Claim

### S3-01
**Epic:** EPIC-3
**As an** OPERATOR, **I want to** see incident context before claiming command **so that** I know what I am taking responsibility for.
**Technical notes:** `AssumeCommandConfirmCard`: renders when no commander is assigned AND role is OPERATOR or above. PATCH-003 context strip (read-only): severity badge, incident ID, venue name, duration, time since `COMMANDER_LAPSED` (if active). [Confirm — Assume Command] button. [Cancel] link. Entirely absent from DOM for VIEWER role.
**Dependencies:** S2-02
**Acceptance criteria:**
- [ ] Context strip shows severity badge, incident ID, venue name, and duration
- [ ] Time since `COMMANDER_LAPSED` shown on the context strip if the lapsed state is active
- [ ] `AssumeCommandConfirmCard` is absent from DOM entirely for VIEWER role
- [ ] [Cancel] link dismisses the card without taking any action
- [ ] Card renders only when `commander === null`
**Complexity:** 2

---

### S3-02
**Epic:** EPIC-3
**As an** OPERATOR, **I want to** click [Assume Command] and have it confirmed **so that** I can take responsibility for an incident.
**Technical notes:** [Confirm] → `POST /incidents/{id}/commander/claim` (no payload). On success → `COMMANDER_CLAIMED` WS event received → `queryClient.invalidateQueries(['incident', id])` → `IncidentIdentityBar` shows new commander name. `AssumeCommandConfirmCard` closes. NO optimistic update — wait for WS event. Pending state shown while in flight.
**Dependencies:** S3-01
**Acceptance criteria:**
- [ ] Clicking [Confirm] calls `POST /incidents/{id}/commander/claim` exactly once
- [ ] `COMMANDER_CLAIMED` WS event → commander name appears in `IncidentIdentityBar`
- [ ] `AssumeCommandConfirmCard` is no longer rendered after successful claim
- [ ] No optimistic update — card remains visible in pending state until WS event arrives
- [ ] Loading state is shown on the button while POST is in flight
**Complexity:** 2

---

### S3-03
**Epic:** EPIC-3
**As an** OPERATOR, **I want to** see a clear error if another operator claimed command at the same time **so that** I know who holds command.
**Technical notes:** POST returns 409 with `rejection.type: 'CONCURRENCY_CONFLICT'`. `RejectionToast` renders: amber border, 8s persistence, message from `rejection.message`. `REJECTION_STATE_PUSH` WS event arrives → update incident state with correct commander. `IncidentIdentityBar` shows the winning commander within 2s.
**Dependencies:** S3-02, S0-03
**Acceptance criteria:**
- [ ] HF-REG-009 (CONCURRENCY_CONFLICT path) passes
- [ ] 409 response → `RejectionToast` renders with amber border
- [ ] Toast persists for 8 seconds then auto-dismisses
- [ ] `REJECTION_STATE_PUSH` WS event → `IncidentIdentityBar` shows correct winning commander
- [ ] Winning commander identity updates within 2s of the conflict response
**Complexity:** 2

---

### S3-04
**Epic:** EPIC-3
**As the** current commander, **I want to** release command **so that** another operator can take over.
**Technical notes:** When the current operator is the commander: [Release Command] button is visible (OPERATOR+ and `is_commander` flag true). Click → confirmation dialog: "Release command? Another operator must claim command." → [Confirm Release] → `DELETE /incidents/{id}/commander`. On success → `COMMANDER_RELEASED` WS event → `IncidentIdentityBar` shows "No commander". NO optimistic update.
**Dependencies:** S3-02
**Acceptance criteria:**
- [ ] [Release Command] button is visible only when the current session's operator is the commander
- [ ] [Release Command] button is invisible to operators who are not the current commander
- [ ] Clicking [Release Command] shows confirmation dialog
- [ ] Confirming calls `DELETE /incidents/{id}/commander`
- [ ] `COMMANDER_RELEASED` WS event → "No commander assigned" displayed in `IncidentIdentityBar`
- [ ] No optimistic update — IncidentIdentityBar does not change until WS event arrives
**Complexity:** 2

---

### S3-05
**Epic:** EPIC-3
**As an** operator, **I want to** save shift notes **so that** my investigation context persists for the next shift.
**Technical notes:** `ShiftNotesTab`: textarea reads from and writes to `PUT /incidents/{id}/notes`. Save on blur or explicit [Save] button. If content is non-empty, show [Clear] button; [Clear] resets textarea and calls `PUT` with empty string. ✎ icon on Tab 2 label persists across sessions (server-stored, not sessionStorage).
**Dependencies:** S2-05
**Acceptance criteria:**
- [ ] Typing in textarea then blurring → `PUT /incidents/{id}/notes` called with current content
- [ ] [Clear] button visible when textarea is non-empty
- [ ] [Clear] → `PUT` with empty string → ✎ icon removed from Tab 2 label
- [ ] Page reload after saving → Tab 2 shows same content (server-persisted, not client-only)
- [ ] ✎ icon on Tab 2 reflects server state, not in-memory or sessionStorage state
**Complexity:** 2

---

### S3-06
**Epic:** EPIC-3
**As an** operator viewing a lapsed incident, **I want to** notify all access-holders once every 60 seconds **so that** someone claims command without spamming notifications.
**Technical notes:** [Notify all →] calls `POST /incidents/{id}/commander/notify`. On 200: button shows "Notified — [Ns remaining]" countdown, reverts to [Notify all →] after 60s. On 429 (cooldown active): show "Notification sent recently — try again in [Ns]". Cooldown state tracked locally (UX must show countdown). Server emits audit event `COMMANDER_LAPSED_NOTIFY_SENT`.
**Dependencies:** S2-06
**Acceptance criteria:**
- [ ] Clicking [Notify all →] fires `POST /incidents/{id}/commander/notify`
- [ ] On 200: button text changes to "Notified — [Ns remaining]" with live countdown
- [ ] After 60s: button reverts to "[Notify all →]"
- [ ] Second click within 60s → 429 handled → "Notification sent recently — try again in [Ns]" shown
- [ ] Cooldown countdown is visible in the UI (not just blocked interaction)
**Complexity:** 2

---

### S3-07
**Epic:** EPIC-3
**As an** operator, **I want to** see the current commander update in real-time across all open sessions **so that** there is no split-brain.
**Technical notes:** `COMMANDER_CLAIMED` and `COMMANDER_RELEASED` WS events: update React Query cache for the incident. All sessions subscribed to the incident receive the push. `REJECTION_STATE_PUSH` from claim conflict: also updates the commander field. Verify in E2E-002 scenario.
**Dependencies:** S3-02, S3-04
**Acceptance criteria:**
- [ ] `COMMANDER_CLAIMED` WS event → all subscribed sessions update `IncidentIdentityBar` within 2 render cycles
- [ ] `COMMANDER_RELEASED` WS event → all subscribed sessions show "No commander assigned" within 2 render cycles
- [ ] `REJECTION_STATE_PUSH` event updates the commander field in the React Query cache
- [ ] E2E-002 scenario passes
- [ ] Multiple sessions simultaneously subscribed to same incident each update correctly
**Complexity:** 3

---

## EPIC-4: L6 Override Lifecycle

### S4-01
**Epic:** EPIC-4
**As a** developer, **I want to** have a reusable 3-step sequential confirmation component **so that** irreversible L6 actions require deliberate multi-step confirmation.
**Technical notes:** `SequentialChipSelect`: props: `steps: Array<{ label, confirmLabel }>`, `onAllStepsConfirmed`, `onReset?`. Internal state: `confirmedSteps: number`. Step N is clickable only if `confirmedSteps >= N-1`. All steps reset on unmount (`useEffect` cleanup calls `onReset` if provided). Final action button is absent from DOM until `confirmedSteps === steps.length`.
**Dependencies:** S0-02
**Acceptance criteria:**
- [ ] HF-REG-001 passes
- [ ] Step 2 chip is not clickable until step 1 is confirmed
- [ ] Step 3 chip is not clickable until step 2 is confirmed
- [ ] Final action button is absent from DOM until all steps are confirmed (not just `disabled`)
- [ ] Unmounting the component resets `confirmedSteps` to 0 (cleanup fires)
- [ ] Unit test: render with 3 steps, confirm all 3 → `onAllStepsConfirmed` called exactly once
**Complexity:** 3

---

### S4-02
**Epic:** EPIC-4
**As an** OPERATOR, **I want to** place an L6 override using a 3-step confirmation **so that** emergency overrides require deliberate action.
**Technical notes:** `L6OverridePlacementFlow`: renders `SequentialChipSelect` with 3 steps: (1) "I confirm this override is necessary", (2) "I confirm this affects venue-wide content delivery", (3) "I confirm this action cannot be undone without a separate removal action". On all steps confirmed: [Place L6 Override] button appears → click → `POST /incidents/{id}/overrides/l6` with `{ confirmation_steps_completed: 3 }`. Absent from DOM for VIEWER.
**Dependencies:** S4-01, S3-02
**Acceptance criteria:**
- [ ] 3 steps must be completed in sequence before [Place L6 Override] button appears
- [ ] [Place L6 Override] button is absent from DOM until all 3 steps are confirmed
- [ ] POST payload includes `confirmation_steps_completed: 3`
- [ ] VIEWER role: no [Place Override] button present in DOM
- [ ] VIEWER role: no `SequentialChipSelect` rendered
**Complexity:** 2

---

### S4-03
**Epic:** EPIC-4
**As an** operator, **I want to** see the new override appear in Tab 3 immediately after placement **so that** I know the override is active.
**Technical notes:** `OVERRIDE_PLACED` WS event: append override to React Query cache for `['incident', id, 'overrides']`. Tab 3 red dot badge fires (PATCH-010: `TabBadge` type="red" on Tab 3 label). If Tab 3 is open: new entry appears with 300ms `#FBC02D` highlight pulse. NO optimistic update — wait for WS event.
**Dependencies:** S4-02, S2-03
**Acceptance criteria:**
- [ ] `OVERRIDE_PLACED` WS event → Tab 3 list updates with new override entry
- [ ] Tab 3 red dot badge appears on the tab label
- [ ] 300ms `#FBC02D` highlight pulse fires on the new entry when Tab 3 is open
- [ ] No optimistic addition before WS event — override does not appear until server confirms
- [ ] Override entry persists in Tab 3 list across tab switches
**Complexity:** 2

---

### S4-04
**Epic:** EPIC-4
**As an** OPERATOR, **I want to** see a conflict error if another operator placed an override at the same time **so that** I know what actually happened.
**Technical notes:** `POST /overrides/l6` returns 409 with `CONCURRENCY_CONFLICT` rejection. `RejectionToast`: amber border, 8s. `REJECTION_STATE_PUSH` arrives: updates Tab 3 with the winning override entry + 300ms `#FBC02D` highlight pulse on the winning entry.
**Dependencies:** S4-02, S3-03
**Acceptance criteria:**
- [ ] 409 response → `RejectionToast` renders within 1 render cycle
- [ ] Toast has amber border and persists 8 seconds
- [ ] `REJECTION_STATE_PUSH` → Tab 3 is updated with the winning override entry
- [ ] 300ms `#FBC02D` highlight pulse fires on the winning override entry in Tab 3
- [ ] Tab 3 red dot badge fires on the winning entry
**Complexity:** 2

---

### S4-05
**Epic:** EPIC-4
**As an** OPERATOR, **I want to** see a modal explaining why my override was blocked **so that** I can understand the governance constraint.
**Technical notes:** POST returns 403 with `AUTHORITY_BOUNDARY` rejection. `RejectionToast` renders as modal (not a toast): title "Action blocked — governance constraint", body from `rejection.message`, "[Understood]" button. Modal is blocking — no background interaction until dismissed.
**Dependencies:** S4-02
**Acceptance criteria:**
- [ ] 403 `AUTHORITY_BOUNDARY` → modal renders (not a toast notification)
- [ ] Modal title reads "Action blocked — governance constraint"
- [ ] Modal body contains the `rejection.message` from the server
- [ ] "[Understood]" button is present
- [ ] Clicking "[Understood]" closes the modal
- [ ] Background interaction is blocked while the modal is open
- [ ] HF-REG-009 (AUTHORITY_BOUNDARY path) passes
**Complexity:** 2

---

### S4-06
**Epic:** EPIC-4
**As an** OPERATOR, **I want to** see a specific message when PRE prevents my override **so that** I understand the resolution hierarchy.
**Technical notes:** POST returns 422 with `PRE_CONSTRAINT` rejection. `RejectionToast` renders toast: amber border, 8s persistence, "[View PRE state →]" link. PRE state push: Zone B Section 3 (Content & PRE) updates to show current PRE level via `REJECTION_STATE_PUSH`.
**Dependencies:** S4-02
**Acceptance criteria:**
- [ ] 422 `PRE_CONSTRAINT` → amber-bordered toast renders
- [ ] Toast persists 8 seconds
- [ ] "[View PRE state →]" link is present in the toast
- [ ] Zone B Content & PRE section updates via `REJECTION_STATE_PUSH` with current PRE level
- [ ] Toast is a non-blocking notification (not a modal)
**Complexity:** 2

---

### S4-07
**Epic:** EPIC-4
**As a** developer, **I want to** have a reusable hold-to-confirm button **so that** irreversible removal actions require a sustained deliberate hold.
**Technical notes:** `HoldToConfirmButton`: props: `onConfirm`, `label`, `holdDuration? = 3000`, `disabled?`, `variant: 'danger'|'warning'`. Internal: `holding: boolean`, `elapsed: number`. Progress arc: SVG or conic-gradient showing `elapsed/holdDuration`. Fires `onConfirm` after `holdDuration` ms of continuous hold. Mouseup/touchend before `holdDuration` → cancel, reset elapsed. `disabled` prop → no hold starts.
**Dependencies:** S0-02
**Acceptance criteria:**
- [ ] HF-REG-002 passes
- [ ] Single click (no hold) does not fire `onConfirm`
- [ ] Partial hold (mouseup before 3s) does not fire `onConfirm` and resets progress arc
- [ ] Full 3s continuous hold fires `onConfirm` exactly once
- [ ] Progress arc is visible and animates during hold
- [ ] `disabled=true` → no hold initiates on mousedown
**Complexity:** 3

---

### S4-08
**Epic:** EPIC-4
**As an** OPERATOR, **I want to** remove an L6 override by holding a button for 3 seconds **so that** override removal is deliberate and not accidental.
**Technical notes:** `L6OverrideRemovalFlow`: renders [Remove Override] button in Tab 3 for each override entry (OPERATOR+ only). Clicking opens `HoldToConfirmButton` overlay/inline. After 3s hold → `DELETE /incidents/{id}/overrides/{override_id}`. Pointer release before 3s → reset. Absent from DOM for VIEWER.
**Dependencies:** S4-07, S2-03
**Acceptance criteria:**
- [ ] [Remove Override] button is visible for OPERATOR role in Tab 3
- [ ] [Remove Override] button is absent from DOM for VIEWER role
- [ ] Partial hold → no `DELETE` called, progress resets
- [ ] Full 3s hold → `DELETE /incidents/{id}/overrides/{override_id}` called
- [ ] HF-REG-002 passes for this flow
**Complexity:** 2

---

### S4-09
**Epic:** EPIC-4
**As an** operator, **I want to** see an override disappear from Tab 3 when it is removed **so that** I always see current override state.
**Technical notes:** `OVERRIDE_REMOVED` WS event: remove override from React Query cache by `override_id`. Tab 3 entry disappears. If no overrides remain, Tab 3 red dot clears. Cross-session: a third session viewing Tab 3 while another session removes an override receives the push and updates without page refresh.
**Dependencies:** S4-08
**Acceptance criteria:**
- [ ] `OVERRIDE_REMOVED` WS event → Tab 3 entry for that override_id is removed
- [ ] Tab 3 red dot badge clears when override list is empty
- [ ] No page refresh required — update happens via WS push to cache
- [ ] Cross-session update: a session that did not initiate the removal also updates
**Complexity:** 2

---

### S4-10
**Epic:** EPIC-4
**As a** developer, **I want to** have all L6 write controls absent from DOM for VIEWER role **so that** viewers cannot take any override actions.
**Technical notes:** `L6OverridePlacementFlow` checks `authStore.role`; if VIEWER, returns null (not `disabled={true}`). `L6OverrideRemovalFlow` same pattern. `InterventionSurface` does not render write controls for VIEWER. DOM inspection confirms absence — no `disabled` attribute on elements that should not exist at all.
**Dependencies:** S4-02, S4-08
**Acceptance criteria:**
- [ ] HF-REG-004 passes
- [ ] VIEWER role: `L6OverridePlacementFlow` returns null → absent from DOM
- [ ] VIEWER role: `L6OverrideRemovalFlow` returns null → absent from DOM
- [ ] VIEWER role: `InterventionSurface` renders no write controls
- [ ] DOM inspection: no `[data-testid="override-button"]` or similar for VIEWER session
- [ ] No `disabled` attribute on elements that should be fully absent
**Complexity:** 1

---

### S4-11
**Epic:** EPIC-4
**As an** operator, **I want to** see Tab 3 always reflect the authoritative server state **so that** I never act on stale override information.
**Technical notes:** `OVERRIDE_PLACED` and `OVERRIDE_REMOVED` events both carry `sequence_number`. Apply only if `sequence_number` > current cached value. `REJECTION_STATE_PUSH` after conflict: apply full `current_state` from server (replaces local cache entirely). `#FBC02D` 300ms highlight pulse on the entity that changed.
**Dependencies:** S4-03, S4-09
**Acceptance criteria:**
- [ ] Stale event (lower `sequence_number` than cached) is discarded — Tab 3 does not update
- [ ] `REJECTION_STATE_PUSH` replaces entire local cache with server's `current_state`
- [ ] `#FBC02D` 300ms highlight pulse fires on the entity that changed after cache replacement
- [ ] Tab 3 reflects server state after REJECTION_STATE_PUSH even if local state was different
**Complexity:** 2

---

### S4-12
**Epic:** EPIC-4
**As an** operator, **I want to** verify that shift notes survive session reload **so that** handoff information is never lost (PATCH-008).
**Technical notes:** This is a verification and regression story — not new code. Verify: `GET /incidents/{id}/notes` returns saved content after session reload. ✎ icon on Tab 2 label renders in a fresh session if notes non-empty. Content is stored server-side (not sessionStorage or localStorage). Write an integration test to confirm.
**Dependencies:** S3-05
**Acceptance criteria:**
- [ ] Page reload after saving notes → Tab 2 shows same content
- [ ] ✎ icon present on Tab 2 label in a fresh session when notes are non-empty
- [ ] Integration test: `GET /incidents/{id}/notes` in a new session returns previously saved content
- [ ] Content is confirmed to not be stored in sessionStorage or localStorage (dev tools check)
**Complexity:** 1

---

## EPIC-5: Venue Operations Surface

### S5-01
**Epic:** EPIC-5
**As an** operator, **I want to** navigate to a venue's operations view **so that** I can manage venue hardware and status.
**Technical notes:** Route `/ops/venues/:venue_id` → `VenueOpsView`. `VenueOpsHeader`: persistent non-scrolling header with venue name, `MachineStateBadge`, screen count, `AutonomyClock` (visible when `machine_state === 'OFFLINE'`). 6-tab navigation: Tab 1 Status, Tab 2 Screens, Tab 3 Corpus, Tab 4 Connectivity, Tab 5 History, Tab 6 Config (ADMIN only — absent from DOM for non-ADMIN).
**Dependencies:** S1-04, S0-06
**Acceptance criteria:**
- [ ] Route `/ops/venues/:venue_id` renders `VenueOpsView`
- [ ] `VenueOpsHeader` does not scroll as Zone B content scrolls
- [ ] Tab 6 Config is absent from DOM for OPERATOR role
- [ ] Tab 6 Config is absent from DOM for CONTENT_MANAGER and VIEWER roles
- [ ] `AutonomyClock` is visible when `machine_state === 'OFFLINE'`
- [ ] `AutonomyClock` is not rendered when venue is `LIVE`
**Complexity:** 2

---

### S5-02
**Epic:** EPIC-5
**As an** operator, **I want to** see how long the venue can serve content offline **so that** I know when to escalate a connectivity issue.
**Technical notes:** `AutonomyClock`: reads `venue.autonomy_status.autonomy_expires_at` (ISO string). Renders countdown: >24h remaining → amber; 6–24h → red; <6h → pulsing red (1s opacity cycle, PATCH-011); expired → bold "OFFLINE — corpus expired". `CountdownClock` component from `@clubhub/ui`. NEVER uses `Date.now()` — entire countdown derived from server-provided `expires_at`.
**Dependencies:** S5-01
**Acceptance criteria:**
- [ ] `CountdownClock` renders from `autonomy_expires_at` server timestamp
- [ ] Unit test (fake timer): >24h remaining → amber color class
- [ ] Unit test (fake timer): 6–24h remaining → red color class
- [ ] Unit test (fake timer): <6h remaining → pulsing red with 1s opacity cycle animation
- [ ] Unit test: expired (0s) → bold "OFFLINE — corpus expired" text
- [ ] No usage of `Date.now()` in `AutonomyClock` implementation
**Complexity:** 3

---

### S5-03
**Epic:** EPIC-5
**As an** operator, **I want to** see venue player and signal status cards **so that** I can assess hardware health at a glance.
**Technical notes:** `VenueStatusDashboard` (Tab 1): "PLAYER STATUS" section label above 4 status cards, "SIGNAL QUALITY" section label above 3 signal cards (PATCH-019). Cards from `GET /venues/{id}/status`. Same `PlayerHealthCard` component used in Live Ops (S1-06).
**Dependencies:** S5-01
**Acceptance criteria:**
- [ ] "PLAYER STATUS" text label renders above the player card group
- [ ] 4 `PlayerHealthCard` components render in the player status section
- [ ] "SIGNAL QUALITY" text label renders above the signal card group
- [ ] 3 `PlayerHealthCard` components render in the signal quality section
- [ ] Card status dots display correct colors per card `status` field
- [ ] Reuses the same `PlayerHealthCard` component from EPIC-1
**Complexity:** 1

---

### S5-04
**Epic:** EPIC-5
**As an** operator, **I want to** see the history of venue machine state changes with durations **so that** I can understand how long a venue has been in each state.
**Technical notes:** `MachineStateHistoryStrip` (Tab 5): `GET /venues/{id}/machine-state-history`. Each entry: state, `started_at`, `ended_at` (or "ongoing"), computed duration. Duration computed as: `(ended_at ?? server_now) - started_at` — server provides both timestamps. Renders as timeline: "LIVE (46m) → OFFLINE (12m) → RECOVERED_BUT_UNTRUSTED (5m) → LIVE (ongoing)".
**Dependencies:** S5-01
**Acceptance criteria:**
- [ ] Timeline renders with state labels and computed durations for each entry
- [ ] Durations are computed from server-provided timestamps only (not client clock)
- [ ] Current (latest) state shows "ongoing" as the duration suffix
- [ ] Timeline order is chronological (oldest left, newest right or oldest top, newest bottom)
- [ ] `RECOVERED_BUT_UNTRUSTED` state renders correctly in the timeline
**Complexity:** 2

---

### S5-05
**Epic:** EPIC-5
**As an** OPERATOR, **I want to** see corpus hash verification status and trigger a re-check **so that** I can unblock RECOVERED_BUT_UNTRUSTED venues.
**Technical notes:** `CorpusStatusTab` (Tab 3): `GET /venues/{id}/corpus-status` → renders `{ hash_verified: boolean, hash_match: boolean, last_verified_at }`. Shows "Verified ✓" only when both `hash_verified` AND `hash_match` are true. [Re-verify] button → `POST /venues/{id}/corpus-status/verify` → triggers async re-check. Loading state during re-check. On `VENUE_STATE_UPDATE` with machine state changing from `RECOVERED_BUT_UNTRUSTED` to `LIVE`: Tab 3 updates.
**Dependencies:** S5-01
**Acceptance criteria:**
- [ ] "Verified ✓" shown only when both `hash_verified === true` AND `hash_match === true`
- [ ] "Verified ✓" is NOT shown if `hash_match` is false, regardless of `hash_verified`
- [ ] [Re-verify] button calls `POST /venues/{id}/corpus-status/verify`
- [ ] Loading state is shown during re-check (button disabled with spinner)
- [ ] OPERATOR+ role can trigger re-verify; VIEWER cannot (button absent)
- [ ] `VENUE_STATE_UPDATE` WS event triggers Tab 3 to refresh
**Complexity:** 3

---

### S5-06
**Epic:** EPIC-5
**As an** operator, **I want to** see Zone A and Zone B update automatically when a venue's hash verification completes **so that** I know it is safe to operate.
**Technical notes:** `VENUE_STATE_UPDATE` with `machine_state=LIVE` and `corpus_hash_verified=true`: Zone A dot changes from ↻ orange to solid green; Zone B `MachineStateBadge` changes from amber "LIVE — UNVERIFIED" to green "LIVE"; `InterventionSurface` override controls appear in DOM. All within 1 render cycle of receiving the WS event.
**Dependencies:** S1-09, S5-05
**Acceptance criteria:**
- [ ] WS event with `machine_state=LIVE` → Zone A dot changes to solid green `#558B2F`
- [ ] Zone B `MachineStateBadge` changes from amber "LIVE — UNVERIFIED" to green "LIVE"
- [ ] `InterventionSurface` override controls appear in DOM after the transition
- [ ] All three changes occur within 1 render cycle of receiving the WS event
- [ ] E2E-004 passes
**Complexity:** 2

---

### S5-07
**Epic:** EPIC-5
**As an** OPERATOR, **I want to** see enrolled screens; **as an** ADMIN, **I want to** enroll and decommission screens.
**Technical notes:** `ScreenManagementTab` (Tab 2): `GET /venues/{id}/screens`. List of screens with status indicator. ADMIN: [Enroll Screen] button → `POST /venues/{id}/screens/enroll`. ADMIN: [Decommission] → `HoldToConfirmButton` (3s hold) → `DELETE /venues/{id}/screens/{id}`. Non-ADMIN: enroll and decommission controls absent from DOM entirely.
**Dependencies:** S5-01, S4-07
**Acceptance criteria:**
- [ ] Screen list renders for all roles
- [ ] OPERATOR role: enroll and decommission controls absent from DOM
- [ ] VIEWER role: enroll and decommission controls absent from DOM
- [ ] ADMIN role: [Enroll Screen] button present and calls POST on click
- [ ] ADMIN role: [Decommission] renders `HoldToConfirmButton` requiring 3s hold
- [ ] Partial hold on decommission → no DELETE called
**Complexity:** 2

---

### S5-08
**Epic:** EPIC-5
**As an** operator, **I want to** see current connectivity metrics for a venue **so that** I can understand the cause of delivery issues.
**Technical notes:** `ConnectivityTab` (Tab 4): `GET /venues/{id}/connectivity`. Renders: link state (`UP` / `DOWN`), latency (ms), packet loss (%), `last_contact_at` (formatted from server ISO string in local timezone). Read-only display. No write controls.
**Dependencies:** S5-01
**Acceptance criteria:**
- [ ] Link state (`UP` / `DOWN`) renders correctly
- [ ] Latency in ms is displayed
- [ ] Packet loss percentage is displayed
- [ ] `last_contact_at` is formatted from server ISO string in local timezone
- [ ] No write controls are present on Tab 4
**Complexity:** 1

---

## EPIC-6: CMS Content Operations

### S6-01
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** navigate to the CMS content operations surface **so that** I can manage content for my venues.
**Technical notes:** Route `/ops/cms` → CMS shell. 6-tab navigation via Zone A nav or Zone B tab bar: Tab 1 Library, Tab 2 Calendar, Tab 3 Approvals, Tab 4 Distribution, Tab 5 Delivery Confidence, Tab 6 Archive. Role guard: VIEWER can read all tabs (no write controls); CONTENT_MANAGER can write; Tab 3 approval actions require CONTENT_MANAGER+.
**Dependencies:** S0-06, S1-01
**Acceptance criteria:**
- [ ] Route `/ops/cms` renders the CMS shell
- [ ] 6 tabs navigate correctly
- [ ] VIEWER sees all tabs (read-only, no write controls in any tab)
- [ ] CONTENT_MANAGER has write controls in applicable tabs
- [ ] Route is accessible to all authenticated roles
**Complexity:** 2

---

### S6-02
**Epic:** EPIC-6
**As a** content manager, **I want to** browse the content library **so that** I can find content to schedule.
**Technical notes:** `ContentLibraryTab` (Tab 1): `GET /cms/content?venue_id=&status=`. List view: content title, type, status (`DRAFT` / `APPROVED` / `ARCHIVED`), thumbnail. Read-only at MVP. Clicking a content item shows a detail panel in Zone C.
**Dependencies:** S6-01
**Acceptance criteria:**
- [ ] Content list renders with title, type, status, and thumbnail
- [ ] Status labels `DRAFT`, `APPROVED`, `ARCHIVED` display correctly
- [ ] Clicking a content item populates Zone C with the content detail panel
- [ ] `venue_id` and `status` query params passed to `GET /cms/content`
- [ ] Empty state shown when no content matches the filter
**Complexity:** 2

---

### S6-03
**Epic:** EPIC-6
**As a** content manager, **I want to** see the weekly content calendar **so that** I know what content is scheduled for each venue.
**Technical notes:** `CMSCalendarGrid` (Tab 2): `GET /cms/calendar?venue_id=&week=`. 7-day grid with time slots. Each slot shows content title. `HIGH_PRIORITY` slots: ★ prefix. `DEGRADED` delivery slots: ~ prefix. `HIGH_PRIORITY` entries sorted above `ROUTINE` in same day column. Empty slots: clickable (opens `SlotCreateForm`). Venue selector to switch between venues.
**Dependencies:** S6-01
**Acceptance criteria:**
- [ ] Calendar grid renders 7 days with time slots
- [ ] Content titles appear in their scheduled time slots
- [ ] `HIGH_PRIORITY` slots have ★ prefix on the title
- [ ] `DEGRADED` delivery slots have ~ prefix on the title
- [ ] `HIGH_PRIORITY` entries appear above `ROUTINE` entries in the same day column
- [ ] Empty slots are clickable and open `SlotCreateForm`
- [ ] Venue selector switches calendar to show content for selected venue
**Complexity:** 3

---

### S6-04
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** create a content slot with a priority level **so that** important fixtures get earlier delivery warnings.
**Technical notes:** `SlotCreateForm`: selected time slot + content picker. `delivery_priority` selector: default `ROUTINE` (no extra UI); `HIGH_PRIORITY` → "★ Mark as High Priority" checkbox with label "Critical event — content failure has live consequence". Submit → `POST /cms/calendar/slots` with `{ venue_id, start_time, content_id, delivery_priority }`. `SlotCreateForm` requires CONTENT_MANAGER+ role; form is absent from DOM for VIEWER.
**Dependencies:** S6-03
**Acceptance criteria:**
- [ ] Form renders with `ROUTINE` as the default `delivery_priority`
- [ ] "★ Mark as High Priority" checkbox is present with correct label text
- [ ] POST payload includes `delivery_priority` field
- [ ] VIEWER role: `SlotCreateForm` absent from DOM
- [ ] Successful submission → slot appears in calendar with correct ★ or no prefix
- [ ] Form validation: content must be selected before submit is enabled
**Complexity:** 2

---

### S6-05
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** see a specific error when a time slot is already taken **so that** I know to choose a different slot.
**Technical notes:** `POST /cms/calendar/slots` returns 409 `CONCURRENCY_CONFLICT`. Toast: 8s amber border, message includes "Time slot [time] is now occupied by [content name]." Calendar updates via `REJECTION_STATE_PUSH` to show the winning submission. Form is NOT auto-submitted — user can correct and resubmit.
**Dependencies:** S6-04
**Acceptance criteria:**
- [ ] 409 → amber-bordered toast renders with message identifying the occupied time slot and winning content name
- [ ] Toast persists 8 seconds
- [ ] `SlotCreateForm` remains open (user can correct and resubmit)
- [ ] Calendar updates via `REJECTION_STATE_PUSH` to show the winning slot
**Complexity:** 2

---

### S6-06
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** see delivery warning banners that distinguish routine from critical and degraded warnings **so that** I can prioritize correctly.
**Technical notes:** `DeliveryWarningBanner` — 3 variants (A-NEW-02):
- `ROUTINE`: existing amber banner + PATCH-017 Line 2 ("Slots before this time may not sync before air")
- `DEGRADED`: amber banner + "DEGRADED DELIVERY PATH — venue connectivity impaired. Content submitted now may not arrive before deadline."
- `HIGH_PRIORITY`: ★ header "HIGH PRIORITY — 72h deadline: [date]", `#E64A19` border, `#FBE9E7` background, event name + declarer on Line 2

"⚠ Submit anyway" button on all 3 variants (not "Submit with warning").
**Dependencies:** S6-04
**Acceptance criteria:**
- [ ] `ROUTINE` variant: amber border, PATCH-017 Line 2 text present
- [ ] `DEGRADED` variant: amber border, "DEGRADED DELIVERY PATH" text on second line
- [ ] `HIGH_PRIORITY` variant: ★ prefix in header, border color `#E64A19`, background color `#FBE9E7`
- [ ] `HIGH_PRIORITY` variant: event name and declarer on Line 2
- [ ] All 3 variants have "⚠ Submit anyway" button (not "Submit with warning")
**Complexity:** 2

---

### S6-07
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** see a delivery confidence countdown that reflects the urgency of the deadline **so that** I can prioritize content submission.
**Technical notes:** `DeliveryConfidencePanel` (Tab 5): `GET /cms/delivery-confidence?venue_id=&deadline=`. `CountdownClock` with priority-adjusted color tiers (A-NEW-02):
- `ROUTINE`: green >48h, amber 24–48h, deep-orange <24h
- `DEGRADED`: amber always (never green), deep-orange <24h, red pulsing (1s) at deadline
- `HIGH_PRIORITY`: amber >48h (warning starts earlier), deep-orange <48h, pulsing red <24h
**Dependencies:** S6-01
**Acceptance criteria:**
- [ ] `ROUTINE`: countdown is green when >48h remaining
- [ ] `ROUTINE`: countdown is amber when 24–48h remaining
- [ ] `ROUTINE`: countdown is deep-orange when <24h remaining
- [ ] `DEGRADED`: countdown is amber at all times (never green)
- [ ] `DEGRADED`: pulsing red at deadline threshold
- [ ] `HIGH_PRIORITY`: countdown starts at amber when >48h remaining (not green)
- [ ] `HIGH_PRIORITY`: pulsing red when <24h remaining
- [ ] `DELIVERY_STATE_UPDATE` WS event updates the countdown and priority
**Complexity:** 3

---

### S6-08
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** enable Training Mode **so that** trainees can submit content without affecting the live corpus.
**Technical notes:** Training Mode is deferred from MVP per `CMS-MVP-CUTLINE-v1.md`. This story is defined but not scheduled for the MVP sprint. PATCH-006: amber strip "TRAINING MODE ACTIVE — submissions do not affect live corpus" renders at top of CMS surface when training_mode is active. `uiStore.training_mode` flag drives the strip visibility.

**DEFERRED — do not implement in MVP sprint.**
**Dependencies:** S6-01
**Acceptance criteria:**
- [ ] (Deferred) — defined but not scheduled for MVP sprint
- [ ] Amber strip "TRAINING MODE ACTIVE — submissions do not affect live corpus" renders when training_mode is active
- [ ] `uiStore.training_mode` drives the strip
- [ ] Toggle sets `uiStore.training_mode` and communicates mode to API
**Complexity:** 3

---

### S6-09
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** approve or reject pending content submissions **so that** only approved content reaches the corpus.
**Technical notes:** `PendingApprovalsTab` (Tab 3): `GET /cms/approvals?status=pending`. List of pending items. [Approve] → `POST /cms/approvals/{id}/approve`. [Reject] → `POST /cms/approvals/{id}/reject`. CONTENT_MANAGER+ only for write actions; VIEWER sees list read-only (approve/reject absent from DOM). Note: at pilot scale, approval workflow may be used sparingly — in MVP but low priority.
**Dependencies:** S6-01
**Acceptance criteria:**
- [ ] Pending approvals list renders from API
- [ ] VIEWER role: [Approve] and [Reject] absent from DOM
- [ ] CONTENT_MANAGER role: both [Approve] and [Reject] are present
- [ ] [Approve] calls `POST /cms/approvals/{id}/approve`
- [ ] [Reject] calls `POST /cms/approvals/{id}/reject`
- [ ] List updates after action (entry removed or status updated)
**Complexity:** 2

---

### S6-10
**Epic:** EPIC-6
**As a** CONTENT_MANAGER, **I want to** see the delivery countdown update in real-time when venue connectivity changes **so that** I see current delivery confidence without refreshing.
**Technical notes:** `DELIVERY_STATE_UPDATE` WS event: `{ venue_id, slot_id, delivery_priority, countdown_ms }`. Update React Query cache for `delivery-confidence`. `DeliveryConfidencePanel` re-renders with updated countdown and priority. If `delivery_priority` changed (e.g., `ROUTINE` → `DEGRADED` due to connectivity issue), banner variant updates.
**Dependencies:** S6-07
**Acceptance criteria:**
- [ ] `DELIVERY_STATE_UPDATE` WS event → countdown value updates in `DeliveryConfidencePanel`
- [ ] Priority change `ROUTINE` → `DEGRADED`: "DEGRADED DELIVERY PATH" banner appears
- [ ] Priority change reflected in countdown color tiers (no page refresh required)
- [ ] `venue_id` and `slot_id` are used to target the correct cache entry
**Complexity:** 2

---

## EPIC-8 (Partial): Advisory + Notifications

### S8-01
**Epic:** EPIC-8
**As an** operator, **I want to** see advisory text in Zone C **so that** I have context about venue conditions.
**Technical notes:** Zone C Pane C4 (Advisory): `GET /venues/{id}/advisory`. Renders advisory content text and `updated_at` (formatted from server ISO string). `INFORMATIONAL` state (default): no border, no background change. If advisory is null or empty: "No active advisories."
**Dependencies:** S1-04
**Acceptance criteria:**
- [ ] Zone C Pane C4 renders advisory text from API
- [ ] `updated_at` is formatted from server ISO string in local timezone
- [ ] "No active advisories." is shown when advisory is null or empty string
- [ ] `INFORMATIONAL` state has no special border or background treatment (plain rendering)
**Complexity:** 1

---

### S8-02
**Epic:** EPIC-8
**As an** operator, **I want to** see Zone C visually escalate when an advisory requires action **so that** I notice it without constantly watching Zone C.
**Technical notes:** `AdvisoryCard` component in Zone C. `RECOMMENDED`: Pane C4 outer border `2px solid #F59E0B`, card background `#FFFBEB`, left accent `4px solid #F59E0B`. `URGENT`: border/background deep-orange (`#E64A19` / `#FBE9E7`); single 800ms opacity pulse fires once on transition to `URGENT`, then static. `ADVISORY_UPDATE` WS event triggers visual state change. CSS transition 300ms for border/background changes.
**Dependencies:** S8-01
**Acceptance criteria:**
- [ ] HF-REG-008 passes: `URGENT` pulse fires exactly once, not continuously
- [ ] `RECOMMENDED` state: Pane C4 border `2px solid #F59E0B`, card background `#FFFBEB`, left accent `4px solid #F59E0B`
- [ ] `URGENT` state: border and background use deep-orange (`#E64A19` / `#FBE9E7`)
- [ ] Single 800ms opacity pulse fires on transition to `URGENT` (not on subsequent renders)
- [ ] CSS transitions are 300ms for border and background changes
- [ ] `ADVISORY_UPDATE` WS event drives the state change
**Complexity:** 3

---

### S8-03
**Epic:** EPIC-8
**As an** operator, **I want to** see notification count and open a tray to read recent notifications **so that** I don't miss system alerts.
**Technical notes:** `ZoneANotificationTray`: reads `useQuery(['notifications'], getNotifications)`. Shows unread count badge in Zone A Pane A3. Clicking opens a drawer/panel: list of notifications with title, `created_at` timestamp, read/unread state. `PATCH /notifications/{id}/read` marks a notification as read. `NOTIFICATION_CREATED` WS event → increment unread badge count. Advisory `RECOMMENDED` / `URGENT` events automatically create a notification (server-side).
**Dependencies:** S0-07
**Acceptance criteria:**
- [ ] Unread count badge renders in Zone A Pane A3
- [ ] Clicking the tray icon opens the notification drawer
- [ ] Notification list shows title and formatted timestamp for each entry
- [ ] Clicking a notification calls `PATCH /notifications/{id}/read` and removes it from unread count
- [ ] `NOTIFICATION_CREATED` WS event increments the unread badge
- [ ] Advisory escalation notification appears in the tray
**Complexity:** 3

---

### S8-04
**Epic:** EPIC-8
**As an** operator, **I want to** see advisory escalations appear in the NotificationTray even when Zone C is collapsed **so that** I don't miss escalations.
**Technical notes:** When `ADVISORY_UPDATE` fires with `advisory_level=RECOMMENDED` or `advisory_level=URGENT`: server creates a notification. `NOTIFICATION_CREATED` WS event arrives → `NotificationTray` badge increments. Notification text format: "Advisory: [advisory_title] — [advisory_level] — [recommended_action_window]".
**Dependencies:** S8-02, S8-03
**Acceptance criteria:**
- [ ] `ADVISORY_UPDATE` with `RECOMMENDED` → `NotificationTray` badge increments
- [ ] `ADVISORY_UPDATE` with `URGENT` → `NotificationTray` badge increments
- [ ] Notification text matches format: "Advisory: [title] — [level] — [action_window]"
- [ ] Badge increment works even when Zone C is collapsed to 48px
- [ ] Notification appears in tray drawer when opened
**Complexity:** 2

---

## Story Point Summary by Epic

| Epic | Name | Stories | Total Points |
|------|------|---------|--------------|
| EPIC-0 | Foundation Infrastructure | S0-01 to S0-08 (8 stories) | 18 |
| EPIC-1 | Venue Health Monitoring | S1-01 to S1-10 (10 stories) | 22 |
| EPIC-2 | Incident Read-Only Monitoring | S2-01 to S2-08 (8 stories) | 18 |
| EPIC-3 | Commander Claim | S3-01 to S3-07 (7 stories) | 15 |
| EPIC-4 | L6 Override Lifecycle | S4-01 to S4-12 (12 stories) | 23 |
| EPIC-5 | Venue Operations Surface | S5-01 to S5-08 (8 stories) | 16 |
| EPIC-6 | CMS Content Operations | S6-01 to S6-10 (10 stories) | 22 |
| EPIC-8 (partial) | Advisory + Notifications | S8-01 to S8-04 (4 stories) | 9 |
| **Total** | | **67 stories** | **143** |

Story point breakdown per story:

| Story | Points | Story | Points | Story | Points |
|-------|--------|-------|--------|-------|--------|
| S0-01 | 3 | S2-01 | 2 | S4-07 | 3 |
| S0-02 | 2 | S2-02 | 2 | S4-08 | 2 |
| S0-03 | 2 | S2-03 | 2 | S4-09 | 2 |
| S0-04 | 3 | S2-04 | 1 | S4-10 | 1 |
| S0-05 | 2 | S2-05 | 1 | S4-11 | 2 |
| S0-06 | 2 | S2-06 | 3 | S4-12 | 1 |
| S0-07 | 2 | S2-07 | 3 | S5-01 | 2 |
| S0-08 | 2 | S2-08 | 1 | S5-02 | 3 |
| S1-01 | 2 | S3-01 | 2 | S5-03 | 1 |
| S1-02 | 2 | S3-02 | 2 | S5-04 | 2 |
| S1-03 | 1 | S3-03 | 2 | S5-05 | 3 |
| S1-04 | 2 | S3-04 | 2 | S5-06 | 2 |
| S1-05 | 2 | S3-05 | 2 | S5-07 | 2 |
| S1-06 | 2 | S3-06 | 2 | S5-08 | 1 |
| S1-07 | 2 | S3-07 | 3 | S6-01 | 2 |
| S1-08 | 3 | S4-01 | 3 | S6-02 | 2 |
| S1-09 | 2 | S4-02 | 2 | S6-03 | 3 |
| S1-10 | 2 | S4-03 | 2 | S6-04 | 2 |
| | | S4-04 | 2 | S6-05 | 2 |
| | | S4-05 | 2 | S6-06 | 2 |
| | | S4-06 | 2 | S6-07 | 3 |
| | | | | S6-08 | 3 |
| | | | | S6-09 | 2 |
| | | | | S6-10 | 2 |
| | | | | S8-01 | 1 |
| | | | | S8-02 | 3 |
| | | | | S8-03 | 3 |
| | | | | S8-04 | 2 |

---

## MVP Stories vs Deferred

### Deferred — Not Scheduled for MVP Sprint

**S6-08 — Training Mode toggle and amber strip (PATCH-006)**
- Reason: Deferred from MVP per `CMS-MVP-CUTLINE-v1.md`
- Story is defined in this backlog for future sprint scheduling
- 3 story points — do not include in MVP sprint velocity calculations
- Resume in a post-MVP sprint once pilot venue content ops workflow is validated

### All Other Stories — MVP Scheduled

All 66 remaining stories (S0-01 through S8-04 excluding S6-08) are scheduled for MVP implementation. Stories within each Epic should be implemented in the order listed unless a parallel build opportunity exists (see below).

---

## Parallel Build Opportunities

The following story pairs have no dependency relationship and can be built simultaneously by different engineers. Groups are non-exhaustive — any pair not connected by a dependency chain can run in parallel.

### Group A — EPIC-0 Foundation (after S0-01)
- **S0-02, S0-08** — both depend only on S0-01; type definitions and CI pipeline are independent
- **S0-03, S0-04** — both depend on S0-02; fetch client and WebSocket client are independent modules
- **S0-05, S0-07** — S0-05 depends on S0-02; S0-07 depends on S0-06; both are leaf-level at their stage

### Group B — EPIC-1 Bootstrapping
- **S1-03, S1-07** — S1-03 (MachineStateDot) and S1-07 (SystemStatusBar) have no dependency on each other; both can be built immediately after S1-02 and S0-07 respectively
- **S0-04, S1-01** — WebSocket client (S0-04) and Login page (S1-01) have no dependency on each other

### Group C — EPIC-1 Components
- **S1-05, S1-06** — both depend on S1-04; `VenueIdentityHeader` and `PlayerHealthSection` are independent components on the same surface

### Group D — Foundation Components (no surface dependencies)
- **S4-01, S4-07** — `SequentialChipSelect` and `HoldToConfirmButton` are reusable components with no inter-dependency; both depend only on S0-02 and can be built as soon as types are available

### Group E — EPIC-2 Read-Only Views
- **S2-04, S2-05, S2-08** — all depend on S2-03 (tab system); Tab 1 Overview, Tab 2 Shift Notes, and Tab 5 Transitions are independent tabs that can be built simultaneously

### Group F — EPIC-3 Claim + Notes
- **S3-01, S3-05** — `AssumeCommandConfirmCard` (S3-01) depends on S2-02; `ShiftNotesTab` write (S3-05) depends on S2-05; neither depends on the other

### Group G — EPIC-4 Rejection Variants
- **S4-04, S4-05, S4-06** — all depend on S4-02; CONCURRENCY_CONFLICT, AUTHORITY_BOUNDARY, and PRE_CONSTRAINT rejection paths are independent handlers

### Group H — EPIC-5 Tabs
- **S5-03, S5-04, S5-07, S5-08** — all depend on S5-01; Status dashboard, History strip, Screen management, and Connectivity tabs are independent and can be built simultaneously

### Group I — EPIC-6 CMS Views
- **S6-02, S6-03** — both depend on S6-01; Content Library and Calendar grid are independent views
- **S6-06, S6-07** — both depend on S6-04 / S6-01; Delivery warning banners and Delivery confidence panel are independent components

### Group J — EPIC-8 Advisory
- **S8-01, S8-03** — S8-01 depends on S1-04; S8-03 depends on S0-07; neither depends on the other; advisory text display and notification tray can be built in parallel

### High-Leverage Parallel Sprint Pairing (Recommended)
For a 2-engineer frontend sprint, the following split maximizes parallel throughput:

| Engineer A | Engineer B |
|-----------|-----------|
| S0-01 → S0-02 → S0-03 → S0-05 → S0-06 → S1-01 → S1-02 | S0-01 → S0-04 → S0-07 → S0-08 → S1-07 → S1-10 → S4-01 → S4-07 |

After EPIC-0 converges, the two engineers can split across EPIC-1/EPIC-2 and EPIC-4/EPIC-5 tracks respectively.
