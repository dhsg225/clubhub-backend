# Incident Management UX Implementation Plan

**Surface:** Incident and emergency management interfaces within `cms-web`
**Audiences:** VENUE_OPERATOR, REGIONAL_MANAGER, ENTERPRISE_ADMIN, PLATFORM_ADMIN
**Status:** Implementation-ready engineering specification

---

## 1. Incident Model

Incidents in ClubHub TV are not a distinct data entity — they are derived from four event sources:

| Source | Severity | Threshold | Records in |
|---|---|---|---|
| EMERGENCY_FREEZE | P1 | Any occurrence | ConstitutionalFreezeLog + StateTransitionLog |
| CLASS_4 shadow divergence | P1 | Any occurrence | ParityRecord + CircuitBreakerLog |
| CLASS_3 shadow divergence | P2 | Any occurrence | ParityRecord |
| CRITICAL entropy | P2 | severity=CRITICAL | EntropyReport |
| Circuit breaker OPEN | P2 | Any breaker OPEN | CircuitBreakerLog |
| WARNING entropy | P3 | severity=WARNING | EntropyReport |
| Screen offline (extended) | P4 | >15 min offline | DeviceStatusLog |
| Corpus staleness | P4 | >72h without update | EntropyReport |

The incident feed aggregates from these sources. There is no separate `incidents` table — the feed is a live query across the underlying logs.

---

## 2. Incident Console (`/incidents`)

**Route:** `/incidents`
**Required role:** REGIONAL_MANAGER+ (scoped to their venues)
**URL params:** `?venueId=` (optional — filters to single venue), `?severity=P1,P2` (optional)

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  INCIDENTS                                                  │
│  [P1: 1]  [P2: 3]  [P3: 7]  [P4: 12]    [Filter]          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  P1  EMERGENCY_FREEZE — Platform     4h 12m ago   ACTIVE   │
│      Acme Golf Group — Replay nondeterminism               │
│      [View]                                                 │
├─────────────────────────────────────────────────────────────┤
│  P1  CLASS_4 Divergence — The Grand Hotel  2h ago  ACTIVE  │
│      shadow_id=abc123, screen_id=xyz                       │
│      [View]  [Rollback]                                     │
├─────────────────────────────────────────────────────────────┤
│  P2  CRITICAL Entropy — Pinehurst Course 2  1h ago  ACTIVE │
│      5 screens, asset drift detected                       │
│      [View]  [Resync]                                       │
└─────────────────────────────────────────────────────────────┘
```

Severity badges: P1 = red, P2 = amber, P3 = yellow, P4 = gray.

Active incidents are listed first, sorted by severity then recency. Resolved incidents below, collapsed by default.

### 2.2 Real-time Updates

The incident feed subscribes to the WebSocket broadcast. New incidents appear at the top of the list without requiring a page refresh. A subtle "new incident" animation (border flash, not a popup) draws attention without being disruptive.

No auto-refresh that clears resolved state from the UI. When an incident resolves, it stays in the list and changes status badge to "RESOLVED [n] min ago". It does not disappear.

### 2.3 Incident Feed Query

```typescript
// TanStack Query — incident feed derived from log sources

function useIncidentFeed(scope: IncidentScope): QueryResult<Incident[]> {
  return useQuery({
    queryKey: ['incidents', scope],
    queryFn: () => api.get('/incidents', { params: scope }),
    staleTime: 30_000,
    refetchInterval: 60_000,  // background refresh — WebSocket handles real-time
  });
}

// WebSocket handler for real-time incident events
function useIncidentWebSocket() {
  useEffect(() => {
    const unsubscribe = wsClient.subscribe('INCIDENT_EVENT', (event) => {
      queryClient.setQueryData(['incidents'], (old) =>
        mergeIncidentEvent(old, event)
        // mergeIncidentEvent: adds new, updates existing, never removes
      );
    });
    return unsubscribe;
  }, []);
}
```

---

## 3. P1 Incident UX — Role-Differentiated Views

When a P1 incident is active (EMERGENCY_FREEZE or CLASS_4 divergence), every operator workspace shows a P1 alert appropriate to their role. The alert appears via WebSocket push — operators do not need to navigate to `/incidents` to see it.

### 3.1 VENUE_OPERATOR View

A full-width banner above all content:

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM ISSUE DETECTED                                      │
│  Your screens are serving last verified content.           │
│  Platform administrators have been notified.               │
│  Expected resolution time: unknown. Do not make changes.   │
└─────────────────────────────────────────────────────────────┘
```

VENUE_OPERATOR sees no technical details about the P1 cause. They do not need to know if it is a replay nondeterminism or CLASS_4 divergence — that information would cause alarm without enabling any action on their part. Their screens are serving safe content. That is the relevant fact.

No "contact support" button that links to an internal page. Instead: show the configured on-call PLATFORM_ADMIN contact name from the venue's configuration. If no on-call contact is configured: "Contact your venue manager."

### 3.2 REGIONAL_MANAGER View

Same banner + additional detail:

```
┌─────────────────────────────────────────────────────────────┐
│  P1 SYSTEM INCIDENT — [Acme Golf Group]                    │
│  Affected venues: The Grand Hotel, Pinehurst Course 2 (2)  │
│  Platform administrators have been notified.               │
│  [Contact PLATFORM_ADMIN: J. Smith]   [View affected venues]│
└─────────────────────────────────────────────────────────────┘
```

REGIONAL_MANAGER can see which venues are affected and navigate to their dashboards to see screen status. They cannot take any constitutional recovery action.

### 3.3 ENTERPRISE_ADMIN View

Banner + constitutional state summary:

```
┌─────────────────────────────────────────────────────────────┐
│  P1 INCIDENT: EMERGENCY_FREEZE                             │
│  Enterprise: Acme Golf Group                               │
│  State entered: 4h 12m ago                                 │
│  Cause: Replay nondeterminism (ReplayCircuitBreaker OPEN)  │
│  All screens serving last verified corpus.                 │
│  [View constitutional state]                               │
└─────────────────────────────────────────────────────────────┘
```

"View constitutional state" links to the read-only constitutional state view for ENTERPRISE_ADMIN. This is not the full PLATFORM_ADMIN console — it is a read-only summary of state and circuit breakers.

### 3.4 PLATFORM_ADMIN View

The EMERGENCY_FREEZE overlay (from CMS-APPLICATION-PLAN.md Section 5.4) renders for PLATFORM_ADMIN as for all roles. Additionally, on login when P1 is active, the PLATFORM_ADMIN is navigated to `/constitutional` immediately — not to their usual landing page.

```typescript
// In AuthenticationShell, after role resolution
if (role === 'PLATFORM_ADMIN' && constitutionalState === 'EMERGENCY_FREEZE') {
  navigate('/constitutional', { replace: true });
}
```

---

## 4. P2 Incident UX — CLASS_3 Divergence

CLASS_3 divergence is a shadow parity failure — PRE and legacy outputs differ in semantic fields, but the system has not frozen. The canary is still running.

### 4.1 Alert Banner

A non-full-screen alert banner in the workspace (above main content, below app chrome):

```
┌─────────────────────────────────────────────────────────────┐
│  P2 ALERT: Shadow Divergence Detected                       │
│  CLASS_3 divergence on 3 screens at The Grand Hotel.       │
│  Canary is still running. Human review required.           │
│  [View details]  [Review rollback options]                 │
└─────────────────────────────────────────────────────────────┘
```

Available to ENTERPRISE_ADMIN+. REGIONAL_MANAGER and VENUE_OPERATOR see a simplified version: "Canary validation issue detected. Administrators have been notified."

### 4.2 Divergence Detail View

Route: `/incidents/:incidentId` (where incidentId is derived from the ParityRecord ID)

Shows:
- Divergence class (CLASS_3)
- Affected screens (list with screen IDs)
- Shadow invocation that triggered the divergence (timestamp, screen_id)
- Field-level diff: which fields differ between legacy and PRE output
- Rollback evaluation: did `evaluateRollbackTrigger()` recommend rollback? (always yes for CLASS_3)
- Available actions

**Available actions for CLASS_3:**
1. "Review rollback" — two-step flow (see Section 4.3)
2. "Disable shadow" — stops shadow execution; requires token (min 8 chars); not a rollback, just stops comparison
3. Human followup is always required — no "auto-recover" button

### 4.3 Canary Rollback Flow — Two Step

The canary rollback action rolls the canary back to the previous stage (e.g., MULTI_VENUE → SINGLE_VENUE).

**Step 1 — Impact review:**
- Shows: current canary stage, proposed rollback target stage
- Shows: number of venues affected by the rollback
- Shows: ParityRecord for the triggering divergence (full detail)
- Shows: rollback reason recommendation from `evaluateRollbackTrigger()`
- "Proceed to authorization" button

**Step 2 — Authorization:**
- Input: "Rollback Authorization Token" (min 8 chars)
- Rollback reason selection: PARITY_THRESHOLD_BREACH / CLASS_3_DIVERGENCE / OPERATOR_DECISION
- "Confirm Rollback" button — disabled until token is entered
- On confirm: POST `/api/v2/canary/rollback` with token + reason
- On success: shows new canary stage, links to `/fleet/canary`

---

## 5. Emergency Event UX (Venue-Level)

### 5.1 Emergency Console (`/venues/:venueId/emergency`)

The emergency console is the primary surface for managing active venue emergencies. It is accessible:
- Direct URL navigation
- From the venue dashboard (button on active emergency card)
- From the mobile emergency tab

**Layout when emergency is active:**

```
┌─────────────────────────────────────────────────────────────┐
│  EMERGENCY ACTIVE — [Venue Name]                           │
│  Type: COMPLIANCE                                           │
│  Triggered: 2026-05-26 09:14:02Z by J. Smith               │
│  Affected screens: 12 / 12                                 │
│  Duration: 47 minutes                                      │
│                                                             │
│  Note: "Lightning warning — course marshal"                │
│                                                             │
│  [Clear Emergency]                                         │
└─────────────────────────────────────────────────────────────┘

Emergency History (last 30 days):
  [list of past emergencies]
```

**Layout when no emergency is active:**

```
┌─────────────────────────────────────────────────────────────┐
│  No active emergency at [Venue Name]                       │
│                                                             │
│  [Trigger Emergency]                                       │
└─────────────────────────────────────────────────────────────┘

Emergency History (last 30 days):
  [list of past emergencies]
```

### 5.2 Emergency Trigger Flow (Web)

Same two-step flow as specified in CMS-APPLICATION-PLAN.md Section 5.2. Implemented as two separate routes to enforce the full-page requirement:

- Route 1: `/venues/:venueId/emergency/trigger` — type selection and note
- Route 2: `/venues/:venueId/emergency/confirm` — confirmation (red background)

The floating action button is shown in venue views (bottom-right corner, fixed position):

```typescript
// src/components/emergency/EmergencyFab.tsx
// Shown on: /venues/:venueId, /venues/:venueId/screens, /venues/:venueId/schedule

function EmergencyFab({ venueId }: { venueId: string }) {
  const { data: activeEmergency } = useActiveEmergency(venueId);
  const navigate = useNavigate();

  if (activeEmergency) {
    return (
      <button
        className="fixed bottom-6 right-6 bg-red-700 text-white px-4 py-3 rounded font-medium"
        onClick={() => navigate(`/venues/${venueId}/emergency`)}
      >
        Emergency Active — View
      </button>
    );
  }

  return (
    <button
      className="fixed bottom-6 right-6 bg-red-900 text-white px-4 py-3 rounded font-medium"
      onClick={() => navigate(`/venues/${venueId}/emergency/trigger`)}
    >
      Trigger Emergency
    </button>
  );
}
```

The FAB is always visible in venue views — it does not hide or collapse. Its z-index is below the EMERGENCY_FREEZE overlay (which is global) but above all content.

### 5.3 Emergency Clearance

Clearing an emergency requires an acknowledgment note. There is no "clear" button without a note.

```typescript
// Clear emergency form — inline on the active emergency card
function ClearEmergencyForm({ emergencyId, venueId }: Props) {
  const [note, setNote] = useState('');
  const clearMutation = useClearEmergency();

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      clearMutation.mutate({ emergencyId, acknowledgmentNote: note });
    }}>
      <label>Clearance note (required)</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Describe why the emergency is being cleared..."
        minLength={10}
      />
      <button
        type="submit"
        disabled={note.length < 10 || clearMutation.isPending}
      >
        Clear Emergency
      </button>
      <span>{note.length} / 10 chars minimum</span>
    </form>
  );
}
```

---

## 6. Entropy Review UX (`/venues/:venueId/entropy`)

### 6.1 Entropy Report List

Reports sorted by severity (CRITICAL first), then recency within severity.

```
┌───────────────────────────────────────────────────────┐
│  CRITICAL  5 screens · 47min drift · asset-checksum…  │
│  [Resync Assets]  [Rollback Corpus]  [Acknowledge]    │
├───────────────────────────────────────────────────────┤
│  WARNING   2 screens · 18min drift · asset-checksum…  │
│  [Resync Assets]  [Acknowledge]                       │
├───────────────────────────────────────────────────────┤
│  INFO      1 screen  · 3min drift  · asset-checksum…  │
│  [Acknowledge]                                        │
└───────────────────────────────────────────────────────┘
```

### 6.2 Resolution Actions

**Resync Assets:** Triggers asset push for affected screens.
- POST `/api/v2/entropy/:reportId/resync`
- No confirmation required (non-destructive)
- Success: "Asset resync triggered. Screens will update within [estimated time]."
- After resync: "Verify Resolution" button appears

**Rollback Corpus:** Rolls back to a previous corpus version for this venue.
- Two-step confirmation:
  - Step 1: Shows current version, proposed rollback version, what changes will revert
  - Step 2: Authorization token (min 8 chars) + confirm button
- POST `/api/v2/entropy/:reportId/rollback` with token
- After rollback: "Verify Resolution" button appears

**Acknowledge Acceptable:** For cases where drift is within acceptable tolerance.
- Role restriction: REGIONAL_MANAGER+ for WARNING or CRITICAL severity; VENUE_OPERATOR can acknowledge INFO only
- Requires acknowledgment note (min 10 chars)
- No auto-acknowledge button
- After acknowledgment: report marked as "ACKNOWLEDGED" with operator name and timestamp

### 6.3 Verify Resolution

The "Verify Resolution" button triggers a re-scan of the affected screens. This is the critical post-resolution step.

```typescript
// Verify resolution — only available after an action has been taken
function VerifyResolutionButton({ reportId }: { reportId: string }) {
  const verifyMutation = useVerifyResolution(reportId);
  const [scanResult, setScanResult] = useState<EntropyReport | null>(null);

  return (
    <div>
      <button
        onClick={() => verifyMutation.mutate(void 0, {
          onSuccess: (result) => setScanResult(result),
        })}
        disabled={verifyMutation.isPending}
      >
        {verifyMutation.isPending ? 'Scanning...' : 'Verify Resolution'}
      </button>

      {scanResult && (
        <div className={`scan-result ${scanResult.severity === 'NONE' ? 'resolved' : 'still-active'}`}>
          {scanResult.severity === 'NONE' ? (
            <p>Resolution confirmed — no entropy detected.</p>
          ) : (
            <p>Entropy still present: {scanResult.severity}. Review required.</p>
          )}
          <p>Scan completed: {scanResult.scanned_at}</p>
        </div>
      )}
    </div>
  );
}
```

**A report cannot be marked "resolved" without a Verify Resolution scan showing NONE.** The button to mark a report resolved only appears after the scan completes and shows severity=NONE. This prevents operators from marking incidents resolved without confirming the fix worked.

---

## 7. Post-Incident Review (`/incidents/:incidentId/review`)

### 7.1 Availability

Available after P1 and P2 incidents reach "RESOLVED" status. For P1 incidents, a reminder banner appears in the PLATFORM_ADMIN and ENTERPRISE_ADMIN workspaces within 24 hours of resolution if no review has been submitted.

```
┌─────────────────────────────────────────────────────────────┐
│  POST-INCIDENT REVIEW REQUIRED                             │
│  P1 incident resolved 18h ago — review due in 6h           │
│  [Complete Review]                                         │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Review Form

```
Post-Incident Review — P1 EMERGENCY_FREEZE (2026-05-25)
──────────────────────────────────────────────────────

Incident Timeline (auto-populated from audit log)
  14:32:11Z  ReplayCircuitBreaker opened (threshold=1, failure_count=1)
  14:32:11Z  GlobalConstitutionalBreaker → EMERGENCY_FREEZE
  14:32:11Z  All operators notified via WebSocket
  18:44:07Z  PLATFORM_ADMIN began exit procedure
  18:55:23Z  EMERGENCY_FREEZE exited (→ READ_ONLY)
  19:02:11Z  Integrity suite: ALL PASS
  19:03:44Z  System → HEALTHY

Root Cause  (required)
  [ Text area — minimum 100 chars ]

What changed in the 24h before the incident?
  [ Text area — minimum 50 chars ]

Prevention Plan  (required)
  [ Text area — minimum 100 chars ]

Reference audit records:
  [Attach replay audit record ID]  [+Add another]

[Submit Review]
```

All required text fields must be filled before the review can be submitted. Character minimums are enforced client-side with a live count. The "Submit Review" button is disabled until all required fields meet their minimums.

### 7.3 Review Submission

On submit: POST `/api/v2/incidents/:incidentId/review` with the form data.

The server generates a report combining:
- The form data (root cause, prevention plan, what changed)
- The auto-populated timeline from audit records
- References to the specific audit record IDs attached

**Generating a PDF:** The review is available as a PDF after submission (GET `/api/v2/incidents/:incidentId/review/pdf`). The UI shows a "Download Report" button after successful submission. The PDF includes the full audit record timeline — it is not a summary.

### 7.4 24-Hour Requirement

The 24-hour review requirement is surfaced as:
1. A banner reminder in PLATFORM_ADMIN and ENTERPRISE_ADMIN workspaces (Section 7.1)
2. The incident in the list shows a "Review due in Xh" badge
3. After 24 hours without review: the badge changes to "Review overdue" (amber)

The system does not block any operations if the review is overdue. It does surface the overdue state prominently and log it in the audit record.

---

## 8. Incident State Machine

Incidents progress through these states:

```
DETECTED → ACKNOWLEDGED → INVESTIGATING → RESOLVED → REVIEW_SUBMITTED
```

| State | Meaning | Available Actions |
|---|---|---|
| DETECTED | Event received, no operator response | View, Acknowledge |
| ACKNOWLEDGED | Operator has seen it | Assign, Start Investigation |
| INVESTIGATING | Active work in progress | Update status, resolve actions |
| RESOLVED | System returned to normal | Submit post-incident review |
| REVIEW_SUBMITTED | Review complete | Download PDF |

State transitions are manual (operator-driven), except:
- DETECTED → ACKNOWLEDGED auto-transitions when an operator views the incident detail (reading is acknowledgment)
- RESOLVED state can only be set after the underlying system event has cleared (API validates this)

---

## 9. Open Items

1. Incident assignment — the model supports "assigned operator" but the assignment mechanism is not specified. Is assignment manual (operator picks themselves) or auto-assigned based on on-call rotation? On-call rotation is an unimplemented system entity; for v1, assignment is manual.

2. Entropy re-scan API endpoint — the CMS architecture notes this as an open item. The UI assumes POST `/api/v2/entropy/:reportId/re-scan` exists and returns a new EntropyReport. This must be implemented on the API side.

3. Review due time calculation — 24 hours from resolution; confirm whether this is from RESOLVED state or from EMERGENCY_FREEZE exit. These may differ if EMERGENCY_FREEZE is exited but the system takes additional time to reach HEALTHY.

4. PDF generation service — the review PDF feature requires server-side PDF generation. This is not currently in the backend plan. Either implement server-side PDF rendering or substitute with a client-side print-to-PDF via `window.print()` with a print-specific stylesheet.

5. Incident retention — how long are resolved incidents retained in the feed? Audit logs have defined retention periods (90 days / 365 days / permanent for EMERGENCY_FREEZE). The incident feed should follow the same retention as its source events.
