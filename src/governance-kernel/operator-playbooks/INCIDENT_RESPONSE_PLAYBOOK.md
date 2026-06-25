# INCIDENT_RESPONSE_PLAYBOOK.md
# Operator Playbook — Incident Response

## Preconditions
- Kernel is ACTIVE or FROZEN
- Operator has OPERATOR role minimum
- Anomaly detected (error rate, failed heartbeats, config drift alert)

## Required authority
- Role: OPERATOR (create, transition) / ADMIN (no additional requirement)

## Commands

```bash
# 1. Check active incidents:
GET /api/ota-runtime/incidents
Authorization: Bearer <token>

# 2. Create incident:
POST /api/ota-runtime/incidents
{ "type": "DEPLOYMENT_FAILURE", "severity": "HIGH",
  "causal_chain": { "correlation_id": "rollout-xyz", "caused_by": "ring1_regression" },
  "justification": "Ring-1 error rate 15% above baseline for 5min" }

# 3. Transition to TRIAGED:
POST /api/ota-runtime/incidents/<id>/transition
{ "to_state": "TRIAGED", "reason": "Root cause identified: bad artifact hash" }

# 4. Transition to MITIGATING:
POST /api/ota-runtime/incidents/<id>/transition
{ "to_state": "MITIGATING", "reason": "Rollback initiated" }

# 5. Resolve (LINEARIZED — use linearized=true for critical):
POST /api/ota-runtime/incidents/<id>/transition
{ "to_state": "RESOLVED", "reason": "Rollback complete, error rate normal", "linearized": true }

# 6. Archive:
POST /api/ota-runtime/incidents/<id>/archive
{ "justification": "Incident resolved and verified closed" }
```

## Expected events
- `governance.incident.detected` → `triaged` → `mitigating` → `resolved` → `archived`
- Each transition produces AuditLedger entry

## Rollback procedures
- Incident states: DETECTED → TRIAGED → MITIGATING → RESOLVED (cannot go backward)
- If wrongly created: archive immediately with justification

## Failure escalation
- MAX_ACTIVE_INCIDENTS (500) reached: `governance.incident.overflow` event emitted
- Archive resolved incidents first: `POST /incidents/<id>/archive`
- If DB unreachable: `transition()` uses CACHE_COHERENT; use `linearized: true` when DB recovers

## Replay implications
- All incident state transitions are replayable via `ReplayTimeline`
- `ForensicView.buildIncidentReport(id, events)` reconstructs causal chain from lineage
- Incident ID is content-addressed — same causal chain produces same ID in replay

## Certification implications
- No certification impact from normal incident lifecycle
- Archive resolved incidents regularly to stay within MAX_ACTIVE_INCIDENTS bound
