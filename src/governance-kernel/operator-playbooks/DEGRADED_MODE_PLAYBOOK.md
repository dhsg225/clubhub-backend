# DEGRADED_MODE_PLAYBOOK.md
# Operator Playbook — Degraded Mode

## Preconditions
- Kernel node has entered DEGRADED state (DB unreachable, advisory lock failure, or authority partial failure)
- Operator has OPERATOR role

## Required authority
- Role: OPERATOR (monitoring, emergency freeze) / ADMIN (recovery actions)

## Commands

```bash
# 1. Check current state:
GET /api/ota-runtime/runtime/snapshot
# Look for: lifecycle.state === 'DEGRADED', health.warnings[]

# 2. Apply emergency freeze (MEMORY_ONLY) if deployment is running:
POST /api/ota-runtime/deployment/freeze
{ "reason": "DB unreachable — precautionary freeze", "justification": "Node entered DEGRADED; halting deployment mutations" }
# freezeLocal() is applied automatically when DB is unreachable

# 3. Monitor DB recovery — when DB available:
GET /api/ota-runtime/runtime/status
# Verify frozen state via DB_AUTHORITATIVE check

# 4. Confirm freeze with DB after recovery:
POST /api/ota-runtime/deployment/freeze
{ "reason": "Confirming emergency freeze via DB", "justification": "DB recovered; confirming MEMORY_ONLY freeze with LINEARIZED freeze" }
```

## Expected events
- `governance.runtime.lifecycle_changed` (ACTIVE → DEGRADED)
- `governance.runtime.freeze_local` if emergency freeze applied
- `governance.authority.freeze_committed` on DB recovery + freeze confirmation

## Rollback procedures
- After DB recovery: transition lifecycle DEGRADED → RECOVERING → ACTIVE
- Verify epoch and freeze state match between both cluster nodes
- Check AuditLedger integrity: `auditLedger.verifyIntegrity()`

## Failure escalation
- Both nodes DEGRADED simultaneously: DB primary failure — infrastructure-level intervention required
- MEMORY_ONLY freeze does not propagate to other node: confirm freeze on second node too

## Replay implications
- DEGRADED events recorded in event bus with `lineage_ts`
- Post-recovery forensic replay can show the degradation window

## Certification implications
- DEGRADED state does not affect certification
- Re-run `certifyRuntime()` after full recovery to confirm all checks still PASS
