# COMPONENT ASSEMBLY AND BOUNDARY GOVERNANCE v1

**Era:** Implementation Bootstrap
**Status:** CANONICAL
**Scope:** Component boundaries, dependency governance, PRE isolation, replay/live separation, operational blast radius

---

## 1. PURPOSE

This document defines the structural rules for assembling the ClubHub TV frontend from discrete, constitutionally-bounded components. Boundary violations are not style preferences — they break replay safety, contaminate operational truth, and create uncontainable blast radius during incidents.

---

## 2. COMPONENT TAXONOMY

Every frontend component belongs to exactly one category. Mixed-category components are forbidden.

### 2.1 Shell Components

**Definition:** Components that constitute the persistent operational frame — always visible, always authoritative, never hidden by workspace content.

**Responsibilities:**
- Render operational status indicators (system health, connectivity, session state)
- Host interrupt and incident notification surfaces
- Provide navigation chrome
- Maintain always-visible operator context (venue, screen, current operator identity)

**Restrictions:**
- MUST NOT render content from PRE resolution
- MUST NOT conditionally unmount during incident or degraded mode
- MUST NOT depend on Workspace state
- MUST NOT be re-rendered by workspace content changes

**Examples:** `OperationalStatusBar`, `SessionChrome`, `IncidentBanner`, `NavigationRail`

### 2.2 Workspace Container Components

**Definition:** Components that manage the layout and lifecycle of operational panes. They orchestrate, never render business content themselves.

**Responsibilities:**
- Manage pane layout (split, stacked, focus)
- Enforce zone authority hierarchy
- Coordinate replay/live pane coexistence
- Route render events to correct panes

**Restrictions:**
- MUST NOT contain business logic
- MUST NOT directly subscribe to PRE resolution state
- MUST NOT own any operational state machines
- MUST NOT render content (only containers)

**Examples:** `WorkspaceRoot`, `PaneRouter`, `ZoneOrchestrator`

### 2.3 Operational Pane Components

**Definition:** Components that own a single operational surface (live view, replay view, schedule view, etc.).

**Responsibilities:**
- Own one operational state machine subscription
- Render content appropriate to their operational mode
- Surface explainability context for their domain
- Handle degraded rendering within their zone

**Restrictions:**
- MUST NOT reach across pane boundaries to read sibling state
- MUST NOT share state with other panes via shared mutable context
- MUST NOT initiate state transitions in other panes directly
- Communication between panes is via events only

**Examples:** `LivePlayerPane`, `ReplayPlayerPane`, `SchedulePane`, `IncidentPane`

### 2.4 PRE-Boundary Components

**Definition:** Components that sit at the boundary between authoritative PRE resolution and the rendering layer. Exactly one per PRE data type.

**Responsibilities:**
- Receive PRE resolution results from the state machine
- Validate resolution completeness before passing to renderers
- Attach determinism metadata to all downstream data
- Block rendering if resolution state is STALE or FAILED

**Restrictions:**
- MUST NOT modify PRE resolution data
- MUST NOT cache PRE results locally (the state machine is the cache)
- MUST NOT pass STALE or FAILED resolution to renderers (render fallback instead)
- MUST NOT exist at more than one layer of the component tree

**Examples:** `PREResolutionBoundary`, `ManifestAuthoritySurface`, `ScheduleResolutionBoundary`

### 2.5 Explainability Components

**Definition:** Components that render the "why" of any operational decision — schedule item selection, content priority, entropy scores, etc.

**Responsibilities:**
- Render explanation payloads from the PRE explainability system
- Surface causal attribution (which resolver, which rule, which corpus source)
- Display confidence and authority scores
- Surface replay-vs-live comparison when in replay mode

**Restrictions:**
- MUST NOT re-derive explanations from raw data (render only what explainability system provides)
- MUST NOT be omitted when explanation is available (always-on when relevant)
- MUST NOT render stale explanations (must match current resolution)
- MUST NOT synthesize explanations from partial data

**Examples:** `DecisionExplainer`, `EntropyScorePanel`, `CausalAttributionCard`, `ReplayVsLiveDiff`

### 2.6 Operational Content Renderers

**Definition:** Leaf components that render specific content (schedule items, media assets, operator controls).

**Responsibilities:**
- Render exactly the data passed to them
- Surface their rendering context (live vs replay, determinism status)
- Accept fallback rendering instructions

**Restrictions:**
- MUST NOT fetch data
- MUST NOT subscribe to state machines
- MUST NOT contain conditional logic based on operational mode (operational mode is a prop)
- MUST NOT render without a determinism attestation prop

**Examples:** `ScheduleItemCard`, `MediaAssetTile`, `OperatorControl`, `ContentSlot`

### 2.7 Simulation/Testing Harness Components

**Definition:** Components used only in test and simulation environments — never shipped to production.

**Restrictions:**
- MUST NOT be imported by any production component
- MUST be tree-shaken from production builds (verified by CI)
- MUST expose the same interface as the production components they replace

---

## 3. PRE-BOUNDARY ISOLATION

The PRE boundary is the most critical architectural seam in the frontend. It separates **authoritative resolution** from **rendering**.

### 3.1 The Boundary Contract

```
[PRE State Machine] → [PRE-Boundary Component] → [Operational Pane] → [Content Renderer]
        ↑                       ↑
   only source of         only consumer
   resolution truth       of resolution truth
   in the frontend        (single crossing point)
```

**What crosses the boundary (permitted):**
- Deterministic resolution result with metadata
- Explanation payload
- Determinism attestation (hash, source, timestamp)
- Stale/failed status indicator

**What NEVER crosses the boundary:**
- Raw backend response objects
- Mutable resolution state
- Resolution-in-flight flags (RESOLVING is handled before the boundary)
- Backend session tokens or credentials

### 3.2 Boundary Crossing Validation

Before passing resolution data across the boundary, the PRE-Boundary Component MUST verify:

```typescript
interface PREBoundaryCrossing {
  resolution: PREResolutionResult;
  attestation: {
    determinismHash: string;    // must match backend-issued hash
    resolvedAt: string;         // ISO8601
    resolverChain: string[];    // ordered list of resolvers applied
    sourcePacketId?: string;    // if replay-bound
  };
  state: 'RESOLVED' | 'REPLAY_BOUND';  // STALE and FAILED never cross
}
```

If state is STALE or FAILED, the boundary renders a `<DegradedResolutionFallback>` instead of passing to the pane.

---

## 4. EXPLAINABILITY RENDERING BOUNDARIES

Explainability content is rendered in a **dedicated zone** — it does not contaminate the primary operational pane.

### 4.1 Explainability Zone Isolation

```
WorkspaceRoot
├── PrimaryZone        (operational content — live or replay)
├── ExplainabilityZone (always reads from same resolution as PrimaryZone)
└── ShellZone          (always-visible chrome)
```

The ExplainabilityZone is subscribed to the same PRE-Boundary output as the PrimaryZone, but renders only explanation metadata.

**Rule:** ExplainabilityZone state MUST be identical to PrimaryZone's resolution state. They can never diverge.

### 4.2 Replay Explanation Parity

During replay, the ExplainabilityZone MUST render the **historical explanation** from the corpus packet, not a re-derived explanation. Live re-derivation during replay is a constitutional violation.

---

## 5. REPLAY/LIVE SEPARATION BOUNDARIES

### 5.1 The Hard Separation Rule

Replay rendering components and live rendering components MUST be separate component trees. They MUST NOT share state.

```
WorkspaceRoot
├── LivePlayerPane     (active when Player state = LIVE | DEGRADED)
│   ├── PREResolutionBoundary (live)
│   └── LiveContentRenderer
└── ReplayPlayerPane   (active when Player state = REPLAY)
    ├── PREResolutionBoundary (replay-bound)
    └── ReplayContentRenderer
```

Both panes may exist in the DOM simultaneously (for transition smoothness), but only one is authoritative at a time, determined by the Player state machine.

### 5.2 Forbidden Cross-Contamination

| Violation | Why Forbidden |
|---|---|
| ReplayPane reading live PRE state | Contaminates historical truth |
| LivePane rendering fallback from replay corpus | Breaks live authority |
| Shared scroll/position state between live and replay | Replay position is corpus-derived, not live |
| Shared content cache between live and replay | Cache invalidation must be independent |
| Single renderer toggled via `isReplay` prop | Creates invisible branching, impossible to audit |

### 5.3 Transition Between Live and Replay

The transition from LIVE to REPLAY is a **state machine event**, not a component prop toggle. The WorkspaceRoot listens to the Player state machine and mounts/unmounts pane trees accordingly. The panes themselves are stateless with respect to each other.

---

## 6. SHELL VS WORKSPACE RESPONSIBILITIES

### 6.1 Shell Responsibilities (never delegated to Workspace)

- Operational status display (connectivity, sync state, session validity)
- Incident announcements and escalation indicators
- Persistent operator identity display
- Navigation chrome
- System-level alerts

### 6.2 Workspace Responsibilities (never delegated to Shell)

- Content rendering (schedule, media, replays)
- PRE resolution display
- Operational pane management
- Operator workflow actions (schedule edits, replay initiation)

### 6.3 The Hard Rule

Shell components MUST NOT conditionally hide or minimize based on workspace state. The shell is always authoritative. Workspace content never occludes the shell.

---

## 7. CROSS-COMPONENT CAUSALITY PROPAGATION

When an action in one component must cause an effect in another, the propagation path is:

```
Component A (emits event)
  → Event Bus (typed, structured)
  → State Machine (processes event, transitions)
  → State Machine Subscription (triggers re-render)
  → Component B (re-renders from new state)
```

**Direct component-to-component communication is forbidden** for operational state propagation.

### 7.1 Event Ownership Rules

Each event type is owned by exactly one component (the emitter). No other component may emit it.

```typescript
// Event ownership registry (enforced at build time via linting rule)
const EVENT_OWNERSHIP: Record<string, string> = {
  'replay:initiated':        'ReplayControlPanel',
  'incident:acknowledged':   'IncidentBanner',
  'session:elevated':        'ElevationDialog',
  'pane:focus-changed':      'WorkspaceRoot',
  'pre:invalidation-forced': 'PREResolutionBoundary',
};
```

If a component needs to cause an event owned by another, it must do so via a state machine transition, not by directly emitting the event.

### 7.2 Event Payload Contract

All events on the operational event bus MUST include:

```typescript
interface OperationalEvent<T> {
  type: string;
  payload: T;
  emittedBy: string;       // component ID
  authority: string;       // OPERATOR | BACKEND | SYSTEM
  timestamp: string;       // ISO8601 from GovernedClock
  traceId: string;         // propagated from originating trace
  replayContext?: {
    packetId: string;
    replayTimestamp: string;
  };
}
```

---

## 8. COMPONENT DEPENDENCY GOVERNANCE

### 8.1 Legal Dependency Directions

```
Shell Components
  ↓ (can use)
Workspace Container Components
  ↓ (can use)
Operational Pane Components
  ↓ (can use)
PRE-Boundary Components
  ↓ (can use)
Explainability Components
Operational Content Renderers
```

**Upward dependencies are forbidden.** A renderer cannot import from a pane. A pane cannot import from a workspace container. A workspace container cannot import from shell.

### 8.2 Forbidden Dependency Directions

| From | To | Why Forbidden |
|---|---|---|
| Content Renderer | Pane Component | Reverses authority hierarchy |
| Pane Component | Workspace Container | Creates circular authority |
| Shell Component | Workspace Component | Shell is independent of workspace state |
| Any Component | Simulation Harness Component | Production contamination |
| PRE-Boundary | Backend API directly | Must go through state machine |
| Explainability Component | PRE State Machine directly | Must receive via boundary, not direct subscription |

### 8.3 Shared Utility Governance

Shared utilities (formatters, date helpers, etc.) are permitted cross-cutting concerns. They MUST:
- Contain no state
- Contain no side effects
- Be pure functions
- Use GovernedClock (not Date.now()) for any time operations

---

## 9. ANTI-SPAGHETTI GOVERNANCE

### 9.1 The Three Prohibited Patterns

**Pattern 1: God Context**
A single React context (or equivalent) that holds all operational state, subscribed to by all components.
- Creates invisible dependency web
- Makes blast radius unbounded
- Prevents component-level replay isolation

**Pattern 2: Prop Drilling for Operational Mode**
Passing `isReplay`, `isIncident`, `isDegraded` as props through multiple component layers.
- Creates invisible branching
- Breaks component boundary authority
- Impossible to audit during incident

**Pattern 3: Ambient State Inference**
Components checking global variables, window properties, or unstructured localStorage to determine operational mode.
- Non-deterministic
- Non-serializable
- Non-replayable

### 9.2 The Required Pattern

Each component subscribes to exactly the state machines it owns or is authorized to observe. No more, no less.

```typescript
// Correct: pane subscribes to its own state machine
function LivePlayerPane() {
  const playerState = usePlayerStateMachine();  // authorized
  const preResolution = usePREBoundary();       // authorized for this pane
  // ...
}

// Correct: renderer receives everything as props
function ScheduleItemCard({ item, operationalMode, determinismAttestation }) {
  // no subscriptions
}

// VIOLATION: renderer checks global state
function ScheduleItemCard({ item }) {
  const { isReplay } = useGlobalOperationalContext();  // FORBIDDEN
}
```

---

## 10. OPERATIONAL BLAST RADIUS CONTAINMENT

### 10.1 Failure Boundary Placement

Error boundaries MUST be placed at pane boundaries, not at the root:

```
WorkspaceRoot
├── ErrorBoundary → LivePlayerPane
├── ErrorBoundary → ReplayPlayerPane
├── ErrorBoundary → SchedulePane
└── ShellZone (no error boundary — shell MUST NOT crash silently)
```

A failure in one pane MUST NOT propagate to other panes or the shell.

### 10.2 Shell Failure Is Critical

Shell components MUST NOT have error boundaries that suppress failure. If the shell crashes, it surfaces immediately to the operator. Shell failures are deployment-blocking.

### 10.3 Incident-Safe Degradation Contract

Each pane must declare its incident-safe degradation behavior:

```typescript
interface PaneDegradationContract {
  paneId: string;
  onIncidentDeclared: 'MINIMIZE' | 'CONTINUE' | 'SHOW_INCIDENT_SURFACE';
  onBackendUnreachable: 'SHOW_STALE_WITH_WARNING' | 'SHOW_FALLBACK' | 'HIDE';
  onPREFailed: 'SHOW_FALLBACK_CONTENT' | 'SHOW_ERROR' | 'HIDE';
  onReplayIntegrityFail: 'ABORT_REPLAY' | 'SHOW_ERROR';
}
```

These contracts are verified by the simulation harness (see FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1.md).

---

## 11. REPLAY-SAFE COMPOSITION GUARANTEES

A component tree is replay-safe if and only if:

1. All operational state flows from state machines, not component-local derived state
2. All time references use GovernedClock
3. No component reads from sources outside the replay-bound data set during replay
4. Error boundaries do not swallow replay integrity failures
5. Explainability zone renders historical explanations, not re-derived ones
6. No network calls are made from within the replay-bound component tree (all data comes from corpus)

Replay safety is verified per-component in the simulation harness. A component with unverified replay safety MUST NOT be deployed to production.

---

*Document status: CANONICAL — Implementation Bootstrap Era*
*Do not modify without constitutional governance review*
