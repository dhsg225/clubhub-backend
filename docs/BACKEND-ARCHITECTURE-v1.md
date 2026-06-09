# ClubHub TV — Backend System Architecture v1.0

**Document type:** Formal systems architecture
**Date:** 2026-05-16
**Status:** Canonical — supersedes ad-hoc architectural decisions
**Scope:** Backend services, data model, data flow, failure behavior, deployment

---

## 0. Document Scope and Constraints

This document specifies the backend architecture for ClubHub TV. It assumes:

- Existing runtime: Node.js / Express, PostgreSQL 15, Caddy reverse proxy
- Existing player protocol: HTTP poll every 15 seconds, manifest-based
- Existing Pi appliance: local disk cache, watchdog, 3-failure reboot
- Scale target: up to 500 screens per venue, up to 50 venues per organization
- Team size: small (1–3 backend engineers)

All architectural recommendations are constrained by operational reality. Complexity is introduced only when a simpler alternative is insufficient.

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATOR API GATEWAY                                 │
│              Authentication · Rate Limiting · Request Routing               │
└────────┬────────────┬───────────┬───────────┬──────────────┬───────────────┘
         │            │           │           │              │
    ┌────▼────┐  ┌────▼────┐ ┌───▼───┐  ┌───▼───┐   ┌──────▼──────┐
    │Scheduling│  │Emergency│ │Device │  │Sponsor│   │  Override   │
    │ Service  │  │ Service │ │  Mgmt │  │Engine │   │  Service    │
    └────┬────┘  └────┬────┘ └───┬───┘  └───┬───┘   └──────┬──────┘
         │            │          │           │               │
         └────────────┴──────────┴───────────┴───────────────┘
                                  │
                         ┌────────▼────────┐
                         │      PRE        │  ← pure resolution function
                         │  (no I/O side   │     called synchronously
                         │   effects)      │     by Manifest Delivery
                         └────────┬────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │    MANIFEST DELIVERY SYSTEM  │
                    │  Cache · Versioning · Serve  │
                    └─────────────┬───────────────┘
                                  │ HTTP polling
              ┌───────────────────┼───────────────────┐
         ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
         │ Browser │         │  Pi     │         │  Pi     │
         │ Player  │         │Appliance│         │Appliance│
         └─────────┘         └─────────┘         └─────────┘

  Cross-cutting services (all above services publish to):
  ┌──────────────────────────────────────────┐
  │         AUDIT / EVENT LOG                │
  │  append-only · immutable · queryable     │
  └──────────────────────────────────────────┘

  Derived output (Proof-of-Play):
  ┌──────────────────────────────────────────┐
  │      PROOF-OF-PLAY SERVICE               │
  │  reads delivery_log · generates reports  │
  └──────────────────────────────────────────┘
```

### Architectural Pattern: Modular Monolith

Single deployable process. Services are internal modules with explicit contracts, not network processes. Module boundaries are enforced through interface discipline, not network isolation. Extraction to separate processes is a future option, not a current requirement.

**Rationale:** At current scale, network hops between services add latency on the critical path (screen poll → manifest delivery) with no compensating benefit. A modular monolith at this scale is faster, simpler to operate, and easier to debug. The module boundaries defined here are identical to what a future microservice decomposition would use.

---

## 2. Service Definitions and Responsibilities

### 2.1 Operator API Gateway

**Responsibility:** Single ingress for all operator-facing requests. Does not own state.

**Functions:**
- Authentication and session management (API key or JWT)
- Role-based authorization: `org_admin`, `venue_manager`, `shift_manager`, `sales_rep`
- Request routing to internal service modules
- Rate limiting per operator (not per screen — screen polling has its own rate limiter)
- Request ID injection (existing middleware retained)
- Audit event emission for all mutating requests

**Does not do:** Business logic, state mutation, direct database access.

**Routes owned:**
```
/api/v2/*   → internal service dispatch
/manifest   → bypasses gateway; routed directly to Manifest Delivery System
```

The manifest endpoint is intentionally outside the gateway. It is on the critical polling path for potentially hundreds of devices. Gateway auth overhead must not touch it.

---

### 2.2 Scheduling Service

**Responsibility:** Authoritative owner of scheduling intent. Manages the lifecycle of campaigns and their materialized schedule rows.

**Owns (authoritative state):**
- `campaigns`
- `campaign_content_items`
- `campaign_schedules`
- `schedules` (the PRE's working table — written by this service, read by PRE)

**Functions:**
- Campaign CRUD with draft/published lifecycle
- Campaign schedule window management
- Schedule materialization: on publish, writes resolved rows to `schedules` table
- Conflict pre-check invocation (calls Conflict Detector before any publish)
- Rollback: restores `rollback_snapshot` and re-materializes
- Staged publish: materializes only for specified area subset
- Emits: `campaign.published`, `campaign.rolled_back`, `campaign.archived`
- On emit: calls Cache Invalidator with affected screen set

**Materialization contract:**

When a campaign is published, the Scheduling Service translates `campaign_schedules` rows into `schedules` rows. Each `schedules` row has `campaign_id` set. This is the only write path to `schedules` for operator-created campaigns. Direct `POST /schedules` is retained for backward compatibility only and emits a deprecation warning.

```
publishCampaign(campaignId, staged_area_ids?):
  1. Load campaign + campaign_schedules + campaign_content_items
  2. Run ConflictDetector.check(campaign, schedules) → throw on blocking
  3. Capture rollback_snapshot = current published state for affected areas
  4. BEGIN TRANSACTION
       DELETE FROM schedules WHERE campaign_id = campaignId
       INSERT INTO schedules (area_id, venue_id, content_id, campaign_id,
                              priority, days_of_week, time_of_day_start,
                              time_of_day_end, starts_at, ends_at,
                              duration, is_fallback, ...)
         FOR EACH content_item × schedule_window in campaign
  5. UPDATE campaigns SET status='published', published_at=NOW()
  6. COMMIT
  7. Emit campaign.published { campaign_id, affected_area_ids, affected_screen_ids }
```

**Conflict Detector** (sub-module of Scheduling Service):

```
check(campaign, proposedSchedules):
  blocking ← []
  warnings ← []

  FOR EACH window × area IN proposedSchedules:
    // Exclusivity collision (blocking)
    IF campaign.type = 'sponsor':
      collision ← SELECT FROM sponsorship_contracts
        WHERE area_id = area AND category = campaign.category
          AND exclusivity = 'exclusive'
          AND windowsOverlap(window)
          AND status = 'active'
      IF collision: blocking.append(EXCLUSIVITY_COLLISION)

    // Saturation (warning → blocking at threshold)
    sponsor_share ← SUM(share_of_voice) FROM active sponsorship_contracts
      WHERE area_id = area AND windowsOverlap(window)
    IF sponsor_share + proposed_share > 40%: warnings.append(SATURATION)
    IF sponsor_share + proposed_share > 60%: blocking.append(SATURATION_BLOCK)

    // Mandate suppression (blocking)
    IF campaign overrides AND mandated campaigns exist in scope:
      blocking.append(MANDATE_SUPPRESSION)

  RETURN { blocking, warnings }
```

---

### 2.3 Playback Resolution Engine (PRE)

**Responsibility:** Deterministic computation of what a screen must display at a given instant. **Pure function. No I/O. No state ownership.**

**Owns:** Nothing. Reads from all other services' tables. Writes nothing.

**Function signature:**
```
PRE.resolve(screen_id: string, at: Date): PRE_Output
```

**PRE_Output:**
```typescript
{
  screen_id:        string,
  timestamp:        Date,
  active_playlist:  PlaylistItem[],
  content_mix:      ContentMix,        // { campaign: %, sponsor: %, override: %, fallback: % }
  reason_trace:     string[],          // ordered resolution steps taken
  confidence_score: number,            // 0.0–1.0
  valid_until:      Date,              // earliest expiry of any active rule
  resolution_level: 0|1|2|3|4|5|6     // which level produced the output
}
```

The PRE makes no network calls. It receives a database connection and executes queries within a single read transaction. All queries are reads. The transaction uses `READ COMMITTED` isolation — PRE always sees the latest committed state.

**Internal module structure:**
```
pre/
  index.js              ← orchestrates resolution, calls sub-resolvers in order
  emergencyResolver.js  ← Level 0: queries emergency_states
  overrideResolver.js   ← Levels 1–2: queries overrides (type, scope, time)
  campaignResolver.js   ← Level 3: queries schedules (existing engine, extended)
  sponsorshipEngine.js  ← Level 4: queries sponsorship_contracts, injects
  structuralResolver.js ← Level 5: area→group→screen inheritance verification
  deviceTruthLayer.js   ← Level 6: reads last delivery log entry, annotates
  playlistUtils.js      ← weightedResolver, checksum, contentMix, validUntil
```

**Resolution levels:**

| Level | Name | Source |
|---|---|---|
| 0 | Emergency Override | `emergency_states` |
| 1 | Operational Override | `overrides` WHERE type='operational' |
| 2 | Scheduled Override | `overrides` WHERE type IN ('scheduled','group') |
| 3 | Campaign Layer | `schedules` (materialized by Scheduling Service) |
| 4 | Sponsorship Injection | `sponsorship_contracts` |
| 5 | Structural Resolution | area→group→screen inheritance (in-memory) |
| 6 | Device Truth Annotation | `screen_delivery_log` (annotation only, no output change) |

**Performance contract:**
- PRE must complete in < 20ms for a screen with < 50 active schedules
- All queries must use indexed columns
- No N+1 queries — all required data is fetched in at most 6 queries

**Parallelized query plan:**
```
parallel fetch:
  Q1: emergency_states WHERE venue_id = ? AND status = 'active'
  Q2: overrides WHERE scope IN (screen, group, area) AND status = 'active'
  Q3: sponsorship_contracts WHERE area_id = ? AND window active

serial (depends on Q1, Q2):
  IF Q1 has result → return immediately (Level 0)
  IF Q2 has result → build base from override
  ELSE → Q4: schedules (campaign layer)

serial (depends on Q3, Q4):
  Q5: inject sponsorship into playlist (in-memory)

serial (depends on Q5):
  Q6: screen_delivery_log last entry for screen (annotation only)
```

**Full resolution algorithm:**

```
FUNCTION resolvePRE(screen_id, at):

  ── BUILD CONTEXT ──────────────────────────────────────────────────────
  screen     ← screens WHERE id = screen_id
  IF screen.status = 'unprovisioned':
    RETURN systemFallback("unprovisioned")

  tv_group   ← tv_groups WHERE id = screen.tv_group_id
  area       ← areas WHERE id = screen.area_id
  venue      ← venues WHERE id = screen.venue_id
  org        ← organizations WHERE id = venue.org_id
  local_time ← toLocalTime(at, venue.timezone)
  trace      ← []

  ── LEVEL 0: EMERGENCY ─────────────────────────────────────────────────
  emergency ← emergency_states
    WHERE venue_id = venue.id AND status = 'active' AND activated_at <= at

  IF emergency EXISTS:
    content ← emergency.content_id ?? platformDefaultEmergencyContent()
    trace.append("L0:EMERGENCY:" + emergency.id)
    RETURN buildOutput([content], trace, confidence=1.0)

  ── LEVEL 1: OPERATIONAL OVERRIDE ──────────────────────────────────────
  op_override ← activeOverride(
    type = 'operational', scope = [screen_id, tv_group.id, area.id], at = at
  )
  IF op_override EXISTS:
    base_playlist ← resolveCampaignContent(op_override.campaign_id)
    trace.append("L1:OP_OVERRIDE:" + op_override.id + ":" + op_override.scope_type)
    skip_sponsorship ← TRUE
    GOTO LEVEL_5

  ── LEVEL 2: SCHEDULED OVERRIDE ────────────────────────────────────────
  sched_override ← activeOverride(
    type IN ('scheduled', 'group'), scope = [screen_id, tv_group.id, area.id], at = at
  )
  IF sched_override EXISTS:
    IF sched_override.override_type = 'suppression':
      suppression_context ← sched_override
      GOTO LEVEL_3
    ELSE:
      base_playlist ← resolveCampaignContent(sched_override.campaign_id)
      trace.append("L2:SCHED_OVERRIDE:" + sched_override.id)
      skip_sponsorship ← (sched_override.override_type = 'replacement')
      GOTO LEVEL_5

  ── LEVEL 3: CAMPAIGN LAYER ────────────────────────────────────────────
  LABEL LEVEL_3:
  active_schedules ← schedules WHERE (
    (screen_id = screen.id)
    OR (area_id = area.id     AND screen_id IS NULL)
    OR (venue_id = venue.id   AND screen_id IS NULL AND area_id IS NULL)
    OR (org_id = org.id       AND venue_id IS NULL)
    OR (all targeting fields NULL)
  )
  AND scheduleActive(schedule, local_time)
  AND is_fallback = FALSE
  AND (suppression_context IS NULL
       OR schedule.campaign_id NOT IN suppression_context.suppressed_campaign_ids)

  base_playlist ← weightedPlaylistResolver(active_schedules)
  IF base_playlist IS EMPTY:
    base_playlist ← fallbackScheduleResolver(screen, area, venue, at)
    trace.append("L3:FALLBACK")
  ELSE:
    trace.append("L3:CAMPAIGN:" + base_playlist.campaign_ids)

  ── LEVEL 4: SPONSORSHIP INJECTION ─────────────────────────────────────
  IF skip_sponsorship != TRUE:
    active_contracts ← sponsorship_contracts WHERE
      area_id = area.id AND status = 'active'
      AND starts_at <= at AND ends_at >= at
      AND (days_of_week IS NULL OR dayOfWeek(local_time) IN days_of_week)

    FOR EACH exclusive_contract WHERE exclusivity = 'exclusive':
      competitors ← active_contracts WHERE
        category = exclusive_contract.category
        AND campaign_id != exclusive_contract.campaign_id
        AND exclusivity = 'non-exclusive'
      REMOVE competitors FROM active_contracts

    total_sponsor_share ← SUM(contract.share_of_voice FOR contract IN active_contracts)
    IF total_sponsor_share > MAX_SPONSOR_CAPACITY:
      emit saturation_warning(area.id, total_sponsor_share)
      active_contracts ← normalizeToCapacity(active_contracts, MAX_SPONSOR_CAPACITY)

    base_playlist ← injectSponsors(base_playlist, active_contracts)
    trace.append("L4:SPONSORS:" + active_contracts.map(c => c.campaign_id))

  ── LEVEL 5: STRUCTURAL RESOLUTION ─────────────────────────────────────
  LABEL LEVEL_5:
  final_playlist ← base_playlist
  content_mix    ← computeContentMix(final_playlist)
  trace.append("L5:STRUCTURAL:area=" + area.id + " group=" + tv_group.id)

  ── LEVEL 6: DEVICE TRUTH ANNOTATION ───────────────────────────────────
  last_delivery ← screen_delivery_log
    WHERE screen_id = screen.id ORDER BY delivered_at DESC LIMIT 1

  expected_checksum ← computeChecksum(final_playlist)
  observed_checksum ← last_delivery.manifest_checksum ?? null

  IF screen.status = 'offline':
    confidence ← 0.0
    trace.append("L6:OFFLINE:last_seen=" + screen.last_seen_at)
  ELSE IF observed_checksum != expected_checksum:
    staleness ← at - last_delivery.delivered_at
    confidence ← staleness < STALE_THRESHOLD ? 0.7 : 0.3
    trace.append("L6:DIVERGENCE:staleness=" + staleness + "s")
  ELSE:
    confidence ← 1.0
    trace.append("L6:CONFIRMED")

  ── OUTPUT ──────────────────────────────────────────────────────────────
  RETURN {
    screen_id, timestamp: at, active_playlist: final_playlist,
    content_mix, reason_trace: trace, confidence_score: confidence,
    valid_until: computeValidUntil(active_schedules, op_override, sched_override)
  }
END FUNCTION
```

---

### 2.4 Device Management Service

**Responsibility:** Authoritative owner of device identity, state, and assignment within the hierarchy.

**Owns (authoritative state):**
- `screens`, `tv_groups`, `areas`, `venues`, `organizations`

**Functions:**
- Screen registration with quarantine for unknown screens (no auto-assign to venue-1)
- Status state machine management: unprovisioned → assigned → active → degraded → offline
- Heartbeat processing
- Hierarchy CRUD: organizations, venues, areas, tv_groups
- Screen identification signal (identify flag on next manifest response)
- Emits: `screen.provisioned`, `screen.status_changed`, `screen.heartbeat`

**Status state machine:**
```
        CONNECT
           │
    ┌──────▼──────┐
    │ UNPROVISIONED│ ← serves platform fallback only
    └──────┬──────┘
           │ assign(venue + area + tv_group)
    ┌──────▼──────┐
    │   ASSIGNED  │ ← serves venue baseline
    └──────┬──────┘
           │ first manifest acknowledged
    ┌──────▼──────┐
    │   ACTIVE    │◄────────────────────┐
    └──────┬──────┘                     │
           │ missed polls > 5 min       │ recovers
    ┌──────▼──────┐                     │
    │  DEGRADED   │─────────────────────┘
    └──────┬──────┘
           │ missed polls > 30 min
    ┌──────▼──────┐
    │   OFFLINE   │
    └─────────────┘
```

Status transitions (degraded/offline) run on a background job every 60 seconds, not inline on heartbeat.

**Auto-quarantine for unknown screens:**
```
resolveScreen(screen_id):
  screen ← SELECT FROM screens WHERE id = screen_id
  IF screen IS NULL:
    INSERT INTO screens (id, status='unprovisioned', created_at=NOW())
    EMIT screen.discovered { screen_id }
    RETURN { status: 'unprovisioned' }   // PRE returns system fallback
  RETURN screen
```

---

### 2.5 Sponsorship / Constraint Engine

**Responsibility:** Authoritative owner of sponsorship contracts and share-of-voice constraints.

**Owns (authoritative state):**
- `sponsorship_contracts`

**Functions:**
- Contract CRUD with pre-creation conflict detection
- Availability queries: what is available in Area X for Category Y during Window Z
- Active contract resolution: what contracts are active for Area X at time T
- Saturation monitoring per area per daypart
- Emits: `sponsorship.booked`, `sponsorship.cancelled`, `sponsorship.saturation_warning`

**Availability contract:**
```
getAvailability(area_id, category, window):
  existing_exclusive ← SELECT FROM sponsorship_contracts
    WHERE area_id = area_id AND category = category
      AND exclusivity = 'exclusive' AND windowsOverlap(window) AND status = 'active'

  IF existing_exclusive EXISTS:
    RETURN { exclusive_available: false, held_by: ..., held_until: ... }

  current_share ← SUM(share_of_voice) FROM sponsorship_contracts
    WHERE area_id = area_id AND windowsOverlap(window) AND status = 'active'

  RETURN {
    exclusive_available: true,
    non_exclusive_available: true,
    current_total_share: current_share,
    remaining_share: MAX_CAPACITY - current_share
  }
```

**Concurrency control for double-booking:**
```sql
SELECT pg_advisory_xact_lock(hashtext(area_id || category || window_hash));
-- conflict check runs here
-- INSERT proceeds only if no conflict
-- lock released automatically on transaction end
```

---

### 2.6 Override Service

**Responsibility:** Authoritative owner of all non-emergency runtime content substitutions.

**Owns (authoritative state):**
- `overrides`

**Functions:**
- Operational override creation (immediate, synchronous cache bust)
- Scheduled override creation (future-dated, queued cache bust)
- Override expiration (background job, every 30 seconds)
- Override clearance (explicit operator action)
- Stale override flagging (persistent overrides without end_time older than threshold)
- Emits: `override.created`, `override.expired`, `override.cleared`

**Override creation:**
```
createOverride(params):
  IF params.type = 'operational':
    INSERT INTO overrides (type='operational', status='active', start_time=NOW(), ...)
    EMIT override.created
    CacheInvalidator.bustScope(params.scope_type, params.scope_id)  // synchronous
    RETURN override

  ELSE IF params.type = 'scheduled':
    conflicts ← ConflictDetector.checkOverride(params)
    IF conflicts.blocking: THROW
    INSERT INTO overrides (type='scheduled', status='active', start_time=params.start_time, ...)
    EMIT override.created
    CacheInvalidator.queueAt(params.start_time, params.scope_type, params.scope_id)
    RETURN override
```

**Expiration job** (runs every 30 seconds):
```
expireOverrides():
  expired ← UPDATE overrides
    SET status = 'expired', cleared_at = NOW()
    WHERE status = 'active' AND end_time IS NOT NULL AND end_time <= NOW()
    RETURNING scope_type, scope_id

  FOR EACH expired_override:
    EMIT override.expired
    CacheInvalidator.bustScope(scope_type, scope_id)
```

---

### 2.7 Emergency Service

**Responsibility:** Authoritative owner of venue-level emergency state. Highest-priority service in the resolution hierarchy. Must be operationally simple and maximally reliable.

**Owns (authoritative state):**
- `emergency_states`

**Functions:**
- Emergency activation (immediate, synchronous, venue-wide)
- Emergency clearance (immediate, synchronous)
- Platform default emergency content management
- Emits: `emergency.activated`, `emergency.cleared`

**Activation — synchronous, no queuing:**
```
activate(venue_id, content_id?, activated_by):
  BEGIN TRANSACTION
    INSERT INTO emergency_states
      (venue_id, content_id, activated_at, activated_by, status='active')
    ON CONFLICT (venue_id, status='active') DO NOTHING
    RETURNING id
    IF no row returned: THROW AlreadyActiveError
  COMMIT

  // Synchronous cache bust — ALL screens in venue, before HTTP response
  affected_screens ← SELECT id FROM screens WHERE venue_id = venue_id
  DELETE FROM manifest_cache WHERE screen_id = ANY(affected_screens)
  inProcessCache.clear()

  EMIT emergency.activated { venue_id, screen_count: N }
  RETURN { activated: true, screens_count: N }
```

**Clearance:**
```
clear(venue_id, cleared_by):
  UPDATE emergency_states
    SET status='cleared', cleared_at=NOW(), cleared_by=cleared_by
    WHERE venue_id = venue_id AND status = 'active'

  DELETE FROM manifest_cache WHERE screen_id IN
    (SELECT id FROM screens WHERE venue_id = venue_id)
  inProcessCache.clear()

  EMIT emergency.cleared { venue_id }
  // PRE recomputes time-current state on next poll — no snapshot restoration needed
```

**Important:** Emergency Service does NOT capture pre-emergency state. When emergency clears, PRE recomputes the correct current state at the time of clearance. This is by design — restoring a frozen snapshot is incorrect if scheduled content has changed during the emergency window.

---

### 2.8 Manifest Delivery System

**Responsibility:** Serves manifests to screens. Manages the manifest cache. The only service that calls the PRE directly.

**Owns (derived state only):**
- `manifest_cache` — not authoritative. Always derivable from PRE. Can be safely deleted; rebuilds on next poll.

**Functions:**
- Serve `GET /manifest?screen_id=` requests
- Cache-hit path (5-second TTL)
- Cache-miss path: call PRE, store result, serve
- Screen heartbeat update on every poll (fire-and-forget to Device Management)
- Record delivery in `screen_delivery_log` (async)
- Inject identify signal if Device Management has flagged the screen
- Emit: `manifest.delivered`

**Request handling:**
```
GET /manifest?screen_id=X:
  1. Heartbeat (fire-and-forget): DeviceManagement.recordPoll(screen_id)

  2. Check in-process LRU cache (60s TTL, heap):
     IF hit: RETURN immediately (< 1ms, no DB)

  3. Check manifest_cache (PostgreSQL, 5s TTL):
     cached ← SELECT WHERE screen_id = X AND computed_at > NOW() - INTERVAL '5s'
     IF hit: store in in-process cache, RETURN

  4. Cache miss — call PRE:
     result ← PRE.resolve(screen_id, NOW())

  5. Transactional version management (SELECT FOR UPDATE):
     BEGIN
       existing ← SELECT checksum, version FROM manifest_cache WHERE screen_id = X
       new_version ← existing.checksum = result.checksum
                   ? existing.version
                   : existing.version + 1
       UPSERT manifest_cache (screen_id, manifest, checksum, version=new_version,
                               computed_at=NOW(), valid_until=result.valid_until)
     COMMIT

  6. Async (fire-and-forget):
     INSERT screen_delivery_log (screen_id, manifest_checksum, campaign_ids,
                                  content_ids, area_id, delivered_at=NOW())

  7. Store in in-process cache

  8. RETURN manifest with version, checksum, valid_until
```

---

### 2.9 Proof-of-Play Service

**Responsibility:** Derives proof-of-play reports from delivery log data. Read-only.

**Owns:** Nothing. Reads `screen_delivery_log`.

**Acknowledgment signal:**

Players do not explicitly acknowledge receipt. Acknowledgment is inferred: when a screen polls and its last-known checksum matches the current manifest, the previous delivery is marked confirmed.

```sql
UPDATE screen_delivery_log
  SET acknowledged_at = NOW()
  WHERE screen_id = $1
    AND manifest_checksum = $2  -- incoming checksum from player
    AND acknowledged_at IS NULL
  ORDER BY delivered_at DESC
  LIMIT 1
```

This produces a three-signal model:
- **scheduled** — content was in a campaign covering this area/time
- **delivered** — manifest containing this content was served to the screen
- **confirmed** — screen polled again with matching checksum (used it)

**Report output:**
```json
{
  "campaign_id": "...",
  "period": { "from": "...", "to": "..." },
  "summary": {
    "scheduled_impressions": 1440,
    "confirmed_deliveries": 1398,
    "screens_affected": 12,
    "areas_affected": 3
  },
  "exceptions": [
    { "screen_id": "...", "area_id": "...", "period": "...",
      "reason": "offline | override_displaced | suppressed" }
  ],
  "by_area": [...]
}
```

---

### 2.10 Audit / Event Log

**Responsibility:** Immutable, append-only record of all system events.

**Owns (authoritative, never deleted):**
- `audit_log`

All services write to this table within the same database transaction as their state change. Writing to the audit log is not optional and not conditional on success.

**Schema:**
```sql
CREATE TABLE audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  event_type   VARCHAR(100) NOT NULL,
  actor_id     VARCHAR(255),
  actor_role   VARCHAR(50),
  entity_type  VARCHAR(100),
  entity_id    VARCHAR(255),
  venue_id     VARCHAR(100),
  payload      JSONB        NOT NULL DEFAULT '{}',
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity   ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_venue    ON audit_log(venue_id, occurred_at);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at);
```

---

## 3. Source-of-Truth Ownership

| State | Authoritative Owner | Derived By |
|---|---|---|
| Campaigns, campaign schedules | Scheduling Service | — |
| Materialized schedules | Scheduling Service (written at publish) | — |
| Areas, TV Groups, Venues, Orgs | Device Management | — |
| Screens, screen status | Device Management | — |
| Overrides | Override Service | — |
| Emergency state | Emergency Service | — |
| Sponsorship contracts | Sponsorship Engine | — |
| Audit log | All services (append, same transaction) | — |
| **manifest_cache** | **Derived** | Manifest Delivery System (from PRE) |
| **PRE output** | **Derived** | PRE function (from all authoritative state) |
| **Screen divergence** | **Derived** | Device Truth Layer (delivery log vs. expected) |
| **Proof-of-play report** | **Derived** | Proof-of-Play Service (from delivery log) |
| **Operational state view** | **Derived** | Aggregated (screens + overrides + campaigns) |
| **Conflict check result** | **Derived** | Conflict Detector (schedules + contracts) |

**Rule:** No derived state is authoritative. If `manifest_cache` is deleted entirely, the system recovers automatically within one poll cycle. If `screen_delivery_log` is lost, proof-of-play history is lost — but current playback is unaffected.

---

## 4. Data Flow

### 4.1 Screen Polling (Hot Path)

```
[Pi Appliance / Browser Player]
  │  GET /manifest?screen_id=bar-01  (every 15s, jittered)
  ▼
[Manifest Delivery System]
  ├─ fire-and-forget: DeviceManagement.recordHeartbeat(screen_id)
  ├─ L1 cache hit (in-process LRU, 60s TTL)?
  │    └─ YES: return < 1ms
  ├─ L2 cache hit (manifest_cache, 5s TTL)?
  │    └─ YES: return < 5ms
  └─ cache miss:
       ├─ PRE.resolve(screen_id, NOW())                    [p99: < 20ms]
       ├─ transactional cache upsert (SELECT FOR UPDATE)
       ├─ async: INSERT screen_delivery_log
       └─ return manifest                                   [p99: < 30ms]
```

### 4.2 Campaign Publish

```
Operator → POST /api/v2/campaigns/:id/publish
  → Scheduling Service
    ├─ ConflictDetector.check() → 422 if blocking
    ├─ TRANSACTION: delete old rows, insert new rows, update status
    ├─ EMIT campaign.published
    └─ CacheInvalidator (async): DELETE manifest_cache for affected screens
         └─ Screens pick up new content within ≤ 20s (15s poll + 5s TTL)
```

### 4.3 Operational Override (Immediate)

```
Operator → POST /api/v2/overrides { type: 'operational', scope_type: 'area', ... }
  → Override Service
    ├─ INSERT overrides
    ├─ INSERT audit_log (same transaction)
    ├─ SYNCHRONOUS: DELETE manifest_cache for all screens in area
    └─ RETURN 200 { override_id, affected_screens: N }
         └─ All screens in area: next poll ≤ 15s → PRE Level 1 fires
```

### 4.4 Emergency Activation

```
Operator → POST /api/v2/emergency/activate { venue_id: 'bar-downtown' }
  → Emergency Service
    ├─ TRANSACTION: INSERT emergency_states (UNIQUE constraint prevents double-activate)
    ├─ SYNCHRONOUS: DELETE manifest_cache WHERE screen.venue_id = venue_id
    ├─ SYNCHRONOUS: inProcessCache.clear()
    ├─ INSERT audit_log
    └─ RETURN 200 { activated: true, screens_count: 47 }
         // Response sent only after cache is cleared
         // Operator knows: next polls will get emergency content
         └─ All screens: next poll ≤ 15s → PRE Level 0 fires → emergency content
```

### 4.5 Sponsorship Suppression at Resolution Time

```
[Friday 6:00:01pm — Screen polls in Sports Bar]

PRE Level 3: CampaignResolver
  → base_playlist = [HappyHour, GeneralBrand]

PRE Level 4: SponsorshipEngine
  → active_contracts = [ExclusiveBeer (exclusive), NonExclusiveWine (non-exclusive)]
  → ExclusiveBeer.category = 'Beverage' → exclusive
  → NonExclusiveWine.category = 'Beverage' → SUPPRESSED (competing category)
  → ExclusiveBeer injected at declared share_of_voice
  → final_playlist = [HappyHour(58%), GeneralBrand(12%), ExclusiveBeer(30%)]

reason_trace: [
  "L3:CAMPAIGN:[happyhour-id, generalbrand-id]",
  "L4:SPONSORS:[exclusivebeer-id]",
  "L4:SUPPRESSED:[nonexclusivewine-id]:category=Beverage"
]
```

### 4.6 Stale Playback Detection

```
Screen bar-01: last_seen_at = 47 min ago, status = 'degraded'
Campaign changed 20 min ago

PRE.resolve('bar-01', NOW()):
  Level 3 → produces new playlist (post-campaign-change)
  Level 6 → DeviceTruthLayer:
    expected_checksum = hash(new_playlist)
    last_delivery.manifest_checksum = pre-change checksum
    divergence = 47 minutes
    confidence_score = 0.0
    trace: "L6:DIVERGENCE:47m:screen=degraded"

Operational state view for area:
  → "1 screen offline: last manifest from [time], may be showing stale content"

Screen recovers and polls:
  → heartbeat → status transitions to 'active'
  → manifest_cache stale → PRE recomputes
  → new checksum → version increment
  → player detects change → updates content
  → next poll: acknowledged_at set in delivery_log
  → DeviceTruthLayer: confidence_score = 1.0
```

---

## 5. Real-Time vs Eventual Consistency

| Operation | Requirement | Justification |
|---|---|---|
| Emergency activation | **Synchronous** | Operator confirmation must mean cache is cleared |
| Emergency clearance | **Synchronous** | Same |
| Operational override | **Synchronous** | Shift manager needs confirmation it's live |
| Campaign rollback | **Synchronous** | Operator expects immediate correction |
| Sponsorship double-booking prevention | **Synchronous** | Advisory lock required |
| Scheduled override activation | **Eventual** (≤ 20s) | Future-dated; async queue acceptable |
| Campaign publish | **Eventual** (≤ 20s) | 20s propagation acceptable |
| Screen heartbeat / status | **Eventual** (60s batch) | Status transitions tolerate batch latency |
| Delivery log write | **Eventual** (async) | Proof-of-play is retrospective |
| Audit log write | **Synchronous** (same transaction) | Audit integrity requires no silent omissions |

---

## 6. Event Model

### 6.1 Event Transport

**Implementation: PostgreSQL LISTEN/NOTIFY + in-process EventEmitter**

Events are written to an `event_bus` table within the same transaction that produces the state change. This guarantees: no lost events, no phantom events from rolled-back transactions.

```sql
CREATE TABLE event_bus (
  id           BIGSERIAL    PRIMARY KEY,
  event_type   VARCHAR(100) NOT NULL,
  payload      JSONB        NOT NULL,
  published_at TIMESTAMPTZ  DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

A background worker drains the table every 2 seconds and dispatches to in-process subscribers.

### 6.2 Event Catalog

```
PUBLISHER              EVENT                        SUBSCRIBERS
────────────────────── ──────────────────────────── ────────────────────────────────
SchedulingService      campaign.published           CacheInvalidator, AuditLog
SchedulingService      campaign.rolled_back         CacheInvalidator, AuditLog
SchedulingService      campaign.archived            AuditLog
OverrideService        override.created             CacheInvalidator, AuditLog
OverrideService        override.cleared             CacheInvalidator, AuditLog
OverrideService        override.expired             CacheInvalidator, AuditLog
EmergencyService       emergency.activated          AuditLog  (cache bust is sync)
EmergencyService       emergency.cleared            AuditLog  (cache bust is sync)
DeviceManagement       screen.discovered            AuditLog, OperatorNotification
DeviceManagement       screen.status_changed        AuditLog, OperatorNotification
DeviceManagement       screen.provisioned           AuditLog
SponsorshipEngine      sponsorship.booked           AuditLog
SponsorshipEngine      sponsorship.cancelled        CacheInvalidator, AuditLog
ManifestDelivery       manifest.delivered           ProofOfPlay (delivery log write)
```

### 6.3 Cache Invalidation via Events

```
CacheInvalidator.handleEvent(event):
  SWITCH event.type:
    CASE 'campaign.published':
    CASE 'campaign.rolled_back':
      DELETE FROM manifest_cache WHERE screen_id = ANY(event.affected_screen_ids)

    CASE 'override.created':
    CASE 'override.cleared':
    CASE 'override.expired':
      screens ← resolveScreensForScope(event.scope_type, event.scope_id)
      DELETE FROM manifest_cache WHERE screen_id = ANY(screens)

    CASE 'sponsorship.cancelled':
      screens ← resolveScreensForArea(event.area_id)
      DELETE FROM manifest_cache WHERE screen_id = ANY(screens)
```

Emergency cache busts are **not** event-driven — they are synchronous and in-band within the Emergency Service.

---

## 7. Failure Behavior

### 7.1 PRE Unavailable (database unreachable)

```
PRE.resolve() throws DatabaseError

ManifestDelivery:
  1. Check in-process LRU cache (up to 60s TTL)
     IF hit: RETURN stale manifest + header X-Manifest-Stale: true

  2. Check manifest_cache (PostgreSQL — also unavailable)
     SKIP if database is unreachable

  3. Return compiled-in system fallback (no DB, no computation):
     { items: [{ type: 'promo_slide', data: { headline: 'ClubHub' }, duration: 15 }] }
     LOG: manifest.fallback_served { screen_id }
```

The system fallback is a static JSON object compiled into the application binary. It cannot fail.

### 7.2 Device Cannot Poll (network partition at screen)

**Player behavior** (existing, unchanged):
- Last received manifest plays from localStorage cache
- Offline banner shown after first failed poll
- Content loops indefinitely
- On reconnection: polls normally, gets fresh manifest, banner clears

**Pi Appliance behavior** (existing, unchanged):
- Disk cache plays on boot regardless of connectivity
- Watchdog reboots after 3 consecutive failures
- After reboot: disk cache serves again
- Stale warning logged after 2 minutes

**PRE / Operational state:**
- Screen continues playing last manifest (no backend intervention)
- Status transitions to degraded → offline via background job
- Operational state view surfaces degraded/offline count per area

### 7.3 Database Unreachable Beyond In-Process Cache TTL (60s)

All screens continue playing cached content from localStorage / Pi disk. They stop updating until the database recovers. When it recovers, the next poll recomputes a fresh manifest.

**Gap:** manifest_cache is in the same database that's unreachable. The in-process LRU (60s TTL) bridges this window. Beyond 60 seconds, screens fall back to device-side caches — no server involvement required.

### 7.4 Emergency Activation Failure

If Emergency Service cannot write to the database, activation fails with an explicit error to the operator. The system **does not silently fail** emergency activation. The operator receives: "Emergency activation failed — database unreachable. Manual intervention required."

A silent failure of emergency activation is more dangerous than a visible error.

### 7.5 Race Conditions

**Double emergency activation:** UNIQUE partial index on `(venue_id, status) WHERE status = 'active'` prevents two active emergencies for the same venue. Second activation returns "already active."

**Concurrent sponsorship double-booking:** `pg_advisory_xact_lock` on `(area_id, category, window_hash)` serializes concurrent bookings. Second request blocks until first commits, then sees the conflict on its own check.

**Concurrent manifest version increment:** Existing `SELECT FOR UPDATE` on `manifest_cache` row prevents two concurrent computations both writing version N. Retained unchanged.

---

## 8. Caching Strategy

### 8.1 Cache Layers

```
Layer 1: PRE resolution
  Produced per cache-miss request. Not independently cached.

Layer 2: In-process LRU (Node.js heap)
  Key:    screen_id
  TTL:    60 seconds
  Size:   up to 1000 entries
  Evict:  TTL expiry only (no explicit invalidation except emergency)
  Purpose: database partition resilience

Layer 3: manifest_cache (PostgreSQL)
  Key:    screen_id
  TTL:    5 seconds
  Evict:  explicit DELETE on override/campaign/emergency changes
  Purpose: thundering-herd prevention, transactional version management

Layer 4: Player localStorage (browser)
  Key:    clubhub_manifest_cache_<screen_id>
  TTL:    none (persists until replaced by checksum change)
  Purpose: offline playback

Layer 5: Pi disk cache (/tmp/clubhub-manifest-cache.json)
  TTL:    none (persists across reboots)
  Purpose: offline boot
```

### 8.2 Invalidation Rules

| Event | Layer 2 | Layer 3 | Layer 4 | Layer 5 |
|---|---|---|---|---|
| Campaign published | TTL expiry | Explicit DELETE (async) | Checksum-driven | Checksum-driven |
| Override created/cleared | TTL expiry | Explicit DELETE (sync) | Checksum-driven | Checksum-driven |
| Emergency activated/cleared | **Full clear** (sync) | **Full DELETE** (sync) | Checksum-driven | Checksum-driven |
| Screen offline/recovered | TTL expiry | TTL expiry | No change | No change |

Layers 4 and 5 are never explicitly invalidated by the backend. They update only when the screen detects a checksum difference. The backend's responsibility is ensuring the new manifest has a new checksum — the player handles its own cache coherence.

---

## 9. Persistence Model

### 9.1 Primary Store: PostgreSQL (single instance)

All authoritative state lives in PostgreSQL. No additional infrastructure.

**Justification:**
- Strong consistency for conflict detection (exclusivity, emergency uniqueness)
- Transactional audit log (same transaction as state change)
- JSONB for manifest storage
- Advisory locks for concurrency-sensitive operations
- Existing operational familiarity

### 9.2 State-to-Storage Mapping

| State | Table | Notes |
|---|---|---|
| Campaigns | `campaigns`, `campaign_content_items`, `campaign_schedules` | Normalized relational |
| Materialized schedules | `schedules` | Written at publish, read by PRE |
| Hierarchy | `organizations`, `venues`, `areas`, `tv_groups`, `screens` | Relational |
| Overrides | `overrides` | Time-range queries |
| Emergency | `emergency_states` | UNIQUE partial index for single-active constraint |
| Sponsorship | `sponsorship_contracts` | Overlap queries |
| Manifest cache | `manifest_cache` | Derived, safe to delete |
| Delivery log | `screen_delivery_log` | Append-only, partition by month in production |
| Audit log | `audit_log` | Append-only, never deleted |
| Event bus | `event_bus` | Short-lived, processed_at set after dispatch |
| In-process LRU | Node.js heap | Ephemeral, lost on restart |
| Player cache | Browser localStorage | Backend never reads or writes |
| Pi cache | Pi filesystem | Backend never reads or writes |

### 9.3 Connection Pool

```javascript
const pool = new Pool({
  max: 20,                     // increased from 10 (PRE adds parallel queries)
  min: 5,                      // keep warm connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  statement_timeout: 5_000     // PRE fails fast; MDS falls back to cache
});
```

At 100 screens polling every 15s (~7 req/s), PRE uses 3 parallel queries max per request = 21 connections peak. Pool of 20 + 5-second statement timeout is appropriate.

### 9.4 When to Add a Second Store

The following conditions justify introducing Redis or a time-series extension — not before:

| Condition | Addition |
|---|---|
| > 5,000 screens (manifest cache write contention on PostgreSQL) | Redis for manifest_cache |
| > 1M delivery log rows/day (proof-of-play query performance) | TimescaleDB partition or ClickHouse |
| Emergency activation latency > 500ms (DB write contention) | Redis for emergency state hot-path |

None of these conditions apply at current scale.

---

## 10. Deployment Architecture

### 10.1 Pattern: Modular Monolith

**Rejected:** Microservices.
**Reason:** Network hops on the manifest hot path increase p99 latency by 50–200ms per service boundary. At 1–3 engineers, the operational overhead of 8+ independent services is not justified.

**Adopted:** Single deployable process with strict internal module boundaries.
**Extraction path:** When a specific module requires independent scaling (PRE becoming CPU-bound beyond ~5,000 screens), extract that module. The interfaces defined in this document are the extraction seams. No API changes required.

### 10.2 Internal Module Structure

```
backend/src/
├── lib/
│   ├── pre/
│   │   ├── index.js              ← PRE entry point: resolvePRE()
│   │   ├── emergencyResolver.js
│   │   ├── overrideResolver.js
│   │   ├── campaignResolver.js   ← refactored from manifestEngine.js
│   │   ├── sponsorshipEngine.js
│   │   ├── structuralResolver.js
│   │   ├── deviceTruthLayer.js
│   │   └── playlistUtils.js
│   ├── conflictDetector.js
│   ├── cacheInvalidator.js
│   ├── inProcessCache.js         ← LRU, 1000 entries, 60s TTL
│   ├── eventBus.js               ← PostgreSQL LISTEN/NOTIFY + EventEmitter
│   └── manifestEngine.js         ← backward compat shim wrapping pre/index.js
├── services/
│   ├── schedulingService.js
│   ├── overrideService.js
│   ├── emergencyService.js
│   ├── deviceManagement.js
│   ├── sponsorshipEngine.js
│   ├── proofOfPlayService.js
│   └── operationalStateView.js
├── routes/
│   ├── manifest.js               ← unchanged player-facing endpoint
│   ├── v2/
│   │   ├── campaigns.js
│   │   ├── overrides.js
│   │   ├── emergency.js
│   │   ├── areas.js
│   │   ├── tvGroups.js
│   │   ├── organizations.js
│   │   ├── sponsorships.js
│   │   ├── operationalState.js
│   │   └── proofOfPlay.js
│   └── [existing routes unchanged]
└── workers/
    ├── overrideExpiration.js     ← setInterval 30s
    ├── screenStatusTransition.js ← setInterval 60s
    ├── eventBusProcessor.js      ← setInterval 2s
    └── cacheInvalidationWorker.js ← setInterval 2s
```

### 10.3 Production Topology

```
              Internet
                  │
        ┌─────────▼─────────┐
        │       Caddy        │  TLS termination, HTTP/3, HTTPS
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  Backend Node.js   │  Single process, port 4000
        │                    │
        │  /manifest         │  → Manifest Delivery System
        │  /api/v2/*         │  → Operator API Gateway → Services
        │  /health/*         │  → Health probes
        │                    │
        │  Background workers│  (co-located in same process)
        └─────────┬─────────┘
                  │ internal network only
        ┌─────────▼─────────┐
        │   PostgreSQL 15    │
        └───────────────────┘
```

### 10.4 Docker Compose (Production)

No new containers. Backend image is replaced with the new modular version.

```yaml
services:
  postgres:
    # unchanged

  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
      PORT: 4000
      UPLOAD_DIR: /app/uploads
      LOG_LEVEL: ${LOG_LEVEL}
      SECRET_KEY: ${SECRET_KEY}
      INPROCESS_CACHE_MAX: 1000
      INPROCESS_CACHE_TTL_MS: 60000
      MAX_SPONSOR_CAPACITY: 0.60
      SATURATION_WARNING_AT: 0.40
      STALE_SCREEN_DEGRADED_MIN: 5
      STALE_SCREEN_OFFLINE_MIN: 30
      OVERRIDE_STALE_FLAG_HOURS: 24
    # health, logging, volumes: unchanged

  caddy:
    # unchanged
```

### 10.5 Scale Headroom

| Metric | Current | Modular Monolith Ceiling | Next Step |
|---|---|---|---|
| Screens | ~20 | ~5,000 | Extract PRE as read-replica compute tier |
| Venues | ~1 | ~50 | — |
| Manifest req/s | ~7 | ~300 | — |
| DB connections | 10 | 20 (increased) | Read replica for PRE queries |

---

## 11. API Contract

### Hierarchy

```
GET    /api/v2/organizations
POST   /api/v2/organizations

GET    /api/v2/venues/:venueId/areas
POST   /api/v2/venues/:venueId/areas
PATCH  /api/v2/areas/:areaId
DELETE /api/v2/areas/:areaId

GET    /api/v2/areas/:areaId/tv-groups
POST   /api/v2/areas/:areaId/tv-groups
PATCH  /api/v2/tv-groups/:groupId

PATCH  /api/v2/screens/:screenId/assign
  body: { tv_group_id, area_id, venue_id, name }

PATCH  /api/v2/screens/:screenId/identify
  → sets identify flag; next manifest response includes identify=true
```

### Campaigns

```
POST   /api/v2/campaigns
POST   /api/v2/campaigns/:id/content
POST   /api/v2/campaigns/:id/schedule
GET    /api/v2/campaigns/:id/preview        → what-will-change before publish
GET    /api/v2/campaigns/:id/conflicts      → blocking[], warnings[]
POST   /api/v2/campaigns/:id/publish        → body: { staged_area_ids? }
POST   /api/v2/campaigns/:id/rollback
PATCH  /api/v2/campaigns/:id/archive
```

### Overrides

```
POST   /api/v2/overrides                    → operational (immediate) or scheduled
DELETE /api/v2/overrides/:id               → clear override
GET    /api/v2/areas/:areaId/overrides?status=active
GET    /api/v2/venues/:venueId/overrides?status=active
```

### Emergency

```
POST   /api/v2/emergency/activate           → body: { venue_id, content_id? }
POST   /api/v2/emergency/clear              → body: { venue_id }
GET    /api/v2/emergency/status/:venueId
```

### Sponsorship

```
POST   /api/v2/sponsorships
GET    /api/v2/areas/:areaId/sponsorships?from=&to=   → availability view
DELETE /api/v2/sponsorships/:id
```

### Operational State

```
GET    /api/v2/venues/:venueId/operational-state       → shift handover view
GET    /api/v2/areas/:areaId/effective-state
GET    /api/v2/screens/:screenId/divergence
```

### Proof of Play

```
GET    /api/v2/campaigns/:id/proof-of-play?from=&to=
```

---

## 12. MVP Scope

### V1 Must Exist

```
✓ Hierarchy: Organization, Venue, Area, TV Group, Screen (tables + CRUD)
✓ Screen quarantine on discovery (no auto-assign to venue-1)
✓ PRE: Levels 0, 1, 2, 3, 5, 6 (emergency, overrides, campaigns, structural, device truth)
✓ Manifest Delivery System (existing, PRE-backed)
✓ Emergency Service (single-action activate/clear, synchronous cache bust)
✓ Override Service (operational overrides, expiration)
✓ Campaign with immediate-publish (no draft lifecycle in V1)
✓ Audit log (all state changes, same transaction)
✓ Device Management (status state machine, heartbeat, provisioning, quarantine)
✓ Operational state view (shift handover)
✓ In-process LRU cache (database partition resilience)
```

### Deliberately Deferred from V1

| Feature | Deferred Until |
|---|---|
| Draft/publish lifecycle | Operators request staged review |
| Sponsorship / Constraint Engine | Before first sponsor contract is signed |
| PRE Level 4 (sponsorship injection) | With sponsorship engine |
| Conflict Detector | When scheduling conflicts occur in practice |
| Proof-of-Play Service | With sponsorship engine |
| `screen_delivery_log` | With sponsorship engine |
| Staged publishing | After draft/publish lifecycle |
| Campaign rollback | After draft/publish lifecycle |
| Saturation warnings | With sponsorship engine |
| Multi-organization enforcement | When second organization onboards |
| Exclusion targeting ("all areas except") | When operators request it |
| Override stale flagging | After V1 operations reveal the pattern |
| Area type/tag bulk targeting | With multi-org |
| Proof-of-play acknowledgment signal | With sponsorship engine |

### V1 Acceptance Criteria

V1 is complete when:

1. A screen can be discovered, quarantined, provisioned to an Area + TV Group, and begin receiving Area-level campaign content — without any other screen being affected
2. An emergency can be activated and cleared in under 10 seconds of operator action, confirmed by screen count in the response
3. A shift manager can see the complete operational state of all Areas at their venue in a single API call
4. An operational override can be issued against an Area and take effect within one poll cycle (≤ 15 seconds)
5. A campaign can be created with content + schedule windows, published immediately, and reach all targeted screens within 20 seconds
6. A screen that goes offline continues playing cached content indefinitely without backend intervention
7. All state-changing operations are recorded in the audit log within the same database transaction

---

## Appendix A: Module Dependency Map

```
Operator API Gateway
  → SchedulingService         (campaigns, publish, rollback)
  → OverrideService           (create, clear overrides)
  → EmergencyService          (activate, clear, status)
  → SponsorshipEngine         (book, availability, cancel)
  → DeviceManagement          (provision, assign, hierarchy CRUD)
  → OperationalStateView      (derives: screens + overrides + campaigns)
  → ProofOfPlayService        (derives: delivery_log)

ManifestDeliverySystem
  → PRE.resolve()
  → manifest_cache (PostgreSQL, Layer 3)
  → inProcessCache (heap, Layer 2)
  → DeviceManagement.recordHeartbeat()   [fire-and-forget]
  → screen_delivery_log                  [async INSERT]

PRE.resolve()
  → emergencyResolver     → emergency_states
  → overrideResolver      → overrides
  → campaignResolver      → schedules, campaign_content_items
  → sponsorshipEngine     → sponsorship_contracts
  → structuralResolver    → (in-memory; no DB call)
  → deviceTruthLayer      → screen_delivery_log

AuditLog
  ← all services (same-transaction writes)

CacheInvalidator
  ← events from: SchedulingService, OverrideService, SponsorshipEngine
  ← direct sync call from: EmergencyService, OverrideService (operational)
  → DELETE manifest_cache
  → inProcessCache.clear() [emergency only]
```

## Appendix B: Database Migration Sequence

```
migrate_001.sql  ← existing: content, playlists, templates, venues, screens
migrate_002.sql  ← existing: performance indexes
migrate_003.sql  ← NEW: organizations, areas, tv_groups; alter venues + screens
migrate_004.sql  ← NEW: campaigns, campaign_content_items, campaign_schedules;
                         alter schedules (add campaign_id, area_id)
migrate_005.sql  ← NEW: overrides, emergency_states
migrate_006.sql  ← NEW: sponsorship_contracts, screen_delivery_log, audit_log, event_bus
```

Each migration is independently deployable. The system functions correctly at any migration stage — earlier migrations produce a subset of capability, not a broken state.
