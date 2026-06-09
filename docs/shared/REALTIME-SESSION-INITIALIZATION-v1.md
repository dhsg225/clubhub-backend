# REALTIME-SESSION-INITIALIZATION-v1

**Document class:** Frontend Runtime Specification
**Status:** AUTHORITATIVE
**Applies to:** CMS operator web application — React 18, TypeScript, Vite 5
**Monorepo packages:** `@clubhub/api`, `@clubhub/state`
**Last updated:** 2026-06-05

---

## 0. Purpose

This document defines the exact sequence by which the `RealtimeClient` WebSocket connection is established, authenticated, and made ready to receive events when the CMS operator application boots. It covers:

- The `RealtimeClient` TypeScript interface and internal state machine
- The numbered boot connection sequence from AuthGate to first event delivery
- Reconnection behavior and backoff schedule
- Surface-specific subscription management
- Live vs. replay mode event processing divergence
- Sequence number handling and stale message protection
- The heartbeat protocol
- Error state handling and close codes
- The `wsStore` Zustand shape
- Testing contracts

A developer must be able to implement a conforming `RealtimeClient` from this document alone, without further discussion. No new governance, roles, workflows, or system states are introduced here.

---

## 1. RealtimeClient TypeScript Interface

### 1.1 Location and Singleton Contract

**File:** `packages/@clubhub/api/src/websocket.ts`

`RealtimeClient` is exported as a singleton instance. One instance is created at application bootstrap and shared via React context. Calling `new RealtimeClient()` outside of `packages/@clubhub/api/src/websocket.ts` is prohibited and enforced by the `no-new-realtime-client` ESLint rule.

### 1.2 Configuration

```typescript
interface RealtimeClientConfig {
  /** WebSocket base URL. Example: "wss://api.clubhub.tv" */
  baseUrl: string;

  /**
   * Interval between outbound ping frames, in milliseconds.
   * Default: 25000 (25 seconds — below standard 30s proxy timeout).
   */
  heartbeatInterval: number;

  /**
   * Time to wait for a pong response before closing the connection, in milliseconds.
   * Default: 10000 (10 seconds).
   */
  pongTimeout: number;

  /**
   * Maximum backoff delay between reconnect attempts, in milliseconds.
   * Default: 30000 (30 seconds).
   */
  maxReconnectDelay: number;
}

const DEFAULT_CONFIG: RealtimeClientConfig = {
  baseUrl: '',
  heartbeatInterval: 25_000,
  pongTimeout: 10_000,
  maxReconnectDelay: 30_000,
};
```

### 1.3 Connection State Machine

```typescript
type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

/**
 * Valid state transitions:
 *
 *   DISCONNECTED  → CONNECTING    connect() called with valid token
 *   CONNECTING    → CONNECTED     server handshake received
 *   CONNECTING    → FAILED        close code 4001 or 4003 received
 *   CONNECTING    → RECONNECTING  network failure before handshake completes
 *   CONNECTED     → RECONNECTING  connection lost, close code is not 4001/4003
 *   CONNECTED     → DISCONNECTED  disconnect() called explicitly by the application
 *   RECONNECTING  → CONNECTING    backoff delay elapsed, next attempt begins
 *   RECONNECTING  → FAILED        close code 4001 or 4003 received during reconnect
 *   FAILED        → (terminal)    no further transitions; page reload required
 *
 * All other transition attempts are silent no-ops.
 * Calling connect() in FAILED state throws.
 */
```

### 1.4 Wire Message Types

```typescript
/** First application frame sent by the server after upgrade. */
interface ServerHandshake {
  type: 'session_init';
  session_id: string;
  operator_id: string;
  sequence_number: 0;
}

/** Server response to a client ping frame. */
interface ServerPong {
  type: 'pong';
  timestamp: number;       // server-authoritative Unix milliseconds
  sequence_number: number; // advances like any other server event
}

/** All operational event frames from the server. */
interface ServerEvent {
  type: string;
  channel: string;
  payload: unknown;
  sequence_number: number; // monotonically increasing per session
  timestamp: number;       // server-authoritative Unix milliseconds
}

/** Outbound ping frame. Timestamp is server-authoritative, NOT Date.now(). */
interface ClientPing {
  type: 'ping';
  timestamp: number; // taken from wsStore.lastServerTime
}

interface ClientSubscribe {
  type: 'subscribe';
  channel: string;
}

interface ClientUnsubscribe {
  type: 'unsubscribe';
  channel: string;
}
```

### 1.5 Class Interface

```typescript
type ChannelName = string;
// Examples: "fleet", "incident:42", "venue:7", "cms:3", "cms", "replay:abc123"

type LifecycleEvent =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

class RealtimeClient {

  // ── Public readonly properties ──────────────────────────────────────────

  /**
   * Current position in the state machine.
   * Mirrored to wsStore.connectionState on every transition, synchronously,
   * before any lifecycle handlers fire.
   */
  readonly connectionState: ConnectionState;

  /**
   * Session ID assigned by the server in the handshake.
   * Null until the first CONNECTED transition.
   * Reset to null on disconnect or reconnect (before new handshake).
   */
  readonly sessionId: string | null;

  /**
   * Sequence number of the last frame received from the server this session.
   * Zero before the first event is processed.
   * Mirrored to wsStore.lastSequenceNumber after every accepted event.
   */
  readonly sequenceNumber: number;

  // ── Connection lifecycle ────────────────────────────────────────────────

  /**
   * Begin the connection sequence. The token must already be present in
   * @clubhub/api module-level memory before this is called; the caller
   * (AuthGate / RealtimeProvider) is responsible for ensuring this.
   *
   * WS URL constructed as: wss://{host}/ws?token={jwt}
   * Token is passed as a query parameter because the browser WebSocket API
   * does not permit setting custom headers on the upgrade handshake.
   *
   * Transition: DISCONNECTED → CONNECTING
   * No-op if already CONNECTING, CONNECTED, or RECONNECTING.
   * Throws if connectionState === 'FAILED'.
   */
  connect(token: string): void;

  /**
   * Tear down the connection cleanly.
   * Stops heartbeat, clears internal state, does NOT trigger reconnect.
   * Transition: any → DISCONNECTED
   */
  disconnect(): void;

  // ── Subscription management ─────────────────────────────────────────────

  /**
   * Register a handler for events arriving on the given channel.
   * Sends a ClientSubscribe frame to the server.
   * Multiple distinct handler references per channel are permitted; all
   * are called in registration order.
   * Idempotent: registering the same handler reference twice is a no-op.
   * Updates wsStore.channels (addChannel) before the wire frame is sent.
   */
  subscribe(channel: ChannelName, handler: (event: ServerEvent) => void): void;

  /**
   * Remove a specific handler from a channel.
   * If no handlers remain for the channel after removal, sends a
   * ClientUnsubscribe frame to the server.
   * Updates wsStore.channels (removeChannel) after the wire frame is sent.
   */
  unsubscribe(channel: ChannelName, handler: (event: ServerEvent) => void): void;

  // ── Outbound messaging ──────────────────────────────────────────────────

  /**
   * Send an event frame to the server.
   * Throws if connectionState !== 'CONNECTED'.
   */
  send(eventType: string, payload: unknown): void;

  // ── Introspection ───────────────────────────────────────────────────────

  /** Returns the current connection state. Equivalent to reading connectionState. */
  getState(): ConnectionState;

  // ── Lifecycle hooks ─────────────────────────────────────────────────────

  /**
   * Register a listener for state machine transitions.
   * The handler fires synchronously after wsStore is updated and after
   * connectionState / sessionId properties are updated on the instance.
   * Returns an unsubscribe function.
   */
  on(lifecycle: LifecycleEvent, handler: () => void): () => void;
}
```

---

## 2. Boot Connection Sequence

This sequence begins after `AuthGate` has confirmed that a valid JWT is present in `@clubhub/api` module-level memory. It ends when the heartbeat timer is armed and the first surface events can be received.

```
AuthGate confirmed — token in @clubhub/api memory
         │
         ▼

Step 1   Read token from @clubhub/api module-level variable.
         Token is NEVER read from localStorage or sessionStorage.
         If token is absent: redirect immediately to /login. Do not proceed.

Step 2   Construct WebSocket URL:
           wss://{window.location.host}/ws?token={jwt}
         The token is placed in the query string because the browser
         WebSocket API does not support setting Authorization headers
         on the HTTP upgrade request.

Step 3   Call realtimeClient.connect(token).
         State machine: DISCONNECTED → CONNECTING.
         wsStore.connectionState written to 'CONNECTING' synchronously
         before connect() returns.

Step 4   The browser opens the WebSocket. TCP and TLS handshake occurs.
         No application-level frames are sent by the client at this stage.

Step 5   Server sends the ServerHandshake frame (first application message):
           { type: "session_init", session_id, operator_id, sequence_number: 0 }

Step 6   Client processes the handshake:
           a. Set realtimeClient.sessionId = session_id.
           b. Set realtimeClient.sequenceNumber = 0.
           c. Set wsStore.lastServerTime = handshake timestamp (if present)
              or current server-authoritative time if not yet available.
           d. State machine: CONNECTING → CONNECTED.
           e. Write to wsStore synchronously:
                { connectionState: 'CONNECTED',
                  sessionId: session_id,
                  lastSequenceNumber: 0 }
           f. Fire all 'connected' lifecycle handlers.

Step 7   Register global chrome subscriptions (always active, all surfaces).
         Each call sends one ClientSubscribe frame to the server and
         calls wsStore.addChannel() before the wire frame is sent:

           subscribe('system_health',   globalHealthHandler)
           subscribe('incident_global', globalIncidentHandler)
           subscribe('venue_state',     globalVenueHandler)

         After step 7: wsStore.channels = { 'system_health',
                                             'incident_global',
                                             'venue_state' }

Step 8   Register surface-specific subscriptions for the active surface.
         See Section 4 for the per-surface channel list.
         wsStore.channels is updated for each addition.

Step 9   Ensure event handler processing pipeline is registered in this order:
           a. Sequence number guard (runs first; discards stale/duplicate events).
           b. Replay mode guard (discards live events when replayStore.replayMode
              is true; see Section 5).
           c. React Query cache updater.
           d. Zustand store updaters (authStore, uiStore, wsStore as applicable).
           e. UI notification dispatcher.
         These handlers are registered once in RealtimeProvider at mount.
         They are not unregistered until app teardown.

Step 10  Start the heartbeat timer:
           setInterval(sendPing, config.heartbeatInterval)  // 25 000 ms
         The heartbeat timer MUST NOT start before Step 6d (CONNECTED confirmed).
         wsStore.lastHeartbeatAt is written each time a ping is dispatched.

Step 11  React Query parallel prefetch (initiated by AuthGate, confirmed here):
           queryClient.prefetchQuery(['operator', 'me'])
           queryClient.prefetchQuery(['venues', 'all'])
           queryClient.prefetchQuery(['incidents', 'active'])
         These run in parallel with Steps 7–10. They are not gated on WS
         readiness. If already in-flight from AuthGate, this is a no-op.

Step 12  Application renders the active surface. First WS events may arrive
         concurrently with this render. The sequence number guard (step 9a)
         is active before any component renders, so no event can bypass it.
```

---

## 3. Reconnection Behavior

### 3.1 Backoff Schedule

| Attempt | Delay before next connect() call |
|--------:|---------------------------------:|
| 1       | 1 s                              |
| 2       | 2 s                              |
| 3       | 4 s                              |
| 4       | 8 s                              |
| 5       | 16 s                             |
| 6+      | 30 s (cap, unlimited retries)    |

Retries are unlimited unless the close code is 4001 or 4003. The delay is applied before the next `connect()` call. Close code 1001 (going away) overrides to 0 ms initial delay. Close code 1011 (server error) overrides to begin at attempt 3 (4 s initial delay).

```typescript
function getBackoffMs(attempt: number, closeCode?: number): number {
  if (closeCode === 1001) return 0;
  const schedule = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
  const index = closeCode === 1011
    ? Math.min(attempt + 2, schedule.length - 1)
    : Math.min(attempt, schedule.length - 1);
  return schedule[index];
}
```

### 3.2 Reconnect Procedure

On entering RECONNECTING state:

1. Stop the heartbeat timer immediately (`clearInterval`, `clearTimeout` for pending pong).
2. Reset `sessionId` to null. Do NOT clear `wsStore.channels` — the subscription set is preserved for re-registration.
3. Write to wsStore: `{ connectionState: 'RECONNECTING', reconnectAttempts: N }`.
4. Fire all 'reconnecting' lifecycle handlers.
5. Wait for the backoff delay for attempt N.
6. Re-read token from `@clubhub/api` memory. If absent, redirect to `/login` and stop.
7. Call `connect(token)`. State machine: RECONNECTING → CONNECTING.
8. On the next CONNECTED transition:
   a. Re-register all subscriptions currently in `wsStore.channels` by sending one
      `ClientSubscribe` frame per channel, in insertion order.
   b. Call `queryClient.invalidateQueries()` for all currently active query keys
      to reconcile any state missed during the disconnection.
   c. Restart the heartbeat timer.
   d. Reset `wsStore.reconnectAttempts` to 0.

### 3.3 Operator-Visible Behavior During RECONNECTING

- **Zone A (left nav, 280px):** connectivity indicator dot turns amber. No label or text change.
- **Zone B (fluid center):** NO error overlay is shown. Reconnect is silent to the operator.
- **Zone C (right panel, 320px, collapsible):** no change.
- **After 90 seconds of continuous RECONNECTING without reaching CONNECTED:** surface a non-blocking amber banner in Zone B reading "Connection interrupted — attempting to reconnect". Operator interaction is not blocked.
- **On CONNECTED after the 90-second banner:** dismiss the banner automatically. No operator action required.

---

## 4. Surface-Specific Subscription Management

### 4.1 Global Chrome Subscriptions (always active)

Established in boot Step 7. Never unsubscribed while the application is running. Always re-registered first during reconnect re-subscription (step 8a of Section 3.2).

| Channel           | Event types handled                                                            |
|-------------------|--------------------------------------------------------------------------------|
| `system_health`   | `SYSTEM_HEALTH_UPDATE` — updates wsStore.lastServerTime for heartbeat           |
| `incident_global` | `INCIDENT_CREATED` — updates incident list in React Query and Zustand           |
| `venue_state`     | `VENUE_STATE_UPDATE` for all venues — updates venue trust state in React Query  |

### 4.2 Live Ops Surface

```typescript
// On surface mount:
realtimeClient.subscribe('fleet', fleetEventHandler);

// On surface unmount (useEffect cleanup):
realtimeClient.unsubscribe('fleet', fleetEventHandler);
```

### 4.3 Incident Command Surface

```typescript
// On surface mount (incidentId from route params):
realtimeClient.subscribe(`incident:${incidentId}`, incidentEventHandler);

// On surface unmount:
realtimeClient.unsubscribe(`incident:${incidentId}`, incidentEventHandler);
```

Navigating between incidents unmounts the current surface (cleanup fires `unsubscribe`) then mounts the next (new `subscribe` fires). There is no window where neither subscription is active.

### 4.4 Venue Ops Surface

```typescript
// On surface mount (venueId from route params):
realtimeClient.subscribe(`venue:${venueId}`, venueEventHandler);

// On surface unmount:
realtimeClient.unsubscribe(`venue:${venueId}`, venueEventHandler);
```

### 4.5 CMS Ops Surface

```typescript
// On surface mount:
// If a specific venue is selected in the content browser:
realtimeClient.subscribe(`cms:${venueId}`, cmsEventHandler);
// If no venue is selected (global CMS view):
realtimeClient.subscribe('cms', cmsEventHandler);

// On surface unmount — unsubscribe whichever was subscribed:
realtimeClient.unsubscribe(`cms:${venueId}`, cmsEventHandler);
// or:
realtimeClient.unsubscribe('cms', cmsEventHandler);
```

When the operator selects a venue within CMS Ops during the same mount, unsubscribe the global channel and subscribe the venue-specific channel in that order.

### 4.6 Replay Investigation Surface (deferred from MVP)

The ordering constraint here is a hard requirement. `setReplayMode(true)` MUST be called before the first render of any child component.

```typescript
// BEFORE first render — step order is mandatory:
// Step A: set replay mode synchronously in Zustand
replayStore.getState().setReplayMode(true);

// Step B: register replay channel
realtimeClient.subscribe(`replay:${sessionId}`, replayEventHandler);

// On surface unmount — reverse order:
realtimeClient.unsubscribe(`replay:${sessionId}`, replayEventHandler);
replayStore.getState().setReplayMode(false);
```

Because `useEffect` in a parent component fires before `useEffect` in its children within the same React commit, placing both calls in the parent surface component's `useEffect` satisfies the ordering requirement. Child components that call `useReplayGuard()` will observe `replayMode === true` on their first render.

---

## 5. Live vs. Replay Mode Divergence

When `replayStore.replayMode === true`, the event processing pipeline diverges at Step 9b of the boot sequence (replay mode guard). The guard runs before any cache or store update.

| Event / Concern | LIVE mode (`replayMode === false`) | REPLAY mode (`replayMode === true`) |
|---|---|---|
| `ZONE_B_AUTO_REPLACE` | Process: update React Query cache, trigger content swap in Zone B | **Discard.** Log at debug level. |
| `INCIDENT_CREATED` | Process: update incident list in Zustand, show notification banner | **Discard.** Log at debug level. |
| `VENUE_STATE_UPDATE` | Process: update venue trust state in React Query cache | **Discard.** Log at debug level. |
| `SYSTEM_HEALTH_UPDATE` | Process: update System Status Bar, advance wsStore.lastServerTime | **Discard.** wsStore.lastServerTime is frozen to replay session time. |
| `replay:{session_id}` channel events | Not subscribed; not received | Process: update replayStore, advance replay cursor |
| Write controls (approve, override, etc.) | Rendered per role | **Absent from DOM.** IC-03 enforced. Not merely disabled — not rendered. |
| React Query cache invalidation on reconnect | Runs on reconnect (Section 3.2 step 8b) | Does not run. Replay state is owned by replayStore, not the query cache. |
| Zustand store updates from live events | Applied normally | **Blocked.** Only replayStore receives updates during replay mode. |

**Discard log format:**
```
[WS] event discarded in replay mode: type=ZONE_B_AUTO_REPLACE seq=47 channel=fleet
```

The sequence number guard (Step 9a) still runs on discarded events. `wsStore.lastSequenceNumber` is advanced even for events that are discarded by the replay mode guard. This prevents the sequence guard from treating a discarded event as a gap.

---

## 6. Sequence Number Handling

Every application frame sent by the server includes a `sequence_number` (monotonically increasing integer, scoped to the current session). Sequence numbers reset to 0 on each new session (new `session_id`).

### 6.1 Guard Logic

```typescript
function handleIncomingFrame(event: ServerEvent): void {
  const store = wsStore.getState();

  // Discard stale or duplicate events.
  if (event.sequence_number <= store.lastSequenceNumber) {
    logger.debug('[WS] discarding stale event', {
      incoming: event.sequence_number,
      lastSeen: store.lastSequenceNumber,
      type: event.type,
    });
    return;
  }

  // Detect sequence gaps.
  // Log a warning but do NOT attempt to re-fetch individual events.
  // Events are fire-and-forget. Missed events are reconciled by
  // React Query cache invalidation on reconnect (Section 3.2 step 8b).
  if (event.sequence_number > store.lastSequenceNumber + 1) {
    logger.warn('[WS] sequence gap detected', {
      expected: store.lastSequenceNumber + 1,
      received: event.sequence_number,
      gap: event.sequence_number - store.lastSequenceNumber - 1,
    });
    // Continue processing — do NOT drop the event on a gap.
  }

  // Advance the cursor BEFORE dispatching.
  // Re-entrant calls cannot replay the same event.
  store.setLastSequenceNumber(event.sequence_number);

  // Proceed to replay mode guard (Step 9b), then cache/store updates.
  processEvent(event);
}
```

### 6.2 Pong Sequence Numbers

`ServerPong` frames also carry `sequence_number`. They pass through the same guard and advance `lastSequenceNumber` like any other frame. This prevents a delayed pong from being treated as a fresh application event.

### 6.3 Sequence Reset on Reconnect

When a reconnect produces a new `session_id`, the server sends a new handshake with `sequence_number: 0`. The client resets `wsStore.lastSequenceNumber` to 0 during step 6e of the boot sequence (executed again as part of the reconnect path). Events from the previous session cannot arrive on the new connection.

### 6.4 Sequence Number Storage Rule

`sequence_number` from WS events is stored on the entity object in the React Query cache. REST API responses for Venue and Incident MUST include `sequence_number` so that the initial REST fetch establishes a baseline for WS delta comparison. If a REST response omits `sequence_number`, gap detection is disabled for that entity until the first WS event establishes a baseline.

---

## 7. Heartbeat Protocol

### 7.1 Ping Frame

```typescript
// Dispatched every config.heartbeatInterval (25 000 ms) after CONNECTED.
//
// Timestamp source: wsStore.lastServerTime (updated from SYSTEM_HEALTH_UPDATE
// events and from the ServerHandshake). Date.now() is PROHIBITED as the
// timestamp source. Server uses this value for latency measurement; client
// wall-clock skew produces misleading metrics.
//
// If no SYSTEM_HEALTH_UPDATE has been received yet, use the timestamp from
// the ServerHandshake as the initial value for wsStore.lastServerTime.

const ping: ClientPing = {
  type: 'ping',
  timestamp: wsStore.getState().lastServerTime,
};
realtimeClient.send('ping', ping);
wsStore.getState().setLastHeartbeatAt(Date.now()); // client wall clock, for display only
```

### 7.2 Pong Frame

On receiving `ServerPong`:

1. Clear the pending pong timeout timer.
2. Update `wsStore.lastServerTime = pong.timestamp`.
3. Process `pong.sequence_number` through the standard sequence guard (Section 6.1).
4. Do not dispatch the pong to any application event handlers.

### 7.3 Pong Timeout

If no pong is received within `config.pongTimeout` (10 000 ms) of sending a ping:

1. Close the WebSocket with code 1000 and reason `"pong_timeout"`.
2. Enter RECONNECTING state (not FAILED — this is a network condition, not an auth failure).
3. Apply the standard backoff schedule (attempt 1 → 1 s delay).

### 7.4 Heartbeat Lifecycle

| Event | Heartbeat action |
|---|---|
| Transition to CONNECTED | `startHeartbeat()` — start `setInterval` at `heartbeatInterval` |
| `disconnect()` called | `stopHeartbeat()` — `clearInterval` + `clearTimeout` immediately |
| Transition to RECONNECTING | `stopHeartbeat()` immediately |
| Transition back to CONNECTED after reconnect | `startHeartbeat()` — new interval |
| Transition to FAILED | `stopHeartbeat()` — heartbeat never restarts |

`startHeartbeat()` is idempotent: it calls `stopHeartbeat()` before arming the new interval.

---

## 8. Error States

### 8.1 Close Code Reference

| Code | Meaning | Client action |
|------|---------|---------------|
| 4001 | Auth invalid — token rejected by server | Clear token from `@clubhub/api` memory. Transition to FAILED. Redirect to `/login`. No retry ever. |
| 4003 | Forbidden — valid token, insufficient permissions | Transition to FAILED. Show blocking modal: "Session expired — please log in again." No retry ever. |
| 1001 | Going away — server restart or planned shutdown | Transition to RECONNECTING with 0 ms initial delay (attempt 1 fires immediately). |
| 1011 | Server error — unexpected server-side failure | Transition to RECONNECTING beginning at 4 s delay (skip attempts 1–2, start at attempt 3). |
| 1000 | Normal closure — client-initiated via `disconnect()` | Transition to DISCONNECTED. No reconnect. |
| 1006 | Abnormal closure — no close frame received (TCP drop) | Transition to RECONNECTING with standard backoff from attempt 1. |
| Any other code | Network or proxy failure | Transition to RECONNECTING with standard backoff from attempt 1. |

### 8.2 4001 — Auth Invalid Flow

```typescript
if (event.code === 4001) {
  stopHeartbeat();
  clearTokenFromMemory();                      // @clubhub/api module-level var set to null
  wsStore.getState().setConnectionState('FAILED');
  wsStore.getState().setError({
    code: 4001,
    reason: event.reason,
    timestamp: Date.now(),
  });
  window.location.replace('/login');
}
```

### 8.3 4003 — Forbidden Flow

```typescript
if (event.code === 4003) {
  stopHeartbeat();
  wsStore.getState().setConnectionState('FAILED');
  wsStore.getState().setError({
    code: 4003,
    reason: event.reason,
    timestamp: Date.now(),
  });
  // Show blocking modal — the modal component observes wsStore.error.
  // No redirect — operator must acknowledge the modal.
}
```

### 8.4 FAILED State Constraints

Once in FAILED state:

- No reconnect attempts are initiated.
- `connect()` throws `Error('RealtimeClient is in FAILED state; page reload required')`.
- `send()` throws.
- The heartbeat is permanently stopped.
- The only exit from FAILED state is a full page reload, which re-runs the entire boot sequence from the beginning.

---

## 9. wsStore Shape (Zustand)

**Package:** `@clubhub/state`
**File:** `packages/@clubhub/state/src/wsStore.ts`

```typescript
type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

interface WsStoreError {
  code: number;
  reason: string;
  timestamp: number; // client wall clock, Unix ms
}

interface WsStoreState {

  // ── Connection status ─────────────────────────────────────────────────

  /** Current state machine position. Written synchronously on every transition. */
  connectionState: ConnectionState;

  /**
   * Session ID assigned by the server in the handshake.
   * Null when not CONNECTED (including during RECONNECTING).
   */
  sessionId: string | null;

  /**
   * Last sequence_number received this session.
   * Zero before the first event is processed.
   * Advanced by the sequence guard before event dispatch.
   */
  lastSequenceNumber: number;

  /**
   * Number of consecutive reconnect attempts since the last successful
   * CONNECTED state. Reset to 0 on each successful connection.
   */
  reconnectAttempts: number;

  /**
   * Client wall-clock Unix ms when the most recent ping was dispatched.
   * Null before the first heartbeat cycle.
   */
  lastHeartbeatAt: number | null;

  /**
   * Server-authoritative Unix ms from the most recent SYSTEM_HEALTH_UPDATE
   * event or from the ServerHandshake. Used as the timestamp source for
   * outbound ping frames. MUST NOT be derived from Date.now().
   */
  lastServerTime: number;

  // ── Subscription tracking ─────────────────────────────────────────────

  /**
   * Set of channel names currently subscribed.
   * Populated by subscribe(), reduced by unsubscribe().
   * Preserved across reconnects; used by the reconnect procedure to
   * re-register all subscriptions (Section 3.2 step 8a).
   */
  channels: Set<string>;

  // ── Error ─────────────────────────────────────────────────────────────

  /**
   * Terminal error details, populated when transitioning to FAILED.
   * Null in all non-FAILED states.
   */
  error: WsStoreError | null;

  // ── Actions ───────────────────────────────────────────────────────────

  setConnectionState: (state: ConnectionState) => void;
  setSessionId: (id: string | null) => void;
  setLastSequenceNumber: (n: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastHeartbeatAt: (ts: number) => void;
  setLastServerTime: (ts: number) => void;
  addChannel: (channel: string) => void;
  removeChannel: (channel: string) => void;
  setError: (error: WsStoreError) => void;
  clearError: () => void;
}

const initialState = {
  connectionState: 'DISCONNECTED' as ConnectionState,
  sessionId: null,
  lastSequenceNumber: 0,
  reconnectAttempts: 0,
  lastHeartbeatAt: null,
  lastServerTime: 0,
  channels: new Set<string>(),
  error: null,
};
```

### 9.1 Write Timing Contracts

These contracts are enforced by `RealtimeClient` implementation:

- `wsStore.connectionState` is written synchronously before any `on(lifecycle)` handler fires.
- `wsStore.lastSequenceNumber` is advanced before the event is dispatched to surface handlers.
- `wsStore.channels` is updated by `addChannel()` before the `ClientSubscribe` wire frame is sent to the server.
- `wsStore.channels` is updated by `removeChannel()` after the `ClientUnsubscribe` wire frame is sent to the server (so reconnect re-subscription does not re-register a channel that was cleanly unsubscribed).

These contracts exist so the Zone A connectivity indicator and the replay mode guard always observe current state, not stale state from a prior microtask.

### 9.2 React Query Integration

`RealtimeClient` does not hold a reference to `queryClient`. Cache invalidation on reconnect is performed by a `useEffect` in the root provider that observes `wsStore.connectionState` transitions:

```typescript
// In RealtimeProvider:
useEffect(() => {
  const unsubscribe = wsStore.subscribe(
    (state) => state.connectionState,
    (state, prevState) => {
      if (prevState === 'RECONNECTING' && state === 'CONNECTED') {
        queryClient.invalidateQueries();
      }
    }
  );
  return unsubscribe;
}, [queryClient]);
```

This keeps `@clubhub/api` free of React and TanStack Query dependencies.

---

## 10. Testing Contracts

### 10.1 Unit Test: State Machine Transitions

Each valid transition must have a passing test. Each invalid transition must be a silent no-op with no state change and no throw (except `connect()` in FAILED which must throw).

```typescript
// Valid transitions — each must produce the expected state change:
describe('RealtimeClient state machine — valid transitions', () => {
  it('DISCONNECTED → CONNECTING on connect(token)', ...);
  it('CONNECTING → CONNECTED on server handshake received', ...);
  it('CONNECTING → FAILED on close code 4001', ...);
  it('CONNECTING → FAILED on close code 4003', ...);
  it('CONNECTING → RECONNECTING on network failure (no handshake)', ...);
  it('CONNECTED → RECONNECTING on connection lost (code 1006)', ...);
  it('CONNECTED → RECONNECTING on pong timeout', ...);
  it('CONNECTED → DISCONNECTED on disconnect()', ...);
  it('RECONNECTING → CONNECTING when backoff delay elapses', ...);
  it('RECONNECTING → FAILED on close code 4001 during reconnect', ...);
  it('RECONNECTING → FAILED on close code 4003 during reconnect', ...);
});

// Invalid transitions — each must be a silent no-op:
describe('RealtimeClient state machine — invalid transitions (no-ops)', () => {
  it('CONNECTED → CONNECTED: connect() while connected is a no-op', ...);
  it('DISCONNECTED → RECONNECTING: cannot enter RECONNECTING from DISCONNECTED', ...);
  it('FAILED → CONNECTING: connect() throws, state unchanged', ...);
  it('FAILED → RECONNECTING: no automatic retry from FAILED', ...);
});
```

### 10.2 Unit Test: Sequence Number Deduplication

```typescript
describe('sequence number guard', () => {
  it('discards event where sequence_number === lastSequenceNumber', () => {
    // lastSequenceNumber = 5; incoming seq = 5
    // Expected: event NOT dispatched; lastSequenceNumber remains 5
  });

  it('discards event where sequence_number < lastSequenceNumber', () => {
    // lastSequenceNumber = 10; incoming seq = 3
    // Expected: event NOT dispatched; lastSequenceNumber remains 10
    // Expected: no warn log (stale, not a gap)
  });

  it('processes event where sequence_number === lastSequenceNumber + 1', () => {
    // lastSequenceNumber = 5; incoming seq = 6
    // Expected: event dispatched; lastSequenceNumber updated to 6
  });

  it('logs warn and processes event on gap (seq > lastSequenceNumber + 1)', () => {
    // lastSequenceNumber = 5; incoming seq = 9
    // Expected: warn logged with gap = 3
    // Expected: event dispatched (not dropped); lastSequenceNumber updated to 9
  });

  it('resets lastSequenceNumber to 0 on reconnect with new session_id', () => {
    // Prior session: lastSequenceNumber = 47
    // Reconnect: server sends handshake with sequence_number: 0
    // Expected: wsStore.lastSequenceNumber = 0
  });

  it('advances lastSequenceNumber for discarded replay-mode events', () => {
    // replayMode = true; incoming ZONE_B_AUTO_REPLACE with seq = 12
    // Expected: event discarded by replay mode guard
    // Expected: lastSequenceNumber = 12 (sequence guard ran before replay guard)
  });
});
```

### 10.3 Integration Test: Reconnect Re-Subscribes All Active Channels

```typescript
describe('reconnect subscription restoration', () => {
  it('re-registers all channels in wsStore.channels after reconnect', async () => {
    // Setup: client CONNECTED with channels = new Set([
    //   'system_health', 'incident_global', 'venue_state',
    //   'fleet', 'incident:42'
    // ])
    //
    // Action: simulate network loss → RECONNECTING → CONNECTED (new session_id)
    //
    // Assert: 5 ClientSubscribe frames sent during reconnect procedure
    //         in insertion order
    // Assert: wsStore.channels still contains all 5 channel names
    // Assert: queryClient.invalidateQueries() called once after reconnect
    // Assert: heartbeat timer restarted (ping dispatched within heartbeatInterval)
    // Assert: wsStore.reconnectAttempts reset to 0
    // Assert: wsStore.sessionId updated to new session_id from handshake
  });
});
```

### 10.4 HF-REG: Replay Mode Discards ZONE_B_AUTO_REPLACE

This test is mandatory in the high-frequency regression suite and must run in CI on every push. Failure is merge-blocking.

```typescript
describe('HF-REG: replay mode event filtering', () => {
  it('[HF-REG] discards ZONE_B_AUTO_REPLACE when replayMode is true', () => {
    // Setup:
    //   replayStore.setReplayMode(true)
    //   client CONNECTED, subscribed to 'replay:session-abc'
    //
    // Action: server sends ZONE_B_AUTO_REPLACE on channel 'fleet', seq = 10
    //
    // Assert: React Query cache NOT updated
    // Assert: Zustand stores (uiStore, wsStore app state) NOT updated
    // Assert: debug log emitted:
    //   "[WS] event discarded in replay mode: type=ZONE_B_AUTO_REPLACE seq=10 channel=fleet"
    // Assert: wsStore.lastSequenceNumber === 10
    //   (sequence guard ran; cursor advanced even on discarded events)
  });

  it('[HF-REG] processes replay:{session_id} events in replay mode', () => {
    // Setup: replayStore.setReplayMode(true), subscribed to 'replay:session-abc'
    // Action: server sends event on channel 'replay:session-abc', seq = 11
    // Assert: replayStore receives and processes the event
    // Assert: live stores (React Query, uiStore) NOT updated
    // Assert: wsStore.lastSequenceNumber === 11
  });

  it('[HF-REG] processes ZONE_B_AUTO_REPLACE normally when replayMode is false', () => {
    // Setup: replayStore.setReplayMode(false)
    // Action: server sends ZONE_B_AUTO_REPLACE on channel 'fleet', seq = 12
    // Assert: React Query cache updated
    // Assert: no discard log emitted
  });
});
```

---

## 11. Implementation Notes

### 11.1 Token Security

The JWT is stored as a module-level variable in `@clubhub/api`. It is never written to `localStorage`, `sessionStorage`, or any other persistent browser storage. On tab close or page reload the token is lost and the operator must re-authenticate. This is intentional: it limits the blast radius of an XSS compromise to the lifetime of a single tab session.

The token appears in the WS URL query string only because the browser WebSocket API does not permit custom headers on the HTTP upgrade request. The server validates this credential on every new connection, including reconnects.

### 11.2 Singleton Enforcement

The ESLint rule `no-new-realtime-client` prevents `new RealtimeClient()` outside of `packages/@clubhub/api/src/websocket.ts`. Components and stores import the pre-constructed singleton instance.

### 11.3 Zone Architecture Constraints

The `wsStore.connectionState` value is consumed by:

- **System Status Bar (48px, always rendered):** renders the amber dot on RECONNECTING.
- **Zone A (280px left nav):** renders the amber connectivity indicator.
- **Zone B (fluid center):** must not show a blocking error overlay during RECONNECTING. The silent reconnect contract is enforced at the Zone B layout boundary, not inside `RealtimeClient`.

### 11.4 Server-Authoritative Time Rule

`wsStore.lastServerTime` is the only permitted timestamp source for outbound ping frames. It is initialized from the `ServerHandshake` and updated on every `SYSTEM_HEALTH_UPDATE` event. `Date.now()` is used only for `wsStore.lastHeartbeatAt` (display purposes) and for `wsStore.error.timestamp` (error record keeping).

---

*End of REALTIME-SESSION-INITIALIZATION-v1*
