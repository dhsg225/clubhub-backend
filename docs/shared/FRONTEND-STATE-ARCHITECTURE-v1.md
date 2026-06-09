# FRONTEND-STATE-ARCHITECTURE-v1

**ClubHub TV Operator Platform — Frontend State Architecture**
**Status:** AUTHORITATIVE
**Audience:** Frontend engineers implementing the CMS operator surfaces
**Date:** 2026-06-03

---

## 0. Purpose and Scope

This document defines the complete frontend state architecture for the ClubHub TV operator platform. It governs how state is structured, owned, initialized, updated, and invalidated across all five operator surfaces. Every TypeScript interface defined here is normative. Deviations require an Architecture Decision Record.

This document does not cover component structure, routing, or visual design — see COMPONENT-TAXONOMY-v1, ROUTES-AND-NAVIGATION-v1, and the surface-specific wireframe specs.

---

## 1. State Architecture Overview

### 1.1 Two-Layer Model

The frontend uses a strict two-layer state model. The layers have distinct ownership rules and must not be conflated.

**Layer 1 — Server State (React Query)**

Server state is data that originates on the server and is cached locally for rendering. React Query manages fetching, caching, staleness, and background refresh. The frontend is a consumer of server state, not its source of truth.

What lives here:
- Venue entity data (machine state, corpus hash, autonomy status)
- Incident entity data (incident metadata, event log, override list)
- Corpus delivery schedules and slots
- Fleet health snapshots
- Annotation lists (replay surface)
- PRE resolution state per venue

What does NOT live here:
- Operator actions in flight
- Rejection responses (never cached — consumed and discarded)
- Audit events (write-through only, never read back into cache)
- WebSocket push payloads (applied directly to cache, not stored separately)

**Layer 2 — Client State (Zustand or Redux Toolkit)**

Client state is UI-owned state that has no server-side counterpart, or session-scoped state that drives rendering logic. Client state must not duplicate server state — if an entity exists in React Query, the client store holds only its identifier, not a copy.

What lives here:
- Auth context (operator_id, role, session_id, permissions)
- System constitutional state and status bar indicators
- Active incident identifiers and severity summary
- Notification queue and unread count
- Zone layout state (Zone C collapsed, active surface)
- Training mode flag
- Surface-specific transient state (selected venue, tab index, transport state)
- `is_replay_mode` enforcement flag
- Commander lapsed countdown (derived from server timestamp)
- Autonomy clock countdown (derived from server timestamp)

### 1.2 State Ownership Rules

Each state slice has exactly one owning module. No module may write to another module's slice directly. Cross-slice communication uses events or selectors.

| Slice | Owner | Layer |
|---|---|---|
| `auth` | `AuthStore` | Client |
| `systemHealth` | `SystemHealthStore` | Client |
| `activeIncidents` | `IncidentStore` | Client |
| `notifications` | `NotificationStore` | Client |
| `ui` | `UIStore` | Client |
| `liveOps` | `LiveOpsStore` | Client |
| `incidentWorkspace` | `IncidentWorkspaceStore` | Client |
| `replay` | `ReplayStore` | Client |
| `cms` | `CMSStore` | Client |
| `venueOps` | `VenueOpsStore` | Client |
| `venues` (entities) | React Query `['venues', ...]` | Server |
| `incidents` (entities) | React Query `['incidents', ...]` | Server |
| `corpus` (entities) | React Query `['corpus', ...]` | Server |
| `fleet` (snapshots) | React Query `['fleet', ...]` | Server |
| `annotations` | React Query `['annotations', ...]` | Server |

### 1.3 Immutability Contract

All client state updates must produce new object references. Mutations in place are forbidden. Zustand's `immer` middleware or RTK's Immer integration satisfies this requirement.

---

## 2. Global State

Global state is shared across all five operator surfaces. It initializes on app load and persists for the session lifetime. Surface changes do not teardown global state.

### 2.1 AuthState

```typescript
type OperatorRole = 'VIEWER' | 'OPERATOR' | 'CONTENT_MANAGER' | 'ADMIN';

interface AuthState {
  operator_id: string;
  display_name: string;
  role: OperatorRole;
  session_id: string;
  permissions: string[];
  session_expires_at: string; // ISO 8601 UTC
  authenticated: boolean;
}

interface AuthStore {
  state: AuthState | null;
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  isAtLeast: (minimum_role: OperatorRole) => boolean;
}
```

**Role hierarchy for `isAtLeast`:** VIEWER < OPERATOR < CONTENT_MANAGER < ADMIN.

**Absent-not-disabled rule:** The `hasPermission` and `isAtLeast` helpers are used exclusively to determine whether to render a control at all. Do not pass `disabled={!hasPermission(...)}` to components. If the operator lacks the permission, the control element must be absent from the DOM.

### 2.2 SystemHealthState

```typescript
type ConstitutionalState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CONSTITUTIONAL_RISK'
  | 'EMERGENCY_FREEZE'
  | 'SHADOW_ONLY'
  | 'PRE_DISABLED'
  | 'READ_ONLY';

type StatusBarIndicatorStatus = 'OK' | 'WARN' | 'ERROR' | 'UNKNOWN';

interface StatusBarIndicator {
  key: string;
  label: string;
  status: StatusBarIndicatorStatus;
  detail: string | null;
  last_updated: string; // ISO 8601 UTC
}

interface SystemHealthState {
  constitutional_state: ConstitutionalState;
  status_bar: Record<string, StatusBarIndicator>;
  last_updated: string; // ISO 8601 UTC
  degraded_since: string | null; // ISO 8601 UTC — set when state != HEALTHY
}

interface SystemHealthStore {
  state: SystemHealthState;
  applyHealthPush: (push: SystemHealthPush) => void;
  isWritePermitted: () => boolean; // false when constitutional_state is EMERGENCY_FREEZE, READ_ONLY, or PRE_DISABLED
}
```

**`isWritePermitted` must be checked in addition to role checks before dispatching any write operation.** Constitutional state overrides role-based permissions — an ADMIN cannot write during `EMERGENCY_FREEZE`.

### 2.3 ActiveIncidentsState

```typescript
type IncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

interface IncidentSummary {
  incident_id: string;
  venue_id: string;
  severity: IncidentSeverity;
  title: string;
  opened_at: string; // ISO 8601 UTC
  has_active_commander: boolean;
  commander_lapsed: boolean;
}

interface ActiveIncidentsState {
  incidents: IncidentSummary[];
  highest_severity: IncidentSeverity | null;
  s1_s2_active: boolean; // true when any S1 or S2 incident is open
  last_updated: string; // ISO 8601 UTC
}

interface ActiveIncidentsStore {
  state: ActiveIncidentsState;
  applyIncidentPush: (push: IncidentListPush) => void;
  getIncidentsByVenue: (venue_id: string) => IncidentSummary[];
}
```

**`s1_s2_active` drives Zone B auto-replace.** When this transitions from `false` to `true`, `UIStore.setActiveSurface('INCIDENT_COMMAND')` must fire for all OPERATOR+ users. See Section 10.3.

### 2.4 NotificationState

```typescript
type NotificationClass = 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';

interface Notification {
  notification_id: string;
  advisory_level: NotificationClass; // maps to A-NEW-01 advisory levels
  title: string;
  body: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  received_at: string; // ISO 8601 UTC — server timestamp, never client clock
  read: boolean;
  acknowledged: boolean; // URGENT notifications require explicit acknowledgment
  expires_at: string | null; // ISO 8601 UTC — null means persistent
}

interface NotificationState {
  notifications: Notification[];
  unread_count: number;
  urgent_unacknowledged_count: number;
}

interface NotificationStore {
  state: NotificationState;
  addNotification: (n: Notification) => void;
  markRead: (notification_id: string) => void;
  acknowledge: (notification_id: string) => void; // URGENT only
  dismiss: (notification_id: string) => void; // non-URGENT only
  clearExpired: () => void; // called on timer, uses server expires_at not client clock
}
```

**URGENT advisory notifications must not be dismissible without acknowledgment.** The dismiss action is unavailable (absent from DOM) for `advisory_level === 'URGENT'` until `acknowledged === true`.

### 2.5 UIState

```typescript
type SurfaceId =
  | 'LIVE_OPS'
  | 'INCIDENT_COMMAND'
  | 'REPLAY_INVESTIGATION'
  | 'CMS_CONTENT_OPS'
  | 'VENUE_OPS';

interface UIState {
  zone_c_collapsed: boolean;
  active_surface: SurfaceId;
  prior_surface: SurfaceId | null; // set on Zone B auto-replace for "back" link (PATCH-014)
  training_mode: boolean;
  force_replaced_surface: boolean; // true when active_surface was set by S1/S2 auto-replace
}

interface UIStore {
  state: UIState;
  setActiveSurface: (surface: SurfaceId, force?: boolean) => void;
  toggleZoneC: () => void;
  setZoneCCollapsed: (collapsed: boolean) => void;
  setTrainingMode: (enabled: boolean) => void;
  clearForcedSurface: () => void; // called when operator navigates away from auto-replaced surface
}
```

**`prior_surface` is set only when `force === true`.** When an operator manually navigates, `prior_surface` is not updated and `force_replaced_surface` is set to `false`.

---

## 3. Workspace State (Per-Surface)

Workspace state is surface-scoped. It is initialized when the operator enters the surface and may be torn down when the operator navigates away (implementation choice), but global state must never be affected. Surface stores must not hold copies of server entity data — only identifiers and view configuration.

### 3.1 LiveOpsState

```typescript
type LiveOpsViewMode = 'FLEET_VIEW' | 'SINGLE_VENUE_VIEW';

interface LiveOpsState {
  view_mode: LiveOpsViewMode;
  selected_venue_id: string | null; // null in FLEET_VIEW
  fleet_filter: {
    machine_states: MachineState[]; // empty array = show all
    severity_minimum: IncidentSeverity | null;
  };
  venue_detail_expanded_panel: 'NONE' | 'INCIDENTS' | 'CORPUS' | 'HARDWARE';
  last_selected_venue_id: string | null; // preserved for UX continuity on return
}

interface LiveOpsStore {
  state: LiveOpsState;
  setViewMode: (mode: LiveOpsViewMode) => void;
  selectVenue: (venue_id: string) => void;
  clearVenueSelection: () => void;
  setFleetFilter: (filter: Partial<LiveOpsState['fleet_filter']>) => void;
  setDetailPanel: (panel: LiveOpsState['venue_detail_expanded_panel']) => void;
}
```

**Venue entity data is not stored here.** Use `useQuery(['venues', venue_id])` for venue details. `LiveOpsStore` holds only the identifier and view configuration.

### 3.2 IncidentWorkspaceState

```typescript
type IncidentTabIndex = 0 | 1 | 2 | 3 | 4 | 5;
// Tab 0: Overview, Tab 1: Timeline, Tab 2: Overrides,
// Tab 3: PRE State, Tab 4: Shift Notes, Tab 5: Forensics

interface CommanderStatus {
  claimed: boolean;
  commander_operator_id: string | null;
  claimed_at: string | null; // ISO 8601 UTC — server timestamp
  lapsed_at: string | null; // ISO 8601 UTC — server timestamp; null if not lapsed
  claim_expires_at: string | null; // ISO 8601 UTC — server timestamp
}

interface IncidentWorkspaceState {
  active_incident_id: string | null;
  commander_status: CommanderStatus | null; // null when no incident loaded
  tab_index: IncidentTabIndex;
  shift_notes_dirty: boolean; // true when local edits not yet persisted
  override_list_sequence: number; // last applied sequence number from server
  pre_resolution_level: PRELevel | null; // L0-L6
  claim_in_flight: boolean; // true during commander claim request; see Section 4.3
}

interface IncidentWorkspaceStore {
  state: IncidentWorkspaceState;
  loadIncident: (incident_id: string) => void;
  setTabIndex: (tab: IncidentTabIndex) => void;
  applyCommanderPush: (push: CommanderStatusPush) => void;
  applyOverridePush: (push: OverrideListPush) => void;
  setShiftNotesDirty: (dirty: boolean) => void;
  setClaiming: (in_flight: boolean) => void;
}
```

### 3.3 ReplayState

```typescript
type ReplayTransportState = 'PAUSED' | 'REPLAYING' | 'SCRUBBING';
type PRELevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

interface ReplayCollaborator {
  operator_id: string;
  display_name: string;
  avatar_color: string; // CSS hex color assigned at session join
  timeline_position_ms: number;
  last_seen_at: string; // ISO 8601 UTC — server timestamp
}

interface ReplayAnnotation {
  annotation_id: string;
  operator_id: string;
  display_name: string;
  timeline_position_ms: number;
  body: string;
  server_received_at: string; // ISO 8601 UTC — sort key; never use client timestamp
  annotation_type: 'OBSERVATION' | 'FINDING' | 'COUNTERFACTUAL';
  // COUNTERFACTUAL type is restricted to ADMIN role — see absent-not-disabled rule
}

interface ContradictionPair {
  annotation_a_id: string;
  annotation_b_id: string;
  detected_at: string; // ISO 8601 UTC
  description: string;
}

interface ReplayState {
  session_id: string | null;
  corpus_id: string | null;
  timeline_duration_ms: number;
  timeline_position_ms: number;
  transport_state: ReplayTransportState;
  playback_speed: 0.5 | 1 | 2 | 4;
  collaborators: ReplayCollaborator[];
  annotations: ReplayAnnotation[]; // sorted by server_received_at ascending
  contradiction_pairs: ContradictionPair[];
  is_replay_mode: boolean; // IC-03 enforcement flag — see Section 5
}

interface ReplayStore {
  state: ReplayState;
  loadSession: (session_id: string, corpus_id: string, duration_ms: number) => void;
  setTransportState: (ts: ReplayTransportState) => void;
  scrubTo: (position_ms: number) => void;
  setSpeed: (speed: ReplayState['playback_speed']) => void;
  applyCollaboratorPush: (push: CollaboratorPositionPush) => void;
  applyAnnotationPush: (push: AnnotationPush) => void;
  applyContradictionPush: (push: ContradictionPush) => void;
  endSession: () => void;
}
```

**`is_replay_mode` is set to `true` on `loadSession` and is NEVER cleared by any action while the replay surface is mounted.** See Section 5 for the complete IC-03 enforcement contract.

### 3.4 CMSState

```typescript
type CMSTabId = 'CALENDAR' | 'DELIVERY' | 'CORPUS' | 'APPROVALS';
type CalendarViewMode = 'WEEK' | 'DAY' | 'MONTH';
type DeliveryPriority = 'ROUTINE' | 'DEGRADED' | 'HIGH_PRIORITY'; // A-NEW-02

interface CMSState {
  active_tab: CMSTabId;
  calendar_view: CalendarViewMode;
  selected_slot_id: string | null;
  selected_corpus_id: string | null;
  delivery_priority_filter: DeliveryPriority | 'ALL';
  venue_scope: string | null; // null = all venues the operator has access to
  pending_delivery_count: number; // summary counter from server push
}

interface CMSStore {
  state: CMSState;
  setTab: (tab: CMSTabId) => void;
  setCalendarView: (view: CalendarViewMode) => void;
  selectSlot: (slot_id: string | null) => void;
  selectCorpus: (corpus_id: string | null) => void;
  setDeliveryPriorityFilter: (filter: CMSState['delivery_priority_filter']) => void;
  setVenueScope: (venue_id: string | null) => void;
  applyDeliveryCountPush: (count: number) => void;
}
```

### 3.5 VenueOpsState

```typescript
type VenueOpsTabId = 'OVERVIEW' | 'SCREENS' | 'HARDWARE' | 'CORPUS' | 'HISTORY';
type MachineState =
  | 'INITIALIZING'
  | 'SYNCING'
  | 'LIVE'
  | 'INCIDENT'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'RECOVERED_BUT_UNTRUSTED';

interface AutonomyStatus {
  autonomy_active: boolean;
  autonomy_expires_at: string | null; // ISO 8601 UTC — server timestamp; render countdown from this
  last_server_contact_at: string; // ISO 8601 UTC
  hours_remaining: number | null; // server-computed; use for initial display only
}

interface VenueOpsState {
  venue_id: string | null;
  active_tab: VenueOpsTabId;
  machine_state: MachineState | null;
  autonomy_status: AutonomyStatus | null;
  selected_screen_id: string | null;
  enrollment_in_progress: boolean;
}

interface VenueOpsStore {
  state: VenueOpsState;
  loadVenue: (venue_id: string) => void;
  setTab: (tab: VenueOpsTabId) => void;
  applyMachineStatePush: (push: MachineStatePush) => void;
  applyAutonomyPush: (push: AutonomyStatusPush) => void;
  selectScreen: (screen_id: string | null) => void;
  setEnrollmentInProgress: (in_progress: boolean) => void;
}
```

---

## 4. Incident State (Detailed)

Incidents are the highest-stakes state in the system. The full entity schema, lifecycle, commander claim rules, and COMMANDER_LAPSED handling are specified here.

### 4.1 Incident Entity Schema

```typescript
type IncidentStatus = 'OPEN' | 'COMMANDER_CLAIMED' | 'ESCALATED' | 'RESOLVING' | 'CLOSED';
type IncidentEventType =
  | 'OPENED'
  | 'COMMANDER_CLAIMED'
  | 'COMMANDER_LAPSED'
  | 'OVERRIDE_PLACED'
  | 'OVERRIDE_REMOVED'
  | 'SEVERITY_CHANGED'
  | 'NOTE_ADDED'
  | 'RESOLVED'
  | 'CLOSED';

interface IncidentEvent {
  event_id: string;
  event_type: IncidentEventType;
  operator_id: string | null; // null for system-generated events
  occurred_at: string; // ISO 8601 UTC — server timestamp
  payload: Record<string, unknown>;
}

interface OverrideEntry {
  override_id: string;
  pre_level: PRELevel;
  operator_id: string;
  placed_at: string; // ISO 8601 UTC
  expires_at: string | null;
  venue_id: string;
  screen_ids: string[]; // empty = venue-wide
  content_id: string;
  reason: string;
  active: boolean;
  sequence_number: number; // monotonic — used for stale detection
}

interface Incident {
  incident_id: string;
  venue_id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  opened_at: string; // ISO 8601 UTC
  closed_at: string | null; // ISO 8601 UTC
  commander_operator_id: string | null;
  commander_claimed_at: string | null; // ISO 8601 UTC
  commander_claim_expires_at: string | null; // ISO 8601 UTC
  commander_lapsed_at: string | null; // ISO 8601 UTC — server-set when claim expires without renewal
  events: IncidentEvent[];
  overrides: OverrideEntry[];
  pre_resolution_level: PRELevel;
  shift_notes_id: string | null; // foreign key to server-persisted shift notes entity
  sequence_number: number; // monotonic — used for stale detection
}
```

### 4.2 Incident Lifecycle

Incident state transitions are received exclusively via WebSocket push. The client must not infer state transitions from user actions.

**Lifecycle flow:**

1. `OPENED` — incident created by system or OPERATOR+. `IncidentStore.applyIncidentPush` adds to `ActiveIncidentsState.incidents`.
2. `COMMANDER_CLAIMED` — push received with `commander_operator_id` and `commander_claimed_at`. Apply to React Query cache `['incidents', incident_id]` and to `IncidentWorkspaceStore.commander_status`.
3. `COMMANDER_LAPSED` — push received with `commander_lapsed_at`. `commander_operator_id` set to `null`. `CommanderStatus.lapsed_at` set from server push field — never computed on client.
4. `OVERRIDE_PLACED` / `OVERRIDE_REMOVED` — apply to `overrides` array in cache. Discard if `push.sequence_number <= current override_list_sequence`.
5. `SEVERITY_CHANGED` — update severity in both `ActiveIncidentsState` summary and React Query incident entity cache. Re-evaluate `s1_s2_active`.
6. `CLOSED` — remove from `ActiveIncidentsState.incidents`. If `active_incident_id === incident_id`, clear workspace state.

### 4.3 Commander Claim State (No Optimistic Updates)

Commander claim is a write operation with no optimistic update. The rules are:

1. Operator presses "Claim Commander" button.
2. `IncidentWorkspaceStore.setClaiming(true)` — sets `claim_in_flight: true`. Button becomes a loading state (absent the click target, not disabled).
3. POST request is dispatched.
4. **If server returns success:** WebSocket push arrives with `COMMANDER_CLAIMED`. Apply to state via `applyCommanderPush`. `setClaiming(false)`.
5. **If server returns rejection:** Toast displayed with rejection detail. `setClaiming(false)`. Do not modify commander state. React Query cache refresh triggered for `['incidents', incident_id]`.
6. **If request times out (>5s):** `setClaiming(false)`. Toast: "Claim request timed out. Verify commander status." Trigger cache refresh.

The claim button must be absent from DOM when `claim_in_flight === true`, when the operator's role is below OPERATOR, or when `commander_status.claimed === true` and `commander_operator_id !== auth.operator_id`.

### 4.4 COMMANDER_LAPSED Timer

The COMMANDER_LAPSED countdown is rendered from the server-provided `commander_claim_expires_at` timestamp. The client must never calculate the claim window from `Date.now()` or any client-derived time.

```typescript
// CORRECT — derive countdown from server timestamp
function useCommanderCountdown(claim_expires_at: string | null): number | null {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!claim_expires_at) {
      setSecondsRemaining(null);
      return;
    }
    const expiresMs = new Date(claim_expires_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [claim_expires_at]);

  return secondsRemaining;
}

// FORBIDDEN — never do this
// const CLAIM_WINDOW_MS = 15 * 60 * 1000;
// const expires = new Date(claimed_at).getTime() + CLAIM_WINDOW_MS;
```

When `secondsRemaining <= 300` (5 minutes), the countdown enters warning display state. When `secondsRemaining === 0`, the client fires a Level 1 constitutional alert in the notification system and awaits the server `COMMANDER_LAPSED` push to update commander state. The client does not set `commander_lapsed_at` — the server does.

---

## 5. Replay State (Detailed — IC-03 Enforcement)

IC-03 is a constitutional constraint: **zero live write controls in REPLAY mode, absent from DOM (not disabled).** Violation of IC-03 must be logged as `IC03_ENFORCEMENT_GAP`.

### 5.1 `is_replay_mode` Flag Contract

```typescript
// Behavior rules — not just a description but an enforcement contract:
// 1. Set to true: when loadSession() is called on ReplayStore.
// 2. Never cleared: no action, event, or state change clears is_replay_mode
//    while the REPLAY_INVESTIGATION surface is mounted.
// 3. Cleared only: when endSession() is called on surface unmount.
// 4. Checked before dispatch: ALL write-capable components on the replay
//    surface must check is_replay_mode before rendering any write control.
```

The check pattern is:

```typescript
// In any component that could render a write control on the replay surface:
const { is_replay_mode } = useReplayStore(s => s.state);

// Absent-not-disabled — if in replay mode, do not render the control at all
if (is_replay_mode) return null;
```

If a write operation is somehow dispatched while `is_replay_mode === true` (e.g., via a stale closure or race condition), the dispatch layer must:
1. Block the operation.
2. Log `IC03_ENFORCEMENT_GAP` with `{ operator_id, operation_type, timestamp }` to the audit sink.
3. Not show the operator a confusing error — surface a developer-mode console error only.

### 5.2 Collaborator State

```typescript
// Collaborator state is updated via WebSocket push only.
// The local operator is identified by auth.operator_id.
// The local operator's own position is updated locally on scrub,
// then confirmed/corrected by server push.

// Position updates from server push:
function applyCollaboratorPush(
  state: ReplayState,
  push: CollaboratorPositionPush
): ReplayState {
  const existing = state.collaborators.findIndex(
    c => c.operator_id === push.operator_id
  );
  if (existing >= 0) {
    const updated = [...state.collaborators];
    updated[existing] = {
      ...updated[existing],
      timeline_position_ms: push.timeline_position_ms,
      last_seen_at: push.server_timestamp,
    };
    return { ...state, collaborators: updated };
  }
  return {
    ...state,
    collaborators: [
      ...state.collaborators,
      {
        operator_id: push.operator_id,
        display_name: push.display_name,
        avatar_color: push.avatar_color,
        timeline_position_ms: push.timeline_position_ms,
        last_seen_at: push.server_timestamp,
      },
    ],
  };
}
```

Collaborators who have `last_seen_at` more than 60 seconds ago (by server timestamp comparison, not `Date.now()`) are shown as "inactive" but not removed.

### 5.3 Annotation State

Annotations are sorted by `server_received_at` ascending. The client timestamp of annotation creation is never used for ordering. Annotations are append-only — no client-side edit or delete of existing annotations. `COUNTERFACTUAL` annotation type is absent from DOM for non-ADMIN roles.

```typescript
function applyAnnotationPush(
  state: ReplayState,
  push: AnnotationPush
): ReplayState {
  // Prevent duplicates — server may re-push on reconnect
  const exists = state.annotations.some(
    a => a.annotation_id === push.annotation.annotation_id
  );
  if (exists) return state;

  const updated = [
    ...state.annotations,
    push.annotation,
  ].sort((a, b) =>
    new Date(a.server_received_at).getTime() -
    new Date(b.server_received_at).getTime()
  );

  return { ...state, annotations: updated };
}
```

### 5.4 Contradiction Pairs

Contradictions are server-detected. The client displays them as pairs of linked annotations with visual differentiation. Contradiction pairs are append-only — the client never resolves or removes contradictions.

```typescript
function applyContradictionPush(
  state: ReplayState,
  push: ContradictionPush
): ReplayState {
  const exists = state.contradiction_pairs.some(
    cp =>
      (cp.annotation_a_id === push.pair.annotation_a_id &&
        cp.annotation_b_id === push.pair.annotation_b_id) ||
      (cp.annotation_a_id === push.pair.annotation_b_id &&
        cp.annotation_b_id === push.pair.annotation_a_id)
  );
  if (exists) return state;
  return {
    ...state,
    contradiction_pairs: [...state.contradiction_pairs, push.pair],
  };
}
```

---

## 6. Venue State (Detailed)

### 6.1 Venue Entity Schema

```typescript
type TrustState =
  | 'TRUSTED'
  | 'UNTRUSTED'
  | 'RECOVERED_BUT_UNTRUSTED'
  | 'PENDING_VERIFICATION';

interface VenueHardwareSummary {
  screen_count: number;
  screens_online: number;
  player_version: string;
  last_heartbeat_at: string; // ISO 8601 UTC
}

interface VenueCorpusStatus {
  current_corpus_id: string | null;
  corpus_hash_verified: boolean;
  last_verified_at: string | null; // ISO 8601 UTC
  delivery_pending: boolean;
  next_delivery_at: string | null; // ISO 8601 UTC
}

interface Venue {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  trust_state: TrustState;
  corpus_hash_verified: boolean;
  autonomy_status: AutonomyStatus;
  hardware_summary: VenueHardwareSummary;
  corpus_status: VenueCorpusStatus;
  active_incident_id: string | null;
  active_incident_severity: IncidentSeverity | null;
  pre_resolution_level: PRELevel;
  enrolled_at: string; // ISO 8601 UTC
  last_contact_at: string; // ISO 8601 UTC
  sequence_number: number; // monotonic — used for stale detection
}
```

### 6.2 `RECOVERED_BUT_UNTRUSTED` Guard

```typescript
function canPlaceOverride(venue: Venue): boolean {
  // Block overrides when venue is reconnected but corpus hash not yet verified
  if (venue.machine_state === 'RECOVERED_BUT_UNTRUSTED') return false;
  if (!venue.corpus_hash_verified) return false;
  // Block overrides during offline/initializing states
  if (venue.machine_state === 'OFFLINE') return false;
  if (venue.machine_state === 'INITIALIZING') return false;
  // Block when trust state is not TRUSTED
  if (venue.trust_state !== 'TRUSTED') return false;
  return true;
}
```

This function must be called before rendering any override placement control. If `canPlaceOverride(venue) === false`, the override control is absent from DOM. A contextual status badge explaining why (e.g., "Awaiting corpus verification") is shown in its place.

### 6.3 Autonomy Clock

The autonomy countdown is rendered from the server-provided `autonomy_expires_at` timestamp. Same pattern as COMMANDER_LAPSED timer — never computed from client-side elapsed time.

```typescript
function useAutonomyClock(autonomy_expires_at: string | null): {
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} | null {
  const [remaining, setRemaining] = useState<ReturnType<typeof parseRemaining> | null>(null);

  function parseRemaining(expiresAt: string) {
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const totalSeconds = Math.floor(ms / 1000);
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      expired: ms === 0,
    };
  }

  useEffect(() => {
    if (!autonomy_expires_at) {
      setRemaining(null);
      return;
    }
    setRemaining(parseRemaining(autonomy_expires_at));
    const id = setInterval(() => setRemaining(parseRemaining(autonomy_expires_at)), 1000);
    return () => clearInterval(id);
  }, [autonomy_expires_at]);

  return remaining;
}
```

The autonomy clock enters critical display state (red) when `hours === 0 && minutes < 30`. At expiry, the venue transitions to `OFFLINE` via server push. The client does not set machine state on clock expiry.

---

## 7. Cache Strategy

### 7.1 React Query Cache Keys

All cache keys are structured as arrays to enable partial invalidation.

```typescript
// Venues
['venues']                                    // fleet list
['venues', venue_id]                          // single venue entity
['venues', venue_id, 'screens']               // screen list for venue
['venues', venue_id, 'screens', screen_id]    // single screen entity
['venues', venue_id, 'corpus']                // corpus status for venue
['venues', venue_id, 'history']               // event history for venue

// Incidents
['incidents']                                 // active incident list
['incidents', incident_id]                    // single incident entity
['incidents', incident_id, 'events']          // event log for incident
['incidents', incident_id, 'overrides']       // override list for incident

// Corpus
['corpus']                                    // delivery schedule list
['corpus', corpus_id]                         // single corpus entity
['corpus', 'slots', slot_id]                  // single calendar slot
['corpus', 'delivery', venue_id]              // delivery queue for venue

// Fleet
['fleet', 'summary']                          // fleet health summary
['fleet', 'metrics']                          // fleet metrics snapshot

// Replay
['replay', 'sessions']                        // session list
['replay', 'sessions', session_id]            // single session entity
['replay', 'annotations', corpus_id]          // annotations for corpus

// PRE
['pre', venue_id]                             // PRE resolution state for venue
['pre', venue_id, 'levels']                   // full level resolution chain
```

### 7.2 Stale Times

| Cache Key Pattern | Stale Time | Rationale |
|---|---|---|
| `['venues', venue_id]` | 10s | Machine state changes frequently during incidents |
| `['venues']` (fleet list) | 15s | Fleet view refreshes are less time-critical |
| `['incidents', incident_id]` | 5s | Incident state is high-urgency |
| `['incidents']` | 5s | Active incident list must reflect S1/S2 changes quickly |
| `['corpus', ...]` | 30s | Corpus delivery schedules change slowly |
| `['fleet', 'summary']` | 15s | Fleet health summary |
| `['fleet', 'metrics']` | 30s | Metrics snapshots |
| `['replay', ...]` | 60s | Replay sessions are immutable once created |
| `['pre', venue_id]` | 10s | PRE state ties to venue machine state |

### 7.3 What is Never Cached

The following must never enter the React Query cache:

- Operator write operation results (POST/PUT/PATCH/DELETE responses)
- Rejection responses (`{ rejection: { type, message, ... } }`) — consumed at point of use and discarded
- Audit events — write-through to server, never read back into cache
- WebSocket push payloads — applied directly to cache entries via `queryClient.setQueryData`, not stored separately
- Session tokens or auth credentials

### 7.4 Cache Invalidation Triggers

WebSocket push messages trigger targeted cache invalidation. The following table maps push message types to the cache keys they invalidate.

| WebSocket Push Type | Cache Keys Invalidated |
|---|---|
| `VENUE_STATE_UPDATE` | `['venues', venue_id]`, `['fleet', 'summary']` |
| `MACHINE_STATE_CHANGE` | `['venues', venue_id]`, `['fleet', 'summary']` |
| `INCIDENT_OPENED` | `['incidents']`, `['venues', venue_id]` |
| `INCIDENT_UPDATED` | `['incidents', incident_id]` |
| `INCIDENT_CLOSED` | `['incidents']`, `['incidents', incident_id]`, `['venues', venue_id]` |
| `COMMANDER_CLAIMED` | `['incidents', incident_id]` |
| `COMMANDER_LAPSED` | `['incidents', incident_id]` |
| `OVERRIDE_PLACED` | `['incidents', incident_id, 'overrides']`, `['venues', venue_id]` |
| `OVERRIDE_REMOVED` | `['incidents', incident_id, 'overrides']`, `['venues', venue_id]` |
| `CORPUS_DELIVERY_UPDATE` | `['corpus', corpus_id]`, `['corpus', 'delivery', venue_id]` |
| `CORPUS_HASH_VERIFIED` | `['venues', venue_id]` |
| `FLEET_HEALTH_UPDATE` | `['fleet', 'summary']`, `['fleet', 'metrics']` |
| `PRE_STATE_CHANGE` | `['pre', venue_id]` |
| `SYSTEM_HEALTH_UPDATE` | Applies to `SystemHealthStore` — not a React Query cache key |

For `VENUE_STATE_UPDATE` and similar, use `queryClient.setQueryData` to apply the push payload directly rather than triggering a re-fetch where the pushed data is already complete. Trigger a re-fetch only when the push payload is a summary that omits fields present in the cached entity.

### 7.5 Optimistic Updates

**Optimistic updates are prohibited for all write operations.**

Every write operation follows the server-confirmation pattern:
1. Dispatch request.
2. Show loading state on the triggering UI element (element becomes non-interactive, not disabled).
3. Await server response.
4. On success: apply server-returned entity state to cache via `queryClient.setQueryData`.
5. On rejection: process rejection per Section 9. Do not modify cache.
6. On timeout: surface error, restore UI element to interactive state, do not modify cache.

This rule applies without exception. The commander claim flow in Section 4.3 is the reference implementation.

---

## 8. WebSocket Update Strategy

### 8.1 Connection Model

A single WebSocket connection is maintained per operator session. The connection is established during app initialization (after auth), before any surface renders. Components must not manage their own WebSocket connections.

```typescript
interface WebSocketManager {
  connect(session_id: string): Promise<void>;
  disconnect(): void;
  subscribe(venue_ids: string[]): void;
  unsubscribe(venue_ids: string[]): void;
  send(message: OutboundWSMessage): void;
  connectionState: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
}
```

The `WebSocketManager` is a singleton initialized in the app root. Surface components access it via context, not by instantiating it themselves.

### 8.2 Subscription Model

The operator subscribes to venue_ids relevant to their role and current surface context:

- **VIEWER / OPERATOR / ADMIN:** subscribe to all venues accessible to their organization on connect.
- **CONTENT_MANAGER:** subscribe to venues in their content scope.
- On venue selection in `LiveOpsStore` or `VenueOpsStore`: add targeted subscription for selected venue's high-frequency updates.
- On surface change to `INCIDENT_COMMAND`: ensure subscription for the incident's venue_id.

Subscription changes are sent as `{ type: 'SUBSCRIBE', venue_ids: string[] }` and `{ type: 'UNSUBSCRIBE', venue_ids: string[] }` outbound messages.

### 8.3 Message Routing

Incoming WebSocket messages carry a `type` field. The router dispatches to the appropriate handler:

```typescript
type InboundWSMessage =
  | { type: 'VENUE_STATE_UPDATE'; venue_id: string; payload: Partial<Venue>; sequence_number: number; server_timestamp: string }
  | { type: 'MACHINE_STATE_CHANGE'; venue_id: string; machine_state: MachineState; sequence_number: number; server_timestamp: string }
  | { type: 'INCIDENT_OPENED'; incident: Incident; server_timestamp: string }
  | { type: 'INCIDENT_UPDATED'; incident_id: string; payload: Partial<Incident>; sequence_number: number; server_timestamp: string }
  | { type: 'INCIDENT_CLOSED'; incident_id: string; server_timestamp: string }
  | { type: 'COMMANDER_CLAIMED'; incident_id: string; commander_status: CommanderStatus; sequence_number: number; server_timestamp: string }
  | { type: 'COMMANDER_LAPSED'; incident_id: string; lapsed_at: string; sequence_number: number; server_timestamp: string }
  | { type: 'OVERRIDE_PLACED'; incident_id: string; override: OverrideEntry; sequence_number: number; server_timestamp: string; triggered_by?: 'REJECTION' }
  | { type: 'OVERRIDE_REMOVED'; incident_id: string; override_id: string; sequence_number: number; server_timestamp: string; triggered_by?: 'REJECTION' }
  | { type: 'CORPUS_DELIVERY_UPDATE'; corpus_id: string; venue_id: string; payload: unknown; server_timestamp: string }
  | { type: 'CORPUS_HASH_VERIFIED'; venue_id: string; corpus_id: string; verified: boolean; server_timestamp: string }
  | { type: 'FLEET_HEALTH_UPDATE'; payload: unknown; server_timestamp: string }
  | { type: 'PRE_STATE_CHANGE'; venue_id: string; pre_level: PRELevel; server_timestamp: string }
  | { type: 'SYSTEM_HEALTH_UPDATE'; payload: SystemHealthPush; server_timestamp: string }
  | { type: 'ANNOTATION_PUSH'; session_id: string; annotation: ReplayAnnotation; server_timestamp: string }
  | { type: 'COLLABORATOR_POSITION'; session_id: string; operator_id: string; timeline_position_ms: number; display_name: string; avatar_color: string; server_timestamp: string }
  | { type: 'CONTRADICTION_DETECTED'; session_id: string; pair: ContradictionPair; server_timestamp: string }
  | { type: 'NOTIFICATION'; notification: Notification; server_timestamp: string };

function routeInboundMessage(
  msg: InboundWSMessage,
  queryClient: QueryClient,
  stores: AllStores
): void {
  switch (msg.type) {
    case 'VENUE_STATE_UPDATE':
      applyVenueStatePush(msg, queryClient, stores.venueOps);
      break;
    case 'INCIDENT_OPENED':
      stores.activeIncidents.applyIncidentPush({ type: 'ADD', incident: summarize(msg.incident) });
      queryClient.setQueryData(['incidents', msg.incident.incident_id], msg.incident);
      checkS1S2AutoReplace(msg.incident, stores.ui, stores.auth);
      break;
    // ... handlers for each type
  }
}
```

### 8.4 Stale Detection

Every push message that modifies a stateful entity carries a `sequence_number`. The client must discard the push if the message's sequence number is not greater than the current known sequence number for that entity.

```typescript
function shouldApplyPush(
  incoming_sequence: number,
  current_sequence: number
): boolean {
  return incoming_sequence > current_sequence;
}
```

If a push is discarded due to staleness, log a debug-level event. Do not surface this to the operator.

### 8.5 Reconnection Strategy

```typescript
const RECONNECT_CONFIG = {
  initial_delay_ms: 1_000,
  max_delay_ms: 30_000,
  backoff_multiplier: 2,
  jitter_factor: 0.1, // 10% random jitter added to each delay
};

// On reconnect:
// 1. Re-authenticate (send session_id in connection header or first message)
// 2. Re-subscribe to all previously subscribed venue_ids
// 3. Trigger targeted re-fetch for all stale React Query keys
//    (keys whose data age exceeds their stale time)
// 4. Do NOT trigger full page reload
```

Connection state is exposed via `WebSocketManager.connectionState` and reflected in the System Status Bar indicator for backend connectivity.

### 8.6 Forced State Push Handling (`triggered_by: 'REJECTION'`)

When a push message includes `triggered_by: 'REJECTION'`, it means the server is broadcasting the authoritative state as part of a rejection response cycle (A-NEW-04). The receiving client must:

1. Apply the entity state update to the React Query cache immediately.
2. If the push targets an entity currently visible in Zone B, trigger an entity highlight animation (400ms amber border pulse) on the relevant card or panel.
3. The highlight animation signals "this entity's state has been corrected by the server."

The animation must be triggered by a state flag in the relevant surface store, not by direct DOM manipulation.

---

## 9. Conflict Resolution Rules

All conflict resolution is server-authoritative. The client has no conflict resolution logic.

### 9.1 General Rule

**Server wins always.** When the server returns a state that differs from client expectation, the server state is applied without negotiation.

### 9.2 CONCURRENCY_CONFLICT (409)

```typescript
// Rejection shape per A-NEW-04
interface RejectionEnvelope {
  rejection: {
    type: 'CONCURRENCY_CONFLICT' | 'AUTHORITY_BOUNDARY' | 'PRE_CONSTRAINT' | 'REPLAY_MODE';
    message: string;
    current_state: unknown; // server's authoritative current state for the entity
    retry_permitted: boolean;
    affected_entity: string; // entity type and id, e.g. "incident:abc-123"
    audit_event_id: string;
  };
}
```

On `CONCURRENCY_CONFLICT`:
1. Show toast notification: "Action could not be completed — another operator updated this record. The current state has been applied." Duration: 5s.
2. Apply `rejection.current_state` to the relevant React Query cache key via `queryClient.setQueryData`.
3. Do not retry automatically (`retry_permitted` may be `true` but UI must require explicit operator re-attempt).
4. Clear any loading state on the triggering UI element.

### 9.3 AUTHORITY_BOUNDARY (403)

On `AUTHORITY_BOUNDARY`:
1. Show modal (blocking, requires explicit dismissal): "You do not have authority to perform this action. The current system state has been applied."
2. Apply `rejection.current_state` to cache.
3. Clear loading state.
4. The modal must display `rejection.message` verbatim. Do not paraphrase.

AUTHORITY_BOUNDARY rejections indicate a role check gap — the client showed a control the operator lacked authority to use. These must also be logged to the developer console as `AUTHORITY_BOUNDARY_ENFORCEMENT_GAP` for subsequent audit.

### 9.4 PRE_CONSTRAINT (422)

On `PRE_CONSTRAINT`:
1. Show toast: "Action blocked by content resolution policy. [View PRE State →]" — the link navigates to the PRE State tab for the relevant venue.
2. Trigger `queryClient.invalidateQueries(['pre', venue_id])` to refresh PRE state.
3. Clear loading state. Do not apply `current_state` to cache (PRE constraint rejections do not carry corrected entity state).

### 9.5 REPLAY_MODE (403)

On `REPLAY_MODE`:
1. Show extended toast (8s, non-dismissible): "Write operations are not permitted during replay. This action has been blocked."
2. Check `ReplayStore.state.is_replay_mode`. If `is_replay_mode === false` at the time this rejection arrives, log `IC03_ENFORCEMENT_GAP` immediately.
3. Clear loading state.
4. The `REPLAY_MODE` rejection type must never reach the server from a correctly implemented client. Receiving it indicates an IC-03 enforcement gap.

### 9.6 Stale Session Recovery

If the last WebSocket push received for any subscribed entity was more than 30 seconds ago and no `SYSTEM_HEALTH_UPDATE` has been received in that window, trigger a targeted re-fetch for all active surface cache keys. This is not a full page reload — only the React Query stale keys for entities currently rendered in Zone B are refreshed.

```typescript
// Staleness detection — checked on a 30s interval
function checkSessionStaleness(
  lastPushTimestamp: number,
  queryClient: QueryClient,
  activeSurface: SurfaceId
): void {
  const ageMs = Date.now() - lastPushTimestamp;
  if (ageMs > 30_000) {
    const keysToRefresh = getStaleCacheKeysForSurface(activeSurface);
    keysToRefresh.forEach(key => queryClient.invalidateQueries(key));
  }
}
```

---

## 10. State Initialization Sequence

### 10.1 App Load Sequence

The following sequence is mandatory on application load. Steps are ordered and each must complete before the next begins. The application must not render any surface until Step 5 completes.

```
Step 1: Fetch /api/auth/session
        → Populate AuthStore
        → If 401: redirect to login, halt sequence

Step 2: Fetch /api/system/health
        → Populate SystemHealthStore
        → constitutional_state is available for all subsequent renders

Step 3: Fetch /api/venues (list for this operator)
        → Populate React Query ['venues'] cache
        → Venue IDs are available for WebSocket subscription

Step 4: Establish WebSocket connection
        → Connect with session_id
        → Subscribe to all operator-accessible venue_ids
        → Await connection confirmation (CONNECTED state)

Step 5: Fetch active incidents summary
        → Populate ActiveIncidentsState
        → Evaluate s1_s2_active for Zone B auto-replace check

Step 6: Render active surface
        → UIStore.active_surface determines which surface renders
        → If s1_s2_active === true and role >= OPERATOR: set active_surface to INCIDENT_COMMAND
        → Surface-specific initialization proceeds per Section 10.2
```

During Steps 1–5, render a loading shell (System Status Bar + Zone A skeleton). Do not render Zone B.

If Step 1 fails with a network error (not 401), show a connection error state in the loading shell and retry with exponential backoff. If Step 2 or 3 fails, proceed with degraded data (empty venue list, UNKNOWN constitutional state) and surface a warning in the System Status Bar.

### 10.2 Surface Change Sequence

When the operator changes the active surface via navigation:

1. `UIStore.setActiveSurface(surface_id, false)` — `force` is `false` for manual navigation.
2. Zone B unmounts the previous surface component.
3. Zone B mounts the new surface component.
4. Surface-specific initialization:
   - **LIVE_OPS:** If `liveOps.last_selected_venue_id` is set, restore venue selection. Fetch `['venues']` if stale.
   - **INCIDENT_COMMAND:** If `incidentWorkspace.active_incident_id` is set, fetch `['incidents', id]`. Else render incident list.
   - **REPLAY_INVESTIGATION:** Do not initialize session — operator must explicitly load one. `is_replay_mode` remains `false` until `ReplayStore.loadSession()` is called.
   - **CMS_CONTENT_OPS:** Fetch `['corpus']` delivery schedule. Restore `cms.active_tab`.
   - **VENUE_OPS:** If `venueOps.venue_id` is set, fetch `['venues', venue_id]`. Else render venue enrollment list.
5. Global state (AuthStore, SystemHealthStore, ActiveIncidentsState, NotificationStore) is not torn down or re-initialized.

### 10.3 Zone B Auto-Replace (S1/S2 Incident)

Zone B auto-replace fires when `ActiveIncidentsState.s1_s2_active` transitions from `false` to `true` and `auth.role` is OPERATOR, CONTENT_MANAGER, or ADMIN.

```typescript
function onS1S2Activated(
  uiStore: UIStore,
  authStore: AuthStore
): void {
  const role = authStore.state?.role;
  if (!role || role === 'VIEWER') return;

  const current = uiStore.state.active_surface;
  if (current === 'INCIDENT_COMMAND') return; // already there

  // Preserve prior surface for PATCH-014 "back" link
  uiStore.setActiveSurface('INCIDENT_COMMAND', true /* force */);
  // setActiveSurface with force=true sets:
  //   prior_surface = current
  //   force_replaced_surface = true
}
```

The Incident Command Surface renders a "← Return to [prior surface name]" link when `force_replaced_surface === true`. Clicking it calls `UIStore.setActiveSurface(prior_surface, false)` and clears `force_replaced_surface`.

VIEWER role users are not auto-replaced. Their Zone B remains on the current surface, but the System Status Bar shows a persistent S1/S2 alert indicator.

### 10.4 Session Recovery on Hard Reload

On hard reload (browser refresh, not SPA navigation), the entire initialization sequence in Section 10.1 runs from Step 1. There is no client-side session persistence — all state is re-fetched. The operator returns to the default surface (LIVE_OPS) unless S1/S2 auto-replace fires.

---

## Appendix A — WebSocket Push Message Contracts

All push payloads use ISO 8601 UTC timestamps. All sequence numbers are monotonic integers scoped to their entity. The `server_timestamp` field is the server's wall-clock time at push emission — used for display only, never for business logic.

## Appendix B — Rejection Envelope Contract (A-NEW-04)

Rejections are returned as HTTP response bodies with the following HTTP status codes:
- `409 CONCURRENCY_CONFLICT`
- `403 AUTHORITY_BOUNDARY`
- `422 PRE_CONSTRAINT`
- `403 REPLAY_MODE` (distinguished from AUTHORITY_BOUNDARY by the `rejection.type` field)

The `RejectionEnvelope` interface defined in Section 9.2 applies to all four types. The `current_state` field is populated for `CONCURRENCY_CONFLICT` and `AUTHORITY_BOUNDARY`. For `PRE_CONSTRAINT` and `REPLAY_MODE`, `current_state` is `null`.

## Appendix C — Advisory Level Mapping (A-NEW-01)

Advisory levels from push payloads map to client notification handling as follows:

| Advisory Level | Dismissible Without Ack | Display Duration | System Status Bar Impact |
|---|---|---|---|
| `INFORMATIONAL` | Yes | 4s toast | None |
| `RECOMMENDED` | Yes | 6s toast, persists in tray | Yellow indicator |
| `URGENT` | No — requires explicit acknowledgment | Persistent until acknowledged | Red indicator, Zone A badge |
