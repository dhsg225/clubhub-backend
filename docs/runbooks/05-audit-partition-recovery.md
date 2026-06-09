# Audit Partition Manual Recovery Runbook

**When this happens:** CI Stage 15 preflight fails with "partition missing" error, or audit writes fail in production with "no partition for date" or similar PostgreSQL partition constraint errors.

---

## Why this occurs

The `replay_audit_records` table is partitioned by month (`replay_audit_records_YYYY_MM`). The `maintain_audit_partitions_extended()` function is scheduled via pg_cron to run on the 1st of each month and create partitions for the current month + 3 months forward.

This fails or runs late when:
- The database was first set up in a month where partitions were not pre-created
- pg_cron is not available or not enabled on the PostgreSQL instance
- The migration runner was applied without the pg_cron job being set up
- The database was restored from a backup that didn't include the cron job

---

## Step 1: Check which partitions currently exist

```sql
SELECT tablename
FROM pg_tables
WHERE tablename LIKE 'replay_audit_records_%'
ORDER BY tablename;
```

Example healthy output:
```
replay_audit_records_2026_05
replay_audit_records_2026_06
replay_audit_records_2026_07
replay_audit_records_2026_08
```

---

## Step 2: Check which partitions are needed

You need partitions for the current month and at least 3 months forward:

```sql
SELECT to_char(date_trunc('month', now()) + (n || ' months')::interval, 'YYYY_MM') AS needed
FROM generate_series(0, 3) n;
```

Compare the output to what exists from Step 1. Any month in the "needed" list that is missing from pg_tables must be created.

---

## Step 3: Run the maintenance function manually

```sql
SELECT maintain_audit_partitions_extended();
```

This creates all missing partitions for the current month + 3 months forward. It is idempotent — running it when partitions already exist is safe.

---

## Step 4: Verify partitions were created

```sql
SELECT tablename
FROM pg_tables
WHERE tablename LIKE 'replay_audit_records_%'
ORDER BY tablename;
```

All months from the Step 2 output should now appear.

---

## Step 5: If the maintenance function does not exist

The V9 migration may not have been applied. Check the migration status:

```bash
# Run pending migrations via the project CLI
pnpm db:migrate
```

Or apply the specific migration manually:

```bash
psql $DATABASE_URL -f services/cms-api/migrations/V9__remediation_fixes.sql
```

After the migration applies, re-run Step 3.

---

## Step 6: Verify the pg_cron job exists (if pg_cron is available)

If your PostgreSQL instance has pg_cron installed:

```sql
SELECT * FROM cron.job WHERE command LIKE '%maintain_audit%';
```

If the cron job is missing, re-create it:

```sql
SELECT cron.schedule(
  'maintain-audit-partitions',
  '0 2 1 * *',   -- 2 AM on the 1st of each month
  'SELECT maintain_audit_partitions_extended()'
);
```

If pg_cron is not available, add an external cron job (system crontab or Kubernetes CronJob) to call this function on the 1st of each month.

---

## Step 7: Re-run CI preflight gate to confirm pass

```bash
CMS_API_URL=https://your-cms-api.example.com \
DEPLOYMENT_GROUP_ID=your-deployment-group-id \
npx ts-node ci/scripts/venue-preflight.ts
```

The preflight gate includes an audit partition check. It should pass once the partitions are created.

---

## Emergency: Partition missing for a date IN THE PAST with existing data

**Do NOT create the partition.** Creating a partition for a past date when records already exist in the default partition requires data migration. Creating the partition without moving the data will not work — the existing records remain in `replay_audit_records_default` and new inserts will fail (or go to default) depending on your PostgreSQL version.

**Procedure:**

1. Check how many records are in the default partition:
   ```sql
   SELECT count(*) FROM replay_audit_records_default;
   ```

2. Inspect a sample to understand the date range:
   ```sql
   SELECT min(created_at), max(created_at), count(*)
   FROM replay_audit_records_default;
   ```

3. If the default partition has data, it must be moved before creating the dated partition. Consult your DBA — this requires:
   - Creating the dated partition
   - Moving rows with `INSERT INTO replay_audit_records_YYYY_MM SELECT ... FROM replay_audit_records_default WHERE ...`
   - Deleting the moved rows from default
   - This must be done in a transaction with appropriate locking

4. For production systems, schedule this migration during a maintenance window. Audit writes can continue to the default partition in the interim — they are not lost.

---

## Quick reference: partition naming

Partitions follow the pattern `replay_audit_records_YYYY_MM`:
- `replay_audit_records_2026_05` — May 2026
- `replay_audit_records_2026_06` — June 2026

The `replay_audit_records_default` table catches any records that do not match a named partition. Under normal operation, this table should be empty.
