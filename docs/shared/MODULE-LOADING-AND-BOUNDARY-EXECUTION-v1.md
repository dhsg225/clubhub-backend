# MODULE-LOADING-AND-BOUNDARY-EXECUTION-v1

**Classification:** Frontend Engineering Specification
**Status:** Authoritative
**Applies to:** ClubHub TV Operator CMS — React Frontend
**Build tool:** Vite 5+
**React version:** 18
**Module format:** ESM only (no CommonJS)
**Monorepo:** Turborepo + pnpm
**Version:** 1.0.0

---

## Purpose

This document specifies how modules load at runtime, defines code splitting strategy, establishes lazy loading rules, and enforces cross-module import boundaries for the ClubHub TV operator CMS frontend. Every rule in this document is enforced either by ESLint, CI, or runtime guard. None are advisory.

---

## 1. Bundle Architecture

### 1.1 Vite Manual Chunk Configuration

The following Vite configuration is the authoritative chunk definition. Deviations require a specification update before implementation.

```typescript
// apps/cms/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            'zustand',
          ],
          'chrome': [
            // Shell layout and auth
            path.resolve(__dirname, 'src/chrome/shell/ShellLayout.tsx'),
            path.resolve(__dirname, 'src/chrome/shell/AuthGate.tsx'),
            path.resolve(__dirname, 'src/chrome/shell/RealtimeProvider.tsx'),
            path.resolve(__dirname, 'src/chrome/shell/BootstrapLoadingScreen.tsx'),
            path.resolve(__dirname, 'src/chrome/shell/BootstrapErrorScreen.tsx'),
            // System status bar
            path.resolve(__dirname, 'src/chrome/system-status-bar/SystemStatusBar.tsx'),
            // Zone A (left navigation)
            path.resolve(__dirname, 'src/chrome/zone-a/ZoneA.tsx'),
            // Zone C (contextual right panel)
            path.resolve(__dirname, 'src/chrome/zone-c/ZoneC.tsx'),
            // Shared packages (runtime dependencies of chrome)
            '@clubhub/api',
            '@clubhub/state',
            '@clubhub/hooks',
          ],
          'ui-lib': [
            '@clubhub/ui',
          ],
          // Surface chunks are produced automatically by React.lazy() imports.
          // Vite/Rollup creates separate chunks per dynamic import point:
          //   live-ops.[hash].js          — surfaces/live-ops/index.tsx
          //   incident-command.[hash].js  — surfaces/incident-command/index.tsx
          //   venue-ops.[hash].js         — surfaces/venue-ops/index.tsx
          //   cms-operations.[hash].js    — surfaces/cms-operations/index.tsx
          //   replay.[hash].js            — surfaces/replay-investigation/index.tsx
          //
          // Do NOT add surface entry points to manualChunks — doing so would
          // merge them into the synchronous bundle and destroy lazy loading.
        },
      },
    },
  },
  resolve: {
    alias: {
      '@clubhub/types': path.resolve(__dirname, '../../packages/types/src'),
      '@clubhub/api': path.resolve(__dirname, '../../packages/api/src'),
      '@clubhub/state': path.resolve(__dirname, '../../packages/state/src'),
      '@clubhub/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@clubhub/hooks': path.resolve(__dirname, '../../packages/hooks/src'),
    },
  },
})
```

### 1.2 Chunk Definitions and Rationale

| Chunk | Contents | Load strategy | Size target (gzipped) |
|-------|----------|---------------|-----------------------|
| `vendor` | React, React DOM, React Router, React Query, Zustand | Synchronous, cached long-term via content hash | <250KB |
| `chrome` | Shell, ZoneA, ZoneC, StatusBar, AuthGate, RealtimeProvider, error screens, `@clubhub/api`, `@clubhub/state`, `@clubhub/hooks` | Synchronous with application bootstrap | <150KB |
| `ui-lib` | `@clubhub/ui` — all shared UI components | Synchronous (chrome imports UI components) | <80KB |
| `live-ops` | Live Operations surface (`surfaces/live-ops/`) | Lazy, loaded on route `/ops/live` | <100KB |
| `incident-command` | Incident Command surface (`surfaces/incident-command/`) | Lazy + preloaded on `INCIDENT_CREATED` event | <100KB |
| `venue-ops` | Venue Operations surface (`surfaces/venue-ops/`) | Lazy, loaded on route `/ops/venues/:id` | <80KB |
| `cms-operations` | CMS Operations surface (`surfaces/cms-operations/`) | Lazy, loaded on route `/ops/cms` | <80KB |
| `replay` | Replay Investigation surface — placeholder only (`surfaces/replay-investigation/`) | Lazy, loaded on route `/ops/replay` | <10KB |
| `@clubhub/types` | TypeScript type declarations | Compile-time only — zero runtime bytes | 0KB |

**Rationale for synchronous chrome chunk:**
The chrome layer (shell, auth, realtime, status bar, zone navigation) must be present on first render. Any network fetch for these modules before render would introduce a flash of unstyled content or a blank screen. The trade-off (larger initial download) is acceptable because chrome is cached with a long TTL after the first load.

**Rationale for lazy surfaces:**
An operator navigates to at most one or two surfaces per session. Loading all five surfaces synchronously would waste bandwidth on modules that are never used. Lazy loading reduces the initial parse cost to vendor + chrome + ui-lib (~480KB gzipped maximum).

**Rationale for incident-command preload:**
The IC surface is activated automatically by `ZONE_B_AUTO_REPLACE` on S1 and S2 incidents. If the chunk has not been fetched when `ZONE_B_AUTO_REPLACE` fires, there is a noticeable loading delay during an emergency. Preloading eliminates that delay. See Section 3.

---

## 2. Lazy Loading Rules

These rules are mandatory. ESLint enforces Rules 3–5. CI build verification enforces Rule 1 (chunk presence). Rules 2 and 6 are verified by code review.

### Rule 1 — Surface modules are lazy-loaded with React.lazy()

All five surface entry points are imported exclusively via `React.lazy()`. The lazy import definitions are centralized in `routes/lazy.ts`. No other file in the application imports surface entry points directly.

```typescript
// apps/cms/src/routes/lazy.ts
import { lazy } from 'react'

export const LazyLiveOpsVenueView = lazy(() =>
  import('../surfaces/live-ops').then(m => ({ default: m.LiveOpsVenueView }))
)

export const LazyIncidentCommandView = lazy(() =>
  import('../surfaces/incident-command').then(m => ({ default: m.IncidentCommandView }))
)

export const LazyVenueOpsView = lazy(() =>
  import('../surfaces/venue-ops').then(m => ({ default: m.VenueOpsView }))
)

export const LazyCmsOperationsView = lazy(() =>
  import('../surfaces/cms-operations').then(m => ({ default: m.CmsOperationsView }))
)

export const LazyReplayInvestigationView = lazy(() =>
  import('../surfaces/replay-investigation').then(m => ({ default: m.ReplayInvestigationView }))
)
```

The `.then(m => ({ default: m.NamedExport }))` pattern is required because `React.lazy()` requires a module with a default export, but surface entry points use named exports for clarity. Do not change surface exports to default to accommodate lazy loading — the named export convention is intentional.

### Rule 2 — Suspense boundaries are at route level only

Every lazy surface is wrapped in a `<Suspense>` boundary in the router configuration. `<Suspense>` is not placed inside surfaces, inside zone components, or inside the shell.

```typescript
// apps/cms/src/routes/AppRouter.tsx
import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { SurfaceLoadingState } from '../chrome/shell/SurfaceLoadingState'
import { SurfaceErrorBoundary } from '../chrome/shell/SurfaceErrorBoundary'
import {
  LazyLiveOpsVenueView,
  LazyIncidentCommandView,
  LazyVenueOpsView,
  LazyCmsOperationsView,
  LazyReplayInvestigationView,
} from './lazy'

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/ops/live"
        element={
          <SurfaceErrorBoundary>
            <Suspense fallback={<SurfaceLoadingState />}>
              <LazyLiveOpsVenueView />
            </Suspense>
          </SurfaceErrorBoundary>
        }
      />
      <Route
        path="/ops/incident"
        element={
          <SurfaceErrorBoundary>
            <Suspense fallback={<SurfaceLoadingState />}>
              <LazyIncidentCommandView />
            </Suspense>
          </SurfaceErrorBoundary>
        }
      />
      <Route
        path="/ops/venues/:id"
        element={
          <SurfaceErrorBoundary>
            <Suspense fallback={<SurfaceLoadingState />}>
              <LazyVenueOpsView />
            </Suspense>
          </SurfaceErrorBoundary>
        }
      />
      <Route
        path="/ops/cms"
        element={
          <SurfaceErrorBoundary>
            <Suspense fallback={<SurfaceLoadingState />}>
              <LazyCmsOperationsView />
            </Suspense>
          </SurfaceErrorBoundary>
        }
      />
      <Route
        path="/ops/replay"
        element={
          <SurfaceErrorBoundary>
            <Suspense fallback={<SurfaceLoadingState />}>
              <LazyReplayInvestigationView />
            </Suspense>
          </SurfaceErrorBoundary>
        }
      />
    </Routes>
  )
}
```

`SurfaceLoadingState` is a lightweight component in the chrome chunk (already synchronously loaded). It renders a skeleton that matches the shell layout — zone B fills with a neutral loading indicator.

### Rule 3 — Chrome modules are never lazy

The following modules must be synchronously imported (static import statements, not dynamic):

- `chrome/shell/ShellLayout.tsx`
- `chrome/shell/AuthGate.tsx`
- `chrome/shell/RealtimeProvider.tsx`
- `chrome/shell/BootstrapLoadingScreen.tsx`
- `chrome/shell/BootstrapErrorScreen.tsx`
- `chrome/system-status-bar/SystemStatusBar.tsx`
- `chrome/zone-a/ZoneA.tsx`
- `chrome/zone-c/ZoneC.tsx`

ESLint rule `local/no-lazy-chrome` enforces this. Any `React.lazy()` or dynamic `import()` targeting a `chrome/**` path is a lint error.

### Rule 4 — @clubhub/ui components are never lazy

All shared UI components from `@clubhub/ui` are bundled in the synchronous `ui-lib` chunk. Surface components import from `@clubhub/ui` via static import. Dynamic import of any `@clubhub/ui` component is a lint error (`local/no-lazy-ui`).

### Rule 5 — Surface-internal lazy loading is prohibited

A surface module exports its entry component synchronously from `index.tsx`. Sub-components within a surface (`Tab1.tsx`, `AnnotationPanel.tsx`, etc.) are imported with static imports inside the surface. There is no `React.lazy()` or dynamic `import()` inside any surface directory.

Rationale: Surface chunks are already small (<100KB target). Splitting a surface further creates waterfall loading within the surface. The loading state during waterfall would be unacceptable during incident response. If a surface chunk approaches its size target, the correct response is to audit the surface's dependencies, not to add internal lazy splitting.

### Rule 6 — @clubhub/types produces no runtime bundle

`@clubhub/types` contains only TypeScript type declarations (`.d.ts` files or type-only `.ts` files). All imports from `@clubhub/types` are erased by the TypeScript compiler before Vite processes the module graph. If `@clubhub/types` appears in the Rollup bundle analysis output as a runtime chunk, that is a build configuration error.

Verification: Run `pnpm build --report` and confirm `@clubhub/types` does not appear in the chunk map.

---

## 3. Preloading Strategy

### 3.1 Incident Command — Critical Preload

The IC surface chunk is preloaded on the first `INCIDENT_CREATED` WebSocket event. This is implemented in `RealtimeProvider.tsx`:

```typescript
// apps/cms/src/chrome/shell/RealtimeProvider.tsx

let incidentCommandPreloaded = false

function preloadIncidentCommandChunk(): void {
  if (incidentCommandPreloaded) return
  incidentCommandPreloaded = true
  // Fire-and-forget. No await. No error handling required —
  // React.lazy() will attempt its own fetch if this preload fails.
  import('../surfaces/incident-command').catch(() => {
    // Preload failure is not fatal. The Suspense boundary will retry
    // on navigation. Log for observability only.
    console.warn('[Preload] incident-command chunk preload failed — will retry on navigation')
  })
}

// Inside the WebSocket message handler:
function handleRealtimeMessage(message: RealtimeMessage): void {
  if (message.type === 'INCIDENT_CREATED') {
    preloadIncidentCommandChunk()
    // ... other incident handling
  }
  // ... other message types
}
```

**Why fire-and-forget:** The preload is opportunistic. If it succeeds, the chunk is in the browser cache before `ZONE_B_AUTO_REPLACE` fires. If it fails, `React.lazy()` handles the fetch on navigation with a Suspense fallback. The `incidentCommandPreloaded` flag prevents repeated preload attempts.

**Timing:** `INCIDENT_CREATED` fires when an incident is first registered. `ZONE_B_AUTO_REPLACE` fires when incident severity reaches S1 or S2 after operator acknowledgement or automatic escalation. The gap between these events is typically 5–30 seconds — sufficient for a preload on a normal network connection.

### 3.2 All Other Surfaces — On-Navigate Loading

`live-ops`, `venue-ops`, `cms-operations`, and `replay` load on first navigation to their route. No preloading. The Suspense fallback (`SurfaceLoadingState`) is shown during the fetch. This is acceptable because these surfaces are not activated during emergencies and their users can tolerate a brief loading state.

### 3.3 Vendor and Chrome Chunk Caching

Vendor and chrome chunks are named with a content hash by Vite (e.g., `vendor.a3f9c12b.js`). The server must serve these with:

```
Cache-Control: public, max-age=31536000, immutable
```

On deployment, new content hashes invalidate old cached files. Operators who have the app open during a deployment will continue using the previous bundle until they reload.

---

## 4. Import Boundary Enforcement

All rules in this section are enforced by ESLint `import/no-restricted-paths` and a CI import graph validation script. Violations block merge.

### 4.1 ESLint Configuration

```javascript
// apps/cms/.eslintrc.cjs
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [

          // --- Cross-surface isolation ---
          // Each surface is forbidden from importing any other surface.
          {
            target: './src/surfaces/live-ops',
            from: [
              './src/surfaces/incident-command',
              './src/surfaces/venue-ops',
              './src/surfaces/cms-operations',
              './src/surfaces/replay-investigation',
            ],
            message: 'Surfaces cannot import from other surfaces. Share code via @clubhub/* packages or chrome/.',
          },
          {
            target: './src/surfaces/incident-command',
            from: [
              './src/surfaces/live-ops',
              './src/surfaces/venue-ops',
              './src/surfaces/cms-operations',
              './src/surfaces/replay-investigation',
            ],
            message: 'Surfaces cannot import from other surfaces. Share code via @clubhub/* packages or chrome/.',
          },
          {
            target: './src/surfaces/venue-ops',
            from: [
              './src/surfaces/live-ops',
              './src/surfaces/incident-command',
              './src/surfaces/cms-operations',
              './src/surfaces/replay-investigation',
            ],
            message: 'Surfaces cannot import from other surfaces. Share code via @clubhub/* packages or chrome/.',
          },
          {
            target: './src/surfaces/cms-operations',
            from: [
              './src/surfaces/live-ops',
              './src/surfaces/incident-command',
              './src/surfaces/venue-ops',
              './src/surfaces/replay-investigation',
            ],
            message: 'Surfaces cannot import from other surfaces. Share code via @clubhub/* packages or chrome/.',
          },
          {
            target: './src/surfaces/replay-investigation',
            from: [
              './src/surfaces/live-ops',
              './src/surfaces/incident-command',
              './src/surfaces/venue-ops',
              './src/surfaces/cms-operations',
            ],
            message: 'Surfaces cannot import from other surfaces. Share code via @clubhub/* packages or chrome/.',
          },

          // --- Surface cannot import chrome internals ---
          // Surfaces may use @clubhub/* packages but not chrome/** directly.
          {
            target: './src/surfaces',
            from: './src/chrome',
            message: 'Surfaces cannot import from chrome/**. Use @clubhub/ui, @clubhub/state, @clubhub/api, @clubhub/hooks, or @clubhub/types.',
          },

          // --- Chrome cannot import surfaces ---
          // Zone B navigation uses useNavigate(), not surface imports.
          {
            target: './src/chrome',
            from: './src/surfaces',
            message: 'Chrome cannot import from surfaces/**. Use router navigation (useNavigate) to trigger surface transitions.',
          },

          // --- @clubhub/ui is stateless —  no upward app dependencies ---
          {
            target: '../../packages/ui/src',
            from: [
              '../../apps',
              '../../packages/state/src',
              '../../packages/api/src',
              '../../packages/hooks/src',
            ],
            message: '@clubhub/ui is stateless. It cannot import from apps or state/api/hooks packages. Receive state via props.',
          },

          // --- @clubhub/api has no upward app dependencies ---
          {
            target: '../../packages/api/src',
            from: [
              '../../apps',
              '../../packages/state/src',
              '../../packages/ui/src',
              '../../packages/hooks/src',
            ],
            message: '@clubhub/api cannot import from apps or other packages except @clubhub/types.',
          },

          // --- @clubhub/types is a leaf package ---
          {
            target: '../../packages/types/src',
            from: [
              '../../apps',
              '../../packages/api/src',
              '../../packages/state/src',
              '../../packages/ui/src',
              '../../packages/hooks/src',
            ],
            message: '@clubhub/types is a leaf. It cannot import from any other package.',
          },

        ],
      },
    ],
  },
}
```

### 4.2 Import Boundary Map

The following diagram shows the legal import directions. An arrow means "may import from".

```
@clubhub/types   (leaf — no outbound imports)
     ^
     |
@clubhub/api ────────────────────────────────┐
@clubhub/state                               |
@clubhub/hooks                               |
     ^                                       |
     |                                       |
@clubhub/ui  (stateless — no state/api)     |
     ^                                       |
     |                                       |
chrome/**  ──────────────────────────────────┤
     ^                                       |
     |                                       |
surfaces/**  (each surface is isolated)  ────┘
     ^
     |
routes/lazy.ts  (the only file that imports surface entry points)
```

### 4.3 CI Import Graph Validation

In addition to ESLint, a CI script validates the compiled import graph using Rollup's module resolution output:

```typescript
// ci/scripts/validate-import-boundaries.ts
// Runs after `pnpm build` — reads the Rollup module graph from stats output.
// Asserts:
//   1. No surface chunk imports any other surface chunk (by module ID)
//   2. No surface chunk contains any chrome/** module ID
//   3. chrome chunk does not contain any surface/** module ID
//   4. @clubhub/types has zero runtime bytes in any chunk
//   5. All 5 surface chunks exist in the build output
//   6. Surface chunks are not present in vendor or chrome chunks
```

This script runs in CI stage 03 (build verification) and blocks merge on any violation.

---

## 5. IC-03 Enforcement at Module Boundary

IC-03 rule: No write control may render when `is_replay_mode === true`. Write controls must be absent from the DOM (not disabled, not hidden with CSS — absent).

### 5.1 useReplayGuard Hook

```typescript
// packages/hooks/src/useReplayGuard.ts
import { useReplayStore } from '@clubhub/state'

export interface ReplayGuardResult {
  isReplayMode: boolean
}

export function useReplayGuard(): ReplayGuardResult {
  const isReplayMode = useReplayStore(s => s.is_replay_mode)
  return { isReplayMode }
}
```

This hook is exported from `@clubhub/hooks` and is available to all surfaces via `import { useReplayGuard } from '@clubhub/hooks'`.

### 5.2 Component Pattern — Mandatory

Every component that renders a write control (button with a side effect, form submission, override trigger, escalation action, annotation write) must follow this pattern:

```typescript
// Pattern: Write control component with IC-03 enforcement
import { useReplayGuard } from '@clubhub/hooks'

export function L6OverridePlacementFlow() {
  const { isReplayMode } = useReplayGuard()

  // ABSENT — not disabled, not hidden. Return null removes from DOM entirely.
  if (isReplayMode) return null

  return <SequentialChipSelect {/* ...props */} />
}
```

```typescript
// Pattern: Escalation button — IC-03 enforcement
import { useReplayGuard } from '@clubhub/hooks'

export function EscalateToS1Button({ incidentId }: { incidentId: string }) {
  const { isReplayMode } = useReplayGuard()

  if (isReplayMode) return null

  return (
    <button onClick={() => escalateIncident(incidentId, 'S1')}>
      Escalate to S1
    </button>
  )
}
```

### 5.3 ESLint Custom Rule — local/no-write-control-without-replay-guard

This custom rule is defined in `apps/cms/eslint-rules/no-write-control-without-replay-guard.js`.

**What it checks:** Any component file within `src/surfaces/incident-command/**` or `src/surfaces/live-ops/**` that renders `<button>`, `<input type="submit">`, `<input type="button">`, or `<form>` AND does not have `useReplayGuard` in its import list.

**Enforcement mechanism:**
- The rule parses JSX and identifies write-control elements by element name and type attribute.
- It checks the file's import declarations for an import of `useReplayGuard` from any path.
- If write controls are present without the import, the rule emits an error.

```javascript
// apps/cms/eslint-rules/no-write-control-without-replay-guard.js
'use strict'

const WRITE_CONTROL_PATHS = [
  /src\/surfaces\/incident-command/,
  /src\/surfaces\/live-ops/,
]

const IC03_EXEMPT_FILES = [
  /ShiftNotesTab\.tsx$/,         // Annotations are allowed in replay mode
  /replay-investigation\//,      // Entire replay surface is exempt
  /LoginPage\.tsx$/,             // Pre-auth, no replay context
  /BootstrapLoadingScreen\.tsx$/, // Pre-auth
  /BootstrapErrorScreen\.tsx$/,   // Pre-auth
]

module.exports = {
  meta: {
    type: 'error',
    docs: {
      description: 'Write controls require useReplayGuard import to enforce IC-03',
    },
  },
  create(context) {
    const filename = context.getFilename()

    const inEnforcedPath = WRITE_CONTROL_PATHS.some(p => p.test(filename))
    const isExempt = IC03_EXEMPT_FILES.some(p => p.test(filename))

    if (!inEnforcedPath || isExempt) return {}

    let hasReplayGuardImport = false
    let writeControlNodes = []

    return {
      ImportDeclaration(node) {
        const specifiers = node.specifiers.map(s => s.local.name)
        if (specifiers.includes('useReplayGuard')) {
          hasReplayGuardImport = true
        }
      },
      JSXOpeningElement(node) {
        const name = node.name.name
        if (name === 'button' || name === 'form') {
          writeControlNodes.push(node)
        }
        if (name === 'input') {
          const typeAttr = node.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'type'
          )
          if (
            typeAttr &&
            typeAttr.value &&
            ['submit', 'button'].includes(typeAttr.value.value)
          ) {
            writeControlNodes.push(node)
          }
        }
      },
      'Program:exit'() {
        if (writeControlNodes.length > 0 && !hasReplayGuardImport) {
          writeControlNodes.forEach(node => {
            context.report({
              node,
              message:
                'IC-03: Write controls require useReplayGuard import. ' +
                'Add: import { useReplayGuard } from "@clubhub/hooks" ' +
                'and return null when isReplayMode === true.',
            })
          })
        }
      },
    }
  },
}
```

### 5.4 Exception List

The following files may render interactive elements without `useReplayGuard`. Each exception is explicitly justified.

| File | Reason |
|------|--------|
| `surfaces/incident-command/tabs/ShiftNotesTab.tsx` | Shift annotations are explicitly permitted in replay mode — they annotate the replay session, not the live system |
| `surfaces/replay-investigation/**/*Tab.tsx` | All replay surface components operate on replay data by definition — no write controls affect live state |
| `chrome/shell/LoginPage.tsx` | Pre-auth — no replay context established |
| `chrome/shell/BootstrapLoadingScreen.tsx` | Pre-auth — no replay context established |
| `chrome/shell/BootstrapErrorScreen.tsx` | Pre-auth — no replay context established |

### 5.5 Server-Side IC-03 Backstop

If a write API call reaches the server while `is_replay_mode === true` on the session (client-side bypass or race condition), the server returns HTTP 409 with:

```json
{
  "error": "REPLAY_MODE_WRITE_REJECTED",
  "message": "Write operations are not permitted during replay sessions"
}
```

The client handles this in `@clubhub/api`:

```typescript
// packages/api/src/client.ts
// In the fetch response handler, on 409 with REPLAY_MODE_WRITE_REJECTED:
if (
  response.status === 409 &&
  errorBody.error === 'REPLAY_MODE_WRITE_REJECTED'
) {
  console.error('[IC03] Write attempted in replay mode', {
    session_id: replayStore.getState().session_id,
    attempted_action: requestMeta.action,
    url: requestMeta.url,
    timestamp: new Date().toISOString(),
  })
  // Fire telemetry event if telemetry provider is available
  telemetry.track('ic03_violation', {
    session_id: replayStore.getState().session_id,
    action: requestMeta.action,
  })
  throw new IC03ViolationError('Write blocked: replay mode active')
}
```

This logging is the `IC03_ENFORCEMENT_GAP` handler. It indicates a client-side rule violation that escaped the component-level guard.

---

## 6. Role-Based Module Execution

### 6.1 Role Gating Occurs at Component Render Time

Surface modules load regardless of the authenticated user's role. Role-gated components within a surface perform an early return based on the role from `useAuthStore`:

```typescript
// Pattern: Role-gated component — ABSENT for non-ADMIN
import { useAuthStore } from '@clubhub/state'

export function EvidenceTab() {
  const role = useAuthStore(s => s.role)

  // ABSENT from DOM for non-ADMIN roles
  if (role !== 'ADMIN') return null

  return <EvidenceTabContent />
}
```

```typescript
// Pattern: Role-gated component — multiple allowed roles
export function CanaryPromotionPanel() {
  const role = useAuthStore(s => s.role)

  if (role !== 'ADMIN' && role !== 'OPERATOR') return null

  return <CanaryPromotionContent />
}
```

### 6.2 Why Not Module-Level Role Gating

Role is known only after `GET /operators/me` resolves. This network request happens inside `AuthGate` after chrome has loaded. Lazy module loading is triggered by router navigation, which may happen before `GET /operators/me` in a direct URL access scenario. Gating module loading on role would require:

1. Delaying all routing until auth resolves (increases perceived load time)
2. Building a role-aware chunk loading system (complex, fragile)
3. Handling the case where role changes mid-session (operator permission upgrade)

Component-level gating eliminates all these problems. The server validates every API call regardless of what the client renders. The byte cost of loading unreachable component code is acceptable and bounded (the largest role-gated component, `EvidenceTab`, is approximately 2KB in the surface chunk).

### 6.3 Tab 6 — Not Separately Chunked

`EvidenceTab.tsx` and `CounterfactualTab.tsx` (ADMIN-only components in the replay-investigation surface) are included in the `replay` chunk. For non-ADMIN users:

- The tab is not rendered in the tab bar (tab bar iterates a role-filtered tab array)
- The component body never executes
- The component's sub-tree is not mounted

The unreachable component code stays in the chunk. This is the correct trade-off — separate chunking for a 2KB component adds complexity with no meaningful benefit.

---

## 7. Dynamic Imports — Allowed and Forbidden

### 7.1 Allowed Dynamic Imports

The following are the only permitted uses of `import()` in the application:

**Surface entry points via React.lazy() in routes/lazy.ts:**
```typescript
// ALLOWED — centralized in routes/lazy.ts only
export const LazyLiveOpsVenueView = lazy(() =>
  import('../surfaces/live-ops').then(m => ({ default: m.LiveOpsVenueView }))
)
```

**Incident Command preload in RealtimeProvider (fire-and-forget):**
```typescript
// ALLOWED — one location, RealtimeProvider.tsx only
import('../surfaces/incident-command').catch(() => { /* log only */ })
```

**Vite dev-only plugins and config (in vite.config.ts only):**
```typescript
// ALLOWED — build tooling, not application code
const devPlugin = await import('./vite-dev-plugin')
```

### 7.2 Forbidden Dynamic Imports

These patterns are detected and blocked by ESLint rule `local/no-forbidden-dynamic-import`:

**Dynamic import inside component render function:**
```typescript
// FORBIDDEN — causes loading waterfall on every render
function MyComponent() {
  const [mod, setMod] = useState(null)
  useEffect(() => {
    import('./SomeModule').then(m => setMod(m)) // ESLint error
  }, [])
}
```

**Dynamic import inside a custom hook:**
```typescript
// FORBIDDEN — same reason as render function
function useSomething() {
  import('./something') // ESLint error
}
```

**Dynamic import inside an event handler:**
```typescript
// FORBIDDEN — use React.lazy + Suspense at route level instead
function handleClick() {
  import('./SomeSurface').then(/* ... */) // ESLint error
}
```

**require() anywhere in the application:**
```typescript
// FORBIDDEN — ESM only. This is enforced by TypeScript and ESLint.
const thing = require('./thing') // ESLint error + TypeScript error
```

**Dynamic import of chrome modules:**
```typescript
// FORBIDDEN — chrome is synchronous
const chrome = await import('../chrome/shell/ShellLayout') // ESLint error
```

---

## 8. Tree Shaking and Dead Code

### 8.1 @clubhub/types — Zero Runtime Bytes

`@clubhub/types` consists exclusively of TypeScript type declarations. TypeScript erases all type imports before emitting JavaScript. Vite/Rollup never sees these imports in the module graph. The package contributes zero bytes to any runtime chunk.

Requirement: `packages/types/src/index.ts` must contain only `export type` declarations, `interface` declarations, and `enum` (if needed — prefer string literal unions). No executable statements.

### 8.2 @clubhub/ui — Named Export Tree Shaking

`@clubhub/ui` exports all components as named exports from `packages/ui/src/index.ts`. Consumers import only what they use:

```typescript
// Consumer pattern — only Alert, Badge, Button are bundled for this consumer
import { Alert, Badge, Button } from '@clubhub/ui'
```

For tree shaking to work, `@clubhub/ui/package.json` must declare:

```json
{
  "sideEffects": false
}
```

Without `"sideEffects": false`, Rollup assumes every module in `@clubhub/ui` has side effects and includes all components even when unreferenced. Verify the package.json before shipping.

If `@clubhub/ui` has actual side effects (e.g., a global CSS import), list those files explicitly:

```json
{
  "sideEffects": ["./src/global.css"]
}
```

### 8.3 Surface Modules — Chunk Isolation

Because each surface is its own chunk, a user who never navigates to `/ops/cms` never downloads the `cms-operations` chunk. The browser does not parse, compile, or execute that code.

### 8.4 Zustand Stores — Always Initialized

All Zustand stores are imported in `@clubhub/state`, which is in the `chrome` chunk. All stores initialize on app bootstrap, not on first use. Stores that are primarily relevant to one surface (e.g., `replayStore`) hold their initial empty state for users who never visit that surface. Memory cost is negligible (empty object in a closure). This is preferable to lazy store initialization, which introduces race conditions in store subscription patterns.

---

## 9. Module Loading Failure Handling

### 9.1 Surface Chunk Load Failure

When a surface chunk fails to load (network error, CDN unavailability, corrupted response), React throws a loading error from `React.lazy()`. The `SurfaceErrorBoundary` catches this error and renders:

```typescript
// apps/cms/src/chrome/shell/SurfaceErrorBoundary.tsx
import { Component, ReactNode } from 'react'

interface State { hasError: boolean; isChunkLoadError: boolean }

export class SurfaceErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, isChunkLoadError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkLoadError =
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    return { hasError: true, isChunkLoadError }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="surface-error" role="alert">
        {this.state.isChunkLoadError ? (
          <>
            <p>Failed to load this section — check your network connection.</p>
            <button onClick={() => window.location.reload()}>Reload page</button>
          </>
        ) : (
          <>
            <p>An unexpected error occurred in this section.</p>
            <button onClick={() => this.setState({ hasError: false, isChunkLoadError: false })}>
              Try again
            </button>
          </>
        )}
      </div>
    )
  }
}
```

The shell (ZoneA, StatusBar, ZoneC) remains functional during a surface chunk failure — the operator can navigate to other surfaces.

### 9.2 Vendor Chunk Load Failure

If the `vendor` chunk (React, React DOM, React Router) fails to load, the application cannot render at all. No React error boundary can catch this because React itself has not loaded. The browser renders whatever raw HTML the server provided (typically an empty `<div id="root"></div>`).

Mitigation: Serve the `vendor` chunk from a CDN with high availability. The vendor chunk is the largest and most cacheable chunk — it changes only when library versions are updated. Use subresource integrity (SRI) to validate cached files:

```html
<!-- apps/cms/index.html — updated by build process -->
<script
  type="module"
  src="/assets/vendor.a3f9c12b.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 9.3 Chrome Chunk Load Failure

If the `chrome` chunk fails to load, the same outcome as vendor failure applies — no React rendering is possible. Mitigation is identical: CDN reliability + SRI.

### 9.4 Retry Strategy

Surface chunk failures are retried by reloading the page (the `SurfaceErrorBoundary` reload button). There is no automatic retry for surface chunks — the operator explicitly initiates retry. Automatic retry risks masking a persistent failure or causing a reload loop.

For vendor and chrome failures, the browser's standard page reload is the only recovery path.

### 9.5 Hosting Requirements for Failure Mitigation

| Chunk | SRI required | CDN required | Cache TTL |
|-------|-------------|--------------|-----------|
| `vendor` | Yes | Yes | 1 year (immutable) |
| `chrome` | Yes | Yes | 1 year (immutable) |
| `ui-lib` | Yes | Yes | 1 year (immutable) |
| Surface chunks | Recommended | Recommended | 1 year (immutable) |

All chunks use content-hash filenames. New deployments produce new hash values, invalidating cached files automatically.

---

## 10. Verification Checklist

The following checks must pass before any merge that modifies `vite.config.ts`, `routes/lazy.ts`, any `surfaces/*/index.tsx`, or any `packages/@clubhub/*` `package.json`.

| Check | Tool | Pass condition |
|-------|------|----------------|
| All 5 surface chunks present in build output | CI script | `live-ops.*.js`, `incident-command.*.js`, `venue-ops.*.js`, `cms-operations.*.js`, `replay.*.js` all exist |
| No surface appears in vendor/chrome chunks | CI script | Module graph contains no cross-contamination |
| `@clubhub/types` has zero runtime bytes | CI script | Not present in any chunk's module list |
| `@clubhub/ui` has `"sideEffects": false` | CI script | `packages/ui/package.json` check |
| No cross-surface imports | ESLint | Zero `import/no-restricted-paths` violations |
| No surface imports from chrome | ESLint | Zero violations |
| No chrome imports from surfaces | ESLint | Zero violations |
| No lazy chrome imports | ESLint | Zero `local/no-lazy-chrome` violations |
| No lazy ui-lib imports | ESLint | Zero `local/no-lazy-ui` violations |
| No forbidden dynamic imports | ESLint | Zero `local/no-forbidden-dynamic-import` violations |
| IC-03 write guard coverage | ESLint | Zero `local/no-write-control-without-replay-guard` violations |
| Vendor chunk gzipped size | CI script | <250KB |
| Chrome chunk gzipped size | CI script | <150KB |
| Each surface chunk gzipped size | CI script | <100KB (replay: <10KB) |

---

## Appendix A — Package Dependency Graph

```
@clubhub/types   (no dependencies)
    ^
    |
@clubhub/api     (depends on: @clubhub/types)
    ^
    |
@clubhub/state   (depends on: @clubhub/types, @clubhub/api)
    ^
    |
@clubhub/hooks   (depends on: @clubhub/types, @clubhub/state)
    ^
    |
@clubhub/ui      (depends on: @clubhub/types only — stateless)

apps/cms         (depends on: all packages, chrome, surfaces)
  |
  +-- chrome/**  (depends on: @clubhub/api, @clubhub/state, @clubhub/hooks, @clubhub/ui)
  +-- surfaces/live-ops          (depends on: @clubhub/* packages)
  +-- surfaces/incident-command  (depends on: @clubhub/* packages)
  +-- surfaces/venue-ops         (depends on: @clubhub/* packages)
  +-- surfaces/cms-operations    (depends on: @clubhub/* packages)
  +-- surfaces/replay-investigation  (depends on: @clubhub/* packages)
```

Cycles are forbidden. If a proposed change creates a cycle in this graph, it must be resolved before implementation.

---

## Appendix B — File Locations

| Specification element | File path |
|-----------------------|-----------|
| Vite config | `apps/cms/vite.config.ts` |
| Lazy surface imports | `apps/cms/src/routes/lazy.ts` |
| Router (Suspense boundaries) | `apps/cms/src/routes/AppRouter.tsx` |
| Realtime provider (IC preload) | `apps/cms/src/chrome/shell/RealtimeProvider.tsx` |
| Surface error boundary | `apps/cms/src/chrome/shell/SurfaceErrorBoundary.tsx` |
| Surface loading state | `apps/cms/src/chrome/shell/SurfaceLoadingState.tsx` |
| useReplayGuard hook | `packages/hooks/src/useReplayGuard.ts` |
| ESLint config | `apps/cms/.eslintrc.cjs` |
| Custom ESLint rules | `apps/cms/eslint-rules/` |
| CI import boundary check | `ci/scripts/validate-import-boundaries.ts` |
| CI bundle size check | `ci/scripts/validate-chunk-sizes.ts` |
