# IMPLEMENTATION-VERTICAL-SLICE-PLAN-v1

**Document class:** Engineering build-order specification
**Status:** AUTHORITATIVE
**Audience:** Frontend engineering team
**Date:** 2026-06-03
**Surfaces covered:** Live Operations, Incident Command, Replay Investigation, CMS Content Operations, Venue Operations

---

## 1. Vertical Slice Philosophy

### Core principle

Build the narrowest possible path through the full stack first. Each slice is a vertical cut from auth → API → state → UI that a real operator can use. No slice is internal scaffolding only. No surface is built horizontally before the primary vertical slice is complete.

### Why this matters for this platform

The ClubHub operator platform has no low-stakes demo path. The primary user is an operator managing live venue hardware during an active incident. A horizontal build (all surfaces stubbed, then incrementally filled) produces a system that looks complete but cannot be handed to an operator for real feedback. A vertical build produces a system that is narrow but real — each slice is demonstrable to an operator in a venue, not just to a developer running localhost.

### Build order rules

1. Each slice depends on all prior slices being complete and passing acceptance criteria.
2. Within a slice, steps are sequential. Step N+1 must not be started before step N passes its acceptance check.
3. Features not listed in Slices 0–9 are deferred. There are no implicit deferrals. The deferred list in Section 12 is exhaustive for v1.
4. Every slice acceptance criterion is written as an operator-facing observable outcome, not a developer-facing test assertion.

### Constraint inheritance

All behavioral constraints from the constitutional documents apply at all times. They are not re-litigated per slice. The following are load-bearing throughout all slices:

- **IC-03:** No write controls rendered in REPLAY mode. DOM absent, not disabled.
- **Absent-not-disabled:** Controls for unauthorized roles are absent from the DOM. `display:none` is not compliant.
- **Zone B auto-replace:** Severity 1 or 2 incident fires IC surface for OPERATOR and above. This preempts whatever surface was active.
- **RECOVERED_BUT_UNTRUSTED:** Override placement blocked. PATCH-009 pill rendered. PATCH-007 Zone A dot rendered.
- **72h delivery lead time:** ROUTINE slots cannot be submitted with delivery window under 72h. UI enforces this before API call.
- **COMMANDER_LAPSED:** 15-minute claim window. After expiry, `COMMANDER_LAPSED` event emitted. Renders Level 1 alert.
- **All 4 rejection types produce visible UI response:** CONCURRENCY_CONFLICT (409), AUTHORITY_BOUNDARY (403), PRE_CONSTRAINT (422), REPLAY_MODE (403 in replay context).

---

## 2. Slice 0: Foundation

**Type:** Prerequisite infrastructure — not independently demonstrable to an operator
**Precondition:** None
**Gate:** `npm run dev` renders a shell with a static venue list. Passes type-check. No real API calls required.

### Purpose

Slice 0 installs the structural substrate that all subsequent slices depend on. It produces no operator-visible feature. It must be treated as a hard prerequisite, not a parallel track.

### Build steps (sequential)

**Step 0.1 — `@clubhub/types` package**

Create the shared TypeScript interface package. All other packages depend on this first.

Required interfaces at slice 0 (minimum set; types are extended as slices add endpoints):

```typescript
// Auth
interface OperatorSession {
  operator_id: string;
  role: 'VIEWER' | 'OPERATOR' | 'CONTENT_MANAGER' | 'ADMIN';
  token: string;
  expires_at: string;
}

// Venues
interface Venue {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  trust_state: TrustState;
}

type MachineState = 'LIVE' | 'DEGRADED' | 'OFFLINE' | 'RECOVERING' | 'RECOVERED_BUT_UNTRUSTED';
type TrustState = 'TRUSTED' | 'UNTRUSTED' | 'UNVERIFIED';

// Incidents
interface Incident {
  incident_id: string;
  severity: 1 | 2 | 3 | 4 | 5 | 6;
  state: IncidentState;
  commander: OperatorRef | null;
  created_at: string;
  lapsed: boolean;
}

type IncidentState = 'OPEN' | 'ESCALATED' | 'RESOLVING' | 'CLOSED';

// System
interface SystemHealth {
  constitutional_state: ConstitutionalState;
  timestamp: string;
}

type ConstitutionalState = 'NOMINAL' | 'DEGRADED' | 'EMERGENCY' | 'MAINTENANCE';

// WebSocket envelope
interface WSMessage<T = unknown> {
  event: string;
  payload: T;
  timestamp: string;
}
```

Package exports `@clubhub/types`. No runtime code — types only.

**Step 0.2 — `@clubhub/api` package**

Base fetch wrapper and WebSocket client skeleton.

Requirements:
- `createApiClient(baseUrl, getToken)` — returns typed fetch wrapper with auth header injection
- All API errors map to typed `ApiError` with `code`, `message`, `rejection_type` fields
- `rejection_type` values: `'CONCURRENCY_CONFLICT' | 'AUTHORITY_BOUNDARY' | 'PRE_CONSTRAINT' | 'REPLAY_MODE' | null`
- WebSocket client class: `connect(url)`, `subscribe(event, handler)`, `unsubscribe(event, handler)`, `disconnect()`
- WebSocket reconnect with exponential backoff (max 30s)
- No live endpoints called at this step — skeleton only

**Step 0.3 — `@clubhub/state` package**

Zustand store scaffolding and React Query configuration.

Requirements:
- Zustand store slices (empty at this step, typed): `authSlice`, `venueSlice`, `incidentSlice`, `overlaySlice`, `replaySlice`
- React Query `QueryClient` with default config:
  - `staleTime: 30_000` (30s)
  - `retry: 1`
  - Error boundary integration
- `useAuthStore()` hook exported
- `useVenueStore()` hook exported
- `useIncidentStore()` hook exported

**Step 0.4 — `@clubhub/hooks` package**

Hook stubs — implementations filled per slice:
- `useCurrentOperator()` — returns null until slice 1
- `useVenues()` — returns empty array until slice 1
- `useActiveIncidents()` — returns empty array until slice 2
- `useWebSocket()` — returns connection object (not yet connected)

**Step 0.5 — `@clubhub/ui` package**

UI primitive components:
- `Button` — variants: `primary`, `secondary`, `destructive`, `ghost`
- `Badge` — variants: `severity-1` through `severity-6`, `machine-state`, `trust-state`
- `Toast` — variants: `info`, `warning`, `error`, `error-extended` (10s auto-dismiss)
- `Modal` — with `onConfirm`, `onDismiss`, `isDestructive` props
- `Spinner` — loading state
- `Tabs` — `TabList`, `TabPanel`, `Tab` with active state
- `StatusDot` — colored dot with label
- `Pill` — small label chip

All components typed. No business logic. Storybook or similar visual test runner configured.

**Step 0.6 — Auth flow**

Login page at `/login`:
- Email + password form
- `POST /auth/login` → receives `OperatorSession`
- Token stored in `localStorage` (key: `clubhub_token`)
- Role decoded from JWT claims and stored in `authSlice`
- Redirect to `/ops` on success
- Invalid credentials: inline error message

Route guard HOC `withRoleGuard(minRole)`:
- Reads role from `authSlice`
- Redirects to `/login` if no token
- Renders `null` (absent, not visible) if role insufficient

**Step 0.7 — ShellLayout component**

Four-zone shell with empty content areas:

```
┌─────────────────────────────────────────────────────────────┐
│  System Status Bar (40px)                                   │
├──────────────────┬──────────────────────────────────────────┤
│  Zone A (280px)  │  Zone B (flex)          │ Zone C (320px) │
│                  │                         │                │
│  VenueSelector   │  [surface content]      │  [right panel] │
│  IncidentList    │                         │                │
│  NotificationTray│                         │                │
│  OperatorTools   │                         │                │
└──────────────────┴─────────────────────────┴────────────────┘
```

Requirements:
- Shell renders at all routes under `/ops`
- Zone A, B, C are container divs with correct flex layout
- Status Bar: static grey bar with placeholder text
- Zone A: renders `<VenueSelector />` placeholder (static text "Venues" — no data)
- Zone A: renders `<IncidentList />` placeholder (empty)
- Zone A: renders `<NotificationTray />` placeholder (empty)
- Zone B: renders active surface via `<Outlet />` (React Router)
- Zone C: empty container

**Step 0.8 — Route structure**

```
/login                          → LoginPage (no shell)
/ops                            → ShellLayout
  /ops/live                     → LiveOpsSurface (OPERATOR+)
  /ops/incidents/:id            → IncidentCommandSurface (OPERATOR+)
  /ops/replay/:session_id       → ReplayInvestigationSurface (OPERATOR+)
  /ops/cms                      → CMSContentOpsSurface (CONTENT_MANAGER+)
  /ops/venues/:venue_id         → VenueOpsSurface (OPERATOR+)
```

Route guards applied per role minimum. VIEWER redirected to read-only live ops variant (not implemented until slice 1 — redirect to `/ops/live` for now).

**Step 0.9 — CI pipeline**

Configure and pass:
- `npm run lint` — ESLint with `@typescript-eslint/recommended`
- `npm run type-check` — `tsc --noEmit` across all packages
- `npm run test` — unit tests for `@clubhub/types` (interface shape tests) and `@clubhub/ui` (render tests)
- All must pass in CI before any slice 1 work begins

### Slice 0 acceptance criterion

`npm run dev` at `http://localhost:3000`:
- `/login` renders login form
- Login with any credential → redirects to `/ops/live`
- Shell renders with four zones visible
- Zone A shows static text "Venues" and empty incident/notification areas
- Zone B shows empty surface area
- `npm run type-check` exits 0
- `npm run lint` exits 0
- `npm run test` exits 0

---

## 3. Slice 1: Venue Health View

**Type:** First demonstrable slice
**Precondition:** Slice 0 complete and passing
**Gate:** Operator sees live venue health. Zone A dot updates when venue state changes. No write actions.

### Purpose

The smallest operator-visible workflow: log in, see real venue list, select a venue, see current machine state and player health. This is the baseline — every subsequent slice adds to this foundation.

### Build steps (sequential)

**Step 1.1 — `GET /operators/me`**

Wire `useCurrentOperator()` hook:
- Query `GET /operators/me` on mount
- Populate `authSlice` with `operator_id`, `role`, `display_name`
- If 401 response, clear token and redirect to `/login`
- System Status Bar: replace placeholder with operator `display_name` and role badge

**Step 1.2 — `GET /venues`**

Wire `useVenues()` hook:
- Query `GET /venues` — returns `Venue[]` with `machine_state`
- Populate `venueSlice.venues`
- Loading state: Zone A shows spinner
- Error state: Zone A shows "Venues unavailable" with retry button

**Step 1.3 — Zone A VenueSelector: real data**

Replace static placeholder with real venue list:
- Each venue renders as a row: `<StatusDot />` (color-correct per `machine_state`) + venue name
- Machine state color mapping (load-bearing):
  - `LIVE` → `#22C55E` (green)
  - `DEGRADED` → `#FB923C` (amber)
  - `OFFLINE` → `#EF4444` (red)
  - `RECOVERING` → `#60A5FA` (blue, pulsing)
  - `RECOVERED_BUT_UNTRUSTED` → `#FB923C` with `↻` prefix glyph (PATCH-007)
- Selected venue highlighted with active state
- Click selects venue → stores `selectedVenueId` in `venueSlice`

**Step 1.4 — `GET /venues/{venue_id}/detail`**

Wire `useVenueDetail(venueId)` hook:
- Query `GET /venues/{venue_id}/detail` when `selectedVenueId` changes
- Returns: `machine_state`, `trust_state`, `autonomy_expires_at`, `player_health`, `signal_quality`
- Populate `venueSlice.selectedVenueDetail`

**Step 1.5 — Zone B: Live Ops surface, Section 1**

Route `/ops/live` renders `<LiveOpsSurface />`.

Section 1 — Venue Identity + machine state badge:
- Venue name (H1)
- `<MachineStateBadge machine_state={...} />` component — color-matched pill
- `trust_state` secondary badge
- Last updated timestamp

`MachineStateBadge` component added to `@clubhub/ui`. Color values as per step 1.3 mapping.

**Step 1.6 — Zone B: Section 2 — Player Health cards**

Player Health section (PATCH-019 section label: "PLAYER HEALTH"):

4 status cards:
- Player Process: `player_health.process_state`
- Corpus Integrity: `player_health.corpus_hash_valid` (✓ VERIFIED / ✗ UNVERIFIED)
- Last Heartbeat: `player_health.last_heartbeat_at` (relative time)
- Autonomy Clock: `player_health.autonomy_expires_at` (countdown — static for now, live in slice 5)

Signal Quality section (PATCH-019 section label: "SIGNAL QUALITY"):

3 signal quality cards:
- Network: `signal_quality.network_state`
- Content Sync: `signal_quality.content_sync_state`
- Time Sync: `signal_quality.time_sync_state`

Each card: label, value, status dot. No write actions.

**Step 1.7 — WebSocket connect → `VENUE_STATE_UPDATE`**

Wire `useWebSocket()` hook to establish connection on shell mount:
- Connect to `ws://{host}/ws` with auth token
- Subscribe to `VENUE_STATE_UPDATE` event
- Handler: update `venueSlice.venues[venue_id].machine_state` → Zone A dot re-renders reactively
- Subscribe to `VENUE_DETAIL_UPDATE` event
- Handler: update `venueSlice.selectedVenueDetail` if event matches `selectedVenueId`
- Connection state indicator: Zone C placeholder shows `WS: CONNECTED` / `WS: RECONNECTING`

**Step 1.8 — System Status Bar: real data**

Replace remaining placeholder content:
- Query `GET /system/health`
- Render `constitutional_state` badge:
  - `NOMINAL` → green
  - `DEGRADED` → amber
  - `EMERGENCY` → red
  - `MAINTENANCE` → blue
- Operator display name + role badge (from step 1.1)
- Poll `GET /system/health` every 60s

### Slice 1 acceptance criterion

An operator can:
1. Navigate to `http://localhost:3000/login`
2. Log in with real credentials
3. See their name and role in the System Status Bar
4. See a real list of venues in Zone A with color-coded state dots
5. Click a venue and see venue name, machine state badge, player health cards, and signal quality cards in Zone B
6. Observe: when a venue's `machine_state` changes in the backend, the Zone A dot color updates within 2 seconds without a page refresh
7. See the `constitutional_state` in the System Status Bar

No write actions are possible at this slice. No incident features are visible.

---

## 4. Slice 2: Incident Awareness

**Type:** Read-only incident monitoring
**Precondition:** Slice 1 complete and passing
**Gate:** Operator can monitor all active incidents. No write actions. COMMANDER_LAPSED alert visible.

### Purpose

Operator can see active incidents in Zone A, navigate to Incident Command surface, and read incident details without taking any action. This slice completes the observation layer before any write capability is added.

### Build steps (sequential)

**Step 2.1 — `GET /incidents/active`**

Wire `useActiveIncidents()` hook:
- Query `GET /incidents/active` on shell mount
- Populate `incidentSlice.activeIncidents`
- Zone A IncidentList: render each incident as a row
- Each row: severity badge (PATCH-004 severity colors) + short description + state pill + duration
- PATCH-004 severity colors:
  - Severity 1: `#DC2626` (deep red — S1 is the highest risk level)
  - Severity 2: `#EF4444` (red)
  - Severity 3: `#FB923C` (amber-orange)
  - Severity 4: `#FBBF24` (amber)
  - Severity 5: `#A3A3A3` (grey)
  - Severity 6: `#7C3AED` (purple — L6 override incidents)
- Sort: S1 first, then by `created_at` descending

**Step 2.2 — Zone A incident badge colors**

Apply PATCH-004 colors to Zone A incident list rows.

Additionally: Zone A section header "INCIDENTS" renders a count badge. Count badge turns red if any S1/S2 active.

**Step 2.3 — WebSocket: incident events → Zone A updates**

Subscribe to:
- `INCIDENT_CREATED` → add to `incidentSlice.activeIncidents`, Zone A re-renders
- `INCIDENT_UPDATE` → update matching incident in store, Zone A re-renders
- `INCIDENT_CLOSED` → remove from `activeIncidents`, move to `closedIncidents`

Zone A incident list updates without page refresh.

**Step 2.4 — Route `/ops/incidents/:id` — IC surface shell**

`<IncidentCommandSurface />` shell:
- Zone B replaced by IC surface content when route active
- IC surface receives `incident_id` from route params
- Query `GET /incidents/{id}` on mount
- Loading state: spinner in Zone B
- 404 state: "Incident not found" with back link

**Step 2.5 — Incident Identity Bar**

Persistent 72px bar at top of IC surface (non-scrolling):

```
[SEV-2] [OPEN] | Venue Name: Incident short description | Duration: 00:14:22 | Commander: Jane O. [ACTIVE]
```

Components:
- `SeverityBadge` (PATCH-004 colors)
- `IncidentStatePill` — `OPEN` / `ESCALATED` / `RESOLVING` / `CLOSED`
- Venue name and incident description text
- Duration clock: live counter from `created_at` (updates every second)
- Commander identity: display name + `[ACTIVE]` pill, or `[NONE]` if no commander

**Step 2.6 — IC Tab 1: Incident Overview (read-only)**

Tab 1 label: "Overview"

Renders:
- Incident full description
- Affected venues list
- Timeline of state transitions (most recent first)
- Reported symptoms (if present)
- `created_at` and `created_by`
- Current `constitutional_state` at incident creation

No write controls on this tab.

**Step 2.7 — IC Tab 5: Available Transitions (display only)**

Tab 5 label: "Transitions"

Renders:
- List of available state transitions for this incident's current state
- Each transition shown as: `[Transition Name]` → `[Target State]` + description
- No action buttons yet — display only
- If no transitions available: "No transitions available in current state"

**Step 2.8 — COMMANDER_LAPSED detection**

Subscribe to `COMMANDER_LAPSED` WebSocket event:

On receipt:
- Update `incidentSlice.activeIncidents[id].lapsed = true`
- In IC surface: render Level 1 alert banner (full-width, `#EF4444` background)
- Alert text: "COMMANDER LAPSED — No active commander for [duration]. Claim command to restore authority."
- `lapsed_duration` renders as a live counter (updated every second from event timestamp)
- Zone A incident row: add `[LAPSED]` badge in red
- Alert persists until `COMMANDER_CLAIMED` event received

**Step 2.9 — PATCH-012: presence count**

In Incident Identity Bar:
- Render presence count: "👁 3 operators viewing"
- Source: `GET /incidents/{id}/presence` polled every 30s (WebSocket presence events wired in slice 3)
- `[Notify all →]` button rendered in Identity Bar
- Button is visible but non-functional at this slice (tooltip: "Notification requires command — available after claiming command")
- Button absent for VIEWER role

### Slice 2 acceptance criterion

An operator can:
1. See all active incidents in Zone A with correct severity badge colors
2. See Zone A incident count badge turn red when S1/S2 incidents are active
3. Click an incident → navigate to IC surface
4. Read the 72px Incident Identity Bar with live duration clock
5. Read Tab 1 (Overview) with incident details — no write controls present
6. View Tab 5 (Transitions) showing available transitions — display only
7. Observe Zone A updating when a new incident is created (no page refresh)
8. See COMMANDER_LAPSED alert banner with live lapsed duration counter when a `COMMANDER_LAPSED` event fires
9. No write actions are possible at any point in this flow

---

## 5. Slice 3: First Write Action — Commander Claim

**Type:** First real write operation
**Precondition:** Slice 2 complete and passing
**Gate:** Two operators can both see an incident. One claims command. The other sees the update within 2 seconds. Simultaneous claim produces exactly one success and one rejection toast.

### Purpose

This slice introduces the first mutation. It tests the full write path: button → confirmation → API call → rejection handling → WebSocket propagation → remote session update. All four rejection type handlers must be wired before any write action ships, even if not all four can fire on this specific action.

### Build steps (sequential)

**Step 3.1 — [Assume Command] button — role guard**

In IC Incident Identity Bar, render `[Assume Command]` button:
- Rendered for `OPERATOR`, `CONTENT_MANAGER`, `ADMIN` roles
- Absent from DOM for `VIEWER` role (not `display:none` — absent)
- Button disabled (not absent) when incident already has an active commander
- Button text changes: "Assume Command" (no commander) / "Take Over Command" (lapsed commander)

**Step 3.2 — AssumeCommandConfirmCard**

On `[Assume Command]` click, render `AssumeCommandConfirmCard` modal:
- PATCH-003 context strip: renders current incident state + last known commander + lapsed duration
- Confirm button: `[Assume Command]`
- Cancel button: `[Cancel]`
- Context strip is read-only
- Modal does not submit on Escape — requires explicit confirm or cancel

**Step 3.3 — `POST /incidents/{id}/commander/claim` — happy path**

On confirm:
- Call `POST /incidents/{id}/commander/claim`
- Success (200): close modal, update `incidentSlice`, Incident Identity Bar updates commander display, `[Assume Command]` button becomes `[Release Command]`
- Optimistic update: do not apply — wait for API response before updating UI

**Step 3.4 — 409 CONCURRENCY_CONFLICT rejection**

On 409 response from `/commander/claim`:
- Show `Toast` variant `error`: "Command already claimed by [name]. Your view has been updated."
- Toast auto-dismisses at 5s
- Force-push fresh incident state via `GET /incidents/{id}` re-query
- Re-render Incident Identity Bar with winning commander

**Step 3.5 — `COMMANDER_CLAIMED` WebSocket event → all sessions**

Subscribe to `COMMANDER_CLAIMED` event:
- Handler: update `incidentSlice.activeIncidents[id].commander` with new commander
- Incident Identity Bar re-renders in all active sessions for this incident
- Zone A incident row: update commander badge
- If current operator is the commander: render `[Release Command]` button

**Step 3.6 — Commander release**

`[Release Command]` button:
- Rendered only for the current operator who holds command
- Click opens confirmation modal: "Release command of this incident? Another operator must claim to restore authority."
- Confirm: `DELETE /incidents/{id}/commander`
- Success: `incidentSlice` updated, Identity Bar shows `[NONE]`
- No error handling needed beyond generic error toast (release cannot 409)

**Step 3.7 — `COMMANDER_RELEASED` WebSocket event → all sessions**

Subscribe to `COMMANDER_RELEASED` event:
- Handler: update `incidentSlice.activeIncidents[id].commander = null`
- Incident Identity Bar re-renders for all active sessions
- `[Assume Command]` button re-appears for OPERATOR+ roles

**Step 3.8 — PATCH-012 [Notify all →] wired**

Wire `[Notify all →]` button (rendered in step 2.9):
- Available only when current operator holds command
- Click: `POST /incidents/{id}/commander/notify`
- Success: 60s cooldown UI on button (disabled + countdown label "Notify again in 0:45")
- 60s countdown uses local timer — does not require server round-trip for each tick
- After 60s: button re-enables

### Slice 3 acceptance criterion

With two browser sessions open on the same incident:
1. Session A clicks `[Assume Command]` → `AssumeCommandConfirmCard` appears with PATCH-003 context strip
2. Session A confirms → command claimed, Identity Bar updates in both sessions within 2 seconds
3. Session B's `[Assume Command]` button is now disabled
4. Both sessions simultaneously click `[Assume Command]` on a fresh incident: exactly one succeeds, the other receives a CONCURRENCY_CONFLICT toast with updated commander name
5. Commander clicks `[Release Command]` → both sessions update within 2 seconds
6. Commander clicks `[Notify all →]` → button enters 60s cooldown
7. VIEWER session: no `[Assume Command]` or `[Release Command]` button in DOM

---

## 6. Slice 4: Override Placement and Removal

**Type:** Full L6 override lifecycle
**Precondition:** Slice 3 complete and passing
**Gate:** Full L6 lifecycle works. Concurrent placement handled. Removal requires 3-second hold. All 3 applicable rejection types produce correct UI.

### Purpose

Override placement is the highest-authority write action in the platform. It requires the most defensive UI: a 3-step selection flow, a 3-second hold-to-confirm removal, and explicit handling for concurrent placement, authority boundaries, and PRE constraints. This slice must be complete before Venue Ops or CMS work begins.

### Build steps (sequential)

**Step 4.1 — IC Tab 3: Override Inventory (read-only)**

Tab 3 label: "Overrides"

Renders:
- List of active overrides for this incident
- Each override: override type, placement timestamp, placed_by, affected venues/screens
- Empty state: "No active overrides"
- No write controls yet

**Step 4.2 — PATCH-010: Tab 3 red dot badge**

Subscribe to `OVERRIDE_PLACED` event:
- When event fires: Tab 3 tab label gains a red dot badge
- Badge clears when operator navigates to Tab 3
- Mechanism: `unread` flag in local component state, cleared on tab focus

**Step 4.3 — SequentialChipSelect component**

Add `SequentialChipSelect` to `@clubhub/ui`.

Component behavior:
- 3-step sequential chip selection (PATCH-001)
- Step 1: select override type (chips rendered from available types)
- Step 2: select target scope (venue / screen / fleet)
- Step 3: select confirmation (review summary)
- Each step only unlocks after prior step selection is complete
- Chip selections in prior steps can be changed (resets subsequent steps)
- "Back" navigation between steps
- Props: `steps: ChipStep[]`, `onComplete(selections)`, `onCancel()`

**Step 4.4 — L6OverridePlacementFlow**

In IC Tab 3, render `[Place L6 Override]` button for ADMIN role (absent for others).

On click:
- Render `L6OverridePlacementFlow` modal
- Wraps `SequentialChipSelect` with L6-specific step definitions
- On `SequentialChipSelect` completion: call `POST /incidents/{id}/overrides/l6` with selections
- Success: close modal, Tab 3 re-queries, `OVERRIDE_PLACED` event will follow from server

**Step 4.5 — 409 conflict rejection for simultaneous placement**

On 409 from `/overrides/l6`:
- Toast `error`: "Override placement conflict — another operator placed a conflicting override. Review the current override inventory."
- Close placement modal
- Trigger re-query of Tab 3 override list

**Step 4.6 — HoldToConfirmButton component**

Add `HoldToConfirmButton` to `@clubhub/ui`.

Component behavior (PATCH-002):
- Mouse/touch down begins 3-second fill animation
- Release before 3s: animation resets, no action
- Hold for 3s: `onConfirm()` callback fires
- Visual: circular progress fill on button face
- Label during hold: "Hold to confirm removal..."
- Label at completion: "Removing..."
- Props: `label`, `holdDuration: number`, `onConfirm`, `variant: 'destructive'`

**Step 4.7 — L6OverrideRemovalFlow**

In Tab 3 override list, each override row renders `[Remove]` for ADMIN role (absent for others).

On click:
- Render removal confirmation panel (inline in Tab 3, not modal)
- Panel: override summary + `HoldToConfirmButton` (3s hold)
- On hold complete: call `DELETE /incidents/{id}/overrides/{override_id}`
- Success: panel closes, override removed from list

**Step 4.8 — WebSocket events → Tab 3 update + entity highlight pulse**

Subscribe to `OVERRIDE_PLACED` and `OVERRIDE_REMOVED` events:
- `OVERRIDE_PLACED`: add to Tab 3 override list; affected override row renders with pulse animation (200ms `#7C3AED` border flash, PATCH-002)
- `OVERRIDE_REMOVED`: remove from Tab 3 override list; row exit animation (fade out 150ms)
- Both events: PATCH-010 red dot on Tab 3 label if Tab 3 not currently active

**Step 4.9 — AUTHORITY_BOUNDARY rejection (403)**

When any write call returns 403 with `rejection_type: 'AUTHORITY_BOUNDARY'`:
- Render `Modal` with title "Authority Boundary"
- Body: server-provided `message` explaining the constraint
- Single action: `[Understood]` button (closes modal)
- No retry action in modal

Wire to: override placement, override removal.

**Step 4.10 — PRE_CONSTRAINT rejection (422)**

When any write call returns 422 with `rejection_type: 'PRE_CONSTRAINT'`:
- Render `Toast` variant `error`: server-provided `message` + inline link "View PRE context →"
- "View PRE context →" link opens Zone C panel with PRE constraint detail (Zone C content: pre-formatted JSON from API response `pre_context` field)
- Toast auto-dismisses at 8s

Wire to: override placement.

### Slice 4 acceptance criterion

An ADMIN operator can:
1. Navigate to IC Tab 3 and see current override inventory (or empty state)
2. Click `[Place L6 Override]` → SequentialChipSelect 3-step flow renders
3. Complete 3-step flow → override placed, Tab 3 updates
4. In a second session: Tab 3 red dot badge appears when override placed without Tab 3 active
5. Two simultaneous L6 placements: exactly one succeeds; the other sees a CONCURRENCY_CONFLICT toast
6. Click `[Remove]` on an override → HoldToConfirmButton appears
7. Hold for 3 full seconds → override removed
8. Release before 3 seconds → no removal, no toast
9. An OPERATOR (non-ADMIN) sees no `[Place L6 Override]` or `[Remove]` buttons in DOM
10. 403 AUTHORITY_BOUNDARY → modal with `[Understood]`
11. 422 PRE_CONSTRAINT → 8s toast with "View PRE context →" link that opens Zone C

---

## 7. Slice 5: Venue Operations Surface

**Type:** Hardware management surface
**Precondition:** Slice 4 complete and passing
**Gate:** Operator can see full venue hardware state. RECOVERED_BUT_UNTRUSTED renders correctly. Autonomy clock counts down in real-time.

### Purpose

The Venue Operations surface provides detailed hardware management for a specific venue. It extends the health data from Slice 1 with historical state, corpus verification, screen management, and the RECOVERED_BUT_UNTRUSTED trust recovery workflow.

### Build steps (sequential)

**Step 5.1 — Route `/ops/venues/:venue_id` — Venue Ops shell**

`<VenueOpsSurface />` mounted at route.

Query `GET /venues/{venue_id}/detail` on mount (same hook as slice 1).

Tab structure (6 tabs, not all built in this slice):
- Tab 1: Status Dashboard
- Tab 2: Screen Management
- Tab 3: Corpus Status
- Tab 4: Configuration (ADMIN — Slice 9)
- Tab 5: Machine State History
- Tab 6: (reserved)

**Step 5.2 — Persistent Venue Identity Header**

72px non-scrolling header at top of Venue Ops surface:
- Venue name
- `<MachineStateBadge />` (reused from Slice 1)
- `trust_state` badge
- Last heartbeat timestamp (live relative time)

Header does not scroll with tab content.

**Step 5.3 — Tab 1: Status Dashboard**

4 player status cards (PATCH-019 section label: "PLAYER STATUS"):
- Player Process state
- Corpus Hash: verified / unverified
- Last Heartbeat: relative timestamp
- Active Content: current playing item or "None"

3 signal quality cards (PATCH-019 section label: "SIGNAL QUALITY"):
- Network: state + latency
- Content Sync: last sync timestamp
- Time Sync: drift in ms

Each card shows a colored status dot. No write actions on Tab 1.

**Step 5.4 — Tab 5: Machine State History**

Query `GET /venues/{venue_id}/machine-state-history`:
- Render state transitions in reverse chronological order
- Each row: `[state pill]` → `[state pill]` | `timestamp` | `duration in prior state` (PATCH-020)
- Duration computed client-side: `next_event.timestamp - current_event.timestamp`
- Most recent entry: duration shows as running counter since that transition
- Empty state: "No state history available"

**Step 5.5 — RECOVERED_BUT_UNTRUSTED rendering**

When `machine_state === 'RECOVERED_BUT_UNTRUSTED'`:

PATCH-009 — in Venue Identity Header:
- Replace `<MachineStateBadge />` with `LIVE—UNVERIFIED` pill in amber (`#FB923C`)
- Tooltip: "This venue is live but corpus integrity has not been verified since recovery"

PATCH-007 — in Zone A VenueSelector:
- Venue dot: `#FB923C` with `↻` glyph prefix
- Distinct from DEGRADED (`#FB923C` solid without glyph)

Override blocking:
- Any attempt to place an override on a `RECOVERED_BUT_UNTRUSTED` venue returns 422
- PRE_CONSTRAINT rejection handler (from Step 4.10) fires with message explaining trust state

**Step 5.6 — Autonomy clock: live countdown**

Wire autonomy clock in Tab 1 (built statically in Slice 1) to live countdown:

Source: `autonomy_expires_at` from venue detail response.

PATCH-011 color tiers:
- More than 48h remaining: `#22C55E` (green)
- 24–48h remaining: `#FBBF24` (amber)
- 8–24h remaining: `#FB923C` (amber-orange)
- Under 8h remaining: `#EF4444` (red, pulsing)
- Expired: `#DC2626` (deep red) + "AUTONOMY EXPIRED" label

Countdown updates every second using `setInterval`. Cleans up on unmount.

Also wire Venue Ops Tab 1 autonomy clock with same tiers.

**Step 5.7 — Tab 3: Corpus Status**

Query `GET /venues/{venue_id}/corpus-status`:
- Current corpus hash
- Verification state: `VERIFIED` / `UNVERIFIED` / `VERIFYING`
- Last verified timestamp
- Hash history (last 5 verifications)

`[Verify Now]` button for OPERATOR+:
- Call `POST /venues/{venue_id}/corpus-status/verify`
- Button enters loading state ("Verifying...") while in progress
- Success: re-query corpus status, PATCH-010 no dot needed here (success feedback via card update)
- 409: "Verification already in progress" toast

**Step 5.8 — Tab 2: Screen Management**

Query `GET /venues/{venue_id}/screens`:
- List of screens with: `screen_id`, `name`, `state`, `last_heartbeat`
- For OPERATOR: read-only list
- For ADMIN: add `[Enroll Screen]` and `[Decommission]` buttons
  - `[Enroll Screen]` → modal with screen name + MAC address form → `POST /venues/{venue_id}/screens`
  - `[Decommission]` → hold-to-confirm (3s, reuses `HoldToConfirmButton`) → `DELETE /venues/{venue_id}/screens/{screen_id}`
- VIEWER: list renders but all write controls absent from DOM

### Slice 5 acceptance criterion

An operator can:
1. Navigate to `/ops/venues/:venue_id`
2. See persistent non-scrolling identity header with machine state badge
3. Tab 1: see 4 player status cards and 3 signal quality cards with PATCH-019 section labels
4. Tab 5: see machine state history with computed durations; most recent duration is a live counter
5. Autonomy clock in Tab 1 counts down with color tier changes at correct thresholds
6. When venue is `RECOVERED_BUT_UNTRUSTED`: Venue Identity Header shows `LIVE—UNVERIFIED` amber pill; Zone A dot shows `#FB923C ↻` glyph
7. Tab 3: corpus status renders with `[Verify Now]` button; button enters loading state during verification
8. Tab 2 (ADMIN): `[Enroll Screen]` and `[Decommission]` buttons present; hold-to-confirm required for decommission
9. Tab 2 (OPERATOR): read-only list, no write controls in DOM

---

## 8. Slice 6: CMS Content Operations

**Type:** Content scheduling surface
**Precondition:** Slice 5 complete and passing
**Gate:** Content Manager can schedule content. All three 72h banner variants render correctly. Training mode prevents live corpus mutations.

### Purpose

The CMS surface is the primary workflow for the CONTENT_MANAGER role. It must enforce the 72h delivery constraint visually and at the form level, render three distinct delivery priority banner variants, and provide a training mode that blocks live corpus mutations.

### Build steps (sequential)

**Step 6.1 — Route `/ops/cms` — CMS shell**

`<CMSContentOpsSurface />` mounted at route. Access: CONTENT_MANAGER+.

Tab structure:
- Tab 1: Content Library
- Tab 2: Content Calendar
- Tab 3: Upload / Ingest
- Tab 4: Delivery Status
- Tab 5: Delivery Confidence

**Step 6.2 — Tab 1: Content Library**

Query `GET /cms/content`:
- List with: title, content_type, duration, status (`DRAFT` / `APPROVED` / `SCHEDULED` / `LIVE` / `ARCHIVED`)
- Status badge colors:
  - DRAFT: grey
  - APPROVED: blue
  - SCHEDULED: amber
  - LIVE: green
  - ARCHIVED: grey (muted)
- Click row → opens content detail panel in Zone C (read-only at this slice)
- Search/filter deferred (see Section 12)

**Step 6.3 — Tab 2: Content Calendar**

Query `GET /cms/calendar/slots`:
- Slot grid: time axis (x) × venue/screen axis (y)
- Each slot renders: content title, delivery_priority badge
- `delivery_priority` badge values:
  - `ROUTINE`: no badge (default)
  - `DEGRADED`: `~` prefix glyph + amber badge
  - `HIGH_PRIORITY`: `★` prefix glyph + deep-orange badge

Empty slots render as greyed-out placeholder cells.

**Step 6.4 — `POST /cms/calendar/slots` — create slot**

`[+ Add Slot]` button (CONTENT_MANAGER+):
- Opens slot creation modal
- Fields: venue(s), start_time, end_time, content_id, delivery_priority (radio: ROUTINE / DEGRADED / HIGH_PRIORITY)
- 72h validation (client-side, before submit):
  - If `delivery_priority === 'ROUTINE'` and `start_time - now < 72h`: render inline error "ROUTINE slots require 72h lead time. Use HIGH_PRIORITY for urgent scheduling."
  - If `delivery_priority === 'HIGH_PRIORITY'`: no 72h restriction, proceed
  - If `delivery_priority === 'DEGRADED'`: no 72h restriction (degraded path by definition)
- Submit → `POST /cms/calendar/slots`
- 409 slot conflict rejection: Toast "Slot conflict with existing schedule. The conflicting slot was submitted by [name]."

**Step 6.5 — 72h ROUTINE banner (PATCH-017)**

When the content calendar has any ROUTINE slots within the next 96h:
- Render PATCH-017 banner above the calendar grid
- Banner: grey background, "ROUTINE delivery: 72h lead time required. Slots within 72h are at risk."
- Non-dismissible during session

**Step 6.6 — 72h DEGRADED banner variant (A-NEW-02)**

When `system_health.constitutional_state === 'DEGRADED'`:
- Replace ROUTINE banner with DEGRADED variant
- Banner: amber background, amber border, "DEGRADED MODE: Delivery timelines extended. Verify slot delivery status before relying on scheduled content."

**Step 6.7 — 72h HIGH_PRIORITY banner variant (A-NEW-02)**

When any HIGH_PRIORITY slot exists in the next 24h:
- Render HIGH_PRIORITY banner in addition to (not replacing) other banners
- Banner: deep-orange (`#EA580C`) border, `★` header glyph, "HIGH_PRIORITY slot active: expedited delivery path engaged."
- Non-dismissible

**Step 6.8 — Tab 5: Delivery Confidence**

Query `GET /cms/delivery-confidence`:
- Returns per-slot confidence objects with `priority`, `deadline`, `confidence_score`, `risk_factors`
- Render countdown per slot grouped by priority
- Color tiers per priority:
  - HIGH_PRIORITY: deep-orange threshold at 4h, amber at 12h, green above
  - ROUTINE: red threshold at 72h, amber at 96h, green above
  - DEGRADED: amber always (no confidence guarantee)
- `risk_factors` rendered as bullet list per slot

**Step 6.9 — Training Mode toggle**

Training Mode toggle (CONTENT_MANAGER+):
- Rendered in surface header, not in a tab
- PATCH-006: when Training Mode is active, persistent amber strip (28px) renders above tab bar: "TRAINING MODE — No changes will be applied to live corpus"
- Toggle persists in `localStorage` per operator session
- Amber strip is always visible when training mode active — not scrollable away

**Step 6.10 — Training mode pre-submit confirmation modal**

When Training Mode is active and operator clicks submit on any form:
- Intercept submit
- Render modal: "Training Mode is active. This action will NOT be applied to the live corpus. Do you want to simulate this submission?"
- `[Simulate]` → proceed with API call tagged as training (`?training=true` query param)
- `[Cancel]` → close modal, no call made
- API responses in training mode: render result as if real, but badge the result card with "SIMULATED" tag

### Slice 6 acceptance criterion

A CONTENT_MANAGER can:
1. Navigate to `/ops/cms`
2. Tab 1: see content library with correct status badges
3. Tab 2: see calendar grid with `delivery_priority` badges on slots
4. Click `[+ Add Slot]` → attempt to create a ROUTINE slot within 72h → see inline error before submit
5. Create a HIGH_PRIORITY slot within 24h → no 72h block → slot appears in calendar
6. 409 slot conflict → toast with conflicting submitter's name
7. Tab 2: correct banner(s) render based on system state and slot priorities
8. Tab 5: delivery confidence countdowns render with correct color tiers per priority
9. Enable Training Mode → amber strip appears and persists across tab navigation
10. Submit a slot in Training Mode → confirmation modal appears → Simulate → "SIMULATED" badge on result

---

## 9. Slice 7: Replay Investigation Surface

**Type:** Forensic replay and annotation
**Precondition:** Slice 6 complete and passing
**Gate:** Full replay investigation works. IC-03 enforced (no write controls visible in replay mode). Collaborator positions update in real time. Contradictions flagged.

### Purpose

The Replay Investigation surface operates under the IC-03 constraint: no write controls in REPLAY mode, enforced at DOM level. The surface also introduces collaborator presence — multiple operators can be in the same replay session simultaneously, with position synchronisation. This slice must fully enforce IC-03 before any other feature on the surface is built.

### Build steps (sequential)

**Step 7.1 — Route `/ops/replay/:session_id` — Replay shell**

`<ReplayInvestigationSurface />` mounted at route.

On mount:
- Query `GET /replay/sessions/{session_id}`
- Set `replaySlice.is_replay_mode = true` in Zustand store
- Set on unmount: `replaySlice.is_replay_mode = false`

**Step 7.2 — IC-03: enforce REPLAY mode at mount**

On mount, before rendering any child component:
- Read `replaySlice.is_replay_mode`
- If true: propagate via React Context `ReplayModeContext`
- All write-capable components consuming `ReplayModeContext` must return `null` (not disabled) when `is_replay_mode === true`
- This is a structural constraint, not a per-component check. `ReplayModeContext` is the single source of truth.

Verification: at mount, count all elements with `role="button"` or `type="submit"` in the DOM. The only permitted write controls in replay mode are the transport controls (play/pause/scrub) and annotation submission. All others must be absent.

**Step 7.3 — Persistent amber REPLAY banner**

28px amber banner at top of surface (above all tab content, non-scrollable):
- Background: `#FBBF24`
- Text: "REPLAY MODE — All actions are investigative only. No changes are applied to live state."
- Always visible while on this route
- Cannot be dismissed

**Step 7.4 — PATCH-013: transport state label**

Persistent transport state label in surface header (next to REPLAY banner):
- `STATE: ⏸ PAUSED` (paused)
- `STATE: ▶ REPLAYING` (playing)
- `STATE: ◁ SCRUBBING` (scrubbing)
- Updates reactively from `replaySlice.transport_state`

**Step 7.5 — Tab 1: Timeline**

Query `GET /replay/sessions/{session_id}/timeline`:
- Swim lanes: one per event category (content changes, overrides, state transitions, alerts)
- Each event: timestamp pip on swim lane with tooltip on hover
- Corpus events rendered in a dedicated swim lane
- Click event pip → Zone C renders event detail (read-only)

**Step 7.6 — Transport controls**

Play/pause/scrub controls rendered below timeline:
- `[⏸ Pause]` / `[▶ Play]` toggle
- Scrub bar: drag handle across timeline
- On interaction: `PATCH /replay/sessions/{session_id}/transport` with `{ action, position_ms }`
- `replaySlice.transport_state` updated from API response

These are the only write controls permitted in REPLAY mode (IC-03 exemption: transport controls are investigation tools, not governance actions).

**Step 7.7 — REPLAY_MODE rejection (403) handling**

When any non-transport write call receives 403 with `rejection_type: 'REPLAY_MODE'`:
- This should not happen if IC-03 is correctly enforced (controls are absent)
- If it does happen (edge case: race condition or direct API call): render `Toast` variant `error-extended` (10s auto-dismiss)
- Toast text: "Action blocked — you are in Replay Mode. This action cannot be taken while investigating a replay session."

**Step 7.8 — Collaborator presence: session header avatars**

Query `GET /replay/sessions/{session_id}/presence` on mount:
- Returns: `[{ operator_id, display_name, position_ms, last_updated }]`
- Render avatar row in session header: initials circles with tooltip (name + position timestamp)
- A-NEW-03: each avatar shows position as timestamp below initials

**Step 7.9 — Scrubber track pips per collaborator**

On scrub bar, render small colored pips for each collaborator's position:
- A-NEW-03: pip color matches avatar color (deterministic from `operator_id` hash)
- Pip updates when `COLLABORATOR_POSITION` event fires
- Tooltip on pip hover: operator name + timestamp

**Step 7.10 — `COLLABORATOR_POSITION` push events**

Subscribe to `COLLABORATOR_POSITION` WebSocket events:
- Throttle updates to maximum 2 per second per collaborator (discard intermediate events)
- Update `replaySlice.collaborators[operator_id].position_ms`
- Scrubber pips and session header avatars re-render

**Step 7.11 — Tab 3: Annotations**

Query `GET /replay/sessions/{session_id}/annotations`:
- Render list sorted by `position_ms` ascending
- Each annotation: position timestamp, author, text, `created_at`
- Annotations are immutable — no edit or delete controls

Add annotation form:
- Text area + `[Add Annotation]` button
- This is the one write action permitted in replay (IC-03 exemption: annotations are additive-only evidence, not governance mutations)
- Submit: `POST /replay/sessions/{session_id}/annotations`
- Success: new annotation appears in list; sorted by position
- Annotations from other collaborators: appear via `ANNOTATION_CREATED` WebSocket event (no polling)

For non-ADMIN roles: annotation submit renders normally.
For ADMIN role: no difference in Tab 3 UI (Tab 6 counterfactual is Slice 9).
For VIEWER role: annotation add form absent from DOM.

**Step 7.12 — Contradiction detection rendering**

When API response includes `contradictions` array in timeline data:
- Render `⚠ CONTRADICTION` divider in swim lane at contradiction timestamp
- Tab 3 label: amber dot badge (PATCH-010 mechanism)
- Contradiction detail: Zone C renders contradiction summary when divider is clicked
- Tab 3 amber dot clears when Tab 3 is focused

**Step 7.13 — Zone B auto-replace handling**

When `INCIDENT_CREATED` event fires with severity 1 or 2 while on the Replay surface:
- Do not immediately navigate away (would destroy replay session state)
- Instead: suspend replay transport (`PATCH /replay/sessions/{id}/transport { action: 'pause' }`)
- Save `session_id` and `position_ms` to `replaySlice`
- Navigate to IC surface for the new incident
- Render PATCH-014 banner in IC surface: "Replay session paused — [session description] at [timestamp]. [Resume →]"
- `[Resume →]` link: navigate back to replay route, transport resumes from saved position

### Slice 7 acceptance criterion

An operator can:
1. Open a replay session → amber REPLAY banner visible immediately, `STATE: ⏸ PAUSED` displayed
2. No write controls (other than transport and annotation) present in DOM — verified by DOM inspection
3. Play/pause/scrub → transport state label updates correctly
4. A second operator joins the same session → their avatar appears in session header with position timestamp
5. Second operator scrubs to a different position → pip on scrubber track updates within 0.5s
6. Add an annotation → appears in Tab 3 list; other session sees it via WebSocket without reload
7. A contradiction in the corpus → `⚠ CONTRADICTION` divider in swim lane; Tab 3 shows amber dot
8. Attempt a non-transport write action (simulated API call) → 10s red toast with REPLAY_MODE message
9. S1/S2 incident fires → replay pauses, IC surface appears, PATCH-014 banner shows "Resume →"
10. VIEWER: annotation form absent from DOM

---

## 10. Slice 8: Advisory and Notification System

**Type:** Zone C advisory + notification tray
**Precondition:** Slice 7 complete and passing
**Gate:** Advisory escalations produce visible Zone C state changes. Notifications accumulate and are dismissible.

### Purpose

Zone C provides contextual advisory information that escalates in visual weight as operator attention becomes more urgent. This slice completes the Zone C panel and the Zone A notification tray, both of which have been placeholder containers since Slice 0.

### Build steps (sequential)

**Step 8.1 — Zone C Pane C4: advisory visual states**

Query `GET /system/advisory` on mount:
- Returns: `{ advisory_level: 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT', message, context }`
- Render in Zone C Pane C4 (lower panel)

Visual states:
- `INFORMATIONAL`: default Zone C styling — no border change
- `RECOMMENDED` (A-NEW-01): amber left border (`#FBBF24`), amber background tint
- `URGENT` (A-NEW-01): deep-orange left border (`#EA580C`), single pulse animation on mount (200ms border-width expand, ease-out — does not repeat)

**Step 8.2 — A-NEW-01: RECOMMENDED and URGENT rendering**

Apply RECOMMENDED and URGENT styles as specified in Step 8.1.

URGENT single-pulse constraint: the pulse fires once when advisory transitions to URGENT. It does not repeat on re-render. Implementation: track `last_pulsed_at` in component state; only pulse if advisory level changed to URGENT since last render.

**Step 8.3 — `ADVISORY_UPDATE` push event → Zone C updates**

Subscribe to `ADVISORY_UPDATE` WebSocket event:
- Handler: update `advisory_level`, `message`, `context` in local state
- Zone C Pane C4 re-renders with new level
- If new level is `URGENT`: single pulse fires (per Step 8.2 constraint)

**Step 8.4 — Notification tray: advisory entries**

Zone C advisory entries also appear in Zone A notification tray (Pane A3):
- `RECOMMENDED` advisory → entry in tray with amber dot
- `URGENT` advisory → entry in tray with deep-orange dot (unread badge on tray icon)
- `INFORMATIONAL` advisory → not added to tray

**Step 8.5 — Zone A Pane A3: NotificationTray full implementation**

Replace placeholder with full implementation:
- Query `GET /notifications` on mount (paginated, last 50)
- Tray: scrollable list, newest first
- Each entry: dot color (severity/advisory-appropriate), message, timestamp, `[Mark Read]` button
- Unread count badge on Zone A tray toggle button
- `[Mark all read]` action at top of tray
- `POST /notifications/{id}/read` on mark-read
- Tray opens as overlay panel (not a route navigation)

**Step 8.6 — `NOTIFICATION_CREATED` push → tray badge updates**

Subscribe to `NOTIFICATION_CREATED` WebSocket event:
- Add notification to top of tray list
- Increment unread badge count
- If notification is `URGENT` advisory type: Zone C also updates via separate `ADVISORY_UPDATE` event (server emits both)

### Slice 8 acceptance criterion

An operator can:
1. See Zone C Pane C4 with advisory content in default (INFORMATIONAL) state
2. Observe: when advisory escalates to RECOMMENDED, amber border and tint appear in Zone C
3. Observe: when advisory escalates to URGENT, single pulse fires on Zone C border (does not repeat on re-render)
4. Open notification tray → see accumulated notifications with dot colors
5. Mark individual notification read → unread count decrements
6. Mark all read → unread badge clears
7. New notification fires via WebSocket → tray badge increments without page reload
8. URGENT advisory fires → Zone C updates AND tray entry appears simultaneously

---

## 11. Slice 9: ADMIN-Only Features

**Type:** Role-gated authority surfaces
**Precondition:** Slice 8 complete and passing
**Gate:** ADMIN users see Tab 6 in both IC and Replay. Non-ADMIN users see no Tab 6 in DOM (absent, not hidden).

### Purpose

ADMIN-only features are isolated to this slice to ensure the absent-not-disabled constraint can be tested cleanly in isolation. Tab 6 in Incident Command and Replay Investigation are the primary ADMIN-gated surfaces. Venue configuration and screen decommission were partially built in Slice 5 (Tab 2 screen management); this slice completes the venue config tab.

### Build steps (sequential)

**Step 9.1 — IC Tab 6: Evidence Package (ADMIN only)**

ADMIN role guard:
- For ADMIN: render Tab 6 label "Evidence Package" and tab panel
- For OPERATOR and below: Tab 6 is absent from the DOM — `TabList` does not render the tab element at all

Tab 6 content (ADMIN):
- Query `GET /incidents/{id}/evidence-package`
- Render: timeline export, override audit, operator action log, corpus snapshot references
- `[Download Evidence Package]` button → `GET /incidents/{id}/evidence-package/download` (file download)

Explicit non-ADMIN behaviour: a non-ADMIN operator who navigates directly to the IC route should see the same Tab 1–5 surface with no Tab 6 present in the DOM. If they attempt a direct API call to the evidence package endpoint, they receive a 403 (server-enforced). The frontend does not need to handle this explicitly — the tab simply does not exist for non-ADMIN.

**Step 9.2 — Replay Tab 6: Counterfactual (ADMIN only)**

ADMIN role guard (same mechanism as Step 9.1):
- For ADMIN: render Tab 6 label "Counterfactual" and tab panel
- For non-ADMIN: Tab 6 absent from DOM

Tab 6 content (ADMIN):
- Query `GET /replay/sessions/{session_id}/counterfactual`
- This endpoint may return 404 if no counterfactual data is available (role-obscuring: same 404 for non-ADMIN if they called directly, even though they'd get 403 — server handles the obscuring)
- Render: counterfactual scenario list, divergence points, hypothetical outcome summary
- If 404: "No counterfactual data available for this session"

**Step 9.3 — Venue Config tab**

In Venue Ops surface Tab 4 (previously shown as "Configuration — ADMIN"):
- For ADMIN: render tab
- For non-ADMIN: tab absent from DOM

Tab 4 content (ADMIN):
- Query `GET /venues/{id}/config`
- Form: venue display name, timezone, screen layout, autonomy window (hours)
- `[Save Configuration]` → `PATCH /venues/{id}/config`
- Success: toast "Configuration saved", venue identity header re-queries
- 409: toast "Configuration conflict — another admin updated this venue. Review current settings."

**Step 9.4 — Screen decommission via hold-to-confirm (ADMIN)**

Venue Ops Tab 2 (Screen Management) already built in Slice 5 for ADMIN. Verify:
- `[Decommission]` uses `HoldToConfirmButton` (3s hold)
- Calls `DELETE /venues/{id}/screens/{screen_id}`
- On success: screen removed from list
- On 409: toast "Screen is active in an incident. Decommission blocked until incident resolves."

If this was deferred in Slice 5, complete it now.

### Slice 9 acceptance criterion

With an ADMIN session and an OPERATOR session open simultaneously on the same incident:
1. ADMIN session: Tab 6 "Evidence Package" visible in IC surface tab list
2. OPERATOR session: Tab 6 entirely absent from DOM (verified by `document.querySelectorAll('[data-tab]').length` returning 5 not 6)
3. ADMIN session: Tab 6 "Counterfactual" visible in Replay surface
4. OPERATOR session: Replay Tab 6 absent from DOM
5. ADMIN session: Venue Ops Tab 4 "Configuration" visible; form submits and saves
6. Non-ADMIN session: Venue Ops Tab 4 absent from DOM
7. ADMIN screen decommission: hold-to-confirm required; 409 on active incident produces correct toast

---

## 12. Deferrable Features

The following features are explicitly deferred from v1. They are not implicit deferrals — each is named. Nothing on this list blocks first operational deployment. Subsequent sprints should reference this list as a backlog input.

### Replay

- **Replay corpus diff tab (Tab 4):** Side-by-side diff of corpus before/after a corpus event. Replay investigation works without it — operators can use Tab 1 timeline and Tab 3 annotations.
- **Counterfactual authoring UI:** ADMIN can view counterfactual data (Slice 9) but cannot author new counterfactual scenarios. Authoring is a future capability.

### Incident Command

- **IC Tab 4 PRE Divergence:** Full PRE diff view showing engine-level divergence from expected state. Incident management works without it — PRE constraint rejections still surface via toast (Slice 4). The full diff is investigative depth.

### Live Operations

- **Fleet multi-monitor view (WF-LO-06):** Tile grid showing all venues simultaneously. Single-venue selection workflow (Slice 1) is sufficient for first deployment.
- **Live ops historical charts:** Time-series graphs of machine state, player health, signal quality. Current cards show latest values only.

### CMS Content Operations

- **Advanced filtering in content library:** Search by tag, content type, date range, approval status. Basic list (Slice 6) is sufficient for initial content management.
- **Bulk slot operations:** Multi-select calendar slots for mass reschedule or delete.
- **Venue screen bulk enrollment:** Enroll multiple screens in a single operation. Single-screen enrollment (Slice 5) is sufficient for first venues.

### Forensics and Audit

- **Audit trail export:** Packaged export of full operator action log, usable in external investigations. Evidence package download (Slice 9) covers immediate ADMIN needs.
- **Corpus verification history chart:** Time-series visualization of corpus hash changes. Tab 3 current hash display (Slice 5) is sufficient.

### Performance and Display

- **Performance mode:** Reduced animation set for fleet wall displays where multiple instances run simultaneously. All animation is standard rate in v1.
- **Reduced-motion media query support:** Respects `prefers-reduced-motion`. Not implemented in v1 UI primitives.

### Responsive and Accessibility

- **Mobile/tablet responsive breakpoints:** The operator platform is desktop-first. No mobile breakpoints in v1.
- **Keyboard shortcut system:** Global keyboard nav (e.g., `G` + `I` → incidents, `G` + `V` → venue ops). Not implemented in v1.
- **Screen reader / ARIA full audit:** Basic ARIA labels implemented. Full accessibility audit and remediation deferred.
- **Focus management in modals:** Tab-trap in modals is partially implemented. Full keyboard modal navigation deferred.

### Localization

- **i18n / localization:** All text is English-only in v1. No translation layer. String extraction for localization is not performed until the product ships to a non-English market.
- **RTL layout support:** Not applicable in v1.

### Visual Theming

- **Dark mode:** The operator platform uses a fixed dark-on-light theme. No theme switching in v1. Dark mode is deferred until the design token system is extended.

---

## Appendix A: Package Dependency Graph

```
@clubhub/types          (no dependencies)
       ↓
@clubhub/api            (depends on: types)
       ↓
@clubhub/state          (depends on: types, api)
       ↓
@clubhub/hooks          (depends on: types, api, state)
       ↓
@clubhub/ui             (depends on: types)
       ↓
[surface components]    (depends on: types, api, state, hooks, ui)
```

`@clubhub/ui` has no runtime dependency on `@clubhub/api` or `@clubhub/state`. UI components receive all data via props. This ensures `@clubhub/ui` can be tested in Storybook without a backend.

---

## Appendix B: WebSocket Event Catalogue

All events subscribed to across all slices:

| Event | Slice introduced | Consumer |
|---|---|---|
| `VENUE_STATE_UPDATE` | 1 | Zone A VenueSelector dot |
| `VENUE_DETAIL_UPDATE` | 1 | Zone B Venue Health cards |
| `INCIDENT_CREATED` | 2 | Zone A IncidentList, Zone B auto-replace |
| `INCIDENT_UPDATE` | 2 | Zone A IncidentList, IC surface |
| `INCIDENT_CLOSED` | 2 | Zone A IncidentList |
| `COMMANDER_LAPSED` | 2 | IC Incident Identity Bar, Zone A badge |
| `COMMANDER_CLAIMED` | 3 | IC Incident Identity Bar, all IC sessions |
| `COMMANDER_RELEASED` | 3 | IC Incident Identity Bar, all IC sessions |
| `OVERRIDE_PLACED` | 4 | IC Tab 3, Tab 3 red dot |
| `OVERRIDE_REMOVED` | 4 | IC Tab 3 |
| `COLLABORATOR_POSITION` | 7 | Replay scrubber pips, session header |
| `ANNOTATION_CREATED` | 7 | Replay Tab 3 annotation list |
| `ADVISORY_UPDATE` | 8 | Zone C Pane C4, Zone A notification tray |
| `NOTIFICATION_CREATED` | 8 | Zone A NotificationTray, badge count |

All event subscriptions are cleaned up on component unmount. WebSocket client reference-counts subscriptions — connection persists as long as at least one subscriber exists.

---

## Appendix C: Rejection Type UI Response Matrix

All four rejection types must be handled consistently across all write actions. The table below is the authoritative response mapping. Any new write action added after v1 must implement the applicable row(s).

| Rejection type | HTTP status | UI response | Duration |
|---|---|---|---|
| `CONCURRENCY_CONFLICT` | 409 | Error toast + forced state re-query | 5s auto-dismiss |
| `AUTHORITY_BOUNDARY` | 403 | Modal with `[Understood]` button | Operator-dismissed |
| `PRE_CONSTRAINT` | 422 | Error toast + "View PRE context →" link opening Zone C | 8s auto-dismiss |
| `REPLAY_MODE` | 403 | Extended error toast (10s) | 10s auto-dismiss |

`REPLAY_MODE` rejection should not occur if IC-03 is correctly enforced. Its handler exists as a defence-in-depth layer.

---

*Document version: 1.0. This document is the authoritative build-order specification for the ClubHub TV operator platform CMS frontend, v1. Amendments require updating the version number and noting the change with a date.*
