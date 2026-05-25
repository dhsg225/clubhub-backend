# ClubHub TV — Degradation Chain

Shows the ordered degradation sequence with transition triggers.

```
HEALTHY
  │
  │  Trigger: PRE latency > 200ms p95 (no output error)
  ▼
CLASS_1 (Performance Degradation)
  │
  │  PRE output remains correct — no state machine change
  │  System stays in HEALTHY constitutional state
  │
  │  Trigger: shadow/entropy/audit subsystem unavailable
  ▼
CLASS_2 (Partial Subsystem Failure)
  │
  │  Constitutional state → DEGRADED
  │  PRE continues; non-PRE subsystems degraded
  │
  │  Trigger: invariant violation, replay divergence, parity < 0.999
  ▼
CLASS_3 (Constitutional Violation — Recoverable)
  │
  │  Constitutional state → CONSTITUTIONAL_RISK → PRE_DISABLED
  │  Canary halted; legacy path only; human review required
  │
  │  Trigger: corpus corruption, replay nondeterminism,
  │           emergency precedence failure (INV-7),
  │           CLASS_4 shadow divergence
  ▼
CLASS_4 (Catastrophic System Failure)
  │
  │  Constitutional state → READ_ONLY
  │  Auto-halt canary; all-stop on merges; P0 incident
  │  No auto-recovery — human intervention required
  │
  │  Trigger: CLASS_4 active + emergency active simultaneously,
  │           OR corpus integrity unverifiable
  ▼
CLASS_5 (System Halt / Emergency Freeze)
  │
  │  Constitutional state → EMERGENCY_FREEZE
  │  No PRE; no shadow; no canary; no operator writes
  │  Serve LEVEL_0 or LEVEL_5 only
  │
  └── EXIT: explicit human authorization token required
```

## Transition Triggers Summary

| From | To | Trigger |
|------|-----|---------|
| HEALTHY | CLASS_1 | PRE latency > 200ms p95 |
| HEALTHY | CLASS_2 | Any subsystem (shadow/entropy/audit) unavailable |
| HEALTHY/CLASS_2 | CLASS_3 | Invariant violation or parity < 0.999 |
| CLASS_3 | CLASS_4 | Corpus corruption, replay nondeterminism, INV-7 |
| CLASS_4 | CLASS_5 | CLASS_4 + active emergency, or corpus integrity unverifiable |

## Recovery Path

CLASS_5 → CLASS_4 → CLASS_3 → CLASS_2 → HEALTHY

Each step requires explicit human authorization and investigation sign-off.
No automatic recovery from CLASS_3 or above.
