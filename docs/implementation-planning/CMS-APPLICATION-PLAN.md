# CMS Application Implementation Plan

**Surface:** `cms-web` — primary operator web application
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, REGIONAL_MANAGER, VENUE_OPERATOR, AUDITOR
**Status:** Implementation-ready engineering specification

---

## 1. Technology Stack Decisions

### 1.1 Routing: TanStack Router v1 (recommended over React Router v6)

**Rationale:** TanStack Router provides type-safe route params and search params out of the box, which matters for this application because many routes carry `venueId`, `enterpriseId`, `campaignId` as required params — and role + scope must be attached to each route definition as first-class metadata. React Router v6 requires runtime guards and lacks type inference for search params.

TanStack Router also enables file-based route trees, which makes the required-role declarations auditable: each route file declares its own `beforeLoad` guard, so the code review checklist item "does this route enforce its role?" is verifiable by file inspection.

**Decision:** TanStack Router v1 with file-based routing.

### 1.2 Server State: TanStack Query v5

Standard choice. Provides stale-while-revalidate with explicit invalidation — important because we do NOT want implicit refetches clearing emergency or freeze state from the UI (see forbidden pattern #4). Query invalidation must be explicit and intentional.

Set `staleTime: 30_000` as the default. Never set `staleTime: 0` on queries that read emergency or constitutional state — these must be stable until explicitly invalidated.

### 1.3 Global UI State: Zustand

Appropriate scope: constitutional state (WebSocket-driven), emergency overlay, workspace context (current enterprise/venue), alert deduplication. Not for server state.

### 1.4 Real-time: Native Browser WebSocket (not socket.io)

**Rationale:** socket.io adds reconnection logic and fallback polling that can mask connectivity issues. We need to know when the constitutional state WebSocket drops — that is itself an operational signal. Use native WebSocket with explicit reconnect logic in the `constitutionalStore` with backoff. The connection health is surfaced to the operator.

Do not use socket.io.

### 1.5 Styling: Tailwind CSS

Functional only. The CSS conventions for this project are:

- No gradient utilities (`bg-gradient-*`)
- No drop shadow utilities (`shadow-*`) except `shadow-sm` for form field depth
- No hero or card "showcase" patterns
- Colors express state: red = emergency/error, amber = warning/degraded, green = healthy, gray = neutral/inactive
- Typography is legible and dense — this is a control panel, not a marketing surface

Emergency and constitutional state UI must use color conventions consistently — an operator who has learned that amber means "degraded" must not encounter amber in decorative contexts.

### 1.6 Component Library: Radix UI primitives (not shadcn/ui)

**Rationale:** shadcn/ui is a good starting point for consumer products, but it applies opinionated styling by default that conflicts with the functional-only aesthetic requirement. Radix UI primitives (unstyled, fully accessible) give us accessible behavior (focus management, keyboard navigation, ARIA roles) with zero visual opinion. We style everything ourselves with Tailwind.

Key Radix primitives to use:
- `@radix-ui/react-dialog` — for all modal flows (canary approval, emergency confirmation)
- `@radix-ui/react-alert-dialog` — NOT used for emergency triggers (must be full-page, not dialog)
- `@radix-ui/react-dropdown-menu` — for role-switching and context menus
- `@radix-ui/react-select` — for venue/enterprise selectors
- `@radix-ui/react-toast` — for non-critical alerts
- `@radix-ui/react-scroll-area` — for the constitutional freeze log virtualized list

### 1.7 Build: Vite

Standard. No special configuration beyond TypeScript strict mode and path aliases.

### 1.8 Testing: Vitest + React Testing Library

All constitutional UI constraints must have test coverage. See Section 8 for test requirements.

---

## 2. Application Shell Architecture

The application has three shells, each nested inside the previous. Nothing in the inner shells renders until the outer shell has resolved.

```
AuthenticationShell
  └── ConstitutionalStateShell
        └── RoleGatedRouter
              └── WorkspaceContext
                    └── Route content
```

### 2.1 AuthenticationShell

Responsibilities:
- Detect session presence (check `/api/v2/session`)
- If no session: redirect to `/login` — no app content renders
- On session load: resolve role, scope, enterprise/venue memberships
- Store resolved identity in Zustand `workspaceStore`
- On session expiry (401 response from any query): clear store, redirect to `/login` with `?returnTo` param

This shell renders a loading state while resolving. It does NOT render a spinner indefinitely — if session resolution takes >10 seconds, render an error state with "Unable to connect to ClubHub server."

### 2.2 ConstitutionalStateShell

Responsibilities:
- Opens WebSocket to `/ws/constitutional-state` after session resolves
- Updates `constitutionalStore` on every message
- If WebSocket drops: schedule reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Surfaces WebSocket connection health as a status indicator in the app chrome
- If WebSocket has been disconnected >60 seconds: render a banner "Constitutional state feed disconnected — constitutional status may be stale"
- Renders `EmergencyFreezeOverlay` unconditionally when `constitutionalStore.state === 'EMERGENCY_FREEZE'`

The `EmergencyFreezeOverlay` renders above all content (z-index via Tailwind `z-[9999]`). It cannot be dismissed. It shows:
- State name: "SYSTEM EMERGENCY FREEZE"
- Reason text from `constitutionalStore.reason`
- "Platform administrators have been notified. Do not attempt to operate the system."
- Last updated timestamp
- No action buttons except a non-functional "Contact support" link

### 2.3 RoleGatedRouter

Every route definition includes:

```typescript
type RouteConfig = {
  path: string;
  requiredRole: Role | Role[];
  requiredScope: 'PLATFORM' | 'ENTERPRISE' | 'VENUE' | 'OWN_VENUE';
  component: React.ComponentType;
};
```

The router enforces role before mounting any component. On access denial: renders `<AccessDenied>` component explaining why access was denied and what role would grant access.

Role hierarchy for guard evaluation:
- `PLATFORM_ADMIN` passes all role checks
- `ENTERPRISE_ADMIN` passes ENTERPRISE + VENUE + REGIONAL checks
- `REGIONAL_MANAGER` passes REGIONAL + VENUE checks for venues in their region
- `VENUE_OPERATOR` passes VENUE checks for their venue only
- `SPONSOR_STAKEHOLDER` uses a completely separate router (see Section 3.5)
- `AUDITOR` passes only audit route checks

### 2.4 WorkspaceContext

Zustand store containing:

```typescript
type WorkspaceStore = {
  enterpriseId: string | null;
  venueId: string | null;
  role: Role;
  scope: Scope;
  // Actions
  setEnterprise: (id: string) => void;
  setVenue: (id: string) => void;
};
```

The context switcher (enterprise/venue selector) in the app chrome updates this store. All TanStack Query hooks read from this store to scope their queries.

---

## 3. Route Structure

### 3.1 Fleet Routes (ENTERPRISE_ADMIN+)

| Path | Required Role | Scope | Key Components |
|---|---|---|---|
| `/fleet` | ENTERPRISE_ADMIN | ENTERPRISE | `FleetHealthDashboard`, `VenueStatusGrid`, `CircuitBreakerSummary` |
| `/fleet/venues` | ENTERPRISE_ADMIN | ENTERPRISE | `VenueTable`, `VenueHealthBadge`, `EntropyStatusCell` |
| `/fleet/canary` | ENTERPRISE_ADMIN | ENTERPRISE | `CanaryStagePanel`, `CanaryGateStatus`, `CanaryAdvanceButton` |
| `/fleet/entropy` | ENTERPRISE_ADMIN | ENTERPRISE | `FleetEntropyOverview`, `EntropySeverityFilter` |

**`/fleet/canary` design requirements:**
- Current canary stage shown prominently (SHADOW_ONLY / INTERNAL_CANARY / SINGLE_VENUE / MULTI_VENUE / FLEET_WIDE / AUTHORITATIVE)
- Stage advancement is two-screen: first shows gate evaluation data; second requires typed `human_approval_token` (min 8 chars)
- Stage must advance sequentially — the "advance" button only shows valid next stage, never allows skipping
- `requires_human_approval: true` is a system constant — the UI must never show an "auto-advance" option

### 3.2 Venue Routes (REGIONAL_MANAGER+ or VENUE_OPERATOR for their venue)

| Path | Required Role | Scope | Key Components |
|---|---|---|---|
| `/venues/:venueId` | REGIONAL_MANAGER or VENUE_OPERATOR (own) | VENUE | `VenueDashboard`, `ScreenStatusGrid`, `ActiveEmergencyCard`, `EntropyAlertBanner` |
| `/venues/:venueId/screens` | REGIONAL_MANAGER or VENUE_OPERATOR (own) | VENUE | `ScreenList`, `ScreenDetailPanel`, `ScreenSyncStatus` |
| `/venues/:venueId/schedule` | REGIONAL_MANAGER or VENUE_OPERATOR (own) | VENUE | `ScheduleView`, `OverrideList`, `AddOverrideButton` |
| `/venues/:venueId/emergency` | REGIONAL_MANAGER or VENUE_OPERATOR (own) | VENUE | `EmergencyConsole`, `ActiveEmergencyCard`, `EmergencyTriggerFlow`, `EmergencyHistory` |
| `/venues/:venueId/entropy` | REGIONAL_MANAGER or VENUE_OPERATOR (own) | VENUE | `EntropyReportList`, `EntropyResolutionPanel`, `VerifyResolutionButton` |

**`/venues/:venueId/emergency` design requirements:**
- Active emergencies shown as full-width card at the top of the page
- Emergency trigger uses a two-step flow (see Section 5.2) — never a single button
- Clearance of an emergency requires an acknowledgment note — not just a confirm click

### 3.3 Campaign Routes (VENUE_OPERATOR+)

| Path | Required Role | Scope | Key Components |
|---|---|---|---|
| `/campaigns` | VENUE_OPERATOR | VENUE or ENTERPRISE | `CampaignList`, `CampaignStatusBadge`, `LifecycleStateFilter` |
| `/campaigns/new` | VENUE_OPERATOR | VENUE | `CampaignCreationForm` |
| `/campaigns/:campaignId` | VENUE_OPERATOR | VENUE | `CampaignDetail`, `LifecycleControls`, `PreviewGate` |
| `/campaigns/:campaignId/preview` | VENUE_OPERATOR | VENUE | `PreviewSession`, `PlaylistPreview`, `ApproveFromPreviewButton` |

**Campaign approval gate:** The transition from REVIEW to APPROVED state is blocked in the UI if no `PreviewSession` exists for this campaign. The `LifecycleControls` component calls `usePreviewGate(campaignId)` before enabling the approve button. If no preview exists: show "Preview required before approval" with a link to the preview route. This is not a soft warning — it is a hard UI gate.

### 3.4 Audit Routes

| Path | Required Role | Scope | Key Components |
|---|---|---|---|
| `/audit/replay` | AUDITOR | ENTERPRISE or VENUE | `ReplayQueryForm`, `ReplayResultTable`, `AuditRecordDetail` |
| `/audit/parity` | ENTERPRISE_ADMIN | ENTERPRISE | `ParityReportList`, `DivergenceClassBadge`, `ParityRecordDetail` |
| `/audit/entropy` | REGIONAL_MANAGER | ENTERPRISE | `EntropyAuditList`, `EntropyReportDetail` |

### 3.5 Platform Admin Routes (PLATFORM_ADMIN only)

| Path | Required Role | Scope | Key Components |
|---|---|---|---|
| `/constitutional` | PLATFORM_ADMIN | PLATFORM | `ConstitutionalStatePanel`, `CircuitBreakerDashboard`, `EnterpriseStateGrid` |
| `/constitutional/freeze-log` | PLATFORM_ADMIN | PLATFORM | `ConstitutionalFreezeLogViewer` (virtualized) |
| `/constitutional/reset` | PLATFORM_ADMIN | PLATFORM | `EmergencyFreezeExitWizard` (7-step) |
| `/constitutional/circuit-breakers` | PLATFORM_ADMIN | PLATFORM | `CircuitBreakerStateGrid`, `BreakerDetailPanel` |
| `/constitutional/integrity` | PLATFORM_ADMIN | PLATFORM | `IntegrityCheckRunner`, `IntegrityResultStream` |

See `OPERATOR-CONSOLE-PLAN.md` for detailed implementation of these routes.

### 3.6 SPONSOR_STAKEHOLDER Router (separate)

`SPONSOR_STAKEHOLDER` must use a completely separate router instance, not the main application router with visibility toggles. This is a security requirement, not a UX preference — the sponsor router must never mount components that reference audit, parity, entropy, or constitutional state.

```typescript
// Separate entry point loaded only for SPONSOR_STAKEHOLDER role
// src/sponsor-portal/SponsorRouter.tsx
```

Sponsor routes:
- `/sponsor/campaigns` — read-only view of campaigns they are associated with
- `/sponsor/proof-of-play` — proof-of-play reports derived from audit records (read-only)
- `/sponsor/` — sponsor dashboard

The sponsor router must not import from `src/constitutional/`, `src/entropy/`, `src/audit/`, or `src/canary/`. This must be enforced via ESLint import rules.

---

## 4. State Management

### 4.1 TanStack Query — server state

```typescript
// Venue data
useVenues(enterpriseId: string)
// Returns venue list with health indicators (constitutional state, entropy severity, screen online count)

useCampaigns(venueId: string, status?: CampaignStatus)
// Paginated campaign list. staleTime: 30_000. Never staleTime: 0.

useAuditRecords(filters: AuditFilters)
// Replay audit query. Paginated. Not polled — explicit refetch only.

useEntropyReports(venueId: string)
// Entropy report list, sorted by severity. staleTime: 30_000.

useCanaryStatus(enterpriseId: string)
// Current canary stage + gate evaluation. staleTime: 15_000.

useConstitutionalStateHttp(enterpriseId: string)
// HTTP fallback for constitutional state. staleTime: 10_000.
// Used when WebSocket is disconnected, not as primary signal.

usePreviewGate(campaignId: string)
// Whether a PreviewSession exists for this campaign.
// Returns: { hasPreview: boolean; previewChecksum: string | null; previewedAt: Date | null }
```

**Critical query rules:**
- Never use `refetchInterval` on emergency, constitutional, or freeze log queries — these must be WebSocket-driven or explicitly fetched
- Never `invalidateQueries` for `useConstitutionalStateHttp` after a mutation — the WebSocket is the authority
- `useAuditRecords` results must never be cached beyond the session (no `gcTime` persistence)

### 4.2 Zustand — UI state and real-time signals

```typescript
// Constitutional state — WebSocket driven
type ConstitutionalStore = {
  state: ConstitutionalState | null;
  reason: string | null;
  lastUpdated: Date | null;
  wsConnected: boolean;
  wsReconnectAttempt: number;
};

// Emergency state — WebSocket driven, per venue
type EmergencyStore = {
  activeEmergencies: Map<string, Emergency>;
  // venueId -> Emergency
  addEmergency: (venueId: string, emergency: Emergency) => void;
  clearEmergency: (venueId: string) => void;
};

// Workspace context
type WorkspaceStore = {
  enterpriseId: string | null;
  venueId: string | null;
  role: Role;
  scope: Scope;
  setEnterprise: (id: string) => void;
  setVenue: (id: string) => void;
};

// Alert state — deduplication here
type AlertStore = {
  alerts: Alert[];
  // Alert has: id (from server), severity, message, venueId, source, seenAt
  addAlert: (alert: Alert) => void;
  // Deduplicates by alert.id — same alert from multiple WebSocket events is ignored
  dismissAlert: (id: string) => void;
};
```

---

## 5. Constitutional UI Constraints — Implementation

### 5.1 READ_ONLY Mode: `useMutationGuard` Hook

```typescript
// src/hooks/useMutationGuard.ts

function useMutationGuard(): MutationGuard {
  const { state } = useConstitutionalStore();

  return {
    isBlocked: state === 'READ_ONLY' || state === 'EMERGENCY_FREEZE',
    reason: state === 'READ_ONLY'
      ? 'System is in READ_ONLY state. Mutations are blocked.'
      : state === 'EMERGENCY_FREEZE'
      ? 'System is in EMERGENCY_FREEZE. All operations suspended.'
      : null,
    // Emergency routes bypass this guard — checked by caller
    isEmergencyBypass: false,
  };
}
```

All `useMutation` calls must wrap with this guard:

```typescript
const guard = useMutationGuard();
const mutation = useMutation({
  mutationFn: async (payload) => {
    if (guard.isBlocked && !isEmergencyRoute) {
      throw new MutationBlockedError(guard.reason);
    }
    return api.post('/campaigns', payload);
  },
});
```

Emergency routes (`/api/v2/emergency/*`) set `isEmergencyRoute: true` and bypass the READ_ONLY check. EMERGENCY_FREEZE state blocks emergency routes too — emergency operations require PLATFORM_ADMIN action via the constitutional console.

### 5.2 Emergency Trigger — Two-Step Flow

The emergency trigger is never a single button. The flow:

**Step 1 — Emergency type selection:**
- Select emergency type: VENUE_EMERGENCY / COMPLIANCE / EQUIPMENT_FAILURE / OTHER
- For COMPLIANCE type: note field is required (min 20 chars)
- For OTHER type: note field is required (min 10 chars)
- "Continue" button advances to step 2

**Step 2 — Confirmation:**
- Full-page render (not a dialog) — route: `/venues/:venueId/emergency/confirm`
- Shows: "This will activate emergency content on [n] screens at [Venue Name]"
- Shows: selected emergency type and note
- Large red "Trigger Emergency" button — full width
- "Cancel" link (not button) in small text below
- On confirm: POST `/api/v2/emergency/trigger`
- On success: navigate to `/venues/:venueId/emergency` showing active emergency

This flow must NOT use `@radix-ui/react-alert-dialog`. It must be a full-page route. Using a dialog for emergency trigger is a forbidden pattern (see Section 7).

### 5.3 Canary Approval — Two-Screen Flow

**Screen 1 — Gate evaluation review:**
- Shows current canary gate data: parity rate, invocation count, CLASS_3 count, CLASS_4 count
- Shows gate thresholds and whether each is met
- Shows target stage name and description
- "Proceed to Authorization" button — only enabled if all gate thresholds met

**Screen 2 — Human approval token:**
- Heading: "Authorize Stage Advancement"
- Shows: "Advancing from [current] to [target]"
- Token input labeled "Human Approval Token"
- Input: `type="text"`, `autoComplete="off"`, `spellCheck={false}`
- No paste suppression — operators may use password managers
- Confirm button: disabled until `token.length >= 8`
- On confirm: POST `/api/v2/canary/advance` with `{ target_stage, human_approval_token }`
- On success: shows new canary stage — navigates back to `/fleet/canary`

### 5.4 EMERGENCY_FREEZE Overlay

```typescript
// src/components/constitutional/EmergencyFreezeOverlay.tsx
// Rendered unconditionally in app root — above all route content

function EmergencyFreezeOverlay() {
  const { state, reason, lastUpdated } = useConstitutionalStore();

  if (state !== 'EMERGENCY_FREEZE') return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-red-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-sm font-mono tracking-widest text-red-400 uppercase">
          Constitutional State
        </div>
        <h1 className="text-4xl font-bold">EMERGENCY FREEZE</h1>
        <p className="text-lg text-red-200">{reason}</p>
        <div className="border border-red-800 rounded p-4 text-sm text-red-300">
          Platform administrators have been notified. Do not attempt to
          operate the system until PLATFORM_ADMIN clears this state.
        </div>
        <div className="text-xs text-red-600">
          Last updated: {lastUpdated?.toISOString()}
        </div>
      </div>
    </div>
  );
}
```

No dismiss button. No "try to recover" button. No auto-hide.

### 5.5 PREVIEW: Checksum Display

Preview responses include a `preview_checksum` field with a `PREVIEW:` prefix (e.g., `PREVIEW:a1b2c3d4`). The UI must always render this prefix. Never strip it.

```typescript
// Correct:
<span className="font-mono text-sm">{previewResult.preview_checksum}</span>
// → renders "PREVIEW:a1b2c3d4"

// Forbidden:
<span>{previewResult.preview_checksum.replace('PREVIEW:', '')}</span>
```

The `PlaylistPreview` component must include a framing note:
"This is a PRE resolution preview, not a live playback view. The checksum above is not a canonical playlist checksum."

### 5.6 Override Semantics Framing

When displaying override resolution in any playlist or schedule view, the level label must communicate termination, not priority:

```
// Correct framing:
"Level 1 Operational Override — playback resolved here, lower levels not evaluated"

// Incorrect framing (never use):
"Level 1 Override (highest priority)"
"Override wins over campaign"
```

This applies to: schedule views, preview resolution context, and audit replay views.

---

## 6. Override and Mutation Patterns

### 6.1 Schedule Override Creation

Creating an override does not immediately take effect — it enters the corpus at the next corpus version. The UI must not suggest immediate effect.

After override creation: "Override scheduled. It will take effect at the next corpus version application. Corpus delivery requires up to 72h."

### 6.2 No Optimistic Updates on Corpus Mutations

Mutations that modify the corpus (campaign publish, override creation, schedule change) must not use optimistic updates. Show a loading state. Wait for server confirmation. Then invalidate relevant queries.

Rationale: corpus mutations have constitutional downstream effects (replay audit, determinism). A failed optimistic update that clears itself after 200ms creates a false impression of a committed action.

### 6.3 Bulk Campaign Publish

If a future workflow requires publishing multiple campaigns, each campaign must be individually previewed before bulk publish is permitted. A "publish all" button that bypasses per-campaign preview is a forbidden pattern.

---

## 7. Forbidden Patterns — Code Review Checklist

The following patterns are explicitly prohibited. Code review must reject PRs containing any of these.

**FP-1: `setTimeout` after publish for navigation**
```typescript
// FORBIDDEN
await publishCampaign(id);
setTimeout(() => navigate('/campaigns'), 500);
```
Reason: masks async errors and creates false success impression.

**FP-2: Optimistic mutation on corpus operations**
```typescript
// FORBIDDEN
useMutation({
  mutationFn: publishCampaign,
  onMutate: async () => {
    queryClient.setQueryData(['campaigns'], optimisticData); // FORBIDDEN
  },
});
```

**FP-3: "Skip preview" shortcut in campaign approval**
```typescript
// FORBIDDEN — any button/link that bypasses preview requirement
<Button onClick={() => approveCampaign(id)}>Approve without preview</Button>
```

**FP-4: Auto-refresh clearing emergency UI state**
```typescript
// FORBIDDEN
setInterval(() => {
  queryClient.invalidateQueries(['emergencies']); // clears state silently
}, 10_000);
```

**FP-5: Dialog for emergency trigger**
```typescript
// FORBIDDEN — emergency trigger must be a full-page route, never a dialog
<AlertDialog>
  <AlertDialogTrigger>Trigger Emergency</AlertDialogTrigger>
  <AlertDialogContent>...confirm...</AlertDialogContent>
</AlertDialog>
```

**FP-6: Sponsor routes inside main router with visibility toggle**
```typescript
// FORBIDDEN
routes.map(route => (
  <Route
    key={route.path}
    path={route.path}
    element={
      hasAccess(role, route.requiredRole)
        ? <route.component />
        : <AccessDenied />  // FORBIDDEN for sponsor routes — must be separate router
    }
  />
));
```

**FP-7: Stripping PREVIEW: prefix from checksum**
```typescript
// FORBIDDEN
const displayChecksum = checksum.replace('PREVIEW:', ''); // FORBIDDEN
```

**FP-8: Auto-acknowledge button for entropy alerts**
```typescript
// FORBIDDEN — entropy acknowledgment requires human review note
<Button onClick={() => acknowledgeEntropy(reportId)}>Auto-acknowledge</Button>
```

---

## 8. Test Requirements

### 8.1 Constitutional UI constraint tests (required before merge)

Each constraint in Section 5 must have a corresponding test.

```
src/__tests__/constitutional/
  mutation-guard.test.tsx         — useMutationGuard blocks in READ_ONLY, EMERGENCY_FREEZE
  emergency-freeze-overlay.test.tsx — overlay renders, has no dismiss button
  canary-approval-flow.test.tsx   — token gate (< 8 chars = disabled), sequential stage only
  emergency-trigger-flow.test.tsx — two-step, full-page, no dialog
  preview-checksum.test.tsx       — PREVIEW: prefix always displayed
  override-framing.test.tsx       — level-termination language in schedule views
```

### 8.2 Role isolation tests

```
src/__tests__/routing/
  sponsor-router-isolation.test.tsx — SPONSOR_STAKEHOLDER cannot reach main router routes
  role-guard.test.tsx               — each role gets correct access, denials render AccessDenied
```

### 8.3 Forbidden pattern lint rules

Add ESLint rules for:
- No `setTimeout` in mutation `onSuccess` handlers
- No `optimisticUpdate` / `onMutate` in campaign/corpus mutations
- Sponsor portal files cannot import from constitutional, entropy, audit, canary directories

---

## 9. WebSocket Protocol

Constitutional state WebSocket message format:

```typescript
type ConstitutionalStateMessage = {
  type: 'CONSTITUTIONAL_STATE';
  state: ConstitutionalState;
  reason: string;
  enterprise_id: string;
  timestamp: string; // ISO 8601
};

type EmergencyMessage = {
  type: 'EMERGENCY_ACTIVE' | 'EMERGENCY_CLEARED';
  venue_id: string;
  emergency_id: string;
  emergency_type: EmergencyType;
  affected_screens: number;
  timestamp: string;
};

type CircuitBreakerMessage = {
  type: 'CIRCUIT_BREAKER_STATE';
  breaker_id: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failure_count: number;
  timestamp: string;
};
```

The `constitutionalStore` WebSocket handler must handle all three message types. Unknown message types must be logged and silently dropped — not crashed.

---

## 10. Open Items

The following require resolution before implementation begins:

1. Session token format and expiry — needed for AuthenticationShell implementation
2. WebSocket endpoint authentication — does the WS connection require the session cookie, or a separate token?
3. Role scope model for REGIONAL_MANAGER — confirm which venue IDs are in scope at login vs. runtime check per request
4. On-call contact staleness detection — surfacing a warning after 30 days is noted as an open item in the CMS architecture; exclude from v1 scope but reserve a `ContactCard` component slot in the constitutional console
5. Training certification as system-enforced gate — currently policy only; if promoted to system enforcement, this gates role capability assignment which affects the router guard model
