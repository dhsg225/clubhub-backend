# Frontend Module Boundary Map v1

**Document:** FRONTEND-MODULE-BOUNDARY-MAP-v1
**Status:** AUTHORITATIVE — engineering-ready specification
**Platform:** ClubHub TV Operator CMS — React + TypeScript monorepo
**Date:** 2026-06-03

---

## Purpose

This document defines the module boundaries, ownership rules, forbidden dependencies, component interfaces, bundle strategy, and state ownership for the ClubHub TV operator CMS frontend. A frontend team can use this document directly to scaffold the application without further architectural decisions.

This document is downstream of the frontend blueprint era documents (routes/navigation, component taxonomy, data contracts, event/interaction model, workspace assembly blueprint) and is the authoritative reference for implementation-time boundary enforcement.

---

## 1. Monorepo Package Structure

```
apps/
  cms-operator/              — main operator CMS application

packages/
  @clubhub/ui/               — shared UI component library
  @clubhub/state/            — shared state (global Zustand stores, React Query config)
  @clubhub/api/              — API client (typed fetch wrappers, WebSocket client)
  @clubhub/types/            — shared TypeScript types (no logic, no imports)
  @clubhub/hooks/            — shared React hooks
```

### 1.1 `apps/cms-operator/`

**Owns:**
- All 5 operator surface modules (live-ops, incident-command, replay-investigation, cms-operations, venue-ops)
- Chrome modules (system-status-bar, zone-a, zone-c, shell)
- App-level route configuration
- App-level state slices that are surface-local
- Entry point, environment config, Vite/bundler config

**Exports:** Nothing. This is a deployable application, not a library.

**Forbidden to import from:**
- Nothing is forbidden at the app level by default; however, internal cross-surface imports are governed by Section 5.

---

### 1.2 `@clubhub/ui/`

**Owns:**
- All shared, stateless UI components used by two or more surfaces
- Visual tokens consumed by components (color constants, spacing, typography)
- Component-level CSS modules or styled component definitions
- Storybook stories for each component

**Exports:**
- All shared components listed in Section 4 (Shared UI components)
- Component prop interfaces (re-exported from `@clubhub/types`)
- No internal implementation details

**Forbidden to import from:**
- Any surface module (`apps/cms-operator/src/surfaces/*`)
- `@clubhub/state` — UI components are stateless; they receive all state as props
- `@clubhub/hooks` — hooks that read from global stores must not leak into the UI library
- Any `apps/` code
- Any node server-side packages

**Rationale:** `@clubhub/ui` must be publishable and testable in isolation. Coupling to state or app code makes Storybook development and unit testing prohibitively difficult.

---

### 1.3 `@clubhub/state/`

**Owns:**
- Global Zustand store factory and middleware (devtools, persist configuration)
- React Query client configuration (retry policies, stale times, cache keys by domain)
- WebSocket client state slice (`WebSocketState`)
- Store subscription utilities (e.g., `subscribeToIncidentEvents`)
- Type-safe store slice constructors

**Exports:**
- `createStore(sliceName, initialState, actions)` — factory for consistent store slices
- `queryClient` — configured React Query client instance
- `WebSocketState` store and `useWebSocket()` hook
- Store middleware (logging, performance measurement)
- `useStoreSlice(sliceName)` — typed slice accessor

**Forbidden to import from:**
- Any surface module
- `@clubhub/ui`
- Any `apps/` code
- Browser-specific APIs at module load time (must be deferred to runtime)

---

### 1.4 `@clubhub/api/`

**Owns:**
- All typed fetch wrapper functions organized by API domain
- WebSocket connection management and reconnection logic
- API error types and error normalization
- Request/response interceptors (auth token injection, 401 refresh)
- API base URL configuration and environment switching

**Exports (by domain):**
- `venueApi` — venue CRUD and status queries
- `incidentApi` — incident lifecycle, commander assignment, override placement
- `replayApi` — session creation, playback control, annotations
- `cmsApi` — content, corpus delivery, scheduling, training mode
- `authApi` — login, refresh, session termination
- `adminApi` — platform-admin endpoints (ADMIN role only)
- `wsClient` — WebSocket client with reconnect and event subscription

**Forbidden to import from:**
- Any surface module
- `@clubhub/ui`
- Any `apps/` code

**Rationale:** `@clubhub/api` must be testable against a mock server without instantiating any React tree. Surface coupling would prevent this.

---

### 1.5 `@clubhub/types/`

**Owns:**
- All shared TypeScript type definitions and interfaces
- Enums and string literal union types used across packages
- API response shape types (matching backend contracts)
- Domain model types (Venue, Incident, Override, CorpusEntry, etc.)

**Exports:** All types. No runtime code — pure `.d.ts`-compatible TypeScript.

**Forbidden to import from:**
- Anything. This is an absolute leaf package. It has zero runtime dependencies and zero imports from other workspace packages.

**Enforcement:** `tsconfig.json` for this package sets `"noImplicitAny": true` and the package has no `dependencies` or `peerDependencies` entries other than TypeScript itself.

---

### 1.6 `@clubhub/hooks/`

**Owns:**
- Shared React hooks that compose state and API calls
- Hooks used by two or more surfaces (e.g., `useVenueStatus`, `useIncidentList`)
- Hooks that encapsulate React Query query definitions

**Exports:**
- `useVenueStatus(venueId: string)` — venue machine state + trust state
- `useIncidentList(filters?)` — active incident list with real-time updates
- `useOperatorRole()` — current user role from AuthState
- `useReplayGuard()` — IC-03 enforcement hook (see Section 9)
- `useNotifications()` — notification tray state
- `useSystemHealth()` — system health indicators for StatusBar

**Forbidden to import from:**
- Any surface module
- `@clubhub/ui`
- Any `apps/` code

---

## 2. App Module Structure

Full folder structure for `apps/cms-operator/src/`:

```
apps/cms-operator/src/
  surfaces/
    live-ops/
      components/          — surface-specific components
      hooks/               — surface-local hooks
      state/               — LiveOpsState slice
      api/                 — live-ops-specific query definitions
      LiveOpsShell.tsx     — surface root, mounts in Zone B
      LiveOpsVenueView.tsx — default venue detail view
      FleetView.tsx        — fleet grid view
      index.ts             — explicit surface exports (shell component only)

    incident-command/
      components/
        IncidentIdentityBar.tsx
        CommanderStatus.tsx
        AssumeCommandConfirmCard.tsx
        L6OverridePlacementFlow.tsx
        L6OverrideRemovalFlow.tsx
        IncidentTab1Overview.tsx
        IncidentTab2Timeline.tsx
        IncidentTab3Evidence.tsx
        IncidentTab4Overrides.tsx
        IncidentTab5Comms.tsx
        IncidentTab6Admin.tsx  — ADMIN role only; absent from DOM for all others
      hooks/
        useIncidentCommand.ts
        useCommanderAssignment.ts
        useL6PlacementGuard.ts
      state/               — IncidentState slice
      api/
      IncidentCommandShell.tsx
      IncidentCommandView.tsx
      index.ts

    replay-investigation/
      components/
        ReplayTransportControls.tsx
        TimelineScrubber.tsx
        CollaboratorPips.tsx
        ReplayTab1Playback.tsx
        ReplayTab2StateInspector.tsx
        ReplayTab3Annotations.tsx
        ReplayTab4Corpus.tsx
        ReplayTab5AuditTrail.tsx
        ReplayTab6Admin.tsx  — ADMIN role only
      hooks/
        useReplaySession.ts
        useReplayTransport.ts
        useReplayAnnotation.ts
      state/               — ReplayState slice
      api/
      ReplayShell.tsx
      ReplayView.tsx
      index.ts

    cms-operations/
      components/
        CMSCalendarGrid.tsx
        DeliveryConfidencePanel.tsx
        TrainingModeToggle.tsx
        CMSContentTab.tsx
        CMSScheduleTab.tsx
        CMSCorpusTab.tsx
        CMSDeliveryTab.tsx
      hooks/
        useCMSContent.ts
        useTrainingMode.ts
        useDeliveryStatus.ts
      state/               — CMSState slice
      api/
      CMSShell.tsx
      CMSView.tsx
      CMSVenueView.tsx
      index.ts

    venue-ops/
      components/
        VenueStatusDashboard.tsx
        AutonomyClock.tsx
        MachineStateHistoryStrip.tsx
        VenueScreenGrid.tsx
        VenueNetworkStatus.tsx
      hooks/
        useVenueOps.ts
        useAutonomyClock.ts
      state/               — VenueOpsState slice
      api/
      VenueOpsShell.tsx
      VenueOpsView.tsx
      index.ts

  chrome/
    system-status-bar/
      SystemStatusBar.tsx
      SystemStatusBar.css
      index.ts

    zone-a/
      ZoneA.tsx
      ZoneAVenueSelector.tsx
      ZoneAIncidentList.tsx
      ZoneANotificationTray.tsx
      ZoneAOperatorTools.tsx
      hooks/
        useZoneAState.ts
      index.ts

    zone-c/
      ZoneC.tsx            — collapsible wrapper; renders surface-provided content
      index.ts

    shell/
      ShellLayout.tsx      — root layout: StatusBar + ZoneA + ZoneB + ZoneC
      ZoneBAutoReplace.tsx — ZONE_B_AUTO_REPLACE handler + PATCH-014 banner
      WebSocketProvider.tsx
      AuthGuard.tsx
      AppProviders.tsx     — wraps QueryClientProvider, WebSocketProvider, etc.
      index.ts

  routes/
    AppRouter.tsx          — root React Router v6 configuration
    routeConfig.ts         — typed route definitions (see Section 3)
    guards/
      RoleGuard.tsx        — role-based access control wrapper
      ReplayRouteGuard.tsx — ensures replay session exists before mounting surface

  state/
    authState.ts           — AuthState slice (owns: current user, role, session)
    uiState.ts             — UIState slice (owns: Zone C open/closed, active tab)
    index.ts

  main.tsx                 — React entry point
  vite.config.ts
  tsconfig.json
```

### 2.1 Surface Module Contracts

Each surface module contract below defines: what it renders in Zone B, what state it consumes, what API calls it makes, and what it is forbidden to do.

#### `surfaces/live-ops/`

**Renders in Zone B:** Fleet status grid or single-venue live view with screen thumbnails, machine state indicators, and entropy advisory cards.

**State consumed (read):**
- `AuthState.role` — governs which controls are visible
- `SystemHealthState` — platform-level connectivity indicator in Zone B header
- `ActiveIncidentsState` (read only from chrome/zone-a) — incident badge overlay on venue cards

**State owned:**
- `LiveOpsState` — selected venue, view mode (fleet/single), filter state

**API calls:**
- `venueApi.listVenues()` via React Query
- `venueApi.getVenueStatus(venueId)` with polling interval
- WebSocket subscription to `VENUE_STATE_CHANGED` events

**Forbidden:**
- MUST NOT read or write `IncidentState`, `ReplayState`, `CMSState`, `VenueOpsState`
- MUST NOT render the IncidentCommandView or any incident-command/ component
- MUST NOT make API calls to `incidentApi`, `replayApi`, `cmsApi`

---

#### `surfaces/incident-command/`

**Renders in Zone B:** Incident identity bar, commander status, 6-tab panel (Tab 6 absent from DOM unless `AuthState.role === 'ADMIN'`). Override placement and removal flows.

**State consumed (read):**
- `AuthState.role`
- `ReplayState.is_replay_mode` via `useReplayGuard()` — all write controls absent when true

**State owned:**
- `IncidentState` — incident detail, commander assignment, active tab, override list

**API calls:**
- `incidentApi.getIncident(incidentId)`
- `incidentApi.assumeCommand(incidentId)`
- `incidentApi.placeOverride(incidentId, overrideParams)`
- `incidentApi.removeOverride(incidentId, overrideId)`
- WebSocket subscription to `INCIDENT_UPDATED`, `OVERRIDE_CHANGED`, `COMMANDER_CHANGED`

**Forbidden:**
- MUST NOT import from any other surface module
- MUST NOT render any write control without first calling `useReplayGuard()` and returning `null` when `isReplayMode === true`
- MUST NOT render Tab 6 (`IncidentTab6Admin`) when `AuthState.role !== 'ADMIN'` — the tab must be absent from the DOM, not hidden or disabled
- MUST NOT call `venueApi`, `replayApi`, or `cmsApi` directly (use `incidentApi` only)

---

#### `surfaces/replay-investigation/`

**Renders in Zone B:** Replay transport controls, timeline scrubber, state inspector tabs, annotation panel (Tab 3). Tab 6 absent from DOM unless ADMIN.

**State consumed (read):**
- `AuthState.role`

**State owned:**
- `ReplayState` — `is_replay_mode` (always `true`), session metadata, playback position, annotations

**API calls:**
- `replayApi.getSession(sessionId)`
- `replayApi.getTimeline(sessionId)`
- `replayApi.addAnnotation(sessionId, annotation)` — Tab 3 only, permitted in REPLAY mode
- `replayApi.getAuditTrail(sessionId)`

**Forbidden:**
- MUST NOT import from any other surface module
- MUST NOT render any write control except annotation submission (Tab 3)
- All non-annotation write controls must be absent from the DOM — `useReplayGuard()` must be called at each write control site
- Tab 6 absent from DOM unless `AuthState.role === 'ADMIN'`

---

#### `surfaces/cms-operations/`

**Renders in Zone B:** Content calendar grid, delivery confidence panel, corpus status, training mode toggle (CONTENT_MANAGER and ADMIN only). Tab routing via `?tab=` query parameter.

**State consumed (read):**
- `AuthState.role`

**State owned:**
- `CMSState` — active tab, training_mode flag, selected content, delivery status, filter state

**API calls:**
- `cmsApi.listContent(filters?)`
- `cmsApi.getDeliveryStatus(venueId?)`
- `cmsApi.getCorpusStatus()`
- `cmsApi.setTrainingMode(enabled)` — CONTENT_MANAGER and ADMIN only
- `cmsApi.submitContent(contentPayload)` — behavior differs in training_mode (see training mode constraints)

**Training mode constraints:**
- When `CMSState.training_mode === true`, `cmsApi.submitContent` sends to a sandboxed endpoint; no production corpus mutation occurs
- The `TrainingModeToggle` component is absent from the DOM for VIEWER and OPERATOR roles
- The `TrainingModeBanner` (from `@clubhub/ui`) is rendered in Zone B header whenever `training_mode === true`

**Forbidden:**
- MUST NOT import from any other surface module
- MUST NOT call `incidentApi`, `replayApi`, or `venueApi`
- MUST NOT allow VIEWER role to submit or modify content — submission controls absent from DOM

---

#### `surfaces/venue-ops/`

**Renders in Zone B:** Venue status dashboard, autonomy clock (72-hour countdown), machine state history strip, screen grid with per-screen status.

**State consumed (read):**
- `AuthState.role`

**State owned:**
- `VenueOpsState` — selected venue, active screen, machine state history, autonomy clock state

**API calls:**
- `venueApi.getVenueDetail(venueId)`
- `venueApi.getMachineStateHistory(venueId)`
- `venueApi.getScreenList(venueId)`
- `venueApi.getAutonomyStatus(venueId)` — returns `expires_at` for `CountdownClock`

**Forbidden:**
- MUST NOT import from any other surface module
- MUST NOT call `incidentApi`, `replayApi`, or `cmsApi`
- MUST NOT display RECOVERED_BUT_UNTRUSTED state without rendering the `MachineStateBadge` LIVE—UNVERIFIED pill (enforced by using the shared component)

---

## 3. Route Ownership

All route definitions live in `apps/cms-operator/src/routes/routeConfig.ts`. The table below is the authoritative route inventory.

### 3.1 Route Definitions

| Path | Component | Role Guard | Zone B Content | Title |
|------|-----------|------------|----------------|-------|
| `/` | Redirect | None | — | — |
| `/login` | `LoginPage` | None (no auth) | Full-screen, no chrome | Sign In |
| `/ops/live` | `LiveOpsShell` | VIEWER+ | `LiveOpsVenueView` (default venue) | Live Operations |
| `/ops/fleet` | `LiveOpsShell` | VIEWER+ | `FleetView` (all venues grid) | Fleet Overview |
| `/ops/venues/:venue_id` | `VenueOpsShell` | VIEWER+ | `VenueOpsView` | Venue Operations |
| `/ops/incidents/:id` | `IncidentCommandShell` | VIEWER+ | `IncidentCommandView` | Incident Command |
| `/ops/replay/:session_id` | `ReplayShell` | VIEWER+ | `ReplayView` | Replay Investigation |
| `/ops/cms` | `CMSShell` | CONTENT_MANAGER+ | `CMSView` (tab via `?tab=`) | Content Operations |
| `/ops/cms/:venue_id` | `CMSShell` | CONTENT_MANAGER+ | `CMSVenueView` | Venue Content |
| `/admin/*` | `AdminShell` | ADMIN only | Admin panel routes | Platform Admin |
| `*` (catch-all) | `NotFoundPage` | None | Full-screen, no chrome | Not Found |

### 3.2 Role Guard Behavior

Role guards redirect, they do not render error pages. The following table defines the exact redirect target for each role on each restricted route.

**VIEWER accessing `/ops/cms` or `/ops/cms/:venue_id`:**
- Redirect to `/ops/live`
- No error message is shown; the redirect is silent

**VIEWER accessing `/admin/*`:**
- Redirect to `/ops/live`

**OPERATOR accessing `/admin/*`:**
- Redirect to `/ops/live`

**CONTENT_MANAGER accessing `/admin/*`:**
- Redirect to `/ops/live`

**Unauthenticated user accessing any `/ops/*` or `/admin/*` route:**
- Redirect to `/login?return_to=<encoded_path>`
- After successful login, redirect to `return_to` if valid, otherwise `/ops/live`

**Any authenticated role accessing `/login`:**
- Redirect to `/ops/live` (already authenticated)

**`/` (root):**
- Always redirect to `/ops/live` (no role check needed; the `/ops/live` route itself handles auth)

### 3.3 Zone B Auto-Replace Behavior

When a `ZONE_B_AUTO_REPLACE` event is received from the WebSocket (S1 or S2 incident created or escalated):
- `ZoneBAutoReplace` in `chrome/shell/ZoneBAutoReplace.tsx` intercepts the event
- Zone B content is replaced with the `IncidentCommandView` for the triggering incident
- A PATCH-014 banner is displayed at the top of Zone B: amber background, "Auto-navigated to incident — [return link]"
- The browser URL updates to `/ops/incidents/:id` via `useNavigate()`
- The previous Zone B scroll position is discarded

Auto-replace does NOT trigger for S3–S5 incidents. Those incidents appear in the Zone A incident list only.

### 3.4 Route Implementation

```typescript
// apps/cms-operator/src/routes/AppRouter.tsx
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RoleGuard } from './guards/RoleGuard';
import { ShellLayout } from '../chrome/shell';

const LiveOpsShell = lazy(() => import('../surfaces/live-ops'));
const IncidentCommandShell = lazy(() => import('../surfaces/incident-command'));
const ReplayShell = lazy(() => import('../surfaces/replay-investigation'));
const CMSShell = lazy(() => import('../surfaces/cms-operations'));
const VenueOpsShell = lazy(() => import('../surfaces/venue-ops'));
const AdminShell = lazy(() => import('../surfaces/admin'));

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ShellLayout />,
    children: [
      { index: true, element: <Navigate to="/ops/live" replace /> },
      { path: 'ops/live', element: <Suspense fallback={<SurfaceLoader />}><LiveOpsShell /></Suspense> },
      { path: 'ops/fleet', element: <Suspense fallback={<SurfaceLoader />}><LiveOpsShell viewMode="fleet" /></Suspense> },
      { path: 'ops/venues/:venue_id', element: <Suspense fallback={<SurfaceLoader />}><VenueOpsShell /></Suspense> },
      { path: 'ops/incidents/:id', element: <Suspense fallback={<SurfaceLoader />}><IncidentCommandShell /></Suspense> },
      { path: 'ops/replay/:session_id', element: <Suspense fallback={<SurfaceLoader />}><ReplayShell /></Suspense> },
      {
        path: 'ops/cms',
        element: (
          <RoleGuard requiredRole="CONTENT_MANAGER" fallback="/ops/live">
            <Suspense fallback={<SurfaceLoader />}><CMSShell /></Suspense>
          </RoleGuard>
        ),
      },
      { path: 'ops/cms/:venue_id', element: (
          <RoleGuard requiredRole="CONTENT_MANAGER" fallback="/ops/live">
            <Suspense fallback={<SurfaceLoader />}><CMSShell /></Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'admin/*',
        element: (
          <RoleGuard requiredRole="ADMIN" fallback="/ops/live">
            <Suspense fallback={<SurfaceLoader />}><AdminShell /></Suspense>
          </RoleGuard>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

---

## 4. Component Ownership

### 4.1 Chrome Components

Chrome components are owned by the `chrome/` module. They are NOT importable by surface modules. Surfaces do not import `ZoneA`, `SystemStatusBar`, `ShellLayout`, or `ZoneC`.

**`SystemStatusBar`** (`chrome/system-status-bar/SystemStatusBar.tsx`)
- Height: 48px, always visible
- Receives `SystemHealthState` from global state via `useSystemHealth()` hook
- Renders: connection status, platform health indicators, current operator name, global alert count
- Owns no local state; reads only from global stores

**`ZoneA`** (`chrome/zone-a/ZoneA.tsx`)
- Width: 280px, fixed
- Renders `ZoneAVenueSelector`, `ZoneAIncidentList`, `ZoneANotificationTray`, `ZoneAOperatorTools` in order
- Owns `ZoneAState` (local: collapsed sections, scroll positions)
- Reads `ActiveIncidentsState` (owned by this module, written by WebSocket handler)
- Reads `AuthState.role` to conditionally render operator-only tools

**`ZoneAVenueSelector`** (`chrome/zone-a/ZoneAVenueSelector.tsx`)
- Renders venue list with `MachineStateBadge` per venue
- Clicking a venue navigates to `/ops/venues/:venue_id`
- Active venue is highlighted based on current URL

**`ZoneAIncidentList`** (`chrome/zone-a/ZoneAIncidentList.tsx`)
- Renders active incidents with `SeverityBadge` per incident
- Clicking an incident navigates to `/ops/incidents/:id`
- Severity colors per PATCH-004: S1 `#C62828`, S2 `#E65100`, S3 `#F9A825`, S4 `#1565C0`, S5 `#558B2F`

**`ZoneANotificationTray`** (`chrome/zone-a/ZoneANotificationTray.tsx`)
- Badge count on collapsed state
- Expands into tray drawer showing notification list
- Reads `NotificationState`

**`ZoneAOperatorTools`** (`chrome/zone-a/ZoneAOperatorTools.tsx`)
- Operator menu (profile, preferences, sign out)
- Training mode indicator strip (PATCH-006): 24px amber strip rendered when `CMSState.training_mode === true` — reads CMSState via a shared selector, does not own it
- Absent from DOM for VIEWER role: the menu strip collapses to profile/sign-out only

**`ZoneC`** (`chrome/zone-c/ZoneC.tsx`)
- Width: 320px, collapsible
- Receives Zone C content as a render prop from the active surface shell
- Manages open/closed state in `UIState.zoneCOpen`
- When collapsed: renders 40px tab with label
- Surfaces inject their Zone C panel content via the `ZoneC` outlet in `ShellLayout`

**`ShellLayout`** (`chrome/shell/ShellLayout.tsx`)
- Root layout component
- Composes: `SystemStatusBar` + `ZoneA` + Zone B (React Router `<Outlet />`) + `ZoneC`
- Mounts `WebSocketProvider` and `ZoneBAutoReplace` as siblings
- Wraps all children in `AuthGuard` (redirects unauthenticated users to `/login`)

**`ZoneBAutoReplace`** (`chrome/shell/ZoneBAutoReplace.tsx`)
- Subscribes to `ZONE_B_AUTO_REPLACE` WebSocket events
- On S1/S2 incident events: calls `useNavigate()` to push `/ops/incidents/:id`
- Renders PATCH-014 amber return banner in Zone B header after auto-replace
- Auto-replace logic lives here, not in any surface

---

### 4.2 Shared UI Components

All components below are owned by `packages/@clubhub/ui/`. They are importable by all surfaces and chrome modules. They are stateless — all state is received as props.

**`SeverityBadge`**
```typescript
interface SeverityBadgeProps {
  severity: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  size?: 'sm' | 'md' | 'lg';     // default: 'md'
  showLabel?: boolean;            // default: true
}
```
Color map: S1 `#C62828`, S2 `#E65100`, S3 `#F9A825`, S4 `#1565C0`, S5 `#558B2F`. Label text is the severity string (e.g., "S1").

**`MachineStateBadge`**
```typescript
interface MachineStateBadgeProps {
  machine_state: MachineState;           // from @clubhub/types
  corpus_hash_verified?: boolean;        // default: true
  trust_state?: TrustState;             // from @clubhub/types
  // PATCH-009: renders amber "LIVE—UNVERIFIED" pill when
  // machine_state === 'RECOVERED_BUT_UNTRUSTED'
}
```

**`HoldToConfirmButton`** (PATCH-002)
```typescript
interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  holdDuration?: number;    // ms, default: 3000
  disabled?: boolean;
  variant: 'danger' | 'warning';
  // Renders progress arc during hold
  // Fires onConfirm only on full hold completion
  // Cancels on pointer/touch release before completion
  // Cancels on disabled change to true during hold
}
```

**`SequentialChipSelect`** (PATCH-001)
```typescript
interface SequentialChipSelectProps {
  steps: Array<{
    label: string;
    confirmLabel: string;
  }>;
  onAllStepsConfirmed: () => void;
  onReset?: () => void;
  // All steps must be completed in sequence; completing step N unlocks step N+1
  // Navigating away resets progress automatically (useEffect cleanup on unmount)
  // Used for L6 override placement flow (3 steps)
}
```

**`ReplayBanner`**
```typescript
interface ReplayBannerProps {
  sessionId: string;
  sessionStartedAt: string;   // ISO 8601
  // Renders 28px amber persistent banner
  // Text: "REPLAY MODE — [session date/time] — [return link to live view]"
  // IC-03 visual enforcement: always visible in Replay surface
  // Cannot be dismissed
}
```

**`CountdownClock`**
```typescript
interface CountdownClockProps {
  expires_at: string;       // ISO 8601, server-authoritative
  onExpired?: () => void;
  size?: 'sm' | 'md' | 'lg';
  // Renders amber when remaining time > 24h
  // Renders red when remaining time 6–24h
  // Renders pulsing red when remaining time < 6h
  // Calls onExpired() when countdown reaches zero
}
```
Used by `VenueOpsView` for the 72-hour autonomy clock.

**`AdvisoryCard`** (A-NEW-01)
```typescript
interface AdvisoryCardProps {
  content: string;
  advisory_level: 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';
  // Visual state is derived entirely from advisory_level:
  // INFORMATIONAL: blue border, white background
  // RECOMMENDED: amber border, amber-tinted background
  // URGENT: red border, red-tinted background, bold label
  // Rendered in Zone C Pane C4
  // Content is rendered as plain text (no HTML injection)
}
```

**`RejectionToast`** (A-NEW-04)
```typescript
type RejectionType =
  | 'VALIDATION_ERROR'        // persists until dismissed
  | 'PERMISSION_DENIED'       // persists until dismissed
  | 'CONFLICT_DETECTED'       // persists until dismissed
  | 'SYSTEM_UNAVAILABLE';     // auto-dismiss after 8000ms

interface RejectionToastProps {
  type: RejectionType;
  message: string;
  onDismiss?: () => void;
  // Persistence behavior is determined by type, not by caller
  // SYSTEM_UNAVAILABLE auto-dismisses; others require explicit dismiss
}
```

**`TabBadge`**
```typescript
interface TabBadgeProps {
  type: 'red' | 'amber' | 'green';
  count?: number;              // if provided, renders count inside badge
  // Used for PATCH-010 tab dot badges on incident and replay tabs
}
```

**`PresenceAvatars`** (A-NEW-03)
```typescript
interface PresenceAvatarsProps {
  collaborators: Array<{
    operatorId: string;
    displayName: string;
    role: OperatorRole;
    currentPosition: string;   // e.g., "Tab 2", "Zone C"
    avatarUrl?: string;
  }>;
  maxVisible?: number;         // default: 4, remainder shown as +N
}
```

**`TrainingModeBanner`** (PATCH-006)
```typescript
interface TrainingModeBannerProps {
  // No props — reads from context or is rendered only when parent confirms training_mode: true
  // 24px amber strip
  // Text: "TRAINING MODE — submissions will not affect production content"
  // Cannot be dismissed
  // Always rendered by the parent when training_mode is active; not self-determining
}
```

---

### 4.3 Surface-Specific Components

The following components are owned by their respective surface module and are NOT exported to other surfaces or to chrome modules. These are internal implementation details of each surface.

**`incident-command/` owns:**
- `IncidentIdentityBar` — incident number, severity badge, venue name, created time
- `CommanderStatus` — current commander name/role, time-in-command, handoff button
- `AssumeCommandConfirmCard` — confirmation card with HoldToConfirmButton for commander assumption
- `L6OverridePlacementFlow` — wraps `SequentialChipSelect` + `incidentApi.placeOverride()` call; 3-step confirmation flow
- `L6OverrideRemovalFlow` — wraps `HoldToConfirmButton` + `incidentApi.removeOverride()` call
- `IncidentTab1Overview` through `IncidentTab6Admin` — individual tab panels

**`replay-investigation/` owns:**
- `ReplayTransportControls` — play/pause/step controls for replay playback
- `TimelineScrubber` — timeline seek bar with event markers
- `CollaboratorPips` — small avatars showing where other viewers are in the timeline (read-only display)
- `ReplayTab1Playback` through `ReplayTab6Admin` — individual tab panels

**`cms-operations/` owns:**
- `CMSCalendarGrid` — 72h+ content calendar with delivery windows
- `DeliveryConfidencePanel` — per-venue delivery confidence indicators (72h rule enforcement)
- `TrainingModeToggle` — toggle control (absent from DOM for VIEWER and OPERATOR roles)
- `CMSContentTab`, `CMSScheduleTab`, `CMSCorpusTab`, `CMSDeliveryTab` — individual tab panels

**`venue-ops/` owns:**
- `VenueStatusDashboard` — aggregated venue health summary
- `AutonomyClock` — wraps `CountdownClock` with venue-specific `expires_at` from `VenueOpsState`
- `MachineStateHistoryStrip` — horizontal strip of machine state transitions over time
- `VenueScreenGrid` — per-screen status cards with `MachineStateBadge`

---

## 5. Forbidden Dependencies

These rules must be enforced via ESLint module boundary tooling (e.g., `eslint-plugin-boundaries` or `eslint-plugin-import` with zone configuration). Violations must be CI-blocking.

### 5.1 Cross-Surface Isolation

All surface modules are isolated from each other. No surface may import from any other surface.

```
surfaces/incident-command/     MUST NOT import from surfaces/replay-investigation/
surfaces/incident-command/     MUST NOT import from surfaces/cms-operations/
surfaces/incident-command/     MUST NOT import from surfaces/venue-ops/
surfaces/incident-command/     MUST NOT import from surfaces/live-ops/

surfaces/replay-investigation/ MUST NOT import from surfaces/incident-command/
surfaces/replay-investigation/ MUST NOT import from surfaces/cms-operations/
surfaces/replay-investigation/ MUST NOT import from surfaces/venue-ops/
surfaces/replay-investigation/ MUST NOT import from surfaces/live-ops/

surfaces/cms-operations/       MUST NOT import from surfaces/incident-command/
surfaces/cms-operations/       MUST NOT import from surfaces/replay-investigation/
surfaces/cms-operations/       MUST NOT import from surfaces/venue-ops/
surfaces/cms-operations/       MUST NOT import from surfaces/live-ops/

surfaces/venue-ops/            MUST NOT import from surfaces/incident-command/
surfaces/venue-ops/            MUST NOT import from surfaces/replay-investigation/
surfaces/venue-ops/            MUST NOT import from surfaces/cms-operations/
surfaces/venue-ops/            MUST NOT import from surfaces/live-ops/

surfaces/live-ops/             MUST NOT import from surfaces/incident-command/
surfaces/live-ops/             MUST NOT import from surfaces/replay-investigation/
surfaces/live-ops/             MUST NOT import from surfaces/cms-operations/
surfaces/live-ops/             MUST NOT import from surfaces/venue-ops/
```

### 5.2 Surface-to-Chrome Isolation

Surface modules do not reach into chrome. Chrome pushes Zone C content via a render prop/outlet pattern; surfaces do not import chrome components.

```
surfaces/*   MUST NOT import from chrome/zone-a/
surfaces/*   MUST NOT import from chrome/system-status-bar/
surfaces/*   MUST NOT import from chrome/shell/ShellLayout
surfaces/*   MUST NOT import from chrome/shell/ZoneBAutoReplace
```

**Zone C injection pattern:** Each surface shell component returns a `zoneCContent` prop or uses a React context provided by `ShellLayout`. The surface does not import `ZoneC` — it exports a Zone C panel component and the shell wires it into `ZoneC`.

```typescript
// Correct pattern — surface exports its Zone C panel
// apps/cms-operator/src/surfaces/incident-command/IncidentCommandShell.tsx
export function IncidentCommandShell() {
  return (
    <SurfaceShellWrapper zoneCContent={<IncidentZoneCPanel />}>
      <IncidentCommandView />
    </SurfaceShellWrapper>
  );
}

// SurfaceShellWrapper in chrome/shell/ reads the zoneCContent prop
// and forwards it to ZoneC — the surface never imports ZoneC directly
```

### 5.3 `@clubhub/ui` Isolation

```
@clubhub/ui   MUST NOT import from surfaces/*
@clubhub/ui   MUST NOT import from @clubhub/state
@clubhub/ui   MUST NOT import from @clubhub/hooks (except useReplayGuard — see exception below)
@clubhub/ui   MUST NOT import from apps/*
```

**Exception:** `@clubhub/ui` components may accept callback props (e.g., `onConfirm`) that the caller connects to state. The component itself does not call hooks that read from global stores.

### 5.4 `@clubhub/types` Isolation

```
@clubhub/types   MUST NOT import from anything
```

This is enforced by having zero entries in `package.json` dependencies. Any type that needs to reference another type must be defined within `@clubhub/types` itself.

### 5.5 `@clubhub/api` Isolation

```
@clubhub/api   MUST NOT import from surfaces/*
@clubhub/api   MUST NOT import from @clubhub/ui
@clubhub/api   MUST NOT import from apps/*
```

### 5.6 `is_replay_mode` Bypass Prevention

The `is_replay_mode` flag MUST NOT be bypassed. Enforcement is dual-layered:

**Runtime rule:** Any component in `surfaces/incident-command/` or `surfaces/replay-investigation/` that renders a write control MUST call `useReplayGuard()` and return `null` when `isReplayMode === true`.

**ESLint rule:** Custom rule `no-write-control-without-replay-guard` applied to all files under `surfaces/incident-command/` and `surfaces/replay-investigation/`.

Rule behavior: flags any component that renders `<button>`, `<input>`, `<textarea>`, or `<form>` without importing `useReplayGuard` from `@clubhub/hooks`.

Exception list (must be explicitly annotated with `// replay-safe: read-only` comment to suppress the rule):
- `<input readOnly />` elements
- `<input type="search" />` filter inputs in replay timeline
- `<textarea>` in the annotation form (Tab 3) — annotation submission is permitted in REPLAY mode

ESLint configuration fragment:
```javascript
// .eslintrc.js (surfaces/incident-command and surfaces/replay-investigation)
{
  rules: {
    'local/no-write-control-without-replay-guard': [
      'error',
      {
        writeElements: ['button', 'input', 'textarea', 'form'],
        requiredImport: 'useReplayGuard',
        requiredImportFrom: '@clubhub/hooks',
        allowReadOnly: true,          // suppresses for readOnly attribute
        suppressComment: 'replay-safe: read-only'
      }
    ]
  }
}
```

---

## 6. Shared Component Boundaries

Full TypeScript interface definitions for all shared components. These are the authoritative prop contracts — implementation must match exactly.

```typescript
// packages/@clubhub/types/src/components.ts
// All component prop interfaces are defined here and re-exported from @clubhub/ui

import type { MachineState, TrustState, OperatorRole } from './domain';

// SeverityBadge
export interface SeverityBadgeProps {
  severity: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// MachineStateBadge
export interface MachineStateBadgeProps {
  machine_state: MachineState;
  corpus_hash_verified?: boolean;
  trust_state?: TrustState;
  // Renders LIVE—UNVERIFIED pill when machine_state === 'RECOVERED_BUT_UNTRUSTED'
  // Pill: amber background, "LIVE—UNVERIFIED" text, 14px
}

// HoldToConfirmButton (PATCH-002)
export interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  holdDuration?: number;    // milliseconds, default: 3000
  disabled?: boolean;
  variant: 'danger' | 'warning';
  // 'danger': red progress arc (#C62828)
  // 'warning': amber progress arc (#F9A825)
}

// SequentialChipSelect (PATCH-001)
export interface SequentialChipSelectProps {
  steps: Array<{
    label: string;           // chip display text
    confirmLabel: string;    // confirmation button text shown after chip selection
  }>;
  onAllStepsConfirmed: () => void;
  onReset?: () => void;
  // Steps are completed in sequence: step N+1 is not clickable until step N is confirmed
  // Navigating away resets progress (useEffect cleanup fires onReset if provided)
  // Used for L6 override placement: 3 steps, no skip allowed
}

// ReplayBanner
export interface ReplayBannerProps {
  sessionId: string;
  sessionStartedAt: string;    // ISO 8601
  liveReturnPath?: string;     // default: '/ops/live'
  // Height: 28px
  // Background: amber (#F9A825)
  // Cannot be dismissed
  // Renders above Zone B content, below SystemStatusBar
}

// CountdownClock
export interface CountdownClockProps {
  expires_at: string;          // ISO 8601, server-authoritative timestamp
  onExpired?: () => void;      // called once when countdown reaches zero
  size?: 'sm' | 'md' | 'lg';  // default: 'md'
  // Color states:
  // remaining > 24h:  amber (#F9A825), static
  // remaining 6–24h:  red (#C62828), static
  // remaining < 6h:   red (#C62828), pulsing animation (1s period)
  // expired:          renders "EXPIRED" text in red, calls onExpired
}

// AdvisoryCard (A-NEW-01)
export interface AdvisoryCardProps {
  content: string;
  advisory_level: 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';
  // INFORMATIONAL: left border #1565C0 (blue), background white
  // RECOMMENDED:   left border #F9A825 (amber), background #FFFDE7
  // URGENT:        left border #C62828 (red), background #FFEBEE, label bold
  // content is plain text only — no HTML rendering
  // Rendered in Zone C Pane C4
}

// RejectionToast (A-NEW-04)
export type RejectionType =
  | 'VALIDATION_ERROR'      // persists until dismissed; user error
  | 'PERMISSION_DENIED'     // persists until dismissed; role enforcement
  | 'CONFLICT_DETECTED'     // persists until dismissed; concurrent edit conflict
  | 'SYSTEM_UNAVAILABLE';   // auto-dismisses after 8000ms; transient

export interface RejectionToastProps {
  type: RejectionType;
  message: string;
  onDismiss?: () => void;
  // Auto-dismiss is type-determined, not caller-determined
  // Rendered in a toast region at bottom-right of Zone B
  // Multiple simultaneous toasts stack vertically
}

// TabBadge (PATCH-010)
export interface TabBadgeProps {
  type: 'red' | 'amber' | 'green';
  count?: number;
  // If count is provided: renders filled circle with count text
  // If count is undefined: renders small dot indicator
  // Used on tab labels in incident-command and replay surfaces
}

// PresenceAvatars (A-NEW-03)
export interface CollaboratorPresence {
  operatorId: string;
  displayName: string;
  role: OperatorRole;
  currentPosition: string;   // free-text position label, e.g., "Tab 2", "Timeline 14:32"
  avatarUrl?: string;
}

export interface PresenceAvatarsProps {
  collaborators: CollaboratorPresence[];
  maxVisible?: number;       // default: 4; remainder shown as "+N" chip
  size?: 'sm' | 'md';       // default: 'sm'
}

// TrainingModeBanner (PATCH-006)
export interface TrainingModeBannerProps {
  // No dynamic props — rendered by parent only when training_mode is confirmed true
  // Height: 24px
  // Background: amber (#F9A825)
  // Text: "TRAINING MODE — submissions will not affect production content"
  // Cannot be dismissed
  // z-index: above Zone B content, below SystemStatusBar
}
```

---

## 7. Bundle Structure

### 7.1 Chunk Definitions

The following Vite manual chunk configuration defines the code splitting strategy:

```typescript
// apps/cms-operator/vite.config.ts (chunk configuration fragment)
manualChunks: {
  vendor: [
    'react',
    'react-dom',
    'react-router-dom',
    '@tanstack/react-query',
    'zustand',
  ],
  chrome: [
    './src/chrome/system-status-bar/index',
    './src/chrome/zone-a/index',
    './src/chrome/zone-c/index',
    './src/chrome/shell/index',
    '@clubhub/state/ws',       // WebSocket client (needed by chrome)
  ],
  'ui-lib': [
    '@clubhub/ui',
  ],
  'live-ops': [
    './src/surfaces/live-ops/index',
  ],
  'incident-command': [
    './src/surfaces/incident-command/index',
  ],
  replay: [
    './src/surfaces/replay-investigation/index',
  ],
  cms: [
    './src/surfaces/cms-operations/index',
  ],
  'venue-ops': [
    './src/surfaces/venue-ops/index',
  ],
  admin: [
    './src/surfaces/admin/index',
  ],
},
```

### 7.2 Chunk Load Strategy

| Chunk | Load Strategy | Trigger |
|-------|--------------|---------|
| `vendor` | Synchronous (inline in initial bundle) | App load |
| `chrome` | Synchronous (required for all surfaces) | App load |
| `ui-lib` | Synchronous (required by chrome) | App load |
| `live-ops` | Lazy (React.lazy + Suspense) | First navigation to `/ops/live` or `/ops/fleet` |
| `incident-command` | Lazy with preload | First `INCIDENT_CREATED` WebSocket event OR first navigation to `/ops/incidents/:id` |
| `replay` | Lazy | First navigation to `/ops/replay/:session_id` |
| `cms` | Lazy | First navigation to `/ops/cms` (CONTENT_MANAGER+ only) |
| `venue-ops` | Lazy | First navigation to `/ops/venues/:venue_id` |
| `admin` | Lazy | First navigation to `/admin/*` (ADMIN only) |

### 7.3 Preloading Rules

**`incident-command` preload on `INCIDENT_CREATED` event:**

```typescript
// apps/cms-operator/src/chrome/shell/WebSocketProvider.tsx
// On receiving INCIDENT_CREATED or INCIDENT_ESCALATED (S1/S2):
const preloadIncidentChunk = () => import('../surfaces/incident-command/index');

wsClient.on('INCIDENT_CREATED', (event) => {
  if (event.severity === 'S1' || event.severity === 'S2') {
    preloadIncidentChunk();  // fire-and-forget; loads chunk before user navigates
  }
});
```

This ensures the incident command chunk is available before `ZoneBAutoReplace` triggers navigation, eliminating a loading flash on S1/S2 incidents.

**No other surface chunks are preloaded.** Preloading all surface chunks on app load would negate the performance benefit of code splitting.

### 7.4 Bundle Size Targets

| Chunk | Target (gzipped) | Measurement Point |
|-------|-----------------|------------------|
| `chrome` + `ui-lib` combined | < 150KB | After tree shaking |
| `vendor` | < 250KB | After tree shaking |
| `live-ops` | < 100KB | Lazy chunk size |
| `incident-command` | < 100KB | Lazy chunk size |
| `replay` | < 100KB | Lazy chunk size |
| `cms` | < 100KB | Lazy chunk size |
| `venue-ops` | < 80KB | Lazy chunk size |
| `admin` | < 60KB | Lazy chunk size |

Bundle size is verified in CI via a `bundlesize` check. Exceeding targets triggers a CI warning (not a block) until the threshold is explicitly adjusted.

---

## 8. State Ownership Map

Each state slice has exactly one owner (the module that creates and writes it). All other modules that need data from a slice do so by reading the exported store hook — they do not write to slices they do not own.

| State Slice | Owner Module | Written by | Read by |
|-------------|-------------|-----------|---------|
| `AuthState` | `chrome/shell/AppProviders` | Auth guard on session load/refresh | All surfaces, all chrome modules |
| `SystemHealthState` | `chrome/system-status-bar` | WebSocket `SYSTEM_HEALTH_CHANGED` handler | `ZoneA`, all surface shells (for connection indicator) |
| `ActiveIncidentsState` | `chrome/zone-a` | WebSocket `INCIDENT_CREATED`, `INCIDENT_RESOLVED` | `ZoneAIncidentList`, `live-ops/` (read only), `ZoneBAutoReplace` |
| `NotificationState` | `chrome/zone-a` | WebSocket `NOTIFICATION` handler | `ZoneANotificationTray` |
| `UIState` | `chrome/shell` | `ZoneC` toggle handler, tab navigation handlers | All chrome modules, surface shells |
| `WebSocketState` | `@clubhub/state/ws` | WebSocket client connection manager | `chrome/system-status-bar` (connection indicator), `chrome/shell/WebSocketProvider` |
| `LiveOpsState` | `surfaces/live-ops` | Live ops surface only | `surfaces/live-ops` only |
| `IncidentState` | `surfaces/incident-command` | IC surface only | IC surface only; `ZoneA` reads `ActiveIncidentsState` (separate slice) for the badge — not `IncidentState` directly |
| `ReplayState` | `surfaces/replay-investigation` | Replay surface only (on session load from API) | Replay surface only; `useReplayGuard()` in `@clubhub/hooks` reads `ReplayState.is_replay_mode` |
| `CMSState` | `surfaces/cms-operations` | CMS surface only | CMS surface only; `ZoneAOperatorTools` reads `CMSState.training_mode` via a cross-slice selector (read only) |
| `VenueOpsState` | `surfaces/venue-ops` | Venue ops surface only | `surfaces/venue-ops` only |

### 8.1 Cross-Slice Read Rules

Two cross-slice reads are permitted with explicit documentation:

**`ZoneAOperatorTools` reads `CMSState.training_mode`:**
- This is a read-only access; `ZoneAOperatorTools` does not write to `CMSState`
- Implemented via an exported selector from `surfaces/cms-operations/state/`: `export const useTrainingModeActive = () => useCMSState(s => s.training_mode)`
- `ZoneAOperatorTools` imports this selector hook from the CMS state module
- Exception to surface isolation: this specific hook export is permitted because it is a chrome-consumed indicator, not a surface behavior coupling

**`ZoneBAutoReplace` reads `ActiveIncidentsState.latestAutoReplaceEvent`:**
- This is the only state `ZoneBAutoReplace` reads; it does not read surface state
- `ActiveIncidentsState` is owned by `chrome/zone-a`, making this a chrome-internal read — no surface isolation violation

### 8.2 State Slice Definitions (Zustand)

```typescript
// Illustrative type definitions — full implementations in respective state/ files

interface AuthState {
  user: OperatorUser | null;
  role: OperatorRole | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
}

interface SystemHealthState {
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
  platformAlertCount: number;
  lastHeartbeatAt: string | null;
}

interface ActiveIncidentsState {
  incidents: ActiveIncidentSummary[];    // lightweight summary only
  latestAutoReplaceEvent: AutoReplaceEvent | null;
}

interface UIState {
  zoneCOpen: boolean;
  activeRouteTitle: string;
}

interface WebSocketState {
  status: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  reconnectAttempts: number;
  lastMessageAt: string | null;
}

interface ReplayState {
  is_replay_mode: true;            // always true when Replay surface is mounted
  sessionId: string;
  sessionMetadata: ReplaySessionMetadata;
  playbackPosition: number;        // seconds from session start
  isPlaying: boolean;
  annotations: ReplayAnnotation[];
}
```

---

## 9. IC-03 Enforcement Architecture

IC-03 states: no write controls are rendered in REPLAY mode. Write controls are absent from the DOM — they are not disabled, not hidden via CSS, not conditionally styled. They do not exist in the rendered tree.

### 9.1 The `useReplayGuard()` Hook

```typescript
// packages/@clubhub/hooks/src/useReplayGuard.ts

import { useReplayState } from '../../@clubhub/state/src/replayStateAccessor';

interface ReplayGuardResult {
  isReplayMode: boolean;
}

/**
 * IC-03 enforcement hook.
 *
 * Any component that conditionally renders a write control MUST call this hook
 * and return null (not a disabled button, not a hidden element) when isReplayMode is true.
 *
 * This hook reads ReplayState.is_replay_mode. In all non-Replay surfaces,
 * ReplayState is not mounted and this hook returns { isReplayMode: false }.
 *
 * In the Replay surface, ReplayState is always mounted with is_replay_mode: true.
 * This value is set on session load from GET /replay/sessions/{id} and
 * is NEVER changed to false within a Replay surface session.
 */
export function useReplayGuard(): ReplayGuardResult {
  const isReplayMode = useReplayState(s => s?.is_replay_mode ?? false);
  return { isReplayMode };
}
```

### 9.2 Correct Usage Pattern

```typescript
// CORRECT: write control is absent from DOM in replay mode
function PlaceOverrideButton({ incidentId }: { incidentId: string }) {
  const { isReplayMode } = useReplayGuard();

  if (isReplayMode) return null;   // absent from DOM — IC-03 enforced

  return (
    <HoldToConfirmButton
      onConfirm={() => handlePlaceOverride(incidentId)}
      label="Place L6 Override"
      variant="danger"
    />
  );
}

// INCORRECT (prohibited): write control is disabled but present in DOM
function PlaceOverrideButtonWrong({ incidentId }: { incidentId: string }) {
  const { isReplayMode } = useReplayGuard();

  return (
    <HoldToConfirmButton
      onConfirm={() => handlePlaceOverride(incidentId)}
      label="Place L6 Override"
      variant="danger"
      disabled={isReplayMode}   // VIOLATION: button is present in DOM
    />
  );
}
```

### 9.3 `is_replay_mode` Lifecycle

1. User navigates to `/ops/replay/:session_id`
2. `ReplayRouteGuard` confirms the session ID exists via `replayApi.getSession(sessionId)`
3. `ReplayShell` mounts and initializes `ReplayState` with `is_replay_mode: true`
4. `is_replay_mode` is set from the API response — it is a server-confirmed flag, not a client-side toggle
5. `is_replay_mode` remains `true` for the entire lifetime of the Replay surface mount
6. When the user navigates away from `/ops/replay/:session_id`, `ReplayState` is reset and the store is unmounted
7. `is_replay_mode` is NEVER set to `false` within a mounted Replay surface

### 9.4 Annotation Form Exception

The annotation form in Replay Tab 3 is a write control that IS permitted in REPLAY mode. It is the only exception to IC-03.

Implementation:
```typescript
// surfaces/replay-investigation/components/ReplayTab3Annotations.tsx
// This component does NOT call useReplayGuard() — the annotation form
// is intentionally present in replay mode.
// Mark with the ESLint suppression comment:

// replay-safe: annotation write is permitted in REPLAY mode (IC-03 exception)
function AnnotationSubmitButton({ onSubmit }: { onSubmit: () => void }) {
  return <button onClick={onSubmit}>Add Annotation</button>;
}
```

### 9.5 ESLint Rule Specification

Rule name: `local/no-write-control-without-replay-guard`

Applied to files matching: `surfaces/incident-command/**/*.tsx`, `surfaces/replay-investigation/**/*.tsx`

Rule logic:
1. For each JSX element that is `button`, `input`, `textarea`, or `form`:
2. Check if the containing component function imports `useReplayGuard` from `@clubhub/hooks`
3. If not imported: report error "Write control rendered without useReplayGuard — IC-03 violation"
4. Suppress if element has `readOnly` attribute (HTML `readOnly` or JSX `readOnly={true}`)
5. Suppress if file contains the comment `// replay-safe: read-only`
6. Suppress for annotation form files annotated with `// replay-safe: annotation write is permitted in REPLAY mode (IC-03 exception)`

Rule is `'error'` severity. It must be CI-blocking. It cannot be suppressed with `// eslint-disable-next-line` without a documented IC-03 exception ticket reference in the comment.

### 9.6 Verification Test

The IC-03 enforcement architecture must be verified by the following integration test:

```typescript
// test-runner/suites/ic03-enforcement.test.ts

it('renders no write controls in replay surface', async () => {
  const { container } = render(
    <TestProviders replayMode={true}>
      <IncidentCommandView incidentId="test-001" />
    </TestProviders>
  );

  // No buttons with mutation handlers
  const buttons = container.querySelectorAll('button');
  const writableInputs = container.querySelectorAll('input:not([readonly])');
  const forms = container.querySelectorAll('form');

  expect(buttons).toHaveLength(0);
  expect(writableInputs).toHaveLength(0);
  expect(forms).toHaveLength(0);
});

it('renders write controls when not in replay mode', async () => {
  const { container } = render(
    <TestProviders replayMode={false}>
      <IncidentCommandView incidentId="test-001" />
    </TestProviders>
  );

  // At minimum the commander assumption button should be present
  const buttons = container.querySelectorAll('button');
  expect(buttons.length).toBeGreaterThan(0);
});
```

---

## Appendix A: ESLint Boundary Configuration

```javascript
// .eslintrc.js — module boundary rules (applied at monorepo root)
{
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'types',    pattern: 'packages/@clubhub/types/src/**' },
      { type: 'api',      pattern: 'packages/@clubhub/api/src/**' },
      { type: 'ui',       pattern: 'packages/@clubhub/ui/src/**' },
      { type: 'state',    pattern: 'packages/@clubhub/state/src/**' },
      { type: 'hooks',    pattern: 'packages/@clubhub/hooks/src/**' },
      { type: 'chrome',   pattern: 'apps/cms-operator/src/chrome/**' },
      { type: 'routes',   pattern: 'apps/cms-operator/src/routes/**' },
      { type: 'surface-live',     pattern: 'apps/cms-operator/src/surfaces/live-ops/**' },
      { type: 'surface-incident', pattern: 'apps/cms-operator/src/surfaces/incident-command/**' },
      { type: 'surface-replay',   pattern: 'apps/cms-operator/src/surfaces/replay-investigation/**' },
      { type: 'surface-cms',      pattern: 'apps/cms-operator/src/surfaces/cms-operations/**' },
      { type: 'surface-venue',    pattern: 'apps/cms-operator/src/surfaces/venue-ops/**' },
    ],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'allow',
      rules: [
        // @clubhub/types: leaf — no imports
        { from: 'types', disallow: ['api', 'ui', 'state', 'hooks', 'chrome', 'routes',
            'surface-live', 'surface-incident', 'surface-replay', 'surface-cms', 'surface-venue'] },
        // @clubhub/ui: no state, no hooks (global store), no surfaces, no app
        { from: 'ui', disallow: ['state', 'chrome', 'routes',
            'surface-live', 'surface-incident', 'surface-replay', 'surface-cms', 'surface-venue'] },
        // @clubhub/api: no surfaces, no ui, no app
        { from: 'api', disallow: ['ui', 'chrome', 'routes',
            'surface-live', 'surface-incident', 'surface-replay', 'surface-cms', 'surface-venue'] },
        // Cross-surface isolation — each surface disallows all other surfaces
        { from: 'surface-live',     disallow: ['surface-incident', 'surface-replay', 'surface-cms', 'surface-venue', 'chrome'] },
        { from: 'surface-incident', disallow: ['surface-live', 'surface-replay', 'surface-cms', 'surface-venue', 'chrome'] },
        { from: 'surface-replay',   disallow: ['surface-live', 'surface-incident', 'surface-cms', 'surface-venue', 'chrome'] },
        { from: 'surface-cms',      disallow: ['surface-live', 'surface-incident', 'surface-replay', 'surface-venue', 'chrome'] },
        { from: 'surface-venue',    disallow: ['surface-live', 'surface-incident', 'surface-replay', 'surface-cms', 'chrome'] },
      ],
    }],
  },
}
```

---

## Appendix B: Package Dependency Graph

```
@clubhub/types        (no deps)
     ^
     |
@clubhub/api ──────────────────────────────────────────────> @clubhub/types
@clubhub/ui ───────────────────────────────────────────────> @clubhub/types
@clubhub/state ────────────────────────────────────────────> @clubhub/types, @clubhub/api
@clubhub/hooks ────────────────────────────────────────────> @clubhub/types, @clubhub/state
apps/cms-operator ─────────────────────────────────────────> all packages
```

All arrows flow downward. No cycles are permitted. Any circular dependency between packages is a CI-blocking error enforced by `madge --circular` in the `lint:deps` script.

---

*End of FRONTEND-MODULE-BOUNDARY-MAP-v1*
