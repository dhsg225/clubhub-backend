# Policy Engine

`backend/src/lib/policy-engine.js`

A deterministic runtime policy decision engine. Every governance decision passes
through `evaluatePolicy()` and is recorded in the in-memory `_decisions` array.

## What it is

A pure, synchronous evaluation layer. Given a named policy and an input object,
it produces a frozen decision envelope. It has no DB dependency and no async I/O.
All state is module-level (`_decisions`). Call `resetDecisions()` between tests.

## 6 Named Policies

| Policy | Key Inputs | Possible Decisions |
|--------|-----------|-------------------|
| `rollout_promotion` | consensusStatus, authorityLeaseSafe, fleetSuccessRate, desyncCount, observationElapsedMs, observationWindowMs, ringHealthScore | ALLOW, DENY |
| `rollout_freeze` | trigger, consensusStatus, currentState | FREEZE |
| `rollout_rollback` | trigger, adoptionPct, recoveryFailures | ALLOW (rollback proceeds), FREEZE |
| `recovery_escalation` | category, attempts, maxRetries, escalationPolicy | ALLOW, ESCALATE |
| `operator_override` | action, justification, operatorId | DENY, REQUIRE_OPERATOR_APPROVAL |
| `manifest_rejection` | reason, screenId, manifestHash | FREEZE (integrity_failure), DENY |

## Decision States

- `ALLOW` — action may proceed
- `DENY` — action blocked; `reason_codes` explain why
- `FREEZE` — rollout must freeze; no further ring advancement
- `ESCALATE` — human review required before proceeding
- `REQUIRE_OPERATOR_APPROVAL` — policy cannot auto-approve; needs human sign-off

## Decision Envelope Fields

```
{
  policy_id,        // pol-XXXXXXXX (sequential hex)
  policy_name,      // named policy used
  input_snapshot,   // frozen deep copy of input at evaluation time
  input_hash,       // SHA-256 of stableStringify(input)[0:16]
  decision,         // ALLOW | DENY | FREEZE | ESCALATE | REQUIRE_OPERATOR_APPROVAL
  reason_codes,     // array of strings explaining decision
  evidence_refs,    // optional array of references
  evaluated_at,     // ISO-8601 timestamp
  caused_by,        // optional: policy_id that triggered this evaluation
  policy_hash,      // SHA-256 of {policy_name, input_hash, decision, reason_codes}[0:16]
}
```

## policy_hash Computation

```js
sha256(stableStringify({ policy_name, input_hash, decision, reason_codes }))[0:16]
```

This allows replay verification: given the same policy name, input, and output,
the hash is deterministic.

## policy-decisions.json Format

Written by `saveDecisions(reportsDir)`:
```json
{
  "generated_at": "...",
  "decisions": [ /* array of decision envelopes */ ]
}
```

## Invariants

- Input is always frozen before evaluation; policy cannot mutate its input.
- `evaluatePolicy` is synchronous and has no side effects beyond `_decisions.push`.
- `policy_id` is sequential within process lifetime; resets on `resetDecisions()`.
- Every decision is recorded even if the caller ignores it.

## Limitations

- In-memory only — decisions are lost on process restart unless `saveDecisions()` is called.
- Sequential IDs are not globally unique across multiple instances.
- No DB persistence; distributed deployments need to call `saveDecisions()` explicitly.
- Policy logic is not hot-reloadable; changing policy requires process restart.
