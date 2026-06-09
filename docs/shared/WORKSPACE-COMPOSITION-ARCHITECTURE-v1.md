# ClubHub TV — Workspace Composition Architecture
# Operational Execution Surface Era — Operational Application Shape Governance

**Document type:** Implementation governance — workspace topology, pane authority, and composition safety rules
**Authority:** Agent 3 (UX Architecture / Rendering Integrity)
**Audience:** Frontend engineers; workspace implementors; all contributors building operational views
**Last updated:** 2026-05-26
**Status:** CANONICAL — workspace compositions not conforming to this document are not eligible for deployment as operational environments
**Phase:** Operational Execution Surface Era

---

## Purpose

This document defines how operational workspaces are structurally assembled: what panes they contain, what authority each pane holds, how they handle concurrent live and replay state, and what they may never do.

**A workspace is not a screen.** A screen displays information. A workspace is an operational reasoning environment — a structured space in which an operator builds and maintains a mental model of operational reality, takes consequential actions, and navigates through time. The composition of a workspace directly governs whether that reasoning environment is safe, coherent, and trustworthy.

**The governing principle: workspace composition must preserve operational causality.** An operator who is working within a workspace must always be able to determine: what state am I looking at, when does it reflect, what authority produced it, and what will change if I act here.

---

## Section 1 — Canonical Workspace Topology

### 1.1 Workspace Zones

Every operational workspace is composed of exactly three zones. A workspace may not add additional zones; it may not merge zones.

```
┌──────────────────────────────────────────────────────┐
│  CONTEXT ZONE (top band, fixed height)               │
│  What am I looking at? What mode am I in?            │
├────────────────────┬─────────────────────────────────┤
│  NAVIGATION ZONE   │  PRIMARY OPERATIONAL ZONE        │
│  (left pane,       │  (center/right, expands)         │
│  collapsible)      │  What is the current state?      │
│                    │  What can I do?                  │
├────────────────────┴─────────────────────────────────┤
│  CONTEXT DETAIL ZONE (bottom panel, collapsible)     │
│  Why is the current state this way?                  │
│  Explanation surfaces, event history, audit trail    │
└──────────────────────────────────────────────────────┘
```

**Context Zone:** Persistent. Displays: current workspace type, scope identity, operational mode (LIVE/REPLAY/PREVIEW/DEGRADED), active incident indicators, temporal context (current PRE operational clock or replay timestamp). This zone may never be hidden.

**Navigation Zone:** Collapsible, but collapse must be explicit operator action — it must not collapse automatically in response to any system event. When collapsed, a persistent affordance restores it. Collapsed state persists across navigation within the same workspace session.

**Primary Operational Zone:** Never collapsed. The principal rendering area for the workspace's operational scope.

**Context Detail Zone:** Collapsible by operator. Provides explanation depth (EH-2+), event history, and audit access. Collapse state persists per workspace type.

### 1.2 Workspace Types and Their Primary Zone Content

| Workspace type | Primary Zone primary content | Context Detail default state |
|---|---|---|
| Fleet Overview | Health grid, fleet-wide status indicators | Collapsed — operator expands per venue |
| Venue Operations | Venue health, active overrides, schedule state | Expanded — explanation is primary workflow |
| Screen Management | Screen enrollment, content state, per-screen health | Collapsed |
| Incident Response | Incident timeline, escalation status, affected scope | Expanded — context is critical during incidents |
| Replay Investigation | Historical state display, timeline scrubber | Expanded — explanation is the purpose |
| Sponsorship Operations | SOV tracking, override age, delivery proof | Collapsed |

### 1.3 Pane Authority Hierarchy

Each pane within a workspace has a defined authority over what it displays:

**Context Zone authority:** Scope identity and operational mode. This zone does not display operational values — it displays meta-information about what the operator is currently looking at. It reads from the workspace state model, not from the authoritative state of the scope directly.

**Navigation Zone authority:** Spatial hierarchy and scope selection. Navigation zone components indicate which scopes exist and their high-level health, but do not render detailed operational values. Venue health badges in the navigation zone show grade only — detail is in the Primary zone.

**Primary Operational Zone authority:** Current authoritative state for the selected scope. All consequential operational values. All interaction affordances. Primary zone panes subscribe to the authoritative state model for the active scope.

**Context Detail Zone authority:** Explanation, history, and audit for the current Primary zone content. Context Detail reads from the explanation service — it does not have an independent state subscription for operational values. Whatever the Primary zone displays, the Context Detail zone explains.

---

## Section 2 — Pane Authority Rules

### 2.1 Pane State Subscriptions

**Rule PA-01:** Each pane subscribes to exactly one authoritative state source for its primary content. A pane that mixes state from multiple authorities for the same fact creates invisible authority ambiguity.

**Rule PA-02:** Panes in the Primary zone may not derive operational values locally. They render what their authoritative state subscription provides.

**Rule PA-03:** The Context Detail zone does not have independent state authority. It mirrors the explanation for what the Primary zone currently displays. If the Primary zone changes scope, the Context Detail zone follows.

**Rule PA-04:** Navigation zone components may not reflect state that is newer than what the Primary zone displays. If the Primary zone is in REPLAY-RENDERED mode at timestamp T, navigation zone health indicators must show state at timestamp T — not current live state. A navigation zone showing live state while the Primary zone shows replay state creates a false temporal collage.

### 2.2 Cross-Pane State Coherence

All panes within a workspace must display state from the same temporal context:

```
// Workspace temporal context: the common timestamp reference for all panes.
// In LIVE mode: current PRE operational clock (all panes show current state)
// In REPLAY mode: replay timestamp (all panes show state at that timestamp)
// In split LIVE/REPLAY: each panel has its own temporal context, clearly labeled

const workspaceTemporalContext = useWorkspaceTemporalContext();
// workspaceTemporalContext.mode: 'LIVE' | 'REPLAY'
// workspaceTemporalContext.timestamp: PRE operational clock timestamp
// workspaceTemporalContext.label: display label for the temporal context

// Every pane reads this context and applies it to its state subscription.
const paneState = useAuthoritativeState(scope, workspaceTemporalContext.timestamp);
```

**Forbidden:**
```
// DO NOT allow individual panes to subscribe to different temporal contexts
// within the same workspace without explicit split-view governance.
// A workspace where pane A shows live state and pane B shows 2-hour-old state
// without clear temporal labeling on both is a causality violation.
```

---

## Section 3 — Live/Replay Coexistence Rules

### 3.1 Full Replay Mode

When the workspace enters full replay mode (all panes in REPLAY-RENDERED state):

- Context Zone: replay state header replaces operational mode indicator; replay timestamp visible at all times
- Navigation Zone: health indicators show state at replay timestamp, with REPLAY badge
- Primary Zone: all operational values from replay state model at replay timestamp
- Context Detail Zone: explanations for the replay-timestamp state
- Live updates continue processing to the live state model in the background — they are not rendered anywhere in the workspace

### 3.2 Split Live/Replay Mode

When the workspace displays a split live/replay comparison (permitted per REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md):

```
// Split-view governance: each panel has its temporal context labeled.
// No shared pane displays both temporal contexts simultaneously.
// The live panel and replay panel are visually separated with a clear divider.
// The replay panel has a prominent REPLAY badge; the live panel has a LIVE badge.
// Navigation zone: shows current live state (the live panel is the active reference).

<SplitWorkspaceView>
  <ReplayPanel
    scope={scope}
    timestamp={replayTimestamp}
    // Contains: its own Context Detail zone for the replay timestamp
    // Does NOT share state with the live panel
  />
  <LivePanel
    scope={scope}
    // Contains: its own Context Detail zone for live state
    // Does NOT share state with the replay panel
  />
</SplitWorkspaceView>
```

**What split mode does NOT permit:**
- A navigation zone that shows "average" state between live and replay
- A Context Detail zone that mixes explanations from both temporal contexts
- Any aggregated value that combines live and replay data

### 3.3 Replay-Safe Workspace Behavior

```
// A workspace in replay mode must not:
// 1. Show live action affordances that would apply to historical state.
//    Override creation in replay mode creates an override for the historical context — confusing.
// 2. Show notification banners for live events (except Tier 4+ awareness banners).
// 3. Update the navigation zone health indicators from live events.
// 4. Allow the operator to lose track of the replay timestamp.

// A workspace in replay mode must:
// 1. Show the replay timestamp in Context Zone at all times.
// 2. Disable consequential action affordances that operate on live state.
// 3. Enable replay-specific affordances: timeline scrubber, counterfactual, explanation depth.
// 4. Show a "return to live" affordance that is always reachable.
```

---

## Section 4 — Modal Governance

### 4.1 Modal Authority Rules

Modals interrupt the workspace's operational flow. Each modal type has defined authority over what it may interrupt:

| Modal type | May interrupt current workflow | May interrupt emergency flow | Dismissible by operator |
|---|---|---|---|
| Confirmation modal (standard) | Yes | No | Yes — cancel the action |
| Conflict/collision warning | Yes | No | Yes — proceed anyway |
| Context drift warning | Yes | No | Yes — proceed with awareness |
| Tier 4 escalation modal | Yes | No | Yes — after reading |
| Emergency confirmation modal | Only if emergency in progress | N/A — is the emergency flow | No — must complete or cancel emergency |

**Forbidden modal behaviors:**
```
// DO NOT show a modal that can only be dismissed by completing an action.
// Every modal has a cancel/dismiss path that does not commit the action.
// Exception: emergency confirmation modal is cancel-only (no "dismiss and proceed").

// DO NOT stack modals.
// If a second modal-worthy event arrives while a modal is open,
// queue it as a notification — do not open a second modal on top.

// DO NOT auto-dismiss modals on timeout.
// A modal that disappears after N seconds is operationally dangerous —
// the operator may not have seen it.
```

### 4.2 Modal State Preservation

```
// When a modal is opened during an in-progress interaction:
// - The background workspace state is frozen visually (no transitions render behind the modal)
// - The background workspace continues processing events to its state model
// - On modal dismissal, the workspace applies any queued state changes
// - The operator sees a coherent transition from pre-modal state to post-modal state
// - They do not see the accumulated transitions that happened during the modal
```

---

## Section 5 — Cross-Workspace Synchronization

### 5.1 Shared Operational Context

When an operator navigates between workspaces, the operational context they were in is preserved:

```
// Workspace context that persists across workspace navigation:
WorkspaceContext {
  activeScope: Scope,           // The venue/fleet/screen they were viewing
  temporalContext: TemporalContext, // LIVE or specific replay timestamp
  activeIncidentId: string | null,  // If they were in incident response
  filterSelections: FilterState,    // Operator's display preferences
  replayAnchor: ReplayAnchor | null, // If they were in a replay investigation
}
```

**When navigating from Venue Operations to Fleet Overview:** The Fleet Overview highlights the venue the operator was just viewing. Their replay anchor (if in replay) persists — the Fleet Overview shows fleet state at the replay timestamp.

**When navigating from Fleet Overview to Venue Operations for a specific venue:** That venue's scope is pre-selected. No additional navigation step is required.

### 5.2 Context Persistence Boundaries

```
// What persists across workspace navigation:
const PERSISTS_ACROSS_NAVIGATION = [
  'activeScope',
  'temporalContext',      // Replay timestamp carries over
  'activeIncidentId',     // Incident context carries over
  'replayAnchor',         // Investigation anchor carries over
];

// What resets on workspace navigation:
const RESETS_ON_NAVIGATION = [
  'contextDetailExpansion',   // User's panel expansion state
  'formDraftState',           // Incomplete forms do not persist to another workspace
  'scrollPosition',           // Scroll position is workspace-local
];
```

**Exception: form draft state.** If an operator navigates away from a workspace while a form is partially completed, they receive a draft preservation prompt before navigation completes:

```
<FormDraftPreservationPrompt
  draftType={draftType}
  message="You have an unsaved override draft. Save as draft or discard?"
  onSave={() => saveDraft(formState)}
  onDiscard={() => navigateAway()}
  // Navigation is paused until operator responds.
  // Cannot be dismissed without choosing.
/>
```

---

## Section 6 — State Persistence Boundaries

### 6.1 What a Workspace Persists

A workspace is responsible for persisting display state (not operational state) across re-mounts and navigation:

| State type | Persists | Storage mechanism |
|---|---|---|
| Navigation zone collapse state | Yes — per workspace type | Session storage |
| Context detail expansion state | Yes — per workspace type | Session storage |
| Active scope selection | Yes — restored on workspace return | Session storage |
| Filter selections | Yes — per operator preference | User preference store |
| Replay timestamp | Yes — during active investigation | Session storage |
| Form draft state | Yes — with explicit operator consent | Session storage, max 24h |
| Scroll position | No — resets on workspace re-entry | Not stored |
| Expanded explanation depth | No — opens at EH-2 by default | Not stored |

### 6.2 What a Workspace Must NOT Persist

```
// A workspace must not cache authoritative operational state.
// It reads from the authoritative state model on every mount.
// A workspace that "remembers" venue health from a previous visit
// and displays it without re-fetching is exhibiting stale state without disclosure.

// A workspace must not persist its last-seen rendering state.
// On re-entry, it subscribes fresh and enters whatever current rendering state applies.
// It does not "remember" that it was previously in STALE state and pre-apply the badge.
```

---

## Section 7 — Focus Preservation

### 7.1 Focus Preservation During Workspace Transitions

```
// When the operator navigates between workspaces:
// - Focus moves to the Context Zone of the new workspace
// - Tab order begins from the top-left of the new workspace
// - No pane within the new workspace pre-captures focus

// When the operator returns to a workspace they previously visited:
// - Focus moves to the last element they had focused, if it still exists
// - If the last focused element no longer exists (scope changed): focus moves to Context Zone
// - Focus is never returned to a form that was completed
```

### 7.2 Focus Must Survive State Updates

```
// Live state updates entering the workspace must not move focus.
// Structural changes (a pane appearing or disappearing due to mode change) must not move focus.
// Exception: if the focused element is removed from the DOM, focus moves to the nearest
//            sibling with aria-label. Never to body.

// Implementation: operational components use refs for focus tracking, not DOM keys.
// Re-keying a component clears focus. Operational components are never re-keyed
// due to state content changes — only due to scope changes.
```

---

## Section 8 — Split-View Governance

### 8.1 Split-View Legality

Split views are permitted only for:
- Live/replay comparison of the same scope (explicit operator action)
- Multi-venue side-by-side comparison (Fleet Overview only, maximum 4 venues)

Split views are not permitted for:
- Displaying the same scope in two different operational states simultaneously (would create a false appearance of two realities)
- Displaying two unrelated scopes with implied comparison (comparison requires explicit operator framing)

### 8.2 Split-View Constraints

```
// Each panel in a split view is a complete operational zone — it has its own
// Context Zone label, its own temporal context, its own state subscriptions.

// Maximum split panels: 2 in a standard workspace, 4 in Fleet Overview grid view.
// Above this limit, the operator must navigate rather than add panels.

// Each panel must be large enough to display its operational content without truncation.
// If viewport is too small for a split view, the workspace must collapse to single-panel
// with a navigation affordance between the panels — never truncate operational content.
```

---

## Section 9 — Operational Density Balancing

### 9.1 Density Rules by Workspace Type

Each workspace type has a defined information density target from INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md:

| Workspace | Primary density layer | Secondary | Accessible on demand |
|---|---|---|---|
| Fleet Overview | Ambient (L1) | Diagnostic (L2) | Forensic (L3) |
| Venue Operations | Diagnostic (L2) | Forensic (L3) | Executive (L4) |
| Incident Response | Diagnostic (L2) — elevated | Forensic (L3) | All others suppressed |
| Replay Investigation | Forensic (L3) | Replay (L5) | All others available |

### 9.2 Anti-Density-Overflow Rules

```
// A workspace that attempts to display content above its target density layer
// must use progressive disclosure — not overflow into adjacent panes.
// Forensic content in a Fleet Overview workspace is accessible via drill-down,
// never surfaced in the primary grid.

// When information density exceeds cognitive capacity (more than 7±2 distinct
// state signals visible simultaneously), the workspace must suppress lower-priority
// signals per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md.
// Suppressed signals remain accessible, not hidden — they are de-emphasized.
```

---

## Section 10 — Emergency-Mode Workspace Transformation

### 10.1 Emergency Entry Transformation

When an emergency is activated, the workspace transforms within 200ms:

```
// Emergency-mode workspace transformation:
// 1. Navigation zone collapses if expanded (operator is committed to emergency scope)
// 2. Context Zone expands to full emergency state header
// 3. Primary zone: emergency scope becomes the primary content
//    Non-emergency content is moved to an "other scopes" secondary area
// 4. Context Detail zone: expands with incident timeline
// 5. All non-emergency notification banners are suppressed (remain accessible in log)
// 6. Interaction affordances for non-emergency actions are de-emphasized (not removed)

// The transformation is reversible: when the emergency is resolved,
// the workspace restores its pre-emergency layout.
```

### 10.2 Emergency-Mode What Must NEVER Change

```
// During emergency-mode workspace transformation:
// - Replay functionality must remain accessible (operator may need to investigate a prior state)
// - Explanation surfaces must remain accessible
// - The operator's active in-progress actions (pending actions) remain visible
// - Navigation to other scopes remains possible (operator may need to check affected venues)
// - The exit-emergency affordance must be reachable within 2 taps
```

---

## Section 11 — What a Workspace May NEVER Do

```
// A workspace may NEVER:
// 1. Display operational values without a visible temporal context label
// 2. Allow a pane to display state from a different temporal context than the workspace
//    without explicit split-view governance
// 3. Auto-navigate away from the operator's current position due to a live event
// 4. Suppress the explanation surface (Context Detail zone) entirely — collapse is permitted
// 5. Close or dismiss an in-progress interaction flow automatically
// 6. Show a "convenient summary" that hides individual operational values
// 7. Merge state from multiple sources for the same operational fact
// 8. Display a cached operational value without a freshness indicator
// 9. Allow a navigation zone to show newer state than the Primary zone in replay mode
// 10. Start in replay mode without explicit operator initiation
```

---

## Failure Modes

### Failure Mode WC-01: Temporal Collage

**What it is:** Different panes within the same workspace display state from different timestamps without explicit labeling. The operator forms a composite mental model that is never actually true — it combines parts of different historical states.

**Prevention:** Workspace temporal context (Section 2.2). All panes read from the same workspace temporal context. Split-view governance explicitly labels each panel's temporal context.

---

### Failure Mode WC-02: Navigation-Triggered State Loss

**What it is:** The operator navigates to another workspace and back, losing their replay anchor, their active investigation, and their filter state. They must reconstruct their operational context from scratch.

**Prevention:** Context persistence boundaries (Section 5). Replay anchors, active incident context, and scope selections persist across navigation.

---

### Failure Mode WC-03: Modal-Obscured State Change

**What it is:** A consequential state change (emergency activation, health grade transition) occurs while a modal is open. The operator acknowledges the modal and then discovers that the state has changed significantly since the modal opened — but the modal gave no indication.

**Prevention:** Modal state preservation (Section 4.2). Background workspace events are queued during modals. On modal dismissal, the operator sees what changed while they were in the modal. Tier 4+ events produce a banner visible over the modal.

---

### Failure Mode WC-04: Authority Ambiguity in Panes

**What it is:** Multiple panes within a workspace display different values for the same operational fact — because they have different state subscriptions. The operator cannot determine which is authoritative.

**Prevention:** Pane authority rules (Section 2.1). Each operational fact is displayed by exactly one pane with one authoritative state subscription.

---

### Failure Mode WC-05: Replay Contamination via Navigation Zone

**What it is:** The operator enters replay mode. The navigation zone continues to show live venue health grades. The operator sees one grade in the navigation zone and a different (correct, historical) grade in the Primary zone. They trust the navigation zone grade as current.

**Prevention:** Cross-pane state coherence (Section 2.2) and replay-safe workspace behavior (Section 3.3). Navigation zone subscribes to the workspace temporal context — in replay mode, it shows state at the replay timestamp.

---

## Related Documents

**OPERATIONAL-WORKSPACES-v1.md** — The 7 workspace types and role-adaptive hierarchy that this document's composition rules govern.

**RENDERING-ORCHESTRATION-AND-VIEW-STABILITY-v1.md** — The rendering stability rules that govern how workspace panes update during continuous state change.

**OPERATIONAL-SHELL-AND-APPLICATION-CHROME-v1.md** — The persistent shell that wraps all workspaces and provides the global operational context that workspace Context Zones read from.

**INTERACTION-SEQUENCING-SPEC.md** — The canonical interaction flows that workspace modal governance (Section 4) must not disrupt.

**INFORMATION-DENSITY-AND-DASHBOARD-ERGONOMICS-v1.md** — The information density layers that workspace density rules (Section 9) enforce.

---

*End of WORKSPACE-COMPOSITION-ARCHITECTURE-v1.md v1.0*
*Authority: Agent 3 (UX Architecture / Rendering Integrity)*
*PRE state subscription rules reviewed by: Agent 1*
*Cross-workspace synchronization data contracts reviewed by: Agent 2*
*Workspace topology, pane authority, and composition rules: Agent 3 definition authority*
