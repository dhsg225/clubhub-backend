# PRE Boundary

## MAY
- Read SystemStateSnapshot input (passed in by caller)
- Run all resolution levels (LEVEL_0 through LEVEL_6)
- Run invariant checks on its own output
- Compute playlist checksum (FNV-1a 32-bit)
- Produce PRE_Output with deterministic content
- Throw InvariantViolationError if invariants fail

## MUST NOT
- Call any external service or database
- Mutate input state
- Read from environment variables
- Produce non-deterministic output for identical inputs
- Silence invariant violations
- Produce output without running invariant checks

## MUST NEVER KNOW ABOUT
- Shadow runner or comparison logic
- Entropy state, scores, or advisory tiers
- Audit records or replay audit writer
- Runtime circuit breakers
- Canary stage or promotion status
- API request context or HTTP layer
- Constitutional state machine
- Failure injection or chaos runner

## ALLOWED EMISSIONS
- None — PRE is a pure function. It does not emit telemetry directly.
- Callers (runtime layer) emit telemetry about PRE invocations.

## ALLOWED DEPENDENCIES
- src/pre/types (own types)
- src/pre/algorithms (fnv1a32, canonicalize-json)
- src/pre/invariants (own invariant definitions only)
- src/pre/resolvers (own resolver implementations)
