# FRONTEND-TESTING-STRATEGY-v1

**Status:** AUTHORITATIVE
**Applies to:** ClubHub TV Operator CMS — React 18 + TypeScript
**Last updated:** 2026-06-04
**Owner:** Frontend Engineering

---

## 0. Document Purpose

This document defines the complete frontend testing strategy for the ClubHub TV operator CMS. It specifies exact test cases, assertions, failure conditions, and CI enforcement rules. A QA engineer or frontend developer can write all tests from this document without further specification.

Testing is not about coverage metrics. It is a safety net for operator-facing guarantees. The operator CMS mediates live venue control, incident response, and L6 override placement. Silent failures, incorrect role boundaries, and clock drift are not UX bugs — they are operational safety failures.

---

## 1. Testing Philosophy

### 1.1 Core Principles

**Test behavior, not implementation.** Tests assert what the operator sees and what side effects fire — not which internal functions are called or how state is structured internally. A test that breaks when a variable is renamed is a liability. A test that breaks when the override button appears for a VIEWER is a safety net.

**Tests enforce operator-facing guarantees, not coverage metrics.** The 80% line coverage target exists to catch dead code and untested branches, not as a goal in itself. A surface that has 95% coverage but no test for HF-REG-003 (IC-03 replay mode write controls) is undertested in the only way that matters.

**IC-03 and role-boundary tests are BLOCKING.** No PR merges if HF-REG-001 through HF-REG-010 fail. These tests are enforced in CI as merge gates, not advisory warnings. A green build that skips or disables any HF-REG test is treated as a red build.

**Human-factors regression tests check that hardening patches remain applied.** Every patch in the HARDENING-FAILURE-MODE-REGISTER has a corresponding HF-REG test. These tests exist because the patches were applied in response to identified failure modes — they are regression guards, not initial verifications. If a refactor removes a patch's effect, the HF-REG test must fail loudly.

**All clock-dependent tests use fake timers.** `vi.useFakeTimers()` is mandatory for any test involving `CountdownClock`, `AutonomyClock`, `HoldToConfirmButton` hold duration, `COMMANDER_LAPSED` elapsed time, or any animation timing. Real timeouts in tests produce flaky results and hide drift between server time and `Date.now()`.

**All API tests use MSW handlers.** No test makes a real network call. MSW intercepts at the service worker or Node.js fetch layer. Tests that reach a real backend are integration tests by a different name and are prohibited in the Vitest suite.

**Assertions must be specific.** "Assert the badge renders" is not a test case. "Assert `getByText('LIVE — UNVERIFIED')` is present and has background-color `#FFF8E1`" is a test case. Every test case in this document includes the exact assertion form.

### 1.2 Assertion Conventions

- DOM absence: `expect(queryByRole(...)).not.toBeInTheDocument()`
- DOM presence: `expect(getByRole(...)).toBeInTheDocument()`
- Absence is not the same as disabled: `expect(queryByRole('button', { name: /Place Override/ })).not.toBeInTheDocument()` differs from checking `disabled` attribute — tests that accept disabled instead of absent FAIL
- Style assertions: `expect(element).toHaveStyle({ backgroundColor: '#C62828' })` or `getComputedStyle(element).backgroundColor`
- Class assertions: `expect(element).toHaveClass('pulse-once')` or `expect(element).not.toHaveClass('pulse-continuous')`
- Call count: `expect(mockFn).toHaveBeenCalledTimes(1)`, never just `toHaveBeenCalled()` for count-sensitive safety tests
- Timer advancement: `vi.advanceTimersByTime(ms)` — advance by exact milliseconds, not `vi.runAllTimers()`, which can skip event ordering

---

## 2. Test Pyramid

### Overview

| Tier | Tooling | Approx Count | Run on |
|------|---------|-------------|--------|
| Unit | Vitest | ~120 tests | Every commit |
| Integration | Vitest + RTL + MSW | ~80 tests | Every commit |
| Human-Factors Regression | Vitest + RTL | ~40 tests | Every commit (HF-REG-003 on every commit) |
| E2E | Playwright | ~20 tests | Nightly + PR to main |

**Total:** ~260 tests

### 2.1 Unit Tests (Vitest, ~120)

Pure component behavior with no network calls and no surface context. Tests individual components, utility functions, and state derivation logic in isolation. Fake timers are used wherever any timing is involved. Props are passed directly — no Router or AuthProvider wrapping unless the component explicitly requires it.

### 2.2 Integration Tests (Vitest + RTL + MSW, ~80)

Surface-level workflow tests. Components are rendered within their surface context (Router, AuthProvider, WebSocketProvider, MSW). API calls are intercepted by MSW handlers. WebSocket events are fired via the MSW WebSocket handler. Tests assert what the operator sees after a complete action sequence — not just that a fetch was called.

### 2.3 Human-Factors Regression Tests (Vitest + RTL, ~40)

These tests correspond 1:1 with hardening patches in HARDENING-FAILURE-MODE-REGISTER.md. They validate that specific failure modes remain closed. They are written to be intentionally resistant to refactoring — if a test breaks because someone changed an implementation detail that is not the patch itself, the test should be updated. If a test breaks because the patch was removed or its effect was lost, the PR is blocked.

### 2.4 E2E Tests (Playwright, ~20)

Full browser workflows using a running backend (test environment or Docker Compose). Multi-browser concurrent scenarios for conflict testing. Slower to run — executed nightly and on PRs to main. Not run on every commit.

---

## 3. Unit Tests — Shared UI Components

### 3.1 SeverityBadge

File: `packages/ui/src/components/SeverityBadge.test.tsx`

**Test suite: SeverityBadge**

**SEVERITY-001:** Renders S1 with correct background color
- Render: `<SeverityBadge severity="S1" />`
- Assert: `expect(getByTestId('severity-badge')).toHaveStyle({ backgroundColor: '#C62828' })`

**SEVERITY-002:** Renders S2 with correct background color
- Render: `<SeverityBadge severity="S2" />`
- Assert: `expect(getByTestId('severity-badge')).toHaveStyle({ backgroundColor: '#E64A19' })`

**SEVERITY-003:** Renders S3 with correct background color
- Render: `<SeverityBadge severity="S3" />`
- Assert: `expect(getByTestId('severity-badge')).toHaveStyle({ backgroundColor: '#F57C00' })`

**SEVERITY-004:** Renders S4 with correct background color
- Render: `<SeverityBadge severity="S4" />`
- Assert: `expect(getByTestId('severity-badge')).toHaveStyle({ backgroundColor: '#FBC02D' })`

**SEVERITY-005:** Renders S5 with correct background color
- Render: `<SeverityBadge severity="S5" />`
- Assert: `expect(getByTestId('severity-badge')).toHaveStyle({ backgroundColor: '#558B2F' })`

**SEVERITY-006:** Renders label text when showLabel=true
- Render: `<SeverityBadge severity="S1" showLabel={true} />`
- Assert: `expect(getByText('S1')).toBeInTheDocument()`

**SEVERITY-007:** Does not render label when showLabel=false (default)
- Render: `<SeverityBadge severity="S1" />`
- Assert: `expect(queryByText('S1')).not.toBeInTheDocument()`
- Note: the badge itself must still render; only the text label is absent

---

### 3.2 MachineStateBadge

File: `packages/ui/src/components/MachineStateBadge.test.tsx`

**MSTATE-001:** Renders LIVE with green background when machine_state=LIVE and corpus_hash_verified=true
- Render: `<MachineStateBadge machine_state="LIVE" corpus_hash_verified={true} />`
- Assert: `expect(getByText('LIVE')).toBeInTheDocument()`
- Assert: `expect(getByTestId('machine-state-badge')).toHaveStyle({ backgroundColor: '#388E3C' })`

**MSTATE-002:** Renders amber LIVE—UNVERIFIED pill when machine_state=RECOVERED_BUT_UNTRUSTED (PATCH-009)
- Render: `<MachineStateBadge machine_state="RECOVERED_BUT_UNTRUSTED" corpus_hash_verified={false} />`
- Assert: `expect(getByText('LIVE — UNVERIFIED')).toBeInTheDocument()`
- Assert: `expect(getByTestId('machine-state-badge')).toHaveStyle({ backgroundColor: '#FFF8E1' })`
- Assert: exactly one element with `data-testid="machine-state-badge"` — not two pills

**MSTATE-003:** Renders OFFLINE badge when machine_state=OFFLINE
- Render: `<MachineStateBadge machine_state="OFFLINE" corpus_hash_verified={false} />`
- Assert: `expect(getByText('OFFLINE')).toBeInTheDocument()`
- Assert: `expect(getByTestId('machine-state-badge')).toHaveStyle({ backgroundColor: '#424242' })`

**MSTATE-004:** Renders DEGRADED badge when machine_state=DEGRADED
- Render: `<MachineStateBadge machine_state="DEGRADED" corpus_hash_verified={false} />`
- Assert: `expect(getByText('DEGRADED')).toBeInTheDocument()`
- Assert: `expect(getByTestId('machine-state-badge')).toHaveStyle({ backgroundColor: '#E64A19' })`

**MSTATE-005:** corpus_hash_verified=false with machine_state=LIVE renders UNVERIFIED variant
- Render: `<MachineStateBadge machine_state="LIVE" corpus_hash_verified={false} />`
- Assert: `expect(getByText('LIVE — UNVERIFIED')).toBeInTheDocument()`
- Assert: amber background, not green
- Rationale: a LIVE machine whose corpus is unverified is not trusted — same visual treatment as RECOVERED_BUT_UNTRUSTED

---

### 3.3 HoldToConfirmButton (PATCH-002)

File: `packages/ui/src/components/HoldToConfirmButton.test.tsx`
Setup: `beforeEach(() => vi.useFakeTimers())`, `afterEach(() => vi.useRealTimers())`

**HOLD-001:** onConfirm is NOT called when hold is released before 3000ms
- Render: `<HoldToConfirmButton label="Remove Override" holdDuration={3000} onConfirm={mockConfirm} />`
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(2999)`
- Fire: `fireEvent.mouseUp(button)`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`

**HOLD-002:** onConfirm IS called when hold continues for exactly 3000ms
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(3000)`
- Assert: `expect(mockConfirm).toHaveBeenCalledTimes(1)`
- Note: mouseUp is not required for the confirm to fire at the 3s mark — the timer fires onConfirm internally

**HOLD-003:** onConfirm IS called when hold continues for more than 3000ms
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(5000)`
- Assert: `expect(mockConfirm).toHaveBeenCalledTimes(1)` — called exactly once, not multiple times

**HOLD-004:** Progress arc value matches elapsed time / holdDuration
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(1500)`
- Assert: `expect(getByTestId('hold-progress-arc')).toHaveAttribute('data-progress', '0.5')`
- Note: `data-progress` attribute must reflect `elapsed / holdDuration` (0.0 to 1.0)

**HOLD-005:** mouseup before 3s cancels hold and resets progress
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(1500)`
- Fire: `fireEvent.mouseUp(button)`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`
- Assert: `expect(getByTestId('hold-progress-arc')).toHaveAttribute('data-progress', '0')`

**HOLD-006:** touchend before 3s cancels hold
- Fire: `fireEvent.touchStart(button)`
- Advance: `vi.advanceTimersByTime(2999)`
- Fire: `fireEvent.touchEnd(button)`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`

**HOLD-007:** Disabled prop prevents any hold from starting
- Render: `<HoldToConfirmButton disabled={true} onConfirm={mockConfirm} />`
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(3000)`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`
- Assert: `expect(getByTestId('hold-progress-arc')).toHaveAttribute('data-progress', '0')`

---

### 3.4 SequentialChipSelect (PATCH-001)

File: `packages/ui/src/components/SequentialChipSelect.test.tsx`

Steps fixture:
```ts
const steps = [
  { id: 'step-1', label: 'Confirm venue is L6-eligible' },
  { id: 'step-2', label: 'Confirm no active disputes' },
  { id: 'step-3', label: 'Confirm content sponsor approved' },
]
```

**CHIP-001:** Step 2 is not clickable until Step 1 is confirmed
- Render: `<SequentialChipSelect steps={steps} onAllStepsConfirmed={mockFn} />`
- Assert: `expect(getByTestId('chip-step-2')).toHaveAttribute('aria-disabled', 'true')`
- Fire: `fireEvent.click(getByTestId('chip-step-2'))`
- Assert: `expect(mockFn).not.toHaveBeenCalled()`

**CHIP-002:** Step 3 is not clickable until Step 2 is confirmed
- Fire: click Step 1 (confirms)
- Assert: `expect(getByTestId('chip-step-3')).toHaveAttribute('aria-disabled', 'true')`
- Fire: click Step 3
- Assert: `expect(mockFn).not.toHaveBeenCalled()`

**CHIP-003:** onAllStepsConfirmed is called only after Step 3 is confirmed
- Fire: click Step 1, click Step 2, click Step 3
- Assert: `expect(mockFn).toHaveBeenCalledTimes(1)`

**CHIP-004:** onAllStepsConfirmed is NOT called after Step 1 only
- Fire: click Step 1
- Assert: `expect(mockFn).not.toHaveBeenCalled()`

**CHIP-005:** onAllStepsConfirmed is NOT called after Step 2 only
- Fire: click Step 1, click Step 2
- Assert: `expect(mockFn).not.toHaveBeenCalled()`

**CHIP-006:** [Place Override] button is absent from DOM until all 3 steps confirmed
- Render: `<SequentialChipSelect steps={steps} onAllStepsConfirmed={mockFn} confirmButtonLabel="Place L6 Override" />`
- Initial state: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Step 1: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Steps 1 + 2: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Steps 1 + 2 + 3: `expect(getByRole('button', { name: /Place L6 Override/ })).toBeInTheDocument()`

**CHIP-007:** onReset is called on unmount
- Render component, provide `onReset={mockReset}`
- Confirm all 3 steps
- Unmount (call `unmount()` from render result)
- Assert: `expect(mockReset).toHaveBeenCalledTimes(1)`

**CHIP-008:** Navigating away (unmount) resets all step state
- Render component, confirm Step 1 and Step 2
- Unmount, re-render same component
- Assert: Step 1 chip has `aria-checked=false`, Step 2 chip has `aria-disabled=true`

---

### 3.5 CountdownClock

File: `packages/ui/src/components/CountdownClock.test.tsx`
Setup: `vi.useFakeTimers()` with `vi.setSystemTime(new Date('2026-06-04T10:00:00Z'))`

**CLOCK-001:** Renders amber color when remaining > 24h
- Render: `<CountdownClock expires_at="2026-06-06T10:00:00Z" />` (48h remaining)
- Assert: `expect(getByTestId('countdown-clock')).toHaveStyle({ color: '#F59E0B' })`

**CLOCK-002:** Renders red color when remaining 6h–24h
- Render: `<CountdownClock expires_at="2026-06-04T22:00:00Z" />` (12h remaining)
- Assert: `expect(getByTestId('countdown-clock')).toHaveStyle({ color: '#E64A19' })`

**CLOCK-003:** Renders pulsing red when remaining < 6h
- Render: `<CountdownClock expires_at="2026-06-04T13:00:00Z" />` (3h remaining)
- Assert: `expect(getByTestId('countdown-clock')).toHaveStyle({ color: '#E64A19' })`
- Assert: `expect(getByTestId('countdown-clock')).toHaveClass('pulse-slow')`

**CLOCK-004:** onExpired callback fires when countdown reaches 0
- Render: `<CountdownClock expires_at="2026-06-04T10:00:30Z" onExpired={mockExpired} />` (30s remaining)
- Advance: `vi.advanceTimersByTime(30000)`
- Assert: `expect(mockExpired).toHaveBeenCalledTimes(1)`

**CLOCK-005:** Does not use Date.now() — uses expires_at prop with fake timer
- System time frozen at `2026-06-04T10:00:00Z`
- Render: `<CountdownClock expires_at="2026-06-04T10:00:10Z" />` (10s remaining)
- Assert: `expect(getByTestId('countdown-display')).toHaveTextContent('0:10')`
- Advance: `vi.advanceTimersByTime(5000)`
- Assert: `expect(getByTestId('countdown-display')).toHaveTextContent('0:05')`
- Rationale: if `Date.now()` were used, this test would pass incorrectly when time is faked; use `getByTestId` to confirm display updates with fake timer

**CLOCK-006:** Color threshold transitions on timer advance
- System time frozen at `2026-06-04T10:00:00Z`
- Render: `<CountdownClock expires_at="2026-06-04T15:59:59Z" />` (just under 6h remaining)
- Assert: pulsing red class present
- Render: `<CountdownClock expires_at="2026-06-04T16:00:01Z" />` (just over 6h remaining)
- Assert: pulsing red class absent; red static color present

---

### 3.6 AdvisoryCard (A-NEW-01)

File: `packages/ui/src/components/AdvisoryCard.test.tsx`
Setup: `vi.useFakeTimers()`

**ADVISORY-001:** INFORMATIONAL — no border, no background change, no animation
- Render: `<AdvisoryCard advisory_level="INFORMATIONAL" body="Test advisory" />`
- Assert: `expect(getByTestId('advisory-card')).toHaveStyle({ border: 'none' })`
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`

**ADVISORY-002:** RECOMMENDED — amber border and background
- Render: `<AdvisoryCard advisory_level="RECOMMENDED" body="Test advisory" />`
- Assert: `expect(getByTestId('advisory-card')).toHaveStyle({ border: '2px solid #F59E0B', backgroundColor: '#FFFBEB' })`

**ADVISORY-003:** URGENT — deep-orange border and background
- Render: `<AdvisoryCard advisory_level="URGENT" body="Test advisory" />`
- Assert: `expect(getByTestId('advisory-card')).toHaveStyle({ border: '2px solid #E64A19', backgroundColor: '#FBE9E7' })`

**ADVISORY-004:** URGENT — pulse-once animation class applied on mount
- Render URGENT card
- Assert immediately: `expect(getByTestId('advisory-card')).toHaveClass('pulse-once')`
- Advance timer 800ms
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`

**ADVISORY-005:** URGENT — pulse does NOT re-apply on re-render with same level
- Render URGENT card
- Assert `pulse-once` class present
- Advance timer 800ms — class removed
- Re-render with same props (simulate parent re-render)
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`
- Rationale: pulse fires once per transition, not per render

**ADVISORY-006:** Transition from RECOMMENDED to URGENT fires pulse
- Render `advisory_level="RECOMMENDED"`
- Assert no `pulse-once` class
- Re-render with `advisory_level="URGENT"`
- Assert: `expect(getByTestId('advisory-card')).toHaveClass('pulse-once')`

**ADVISORY-007:** Transition from URGENT to INFORMATIONAL does NOT fire pulse
- Render `advisory_level="URGENT"`, advance timer 800ms (pulse complete)
- Re-render with `advisory_level="INFORMATIONAL"`
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`

---

### 3.7 RejectionToast (A-NEW-04)

File: `packages/ui/src/components/RejectionToast.test.tsx`
Setup: `vi.useFakeTimers()`

**REJECT-001:** CONCURRENCY_CONFLICT — renders toast (not modal), amber border, 8000ms persistence
- Render: `<RejectionToast rejection={makeConflictRejection()} />`
- Assert: `expect(getByTestId('rejection-toast')).toBeInTheDocument()`
- Assert: `expect(queryByTestId('rejection-modal')).not.toBeInTheDocument()`
- Assert: `expect(getByTestId('rejection-toast')).toHaveStyle({ borderColor: '#F59E0B' })`
- Advance timer 7999ms: `expect(getByTestId('rejection-toast')).toBeInTheDocument()`
- Advance timer 1ms more (8000ms total): `expect(queryByTestId('rejection-toast')).not.toBeInTheDocument()`

**REJECT-002:** AUTHORITY_BOUNDARY — renders modal (not toast), is blocking
- Render: `<RejectionToast rejection={makeAuthorityRejection()} />`
- Assert: `expect(getByTestId('rejection-modal')).toBeInTheDocument()`
- Assert: `expect(queryByTestId('rejection-toast')).not.toBeInTheDocument()`
- Assert: `expect(getByRole('button', { name: /Understood/ })).toBeInTheDocument()`
- Assert modal has `role="dialog"` and `aria-modal="true"`

**REJECT-003:** AUTHORITY_BOUNDARY modal does not auto-dismiss
- Render AUTHORITY_BOUNDARY rejection
- Advance timer 60000ms (60 seconds)
- Assert: `expect(getByTestId('rejection-modal')).toBeInTheDocument()`
- Fire: `fireEvent.click(getByRole('button', { name: /Understood/ }))`
- Assert: `expect(queryByTestId('rejection-modal')).not.toBeInTheDocument()`

**REJECT-004:** PRE_CONSTRAINT — toast with amber border and [View PRE state →] link
- Render: `<RejectionToast rejection={makePreConstraintRejection()} />`
- Assert toast present, modal absent
- Assert: `expect(getByTestId('rejection-toast')).toHaveStyle({ borderColor: '#F59E0B' })`
- Assert: `expect(getByRole('link', { name: /View PRE state/ })).toBeInTheDocument()`

**REJECT-005:** REPLAY_MODE — toast with red border, 10000ms persistence, no action button
- Render: `<RejectionToast rejection={makeReplayModeRejection()} />`
- Assert toast present, modal absent
- Assert: `expect(getByTestId('rejection-toast')).toHaveStyle({ borderColor: '#E64A19' })`
- Assert: `expect(queryByRole('button')).not.toBeInTheDocument()`
- Advance timer 9999ms: toast present
- Advance timer 1ms: `expect(queryByTestId('rejection-toast')).not.toBeInTheDocument()`

**REJECT-006:** REPLAY_MODE second occurrence — renders modal with [Open Live Operations →] link
- Render first REPLAY_MODE rejection, advance timer 10s (dismissed)
- Render second REPLAY_MODE rejection
- Assert: `expect(getByTestId('rejection-modal')).toBeInTheDocument()`
- Assert: `expect(getByRole('link', { name: /Open Live Operations/ })).toBeInTheDocument()`

---

### 3.8 TrainingModeBanner (PATCH-006)

File: `packages/ui/src/components/TrainingModeBanner.test.tsx`

**TRAINING-001:** Renders 24px amber strip when training_mode=true
- Render: `<TrainingModeBanner training_mode={true} />`
- Assert: `expect(getByTestId('training-mode-banner')).toBeInTheDocument()`
- Assert: `expect(getByTestId('training-mode-banner')).toHaveStyle({ height: '24px', backgroundColor: '#F59E0B' })`

**TRAINING-002:** Does NOT render when training_mode=false
- Render: `<TrainingModeBanner training_mode={false} />`
- Assert: `expect(queryByTestId('training-mode-banner')).not.toBeInTheDocument()`

**TRAINING-003:** Renders regardless of active surface (chrome-level)
- Render within surface wrapper with `training_mode={true}` and simulate each surface active
- Assert banner present for Live Operations surface
- Assert banner present for Incident Command surface
- Assert banner present for CMS Operations surface
- Assert banner present for Venue Operations surface

---

### 3.9 TabBadge (PATCH-010)

File: `packages/ui/src/components/TabBadge.test.tsx`

**TABBADGE-001:** Red dot renders with correct color
- Render: `<TabBadge type="red" />`
- Assert: `expect(getByTestId('tab-badge')).toHaveStyle({ backgroundColor: '#E64A19' })`

**TABBADGE-002:** Amber dot renders with correct color
- Render: `<TabBadge type="amber" />`
- Assert: `expect(getByTestId('tab-badge')).toHaveStyle({ backgroundColor: '#F59E0B' })`

**TABBADGE-003:** Green dot renders with correct color
- Render: `<TabBadge type="green" />`
- Assert: `expect(getByTestId('tab-badge')).toHaveStyle({ backgroundColor: '#388E3C' })`

**TABBADGE-004:** Does not render when type prop is not provided
- Render: `<TabBadge />`
- Assert: `expect(queryByTestId('tab-badge')).not.toBeInTheDocument()`

---

## 4. Unit Tests — State and Hooks

### 4.1 canPlaceOverride(venue)

File: `packages/state/src/lib/canPlaceOverride.test.ts`

This is a pure function test — no rendering required.

**OVERRIDE-GUARD-001:** Returns false when machine_state === 'RECOVERED_BUT_UNTRUSTED'
- Call: `canPlaceOverride({ machine_state: 'RECOVERED_BUT_UNTRUSTED', corpus_hash_verified: false })`
- Assert: `expect(result).toBe(false)`

**OVERRIDE-GUARD-002:** Returns false when corpus_hash_verified === false regardless of machine_state
- Call: `canPlaceOverride({ machine_state: 'LIVE', corpus_hash_verified: false })`
- Assert: `expect(result).toBe(false)`

**OVERRIDE-GUARD-003:** Returns true only when machine_state === 'LIVE' AND corpus_hash_verified === true
- Call: `canPlaceOverride({ machine_state: 'LIVE', corpus_hash_verified: true })`
- Assert: `expect(result).toBe(true)`

**OVERRIDE-GUARD-004:** Returns false for OFFLINE state
- Call: `canPlaceOverride({ machine_state: 'OFFLINE', corpus_hash_verified: true })`
- Assert: `expect(result).toBe(false)`

**OVERRIDE-GUARD-005:** Returns false for DEGRADED state
- Call: `canPlaceOverride({ machine_state: 'DEGRADED', corpus_hash_verified: true })`
- Assert: `expect(result).toBe(false)`

**OVERRIDE-GUARD-006:** Returns false for INITIALIZING state
- Call: `canPlaceOverride({ machine_state: 'INITIALIZING', corpus_hash_verified: true })`
- Assert: `expect(result).toBe(false)`

**OVERRIDE-GUARD-007:** Returns false for SYNCING state
- Call: `canPlaceOverride({ machine_state: 'SYNCING', corpus_hash_verified: true })`
- Assert: `expect(result).toBe(false)`

---

### 4.2 useReplayGuard()

File: `packages/state/src/hooks/useReplayGuard.test.tsx`

**REPLAY-GUARD-001:** Returns `{ isReplayMode: true }` when ReplayState.is_replay_mode is true
- Render hook within a provider with `replayState = { is_replay_mode: true }`
- Assert: `expect(result.current.isReplayMode).toBe(true)`

**REPLAY-GUARD-002:** Returns `{ isReplayMode: false }` when ReplayState.is_replay_mode is false
- Render hook with `replayState = { is_replay_mode: false }`
- Assert: `expect(result.current.isReplayMode).toBe(false)`

**REPLAY-GUARD-003:** Returns `{ isReplayMode: false }` when outside Replay surface
- Render hook without ReplayState provider (no Replay context)
- Assert: `expect(result.current.isReplayMode).toBe(false)`

---

### 4.3 COMMANDER_LAPSED Countdown

File: `packages/state/src/lib/commanderLapsedTime.test.ts`
Setup: `vi.useFakeTimers()`, `vi.setSystemTime(new Date('2026-06-04T10:05:00Z'))`

**LAPSED-001:** Uses lapsed_at from server payload, not Date.now()
- Call: `computeLapsedDuration({ lapsed_at: '2026-06-04T10:00:00Z' })`
- Assert: `expect(result).toBe(300000)` (5 minutes in ms)
- Rationale: system time is frozen at 10:05:00; lapsed_at is 10:00:00; delta = 5 minutes

**LAPSED-002:** Renders "5 minutes since last commander" at known time delta
- Render: `<CommanderLapsedAlert lapsed_at="2026-06-04T10:00:00Z" />`
  (with system time frozen at 10:05:00)
- Assert: `expect(getByTestId('lapsed-duration')).toHaveTextContent('5 minutes')`

**LAPSED-003:** Does NOT accept fallback to Date.now() when lapsed_at is missing
- Render: `<CommanderLapsedAlert lapsed_at={null} />`
- Assert: `expect(getByTestId('lapsed-duration')).toHaveTextContent('Unknown')`
- Assert: does NOT contain any numeric time value (no `getByText(/\d+ minutes/)`)

---

### 4.4 AutonomyClock

File: `packages/ui/src/components/AutonomyClock.test.tsx`
Setup: `vi.useFakeTimers()`, `vi.setSystemTime(new Date('2026-06-04T10:00:00Z'))`

**AUTONOMY-001:** Derives countdown from autonomy_expires_at prop
- Render: `<AutonomyClock autonomy_expires_at="2026-06-06T10:00:00Z" />` (48h remaining)
- Assert: `expect(getByTestId('autonomy-display')).toHaveTextContent('48h')`

**AUTONOMY-002:** Renders amber when >24h remaining
- Render with 48h remaining
- Assert: `expect(getByTestId('autonomy-clock')).toHaveStyle({ color: '#F59E0B' })`

**AUTONOMY-003:** Renders red when 6–24h remaining
- Render: `<AutonomyClock autonomy_expires_at="2026-06-04T22:00:00Z" />` (12h remaining)
- Assert: `expect(getByTestId('autonomy-clock')).toHaveStyle({ color: '#E64A19' })`

**AUTONOMY-004:** Renders pulsing red when <6h remaining
- Render: `<AutonomyClock autonomy_expires_at="2026-06-04T13:00:00Z" />` (3h remaining)
- Assert: `expect(getByTestId('autonomy-clock')).toHaveClass('pulse-slow')`

**AUTONOMY-005:** Renders "OFFLINE — corpus expired" when countdown reaches 0
- Render: `<AutonomyClock autonomy_expires_at="2026-06-04T10:00:10Z" />` (10s remaining)
- Advance: `vi.advanceTimersByTime(10000)`
- Assert: `expect(getByTestId('autonomy-expired-state')).toHaveTextContent('OFFLINE — corpus expired')`
- Assert: `expect(getByTestId('autonomy-expired-state')).toHaveStyle({ fontWeight: 'bold' })`

**AUTONOMY-006:** Does not use Date.now() — verified by fake timer
- System time frozen at `2026-06-04T10:00:00Z`
- Render: `<AutonomyClock autonomy_expires_at="2026-06-04T10:00:30Z" />` (30s remaining)
- Assert: `expect(getByTestId('autonomy-display')).toHaveTextContent('0:30')`
- Advance: `vi.advanceTimersByTime(15000)`
- Assert: `expect(getByTestId('autonomy-display')).toHaveTextContent('0:15')`

---

## 5. Integration Tests — Surface Workflows

All integration tests render within the full surface context: Router, AuthProvider, WebSocketProvider, MSW handlers active.

### 5.1 Venue Health (Slice 1)

File: `apps/cms/src/surfaces/LiveOps/VenueHealth.integration.test.tsx`

**INT-VENUE-001:** App load sequence renders venue list
- Setup: MSW handlers for GET /operators/me and GET /venues (3 venues)
- Render full LiveOps surface
- Wait for loading to resolve: `await findByTestId('zone-a-venue-list')`
- Assert: `expect(getAllByTestId('venue-list-entry')).toHaveLength(3)`

**INT-VENUE-002:** Click venue loads detail into Zone B
- Setup: GET /venues/{id}/detail handler returning venue with machine_state=LIVE
- Render surface, wait for venue list
- Click first venue entry
- Wait: `await findByTestId('venue-identity-header')`
- Assert: `expect(getByTestId('machine-state-badge')).toHaveTextContent('LIVE')`

**INT-VENUE-003:** VENUE_STATE_UPDATE WS event updates Zone A dot without re-fetch
- Render surface with initial venue list (all LIVE, green dots)
- Fire WS event: `VENUE_STATE_UPDATE` with `{ venue_id: 'venue-1', machine_state: 'OFFLINE' }`
- Assert within same render cycle (no await needed): Zone A entry for venue-1 shows grey/offline dot
- Assert: GET /venues was called exactly once (on load) — no re-fetch triggered by WS event

**INT-VENUE-004:** RECOVERED_BUT_UNTRUSTED venue — full UI state
- Setup: venue with `{ machine_state: 'RECOVERED_BUT_UNTRUSTED', corpus_hash_verified: false }`
- Render and click venue
- Assert Zone A: `expect(getByTestId('venue-1-status-dot')).toHaveClass('status-untrusted')` (orange ↻)
- Assert Zone B badge: `expect(getByTestId('machine-state-badge')).toHaveTextContent('LIVE — UNVERIFIED')`
- Assert override controls absent: `expect(queryByRole('button', { name: /Place Override/ })).not.toBeInTheDocument()`

---

### 5.2 Incident Monitoring (Slice 2)

File: `apps/cms/src/surfaces/IncidentCommand/IncidentMonitoring.integration.test.tsx`

**INT-INCIDENT-001:** INCIDENT_CREATED WS event adds entry to Zone A IncidentList
- Render LiveOps surface
- Fire WS event: `INCIDENT_CREATED` with `{ incident_id: 'inc-1', severity: 'S1', venue_id: 'venue-1' }`
- Assert: `await findByTestId('incident-list-entry-inc-1')`
- Assert: `expect(getByTestId('incident-severity-badge-inc-1')).toHaveStyle({ backgroundColor: '#C62828' })`

**INT-INCIDENT-002:** Click incident loads IC surface
- Setup: GET /incidents/inc-1 handler
- Fire INCIDENT_CREATED, click incident entry
- Assert: `await findByTestId('incident-identity-bar')`
- Assert: severity badge with S1 color, duration timer running, commander field showing "No commander"

**INT-INCIDENT-003:** COMMANDER_LAPSED WS event renders Level 1 alert with PATCH-012 content
- Fire WS event: `COMMANDER_LAPSED` with `{ incident_id: 'inc-1', lapsed_at: '2026-06-04T10:00:00Z' }`
- Assert: `await findByTestId('commander-lapsed-alert')`
- Assert: `expect(getByTestId('lapsed-presence-count')).toBeInTheDocument()` (PATCH-012: shows how many operators are online)
- Assert: `expect(getByRole('link', { name: /Notify all/ })).toBeInTheDocument()`

**INT-INCIDENT-004:** ZONE_B_AUTO_REPLACE WS event (S2) navigates Zone B to IC surface
- Render LiveOps surface viewing venue detail in Zone B
- Fire WS event: `ZONE_B_AUTO_REPLACE` with `{ incident_id: 'inc-2', severity: 'S2', venue_id: 'venue-1' }`
- Assert: `await findByTestId('incident-identity-bar')` (Zone B now shows IC surface)
- Assert: `expect(getByTestId('zone-b-auto-replace-banner')).toBeInTheDocument()` (PATCH-014)

---

### 5.3 Commander Claim (Slice 3)

File: `apps/cms/src/surfaces/IncidentCommand/CommanderClaim.integration.test.tsx`

**INT-CLAIM-001:** [Assume Command] renders AssumeCommandConfirmCard with PATCH-003 context
- Navigate to incident IC surface (no commander)
- Click `[Assume Command]` button
- Assert: `expect(getByTestId('assume-command-confirm-card')).toBeInTheDocument()`
- Assert (PATCH-003 context strip): incident ID, venue name, duration, and severity badge all visible within the card
- Example: `expect(getByTestId('confirm-card-incident-id')).toHaveTextContent('INC-2026-001')`

**INT-CLAIM-002:** Successful claim flow
- Setup: POST /incidents/inc-1/commander/claim returns 200 with operator payload
- Click [Assume Command], click [Confirm]
- Assert: POST was called: `expect(claimHandler).toHaveBeenCalledTimes(1)`
- Fire WS event: `COMMANDER_CLAIMED` with `{ commander: { name: 'Alice', id: 'op-1' } }`
- Assert: `expect(getByTestId('incident-commander-name')).toHaveTextContent('Alice')`

**INT-CLAIM-003:** 409 CONCURRENCY_CONFLICT — toast renders, winner commander shown
- Setup: POST /incidents/inc-1/commander/claim returns 409 with `makeConflictRejection({ winner_commander: { name: 'Bob', id: 'op-2' } })`
- Click [Assume Command], click [Confirm]
- Assert: `await findByTestId('rejection-toast')`
- Assert toast renders within one render cycle (no artificial await)
- Fire WS event: `REJECTION_STATE_PUSH` with updated incident (commander = Bob)
- Assert: `expect(getByTestId('incident-commander-name')).toHaveTextContent('Bob')`

---

### 5.4 L6 Override Placement (Slice 4)

File: `apps/cms/src/surfaces/IncidentCommand/L6Override.integration.test.tsx`

**INT-L6-001:** SequentialChipSelect renders with only Step 1 active on [Place Override +] click
- Navigate to incident IC surface Tab 2 (Intervention Surface)
- Click `[Place Override +]` button
- Assert: `expect(getByTestId('chip-step-1')).toHaveAttribute('aria-disabled', 'false')`
- Assert: `expect(getByTestId('chip-step-2')).toHaveAttribute('aria-disabled', 'true')`
- Assert: `expect(getByTestId('chip-step-3')).toHaveAttribute('aria-disabled', 'true')`

**INT-L6-002:** All 3 steps confirmed → [Place L6 Override] button appears
- Click Step 1, Step 2, Step 3 in sequence
- Assert: `expect(getByRole('button', { name: /Place L6 Override/ })).toBeInTheDocument()`

**INT-L6-003:** POST called with correct payload on [Place L6 Override] click
- Setup: POST /incidents/inc-1/overrides/l6 returns 201
- Complete 3-step sequence, click [Place L6 Override]
- Assert: POST was called with body `{ confirmation_steps_completed: 3 }`

**INT-L6-004:** OVERRIDE_PLACED WS event adds Tab 3 entry with red dot badge
- After successful POST, fire WS event: `OVERRIDE_PLACED` with `{ override_id: 'ov-1', level: 'L6' }`
- Assert: Tab 3 renders new entry
- Assert: `expect(getByTestId('tab-3-badge')).toHaveStyle({ backgroundColor: '#E64A19' })`

**INT-L6-005:** 403 AUTHORITY_BOUNDARY — modal renders, toast does NOT render, interaction blocked
- Setup: POST returns 403 with `makeAuthorityRejection()`
- Complete 3-step sequence, click [Place L6 Override]
- Assert: `await findByTestId('rejection-modal')`
- Assert: `expect(queryByTestId('rejection-toast')).not.toBeInTheDocument()`
- Assert modal has `aria-modal="true"` (blocks background interaction)

---

### 5.5 L6 Override Removal (Slice 4)

File: `apps/cms/src/surfaces/IncidentCommand/L6OverrideRemoval.integration.test.tsx`
Setup: `vi.useFakeTimers()`

**INT-REMOVE-001:** [Remove Override] click renders HoldToConfirmButton
- Render IC surface with active L6 override in Tab 3
- Click `[Remove Override]` for ov-1
- Assert: `expect(getByTestId('hold-to-confirm-button')).toBeInTheDocument()`

**INT-REMOVE-002:** Hold <3s — DELETE not called, button resets
- Click [Remove Override], mousedown on HoldToConfirm
- Advance timer 2999ms, mouseup
- Assert: DELETE /incidents/inc-1/overrides/ov-1 was NOT called
- Assert: `expect(getByTestId('hold-progress-arc')).toHaveAttribute('data-progress', '0')`

**INT-REMOVE-003:** Hold 3s — DELETE called
- Click [Remove Override], mousedown
- Advance timer 3000ms
- Assert: DELETE /incidents/inc-1/overrides/ov-1 called exactly once

**INT-REMOVE-004:** OVERRIDE_REMOVED WS event clears Tab 3 entry and badge
- After DELETE, fire WS event: `OVERRIDE_REMOVED` with `{ override_id: 'ov-1' }`
- Assert: Tab 3 entry for ov-1 absent from DOM
- Assert: `expect(queryByTestId('tab-3-badge')).not.toBeInTheDocument()`

---

### 5.6 CMS Slot Creation (Slice 6)

File: `apps/cms/src/surfaces/CmsOps/SlotCreate.integration.test.tsx`

**INT-SLOT-001:** SlotCreateForm defaults delivery_priority to ROUTINE
- Render SlotCreateForm
- Assert: `expect(getByTestId('delivery-priority-select')).toHaveValue('ROUTINE')`

**INT-SLOT-002:** HIGH_PRIORITY checkbox checked — payload includes HIGH_PRIORITY
- Check the HIGH_PRIORITY checkbox
- Submit form
- Assert: POST payload contains `{ delivery_priority: 'HIGH_PRIORITY' }`

**INT-SLOT-003:** Slot conflict 409 — toast rendered, form not submitted
- Setup: POST /cms/calendar/slots returns 409 with `{ conflict: { name: 'Sponsor Promo' } }`
- Submit form
- Assert: `await findByTestId('rejection-toast')`
- Assert toast text contains "Time slot occupied by Sponsor Promo"
- Assert: form is still visible (not closed after failed submit)

**INT-SLOT-004:** HIGH_PRIORITY slot appears with ★ prefix in calendar grid
- Setup: GET /cms/calendar returns slot with HIGH_PRIORITY
- Render CMS calendar view
- Assert: `expect(getByTestId('calendar-slot-entry')).toHaveTextContent('★')`

---

### 5.7 72h Warning Banners (Slice 6 — A-NEW-02)

File: `apps/cms/src/surfaces/CmsOps/DeliveryWarning.integration.test.tsx`

**INT-DELIVERY-001:** ROUTINE delivery — amber banner, no ★
- Render DeliveryWarningBanner with `{ delivery_priority: 'ROUTINE', event_name: 'Test Event' }`
- Assert: amber banner present
- Assert: `expect(queryByText('★')).not.toBeInTheDocument()`

**INT-DELIVERY-002:** DEGRADED delivery path — amber banner + warning line
- Render with `{ delivery_priority: 'DEGRADED' }`
- Assert: `expect(getByText(/DEGRADED DELIVERY PATH/)).toBeInTheDocument()`

**INT-DELIVERY-003:** HIGH_PRIORITY delivery — star header, deep-orange border, event name visible
- Render with `{ delivery_priority: 'HIGH_PRIORITY', event_name: 'Playoff Finals' }`
- Assert: `expect(getByTestId('delivery-warning-banner')).toHaveStyle({ border: '2px solid #E64A19', backgroundColor: '#FBE9E7' })`
- Assert: `expect(getByText('★')).toBeInTheDocument()`
- Assert: `expect(getByText('Playoff Finals')).toBeInTheDocument()`

---

## 6. Human-Factors Regression Tests

These tests are BLOCKING for any PR that touches affected components. All must pass before merging. HF-REG-003 runs on every commit.

### HF-REG-001 (PATCH-001): SequentialChipSelect cannot be bypassed

File: `test/human-factors/HF-REG-001.test.tsx`

**Test 1a:** Step 3 chip has aria-disabled=true when prior steps not confirmed
- Render SequentialChipSelect (no steps confirmed)
- Assert: `expect(getByTestId('chip-step-3')).toHaveAttribute('aria-disabled', 'true')`
- Fire: `fireEvent.click(getByTestId('chip-step-3'))`
- Assert: `expect(mockFn).not.toHaveBeenCalled()`
- Pass condition: click has no effect; aria-disabled prevents action

**Test 1b:** Step 3 chip does not respond when Step 1 is confirmed but Step 2 is not
- Confirm Step 1 only
- Fire: click Step 3
- Assert: `expect(mockFn).not.toHaveBeenCalled()`

**Test 1c:** [Place L6 Override] button is absent from DOM until all 3 steps confirmed
- Render with `confirmButtonLabel="Place L6 Override"`
- Initial: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Step 1: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Steps 1+2: `expect(queryByRole('button', { name: /Place L6 Override/ })).not.toBeInTheDocument()`
- After Steps 1+2+3: `expect(getByRole('button', { name: /Place L6 Override/ })).toBeInTheDocument()`

---

### HF-REG-002 (PATCH-002): HoldToConfirmButton cannot be triggered by click

File: `test/human-factors/HF-REG-002.test.tsx`
Setup: `vi.useFakeTimers()`

**Test 2a:** Single click (no hold) does not fire onConfirm
- Fire: `fireEvent.click(getByTestId('hold-to-confirm-button'))`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`

**Test 2b:** 2999ms hold does not fire onConfirm
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(2999)`
- Fire: `fireEvent.mouseUp(button)`
- Assert: `expect(mockConfirm).not.toHaveBeenCalled()`

**Test 2c:** Exactly 3000ms hold fires onConfirm once
- Fire: `fireEvent.mouseDown(button)`
- Advance: `vi.advanceTimersByTime(3000)`
- Assert: `expect(mockConfirm).toHaveBeenCalledTimes(1)` — not zero, not two

---

### HF-REG-003 (IC-03): No write controls in DOM during replay mode

File: `test/human-factors/HF-REG-003.test.tsx`
CI: Runs on every commit (not just PR)

**Test 3a:** Render IC surface with `is_replay_mode: true`, assert all write controls absent
- Render IC surface within ReplayStateProvider with `is_replay_mode: true`
- Assert: `expect(queryByRole('button', { name: /Place Override/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Assume Command/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Declare Incident/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Remove Override/ })).not.toBeInTheDocument()`
- Assert: `expect(getByTestId('replay-banner')).toBeInTheDocument()`

**Test 3b:** Transition from live to replay — write controls disappear
- Render IC surface in live mode
- Assert write controls present
- Update ReplayState to `is_replay_mode: true`
- Assert all write controls absent (no page reload)

**Failure condition:** Any write-capable button found in DOM with `is_replay_mode: true` — test fails immediately. Disabled buttons that are still in the DOM are counted as failures (absent, not disabled).

---

### HF-REG-004 (Absent-not-disabled): VIEWER role has no write controls

File: `test/human-factors/HF-REG-004.test.tsx`

**Test 4a:** VIEWER role — all write controls absent from IC surface
- Render IC surface with `operator.role = 'VIEWER'`
- Assert: `expect(queryByRole('button', { name: /Place Override/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Assume Command/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Declare Incident/ })).not.toBeInTheDocument()`
- Assert: `expect(queryByRole('button', { name: /Remove Override/ })).not.toBeInTheDocument()`

**Test 4b:** No disabled write controls in DOM for VIEWER (must be absent, not disabled)
- Render IC surface with VIEWER role
- Query all buttons in the document
- For each button found, assert it does NOT have a name matching any write action pattern
- Rationale: a disabled button that remains in the DOM is still an IC-03 violation — it can be enabled by JavaScript injection or browser developer tools

**Failure condition:** Any element with `disabled` attribute that, if enabled, would constitute a write control — this indicates absent-not-disabled rule was implemented incorrectly.

---

### HF-REG-005 (RECOVERED_BUT_UNTRUSTED): Override controls absent, not disabled

File: `test/human-factors/HF-REG-005.test.tsx`

**Test 5a:** Override controls absent when canPlaceOverride returns false
- Render Intervention Surface with venue `{ machine_state: 'RECOVERED_BUT_UNTRUSTED', corpus_hash_verified: false }`
- Assert: `expect(queryByRole('button', { name: /Place Override/ })).not.toBeInTheDocument()`

**Test 5b:** Intervention surface container exists but contains no write controls
- Assert: `expect(getByTestId('intervention-surface-controls')).toBeInTheDocument()`
- Assert: `expect(queryAllByRole('button')).toHaveLength(0)` within `intervention-surface-controls` scope

**Test 5c:** Write controls appear after venue state transitions to LIVE + verified
- Start with RECOVERED_BUT_UNTRUSTED
- Update venue state to `{ machine_state: 'LIVE', corpus_hash_verified: true }`
- Assert: `expect(getByRole('button', { name: /Place Override/ })).toBeInTheDocument()`

---

### HF-REG-006 (PATCH-009): LIVE—UNVERIFIED renders as single pill

File: `test/human-factors/HF-REG-006.test.tsx`

**Test 6a:** Text is "LIVE — UNVERIFIED" (exact format, em-dash or spaced en-dash per design spec)
- Render: `<MachineStateBadge machine_state="RECOVERED_BUT_UNTRUSTED" corpus_hash_verified={false} />`
- Assert: `expect(getByText('LIVE — UNVERIFIED')).toBeInTheDocument()`
- Assert: NOT `getByText('LIVE')` as separate element
- Assert: NOT `getByText('UNTRUSTED')` as separate element

**Test 6b:** Amber background (not green)
- Assert: `expect(getByTestId('machine-state-badge')).toHaveStyle({ backgroundColor: '#FFF8E1' })`
- Assert: `expect(getByTestId('machine-state-badge')).not.toHaveStyle({ backgroundColor: '#388E3C' })`

**Test 6c:** Exactly one badge element
- Assert: `expect(getAllByTestId('machine-state-badge')).toHaveLength(1)`

---

### HF-REG-007 (PATCH-012): COMMANDER_LAPSED notify cooldown enforced

File: `test/human-factors/HF-REG-007.test.tsx`
Setup: `vi.useFakeTimers()`

**Test 7a:** First click fires POST
- Render CommanderLapsedAlert with POST /incidents/inc-1/notify handler
- Click `[Notify all →]`
- Assert: POST called once

**Test 7b:** Second click within 60s cooldown is suppressed
- After first click, advance timer 30000ms (30s)
- Click `[Notify all →]` again
- Assert: POST still called only once total

**Test 7c:** Click after 60s fires POST again
- Advance timer to 60001ms total
- Click `[Notify all →]`
- Assert: POST called exactly twice total

---

### HF-REG-008 (A-NEW-01): Advisory URGENT pulse fires once, not continuously

File: `test/human-factors/HF-REG-008.test.tsx`
Setup: `vi.useFakeTimers()`

**Test 8a:** Pulse class applied on transition to URGENT
- Render INFORMATIONAL
- Re-render URGENT
- Assert: `expect(getByTestId('advisory-card')).toHaveClass('pulse-once')`

**Test 8b:** Pulse class removed after 800ms
- After transition to URGENT, advance timer 800ms
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`

**Test 8c:** Re-render with same URGENT level does NOT re-add pulse
- After pulse completes (800ms elapsed)
- Re-render with same `advisory_level="URGENT"`
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-once')`

**Test 8d:** Pulse class is single-fire, not continuous
- After transition to URGENT
- Assert: `expect(getByTestId('advisory-card')).not.toHaveClass('pulse-continuous')`
- Advance timer 5000ms
- Assert class still absent (no oscillation)

---

### HF-REG-009 (A-NEW-04): No silent write rejections

File: `test/human-factors/HF-REG-009.test.tsx`

Each subtest renders a write flow, mocks the API to return a rejection, and asserts the correct visible UI response within one render cycle. "Within one render cycle" means using `await findByTestId(...)` without artificial delays.

**Test 9a:** CONCURRENCY_CONFLICT → toast rendered
- Mock POST to return 409 `makeConflictRejection()`
- Submit write action
- Assert: `await findByTestId('rejection-toast')`
- Assert: `expect(queryByTestId('rejection-modal')).not.toBeInTheDocument()`

**Test 9b:** AUTHORITY_BOUNDARY → modal rendered (not toast)
- Mock POST to return 403 `makeAuthorityRejection()`
- Submit write action
- Assert: `await findByTestId('rejection-modal')`
- Assert: `expect(queryByTestId('rejection-toast')).not.toBeInTheDocument()`

**Test 9c:** PRE_CONSTRAINT → toast rendered with [View PRE state →] link
- Mock POST to return 422 `makePreConstraintRejection()`
- Submit write action
- Assert: `await findByTestId('rejection-toast')`
- Assert: `expect(getByRole('link', { name: /View PRE state/ })).toBeInTheDocument()`

**Test 9d:** REPLAY_MODE → toast rendered with red border
- Mock POST to return 403 `makeReplayModeRejection()`
- Submit write action
- Assert: `await findByTestId('rejection-toast')`
- Assert: `expect(getByTestId('rejection-toast')).toHaveStyle({ borderColor: '#E64A19' })`

**Test 9e:** All rejection types — pending loading state cleared
- For each rejection type: submit action, mock rejection response
- Assert: `expect(queryByTestId('loading-spinner')).not.toBeInTheDocument()`
- Assert: `expect(queryByTestId('pending-indicator')).not.toBeInTheDocument()`
- Rationale: a stuck loading spinner is a silent failure in UI — operator cannot tell if the action is still pending

---

### HF-REG-010 (Zone B auto-replace): PATCH-014 orientation banner required

File: `test/human-factors/HF-REG-010.test.tsx`

**Test 10a:** ZONE_B_AUTO_REPLACE causes Zone B surface change
- Render LiveOps surface showing venue detail in Zone B
- Fire WS event: `ZONE_B_AUTO_REPLACE` with `{ incident_id: 'inc-5', severity: 'S2', venue_id: 'venue-1' }`
- Assert: `await findByTestId('incident-identity-bar')` (Zone B now IC surface)

**Test 10b:** PATCH-014 orientation banner is present and has correct text
- After ZONE_B_AUTO_REPLACE event
- Assert: `expect(getByTestId('zone-b-auto-replace-banner')).toBeInTheDocument()`
- Assert: `expect(getByTestId('zone-b-auto-replace-banner')).toHaveTextContent('You were automatically brought here')`

**Test 10c:** Prior surface is saved in UIState
- Assert: prior_surface is accessible via UIState context: `expect(uiState.priorZoneBSurface).toBe('venue-detail')`
- Assert: `[View Venue Dashboard →]` link renders within the orientation banner
- Click link: assert Zone B navigates back to venue detail

---

## 7. Realtime Event Tests (MSW WebSocket)

File: `test/realtime/WebSocketEvents.integration.test.tsx`

All tests use MSW WebSocket handler. Events are fired via `server.emit(eventType, payload)`. Tests wrap renders in the standard WebSocketProvider.

### 7.1 VENUE_STATE_UPDATE

**WS-VENUE-001:** machine_state change updates Zone A dot in same render cycle
- Render surface with venue in LIVE state
- Fire: `VENUE_STATE_UPDATE` with `{ venue_id: 'v1', machine_state: 'OFFLINE', sequence_number: 42 }`
- Assert (no await): `expect(getByTestId('v1-status-dot')).toHaveClass('status-offline')`

**WS-VENUE-002:** Stale event (sequence_number < current) is discarded
- Setup venue with `sequence_number: 50` in state
- Fire: `VENUE_STATE_UPDATE` with `{ sequence_number: 49, machine_state: 'OFFLINE' }`
- Assert: status dot remains LIVE (no state change)

**WS-VENUE-003:** REJECTION trigger — 300ms highlight pulse on entity
- Fire: `VENUE_STATE_UPDATE` with `{ triggered_by: 'REJECTION', venue_id: 'v1' }`
- Assert: `expect(getByTestId('v1-venue-entry')).toHaveClass('highlight-pulse')`
- Advance timer 300ms
- Assert: `expect(getByTestId('v1-venue-entry')).not.toHaveClass('highlight-pulse')`

---

### 7.2 ADVISORY_UPDATE (A-NEW-01)

**WS-ADVISORY-001:** INFORMATIONAL advisory — no border change in Zone C Pane C4
- Fire: `ADVISORY_UPDATE` with `{ advisory_level: 'INFORMATIONAL' }`
- Assert: `expect(getByTestId('pane-c4-advisory')).not.toHaveStyle({ border: '2px solid #F59E0B' })`

**WS-ADVISORY-002:** RECOMMENDED advisory — amber border applied
- Fire: `ADVISORY_UPDATE` with `{ advisory_level: 'RECOMMENDED' }`
- Assert: `expect(getByTestId('pane-c4-advisory')).toHaveStyle({ border: '2px solid #F59E0B' })`

**WS-ADVISORY-003:** URGENT advisory — deep-orange border + single 800ms pulse
- Setup: `vi.useFakeTimers()`
- Fire: `ADVISORY_UPDATE` with `{ advisory_level: 'URGENT' }`
- Assert: `expect(getByTestId('pane-c4-advisory')).toHaveStyle({ border: '2px solid #E64A19' })`
- Assert: `expect(getByTestId('pane-c4-advisory')).toHaveClass('pulse-once')`
- Advance 800ms: `expect(getByTestId('pane-c4-advisory')).not.toHaveClass('pulse-once')`

---

### 7.3 REJECTION_STATE_PUSH

**WS-REJECT-001:** Entity state updates on REJECTION_STATE_PUSH
- Fire: `REJECTION_STATE_PUSH` with `{ entity_type: 'incident', entity_id: 'inc-1', current_state: { commander: { name: 'Carol' } } }`
- Assert: `expect(getByTestId('incident-commander-name')).toHaveTextContent('Carol')`

**WS-REJECT-002:** 300ms gold highlight pulse applied to affected entity
- Setup: `vi.useFakeTimers()`
- Fire: `REJECTION_STATE_PUSH` with `{ entity_id: 'inc-1' }`
- Assert: `expect(getByTestId('incident-inc-1-row')).toHaveStyle({ backgroundColor: '#FBC02D' })`
- Advance 300ms: `expect(getByTestId('incident-inc-1-row')).not.toHaveStyle({ backgroundColor: '#FBC02D' })`

**WS-REJECT-003:** Scroll position not reset on REJECTION_STATE_PUSH
- Render Zone B with known scroll position (scroll to bottom of long list)
- Record scroll: `const scrollTop = container.scrollTop`
- Fire: `REJECTION_STATE_PUSH` event
- Assert: `expect(container.scrollTop).toBe(scrollTop)` (unchanged)

---

### 7.4 COLLABORATOR_POSITION throttle

**WS-COLLAB-001:** 5 events within 1000ms → only 2 position updates processed
- Setup: `vi.useFakeTimers()`, position update mock
- Fire 5 `COLLABORATOR_POSITION` events for operator-1 within 800ms
- Advance timer 1000ms
- Assert: collaborator position updated at most 2 times (throttle rate: 2 updates/second)
- Pass condition: `expect(positionUpdateMock).toHaveBeenCalledTimes(2)` — tolerance ±1 for throttle implementation variance

---

## 8. E2E Tests (Playwright)

E2E tests require a running test environment. Use Docker Compose integration stack. Run nightly and on PRs to main.

Configuration: `playwright.config.ts` with `baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000'`

---

### E2E-001: Full Incident Lifecycle

File: `e2e/full-incident-lifecycle.spec.ts`

**Sequence:**
1. Login as OPERATOR role
2. Navigate to LiveOps — venue list renders
3. Declare incident from venue detail (S2 severity)
4. Navigate to incident in Zone A IncidentList
5. Click [Assume Command] — AssumeCommandConfirmCard renders
6. Confirm — commander set to current operator
7. Navigate to Tab 2 (Intervention Surface)
8. Complete 3-step SequentialChipSelect
9. Click [Place L6 Override] — override POST fires
10. Verify override appears in Tab 3 with red dot
11. Click [Remove Override] — HoldToConfirmButton renders
12. Hold for 3 seconds — DELETE fires
13. Verify Tab 3 entry removed and red dot cleared
14. Close incident via close flow
15. Verify incident removed from Zone A IncidentList

**Pass condition:** All 15 steps complete without error; Zone A reflects state changes throughout.

---

### E2E-002: Concurrent Commander Claim Conflict

File: `e2e/concurrent-commander-conflict.spec.ts`

**Sequence:**
1. Open two browser contexts (A and B), both logged in as different OPERATOR accounts
2. Both navigate to the same incident (no commander)
3. Both render AssumeCommandConfirmCard within 500ms of each other
4. Both click [Confirm] — one succeeds, one receives 409 CONCURRENCY_CONFLICT

**Pass conditions:**
- Exactly one context succeeds — commander set to the winning operator
- The losing context: rejection toast renders within 3 seconds of the 409 response
- Both contexts: `getByTestId('incident-commander-name')` shows the same winning operator within 3 seconds
- Neither context: is stuck in a loading state after 5 seconds

---

### E2E-003: Zone B Auto-Replace + Orientation Banner

File: `e2e/zone-b-auto-replace.spec.ts`

**Sequence:**
1. Login as OPERATOR — navigate to venue detail in Zone B (LiveOps surface)
2. Backend declares S1 incident on that venue (via API call in test setup)
3. Wait for Zone B to update

**Pass conditions:**
- Zone B replaces with IC surface within 3 seconds of incident declaration (no page reload)
- PATCH-014 orientation banner present: `getByTestId('zone-b-auto-replace-banner')` contains "You were automatically brought here"
- Clicking `[View Venue Dashboard →]` within the banner returns Zone B to venue detail within 1 second

---

### E2E-004: RECOVERED_BUT_UNTRUSTED → LIVE Transition

File: `e2e/machine-state-transition.spec.ts`

**Setup:** Venue fixture starts in RECOVERED_BUT_UNTRUSTED state

**Sequence:**
1. Login as OPERATOR — click RECOVERED_BUT_UNTRUSTED venue
2. Verify initial state:
   - Zone A dot: orange ↻ indicator
   - Zone B badge: "LIVE — UNVERIFIED" amber pill
   - Override controls: absent from DOM
3. Backend updates venue to `{ machine_state: 'LIVE', corpus_hash_verified: true }`

**Pass conditions:**
- Within 2 seconds (without page refresh):
  - Zone A dot changes to green
  - Zone B badge changes to "LIVE" with green background
  - Override controls appear in Intervention Surface (Tab 2)
- No controls flicker (no transition through enabled→disabled→enabled)

---

### E2E-005: CMS HIGH_PRIORITY 72h Warning

File: `e2e/cms-high-priority.spec.ts`

**Sequence:**
1. Login as CONTENT_MANAGER role
2. Navigate to CMS Operations surface
3. Create new content slot with HIGH_PRIORITY delivery priority
4. Submit slot creation form

**Pass conditions:**
- Calendar grid: slot entry displays with ★ prefix
- Slot detail view: deep-orange banner with `border: 2px solid #E64A19` and background `#FBE9E7`
- Slot detail view: `[⚠ Submit anyway]` button present (indicating confirmed awareness of warning)
- Event name visible within the banner

---

## 9. Test Coverage Requirements (Non-Negotiable)

### 9.1 Component Coverage

- **All components in `@clubhub/ui`:** 100% of exported components have at minimum 5 unit tests
- Any exported component with fewer than 5 tests causes CI to fail with the message: `[Coverage] ${componentName} has ${count} tests — minimum 5 required`
- Coverage is measured per component file, not per package overall

### 9.2 Human-Factors Regression Gate

- **HF-REG-001 through HF-REG-010:** All must pass before any PR to main is merged
- These tests run in a dedicated CI stage: `13-hf-regression`
- Stage 13 is merge-blocking — PRs cannot merge if stage 13 is red
- A PR that disables, skips, or `.only`s any HF-REG test is treated as a stage 13 failure

### 9.3 IC-03 Gate

- **HF-REG-003 specifically:** Runs on every commit, not just PRs
- CI stage: `00-ic03-guard` — runs before all other stages
- If HF-REG-003 fails, no other CI stages run — the pipeline stops immediately
- Rationale: IC-03 is a constitutional constraint. A broken IC-03 implementation must not proceed to integration or deployment.

### 9.4 E2E Gate

- Concurrent conflict tests (E2E-002): run nightly at 02:00 UTC
- All other E2E tests: run on PRs to main and nightly
- E2E test failures on PRs to main are merge-blocking
- E2E test failures on nightly are paged to on-call (not auto-blocking, but require triage within 24h)

### 9.5 Line Coverage Targets

| Package | Target | Enforced |
|---------|--------|----------|
| `@clubhub/ui` | 80% line coverage | CI merge gate |
| `@clubhub/state` | 80% line coverage | CI merge gate |
| `apps/cms` | 70% line coverage | Advisory (not blocking) |

Coverage is measured by Vitest (`v8` provider). Reports output to `coverage/` directory. CI uploads coverage to artifact storage for historical tracking.

---

## 10. MSW Handler Setup

### 10.1 Handler File Structure

```
test/
  msw/
    handlers/
      auth.ts
      venues.ts
      incidents.ts
      cms.ts
      rejections.ts
    websocket.ts
    server.ts          # Node.js test server setup
    browser.ts         # Browser/Playwright setup
```

### 10.2 handlers/auth.ts

```ts
// GET /operators/me
// Returns operator fixture by role (controlled via request header X-Test-Role)
// Roles: 'OPERATOR' | 'CONTENT_MANAGER' | 'VIEWER' | 'PLATFORM_ADMIN'
// Usage: set X-Test-Role header in test setup

export const authHandlers = [
  http.get('/operators/me', ({ request }) => {
    const role = request.headers.get('X-Test-Role') ?? 'OPERATOR'
    return HttpResponse.json(makeOperatorFixture(role))
  }),
]
```

Fixture shape:
```ts
interface OperatorFixture {
  id: string
  name: string
  role: 'OPERATOR' | 'CONTENT_MANAGER' | 'VIEWER' | 'PLATFORM_ADMIN'
  training_mode: boolean
  permissions: string[]
}
```

### 10.3 handlers/venues.ts

```ts
// GET /venues — returns array of venue summaries
// GET /venues/:id/detail — returns full venue object
// POST /venues/:id/corpus-status/verify — returns corpus verification result

export const venueHandlers = [
  http.get('/venues', () => HttpResponse.json(venueListFixture)),
  http.get('/venues/:id/detail', ({ params }) => {
    const venue = venueDetailFixtures[params.id]
    if (!venue) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(venue)
  }),
  http.post('/venues/:id/corpus-status/verify', ({ params }) => {
    return HttpResponse.json({ verified: true, corpus_hash: 'abc123' })
  }),
]
```

Venue detail fixture includes:
- `machine_state`: 'LIVE' | 'OFFLINE' | 'DEGRADED' | 'RECOVERED_BUT_UNTRUSTED' | 'INITIALIZING' | 'SYNCING'
- `corpus_hash_verified`: boolean
- `autonomy_expires_at`: ISO string
- `sequence_number`: number

### 10.4 handlers/incidents.ts

```ts
// GET /incidents/active — returns active incidents array
// GET /incidents/:id — returns full incident object
// PATCH /incidents/:id — update incident
// POST /incidents/:id/commander/claim — claim commander role
// DELETE /incidents/:id/commander — release commander
// POST /incidents/:id/overrides/l6 — place L6 override
// DELETE /incidents/:id/overrides/:overrideId — remove override

export const incidentHandlers = [
  http.get('/incidents/active', () => HttpResponse.json(activeIncidentsFixture)),
  http.get('/incidents/:id', ({ params }) => {
    const incident = incidentFixtures[params.id]
    if (!incident) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(incident)
  }),
  http.post('/incidents/:id/commander/claim', () =>
    HttpResponse.json(commanderClaimSuccessFixture, { status: 200 })
  ),
  http.post('/incidents/:id/overrides/l6', () =>
    HttpResponse.json(l6OverridePlacedFixture, { status: 201 })
  ),
  http.delete('/incidents/:id/overrides/:overrideId', () =>
    new HttpResponse(null, { status: 204 })
  ),
]
```

### 10.5 handlers/cms.ts

```ts
// GET /cms/calendar — returns calendar slot array
// POST /cms/calendar/slots — create new slot
// GET /cms/delivery-confidence — returns delivery confidence assessment

export const cmsHandlers = [
  http.get('/cms/calendar', () => HttpResponse.json(calendarFixture)),
  http.post('/cms/calendar/slots', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(makeSlotCreatedFixture(body), { status: 201 })
  }),
  http.get('/cms/delivery-confidence', () =>
    HttpResponse.json(deliveryConfidenceFixture)
  ),
]
```

### 10.6 handlers/rejections.ts

Factory functions for each rejection type. Import these in tests that mock API failures.

```ts
export function makeConflictRejection(overrides?: Partial<ConflictRejection>): ConflictRejection {
  return {
    rejection_type: 'CONCURRENCY_CONFLICT',
    message: 'Another operator claimed command simultaneously',
    winner_commander: { id: 'op-other', name: 'Other Operator' },
    ...overrides,
  }
}

export function makeAuthorityRejection(overrides?: Partial<AuthorityRejection>): AuthorityRejection {
  return {
    rejection_type: 'AUTHORITY_BOUNDARY',
    message: 'Your role does not permit this action',
    required_role: 'OPERATOR',
    ...overrides,
  }
}

export function makePreConstraintRejection(overrides?: Partial<PreConstraintRejection>): PreConstraintRejection {
  return {
    rejection_type: 'PRE_CONSTRAINT',
    message: 'PRE resolution blocked this action',
    pre_state_url: '/pre/state/current',
    constraint_id: 'C-001',
    ...overrides,
  }
}

export function makeReplayModeRejection(overrides?: Partial<ReplayModeRejection>): ReplayModeRejection {
  return {
    rejection_type: 'REPLAY_MODE',
    message: 'Writes are blocked during replay mode',
    live_operations_url: '/live-ops',
    ...overrides,
  }
}
```

Usage pattern in tests:

```ts
server.use(
  http.post('/incidents/:id/commander/claim', () =>
    HttpResponse.json(makeConflictRejection(), { status: 409 })
  )
)
```

### 10.7 WebSocket handler (websocket.ts)

```ts
// MSW WebSocket handler for simulating server push events in tests
// Usage: server.emit(eventType, payload) to fire an event to the connected client

import { ws } from 'msw'

export const websocketHandler = ws.link('ws://localhost:3001/ws')

// Helper: emit a typed event to all connected clients
export function emitWebSocketEvent(
  server: typeof websocketHandler,
  eventType: WebSocketEventType,
  payload: Record<string, unknown>
): void {
  server.broadcast(JSON.stringify({ type: eventType, payload }))
}

// Event types:
// 'VENUE_STATE_UPDATE' | 'INCIDENT_UPDATE' | 'INCIDENT_CREATED' |
// 'COMMANDER_LAPSED' | 'ZONE_B_AUTO_REPLACE' | 'OVERRIDE_PLACED' |
// 'OVERRIDE_REMOVED' | 'ADVISORY_UPDATE' | 'REJECTION_STATE_PUSH' |
// 'DELIVERY_STATE_UPDATE' | 'COMMANDER_CLAIMED' | 'COLLABORATOR_POSITION'
```

### 10.8 Test server setup (server.ts)

```ts
import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/auth'
import { venueHandlers } from './handlers/venues'
import { incidentHandlers } from './handlers/incidents'
import { cmsHandlers } from './handlers/cms'
import { websocketHandler } from './websocket'

export const server = setupServer(
  ...authHandlers,
  ...venueHandlers,
  ...incidentHandlers,
  ...cmsHandlers,
  websocketHandler,
)

// In vitest.setup.ts:
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// afterEach(() => server.resetHandlers())
// afterAll(() => server.close())
```

Note: `onUnhandledRequest: 'error'` is mandatory. Any test that triggers an unhandled request fails immediately. This prevents tests from silently reaching a real network endpoint.

---

## 11. Test Infrastructure Notes

### 11.1 Vitest Configuration

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    fakeTimers: { shouldAdvanceTime: false }, // explicit: tests must call vi.advanceTimersByTime()
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80, // enforced for @clubhub/ui and @clubhub/state
      },
    },
  },
})
```

### 11.2 RTL Render Wrapper

All surface-level tests must wrap renders with the standard test wrapper:

```ts
// test/render-utils.tsx
export function renderWithProviders(
  ui: ReactElement,
  options: {
    role?: OperatorRole
    trainingMode?: boolean
    replayState?: Partial<ReplayState>
    initialRoute?: string
  } = {}
): RenderResult {
  const { role = 'OPERATOR', trainingMode = false, replayState = {}, initialRoute = '/' } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider initialRole={role}>
          <ReplayStateProvider initialState={{ is_replay_mode: false, ...replayState }}>
            <TrainingModeProvider initialValue={trainingMode}>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </TrainingModeProvider>
          </ReplayStateProvider>
        </AuthProvider>
      </MemoryRouter>
    ),
  })
}
```

### 11.3 Test Data IDs

All testable UI elements must have `data-testid` attributes. The convention:
- `data-testid="component-name"` for primary element: `data-testid="severity-badge"`
- `data-testid="entity-id-slot"` for list items: `data-testid="venue-list-entry-v1"`
- `data-testid="component-sub-element"` for child elements: `data-testid="hold-progress-arc"`

Components that do not expose `data-testid` attributes are not testable and must be updated before their first test is written. This is a code review gate: PR that adds a component without `data-testid` on testable elements is blocked.

### 11.4 CI Stage Mapping

| CI Stage | Tests Included | Blocking |
|----------|---------------|---------|
| `00-ic03-guard` | HF-REG-003 only | Every commit, hard stop |
| `11-unit` | All unit tests (~120) | Every commit |
| `12-integration` | All integration tests (~80) | Every commit |
| `13-hf-regression` | HF-REG-001–010 (~40) | Every PR to main |
| `14-e2e-pr` | E2E-001, 003, 004, 005 | PRs to main |
| `15-e2e-nightly` | All E2E including E2E-002 (concurrent) | Nightly |
