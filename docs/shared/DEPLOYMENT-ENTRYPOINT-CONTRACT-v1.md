# DEPLOYMENT-ENTRYPOINT-CONTRACT-v1

**Document class:** Deployment Gate Contract
**Status:** AUTHORITATIVE
**Applies to:** `apps/cms-operator` CMS frontend — all deployments to staging and production
**Stack:** React 18 + TypeScript, Vite 5, pnpm + Turborepo, nginx static serving
**Version:** 1.0

---

## Purpose

This document defines the complete set of conditions that must hold before the CMS operator frontend is considered deployable. It specifies build-time invariants, runtime boot checks, nginx configuration requirements, health check definitions, hard failure conditions, rollback rules, version traceability, and the ordered CI pipeline. Nothing in this document introduces new governance, new roles, new workflows, or new system states. It translates existing constitutional requirements into deployment-enforceable gates.

---

## 1. Pre-Deployment Invariants

All invariants in sections 1.1 and 1.2 must pass. Any single failure blocks deployment. There are no exceptions at either build or boot time.

### 1.1 Build Invariants (CI Gate — Fail Build if Violated)

These checks run in CI before the Docker image is built. A failure at this stage aborts the pipeline and no image is produced.

| # | Invariant | Check Method | Hard Fail |
|---|-----------|-------------|-----------|
| B-01 | `VITE_API_BASE_URL` is set and non-empty | CI env check before vite build | Yes |
| B-02 | `VITE_WS_BASE_URL` is set and non-empty | CI env check before vite build | Yes |
| B-03 | `VITE_APP_VERSION` matches semver pattern `x.y.z` or `x.y.z-tag` | Regex `^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$` applied in CI before build | Yes |
| B-04 | TypeScript compilation exits 0 | `tsc --noEmit` across all workspace packages | Yes |
| B-05 | All HF-REG tests pass (10 tests, all blocking) | `vitest run` with HF-REG suite tag | Yes |
| B-06 | Vendor chunk < 250 KB gzipped | Bundle size script post-build | Yes |
| B-07 | Each surface chunk < 100 KB gzipped | Bundle size script post-build | Yes |
| B-08 | `chrome` + `ui-lib` chunks combined < 230 KB gzipped | Bundle size script post-build | Yes |
| B-09 | No `console.log` in production bundle source | ESLint rule `no-console` applied to `src/` | Yes |
| B-10 | `dist/index.html` exists and references a hashed main entry JS file | Post-build presence check + regex scan of index.html | Yes |

**Semver regex (authoritative):**

```
^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$
```

Valid examples: `1.0.0`, `2.3.14`, `1.0.0-rc.1`, `2.0.0-beta.3`
Invalid examples: `v1.0.0` (leading v not permitted), `1.0`, `latest`

**Bundle size limits (hard and soft):**

| Chunk | Soft Limit (warn) | Hard Limit (fail) |
|-------|------------------|------------------|
| vendor | 250 KB gzipped | 350 KB gzipped |
| any single surface chunk | 100 KB gzipped | 150 KB gzipped |
| chrome + ui-lib combined | 230 KB gzipped | Not separately gated (covered by per-chunk limit) |

When a soft limit is exceeded but the hard limit is not, CI emits a warning line in the build output and continues. The warning must be visible in the pipeline summary but does not block promotion.

### 1.2 Runtime Invariants (Checked at Boot — Hard Fail if Violated)

These checks execute during the application boot sequence, before any workspace surface is rendered. A hard fail at this stage must display a non-recoverable error screen and must not proceed to render operator surfaces.

| # | Invariant | Check Method | Failure Behavior |
|---|-----------|-------------|-----------------|
| R-01 | `window.__CLUBHUB_CONFIG__` or `import.meta.env.VITE_API_BASE_URL` resolves to a non-empty string | Evaluated synchronously at module init | Hard fail: render error screen, log to Sentry |
| R-02 | API base URL is reachable: `GET /system/health` returns HTTP 200 within 10 seconds | Async check during boot sequence, before workspace mount | Hard fail: render error screen with retry option |
| R-03 | WebSocket URL uses `wss://` protocol when `VITE_ENV` is not `development` | String prefix check at boot | Hard fail: render error screen |

**R-02 detail:** The 10-second timeout is measured from the moment the boot sequence initiates the health request. One retry is permitted with a 3-second delay before the failure is declared final. The retry does not reset the 10-second window; the total elapsed time budget from first request to final failure declaration is 13 seconds (10s timeout + 3s delay).

**R-03 clarification:** `ws://` is permitted only when `import.meta.env.VITE_ENV === "development"`. In all other environments (staging, production, any unlabeled environment), `ws://` is a hard boot failure. The check is a string prefix comparison on the resolved WebSocket URL.

### 1.3 Soft Warnings (Log, Do Not Fail Deployment)

| Condition | Warning Message | Destination |
|-----------|----------------|-------------|
| `VITE_SENTRY_DSN` absent at build time | `"Error tracking disabled — VITE_SENTRY_DSN not set"` | CI output (warning level) |
| `GET /system/health` returns HTTP 200 with `status: "degraded"` in body | `"Backend reports degraded state — proceeding with boot"` | Sentry (if configured), browser console |
| Any bundle chunk is 10% over soft limit but under hard limit | `"Bundle size warning: [chunk] is [size]KB gzipped (soft limit [limit]KB)"` | CI output (warning level) |

Soft warnings do not appear in operator-facing UI. They are internal signals for the engineering team.

---

## 2. nginx Configuration Contract

The nginx configuration inside the Docker container must satisfy every requirement in this section. Deviations are not permitted in staging or production images.

### 2.1 Required nginx Behaviors

1. Serve the `dist/` directory as the document root.
2. All routes must return `index.html` via SPA fallback (`try_files $uri /index.html`). This includes any path not matching a physical file in `dist/`.
3. Gzip compression must be enabled for `Content-Type` values: `application/javascript`, `text/css`, `application/json`, `text/html`.
4. The `/healthz` endpoint must return HTTP 200 with body `ok` (served as a static file at `dist/healthz`).
5. No API proxying through nginx. All API traffic routes directly from the browser to the cms-api service. nginx serves only static files.
6. No server-side rendering. nginx is a static file server only.

### 2.2 Cache-Control Header Requirements

| Asset Type | Cache-Control Value | Rationale |
|------------|-------------------|-----------|
| `index.html` | `no-cache, no-store` | Must revalidate on every load to pick up new hashed asset references |
| Hashed JS/CSS assets (filenames contain content hash) | `max-age=31536000, immutable` | Content-addressed; safe to cache permanently |
| `dist/healthz` | `no-cache` | Health probe must reflect current container state |
| All other static assets | `max-age=3600` | Default; subject to review |

### 2.3 Required Security Headers

All responses from nginx must include:

| Header | Required Value |
|--------|---------------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

### 2.4 Reference nginx Configuration Snippet

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types application/javascript text/css application/json text/html;
    gzip_min_length 1024;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location = /index.html {
        add_header Cache-Control "no-cache, no-store" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    location = /healthz {
        add_header Cache-Control "no-cache" always;
        add_header Content-Type "text/plain" always;
    }

    location ~* \.[0-9a-f]{8,}\.(js|css)$ {
        add_header Cache-Control "max-age=31536000, immutable" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    location / {
        try_files $uri /index.html;
        add_header Cache-Control "max-age=3600" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
}
```

Note: The `add_header` directive in nginx does not inherit across location blocks when a location block defines its own `add_header` directives. Security headers must be repeated in every location block that overrides them. The reference configuration above does this explicitly. Any nginx config that omits security headers from any location block is non-compliant.

---

## 3. Health Check Definition

### 3.1 Docker HEALTHCHECK

The Dockerfile for the CMS operator frontend must include:

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/healthz || exit 1
```

Parameters:
- `--interval=15s` — check every 15 seconds after the previous check completes
- `--timeout=5s` — the curl request must complete within 5 seconds or the check fails
- `--start-period=10s` — nginx is given 10 seconds to initialize before health checks begin counting toward retries
- `--retries=3` — container is marked unhealthy after 3 consecutive failures

### 3.2 The /healthz Endpoint

- `/healthz` is a static file placed at `dist/healthz` during the build step (not generated by nginx itself).
- Content: the literal string `ok` with no trailing newline required, but acceptable.
- nginx serves this file with `Content-Type: text/plain` and `Cache-Control: no-cache`.
- A successful health check is HTTP 200 with body containing `ok`.

### 3.3 Scope of the Health Check

The Docker HEALTHCHECK tests only that nginx is running and serving files. It does not test:

- Backend API reachability
- Database connectivity
- WebSocket availability
- Authentication service availability

Backend health is the responsibility of the cms-api container's own HEALTHCHECK declaration. Orchestration systems (Docker Compose, Kubernetes) must not gate frontend container health on backend container health. These are independent health domains.

### 3.4 Unhealthy Container Behavior

A container that transitions to the `unhealthy` state must be treated as a deployment failure by the orchestration layer. Automatic rollback rules are defined in section 6.

---

## 4. Hard Failure Conditions (Deployment Must Abort)

The following conditions must prevent the frontend image from being promoted to production. They are enforced at the CI pipeline level. No manual override is permitted for conditions marked as non-bypassable.

| # | Condition | Stage Where Enforced | Bypassable |
|---|-----------|---------------------|------------|
| HF-01 | TypeScript compilation errors (`tsc --noEmit` exits non-zero) | Step 2 (tsc) | No |
| HF-02 | Any HF-REG test failure | Step 4 (Vitest) | No |
| HF-03 | Vendor chunk exceeds 350 KB gzipped | Step 6 (bundle size check) | No |
| HF-04 | Any surface chunk exceeds 150 KB gzipped | Step 6 (bundle size check) | No |
| HF-05 | `dist/index.html` absent after build | Step 7 (presence check) | No |
| HF-06 | IC-03 ESLint rule violations (`local/no-write-control-without-replay-guard`) | Step 3 (ESLint) | No |
| HF-07 | `VITE_API_BASE_URL` not set or empty | Step 5 (pre-build env check) | No |
| HF-08 | `console.log` present in production source files | Step 3 (ESLint no-console) | No |
| HF-09 | Docker container fails HEALTHCHECK within 60 seconds of start | Step 9 (smoke test) | No |
| HF-10 | `dist/index.html` does not reference a hashed main entry JS file | Step 7 (presence + reference check) | No |

### 4.1 HF-REG Test Registry

The following 10 tests must all pass. A failure in any one blocks deployment.

| Test ID | Description |
|---------|-------------|
| HF-REG-001 | Boot sequence hard-fails when `VITE_API_BASE_URL` resolves to empty string |
| HF-REG-002 | Boot sequence hard-fails when `/system/health` returns non-200 after retry budget exhausted |
| HF-REG-003 | Boot sequence hard-fails when WebSocket URL is `ws://` in non-development environment |
| HF-REG-004 | Version string `window.__CLUBHUB_VERSION__` is present and matches `VITE_APP_VERSION` at build time |
| HF-REG-005 | All API requests include `X-Client-Version` header matching `window.__CLUBHUB_VERSION__` |
| HF-REG-006 | Version mismatch banner renders (amber, non-blocking) when `X-Min-Client-Version` exceeds current version |
| HF-REG-007 | IC-03 guard: write-control components without replay guard wrapper fail component test |
| HF-REG-008 | `dist/healthz` file is present in build output and contains `ok` |
| HF-REG-009 | Degraded backend state (`/system/health` returns `status: "degraded"`) does not hard-fail boot |
| HF-REG-010 | `VITE_SENTRY_DSN` absent produces a console warning, not a thrown error or boot failure |

### 4.2 IC-03 Rule Definition

The ESLint rule `local/no-write-control-without-replay-guard` (IC-03) enforces that any component rendering a write-capable control (buttons that mutate state, form submissions, override confirmations) must be wrapped in or accompanied by a replay guard. This rule is defined in the local ESLint plugin at `tooling/eslint-plugin-local`. A violation at the component source level is a hard build failure (HF-06).

---

## 5. Environment Parity Requirements

### 5.1 Environment Definitions

| Environment | Serving Method | API URL | WS URL | VITE_ENV value |
|-------------|---------------|---------|--------|----------------|
| Development | Vite dev server (`npm run dev`) | `http://localhost:3000` | `ws://localhost:3000` | `development` |
| Staging | Docker + nginx (same image class as production) | Staging backend URL (set at build time) | Staging WS URL (set at build time) | `staging` |
| Production | Docker + nginx | Production backend URL (set at build time) | Production WS URL (set at build time) | `production` |

### 5.2 Environment Variable Specifications

| Variable | Required | Build-Time | Default | Notes |
|----------|----------|------------|---------|-------|
| `VITE_API_BASE_URL` | Yes | Yes | None | Hard fail if absent |
| `VITE_WS_BASE_URL` | Yes | Yes | None | Hard fail if absent |
| `VITE_APP_VERSION` | Yes | Yes | None | Must match semver pattern |
| `VITE_ENV` | Yes | Yes | `production` | Controls ws:// permission and dev tooling |
| `VITE_SENTRY_DSN` | No | Yes | None | Absent = warning only |

### 5.3 Critical: Build-Time Variable Baking

Vite bakes `VITE_` prefixed environment variables into the compiled bundle at build time. There is no runtime injection mechanism after the build step completes. This has the following mandatory consequences:

1. Staging and production require separate build artifacts. The same `dist/` output cannot be reused across environments by swapping environment variables at runtime.
2. The CI pipeline must produce two distinct builds: one for staging (with staging env vars) and one for production (with production env vars).
3. The Docker image built from the staging artifact must not be promoted to production. A separate production image must be built with production env vars injected.
4. Any process that attempts to share a single build artifact across environments by injecting variables at container start time (via entrypoint scripts, `envsubst`, or similar) is non-compliant with this contract and must not be used.

### 5.4 Development Environment

Running `npm run dev` from `apps/cms-operator` starts the Vite dev server. This is not a Docker deployment. No nginx is involved. The `.env.development` file in `apps/cms-operator/` must contain:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_ENV=development
VITE_APP_VERSION=0.0.0-dev
```

`VITE_SENTRY_DSN` must not be set in `.env.development` unless a developer explicitly opts in to route local errors to Sentry. The absence of this variable in development is expected and produces the soft warning defined in section 1.3.

---

## 6. Rollback Contract

### 6.1 Automatic Rollback Trigger

A frontend deployment must be automatically rolled back if either of the following conditions is true:

1. The Docker container fails its HEALTHCHECK (`/healthz` does not return 200) within 60 seconds of the container reaching the `running` state.
2. The orchestration system marks the container as `unhealthy` after the retry budget defined in section 3.1 is exhausted.

### 6.2 Rollback Mechanism

Rollback consists of redeploying the previously running image tag. The CI/CD system must maintain a reference to the last-known-good image tag for each environment independently.

1. On every successful deployment to an environment, the deployed image tag is recorded as that environment's last-known-good tag.
2. On rollback, the last-known-good tag is redeployed to the affected environment.
3. The rollback deployment itself is subject to the same HEALTHCHECK gate. If the rollback image also fails its health check, the deployment system must alert the on-call engineer and halt further automated attempts.

### 6.3 Rollback Scope

Frontend rollback is strictly independent of backend rollback:

- Rolling back the frontend does not trigger a backend rollback.
- Rolling back the backend does not trigger a frontend rollback.
- The frontend is stateless static files. There is no database state to reverse.
- There are no database migrations in frontend deployments. Frontend rollback requires only redeploying a prior Docker image.

### 6.4 Version Mismatch After Rollback

If a frontend rollback results in `window.__CLUBHUB_VERSION__` being older than the `X-Min-Client-Version` returned by the current backend, the version mismatch banner defined in section 7.4 will appear. This is expected behavior and does not constitute a system error. The on-call engineer must assess whether a backend rollback is also required based on operational conditions.

---

## 7. Version Traceability

### 7.1 Version Baking

`VITE_APP_VERSION` is injected into the bundle at build time via the Vite `define` configuration:

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    'window.__CLUBHUB_VERSION__': JSON.stringify(process.env.VITE_APP_VERSION),
  },
});
```

This makes `window.__CLUBHUB_VERSION__` available as a global in the browser at runtime. The value is the exact string provided as `VITE_APP_VERSION` during the build. It is not derived at runtime; it is a compile-time constant baked into the bundle.

### 7.2 Version Display in Operator UI

The version string must appear in the Settings panel footer in the following format:

```
ClubHub TV vX.Y.Z
```

Where `X.Y.Z` is the value of `window.__CLUBHUB_VERSION__`. This display is read-only and informational. In development builds where `VITE_APP_VERSION=0.0.0-dev`, the footer displays `ClubHub TV v0.0.0-dev`.

### 7.3 Version Header on API Requests

Every HTTP request made by `@clubhub/api` to the cms-api backend must include:

```
X-Client-Version: x.y.z
```

The value is sourced from `window.__CLUBHUB_VERSION__` at the time the request is constructed. This header is applied by the typed fetch wrapper in `@clubhub/api` as a default header on all requests. Individual call sites must not need to set this header manually.

### 7.4 Version Mismatch Handling

When the cms-api responds to any request with the header:

```
X-Min-Client-Version: x.y.z
```

The frontend must compare the returned version against `window.__CLUBHUB_VERSION__` using semver precedence rules. If the returned minimum version is greater than the current client version:

1. Display a non-blocking amber banner at the top of the workspace.
2. Banner text: `"Update available — reload to get the latest version"`
3. The banner must include a reload button that triggers `window.location.reload()`.
4. The banner must not block any operator action. All surfaces, controls, and data remain fully interactive while the banner is displayed.
5. The banner must not be dismissible by the operator (it persists until the page is reloaded or the mismatch condition clears).
6. The mismatch check must be performed on every API response that includes the `X-Min-Client-Version` header. If the header is absent, no check is performed.

---

## 8. CI Pipeline Steps (Ordered)

The following steps execute in order. A failure at any step aborts the pipeline. No step may be skipped or reordered.

1. **`pnpm install --frozen-lockfile`**
   Install all workspace dependencies using the lockfile. A lockfile mismatch (e.g., `pnpm-lock.yaml` out of sync with `package.json`) causes step failure. No network requests beyond those defined in the lockfile are permitted during this step.

2. **`tsc --noEmit` (all packages)**
   TypeScript type checking across all workspace packages: `@clubhub/types`, `@clubhub/api`, `@clubhub/state`, `@clubhub/ui`, `@clubhub/hooks`, and `apps/cms-operator`. The `--noEmit` flag ensures no files are written. Exit code non-zero is hard failure HF-01.

3. **ESLint (includes IC-03 rule and no-console)**
   Run ESLint with the workspace configuration across all `src/` directories. This includes:
   - `local/no-write-control-without-replay-guard` (IC-03 — hard failure HF-06 if violated)
   - `no-console` for all files under `src/` (hard failure HF-08 if violated)
   - All other configured rules at their configured severity levels

4. **Vitest (unit + integration, includes all HF-REG tests)**
   Run the full Vitest suite. The HF-REG test suite (HF-REG-001 through HF-REG-010) must all pass. Any test failure is hard failure HF-02. E2E Playwright tests are not included in this step (see section 9).

5. **`vite build` (with VITE_ vars injected)**
   Build the production bundle with all required environment variables set. The build must complete without error. The output is written to `dist/`. The `dist/healthz` static file must be copied into `dist/` as part of this step (via a `vite.config.ts` plugin or `publicDir` configuration).

6. **Bundle size check**
   Inspect the `dist/` output. Measure gzipped sizes of all JS chunks. Apply thresholds from section 1.1. Soft limit violations emit warnings. Hard limit violations (HF-03, HF-04) abort the pipeline.

7. **`dist/index.html` presence and reference check**
   Verify that `dist/index.html` exists (HF-05) and that it contains a `<script>` tag referencing a hashed JS filename (pattern: filename containing 8 or more hex characters before the `.js` extension). Failure is HF-10.

8. **Docker image build**
   Build the Docker image using the Dockerfile in `apps/cms-operator/`. The image copies the `dist/` directory to `/usr/share/nginx/html` and applies the nginx configuration defined in section 2. No environment variables are injected at this stage; the env vars were baked in at step 5.

9. **Docker HEALTHCHECK smoke test**
   Start the built container. Wait up to 60 seconds for the container to reach a healthy state (HEALTHCHECK passes). The smoke test issues `curl -f http://localhost/healthz` against the running container. A failure within 60 seconds is hard failure HF-09.

10. **Push image to registry**
    Push the image to the container registry. This step executes only if all preceding steps pass. The image is tagged with `VITE_APP_VERSION` and the git commit SHA. The image tag is recorded as the last-known-good tag for the target environment on successful deployment.

---

## 9. What Is NOT Part of This Contract

The following items are explicitly out of scope for this document. They are governed elsewhere or managed by separate pipeline stages.

| Item | Rationale for Exclusion |
|------|------------------------|
| Backend API availability at build time | Not checked at build time. Runtime check at boot (R-02) covers reachability. |
| E2E Playwright tests | Run in a separate pipeline stage after image push. Not blocking for image build. |
| Content delivery network (CDN) configuration | Infrastructure concern, not a frontend deployment gate. |
| SSL/TLS certificate management | Infrastructure concern. nginx inside the container terminates HTTP only; TLS is terminated upstream. |
| Database migrations | The frontend is stateless static files. No database is touched by a frontend deployment. |
| Backend compatibility testing beyond version header | The version mismatch banner (section 7.4) is the frontend's sole compatibility signal. API contract compatibility is governed by the backend's own deployment contract. |
| Monitoring and alerting configuration | Operational concern governed by the observability contract, not this document. |
| Load balancer or ingress configuration | Infrastructure concern. nginx inside the container does not interact with upstream load balancing. |

---

## Appendix A: Invariant Summary Table

| ID | Type | Description | Failure Action |
|----|------|-------------|---------------|
| B-01 | Build | `VITE_API_BASE_URL` set and non-empty | Abort build |
| B-02 | Build | `VITE_WS_BASE_URL` set and non-empty | Abort build |
| B-03 | Build | `VITE_APP_VERSION` matches semver | Abort build |
| B-04 | Build | TypeScript compiles clean | Abort build |
| B-05 | Build | All 10 HF-REG tests pass | Abort build |
| B-06 | Build | Vendor chunk < 250 KB gzipped | Warn (soft) / Abort at 350 KB (hard) |
| B-07 | Build | Each surface chunk < 100 KB gzipped | Warn (soft) / Abort at 150 KB (hard) |
| B-08 | Build | chrome + ui-lib combined < 230 KB gzipped | Warn (soft) |
| B-09 | Build | No `console.log` in source | Abort build |
| B-10 | Build | `dist/index.html` references hashed JS entry | Abort build |
| R-01 | Runtime | API base URL resolves to non-empty string | Hard fail boot |
| R-02 | Runtime | `GET /system/health` returns 200 within 10s | Hard fail boot (with retry) |
| R-03 | Runtime | WebSocket uses `wss://` in non-development | Hard fail boot |

---

## Appendix B: File Layout After Build

The following files must exist in `dist/` after a successful build:

```
dist/
  index.html                        (references hashed JS entry, Cache-Control: no-cache)
  healthz                           (content: "ok", served as text/plain)
  assets/
    main.[hash].js                  (hashed, Cache-Control: immutable)
    vendor.[hash].js                (hashed, Cache-Control: immutable)
    [surface].[hash].js             (one per surface chunk, hashed, Cache-Control: immutable)
    [name].[hash].css               (hashed, Cache-Control: immutable)
```

Files not matching the hashed asset pattern (e.g., `index.html`, `healthz`) must be served with `no-cache` or `no-store` headers. Files matching the hashed pattern must be served with `max-age=31536000, immutable`.
