# CERTIFICATION_GUIDE.md
# Governance Kernel — Certification Guide

---

## Certification levels

```
DEVELOPMENT    — basic static analysis passes
STAGING        — integration tests pass
PRODUCTION     — full runtime + HA checks pass
HA_PRODUCTION  — HA safety model verified (current level)
```

**Current platform level:** `HA_PRODUCTION CONDITIONAL`
- 8/9 runners PASS
- 1 runner CONDITIONAL (HAConsistencyCertification — documented 2-node ceiling advisory)

---

## Certification runners — kernel

| Runner | Checks | Current |
|--------|--------|---------|
| ReplayCertification | Replay contract | PASS |
| DeterminismCertification | Content-addressed IDs, clock | PASS |
| HAConsistencyCertification | 2-node HA safety | CONDITIONAL |
| FreezeIntegrityCertification | Freeze/unfreeze contracts | PASS |
| IncidentRecoveryCertification | Incident lifecycle | PASS |
| OperatorAccountabilityCertification | Token + ledger attribution | PASS |
| AuthorityConvergenceCertification | Epoch + lock convergence | PASS |
| PluginSafetyCertification | Plugin boundary enforcement | PASS |
| ResourceBoundCertification | MAX_SCREENS, MAX_INCIDENTS | PASS |

---

## Certification runners — A2 Operator UI (27/27 PASS)

| Runner | Checks |
|--------|--------|
| UIConsistencyCertification | State consistency discipline (10) |
| ReplaySurfaceCertification | Replay isolation + determinism (8) |
| AuthorityBoundaryCertification | Authority boundary separation (9) |

---

## Certification runners — A3 OTA Runtime (39/39 PASS)

| Runner | Checks |
|--------|--------|
| OTARuntimeCertification | Governed-* modules use kernel APIs (8) |
| GovernedRoutingCertification | Routes use governed modules (7) |
| ReplayIsolationCertification | Replay blocks all mutations (8) |
| AuthorityBypassCertification | No core/ imports, no pool creation (8) |
| LifecycleConsistencyCertification | Lifecycle state machine (8) |

---

## Running certification

```javascript
// Kernel:
const { GovernanceCertificationRunner } = require('./governance-kernel');
const result = await new GovernanceCertificationRunner().run();

// Operator UI:
const { certifyUI } = require('./governance-kernel/operator-ui');
const result = await certifyUI();

// OTA Runtime:
const { createOTARuntime } = require('./plugins/ota-runtime');
const result = await createOTARuntime().certifyRuntime();
```

---

## Interpreting results

```json
{
  "overall_rating": "CONDITIONAL",
  "level": "HA_PRODUCTION",
  "pass_count": 8,
  "fail_count": 0,
  "conditional_count": 1
}
```

| Rating | Meaning | Deploy? |
|--------|---------|---------|
| PASS | All checks pass | YES |
| CONDITIONAL | Advisory caveats only, no failures | YES — with documented limits |
| FAIL | One or more hard failures | NO |

---

## What certification guarantees

**HARD guarantees (FAIL on violation):**
- Authority boundary is enforced (no core/ imports in plugins)
- Replay isolation is enforced (mutations blocked during replay)
- Operator attribution is enforced (AuditLedger on all mutations)
- Role enforcement is enforced (requireAuth on all POST routes)

**SOFT guarantees (WARN/CONDITIONAL on violation):**
- HA ceiling documentation is complete
- Nondeterministic paths are declared

**NOT guaranteed by certification:**
- Correctness under all failure modes
- Multi-region consistency
- Performance under load
- Security against OPERATOR_SECRET_KEY compromise

---

## Adding a new certification check

1. Add a method to the appropriate runner class
2. Assign a check ID in the runner's namespace (e.g., `ABC-11`)
3. Return `{ id, description, status: 'PASS'|'FAIL'|'WARN', detail }`
4. Add to the `run()` method's check array
5. Run the full suite to ensure no regressions
6. Update CERTIFICATION_GUIDE.md check count

**Zero false PASS tolerance:** A check that returns PASS for the wrong reason is worse than no check.
