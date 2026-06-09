# Preview UX Implementation Plan

**Surface:** Preview subsystem UI within `cms-web`
**Audiences:** VENUE_OPERATOR+ (P1), ENTERPRISE_ADMIN+ (P2, P4), REGIONAL_MANAGER+ (P3)
**Backend dependency:** `src/preview/preview-endpoint.ts` — `previewCurrent()`, `previewDiff()`, `previewEntropy()`
**Status:** Implementation-ready engineering specification

---

## 1. Constitutional Framing

The preview subsystem has specific constitutional constraints that differ from the rest of the CMS:

**Preview is not "what the screen shows right now."** It is "what PRE would resolve at this time given current corpus." These are different. The screen may be showing a cached playlist. PRE resolution is deterministic computation on corpus state. The UI must never conflate these two things.

**The PREVIEW: prefix on `playlist_checksum` is constitutional.** A preview checksum (e.g., `PREVIEW:a1b2c3d4`) is structurally non-interchangeable with a canonical playlist checksum (e.g., `a1b2c3d4`). The UI must always display the full string including the prefix. Stripping it misrepresents the nature of the result.

**Preview during system states:**
- HEALTHY: full preview available, all four types (P1–P4)
- DEGRADED: preview available, but show banner "System is degraded — preview results may not reflect current operational state"
- READ_ONLY: preview available (preview is read-only by definition — it does not mutate)
- EMERGENCY_FREEZE: preview disabled. Show: "Preview is unavailable during EMERGENCY_FREEZE. System must return to READ_ONLY or HEALTHY state before preview can run."
- SHADOW_ONLY: P4 (comparison preview) available; P1–P3 show shadow canary context banner
- CONSTITUTIONAL_RISK: preview available with prominent warning

---

## 2. Preview Types

### 2.1 P1 — Point-in-Time Preview

**Who:** VENUE_OPERATOR+
**Route:** `/venues/:venueId/screens/:screenId/preview` and `/campaigns/:campaignId/preview`
**Backend:** `previewCurrent(request)` — maps to both current-time and future-time (same code path)
**Question answered:** "What will play on this screen at time X?"

**Input form:**
- Datetime picker: defaults to now; can be set to any future time within 90 days
- Screen selector: defaults to current screen context (pre-filled from route param)
- "Run Preview" button

**Result display:**
```
Preview Result — [Screen Name] at [Datetime]
─────────────────────────────────────────────────────────
Resolution Level: LEVEL_2 (Scheduled)
Preview Checksum: PREVIEW:a1b2c3d4
Generated: 2026-05-26T09:14:02Z

[ Note: This is a PRE resolution preview, not a live playback view.
  The checksum above is not a canonical playlist checksum. ]

Playlist (3 items):
┌─────────────────────────────────────────────────────────────┐
│  #   Content ID         Duration    Resolved By              │
│  1   asset-golf-open    30s         L2: scheduled_id=abc     │
│  2   asset-clubhouse    15s         L2: scheduled_id=abc     │
│  3   asset-sponsor-1    8s          L4: sponsor_id=xyz       │
└─────────────────────────────────────────────────────────────┘

Resolution Context:
  "Resolved at LEVEL_2 (Scheduled). 4 levels evaluated, 3 skipped."
  Active constraints: days_of_week=[1,2,3,4,5], schedule_id=abc123

[ Approve Campaign ] ← only shown when preview is in campaign context
```

**Note placement:** The framing note ("This is a PRE resolution preview, not a live playback view") must appear directly below the checksum, before the playlist table. It must not be collapsible or hidden behind a "learn more" link.

### 2.2 P2 — Schedule Walk

**Who:** ENTERPRISE_ADMIN+
**Route:** `/venues/:venueId/schedule/preview`
**Backend:** Multiple `previewCurrent()` calls paginated
**Question answered:** "What plays across a time range?"

**Input form:**
- Date range picker: start date + end date (max 14-day range in v1)
- Time increment: 15min / 30min / 1h (radio buttons)
- Screen selector: required
- "Generate Walk" button

**Performance note:** A 14-day walk at 15-minute intervals is 1,344 API calls. These must be made in batches (concurrent, max 10 at a time) and rendered as they arrive — not wait for all to complete.

**Result display:**

Virtualized timeline. Each entry is one time slot:

```
┌──────────────────────────────────────────────────────────────┐
│ Mon 25 May 09:00  L2: Scheduled — Morning loop (3 items)    │
│ Mon 25 May 09:15  L2: Scheduled — Morning loop (3 items)    │
│ Mon 25 May 09:30  L2: Scheduled — Morning loop (3 items)    │
│ Mon 25 May 09:45  L3: Campaign — "Club Championship" (5 it.)│
│ Mon 25 May 10:00  L3: Campaign — "Club Championship" (5 it.)│
│ Mon 25 May 10:15  L5: Fallback — no content sources active  │ ← highlighted amber
└──────────────────────────────────────────────────────────────┘
```

Resolution level is color-coded using the same state color convention (not decorative — semantic):
- L0 Emergency: red
- L1 Operational: amber
- L2 Scheduled: green
- L3 Campaign: blue
- L4 Sponsorship: purple (additive, shown as secondary indicator alongside primary level)
- L5 Fallback: amber (warning — should not occur in normal operation)
- L6 Device truth annotation: shown as a secondary indicator only

LEVEL_5 fallback slots are highlighted and counted in a summary: "3 fallback slots found. Review schedule coverage."

Tap/click any slot to expand: shows full playlist table for that slot, same as P1 result.

**Batch loading indicator:** Show a progress bar while walking is in progress. "Loading 248 / 1,344 time slots..."

### 2.3 P3 — What-If Preview

**Who:** REGIONAL_MANAGER+
**Route:** `/venues/:venueId/preview/what-if`
**Backend:** POST `/api/v2/preview/what-if` with delta payload
**Question answered:** "What would change if I applied this hypothetical?"

**Important constraint:** What-if preview does NOT persist any changes. The UI must make this unambiguous.

**UI framing at the top of the page:**
```
┌─────────────────────────────────────────────────────────────┐
│  WHAT-IF PREVIEW                                            │
│  Changes you define here are NOT applied to the system.    │
│  This is a read-only simulation.                           │
└─────────────────────────────────────────────────────────────┘
```

**Hypothetical definition form:**

The form allows the operator to define a delta — a change they want to simulate:

Option A — Add a campaign override:
- Campaign selector
- Override scope (which screens)
- Effective time

Option B — Activate a campaign:
- Campaign selector (currently in DRAFT or PENDING state)
- Hypothetical effective date

Option C — Change SOV for a sponsor:
- Sponsor selector
- New SOV value (must be ≤ SOV_MAX_EFFECTIVE)
- Note: this shows impact on other sponsor slots in the content mix

**Result display:**

Two columns: "Current" vs "With Hypothetical"

```
┌──────────────────────┬──────────────────────────────────────┐
│  CURRENT RESOLUTION  │  WITH HYPOTHETICAL                   │
│  Level: L2 Scheduled │  Level: L3 Campaign (changed)        │
│  Checksum: PREVIEW:  │  Checksum: PREVIEW:                  │
│  a1b2c3d4            │  f9e8d7c6                            │
│                      │                                      │
│  3 items             │  5 items (2 added by campaign)       │
│  Sponsor SOV: 12%    │  Sponsor SOV: 12% (unchanged)        │
└──────────────────────┴──────────────────────────────────────┘
```

Shows changed fields highlighted. Resolution level change is the most important signal.

Both checksums display with `PREVIEW:` prefix. Neither column shows "canonical" — both are preview.

**No "Apply" button.** The what-if preview page has no action to persist the hypothetical. If the operator decides to apply the change, they navigate to the actual override/campaign creation flow. This separation is intentional.

### 2.4 P4 — Comparison Preview (Shadow Mode)

**Who:** ENTERPRISE_ADMIN+
**Route:** `/venues/:venueId/preview/comparison`
**Backend:** POST `/api/v2/preview/comparison`
**Availability:** Only when `canary_stage !== 'AUTHORITATIVE'`
**Question answered:** "How does PRE output differ from legacy output for this screen right now?"

**Availability gate:** If `canary_stage === 'AUTHORITATIVE'`, this route shows: "Comparison preview is only available while canary is not yet AUTHORITATIVE. PRE is now the sole resolver."

**Input form:**
- Screen selector
- Timestamp (defaults to now)
- "Run Comparison" button

**Result display — side by side:**

```
┌─────────────────────────────────────┬─────────────────────────────────────┐
│  LEGACY RESOLVER                    │  PRE OUTPUT                          │
│  playlist_checksum: PREVIEW:abc123  │  playlist_checksum: PREVIEW:abc123   │
│                                     │                                       │
│  3 items                            │  3 items                             │
│  ┌──────────────────────────┐       │  ┌──────────────────────────┐        │
│  │ 1. golf-open  30s        │       │  │ 1. golf-open  30s        │        │
│  │ 2. clubhouse  15s        │       │  │ 2. clubhouse  15s        │        │
│  │ 3. sponsor-1  8s         │       │  │ 3. sponsor-1  8s         │        │
│  └──────────────────────────┘       │  └──────────────────────────┘        │
│                                     │                                       │
│  PARITY: IDENTICAL                  │  CLASS_0 (no divergence)             │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

If divergence detected:

```
│  PARITY: DIVERGENT                  │
│  Divergence class: CLASS_3          │
│  Fields differing: playlist_checksum, items[1].content_id                  │
│  Legacy item 1: asset-golf-open     │  PRE item 1: asset-golf-classic      │
│                                     │                                       │
│  [View parity record]               │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

CLASS_3 divergence shown with amber highlight. CLASS_4 shown with red highlight.

The "View parity record" link goes to `/audit/parity` with the specific ParityRecord pre-selected.

---

## 3. Core Preview Component

```typescript
// src/components/preview/PlaylistPreview.tsx

type PlaylistPreviewProps = {
  items: PlaylistItem[];
  checksum: string;           // always includes PREVIEW: prefix
  isPreview: true;            // always true for preview renders — no default
  resolutionContext: ResolutionContext;
  campaignId?: string;        // if present, shows "Approve Campaign" button
};

function PlaylistPreview({ items, checksum, resolutionContext, campaignId }: PlaylistPreviewProps) {
  return (
    <div className="preview-result">
      <div className="preview-header">
        <div className="preview-checksum">
          <span className="label">Preview Checksum:</span>
          <code className="font-mono">{checksum}</code>
          {/* checksum must include PREVIEW: prefix — never stripped */}
        </div>
        <div className="preview-framing-note">
          This is a PRE resolution preview, not a live playback view.
          The checksum above is not a canonical playlist checksum.
        </div>
      </div>

      <div className="resolution-context">
        <span>{resolutionContext.summary}</span>
        {resolutionContext.active_constraints.map(c => (
          <span key={c.key} className="constraint-badge">{c.key}: {c.value}</span>
        ))}
      </div>

      <table className="playlist-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Content ID</th>
            <th>Duration</th>
            <th>Resolved By</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.content_id}>
              <td>{i + 1}</td>
              <td><code>{item.content_id}</code></td>
              <td>{formatDuration(item.duration_ms)}</td>
              <td>
                <ResolutionLevelBadge level={item.resolution_level} />
                <span className="resolution-reason">{item.trace_reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {campaignId && <CampaignApprovalGate campaignId={campaignId} previewChecksum={checksum} />}
    </div>
  );
}
```

The `isPreview: true` prop is not optional and has no default. A component that renders a playlist without `isPreview={true}` is not this component — it must be a different component with a different name, making the distinction explicit in code.

---

## 4. Campaign Approval Gate

The campaign approval gate is the UI enforcement of the constitutional requirement: campaign REVIEW → APPROVED transition requires a preview session.

### 4.1 Gate Enforcement

```typescript
// src/hooks/usePreviewGate.ts

function usePreviewGate(campaignId: string): PreviewGateResult {
  return useQuery({
    queryKey: ['preview-gate', campaignId],
    queryFn: () => api.get(`/campaigns/${campaignId}/preview-sessions`),
    select: (data) => ({
      hasPreview: data.sessions.length > 0,
      latestSession: data.sessions[0] ?? null,
      previewChecksum: data.sessions[0]?.preview_checksum ?? null,
      previewedAt: data.sessions[0]?.created_at ?? null,
    }),
  });
}
```

### 4.2 Gate Component

```typescript
// src/components/preview/CampaignApprovalGate.tsx

function CampaignApprovalGate({ campaignId, previewChecksum }: Props) {
  const { hasPreview, latestSession } = usePreviewGate(campaignId);
  const approveMutation = useApproveCampaign(campaignId);
  const guard = useMutationGuard();

  if (!hasPreview) {
    return (
      <div className="approval-gate-blocked">
        <p>A preview is required before this campaign can be approved.</p>
        <Link to={`/campaigns/${campaignId}/preview`}>Run preview</Link>
      </div>
    );
  }

  return (
    <div className="approval-gate-ready">
      <p>
        Approving based on preview checksum:{' '}
        <code className="font-mono">{previewChecksum}</code>
      </p>
      <p className="text-sm text-gray-400">
        Previewed: {formatRelativeTime(latestSession.created_at)}
      </p>
      <Button
        onClick={() => approveMutation.mutate({ preview_checksum: previewChecksum })}
        disabled={guard.isBlocked || approveMutation.isPending}
        variant="primary"
      >
        Approve Campaign
      </Button>
      {guard.isBlocked && (
        <p className="text-amber-400">{guard.reason}</p>
      )}
    </div>
  );
}
```

**The "Approve Campaign" button is only available on the preview route.** The campaign detail page (`/campaigns/:campaignId`) shows the lifecycle controls including the preview gate state — if no preview exists, the approve button is replaced by "Preview required". Clicking that link navigates to the preview route. There is no "approve anyway" option.

### 4.3 Preview Session Age

A preview session older than 24 hours shows a warning but still allows approval:

```typescript
// In CampaignApprovalGate
if (latestSession && isOlderThan(latestSession.created_at, 24 * 60 * 60 * 1000)) {
  showWarning = true;
  warningText = `Preview is ${formatAge(latestSession.created_at)} old. Consider re-running preview to confirm current corpus state.`;
}
```

The warning is informational — it does not block approval. Only no-preview blocks approval.

---

## 5. Preview API Integration

### 5.1 API Calls

```typescript
// P1 — Point-in-time preview
POST /api/v2/preview/point-in-time
Body: { screen_id: string; at: number; }
Response: PreviewResponse (from src/preview/types.ts)

// P2 — Schedule walk (multiple calls, batched)
POST /api/v2/preview/point-in-time
// Called in batches for each time slot in the range

// P3 — What-if preview
POST /api/v2/preview/what-if
Body: { screen_id: string; at: number; delta: WhatIfDelta; }
Response: { current: PreviewResponse; hypothetical: PreviewResponse; diff: PreviewDiff; }

// P4 — Comparison preview
POST /api/v2/preview/comparison
Body: { screen_id: string; at: number; }
Response: { legacy_output: LegacyOutput; pre_output: PreviewResponse; parity_class: DivergenceClass; diff_fields: string[]; }
```

### 5.2 TanStack Query Integration

Preview API calls are not cached — every preview request goes to the server:

```typescript
const pointInTimePreview = useMutation({
  mutationFn: (params: { screenId: string; at: number }) =>
    api.post('/preview/point-in-time', params),
  // No queryClient.invalidateQueries after preview — preview does not mutate server state
});
```

Preview results are ephemeral by design. A preview run creates a `PreviewSession` record server-side (for the approval gate check), but the full preview response is not persisted client-side.

### 5.3 Error Handling

| API Error | UI Response |
|---|---|
| 404 (screen not found) | "Screen not found. Verify screen ID and try again." |
| 409 (corpus not available) | "Corpus not available for this venue. Corpus delivery may be pending." |
| 503 (PRE unavailable) | "Preview service unavailable. Try again in a moment." |
| 429 (rate limited) | "Preview requests are rate limited. Wait [retry-after]s and try again." |
| EMERGENCY_FREEZE state | "Preview unavailable during EMERGENCY_FREEZE." |

---

## 6. Preview During Constitutional States

```typescript
// src/components/preview/PreviewAvailabilityGuard.tsx

function PreviewAvailabilityGuard({ children }: { children: React.ReactNode }) {
  const { state } = useConstitutionalStore();

  if (state === 'EMERGENCY_FREEZE') {
    return (
      <div className="preview-unavailable">
        <p>Preview is unavailable during EMERGENCY_FREEZE.</p>
        <p>The system must return to READ_ONLY or HEALTHY state before preview can run.</p>
      </div>
    );
  }

  if (state === 'DEGRADED' || state === 'CONSTITUTIONAL_RISK') {
    return (
      <>
        <div className="preview-state-warning">
          System is in {state} state. Preview results may not reflect current operational state.
        </div>
        {children}
      </>
    );
  }

  // READ_ONLY: preview works normally (read-only by definition)
  // HEALTHY, SHADOW_ONLY: preview works normally
  return <>{children}</>;
}
```

This guard wraps all four preview type components. It is applied at the route level, not per-component.

---

## 7. Explainability Display

The `explainResolution()` function in `src/preview/explain/explain-resolution.ts` produces exactly 7 LevelExplanation entries (one per PRE level, 0–6). The UI renders these as an expandable panel below the playlist table.

```typescript
// Level explanation display

function ResolutionExplanation({ explanation }: { explanation: ResolutionExplanation }) {
  return (
    <details className="resolution-explanation">
      <summary>Resolution explanation (7 levels)</summary>
      <div className="explanation-body">
        <p>{explanation.summary}</p>
        {explanation.levels.map(level => (
          <div key={level.level_number} className={`level-entry ${level.was_skipped ? 'skipped' : 'evaluated'}`}>
            <div className="level-header">
              <span className="level-number">Level {level.level_number}</span>
              <span className="level-name">{level.level_name}</span>
              {level.was_terminating && <span className="badge-terminating">TERMINATED HERE</span>}
              {level.was_skipped && <span className="badge-skipped">skipped</span>}
            </div>
            {!level.was_skipped && (
              <div className="level-detail">
                <p>{level.explanation_text}</p>
                {level.active_constraints.map(c => (
                  <code key={c.key}>{c.key}={c.value}</code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
```

**The label "TERMINATED HERE" uses the correct override semantics.** Levels below the terminating level are shown as "not evaluated" — not as "lower priority" or "overridden". This framing is consistent with the constitutional requirement: override = level-termination, not priority competition.

---

## 8. Open Items

1. Preview rate limiting — the P2 schedule walk makes up to 1,344 API calls for a 14-day walk at 15-minute resolution. Need to confirm server-side rate limit per session and set appropriate client-side concurrency limit. Current plan: 10 concurrent, but this needs performance testing.

2. PreviewSession retention policy — how long does the server retain PreviewSession records? The approval gate checks for any session; if sessions expire after 24 hours, the gate check changes behavior for slow-moving campaigns.

3. P4 legacy resolver availability — the comparison preview calls the legacy resolver. At what canary stage is the legacy resolver decommissioned? The UI availability gate for P4 checks `canary_stage !== 'AUTHORITATIVE'`, but the server must also enforce this.

4. What-if preview with operator-defined delta — the delta format for P3 needs a defined schema. Current plan covers three options (campaign override, campaign activation, SOV change). Are there other delta types needed for v1?
