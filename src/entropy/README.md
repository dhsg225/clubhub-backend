# src/entropy/ — Entropy Runtime Calculators

## Constitutional Role

Implements M-01 through M-12 operational health metrics, the Entropy Score composite,
the Staleness Index, and the daily batch runner.

Defined in: `docs/OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md`

## Ownership

**Owner:** Platform team
**Write policy:** PR + one reviewer.

## Critical Constraint — Advisory Only

Entropy calculators are **advisory instruments only**. They:
- MUST NOT write to configuration tables (screens, overrides, schedules, campaigns, sponsorships)
- MUST NOT trigger cache invalidation
- MUST NOT emit config-changing events
- MUST NOT automatically expire, delete, or modify any configuration record

Violations of this constraint are Forbidden Pattern FP-13 (automatic corrective behavior).

## Directory Structure

```
entropy/
├── calculators/          # m01-override-divergence.ts through m12-screen-staleness.ts
├── staleness-index.ts    # Staleness Index formula (4 classes A–D)
├── entropy-score.ts      # Composite [0,100] scorer with normalization
├── batch-runner.ts       # Daily 03:00 local-time batch orchestrator
└── types.ts              # EntropyMetric, EntropySnapshot, StalenessClass
```

## Calculation Cadence

- Daily batch at 03:00 venue local time
- Results written to `venue_health_snapshots` table only
- Historical retention: 90 daily snapshots per venue
