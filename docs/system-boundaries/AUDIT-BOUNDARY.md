# Audit Boundary

## MAY
- Accept and store replay audit records (written by replay harness)
- Accept and store runtime invocation records (written by runtime layer)
- Provide read access to audit records for observability and reporting
- Emit audit write telemetry

## MUST NOT
- Block PRE resolution if audit write fails (PRE path is not audit-dependent)
- Modify records after initial write
- Expose raw audit storage internals to callers
- Perform any resolution or routing logic

## MUST NEVER KNOW ABOUT
- PRE resolver internals
- Shadow comparison logic
- Entropy calculation details
- Circuit breaker state
- Constitutional state machine transitions

## ALLOWED EMISSIONS
- ReplayAuditWriteLog

## ALLOWED DEPENDENCIES
- src/audit (own modules: writer, storage)
- src/observability (logger, metrics, telemetry-schemas)
