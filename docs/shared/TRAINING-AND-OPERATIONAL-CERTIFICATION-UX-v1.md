# TRAINING AND OPERATIONAL CERTIFICATION UX v1

**Era:** Operator Reality Integration
**Status:** CANONICAL
**Scope:** Replay-first onboarding, certification tied to permissions, simulation-based validation, failure replay as learning, skill decay detection, recertification triggers

---

## 1. PURPOSE

An operator who has read the manual but never seen a real incident is not certified. Certification is a statement about what a person can do safely under conditions that matter — stress, incomplete information, time pressure, and novel failure modes.

This document defines how operators are trained, certified, and monitored over time. The training architecture is built on the same replay and simulation systems that govern the rest of the platform. Training is not a separate concern — it is the operational system running in a safe, supervised context.

**An operator is not granted system access beyond what their demonstrated competence warrants. Certification determines permissions, not the other way around.**

---

## 2. TRAINING PHILOSOPHY

### 2.1 Replay-First Learning

The most effective way to learn an operational system is to observe it operating — not to read about it.

Every new operator begins training by watching replays. Real historical operations at real venues. The explanation system — the same system that powers the live explainability surface — annotates the replay with what the system is doing and why.

This means the first thing an operator sees is real operational truth, not a simulated demonstration. They see actual PRE resolution decisions, actual schedule transitions, actual incident responses. The system they are learning to operate is the system they are watching.

### 2.2 Observation Before Action

The training sequence is fixed:
1. **Observe** — watch replays of nominal operation
2. **Observe under stress** — watch replays of degraded and incident scenarios
3. **Simulate with guidance** — operate the simulation harness with full guidance surface visible
4. **Simulate without guidance** — operate the simulation harness with minimal assistance
5. **Certify** — complete certification scenarios with performance assessment
6. **Operate supervised** — operate live system with senior operator monitoring
7. **Operate independently** — operate live system within certified role boundaries

No operator skips steps. No operator is accelerated through the sequence based on claimed prior experience unless they pass the certification directly.

### 2.3 The Simulation Harness Is The Training Environment

The frontend simulation harness (defined in `FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1.md`) is not only a developer testing tool — it is the operator training environment. The same scenarios used to verify deployment safety are used to train operators.

This is intentional. It means:
- Training scenarios are always current (they are maintained by the engineering team for deployment testing)
- Training scenarios are comprehensive (they cover the mandatory simulation categories)
- Training scenarios are realistic (they use real corpus data, not fabricated examples)
- Trainee performance on scenarios is directly comparable to system performance benchmarks

---

## 3. CERTIFICATION LEVELS

Certification levels are bounded to role. A Venue Operator certification does not grant Fleet Operator access. Certifications are non-transferable across roles — a certified Fleet Operator seeking Venue Operator certification takes the Venue Operator certification independently.

### 3.1 Level 1: Venue Operator Certification

**Scope:** Single-venue live operation, schedule monitoring, basic incident acknowledgment, playback control.

**Required competencies:**
- Correctly identify LIVE vs REPLAY mode within 5 seconds of viewing the operational surface
- Correctly identify nominal, degraded, and incident states within the 2-second scanability window
- Acknowledge an incident and initiate the correct first-response action within 30 seconds of incident declaration
- Correctly determine what content is currently playing and whether it is authoritative or fallback
- Initiate and exit replay mode without confusing replay content for live content

**Certification scenario set (minimum):**
- NOMINAL_LIVE_CYCLE: complete one full operational hour in simulation
- INCIDENT_DECLARED: respond to a level-2 incident correctly
- DEGRADED_RECOVERY: identify and respond to a stale-resolution condition
- REPLAY_INITIATION: initiate replay, navigate, exit, confirm live content restored
- CONCURRENT_OPERATOR: operate alongside a simulated senior operator during incident

**Pass threshold:** 90% of decisions correct; 0 dangerous-misunderstanding-class errors.

**Permissions granted:** Live venue operation, schedule view, incident acknowledgment, basic playback control.

### 3.2 Level 2: Fleet Operator Certification

**Prerequisites:** Level 1 certification.

**Scope:** Multi-venue monitoring, fleet anomaly detection, cross-venue incident coordination.

**Required competencies:**
- Identify the most urgent venue across a 10-venue fleet within 30 seconds
- Correctly classify the source of a venue anomaly (venue vs network vs platform) with available signals
- Coordinate a response across two simultaneously degraded venues without creating conflicting actions
- Delegate venue-level actions to Level 1 operators while maintaining fleet-level oversight

**Certification scenario set (minimum):**
- FLEET_NOMINAL: monitor 10 venues across a nominal operation period
- MULTI_VENUE_INCIDENT: identify and prioritize across two simultaneous incidents
- FLEET_DEGRADED: distinguish network degradation from platform degradation across fleet
- AUTHORITY_DELEGATION: direct a Level 1 operator to take specific actions without taking conflicting actions

**Pass threshold:** 90% of decisions correct; correct prioritization in all multi-venue scenarios.

**Permissions granted:** Fleet monitoring view, cross-venue status read access, delegation authority to Level 1 operators.

### 3.3 Level 3: Platform Administrator Certification

**Prerequisites:** Level 1 certification (Level 2 recommended but not required).

**Scope:** System configuration, PRE governance, OTA management, structural changes.

**Required competencies:**
- Correctly navigate the OTA update governance workflow
- Identify a configuration change that would affect PRE resolution behavior
- Correctly handle a CLASS-D (structural) action confirmation sequence
- Understand and act correctly on the corpus integrity warning

**Certification scenario set (minimum):**
- OTA_UPDATE_WORKFLOW: complete a governed OTA update cycle in simulation
- CONFIGURATION_IMPACT: identify the operational impact of a proposed PRE configuration change
- CORPUS_INTEGRITY_FAILURE: respond to a corpus integrity warning correctly
- CLASS_D_CONFIRMATION: complete a structural action through the full confirmation gate sequence

**Pass threshold:** 100% on CLASS-D action scenarios; 90% overall.

**Permissions granted:** Administrative surfaces, configuration write access, OTA deployment authority.

### 3.4 Level 4: Incident Commander Certification

**Prerequisites:** Level 2 certification plus 90 days of operational experience.

**Scope:** Authority during declared incidents, multi-operator coordination, blast-radius decisions.

**Required competencies:**
- Achieve minimum viable incident understanding within 90 seconds of cold-start assignment
- Correctly arbitrate authority conflicts during multi-operator incident response
- Execute the full incident lifecycle (declaration → containment → resolution → post-incident) correctly
- Issue and revoke authority to other operators during an incident

**Certification scenario set (minimum):**
- COLD_START_INCIDENT: take over an in-progress incident with no prior context within 90 seconds
- MULTI_OPERATOR_AUTHORITY: resolve an authority conflict correctly
- CASCADING_INCIDENT: manage an incident that escalates through three severity levels
- POST_INCIDENT_REVIEW: complete post-incident review and documentation requirements

**Pass threshold:** 100% on cold-start and authority conflict scenarios; 90% overall.

**Permissions granted:** Incident Commander authority, elevation grant authority, all Level 1–3 permissions during incident scope.

---

## 4. SIMULATION-BASED COMPETENCE VALIDATION

Certification is not a written test. It is a performance assessment on simulation scenarios. Operators interact with the real system in a simulation context.

### 4.1 Assessment Criteria

Performance is assessed on:
- **Accuracy:** Were the decisions operationally correct?
- **Speed:** Were the decisions made within appropriate time windows?
- **Misunderstanding class:** Were any dangerous-misunderstanding-class errors made?
- **Action economy:** Did the operator take unnecessary or redundant actions?
- **Signal processing:** Did the operator act on the correct signal, not a spurious one?

Accuracy and misunderstanding class are the primary gates. Speed and action economy are informational — they identify areas for improvement, not grounds for failure unless extreme.

### 4.2 The Dangerous Misunderstanding Gate

A single dangerous-misunderstanding-class error in a certification scenario is an automatic failure, regardless of overall performance. The error types:
- Treating REPLAY content as live
- Treating STALE data as authoritative
- Taking a CLASS-C or CLASS-D action without completing the confirmation gate
- Missing an unacknowledged CRITICAL incident while it was visible on the surface
- Operating under the wrong authority belief (believing STANDARD when ELEVATED or vice versa)

This is a zero-tolerance gate because these errors have compounding consequences in live operation.

### 4.3 Certification Evidence

Certification generates a structured evidence record:

```typescript
interface OperatorCertificationRecord {
  operatorId: string;
  certificationLevel: 1 | 2 | 3 | 4;
  certifiedAt: string;             // ISO8601
  expiresAt: string;               // ISO8601
  scenariosCompleted: string[];    // scenario IDs
  accuracyScore: number;           // 0.0–1.0
  dangerousMisunderstandingErrors: number;  // must be 0 to pass
  certifiedBy: string;             // certifying operator ID
  simulationRunId: string;         // links to full scenario run record
}
```

Certification records are stored in the governance database and linked to operator session records. When an operator logs in, their current certification level determines their available permission scope.

---

## 5. FAILURE REPLAY AS REQUIRED LEARNING MECHANISM

Operators learn more from failures than from successes. The corpus of real operational failures — incidents, misconfigurations, degraded-mode events — is required training material, not optional supplementary reading.

### 5.1 Failure Replay Corpus

The training corpus includes:
- Real incidents from production operation (anonymized to remove venue-identifying information if required)
- All simulation scenarios that have been executed for deployment certification
- Synthetically generated failure scenarios covering failure modes in `FM-001` through `FM-010` (per STEP 10 production hardening)

Every trainee at every level reviews a minimum number of failure replays before certification:
- Level 1: 3 failure replays (at least 1 incident, 1 degraded mode, 1 resolution failure)
- Level 2: 5 failure replays (at least 1 multi-venue incident, 1 cascading failure)
- Level 3: 5 failure replays (at least 1 OTA failure, 1 corpus integrity failure)
- Level 4: 10 failure replays (including all Level 1–3 requirements plus multi-operator conflicts)

### 5.2 Annotated Failure Replay

Failure replays are not raw replays. They are annotated by the explanation system to surface:
- What the correct decision was at each operator action point
- What signals were available and which were most relevant
- What the dangerous misunderstanding risk was at each ambiguous moment
- What the actual outcome was and what a different decision would have produced

Operators watch the annotated replay, then replay the same scenario in the simulation harness to practice the correct response.

### 5.3 New Failure Mode Discovery

When a novel failure mode is encountered in production that was not in the existing training corpus, a process is triggered:
1. The failure is documented and added to the incident corpus
2. A simulation scenario is constructed that replicates the failure conditions
3. All currently certified operators at relevant levels are notified that a new scenario is available
4. Level 4 operators review the scenario within 30 days
5. The scenario becomes part of the active certification set for future candidates

This creates a learning loop from real operations back into the training system.

---

## 6. SKILL DECAY DETECTION SIGNALS

Certification is not permanent. Skills decay when not exercised. The system detects skill decay signals from real operational behavior.

### 6.1 Behavioral Decay Signals

The following operator behaviors in live operation are decay signals:

| Signal | Possible Decay Indicator |
|---|---|
| Operator regularly dismisses incident banners within 2 seconds (below minimum read time) | Incident acknowledgment becoming reflexive rather than deliberate |
| Operator repeatedly navigates to views that are inappropriate for their current scenario | Spatial memory of interface degrading |
| Operator initiates CLASS-C actions without triggering confirmation gate | Either bypassing gate (dangerous) or gate not functioning (system defect) — must be investigated |
| Operator session active but no interactions for >30 minutes during active event | Attention lapse — may miss events |
| Operator makes the same action type multiple times in quick succession | Could indicate confusion about action effect |
| Operator in Fleet role drilling into per-venue detail for every anomaly | Role-appropriate scanning behavior degrading |

These signals do not trigger automatic consequences. They trigger a review flag that is surfaced to the operator's supervisor or to the Platform Administrator.

### 6.2 Decay Signal Dashboard

Platform Administrators have access to an operator health dashboard (read-only) showing:
- Active operators and their certification levels
- Any decay signals flagged in the current month
- Days since last training session or simulation exercise
- Days until certification expiry

This is not a surveillance tool — it is an operational readiness tool. The question it answers is "do we have adequately prepared operators for tomorrow's events?"

---

## 7. RECERTIFICATION TRIGGERS

### 7.1 Time-Based Recertification

| Level | Recertification Period |
|---|---|
| Level 1 | 12 months from last certification |
| Level 2 | 18 months from last certification |
| Level 3 | 18 months from last certification |
| Level 4 | 12 months from last certification |

Recertification requires completing the certification scenario set again. Operators with no decay signals and clean operational records may complete a reduced scenario set (75% of full set). Operators with decay signals complete the full set regardless.

### 7.2 Event-Based Recertification

Recertification is triggered immediately by:
- A dangerous-misunderstanding-class error in live operation (documented in the incident post-review)
- A novel failure mode that the operator encountered but could not respond to correctly
- A significant system update that changes operational behavior in ways that affect the operator's role
- Any period of >6 months without live operation within the certified role

### 7.3 System-Update-Triggered Recertification

When a system update changes:
- The incident surface behavior
- The LIVE/REPLAY visual distinction mechanics
- The authority model
- Any element of the minimum viable understanding surface

...all currently certified operators receive a notification that a targeted recertification scenario is available. The scenario covers only the changed behavior. This is not a full recertification — it is a change-specific competence check.

---

## 8. "CANNOT OPERATE SYSTEM SAFELY YET" UX RULES

The system must communicate clearly when an operator lacks the certification to perform an action, without humiliating them or creating operational paralysis.

### 8.1 Permission Boundary Communication

When an operator attempts an action beyond their certification level:
- The action control is visually inactive (not hidden — the operator can see what they cannot do)
- A brief, non-judgmental explanation appears: "This action requires Level 3 certification. Contact your platform administrator."
- An optional "Request access" affordance is available that creates a notification for an administrator

**Forbidden:** Hiding actions entirely from operators who lack permission. Operators should know what the system can do, even if they cannot currently do it. Hidden capabilities create the false impression of a less capable system.

### 8.2 Certification-Blocked States

When an operator's certification has expired:
- They retain read access to all surfaces they previously had access to
- Write and action access is suspended
- A prominent, non-intrusive banner communicates "Your certification expires in X days" (starting 30 days before expiry)
- After expiry: "Your certification has expired. Contact your administrator to schedule recertification."

Expired operators can still monitor. They cannot act. This prevents a lapsed certification from creating an operational blind spot.

### 8.3 Trainee Mode

Operators in the training sequence (pre-certification) operate in Trainee Mode:
- The live system is read-only
- The simulation harness is fully accessible
- A training status indicator is visible in shell chrome to all operators on the system ("Trainee: [Name] observing")
- The trainee cannot take any action that would affect live operations

Trainee mode is visually distinct but not embarrassing. It is a professional status, not a limitation notice.

---

*Document status: CANONICAL — Operator Reality Integration Era*
*Do not modify without constitutional governance review*
