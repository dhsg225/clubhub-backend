# OBSERVABILITY

**Version:** 1.0.0
**Status:** ENFORCED
**Authority:** Defines the operational event taxonomy, correlation model, and
forensic requirements for ClubHub TV. All new platform components MUST emit
events conforming to this taxonomy. Built on existing `backend/src/lib/logger.js`
and `backend/src/middleware/requestId.js` infrastructure.

---

## 0. PURPOSE

Observability is not dashboards. It is the ability to answer questions about what
happened, when, on which screen, in response to which backend call, under what
fleet conditions — from persisted evidence alone. This document defines what events
must be emitted, how they are correlated, and what minimum retention is required
to answer incident post-mortems.

---

## 1. EXISTING OBSERVABILITY INFRASTRUCTURE

Before defining new requirements, the existing infrastructure that this document
builds on:

| Component | Capability | File |
|-----------|-----------|------|
| `logger.js` | Structured JSON stdout logger; LOG_LEVEL env var; all logs include ts, level, event | `backend/src/lib/logger.js` |
| `requestId.js` | UUID per backend request; `req.requestId` + `X-Request-Id` response header | `backend/src/middleware/requestId.js` |
| `health.js` | `/health/live`, `/health/ready` endpoints with memory stats | `backend/src/routes/health.js` |
| Soak metrics | Per-screen poll success, latency, checksum, offline streak | `simulator/soak.js` |
| Chaos timeline | `metrics.mark()`, `metrics.ingest()`, recovery timestamps | `test-runner/lib/metrics.js` |
| Fleet dashboard | ANSI terminal view of per-screen status | `simulator/fleet-dashboard.js` |

**Gaps in current infrastructure:**
- X-Request-Id is not forwarded to Pi (screens cannot correlate their poll event to a backend log entry)
- Events have no namespace or category — all mixed in Docker log stream
- No event retention guarantee — Docker log rotation is the only mechanism
- No anomaly detection — threshold breaches logged but not structured as alerts
- No correlation across screen → backend → DB for a single poll cycle

---

## 2. OPERATIONAL EVENT TAXONOMY

All events are emitted as structured JSON via `logger.js`. Each event has a
**namespace** that identifies its origin domain.

### 2.1 Namespace Definitions

| Namespace | Domain | Emitted By |
|-----------|--------|-----------|
| `PLATFORM` | System lifecycle, startup, shutdown, config changes | Backend |
| `SCREEN` | Per-screen poll, registration, recovery, OTA | Pi appliance / Simulator |
| `FLEET` | Fleet-wide aggregates, health transitions | Backend / Soak orchestrator |
| `CHAOS` | Fault injection events (CI and soak only) | Chaos controller / Soak.js |
| `OTA` | Rollout state transitions, ring promotions, rollbacks | OTA controller |
| `SECURITY` | Auth attempts, token events, enrollment, anomalies | Security middleware |
| `STORAGE` | DB operations, cache events, backup/restore | Backend |

### 2.2 Required Event Fields

Every event MUST include:

```json
{
  "ts":           "ISO-8601 timestamp",
  "level":        "INFO | WARN | ERROR | DEBUG",
  "ns":           "NAMESPACE",
  "event":        "namespace.event_name",
  "request_id":   "UUID or null if no request context",
  "screen_id":    "screen ID or null if not screen-scoped",
  "venue_id":     "venue ID or null if not venue-scoped",
  "version":      "backend version or Pi firmware version",
  "env":          "production | staging | simulation | ci"
}
```

Additional fields are permitted. Missing required fields MUST be logged as
`WARN level PLATFORM.malformed_event`.

### 2.3 Event Catalogue

#### PLATFORM Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `PLATFORM.startup` | INFO | Backend process starts | `port`, `node_version`, `db_connected` |
| `PLATFORM.shutdown` | INFO | Backend process exits | `exit_code`, `uptime_s` |
| `PLATFORM.health_degraded` | WARN | `/health/ready` begins returning 503 | `check_name`, `detail` |
| `PLATFORM.health_restored` | INFO | `/health/ready` returns 200 after degraded | `duration_ms` |
| `PLATFORM.rate_limit_hit` | WARN | IP exceeds a rate limit tier | `tier`, `ip_hash`, `limit`, `window_ms` |
| `PLATFORM.request_timeout` | WARN | Per-request timeout fires (10,000ms) | `path`, `method` |

#### SCREEN Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `SCREEN.poll_success` | INFO | Screen fetches manifest successfully | `checksum`, `version`, `latency_ms`, `cache_hit` |
| `SCREEN.poll_failure` | WARN | Screen poll fails (timeout, 5xx, network) | `reason`, `consecutive_failures`, `offline_streak` |
| `SCREEN.registered` | INFO | Screen registers with backend | `screen_id`, `firmware_version` |
| `SCREEN.watchdog_reboot` | WARN | Watchdog triggers reboot after 3 consecutive failures | `consecutive_failures`, `last_success_age_ms` |
| `SCREEN.manifest_stale` | WARN | Cached manifest age > 120,000ms | `cache_age_ms`, `last_checksum` |
| `SCREEN.checksum_change` | INFO | Screen receives manifest with new checksum | `old_checksum`, `new_checksum`, `version` |
| `SCREEN.ota_start` | INFO | Screen begins OTA update download | `target_version`, `ring` |
| `SCREEN.ota_complete` | INFO | Screen completes OTA update | `target_version`, `duration_ms` |
| `SCREEN.ota_failed` | ERROR | OTA update fails | `target_version`, `failure_type`, `ring` |
| `SCREEN.ota_rollback` | WARN | Screen reverts to previous version | `from_version`, `to_version`, `reason` |

#### FLEET Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `FLEET.health_transition` | WARN/INFO | Fleet health state changes (HEALTHY/DEGRADED/UNHEALTHY) | `from_state`, `to_state`, `trigger`, `unhealthy_count` |
| `FLEET.desync_detected` | ERROR | desync_count > 0 | `screen_count`, `checksum_count`, `divergent_screens` |
| `FLEET.desync_resolved` | INFO | desync_count returns to 0 | `duration_ms` |
| `FLEET.poll_rate_degraded` | WARN | Fleet-wide success rate < 98% | `success_rate`, `threshold` |

#### OTA Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `OTA.rollout_started` | INFO | Update enters STAGING state | `update_id`, `target_version`, `ring_sizes` |
| `OTA.ring_promoted` | INFO | Rollout advances to next ring | `from_ring`, `to_ring`, `adoption_pct`, `health_score` |
| `OTA.ring_frozen` | WARN | Rollout halted by freeze condition | `ring`, `freeze_reason`, `freeze_id` |
| `OTA.rollback_triggered` | ERROR | Automatic rollback initiated | `from_ring`, `trigger_id`, `affected_screens` |
| `OTA.rollback_complete` | WARN | Rollback confirmed fleet-wide | `duration_ms`, `adoption_pct` |
| `OTA.update_complete` | INFO | Rollout reaches COMPLETE state | `update_id`, `total_duration_ms`, `final_adoption_pct` |

#### SECURITY Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `SECURITY.enrollment_attempt` | INFO | Screen attempts enrollment | `screen_id`, `ip_hash` |
| `SECURITY.enrollment_rejected` | WARN | Enrollment token invalid or expired | `reason`, `ip_hash` |
| `SECURITY.token_issued` | INFO | Auth token issued to screen | `screen_id`, `expires_at` |
| `SECURITY.token_revoked` | WARN | Token explicitly revoked | `screen_id`, `reason` |
| `SECURITY.unauthorized_poll` | WARN | Poll request with missing/invalid auth | `screen_id`, `ip_hash` |
| `SECURITY.node_quarantined` | WARN | Screen quarantined due to anomalous behaviour | `screen_id`, `reason` |

#### STORAGE Events

| Event | Level | When | Required Extra Fields |
|-------|-------|------|----------------------|
| `STORAGE.cache_miss` | DEBUG | Manifest computed from Tier 1 (no cache hit) | `screen_id`, `compute_ms` |
| `STORAGE.cache_hit` | DEBUG | Manifest served from Tier 2 cache | `screen_id`, `cache_age_ms` |
| `STORAGE.cache_invalidated` | INFO | manifest_cache cleared | `reason`, `screens_affected` |
| `STORAGE.backup_complete` | INFO | pg_dump completes successfully | `file`, `size_bytes` |
| `STORAGE.backup_failed` | ERROR | pg_dump fails | `exit_code`, `stderr` |
| `STORAGE.restore_started` | WARN | DB restore initiated | `file`, `operator` |
| `STORAGE.restore_complete` | INFO | DB restore completes | `duration_ms` |

---

## 3. CORRELATION ID PROPAGATION

### 3.1 Current State

`requestId.js` generates a UUID per backend request and attaches it to:
- `req.requestId` (backend in-flight)
- `X-Request-Id` response header (visible to Pi)

The Pi does NOT currently include `X-Request-Id` in its poll log events.
This prevents correlating a `SCREEN.poll_success` event with its corresponding
backend log lines.

### 3.2 Required Propagation Chain

```
Pi poll request
  → backend receives X-Request-Id or generates one
  → backend logs all events for this request with request_id = X-Request-Id
  → backend returns X-Request-Id in response header
  → Pi logs SCREEN.poll_success with request_id = response X-Request-Id header value

Query: "Show me all events for poll cycle where screen sim-01 received checksum abc123"
Answer: filter logs by screen_id=sim-01 AND request_id=<from Pi event>
```

### 3.3 Implementation Requirement

Pi appliance (`simulator/pi-appliance.js` and `simulator/fake-pi.js`) MUST:
1. Read `X-Request-Id` from manifest response headers
2. Include it as `request_id` in the poll log event

Backend MUST:
1. Include `request_id` in all log events emitted during manifest computation
2. Return `X-Request-Id` header on all responses (already done by `requestId.js`)

This is implemented in `backend/src/lib/events.js` event emitter.

---

## 4. INCIDENT REPLAY RULES

An incident replay is the ability to reconstruct what happened on a specific screen
during a specific time window using only retained log data.

### 4.1 Minimum Retention Requirements

| Log Type | Minimum Retention | Rationale |
|----------|------------------|-----------|
| Backend request logs | 72 hours | Cover 3× the maximum incident detection window |
| SCREEN poll events | 72 hours | Correlate with backend logs for same window |
| FLEET health transition events | 30 days | Post-incident trend analysis |
| OTA rollout events | 90 days | Full rollout audit trail |
| SECURITY events | 90 days | Compliance and anomaly investigation |
| STORAGE backup/restore events | 365 days | Compliance |

### 4.2 Replay Completeness Requirements

A replay is complete if it can answer:
- What was the checksum on screen X at time T? (from SCREEN.poll_success events)
- What backend request served screen X at time T? (from request_id correlation)
- Was the backend healthy at time T? (from PLATFORM.health_* events)
- Was there a desync event affecting screen X at time T? (from FLEET.desync_*)
- What was the content manifest at the time of the incident? (from Tier 1 DB)

A replay is INCOMPLETE (forensic gap) if any of the above cannot be answered
from retained data. Incomplete replays MUST be noted in incident reports.

### 4.3 Log Rotation Requirements

The production compose (`docker-compose.production.yml`) configures log rotation.
The minimum rotation policy is:
- Max file size: 100MB
- Max files: 10 per container
- Minimum total retention: 72 hours of backend + screen log volume

At 100 screens: ~1.1GB/day (see CAPACITY_MODEL.md §5). 1GB total rotation capacity
is insufficient for 72h retention at 100+ screens.

**Scaling action required at 100+ screens:** Configure external log aggregation
(Loki, CloudWatch, or similar) before 100-screen deployment. Log rotation alone
is not a forensic-capable retention mechanism.

---

## 5. ANOMALY DETECTION MODEL

Anomaly detection is threshold-based (not statistical inference). All thresholds
are governed by `test-config/thresholds.json`.

### 5.1 Detection Rules

| Anomaly | Detection Condition | Level | Action |
|---------|--------------------|----|------|
| Poll rate degraded | Fleet success rate < `performance.min_poll_success_rate` (98%) | WARN | Emit `FLEET.poll_rate_degraded` |
| Latency spike | p95 latency > `performance.max_p95_latency_ms` (500ms) | WARN | Emit `PLATFORM.latency_spike` |
| Recovery exceeded | Any named_recovery > SLA threshold | ERROR | Emit `FLEET.health_transition` to UNHEALTHY |
| Desync detected | desync_count > `coherence.max_desync_count` (0) | ERROR | Emit `FLEET.desync_detected` |
| Stale manifest | Screen cache age > 120,000ms | WARN | Emit `SCREEN.manifest_stale` |
| OTA fleet degraded | OTA success rate < `ota.min_fleet_success_rate` (80%) | ERROR | Trigger OTA rollback |
| Rate limit cascade | > 3 screens rate-limited in same minute | WARN | Potential misconfiguration |

### 5.2 What This Model Does Not Detect

- Gradual degradation (metrics trending toward threshold but not yet breaching)
- Correlated failures across screens at different venues
- Silent content incorrectness (wrong schedule displayed but checksum matches)
- Hardware degradation before failure

These require Tier 1 (real Pi) observation and are beyond the scope of automated
detection in this phase.

---

## 6. FLEET HEALTH INTERPRETATION GUIDE

| Observed Pattern | Likely Cause | First Check |
|-----------------|-------------|-------------|
| All screens UNHEALTHY simultaneously | Backend or DB down | `make health-full` → `/health/ready` |
| One screen UNHEALTHY, rest healthy | Hardware failure, network issue, or SD card problem | `make watch-screen SCREEN=<id>` |
| Poll success rate degraded fleet-wide | Network congestion or rate limit | `PLATFORM.rate_limit_hit` events in logs |
| Desync persisting > 45s | Cache serving wrong checksum, or content race condition | `make clear-caches`, check DB integrity |
| P95 latency spike | DB slow, connection pool exhausted, or heavy manifest computation | `make db-cache` (cache hit rate) |
| OTA adoption stalling | Quarantined screens, network issues, or compat failures | Check `OTA.ota_failed` events |
| Memory growth in soak | Chromium leak (real Pi) or event log accumulation (simulator) | Soak stability score `memScore` trend |

---

## 7. FORENSIC RECONSTRUCTION REQUIREMENTS

A forensic reconstruction is required for any P1 incident (all screens dark or
Class F failure). The reconstruction must produce:

1. **Timeline**: Sequence of events with timestamps from first anomaly to resolution
2. **Scope**: Which screens were affected, for how long, at what venues
3. **Root cause tier**: Which state tier (1-4) was the origin of the failure
4. **Request correlation**: At least one example of request_id → backend log chain
5. **Recovery confirmation**: Evidence that fleet returned to HEALTHY state
6. **Gap inventory**: Any time windows where log data is absent (§4.2)

Forensic reconstructions are written to `docs/incidents/YYYY-MM-DD-<incident>.md`.
This directory does not exist yet; create it when the first incident occurs.

---

## 8. INTERACTION WITH OTHER MATURITY DOCUMENTS

| Document | Interaction |
|----------|-------------|
| CLUBHUB_STATE_AUTHORITY.md | All state-tier transitions emit STORAGE events |
| OTA_GOVERNANCE.md | All ring state transitions emit OTA events |
| SECURITY_MODEL.md | All auth events emit SECURITY events |
| REALITY_GAP_VALIDATION.md | Gap registry reads from soak SCREEN events |
| CAPACITY_MODEL.md | Log growth projections at scale depend on event emission rates |
