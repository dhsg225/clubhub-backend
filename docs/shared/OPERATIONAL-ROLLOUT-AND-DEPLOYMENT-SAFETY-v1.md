# OPERATIONAL ROLLOUT AND DEPLOYMENT SAFETY v1

**Era:** System Materialization
**Status:** CANONICAL
**Scope:** Staged deployment governance, replay-first validation, shadow rules, rollback authority, venue sequencing, degraded rollout, operator trust preservation, unsafe deployment triggers

---

## 1. PURPOSE

Deployment is not the end of the implementation process. It is the moment at which the system becomes responsible for real operational outcomes at real venues. A deployment that introduces a regression in determinism, a visual distinction failure, or a state machine error does not fail silently — it fails in front of operators who are trying to run live events.

Deployment safety is constitutional. The staged rollout, the shadow validation, the rollback authority — these are not DevOps preferences. They are the mechanism by which constitutional correctness is verified in the deployment context before operators are exposed to it.

**A deployment that cannot be rolled back safely is not a deployment — it is a gamble.**

---

## 2. STAGED DEPLOYMENT GOVERNANCE

### 2.1 The Six Stages

Every deployment to the production fleet proceeds through six stages. Stages are not skipped. Time minimums are not negotiated.

**Stage 0: Simulation Validation**
- Full mandatory simulation scenario suite runs against the deployment candidate
- Replay parity suite runs (10 iterations per corpus packet)
- Component boundary check passes
- Observability coverage test passes
- `pnpm certify` produces PASS with recorded evidence hash
- Duration: as long as needed for full suite completion
- Gate: all checks must pass. No partial passes.

**Stage 1: Staging Environment**
- Deployed to a staging environment that mirrors production configuration (not development configuration)
- One operator per role performs a structured walkthrough:
  - Venue Operator: minimum viable understanding self-assessment, replay initiation/exit, incident acknowledgment
  - Fleet Operator: multi-venue status scan, anomaly identification
  - Platform Admin: OTA workflow, configuration review
- Observability sink monitored for unexpected state machine transitions
- Duration: minimum 4 hours with operator walkthroughs
- Gate: no structural issues identified; all walkthroughs pass the minimum viable understanding verification

**Stage 2: Shadow Deployment (Single Venue)**
- Deployed alongside the current production version at one venue — shadow mode receives the same inputs as production but its outputs are not displayed to real operators
- Corpus packet output from the shadow deployment is compared to the production deployment's output
- Any divergence in determinism hash is a blocking failure
- Duration: minimum 24 hours covering at least one full operational day cycle
- Gate: zero determinism divergences; zero unexpected state transitions; zero observability gaps

**Stage 3: Pilot Deployment (Single Live Venue)**
- Deployed to one live venue with operator awareness (operators know they are on a new build)
- Full observability monitoring for the first 48 hours
- Incident state machine behavior monitored for unexpected transitions
- LIVE/REPLAY distinction verified by manual observation at the venue
- Duration: minimum 48 hours; extended if any non-critical anomalies are detected
- Gate: no dangerous partial implementation states; no observability gaps; no operator-reported confusion events above baseline

**Stage 4: Expanded Deployment (5% of fleet)**
- Deployed to approximately 5% of active venues
- Automated monitoring watches for: TERMINAL state entries, replay parity divergence, observability gap rate, confusion event rate
- Confusion event rate compared to Stage 3 baseline — increase of >20% is a pause trigger
- Duration: minimum 72 hours
- Gate: no increase in dangerous state entries; confusion event rate within 20% of baseline; zero replay parity divergences

**Stage 5: Progressive Full Deployment (25% → 50% → 100%)**
- Each step: minimum 24-hour soak before advancing
- Automated rollback if monitoring thresholds are exceeded (see Section 4)
- Operator trust preservation protocol active (Section 6)
- Gate at each step: same thresholds as Stage 4

### 2.2 Stage Gate Authority

| Gate | Passes When |
|---|---|
| Stage 0 → Stage 1 | Platform Reliability Team confirms CI evidence |
| Stage 1 → Stage 2 | Operator Experience Team confirms walkthrough results |
| Stage 2 → Stage 3 | Verification Team confirms zero determinism divergences |
| Stage 3 → Stage 4 | Constitutional governance function signs off on pilot results |
| Stage 4 → Stage 5 | Platform Reliability Team confirms monitoring thresholds met |
| Stage 5 step advances | Automated monitoring (no manual gate if thresholds clear) |

---

## 3. REPLAY-FIRST DEPLOYMENT VALIDATION

The most important deployment validation is not uptime or latency — it is replay correctness. A deployment that breaks replay breaks the system's ability to audit itself and breaks operator trust in the historical record.

### 3.1 Mandatory Corpus Round-Trip at Stage 2

During shadow deployment, the full canonical corpus is replayed against the new build:
- Each corpus packet is loaded
- The rendering output hash is compared to the recorded expected hash (from the corpus certification run)
- Any packet that produces a different output hash is a blocking failure
- The comparison includes both the content rendering hash and the explanation payload hash

This ensures that the new build produces identical historical replays to the build that created the corpus. Divergence means either the new build has changed rendering behavior, or the corpus itself has been corrupted.

### 3.2 Replay Validation After Every Deployment Step

After each Stage 5 advancement (25% → 50% → 100%), the shadow deployment configuration is re-run against the new fleet cohort to verify that the expanded deployment continues to produce corpus-consistent replays. This is not redundant — different hardware profiles at different venues may expose platform-specific rendering divergences that were not present in the staging or pilot environments.

### 3.3 GovernedClock Validation

The first monitoring check in Stage 2 is GovernedClock consistency: does the deployed build use GovernedClock for all timestamps, with no wall-clock leakage? This is validated by:
- Advancing the GovernedClock in the shadow environment and verifying that all component timestamps advance accordingly
- Freezing the GovernedClock and verifying that no component produces a timestamp outside the frozen value

GovernedClock leakage in a deployed build produces non-deterministic replay and is a Stage 2 blocking failure.

---

## 4. SHADOW DEPLOYMENT RULES

Shadow deployment is a first-class deployment mode, not a temporary validation step. It exists throughout the deployment lifecycle and is the primary mechanism for catching divergences before operators are exposed.

### 4.1 Shadow Configuration Requirements

The shadow deployment:
- Receives identical inputs to the production deployment (same PRE resolution results, same event stream, same corpus packets)
- Produces outputs that are structurally identical to production outputs (same state machine transitions, same rendering outputs)
- Does NOT display outputs to operators (shadow mode is read-only)
- Maintains its own independent observability stream (separate from production monitoring)
- Runs on identical hardware to production (no "shadow on cheaper hardware" shortcuts)

### 4.2 Shadow Divergence Classification

When the shadow deployment produces a different output than production:

| Divergence Type | Severity | Response |
|---|---|---|
| Determinism hash mismatch | CRITICAL | Immediate rollback of shadow; investigation required before Stage 3 |
| State machine final state differs | CRITICAL | Stage halt; root cause investigation |
| Explanation payload hash mismatch | HIGH | Stage 3 blocked; explanation parity investigation |
| Rendering timing difference (no hash change) | LOW | Logged, monitored; does not block staging |
| Observability event count mismatch | MEDIUM | Observability gap investigation; may or may not block |

### 4.3 Shadow Persistence After Full Deployment

After 100% deployment, a shadow deployment continues to run on a designated validation venue. This venue receives all future production events and produces outputs that are compared to the production fleet. If future changes cause silent divergence in production, the shadow deployment detects it.

---

## 5. ROLLBACK AUTHORITY AND THRESHOLDS

### 5.1 Who Can Initiate Rollback

| Trigger | Authority |
|---|---|
| Automated monitoring threshold exceeded | Platform Reliability Team automated system |
| TERMINAL state entry on any production venue | Platform Reliability Team (immediate) |
| Replay parity divergence detected | Verification Team (immediate) |
| Constitutional governance function order | Constitutional governance function (immediate, overrides all) |
| Operator report of system-wide misunderstanding | Platform Reliability Team (within 30 minutes of report) |

### 5.2 Automated Rollback Thresholds

The automated monitoring system initiates rollback without human intervention when:

| Metric | Threshold |
|---|---|
| TERMINAL state entries per hour | >0 in any 1-hour window |
| Replay parity divergences | >0 |
| Observability gap rate (transitions without emission) | >0.1% |
| Incident state machine missed transitions | >0 |
| GovernedClock leakage detections | >0 |
| Confusion event rate | >300% of Stage 3 baseline |

These thresholds are zero-tolerance for determinism and replay integrity. The confusion event threshold is a trend signal — it indicates the deployment is producing a surface that operators cannot navigate.

### 5.3 Rollback Execution

Rollback returns to the previous certified build. Rollback execution time target: <5 minutes for Stage 3–5 deployments. The previous build's certification evidence is re-recorded as the active evidence.

After rollback, a post-rollback review is mandatory before any re-deployment attempt:
- Root cause identified and documented
- Architectural debt entry created
- Remediation plan confirmed by owning team
- Stage 0 re-run from scratch (no reuse of previous stage results)

### 5.4 No Forward-Fix Deployments

When a deployment is rolled back, the fix is not deployed as a hotfix directly to production. It proceeds through the full stage sequence from Stage 0. The urgency that makes hotfixes tempting is exactly the urgency that makes them dangerous — it is the pressure under which constitutional violations are introduced.

Exception: A production incident at severity level 3+ with no rollback path available. In this specific case, a constitutional governance function emergency decision is required before any hotfix proceeds.

---

## 6. VENUE ROLLOUT SEQUENCING

### 6.1 Venue Selection Criteria for Each Stage

Venues are selected for early deployment stages based on:

| Criterion | Why It Matters |
|---|---|
| Operator certification level | Stage 3 pilot must have a Level 2+ certified operator available |
| Venue operational complexity | Early stages select lower-complexity venues (fewer concurrent events, simpler schedule) |
| Connectivity reliability | Shadow deployment requires stable connectivity to produce clean comparison data |
| Incident history | Venues with recent incident history are deferred to later stages |
| Operator willingness | Stage 3 operators should be aware of and engaged in the pilot |

### 6.2 Venue Rollout Order Governance

The venue rollout order is not determined by geography, customer priority, or commercial relationships. It is determined by operational safety criteria. A commercially important venue that has complex operations and a recently incident-prone history rolls out later, not earlier. This may require explicit expectation management with venue operators.

The constitutional governance function has authority to modify the venue rollout order on operational safety grounds, overriding commercial recommendations.

### 6.3 No Forced Rollout

A venue that is experiencing an active incident at the time of their scheduled deployment step is deferred. The deployment does not proceed at that venue until the incident is fully resolved and the post-incident review is complete. Deploying during an incident compounds operational risk and contaminates incident root cause analysis.

---

## 7. DEGRADED ROLLOUT CONDITIONS

### 7.1 What Is a Degraded Rollout

A degraded rollout is a deployment that proceeds under non-ideal conditions: partial observability, limited operator availability for Stage 3 walkthroughs, constrained staging environment, or limited corpus availability.

### 7.2 Degraded Rollout Is Not Permitted for Constitutional Gates

The following stage gates are not degradable:

- Stage 0 simulation certification: must run fully, no partial suite acceptance
- Stage 2 shadow deployment: no time reduction below 24 hours
- Stage 2 corpus round-trip: every corpus packet must be verified
- Rollback capability: must exist at every stage; a deployment without rollback capability is not a deployment

### 7.3 Degraded Rollout Conditions That Pause Deployment

If any of the following exist during a deployment stage, that stage is paused:
- Observability sink unavailable or receiving less than 100% of expected emissions
- GovernedClock validation cannot be run
- The Verification Team is unavailable to review divergence reports
- Active incidents on venues scheduled for the next deployment step

---

## 8. OPERATOR TRUST PRESERVATION DURING ROLLOUT

### 8.1 The Trust Fragility Problem

Operators build trust in a system through consistent behavior. A deployment that changes visual behavior, changes interaction patterns, or changes surface organization — even if the change is an improvement — is a trust disruption. An operator who encounters unexpected behavior during a live event has their trust in the system reduced, not increased.

### 8.2 Operator Communication Requirements

Before any venue enters Stage 3 or beyond, the operators at that venue receive:
- A plain-language description of what is changing in this deployment
- Which surfaces will look or behave differently
- A 30-minute orientation session using the simulation harness to demonstrate the changes before the live deployment
- Contact information for the deployment team during the initial deployment period

### 8.3 Behavior-Preserving Deployment Discipline

When a deployment includes changes to visual behavior, interaction patterns, or surface organization:
- The change is described as part of the deployment evidence package
- The Operator Experience Team confirms that the change does not violate any perceptual invariant
- The change is included in the operator communication

Changes that operators would experience as unexpected — even if the system is working correctly — require a higher operator communication standard than purely infrastructure changes.

### 8.4 No Silent Surface Changes

A deployment that modifies the visual output of any operator-facing surface is not "silent." It is flagged in the deployment evidence and communicated to affected venues. The default assumption is: if it's different, the operator needs to know.

---

## 9. UNSAFE TO DEPLOY: CONSTITUTIONAL TRIGGERS

The following conditions make a deployment constitutionally unsafe. The deployment is blocked until the condition is resolved.

| Trigger | Condition |
|---|---|
| **Certification missing** | `pnpm certify` has not produced a valid PASS for this build |
| **Certification expired** | Certification evidence is older than 24 hours |
| **Determinism unverified** | Replay parity suite has not been run or did not produce consistent hashes across 10 runs |
| **GovernedClock not validated** | GovernedClock consistency check has not been run against this build |
| **Observability incomplete** | State transition coverage is below 100% |
| **Dangerous partial state** | Any of the six dangerous partial implementation states applies to this build |
| **Architectural debt unresolved** | Any architectural debt entry with a passed remediation deadline exists on the surface being deployed |
| **Freeze active** | Any implementation or deployment freeze is declared |
| **Active production incident** | An incident at severity level DECLARED or above is active on any venue in the rollout cohort |
| **Rollback path unavailable** | The previous certified build cannot be re-deployed within the 5-minute rollback target |
| **Shadow divergence unresolved** | A Stage 2 shadow divergence has been detected and not investigated to root cause |

These triggers are checked automatically by the CI pipeline at the start of each stage transition. A trigger that is present blocks the transition programmatically — it is not a manual discretion call.

---

*Document status: CANONICAL — System Materialization Era*
*Do not modify without constitutional governance review*
