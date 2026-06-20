# Architecture Decisions

Stable decisions that should not be re-litigated without explicit human input.

All entries below are labelled `Source: codebase inference` unless a human has annotated them.

---

## D-001 — Raw pg over ORM

**Decision**: The backend uses the raw `pg` Node.js client with handwritten SQL. No ORM (Sequelize, Prisma, Drizzle, etc.) is used.

**Rationale**: (inferred) Governance constraints require deterministic, auditable SQL. An ORM's query generation is opaque and could produce non-deterministic or non-idempotent queries in the governance layer. Raw SQL is explicit and easier to audit.

**Implication**: All new database queries must be written in raw SQL using parameterised `$1, $2, …` placeholders. No ORM may be introduced.

**Source**: codebase inference (`backend/src/db.js`, all `routes/*.js` files)
**Status**: Active

---

## D-002 — CommonJS for backend; ESM for player-runtime and packages

**Decision**: `backend/` is CommonJS (`require()`). `player-runtime/`, `pre-runtime/`, and shared packages are TypeScript ESM (`import`).

**Rationale**: (inferred) The backend was written first as a standard Express/Node app. The player-runtime and governance packages were written later with TypeScript and target modern Node ESM.

**Implication**: Do not convert the backend to ESM — it would break all `require()` chains across dozens of files. New backend modules must use CommonJS. New packages and TypeScript modules use ESM.

**Source**: codebase inference (`backend/package.json` has no `"type": "module"`; `player-runtime/package.json` has `"type": "module"`)
**Status**: Active

---

## D-003 — 72-hour offline autonomy is a constitutional minimum

**Decision**: The player runtime must be able to operate for at least 72 hours without any connectivity to the CMS API, serving content from its local corpus cache.

**Rationale**: (inferred) Venue networks are unreliable. The constitutional requirement ensures players never go dark during network outages. This is encoded in `player-runtime/src/index.ts` as `autonomous_window_ms: 72 * 60 * 60 * 1000`.

**Implication**: Any change to corpus caching, corpus expiry, or network polling logic must not reduce this window. The 72h value is non-negotiable without explicit human authority. All corpus delivery changes must be tested against offline replay scenarios.

**Source**: codebase inference (`player-runtime/src/index.ts:30`, `MINIMAL-PRE-RUNNER-SPEC-v1.md`)
**Status**: Active

---

## D-004 — All governance state is DB-authoritative; memory is a cache

**Decision**: Governance state (fleet epoch, incidents, config versions, operator ledger, rollout state) is always stored in PostgreSQL. In-memory state is initialised from DB on startup and used only as a read cache.

**Rationale**: (inferred) Active/active multi-instance safety. If two backend instances run simultaneously, they share DB state. Memory-only state would cause split-brain on restarts.

**Implication**: Never use in-memory state as the source of truth for a governance decision. Always read from DB (or use the DB-backed `strong` read functions) when the decision has cluster-wide consequences. See `distributed-authority.js` for the HA safety model.

**Source**: codebase inference (`backend/src/index.js` startup sequence, `fleet-consensus.js`, `governed-config.js`, `operator-ledger.js`)
**Status**: Active

---

## D-005 — PRE.resolve() must be a pure function

**Decision**: The `_resolve()` function in `pre-runtime/src/pre-engine.ts` is a pure function: no I/O, no side effects, no wall-clock access. `GovernedClock.now()` is the only permitted time source, and it is injected by the public `resolve()` wrapper.

**Rationale**: (inferred) Determinism is required for corpus replay verification. Any non-pure computation in the resolution path would make replays non-reproducible.

**Implication**: Do not add any I/O, network calls, or `Date.now()`/`Math.random()` inside `_resolve()`. All side effects (trace events, logging) happen in the `resolve()` wrapper, after the pure function returns.

**Source**: codebase inference (`pre-runtime/src/pre-engine.ts` JSDoc, `MINIMAL-PRE-RUNNER-SPEC-v1.md`, contract check #11)
**Status**: Active

---

## D-006 — Studio uses tab-based state navigation; no URL router

**Decision**: The Studio SPA (`studio/src/App.tsx`) uses `useState<Tab>` for navigation. React Router (or any URL-based router) is not installed.

**Rationale**: (inferred) The studio is a minimal operational tool with three functional areas. URL-based routing adds complexity (deep-linking, history, layout nesting) that isn't needed for a single-operator dashboard.

**Implication**: Do not add React Router without explicit human approval. New functional areas should be added as tabs using the existing `useState<Tab>` pattern.

**Source**: codebase inference (`studio/src/App.tsx`, `studio/package.json`)
**Status**: Active

---

## D-007 — All config reads must go through governed-config singleton

**Decision**: All runtime reads of threshold/config values must use `getThreshold()`, `requireThreshold()`, or `getThresholdSnapshot()` from `backend/src/lib/governed-config.js`. Direct reads of `thresholds.json` at runtime are prohibited.

**Rationale**: (inferred) Config versioning and audit. `governed-config` wraps values with a version hash and persists changes to the DB, enabling config drift detection and rollback.

**Implication**: Never call `fs.readFileSync('thresholds.json')` in a route handler or module. Only `backend/src/index.js` is permitted one direct bootstrap read (before the singleton is initialised). Contract check #35 enforces this.

**Source**: codebase inference (`governed-config.js`, contract checks #35, #46–49)
**Status**: Active

---

## D-008 — Operator ledger is append-only; no delete or mutate API

**Decision**: `operator-ledger.js` exposes only an append API. There is no delete, update, or truncate path.

**Rationale**: (inferred) The ledger is the audit trail. Any modification after the fact would break the SHA-256 hash chain and destroy evidentiary integrity.

**Implication**: Do not add delete, update, or clear operations to the ledger. If an entry is erroneous, the correct action is to append a correction entry, not to modify the original. Contract checks #20 and #41 enforce linearised appends.

**Source**: codebase inference (`backend/src/lib/operator-ledger.js`, `CLUBHUB_SYSTEM_CONTRACTS.md`)
**Status**: Active

---

## D-009 — Advisory locks for total ordering of critical governance operations

**Decision**: Ledger appends use `appendEntryLinearized()` (pg advisory lock). Incident state transitions use `transitionStrong()` (advisory lock + optimistic version locking). These are the only permitted paths for those operations.

**Rationale**: (inferred) Prevents interleaved writes in multi-instance deployments. Without advisory locks, two concurrent appends could produce the same sequence number or break the hash chain.

**Implication**: Any new code that appends to the ledger or transitions incident state must use these locked primitives. Do not bypass with direct DB inserts. Contract checks #41 and #42 enforce this.

**Source**: codebase inference (`operator-ledger.js`, `incident-orchestrator.js`, contract checks #41–42)
**Status**: Active

---

## D-010 — Screen auth enforcement is opt-in (deployment flexibility)

**Decision**: `SCREEN_AUTH_ENFORCE` defaults to `false`. Screen token validation is present but not enforced unless explicitly enabled.

**Rationale**: (inferred) Venues without PKI infrastructure or token provisioning workflows would be blocked from running the system. The opt-in model allows early deployments before auth infrastructure is in place.

**Implication**: Never assume screen requests are authenticated in application logic. Always check whether enforcement is on. Production venue deployments should have this enabled. See BL-002.

**Source**: codebase inference (`backend/src/middleware/screenAuth.js`, `.env.production.example`)
**Status**: Active — Needs Human confirmation on target enforcement posture

---

## D-012 — Content authorship model: Option C (static assets + data-driven templates)

**Decision**: The CMS supports two distinct content rendering modes, discriminated by `template_type`:

- **Static asset types** (`image`, `video`): the corpus playlist item carries `asset_path` — a local file path on the Pi. `playlist-renderer.ts` plays it as `<img>` or `<video>`. Authored by uploading a file in the CMS.
- **Data-driven types** (e.g. `promo_slide`, `menu_board`, `daily_specials`, `event_promo`): the corpus playlist item carries `template_type` + `data` (JSONB) instead of `asset_path`. The Pi renders these client-side in Chromium via pre-built HTML template renderers bundled in `player-ui`.

**Rationale**: Static-asset-only would require pre-rendering data-driven content (menu boards, leaderboards, specials) to images at CMS publish time — losing dynamic update capability and requiring server-side rendering infrastructure. Data-driven rendering in Chromium on Pi 5 is feasible (Pi 5 has the horsepower) and keeps the corpus small. Both modes are needed: video/image assets for ambient/brand content, data templates for operational content (menus, specials, events).

**Implication**:
1. Corpus playlist item schema must be extended to carry `{template_type?, data?}` for data-driven items (alongside or replacing `asset_path`).
2. `playlist-renderer.ts` needs a third rendering path: detect data-driven item (no `asset_path` or `asset_path` empty) → render via template component.
3. CMS authoring UI shows a different form per `template_type` — field set is template-specific.
4. Template renderer components must be bundled in `player-ui` for every supported `template_type`. Adding a new template type requires a player-ui update + OTA push.
5. 72h offline autonomy is preserved: corpus already carries `data`, no network call needed at render time.

**Source**: Human decision 2026-06-19
**Status**: Active

---

## D-011 — Contract gate (validate-contracts.js) is merge-blocking

**Decision**: The 62-check contract validation script (`test-runner/contracts/validate-contracts.js`) must pass before any commit that touches governed files is merged.

**Rationale**: (inferred) The governance kernel has accumulated 62 encoded invariants. Bypassing the gate risks silent regression of constitutional guarantees.

**Implication**: Run `node test-runner/contracts/validate-contracts.js` before committing changes to any Frozen Map module. A failing check is a hard blocker — do not merge with failing checks.

**Source**: codebase inference (CI stage configuration, `test-runner/contracts/validate-contracts.js` comment header)
**Status**: Active

---

## D-013 — Content hierarchy: Card → Playlist → Schedule → Screen

**Decision**: ClubHub TV adopts the 4-layer content model confirmed by industry research (ScreenCloud, Yodeck, NoviSign, Screenly, Signagelive all converged on this):

- **Card** (`content` table) — a single template instance. e.g. one `promo_slide`, one `event_banner`. Has an expiry date (validity window).
- **Playlist** (`/playlist` route, exists in backend) — an ordered loop of cards. Has ordering rule: sequential or shuffle. Has duration per card (seconds).
- **Schedule** (`schedules` table) — maps a playlist to a venue/screen group with a daypart window (e.g. Thu–Sun 16:00–21:00). Priority determines override behaviour.
- **Screen** — the Pi. Pulls its active playlist from the corpus resolved by PRE engine.

**What was abandoned by the industry and must NOT be built:**
- Free-form canvas layout editor (operators produce illegible designs)
- Timeline-style sequence editors (too complex, ignored)
- Deeply nested playlists (crashes low-power players)
- Live URL loading without local cache (blank screens on WiFi drop)

**Implication**: The CMS operator UI must expose all 4 layers. Current gap: Playlist composer and Schedule creator have no operator UI. Card authoring form does not exist yet. Build order: Card authoring → Playlist composer → Schedule creator.

**Source**: Gemini Deep Research 2026-06-19 — industry comparative analysis of 7 platforms
**Status**: Active

---

## D-014 — Card authoring constraints: form-based, brand-locked, expiry required

**Decision**: Card authoring UI must follow the form-based constrained model (not canvas). Specific rules:
- Each template type has a fixed field set with character limits enforced in the UI
- Background colour and text colour are the only visual controls exposed to operators (brand palette optional future constraint)
- Every card requires a validity/expiry date — no card can be saved without one (or explicit "no expiry" acknowledgement)
- Image uploads must be auto-converted server-side to WebP at 1920×1080 — raw HEIC/JPEG from mobile phones is not acceptable on the Pi
- Live 16:9 preview updates in real time as the operator fills fields (right panel alongside form)

**Source**: Gemini Deep Research 2026-06-19 — operator psychology + failed paradigms analysis
**Status**: Active

---

## D-015 — Screen layouts are pre-built zone templates; operators pick, not design

**Decision**: Each Pi display has a **layout template** — a fixed CSS grid of named zones. Operators choose from a small set of pre-built layouts; they cannot move, resize, or create zones (free-form canvas is abandoned per D-014). Content scheduling targets a zone within a layout (`zone_name` on the `schedules` table).

**Pre-built layouts (initial set)**:
- `fullscreen` — one zone (`main`), whole display. Default. What the system has been building so far.
- `split_horizontal` — two equal zones side by side: `main_left` (text/card) + `main_right` (image/video). Persistent `branding` + `clock` overlay at top. Bottom bar: `ticker` + `weather`.
- `news_bar` — full-screen `main` zone + a persistent `ticker` strip at the bottom (~10% height).
- `quad` — four equal zones: `top_left`, `top_right`, `bottom_left`, `bottom_right`. Good for menu boards.

**Zone types**:
- `main` / `main_left` / `main_right` / `top_*` / `bottom_*` — playlist content rotates here (card duration driven by schedule)
- `ticker` — scrolling text feed (data-driven, not a card)
- `clock` — live time + date widget (persistent, no scheduling needed)
- `weather` — weather widget (persistent)
- `branding` — venue logo + name (persistent, set per venue)

**What "fullscreen" is**: The current full-screen single-card rotation is exactly `layout: fullscreen, zone: main`. No existing work is invalidated — it is the base case of this model.

**Implication**:
1. `schedules` table gets a `zone_name VARCHAR(40) DEFAULT 'main'` column (migration BL-024).
2. `screens` table gets a `layout_template VARCHAR(40) DEFAULT 'fullscreen'` column (migration BL-024).
3. Corpus items carry a `zone` field (default `'main'`) so the player knows which zone to render into.
4. Player-UI layout engine renders zones as CSS grid areas; zone content transitions independently.
5. PRE resolver runs per zone (treats each zone as an independent scheduling context).
6. CMS: screen detail page lets the operator pick a layout template from a dropdown. No custom zone editor.
7. New template types (ticker content, weather config) are future items — do not build until layout engine exists.

**Source**: Human decision 2026-06-20 — prompted by operator mockup showing zone-based display
**Status**: Active

---

## D-016 — Canonical rendering vocabulary (Layout / Zone / Card / Widget)

**Decision**: Four terms are used strictly and never interchangeably across code, docs, and agent prompts:

| Term | Definition | Example |
|---|---|---|
| **Layout** | The static screen geometry on the Pi display. Defines the CSS grid structure. | `fullscreen`, `split_horizontal`, `news_bar`, `quad` |
| **Zone** | A named bounding region inside a Layout. Receives a playlist. Acts as a CSS container (`container-type: inline-size`). | `main`, `main_left`, `ticker`, `top_left` |
| **Card** | A single piece of authored content — a data record (`content` table) with a `template_type` and `data` JSONB. Has a renderer. | `promo_slide`, `event_banner`, `menu_board` |
| **Widget** | A small programmatic, real-time utility that occupies a zone directly. Not a card. Not scheduled via a playlist. | `Clock`, `DateDisplay`, `Weather`, `TickerScroll` |

**Implications**:
1. Zone wrappers in player-ui use `container-type: inline-size` so Card renderers reflow via CSS Container Queries — no JavaScript dimension-passing.
2. Card renderers (`renderCard()` in `template-stubs.ts`) must never assume viewport size. They adapt to their zone container.
3. Widgets are injected into zones by the layout engine directly — they are never scheduled via the Playlist/Schedule/PRE path.
4. The ticker zone's content is a Widget (scrolling text engine), not a Card playlist. Its content sources (club news, regional feeds, sponsor text) are separate from the Card authoring flow.
5. For MVP, the ticker Widget sources only club-authored text strings. Regional news API feeds and sponsor portal integration are future scope.
6. Do not use "template" as a standalone noun in code or docs. Use `template_type` (the discriminator field) or "Card" (the content entity).

**Renames applied 2026-06-20**:
- `renderTemplateStub()` → `renderCard()` in `apps/player-ui/src/template-stubs.ts`
- `STUB_COLORS` → `CARD_FALLBACK_COLORS` in same file

**Pending rename (BL-028)**:
- `screens.layout_template` → `screens.screen_layout` — column predates D-016. Migration + code update tracked in BL-028.

**Source**: Human decision 2026-06-20 — Gemini architecture review + vocabulary audit
**Status**: Active
