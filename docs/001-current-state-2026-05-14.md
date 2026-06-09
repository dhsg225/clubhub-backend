# ClubHub TV — Current State & Future Direction
**Document:** 001
**Date:** 2026-05-14
**Status:** Pre-simulation testing. Backend hardened. Local dev ready.

---

## What This Is

ClubHub TV is a digital signage platform for hospitality venues. It manages promotional content displayed on screens (Raspberry Pi kiosks) across multiple venues. Operators create and schedule slides in a web-based Studio. Each Pi polls the backend every 15 seconds for a compiled manifest telling it exactly what to display and when.

The system is designed for:
- Multiple venues, each with their own timezone
- Per-screen, per-group, or venue-wide content scheduling
- Priority-based content layering with fallback content
- Offline-resilient Pi playback (localStorage cache survives backend outages)
- Low operational overhead — no Kubernetes, no Prometheus, no message queue

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Studio (React CMS — localhost:3001)                       │
│  Create content → configure schedules → publish            │
└────────────────────────┬───────────────────────────────────┘
                         │  POST /content
                         │  POST /schedules
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Backend (Node.js/Express — localhost:4000)                │
│  ├── manifestEngine.js  — core scheduling brain            │
│  ├── manifest_cache     — 5s TTL, thundering-herd guard    │
│  └── PostgreSQL         — authoritative source of truth    │
└────────────────────────┬───────────────────────────────────┘
                         │  GET /manifest?screen_id=X
                         │  (polls every 15s with jitter)
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Player (React kiosk — localhost:3000)                     │
│  Pure renderer. No business logic. Plays from cache        │
│  indefinitely when backend is unreachable.                 │
└────────────────────────────────────────────────────────────┘

Shared package (@clubhub/shared):
  Types, PromoSlideRenderer, template registry, resolveRenderer
  Used by both Studio (preview) and Player (fullscreen)
```

### Services at a glance

| Service | Port | Runtime | Purpose |
|---|---|---|---|
| Backend | 4000 | Node 20 / Docker | API, manifest engine, DB |
| Postgres | 5432 | Docker | Data store |
| Studio | 3001 | Vite dev server | Operator CMS |
| Player | 3000 | Vite dev server | Screen renderer / Pi sim |

---

## Monorepo Structure

```
clubhub_player/
├── package.json              — npm workspaces root (shared, studio, player)
├── docker-compose.yml        — postgres + backend
├── RUN.md                    — local dev quick-start
├── docs/                     — this folder
│
├── backend/
│   ├── Dockerfile
│   ├── .env                  — DATABASE_URL, PORT, UPLOAD_DIR
│   ├── src/
│   │   ├── index.js          — Express server entry
│   │   ├── db.js             — pg Pool (max:10, idle:30s, timeout:8s)
│   │   ├── lib/
│   │   │   └── manifestEngine.js  — scheduling + manifest compute
│   │   └── routes/
│   │       ├── manifest.js   — GET /manifest
│   │       ├── content.js    — CRUD /content
│   │       ├── schedules.js  — CRUD /schedules
│   │       ├── screens.js    — CRUD /screens
│   │       ├── venues.js     — CRUD /venues
│   │       ├── playlist.js   — legacy /playlist/generate
│   │       ├── assets.js     — POST /asset/upload
│   │       └── health.js     — GET /health
│   └── db/
│       ├── init.sql          — base schema (content, playlists)
│       ├── migrate_001.sql   — full schema (venues, screens, schedules, cache)
│       └── migrate_002.sql   — performance indexes
│
├── player/
│   ├── .env                  — VITE_BACKEND_URL=http://localhost:4000
│   ├── .env.example          — template for prod builds
│   └── src/
│       ├── App.tsx           — slide loop, version detection, overlays
│       ├── useManifest.ts    — polling hook with jitter
│       ├── FullscreenRenderer.tsx
│       └── vite-env.d.ts     — ImportMetaEnv types
│
├── studio/
│   └── src/
│       ├── App.tsx
│       ├── api.ts            — all backend API calls
│       └── components/
│           ├── CreateTab.tsx
│           ├── ContentTab.tsx
│           ├── PlaylistTab.tsx
│           └── ScheduleModal.tsx  — schedule form with TZ-safe datetime
│
└── shared/
    └── src/
        ├── types.ts           — Manifest, ManifestItem, PromoSlideData, TemplateDef
        ├── templates.ts       — TEMPLATE_REGISTRY (currently: promo_slide)
        ├── resolveRenderer.tsx — type:version → React component lookup
        └── PromoSlideRenderer.tsx — 1920×1080 fullscreen slide component
```

---

## Database Schema

### Tables (after all migrations)

| Table | Purpose |
|---|---|
| `content` | Raw content rows. `template_type` + `data` JSONB. |
| `playlists` | **Legacy.** screen_id → items array. Kept for backward compat. |
| `templates` | Template registry (type, version, JSON schema). |
| `venues` | Venue records. Has `timezone` (IANA string). |
| `screens` | Physical devices. FK to `venues`. Has `screen_group`. |
| `schedules` | Scheduling rules. FK to content + venue/screen. Priority, time windows, fallback flag. |
| `manifest_cache` | Pre-computed manifests. PK: screen_id. TTL: 5 seconds. Version + checksum. |

### Indexes (migrate_002.sql)

```sql
idx_schedules_screen_group   — partial on schedules(screen_group) WHERE NOT NULL
idx_schedules_content_screen — covering on schedules(content_id, screen_id) WHERE NOT NULL
```

**Still missing (future migration):**
```sql
idx_schedules_venue_unscoped — schedules(venue_id) WHERE screen_id IS NULL AND screen_group IS NULL
idx_schedules_global         — schedules(is_fallback, priority) WHERE all three NULL
idx_schedules_content_window — schedules(content_id, starts_at, ends_at) for status query
```

---

## What Is Currently Built and Working

### Core data flow
- [x] Create content via Studio
- [x] Schedule content with priority, time windows, day-of-week, fallback flag
- [x] Manifest engine computes per-screen content playlist from schedules
- [x] Player polls every 15s and renders slides
- [x] Player plays from localStorage cache when backend is offline
- [x] Version-bump detection — player resets to slide 0 on manifest change

### Manifest engine
- [x] FNV-1a checksum includes content data (version bumps on data edits)
- [x] Two-clock timezone model (UTC for starts_at/ends_at, venue-local for time-of-day windows)
- [x] Venue timezone fallback to UTC when DB timezone string is invalid
- [x] Atomic version increment via `SELECT FOR UPDATE` transaction
- [x] Thundering-herd cache (5s TTL, `manifest_cache` table)
- [x] `valid_until` computed from earliest schedule end boundary
- [x] Priority-based deduplication: screen > group > venue > global
- [x] Fallback content promoted when no scheduled content is active
- [x] Legacy playlist bridge (reads `playlists` table if schedules produce nothing)
- [x] System fallback slide (screen is never blank)

### Validation and safety
- [x] Minimum duration 3s enforced at API and player (prevents Chromium lockup)
- [x] `days_of_week` values validated to range [0–6]
- [x] `screen_id` max 100 chars enforced at manifest and schedule routes
- [x] `starts_at`/`ends_at` in Studio converted from browser local TZ to UTC ISO
- [x] Cache bust on schedule create, delete, and content delete
- [x] FIX-7: Cache bust before content delete (three-arm UNION for global schedules)

### Infrastructure
- [x] pg pool: `max:10`, `idleTimeoutMillis:30s`, `connectionTimeoutMillis:8s`
- [x] Poisoned connections destroyed on transaction failure (`client.release(err)`)
- [x] Auto-registration of unknown screens — FK-safe (ensures venue-1 exists first)
- [x] Compute timing logged as structured JSON (`manifest.computed` events)
- [x] Cache bust logged (`manifest.cache_bust` events)
- [x] Player backend URL from `VITE_BACKEND_URL` env var (not hardcoded)
- [x] Player poll jitter (0–15s random startup delay, prevents synchronized herd)

---

## Known Remaining Issues

### Medium priority

| Issue | Location | Impact |
|---|---|---|
| `TIME` column comparison off by 1 min at boundary | `manifestEngine.js:scheduleActive` | `"10:30" < "10:30:00"` — schedule starts at 10:31, not 10:30 |
| Global schedule changes (screen_id=NULL, venue_id=NULL) don't bust cache | `schedules.js` POST + DELETE | Stale content for up to 5s TTL |
| Operator TZ ≠ venue TZ in ScheduleModal | `ScheduleModal.tsx` | starts_at/ends_at converted using browser TZ, not venue TZ |
| `PATCH /venues/:id` accepts invalid timezone strings | `venues.js` | Silently stored; all screens in venue fall back to UTC scheduling |

### Low priority / architectural

| Issue | Notes |
|---|---|
| Legacy `playlists` table has no drain path | Studio has no UI to manage playlists. Zombie content can appear if playlists exist. Consider deprecation migration. |
| Auto-registration always assigns `venue-1` | Acceptable for dev; screens must be pre-created for multi-venue prod deployments |
| No player auto-reload on build deploy | Pis keep running old Chromium-cached build after a player redeploy |
| No `migrate_002.sql` applied automatically | Must be run manually via migration script |
| No docker log rotation configured | `docker-compose.yml` has no `logging:` stanza — disk fills over time in prod |

### Load limits (current pool settings)

| Screens | Cold-start safety | Notes |
|---|---|---|
| 5–50 | Safe | Current target range |
| 50–150 | Safe | Minor queue buildup on restart |
| 150–300 | Survivable | ~10% timeout rate on first poll after restart; recovers |
| 300+ | Needs `max:25` | See scale thresholds in `db.js` comments |

---

## Currently Active Template

**`promo_slide` v1**

| Field | Type | Required |
|---|---|---|
| headline | text | Yes (max 80 chars) |
| subheadline | text | No (max 120 chars) |
| image | image URL | No |

This is the only template. Adding a new template requires:
1. Add type definition to `shared/src/templates.ts`
2. Add renderer component to `shared/src/`
3. Register in `resolveRenderer.tsx`
4. Add DB insert to `migrate_XXX.sql`

---

## Local Dev Quick Start

```bash
# 1. Install all dependencies (monorepo root)
npm install

# 2. Start Postgres + backend
docker compose up

# 3. Apply migrations (first time / after reset)
docker exec -i clubhub_player-postgres-1 psql -U clubhub -d clubhub < backend/db/migrate_001.sql
docker exec -i clubhub_player-postgres-1 psql -U clubhub -d clubhub < backend/db/migrate_002.sql

# 4. Start Studio (new terminal)
npm run dev:studio
# → http://localhost:3001

# 5. Start Player (new terminal)
npm run dev --workspace=player
# → http://localhost:3000?screen_id=screen-1
# Note: first fetch is delayed by 0–15s (poll jitter) — this is correct behaviour
```

---

## API Surface

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/content` | Create content item |
| GET | `/content` | List all content with lifecycle status |
| GET | `/content/:id` | Get single content |
| DELETE | `/content/:id` | Delete content + bust manifest cache |
| GET | `/manifest?screen_id=X` | Fetch compiled manifest (player polls this) |
| POST | `/schedules` | Create schedule |
| GET | `/schedules?content_id=&screen_id=&venue_id=` | List schedules |
| GET | `/schedules/:id` | Get single schedule |
| DELETE | `/schedules/:id` | Delete schedule + bust manifest cache |
| POST | `/screens` | Register screen |
| GET | `/screens?venue_id=X` | List screens |
| PATCH | `/screens/:id/heartbeat` | Update last_seen_at |
| POST | `/venues` | Create venue |
| GET | `/venues` | List venues |
| PATCH | `/venues/:id` | Update venue name/timezone |
| POST | `/asset/upload` | Upload image (multipart) |
| POST | `/playlist/generate` | Legacy: build playlist from content IDs |

---

## Future Direction

### Next immediate step — local simulation testing

Before any production work, verify the full local flow end-to-end:

1. Studio creates content and schedules
2. Player receives manifest and renders slide
3. Edit content in Studio → player detects version change and updates
4. Delete content → player gracefully transitions to fallback or empty state
5. Simulate offline backend → player shows cached content + offline banner
6. Simulate multiple screens via `?screen_id=screen-2`

### Near-term hardening (pre-production)

These are the concrete next steps in priority order:

**1. Fix `TIME` column comparison (1-line fix)**
Append `:00` to `hhmm` in `scheduleActive` so it compares correctly against pg's `"HH:MM:SS"` format.

**2. Add timezone validation to `PATCH /venues/:id`**
Validate the timezone string against Postgres before accepting it. Simple: attempt `SELECT NOW() AT TIME ZONE $1` and return 400 if it throws.

**3. Fix global schedule cache bust in `schedules.js`**
Add the missing `else` branch for when both `screen_id` and `venue_id` are NULL. Bust all screen caches.

**4. Add docker log rotation to `docker-compose.yml`**
```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"
```

**5. Add the three missing indexes (`migrate_003.sql`)**
`idx_schedules_venue_unscoped`, `idx_schedules_global`, `idx_schedules_content_window`.

### Medium-term (first real venue deployment)

**Observability layer (already designed, not yet built)**

Three tables are designed and ready to implement:
- `screen_heartbeats` — Pi last-seen, current version, slide state
- `screen_events` — boot, crash, version_change events (sparse, state-change only)
- `manifest_compute_log` — per-compute timing and cache-hit/miss stats

With a Grafana + native Postgres datasource, this gives:
- Offline screen detection (last_seen > 10 min)
- Version drift across fleet
- Manifest compute p95 latency
- Boot loop detection

**Production deployment prerequisites**

- Caddy 2 reverse proxy (automatic HTTPS)
- Tailscale for Pi remote access
- `pg_dump` cron to S3/Backblaze
- `deploy.sh` script using tagged Docker images by git SHA
- `migrate.sh` script with `schema_migrations` tracking table
- Docker log rotation
- Production `VITE_BACKEND_URL` baked into player build

### Longer-term (multi-template / multi-venue scale)

- **Additional templates**: menu boards, event countdowns, social feeds — each requires a new renderer in `shared/`, DB entry in `templates`, and Studio form fields
- **Studio venue/screen selector**: currently hardcoded to `venue-1` in `ScheduleModal.tsx` — needs a venue picker that also converts `starts_at`/`ends_at` using the *venue's* timezone, not the operator's browser timezone
- **Pool scaling**: bump `max` to 25 at ~150 screens; add `pg_bouncer` or increase Postgres `max_connections` past 500 screens
- **Player reload mechanism**: manifest `player_version` field + `window.location.reload()` on version bump in `useManifest.ts` — enables zero-touch player updates without touching each Pi

---

## Decisions Made and Why

| Decision | Rationale |
|---|---|
| Manifest pulled by player (not pushed) | Simpler. Pi doesn't need a persistent connection. Works through any NAT/firewall. Offline resilience is free. |
| PostgreSQL as manifest cache | No Redis dependency. 5s TTL is enough. `manifest_cache` table is the entire caching layer. |
| FNV-1a checksum (no deps) | 8-byte hex, fast, sufficient uniqueness for playlist change detection. No npm dep needed. |
| `SELECT FOR UPDATE` for version atomicity | Eliminates TOCTOU race on version number without a separate version sequence or optimistic lock retry loop. |
| Two-clock model for timezone | Postgres `NOW() AT TIME ZONE tz` returns a TZ-stripped string; V8 places it in UTC slots. `getUTCDay()/getUTCHours()` read correct venue-local values. No tz library needed. |
| No tz library dependency | Avoids `moment-timezone`, `date-fns-tz`, `luxon` — all have their own correctness edge cases. Postgres is the authoritative clock. |
| `client.release(err)` on transaction failure | pg destroys the connection rather than recycling it. Prevents aborted transactions poisoning the pool for subsequent unrelated requests. |
| Poll jitter (0–15s random startup delay) | Prevents 300 Pis booting together from creating a synchronized thundering herd on every 15s interval for the lifetime of the backend process. |
| Single VPS, Docker Compose | Right-sized for initial deployment. No Kubernetes. No managed services beyond object storage for backups. Upgrade path is clear when needed. |

---

*End of document 001.*
