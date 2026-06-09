# Recovery Governance

**Enforcement location:** `test-runner/lib/recovery-governor.js`
**State domain:** `recovery` (in `test-runner/lib/state-authority.js`)
**Contract check:** `validate-contracts.js` check 16 — `recovery_governance`

---

## What it is

Recovery behavior in the test runner is governed, not ad-hoc. Every recovery action:

- Receives a unique `recovery_id` (`rec-XXXXXX`)
- Emits governed mutations through the `recovery` state domain
- Records `recovery_duration_ms`, `recovery_attempts`, `impacted_domains`, `causal_chain`, and `recovery_strategy`
- Escalates to a defined policy outcome — never silently loops

---

## Recovery categories

| Category | Escalation | Max Retries | Backoff Base |
|---|---|---|---|
| `backend_restart` | RETRYABLE | 3 | 2 s |
| `db_restart` | RETRYABLE | 3 | 5 s |
| `network_outage` | RETRYABLE | 5 | 1 s |
| `screen_desync` | MANUAL_INTERVENTION_REQUIRED | 0 | — |
| `stalled_rollout` | MANUAL_INTERVENTION_REQUIRED | 0 | — |
| `manifest_timeout` | RETRYABLE | 3 | 1 s |
| `replay_divergence` | FATAL | 0 | — |

**RETRYABLE** categories retry with deterministic exponential backoff:
```
backoff_ms = min(base_ms × 2^(attempt-1), max_backoff_ms)
```

**MANUAL_INTERVENTION_REQUIRED** — escalated immediately; no auto-retry. Surfaced in `reports/recovery-governance.json`.

**FATAL** — `failRecovery()` throws `Error` immediately, halting the current suite.

---

## State machine (`recovery` domain)

```
IDLE → STARTED → COMPLETED       (success path)
                → FAILED → STARTED   (retry, if RETRYABLE and under max_retries)
                         → ESCALATED (max retries exceeded or MANUAL/FATAL)
                → ESCALATED          (FATAL or MANUAL_INTERVENTION_REQUIRED)
```

Illegal transitions throw `IllegalTransitionError` via `assertLegalTransition()`.

---

## API

```js
const governor = new RecoveryGovernor(clock, thresholds);

// Start a governed recovery
const recovery_id = governor.startRecovery('backend_restart', {
  impacted_domains: ['chaos', 'metrics'],
  causal_chain:     [...],
  suite:            'chaos',
});

// On success
governor.completeRecovery(recovery_id);

// On failure
const { shouldRetry, backoff_ms, escalated } = governor.failRecovery(recovery_id, err);
if (shouldRetry) {
  await governor.wait(backoff_ms);
  // retry the recovery action...
}

// Save governance report
governor.saveReport(reportsDir);  // → reports/recovery-governance.json
```

---

## Governed thresholds

Recovery timeout thresholds are read from `thresholds.json`:

| Category | Threshold key |
|---|---|
| `backend_restart` | `recovery.backend_restart_ms` |
| `db_restart` | `recovery.db_restart_ms` |
| `network_outage` | `recovery.network_outage_recovery_ms` |

`governor.thresholdFor(category)` returns the configured threshold (ms) or `null` if absent. Callers compare actual recovery duration against this value.

---

## Output: `reports/recovery-governance.json`

```json
{
  "generated_at": "...",
  "total_recoveries": 3,
  "completed": 2,
  "escalated": 1,
  "active": 0,
  "categories_used": ["backend_restart", "db_restart"],
  "recoveries": [...]
}
```

Written by `runner.js` at the end of every run, including the `finally` block.

---

## Invariants

1. Every recovery that starts must complete, fail, or escalate — no silent abandonment.
2. All recovery state transitions go through `applyMutation()` — they appear in the mutation log.
3. Retry count is bounded: `RETRYABLE` categories have a hardcoded `max_retries`; once exceeded, escalation is mandatory.
4. Exponential backoff uses integer arithmetic — deterministic across runs given the same attempt count.
5. `validate-contracts.js` check 16 fails if any of the 7 categories is absent from the governor.

---

## Limitations

- `RecoveryGovernor.wait(ms)` delegates to `Promise + setTimeout` — timing is not governed in `deterministic` clock mode. Tests that need deterministic timing must advance the clock manually and call `completeRecovery()` without relying on `wait()`.
- The governor is not wired into the chaos suites by default. Suites call `chaos.waitForHealth()` directly. The governor is available for higher-level recovery orchestration in future passes.
- `MANUAL_INTERVENTION_REQUIRED` escalation surfaces in the JSON report but does not send external notifications in the current implementation.
