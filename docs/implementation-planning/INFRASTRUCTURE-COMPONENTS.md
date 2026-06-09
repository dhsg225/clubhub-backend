# Infrastructure Components

**Document type:** Engineering implementation planning
**Status:** Actionable — component specifications ready for infrastructure provisioning
**Authority:** ENGINEERING-CONSTITUTION-v1.md, DEPLOYMENT.md, SECURITY_MODEL.md, CAPACITY_MODEL.md

---

## Cloud Infrastructure

### API Gateway

**Purpose:** Single ingress point for all external API traffic. Handles TLS termination, CORS, rate limiting, auth token validation (JWT signature only — not role authorization, which happens in each service).

**Component:** AWS API Gateway v2 (HTTP API) or equivalent (Kong, Traefik). HTTP API is preferred over REST API for lower latency on high-volume endpoints.

**Configuration:**
- TLS: minimum TLS 1.2, TLS 1.3 preferred. Reject all plaintext.
- CORS: explicit allowlist per service path group. No wildcard origins in production.
- Rate limiting: applied per API key and per JWT sub claim. Hard limits per endpoint documented in API-SURFACE-MAP.md.
- JWT validation: verify signature using platform public key. Reject expired tokens. Pass validated claims to downstream service as `X-ClubHub-Claims` header.
- Request ID injection: generate `X-Request-Id` (UUID v4) on every request. All services must use this as their `correlation_id` for telemetry.

**Routing rules:**
- `https://api.clubhub.tv/cms/*` → cms-api
- `https://api.clubhub.tv/audit/*` → replay-audit-api
- `https://api.clubhub.tv/preview/*` → preview-api (or cms-api if hosted together)
- `https://api.clubhub.tv/canary/*` → canary-service
- `https://api.clubhub.tv/constitutional/*` → cms-api (constitutional endpoints)
- `https://corpus.clubhub.tv/*` → corpus-publisher (separate subdomain for player traffic)
- Emergency long-poll: routed to WebSocket gateway

**Monitoring:** 4xx/5xx rates per route, P95/P99 latency per route, rate limit trigger frequency. Alert on: any route P99 > 2s, any route 5xx rate > 0.1% over 5 minutes.

---

### CMS API Service

**Deployment:** Containerized (Docker), horizontally scalable, behind Application Load Balancer.

**Statelessness requirement:** No per-request local state. Session validation is JWT-based (stateless). Any state that must survive a process restart goes to PostgreSQL. No in-memory caches that could serve stale data (use Redis only for advisory caches with short TTL, never for authoritative state).

**Scaling trigger:** CPU > 70% or connection count > 80% of configured max. Auto-scale up to 10 instances. Minimum 2 instances (availability).

**Database connection:** PostgreSQL connection pool via `pg-pool`. Pool size: `min: 2, max: 10` per instance. Connection string from secrets manager (not environment variable in source code).

**Emergency long-poll endpoint special handling:** This endpoint holds open HTTP connections for up to 30 seconds per player. With a large fleet this creates connection pressure. At >500 simultaneous players per instance, the emergency long-poll handler must be moved to a dedicated WebSocket gateway (see below). Use AWS ALB connection draining with a 35-second timeout (5 seconds more than long-poll timeout).

---

### Replay Audit Database

**Component:** PostgreSQL 15+ with explicit privilege restrictions.

**Schema design requirements:**

```sql
-- Partitioned by venue_id (LIST) and month (RANGE sub-partition)
-- Enables efficient per-venue queries and retention management
CREATE TABLE replay_audit_records (
  audit_record_id   UUID PRIMARY KEY,
  screen_id         TEXT NOT NULL,
  venue_id          TEXT NOT NULL,   -- denormalized for partition key
  at                BIGINT NOT NULL, -- UTC ms
  correlation_id    TEXT NOT NULL,
  pre_output_hash   TEXT NOT NULL,
  playlist_checksum TEXT NOT NULL,
  resolution_level  SMALLINT NOT NULL,
  is_fallback       BOOLEAN NOT NULL,
  divergence_class  SMALLINT,
  entropy_score_snapshot NUMERIC(6,4),
  shadow_parity_snapshot NUMERIC(6,4),
  invariants_passed BOOLEAN NOT NULL,
  audit_written_at  BIGINT NOT NULL,
  record_checksum   TEXT NOT NULL
) PARTITION BY LIST (venue_id);

-- Append-only enforcement at DB level
REVOKE UPDATE, DELETE ON replay_audit_records FROM app_user;
REVOKE TRUNCATE ON replay_audit_records FROM app_user;
```

**Privilege enforcement:** The application database user (`app_user`) has only `INSERT` and `SELECT` on `replay_audit_records`. `UPDATE`, `DELETE`, and `TRUNCATE` are revoked. Only the DBA role (human, not application) can modify or delete records. This is the DB-level enforcement of the constitutional append-only constraint.

**Indexing:**
- `(venue_id, at)` — primary query pattern: per-venue time range queries
- `(screen_id, at)` — per-screen queries
- `correlation_id` — lookup by correlation ID
- `(at, resolution_level)` — aggregate queries for proof-of-play

**Backup:** Continuous WAL archiving to S3. Point-in-time recovery. 30-day backup retention minimum. Test restores quarterly.

---

### CMS Database

**Component:** PostgreSQL 15+ with row-level security.

**Multi-tenant isolation:**

```sql
-- Row-level security on all org-scoped tables
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON venues
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

The application sets `app.current_org_id` on each connection before executing queries. This enforces org isolation at the database level — a buggy application query cannot leak cross-org data.

**PLATFORM_ADMIN bypass:** PLATFORM_ADMIN queries use a separate connection with `SET LOCAL app.current_org_id = NULL` (bypasses RLS). This connection is only established by authenticated PLATFORM_ADMIN requests.

**Schema migrations:** Managed by a migration tool (Flyway or similar). Migrations are versioned, applied in order, and never destructive without a corresponding backward-compatible migration first. The `lint-migrations.ts` script in `scripts/` validates migration files before CI proceeds.

---

### CDN (Corpus Distribution)

**Purpose:** Serve corpus packages and static assets to Pi players and web apps. This is the highest-volume read path in the system.

**Component:** CloudFront (AWS) or equivalent with edge caching.

**Corpus version check endpoint (`GET /corpus/version`):**
- Cache TTL: 60 seconds at CDN edge
- Players check every 5 minutes — 60-second cache means a new corpus version propagates to all players within 5 minutes + 60 seconds
- Cache invalidation triggered by corpus-publisher on new version publication

**Corpus package download (`GET /corpus/:version_id`):**
- Cache TTL: indefinite (version_id is immutable — a given version_id always returns the same bytes)
- CDN caches corpus packages forever once fetched from origin
- Players download a given version_id only once per device

**Static assets (player-ui build, cms-web build, sponsor-portal build):**
- Cache TTL: 1 year for hashed filenames, 5 minutes for `index.html`
- Deployed via CI on each release

---

### Message Queue

**Purpose:** Async event delivery between cloud services. Decouples producers from consumers for events that do not need synchronous acknowledgment.

**Component:** AWS SQS with dead-letter queues. Standard queues (not FIFO) for most events; FIFO for ordered processing of canary stage events.

**Queue definitions:**

| Queue name | Producer | Consumer | Type | Notes |
|---|---|---|---|---|
| `corpus-publish-requests` | cms-api | corpus-publisher | Standard | Campaign approval triggers corpus rebuild |
| `entropy-alerts` | entropy-service | cms-api | Standard | Advisory alerts to operator inbox |
| `canary-events` | canary-service | corpus-publisher | FIFO | Stage advancement and rollback must be ordered |
| `corpus-published` | corpus-publisher | cms-api | Standard | Notifies CMS of new corpus version |
| `parity-divergence` | shadow-service | canary-service | FIFO | CLASS_3/4 divergences must be processed in order |
| `rollback-triggers` | canary-service | corpus-publisher | FIFO | Rollback must be ordered to prevent race conditions |

**Dead-letter queues:** Every queue has a corresponding DLQ. Messages that fail processing after 3 attempts move to the DLQ. DLQ alerts fire when any message lands there — DLQ messages are operational incidents, not routine.

**Retention:** 14-day message retention. DLQ messages: 14 days.

---

### WebSocket Service

**Purpose:** Real-time emergency push to operator console (cms-web). Player emergency long-poll fallback (players use long-poll by default; WebSocket is the upgrade path for large fleets).

**Component:** AWS API Gateway WebSocket API + Lambda or a dedicated WebSocket server (Node.js + ws library) deployed as a stateful service.

**Connection model:**
- Operators subscribe per enterprise: `WS /emergency/subscribe/:enterprise_id`
- Server maintains in-memory map of `enterprise_id → [connectionId, ...]`
- On emergency activation/clear event from cms-api: push to all connections for that enterprise_id
- Connection TTL: 2 hours (operator sessions are 8 hours max; reconnect is automatic)

**Player emergency long-poll:**
- Players use `GET /emergency/poll` with a 30-second timeout
- If the WebSocket service is available, the long-poll response body includes an upgrade invitation
- Players are NOT required to upgrade to WebSocket — long-poll is the baseline guaranteed path
- Reason: Pi devices behind restrictive network policies may not support WebSocket; long-poll is universally compatible

**Failure behavior:** If the WebSocket service is unavailable, operators lose real-time emergency push. cms-web falls back to polling `GET /emergency/status` every 10 seconds. Players continue long-polling the cms-api endpoint directly.

---

### Corpus Signing Service

**Purpose:** Signs corpus packages before publication. Prevents players from applying untrusted corpus updates.

**Component:** AWS KMS (asymmetric key pair, RSA-PSS or ECDSA P-256) or AWS Secrets Manager with HSM backing.

**Signing flow:**
1. corpus-publisher assembles corpus package (validated against corpus-schema)
2. Computes `fnv1a32(canonicalizeJson(corpusPackage))` as the package checksum
3. Signs the checksum using the private key via KMS API (private key never leaves KMS)
4. Attaches signature and public key fingerprint to the `CorpusSignatureBlock`
5. Publishes signed package to CDN

**Verification flow (in player-runtime):**
1. Download corpus package
2. Extract `CorpusSignatureBlock`
3. Verify signature against platform public key (baked into player-runtime at build time)
4. Recompute `fnv1a32(canonicalizeJson(corpusPackage))` and compare to signed checksum
5. If verification fails: reject package, log `CONSTITUTIONAL_BREACH`, continue with current corpus

**Key rotation:** Platform public key is versioned. The `CorpusSignatureBlock` includes the key fingerprint. Player-runtime supports multiple trusted public keys (current + previous) to allow key rotation without immediate player OTA. After key rotation, publish a player OTA that removes the old key after all players have received the new corpus signed with the new key.

---

## Edge Infrastructure (Per Venue)

### Pi Player Device

**Hardware:** Raspberry Pi 4 (4GB RAM minimum) or Pi 5.
**OS:** Raspberry Pi OS Lite (64-bit, headless). No desktop environment except what Chromium needs.

**Process architecture per device:**
```
systemd
├── player-runtime.service  (Node.js — PRE, corpus sync, audit buffer, API calls)
├── player-ui.service       (Chromium kiosk on :3000, asset server on :3002)
└── watchdog.service        (monitors both, restarts on crash, logs restart events)
```

**Storage layout:**
```
/var/clubhub/
├── corpus/
│   ├── current/     — active corpus (verified, applied)
│   └── pending/     — downloaded corpus awaiting signature verification
├── audit/
│   └── ring.log     — append-only audit ring buffer (max 100MB, then drops oldest)
├── assets/          — media content cache
└── config/
    └── device.json  — screen_id, player_api_key, venue_id (set at commissioning)
```

**Network requirements:** Outbound HTTPS to `corpus.clubhub.tv` and `api.clubhub.tv`. No inbound connections from cloud required. Port 443 outbound is the only mandatory firewall rule.

**Systemd service definitions:** The `pi-appliance` scripts in the existing codebase define the service files. These must be included in the player-runtime OTA package.

---

### Local Corpus Store

**Implementation:** Atomic file replacement using a write-then-rename pattern:
1. Download new corpus to `/var/clubhub/corpus/pending/corpus-{version_id}.json`
2. Verify signature
3. Validate against corpus-schema validators
4. `mv /var/clubhub/corpus/pending/corpus-{version_id}.json /var/clubhub/corpus/current/corpus.json` (atomic on Linux ext4)
5. Delete old pending files

The rename is atomic on Linux — player-runtime never sees a partially-written corpus file. If the device loses power between download and rename, the pending file is incomplete and will be re-downloaded.

**Signature public key:** Baked into the player-runtime binary at build time. Not stored as a file (prevents tampering). Updated only via player-runtime OTA.

---

### Audit Ring Buffer

**Implementation:** Local append-only file at `/var/clubhub/audit/ring.log`. Each entry is one line of JSON (the serialized `ReplayAuditRecord`).

**Ring behavior:**
- Maximum file size: 100MB (approximately 500,000 records at ~200 bytes each)
- When the file reaches 100MB: the oldest 10% of records are dropped and a gap marker is written: `{"type":"gap","dropped_count":N,"oldest_at":M,"newest_at":M,"reason":"ring_overflow"}`
- This gap marker is included in the next audit batch push and logged as an FM-007 event by replay-audit-api

**Sync confirmation:** After replay-audit-api confirms a batch with HTTP 200, the synced records are marked for deletion (not immediately deleted — a background job cleans up confirmed records every hour). This prevents re-sync of already-confirmed records.

---

### GRADE_A Venue: Local CMS Node

**What it is:** A second Pi device (or small server) at the venue running a minimal CMS node — a read-only cache of the venue's portion of the CMS database, capable of serving emergency management and override creation during cloud outage.

**Not yet implemented:** The local CMS node is described in DEPLOYMENT.md as a future capability for GRADE_A venues. This planning document notes it as a future infrastructure requirement. Its API surface must be compatible with the subset of cms-api that player-runtime and venue staff need during offline operation.

**Implementation dependency:** Local CMS node requires a sync protocol with cloud cms-api that is not yet designed. This is a deferred infrastructure item.

---

## CI/CD Pipeline

### Monorepo Build Graph (Turborepo)

```
validate-contracts (pre-engine scope) ─────────────────────────────────┐
                                                                        ↓
fnv-checksum build → pre-types build → constitutional-types build → pre-engine build
                   → corpus-schema build                            ↑
                                                                    │
telemetry-sdk build ────────────────────────────────────────────────┘
                                    ↓
player-runtime build ← pre-engine ← pre-types ← constitutional-types ← telemetry-sdk ← fnv-checksum ← corpus-schema
cms-api build ← constitutional-types ← telemetry-sdk
replay-audit-api build ← pre-types ← fnv-checksum ← telemetry-sdk
entropy-service build ← pre-types ← constitutional-types ← telemetry-sdk
shadow-service build ← pre-types ← constitutional-types ← fnv-checksum ← telemetry-sdk
canary-service build ← constitutional-types ← telemetry-sdk
corpus-publisher build ← corpus-schema ← fnv-checksum ← constitutional-types
cms-web build
player-ui build ← pre-types
sponsor-portal build
```

### Constitutional Gates (merge-blocking)

These stages run after all builds and before any deployment artifact is produced. A failure in any stage blocks the entire pipeline.

| Stage | File | What it verifies |
|---|---|---|
| 04 | `ci/stages/04-replay-harness.yml` | 9/9 corpus replay packets pass with correct output hashes |
| 07 | `ci/stages/07-corpus-verify.yml` | Corpus package structure, checksums, schema validity |
| 08 | `ci/stages/08-chaos-smoke.yml` | 7 chaos scenarios, 270/270 assertions |
| 09 | `ci/stages/09-preview-verification.yml` | Preview API determinism, 165/165 assertions |
| 10 | `ci/stages/10-shadow-parity.yml` | Shadow comparison, 6-stage canary path, rollback triggers |
| 11 | `ci/stages/11-runtime-constitution.yml` | Runtime integration, 150/150 assertions, FP-20–25 |
| 12 | `ci/stages/12-production-hardening.yml` | 10 failure modes, 8 constitutional states, 119/119 assertions |

No service deployment artifact is produced until all 7 stages pass.

### Player OTA Delivery

**Challenge:** Pi devices cannot be reached inbound from cloud (they are behind venue NAT). OTA must be player-initiated (pull-based).

**Mechanism:**
1. A new player-runtime version is built and its artifact stored in S3/CDN at `/ota/{version}/player-runtime.tar.gz`
2. corpus-publisher includes an `ota_version` field in the corpus version metadata: `{ version_id, checksum, ota_version: "1.2.3" | null }`
3. Player-runtime reads `ota_version` from the corpus version check response
4. If `ota_version` differs from the running version: player-runtime downloads the OTA package, verifies its signature, and signals the watchdog service to apply the update
5. The watchdog service applies the update and restarts player-runtime (one screen downtime window: ~10 seconds)

**OTA signing:** Same signing infrastructure as corpus packages. OTA artifacts are signed with the same KMS key pair. Players verify OTA signature before applying.

**Rollback:** If player-runtime fails to start after OTA, the watchdog service reverts to the previous version (kept on disk) and reports the failure in the next audit batch.

**OTA cadence:** Player OTA and corpus updates are independent. A corpus update does not require a player OTA. A player OTA does not require a corpus rebuild.

---

## Secrets Management

**Component:** AWS Secrets Manager for all production secrets. No secrets in environment variables at the application level — secrets are fetched at startup from Secrets Manager and held in memory only.

| Secret | What it is | Rotation | Access |
|---|---|---|---|
| `clubhub/corpus-signing-private-key` | KMS key reference (not the key itself — the key is in KMS) | Annual or on breach | corpus-publisher service role only |
| `clubhub/platform-public-key` | Public key for corpus signature verification | On private key rotation | Baked into player-runtime build; also in Secrets Manager for cloud services |
| `clubhub/cms-api/db-connection` | PostgreSQL connection string | 90 days | cms-api service role only |
| `clubhub/replay-audit-api/db-connection` | PostgreSQL connection string | 90 days | replay-audit-api service role only |
| `clubhub/constitutional-human-auth-tokens` | List of valid human auth tokens for GlobalConstitutionalBreaker.reset() | Manual (PLATFORM_ADMIN action) | cms-api constitutional endpoint + player-runtime via encrypted corpus field |
| `clubhub/sponsor-api-keys/{sponsor_id}` | Sponsor portal API keys | Annual or on request | Sponsor portal API gateway |
| `clubhub/service-to-service-tokens` | Internal service tokens for S2S calls | 30 days | Each service's IAM role |

**Constitutional human auth tokens — special handling:** These tokens are used to reset the GlobalConstitutionalBreaker (`reset(humanAuthorizationToken: string)` requires ≥8 chars). They are stored in Secrets Manager as a JSON array of valid tokens. When an operator submits a reset request, the API validates the submitted token against this list (constant-time comparison to prevent timing attacks). Used tokens are invalidated after use — each reset requires a fresh token from the list.

**Player API keys:** Generated at screen commissioning time. Stored in cms-api's database (hashed — never stored in plaintext). The plaintext is returned to the operator once at commissioning and must be injected into the Pi device's `device.json` during physical setup. Lost player API keys require decommissioning the screen and re-commissioning.

---

## Monitoring and Alerting

### Telemetry Stack

**Collection:** OpenTelemetry SDK in all services (via `@clubhub/telemetry-sdk` OTLP backend). All services emit `AnyLogLine`-shaped log events, counter metrics, and gauge metrics.

**Aggregation:** OTLP collector → Grafana Cloud (or self-hosted Grafana + Loki + Prometheus). Player-runtime on Pi emits to stdout in JSON format; a lightweight log shipper (Promtail or FluentBit) reads stdout and forwards to the collector.

**Dashboards required:**

1. **Constitutional State Dashboard:** Current GlobalConstitutionalBreaker mode per fleet, circuit breaker states (PRE, shadow, entropy, replay, constitutional), last trip reason, time since last trip.

2. **Fleet Health Dashboard:** Heartbeat status per screen (green/yellow/red based on last heartbeat age), corpus version distribution across fleet, active emergency count by venue, entropy advisory tier by venue.

3. **Entropy Trend Dashboard:** Per-venue entropy scores over 7 days, fleet-wide composite score, M-01 through M-12 per-metric breakdown for selected venue, advisory tier transition history.

4. **Parity Dashboard (ENTERPRISE_ADMIN):** Parity score 24h/7d per enterprise, parity score trend, CLASS_3/CLASS_4 divergence count, canary stage per enterprise.

5. **Audit Pipeline Dashboard:** Records ingested per hour, validation failures per hour, sync latency (time from player write to cloud confirmation), audit gap events.

### Alerts

| Alert | Condition | Severity | Recipient |
|---|---|---|---|
| Constitutional mode non-NORMAL | Any circuit breaker not CLOSED | CRITICAL | Platform on-call |
| EMERGENCY_FREEZE active | `constitutional_mode == EMERGENCY_FREEZE` | CRITICAL | Platform on-call + Account manager |
| Player heartbeat missed | Any screen misses 3 consecutive 5-minute heartbeats | WARNING | VENUE_OPERATOR |
| Player heartbeat missed | Any screen misses 6 consecutive heartbeats (30 min) | CRITICAL | REGIONAL_MANAGER |
| Corpus sync stale | Any player has corpus older than 72h | CRITICAL | VENUE_OPERATOR + Platform |
| Entropy tier 4 | Any venue enters advisory tier 4 (CRITICAL entropy) | CRITICAL | VENUE_OPERATOR |
| Audit gap detected | Any audit gap event in replay-audit-api | WARNING | Platform on-call |
| Audit gap > 24h | Any screen with no audit records for 24h | CRITICAL | Platform on-call |
| Parity score below threshold | parity_score_24h < 0.999 | WARNING | ENTERPRISE_ADMIN |
| CLASS_4 divergence | Any CLASS_4 parity divergence | CRITICAL | Platform on-call |
| DLQ message received | Any dead-letter queue receives a message | ERROR | Platform on-call |
| OTA rollback triggered | player-runtime rollback to previous version | WARNING | Platform on-call |
| Corpus signature invalid | Any player reports invalid corpus signature | CRITICAL | Platform on-call |

### Circuit Breaker Metric Export

The GlobalConstitutionalBreaker state, and each subsystem circuit breaker (PRE, shadow, entropy, replay), is exported as a gauge metric:

```
clubhub.circuit_breaker.state{subsystem="pre"} 0  # 0=CLOSED, 1=OPEN, 2=HALF_OPEN
clubhub.constitutional.mode{scope="fleet"} 0       # 0=NORMAL, 1=READ_ONLY, 2=EMERGENCY_FREEZE
```

Alert on any non-zero value for `clubhub.constitutional.mode`. Alert on any `clubhub.circuit_breaker.state > 0` for the PRE subsystem.
