# Operator Simulation Runtime
## Canonical Architecture for Training, Rehearsal, Certification, and Behavioral Testing
### Version 1 — Phase J, Operator Simulation and Replay Intelligence Era

---

## 1. Purpose and Scope

This document defines the canonical simulation runtime used across ClubHub TV for operator training, incident rehearsal, certification examinations, and operational stress testing.

Simulation is not a toy environment. It is a governed replica of production behavior used to develop genuine competence. It carries the same deterministic guarantees as the live system — the only thing that differs is consequence.

The simulation runtime exists for four distinct purposes:

1. **Operator training** — building correct mental models of system behavior before encountering live consequences
2. **Incident rehearsal** — controlled re-execution of failure patterns so operators learn response rather than panic
3. **Certification examination** — structured assessment of whether an operator can operate safely at their assigned role level
4. **Stress testing** — deliberate exposure to degraded-state operation to build operational resilience

No simulation session may substitute for, suppress, or contaminate live operational data. Simulation and live authority are permanently separated. Contamination of live state from simulation is a constitutional violation.

---

## 2. Core Distinctions: Four Simulation Modalities

These four modalities must never be confused. Each has distinct governance, fidelity requirements, and permitted mutations.

### 2.1 Replay Reconstruction

**Definition:** Exact re-execution of a recorded operational sequence from the corpus, with no mutations.

**Characteristics:**
- Input is a verified replay packet from the corpus
- Output is deterministic — identical to original execution
- No operator injection permitted during sequence execution
- Observer-only mode for participants
- Used for: forensic review, training observation, certification examination setup

**Fidelity requirement:** Must be byte-identical to original execution under all governance checks. Any divergence triggers corpus integrity failure.

### 2.2 Replay-Derived Simulation

**Definition:** A simulation seeded from a real replay packet, with controlled mutations applied after seeding.

**Characteristics:**
- Begins from a verified system state (replay-derived anchor)
- Mutations are declared in advance and logged
- Operator actions are live — real-time input with real-time feedback
- Replay anchor is preserved intact; only the forward simulation diverges
- Used for: "what if" rehearsal, alternative-response training, incident counterfactual analysis

**Fidelity requirement:** The anchor state must be traceable to its corpus source. Mutation log must accompany all simulation artifacts.

### 2.3 Synthetic Simulation

**Definition:** A simulation built from constructed initial conditions rather than a real replay anchor.

**Characteristics:**
- Initial state is composed from declared parameters, not extracted from corpus
- Used when no matching real event exists in corpus
- Highest operator freedom, lowest fidelity guarantee
- Requires explicit marking as SYNTHETIC in all outputs and observations
- Used for: novel failure scenarios not yet in corpus, onboarding basics, edge-case planning

**Fidelity requirement:** Must document the construction rationale. Synthetic simulations must not be presented as representative of real system behavior without corpus validation.

### 2.4 Counterfactual Simulation

**Definition:** A simulation that re-runs a real event with a different operator decision at a specified branch point.

**Characteristics:**
- Anchors to a real incident or operational moment
- Forks at a declared decision point
- Evaluates alternate outcomes
- Both the original path and the counterfactual path are preserved
- Used for: post-incident learning, operator coaching, certification board review

**Fidelity requirement:** Fork point must be exactly specified. Counterfactual branch must be clearly distinguished from the original in all artifacts. The original record is never modified.

---

## 3. Simulation State Model

Every simulation session operates with a fully declared state machine. There are no undeclared state transitions.

### 3.1 Session Lifecycle States

```
INITIALIZED   → session context created, roles assigned, scenario loaded
BRIEFED       → scenario description delivered to participants
SEEDED        → initial simulation state committed (from replay or synthetic construction)
ACTIVE        → live operator input accepted, simulation clock running
PAUSED        → clock suspended, state frozen, instructor control active
FORKED        → simulation branched at declared fork point, both branches tracked
STRESSED      → stress injection active (see §9)
REVIEWING     → post-run review mode, playback available, no new operator input
TERMINATED    → session closed, artifacts committed to simulation log
```

Transitions are governed. A session may not move from INITIALIZED to ACTIVE without passing through BRIEFED and SEEDED. A session may not be TERMINATED without first entering REVIEWING.

### 3.2 State Persistence Requirements

Each state transition must be logged with:
- Timestamp (simulation clock, not wall clock)
- Transition trigger (instructor command, scenario event, operator action)
- State snapshot hash
- Participant roster at transition

Simulation state snapshots are stored separately from live operational state. They share no storage path with the production corpus.

### 3.3 Clock Model

The simulation clock is a governed, deterministic clock distinct from the live production clock.

- Simulation time is tracked in simulation ticks, mapped to wall time at a declared acceleration ratio
- Default ratio: 1:1 (real-time)
- Accelerated ratios: 2:1, 5:1, 10:1 (see §10 for governance)
- All operator actions are timestamped in simulation time
- Simulation clock may be paused; the production clock may not

---

## 4. Live vs. Simulated Authority Separation

This is the single most critical operational boundary in the simulation runtime. Violations of this boundary are constitutional failures.

### 4.1 Authority Boundary

The simulation runtime operates within a declared simulation context. Within this context:

- All authority reads come from simulated state, not live state
- All authority writes affect simulated state only
- No simulation output propagates to the live governance kernel
- No simulation session can acquire a live operator session token
- The live system has no awareness of simulation sessions

This is not an access control policy. It is a structural separation enforced at the runtime level. Simulation sessions cannot route commands to the live API surface.

### 4.2 Data Isolation Requirements

Simulation data is segregated:
- Separate database schema (or separate database) with no foreign-key relationships to live tables
- Separate event bus namespace
- Separate log namespace (sim: prefix on all simulation log entries)
- Simulation artifacts are marked with SIMULATION_CONTEXT=true at all storage layers

### 4.3 Prohibited Crossings

The following are absolutely prohibited:

1. Using a live operator token to authenticate a simulation session
2. Reading live schedule or content data into a simulation without explicit corpus-seeding protocol
3. Writing simulation outcome data to live observability pipelines
4. Presenting simulation UI within the same browser session as a live operator console without explicit visual demarcation
5. Using simulation-derived metrics in live operational dashboards

### 4.4 Visual Demarcation

Any simulation session visible to human participants must be visually unambiguous as simulation:

- A persistent simulation banner occupies the top 40px of any simulation console
- Banner reads: **SIMULATION — NOT LIVE** in the system's highest-contrast treatment
- Background of all simulation consoles uses the simulation color tier (amber/gold, never blue or green which are live-system tier colors)
- If visual demarcation fails (banner dismissed, color incorrect), the simulation session is paused automatically

---

## 5. Scenario Injection Architecture

Scenarios are the unit of simulation work. They declare the conditions under which a simulation session operates.

### 5.1 Scenario Structure

Every scenario is a declared artifact containing:

```yaml
scenario:
  id: string (deterministic, corpus-assigned)
  modality: REPLAY_RECONSTRUCTION | REPLAY_DERIVED | SYNTHETIC | COUNTERFACTUAL
  anchor:
    corpus_packet_id: string | null  # null for SYNTHETIC
    fork_point: timestamp | null     # for COUNTERFACTUAL only
  initial_conditions: object         # declared system state parameters
  injections:
    - event_type: string
      simulation_tick: integer
      parameters: object
      declared_purpose: string       # instructor must declare why this injection exists
  expected_behaviors:
    - operator_role: string
      expected_response: string
      acceptable_alternatives: string[]
      disqualifying_responses: string[]
  stress_parameters:
    enabled: boolean
    type: string | null
    intensity: LOW | MEDIUM | HIGH
  time_limit_ticks: integer | null
  certification_relevant: boolean
```

### 5.2 Injection Governance

Scenario injections are events inserted into the simulation at declared ticks. They represent the controlled introduction of conditions the operator must respond to.

**Permitted injections:**
- Network degradation events
- Device failure events
- Content delivery failure events
- Authority contention events
- Multi-device cascade events
- Operator error introduction (for counterfactual analysis)
- Schedule conflict introduction
- Emergency interrupt introduction

**Forbidden injections:**
- Any event that would not be physically possible in live operation
- Events designed to produce confusion without operational purpose
- Events that cannot be replicated or described (i.e., random noise without documentation)
- Events that teach incorrect operational responses (see §14)

### 5.3 Instructor Injection Authority

During an ACTIVE simulation, the instructor may inject unscheduled events from the pre-approved injection library. All unscheduled injections are:
- Logged immediately with timestamp and instructor identity
- Tagged as INSTRUCTOR_INJECTION in simulation artifacts
- Subject to post-session review

Instructors may not inject events that are not in the pre-approved library without escalating to a simulation authority review.

---

## 6. Replay-Derived Simulation Seeding

When a simulation begins from a corpus replay packet, the seeding protocol is as follows:

### 6.1 Seeding Protocol

1. **Packet selection** — Instructor selects a corpus packet by ID. The packet must have status VERIFIED.
2. **State extraction** — The replay engine extracts the system state at the declared anchor timestamp.
3. **State verification** — The extracted state is hashed and compared against the stored corpus hash for that timestamp.
4. **Simulation fork** — The verified state is loaded into the simulation environment. The corpus packet is locked (read-only) for the duration of the session.
5. **Seeding confirmation** — Participants are shown the anchor state summary. Seeding is acknowledged before ACTIVE begins.

### 6.2 Anchor Integrity Requirements

- The anchor state hash must match the corpus record exactly.
- Any hash mismatch aborts seeding and triggers a corpus integrity alert.
- Seeding from an unverified or QUARANTINED corpus packet is prohibited.
- Seeding from a redacted corpus packet requires explicit simulation authority approval.

### 6.3 Forward Divergence

Once ACTIVE, the simulation diverges from the original replay path based on:
- Actual operator inputs (which may differ from the original operator's inputs)
- Declared scenario injections
- Instructor injections

The divergence is tracked event-by-event relative to the original replay sequence. The divergence log is a first-class simulation artifact.

---

## 7. Deterministic Simulation Guarantees

### 7.1 Core Guarantee

A simulation session run twice with identical initial state, identical scenario, and identical operator inputs must produce identical outcomes.

This is not a performance aspiration. It is a constitutional requirement. Any simulation runtime that violates this guarantee is not a valid simulation runtime.

### 7.2 Sources of Non-Determinism (and Their Mitigations)

**Random number generation:**
- All random elements use seeded RNG with the session ID as seed
- Seed is logged in session artifacts

**External time:**
- Simulation uses its own clock; wall-clock reads are prohibited in simulation logic

**Network calls:**
- Simulation operates against a replay-backed content store; no live network calls during simulation
- All API responses in simulation are served from declared fixtures

**Concurrent operator actions:**
- Simultaneous actions from multiple operators are serialized by simulation tick order, then by operator ID
- Serialization order is logged

**OS-level non-determinism:**
- Simulation runs in a containerized environment with deterministic scheduling configuration

### 7.3 Determinism Verification

Before a scenario is approved for certification use, it must pass a determinism verification run:
- The same scenario with the same synthetic operator inputs is executed three times
- All three output hashes must match
- Determinism certificate is attached to the scenario artifact

---

## 8. Pause, Fork, and Restart Semantics

### 8.1 Pause

When an instructor issues a PAUSE:
- Simulation clock halts immediately
- All pending operator inputs are queued, not discarded
- The system state is frozen
- Instructor may address participants, provide guidance, or alter scenario parameters within declared rules
- Pause duration is logged
- Resume restores the frozen state and drains the input queue in arrival order

**What instructors may NOT do during pause:**
- Alter the system state (this would break determinism)
- Reveal information operators have not yet received in the simulation
- Discuss operator performance assessment during pause (this contaminates the certification record)

### 8.2 Fork

A fork creates two parallel simulation branches from the current state:

- The current state is snapshotted and stored as the fork anchor
- Branch A continues forward (typically: original scenario path)
- Branch B diverges at the fork point (typically: alternative decision, counterfactual)
- Both branches run independently and produce independent artifacts
- Fork artifacts include the common ancestor state and the declared divergence reason

Forks are used in instructor-led counterfactual review and in advanced certification scenarios. They require instructor authority level 2 or above.

### 8.3 Restart

A restart returns the simulation to the SEEDED state:

- The original anchor state is restored
- All operator inputs from the prior run are discarded
- A new forward divergence log begins
- The original run's artifacts are preserved; they are not overwritten
- Restart reason is logged

Restarts are permitted for training sessions. They are not permitted during a certification examination after operator input has been recorded.

---

## 9. Multi-Operator Synchronized Simulation

Certification and rehearsal often require multiple operators playing their respective roles simultaneously.

### 9.1 Role Assignment

Before SEEDED state:
- Each participant is assigned one role from the scenario's declared role list
- Role list must match the actual roles that would respond to this type of incident in live operation
- Roles that are not assigned to a human participant are played by the simulation engine at a declared fidelity level (see §9.3)

### 9.2 Synchronized State Propagation

All operators in a session share a single simulation state. Actions by one operator are visible to others in real time, subject to the same information propagation rules as the live system.

- If the live system would delay information propagation due to degraded network state, the simulation does the same
- Operators see only the information their role would see in live operation
- Full-state visibility is restricted to instructor and observer roles

### 9.3 Simulated Role Fidelity

When a role is played by the simulation engine rather than a human:
- The engine follows a declared behavior model (scripted, rule-based, or replay-derived)
- Simulated roles may not behave more competently than a declared fidelity level
- FIDELITY_LOW: only performs obvious, clearly-indicated actions
- FIDELITY_MEDIUM: performs standard response as documented in operational runbooks
- FIDELITY_HIGH: performs expert-level response as derived from corpus analysis

The fidelity level affects what operators can rely on from simulated colleagues, which shapes the scenario's difficulty.

### 9.4 Temporal Consistency

All operators in a session share the simulation clock. There is no per-operator time. Actions are serialized globally.

---

## 10. Instructor Authority Model

### 10.1 Instructor Tiers

**Instructor Level 1 — Scenario Operator:**
- May run pre-approved scenarios
- May pause and resume
- May inject events from the approved injection library
- May not fork, may not modify scenario parameters, may not alter certification outcomes

**Instructor Level 2 — Simulation Designer:**
- All Level 1 authority
- May fork scenarios
- May create new scenarios (subject to review before certification use)
- May adjust stress parameters within declared ranges
- May trigger restart

**Instructor Level 3 — Simulation Authority:**
- All Level 2 authority
- May approve scenarios for certification use
- May authorize non-library injections
- May review and modify certification outcomes
- May access full-state observer view during any session
- May authorize redacted replay seeding

Instructor authority levels are assigned by the platform operator and stored in the governance kernel. They are not self-declared.

### 10.2 Instructor Isolation

During a certification examination:
- The instructor may observe but may not communicate with participants in ways that affect their responses
- Instructor notes are taken in a separate, timestamped audit log
- Any instructor action that could constitute a hint is flagged for post-session review

### 10.3 Observer Mode

Observers may be present in a simulation session with read-only access:
- Observers see the same full-state view as Level 3 instructors
- Observers may not inject events or communicate with participants
- Observer roster is logged in session artifacts

---

## 11. Stress-Mode Simulation Controls

Stress simulation deliberately degrades operator conditions to build resilience.

### 11.1 Stress Dimensions

**Cognitive load stress:**
- Multiple simultaneous events requiring prioritization
- Ambiguous or incomplete information surfaces
- Time pressure via reduced response windows

**Information stress:**
- Partial data availability (simulated sensor failure)
- Conflicting signals from different system components
- Delayed confirmation feedback

**Coordination stress:**
- Multiple operator roles with misaligned information
- Communication channel degradation
- Escalation path obstruction

**Temporal stress:**
- Accelerated simulation clock (see §12)
- Event queue compression (more events per time unit)

### 11.2 Stress Inoculation Sequencing

Stress must be introduced progressively. Operators must not encounter maximum stress levels before they have demonstrated baseline competency.

**Inoculation sequence:**
1. BASELINE run — no stress, correct information, cooperative simulated roles
2. INFORMATION_DEGRADED — partial data availability introduced
3. MULTI_EVENT — concurrent events requiring prioritization
4. COORDINATION_STRESS — simulated role fidelity reduced
5. FULL_STRESS — all stress dimensions active simultaneously

An operator may not be certified under FULL_STRESS conditions without having passed at levels 1–4.

### 11.3 Stress Safety Controls

- Any operator may invoke a declared "step out" mechanism that pauses their participation without affecting others
- Step-outs are logged but do not constitute certification failure unless the scenario specification declares otherwise
- Stress simulation must never simulate physical danger or violate human dignity
- Post-stress sessions include a mandatory debrief before artifacts are reviewed

---

## 12. Time Acceleration Governance

### 12.1 Permitted Acceleration Ratios

| Ratio | Name | Permitted For |
|-------|------|---------------|
| 1:1 | Real-time | All simulation modes |
| 2:1 | Compressed | Training, non-certification rehearsal |
| 5:1 | Rapid | Instructor review, divergence archaeology |
| 10:1 | Fast-forward | Scenario authoring, artifact review |

Acceleration ratios above 2:1 may not be used in certification examinations.

### 12.2 Acceleration Fidelity Requirements

At higher acceleration ratios:
- Human operators cannot respond realistically to events compressed by >2x
- Therefore, high-ratio acceleration is appropriate only for reviewing system behavior, not testing operator response
- Scenarios designed to test operator response under time pressure must use 1:1 clock with explicit time limits declared in the scenario

### 12.3 Acceleration Clock Integrity

The simulation clock must be consistent even at high acceleration:
- Ticks are not skipped; they are compressed
- Event ordering is preserved exactly
- Determinism guarantee applies at all acceleration ratios

---

## 13. Constitutional Constraints on Simulation Mutation

The following mutations are absolutely prohibited regardless of instructor authority level:

1. **Modifying a corpus replay packet** to make it suitable for simulation. If a packet needs modification, a replay-derived simulation with declared mutations must be used instead.

2. **Retroactively altering simulation artifacts.** Once a session is TERMINATED and artifacts are committed, they are append-only. Corrections are made via declared annotation, not modification.

3. **Running a simulation session with live operators who do not know they are in a simulation.** Covert simulation is prohibited. Participants must consent before SEEDED state.

4. **Using simulation outcomes as the sole basis for a consequential HR decision.** Simulation informs; it does not replace observed operational performance and institutional judgment.

5. **Introducing physical impossibilities as simulation events.** All simulation events must correspond to physically possible system states.

6. **Constructing a scenario designed to produce operator failure** rather than operator learning. Scenarios must have a discoverable correct path.

7. **Sharing simulation session data with parties not declared in the observer roster** without explicit operator consent.

---

## 14. Simulation May Never Teach False Operational Instincts

This section is elevated because it is the most consequential failure mode in simulation design.

### 14.1 The Core Risk

A simulation runtime that teaches operators incorrect system behavior is worse than no simulation at all. Operators build instincts from repeated simulation exposure. If those instincts are calibrated against a false model of system behavior, they will misfire when applied to the live system.

### 14.2 False Instinct Failure Modes

**Instinct miscalibration via simplified behavior:**
The simulation makes the system behave more cooperatively than the real system (errors self-resolve, confirmations arrive faster, conflicts are auto-resolved). Operators learn to rely on system behavior that does not exist in production.

**Instinct miscalibration via exaggerated consequence:**
The simulation makes small errors produce catastrophic outcomes more reliably than they do in production. Operators develop excessive caution that slows them below acceptable response times.

**Instinct miscalibration via incorrect escalation paths:**
The simulation routes incidents to different role boundaries than the live system does. Operators learn to escalate to the wrong person.

**Instinct miscalibration via false recovery patterns:**
The simulation accepts recovery actions that the live system would reject. Operators believe they have resolved an incident when the live system would still be in degraded state.

**Instinct miscalibration via incorrect information latency:**
The simulation delivers information faster or more completely than the live system does under equivalent degraded conditions.

### 14.3 Prevention Requirements

- Every simulation scenario must declare the live-system behaviors it is modeling and cite the governance document that defines them
- Any simplification from live-system fidelity must be explicitly declared with its educational justification
- Simplified scenarios are restricted to onboarding contexts; certification scenarios must be full-fidelity
- Scenarios are reviewed annually against live system behavior changes to detect fidelity drift

### 14.4 Fidelity Audits

The simulation authority conducts quarterly fidelity audits:
- Select 5 active scenarios at random
- Verify that declared behavior matches current live-system behavior
- Flag any scenario that has drifted from fidelity
- Deprecated scenarios are removed from use; they are not silently continued

---

## 15. Simulation Observability Requirements

### 15.1 Session Artifact Requirements

Every simulation session must produce the following artifacts upon TERMINATED:

1. **Session manifest** — participant roster, scenario ID, modality, start/end timestamps
2. **State transition log** — all simulation state transitions with timestamps
3. **Operator action log** — every operator action with simulation tick, operator role, action type, and parameters
4. **Injection log** — all scenario and instructor injections
5. **Divergence log** (for replay-derived and counterfactual) — event-by-event comparison to anchor sequence
6. **Outcome summary** — declared scenario outcomes observed, pass/fail determinations if certification-relevant
7. **Observer notes** — timestamped instructor/observer annotations (separate from participant-visible log)

### 15.2 Real-Time Observability

During an ACTIVE session, the instructor console displays:
- Current simulation tick and wall-clock elapsed time
- Active operator actions (what each participant is doing)
- Pending injection queue (next 5 declared events)
- Divergence delta from anchor sequence (for replay-derived sessions)
- Stress indicators (active stress dimensions)

### 15.3 Retention

Simulation session artifacts are retained for:
- Certification examination sessions: 5 years
- Training sessions: 1 year
- Stress rehearsal sessions: 2 years

Artifacts may not be deleted within their retention period without explicit governance authorization.

---

## 16. Failure Modes for Bad Simulation Design

| Failure Mode | Description | Detection | Mitigation |
|---|---|---|---|
| FIDELITY_COLLAPSE | Simulation behavior diverges from live system | Quarterly fidelity audit | Scenario deprecation and rebuild |
| FALSE_INSTINCT_PROPAGATION | Operators build instincts calibrated against incorrect behavior | Post-scenario live-op comparison | Scenario review, targeted remediation |
| INSTRUCTOR_CONTAMINATION | Instructor guidance during certification alters operator response | Audit log review | Certification invalidation, re-examination |
| CONTEXT_BLEED | Operators confuse simulation context with live context | Visual demarcation failure detection | Automatic session pause, demarcation restoration |
| SCENARIO_STALENESS | Scenario behavior no longer matches live system after system changes | Fidelity audit drift detection | Scenario quarantine and update |
| STRESS_MISCALIBRATION | Stress parameters cause shutdown rather than learning | Step-out rate monitoring | Sequence reset, inoculation restart |
| REPLAY_ANCHOR_CORRUPTION | Seeded state hash does not match corpus record | Seeding protocol hash check | Seeding abort, corpus integrity investigation |
| DETERMINISM_VIOLATION | Same inputs produce different outputs across runs | Determinism verification runs | Runtime investigation, scenario suspension |
| OBSERVER_ESCALATION | Observer acts beyond read-only role | Role enforcement | Access revocation, session audit |
| COVERT_SIMULATION | Participant does not know they are in simulation | Consent log absence | Retroactive consent collection or artifact voiding |

---

## 17. Summary Constraints

1. Simulation and live authority are permanently separated. No simulation session touches live state.
2. Four modalities exist. Each is governed distinctly. They may not be conflated.
3. Simulation must teach correct operational instincts. False fidelity is a safety failure.
4. Certification examinations require full-fidelity scenarios and no instructor contamination.
5. Stress is introduced progressively. No operator encounters maximum stress without baseline certification.
6. All simulation artifacts are immutable after TERMINATED. Corrections are annotations, not modifications.
7. Determinism is a constitutional requirement. Any non-deterministic simulation runtime is invalid.
8. Operators always know they are in simulation. Covert simulation is prohibited.
9. Simulation data is retained per governance cadences and may not be deleted within retention period.
10. Fidelity is audited quarterly. Stale scenarios are deprecated, not patched in place.
