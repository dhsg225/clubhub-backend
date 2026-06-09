# IMPLEMENTATION-ROADMAP-v1.md
# ClubHub TV — Engineering Execution Plan

**Status:** Active Reference
**Depends on:** BACKEND-ARCHITECTURE-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md
**Last updated:** 2026-05-16

---

## 0. Guiding Constraints

These constraints take precedence over all phase ordering decisions:

1. **The existing manifest endpoint (`GET /api/manifest/:screenId`) must remain operational throughout all phases.** No migration step may break a currently-deployed screen.
2. **PRE rollout is reversible until Phase 5 gate passes.** The feature flag `PRE_ENABLED` can be flipped to `false` to revert any screen to the legacy manifest engine at any time before that gate.
3. **No irreversible schema changes until shadow parity is confirmed.** Columns may be added freely. Columns may only be dropped after the old code path reading them is removed and a safe-drop migration has been held for one release cycle.
4. **Each phase is independently deployable.** No phase ships a partial feature that requires the next phase to be functional.
5. **All schema migrations run inside transactions.** Any migration that cannot be run inside a transaction (e.g., `CREATE INDEX CONCURRENTLY`) must be split into its own non-transactional migration file, documented explicitly, and run manually before the deployment that depends on it.

---

## 1. Phase Map

```
Phase 0 — Foundation Hardening        [prerequisite for all]
Phase 1 — Schema Extension            [sequential after Phase 0]
Phase 2 — PRE Core + Shadow Mode      [sequential after Phase 1]
Phase 3 — Operational Layer APIs      [can start after Phase 1]
Phase 4 — Campaign + Sponsorship      [sequential after Phase 3]
Phase 5 — PRE Cutover                 [sequential after Phase 2 + Phase 4]
Phase 6 — Legacy Cleanup              [sequential after Phase 5 gate]
```

Phases 2 and 3 may proceed in parallel once Phase 1 is complete.
Phase 4 requires Phase 3 APIs to be deployed.
Phase 5 requires Phase 2 shadow mode and Phase 4 to both be complete.
Phase 6 is the only phase that makes irreversible schema changes.

---

## 2. Phase 0 — Foundation Hardening

**Goal:** Make the existing codebase safe to extend without breaking running screens.

**Phase complete when:** All gates below pass. No feature work begins before this phase is complete.

### 2.1 Fix: Screen Auto-Registration Bug

**File:** `backend/src/lib/manifestEngine.js`
**Current behavior:** Unknown screens are silently auto-registered to `venue-1`.
**Required behavior:** Unknown screens insert with `status = 'unprovisioned'`, return system fallback manifest, emit `screen.discovered` event. No assignment to any venue.

This is the single highest-risk existing behavior. It must be corrected before any new provisioning logic is built on top of it.

**Change is backward-compatible:** Existing `screen-1` has `venue_id = 'venue-1'` and will not trigger this path.

### 2.2 Add: `status` Column to `screens`

```sql
-- Safe to add; existing rows default to 'active'
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'unprovisioned', 'maintenance'));
```

No index required yet. Added in Phase 1 migration batch.

### 2.3 Add: Structured Logging

The manifest engine currently has no structured log output. Before extending it, add a structured logger (`pino` or equivalent) with the following fields on every manifest computation:

```
screen_id, version, checksum, computed_at, duration_ms, item_count,
cache_hit: bool, reason: string
```

This is required for shadow-mode comparison in Phase 2.

### 2.4 Add: Manifest Computation Metrics

Expose a `GET /internal/metrics` endpoint (not public-facing) that reports:

- `manifest_compute_total` — counter by screen_id
- `manifest_compute_duration_ms` — histogram
- `manifest_cache_hit_ratio` — gauge
- `manifest_errors_total` — counter by error type

These metrics are the baseline against which PRE performance will be compared in Phase 5.

### 2.5 Harden: `manifest_cache` Version Integrity

The existing `manifest_cache` table stores `version` but the `screen_versions` table defined in BACKEND-ARCHITECTURE-v1.md does not yet exist. This creates a risk of version counter divergence across restarts.

Add a `screen_versions` table now (migrate_002b or as part of Phase 1 migration batch):

```sql
CREATE TABLE IF NOT EXISTS screen_versions (
  screen_id   VARCHAR(100) PRIMARY KEY REFERENCES screens(id) ON DELETE CASCADE,
  version     INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Backfill from existing manifest_cache
INSERT INTO screen_versions (screen_id, version, updated_at)
SELECT screen_id, version, computed_at FROM manifest_cache
ON CONFLICT (screen_id) DO NOTHING;
```

### 2.6 Phase 0 Acceptance Gates

| Gate | Verification |
|------|-------------|
| Auto-registration bug removed | Deploy to staging; register unknown screen ID; confirm `status='unprovisioned'` and fallback manifest returned |
| Structured logging present | Parse log output for all required fields on manifest fetch |
| Metrics endpoint live | `GET /internal/metrics` returns valid Prometheus text format |
| `screen_versions` backfilled | `SELECT count(*) FROM screen_versions` equals `SELECT count(*) FROM manifest_cache` |
| All existing integration tests pass | `npm test` green |

---

## 3. Phase 1 — Schema Extension

**Goal:** Add all new tables defined in BACKEND-ARCHITECTURE-v1.md (migrate_003 through migrate_006). No application logic changes. Schema must be backward-compatible: all new columns on existing tables must be nullable or have safe defaults.

**Depends on:** Phase 0 complete.
**May run in parallel with:** Nothing (schema is shared infrastructure).

### 3.1 Migration Execution Order

Migrations must be applied in strict sequence. Each migration file is independently transactional except where noted.

**migrate_003.sql — Org + Area + TV Group hierarchy**
```sql
BEGIN;

CREATE TABLE organizations (
  id         VARCHAR(100) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  timezone   VARCHAR(100) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO organizations (id, name, timezone)
VALUES ('org-default', 'Default Organization', 'UTC')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE areas (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    VARCHAR(100) NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(100),
  tags        TEXT[]       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE tv_groups (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id    UUID         NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Extend existing tables (all nullable/defaulted — backward safe)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS org_id VARCHAR(100) REFERENCES organizations(id);

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS area_id   UUID REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS group_id  UUID REFERENCES tv_groups(id);

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS area_id   UUID REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS group_id  UUID REFERENCES tv_groups(id),
  ADD COLUMN IF NOT EXISTS org_id    VARCHAR(100) REFERENCES organizations(id);

-- Backfill org_id on default venue
UPDATE venues SET org_id = 'org-default' WHERE id = 'venue-1';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_screens_area    ON screens(area_id);
CREATE INDEX IF NOT EXISTS idx_screens_group   ON screens(group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_area  ON schedules(area_id);
CREATE INDEX IF NOT EXISTS idx_schedules_group ON schedules(group_id);

COMMIT;
```

**migrate_004.sql — Campaigns**
```sql
BEGIN;

CREATE TABLE campaigns (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        VARCHAR(100) NOT NULL REFERENCES organizations(id),
  name          VARCHAR(255) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'review', 'published', 'archived')),
  is_mandatory  BOOLEAN      NOT NULL DEFAULT FALSE,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  published_at  TIMESTAMPTZ,
  created_by    VARCHAR(255)
);

CREATE TABLE campaign_content_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id  UUID    NOT NULL REFERENCES content(id)   ON DELETE CASCADE,
  weight      INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  duration_ms INTEGER NOT NULL DEFAULT 10000,
  sequence    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE campaign_schedules (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  target_type    VARCHAR(20)  NOT NULL CHECK (target_type IN ('org','venue','area','group','screen')),
  target_id      VARCHAR(255) NOT NULL,
  days_of_week   INTEGER[],
  time_of_day_start TIME,
  time_of_day_end   TIME,
  priority       INTEGER      NOT NULL DEFAULT 10
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org    ON campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS idx_camp_sched_target ON campaign_schedules(target_type, target_id);

COMMIT;
```

**migrate_005.sql — Overrides + Emergency**
```sql
BEGIN;

CREATE TABLE overrides (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  VARCHAR(20)  NOT NULL CHECK (target_type IN ('screen','group','area','venue','org')),
  target_id    VARCHAR(255) NOT NULL,
  content_id   UUID         NOT NULL REFERENCES content(id),
  issued_by    VARCHAR(255) NOT NULL,
  issued_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  reason       TEXT,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'expired', 'cancelled'))
);

CREATE TABLE emergency_states (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type   VARCHAR(20)  NOT NULL CHECK (scope_type IN ('screen','venue','org','global')),
  scope_id     VARCHAR(255) NOT NULL,
  content_id   UUID         REFERENCES content(id),
  activated_by VARCHAR(255) NOT NULL,
  activated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  cleared_at   TIMESTAMPTZ,
  cleared_by   VARCHAR(255),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_active
  ON emergency_states(scope_type, scope_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_overrides_active
  ON overrides(target_type, target_id, status, expires_at)
  WHERE status = 'active';

COMMIT;
```

**migrate_006.sql — Sponsorship + Delivery Log + Audit**
```sql
BEGIN;

CREATE TABLE sponsorship_contracts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           VARCHAR(100) NOT NULL REFERENCES organizations(id),
  sponsor_name     VARCHAR(255) NOT NULL,
  content_id       UUID         NOT NULL REFERENCES content(id),
  share_of_voice   NUMERIC(5,2) NOT NULL CHECK (share_of_voice > 0 AND share_of_voice <= 100),
  category         VARCHAR(100),
  is_exclusive     BOOLEAN      NOT NULL DEFAULT FALSE,
  target_type      VARCHAR(20)  CHECK (target_type IN ('org','venue','area','group','screen')),
  target_id        VARCHAR(255),
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE screen_delivery_log (
  id          BIGSERIAL    PRIMARY KEY,
  screen_id   VARCHAR(100) NOT NULL REFERENCES screens(id),
  content_id  UUID         NOT NULL REFERENCES content(id),
  manifest_version INTEGER NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  checksum    VARCHAR(16)
);

CREATE INDEX IF NOT EXISTS idx_delivery_screen_time
  ON screen_delivery_log(screen_id, delivered_at DESC);

CREATE TABLE audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   VARCHAR(255) NOT NULL,
  action      VARCHAR(50)  NOT NULL,
  actor       VARCHAR(255),
  payload     JSONB,
  occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id, occurred_at DESC);

CREATE TABLE event_bus (
  id          BIGSERIAL    PRIMARY KEY,
  event_type  VARCHAR(100) NOT NULL,
  payload     JSONB        NOT NULL,
  occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed   BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_event_bus_unprocessed
  ON event_bus(occurred_at)
  WHERE processed = FALSE;

COMMIT;
```

### 3.2 Migration Safety Rules

- Migrations 003–006 may be applied independently to a running system with no code changes required.
- Applying these migrations does not change any existing query behavior.
- Rollback: All new tables can be dropped. All `ADD COLUMN` operations can be reversed with `DROP COLUMN`. No data destruction.
- Do not run these on production until Phase 0 gates pass.

### 3.3 Phase 1 Acceptance Gates

| Gate | Verification |
|------|-------------|
| All migrations apply cleanly | `psql -f migrate_003.sql && ... migrate_006.sql` with no errors on staging DB |
| Existing manifest endpoint unaffected | `GET /api/manifest/screen-1` returns identical response before and after migration |
| No orphaned foreign keys | Run referential integrity check query post-migration |
| Rollback validated | Apply migrations, roll them back, confirm original schema restored |

---

## 4. Phase 2 — PRE Core + Shadow Mode

**Goal:** Implement the PRE as defined in PRE-REFERENCE-IMPLEMENTATION-v1.md as a separate code path. Run it in shadow mode alongside the legacy manifest engine. Validate parity before any screen is switched.

**Depends on:** Phase 1 complete.
**May run in parallel with:** Phase 3.

### 4.1 Module Boundaries

The PRE is a new module: `backend/src/lib/pre/index.js`.

Internal structure:
```
backend/src/lib/pre/
  index.js              ← PRE.resolve() public entry point
  context.js            ← buildContext() — assembles SystemState from DB
  levels/
    emergency.js        ← Level 0
    override.js         ← Level 1+2
    campaign.js         ← Level 3
    sponsorship.js      ← Level 4
    structural.js       ← Level 5
    deviceTruth.js      ← Level 6
  algorithms/
    swrr.js             ← smoothWeightedRoundRobin()
    checksum.js         ← computeChecksum() + canonicalJson()
    schedule.js         ← scheduleActive() + midnight-crossing logic
    confidence.js       ← computeConfidence()
  fallback.js           ← systemFallback() — all fallback states
  invariants.js         ← runtime invariant assertions (test/dev only)
```

**The PRE module has no side effects.** It does not write to any table. It does not emit events. It does not mutate any passed-in object. All cache writes, event emissions, and version increments remain in the manifest engine layer that calls it.

### 4.2 Feature Flag

```js
// backend/src/config.js
PRE_ENABLED: process.env.PRE_ENABLED === 'true',          // master switch
PRE_SHADOW_MODE: process.env.PRE_SHADOW_MODE === 'true',  // shadow without serving
PRE_SHADOW_LOG_DIVERGENCE: process.env.PRE_SHADOW_LOG_DIVERGENCE === 'true',
```

When `PRE_SHADOW_MODE=true`: both legacy and PRE execute on every manifest request. PRE output is discarded. Divergences are logged with full diff to structured log. The manifest served to the screen is always the legacy output.

When `PRE_ENABLED=true` and `PRE_SHADOW_MODE=false`: PRE output is served. Legacy engine still runs if `PRE_SHADOW_LOG_DIVERGENCE=true`, for comparison.

### 4.3 Shadow Mode Integration Point

```js
// In manifestEngine.js getManifest():

const legacy = computeLegacyManifest(screenId);

if (config.PRE_SHADOW_MODE || config.PRE_ENABLED) {
  const preResult = PRE.resolve(screenId, Date.now(), await buildContext(screenId));
  if (config.PRE_SHADOW_MODE) {
    compareShadow(legacy, preResult); // log divergence, discard PRE result
    return legacy;
  }
  return preResult; // PRE_ENABLED=true, shadow=false
}

return legacy;
```

### 4.4 Shadow Divergence Logging

A divergence is any difference between legacy output and PRE output for the same `screen_id` at the same `t`. Log fields:

```json
{
  "event": "pre_shadow_divergence",
  "screen_id": "...",
  "at": "...",
  "legacy_checksum": "...",
  "pre_checksum": "...",
  "legacy_item_count": 3,
  "pre_item_count": 3,
  "legacy_reason": "...",
  "pre_reason": "...",
  "diff": { "added": [], "removed": [], "changed": [] }
}
```

Divergences are expected during Phase 2. They are the signal that drives resolution. A zero-divergence rate over 48 hours on a representative screen set is the gate for Phase 5.

### 4.5 PRE Unit Test Suite

The PRE fixture test suite is defined before any PRE code is written (test-first). Tests consume the checksum test vectors and edge case definitions from PRE-REFERENCE-IMPLEMENTATION-v1.md.

**Required test categories:**

| Category | Minimum Test Count |
|----------|--------------------|
| Checksum test vectors (Appendix B of PRE-REFERENCE-IMPLEMENTATION-v1) | All vectors must pass exactly |
| `scheduleActive()` — standard, midnight-crossing, DST gap, DST overlap | 12 |
| SWRR determinism — same input always produces same output | 8 |
| SWRR interleaving — correct proportionality for weight sets | 6 |
| Emergency absolute override | 4 |
| Override level 1 vs level 2 termination semantics | 6 |
| Specificity ordering — screen > group > area > venue > org | 5 |
| Sponsorship injection saturation block at 60% | 4 |
| Confidence score — all edge cases in EC-12 through EC-14 | 6 |
| Fallback totality — PRE never throws, always returns valid output | 10 (fuzz with missing fields) |
| Forbidden states — verify none are reachable via public API | 10 |
| INV-3 determinism — identical inputs produce byte-identical outputs | 5 |

### 4.6 Phase 2 Acceptance Gates

| Gate | Verification |
|------|-------------|
| All PRE unit tests pass | `npm test -- --grep pre` green |
| Checksum test vectors pass exactly | Automated comparison against Appendix B |
| Shadow mode deployed to staging | `PRE_SHADOW_MODE=true` running against staging screens |
| Zero exceptions from PRE in shadow mode over 24h | Log scan for `pre_error` events |
| Shadow divergence rate explained | Every divergence category has a documented root cause |
| PRE rollback confirmed | Set `PRE_SHADOW_MODE=false`; confirm legacy-only manifest served |

---

## 5. Phase 3 — Operational Layer APIs

**Goal:** Implement CRUD APIs for the new hierarchy entities (Organization, Area, TV Group) and new operational actions (Override, Emergency). The manifest endpoint is not yet affected.

**Depends on:** Phase 1 complete.
**May run in parallel with:** Phase 2.

### 5.1 New Route Files

```
backend/src/routes/organizations.js   GET, POST, PATCH /:id
backend/src/routes/areas.js           GET, POST, PATCH /:id, DELETE /:id
backend/src/routes/tvGroups.js        GET, POST, PATCH /:id, DELETE /:id
backend/src/routes/overrides.js       GET, POST, DELETE /:id
backend/src/routes/emergency.js       POST /activate, POST /clear
backend/src/routes/provisioning.js    POST /claim, GET /pending
```

### 5.2 Override API Contract

```
POST /api/overrides
Body: { target_type, target_id, content_id, expires_at?, reason? }
Response: { id, target_type, target_id, issued_at, expires_at, status }

DELETE /api/overrides/:id
Response: 204

GET /api/overrides?target_type=area&target_id=:id&status=active
Response: [{ ...override }]
```

Override write path must:
1. Insert row into `overrides` table
2. Resolve target to affected `screen_id` list
3. Invalidate `manifest_cache` for each affected screen
4. Publish `NOTIFY manifest_invalidated` for each screen_id

### 5.3 Emergency API Contract

```
POST /api/emergency/activate
Body: { scope_type, scope_id, content_id?, reason }
Response: { id, activated_at, scope_type, scope_id, affected_screens: [] }

POST /api/emergency/clear
Body: { emergency_id }
Response: { cleared_at, affected_screens: [] }
```

Emergency activate must:
1. Insert `emergency_states` row
2. Synchronously bust cache for ALL affected screens before returning HTTP 200
3. Return list of affected screen IDs in response

Emergency clear must:
1. Set `is_active = false`, `cleared_at = NOW()`
2. Synchronously bust cache for ALL affected screens
3. PRE recomputes using current time — not time of activation

### 5.4 Screen Provisioning Flow

```
POST /api/provisioning/claim
Body: { screen_id, venue_id, area_id?, group_id?, name? }
Response: { screen_id, status: 'active', manifest_url }
```

Only screens with `status = 'unprovisioned'` may be claimed. Claiming sets `status = 'active'` and triggers manifest computation.

### 5.5 Cache Invalidation Cascade

When an Area is updated (e.g., schedule added to area):
1. Query all `screen_id` WHERE `area_id = :id`
2. For each screen_id: delete `manifest_cache` row, increment `screen_versions`
3. Publish `NOTIFY manifest_invalidated` for each

This cascade must be an internal function shared by all mutation paths. It must not be inlined per-route.

### 5.6 Phase 3 Acceptance Gates

| Gate | Verification |
|------|-------------|
| All new routes return correct responses | Integration tests covering all endpoints |
| Override creation triggers cache bust | Confirm manifest version increments on override creation |
| Emergency activate busts cache synchronously | Time `POST /emergency/activate`; confirm manifest recomputed before response returns |
| Emergency clear recomputes at current time | Activate emergency at T0, clear at T1; confirm manifest reflects T1 state, not T0 |
| Provisioning claim flow end-to-end | Register unknown screen, confirm unprovisioned, claim it, confirm manifest served |

---

## 6. Phase 4 — Campaign + Sponsorship Layer

**Goal:** Implement the Campaign and Sponsorship subsystems as defined in BACKEND-ARCHITECTURE-v1.md. These are the most complex write paths. They do not affect manifest serving until Phase 5.

**Depends on:** Phase 3 complete (requires Area + Org APIs as targeting primitives).
**Must complete before:** Phase 5.

### 6.1 Campaign Lifecycle

Campaign state machine transitions are strictly enforced:

```
draft → review → published → archived
draft → archived          (discard without review)
published → archived      (end of run)
```

No other transitions are permitted. The `status` column has a CHECK constraint. Application code must not bypass it.

**Publish action side effects:**
1. Set `published_at = NOW()`
2. Materialize `campaign_schedules` rows into `schedules` table with `campaign_id` foreign key
3. Resolve target entities to screen sets
4. Invalidate manifest cache for all affected screens
5. Write audit log entry

**Draft/publish is not the same as an override.** Campaign publish goes through the state machine. Overrides are immediate and bypass the state machine entirely.

### 6.2 Sponsorship Saturation Enforcement

The `SponsorshipEngine` module enforces:

- **Warning threshold:** 60% share-of-voice consumed across all active contracts on a target
- **Block threshold:** 80% share-of-voice consumed (new contract creation returns 409)

These thresholds are defined as environment constants `SOV_WARNING_THRESHOLD=0.60` and `SOV_BLOCK_THRESHOLD=0.80`. They are not hardcoded in application logic.

Exclusivity enforcement: if `is_exclusive = true` and `category` is set, no other contract with the same `category` may be active on the same target scope during the same time window.

### 6.3 Proof-of-Play Model

Three-signal model:

| Signal | Source | Written to |
|--------|--------|-----------|
| `scheduled` | Campaign publish materialization | `screen_delivery_log.delivered_at = NULL` |
| `delivered` | Screen polls `GET /api/manifest/:id` | `screen_delivery_log.delivered_at = NOW()` |
| `confirmed` | Screen polls again with matching checksum header | `screen_delivery_log.confirmed_at = NOW()` |

The delivery log write on manifest poll must be non-blocking (fire-and-forget async insert). It must not add latency to the manifest hot path.

### 6.4 Phase 4 Acceptance Gates

| Gate | Verification |
|------|-------------|
| Campaign draft→publish cycle completes | Create campaign, publish it, confirm `schedules` rows materialized |
| Published campaign invalidates cache | Confirm manifest version increments on campaign publish |
| Sponsorship SOV block enforced | Attempt to create contract exceeding SOV_BLOCK_THRESHOLD; confirm 409 |
| Exclusivity conflict rejected | Attempt to create two exclusive contracts same category same target; confirm 409 |
| Proof-of-play delivery signal written | Poll manifest; confirm `screen_delivery_log` row created |
| Proof-of-play confirmed signal written | Poll manifest twice with matching checksum; confirm `confirmed_at` set |

---

## 7. Phase 5 — PRE Cutover

**Goal:** Switch manifest serving from the legacy engine to the PRE. This is the most critical phase. It is gated by shadow-mode parity, not by calendar.

**Depends on:** Phase 2 (shadow mode running), Phase 4 (campaign/sponsorship data available for resolution) both complete.

### 7.1 Cutover Sequence

Cutover is per-screen, not global. The `screens` table gains a `pre_enabled` boolean column:

```sql
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS pre_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

Manifest resolution checks:
1. If `PRE_ENABLED=false` (global flag): always use legacy
2. If `PRE_ENABLED=true` and `screen.pre_enabled=false`: use legacy
3. If `PRE_ENABLED=true` and `screen.pre_enabled=true`: use PRE

This allows canary rollout to a subset of screens before full cutover.

### 7.2 Canary Rollout

**Step 1 — Internal screens only:** Enable PRE on screens known to be internal test screens. Run for 48 hours. Zero divergence required.

**Step 2 — 10% of production screens:** Select by random sample across venue types. Run for 48 hours. Monitor:
- Manifest error rate (target: identical to baseline)
- Manifest compute duration p99 (target: ≤ baseline + 20%)
- Screen poll frequency deviation (screens should continue polling at normal interval)
- Any `is_fallback = true` responses (target: ≤ baseline rate)

**Step 3 — 50% of production screens:** Run for 24 hours with same monitors.

**Step 4 — 100% of production screens:** Full cutover.

### 7.3 Rollback Procedure

At any canary step, rollback is:
```sql
UPDATE screens SET pre_enabled = FALSE WHERE pre_enabled = TRUE;
```
Or set `PRE_ENABLED=false` as an environment variable and restart the process to immediately revert all screens.

Rollback does not require a schema change. Rollback does not require a deployment. It is a config change.

### 7.4 Irreversibility Point

Phase 5 is declared complete — and rollback is retired — when:
- 100% of screens have been on PRE for 7 consecutive days
- Zero production incidents attributable to PRE behavior
- Proof-of-play metrics show no regression in delivery confirmation rate
- p99 manifest compute latency is within 20% of pre-PRE baseline

Once this gate passes, the feature flag `PRE_ENABLED` is removed from config and the legacy manifest engine code is marked for deletion in Phase 6.

### 7.5 Phase 5 Acceptance Gates

| Gate | Verification |
|------|-------------|
| Zero-divergence shadow mode for 48h | Log scan: no `pre_shadow_divergence` events on canary screens |
| Canary Step 1–4 complete | Each step must complete its monitoring window without incident |
| Manifest error rate unchanged | Compare 7-day rolling average before and after cutover |
| p99 latency within 20% of baseline | Compare `manifest_compute_duration_ms` histogram |
| Fallback rate unchanged | Compare `is_fallback = true` rate before/after |
| 7-day clean run | No incidents, no rollbacks, no manual interventions |

---

## 8. Phase 6 — Legacy Cleanup

**Goal:** Remove the legacy manifest engine, dead feature flag code, and columns made redundant by the new schema. This phase makes irreversible changes.

**Depends on:** Phase 5 gate passed and declared complete.
**This phase is not time-sensitive.** It should not be rushed.

### 8.1 Code Deletions

In order:
1. Remove `PRE_ENABLED`, `PRE_SHADOW_MODE`, `PRE_SHADOW_LOG_DIVERGENCE` config flags
2. Remove `compareShadow()` function and shadow dispatch logic from manifest engine
3. Remove legacy `computeManifest()` function body (keep filename, refactor to thin wrapper over PRE)
4. Remove `pre_enabled` column toggle logic (PRE is now always used)

### 8.2 Schema Cleanup — Safe Drop Sequence

No column may be dropped until:
- The code reading that column has been removed and deployed
- That deployment has been stable for one full release cycle (minimum 2 weeks)

Columns eligible for removal post-Phase-6:

```sql
-- Only after confirming screens.screen_group is unused in all queries:
ALTER TABLE screens DROP COLUMN IF EXISTS screen_group;

-- Only after confirming schedules.screen_group is unused:
ALTER TABLE schedules DROP COLUMN IF EXISTS screen_group;

-- Only after confirming pre_enabled toggle logic is removed:
ALTER TABLE screens DROP COLUMN IF EXISTS pre_enabled;
```

These are three separate migrations. They are not bundled. Each requires a manual "safe to drop" review before execution.

### 8.3 Phase 6 Acceptance Gates

| Gate | Verification |
|------|-------------|
| No references to deleted code in codebase | `grep -r 'computeLegacyManifest\|PRE_SHADOW_MODE\|compareShadow'` returns empty |
| Safe drop migrations applied | Confirm columns removed from schema |
| All integration tests still pass | `npm test` green after deletions |
| Manifest endpoint behavior unchanged | Regression test suite passes |

---

## 9. Build Order Dependencies (Canonical)

```
Phase 0 ──────────────────────────────────┐
                                           ▼
Phase 1 ──────────┬───────────────────────┤
                  │                        │
           Phase 2 (shadow)         Phase 3 (APIs)
                  │                        │
                  │                  Phase 4 (campaigns)
                  │                        │
                  └──────────┬─────────────┘
                             ▼
                       Phase 5 (cutover)
                             │
                             ▼
                       Phase 6 (cleanup)
```

**What is safe to parallelize:** Phase 2 and Phase 3 may run in parallel. Teams or engineers with different focus areas may independently progress these phases after Phase 1 is complete.

**What must be sequential:** Phase 0 → Phase 1 is strictly sequential. Phase 5 may not begin until both Phase 2 shadow-mode parity AND Phase 4 feature completeness are confirmed. Phase 6 may not begin until Phase 5 gate is declared.

---

## 10. Feature Flag Strategy

| Flag | Type | Purpose | Retirement Phase |
|------|------|---------|-----------------|
| `PRE_ENABLED` | env bool | Master switch for PRE code path | Phase 6 |
| `PRE_SHADOW_MODE` | env bool | Run PRE but serve legacy | Phase 5 |
| `PRE_SHADOW_LOG_DIVERGENCE` | env bool | Log divergence after cutover | Phase 6 |
| `screens.pre_enabled` | DB column | Per-screen canary toggle | Phase 6 |

No other feature flags are introduced. Feature flags are not a substitute for phased migration. Code paths guarded by feature flags must be removed when the flag is retired. A feature flag that is never removed is technical debt.

---

## 11. Backward Compatibility Rules

### 11.1 API Compatibility

The following endpoints must not change their response shape during any phase:

- `GET /api/manifest/:screenId` — response schema is frozen. New fields may be added. Existing fields may not be removed or renamed.
- `GET /api/schedules` — existing pagination and filter behavior preserved.
- `POST /api/schedules` — existing validation rules preserved (minimum 3s duration, days_of_week [0-6]).

### 11.2 Schema Compatibility

- Adding a column: always safe, requires `DEFAULT` or `NULLABLE`.
- Renaming a column: never safe. Add new column, migrate data, drop old column in separate phases.
- Changing a column type: never safe without a parallel-column migration.
- Dropping a column: only in Phase 6, only after confirming zero references.
- Adding a NOT NULL constraint to an existing column: only after backfilling all NULL values.

### 11.3 Manifest Format Compatibility

The manifest JSON served to screens has a `version` integer field. The PRE manifest output must be consumable by existing screen firmware. The PRE may add new fields to the manifest object. It may not remove or rename existing fields until a screen firmware update that ignores unknown fields has been deployed to all screens and confirmed.

---

## 12. Test Strategy

### 12.1 Test Categories and Ownership

| Category | Framework | When to Run | Owner |
|----------|-----------|-------------|-------|
| PRE unit tests | Jest | Every commit | CI |
| PRE fixture tests (deterministic vectors) | Jest | Every commit | CI |
| Manifest engine integration tests | Jest + real PG | Every commit | CI |
| API integration tests | supertest | Every commit | CI |
| Shadow divergence analysis | Manual + log analysis | Phase 2 | Engineer |
| Canary monitoring | Metrics + alerting | Phase 5 | Engineer |
| Chaos / failure injection | Custom harness | Phase 5 pre-gate | Engineer |
| Performance benchmark | k6 | Phase 5 pre-gate | Engineer |

### 12.2 Deterministic PRE Fixture Testing

The PRE is a pure function. Every test case is a tuple of `(input_state, expected_output)`. Test inputs and expected outputs are defined as JSON fixtures in `backend/test/fixtures/pre/`.

Required fixture sets:
- `emergency_override.json` — 4 scenarios
- `operational_override.json` — 6 scenarios
- `scheduled_override.json` — 4 scenarios
- `campaign_resolution.json` — 8 scenarios (including mandatory campaign)
- `sponsorship_injection.json` — 6 scenarios (including saturation block)
- `structural_resolution.json` — 10 scenarios (specificity ordering)
- `device_truth.json` — 6 scenarios (confidence score calculation)
- `fallback_states.json` — 10 scenarios (all system fallback triggers)
- `dst_handling.json` — 4 scenarios (spring forward, fall back)
- `midnight_crossing.json` — 4 scenarios

Fixtures are immutable reference data. They are committed to the repository and never auto-generated. Any change to a fixture requires a comment explaining why the expected output changed.

### 12.3 Failure Injection Testing

Before Phase 5 cutover, the following failure modes must be tested on staging:

| Failure | Expected Behavior | Test Method |
|---------|-------------------|-------------|
| Database unavailable | PRE returns last cached manifest; no crash | Kill DB container mid-request |
| `manifest_cache` row missing | PRE recomputes and writes new cache entry | Delete cache row, poll manifest |
| `screen_versions` row missing | Insert with version=1, continue | Delete versions row, poll manifest |
| Empty content library | PRE returns `CONTENT_UNAVAILABLE` fallback | Remove all schedules for screen |
| Corrupt `campaign_schedules` row | PRE skips corrupt row, logs error, continues | Insert row with invalid data |
| Emergency state with no content_id | PRE returns `EMERGENCY_NO_CONTENT` fallback | Activate emergency with null content |
| Clock skew (NTP drift) | Schedule evaluation uses server clock; documented limitation | Manually offset system clock |

---

## 13. Performance Benchmarking Plan

### 13.1 Baseline (Pre-PRE)

Capture during Phase 0:
- `manifest_compute_duration_ms` p50, p95, p99
- `manifest_cache_hit_ratio`
- Database query count per manifest request
- Memory usage during sustained load (1000 req/min for 10 minutes)

### 13.2 PRE Shadow Mode Benchmark

Run during Phase 2 with shadow mode enabled:
- Compare total request latency (legacy + PRE running in parallel)
- Identify PRE overhead vs. legacy
- Profile hot paths in `buildContext()` — this is the expected bottleneck

### 13.3 PRE Standalone Benchmark

After shadow mode validated:
- k6 load test: 500 concurrent screen polls, 5 minutes sustained
- Acceptance thresholds:
  - p99 manifest latency ≤ 200ms (or ≤ legacy p99 + 20%, whichever is higher)
  - Zero 5xx responses
  - Cache hit ratio ≥ 95%
  - No memory growth over sustained run (detect leaks)

### 13.4 Production Metrics to Observe Before Phase Advance

| Metric | Threshold | Observation Window |
|--------|-----------|-------------------|
| Manifest error rate | ≤ 0.1% | 24h |
| p99 manifest latency | ≤ baseline + 20% | 24h |
| `is_fallback` rate | ≤ baseline | 24h |
| Screen poll interval deviation | ≤ ±5% of expected | 24h |
| DB connection pool exhaustion events | 0 | 24h |

---

## 14. Rollback Strategy

### 14.1 Phase-Specific Rollback

| Phase | Rollback Action | Reversible? |
|-------|----------------|-------------|
| Phase 0 | Revert code changes; DB changes are additive | Yes |
| Phase 1 | Drop new tables (no data loss on new tables); revert ALTER COLUMNs | Yes |
| Phase 2 | Set `PRE_SHADOW_MODE=false`; PRE code inert | Yes |
| Phase 3 | Remove new routes; DB rows persist but are unused | Yes |
| Phase 4 | Archive campaigns; DB rows persist but uninvoked | Yes |
| Phase 5 (canary) | `UPDATE screens SET pre_enabled=FALSE` or `PRE_ENABLED=false` | Yes |
| Phase 5 (post-gate) | PRE rollback retired; rollback requires Phase 6 reversal | No |
| Phase 6 | Schema drop is irreversible | No |

### 14.2 Rollback Decision Authority

Rollback decisions for Phases 0–4 may be made unilaterally by the on-call engineer.

Phase 5 canary rollback: may be made unilaterally.

Phase 5 gate declaration (and thus retirement of rollback): requires explicit sign-off, not automated.

Phase 6 is irreversible. It may only proceed after Phase 5 gate sign-off.

---

## 15. Risk Containment Strategy

### 15.1 High-Severity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| PRE non-determinism causes checksum churn | Medium | High — screens constantly reload | PRE fixture test suite; shadow divergence monitoring |
| Cache invalidation cascade causes thundering herd | Medium | High — DB overload | Async invalidation queue; per-screen staggered delay |
| Emergency clear restores wrong state | Low | High — wrong content after emergency | PRE uses `time_of_restore`, not `time_of_activation`; tested explicitly |
| Schema migration locks table during peak hours | Low | Medium — manifest latency spike | Run migrations during low-traffic window; use `CONCURRENTLY` for indexes |
| Sponsorship SOV calculation race condition | Medium | Medium — over-serving sponsor | Advisory lock on SOV calculation; idempotent contract creation |
| Screen auto-registration assigns to wrong org | High (current bug) | High | Phase 0 fix: quarantine before assignment |

### 15.2 Semantic Drift Prevention

The PRE-REFERENCE-IMPLEMENTATION-v1.md is the source of truth for PRE behavior. Any discrepancy between the implementation and the spec is a bug in the implementation, not the spec. The spec may only be changed through a formal revision process (version increment, change log entry, review).

If an engineer believes the spec is wrong, they must open a spec revision before changing the code. Code must not diverge from spec silently.

The fixture tests are the mechanical enforcement of this rule.

---

## 16. Technical Debt Containment Rules

The following rules apply for the duration of this migration. They are not permanent conventions — they are migration-period safety constraints.

1. **No new columns on `schedules` until Phase 5 is complete.** The schedules table is the most load-bearing table during migration. Schema changes to it carry the highest risk.

2. **No new resolution levels in the PRE until Phase 5 gate is passed.** Adding a new level changes PRE semantics. Shadow divergences from a new level cannot be distinguished from bugs.

3. **No changes to the manifest JSON response schema until screen firmware compatibility is confirmed.** Adding fields is allowed. Renaming or removing fields is blocked.

4. **No changes to `computeChecksum()` algorithm until Phase 6.** The checksum is used for proof-of-play confirmation. Changing the algorithm invalidates all in-flight delivery confirmations.

5. **The legacy manifest engine code must not be modified after Phase 2 begins.** It is the reference baseline for shadow comparison. Changes to it invalidate accumulated shadow data.

6. **`invariants.js` assertions must run in test and staging environments.** They may be disabled in production for performance, but the disable flag must be explicit and logged at startup.

---

## 17. Refactor Boundaries

The following refactors are **permitted** during this migration period (they do not change semantics):

- Extracting helper functions within a module (no behavior change)
- Adding structured logging to existing functions
- Adding metrics instrumentation
- Moving code between files within the same module boundary
- Replacing raw SQL strings with parameterized query builders (must produce identical SQL)

The following refactors are **prohibited** until Phase 6:

- Renaming public module exports
- Changing function signatures of `getManifest()`, `computeManifest()`, or `scheduleActive()`
- Changing the database connection pool configuration
- Merging the legacy manifest engine into the PRE module
- Changing the caching TTL values

---

## 18. "Do Not Build Yet" List

The following are explicitly deferred. They must not be implemented during Phases 0–6 of this roadmap without a formal scope-change decision.

| Item | Reason Deferred |
|------|----------------|
| Multi-tenant authentication / RBAC | Requires API gateway layer not yet defined; auth design is a separate architectural decision |
| Real-time WebSocket push to screens | Screen polling model is sufficient; push introduces new failure modes during migration |
| Playlist editor UI | Frontend is out of scope for this backend migration |
| Analytics aggregation pipeline | Proof-of-play data is captured; aggregation is a separate system |
| CDN / edge manifest caching | Premature until PRE latency profile is known; may invalidate cache design |
| Multi-region deployment | Premature; current team size does not support multi-region operational complexity |
| Automatic conflict resolution | Conflict detection (Phase 3) is sufficient; automatic resolution requires policy decisions not yet made |
| Soft-delete / audit trail UI | `audit_log` table captures events; UI is deferred |
| Campaign A/B testing | Requires additional PRE resolution level; deferred until after Phase 5 gate |
| Screen health dashboard | Basic metrics exposed in Phase 0; full dashboard deferred |
| Webhook delivery for proof-of-play | HTTP callbacks require outbound connectivity guarantees not yet validated |

---

## 19. Production Acceptance Gates (Full Summary)

A phase is not complete until ALL gates for that phase pass. Gates are verified by a second engineer, not the engineer who implemented the phase.

| Phase | Gate Summary | Verification Method |
|-------|-------------|---------------------|
| 0 | Auto-reg bug fixed; metrics live; logging structured; `screen_versions` backfilled | Staging test + log inspection |
| 1 | Migrations apply cleanly; manifest endpoint unaffected; rollback validated | Staging DB + regression test suite |
| 2 | PRE unit tests pass; shadow mode 24h clean; all divergences explained | CI + log analysis |
| 3 | Override cache bust works; emergency sync bust confirmed; provisioning flow works | Integration tests + timing test |
| 4 | Campaign publish materializes schedules; SOV enforcement active; proof-of-play captured | Integration tests |
| 5 | Canary steps 1–4 complete; 7-day clean run; latency within 20% of baseline | Metrics dashboard + incident log |
| 6 | No references to deleted code; safe drops applied; regression suite green | `grep` scan + test suite |

---

## 20. Open Questions (Must Resolve Before Phase 3)

These questions are unresolved and will block Phase 3 API design if not answered:

1. **Authentication model for Override and Emergency APIs.** Who may call `POST /emergency/activate`? Is it role-based? Token-based? This affects API route middleware design.

2. **Multi-venue operator identity.** When an operator manages multiple venues, does the `issued_by` field on overrides reference an internal user ID or an external identity provider subject? This affects audit log fidelity.

3. **Emergency content default.** If `content_id` is null on `emergency_states`, what is served? BACKEND-ARCHITECTURE-v1.md specifies "configurable per venue." Where is this configured? Which table holds the default emergency content ID per venue?

4. **Campaign mandate enforcement.** Mandatory campaigns (org-level `is_mandatory = true`) cannot be overridden by venue operators. What is the enforcement mechanism? A CHECK constraint is insufficient — this requires PRE resolution logic. This must be decided before Phase 5 (PRE implementation).

5. **Screen identification for provisioning.** PRE-REFERENCE-IMPLEMENTATION-v1.md describes an "on-screen flash signal" for screen identification. What is the exact mechanism? QR code? PIN? This affects the provisioning UI flow and is a dependency for `POST /provisioning/claim`.

---

*End of IMPLEMENTATION-ROADMAP-v1.md*
