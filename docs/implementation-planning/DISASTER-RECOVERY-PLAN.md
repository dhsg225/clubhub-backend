# Disaster Recovery Plan

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26

---

## RTO / RPO Targets

| Target | Value | Notes |
|---|---|---|
| RTO (Recovery Time Objective) | 60 minutes | Venue screens return to content within 60 minutes of disaster detection |
| RPO (Recovery Point Objective) | 15 minutes | No more than 15 minutes of replay audit record loss |

### How player autonomy supports these targets

Raspberry Pi players continue serving from their locally cached corpus for up to 72 hours
without CMS connectivity. This means that in most disaster scenarios, screens do not go
dark during the recovery window — they continue playing from cache while the backend
recovers.

The 60-minute RTO applies to restoring CMS and backend service so operators can manage
content again, not to restoring screen output (which is preserved by player autonomy).
The exception is Pi hardware failure (Scenario 3), where the screen does go dark.

Replay audit records buffer locally on players during outages and sync to the cloud
service when connectivity is restored. The 15-minute RPO applies to cloud-side audit
records. Player-side buffering means that with a backend outage lasting less than 72h,
no audit records are lost — they sync on reconnection.

---

## Scenario 1: CMS API Complete Failure

**Cause examples:** Application crash, container failure, OOM kill, deployment failure,
dependency service (Redis, internal API) failure.

**Impact:**
- Operators cannot log in to CMS
- No new corpus updates can be published
- No new campaigns can be created or approved
- All write operations unavailable

**Player behavior:** Players continue autonomously from their last received corpus.
72-hour autonomy window applies. If the outage exceeds 72 hours, players will serve
increasingly stale content (not incorrect content — the corpus remains valid, it is
just not updated with new campaigns).

**Detection:** Health check endpoint returns non-200. Monitoring alert fires within
2 minutes of health check failure.

### Recovery steps

**Step 1: Attempt service restart (target: <5 minutes)**

If the failure is a crash or OOM, restart the container:
```bash
docker restart cms-api
# or via orchestration:
kubectl rollout restart deployment/cms-api
```

Confirm the health check returns 200 within 30 seconds of restart. If it does,
monitor for 10 minutes to confirm stability. If the service crashes again, proceed to
Step 2.

**Step 2: Assess whether data corruption is involved**

Check application logs for database errors, schema errors, or constraint violations at
startup. If logs show the application cannot connect to or query the database, the
issue may be in the database layer — see Scenario 2.

**Step 3: Restore from backup if data corruption confirmed (target: <60 minutes total)**

1. Confirm backup is current (most recent backup must be within 24 hours).
2. Execute database restore: `scripts/disaster-recovery/restore-database.ts`
3. Verify audit record chain integrity after restore:
   `scripts/disaster-recovery/verify-audit-chain.ts`
4. Restart CMS API against restored database.
5. Verify health check returns 200.

**Step 4: Confirm audit buffer sync**

After CMS API recovers, players that were running autonomously during the outage will
begin syncing their buffered audit records. Monitor the audit sync queue until all
players have confirmed sync. This may take 15-30 minutes for a large fleet.

**RTO:** <5 minutes with service restart; <60 minutes with database restoration.

**RPO:** 0 (all audit records buffered on players sync on reconnection, assuming outage
< 72h).

---

## Scenario 2: PostgreSQL Database Failure

**Cause examples:** Primary database failure, storage failure, out-of-disk, PostgreSQL
process crash, snapshot restore failure.

**Impact:**
- CMS API fails (cannot read or write)
- Cloud audit service fails (cannot record incoming audit records)
- All mutations blocked
- Read-replica may still be available (read-only operations)

**Player behavior:** Same as Scenario 1 — players continue autonomously.

**Detection:** PostgreSQL health check fails. Application logs show connection errors.
Alert fires within 2 minutes.

### Recovery steps

**Step 1: Fail over to read replica (target: <15 minutes)**

Update the application database connection string to point to the read replica. This
restores read-only CMS operations (operators can view content but cannot publish or manage
campaigns). Not all applications support read-replica failover — confirm this capability
is configured before assuming it works.

Read-replica failover restores:
- Operator login (read-only session)
- Campaign and venue browsing
- Audit log viewing

Read-replica failover does not restore:
- Campaign creation, approval, publishing
- Corpus updates
- Any write operation

**Step 2: Diagnose primary failure**

Inspect PostgreSQL logs on the primary host. Determine if this is:
- A process crash (restart may suffice)
- A storage issue (may require volume recovery or data restoration from backup)
- A corruption event (requires restoration from backup)

**Step 3: Restore primary from backup (target: 60-120 minutes, depending on backup size)**

1. Provision a new PostgreSQL instance (or repair existing).
2. Execute restore: `scripts/disaster-recovery/restore-database.ts`
3. Verify the restored instance has all tables and the most recent backup data.
4. Run `scripts/disaster-recovery/verify-audit-chain.ts` — this confirms the audit
   chain is intact. Note: some records buffered on players during the outage will arrive
   after this check; the chain verification at this step confirms up to the backup point.
5. Switch application database connection from read-replica to restored primary.
6. Monitor write operations for correctness.

**Step 4: Verify audit record chain after player sync**

After the primary is restored and players begin syncing their buffered records:
1. Allow 30 minutes for the initial sync wave to complete.
2. Run `scripts/disaster-recovery/verify-audit-chain.ts` again.
3. Confirm: chain is intact including records that arrived from player buffers.

If the chain has a gap (some records are missing rather than just delayed), investigate
which players did not sync. A player that failed to sync its buffer within 72h of
reconnection has permanently lost those records — this is a constitutional integrity event
requiring PLATFORM_ADMIN review.

**RTO:** 15 minutes for read-only; 60-120 minutes for full read-write restoration.

**RPO:** 15 minutes maximum (backup created every 24h; player buffering bridges the gap
for records generated during the outage period, except records from players that were
offline for >72h before and during the database outage).

---

## Scenario 3: Player Pi Hardware Failure at Venue

**Cause examples:** SD card failure, power supply failure, network adapter failure,
physical damage, thermal failure from inadequate ventilation.

**Impact:**
- The screen(s) connected to the failed Pi go dark (no player autonomy — the player is
  offline)
- No audit records from affected screens during outage
- CMS shows affected screens as "missing heartbeat" after 10 minutes

**Detection:** Heartbeat monitoring alert fires within 10 minutes of missed heartbeat.
VENUE_OPERATOR notified.

### Recovery steps

**Step 1: Confirm hardware failure vs. connectivity failure (target: 5 minutes)**

Before declaring hardware failure, confirm:
- Power LED on Pi is on or off (power supply check)
- Network LED is active (network check)
- SSH accessible (process check)

If the Pi is responsive via SSH but player-runtime has crashed: restart player-runtime
and confirm it returns to HEALTHY constitutional state within 60 seconds.

If the Pi is not responsive (no power, no network): proceed to Step 2.

**Step 2: Replace Pi hardware (target: 30 minutes with spare, 24-48h without)**

**GRADE_A venues (high compliance, high traffic) must have a spare Pi on-site.** A spare
Pi:
- Is pre-provisioned with player-runtime installed
- Has the most recently signed corpus bundle loaded (updated monthly by the provisioning
  script)
- Is stored at the venue in a labeled location known to the VENUE_OPERATOR

Swap procedure:
1. Remove failed Pi from display connection.
2. Connect spare Pi to display, network, and power.
3. Confirm boot: VENUE_OPERATOR observes screens return to content.
4. Register the spare Pi's screen_id(s) via the CMS (VENUE_OPERATOR role can do this):
   `POST /screens/:screen_id/register`
5. Run first-boot determinism check: confirm the PLATFORM_ADMIN console shows the screen
   as HEALTHY within 5 minutes.

If no spare is available, a replacement Pi must be shipped. Target: 24-48h delivery
depending on location. During this window, the screen is dark. There is no software
mitigation for physical Pi failure without a spare unit.

**Step 3: Update the failed unit record**

Record the failure in the asset inventory:
- Serial number of failed unit
- Date of failure
- Symptom (how failure manifested)
- Disposition (returned for RMA, discarded, in repair)

This record informs burn-test protocols — if a specific hardware batch has elevated
failure rates, pre-deploy burn testing should be extended.

**Step 4: Provision replacement Pi for spare inventory**

After deploying the spare, order and pre-provision a new spare for the venue so the
"spare on hand" guarantee is maintained.

**RTO:** 30 minutes with spare available; 24-48 hours if spare must be shipped.

**What shortens this RTO:** Pre-positioned spares at every GRADE_A venue. Monthly
corpus updates to spare units so they do not need to sync before going live. A
provisioning kit (labeled bag with spare Pi, cables, SD card) stored at each venue
eliminates the time spent finding and connecting a replacement.

---

## Scenario 4: Cloud Region Failure (Future Multi-Region)

**Note:** This scenario describes the expected behavior when multi-region deployment
is implemented. In the current single-region deployment, a regional failure is
equivalent to Scenario 2 (database) plus Scenario 1 (CMS API).

**Cause examples:** Cloud provider regional outage, network partition, region-level
infrastructure failure.

**Impact:**
- CMS unavailable from primary region
- No new corpus updates or campaign management
- Players continue autonomously (72h window)

**Player behavior:** Autonomous content serving from local corpus cache.

### Recovery steps

**Step 1: DNS failover to secondary region (target: <15 minutes)**

DNS failover routes CMS traffic to a read-only replica in the secondary region. This
restores:
- Operator login and browsing (read-only)
- Audit log viewing

Corpus updates are not possible while primary is unavailable.

**Step 2: Monitor player corpus freshness**

If the regional outage lasts more than 72h, players will begin serving stale content.
This is the only scenario where the 72h autonomy window becomes a hard constraint.
Monitor the outage duration and alert operators if corpus freshness will expire.

**Step 3: Primary region recovery**

When primary region recovers:
- Resume read-write operations
- Players sync their buffered audit records
- Verify audit chain integrity (the secondary region's audit chain may have a gap — it
  received reads during the outage but no new records)
- Replay audit chain gap investigation: determine which records were generated during
  the outage and confirm they arrived via player buffer sync

**RTO:** 15 minutes for read-only; 60 minutes for full recovery.

**RPO:** 15 minutes (player buffer bridging), subject to audit chain gap investigation.

---

## Scenario 5: Corpus Signing Key Compromise

**Cause examples:** Secrets manager breach, insider threat, key material exfiltration,
signing service compromise.

**Impact:**
- Cannot trust any corpus delivered to players after the compromise timestamp
- Any corpus that was signed with the compromised key could have been tampered with
- EMERGENCY_FREEZE is required immediately to prevent untrusted corpus from spreading

This is the most complex and highest-stakes disaster scenario. It requires coordinated
action from multiple PLATFORM_ADMINs.

**Detection:** Reported via security alert, anomaly detection, or external disclosure.
Any suspicion of key compromise must be treated as confirmed compromise until disproven.

### Recovery steps

**Step 1: EMERGENCY_FREEZE immediately (target: <5 minutes)**

PLATFORM_ADMIN trips the GlobalConstitutionalBreaker manually from the constitutional
console. This immediately:
- Blocks all mutations in CMS
- Prevents corpus updates from being distributed to players
- Players enter EMERGENCY_FALLBACK (serving from last cached corpus)

Do not wait to confirm the compromise before triggering EMERGENCY_FREEZE. The cost of
an unnecessary freeze is high but recoverable. The cost of a tampered corpus reaching
players is higher and less recoverable.

**Step 2: Revoke compromised signing key (target: <30 minutes)**

In the secrets manager:
1. Mark the compromised key as revoked (do not delete — the revocation timestamp is
   needed for audit purposes).
2. Confirm that no active service is still using the compromised key (check corpus-
   publisher service configuration).

**Step 3: Key rotation ceremony (target: 2-4 hours)**

Generating a new signing key requires a key rotation ceremony with 2 PLATFORM_ADMINs
present. This is an intentional procedural control — a signing key cannot be generated
by one person acting alone.

Ceremony procedure:
1. Both PLATFORM_ADMINs confirm identity (in-person or via verified video call).
2. Generate new signing key in secrets manager (HSM-backed in production).
3. Both PLATFORM_ADMINs record their `principal_id` and confirmation in the ceremony log.
4. New key is available for corpus signing.

The ceremony log is stored in the constitutional freeze log (append-only, permanent).

**Step 4: Re-sign all current corpus versions (target: 1-2 hours)**

Every corpus version that was signed with the compromised key must be re-signed with the
new key. Run:
```bash
npx ts-node scripts/corpus/re-sign-all.ts \
  --old-key-id=[compromised_key_id] \
  --new-key-id=[new_key_id]
```

This script:
1. Lists all corpus versions signed with the old key
2. Re-signs each with the new key
3. Verifies each signature before writing
4. Reports the count of re-signed versions

Do not distribute the re-signed corpus to players yet — wait until the EMERGENCY_FREEZE
exit procedure has been completed.

**Step 5: Force corpus refresh to all players (target: 1-2 hours after exit)**

After exiting EMERGENCY_FREEZE and returning to HEALTHY state, force all players to
re-download their corpus from the CDN (which now serves the re-signed versions):
```bash
npx ts-node scripts/disaster-recovery/resync-players.ts --all
```

Monitor player heartbeats to confirm each player has received and verified the new
corpus. A player that cannot verify the new corpus signature (old key is revoked, new key
not yet installed on player) will enter a degraded state and require manual intervention.

**Step 6: Exit EMERGENCY_FREEZE (after steps 2-4 are complete)**

Follow the standard EMERGENCY_FREEZE exit procedure:
1. Provide human authorization token (≥8 chars)
2. System transitions to READ_ONLY
3. Run integrity suite
4. Approve HEALTHY transition

**RTO:** 4-8 hours (key ceremony 2-4h + re-signing 1-2h + distribution 1-2h).

**What shortens this RTO:** Pre-planned key rotation ceremony procedure (so PLATFORM_ADMINs
do not need to figure out the process under pressure). Pre-tested re-signing script.
A documented list of all corpus versions in production (so re-signing is not a discovery
exercise). Joint drill of this scenario annually.

---

## Backup Verification Schedule

Backups that are not verified are not backups — they are unverified files. This schedule
ensures backups are actually restorable before they are needed.

| Frequency | What | Who | Evidence |
|---|---|---|---|
| Daily | Automated backup creation | System (automated) | Backup checksum logged |
| Weekly | Automated restore test in staging | System (automated) | Application health check against restored DB |
| Monthly | PLATFORM_ADMIN signs backup verification attestation | PLATFORM_ADMIN | Signed record in constitutional console |
| Quarterly | Full disaster recovery drill (Scenario 1 or 2) | PLATFORM_ADMIN + engineering | Drill report with RTO achieved |

### Automated weekly restore test

The weekly restore test runs automatically in staging. It:
1. Takes the most recent production backup
2. Restores it to an isolated staging instance
3. Runs `scripts/disaster-recovery/verify-audit-chain.ts` against the restored instance
4. Runs the application health check endpoint
5. Reports PASS or FAIL to the monitoring dashboard

If the weekly restore test fails, a CRITICAL alert fires and PLATFORM_ADMIN investigates.
A failed restore test means the backup is not usable — this must be resolved before the
next daily backup cycle.

### Quarterly disaster recovery drill

Each quarter, PLATFORM_ADMIN executes a full drill of either Scenario 1 (CMS API failure)
or Scenario 2 (database failure) in a non-production environment. The drill:
- Follows this plan exactly as written
- Measures actual RTO achieved
- Documents any deviations from the plan
- Documents any steps where the plan was unclear or incorrect
- Results in an update to this plan if gaps are found

Drill results are documented and stored. If the drill RTO exceeds the target by more than
50%, the engineering team must investigate why and address the gap before the next quarter.

---

## Recovery Tooling

All recovery scripts are idempotent — running them more than once produces the same
result as running them once. This is critical for disaster recovery, where it is common
to re-run a step to confirm it completed successfully.

| Script | Location | Purpose | Idempotent |
|---|---|---|---|
| `restore-database.ts` | `scripts/disaster-recovery/` | Automated database restore procedure | Yes |
| `verify-audit-chain.ts` | `scripts/disaster-recovery/` | Verify audit record chain integrity after restore | Yes (read-only) |
| `resync-players.ts` | `scripts/disaster-recovery/` | Force all players to re-sync corpus from CDN | Yes |
| `re-sign-all.ts` | `scripts/corpus/` | Re-sign all corpus versions after key rotation | Yes (skips already-re-signed) |

Scripts must be tested in staging before use in production. During a disaster is not the
time to discover that a script has a bug. Each script should be run in the quarterly
drill at least once per year.
