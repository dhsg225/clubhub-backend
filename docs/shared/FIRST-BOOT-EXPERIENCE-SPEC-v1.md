# FIRST-BOOT-EXPERIENCE-SPEC-v1

**Document class:** Runtime specification
**Status:** CANONICAL
**Version:** 1.0.0
**Last updated:** 2026-06-05
**Scope:** ClubHub TV CMS/HCI operator platform — boot sequence, loading states, timing gates, and first-actionable-interaction contract

---

## 1. Purpose and Scope

This document specifies the exact sequence of states an operator experiences from the moment they navigate to the application URL through to having a fully usable CMS workspace. It is not a UX design guide. It is the runtime contract for:

- Which components are visible at each boot state
- What data is required before each state transition
- What constitutes the first-actionable-interaction gate
- What failure states exist and how they are surfaced
- How reload and re-navigation behave

Implementors must treat this document as a test contract. Every state transition listed here must be covered by E2E and unit tests as specified in Section 9.

---

## 2. Boot State Machine (Top-Level)

```
                         ┌─────────────────────────────────────────────────────────────┐
                         │                  BOOT STATE MACHINE                         │
                         └─────────────────────────────────────────────────────────────┘

  Browser navigates to app URL
          │
          ▼
  ┌───────────────┐
  │  STATE 0      │  HTML shell received, blank screen
  │  t = 0ms      │  Vite JS bundle loading
  └───────┬───────┘
          │  bundle parsed + executed
          ▼
  ┌───────────────┐
  │  STATE 1      │  React mounting, providers initializing
  │  t = bundle   │  BootstrapLoadingScreen visible (full-screen)
  └───────┬───────┘
          │  providers mounted
          ▼
  ┌───────────────────────────────────┐
  │  STATE 2: AuthGate               │
  │                                   │
  │   ┌─────────────┐                 │
  │   │ 2a: No token│──→ LoginForm    │
  │   └─────────────┘    (no spinner) │
  │                                   │
  │   ┌─────────────────────────┐     │
  │   │ 2b: Token exists        │     │
  │   │ GET /operators/me       │     │
  │   │ BootstrapLoadingScreen  │     │
  │   │ + spinner after 200ms   │     │
  │   └─────────────────────────┘     │
  └──────────┬────────────────────────┘
             │  auth confirmed
             │
             ├──────────────────────────────────── 401 → BootstrapErrorScreen (variant B)
             │
             ▼
  ┌───────────────┐
  │  STATE 3      │  Parallel prefetch fires
  │  t = auth OK  │  GET /system/health
  │               │  GET /venues
  │               │  RealtimeClient.connect()
  │               │  BootstrapLoadingScreen still visible
  └───────┬───────┘
          │
          ├──────────────────────────────────────── /system/health 503 → ErrorScreen (variant A)
          ├──────────────────────────────────────── /venues 503      → ErrorScreen (variant C)
          ├──────────────────────────────────────── any prefetch >8s → ErrorScreen (variant A)
          │
          │  all prefetch complete (or venues-only partial — see Section 7)
          ▼
  ┌───────────────┐
  │  STATE 4      │  BootstrapLoadingScreen fades out (200ms)
  │  t = prefetch │  ShellLayout mounts
  │    complete   │  Zones render with skeletons
  │               │  ← FIRST-ACTIONABLE-INTERACTION GATE
  └───────┬───────┘
          │  VenueSelector clickable + WS connected + Zone B real data rendered
          ▼
  ┌───────────────┐
  │  STATE 5      │  Fully operational
  │  t = WS +     │  All zones live
  │    venues     │  System Status Bar: green dot, operator name, venue count
  └───────────────┘
```

---

## 3. State 0 — HTML Shell Loaded

**Trigger:** Browser receives `index.html` from server.
**Wall-clock reference:** t = 0ms
**Target duration:** <2s on fast connection (bundle load is not controlled by the app)

### 3.1 What is visible

Nothing. The browser renders the HTML shell background. The `<body>` background color MUST be set to `#1A1A2E` in the HTML `<style>` tag (not in a loaded stylesheet) so there is no white flash before the bundle executes.

```html
<!-- index.html — required inline style -->
<style>
  body {
    margin: 0;
    background-color: #1A1A2E;
  }
</style>
```

### 3.2 What is loading

- Vite vendor chunk
- Vite app chunk (chrome)
- No API calls, no WebSocket, no auth checks

### 3.3 Implementation note

Do not render any React component from a `<script>` tag in `index.html`. The `<div id="root">` must be empty. The background color is the only content until State 1.

---

## 4. State 1 — JS Executing, Providers Mounting

**Trigger:** Vite bundle parsed and executed; `ReactDOM.createRoot().render()` called.
**Target duration:** <100ms (provider initialization only)

### 4.1 What is visible

`BootstrapLoadingScreen` — full-screen overlay. This is the first React component rendered.

### 4.2 BootstrapLoadingScreen specification

```typescript
interface BootstrapLoadingScreenProps {
  showSpinner?: boolean;   // defaults false; set true after 200ms in State 2b
  fadeOut?: boolean;       // triggers 200ms CSS fade at State 4 transition
}
```

**Layout:** Full-screen fixed overlay, `z-index: 2000`
**Background:** `#1A1A2E`
**Content:** Vertically and horizontally centered flex column

| Element | Spec |
|---|---|
| Wordmark | "ClubHub TV" text, color `#FFFFFF`, font-size `24px`, font-weight `600`, letter-spacing `0.04em` |
| Loading bar | Below wordmark, `8px` gap, width `200px`, height `4px`, background `#2A2A3E`, bar fill `#4A9EFF`, pulsing animation |
| Spinner (conditional) | 20px diameter, color `#4A9EFF`, appears overlaid on wordmark bottom-right after 200ms delay in State 2b only |

**Loading bar animation:**

```css
@keyframes loadingPulse {
  0%   { transform: scaleX(0.2); transform-origin: left; }
  50%  { transform: scaleX(1.0); transform-origin: left; }
  100% { transform: scaleX(0.2); transform-origin: left; }
}

.loading-bar-fill {
  animation: loadingPulse 1.6s ease-in-out infinite;
}
```

**Fade-out transition (State 4):**

```css
.bootstrap-loading-screen {
  transition: opacity 200ms ease-out;
}
.bootstrap-loading-screen.fade-out {
  opacity: 0;
  pointer-events: none;
}
```

### 4.3 Provider mount sequence

The following providers mount in this exact order (outer to inner):

```
ReactQueryProvider
  └── RouterProvider
        └── ErrorBoundary
              └── RealtimeProvider
                    └── AuthGate
                          └── ShellLayout
                                └── Outlet (surface components)
```

No surface-level component renders until `AuthGate` resolves. `BootstrapLoadingScreen` is rendered by `AuthGate` while it is in a pending state.

---

## 5. State 2 — AuthGate Running

**Trigger:** All providers mounted; `AuthGate` component mounts.
**Target duration:** <500ms (auth check round-trip)

`AuthGate` checks whether a JWT exists in memory (Zustand `authStore`). This produces two sub-states.

### 5.1 State 2a — No Token in Memory

**Condition:** `authStore.token === null`

**Immediate action:** Render `LoginForm` component. Do NOT show `BootstrapLoadingScreen`. The dark background (`#1A1A2E`) is already visible from State 0/1, so `LoginForm` appears centered against it.

**LoginForm specification:**

```typescript
interface LoginFormProps {
  onSuccess: (token: string, operator: OperatorProfile) => void;
}

interface LoginFormState {
  email: string;
  password: string;
  submitting: boolean;
  error: 'invalid_credentials' | 'service_unavailable' | null;
}
```

**Layout:** Centered card, `max-width: 400px`, background `#242436`, border-radius `8px`, padding `32px`

| Element | Spec |
|---|---|
| Card title | "Sign in to ClubHub TV", color `#FFFFFF`, font-size `18px`, font-weight `600`, margin-bottom `24px` |
| Email field | Full-width, label "Email address", `type="email"`, `autocomplete="email"` |
| Password field | Full-width, label "Password", `type="password"`, `autocomplete="current-password"` |
| Field gap | `16px` between fields |
| Submit button | Full-width, label "Sign in", `disabled` while `submitting === true`, background `#4A9EFF`, color `#FFFFFF`, height `44px`, border-radius `6px` |
| Error text | Below submit button, `margin-top: 12px`, color `#FF6B6B`, font-size `14px` |

**Error message strings (exact):**

- `invalid_credentials`: "Invalid credentials. Check your email and password."
- `service_unavailable`: "Service unavailable — try again."

**On submit behavior:**

1. Set `submitting = true`; disable button immediately.
2. POST credentials to `/auth/login`.
3. On 200: store token in `authStore` (memory only — never `localStorage`, never `sessionStorage`). Call `onSuccess`.
4. On 401: set `error = 'invalid_credentials'`, set `submitting = false`.
5. On 503 or network error: set `error = 'service_unavailable'`, set `submitting = false`.

**Out of scope for MVP:** "Remember me", "Forgot password", SSO, magic link.

**On success:** `AuthGate` receives token and operator profile, proceeds to State 3. `LoginForm` unmounts.

### 5.2 State 2b — Token Exists in Memory

**Condition:** `authStore.token !== null`

**Immediate action:** Show `BootstrapLoadingScreen` (no spinner yet). Fire `GET /operators/me` with the token in `Authorization: Bearer` header.

**Spinner threshold:** If `GET /operators/me` has not resolved within 200ms, set `BootstrapLoadingScreen showSpinner={true}`. This prevents flash of spinner on fast connections.

**Response handling:**

| Response | Action |
|---|---|
| 200 | Store refreshed operator profile in `authStore`. Proceed to State 3. |
| 401 | Clear token from `authStore`. Show `BootstrapErrorScreen` variant B ("Session expired"). |
| 503 / network error | Show `BootstrapErrorScreen` variant A ("Cannot reach ClubHub servers"). |

---

## 6. State 3 — Parallel Prefetch Running

**Trigger:** Auth confirmed; operator profile available.
**Target duration:** <1.5s
**Timeout:** 8 seconds total; if any required prefetch has not resolved, show `BootstrapErrorScreen` variant A.

### 6.1 What is visible

`BootstrapLoadingScreen` continues. The wordmark remains. The loading bar continues pulsing. No zone skeletons are shown yet.

### 6.2 Prefetch operations (fire simultaneously)

All three operations are initiated in the same synchronous pass — no sequential dependency between them.

```typescript
// Fired concurrently — do not await one before starting another
const [healthResult, venuesResult, wsResult] = await Promise.allSettled([
  queryClient.prefetchQuery({
    queryKey: ['system', 'health'],
    queryFn: () => api.get('/system/health'),
  }),
  queryClient.prefetchQuery({
    queryKey: ['venues', operatorId],
    queryFn: () => api.get('/venues'),
  }),
  realtimeClient.connect(),
]);
```

### 6.3 Timeout implementation

A single `AbortController` or `Promise.race` with an 8-second timeout wraps the `Promise.allSettled` call. If the race resolves on the timeout side, show `BootstrapErrorScreen` variant A regardless of which prefetch was still pending.

```typescript
const PREFETCH_TIMEOUT_MS = 8000;

const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('PREFETCH_TIMEOUT')), PREFETCH_TIMEOUT_MS)
);

try {
  await Promise.race([prefetchAll(), timeoutPromise]);
} catch (err) {
  if (err.message === 'PREFETCH_TIMEOUT') {
    showBootstrapError('cannot_reach_servers');
    return;
  }
}
```

### 6.4 Partial failure handling

| Failure | Action |
|---|---|
| `GET /system/health` 503 | Show `BootstrapErrorScreen` variant A — full boot blocked |
| `GET /system/health` network error | Show `BootstrapErrorScreen` variant A — full boot blocked |
| `GET /venues` 503 | Proceed to State 4 with variant C partial shell (see Section 7.3) |
| `GET /venues` returns empty array | Proceed to State 4 normally; Zone A renders empty state |
| `RealtimeClient.connect()` fails | Proceed to State 4; System Status Bar shows disconnected state; retry logic runs independently |

---

## 7. State 4 — Shell Mounted, Zones Populating

**Trigger:** Prefetch operations complete (or venues-only partial, per Section 6.4).
**Target duration:** <300ms from shell appearance to first-actionable-interaction gate

### 7.1 Transition from State 3

1. Set `BootstrapLoadingScreen fadeOut={true}` — triggers 200ms CSS opacity transition.
2. `ShellLayout` mounts simultaneously (behind the fading overlay, `z-index < 2000`).
3. After 200ms, `BootstrapLoadingScreen` unmounts from DOM.

The fade and mount are concurrent. The operator sees the shell appearing through the fade.

### 7.2 Zone render sequence

Zones render with skeleton placeholders. Real data populates asynchronously from the TanStack Query cache (which was populated during State 3 prefetch).

#### System Status Bar (48px fixed top, z-index 1000)

Renders immediately with real data. The `/system/health` response is already in the query cache. No skeleton for this zone.

Required fields on first render:
- Connection indicator dot: green if `RealtimeClient` connected, amber if connecting, red if failed
- Operator display name (from `authStore.operator.displayName`)
- Venue count (from cached venues response: `venues.length`)

#### Zone A — Left Nav (280px fixed left)

Renders with skeleton placeholders. Nav items (Live Ops, Incident Command, Venue Ops, CMS Ops) are visible but `pointer-events: none` until venue data is processed.

Skeleton state:

```
┌────────────────────┐
│  [○] [████████████]│  VenueSelector row 1
│  [○] [████████████]│  VenueSelector row 2
│                    │  8px gap
│  [████████████████]│  IncidentList row 1 (48px height)
│  [████████████████]│  IncidentList row 2
│  [████████████████]│  IncidentList row 3
│                    │
│  Live Ops      (─) │  nav item (visible, non-interactive)
│  Incident Cmd  (─) │
│  Venue Ops     (─) │
│  CMS Ops       (─) │
└────────────────────┘
```

#### Zone B — Main Surface (fluid center)

Renders Live Ops skeleton immediately:

```
┌──────────────────────────────────────────┐
│  [████████████] [████████████]           │  MetricCard row 1 (2 cards, 120×80px each)
│  [████████████] [████████████]           │  MetricCard row 2
│                                          │
│  [████████████████████████████████████] │  VenueRow 1 (56px height)
│  [████████████████████████████████████] │  VenueRow 2
│  [████████████████████████████████████] │  VenueRow 3
└──────────────────────────────────────────┘
```

#### Zone C — Right Panel (320px collapsible)

Collapsed by default (`width: 48px`, showing only a toggle handle). No skeleton required in collapsed state. Zone C does not affect the first-actionable-interaction gate.

### 7.3 First-Actionable-Interaction Gate

**Definition:** The moment at which the operator can click a venue in `VenueSelector` and receive a real response.

**Conditions that must ALL be true:**

1. `ShellLayout` is mounted (not covered by `BootstrapLoadingScreen`)
2. Venues response has been processed from the TanStack Query cache into the `venueStore`
3. `VenueSelector` component has completed its render with real venue rows
4. Zone A nav items have `pointer-events: auto`

**Typical timing:** 100–300ms after shell appears (venues data is already in cache from State 3 prefetch; this is purely render time).

**Implementation:**

```typescript
// venueStore (Zustand)
interface VenueStoreState {
  venues: Venue[];
  selectedVenueId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

// VenueSelector only enables click handlers when status === 'ready'
const isInteractive = venueStore.status === 'ready';
```

Zone A nav items become interactive when `venueStore.status === 'ready'`. Until then, `pointer-events: none` on all nav items prevents premature navigation to surfaces that depend on `selectedVenueId`.

---

## 8. State 5 — Fully Operational

**Trigger:** WebSocket reports `CONNECTED` status AND venues are rendered AND Zone B Live Ops surface has rendered with real data.

### 8.1 System Status Bar final state

| Element | Value |
|---|---|
| Connection dot | Green (`#4CAF50`), 8px diameter |
| Operator name | `authStore.operator.displayName` |
| Venue count | `{n} venue{n !== 1 ? 's' : ''}` |
| Surface label | "Live Ops" (current active surface) |

### 8.2 Zone A final state

- `VenueSelector`: real venue rows, first venue auto-selected if only one venue; none selected if multiple (operator must choose)
- `IncidentList`: real incident data; empty state shown if no active incidents ("No active incidents")
- Nav items: all interactive

### 8.3 Zone B final state

Live Ops surface renders with:
- 4 metric cards (real data from venue telemetry)
- Venue rows with real status indicators
- No skeleton blocks remaining

### 8.4 Zone C

Remains collapsed (`width: 48px`) until the operator explicitly opens it. No auto-open behavior on first boot.

---

## 9. Skeleton Component Specifications

All skeleton components use static placeholders. No shimmer animation. Shimmer is excluded because it creates distracting motion in an operational context where operators need to notice real motion (incident alerts, status changes).

### 9.1 Base SkeletonBlock

```typescript
interface SkeletonBlockProps {
  width: number | string;  // px or '%'
  height: number;          // px
  borderRadius?: number;   // px, defaults to 4
}
```

```css
.skeleton-block {
  background-color: #2A2A3E;
  border-radius: 4px;
  /* no animation */
}
```

### 9.2 VenueSelector Skeleton

2 rows. Each row:
- 16px diameter gray circle (`border-radius: 50%`, background `#2A2A3E`)
- 120px × 16px `SkeletonBlock`
- 8px horizontal gap between circle and block
- 12px vertical gap between rows

### 9.3 IncidentList Skeleton

3 rows. Each row:
- Full-width `SkeletonBlock`, height `48px`
- 4px vertical gap between rows

### 9.4 MetricCard Skeleton

2×2 grid layout. Each card:
- `SkeletonBlock`, width `120px`, height `80px`
- 12px gap between cards (both row and column)

### 9.5 VenueRow Skeleton

3 rows. Each row:
- Full-width `SkeletonBlock`, height `56px`
- 4px vertical gap between rows

---

## 10. Failure States

### 10.1 BootstrapErrorScreen

```typescript
interface BootstrapErrorScreenProps {
  variant: 'cannot_reach_servers' | 'session_expired' | 'venue_data_unavailable';
}
```

**Common layout:** Full-screen, same dark background `#1A1A2E`, centered flex column, ClubHub TV wordmark at top (same as loading screen).

### 10.2 Variant A — "Cannot reach ClubHub servers"

**Trigger conditions:**
- `GET /system/health` returns 503 or network error
- Any prefetch exceeds 8s timeout

**Layout:**

| Element | Spec |
|---|---|
| Icon | Warning triangle, `#FF6B6B`, 48px |
| Heading | "Cannot reach ClubHub servers", `#FFFFFF`, 20px |
| Body | "Check your network connection and try again.", `#A0A0B0`, 14px |
| Retry button | "Retry", background `#4A9EFF`, color `#FFFFFF`, width `160px`, height `44px` |

**Retry button behavior:** Re-executes State 3 prefetch. Does not clear auth token. Does not redirect to login.

**No logout option on this screen.** The session may be valid; the server is simply unreachable.

### 10.3 Variant B — "Session expired"

**Trigger condition:** `GET /operators/me` returns 401.

**Layout:**

| Element | Spec |
|---|---|
| Icon | Lock icon, `#FF6B6B`, 48px |
| Heading | "Session expired", `#FFFFFF`, 20px |
| Body | "Your session has ended. Sign in again to continue.", `#A0A0B0`, 14px |
| Action button | "Sign in again", background `#4A9EFF`, color `#FFFFFF`, width `160px`, height `44px` |

**"Sign in again" behavior:**
1. Clear `authStore.token` (set to `null`).
2. Clear `authStore.operator` (set to `null`).
3. Unmount `BootstrapErrorScreen`.
4. Render `LoginForm` (State 2a path).

### 10.4 Variant C — "Venue data unavailable" (partial boot)

**Trigger condition:** `GET /venues` returns 503 or network error, but `GET /system/health` succeeded.

**Behavior:** Do NOT show full-screen error. Proceed to State 4 with shell mounted. Zone A and Zone B render empty states.

**Zone A empty state (VenueSelector area):**
- Text: "No venues available", `#A0A0B0`, 14px, centered in the VenueSelector region
- Sub-text: "Contact your administrator if this persists.", `#6B6B80`, 12px

**Zone B empty state:**
- Centered in fluid area: "Venue data could not be loaded."
- Retry link: "Try reloading" — fires `queryClient.invalidateQueries({ queryKey: ['venues'] })`.

**System Status Bar:** Renders normally with health data. Connection dot reflects WebSocket state.

### 10.5 Partial Zone Failure (Zone C)

If Zone C data fails to load after the shell is mounted:

1. Zone C remains in collapsed state (`width: 48px`).
2. A non-blocking console error is logged: `[BOOT] Zone C data failed: {error}`.
3. Boot sequence continues. The operator is not informed unless they attempt to open Zone C.
4. When the operator opens Zone C, display an inline error state within the panel: "Panel data unavailable. Retry."

This failure does not affect the first-actionable-interaction gate.

---

## 11. Reload and Re-Navigation Behavior

### 11.1 Page Reload (browser F5 or hard reload)

**Result:** Token is lost. `authStore` is reset to `null` (Zustand state is in-memory, not persisted).

**Sequence:**

1. Browser discards all JS state.
2. Boot sequence restarts from State 0.
3. At State 2, `authStore.token === null` → State 2a path.
4. Operator sees `LoginForm`.

**This is intentional and required by the security model.** The token MUST NOT be written to `localStorage`, `sessionStorage`, `IndexedDB`, or any browser-persistent store. `HF-REG: page reload produces login form` is a required regression test.

### 11.2 Navigation Between Surfaces (React Router)

**Result:** No re-boot. AuthGate does not re-run. Prefetch does not re-run.

**What changes:**
- Zone B (`Outlet`) swaps to the new surface component.
- Zone A remains mounted and persists its state.
- System Status Bar remains mounted.
- Zone C persists its open/closed state.

**What does not change:**
- `authStore`
- `venueStore`
- TanStack Query cache
- WebSocket connection

**Surface components that have their own data requirements** (e.g., `ReplayInvestigation`) initiate their own queries on mount via `useQuery`. These are not part of the boot sequence.

### 11.3 Browser Back Button

React Router handles history navigation. No re-authentication occurs. No re-boot occurs. The previous surface component re-mounts from the router's component tree.

### 11.4 Token Expiry During Active Session

When the server returns 401 on any authenticated API call after boot:

1. The API client interceptor catches the 401.
2. Clears `authStore.token`.
3. Navigates to `/login` via React Router (client-side redirect, no page reload).
4. `AuthGate` sees `token === null`, renders `LoginForm`.
5. After successful re-login, React Router returns to the previous surface.

This is not a re-boot. ShellLayout does not unmount. Only Zone B swaps to render the login form within the routing context.

---

## 12. Timing Budget

These are target values for implementation tuning. They are not enforced timeouts (except the 8s prefetch timeout in State 3, which is a hard failure boundary).

| Transition | Target | Notes |
|---|---|---|
| State 0 → 1 (bundle load) | <2s | Fast connection (≥10 Mbps). Not controllable by app; minimize bundle size. |
| State 1 → 2 (provider mount) | <100ms | Pure JS execution time. No network. |
| State 2 → 3 (auth check, 2b path) | <500ms | `GET /operators/me` round-trip. |
| State 2a login form submit | <500ms | `POST /auth/login` round-trip. |
| State 3 → 4 (parallel prefetch) | <1.5s | Dominated by `/venues` and WS connect. |
| State 4 → first interaction | <300ms | Venue data already in cache; pure render time. |
| Total cold boot (no token) | <5s | State 0 → login → auth → prefetch → first interaction |
| Total warm boot (token valid) | <3s | State 0 → auth check → prefetch → first interaction |

**Bundle size target:** Vendor chunk <200KB gzipped, app chunk <100KB gzipped.

---

## 13. Testing Contracts

All tests in this section are required. A missing test is a contract violation.

### 13.1 E2E Tests

**BOOT-E2E-01: Cold boot, no token, full sequence**

```
Precondition: No token in memory (fresh browser context)
Steps:
  1. Navigate to app URL
  2. Assert: body background #1A1A2E visible (no white flash)
  3. Assert: BootstrapLoadingScreen visible (data-testid="bootstrap-loading-screen")
  4. Assert: LoginForm visible (data-testid="login-form")
  5. Submit valid credentials
  6. Assert: LoginForm unmounts
  7. Assert: BootstrapLoadingScreen visible during prefetch
  8. Assert: ShellLayout mounts (data-testid="shell-layout")
  9. Assert: VenueSelector skeleton visible (data-testid="venue-selector-skeleton")
  10. Assert: VenueSelector becomes interactive (data-testid="venue-selector-interactive")
  11. Assert: System Status Bar shows operator name and venue count
Expected: All assertions pass in sequence
```

**BOOT-E2E-02: Warm boot, valid token**

```
Precondition: Token in memory (Zustand hydrated in test context)
Steps:
  1. Navigate to app URL
  2. Assert: LoginForm does NOT render
  3. Assert: BootstrapLoadingScreen visible
  4. Assert: ShellLayout mounts
  5. Assert: VenueSelector becomes interactive
Expected: Login form never shown; boot completes to State 5
```

**BOOT-E2E-03: State transitions produce correct DOM order**

```
Steps:
  1. Mock slow /venues response (1200ms delay)
  2. Navigate to app URL, submit login
  3. Assert: BootstrapLoadingScreen visible at t=200ms (during prefetch)
  4. Assert: Zone skeletons NOT visible during prefetch (State 3)
  5. Assert: Skeletons appear after prefetch completes (State 4)
Expected: No skeleton zones visible during State 3
```

### 13.2 Unit Tests

**BOOT-UNIT-01: AuthGate — no token shows LoginForm**

```typescript
// render AuthGate with authStore.token = null
// assert: data-testid="login-form" present
// assert: data-testid="bootstrap-loading-screen" absent
```

**BOOT-UNIT-02: AuthGate — token present shows BootstrapLoadingScreen**

```typescript
// render AuthGate with authStore.token = 'mock-token'
// mock GET /operators/me with 500ms delay
// assert at t=0: data-testid="bootstrap-loading-screen" present
// assert at t=0: data-testid="login-form" absent
// assert at t=250ms: spinner visible on loading screen
```

**BOOT-UNIT-03: BootstrapErrorScreen — variant A renders retry button, no logout**

```typescript
// render BootstrapErrorScreen variant="cannot_reach_servers"
// assert: text "Cannot reach ClubHub servers" present
// assert: button "Retry" present
// assert: button "Sign in again" absent
// assert: button "Logout" absent
```

**BOOT-UNIT-04: BootstrapErrorScreen — variant B renders sign-in-again, clears token**

```typescript
// render BootstrapErrorScreen variant="session_expired"
// assert: text "Session expired" present
// assert: button "Sign in again" present
// click "Sign in again"
// assert: authStore.token === null
// assert: LoginForm renders
```

**BOOT-UNIT-05: BootstrapErrorScreen — variant C does not block shell**

```typescript
// simulate GET /venues 503 during prefetch
// assert: BootstrapErrorScreen full-screen does NOT render
// assert: ShellLayout present
// assert: Zone A empty state text "No venues available" present
// assert: Zone B retry link present
```

**BOOT-UNIT-06: VenueSelector non-interactive during skeleton state**

```typescript
// render VenueSelector with venueStore.status = 'loading'
// assert: root element has pointer-events: none (computed style)
// or assert: click handler does not fire
```

### 13.3 Regression Test

**HF-REG-01: Page reload produces login form (token not persisted)**

```
Steps:
  1. Boot to State 5 (fully operational)
  2. Simulate page reload (clear JS runtime state)
  3. Assert: authStore.token === null
  4. Assert: LoginForm renders (not BootstrapLoadingScreen)
  5. Assert: localStorage has no key containing 'token' or 'auth'
  6. Assert: sessionStorage has no key containing 'token' or 'auth'
Expected: Token is gone; login form is shown; no persistent storage contains token
```

---

## 14. Component Prop Interfaces (Reference)

```typescript
// BootstrapLoadingScreen
interface BootstrapLoadingScreenProps {
  showSpinner?: boolean;
  fadeOut?: boolean;
  'data-testid'?: string;
}

// LoginForm
interface LoginFormProps {
  onSuccess: (token: string, operator: OperatorProfile) => void;
  'data-testid'?: string;
}

// BootstrapErrorScreen
interface BootstrapErrorScreenProps {
  variant: 'cannot_reach_servers' | 'session_expired' | 'venue_data_unavailable';
  onRetry?: () => void;
  onSignInAgain?: () => void;
  'data-testid'?: string;
}

// SkeletonBlock
interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  'data-testid'?: string;
}

// ShellLayout
interface ShellLayoutProps {
  children: React.ReactNode;
  'data-testid'?: string;
}

// OperatorProfile (from GET /operators/me)
interface OperatorProfile {
  id: string;
  displayName: string;
  email: string;
  role: 'VIEWER' | 'OPERATOR' | 'CONTENT_MANAGER' | 'ADMIN';
  assignedVenueIds: string[];
}
```

---

## 15. Out of Scope

The following are explicitly excluded from this document:

- Surface-level loading states after first boot (each surface owns its own loading logic)
- Zone C panel content and its loading behavior
- WebSocket reconnection logic after boot completes (handled by `RealtimeProvider` independently)
- Offline mode or service worker caching
- Multi-tab behavior
- Session refresh / silent token renewal
- Onboarding flows for first-time operators
- Role-based surface visibility (enforced by router guards, not boot sequence)
- Deep-link handling (React Router handles URL parsing; boot sequence is the same)

---

## 16. Invariants

The following are constitutional constraints on the boot implementation. They may not be relaxed without an ADR.

| ID | Invariant |
|---|---|
| BI-01 | Token MUST NOT be written to any browser-persistent storage (localStorage, sessionStorage, IndexedDB, cookies with persistent expiry). |
| BI-02 | Zone skeletons MUST NOT render during State 3 (prefetch). ShellLayout mounts only after prefetch completes. |
| BI-03 | `GET /system/health` failure MUST block full boot. The shell MUST NOT mount if health check fails. |
| BI-04 | The first-actionable-interaction gate MUST NOT open until `venueStore.status === 'ready'`. |
| BI-05 | BootstrapLoadingScreen MUST be the first React component rendered (State 1), not a skeleton of ShellLayout. |
| BI-06 | `GET /operators/me` 401 MUST clear the token and show variant B error. It MUST NOT silently retry. |
| BI-07 | Navigation between surfaces MUST NOT re-trigger the boot sequence. AuthGate MUST NOT re-run on route change. |
| BI-08 | Skeleton blocks MUST NOT animate (no shimmer). Static gray rectangles only. |

---

*Document class: Runtime specification. This file defines observable behavior. Deviations from it are bugs, not design decisions.*
