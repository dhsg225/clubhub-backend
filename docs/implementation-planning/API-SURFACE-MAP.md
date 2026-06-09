# API Surface Map

**Document type:** Engineering implementation planning
**Status:** Actionable — implementation-ready endpoint specifications
**Authority:** ENGINEERING-CONSTITUTION-v1.md §12 (role model), EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md

---

## Role Hierarchy

Roles are hierarchical. A role can do everything its parents can do plus what is listed for it explicitly.

```
PLATFORM_ADMIN
  └── ENTERPRISE_ADMIN
        └── REGIONAL_MANAGER
              └── VENUE_OPERATOR
                    └── AUDITOR (read-only audit access, no operational control)
SPONSOR_STAKEHOLDER (isolated — no access to operational routes)
Player API Key (device credential — machine-only)
Service-to-Service Token (internal — not user-facing)
```

---

## Constitutional State Behavior (applies to all services)

**READ_ONLY mode:** All mutation endpoints return `423 Locked` with body:
```json
{ "error": "READ_ONLY_MODE", "message": "System in constitutional READ_ONLY mode. Mutation disabled. Emergency endpoint remains active.", "constitutional_state": "READ_ONLY" }
```
Exception: `POST /emergency/trigger` remains writable in READ_ONLY mode.

**EMERGENCY_FREEZE:** All endpoints return `503 Service Unavailable` except:
- `GET /constitutional/state`
- `GET /constitutional/freeze-log`
- `GET /emergency/status`

---

## CMS API (operator-facing)

Base URL: `https://api.clubhub.tv/cms/v1`
Auth: Bearer JWT with role claims. All endpoints require TLS.

---

### Organizations

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/organizations` | PLATFORM_ADMIN | Platform | No | 10/min |
| `GET` | `/organizations` | ENTERPRISE_ADMIN+ | Platform | Yes | 60/min |
| `GET` | `/organizations/:org_id` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 120/min |
| `PATCH` | `/organizations/:org_id` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 10/min |

**POST /organizations** request: `{ name, billing_tier, contact_email }` response: `{ org_id, name, created_at }`

Constitutional: No constraints — pure data management.

---

### Venues

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/venues` | ENTERPRISE_ADMIN+ | Enterprise | No | 10/min |
| `GET` | `/venues` | VENUE_OPERATOR+ | Enterprise | Yes | 120/min |
| `GET` | `/venues/:venue_id` | VENUE_OPERATOR+ | Venue | Yes | 300/min |
| `PATCH` | `/venues/:venue_id` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 10/min |
| `DELETE` | `/venues/:venue_id` | PLATFORM_ADMIN | Platform | Yes | 5/min |

**POST /venues** request: `{ org_id, name, timezone, address }` — `timezone` must be a valid IANA identifier (validated server-side before storing; FP-10 equivalent for API layer)
**PATCH /venues/:venue_id** — timezone change triggers corpus rebuild request; operator is warned that players will reload corpus.

Constitutional: Venue timezone is the authoritative timezone for all PRE resolution at that venue. Changing it is a corpus-rebuild event.

---

### Screens

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/screens/commission` | VENUE_OPERATOR+ | Venue | No | 5/min |
| `POST` | `/screens/:screen_id/decommission` | ENTERPRISE_ADMIN+ | Venue | Yes | 5/min |
| `GET` | `/screens` | VENUE_OPERATOR+ | Venue | Yes | 120/min |
| `GET` | `/screens/:screen_id` | VENUE_OPERATOR+ | Venue | Yes | 300/min |
| `PATCH` | `/screens/:screen_id` | VENUE_OPERATOR+ | Venue | Yes | 10/min |
| `GET` | `/screens/:screen_id/status` | VENUE_OPERATOR+ | Venue | Yes | 300/min |

**POST /screens/commission** request: `{ venue_id, tv_group_id?, area_id?, name, hardware_id }` response: `{ screen_id, player_api_key }` — `player_api_key` is returned exactly once at commission time; cannot be retrieved again.

**POST /screens/:screen_id/decommission** — marks screen inactive, revokes player_api_key, queues removal from corpus on next rebuild.

Constitutional: Screen commissioning generates the device credential. Decommissioning revokes it. Audit records for a decommissioned screen are retained permanently.

---

### Campaigns

Campaign lifecycle state machine: `DRAFT → REVIEW → APPROVED → ACTIVE → ARCHIVED`
Allowed transitions: DRAFT→REVIEW, REVIEW→APPROVED, REVIEW→DRAFT (reject), APPROVED→ACTIVE, ACTIVE→ARCHIVED, any→DRAFT (only if no active schedules reference it)

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/campaigns` | VENUE_OPERATOR+ | Enterprise | No | 20/min |
| `GET` | `/campaigns` | VENUE_OPERATOR+ | Enterprise | Yes | 120/min |
| `GET` | `/campaigns/:campaign_id` | VENUE_OPERATOR+ | Enterprise | Yes | 300/min |
| `PATCH` | `/campaigns/:campaign_id` | VENUE_OPERATOR+ | Enterprise | Yes | 20/min |
| `POST` | `/campaigns/:campaign_id/transition` | REGIONAL_MANAGER+ | Enterprise | No | 10/min |
| `GET` | `/campaigns/:campaign_id/preview` | VENUE_OPERATOR+ | Enterprise | Yes | 30/min |

**POST /campaigns/:campaign_id/transition** request: `{ to_status, approved_by?, notes? }` — server validates against state machine; returns 422 with `INVALID_TRANSITION` if the requested transition is not allowed.

**GET /campaigns/:campaign_id/preview** — calls preview API internally and returns PRE output for all screens in the campaign's target venues at the current time. This is a read-only preview that helps operators verify before approval.

Constitutional: APPROVED→ACTIVE transition triggers a corpus rebuild request to corpus-publisher. The operator cannot make a campaign active without going through REVIEW.

---

### Schedules

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/schedules` | VENUE_OPERATOR+ | Venue | No | 20/min |
| `GET` | `/schedules` | VENUE_OPERATOR+ | Venue | Yes | 120/min |
| `GET` | `/schedules/:schedule_id` | VENUE_OPERATOR+ | Venue | Yes | 300/min |
| `PATCH` | `/schedules/:schedule_id` | VENUE_OPERATOR+ | Venue | Yes | 20/min |
| `DELETE` | `/schedules/:schedule_id` | REGIONAL_MANAGER+ | Venue | Yes | 10/min |

**PATCH /schedules/:schedule_id** — modifying `starts_at`, `expires_at`, `days_of_week`, or `target_id` triggers a corpus rebuild request.

Constitutional: Schedule `specificity` and `priority` fields must be set explicitly — no server-side defaults that could obscure operator intent. Entropy metric M-03 monitors for stale schedules.

---

### Overrides

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/overrides` | VENUE_OPERATOR+ | Venue | No | 10/min |
| `GET` | `/overrides` | VENUE_OPERATOR+ | Venue | Yes | 120/min |
| `GET` | `/overrides/:override_id` | VENUE_OPERATOR+ | Venue | Yes | 300/min |
| `PATCH` | `/overrides/:override_id/extend` | VENUE_OPERATOR+ | Venue | No | 10/min |
| `DELETE` | `/overrides/:override_id` | VENUE_OPERATOR+ | Venue | Yes | 10/min |

**POST /overrides** request: `{ content_id, target_type, target_id, starts_at, expires_at?, is_operational, priority, reason }` — `is_operational: true` maps to LEVEL_1 (highest priority after emergency); `is_operational: false` maps to LEVEL_2.

Constitutional: Overrides with `expires_at: null` (permanent) must be explicitly declared as such — no implicit permanent overrides. Entropy metric M-01 monitors for stale overrides.

---

### Emergency Management

Emergency endpoints are the only write endpoints that remain active in READ_ONLY constitutional mode.

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/emergency/trigger` | VENUE_OPERATOR+ | Venue | No | 5/min |
| `DELETE` | `/emergency/:emergency_id` | VENUE_OPERATOR+ | Venue | Yes | 10/min |
| `GET` | `/emergency/status` | VENUE_OPERATOR+ | Venue | Yes | 300/min |
| `GET` | `/emergency/active` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 60/min |

**POST /emergency/trigger** request: `{ venue_id, content_id, is_global, reason }` — two-step confirmation required at UI layer (API accepts on first call, returns a `confirm_token`; second call with `confirm_token` commits). Server-side confirmation prevents accidental API calls from triggering emergencies.

`is_global: true` requires ENTERPRISE_ADMIN role and triggers emergency for all venues in the organization.

**DELETE /emergency/:emergency_id** — clears the emergency. Players receive the cleared state on next emergency poll cycle.

Constitutional: Emergency content maps to LEVEL_0 in PRE resolution — highest possible priority. PRE emergency level resolver always checks for active emergency first. A cleared emergency results in LEVEL_0 SKIP in the reason trace, which is the correct behavior.

---

### Templates and Content

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/content` | VENUE_OPERATOR+ | Enterprise | No | 20/min |
| `GET` | `/content/:content_id` | VENUE_OPERATOR+ | Enterprise | Yes | 300/min |
| `POST` | `/templates` | ENTERPRISE_ADMIN+ | Enterprise | No | 10/min |
| `GET` | `/templates` | VENUE_OPERATOR+ | Enterprise | Yes | 120/min |

---

### Deployment Groups

| Method | Path | Auth | Scope | Idempotent | Rate limit |
|---|---|---|---|---|---|
| `POST` | `/deployment-groups` | ENTERPRISE_ADMIN+ | Enterprise | No | 10/min |
| `GET` | `/deployment-groups` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 60/min |
| `PATCH` | `/deployment-groups/:group_id/membership` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 10/min |
| `GET` | `/deployment-groups/:group_id/corpus-status` | ENTERPRISE_ADMIN+ | Enterprise | Yes | 60/min |

---

## Corpus Sync API (player-facing)

Base URL: `https://corpus.clubhub.tv/v1`
Auth: Player API key (device credential issued at commissioning). All requests require TLS + client certificate validation for GRADE_A venues.

These endpoints are on the highest-availability path. They are served via CDN for GET requests.

---

| Method | Path | Auth | Idempotent | Rate limit |
|---|---|---|---|---|
| `GET` | `/corpus/version` | Player API key | Yes | 720/hr per device (every 5 min) |
| `GET` | `/corpus/:version_id` | Player API key | Yes | 12/hr per device |
| `POST` | `/audit/batch` | Player API key | No (idempotent by audit_record_id) | 12/hr per device |
| `POST` | `/entropy/report` | Player API key | No | 2/hr per device |
| `GET` | `/emergency/poll` | Player API key | Yes (long-poll) | 1 concurrent per device |

**GET /corpus/version** response: `{ version_id, checksum, published_at, canary_stage }` — lightweight; served from CDN cache with 60-second TTL.

**GET /corpus/:version_id** response: signed corpus package (binary). Player must verify signature using the platform public key (baked into player-runtime at build time). Reject if signature invalid.

**POST /audit/batch** request:
```json
{
  "device_id": "screen-abc",
  "batch_id": "uuid-v4",
  "records": [
    {
      "audit_record_id": "uuid-v4",
      "screen_id": "string",
      "at": 1748000000000,
      "correlation_id": "string",
      "pre_output_hash": "string",
      "playlist_checksum": "string",
      "resolution_level": 3,
      "is_fallback": false,
      "divergence_class": null,
      "entropy_score_snapshot": 0.12,
      "shadow_parity_snapshot": null,
      "invariants_passed": true,
      "audit_written_at": 1748000005000,
      "record_checksum": "string"
    }
  ],
  "rollback_trigger": null
}
```

`rollback_trigger` is non-null when the player-runtime detected a CLASS_3/CLASS_4 divergence during the batch period. replay-audit-api routes this to canary-service.

**GET /emergency/poll** — long-poll with 30-second timeout. Response when no emergency: `{ emergency: null }`. Response when emergency active: `{ emergency: { emergency_id, content_id, activated_at, reason } }`. Player must reconnect immediately on response.

Constitutional: Emergency poll must be the highest-priority outbound connection from player-runtime. It must not be starved by corpus sync or audit flush operations.

---

## Replay Audit API (read-only, auditor-facing)

Base URL: `https://api.clubhub.tv/audit/v1`
Auth: Bearer JWT with AUDITOR role minimum. All responses are read-only.

| Method | Path | Auth | Scope | Rate limit |
|---|---|---|---|---|
| `GET` | `/replay/invocations` | AUDITOR+ | Venue | 60/min |
| `GET` | `/replay/:invocation_id` | AUDITOR+ | Venue | 300/min |
| `GET` | `/replay/integrity/:venue_id` | AUDITOR+ | Venue | 10/min |
| `POST` | `/replay/proof-of-play` | VENUE_OPERATOR+ | Venue | 5/min |

**GET /replay/invocations** query params: `screen_id`, `from_ms`, `to_ms`, `correlation_id`, `resolution_level`, `is_fallback`, `has_divergence`. Pagination: cursor-based. Max 1000 records per page.

Response per record: full `ReplayAuditRecord` shape (audit_record_id, screen_id, at, correlation_id, pre_output_hash, playlist_checksum, resolution_level, is_fallback, divergence_class, entropy_score_snapshot, shadow_parity_snapshot, invariants_passed, audit_written_at, record_checksum).

**GET /replay/integrity/:venue_id** — verifies that all audit records in a time range have valid checksums and no unexpected gaps. Response: `{ total_records, checksum_valid_count, gap_count, gaps: [{from_ms, to_ms, screen_id}], integrity_status: "PASS" | "FAIL" | "GAPS_PRESENT" }`.

**POST /replay/proof-of-play** request: `{ sponsor_id, from_ms, to_ms, content_ids[] }` — generates a sponsor-scoped aggregate report. Response is a downloadable artifact (PDF or JSON). This is the primary proof-of-play delivery mechanism to sponsors.

Constitutional: Proof-of-play reports are scoped by sponsor's contracted content_ids only. A sponsor can receive proof only for their own content, not for the overall resolution mix.

---

## Preview API (operator-facing, read-only)

Base URL: `https://api.clubhub.tv/preview/v1`
Auth: VENUE_OPERATOR+
Note: Preview API calls PRE.resolve() server-side using the current corpus. This is the only cloud service that legitimately calls pre-engine. It does not mutate any state.

| Method | Path | Auth | Scope | Rate limit |
|---|---|---|---|---|
| `POST` | `/preview/point-in-time` | VENUE_OPERATOR+ | Venue | 30/min |
| `POST` | `/preview/schedule-walk` | VENUE_OPERATOR+ | Venue | 10/min |
| `POST` | `/preview/what-if` | VENUE_OPERATOR+ | Venue | 10/min |
| `GET` | `/preview/current/:screen_id` | VENUE_OPERATOR+ | Venue | 60/min |

**POST /preview/point-in-time** request: `{ screen_id, at_ms }` — resolves PRE for a specific screen at a specific future (or past) timestamp using the current corpus. Returns full `PRE_Output` plus the reason_trace. Used by operators to verify what will play before approving a campaign.

**POST /preview/schedule-walk** request: `{ screen_id, from_ms, to_ms, interval_ms }` — walks the time range at the specified interval and returns PRE outputs at each step. Used for verifying schedule coverage.

**POST /preview/what-if** request: `{ screen_id, at_ms, hypothetical_overrides: OverrideRecord[] }` — runs PRE with additional hypothetical overrides injected into the system state. The real state is not modified. Used for planning.

Constitutional: Preview API is read-only. It never writes to audit records, never triggers canary advancement, and never modifies corpus. The pre-engine import in this service is the only legitimate non-player-runtime import of pre-engine.

---

## Shadow / Canary API (ENTERPRISE_ADMIN+)

Base URL: `https://api.clubhub.tv/canary/v1`

| Method | Path | Auth | Scope | Rate limit |
|---|---|---|---|---|
| `GET` | `/canary/status/:enterprise_id` | ENTERPRISE_ADMIN+ | Enterprise | 60/min |
| `POST` | `/canary/advance` | ENTERPRISE_ADMIN+ | Enterprise | 5/min |
| `GET` | `/canary/history/:enterprise_id` | ENTERPRISE_ADMIN+ | Enterprise | 30/min |
| `POST` | `/canary/rollback` | ENTERPRISE_ADMIN+ | Enterprise | 5/min |
| `GET` | `/canary/promotion-readiness/:enterprise_id` | ENTERPRISE_ADMIN+ | Enterprise | 30/min |
| `GET` | `/parity/report/:enterprise_id` | ENTERPRISE_ADMIN+ | Enterprise | 30/min |
| `POST` | `/shadow/enable/:venue_id` | ENTERPRISE_ADMIN+ | Enterprise | 5/min |
| `GET` | `/shadow/status/:venue_id` | ENTERPRISE_ADMIN+ | Enterprise | 60/min |

**POST /canary/advance** request:
```json
{
  "enterprise_id": "string",
  "human_approval_token": "string (min 8 chars)",
  "approved_by_user_id": "string",
  "notes": "string"
}
```
Server validates: (1) token is non-empty and ≥8 chars, (2) promotion readiness report passes all blocking criteria, (3) no active rollback trigger pending review. Rejects with `PROMOTION_BLOCKED` if any criterion fails.

Response: `{ from_stage, to_stage, promotion_id, corpus_redistribution_queued: true }`

Constitutional: This endpoint enforces the `requires_human_approval: true` invariant. The human_approval_token is hashed (SHA-256) before storage. The raw token is never persisted.

**GET /canary/status/:enterprise_id** response:
```json
{
  "current_stage": "SINGLE_VENUE",
  "next_stage": "MULTI_VENUE",
  "is_ready_to_advance": false,
  "blocking_reasons": ["parity_score_24h below threshold (0.9987 < 0.999)"],
  "parity_score_24h": 0.9987,
  "parity_score_7d": 0.9994,
  "total_invocations_24h": 14420,
  "zero_class3_class4_violations": true
}
```

---

## Emergency Channel (separate high-availability path)

The emergency channel has dedicated routing — it must not share rate limiting or circuit breakers with standard API traffic.

| Method | Path | Auth | Scope | Notes |
|---|---|---|---|---|
| `POST` | `/emergency/trigger` | VENUE_OPERATOR+ | Venue | Two-step with confirm_token |
| `DELETE` | `/emergency/:emergency_id` | VENUE_OPERATOR+ | Venue | Clear emergency |
| `GET` | `/emergency/status` | VENUE_OPERATOR+ | Venue | Current status |
| `GET` | `/emergency/active` | ENTERPRISE_ADMIN+ | Enterprise | All active emergencies |
| `WS` | `/emergency/subscribe/:enterprise_id` | ENTERPRISE_ADMIN+ | Enterprise | Real-time push |

**POST /emergency/trigger** (two-step):
1. First call: `{ venue_id, content_id, is_global, reason }` → response: `{ confirm_token, expires_in_seconds: 30 }`
2. Second call: `{ confirm_token }` → response: `{ emergency_id, activated_at }` — only this call activates the emergency

Constitutional: Emergency content maps to PRE LEVEL_0. Once active, the emergency_state is included in the next corpus sync cycle to players. Players also receive it via emergency poll. The two sources provide redundancy.

---

## Constitutional API (PLATFORM_ADMIN only)

Base URL: `https://api.clubhub.tv/constitutional/v1`
Auth: PLATFORM_ADMIN + second-factor token
These endpoints control the constitutional state of the entire platform. They are the most sensitive endpoints in the system.

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| `GET` | `/constitutional/state` | PLATFORM_ADMIN | 60/min | Always available |
| `GET` | `/constitutional/freeze-log` | PLATFORM_ADMIN | 30/min | Always available |
| `POST` | `/constitutional/freeze` | PLATFORM_ADMIN | 3/min | Triggers EMERGENCY_FREEZE |
| `POST` | `/constitutional/reset` | PLATFORM_ADMIN | 3/min | Requires human_auth_token ≥8 chars |

**GET /constitutional/state** response:
```json
{
  "mode": "NORMAL",
  "trip_reason": null,
  "tripped_at": null,
  "pre_allowed": true,
  "shadow_allowed": true,
  "audit_write_allowed": true,
  "fleet_summary": {
    "total_devices": 247,
    "devices_in_normal": 247,
    "devices_in_read_only": 0,
    "devices_in_emergency_freeze": 0
  }
}
```

**POST /constitutional/freeze** request: `{ reason, scope: "fleet" | "enterprise", enterprise_id? }` — triggers EMERGENCY_FREEZE. This propagates to players on next emergency poll cycle. Players in EMERGENCY_FREEZE serve no PRE output — only emergency content if configured.

**POST /constitutional/reset** request: `{ human_auth_token, reset_reason, authorized_by }` — token must be ≥8 chars (matches GlobalConstitutionalBreaker.reset() requirement). Clears READ_ONLY or EMERGENCY_FREEZE. This action is permanently logged in freeze-log.

Constitutional: EMERGENCY_FREEZE has no automatic exit. The reset endpoint is the only path out. The freeze-log entries are permanent (never deleted, never modified). A platform reset without a human_auth_token of ≥8 chars must be rejected at the API layer with a 403.

**READ_ONLY mode exceptions — endpoints that remain writable:**

The following endpoints accept writes in READ_ONLY mode:
- `POST /emergency/trigger`
- `DELETE /emergency/:emergency_id`
- `POST /constitutional/freeze` (escalation always allowed)
- `POST /constitutional/reset` (recovery always allowed)

All other write endpoints return 423.
