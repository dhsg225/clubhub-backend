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
  1. New migration file `backend/db/migrate_005.sql` adds `expires_at TIMESTAMPTZ NULL` to `content` table with an index
  2. `GET /content` filters out expired cards by default (where `expires_at IS NULL OR expires_at > NOW()`)
  3. `ContentNew.tsx` updated to POST `expires_at` as a top-level field, not inside `data`
  4. Existing content rows with `expires_at` in their `data` JSONB are backfilled by the migration
  5. Migration runs clean on production DB
- **Files**: `backend/db/migrate_005.sql` (new), `backend/src/routes/content.js`, `apps/cms-web/src/routes/ContentNew.tsx`
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
| BL-F06 | Playlist composer UI — group cards into a playlist with ordering rules and per-card duration. Depends on BL-021 DONE. |
| BL-F07 | Schedule creator UI — map a playlist to venue/screen group with daypart window. Depends on BL-F06. |
| BL-F08 | Image upload + server-side WebP conversion at 1920×1080 — required before any card type uses images in production. |
| BL-F09 | promo_slide production renderer — replace stub with real visual (uses background_color, text_color, large title). |

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
