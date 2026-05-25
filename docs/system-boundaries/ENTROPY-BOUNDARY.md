# Entropy Boundary

## MAY
- Compute per-screen and per-venue entropy scores
- Label entropy results (healthy / advisory / review)
- Assign advisory tiers based on composite score
- Emit entropy batch, metric, and escalation events
- Schedule periodic entropy computation jobs
- Provide advisory tier data to runtime for informational use

## MUST NOT
- Block or modify PRE resolution based on entropy state
- Alter shadow canary decisions
- Write to audit records
- Access replay corpus
- Make routing decisions

## MUST NEVER KNOW ABOUT
- PRE resolver internals or PRE_Output structure beyond what is needed for metric computation
- Shadow comparison results or canary stage
- Audit records or replay audit log
- Runtime circuit breaker state
- Constitutional state machine

## ALLOWED EMISSIONS
- EntropyBatchLog
- EntropyMetricLog
- EntropyMetricDetailLog
- EntropyScoreDetailLog
- AdvisoryEscalationLog
- EntropyJobLog

## ALLOWED DEPENDENCIES
- src/entropy (own modules: calculators, labeling, advisory-tier, venue-runner, fleet-runner)
- src/observability (logger, metrics, telemetry-schemas)
