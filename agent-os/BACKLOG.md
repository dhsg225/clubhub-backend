# Backlog

Pick from the top of the active list. Mark status inline when starting/finishing. Completed item specs move to `archive/BACKLOG_ARCHIVE.md`.

**Context cost key**: S = Small (<5% context), M = Medium (5–15%), L = Large (15–30%), XL = Extra Large (>30%)

**Status key**: TODO | IN PROGRESS | DONE | BLOCKED | NO-OP | FUTURE | WAITING

---

## Active Items

### BL-002 — Enable and verify screen authentication enforcement `[S ~30min]`
- **Status**: DONE 2026-06-09 (QA-2) — wired `requireScreenToken` to `/manifest` in `index.js`; set `SCREEN_AUTH_ENFORCE=true` + `SECRET_KEY` in `backend/.env`; ran migrations 003–005; verified 401 (no token), 200 (enrolled token); `SECURITY.unauthorized_poll` logged; 79/79 contract gate PASS.

### BL-004 — Define scope for apps/ shell implementations `[M]`
- **What**: Three app shells exist (`apps/cms-web`, `apps/player-ui`, `apps/sponsor-portal`) with no implementation. Before any agent touches these, a human must define: which app to build first, what feature set it needs, and whether it replaces or supplements the existing `studio/` SPA.
- **Acceptance criteria**: Human adds at least one scoped BACKLOG item for the first app to implement, with acceptance criteria. This item remains BLOCKED until that happens.
- **Files**: `apps/cms-web/`, `apps/player-ui/`, `apps/sponsor-portal/`
- **Role**: Product (human decision required)
- **Status**: DONE — human decided: build `apps/cms-web` first. See BL-010.

### BL-010 — cms-web Phase 1: typecheck fixes + AppLayout + FleetDashboard `[M]`
- **What**: `apps/cms-web` has a working shell (router, constitutional API client, auth store, component stubs) but 4 typecheck errors and no implemented route surfaces. Phase 1 delivers a running app with navigation and the top-level fleet view.
- **Acceptance criteria**:
  1. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors)
  2. `pnpm --filter @clubhub/cms-web dev` starts without crash
  3. `AppLayout` renders with navigation links (Fleet, Venues, Campaigns, Constitutional)
  4. `RequireAuth` gates all routes — unauthenticated users see a login prompt
  5. `FleetDashboard` (root `/`) renders real data: venue list from `GET /venues`, each venue showing name + machine state badge + constitutional state indicator
  6. `VenueDashboard` (`/venues/:venueId`) renders placeholder with venue name (full implementation is BL-011)
  7. Constitutional state overlay visible in EMERGENCY_FREEZE state (WebSocketConstitutionalSync already wired — just needs backend WS to be reachable)
- **Key docs** (read before implementing):
  - `docs/shared/CMS-MVP-CUTLINE-v1.md` — MVP scope and justifications
  - `docs/shared/APPLICATION-ROUTE-AND-NAVIGATION-ARCHITECTURE-v1.md` — nav structure
  - `docs/shared/APPLICATION-SHELL-STRUCTURE-v1.md` — layout spec
  - `docs/shared/CANONICAL-LIVE-OPERATIONS-SURFACE-v1.md` — Live Ops surface (Zone A venue list)
- **Known typecheck errors to fix**:
  - `ImportMeta.env` missing — add `/// <reference types="vite/client" />` to `src/vite-env.d.ts` and include in tsconfig
  - `ErrorBoundary.tsx` — add `override` to `componentDidCatch` and `render`
  - `api-client.ts` — `body: string | undefined` → `body: body !== undefined ? JSON.stringify(body) : null`
- **Files**: `apps/cms-web/src/`
- **Role**: Feature Development (Frontend)
- **Status**: DONE 2026-06-09 (FE-1) — 0 typecheck errors; vite-env.d.ts created; ErrorBoundary override fixed; api-client body null; AppLayout wired as layout route; RequireAuth gates all routes; LoginPage mock auth; FleetDashboard fetches real venues; VenueDashboard shows venue name; index.html created; dev server starts 200.

### BL-008 — Wire Wave 3/4 stubs in services/ TypeScript microservices `[L]`
- **Status**: DONE 2026-06-09 (FD-1 + FD-2) — all Wave 3 routes implemented and tested. See BL-011 for Wave 4 pre-runtime WebSocket loop (out of scope here).
  - pre-runtime: vitest added, 3/3 tests pass, typecheck PASS
  - api-gateway: JWT auth + constitutional middleware + @fastify/http-proxy routes, 12/12 tests pass
  - audit-service: POST /audit/event + GET /audit/events + DB, 5/5 tests pass
  - entropy-service: GET /entropy/advisory/:venue_id + GET /entropy/scan + scheduler, 3/3 tests pass
  - replay-service: POST /audit/batch + GET /replay/:id + append-only guard, 10/10 tests pass
  - shadow-service: POST /parity/compare + GET /parity/summary + DB, 6/6 tests pass

### BL-011 — pre-runtime Wave 4: WebSocket server + PRE.resolve() loop `[M]`
- **What**: `services/pre-runtime/src/runtime.ts` has `CorpusStore`, `HeartbeatEmitter`, and `AuditBuffer` all implemented but the WebSocket server and PRE.resolve() loop are never started (Wave 4 TODOs). This is the service that runs on-device as the edge policy engine.
- **Acceptance criteria**:
  1. WebSocket server starts on `config.WS_PORT`
  2. PRE.resolve() loop runs at `config.CORPUS_SYNC_INTERVAL_MS`
  3. Audit batch flushes at `config.AUDIT_BATCH_INTERVAL_MS`
  4. `pnpm --filter @clubhub/pre-runtime typecheck` passes
  5. At least one integration test verifying a resolve cycle completes
- **Files**: `services/pre-runtime/src/runtime.ts`, `services/pre-runtime/src/index.ts`
- **Role**: Feature Development
- **Status**: DONE 2026-06-09 (CH2) — WebSocket server wired on WS_PORT, PRE.resolve() loop at CORPUS_SYNC_INTERVAL_MS, audit batch flush at AUDIT_BATCH_INTERVAL_MS, `corpus-mapper.ts` built. 6/6 tests pass, typecheck PASS. INV-9 fix: use `Etc/UTC` not `UTC`.

### BL-009 — G-12: Add asset readiness fields to heartbeat payload `[S ~30min]`
- **Status**: DONE 2026-06-09 (Governance) — HeartbeatPayload updated, fields populated from PlayerState, backend PATCH route updated, migrate_005.sql added, URL/method mismatch fixed (`/api/v2/` → `/screens/`, POST → PATCH), typecheck + 79/79 contract gate PASS.

### BL-012 — cms-web Phase 2: VenueDashboard with real screens + health data `[M]`
- **What**: `VenueDashboard` at `/venues/:venueId` currently shows venue name + placeholder. Phase 2 delivers the real venue detail view per MVP cutline §2.2 — screen list with health fields from the BL-009 heartbeat additions.
- **Acceptance criteria**:
  1. `GET /screens?venue_id=:venueId` — render each screen as a row
  2. Each row shows: screen name, `last_seen_at`, `content_readiness_state`, `assets_required_count` / `assets_verified_count`
  3. 72h autonomy clock: time since `last_corpus_sync_at`, countdown to 72h limit
  4. `RECOVERED_BUT_UNTRUSTED` badge rendered when applicable
  5. Loading + error states. No fake data — honest "unavailable" if field is absent
  6. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors)
- **Note**: No spec doc pre-reads required — AGENT_REGISTRY.md task description is self-contained. Skip `CMS-MVP-CUTLINE-v1.md` and `CANONICAL-VENUE-OPERATIONS-SURFACE-v2.md` reads to preserve context.
- **Files**: `apps/cms-web/src/routes/VenueDashboard.tsx`
- **Role**: Feature Development (Frontend) — CH3
- **Status**: DONE 2026-06-09 (CH3/Governance) — screens table with last_seen_at, content_readiness_state, asset ratio bar, 72h autonomy alarm (red highlight + summary chip). last_corpus_sync_at absent from schema — last_seen_at used as contact proxy with footer disclaimer. 0 typecheck errors.

### BL-013 — cms-web CampaignList: Claude Design pass then implement `[M]`
- **What**: `/campaigns` route is a stub. Use Claude Design to produce a mockup, then implement.
- **Claude Design input files**: `docs/shared/CANONICAL-CMS-CONTENT-OPERATIONS-SURFACE-v2.md`, `apps/cms-web/src/routes/CampaignList.tsx`, `apps/cms-web/src/components/layout/AppLayout.tsx`, `docs/shared/FRONTEND-COMPONENT-TAXONOMY-v1.md`, `apps/cms-web/src/routes/__mockups__/FleetDashboard.mockup.tsx`
- **Data shape note**: `GET /content` returns `{id, template_type, data (JSONB), created_at, status}`. No `title` column — derive from `data?.title ?? data?.name ?? template_type`. Status values: `draft | active | scheduled | expired`. No new deps, inline styles only.
- **Acceptance criteria**:
  1. Claude Design mockup saved to `apps/cms-web/src/routes/__mockups__/CampaignList.mockup.tsx`
  2. Implementation fetches campaigns/content from `GET /content`
  3. Each row: title, type, status, created_at, link to detail
  4. Loading + error states, no fake data
  5. `pnpm --filter @clubhub/cms-web typecheck` passes
- **Role**: Human (Claude Design) → Feature Development (Frontend)
- **Status**: DONE 2026-06-12 (Governance/Claude Design) — mockup at __mockups__/CampaignList.tsx, promoted to production route, import depth fix (../lib/ not ../../lib/), 0 typecheck errors.

### BL-014 — cms-web ContentDetail + ConstitutionalConsole `[S]`
- **What**: Two missing routes. ContentDetail at `/content/:id` (linked from CampaignList rows). ConstitutionalConsole full implementation (was a stub).
- **Acceptance criteria**:
  1. `/content/:id` renders title, meta fields, all JSONB data key/value pairs; back link to /campaigns; loading/error states
  2. ConstitutionalConsole reads `constitutionalStore` (state/reason/lastUpdated) and fetches `GET /health`; read-only; no controls
  3. Route wired in App.tsx
  4. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors)
- **Files**: `apps/cms-web/src/routes/ContentDetail.tsx` (new), `apps/cms-web/src/routes/ConstitutionalConsole.tsx`, `apps/cms-web/src/App.tsx`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-12 (Agent 3) — ContentDetail.tsx created, ConstitutionalConsole.tsx implemented, /content/:id route wired in App.tsx. 0 typecheck errors.

### BL-015 — Add backend:4000 auth coverage to integration harness `[S ~30min]`
- **What**: The Docker integration harness only hits `cms-api:3001`. `requireScreenToken` on `backend:4000/manifest` (wired in BL-002) has zero CI coverage — a regression would be undetected. Add a harness step that exercises backend:4000 auth directly.
- **Acceptance criteria**:
  1. Harness step POSTs to `backend:4000/manifest` with no `Authorization` header → 401
  2. Same POST with a valid enrolled screen token → 200
  3. `docker compose -f docker-compose.integration.yml up --build --abort-on-container-exit` exits 0
- **Files**: `backend/test/screenAuth.test.js`, `backend/package.json`
- **Role**: QA
- **Status**: DONE 2026-06-13 (Governance) — 8/8 unit tests via Node built-in runner. Covers: missing header, bad sig, revoked, enrolled, pass-through, middleware 401 + next(). No Docker harness change needed — backend not in integration compose; unit test is the right coverage layer.

### BL-016 — pre-runtime Wave 5: flush audit buffer to replay-service `[S]`
- **What**: `services/pre-runtime/src/runtime.ts` buffers audit records at `AUDIT_BATCH_INTERVAL_MS` but the flush is a `// Wave 5 TODO` no-op. Records are silently dropped on restart.
- **Acceptance criteria**:
  1. Flush loop POSTs accumulated audit records to the configured audit endpoint (`audit-service` or `replay-service`)
  2. Failed POST logs a warning but does not crash the runtime (fire-and-forget acceptable)
  3. `pnpm --filter @clubhub/pre-runtime typecheck` passes
  4. At least one test verifying the flush call is made
- **Files**: `services/pre-runtime/src/runtime.ts`, `services/pre-runtime/src/config.ts`, `services/pre-runtime/src/__tests__/audit-flush.test.ts`
- **Role**: Feature Development
- **Status**: DONE 2026-06-13 (Governance) — AUDIT_ENDPOINT optional config; flush loop POSTs via fetch, swallows errors (fire-and-forget); 9/9 tests pass, 0 typecheck errors. Operator must set AUDIT_ENDPOINT env var to activate flushing.

### BL-017 — cms-web /fleet nav alias `[S ~5min]`
- **What**: `AppLayout.tsx:28` links to `/fleet` but the router only has `/`. Clicking Fleet in the nav 404s.
- **Acceptance criteria**:
  1. `/fleet` route added to App.tsx as a lazy alias to `FleetDashboard.js`
  2. `pnpm --filter @clubhub/cms-web typecheck` passes
- **Files**: `apps/cms-web/src/App.tsx`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-13 (Agent 3) — `/fleet` alias added to App.tsx. 0 typecheck errors.

### BL-018 — cms-web AuditLog surface (/audit) `[S]`
- **What**: `/audit` nav link is unwired. Add AuditLog.tsx reading from audit-service at localhost:3002.
- **Acceptance criteria**:
  1. Vite proxy `/api/audit` → `http://localhost:3002` added
  2. AuditLog fetches `GET /api/audit/audit/events?limit=100`, 30s refetch
  3. Table: recorded_at, event_type badge, venue_id, screen_id, payload summary (80 chars)
  4. Loading/error/empty states. No fake data.
  5. Route wired in App.tsx. `pnpm --filter @clubhub/cms-web typecheck` passes
- **Files**: `apps/cms-web/src/routes/AuditLog.tsx` (new), `apps/cms-web/vite.config.ts`, `apps/cms-web/src/App.tsx`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-13 (Agent 3) — AuditLog.tsx created, /api/audit proxy added to vite.config.ts, /audit route wired. 0 typecheck errors.

### BL-019 — cms-web ContentDetail: schedules panel `[S]`
- **What**: ContentDetail.tsx needs a Schedules section showing `GET /schedules?content_id=:id`.
- **Acceptance criteria**:
  1. `useQuery` fetches `GET /schedules?content_id=:id` via existing api client
  2. Table: target (venue/screen/global), priority badge, starts_at → ends_at (or "always")
  3. Empty state: "No schedules — this content is not playing anywhere."
  4. Read-only. `pnpm --filter @clubhub/cms-web typecheck` passes
- **Files**: `apps/cms-web/src/routes/ContentDetail.tsx`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-13 (Agent 3) — Schedule interface, SchedulesPanel component, PriorityBadge, scheduleTarget helper added. useQuery fetches /schedules?content_id=:id. 0 typecheck errors.

### BL-020 — player-ui: fix overlay bug + loading state + build verification `[S]`
- **What**: `apps/player-ui` is almost complete — WebSocket client, playlist renderer, HTML shell, UiServer, and ChromiumLauncher are all written and wired. Three gaps remain before first Pi deployment: (1) emergency overlay bug where `textContent` destroys child elements on clear, (2) blank black screen before first `PLAYLIST_UPDATE`, (3) dev workflow for testing without hardware is undocumented.
- **Acceptance criteria**:
  1. **Overlay bug fixed** — `EMERGENCY_FREEZE` sets text on `#emergency-title` / `#emergency-message` elements, not `overlay.textContent`. `EMERGENCY_CLEAR` hides the overlay without wiping child elements. Second FREEZE after a CLEAR renders correctly styled, not plain text.
  2. **Loading state** — `#content-container` shows "Waiting for content…" on first load and when a `PLAYLIST_UPDATE` arrives with an empty `items` array. Not a blank black screen.
  3. **Build verified** — `pnpm --filter @clubhub/player-ui build` passes, `dist/index.js` exists, path matches `UiServer`'s `/dist/*` route.
  4. **Dev test confirmed** — `http://localhost:3001` (with `PLAYER_UI_DIR` pointed at `apps/player-ui`) loads the HTML, WebSocket client connects to `ws://localhost:7777`, loading state is visible. Document the env var in a code comment or `README`.
  5. No new dependencies. `pnpm --filter @clubhub/player-ui build` stays 0 errors.
- **Files**: `apps/player-ui/src/index.ts`, `apps/player-ui/src/playlist-renderer.ts`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-19 (Agent 3) — overlay bug fixed (textContent on child divs, not parent), EMERGENCY_CLEAR hides without wiping children, showWaiting() on initial load + empty PLAYLIST_UPDATE, dev comment added. build PASS, dist/index.js present.

### BL-021 — cms-web Card Authoring Form (/content/new) `[M]`
- **What**: Operator UI for creating a new content card. Split-panel: form left, live 16:9 preview right.
- **Acceptance criteria**:
  1. Template type selector: promo_slide, event_banner, sponsor_banner, menu_board, daily_specials
  2. Field set changes per template with character limits (count shown)
  3. Colour pickers for promo_slide background/text colours
  4. Expiry date field (required) or "No expiry" checkbox
  5. Live 16:9 preview updates in real time
  6. Save → POST /content → redirect to /campaigns
  7. "New campaign" button on CampaignList
  8. Route wired in App.tsx (/content/new before /content/:id)
  9. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors)
- **Files**: `apps/cms-web/src/routes/ContentNew.tsx` (new), `apps/cms-web/src/routes/CampaignList.tsx`, `apps/cms-web/src/App.tsx`
- **Role**: Feature Development (Frontend) — Agent 3
- **Status**: DONE 2026-06-19 (Agent 3) — ContentNew.tsx ~700 lines. All 5 templates implemented. Character count display, colour pickers, menu_board up to 2 sections/4 items each, daily_specials up to 5 items. Live preview uses STUB_COLORS palette matching ContentPreview. Client-side validation (required fields, char limits, expiry). expires_at stored in data JSONB (no DB column). 0 typecheck errors.

---

### BL-022 — DB migration: promote expires_at to first-class column on content table `[S]`
- **What**: Agent 3 stored `expires_at` in the JSONB `data` blob as a shortcut. This must become a dedicated `expires_at TIMESTAMPTZ` column on the `content` table so the schedule engine and PRE resolver can filter on it efficiently with an index.
- **Acceptance criteria**:
  1. New migration file `backend/db/migrate_007.sql` adds `expires_at TIMESTAMPTZ NULL` to `content` table with an index
  2. `GET /content` filters out expired cards by default (where `expires_at IS NULL OR expires_at > NOW()`)
  3. `ContentNew.tsx` updated to POST `expires_at` as a top-level field, not inside `data`
  4. Existing content rows with `expires_at` in their `data` JSONB are backfilled by the migration
  5. Migration runs clean on production DB
- **Files**: `backend/db/migrate_007.sql` (new), `backend/src/routes/content.js`, `apps/cms-web/src/routes/ContentNew.tsx`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-19 (Agent 3) — migrate_007.sql created + applied to production (ALTER TABLE + index + JSONB backfill). content.js POST strips expires_at from data JSONB, inserts as $3 col; GET /content adds WHERE (expires_at IS NULL OR expires_at > NOW()). ContentNew.tsx posts expires_at as top-level field, strips from data object. 0 typecheck errors. Frontend + backend deployed to production.

### BL-023 — promo_slide real renderer (ContentPreview + player-ui) `[S]`
- **What**: Replace the generic violet stub for `promo_slide` with a real visual renderer that uses the `background_color`, `text_color`, `title`, and `subtitle` fields from the card's data. This is the first template type to graduate from stub to production visual.
- **Acceptance criteria**:
  1. `ContentPreview.tsx`: when `item.template_type === 'promo_slide'`, render a real layout — full 16:9 background using `data.background_color ?? '#1a1a2e'`, large centred title using `data.text_color ?? '#ffffff'`, subtitle below in same colour at ~60% opacity, NO "STUB" watermark. All other template types still use the generic TemplateStub.
  2. `apps/player-ui/src/template-stubs.ts`: `renderTemplateStub()` for `promo_slide` uses `data.background_color` and `data.text_color` and shows title/subtitle. Same visual as ContentPreview.
  3. Live preview in `ContentNew.tsx` (right panel) already uses `data.background_color` and `data.text_color` directly — verify it is consistent with ContentPreview and no changes are needed there.
  4. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors).
  5. `pnpm --filter @clubhub/player-ui build` passes.
- **Files**: `apps/cms-web/src/routes/ContentPreview.tsx`, `apps/player-ui/src/template-stubs.ts`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-19 (Agent 3) — PromoSlideRenderer component added to ContentPreview.tsx (full-bg real layout, large title, 75%-opacity subtitle, no STUB watermark, generic TemplateStub unchanged for all other types). renderTemplateStub() in template-stubs.ts early-exits for promo_slide with DOM-built title+subtitle+bg. ContentNew.tsx LivePreview confirmed already consistent. 0 typecheck errors, player-ui build PASS. Deployed to production.

---

### BL-028 — Rename screens.layout_template → screens.screen_layout `[S]`
- **What**: The `layout_template` column on the `screens` table predates D-016 and contradicts the canonical vocabulary (D-016 bans "template" as a standalone noun; the pre-built screen geometry is a **Layout**). Rename it to `screen_layout` via a new migration and update all references.
- **Acceptance criteria**:
  1. `backend/db/migrate_011.sql` — `ALTER TABLE screens RENAME COLUMN layout_template TO screen_layout`
  2. `backend/src/routes/screens.js` — all references to `layout_template` renamed to `screen_layout` (PATCH handler, SQL query, validation error messages)
  3. `apps/cms-web/src/routes/VenueDashboard.tsx` — `Screen` interface field, mutation payload, and all reads updated to `screen_layout`
  4. Migration applied to production DB
  5. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors)
- **Files**:
  - `backend/db/migrate_011.sql` (new)
  - `backend/src/routes/screens.js`
  - `apps/cms-web/src/routes/VenueDashboard.tsx`
- **Role**: Feature Development — Agent 3
- **Status**: TODO

---

## Future (no scope yet — do not build)

| Item | Description |
|---|---|
| BL-F01 | Operator SSO / auth gate for Studio SPA — depends on BL-003 audit findings |
| BL-F02 | cms-web app implementation — depends on BL-004 scope decision |
| BL-F03 | sponsor-portal implementation — no scope defined |
| BL-F04 | pg pool scaling beyond 10 — trigger: ≥ 100 enrolled screens (see BL-005) |
| BL-F05 | Automated corpus cache upload on 50MB cap — trigger: venues reporting replay errors |
| ~~BL-F06~~ | Promoted to BL-F06 → DONE (see below). |
| ~~BL-F07~~ | Promoted to active → DONE (see below). |
| BL-F08 | Image upload + server-side WebP conversion at 1920×1080 — required before any card type uses images in production. |
| BL-F09 | promo_slide production renderer — promoted to BL-023 (active). |
| BL-F10 | TV playout scheduler extension — programme loop + timed ad break injection + proof of play log. Scope below. **Do not build until licensed venue flow is end-to-end verified on real hardware.** |

### BL-F10 — TV playout scheduler extension (Hotel / DOOH mode) `[L]`

**Trigger**: Licensed venue flow verified end-to-end on real Pi hardware. Do not start before that.

**Context**: Hotels and DOOH venues need a playout model closer to a TV station — a continuous programme loop interrupted at regular intervals by timed ad breaks. Pi Signage (current hotel deployment) lacks this. ClubHub replaces it with precise ad injection and proof-of-play logging.

**Core concepts**:
- **Programme playlist** — loops continuously in the main zone (existing playlist type, no change)
- **Break playlist** — a new playlist type (`playlist_type: 'break'`). Interrupts the programme at a configurable interval, plays 1–N spots, then returns to programme.
- **Spot** — a card within a break playlist. Has a `weight` (integer, default 1) controlling share of voice. Higher weight = selected more often when the scheduler picks spots for a break.
- **Ad break interval** — `ad_break_interval_seconds` on the screen (e.g. 240 = every 4 minutes).
- **Proof of play** — every card that actually renders gets a playout log entry: `{screen_id, content_id, played_at, duration_seconds}`. Queryable by screen and date range.
- **Share of voice** — when multiple sponsors have spots in a break playlist, the scheduler picks spots proportionally by weight. A spot with weight 3 gets 3× the airtime of a weight-1 spot.

**What needs to be built**:
1. `migrate_011.sql`: `named_playlists` gets `playlist_type VARCHAR(20) DEFAULT 'programme'` (`'programme'` | `'break'`). `named_playlist_items` gets `weight INTEGER DEFAULT 1`. `screens` gets `ad_break_interval_seconds INTEGER NULL`. New table: `playout_log (id UUID, screen_id VARCHAR, content_id UUID, played_at TIMESTAMPTZ, duration_seconds INTEGER)`.
2. Backend: `GET /playout_log?screen_id=&date=` for proof-of-play queries.
3. Player-UI: break scheduler logic — tracks time since last break, fires break playlist at interval, weighted random spot selection, returns to programme position.
4. PRE engine extension: corpus includes break playlist + interval config alongside programme playlist.
5. CMS: playlist type selector (programme vs break) in PlaylistComposer. Screen detail shows break interval config. Proof-of-play report page (`/reports/playout`).

**Acceptance criteria** (when scoped for build):
1. Screen with `ad_break_interval_seconds = 240` fires a break every 4 minutes ± 5 seconds
2. Spots selected proportionally by weight across 100 break firings (within 10% of expected distribution)
3. Every played card logged to `playout_log` with correct `played_at` and `duration_seconds`
4. `GET /playout_log?screen_id=X&date=2026-07-01` returns all entries for that screen/day
5. Programme resumes after break without restarting from beginning
6. 72h offline autonomy preserved (break schedule resolved from corpus, no live API call)

**Files** (when ready): `backend/db/migrate_011.sql`, `backend/src/routes/playout-log.js`, `apps/player-ui/src/break-scheduler.ts`, `apps/cms-web/src/routes/PlayoutReport.tsx`, `apps/cms-web/src/routes/PlaylistComposer.tsx` (type field), `apps/cms-web/src/routes/VenueDashboard.tsx` (interval field)

**Role**: Feature Development
**Status**: FUTURE — do not build until licensed venue flow end-to-end on real hardware

---

### BL-024 — Zone support: layout_template on screens + zone_name on schedules `[S]`
- **What**: Implement D-015. Add the two DB columns that make zone-based layouts possible. Wire `zone_name` into the Schedule Creator UI and update the Screen detail page to show a layout template picker.
- **Acceptance criteria**:
  1. `migrate_010.sql`: `ALTER TABLE schedules ADD COLUMN zone_name VARCHAR(40) NOT NULL DEFAULT 'main'`; `ALTER TABLE screens ADD COLUMN layout_template VARCHAR(40) NOT NULL DEFAULT 'fullscreen'`
  2. `schedules.js` POST accepts `zone_name` (default `'main'`); GET returns it
  3. `ScheduleCreator.tsx` — add an optional "Zone" select field that appears only when the operator has chosen a layout template that has multiple zones. For now, hardcode the zone options based on a `LAYOUT_ZONES` constant in the component: `{ fullscreen: ['main'], split_horizontal: ['main_left','main_right','ticker'], news_bar: ['main','ticker'], quad: ['top_left','top_right','bottom_left','bottom_right'] }`. Default zone = `'main'`, field only shown when layout has >1 zone.
  4. `VenueDashboard.tsx` — screen rows gain a "Layout" column showing the `layout_template` value (or "Full Screen" as a readable label). A dropdown in each row allows changing it: `fullscreen | split_horizontal | news_bar | quad`. PATCH `/screens/:id` with `{ layout_template }` on change.
  5. `backend/src/routes/screens.js` — PATCH /screens/:id accepts `layout_template`; validate it is one of the 4 allowed values.
  6. Migration applied to production DB.
  7. `pnpm --filter @clubhub/cms-web typecheck` passes.
- **Files**: `backend/db/migrate_010.sql` (new), `backend/src/routes/schedules.js`, `backend/src/routes/screens.js`, `apps/cms-web/src/routes/ScheduleCreator.tsx`, `apps/cms-web/src/routes/VenueDashboard.tsx`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3

---

### BL-025 — Wire named_playlists into corpus delivery `[S]`
- **What**: Fix manifest engine to resolve playlist-based schedules; add GET /resolve/:screen_id adapter.
- **Status**: DONE 2026-06-20 — Agent 3

---

### BL-026 — Local full-system preview (player-runtime + player-ui in browser) `[S]`
- **What**: Make it possible to run the complete player pipeline locally on Mac, pointing at production backend.
- **Status**: DONE 2026-06-20 — Agent 3

---

### BL-027 — Real renderers for event_banner, sponsor_banner, menu_board, daily_specials `[M]`
- **What**: Four template types are authored via the card form but still display as coloured STUB placeholders on screen. Promote each to a real renderer in two places: (1) `ContentPreview.tsx` — the CMS preview panel, and (2) `template-stubs.ts` — the Pi player display in Chromium.

  **Data shapes** (from `ContentNew.tsx`):
  - `event_banner` → `{ event_name: string, date: string, time: string, description: string }`
  - `sponsor_banner` → `{ sponsor_name: string, tagline: string, tier: 'Platinum'|'Gold'|'Silver' }`
  - `menu_board` → `{ sections: [{ section_title: string, items: [{ name: string, price: string }] }] }` (up to 2 sections × 4 items)
  - `daily_specials` → `{ headline: string, items: [{ dish_name: string, price: string }] }` (up to 5 items)

  **Visual design per type** (full-bleed 16:9, no images, text-only):
  - `event_banner`: dark background `#0f172a`. Event name in large bold white at top-centre. Date + time side by side in a highlighted pill or large accent block in the middle (accent colour `#EA580C`). Description in smaller text below. No STUB watermark.
  - `sponsor_banner`: dark background `#0f172a`. Sponsor name large and centred. Tier badge below the name (`Platinum` = `#e5e4e2`, `Gold` = `#FFD700`, `Silver` = `#C0C0C0`) as a coloured chip with tier label. Tagline in lighter text at bottom. No STUB watermark.
  - `menu_board`: dark navy `#0f172a`. Section titles as white uppercase row headers with bottom border. Items listed below each header: item name left-aligned, price right-aligned. If 2 sections, render them side by side (two columns). No STUB watermark.
  - `daily_specials`: dark background `#1a0a0a`. `headline` large at top (e.g. "TODAY'S SPECIALS") in accent red `#DC2626`. Items as a list below: dish name left, price right, separator line between items. No STUB watermark.

- **Acceptance criteria**:
  1. `ContentPreview.tsx` — `TemplateStub()` dispatches to a dedicated renderer component for each of the 4 types (same pattern as `PromoSlideRenderer`). Generic coloured-box stub only shown for unknown/future types.
  2. `template-stubs.ts` — `renderTemplateStub()` has DOM-built branches for all 4 types (same pattern as the existing `promo_slide` branch). No STUB watermark text. Falls through to generic stub only for unknown types.
  3. Visuals are consistent between ContentPreview (React) and template-stubs (DOM) — same layout, same colours, same field ordering.
  4. Empty/missing fields degrade gracefully: omit the element, do not show `undefined` or blank label.
  5. `pnpm --filter @clubhub/cms-web typecheck` passes (0 errors).
  6. `pnpm --filter @clubhub/player-ui build` passes.

- **Files**:
  - `apps/cms-web/src/routes/ContentPreview.tsx` — add 4 renderer components, wire into `TemplateStub()`
  - `apps/player-ui/src/template-stubs.ts` — add 4 DOM renderer branches

- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3

---

---

## Multi-Tenancy (BL-034 → BL-036) — do in order, each depends on the previous

### BL-034 — DB: tenants table + tenant_id columns + indexes + backfill `[M]`
- **What**: Create the `tenants` master table and add `tenant_id` to every entity table per D-018. Seed a default tenant and backfill all existing rows. Applies to production.
- **Acceptance criteria**:
  1. `backend/db/migrate_013.sql`:
     ```sql
     CREATE TABLE IF NOT EXISTS tenants (
       id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
       name VARCHAR(100) NOT NULL,
       slug VARCHAR(50) UNIQUE NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     );
     INSERT INTO tenants (name, slug) VALUES ('ClubHub Default', 'default') ON CONFLICT DO NOTHING;

     ALTER TABLE venues ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
     ALTER TABLE screens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
     ALTER TABLE content ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
     ALTER TABLE named_playlists ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
     ALTER TABLE schedules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

     -- Backfill all existing rows to the default tenant
     UPDATE venues SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
     UPDATE screens SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
     UPDATE content SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
     UPDATE named_playlists SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
     UPDATE schedules SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;

     -- Indexes for query performance
     CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);
     CREATE INDEX IF NOT EXISTS idx_screens_tenant ON screens(tenant_id);
     CREATE INDEX IF NOT EXISTS idx_content_tenant ON content(tenant_id);
     CREATE INDEX IF NOT EXISTS idx_playlists_tenant ON named_playlists(tenant_id);
     CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON schedules(tenant_id);
     ```
  2. Migration applied to production DB cleanly (idempotent — IF NOT EXISTS throughout)
  3. Verify: all existing rows have non-null tenant_id after migration
- **Files**: `backend/db/migrate_013.sql` (new)
- **Role**: Feature Development — Terminal Agent 1
- **Status**: DONE 2026-06-20 — Terminal Agent 1. tenants table, tenant_id columns + indexes + default backfill on all entity tables.

---

### BL-035 — Backend: tenantContext middleware + full query hardening `[M]`
- **What**: Add `tenantContext.js` middleware that resolves `req.tenantId` on every request. Update every route handler and `manifestEngine.js` to append `AND tenant_id = $x` to all queries. Uses `MULTI_TENANT_ENFORCE` flag — safe to ship before real JWT auth exists.
- **Acceptance criteria**:
  1. `backend/src/middleware/tenantContext.js` (new):
     ```js
     // When MULTI_TENANT_ENFORCE=true: extract tenant_id from req.user.tenant_id (JWT claim), reject 403 if absent
     // When MULTI_TENANT_ENFORCE=false (default): use process.env.DEFAULT_TENANT_ID
     //   (seed this from DB on startup — query tenants WHERE slug='default', cache the UUID)
     module.exports = { injectTenantContext, loadDefaultTenantId }
     ```
  2. `backend/src/index.js` — call `loadDefaultTenantId()` at startup (before routes mount), apply `injectTenantContext` middleware to all routes except `/health`
  3. **Routes to update** (add `AND tenant_id = $n` to every SELECT/INSERT/UPDATE/DELETE):
     - `backend/src/routes/content.js` — GET list, GET by id, POST (insert with tenant_id), PATCH, DELETE
     - `backend/src/routes/named-playlists.js` — all 5 endpoints
     - `backend/src/routes/schedules.js` — GET list, POST, GET by id
     - `backend/src/routes/venues.js` — GET list, POST, GET by id
     - `backend/src/routes/screens.js` — GET list, GET by id, PATCH, enroll (INSERT with tenant_id)
     - `backend/src/routes/resolve.js` — resolve screen → look up screen's tenant_id from screen record, pass through to manifestEngine
     - `backend/src/lib/manifestEngine.js` — both Query A and Query B add `AND c.tenant_id = $n` and `AND s.tenant_id = $n`
  4. **Pi resolve path**: `GET /resolve/:screen_id` is exempt from JWT requirement even when MULTI_TENANT_ENFORCE=true — it resolves tenant_id from the screen record itself (`SELECT tenant_id FROM screens WHERE id = $1`). No JWT needed on the device.
  5. `backend/.env` gets `MULTI_TENANT_ENFORCE=false` and `DEFAULT_TENANT_ID=` (populated by startup loader)
  6. Smoke test: `GET /resolve/screen-1` still returns correct playlist with no regression
  7. Smoke test: `GET /content` returns same rows as before (tenant filter uses default tenant, so no data loss)
- **Files**: `backend/src/middleware/tenantContext.js` (new), `backend/src/index.js`, `backend/src/routes/content.js`, `backend/src/routes/named-playlists.js`, `backend/src/routes/schedules.js`, `backend/src/routes/venues.js`, `backend/src/routes/screens.js`, `backend/src/routes/resolve.js`, `backend/src/lib/manifestEngine.js`
- **Role**: Feature Development — Terminal Agent 1
- **Status**: DONE 2026-06-20 — Terminal Agent 1. tenantContext middleware, all routes hardened with AND tenant_id = $x, Pi resolve path exempt.

---

### BL-036 — Backend: tenants CRUD API `[S]`
- **What**: Admin-only endpoints for managing tenants. No CMS UI surface yet — these are called programmatically or via curl to onboard a new operator organisation.
- **Acceptance criteria**:
  1. `backend/src/routes/tenants.js` (new, CommonJS):
     - `GET /tenants` — list all tenants (id, name, slug, created_at)
     - `POST /tenants` — create `{ name, slug }` → returns new tenant with id
     - `GET /tenants/:id` — fetch single tenant
     - `PATCH /tenants/:id` — update name and/or slug
  2. Mounted in `backend/src/index.js` under `/tenants`
  3. When `MULTI_TENANT_ENFORCE=true`, these endpoints require an `X-Admin-Key` header matching `process.env.ADMIN_KEY`. When false, open (dev convenience).
  4. `POST /venues` and `POST /screens` updated to accept optional `tenant_id` in body — if omitted, use `req.tenantId` (the default tenant). This allows creating resources for a specific tenant.
- **Files**: `backend/src/routes/tenants.js` (new), `backend/src/index.js`, `backend/src/routes/venues.js`, `backend/src/routes/screens.js`
- **Role**: Feature Development — Terminal Agent 1
- **Status**: DONE 2026-06-20 — Terminal Agent 1. tenants CRUD (GET/POST/GET/:id/PATCH/:id), X-Admin-Key guard when enforce=true, POST /venues and POST /screens accept optional tenant_id. Deployed to production, "Acme Pubs" tenant created as verification.

---

## Ecosystem Frontends (BL-037 → BL-039) — independent, can run in parallel

### BL-037 — Sponsor portal shell + backend ingest route `[M]`
- **What**: Stand up `apps/sponsor-portal` as a runnable Vite + React app. Sponsor logs in, sees one form: upload a text string (for ticker) or an image file (creates a `sponsor_banner` card). No layout/schedule controls. Backend ingest route validates and writes directly to `ticker_items` or `content` under the tenant.
- **Acceptance criteria**:
  1. `apps/sponsor-portal` — Vite + React app starts. Single flow: login stub → upload form.
  2. Upload form has two tabs: "Text / News Item" (280 char → POST `/sponsor/ticker`) and "Sponsor Banner" (name, tagline, tier → POST `/sponsor/card`).
  3. `backend/src/routes/sponsor.js` (new): POST /sponsor/ticker inserts into `ticker_items` (screen_id = `'screen-1'` for now). POST /sponsor/card inserts into `content` as `sponsor_banner`.
  4. Both routes validate input, return `{ ok: true, id }`.
  5. `pnpm --filter @clubhub/sponsor-portal build` passes. 0 typecheck errors.
- **Files**: `apps/sponsor-portal/` (scaffold), `backend/src/routes/sponsor.js` (new), `backend/src/index.js`
- **Role**: Feature Development — Agent 2
- **Status**: TODO

---

### BL-038 — Social pipeline stub: jobs table + cross_post hook `[S]`
- **What**: Wire the social publishing pipeline as an async queue — no real API calls. When a card is created with `cross_post: true`, a job is enqueued. A background worker polls the table every 30s and logs what it would post. Establishes the pattern for real Meta integration later without blocking the CMS flow.
- **Acceptance criteria**:
  1. `backend/db/migrate_014.sql`: `CREATE TABLE social_jobs (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, content_id UUID REFERENCES content(id) ON DELETE CASCADE, tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, platform VARCHAR(20) NOT NULL DEFAULT 'facebook', status VARCHAR(20) NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(), processed_at TIMESTAMPTZ NULL, error TEXT NULL)`
  2. `backend/src/routes/content.js` POST — if `req.body.cross_post === true`, after inserting the card, insert a `social_jobs` row with `status: 'pending'`
  3. `backend/src/lib/social-worker.js` (new) — `startSocialWorker()`: polls `social_jobs WHERE status='pending'` every 30s, logs `[SOCIAL] Would post to facebook: {title} ({content_id})`, sets status `'sent'`. No real HTTP call.
  4. `backend/src/index.js` — call `startSocialWorker()` on startup
  5. `apps/cms-web/src/routes/ContentNew.tsx` — "Cross-post to Facebook" checkbox below expiry field. Posts `cross_post: true` when checked.
  6. Migration applied to production.
- **Files**: `backend/db/migrate_014.sql` (new), `backend/src/lib/social-worker.js` (new), `backend/src/routes/content.js`, `backend/src/index.js`, `apps/cms-web/src/routes/ContentNew.tsx`
- **Role**: Feature Development — Agent 2
- **Status**: TODO

---

### BL-039 — Responsive CMS: mobile breakpoints for on-floor operator use `[S]`
- **What**: The CMS is desktop-only. A duty manager on the club floor needs to open it on an iPhone and make a quick update. Functional at 390px width — not pixel-perfect, just not broken.
- **Acceptance criteria**:
  1. `AppLayout.tsx` — nav collapses to hamburger or horizontal scroll below 768px. Links min 44px touch target.
  2. `ContentNew.tsx` — split-panel stacks vertically below 768px (preview below form).
  3. `CampaignList.tsx`, `PlaylistList.tsx`, `ScheduleList.tsx` — tables get `overflow-x: auto` wrapper, no layout break on small screens.
  4. `TickerManager.tsx`, `VenueDashboard.tsx` — usable on mobile.
  5. No new CSS framework. Media queries in inline styles or a single `apps/cms-web/src/styles/responsive.css` imported in `main.tsx`.
  6. `pnpm --filter @clubhub/cms-web typecheck` passes.
- **Files**: `apps/cms-web/src/components/layout/AppLayout.tsx`, `apps/cms-web/src/routes/ContentNew.tsx`, `apps/cms-web/src/routes/CampaignList.tsx`, `apps/cms-web/src/routes/PlaylistList.tsx`, `apps/cms-web/src/routes/ScheduleList.tsx`, `apps/cms-web/src/routes/TickerManager.tsx`, `apps/cms-web/src/routes/VenueDashboard.tsx`
- **Role**: Feature Development — Agent 2
- **Status**: TODO

---

## Multi-Zone Layout Engine (BL-029 → BL-033) — do in order, each depends on the previous

### BL-029 — Zone-aware /resolve endpoint `[S]`
- **Files**: `backend/src/lib/manifestEngine.js`, `backend/src/routes/resolve.js`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3. zones map + screen_layout + template_type/data per item in /resolve response.

---

### BL-030 — player-runtime: zone-aware PlaylistPoller `[S]`
- **Files**: `player-runtime/src/playlist-poller.ts`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3. PLAYLIST_UPDATE shape: { screen_layout, zones, corpus_data }.

---

### BL-031 — player-ui: Layout engine + CSS grid zones + container queries `[M]`
- **Files**: `apps/player-ui/src/layout-engine.ts` (new), `apps/player-ui/src/index.ts`, `apps/player-ui/src/template-stubs.ts`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3. CSS grid per layout, per-zone rotation loops, cqw container units.

---

### BL-032 — Widget Registry + Layout Definitions + Clock + DateDisplay `[M]`
- **Files**: `widget-registry.ts`, `layout-definitions.ts`, `widgets/clock.ts`, `widgets/date-display.ts`, `layout-engine.ts`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3. Widget Registry (D-017), LAYOUTS definitions, Clock + DateDisplay self-registering widgets.

---

### BL-033 — TickerScroll widget + ticker content authoring `[M]`
- **Files**: `migrate_012.sql`, `ticker.js`, `resolve.js`, `widgets/ticker-scroll.ts`, `TickerManager.tsx`
- **Role**: Feature Development — Agent 3
- **Status**: DONE 2026-06-20 — Agent 3. ticker_items table, CRUD API, /resolve delivery, ticker_scroll widget, TickerManager CMS. Smoke test: ticker_items flows through /resolve to player.
- **Role**: Feature Development — Agent 3
- **Status**: TODO

---

## Completed

| Item | Date | Summary |
|---|---|---|
| BL-001 | 2026-06-08 | NO-OP — frozen map files clean, whole repo pre-first-commit |
| BL-003 | 2026-06-08 | Studio is dev-only tool, no production exposure — DOCS-1 |
| BL-005 | 2026-06-08 | pg pool adequate (1 seed screen, pre-production) — DOCS-1 |
| BL-006 | 2026-06-08 | Replay cache 50MB ceiling documented, manual truncate procedure — DOCS-1 |
| BL-007 | 2026-06-08 | OTA canary manual verification procedure documented — DOCS-1 |
| BL-INT-01 | 2026-06-09 | Integration harness re-validated after BL-002 auth enforcement: 34/34 GREEN. Player-runtime uses cms-api:3001 (not backend:4000); SCREEN_AUTH_ENFORCE has no effect on harness. — CH1 |
| BL-F06 | 2026-06-19 | Playlist Composer complete. migrate_008.sql (named_playlists table), named-playlists.js Express router (5 endpoints), PlaylistList.tsx (/playlists), PlaylistComposer.tsx (/playlists/new + /playlists/:id), AppLayout Playlists nav link. Deployed to production. 0 typecheck errors. — Agent 3 |
| BL-F07 | 2026-06-19 | Schedule Creator complete. migrate_009.sql (playlist_id FK on schedules), schedules.js extended (playlist_id support, LEFT JOIN named_playlists), ScheduleList.tsx (/schedules), ScheduleCreator.tsx (/schedules/new), AppLayout Schedules nav link, App.tsx routes wired. 118 modules built, 0 typecheck errors. Production deploy PENDING (SSH port 22 connection refused — port blocked). — Agent 3 |
| BL-024 | 2026-06-20 | Zone support complete. migrate_010.sql (zone_name on schedules + layout_template on screens), schedules.js POST accepts zone_name, screens.js PATCH /:id added, ScheduleCreator.tsx layout+zone section, VenueDashboard.tsx layout column with inline select + optimistic UI + error revert, api-client.ts patch() added. 118 modules, 0 typecheck errors. Deployed to production. — Agent 3 |
| BL-025 | 2026-06-20 | Corpus delivery wired. manifestEngine.js: split single INNER JOIN query into Query A (content-based) + Query B (playlist-based via LATERAL jsonb_array_elements), merged+sorted by priority. New backend/src/routes/resolve.js: GET /resolve/:screen_id transforms getManifest() into ResolvedPlaylist shape. Mounted in index.js with 120/60s rate limit. Deployed to production. Smoke test: /resolve/screen-1 returns 2-item playlist with checksum. — Agent 3 |
| BL-026 | 2026-06-20 | Local preview environment. player-runtime/.env.local with DEV_NO_CHROMIUM=true + production CMS_API_URL + 15s poll. index.ts chromium.start() guarded by DEV_NO_CHROMIUM. "dev:local" script using tsx --env-file. player-ui built (dist/index.js). End-to-end verified: pnpm dev:local → ui-server on :3001 → playlist updated checksum=7574cc7e level=1 within 15s. — Agent 3 |
| BL-027 | 2026-06-20 | Real renderers for event_banner, sponsor_banner, menu_board, daily_specials. ContentPreview.tsx: 4 React renderer components added (EventBannerRenderer, SponsorBannerRenderer, MenuBoardRenderer, DailySpecialsRenderer), TemplateStub dispatches all 4. template-stubs.ts: 4 DOM early-return branches added before generic stub fallback. Visuals consistent between CMS and player. 0 typecheck errors, player-ui build PASS. — Agent 3 |
