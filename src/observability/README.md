# src/observability/ — Observability Bootstrap

## Constitutional Role

Provides the structured logging, metrics, and correlation ID infrastructure used by all
constitutional systems. These are contracts — other modules emit to these; no module
implements its own logging.

Defined in: `docs/EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13`

## Ownership

**Owner:** Any engineer
**Write policy:** PR + one reviewer.

## Files

| File | Purpose |
|------|---------|
| `logger.ts` | Structured JSON logger with required fields and severity levels |
| `metrics.ts` | Prometheus-compatible counter/gauge/histogram emitters |
| `correlation.ts` | request_id + replay_id propagation across async boundaries |
| `telemetry-schemas.ts` | Type definitions for all structured log line shapes |

## Log Severity Levels

`INFO` → `ADVISORY` → `WARNING` → `ERROR` → `CONSTITUTIONAL_BREACH` → `CATASTROPHIC`

`CONSTITUTIONAL_BREACH` and `CATASTROPHIC` MUST trigger immediate alert emission.

## Metric Namespaces

- `clubhub_pre_*` — PRE invocation metrics
- `clubhub_replay_*` — Replay harness metrics
- `clubhub_invariant_*` — Invariant assertion metrics
- `clubhub_entropy_*` — Entropy score metrics
- `clubhub_chaos_*` — Chaos scenario metrics
- `clubhub_parity_*` — Shadow-mode parity metrics
