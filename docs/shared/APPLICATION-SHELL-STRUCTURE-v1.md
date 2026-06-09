# APPLICATION-SHELL-STRUCTURE-v1

**Document class:** Engineering Specification — Final
**Status:** ENFORCED
**Applies to:** `apps/cms-operator/` — ClubHub TV Operator CMS Frontend
**Stack:** React 18, TypeScript, React Router v6, Vite, Turborepo monorepo
**Last updated:** 2026-06-05

---

## Purpose and Scope

This document is the authoritative definition of the folder structure, route tree, layout hierarchy, surface mount points, CSS implementation, and import boundary rules for the ClubHub TV operator CMS frontend.

The definitions in this document are not suggestions. They are the enforced structure. Any deviation — new file location, new route path, new import relationship — requires an architecture review and an amendment to this document before the code may merge.

---

## 1. Enforced Folder Structure

The following is the complete, canonical folder tree for `apps/cms-operator/src/`. Every file listed here must exist at the path shown. No additional top-level directories may be created without architecture review. Files not listed here may be added inside existing directories following the naming conventions established by their siblings.

```
apps/cms-operator/src/
├── main.tsx                               # React root mount, provider tree
├── App.tsx                                # Router setup (createBrowserRouter)
├── vite-env.d.ts                          # Vite env type declarations
│
├── chrome/                                # Shared chrome — NOT importable by surfaces
│   ├── shell/
│   │   ├── ShellLayout.tsx                # Root layout: StatusBar + ZoneA + Outlet + ZoneC
│   │   ├── AuthGate.tsx                   # Auth check, /operators/me, redirect logic
│   │   ├── RealtimeProvider.tsx           # WebSocket singleton, event routing
│   │   ├── ErrorBoundary.tsx              # Top-level React error boundary
│   │   ├── BootstrapLoadingScreen.tsx     # Shown during auth/config bootstrap
│   │   └── BootstrapErrorScreen.tsx       # Shown on fatal bootstrap failure
│   ├── system-status-bar/
│   │   ├── SystemStatusBar.tsx            # 48px sticky top bar — system state, alerts
│   │   └── SystemStatusBar.test.tsx
│   ├── zone-a/
│   │   ├── ZoneA.tsx                      # 280px left nav — layout root
│   │   ├── ZoneAVenueSelector.tsx         # Venue list with machine state dots
│   │   ├── MachineStateDot.tsx            # Per-venue machine state indicator
│   │   ├── ZoneAIncidentList.tsx          # Active incidents with severity badges
│   │   ├── ZoneANotificationTray.tsx      # Unread count, notification drawer
│   │   ├── ZoneAOperatorTools.tsx         # Training mode strip, operator menu
│   │   └── ZoneBAutoReplace.tsx           # Handles ZONE_B_AUTO_REPLACE WebSocket event
│   └── zone-c/
│       ├── ZoneC.tsx                      # Collapsible right panel — layout root
│       └── ZoneCPanel.tsx                 # Content wrapper with collapse logic
│
├── surfaces/                              # Surface modules — isolated from each other
│   ├── live-ops/
│   │   ├── index.tsx                      # Surface entry point (lazy import target)
│   │   ├── LiveOpsVenueView.tsx           # /ops/live — single venue health view
│   │   ├── LiveOpsFleetView.tsx           # /ops/fleet — all venues grid
│   │   ├── components/
│   │   │   ├── VenueIdentityHeader.tsx
│   │   │   ├── PlayerHealthSection.tsx
│   │   │   ├── PlayerHealthCard.tsx
│   │   │   ├── PRESummarySection.tsx
│   │   │   ├── InterventionSurface.tsx
│   │   │   └── LiveTimeline.tsx
│   │   ├── hooks/
│   │   │   └── useLiveOpsVenue.ts
│   │   └── utils/
│   │       └── canPlaceOverride.ts
│   │
│   ├── incident-command/
│   │   ├── index.tsx                      # Surface entry point (lazy import target)
│   │   ├── IncidentCommandView.tsx        # /ops/incidents/:incident_id
│   │   ├── components/
│   │   │   ├── IncidentIdentityBar.tsx    # 72px persistent top bar
│   │   │   ├── CommanderStatusCard.tsx
│   │   │   ├── AssumeCommandConfirmCard.tsx
│   │   │   ├── CommanderLapsedAlert.tsx   # COMMANDER_LAPSED state display
│   │   │   ├── ICTabSystem.tsx            # 6-tab navigation controller
│   │   │   ├── tabs/
│   │   │   │   ├── OverviewTab.tsx
│   │   │   │   ├── ShiftNotesTab.tsx
│   │   │   │   ├── OverrideInventoryTab.tsx
│   │   │   │   ├── PREdivergenceTab.tsx
│   │   │   │   ├── TransitionsTab.tsx
│   │   │   │   └── EvidenceTab.tsx        # ADMIN only — absent from DOM for non-ADMIN roles
│   │   │   ├── L6OverridePlacementFlow.tsx
│   │   │   └── L6OverrideRemovalFlow.tsx
│   │   └── hooks/
│   │       ├── useIncident.ts
│   │       ├── useIncidentOverrides.ts
│   │       └── useIncidentTransitions.ts
│   │
│   ├── venue-ops/
│   │   ├── index.tsx                      # Surface entry point (lazy import target)
│   │   ├── VenueOpsView.tsx               # /ops/venues/:venue_id
│   │   ├── components/
│   │   │   ├── VenueOpsHeader.tsx         # Persistent header — always visible
│   │   │   ├── AutonomyClock.tsx          # 72h autonomy countdown display
│   │   │   └── tabs/
│   │   │       ├── VenueStatusDashboard.tsx
│   │   │       ├── ScreenManagementTab.tsx
│   │   │       ├── CorpusStatusTab.tsx
│   │   │       ├── ConnectivityTab.tsx
│   │   │       ├── MachineStateHistoryStrip.tsx
│   │   │       └── VenueConfigTab.tsx     # ADMIN only — absent from DOM for non-ADMIN roles
│   │   └── hooks/
│   │       ├── useVenueOpsSummary.ts
│   │       └── useVenueMachineStateHistory.ts
│   │
│   ├── cms-operations/
│   │   ├── index.tsx                      # Surface entry point (lazy import target)
│   │   ├── CMSView.tsx                    # /ops/cms and /ops/cms/:venue_id
│   │   ├── components/
│   │   │   ├── tabs/
│   │   │   │   ├── ContentLibraryTab.tsx
│   │   │   │   ├── ContentCalendarTab.tsx
│   │   │   │   ├── PendingApprovalsTab.tsx
│   │   │   │   ├── DistributionTab.tsx
│   │   │   │   ├── DeliveryConfidenceTab.tsx
│   │   │   │   └── ContentArchiveTab.tsx
│   │   │   ├── CMSCalendarGrid.tsx
│   │   │   ├── SlotCreateForm.tsx
│   │   │   ├── DeliveryWarningBanner.tsx  # 72h delivery warning
│   │   │   ├── DeliveryConfidencePanel.tsx
│   │   │   └── TrainingModeToggle.tsx     # DEFERRED — scaffold only, no-op
│   │   └── hooks/
│   │       ├── useCMSCalendar.ts
│   │       └── useCMSDeliveryConfidence.ts
│   │
│   └── replay-investigation/              # DEFERRED — scaffold only, no implementation
│       ├── index.tsx                      # Exports DeferredReplayPlaceholder only
│       └── DeferredReplayPlaceholder.tsx  # "Replay Investigation is not available in this version."
│
├── routes/
│   ├── index.tsx                          # createBrowserRouter definition (see Section 2)
│   ├── guards/
│   │   ├── RoleGuard.tsx                  # Redirects based on role insufficiency
│   │   └── useRequireRole.ts              # Hook: throws redirect if role insufficient
│   └── lazy.ts                            # All lazy() surface imports — single source of truth
│
├── hooks/                                 # App-level hooks — not surface-specific
│   ├── useReplayGuard.ts                  # Returns { isReplayMode: boolean }
│   └── useZoneCContent.ts                 # Zone C content slot management (context bridge)
│
└── test/
    ├── setup.ts                           # Vitest + RTL + MSW global setup
    ├── msw/
    │   ├── handlers/
    │   │   ├── auth.ts                    # /operators/me, /auth/login handlers
    │   │   ├── venues.ts                  # /venues, /venues/:id handlers
    │   │   ├── incidents.ts               # /incidents, /incidents/:id handlers
    │   │   ├── cms.ts                     # /content, /calendar, /corpus handlers
    │   │   └── rejections.ts              # Rejection factory functions (401, 403, 500, etc.)
    │   └── server.ts                      # MSW server setup and lifecycle
    └── utils/
        └── renderWithProviders.tsx        # Test render wrapper with full provider tree
```

### 1.1 Directory Ownership Rules

| Directory | Owner | Description |
|---|---|---|
| `chrome/` | Shell team | Shared layout chrome. No surface-specific logic. |
| `surfaces/` | Surface teams | One directory per surface. Isolated from each other. |
| `routes/` | Shell team | Route config and guards only. No business logic. |
| `hooks/` | Shell team | App-level hooks only. Surface hooks live inside surfaces. |
| `test/` | All teams | Shared test infrastructure only. Surface tests live inside surfaces. |

### 1.2 Naming Conventions

- **Component files:** PascalCase `.tsx` — e.g., `ShellLayout.tsx`, `ICTabSystem.tsx`
- **Hook files:** camelCase prefixed `use` with `.ts` extension — e.g., `useIncident.ts`
- **Utility files:** camelCase `.ts` — e.g., `canPlaceOverride.ts`
- **Test files:** Co-located with the file under test, `.test.tsx` or `.test.ts` suffix
- **Surface entry points:** Always named `index.tsx` — this is the lazy import target

---

## 2. Route Tree (React Router v6)

The following is the complete, canonical route configuration. It lives in `routes/index.tsx` and is exported as `router`. The file `App.tsx` consumes it via `<RouterProvider router={router} />`.

All surface views are lazy-loaded. All lazy imports are centralized in `routes/lazy.ts` (see Section 2.2).

### 2.1 Route Configuration

```typescript
// routes/index.tsx
import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../chrome/shell/ErrorBoundary';
import { RealtimeProvider } from '../chrome/shell/RealtimeProvider';
import { AuthGate } from '../chrome/shell/AuthGate';
import { ShellLayout } from '../chrome/shell/ShellLayout';
import { BootstrapErrorScreen } from '../chrome/shell/BootstrapErrorScreen';
import { SurfaceLoadingState } from '../chrome/shell/SurfaceLoadingState';
import { LoginPage } from '../surfaces/login/LoginPage'; // NOT lazy — must load fast
import { NotFoundPage } from '../surfaces/not-found/NotFoundPage';
import {
  LazyLiveOpsVenueView,
  LazyLiveOpsFleetView,
  LazyIncidentCommandView,
  LazyVenueOpsView,
  LazyCMSView,
  LazyCMSVenueView,
  LazyReplayPlaceholder,
} from './lazy';

export const router = createBrowserRouter([
  {
    // Root redirect — unauthenticated entry point defaults to live ops
    path: '/',
    element: <Navigate to="/ops/live" replace />,
  },
  {
    // Login page — not wrapped in shell, not lazy
    path: '/login',
    element: <LoginPage />,
  },
  {
    // All authenticated routes — share AuthGate + ShellLayout
    element: (
      <ErrorBoundary fallback={<BootstrapErrorScreen />}>
        <RealtimeProvider>
          <AuthGate>
            <ShellLayout />
          </AuthGate>
        </RealtimeProvider>
      </ErrorBoundary>
    ),
    children: [
      {
        // Live Operations — single venue health view (default or selected venue)
        path: '/ops/live',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyLiveOpsVenueView />
          </Suspense>
        ),
      },
      {
        // Live Operations — fleet wall (all venues grid)
        path: '/ops/fleet',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyLiveOpsFleetView />
          </Suspense>
        ),
      },
      {
        // Incident Command — scoped to a specific incident
        path: '/ops/incidents/:incident_id',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyIncidentCommandView />
          </Suspense>
        ),
      },
      {
        // Venue Operations — scoped to a specific venue
        path: '/ops/venues/:venue_id',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyVenueOpsView />
          </Suspense>
        ),
      },
      {
        // CMS Operations — venue-independent landing (global content view)
        path: '/ops/cms',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyCMSView />
          </Suspense>
        ),
      },
      {
        // CMS Operations — scoped to a specific venue
        path: '/ops/cms/:venue_id',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyCMSVenueView />
          </Suspense>
        ),
      },
      {
        // Replay Investigation — DEFERRED. Scaffold route only. Renders placeholder.
        path: '/ops/replay/:session_id',
        element: (
          <Suspense fallback={<SurfaceLoadingState />}>
            <LazyReplayPlaceholder />
          </Suspense>
        ),
      },
    ],
  },
  {
    // Catch-all — rendered for any unrecognized path
    path: '*',
    element: <NotFoundPage />,
  },
]);
```

### 2.2 Lazy Import Registry

All lazy imports are centralized in `routes/lazy.ts`. No surface may be lazy-imported from any other location.

```typescript
// routes/lazy.ts
import { lazy } from 'react';

export const LazyLiveOpsVenueView = lazy(
  () => import('../surfaces/live-ops/index').then(m => ({ default: m.LiveOpsVenueView }))
);

export const LazyLiveOpsFleetView = lazy(
  () => import('../surfaces/live-ops/index').then(m => ({ default: m.LiveOpsFleetView }))
);

export const LazyIncidentCommandView = lazy(
  () => import('../surfaces/incident-command/index').then(m => ({ default: m.IncidentCommandView }))
);

export const LazyVenueOpsView = lazy(
  () => import('../surfaces/venue-ops/index').then(m => ({ default: m.VenueOpsView }))
);

export const LazyCMSView = lazy(
  () => import('../surfaces/cms-operations/index').then(m => ({ default: m.CMSView }))
);

export const LazyCMSVenueView = lazy(
  () => import('../surfaces/cms-operations/index').then(m => ({ default: m.CMSVenueView }))
);

export const LazyReplayPlaceholder = lazy(
  () => import('../surfaces/replay-investigation/index').then(m => ({ default: m.DeferredReplayPlaceholder }))
);
```

### 2.3 Route Ownership Summary

| Path | Surface | Entry Component | Role Minimum | Notes |
|---|---|---|---|---|
| `/` | — | — | — | Redirects to `/ops/live` |
| `/login` | — | `LoginPage` | None | Not lazy, not in shell |
| `/ops/live` | Live Operations | `LiveOpsVenueView` | VIEWER | Default venue or selected |
| `/ops/fleet` | Live Operations | `LiveOpsFleetView` | VIEWER | Fleet wall |
| `/ops/incidents/:incident_id` | Incident Command | `IncidentCommandView` | VIEWER | Scoped to incident |
| `/ops/venues/:venue_id` | Venue Operations | `VenueOpsView` | OPERATOR | Scoped to venue |
| `/ops/cms` | CMS Operations | `CMSView` | CONTENT_MANAGER | Global CMS landing |
| `/ops/cms/:venue_id` | CMS Operations | `CMSVenueView` | CONTENT_MANAGER | Venue-scoped CMS |
| `/ops/replay/:session_id` | Replay Investigation | `DeferredReplayPlaceholder` | ADMIN | DEFERRED — scaffold only |
| `*` | — | `NotFoundPage` | — | Catch-all |

### 2.4 Role Guard Contract

Role enforcement uses the absent-not-disabled pattern: unauthorized controls are absent from the DOM entirely. They are not rendered as disabled. They do not appear at all.

```typescript
// routes/guards/useRequireRole.ts
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@clubhub/state';
import type { OperatorRole } from '@clubhub/types';

const ROLE_ORDER: OperatorRole[] = ['VIEWER', 'OPERATOR', 'CONTENT_MANAGER', 'ADMIN'];

export function useRequireRole(minimum: OperatorRole): void {
  const navigate = useNavigate();
  const role = useAuthStore(s => s.role);

  useEffect(() => {
    if (!role || ROLE_ORDER.indexOf(role) < ROLE_ORDER.indexOf(minimum)) {
      navigate('/ops/live', { replace: true });
    }
  }, [role, minimum, navigate]);
}
```

```typescript
// routes/guards/RoleGuard.tsx
import React from 'react';
import { useRequireRole } from './useRequireRole';
import type { OperatorRole } from '@clubhub/types';

interface RoleGuardProps {
  minimum: OperatorRole;
  children: React.ReactNode;
}

export function RoleGuard({ minimum, children }: RoleGuardProps): React.ReactElement | null {
  useRequireRole(minimum);
  // Returns null during redirect; hook handles navigation
  return <>{children}</>;
}
```

---

## 3. Layout Hierarchy

### 3.1 Full Component Tree

The following diagram represents the complete component tree when any authenticated route is active and the shell is mounted.

```
<App>
  <QueryClientProvider>               // @tanstack/react-query — data fetching layer
    <RouterProvider router={router}>
      <ErrorBoundary>                 // Top-level error boundary — renders BootstrapErrorScreen
        <RealtimeProvider>            // wsStore managed here — WebSocket singleton
          <AuthGate>                  // authStore populated here — blocks until /operators/me resolves
            <ShellLayout>
              ┌──────────────────────────────────────────────────────┐
              │  <SystemStatusBar />  (48px, sticky top, z-index 1000) │
              ├──────────────┬─────────────────────────┬─────────────┤
              │  <ZoneA />   │  <main className="zone-b"> │  <ZoneC />  │
              │  (280px,     │    <Suspense             │  (320px or  │
              │  fixed)      │      fallback={          │   48px      │
              │              │        <SurfaceLoadingState /> │  collapsed) │
              │              │      }>                  │             │
              │              │      <Outlet />          │             │
              │              │    </Suspense>           │             │
              │              │  </main>                 │             │
              └──────────────┴─────────────────────────┴─────────────┘
            </ShellLayout>
          </AuthGate>
        </RealtimeProvider>
      </ErrorBoundary>
    </RouterProvider>
  </QueryClientProvider>
</App>
```

### 3.2 ZoneA Sub-Structure

```
<ZoneA>
  ├── <ZoneAVenueSelector />       // Venue list, machine state dots per venue
  ├── <ZoneAIncidentList />        // Active incidents with severity badges, click → /ops/incidents/:id
  ├── <ZoneANotificationTray />    // Unread notification count, expandable drawer
  └── <ZoneAOperatorTools />       // Training mode strip (PATCH-006 protocol), operator menu
</ZoneA>
```

### 3.3 ZoneC Injection Contract

Zone C content is surface-controlled via React context. The chrome does not know what any surface renders inside Zone C.

```typescript
// hooks/useZoneCContent.ts
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ZoneCContextValue {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const ZoneCContext = createContext<ZoneCContextValue | null>(null);

export function useZoneCContent(): ZoneCContextValue {
  const ctx = useContext(ZoneCContext);
  if (!ctx) throw new Error('useZoneCContent must be used within ZoneCContext.Provider');
  return ctx;
}
```

Surfaces inject Zone C content using a `useEffect` on mount and clear it on unmount:

```typescript
// Pattern used inside any surface component
import { useZoneCContent } from '../../hooks/useZoneCContent';

function LiveOpsVenueView(): React.ReactElement {
  const { setContent } = useZoneCContent();

  useEffect(() => {
    setContent(<LiveOpsContextPane />);
    return () => setContent(null);
  }, [setContent]);

  // ... surface render
}
```

### 3.4 ZoneBAutoReplace

`ZoneBAutoReplace` is mounted inside `<RealtimeProvider>` (not inside any surface route). It holds a permanent subscription to the WebSocket event bus for `ZONE_B_AUTO_REPLACE` events and performs imperative navigation using React Router's `useNavigate`. It renders no DOM.

```typescript
// chrome/zone-a/ZoneBAutoReplace.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeEvent } from '@clubhub/hooks';
import type { ZoneBAutoReplaceEvent } from '@clubhub/types';

export function ZoneBAutoReplace(): null {
  const navigate = useNavigate();

  useRealtimeEvent<ZoneBAutoReplaceEvent>('ZONE_B_AUTO_REPLACE', (event) => {
    navigate(event.payload.targetPath, { replace: true });
  });

  return null;
}
```

### 3.5 AuthGate Contract

`AuthGate` calls `GET /operators/me` on mount. Until the response resolves:
- Renders `<BootstrapLoadingScreen />`
- Does not render `<ShellLayout />` or any `<Outlet />`

On success: populates `authStore` with `{ operatorId, role, venueIds }`, renders children.

On failure (401, network error, timeout): redirects to `/login`.

---

## 4. Surface Mount Points

This section defines the contract for each surface: the route that mounts it, the entry component, Zone B content structure, and Zone C content.

### 4.1 Live Operations

| Property | Value |
|---|---|
| Routes | `/ops/live`, `/ops/fleet` |
| Entry file | `surfaces/live-ops/index.tsx` |
| Zone B entry (venue) | `LiveOpsVenueView` |
| Zone B entry (fleet) | `LiveOpsFleetView` |
| Role minimum | VIEWER |

**Zone B structure — `/ops/live` (venue view):**
```
<LiveOpsVenueView>
  <VenueIdentityHeader />          // Venue name, machine state, last-seen timestamp
  <PlayerHealthSection>
    <PlayerHealthCard />           // One card per screen at the venue
  </PlayerHealthSection>
  <PRESummarySection />            // Active PRE resolution summary, entropy tier
  <InterventionSurface />          // Override placement UI (OPERATOR+ only — absent for VIEWER)
  <LiveTimeline />                 // Recent events, state transitions, override history
</LiveOpsVenueView>
```

**Zone B structure — `/ops/fleet`:**
```
<LiveOpsFleetView>
  // Grid of all venues — each cell mirrors VenueIdentityHeader condensed
  // Click on venue → navigates to /ops/live with venue context
</LiveOpsFleetView>
```

**Zone C:** Advisory context pane — active advisory tier, player health detail, recent activity feed. Injected by `LiveOpsVenueView` via `setContent`. Empty when `LiveOpsFleetView` is active.

### 4.2 Incident Command

| Property | Value |
|---|---|
| Route | `/ops/incidents/:incident_id` |
| Entry file | `surfaces/incident-command/index.tsx` |
| Zone B entry | `IncidentCommandView` |
| Role minimum | VIEWER (ADMIN required for EvidenceTab) |

**Zone B structure:**
```
<IncidentCommandView>
  <IncidentIdentityBar />          // 72px, persistent — incident ID, severity, venue, elapsed time
  <CommanderStatusCard />          // Current commander, last-active timestamp
  <CommanderLapsedAlert />         // Rendered only when COMMANDER_LAPSED state is active
  <ICTabSystem>                    // 6-tab navigation
    <OverviewTab />                // Tab 1: incident summary, current state
    <ShiftNotesTab />              // Tab 2: timestamped notes, handoff record
    <OverrideInventoryTab />       // Tab 3: active overrides, placement history
    <PREdivergenceTab />           // Tab 4: PRE divergence log, resolution status
    <TransitionsTab />             // Tab 5: machine state transitions, timeline
    <EvidenceTab />                // Tab 6: ADMIN only — absent from DOM for VIEWER/OPERATOR/CONTENT_MANAGER
  </ICTabSystem>
  <L6OverridePlacementFlow />      // Modal flow — OPERATOR+ only, absent for VIEWER
  <L6OverrideRemovalFlow />        // Modal flow — OPERATOR+ only, absent for VIEWER
</IncidentCommandView>
```

**Zone C:** Incident context summary — venue summary card, related incidents (same venue, last 30 days), escalation path. Injected by `IncidentCommandView`.

### 4.3 Venue Operations

| Property | Value |
|---|---|
| Route | `/ops/venues/:venue_id` |
| Entry file | `surfaces/venue-ops/index.tsx` |
| Zone B entry | `VenueOpsView` |
| Role minimum | OPERATOR |

**Zone B structure:**
```
<VenueOpsView>
  <VenueOpsHeader />               // Persistent — venue name, machine state, autonomy clock
  <AutonomyClock />                // 72h autonomy countdown — warning at <12h, critical at <2h
  <TabNavigation>                  // 6 tabs
    <VenueStatusDashboard />       // Tab 1: aggregated venue health
    <ScreenManagementTab />        // Tab 2: per-screen enrollment, status, restart
    <CorpusStatusTab />            // Tab 3: corpus delivery status, 72h lead time indicator
    <ConnectivityTab />            // Tab 4: network status, last-sync timestamps
    <MachineStateHistoryStrip />   // Tab 5: state transition history, duration per state
    <VenueConfigTab />             // Tab 6: ADMIN only — absent from DOM for non-ADMIN
  </TabNavigation>
</VenueOpsView>
```

**Zone C:** Quick venue actions (restart screen, force corpus sync — OPERATOR+ only), connectivity summary, last 3 machine state transitions. Injected by `VenueOpsView`.

### 4.4 CMS Operations

| Property | Value |
|---|---|
| Routes | `/ops/cms`, `/ops/cms/:venue_id` |
| Entry file | `surfaces/cms-operations/index.tsx` |
| Zone B entry | `CMSView` (both routes, venue context optional) |
| Role minimum | CONTENT_MANAGER |

**Zone B structure:**
```
<CMSView>
  <DeliveryWarningBanner />        // Rendered when any corpus slot is within 72h lead-time window
  <TabNavigation>                  // 6 tabs
    <ContentLibraryTab />          // Tab 1: all content items, search, filter
    <ContentCalendarTab>           // Tab 2: calendar grid view
      <CMSCalendarGrid />
      <SlotCreateForm />           // Inline slot creation
    </ContentCalendarTab>
    <PendingApprovalsTab />        // Tab 3: items awaiting approval (ADMIN approves)
    <DistributionTab />            // Tab 4: per-venue corpus delivery status
    <DeliveryConfidenceTab>        // Tab 5: delivery confidence by venue/slot
      <DeliveryConfidencePanel />
    </DeliveryConfidenceTab>
    <ContentArchiveTab />          // Tab 6: archived content, audit trail
  </TabNavigation>
  <TrainingModeToggle />           // DEFERRED — rendered as no-op placeholder
</CMSView>
```

**Zone C:** Delivery confidence summary (% venues with confirmed corpus), recent content activity log, next-scheduled delivery timestamps. Injected by `CMSView`.

### 4.5 Replay Investigation (DEFERRED)

| Property | Value |
|---|---|
| Route | `/ops/replay/:session_id` |
| Entry file | `surfaces/replay-investigation/index.tsx` |
| Zone B entry | `DeferredReplayPlaceholder` |
| Role minimum | ADMIN |
| Status | DEFERRED — scaffold route only |

**Zone B:** Static message: "Replay Investigation is not available in this version."

**Zone C:** Empty. `DeferredReplayPlaceholder` calls `setContent(null)` on mount.

```typescript
// surfaces/replay-investigation/DeferredReplayPlaceholder.tsx
import React, { useEffect } from 'react';
import { useZoneCContent } from '../../hooks/useZoneCContent';

export function DeferredReplayPlaceholder(): React.ReactElement {
  const { setContent } = useZoneCContent();

  useEffect(() => {
    setContent(null);
    return () => setContent(null);
  }, [setContent]);

  return (
    <div className="deferred-surface-placeholder">
      <p>Replay Investigation is not available in this version.</p>
    </div>
  );
}
```

---

## 5. CSS Layout Implementation

The shell layout uses CSS Grid. Values are exact and enforced. Do not substitute Flexbox for the shell root layout.

### 5.1 Shell Grid

```css
/* ShellLayout root element */
.shell-layout {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 280px 1fr auto;
  height: 100vh;
  overflow: hidden;
}

/* SystemStatusBar — spans full width, sticky */
.system-status-bar {
  grid-column: 1 / -1;
  grid-row: 1;
  position: sticky;
  top: 0;
  z-index: 1000;
  height: 48px;
  background-color: var(--color-surface-chrome);
  border-bottom: 1px solid var(--border-subtle);
}

/* ZoneA — left navigation panel */
.zone-a {
  grid-column: 1;
  grid-row: 2;
  width: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--border-subtle);
  background-color: var(--color-surface-chrome);
}

/* ZoneB — main surface content area */
.zone-b {
  grid-column: 2;
  grid-row: 2;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background-color: var(--color-surface-primary);
}

/* ZoneC — collapsible right context panel */
.zone-c {
  grid-column: 3;
  grid-row: 2;
  width: 320px;
  overflow-y: auto;
  overflow-x: hidden;
  border-left: 1px solid var(--border-subtle);
  background-color: var(--color-surface-chrome);
  transition: width 200ms ease;
}

.zone-c.collapsed {
  width: 48px;
  overflow: hidden;
}

.zone-c.collapsed .zone-c-panel-content {
  display: none;
}
```

### 5.2 CSS Custom Properties (Required)

These custom properties must be defined at `:root` in the global stylesheet. Values shown are defaults for the standard dark theme.

```css
:root {
  --color-surface-chrome: #0f1117;
  --color-surface-primary: #161b22;
  --border-subtle: #21262d;
  --color-text-primary: #e6edf3;
  --color-text-secondary: #8b949e;
  --color-accent-blue: #388bfd;
  --color-severity-critical: #f85149;
  --color-severity-warning: #d29922;
  --color-severity-ok: #3fb950;
}
```

### 5.3 Responsive Behavior

The shell layout does not reflow at narrow widths. ClubHub TV operator surfaces are designed for desktop/large-tablet use (minimum 1280px viewport width). Below 1280px, the layout remains fixed and horizontal scrolling may occur. No mobile breakpoints are defined.

ZoneC collapse is operator-triggered only (via collapse button in `ZoneCPanel`). It is not driven by viewport width.

---

## 6. Import Boundary Enforcement

Import boundaries are enforced by ESLint using `eslint-plugin-import` with `import/no-restricted-paths` rules. Violations block CI.

### 6.1 Boundary Rules

**Rule 1: Surfaces cannot import from each other.**

No file inside `surfaces/live-ops/` may import from `surfaces/incident-command/`, `surfaces/venue-ops/`, `surfaces/cms-operations/`, or `surfaces/replay-investigation/`. This applies symmetrically to all surface pairs. Cross-surface navigation is done via React Router `useNavigate` — not via component or hook imports.

**Rule 2: Surfaces cannot import from chrome.**

No file inside `surfaces/*/` may import from `chrome/*/`. Zone C injection is performed via the `ZoneCContext` accessed through `hooks/useZoneCContent.ts`. The hook is the boundary — the context implementation in chrome is not directly importable by surfaces.

**Rule 3: Chrome cannot import from surfaces.**

No file inside `chrome/*/` may import from `surfaces/*/`. The chrome is surface-agnostic. `ZoneCContext.content` is typed as `ReactNode` — the chrome renders whatever node it receives without knowing its origin.

**Rule 4: Shared packages cannot import from app code.**

No file inside `packages/@clubhub/*/` may import from `apps/*/`. Package-to-app imports are always a dependency inversion violation.

**Rule 5: All modules may import from shared packages.**

The following packages are importable from any location in `apps/cms-operator/src/` and from other packages:

| Package | Purpose |
|---|---|
| `@clubhub/types` | Shared TypeScript types and interfaces |
| `@clubhub/ui` | Shared UI component library |
| `@clubhub/state` | Zustand stores (authStore, wsStore, venueStore) |
| `@clubhub/hooks` | Shared React hooks |
| `@clubhub/api` | Typed API client functions |

### 6.2 ESLint Configuration

```javascript
// .eslintrc for apps/cms-operator
{
  "rules": {
    "import/no-restricted-paths": [
      "error",
      {
        "zones": [
          // Surfaces cannot import from each other
          {
            "target": "./src/surfaces/live-ops",
            "from": "./src/surfaces/incident-command"
          },
          {
            "target": "./src/surfaces/live-ops",
            "from": "./src/surfaces/venue-ops"
          },
          {
            "target": "./src/surfaces/live-ops",
            "from": "./src/surfaces/cms-operations"
          },
          {
            "target": "./src/surfaces/live-ops",
            "from": "./src/surfaces/replay-investigation"
          },
          {
            "target": "./src/surfaces/incident-command",
            "from": "./src/surfaces/live-ops"
          },
          {
            "target": "./src/surfaces/incident-command",
            "from": "./src/surfaces/venue-ops"
          },
          {
            "target": "./src/surfaces/incident-command",
            "from": "./src/surfaces/cms-operations"
          },
          {
            "target": "./src/surfaces/incident-command",
            "from": "./src/surfaces/replay-investigation"
          },
          {
            "target": "./src/surfaces/venue-ops",
            "from": "./src/surfaces/live-ops"
          },
          {
            "target": "./src/surfaces/venue-ops",
            "from": "./src/surfaces/incident-command"
          },
          {
            "target": "./src/surfaces/venue-ops",
            "from": "./src/surfaces/cms-operations"
          },
          {
            "target": "./src/surfaces/venue-ops",
            "from": "./src/surfaces/replay-investigation"
          },
          {
            "target": "./src/surfaces/cms-operations",
            "from": "./src/surfaces/live-ops"
          },
          {
            "target": "./src/surfaces/cms-operations",
            "from": "./src/surfaces/incident-command"
          },
          {
            "target": "./src/surfaces/cms-operations",
            "from": "./src/surfaces/venue-ops"
          },
          {
            "target": "./src/surfaces/cms-operations",
            "from": "./src/surfaces/replay-investigation"
          },
          // Surfaces cannot import from chrome
          {
            "target": "./src/surfaces",
            "from": "./src/chrome"
          },
          // Chrome cannot import from surfaces
          {
            "target": "./src/chrome",
            "from": "./src/surfaces"
          }
        ]
      }
    ]
  }
}
```

### 6.3 Package Dependency Graph

```
@clubhub/types        ← no dependencies on other @clubhub/* packages
@clubhub/ui           ← @clubhub/types only
@clubhub/state        ← @clubhub/types only
@clubhub/hooks        ← @clubhub/types, @clubhub/state
@clubhub/api          ← @clubhub/types

apps/cms-operator     ← all of the above
```

Circular dependencies between packages are forbidden. `pnpm` workspace and Turborepo pipeline configuration enforce build order based on this graph.

---

## 7. Bootstrap Sequence

The following describes the ordered sequence of operations from initial page load to a surface rendering in Zone B.

```
1. Browser loads index.html → Vite serves main.tsx
2. React mounts <App />
3. <QueryClientProvider /> initializes TanStack Query cache
4. <RouterProvider /> mounts — router matches current URL
5. <ErrorBoundary /> mounts — catches any downstream render errors
6. <RealtimeProvider /> mounts — opens WebSocket connection to backend
   - wsStore.status = 'CONNECTING'
   - ZoneBAutoReplace listener registered
7. <AuthGate /> mounts — calls GET /operators/me
   - Renders <BootstrapLoadingScreen /> until response resolves
   - On 401 or network error: navigate('/login')
   - On success: authStore.set({ operatorId, role, venueIds })
8. <ShellLayout /> mounts
   - CSS Grid layout renders
   - <SystemStatusBar /> mounts, subscribes to wsStore
   - <ZoneA /> mounts, renders venue list from venueStore
   - <main class="zone-b"> renders with <Outlet />
   - <ZoneC /> mounts, renders ZoneCContext.content (initially null)
9. React Router renders matched surface route
   - <Suspense /> renders <SurfaceLoadingState /> while chunk loads
   - Lazy chunk loads via dynamic import()
   - Surface component mounts, calls setContent() for Zone C
10. Surface is interactive
```

---

## 8. Amendment Process

Changes to this document require the following steps before code may merge:

1. Open an architecture review issue describing the proposed change and its rationale.
2. Obtain sign-off from at least one member of the shell team and one member of the affected surface team.
3. Update this document (APPLICATION-SHELL-STRUCTURE-v1.md) with the change, incrementing the version in the filename only for breaking structural changes.
4. Update ESLint rules in `.eslintrc` if import boundaries change.
5. Update `routes/lazy.ts` and `routes/index.tsx` if routes change.
6. Verify CI passes with no boundary violations before merging.

Minor additions (new files inside existing directories that follow established conventions) do not require amendment to this document.
