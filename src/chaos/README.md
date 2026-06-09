# src/chaos/ — Chaos Runtime Architecture

## Constitutional Role

Implements executable chaos scenarios that verify PRE graceful degradation under failure
conditions. Each scenario:
1. Sets up preconditions
2. Injects a failure
3. Asserts invariants hold during failure
4. Recovers
5. Asserts invariants hold after recovery
6. Tears down

Defined in: `docs/VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8`

## Ownership

**Owner:** Platform team
**Write policy:** PR + one reviewer.

## Scenarios

| File | Failure Type | Key Assertion |
|------|-------------|---------------|
| `scenarios/db-restart.ts` | Database connection loss | PRE returns LEVEL_6 device truth; no crash |
| `scenarios/backend-restart.ts` | Process restart | State recovers without config loss |
| `scenarios/poll-storm.ts` | 10x normal poll rate | p95 latency ≤ 500ms; no duplicate resolution |
| `scenarios/cache-loss.ts` | manifest_cache cleared | Fresh resolution correct within 5s |
| `scenarios/clock-skew.ts` | System clock ±15min | DST-adjacent resolution still correct |
| `scenarios/partition.ts` | Network partition | Degraded mode; player uses last delivery |

## Chaos Principle

Chaos verifies **graceful degradation**, not uptime perfection. The system is allowed to
degrade. It is not allowed to produce incorrect output, crash unrecoverably, or violate
constitutional invariants while degraded.
