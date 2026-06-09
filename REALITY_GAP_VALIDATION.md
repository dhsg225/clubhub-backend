# REALITY GAP VALIDATION

**Version:** 1.0.0
**Status:** ENFORCED
**Authority:** This document defines mandatory validation requirements before any
simulator result can claim production equivalence. Governed by Truth Hierarchy §5
of CLUBHUB_SYSTEM_CONTRACTS.md.

---

## 0. PURPOSE

The simulator (fake-pi.js, soak.js, pi-appliance.js) is a Tier 3–5 authority. It
cannot substitute for Tier 1 (real Pi hardware) evidence for production decisions.
This document defines where the simulator deviates from reality, how to measure
deviation, and the mandatory evidence required before each deployment ring promotion.

---

## 1. SIMULATOR ASSUMPTIONS CATALOGUE

Every assumption here is a potential source of false confidence. Each is classified
by gap type and expected direction of error.

### 1.1 Timing Assumptions

| Assumption ID | Simulator Behaviour | Real Pi Deviation | Gap Class | Error Direction |
|---------------|--------------------|--------------------|-----------|----------------|
| T1 | Poll jitter: uniform random 0–15,000ms on startup | Hardware boot adds 15–45s before Node is ready | Timing | Optimistic |
| T2 | Reboot delay: 2,000–5,000ms | Pi power cycle + OS boot: 20–45s | Timing | Optimistic |
| T3 | Fetch timeout: 5,000ms, fails cleanly | Real TCP timeout may stall for full OS timeout (90s default) | Timing | Optimistic |
| T4 | Poll intervals: ±jitter only | SD card I/O variance adds 50–500ms per cycle | Timing | Optimistic |
| T5 | Watchdog fires at exactly 3 failures | Process scheduling may delay watchdog check | Timing | Optimistic |

### 1.2 Resource Assumptions

| Assumption ID | Simulator Behaviour | Real Pi Deviation | Gap Class | Error Direction |
|---------------|--------------------|--------------------|-----------|----------------|
| R1 | Single Node.js process per screen | Real Pi runs OS + systemd + Node + Chromium | Resource | Optimistic |
| R2 | Memory growth: not modelled | Chromium Kiosk + React player: 200–400MB baseline | Resource | Optimistic |
| R3 | CPU idle between polls | Chromium rendering + compositor: 15–40% CPU continuous | Resource | Optimistic |
| R4 | No thermal throttling | Pi 4: throttles at 80°C, common in enclosures | Resource | Optimistic |
| R5 | Network is always TCP/IP | Wifi drops require reconnect: adds 2–15s | Resource | Optimistic |

### 1.3 Hardware Assumptions

| Assumption ID | Simulator Behaviour | Real Pi Deviation | Gap Class | Error Direction |
|---------------|--------------------|--------------------|-----------|----------------|
| H1 | Storage: in-memory (no disk I/O) | SD card read: 15–30 MB/s; write: 5–15 MB/s; degrades with age | Hardware | Optimistic |
| H2 | Cache persist: instant | Disk cache write under load: 100–500ms | Hardware | Optimistic |
| H3 | No SD card corruption | SD cards corrupt under power loss; cache may be unreadable | Hardware | Pessimistic |
| H4 | HDMI always connected | HDMI hotplug: Chromium may crash or blank | Hardware | Not modelled |
| H5 | Power: always stable | Undervoltage: Pi throttles and may reboot | Hardware | Optimistic |

### 1.4 Environmental Assumptions

| Assumption ID | Simulator Behaviour | Real Pi Deviation | Gap Class | Error Direction |
|---------------|--------------------|--------------------|-----------|----------------|
| E1 | Network: configured shim faults only | Captive portals, DNS hijacking, firewall rules vary per venue | Environmental | Optimistic |
| E2 | Time: system clock accurate | Venues without NTP: clock drift ±minutes; affects manifest TTL | Environmental | Optimistic |
| E3 | All screens same binary | Operators may run mixed firmware versions | Environmental | Optimistic |
| E4 | No physical access disruption | Venue staff may unplug, reposition, or power-cycle hardware | Environmental | Not modelled |

### 1.5 Application Assumptions

| Assumption ID | Simulator Behaviour | Real Pi Deviation | Gap Class | Error Direction |
|---------------|--------------------|--------------------|-----------|----------------|
| A1 | Checksum comparison: correct (post-fix) | Legacy Pi builds before fix: version comparison (known bug) | Application | Optimistic |
| A2 | React player: not exercised | useManifest.ts hook: re-render on checksum change not simulated | Application | Optimistic |
| A3 | No browser cache invalidation | Chromium disk cache may serve stale assets for hours | Application | Optimistic |
| A4 | No CORS/HTTPS issues | Mixed-content blocking, expired TLS certs not modelled | Application | Optimistic |

---

## 2. GAP CLASSIFICATION SYSTEM

```
CLASS A — Timing Gap
  Simulator timing deviates from real hardware timing.
  Risk: recovery SLAs pass in CI but fail on real Pi.
  Mitigation: add hardware timing buffer to SLA definitions.

CLASS B — Resource Gap
  Simulator omits resource contention present on real hardware.
  Risk: stability score is inflated; real Pi degrades under sustained load.
  Mitigation: soak tests on real Pi before ring promotion.

CLASS C — Hardware Gap
  Physical failure modes not simulated at all.
  Risk: real Pi fails in ways CI cannot detect.
  Mitigation: pre-deployment hardware checklist (PILOT-VENUE-CHECKLIST.md).

CLASS D — Environmental Gap
  Network/power/physical environment not reproducible in sim.
  Risk: venue-specific failure modes invisible until deployment.
  Mitigation: pilot venue validation protocol (§5 below).
```

**Error direction:**
- **Optimistic**: simulator reports better results than real hardware → may miss real failures
- **Pessimistic**: simulator is harder than real hardware → may block valid deployments
- **Not modelled**: simulator cannot produce data on this failure mode

The catalogue above is predominantly **Optimistic**. The simulator provides a
lower bound on failure rate, not an upper bound.

---

## 3. DRIFT SCORING MODEL

Drift is measured as the ratio of real-Pi observation to simulator prediction for
the same metric under the same conditions.

```
Drift(metric) = Real_Pi_Value / Simulator_Value

Interpretation:
  Drift = 1.00        — perfect calibration
  Drift > 1.00        — simulator underestimates (optimistic gap)
  Drift < 1.00        — simulator overestimates (pessimistic gap)
  |Drift - 1.0| > 0.3 — SIGNIFICANT GAP: record in gap registry
  |Drift - 1.0| > 1.0 — SEVERE GAP: threshold recalibration required
```

### 3.1 Tracked Drift Metrics

| Metric | Simulator Source | Real Pi Source | Significance Threshold |
|--------|-----------------|----------------|----------------------|
| Reboot recovery time | 2,000–5,000ms | Pi OS boot cycle | Drift > 1.3 |
| Poll interval variance | pollDriftMs() from events | Real poll log timestamps | Drift > 1.2 |
| Backend restart recovery | recoveryTimeAfterMark('backend_restart') | Field observation | Drift > 1.3 |
| Steady-state CPU% | Not measured | htop / /proc/stat | N/A (establish baseline) |
| Memory growth/hour | soak memScore | ps -o rss | Drift > 1.5 |
| P95 manifest latency | p95PollLatency() | Production logs | Drift > 1.2 |

### 3.2 Drift Score Formula

```
ComponentDrift(m) = |Drift(m) - 1.0|

OverallDriftScore = max(ComponentDrift for all tracked metrics)

Interpretation:
  0.00 – 0.10   — CALIBRATED
  0.10 – 0.30   — DEGRADED (document gap, monitor)
  0.30 – 1.00   — SIGNIFICANT (recalibrate threshold or add buffer)
  > 1.00        — SEVERE (do not use simulator data for this metric)
```

Drift measurements are recorded in `soak-reports/gap-registry.json` by
`simulator/reality-gap.js`.

---

## 4. SIMULATOR OPTIMISM / PESSIMISM CLASSIFICATION

The overall simulator posture is **Optimistic**. It produces results that are
better than real-Pi in almost every measured dimension. Specific exceptions:

**Pessimistic dimensions (simulator is harder):**
- SD card corruption (H3): simulator cannot serve a corrupted cache; real Pi may
  fall back to a stale but valid cached manifest instead of failing hard.
- Chromium crash recovery: real Chromium may recover from JavaScript errors silently
  rather than generating a failed poll.

**Implication:** When CI passes but real Pi fails, investigate Assumptions T1–T5,
R1–R5 first. When real Pi passes but CI fails, investigate H3, A3 first.

---

## 5. REAL-HARDWARE VALIDATION CADENCE

### 5.1 Mandatory Gates (Block deployment if not satisfied)

| Gate | Trigger | Minimum Evidence | Pass Criteria |
|------|---------|-----------------|---------------|
| V1 | New major backend version | 1 Pi × 24h soak | Stability score ≥ 85, zero watchdog reboots |
| V2 | Ring 1 promotion (30% fleet) | 1 Pi × 4h + normal venue conditions | Recovery times ≤ 1.3× CI thresholds |
| V3 | Ring 3 promotion (100% fleet) | 3 Pi × 24h at different venues | Zero desync events, poll success ≥ 98% |
| V4 | OTA firmware update | 1 Pi full OTA cycle | Successful, checksum-verified completion |
| V5 | New venue type (first deployment) | 1 Pi × 48h in target environment | Stable under venue-specific network conditions |

### 5.2 Advisory Validation (Inform deployment, not mandatory gate)

| Check | When | Purpose |
|-------|------|---------|
| Thermal measurement | Summer season / enclosed venues | Identify throttling risk |
| SD card I/O test | Hardware > 18 months old | Detect degraded cards before failure |
| Mixed firmware validation | When gap-registry shows A3 drift | Confirm version coexistence |

### 5.3 Validation Failure Handling

If a mandatory gate fails:
1. Record failure in `soak-reports/gap-registry.json` with observation date and delta
2. Determine whether the gap is in a simulator assumption (update assumption table)
   or a real regression (block deployment per existing deploy blocker rules)
3. If the gap reveals a threshold that needs adjustment, follow §3.4 of
   CLUBHUB_SYSTEM_CONTRACTS.md: evidence required before any threshold change

---

## 6. GAP REGISTRY

The gap registry is a persistent JSON file at `soak-reports/gap-registry.json`.
It is written by `simulator/reality-gap.js` and read by the soak report tool.

```json
{
  "format_version": "1.0",
  "entries": [
    {
      "date": "ISO-8601",
      "assumption_id": "T2",
      "metric": "reboot_recovery_ms",
      "simulator_value": 3500,
      "real_pi_value": 32000,
      "drift": 9.14,
      "classification": "SEVERE",
      "notes": "Pi 4 with clean SD: ~30s cold boot observed"
    }
  ]
}
```

`simulator/reality-gap.js` provides:
- `recordObservation(assumptionId, metric, simulatorValue, realPiValue, notes)`
- `computeDrift(simulatorValue, realPiValue)` → `{ ratio, classification }`
- `generateReport()` → summary per assumption class with overall drift score

---

## 7. INTERACTION WITH EXISTING SYSTEMS

| System | Interaction |
|--------|-------------|
| CLUBHUB_SYSTEM_CONTRACTS.md §5 | This document operationalises Truth Hierarchy Rule T5 |
| thresholds.json | Drift > 1.3 on any recovery metric triggers a threshold review under §3.4 |
| validate-contracts.js | Gap registry absence or SEVERE drift on a gated metric is a deploy blocker |
| soak-report.js | Gap registry summary appended to soak stability report |
| PILOT-VENUE-CHECKLIST.md | V2/V3 gates reference the checklist for hardware validation steps |

---

## 8. KNOWN UNMODELLED RISKS (RESIDUAL GAPS)

These are real Pi failure modes that this document acknowledges but cannot gate on
because no automated measurement path exists today:

- HDMI handshake failure on screen power-on (H4)
- Venue staff physical interaction (E4)
- React application memory leak over multi-day runtime (A2 extension)
- Browser disk cache stale-content scenarios (A3)

These require manual observation during pilot venue deployments. They are NOT deploy
blockers today, but any confirmed occurrence must be added to Assumption Catalogue
and evaluated for automated detection.
