# CLUBHUB SYSTEM CONTRACTS

**Version:** 1.0.0
**Status:** ENFORCED
**Authority:** This document defines binding contracts. Any deviation requires an explicit ADR; silence implies compliance.

---

## 0. DOCUMENT CONVENTIONS

- **MUST** — hard requirement; violation is a deploy blocker.
- **MUST NOT** — absolute prohibition; violation is a deploy blocker.
- **SHOULD** — strong recommendation; deviation requires justification in the PR.
- **MAY** — permitted but not required.
- Values in `[brackets]` reference the authoritative source file.

---

## 1. SYSTEM HEALTH MODEL

### 1.1 Health States

A ClubHub component exists in exactly one of three states:

| State | Definition | Permitted Actions |
|-------|------------|-------------------|
| **HEALTHY** | All checks pass; component operating within all thresholds | Normal operation |
| **DEGRADED** | One or more non-critical checks fail; core function intact | Operation with alert; no deploy |
| **UNHEALTHY** | Critical check failed; core function impaired | Halt deploy; trigger recovery |

State transitions:

```
HEALTHY ←→ DEGRADED ←→ UNHEALTHY
```

Skipping states is permitted only in the degrading direction (HEALTHY → UNHEALTHY is valid on catastrophic failure).

### 1.2 Health Check Definitions

#### Backend Liveness (`GET /health/live`)
Passes when: Node process is alive.
Failure means: process is dead or hung. **UNHEALTHY.**
Response fields MUST include: `status`, `uptime_s`, `ts`.

#### Backend Readiness (`GET /health/ready`)
Passes when: DB connection active AND `manifest_cache` table is reachable.
Failure means: **DEGRADED** if DB is temporarily unreachable; **UNHEALTHY** if persistent beyond recovery SLA.
HTTP 503 MUST be returned when degraded [`backend/src/routes/health.js:62`].
Response fields MUST include: `status`, `version`, `uptime_s`, `ts`, `checks.db`, `checks.manifest_cache`, `memory.rss_mb`, `memory.heap_used_mb`, `memory.heap_total_mb`.

#### Screen Health
A screen is **HEALTHY** when:
- Last successful poll age < 120,000 ms [`simulator/pi-appliance.js:41`]
- Consecutive poll failures < 3 [`simulator/pi-appliance.js:42`]
- Displayed checksum matches backend manifest checksum

A screen is **DEGRADED** when:
- Last successful poll age ≥ 120,000 ms (stale manifest warning)
- Consecutive poll failures = 1 or 2

A screen is **UNHEALTHY** when:
- Consecutive poll failures = 3 → watchdog reboot triggered [`simulator/pi-appliance.js:257`]
- Displayed checksum does not match backend manifest after two consecutive poll cycles

### 1.3 Fleet Health Aggregation

| Fleet State | Condition |
|-------------|-----------|
| **HEALTHY** | 100% of screens HEALTHY |
| **DEGRADED** | ≥ 1 screen DEGRADED, 0 screens UNHEALTHY |
| **UNHEALTHY** | ≥ 1 screen UNHEALTHY, OR fleet-wide poll success rate < 98% [`test-config/thresholds.json:9`] |

Fleet UNHEALTHY is a **deploy blocker** for any release that touches polling, manifest computation, or content delivery.

---

## 2. FAILURE TAXONOMY

Failures are classified by scope and recoverability. Every alert and runbook entry MUST reference one of these classes.

### Class A — Transient Network Failures
Self-resolving; screen recovers without intervention within one poll cycle (15s).

| ID | Name | Definition |
|----|------|------------|
| A1 | `slow` | Request latency > 2,000 ms [`simulator/network-shim.js:setSlow`] |
| A2 | `jitter` | Per-request latency variance > ±500 ms |
| A3 | `packet_loss_low` | Drop rate 1–15% [`test-config/thresholds.json` / soak fault sequence] |
| A4 | `captive_portal_partial` | Captive portal intercept rate < 30% |

### Class B — Sustained Network Failures
Require backend recovery or network remediation; screen enters retry loop.

| ID | Name | Definition |
|----|------|------------|
| B1 | `offline` | Backend unreachable (refused or timeout) for ≥ 1 poll cycle |
| B2 | `dns_fail` | DNS resolution failure rate ≥ 50% [`simulator/soak.js fault sequence:8`] |
| B3 | `captive_portal_full` | Captive portal intercept rate ≥ 100% |
| B4 | `packet_loss_high` | Drop rate ≥ 40% [`simulator/soak.js fault sequence:12`] |

### Class C — Backend Failures
Require backend process or DB recovery.

| ID | Name | Definition |
|----|------|------------|
| C1 | `backend_restart` | Backend process stops and restarts (graceful or SIGKILL) |
| C2 | `db_restart` | PostgreSQL process stops and restarts |
| C3 | `request_timeout` | Backend fails to respond within 10,000 ms [`backend/src/middleware/timeout.js:15`] |
| C4 | `rate_limit_breach` | Client exceeds read (120/min), write (60/min), or heavy (10/min) limits [`backend/src/middleware/rateLimiter.js:53`] |

### Class D — Content / Manifest Failures
Require content remediation; screen may display stale or no content.

| ID | Name | Definition |
|----|------|------------|
| D1 | `manifest_stale` | Screen manifest age ≥ 120,000 ms [`simulator/pi-appliance.js:41`] |
| D2 | `checksum_mismatch` | Screen displays content whose checksum differs from current backend manifest |
| D3 | `media_missing` | Referenced media asset returns 404 |
| D4 | `media_corrupt` | Media asset has wrong Content-Type or fails integrity check |
| D5 | `media_oversized` | Media asset exceeds Content-Length limit |

### Class E — OTA Update Failures
Scoped to software update operations.

| ID | Name | Definition |
|----|------|------------|
| E1 | `ota_interrupted` | Update process halted mid-transfer (expected rate: 5%) [`simulator/soak.js:184`] |
| E2 | `ota_compat_fail` | Compatibility check failed post-download; rollback triggered (expected rate: 10%) [`simulator/soak.js:184`] |
| E3 | `ota_fleet_degraded` | Fleet-wide OTA success rate < 80% [`simulator/soak.js:612`] |

### Class F — Data Integrity Failures
These are always **UNHEALTHY** and always **deploy blockers**.

| ID | Name | Definition |
|----|------|------------|
| F1 | `desync` | Screen count mismatch between backend and active polling screens [`test-config/thresholds.json:13`] |
| F2 | `version_regression` | Manifest version decrements without explicit rollback command |
| F3 | `checksum_collision` | Two distinct manifest states share identical checksum |

---

## 3. CI GATING RULES

### 3.1 Required Suites

All three test suites MUST pass. No suite may be skipped on any commit to `main` or any release branch.

| Suite | Entry Point | Requirement |
|-------|-------------|-------------|
| `basic` | `make test-basic` | All assertions pass |
| `chaos` | `make test-chaos` | All assertions pass; requires Docker stack |
| `stress` | `make test-stress` | All assertions pass |

`make test-ci` MUST be used as the canonical CI invocation (seed=12345, all suites, outputs `reports/latest.json`).

### 3.2 Threshold Gates

The following thresholds from `test-config/thresholds.json` are CI hard gates. Any result outside these values fails CI with no override permitted:

| Metric | Threshold | Fail Condition |
|--------|-----------|----------------|
| Backend recovery time | ≤ 30,000 ms | > 30,000 ms |
| DB recovery time | ≤ 60,000 ms | > 60,000 ms |
| Network outage recovery | ≤ 15,000 ms | > 15,000 ms |
| P95 poll latency | ≤ 500 ms | > 500 ms |
| Poll success rate | ≥ 98.0% | < 98.0% |
| Poll drift | ≤ 5,000 ms | > 5,000 ms |
| Desync count | = 0 | ≥ 1 |
| Desync duration | ≤ 45,000 ms | > 45,000 ms |

### 3.3 Determinism Requirement

CI MUST run with `DETERMINISTIC=true SEED=12345`. Non-deterministic test runs MUST NOT be used as pass/fail evidence for deploys.

### 3.4 Threshold Modification Protocol

`test-config/thresholds.json` MUST NOT be modified to make a failing test pass. Any threshold change requires:
1. Evidence from ≥ 3 real Pi measurements justifying the new value, OR
2. A documented architectural change that makes the old threshold unreachable.

Threshold relaxation without evidence is a deploy blocker.

### 3.5 Module System Constraint

`test-runner/runner.js` and all files under `test-runner/` use ESM (`import`/`export`). All simulator and backend files use CommonJS (`require`). These MUST NOT be mixed. Any new test file MUST match the ESM convention of `test-runner/`.

---

## 4. RECOVERY SLAs

Recovery SLA is the maximum elapsed time from failure onset to **HEALTHY** state. Exceeding an SLA is a Class C or D failure, depending on component. All SLAs are measured from the screen's perspective (i.e., when the screen resumes successful polling), not from the backend's perspective.

### 4.1 Component Recovery SLAs

| Failure | SLA | Source |
|---------|-----|--------|
| Backend process restart | 30,000 ms | `test-config/thresholds.json:3` |
| PostgreSQL restart | 60,000 ms | `test-config/thresholds.json:4` |
| Network outage (full restore) | 15,000 ms | `test-config/thresholds.json:5` |
| Single screen watchdog reboot | 2,000–5,000 ms (reboot) + 1 poll cycle | `simulator/pi-appliance.js:42,267` |
| Content change propagation | ≤ 15,000 ms (one poll cycle) | `simulator/SUCCESS_CRITERIA.md:45` |

### 4.2 Fleet Recovery SLAs (Thundering Herd)

When backend restarts with ≥ 20 screens polling:
- All screens MUST resume polling within 30,000 ms [`simulator/SUCCESS_CRITERIA.md:122`].
- Zero backend timeout errors are permitted during recovery [`simulator/SUCCESS_CRITERIA.md:125`].
- Manifest compute P95 during recovery MUST remain < 200 ms [`simulator/SUCCESS_CRITERIA.md:127`].

### 4.3 OTA Recovery SLAs

| Event | Expected | SLA |
|-------|----------|-----|
| E1 `ota_interrupted` | 5% of updates | Screen MUST revert to previous version and resume normal polling within 30,000 ms |
| E2 `ota_compat_fail` | 10% of updates | Screen MUST rollback and resume within 30,000 ms |
| E3 `ota_fleet_degraded` | Never in production | Halt rollout; root-cause before proceeding |

### 4.4 SLA Breach Protocol

An SLA breach during a soak or chaos run MUST be recorded in `soak-reports/` as a named incident. It MUST NOT be silently discarded. SLA breaches on CI (seed=12345) are deploy blockers.

---

## 5. TRUTH HIERARCHY

When evidence from different environments conflicts, this hierarchy determines which source is authoritative.

```
Tier 1 (HIGHEST): Real Raspberry Pi hardware on production network
Tier 2:           Soak environment (soak.js, ≥ 30 minutes, ≥ 5 screens)
Tier 3:           Chaos CI suite (fake-pi.js, DETERMINISTIC=true, seed=12345)
Tier 4:           Basic/stress CI suites
Tier 5 (LOWEST):  Local ad-hoc simulator runs
```

### 5.1 Conflict Resolution Rules

**Rule T1:** A passing CI result DOES NOT override a failing real-Pi observation. Real Pi failures MUST be investigated and reproduced in CI before a fix is considered verified.

**Rule T2:** A failing soak result (Tier 2) blocks deploy even if CI (Tier 3/4) passes. The soak environment's longer observation window has higher authority on timing-sensitive failures.

**Rule T3:** Threshold values in `test-config/thresholds.json` derive from real-Pi measurements. If CI thresholds and real-Pi behavior diverge, real-Pi behavior is correct and thresholds MUST be updated with evidence.

**Rule T4:** The simulator uses checksum comparison for manifest change detection. The player (`useManifest.ts`) MUST also use checksum comparison. Version number comparison is incorrect and MUST NOT be used. The fix is present in `useManifest.ts` — do not revert it.

**Rule T5:** `fake-pi.js` deterministic mode (DETERMINISTIC=true) is valid for CI regression testing. It MUST NOT be used to claim production readiness. Production readiness requires Tier 1 or Tier 2 evidence.

### 5.2 Simulator Fidelity Limits

The simulator does not model:
- Hardware-level GPIO failures
- SD card corruption
- HDMI handshake failures
- Physical power interruptions
- Kernel OOM kills

Failures in these categories on real Pi hardware are not detectable by CI and MUST be handled in the Pi appliance runbook (`OPERATIONS.md`), not in thresholds.

---

## 6. DEPLOY-BLOCKING FAILURES

A release MUST NOT be deployed when any of the following conditions are true. This list is exhaustive; anything not listed is not a hard blocker (but MAY be a soft blocker at reviewer discretion).

### 6.1 Hard Blockers

| # | Condition | Rationale |
|---|-----------|-----------|
| DB-1 | Any CI suite fails (`make test-ci` exits non-zero) | — |
| DB-2 | Any threshold in §3.2 is breached in CI | — |
| DB-3 | Desync count ≥ 1 in any CI run | Content correctness guarantee broken |
| DB-4 | `test-config/thresholds.json` was modified without evidence per §3.4 | Prevents threshold gaming |
| DB-5 | `useManifest.ts` checksum comparison reverted to version comparison | Known bug; reversion reintroduces silent content staleness |
| DB-6 | Any Class F failure (§2 F1/F2/F3) observed in soak or CI | Data integrity |
| DB-7 | Fleet poll success rate < 98% in chaos suite | Below minimum reliability contract |
| DB-8 | Backend recovery SLA breached in chaos suite (> 30,000 ms) | Below recovery contract |
| DB-9 | DB recovery SLA breached in chaos suite (> 60,000 ms) | Below recovery contract |
| DB-10 | OTA fleet success rate < 80% in soak run | E3 class failure |
| DB-11 | `GET /health/ready` returns 503 on the deployment target before cutover | Target not ready |
| DB-12 | `reports/latest.json` is absent or stale (not produced by the current CI run) | No evidence of passing state |

### 6.2 Conditional Blockers

These block deploy only when the change touches the indicated component:

| Component | Condition | Blocker |
|-----------|-----------|---------|
| Manifest computation | P95 latency > 200 ms under 20-screen load | Yes |
| Rate limiter | Read limit changed below 120/min without fleet size justification | Yes |
| Backend timeout | Default timeout changed below 10,000 ms | Yes |
| OTA rollout | Initial rollout percentage changed above 30% without soak evidence | Yes |
| Polling | Poll interval changed from 15,000 ms without updating all dependents | Yes |

### 6.3 What Is NOT a Deploy Blocker

- Soak stability score below 100 — scores are diagnostic, not gates.
- Memory growth alert (> 20 MB in soak) — alert for investigation; not a gate unless growth is unbounded across the full soak duration.
- P95 event loop lag > 100 ms in soak — alert threshold only; not a CI gate.
- Single screen watchdog reboot during chaos — expected behavior; not a failure.
- OTA interruption rate ≈ 5% or compat failure rate ≈ 10% — these are modelled fault rates, not defects.

---

## 7. POLLING CONTRACT

All screens and simulators MUST conform to the following polling contract:

| Parameter | Value | Source |
|-----------|-------|--------|
| Nominal poll interval | 15,000 ms | `simulator/fake-pi.js:21` |
| Fetch timeout per request | 5,000 ms | `simulator/fake-pi.js:22` |
| Startup jitter window | 0–15,000 ms | `simulator/fake-pi.js:96` |
| Watchdog trip threshold | 3 consecutive failures | `simulator/pi-appliance.js:42` |
| Reboot delay range | 2,000–5,000 ms | `simulator/pi-appliance.js:267` |
| Manifest stale warning | 120,000 ms | `simulator/pi-appliance.js:41` |
| Change detection method | Checksum comparison | `useManifest.ts` |

Any implementation that uses version-number comparison instead of checksum comparison violates this contract and introduces Class D failure D2 silently.

---

## 8. RATE LIMIT CONTRACT

The backend enforces three rate limit tiers per IP [`backend/src/middleware/rateLimiter.js:53`]:

| Tier | Limit | Window | Intended Consumer |
|------|-------|--------|-------------------|
| `read` | 120 req / min | 60,000 ms | Manifest polling (10 screens × 15s ≈ 4 req/min/screen) |
| `write` | 60 req / min | 60,000 ms | Content and schedule mutations |
| `heavy` | 10 req / min | 60,000 ms | Bootstrap and admin operations |

Screens MUST NOT exceed 4 requests per minute per screen at the polling endpoint. Deployments with more than 30 screens behind a single NAT MUST validate that aggregate polling does not breach the `read` limit.

---

## 9. STABILITY SCORE CONTRACT

The soak stability score is a diagnostic instrument, not a CI gate. Its formula is fixed:

```
uptimeScore  = min(100, uptimePct)
rebootScore  = max(0, 100 - (totalReboots / max(1, screenCount)) * 5)
staleScore   = max(0, 100 - totalStale * 2)
memScore     = max(0, 100 - max(0, memGrowthMb) * 2)
lagScore     = max(0, 100 - p95Lag / 10)

stabilityScore = uptimeScore*0.4 + rebootScore*0.25 + staleScore*0.15 + memScore*0.1 + lagScore*0.1
```
[`simulator/soak.js:602`]

Alert thresholds within soak (non-blocking, investigative):

| Metric | Alert If |
|--------|----------|
| Poll success rate | < 95% |
| Memory growth | > 20 MB over run duration |
| P95 event loop lag | > 100 ms |
| Stale manifest events | > 5 |
| OTA success rate | < 80% → deploy blocker DB-10 |

The formula MUST NOT be changed to inflate scores on a failing soak. Score modifications require an ADR.

---

## 10. CONTRACT MAINTENANCE

- This document MUST be updated before any change to `test-config/thresholds.json`, the polling interval, health endpoint response shape, or rate limit presets.
- PRs that change any value referenced in §3.2, §4, or §7 MUST include a diff of the affected section of this document.
- Disputes over whether a failure is a deploy blocker are resolved by this document. If this document is silent, the default answer is: **ship with a documented rollback plan.**

---

## 11. OTA OPERATIONAL THRESHOLDS

These thresholds govern OTA rollout behaviour (see `OTA_GOVERNANCE.md`). They are
**operational parameters**, not CI performance gates. They are enforced by
`backend/src/lib/rollout-state.js` and validated for drift by `validate-contracts.js`
but are NOT required to appear in `test-runner/runner.js` `performThresholdGating()`.

All values live in `test-config/thresholds.json` under the `ota` key.

| Metric | Value | Fail Condition |
|--------|-------|----------------|
| Ring 1 max coverage | 30% | Rollout attempts > 30% in Ring 1 |
| Ring 2 max coverage | 70% | Rollout attempts > 70% in Ring 2 |
| Min fleet OTA success rate | 80% | < 80% triggers automatic rollback (RT1) |
| Observation window per ring | 300,000 ms | Promotion before window elapses is blocked |
| Ring 3 rollback window | 3,600,000 ms | Rollback not permitted after window expires |

### 11.1 OTA Deploy Blockers

| # | Condition |
|---|-----------|
| OTA-DB1 | `ota.ring1_max_pct` or `ota.ring2_max_pct` in `thresholds.json` differs from this table |
| OTA-DB2 | `ota.min_fleet_success_rate` < 80 (weakening rollback sensitivity) |
| OTA-DB3 | Any ring promotion attempted before `ota.observation_window_ms` has elapsed |
| OTA-DB4 | Rollout state machine bypassed (direct version push to > Ring 0 without state tracking) |

### 11.2 Modification Protocol

Changes to OTA thresholds require the same evidence standard as §3.4:
- Ring size changes (ring1_max_pct, ring2_max_pct): evidence from ≥ 1 full real-Pi
  rollout at the proposed ring size with no rollback triggers firing.
- Success rate floor (min_fleet_success_rate): MUST NOT decrease below 80 without
  a written post-mortem showing the lower rate is structurally expected and bounded.

---

## 12. SECURITY ENROLLMENT THRESHOLDS

These thresholds govern screen enrollment and token lifecycle (see `SECURITY_MODEL.md` §3).
They are **operational parameters** enforced by `backend/src/middleware/screenAuth.js`
and the enrollment flow at `POST /screens/enroll`.
All values live in `test-config/thresholds.json` under the `security` key.

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| Session token expiry | 86,400,000 ms (24h) | Token used after expiry must be rejected (401) |
| Token refresh window | 3,600,000 ms (1h) | Pi must refresh within this window before expiry |
| Max failed enrollments | 5 attempts | Exceeded → screen enrollment locked for 1h |
| Enrollment token expiry | 2,592,000,000 ms (30 days) | OET used after expiry must be rejected (401) |

### 12.1 Drift Registry Requirement

The gap registry (`soak-reports/gap-registry.json`) is validated by `validate-contracts.js`.
SEVERE drift on any gated metric blocks Ring 1 promotion until covered by an active,
time-bound waiver in `soak-reports/gap-waivers.json`.

| # | Condition |
|---|-----------|
| DRIFT-DB1 | Gap registry absent — WARN (no observations yet); NOT a deploy blocker |
| DRIFT-DB2 | SEVERE drift entry exists without a covering active waiver — Ring 1 promotion blocked |
| DRIFT-DB3 | Waiver `waived_until` is in the past — waiver is expired, not effective |

### 12.2 Modification Protocol

Security threshold changes require:
- Session/refresh expiry: operational review + update of all enrolled Pi configurations
- max_failed_enrollments: security review (reducing below 3 significantly impacts usability)

These are operational parameters. They do NOT appear in `test-runner/runner.js` `performThresholdGating()`.
