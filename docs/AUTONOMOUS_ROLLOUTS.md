# Autonomous Rollouts

`backend/src/lib/autonomous-rollout.js`

Evidence-driven ring promotion evaluation. Produces a structured recommendation
but does NOT call `store.promoteRing()`. The caller retains responsibility for
actually executing the promotion after reviewing the outcome.

## Evaluation Criteria

`evaluatePromotion(opts)` feeds the following snapshot to `policyEngine.evaluatePolicy('rollout_promotion', ...)`:

| Field | Source | Blocking Threshold |
|-------|--------|--------------------|
| `consensusStatus` | fleet-consensus | SPLIT_BRAIN or AUTHORITY_LOSS → DENY |
| `authorityLeaseSafe` | distributed-authority | false → DENY |
| `fleetSuccessRate` | caller metrics | < 98% → DENY |
| `desyncCount` | caller metrics | > 0 → DENY |
| `observationElapsedMs` vs `observationWindowMs` | caller | elapsed < window → DENY |
| `ringHealthScore` | caller metrics | < 0.85 → DENY |

All checks must pass for `ALLOW`. The first failing check short-circuits evaluation.

## Outcome States

| Outcome | When |
|---------|------|
| `PROMOTE` | policy returns ALLOW |
| `HOLD` | DENY: observation window not elapsed, or non-consensus DENY reason |
| `FREEZE` | DENY: consensus not safe or no authority lease; or policy returns FREEZE |
| `ROLLBACK` | DENY: fleet success below floor AND recoveryFailures > 2 |
| `REQUIRE_REVIEW` | policy returns ESCALATE |

## Evidence Snapshots

Both `evaluatePromotion` and `evaluateRollback` return a frozen `evidence_snapshot`
containing the full input metrics, thresholds reference, and timing at the moment of
evaluation. This snapshot is immutable and can be stored for audit purposes.

## Policy Engine Integration

`autonomous-rollout.js` requires the caller to pass `opts.policyEngine` (the
policy-engine module). It does not import policy-engine directly, enabling
injection in tests. If `opts.policyEngine` is absent, both functions throw.

## Promotion Blocking Conditions (summary)

1. No consensus or authority lease
2. Fleet success rate below 98%
3. Any screen in desync
4. Observation window not elapsed
5. Ring health score below 0.85

Any of these conditions produces a non-PROMOTE outcome.

## Invariants

- `evidence_snapshot` is frozen with `Object.freeze` — callers cannot mutate it.
- No DB access or side effects — pure evaluation.
- `policyEngine` reference is required; missing it throws immediately.
- Every evaluation produces a full `policy_decision` envelope from the policy engine.

## Limitations

- Does NOT automatically advance the ring — manual or explicit caller action required.
- `recoveryFailures` threshold for ROLLBACK (> 2) is hardcoded, not loaded from thresholds.json.
- `ringHealthScore` floor (0.85) and `fleetSuccessRate` floor (98) are in policy-engine.js,
  not in thresholds.json — they are not contract-governed threshold values.
- `evaluateRollback` returns outcome `PROMOTE` when ALLOW (confusing naming — means "proceed").
