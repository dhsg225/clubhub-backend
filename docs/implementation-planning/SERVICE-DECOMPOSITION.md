# Service Decomposition

**Document type:** Engineering implementation planning
**Status:** Actionable — implementation-ready specifications
**Authority:** ENGINEERING-CONSTITUTION-v1.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md

---

## Overview

Seven backend services. One runs at edge (player-runtime on Pi). Six run in cloud. The constitutional boundary between edge and cloud is the central architectural fact: PRE.resolve() runs locally on-device, corpus is pushed to edge, audit records are buffered locally and pushed to cloud. No PRE invocation requires a cloud round-trip.

---

## Service 1: player-runtime (Edge — Raspberry Pi)

### Responsibilities

- Maintains a verified local copy of the current corpus version
- Invokes PRE.resolve() on-device for each playlist resolution cycle (typically every 30–60 seconds per screen)
- Wraps PRE with the runtime layer: correlation-id generation, circuit breaker checks, shadow execution during canary stages, invariant verification
- Maintains the GlobalConstitutionalBreaker state machine locally
- Buffers replay audit records in a local append-only ring buffer (in-memory + flush to local disk)
- Runs the entropy scheduler locally against the current corpus snapshot
- Pushes batched audit records to replay-audit-api on successful connectivity
- Pushes entropy reports to entropy-service on successful connectivity
- Polls corpus sync endpoint for new corpus versions; verifies signature before applying
- Long-polls or maintains WebSocket for emergency signals
- Serves the player-ui via local IPC/WebSocket with resolved playlist and emergency state

### Anti-scope (what player-runtime does NOT do)

- Does not call cms-api directly for any reason
- Does not accept operator configuration changes directly — all configuration arrives via corpus
- Does not expose a public API — it is not a server from the outside; it only makes outbound calls to specific cloud endpoints
- Does not run PRE.resolve() in response to cloud requests — PRE runs on the player's own schedule
- Does not delete or modify audit records already written to the local ring buffer
- Does not evaluate canary promotion eligibility — it only reads its assigned canary stage from corpus

### API Surface (outbound calls made by player-runtime)

| Endpoint | Direction | Purpose | Frequency |
|---|---|---|---|
| `GET /corpus/version` | Player → corpus-publisher | Check for new corpus version | Every 5 min |
| `GET /corpus/:version_id` | Player → corpus-publisher | Download new corpus | On version change |
| `POST /audit/batch` | Player → replay-audit-api | Flush buffered audit records | Every 5 min, or on buffer threshold |
| `POST /entropy/report` | Player → entropy-service | Push entropy metrics | Every 30 min |
| `GET /emergency/poll` | Player → cms-api | Long-poll for emergency signals | Continuous |

### Data owned by player-runtime

- **Local corpus store:** verified copy of the current corpus on device storage. Written only by the corpus sync process after signature verification. Never modified in-place — replaced atomically.
- **Local audit ring buffer:** append-only local file. Records are never updated. Flushed records are retained until confirmed receipt by replay-audit-api (acknowledgment mechanism required).
- **Local constitutional state:** the in-memory GlobalConstitutionalBreaker instance. Not persisted to disk — resets to NORMAL on restart. (This is correct behavior: a restart implies a human observed the device and restarted it, which satisfies the human-action requirement.)
- **Local entropy state:** in-memory entropy scores for the current screen set. Recomputed each cycle.
- **Local canary stage:** read from corpus. Read-only to player.

### Events emitted (async)

- Audit batch payload (HTTP POST to replay-audit-api)
- Entropy report payload (HTTP POST to entropy-service)
- Rollback trigger notification — if player-runtime detects a CLASS_3 or CLASS_4 divergence during shadow comparison, it includes the rollback trigger flag in the audit batch payload, which replay-audit-api routes to the canary-service

### Events consumed (async)

- Corpus version updates (polled — not pushed)
- Emergency signals (long-polled from cms-api)

### Failure behavior

- **Cloud unreachable:** Player operates fully autonomously. PRE.resolve() continues against local corpus. Audit records buffer locally. If the buffer fills beyond the ring buffer size, oldest unsynced records are dropped with a logged gap marker (FM-007 pattern). Emergency signals cannot be received until connectivity resumes — this is a known operational gap documented in DEPLOYMENT.md.
- **Corpus sync fails:** Player continues with current corpus version. If corpus is more than 72 hours old, entropy metric M-12 (staleness) enters CRITICAL range and triggers an advisory alert on next sync.
- **GlobalConstitutionalBreaker trips to READ_ONLY:** PRE invocations halt. Legacy resolver (LEVEL_5 fallback) serves playlists. Audit writes continue. Shadow halts.
- **GlobalConstitutionalBreaker trips to EMERGENCY_FREEZE:** PRE halts. Audit writes halt (per `isAuditWriteAllowed()`). Only emergency content served. No automatic exit.

### Scaling characteristics

- One player-runtime process per physical Pi device. Not horizontally scaled — it is a single-device process.
- Concurrency: player-runtime resolves multiple screens per device (e.g., a venue with 4 TVs = 4 screen IDs, resolved in sequence or parallel depending on implementation). PRE.resolve() is pure and stateless — parallel invocations are safe.

### Constitutional constraints enforced

- FP-20: no direct mutation of pre_output after PRE.resolve() returns
- FP-21: telemetry calls (emit, increment) happen in the runtime wrapper, never inside PRE
- GlobalConstitutionalBreaker.reset() requires humanAuthorizationToken ≥8 chars
- EMERGENCY_FREEZE has no automatic exit — even on process restart the breaker resets to NORMAL (human observability required for restart)
- Replay audit records are append-only — no update/delete operations on the ring buffer
- Corpus signature must be verified before any new corpus version is applied

---

## Service 2: cms-api (Cloud)

### Responsibilities

- Full CRUD for the operator data model: organizations, venues, screens, areas, tv_groups, campaigns, schedules, overrides, sponsorship contracts, content items, templates
- Campaign lifecycle state machine: DRAFT → REVIEW → APPROVED → ACTIVE → ARCHIVED
- Screen commissioning and decommissioning workflows
- Deployment group management (which screens receive which corpus version)
- Emergency trigger and acknowledgment (operator-initiated)
- Corpus version reference management — CMS records which corpus version is currently deployed to each deployment group, but does not own the corpus artifact itself
- Serves the cms-web operator console and sponsor-portal
- Serves the emergency long-poll endpoint consumed by player-runtime
- Routes entropy alerts received from entropy-service to the appropriate operator

### Anti-scope

- Does not import or execute PRE logic — corpus is data, not code, from CMS's perspective
- Does not write to replay audit records
- Does not write to parity records
- Does not make canary promotion decisions
- Does not directly push corpus packages to players — delegates to corpus-publisher
- Does not compute entropy scores — receives entropy alerts as events from entropy-service

### API Surface

Detailed in API-SURFACE-MAP.md. Summary:

- Organization, venue, screen, campaign, schedule, override CRUD (operator-facing)
- Emergency trigger/clear/status endpoints
- Corpus version status (read-only view of what corpus-publisher manages)
- Entropy alert inbox (read-only for operators)
- Player emergency long-poll endpoint (player-facing — read-only)

### Data owned by cms-api

- organizations, venues, screens, areas, tv_groups
- campaigns, content_items, schedules, overrides
- sponsorship_contracts, templates
- deployment_groups, deployment_group_membership
- emergency_records (active emergency state per venue)
- operator_users, roles, sessions

### Events emitted

- `corpus.publish.requested` — when an operator approves a campaign and triggers a corpus rebuild
- `emergency.activated` — to WebSocket service for real-time push to operator console
- `screen.commissioned` / `screen.decommissioned`

### Events consumed

- `entropy.alert` from entropy-service — displayed in operator console
- `corpus.version.published` from corpus-publisher — CMS updates its deployment group records

### Failure behavior

- **CMS unavailable:** player-runtime continues from local corpus. Emergency signals cannot be delivered to players. Operators cannot make changes. This is an operational gap — GRADE_A venues with local CMS nodes are the mitigation for high-criticality deployments.
- **DB unavailable:** return 503 on all write endpoints. Read endpoints may serve from replica if configured.

### Scaling characteristics

- Horizontally scalable. Stateless per request. Session tokens are JWT — no server-side session state.
- Database is PostgreSQL with row-level security for multi-tenant isolation (organization-scoped).
- Read-heavy for the emergency long-poll endpoint — this endpoint should be extracted to a dedicated lightweight handler or served via WebSocket gateway if fleet size exceeds ~1000 simultaneous players.

### Constitutional constraints enforced

- No PRE imports (code or types from pre-engine)
- Campaign lifecycle transitions must be validated against the state machine — no direct status field updates
- Emergency trigger requires VENUE_OPERATOR role minimum; global emergency requires ENTERPRISE_ADMIN
- READ_ONLY constitutional state: all write endpoints return 423 (Locked) with explanation
- EMERGENCY_FREEZE: only emergency endpoints remain writable

---

## Service 3: replay-audit-api (Cloud)

### Responsibilities

- Receives batched audit records from player-runtime via POST /audit/batch
- Validates each record's checksum before insertion (fnv1a32 of all fields except record_checksum)
- Stores records in append-only PostgreSQL table with DELETE and UPDATE revoked at DB level
- Provides query API for operators and auditors: by screen_id, time range, correlation_id
- Provides audit chain integrity verification: confirms no gaps, validates checksums across a time range
- Generates proof-of-play reports (sponsor-scoped aggregate of confirmed deliveries)
- Routes rollback trigger flags (present in incoming audit batches) to canary-service

### Anti-scope

- No update endpoints of any kind — records are immutable after insertion
- No delete endpoints — see data retention rules in DATA-OWNERSHIP-MAP.md
- Does not execute PRE logic to verify records — it stores what the player reported and verifies checksums only
- Does not serve PRE output directly to any UI — it serves audit records, not resolved playlists

### API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/audit/batch` | Player API key | Receive and store batched audit records |
| `GET` | `/replay/invocations` | AUDITOR+ | Query records by screen/time/correlation |
| `GET` | `/replay/:invocation_id` | AUDITOR+ | Single record retrieval |
| `GET` | `/replay/integrity/:venue_id` | AUDITOR+ | Chain integrity verification |
| `POST` | `/replay/proof-of-play` | VENUE_OPERATOR+ | Generate proof-of-play report |

### Data owned by replay-audit-api

- `replay_audit_records` table — append-only, immutable. Partitioned by `venue_id` + month.
- `proof_of_play_reports` — generated artifacts (point-in-time snapshots of audit summaries)

### Events emitted

- `rollback.trigger` — emitted to canary-service when an incoming audit batch contains a rollback trigger flag (CLASS_3 or CLASS_4 divergence)

### Events consumed

- None — audit-api is a pure sink for player data

### Failure behavior

- **replay-audit-api unavailable:** player-runtime buffers locally. Audit gap is logged. No PRE disruption. Gap must be manually reviewed if it exceeds 24 hours.
- **DB write fails:** reject the batch with 503. Player retries on next sync cycle. Records are not lost — they remain in the player's ring buffer.
- **Checksum validation fails on incoming record:** reject that record with a 422, log a CONSTITUTIONAL_BREACH event, continue processing remaining records in the batch.

### Scaling characteristics

- Write-heavy (players push every 5 minutes). Read-light (operators query occasionally).
- Table is partitioned by venue_id + month for efficient per-venue queries and retention management.
- Append-only at DB level — INSERT only, no UPDATE/DELETE granted to the application user.
- Horizontal scaling is safe because writes are independent per screen_id.

### Constitutional constraints enforced

- Append-only enforcement at two levels: application layer (no update/delete code paths) and DB layer (REVOKE UPDATE, DELETE ON replay_audit_records FROM app_user)
- Checksum verification before every insert — reject tampered records
- Proof-of-play reports scoped by sponsorship contract — no cross-sponsor data leakage

---

## Service 4: entropy-service (Cloud)

### Responsibilities

- Receives entropy reports from player-runtime (corpus checksums, delivery logs, screen health metrics)
- Computes entropy scores using the same metric calculators defined in `src/entropy/` (M-01 through M-12)
- Stores per-venue and per-fleet entropy snapshots
- Emits entropy alerts to cms-api when a venue crosses advisory tier thresholds
- Serves entropy query API for operators
- Provides fleet-wide entropy dashboard data

### Anti-scope

- Advisory only — entropy scores NEVER trigger automatic configuration changes (FP-13)
- Does not call PRE.resolve() or modify corpus (FP-17)
- Does not write to override, schedule, or campaign tables
- Does not trigger rollbacks directly — it informs, never acts

### API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/entropy/report` | Player API key | Receive entropy metrics from player |
| `GET` | `/entropy/venue/:venue_id` | VENUE_OPERATOR+ | Current entropy score for venue |
| `GET` | `/entropy/fleet` | ENTERPRISE_ADMIN+ | Fleet-wide entropy report |
| `GET` | `/entropy/screen/:screen_id` | VENUE_OPERATOR+ | Per-screen entropy score |
| `GET` | `/entropy/history/:venue_id` | VENUE_OPERATOR+ | Historical entropy trend |

### Data owned by entropy-service

- `venue_entropy_snapshots` — computed per-venue scores, timestamped
- `fleet_entropy_snapshots` — computed fleet aggregates
- `entropy_reports_inbox` — raw player reports before processing
- `entropy_alerts` — alert history (which venue, which tier, when triggered, when acknowledged)

### Events emitted

- `entropy.alert` → cms-api when a venue transitions to a higher advisory tier
- `entropy.fleet.critical` → platform-level alert channel when fleet-wide score exceeds CRITICAL

### Events consumed

- Entropy reports from player-runtime (via HTTP POST — not queue-based to keep latency predictable)

### Failure behavior

- **entropy-service unavailable:** player-runtime logs the failure and continues. Entropy reports are not buffered by the player — they are best-effort. Operators lose entropy visibility but PRE is unaffected.
- **Metric computation fails for a specific screen:** log the failure, skip that screen's contribution to venue aggregate, emit advisory-level alert. Do not crash the batch job.

### Scaling characteristics

- Compute-bound during entropy batch jobs (M-01 through M-12 for each screen). These run on a 30-minute cycle per venue.
- Jobs are venue-scoped — can be parallelized across venues.
- The service is not on the critical playback path.

### Constitutional constraints enforced

- Advisory-only: no write operations to configuration tables (FP-13, FP-16, FP-17)
- Entropy alerts are informational events — they do not carry authority to modify any configuration
- The `entropy.fleet.critical` event informs human operators; it does not trigger automated remediation

---

## Service 5: shadow-service (Cloud — active during canary rollout only)

### Responsibilities

- Receives parity comparison results from player-runtime during active shadow/canary stages
- Stores parity records in append-only storage
- Computes parity scores (24h rolling, 7d rolling) for canary promotion evaluation
- Serves parity reports to canary-service for promotion readiness assessment
- Maintains rollback trigger history

### Anti-scope

- Does not call PRE.resolve() — it receives pre-computed outputs from player-runtime
- Does not make canary promotion decisions — it provides data to canary-service, which requires human approval
- Parity records are immutable after storage — no update or delete operations
- Does not serve parity data to sponsor-portal or general operators (ENTERPRISE_ADMIN+ required)

### API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/parity/record` | Player API key | Store parity comparison result from player |
| `GET` | `/parity/report/:enterprise_id` | ENTERPRISE_ADMIN+ | Current parity report |
| `GET` | `/parity/history/:screen_id` | ENTERPRISE_ADMIN+ | Per-screen parity history |
| `GET` | `/parity/rollback-triggers` | ENTERPRISE_ADMIN+ | Rollback trigger log |
| `POST` | `/shadow/enable/:venue_id` | ENTERPRISE_ADMIN+ | Enable shadow mode for a venue |
| `GET` | `/shadow/status/:venue_id` | ENTERPRISE_ADMIN+ | Shadow mode status |

### Data owned by shadow-service

- `parity_records` — append-only. Contains `invocation_id`, `legacy_output_hash`, `pre_output_hash`, `divergence_class`, `diff_summary`, `deterministic_checksum`.
- `shadow_venue_config` — which venues are in shadow mode
- `rollback_trigger_log` — history of all rollback triggers with their outcomes

### Events emitted

- `parity.divergence.class3` / `parity.divergence.class4` → canary-service when divergence is detected above CLASS_3 threshold

### Events consumed

- Parity records from player-runtime (via POST)

### Failure behavior

- **shadow-service unavailable during shadow stage:** player-runtime logs parity comparison results locally. Gaps in parity records halt canary promotion eligibility (you cannot advance without complete parity data). This is correct — incomplete parity data means the promotion has not been earned.
- **CLASS_3 or CLASS_4 divergence received:** stored immediately, event emitted to canary-service. No automatic rollback — canary-service evaluates.

### Scaling characteristics

- Active only during canary rollout phases (typically weeks to months during a deployment campaign)
- Write load is proportional to fleet size times shadow-enabled venues
- Can be dormant (scaled to zero) when no canary is active

### Constitutional constraints enforced

- Parity records are immutable: append-only at both application and DB level
- CLASS_3/CLASS_4 divergences must be routed to canary-service — these cannot be silently dropped
- Shadow mode requires explicit ENTERPRISE_ADMIN authorization per venue — no implicit opt-in

---

## Service 6: canary-service (Cloud)

### Responsibilities

- Owns canary stage state for each enterprise/fleet
- Evaluates promotion readiness based on parity reports from shadow-service
- Blocks automatic stage advancement (no stage may advance without a human approval token)
- Records promotion history with the human approval token hash (not the token itself)
- Serves current canary status to operators
- Coordinates rollback: when a rollback trigger arrives, it records the trigger, downgrades the canary stage, and emits a corpus-publisher event to redistribute the previous corpus version

### Anti-scope

- Never auto-advances canary stage — the `requires_human_approval: true` invariant from `StageTransitionResult` and `PromotionReadinessReport` is enforced here
- Does not store parity records — only reads summaries from shadow-service
- Does not modify PRE logic or corpus content

### API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/canary/status/:enterprise_id` | ENTERPRISE_ADMIN+ | Current stage and readiness |
| `POST` | `/canary/advance` | ENTERPRISE_ADMIN+ + human_approval_token | Advance to next stage |
| `GET` | `/canary/history/:enterprise_id` | ENTERPRISE_ADMIN+ | Promotion history |
| `POST` | `/canary/rollback` | ENTERPRISE_ADMIN+ | Trigger rollback (also triggered by system on CLASS_3/4) |
| `GET` | `/canary/promotion-readiness/:enterprise_id` | ENTERPRISE_ADMIN+ | Current readiness report |

### Data owned by canary-service

- `canary_stage_state` — current stage per enterprise
- `promotion_history` — record of each advancement (who, when, token hash, parity scores at time of advancement)
- `rollback_log` — record of each rollback trigger (automated or manual)

### Events emitted

- `canary.stage.advanced` → corpus-publisher (triggers corpus redistribution for new stage)
- `canary.rollback.triggered` → corpus-publisher (triggers redistribution of previous version)

### Events consumed

- `parity.divergence.class3` / `parity.divergence.class4` from shadow-service (triggers automatic rollback evaluation — still requires human to re-advance)

### Failure behavior

- **canary-service unavailable:** canary stage is frozen at its last known state. No advancement possible. This is safe — the default failure mode is to stay where you are.
- **Rollback trigger received when canary-service is down:** the trigger is logged by shadow-service. When canary-service recovers, it reads pending triggers and evaluates rollback. This creates a bounded latency window where an unhealthy canary may remain active — this window must be monitored.

### Scaling characteristics

- Very low traffic. One canary state per enterprise (not per screen). Stateful but not write-heavy.
- Single-process is sufficient for expected fleet sizes. PostgreSQL advisory locks prevent concurrent stage transitions.

### Constitutional constraints enforced

- Stage transitions are sequential (enforced by CANARY_STAGE_ORDER enum) — no jumps
- Every advancement requires a non-empty human_approval_token — validated at application layer before DB write
- CLASS_3 or CLASS_4 divergence triggers rollback evaluation — no human approval required to roll back (safety direction), but human approval is required to re-advance
- Promotion history is append-only — no editing of past advancement records

---

## Service 7: corpus-publisher (Cloud)

### Responsibilities

- Accepts corpus authoring requests from cms-api (when a campaign is approved or a schedule changes)
- Assembles the corpus package from CMS-owned data: normalizes campaign/schedule/override/sponsorship data into the format PRE.resolve() expects as SystemStateSnapshot
- Validates the assembled corpus against corpus-schema validators
- Signs the corpus package (private key in secrets manager)
- Assigns corpus versions to deployment groups
- Publishes signed corpus packages to CDN for player-runtime sync
- Serves the corpus sync endpoints consumed by player-runtime

### Anti-scope

- Does not execute PRE logic to validate the corpus — it validates schema, not PRE behavior
- Does not write to CMS tables — it reads CMS data via internal API, not direct DB access
- Corpus content is determined by what CMS provides — corpus-publisher is a packaging and distribution service, not an authoring service

### API Surface

**Player-facing (high volume, low latency):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/corpus/version` | Player API key | Lightweight version check |
| `GET` | `/corpus/:version_id` | Player API key | Full signed corpus download |

**Internal (cms-api → corpus-publisher):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/corpus/publish` | Service-to-service | Trigger corpus rebuild and publish |
| `GET` | `/corpus/versions` | ENTERPRISE_ADMIN+ | List published versions |
| `GET` | `/corpus/deployment-status` | ENTERPRISE_ADMIN+ | Which version each deployment group has |

### Data owned by corpus-publisher

- `corpus_versions` — version metadata: version_id, checksum, signing timestamp, deployment group assignments
- Corpus package artifacts — stored on CDN/object storage, referenced by version_id

### Events emitted

- `corpus.version.published` → cms-api (CMS updates its deployment group status display)

### Events consumed

- `corpus.publish.requested` from cms-api
- `canary.stage.advanced` from canary-service (triggers corpus redistribution to new stage's deployment group)
- `canary.rollback.triggered` from canary-service (triggers redistribution of previous version)

### Failure behavior

- **corpus-publisher unavailable:** players continue with current corpus. CMS changes cannot be deployed to players. Operators must be alerted.
- **Signing service unavailable:** corpus package assembly can proceed but publication is blocked. Do not distribute unsigned packages.
- **CDN unavailable:** players continue with current corpus. Same operational gap as corpus-publisher unavailability.

### Scaling characteristics

- Publication events are infrequent (triggered by operator campaign approval, not per-request)
- Version check endpoint (`GET /corpus/version`) is high-volume — one request per player per 5 minutes. Must be served from CDN edge or cached aggressively.
- Full corpus download is less frequent (only on version change) but payloads are larger — served directly from CDN.

### Constitutional constraints enforced

- Every corpus package must be signed before distribution
- Player-runtime must verify signature before applying new corpus — unsigned corpus must be rejected
- Corpus versions referenced by any replay audit record must be retained (see DATA-OWNERSHIP-MAP.md)
- No corpus package may be published without passing corpus-schema validation
