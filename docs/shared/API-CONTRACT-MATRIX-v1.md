# API Contract Matrix v1

**Document class:** Engineering Reference — Frontend Implementation
**Status:** READY_FOR_IMPLEMENTATION
**Surfaces covered:** Live Operations, Incident Command, Replay Investigation, CMS Content Operations, Venue Operations
**Date:** 2026-06-03
**Supersedes:** None (initial version)

---

## Table of Contents

1. [API Design Conventions](#1-api-design-conventions)
2. [Global / Chrome Endpoints](#2-global--chrome-endpoints)
3. [Live Operations Surface Endpoints](#3-live-operations-surface-endpoints)
4. [Incident Command Surface Endpoints](#4-incident-command-surface-endpoints)
5. [Replay Investigation Surface Endpoints](#5-replay-investigation-surface-endpoints)
6. [CMS Content Operations Surface Endpoints](#6-cms-content-operations-surface-endpoints)
7. [Venue Operations Surface Endpoints](#7-venue-operations-surface-endpoints)
8. [WebSocket Push Event Contracts](#8-websocket-push-event-contracts)
9. [Missing Backend Contracts (Identified Gaps)](#9-missing-backend-contracts-identified-gaps)
10. [Permissions Matrix](#10-permissions-matrix)

---

## 1. API Design Conventions

### Base URL

```
/api/v1/
```

All paths in this document are relative to this base.

### Authentication

All requests must include a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Requests without a valid token receive `401 Unauthorized`. Requests with a valid token but insufficient role receive `403 Forbidden` (except where role-obscuring is required — see Tab 6 Counterfactual, Section 5).

### Pagination

All list endpoints use cursor-based pagination. Do not use offset pagination.

```typescript
interface PaginationParams {
  cursor?: string;   // opaque cursor from previous response
  limit?: number;    // default: 50, max: 200
}

interface PaginationMeta {
  next_cursor: string | null;  // null when no further pages
  total_count?: number;        // included only when cheap to compute
}
```

### Timestamps

- All timestamps are server-authoritative ISO 8601 strings with timezone offset.
- Clients MUST NOT generate or substitute timestamps for any field that the server owns.
- Format: `"2026-06-03T14:22:00.000Z"`
- Client-side countdown timers (e.g., autonomy clock) are computed from a server-supplied `expires_at` field, not from a client clock origin.

### Standard Response Envelope

All successful responses (2xx) use this envelope:

```typescript
interface ResponseEnvelope<T> {
  data: T;
  meta: {
    timestamp: string;     // server time at response generation
    request_id: string;    // for correlation with server logs
    pagination?: PaginationMeta;
  };
}
```

### Standard Error Envelope

All error responses (4xx, 5xx) use this envelope:

```typescript
interface ErrorEnvelope {
  error: {
    code: string;          // machine-readable, e.g. "AUTHORITY_BOUNDARY"
    message: string;       // human-readable, for developer logs
    rejection?: RejectionDetail;
  };
}

interface RejectionDetail {
  type:
    | 'CONCURRENCY_CONFLICT'   // optimistic lock mismatch
    | 'AUTHORITY_BOUNDARY'     // role or trust state prevents action
    | 'PRE_CONSTRAINT'         // PRE resolution system blocked action
    | 'REPLAY_MODE';           // write attempted during replay session
  message: string;
  current_state: Record<string, unknown>;  // relevant current entity state
  retry_permitted: boolean;
  affected_entity: string;     // e.g. "incident:abc123"
  audit_event_id: string;      // event ID written to audit log for this rejection
}
```

**Rejection type guidance for frontend:**

| Type | UI Behaviour |
|------|-------------|
| `CONCURRENCY_CONFLICT` | Refetch entity, re-present write form with current state |
| `AUTHORITY_BOUNDARY` | Show authority error toast; do not re-render controls |
| `PRE_CONSTRAINT` | Show PRE constraint explanation; surface current PRE state |
| `REPLAY_MODE` | Suppress write controls; confirm IC-03 enforcement in DOM |

### Role Hierarchy

```
VIEWER < OPERATOR < CONTENT_MANAGER < ADMIN
```

"Role: OPERATOR+" means OPERATOR, CONTENT_MANAGER, or ADMIN. "Role: CONTENT_MANAGER+" means CONTENT_MANAGER or ADMIN.

### Absent-Not-Disabled Rule

Controls for which the current operator lacks the required role MUST be absent from the DOM entirely. They must not be rendered in a disabled state. This is enforced at the component level via role-gated render guards, not via prop disabling.

### Shared Domain Types

```typescript
type MachineState =
  | 'NOMINAL'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'RECOVERED_BUT_UNTRUSTED'
  | 'ENROLLING'
  | 'MAINTENANCE';

type ConstitutionalState =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'EMERGENCY'
  | 'REPLAY'
  | 'SUSPENDED'
  | 'RECOVERING'
  | 'MAINTENANCE'
  | 'UNKNOWN';

type TrustState =
  | 'TRUSTED'
  | 'UNTRUSTED'
  | 'RECOVERING'
  | 'UNVERIFIED';

type IncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4';

type IncidentState =
  | 'OPEN'
  | 'COMMANDER_ASSIGNED'
  | 'ESCALATED'
  | 'RESOLVING'
  | 'CLOSED';

type OverrideLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

type AdvisoryLevel = 'INFORMATIONAL' | 'RECOMMENDED' | 'URGENT';

type DeliveryPriority = 'ROUTINE' | 'DEGRADED' | 'HIGH_PRIORITY';

type OperatorRole = 'VIEWER' | 'OPERATOR' | 'CONTENT_MANAGER' | 'ADMIN';
```

---

## 2. Global / Chrome Endpoints

These endpoints serve the persistent chrome (navigation, status bar, notification tray) and the current operator identity. They are consumed by all surfaces.

---

### `GET /system/health`

Returns the current constitutional state of the platform. Drives the status bar indicator rendered in the persistent chrome.

**Required role:** VIEWER+
**Push vs poll:** Poll on mount; then driven by `SYSTEM_HEALTH_UPDATE` WebSocket event.

**Response:**

```typescript
interface SystemHealthResponse {
  constitutional_state: ConstitutionalState;
  status_bar: {
    label: string;           // human-readable state label
    severity: 'ok' | 'warning' | 'critical' | 'unknown';
    detail: string | null;   // optional secondary message
  };
  active_incident_count: number;
  degraded_venue_count: number;
  checked_at: string;        // ISO 8601
}
```

---

### `GET /venues`

Returns the venue list for navigation and fleet view. Includes minimal state required to render venue list items.

**Required role:** VIEWER+
**Push vs poll:** Poll on mount; updates driven by `VENUE_STATE_UPDATE` WebSocket event.

**Query params:**

```typescript
interface VenueListParams extends PaginationParams {
  view?: 'fleet';     // request full fleet summary data
  status?: MachineState;
}
```

**Response item:**

```typescript
interface VenueSummary {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  constitutional_state: ConstitutionalState;
  trust_state: TrustState;
  highest_severity: IncidentSeverity | null;
  active_incident_id: string | null;
  screen_count: number;
  autonomy_expires_at: string | null;   // ISO 8601; null if not in autonomy mode
  advisory_level: AdvisoryLevel | null;
}
```

**Response:** `ResponseEnvelope<VenueSummary[]>`

---

### `GET /venues/{venue_id}`

Returns full venue detail. Used by venue detail drawers and surface headers.

**Required role:** VIEWER+
**Push vs poll:** Poll on navigation; updates driven by `VENUE_STATE_UPDATE`.

**Response:**

```typescript
interface VenueDetail {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  constitutional_state: ConstitutionalState;
  trust_state: TrustState;
  highest_severity: IncidentSeverity | null;
  active_incident_id: string | null;
  screen_count: number;
  autonomy_status: {
    in_autonomy_mode: boolean;
    autonomy_expires_at: string | null;
    last_sync_at: string | null;
  };
  advisory_level: AdvisoryLevel | null;
  enrolled_at: string;
  last_seen_at: string | null;
  location: {
    address: string | null;
    timezone: string;
  };
}
```

**Response:** `ResponseEnvelope<VenueDetail>`

---

### `GET /incidents/active`

Returns all currently open incidents. Used by the global incident tray and navigation badge.

**Required role:** VIEWER+
**Push vs poll:** Poll on mount; updates driven by `INCIDENT_CREATED`, `INCIDENT_UPDATE`, `INCIDENT_CLOSED`.

**Query params:** `PaginationParams`

**Response item:**

```typescript
interface IncidentSummary {
  incident_id: string;
  venue_id: string;
  venue_name: string;
  severity: IncidentSeverity;
  state: IncidentState;
  commander_id: string | null;
  commander_display_name: string | null;
  opened_at: string;
  updated_at: string;
  description: string;
}
```

**Response:** `ResponseEnvelope<IncidentSummary[]>`

---

### `GET /notifications`

Returns notification tray entries for the current operator.

**Required role:** VIEWER+
**Push vs poll:** Poll on mount; updates driven by `NOTIFICATION_CREATED`.

**Query params:**

```typescript
interface NotificationListParams extends PaginationParams {
  unread_only?: boolean;
}
```

**Response item:**

```typescript
interface Notification {
  notification_id: string;
  type: 'INCIDENT' | 'ADVISORY' | 'SYSTEM' | 'OVERRIDE' | 'COMMANDER';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  entity_type: string | null;    // e.g. "incident", "venue"
  entity_id: string | null;
  severity: IncidentSeverity | null;
}
```

**Response:** `ResponseEnvelope<Notification[]>`

---

### `PATCH /notifications/{id}/read`

Marks a notification as read.

**Required role:** VIEWER+ (own notifications only)
**Push vs poll:** Write endpoint; no push required.

**Request body:** None required.

**Response:** `ResponseEnvelope<{ notification_id: string; read: boolean }>`

---

### `GET /operators/me`

Returns the current operator's identity and permission set. Must be fetched on session initialisation before rendering any surface.

**Required role:** Any authenticated user
**Push vs poll:** Poll once on session init; re-fetch after role changes (rare).

**Response:**

```typescript
interface OperatorIdentity {
  operator_id: string;
  display_name: string;
  email: string;
  role: OperatorRole;
  permissions: {
    can_place_override: boolean;
    can_declare_incident: boolean;
    can_claim_commander: boolean;
    can_place_l6_override: boolean;
    can_manage_content: boolean;
    can_approve_content: boolean;
    can_enroll_screens: boolean;
    can_access_evidence: boolean;
    can_access_counterfactual: boolean;
    can_modify_venue_config: boolean;
  };
  session_started_at: string;
}
```

**Response:** `ResponseEnvelope<OperatorIdentity>`

---

### `WS /subscribe`

WebSocket subscription endpoint. All push events from Section 8 are delivered over this connection.

**Auth:** Bearer token passed as query param `?token=<bearer_token>` (WebSocket protocol does not support Authorization header).

**Subscription message (client → server):**

```typescript
interface SubscribeMessage {
  type: 'SUBSCRIBE';
  channels: Array<
    | { channel: 'venues' }
    | { channel: 'venue'; venue_id: string }
    | { channel: 'incidents' }
    | { channel: 'incident'; incident_id: string }
    | { channel: 'replay_session'; session_id: string }
    | { channel: 'system' }
  >;
}
```

**Unsubscribe message (client → server):**

```typescript
interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  channels: SubscribeMessage['channels'];
}
```

**Acknowledgement (server → client):**

```typescript
interface SubscribeAck {
  type: 'SUBSCRIBED';
  channels: string[];
  server_time: string;
}
```

**Heartbeat:** Server sends `{ type: 'PING' }` every 30s; client must respond with `{ type: 'PONG' }`. Connection closed after 2 missed pongs.

**Reconnection:** Clients must implement exponential backoff (base 1s, max 30s). On reconnect, re-subscribe to all channels and poll for missed state.

---

## 3. Live Operations Surface Endpoints

The Live Operations Surface presents a fleet overview with drill-down venue detail. Zone A = fleet list, Zone B = venue detail, Zone C = context/advisory panes.

---

### Fleet View

#### `GET /venues?view=fleet`

Returns all venues with full summary state for fleet tile rendering.

**Required role:** VIEWER+
**Widget:** Zone A fleet grid
**Push vs poll:** Poll on mount; tiles updated by `VENUE_STATE_UPDATE`.

**Query params:**

```typescript
interface FleetViewParams extends PaginationParams {
  view: 'fleet';
  machine_state?: MachineState;
  has_active_incident?: boolean;
  advisory_level?: AdvisoryLevel;
}
```

**Response item:** `VenueSummary` (defined in Section 2)

**Response:** `ResponseEnvelope<VenueSummary[]>`

---

### Venue Detail

#### `GET /venues/{venue_id}/detail`

Returns full Zone B content for the selected venue panel.

**Required role:** VIEWER+
**Widget:** Zone B venue detail panel
**Push vs poll:** Poll on venue selection; updates driven by `VENUE_STATE_UPDATE`.

**Response:**

```typescript
interface VenueDetailFull extends VenueDetail {
  screens: ScreenSummary[];
  current_corpus: {
    corpus_id: string;
    version: string;
    hash_verified: boolean;
    verified_at: string | null;
  } | null;
  active_overrides: Override[];
  pre_level: number;              // current PRE resolution level (0–6)
  pre_summary: string | null;     // human-readable PRE state
}

interface ScreenSummary {
  screen_id: string;
  name: string;
  machine_state: MachineState;
  last_seen_at: string | null;
  player_version: string | null;
}

interface Override {
  override_id: string;
  level: OverrideLevel;
  content_ref: string;
  reason: string;
  placed_by: string;
  placed_at: string;
  expires_at: string | null;
  incident_id: string | null;
}
```

**Response:** `ResponseEnvelope<VenueDetailFull>`

---

### Player Health

#### `GET /venues/{venue_id}/player-health`

Returns Zone B Section 2 player health data.

**Required role:** VIEWER+
**Widget:** Zone B Section 2 player health cards
**Push vs poll:** Poll every 30s; updates driven by `VENUE_STATE_UPDATE`.

**Response:**

```typescript
interface PlayerHealthResponse {
  venue_id: string;
  screens: Array<{
    screen_id: string;
    name: string;
    player_state: 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' | 'OFFLINE';
    player_version: string | null;
    corpus_loaded: boolean;
    last_heartbeat_at: string | null;
    uptime_seconds: number | null;
    error_message: string | null;
  }>;
  checked_at: string;
}
```

**Response:** `ResponseEnvelope<PlayerHealthResponse>`

---

### PRE State

#### `GET /venues/{venue_id}/pre-state`

Returns the current PRE resolution level and resolution chain for the venue.

**Required role:** VIEWER+
**Widget:** Zone B PRE state indicator
**Push vs poll:** Poll on venue selection; no push event (derived from `VENUE_STATE_UPDATE`).

**Response:**

```typescript
interface PREStateResponse {
  venue_id: string;
  pre_level: number;            // 0–6, current active PRE level
  resolution_chain: Array<{
    level: number;
    label: string;
    active: boolean;
    resolved_at: string | null;
    content_ref: string | null;
  }>;
  last_resolved_at: string | null;
}
```

**Response:** `ResponseEnvelope<PREStateResponse>`

---

### Override List

#### `GET /venues/{venue_id}/overrides`

Returns active overrides for a venue.

**Required role:** VIEWER+
**Widget:** Zone B override inventory
**Push vs poll:** Poll on venue selection; updates driven by `OVERRIDE_PLACED`, `OVERRIDE_REMOVED`.

**Query params:** `PaginationParams`

**Response:** `ResponseEnvelope<Override[]>` (Override type defined above)

---

### Place Override

#### `POST /venues/{venue_id}/overrides`

Places a non-L6 override on a venue. L6 overrides must go through the Incident Command Surface endpoint.

**Required role:** OPERATOR+
**Widget:** Zone B override placement control
**Push vs poll:** Write endpoint; response updates local state; `OVERRIDE_PLACED` event updates other clients.

**Blocked when:** `trust_state === 'UNTRUSTED'` or `machine_state === 'RECOVERED_BUT_UNTRUSTED'` — server returns `AUTHORITY_BOUNDARY` rejection.

**Request body:**

```typescript
interface PlaceOverrideRequest {
  level: Exclude<OverrideLevel, 'L6'>;  // L6 not permitted here
  content_ref: string;                  // required
  reason: string;                       // required; min 10 chars
  expires_at?: string;                  // ISO 8601; optional TTL
}
```

**Response:**

```typescript
interface PlaceOverrideResponse {
  override: Override;
}
```

**Response:** `ResponseEnvelope<PlaceOverrideResponse>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 403 | `AUTHORITY_BOUNDARY` | Role < OPERATOR or venue is RECOVERED_BUT_UNTRUSTED |
| 409 | `CONCURRENCY_CONFLICT` | Conflicting override placed since last fetch |
| 422 | `PRE_CONSTRAINT` | PRE resolution prevents this level |

---

### Declare Incident

#### `POST /incidents`

Declares a new incident for a venue.

**Required role:** OPERATOR+
**Widget:** Zone B incident declaration control
**Push vs poll:** Write endpoint; `INCIDENT_CREATED` event broadcast to all subscribers.

**Request body:**

```typescript
interface DeclareIncidentRequest {
  venue_id: string;        // required
  severity: IncidentSeverity;  // required
  description: string;    // required; min 20 chars
}
```

**Response:**

```typescript
interface DeclareIncidentResponse {
  incident: IncidentFull;  // see Section 4
}
```

**Response:** `ResponseEnvelope<DeclareIncidentResponse>`

---

### Zone C Context

#### `GET /venues/{venue_id}/zone-c`

Returns the composite context, health, activity, and advisory pane data for Zone C.

**Required role:** VIEWER+
**Widget:** Zone C multi-pane panel
**Push vs poll:** Poll on venue selection; advisory pane updates driven by `ADVISORY_UPDATE`.

**Response:**

```typescript
interface ZoneCResponse {
  venue_id: string;
  context: {
    active_incidents: IncidentSummary[];
    recent_events: Array<{
      event_id: string;
      type: string;
      description: string;
      occurred_at: string;
    }>;
  };
  health: {
    overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      detail: string | null;
    }>;
  };
  activity: {
    recent_overrides: Override[];
    recent_state_transitions: Array<{
      from_state: MachineState;
      to_state: MachineState;
      transitioned_at: string;
    }>;
  };
  advisory: AdvisoryResponse;   // see below
}
```

**Response:** `ResponseEnvelope<ZoneCResponse>`

---

### Advisory

#### `GET /venues/{venue_id}/advisory`

Returns the current advisory content and level for a venue.

**Required role:** VIEWER+
**Widget:** Zone C advisory pane
**Push vs poll:** Poll on venue selection; updates driven by `ADVISORY_UPDATE`.

**Response:**

```typescript
interface AdvisoryResponse {
  venue_id: string;
  advisory_level: AdvisoryLevel | null;   // null = no active advisory
  content: string | null;
  updated_at: string | null;
  expires_at: string | null;
}
```

**Response:** `ResponseEnvelope<AdvisoryResponse>`

---

## 4. Incident Command Surface Endpoints

The Incident Command Surface presents a 6-tab incident management workspace. Zone B is auto-replaced for S1/S2 incidents (`ZONE_B_AUTO_REPLACE` push event).

---

### Core Incident Types

```typescript
interface IncidentFull {
  incident_id: string;
  venue_id: string;
  venue_name: string;
  severity: IncidentSeverity;
  state: IncidentState;
  description: string;
  commander_id: string | null;
  commander_display_name: string | null;
  commander_claimed_at: string | null;
  commander_lapsed: boolean;
  commander_lapsed_at: string | null;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  version: number;          // optimistic lock version; required for severity PATCH
  active_overrides: Override[];
  shift_notes: ShiftNote[];
}

interface ShiftNote {
  note_id: string;
  incident_id: string;
  author_id: string;
  author_display_name: string;
  content: string;            // append-only; notes cannot be deleted
  created_at: string;
  sequence_number: number;
}
```

---

### Get Incident

#### `GET /incidents/{incident_id}`

Returns full incident detail. Used as the root data load for the Incident Command Surface.

**Required role:** VIEWER+
**Widget:** Incident Command Surface root
**Push vs poll:** Poll on navigation; updates driven by `INCIDENT_UPDATE`.

**Response:** `ResponseEnvelope<IncidentFull>`

---

### Tab 1 — Incident Overview

#### `GET /incidents/{incident_id}/overview`

Returns structured overview data for Tab 1. Distinct from the full incident to allow targeted polling.

**Required role:** VIEWER+
**Widget:** Tab 1 overview panel
**Push vs poll:** Poll on tab activation; updates driven by `INCIDENT_UPDATE`.

**Response:**

```typescript
interface IncidentOverviewResponse {
  incident_id: string;
  severity: IncidentSeverity;
  state: IncidentState;
  timeline: Array<{
    event_type: string;
    description: string;
    occurred_at: string;
    operator_id: string | null;
    operator_display_name: string | null;
  }>;
  commander: {
    operator_id: string;
    display_name: string;
    claimed_at: string;
  } | null;
  venue_snapshot: {
    machine_state: MachineState;
    constitutional_state: ConstitutionalState;
    trust_state: TrustState;
  };
  version: number;
}
```

**Response:** `ResponseEnvelope<IncidentOverviewResponse>`

---

### Severity Update

#### `PATCH /incidents/{incident_id}/severity`

Updates incident severity. Uses optimistic locking via the `version` field.

**Required role:** OPERATOR+
**Widget:** Tab 1 severity selector
**Push vs poll:** Write endpoint; `INCIDENT_UPDATE` broadcast on success.

**Request body:**

```typescript
interface UpdateSeverityRequest {
  severity: IncidentSeverity;   // required
  version: number;              // required; must match current incident.version
}
```

**Response:** `ResponseEnvelope<{ incident_id: string; severity: IncidentSeverity; version: number }>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 409 | `CONCURRENCY_CONFLICT` | `version` does not match current version; `current_state` includes current `severity` and `version` |

---

### Tab 2 — Shift Notes

#### `GET /incidents/{incident_id}/notes`

Returns all shift notes for the incident.

**Required role:** VIEWER+
**Widget:** Tab 2 notes panel
**Push vs poll:** Poll on tab activation; cursor-paginated.

**Query params:** `PaginationParams`

**Response:** `ResponseEnvelope<ShiftNote[]>`

#### `PUT /incidents/{incident_id}/notes`

Appends a new shift note. Notes are append-only and cannot be edited or deleted.

**Required role:** OPERATOR+
**Widget:** Tab 2 note entry field
**Push vs poll:** Write endpoint; server-persisted; no dedicated push event (re-poll after write).

**Request body:**

```typescript
interface AppendNoteRequest {
  content: string;   // required; min 5 chars; max 5000 chars
}
```

**Response:** `ResponseEnvelope<ShiftNote>`

---

### Tab 3 — Override Inventory

#### `GET /incidents/{incident_id}/overrides`

Returns all overrides associated with this incident.

**Required role:** VIEWER+
**Widget:** Tab 3 override inventory table
**Push vs poll:** Poll on tab activation; updates driven by `OVERRIDE_PLACED`, `OVERRIDE_REMOVED`.

**Response:** `ResponseEnvelope<Override[]>`

---

### L6 Override Placement

#### `POST /incidents/{incident_id}/overrides/l6`

Places an L6 override on the incident's venue. The client MUST complete the 3-step sequential chip-select confirmation flow before making this call. The `confirmation_steps_completed` field enforces this at the API level.

**Required role:** OPERATOR+
**Widget:** Tab 3 L6 override placement control
**Push vs poll:** Write endpoint; `OVERRIDE_PLACED` broadcast on success.

**Pre-call client requirement:** The 3-step chip-select confirmation flow must be completed in the UI before this call is issued. The `confirmation_steps_completed: 3` field is the API-level signal that this has occurred. If a value less than 3 is sent, the server rejects with 422.

**Request body:**

```typescript
interface PlaceL6OverrideRequest {
  venue_id: string;                    // required; must match incident.venue_id
  content_ref: string;                 // required
  reason: string;                      // required; min 20 chars
  confirmation_steps_completed: 3;     // required; literal value 3 only
  confirmed_steps: number;             // required; must equal 3
}
```

**Response:**

```typescript
interface PlaceL6OverrideResponse {
  override: Override;
  audit_event_id: string;
}
```

**Response:** `ResponseEnvelope<PlaceL6OverrideResponse>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 403 | `AUTHORITY_BOUNDARY` | Role < OPERATOR or venue is RECOVERED_BUT_UNTRUSTED |
| 422 | — | `confirmation_steps_completed` != 3 |

---

### L6 Override Removal

#### `DELETE /incidents/{incident_id}/overrides/{override_id}`

Removes an L6 override. The client MUST complete the 3-second hold-to-confirm interaction before making this call.

**Required role:** OPERATOR+
**Widget:** Tab 3 L6 override removal control
**Push vs poll:** Write endpoint; `OVERRIDE_REMOVED` broadcast on success.

**Pre-call client requirement:** The hold-to-confirm interaction (3-second hold) must be completed in the UI before this call is issued. There is no additional field for this — the hold is purely a UI gate. The call itself signals confirmation.

**Response:** `ResponseEnvelope<{ override_id: string; removed_at: string; removed_by: string }>`

---

### Tab 4 — PRE Divergence

#### `GET /incidents/{incident_id}/pre-divergence`

Returns PRE divergence analysis for the incident.

**Required role:** VIEWER+
**Widget:** Tab 4 PRE divergence panel
**Push vs poll:** Poll on tab activation.

**Response:**

```typescript
interface PREDivergenceResponse {
  incident_id: string;
  venue_id: string;
  divergence_detected: boolean;
  divergence_type: string | null;
  expected_pre_level: number | null;
  actual_pre_level: number | null;
  divergence_started_at: string | null;
  resolution_chain: Array<{
    level: number;
    label: string;
    expected_content_ref: string | null;
    actual_content_ref: string | null;
    match: boolean;
  }>;
}
```

**Response:** `ResponseEnvelope<PREDivergenceResponse>`

---

### Tab 5 — Available Transitions

#### `GET /incidents/{incident_id}/transitions`

Returns available state transitions for the incident given its current state and the operator's role.

**Required role:** VIEWER+
**Widget:** Tab 5 transition panel
**Push vs poll:** Poll on tab activation; re-poll after `INCIDENT_UPDATE`.

**Response:**

```typescript
interface AvailableTransitionsResponse {
  incident_id: string;
  current_state: IncidentState;
  available_transitions: Array<{
    transition_type: string;
    label: string;
    description: string;
    requires_notes: boolean;
    requires_role: OperatorRole;
    permitted_for_current_operator: boolean;
  }>;
}
```

**Response:** `ResponseEnvelope<AvailableTransitionsResponse>`

#### `POST /incidents/{incident_id}/transitions`

Applies a state transition to the incident.

**Required role:** OPERATOR+
**Widget:** Tab 5 transition action control
**Push vs poll:** Write endpoint; `INCIDENT_UPDATE` broadcast on success.

**Request body:**

```typescript
interface ApplyTransitionRequest {
  transition_type: string;   // required; must be in available_transitions list
  notes: string;             // required when requires_notes === true; optional otherwise
  version: number;           // required; optimistic lock
}
```

**Response:** `ResponseEnvelope<IncidentFull>`

---

### Commander Claim

#### `POST /incidents/{incident_id}/commander/claim`

Claims incident commander for the calling operator. Returns 409 if already claimed by another operator.

**Required role:** OPERATOR+
**Widget:** Commander claim button
**Push vs poll:** Write endpoint; `COMMANDER_CLAIMED` broadcast on success.

**Request body:** None.

**Response:**

```typescript
interface CommanderClaimResponse {
  incident_id: string;
  commander_id: string;
  commander_display_name: string;
  claimed_at: string;
}
```

**Response:** `ResponseEnvelope<CommanderClaimResponse>`

**Error cases:**

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `COMMANDER_CONFLICT` | Another operator is current commander |

---

### Commander Release

#### `DELETE /incidents/{incident_id}/commander`

Releases incident command. Only the current commander may call this.

**Required role:** OPERATOR+ (must be current commander)
**Widget:** Commander release control
**Push vs poll:** Write endpoint; `COMMANDER_RELEASED` broadcast on success.

**Response:** `ResponseEnvelope<{ incident_id: string; released_at: string }>`

**Error cases:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `AUTHORITY_BOUNDARY` | Caller is not the current commander |

---

### Tab 6 — Evidence Package

#### `GET /incidents/{incident_id}/evidence`

Returns the evidence package for the incident. ADMIN-only. Returns 403 for all other roles (no role-obscuring here — the tab is absent from DOM for non-ADMIN).

**Required role:** ADMIN
**Widget:** Tab 6 evidence package (absent from DOM for non-ADMIN)
**Push vs poll:** Poll on tab activation.

**Response:**

```typescript
interface EvidencePackageResponse {
  incident_id: string;
  generated_at: string;
  audit_events: Array<{
    event_id: string;
    type: string;
    description: string;
    operator_id: string | null;
    occurred_at: string;
    metadata: Record<string, unknown>;
  }>;
  override_history: Override[];
  corpus_hash_chain: Array<{
    hash: string;
    previous_hash: string | null;
    event_id: string;
    recorded_at: string;
  }>;
  shift_notes: ShiftNote[];
  state_transitions: Array<{
    from_state: IncidentState;
    to_state: IncidentState;
    operator_id: string | null;
    transitioned_at: string;
    notes: string | null;
  }>;
}
```

**Response:** `ResponseEnvelope<EvidencePackageResponse>`

---

### COMMANDER_LAPSED Notify

#### `POST /incidents/{incident_id}/commander/notify`

Sends a COMMANDER_LAPSED notification to eligible operators. Subject to 60-second cooldown; returns 429 if within cooldown window.

**Required role:** OPERATOR+
**Widget:** COMMANDER_LAPSED notification trigger
**Push vs poll:** Write endpoint; server broadcasts `COMMANDER_LAPSED` push event.

**Request body:** None.

**Response:** `ResponseEnvelope<{ notified_at: string; next_permitted_at: string }>`

**Error cases:**

| HTTP | Code | Condition |
|------|------|-----------|
| 429 | `COOLDOWN_ACTIVE` | Within 60-second cooldown; response includes `retry_after` (seconds) |

---

## 5. Replay Investigation Surface Endpoints

The Replay Investigation Surface presents corpus replay with a 6-tab investigation workspace. IC-03 applies: no write controls are rendered in REPLAY mode — the DOM must enforce this, not just disable controls.

---

### Core Replay Types

```typescript
interface ReplaySession {
  session_id: string;
  venue_id: string;
  created_by: string;
  session_type: 'INVESTIGATION' | 'COUNTERFACTUAL' | 'TRAINING';
  start_time: string;           // corpus replay window start
  end_time: string;             // corpus replay window end
  state: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  collaborators: Array<{
    operator_id: string;
    display_name: string;
    position_ms: number;        // current playhead position for this collaborator
    last_seen_at: string;
  }>;
  created_at: string;
}

interface ReplayAnnotation {
  annotation_id: string;
  session_id: string;
  author_id: string;
  author_display_name: string;
  timeline_position_ms: number;
  content: string;
  created_at: string;
  contradiction_flag: boolean;    // set server-side if contradiction detected
  contradicts_annotation_id: string | null;
}
```

---

### Create Session

#### `POST /replay/sessions`

Creates a new replay session.

**Required role:** OPERATOR+
**Widget:** Replay session initialisation
**Push vs poll:** Write endpoint; no broadcast.

**Request body:**

```typescript
interface CreateReplaySessionRequest {
  venue_id: string;                                              // required
  start_time: string;                                            // required; ISO 8601
  end_time: string;                                             // required; ISO 8601; must be > start_time
  session_type: 'INVESTIGATION' | 'COUNTERFACTUAL' | 'TRAINING'; // required
}
```

Note: `session_type: 'COUNTERFACTUAL'` requires ADMIN role. Server returns 403 for OPERATOR attempting counterfactual session creation.

**Response:** `ResponseEnvelope<ReplaySession>`

---

### Get Session

#### `GET /replay/sessions/{session_id}`

Returns session metadata and current collaborator positions.

**Required role:** VIEWER+
**Widget:** Replay surface header
**Push vs poll:** Poll on mount; collaborator positions updated by `COLLABORATOR_POSITION` push event.

**Response:** `ResponseEnvelope<ReplaySession>`

---

### Timeline Events

#### `GET /replay/sessions/{session_id}/timeline`

Returns swim lane data and corpus events within the session window.

**Required role:** VIEWER+
**Widget:** Timeline swim lane component
**Push vs poll:** Poll on session load; static for session duration.

**Query params:**

```typescript
interface TimelineParams {
  lane?: 'ALL' | 'OVERRIDES' | 'INCIDENTS' | 'CORPUS' | 'SYSTEM';
  from_ms?: number;   // filter by position within replay window
  to_ms?: number;
}
```

**Response:**

```typescript
interface TimelineResponse {
  session_id: string;
  duration_ms: number;
  lanes: Array<{
    lane_id: string;
    lane_type: 'OVERRIDES' | 'INCIDENTS' | 'CORPUS' | 'SYSTEM' | 'ANNOTATIONS';
    events: Array<{
      event_id: string;
      position_ms: number;
      duration_ms: number | null;
      type: string;
      label: string;
      severity: IncidentSeverity | null;
      metadata: Record<string, unknown>;
    }>;
  }>;
}
```

**Response:** `ResponseEnvelope<TimelineResponse>`

---

### Transport Control

#### `PATCH /replay/sessions/{session_id}/transport`

Controls replay playback. Returns `REPLAY_MODE` rejection (403) if session is not a valid replay session.

**Required role:** OPERATOR+
**Widget:** Replay transport controls
**Push vs poll:** Write endpoint; position broadcast via `COLLABORATOR_POSITION` to session collaborators.

**Request body:**

```typescript
interface TransportControlRequest {
  action: 'play' | 'pause' | 'scrub';  // required
  position_ms?: number;                  // required when action === 'scrub'
  speed?: 0.5 | 1 | 2 | 4;             // optional; default 1
}
```

**Response:**

```typescript
interface TransportControlResponse {
  session_id: string;
  action: string;
  position_ms: number;
  speed: number;
  state: 'PLAYING' | 'PAUSED';
}
```

**Response:** `ResponseEnvelope<TransportControlResponse>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 403 | `REPLAY_MODE` | Session is not a valid active replay session |

---

### Collaborator Position

#### `PATCH /replay/sessions/{session_id}/collaborators/me/position`

Updates the calling operator's playhead position within the session. Pushed to all other collaborators via `COLLABORATOR_POSITION` event.

**Required role:** VIEWER+
**Widget:** Timeline scrub (position broadcast)
**Push vs poll:** Write endpoint; position broadcast to session channel.

**Request body:**

```typescript
interface CollaboratorPositionRequest {
  position_ms: number;   // required
}
```

**Response:** `ResponseEnvelope<{ operator_id: string; position_ms: number; updated_at: string }>`

---

### Tab 3 — Annotations

#### `GET /replay/sessions/{session_id}/annotations`

Returns all annotations for the session.

**Required role:** VIEWER+
**Widget:** Tab 3 annotation list
**Push vs poll:** Poll on tab activation; updates driven by `ANNOTATION_ADDED`.

**Query params:** `PaginationParams`

**Response:** `ResponseEnvelope<ReplayAnnotation[]>`

#### `POST /replay/sessions/{session_id}/annotations`

Adds a new annotation. Always accepted (additive-only). Contradiction detection happens server-side asynchronously; the `contradiction_flag` may be set in a subsequent `ANNOTATION_CONTRADICTION_DETECTED` push event.

**Required role:** OPERATOR+
**Widget:** Tab 3 annotation entry
**Push vs poll:** Write endpoint; `ANNOTATION_ADDED` broadcast to session collaborators.

**Note:** Annotations are immutable once created. No edit or delete endpoints exist.

**Request body:**

```typescript
interface AddAnnotationRequest {
  timeline_position_ms: number;   // required
  content: string;                // required; min 5 chars; max 10000 chars
}
```

**Response:** `ResponseEnvelope<ReplayAnnotation>`

---

### Tab 4 — Corpus Diff

#### `GET /replay/sessions/{session_id}/corpus-diff`

Returns corpus diff data showing what changed within the replay window.

**Required role:** VIEWER+
**Widget:** Tab 4 corpus diff panel
**Push vs poll:** Poll on tab activation; static for session duration.

**Response:**

```typescript
interface CorpusDiffResponse {
  session_id: string;
  diff_entries: Array<{
    diff_id: string;
    position_ms: number;
    change_type: 'ADDED' | 'REMOVED' | 'MODIFIED';
    entity_type: string;
    entity_id: string;
    previous_state: Record<string, unknown> | null;
    new_state: Record<string, unknown> | null;
  }>;
  total_changes: number;
}
```

**Response:** `ResponseEnvelope<CorpusDiffResponse>`

---

### Tab 5 — Findings

#### `GET /replay/sessions/{session_id}/findings`

Returns recorded findings for the session.

**Required role:** VIEWER+
**Widget:** Tab 5 findings panel
**Push vs poll:** Poll on tab activation.

**Query params:** `PaginationParams`

**Response:**

```typescript
interface Finding {
  finding_id: string;
  session_id: string;
  author_id: string;
  author_display_name: string;
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timeline_position_ms: number | null;
  created_at: string;
}
```

**Response:** `ResponseEnvelope<Finding[]>`

#### `POST /replay/sessions/{session_id}/findings`

Records a new finding. Findings are append-only.

**Required role:** OPERATOR+
**Widget:** Tab 5 finding entry
**Push vs poll:** Write endpoint; no broadcast (single-user action).

**Request body:**

```typescript
interface AddFindingRequest {
  title: string;                                 // required; max 200 chars
  content: string;                               // required; max 20000 chars
  severity: 'INFO' | 'WARNING' | 'CRITICAL';    // required
  timeline_position_ms?: number;                 // optional
}
```

**Response:** `ResponseEnvelope<Finding>`

---

### Tab 6 — Counterfactual

#### `GET /replay/sessions/{session_id}/counterfactual`

Returns counterfactual analysis for the session.

**Required role:** ADMIN
**Widget:** Tab 6 counterfactual panel (absent from DOM for non-ADMIN)
**Push vs poll:** Poll on tab activation.

**IMPORTANT — Role-obscuring requirement:** This endpoint returns `404 Not Found` for non-ADMIN roles, not `403 Forbidden`. This prevents role inference by non-ADMIN operators. The frontend must not render Tab 6 for non-ADMIN (DOM-absent rule), so a 404 should never be encountered by a correctly implemented frontend. If a 404 is received and the operator is not ADMIN, treat as a client implementation error.

**Response:**

```typescript
interface CounterfactualResponse {
  session_id: string;
  scenarios: Array<{
    scenario_id: string;
    label: string;
    description: string;
    altered_inputs: Record<string, unknown>;
    simulated_outcome: Record<string, unknown>;
    divergence_point_ms: number;
    outcome_summary: string;
  }>;
  generated_at: string;
}
```

**Response:** `ResponseEnvelope<CounterfactualResponse>`

---

### Corpus Hash Verification

#### `GET /replay/sessions/{session_id}/hash-verification`

Returns hash verification status for the corpus used in this session. NEVER returns a false positive — if uncertain, returns `hash_verified: false`.

**Required role:** VIEWER+
**Widget:** Session integrity indicator
**Push vs poll:** Poll on session load; static result.

**Response:**

```typescript
interface HashVerificationResponse {
  session_id: string;
  hash_verified: boolean;      // NEVER false positive; if uncertain, returns false
  hash_match: boolean;         // true only when hash_verified AND hashes are equal
  corpus_hash: string | null;
  expected_hash: string | null;
  verified_at: string;
}
```

**Response:** `ResponseEnvelope<HashVerificationResponse>`

---

## 6. CMS Content Operations Surface Endpoints

The CMS Content Operations Surface presents a 6-tab content management workspace. The 72-hour delivery lead time is a constitutional constraint enforced at the API level.

---

### Core CMS Types

```typescript
interface ContentItem {
  content_id: string;
  title: string;
  type: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';
  created_by: string;
  created_at: string;
  updated_at: string;
  delivery_priority: DeliveryPriority | null;
  sponsor_level: 'L4' | null;    // L4 is constitutional ceiling for sponsors
  metadata: Record<string, unknown>;
}

interface CalendarSlot {
  slot_id: string;
  venue_id: string;
  start_time: string;
  end_time: string | null;
  content_id: string | null;
  content_title: string | null;
  delivery_priority: DeliveryPriority;
  delivery_deadline: string;       // must be >= now + 72h
  status: 'SCHEDULED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
}
```

---

### Tab 1 — Content Library

#### `GET /cms/content`

Returns the content library.

**Required role:** VIEWER+
**Widget:** Tab 1 content library grid
**Push vs poll:** Poll on tab activation.

**Query params:**

```typescript
interface ContentListParams extends PaginationParams {
  venue_id?: string;
  status?: ContentItem['status'];
  type?: string;
  sponsor_level?: 'L4';
}
```

**Response:** `ResponseEnvelope<ContentItem[]>`

#### `GET /cms/content/{content_id}`

Returns full content detail.

**Required role:** VIEWER+
**Widget:** Tab 1 content detail drawer
**Push vs poll:** Poll on selection.

**Response:** `ResponseEnvelope<ContentItem>`

---

### Tab 2 — Content Calendar

#### `GET /cms/calendar`

Returns the calendar slot grid with delivery priority for a venue and week.

**Required role:** VIEWER+
**Widget:** Tab 2 calendar grid
**Push vs poll:** Poll on tab activation; updates driven by `DELIVERY_STATE_UPDATE`.

**Query params:**

```typescript
interface CalendarParams {
  venue_id: string;    // required
  week: string;        // required; ISO 8601 date of week start (Monday)
}
```

**Response:**

```typescript
interface CalendarResponse {
  venue_id: string;
  week_start: string;
  slots: CalendarSlot[];
  delivery_summary: {
    total_slots: number;
    delivered: number;
    pending: number;
    failed: number;
  };
}
```

**Response:** `ResponseEnvelope<CalendarResponse>`

#### `POST /cms/calendar/slots`

Creates a new calendar slot entry. The 72h delivery lead time is enforced: `start_time` must be at least 72 hours from now. Server rejects with `PRE_CONSTRAINT` if the constraint is violated.

**Required role:** CONTENT_MANAGER+
**Widget:** Tab 2 slot creation control
**Push vs poll:** Write endpoint; no broadcast.

**Request body:**

```typescript
interface CreateSlotRequest {
  venue_id: string;                           // required
  start_time: string;                         // required; ISO 8601; must be >= now + 72h
  content_id: string;                         // required
  delivery_priority: 'ROUTINE' | 'HIGH_PRIORITY';  // required; 'DEGRADED' is system-assigned only
  end_time?: string;                          // optional
}
```

**Response:** `ResponseEnvelope<CalendarSlot>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 422 | `PRE_CONSTRAINT` | `start_time` < now + 72h |
| 403 | `AUTHORITY_BOUNDARY` | Role < CONTENT_MANAGER |

---

### Tab 3 — Pending Approval

#### `GET /cms/approvals`

Returns items pending approval.

**Required role:** VIEWER+
**Widget:** Tab 3 approval queue
**Push vs poll:** Poll on tab activation.

**Query params:**

```typescript
interface ApprovalListParams extends PaginationParams {
  status?: 'pending' | 'approved' | 'rejected';
}
```

**Response:**

```typescript
interface ApprovalItem {
  approval_id: string;
  content_id: string;
  content_title: string;
  submitted_by: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}
```

**Response:** `ResponseEnvelope<ApprovalItem[]>`

#### `POST /cms/approvals/{id}/approve`

Approves a content item.

**Required role:** CONTENT_MANAGER+
**Widget:** Tab 3 approve action
**Push vs poll:** Write endpoint.

**Request body:** None.

**Response:** `ResponseEnvelope<ApprovalItem>`

#### `POST /cms/approvals/{id}/reject`

Rejects a content item.

**Required role:** CONTENT_MANAGER+
**Widget:** Tab 3 reject action
**Push vs poll:** Write endpoint.

**Request body:**

```typescript
interface RejectApprovalRequest {
  rejection_reason: string;   // required; min 10 chars
}
```

**Response:** `ResponseEnvelope<ApprovalItem>`

---

### Tab 4 — Distribution

#### `GET /cms/distribution`

Returns delivery path state for a venue.

**Required role:** VIEWER+
**Widget:** Tab 4 distribution panel
**Push vs poll:** Poll on tab activation; updates driven by `DELIVERY_STATE_UPDATE`.

**Query params:**

```typescript
interface DistributionParams {
  venue_id: string;   // required
}
```

**Response:**

```typescript
interface DistributionResponse {
  venue_id: string;
  delivery_path_state: 'NOMINAL' | 'DEGRADED' | 'STALLED' | 'UNKNOWN';
  pending_deliveries: Array<{
    slot_id: string;
    content_title: string;
    delivery_priority: DeliveryPriority;
    deadline: string;
    status: 'QUEUED' | 'IN_TRANSIT' | 'FAILED' | 'RETRYING';
    attempts: number;
    last_attempt_at: string | null;
  }>;
  last_successful_delivery_at: string | null;
}
```

**Response:** `ResponseEnvelope<DistributionResponse>`

---

### Tab 5 — Delivery Confidence

#### `GET /cms/delivery-confidence`

Returns delivery confidence countdown and priority for a venue against a deadline.

**Required role:** VIEWER+
**Widget:** Tab 5 delivery confidence panel
**Push vs poll:** Poll on tab activation; updates driven by `DELIVERY_STATE_UPDATE`.

**Query params:**

```typescript
interface DeliveryConfidenceParams {
  venue_id: string;     // required
  deadline: string;     // required; ISO 8601; the target delivery deadline
}
```

**Response:**

```typescript
interface DeliveryConfidenceResponse {
  venue_id: string;
  deadline: string;
  countdown_ms: number;                           // ms until deadline; client renders countdown from this
  delivery_priority: DeliveryPriority;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'AT_RISK';
  pending_item_count: number;
  delivered_item_count: number;
  risk_factors: string[];
}
```

**Response:** `ResponseEnvelope<DeliveryConfidenceResponse>`

---

### Tab 6 — Archive

#### `GET /cms/archive`

Returns archived content for a venue.

**Required role:** VIEWER+
**Widget:** Tab 6 archive panel
**Push vs poll:** Poll on tab activation.

**Query params:**

```typescript
interface ArchiveParams extends PaginationParams {
  venue_id: string;   // required
  from?: string;      // ISO 8601 date filter
  to?: string;
}
```

**Response:** `ResponseEnvelope<ContentItem[]>`

---

### Training Mode Toggle

#### `PATCH /cms/training-mode`

Enables or disables training mode for the CMS surface. In training mode, write actions are sandboxed and do not affect live content.

**Required role:** CONTENT_MANAGER+
**Widget:** Training mode toggle
**Push vs poll:** Write endpoint.

**Request body:**

```typescript
interface TrainingModeRequest {
  enabled: boolean;   // required
}
```

**Response:** `ResponseEnvelope<{ enabled: boolean; changed_at: string; changed_by: string }>`

---

## 7. Venue Operations Surface Endpoints

The Venue Operations Surface presents a 6-tab venue management workspace. The RECOVERED_BUT_UNTRUSTED machine state blocks overrides. The 72h autonomy clock is client-computed from server-supplied `autonomy_expires_at`.

---

### Venue Summary

#### `GET /venues/{venue_id}/ops-summary`

Returns the venue operations header data: machine state, autonomy status, and screen count.

**Required role:** VIEWER+
**Widget:** Venue Operations Surface header
**Push vs poll:** Poll on mount; updates driven by `VENUE_STATE_UPDATE`.

**Response:**

```typescript
interface VenueOpsSummaryResponse {
  venue_id: string;
  name: string;
  machine_state: MachineState;
  constitutional_state: ConstitutionalState;
  trust_state: TrustState;
  screen_count: number;
  autonomy_status: {
    in_autonomy_mode: boolean;
    autonomy_expires_at: string | null;   // client computes countdown from this
    autonomy_started_at: string | null;
    corpus_id_at_entry: string | null;
  };
  override_blocked: boolean;   // true when RECOVERED_BUT_UNTRUSTED
}
```

**Response:** `ResponseEnvelope<VenueOpsSummaryResponse>`

---

### Tab 1 — Status Dashboard

#### `GET /venues/{venue_id}/status`

Returns all player status cards and signal quality cards for the status dashboard.

**Required role:** VIEWER+
**Widget:** Tab 1 status dashboard
**Push vs poll:** Poll on tab activation; updates driven by `VENUE_STATE_UPDATE`.

**Response:**

```typescript
interface VenueStatusResponse {
  venue_id: string;
  player_status_cards: Array<{
    screen_id: string;
    screen_name: string;
    player_state: 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' | 'OFFLINE';
    corpus_loaded: boolean;
    uptime_seconds: number | null;
    last_heartbeat_at: string | null;
    error_code: string | null;
    error_message: string | null;
  }>;
  signal_quality_cards: Array<{
    signal_type: 'NETWORK' | 'DISPLAY_LINK' | 'POWER';
    status: 'GOOD' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
    last_measured_at: string | null;
    detail: string | null;
  }>;
  checked_at: string;
}
```

**Response:** `ResponseEnvelope<VenueStatusResponse>`

---

### Tab 2 — Screen Management

#### `GET /venues/{venue_id}/screens`

Returns all screens enrolled at the venue.

**Required role:** VIEWER+
**Widget:** Tab 2 screen management table
**Push vs poll:** Poll on tab activation.

**Query params:** `PaginationParams`

**Response:**

```typescript
interface Screen {
  screen_id: string;
  venue_id: string;
  name: string;
  machine_state: MachineState;
  enrolled_at: string;
  last_seen_at: string | null;
  player_version: string | null;
  hardware_id: string | null;
}
```

**Response:** `ResponseEnvelope<Screen[]>`

#### `POST /venues/{venue_id}/screens/enroll`

Enrolls a new screen at the venue.

**Required role:** OPERATOR+
**Widget:** Tab 2 screen enrollment control
**Push vs poll:** Write endpoint.

**Request body:**

```typescript
interface EnrollScreenRequest {
  name: string;          // required
  hardware_id: string;   // required; unique hardware identifier
}
```

**Response:** `ResponseEnvelope<Screen>`

#### `DELETE /venues/{venue_id}/screens/{screen_id}`

Removes a screen from the venue. ADMIN only.

**Required role:** ADMIN
**Widget:** Tab 2 screen removal control (absent from DOM for non-ADMIN)
**Push vs poll:** Write endpoint.

**Response:** `ResponseEnvelope<{ screen_id: string; removed_at: string }>`

---

### Tab 3 — Corpus Status

#### `GET /venues/{venue_id}/corpus-status`

Returns corpus hash verification status and delivery state for the venue.

**Required role:** VIEWER+
**Widget:** Tab 3 corpus status panel
**Push vs poll:** Poll on tab activation.

**Response:**

```typescript
interface CorpusStatusResponse {
  venue_id: string;
  current_corpus_id: string | null;
  corpus_version: string | null;
  hash_verified: boolean;
  hash_match: boolean;
  verified_at: string | null;
  last_delivery_at: string | null;
  delivery_status: 'CURRENT' | 'PENDING_UPDATE' | 'STALE' | 'UNKNOWN';
  pending_update: {
    corpus_id: string;
    version: string;
    expected_delivery_at: string;
    delivery_priority: DeliveryPriority;
  } | null;
}
```

**Response:** `ResponseEnvelope<CorpusStatusResponse>`

#### `POST /venues/{venue_id}/corpus-status/verify`

Triggers a corpus hash re-verification. This is an async operation; the result is returned on the next poll of `GET /venues/{venue_id}/corpus-status`.

**Required role:** OPERATOR+
**Widget:** Tab 3 re-verify control
**Push vs poll:** Write endpoint; result available on next poll.

**Request body:** None.

**Response:** `ResponseEnvelope<{ verification_triggered_at: string; expected_completion_by: string }>`

---

### Tab 4 — Connectivity

#### `GET /venues/{venue_id}/connectivity`

Returns signal quality and link state history for the venue.

**Required role:** VIEWER+
**Widget:** Tab 4 connectivity panel
**Push vs poll:** Poll on tab activation.

**Response:**

```typescript
interface ConnectivityResponse {
  venue_id: string;
  current_signal: {
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE';
    rssi_dbm: number | null;
    latency_ms: number | null;
    packet_loss_percent: number | null;
    measured_at: string;
  };
  link_state_history: Array<{
    state: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
  }>;
}
```

**Response:** `ResponseEnvelope<ConnectivityResponse>`

---

### Tab 5 — Machine State History

#### `GET /venues/{venue_id}/machine-state-history`

Returns machine state transition history with computed durations (PATCH-020 compliance: durations computed server-side, never client-side).

**Required role:** VIEWER+
**Widget:** Tab 5 machine state history timeline
**Push vs poll:** Poll on tab activation.

**Query params:** `PaginationParams`

**Response:**

```typescript
interface MachineStateHistoryResponse {
  venue_id: string;
  transitions: Array<{
    transition_id: string;
    from_state: MachineState;
    to_state: MachineState;
    transitioned_at: string;
    triggered_by: string | null;        // operator_id or system event
    reason: string | null;
    duration_in_previous_state_seconds: number | null;  // server-computed
  }>;
}
```

**Response:** `ResponseEnvelope<MachineStateHistoryResponse>`

---

### Tab 6 — Configuration

#### `GET /venues/{venue_id}/config`

Returns venue configuration. ADMIN only.

**Required role:** ADMIN
**Widget:** Tab 6 configuration panel (absent from DOM for non-ADMIN)
**Push vs poll:** Poll on tab activation.

**Response:**

```typescript
interface VenueConfig {
  venue_id: string;
  config: Record<string, unknown>;   // venue-specific configuration map
  updated_at: string;
  updated_by: string | null;
  version: number;
}
```

**Response:** `ResponseEnvelope<VenueConfig>`

#### `PATCH /venues/{venue_id}/config`

Updates venue configuration. ADMIN only.

**Required role:** ADMIN
**Widget:** Tab 6 configuration edit control (absent from DOM for non-ADMIN)
**Push vs poll:** Write endpoint.

**Request body:**

```typescript
interface UpdateVenueConfigRequest {
  config: Record<string, unknown>;   // partial update; merged server-side
  version: number;                   // required; optimistic lock
}
```

**Response:** `ResponseEnvelope<VenueConfig>`

**Error cases:**

| HTTP | rejection.type | Condition |
|------|---------------|-----------|
| 409 | `CONCURRENCY_CONFLICT` | `version` mismatch |

---

### Autonomy Clock

The autonomy clock displayed in the Venue Operations Surface header is NOT a dedicated endpoint. It is derived from `GET /venues/{venue_id}` → `autonomy_status.autonomy_expires_at` and rendered client-side as a countdown timer.

**Implementation note:** The client computes `countdown_ms = new Date(autonomy_expires_at).getTime() - Date.now()` and decrements the display locally. The server is the only authority on `autonomy_expires_at`. Do not re-derive or adjust this value client-side.

---

## 8. WebSocket Push Event Contracts

All push events are delivered over the `WS /subscribe` connection (Section 2). Clients must subscribe to the relevant channel before events are delivered.

All events share a common envelope:

```typescript
interface PushEventEnvelope<T> {
  type: string;           // event type identifier
  payload: T;
  server_time: string;    // ISO 8601
  sequence_number: number; // monotonically increasing per channel
}
```

**Delivery guarantee:** At-least-once. Clients must handle duplicate events idempotently using `sequence_number`. On reconnection, clients must poll REST endpoints for current state rather than relying on missed push events.

---

### `VENUE_STATE_UPDATE`

Triggered when venue machine state, constitutional state, or trust state changes.

**Channel:** `venues` or `venue:{venue_id}`
**Updates:** Venue list items, venue detail header, Zone A fleet tiles, Venue Operations Surface header.

```typescript
interface VenueStateUpdatePayload {
  venue_id: string;
  machine_state: MachineState;
  constitutional_state: ConstitutionalState;
  trust_state: TrustState;
  sequence_number: number;
  changed_fields: Array<keyof VenueSummary>;
}
```

---

### `INCIDENT_UPDATE`

Triggered when an incident is updated (severity, state, commander, etc.).

**Channel:** `incidents` or `incident:{incident_id}`
**Updates:** Incident Command Surface, incident tray, fleet tile severity badges.

```typescript
interface IncidentUpdatePayload {
  incident_id: string;
  severity: IncidentSeverity;
  state: IncidentState;
  commander_id: string | null;
  updated_fields: string[];     // field names that changed
  sequence_number: number;
  updated_at: string;
}
```

---

### `INCIDENT_CREATED`

Triggered when a new incident is declared.

**Channel:** `incidents`
**Updates:** Incident list, notification tray, fleet tile.

```typescript
interface IncidentCreatedPayload {
  incident: IncidentFull;
}
```

---

### `INCIDENT_CLOSED`

Triggered when an incident is closed.

**Channel:** `incidents` or `incident:{incident_id}`
**Updates:** Incident list, incident tray badge count, fleet tile.

```typescript
interface IncidentClosedPayload {
  incident_id: string;
  closed_at: string;
  closed_by: string;
}
```

---

### `OVERRIDE_PLACED`

Triggered when an override is placed on a venue.

**Channel:** `incident:{incident_id}` or `venue:{venue_id}`
**Updates:** Tab 3 override inventory, Zone B override list.

```typescript
interface OverridePlacedPayload {
  incident_id: string | null;
  venue_id: string;
  override: Override;
}
```

---

### `OVERRIDE_REMOVED`

Triggered when an override is removed.

**Channel:** `incident:{incident_id}` or `venue:{venue_id}`
**Updates:** Tab 3 override inventory, Zone B override list.

```typescript
interface OverrideRemovedPayload {
  incident_id: string | null;
  venue_id: string;
  override_id: string;
  removed_by: string;
  removed_at: string;
}
```

---

### `COMMANDER_CLAIMED`

Triggered when an operator claims incident commander.

**Channel:** `incident:{incident_id}`
**Updates:** Incident Command Surface header, commander claim button state.

```typescript
interface CommanderClaimedPayload {
  incident_id: string;
  operator_id: string;
  display_name: string;
  claimed_at: string;
}
```

---

### `COMMANDER_RELEASED`

Triggered when the commander releases incident command.

**Channel:** `incident:{incident_id}`
**Updates:** Incident Command Surface header, commander claim button state.

```typescript
interface CommanderReleasedPayload {
  incident_id: string;
  released_at: string;
}
```

---

### `COMMANDER_LAPSED`

Triggered when commander status lapses (inactivity or timeout). The client starts a countdown display from `lapsed_at` to drive urgency UI.

**Channel:** `incident:{incident_id}`
**Updates:** Incident Command Surface commander status, COMMANDER_LAPSED banner.

```typescript
interface CommanderLapsedPayload {
  incident_id: string;
  lapsed_at: string;   // client starts countdown from this timestamp
}
```

---

### `ADVISORY_UPDATE`

Triggered when advisory content or level changes for a venue. Requires `advisory_level` field — see Section 9 (A-NEW-01).

**Channel:** `venue:{venue_id}`
**Updates:** Zone C advisory pane, fleet tile advisory indicator.

```typescript
interface AdvisoryUpdatePayload {
  venue_id: string;
  advisory_level: AdvisoryLevel | null;   // A-NEW-01: new field required
  content: string | null;
  updated_at: string;
}
```

---

### `COLLABORATOR_POSITION`

Triggered when a replay session collaborator updates their playhead position. Requires new push event type — see Section 9 (A-NEW-03).

**Channel:** `replay_session:{session_id}`
**Updates:** Replay timeline collaborator position indicators.

```typescript
interface CollaboratorPositionPayload {
  session_id: string;
  operator_id: string;
  display_name: string;
  position_ms: number;   // A-NEW-03: new event required
}
```

---

### `ANNOTATION_ADDED`

Triggered when a new annotation is added to a replay session.

**Channel:** `replay_session:{session_id}`
**Updates:** Tab 3 annotation list, timeline annotation markers.

```typescript
interface AnnotationAddedPayload {
  session_id: string;
  annotation: ReplayAnnotation;   // includes contradiction_flag
}
```

---

### `ANNOTATION_CONTRADICTION_DETECTED`

Triggered when server-side contradiction detection identifies conflicting annotations.

**Channel:** `replay_session:{session_id}`
**Updates:** Tab 3 annotation list (mark both annotations with contradiction indicator).

```typescript
interface AnnotationContradictionDetectedPayload {
  session_id: string;
  annotation_a_id: string;
  annotation_b_id: string;
}
```

---

### `DELIVERY_STATE_UPDATE`

Triggered when delivery state for a content slot changes. Requires `delivery_priority` field — see Section 9 (A-NEW-02).

**Channel:** `venue:{venue_id}`
**Updates:** Tab 2 calendar slot status, Tab 5 delivery confidence countdown.

```typescript
interface DeliveryStateUpdatePayload {
  venue_id: string;
  slot_id: string;
  delivery_priority: DeliveryPriority;   // A-NEW-02: new field required
  countdown_ms: number;
  status: CalendarSlot['status'];
}
```

---

### `REJECTION_STATE_PUSH`

Triggered when a write is rejected and the server pushes the current authoritative state to the affected client. This is a new push event type — see Section 9 (A-NEW-04). Used to ensure the rejecting client's state is immediately corrected.

**Channel:** Targeted to the operator whose write was rejected.
**Updates:** Whichever entity was involved in the rejection — the client must refetch from the `entity_type`/`entity_id` fields.

```typescript
interface RejectionStatePushPayload {
  affected_entity: string;         // e.g. "incident:abc123"
  entity_type: string;             // e.g. "incident"
  current_state: Record<string, unknown>;
  triggered_by: 'REJECTION';      // A-NEW-04: new push event type required
}
```

---

### `SYSTEM_HEALTH_UPDATE`

Triggered when the platform constitutional state changes.

**Channel:** `system`
**Updates:** Status bar, global health indicator.

```typescript
interface SystemHealthUpdatePayload {
  constitutional_state: ConstitutionalState;
  status_bar: SystemHealthResponse['status_bar'];
}
```

---

### `NOTIFICATION_CREATED`

Triggered when a new notification is created for the subscribed operator.

**Channel:** `system` (operator-scoped)
**Updates:** Notification tray, badge count.

```typescript
interface NotificationCreatedPayload {
  notification: Notification;
}
```

---

### `ZONE_B_AUTO_REPLACE`

Triggered for S1/S2 incidents to signal that Zone B should auto-replace with the Incident Command Surface. The frontend must handle this event to implement the auto-replace behaviour without waiting for user navigation.

**Channel:** `incident:{incident_id}`
**Updates:** Zone B auto-replace trigger; client navigates to Incident Command Surface for this incident.

```typescript
interface ZoneBAutoReplacePayload {
  incident_id: string;
  severity: 'S1' | 'S2';   // only fired for S1/S2
}
```

---

## 9. Missing Backend Contracts (Identified Gaps)

The following contracts are required by the frontend but are not yet confirmed in the backend implementation. Each item is tagged with a gap identifier for tracking.

---

### A-NEW-01 — `advisory_level` field on advisory push events

**Gap:** The `ADVISORY_UPDATE` WebSocket event and `GET /venues/{venue_id}/advisory` REST response must include an `advisory_level: AdvisoryLevel | null` field.

**Required by:** Zone C advisory pane, fleet tile advisory indicator, `ADVISORY_UPDATE` push event.

**Action required:** Backend must add `advisory_level` to the advisory entity and include it in all advisory-related responses and push events.

---

### A-NEW-02 — `delivery_priority` field on calendar slot and delivery confidence endpoints

**Gap:** `CalendarSlot`, `DeliveryConfidenceResponse`, and `DELIVERY_STATE_UPDATE` push events must include `delivery_priority: DeliveryPriority`. The system value `'DEGRADED'` must be system-assigned only — it must not be accepted as a client-supplied value in `POST /cms/calendar/slots`.

**Required by:** Tab 2 calendar grid, Tab 5 delivery confidence panel, `DELIVERY_STATE_UPDATE` handler.

**Action required:** Backend must add `delivery_priority` to the calendar slot entity and delivery confidence calculation.

---

### A-NEW-03 — Collaborator position push via WebSocket

**Gap:** The `COLLABORATOR_POSITION` push event type does not exist in the current backend. This requires a new WebSocket event type and the infrastructure to broadcast position updates to session collaborators.

**Required by:** Replay Investigation Surface collaborator position indicators.

**Action required:** Backend must implement `COLLABORATOR_POSITION` as a new push event, triggered by `PATCH /replay/sessions/{session_id}/collaborators/me/position`.

---

### A-NEW-04 — `REJECTION_STATE_PUSH` event

**Gap:** The `REJECTION_STATE_PUSH` push event type does not exist. This event is required to ensure that when a write is rejected (e.g., due to `CONCURRENCY_CONFLICT`), the rejecting client immediately receives the authoritative current state without requiring a manual poll.

**Required by:** Any surface that performs writes with optimistic locking.

**Action required:** Backend must implement `REJECTION_STATE_PUSH` as a targeted push event, sent to the operator whose write was rejected.

---

### `version` field on incident entity for optimistic locking

**Gap:** The incident entity must expose a `version: number` field. This field is required by `PATCH /incidents/{incident_id}/severity` and `POST /incidents/{incident_id}/transitions` to prevent concurrent modification conflicts.

**Required by:** Tab 1 severity update, Tab 5 transition apply.

**Action required:** Backend must add `version` to the incident entity and enforce optimistic locking on all severity and transition writes.

---

### `confirmed_steps: number` field on L6 override creation

**Gap:** `POST /incidents/{incident_id}/overrides/l6` requires `confirmation_steps_completed: 3` and `confirmed_steps: number` to enforce that the client-side 3-step chip-select flow has been completed. The backend must validate that `confirmed_steps === 3` and reject with 422 otherwise.

**Required by:** Tab 3 L6 override placement.

**Action required:** Backend must validate `confirmed_steps` on L6 override creation.

---

### Tab 6 counterfactual endpoint returning 404 for non-ADMIN

**Gap:** `GET /replay/sessions/{session_id}/counterfactual` must return `404 Not Found` for non-ADMIN roles, not `403 Forbidden`. This is a role-obscuring requirement to prevent non-ADMIN operators from inferring the existence of counterfactual analysis by observing the HTTP status code.

**Required by:** Replay Investigation Surface Tab 6.

**Action required:** Backend must return 404 (not 403) for non-ADMIN requests to this endpoint.

---

### `ZONE_B_AUTO_REPLACE` WebSocket event

**Gap:** The `ZONE_B_AUTO_REPLACE` push event does not exist. This event is required for S1/S2 incidents to trigger automatic Zone B replacement with the Incident Command Surface without requiring user navigation.

**Required by:** Live Operations Surface Zone B auto-replace behaviour.

**Action required:** Backend must implement `ZONE_B_AUTO_REPLACE` as a push event on the `incident:{incident_id}` channel, fired when an S1 or S2 incident is created or escalated to S1/S2.

---

## 10. Permissions Matrix

The following table maps each write endpoint to its minimum required role. Read endpoints accessible to VIEWER+ are not listed; see individual sections for role requirements on GET endpoints with elevated access.

For absent-not-disabled enforcement: any write control whose endpoint appears in this table must be absent from the DOM (not rendered, not disabled) when the current operator's role is below the minimum.

| Endpoint | Min Role | Notes |
|----------|----------|-------|
| `POST /venues/{venue_id}/overrides` | OPERATOR | Blocked if `machine_state === RECOVERED_BUT_UNTRUSTED` |
| `POST /incidents` | OPERATOR | |
| `POST /incidents/{id}/overrides/l6` | OPERATOR | 3-step client chip-select confirmation required before call |
| `DELETE /incidents/{id}/overrides/{override_id}` | OPERATOR | 3s hold-to-confirm required before call |
| `PATCH /incidents/{id}/severity` | OPERATOR | Optimistic lock via `version` field |
| `PUT /incidents/{id}/notes` | OPERATOR | Notes are append-only |
| `POST /incidents/{id}/transitions` | OPERATOR | Optimistic lock via `version` field |
| `POST /incidents/{id}/commander/claim` | OPERATOR | Returns 409 if already claimed |
| `DELETE /incidents/{id}/commander` | OPERATOR | Must be current commander |
| `POST /incidents/{id}/commander/notify` | OPERATOR | 429 if within 60s cooldown |
| `POST /replay/sessions` | OPERATOR | ADMIN required for `session_type: 'COUNTERFACTUAL'` |
| `PATCH /replay/sessions/{id}/transport` | OPERATOR | REPLAY_MODE rejection if session invalid |
| `PATCH /replay/sessions/{id}/collaborators/me/position` | VIEWER | Position broadcast only; no authority action |
| `POST /replay/sessions/{id}/annotations` | OPERATOR | Additive only; no edit/delete |
| `POST /replay/sessions/{id}/findings` | OPERATOR | Additive only |
| `POST /cms/calendar/slots` | CONTENT_MANAGER | 72h lead time enforced server-side |
| `POST /cms/approvals/{id}/approve` | CONTENT_MANAGER | |
| `POST /cms/approvals/{id}/reject` | CONTENT_MANAGER | |
| `PATCH /cms/training-mode` | CONTENT_MANAGER | |
| `POST /venues/{venue_id}/screens/enroll` | OPERATOR | |
| `POST /venues/{venue_id}/corpus-status/verify` | OPERATOR | Async; result on next poll |
| `GET /incidents/{id}/evidence` (Tab 6) | ADMIN | Returns 403 for all others; tab absent from DOM for non-ADMIN |
| `GET /replay/sessions/{id}/counterfactual` (Tab 6) | ADMIN | Returns 404 for non-ADMIN (role-obscuring); tab absent from DOM |
| `POST /replay/sessions` with `COUNTERFACTUAL` type | ADMIN | 403 for OPERATOR |
| `DELETE /venues/{venue_id}/screens/{screen_id}` | ADMIN | Tab 2 control absent from DOM for non-ADMIN |
| `GET /venues/{venue_id}/config` | ADMIN | Tab 6 absent from DOM for non-ADMIN |
| `PATCH /venues/{venue_id}/config` | ADMIN | Optimistic lock via `version`; Tab 6 absent from DOM for non-ADMIN |

---

*End of API Contract Matrix v1*
