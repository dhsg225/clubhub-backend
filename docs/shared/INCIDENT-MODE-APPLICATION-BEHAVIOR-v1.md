# ClubHub TV — Incident-Mode Application Behavior
# Operational Execution Surface Era — Operational Application Shape Governance

**Document type:** Implementation governance — how the frontend changes during operational incidents
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; incident response implementors; all contributors
**Last updated:** 2026-05-26
**Status:** CANONICAL — incident-mode frontend behavior must be certified separately from normal operational behavior
**Phase:** Operational Execution Surface Era

---

## Purpose

This document defines how the entire ClubHub TV frontend changes behavior during operational incidents: what escalates, what simplifies, what is suppressed, what must never change, and how the application returns to normal after an incident resolves.

The threat this document addresses: **cognitive overload at the moment of highest operational consequence.** Incidents are the moments when operators most need clear information and most need the system to support their reasoning. They are also the moments when the system is most likely to be producing a high volume of alerts, state changes, and notifications — potentially overwhelming the operator's ability to reason clearly.

**The governing principle: during incidents, the platform must become cognitively safer without becoming less truthful.** Simplification during incidents is not an excuse for hiding information. Information that was visible must remain accessible. The difference is: during normal operations, everything is equally prominent. During incidents, the most operationally relevant information is prominent, and everything else is accessible but de-emphasized.

---

## Section 1 — Incident-Mode Escalation Hierarchy

### 1.1 Incident Levels and Frontend Response

Incidents are classified by severity (from INCIDENT-OPERATIONS-UX-v1.md). Each level triggers a defined frontend response:

| Level | Definition | Frontend response |
|---|---|---|
| Level 1 — Monitoring | Anomaly detected, investigation warranted | Shell: incident indicator added. No workspace change. |
| Level 2 — Active | Incident confirmed, operator attention required | Shell: incident indicator prominent. Notification tray elevated. |
| Level 3 — Operational Impact | Content or service delivery affected | Incident-mode begins. Workspace transformation (Section 2). |
| Level 4 — Critical | Multiple venues/services affected, revenue impact | Full incident-mode. Emergency affordances elevated. |
| Level 5 — Emergency | Fleet-wide or time-critical failure | Emergency mode (Section 3). All non-emergency UI suppressed. |

### 1.2 Escalation Triggers

```
// Level transitions trigger frontend state changes.
// The trigger is the incident severity record from the backend — not operator UI action.
// The frontend reacts to confirmed incident level changes, not to suspicions.

function onIncidentLevelChange(incident, fromLevel, toLevel) {
  if (toLevel >= 3 && fromLevel < 3) {
    activateIncidentMode(incident);
  }
  if (toLevel >= 5 && fromLevel < 5) {
    activateEmergencyMode(incident);
  }
  if (toLevel < 3 && fromLevel >= 3) {
    initiateIncidentModeExit(incident);
  }
}
```

### 1.3 De-Escalation Rules

```
// De-escalation is immediate when confirmed by the backend.
// The frontend does not "wait to be sure" — when the incident level drops, the UI responds.
// Post-incident restoration (Section 9) governs the transition back to normal.

// De-escalation does NOT clear the incident record or its history.
// The incident timeline remains accessible for investigation.
// "Incident resolved" means operational impact has ended — not that the event is forgotten.
```

---

## Section 2 — UI Simplification Rules

### 2.1 What Simplifies at Level 3+ (Incident Mode)

```
// Incident-mode simplification: reduce visual noise without hiding operational truth.

// Simplified (de-emphasized, not hidden):
const SIMPLIFIED_AT_LEVEL_3 = [
  'PassiveTier0Tier1Notifications', // Collapsed to count in notification tray
  'ScheduleDetailPanels',           // Accessible via tap, not expanded by default
  'SponsorshipOperationsSurfaces',  // De-emphasized (not primary concern during incident)
  'HistoricalAnalyticsSurfaces',    // Accessible via navigation, not in primary workspace
  'NavigationZoneExpanded',         // Navigation rail collapses (operator focused on incident scope)
];

// Elevated (more prominent than normal):
const ELEVATED_AT_LEVEL_3 = [
  'IncidentTimeline',             // Expanded in Context Detail zone by default
  'AffectedScopeHealthDisplay',   // Full detail for affected venues
  'EscalationStatusSurface',      // Incident level and status always visible
  'ActiveInterventionSummary',    // All pending actions related to incident
  'CommunicationPersistenceSurface', // Inter-operator coordination visible
];
```

### 2.2 What Simplifies at Level 5 (Emergency Mode)

```
// Emergency mode: maximum signal reduction for maximum response clarity.

// Suppressed (not removed — accessible in one tap via "more" affordance):
const SUPPRESSED_AT_LEVEL_5 = [
  'AllTier0Tier1Tier2Notifications', // Collapsed entirely to log
  'ContextDetailZone',               // Collapsed — explanation accessible via tap
  'NavigationZoneExpanded',          // Collapsed to icon rail
  'SponsorshipSurfaces',
  'AnalyticsSurfaces',
  'SettingsAndConfiguration',
];

// Maximally prominent:
const MAXIMALLY_PROMINENT_AT_LEVEL_5 = [
  'EmergencyActivationControl',   // Largest affordance, fixed position
  'AffectedScopeStatus',          // Full viewport for emergency scope
  'IncidentTimeline',             // Live updating, always visible
  'RecoveryActionSurfaces',       // Recovery controls brought to surface
  'CommunicationSurface',         // Inter-operator coordination
];
```

### 2.3 Simplification Is Never Information Removal

```
// Simplification collapses, de-emphasizes, or moves — it does not delete.
// Every surface that is simplified must remain accessible within 2 taps.
// Simplified surfaces remain in the navigation model.

// Forbidden simplification patterns:
// - Hiding venue health grades during an incident (they may be relevant)
// - Hiding the explanation surface (it is more important during incidents, not less)
// - Hiding pending action indicators (unresolved actions are critical context during incidents)
// - Hiding replay access (operators may need to investigate incident origins)
// - Auto-applying an "incident view" that hides the operator's current work without warning

// Every simplification is reversible: the operator can expand any suppressed surface
// without exiting incident mode.
```

---

## Section 3 — Interruption Suppression Rules

### 3.1 Notifications Suppressed During Active Emergency Flow

```
// During IF-02 Emergency Activation Flow (which is uninterruptible):
// NO notifications may appear — they queue until the flow completes.
// This is the only context where even Tier 4+ notifications are queued.

// After IF-02 completes:
// All queued notifications are displayed in the notification tray.
// They are shown in chronological order — not in the order of the operator's urgency.
// The operator reviews what happened while they were completing the activation.
```

### 3.2 Notification Volume During Incident Mode

```
// During Level 3+ incident mode, notification storm suppression is aggressively applied.
// The operator's attention is already at capacity.

const INCIDENT_MODE_STORM_THRESHOLD = 3; // vs. 10 in normal mode
// If 3+ notifications of the same type arrive in 30 seconds during incident mode:
// They are immediately storm-suppressed into a summary count.
// The operator sees "12 updates in affected scope" not 12 individual notifications.
// The individual notifications remain in the log.

// Exception: Tier 4+ events are NEVER storm-suppressed regardless of volume.
// Each Tier 4+ event is individually visible in the tray.
```

---

## Section 4 — Operational Focus Narrowing

### 4.1 Scope Focus During Incident

```
// When an incident has a defined scope (specific venue, specific venue group, fleet-wide):
// The incident's scope becomes the primary operational focus in the workspace.

// What focus narrowing means:
// - The affected scope is the top-most item in the venue navigation rail
// - The Primary Operational Zone opens to the affected scope by default
// - Health indicators for the affected scope are displayed at full detail

// What focus narrowing does NOT mean:
// - The operator cannot navigate away from the affected scope (they can)
// - Other venues are hidden (they are still accessible in the navigation rail)
// - The operator is locked into a specific view (workspaces remain freely navigable)
```

### 4.2 Relevant Context Surfacing

```
// During incident mode, the Context Detail zone pre-populates with
// the most operationally relevant context for the incident:

<IncidentContextDetail
  incident={activeIncident}
  // Pre-expanded sections:
  sections={{
    incidentTimeline: 'EXPANDED',
    activeOverridesInScope: 'EXPANDED',
    recentStateChanges: 'EXPANDED',
    // Other sections available but collapsed:
    explanation: 'COLLAPSED',
    historicalContext: 'COLLAPSED',
  }}
/>
```

---

## Section 5 — Incident-Safe Navigation Behavior

### 5.1 Navigation Remains Freely Available

```
// Incident mode does NOT lock the operator into a specific workspace.
// Operators must be free to navigate as their investigation requires.
// They may need to check multiple venues, review replay, examine fleet state.

// What changes in navigation during incident mode:
// - The incident scope is highlighted in the navigation rail
// - The active incident indicator persists across all workspaces (shell, Section 4 of OPERATIONAL-SHELL)
// - Navigation to Incident Response workspace is one tap from anywhere
// - Navigation back to the incident scope is one tap from any other workspace

// What does NOT change:
// - Navigation affordances are all present
// - Replay navigation is available
// - Fleet/venue/screen navigation hierarchy is unchanged
```

### 5.2 Navigation History During Incident

```
// The navigation history during incident mode is preserved.
// When the incident resolves, the operator can review their navigation path
// as part of the incident reconstruction (this is an audit trail element).

// Navigation history during incident mode is not compressed or summarized —
// each workspace visit is recorded with timestamp.
```

---

## Section 6 — Emergency Action Prioritization

### 6.1 Emergency Control Visibility

```
// During Level 5 emergency mode, the emergency activation control transforms:
// - Size: increased to 2x normal tap target
// - Position: center-top of primary workspace (not only shell position)
// - Label: explicit action text "ACTIVATE EMERGENCY PROTOCOL — [scope]"
// - Background: distinct from all other interactive elements

// The emergency control must remain the most visually prominent interactive element
// until the emergency protocol is activated.
```

### 6.2 Recovery Action Surfacing

```
// When the emergency protocol is active, recovery actions surface in the Primary zone.
// Recovery actions come from the pre-defined recovery governance (RECOVERY_GOVERNANCE.md).
// They are not generated dynamically by the frontend.

<RecoveryActionSurface
  actions={recoveryActionsForIncidentType}
  // Each action shows:
  // - Action description
  // - Expected operational effect
  // - Authorization required
  // - Current status (NOT_STARTED | IN_PROGRESS | COMPLETED | FAILED)
  // Actions are ordered by recommended sequence — not by operator preference
/>
```

---

## Section 7 — Temporary Information Reprioritization

### 7.1 Attention Weight During Incident

During incident mode, the attention weight of different information types changes:

| Information type | Normal attention weight | Incident mode weight |
|---|---|---|
| Incident timeline | Low (not usually active) | Highest |
| Affected scope health | Normal | High |
| Active interventions | Normal | High |
| Other venue health | Normal | Reduced |
| Sponsorship/SOV data | Normal | Suppressed |
| Historical analytics | Normal | Suppressed |
| Passive notifications | Normal | Storm-suppressed |

**Attention weight is visual prominence only — not information availability.** Suppressed information is accessible. It has lower visual weight, not lower operational reality.

### 7.2 Reprioritization Is Temporary

```
// Information reprioritization ends when the incident resolves.
// Post-incident restoration (Section 9) returns all surfaces to their normal attention weights.
// The system does not "remember" incident-mode attention weights across sessions.

// If the operator manually changed density or visibility during the incident
// (they expanded a section or collapsed a panel): those operator choices persist.
// System-driven reprioritization is rolled back; operator choices are preserved.
```

---

## Section 8 — Communication Persistence

### 8.1 Inter-Operator Communication Surface

```
// During incident mode, the inter-operator communication surface becomes persistent.
// In normal mode: accessible via navigation.
// In incident mode: present in the Context Detail zone or as a persistent side panel.

<IncidentCommunicationPanel
  incidentId={incident.id}
  activeOperators={operatorsInIncidentContext}
  annotations={incidentAnnotations}
  // Annotations are replay-linked: each annotation is attached to a specific
  // PRE operational clock timestamp, not to a device timestamp
  onAnnotate={(text, timestamp) => addAnnotation(text, timestamp)}
/>
```

### 8.2 Annotation Persistence

```
// Incident annotations persist beyond the incident resolution.
// They become part of the incident record accessible in the audit trail.
// They are replay-linked: viewing the incident replay shows annotations
// at their correct temporal positions in the timeline.
```

---

## Section 9 — Post-Incident Restoration Behavior

### 9.1 Restoration Sequence

When an incident resolves (backend confirms incident level drops below 3), restoration occurs in a defined sequence:

```
// Restoration sequence (one step per render frame):
async function restoreFromIncidentMode(incident) {
  // Step 1: Show restoration start disclosure
  showRestorationDisclosure({
    incident: incident,
    message: `Incident resolved. Returning to normal operational view.`,
    summary: buildIncidentSummary(incident),
  });

  await waitForOperatorAcknowledgment(); // Operator dismisses the disclosure

  // Step 2: Replay pending notifications from during the incident
  displayIncidentNotificationSummary(incident.queuedNotifications);

  await waitForOperatorAcknowledgment();

  // Step 3: Restore UI surfaces to pre-incident state
  restoreWorkspaceLayout(preIncidentLayout);

  // Step 4: Persist incident record to history
  archiveIncident(incident);
}
```

### 9.2 Restoration Must Not Be Automatic

```
// Post-incident restoration requires operator acknowledgment before each step.
// The system must not automatically snap back to normal mode the instant an incident resolves.
// The operator may still be reviewing the incident, investigating causes, or applying recovery.

// What triggers restoration:
// - Operator explicitly dismisses the incident resolution disclosure
// - Operator navigates away from the Incident Response workspace after resolution

// What does NOT trigger restoration:
// - Automatic timeout
// - Backend reporting the incident as resolved
// - A new incident being detected (new incident = new incident mode, not restoration of old)
```

### 9.3 Post-Incident Debrief Surface

```
// After incident resolution, the incident record includes a debrief surface.
// The debrief surface is accessible for 72 hours after resolution.
// It provides:
// - Full incident timeline (replay-linked)
// - All operator actions taken during the incident (from interaction records)
// - All annotations
// - Replay navigation to the incident period
// - Pre-defined analysis prompts: "What triggered this?", "Was the response effective?"
//   (These are navigation affordances into the replay — not automated analysis)
```

---

## Section 10 — Anti-Panic Interaction Governance

### 10.1 Irreversibility Protection Under Stress

Incident mode increases irreversibility protection thresholds:

```
// Normal mode: 3-second confirmation delay for irreversible actions.
// Incident mode: 5-second confirmation delay for fleet-wide or multi-venue actions.
// Emergency mode: 3-second delay restored (speed is critical — but delay is not removed).

// Typed confirmation requirement during incident mode:
// Any action with blast radius > 2 venues requires typed confirmation.
// This was not required in normal mode for actions with blast radius 2–5 venues.
// During incidents, these actions are more likely to be taken under stress and therefore
// warrant the additional confirmation friction.
```

### 10.2 Action Stacking Prevention

```
// Under incident stress, operators may try to take multiple actions rapidly.
// Action stacking (submitting a second action before the first is confirmed)
// is limited during incident mode.

const INCIDENT_MODE_MAX_CONCURRENT_PENDING = 3; // vs. 5 in normal mode
// An operator who has 3 pending actions is prompted to wait for resolution
// before initiating a 4th. This is a soft gate — they can override — but the
// prompt forces a moment of deliberate decision.
```

### 10.3 Recovery Action Order Suggestion

```
// During incident mode, the system surfaces recommended action sequences
// based on the incident type. These are suggestions — not enforcement.
// The operator retains full authority to act in any order.

<RecoverySequenceSuggestion
  incidentType={incident.type}
  suggestedOrder={recoveryPlaybook.actionSequence}
  currentStep={lastCompletedStep}
  // Each step shows: recommended action, why this order, what to verify before proceeding
  // Operator can skip steps with one extra confirmation
  // Operator can reorder steps freely
/>
```

---

## Section 11 — What Must NEVER Change During Incident Mode

```
// These properties must remain identical in incident mode and normal mode:

const INVARIANT_DURING_INCIDENT = [
  // Operational truth:
  'PRE_RESOLUTION_OUTPUT_DISPLAYED', // Still shows confirmed PRE output only
  'REPLAY_PARITY',                   // Replay still accessible and accurate
  'EXPLANATION_AVAILABILITY',        // EH-2 explanations still accessible for all values
  'STALE_STATE_DISCLOSURE',          // Stale badges still appear at thresholds
  'DEGRADED_STATE_SPECIFICITY',      // Degraded disclosures still specific, not generic

  // Operator authority:
  'OPERATOR_AUTHORITY_BOUNDARIES',   // Authority levels unchanged
  'INTERACTION_AUDIT_TRAIL',         // All actions still recorded
  'PENDING_ACTION_VISIBILITY',       // Pending indicators still shown

  // Navigation:
  'REPLAY_ACCESS',                   // Replay always accessible
  'EXPLANATION_SURFACE_ACCESS',      // Context Detail always accessible (may be collapsed)

  // Safety:
  'PENDING_ACTION_CONFIRMATION_STEPS', // Confirmation steps not removed (may be extended)
  'ROLLBACK_VISIBILITY',              // Rejected actions still disclosed explicitly
];
```

---

## Section 12 — Incident-Mode Certification Rules

### 12.1 Certification Requirements for Incident-Mode Behavior

Frontend implementations that participate in incident response must be certified for incident-mode behavior in addition to their standard UC-4 certification:

**Required incident-mode evidence:**

```
CertificationEvidence {
  testName: 'INCIDENT_MODE_SIMPLIFICATION',
  // Verifies: suppressed surfaces are accessible within 2 taps
  // Verifies: elevated surfaces are visually prominent
  // Verifies: no operational truth is hidden (only de-emphasized)
  result: 'PASS',
}

CertificationEvidence {
  testName: 'INCIDENT_MODE_NOTIFICATION_SUPPRESSION',
  // Verifies: storm suppression triggers at 3 events in 30s (incident threshold)
  // Verifies: Tier 4+ events are NOT storm-suppressed during incident mode
  result: 'PASS',
}

CertificationEvidence {
  testName: 'RESTORATION_REQUIRES_ACKNOWLEDGMENT',
  // Verifies: restoration does not auto-trigger on incident resolution
  // Verifies: each restoration step requires operator acknowledgment
  result: 'PASS',
}

CertificationEvidence {
  testName: 'INCIDENT_MODE_INVARIANTS_PRESERVED',
  // Verifies each property in the INVARIANT_DURING_INCIDENT list above
  // Each invariant has its own assertion
  invariantsVerified: 15,    // All 15 properties in INVARIANT_DURING_INCIDENT
  invariantsFailed: 0,
  result: 'PASS',
}

CertificationEvidence {
  testName: 'POST_INCIDENT_DEBRIEF_ACCESSIBLE',
  // Verifies: debrief surface accessible within 72h of resolution
  // Verifies: replay-linked annotations at correct temporal positions
  result: 'PASS',
}
```

### 12.2 Transition Certification

The transitions into and out of incident mode must be certified:

```
CertificationEvidence {
  testName: 'INCIDENT_MODE_ENTRY_TRANSITION',
  // Verifies: transition completes within 200ms (Section 10 of WORKSPACE-COMPOSITION)
  // Verifies: operator's in-progress interaction is NOT interrupted by mode entry
  // Verifies: draft state is preserved through mode transition
  transitionDurationMs: 180,   // Must be <= 200ms
  interactionPreserved: true,
  draftPreserved: true,
  result: 'PASS',
}

CertificationEvidence {
  testName: 'INCIDENT_MODE_EXIT_REQUIRES_ACKNOWLEDGMENT',
  // Verifies: exit does not auto-trigger
  // Verifies: queued notifications are shown before exit completes
  result: 'PASS',
}
```

---

## Failure Modes

### Failure Mode IM-01: Cognitive Overload From Uniform Prominence

**What it is:** During an incident, all notifications and updates are displayed at equal prominence. The operator is overwhelmed by equal-weight signals and cannot identify what to address first.

**Prevention:** Information reprioritization (Section 7). Incident mode explicitly changes visual weight by tier. The operator's attention is guided — not by hiding information, but by making priority clear.

---

### Failure Mode IM-02: Hidden Information During Incident

**What it is:** Incident-mode simplification removes surfaces that turn out to be operationally relevant. The operator needs to check a historical state but replay has been hidden. They need to verify an explanation but the Context Detail zone was removed.

**Prevention:** Simplification is never removal (Section 2.3). Every simplified surface remains accessible within 2 taps. The INVARIANT_DURING_INCIDENT list (Section 11) explicitly includes replay access and explanation surface access.

---

### Failure Mode IM-03: Automatic Restoration Loss

**What it is:** The moment an incident resolves, the frontend automatically snaps back to normal mode. The operator is mid-investigation, reviewing replay, or documenting their response. They lose their context and their work.

**Prevention:** Restoration requires acknowledgment (Section 9.2). Restoration is a deliberate, multi-step process initiated by the operator — not an automatic state change triggered by incident resolution.

---

### Failure Mode IM-04: Panic Action Cascade

**What it is:** Under incident stress, the operator submits multiple overlapping actions because they don't trust the first action completed. The actions conflict. Some fail. The system enters a state that is worse than the original incident.

**Prevention:** Action stacking prevention (Section 10.2) and irreversibility protection (Section 10.1). Reduced concurrent pending limit forces awareness. Extended confirmation delay for high-blast-radius actions forces deliberation.

---

### Failure Mode IM-05: Incident-Mode Desensitization

**What it is:** Incident mode is triggered too easily — by Level 1 or Level 2 anomalies that don't warrant full mode activation. Operators see incident mode so frequently that they stop treating it as a meaningful signal. When a genuine Level 4 incident occurs, the mode change doesn't register as urgent.

**Prevention:** Incident-mode escalation hierarchy (Section 1.1). Incident mode begins only at Level 3 (Operational Impact) — confirmed operational effect, not mere detection. Level 1 and Level 2 use shell indicators only, not workspace transformation.

---

## Related Documents

**INCIDENT-OPERATIONS-UX-v1.md** — The 8 incident types, 5-phase lifecycle, and high-stress UX principles that this document's incident levels (Section 1.1) and anti-panic governance (Section 10) implement.

**WORKSPACE-COMPOSITION-ARCHITECTURE-v1.md** — The workspace transformation rules (Section 10) that incident-mode workspace changes (Section 2) implement.

**OPERATIONAL-SHELL-AND-APPLICATION-CHROME-v1.md** — The persistent shell incident indicator (Section 4) that surfaces incident state across all workspaces.

**REALTIME-INTERACTION-SAFETY-v1.md** — The interaction safety rules (Section 5–10) that incident-mode irreversibility protection (Section 10.1) extends.

**UX-IMPLEMENTATION-CERTIFICATION-v1.md** — The certification framework that incident-mode behavior certification (Section 12) extends with incident-specific evidence requirements.

---

*End of INCIDENT-MODE-APPLICATION-BEHAVIOR-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Incident level determination and recovery playbook data reviewed by: Agent 2*
*PRE availability during incident mode reviewed by: Agent 1*
*Incident-mode UI behavior, simplification rules, and anti-panic governance: Agent 3 definition authority*
