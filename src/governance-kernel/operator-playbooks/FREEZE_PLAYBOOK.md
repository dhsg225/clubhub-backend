# FREEZE_PLAYBOOK.md
# Operator Playbook — Freeze Deployment

## Preconditions
- Kernel is ACTIVE
- Operator has OPERATOR or ADMIN role
- DB is reachable (for LINEARIZED freeze)

## Required authority
- Role: OPERATOR minimum
- Token: valid, non-revoked Bearer token

## Commands

```bash
# 1. Verify current freeze state (DB_AUTHORITATIVE):
GET /api/ota-runtime/runtime/status
Authorization: Bearer <token>

# 2. Execute freeze:
POST /api/ota-runtime/deployment/freeze
Authorization: Bearer <token>
{ "reason": "suspected rollout regression in ring-1", "justification": "Ring-1 error rate 12% above baseline" }

# Expected response:
{ "ok": true, "frozen": true }
```

## Expected events
- `governance.authority.freeze_committed` on kernel event bus
- `governance.runtime.lifecycle_changed` (ACTIVE → FROZEN)
- AuditLedger entry with action_type `deployment_frozen`

## Rollback procedures
- To unfreeze: requires ADMIN role
- `POST /api/ota-runtime/deployment/unfreeze` with `reason` and `justification`
- Verify with `GET /runtime/status` that `frozen: false`

## Failure escalation
- If DB unreachable: `freezeLocal()` is applied automatically (MEMORY_ONLY)
- Confirm with full freeze once DB recovers
- Emergency freeze log visible at `GET /runtime/snapshot`

## Replay implications
- Freeze event is recorded in event bus with `lineage_ts`
- Replay of events including this freeze will show `freeze_confirmed` state
- Operators can forensically inspect the freeze epoch via `ReplayTimeline`

## Certification implications
- Freeze does not affect certification status
- Post-freeze: `FreezeIntegrityCertification` still PASS (freeze is expected behavior)
