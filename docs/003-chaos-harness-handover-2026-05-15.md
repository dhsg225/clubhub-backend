# Handover: Chaos Test Harness & CI Gate Integration
**Date:** 2026-05-15  
**Status:** ✅ Completed & Validated

## 1. Objective Completed
Transitioned the ClubHub TV player from a "buggy" manifest polling state to a fully stabilized fleet with a production-grade **Chaos CI Gate**. The system now enforces performance and resilience thresholds automatically on every push.

## 2. Key Improvements & Fixes

### Player Core
- **Checksum-based Detection**: Fixed a critical race condition/bug in `player/src/useManifest.ts`. The player now watches `manifest.checksum` instead of `version`. This prevents stale content display after a backend cache bust where versions might reset to 1.

### Chaos Test Harness (`test-runner/`)
Built a zero-dependency (Node 20 native) harness that simulates a fleet of 10 Raspberry Pis and subjects the system to backend, database, and network failures.

- **`lib/assert.js`**: Upgraded to a CI-grade assertion layer with structured error codes (`CHAOS_DB_RECOVERY_TIMEOUT`), stack trace preservation, and metric-specific thresholds.
- **`lib/metrics.js`**: Tracks fleet health, p95 latencies, success rates, and **Screen Desyncs**. Computes a **Recovery Score (0-100)** for at-a-glance health status.
- **`lib/fleet.js`**: Manages the `fake-pi.js` simulator. Added a **Deterministic Mode** (`--deterministic`) with a global seed to ensure jitter and reboot timings are identical across CI runs.
- **`lib/reporter.js`**: Dual-output system:
  - **Human-Readable**: Grouped suite summaries in the console.
  - **Machine-Readable**: Generates `reports/latest.json` and archived history for artifact collection.

### CI Integration
- **GitHub Actions**: Created `.github/workflows/chaos-tests.yml`. It runs `basic`, `chaos`, and `stress` suites in parallel.
- **Threshold Gating**: Introduced `test-config/thresholds.json`. The CI build will **FAIL** if:
  - p95 Latency > 500ms
  - Success Rate < 98%
  - Any screen desync is detected
  - Recovery from backend/DB restart exceeds specified limits.

## 3. Current Running State

- **Stack**: Backend (port 4000), Simulation Management (port 3101), Postgres (port 5433).
- **Test Coverage**: 13 automated tests covering cold starts, manifest delivery, cache persistence, DB/Backend failure recovery, and sustained stress load.
- **Results**: All 13 tests currently pass in the local environment (`make test-ci`).

## 4. Makefile Commands

| Command | Description |
|---------|-------------|
| `make test-basic` | Run health checks and cold start tests (deterministic). |
| `make test-chaos` | Run backend/DB restart and network outage scenarios. |
| `make test-stress` | Run 60s sustained load and poll drift analysis. |
| `make test-ci` | Run all suites with JSON reporting and threshold gating. |
| `make test-clean` | Wipe the `reports/` directory. |

## 5. Instructions for Next AI Session
1. **CI Monitoring**: Watch the first few GitHub Action runs. If Docker spin-up in the cloud is slower than local, you may need to increase the `timeout` values in `test-config/thresholds.json`.
2. **Stress Tuning**: If `poll_drift` failures occur in CI, consider increasing the allowed drift from 3000ms to 5000ms to account for shared CI runner CPU stealing.
3. **Player Regressions**: Any future changes to `useManifest` must maintain the `checksum` comparison; do NOT revert to `version` numbers.

## 6. File Tree Changes
- `test-runner/` (Complete harness logic)
- `test-config/thresholds.json` (CI Gating rules)
- `reports/` (JSON artifacts)
- `.github/workflows/chaos-tests.yml` (CI Pipeline)
- `Makefile` (Testing targets)
