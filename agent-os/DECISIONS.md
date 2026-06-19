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
