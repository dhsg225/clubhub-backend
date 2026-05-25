# Runtime Boundary

## MAY
- Call PRE.resolve() with a constructed SystemStateSnapshot
- Receive PRE_Output (by contract only)
- Invoke shadow comparison and receive comparison results
- Read audit records for response construction
- Manage circuit breakers (PRE, entropy, shadow, replay)
- Manage the global constitutional breaker
- Drive the constitutional state machine
- Emit telemetry about PRE invocations, shadow comparisons, state transitions
- Route requests to legacy resolver when PRE is disabled
- Classify failures using runtime-failure-guards
- Serve responses to API layer

## MUST NOT
- Import from PRE internals (resolvers, algorithms) — only call PRE.resolve()
- Modify shadow comparison logic
- Write directly to audit log (use audit writer interface)
- Bypass circuit breaker checks
- Serve PRE output when global constitutional breaker is not NORMAL
- Auto-reset the global constitutional breaker without human authorization

## MUST NEVER KNOW ABOUT
- PRE resolver internals or resolution algorithm details
- Shadow canary promotion decision logic
- Entropy calculation internals
- Audit storage implementation details

## ALLOWED EMISSIONS
- PREInvocationLog
- PREResolutionLog
- ShadowComparisonLog
- RollbackTriggerLog
- FailureEventLog
- CircuitBreakerLog
- StateTransitionLog
- DegradationEventLog
- ConstitutionalFreezeLog
- ConstitutionalBreachLog

## ALLOWED DEPENDENCIES
- src/pre (public interface: resolve() only)
- src/shadow (comparison results, by contract)
- src/audit (writer interface)
- src/observability (logger, metrics, telemetry-schemas)
- src/failure-injection (failure guards, classification)
- src/runtime (own modules: circuit-breakers, state-machine)
