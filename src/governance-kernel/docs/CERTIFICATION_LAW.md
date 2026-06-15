# CERTIFICATION_LAW.md
# Governance Kernel v1 — Certification Law

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23
**Authority:** Certification is normative. It is the final arbiter of governance compliance.

---

## 1. Certification is the normative authority

The certification suite (`GovernanceCertificationRunner` + `validate-contracts.js`) is
the authoritative source of governance compliance. Informal code review, documentation,
or human judgment do NOT supersede certification.

A governance change that:
- causes any `validate-contracts.js` check to FAIL → **MUST NOT be merged**
- causes any certification runner to FAIL → **MUST NOT be deployed to production**
- causes any IMMUTABLE API to change signature → **MUST NOT be merged without RFC**

---

## 2. Certification profiles

### v1-alpha (DEVELOPMENT)

Minimum viable governance. All basic determinism and replay invariants pass.

Required runners:
- ReplayCertification
- DeterminismCertification

Target: `overall_rating: PASS`
Deployment ceiling: development, test environments only

### v1-production (PRODUCTION_READY)

Full governance invariants pass. Resource bounds enforced. Incident lifecycle correct.
Freeze integrity correct.

Required runners: all above plus:
- HAConsistencyCertification
- AuthorityConvergenceCertification
- ResourceBoundCertification
- IncidentRecoveryCertification
- FreezeIntegrityCertification

Target: `overall_rating: PASS` or `CONDITIONAL` with documented caveats ≤ 2
Deployment ceiling: production (single-node or active/passive)

### v1-ha (HA_PRODUCTION)

All governance invariants pass. Operator accountability and plugin safety verified.
No FAILs. CONDITIONAL caveats ≤ 2 (documented).

Required runners: all above plus:
- OperatorAccountabilityCertification
- PluginSafetyCertification

Target: `overall_rating: PASS` or `CONDITIONAL` with ≤ 2 caveats, each with documented caveat text
Deployment ceiling: active/active 2-node (shared PostgreSQL primary)

---

## 3. Certification compatibility matrix

| Change type | v1-alpha | v1-production | v1-ha | Notes |
|-------------|----------|---------------|-------|-------|
| Add new API method (EXPERIMENTAL) | ✓ | ✓ | ✓ | No runner checks it |
| Add new BUS_EVENTS entry | ✓ | ✓ | ✓ | Does not break existing runners |
| Change EVOLVABLE method signature (backward compat) | ✓ | ✓ | ✓ | No signature checks in runners |
| Change EVOLVABLE method behavior | ✓ | requires re-run | requires re-run | May affect behavioral checks |
| Change IMMUTABLE method signature | FAIL | FAIL | FAIL | Requires RFC + v2 |
| Remove any public method | FAIL | FAIL | FAIL | Requires RFC + deprecation period |
| Rename BUS_EVENTS key | FAIL | FAIL | FAIL | Existing subscribers break |
| Remove LINEAGE_MODES value | FAIL | FAIL | FAIL | Validator check 50 |
| Remove INCIDENT_STATES value | FAIL | FAIL | FAIL | Validator check 78 |
| Weaken FAIL→WARN in validate-contracts.js | FAIL | FAIL | FAIL | Requires RFC |
| Add new FAIL check in validate-contracts.js | ✓ | ✓ | ✓ | Strengthens governance |
| Change MAX_NODES below 1000 | FAIL | FAIL | FAIL | ResourceBound check |
| Change MAX_LEDGER_ENTRIES below 10,000 | FAIL | FAIL | FAIL | ResourceBound check |
| Change MAX_ACTIVE_INCIDENTS below 500 | FAIL | FAIL | FAIL | ResourceBound check |
| Remove FAIL_CLOSED from DB_FAILURE_POLICIES | FAIL | FAIL | FAIL | HAConsistency check |
| Remove `freezeStrong()` | FAIL | FAIL | FAIL | FreezeIntegrity check |
| Remove `getFreezeStateStrong()` | FAIL | FAIL | FAIL | FreezeIntegrity check |
| Remove `timingSafeEqual` from token verify | FAIL | FAIL | FAIL | OperatorAccountability check |
| Remove JTI from token payload | FAIL | FAIL | FAIL | JTI revocation check |
| Remove `isRevoked()` check from verifyToken | FAIL | FAIL | FAIL | JTI replay check |
| Set `bypassGovernance: true` in any plugin | FAIL | FAIL | FAIL | PluginSafety check |

---

## 4. Certification invariants (machine-checkable)

Each certification runner checks a specific governance invariant via static source analysis.
The following invariants are FROZEN and cannot be weakened:

### ReplayCertification invariants

- `clock.js` exists at `core/clock.js`
- `clock.js` exports `setFixed`, `freeze`, `isFrozen`
- `lineage.js` references `REPLAY` mode

### DeterminismCertification invariants

- `deterministic-id.js` exists at `core/deterministic-id.js`
- `deterministic-id.js` uses SHA-256
- `deterministic-id.js` uses `_stableStringify`
- `deterministic-id.js` does NOT contain `Date.now()`
- `clock.js` exports `nowIso`

### HAConsistencyCertification invariants

- `cluster-consensus.js` exports `freezeStrong`
- `cluster-consensus.js` exports `getFreezeStateStrong`
- `cluster-consensus.js` exports `incrementEpoch`
- `cluster-consensus.js` references `FAIL_CLOSED`
- `governance-db.js` exports `withAdvisoryLock`
- `governance-db.js` uses `pg_advisory_xact_lock`
- `cluster-consensus.js` references `MAX_NODES` or `MAX_SCREENS`

### AuthorityConvergenceCertification invariants

- `cluster-consensus.js` exports `incrementEpoch`
- `cluster-consensus.js` exports `getEpoch`
- `cluster-consensus.js` references `SPLIT_BRAIN`
- `cluster-consensus.js` references quorum
- `config-authority.js` exports `getThreshold`
- `config-authority.js` references `configHash`

### ResourceBoundCertification invariants

- `cluster-consensus.js` references `MAX_NODES` or `MAX_SCREENS`
- `audit-ledger.js` references `MAX_LEDGER_ENTRIES`
- `incident-manager.js` references `MAX_ACTIVE_INCIDENTS`
- `cluster-consensus.js` references eviction logic

### IncidentRecoveryCertification invariants

- `incident-manager.js` exports `createIncident`
- `incident-manager.js` exports `archiveResolvedIncidents`
- `incident-manager.js` references `MAX_ACTIVE_INCIDENTS`
- `incident-manager.js` exports `INCIDENT_STATES`
- `incident-manager.js` exports `initFromDb`

### FreezeIntegrityCertification invariants

- `cluster-consensus.js` exports `freezeStrong`
- `cluster-consensus.js` exports `getFreezeStateStrong`
- `cluster-consensus.js` references `_freezeEpoch`
- `cluster-consensus.js` references `FAIL_CLOSED`
- `api/FreezeController.js` exists

### OperatorAccountabilityCertification invariants

- `audit-ledger.js` exports `verifyIntegrity`
- `audit-ledger.js` exports `appendEntryLinearized`
- `audit-ledger.js` references `MAX_LEDGER_ENTRIES`
- `session-authority.js` exports `revokeToken`
- `session-authority.js` exports `isRevoked`
- `api/OperatorAuthority.js` uses `timingSafeEqual`
- `api/OperatorAuthority.js` exports `ADMIN`, `OPERATOR`, `VIEWER`

### PluginSafetyCertification invariants

- `plugins/PluginRegistry.js` checks `bypassGovernance`
- `plugins/PluginRegistry.js` exports `validate`
- `plugins/PluginRegistry.js` references `determinismLevel`
- `plugins/PluginRegistry.js` references `authorityLevel`
- No registered plugin has `bypassGovernance: true`

---

## 5. OTA contract validator (validate-contracts.js) integration

The OTA system's contract validator (`test-runner/contracts/validate-contracts.js`)
contains 79 checks that MUST ALL PASS.

Certification law requires:
1. All 79 checks PASS (not WARN, not FAIL)
2. No check may be downgraded from FAIL to WARN without a Governance RFC
3. New checks may only be added (not removed) in v1.x

The OTA validator is distinct from the kernel certification runner but both are
normative. Both must pass for a production deployment.

---

## 6. Certification run schedule

| Event | Required certification |
|-------|----------------------|
| Any core/ file change | Full re-run (all 9 runners) |
| Any api/ file change | Full re-run |
| BUS_EVENTS catalog change | Full re-run |
| Plugin registration change | PluginSafetyCertification |
| Adapter change | HAConsistencyCertification |
| DSL change | (no runner — experimental) |
| Documentation-only change | None required |
| Dependency version bump | Full re-run |

CI command:
```bash
node -e "new (require('./backend/src/governance-kernel/certification/GovernanceCertificationRunner'))().run().then(r => { if (r.overall_rating === 'FAIL') process.exit(1); })"
node test-runner/contracts/validate-contracts.js
```

---

## 7. Certification output format

The certification runner produces `reports/governance-certification.json`:

```json
{
  "generated_at": "ISO timestamp",
  "level": "HA_PRODUCTION",
  "overall_rating": "PASS | CONDITIONAL | FAIL",
  "runner_count": 9,
  "pass_count": 8,
  "conditional_count": 1,
  "fail_count": 0,
  "results": [
    {
      "name": "FreezeIntegrityCertification",
      "rating": "PASS",
      "caveats": []
    },
    {
      "name": "HAConsistencyCertification",
      "rating": "CONDITIONAL",
      "caveats": [
        {
          "severity": "CONDITIONAL",
          "check": "advisory_lock",
          "detail": "advisory lock not referenced in distributed-authority (by design — delegated to governance-db)"
        }
      ]
    }
  ]
}
```

Machine-readable format is FROZEN. Field names and structure cannot change in v1.x.

---

## 8. Certification failure escalation

| Rating | Action |
|--------|--------|
| `overall_rating: PASS` | Deploy allowed |
| `overall_rating: CONDITIONAL` | Deploy allowed with documented caveats in deployment record |
| `overall_rating: FAIL` | BLOCKED — DO NOT DEPLOY — fix failures first |
| OTA validator < 79 PASS | BLOCKED — fix all checks |
| OTA validator any WARN | BLOCKED — WARN is treated as FAIL since check 35 upgrade |

---

## 9. Current v1 certification state

```
Kernel certification: HA_PRODUCTION, CONDITIONAL
  8/9 PASS, 1 CONDITIONAL, 0 FAIL
  Caveat: HAConsistencyCertification — advisory lock in governance-db.js,
          not directly in distributed-authority.js (by design)

OTA validator: 79/79 PASS, 0 WARN
```

Both are within production deployment thresholds.
