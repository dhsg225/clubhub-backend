# IMPLEMENTATION-WAVES.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready
**Authority:** SERVICE-DECOMPOSITION.md, DATABASE-ROLLOUT-PLAN.md, ENGINEERING-CONSTITUTION-v1.md
**Last updated:** 2026-05-26

---

## Overview

Seven implementation waves deliver a constitutionally complete platform across 52 weeks. Each wave has a defined entry condition (what must exist before work begins), a defined exit gate (what must be demonstrably true before the next wave starts), staffing assumptions, and explicit declarations of which constitutional shortcuts are permitted and which are forbidden.

The ordering is not arbitrary. It reflects real dependency chains: the database schema must exist before the CMS API, the CMS API must exist before corpus publication, corpus publication must exist before player-runtime can sync, and audit must be cloud-backed before RLS is enabled. Shortcutting this order produces hidden debt that is expensive to unwind.

---

## WAVE 1 — Foundational Runtime + Database (Weeks 1–6)

### Prerequisites

None for new cloud services. `src/` (pre-engine, runtime, shadow, audit, entropy) is already implemented and constitutionally verified. Wave 1 treats these as stable dependencies — they are not modified.

### What gets built

**Database (PostgreSQL — Wave 1 migrations from DATABASE-ROLLOUT-PLAN.md):**
- `platforms`, `enterprise_groups`, `regional_organizations`, `venues`, `screen_zones`, `screens` (identity + tenancy tables)
- No RLS enabled yet on enterprise-scoped tables — application-level tenant filtering used temporarily (see shortcuts below)
- Flyway migration tooling wired in CI with rollback scripts for every migration

**Auth service:**
- Principal creation (USER + SERVICE_ACCOUNT types)
- Email + password session management with JWT issuance
- Role assignment API (PLATFORM_ADMIN scoped in Wave 1 only)
- Redis session store with 24h sliding TTL

**Core CMS API (cms-api):**
- Organizations, venues, screens CRUD (application-level tenant filtering — no RLS yet)
- Screen zone management
- Basic deployment group creation (needed by corpus sync in Wave 1)
- Health endpoint (`GET /health`) for load balancer

**player-runtime v1 (edge — Raspberry Pi):**
- PRE.resolve() loop: pulls corpus from local store, resolves per screen_id, emits playlist to player-ui
- Corpus sync: polls `GET /corpus/version` every 5 minutes; downloads on version change
- Local audit buffer: append-only in-memory ring buffer + flush to local disk file
- Heartbeat: sends `POST /heartbeat` to cms-api every 30 seconds (screen_id, last_checksum, timestamp)
- Emergency long-poll: `GET /emergency/poll` — blocks until server sends signal or 60s timeout
- Process restart on crash (systemd unit file)
- Chromium kiosk launcher: starts Chromium in kiosk mode pointing at player-ui local server

**player-ui v1:**
- Local HTTP server (port 3000) serving a React single-page app
- Receives resolved playlist from player-runtime via local WebSocket IPC
- Renders playlist items in sequence with duration-based advancement
- Emergency banner overlay (full-screen red with emergency content)
- No external network calls — all data arrives from player-runtime

**CMS Web v1 shell (cms-web):**
- Authentication flow (login, logout, JWT refresh)
- Routing skeleton (venues, screens — read-only views)
- Venue dashboard: list screens, last-seen status, current corpus version
- No campaign management yet

**Corpus sync (unsigned — signing added in Wave 2):**
- `GET /corpus/version` returns `{ version_id, checksum }` — player compares against local version
- `GET /corpus/:version_id` returns the full corpus JSON
- Player applies the corpus unconditionally (no signature verification yet)
- Checksum verification (fnv1a32): player verifies payload checksum before applying

### Staffing assumptions

| Role | Count | Primary responsibility |
|---|---|---|
| Backend Engineer | 2 | CMS API, database migrations, auth service |
| Edge Engineer | 1 | player-runtime, player-ui, Pi deployment tooling |
| Frontend Engineer | 1 | cms-web shell |
| DevOps | 1 | PostgreSQL setup, CI/CD, Docker, Redis |

Total: 5 engineers

### Key deliverable

A Pi connected to the network displays a resolved playlist from a corpus delivered by the CMS. The VENUE_OPERATOR can see the screen's status (online/offline, current corpus version) in cms-web. Audit records are generated locally on the Pi per PRE invocation.

### Likely failure modes

1. **Database migration FK violations.** Flyway runs migrations in sequence, but if a migration file references a table in a later migration (wrong ordering), it will fail at apply time. Mitigation: run all migrations against a clean database in CI before merging.
2. **Pi corpus sync reliability on poor WiFi.** The corpus download may be interrupted mid-transfer, leaving the local corpus in a partial state. Mitigation: write the corpus to a temp file, verify the checksum, then rename atomically. Never apply a partial corpus.
3. **Chromium kiosk startup stability on Pi.** Chromium on Pi 4 with 2GB RAM is prone to OOM crashes on startup, especially if the GPU memory split is misconfigured. Mitigation: set `gpu_mem=128` in `/boot/config.txt`, enable Chromium's `--disable-dev-shm-usage` flag, and configure the kiosk script to auto-restart on exit.
4. **player-runtime process loses corpus file on reboot.** If the local corpus is stored in a temp directory that is cleared on reboot, the player starts with no corpus. Mitigation: store the corpus in `/var/lib/clubhub/corpus/` (survives reboot), write the corpus version ID to a `current.json` sidecar file for fast startup.

### Operational readiness gate

1 venue, 1 screen, 1 campaign — end-to-end playlist visible on Pi for 24 hours with no crashes. Audit records present in local buffer for all PRE invocations during the 24h period.

### Rollback strategy

Wave 1 is all new infrastructure. There is no existing production system to protect. Rollback = shut down the services and redeploy from the previous container image tag.

### Constitutional shortcuts ALLOWED in Wave 1

- **Corpus signature verification:** Not required. Player verifies checksum (fnv1a32) but does not verify a cryptographic signature. Signing infrastructure is added in Wave 2.
- **RLS at database layer:** Not enabled yet. Application-level tenant filtering is acceptable temporarily. All queries must include `WHERE enterprise_group_id = $currentEnterpriseId` in the application layer.
- **Audit batch sync:** Can be synchronous in Wave 1. The player-runtime sends each audit batch immediately on completion rather than buffering for async background send. Async buffering is implemented in Wave 4.
- **Replay audit cloud service:** Not required yet. Audit records generated on device but not synced to cloud until Wave 2.

### Constitutional shortcuts FORBIDDEN even in Wave 1

- **PRE.resolve() must run locally on player.** The player must never make a network call to resolve a playlist. PRE runs on-device against the local corpus, period.
- **Audit records must be generated per-invocation.** The player must write one audit record per PRE.resolve() call. Batching the write to disk is acceptable; batching the resolution into a single audit record is not.
- **Append-only enforcement must be in place before any audit records are written.** The local ring buffer must be append-only from day one. No mechanism to delete or update a record may exist in the implementation — even temporarily.
- **Checksum verification on corpus apply.** Even without cryptographic signing, the player must verify the fnv1a32 checksum of the corpus payload before applying it. A failed checksum must reject the corpus.

---

## WAVE 2 — Replay + Determinism Enforcement (Weeks 7–12)

### Prerequisites

Wave 1 complete. At least 1 venue operational with a Pi actively resolving playlists and generating audit records. Corpus signing key pair generated (can be done with hardware security module or AWS KMS — the signing ceremony should be planned in Wave 1 even though signing is not implemented until Wave 2).

### What gets built

**Database (Wave 2 migrations from DATABASE-ROLLOUT-PLAN.md):**
- `principals`, `role_assignments`, `sessions` (identity + access tables)
- RLS policies enabled on all enterprise-scoped tables (venues, screen_zones, screens, campaigns, etc.)
- Wave 5 append-only tables: `replay_audit_records`, `parity_records` (partitioned by month), `constitutional_freeze_log`
- `enforce_append_only()` trigger function (must exist before any Wave 5 table is created)
- Monthly partition creation job (creates next 3 months of partitions, runs on the 1st of each month)

**Replay audit cloud service (replay-audit-api):**
- `POST /audit/batch` — receives batched audit records from player-runtime, validates fnv1a32 checksum per record, inserts into `replay_audit_records`
- `GET /replay/invocations` — query by screen_id, time range, correlation_id (AUDITOR role required)
- `GET /replay/integrity/:venue_id` — verifies no gaps in audit chain for a venue over a time range (sequential correlation IDs, no missing records)
- Player API key authentication for the batch endpoint
- DELETE and UPDATE revoked at database level for the app user

**Corpus signing:**
- corpus-publisher signs corpus packages with Ed25519 private key stored in AWS KMS (or equivalent)
- player-runtime verifies signature against the bundled public key before applying any new corpus version
- Unsigned or signature-failed corpus is rejected — player keeps its current corpus version
- Signing ceremony documentation created: how to rotate keys, how to revoke compromised keys

**RLS enforcement:**
- Application layer switches from explicit `WHERE enterprise_group_id = $x` clauses to setting `app.current_enterprise_id` session variable before each query
- All RLS policies verified by running cross-tenant data access tests in CI

**Audit chain integrity endpoint:**
- `GET /replay/integrity/:venue_id` returns pass/fail with gap details
- Integration test: delete a record from the test database, verify the integrity check fails

**Replay query UI in cms-web:**
- AUDITOR role view: search audit records by screen, date range, correlation ID
- Integrity check trigger button for a venue with pass/fail display

**Determinism verification in CI:**
- `scripts/system-integrity/full-stack-determinism.ts` wired to run against cloud + player in CI
- Fails CI if determinism check fails

### Staffing assumptions

Same as Wave 1, plus 1 additional backend engineer for the replay audit service.

| Role | Count |
|---|---|
| Backend Engineer | 3 |
| Edge Engineer | 1 |
| Frontend Engineer | 1 |
| DevOps | 1 |

Total: 6 engineers

### Key deliverable

Every PRE invocation on every Pi has a cloud-backed immutable audit record. Corpus cannot be applied to a player without a valid Ed25519 signature. Audit chain integrity check passes for all active venues. AUDITOR can query audit records in cms-web.

### Operational readiness gate

- Audit chain integrity check passes for all active venues (zero gaps in the chain for the prior 7 days)
- Corpus signing ceremony complete: private key in KMS, public key bundled in player-runtime release
- Cross-tenant RLS test suite passes with RLS enabled on all enterprise tables
- One deliberate audit record deletion causes integrity check to fail (verified in staging)

### Constitutional shortcuts ALLOWED in Wave 2

- Preview API: not yet required (Wave 4)
- Multi-region: not required (Wave 7 planning)
- Entropy service: not yet required (Wave 5)

### Constitutional shortcuts FORBIDDEN in Wave 2

- **Corpus must be signed before player applies it.** No unsigned corpus may exist in production after Wave 2 ships. Existing unsigned corpus versions must be replaced with signed versions during the Wave 2 deployment.
- **Audit records must be immutable in cloud DB.** The `enforce_append_only()` trigger must be active before the first audit record is written to the cloud. The app database user must have UPDATE and DELETE revoked on `replay_audit_records`.

---

## WAVE 3 — CMS Core (Weeks 13–20)

### Prerequisites

Wave 2 complete. Replay audit chain verified. RLS active. Corpus signing verified.

### What gets built

**Database (Waves 3–4 from DATABASE-ROLLOUT-PLAN.md):**
- Wave 3 content model: `content_assets`, `templates`, `campaigns`, `schedules`, `overrides`, `sponsorships`
- Wave 4 corpus tables: `corpus_versions`, `deployment_groups`, `deployment_group_screens`, `corpus_deployments`
- Wave 5 operational records: `entropy_reports`, `entropy_acknowledgments`, `canary_stage_history`

**Campaign lifecycle:**
- DRAFT → REVIEW → APPROVED → ACTIVE → ARCHIVED state machine enforced in CMS API
- Approval workflow: ENTERPRISE_ADMIN required to transition REVIEW → APPROVED
- Campaign deletion forbidden for ACTIVE and ARCHIVED campaigns (soft-delete only)
- Campaign scheduling validation: start_at must be ≥72h in the future (corpus delivery lead time requirement)

**Schedule management:**
- Time rules: start/end time, days_of_week, IANA timezone
- Recurrence (weekly patterns)
- Conflict detection: warn when two schedules target the same screen in overlapping time windows

**Override management:**
- Create override (VENUE_OPERATOR+)
- Extend override duration (VENUE_OPERATOR+)
- Cancel override (sets expires_at = now)
- Automatic expiry: expired overrides excluded from corpus on next publish

**Emergency system — cloud side:**
- `POST /emergency/trigger` (VENUE_OPERATOR+) — sets emergency state for a venue
- `POST /emergency/acknowledge` (VENUE_OPERATOR+) — acknowledges the emergency (confirms operator is aware)
- `POST /emergency/clear` (VENUE_OPERATOR+) — clears the emergency
- Emergency content asset must be pre-registered for a venue before emergency trigger is reachable
- Emergency is active on ALL screens in the venue simultaneously — no per-screen targeting
- Emergency trigger reachable in 2 actions from any venue view (constitutional requirement)

**Corpus publication pipeline:**
- campaign → corpus version → deployment group assignment
- Corpus assembly: cms-api requests corpus build; corpus-publisher assembles SystemStateSnapshot from CMS tables, validates against corpus-schema, signs, publishes to CDN
- Corpus versioning: each publication creates a new `corpus_versions` row (immutable once created)
- Deployment group assignment: operator assigns a corpus version to a deployment group; players in that group sync the new version

**CMS Web v2:**
- Campaign manager: create, edit, publish campaigns (status transitions with confirmation dialogs)
- Schedule editor: time rules, DOW selector, venue/screen targeting
- Override console: create/extend/cancel overrides with expiry display
- Emergency console: trigger, acknowledge, clear with venue-wide status display (N screens affected)
- Emergency trigger accessible from venue header — 2 clicks from any venue view

**Sponsorship management:**
- CRUD for sponsorship contracts (ENTERPRISE_ADMIN only)
- SOV percentage validation: total SOV per screen_zone cannot exceed SOV_MAX_EFFECTIVE (0.9999)
- Exclusivity conflict detection: warn when a new sponsorship conflicts with an existing exclusivity clause
- Sponsor content always at L4 — not configurable (constitutional constant)

**Entropy service — cloud side (basic):**
- `POST /entropy/report` — receives entropy metrics from player-runtime
- Storage in `entropy_reports` table
- No computation or alerting yet (Wave 5)

### Staffing assumptions

| Role | Count |
|---|---|
| Backend Engineer | 3 |
| Frontend Engineer | 2 |
| DevOps | 1 |

Total: 6 engineers

### Key deliverable

VENUE_OPERATOR can create a campaign, set its schedule, publish it, and see it playing on a Pi within 72h of publication (corpus delivery lead time). VENUE_OPERATOR can trigger, acknowledge, and clear an emergency — the emergency banner appears on all venue screens within 30 seconds of trigger.

### Operational readiness gate

- Successful end-to-end test for all 3 workflow types: campaign publish, override creation/expiry, emergency trigger/clear
- Compliance content enforcement verified: L1 content cannot be displaced by any campaign, override, or sponsorship
- 72h lead time enforcement verified: system rejects campaign scheduling with start_at < 72h from now
- Emergency trigger verified reachable in 2 actions from venue dashboard

---

## WAVE 4 — Player Hardening + Preview (Weeks 21–26)

### Prerequisites

Wave 3 complete. Campaign publish → corpus delivery → player sync cycle working end-to-end.

### What gets built

**Preview API (corpus-publisher / preview service):**
- `POST /preview/point-in-time` (P1) — resolves PRE.resolve() against a proposed corpus at a specified timestamp
- Returns playlist + explanation (resolution level, why, content sources)
- Preview checksum carries `PREVIEW:` prefix — structurally non-interchangeable with canonical checksums
- Preview records are not written to `replay_audit_records` — they are ephemeral

**Preview UX in cms-web:**
- Preview panel embedded in campaign editor
- Point-in-time preview: operator specifies date/time, sees resolved playlist for each screen in the venue
- Preview session: operator must explicitly confirm preview before campaign approval is enabled
- Approval gate linkage: campaign cannot be transitioned from REVIEW → APPROVED without a preview confirmation in the current session

**Approval gate enforcement:**
- API-level enforcement (not UI-only): `POST /campaigns/:id/approve` returns 422 if no preview confirmation exists for the current review session
- Preview confirmation token stored per campaign review session (expires when campaign leaves REVIEW state)

**player-runtime hardening:**
- `PRECircuitBreaker`: CLOSED/OPEN/HALF_OPEN; threshold=3; recovery_probe_ms=30000 (from `src/runtime/circuit-breakers/pre-circuit-breaker.ts`)
- `ReplayCircuitBreaker`: threshold=1; OPEN = CLASS_4 + ConstitutionalBreachLog
- 72h offline autonomy test: player must continue resolving playlists from local corpus for 72h with no network access, with no degradation in playlist output
- GRADE_A venue support: player-runtime detects presence of local CMS node (configured in corpus) and uses it preferentially for corpus sync and emergency signals

**Emergency push channel (WebSocket):**
- WebSocket gateway added to cms-api: players maintain a persistent WebSocket connection
- Emergency trigger pushes signal via Redis pub/sub → WebSocket gateway → all connected players in the venue
- Fallback: players that miss the WebSocket push pick it up on the next long-poll cycle (30s max latency)

**Mobile PWA v1:**
- Emergency trigger (VENUE_OPERATOR role) — 2 taps from PWA home screen
- Screen status list (online/offline/last-seen for each screen in the operator's venues)
- Entropy CRITICAL alerts with push notification via Service Worker
- iOS and Android tested

**Audit async batch:**
- Player-runtime switches from synchronous per-invocation audit send to background batch sync
- Batch: up to 100 records, sent every 5 minutes or when buffer reaches 80% capacity
- Non-blocking: PRE.resolve() loop does not wait for audit batch to complete
- Acknowledgment: replay-audit-api returns the count of successfully stored records; player tracks unacknowledged records in local buffer

### Staffing assumptions

| Role | Count |
|---|---|
| Backend Engineer | 2 |
| Edge Engineer | 1 |
| Frontend Engineer | 2 (includes mobile) |

Total: 5 engineers

### Key deliverable

Campaign approval requires preview confirmation from the approving principal. Emergency trigger works from mobile PWA. Player operates correctly for 72h without any CMS connectivity. Circuit breakers active and tested.

### Operational readiness gate

- 72h offline autonomy test passes in staging (player disconnected from network for 72h, then reconnected; audit records synced; no corpus degradation during offline period)
- Preview confirmation enforcement verified: API returns 422 on approve without preview
- Emergency via mobile PWA verified end-to-end (trigger → banner on screen within 30s)
- Circuit breaker tests pass: PRE circuit breaker trips on 3 consecutive failures, moves to HALF_OPEN after 30s

---

## WAVE 5 — Observability + Entropy (Weeks 27–32)

### Prerequisites

Wave 4 complete. Player hardening verified. Preview enforcement active.

### What gets built

**OpenTelemetry integration:**
- All services (cms-api, replay-audit-api, entropy-service, corpus-publisher) emit structured spans and metrics via OpenTelemetry SDK
- Metrics exported to Prometheus; traces to Jaeger or AWS X-Ray
- player-runtime emits structured JSON logs (pino) — no OTel SDK on edge (resource-constrained)

**Grafana dashboards:**
- **Constitutional state dashboard:** constitutional_state per enterprise (HEALTHY/DEGRADED/etc.), circuit breaker states for all 5 breakers, state transition events
- **Parity dashboard:** parity ratio (24h rolling, 7d rolling) per enterprise, divergence class breakdown, rollback trigger history
- **Entropy dashboard:** composite entropy score per venue, unacknowledged CRITICAL alerts count, entropy trend (7-day sparkline per venue)
- **Fleet health dashboard:** screen online/offline count, last heartbeat distribution, corpus version distribution across fleet

**Entropy scheduler:**
- Cloud-side entropy scheduler (runs in entropy-service):
  - Every 60 minutes: per-venue scan using latest player-reported metrics
  - Every 6 hours: fleet-wide scan across all venues in an enterprise
- Entropy score computation uses metric calculators M-01 through M-12 (from `src/entropy/`)
- Venue crosses advisory tier → alert event emitted to cms-api

**Entropy review UX:**
- Entropy reports inbox (VENUE_OPERATOR+): list of unacknowledged entropy reports sorted by severity
- Report detail: metric breakdown, affected screens, recommended action
- Acknowledgment workflow: operator acknowledges + optional note → `entropy_acknowledgments` row written
- Re-scan button: triggers an immediate venue entropy scan (bypasses the 60-minute schedule)
- Acknowledgment is a one-way transition — acknowledged reports cannot be un-acknowledged

**Alert routing:**
- CRITICAL alerts: push notification via mobile PWA + WebSocket alert banner in cms-web — delivered within 5 minutes of detection
- WARNING alerts: badge count in cms-web navigation + daily digest email
- ADVISORY alerts: visible in entropy inbox only — no push
- Alert deduplication: one alert per venue per 4 hours for the same `entropy_label` — prevents alert storms when a venue is in a persistent degraded state

### Staffing assumptions

| Role | Count |
|---|---|
| Backend Engineer | 1 |
| Frontend Engineer | 1 |
| DevOps | 1 (Grafana, Prometheus, OTel pipeline) |

Total: 3 engineers

### Key deliverable

VENUE_OPERATOR is notified of CRITICAL entropy within 5 minutes of detection. PLATFORM_ADMIN has a functioning circuit breaker dashboard. Fleet health is visible without querying the database directly.

### Operational readiness gate

- CRITICAL alert delivery time verified: inject a CRITICAL entropy condition in staging, measure time from detection to mobile push notification (target: <5 minutes)
- Entropy deduplication verified: same entropy condition does not produce more than 1 alert per venue per 4h
- Grafana dashboards reviewed and signed off by PLATFORM_ADMIN
- Alert routing verified for all 3 severity levels

---

## WAVE 6 — Shadow Governance (Weeks 33–40)

### Prerequisites

Wave 5 complete. At least 1 enterprise on the platform with 5 or more venues. Fleet health observable via Grafana.

### What gets built

**Shadow service:**
- `POST /parity/record` — stores parity comparison results from player-runtime during shadow stages
- `GET /parity/report/:enterprise_id` — current parity score (24h, 7d rolling)
- `GET /parity/rollback-triggers` — rollback trigger log for an enterprise
- `POST /shadow/enable/:venue_id` — ENTERPRISE_ADMIN enables shadow mode for a venue
- Parity records append-only in `parity_records` table
- CLASS_3/CLASS_4 divergence → event emitted to canary-service

**Canary service:**
- Stage state machine: SHADOW_ONLY → LIMITED_ROLLOUT → BROADER_ROLLOUT → FLEET_WIDE → AUTHORITATIVE
- `GET /canary/status/:enterprise_id` — current stage, gates, readiness report
- `POST /canary/advance` — requires ENTERPRISE_ADMIN + `human_approval_token` (non-empty string, minimum 8 chars) — the token is hashed and stored, never stored in plaintext
- `GET /canary/promotion-readiness/:enterprise_id` — parity score, gate check results, blocking reasons
- `POST /canary/rollback` — can be triggered by operator or by CLASS_3/CLASS_4 divergence event from shadow-service
- Stage advances are sequential — no jumps (enforced by `CANARY_STAGE_ORDER` from existing `src/shadow/`)
- Standalone venues (no parent enterprise): cannot participate in FLEET_WIDE canary without PLATFORM_ADMIN approval

**Shadow/canary UX in cms-web:**
- Parity dashboard: parity ratio trend chart (24h, 7d), divergence class breakdown table, rollback trigger history list
- Canary advancement wizard:
  - Current stage display with gate checklist (all gates must be green to advance)
  - Human approval token input field (token provided out-of-band by PLATFORM_ADMIN)
  - Confirmation dialog showing parity scores and gate results before submit
  - Rollback button with one-click execution and confirmation dialog
- Canary status visible to ENTERPRISE_ADMIN and PLATFORM_ADMIN; not visible to VENUE_OPERATOR

**Sponsorship proof-of-play reports:**
- Derived from `replay_audit_records` — not from screenshots or player-reported metrics
- Report: sponsorship contract ID, date range, screen_zone IDs, invocations where L4 resolved to sponsor content, estimated duration played
- Delivered as CSV export and in-app table in cms-web (ENTERPRISE_ADMIN+)
- Available to SPONSOR_STAKEHOLDER via sponsor portal (read-only)

**Sponsor portal:**
- Separate authenticated surface (SPONSOR_STAKEHOLDER role — no access to cms-web)
- Proof-of-play report list and CSV download
- Point-in-time preview (P1 only) for approved sponsor content
- Zero mutation authority, zero emergency authority, zero access to parity/entropy/audit data

**Multi-brand isolation:**
- Per-enterprise namespace enforcement verified in RLS
- Cross-enterprise query test suite expanded: 50 tests covering every RLS-protected table
- Agencies cannot self-extend authority above the scope granted by ENTERPRISE_ADMIN

### Staffing assumptions

| Role | Count |
|---|---|
| Backend Engineer | 3 (temporary addition for this wave) |
| Frontend Engineer | 1 |

Total: 4 engineers (3 backend is temporary — complexity of shadow + canary service)

### Key deliverable

First enterprise can execute a full canary rollout: SHADOW_ONLY → FLEET_WIDE → AUTHORITATIVE with all gate checks and human approval tokens at each advancement. Sponsors can access proof-of-play reports via the sponsor portal.

### Operational readiness gate

- Full canary stage sequence executed end-to-end in staging (all 5 stages, all human approval tokens, all gate checks)
- CLASS_3 divergence injection causes automatic rollback without human action (CLASS_3 rollback is automatic per constitution; re-advance requires human token)
- Sponsor portal security verification: SPONSOR_STAKEHOLDER cannot access any CMS endpoint, cannot trigger emergency, cannot read audit records
- Proof-of-play report verified against known audit records (spot-check 10 records)

---

## WAVE 7 — Enterprise Hardening (Weeks 41–52)

### Prerequisites

Wave 6 complete. First enterprise in AUTHORITATIVE canary stage.

### What gets built

**GlobalConstitutionalBreaker in production:**
- NORMAL → READ_ONLY → EMERGENCY_FREEZE state machine active in production (already implemented in `src/runtime/circuit-breakers/global-constitutional-breaker.ts` — this wave wires it to the production cloud infrastructure)
- EMERGENCY_FREEZE: only emergency endpoints writable; all other write endpoints return 423
- EMERGENCY_FREEZE exit wizard in PLATFORM_ADMIN console: requires PLATFORM_ADMIN to provide human authorization token + written justification
- `constitutional_freeze_log` written for every state transition (permanent retention)

**Post-incident review workflow:**
- Incident opened automatically when constitutional state enters DEGRADED or worse
- Incident fields: timeline of state transitions, circuit breaker events, operator actions taken, resolution
- PLATFORM_ADMIN must close the incident with a post-incident summary before the constitutional state can return to HEALTHY
- Incidents stored in `constitutional_freeze_log` (PERMANENT retention)

**Multi-enterprise onboarding:**
- Second enterprise onboarded with full provisioning workflow
- Onboarding checklist: enterprise creation, ENTERPRISE_ADMIN principal, corpus signing ceremony, pilot venue, 72h offline test, emergency drill, first corpus publish
- Cross-enterprise isolation verified: second enterprise cannot see first enterprise's data

**Training certification gating:**
- VENUE_OPERATOR role cannot be granted until the principal has completed the mandatory training modules
- Training completion tracked as a `role_prerequisite_satisfaction` record
- PLATFORM_ADMIN can waive training requirement with written justification (audit trail)

**Shift handover report generation:**
- VENUE_OPERATOR can generate a shift handover report for their venues
- Report includes: current corpus version, active overrides, active emergencies, unacknowledged entropy alerts, last 24h audit record count
- Available as PDF export and in-app display

**Golf marshal mobile surface:**
- Specialized PWA for golf course venue operators
- Lightning warning override: one-tap trigger for lightning warning content (pre-approved L1 override)
- Hole-by-hole screen status map (venue map with screen locations)
- Simplified interface — designed for outdoor use with bright sunlight legibility

**Conference zone content workflow:**
- Purpose-built workflow for hotel/resort conference venues
- Conference zone schedule: per-room scheduling with meeting name, start/end time, branding
- Room changeover content: "Room available" / "Meeting in progress" states
- Integration path documented for PMS (property management system) — not implemented in Wave 7, but the API contract is defined

**Disaster recovery plan execution test:**
- Full DR drill: simulate primary database failure, verify RDS replica promotion, verify services reconnect, verify audit chain continuity
- DR drill documented with timeline and issues found
- RTO target: <30 minutes to full operational state after failover

**Multi-region preparation (discovery, not implementation):**
- Identify which EU customers trigger GDPR data residency requirements
- Document the PostgreSQL partitioning strategy for regional data isolation (region prefix on enterprise_group_id)
- Identify which services need to be replicated per-region vs. which can remain single-region
- Deliver a multi-region architecture document and cost estimate — implementation in a future phase

### Staffing assumptions

| Role | Count |
|---|---|
| Backend Engineer | 2 (reduced from Wave 6 — complexity is lower in Wave 7) |
| Frontend Engineer | 1 |
| Mobile Engineer | 1 (golf marshal + conference zone UX) |
| DevOps | 1 (DR test, multi-region discovery) |
| Customer Success | 1 (second enterprise onboarding) |

Total: 6 engineers

### Key deliverable

Platform is constitutionally complete. Second enterprise onboarded with full provisioning. Disaster recovery drill completed. PLATFORM_ADMIN on-call rotation established. GlobalConstitutionalBreaker is active in production with the EMERGENCY_FREEZE exit wizard operational.

### Operational readiness gate

- GlobalConstitutionalBreaker EMERGENCY_FREEZE tested in staging: freeze triggered, freeze log written, exit wizard requires token, HEALTHY state verified after exit
- Second enterprise end-to-end: corpus publish → player sync → PRE resolve → audit → entropy → canary (SHADOW_ONLY minimum)
- DR drill completed with documented results and RTO measured
- On-call rotation documented with minimum 2 PLATFORM_ADMINs and defined SLA
- Training certification gating active: role grant blocked for uncertified principals

---

## Wave Dependency Summary

```
Wave 1 (DB + Runtime + Auth)
  └── Wave 2 (Replay + Signing + RLS)
        └── Wave 3 (CMS Core + Emergency)
              └── Wave 4 (Hardening + Preview)
                    └── Wave 5 (Observability + Entropy)
                          └── Wave 6 (Shadow + Canary + Sponsor Portal)
                                └── Wave 7 (Enterprise Hardening + DR)
```

Each wave is a strict prerequisite for the next. Attempting to run Wave 3 before Wave 2's RLS enforcement and audit chain verification is complete produces a system where tenant isolation is unverified and audit records have an incomplete chain — both are constitutional violations.
