# Staging Environment Plan

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26

---

## Purpose

The staging environment serves four distinct functions:

1. **Functional testing** — every feature and workflow must pass in staging before it is
   deployed to production. Staging is the final gate, not CI.

2. **Database migration dry-run** — every schema migration runs against staging with
   production-volume synthetic data before the migration is applied to production.

3. **Performance testing** — simulated player fleet and query load confirm that new code
   does not regress under realistic conditions.

4. **Disaster recovery testing** — scenarios from DISASTER-RECOVERY-PLAN.md are drilled
   in staging. Staging is the only safe environment for this.

5. **Operator training** — operators are trained on staging before accessing production.
   Training does not reduce constitutional enforcement. Staging behaves like production.

### Staging is not a sandbox

Constitutional enforcement is fully active in staging. All circuit breakers are enabled.
All BLOCK items from PRODUCTION-READINESS-CHECKLIST.md have staging equivalents. If an
operator triggers EMERGENCY_FREEZE in staging, the exit procedure must be followed — there
is no override or shortcut. This is intentional: operators who train on staging learn the
real system, not a simplified model.

### Training Sandbox (separate environment)

A training sandbox is maintained separately from staging. The sandbox:
- Runs full constitutional enforcement (same code as staging)
- Uses smaller infrastructure (5 venues, 20 screens)
- Is available for self-service operator training without PLATFORM_ADMIN coordination
- Is reset to a clean synthetic data state weekly

The sandbox is not used for migration dry-runs, disaster recovery testing, or performance
testing. Those functions require staging.

---

## Staging Environment Topology

### Infrastructure

Staging mirrors production infrastructure exactly in version and configuration. The only
intentional differences are scale and the configuration table in the section below.

| Component | Staging | Production |
|---|---|---|
| PostgreSQL version | Same as production | Primary source of truth |
| Application version | Same as production HEAD | Deployed from same artifact |
| Capacity | 25% of production | Full |
| Node count | 2 app nodes | Scaled per load |
| Database replicas | 1 read replica | As configured |
| Accessible from | Internal VPN only | Public (with auth) |
| Domain | staging.clubhub.internal | clubhub.tv |

Staging is not publicly accessible. All access requires VPN. This is enforced at the
network layer, not the application layer.

### Physical Pi Device

Staging includes at minimum 1 physical Raspberry Pi device connected to the staging
environment. This device:

- Runs the same player-runtime version as staging
- Is on-site at the engineering location (not a venue)
- Receives corpus updates from the staging CMS, not production
- Is used for integration tests that require a real Pi (timing, hardware behavior,
  72h autonomy test runs abbreviated to 4h in staging context)

CI uses a virtual player process (headless, deterministic). The physical Pi is used for
integration verification steps that CI cannot replicate — primarily: actual display output,
GPIO behavior, and thermal/storage behavior under load.

---

## Staging Data Strategy

### Do not use production data

Production data must never be copied to staging. Reasons:
- GDPR and equivalent data protection obligations apply to production data
- Tenant isolation: production tenant data in staging would create cross-environment
  exposure risk
- Audit records from production must not appear in staging audit chain

Any engineer who copies production data to staging must report it as a security incident.

### Synthetic data generator

Staging is seeded with synthetic data at a volume equivalent to a realistic production
deployment. The generator produces:

| Entity | Count |
|---|---|
| Enterprises | 5 |
| Venues per enterprise | 10 (50 total) |
| Screens per venue | 10 (500 total) |
| Active campaigns | 200 |
| Audit records | 90 days of realistic volume |
| Parity records | 30 days of realistic volume |
| Replay audit records | 30 days of realistic volume |

This volume is sufficient for:
- Performance testing of indexed queries
- Pagination and filtering under realistic conditions
- Entropy scan performance at fleet scale
- Backup and restore timing estimates

### Seed script

Location: `scripts/staging/seed-data.ts`

The seed script is idempotent. Running it multiple times produces the same result as
running it once. It uses deterministic IDs derived from synthetic entity names, not random
UUIDs, so repeated runs do not create duplicate records.

Usage:
```
npx ts-node scripts/staging/seed-data.ts
```

Expected output: counts of entities created or skipped (already present).

The seed script must be kept up to date with schema changes. If a migration adds a new
column or table, the seed script must be updated in the same PR.

---

## Staging vs Production Configuration Differences

The following settings differ intentionally between staging and production. All other
settings must be identical.

| Setting | Staging | Production | Reason for difference |
|---|---|---|---|
| Corpus signing key | Test key (known, in secrets manager) | Production key (HSM) | Never use HSM in staging |
| Corpus signing method | Software signing | HSM signing | Cost and availability |
| Audit retention | 7 days | 90 days hot + archival | Storage cost |
| Heartbeat interval | 30 seconds | 2 minutes | Faster feedback during testing |
| Entropy scan interval | 5 minutes | 60 minutes | Faster feedback during testing |
| Email alert recipients | staging-alerts@internal | Production on-call rotation | Prevent alert fatigue |
| Backup retention | 7 days | 30 days | Storage cost |
| CDN | Staging CDN (same TLS config) | Production CDN | Separate traffic |

Any setting not in this table must be identical between staging and production. If a
difference is discovered that is not documented here, it must be documented or corrected.
Undocumented staging/production divergence is a risk — it means staging results may not
predict production behavior.

### How configuration differences are enforced

Configuration is injected via environment variables. The staging environment has its own
secrets manager entries. Application code must not contain staging-specific branches or
feature flags — staging runs the same binary as production with different environment
configuration.

---

## Database Migration Dry-Run Procedure

Every schema migration follows this procedure before being applied to production. No
exceptions for "small" or "additive-only" migrations.

### Step 1: Snapshot staging database

```
pg_dump staging_db > staging_snapshot_$(date +%Y%m%d_%H%M%S).sql
```

Store the snapshot. It is the recovery point if migration fails in staging.

### Step 2: Apply migration to staging

Run the migration against the staging database using the same migration tool as production
(Flyway, Knex, or equivalent). If the migration fails, restore from the snapshot taken in
step 1 and do not proceed.

### Step 3: Run full application test suite against staging

```
npm run test:integration -- --env=staging
```

All tests must pass. Any test failure after migration is a sign that the migration broke
something. Do not proceed to production with failing tests.

### Step 4: Verify all vector suites pass against staging

Run each suite against the staging environment:
- `scripts/vectors/chaos.vec.ts`
- `scripts/vectors/runtime-integration.vec.ts`
- `scripts/vectors/shadow.vec.ts`
- `scripts/vectors/hardening.vec.ts`

All assertion counts must match their documented totals. Any regression is a BLOCK.

### Step 5: Performance test new indexes and partitions

For any migration that adds an index, partition, or changes query plans:

1. Run the query patterns that use the new structure against staging with synthetic data
   at full volume (50 venues, 500 screens, 90 days of audit records).
2. Measure query latency before and after migration.
3. Confirm no query regresses by more than 20% in p99 latency.
4. Document results.

### Step 6: Technical Lead sign-off

Technical Lead reviews:
- Migration script
- Test results
- Performance results
- Any deviations from expected behavior

Technical Lead signs off in writing (Slack, email, or comment in migration PR) before
step 7 proceeds.

### Step 7: Apply migration to production

Apply the migration to production using the same procedure as step 2. If the migration is
additive-only (no column removals, no constraint changes that could fail on existing data),
it can be applied during normal hours. If the migration is destructive or requires a
maintenance window, schedule it accordingly.

If the production migration fails, the recovery procedure is in DISASTER-RECOVERY-PLAN.md
scenario 2.

---

## Constitutional Freeze Test (Quarterly)

Every quarter, the PLATFORM_ADMIN team drills the EMERGENCY_FREEZE exit procedure in
staging. This is not optional — it is a required operational exercise.

### Purpose

- Confirm the exit procedure works as documented in CONSTITUTIONAL-FREEZE-PROCEDURES.md
- Identify any drift between documented procedure and actual system behavior
- Keep PLATFORM_ADMIN team practiced; the procedure involves multiple steps and must be
  executed correctly under pressure during a real P1 incident

### Procedure

1. **Trigger freeze deliberately.** PLATFORM_ADMIN calls the GlobalConstitutionalBreaker
   directly in staging (not by triggering an actual replay nondeterminism event, which
   would pollute audit records). Use the administrative test endpoint.

2. **Confirm freeze state.** Constitutional console must show EMERGENCY_FREEZE. All
   mutation endpoints must return 503. Player(s) must show they are serving from cache.

3. **Execute EMERGENCY_FREEZE exit procedure end-to-end.** Follow CONSTITUTIONAL-FREEZE-
   PROCEDURES.md exactly as written, including the human authorization token requirement
   and the READ_ONLY intermediate state. Do not skip steps.

4. **Run integrity suite.** After reaching READ_ONLY:
   - `validate-contracts.ts --all` — must pass
   - `scripts/system-integrity/full-stack-determinism.ts` — must pass
   - `constitutional-boundary-check.ts` — must pass

5. **Approve HEALTHY.** PLATFORM_ADMIN approves the READ_ONLY → HEALTHY transition via
   the constitutional console.

6. **Verify recovery.** Confirm player heartbeats return to green, parity ratio stabilizes,
   and no circuit breakers remain in abnormal state.

7. **Time the procedure.** Target: EMERGENCY_FREEZE to HEALTHY in under 30 minutes.

8. **Document results.** Record: date, PLATFORM_ADMIN who executed the drill, time taken
   for each step, total time, any deviations from the documented procedure, and whether
   the target time was met.

If the drill reveals a gap in the documented procedure, update CONSTITUTIONAL-FREEZE-
PROCEDURES.md and INCIDENT-RESPONSE-RUNBOOK.md before the next quarter's drill.
