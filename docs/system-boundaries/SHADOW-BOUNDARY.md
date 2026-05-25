# Shadow Boundary

## MAY
- Run legacy resolver with same input as PRE
- Compare legacy output to PRE output
- Classify divergences by class (0–4)
- Record parity scores in parity window
- Emit parity divergence telemetry
- Gate canary promotion based on parity threshold
- Read canary stage configuration
- Halt canary advancement on CLASS_3 or CLASS_4 divergence

## MUST NOT
- Modify PRE output or legacy output before comparison
- Advance canary stage without meeting parity threshold
- Suppress divergence telemetry for any divergence class
- Allow rollback without emitting RollbackTriggerLog
- Auto-advance canary when constitutional state is not HEALTHY or DEGRADED

## MUST NEVER KNOW ABOUT
- Entropy internal state, scores, or advisory tiers
- Audit records or audit storage
- Runtime circuit breaker state
- Failure injection or chaos runner internals
- Constitutional state machine transitions

## ALLOWED EMISSIONS
- ParityDivergenceLog
- CanaryGateLog
- ShadowComparisonLog
- RollbackTriggerLog

## ALLOWED DEPENDENCIES
- src/pre (output types only — PRE_Output)
- src/shadow (own modules: comparison, canary, parity-window, rollback)
- src/observability (logger, metrics, telemetry-schemas)
