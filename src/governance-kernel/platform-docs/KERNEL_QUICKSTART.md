# KERNEL_QUICKSTART.md
# Governance Kernel — Quickstart

**Audience:** Engineers integrating a new plugin or service with the Governance Kernel.

---

## 1. Install and require

```javascript
const {
  GovernanceKernel,
  AuthorityCoordinator,
  FreezeController,
  IncidentManager,
  AuditLedger,
  ConfigAuthority,
  OperatorAuthority,
  DeterministicClock,
  LineageEngine,
  eventBus,
  BUS_EVENTS,
} = require('./governance-kernel');
```

---

## 2. Instantiate API classes

```javascript
const authorityCoordinator = new AuthorityCoordinator();
const freezeController     = new FreezeController({ dbFailurePolicy: 'FAIL_CLOSED' });
const incidentManager      = new IncidentManager();
const auditLedger          = new AuditLedger();
const configAuthority      = new ConfigAuthority();
const operatorAuthority    = new OperatorAuthority();
const clock                = new DeterministicClock();
const lineageEngine        = new LineageEngine();
```

---

## 3. Initialize from DB

```javascript
// After pg pool is available:
await incidentManager.init(pool);
```

---

## 4. Check freeze state before mutations

```javascript
// CACHE_COHERENT (fast, may be slightly stale):
if (freezeController.isFrozen()) {
  throw new Error('DEPLOYMENT_FROZEN');
}

// DB_AUTHORITATIVE (strong, requires pool):
const frozen = await freezeController.isFrozenStrong(pool);
if (frozen.frozen) throw new Error('DEPLOYMENT_FROZEN');
```

---

## 5. Perform a LINEARIZED operation

```javascript
// All LINEARIZED operations require pool (pg_advisory_xact_lock):
const epoch = await authorityCoordinator.incrementEpoch();
```

---

## 6. Create an incident

```javascript
const incident = await incidentManager.create(
  'DEPLOYMENT_FAILURE',
  'CRITICAL',
  { correlation_id: 'rollout-xyz', caused_by: 'network_partition' }
);
// incident.id is content-addressed (SHA-256)
```

---

## 7. Append to AuditLedger

```javascript
auditLedger.appendEntry({
  action_type:  'deployment_wave_promoted',
  operator_id:  'ops-alice',
  justification: 'Ring 0 healthy, promoting to Ring 1',
});
```

---

## 8. Issue an operator token

```javascript
const token = operatorAuthority.issueToken('ops-alice', 'OPERATOR');
// Verify:
const result = operatorAuthority.verifyToken(token);
// { valid: true, payload: { oid: 'ops-alice', role: 'OPERATOR', ... } }
```

---

## 9. Subscribe to events

```javascript
const { BUS_EVENTS } = require('./governance-kernel').eventBus;

eventBus.subscribe(BUS_EVENTS.AUTHORITY.FREEZE_COMMITTED, (event) => {
  console.log('Freeze committed:', event.deterministic_ts);
});
```

---

## 10. Run kernel certification

```javascript
const { GovernanceCertificationRunner } = require('./governance-kernel');
const runner = new GovernanceCertificationRunner();
const result = await runner.run();
// result.overall_rating — 'PASS', 'CONDITIONAL', or 'FAIL'
// result.level          — 'HA_PRODUCTION', 'PRODUCTION', etc.
```

---

## Common mistakes

| Mistake | Correct approach |
|---------|-----------------|
| Importing `governance-kernel/core/` directly | Import from `governance-kernel/api/` only |
| Creating `pg.Pool` inside a plugin | Accept pool as injected dependency |
| Using `OPTIMISTIC` authority source | Omitted intentionally — LINEARIZED ops must wait for confirmation |
| Incrementing epoch without `AuthorityCoordinator` | Always use `AuthorityCoordinator.incrementEpoch()` |
| Updating config without justification | `ConfigAuthority.update()` throws without `opts.justification` |
| Calling `freezeLocal()` as primary freeze | `freezeLocal()` is MEMORY_ONLY — must follow up with `freeze(reason, pool)` |
