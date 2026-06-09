# Platform Certification (Phase A9)

## Runner

`backend/src/governance-kernel/certification/A9CertificationRunner.js`

```javascript
const { certifyA9 } = require('./A9CertificationRunner');
const result = await certifyA9();
// result.overall_rating: 'PASS' | 'FAIL'
// result.total_pass:     70
// result.total_fail:     0
```

## Certification Suites

| Suite                            | Checks | Focus                                |
|----------------------------------|--------|---------------------------------------|
| PlatformLifecycleCertification   | 10     | State machine transitions, events    |
| ReplayConvergenceCertification   | 10     | Unified replay sessions, isolation   |
| ExecutionPathCertification       | 10     | Canonical mutation path, no bypass   |
| TracePropagationCertification    | 10     | correlation_id, lineage_ts flow      |
| TopologyConsistencyCertification | 10     | Entity graph CRUD, event emission    |
| DeterministicBootstrapCertification | 10  | Ordered init/shutdown, log capture   |
| ConvergenceIntegrityCertification | 10    | Divergence detection, no mutation    |
| **Total**                        | **70** |                                       |

## Phase Coverage

| Phase | Certification | Checks | Status |
|-------|--------------|--------|--------|
| A7    | certifyA7()  | 54     | PASS   |
| A8    | certifyA8()  | 56     | PASS   |
| A9    | certifyA9()  | 70     | PASS   |

## Key Invariants Certified

- Invalid lifecycle transitions throw synchronously (PLC-05, PLC-06, PLC-08)
- Execution router blocks all mutations during shutdown (EPC-05)
- Topology duplicate registration throws (TCC-08)
- Convergence scan is detection-only (CIC-09)
- Decision trace `verifyChain()` on empty returns valid (TPC-10)
- Bootstrap phases run in declared order (DBC-04)
- Shutdown continues past errors (DBC-09)

## Regression Policy

Certifications for A1–A9 are all merge-blocking. No phase may regress a prior phase's certification. The A9CertificationRunner does not replace A7/A8 runners — all three must PASS independently.
