# ClubHub TV — Failure Taxonomy

## CLASS_0 — Normal Operation
Allowed: all subsystems active, PRE deterministic, entropy healthy, shadow parity >= 0.999
Forbidden: nothing
Telemetry: INFO
PRE fallback: none required
Replay: all packets replayable

## CLASS_1 — Performance Degradation
Definition: PRE resolution latency > 200ms p95, but output correct
Allowed: serve PRE output with degraded latency warning
Forbidden: skip invariant checks to recover latency
Telemetry: ADVISORY
PRE fallback: none
Replay: unaffected

## CLASS_2 — Partial Subsystem Failure
Definition: shadow/entropy/audit unavailable, but PRE path operational
Allowed: PRE continues serving; shadow/entropy/audit may be degraded
Forbidden: disabling shadow silently (must emit telemetry)
Telemetry: WARNING
PRE fallback: none — PRE must not fall back due to CLASS_2
Replay: unaffected; audit gaps must be logged

## CLASS_3 — Constitutional Violation (Recoverable)
Definition: invariant violation detected, corpus replay divergence, CLASS_3 shadow divergence
Allowed: halt canary; alert operator; continue serving legacy path
Forbidden: continue serving PRE output after CLASS_3 is confirmed
Telemetry: CONSTITUTIONAL_BREACH
PRE fallback: LEVEL_5 system fallback minimum
Replay: affected packets must be flagged for investigation
Shadow: halt canary advancement; do not auto-rollback

## CLASS_4 — Catastrophic System Failure
Definition: CLASS_4 shadow divergence, corpus corruption, replay harness nondeterminism, emergency precedence failure
Allowed: auto-halt canary; all-stop on new merges; serve legacy only
Forbidden: serving PRE output, continuing replay as trusted, silencing alerts
Telemetry: CATASTROPHIC
PRE fallback: LEVEL_5 always during CLASS_4
Shadow: immediate canary halt (auto-executable for CLASS_4 only)

## CLASS_5 — System Halt / Emergency Freeze
Definition: active emergency override + CLASS_4 simultaneously, or corpus integrity unverifiable
Allowed: serve system fallback only; accept no new operator writes
Forbidden: any PRE resolution; any shadow comparison; any canary activity
Telemetry: CATASTROPHIC + alert all sinks
PRE fallback: LEVEL_0 emergency or LEVEL_5 system fallback only
