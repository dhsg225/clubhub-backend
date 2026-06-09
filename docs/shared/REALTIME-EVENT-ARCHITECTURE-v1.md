# REALTIME-EVENT-ARCHITECTURE-v1

**Status:** AUTHORITATIVE
**Version:** 1.0
**Date:** 2026-06-03
**Audience:** Frontend engineering team
**Purpose:** Complete implementation specification for the ClubHub TV real-time event system

---

## 1. Architecture Overview

### 1.1 Single Connection Per Session

There is one WebSocket connection per browser session, not one per surface, not one per venue, not one per component. This is a hard architectural constraint.

- The connection is established immediately after successful authentication
- The connection is torn down on logout or session expiry
- All surfaces, all zones, and all components share this single connection
- Connection state is held in a singleton `RealtimeClient` instance, injected via React context

### 1.2 Connection Lifecycle

```
AUTH SUCCESS → connect()
              ↓
         CONNECTING
              ↓
         CONNECTED → send SUBSCRIBE (all accessible venue_ids)
              ↓
      [Normal operation]
              ↓
  LOGOUT/SESSION_EXPIRY → disconnect() → CLOSED
```

If the server closes the connection for any reason other than a normal logout, the client enters reconnect flow (Section 8). If the server closes with a session-expiry signal (e.g. close code 4001), the client redirects to login without reconnecting.

### 1.3 Protocol

- **Transport:** WebSocket (native browser WebSocket API)
- **Framing:** JSON messages, UTF-8 encoded
- **Message direction:** Server→Client for all state events; Client→Server for subscriptions and position updates

If socket.io is adopted at a later date, the event names and payload shapes defined in this document remain canonical. Socket.io is a transport detail and must not change the event contract.

### 1.4 Message Envelope

Every message exchanged on the WebSocket conforms to this envelope:

```typescript
interface MessageEnvelope<T = unknown> {
  event: string;
  payload: T;
  sequence_number: number; // monotonically increasing per venue_id; 0 for global events
  timestamp: string;       // ISO 8601 UTC, e.g. "2026-06-03T14:22:01.334Z"
}
```

**`sequence_number` rules:**
- For venue-scoped events: monotonically increasing integer per `venue_id`. The server guarantees no gaps in normal operation but does not guarantee delivery.
- For global/session-scoped events (e.g. `COLLABORATOR_POSITION`): scoped to the `session_id` referenced in the payload.
- For client→server messages: not required; client may set to `0`.
- Purpose: stale message detection. If a message arrives with `sequence_number` less than the highest sequence already processed for that venue/session, discard it silently. Do not error.

### 1.5 Singleton RealtimeClient Interface

```typescript
interface RealtimeClient {
  connect(authToken: string): void;
  disconnect(): void;
  subscribe(params: SubscribePayload): void;
  unsubscribe(params: UnsubscribePayload): void;
  sendCollaboratorPosition(params: CollaboratorPositionUpdatePayload): void;
  on<T>(event: string, handler: (envelope: MessageEnvelope<T>) => void): () => void;
  connectionState: ConnectionState;
}

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';
```

The `on()` method returns an unsubscribe function. Components must call the returned function in their cleanup (e.g. `useEffect` return).

---

## 2. Event Taxonomy

### 2.1 Complete Event Table

| Event Name | Direction | Priority Tier | Payload Type | Affected State Slices | Surfaces Affected |
|---|---|---|---|---|---|
| `ZONE_B_AUTO_REPLACE` | S→C | 1 — Constitutional | `ZoneBAutoReplacePayload` | `active_surface`, `prior_surface` | All (OPERATOR+ only) |
| `SYSTEM_HEALTH_UPDATE` | S→C | 1 — Constitutional | `SystemHealthUpdatePayload` | `constitutional_state` | System Status Bar, all surfaces |
| `EMERGENCY_FREEZE_ACTIVATED` | S→C | 1 — Constitutional | `EmergencyFreezePayload` | `venue.constitutional_state` | System Status Bar, Zone A, Zone B (IC) |
| `INCIDENT_CREATED` (S1/S2) | S→C | 1 — Constitutional | `IncidentCreatedPayload` | `incident_list` | Zone A, Zone B (auto-replace) |
| `VENUE_STATE_UPDATE` | S→C | 2 — Operational | `VenueStateUpdatePayload` | `venue_list`, `venue_dots` | Zone A, Zone C, System Status Bar |
| `INCIDENT_UPDATE` | S→C | 2 — Operational | `IncidentUpdatePayload` | `incident_list`, `incident_detail` | Zone A, Zone B (IC) |
| `INCIDENT_CREATED` (S3–S5) | S→C | 2 — Operational | `IncidentCreatedPayload` | `incident_list` | Zone A |
| `INCIDENT_CLOSED` | S→C | 2 — Operational | `IncidentClosedPayload` | `incident_list`, `incident_detail` | Zone A, Zone B (IC) |
| `COMMANDER_CLAIMED` | S→C | 2 — Operational | `CommanderChangedPayload` | `incident_detail.commander` | Zone B (IC) |
| `COMMANDER_RELEASED` | S→C | 2 — Operational | `CommanderChangedPayload` | `incident_detail.commander` | Zone B (IC) |
| `COMMANDER_LAPSED` | S→C | 2 — Operational | `CommanderLapsedPayload` | `incident_detail.commander_lapsed_at` | Zone B (IC) |
| `OVERRIDE_PLACED` | S→C | 2 — Operational | `OverridePayload` | `incident_detail.overrides` | Zone B (IC Tab 3) |
| `OVERRIDE_REMOVED` | S→C | 2 — Operational | `OverridePayload` | `incident_detail.overrides` | Zone B (IC Tab 3) |
| `REJECTION_STATE_PUSH` | S→C | 2 — Operational | `RejectionStatePushPayload` | entity-specific | Zone B (active surface) |
| `ADVISORY_UPDATE` | S→C | 3 — Informational | `AdvisoryUpdatePayload` | `advisory_level`, `zone_c.pane_c4` | Zone C (Pane C4), Zone A (NotificationTray) |
| `DELIVERY_STATE_UPDATE` | S→C | 3 — Informational | `DeliveryStateUpdatePayload` | `delivery_countdown` | Zone B (CMS surface, Replay surface) |
| `NOTIFICATION_CREATED` | S→C | 3 — Informational | `NotificationCreatedPayload` | `notification_list` | Zone A (NotificationTray) |
| `COLLABORATOR_POSITION` | S→C | 3 — Informational | `CollaboratorPositionPayload` | `replay_session.collaborators` | Zone B (Replay surface) |
| `ANNOTATION_ADDED` | S→C | 3 — Informational | `AnnotationAddedPayload` | `replay_session.annotations` | Zone B (Replay surface) |
| `ANNOTATION_CONTRADICTION_DETECTED` | S→C | 3 — Informational | `AnnotationContradictionPayload` | `replay_session.annotations` | Zone B (Replay surface) |
| `CORPUS_STATUS_UPDATE` | S→C | 3 — Informational | `CorpusStatusPayload` | `corpus_status` | Zone B (CMS surface) |
| `SUBSCRIBE` | C→S | — | `SubscribePayload` | — | — |
| `UNSUBSCRIBE` | C→S | — | `UnsubscribePayload` | — | — |
| `COLLABORATOR_POSITION_UPDATE` | C→S | — | `CollaboratorPositionUpdatePayload` | — | — |

### 2.2 TypeScript Payload Types

```typescript
// ─── Priority Tier 1 ─────────────────────────────────────────────────────────

interface ZoneBAutoReplacePayload {
  incident_id: string;
  venue_id: string;
  severity: IncidentSeverity;          // 'S1' | 'S2'
  incident_title: string;
  triggered_at: string;                // ISO 8601 UTC
}

interface SystemHealthUpdatePayload {
  constitutional_state: ConstitutionalState;
  previous_state: ConstitutionalState;
  affected_venue_ids: string[];        // empty array = platform-wide
  changed_at: string;
}

type ConstitutionalState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CONSTITUTIONAL_RISK'
  | 'EMERGENCY_FREEZE'
  | 'SHADOW_ONLY'
  | 'PRE_DISABLED'
  | 'READ_ONLY';

interface EmergencyFreezePayload {
  venue_id: string;
  constitutional_state: 'EMERGENCY_FREEZE';
  triggered_by: string;                // operator_id or 'SYSTEM'
  triggered_at: string;
}

interface IncidentCreatedPayload {
  incident_id: string;
  venue_id: string;
  severity: IncidentSeverity;
  title: string;
  created_at: string;
  initial_state: IncidentState;
}

type IncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
type IncidentState = 'OPEN' | 'INVESTIGATING' | 'MITIGATING' | 'RESOLVED' | 'CLOSED';

// ─── Priority Tier 2 ─────────────────────────────────────────────────────────

interface VenueStateUpdatePayload {
  venue_id: string;
  machine_state: MachineState;
  previous_machine_state: MachineState;
  trust_state: TrustState;
  constitutional_state: ConstitutionalState;
  last_updated: string;
  sequence_number: number;
}

type MachineState =
  | 'INITIALIZING'
  | 'SYNCING'
  | 'LIVE'
  | 'INCIDENT'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'RECOVERED_BUT_UNTRUSTED';

type TrustState = 'TRUSTED' | 'UNVERIFIED' | 'UNTRUSTED';

interface IncidentUpdatePayload {
  incident_id: string;
  venue_id: string;
  updated_fields: (keyof IncidentRecord)[];
  current_state: Partial<IncidentRecord>;
  updated_at: string;
}

interface IncidentRecord {
  incident_id: string;
  venue_id: string;
  severity: IncidentSeverity;
  state: IncidentState;
  title: string;
  commander_id: string | null;
  commander_claimed_at: string | null;
  commander_lapsed_at: string | null;
  overrides: OverrideRecord[];
  created_at: string;
  updated_at: string;
}

interface IncidentClosedPayload {
  incident_id: string;
  venue_id: string;
  closed_at: string;
  closed_by: string;                   // operator_id
  resolution_summary: string | null;
}

interface CommanderChangedPayload {
  incident_id: string;
  venue_id: string;
  commander_id: string | null;
  action: 'CLAIMED' | 'RELEASED';
  changed_at: string;
  changed_by: string;                  // operator_id
}

interface CommanderLapsedPayload {
  incident_id: string;
  venue_id: string;
  lapsed_at: string;                   // ISO 8601 UTC — client derives time-since from this
  previous_commander_id: string;
}

interface OverridePayload {
  incident_id: string;
  venue_id: string;
  override_id: string;
  action: 'PLACED' | 'REMOVED';
  entity_type: string;
  entity_id: string;
  placed_by: string;
  placed_at: string;
  removed_at: string | null;
}

interface OverrideRecord {
  override_id: string;
  entity_type: string;
  entity_id: string;
  placed_by: string;
  placed_at: string;
  removed_at: string | null;
}

interface RejectionStatePushPayload {
  triggered_by: 'REJECTION';          // always 'REJECTION' for this event type
  entity_type: string;
  entity_id: string;
  venue_id: string;
  incident_id: string | null;
  current_state: Record<string, unknown>; // full current state of the rejected entity
  rejection_reason: string;
  rejected_at: string;
}

// ─── Priority Tier 3 ─────────────────────────────────────────────────────────

interface AdvisoryUpdatePayload {
  advisory_id: string;
  venue_id: string | null;             // null = platform-wide advisory
  advisory_level: AdvisoryLevel;
  previous_level: AdvisoryLevel;
  title: string;
  body: string;
  issued_at: string;
  expires_at: string | null;
}

type AdvisoryLevel = 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';

interface DeliveryStateUpdatePayload {
  corpus_id: string;
  venue_id: string;
  delivery_deadline: string;           // ISO 8601 UTC — client computes countdown from this
  delivery_status: 'PENDING' | 'IN_PROGRESS' | 'DELIVERED' | 'FAILED';
  updated_at: string;
}

interface NotificationCreatedPayload {
  notification_id: string;
  venue_id: string | null;
  category: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  created_at: string;
  auto_dismiss_ms: number | null;      // null = persistent
}

interface CollaboratorPositionPayload {
  session_id: string;
  operator_id: string;
  operator_display_name: string;
  timeline_position_ms: number;
  updated_at: string;
}

interface AnnotationAddedPayload {
  session_id: string;
  annotation_id: string;
  operator_id: string;
  timeline_position_ms: number;
  body: string;
  server_received_at: string;
  contradiction_flag: boolean;
  contradicts_annotation_id: string | null;
}

interface AnnotationContradictionPayload {
  session_id: string;
  annotation_id_a: string;
  annotation_id_b: string;
  detected_at: string;
}

interface CorpusStatusPayload {
  corpus_id: string;
  venue_id: string;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'DEPLOYED';
  rejection_reason: string | null;
  updated_at: string;
}

// ─── Client→Server ────────────────────────────────────────────────────────────

interface SubscribePayload {
  venue_ids: string[];
  incident_ids?: string[];
  session_ids?: string[];
}

interface UnsubscribePayload {
  venue_ids?: string[];
  incident_ids?: string[];
  session_ids?: string[];
}

interface CollaboratorPositionUpdatePayload {
  session_id: string;
  position_ms: number;
}
```

---

## 3. Subscription Model

### 3.1 Initial Subscription

On `CONNECTED`, immediately send a `SUBSCRIBE` message containing all `venue_ids` the authenticated operator has access to. The server must have already provided the accessible venue list in the auth response or initial data fetch — do not wait for a round trip.

```typescript
// Called once on CONNECTED
function onConnected(accessibleVenueIds: string[]): void {
  realtimeClient.subscribe({ venue_ids: accessibleVenueIds });
}
```

### 3.2 Surface-Driven Subscription Changes

**Navigating TO Incident Command surface:**
```typescript
realtimeClient.subscribe({ incident_ids: [incident_id] });
```

**Navigating AWAY FROM Incident Command surface:**
```typescript
realtimeClient.unsubscribe({ incident_ids: [incident_id] });
```

**Navigating TO Replay surface:**
```typescript
realtimeClient.subscribe({ session_ids: [session_id] });
```

**Navigating AWAY FROM Replay surface:**
```typescript
realtimeClient.unsubscribe({ session_ids: [session_id] });
```
This must fire even when navigation is triggered by `ZONE_B_AUTO_REPLACE`. The session_id subscription must be cleaned up regardless of why the surface changed.

### 3.3 Venue Selection Changes

When the operator changes the selected venue in Zone A (VenueSelector), the venue subscription does not change. All accessible venues remain subscribed throughout the session. The venue selection is a UI filter, not a subscription change.

**Exception:** Fleet view operators who add a new venue to their accessible list at runtime (e.g. after a permissions grant) must send an incremental `SUBSCRIBE` for the new `venue_id` only.

### 3.4 Subscription Limits

The client enforces these limits before sending any `SUBSCRIBE` message:

| Subscription Type | Maximum |
|---|---|
| `venue_ids` | 50 |
| `incident_ids` | 10 |
| `session_ids` | 5 |

If adding a new subscription would exceed the limit, the client must unsubscribe the oldest entry of that type before subscribing the new one. Log a warning to the client event log when this occurs.

### 3.5 Subscription State

Maintain a local record of active subscriptions so they can be re-sent on reconnect:

```typescript
interface SubscriptionState {
  venue_ids: Set<string>;
  incident_ids: Set<string>;
  session_ids: Set<string>;
}
```

This state is the source of truth for what to re-subscribe to after reconnect (Section 8).

---

## 4. Event Prioritization and Processing

### 4.1 Processing Model

The message handler receives raw WebSocket messages on the main thread. Processing is stratified by priority tier:

```typescript
function onMessage(raw: MessageEvent): void {
  const envelope = JSON.parse(raw.data) as MessageEnvelope;

  if (isTier1(envelope.event)) {
    processTier1(envelope);             // synchronous, immediate
    return;
  }

  if (isTier2(envelope.event)) {
    scheduleTier2(envelope);            // current tick, no deferral
    return;
  }

  enqueueTier3(envelope);               // 500ms batch window
}
```

### 4.2 Tier 1 — Constitutional (Immediate)

Processed synchronously in the message handler before any queuing, batching, or deferral. No `setTimeout`, no `requestAnimationFrame`, no microtask queue. Direct state mutation.

Events: `ZONE_B_AUTO_REPLACE`, `SYSTEM_HEALTH_UPDATE`, `EMERGENCY_FREEZE_ACTIVATED`, `INCIDENT_CREATED` (S1/S2 only)

The S1/S2 classification is determined from the payload `severity` field. If the field is absent or malformed, treat as Tier 2 (fail safe, not fail fast).

### 4.3 Tier 2 — Operational (Current Tick)

Processed within the current event loop tick. Must not use `setTimeout` with a delay. May use `Promise.resolve().then()` (microtask) if React batching requires it, but must not defer beyond the current synchronous execution context.

Events: `VENUE_STATE_UPDATE`, `INCIDENT_UPDATE`, `INCIDENT_CREATED` (S3–S5), `INCIDENT_CLOSED`, `COMMANDER_CLAIMED`, `COMMANDER_RELEASED`, `COMMANDER_LAPSED`, `OVERRIDE_PLACED`, `OVERRIDE_REMOVED`, `REJECTION_STATE_PUSH`

### 4.4 Tier 3 — Informational (500ms Batch Window)

Events are collected in a queue. Every 500ms, the queue is flushed and all collected events are processed as a group. This means:
- Up to 500ms latency is acceptable for Tier 3 events
- Multiple events of the same type for the same entity within one window: apply only the latest (by `timestamp` field)
- Multiple events of different types: apply all

```typescript
class Tier3Batcher {
  private queue: MessageEnvelope[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  enqueue(envelope: MessageEnvelope): void {
    this.queue.push(envelope);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 500);
    }
  }

  private flush(): void {
    const batch = this.deduplicateByLatest(this.queue);
    this.queue = [];
    this.flushTimer = null;
    batch.forEach(envelope => processTier3Event(envelope));
  }
}
```

Events: `ADVISORY_UPDATE`, `DELIVERY_STATE_UPDATE`, `NOTIFICATION_CREATED`, `COLLABORATOR_POSITION`, `ANNOTATION_ADDED`, `ANNOTATION_CONTRADICTION_DETECTED`, `CORPUS_STATUS_UPDATE`

### 4.5 COLLABORATOR_POSITION Throttling

`COLLABORATOR_POSITION` events are throttled to a maximum of 2 per second per `operator_id`. Within any 1-second window, if more than 2 arrive for the same `operator_id`, keep only the latest (highest `updated_at`) and discard the rest. This throttling is applied before the Tier 3 batch window.

```typescript
// Per-collaborator throttle state
const collaboratorLastProcessed = new Map<string, { count: number; window_start: number }>();

function shouldProcessCollaboratorPosition(payload: CollaboratorPositionPayload): boolean {
  const now = Date.now();
  const key = payload.operator_id;
  const entry = collaboratorLastProcessed.get(key);

  if (!entry || now - entry.window_start >= 1000) {
    collaboratorLastProcessed.set(key, { count: 1, window_start: now });
    return true;
  }

  if (entry.count < 2) {
    entry.count++;
    return true;
  }

  // Replace the queued position with this newer one (discard older)
  replaceQueuedCollaboratorPosition(key, payload);
  return false;
}
```

### 4.6 Visual Updates and the Main Thread

Event processing (state updates) runs on the main thread. Visual rendering is handled by React's scheduler. Do not call DOM APIs directly in event handlers. State updates trigger re-renders via React Query cache invalidation or Zustand store updates. Do not use `requestAnimationFrame` to defer state writes — only use it for animation sequencing (e.g. the 300ms pulse on `REJECTION_STATE_PUSH`).

---

## 5. Delivery Guarantees

### 5.1 No Delivery Guarantee

WebSocket provides no per-message delivery guarantee. The system is designed with this assumption: every state entity is self-describing with a `last_updated` timestamp and `sequence_number`. Pushed events are optimistic updates, not authoritative state transfers.

### 5.2 Stale Message Detection

Before applying any pushed update to local state, check the sequence number:

```typescript
function shouldApplyUpdate(
  event: string,
  venue_id: string,
  incoming_sequence: number
): boolean {
  const current = getSequenceNumber(venue_id);
  if (incoming_sequence < current) {
    logClientEvent({
      event,
      sequence_number: incoming_sequence,
      discarded: true,
      reason: 'STALE_SEQUENCE',
    });
    return false;
  }
  setSequenceNumber(venue_id, incoming_sequence);
  return true;
}
```

If `incoming_sequence === current` (exact duplicate): discard silently without logging.
If `incoming_sequence > current + 1` (gap detected): apply the update and trigger a targeted re-fetch to recover any missed state.

### 5.3 Inactivity Re-Fetch

If no push event (of any type) is received for a subscribed venue for more than 30 seconds while the connection is in `CONNECTED` state, trigger a targeted re-fetch for that venue's current state. This is not a reconnect — the WebSocket remains open.

```typescript
// Per-venue last-received tracking
const lastReceivedByVenue = new Map<string, number>(); // venue_id → Date.now()

// Check every 10s
setInterval(() => {
  const now = Date.now();
  for (const venue_id of subscriptionState.venue_ids) {
    const last = lastReceivedByVenue.get(venue_id) ?? now;
    if (now - last > 30_000) {
      refetchVenueState(venue_id);
      lastReceivedByVenue.set(venue_id, now); // reset to avoid repeated re-fetches
    }
  }
}, 10_000);
```

### 5.4 Reconnect State Recovery

On reconnect (after any disconnection and re-establishment):

1. Re-fetch all subscribed entity states (venues, active incidents, active replay sessions)
2. Update React Query cache with re-fetched data
3. Re-send `SUBSCRIBE` message with all entries from `subscriptionState`
4. Remove "Real-time updates paused" indicator
5. Reset all `sequence_number` trackers to the values returned by the re-fetch

Do not assume any cached state is current. The re-fetch is mandatory, not optional.

### 5.5 Session Expiry

If the server closes the WebSocket connection with close code `4001` (session expired) or any auth-related close code in the `4000–4099` range, the client must:

1. Stop reconnect attempts immediately
2. Clear local session state
3. Redirect to the login page

Do not attempt reconnection for auth-related close codes. Any other close code triggers the reconnect flow.

### 5.6 REJECTION_STATE_PUSH Delivery Assurance

After a rejection action completes on the server, the server emits `REJECTION_STATE_PUSH`. The client starts a 5-second timer from the moment the rejection API call returns a success response. If `REJECTION_STATE_PUSH` is not received within 5 seconds:

```typescript
function onRejectionApiSuccess(entity_id: string): void {
  const timer = setTimeout(() => {
    if (!rejectionPushReceived.has(entity_id)) {
      showToast({
        message: 'Session state may be stale',
        action: { label: 'Refresh →', onClick: () => refetchCurrentSurface() },
        variant: 'warning',
        persistent: true,
      });
    }
  }, 5_000);
  pendingRejectionTimers.set(entity_id, timer);
}

function onRejectionStatePush(payload: RejectionStatePushPayload): void {
  rejectionPushReceived.add(payload.entity_id);
  clearTimeout(pendingRejectionTimers.get(payload.entity_id));
  pendingRejectionTimers.delete(payload.entity_id);
  // ... apply state update
}
```

---

## 6. UI Update Rules

### 6.1 `ZONE_B_AUTO_REPLACE`

Applies only to sessions where `operator.role` is `OPERATOR`, `CONTENT_MANAGER`, or `ADMIN`. VIEWER sessions receive this event but must not apply the surface change.

```typescript
function handleZoneBAutoReplace(payload: ZoneBAutoReplacePayload): void {
  if (session.role === 'VIEWER') return;

  // 1. Save current surface for PATCH-014 back navigation
  dispatch({ type: 'SET_PRIOR_SURFACE', surface: activeSurface });

  // 2. If currently in Replay, save position and unsubscribe from session
  if (activeSurface === 'REPLAY') {
    saveReplaySessionPosition();
    realtimeClient.unsubscribe({ session_ids: [activeReplaySessionId] });
  }

  // 3. Force Zone B to IC surface for the incident
  dispatch({ type: 'SET_ACTIVE_SURFACE', surface: 'INCIDENT_COMMAND' });
  dispatch({ type: 'SET_ACTIVE_INCIDENT', incident_id: payload.incident_id });

  // 4. Render PATCH-014 orientation banner at Zone B bottom
  dispatch({
    type: 'SET_ZONE_B_ORIENTATION_BANNER',
    message: 'You were automatically brought here',
    action: {
      label: 'View Venue Dashboard →',
      onClick: () => navigateToPriorSurface(),
    },
  });

  // 5. Zone A, Zone C, System Status Bar: NOT reset
}
```

Zone A continues updating normally. Zone C is not closed or reset. The System Status Bar continues rendering current state.

The orientation banner (`PATCH-014`) persists until the operator manually navigates away. It is rendered at the bottom of Zone B, not as an overlay. It does not block interaction.

### 6.2 `VENUE_STATE_UPDATE`

```typescript
function handleVenueStateUpdate(payload: VenueStateUpdatePayload): void {
  // 1. Stale sequence check
  if (!shouldApplyUpdate('VENUE_STATE_UPDATE', payload.venue_id, payload.sequence_number)) return;

  // 2. Update React Query cache (targeted, not full list invalidation)
  queryClient.setQueryData(['venue', payload.venue_id], (prev: VenueRecord) => ({
    ...prev,
    machine_state: payload.machine_state,
    trust_state: payload.trust_state,
    constitutional_state: payload.constitutional_state,
    last_updated: payload.last_updated,
    sequence_number: payload.sequence_number,
  }));

  // 3. Update Zone A state dot
  updateVenueStateDot(payload.venue_id, payload.machine_state, payload.trust_state);

  // 4. RECOVERED_BUT_UNTRUSTED handling
  if (payload.machine_state === 'RECOVERED_BUT_UNTRUSTED') {
    // PATCH-009: amber LIVE — UNVERIFIED pill in Zone B if this venue is active
    // PATCH-007: rotating ↻ dot at #FB923C in Zone A
    applyRecoveredButUntrustedState(payload.venue_id);
  } else if (payload.previous_machine_state === 'RECOVERED_BUT_UNTRUSTED') {
    // Machine state leaving RECOVERED_BUT_UNTRUSTED: revert to appropriate dot
    revertRecoveredButUntrustedState(payload.venue_id, payload.machine_state);
  }

  // 5. Zone B scroll position: NOT reset
}
```

Zone A state dot colors are derived from `machine_state` and `trust_state` together. See Zone A component specification for the full dot-state matrix. The rotating `↻` animation for `RECOVERED_BUT_UNTRUSTED` (PATCH-007) is CSS-driven; toggling the state class is sufficient.

### 6.3 `INCIDENT_UPDATE`

```typescript
function handleIncidentUpdate(payload: IncidentUpdatePayload): void {
  // 1. Update React Query cache
  queryClient.setQueryData(['incident', payload.incident_id], (prev: IncidentRecord) => ({
    ...prev,
    ...payload.current_state,
    updated_at: payload.updated_at,
  }));

  // 2. Update Zone A IncidentList entry
  queryClient.setQueryData(['incidents', 'list'], (prev: IncidentRecord[]) =>
    prev.map(i => i.incident_id === payload.incident_id
      ? { ...i, ...payload.current_state }
      : i
    )
  );

  // 3. Severity change: update Zone A badge color (PATCH-004 color rules)
  if (payload.updated_fields.includes('severity')) {
    updateIncidentBadgeColor(payload.incident_id, payload.current_state.severity!);
  }

  // 4. Commander change: update Incident Identity Bar if IC surface is active for this incident
  if (payload.updated_fields.includes('commander_id') && activeIncidentId === payload.incident_id) {
    updateIncidentIdentityBar(payload.incident_id);
  }

  // 5. Severity conflict check: if severity modal is open, show conflict toast and close modal
  if (payload.updated_fields.includes('severity') && isSeverityModalOpen(payload.incident_id)) {
    showToast({
      message: 'Severity was updated by another operator. Your change was not applied.',
      variant: 'warning',
      persistent: false,
    });
    closeSeverityModal(payload.incident_id);
  }
}
```

### 6.4 `COMMANDER_LAPSED`

```typescript
function handleCommanderLapsed(payload: CommanderLapsedPayload): void {
  // 1. Set commander_lapsed_at from event payload (never compute server time)
  queryClient.setQueryData(['incident', payload.incident_id], (prev: IncidentRecord) => ({
    ...prev,
    commander_id: null,
    commander_lapsed_at: payload.lapsed_at,
  }));

  // 2. Client computes time-since-lapse from lapsed_at
  // The IC surface reads commander_lapsed_at from cache and renders a live countdown
  // No server-side countdown data is expected or required

  // 3. Level 1 constitutional alert in IC surface (if currently viewing this incident)
  if (activeIncidentId === payload.incident_id && activeSurface === 'INCIDENT_COMMAND') {
    dispatch({ type: 'SHOW_COMMANDER_LAPSED_ALERT', incident_id: payload.incident_id });
  }

  // PATCH-012: IC surface shows "Currently viewing: N operators — [Notify all →]"
  // This is derived from collaborator presence state, not from this event
  // This event triggers the alert; presence count is read from existing collaborator state
}
```

The client must never use its own clock to determine when the commander lapse occurs. The `lapsed_at` timestamp from the server is the authoritative lapse time. The client only uses its clock to compute the elapsed duration for display purposes.

### 6.5 `OVERRIDE_PLACED` / `OVERRIDE_REMOVED`

```typescript
function handleOverrideChange(payload: OverridePayload): void {
  // 1. Update overrides list in incident state
  queryClient.setQueryData(['incident', payload.incident_id], (prev: IncidentRecord) => {
    const overrides = payload.action === 'PLACED'
      ? [...prev.overrides, {
          override_id: payload.override_id,
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          placed_by: payload.placed_by,
          placed_at: payload.placed_at,
          removed_at: null,
        }]
      : prev.overrides.map(o =>
          o.override_id === payload.override_id
            ? { ...o, removed_at: payload.removed_at }
            : o
        );
    return { ...prev, overrides };
  });

  // 2. Set Tab 3 red dot badge (PATCH-010) if overrides are active
  updateTab3BadgeDot(payload.incident_id);
}
```

Entity highlighting from `REJECTION_STATE_PUSH` (the 300ms `#FBC02D` pulse) is handled separately when that event arrives — the `OVERRIDE_PLACED`/`REMOVED` handler does not apply the pulse directly.

### 6.6 `ADVISORY_UPDATE` (A-NEW-01)

```typescript
function handleAdvisoryUpdate(payload: AdvisoryUpdatePayload): void {
  // 1. Update Zone C Pane C4 content
  dispatch({ type: 'SET_ADVISORY', advisory: payload });

  // 2. Visual state change based on advisory_level
  // INFORMATIONAL: no border/background change (normal state)
  // RECOMMENDED: amber border (#F59E0B) + amber background tint (#FFFBEB)
  // URGENT: deep-orange background (#FFF3E0) + border (#F97316) + single pulse animation
  dispatch({ type: 'SET_ADVISORY_VISUAL_STATE', level: payload.advisory_level });

  // 3. Add to NotificationTray for RECOMMENDED or URGENT
  if (payload.advisory_level === 'RECOMMENDED' || payload.advisory_level === 'URGENT') {
    addNotification({
      source: 'ADVISORY',
      title: payload.title,
      body: payload.body,
      severity: payload.advisory_level === 'URGENT' ? 'WARNING' : 'INFO',
      advisory_id: payload.advisory_id,
    });
  }

  // 4. Zone C scroll position: NOT reset
}
```

The "single pulse" for `URGENT` is a one-time CSS animation triggered by adding a class. It does not loop. It fires once on level transition.

### 6.7 `REJECTION_STATE_PUSH` (A-NEW-04)

```typescript
function handleRejectionStatePush(payload: RejectionStatePushPayload): void {
  // 1. Clear the 5-second stale-state timer if pending
  onRejectionStatePush(payload);

  // 2. Apply entity-specific update to cache
  updateEntityInCache(payload.entity_type, payload.entity_id, payload.current_state);

  // 3. 300ms #FBC02D highlight pulse on the affected entity's DOM element
  // Use a ref or a query to locate the element by entity_id data attribute
  const element = document.querySelector(`[data-entity-id="${payload.entity_id}"]`);
  if (element) {
    element.classList.add('rejection-pulse');
    setTimeout(() => element.classList.remove('rejection-pulse'), 300);
  }

  // 4. Do NOT reset scroll position
}
```

CSS for the pulse:
```css
@keyframes rejection-pulse {
  0%   { background-color: transparent; }
  30%  { background-color: #FBC02D; }
  100% { background-color: transparent; }
}

.rejection-pulse {
  animation: rejection-pulse 300ms ease-out forwards;
}
```

### 6.8 `COLLABORATOR_POSITION` (A-NEW-03)

```typescript
function handleCollaboratorPosition(payload: CollaboratorPositionPayload): void {
  // 1. Throttle check (2/second per operator_id)
  if (!shouldProcessCollaboratorPosition(payload)) return;

  // 2. Update collaborator timeline position in replay session state
  dispatch({
    type: 'UPDATE_COLLABORATOR_POSITION',
    operator_id: payload.operator_id,
    timeline_position_ms: payload.timeline_position_ms,
    updated_at: payload.updated_at,
  });

  // 3. Update session header avatar position label
  // Rendered by the ReplaySessionHeader component reading from session state

  // 4. Update scrubber track pip position
  // Rendered by the ReplayTimelineScrubber component reading from session state

  // 5. Do NOT interrupt operator's own transport controls
  // The operator's own position is stored separately and is never overwritten by incoming collaborator positions
}
```

The operator's own scrubber position is stored under `replay_session.own_position_ms`. Incoming `COLLABORATOR_POSITION` events only update `replay_session.collaborators[operator_id].timeline_position_ms`. These are distinct state paths and must not be conflated.

### 6.9 `ANNOTATION_ADDED`

```typescript
function handleAnnotationAdded(payload: AnnotationAddedPayload): void {
  // 1. Append to annotation list, sorted by server_received_at (ascending)
  dispatch({ type: 'ADD_ANNOTATION', annotation: payload });
  // Sort is applied at render time, not on every update (performance)

  // 2. Contradiction flag handling
  if (payload.contradiction_flag) {
    // Mark this annotation and the one it contradicts
    dispatch({
      type: 'MARK_CONTRADICTION',
      annotation_id_a: payload.annotation_id,
      annotation_id_b: payload.contradicts_annotation_id!,
    });
    // Set Tab 3 amber dot (PATCH-010)
    setTab3ContradictionDot(payload.session_id, true);
  }
}
```

### 6.10 `ANNOTATION_CONTRADICTION_DETECTED`

```typescript
function handleAnnotationContradiction(payload: AnnotationContradictionPayload): void {
  // 1. Mark both annotations as contradicting in local state
  dispatch({
    type: 'MARK_CONTRADICTION',
    annotation_id_a: payload.annotation_id_a,
    annotation_id_b: payload.annotation_id_b,
  });

  // 2. Inline ⚠ CONTRADICTION divider is rendered by the annotation list component
  // when both annotations have contradiction_with: [other_id] set

  // 3. Maintain Tab 3 amber dot (idempotent — does not clear on re-fire)
  setTab3ContradictionDot(payload.session_id, true);
}
```

The `⚠ CONTRADICTION` divider is a derived render — it appears between annotation A and annotation B when both reference each other. It is not a stored entity. The component calculates it from the annotation list state on each render.

---

## 7. Replay/Live Separation

### 7.1 Separation Contract

When an operator is in the Replay surface, the following separation rules apply:

| Event Type | Processing Behavior |
|---|---|
| `COLLABORATOR_POSITION` | Processed and rendered in Replay surface |
| `ANNOTATION_ADDED` | Processed and rendered in Replay surface |
| `ANNOTATION_CONTRADICTION_DETECTED` | Processed and rendered in Replay surface |
| `DELIVERY_STATE_UPDATE` | Processed for the Replay surface's corpus context |
| `ZONE_B_AUTO_REPLACE` | Suspends replay; does NOT update replay surface (see 7.2) |
| `INCIDENT_CREATED`, `VENUE_STATE_UPDATE`, etc. | Processed for Zone A and System Status Bar; NOT applied to Zone B |

### 7.2 Auto-Replace While in Replay

When `ZONE_B_AUTO_REPLACE` arrives and the operator is currently in the Replay surface:

1. Save current replay session position (`replay_session.own_position_ms`)
2. Save session state to `prior_replay_session` in session store
3. Send `UNSUBSCRIBE` for the active `session_id`
4. Apply Zone B auto-replace (Section 6.1)
5. Render the PATCH-014 banner noting the prior surface was Replay (not the generic "Venue Dashboard" link — use "Return to Replay →" if a replay session was in progress)

Replay session state is preserved. If the operator navigates back to Replay using the PATCH-014 link, the prior position is restored and a `SUBSCRIBE` is re-sent for the session_id.

### 7.3 IC-03 Enforcement

The `is_replay_mode: boolean` flag on session state controls write access. This is checked before every write operation regardless of which event triggered the UI state.

```typescript
function dispatchWrite(action: WriteAction): void {
  if (sessionState.is_replay_mode) {
    logClientEvent({
      event: 'IC03_ENFORCEMENT_GAP',
      session_id: sessionState.session_id,
      attempted_action: action.type,
      mode: 'REPLAY',
    });
    sendTelemetry('IC03_ENFORCEMENT_GAP', {
      session_id: sessionState.session_id,
      attempted_action: action.type,
      mode: 'REPLAY',
    });
    return; // silently blocked — do not show error to operator
  }
  // proceed with write
}
```

`is_replay_mode` is derived from the current surface, not from any server event. When `active_surface === 'REPLAY'`, `is_replay_mode` is `true`. This derivation is pure and synchronous.

### 7.4 Live Event Processing in Replay Context

Zone A and the System Status Bar must continue updating from live events even when the operator is in the Replay surface. This is not optional — operators watching a replay must see live venue health.

The routing rule is:
- Live events affecting Zone A state (venue dots, incident list, notifications): always processed
- Live events that would update Zone B: discarded (Zone B is in Replay; it belongs to the replay session)
- Live events affecting System Status Bar: always processed

---

## 8. Connection Health and Degraded Mode

### 8.1 Connection States

```typescript
type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';
```

- `CONNECTING`: initial connection attempt in progress
- `CONNECTED`: WebSocket open, heartbeat active
- `RECONNECTING`: connection lost, backoff retry in progress
- `FAILED`: permanent failure (should not occur in normal operation — auth failures cause redirect, not FAILED state)

### 8.2 Operator Notification

When `connectionState` transitions to `RECONNECTING` or `FAILED`, the System Status Bar displays a persistent amber indicator: **"Real-time updates paused — reconnecting..."**

This indicator:
- Is non-blocking (does not disable interaction)
- Is not a toast (it is a persistent element in the System Status Bar)
- Is removed when `connectionState` returns to `CONNECTED`
- Must not cause layout shift in other System Status Bar indicators

### 8.3 Reconnect Backoff

```typescript
const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const BACKOFF_CAP_MS = 30000;

function getBackoffDelay(attempt: number): number {
  if (attempt < BACKOFF_SCHEDULE_MS.length) {
    return BACKOFF_SCHEDULE_MS[attempt];
  }
  return BACKOFF_CAP_MS; // hold at 30s indefinitely
}
```

Reconnect attempts are unlimited. Operators must not lose the ability to reconnect during a long shift. Do not implement a maximum attempt count.

### 8.4 Heartbeat

The client sends a `ping` frame every 25 seconds. If a `pong` is not received within 10 seconds of sending the `ping`, the connection is treated as dead and the reconnect flow begins.

```typescript
// Heartbeat implementation
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;

function startHeartbeat(): void {
  pingTimer = setInterval(() => {
    ws.ping();
    pongTimeout = setTimeout(() => {
      // pong not received within 10s — treat as disconnected
      ws.terminate();
      beginReconnect();
    }, 10_000);
  }, 25_000);
}

function onPong(): void {
  if (pongTimeout) {
    clearTimeout(pongTimeout);
    pongTimeout = null;
  }
}

function stopHeartbeat(): void {
  if (pingTimer) clearInterval(pingTimer);
  if (pongTimeout) clearTimeout(pongTimeout);
}
```

If the browser's native WebSocket does not expose `ping()` (browser WebSocket API does not), implement an application-level heartbeat using a JSON message:

```typescript
// Application-level heartbeat (browser environments)
const HEARTBEAT_EVENT = 'PING';
const HEARTBEAT_RESPONSE = 'PONG';

ws.send(JSON.stringify({ event: HEARTBEAT_EVENT, payload: {}, sequence_number: 0, timestamp: new Date().toISOString() }));
```

The server must respond with `PONG`. If no `PONG` is received within 10 seconds, treat as disconnected.

### 8.5 Reconnect Recovery Sequence

On successful reconnect:

1. Stop backoff timer
2. Set `connectionState` to `CONNECTED`
3. Re-fetch all subscribed entities (in parallel):
   - All venues in `subscriptionState.venue_ids`
   - All incidents in `subscriptionState.incident_ids`
   - All replay sessions in `subscriptionState.session_ids`
4. Update React Query cache with re-fetched data
5. Reset all `sequence_number` trackers to values from re-fetched data
6. Send `SUBSCRIBE` with current `subscriptionState` contents
7. Start heartbeat
8. Remove "Real-time updates paused" indicator from System Status Bar

Steps 3–6 must complete before step 8. The indicator must not be removed while re-fetch is in progress.

---

## 9. Client-Side Event Logging

### 9.1 Logged Events

All Priority Tier 1 and Tier 2 events are logged to an in-memory client-side event log.

```typescript
interface ClientEventLogEntry {
  event: string;
  sequence_number: number;
  received_at: string;    // ISO 8601 UTC — when the message arrived at the WebSocket handler
  processed_at: string;   // ISO 8601 UTC — when the state update was applied
  venue_id?: string;
  incident_id?: string;
  discarded?: boolean;
  discard_reason?: 'STALE_SEQUENCE' | 'DUPLICATE' | 'ROLE_GATE';
}
```

Tier 3 events are not logged (volume is too high for in-memory retention; `COLLABORATOR_POSITION` alone could generate thousands of entries per session).

### 9.2 Log Retention

The log is held in memory only. It is cleared on logout. It is not persisted to localStorage or sent to the server (except for the `IC03_ENFORCEMENT_GAP` telemetry below).

Maximum retained entries: 10,000. When the limit is reached, drop the oldest 1,000 entries (ring buffer behavior, not FIFO eviction on every insert).

### 9.3 ADMIN Access

The client event log is accessible to operators with `ADMIN` role via a developer panel (accessible through the OperatorTools section in Zone A). The panel displays:
- Filterable, scrollable list of log entries
- Filter by event type, venue_id, discarded flag
- Export as JSON (downloads to file)

This panel is not rendered at all for VIEWER, OPERATOR, or CONTENT_MANAGER roles — not hidden, not disabled: not present in the DOM.

### 9.4 IC03_ENFORCEMENT_GAP Telemetry

When a write operation is blocked by the `is_replay_mode` check (Section 7.3), the event is both logged locally and sent to the server as telemetry:

```typescript
interface IC03EnforcementGapTelemetry {
  session_id: string;
  attempted_action: string;
  mode: 'REPLAY';
  occurred_at: string;     // ISO 8601 UTC
}

// Telemetry endpoint
POST /api/telemetry/ic03-enforcement-gap
Content-Type: application/json
Authorization: Bearer <session_token>
Body: IC03EnforcementGapTelemetry
```

This telemetry is fire-and-forget. If the request fails (e.g. during reconnect), do not retry. The local log entry is sufficient for forensic purposes.

### 9.5 Sequence Gap Logging

When a message arrives with `sequence_number > current + 1` (gap detected, Section 5.2), log:

```typescript
{
  event: 'SEQUENCE_GAP_DETECTED',
  venue_id: payload.venue_id,
  expected_sequence: current + 1,
  received_sequence: payload.sequence_number,
  gap_size: payload.sequence_number - (current + 1),
  received_at: new Date().toISOString(),
  processed_at: null,    // the triggering event is still processed
}
```

This entry appears in the ADMIN developer panel and is useful for diagnosing delivery issues in the field.

---

## Appendix A: Event Processing Decision Tree

```
WebSocket message received
        │
        ▼
Parse JSON envelope
        │
        ├─ Parse failure → log error, discard
        │
        ▼
Sequence number check (if venue-scoped)
        │
        ├─ incoming < current → discard silently
        ├─ incoming == current → discard silently (duplicate)
        ├─ incoming > current + 1 → apply + log gap + trigger re-fetch
        └─ incoming == current + 1 → apply normally
        │
        ▼
Priority tier check
        │
        ├─ Tier 1 → process synchronously now
        ├─ Tier 2 → process in current tick
        └─ Tier 3 → enqueue for 500ms batch
                    (COLLABORATOR_POSITION: throttle first)
        │
        ▼
Role gate check (ZONE_B_AUTO_REPLACE only)
        │
        ├─ VIEWER → discard
        └─ OPERATOR+ → apply
        │
        ▼
State update (React Query / Zustand)
        │
        ▼
Log entry (Tier 1 + Tier 2 only)
```

---

## Appendix B: Complete Client→Server Message Reference

```typescript
// Subscribe to venue/incident/session updates
{
  event: 'SUBSCRIBE',
  payload: SubscribePayload,
  sequence_number: 0,
  timestamp: string
}

// Remove subscriptions
{
  event: 'UNSUBSCRIBE',
  payload: UnsubscribePayload,
  sequence_number: 0,
  timestamp: string
}

// Send own position during replay (debounced, max 1 per 500ms)
{
  event: 'COLLABORATOR_POSITION_UPDATE',
  payload: CollaboratorPositionUpdatePayload,
  sequence_number: 0,
  timestamp: string
}

// Application-level heartbeat (browser environments)
{
  event: 'PING',
  payload: {},
  sequence_number: 0,
  timestamp: string
}
```

`COLLABORATOR_POSITION_UPDATE` must be debounced at 500ms. If the operator moves the scrubber continuously, send at most one update per 500ms. Send the final position after scrubbing stops (trailing edge debounce).

---

## Appendix C: Zone A State Dot Color Reference

Zone A state dots update exclusively via push (`VENUE_STATE_UPDATE`). They are never polled.

| `machine_state` | `trust_state` | Dot Color | Animation |
|---|---|---|---|
| `LIVE` | `TRUSTED` | `#22C55E` (green) | none |
| `LIVE` | `UNVERIFIED` | `#FB923C` (amber) | rotating ↻ (PATCH-007) |
| `LIVE` | `UNTRUSTED` | `#EF4444` (red) | none |
| `RECOVERED_BUT_UNTRUSTED` | any | `#FB923C` (amber) | rotating ↻ (PATCH-007) |
| `INCIDENT` | any | `#EF4444` (red) | none |
| `DEGRADED` | any | `#F97316` (orange) | none |
| `OFFLINE` | any | `#6B7280` (gray) | none |
| `INITIALIZING` | any | `#94A3B8` (slate) | pulsing |
| `SYNCING` | any | `#60A5FA` (blue) | pulsing |

---

*This document is authoritative for all real-time event handling in the ClubHub TV operator CMS frontend. Any deviation from these specifications must be recorded as a documented exception with rationale and reviewed before merge.*
