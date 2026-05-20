# Incident Orchestration

`backend/src/lib/incident-orchestrator.js`

Coordinates severe runtime incidents into governed operational states. Each
incident has a lifecycle enforced by a legal transition table. Illegal transitions
throw synchronously.

## Incident States

```
DETECTED → TRIAGED → MITIGATING → FROZEN → RECOVERING → RESOLVED → POSTMORTEM_REQUIRED
```

## Legal Transitions

| From | To |
|------|----|
| DETECTED | TRIAGED, POSTMORTEM_REQUIRED |
| TRIAGED | MITIGATING, FROZEN, POSTMORTEM_REQUIRED |
| MITIGATING | FROZEN, RECOVERING, RESOLVED, POSTMORTEM_REQUIRED |
| FROZEN | RECOVERING, POSTMORTEM_REQUIRED |
| RECOVERING | RESOLVED, POSTMORTEM_REQUIRED |
| RESOLVED | POSTMORTEM_REQUIRED |
| POSTMORTEM_REQUIRED | (terminal — no further transitions) |

## Severity Levels

`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

## incident_id Format

`inc-XXXXXX` — sequential hex, e.g. `inc-000001`.

## Policy Integration

`createIncident()` calls `policyEngine.evaluatePolicy('operator_override', ...)` to
record the creation decision. The resulting `policy_id` is stored in
`incident.policy_evaluations[]`. If policyEngine is absent or throws, the incident
is still created (non-fatal).

## Auto-Triage for HIGH / CRITICAL

Incidents created with `severity === 'HIGH'` or `severity === 'CRITICAL'` are
automatically transitioned from `DETECTED` to `TRIAGED` before `createIncident()`
returns. `operator_id` is set to `'system'` for this auto-transition.

## Resolution Paths

`resolveIncident(incident_id, opts)` transitions to either:
- `RESOLVED` — if `opts.postmortem_required` is falsy
- `POSTMORTEM_REQUIRED` — if `opts.postmortem_required` is truthy

`POSTMORTEM_REQUIRED` is terminal — no further transitions are allowed.

## live-incidents.json Format

Written by `saveReport(dir)`:
```json
{
  "generated_at": "...",
  "total": 5,
  "active": 2,
  "by_severity": { "LOW": 1, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 1 },
  "by_state": { "DETECTED": 0, "TRIAGED": 1, ... },
  "incidents": [ /* array of full incident records */ ]
}
```

## Incident Record Shape

```
{
  incident_id, type, severity, description, state,
  created_at, updated_at, causal_chain,
  related_policy_decision_id, root_cause,
  linked_freeze,       // true if incident transitioned through FROZEN
  linked_recovery_id,  // reserved; not yet populated
  policy_evaluations,  // array of policy_id strings
  state_history,       // [{from, to, at, operator_id, justification, evidence}]
  resolution_summary, postmortem_required
}
```

## Invariants

- Illegal transitions throw — no silent state skipping.
- `POSTMORTEM_REQUIRED` is terminal — `transition()` will throw if attempted from it.
- `linked_freeze` is set to true when transitioning to FROZEN state.
- All transitions are recorded in `state_history` with timestamp.

## Limitations

- In-memory only — incidents are lost on process restart unless `saveReport()` is called.
- No DB persistence in current implementation (`pool` parameter is reserved but unused).
- `linked_recovery_id` is always null — recovery correlation is not yet implemented.
- `transition()` requires callers to supply `justification`; it does not enforce
  this (no throw on missing justification for non-ledger transitions).
- Operator ledger entries use `rollout_freeze` action type for all transitions,
  regardless of actual transition type — this is a simplification.
