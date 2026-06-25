# Project State
**Last updated**: 2026-06-23 | **Updated by**: Governance
**Read time**: ~3 minutes

---

## What This Project Is

ClubHub TV is a governed digital signage platform for hospitality venues. A Node.js/Express CMS API (PostgreSQL, port 4000) serves content schedules to Raspberry Pi 5 players running a TypeScript daemon (`player-runtime`) with 72-hour offline autonomy. A React/Vite operator CMS (`apps/cms-web`) provides full content authoring, playlist/schedule management, layout building, and fleet monitoring. The entire system is governed by a constitutional kernel: a 62-check CI contract gate, an append-only operator audit ledger, deterministic corpus replay, and a PRE (Policy Resolution Engine) that makes all scheduling decisions as a pure function.

**Production**: `clubhub-cms.productionhouse.asia` — live, PM2-managed, PostgreSQL on `127.0.0.1:5432`.

---

## Active Agents

| Agent | Role | Current Focus |
|---|---|---|
| Terminal Agent | Feature Development | BL-049 Widget Gallery (in flight) |

---

## Current Status — What's Working

### Infrastructure
| Feature | Status | Notes |
|---|---|---|
| CMS API (backend, port 4000) | ✅ Live on production | Express + PostgreSQL, migrations 001–020 applied |
| PRE.resolve() engine | ✅ Working | Pure function; 99/99 corpus vectors; 9/9 replay PASS |
| Player runtime daemon | ✅ Working | Orchestrator, corpus cache, heartbeat, asset manager |
| Governance kernel (62 checks) | ✅ Working | Contract gate wired; all 62 checks enforced |
| Screen auth enforcement | ✅ Live | `SCREEN_AUTH_ENFORCE=true`, `requireScreenToken` on `/manifest` |
| Multi-tenancy | ✅ Live | `tenants` table, `tenant_id` on all entity tables, `MULTI_TENANT_ENFORCE=false` (default tenant) |
| Integration test harness | ✅ Verified 2026-06-09 | 34/34 GREEN |

### CMS Operator UI (`apps/cms-web` — live at production URL)
| Feature | Status | Notes |
|---|---|---|
| Fleet Dashboard | ✅ Live | Venue list, machine state badges |
| Venue Dashboard | ✅ Live | Screen rows, 72h autonomy clock, content readiness, visual layout picker (BL-048) |
| Campaign List | ✅ Live | Content list, status badges, links to detail |
| Content Detail | ✅ Live | Field display, schedules panel |
| Content New (card authoring) | ✅ Live | Schema-driven from `card_templates` API, 5 templates, live 16:9 preview, Bunny image upload, "Write for me" AI button (Cognito), cross-post checkbox |
| Playlist Composer | ✅ Live | Named playlists, ordered card slots, duration per card |
| Schedule Creator | ✅ Live | Playlist → venue/screen → daypart window → zone targeting |
| Ticker Manager | ✅ Live | Text feed for `ticker_scroll` widget |
| Audit Log | ✅ Live | Live event log from audit-service |
| Layout Builder | ✅ Live | DB-backed layouts, grid editor, live SVG preview, widget slot config (BL-048) |
| Widget Gallery | 🔄 In progress | BL-049 sent to Terminal Agent |
| Responsive mobile | ✅ Live | Hamburger nav, stacked panels at 390px |
| Constitutional Console | ✅ Live | Read-only governance state |

### Content Rendering
| Feature | Status | Notes |
|---|---|---|
| promo_slide renderer | ✅ Live | Real renderer in ContentPreview + player-ui template-stubs |
| event_banner renderer | ✅ Live | Real renderer |
| sponsor_banner renderer | ✅ Live | Real renderer, tier badges |
| menu_board renderer | ✅ Live | Two-column sections |
| daily_specials renderer | ✅ Live | Accent red headline, price list |
| Card template catalogue | ✅ Live | `card_templates` table, 5 system templates, schema-driven form (D-019) |
| expires_at filtering | ✅ Live | Expired cards excluded from `GET /content` |

### Media Pipeline
| Feature | Status | Notes |
|---|---|---|
| Bunny.net upload tokens | ✅ Live | `POST /media/upload-token`, tenant-scoped paths |
| Direct-to-Bunny upload | ✅ Live | Browser PUTs to Bunny, never proxied through Node |
| Pi asset pre-download | ✅ Live | `asset-manager.ts` syncs `media_url` values to local disk before `PLAYLIST_UPDATE` |
| Sponsor portal upload | ✅ Live | Three-step flow: token → Bunny PUT → card register |

### Multi-Zone Layout Engine
| Feature | Status | Notes |
|---|---|---|
| Zone-aware `/resolve` | ✅ Live | Returns zones map + `layout_definition` JSONB |
| player-runtime zone polling | ✅ Live | `PLAYLIST_UPDATE` carries `{ screen_layout, zones, corpus_data }` |
| player-ui layout engine | ✅ Live | CSS grid per layout, per-zone card rotation, container queries |
| Widget Registry | ✅ Live | `registerWidget` / `instantiateWidget`, Clock + DateDisplay + TickerScroll |
| Dynamic layouts (DB-backed) | ✅ Live | `layouts` table, 4 system layouts + custom, player reads from corpus |

### Cognito Guru Bridge (invisible engine)
| Feature | Status | Notes |
|---|---|---|
| Venue auto-provisioning | ✅ Live | `provisionVenue()` fire-and-forget on `POST /tenants` |
| `cognito_mappings` table | ✅ Live | `clubhub_tenant_id ↔ cognito_client_id + cognito_project_id` |
| Social publishing | ✅ Live | `social-worker.js` → Cognito bridge `?endpoint=social_schedule&v=1` |
| AI copy generation | ✅ Live | `POST /ai/generate` → Cognito bridge `?endpoint=ai_generate&v=1`, "Write for me" in CMS |
| GBP posting | ⏳ Future | 501 stub in bridge; wired when Cognito GBP GCF is ready |

---

## ⚠️ Active Human Actions Required

1. **Set `COGNITO_SERVICE_KEY` on production** — AI generation and social publishing are deployed but gracefully skip when the key is blank. Obtain the key from the Cognito Guru GCF environment and add to `/var/www/clubhub-cms.productionhouse.asia/.env`.

2. **Connect social accounts per venue in Cognito UI** — before `social_schedule` can post for a venue, an operator must complete the OAuth flow in Cognito UI (Settings → Social Connections). One-time per venue.

3. **Hardware: first Pi 5 deployment** — everything that can be built without hardware is built. The platform is ready for a real Raspberry Pi 5 to enroll, pull corpus, render layouts, and report heartbeats. This is the next major milestone and unblocks BL-F10 and future playout items.

4. **Review and commit 5 uncommitted Frozen Map files** (carried over from early sessions — may already be resolved):
   - `backend/src/lib/distributed-authority.js`
   - `backend/src/lib/governed-config.js`
   - `backend/src/lib/incident-orchestrator.js`
   - `backend/src/lib/operator-ledger.js`
   - `test-runner/contracts/validate-contracts.js`
   Run `git diff backend/src/lib/` to check if still modified.

---

## Active Workstreams

- **BL-049 Widget Gallery** — IN PROGRESS (Terminal Agent). DB `widgets` table + `GET /widgets` API + WidgetGallery CMS surface + Layout Builder widget dropdown from API + widget config passed through to player-ui.

---

## Current Blockers

| Item | Blocker | Action |
|---|---|---|
| Social publishing (live) | `COGNITO_SERVICE_KEY` not set | Shannon to add key to production `.env` |
| AI "Write for me" (live) | `COGNITO_SERVICE_KEY` not set | Same |
| BL-F10 TV playout scheduler | No Pi hardware validated | First Pi deployment required |

---

## Next Recommended Actions (ranked)

1. **BL-049** — await Terminal Agent stop report (Widget Gallery in flight)
2. **Hardware** — first Pi 5 deployment and enrollment. Ping Shannon when Pi is available.
3. **`COGNITO_SERVICE_KEY`** — add to production `.env` to activate AI + social features
4. **BL-F01** — real JWT auth / operator SSO (currently mock login in CMS) — scope when hardware milestone is hit

---

## Architecture Snapshot

```
[Browser / Operator]
        │
   cms-web (React/Vite → backend/public/)   sponsor-portal (separate Vite app)
        │  REST
        ▼
[CMS API] backend (Express :4000)
   ├─ routes: content, venues, screens, schedules, playlists, ticker,
   │          card-templates, layouts, widgets, media, sponsor, ai,
   │          resolve, manifest, tenants, cognito-mappings, social-jobs
   ├─ middleware: tenantContext, screenAuth, operatorAuth, rateLimiter
   ├─ lib: manifestEngine, cognito-bridge, social-worker, asset pre-download
   └─ governance: operator-ledger, fleet-consensus, incident-orchestrator,
                  governed-config, distributed-authority, event-lineage
        │  pg Pool (max 10)
        ▼
   PostgreSQL (migrations 001–020)

[Cognito Guru — invisible engine]
   GCF: clubhub-bridge?endpoint=provision|ai_generate|social_schedule
   Auth: X-API-Key (COGNITO_SERVICE_KEY)

[Bunny.net CDN]
   Storage zone: clubhub-assets (Singapore edge)
   Upload: browser PUT directly (never proxied)

[Raspberry Pi 5 Player]
   player-runtime (Node ESM)
        │  HTTP poll /resolve + PATCH /screens/:id (heartbeat)
        ▼
   CMS API :4000
   pre-runtime (PRE.resolve() — pure function, governed clock)
   asset-manager (pre-downloads media_url assets → local disk)
   player-ui (Chromium, port 3001)
   └─ layout-engine → CSS grid zones → card rotation + widgets
```

**Migrations applied to production**: 001–020
**DB credentials**: `postgres://clubhub:ClubHub2026_Secure@127.0.0.1:5432/clubhub`
**SSH**: `ssh clubhub_cms@64.176.84.217` (key auth, no password)

---

## Governance Health

| Metric | Value |
|---|---|
| Active backlog items (TODO) | 1 (BL-049, in flight) |
| Active blockers | 2 (COGNITO_SERVICE_KEY, Pi hardware) |
| Governance gaps | PROJECT_STATE stale (now fixed), HORIZON.md template only |
| Contract gate | 62 checks, assumed passing |
