# Replay Boundary

## MAY
- Load corpus packets from storage
- Execute PRE.resolve() with corpus input
- Compare actual output hash to expected output hash
- Classify divergence class for each packet
- Emit replay pass/fail/complete telemetry
- Write replay audit records
- Verify corpus packet hashes
- Run determinism checks (same packet, multiple runs)

## MUST NOT
- Modify corpus packets
- Suppress replay failures
- Continue replay as trusted when hash verification fails
- Serve replay results as production responses
- Run in production request path (replay is verification-only)

## MUST NEVER KNOW ABOUT
- Shadow comparison results
- Entropy scores or advisory tiers
- Runtime circuit breaker state
- Canary stage or promotion status
- Constitutional state machine

## ALLOWED EMISSIONS
- ReplayPassLog
- ReplayFailLog
- ReplayRunCompleteLog
- ReplayAuditWriteLog
- ConstitutionalBreachLog (for corpus integrity failures)

## ALLOWED DEPENDENCIES
- src/pre (public interface: resolve() only)
- src/audit (replay audit writer interface)
- src/verification (corpus loader, hash verification)
- src/observability (logger, metrics, telemetry-schemas)
