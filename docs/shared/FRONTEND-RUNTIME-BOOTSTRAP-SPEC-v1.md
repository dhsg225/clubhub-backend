# FRONTEND-RUNTIME-BOOTSTRAP-SPEC-v1

**Status:** AUTHORITATIVE
**Applies to:** `apps/cms-operator` (React 18, TypeScript, React Router v6, TanStack Query v5, Zustand, Vite, native WebSocket)
**Monorepo:** Turborepo + pnpm
**Last updated:** 2026-06-05

---

## 1. Bootstrap Overview

The following sequence diagram defines the complete initialization path from first browser load to a usable application. Every branch is a terminal or continuation state — there are no implicit transitions.

```
Browser load
  └─ Bundle parse (Vite build artifact)
       └─ React 18 createRoot().render()
            └─ Provider tree mounts (see Section 2)
                 └─ AuthGate evaluates in-memory token
                      │
                      ├─ No token present
                      │    └─ Navigate /login  [TERMINAL until login completes]
                      │
                      └─ Token present
                           └─ GET /operators/me
                                │
                                ├─ 401 / 403
                                │    └─ clearToken()
                                │         └─ Navigate /login?reason=session_expired  [TERMINAL]
                                │
                                ├─ 5xx / network error
                                │    └─ BootstrapErrorScreen reason="auth_unavailable"  [TERMINAL]
                                │
                                └─ 200 OK
                                     └─ authStore.setAuth(data)
                                          └─ [PARALLEL — independent, no gate between them]
                                               │
                                               ├─ GET /system/health
                                               │    ├─ pending → StatusBar skeleton (48px preserved)
                                               │    ├─ success → StatusBar hydrates with constitutional state
                                               │    └─ error   → StatusBar shows "Status unavailable" grey state
                                               │
                                               ├─ GET /venues
                                               │    ├─ pending → ZoneA skeleton (280px preserved)
                                               │    ├─ success → ZoneAVenueSelector hydrates with venue list
                                               │    └─ error   → ZoneA inline "Failed to load venues — [Retry]"
                                               │
                                               └─ RealtimeClient.connect(token)
                                                    ├─ connected → wsStore CONNECTED
                                                    │               → subscribe(venue_ids) once venues query resolves
                                                    │               → if venues not yet resolved: defer subscribe
                                                    └─ failed    → wsStore RECONNECTING
                                                                    → exponential backoff retry
                                                                    → amber indicator in StatusBar right area
                                                                    → app remains operational via REST polling

ShellLayout skeleton renders immediately after authStore.setAuth() — no zone waits for siblings.
Each zone updates independently as its data source resolves.
```

---

## 2. Provider Tree

### 2.1 Exact Nesting Order (outermost first)

```typescript
// apps/cms-operator/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from './query-client'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
```

The root layout route element (rendered inside RouterProvider for all authenticated routes):

```typescript
// apps/cms-operator/src/layouts/RootLayout.tsx
import { ErrorBoundary } from '@clubhub/ui'
import { RealtimeProvider } from '../providers/RealtimeProvider'
import { AuthGate } from '../providers/AuthGate'
import { ShellLayout } from './ShellLayout'
import { BootstrapErrorScreen } from '../components/BootstrapErrorScreen'
import { Outlet } from 'react-router-dom'

export function RootLayout() {
  return (
    <ErrorBoundary fallback={<BootstrapErrorScreen reason="unexpected_error" />}>
      <RealtimeProvider>
        <AuthGate>
          <ShellLayout>
            <Outlet />
          </ShellLayout>
        </AuthGate>
      </RealtimeProvider>
    </ErrorBoundary>
  )
}
```

### 2.2 Provider Responsibilities

#### `<StrictMode>`
- **Provides:** React double-invocation in development for detecting side-effect bugs
- **Reads:** nothing
- **Writes:** nothing
- **Failure behavior:** no runtime failure possible; development-only behavioral changes
- **Position rationale:** Outermost — wraps everything so no component escapes double-invocation detection in development

#### `<QueryClientProvider client={queryClient}>`
- **Provides:** TanStack Query context (cache, mutation queue, background refetch scheduler)
- **Reads:** `queryClient` singleton configured at module level
- **Writes:** shared query cache used by all `useQuery` / `useMutation` calls in the tree
- **Failure behavior:** if `queryClient` is undefined, React throws synchronously at mount — caught by no boundary (pre-boundary). Prevented by build-time module initialization.
- **Position rationale:** Must be outside `RouterProvider` so query cache is shared across all route transitions. Must be outside `RealtimeProvider` and `AuthGate` so those can use `useQuery` / `useQueryClient`.

#### `<RouterProvider router={router}>`
- **Provides:** React Router v6 routing context; renders matched route elements
- **Reads:** browser URL, `router` configuration (route tree, lazy-loaded chunks)
- **Writes:** navigation history, active route state
- **Failure behavior:** unmatched route renders the configured `errorElement` or root `notFoundElement`
- **Position rationale:** Inside `QueryClientProvider` so route components can call `useQuery`. Wraps all application UI.

#### `<ErrorBoundary fallback={<BootstrapErrorScreen reason="unexpected_error" />}>`
- **Provides:** React error boundary catching synchronous render errors and thrown promises not caught by TanStack Query
- **Reads:** nothing
- **Writes:** nothing; on catch renders `fallback`
- **Failure behavior:** IS the failure handler — renders `BootstrapErrorScreen` with `reason="unexpected_error"` on any uncaught render-phase throw
- **Position rationale:** Outermost within the route tree so it catches errors from `RealtimeProvider`, `AuthGate`, `ShellLayout`, and all surface routes

#### `<RealtimeProvider>`
- **Provides:** singleton `RealtimeClient` instance (native WebSocket wrapper); exposes client via React context for child access
- **Reads:** `authStore.token` (via Zustand selector) to initiate connection after auth resolves
- **Writes:** `wsStore.connection_state` ('DISCONNECTED' → 'CONNECTED' | 'RECONNECTING')
- **Failure behavior:** WebSocket failure is non-blocking — sets `wsStore.connection_state = 'RECONNECTING'`, initiates backoff retry, does not throw or block render
- **Position rationale:** Outside `AuthGate` so the provider instance exists before auth resolves, but connection is deferred until token is set. Inside `ErrorBoundary` so any synchronous mount error is caught.

#### `<AuthGate>`
- **Provides:** identity resolution gate — children do not render until `authStore` is populated
- **Reads:** `authStore.token` (in-memory), `GET /operators/me` response
- **Writes:** `authStore` via `setAuth(data)` after successful identity resolution
- **Failure behavior:** see Section 3 for exact state machine
- **Position rationale:** Inside `RealtimeProvider` (so WS client exists when auth resolves and can be connected immediately); outside `ShellLayout` (so no chrome renders before role is known — IC-03 enforcement)

#### `<ShellLayout>`
- **Provides:** the four-zone chrome (SystemStatusBar, ZoneA, ZoneB, ZoneC)
- **Reads:** `authStore.role` (for role-conditional zone content), `wsStore.connection_state` (for StatusBar indicator), TanStack Query cache for venue list and system health
- **Writes:** nothing to stores
- **Failure behavior:** individual zone failures are isolated (see Section 6); ShellLayout itself does not throw
- **Position rationale:** Inside `AuthGate` — role must be known before ShellLayout renders any role-conditional content (IC-03: absent-not-disabled)

---

## 3. AuthGate — Exact Implementation Contract

```typescript
// apps/cms-operator/src/providers/AuthGate.tsx
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@clubhub/state'
import { getCurrentOperator, clearToken } from '@clubhub/api'
import { BootstrapLoadingScreen } from '../components/BootstrapLoadingScreen'
import { BootstrapErrorScreen } from '../components/BootstrapErrorScreen'

export function AuthGate({ children }: { children: React.ReactNode }) {
  // Step 1: Check in-memory token (synchronous — no network)
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />

  // Step 2: Resolve operator identity from backend
  const { data, status, error } = useQuery({
    queryKey: ['operators', 'me'],
    queryFn: getCurrentOperator,
    retry: 1,           // One retry before treating as error
    staleTime: Infinity // Operator identity does not go stale during a session
  })

  // Step 3: Handle resolution states
  if (status === 'pending') return <BootstrapLoadingScreen />

  if (status === 'error') {
    if (isAuthError(error)) {
      clearToken()
      return <Navigate to="/login?reason=session_expired" replace />
    }
    return <BootstrapErrorScreen reason="auth_unavailable" />
  }

  // Step 4: Sync resolved identity to authStore
  // useEffect is required — side effects must not occur in the render phase
  useEffect(() => {
    if (data) {
      useAuthStore.getState().setAuth(data)
    }
  }, [data])

  // Step 5: Render children only when role is known
  // data is defined here (status === 'success')
  return <>{children}</>
}
```

### 3.1 `isAuthError(error)` — exact check

```typescript
// @clubhub/api/src/errors.ts
export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403
  }
  return false
}
```

`isAuthError` returns `true` only for HTTP 401 and HTTP 403 responses. It returns `false` for:
- 5xx responses (treated as service unavailability, not session invalidity)
- Network errors / timeouts (treated as service unavailability)
- Any non-`ApiError` thrown value

This distinction is critical: a 503 from a degraded auth service must not clear a valid token.

### 3.2 `clearToken()` — exact behavior

```typescript
// @clubhub/api/src/auth.ts
let _token: string | null = null

export function setToken(token: string): void {
  _token = token
  useAuthStore.getState().setToken(token)
}

export function clearToken(): void {
  _token = null
  useAuthStore.getState().clearAuth()
  // Does NOT touch localStorage, sessionStorage, or any cookie
  // Does NOT make any network call (logout endpoint called separately on explicit logout)
}

export function getToken(): string | null {
  return _token
}
```

`clearToken()` clears the module-level variable and the authStore in one synchronous call. After `clearToken()`, `useAuthStore(s => s.token)` returns `null`, which causes `AuthGate` to redirect to `/login` on next render.

### 3.3 `staleTime: Infinity` rationale

Operator identity (`GET /operators/me`) is treated as immutable for the lifetime of a session. The backend may change a role out-of-band, but the frontend does not poll for this — the operator must log out and log back in to reflect permission changes. This is a deliberate security design: role changes take effect at the next session, not mid-session. `staleTime: Infinity` prevents any background refetch of the identity query.

---

## 4. Parallel Hydration After Auth

After `authStore.setAuth(data)` is called, three asynchronous processes begin concurrently. They share no gate — each updates its zone independently as it resolves.

### 4.1 GET /system/health

```typescript
// Consumed in SystemStatusBar
const { data: healthData, status: healthStatus } = useQuery({
  queryKey: ['system', 'health'],
  queryFn: getSystemHealth,
  staleTime: 15_000,          // 15s — health data is fresh for 15 seconds
  refetchInterval: 30_000,    // 30s polling fallback if WS misses a health update
  enabled: !!authStore.token  // Only fires after auth resolves
})
```

- **On pending:** SystemStatusBar renders skeleton (see Section 5)
- **On success:** StatusBar skeleton replaced with real constitutional state indicators (NOMINAL / DEGRADED / EMERGENCY / REPLAY_LOCKED — exact values from system health response)
- **On error:** StatusBar renders grey "Status unavailable" text; does not block any other operation; does not throw; refetchInterval continues attempting recovery silently

### 4.2 GET /venues

```typescript
// Consumed in ZoneAVenueSelector
const { data: venues, status: venueStatus } = useQuery({
  queryKey: ['venues'],
  queryFn: getVenues,
  staleTime: 10_000,          // 10s — venue list considered fresh for 10 seconds
  // No refetchInterval — venue state updates arrive via WS VENUE_STATE_UPDATE events
  enabled: !!authStore.token
})
```

- **On pending:** ZoneA renders skeleton (see Section 5)
- **On success:** ZoneAVenueSelector skeleton replaced with real venue list; WebSocket subscription fires if `RealtimeClient` is already connected
- **On error:** ZoneA renders inline "Failed to load venues — [Retry]" where the venue list would appear; [Retry] calls `queryClient.invalidateQueries({ queryKey: ['venues'] })` to re-fire the venues query only; does not affect StatusBar or ZoneB

### 4.3 RealtimeClient.connect(token)

The `RealtimeProvider` useEffect watches `authStore.token` and initiates connection when token is set:

```typescript
// apps/cms-operator/src/providers/RealtimeProvider.tsx
useEffect(() => {
  const token = useAuthStore.getState().token
  if (!token) return

  const client = getRealtimeClient() // singleton
  client.connect(token)

  return () => {
    client.disconnect()
  }
}, [token]) // re-runs if token changes (login/logout cycle)
```

**Venue subscription coordination:**

```typescript
// Subscription fires only after venues are available in query cache
// RealtimeProvider subscribes when both conditions are true:
// 1. wsStore.connection_state === 'CONNECTED'
// 2. queryClient.getQueryData(['venues']) is non-empty

// Implemented via a combined effect watching both:
useEffect(() => {
  if (connectionState !== 'CONNECTED') return
  const venues = queryClient.getQueryData<Venue[]>(['venues'])
  if (!venues || venues.length === 0) return

  const venueIds = venues.map(v => v.id)
  client.subscribe({ venue_ids: venueIds })
}, [connectionState, venuesFromCache])
```

**Connection state transitions:**

| Event | wsStore.connection_state | StatusBar effect |
|---|---|---|
| Initial mount | DISCONNECTED | no indicator |
| connect() called | CONNECTING | no indicator |
| WebSocket open | CONNECTED | no indicator (nominal state) |
| WebSocket error / close | RECONNECTING | amber "Real-time updates paused — reconnecting..." |
| Reconnect succeeds | CONNECTED | amber indicator removed; subscribe re-fires |
| Explicit logout | DISCONNECTED | n/a (login screen) |

**Backoff retry:** exponential backoff starting at 1s, doubling each attempt, capped at 30s. No maximum attempt count — retries indefinitely until connection succeeds or user navigates away.

### 4.4 Coordination Rule

There is no synchronization gate between the three parallel hydration paths. `ShellLayout` renders its skeleton immediately after `authStore.setAuth()`. Each zone transitions from skeleton to real content the moment its data source resolves. A slow `/venues` response does not delay the StatusBar hydration. A WebSocket failure does not delay venue list rendering.

---

## 5. Loading States — Per Layer

### 5.1 BootstrapLoadingScreen

Displayed while `GET /operators/me` is pending (after token is confirmed present).

**Visual spec:**
- Full viewport: white background (`#FFFFFF`)
- Centered vertically and horizontally (flexbox column, `justify-content: center`, `align-items: center`)
- ClubHub logo SVG: 48×48px
- Circular spinner: 24px diameter, 2px stroke, `#6B7280` (grey-500), below logo with 16px gap, 1s rotation animation
- No navigation chrome, no zones, no zone chrome
- `aria-label="Loading ClubHub"` on the spinner element
- `role="status"` on the container

**Timeout state:** if `pending` for more than 10 seconds, add below the spinner:

```
"Connection is taking longer than expected"
[Retry]
```

- Text: 14px, `#6B7280`
- [Retry]: text button, 14px, `#2563EB` (blue-600), clicks `window.location.reload()`
- Timeout implemented via `useState` + `useEffect` with a 10,000ms `setTimeout`; cleared if status resolves before timeout fires

### 5.2 SystemStatusBar Skeleton

Displayed from `ShellLayout` mount until `GET /system/health` resolves.

**Visual spec:**
- Height: 48px (identical to populated StatusBar — no layout shift)
- Background: same as StatusBar (`#1F2937`, grey-800)
- Content: 6 grey rounded rectangles
  - Dimensions: 60×20px each
  - Color: `#374151` (grey-700)
  - Border-radius: 4px
  - Horizontal gap: 12px between each
  - Aligned: vertically centered within 48px bar
  - Animation: opacity pulse `0.4 → 0.8 → 0.4`, duration 1.5s, `ease-in-out`, `infinite`
- Constitutional state label placeholder: 120×16px grey rectangle (`#374151`), right-aligned in bar
- No text content during skeleton state

### 5.3 ZoneA Skeleton

Displayed from `ShellLayout` mount until `GET /venues` resolves.

**Visual spec:**
- Width: 280px (identical to populated ZoneA — no layout shift)
- Background: `#F9FAFB` (grey-50)
- Content: 4 venue skeleton rows, each row:
  - Height: 48px, full width, 8px vertical padding
  - Left element: grey circle 12px diameter (`#D1D5DB`, grey-300) — machine state dot placeholder
  - Right element: grey bar 140×14px (`#D1D5DB`), 8px left margin from circle
  - Border-bottom: 1px `#E5E7EB` (grey-200) on rows 1–3
- Animation: same opacity pulse as StatusBar skeleton (0.4→0.8→0.4, 1.5s, synchronized phase)
- `aria-busy="true"` on the ZoneA container

### 5.4 Zone B Loading State

Zone B displays a loading state in two scenarios:
1. Lazy-loaded surface chunk is downloading
2. Surface chunk is loaded but surface-specific data fetch is pending

**Visual spec (both scenarios):**
- Full Zone B area: white background (`#FFFFFF`)
- Centered: circular spinner 32px diameter, 3px stroke, `#6B7280`, 1s rotation
- No surface content of any kind until both chunk is loaded AND surface data is resolved
- `aria-label="Loading surface"` on spinner
- `role="status"` on container

React Router v6 lazy loading integration:

```typescript
// router.tsx — surface routes use React.lazy with Suspense
const LiveOpsSurface = React.lazy(() => import('./surfaces/LiveOpsSurface'))
const IncidentCommandSurface = React.lazy(() => import('./surfaces/IncidentCommandSurface'))
const VenueOpsSurface = React.lazy(() => import('./surfaces/VenueOpsSurface'))
const CmsOperationsSurface = React.lazy(() => import('./surfaces/CmsOperationsSurface'))
const ReplaySurface = React.lazy(() => import('./surfaces/ReplaySurface')) // deferred

// Zone B is wrapped in Suspense with the loading spinner as fallback
<Suspense fallback={<ZoneBLoadingSpinner />}>
  <Outlet />
</Suspense>
```

### 5.5 ZoneC Loading State

ZoneC has no loading state at boot. It renders as an empty 320px panel immediately on `ShellLayout` mount. ZoneC content is populated by individual surfaces via their own data fetches after the surface chunk loads. ZoneC never shows a skeleton — it is either empty or populated by the active surface.

---

## 6. Failure States — Exact Specifications

### 6.1 BootstrapErrorScreen (Full-Screen, Unrecoverable)

```typescript
// apps/cms-operator/src/components/BootstrapErrorScreen.tsx
interface BootstrapErrorScreenProps {
  reason: 'auth_unavailable' | 'network_error' | 'unexpected_error'
}

export function BootstrapErrorScreen({ reason }: BootstrapErrorScreenProps) { ... }
```

**Visual spec:**
- Full viewport: white background
- Centered column layout
- ClubHub logo: 48×48px
- Error icon: 32×32px, red (`#EF4444`), below logo with 24px gap
- Heading: 18px semibold, `#111827`, below icon with 12px gap
- Body text: 14px, `#6B7280`, below heading with 8px gap, max-width 360px, centered
- Action button(s): below body with 24px gap

**Messages and actions per reason:**

| reason | Heading | Body | Primary action | Secondary action |
|---|---|---|---|---|
| `auth_unavailable` | "Authentication Unavailable" | "Authentication service is unavailable. Please try again shortly." | [Retry] — `window.location.reload()` | — |
| `network_error` | "Cannot Connect" | "Cannot connect to ClubHub services. Check your network connection." | [Retry] — `window.location.reload()` | — |
| `unexpected_error` | "Unexpected Error" | "An unexpected error occurred. Please refresh the page." | [Refresh Page] — `window.location.reload()` | [Contact Support] — opens `mailto:support@clubhub.tv` |

No navigation chrome, no zones. The only exit from BootstrapErrorScreen is the action button or a manual browser reload.

### 6.2 Partial Zone Failures (Auth Succeeded)

These failures occur after auth resolves. The application is usable; only the failed zone degrades.

**Venue load failure (ZoneA):**

```typescript
// ZoneAVenueSelector.tsx — error branch
if (venueStatus === 'error') {
  return (
    <div className="zone-a-error" role="alert">
      <p>Failed to load venues</p>
      <button onClick={() => queryClient.invalidateQueries({ queryKey: ['venues'] })}>
        Retry
      </button>
    </div>
  )
}
```

- Inline error replaces the venue skeleton in ZoneA; 280px width preserved
- [Retry] re-fires only the `['venues']` query — does not reload the page, does not affect other zones
- No toast, no modal, no StatusBar change

**System health failure (StatusBar):**

```typescript
// SystemStatusBar.tsx — error branch
if (healthStatus === 'error') {
  return <span className="status-unavailable">Status unavailable</span>
  // Rendered in StatusBar right area; grey text; no icon
}
```

- StatusBar continues to render at full 48px height
- Grey "Status unavailable" text in the constitutional state position
- `refetchInterval: 30_000` continues — StatusBar will hydrate when health endpoint recovers
- Does not block any surface or operator action

**Zone B surface failure:**

```typescript
// Surface-level error boundary within Zone B
<ErrorBoundary
  fallback={
    <ZoneBError onRetry={() => navigate(location.pathname)} />
  }
>
  <Outlet />
</ErrorBoundary>
```

- Inline "Failed to load — [Retry]" centered in Zone B area
- [Retry] calls `navigate(location.pathname)` which triggers route re-evaluation and re-fetch
- Does not affect ZoneA, StatusBar, or ZoneC

### 6.3 WebSocket Failure (Non-Blocking)

WebSocket failure does not block the application. The app remains fully operational via REST polling.

**State transition on WebSocket failure:**

1. `wsStore.connection_state` set to `'RECONNECTING'`
2. StatusBar right area renders: amber dot + "Real-time updates paused — reconnecting..." (14px, `#D97706`, amber-600)
3. No modal, no overlay, no blocking of any Zone B interaction
4. Backoff retry begins (1s → 2s → 4s → 8s → 16s → 30s cap)
5. On reconnect: `wsStore.connection_state` set to `'CONNECTED'`; amber indicator removed; venue subscription re-fires with current `venue_ids` from query cache

**Operator experience during WS failure:**
- Venue state continues to update via `refetchInterval` on individual venue queries
- System health continues to update via `refetchInterval: 30_000` on health query
- Live events (scores, content changes) may lag by up to `refetchInterval` seconds — this is acceptable and documented
- No operator action is blocked by WS disconnection

---

## 7. Environment Variables at Build Time

All environment variables are injected by Vite at build time via `import.meta.env`. They are not available at runtime from `process.env`.

### 7.1 Build-Time Enforcement

```typescript
// apps/cms-operator/vite.config.ts
import { defineConfig } from 'vite'

const requiredEnvVars = ['VITE_API_BASE_URL', 'VITE_WS_URL', 'VITE_APP_ENV'] as const

export default defineConfig(({ mode }) => {
  requiredEnvVars.forEach(key => {
    if (!process.env[key]) {
      throw new Error(
        `Build error: Missing required environment variable: ${key}\n` +
        `Ensure ${key} is set in your .env.${mode} file or CI environment.`
      )
    }
  })

  return {
    // ... rest of vite config
  }
})
```

A missing required variable causes the Vite build to throw synchronously, printing the variable name and failing the build process with a non-zero exit code. This prevents a misconfigured artifact from reaching any environment. It is a build-time error, not a runtime error — there is no in-app error screen for this case.

### 7.2 Variable Definitions

| Variable | Required | Example value | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `https://api.clubhub.tv/api/v1` | Base URL for all REST API calls. No trailing slash. All `@clubhub/api` functions prepend this. |
| `VITE_WS_URL` | Yes | `wss://api.clubhub.tv/ws` | WebSocket endpoint for `RealtimeClient.connect()`. Must be `wss://` in production. |
| `VITE_APP_ENV` | Yes | `production` \| `staging` \| `development` | Enables/disables dev tooling (React DevTools, TanStack Query devtools, verbose logging). Must be `production` for production builds. |
| `VITE_SENTRY_DSN` | No | `https://abc123@o0.ingest.sentry.io/0` | Sentry error reporting DSN. If absent, Sentry is not initialized and error reporting is silently disabled. No build error, no runtime error. |

### 7.3 Runtime Access Pattern

```typescript
// @clubhub/api/src/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string
export const WS_URL = import.meta.env.VITE_WS_URL as string
export const APP_ENV = import.meta.env.VITE_APP_ENV as 'production' | 'staging' | 'development'
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
```

These are module-level constants — they are read once at module initialization and do not change at runtime. They are never read from `window`, `localStorage`, or injected into the DOM.

---

## 8. Token Lifecycle

### 8.1 Storage Mechanism

The JWT access token is stored exclusively in a module-level variable in `@clubhub/api/src/auth.ts`. It is never written to:
- `localStorage`
- `sessionStorage`
- Any cookie (httpOnly or otherwise)
- React state (`useState`)
- Any Zustand store (the `authStore` holds the decoded claims and role, not the raw token)
- Any DOM attribute or data attribute

```typescript
// @clubhub/api/src/auth.ts
// This is the single source of truth for the token. No other location holds it.
let _token: string | null = null

export function setToken(token: string): void {
  _token = token
}

export function getToken(): string | null {
  return _token
}

export function clearToken(): void {
  _token = null
  // authStore.clearAuth() called separately by the consumer (AuthGate or logout handler)
}
```

### 8.2 Token Lifecycle Events

| Event | Action | Side effects |
|---|---|---|
| Successful `POST /auth/login` | `setToken(response.access_token)` | authStore.setToken(token) to trigger AuthGate re-evaluation |
| `GET /operators/me` → 200 | token unchanged | authStore.setAuth(operatorData) called in AuthGate useEffect |
| Any authenticated endpoint → 401 | `clearToken()` | authStore.clearAuth(); NavigatE to /login?reason=session_expired |
| Explicit operator logout | `clearToken()` | `POST /auth/logout` called first; then clearToken(); navigate /login |
| Page reload | `_token` is `null` (module re-initializes) | authStore starts with null token; AuthGate redirects to /login |

### 8.3 Token Consumption

The token is read in two places:

**`apiClient` fetch wrapper** — appends `Authorization: Bearer <token>` header to every authenticated request:

```typescript
// @clubhub/api/src/client.ts
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    clearToken()
    useAuthStore.getState().clearAuth()
    // Router will detect null token and redirect to /login on next render
    throw new ApiError(401, 'Unauthorized')
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }

  return response.json() as Promise<T>
}
```

**`RealtimeClient.connect(token)`** — passes token as query parameter or Authorization header to the WebSocket handshake:

```typescript
// @clubhub/api/src/realtime-client.ts
connect(token: string): void {
  const url = new URL(WS_URL)
  url.searchParams.set('token', token)
  this._ws = new WebSocket(url.toString())
  // ...
}
```

### 8.4 No Persistence Across Reloads

Token persistence across page reloads is intentionally not implemented. On any page reload:
1. The `_token` module variable is `null`
2. `authStore.token` is `null` (Zustand default)
3. `AuthGate` renders `<Navigate to="/login" replace />`
4. The operator must log in again

**Rationale:** Memory-only storage prevents XSS token theft. If an attacker injects JavaScript, they cannot access `localStorage` or `sessionStorage` to steal tokens. The only way to steal a memory-only token is to execute code in the same JavaScript execution context during the same session — which is a fundamentally higher attack bar. The UX cost (login required on reload) is acceptable for operator-facing tooling with non-consumer users.

Refresh token rotation and silent renewal are out of scope for v1. If session persistence across reloads is required in a future version, it must use httpOnly cookies exclusively — never localStorage.

---

## 9. Invariants and Constraints

The following invariants must hold at all times after implementation. Any deviation is a contract violation.

| ID | Invariant |
|---|---|
| BOOT-I01 | No zone-specific content renders before `authStore.token` is non-null |
| BOOT-I02 | No role-conditional DOM renders before `authStore.role` is non-null (IC-03: absent-not-disabled) |
| BOOT-I03 | `GET /operators/me` is the only blocking call in the bootstrap path; all others are non-blocking |
| BOOT-I04 | A 5xx from `GET /operators/me` never clears the token |
| BOOT-I05 | A WebSocket failure never blocks any REST-based operator action |
| BOOT-I06 | The token is never written to localStorage, sessionStorage, or any cookie |
| BOOT-I07 | `staleTime: Infinity` on `['operators', 'me']` — no background refetch of operator identity |
| BOOT-I08 | ZoneA and StatusBar skeletons preserve their layout dimensions (280px and 48px) — no layout shift |
| BOOT-I09 | BootstrapLoadingScreen renders no navigation chrome of any kind |
| BOOT-I10 | Missing required `VITE_*` env vars fail the Vite build; they are never surfaced as runtime errors |
| BOOT-I11 | `clearToken()` is the single synchronous operation that clears the token; it is called from exactly two places: `apiRequest` on 401, and the logout handler |
| BOOT-I12 | RealtimeClient.connect() is called at most once per token (idempotent on reconnect path) |

---

*End of FRONTEND-RUNTIME-BOOTSTRAP-SPEC-v1*
