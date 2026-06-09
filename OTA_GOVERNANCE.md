# OTA GOVERNANCE

**Version:** 1.0.0
**Status:** ENFORCED
**Authority:** Governs all software update operations on the Pi fleet. Derived from
and consistent with CLUBHUB_SYSTEM_CONTRACTS.md §2 Class E failures and §5 Truth
Hierarchy. OTA thresholds governed by `test-config/thresholds.json` `ota` section.

---

## 0. PURPOSE

Uncontrolled OTA updates are the highest-risk operation on a distributed appliance
fleet. A bad update pushed to 100% of fleet simultaneously can render all screens
dark with no automatic recovery path. This document defines the rings, state
machine, blast radius controls, and rollback protocols that bound that risk.

---

## 1. DEPLOYMENT RINGS

Ring assignment is deterministic based on screen ID. Formula derived from
`simulator/soak.js`:

```javascript
ringPct = simpleHash(screenId) % 100
// Ring 0: ringPct < ring0_size (1 screen or ~1%)
// Ring 1: ringPct < 30
// Ring 2: ringPct < 70
// Ring 3: 100%
```

| Ring | Name | Coverage | Max Affected Screens |
|------|------|----------|---------------------|
| 0 | Canary | 1 screen (designated) | 1 |
| 1 | Early | 30% of fleet | 0.30 × N |
| 2 | Majority | 70% of fleet | 0.70 × N |
| 3 | Full | 100% of fleet | N |

**Ring 0 selection:** The canary screen MUST be designated in venue configuration,
not selected by hash. It should be at a venue with physical observation capability.
If no canary is designated, Ring 0 is skipped and Ring 1 is the initial ring.

**Ring sizes are governed thresholds.** The 30% and 70% values live in
`test-config/thresholds.json` under `ota.ring1_max_pct` and `ota.ring2_max_pct`.
Changing them requires a contract amendment per §3.4 of SYSTEM_CONTRACTS.

---

## 2. ROLLOUT STATE MACHINE

```
STATES:
  PENDING     — Update prepared, not yet deployed
  STAGING     — Validated in CI; awaiting ring 0 deployment
  RING_0      — Deployed to canary screen(s); observation window active
  RING_1      — Deployed to 30% of fleet; observation window active
  RING_2      — Deployed to 70% of fleet; observation window active
  RING_3      — Deployed to 100% of fleet; observation window active
  COMPLETE    — Update confirmed successful fleet-wide
  ROLLED_BACK — Update aborted; previous version restored
  FROZEN      — Rollout halted by freeze condition; no state transitions permitted
  QUARANTINED — Specific screen excluded from rollout due to health failure

VALID TRANSITIONS:
  PENDING     → STAGING      (all CI gates pass, contract validation passes)
  STAGING     → RING_0       (operator initiates, canary screen designated)
  STAGING     → RING_1       (no canary designated; observation window skipped)
  RING_0      → RING_1       (observation window elapsed, success rate ≥ threshold)
  RING_0      → ROLLED_BACK  (rollback trigger detected)
  RING_0      → FROZEN       (freeze condition detected)
  RING_1      → RING_2       (observation window elapsed, success rate ≥ threshold)
  RING_1      → ROLLED_BACK  (rollback trigger detected)
  RING_1      → FROZEN       (freeze condition detected)
  RING_2      → RING_3       (observation window elapsed, success rate ≥ threshold)
  RING_2      → ROLLED_BACK  (rollback trigger detected)
  RING_2      → FROZEN       (freeze condition detected)
  RING_3      → COMPLETE     (observation window elapsed, success rate ≥ threshold)
  RING_3      → ROLLED_BACK  (rollback trigger detected within rollback window)
  FROZEN      → (previous ring state)  (freeze lifted by operator)
  ROLLED_BACK → PENDING      (defect remediated, new update prepared)
  any screen  → QUARANTINED  (health score below quarantine threshold)

INVALID TRANSITIONS (rejected by state machine):
  Any ring → lower ring (cannot downgrade ring level, only rollback entirely)
  COMPLETE → any (update is done; new update required for any change)
  ROLLED_BACK → RING_* (must go through PENDING → STAGING again)
```

### 2.1 Observation Windows

Each ring has a mandatory observation window before promotion. No promotion occurs
during the window regardless of success rate.

| Ring | Observation Window | Source |
|------|--------------------|--------|
| Ring 0 | 1 hour minimum | Operator judgement |
| Ring 1 | 5 minutes (governed: `ota.observation_window_ms`) | thresholds.json |
| Ring 2 | 5 minutes (governed: `ota.observation_window_ms`) | thresholds.json |
| Ring 3 | 1 hour (governed: `ota.rollback_window_ms`) | thresholds.json |

The Ring 3 observation window is the **rollback window**: after this window expires
with no rollback trigger, the update is COMPLETE and rollback requires a new update.

---

## 3. BLAST RADIUS LIMITS

Blast radius is the maximum number of screens that can be in a broken state
simultaneously as a result of a single update operation.

| Ring | Max Blast Radius | Hard Stop If |
|------|-----------------|--------------|
| Ring 0 | 1 screen | — |
| Ring 1 | 30% of fleet | > 30% of Ring 1 screens UNHEALTHY |
| Ring 2 | 70% of fleet (cumulative) | > 20% of Ring 2 screens UNHEALTHY |
| Ring 3 | 100% of fleet (cumulative) | > 10% of fleet UNHEALTHY |

"UNHEALTHY" means the screen meets UNHEALTHY definition from SYSTEM_CONTRACTS §1.2:
consecutive poll failures ≥ 3, OR checksum mismatch after two poll cycles.

When a Hard Stop threshold is crossed, the rollout MUST transition to FROZEN
immediately. FROZEN → ROLLED_BACK requires operator action.

---

## 4. ROLLBACK TRIGGERS

Rollback is automatic when any of the following are true during any observation
window. The state machine transitions to ROLLED_BACK without operator action.

| ID | Trigger | Threshold | Source |
|----|---------|-----------|--------|
| RT1 | Fleet OTA success rate below floor | < 80% | thresholds.json `ota.min_fleet_success_rate` |
| RT2 | Any Class F failure observed (desync, version regression, checksum collision) | Any instance | SYSTEM_CONTRACTS §2 |
| RT3 | Ring health score below floor during observation window | < 0.7 (70%) | Computed from ring screens |
| RT4 | Backend health returns 503 during ring promotion | Any 503 from /health/ready | SYSTEM_CONTRACTS §1.2 |
| RT5 | Rollback SLA exceeded on UNHEALTHY screen | > 60,000ms | SYSTEM_CONTRACTS §4.1 |

**Rollback SLA:** When RT1–RT5 trigger, the rollback MUST complete within the
`recovery.backend_restart_ms` threshold (30,000ms) per SYSTEM_CONTRACTS §4.1.
If rollback itself fails within SLA, escalate to operator as P1 incident.

**Manual rollback:** An operator may trigger rollback at any time during any ring
state except COMPLETE (which requires a new update).

---

## 5. ROLLOUT FREEZE CONDITIONS

A freeze halts all ring progression without initiating rollback. State is preserved;
operator must explicitly lift the freeze.

| ID | Condition | Detection |
|----|-----------|-----------|
| FC1 | Fleet enters UNHEALTHY state (§1.3 of SYSTEM_CONTRACTS) | Fleet poll success rate < 98% |
| FC2 | CI contract validation fails | `make validate-contracts` exits non-zero |
| FC3 | Any active incident with severity ≥ P2 in OPERATIONS.md runbook | Operator declares incident |
| FC4 | Observed Class F failure anywhere in fleet | Desync, version regression, checksum collision |
| FC5 | Backend `/health/ready` returning 503 for > 30s | Backend health monitor |
| FC6 | Soak run (Tier 2) failed within last 24h with no resolution | Soak report stability score < 70 |

Freeze conditions FC1, FC4, FC5 are machine-detectable. FC2, FC3, FC6 require
integration with CI status or operator input.

---

## 6. UNHEALTHY NODE QUARANTINE

A screen is quarantined when it fails health criteria that are independent of the
update being deployed. Quarantined screens are excluded from ring coverage metrics
so that pre-existing hardware failures do not block a valid rollout.

**Quarantine criteria:**
- Poll failures ≥ 3 consecutive cycles before the update was initiated (pre-existing)
- Recovery time after watchdog reboot > 2× the recovery SLA
- Screen unreachable for > 5 minutes (2 poll cycles + 3 watchdog cycles)

**Quarantine effects:**
- Screen excluded from blast radius calculation
- Screen excluded from success rate calculation for ring promotion
- Screen flagged in fleet dashboard with QUARANTINED status
- Operator notified via ops-check.py output

**Quarantine is NOT permanent.** A screen exits quarantine when it completes
3 consecutive successful polls after an operator-confirmed health check.

---

## 7. DEPLOYMENT HEALTH SCORING

The deployment health score is computed per ring, per observation window. It is
separate from the soak stability score (which is a fleet-wide long-duration metric).

```
RingHealthScore = (
  successfulUpdates / eligibleScreens    ×  0.50   +
  pollSuccessRate / 100                  ×  0.30   +
  (1 - (unhealthyScreens / totalScreens)) × 0.20
)

Pass threshold: RingHealthScore ≥ 0.85 for ring promotion
Stop threshold: RingHealthScore < 0.70 triggers Hard Stop (→ FROZEN)
```

Score is computed at the end of each observation window. Intermediate score
drops below 0.70 trigger immediate Hard Stop regardless of window elapsed time.

---

## 8. ADOPTION TRACKING

Adoption is the percentage of fleet screens running the target version, by ring.

```
AdoptionPct(ring) = (
  screens_on_target_version_in_ring / total_eligible_screens_in_ring
) × 100

Target adoption before ring promotion:
  Ring 0 → Ring 1: AdoptionPct(0) = 100% (all canary screens updated)
  Ring 1 → Ring 2: AdoptionPct(1) ≥ 95% (allow 5% straggler tolerance)
  Ring 2 → Ring 3: AdoptionPct(2) ≥ 95%
  Ring 3 → COMPLETE: AdoptionPct(3) ≥ 95%
```

Stragglers (screens that have not adopted after 2× observation window):
- Check against QUARANTINED list first
- If not quarantined: flag for manual investigation
- Do NOT block ring promotion if adoption ≥ 95% and stragglers are in QUARANTINED

---

## 9. ROLLBACK SLA

| Phase | SLA | Measurement |
|-------|-----|-------------|
| Rollback decision | ≤ 0ms (automatic on trigger) | Trigger detection → state transition |
| Rollback propagation | ≤ 1 poll cycle per screen (15,000ms) | Ring-wide reversion |
| Rollback confirmation | ≤ 3 poll cycles (45,000ms) | 95% of screens on previous version |
| Full fleet rollback | ≤ 5 poll cycles (75,000ms) | 95% of fleet on previous version |

If rollback confirmation has not occurred within 75,000ms, the fleet is in a
SPLIT-BRAIN state (see CLUBHUB_STATE_AUTHORITY.md §6) and requires operator action.

---

## 10. CONTRADICTION WITH EXISTING CONTRACTS

No contradictions identified. This document extends:
- SYSTEM_CONTRACTS §2 Class E (OTA failure taxonomy) — ring-level blast radius
  bound added. Class E failure rates (5% interrupted, 10% compat fail) are
  modelled failure rates, not deploy blockers, consistent with §6.3.
- SYSTEM_CONTRACTS §5 Rule T5 — real-Pi observation required for V2/V3 gates
  is reinforced by Ring 0 canary protocol.
- thresholds.json — new `ota.*` section governs ring sizes and observation windows.
  Contract amendment in SYSTEM_CONTRACTS §11.

---

## 11. INTERACTION WITH OTHER MATURITY DOCUMENTS

| Document | Interaction |
|----------|-------------|
| REALITY_GAP_VALIDATION.md §5 | V1–V5 gates are Ring 0 prerequisites |
| CLUBHUB_STATE_AUTHORITY.md | Split-brain recovery applies during rollback |
| OBSERVABILITY.md | Ring state transitions generate PLATFORM class events |
| SECURITY_MODEL.md | OTA package must pass trust chain verification before Ring 0 |
| CAPACITY_MODEL.md | OTA traffic per ring calculated from fleet size and image size |
