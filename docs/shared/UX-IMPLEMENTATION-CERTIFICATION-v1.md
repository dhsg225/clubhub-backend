# ClubHub TV — UX Implementation Certification
# Implementation Translation Era — Operational Frontend Execution Standards

**Document type:** Implementation governance — frontend certification levels, required evidence, and deployment gates
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; QA; deployment reviewers; all contributors deploying operator-facing code
**Last updated:** 2026-05-26
**Status:** CANONICAL — a frontend implementation is not certified because it looks correct. It is certified because operators can safely reason through reality using it.
**Phase:** Implementation Translation Era

---

## Purpose

This document defines what a ClubHub TV frontend implementation must demonstrate to be deployable in an operational context. It defines certification levels, the specific evidence each level requires, what blocks deployment, what causes decertification, and how operator comprehension is validated.

The threat this document addresses: **deployment of operationally unsafe implementations under the appearance of correctness.** A frontend can be visually polished, technically sound, and fully covered by unit tests while being operationally unsafe: it may render stale state as current, display pending actions as confirmed, fail to distinguish replay from live, or provide explanations that cannot be reconstructed from PRE output. None of these failures are caught by standard UI testing. They require operational certification testing.

**The governing principle:** Certification is not a formality. It is the evidence-based demonstration that the implementation correctly transmits operational truth to operators under the full range of conditions they will encounter.

---

## Section 1 — Certification Philosophy

### 1.1 Certification Is Evidence-Based

A certification assertion ("this component correctly handles STALE state") is only valid if it is supported by a specific, repeatable test that verifies the assertion. Assertions without evidence are not certifications — they are opinions.

**Required evidence types:**
- **Replay-backed assertions:** The behavior is verified against actual corpus entries, not synthetic test data
- **Automated test results:** Specific test names and pass/fail results, not "all tests pass"
- **Visual regression baselines:** Screenshots or snapshots that define the canonical visual state for each rendering condition
- **Operator comprehension validation:** Evidence that actual operators can correctly interpret the display under test conditions (Section 8)

### 1.2 Certification Is Conditional

A certification is conditional on: the implementation version certified, the governance specification version at time of certification, and the corpus version used. A certification does not transfer to a different implementation version, a different specification version, or a different corpus.

### 1.3 What Certification Does Not Mean

- Certification does not mean the implementation is complete or feature-rich
- Certification does not mean the implementation is performant or accessible for all users
- Certification means specifically: operators can safely reason through operational reality using this implementation

---

## Section 2 — Certification Levels

### Certification Level UC-1: Informational Deployment

**Scope:** Frontend implementations that display non-operational information only — navigation, help text, configuration panels, reporting that is not used in real-time operational decisions.

**Required evidence:**
- Standard functional tests passing
- No operational state (venue health, override status, synchronization state, content resolution) is rendered by this implementation

**Deployment gate:** Evidence that operational state rendering is not present. A single test asserting no access to authoritative state stores.

---

### Certification Level UC-2: Operational Deployment

**Scope:** Frontend implementations that display operational state used in real-time decision-making.

**Required evidence (full list in Section 3):**
- Rendering state machine compliance
- PENDING state rendering compliance
- STALE/DEGRADED state handling
- Explanation availability
- Observability emission
- Replay/live isolation (basic)

**Deployment gate:** All Section 3 evidence artifacts present and verified. No evidence = no deployment.

---

### Certification Level UC-3: Replay-Critical Deployment

**Scope:** Frontend implementations that participate in replay rendering, live/replay distinction, temporal navigation, or counterfactual rendering.

**Required evidence (UC-2 plus Section 4):**
- Replay/live visual distinction under all accessibility modes
- Replay state isolation test (no live state enters replay render)
- Temporal accuracy validation
- Replay exit reconciliation

**Deployment gate:** All Section 4 evidence plus all UC-2 evidence.

---

### Certification Level UC-4: Incident-Critical Deployment

**Scope:** Frontend implementations that participate in emergency activation, incident escalation, or incident status display.

**Required evidence (UC-3 plus Section 5):**
- Emergency access path within 5-tap constraint
- Chaos/degradation test results
- Stress accessibility validation
- Incident reconstruction test

**Deployment gate:** All Section 5 evidence plus all UC-3 evidence. Must be re-certified after any incident that involves this implementation.

---

## Section 3 — Required Certification Checks for UC-2

### 3.1 Replay Parity Verification

**What it verifies:** The implementation renders PRE-connected views identically to what PRE resolution output specifies.

**Required evidence:**
```
// Test: For corpus entry {id}, the implementation renders:
// - resolvedValue === corpus.resolvedValue
// - confidence display matches corpus.confidence
// - explanation accessible at EH-2 level
// - sourceTimestamp displayed matches corpus.preTimestamp

CertificationEvidence {
  testName: 'REPLAY_PARITY_CORPUS_SAMPLE',
  corpusEntriesTested: 20,     // Minimum 20 representative entries
  divergences: 0,               // Allowed: 0 — any divergence is a certification failure
  reportPath: 'cert/replay-parity-{timestamp}.json',
}
```

**Blocking condition:** Any divergence between rendered output and corpus canonical output. No exceptions.

### 3.2 Explanation Completeness Validation

**What it verifies:** Every displayed operational value has an accessible EH-2 explanation.

**Required evidence:**
```
// Test: For each displayed operational value in the implementation:
// - There exists an accessible explanation affordance
// - The explanation affordance opens an EH-2 panel
// - The EH-2 panel shows: resolution path, suppression tree (if applicable), resolved at timestamp

CertificationEvidence {
  testName: 'EXPLANATION_COMPLETENESS',
  operationalValuesAudited: N,
  valuesWithEH2Access: N,  // Must equal operationalValuesAudited
  valuesWithoutEH2Access: 0,  // Must be 0
}
```

**Blocking condition:** Any operational value without accessible EH-2 explanation.

### 3.3 Live/Replay Distinction Validation (Basic)

**What it verifies:** The implementation visually distinguishes LIVE and REPLAY rendering states.

**Required evidence:**
```
// Visual regression test comparing:
// - Same component in RS-01 AUTHORITATIVE (LIVE)
// - Same component in RS-06 REPLAY-RENDERED (REPLAY)
// Distinction must be present without relying on the replay header alone.

CertificationEvidence {
  testName: 'LIVE_REPLAY_VISUAL_DISTINCTION',
  testedModes: ['DEFAULT', 'HIGH_CONTRAST', 'COLOR_BLIND_PROTANOPIA', 'COLOR_BLIND_DEUTERANOPIA'],
  distinctionPresent: true,  // All modes
  baselineScreenshotPath: 'cert/live-replay-baseline-{timestamp}/',
}
```

**Blocking condition:** Any accessibility mode where LIVE and REPLAY are not visually distinguishable.

### 3.4 Operational Integrity Audits

**What it verifies:** Key operational integrity properties hold.

**Required evidence:**

```
// Test 1: No optimistic rendering
// Assertion: component output when isPending=true is identical to isPending=false
//            for the same confirmedAuthoritativeState
CertificationEvidence {
  testName: 'NO_OPTIMISTIC_RENDERING',
  result: 'PASS',
}

// Test 2: Authoritative state persists under PENDING
// Assertion: confirmedAuthoritativeState values are rendered when isPending=true
CertificationEvidence {
  testName: 'PENDING_STATE_COMPOSITION',
  result: 'PASS',
}

// Test 3: STALE badge appears at threshold
// Assertion: RS-05 entered and SB-03 rendered after STALE_AFTER_MS
CertificationEvidence {
  testName: 'STALE_BADGE_THRESHOLD',
  testedThresholdMs: FRESHNESS_THRESHOLDS.STALE_AFTER_MS,
  result: 'PASS',
}

// Test 4: STALE state blocks consequential interactions
// Assertion: consequential action affordances disabled in RS-05
CertificationEvidence {
  testName: 'STALE_INTERACTION_BLOCKING',
  result: 'PASS',
}

// Test 5: Degraded state disclosure is specific
// Assertion: degraded description includes scope and reason, not generic message
CertificationEvidence {
  testName: 'DEGRADED_DISCLOSURE_SPECIFICITY',
  result: 'PASS',
}
```

### 3.5 Interaction Safety Certification

**What it verifies:** Interaction flows conform to REALTIME-INTERACTION-SAFETY-v1.md.

**Required evidence:**
```
// Test: Form context snapshot and stale-action detection
CertificationEvidence {
  testName: 'STALE_ACTION_DETECTION',
  testedFlows: ['IF-01', 'IF-03'],  // Flows with form context age requirements
  result: 'PASS',
}

// Test: Draft preservation on Tier 4+ interruption
CertificationEvidence {
  testName: 'DRAFT_PRESERVATION_ON_INTERRUPT',
  result: 'PASS',
}

// Test: Rollback visual distinction
CertificationEvidence {
  testName: 'ROLLBACK_VISUAL_DISTINCTION',
  // Rollback transition must be visually distinguishable from forward transition
  result: 'PASS',
}
```

### 3.6 Degraded-Mode Certification

**What it verifies:** All six degraded states are handled correctly.

**Required evidence:**
```
// Each degraded state (DS-01 through DS-06) must have a test case.
// Test: DS-06 PRE Unreachable — most severe
CertificationEvidence {
  testName: 'DEGRADED_STATE_DS_06',
  // Verifies: last PRE confirmation timestamp displayed
  // Verifies: emergency activation still accessible (DS-06 does not disable emergency)
  // Verifies: authoritative state persists under DS-06 badge
  result: 'PASS',
}
```

---

## Section 4 — Replay-Critical Evidence (UC-3)

### 4.1 Replay State Isolation Test

**Critical test — no live state may affect replay render.**

```
// Test procedure:
// 1. Put component in RS-06 REPLAY-RENDERED state.
// 2. Inject a live EC-01 PRE Resolution event for the same scope.
// 3. Assert: component render output is unchanged.
// 4. Assert: no re-render triggered by the live event.

CertificationEvidence {
  testName: 'REPLAY_STATE_ISOLATION',
  liveEventsInjected: 10,
  rerenderCount: 0,  // Must be 0 — any live-triggered re-render is a failure
  result: 'PASS',
}
```

**Blocking condition:** Any re-render caused by a live event while in replay state.

### 4.2 Temporal Accuracy Validation

```
// Test: All displayed timestamps use PRE operational clock, not device clock.
// Verification: Replace device clock with a mock. Change replay timestamp.
// Assert: displayed timestamps change. Device clock mock changes do not affect display.

CertificationEvidence {
  testName: 'TEMPORAL_AUTHORITY_PRE_CLOCK',
  result: 'PASS',
}
```

### 4.3 Replay Exit Reconciliation

```
// Test: Exit replay mode. Assert reconciliation summary appears.
// Reconciliation summary must list live changes that occurred during replay.
// Reconciliation summary must not automatically dismiss — operator acknowledges it.

CertificationEvidence {
  testName: 'REPLAY_EXIT_RECONCILIATION',
  liveEventsDuringReplay: 5,
  summaryDisplayed: true,
  autoDissmissed: false,  // Must be false
  result: 'PASS',
}
```

---

## Section 5 — Incident-Critical Evidence (UC-4)

### 5.1 Emergency Access Path Validation

```
// Test: From the most deeply nested operational view, count the taps required
// to reach emergency activation control.
// Assert: count <= 5

CertificationEvidence {
  testName: 'EMERGENCY_ACCESS_WITHIN_5_TAPS',
  startingViews: ['FLEET_VIEW', 'VENUE_DETAIL', 'SCREEN_INTROSPECTION', 'REPLAY_VIEW'],
  maxTapCount: 5,
  results: {
    'FLEET_VIEW': 2,
    'VENUE_DETAIL': 3,
    'SCREEN_INTROSPECTION': 4,
    'REPLAY_VIEW': 4,
  },
  allWithin5Taps: true,
  result: 'PASS',
}
```

### 5.2 Chaos/Degradation Test Results

```
// Test: Under each chaos condition, emergency controls remain accessible.
// Chaos conditions tested: delayed events, disconnection, PRE unreachable, stale state.

CertificationEvidence {
  testName: 'EMERGENCY_ACCESSIBLE_UNDER_CHAOS',
  chaosConditions: [
    { condition: 'DS-06_PRE_UNREACHABLE', emergencyAccessible: true },
    { condition: 'DS-05_BACKEND_UNAVAILABLE', emergencyAccessible: true },
    { condition: 'DS-02_DISCONNECTED', emergencyAccessible: true },
    { condition: 'RS-05_ALL_SCOPES_STALE', emergencyAccessible: true },
  ],
  result: 'PASS',
}
```

### 5.3 Incident Reconstruction Test

```
// Test: Given a simulated incident session, can the incident be fully reconstructed?
// Using: session audit trail + PRE replay corpus

CertificationEvidence {
  testName: 'INCIDENT_RECONSTRUCTION_COMPLETENESS',
  simulatedIncidentDuration: 600_000,  // 10 minutes
  reconstructionCoverage: 1.0,         // 100% coverage required for UC-4
  divergences: 0,                      // No divergence between display and PRE output
  result: 'PASS',
}
```

---

## Section 6 — Accessibility as Operational Survivability

### 6.1 Accessibility Is Operational, Not Optional

In an operational context, accessibility failures are operational failures. An operator who cannot read the STALE badge in low-light conditions, or who cannot navigate to emergency controls with keyboard-only input, is operationally impaired.

**Accessibility certification requirements:**

```
CertificationEvidence {
  testName: 'OPERATIONAL_ACCESSIBILITY',
  checks: [
    {
      name: 'STATE_BADGE_CONTRAST',
      // All state badges (SB-01 through SB-08) meet 4.5:1 contrast ratio
      // in both light mode and all supported ambient lighting profiles
      result: 'PASS',
    },
    {
      name: 'KEYBOARD_NAVIGATION_EMERGENCY',
      // Emergency activation reachable via keyboard-only navigation
      result: 'PASS',
    },
    {
      name: 'DEGRADED_STATE_READABILITY',
      // DEGRADED and STALE badges readable at 2x system text scale
      result: 'PASS',
    },
    {
      name: 'PENDING_INDICATOR_PERCEIVABLE',
      // PENDING indicator visible without relying on color alone
      result: 'PASS',
    },
    {
      name: 'SCREEN_READER_STATE_ANNOUNCEMENT',
      // Rendering state transitions are announced to screen readers
      result: 'PASS',
    },
  ],
}
```

### 6.2 Stress Accessibility

Under simulated high-cognitive-load conditions (rapid state changes, multiple simultaneous alerts):

```
CertificationEvidence {
  testName: 'STRESS_ACCESSIBILITY',
  scenario: 'SIMULTANEOUS_MULTI_SCOPE_DEGRADATION',
  // All critical controls remain reachable
  // All state badges remain readable
  // Emergency access not impeded by notification volume
  result: 'PASS',
}
```

---

## Section 7 — Regression Certification Requirements

### 7.1 Certification Invalidation Triggers

A certification is invalidated when any of the following occur:

| Trigger | Invalidates | Re-certification required before |
|---|---|---|
| Change to certified component code | Full certification at current level | Next deployment of that component |
| Change to dependency affecting certified behavior | Affected certification checks | Next deployment of that component |
| Governance specification update (any Phase) | All certifications that reference the updated spec | First deployment after specification change |
| Automated validation failure in CI | Specific failing checks | PR that introduced the failure may not merge |
| Incident involving certified component | Full UC-4 re-certification (if incident-critical) | Return to operational use after incident |

### 7.2 Re-Certification Scope

Re-certification is always for the full certification level, not only the affected checks:

```
// A change that affects only the STALE badge rendering
// requires re-certification of all UC-2 checks — not only check 3.3.

// Reason: changes that seem isolated often have interaction effects.
// Partial re-certification creates false confidence.
```

### 7.3 Dependency Drift Re-Certification

When a dependency updates and the update could affect certified behavior, the component must re-certify:

```
// Example: useAuthoritativeState hook is updated.
// All components that use useAuthoritativeState must re-certify
// even if their own code did not change.

// Implementation: certification declares its dependency versions.
CertificationRecord {
  componentId: string,
  implementationVersion: string,
  certificationLevel: 'UC-2' | 'UC-3' | 'UC-4',
  specificationVersions: {
    'RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md': '1.0',
    'FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md': '1.0',
    // ... all referenced specs
  },
  dependencyVersions: {
    'useAuthoritativeState': '2.1.0',
    'frontendObservabilityStream': '1.3.0',
    // ... all runtime dependencies
  },
  certifiedAt: number,
  evidence: CertificationEvidence[],
}
```

---

## Section 8 — Operator Comprehension Testing

### 8.1 What Operator Comprehension Testing Is

Operator comprehension testing is the validation that actual operators, not test engineers, can correctly interpret what the implementation displays. It is the final certification gate for UC-3 and UC-4 deployments.

**Comprehension testing is not usability testing.** Usability testing asks: "Is this easy to use?" Comprehension testing asks: "Given what you see, what is actually happening in the operational system?" The answer must be correct.

### 8.2 Comprehension Testing Protocol

```
// Test setup: Present an operator with the implementation under a specific scenario.
// The operator has not been told what the scenario is.
// Ask the operator to describe what is currently happening operationally.

ComprehensiontestScenario {
  scenario: 'VENUE_IN_STALE_STATE_WHILE_IN_REPLAY',
  displayState: {
    renderingMode: 'REPLAY',
    replayTimestamp: T - 3600,     // 1 hour ago
    venueHealthInReplay: 'B',
    venueHealthCurrent: 'D',       // Current live state has degraded
  },
  question: 'What is the current health of this venue, and is the displayed grade current?',
  acceptableAnswers: [
    'The displayed grade B is from 1 hour ago in replay; current grade is unknown from this view',
    'The B grade is historical replay state; I need to exit replay to see current state',
  ],
  unacceptableAnswers: [
    'The venue health is B',  // Missing temporal context
    'I cannot tell',          // The display must make this determinable
  ],
}
```

### 8.3 Comprehension Test Minimum Requirements

| Certification level | Minimum scenarios | Minimum operators tested | Minimum pass rate |
|---|---|---|---|
| UC-2 | 5 scenarios | 3 operators | 80% |
| UC-3 | 8 scenarios (includes 3 replay-specific) | 4 operators | 85% |
| UC-4 | 12 scenarios (includes 3 emergency-specific, 3 chaos-condition) | 5 operators | 90% |

**Comprehension test failures are specification feedback, not only implementation feedback.** If operators consistently cannot correctly interpret a display that is technically compliant, the specification may describe behavior that is operationally unclear. This feedback routes to Agent 3 for specification review — not only to the implementation team.

---

## Section 9 — What Blocks Deployment

The following are unconditional deployment blocks — they cannot be overridden by deadline pressure, management approval, or "temporary exception":

1. **No certification record for the deployment's operational role.** An implementation that displays operational state without a UC-2+ certification record does not deploy.

2. **Replay/live isolation test failure.** An implementation that passes live events to the replay render path does not deploy.

3. **Explanation completeness failure.** An implementation with operational values that have no accessible EH-2 explanation does not deploy.

4. **Emergency access test failure.** A UC-4 implementation where emergency controls are not reachable within 5 taps does not deploy.

5. **Replay corpus divergence.** An implementation whose rendered output diverges from the corpus canonical output without an approved corpus update does not deploy.

6. **Operator comprehension pass rate below threshold.** An implementation that fails operator comprehension testing does not deploy.

7. **Accessibility operational requirements failure.** An implementation that fails state badge contrast, keyboard navigation to emergency, or screen reader announcement does not deploy.

---

## Section 10 — Mandatory Evidence Artifacts

Every certified deployment must produce and retain the following:

```
CertificationPackage {
  // 1. Certification record
  certificationRecord: CertificationRecord,

  // 2. All evidence artifacts
  evidence: {
    replayParityReport: File,         // JSON report of corpus test results
    explanationCompletenessReport: File,
    liveReplayDistinctionScreenshots: Directory,
    operationalIntegrityTestResults: File,
    interactionSafetyTestResults: File,
    degradedModeTestResults: File,
    accessibilityTestResults: File,
    operatorComprehensionTestResults: File,  // UC-3+
    chaosTestResults: File,                  // UC-4
    incidentReconstructionTestResults: File, // UC-4
  },

  // 3. Baseline snapshots for regression detection
  baselines: {
    renderingStateScreenshots: Directory,   // One per RS state
    liveReplayDistinctionBaselines: Directory,
    degradedStateBaselines: Directory,
  },

  // 4. Sign-offs
  signoffs: {
    agent3Lead: SignoffRecord,           // Required for all levels
    agent2Lead: SignoffRecord,           // Required for UC-3+
    agent1Lead: SignoffRecord,           // Required for UC-4
  },
}
```

---

## Related Documents

**COMPONENT-CERTIFICATION-AND-COMPLIANCE-v1.md** — The component-level certification system (CL-1 through CL-4) that this document's implementation-level certification (UC-1 through UC-4) extends and complements.

**AUTOMATED-CONSTITUTIONAL-VALIDATION-v1.md** — The automated validation checks that produce several of the required evidence artifacts in this document's Section 3.

**FRONTEND-IMPLEMENTATION-PATTERNS-v1.md** — The implementation patterns whose compliance is tested in Section 3 certification checks.

**OPERATIONAL-FRONTEND-OBSERVABILITY-v1.md** — The observability requirements (Section 9) that the incident reconstruction test (Section 5.3) depends on.

**REALTIME-INTERACTION-SAFETY-v1.md** — The interaction safety rules that Section 3.5 certifies.

**OPERATIONAL-REGRESSION-AND-DRIFT-AUDITING-v1.md** — The audit framework that uses certification evidence artifacts for periodic compliance audits.

---

*End of UX-IMPLEMENTATION-CERTIFICATION-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Backend evidence artifact integration and session audit data: Agent 2 authority*
*PRE corpus integration and replay parity evidence: Agent 1 authority*
*Certification levels, evidence requirements, and operator comprehension protocol: Agent 3 definition authority*
*UC-4 deployment requires sign-off from all three agent leads.*
