# FAILURE_MODE_GUIDE.md
# Governance Kernel — Failure Mode Guide

---

## DB failure policies

```javascript
const DB_FAILURE_POLICIES = {
  FAIL_CLOSED: 'FAIL_CLOSED',  // freeze on DB loss (safest)
  FAIL_OPEN:   'FAIL_OPEN',    // continue on DB loss (risky)
  STALE_OK:    'STALE_OK',     // use stale state on DB loss
};
```

**HARD recommendation:** Use `FAIL_CLOSED` in production. `FAIL_OPEN` is only safe if your operations are idempotent and non-destructive.

---

## Failure modes by component

### FreezeController

| Failure | DB Policy | Behavior |
|---------|-----------|----------|
| `freeze(reason, pool)` fails — DB unreachable | FAIL_CLOSED | `freezeLocal(reason)` as fallback; must confirm with `freeze()` on DB recovery |
| `isFrozenStrong(pool)` fails — DB unreachable | Any | Returns last CACHE_COHERENT value; stale indicator shown |
| `isFrozen()` — DB unreachable | N/A | Returns in-memory flag (MEMORY_ONLY) |

### IncidentManager

| Failure | Behavior |
|---------|----------|
| `create()` fails — DB connection error | Throws; incident not created |
| `transitionStrong()` fails — advisory lock timeout | Throws; state unchanged |
| MAX_ACTIVE_INCIDENTS reached | `create()` returns overflow sentinel; `INCIDENT.OVERFLOW` event emitted |
| `archiveResolved()` fails | Non-fatal; incidents remain in active list |

### AuditLedger

| Failure | Behavior |
|---------|----------|
| `appendEntry()` fails | Non-fatal catch; operation proceeds; gap in audit trail |
| `appendLinearized()` fails | Throws; caller must handle |
| Hash chain integrity check fails | `verifyIntegrity()` returns false; manual investigation required |

### ConfigAuthority

| Failure | Behavior |
|---------|----------|
| `update()` called while config is frozen | Throws `'GovernedConfig is frozen'` |
| `update()` called without justification | Throws |
| DB persist fails after `update()` | Fire-and-forget; in-memory config is updated but DB is not |
| Singleton not initialized | `update()` throws `'ConfigAuthority: governed-config singleton not initialized'` |

### OperatorAuthority

| Failure | Behavior |
|---------|----------|
| Token expired | `verifyToken()` returns `{ valid: false, reason: 'token_expired' }` |
| Token signature invalid | `verifyToken()` returns `{ valid: false, reason: 'invalid_signature' }` |
| JTI revoked | `verifyToken()` returns `{ valid: false, reason: 'jti_revoked' }` |
| `OPERATOR_SECRET_KEY` not set | Uses dev fallback; logs warning |

---

## Recovery procedures

### After DB reconnect
1. `freezeController.isFrozenStrong(pool)` — re-establish freeze truth
2. `authorityCoordinator.incrementEpoch()` — confirm epoch is current (if needed)
3. `incidentManager.init(pool)` — reload active incidents
4. `auditLedger.save()` — persist any buffered ledger entries

### After MEMORY_ONLY emergency freeze
1. DB becomes reachable
2. Call `freezeDeployment(reason, pool, opts)` to confirm with DB
3. Emergency freeze log entries are appended to AuditLedger
4. `emergencyFreezeLog` cleared

### After split-brain detected
1. Do NOT auto-resolve
2. Use `isFrozenStrong(pool)` to establish ground truth
3. Identify which node has the authoritative epoch (higher value)
4. Restart the stale node or force epoch sync via ADMIN command
5. `clearSplitBrain()` + snapshot refetch on operator UI

---

## FAIL_CLOSED guarantees

When DB is unreachable and `FAIL_CLOSED` policy is active:

**HARD guarantees:**
- `freezeLocal()` halts all `assertCanMutateDeployment()` checks immediately
- No new wave promotions or deployment mutations can proceed on the affected node
- Audit ledger entries for emergency freeze are written to in-memory ledger

**Limits (NOT guaranteed):**
- The OTHER node in the cluster is NOT automatically frozen by `freezeLocal()`
- DB-persisted freeze state requires DB connectivity
- `freezeLocal()` state is lost on process restart
