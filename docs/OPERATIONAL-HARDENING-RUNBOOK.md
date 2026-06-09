# Operational Hardening Runbook
## ClubHub TV — Wave 1 Blocker Tier

---

## 1. PgBouncer Connection Pool

**Architecture**: `backend → pgbouncer:5432 → postgres:5432`

Pool mode: **transaction** — connection released after each query.
Max server connections: 20 (leaves headroom on db.t3.medium = 170 max).
Max client connections: 200.

**Failure modes**:
| Symptom | Cause | Recovery |
|---------|-------|----------|
| `connection refused` to pgbouncer | pgbouncer container crashed | `docker compose restart pgbouncer` |
| `FATAL: auth failed` | DB_PASSWORD env mismatch | Check `docker compose config` env |
| `server conn limit` errors | pool_size too small | Increase `default_pool_size` in pgbouncer.ini |
| Slow queries after pgbouncer restart | Connections being re-established | Normal, recovers in <10s |

**Verify pool health**:
```bash
# Check pgbouncer stats (from inside docker network or with port forward)
psql -h pgbouncer -p 6432 -U pgbouncer_admin pgbouncer -c "SHOW POOLS;"
psql -h pgbouncer -p 6432 -U pgbouncer_admin pgbouncer -c "SHOW STATS;"
```

**What operators will do wrong**:
- Change `DB_PASSWORD` without regenerating userlist.txt → auth failure on restart
- Connect to postgres:5432 directly in scripts, bypassing pool → connection leak
- Set `pool_mode=session` instead of `transaction` → connection exhaustion with idle clients

**Required env vars** (add to `.env.production`):
```
PGBOUNCER_ADMIN_PASSWORD=<strong-random-password>
```

---

## 2. Corpus Snapshot Rotation

**Files on player disk** (`/var/clubhub/corpus/`):
```
corpus.current.json   — actively serving
corpus.previous.json  — one version back
corpus.factory.json   — commissioning baseline (never overwritten)
corpus.next.json      — staging (exists only during apply, auto-cleaned)
```

**Load fallback chain**: current → previous → factory → null (no content)

**On `load()` returning source=`previous`**: SD card read error likely. Replace within 72h.
**On `load()` returning source=`factory`**: Severe corruption. Reimaging required within 24h.

**Recovery procedure for corrupt current corpus**:
```bash
# SSH into player
ssh clubhub@<venue-ip>

# Check which snapshot is being used
cat /var/log/clubhub/player.log | grep "corpus-cache"

# Manual rollback to previous
cp /var/clubhub/corpus/corpus.previous.json /var/clubhub/corpus/corpus.current.json
pm2 restart clubhub-player

# Verify
pm2 logs clubhub-player --lines 20
```

**Commissioning**: write factory snapshot once at first boot.
Factory snapshot is the default-content corpus shipped with device.
Factory content must be pre-approved and licensed for all markets.

---

## 3. Reconnect Backoff

**Purpose**: prevents 50 players reconnecting simultaneously after ISP outage.

**Intervals** (base=60s, max=15min, jitter=±30s per device):
```
Failure 1: ~60s + device_jitter
Failure 2: ~120s + device_jitter
Failure 3: ~240s + device_jitter
Failure 4: ~480s + device_jitter
Failure 5+: ~900s + device_jitter (15min ceiling)
```

**Monitoring**: heartbeat field `consecutive_sync_failures` increments on each failure.
Fleet health dashboard shows `SYNC_DEGRADED` when `consecutive_sync_failures >= 3`.

**Recovery**: backoff resets automatically on successful sync. No manual action required.

**What to check when SYNC_DEGRADED**:
```bash
# Check API reachability from venue network
curl -I https://api.clubhub.tv/health/live

# Check player logs
pm2 logs clubhub-player --lines 50 | grep "Corpus poll"

# Check DNS resolution
nslookup api.clubhub.tv
```

---

## 4. Signed URL TTL

**Policy**: corpus publisher must set `asset_url.expires_at_ms = corpus_fetch_time + 74h`
(72h autonomy window + 2h buffer).

**Alert threshold**: `asset_url_expires_in_min < 240` (4 hours) → `URL_EXPIRING` warning.

**When `URL_EXPIRING` fires**:
1. Player is offline (or sync failing)
2. URLs will expire before next corpus sync
3. If player comes back online within 4h: sync resolves issue automatically
4. If player remains offline and URLs expire: player serves from **local disk cache**, not CDN
   — content still works, but CDN bypass means no URL refresh until reconnect

**What to check**:
```bash
# Check last successful sync
pm2 logs clubhub-player | grep "Corpus updated"

# Check URL expiry status in heartbeat
# Fleet health dashboard → screen detail → asset_url_expires_in_min
```

---

## 5. Watchdog

**Checks** (every 60s after first 30s):
| Check | Threshold | Action |
|-------|-----------|--------|
| Main loop | No kick in `5 × poll_interval` | `process.exit(1)` → PM2 restarts |
| Disk space | <150MB free | WARN log |
| Disk space | <100MB free | ERROR log |
| Memory RSS | >512MB | ERROR log; exit after 3 consecutive |
| Temperature | ≥75°C | WARN log |
| Temperature | ≥82°C | ERROR log |
| Corpus integrity | Checksum mismatch on current | ERROR log, flag set |

**Disk space recovery**:
```bash
# Find large files
du -sh /var/clubhub/*
du -sh /var/log/clubhub/*

# Clear old replay cache (only after confirming upload to cloud)
ls -la /var/clubhub/replay/
# If replay-packets.ndjson is large and all packets are synced=true, truncate:
# (Never rm the file — truncate to preserve inode)
> /var/clubhub/replay/replay-packets.ndjson
pm2 restart clubhub-player
```

**Memory exit recovery**:
```bash
# Check recent logs for memory trend
pm2 logs clubhub-player | grep "MEMORY"
# If restarting repeatedly, look for corpus payload size growth
cat /var/clubhub/corpus/corpus.current.json | wc -c
# Large corpus > 10MB may indicate data model issue — escalate to engineering
```

**Temperature recovery**:
- Check AV cabinet has adequate airflow
- Remove obstructions from Pi heatsink
- Consider adding active cooling (5V fan on GPIO)
- If consistently above 78°C: move Pi outside cabinet

---

## 6. Log Rotation

**Logrotate config**: `/etc/logrotate.d/clubhub-player`
**Log directory**: `/var/log/clubhub/`
**Rotation**: daily, max 10MB, keep 7 days, compressed

**Verify rotation**:
```bash
logrotate --debug /etc/logrotate.d/clubhub-player
ls -la /var/log/clubhub/
```

**If logs are not rotating** (cron dead):
```bash
systemctl status cron
systemctl restart cron
# Manually rotate:
logrotate --force /etc/logrotate.d/clubhub-player
```

**PM2 log config**: configured in `ecosystem.config.js` to write to `/var/log/clubhub/player.log`.
If PM2 is writing to its own log directory instead:
```bash
pm2 flush clubhub-player
pm2 restart clubhub-player
```

---

## 7. Fleet Health Dashboard

**Endpoints**:
```
GET  /api/v2/fleet/health                    — summary counts by status
GET  /api/v2/fleet/health/screens            — per-screen list
GET  /api/v2/fleet/health/screens/:id        — single screen detail
POST /api/v2/screens/:screen_id/heartbeat    — player heartbeat (internal)
```

**Health classifications**:
| Status | Meaning |
|--------|---------|
| HEALTHY | Heartbeat <90s, no warnings |
| DEGRADED | Heartbeat <90s, warnings present |
| OFFLINE | No heartbeat 90s–24h |
| LOST | No heartbeat >24h |
| UNKNOWN | Never sent heartbeat |

**Warnings**:
| Warning | Threshold | Action |
|---------|-----------|--------|
| SYNC_DEGRADED | consecutive_sync_failures ≥ 3 | Check venue connectivity |
| DISK_LOW | disk_free_mb < 200 | Check for runaway logs/cache |
| MEMORY_HIGH | memory_rss_mb > 400 | Restart player, check for leak |
| TEMP_HIGH | temperature_celsius ≥ 75 | Check cabinet ventilation |
| CORPUS_DEGRADED | corpus_load_source = 'previous' | Plan SD card replacement |
| CORPUS_CRITICAL | corpus_load_source = 'factory' | Emergency reimaging |
| URL_EXPIRING | asset_url_expires_in_min < 240 | Check connectivity |
| CORPUS_STALE | corpus_age_ms > 4h | Check sync, check API |

**Fleet health query examples**:
```bash
# All offline screens
curl https://api.clubhub.tv/api/v2/fleet/health/screens?status=OFFLINE

# All screens with disk warning
curl https://api.clubhub.tv/api/v2/fleet/health/screens?warning=DISK_LOW

# All screens in a venue
curl https://api.clubhub.tv/api/v2/fleet/health/screens?venue_id=<uuid>
```

---

## 8. Corpus Rollback

**Route**: `POST /api/v2/corpus/rollback`

**Pre-flight** (required before rollback):
```bash
GET /api/v2/corpus/rollback-impact/:deployment_group_id
```
Response shows: current version, available rollback targets, affected screens, canary status.

**Execute rollback**:
```bash
curl -X POST https://api.clubhub.tv/api/v2/corpus/rollback \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_group_id": "<uuid>",
    "target_corpus_version_id": "<uuid>",
    "operator_id": "ops-alice",
    "human_approval_token": "<approval-token>",
    "reason": "Wrong logo in schedule, rolling back to 2h ago"
  }'
```

**Rollback constraints**:
- Target must be within last 7 days
- No active canary (abort canary first)
- Max 5 rollbacks per group per hour (rate limited)

**Verify rollback applied to players**:
```bash
# Wait up to 60s for next corpus poll, then check fleet dashboard
curl https://api.clubhub.tv/api/v2/fleet/health/screens?venue_id=<uuid>
# All screens should show new corpus_version_id within 90s
```

**Rollback not applying after 2 minutes**:
1. Check player heartbeat — is player online?
2. SSH into player: `cat /var/clubhub/corpus/corpus.current.json | python3 -m json.tool | head`
3. Check for corpus poll errors: `pm2 logs clubhub-player | grep "Corpus poll"`
4. Force restart player: `pm2 restart clubhub-player`

---

## 9. Audit Search

**Table**: `replay_audit_records` — partitioned by month from V1.

**Indexes**:
- `(venue_id, created_at DESC)` — primary fleet query
- `(screen_id, created_at DESC)` — single screen investigation
- `(correlation_id)` — replay lookup
- `(screen_id, venue_id, created_at DESC)` — investigation pattern (V6)

**Investigation query** (must return in <100ms):
```sql
-- Find all audit records for screen X in last hour
SELECT audit_record_id, at_utc_ms, playlist_checksum, resolution_level, is_fallback
FROM replay_audit_records
WHERE screen_id = $1
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

**Monthly partition maintenance** (run on 20th of each month):
```sql
SELECT maintain_audit_partitions();
-- Returns list of created/existing partitions
```

**Critical**: if `maintain_audit_partitions()` is not run and a month's partition doesn't exist,
audit record writes will fail with: `no partition of relation replay_audit_records found for row`.
This is a constitutional violation (audit chain broken).

**Recovery if partition missing**:
```sql
-- Emergency: create missing partition manually
-- Example for missing 2027-01 partition:
CREATE TABLE replay_audit_records_2027_01
  PARTITION OF replay_audit_records
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
-- Then run: SELECT maintain_audit_partitions(); to pre-create future ones
```

---

## 10. Wave 1 Go-Live Checklist

Before deploying to first venue, verify each blocker-tier item:

```
[ ] PgBouncer running: psql -h pgbouncer -p 6432 -c "SHOW POOLS;" returns rows
[ ] Signed URL TTL: corpus publisher config sets expires_at = fetched_at + 74h
[ ] Corpus rotation test: apply 3 corpus versions, verify current/previous/factory files
[ ] Reconnect test: disconnect player for 5min, reconnect, verify sync within backoff window
[ ] Watchdog test: kill player process, verify PM2 restarts within 30s
[ ] Log rotation: verify logrotate runs, log size stays bounded
[ ] Fleet health: all 5 pilot screens show HEALTHY within 5min of deployment
[ ] Rollback test: push wrong corpus, rollback, verify correct content within 90s
[ ] Audit partitions: run maintain_audit_partitions(), verify 2026-07 through 2026-12 exist
[ ] Emergency override: test LEVEL_0 override reaches all venue screens within 60s
```

---

## Escalation Path

```
L1: Operator self-service (fleet dashboard, rollback button)
    → resolves ~70% of issues

L2: Support staff (SSH access, PM2 restart, log review)
    → resolves ~25% of issues
    → SLA: 2h response, 4h resolution

L3: Engineering on-call (DB investigation, API issues, deployment failures)
    → resolves ~4% of issues
    → SLA: 30min response, 2h resolution

L4: On-site dispatch (hardware failure, SD card replacement, reimaging)
    → resolves ~1% of issues
    → SLA: 24h standard, 4h emergency
    → Cost: £150–250/dispatch — require L2/L3 sign-off before dispatching
```
