# Operator Console Implementation Plan

**Surface:** Constitutional controls console — PLATFORM_ADMIN-only sections of `cms-web`
**Audience:** PLATFORM_ADMIN exclusively
**Status:** Implementation-ready engineering specification

---

## 1. Overview

The operator console is the PLATFORM_ADMIN interface for constitutional state management. It is not a monitoring dashboard — it is the recovery surface for system states that cannot resolve themselves.

**Design principle:** Every action in this console has a permanent record. The console surfaces that record before asking for authorization. There are no shortcuts, no force-heal buttons, and no confirmations that can be clicked through without reading the content presented.

---

## 2. Route Structure

All routes require `role === 'PLATFORM_ADMIN'`. These routes are part of the main `cms-web` application but are in a separate route subtree. The role guard for this subtree is a single gate at `/constitutional`, not per-route.

| Path | Component | Key Behavior |
|---|---|---|
| `/constitutional` | `ConstitutionalStatePanel` | Current state per enterprise + platform; circuit breaker grid; state history |
| `/constitutional/freeze-log` | `ConstitutionalFreezeLogViewer` | Virtualized permanent record log; no delete; no filter that hides records |
| `/constitutional/reset` | `EmergencyFreezeExitWizard` | 7-step wizard; no step skipping; wizard state not persisted in URL params |
| `/constitutional/circuit-breakers` | `CircuitBreakerDashboard` | Per-breaker state; failure count; time in state; last event |
| `/constitutional/integrity` | `IntegrityCheckRunner` | Runs validate-contracts.ts, full-stack-determinism, constitutional-boundary-check; streaming output |

**Caching policy for all constitutional console routes:**
- Server state queries: `staleTime: 0` — always fetch fresh on route mount
- No browser-level caching (`Cache-Control: no-store` on all API responses from `/api/v2/constitutional/*`)
- TanStack Query `gcTime: 0` for all constitutional queries — do not persist to cache
- Rationale: a PLATFORM_ADMIN looking at constitutional state must see the current state, not a cached impression of it

---

## 3. Constitutional State Panel (`/constitutional`)

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Platform Constitutional State                          │
│  ┌──────────────┐  Current state: EMERGENCY_FREEZE      │
│  │ STATE BADGE  │  Entered: 2026-05-25T14:32:11Z        │
│  │   (large)    │  Duration: 4h 12m                    │
│  └──────────────┘  Reason: REPLAY_NONDETERMINISM        │
│                                                         │
│  [View Freeze Log]   [Begin Exit Procedure]             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Enterprise States                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Acme Golf Group     EMERGENCY_FREEZE  4h 12m    │    │
│  │ Metro Hospitality   HEALTHY           —         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Circuit Breakers                                       │
│  PRECircuitBreaker        OPEN      3/3 failures        │
│  ReplayCircuitBreaker     OPEN      1/1 failures        │
│  EntropyCircuitBreaker    CLOSED    0/5 failures        │
│  ShadowCircuitBreaker     CLOSED    0/3 failures        │
│  GlobalConstitutionalBreaker  EMERGENCY_FREEZE          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  State Transition History                               │
│  [Expandable — loads from StateTransitionLog]           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 State Badge Colors

| Constitutional State | Color |
|---|---|
| HEALTHY | Green (`bg-green-900 text-green-200`) |
| DEGRADED | Amber (`bg-amber-900 text-amber-200`) |
| CONSTITUTIONAL_RISK | Orange (`bg-orange-900 text-orange-200`) |
| SHADOW_ONLY | Blue (`bg-blue-900 text-blue-200`) |
| PRE_DISABLED | Orange (`bg-orange-900 text-orange-200`) |
| READ_ONLY | Amber (`bg-amber-900 text-amber-200`) |
| EMERGENCY_FREEZE | Red (`bg-red-900 text-red-200`) |
| INITIALIZING | Gray (`bg-gray-800 text-gray-400`) |

### 3.3 State Transition History

The transition history loads from `StateTransitionLog`. Shown as a timeline, newest first. Each entry:
- Timestamp (ISO 8601, full precision)
- Previous state → New state
- Reason
- Actor (system or PLATFORM_ADMIN name)

No "clear history" button. No filter that hides entries. The log is append-only and the UI reflects that.

### 3.4 No "Force Heal" Button

The constitutional state panel does not contain a "force heal", "reset circuit breaker", "force HEALTHY", or any similar button. State transitions follow the allowed transitions table from `src/runtime/state-machine/allowed-transitions.ts`. The only human-authorized action is the EMERGENCY_FREEZE exit wizard.

---

## 4. Emergency Freeze Exit Wizard (`/constitutional/reset`)

This wizard is the most consequential action in the system. It must be impossible to complete carelessly.

### 4.1 Wizard Architecture

The wizard is a seven-step linear flow. State is held in memory (React component state), not in URL params or localStorage. Refreshing the page restarts from step 1. This is intentional — a PLATFORM_ADMIN who refreshes mid-wizard must re-review the freeze evidence.

Progress is shown as a step indicator at the top showing which steps are complete. Completed steps can be revisited but not bypassed.

```typescript
type WizardState = {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  completedSteps: Set<number>;
  freezeEventId: string;          // loaded on step 1
  nondeterminismRecord: ReplayAuditRecord | null;  // loaded on step 2
  rootCauseDeclaration: string;   // entered on step 3
  authorizationToken: string;     // entered on step 4
  consentChecked: boolean;        // step 5
  resetResult: ResetResult | null; // populated on step 6
};
```

### 4.2 Step 1 — Review Freeze Log

**Purpose:** The operator must see the ConstitutionalFreezeLog entry for this freeze event before proceeding.

- Displays the freeze log entry in full, formatted
- Shows: freeze event ID, timestamp, reason, enterprise affected, triggering circuit breaker
- The operator must scroll to the bottom of the freeze log entry before "Continue" becomes enabled
- "Continue" is enabled via an `IntersectionObserver` on the last paragraph of the freeze log content — not a timer, not a checkbox
- No "mark as read" shortcut

```typescript
// Implementation: IntersectionObserver on the sentinel element at the bottom of the freeze log card
const observer = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    setStep1ReadConfirmed(true);
    observer.disconnect();
  }
}, { threshold: 1.0 });
observer.observe(sentinelRef.current);
```

### 4.3 Step 2 — Review Nondeterminism Event

**Purpose:** The operator sees the specific ReplayAuditRecord that triggered the freeze.

- Queries `GET /api/v2/constitutional/freeze-event/:freezeEventId/nondeterminism-record`
- Shows the full ReplayAuditRecord: screen_id, at (timestamp), input_hash, output_hash, trace diff
- Shows why this record was classified as nondeterminism (the two divergent output hashes for the same input)
- "Continue" is unconditionally enabled once the record has loaded — PLATFORM_ADMIN is trusted to read it

### 4.4 Step 3 — Root Cause Declaration

**Purpose:** The PLATFORM_ADMIN declares in writing what caused this freeze.

- Text area: minimum 50 characters before "Continue" is enabled
- Character count shown below text area: "47 / 50 characters minimum"
- Label: "Root Cause Declaration"
- Helper text: "Describe what caused this EMERGENCY_FREEZE. This will be permanently recorded with the freeze event."
- No spell-check suppression (`spellCheck={true}`) — operators should write clearly
- No template or suggested text — must be original

### 4.5 Step 4 — Human Authorization Token

**Purpose:** Explicit human authorization that cannot be generated by an automated script without human involvement.

- Input labeled: "Constitutional Authorization Token"
- Helper text: "Enter your authorization token. This token will be permanently recorded."
- Input: `type="text"`, `autoComplete="off"`, `spellCheck={false}`
- No paste suppression — operators may retrieve tokens from a secure vault
- Minimum 8 characters (same requirement as canary approval)
- "Continue" disabled until `token.length >= 8`
- Character count NOT shown (this is a token, not prose)

### 4.6 Step 5 — Confirmation Checkbox

**Purpose:** Final explicit consent before execution.

- A single checkbox with label: "I authorize the system to exit EMERGENCY_FREEZE. I confirm the root cause has been identified and the system is safe to return to READ_ONLY state."
- "Execute Exit" button is disabled until the checkbox is checked
- No pre-checked state — operator must physically interact with the checkbox

### 4.7 Step 6 — Execute

**Purpose:** POST the exit request and show the result.

```typescript
// POST /api/v2/constitutional/reset
const payload = {
  freeze_event_id: wizardState.freezeEventId,
  root_cause_declaration: wizardState.rootCauseDeclaration,
  human_authorization_token: wizardState.authorizationToken,
};
```

- On submit: show a loading state — "Executing EMERGENCY_FREEZE exit..."
- On success: show "Exit initiated. System is transitioning to READ_ONLY."
- On failure: show the API error message in full — do not abstract it
- The "Execute Exit" button disables after first click (prevent double-submission)

**State after exit:** The constitutional state transitions to READ_ONLY. The PLATFORM_ADMIN must now run the integrity suite before the system can transition to HEALTHY.

### 4.8 Step 7 — Post-Exit Monitoring

**Purpose:** The PLATFORM_ADMIN stays in the console to oversee the recovery.

- Shows current constitutional state (live WebSocket update) — should now be READ_ONLY
- Shows the IntegrityCheckRunner (same component as `/constitutional/integrity`)
- IntegrityCheckRunner must show ALL PASS before a "Authorize HEALTHY State" button appears
- "Authorize HEALTHY State" button: requires a second token input (minimum 8 chars, separate from step 4 token)
- On authorize: POST `/api/v2/constitutional/approve-healthy` with token
- On approval: system transitions to HEALTHY; wizard shows "System restored to HEALTHY" and links to freeze log

**The wizard does not auto-advance the system to HEALTHY after ALL PASS.** The PLATFORM_ADMIN must explicitly press the button and enter the token. This is intentional — the integrity suite passing is a necessary condition, not sufficient on its own.

---

## 5. Freeze Log Viewer (`/constitutional/freeze-log`)

### 5.1 Requirements

- Virtualized list — the freeze log can contain thousands of entries over time; must not render all of them in DOM
- Implementation: `@tanstack/react-virtual` with `@radix-ui/react-scroll-area`
- Each entry is expandable: click to show full event detail
- No delete button anywhere in this UI
- No "archive" button
- No bulk operations
- Filter by enterprise is the only filter available (PLATFORM_ADMIN manages multiple enterprises)

### 5.2 Entry Display

Each freeze log entry shows:
- Timestamp (ISO 8601 full precision)
- Enterprise name
- Freeze trigger (e.g., "ReplayCircuitBreaker: nondeterminism on screen_id=abc123")
- Duration in freeze (if exited: calculated duration; if active: live counter)
- Exit status: "ACTIVE", "EXITED BY PLATFORM_ADMIN [name]", "EXITED BY SYSTEM"
- Expanded: root cause declaration, authorization token reference (not the token itself), associated nondeterminism record ID

### 5.3 Retention

ConstitutionalFreezeLog entries have unconditional permanent retention (per CMS architecture). The UI must never surface a retention period or suggest that entries expire.

---

## 6. Circuit Breaker Dashboard (`/constitutional/circuit-breakers`)

### 6.1 Breaker Grid

One row per circuit breaker:

| Breaker | State | Count | Threshold | Time in State | Last Event |
|---|---|---|---|---|---|
| PRECircuitBreaker | OPEN | 3/3 | 3 | 4h 12m | View |
| ReplayCircuitBreaker | OPEN | 1/1 | 1 | 4h 12m | View |
| EntropyCircuitBreaker | CLOSED | 0/5 | 5 | — | — |
| ShadowCircuitBreaker | CLOSED | 0/3 | 3 | — | — |
| GlobalConstitutionalBreaker | EMERGENCY_FREEZE | — | — | 4h 12m | View |

### 6.2 Individual Breaker Detail

Clicking "View" on a breaker:
- Shows the CircuitBreakerLog entries for this breaker
- Shows state transition history for this breaker
- Shows the specific failure events that caused the state change
- No "reset breaker" button — circuit breaker reset is a consequence of the wizard flow, not an independent action

### 6.3 GlobalConstitutionalBreaker

The GlobalConstitutionalBreaker row shows:
- Current mode: NORMAL / READ_ONLY / EMERGENCY_FREEZE
- If EMERGENCY_FREEZE: button "Begin Exit Procedure" → links to `/constitutional/reset`
- This is the only action available on this row
- No direct "reset" or "force normal" button

---

## 7. System Integrity Runner (`/constitutional/integrity`)

### 7.1 What It Runs

The integrity runner executes three scripts in sequence, streaming output to the UI:

1. `scripts/validate-contracts.ts --all` — contract enforcement check (143 files)
2. `scripts/system-integrity/full-stack-determinism.ts` — 100 runs PRE+Shadow+Entropy determinism
3. `scripts/system-integrity/constitutional-boundary-check.ts` — PRE boundary isolation check

These scripts are invoked server-side via `POST /api/v2/constitutional/integrity/run`. Output is streamed via WebSocket to the UI.

### 7.2 Streaming Output Display

```typescript
// WebSocket message format from integrity runner
type IntegrityMessage =
  | { type: 'SCRIPT_START'; script: string }
  | { type: 'OUTPUT_LINE'; line: string }
  | { type: 'SCRIPT_RESULT'; script: string; passed: boolean; stats: string }
  | { type: 'SUITE_COMPLETE'; allPassed: boolean };
```

UI renders output as a monospace log pane. Each line appended as it arrives. Script start and result are rendered as section headers.

```
[validate-contracts.ts]
  Checking 143 files...
  ✓ 143 files, 0 violations

[full-stack-determinism.ts]
  Run 1/100: PRE ✓ Shadow ✓ Entropy ✓
  Run 2/100: PRE ✓ Shadow ✓ Entropy ✓
  ...
  ✓ 100/100 runs: all checksums identical

[constitutional-boundary-check.ts]
  Scanning 24 PRE files...
  ✓ 0 boundary violations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL PASS — System integrity confirmed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 7.3 Pass/Fail Gate

- If ALL PASS: show green banner "System integrity confirmed"
- If any FAIL: show red banner "Integrity check failed — see output above"
- The "Authorize HEALTHY State" button (used in wizard step 7) is only available when ALL PASS
- Running the integrity check twice is allowed — it must produce the same result (determinism)
- Each run is independently logged with a timestamp in the audit log

### 7.4 Audit Logging for PLATFORM_ADMIN Actions

All PLATFORM_ADMIN actions in the constitutional console are logged to an `action_log` table with:
- `admin_id` (user ID)
- `action` (e.g., `FREEZE_EXIT_INITIATED`, `INTEGRITY_CHECK_RUN`, `HEALTHY_AUTHORIZED`)
- `timestamp`
- `payload` (JSON — includes token references but not token values, root cause text, etc.)
- `enterprise_id` (affected scope)

The action log is append-only. PLATFORM_ADMIN cannot view or modify their own action log (query via AUDITOR role only).

---

## 8. Access Control and Security Notes

### 8.1 PLATFORM_ADMIN route guard

```typescript
// Applied at the /constitutional subtree route
const requirePlatformAdmin = createRouteGuard({
  check: (session) => session.role === 'PLATFORM_ADMIN',
  onDenied: () => redirect('/'),
});
```

The guard does not render "Access Denied" — it redirects to the root application. The constitutional console must never be visible to non-PLATFORM_ADMIN roles, even in a read-only state.

### 8.2 No URL-based state for wizard

The wizard step state is React component state only. There are no URL params encoding the current step, the entered root cause, or the authorization token. This means:

- Sharing the wizard URL lands another PLATFORM_ADMIN at step 1
- Refreshing loses wizard progress (intentional)
- The browser back button does NOT navigate between wizard steps — it exits the wizard entirely

Use `window.onbeforeunload` to warn the PLATFORM_ADMIN if they navigate away mid-wizard:
"Exiting this page will reset your progress. The EMERGENCY_FREEZE will remain active until the exit procedure is completed."

### 8.3 Token handling

Authorization tokens entered in the wizard are never stored in:
- Browser localStorage or sessionStorage
- React state that persists beyond the wizard component lifecycle
- URL query params
- Console logs

They are submitted once via POST and cleared from component state after successful submission.

---

## 9. Open Items

1. Integrity runner timeout — `full-stack-determinism.ts` runs 100 iterations; wall-clock time on production hardware needs measurement before setting UI timeout
2. Concurrent wizard access — if two PLATFORM_ADMINs start the wizard simultaneously, only one can successfully execute the reset (server-side lock needed); UI should detect and show "Another administrator is executing the exit procedure"
3. On-call rotation entity — the architectural docs note this as unimplemented; when PLATFORM_ADMIN on-call becomes a first-class system entity, the constitutional console should surface who is currently on-call in the state panel header
