# ClubHub TV — Operational Shell and Application Chrome
# Operational Execution Surface Era — Operational Application Shape Governance

**Document type:** Implementation governance — persistent shell structure, always-visible surfaces, and operational interrupt hierarchy
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; shell/layout implementors; all contributors building persistent application surfaces
**Last updated:** 2026-05-26
**Status:** CANONICAL — the shell is operational infrastructure; shell regressions are operational safety failures
**Phase:** Operational Execution Surface Era

---

## Purpose

This document defines the persistent operational shell that surrounds all ClubHub TV workflows: what it displays, what must always be visible, what may collapse, what must survive navigation, and how it behaves during degraded and incident conditions.

The threat this document addresses: **operator context loss during navigation.** An operator who navigates from a venue detail view to fleet overview must not lose awareness of: an active incident, a pending action they initiated, a degraded synchronization state, or a replay investigation they were conducting. The shell is the mechanism by which operational reality persists across all navigation events.

**The governing principle: operators must never lose awareness of operational reality while navigating.** The shell is not chrome — it is not decoration, branding, or navigation convenience. It is the persistent operational context layer that ensures the operator always knows what is happening across the system, regardless of which workspace they are currently in.

---

## Section 1 — Shell Topology

### 1.1 Shell Structure

The shell wraps all workspaces. It is always present and always rendering, regardless of which workspace is active.

```
┌──────────────────────────────────────────────────────────────┐
│  GLOBAL OPERATIONAL HEADER                                   │
│  [System health] [Incident state] [Replay state]            │
│  [Operator identity] [Authority level] [Session context]    │
├─────────────┬────────────────────────────────────────────────┤
│  GLOBAL     │                                                │
│  NAVIGATION │     WORKSPACE RENDERING AREA                  │
│  RAIL       │     (workspaces mount here)                   │
│             │                                                │
│  [Fleet]    │                                                │
│  [Venues]   │                                                │
│  [Incident] │                                                │
│  [Replay]   │                                                │
│             │                                                │
├─────────────┴────────────────────────────────────────────────┤
│  NOTIFICATION TRAY                                           │
│  [Active escalations] [Pending actions] [Recent events]     │
└──────────────────────────────────────────────────────────────┘
```

**Global Operational Header:** Never hidden. Never collapsed. Fixed height. Contains the surfaces defined in Section 2.

**Global Navigation Rail:** Collapsible by operator action only. Provides workspace navigation and high-level fleet health indicators. When collapsed, persists as a minimal icon rail — navigation affordances never disappear entirely.

**Workspace Rendering Area:** Workspaces mount and unmount here. The shell does not scroll with workspace content.

**Notification Tray:** Fixed position. Maximum height: 30% of viewport. When notification volume exceeds the tray capacity, lower-priority notifications are moved to a notification log accessible in one tap. Critical escalations (Tier 4+) are never moved to the log — they persist in the tray until explicitly acknowledged.

---

## Section 2 — Global Health Surfaces

### 2.1 Fleet Health Summary

The global header contains a persistent fleet health summary:

```
<FleetHealthSummary
  // Always visible — cannot be hidden or collapsed
  // Updates continuously from the live fleet state model
  criticalVenueCount={criticalCount}   // Venues at health F
  degradedVenueCount={degradedCount}   // Venues at health D or below
  incidentActiveCount={incidentCount}  // Active incidents
  synchronizationState={fleetSyncState} // Worst synchronization state across fleet
  // In REPLAY mode: shows fleet health at replay timestamp
  // Clearly labeled with temporal context in REPLAY mode
/>
```

**What FleetHealthSummary does NOT show:**
- Individual venue names (detail is in the Fleet workspace — summary is counts only)
- The best venues (operational salience: operators need to know what's wrong)
- Aggregated averages that obscure the worst state

### 2.2 Live Operational Status

A live operational status indicator persists in the global header:

```
<LiveOperationalStatus
  // Reflects the worst synchronization state visible to the operator
  // given their current fleet access
  state={worstSyncState}  // SS-01 through SS-07
  staleScopes={staleScopeCount}
  lastConfirmedAt={mostRecentConfirmation}
  // In SS-01 SYNCHRONIZED: minimal indicator (does not compete for attention)
  // In SS-04 STALE or worse: prominent indicator with duration
  // In SS-06 DISCONNECTED: prominent indicator with reconnection status
/>
```

---

## Section 3 — Replay-State Visibility

### 3.1 Shell Behavior in Replay Mode

When any workspace enters replay mode, the shell reflects this:

```
<ReplayModeIndicator
  // Appears in the Global Operational Header when any workspace is in replay mode
  active={isAnyWorkspaceInReplay}
  replayTimestamp={activeReplayTimestamp}
  timeSincePresent={timeSincePresent}
  affectedWorkspace={replayingWorkspaceId}
  // Allows the operator to immediately see: "I am currently in a historical view"
  // Even if they navigate to a different workspace, the indicator persists
  // until they exit replay in the original workspace
/>
```

**Critical behavior:** If the operator navigates to a different workspace while in replay mode, the new workspace opens in LIVE mode — but the shell still shows that a replay investigation is active in the background. The operator does not lose their replay anchor.

### 3.2 Replay Anchor Persistence in Shell

```
// The shell maintains the operator's active replay sessions.
// An operator may have: one live workspace + one replay investigation simultaneously.
// The shell navigation rail shows both.

<ShellNavigationRail>
  <WorkspaceLink workspace="VENUE_OPERATIONS" mode="LIVE" />
  <WorkspaceLink workspace="REPLAY_INVESTIGATION" mode="REPLAY"
    replayTimestamp={anchor.timestamp}
    badge="REPLAY"  // Always shows REPLAY badge when in replay
  />
</ShellNavigationRail>
```

---

## Section 4 — Incident-State Persistence

### 4.1 Active Incident Indicator

When an operational incident is active, the shell displays a persistent incident indicator:

```
<ActiveIncidentIndicator
  // Persists across ALL navigation — regardless of which workspace is active
  // Cannot be dismissed — remains until incident is resolved
  incidents={activeIncidents}
  // Each incident: severity, scope, duration, current status
  // Tapping opens the Incident Response workspace for that incident
  severity={mostSevereSeverity}  // Visual prominence matches severity
/>
```

**What the incident indicator does NOT do:**
- Auto-open the Incident Response workspace (navigation is always operator-initiated)
- Animate continuously (static indicator after initial appearance — animation for initial arrival only)
- Show resolved incidents (post-resolution, the indicator clears — history is in the audit log)

### 4.2 Incident Count vs. Incident Detail

```
// Shell shows incident count and severity — not incident detail.
// Detail is in the Incident Response workspace.
// The shell tells the operator "something needs attention" — not "here is everything".

// Exception: if only one incident is active, the shell may show the incident name
// and primary scope directly (count of 1 is as specific as a name).
```

---

## Section 5 — Multi-Venue Context Visibility

### 5.1 Global Navigation Rail — Venue Health Indicators

```
<GlobalNavigationRail>
  <FleetLink healthSummary={fleetHealthSummary} />
  <VenueList>
    {venues.map(venue => (
      <VenueLink
        key={venue.id}
        venue={venue}
        healthGrade={venue.healthGrade}        // A–F
        hasActiveIncident={venue.hasIncident}
        hasPendingOverride={venue.hasOverride}
        syncState={venue.syncState}
        // Shows grade + incident/override indicators — not full operational state
        // Active venue (currently being viewed) is highlighted
      />
    ))}
  </VenueList>
</GlobalNavigationRail>
```

**Venue list in navigation rail must not show more than the operator's authorized scope.** Venues the operator has no authority over are not shown — not shown as greyed out, not shown at all.

### 5.2 Fleet-Wide Anomaly Surfacing

```
// When a fleet-wide anomaly is detected (multiple venues degrading simultaneously,
// a fleet-wide override is active, a synchronization event affects all venues):
// The shell surfaces this in the Global Operational Header — not only in the fleet workspace.

<FleetAnomalyBanner
  // Appears when: 3+ venues have same type of degradation simultaneously
  //               OR a fleet-wide override is active
  //               OR fleet synchronization state is SS-04 STALE or worse
  type={anomalyType}
  affectedVenueCount={count}
  description={anomalyDescription}
  // Non-blocking — does not prevent current workflow
  // Persists until the anomaly resolves or the operator navigates to fleet overview
/>
```

---

## Section 6 — Operator Identity and Authority Visibility

### 6.1 Persistent Identity Display

```
<OperatorIdentityPanel>
  // Always visible in Global Operational Header
  operatorName={operator.displayName}
  authorityLevel={operator.authorityLevel}  // OBSERVER | OPERATOR | SENIOR | ADMIN
  activeScope={operator.authorizedScope}    // Which venues/fleet they can act on
  sessionDuration={sessionDuration}
  // No authentication controls in the shell during active session
  // Authority level is display-only — it does not change during a session
</OperatorIdentityPanel>
```

### 6.2 Authority Boundary Visibility

When the operator attempts to navigate to a scope outside their authority:

```
// The navigation affordance for out-of-scope venues is not hidden — it is present but labeled.
// Operators who can see but not act on a venue are shown the venue in a read-only state.
// Operators who cannot see a venue at all do not see it in the navigation rail.

// When an operator's pending action is about to exceed their authority:
// The confirmation step surfaces this before submission — not after rejection.
<AuthorityBoundaryWarning
  action={pendingAction}
  requiredAuthority={action.requiredAuthority}
  operatorAuthority={operator.authorityLevel}
  // If operator authority < required authority: action is blocked before submission
  // Message: "This action requires [level] authority. Your current level is [level]."
/>
```

---

## Section 7 — Notification Containment

### 7.1 Notification Tray Governance

```
// The notification tray is the only place notifications appear in the shell.
// No floating toasts. No banner-over-content notifications (except Tier 4+).
// No notifications that reposition workspace content.

const NOTIFICATION_TRAY_CAPACITY = 5; // Maximum visible simultaneously
// Above capacity: lower-priority notifications moved to notification log
// Priority order for tray: Tier 5 > Tier 4 > Tier 3 > Tier 2 > Tier 1 > Tier 0

// Each notification shows:
// - Type indicator (visual tier badge)
// - Scope (which venue/screen/fleet element)
// - Description
// - Age (how long ago)
// - Dismiss affordance (Tier 0–3 only — Tier 4+ cannot be dismissed without acknowledgment)
```

### 7.2 Notification Persistence Rules

```
const NOTIFICATION_PERSISTENCE = {
  TIER_0_PASSIVE: 'AUTO_CLEAR_30S',      // Clears after 30 seconds
  TIER_1_ADVISORY: 'AUTO_CLEAR_60S',     // Clears after 60 seconds
  TIER_2_OPERATIONAL: 'MANUAL_DISMISS',  // Operator dismisses
  TIER_3_ATTENTION: 'MANUAL_DISMISS',    // Operator dismisses
  TIER_4_ESCALATION: 'ACKNOWLEDGE_REQUIRED', // Persists until acknowledged
  TIER_5_CRITICAL: 'ACKNOWLEDGE_REQUIRED',   // Persists until acknowledged + resolved
};
```

### 7.3 Anti-Notification-Storm Rules

```
// When more than 10 notifications of the same type arrive within 60 seconds:
// Storm suppression activates per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md.
// Individual notifications are collapsed into a summary:
// "15 passive updates in the last 60 seconds — [View all]"
// The individual notifications remain accessible in the notification log.
// Storm suppression does NOT apply to Tier 4+ notifications.
```

---

## Section 8 — Escalation Persistence

### 8.1 Escalation Surfaces That Must Never Be Hidden

The following shell surfaces are structurally persistent — they cannot be hidden by any navigation, any system state, any operator action during an active escalation:

1. **Active incident indicator** (Section 4.1) — persists until incident resolved
2. **Emergency activation indicator** — persists until emergency deactivated
3. **Tier 4+ notifications** in the notification tray — persist until acknowledged
4. **Degraded/disconnected synchronization state** indicator (Section 2.2)
5. **Replay mode indicator** (Section 3.1) — persists while replay investigation is active

### 8.2 Escalation-Safe Navigation

```
// When the operator navigates while an escalation is active:
// - The escalation surfaces described above follow them across all workspaces
// - The new workspace opens in its standard state — escalation does not pre-select a scope
//   unless the escalation is about a specific scope within the new workspace
// - Escalation acknowledgment can happen from any workspace — not only from Incident workspace
```

---

## Section 9 — Temporal Context Persistence

### 9.1 Shell Temporal Display

The shell always shows the current PRE operational clock time:

```
<TemporalContextDisplay
  // Always visible — cannot be hidden
  preOperationalClock={currentPreClock}
  timezone={operatorTimezone}
  // When in replay mode for any workspace:
  replayTimestamp={activeReplayTimestamp}
  // Shows both: "Now: [time]" and "Replay: [time]" when investigation is active
/>
```

### 9.2 Temporal Context Across Workspaces

The shell is the single source of the current PRE operational clock time. All workspaces read from the shell's temporal context — they do not independently query the PRE clock.

```
// Shell provides temporal context via context/provider pattern.
// All workspace components consume this — they do not independently track time.
// This ensures all displayed times are consistent and derived from the same reference.
const { preOperationalClock, replayTimestamp } = useShellTemporalContext();
```

---

## Section 10 — Degraded-Mode Shell Behavior

### 10.1 Shell Degradation Rules

When the system enters a degraded state, the shell degrades gracefully and specifically:

| Degraded state | Shell response |
|---|---|
| DS-01 Partial synchronization | LiveOperationalStatus shows partial state; affected venue count shown |
| DS-02 Disconnected operation | Prominent DISCONNECTED banner in header; reconnection attempt count shown |
| DS-03 Stale replay | Replay investigation indicator shows STALE with last confirmed replay timestamp |
| DS-04 Delayed event propagation | LiveOperationalStatus shows AGING with delay duration |
| DS-05 Backend unavailable | Full-shell degradation banner; fleet health shows last confirmed state with age |
| DS-06 PRE unreachable | Highest-prominence degradation; all state shows last PRE confirmation timestamp |

### 10.2 Shell Must Function Under All Degradation

```
// The shell must render correctly and display useful information even when:
// - Backend is unreachable (DS-05)
// - PRE is unreachable (DS-06)
// - WebSocket is disconnected

// During DS-05/DS-06:
// - Fleet health summary shows last confirmed state with explicit age: "As of 4m 32s ago"
// - Navigation rail remains functional (operator can navigate between workspaces)
// - Incident indicators persist (incidents don't disappear because sync is lost)
// - Emergency activation remains accessible (DS-06 does not block emergency)

// The shell must not blank out, show empty states, or show error screens during degradation.
// It shows the last known state with explicit staleness disclosure.
```

---

## Section 11 — Shell Authority Over Local Workflows

### 11.1 Operational Interrupt Hierarchy

The shell has authority to surface operational conditions that override local workspace state, in this priority order:

| Priority | Shell authority | Mechanism |
|---|---|---|
| 1 (highest) | Emergency activation in-progress | Full emergency shell mode (Section 10.1 in INCIDENT-MODE-APPLICATION-BEHAVIOR-v1.md) |
| 2 | Tier 5 critical event | Blocking modal overlay from shell |
| 3 | Tier 4 escalation event | Non-blocking Tier 4 notification in tray; banner if operator is mid-action |
| 4 | Fleet-wide anomaly | Anomaly banner in header |
| 5 | Synchronization degradation | Status indicator update only — no interruption |
| 6 | Passive operational updates | Tray notification only — no interruption |

**The shell never interrupts an emergency activation flow** (IF-02). If a Tier 5 event arrives during an emergency activation, it is queued and shown after the activation completes.

### 11.2 What Is Always Visible in the Shell

Regardless of workspace, navigation state, modal state, or system state, the following are always visible:

- Fleet health summary counts
- Operator identity and authority level
- Current PRE operational clock / replay timestamp
- Active incident indicator (if incident active)
- Synchronization state indicator
- Emergency activation control affordance

These surfaces have no collapsed state, no hidden state, and no conditional rendering. Their visibility is unconditional.

---

## Failure Modes

### Failure Mode OS-01: Context Amnesia

**What it is:** The operator navigates from one workspace to another and the shell fails to persist their operational context (active incident, replay anchor, pending action). The operator must rebuild context from scratch on each navigation.

**Prevention:** Context persistence (Section 5) and incident state persistence (Section 4). The shell owns operational context across navigation — workspaces read from the shell, not from their own isolated state.

---

### Failure Mode OS-02: Ghost Notification Storm

**What it is:** Notifications accumulate in the tray faster than the operator can process them. Lower-priority notifications push higher-priority ones out of view. The operator misses an escalation because the tray was full of advisory notifications.

**Prevention:** Notification containment (Section 7). Tray capacity limit enforces priority ordering. Storm suppression collapses advisory flood. Tier 4+ notifications cannot be displaced.

---

### Failure Mode OS-03: Replay Context Loss on Navigation

**What it is:** The operator navigates away from a replay investigation workspace. The replay anchor is not persisted in the shell. When they navigate back, the investigation is gone. They have lost hours of investigative context.

**Prevention:** Replay anchor persistence (Section 3.2). The shell maintains active replay sessions. Navigation does not destroy investigation context.

---

### Failure Mode OS-04: Silent Degradation During Workflow

**What it is:** The operator is in the middle of an override creation flow. The system enters DS-04 delayed event propagation. The shell does not surface this clearly because the notification tray is minimized and the status indicator is subtle. The operator completes the action against stale state.

**Prevention:** Degraded-mode shell behavior (Section 10.1). DS-04 specifically surfaces delayed event propagation in the LiveOperationalStatus indicator with duration — it is not a subtle indicator. The status indicator escalates visually with degradation severity.

---

### Failure Mode OS-05: Shell Blank Under Degradation

**What it is:** When the backend is unreachable (DS-05), the shell renders empty states for fleet health, venue list, and operational status. The operator sees a blank shell and cannot determine what is still functional.

**Prevention:** Shell degradation rules (Section 10.2). The shell never blanks. It shows last confirmed state with explicit age labels. Even under full disconnection, the shell provides the last known fleet state and clearly labels it as stale.

---

## Related Documents

**WORKSPACE-COMPOSITION-ARCHITECTURE-v1.md** — The workspace zones and composition rules that the shell's Workspace Rendering Area hosts.

**INCIDENT-MODE-APPLICATION-BEHAVIOR-v1.md** — The incident-mode transformation rules that govern how the shell changes behavior during active incidents.

**FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md** — The degraded states (DS-01 through DS-06) that Section 10 shell degradation rules map to.

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — The signal tiers (Tier 0–5) and storm suppression rules that Section 7 notification containment implements.

**OPERATIONAL-NAVIGATION-GOVERNANCE.md** — The navigation model that the Global Navigation Rail (Section 5) implements.

---

*End of OPERATIONAL-SHELL-AND-APPLICATION-CHROME-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*Shell synchronization state data contracts reviewed by: Agent 2*
*PRE operational clock temporal context reviewed by: Agent 1*
*Shell structure, persistent surfaces, and operational interrupt hierarchy: Agent 3 definition authority*
