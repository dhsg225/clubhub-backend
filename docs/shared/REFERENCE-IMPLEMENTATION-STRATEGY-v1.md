# REFERENCE IMPLEMENTATION STRATEGY v1

**Era:** System Materialization
**Status:** CANONICAL
**Scope:** First implementation requirements, deferral safety, dependency graph, critical path, anti-shortcut governance, dangerous partial states, constitutional MVP

---

## 1. PURPOSE

The architecture corpus defines what the system must be. This document defines what the system must become first, and in what order, to ensure that the architecture survives implementation without semantic collapse.

Implementation order is not a project management concern. It is an architectural concern. Building components in the wrong order creates dependencies that cannot be undone — components that were built against an assumption that later components would have corrected. Those assumptions become the permanent shape of the system.

**The order of implementation is constitutional. Shortcuts in sequencing create architectural debt that compounds faster than technical debt.**

---

## 2. THE CONSTITUTIONAL MVP DEFINITION

The minimum viable implementation is not the smallest set of features that can be demonstrated. It is the smallest set of components that together constitute an operationally correct and verifiable system — one that cannot mislead an operator about system state, cannot silently violate determinism guarantees, and can be extended without requiring structural rework.

### 2.1 What MUST Exist Before Any Operator Testing

The following components must be fully implemented and verified before any real operator interacts with the system. Each is a prerequisite for the next. None can be omitted and replaced with a mock or stub that is passed off as production behavior.

**Gate 1: Governed Clock**
A single, system-wide authoritative time source used by every component. No component may use `Date.now()` or platform clock directly. This must exist before any other component, because everything downstream depends on it for determinism.

**Gate 2: PRE Resolution Engine (backend)**
The authoritative resolution system at the correct levels (L0 through L6). Must be capable of producing deterministic results given the same input. Must attach determinism hashes to results. Must include the corpus packet authoring pipeline.
- Verified: 9/9 corpus replay reproducibility (per existing corpus)
- Verified: determinism check across ≥5 runs

**Gate 3: State Machine Runtime (frontend)**
The five canonical state machines (Player, Operator Session, PRE Resolution, Incident, Replay Session) fully implemented per `FRONTEND-STATE-MACHINE-ARCHITECTURE-v1.md`. All transition guards enforced. All observability emissions wired. Replay reconstruction verified.
- Verified: `replayFromHistory()` produces identical final state for all canonical scenarios

**Gate 4: PRE Boundary Component**
The single boundary through which all PRE resolution data crosses into the rendering layer. STALE and FAILED states must be enforced — they must never reach renderers. Determinism attestation must be attached to all boundary crossings.
- Verified: corpus-backed boundary test passes for all resolution states

**Gate 5: Operator Session System (backend + frontend)**
Authentication, session authority levels, session state machine transitions. Elevation must be functional. Session expiry must be functional. Authority level must be visible on the operational surface.
- Verified: all 4 session state machine transitions are testable

**Gate 6: Incident State Machine (backend + frontend integration)**
Incident declaration, escalation, containment, resolution, and post-incident states fully integrated between backend and frontend. The incident banner must appear within 500ms of declaration. The stage-based UI degradation (per `INCIDENT-REALITY-INTEGRATION-SYSTEM-v1.md`) must be functional through at least Stage 3.
- Verified: simulation scenario INCIDENT_DECLARED passes

**Gate 7: Replay System (frontend + corpus)**
Full replay mode: corpus packet loading, integrity verification, replay-bound state, historical explanation rendering, LIVE/REPLAY visual distinction (all 4 mandatory simultaneous indicators), replay exit via SYNCING re-entry.
- Verified: corpus packet round-trip — load, play, exit, confirm live restored

**Gate 8: Observability Sink**
Every state transition emitting to the observability sink. Every PRE boundary crossing emitting. Trace IDs propagated from backend. The sink must be live and receiving before operator testing begins — not added afterward.
- Verified: 100% state transition coverage in observability integration test

**Gate 9: Frontend Certification Suite**
The mandatory simulation scenarios must pass. The replay parity suite must pass. The certification command must produce a valid evidence hash.
- Verified: `pnpm certify` produces PASS with complete evidence

**Only after all nine gates pass is the system eligible for operator testing. No exceptions.**

### 2.2 What CAN Be Deferred Safely

These components may be deferred to later implementation phases without creating structural risk, provided the gate conditions above are met:

| Component | Why Safe to Defer |
|---|---|
| Fleet monitoring view | Single-venue operation can be validated without it |
| Advanced explainability (P3/P4 surfaces) | P1/P2 explanation surfaces satisfy constitutional minimum |
| Operator training/simulation mode | Read-only trainee mode can be approximated by observer access initially |
| Post-incident documentation workflows | Does not affect operational correctness |
| Skill decay detection analytics | Requires baseline of operational data to detect decay |
| Confusion event aggregation dashboard | Requires baseline confusion event corpus |
| Full sponsor content zone management | Can initially run with a single placeholder sponsor zone |
| Multi-venue OTA rollout governance | Single-venue OTA is sufficient for pilot |
| Fleet-wall display profiles | Calibration profiles can be added after hardware is available |

**Deferral boundary rule:** A deferred component must have a clean interface contract that does not force changes to already-built components when it is implemented. If adding the deferred component would require rebuilding a gate component, it is not safely deferrable — it must be sequenced appropriately.

---

## 3. IMPLEMENTATION DEPENDENCY GRAPH

Dependencies are one-directional. A component at level N can only depend on components at level N-1 or earlier.

```
Level 0 (No dependencies):
  GovernedClock
  CorpusPacket schema + authoring tooling
  OperationalEventBus (typed event definitions only — no implementation)

Level 1 (Depends on Level 0):
  PRE Resolution Engine (L0–L6 resolvers)
  Token registry (design token definitions — values only, no runtime)
  State machine transition definitions (legal state/transition tables — no runtime)

Level 2 (Depends on Level 1):
  Corpus integrity verification
  Determinism hash computation
  Backend session management
  Incident state machine (backend)

Level 3 (Depends on Level 2):
  PRE resolution API (HTTP interface to PRE engine)
  Operator session API
  Incident API
  State machine runtime (frontend — consumes definitions from Level 1)

Level 4 (Depends on Level 3):
  PRE Boundary Component (frontend — consumes PRE resolution API)
  Session state machine (frontend — consumes session API)
  Incident state machine (frontend — consumes incident API)
  Observability sink (frontend — consumes state machine runtime)

Level 5 (Depends on Level 4):
  Shell components (consume session + incident state machines)
  Workspace container (consumes player state machine)
  Operational panes (consume PRE boundary + state machines)

Level 6 (Depends on Level 5):
  Replay system (frontend — consumes PRE boundary in REPLAY_BOUND mode)
  Explainability zone (consumes PRE boundary output)
  Content renderers (consume pane outputs)

Level 7 (Depends on Level 6):
  Frontend certification suite (validates all Level 0–6 components)
  Operator session UX (login, elevation, expiry flows)

Level 8 (Depends on Level 7):
  Fleet monitoring view
  OTA governance workflows
  Training/simulation mode
  Post-incident documentation
```

**Inversion detection rule:** If an implementation requires a component to depend on something at a higher level, the dependency graph has been violated. This is detected by the component boundary checker in CI. Inversions do not proceed — they are architectural defects requiring design review.

---

## 4. CRITICAL PATH SEQUENCING

The critical path is: GovernedClock → PRE Engine → State Machines → PRE Boundary → Incident Integration → Replay System → Certification Suite.

This path has no slack. Any delay on any critical path component delays all downstream components. The critical path is not accelerated by parallelizing work — the dependency graph requires sequential delivery of critical path components.

### 4.1 Parallelizable Work

These streams can proceed in parallel alongside the critical path, converging at the integration points:

| Parallel Stream | Converges At |
|---|---|
| Design token implementation | Level 5 (shell + pane rendering) |
| Typography/visual semantics implementation | Level 5 |
| Motion governance implementation | Level 5 |
| Corpus authoring tooling | Level 2 (corpus integrity verification) |
| Backend session management | Level 2 |
| Observability sink infrastructure | Level 4 |
| Frontend simulation harness scaffolding | Level 7 (certification suite) |

### 4.2 False Parallelism

The following appear parallelizable but are not — they share hidden dependencies that create integration failure if built independently:

- **PRE Engine + State machine runtime:** The state machine runtime must consume the actual PRE resolution contract, not a mocked one. If they are built independently with different resolution schemas, integration creates an incompatibility that requires rewriting one of them.
- **Incident backend + Incident frontend:** Must share the same incident state definitions. Building independently with different escalation paths creates state machine inconsistency that is hard to detect and harder to fix.
- **Replay system + Corpus authoring:** The corpus packet schema must be finalized before either is built. Schema changes after the fact propagate breaking changes in both directions.

---

## 5. ANTI-SHORTCUT GOVERNANCE

Delivery pressure creates shortcut pressure. The following shortcuts are the most common and the most dangerous.

### 5.1 The Mock-That-Stays

**Pattern:** A gate component is replaced with a mock to unblock downstream work. The mock is "temporary." It is never replaced.

**Prevention:**
- Mocks in production paths are detected and flagged by the CI bundle purity check
- No gate component may be mocked in a non-test context
- Every mock has a mandatory expiry: a linked issue with a due date. If the due date passes without the mock being replaced, the build fails

### 5.2 The Optimistic Bridge

**Pattern:** A component that should wait for backend confirmation transitions optimistically to allow the UI to feel fast. "We'll add the confirmation later."

**Prevention:**
- Optimistic transitions are detected by the state machine transition guard tests
- The backend confirmation flow is built before the UI action that triggers it — never after
- Any UI action that modifies state requires the full round-trip path before it can be shipped

### 5.3 The Scope-Reduced Certification

**Pattern:** The certification suite is reduced in scope to pass under time pressure. "We'll add the failing scenarios back later."

**Prevention:**
- The mandatory simulation scenario list is defined in the corpus, not in the build script
- Removing a scenario from the mandatory list requires a documented architectural decision
- Failing scenarios do not become "known failures" — they block the build until fixed

### 5.4 The Skipped Boundary

**Pattern:** A component reads PRE resolution data directly from a context or store, bypassing the PRE boundary component. "It's just for this one component."

**Prevention:**
- The component boundary checker in CI detects direct PRE data consumption outside the boundary
- Any pull request that introduces a direct PRE data dependency (not via the boundary) is rejected automatically

### 5.5 The Deferred Observability

**Pattern:** State machine mutations are implemented without observability emissions. "We'll add the logging later."

**Prevention:**
- Observability emissions are part of the state machine transition contract, not optional additions
- The observability coverage test blocks deployment if any transition lacks an emission
- Observability infrastructure is built at Level 4 — before the state machines at Level 3 are connected to any UI

---

## 6. DANGEROUS PARTIAL IMPLEMENTATION STATES

These partial-implementation configurations are specifically dangerous because they appear to work while creating hidden operational failures:

### 6.1 State Machines Without Observability

Appears to work. Operators can use the surface. But there is no forensic trail. When something goes wrong, there is no ability to replay what happened, audit the sequence, or verify determinism. The system is constitutionally non-compliant and operationally unauditable.

**Danger level: HIGH.** Any live operator exposure in this state is prohibited.

### 6.2 PRE Boundary Without STALE Enforcement

The system resolves PRE and displays it. But if the resolution goes stale, the boundary passes it through as if it were fresh. Operators see stale data presented as authoritative. This is the primary dangerous misunderstanding: STALE presented as LIVE truth.

**Danger level: CRITICAL.** Any live operator exposure in this state is prohibited.

### 6.3 Replay Without Integrity Verification

The replay system loads packets and plays them back, but does not verify the determinism hash. Corrupted or modified packets play without warning. Operators believe they are reviewing authoritative history when they may be reviewing incorrect history.

**Danger level: HIGH.** Any live operator exposure in this state is prohibited.

### 6.4 Incident System Without Stage Degradation

Incidents are declared and displayed, but the UI does not contract to incident-focused mode. Operators manage incidents in the full-information-density operational surface. Under stress, they lose the cognitive survival guarantees of the staged compression model.

**Danger level: MEDIUM.** Pilot operator exposure with close supervision may proceed, but field deployment is prohibited.

### 6.5 Frontend Without Governed Clock

Components use `Date.now()` or native clock APIs. The system appears to work normally. But replay scenarios produce non-deterministic results. The certification suite passes intermittently. The replay reconstruction guarantee is silently broken.

**Danger level: HIGH.** This defect is specifically dangerous because it manifests as intermittent test failures, not consistent operational errors, making it easy to attribute to test flakiness and ignore.

---

## 7. IMPLEMENTATION INTEGRITY CHECKPOINTS

At each of the following milestones, a documented architectural checkpoint is required before the next phase begins:

| Checkpoint | Trigger | Required Verification |
|---|---|---|
| CP-1: Foundation | All Level 0–1 components complete | GovernedClock test, corpus schema ratification, state machine table review |
| CP-2: Backend Core | All Level 2–3 components complete | PRE determinism verified 10 runs, incident state machine integration test, session authority test |
| CP-3: Frontend Core | All Level 4–5 components complete | PRE boundary STALE enforcement test, observability 100% coverage, shell stability test |
| CP-4: Replay System | Level 6 complete | Corpus round-trip test, LIVE/REPLAY distinction manual verification, explanation parity test |
| CP-5: Certification | Level 7 complete | `pnpm certify` PASS, evidence hash recorded, all mandatory simulation scenarios passing |
| CP-6: Operator Readiness | Level 8 MVP components complete | Venue Operator certification scenario set passing, incident reality simulation passing |

Checkpoints are not optional. A checkpoint failure pauses forward implementation. Root cause is resolved before proceeding.

---

*Document status: CANONICAL — System Materialization Era*
*Do not modify without constitutional governance review*
