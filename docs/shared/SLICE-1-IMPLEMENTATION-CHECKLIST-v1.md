# Slice 1 Implementation Checklist — Venue Health View
# Version: 1.0 | Status: AUTHORITATIVE | Date: 2026-06-04

## Goal

Operator can log in, see real venue list with machine state dots, select a venue, see venue health detail, and see Zone A state dots update in real-time via WebSocket. No write actions in Slice 1.

## Acceptance Criteria (Gate)

1. `GET /operators/me` populates auth state with `role` and `operator_id`
2. `GET /venues` renders Zone A VenueSelector with correct machine state dots for all venues
3. Clicking a venue renders Zone B with VenueIdentityHeader, PlayerHealthSection (4 status + 3 signal cards)
4. WS `VENUE_STATE_UPDATE` updates Zone A dot without page refresh, within 1 render cycle
5. RECOVERED_BUT_UNTRUSTED: Zone A dot is ↻ rotating orange (`#FB923C`), Zone B badge is amber "LIVE — UNVERIFIED" pill, override controls absent from Zone B DOM
6. System Status Bar renders `constitutional_state` from `GET /system/health`
7. Slice 1 passes all unit tests for `@clubhub/ui` components used

## Prerequisites (Slice 0 must be complete)

- [ ] Monorepo builds (`pnpm install` resolves all workspace packages)
- [ ] `packages/@clubhub/types`, `@clubhub/api`, `@clubhub/state`, `@clubhub/ui` directories exist with `package.json` and `tsconfig.json`
- [ ] `apps/cms-operator` exists with Vite config, React 18, React Router v6 scaffold
- [ ] Vitest + React Testing Library + MSW v2 configured in all packages
- [ ] CI pipeline runs `pnpm -r type-check`, `pnpm -r lint`, `pnpm -r test` on PR

---

## Phase 1: Types Definition
**Owner:** Engineer 1 | **Target:** Day 1 | **Estimate:** 4 hours

- [ ] Add `MachineState` union type to `packages/@clubhub/types/src/index.ts`: `'INITIALIZING' | 'SYNCING' | 'LIVE' | 'INCIDENT' | 'OFFLINE' | 'DEGRADED' | 'RECOVERED_BUT_UNTRUSTED'`
- [ ] Add `ConstitutionalState` union type to `packages/@clubhub/types/src/index.ts`: `'HEALTHY' | 'DEGRADED' | 'CONSTITUTIONAL_RISK' | 'EMERGENCY_FREEZE' | 'SHADOW_ONLY' | 'PRE_DISABLED' | 'READ_ONLY'`
- [ ] Add `OperatorRole` union type to `packages/@clubhub/types/src/index.ts`: `'VIEWER' | 'OPERATOR' | 'CONTENT_MANAGER' | 'ADMIN'`
- [ ] Add `Venue` interface to `packages/@clubhub/types/src/index.ts`: `{ venue_id: string; name: string; location: string; machine_state: MachineState; corpus_hash_verified: boolean; screen_count: number; trust_state?: string }`
- [ ] Add `Override` interface to `packages/@clubhub/types/src/index.ts`: `{ override_id: string; level: number; issued_by: string; issued_at: string; expires_at: string | null; reason: string }`
- [ ] Add `Advisory` interface to `packages/@clubhub/types/src/index.ts`: `{ advisory_id: string; severity: 1 | 2 | 3 | 4 | 5; message: string; issued_at: string }`
- [ ] Add `VenueDetail` interface to `packages/@clubhub/types/src/index.ts` extending `Venue` with: `{ pre_level?: number; overrides?: Override[]; advisory?: Advisory }`
- [ ] Add `PlayerHealthCard` interface to `packages/@clubhub/types/src/index.ts`: `{ label: string; value: string; status: 'ok' | 'warn' | 'error' }`
- [ ] Add `PlayerHealth` interface to `packages/@clubhub/types/src/index.ts`: `{ player_cards: PlayerHealthCard[]; signal_cards: PlayerHealthCard[] }`
- [ ] Add `OperatorIdentity` interface to `packages/@clubhub/types/src/index.ts`: `{ operator_id: string; role: OperatorRole; display_name: string; session_id: string; permissions: string[] }`
- [ ] Add `StatusBarIndicator` interface to `packages/@clubhub/types/src/index.ts`: `{ key: string; label: string; state: 'ok' | 'warn' | 'error' | 'unknown' }`
- [ ] Add `SystemHealth` interface to `packages/@clubhub/types/src/index.ts`: `{ constitutional_state: ConstitutionalState; status_bar: Record<string, StatusBarIndicator> }`
- [ ] Add `VenueStateUpdate` interface to `packages/@clubhub/types/src/index.ts` (WS event payload): `{ venue_id: string; machine_state: MachineState; trust_state?: string; corpus_hash_verified: boolean; sequence_number: number; timestamp: string }`
- [ ] Add `ApiEnvelope<T>` generic interface to `packages/@clubhub/types/src/index.ts`: `{ data: T; meta?: Record<string, unknown> }`
- [ ] Add `ApiError` interface to `packages/@clubhub/types/src/index.ts`: `{ code: string; message: string; rejection?: string }`
- [ ] Export all types from `packages/@clubhub/types/src/index.ts` using named exports (no default export)
- [ ] Run `pnpm --filter @clubhub/types type-check` — must pass with 0 errors

---

## Phase 2: API Client — Slice 1 Endpoints
**Owner:** Engineer 2 | **Target:** Day 1 (parallel with Phase 1) | **Estimate:** 4 hours

- [ ] Create `packages/@clubhub/api/src/client.ts`: typed fetch wrapper — reads `VITE_API_BASE_URL` from env, attaches `Authorization: Bearer <token>` header (token sourced from a `getToken: () => string | null` callback injected at init time), unwraps `ApiEnvelope<T>` returning `T`, throws `ApiError` on non-2xx responses
- [ ] Create `packages/@clubhub/api/src/error.ts`: parse error response body `{ error: { code, message, rejection? } }` into typed `ApiError`; export `isApiError(e: unknown): e is ApiError` type guard using `code` field presence check
- [ ] Create `packages/@clubhub/api/src/venues.ts`: export `getVenues(): Promise<Venue[]>` calling `GET /venues`, `getVenueDetail(venue_id: string): Promise<VenueDetail>` calling `GET /venues/{venue_id}/detail`, `getVenuePlayerHealth(venue_id: string): Promise<PlayerHealth>` calling `GET /venues/{venue_id}/player-health`
- [ ] Create `packages/@clubhub/api/src/system.ts`: export `getSystemHealth(): Promise<SystemHealth>` calling `GET /system/health`
- [ ] Create `packages/@clubhub/api/src/operators.ts`: export `getCurrentOperator(): Promise<OperatorIdentity>` calling `GET /operators/me`
- [ ] Create `packages/@clubhub/api/src/websocket.ts`: export `RealtimeClient` class with constructor accepting `{ baseUrl: string; getToken: () => string | null }`, methods: `connect(): void`, `disconnect(): void`, `subscribe(venue_ids: string[]): void`, `on(event: string, handler: (payload: unknown) => void): void`, `off(event: string, handler: (payload: unknown) => void): void`; internal `_subscribedVenueIds: Set<string>` tracked for reconnect re-subscription
- [ ] `RealtimeClient`: implement exponential backoff reconnect — delay sequence 1000ms, 2000ms, 4000ms, 8000ms, 16000ms, 30000ms, hold at 30000ms; reset backoff counter on successful connect; do not reconnect after explicit `disconnect()` call
- [ ] `RealtimeClient`: on WebSocket `message` event, parse JSON as `{ event: string; payload: unknown; sequence_number: number; timestamp: string }`; emit to registered handlers for the given event name
- [ ] `RealtimeClient`: emit typed `VENUE_STATE_UPDATE` events with `VenueStateUpdate` payload; validate payload shape before emitting (log and discard malformed messages)
- [ ] `RealtimeClient`: on reconnect success, re-call `subscribe(Array.from(this._subscribedVenueIds))` to restore venue subscriptions
- [ ] Export all from `packages/@clubhub/api/src/index.ts`: re-export everything from `client.ts`, `error.ts`, `venues.ts`, `system.ts`, `operators.ts`, `websocket.ts`
- [ ] Create `packages/@clubhub/api/src/msw/handlers.ts`: MSW v2 HTTP handlers for all 5 Slice 1 endpoints returning typed fixture data (used in tests only, not in production bundle)
- [ ] Write unit test `packages/@clubhub/api/src/__tests__/venues.test.ts`: `getVenues()` with MSW handler returning `[{ venue_id: 'v1', name: 'Test Venue', machine_state: 'LIVE', corpus_hash_verified: true, screen_count: 3, location: 'London', trust_state: 'VERIFIED' }]` — assert return type is `Venue[]`, `venue_id` equals `'v1'`
- [ ] Write unit test `packages/@clubhub/api/src/__tests__/websocket.test.ts`: create `RealtimeClient`, call `connect()` with mock WebSocket server, send `VENUE_STATE_UPDATE` message, assert registered handler fires with correct `VenueStateUpdate` payload fields

---

## Phase 3: State Layer
**Owner:** Engineer 1 | **Target:** Day 2 | **Estimate:** 4 hours

- [ ] Create `packages/@clubhub/state/src/queryClient.ts`: export singleton `QueryClient` with `defaultOptions.queries`: `staleTime: 10000`, `retry: 1`, `refetchOnWindowFocus: false`; per-query overrides: `['system-health']` staleTime 15000ms (set via `queryClient.setQueryDefaults`)
- [ ] Create `packages/@clubhub/state/src/hooks/useVenues.ts`: export `useVenues()` — `useQuery({ queryKey: ['venues'], queryFn: getVenues, staleTime: 10000 })`; returns `{ data: Venue[] | undefined, isLoading, isError, error }`
- [ ] Create `packages/@clubhub/state/src/hooks/useVenueDetail.ts`: export `useVenueDetail(venue_id: string | null)` — `useQuery({ queryKey: ['venue', venue_id], queryFn: () => getVenueDetail(venue_id!), enabled: venue_id !== null, staleTime: 10000 })`
- [ ] Create `packages/@clubhub/state/src/hooks/useVenuePlayerHealth.ts`: export `useVenuePlayerHealth(venue_id: string | null)` — `useQuery({ queryKey: ['player-health', venue_id], queryFn: () => getVenuePlayerHealth(venue_id!), enabled: venue_id !== null, staleTime: 10000 })`
- [ ] Create `packages/@clubhub/state/src/hooks/useSystemHealth.ts`: export `useSystemHealth()` — `useQuery({ queryKey: ['system-health'], queryFn: getSystemHealth, staleTime: 15000 })`
- [ ] Create `packages/@clubhub/state/src/hooks/useCurrentOperator.ts`: export `useCurrentOperator()` — `useQuery({ queryKey: ['current-operator'], queryFn: getCurrentOperator, staleTime: Infinity })`; in `onSuccess` callback, call `authStore.getState().setAuth(data)` to populate Zustand auth state
- [ ] Create `packages/@clubhub/state/src/stores/authStore.ts`: Zustand store — state shape `{ identity: OperatorIdentity | null }`; action `setAuth(identity: OperatorIdentity): void` sets `identity`; action `clearAuth(): void` sets `identity` to null; export `useAuthStore` hook and `authStore` singleton
- [ ] Create `packages/@clubhub/state/src/stores/uiStore.ts`: Zustand store — state shape `{ selected_venue_id: string | null; zone_c_collapsed: boolean; active_surface: string }`; actions: `setSelectedVenue(id: string): void`, `clearSelectedVenue(): void`, `collapseZoneC(): void`, `expandZoneC(): void`, `setActiveSurface(surface: string): void`; initial state: `selected_venue_id: null`, `zone_c_collapsed: false`, `active_surface: 'live-ops'`
- [ ] Create `packages/@clubhub/state/src/stores/wsStore.ts`: Zustand store — state shape `{ connection_state: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED'; last_connected_at: string | null; client: RealtimeClient | null }`; actions: `setConnectionState(state): void`, `setLastConnectedAt(ts: string): void`, `setClient(client: RealtimeClient): void`; export `useWsStore` and `wsStore` singleton
- [ ] Create `packages/@clubhub/state/src/handlers/venueStateUpdateHandler.ts`: export `venueStateUpdateHandler(payload: VenueStateUpdate, queryClient: QueryClient): void` — reads current `['venues']` cache; finds venue by `venue_id`; if cached venue has `sequence_number` >= `payload.sequence_number`, discard (no update); otherwise calls `queryClient.setQueryData(['venues'], updater)` that replaces the matching venue entry with updated `machine_state`, `corpus_hash_verified`, `trust_state`; also invalidates `['venue', payload.venue_id]` and `['player-health', payload.venue_id]` to trigger refetch
- [ ] Export all hooks, stores, and handlers from `packages/@clubhub/state/src/index.ts`
- [ ] Write unit test `packages/@clubhub/state/src/__tests__/venueStateUpdateHandler.test.ts`: seed query cache with venue `sequence_number: 5`; call handler with payload `sequence_number: 7`; assert cached venue `machine_state` updated to payload value
- [ ] Write unit test `packages/@clubhub/state/src/__tests__/venueStateUpdateHandler.test.ts`: seed query cache with venue `sequence_number: 5`; call handler with payload `sequence_number: 3`; assert cached venue `machine_state` unchanged (stale discard)

---

## Phase 4: Shared UI Components
**Owner:** Engineer 2 | **Target:** Day 2 (parallel with Phase 3) | **Estimate:** 4 hours

- [ ] Create `packages/@clubhub/ui/src/SeverityBadge/SeverityBadge.tsx`: props `{ severity: 1 | 2 | 3 | 4 | 5; label?: string; className?: string }`; background colors: S1 `#C62828`, S2 `#E64A19`, S3 `#F57C00`, S4 `#FBC02D`, S5 `#558B2F`; renders `<span>` with inline background-color style and white text; export `SeverityBadgeProps` type
- [ ] Create `packages/@clubhub/ui/src/MachineStateBadge/MachineStateBadge.tsx`: props `{ machine_state: MachineState; corpus_hash_verified?: boolean; className?: string }`; RECOVERED_BUT_UNTRUSTED → amber `#FB923C` background, text "LIVE — UNVERIFIED", 180×40px pill (PATCH-009); LIVE + corpus_hash_verified=true → green `#558B2F` background, text "LIVE"; LIVE + corpus_hash_verified=false → amber background, text "LIVE — UNVERIFIED"; OFFLINE → grey `#9E9E9E` background, text "OFFLINE"; DEGRADED → amber `#F59E0B` background, text "DEGRADED"; INCIDENT → deep-orange `#E64A19` background, text "INCIDENT"; INITIALIZING/SYNCING → grey `#9E9E9E` background, text equals machine_state value; export `MachineStateBadgeProps` type
- [ ] Create `packages/@clubhub/ui/src/TabBadge/TabBadge.tsx`: props `{ state: 'ok' | 'warn' | 'error' | 'unknown'; className?: string }`; renders 8px circle: `ok` → `#558B2F`, `warn` → `#F59E0B`, `error` → `#E64A19`, `unknown` → `#9E9E9E`; export `TabBadgeProps` type
- [ ] Create `packages/@clubhub/ui/src/SkeletonLoader/SkeletonLoader.tsx`: props `{ lines?: number; className?: string }`; renders shimmer placeholder divs; used during loading states in Zone B
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/SeverityBadge.test.tsx`: 5 tests — each severity value (1–5) renders element with correct background color in `style` attribute
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/MachineStateBadge.test.tsx`: RECOVERED_BUT_UNTRUSTED → `getByText('LIVE — UNVERIFIED')` exists, element has amber background
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/MachineStateBadge.test.tsx`: LIVE + `corpus_hash_verified=true` → `getByText('LIVE')` exists, element has green background
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/MachineStateBadge.test.tsx`: LIVE + `corpus_hash_verified=false` → `getByText('LIVE — UNVERIFIED')` exists, element has amber background (corpus unverified overrides LIVE state)
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/MachineStateBadge.test.tsx`: OFFLINE → `getByText('OFFLINE')`, grey background
- [ ] Write unit test `packages/@clubhub/ui/src/__tests__/TabBadge.test.tsx`: 4 tests — `ok`, `warn`, `error`, `unknown` render circles with correct color class or style
- [ ] Export all components from `packages/@clubhub/ui/src/index.ts`: `SeverityBadge`, `SeverityBadgeProps`, `MachineStateBadge`, `MachineStateBadgeProps`, `TabBadge`, `TabBadgeProps`, `SkeletonLoader`
- [ ] Run `pnpm -r build` — all 4 packages (`@clubhub/types`, `@clubhub/api`, `@clubhub/state`, `@clubhub/ui`) must build with 0 TypeScript errors

---

## Phase 5: Chrome Components
**Owner:** Engineers 1 + 2 | **Target:** Day 3 | **Estimate:** 6 hours

- [ ] Create `apps/cms-operator/src/chrome/shell/ShellLayout.tsx`: CSS Grid layout — `grid-template-rows: 48px 1fr`; `grid-template-columns: 280px 1fr 0px` (Zone C width controlled by `uiStore.zone_c_collapsed`); renders `<SystemStatusBar>` spanning full width in row 1; `<ZoneA>` in row 2 col 1; `<Outlet />` (React Router) in row 2 col 2; `<ZoneC>` in row 2 col 3; Zone C column shifts to 320px when expanded
- [ ] Create `apps/cms-operator/src/chrome/system-status-bar/SystemStatusBar.tsx`: reads `useSystemHealth()`; renders 48px top bar with `constitutional_state` label on left; renders up to 6 `StatusBarIndicator` pills on right — state `ok` → green `#558B2F`, `warn` → amber `#F59E0B`, `error` → red `#E64A19`, `unknown` → grey `#9E9E9E`; renders WS connection state indicator from `useWsStore` (amber pill if `RECONNECTING` or `FAILED`); during `isLoading`, renders grey placeholder pills (no spinner)
- [ ] Create `apps/cms-operator/src/chrome/zone-a/ZoneA.tsx`: fixed 280px wide left panel; renders `<ZoneAVenueSelector>` at top; renders stub `<div data-testid="zone-a-incident-list">` and `<div data-testid="zone-a-notification-tray">` below (stubs for Slice 2); renders stub `<div data-testid="zone-a-operator-tools">` at bottom; overall height fills viewport minus 48px status bar
- [ ] Create `apps/cms-operator/src/chrome/zone-a/ZoneAVenueSelector.tsx`: reads `useVenues()` and `useUiStore(s => s.selected_venue_id)`; renders scrollable list of venue rows; each row: `<MachineStateDot machine_state={venue.machine_state} />` + venue name `<span>`; clicking a row calls `uiStore.setSelectedVenue(venue.venue_id)`; selected row has distinct background (`#F5F5F5` or equivalent); if `isLoading`, renders 3 skeleton rows; if `isError`, renders "Failed to load venues" text with retry button that calls `refetch()`
- [ ] Create `apps/cms-operator/src/chrome/zone-a/MachineStateDot.tsx`: props `{ machine_state: MachineState; size?: number }`; LIVE → `#558B2F` filled circle; OFFLINE → `#9E9E9E` filled circle; DEGRADED → `#F59E0B` filled circle; INCIDENT → `#E64A19` filled circle; RECOVERED_BUT_UNTRUSTED → ↻ character (`\u21BB`) in `#FB923C` with CSS `animation: spin 1.5s linear infinite` keyframe (defined inline via `<style>` or CSS module); INITIALIZING / SYNCING → `#9E9E9E` circle with CSS `animation: pulse 1.5s ease-in-out infinite` opacity animation; default size 12px
- [ ] Create `apps/cms-operator/src/chrome/zone-c/ZoneC.tsx`: reads `useUiStore(s => s.zone_c_collapsed)`; if `zone_c_collapsed=true`, renders 48px wide vertical strip with expand button `>` calling `uiStore.expandZoneC()`; if `zone_c_collapsed=false`, renders 320px panel with collapse button `<` calling `uiStore.collapseZoneC()` + `children` prop content; `data-testid="zone-c"`
- [ ] Create `apps/cms-operator/src/chrome/shell/AuthGuard.tsx`: reads `useAuthStore(s => s.identity)`; if `identity === null` and current operator query is not loading, redirect to `/login` using React Router `<Navigate to="/login" replace />`; if loading, renders full-screen spinner; if authenticated, renders `<Outlet />`
- [ ] Create `apps/cms-operator/src/routes/index.tsx`: `createBrowserRouter` with routes: `{ path: '/', element: <Navigate to="/ops/live" replace /> }`, `{ path: '/login', element: <LoginPage /> }` (stub), `{ path: '/ops', element: <AuthGuard />, children: [{ path: 'live', element: <ShellLayout />, children: [{ index: true, element: <LiveOpsVenueView /> }] }] }`
- [ ] Create `apps/cms-operator/src/chrome/shell/AppProviders.tsx`: wraps app in `<QueryClientProvider client={queryClient}>` + `<RouterProvider>` + `<RealtimeProvider>` (Phase 7); export as the root provider wrapper used in `main.tsx`
- [ ] Write integration test `apps/cms-operator/src/__tests__/ShellLayout.test.tsx`: render `ShellLayout` with MSW providing all health endpoints; assert `data-testid="zone-a"` has computed width 280px; assert `data-testid="zone-c"` renders; click collapse button → assert `data-testid="zone-c"` narrows to strip

---

## Phase 6: Live Operations Surface — Zone B
**Owner:** Engineer 1 | **Target:** Days 3–4 | **Estimate:** 8 hours

- [ ] Create `apps/cms-operator/src/surfaces/live-ops/hooks/useLiveOpsVenue.ts`: reads `useUiStore(s => s.selected_venue_id)` to get current `venue_id`; composes `useVenueDetail(venue_id)` and `useVenuePlayerHealth(venue_id)`; returns `{ venue: VenueDetail | undefined; playerHealth: PlayerHealth | undefined; isLoading: boolean; isError: boolean; venueId: string | null }`; `isLoading` is true if either query is loading; `isError` is true if either query errors
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/components/VenueIdentityHeader.tsx`: props `{ venue: VenueDetail }`; renders: venue `name` as H1 (24px); venue `location` as subtitle; `<MachineStateBadge machine_state={venue.machine_state} corpus_hash_verified={venue.corpus_hash_verified} />`; `{venue.screen_count} screens` label; sticky positioned at top of Zone B content area (`position: sticky; top: 0; z-index: 10`); background white so it overlaps scrolling content; `data-testid="venue-identity-header"`
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/components/PlayerHealthCard.tsx`: props `{ card: PlayerHealthCard }`; renders: `card.label` as uppercase label (12px); `card.value` as value (20px bold); status indicator: `ok` → green dot `#558B2F`, `warn` → amber `#F59E0B`, `error` → red `#E64A19`; card has 1px border, 8px border-radius, 16px padding; `data-testid={`player-health-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}`
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/components/PlayerHealthSection.tsx`: props `{ playerHealth: PlayerHealth }`; renders `<p className="section-label">PLAYER STATUS</p>` (PATCH-019) above row of 4 `<PlayerHealthCard>` components using `playerHealth.player_cards`; renders `<p className="section-label">SIGNAL QUALITY</p>` (PATCH-019) above row of 3 `<PlayerHealthCard>` components using `playerHealth.signal_cards`; section labels are 11px uppercase grey `#757575`; cards displayed in horizontal flex row with 12px gap; `data-testid="player-health-section"`, `data-testid="signal-quality-section"`
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/utils/canPlaceOverride.ts`: export `canPlaceOverride(venue: Venue): boolean` — returns `false` if `venue.machine_state === 'RECOVERED_BUT_UNTRUSTED'`; returns `false` if `venue.corpus_hash_verified === false`; returns `false` if `venue.machine_state === 'OFFLINE'`; returns `false` if `venue.machine_state === 'DEGRADED'`; returns `false` if `venue.machine_state === 'INITIALIZING'`; returns `false` if `venue.machine_state === 'SYNCING'`; returns `false` if `venue.machine_state === 'INCIDENT'`; returns `true` only when `venue.machine_state === 'LIVE' && venue.corpus_hash_verified === true`
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/components/InterventionSurface.tsx`: props `{ venue: Venue }`; calls `canPlaceOverride(venue)` internally; if `canPlaceOverride` returns `false`, renders `<div data-testid="intervention-surface-blocked"><p>Override controls unavailable</p><p>{reason}</p></div>` where `reason` is derived from venue state (e.g. "Venue is in RECOVERED_BUT_UNTRUSTED state — awaiting corpus verification"); write control elements (`<button>`, `<input>`, `<select>` for overrides) are NOT rendered to DOM at all (not disabled, truly absent); if `canPlaceOverride` returns `true`, renders override control stubs with `data-testid="intervention-controls"` (Slice 2 will fill these in); `data-testid="intervention-surface"`
- [ ] Create `apps/cms-operator/src/surfaces/live-ops/LiveOpsVenueView.tsx`: reads `useLiveOpsVenue()`; if `venueId === null`, renders fleet summary placeholder ("Select a venue from the left panel"); if `isLoading`, renders `<SkeletonLoader lines={6} />` for Zone B content; if `isError`, renders error message with "Retry" button calling `refetch()` on both queries; if `venue` and `playerHealth` both loaded, renders `<VenueIdentityHeader venue={venue} />` + `<PlayerHealthSection playerHealth={playerHealth} />` + `<InterventionSurface venue={venue} />`; `data-testid="live-ops-venue-view"`
- [ ] Wire route `/ops/live` to `<LiveOpsVenueView />` via React Router outlet in `ShellLayout` — confirm route definition matches `apps/cms-operator/src/routes/index.tsx` from Phase 5
- [ ] On initial load of `LiveOpsVenueView`, if `selected_venue_id === null` and `useVenues()` data is available, automatically select the first venue in the list via `uiStore.setSelectedVenue(venues[0].venue_id)` in a `useEffect` with venues-list dependency
- [ ] Write unit tests `apps/cms-operator/src/surfaces/live-ops/utils/__tests__/canPlaceOverride.test.ts`: 8 test cases — (1) LIVE + verified=true → true; (2) LIVE + verified=false → false; (3) RECOVERED_BUT_UNTRUSTED + verified=true → false; (4) RECOVERED_BUT_UNTRUSTED + verified=false → false; (5) OFFLINE → false; (6) DEGRADED → false; (7) INITIALIZING → false; (8) INCIDENT → false
- [ ] Write integration test `apps/cms-operator/src/surfaces/live-ops/__tests__/LiveOpsVenueView.test.tsx`: configure MSW to return RECOVERED_BUT_UNTRUSTED venue from `GET /venues` and `GET /venues/v1/detail`; render full surface; assert `queryByTestId('intervention-controls')` is null (not in DOM); assert `getByText('LIVE — UNVERIFIED')` is present; assert `getByTestId('player-health-section')` is present

---

## Phase 7: WebSocket Integration
**Owner:** Engineer 2 | **Target:** Day 4 | **Estimate:** 4 hours

- [ ] Create `apps/cms-operator/src/chrome/shell/RealtimeProvider.tsx`: React context `RealtimeContext`; on mount, reads `authStore.identity.session_id` as token and `VITE_WS_BASE_URL` from env; instantiates `RealtimeClient({ baseUrl, getToken: () => wsToken })`; calls `client.connect()`; subscribes to all `venue_ids` from `useVenues()` data via `client.subscribe(venueIds)` in `useEffect` when venue list loads; stores client in `wsStore` via `wsStore.getState().setClient(client)`; updates `wsStore.connection_state` on connect/disconnect/reconnect events; calls `client.disconnect()` in cleanup on unmount
- [ ] Wire `<RealtimeProvider>` into `AppProviders.tsx` (Phase 5) — wraps entire app inside `QueryClientProvider` so it can call `useQueryClient()` to get React Query client
- [ ] Register `VENUE_STATE_UPDATE` handler in `RealtimeProvider`: in the provider's `useEffect`, call `client.on('VENUE_STATE_UPDATE', (payload) => venueStateUpdateHandler(payload as VenueStateUpdate, queryClient))`; call `client.off(...)` in cleanup
- [ ] Create `apps/cms-operator/src/chrome/zone-a/useZoneAVenueState.ts`: export `useZoneAVenueState()` — calls `useVenues()` and returns `{ venues: Venue[], selectedVenueId: string | null, selectVenue: (id: string) => void }`; Zone A derives state entirely from React Query cache — no separate WebSocket subscription or polling in Zone A component
- [ ] Update `ZoneAVenueSelector.tsx` (Phase 5) to use `useZoneAVenueState()` instead of direct hook calls — machine state dots automatically reflect WS-pushed updates because React Query cache update triggers re-render
- [ ] Write integration test `apps/cms-operator/src/__tests__/wsIntegration.test.tsx`: render full app with MSW WS server; fire `VENUE_STATE_UPDATE` event with `venue_id: 'v1'`, `machine_state: 'OFFLINE'`, `sequence_number: 10`; assert Zone A `MachineStateDot` for venue `v1` re-renders with grey color within 1 render cycle (use `waitFor`)
- [ ] Write integration test for stale sequence discard: render app; fire `VENUE_STATE_UPDATE` with `sequence_number: 10` changing state to OFFLINE; fire second `VENUE_STATE_UPDATE` with `sequence_number: 5` changing state to LIVE; assert final Zone A dot for that venue shows OFFLINE color (sequence=5 discarded)
- [ ] Write integration test for RECOVERED_BUT_UNTRUSTED via WS: fire `VENUE_STATE_UPDATE` with `machine_state: 'RECOVERED_BUT_UNTRUSTED'`; assert Zone A dot shows ↻ rotating icon; assert `LiveOpsVenueView` (if venue selected) re-renders showing "LIVE — UNVERIFIED" badge (requires venue detail query to also reflect updated state or invalidation triggers refetch)

---

## Phase 8: WebSocket Connection Health
**Owner:** Engineer 2 | **Target:** Day 4 (parallel continuation) | **Estimate:** 2 hours

- [ ] Verify `RealtimeClient.ts` (Phase 2) exponential backoff implementation: add unit test using Vitest fake timers (`vi.useFakeTimers()`) — call `client.connect()`, trigger WebSocket close event, assert reconnect attempted after 1000ms; trigger second close, assert next attempt after 2000ms; continue through 1000, 2000, 4000, 8000, 16000, 30000ms sequence
- [ ] Verify on reconnect `RealtimeClient` re-subscribes: in `RealtimeClient._handleReconnect()`, after WebSocket `open` event fires, call `this.subscribe(Array.from(this._subscribedVenueIds))` before setting state to CONNECTED
- [ ] Add WebSocket lifecycle events to `RealtimeClient`: emit `'connection_state_change'` event with `{ state: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED' }` on each state transition so `RealtimeProvider` can relay to `wsStore`
- [ ] `RealtimeProvider`: listen to `connection_state_change` from client; call `wsStore.getState().setConnectionState(state)`; on CONNECTED, call `wsStore.getState().setLastConnectedAt(new Date().toISOString())`
- [ ] Update `SystemStatusBar.tsx` (Phase 5): reads `useWsStore(s => s.connection_state)`; if `RECONNECTING` or `FAILED`, renders amber pill with text "Real-time updates paused — reconnecting..." positioned at right end of status bar; pill is non-blocking (no modal, no overlay); `data-testid="ws-reconnecting-indicator"`; pill absent from DOM when connection_state is `CONNECTED`
- [ ] Write unit test `apps/cms-operator/src/__tests__/SystemStatusBar.test.tsx`: mock `wsStore` to `RECONNECTING` state; render `SystemStatusBar` with MSW health endpoint; assert `getByTestId('ws-reconnecting-indicator')` is in document; mock `wsStore` to `CONNECTED`; assert `queryByTestId('ws-reconnecting-indicator')` is null

---

## Phase 9: Tests and CI Verification
**Owner:** Engineers 1 + 2 | **Target:** Day 5 | **Estimate:** 4 hours

- [ ] Audit unit test coverage for `@clubhub/ui`: run `pnpm --filter @clubhub/ui test --coverage`; must reach ≥80% line coverage; add tests for any uncovered branches in `MachineStateBadge` (LIVE/OFFLINE/DEGRADED/INCIDENT/INITIALIZING/SYNCING) and `SeverityBadge` (all 5 values)
- [ ] Audit unit test coverage for `@clubhub/state`: run `pnpm --filter @clubhub/state test --coverage`; confirm `venueStateUpdateHandler` stale-discard and fresh-update paths both covered
- [ ] Verify `canPlaceOverride` unit tests cover all 8 cases defined in Phase 6; add any missing cases
- [ ] Write integration test `apps/cms-operator/src/__tests__/slice1-happy-path.test.tsx`: MSW configured with valid operator, 3 venues (LIVE, DEGRADED, OFFLINE), system health; render app at `/ops/live`; assert `getByTestId('zone-a')` renders 3 venue rows; click LIVE venue row; assert `getByTestId('venue-identity-header')` shows venue name; assert `getByTestId('player-health-section')` renders "PLAYER STATUS" label; assert `getByTestId('signal-quality-section')` renders "SIGNAL QUALITY" label
- [ ] Write integration test `apps/cms-operator/src/__tests__/recovered-but-untrusted.test.tsx`: MSW returns single RECOVERED_BUT_UNTRUSTED venue; render app; assert Zone A dot contains ↻ character; click venue; assert `getByText('LIVE — UNVERIFIED')` in Zone B; assert `queryByTestId('intervention-controls')` returns null; assert `getByTestId('intervention-surface-blocked')` is present
- [ ] Write integration test `apps/cms-operator/src/__tests__/ws-venue-update.test.tsx`: render app with MSW WS; Zone A shows LIVE dot for venue `v1`; fire WS `VENUE_STATE_UPDATE` `{ venue_id: 'v1', machine_state: 'DEGRADED', sequence_number: 20, ... }`; `await waitFor(() => ...)` assert Zone A dot for `v1` shows amber DEGRADED color
- [ ] Run HF-REG-005 scenario (RECOVERED_BUT_UNTRUSTED override controls absent): execute `recovered-but-untrusted.test.tsx` integration test; assert all 3 assertions pass (dot correct, badge correct, controls absent from DOM) — log result as HF-REG-005 PASS
- [ ] Run `pnpm -r type-check` — must exit 0 with 0 errors across all packages and apps
- [ ] Run `pnpm -r lint` — must exit 0; fix any ESLint errors (do not use `// eslint-disable` suppressions without team lead approval)
- [ ] Run `pnpm -r test` — all test suites must pass; 0 failures; note total test count and coverage summary
- [ ] Run `pnpm -r build` — production bundles generated for `@clubhub/types`, `@clubhub/api`, `@clubhub/state`, `@clubhub/ui`, and `apps/cms-operator`; no TypeScript errors during build
- [ ] Run local dev: `pnpm --filter cms-operator dev`; navigate to `http://localhost:5173/ops/live`; verify with MSW dev server (or staging backend): Zone A shows 3+ venues with dots → click each venue → Zone B health detail renders → "PLAYER STATUS" and "SIGNAL QUALITY" labels visible

---

## Phase 10: Slice 1 Acceptance Verification
**Owner:** Engineers 1 + 2 + Engineering Lead | **Target:** Day 5 (end of day) | **Estimate:** 2 hours

- [ ] Acceptance 1 — Auth state: open React DevTools → Zustand panel → `authStore` → confirm `identity.role` and `identity.operator_id` are populated after `GET /operators/me` resolves; confirm no second fetch triggered on re-render
- [ ] Acceptance 2 — Venue list: navigate to `/ops/live`; confirm Zone A renders all venues returned by `GET /venues`; inspect DOM for each venue row: confirm `MachineStateDot` renders correct color for each `machine_state` value; if no RECOVERED_BUT_UNTRUSTED venue in live data, manually test with MSW fixture
- [ ] Acceptance 3 — Zone B health detail: click each venue; confirm Zone B renders VenueIdentityHeader (venue name + location + badge + screen count); confirm "PLAYER STATUS" label above exactly 4 cards; confirm "SIGNAL QUALITY" label above exactly 3 cards; confirm each card has label, value, and status dot
- [ ] Acceptance 4 — WS real-time update: using MSW WS or backend event trigger, fire `VENUE_STATE_UPDATE` for a venue; confirm Zone A dot updates without page refresh; measure render cycle (browser DevTools Performance tab or React DevTools Profiler) — update must complete within 1 render cycle
- [ ] Acceptance 5 — RECOVERED_BUT_UNTRUSTED: trigger RECOVERED_BUT_UNTRUSTED state on test venue; confirm Zone A dot is ↻ rotating orange (`#FB923C`); confirm Zone B `MachineStateBadge` displays "LIVE — UNVERIFIED" as single amber pill; open browser DevTools Elements tab and confirm no `<button>`, `<input>`, or `<select>` override control elements exist anywhere in `InterventionSurface` DOM tree
- [ ] Acceptance 6 — System Status Bar: inspect `SystemStatusBar` — confirm `constitutional_state` text is rendered; confirm status indicator pills reflect current system health state from `GET /system/health`
- [ ] Acceptance 7 — Unit tests: run `pnpm --filter @clubhub/ui test`; confirm `SeverityBadge`, `MachineStateBadge`, `TabBadge` test suites all PASS with 0 failures; confirm total test count ≥ 14 for these 3 components
- [ ] Acceptance 8 — Type safety: run `pnpm -r type-check`; confirm output shows 0 errors; screenshot or copy terminal output for sign-off record
- [ ] Sign-off: engineering lead reviews all 8 acceptance criteria at `http://localhost:5173/ops/live` (or staging); signs off in Slice 1 sign-off document or PR comment; Slice 1 is COMPLETE only when all 8 acceptances are verified by engineering lead

---

## Slice 1 Estimated Timeline

| Phase | Engineer 1 | Engineer 2 | Hours |
|-------|-----------|-----------|-------|
| Phase 1: Types | Primary | — | 4h |
| Phase 2: API Client | — | Primary | 4h |
| Phase 3: State Layer | Primary | — | 4h |
| Phase 4: Shared UI | — | Primary | 4h |
| Phase 5: Chrome | Both | Both | 6h |
| Phase 6: Live Ops Zone B | Primary | — | 8h |
| Phase 7: WS Integration | — | Primary | 4h |
| Phase 8: WS Health | — | Primary | 2h |
| Phase 9: Tests + CI | Both | Both | 4h |
| Phase 10: Verification | Both + Lead | Both + Lead | 2h |
| **Total** | | | **~42 engineer-hours (~1 week for 2 engineers)** |

### Parallelism Notes

- Phases 1 and 2 run in parallel (Day 1): no dependency between types authoring and API client scaffolding
- Phases 3 and 4 run in parallel (Day 2): state layer depends on types (Phase 1); UI components depend on types (Phase 1); neither depends on the other
- Phase 5 begins once Phases 3 and 4 are complete (Day 3): chrome components need state hooks and UI components
- Phase 6 begins once Phase 5 shell is available (Day 3–4): Zone B surface builds on chrome structure
- Phases 7 and 8 run concurrently with Phase 6 (Day 4): WebSocket integration is independent of Zone B content work
- Phases 9 and 10 require all prior phases complete (Day 5)

### Definition of Done

Slice 1 is complete when:
1. All 10 phases have every checklist item checked
2. All 8 acceptance criteria verified by engineering lead
3. `pnpm -r type-check && pnpm -r lint && pnpm -r test && pnpm -r build` all exit 0 in CI
4. PR merged to main with CI green
