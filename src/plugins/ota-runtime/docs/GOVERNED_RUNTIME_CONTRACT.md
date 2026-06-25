# GOVERNED_RUNTIME_CONTRACT.md
# OTA Runtime — Governed Authority Contract

**Phase:** A3
**Effective:** 2026-05-24

---

## What OTA runtime MAY do

### Deployment authority
- Call `AuthorityCoordinator.incrementEpoch()` for wave promotion and completion
- Call `FreezeController.freeze(reason, pool)` for LINEARIZED freeze
- Call `FreezeController.freezeLocal(reason)` for MEMORY_ONLY emergency freeze (documented path only)
- Call `FreezeController.unfreeze(reason)` for MEMORY_ONLY unfreeze
- Query `FreezeController.isFrozen()` and `isFrozenStrong(pool)` at any time
- Query `AuthorityCoordinator.getEpoch()` at any time

### Incident authority
- Call `IncidentManager.create(type, severity, chain)` to create incidents
- Call `IncidentManager.transition(id, toState, reason)` for CACHE_COHERENT transitions
- Call `IncidentManager.transitionStrong(pool, id, toState, reason)` for LINEARIZED transitions
- Call `IncidentManager.archive(id)` for incident archival
- Query `IncidentManager.getActive()` and `IncidentManager.get(id)` at any time

### Config authority
- Call `ConfigAuthority.get(dotPath)` and `ConfigAuthority.require(dotPath)` for reads
- Call `ConfigAuthority.update(changes, { justification })` for governed config updates
- Query `ConfigAuthority.snapshot()`, `version()`, `isFrozen()` at any time

### Operator authority
- Use `OperatorAuthority.requireAuth(role)` as Express middleware
- Call `OperatorAuthority.issueToken(operatorId, role)` for session issuance
- Call `OperatorAuthority.revokeToken(jti, opts)` for JTI revocation
- Call `OperatorAuthority.verifyToken(token)` for token verification
- Append to `AuditLedger.appendEntry(opts)` for operator action attribution
- Append to `AuditLedger.appendLinearized(pool, opts)` for LINEARIZED attribution

### Event emission
- Emit to kernel event bus via `eventBus.emit(type, fields)` in `governance.*` namespace
- Subscribe to kernel events for read-only state propagation

---

## What OTA runtime MAY NOT do

### Authority violations
- Import or call `governance-kernel/core/*` directly (all access via API classes)
- Create a `pg.Pool` instance (pool is application domain, passed in as dependency)
- Import `lib/governed-config` or `lib/governed-clock` directly (use kernel APIs)
- Increment epoch counter without `AuthorityCoordinator` (no direct `clusterConsensus.incrementEpoch()`)
- Freeze deployment without `FreezeController` (no direct `clusterConsensus.setFreeze()`)

### Mutation violations
- Mutate any deployment state in REPLAY mode (assertNotReplay() guard is mandatory)
- Apply optimistic LINEARIZED state (no optimistic UI for freeze confirmations)
- Assign incident IDs directly (IDs are content-addressed by IncidentManager)
- Bypass MAX_ACTIVE_INCIDENTS enforcement (enforced by IncidentManager kernel-side)
- Update config without justification (ConfigAuthority.update() requires justification)

### Certification violations
- Emit events outside the `governance.*` namespace without explicit extension approval
- Create authority tokens without OperatorAuthority
- Override freeze state in memory without FreezeController

---

## Failure semantics

| Failure | Behavior |
|---------|----------|
| DB unreachable during freeze | FreezeController returns FAIL_CLOSED — freezeLocal() as emergency path |
| DB unreachable during incident transition | transition() uses CACHE_COHERENT; transitionStrong() fails with error |
| AuditLedger failure | Non-fatal — operation proceeds, ledger failure is logged |
| EventBus failure | Non-fatal — event emission failure is caught and swallowed |
| OperatorAuthority token expired | 401 UNAUTHORIZED — middleware rejects before route handler |
| ConfigAuthority not initialized | ConfigAuthority.update() throws — propagates to route handler |

---

## Invariants added by A3

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| RT-01 | OTA runtime never imports governance-kernel/core/ | AuthorityBypassCertification ABC-06 |
| RT-02 | OTA runtime never imports lib/governed-config directly | AuthorityBypassCertification ABC-01 |
| RT-03 | OTA runtime never creates pg.Pool | AuthorityBypassCertification ABC-03 |
| RT-04 | All mutating routes use requireAuth middleware | GovernedRoutingCertification GRC-01 |
| RT-05 | All operator actions append to AuditLedger | GovernedRoutingCertification GRC-07 |
| RT-06 | All deployment mutations blocked in replay mode | ReplayIsolationCertification RIC-04 |
| RT-07 | governed-deployment uses AuthorityCoordinator for epoch | OTARuntimeCertification ORC-01 |
| RT-08 | governed-deployment uses FreezeController for freeze | OTARuntimeCertification ORC-02 |
