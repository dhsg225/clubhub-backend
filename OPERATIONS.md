# ClubHub TV — Operations Runbook

Day-to-day operational procedures for production deployments.

---

## Quick Diagnostics

```bash
# Is everything healthy?
curl https://yourdomain.com/api/health/ready | python3 -m json.tool

# Are all screens seen recently?
make screens-list   # or: curl http://localhost:4000/screens

# Backend logs (last 100 lines)
docker compose -f docker-compose.production.yml logs --tail=100 backend

# Error count in last hour
docker compose -f docker-compose.production.yml logs backend \
  | grep '"level":"ERROR"' | wc -l
```

---

## 1. Recovering a Failed Backend

### Symptoms
- `/health/live` returns 5xx or times out
- Screens fall back to cached manifests
- Backend container is in Restart loop

### Procedure

```bash
# Check container state
docker compose -f docker-compose.production.yml ps

# Check why it crashed
docker compose -f docker-compose.production.yml logs --tail=50 backend

# Most common causes:
#   "Could not connect to database" → DB isn't healthy yet, wait or fix DB first
#   "EADDRINUSE :4000"              → Another process holds the port (rare in Docker)
#   OOM killed                      → Increase container memory limit or reduce pool size

# Restart the backend
docker compose -f docker-compose.production.yml restart backend

# Verify recovery (wait ~20 seconds for healthcheck to pass)
docker compose -f docker-compose.production.yml ps
curl https://yourdomain.com/api/health/ready
```

### If restart loop persists

```bash
# Check for config errors (bad DATABASE_URL, missing env vars)
docker compose -f docker-compose.production.yml exec backend env | grep -v PASSWORD

# Check DB is reachable from backend container
docker compose -f docker-compose.production.yml exec backend \
  wget -qO- http://postgres:5432 2>&1 || echo "postgres unreachable"

# Rebuild and restart (picks up any image changes)
docker compose -f docker-compose.production.yml up -d --build --no-deps backend
```

---

## 2. Recovering a Failed Database

### Symptoms
- Backend logs `FATAL: remaining connection slots are reserved` or `ECONNREFUSED`
- `/health/ready` returns `"db": {"status": "error"}`
- Screens see `poll.failure` events (they fall back to cached manifests)

### Procedure

```bash
# Check postgres state
docker compose -f docker-compose.production.yml ps postgres
docker compose -f docker-compose.production.yml logs --tail=50 postgres

# Restart postgres
docker compose -f docker-compose.production.yml restart postgres

# Wait for postgres healthcheck to pass (~10–30 seconds)
watch -n2 'docker compose -f docker-compose.production.yml ps postgres'

# Then restart the backend (it may have given up on the DB)
docker compose -f docker-compose.production.yml restart backend

# Verify
curl https://yourdomain.com/api/health/ready
```

### If postgres volume is corrupted

```bash
# Stop everything
docker compose -f docker-compose.production.yml down

# Restore from the most recent backup
./scripts/restore.sh backups/$(ls -t backups/*.sql.gz | head -1 | xargs basename)

# Restart
docker compose -f docker-compose.production.yml up -d
```

### Connection pool exhaustion

If the backend logs show connection timeout errors under heavy load:

1. Check current pool size in `backend/src/db.js` (currently: max=10)
2. For > 50 screens, bump `max` to 25
3. For > 150 screens, bump `max` to 50 and increase `max_connections` in postgres

```bash
# Check current connection count in postgres
docker compose -f docker-compose.production.yml exec postgres \
  psql -U clubhub -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

---

## 3. Log Rotation

Docker's json-file log driver is pre-configured with rolling limits:
- Backend: 50 MB per file, 5 files kept = max 250 MB
- Postgres: 20 MB per file, 3 files kept = max 60 MB
- Caddy: 20 MB per file, 3 files kept = max 60 MB

No manual rotation is required. To inspect current log sizes:

```bash
du -sh /var/lib/docker/containers/*/
```

### Caddy access logs

Caddy also writes structured access logs to `/var/log/caddy/access.log` inside
the caddy container (configured in `docker/Caddyfile`), with 50 MB rolling
retention. To stream them:

```bash
docker compose -f docker-compose.production.yml exec caddy \
  tail -f /var/log/caddy/access.log
```

### Filtering backend logs

```bash
# All errors
docker compose -f docker-compose.production.yml logs backend \
  | grep '"level":"ERROR"'

# Manifest cache misses (full recomputes)
docker compose -f docker-compose.production.yml logs backend \
  | grep '"cache_hit":false'

# Slow manifest computes (> 100 ms)
docker compose -f docker-compose.production.yml logs backend \
  | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        e = json.loads(line)
        if e.get('event') == 'manifest.computed' and e.get('duration_ms', 0) > 100:
            print(json.dumps(e, indent=2))
    except: pass
"

# Rate-limited requests (429)
docker compose -f docker-compose.production.yml logs backend \
  | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        e = json.loads(line)
        if e.get('status') == 429:
            print(json.dumps(e))
    except: pass
"
```

---

## 4. Identifying Unhealthy Screens

### Via health endpoint

```bash
curl https://yourdomain.com/api/health/ready | python3 -m json.tool
# Shows: cached_screens count, oldest_entry_s
```

### Via screens endpoint

```bash
# List all screens and their last_seen_at
curl https://yourdomain.com/api/screens | python3 -c "
import sys, json
from datetime import datetime, timezone
screens = json.load(sys.stdin)
now = datetime.now(timezone.utc)
for s in screens:
    if s.get('last_seen_at'):
        last = datetime.fromisoformat(s['last_seen_at'].replace('Z', '+00:00'))
        age_min = (now - last).seconds // 60
        status = 'STALE' if age_min > 30 else 'OK'
        print(f'{status:6}  {s[\"id\"]:30}  last seen {age_min}m ago  ({s[\"name\"]})')
    else:
        print(f'NEVER  {s[\"id\"]:30}  never seen')
"
```

A screen that hasn't sent a heartbeat in > 30 minutes should be investigated:
- Is the Pi powered on?
- Can the Pi reach the backend URL?
- Is the screen in the `screens` table with the correct `venue_id`?

### Via backend logs

```bash
# Screens with consecutive poll failures
docker compose -f docker-compose.production.yml logs backend \
  | grep '"event":"poll.failure"' \
  | python3 -c "
import sys, json
counts = {}
for line in sys.stdin:
    try:
        e = json.loads(line)
        s = e.get('screen_id', 'unknown')
        counts[s] = counts.get(s, 0) + 1
    except: pass
for s, n in sorted(counts.items(), key=lambda x: -x[1]):
    print(f'{n:4}  failures  {s}')
"
```

---

## 5. Handling Offline Venues

When an entire venue loses internet connectivity:

1. **Screens fall back to cached manifests automatically** — the last successful
   manifest is stored in localStorage (browser) or disk (Pi appliance mode).
   Content continues playing from cache indefinitely.

2. **No action is required from ops** — recovery is automatic when connectivity
   returns. Screens will resume polling and pick up any changes.

3. **If the venue has been offline for > 2 hours**, the system fallback slide
   (`"Welcome"`) may appear briefly if the cache is cleared. This is recoverable
   by restoring connectivity.

### Forcing a cache refresh (after reconnect)

```bash
# Clear the manifest cache for all screens at a venue
# (forces fresh recompute on next poll)
docker compose -f docker-compose.production.yml exec postgres \
  psql -U clubhub -c "
    DELETE FROM manifest_cache
    WHERE screen_id IN (
      SELECT id FROM screens WHERE venue_id = 'venue-your-id'
    );
  "
```

---

## 6. Rolling Upgrades

### Application code only (no DB schema change)

```bash
cd /opt/clubhub
git pull origin main

# Rebuild backend image only
docker compose -f docker-compose.production.yml build backend

# Rolling restart: Caddy buffers requests during the ~5s restart window
docker compose -f docker-compose.production.yml up -d --no-deps backend

# Verify
curl https://yourdomain.com/api/health/ready
```

Screens will experience at most one poll failure during the restart (they'll
fall back to cache and recover automatically on the next poll).

### With DB schema changes

```bash
# 1. Backup first
make backup-prod

# 2. Apply migration (non-destructive additions only)
docker compose -f docker-compose.production.yml exec postgres \
  psql -U clubhub clubhub \
  -f /docker-entrypoint-initdb.d/03-migrate_003.sql   # mount the file first

# 3. Restart backend
docker compose -f docker-compose.production.yml up -d --no-deps backend
```

### Emergency rollback

```bash
# Roll back to previous git tag
git checkout v1.2.3
docker compose -f docker-compose.production.yml up -d --build --no-deps backend
```

---

## 7. Common Error Reference

| Log event | Meaning | Action |
|-----------|---------|--------|
| `screen.auto_registered` | Unknown screen polled the API | Pre-create screens via POST /screens for correct venue assignment |
| `manifest.timezone_fallback` | Venue has invalid timezone in DB | Fix venue timezone via PATCH /venues/:id |
| `manifest.computed cache_hit:false` | Fresh manifest computed (normal) | Investigate if rate is very high (>4/min/screen) |
| `manifest.stale_warning` | Manifest hasn't changed in > 2min | Check if content/schedules are set up correctly |
| `watchdog.triggered` | Pi had 3+ consecutive poll failures | Check Pi network connectivity; backend connectivity from Pi |
| `http.request status:429` | Rate limit hit | Investigate unusual request bursts; check for misbehaving clients |
| `http.request status:503` | Request timed out (10s limit) | DB may be overloaded; check postgres load |

---

## Appendix: Useful One-Liners

```bash
# Count requests by status code in the last hour
docker compose -f docker-compose.production.yml logs --since=1h backend \
  | grep '"event":"http.request"' \
  | python3 -c "
import sys, json, collections
c = collections.Counter()
for l in sys.stdin:
    try: c[json.loads(l).get('status', '?')] += 1
    except: pass
for s, n in sorted(c.items()): print(f'  {s}: {n}')
"

# Average manifest compute time
docker compose -f docker-compose.production.yml logs backend \
  | python3 -c "
import sys, json
ms = [json.loads(l).get('duration_ms') for l in sys.stdin
      if '\"manifest.computed\"' in l and '\"cache_hit\":false' in l]
ms = [m for m in ms if isinstance(m, (int, float))]
if ms: print(f'avg {sum(ms)/len(ms):.1f}ms, p95 {sorted(ms)[int(len(ms)*.95)]:.1f}ms, n={len(ms)}')
"

# Which screens haven't been seen for > 1 hour
curl -s http://localhost:4000/screens \
  | python3 -c "
import sys, json
from datetime import datetime, timezone
screens = json.load(sys.stdin)
now = datetime.now(timezone.utc)
for s in screens:
    if s.get('last_seen_at'):
        last = datetime.fromisoformat(s['last_seen_at'].replace('Z', '+00:00'))
        if (now - last).seconds > 3600:
            print(s['id'], s.get('name'))
"
```
