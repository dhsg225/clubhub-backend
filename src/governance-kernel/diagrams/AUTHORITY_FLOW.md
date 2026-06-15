# AUTHORITY_FLOW.md
# Authority Flow Diagram

```
Operator Action (e.g., "Freeze deployment")
       │
       ▼
requireAuth(OPERATOR) ──FAIL──► 401/403 response
       │ PASS
       ▼
governed-deployment.freezeDeployment(reason, pool, opts)
       │
       ├──► replayHooks.assertNotReplay()   ──REPLAY MODE──► REPLAY_ISOLATION_VIOLATION
       │
       ├──► FreezeController.freeze(reason, pool)
       │         │
       │         ▼
       │    clusterConsensus.freezeStrong(reason, pool)
       │         │
       │         ▼
       │    pg_advisory_xact_lock  ──DB FAIL──► throw / freezeLocal() fallback
       │         │ acquired
       │         ▼
       │    UPDATE freeze_state = true (LINEARIZED)
       │         │
       │         ▼
       │    release lock ──► return { frozen: true, epoch }
       │
       ├──► AuditLedger.appendEntry({ deployment_frozen, operator_id, justification })
       │
       ├──► eventBus.emit(AUTHORITY.FREEZE_COMMITTED, { reason, operator_id, lineage_ts })
       │
       └──► lifecycle.transition('ACTIVE' → 'FROZEN', reason)

Response: { ok: true, frozen: true }
```

## Authority confidence at each step

| Step | Consistency | Notes |
|------|-------------|-------|
| requireAuth check | MEMORY_ONLY | Token verified in-process |
| freezeStrong DB write | LINEARIZED | Advisory lock acquired |
| AuditLedger append | DB_ASYNC | Fire-and-forget persist |
| event bus emit | MEMORY_ONLY | In-process ring buffer |
