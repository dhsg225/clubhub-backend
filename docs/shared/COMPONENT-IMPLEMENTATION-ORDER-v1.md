# COMPONENT-IMPLEMENTATION-ORDER-v1

**Status:** AUTHORITATIVE
**Version:** 1.0
**Date:** 2026-06-04
**Audience:** Frontend engineering team (2-engineer parallel development)
**Scope:** ClubHub TV Operator CMS — all frontend components, ordered for parallel build

---

## 1. Build Order Philosophy

### Dependency Hierarchy

Components are built strictly leaf-first. A component may not be started until all components it imports are complete and tested.

```
@clubhub/types          (leaf — no React deps, pure TypeScript)
    ↓
@clubhub/api            (depends on types only)
@clubhub/state          (depends on types only)
    ↓
@clubhub/hooks          (depends on types, api, state)
@clubhub/ui             (depends on types only — stateless or prop-driven)
    ↓
apps/cms-operator chrome (depends on ui, state, hooks)
    ↓
surface-specific components (depend on chrome, ui, hooks, api)
```

### Four Ordering Rules

**Rule 1: Leaf before consumer.**
`@clubhub/types` ships first. Nothing else begins until types are merged and published to the workspace.

**Rule 2: Shared UI before chrome.**
Chrome components reference `@clubhub/ui` primitives. A chrome component may not begin until every `@clubhub/ui` component it uses is complete.

**Rule 3: Chrome before surfaces.**
Surface components are mounted inside the shell. The shell must exist as a testable scaffold before any surface work begins.

**Rule 4: Within a surface — data hooks before display, display before write controls.**
Sequence within every surface track: React Query hooks → read-only display components → write flow components. This allows read paths to be tested and reviewed before write controls are added. Write controls introduce mutation and require additional review (EPIC-3/EPIC-4 gates).

### Parallel Track Model

Two engineers work on non-overlapping tracks simultaneously. Tracks are designed so that the output of one track becomes the input of the next. Hand-off points are explicit (see Section 10).

---

## 2. Track A: Foundation (Week 1 — no engineer conflict)

Track A produces the packages that everything else depends on. Engineers 1 and 2 work on separate sub-tracks simultaneously. Neither sub-track depends on the other during Week 1. They converge at the end of Week 1 when both packages are merged.

---

### Sub-track A1: Types and API (Engineer 1)

#### Step A1-1: `@clubhub/types` — All shared TypeScript interfaces

This is the true leaf of the entire dependency graph. No React. No runtime logic. Only TypeScript `interface`, `type`, and `enum` declarations.

**Interfaces to define (minimum):**

```typescript
// Machine and venue state
type MachineState =
  | 'LIVE'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'RECOVERED_BUT_UNTRUSTED'
  | 'MAINTENANCE'
  | 'DECOMMISSIONED';

type ConstitutionalState =
  | 'NOMINAL'
  | 'ADVISORY'
  | 'INCIDENT'
  | 'EMERGENCY'
  | 'REPLAY'
  | 'TRAINING'
  | 'DEGRADED'
  | 'SHUTDOWN';

type SeverityLevel = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

type AdvisoryLevel = 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';

type DeliveryPriority = 'ROUTINE' | 'DEGRADED' | 'HIGH_PRIORITY';

type OverrideTier = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

type RejectionType =
  | 'AUTHORITY_INSUFFICIENT'
  | 'CONFLICT_DETECTED'
  | 'RATE_LIMITED'
  | 'CORPUS_UNVERIFIED';

type OperatorRole =
  | 'VIEWER'
  | 'OPERATOR'
  | 'INCIDENT_COMMANDER'
  | 'CONTENT_MANAGER'
  | 'VENUE_MANAGER'
  | 'ADMIN';

// Entity interfaces
interface Venue {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  corpus_hash_verified: boolean;
  autonomy_expires_at: string; // ISO 8601
  active_incident_id: string | null;
}

interface Incident {
  incident_id: string;
  venue_id: string;
  severity: SeverityLevel;
  state: 'OPEN' | 'COMMANDER_LAPSED' | 'RESOLVED' | 'CLOSED';
  constitutional_state: ConstitutionalState;
  commander_id: string | null;
  commander_name: string | null;
  opened_at: string; // ISO 8601
  resolved_at: string | null;
  shift_notes: string;
}

interface Override {
  override_id: string;
  incident_id: string;
  tier: OverrideTier;
  content_id: string;
  placed_by: string;
  placed_at: string; // ISO 8601
  expires_at: string | null;
}

interface Advisory {
  advisory_id: string;
  venue_id: string;
  level: AdvisoryLevel;
  message: string;
  issued_at: string; // ISO 8601
  expires_at: string | null;
}

interface PlayerHealth {
  sync_state: 'SYNCED' | 'DRIFTED' | 'OFFLINE';
  corpus_hash_match: boolean;
  last_heartbeat_at: string;
  uptime_seconds: number;
  signal_quality: SignalQuality;
}

interface SignalQuality {
  network_strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  packet_loss_percent: number;
  latency_ms: number;
}

interface Collaborator {
  operator_id: string;
  display_name: string;
  role: OperatorRole;
  timeline_position: string | null; // ISO 8601, null when at live edge
  joined_at: string;
}

interface CMSSlot {
  slot_id: string;
  venue_id: string;
  content_id: string;
  content_name: string;
  scheduled_at: string;
  delivery_priority: DeliveryPriority;
  delivery_confirmed: boolean;
  delivery_confirmed_at: string | null;
}

interface DeliveryConfidence {
  venue_id: string;
  routine_confidence_percent: number;
  high_priority_delivery_by: string; // ISO 8601
  degraded_mode_active: boolean;
}

interface RejectionEnvelope {
  rejection_type: RejectionType;
  message: string;
  context: Record<string, unknown>;
}

interface SystemHealthState {
  constitutional_state: ConstitutionalState;
  active_incident_count: number;
  fleet_online_count: number;
  fleet_total_count: number;
  training_mode: boolean;
  replay_session_active: boolean;
  last_updated_at: string;
}

interface ReplaySession {
  session_id: string;
  venue_id: string;
  incident_id: string | null;
  started_at: string;
  replay_position: string; // ISO 8601
  collaborators: Collaborator[];
  annotations: ReplayAnnotation[];
}

interface ReplayAnnotation {
  annotation_id: string;
  session_id: string;
  author_id: string;
  author_name: string;
  content: string;
  timeline_position: string; // ISO 8601
  created_at: string;
  contradiction: boolean;
}

interface MachineStateTransition {
  from_state: MachineState;
  to_state: MachineState;
  transitioned_at: string; // ISO 8601
  duration_seconds: number | null; // null if current state
  trigger: string;
}

interface CorpusStatus {
  venue_id: string;
  corpus_hash: string;
  verified: boolean;
  last_verified_at: string | null;
  verification_in_progress: boolean;
}

// WebSocket message types
type WSMessageType =
  | 'VENUE_STATE_UPDATE'
  | 'INCIDENT_UPDATE'
  | 'OVERRIDE_PLACED'
  | 'OVERRIDE_REMOVED'
  | 'ZONE_B_AUTO_REPLACE'
  | 'ADVISORY_ISSUED'
  | 'SYSTEM_HEALTH_UPDATE'
  | 'COLLABORATOR_JOINED'
  | 'COLLABORATOR_LEFT'
  | 'COLLABORATOR_MOVED';

interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

interface ZoneBAutoReplacePayload {
  target_surface: string;
  context: Record<string, unknown>;
  banner_message: string;
}
```

**What this step produces:** A fully typed `@clubhub/types` package. Every other package imports from here. Zero runtime code.

**Done when:** All interfaces above are defined, exported from `index.ts`, TypeScript compiles with zero errors, workspace link is resolvable from sibling packages.

---

#### Step A1-2: `@clubhub/api` — Base fetch wrapper

**Props interface (internal config):**
```typescript
interface FetchConfig {
  baseUrl: string;
  token: string;
  timeout_ms: number;
}

interface ApiResponse<T> {
  data: T;
  ok: true;
}

interface ApiError {
  ok: false;
  status: number;
  rejection?: RejectionEnvelope; // present when status === 409 or 403
  message: string;
}

type ApiResult<T> = ApiResponse<T> | ApiError;
```

**What it does:**
- Wraps `fetch` with auth header injection (Bearer token from config)
- Parses rejection envelope from 403/409 response bodies into `RejectionEnvelope`
- Returns `ApiResult<T>` — callers check `result.ok` before accessing `result.data`
- Applies timeout via `AbortController`
- Does NOT retry (retry policy is React Query's responsibility)

**What it does NOT do:** No caching. No retry. No React dependency. Usable in test environments without a DOM.

---

#### Step A1-3: `@clubhub/api` — WebSocket client

**Interface:**
```typescript
interface WSClientConfig {
  url: string;
  token: string;
  reconnect_interval_ms: number;
  max_reconnect_attempts: number;
}

type WSMessageHandler<T = unknown> = (message: WSMessage<T>) => void;

interface WSSubscription {
  unsubscribe: () => void;
}

interface WSClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe<T>(type: WSMessageType, handler: WSMessageHandler<T>): WSSubscription;
  getConnectionState(): 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'FAILED';
}
```

**What it does:**
- Opens a WebSocket connection with token in the URL query param or first message
- Automatically reconnects on close with exponential backoff up to `max_reconnect_attempts`
- Routes incoming messages to registered handlers by `type`
- `subscribe()` returns an unsubscribe handle — callers clean up on unmount
- Emits connection state changes that the Zustand WS store listens to

**What it does NOT do:** No React. No Zustand. No React Query. Pure browser WebSocket wrapper.

**Done when:** Unit tests confirm message routing, reconnect logic, and subscription cleanup without a real server (use a mock WS server in tests).

---

### Sub-track A2: State Foundation (Engineer 2, parallel with A1)

Engineer 2 builds the Zustand and React Query foundation simultaneously. These stores depend only on `@clubhub/types` (which is being built in A1 at the same time). Engineer 2 can stub the types locally and swap the real import when A1 merges.

#### Step A2-1: `@clubhub/state` — React Query client config

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s — venues/incidents refresh on focus
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,                   // mutations do not retry — rejection is surfaced to UI
    },
  },
});
```

**What it does:** Exports `queryClient` and `<QueryClientProvider>` wrapper. Defines shared query key factory functions for cache invalidation consistency.

```typescript
export const queryKeys = {
  venues: () => ['venues'] as const,
  venue: (id: string) => ['venues', id] as const,
  venueHealth: (id: string) => ['venues', id, 'health'] as const,
  incident: (id: string) => ['incidents', id] as const,
  incidentOverrides: (id: string) => ['incidents', id, 'overrides'] as const,
  incidentTransitions: (id: string) => ['incidents', id, 'transitions'] as const,
  venueOpsSummary: (id: string) => ['venue-ops', id, 'summary'] as const,
  venueCorpus: (id: string) => ['venue-ops', id, 'corpus'] as const,
  venueMachineHistory: (id: string) => ['venue-ops', id, 'machine-history'] as const,
  cmsCalendar: (venueId: string, week: string) => ['cms', venueId, 'calendar', week] as const,
  cmsDeliveryConfidence: (id: string) => ['cms', id, 'delivery-confidence'] as const,
};
```

---

#### Step A2-2: `@clubhub/state` — Zustand auth store

```typescript
interface AuthState {
  operator_id: string | null;
  operator_name: string | null;
  role: OperatorRole | null;
  token: string | null;
  is_authenticated: boolean;
  setAuth: (payload: { operator_id: string; operator_name: string; role: OperatorRole; token: string }) => void;
  clearAuth: () => void;
}
```

**What it does:** Persists token to `sessionStorage`. Provides `is_authenticated` derived boolean. `clearAuth()` removes session storage entry and resets all fields to null.

---

#### Step A2-3: `@clubhub/state` — Zustand UI store

```typescript
interface UIState {
  active_surface: string | null;   // e.g. 'live-ops', 'incident-command', 'venue-ops', 'cms-operations'
  active_venue_id: string | null;
  active_incident_id: string | null;
  zone_c_collapsed: boolean;
  training_mode: boolean;
  setActiveSurface: (surface: string, context?: { venue_id?: string; incident_id?: string }) => void;
  setZoneCCollapsed: (collapsed: boolean) => void;
  setTrainingMode: (enabled: boolean) => void;
}
```

**What it does:** Single source of truth for navigation state and layout toggles. `setActiveSurface()` sets both the surface name and its context (venue, incident) atomically. Training mode state is global — when true, every surface renders `TrainingModeBanner`.

---

#### Step A2-4: `@clubhub/state` — Zustand WebSocket store

```typescript
interface WSStore {
  connection_state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'FAILED';
  last_message_at: string | null;
  pending_zone_b_replace: ZoneBAutoReplacePayload | null;
  setConnectionState: (state: WSStore['connection_state']) => void;
  setLastMessageAt: (ts: string) => void;
  setPendingZoneBReplace: (payload: ZoneBAutoReplacePayload | null) => void;
}
```

**What it does:** Stores connection state updated by the WS client. Stores `ZONE_B_AUTO_REPLACE` payload for `ZoneBAutoReplace` component to consume. Other WS messages (venue updates, incident updates) trigger React Query cache invalidation directly — they do not go through this store.

**Done when:** All four Zustand stores export correct TypeScript types, `useAuthStore()`, `useUIStore()`, `useWSStore()` hooks are callable from any React component.

---

## 3. Track B: Shared UI Components (Week 1–2 — Engineer 1, after A1)

Track B begins as soon as `@clubhub/types` is merged. Each component in this track depends on `@clubhub/types` only (no Zustand, no React Query, no API calls). All components are stateless or manage only internal UI state (timers, step position, animation).

Build in the exact order listed. Earlier components are simpler and establish visual patterns that later components reference.

---

### B-1: `SeverityBadge`

**Props:**
```typescript
interface SeverityBadgeProps {
  severity: SeverityLevel;
  size?: 'sm' | 'md' | 'lg';  // default: 'md'
}
```

**Internal state:** None.

**Color map (PATCH-004):**
| Severity | Background | Label |
|----------|-----------|-------|
| S1 | `#C62828` | S1 |
| S2 | `#E64A19` | S2 |
| S3 | `#F57C00` | S3 |
| S4 | `#FBC02D` | S4 |
| S5 | `#558B2F` | S5 |

**Renders:** Colored pill with severity label. White text on S1–S3, dark text on S4–S5.

**Does NOT:** accept onClick, manage any state, or make API calls.

---

### B-2: `MachineStateBadge`

**Props:**
```typescript
interface MachineStateBadgeProps {
  machine_state: MachineState;
  corpus_hash_verified: boolean;
  variant?: 'dot' | 'full';  // default: 'full'
}
```

**Internal state:** None.

**Logic (PATCH-009):** When `machine_state === 'RECOVERED_BUT_UNTRUSTED'`, renders `LIVE—UNVERIFIED` pill regardless of `corpus_hash_verified`. When `variant === 'dot'`, renders only the color dot (for use in ZoneAVenueSelector). When `variant === 'full'`, renders pill with label.

**State color map:**
| State | Color |
|-------|-------|
| LIVE | `#2E7D32` (green) |
| OFFLINE | `#616161` (grey) |
| DEGRADED | `#F57C00` (amber) |
| RECOVERED_BUT_UNTRUSTED | `#E64A19` (deep-orange) |
| MAINTENANCE | `#1565C0` (blue) |
| DECOMMISSIONED | `#37474F` (blue-grey) |

**Does NOT:** fetch any data. Derives display state entirely from props.

---

### B-3: `TabBadge`

**Props:**
```typescript
interface TabBadgeProps {
  type: 'red' | 'amber' | 'green';
  visible: boolean;
}
```

**Internal state:** None.

**Renders:** 8px diameter dot in the specified color. Renders nothing when `visible === false`.

**Does NOT:** manage count, animate, or respond to interaction.

---

### B-4: `CountdownClock`

**Props:**
```typescript
interface CountdownClockProps {
  expires_at: string;  // ISO 8601
  onExpired?: () => void;
  format?: 'dhms' | 'hms' | 'ms';  // default: 'hms'
}
```

**Internal state:** `remaining_seconds: number` — updated every 1000ms via `setInterval`.

**Color tiers:**
- `> 24h` remaining: default (no color emphasis)
- `6h–24h` remaining: amber (`#F57C00`)
- `< 6h` remaining: red (`#C62828`) with CSS pulse animation

**Lifecycle:** `useEffect` sets up `setInterval(1000)` on mount, clears on unmount. Calls `onExpired()` once when `remaining_seconds` reaches 0.

**Does NOT:** fetch expiry time from API. Receives `expires_at` as a prop. Does not manage its own timer reset when `expires_at` prop changes — parent is responsible for re-mounting or providing a stable prop.

---

### B-5: `AdvisoryCard`

**Props:**
```typescript
interface AdvisoryCardProps {
  advisory: Advisory;
}
```

**Internal state:** None.

**Visual rules by `advisory_level`:**
- `INFORMATIONAL`: white card, no emphasis, standard text
- `RECOMMENDED`: amber left border (`#F57C00`), amber icon, standard opacity
- `URGENT`: deep-orange background tint (`#FBE9E7`), deep-orange icon, single CSS pulse on mount then steady (A-NEW-01)

**Renders:** Card with level label, message text, issued time, expiry (if present).

**Does NOT:** dismiss itself, manage timer for expiry, or make API calls.

---

### B-6: `TrainingModeBanner`

**Props:**
```typescript
interface TrainingModeBannerProps {
  // No props — always renders the same content
}
```

**Internal state:** None.

**Renders:** 24px amber strip (`#F57C00` background, white text) with label "TRAINING MODE — actions have no real effect". Always visible when rendered. Parent is responsible for conditional rendering based on `training_mode` from UIState (PATCH-006).

**Does NOT:** read Zustand. Does not manage its own visibility.

---

### B-7: `ReplayBanner`

**Props:**
```typescript
interface ReplayBannerProps {
  session_id: string;
  replay_position: string;  // ISO 8601 — displayed as human-readable date/time
}
```

**Internal state:** None.

**Renders:** Persistent 28px amber banner (IC-03 visual). Text: "REPLAY — {formatted_position}". Never collapses. Position in layout: below `SystemStatusBar`, above zone content.

**Does NOT:** control its own visibility. Caller renders it only when a replay session is active.

---

### B-8: `HoldToConfirmButton`

**Props:**
```typescript
interface HoldToConfirmButtonProps {
  label: string;
  hold_duration_ms?: number;  // default: 3000
  disabled?: boolean;
  onConfirm: () => void;
  destructive?: boolean;  // applies red color scheme when true
}
```

**Internal state:**
```typescript
{ holding: boolean; progress: number; /* 0–1 */ }
```

**Behavior (PATCH-002):**
- `onPointerDown`: starts progress arc animation over `hold_duration_ms` via `requestAnimationFrame`
- `onPointerUp` or `onPointerLeave`: cancels hold, resets progress to 0
- When progress reaches 1.0: calls `onConfirm()` once, resets state
- Progress arc is a CSS `clip-path` or SVG arc rendered around button perimeter

**Does NOT:** manage confirmation result, make API calls, or handle errors.

---

### B-9: `SequentialChipSelect`

**Props:**
```typescript
interface SequentialChipSelectProps {
  steps: Array<{
    step_id: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  onComplete: (selections: Record<string, string>) => void;
  disabled?: boolean;
}
```

**Internal state:**
```typescript
{ current_step: number; selections: Record<string, string>; }
```

**Behavior (PATCH-001):**
- Renders only the current step's chips; previous steps show as locked summary badges
- Selecting a chip in step N advances to step N+1 automatically
- On final step selection, calls `onComplete(selections)` then resets to step 0
- `useEffect` cleanup resets state to `{ current_step: 0, selections: {} }` on unmount

**Does NOT:** skip steps, allow editing previous steps, or make API calls.

---

### B-10: `RejectionToast`

**Props:**
```typescript
interface RejectionToastProps {
  rejection: RejectionEnvelope;
  onDismiss: () => void;
}
```

**Internal state:** None.

**Rendering rules by `rejection_type` (A-NEW-04):**

| Type | Format | Duration |
|------|--------|----------|
| `AUTHORITY_INSUFFICIENT` | Toast (bottom-right), amber, "You don't have authority to perform this action." | 5s auto-dismiss |
| `CONFLICT_DETECTED` | Modal (centered), blocks interaction, red. Shows conflict context from `envelope.context`. | Manual dismiss required |
| `RATE_LIMITED` | Toast (bottom-right), grey, "Too many requests. Wait {retry_after}s." | Auto-dismiss at retry_after |
| `CORPUS_UNVERIFIED` | Modal (centered), amber, "This venue's corpus is unverified. Verify before placing overrides." | Manual dismiss required |

**Does NOT:** manage its own visibility state. Caller (write flow component) renders `RejectionToast` when a rejection envelope is present and unmounts it when dismissed.

---

### B-11: `PresenceAvatars` — DEFERRED

**Build with Slice 7 (Replay surface).** Do not begin until Track H begins.

**Props (defined here for reference, not yet implemented):**
```typescript
interface PresenceAvatarsProps {
  collaborators: Collaborator[];
  show_positions?: boolean;  // shows timeline_position labels; default false
}
```

---

## 4. Track C: Chrome (Week 2 — Engineer 2, after A2; Engineer 1 joins after Track B)

Chrome components are owned by `apps/cms-operator/src/chrome/`. They depend on `@clubhub/state` and `@clubhub/ui`. Build in the exact order listed — each component depends on the previous.

---

### C-1: `ShellLayout`

**Props:**
```typescript
interface ShellLayoutProps {
  children: React.ReactNode;  // Zone B content (surface outlet)
}
```

**Internal state:** Reads `zone_c_collapsed` from `useUIStore()`.

**Renders:** Four zone containers with CSS Grid or Flexbox:
- `SystemStatusBar` — 48px, full width, fixed top
- `ZoneA` — 280px left column, full height minus status bar
- Zone B (outlet) — flex: 1, scrollable
- `ZoneC` — 320px right column (or 48px when collapsed)

**Does NOT:** render any business content. Pure layout scaffold. Surface content is passed as `children`.

---

### C-2: `SystemStatusBar`

**Props:** None (reads from stores).

**Internal state:** Reads `SystemHealthState` from React Query (`useQuery(queryKeys.systemHealth())`).

**Renders:** 48px bar with 6 indicators:
1. Constitutional state label (text, color-coded by state)
2. Active incident count (red badge when > 0)
3. Fleet online/total ratio (e.g. "12/15 online")
4. Training mode indicator (amber dot when active)
5. Replay session indicator (amber dot when active)
6. Last updated timestamp (grey, relative time)

**Does NOT:** provide navigation. Does not allow clicks on indicators (read-only status bar).

---

### C-3: `ZoneC`

**Props:**
```typescript
interface ZoneCProps {
  children: React.ReactNode;
}
```

**Internal state:** Reads and writes `zone_c_collapsed` from `useUIStore()`.

**Renders:** Right column container (320px expanded, 48px collapsed). Toggle button (chevron icon) at top that calls `setZoneCCollapsed()`. When collapsed, hides children with `visibility: hidden` (preserves layout space).

**Does NOT:** determine what to render inside — children are provided by the surface.

---

### C-4: `ZoneA`

**Props:** None.

**Internal state:** None (renders four child components as fixed panes).

**Renders:** 280px left column containing:
1. `ZoneAVenueSelector` (upper section, scrollable)
2. `ZoneAIncidentList` (middle section, scrollable)
3. `ZoneANotificationTray` (bottom strip)
4. `ZoneAOperatorTools` (bottom, fixed)

**Does NOT:** fetch any data directly. All data fetching is done by the four child components.

---

### C-5: `ZoneAVenueSelector`

**Props:** None.

**Internal state:** Reads venue list from `useQuery(queryKeys.venues())`. Reads `active_venue_id` from `useUIStore()`.

**Renders:** Scrollable list of venues. Each row: `MachineStateBadge` (dot variant) + venue name. Highlights active venue. Calls `setActiveSurface('live-ops', { venue_id })` on click.

**Does NOT:** render incident details. Does not show autonomy clocks (that is Venue Ops).

---

### C-6: `ZoneAIncidentList`

**Props:** None.

**Internal state:** Reads active incidents from `useQuery(['incidents', 'active'])`. Reads `active_incident_id` from `useUIStore()`.

**Renders:** List of open incidents. Each row: `SeverityBadge` + venue name + incident duration. Red background when severity S1. Calls `setActiveSurface('incident-command', { incident_id })` on click.

**Does NOT:** render resolved or closed incidents.

---

### C-7: `ZoneANotificationTray`

**Props:** None.

**Internal state:** Reads notifications from `useQuery(['notifications'])`. Local state: `tray_open: boolean`.

**Renders:** Strip with unread count badge (red). Click opens tray drawer (slide-out from Zone A). Tray lists notifications with type icon and timestamp. Mark-as-read on tray open (fires mutation).

**Does NOT:** show notification content inline (tray only). Does not navigate to surfaces on notification click (future enhancement).

---

### C-8: `ZoneAOperatorTools`

**Props:** None.

**Internal state:** Reads `training_mode` from `useUIStore()`. Reads `operator_name`, `role` from `useAuthStore()`.

**Renders:**
- `TrainingModeBanner` when `training_mode === true` (PATCH-006)
- Operator menu: avatar + name + role label + logout button

**Does NOT:** allow training mode toggle (that is `TrainingModeToggle` in CMS Operations). Displays current state only.

---

### C-9: `ZoneBAutoReplace`

**Props:** None.

**Internal state:** Reads `pending_zone_b_replace` from `useWSStore()`. Subscribes to `ZONE_B_AUTO_REPLACE` WS messages on mount via `useEffect`.

**Behavior:** When WS message arrives:
1. WS client handler calls `setPendingZoneBReplace(payload)`
2. Component reads payload, calls `setActiveSurface(payload.target_surface, payload.context)`
3. Renders a 56px amber banner (PATCH-014) with `payload.banner_message` above Zone B content for 10 seconds
4. After 10s, calls `setPendingZoneBReplace(null)` to dismiss banner

**Does NOT:** block user navigation after auto-replace. Banner is dismissible.

---

## 5. Track D: Live Operations Surface (Week 2–3 — Engineer 1)

Begins after Track C provides the shell scaffold. All components live in `apps/cms-operator/src/surfaces/live-ops/`.

---

### D-1: React Query hooks

Build before any display component.

```typescript
// hooks/useVenueList.ts
function useVenueList(): UseQueryResult<Venue[]>

// hooks/useVenueDetail.ts
function useVenueDetail(venue_id: string): UseQueryResult<Venue>

// hooks/useVenuePlayerHealth.ts
function useVenuePlayerHealth(venue_id: string): UseQueryResult<PlayerHealth>
```

**Query keys:** Use `queryKeys.venues()`, `queryKeys.venue(id)`, `queryKeys.venueHealth(id)`.

**What each hook does:** Wraps `useQuery` with the appropriate API call. Refetches on focus. Does not expose raw `ApiResult` — maps API errors to React Query error state.

---

### D-2: `VenueIdentityHeader`

**Props:**
```typescript
interface VenueIdentityHeaderProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useVenueDetail(venue_id)`.

**Renders:** Venue name (H1), `MachineStateBadge` (full variant), active incident badge (links to incident-command surface when clicked). Shows loading skeleton while query is pending.

**Does NOT:** manage navigation directly — calls `setActiveSurface()`.

---

### D-3: `PlayerHealthSection`

**Props:**
```typescript
interface PlayerHealthSectionProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useVenuePlayerHealth(venue_id)`.

**Renders (PATCH-019 section labels):**

Section "Player Status" (4 cards):
1. Sync State — `SYNCED` / `DRIFTED` / `OFFLINE`
2. Corpus Hash Match — `VERIFIED` / `MISMATCH`
3. Last Heartbeat — relative time
4. Uptime — formatted duration

Section "Signal Quality" (3 cards):
1. Network Strength — `STRONG` / `MODERATE` / `WEAK` / `NONE`
2. Packet Loss — percentage
3. Latency — ms

**Does NOT:** allow actions. Read-only display.

---

### D-4: `PRESummarySection`

**Props:**
```typescript
interface PRESummarySectionProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useQuery(['pre-summary', venue_id])`.

**Renders:** Current PRE resolution level display (L0–L6 label + description). Read-only.

**Does NOT:** show override history or allow PRE manipulation.

---

### D-5: `InterventionSurface`

**Props:**
```typescript
interface InterventionSurfaceProps {
  venue_id: string;
  incident_id: string | null;
}
```

**Internal state:** Reads `machine_state` and `corpus_hash_verified` from `useVenueDetail(venue_id)`.

**Guard logic:** When `machine_state === 'RECOVERED_BUT_UNTRUSTED'`, renders a blocked state banner: "Intervention blocked — corpus unverified. Verify corpus in Venue Operations before placing overrides." No controls are rendered.

**Renders (when not blocked):** Stub intervention controls. Write controls (L6 flow) are wired in EPIC-4 (Track E). At MVP, renders placeholder card: "Override controls — connect to incident to place overrides."

**Does NOT:** render actual write controls in Track D. This component is extended in EPIC-4.

---

### D-6: `LiveTimeline`

**Props:**
```typescript
interface LiveTimelineProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useQuery(['venue-timeline', venue_id])`. Refetches every 10s.

**Renders:** Scrollable feed of recent events. Each event: timestamp, event type label, description. Newest at top. Maximum 50 events displayed.

**Does NOT:** allow annotation or replay scrubbing.

---

### D-7: `LiveOpsVenueView`

**Props:**
```typescript
interface LiveOpsVenueViewProps {
  venue_id: string;
}
```

**Internal state:** Reads `active_incident_id` from `useUIStore()`.

**Renders:** Composes all Track D components vertically:
1. `VenueIdentityHeader`
2. `PlayerHealthSection`
3. `PRESummarySection`
4. `InterventionSurface` (passes `active_incident_id`)
5. `LiveTimeline`

**Does NOT:** render tabs. Live Ops is a single scrollable view.

---

## 6. Track E: Incident Command Surface (Week 3–4 — Engineer 2)

Runs parallel with Track D. All components live in `apps/cms-operator/src/surfaces/incident-command/`.

---

### E-1: React Query hooks

```typescript
// hooks/useIncident.ts
function useIncident(incident_id: string): UseQueryResult<Incident>

// hooks/useIncidentOverrides.ts
function useIncidentOverrides(incident_id: string): UseQueryResult<Override[]>

// hooks/useIncidentTransitions.ts
function useIncidentTransitions(incident_id: string): UseQueryResult<MachineStateTransition[]>

// hooks/useAssumeCommand.ts (mutation)
function useAssumeCommand(): UseMutationResult<void, ApiError, { incident_id: string }>

// hooks/useReleaseCommand.ts (mutation)
function useReleaseCommand(): UseMutationResult<void, ApiError, { incident_id: string }>
```

---

### E-2: `IncidentIdentityBar`

**Props:**
```typescript
interface IncidentIdentityBarProps {
  incident_id: string;
}
```

**Internal state:** Reads from `useIncident(incident_id)`.

**Renders (72px fixed bar):**
- `SeverityBadge` with incident severity
- State pill (OPEN / COMMANDER_LAPSED / RESOLVED text)
- `CountdownClock` showing incident duration (expires_at = null → elapsed timer using `opened_at`)
- Commander identity: "Commander: {name}" or "No commander" when null

**Does NOT:** allow actions. Read-only identity bar.

---

### E-3: `CommanderStatusCard`

**Props:**
```typescript
interface CommanderStatusCardProps {
  incident_id: string;
  current_operator_id: string;
}
```

**Internal state:** Reads from `useIncident(incident_id)`.

**Renders:** Current commander name + role. When `commander_id === null`, shows "No active commander." [Assume Command] button renders but is a stub (not wired until E-8 `AssumeCommandConfirmCard`). [Release Command] button renders when `commander_id === current_operator_id`, also stub until E-8.

**Does NOT:** make API calls directly. Defers to E-8.

---

### E-4: `ICTabSystem`

**Props:**
```typescript
interface ICTabSystemProps {
  incident_id: string;
  active_tab?: number;  // default: 1
  tab_badges?: {
    tab_3_override_count: number;    // red dot when > 0
    tab_4_advisory_count: number;    // amber dot when > 0
    tab_5_log_unread: boolean;       // green dot when true
  };
}
```

**Internal state:** `active_tab: number` (local if no prop provided).

**Tab definitions:**
| Tab | Label | Badge |
|-----|-------|-------|
| 1 | Overview | None |
| 2 | Shift Notes | None |
| 3 | Overrides | Red (PATCH-010) when override count > 0 |
| 4 | Advisories | Amber (PATCH-010) when advisory count > 0 |
| 5 | Activity Log | Green (PATCH-010) when unread |
| 6 | Resolution | None |

**Renders:** Tab strip with `TabBadge` components. Renders correct content component per active tab (passed as children or slot props).

---

### E-5: `ShiftNotesTab` (Tab 2)

**Props:**
```typescript
interface ShiftNotesTabProps {
  incident_id: string;
}
```

**Internal state:** Reads `shift_notes` from `useIncident(incident_id)`. Local state: `draft: string`.

**Renders (PATCH-008):** `<textarea>` labelled with ✎ icon. [Save] button fires mutation `PATCH /incidents/{id}/shift-notes`. [Clear] button resets draft to empty string with confirmation. Auto-saves on 2s idle debounce.

**Does NOT:** track individual note authors. Notes are a single shared text field per incident.

---

### E-6: `OverrideInventoryTab` (Tab 3)

**Props:**
```typescript
interface OverrideInventoryTabProps {
  incident_id: string;
}
```

**Internal state:** Reads from `useIncidentOverrides(incident_id)`.

**Renders:** List of active overrides. Each row: tier badge (L1–L6), content name, placed-by name, placed time, expires time. [Remove] button renders as a stub (not wired until E-10). Read-only at this step.

**Does NOT:** allow removal. Remove wiring is EPIC-4 (E-10).

---

### E-7: `CommanderLapsedAlert`

**Props:**
```typescript
interface CommanderLapsedAlertProps {
  incident_id: string;
  presence_count: number;
}
```

**Internal state:** `notify_cooldown: boolean` — true for 60s after [Notify all →] is clicked.

**Renders (PATCH-012):** Alert strip with "COMMANDER LAPSED — {presence_count} operator(s) present." [Notify all →] link fires `POST /incidents/{id}/notify-operators`. When `notify_cooldown === true`, link shows "Notified — wait 60s" and is disabled.

**Does NOT:** render when incident state is not `COMMANDER_LAPSED`. Caller is responsible for conditional rendering.

---

### E-8: `AssumeCommandConfirmCard`

**Props:**
```typescript
interface AssumeCommandConfirmCardProps {
  incident_id: string;
  current_operator_id: string;
  onSuccess: () => void;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** `submitting: boolean`.

**Renders (PATCH-003):** Context strip showing incident severity, venue name, and current state ("You are about to assume command of a S{N} incident at {venue}."). [Confirm — Assume Command] button (not `HoldToConfirmButton` — this is a standard confirm, not a destructive hold). On click: fires `useAssumeCommand()` mutation. On success: calls `onSuccess()`. On rejection: calls `onRejection(envelope)`.

**Does NOT:** manage the `RejectionToast` — caller renders it when `onRejection` fires.

---

### E-9: `L6OverridePlacementFlow` (EPIC-4)

**Props:**
```typescript
interface L6OverridePlacementFlowProps {
  incident_id: string;
  onSuccess: () => void;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** `submitting: boolean`, `selections: Record<string, string>` (received from `SequentialChipSelect.onComplete`).

**Renders:** `SequentialChipSelect` with three steps:
1. Select content category
2. Select specific content item
3. Select duration

On `SequentialChipSelect.onComplete`: fires `POST /overrides/l6` with selections. On success: calls `onSuccess()` + invalidates `queryKeys.incidentOverrides(incident_id)`. On rejection: calls `onRejection(envelope)`.

**Does NOT:** validate selections beyond what the API returns.

---

### E-10: `L6OverrideRemovalFlow` (EPIC-4)

**Props:**
```typescript
interface L6OverrideRemovalFlowProps {
  override_id: string;
  incident_id: string;
  content_name: string;
  onSuccess: () => void;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** `submitting: boolean`.

**Renders:** `HoldToConfirmButton` with label "Hold to remove: {content_name}". On `onConfirm`: fires `DELETE /overrides/{override_id}`. On success: calls `onSuccess()` + invalidates `queryKeys.incidentOverrides(incident_id)`. On rejection: calls `onRejection(envelope)`.

**Does NOT:** render confirmation modal — `HoldToConfirmButton`'s hold mechanic is the confirmation.

---

## 7. Track F: Venue Operations Surface (Week 3–4 — Engineer 1, after Track D)

All components live in `apps/cms-operator/src/surfaces/venue-ops/`.

---

### F-1: React Query hooks

```typescript
function useVenueOpsSummary(venue_id: string): UseQueryResult<Venue>

function useVenueStatus(venue_id: string): UseQueryResult<PlayerHealth>

function useVenueMachineStateHistory(venue_id: string): UseQueryResult<MachineStateTransition[]>

function useVenueCorpusStatus(venue_id: string): UseQueryResult<CorpusStatus>

// Mutation
function useVerifyCorpus(): UseMutationResult<void, ApiError, { venue_id: string }>
```

---

### F-2: `AutonomyClock`

**Props:**
```typescript
interface AutonomyClockProps {
  autonomy_expires_at: string;  // ISO 8601
}
```

**Internal state:** Internally uses `CountdownClock` logic (or composes `CountdownClock` directly).

**Color tiers (PATCH-011):**
- `> 24h` remaining: default display
- `6h–24h` remaining: amber (`#F57C00`)
- `< 6h` remaining: red (`#C62828`) with pulse animation

**Renders:** "Autonomy: {countdown}" with color-appropriate text. Composing `CountdownClock` is preferred over duplicating timer logic.

---

### F-3: `VenueOpsHeader`

**Props:**
```typescript
interface VenueOpsHeaderProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useVenueOpsSummary(venue_id)`.

**Renders:** Persistent non-scrolling header (64px):
- Venue name
- `MachineStateBadge` (full variant)
- `AutonomyClock`

**Does NOT:** scroll with content. Sticky positioning — always visible regardless of tab scroll position.

---

### F-4: `VenueStatusDashboard` (Tab 1)

**Props:**
```typescript
interface VenueStatusDashboardProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useVenueStatus(venue_id)`.

**Renders (PATCH-019 labels):**
- Section "Player Status": 4 cards (Sync State, Corpus Hash Match, Last Heartbeat, Uptime)
- Section "Signal Quality": 3 cards (Network Strength, Packet Loss, Latency)

Identical visual structure to `PlayerHealthSection` in Live Ops. Consider extracting shared card rendering logic to `@clubhub/ui` if duplication warrants it (engineering decision at implementation time).

---

### F-5: `MachineStateHistoryStrip` (Tab 5)

**Props:**
```typescript
interface MachineStateHistoryStripProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useVenueMachineStateHistory(venue_id)`.

**Renders (PATCH-020):** Vertical list of state transitions, newest first. Each row: from-state badge → to-state badge, transition timestamp, duration in previous state (computed from adjacent timestamps). Current state row shows elapsed time since transition.

**Does NOT:** allow filtering or searching history.

---

### F-6: `CorpusStatusTab` (Tab 3)

**Props:**
```typescript
interface CorpusStatusTabProps {
  venue_id: string;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** Reads from `useVenueCorpusStatus(venue_id)`. Reads `submitting` from `useVerifyCorpus()` mutation state.

**Renders:** Corpus hash (monospace, truncated to 12 chars). Verified/Unverified status badge. Last verified timestamp. [Re-verify] button → fires `POST /corpus-status/verify` with `{ venue_id }`. Button disabled when `verification_in_progress === true`. On rejection: calls `onRejection(envelope)`.

**Does NOT:** show verification progress in real-time (polling is used — refetch every 5s when `verification_in_progress === true`).

---

### F-7: `VenueOpsView`

**Props:**
```typescript
interface VenueOpsViewProps {
  venue_id: string;
}
```

**Internal state:** `active_tab: number` (default: 1).

**Tab definitions:**
| Tab | Label | Component |
|-----|-------|-----------|
| 1 | Status | `VenueStatusDashboard` |
| 2 | Corpus | `CorpusStatusTab` |
| 3 | History | `MachineStateHistoryStrip` |
| 4 | Settings | Stub ("Coming soon") |
| 5 | Machine States | `MachineStateHistoryStrip` |
| 6 | Autonomy | Read-only view of autonomy settings |

**Renders:** `VenueOpsHeader` (persistent) + 6-tab navigation + active tab content.

---

## 8. Track G: CMS Operations Surface (Week 4–5 — Engineer 2)

All components live in `apps/cms-operator/src/surfaces/cms-operations/`.

---

### G-1: React Query hooks

```typescript
function useCMSCalendar(venue_id: string, week: string): UseQueryResult<CMSSlot[]>
// `week` format: ISO week string, e.g. "2026-W23"

function useCMSDeliveryConfidence(venue_id: string): UseQueryResult<DeliveryConfidence>

function useCreateSlot(): UseMutationResult<CMSSlot, ApiError, SlotCreateInput>
interface SlotCreateInput {
  venue_id: string;
  content_id: string;
  scheduled_at: string;
  delivery_priority: DeliveryPriority;
}

function useContentLibrary(venue_id: string): UseQueryResult<ContentItem[]>
interface ContentItem {
  content_id: string;
  name: string;
  duration_seconds: number;
  type: string;
}
```

---

### G-2: `DeliveryWarningBanner`

**Props:**
```typescript
interface DeliveryWarningBannerProps {
  priority: DeliveryPriority;
  delivery_confidence: DeliveryConfidence;
}
```

**Internal state:** None.

**Rendering rules by variant (A-NEW-02):**
- `ROUTINE`: No banner rendered. Return null.
- `DEGRADED`: Amber banner ("Degraded delivery mode active — some content may arrive late.")
- `HIGH_PRIORITY`: Deep-orange banner ("HIGH PRIORITY delivery active — content must arrive by {datetime}.")

**Does NOT:** control its own visibility. Caller renders based on `priority`.

---

### G-3: `DeliveryConfidencePanel` (Tab 5)

**Props:**
```typescript
interface DeliveryConfidencePanelProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useCMSDeliveryConfidence(venue_id)`.

**Renders (A-NEW-02):**
- ROUTINE confidence: percentage meter (green when ≥ 90%, amber 70–89%, red < 70%)
- HIGH_PRIORITY: `CountdownClock` with `expires_at = delivery_confidence.high_priority_delivery_by`, color tiers matching CountdownClock spec
- Degraded mode active badge when `degraded_mode_active === true`

---

### G-4: `CMSCalendarGrid` (Tab 2)

**Props:**
```typescript
interface CMSCalendarGridProps {
  venue_id: string;
  week: string;  // ISO week string
  onSlotClick?: (slot: CMSSlot) => void;
  onEmptySlotClick?: (scheduled_at: string) => void;
}
```

**Internal state:** Reads from `useCMSCalendar(venue_id, week)`. Local state: `selected_slot_id: string | null`.

**Rendering rules:**
- 7-column grid (days of week), rows are time slots
- HIGH_PRIORITY slots sorted above ROUTINE slots within each day column
- HIGH_PRIORITY slots display `★ {content_name}` prefix
- DEGRADED slots display `~ {content_name}` prefix
- Empty slots are clickable (calls `onEmptySlotClick`) to trigger slot creation

**Does NOT:** handle slot creation directly. Delegates to `SlotCreateForm`.

---

### G-5: `SlotCreateForm`

**Props:**
```typescript
interface SlotCreateFormProps {
  venue_id: string;
  scheduled_at: string;  // pre-filled from calendar click
  onSuccess: (slot: CMSSlot) => void;
  onCancel: () => void;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** `selected_content_id: string | null`, `delivery_priority: DeliveryPriority` (default: 'ROUTINE'), `submitting: boolean`.

**Renders:**
- Content selector (reads `useContentLibrary(venue_id)`)
- Scheduled time display (read-only, pre-filled)
- `delivery_priority` selector: checkbox "Mark as HIGH_PRIORITY" (ROUTINE when unchecked)
- `DeliveryWarningBanner` rendered inline when HIGH_PRIORITY selected
- [Create Slot] button → fires `useCreateSlot()` mutation

---

### G-6: `ContentLibraryTab` (Tab 1)

**Props:**
```typescript
interface ContentLibraryTabProps {
  venue_id: string;
}
```

**Internal state:** Reads from `useContentLibrary(venue_id)`. Local state: `search_query: string`.

**Renders:** Searchable list of content items. Each row: content name, type, duration. Read-only at MVP. No upload, no edit.

---

### G-7: `TrainingModeToggle`

**Props:**
```typescript
interface TrainingModeToggleProps {
  current_training_mode: boolean;
  onSuccess: () => void;
  onRejection: (rejection: RejectionEnvelope) => void;
}
```

**Internal state:** `show_confirm_modal: boolean`, `submitting: boolean`.

**Authority guard:** Reads `role` from `useAuthStore()`. Renders nothing when `role` is not `CONTENT_MANAGER`, `VENUE_MANAGER`, or `ADMIN`. Does not render a disabled button — renders null.

**Behavior (PATCH-006):**
- Toggle switch shows current state
- When toggling from OFF to ON: sets `show_confirm_modal = true` before submitting
- Modal: "Enabling training mode will pause all live content delivery. Confirm?" with [Cancel] and [Enable Training Mode]
- On confirm: fires `POST /training-mode/enable` or `/disable`
- On success: calls `onSuccess()` + calls `setTrainingMode()` in UIState

---

## 9. Track H: Replay Investigation Surface (Week 6+ — DEFERRED)

All Track H components are DEFERRED. Do not begin implementation until MVP (Tracks A–G) has shipped to production and been validated.

The following components are defined architecturally but carry NO implementation commitment in the current release.

| Component | Status | Reason for Deferral |
|-----------|--------|---------------------|
| `ReplaySessionHeader` | DEFERRED | Requires replay corpus infrastructure (A6) operational in production |
| `ReplayTransportControls` | DEFERRED | Depends on ReplaySessionHeader |
| `TimelineScrubber` | DEFERRED | Complex collaborator sync; no MVP requirement |
| `AnnotationsTab` | DEFERRED | Annotation model (R-07) not yet resolved |
| `CollaboratorScrubberPips` | DEFERRED | Depends on TimelineScrubber |
| `PresenceAvatars` | DEFERRED | Defined in Track B but not built until Track H begins |

**Blocker A-07 (VIEWER/IC authority on replay):** Must be resolved before Track H begins.
**Blocker R-07 (trust_state_at_event corpus field):** Must be available in replay packets before AnnotationsTab can be built.
**Blocker A-11 (Venue Ops route in replay context):** Must be resolved before cross-surface replay navigation is implemented.

When Track H begins, start with `PresenceAvatars` (B-11, already designed), then `ReplaySessionHeader`, then `ReplayTransportControls`, then `TimelineScrubber` + `CollaboratorScrubberPips` in parallel, then `AnnotationsTab`.

---

## 10. Parallel Development Matrix

The table below shows which work each engineer owns in each week and what shared outputs must be available at week end.

| Week | Engineer 1 | Engineer 2 | Required at end of week |
|------|-----------|-----------|------------------------|
| 1 | `@clubhub/types` (A1-1) → `@clubhub/api` base fetch (A1-2) → `@clubhub/api` WS client (A1-3) | `@clubhub/state` React Query config (A2-1) → Zustand auth store (A2-2) → Zustand UI store (A2-3) → Zustand WS store (A2-4) | Types merged and published to workspace. API client base callable. State stores importable. |
| 2 | `SeverityBadge` → `MachineStateBadge` → `TabBadge` → `CountdownClock` → `AdvisoryCard` → `TrainingModeBanner` → `ReplayBanner` → `HoldToConfirmButton` → `SequentialChipSelect` → `RejectionToast` (Track B, B1–B10) | `ShellLayout` → `SystemStatusBar` → `ZoneC` → `ZoneA` → `ZoneAVenueSelector` → `ZoneAIncidentList` (Track C, C1–C6) | All `@clubhub/ui` components available for chrome. Shell scaffold renders without errors. Venue list visible in Zone A. |
| 3 | React Query hooks (D-1) → `VenueIdentityHeader` (D-2) → `PlayerHealthSection` (D-3) → `PRESummarySection` (D-4) → `InterventionSurface` stub (D-5) → `LiveTimeline` (D-6) → `LiveOpsVenueView` (D-7) | `ZoneANotificationTray` (C-7) → `ZoneAOperatorTools` (C-8) → `ZoneBAutoReplace` (C-9) → React Query hooks (E-1) → `IncidentIdentityBar` (E-2) → `CommanderStatusCard` (E-3) → `ICTabSystem` (E-4) | Live Ops surface fully navigable. `useVenueList()` hook available for Zone A. Chrome complete. |
| 4 | React Query hooks (F-1) → `AutonomyClock` (F-2) → `VenueOpsHeader` (F-3) → `VenueStatusDashboard` (F-4) → `MachineStateHistoryStrip` (F-5) → `CorpusStatusTab` (F-6) → `VenueOpsView` (F-7) | `ShiftNotesTab` (E-5) → `OverrideInventoryTab` stub (E-6) → `CommanderLapsedAlert` (E-7) → `AssumeCommandConfirmCard` (E-8) → `L6OverridePlacementFlow` EPIC-4 (E-9) | Override write hooks available. Assume command flow complete and testable. Venue Ops surface fully navigable. |
| 5 | React Query hooks (G-1) → `DeliveryWarningBanner` (G-2) → `DeliveryConfidencePanel` (G-3) → `CMSCalendarGrid` (G-4) → `SlotCreateForm` (G-5) → `ContentLibraryTab` (G-6) → `TrainingModeToggle` (G-7) | `L6OverrideRemovalFlow` EPIC-4 (E-10) → rejection UX integration across all write flows → EPIC-4 certification | All MVP write flows complete. `RejectionToast` integrated at every mutation site. |
| 6 | Advisory tray (Track H partial — only if blockers A-07/R-07/A-11 are resolved) | ADMIN role guards, audit trail surfaces (EPIC-9 partial) | MVP cutline satisfied. Tracks A–G in production. Track H gated on blocker resolution. |

**Hand-off contract between engineers:**

Before Engineer 2 can begin Track C chrome work, Engineer 1 must deliver:
- `@clubhub/types` merged and importable (`import type { MachineState } from '@clubhub/types'` works)
- `@clubhub/api` base fetch wrapper callable with typed response

Before either engineer can begin surface work (Tracks D/E), both must deliver:
- All `@clubhub/ui` components B1–B10 merged (Engineer 1)
- Full chrome scaffold C1–C9 merged (Engineer 2)
- Both Zustand stores and React Query config importable

---

## 11. Reuse Opportunities

The following components are used across multiple surfaces. Engineering team should verify each instance uses the same import from `@clubhub/ui` — never copy-paste component implementations.

### `SeverityBadge`

| Usage site | Context |
|-----------|---------|
| `ZoneAIncidentList` | Row prefix per incident |
| `IncidentIdentityBar` | Primary identity element (72px bar) |
| `ICTabSystem` | Tab badge when severity is S1 (Tab 1 context) |

---

### `MachineStateBadge`

| Usage site | Variant | Notes |
|-----------|---------|-------|
| `ZoneAVenueSelector` | `dot` | Color dot only; no label |
| `VenueIdentityHeader` | `full` | With label |
| `VenueOpsHeader` | `full` | With label; persistent header |

The LIVE—UNVERIFIED override (PATCH-009) must fire in all three usages when `machine_state === 'RECOVERED_BUT_UNTRUSTED'`. Verify this in `MachineStateBadge` tests — not in each consumer.

---

### `CountdownClock`

| Usage site | `expires_at` source | Notes |
|-----------|-------------------|-------|
| `AutonomyClock` | `Venue.autonomy_expires_at` | Color tiers per PATCH-011 |
| `DeliveryConfidencePanel` | `DeliveryConfidence.high_priority_delivery_by` | Only rendered in HIGH_PRIORITY mode |
| `IncidentIdentityBar` | Elapsed timer (duration, not expiry) | For elapsed duration: set `expires_at` to `opened_at + large_value` and display elapsed instead of remaining |

Note for `IncidentIdentityBar`: elapsed duration display requires a wrapper component that inverts the countdown direction. Do not modify `CountdownClock` to add an `elapsed` mode — build a thin `ElapsedTimer` wrapper that uses the same `setInterval` pattern.

---

### `HoldToConfirmButton`

| Usage site | `label` | `destructive` | Notes |
|-----------|---------|--------------|-------|
| `L6OverrideRemovalFlow` (IC) | "Hold to remove: {content_name}" | true | 3s hold |
| Screen decommission (Venue Ops, EPIC-9) | "Hold to decommission screen" | true | 3s hold |

---

### `SequentialChipSelect`

| Usage site | Steps | Notes |
|-----------|-------|-------|
| `L6OverridePlacementFlow` | 3 (category → content → duration) | Only current usage; built as reusable |

---

### `RejectionToast`

Every mutation site must handle rejections via `RejectionToast`. The pattern is:

```typescript
// In each write-flow component that calls a mutation:
const [rejection, setRejection] = useState<RejectionEnvelope | null>(null);

// On mutation error:
onRejection: (r) => setRejection(r)

// In render:
{rejection && (
  <RejectionToast
    rejection={rejection}
    onDismiss={() => setRejection(null)}
  />
)}
```

**Mutation sites that must integrate `RejectionToast`:**

| Component | Mutation |
|-----------|---------|
| `AssumeCommandConfirmCard` | Assume command |
| `L6OverridePlacementFlow` | POST /overrides/l6 |
| `L6OverrideRemovalFlow` | DELETE /overrides/{id} |
| `CorpusStatusTab` | POST /corpus-status/verify |
| `SlotCreateForm` | POST /cms/slots |
| `TrainingModeToggle` | POST /training-mode/enable|disable |
| `ShiftNotesTab` | PATCH /incidents/{id}/shift-notes |

---

### `TabBadge`

| Usage site | Tab | Dot type | Trigger |
|-----------|-----|---------|---------|
| `ICTabSystem` | Tab 3 (Overrides) | Red | Override count > 0 |
| `ICTabSystem` | Tab 4 (Advisories) | Amber | Advisory count > 0 |
| `ICTabSystem` | Tab 5 (Activity Log) | Green | Unread entries present |
| Future `ReplayTabSystem` | TBD | TBD | DEFERRED |

---

## Appendix A: Component Ownership Summary

| Component | Package / Directory | Track | Week |
|-----------|-------------------|-------|------|
| All TypeScript interfaces | `@clubhub/types` | A1 | 1 |
| Base fetch wrapper | `@clubhub/api` | A1 | 1 |
| WebSocket client | `@clubhub/api` | A1 | 1 |
| React Query config | `@clubhub/state` | A2 | 1 |
| Zustand auth store | `@clubhub/state` | A2 | 1 |
| Zustand UI store | `@clubhub/state` | A2 | 1 |
| Zustand WS store | `@clubhub/state` | A2 | 1 |
| `SeverityBadge` | `@clubhub/ui` | B | 2 |
| `MachineStateBadge` | `@clubhub/ui` | B | 2 |
| `TabBadge` | `@clubhub/ui` | B | 2 |
| `CountdownClock` | `@clubhub/ui` | B | 2 |
| `AdvisoryCard` | `@clubhub/ui` | B | 2 |
| `TrainingModeBanner` | `@clubhub/ui` | B | 2 |
| `ReplayBanner` | `@clubhub/ui` | B | 2 |
| `HoldToConfirmButton` | `@clubhub/ui` | B | 2 |
| `SequentialChipSelect` | `@clubhub/ui` | B | 2 |
| `RejectionToast` | `@clubhub/ui` | B | 2 |
| `PresenceAvatars` | `@clubhub/ui` | H | DEFERRED |
| `ShellLayout` | `apps/cms-operator/chrome/` | C | 2 |
| `SystemStatusBar` | `apps/cms-operator/chrome/` | C | 2 |
| `ZoneC` | `apps/cms-operator/chrome/` | C | 2 |
| `ZoneA` | `apps/cms-operator/chrome/` | C | 2 |
| `ZoneAVenueSelector` | `apps/cms-operator/chrome/` | C | 2 |
| `ZoneAIncidentList` | `apps/cms-operator/chrome/` | C | 2 |
| `ZoneANotificationTray` | `apps/cms-operator/chrome/` | C | 3 |
| `ZoneAOperatorTools` | `apps/cms-operator/chrome/` | C | 3 |
| `ZoneBAutoReplace` | `apps/cms-operator/chrome/` | C | 3 |
| `LiveOpsVenueView` | `surfaces/live-ops/` | D | 3 |
| `VenueIdentityHeader` | `surfaces/live-ops/` | D | 3 |
| `PlayerHealthSection` | `surfaces/live-ops/` | D | 3 |
| `PRESummarySection` | `surfaces/live-ops/` | D | 3 |
| `InterventionSurface` | `surfaces/live-ops/` | D | 3 |
| `LiveTimeline` | `surfaces/live-ops/` | D | 3 |
| `IncidentIdentityBar` | `surfaces/incident-command/` | E | 3 |
| `CommanderStatusCard` | `surfaces/incident-command/` | E | 3 |
| `ICTabSystem` | `surfaces/incident-command/` | E | 3 |
| `ShiftNotesTab` | `surfaces/incident-command/` | E | 4 |
| `OverrideInventoryTab` | `surfaces/incident-command/` | E | 4 |
| `CommanderLapsedAlert` | `surfaces/incident-command/` | E | 4 |
| `AssumeCommandConfirmCard` | `surfaces/incident-command/` | E | 4 |
| `L6OverridePlacementFlow` | `surfaces/incident-command/` | E/EPIC-4 | 5 |
| `L6OverrideRemovalFlow` | `surfaces/incident-command/` | E/EPIC-4 | 5 |
| `AutonomyClock` | `surfaces/venue-ops/` | F | 4 |
| `VenueOpsHeader` | `surfaces/venue-ops/` | F | 4 |
| `VenueStatusDashboard` | `surfaces/venue-ops/` | F | 4 |
| `MachineStateHistoryStrip` | `surfaces/venue-ops/` | F | 4 |
| `CorpusStatusTab` | `surfaces/venue-ops/` | F | 4 |
| `VenueOpsView` | `surfaces/venue-ops/` | F | 4 |
| `DeliveryWarningBanner` | `surfaces/cms-operations/` | G | 5 |
| `DeliveryConfidencePanel` | `surfaces/cms-operations/` | G | 5 |
| `CMSCalendarGrid` | `surfaces/cms-operations/` | G | 5 |
| `SlotCreateForm` | `surfaces/cms-operations/` | G | 5 |
| `ContentLibraryTab` | `surfaces/cms-operations/` | G | 5 |
| `TrainingModeToggle` | `surfaces/cms-operations/` | G | 5 |
| `ReplaySessionHeader` | `surfaces/replay-investigation/` | H | DEFERRED |
| `ReplayTransportControls` | `surfaces/replay-investigation/` | H | DEFERRED |
| `TimelineScrubber` | `surfaces/replay-investigation/` | H | DEFERRED |
| `AnnotationsTab` | `surfaces/replay-investigation/` | H | DEFERRED |
| `CollaboratorScrubberPips` | `surfaces/replay-investigation/` | H | DEFERRED |

---

## Appendix B: Definition of Done Per Component

A component is not done until all of the following are true:

1. TypeScript compiles with zero errors and zero `any` casts (except explicitly approved exceptions)
2. Props interface is exported alongside the component
3. Component renders correctly in Storybook with at least: default state, loading state (if applicable), error/empty state (if applicable), and all visual variants
4. For components that manage state: state transitions are tested (React Testing Library)
5. For write-flow components: mutation success path and rejection path are both tested
6. For components that use `setInterval` or `requestAnimationFrame`: cleanup is verified in tests (no "can't perform state update on unmounted component" warnings)
7. `RejectionToast` integration is present at every mutation site
8. No direct API calls (`fetch()`) — all API interaction goes through `@clubhub/api` or React Query hooks

---

*Document owner: Frontend engineering lead. Update this document when new components are added or build order changes. Do not defer updates — stale build order causes parallel work conflicts.*
