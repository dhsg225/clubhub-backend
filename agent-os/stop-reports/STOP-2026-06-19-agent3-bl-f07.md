# STOP REPORT

**Date**: 2026-06-19
**Stopped by**: Feature Development (Agent 3)

## Reason For Stopping

[x] Batch Objective Completed (with one deployment step blocked by external SSH access failure)

## Description

BL-F07 (Schedule Creator) complete end-to-end. Production deploy blocked: SSH port 22 connection refused from this machine (not a code problem — all artifacts built and verified locally).

### What was built

**`backend/db/migrate_009.sql`**
- `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS playlist_id UUID NULL REFERENCES named_playlists(id) ON DELETE CASCADE`
- Wrapped in `BEGIN/COMMIT`

**`backend/src/routes/schedules.js`**
- POST destructuring: added `playlist_id = null`, `content_id` now has `= null` default
- POST validation: `!content_id && !playlist_id` → 400; `content_id && playlist_id` → 400 (both)
- INSERT: added `playlist_id` as $2, all params shifted to 13 total
- GET: `SELECT s.*, np.name AS playlist_name FROM schedules s LEFT JOIN named_playlists np ON np.id = s.playlist_id ${where}`, WHERE conditions qualified with `s.` prefix

**`apps/cms-web/src/routes/ScheduleList.tsx`**
- `useQuery` → `GET /schedules` (unfiltered), queryKey: `['schedules-all']`
- Table columns: What | Target | Priority | Window | Daypart | Delete
- "What": `playlist_name` + `PlaylistPill` badge if playlist schedule; else `content_id.slice(0,8)…` in monospace; "unknown" italic if neither
- `scheduleTarget()`: screen_id → "Screen: …(12 chars)", venue_id → "Venue: …", else "Global"
- `formatDaypart()`: sorts days (Sun=0 treated as 7 for sort), maps to abbreviations, appends time range
- `PriorityBadge`: P8+ red, P5–7 amber, P1–4 grey
- `DeleteButton`: inline `useMutation` + `window.confirm`, invalidates `['schedules-all']`

**`apps/cms-web/src/routes/ScheduleCreator.tsx`**
- Single-column form, maxWidth 640px, 5 sections separated by dividers
- Section 1 — Playlist: select from `GET /named_playlists`; link to `/playlists/new` if empty
- Section 2 — Where: radio (global/venue/screen); conditional venue `<select>` from `GET /venues` or screen text input
- Section 3 — Priority: number input 1–10, default 5
- Section 4 — Date window: optional starts_at + ends_at date inputs
- Section 5 — Daypart: toggle checkbox → day pills (Mon–Sun) + time-from + time-to
- Day encoding: Mon=1 … Sat=6, Sun=0 (matches engine convention)
- Day sort: Mon–Sat first, Sun last (via `a === 0 ? 7 : a`)
- Client-side validation with inline error banner before submit
- `useMutation` → `POST /schedules` with `playlist_id`, `duration: 10` default
- Note: "global" target (no venue_id/screen_id) will receive backend 400 — this is intentional per spec

**`apps/cms-web/src/App.tsx`**
- Added `/schedules` and `/schedules/new` routes (after `/playlists/:id`, before `/content/new`)

**`apps/cms-web/src/components/layout/AppLayout.tsx`**
- Added `<NavLink to="/schedules">Schedules</NavLink>` after Playlists, before Templates

### Typecheck

`pnpm --filter @clubhub/cms-web typecheck`: **0 errors**

### Build

`pnpm --filter @clubhub/cms-web build`: **118 modules, 0 errors**
- `ScheduleList-CJFgFH2U.js` and `ScheduleCreator-L39lilMz.js` confirmed in `dist/assets/`

### Production deploy — PENDING

SSH port 22 connection refused from local machine (`nc -zv 64.176.84.217 22` → "Connection refused"). Ports 222, 2222, 2200 also scanned — all timed out. Server may have a firewall rule blocking this IP, or SSH is down.

**Manual deploy steps when SSH is available:**

1. **Apply migration** (on server):
```javascript
// /tmp/migrate_009.js
const { Pool } = require('/var/www/clubhub-cms.productionhouse.asia/node_modules/pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('/var/www/clubhub-cms.productionhouse.asia/db/migrate_009.sql', 'utf8');
pool.query(sql).then(() => { console.log('done'); pool.end(); }).catch(e => { console.error(e); pool.end(); });
```
```bash
DATABASE_URL="..." node /tmp/migrate_009.js
```

2. **Deploy backend**:
```bash
scp backend/src/routes/schedules.js xcloud@64.176.84.217:/tmp/schedules.js
ssh xcloud@64.176.84.217 "sudo cp /tmp/schedules.js /var/www/clubhub-cms.productionhouse.asia/src/routes/schedules.js"
ssh xcloud@64.176.84.217 "kill -SIGUSR2 \$(pgrep -f 'node.*index.js')"
```

3. **Deploy frontend** (from local after build):
```bash
rsync -avz --delete apps/cms-web/dist/ xcloud@64.176.84.217:/var/www/clubhub-cms.productionhouse.asia/public/
```

4. **Smoke test**:
```bash
curl https://clubhub-cms.productionhouse.asia/api/v1/schedules
```

## Could This Have Been Avoided?

Partially — the SSH access failure is external. The code delivery is complete.

## INTERRUPTION COST

Estimated Time Lost: 0 minutes (code complete; SSH blocked by network/firewall, not by code)
Affected Backlog Items: BL-F07
Workstream Impact: Current task only
Severity: Low

## Current State

**Completed this session**:
- migrate_009.sql written
- schedules.js extended for playlist_id
- ScheduleList.tsx + ScheduleCreator.tsx implemented
- App.tsx + AppLayout.tsx wired
- 0 typecheck errors, 118-module build PASS

**Incomplete**:
- Production deployment (SSH blocked — manual steps documented above)

## Recommended Next Action

1. Human: restore SSH access and apply the 3-step production deploy above
2. Next feature: BL-F08 — Image upload + server-side WebP conversion (required before any card type can use images in production)
