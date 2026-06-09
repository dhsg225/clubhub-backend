# UI_AUTHORITY_BOUNDARY.md
# Governance Kernel v1 — UI Authority Boundary Specification

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. The fundamental boundary

```
┌─────────────────────────────────────────────┐
│  OPERATOR UI — zero authority                │
│                                              │
│  Can: view, submit intent, request actions  │
│  Cannot: mutate kernel state directly       │
│          bypass OperatorAuthority           │
│          modify authority_epoch             │
│          forge lineage metadata             │
│          issue tokens                       │
└────────────────────┬────────────────────────┘
                     │ HTTP governed API only
                     │ (authenticated + audited)
┌────────────────────▼────────────────────────┐
│  API GATEWAY — authority boundary           │
│                                             │
│  OperatorAuthority.requireAuth()            │
│  AuditLedger attribution                   │
│  Role enforcement                           │
│  Rate limiting                              │
└────────────────────┬────────────────────────┘
                     │ kernel api/ calls only
┌────────────────────▼────────────────────────┐
│  GOVERNANCE KERNEL — sole authority         │
└─────────────────────────────────────────────┘
```

---

## 2. Authority operations by role

### ADMIN role

| Operation | API route | Kernel method | Consistency |
|-----------|-----------|---------------|-------------|
| Freeze deployment | POST /governance/freeze | FreezeController.freeze() | LINEARIZED |
| Unfreeze deployment | POST /governance/unfreeze | FreezeController.unfreeze() | MEMORY_ONLY |
| Revoke operator token | POST /governance/tokens/:jti/revoke | OperatorAuthority.revokeToken() | DB_ASYNC |
| Increment authority epoch | POST /governance/epoch/increment | AuthorityCoordinator.incrementEpoch() | LINEARIZED |
| Propose config change | POST /governance/config/proposals | ConfigAuthority.update() | DB_ASYNC |
| Transition incident (strong) | POST /governance/incidents/:id/transition-strong | IncidentManager.transitionStrong() | LINEARIZED |
| Archive resolved incidents | POST /governance/incidents/archive | IncidentManager.archiveResolved() | DB_SYNC |
| Run certification | POST /governance/certify | GovernanceKernel.certify() | DB_ASYNC |

### OPERATOR role

| Operation | API route | Kernel method | Consistency |
|-----------|-----------|---------------|-------------|
| Create incident | POST /governance/incidents | IncidentManager.create() | DB_ASYNC |
| Transition incident | POST /governance/incidents/:id/transition | IncidentManager.transition() | MEMORY_ONLY |
| Submit freeze request (pending ADMIN confirm) | POST /governance/freeze/request | (queued — not direct) | — |

### VIEWER role (read-only)

| Operation | API route | Kernel method | Consistency |
|-----------|-----------|---------------|-------------|
| Get freeze state | GET /governance/freeze | FreezeController.isFrozen() | CACHE_COHERENT |
| Get freeze state (strong) | GET /governance/freeze/strong | FreezeController.isFrozenStrong() | DB_AUTHORITATIVE |
| Get incidents | GET /governance/incidents | IncidentManager.getActive() | MEMORY_ONLY |
| Get audit ledger | GET /governance/audit | AuditLedger.getEntries() | MEMORY_ONLY |
| Get topology | GET /governance/topology | AuthorityCoordinator.getClusterStatus() | MEMORY_ONLY |
| Get config snapshot | GET /governance/config | ConfigAuthority.snapshot() | MEMORY_ONLY |
| Get certification status | GET /governance/certification | (reports/governance-certification.json) | — |
| Start replay | POST /governance/replay | GovernanceKernel.replay() | NONE |

---

## 3. Forbidden UI patterns

The following patterns are HARD VIOLATIONS of the authority boundary:

### FV-1: Direct kernel import in UI code

```javascript
// FORBIDDEN — UI code must never import kernel modules
const { FreezeController } = require('../../governance-kernel/api/FreezeController');
```

### FV-2: Direct DB access from UI

```javascript
// FORBIDDEN — UI must never hold a DB pool
const pool = new Pool({ ... });
await pool.query('UPDATE governance_state SET freeze = true');
```

### FV-3: Forged authority metadata

```javascript
// FORBIDDEN — UI must never inject authority_epoch
const event = { ...realEvent, authority_epoch: 999 };
store.dispatch(event);
```

### FV-4: Optimistic LINEARIZED state

```javascript
// FORBIDDEN — cannot optimistically update LINEARIZED operations
store.dispatch({ type: 'FREEZE_OPTIMISTIC', frozen: true }); // before server confirms
```

### FV-5: Bypassing requireAuth

```javascript
// FORBIDDEN — all mutating routes must pass through requireAuth()
router.post('/freeze', (req, res) => { /* no auth check */ });
```

### FV-6: Plugin direct mutation

```javascript
// FORBIDDEN — plugins cannot call kernel methods directly
plugin.onFreeze = () => kernel.freeze('plugin triggered'); // forbidden
```

---

## 4. Authority confidence model

The UI assigns an **authority confidence score** to each displayed value:

| Score | Label | Criteria |
|-------|-------|----------|
| HIGH | DB-confirmed | Last update was LINEARIZED or DB_AUTHORITATIVE, < 5s ago |
| MEDIUM | Cache-coherent | Last update was CACHE_COHERENT, < 120s ago |
| LOW | Locally-cached | Last update was MEMORY_ONLY or > 120s ago |
| UNKNOWN | Not loaded | No data yet / transport error |
| DIVERGED | Split-brain | Multiple instances reporting conflicting values |

Authority confidence is displayed on all freeze, incident, and epoch surfaces.

---

## 5. Audit attribution model

Every operator command submitted through the control plane is attributed:

```javascript
{
  operator_id: token.oid,
  role: token.role,
  jti: token.jti,
  command: 'FREEZE',
  reason: 'deploy-gate-breach',
  justification: 'OTA success rate fell below 0.95',
  submitted_at: clock.nowIso(),   // governed clock
  received_at: serverWallClock(), // actual receipt
  authority_epoch: currentEpoch,
  lineage_ts: clock.nowIso(),
}
```

All attributions are appended to `AuditLedger` via `appendEntry()` (DB_ASYNC)
or `appendLinearized()` for LINEARIZED commands.

---

## 6. What the UI may NEVER claim

1. UI may not claim a freeze is active without DB confirmation when using strong semantics
2. UI may not claim an epoch is canonical without `LINEARIZED` provenance
3. UI may not claim certification is PASS without reading from `reports/governance-certification.json`
4. UI may not present MEMORY_ONLY state as DB-authoritative
5. UI may not suppress stale warnings to make the interface appear cleaner

These are integrity constraints, not aesthetic guidelines.
